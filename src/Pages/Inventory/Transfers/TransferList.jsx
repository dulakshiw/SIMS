import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import MainLayout from "../../../Components/Layouts/MainLayout";
import { Card, Button, Table, Badge, PageHeader, SummaryCard, SummaryCardsGrid } from "../../../Components/UI";
import { resolveSidebarVariant } from "../../../utils/helpers";
import { TRANSFER_STATUS } from "../../../utils/constants";
import WorkflowReportExport from "../../../Components/Inventory/WorkflowReportExport";

const TRANSFER_EXPORT_COLUMNS = [
  { field: "id", label: "Transfer ID" },
  { field: "item", label: "Item" },
  { field: "from", label: "From Inventory" },
  { field: "to", label: "To Inventory" },
  { field: "quantity", label: "Qty" },
  { field: "status", label: "Status" },
  { field: "date", label: "Date" },
  { field: "initiatedBy", label: "Initiated By" },
];

const TRANSFER_EXPORT_SEARCH_FIELDS = ["id", "item", "from", "to", "status", "initiatedBy"];

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("currentUser") || "{}");
  } catch {
    return {};
  }
};

const TRANSFER_STATUS_LABELS = Object.fromEntries(
  TRANSFER_STATUS.map((entry) => [entry.value, entry.label])
);

