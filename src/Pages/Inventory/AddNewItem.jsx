import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import MainLayout from "../../Components/Layouts/MainLayout";
import { Card, Button, PageHeader, Select } from "../../Components/UI";
import { resolveSidebarVariant } from "../../utils/helpers";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const AddNewItem = () => {
  const location = useLocation();
  const { role } = useParams();
  const sidebarVariant = resolveSidebarVariant(location.pathname, role);
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("currentUser") || "{}");
    } catch {
      return {};
    }
  }, []);
  const initialInventoryId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("inventoryId") || "";
  }, [location.search]);
  const isInchargeMode = role === "incharge" || currentUser.role === "inventory_incharge";
  const [uploadMode, setUploadMode] = useState("single"); // "single" or "bulk"
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkItems, setBulkItems] = useState([]);
  const [selectedBulk, setSelectedBulk] = useState({});
  const [selectAllBulk, setSelectAllBulk] = useState(false);
  const [labelLayout, setLabelLayout] = useState('grid'); // 'grid' or 'avery'
  const [assignedInventories, setAssignedInventories] = useState([]);
  const [selectedInventoryId, setSelectedInventoryId] = useState(initialInventoryId);
  const [inventoryLoadError, setInventoryLoadError] = useState("");
  
  const [itemData, setItemData] = useState({
    itemName: "",
    itemCode: "",
    serialNo: "",
    serialNo2: "",
    model: "",
    QRCode: "",
    QRCode2: "",
    pageno: "",
    itemImage: null,
    value: "",
    purchaseDate: "",
    ginNo: "",
    ginfile: null,
    poNo: "",
    supplier: "",
    funding: "",
    fundingOther: "",
    receivedfrom: "",
    warranty: "",
    warrantyOther: "",
    location: "",
    remarks: ""
  });

  useEffect(() => {
    if (!isInchargeMode || !currentUser.id) {
      return undefined;
    }

    let isMounted = true;

    const loadAssignedInventories = async () => {
      try {
        setInventoryLoadError("");
        const response = await fetch(`${API_BASE_URL}/api/inventories`);
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || data.message || "Failed to load assigned inventories.");
        }

        if (!isMounted) {
          return;
        }

        const nextInventories = (data.inventories || []).filter(
          (inventory) => String(inventory.inchargeId) === String(currentUser.id)
        );
        setAssignedInventories(nextInventories);

        if (!selectedInventoryId && nextInventories.length === 1) {
          setSelectedInventoryId(String(nextInventories[0].id));
        }
      } catch (error) {
        if (isMounted) {
          setAssignedInventories([]);
          setInventoryLoadError(error.message || "Failed to load assigned inventories.");
        }
      }
    };

    loadAssignedInventories();
    return () => {
      isMounted = false;
    };
  }, [API_BASE_URL, currentUser.id, isInchargeMode, selectedInventoryId]);

  const inventoryOptions = useMemo(
    () => assignedInventories.map((inventory) => ({ value: String(inventory.id), label: `${inventory.name} (${inventory.location || "No location"})` })),
    [assignedInventories]
  );

  const selectedInventory = assignedInventories.find((inventory) => String(inventory.id) === String(selectedInventoryId)) || null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setItemData((prev) => {
      const next = {
        ...prev,
        [name]: value
      };

      if (name === "funding" && value !== "other") {
        next.fundingOther = "";
      }

      if (name === "warranty" && value !== "other") {
        next.warrantyOther = "";
      }

      return next;
    });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setItemData({
        ...itemData,
        itemImage: file
      });
    }
  };

  const handleGinFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setItemData({
        ...itemData,
        ginfile: file
      });
    }
  };

  // Generate QR value based on itemCode + serialNo + itemName (if any)
  const computeQRCodeValue = (code, serial, name) => {
    const parts = [];
    if (code && code.trim() !== "") parts.push(code.trim());
    if (serial && serial.trim() !== "") parts.push(serial.trim());
    if (name && name.trim() !== "") parts.push(name.trim().replace(/\s+/g, '_'));
    return parts.join('_');
  };

  const generateAndSetQRCode = (force = false) => {
    const code = itemData.itemCode && itemData.itemCode.trim();
    const serial = itemData.serialNo && itemData.serialNo.trim();
    const serial2 = itemData.serialNo2 && itemData.serialNo2.trim();
    const name = itemData.itemName && itemData.itemName.trim();
    const computed = computeQRCodeValue(code, serial, name);
    const computed2 = computeQRCodeValue(code, serial2, name);

    if (computed || computed2) {
      setItemData((prev) => ({
        ...prev,
        QRCode: computed || prev.QRCode,
        QRCode2: computed2 || prev.QRCode2
      }));
      return;
    }

    if (!computed && !computed2 && force) {
      // fallback generation when itemCode missing: include name when possible
      const fallbackBase = name ? name.replace(/\s+/g, '_') : `AUTO`;
      const fallback = `${fallbackBase}_${Date.now()}`;
      setItemData((prev) => ({ ...prev, QRCode: fallback }));
    } else if (!computed && !computed2) {
      alert('Please provide Item Code, Serial No, Serial No 2, or Item Name. Use "Force generate" to create an automatic QR identifier.');
    }
  };

  const getQrImageUrl = (value, size = 200) => {
    if (!value) return null;
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`;
  };

  const handlePrintQr = () => {
    // Build payload: itemCode + serialNo + inventory name
    const code = itemData.itemCode && itemData.itemCode.trim();
    const serial = itemData.serialNo && itemData.serialNo.trim();
    const serial2 = itemData.serialNo2 && itemData.serialNo2.trim();
    const name = itemData.itemName && itemData.itemName.trim();
    const payload = (itemData.QRCode && itemData.QRCode.trim()) || computeQRCodeValue(code, serial, name);
    const payload2 = (itemData.QRCode2 && itemData.QRCode2.trim()) || computeQRCodeValue(code, serial2, name);

    if (!payload && !payload2) {
      alert('No data available to generate QR. Please provide at least one of Item Code, Serial No, Serial No 2, or Item Name.');
      return;
    }

    const labels = [];
    if (payload) {
      labels.push({
        payload,
        title: name || '',
        sub: `${code || ''}${serial ? ' | ' + serial : ''}`
      });
    }
    if (payload2) {
      labels.push({
        payload: payload2,
        title: name || '',
        sub: `${code || ''}${serial2 ? ' | ' + serial2 : ''}`
      });
    }

    const w = window.open('', '_blank');
    if (!w) {
      alert('Unable to open print window. Please allow popups.');
      return;
    }
    w.document.write(`<html><head><title>Print QR</title></head><body style="display:flex;align-items:center;justify-content:center;min-height:100vh">`);
    w.document.write(`<div style="display:flex;gap:24px;flex-wrap:wrap;align-items:center;justify-content:center;font-family:Arial,Helvetica,sans-serif">`);
    labels.forEach((label) => {
      const qrDataUrl = `${window.location.origin}/inventory/scan?q=${encodeURIComponent(label.payload)}&incharge=${encodeURIComponent(itemData.receivedfrom || '')}`;
      const url = getQrImageUrl(qrDataUrl, 300);
      w.document.write(`<div style="text-align:center">`);
      w.document.write(`<img src="${url}" alt="QR" style="width:300px;height:300px;"/>`);
      w.document.write(`<div style="margin-top:12px;font-weight:bold">${label.title}</div>`);
      w.document.write(`<div style="margin-top:6px">${label.sub}</div>`);
      w.document.write(`<div style="margin-top:8px;font-size:12px;color:#666">Scan or visit: ${qrDataUrl}</div>`);
      w.document.write(`</div>`);
    });
    w.document.write(`</div></body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 250);
  };

  const handleBulkFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setBulkFile(file);
      parseBulkFile(file);
    }
  };

  const parseBulkFile = (file) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const csv = event.target.result;
        const lines = csv.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        const items = [];
        for (let i = 1; i < lines.length; i++) {
          if (lines[i].trim() === '') continue;
          
          const values = lines[i].split(',').map(v => v.trim());
          const item = {};
          headers.forEach((header, index) => {
            item[header] = values[index] || '';
          });
          items.push(item);
        }
        
        // assign QR codes for parsed items where possible
        const itemsWithQr = items.map((it, idx) => {
          const code = it.itemcode || it.itemCode || '';
          const serial = it.serialno || it.serialNo || '';
          const serial2 = it.serialno2 || it.serialNo2 || '';
          const name = it.itemname || it.itemName || '';
          const computed = computeQRCodeValue(code, serial, name);
          const computed2 = computeQRCodeValue(code, serial2, name);
          const q = computed && computed !== '' ? computed : `AUTO_${Date.now()}_${idx}`;
          const qUrl = `${window.location.origin}/inventory/scan?q=${encodeURIComponent(q)}&incharge=${encodeURIComponent(it.receivedfrom||'')}`;
          const q2 = computed2 && computed2 !== '' ? computed2 : '';
          const q2Url = q2 ? `${window.location.origin}/inventory/scan?q=${encodeURIComponent(q2)}&incharge=${encodeURIComponent(it.receivedfrom||'')}` : '';
          return { ...it, qrcode: q, qrcodeUrl: qUrl, qrcode2: q2, qrcode2Url: q2Url };
        });

        setBulkItems(itemsWithQr);
        // reset selection
        setSelectedBulk({});
        setSelectAllBulk(false);
        alert(`Successfully parsed ${items.length} items from CSV file`);
      } catch (error) {
        alert('Error parsing CSV file. Please ensure it has the correct format.');
        console.error(error);
      }
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const headers = [
      'itemName', 'itemCode', 'serialNo', 'serialNo2', 'model', 
      'QRCode', 'QRCode2', "pageno", 'value', 'purchaseDate', 'ginNo', 'poNo', 
      'supplier', 'funding', 'fundingOther', 'receivedfrom', 'warranty', 'warrantyOther', 'location', 'remarks'
    ];
    
    const csvContent = [
      headers.join(','),
      'Core i7 Computer,ITDEOFQCE 01,SN123,SN456,HP,QR001,QR002,1,5000,2025-01-15,15550,PO001,VSIS,other,Alumni Grant,Stores,other,4 Years,Deans Office,Good condition'
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleBulkSubmit = () => {
    if (isInchargeMode && !selectedInventoryId) {
      alert('Select the inventory you want to add these items to.');
      return;
    }

    if (bulkItems.length === 0) {
      alert('No items to upload. Please select a CSV file.');
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/items/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bulkItems.map(it => {
            const {
              fundingOther,
              fundingother,
              warrantyOther,
              warrantyother,
              ...rest
            } = it;
            const fundingOtherValue = fundingOther || fundingother || "";
            const warrantyOtherValue = warrantyOther || warrantyother || "";
            const normalizedFunding = it.funding === "other"
              ? (fundingOtherValue || "")
              : (it.funding || "");
            const normalizedWarranty = it.warranty === "other"
              ? (warrantyOtherValue || "")
              : (it.warranty || "");

            return {
              ...rest,
              inventoryId: selectedInventoryId ? Number(selectedInventoryId) : null,
              funding: !normalizedFunding && fundingOtherValue ? fundingOtherValue : normalizedFunding,
              warranty: !normalizedWarranty && warrantyOtherValue ? warrantyOtherValue : normalizedWarranty,
              qrcode: it.qrcode,
              qrcodeUrl: it.qrcodeUrl,
              qrcode2: it.qrcode2,
              qrcode2Url: it.qrcode2Url
            };
          }))
        });
        const data = await res.json();
        if (res.ok) {
          alert(`Successfully submitted ${data.createdCount} items`);
          setBulkFile(null);
          setBulkItems([]);
        } else {
          alert('Bulk upload failed: ' + (data.error || 'unknown'));
        }
      } catch (err) {
        console.error(err);
        alert('Bulk upload failed (network). Ensure mock server is running at http://localhost:4000');
      }
    })();
  };

  const handleBulkPrint = () => {
    if (!bulkItems || bulkItems.length === 0) {
      alert('No parsed items to print.');
      return;
    }

    const w = window.open('', '_blank');
    if (!w) {
      alert('Unable to open print window. Please allow popups.');
      return;
    }

    // pick items based on selection if any
    const itemsToPrint = Object.keys(selectedBulk).length > 0
      ? bulkItems.filter((_, i) => selectedBulk[i])
      : bulkItems;

    const labelEntries = itemsToPrint.flatMap((it) => {
      const name = it.itemname || it.itemName || '';
      const code = it.itemcode || it.itemCode || '';
      const serial = it.serialno || it.serialNo || '';
      const serial2 = it.serialno2 || it.serialNo2 || '';
      const entries = [];
      const url = it.qrcodeUrl || `${window.location.origin}/inventory/scan?q=${encodeURIComponent(it.qrcode || '')}`;
      entries.push({ name, code, serial, url });
      if (it.qrcode2 || serial2) {
        const url2 = it.qrcode2Url || `${window.location.origin}/inventory/scan?q=${encodeURIComponent(it.qrcode2 || '')}`;
        entries.push({ name, code, serial: serial2, url: url2 });
      }
      return entries;
    });

    const cardHtml = labelEntries.map((entry) => {
      const qrImg = getQrImageUrl(entry.url, labelLayout === 'avery' ? 140 : 200);
      if (labelLayout === 'avery') {
        return `
          <div style="width:180px;height:110px;display:inline-block;margin:6px;padding:6px;border:0;box-sizing:border-box;text-align:center;font-family:Arial,Helvetica,sans-serif;vertical-align:top">
            <img src="${qrImg}" style="width:86px;height:86px;object-fit:contain;display:block;margin:0 auto" />
            <div style="margin-top:6px;font-weight:600;font-size:11px">${entry.name}</div>
            <div style="font-size:10px;color:#444">${entry.code}${entry.serial ? ' | ' + entry.serial : ''}</div>
          </div>
        `;
      }
      return `
        <div style="width:240px;height:320px;display:inline-block;margin:8px;padding:8px;border:1px solid #e5e7eb;box-sizing:border-box;text-align:center;font-family:Arial,Helvetica,sans-serif">
          <img src="${qrImg}" style="width:200px;height:200px;object-fit:contain" />
          <div style="margin-top:8px;font-weight:600">${entry.name}</div>
          <div style="font-size:12px;color:#444">${entry.code}${entry.serial ? ' | ' + entry.serial : ''}</div>
        </div>
      `;
    }).join('\n');

    w.document.write(`<!doctype html><html><head><title>QR Labels</title><style>body{padding:20px}</style></head><body>${cardHtml}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 300);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (isInchargeMode && !selectedInventoryId) {
      alert('Select the inventory you want to add this item to.');
      return;
    }

    (async () => {
      try {
        // prepare payload (omit File objects; include file names if present)
        const payload = { ...itemData };
        payload.inventoryId = selectedInventoryId ? Number(selectedInventoryId) : null;
        const normalizedFunding = payload.funding === "other"
          ? (payload.fundingOther || "")
          : (payload.funding || "");
        const normalizedWarranty = payload.warranty === "other"
          ? (payload.warrantyOther || "")
          : (payload.warranty || "");

        if (!normalizedFunding && payload.fundingOther) {
          payload.funding = payload.fundingOther;
        } else {
          payload.funding = normalizedFunding;
        }

        if (!normalizedWarranty && payload.warrantyOther) {
          payload.warranty = payload.warrantyOther;
        } else {
          payload.warranty = normalizedWarranty;
        }

        delete payload.fundingOther;
        delete payload.warrantyOther;
        if (payload.itemImage) payload.itemImage = payload.itemImage.name;
        if (payload.ginfile) payload.ginfile = payload.ginfile.name;

        const res = await fetch(`${API_BASE_URL}/api/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
          alert('Item added successfully (saved to mock server)');
          // clear
          handleReset();
        } else {
          alert('Save failed: ' + (data.error || 'unknown'));
        }
      } catch (err) {
        console.error(err);
        alert('Save failed (network). Ensure mock server is running at http://localhost:4000');
      }
    })();
  };

  const handleReset = () => {
    setItemData({
      itemName: "",
      itemCode: "",
      serialNo: "",
      serialNo2: "",
      model: "",
      QRCode: "",
      QRCode2: "",
      pageno: "",
      itemImage: null,
      value: "",
      purchaseDate: "",
      ginNo: "",
      ginfile: null,
      poNo: "",
      supplier: "",
      funding: "",
      fundingOther: "",
      receivedfrom: "",
      warranty: "",
      warrantyOther: "",
      location: "",
      remarks: ""
    });
  };

  return (
    <MainLayout variant={sidebarVariant}>
      <PageHeader
        title="Add New Inventory Item"
        subtitle="Register a new physical asset and generate QR labels from the same screen."
        actions={
          <div className="inline-flex rounded-xl border border-white/20 bg-white/10 p-1">
            <button
              type="button"
              onClick={() => {
                setUploadMode("single");
                setBulkFile(null);
                setBulkItems([]);
              }}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                uploadMode === "single"
                  ? "bg-white text-primary-800 shadow-sm"
                  : "text-white/85 hover:bg-white/10 hover:text-white"
              }`}
            >
              Single Item
            </button>
            <button
              type="button"
              onClick={() => setUploadMode("bulk")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                uploadMode === "bulk"
                  ? "bg-white text-primary-800 shadow-sm"
                  : "text-white/85 hover:bg-white/10 hover:text-white"
              }`}
            >
              Bulk Upload
            </button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {isInchargeMode && (
          <Card>
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-text-dark">Target Inventory</h2>
                <p className="text-sm text-text-light">
                  Choose which assigned inventory should receive these items. This keeps inventories separate for the same account.
                </p>
              </div>
              {inventoryLoadError && (
                <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {inventoryLoadError}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Assigned Inventory"
                  name="assignedInventory"
                  value={selectedInventoryId}
                  onChange={setSelectedInventoryId}
                  options={inventoryOptions}
                  placeholder="Select inventory"
                  required
                />
                <div className="rounded-md border border-border-light bg-background-light px-4 py-3 text-sm text-text-dark">
                  <p className="font-medium">Current Selection</p>
                  <p className="mt-1 text-text-light">
                    {selectedInventory ? `${selectedInventory.name} - ${selectedInventory.location || 'No location'}` : 'No inventory selected yet.'}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        )}

        <div className="flex flex-wrap items-center gap-2 text-sm text-text-light">
          <span>Home</span>
          <span>/</span>
          <span>Inventory</span>
          <span>/</span>
          <span className="font-semibold text-primary-800">Create Asset</span>
        </div>

        {/* Single Item Form */}
        {uploadMode === "single" && (
        <Card>
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* ==================== ITEM DETAILS SECTION ==================== */}
            <div className="space-y-4">
              <div className="pb-4 border-b-2 border-primary-500">
                <h2 className="text-xl font-bold text-text-dark">Item Details</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Item Name */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-dark">
                    Item Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    name="itemName"
                    value={itemData.itemName}
                    onChange={handleChange}
                    required
                    placeholder="Enter item name"
                    style={{ backgroundColor: '#F2F0F0' }}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* Item Code */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-dark">Item Code</label>
                  <input
                    type="text"
                    name="itemCode"
                    value={itemData.itemCode}
                    onChange={handleChange}
                    placeholder="Enter item code"
                    style={{ backgroundColor: '#F2F0F0' }}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* Serial Number */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-dark">Serial Number</label>
                  <input
                    type="text"
                    name="serialNo"
                    value={itemData.serialNo}
                    onChange={handleChange}
                    placeholder="Enter serial number"
                    style={{ backgroundColor: '#F2F0F0' }}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* Serial Number 2 */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-dark">Serial Number 2 (For Computer Items)</label>
                  <input
                    type="text"
                    name="serialNo2"
                    value={itemData.serialNo2}
                    onChange={handleChange}
                    placeholder="Enter serial number 2"
                    style={{ backgroundColor: '#F2F0F0' }}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* Brand/Model */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-dark">Brand/Model</label>
                  <input
                    type="text"
                    name="model"
                    value={itemData.model}
                    onChange={handleChange}
                    placeholder="Enter brand or model"
                    style={{ backgroundColor: '#F2F0F0' }}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* QR Code */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-dark">QR Code</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      name="QRCode"
                      value={itemData.QRCode}
                      onChange={handleChange}
                      placeholder="Enter QR code"
                      style={{ backgroundColor: '#F2F0F0' }}
                      className="flex-1 px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <button
                      type="button"
                      onClick={() => generateAndSetQRCode(false)}
                      className="px-3 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                    >
                      Auto-generate
                    </button>
                    <button
                      type="button"
                      onClick={() => generateAndSetQRCode(true)}
                      className="px-3 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                    >
                      Force generate
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintQr}
                      className="px-3 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
                    >
                      Print QR
                    </button>
                  </div>

                  {itemData.QRCode && (
                    <div className="mt-3 flex items-center gap-4">
                      <img src={getQrImageUrl(itemData.QRCode, 120)} alt="QR preview" />
                      <div className="text-sm">
                        <div className="font-semibold">{itemData.QRCode}</div>
                        <div className="text-text-light">Scan to view item</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Inventory Page Number */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-dark">Inventory Page No</label>
                  <input
                    type="number"
                    name="pageno"
                    value={itemData.pageno}
                    onChange={handleChange}
                    placeholder="Enter Inventory page number"
                    style={{ backgroundColor: '#F2F0F0' }}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* QR Code (Serial No 2) */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-dark">QR Code (Serial No 2)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      name="QRCode2"
                      value={itemData.QRCode2}
                      onChange={handleChange}
                      placeholder="Enter QR code for serial no 2"
                      style={{ backgroundColor: '#F2F0F0' }}
                      className="flex-1 px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <button
                      type="button"
                      onClick={() => generateAndSetQRCode(false)}
                      className="px-3 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                    >
                      Auto-generate
                    </button>
                    <button
                      type="button"
                      onClick={() => generateAndSetQRCode(true)}
                      className="px-3 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                    >
                      Force generate
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintQr}
                      className="px-3 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
                    >
                      Print QR
                    </button>
                  </div>

                  {itemData.QRCode2 && (
                    <div className="mt-3 flex items-center gap-4">
                      <img src={getQrImageUrl(itemData.QRCode2, 120)} alt="QR preview" />
                      <div className="text-sm">
                        <div className="font-semibold">{itemData.QRCode2}</div>
                        <div className="text-text-light">Scan to view item</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Item Image */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-dark">Item Image</label>
                  <input
                    type="file"
                    name="itemImage"
                    onChange={handleImageChange}
                    accept="image/*"
                    style={{ backgroundColor: '#F2F0F0' }}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  {itemData.itemImage && (
                    <p className="text-sm text-success mt-2">✓ {itemData.itemImage.name}</p>
                  )}
                </div>
              </div>
            </div>

            {/* ==================== PURCHASE DETAILS SECTION ==================== */}
            <div className="space-y-4">
              <div className="pb-4 border-b-2 border-primary-500">
                <h2 className="text-xl font-bold text-text-dark">Purchase Details</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Item Value */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-dark">Item Value (Rs.)</label>
                  <input
                    type="number"
                    name="value"
                    value={itemData.value}
                    onChange={handleChange}
                    placeholder="0.00"
                    style={{ backgroundColor: '#F2F0F0' }}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* Purchase Date */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-dark">Purchase Date</label>
                  <input
                    type="date"
                    name="purchaseDate"
                    value={itemData.purchaseDate}
                    onChange={handleChange}
                    style={{ backgroundColor: '#F2F0F0' }}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* Purchase Order No */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-dark">Purchase Order No</label>
                  <input
                    type="number"
                    name="poNo"
                    value={itemData.poNo}
                    onChange={handleChange}
                    placeholder="Enter PO number"
                    style={{ backgroundColor: '#F2F0F0' }}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* Supplier */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-dark">Supplier</label>
                  <input
                    type="text"
                    name="supplier"
                    value={itemData.supplier}
                    onChange={handleChange}
                    placeholder="Enter supplier name"
                    style={{ backgroundColor: '#F2F0F0' }}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* GIN No */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-dark">GIN No</label>
                  <input
                    type="number"
                    name="ginNo"
                    value={itemData.ginNo}
                    onChange={handleChange}
                    placeholder="Enter GIN number"
                    style={{ backgroundColor: '#F2F0F0' }}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* GIN PDF */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-dark">GIN PDF</label>
                  <input
                    type="file"
                    name="ginfile"
                    onChange={handleGinFileChange}
                    accept=".pdf"
                    style={{ backgroundColor: '#F2F0F0' }}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  {itemData.ginfile && (
                    <p className="text-sm text-success mt-2">✓ {itemData.ginfile.name}</p>
                  )}
                </div>

                {/* Funding Source */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-dark">Funding Source</label>
                  <select
                    name="funding"
                    value={itemData.funding}
                    onChange={handleChange}
                    style={{ backgroundColor: '#F2F0F0' }}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="capital">Capital Fund</option>
                    <option value="unidevfund">University Development Fund</option>
                    <option value="facdevfund">Faculty Development Fund</option>
                    <option value="deptdevfund">Department Development Fund</option>
                    <option value="other">Other (please specify)</option>
                  </select>
                  {itemData.funding === "other" && (
                    <input
                      type="text"
                      name="fundingOther"
                      value={itemData.fundingOther}
                      onChange={handleChange}
                      required
                      placeholder="Specify funding source"
                      style={{ backgroundColor: '#F2F0F0' }}
                      className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* ==================== LOGISTICS & LOCATION SECTION ==================== */}
            <div className="space-y-4">
              <div className="pb-4 border-b-2 border-primary-500">
                <h2 className="text-xl font-bold text-text-dark">Logistics & Location</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Location */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-dark">
                    Location <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    name="location"
                    value={itemData.location}
                    onChange={handleChange}
                    required
                    placeholder="Enter location"
                    style={{ backgroundColor: '#F2F0F0' }}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* Received/Transferred From */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-dark">Received/Transferred From</label>
                  <input
                    type="text"
                    name="receivedfrom"
                    value={itemData.receivedfrom}
                    onChange={handleChange}
                    placeholder="Enter source"
                    style={{ backgroundColor: '#F2F0F0' }}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* Warranty Period */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-dark">Warranty Period</label>
                  <select
                    name="warranty"
                    value={itemData.warranty}
                    onChange={handleChange}
                    style={{ backgroundColor: '#F2F0F0' }}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="1year">1 Year</option>
                    <option value="2years">2 Years</option>
                    <option value="3years">3 Years</option>
                    <option value="5years">5 Years</option>
                    <option value="other">Other (please specify)</option>
                  </select>
                  {itemData.warranty === "other" && (
                    <input
                      type="text"
                      name="warrantyOther"
                      value={itemData.warrantyOther}
                      onChange={handleChange}
                      required
                      placeholder="Specify warranty period"
                      style={{ backgroundColor: '#F2F0F0' }}
                      className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* ==================== ADDITIONAL REMARKS SECTION ==================== */}
            <div className="space-y-4">
              <div className="pb-4 border-b-2 border-primary-500">
                <h2 className="text-xl font-bold text-text-dark">Additional Remarks</h2>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-text-dark">Remarks</label>
                <textarea
                  name="remarks"
                  value={itemData.remarks}
                  onChange={handleChange}
                  placeholder="Enter any additional remarks"
                  rows="4"
                  style={{ backgroundColor: '#F2F0F0' }}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end pt-6 border-t border-border">
              <Button
                type="button"
                onClick={handleReset}
                variant="secondary"
              >
                Reset
              </Button>
              <Button
                type="button"
                onClick={() => window.history.back()}
                variant="tertiary"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                icon="save"
              >
                Save Item
              </Button>
            </div>
          </form>
        </Card>
        )}

        {/* Bulk Upload Form */}
        {uploadMode === "bulk" && (
        <Card>
          <div className="space-y-6">
            {/* Section Header */}
            <div className="pb-4 border-b-2 border-primary-500">
              <h2 className="text-xl font-bold text-text-dark">Bulk Item Upload</h2>
              <p className="text-text-light text-sm mt-2">Upload multiple items at once using a CSV file</p>
            </div>

            {/* Download Template */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-text-dark mb-3">
                <strong>Need a template?</strong> Download the CSV template to get started with the correct format.
              </p>
              <button
                type="button"
                onClick={downloadTemplate}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-semibold"
              >
                Download CSV Template
              </button>
            </div>

            {/* File Upload Section */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-text-dark">
                  Select CSV File <span className="text-danger">*</span>
                </label>
                <input
                  type="file"
                  onChange={handleBulkFileChange}
                  accept=".csv"
                  style={{ backgroundColor: '#F2F0F0' }}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {bulkFile && (
                  <p className="text-sm text-success mt-2">✓ {bulkFile.name}</p>
                )}
              </div>
            </div>

            {/* Bulk controls: layout + select all */}
            {bulkItems.length > 0 && (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-semibold">Label Layout:</label>
                  <select value={labelLayout} onChange={e => setLabelLayout(e.target.value)} className="px-3 py-2 border rounded-lg bg-white">
                    <option value="grid">Grid (large)</option>
                    <option value="avery">Avery (small labels)</option>
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm">Select All</label>
                  <input type="checkbox" checked={selectAllBulk} onChange={(e) => {
                    const checked = e.target.checked;
                    setSelectAllBulk(checked);
                    if (checked) {
                      const obj = {};
                      bulkItems.forEach((it, i) => { obj[i] = true; });
                      setSelectedBulk(obj);
                    } else {
                      setSelectedBulk({});
                    }
                  }} />
                </div>
              </div>
            )}

            {/* Preview Section */}
            {bulkItems.length > 0 && (
              <div className="space-y-3">
                <div className="bg-success-50 border border-success-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-success">
                    ✓ Ready to upload: {bulkItems.length} items
                  </p>
                </div>

                {/* Items Preview Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                              <tr className="bg-gray-100 border-b">
                                <th className="px-3 py-2 text-left font-semibold"><input type="checkbox" checked={selectAllBulk} onChange={(e)=>{
                                  const checked = e.target.checked;
                                  setSelectAllBulk(checked);
                                  if (checked) {
                                    const obj = {};
                                    bulkItems.forEach((it, i) => { obj[i] = true; });
                                    setSelectedBulk(obj);
                                  } else {
                                    setSelectedBulk({});
                                  }
                                }} /></th>
                              <th className="px-3 py-2 text-left font-semibold">Item Name</th>
                              <th className="px-3 py-2 text-left font-semibold">Item Code</th>
                              <th className="px-3 py-2 text-left font-semibold">Serial No</th>
                              <th className="px-3 py-2 text-left font-semibold">Value</th>
                              <th className="px-3 py-2 text-left font-semibold">Location</th>
                            </tr>
                    </thead>
                    <tbody>
                      {bulkItems.slice(0, 5).map((item, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <input type="checkbox" checked={!!selectedBulk[index]} onChange={(e) => {
                              const obj = { ...selectedBulk };
                              if (e.target.checked) obj[index] = true; else delete obj[index];
                              setSelectedBulk(obj);
                              // keep selectAll in sync
                              setSelectAllBulk(Object.keys(obj).length === bulkItems.length);
                            }} />
                          </td>
                          <td className="px-3 py-2">{item.itemname || item.itemName || '-'}</td>
                          <td className="px-3 py-2">{item.itemcode || item.itemCode || '-'}</td>
                          <td className="px-3 py-2">{item.serialno || item.serialNo || '-'}</td>
                          <td className="px-3 py-2">{item.value || '-'}</td>
                          <td className="px-3 py-2">{item.location || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {bulkItems.length > 5 && (
                    <p className="text-xs text-text-light mt-2">... and {bulkItems.length - 5} more items</p>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end pt-6 border-t border-border">
              <Button
                type="button"
                onClick={() => {
                  setBulkFile(null);
                  setBulkItems([]);
                }}
                variant="secondary"
              >
                Clear
              </Button>
              <Button
                type="button"
                onClick={() => setUploadMode("single")}
                variant="tertiary"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleBulkPrint}
                variant="secondary"
                disabled={bulkItems.length === 0}
              >
                Print QR Labels
              </Button>
              <Button
                type="button"
                onClick={handleBulkSubmit}
                variant="primary"
                disabled={bulkItems.length === 0}
              >
                Upload {bulkItems.length} Items
              </Button>
            </div>
          </div>
        </Card>
        )}
      </div>
    </MainLayout>
  );
};

export default AddNewItem;
