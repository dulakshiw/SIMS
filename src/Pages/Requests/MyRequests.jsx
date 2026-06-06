import React, { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import MainLayout from "../../Components/Layouts/MainLayout";
import { Card, SearchBox, Table, Badge, EntityDetailsModal, Button, PageHeader } from "../../Components/UI";
import { ITEM_REQUEST_STATUS, ITEM_REQUEST_STATUS_META, ITEM_REQUEST_PENDING_REQUESTER_STATUSES } from "../../utils/constants";
import { resolveSidebarVariant } from "../../utils/helpers";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("currentUser") || "{}");
  } catch {
    return {};
  }
};

const MyRequests = () => {
  const location = useLocation();
  const { role } = useParams();
  const sidebarVariant = resolveSidebarVariant(location.pathname, role);
  const [searchTerm, setSearchTerm] = useState("");
  const [myRequests, setMyRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isRequestDetailsModalOpen, setIsRequestDetailsModalOpen] = useState(false);
  const [selectedRequestDetails, setSelectedRequestDetails] = useState(null);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
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

  useEffect(() => {
    let isMounted = true;

    const loadRequests = async () => {
      const currentUser = getStoredUser();
      const requestedById = Number(currentUser.id ?? 0);

      if (!Number.isInteger(requestedById) || requestedById <= 0) {
        if (isMounted) {
          setMyRequests([]);
          setLoadError("Your session is missing a user id. Please sign in again.");
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        setLoadError("");

        const response = await fetch(`${API_BASE_URL}/api/item-requests?requestedById=${requestedById}`);
        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
          throw new Error(data.message || data.error || "Failed to load your requests.");
        }

        if (isMounted) {
          setMyRequests(
            (data.requests || []).map((request) => ({
              id: `REQ-${request.id}`,
              rawId: request.id,
              item: request.itemName,
              inventory: request.inventoryLocation || request.inventoryName || "—",
              priority: request.priority || "normal",
              status: request.approvalStatus || "pending_hod",
              date: request.requestedDate || "",
              quantity: request.quantity,
              reason: request.reason || "",
              specification: request.specification || "",
              headApprovedDate: request.issuedDate || request.labHodApprovedDate || request.hodApprovedDate || null,
              issuedDate: request.issuedDate || null,
              returnedDate: request.returnedDate || null,
              allocatedItemName: request.allocatedItem?.itemName || null,
              allocatedItemCode: request.allocatedItem?.itemCode || null,
              allocatedItemLocation: request.allocatedItem?.location || null,
              allocatedItemStatus: request.allocatedItem?.status || null,
              allocatedItemRemarks: request.allocatedItem?.remarks || null,
              recommendedDate: request.requesterHodRecommendedDate || null,
              rejectedReason: request.rejectionReason || null,
              requiredByDate: request.requiredByDate || "",
            }))
          );
        }
      } catch (error) {
        if (isMounted) {
          setMyRequests([]);
          setLoadError(error.message || "Failed to load your requests.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadRequests();

    return () => {
      isMounted = false;
    };
  }, []);

  const statusBadge = (statusKey) => {
    const config = ITEM_REQUEST_STATUS_META[statusKey] || {
      label: statusKey,
      variant: "secondary",
    };

    return (
      <Badge
        label={config.label}
        variant={config.variant}
        size="sm"
      />
    );
  };

  const columns = [
    { field: "id", label: "Request ID", sortable: true },
    { field: "item", label: "Item Requested", sortable: true },
    { field: "inventory", label: "Inventory Location", sortable: true },
    { field: "quantity", label: "Quantity", sortable: true },
    { field: "date", label: "Requested Date", sortable: true },
    {
      field: "headApprovedDate",
      label: "Issued / Approved Date",
      sortable: true,
      render: (value, row) => row.issuedDate || value || "-",
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
      render: (value) => statusBadge(value),
    },
  ];

  const handleViewRequestDetails = (request) => {
    setCancelError("");
    setSelectedRequestDetails(request);
    setIsRequestDetailsModalOpen(true);
  };

  const handleCloseRequestDetails = () => {
    if (isCancelling) {
      return;
    }
    setCancelError("");
    setIsRequestDetailsModalOpen(false);
    setSelectedRequestDetails(null);
  };

  const handleCancelRequest = async () => {
    if (!selectedRequestDetails || !ITEM_REQUEST_PENDING_REQUESTER_STATUSES.has(selectedRequestDetails.status)) {
      return;
    }

    const currentUser = getStoredUser();
    const requestedById = Number(currentUser.id ?? 0);

    if (!Number.isInteger(requestedById) || requestedById <= 0) {
      setCancelError("Your session is missing a user id. Please sign in again.");
      return;
    }

    const confirmed = window.confirm(
      `Cancel request ${selectedRequestDetails.id} for "${selectedRequestDetails.item}"? This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsCancelling(true);
      setCancelError("");

      const response = await fetch(
        `${API_BASE_URL}/api/item-requests/${selectedRequestDetails.rawId}/cancel`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestedById }),
        }
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to cancel request.");
      }

      setMyRequests((prev) =>
        prev.map((request) =>
          request.rawId === selectedRequestDetails.rawId
            ? { ...request, status: ITEM_REQUEST_STATUS.CANCELLED }
            : request
        )
      );
      setSelectedRequestDetails((prev) =>
        prev ? { ...prev, status: ITEM_REQUEST_STATUS.CANCELLED } : prev
      );
    } catch (error) {
      setCancelError(error.message || "Failed to cancel request.");
    } finally {
      setIsCancelling(false);
    }
  };

  const canCancelSelectedRequest = selectedRequestDetails
    ? ITEM_REQUEST_PENDING_REQUESTER_STATUSES.has(selectedRequestDetails.status)
    : false;

  const filtered = myRequests.filter((r) =>
    `${r.id} ${r.item} ${r.inventory} ${r.status}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExportCsv = () => {
    const headers = [
      "Req ID",
      "Item Requested",
      "Inventory Location",
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
      ITEM_REQUEST_STATUS_META[req.status]?.label || req.status,
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
      "Inventory Location",
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
      ITEM_REQUEST_STATUS_META[req.status]?.label || req.status,
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
        {loadError ? <p className="text-sm text-error">{loadError}</p> : null}

        <Card>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <SearchBox
              placeholder="Search by ID, item, location, or status"
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
            loading={loading}
          />
        </Card>
      </div>

      <EntityDetailsModal
        isOpen={isRequestDetailsModalOpen}
        onClose={handleCloseRequestDetails}
        title="Request Details"
        selectedLabel="Request ID"
        selectedName={selectedRequestDetails?.id}
        footer={(
          <div className="flex flex-wrap justify-end gap-3">
            {canCancelSelectedRequest ? (
              <Button
                variant="danger"
                icon="cancel"
                onClick={handleCancelRequest}
                disabled={isCancelling}
                loading={isCancelling}
              >
                Cancel Request
              </Button>
            ) : null}
            <Button variant="secondary" onClick={handleCloseRequestDetails} disabled={isCancelling}>
              Close
            </Button>
          </div>
        )}
        details={
          selectedRequestDetails
            ? [
                {
                  label: "Item Requested",
                  value: selectedRequestDetails.item,
                },
                {
                  label: "Inventory Location",
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
                  label: "Specifications",
                  value: selectedRequestDetails.specification || "—",
                  fullWidth: true,
                },
                {
                  label: "Priority",
                  value: selectedRequestDetails.priority.charAt(0).toUpperCase() + selectedRequestDetails.priority.slice(1),
                },
                {
                  label: "Status",
                  value: ITEM_REQUEST_STATUS_META[selectedRequestDetails.status]?.label || selectedRequestDetails.status,
                },
                {
                  label: "Requested Date",
                  value: selectedRequestDetails.date,
                },
                {
                  label: "Required By Date",
                  value: selectedRequestDetails.requiredByDate || "—",
                },
                {
                  label: "Recommended Date",
                  value: selectedRequestDetails.recommendedDate || "—",
                },
                {
                  label: "Issued Date",
                  value: selectedRequestDetails.issuedDate || "—",
                },
                {
                  label: "Returned Date",
                  value: selectedRequestDetails.returnedDate || "—",
                },
                {
                  label: "Approved Date",
                  value: selectedRequestDetails.headApprovedDate || "—",
                },
                ...(selectedRequestDetails.allocatedItemName
                  ? [
                    { label: "Issued Item", value: selectedRequestDetails.allocatedItemName },
                    { label: "Issued Item Code", value: selectedRequestDetails.allocatedItemCode || "—" },
                    { label: "Item Location", value: selectedRequestDetails.allocatedItemLocation || "—" },
                    { label: "Item Status", value: selectedRequestDetails.allocatedItemStatus || "—" },
                    {
                      label: "Item Remarks",
                      value: selectedRequestDetails.allocatedItemRemarks || "—",
                      fullWidth: true,
                    },
                  ]
                  : []),
                {
                  label: "Reason if Rejected",
                  value: selectedRequestDetails.rejectedReason || "—",
                  fullWidth: true,
                },
              ]
            : []
        }
      >
        {cancelError ? <p className="text-sm text-error">{cancelError}</p> : null}
        {canCancelSelectedRequest ? (
          <p className="text-xs text-text-light">
            You can cancel this request while it is still awaiting your Head of Department's recommendation.
          </p>
        ) : null}
      </EntityDetailsModal>
    </MainLayout>
  );
};

export default MyRequests;
