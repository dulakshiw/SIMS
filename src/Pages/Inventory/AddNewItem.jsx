import React, { useState } from "react";
import MainLayout from "../../Components/Layouts/MainLayout";
import { Card, Button } from "../../Components/UI";

const AddNewItem = () => {
  const [itemData, setItemData] = useState({
    itemName: "",
    itemCode: "",
    serialNo: "",
    serialNo2: "",
    model: "",
    QRCode: "",
    value: "",
    purchaseDate: "",
    ginNo: "",
    ginfile: "",
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

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("New Item Data:", itemData);
    alert("Item added successfully (frontend demo)");
  };

  const handleReset = () => {
    setItemData({
      itemName: "",
      itemCode: "",
      serialNo: "",
      serialNo2: "",
      model: "",
      QRCode: "",
      value: "",
      purchaseDate: "",
      ginNo: "",
      ginfile: "",
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
          <p className="text-text-light mt-2">Create and register a new inventory item</p>
        </div>

        {/* Form Card */}
        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Form Grid */}
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
                <input
                  type="text"
                  name="QRCode"
                  value={itemData.QRCode}
                  onChange={handleChange}
                  placeholder="Enter QR code"
                  style={{ backgroundColor: '#F2F0F0' }}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

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
                  type="text"
                  name="ginfile"
                  value={itemData.ginfile}
                  onChange={handleChange}
                  placeholder="GIN file path"
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

              {/* Remarks - Full width */}
              <div className="col-span-1 md:col-span-2 space-y-2">
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
      </div>
    </MainLayout>
  );
};

export default AddNewItem;
