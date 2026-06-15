import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const REPORT_HEADER = "Inventory Management System - Faculty of Information Technology";

export const parseExportDate = (value) => {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized === "—") {
    return null;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const filterWorkflowReportRows = (
  rows = [],
  {
    dateField = "date",
    dateFrom = "",
    dateTo = "",
    searchTerm = "",
    searchFields = [],
  } = {}
) => {
  const query = String(searchTerm || "").trim().toLowerCase();
  const fromDate = dateFrom ? new Date(dateFrom) : null;
  const toDate = dateTo ? new Date(`${dateTo}T23:59:59`) : null;

  return rows.filter((row) => {
    if (query) {
      const haystack = searchFields
        .map((field) => String(row[field] ?? "").toLowerCase())
        .join(" ");
      if (!haystack.includes(query)) {
        return false;
      }
    }

    if (fromDate || toDate) {
      const rowDate = parseExportDate(row[dateField]);
      if (!rowDate) {
        return false;
      }
      if (fromDate && rowDate < fromDate) {
        return false;
      }
      if (toDate && rowDate > toDate) {
        return false;
      }
    }

    return true;
  });
};

const escapeCsvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

export const exportWorkflowReportCsv = ({
  rows = [],
  columns = [],
  fileNamePrefix = "report",
}) => {
  const headers = columns.map((column) => column.label);
  const csvRows = [
    headers,
    ...rows.map((row) => columns.map((column) => row[column.field] ?? "")),
  ]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\n");

  const blob = new Blob([csvRows], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `${fileNamePrefix}-${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportWorkflowReportPdf = ({
  rows = [],
  columns = [],
  reportTitle = "Report",
  fileNamePrefix = "report",
}) => {
  const doc = new jsPDF({ format: "a4", unit: "mm", orientation: "landscape" });
  const generatedAt = new Date().toLocaleString();
  const headers = columns.map((column) => column.label);
  const body = rows.map((row) => columns.map((column) => row[column.field] ?? ""));

  autoTable(doc, {
    head: [headers],
    body,
    startY: 34,
    styles: { fontSize: 10 },
    headStyles: { fillColor: [17, 76, 126], fontSize: 10 },
    didDrawPage: () => {
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(11);
      doc.text(REPORT_HEADER, 14, 14);
      doc.text(reportTitle, 14, 22);
      doc.setFontSize(9);
      doc.text(`Generated: ${generatedAt}`, 14, pageHeight - 10);
    },
    margin: { top: 30, bottom: 16 },
  });

  doc.save(`${fileNamePrefix}-${new Date().toISOString().split("T")[0]}.pdf`);
};
