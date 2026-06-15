import React from "react";
import "./DisposalSubmissionForm.css";
import { formatDisplayDate, formatHodApprovalLabel, mergeTransferItems } from "../Transfers/TransferSubmissionForm";

const collectDistinctValues = (values = []) =>
  [...new Set(
    values
      .map((value) => String(value ?? "").trim())
      .filter((value) => value && value !== "—")
  )];

const formatItemValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return "\u00A0";
  }

  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) {
    return numericValue.toLocaleString("en-LK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return String(value);
};

const formatStoreIssueOrder = (item = {}) => {
  const ginNo = String(item.ginNo || item.issueNo || "").trim();
  const issueDate = item.purchaseDate || item.purchase_date || "";
  const formattedDate = issueDate ? formatDisplayDate(issueDate) : "";

  if (ginNo && formattedDate && formattedDate !== "—") {
    return `${ginNo} / ${formattedDate}`;
  }

  return ginNo || (formattedDate !== "—" ? formattedDate : "") || "\u00A0";
};

const formatDepartmentLabel = (inventory = {}) => {
  const department = String(inventory.department || "").trim();
  const location = String(inventory.location || "").trim();
  const name = String(inventory.name || "").trim();

  if (department && location) {
    return `${department} – ${location}`;
  }

  return department || location || name || "\u00A0";
};

const resolveItemFundingSource = (item = {}) =>
  String(item.funding || item.funding_source || item.fundingOther || "").trim();

const resolveAcquisitionTicks = (item = {}) => {
  const funding = resolveItemFundingSource(item).toLowerCase();

  if (funding.includes("donation")) {
    return { donation: "✓", purchase: "\u00A0" };
  }

  if (funding) {
    return { donation: "\u00A0", purchase: "✓" };
  }

  return { donation: "\u00A0", purchase: "✓" };
};

const buildDisposalTableRows = (items = []) => {
  const mergedItems = mergeTransferItems(items);
  const rows = mergedItems.map((item, index) => {
    const itemCodes = collectDistinctValues(item.itemCodes || [item.itemCode]);
    const serialNos = collectDistinctValues(item.serialNos || [item.serialNo]);
    const totalValue = Number(item.totalValue ?? item.value ?? 0);
    const acquisition = resolveAcquisitionTicks(item);

    return {
      no: index + 1,
      description: item.itemName || "\u00A0",
      quantity: item.quantity ?? 1,
      storeIssueOrder: formatStoreIssueOrder(item),
      value: totalValue > 0 ? formatItemValue(totalValue) : "\u00A0",
      serialNo: serialNos.join(", ") || "\u00A0",
      modelNo: String(item.model || "").trim() || "\u00A0",
      itemCode: itemCodes.join(", ") || "\u00A0",
      folioNo: String(item.pageno || item.pageNo || "").trim() || "\u00A0",
      donation: acquisition.donation,
      purchase: acquisition.purchase,
    };
  });

  while (rows.length < 4) {
    rows.push({
      no: "",
      description: "\u00A0",
      quantity: "\u00A0",
      storeIssueOrder: "\u00A0",
      value: "\u00A0",
      serialNo: "\u00A0",
      modelNo: "\u00A0",
      itemCode: "\u00A0",
      folioNo: "\u00A0",
      donation: "\u00A0",
      purchase: "\u00A0",
    });
  }

  return rows;
};

const DisposalSignatureRow = ({ label, value, dateValue }) => (
  <div className="disposal-form-signature-row">
    <div className="disposal-form-signature-field">
      <span className="disposal-form-signature-label">{label}</span>
      <span className="disposal-form-signature-line">{value || "\u00A0"}</span>
    </div>
    <div className="disposal-form-signature-date">
      <span className="disposal-form-date-label">Date :</span>
      <span className="disposal-form-date-line">{dateValue || "\u00A0"}</span>
    </div>
  </div>
);

const DisposalSubmissionForm = ({
  inventory = null,
  items = [],
  disposalDate = "",
  verificationBoardChairman = "",
  verificationBoardChairmanDate = "",
  officerInCharge = "",
  officerInChargeDate = "",
  headOfDivisionDepartment = "",
  headOfDivisionDepartmentDate = "",
  hodApprovedDate = "",
  className = "",
}) => {
  const tableRows = buildDisposalTableRows(items);
  const departmentLabel = formatDepartmentLabel(inventory);
  const resolvedInchargeName = String(officerInCharge || inventory?.incharge || "").trim();
  const resolvedHeadLabel = String(headOfDivisionDepartment || "").trim()
    || formatHodApprovalLabel(inventory?.department || "");
  const resolvedInchargeDate = officerInChargeDate || disposalDate || "";
  const resolvedHeadDate = headOfDivisionDepartmentDate || hodApprovedDate || "";
  const showInchargeSignature = Boolean(resolvedInchargeName);
  const showHeadSignature = Boolean(
    resolvedHeadDate
    || String(inventory?.department || "").trim()
    || String(headOfDivisionDepartment || "").trim()
  );

  return (
    <div className={`disposal-form-print-area ${className}`.trim()}>
      <div className="disposal-form-document">
        <div className="disposal-form-title">
          Unserviceable and Condemned Capital Items Form
        </div>

        <div className="disposal-form-section">
          Senior Assistant Registrar/ General Administration
        </div>

        <div className="disposal-form-section">
          Details of unserviceable and Condemned Capital Items in the{" "}
          <span className="disposal-form-line">{departmentLabel}</span>
          {" "}are as follows:
        </div>

        <table className="disposal-form-table">
          <thead>
            <tr>
              <th rowSpan={2}>No</th>
              <th rowSpan={2}>
                Description of Item
                <br />
                (* Only for Condemned Computers:
                <br />
                Please mention the available parts)
              </th>
              <th rowSpan={2}>Qty</th>
              <th rowSpan={2}>
                Store issue
                <br />
                Order No. &amp; Date
              </th>
              <th rowSpan={2}>
                Value of the item according
                <br />
                to store issue order
              </th>
              <th colSpan={2}>Details of the item</th>
              <th rowSpan={2}>
                Item Code /
                <br />
                Equipment Code
              </th>
              <th rowSpan={2}>
                Inventory Register
                <br />
                Folio No.
              </th>
              <th colSpan={2}>Nature of Acquisition (✓)</th>
            </tr>
            <tr>
              <th>Serial No.</th>
              <th>Model No.</th>
              <th className="disposal-form-vertical">Donation</th>
              <th className="disposal-form-vertical">Purchase</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, index) => (
              <tr key={`disposal-row-${index}`} className="disposal-form-row-space">
                <td>{row.no || "\u00A0"}</td>
                <td>{row.description}</td>
                <td>{row.quantity}</td>
                <td>{row.storeIssueOrder}</td>
                <td>{row.value}</td>
                <td>{row.serialNo}</td>
                <td>{row.modelNo}</td>
                <td>{row.itemCode}</td>
                <td>{row.folioNo}</td>
                <td className="disposal-form-acquisition-mark">{row.donation}</td>
                <td className="disposal-form-acquisition-mark">{row.purchase}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p>I certify that the above particulars are accurate.</p>

        <div className="disposal-form-signatures">
          <DisposalSignatureRow
            label="Signature of the Chairman of the Verification Board :"
            value={verificationBoardChairman ? <b>{verificationBoardChairman}</b> : ""}
            dateValue={
              verificationBoardChairmanDate
                ? formatDisplayDate(verificationBoardChairmanDate)
                : ""
            }
          />

          <DisposalSignatureRow
            label="Signature of the Officer in Charge of the Inventory :"
            value={showInchargeSignature ? <b>{resolvedInchargeName}</b> : ""}
            dateValue={resolvedInchargeDate ? formatDisplayDate(resolvedInchargeDate) : ""}
          />

          <DisposalSignatureRow
            label="Signature of the Head of the Division/Department :"
            value={showHeadSignature ? <b>{resolvedHeadLabel}</b> : ""}
            dateValue={resolvedHeadDate ? formatDisplayDate(resolvedHeadDate) : ""}
          />
        </div>
      </div>
    </div>
  );
};

export default DisposalSubmissionForm;
