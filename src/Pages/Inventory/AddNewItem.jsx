import React, { useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import MainLayout from "../../Components/Layouts/MainLayout";
import { Card, Button } from "../../Components/UI";
import { resolveSidebarVariant } from "../../utils/helpers";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const AddNewItem = () => {
  const location = useLocation();
  const { role } = useParams();
  const sidebarVariant = resolveSidebarVariant(location.pathname, role);
  const [uploadMode, setUploadMode] = useState("single"); // "single" or "bulk"
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkItems, setBulkItems] = useState([]);
  const [selectedBulk, setSelectedBulk] = useState({});
  const [selectAllBulk, setSelectAllBulk] = useState(false);
  const [labelLayout, setLabelLayout] = useState('grid'); // 'grid' or 'avery'
  
  const [itemData, setItemData] = useState({
    itemName: "",
    itemCode: "",
    serialNo: "",
    serialNo2: "",
    model: "",
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
    remarks: "",
    funding: "",
    fundingOther: "",
    warranty: "",
    warrantyOther: ""
  });

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
        alert('Bulk upload failed. Ensure the API server is running and your database connection is configured.');
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
    (async () => {
      try {
        // prepare payload (omit File objects; include file names if present)
        const payload = { ...itemData };
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
          alert('Item added successfully');
          // clear
          handleReset();
        } else {
          alert('Save failed: ' + (data.error || 'unknown'));
        }
      } catch (err) {
        console.error(err);
        alert('Save failed. Ensure the API server is running and your database connection is configured.');
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
    <div>
        <Header />
        <div className="dashboard-layout">
            <InchargeSidebar />       
       
            <div className="add-item-container">
                <div className="add-item-card">
                    <h1>Add New Inventory Item</h1>

                    <form onSubmit={handleSubmit} className="Item-form">
                        <div className="form-grid">
                    
                            <div className="form-row">
                                <label>Item Name<span className="required">*</span></label>
                                <input
                                    type="text"
                                    name="itemName"
                                    value={itemData.itemName}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="form-row">
                                <label>Item Code</label>
                                <input
                                    type="text"
                                    name="itemCode"
                                    value={itemData.itemCode}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="form-row">
                                <label>Serial Number</label>
                                <input
                                    type="text"
                                    name="SerialNo"
                                    value={itemData.serialNo}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="form-row">
                                <label>Serial Number 2 (For Computer Items)</label>
                                <input
                                    type="text"
                                    name="SerialNo2"
                                    value={itemData.serialNo2}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="form-row">
                                <label>Brand/ Model</label>
                                <input
                                    type="text"
                                    name="Model"
                                    value={itemData.model}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="form-row">
                                <label>QR Code</label>
                                <input
                                    type="text"
                                    name="QRCode"
                                    value={itemData.QRCode}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="form-row">
                                <label>Item Value (Rs.)</label>
                                <input
                                    type="number"
                                    name="value"
                                    value={itemData.value}
                                    onChange={handleChange}
                                    />
                            </div>
                            <div className="form-row">
                                <label>Purchased Date</label>
                                <input
                                    type="date"
                                    name="purchaseDate"
                                    value={itemData.purchaseDate}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="form-row">
                                <label>GIN No</label>
                                <input
                                    type="number"
                                    name="ginNo"
                                    value={itemData.ginNo}
                                    onChange={handleChange}
                                    />
                            </div>
                            <div className="form-row">
                                <label>GIN PDF</label>
                                <input
                                    type="text"
                                    name="ginfile"
                                    value={itemData.ginfile}
                                    onChange={handleChange}
                                    />
                            </div>                        
                            <div className="form-row">
                                <label>Purchase Order No</label>
                                <input
                                    type="number"
                                    name="poNo"
                                    value={itemData.poNo}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="form-row">
                                <label>Supplier</label>
                                <input
                                    type="text"
                                    name="supplier"
                                    value={itemData.supplier}
                                    onChange={handleChange}
                                    />
                            </div>
                             <div className="form-row">
                                <label>Funding Source</label>
                                <input
                                    type="text"
                                    name="funding"
                                    value={itemData.funding}
                                    onChange={handleChange}
                                    />
                            </div>
                             <div className="form-row">
                                <label>Recieved/ Transferred From</label>
                                <input
                                    type="text"
                                    name="receivedfrom"
                                    value={itemData.receivedfrom}
                                    onChange={handleChange}
                                    />
                            </div>
                            <div className="form-row">
                                <label>Warranty Period</label>
                                <input
                                    type="text"
                                    name="warranty"
                                    value={itemData.warranty}
                                    onChange={handleChange}
                                    />
                            </div>
                            <div className="form-row">
                                <label>Location<span className="required">*</span></label>
                                <input
                                    type="text"
                                    name="location"
                                    value={itemData.location}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="form-row">
                                <label>Remarks</label>
                                    <textarea
                                    name="remarks"
                                    value={itemData.remarks}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="form-row">
                                <label></label>
                                <div className="button-row">
                                    <button type="submit" className="btn submit-btn"> Save Item </button>
                                    <button type="reset" className="btn reset-btn"> Reset</button>
                                    <button type="button" className="btn cancel-btn"> Cancel</button>
                                </div> 
                            </div>
                            <div className="form-row">
                                
                            </div>
                        </div>                         
                    </form>
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
