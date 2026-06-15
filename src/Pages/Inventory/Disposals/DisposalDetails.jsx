import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import MainLayout from "../../../Components/Layouts/MainLayout";
import { Card, Button, Badge, PageHeader, Table } from "../../../Components/UI";
import { resolveSidebarVariant } from "../../../utils/helpers";
import DisposalSubmissionForm from "./DisposalSubmissionForm";
import {
  DISPOSAL_REASONS,
  DISPOSAL_TYPES,
  getDisposalOptionLabel,
} from "../../../utils/constants";

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
  if (["completed"].includes(statusKey)) {
    return "completed";
  }
  if (["rejected", "cancelled"].includes(statusKey)) {
    return "rejected";
  }
  if (["pending_writeoff", "pending_admin"].includes(statusKey)) {
    return "info";
  }
  return "pending";
};

const canWriteOffDisposal = (disposal = {}) => {
  const statusKey = String(disposal.approvalStatus || disposal.status || "").toLowerCase();
  return ["pending_writeoff", "pending_admin"].includes(statusKey);
};

const formatDetailValue = (value) => {
  const normalized = String(value ?? "").trim();
  return normalized || "—";
};

const formatDisposalReason = (disposal = {}) => {
  const label = getDisposalOptionLabel(DISPOSAL_REASONS, disposal.reason);
  if (String(disposal.reason || "").toLowerCase() === "other" && disposal.reasonOtherDetails) {
    return `${label}: ${disposal.reasonOtherDetails}`;
  }
  return label || formatDetailValue(disposal.reason);
};

const formatDisposalType = (disposal = {}) => {
  const label = getDisposalOptionLabel(DISPOSAL_TYPES, disposal.disposalType);
  if (String(disposal.disposalType || "").toLowerCase() === "other" && disposal.disposalTypeDetails) {
    return `${label}: ${disposal.disposalTypeDetails}`;
  }
  return label || formatDetailValue(disposal.disposalType);
};

