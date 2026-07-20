import React from "react";
import "./TransferSubmissionForm.css";

const formatDisplayDate = (value = "") => {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const formatInventoryParty = (inventory = {}) => {
  const officerName = String(inventory.incharge || "").trim();
  const labName = String(inventory.location || "").trim();
  const department = String(inventory.department || "").trim();
  return [officerName, labName, department].filter(Boolean).join(", ") || "—";
};

const normalizeMergeValue = (value = "") => {
  const normalized = String(value ?? "").trim();
  return normalized && normalized !== "—" ? normalized.toLowerCase() : "";
};

const getItemMergeKey = (item = {}) =>
  [
    normalizeMergeValue(item.itemName),
    normalizeMergeValue(item.brand),
    normalizeMergeValue(item.model),
    normalizeMergeValue(item.value),
    normalizeMergeValue(item.ginNo || item.issueNo),
    normalizeMergeValue(item.pageno || item.pageNo),
  ].join("|");

const collectDistinctValues = (values = []) =>
  [...new Set(
    values
      .map((value) => String(value ?? "").trim())
      .filter((value) => value && value !== "—")
  )];

const mergeTransferItems = (items = []) => {
  const grouped = new Map();

  items.forEach((item) => {
    const key = getItemMergeKey(item);

    if (!grouped.has(key)) {
      grouped.set(key, {
        ...item,
        quantity: 1,
        itemCodes: collectDistinctValues([item.itemCode]),
        serialNos: collectDistinctValues([item.serialNo]),
        totalValue: Number(item.value) || 0,
      });
      return;
    }

    const existing = grouped.get(key);
    existing.quantity += 1;
    existing.itemCodes = collectDistinctValues([...existing.itemCodes, item.itemCode]);
    existing.serialNos = collectDistinctValues([...existing.serialNos, item.serialNo]);
    existing.totalValue += Number(item.value) || 0;
  });

  return [...grouped.values()];
};

const formatBrandModelSerial = (item = {}) => {
  const brandModel = [item.brand, item.model]
    .map((value) => String(value || "").trim())
    .filter((value) => value && value !== "—")
    .join(" / ");

  const serialNos = collectDistinctValues(item.serialNos || [item.serialNo]);

  if (brandModel && serialNos.length > 0) {
    return { brandModel, serialNos, combined: `${brandModel} / ${serialNos.join(", ")}` };
  }

  if (brandModel) {
    return { brandModel, serialNos: [], combined: brandModel };
  }

  if (serialNos.length > 0) {
    return { brandModel: "", serialNos, combined: serialNos.join(", ") };
  }

  return { brandModel: "", serialNos: [], combined: "—" };
};

const formatItemValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return "—";
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

const buildTableRows = (items = [], handedOverDate = "") => {
  const mergedItems = mergeTransferItems(items);
  const rows = mergedItems.map((item) => {
    const brandModelSerial = formatBrandModelSerial(item);
    const itemCodes = collectDistinctValues(item.itemCodes || [item.itemCode]);
    const totalValue = Number(item.totalValue ?? item.value ?? 0);

    return {
      handedOverDate: formatDisplayDate(handedOverDate),
      itemName: item.itemName || "—",
      itemCodes,
      brandModel: brandModelSerial.brandModel,
      serialNos: brandModelSerial.serialNos,
      quantity: item.quantity ?? 1,
      value: totalValue > 0 ? formatItemValue(totalValue) : "—",
      issueNo: item.ginNo || item.issueNo || "—",
      inventoryPageNo: item.pageno || item.pageNo || "—",
    };
  });

  while (rows.length < 4) {
    rows.push({
      handedOverDate: "",
      itemName: "",
      itemCodes: [],
      brandModel: "",
      serialNos: [],
      quantity: "",
      value: "",
      issueNo: "",
      inventoryPageNo: "",
    });
  }

  return rows;
};

const formatHodApprovalLabel = (departmentName = "") => {
  const department = String(departmentName || "").trim();
  return department ? `Head / Department of ${department}` : "Head / Department of ………………";
};

const TransferSubmissionForm = ({
  sourceInventory = null,
  destinationInventory = null,
  transferDate = "",
  items = [],
  issuedByName = "",
  issuedByPost = "",
  hodApprovedBy = "",
  hodDepartmentName = "",
  hodApprovedDate = "",
  registrarApprovedBy = "",
  registrarApprovedDate = "",
  showPartB = false,
  receivedDate = "",
  receivedByName = "",
  receiverPost = "",
  receivedInventoryPageNo = "",
  partBItems = [],
  className = "",
}) => {
  const toParty = formatInventoryParty(destinationInventory);
  const fromParty = formatInventoryParty(sourceInventory);
  const tableRows = buildTableRows(items, transferDate);
  const partBSourceItems = Array.isArray(partBItems) && partBItems.length > 0 ? partBItems : items;
  const partBRows = buildTableRows(partBSourceItems, receivedDate).map((row) => ({
    ...row,
    handedOverDate: formatDisplayDate(receivedDate),
    inventoryPageNo: String(row.inventoryPageNo || receivedInventoryPageNo || "").trim(),
  }));
  const hodApprovalLabel = formatHodApprovalLabel(hodDepartmentName || sourceInventory?.department || "");

  return (
    <div className={`transfer-form-print-area ${className}`.trim()}>
      <div className="transfer-form-document transfer-form-page">
        <div className="transfer-form-title">
          Transferring Inventory Items – University of Moratuwa
        </div>

        <div className="transfer-form-section-title">
          Part (A) (Should be filled by the Handing–over Dept./ Division)
        </div>

        <div className="transfer-form-row">
          <div className="transfer-form-field">
            To : <b><span className="transfer-form-line">{toParty}</span></b>
          </div>
          <div className="transfer-form-field">
            Through : <b><span className="transfer-form-line">Registrar</span></b>
          </div>
        </div>

        <div className="transfer-form-row">
          <div className="transfer-form-field">
            From : <b><span className="transfer-form-line">{fromParty}</span></b>
          </div>
          <div className="transfer-form-field">
            Date : <b><span className="transfer-form-line">{formatDisplayDate(transferDate)}</span></b>
          </div>
        </div>

        <p>I have handed over the following item/s to your Division.</p>

        <table className="transfer-form-table">
          <thead>
            <tr>
              <th>Handed over Date</th>
              <th>Item Name</th>
              <th>Item Code</th>
              <th>Brand / Model / Serial No.</th>
              <th>Qty</th>
              <th>Value</th>
              <th>Issue No.</th>
              <th>Inventory Page No.</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, index) => (
              <tr key={`part-a-row-${index}`}>
                <td>{row.handedOverDate || "\u00A0"}</td>
                <td>{row.itemName}</td>
                <td>
                  {row.itemCodes.length > 0
                    ? row.itemCodes.map((code, codeIndex) => (
                        <React.Fragment key={`${index}-code-${codeIndex}`}>
                          {codeIndex > 0 ? <br /> : null}
                          {code}
                        </React.Fragment>
                      ))
                    : null}
                </td>
                <td>
                  {row.brandModel ? (
                    <>
                      {row.brandModel}
                      {row.serialNos.length > 0 ? (
                        <>
                          <br />
                          {row.serialNos.map((serial, serialIndex) => (
                            <React.Fragment key={`${index}-serial-${serialIndex}`}>
                              {serialIndex > 0 ? <br /> : null}
                              {serial}
                            </React.Fragment>
                          ))}
                        </>
                      ) : null}
                    </>
                  ) : (
                    row.serialNos.map((serial, serialIndex) => (
                      <React.Fragment key={`${index}-serial-${serialIndex}`}>
                        {serialIndex > 0 ? <br /> : null}
                        {serial}
                      </React.Fragment>
                    ))
                  )}
                </td>
                <td>{row.quantity}</td>
                <td>{row.value}</td>
                <td>{row.issueNo}</td>
                <td>{row.inventoryPageNo}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p>Please acknowledge the receipt of the same by filling PART B of this form</p><br></br>

        <div className="transfer-form-signature-section">
          Issued by (Name of In‑Charge of Inventory Register) :{" "}
          <span className="transfer-form-signature-line"><b>{issuedByName || "—"}</b></span>
          &nbsp;&nbsp; Post :{" "}
          <span className="transfer-form-line"><b>{issuedByPost || "—"}</b></span>
        </div><br></br>

        <div className="transfer-form-signature-section">
          Certified by :{" "}
          <span className="transfer-form-signature-line">
            <b>{hodApprovedDate ? hodApprovalLabel : "\u00A0"}</b>
          </span>
          &nbsp;&nbsp; Date :{" "}
          <span className="transfer-form-line">
          <b> {hodApprovedDate ? formatDisplayDate(hodApprovedDate) : "\u00A0"}</b>
          </span>
        </div>
        <div className="transfer-form-signature-section">
          <b>Head of the Dept./ Division (Rubber Stamp)</b>
        </div> <br></br>

        <div className="transfer-form-signature-section">
          Approval of the Registrar :{" "}
          <span className="transfer-form-signature-line"><b>
            {registrarApprovedBy || "\u00A0"}</b>
          </span>
          &nbsp;&nbsp; <b>Date :{" "}</b>
          <span className="transfer-form-line">
            {registrarApprovedDate ? formatDisplayDate(registrarApprovedDate) : "\u00A0"}
          </span>
        </div>

        {!showPartB ? (
          <p className="transfer-form-part-b-note mt-4 text-sm text-text-light italic">
            Part B will be completed later by the receiving inventory officer.
          </p>
        ) : null}
      </div>

      {showPartB ? (
        <div className="transfer-form-document transfer-form-page">
          <div className="transfer-form-title">
            Transferring Inventory Items – University of Moratuwa
          </div>

          <div className="transfer-form-section-title">
            Part (B) (Should be filled by the Taking–over Dept./ Division)
          </div>

          <div className="transfer-form-row">
            <div className="transfer-form-field">
              To : <b><span className="transfer-form-line">{fromParty}</span></b>
            </div>
            <div className="transfer-form-field">
              Through : <b><span className="transfer-form-line">Registrar</span></b>
            </div>
          </div>

          <div className="transfer-form-row">
            <div className="transfer-form-field">
              From : <b><span className="transfer-form-line">{toParty}</span></b>
            </div>
            <div className="transfer-form-field">
              Date : <b><span className="transfer-form-line">{formatDisplayDate(receivedDate)}</span></b>
            </div>
          </div>

          <p>
            I have received the following item/s and have entered in our Inventory as follows.
          </p>

          <table className="transfer-form-table">
            <thead>
              <tr>
                <th>Received Date</th>
                <th>Item Name</th>
                <th>Item Code</th>
                <th>Brand / Model / Serial No.</th>
                <th>Qty</th>
                <th>Value</th>
                <th>Issue No.</th>
                <th>Inventory Page No.</th>
              </tr>
            </thead>
            <tbody>
              {partBRows.map((row, index) => (
                <tr key={`part-b-row-${index}`}>
                  <td>{row.handedOverDate || "\u00A0"}</td>
                  <td>{row.itemName || "\u00A0"}</td>
                  <td>
                    {row.itemCodes.length > 0
                      ? row.itemCodes.map((code, codeIndex) => (
                          <React.Fragment key={`part-b-${index}-code-${codeIndex}`}>
                            {codeIndex > 0 ? <br /> : null}
                            {code}
                          </React.Fragment>
                        ))
                      : "\u00A0"}
                  </td>
                  <td>
                    {row.brandModel ? (
                      <>
                        {row.brandModel}
                        {row.serialNos.length > 0 ? (
                          <>
                            <br />
                            {row.serialNos.map((serial, serialIndex) => (
                              <React.Fragment key={`part-b-${index}-serial-${serialIndex}`}>
                                {serialIndex > 0 ? <br /> : null}
                                {serial}
                              </React.Fragment>
                            ))}
                          </>
                        ) : null}
                      </>
                    ) : (
                      row.serialNos.map((serial, serialIndex) => (
                        <React.Fragment key={`part-b-${index}-serial-${serialIndex}`}>
                          {serialIndex > 0 ? <br /> : null}
                          {serial}
                        </React.Fragment>
                      ))
                    )}
                  </td>
                  <td>{row.quantity || "\u00A0"}</td>
                  <td>{row.value || "\u00A0"}</td>
                  <td>{row.issueNo || "\u00A0"}</td>
                  <td>{row.inventoryPageNo || "\u00A0"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="transfer-form-signature-section">
            Received by (Name of In‑Charge of Inventory Register) :{" "}
            <span className="transfer-form-signature-line"><b>{receivedByName || "\u00A0"}</b></span>
            &nbsp;&nbsp; Post :{" "}
            <span className="transfer-form-line"><b>{receiverPost || "Inventory Officer"}</b></span>
          </div>

           <div className="transfer-form-signature-section">
          Approval of the Registrar :{" "}
          <span className="transfer-form-signature-line"><b>
            {registrarApprovedBy || "\u00A0"}</b>
          </span>
          &nbsp;&nbsp; <b>Date :{" "}</b>
          <span className="transfer-form-line">
            {registrarApprovedDate ? formatDisplayDate(registrarApprovedDate) : "\u00A0"}
          </span>
        </div>

          <div className="transfer-form-footer">
            CC : Registrar
            <br />
            Bursar – For recording purposes
          </div>
        </div>
      ) : null}
    </div>
  );
};

export {
  formatDisplayDate,
  formatInventoryParty,
  formatBrandModelSerial,
  formatHodApprovalLabel,
  mergeTransferItems,
};

export default TransferSubmissionForm;
