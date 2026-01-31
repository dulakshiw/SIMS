import React, { useState } from "react";
import MainLayout from "../../Components/Layouts/MainLayout";
import { Card, Button } from "../../Components/UI";

const AddNewItem = () => {
  const [uploadMode, setUploadMode] = useState("single"); // "single" or "bulk"
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkItems, setBulkItems] = useState([]);
  
  const [itemData, setItemData] = useState({
    itemName: "",
    itemCode: "",
    serialNo: "",
    serialNo2: "",
    model: "",
    QRCode: "",
    itemImage: null,
    value: "",
    purchaseDate: "",
    ginNo: "",
    ginfile: null,
    poNo: "",
    supplier: "",
    funding: "",
    receivedfrom: "",
    warranty: "",
    location: "",
    remarks: ""
  });

  const handleChange = (e) => {
    setItemData({
      ...itemData,
      [e.target.name]: e.target.value
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
    const name = itemData.itemName && itemData.itemName.trim();
    const computed = computeQRCodeValue(code, serial, name);

    if (computed) {
      setItemData({ ...itemData, QRCode: computed });
      return;
    }

    if (!computed && force) {
      // fallback generation when itemCode missing: include name when possible
      const fallbackBase = name ? name.replace(/\s+/g, '_') : `AUTO`;
      const fallback = `${fallbackBase}_${Date.now()}`;
      setItemData({ ...itemData, QRCode: fallback });
    } else if (!computed) {
      alert('Item Code and/or Serial are missing. Use "Force generate" to create an automatic QR identifier including the item name.');
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
    const name = itemData.itemName && itemData.itemName.trim();
    const payload = computeQRCodeValue(code, serial, name);

    if (!payload) {
      alert('No data available to generate QR. Please provide at least one of Item Code, Serial No, or Item Name.');
      return;
    }

    const qrDataUrl = `${window.location.origin}/inventory/scan?q=${encodeURIComponent(payload)}&incharge=${encodeURIComponent(itemData.receivedfrom || '')}`;
    const url = getQrImageUrl(qrDataUrl, 300);
    const w = window.open('', '_blank');
    if (!w) {
      alert('Unable to open print window. Please allow popups.');
      return;
    }
    w.document.write(`<html><head><title>Print QR</title></head><body style="display:flex;align-items:center;justify-content:center;height:100vh">`);
    w.document.write(`<div style="text-align:center;font-family:Arial,Helvetica,sans-serif">`);
    w.document.write(`<img src="${url}" alt="QR" style="width:300px;height:300px;"/>`);
    w.document.write(`<div style="margin-top:12px;font-weight:bold">${name || ''}</div>`);
    w.document.write(`<div style="margin-top:6px">${code || ''} ${serial ? ' | ' + serial : ''}</div>`);
    w.document.write(`<div style="margin-top:8px;font-size:12px;color:#666">Scan or visit: ${qrDataUrl}</div>`);
    w.document.write(`</div>`);
    w.document.write(`</body></html>`);
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
          const name = it.itemname || it.itemName || '';
          const computed = computeQRCodeValue(code, serial, name);
          const q = computed && computed !== '' ? computed : `AUTO_${Date.now()}_${idx}`;
          const qUrl = `${window.location.origin}/inventory/scan?q=${encodeURIComponent(q)}&incharge=${encodeURIComponent(it.receivedfrom||'')}`;
          return { ...it, qrcode: q, qrcodeUrl: qUrl };
        });

        setBulkItems(itemsWithQr);
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
      'QRCode', 'value', 'purchaseDate', 'ginNo', 'poNo', 
      'supplier', 'funding', 'receivedfrom', 'warranty', 'location', 'remarks'
    ];
    
    const csvContent = [
      headers.join(','),
      'Sample Item,CODE001,SN123,SN456,ModelX,QR001,5000,2025-01-15,GIN001,PO001,Supplier A,Internal Fund,Department A,1 Year,Building A,Good condition'
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
        const res = await fetch('http://localhost:4000/api/items/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bulkItems.map(it => ({ ...it, qrcode: it.qrcode, qrcodeUrl: it.qrcodeUrl })))
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

  const handleSubmit = (e) => {
    e.preventDefault();
    (async () => {
      try {
        // prepare payload (omit File objects; include file names if present)
        const payload = { ...itemData };
        if (payload.itemImage) payload.itemImage = payload.itemImage.name;
        if (payload.ginfile) payload.ginfile = payload.ginfile.name;

        const res = await fetch('http://localhost:4000/api/items', {
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
      itemImage: null,
      value: "",
      purchaseDate: "",
      ginNo: "",
      ginfile: null,
      poNo: "",
      supplier: "",
      funding: "",
      receivedfrom: "",
      warranty: "",
      location: "",
      remarks: ""
    });
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-text-dark">Add New Inventory Item</h1>
          <p className="text-text-light mt-2">Create and register inventory items individually or in bulk</p>
        </div>

        {/* Mode Selection */}
        <Card>
          <div className="flex gap-4">
            <button
              onClick={() => {
                setUploadMode("single");
                setBulkFile(null);
                setBulkItems([]);
              }}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                uploadMode === "single"
                  ? "bg-primary-500 text-white shadow-lg"
                  : "bg-gray-200 text-text-dark hover:bg-gray-300"
              }`}
            >
              Single Item
            </button>
            <button
              onClick={() => setUploadMode("bulk")}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                uploadMode === "bulk"
                  ? "bg-primary-500 text-white shadow-lg"
                  : "bg-gray-200 text-text-dark hover:bg-gray-300"
              }`}
            >
              Bulk Upload
            </button>
          </div>
        </Card>

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
                    placeholder="Enter second serial number"
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
                  <input
                    type="text"
                    name="funding"
                    value={itemData.funding}
                    onChange={handleChange}
                    placeholder="Enter funding source"
                    style={{ backgroundColor: '#F2F0F0' }}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
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
                  <input
                    type="text"
                    name="warranty"
                    value={itemData.warranty}
                    onChange={handleChange}
                    placeholder="Enter warranty period"
                    style={{ backgroundColor: '#F2F0F0' }}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
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
