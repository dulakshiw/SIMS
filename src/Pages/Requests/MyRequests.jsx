import React, { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import MainLayout from "../../Components/Layouts/MainLayout";
import { Card, SearchBox, Table, Badge, EntityDetailsModal, Button, PageHeader } from "../../Components/UI";
import { resolveSidebarVariant } from "../../utils/helpers";

const MyRequests = () => {
  const location = useLocation();
  const { role } = useParams();
  const sidebarVariant = resolveSidebarVariant(location.pathname, role);
  const [searchTerm, setSearchTerm] = useState("");
  const [isRequestDetailsModalOpen, setIsRequestDetailsModalOpen] = useState(false);
  const [selectedRequestDetails, setSelectedRequestDetails] = useState(null);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target)) {
        setIsExportDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Mock data for current user's requests
  const myRequests = [
    {
      id: "REQ-1001",
      item: "Projector",
      inventory: "PROJ-2024-001",
      priority: "urgent",
      status: "pending",
      date: "2026-01-20",
      quantity: 1,
      reason: "Classroom presentation equipment",
      headRecommendedDate: "2026-01-22",
      headApprovedDate: null,
      issuedDate: null,
      rejectedReason: null,
    },
    {
      id: "REQ-1002",
      item: "Whiteboard",
      inventory: "WB-2024-005",
      priority: "normal",
      status: "approved",
      date: "2026-01-18",
      quantity: 2,
      reason: "Classroom setup",
      headRecommendedDate: "2026-01-19",
      headApprovedDate: "2026-01-21",
      issuedDate: null,
      rejectedReason: null,
    },
    {
      id: "REQ-1003",
      item: "HDMI Cables",
      inventory: "HDMI-2024-015",
      priority: "low",
      status: "completed",
      date: "2026-01-10",
      quantity: 5,
      reason: "Lab equipment connectivity",
      headRecommendedDate: "2026-01-11",
      headApprovedDate: "2026-01-12",
      issuedDate: "2026-01-15",
      rejectedReason: null,
    },
  ];

  const columns = [
    { field: "id", label: "Request ID", sortable: true },
    { field: "item", label: "Item Requested", sortable: true },
    { field: "inventory", label: "Inventory ID", sortable: true },
    { field: "quantity", label: "Quantity", sortable: true },
    { field: "date", label: "Requested Date", sortable: true },
    {
      field: "headApprovedDate",
      label: "Approved Date",
      sortable: true,
      render: (value) => value || "-",
    },
    {
      field: "priority",
      label: "Priority",
      render: (value) => (
        <Badge
          label={value.charAt(0).toUpperCase() + value.slice(1)}
          variant={value}
          size="sm"
        />
      ),
    },
    {
      field: "status",
      label: "Status",
      render: (value) => (
        <Badge
          label={value.charAt(0).toUpperCase() + value.slice(1)}
          variant={value === "approved" ? "success" : value === "pending" ? "warning" : "info"}
          size="sm"
        />
      ),
    },
  ];

  const handleViewRequestDetails = (request) => {
    setSelectedRequestDetails(request);
    setIsRequestDetailsModalOpen(true);
  };

  const filtered = myRequests.filter((r) =>
    `${r.id} ${r.item} ${r.status}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExportCsv = () => {
    const headers = [
      "Req ID",
      "Item Requested",
      "Requested Inventory",
      "Quantity",
      "Reason",
      "Requested Date",
      "Approved Date",
      "Status",
      "Reason if Rejected",
    ];
    const rows = filtered.map((req) => [
      req.id,
      req.item,
      req.inventory,
      req.quantity,
      req.reason,
      req.date,
      req.headApprovedDate,
      req.status,
      req.rejectedReason,
    ]);

    const escapeCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csvRows = [headers, ...rows]
      .map((row) => row.map(escapeCell).join(","))
      .join("\n");

    const blob = new Blob([csvRows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `my-requests-${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    const doc = new jsPDF({ format: "a4", unit: "mm", orientation: "landscape" });
    const generatedAt = new Date().toLocaleString();
    const headers = [
      "Req ID",
      "Item Requested",
      "Requested Inventory",
      "Quantity",
      "Reason",
      "Requested Date",
      "Approved Date",
      "Status",
      "Reason if Rejected",
    ];
    const rows = filtered.map((req) => [
      req.id,
      req.item,
      req.inventory,
      req.quantity,
      req.reason,
      req.date,
      req.headApprovedDate || "-",
      req.status,
      req.rejectedReason || "-",
    ]);

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 34,
      styles: { fontSize: 11 },
      headStyles: { fillColor: [17, 76, 126], fontSize: 11 },
      didDrawPage: () => {
        const pageHeight = doc.internal.pageSize.getHeight();

        doc.setFontSize(11);
        doc.text("Inventory Management System - Faculty of Information Technology", 14, 14);

        doc.setFontSize(11);
        doc.text("My Requests Report", 14, 22);

        doc.setFontSize(11);
        doc.text(`Generated: ${generatedAt}`, 14, pageHeight - 10);
      },
      margin: { top: 30, bottom: 16 },
    });

    doc.save(`my-requests-${new Date().toISOString().split("T")[0]}.pdf`);
  };

  return (
    <MainLayout variant={sidebarVariant}>
      <PageHeader
        title="My Requests"
        subtitle="Track your item requests and their approval status"
      />

      <div className="p-6 space-y-6">

        <Card>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <SearchBox
              placeholder="Search by ID, item, or status"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <div className="relative" ref={exportDropdownRef}>
              <Button
                variant="primary"
                className="min-w-[180px] justify-between"
                onClick={() => setIsExportDropdownOpen((prev) => !prev)}
              >
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">download</span>
                  Export Report
                </span>
                <span className="material-symbols-outlined text-base">expand_more</span>
              </Button>

              {isExportDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-border-light rounded-md shadow-lg z-50 overflow-hidden">
                  <button
                    type="button"
                    className="w-full text-left px-4 py-2 text-sm text-text-dark hover:bg-background-light transition-colors"
                    onClick={() => {
                      handleExportCsv();
                      setIsExportDropdownOpen(false);
                    }}
                  >
                    Export as CSV
                  </button>
                  <button
                    type="button"
                    className="w-full text-left px-4 py-2 text-sm text-text-dark hover:bg-background-light transition-colors"
                    onClick={() => {
                      handleExportPdf();
                      setIsExportDropdownOpen(false);
                    }}
                  >
                    Export as PDF
                  </button>
                </div>
              )}
            </div>
          </div>

          <Table
            columns={columns}
            data={filtered}
            onRowClick={handleViewRequestDetails}
          />
        </Card>
      </div>

      <EntityDetailsModal
        isOpen={isRequestDetailsModalOpen}
        onClose={() => setIsRequestDetailsModalOpen(false)}
        title="Request Details"
        selectedLabel="Request ID"
        selectedName={selectedRequestDetails?.id}
        details={
          selectedRequestDetails
            ? [
                {
                  label: "Item Requested",
                  value: selectedRequestDetails.item,
                },
                {
                  label: "Inventory ID",
                  value: selectedRequestDetails.inventory,
                },
                {
                  label: "Quantity",
                  value: selectedRequestDetails.quantity,
                },
                {
                  label: "Reason",
                  value: selectedRequestDetails.reason,
                  fullWidth: true,
                },
                {
                  label: "Priority",
                  value: selectedRequestDetails.priority.charAt(0).toUpperCase() + selectedRequestDetails.priority.slice(1),
                },
                {
                  label: "Status",
                  value: selectedRequestDetails.status.charAt(0).toUpperCase() + selectedRequestDetails.status.slice(1),
                },
                {
                  label: "Requested Date",
                  value: selectedRequestDetails.date,
                },
                {
                  label: "Head Recommended Date",
                  value: selectedRequestDetails.headRecommendedDate,
                },
                {
                  label: "Head Approved Date",
                  value: selectedRequestDetails.headApprovedDate,
                },
                {
                  label: "Issued Date",
                  value: selectedRequestDetails.issuedDate,
                },
                {
                  label: "Reason if Rejected",
                  value: selectedRequestDetails.rejectedReason,
                  fullWidth: true,
                },
              ]
            : []
        }
      />
    </MainLayout>
  );
};

export default MyRequests;
