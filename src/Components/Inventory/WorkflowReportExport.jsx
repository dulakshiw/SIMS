import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, FormInput, SearchBox } from "../UI";
import {
  exportWorkflowReportCsv,
  exportWorkflowReportPdf,
  filterWorkflowReportRows,
} from "../../utils/workflowReportExport";

const WorkflowReportExport = ({
  rows = [],
  columns = [],
  reportTitle = "Report",
  fileNamePrefix = "report",
  dateField = "date",
  searchFields = [],
  searchPlaceholder = "Search by item name, ID, inventory, or status...",
  disabled = false,
  showDateFilters = true,
}) => {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target)) {
        setIsExportDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredRows = useMemo(
    () => filterWorkflowReportRows(rows, {
      dateField,
      dateFrom,
      dateTo,
      searchTerm,
      searchFields,
    }),
    [rows, dateField, dateFrom, dateTo, searchTerm, searchFields]
  );

  const exportOptions = {
    rows: filteredRows,
    columns,
    reportTitle,
    fileNamePrefix,
  };

  const handleExportCsv = () => {
    if (filteredRows.length === 0) {
      return;
    }
    exportWorkflowReportCsv(exportOptions);
    setIsExportDropdownOpen(false);
  };

  const handleExportPdf = () => {
    if (filteredRows.length === 0) {
      return;
    }
    exportWorkflowReportPdf(exportOptions);
    setIsExportDropdownOpen(false);
  };

  const handleClearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setSearchTerm("");
  };

  const hasFilters = Boolean(dateFrom || dateTo || searchTerm.trim());

  return (
    <div className="mb-4 space-y-4 border-b border-border-lighter pb-4">
      <div className={`grid grid-cols-1 ${showDateFilters ? "md:grid-cols-3" : ""} gap-4`}>
        {showDateFilters ? (
          <>
            <FormInput
              label="From Date"
              name="exportDateFrom"
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              disabled={disabled}
            />
            <FormInput
              label="To Date"
              name="exportDateTo"
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              disabled={disabled}
            />
          </>
        ) : null}
        <div className={`flex flex-col gap-2 ${showDateFilters ? "" : "md:col-span-1"}`}>
          <label className="text-sm font-medium text-text-dark">Search</label>
          <SearchBox
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={setSearchTerm}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-text-light">
            {filteredRows.length} record{filteredRows.length === 1 ? "" : "s"} ready to export
          </p>
          {hasFilters ? (
            <Button type="button" variant="secondary" onClick={handleClearFilters} disabled={disabled}>
              Clear Filters
            </Button>
          ) : null}
        </div>

        <div className="relative" ref={exportDropdownRef}>
          <Button
            type="button"
            variant="primary"
            className="min-w-[180px]"
            onClick={() => setIsExportDropdownOpen((prev) => !prev)}
            disabled={disabled || filteredRows.length === 0}
            icon="download"
          >
            Export Report
          </Button>

          {isExportDropdownOpen ? (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-border-light rounded-md shadow-lg z-50 overflow-hidden">
              <button
                type="button"
                className="w-full text-left px-4 py-2 text-sm text-text-dark hover:bg-background-light transition-colors"
                onClick={handleExportCsv}
              >
                Export as CSV
              </button>
              <button
                type="button"
                className="w-full text-left px-4 py-2 text-sm text-text-dark hover:bg-background-light transition-colors"
                onClick={handleExportPdf}
              >
                Export as PDF
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default WorkflowReportExport;
