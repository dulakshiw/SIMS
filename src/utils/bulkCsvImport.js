import { parse } from "csv-parse/browser/esm/sync";

const BULK_CSV_FIELD_ALIASES = {
  itemname: "itemName",
  itemcode: "itemCode",
  serialno: "serialNo",
  serialno2: "serialNo2",
  model: "model",
  pageno: "pageno",
  page: "pageno",
  value: "value",
  purchasedate: "purchaseDate",
  ginno: "ginNo",
  pono: "poNo",
  supplier: "supplier",
  funding: "funding",
  fundingother: "fundingOther",
  receivedfrom: "receivedFrom",
  warranty: "warranty",
  warrantyother: "warrantyOther",
  location: "location",
  remarks: "remarks",
  qrcode: "QRCode",
  qrcode2: "QRCode2",
};

const normalizeHeaderKey = (header = "") =>
  String(header)
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export const canonicalizeBulkCsvHeader = (header = "") => {
  const normalized = normalizeHeaderKey(header);
  return BULK_CSV_FIELD_ALIASES[normalized] || null;
};

export const looksLikeIsoDate = (value = "") =>
  /^\d{4}-\d{2}-\d{2}/.test(String(value).trim());

export const normalizeBulkCsvRow = (row = {}) => {
  const normalized = {};

  Object.entries(row).forEach(([header, value]) => {
    const canonicalKey = canonicalizeBulkCsvHeader(header);
    const targetKey = canonicalKey || String(header).replace(/^\uFEFF/, "").trim();
    const nextValue = value == null ? "" : String(value).trim();

    if (
      normalized[targetKey] === undefined
      || normalized[targetKey] === null
      || String(normalized[targetKey]).trim() === ""
    ) {
      normalized[targetKey] = nextValue;
    }
  });

  return normalized;
};

export const detectBulkCsvColumnShift = (row = {}) => {
  const ginNo = String(row.ginNo || "").trim();
  const purchaseDate = String(row.purchaseDate || "").trim();
  const value = String(row.value || "").trim();

  if (!looksLikeIsoDate(ginNo)) {
    return false;
  }

  if (looksLikeIsoDate(purchaseDate)) {
    return false;
  }

  if (value && !/^\d+(\.\d+)?$/.test(value)) {
    return false;
  }

  return true;
};

const detectDelimiter = (text = "") => {
  const firstLine = String(text).split(/\r?\n/).find((line) => line.trim()) || "";
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;

  if (semicolonCount > commaCount) {
    return ";";
  }

  return ",";
};

export const parseBulkCsvText = (csvText = "") => {
  const trimmed = String(csvText || "").replace(/^\uFEFF/, "").trim();

  if (!trimmed) {
    return { rows: [], warnings: ["The CSV file is empty."] };
  }

  let records = [];
  try {
    records = parse(trimmed, {
      columns: (headers) =>
        headers.map((header) => {
          const canonical = canonicalizeBulkCsvHeader(header);
          return canonical || String(header).replace(/^\uFEFF/, "").trim();
        }),
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      delimiter: detectDelimiter(trimmed),
    });
  } catch (error) {
    return {
      rows: [],
      warnings: [`Failed to parse CSV: ${error.message}`],
    };
  }

  const warnings = [];
  const rows = records
    .map((record) => normalizeBulkCsvRow(record))
    .filter((row) => Object.values(row).some((value) => String(value || "").trim() !== ""));

  rows.forEach((row, index) => {
    if (detectBulkCsvColumnShift(row)) {
      warnings.push(
        `Row ${index + 1}: GIN No looks like a purchase date. Check that the "pageno" column is present and columns match the downloaded template.`
      );
    }
  });

  const requiredHeaders = ["itemName", "itemCode", "serialNo"];
  const presentHeaders = new Set(Object.keys(rows[0] || {}));
  const missingRequired = requiredHeaders.filter((field) => !presentHeaders.has(field));

  if (rows.length > 0 && missingRequired.length > 0) {
    warnings.push(
      `Missing required column(s): ${missingRequired.join(", ")}. Download a fresh CSV template and avoid renaming or removing columns.`
    );
  }

  return { rows, warnings };
};

export const BULK_CSV_TEMPLATE_HEADERS = [
  "itemName",
  "itemCode",
  "serialNo",
  "serialNo2",
  "model",
  "pageno",
  "value",
  "purchaseDate",
  "ginNo",
  "poNo",
  "supplier",
  "funding",
  "fundingOther",
  "receivedfrom",
  "warranty",
  "warrantyOther",
  "location",
  "remarks",
];

export const BULK_CSV_TEMPLATE_SAMPLE_ROW = [
  "Core i7 Computer",
  "ITDEOFQCE 01",
  "SN123",
  "SN456",
  "HP",
  "1",
  "5000",
  "2025-01-15",
  "15550",
  "PO001",
  "VSIS",
  "Capital Fund",
  "",
  "Stores",
  "2 Years",
  "",
  "Deans Office",
  "Good condition",
];

const escapeCsvCell = (value) => {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

export const buildBulkCsvTemplate = () =>
  [
    BULK_CSV_TEMPLATE_HEADERS.join(","),
    BULK_CSV_TEMPLATE_SAMPLE_ROW.map(escapeCsvCell).join(","),
  ].join("\n");
