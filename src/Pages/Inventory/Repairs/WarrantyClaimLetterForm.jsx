import React from "react";
import "./RepairSubmissionForm.css";
import { formatDisplayDate, mergeTransferItems } from "../Transfers/TransferSubmissionForm";

const formatFieldValue = (value) => {
  const normalized = String(value ?? "").trim();
  return normalized || "\u00A0";
};

const DEFAULT_FACULTY_NAME = "Faculty of Information Technology";

const formatHeadSignatureLabel = (inventory = {}) => {
  const department = String(inventory.department || "").trim();
  const faculty = String(inventory.faculty || DEFAULT_FACULTY_NAME).trim() || DEFAULT_FACULTY_NAME;

  if (department) {
    return `Head/ Department of ${department}`;
  }

  return `Head/ ${faculty}`;
};

const formatDepartmentFacultyLabel = (inventory = {}) => {
  const department = String(inventory.department || "").trim();
  const faculty = String(inventory.faculty || DEFAULT_FACULTY_NAME).trim() || DEFAULT_FACULTY_NAME;

  if (department) {
    return `Department of ${department}`;
  }

  return faculty;
};

const collectDistinctValues = (values = []) =>
  [...new Set(
    values
      .map((value) => String(value ?? "").trim())
      .filter((value) => value && value !== "—")
  )];

const hasDisplayValue = (value) => {
  const normalized = String(value ?? "").trim();
  return Boolean(normalized && normalized !== "—" && normalized !== "\u00A0");
};

const buildDefaultSubject = (items = [], inventory = {}) => {
  const itemNames = collectDistinctValues(items.map((item) => item.itemName));
  const itemNamePart = itemNames.join(", ") || "Equipment";
  const departmentPart = formatDepartmentFacultyLabel(inventory);
  return `Repair of Warranty Equipment - ${itemNamePart} - ${departmentPart}`;
};

const buildEquipmentDetailRows = (item = {}) => {
  const serialValue = collectDistinctValues(item.serialNos || [item.serialNo]).join(", ");
  const purchaseDateValue = formatDisplayDate(item.purchaseDate);

  const rows = [
    { label: "Item Name", value: item.itemName },
    { label: "Brand", value: item.brand },
    { label: "Model", value: item.model },
    { label: "Warranty", value: item.warranty },
    { label: "Serial No", value: serialValue },
    { label: "Company Name", value: item.supplier },
    { label: "Purchase Order No", value: item.poNo },
    { label: "GRN No", value: item.ginNo },
    { label: "Purchase Date", value: purchaseDateValue },
  ];

  return rows.filter((row) => hasDisplayValue(row.value));
};

const WarrantyEquipmentDetails = ({ item = {}, index = 0, showHeading = true }) => {
  const detailRows = buildEquipmentDetailRows(item);

  return (
    <div key={item.id || index}>
      {showHeading ? <h3 className="repair-form-subheading">The Equipment Details</h3> : null}
      {detailRows.length > 0 ? (
        <table className="repair-form-table repair-form-warranty-details">
          <tbody>
            {detailRows.map((row) => (
              <tr key={`${item.id || index}-${row.label}`}>
                <td>{row.label}</td>
                <td>{formatFieldValue(row.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
};

const WarrantyClaimLetterForm = ({
  inventory = {},
  items = [],
  claimDate = "",
  faultDescription = "",
  subject = "",
}) => {
  const mergedItems = mergeTransferItems(items);
  const resolvedSubject = String(subject || "").trim() || buildDefaultSubject(mergedItems, inventory);
  const displayClaimDate = claimDate || new Date().toISOString().split("T")[0];

  return (
    <div className="repair-form-print-area">
      <div className="repair-form-document">
        <div className="repair-form-warranty-top">
          <p><strong>To:</strong> Deputy Bursar / Supplies Division</p>
          <p><strong>From:</strong> {formatHeadSignatureLabel(inventory)}</p>
          <p>
            <strong>Date:</strong>{" "}
            <span className="repair-form-line">{formatDisplayDate(displayClaimDate)}</span>
          </p>
        </div>

        <p className="repair-form-section">
          <strong>Subject:</strong>{" "}
          <span className="repair-form-line">{resolvedSubject}</span>
        </p>

        <p className="repair-form-warranty-body">
          I would like to inform you that the below-mentioned equipment is currently having 
          {faultDescription ? (
            <>
              {" "}
               <strong>{faultDescription}</strong>.
            </>
          ) : null}
          {" "}
          and is under warranty period. Please take the necessary action to repair the equipment.
        </p>

        {mergedItems.length > 0 ? (
          mergedItems.map((item, index) => (
            <WarrantyEquipmentDetails
              key={item.id || index}
              item={item}
              index={index}
              showHeading={index === 0 || mergedItems.length > 1}
            />
          ))
        ) : (
          <WarrantyEquipmentDetails item={{}} showHeading />
        )}

        <p style={{ marginTop: "1.75rem" }}>Thank You.</p>
      </div>
    </div>
  );
};

export default WarrantyClaimLetterForm;
