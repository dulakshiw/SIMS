import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import MainLayout from "../../../Components/Layouts/MainLayout";
import { Card, Button, Badge, PageHeader, Table, FormInput } from "../../../Components/UI";
import { resolveSidebarVariant } from "../../../utils/helpers";
import RepairSubmissionForm from "./RepairSubmissionForm";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("currentUser") || "{}");
  } catch {
    return {};
  }
};

const formatRepairStatus = (repair = {}) => {
  const approvalStatus = String(repair.approvalStatus || "").toLowerCase();
  const status = String(repair.status || "").toLowerCase();

  if (approvalStatus === "pending_hod") return "Pending HOD";
  if (approvalStatus === "pending_registrar") return "Pending Registrar";
  if (approvalStatus === "approved" && status === "in_progress") return "In Progress";
  if (approvalStatus === "approved") return "Approved";
  if (status === "submitted") return "Submitted";
  if (status === "in_progress") return "In Progress";
  if (status === "completed") return "Completed";
  if (status === "cancelled" || status === "rejected") return "Rejected";
  return (approvalStatus || status || "submitted").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

const resolveRepairBadgeVariant = (repair = {}) => {
  const approvalStatus = String(repair.approvalStatus || "").toLowerCase();
  const status = String(repair.status || "").toLowerCase();

  if (status === "completed") return "completed";
  if (status === "cancelled" || status === "rejected") return "rejected";
  if (approvalStatus === "approved" || status === "in_progress" || approvalStatus === "pending_registrar") return "info";
  return "pending";
};

const RepairDetails = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { repairId, role } = useParams();
  const sidebarVariant = resolveSidebarVariant(location.pathname, role);

  const [repair, setRepair] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [repairedBy, setRepairedBy] = useState("");
  const [repairCost, setRepairCost] = useState("");
  const [receivedDate, setReceivedDate] = useState("");
  const [receiveError, setReceiveError] = useState("");
  const [receiveMessage, setReceiveMessage] = useState("");
  const [isReceiving, setIsReceiving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [isActionLoading, setIsActionLoading] = useState(false);

  const listPath = role ? `/inventory/repairs/list/${role}` : "/inventory/repairs/list";

  const loadRepair = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");
      const response = await fetch(`${API_BASE_URL}/api/item-repairs/${repairId}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to load repair details.");
      }
      setRepair(data.repair || null);
    } catch (error) {
      setRepair(null);
      setLoadError(error.message || "Failed to load repair details.");
    } finally {
      setLoading(false);
    }
  }, [repairId]);

  useEffect(() => {
    loadRepair();
  }, [loadRepair]);

  useEffect(() => {
    if (!repair) {
      setRepairedBy("");
      setRepairCost("");
      setReceivedDate("");
      return;
    }

    setRepairedBy(repair.repairedBy || "");
    setRepairCost(repair.repairCost != null ? String(repair.repairCost) : "");
    setReceivedDate(repair.receivedDate || "");
  }, [repair]);

  const currentUser = useMemo(getStoredUser, []);
  const userRole = String(currentUser.role || "").toLowerCase();
  const repairApprovalStatus = String(repair?.approvalStatus || repair?.status || "").toLowerCase();
  const canActAsHod = repairApprovalStatus === "pending_hod" && userRole === "head_of_department";
  const canActAsRegistrar = repairApprovalStatus === "pending_registrar" && userRole === "registrar";

  const handlePrintForm = () => window.print();

  const itemRows = (repair?.items || []).map((item, index) => ({
    no: index + 1,
    itemName: item.itemName || "—",
    itemCode: item.itemCode || "—",
    serialNo: item.serialNo || "—",
    model: item.model || "—",
    quantity: item.quantity ?? 1,
  }));

  const canShowForm = Boolean(
    repair?.faultDescription?.trim()
    && (repair?.contactPersonUserId || repair?.contactPersonName)
    && (repair?.formItems?.length || repair?.items?.length)
  );

  const repairReadyForReceive = Boolean(
    repair
    && String(repair.approvalStatus || repair.status || "").toLowerCase() === "approved"
    && String(repair.status || "").toLowerCase() !== "completed"
    && String(repair.status || "").toLowerCase() !== "cancelled"
  );

  const repairCompleted = Boolean(String(repair?.status || "").toLowerCase() === "completed");

  const handleReceiveRepair = async () => {
    setReceiveError("");
    setReceiveMessage("");

    if (!repairedBy.trim()) {
      setReceiveError("Please enter the name of who repaired the item(s).");
      return;
    }
    if (!receivedDate.trim()) {
      setReceiveError("Please enter the repair received date.");
      return;
    }

    try {
      setIsReceiving(true);
      const response = await fetch(`${API_BASE_URL}/api/item-repairs/${repairId}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repairedBy: repairedBy.trim(),
          repairCost: Number(repairCost) || 0,
          receivedDate: receivedDate.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to receive the repair.");
      }
      setReceiveMessage(data.message || "Repair received successfully.");
      await loadRepair();
    } catch (error) {
      setReceiveError(error.message || "Failed to receive the repair.");
    } finally {
      setIsReceiving(false);
    }
  };

  const handleRepairAction = async ({ endpoint, method = "POST", body = {} }) => {
    setActionError("");
    setActionMessage("");
    setReceiveError("");
    setReceiveMessage("");

    try {
      setIsActionLoading(true);
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Unable to complete this action.");
      }

      setActionMessage(data.message || "Action completed successfully.");
      await loadRepair();
    } catch (error) {
      setActionError(error.message || "Unable to complete this action.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleApproveHod = async () => {
    await handleRepairAction({
      endpoint: `/api/item-repairs/${repairId}/approve-hod`,
      body: { approverUserId: Number(currentUser.id ?? 0) },
    });
  };

  const handleRejectHod = async () => {
    const reason = window.prompt("Enter rejection reason for this repair request:", "Rejected by Head of Department");
    if (reason === null) return;
    await handleRepairAction({
      endpoint: `/api/item-repairs/${repairId}/reject-hod`,
      body: {
        approverUserId: Number(currentUser.id ?? 0),
        reason: String(reason || "Rejected by Head of Department").trim(),
      },
    });
  };

  const handleApproveRegistrar = async () => {
    await handleRepairAction({
      endpoint: `/api/item-repairs/${repairId}/approve-registrar`,
      body: { approverUserId: Number(currentUser.id ?? 0) },
    });
  };

  const handleRejectRegistrar = async () => {
    const reason = window.prompt("Enter rejection reason for this repair request:", "Rejected by Registrar");
    if (reason === null) return;
    await handleRepairAction({
      endpoint: `/api/item-repairs/${repairId}/reject`,
      body: { reason: String(reason || "Rejected by Registrar").trim() },
    });
  };

  const contactPersonLabel = [
    repair?.contactPersonName,
    repair?.contactPersonExtension ? `(Ext: ${repair.contactPersonExtension})` : "",
  ].filter(Boolean).join(" ");

  return (
    <MainLayout variant={sidebarVariant}>
      <PageHeader
        title={`Repair #${repairId}`}
        subtitle="View repair details and print the official form."
        actions={<Button variant="secondary" onClick={() => navigate(listPath)}>Back to Repairs</Button>}
      />

      <div className="p-6 space-y-6">
        {loadError ? <p className="text-sm text-error">{loadError}</p> : null}

        {loading ? (
          <p className="text-sm text-text-light">Loading repair details...</p>
        ) : repair ? (
          <>
            <Card title="Repair Summary" icon="handyman">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <p><span className="text-text-light">Status:</span> <Badge variant={resolveRepairBadgeVariant(repair)}>{formatRepairStatus(repair)}</Badge></p>
                <p><span className="text-text-light">Inventory:</span> {repair.inventory?.name || repair.inventory?.location || "—"}</p>
                <p><span className="text-text-light">Department:</span> {repair.inventory?.department || "—"}</p>
                <p><span className="text-text-light">Submitted Date:</span> {repair.repairDate || "—"}</p>
                <p><span className="text-text-light">Initiated By:</span> {repair.initiatedBy || "—"}</p>
                <p><span className="text-text-light">Contact Person:</span> {contactPersonLabel || "—"}</p>
              </div>
            </Card>

            <Card title="Repair Details" icon="edit_note">
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-text-light mb-1">Nature of Damage</p>
                  <p className="whitespace-pre-wrap">{repair.faultDescription || "—"}</p>
                </div>
                {repair.repairNotes ? (
                  <div>
                    <p className="text-text-light mb-1">Additional Notes</p>
                    <p className="whitespace-pre-wrap">{repair.repairNotes}</p>
                  </div>
                ) : null}
                {(repair.hodApprovedDate || repair.registrarApprovedDate || repair.rejectionReason) ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    {repair.hodApprovedDate ? (
                      <p><span className="text-text-light">HOD Recommended:</span> {repair.hodApprovedDate}</p>
                    ) : null}
                    {repair.registrarApprovedDate ? (
                      <p><span className="text-text-light">Registrar Approved:</span> {repair.registrarApprovedDate}</p>
                    ) : null}
                    {repair.rejectionReason ? (
                      <p className="md:col-span-2"><span className="text-text-light">Rejection Reason:</span> {repair.rejectionReason}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </Card>

            <Card title="Items" icon="inventory_2">
              <Table
                columns={[
                  { field: "no", label: "No.", sortable: false },
                  { field: "itemName", label: "Item Name", sortable: true },
                  { field: "itemCode", label: "Item Code", sortable: true },
                  { field: "serialNo", label: "Serial No.", sortable: true },
                  { field: "model", label: "Model", sortable: true },
                  { field: "quantity", label: "Qty", sortable: false },
                ]}
                data={itemRows}
                searchable={false}
                paginated={itemRows.length > 10}
                itemsPerPage={10}
              />
            </Card>

            {canShowForm ? (
              <Card
                title="Equipment Repair Requisition Form"
                icon="description"
                actions={<Button variant="secondary" icon="print" onClick={handlePrintForm}>Print Form</Button>}
              >
                <RepairSubmissionForm
                  inventory={repair.inventory || {}}
                  items={repair.formItems || repair.items || []}
                  repairDate={repair.repairDate}
                  faultDescription={repair.faultDescription}
                  officerName={repair.initiatedBy || repair.inventory?.incharge || "—"}
                  officerMobileNo={repair.officerMobileNo || ""}
                  officerExtensionNo={repair.officerExtensionNo || ""}
                  contactPersonName={repair.contactPersonName || ""}
                  contactPersonExtension={repair.contactPersonExtension || ""}
                  contactPersonLocation={repair.contactPersonLocation || ""}
                />
              </Card>
            ) : (
              <Card title="Equipment Repair Requisition Form" icon="description">
                <p className="text-sm text-text-light">
                  The repair form is unavailable because required details are missing from this record.
                </p>
              </Card>
            )}

            {(canActAsHod || canActAsRegistrar) ? (
              <Card title="Approval Actions" icon="verified_user">
                <div className="space-y-4 text-sm">
                  {actionError ? <p className="text-sm text-error">{actionError}</p> : null}
                  {actionMessage ? <p className="text-sm text-success">{actionMessage}</p> : null}
                  <p className="text-sm text-text-light">
                    {canActAsHod
                      ? "Recommend or reject this repair request for registrar approval."
                      : "Approve or reject this repair request on behalf of the registrar."
                    }
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {canActAsHod ? (
                      <>
                        <Button variant="primary" loading={isActionLoading} onClick={handleApproveHod}>
                          Recommend to Registrar
                        </Button>
                        <Button variant="danger" onClick={handleRejectHod} disabled={isActionLoading}>
                          Reject Request
                        </Button>
                      </>
                    ) : null}
                    {canActAsRegistrar ? (
                      <>
                        <Button variant="primary" loading={isActionLoading} onClick={handleApproveRegistrar}>
                          Approve Repair
                        </Button>
                        <Button variant="danger" onClick={handleRejectRegistrar} disabled={isActionLoading}>
                          Reject Repair
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              </Card>
            ) : null}

            {repairReadyForReceive && !repairCompleted ? (
              <Card title="Receive Repaired Item(s)" icon="inventory_2">
                <div className="space-y-4">
                  {receiveError ? <p className="text-sm text-error">{receiveError}</p> : null}
                  {receiveMessage ? <p className="text-sm text-success">{receiveMessage}</p> : null}

                  <FormInput
                    label="Repaired By"
                    name="repairedBy"
                    value={repairedBy}
                    onChange={(event) => setRepairedBy(event.target.value)}
                    placeholder="Enter the technician or vendor name"
                    required
                  />

                  <FormInput
                    label="Repair Cost"
                    name="repairCost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={repairCost}
                    onChange={(event) => setRepairCost(event.target.value)}
                    placeholder="0.00"
                  />

                  <FormInput
                    label="Received Date"
                    name="receivedDate"
                    type="date"
                    value={receivedDate}
                    onChange={(event) => setReceivedDate(event.target.value)}
                    required
                  />

                  <div className="flex flex-wrap gap-3">
                    <Button variant="primary" loading={isReceiving} onClick={handleReceiveRepair}>
                      Receive Repair
                    </Button>
                    <Button variant="secondary" onClick={() => setReceiveError("")} disabled={isReceiving}>
                      Reset
                    </Button>
                  </div>
                </div>
              </Card>
            ) : null}
          </>
        ) : null}
      </div>
    </MainLayout>
  );
};

export default RepairDetails;
