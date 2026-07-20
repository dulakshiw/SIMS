import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import MainLayout from "../../../Components/Layouts/MainLayout";
import { Card, Button, Badge, PageHeader, Table } from "../../../Components/UI";
import { resolveSidebarVariant } from "../../../utils/helpers";
import { TRANSFER_STATUS } from "../../../utils/constants";
import TransferSubmissionForm from "./TransferSubmissionForm";

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

const resolveCurrentUserId = (user = {}) =>
  Number(user?.id ?? user?.userId ?? user?.user_id ?? 0);

const isAwaitingHodRecommendation = (statusKey = "") =>
  statusKey === "pending_hod" || statusKey === "pending_staff";

const formatTransferStatus = (transfer) => {
  const safeTransfer = transfer ?? {};
  const statusKey = String(safeTransfer.approvalStatus || safeTransfer.status || "pending").toLowerCase();
  if (statusKey === "pending_registrar") {
    return "Pending registrar approval Part A";
  }
  if (statusKey === "registrar_approved_part_a") {
    return "Registrar Approved Part A";
  }
  if (statusKey === "pending_destination_inventory") {
    return "Pending (destination) inventory";
  }
  if (statusKey === "pending_registrar_part_b") {
    return "Pending registrar approval Part B";
  }
  if (statusKey === "registrar_approved" || statusKey === "pending_admin") {
    return "Registrar Approved";
  }
  if (isAwaitingHodRecommendation(statusKey)) {
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

const canCancelTransfer = (transfer, currentUser = {}) => {
  if (!transfer) {
    return false;
  }

  const statusKey = String(transfer.approvalStatus || transfer.status || "pending").toLowerCase();
  if (!isAwaitingHodRecommendation(statusKey)) {
    return false;
  }

  const currentUserId = resolveCurrentUserId(currentUser);
  const initiatorId = Number(transfer.initiatedById ?? 0);
  const sourceInchargeId = Number(transfer.sourceInventory?.inchargeId ?? 0);

  return currentUserId > 0 && (currentUserId === initiatorId || currentUserId === sourceInchargeId);
};

const canCompleteTransfer = (transfer, currentUser = {}) => {
  if (!transfer) {
    return false;
  }

  const statusKey = String(transfer.approvalStatus || transfer.status || "pending").toLowerCase();
  const completableStatuses = new Set(["pending_destination_inventory"]);
  if (!completableStatuses.has(statusKey)) {
    return false;
  }

  const currentUserId = resolveCurrentUserId(currentUser);
  const destinationInchargeId = Number(
    transfer.destinationInventory?.inchargeId
    ?? transfer.destinationInventory?.inchargeUserId
    ?? transfer.destinationInventory?.incharge_user_id
    ?? 0
  );
  return currentUserId > 0 && destinationInchargeId > 0 && currentUserId === destinationInchargeId;
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
  if (["approved", "in-transit", "registrar_approved", "pending_admin", "pending_registrar", "pending_registrar_part_b", "registrar_approved_part_a"].includes(statusKey)) {
    return "info";
  }
  return "pending";
};

const formatDetailValue = (value) => {
  const normalized = String(value ?? "").trim();
  return normalized || "—";
};

const TransferDetails = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { transferId, role } = useParams();
  const sidebarVariant = resolveSidebarVariant(location.pathname, role);
  const [transfer, setTransfer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [completeError, setCompleteError] = useState("");
  const [isCompleting, setIsCompleting] = useState(false);
  const [linePageNos, setLinePageNos] = useState({});
  const [currentUser] = useState(getStoredUser);

  const listPath = role ? `/inventory/transfers/list/${role}` : "/inventory/transfers/list";
  const canCancel = useMemo(
    () => canCancelTransfer(transfer, currentUser),
    [transfer, currentUser]
  );
  const canComplete = useMemo(
    () => canCompleteTransfer(transfer, currentUser),
    [transfer, currentUser]
  );

  useEffect(() => {
    let isMounted = true;

    const loadTransfer = async () => {
      try {
        setLoading(true);
        setLoadError("");

        const response = await fetch(`${API_BASE_URL}/api/item-transfers/${transferId}`);
        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
          throw new Error(data.message || data.error || "Failed to load transfer details.");
        }

        if (isMounted) {
          const transferData = data.transfer || null;
          setTransfer(transferData);
          const nextLinePageNos = {};
          (transferData?.items || []).forEach((item) => {
            const lineId = Number(item.transferLineId ?? 0);
            if (lineId > 0) {
              nextLinePageNos[lineId] = String(item.inventoryPageNo || "").trim();
            }
          });
          setLinePageNos(nextLinePageNos);
        }
      } catch (error) {
        if (isMounted) {
          setTransfer(null);
          setLoadError(error.message || "Failed to load transfer details.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (transferId) {
      loadTransfer();
    } else {
      setLoading(false);
      setLoadError("Transfer id is missing.");
    }

    return () => {
      isMounted = false;
    };
  }, [transferId]);

  const statusLabel = useMemo(
    () => (transfer ? formatTransferStatus(transfer) : "Pending"),
    [transfer]
  );

  const itemRows = useMemo(
    () =>
      (transfer?.items || []).map((item) => ({
        id: `TRF-${item.transferLineId}`,
        item: item.itemName || "—",
        quantity: item.quantity ?? 1,
        status: formatTransferStatus(item),
      })),
    [transfer]
  );

  const itemColumns = [
    { field: "id", label: "Line ID", sortable: true },
    { field: "item", label: "Item", sortable: true },
    { field: "quantity", label: "Qty", sortable: true },
    { field: "status", label: "Status", sortable: true },
  ];

  const handlePrintForm = () => {
    window.print();
  };

  const handleCancelTransfer = async () => {
    if (!transfer || !canCancel) {
      return;
    }

    const confirmed = window.confirm(
      "Cancel this transfer request before HOD recommendation? The selected items will become available for transfer again."
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsCancelling(true);
      setCancelError("");

      const response = await fetch(`${API_BASE_URL}/api/item-transfers/${transfer.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initiatedById: resolveCurrentUserId(currentUser),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to cancel transfer request.");
      }

      navigate(listPath);
    } catch (error) {
      setCancelError(error.message || "Failed to cancel transfer request.");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleCompleteTransfer = async () => {
    if (!transfer || !canComplete) {
      return;
    }

    const confirmed = window.confirm(
      "Confirm that you have added these items to the destination inventory and complete this transfer?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsCompleting(true);
      setCompleteError("");

      const normalizedLinePageNos = {};
      for (const item of transfer.items || []) {
        const lineId = Number(item.transferLineId ?? 0);
        if (!lineId) {
          continue;
        }
        const value = String(linePageNos[lineId] || "").trim();
        if (!value) {
          throw new Error(`Inventory page no is required for line TRF-${lineId}.`);
        }
        normalizedLinePageNos[lineId] = value;
      }

      const response = await fetch(`${API_BASE_URL}/api/item-transfers/${transfer.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverUserId: resolveCurrentUserId(currentUser),
          linePageNos: normalizedLinePageNos,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to complete transfer.");
      }

      setTransfer((prev) => (prev
        ? {
          ...prev,
          status: "pending_registrar_part_b",
          approvalStatus: "pending_registrar_part_b",
          completedDate: new Date().toISOString().split("T")[0],
          items: (prev.items || []).map((item) => ({
            ...item,
            status: "pending_registrar_part_b",
            approvalStatus: "pending_registrar_part_b",
            inventoryPageNo: data.linePageNos?.[item.transferLineId] || normalizedLinePageNos[item.transferLineId] || item.inventoryPageNo || "",
          })),
          formItems: (prev.formItems || []).map((item) => ({
            ...item,
            pageno: item.pageno,
            pageNo: item.pageNo,
          })),
        }
        : prev));
    } catch (error) {
      setCompleteError(error.message || "Failed to complete transfer.");
    } finally {
      setIsCompleting(false);
    }
  };

  if (loading) {
    return (
      <MainLayout variant={sidebarVariant}>
        <div className="p-6 text-sm text-text-light">Loading transfer details…</div>
      </MainLayout>
    );
  }

  if (loadError || !transfer) {
    return (
      <MainLayout variant={sidebarVariant}>
        <div className="p-6 space-y-4">
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {loadError || "Transfer request was not found."}
          </div>
          <Button variant="secondary" icon="arrow_back" onClick={() => navigate(listPath)}>
            Back to Transfer List
          </Button>
        </div>
      </MainLayout>
    );
  }

  const displayTransferId = transfer.transferIds?.length > 1
    ? `TRF-${transfer.transferIds.join(", TRF-")}`
    : `TRF-${transfer.id}`;

  return (
    <MainLayout variant={sidebarVariant}>
      <PageHeader
        title={`Transfer Request ${displayTransferId}`}
        subtitle="Internal inventory transfer — official submission form (Part A)"
        actions={(
          <Badge
            label={statusLabel}
            variant={resolveTransferBadgeVariant(transfer)}
            size="lg"
          />
        )}
      />

      <div className="p-6 space-y-6">
        {cancelError ? (
          <div className="no-print rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {cancelError}
          </div>
        ) : null}
        {completeError ? (
          <div className="no-print rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {completeError}
          </div>
        ) : null}

        <div className="no-print flex flex-wrap gap-3">
          <Button variant="secondary" icon="arrow_back" onClick={() => navigate(listPath)}>
            Back to Transfer List
          </Button>
          {canComplete ? (
            <div className="w-full rounded-lg border border-border-light p-3">
              <p className="text-sm font-semibold text-text-dark mb-2">Destination Inventory Page No (per item)</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(transfer.items || []).map((item) => {
                  const lineId = Number(item.transferLineId ?? 0);
                  return (
                    <div key={`line-page-${lineId}`}>
                      <label className="block text-xs font-semibold text-text-light mb-1">
                        {`TRF-${lineId} • ${item.itemName || "Item"}`}
                      </label>
                      <input
                        type="text"
                        value={linePageNos[lineId] || ""}
                        onChange={(event) => setLinePageNos((prev) => ({ ...prev, [lineId]: event.target.value }))}
                        placeholder="Enter destination page no"
                        className="w-full rounded-md border border-border-light px-3 py-2 text-sm"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
          {canCancel ? (
            <Button
              variant="secondary"
              icon="cancel"
              onClick={handleCancelTransfer}
              loading={isCancelling}
              disabled={isCancelling}
            >
              Cancel Transfer Request
            </Button>
          ) : null}
          {canComplete ? (
            <Button
              variant="primary"
              icon="task_alt"
              onClick={handleCompleteTransfer}
              loading={isCompleting}
              disabled={isCompleting}
            >
              Add To Inventory
            </Button>
          ) : null}
          <Button variant="primary" icon="print" onClick={handlePrintForm}>
            Print Transfer Form
          </Button>
        </div>

        <Card
          title="Transfer Summary"
          subtitle="Internal transfer between university inventories. No gate pass is required."
          icon="info"
          className="no-print"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-text-light">From Inventory</p>
              <p className="text-lg font-semibold text-text-dark mt-1">
                {formatDetailValue(transfer.sourceInventory?.location || transfer.fromInventory)}
              </p>
              <p className="mt-1 text-sm text-text-light">
                {formatDetailValue(transfer.sourceInventory?.department)}
              </p>
            </div>
            <div>
              <p className="text-sm text-text-light">To Inventory</p>
              <p className="text-lg font-semibold text-text-dark mt-1">
                {formatDetailValue(transfer.destinationInventory?.location || transfer.toInventory)}
              </p>
              <p className="mt-1 text-sm text-text-light">
                {formatDetailValue(transfer.destinationInventory?.department)}
              </p>
            </div>
            <div>
              <p className="text-sm text-text-light">Transfer Date</p>
              <p className="text-lg font-semibold text-text-dark mt-1">
                {formatDetailValue(transfer.transferDate)}
              </p>
            </div>
            <div>
              <p className="text-sm text-text-light">Initiated By</p>
              <p className="text-lg font-semibold text-text-dark mt-1">
                {formatDetailValue(transfer.initiatedBy)}
              </p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-text-light">Reason</p>
              <p className="text-base font-semibold text-text-dark mt-1 whitespace-pre-wrap">
                {formatDetailValue(transfer.reason)}
              </p>
            </div>
          </div>
        </Card>

        {itemRows.length > 0 ? (
          <Card title="Items in this Transfer" icon="inventory_2" className="no-print">
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
          title="Part A – Official Transfer Form"
          subtitle="University of Moratuwa internal inventory transfer submission form"
          icon="description"
        >
          <TransferSubmissionForm
            sourceInventory={transfer.sourceInventory}
            destinationInventory={transfer.destinationInventory}
            transferDate={transfer.transferDate}
            items={transfer.formItems || []}
            issuedByName={transfer.issuedByName}
            issuedByPost={transfer.issuedByPost}
            hodApprovedBy={transfer.hodApprovedBy}
            hodDepartmentName={transfer.hodDepartmentName}
            hodApprovedDate={transfer.hodApprovedDate}
            registrarApprovedBy={transfer.registrarApprovedBy}
            registrarApprovedDate={transfer.registrarApprovedDate}
            showPartB={["pending_destination_inventory", "pending_registrar_part_b", "completed"].includes(String(transfer.approvalStatus || transfer.status || "").toLowerCase())}
            receivedDate={transfer.completedDate}
            receivedByName={transfer.destinationInventory?.incharge || ""}
            receiverPost="Inventory Officer"
            receivedInventoryPageNo={transfer.receivedInventoryPageNo || ""}
            partBItems={(transfer.items || []).map((item) => ({
              itemName: item.itemName,
              itemCode: item.itemCode,
              serialNo: item.serialNo,
              model: item.model,
              brand: item.brand,
              value: item.value,
              ginNo: item.ginNo,
              pageno: item.inventoryPageNo || item.pageno || item.pageNo || "",
              pageNo: item.inventoryPageNo || item.pageno || item.pageNo || "",
              quantity: item.quantity,
            }))}
          />
        </Card>
      </div>
    </MainLayout>
  );
};

export default TransferDetails;
