import React, { useState } from "react";
import "../../Styles/AddNewItem.css";
import Header from "../../Components/Header";
import Footer from "../../Components/Footer";
import InchargeSidebar from "../../Components/Incharge/InchargeSidebar";

const AddNewItem = () => {
  const [itemData, setItemData] = useState({
    itemName: "",
    itemCode: "",
    serialNo: "",
    serialNo2: "",
    model: "",
    qrCode: "",
    qrCode2: "",
    value: "",
    purchaseDate: "",
    location: "",
    remarks: "",
    funding: "",
    fundingOther: "",
    warranty: "",
    warrantyOther: ""
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
                                    name="serialNo"
                                    value={itemData.serialNo}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="form-row">
                                <label>Serial Number 2 (For Computer Items)</label>
                                <input
                                    type="text"
                                    name="serialNo2"
                                    value={itemData.serialNo2}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="form-row">
                                <label>Brand/ Model</label>
                                <input
                                    type="text"
                                    name="model"
                                    value={itemData.model}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="form-row">
                                <label>QR Code</label>
                                <input
                                    type="text"
                                    name="qrCode"
                                    value={itemData.qrCode}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="form-row">
                                <label>QR Code 2 (For Serial No 2)</label>
                                <input
                                    type="text"
                                    name="qrCode2"
                                    value={itemData.qrCode2}
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
                                <select
                                    name="funding"
                                    value={itemData.funding}
                                    onChange={handleChange}
                                >
                                    <option value="">Select Funding Source</option>
                                    <option value="University Grant">University Grant</option>
                                    <option value="Research Grant">Research Grant</option>
                                    <option value="Donation">Donation</option>
                                    <option value="Government Fund">Government Fund</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            {itemData.funding === "Other" && (
                                <div className="form-row">
                                    <label>Specify Funding Source</label>
                                    <input
                                        type="text"
                                        name="fundingOther"
                                        value={itemData.fundingOther}
                                        onChange={handleChange}
                                        placeholder="Enter funding source"
                                    />
                                </div>
                            )}
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
                                <select
                                    name="warranty"
                                    value={itemData.warranty}
                                    onChange={handleChange}
                                >
                                    <option value="">Select Warranty Period</option>
                                    <option value="No Warranty">No Warranty</option>
                                    <option value="6 Months">6 Months</option>
                                    <option value="1 Year">1 Year</option>
                                    <option value="2 Years">2 Years</option>
                                    <option value="3 Years">3 Years</option>
                                    <option value="5 Years">5 Years</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            {itemData.warranty === "Other" && (
                                <div className="form-row">
                                    <label>Specify Warranty Period</label>
                                    <input
                                        type="text"
                                        name="warrantyOther"
                                        value={itemData.warrantyOther}
                                        onChange={handleChange}
                                        placeholder="Enter warranty period"
                                    />
                                </div>
                            )}
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
            <Footer/>
        </div>
    </div>
  );
};

export default AddNewItem;
