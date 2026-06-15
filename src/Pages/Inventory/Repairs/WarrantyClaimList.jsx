import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import MainLayout from "../../../Components/Layouts/MainLayout";
import { Card, Button, Table, Badge, PageHeader, SummaryCard, SummaryCardsGrid } from "../../../Components/UI";
import { resolveSidebarVariant } from "../../../utils/helpers";
import WorkflowReportExport from "../../../Components/Inventory/WorkflowReportExport";

const WARRANTY_CLAIM_EXPORT_COLUMNS = [
  { field: "id", label: "Claim ID" },
  { field: "itemName", label: "Item" },
  { field: "inventory", label: "Inventory" },
  { field: "faultDescription", label: "Fault" },
  { field: "status", label: "Status" },
  { field: "date", label: "Claim Date" },
  { field: "initiatedBy", label: "Initiated By" },
];

const WARRANTY_CLAIM_EXPORT_SEARCH_FIELDS = ["id", "itemName", "inventory", "faultDescription", "status", "initiatedBy"];

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("currentUser") || "{}");
  } catch {
    return {};
  }
};

const formatClaimStatus = (claim = {}) => {
  const statusKey = String(claim.status || "submitted").toLowerCase();
  if (statusKey === "submitted") return "Letter Submitted";
  if (statusKey === "in_progress") return "In Progress";
  if (statusKey === "completed") return "Completed";
  if (statusKey === "cancelled") return "Cancelled";
  return statusKey.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

const resolveClaimBadgeVariant = (claim = {}) => {
  const statusKey = String(claim.status || "submitted").toLowerCase();
  if (statusKey === "completed") return "completed";
  if (statusKey === "cancelled") return "rejected";
  if (statusKey === "in_progress") return "info";
  return "pending";
};

const normalizeClaimRow = (claim) => ({
  id: `WCL-${claim.id}`,
  rawId: claim.id,
  itemName: claim.itemName || "—",
  inventory: claim.inventory || "—",
  faultDescription: claim.faultDescription || "—",
  status: formatClaimStatus(claim),
  statusKey: String(claim.status || "submitted").toLowerCase(),
  date: claim.claimDate || "—",
  initiatedBy: claim.initiatedBy || "—",
  _claim: claim,
});

const WarrantyClaimList = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useParams();
  const sidebarVariant = resolveSidebarVariant(location.pathname, role);
  const [activeViewKey, setActiveViewKey] = useState("all");
  const [allClaims, setAllClaims] = useState([]);
  const [pendingClaims, setPendingClaims] = useState([]);
  const [completedClaims, setCompletedClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const createClaimPath = role
    ? `/inventory/repairs/warranty-claims/new/${role}`
    : "/inventory/repairs/warranty-claims/new";

  const loadClaims = async () => {
    try {
      setLoading(true);
      setLoadError("");

      const storedUser = getStoredUser();
      const officerUserId = Number(storedUser.id ?? 0);

      if (!Number.isInteger(officerUserId) || officerUserId <= 0) {
        setAllClaims([]);
        setPendingClaims([]);
        setCompletedClaims([]);
        setLoadError("Your profile is missing a user id, so warranty claims cannot be loaded.");
        return;
      }

      const baseUrl = `${API_BASE_URL}/api/warranty-claims?inventoryOfficerUserId=${officerUserId}`;
      const [allResponse, pendingResponse, completedResponse] = await Promise.all([
        fetch(`${baseUrl}&claimScope=all`),
        fetch(`${baseUrl}&claimScope=pending`),
        fetch(`${baseUrl}&claimScope=completed`),
      ]);

      const [allData, pendingData, completedData] = await Promise.all([
        allResponse.json().catch(() => ({})),
        pendingResponse.json().catch(() => ({})),
        completedResponse.json().catch(() => ({})),
      ]);

      if (!allResponse.ok || !allData.success) {
        throw new Error(allData.message || allData.error || "Failed to load warranty claims.");
      }
      if (!pendingResponse.ok || !pendingData.success) {
        throw new Error(pendingData.message || pendingData.error || "Failed to load pending warranty claims.");
      }
      if (!completedResponse.ok || !completedData.success) {
        throw new Error(completedData.message || completedData.error || "Failed to load completed warranty claims.");
      }

      setAllClaims(allData.claims || []);
      setPendingClaims(pendingData.claims || []);
      setCompletedClaims(completedData.claims || []);
    } catch (error) {
      setAllClaims([]);
      setPendingClaims([]);
      setCompletedClaims([]);
      setLoadError(error.message || "Failed to load warranty claims.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClaims();
  }, []);

  const allRows = useMemo(() => allClaims.map(normalizeClaimRow), [allClaims]);
  const pendingRows = useMemo(() => pendingClaims.map(normalizeClaimRow), [pendingClaims]);
  const completedRows = useMemo(() => completedClaims.map(normalizeClaimRow), [completedClaims]);

  const summaryCards = [
    { key: "all", title: "Total Claims", description: "All warranty claims for your inventories.", count: allRows.length, icon: "verified_user" },
    { key: "pending", title: "Active", description: "Submitted or in-progress warranty claims.", count: pendingRows.length, icon: "schedule", countClassName: "text-warning" },
    { key: "completed", title: "Completed", description: "Warranty claims marked as completed.", count: completedRows.length, icon: "done_all", countClassName: "text-success" },
  ];

  const activeTableRows = activeViewKey === "pending"
    ? pendingRows
    : activeViewKey === "completed"
      ? completedRows
      : allRows;

  const detailPath = (rawId) => (role
    ? `/inventory/repairs/warranty-claims/${rawId}/${role}`
    : `/inventory/repairs/warranty-claims/${rawId}`);

  const columns = [
    { field: "id", label: "Claim ID", sortable: true },
    { field: "itemName", label: "Item", sortable: true },
    { field: "inventory", label: "Inventory", sortable: true },
    { field: "faultDescription", label: "Fault", sortable: false },
    {
      field: "status",
      label: "Status",
      sortable: true,
      render: (value, row) => <Badge variant={resolveClaimBadgeVariant(row._claim)}>{value}</Badge>,
    },
    { field: "date", label: "Claim Date", sortable: true },
    { field: "initiatedBy", label: "Initiated By", sortable: true },
  ];

  return (
    <MainLayout variant={sidebarVariant}>
      <PageHeader
        title="Warranty Claims"
        subtitle="Notify the Supplies Division by letter for items still under warranty."
        actions={
          <Button variant="primary" icon="add" onClick={() => navigate(createClaimPath)}>
            New Warranty Claim
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

        <Card title={summaryCards.find((card) => card.key === activeViewKey)?.title || "Warranty Claims"} icon="verified_user">
          <WorkflowReportExport
            rows={activeTableRows}
            columns={WARRANTY_CLAIM_EXPORT_COLUMNS}
            reportTitle={`Warranty Claims — ${summaryCards.find((card) => card.key === activeViewKey)?.title || "All"}`}
            fileNamePrefix={`warranty-claims-${activeViewKey}`}
            searchFields={WARRANTY_CLAIM_EXPORT_SEARCH_FIELDS}
            searchPlaceholder="Search by claim ID, item name, inventory, or fault..."
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
            <p className="text-sm text-text-light">No warranty claims found.</p>
          ) : null}
        </Card>
      </div>
    </MainLayout>
  );
};

export default WarrantyClaimList;