const DisposalDetails = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { disposalId, role } = useParams();
  const sidebarVariant = resolveSidebarVariant(location.pathname, role);
  const [disposal, setDisposal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [writeOffLoading, setWriteOffLoading] = useState(false);
  const [writeOffError, setWriteOffError] = useState("");

  const listPath = role ? `/inventory/disposals/list/${role}` : "/inventory/disposals/list";

  const loadDisposal = async () => {
    try {
      setLoading(true);
      setLoadError("");

      const response = await fetch(`${API_BASE_URL}/api/item-disposals/${disposalId}`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to load disposal details.");
      }

      setDisposal(data.disposal || null);
    } catch (error) {
      setDisposal(null);
      setLoadError(error.message || "Failed to load disposal details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDisposal();
  }, [disposalId]);

  const handleWriteOff = async () => {
    const storedUser = getStoredUser();
    const officerUserId = Number(storedUser.id ?? 0);

    if (!Number.isInteger(officerUserId) || officerUserId <= 0) {
      setWriteOffError("Your profile is missing a user id.");
      return;
    }

    const confirmed = window.confirm(
      "Write off the item(s) in this disposal? They will be marked as disposed and removed from active inventory."
    );
    if (!confirmed) {
      return;
    }

    try {
      setWriteOffLoading(true);
      setWriteOffError("");

      const response = await fetch(`${API_BASE_URL}/api/item-disposals/${disposalId}/write-off`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ officerUserId }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to write off item(s).");
      }

      await loadDisposal();
    } catch (error) {
      setWriteOffError(error.message || "Failed to write off item(s).");
    } finally {
      setWriteOffLoading(false);
    }
  };

  const itemColumns = [
    { field: "itemName", label: "Item Name", sortable: true },
    { field: "quantity", label: "Qty", sortable: true },
    { field: "status", label: "Status", sortable: true },
  ];

  const itemRows = (disposal?.items || []).map((item) => ({
    ...item,
    status: formatDisposalStatus(item),
  }));

  if (loading) {
    return (
      <MainLayout variant={sidebarVariant}>
        <PageHeader title="Disposal Details" subtitle="Loading disposal request..." />
      </MainLayout>
    );
  }

  if (loadError || !disposal) {
    return (
      <MainLayout variant={sidebarVariant}>
        <PageHeader
          title="Disposal Details"
          subtitle={loadError || "Disposal request was not found."}
          actions={
            <Button variant="secondary" onClick={() => navigate(listPath)}>
              Back to Disposals
            </Button>
          }
        />
      </MainLayout>
    );
  }

  return (
    <MainLayout variant={sidebarVariant}>
      <PageHeader
        title="Disposal Request"
        subtitle={`Request #${disposal.id}`}
        actions={
          <>
            <Badge
              label={formatDisposalStatus(disposal)}
              variant={resolveDisposalBadgeVariant(disposal)}
              size="lg"
            />
            <Button variant="secondary" onClick={() => navigate(listPath)}>
              Back to Disposals
            </Button>
            <Button variant="secondary" icon="print" onClick={() => window.print()}>
              Print Form
            </Button>
            {canWriteOffDisposal(disposal) ? (
              <Button
                variant="primary"
                icon="delete_forever"
                onClick={handleWriteOff}
                disabled={writeOffLoading}
              >
                {writeOffLoading ? "Writing Off…" : "Write Off Item(s)"}
              </Button>
            ) : null}
          </>
        }
      />

      <div className="p-6 space-y-6">
        {writeOffError ? (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 no-print">
            {writeOffError}
          </div>
        ) : null}

        {canWriteOffDisposal(disposal) ? (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 no-print">
            This disposal has been approved by the registrar. Items remain in inventory until you write them off
            after the auction division has informed your department.
          </div>
        ) : null}
        <Card
          title="Disposal Summary"
          icon="info"
          className="no-print"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-text-light">Inventory</p>
              <p className="text-lg font-semibold text-text-dark mt-1">
                {formatDetailValue(disposal.sourceInventory?.location || disposal.inventory)}
              </p>
              <p className="mt-1 text-sm text-text-light">
                {formatDetailValue(disposal.sourceInventory?.department)}
              </p>
            </div>
            <div>
              <p className="text-sm text-text-light">Disposal Date</p>
              <p className="text-lg font-semibold text-text-dark mt-1">
                {formatDetailValue(disposal.disposalDate)}
              </p>
            </div>
            <div>
              <p className="text-sm text-text-light">Reason</p>
              <p className="text-lg font-semibold text-text-dark mt-1">
                {formatDisposalReason(disposal)}
              </p>
            </div>
            <div>
              <p className="text-sm text-text-light">Disposal Type</p>
              <p className="text-lg font-semibold text-text-dark mt-1">
                {formatDisposalType(disposal)}
              </p>
            </div>
            <div>
              <p className="text-sm text-text-light">Condition</p>
              <p className="text-lg font-semibold text-text-dark mt-1">
                {formatDetailValue(disposal.condition)}
              </p>
            </div>
            <div>
              <p className="text-sm text-text-light">Initiated By</p>
              <p className="text-lg font-semibold text-text-dark mt-1">
                {formatDetailValue(disposal.initiatedBy)}
              </p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-text-light">Description</p>
              <p className="text-base font-semibold text-text-dark mt-1 whitespace-pre-wrap">
                {formatDetailValue(disposal.description)}
              </p>
            </div>
          </div>
        </Card>

        {itemRows.length > 0 ? (
          <Card title="Items in this Disposal" icon="inventory_2" className="no-print">
            <Table
              columns={itemColumns}
              data={itemRows}
              searchable={itemRows.length > 5}
              paginated={itemRows.length > 10}
              itemsPerPage={10}
            />
          </Card>
        ) : null}

        <Card
          title="Official Disposal Form"
          subtitle="Unserviceable and Condemned Capital Items Form – University of Moratuwa"
          icon="description"
        >
          <DisposalSubmissionForm
            inventory={disposal.sourceInventory}
            items={disposal.formItems || []}
            disposalDate={disposal.disposalDate}
            hodApprovedDate={disposal.hodApprovedDate}
          />
        </Card>
      </div>
    </MainLayout>
  );
};

export default DisposalDetails;
