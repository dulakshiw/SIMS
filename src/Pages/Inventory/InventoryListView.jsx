import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import MainLayout from "../../Components/Layouts/MainLayout";
import { Card, Button, SearchBox, Table, Badge, PageHeader, Modal } from "../../Components/UI";
import {
  ITEM_STATUS,
  INVENTORY_REQUEST_STATUS_META,
  INVENTORY_REQUEST_TYPE,
  INVENTORY_REQUEST_TYPE_LABELS,
} from "../../utils/constants";

const ALLOWED_INCHARGE_DESIGNATIONS = new Set(["Technical Officer", "Management Assistant"]);
import { resolveSidebarVariant } from "../../utils/helpers";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("currentUser") || "{}");
  } catch {
    return {};
  }
};

const resolveUserId = (user = {}) => Number(user.id ?? user.user_id ?? user.userId ?? 0);

const InventoryListView = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [inventories, setInventories] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedPendingRequest, setSelectedPendingRequest] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTargetInventory, setAssignTargetInventory] = useState(null);
  const [officerCandidates, setOfficerCandidates] = useState([]);
  const [proposedOfficerId, setProposedOfficerId] = useState("");
  const [assignReason, setAssignReason] = useState("");
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignError, setAssignError] = useState("");
  const [assignOptionsLoading, setAssignOptionsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useParams();
  const sidebarVariant = resolveSidebarVariant(location.pathname, role);
  const [currentUser, setCurrentUser] = useState(getStoredUser);
  const params = new URLSearchParams(location.search);
  const selectedInventoryId = Number(params.get("inventoryId") ?? 0);
  const isMyInventoriesPath = location.pathname.includes("/inventory/list/incharge");
  const isInchargeView =
    isMyInventoriesPath || role === "incharge" || currentUser.role === "inventory_incharge";
  const currentUserId = resolveUserId(currentUser);

  useEffect(() => {
    setCurrentUser(getStoredUser());
  }, [location.pathname]);

  const loadInchargeData = useCallback(async (isMountedRef) => {
    if (!currentUserId) {
      return;
    }

    const requestParams = new URLSearchParams({
      pendingOnly: "true",
      inchargeUserId: String(currentUserId),
      requestedByUserId: String(currentUserId),
    });

    const [inventoriesResponse, requestsResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/api/inventories`),
      fetch(`${API_BASE_URL}/api/inventory-creation-requests?${requestParams.toString()}`),
    ]);

    const [inventoriesData, requestsData] = await Promise.all([
      inventoriesResponse.json(),
      requestsResponse.json(),
    ]);

    if (!inventoriesResponse.ok || !inventoriesData.success) {
      throw new Error(inventoriesData.error || inventoriesData.message || "Failed to load assigned inventories.");
    }

    if (!requestsResponse.ok || !requestsData.success) {
      throw new Error(requestsData.error || requestsData.message || "Failed to load pending inventory requests.");
    }

    if (!isMountedRef.current) {
      return;
    }

    const assignedInventories = (inventoriesData.inventories || []).filter(
      (inventory) => String(inventory.inchargeId) === String(currentUserId)
    );
    setInventories(assignedInventories);
    setPendingRequests(requestsData.requests || []);

    if (selectedInventoryId > 0) {
      const itemsResponse = await fetch(`${API_BASE_URL}/api/items?inventoryId=${selectedInventoryId}`);
      const itemsData = await itemsResponse.json();

      if (!itemsResponse.ok || !itemsData.success) {
        throw new Error(itemsData.error || itemsData.message || "Failed to load inventory items.");
      }

      if (isMountedRef.current) {
        setItems(itemsData.items || []);
      }
    } else if (isMountedRef.current) {
      setItems([]);
    }
  }, [currentUserId, selectedInventoryId]);

  useEffect(() => {
    const isMountedRef = { current: true };

    const loadData = async () => {
      try {
        setLoading(true);
        setError("");

        if (isInchargeView) {
          await loadInchargeData(isMountedRef);
          return;
        }

        setInventories([]);
        setPendingRequests([]);
        setItems([
          {
            id: 1,
            itemName: "Laptop Dell XPS 13",
            itemCode: "LAP-001",
            status: "available",
            location: "Room 101",
            updated_at: "2024-01-15",
          },
          {
            id: 2,
            itemName: "Office Chair",
            itemCode: "CHR-002",
            status: "in-use",
            location: "Room 102",
            updated_at: "2024-01-10",
          },
          {
            id: 3,
            itemName: "Printer HP M433",
            itemCode: "PRN-003",
            status: "maintenance",
            location: "Storage",
            updated_at: "2024-01-12",
          },
        ]);
      } catch (loadError) {
        if (isMountedRef.current) {
          setError(loadError.message || "Failed to load inventory data.");
          setInventories([]);
          setPendingRequests([]);
          setItems([]);
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    };

    loadData();

    const handleFocus = () => {
      if (isInchargeView) {
        loadInchargeData(isMountedRef).catch(() => {});
      }
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener("focus", handleFocus);
    };
  }, [isInchargeView, loadInchargeData, selectedInventoryId]);

  const itemColumns = [
    { field: "no", label: "No", sortable: false },
    { field: "name", label: "Item Name", sortable: true },
    { field: "itemCode", label: "Item Code", sortable: true },
    { field: "location", label: "Location", sortable: true },
    { field: "lastUpdated", label: "Last Updated", sortable: true },
    {
      field: "status",
      label: "Status",
      render: (value) => {
        const statusObj = ITEM_STATUS.find((s) => s.value === value);
        return <Badge label={statusObj?.label || value || "-"} variant={statusObj?.color || "primary"} />;
      },
    },
  ];

  const inventoryColumns = [
    { field: "name", label: "Inventory Name", sortable: true },
    { field: "location", label: "Location", sortable: true },
    { field: "department", label: "Department", sortable: true },
    { field: "itemCount", label: "Items", sortable: true },
    {
      field: "status",
      label: "Status",
      render: (value, row) => {
        if (row.listType === "pending_request") {
          const statusKey = String(value || "").toLowerCase();
          const meta = INVENTORY_REQUEST_STATUS_META[statusKey] || {
            label: value || "Pending",
            variant: "warning",
          };
          return <Badge label={meta.label} variant={meta.variant} />;
        }

        return (
          <Badge
            label={String(value || "active").charAt(0).toUpperCase() + String(value || "active").slice(1)}
            variant={value === "active" ? "success" : "warning"}
          />
        );
      },
    },
  ];

  const viewingInventoryItems = isInchargeView && selectedInventoryId > 0;
  const selectedInventory =
    inventories.find((inventory) => Number(inventory.id) === selectedInventoryId) || null;

  const inventoryListRows = useMemo(() => {
    const pendingRows = pendingRequests.map((request) => ({
      id: `req-${request.id}`,
      requestId: request.id,
      listType: "pending_request",
      name: request.name,
      location: request.location || "—",
      department: request.department || "—",
      itemCount: "—",
      status: request.approvalStatus,
      requestedDate: request.requestedDate,
      requestType: request.requestType,
      reason: request.reason,
      _request: request,
    }));

    const assignedRows = inventories.map((inventory) => ({
      id: inventory.id,
      listType: "assigned",
      name: inventory.name,
      location: inventory.location || "—",
      department: inventory.department || "—",
      itemCount: Number(inventory.itemCount || 0),
      status: inventory.status || "active",
    }));

    return [...pendingRows, ...assignedRows];
  }, [inventories, pendingRequests]);

  const filteredInventories = inventoryListRows.filter((row) =>
    `${row.name} ${row.location} ${row.department}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const normalizedItems = items.map((item) => ({
    ...item,
    name: item.itemName || item.item_name || item.name || "-",
    itemCode: item.itemCode || item.item_code || "",
    location: item.location || "-",
    status: item.status || "available",
    lastUpdated: (() => {
      const dateValue = item.updated_at || item.created_at;
      if (!dateValue) {
        return "-";
      }
      const parsed = new Date(dateValue);
      return Number.isNaN(parsed.getTime()) ? "-" : parsed.toISOString().split("T")[0];
    })(),
  }));

  const filteredItems = normalizedItems
    .filter((item) =>
      `${item.name} ${item.itemCode || ""} ${item.location || ""} ${item.status || ""}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
    )
    .sort(
      (left, right) =>
        Number(right.id ?? right.item_id ?? 0) - Number(left.id ?? left.item_id ?? 0)
    )
    .map((item, index, array) => ({
      ...item,
      no: array.length - index,
    }));

  const handleItemRowClick = (row) => {
    navigate(`/inventory/item/${row.id}/${role || sidebarVariant}`);
  };

  const hasPendingOfficerChange = useCallback(
    (inventoryId) => pendingRequests.some(
      (request) => request.requestType === INVENTORY_REQUEST_TYPE.CHANGE_INCHARGE
        && Number(request.targetInventoryId) === Number(inventoryId)
        && !["rejected", "approved_by_admin", "completed"].includes(String(request.approvalStatus || "").toLowerCase())
    ),
    [pendingRequests]
  );

  const loadOfficerCandidates = async (inventory) => {
    setAssignOptionsLoading(true);
    setAssignError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/users`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || "Failed to load staff members.");
      }

      const departmentKey = String(inventory.department || "").trim().toLowerCase();
      const assignedInchargeIds = new Set(
        (inventories || [])
          .map((entry) => Number(entry.inchargeId))
          .filter((id) => Number.isInteger(id) && id > 0)
      );

      const candidates = (data.users || []).filter((user) => {
        const userDepartment = String(user.department || user.departmentName || "").trim().toLowerCase();
        const designation = String(user.designation || "").trim();
        const userId = resolveUserId(user);

        return user.status === "active"
          && ["staff", "inventory_incharge"].includes(String(user.role || "").toLowerCase())
          && ALLOWED_INCHARGE_DESIGNATIONS.has(designation)
          && userDepartment === departmentKey
          && userId !== currentUserId
          && !assignedInchargeIds.has(userId);
      });

      setOfficerCandidates(candidates);
    } catch (loadError) {
      setOfficerCandidates([]);
      setAssignError(loadError.message || "Failed to load officer candidates.");
    } finally {
      setAssignOptionsLoading(false);
    }
  };

  const openAssignOfficerModal = (row) => {
    const inventory = inventories.find((entry) => Number(entry.id) === Number(row.id));

    if (!inventory) {
      return;
    }

    if (hasPendingOfficerChange(inventory.id)) {
      window.alert("A change of inventory officer is already pending approval for this inventory.");
      return;
    }

    setAssignTargetInventory(inventory);
    setProposedOfficerId("");
    setAssignReason("");
    setAssignError("");
    setAssignModalOpen(true);
    loadOfficerCandidates(inventory);
  };

  const resetAssignOfficerModal = () => {
    setAssignModalOpen(false);
    setAssignTargetInventory(null);
    setProposedOfficerId("");
    setAssignReason("");
    setAssignError("");
    setOfficerCandidates([]);
  };

  const closeAssignOfficerModal = () => {
    if (assignSubmitting) {
      return;
    }
    resetAssignOfficerModal();
  };

  const submitAssignOfficerRequest = async () => {
    if (!assignTargetInventory || !currentUserId) {
      return;
    }

    const nextOfficerId = Number(proposedOfficerId);

    if (!Number.isInteger(nextOfficerId) || nextOfficerId <= 0) {
      setAssignError("Select a new inventory officer.");
      return;
    }

    if (!assignReason.trim()) {
      setAssignError("Provide a reason for this change.");
      return;
    }

    try {
      setAssignSubmitting(true);
      setAssignError("");

      const response = await fetch(`${API_BASE_URL}/api/inventory-creation-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestType: INVENTORY_REQUEST_TYPE.CHANGE_INCHARGE,
          requestedById: currentUserId,
          targetInventoryId: assignTargetInventory.id,
          inchargeId: nextOfficerId,
          reason: assignReason.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to submit officer change request.");
      }

      resetAssignOfficerModal();
      await loadInchargeData({ current: true });
      window.alert(data.message || "Request submitted to your Head of Department for recommendation.");
    } catch (submitError) {
      setAssignError(submitError.message || "Failed to submit officer change request.");
    } finally {
      setAssignSubmitting(false);
    }
  };

  const inventoryActions = [
    {
      label: "Open Items",
      icon: "inventory_2",
      onClick: (row) => navigate(`/inventory/list/incharge?inventoryId=${row.id}`),
    },
    {
      label: "Add Item",
      icon: "add_circle",
      onClick: (row) => navigate(`/inventory/add/incharge?inventoryId=${row.id}`),
    },
    {
      label: "Assign Officer",
      icon: "person_add",
      onClick: (row) => openAssignOfficerModal(row),
    },
  ];

  const openPendingDetail = (row) => {
    if (row.listType !== "pending_request" || !row._request) {
      return;
    }
    setSelectedPendingRequest(row._request);
    setIsDetailModalOpen(true);
  };

  const closePendingDetail = () => {
    setIsDetailModalOpen(false);
    setSelectedPendingRequest(null);
  };

  const getInventoryRowActions = (row) => {
    if (row.listType === "pending_request") {
      return [
        {
          label: "View details",
          icon: "visibility",
          onClick: () => openPendingDetail(row),
        },
      ];
    }
    return inventoryActions;
  };

  const pendingDetailFields = selectedPendingRequest
    ? [
      {
        label: "Request type",
        value: INVENTORY_REQUEST_TYPE_LABELS[selectedPendingRequest.requestType] || selectedPendingRequest.requestType,
      },
      { label: "Inventory name", value: selectedPendingRequest.name },
      { label: "Department", value: selectedPendingRequest.department },
      { label: "Location", value: selectedPendingRequest.location },
      ...(selectedPendingRequest.requestType === INVENTORY_REQUEST_TYPE.CHANGE_INCHARGE
        ? [
          { label: "Current officer", value: selectedPendingRequest.previousInchargeName || currentUser.name || "—" },
          { label: "Proposed officer", value: selectedPendingRequest.inchargeName || "—" },
        ]
        : []),
      { label: "Requested date", value: selectedPendingRequest.requestedDate },
      {
        label: "Status",
        value: (INVENTORY_REQUEST_STATUS_META[selectedPendingRequest.approvalStatus] || {}).label
          || selectedPendingRequest.approvalStatus,
      },
      { label: "Reason", value: selectedPendingRequest.reason || "—", fullWidth: true },
    ]
    : [];

  const stats = isInchargeView && !viewingInventoryItems
    ? {
        pending: pendingRequests.length,
        assigned: inventories.length,
        items: inventories.reduce((sum, inventory) => sum + Number(inventory.itemCount || 0), 0),
      }
    : {
        items: filteredItems.length,
        available: filteredItems.filter((item) => item.status === "available").length,
        inUse: filteredItems.filter((item) => item.status === "in-use").length,
        maintenance: filteredItems.filter((item) => item.status === "maintenance").length,
      };

  return (
    <MainLayout variant={sidebarVariant}>
      <PageHeader
        title={
          isInchargeView && !viewingInventoryItems
            ? "My Inventories"
            : selectedInventory
              ? `${selectedInventory.name} Items`
              : viewingInventoryItems
                ? "Inventory Items"
                : "Inventory Items"
        }
        subtitle={
          isInchargeView && !viewingInventoryItems
            ? "Pending requests stay here until approved. Use Assign Officer to request a new inventory officer (HOD recommendation, then administrator approval)."
            : viewingInventoryItems
              ? selectedInventory
                ? `Items in ${selectedInventory.name} at ${selectedInventory.location || "your assigned location"}.`
                : "Loading inventory items..."
              : "Manage your inventory items"
        }
        actions={
          isInchargeView && !viewingInventoryItems ? null : (
            <Button
              icon="add_circle"
              variant="primary"
              onClick={() => navigate(selectedInventory ? `/inventory/add/${role || sidebarVariant}?inventoryId=${selectedInventory.id}` : `/inventory/add/${role || sidebarVariant}`)}
            >
              Add New Item
            </Button>
          )
        }
      />

      <div className="p-6 space-y-6">
        {error && (
          <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {viewingInventoryItems && (
          <Button variant="secondary" onClick={() => navigate('/inventory/list/incharge')}>
            Back To My Inventories
          </Button>
        )}

        <div className="flex gap-4">
          <div className="flex-1">
            <SearchBox
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder={isInchargeView && !viewingInventoryItems ? "Search inventories..." : "Search items..."}
            />
          </div>
        </div>

        {isInchargeView && !viewingInventoryItems ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card title="Pending activation" icon="hourglass_top">
              <p className="text-3xl font-bold text-warning">{loading ? '...' : stats.pending}</p>
            </Card>
            <Card title="Assigned inventories" icon="inventory_2">
              <p className="text-3xl font-bold text-primary-800">{loading ? '...' : stats.assigned}</p>
            </Card>
            <Card title="Total items (assigned)" icon="category">
              <p className="text-3xl font-bold text-info">{loading ? '...' : stats.items}</p>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card title="Total Items" icon="inventory_2">
              <p className="text-3xl font-bold text-primary-800">{loading ? '...' : stats.items}</p>
            </Card>
            <Card title="Available" icon="check_circle">
              <p className="text-3xl font-bold text-success">{loading ? '...' : stats.available}</p>
            </Card>
            <Card title="In Use" icon="assignment">
              <p className="text-3xl font-bold text-info">{loading ? '...' : stats.inUse}</p>
            </Card>
            <Card title="Maintenance" icon="build">
              <p className="text-3xl font-bold text-warning">{loading ? '...' : stats.maintenance}</p>
            </Card>
          </div>
        )}

        <Card>
          <Table
            columns={isInchargeView && !viewingInventoryItems ? inventoryColumns : itemColumns}
            data={isInchargeView && !viewingInventoryItems ? filteredInventories : filteredItems}
            getRowActions={isInchargeView && !viewingInventoryItems ? getInventoryRowActions : undefined}
            onRowClick={
              isInchargeView && !viewingInventoryItems
                ? (row) => {
                    if (row.listType === "pending_request") {
                      openPendingDetail(row);
                    } else {
                      navigate(`/inventory/list/incharge?inventoryId=${row.id}`);
                    }
                  }
                : handleItemRowClick
            }
            searchable={true}
            paginated={true}
            loading={loading}
          />
        </Card>
      </div>

      <Modal
        isOpen={isDetailModalOpen}
        onClose={closePendingDetail}
        title={
          selectedPendingRequest?.requestType === INVENTORY_REQUEST_TYPE.CHANGE_INCHARGE
            ? "Change inventory officer"
            : "Inventory creation request"
        }
        size="md"
        footer={(
          <div className="flex justify-end">
            <Button variant="secondary" onClick={closePendingDetail}>Close</Button>
          </div>
        )}
      >
        {selectedPendingRequest && (
          <div className="space-y-4">
            <div className="bg-background-light p-4 rounded-lg">
              <p className="text-sm text-text-light">Inventory</p>
              <p className="text-lg font-semibold text-text-dark">{selectedPendingRequest.name}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {pendingDetailFields.map((field) => (
                <div
                  key={field.label}
                  className={field.fullWidth ? "sm:col-span-2" : ""}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-light">{field.label}</p>
                  <p className="text-sm text-text-dark mt-1">{field.value || "—"}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-text-light border-t border-border-dark pt-4">
              {selectedPendingRequest.requestType === INVENTORY_REQUEST_TYPE.CHANGE_INCHARGE
                ? "After HOD recommendation and administrator approval, this inventory will be assigned to the proposed officer and removed from your list."
                : "This inventory will appear as an assigned inventory once the administrator completes activation."}
            </p>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={assignModalOpen}
        onClose={closeAssignOfficerModal}
        title="Assign new inventory officer"
        size="md"
        footer={(
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeAssignOfficerModal} disabled={assignSubmitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={submitAssignOfficerRequest}
              disabled={assignSubmitting || assignOptionsLoading || officerCandidates.length === 0}
            >
              {assignSubmitting ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        )}
      >
        {assignTargetInventory && (
          <div className="space-y-4">
            <div className="bg-background-light p-4 rounded-lg">
              <p className="text-sm text-text-light">Inventory</p>
              <p className="text-lg font-semibold text-text-dark">{assignTargetInventory.name}</p>
              <p className="text-sm text-text-light mt-1">
                {assignTargetInventory.department}
                {assignTargetInventory.location ? ` · ${assignTargetInventory.location}` : ""}
              </p>
            </div>

            {assignError && (
              <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                {assignError}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-text-dark mb-1" htmlFor="proposed-officer">
                New inventory officer
              </label>
              <select
                id="proposed-officer"
                className="w-full rounded border border-border-lighter px-3 py-2 text-sm"
                value={proposedOfficerId}
                onChange={(event) => setProposedOfficerId(event.target.value)}
                disabled={assignOptionsLoading || assignSubmitting}
              >
                <option value="">Select staff member</option>
                {officerCandidates.map((user) => (
                  <option key={resolveUserId(user)} value={resolveUserId(user)}>
                    {user.name}
                    {user.designation ? ` (${user.designation})` : ""}
                  </option>
                ))}
              </select>
              {assignOptionsLoading && (
                <p className="text-xs text-text-light mt-1">Loading eligible staff...</p>
              )}
              {!assignOptionsLoading && officerCandidates.length === 0 && (
                <p className="text-xs text-text-light mt-1">
                  No eligible staff in this department. Only active Technical Officers or Management Assistants who are not already inventory officers can be selected.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-text-dark mb-1" htmlFor="assign-reason">
                Reason
              </label>
              <textarea
                id="assign-reason"
                className="w-full rounded border border-border-lighter px-3 py-2 text-sm min-h-[96px]"
                value={assignReason}
                onChange={(event) => setAssignReason(event.target.value)}
                placeholder="Explain why a new inventory officer is needed"
                disabled={assignSubmitting}
              />
            </div>

            <p className="rounded bg-yellow-100 px-4 py-3 text-sm text-text-dark border border-red-200 text-justify">
              Your Head of Department will review and recommend this change. The administrator will then update the inventory officer. You will lose access to this inventory after approval.
            </p>
          </div>
        )}
      </Modal>
    </MainLayout>
  );
};

export default InventoryListView;