const formatTransferStatus = (transfer) => {
  const safeTransfer = transfer ?? {};
  const statusKey = String(safeTransfer.approvalStatus || safeTransfer.status || "pending").toLowerCase();
  if (statusKey === "pending_hod" || statusKey === "pending_staff") {
    return "Pending HOD recommendation";
  }
  if (statusKey === "pending_registrar") {
    return "Pending Registrar Approval";
  }
  if (statusKey === "cancelled") {
    return "Cancelled";
  }
  return TRANSFER_STATUS_LABELS[statusKey]
    || statusKey.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

const resolveTransferBadgeVariant = (transfer) => {
  const safeTransfer = transfer ?? {};
  const statusKey = String(safeTransfer.approvalStatus || safeTransfer.status || "pending").toLowerCase();
  if (["completed"].includes(statusKey)) {
    return "completed";
  }
  if (["rejected", "cancelled"].includes(statusKey)) {
    return "rejected";
  }
  if (["approved", "in-transit"].includes(statusKey)) {
    return "info";
  }
  return "pending";
};

const normalizeTransferRow = (transfer) => ({
  id: `TRF-${transfer.id}`,
  rawId: transfer.id,
  item: transfer.itemName || "—",
  from: transfer.fromInventory || "—",
  to: transfer.toInventory || "—",
  quantity: transfer.quantity ?? 1,
  initiatedBy: transfer.initiatedBy || "—",
  status: formatTransferStatus(transfer),
  statusKey: String(transfer.approvalStatus || transfer.status || "pending").toLowerCase(),
  date: transfer.completedDate || transfer.transferDate || "—",
  _transfer: transfer,
});

const TransferList = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useParams();
  const sidebarVariant = resolveSidebarVariant(location.pathname, role);
  const [activeViewKey, setActiveViewKey] = useState("pending");
  const [pendingTransfers, setPendingTransfers] = useState([]);
  const [transferredItems, setTransferredItems] = useState([]);
  const [receivedTransfers, setReceivedTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadTransfers = async () => {
    try {
      setLoading(true);
      setLoadError("");

      const storedUser = getStoredUser();
      const officerUserId = Number(storedUser.id ?? 0);

      if (!Number.isInteger(officerUserId) || officerUserId <= 0) {
        setPendingTransfers([]);
        setTransferredItems([]);
        setReceivedTransfers([]);
        setLoadError("Your profile is missing a user id, so item transfers cannot be loaded.");
        return;
      }

      const baseUrl = `${API_BASE_URL}/api/item-transfers?inventoryOfficerUserId=${officerUserId}`;
      const [pendingResponse, transferredResponse, receivedResponse] = await Promise.all([
        fetch(`${baseUrl}&transferScope=pending`),
        fetch(`${baseUrl}&transferScope=transferred`),
        fetch(`${baseUrl}&transferScope=received`),
      ]);

      const [pendingData, transferredData, receivedData] = await Promise.all([
        pendingResponse.json().catch(() => ({})),
        transferredResponse.json().catch(() => ({})),
        receivedResponse.json().catch(() => ({})),
      ]);

      if (!pendingResponse.ok || !pendingData.success) {
        throw new Error(pendingData.message || pendingData.error || "Failed to load pending transfers.");
      }

      if (!transferredResponse.ok || !transferredData.success) {
        throw new Error(transferredData.message || transferredData.error || "Failed to load transferred items.");
      }

      if (!receivedResponse.ok || !receivedData.success) {
        throw new Error(receivedData.message || receivedData.error || "Failed to load received transfers.");
      }

      setPendingTransfers(pendingData.transfers || []);
      setTransferredItems(transferredData.transfers || []);
      setReceivedTransfers(receivedData.transfers || []);
    } catch (error) {
      setPendingTransfers([]);
      setTransferredItems([]);
      setReceivedTransfers([]);
      setLoadError(error.message || "Failed to load item transfers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransfers();
  }, []);

  const pendingRows = useMemo(
    () => pendingTransfers.map(normalizeTransferRow),
    [pendingTransfers]
  );

  const transferredRows = useMemo(
    () => transferredItems.map(normalizeTransferRow),
    [transferredItems]
  );

  const receivedRows = useMemo(
    () => receivedTransfers.map(normalizeTransferRow),
    [receivedTransfers]
  );

  const summaryCards = [
    {
      key: "pending",
      title: "Pending Transfers",
      description: "Items submitted for transfer that have not yet completed the process.",
      count: pendingRows.length,
      icon: "pending_actions",
    },
    {
      key: "transferred",
      title: "Transferred Items",
      description: "Items already transferred out from your assigned inventories.",
      count: transferredRows.length,
      icon: "outbound",
    },
    {
      key: "received",
      title: "Received Transfers",
      description: "Item transfers received into your assigned inventories.",
      count: receivedRows.length,
      icon: "move_to_inbox",
    },
  ];

  const activeViewSummary = summaryCards.find((card) => card.key === activeViewKey) || summaryCards[0];

  const activeTableRows = activeViewKey === "pending"
    ? pendingRows
    : activeViewKey === "transferred"
      ? transferredRows
      : receivedRows;

  const columns = [
    { field: "id", label: "Transfer ID", sortable: true },
    { field: "item", label: "Item", sortable: true },
    { field: "from", label: "From Inventory", sortable: true },
    { field: "to", label: "To Inventory", sortable: true },
    { field: "quantity", label: "Qty", sortable: true },
    {
      field: "status",
      label: "Status",
      render: (value, row) => (
        <Badge label={value} variant={resolveTransferBadgeVariant(row._transfer)} size="sm" />
      ),
    },
    { field: "date", label: "Date", sortable: true },
    { field: "initiatedBy", label: "Initiated By", sortable: true },
  ];

  const handleSelectSummary = (cardKey) => {
    setActiveViewKey(cardKey);
  };

  const handleRowClick = (row) => {
    const transferId = row.rawId ?? String(row.id || "").replace(/^TRF-/i, "");
    if (!transferId) {
      return;
    }

    navigate(
      role
        ? `/inventory/transfers/${transferId}/${role}`
        : `/inventory/transfers/${transferId}`
    );
  };

  const tableSubtitle = () => {
    if (loading) {
      return "Loading item transfers…";
    }
    if (loadError) {
      return loadError;
    }
    if (activeTableRows.length === 0) {
      return `No records in ${activeViewSummary.title.toLowerCase()}.`;
    }
    return `${activeTableRows.length} transfer${activeTableRows.length === 1 ? "" : "s"} in this list.`;
  };

  return (
    <MainLayout variant={sidebarVariant}>
      <PageHeader
        title="Item Transfers"
        subtitle="Review pending transfers, outgoing transfers, and items received into your inventories."
        actions={
          <Button
            icon="add_circle"
            variant="primary"
            onClick={() => navigate(role ? `/inventory/transfers/new/${role}` : "/inventory/transfers/new")}
          >
            Create Transfer
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {loadError ? (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {loadError}
          </div>
        ) : null}

        <SummaryCardsGrid showTitle={false} columns={3}>
          {summaryCards.map((card) => (
            <SummaryCard
              key={card.key}
              title={card.title}
              count={card.count}
              description={card.description}
              icon={card.icon}
              loading={loading}
              active={activeViewKey === card.key}
              onClick={() => handleSelectSummary(card.key)}
            />
          ))}
        </SummaryCardsGrid>

        <Card title={activeViewSummary.title} subtitle={tableSubtitle()} icon={activeViewSummary.icon}>
          <WorkflowReportExport
            rows={activeTableRows}
            columns={TRANSFER_EXPORT_COLUMNS}
            reportTitle={`Item Transfers — ${activeViewSummary.title}`}
            fileNamePrefix={`item-transfers-${activeViewKey}`}
            searchFields={TRANSFER_EXPORT_SEARCH_FIELDS}
            searchPlaceholder="Search by transfer ID, item, inventory, or status..."
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

export default TransferList;
