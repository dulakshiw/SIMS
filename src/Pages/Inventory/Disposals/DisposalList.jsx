import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import MainLayout from "../../../Components/Layouts/MainLayout";
import { Card, Button, Table, Badge, PageHeader, SummaryCard, SummaryCardsGrid } from "../../../Components/UI";
import { DISPOSAL_REASONS, getDisposalOptionLabel } from "../../../utils/constants";
import { resolveSidebarVariant } from "../../../utils/helpers";
import WorkflowReportExport from "../../../Components/Inventory/WorkflowReportExport";

const DISPOSAL_EXPORT_COLUMNS = [
  { field: "id", label: "Disposal ID" },
  { field: "itemName", label: "Item Name" },
  { field: "inventory", label: "Inventory" },
  { field: "reason", label: "Reason" },
  { field: "status", label: "Status" },
  { field: "date", label: "Date" },
  { field: "value", label: "Item Value" },
  { field: "initiatedBy", label: "Initiated By" },
];

const DISPOSAL_EXPORT_SEARCH_FIELDS = ["id", "itemName", "inventory", "reason", "status", "initiatedBy"];

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("currentUser") || "{}");
  } catch {
    return {};
  }
};

const formatDisposalStatus = (disposal = {}) => {
  const statusKey = String(disposal.approvalStatus || disposal.status || "pending").toLowerCase();
  if (statusKey === "pending_hod" || statusKey === "pending_staff") {
    return "Pending HOD recommendation";
  }
  if (statusKey === "pending_registrar") {
    return "Pending Registrar Approval";
  }
  if (statusKey === "pending_writeoff" || statusKey === "pending_admin") {
    return "Approved — Awaiting Write-off";
  }
  if (statusKey === "cancelled") {
    return "Cancelled";
  }
  if (statusKey === "rejected") {
    return "Rejected";
  }
  if (statusKey === "completed") {
    return "Written Off";
  }
  return statusKey.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

const resolveDisposalBadgeVariant = (disposal = {}) => {
  const statusKey = String(disposal.approvalStatus || disposal.status || "pending").toLowerCase();
  if (statusKey === "completed") {
    return "completed";
  }
  if (["rejected", "cancelled"].includes(statusKey)) {
    return "rejected";
  }
  if (statusKey === "pending_admin" || statusKey === "pending_writeoff") {
    return "info";
  }
  return "pending";
};

const formatDisposalReason = (disposal = {}) => {
  const label = getDisposalOptionLabel(DISPOSAL_REASONS, disposal.reason);
  if (String(disposal.reason || "").toLowerCase() === "other" && disposal.reasonOtherDetails) {
    return `${label}: ${disposal.reasonOtherDetails}`;
  }
  return label || disposal.reason || "—";
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

const normalizeDisposalRow = (disposal) => ({
  id: `DSP-${disposal.id}`,
  rawId: disposal.id,
  itemName: disposal.itemName || "—",
  inventory: disposal.inventory || "—",
  reason: formatDisposalReason(disposal),
  status: formatDisposalStatus(disposal),
  statusKey: String(disposal.approvalStatus || disposal.status || "pending").toLowerCase(),
  date: disposal.disposalDate || "—",
  value: formatItemValue(disposal.itemValue),
  initiatedBy: disposal.initiatedBy || "—",
  _disposal: disposal,
});

const DisposalList = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useParams();
  const sidebarVariant = resolveSidebarVariant(location.pathname, role);
  const [activeViewKey, setActiveViewKey] = useState("all");
  const [allDisposals, setAllDisposals] = useState([]);
  const [pendingDisposals, setPendingDisposals] = useState([]);
  const [approvedDisposals, setApprovedDisposals] = useState([]);
  const [completedDisposals, setCompletedDisposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const createDisposalPath = role
    ? `/inventory/disposals/new/${role}`
    : "/inventory/disposals/new";

  const loadDisposals = async () => {
    try {
      setLoading(true);
      setLoadError("");

      const storedUser = getStoredUser();
      const officerUserId = Number(storedUser.id ?? 0);

      if (!Number.isInteger(officerUserId) || officerUserId <= 0) {
        setAllDisposals([]);
        setPendingDisposals([]);
        setApprovedDisposals([]);
        setCompletedDisposals([]);
        setLoadError("Your profile is missing a user id, so disposals cannot be loaded.");
        return;
      }

      const baseUrl = `${API_BASE_URL}/api/item-disposals?inventoryOfficerUserId=${officerUserId}`;
      const [allResponse, pendingResponse, approvedResponse, completedResponse] = await Promise.all([
        fetch(`${baseUrl}&disposalScope=all`),
        fetch(`${baseUrl}&disposalScope=pending`),
        fetch(`${baseUrl}&disposalScope=approved`),
        fetch(`${baseUrl}&disposalScope=completed`),
      ]);

      const [allData, pendingData, approvedData, completedData] = await Promise.all([
        allResponse.json().catch(() => ({})),
        pendingResponse.json().catch(() => ({})),
        approvedResponse.json().catch(() => ({})),
        completedResponse.json().catch(() => ({})),
      ]);

      if (!allResponse.ok || !allData.success) {
        throw new Error(allData.message || allData.error || "Failed to load disposals.");
      }

      if (!pendingResponse.ok || !pendingData.success) {
        throw new Error(pendingData.message || pendingData.error || "Failed to load pending disposals.");
      }

      if (!approvedResponse.ok || !approvedData.success) {
        throw new Error(approvedData.message || approvedData.error || "Failed to load approved disposals.");
      }

      if (!completedResponse.ok || !completedData.success) {
        throw new Error(completedData.message || completedData.error || "Failed to load completed disposals.");
      }

      setAllDisposals(allData.disposals || []);
      setPendingDisposals(pendingData.disposals || []);
      setApprovedDisposals(approvedData.disposals || []);
      setCompletedDisposals(completedData.disposals || []);
    } catch (error) {
      setAllDisposals([]);
      setPendingDisposals([]);
      setApprovedDisposals([]);
      setCompletedDisposals([]);
      setLoadError(error.message || "Failed to load disposals.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDisposals();
  }, []);

  const allRows = useMemo(() => allDisposals.map(normalizeDisposalRow), [allDisposals]);
  const pendingRows = useMemo(() => pendingDisposals.map(normalizeDisposalRow), [pendingDisposals]);
  const approvedRows = useMemo(() => approvedDisposals.map(normalizeDisposalRow), [approvedDisposals]);
  const completedRows = useMemo(() => completedDisposals.map(normalizeDisposalRow), [completedDisposals]);

  const summaryCards = [
    {
      key: "all",
      title: "Total Disposals",
      description: "All disposal requests recorded for your inventories.",
      count: allRows.length,
      icon: "delete_sweep",
    },
    {
      key: "pending",
      title: "Pending",
      description: "Disposals awaiting HOD recommendation or registrar approval.",
      count: pendingRows.length,
      icon: "schedule",
      countClassName: "text-warning",
    },
    {
      key: "approved",
      title: "Approved",
      description: "Registrar approved; items remain in inventory until written off after auction processing.",
      count: approvedRows.length,
      icon: "check_circle",
      countClassName: "text-success",
    },
    {
      key: "completed",
      title: "Written Off",
      description: "Items written off and removed from active inventory.",
      count: completedRows.length,
      icon: "done_all",
      countClassName: "text-info",
    },
  ];

  const activeViewSummary = summaryCards.find((card) => card.key === activeViewKey) || summaryCards[0];

  const activeTableRows = activeViewKey === "pending"
    ? pendingRows
    : activeViewKey === "approved"
      ? approvedRows
      : activeViewKey === "completed"
        ? completedRows
        : allRows;

  const columns = [
    { field: "id", label: "Disposal ID", sortable: true },
    { field: "itemName", label: "Item Name", sortable: true },
    { field: "inventory", label: "Inventory", sortable: true },
    { field: "reason", label: "Reason", sortable: true },
    {
      field: "status",
      label: "Status",
      render: (value, row) => (
        <Badge label={value} variant={resolveDisposalBadgeVariant(row._disposal)} size="sm" />
      ),
    },
    { field: "date", label: "Date", sortable: true },
    { field: "value", label: "Item Value", sortable: true },
    { field: "initiatedBy", label: "Initiated By", sortable: true },
  ];

  const handleSelectSummary = (cardKey) => {
    setActiveViewKey(cardKey);
  };

  const handleRowClick = (row) => {
    const disposalId = row.rawId ?? String(row.id || "").replace(/^DSP-/i, "");
    if (!disposalId) {
      return;
    }

    navigate(
      role
        ? `/inventory/disposals/${disposalId}/${role}`
        : `/inventory/disposals/${disposalId}`
    );
  };

  const tableSubtitle = () => {
    if (loading) {
      return "Loading disposals…";
    }
    if (loadError) {
      return loadError;
    }
    if (activeTableRows.length === 0) {
      return `No records in ${activeViewSummary.title.toLowerCase()}.`;
    }
    return `${activeTableRows.length} disposal${activeTableRows.length === 1 ? "" : "s"} in this list.`;
  };

  return (
    <MainLayout variant={sidebarVariant}>
      <PageHeader
        title="Disposal Management"
        subtitle="Review disposal requests submitted from your assigned inventories."
        actions={
          <Button
            icon="add_circle"
            variant="primary"
            onClick={() => navigate(createDisposalPath)}
          >
            Create Disposal
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {loadError ? (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {loadError}
          </div>
        ) : null}

        <SummaryCardsGrid showTitle={false} columns="4-equal">
          {summaryCards.map((card) => (
            <SummaryCard
              key={card.key}
              title={card.title}
              count={card.count}
              description={card.description}
              icon={card.icon}
              countClassName={card.countClassName}
              loading={loading}
              active={activeViewKey === card.key}
              onClick={() => handleSelectSummary(card.key)}
              hover
            />
          ))}
        </SummaryCardsGrid>

        <Card title={activeViewSummary.title} subtitle={tableSubtitle()} icon={activeViewSummary.icon}>
          <WorkflowReportExport
            rows={activeTableRows}
            columns={DISPOSAL_EXPORT_COLUMNS}
            reportTitle={`Disposals — ${activeViewSummary.title}`}
            fileNamePrefix={`item-disposals-${activeViewKey}`}
            searchFields={DISPOSAL_EXPORT_SEARCH_FIELDS}
            searchPlaceholder="Search by disposal ID, item name, inventory, or status..."
            disabled={loading}
          />
          <Table
            columns={columns}
            data={activeTableRows}
            onRowClick={handleRowClick}
            searchable
            loading={loading}
            paginated={activeTableRows.length > 10}
            itemsPerPage={10}
          />
        </Card>
      </div>
    </MainLayout>
  );
};

export default DisposalList;
