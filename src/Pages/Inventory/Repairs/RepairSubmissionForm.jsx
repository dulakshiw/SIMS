import React from "react";
import "./RepairSubmissionForm.css";
import { formatDisplayDate, mergeTransferItems } from "../Transfers/TransferSubmissionForm";

const collectDistinctValues = (values = []) =>
  [...new Set(
    values
      .map((value) => String(value ?? "").trim())
      .filter((value) => value && value !== "—")
  )];

const formatDepartmentHeader = (inventory = {}) => {
  const department = String(inventory.department || "").trim();
  const location = String(inventory.location || "").trim();
  const name = String(inventory.name || "").trim();

  if (department && (location || name)) {
    return `Department/Division of ${department} / ${location || name}`;
  }

  if (department) {
    return `Department/Division of ${department}`;
  }

  return location || name || "Department/Division";
};

const formatFieldValue = (value) => {
  const normalized = String(value ?? "").trim();
  return normalized || "\u00A0";
};

const buildRepairTableRows = (items = [], faultDescription = "") => {
  const mergedItems = mergeTransferItems(items);

  const rows = mergedItems.map((item) => ({
    equipmentName: item.itemName || "\u00A0",
    inventoryCode: collectDistinctValues(item.itemCodes || [item.itemCode]).join(", ") || "\u00A0",
    modelNumber: String(item.model || "").trim() || "\u00A0",
    serialNo: collectDistinctValues(item.serialNos || [item.serialNo]).join(", ") || "\u00A0",
    natureOfDamage: faultDescription || "\u00A0",
    underWarranty: "No",
    agent: String(item.supplier || "").trim() || "\u00A0",
    warranty: String(item.warranty || "").trim() || "\u00A0",
    purchaseDate: formatDisplayDate(item.purchaseDate),
    ginNo: String(item.ginNo || "").trim() || "\u00A0",
    poNo: String(item.poNo || "").trim() || "\u00A0",
  }));

  if (rows.length === 0) {
    rows.push({
      equipmentName: "\u00A0",
      inventoryCode: "\u00A0",
      modelNumber: "\u00A0",
      serialNo: "\u00A0",
      natureOfDamage: "\u00A0",
      underWarranty: "\u00A0",
      agent: "\u00A0",
      warranty: "\u00A0",
      purchaseDate: "\u00A0",
      ginNo: "\u00A0",
      poNo: "\u00A0",
    });
  }

  return rows;
};

const RepairSubmissionForm = ({
  inventory = {},
  items = [],
  repairDate = "",
  faultDescription = "",
  officerName = "",
  officerPost = "Inventory Officer",
  officerMobileNo = "",
  officerExtensionNo = "",
  contactPersonName = "",
  contactPersonExtension = "",
  contactPersonLocation = "",
}) => {
  const tableRows = buildRepairTableRows(items, faultDescription);
  const resolvedOfficerName = String(officerName || inventory.incharge || "").trim();
  const officeLabName = String(contactPersonLocation || "").trim();
  const displayRepairDate = repairDate || new Date().toISOString().split("T")[0];
  const contactPersonLabel = [contactPersonName, contactPersonExtension ? `(Ext: ${contactPersonExtension})` : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="repair-form-print-area">
      <div className="repair-form-document">
        <div className="repair-form-header">
          <div>{formatDepartmentHeader(inventory)}</div>
          <div className="repair-form-header-date">
            Date: <span className="repair-form-line">{formatDisplayDate(displayRepairDate)}</span>
          </div>
        </div>

        <p className="repair-form-section">To: Deputy Registrar / General Administration Division</p>

        <h2 className="repair-form-title">Equipment Repair Requisition Form</h2>

        <table className="repair-form-table">
          <thead>
            <tr>
              <th>Equipment Name *</th>
              <th>Capital Inventory Code *</th>
              <th>Model Number</th>
              <th>Serial No *</th>
              <th>Nature of Damage</th>
              <th>Under Warranty (Yes/No)</th>
              <th>Warranty Period</th>
              <th>Purchase Date</th>
              <th>GIN No</th>
              <th>PO No</th>
              <th>Agent</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, index) => (
              <tr key={`repair-row-${index}`}>
                <td>{row.equipmentName}</td>
                <td>{row.inventoryCode}</td>
                <td>{row.modelNumber}</td>
                <td>{row.serialNo}</td>
                <td>{row.natureOfDamage}</td>
                <td>{row.underWarranty}</td>
                <td>{row.warranty}</td>
                <td>{row.purchaseDate}</td>
                <td>{row.ginNo}</td>
                <td>{row.poNo}</td>
                <td>{row.agent}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="repair-form-note">
          <p><strong>** Please note:</strong> Providing inventory code is essential for equipment repairs.</p>
          <p><strong>* Please note:</strong> Equipment under warranty should be forwarded to the Supplier Division.</p>
        </div>

        <table className="repair-form-table repair-form-contact-table">
          <tbody>
          <tr>
              <td>Contact Person</td>
              <td>{formatFieldValue(contactPersonLabel || contactPersonName)}</td>
            </tr>
            <tr>
              <td>Office/Lab Name</td>
              <td>{officeLabName || <span className="repair-form-field-line">{"\u00A0"}</span>}</td>
            </tr>
            </tbody>
        </table>

        <h3 className="repair-form-subheading">Contact Details of Officer-in-Charge of Inventory</h3>

        <table className="repair-form-table repair-form-contact-table">
          <tbody>
            <tr>
              <td>Inventory In-Charge</td>
              <td>{resolvedOfficerName ? <strong>{resolvedOfficerName}</strong> : <span className="repair-form-field-line">{"\u00A0"}</span>}</td>
            </tr>
            <tr>
              <td>Contact Telephone No</td>
              <td>{formatFieldValue(officerMobileNo)}</td>
            </tr>
            <tr>
              <td>Extension No</td>
              <td>{formatFieldValue(officerExtensionNo)}</td>
            </tr>
            <tr>
              <td>Signature</td>
              <td><div className="repair-form-signature-line"></div></td>
            </tr>
          </tbody>
        </table>

        <table className="repair-form-table repair-form-contact-table">
          <tbody>
            <tr>
              <td>Head of Department</td>
              <td><div className="repair-form-signature-line"></div></td>
            </tr>
          </tbody>
        </table>

        <div className="repair-form-footer-signature">
          <p>Subject Clerk, <br></br>
          Please take over the item listed above (Other than furniture items) from the Department ang get the repair done and return the items/s to the Department as early as possible.</p>
          <div className="repair-form-signature-line">Deputy Registrar / General Administrations Division</div>
        </div>
      </div>
    </div>
  );
};

export default RepairSubmissionForm;
