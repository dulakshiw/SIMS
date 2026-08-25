import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import MainLayout from "../../../Components/Layouts/MainLayout";
import { Card, Button, Table, Badge, PageHeader, SummaryCard, SummaryCardsGrid } from "../../../Components/UI";
import { resolveSidebarVariant } from "../../../utils/helpers";
import WorkflowReportExport from "../../../Components/Inventory/WorkflowReportExport";

const REPAIR_EXPORT_COLUMNS = [
  { field: "id", label: "Repair ID" },
  { field: "itemName", label: "Item" },
  { field: "inventory", label: "Inventory" },
  { field: "faultDescription", label: "Fault" },
  { field: "status", label: "Status" },
  { field: "date", label: "Repair Date" },
  { field: "initiatedBy", label: "Initiated By" },
];

const REPAIR_EXPORT_SEARCH_FIELDS = ["id", "itemName", "inventory", "faultDescription", "status", "initiatedBy"];

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("currentUser") || "{}");
  } catch {
    return {};
  }
};

const formatRepairStatus = (repair = {}) => {
  const statusKey = String(repair.approvalStatus || repair.status || "submitted").toLowerCase();
  if (statusKey === "submitted") return "Submitted";
  if (statusKey === "pending_hod" || statusKey === "pending_staff") return "Pending HOD";
  if (statusKey === "pending_registrar") return "Pending Registrar";
  if (statusKey === "in_progress") return "In Progress";
  if (statusKey === "completed") return "Completed";
  if (statusKey === "cancelled") return "Cancelled";
  return statusKey.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

const resolveRepairBadgeVariant = (repair = {}) => {
  const statusKey = String(repair.approvalStatus || repair.status || "submitted").toLowerCase();
  if (statusKey === "completed") return "completed";
  if (statusKey === "cancelled") return "rejected";
  if (statusKey === "in_progress") return "info";
  return "pending";
};

const normalizeRepairRow = (repair) => ({
  id: `REP-${repair.id}`,
  rawId: repair.id,
  itemName: repair.itemName || "—",
  inventory: repair.inventory || "—",
  faultDescription: repair.faultDescription || "—",
  status: formatRepairStatus(repair),
  statusKey: String(repair.status || "submitted").toLowerCase(),
  date: repair.repairDate || "—",
  initiatedBy: repair.initiatedBy || "—",
  _repair: repair,
});

const RepairList = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useParams();
  const sidebarVariant = resolveSidebarVariant(location.pathname, role);
  const [activeViewKey, setActiveViewKey] = useState("all");
  const [allRepairs, setAllRepairs] = useState([]);
  const [pendingRepairs, setPendingRepairs] = useState([]);
  const [completedRepairs, setCompletedRepairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const createRepairPath = role
    ? `/inventory/repairs/new/${role}`
    : "/inventory/repairs/new";

  const loadRepairs = async () => {
    try {
      setLoading(true);
      setLoadError("");

      const storedUser = getStoredUser();
      const officerUserId = Number(storedUser.id ?? 0);

      if (!Number.isInteger(officerUserId) || officerUserId <= 0) {
        setAllRepairs([]);
        setPendingRepairs([]);
        setCompletedRepairs([]);
        setLoadError("Your profile is missing a user id, so repairs cannot be loaded.");
        return;
      }

      const baseUrl = `${API_BASE_URL}/api/item-repairs?inventoryOfficerUserId=${officerUserId}`;
      const [allResponse, pendingResponse, completedResponse] = await Promise.all([
        fetch(`${baseUrl}&repairScope=all`),
        fetch(`${baseUrl}&repairScope=pending`),
        fetch(`${baseUrl}&repairScope=completed`),
      ]);

      const [allData, pendingData, completedData] = await Promise.all([
        allResponse.json().catch(() => ({})),
        pendingResponse.json().catch(() => ({})),
        completedResponse.json().catch(() => ({})),
      ]);

      if (!allResponse.ok || !allData.success) {
        throw new Error(allData.message || allData.error || "Failed to load repairs.");
      }
      if (!pendingResponse.ok || !pendingData.success) {
        throw new Error(pendingData.message || pendingData.error || "Failed to load pending repairs.");
      }
      if (!completedResponse.ok || !completedData.success) {
        throw new Error(completedData.message || completedData.error || "Failed to load completed repairs.");
      }

      setAllRepairs(allData.repairs || []);
      setPendingRepairs(pendingData.repairs || []);
      setCompletedRepairs(completedData.repairs || []);
    } catch (error) {
      setAllRepairs([]);
      setPendingRepairs([]);
      setCompletedRepairs([]);
      setLoadError(error.message || "Failed to load repairs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRepairs();
  }, []);

  const allRows = useMemo(() => allRepairs.map(normalizeRepairRow), [allRepairs]);
  const pendingRows = useMemo(() => pendingRepairs.map(normalizeRepairRow), [pendingRepairs]);
  const completedRows = useMemo(() => completedRepairs.map(normalizeRepairRow), [completedRepairs]);

  const summaryCards = [
    { key: "all", title: "Total Repairs", description: "All repair requests for your inventories.", count: allRows.length, icon: "handyman" },
    { key: "pending", title: "Active", description: "Submitted or in-progress repair requests.", count: pendingRows.length, icon: "schedule", countClassName: "text-warning" },
    { key: "completed", title: "Completed", description: "Repairs marked as completed.", count: completedRows.length, icon: "done_all", countClassName: "text-success" },
  ];

  const activeTableRows = activeViewKey === "pending"
    ? pendingRows
    : activeViewKey === "completed"
      ? completedRows
      : allRows;

  const detailPath = (rawId) => (role
    ? `/inventory/repairs/${rawId}/${role}`
    : `/inventory/repairs/${rawId}`);

  const columns = [
    { field: "id", label: "Repair ID", sortable: true },
    { field: "itemName", label: "Item", sortable: true },
    { field: "inventory", label: "Inventory", sortable: true },
    { field: "faultDescription", label: "Fault", sortable: false },
    {
      field: "status",
      label: "Status",
      sortable: true,
      render: (value, row) => <Badge label={value} variant={resolveRepairBadgeVariant(row._repair)} />,
    },
    { field: "date", label: "Repair Date", sortable: true },
    { field: "initiatedBy", label: "Initiated By", sortable: true },
  ];

  return (
    <MainLayout variant={sidebarVariant}>
      <PageHeader
        title="Repairs"
        subtitle="Manage repair requests for items outside the warranty period."
        actions={
          <Button variant="primary" icon="add" onClick={() => navigate(createRepairPath)}>
            New Repair
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {loadError ? <p className="text-sm text-error">{loadError}</p> : null}

        <SummaryCardsGrid>
          {summaryCards.map((card) => (
            <SummaryCard
              key={card.key}
              title={card.title}
              description={card.description}
              count={card.count}
              icon={card.icon}
              countClassName={card.countClassName}
              active={activeViewKey === card.key}
              onClick={() => setActiveViewKey(card.key)}
            />
          ))}
        </SummaryCardsGrid>

        <Card title={summaryCards.find((card) => card.key === activeViewKey)?.title || "Repairs"} icon="handyman">
          <WorkflowReportExport
            rows={activeTableRows}
            columns={REPAIR_EXPORT_COLUMNS}
            reportTitle={`Repairs — ${summaryCards.find((card) => card.key === activeViewKey)?.title || "All"}`}
            fileNamePrefix={`item-repairs-${activeViewKey}`}
            searchFields={REPAIR_EXPORT_SEARCH_FIELDS}
            searchPlaceholder="Search by repair ID, item name, inventory, or fault..."
            disabled={loading}
          />
          <Table
            columns={columns}
            data={activeTableRows}
            loading={loading}
            searchable
            paginated={activeTableRows.length > 10}
            itemsPerPage={10}
            onRowClick={(row) => navigate(detailPath(row.rawId))}
          />
          {!loading && activeTableRows.length === 0 ? (
            <p className="text-sm text-text-light">No repair requests found.</p>
          ) : null}
        </Card>
      </div>
    </MainLayout>
  );
};

export default RepairList;
