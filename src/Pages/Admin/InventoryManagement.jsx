import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AdminLayout from "../../Components/Layouts/AdminLayout";
import { Card, Button, SearchBox, Table, Badge, Modal, FormInput, Select, EntityDetailsModal, PageHeader } from "../../Components/UI";
import {
  INVENTORY_REQUEST_STATUS,
  INVENTORY_REQUEST_STATUS_META,
  INVENTORY_REQUEST_TYPE,
  INVENTORY_REQUEST_TYPE_LABELS,
} from "../../utils/constants";
import { canCreateInventory } from "../../utils/permissionUtils";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const ALLOWED_INCHARGE_DESIGNATIONS = new Set(["Technical Officer", "Management Assistant"]);

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("currentUser") || "{}");
  } catch {
    return {};
  }
};

const normalizeStatus = (status) => String(status || "").toLowerCase();

const InventoryManagement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUserRole = localStorage.getItem("userRole") || "admin";
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("inventories"); // inventories or requests
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInventoryDetailsModalOpen, setIsInventoryDetailsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [selectedInventoryId, setSelectedInventoryId] = useState(null);
  const [selectedInventoryDetails, setSelectedInventoryDetails] = useState(null);
  const [inventories, setInventories] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    department: "",
    incharge: "",
    Hod: "",
    description: "",
  });

  const [assignInchargeModalOpen, setAssignInchargeModalOpen] = useState(false);
  const [selectedInventory, setSelectedInventory] = useState(null);
  const [selectedIncharge, setSelectedIncharge] = useState("");
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [inchargeCandidates, setInchargeCandidates] = useState([]);
  const [optionsError, setOptionsError] = useState("");
  const [inventoryError, setInventoryError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [inventoryRequests, setInventoryRequests] = useState([]);
  const [inventoryRequestsLoading, setInventoryRequestsLoading] = useState(true);
  const [inventoryRequestsError, setInventoryRequestsError] = useState("");
  const [requestActionLoadingId, setRequestActionLoadingId] = useState(null);
  const [selectedRequestDetails, setSelectedRequestDetails] = useState(null);
  const [isRequestDetailModalOpen, setIsRequestDetailModalOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadPageData = async () => {
      try {
        setOptionsError("");
        setInventoryError("");

        const [departmentsResponse, usersResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/departments`),
          fetch(`${API_BASE_URL}/api/users`),
        ]);

        const [departmentsData, usersData] = await Promise.all([
          departmentsResponse.json(),
          usersResponse.json(),
        ]);

        if (!departmentsResponse.ok || !departmentsData.success) {
          throw new Error(departmentsData.error || departmentsData.message || "Failed to load departments.");
        }

        if (!usersResponse.ok || !usersData.success) {
          throw new Error(usersData.error || usersData.message || "Failed to load users.");
        }

        if (!isMounted) {
          return;
        }

        setDepartments(departmentsData.departments || []);
        setUsers(usersData.users || []);
        setInchargeCandidates(
          (usersData.users || []).filter(
            (user) =>
              ["staff", "inventory_incharge"].includes(user.role) &&
              user.status === "active" &&
              ALLOWED_INCHARGE_DESIGNATIONS.has(String(user.designation || "").trim())
          )
        );
      } catch (error) {
        if (isMounted) {
          setDepartments([]);
          setUsers([]);
          setInchargeCandidates([]);
          setOptionsError(error.message || "Failed to load inventory form options.");
        }
      }

      try {
        const inventoriesResponse = await fetch(`${API_BASE_URL}/api/inventories`);
        const inventoriesData = await inventoriesResponse.json();

        if (!inventoriesResponse.ok || !inventoriesData.success) {
          throw new Error(inventoriesData.error || inventoriesData.message || "Failed to load inventories.");
        }

        if (isMounted) {
          setInventories(inventoriesData.inventories || []);
        }
      } catch (error) {
        if (isMounted) {
          setInventories([]);
          setInventoryError(error.message || "Failed to load inventories.");
        }
      }
    };

    loadPageData();

    return () => {
      isMounted = false;
    };
  }, []);

  const loadInventoryRequests = useCallback(async () => {
    try {
      setInventoryRequestsLoading(true);
      setInventoryRequestsError("");

      const response = await fetch(
        `${API_BASE_URL}/api/inventory-creation-requests?adminQueue=true`
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to load inventory creation requests.");
      }

      setInventoryRequests(
        (data.requests || []).map((request) => ({
          ...request,
          requestedBy: request.requestedByName || request.requestedBy || "—",
          hodApprovedBy: request.hodApprovedBy || "—",
          hodApprovedDate: request.hodApprovedDate || "",
        }))
      );
    } catch (error) {
      setInventoryRequests([]);
      setInventoryRequestsError(error.message || "Unable to load inventory creation requests.");
    } finally {
      setInventoryRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (location.state?.activeTab === "requests") {
      setActiveTab("requests");
    }
  }, [location.state?.activeTab]);

  useEffect(() => {
    loadInventoryRequests();
  }, [loadInventoryRequests]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadInventoryRequests();
    }, 15000);

    const handleFocus = () => {
      loadInventoryRequests();
      refreshInventories().catch(() => {});
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadInventoryRequests]);

  const departmentOptions = useMemo(
    () => departments.map((department) => ({ value: department.name, label: department.name })),
    [departments]
  );

  const departmentHodLookup = useMemo(
    () =>
      users.reduce((lookup, user) => {
        if (user.role === "head_of_department" && user.department) {
          lookup[user.department] = {
            id: user.id,
            name: user.name,
          };
        }

        return lookup;
      }, {}),
    [users]
  );

  const filteredInchargeCandidates = useMemo(() => {
    if (!formData.department) {
      return [];
    }

    return inchargeCandidates.filter((person) => person.department === formData.department);
  }, [formData.department, inchargeCandidates]);

  const inchargeOptions = useMemo(
    () => filteredInchargeCandidates.map((person) => ({ value: String(person.id), label: person.name })),
    [filteredInchargeCandidates]
  );

  useEffect(() => {
    if (!formData.incharge) {
      return;
    }

    const inchargeStillValid = filteredInchargeCandidates.some((person) => String(person.id) === String(formData.incharge));

    if (!inchargeStillValid) {
      setFormData((prev) => ({ ...prev, incharge: "" }));
    }
  }, [filteredInchargeCandidates, formData.incharge]);

  useEffect(() => {
    const departmentHod = departmentHodLookup[formData.department];
    const nextHodName = departmentHod?.name || "";

    if (formData.Hod !== nextHodName) {
      setFormData((prev) => ({ ...prev, Hod: nextHodName }));
    }
  }, [departmentHodLookup, formData.Hod, formData.department]);

  const columns = [
    { field: "name", label: "Inventory Name", sortable: true },
    { field: "location", label: "Location", sortable: true },
    { field: "department", label: "Department", sortable: true },
    { field: "hod", label: "HOD", sortable: true },
    { field: "incharge", label: "Inventory Officer", sortable: true },
    { field: "itemCount", label: "Items", sortable: true },
    {
      field: "status",
      label: "Status",
      render: (value) => (
        <Badge
          label={value.charAt(0).toUpperCase() + value.slice(1)}
          variant={value === "active" ? "success" : "warning"}
          size="sm"
        />
      ),
    },
  ];

  const requestColumns = [
    { field: "name", label: "Inventory Name", sortable: true },
    {
      field: "requestType",
      label: "Request Type",
      render: (value) => {
        const typeLabels = {
          [INVENTORY_REQUEST_TYPE.ADD_EXISTING]: { label: "Add Inventory", variant: "info" },
          [INVENTORY_REQUEST_TYPE.CHANGE_INCHARGE]: { label: "Change Officer", variant: "warning" },
        };
        const config = typeLabels[value] || { label: "New Inventory Creation", variant: "primary" };
        return <Badge label={config.label} variant={config.variant} size="sm" />;
      },
    },
    { field: "department", label: "Department", sortable: true },
    { field: "requestedBy", label: "Requested By", sortable: true },
    { field: "requestedDate", label: "Request Date" },
    {
      field: "approvalStatus",
      label: "Status",
      render: (value) => {
        const config = INVENTORY_REQUEST_STATUS_META[value] || { label: value, variant: "secondary" };
        return <Badge label={config.label} variant={config.variant} size="sm" />;
      },
    },
    { field: "reason", label: "Reason" },
  ];

  const filteredInventories = inventories.filter((inv) =>
    inv.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRequests = inventoryRequests.filter(
    (req) =>
      req.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(req.department || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(req.requestedBy || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleApproveRequest = async (request) => {
    const typeLabel = request.requestType === INVENTORY_REQUEST_TYPE.CHANGE_INCHARGE
      ? "assign the new inventory officer"
      : request.requestType === INVENTORY_REQUEST_TYPE.ADD_EXISTING
        ? "add this inventory to the system"
        : "create this inventory in the system";
    const confirmed = window.confirm(
      `Approve and ${typeLabel} for "${request.name}" (${request.department})?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setRequestActionLoadingId(request.id);
      const adminUser = getStoredUser();
      const response = await fetch(
        `${API_BASE_URL}/api/inventory-creation-requests/${request.id}/approve-admin`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approverUserId: adminUser.id ?? null }),
        }
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to approve inventory request.");
      }

      setInventoryRequests((prev) => prev.filter((item) => item.id !== request.id));
      setIsRequestDetailModalOpen(false);
      setSelectedRequestDetails(null);
      await refreshInventories();
    } catch (error) {
      window.alert(error.message || "Failed to approve inventory request.");
    } finally {
      setRequestActionLoadingId(null);
    }
  };

  const handleRejectRequest = async (request) => {
    const confirmed = window.confirm(`Reject the inventory request for "${request.name}"?`);

    if (!confirmed) {
      return;
    }

    try {
      setRequestActionLoadingId(request.id);
      const adminUser = getStoredUser();
      const response = await fetch(
        `${API_BASE_URL}/api/inventory-creation-requests/${request.id}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            approverUserId: adminUser.id ?? null,
            approverRole: "admin",
            reason: "Rejected from inventory management",
          }),
        }
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to reject inventory request.");
      }

      setInventoryRequests((prev) => prev.filter((item) => item.id !== request.id));
      setIsRequestDetailModalOpen(false);
      setSelectedRequestDetails(null);
    } catch (error) {
      window.alert(error.message || "Failed to reject inventory request.");
    } finally {
      setRequestActionLoadingId(null);
    }
  };

  const closeRequestDetailModal = () => {
    if (requestActionLoadingId !== null) {
      return;
    }
    setIsRequestDetailModalOpen(false);
    setSelectedRequestDetails(null);
  };

  const handleViewRequestDetails = (request) => {
    setSelectedRequestDetails(request);
    setIsRequestDetailModalOpen(true);
  };

  const buildInventoryRequestDetailFields = (request) => {
    const statusConfig = INVENTORY_REQUEST_STATUS_META[request.approvalStatus] || {
      label: request.approvalStatus,
    };
    const typeLabel = INVENTORY_REQUEST_TYPE_LABELS[request.requestType] || request.requestType;

    const officerFields = request.requestType === INVENTORY_REQUEST_TYPE.CHANGE_INCHARGE
      ? [
        { label: "Current officer", value: request.previousInchargeName || request.requestedByName },
        { label: "Proposed officer", value: request.inchargeName },
      ]
      : [{ label: "Inventory officer", value: request.inchargeName }];

    return [
      { label: "Request type", value: typeLabel },
      { label: "Inventory name", value: request.name },
      { label: "Department", value: request.department },
      { label: "Location", value: request.location },
      { label: "Requested by", value: request.requestedByName || request.requestedBy },
      ...officerFields,
      { label: "HOD approved by", value: request.hodApprovedBy },
      { label: "HOD approval date", value: request.hodApprovedDate },
      { label: "Request date", value: request.requestedDate },
      { label: "Status", value: statusConfig.label },
      {
        label: "Submitted by",
        value: request.isAdminSubmitted ? "Administrator" : "Staff member",
      },
      { label: "Reason", value: request.reason, fullWidth: true },
    ];
  };

  const requestDetailModalTitle = selectedRequestDetails
    ? `${INVENTORY_REQUEST_TYPE_LABELS[selectedRequestDetails.requestType] || "Inventory"} request`
    : "Request details";

  const requestDetailFields = selectedRequestDetails
    ? buildInventoryRequestDetailFields(selectedRequestDetails)
    : [];

  const isSelectedRequestLoading = selectedRequestDetails
    ? requestActionLoadingId === selectedRequestDetails.id
    : false;

  const canActOnSelectedRequest = Boolean(selectedRequestDetails?.canAdminAct);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({ name: "", department: "", incharge: "", Hod: "", location: "", description: "" });
    setSubmitError("");
    setModalMode("create");
    setSelectedInventoryId(null);
  };

  const refreshInventories = async () => {
    const response = await fetch(`${API_BASE_URL}/api/inventories`);
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || data.message || "Failed to refresh inventories.");
    }

    setInventories(data.inventories || []);
  };

  const handleSelectChange = (name) => (value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleEdit = (inventory) => {
    setModalMode("edit");
    setSelectedInventoryId(inventory.id);
    setSubmitError("");
    setFormData({
      name: inventory.name,
      department: inventory.department,
      incharge: inventory.inchargeId ? String(inventory.inchargeId) : "",
      Hod: inventory.hod || "",
      location: inventory.location || "",
      description: inventory.description || "",
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();

    try {
      setIsSaving(true);
      setSubmitError("");

      const payload = {
        name: formData.name.trim(),
        department: formData.department,
        inchargeId: Number(formData.incharge),
        hodUserId: departmentHodLookup[formData.department]?.id || null,
        location: formData.location,
        description: formData.description.trim(),
      };
      const endpoint = modalMode === "create"
        ? `${API_BASE_URL}/api/inventories`
        : `${API_BASE_URL}/api/inventories/${selectedInventoryId}`;
      const method = modalMode === "create" ? "POST" : "PUT";
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || "Failed to save inventory.");
      }

      await refreshInventories();
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      setSubmitError(error.message || "Failed to save inventory.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAssignIncharge = (inventory) => {
    setSelectedInventory(inventory);
    setSelectedIncharge(inventory.incharge || "");
    setAssignInchargeModalOpen(true);
  };

  const closeInventoryDetails = () => {
    setIsInventoryDetailsModalOpen(false);
    setSelectedInventoryDetails(null);
  };

  const handleViewInventoryDetails = (inventory) => {
    setSelectedInventoryDetails(inventory);
    setIsInventoryDetailsModalOpen(true);
  };

  const handleDeactivateInventory = async (inventory) => {
    const confirmed = window.confirm(
      `Deactivate "${inventory.name}"? Items and history are preserved; the inventory will be hidden from active use until reactivated.`
    );
    if (!confirmed) return;

    setInventories((prev) =>
      prev.map((inv) => (inv.id === inventory.id ? { ...inv, status: "inactive" } : inv))
    );
    setSelectedInventoryDetails((prev) =>
      prev && prev.id === inventory.id ? { ...prev, status: "inactive" } : prev
    );
    window.alert(`"${inventory.name}" has been deactivated.`);
  };

  const handleReactivateInventory = async (inventory) => {
    const confirmed = window.confirm(
      `Reactivate "${inventory.name}"? It will be available for use again.`
    );
    if (!confirmed) return;

    setInventories((prev) =>
      prev.map((inv) => (inv.id === inventory.id ? { ...inv, status: "active" } : inv))
    );
    setSelectedInventoryDetails((prev) =>
      prev && prev.id === inventory.id ? { ...prev, status: "active" } : prev
    );
    window.alert(`"${inventory.name}" has been reactivated.`);
  };

  const handleAssignInchargeSubmit = () => {
    console.log(`Assigned ${selectedIncharge} to ${selectedInventory?.name}`);
    setAssignInchargeModalOpen(false);
    setSelectedInventory(null);
    setSelectedIncharge("");
  };
 
  const modalFooter = (
    <div className="flex gap-3 justify-end">
      <Button variant="secondary" onClick={() => {
        setIsModalOpen(false);
        resetForm();
      }}>
        Cancel
      </Button>
      <Button variant="primary" onClick={handleSubmit} disabled={isSaving}>
        {modalMode === "create" ? "Create Inventory" : "Update Inventory"}
      </Button>
    </div>
  );

  const assignInchargeFooter = (
    <div className="flex gap-3 justify-end">
      <Button variant="secondary" onClick={() => setAssignInchargeModalOpen(false)}>
        Cancel
      </Button>
      <Button variant="primary" onClick={handleAssignInchargeSubmit}>
        Assign Inventory Officer
      </Button>
    </div>
  );

  const selectedInventoryIsInactive =
    normalizeStatus(selectedInventoryDetails?.status) === "inactive";

  const inventoryDetailsFooter = (
    <div className="flex flex-wrap justify-end gap-3">
      <Button variant="secondary" onClick={closeInventoryDetails}>
        Close
      </Button>
      {selectedInventoryDetails ? (
        selectedInventoryIsInactive ? (
          <Button
            variant="primary"
            icon="check_circle"
            onClick={() => handleReactivateInventory(selectedInventoryDetails)}
          >
            Reactivate
          </Button>
        ) : (
          <>
            <Button
              variant="primary"
              icon="person_add"
              onClick={() => handleAssignIncharge(selectedInventoryDetails)}
            >
              Assign Officer
            </Button>
            <Button
              variant="danger"
              icon="block"
              onClick={() => handleDeactivateInventory(selectedInventoryDetails)}
            >
              Deactivate
            </Button>
          </>
        )
      ) : null}
    </div>
  );

  const requestDetailsFooter = (
    <div className="flex flex-wrap justify-end gap-3">
      <Button variant="secondary" onClick={closeRequestDetailModal} disabled={isSelectedRequestLoading}>
        Close
      </Button>
      {canActOnSelectedRequest ? (
        <>
          <Button
            variant="danger"
            icon="cancel"
            onClick={() => handleRejectRequest(selectedRequestDetails)}
            disabled={isSelectedRequestLoading}
            loading={isSelectedRequestLoading}
          >
            Reject
          </Button>
          <Button
            variant="primary"
            icon="check_circle"
            onClick={() => handleApproveRequest(selectedRequestDetails)}
            disabled={isSelectedRequestLoading}
            loading={isSelectedRequestLoading}
          >
            Approve
          </Button>
        </>
      ) : null}
    </div>
  );

  return (
    <AdminLayout>
      <PageHeader
        title="Inventory Management"
        subtitle="Manage inventories, approve creation requests, and assign inventory officers"
        actions={canCreateInventory(currentUserRole) ? (
          <Button
            icon="add_circle"
            onClick={() => navigate('/admin/inventory/create')}
          >
            Create Inventory
          </Button>
        ) : null}
      />

      <div className="p-6 space-y-6">
        {optionsError && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {optionsError}
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-border-light">
          <div className="flex gap-2">
            <button
              onClick={() => {
                setActiveTab("inventories");
                closeRequestDetailModal();
              }}
              className={`px-6 py-3 border-b-2 font-medium transition-colors ${
                activeTab === "inventories"
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-text-light hover:text-text-dark"
              }`}
            >
              All Inventories
            </button>
            <button
              onClick={() => {
                setActiveTab("requests");
                closeRequestDetailModal();
              }}
              className={`px-6 py-3 border-b-2 font-medium transition-colors ${
                activeTab === "requests"
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-text-light hover:text-text-dark"
              }`}
            >
              Creation Requests {inventoryRequests.length > 0 && `(${inventoryRequests.length})`}
            </button>
          </div>
        </div>

        {/* Search */}
        <SearchBox
          placeholder={activeTab === "inventories" ? "Search inventories..." : "Search requests..."}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          icon="search"
        />

        {/* Inventories Table or Requests Table */}
        {activeTab === "inventories" ? (
          <Card title="All Inventories" icon="inventory_2">
            {inventoryError && <p className="mb-4 rounded bg-error/10 px-3 py-2 text-sm text-error">{inventoryError}</p>}
            <p className="mb-4 text-sm text-text-light bg-background-light p-3 rounded">
              Click an inventory row to open details. Assign an officer or deactivate from the detail view only.
            </p>
            <Table
              columns={columns}
              data={filteredInventories}
              onRowClick={handleViewInventoryDetails}
              paginated
              itemsPerPage={10}
            />
          </Card>
        ) : (
          <Card title="Inventory Creation Requests" icon="request_quote">
            <div className="space-y-4">
              <p className="text-sm text-text-light bg-background-light p-3 rounded">
                Click a request row to open details. Track admin-submitted inventory requests while they move through HOD and registrar approval.
              </p>
              {inventoryRequestsError ? (
                <p className="text-sm text-error">{inventoryRequestsError}</p>
              ) : null}
              {inventoryRequestsLoading ? (
                <p className="text-sm text-text-light p-4">Loading inventory creation requests...</p>
              ) : filteredRequests.length === 0 ? (
                <div className="text-center py-10 text-text-light">
                  <span className="material-symbols-outlined text-5xl mb-2 block">check_circle</span>
                  No inventory requests in progress
                </div>
              ) : (
                <Table
                  columns={requestColumns}
                  data={filteredRequests}
                  onRowClick={handleViewRequestDetails}
                  paginated
                  itemsPerPage={10}
                />
              )}
            </div>
          </Card>
        )}

        <EntityDetailsModal
          isOpen={isRequestDetailModalOpen}
          onClose={closeRequestDetailModal}
          title={requestDetailModalTitle}
          selectedLabel="Inventory Request"
          selectedName={selectedRequestDetails?.name}
          size="lg"
          footer={requestDetailsFooter}
          details={requestDetailFields}
        >
          <p className="border-t border-border-lighter pt-4 text-xs text-text-light">
            {canActOnSelectedRequest
              ? "Approve to create or activate this inventory in the system, or reject to decline the request."
              : "This request is still awaiting HOD or registrar approval."}
          </p>
        </EntityDetailsModal>

        {/* Inventory Details Modal */}
        <EntityDetailsModal
          isOpen={isInventoryDetailsModalOpen}
          onClose={closeInventoryDetails}
          title={`Inventory Details${selectedInventoryDetails?.name ? ` - ${selectedInventoryDetails.name}` : ""}`}
          selectedLabel="Selected Inventory"
          selectedName={selectedInventoryDetails?.name}
          size="lg"
          footer={inventoryDetailsFooter}
          details={[
            { label: "Department", value: selectedInventoryDetails?.department },
            { label: "Inventory Officer", value: selectedInventoryDetails?.incharge },
            { label: "HOD", value: selectedInventoryDetails?.hod },
            { label: "Inventory Location", value: selectedInventoryDetails?.location },
            { label: "Item Count", value: selectedInventoryDetails?.itemCount },
            {
              label: "Status",
              value: selectedInventoryDetails?.status
                ? normalizeStatus(selectedInventoryDetails.status).charAt(0).toUpperCase() +
                  normalizeStatus(selectedInventoryDetails.status).slice(1)
                : "-",
            },
            { label: "Created Date", value: selectedInventoryDetails?.createdDate },
            { label: "Last Updated", value: selectedInventoryDetails?.lastUpdated },
            { label: "Inventory ID", value: selectedInventoryDetails?.id },
          ]}
        >
          {selectedInventoryIsInactive ? (
            <p className="border-t border-border-lighter pt-4 text-sm text-text-light">
              Reactivate this inventory to restore use. Assigning an inventory officer is available when the inventory is active.
            </p>
          ) : null}
        </EntityDetailsModal>

        {/* Create/Edit Inventory Modal */}
        <Modal
          isOpen={isModalOpen}
          title={modalMode === "create" ? "Create New Inventory" : "Edit Inventory"}
          onClose={() => setIsModalOpen(false)}
          footer={modalFooter}
          size="md"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {submitError && <p className="rounded bg-error/10 px-3 py-2 text-sm text-error">{submitError}</p>}
            {optionsError && <p className="rounded bg-warning/10 px-3 py-2 text-sm text-warning">{optionsError}</p>}

            <FormInput
              label="Inventory Name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Enter inventory name"
              required
            />
            
            <FormInput
              label="Inventory Location (Office/Lab)"
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              placeholder="Enter inventory location"
              required
            />

            <Select
              label="Department"
              name="department"
              value={formData.department}
              onChange={handleSelectChange("department")}
              options={departmentOptions}
              placeholder="Select a department"
              required
            />

            <FormInput
              label="HOD"
              name="Hod"
              value={formData.Hod}
              onChange={handleInputChange}
              placeholder="Select a department first"
              disabled
            />

            <Select
              label="Inventory Officer"
              name="incharge"
              value={formData.incharge}
              onChange={handleSelectChange("incharge")}
              options={inchargeOptions}
              placeholder={formData.department ? "Select an inventory officer" : "Select a department first"}
              disabled={!formData.department}
              required
            />

            <FormInput
              label="Description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Inventory description"
              as="textarea"
              rows={3}
            />
          </form>
        </Modal>

        {/* Assign Inventory Officer Modal */}
        <Modal
          isOpen={assignInchargeModalOpen}
          title={`Assign Inventory Officer to ${selectedInventory?.name}`}
          onClose={() => setAssignInchargeModalOpen(false)}
          footer={assignInchargeFooter}
          size="md"
        >
          <div className="space-y-4">
            <p className="text-sm text-text-light">
              Current Inventory Officer: <span className="font-semibold text-text-dark">{selectedInventory?.incharge}</span>
            </p>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-text-dark">Select New Inventory Officer:</label>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {inchargeCandidates.map((person) => (
                  <label
                    key={person.id}
                    className={`flex items-center gap-3 p-3 border rounded cursor-pointer transition ${
                      selectedIncharge === person.name
                        ? "border-primary-600 bg-primary-50"
                        : "border-border-light hover:border-primary-600"
                    }`}
                  >
                    <input
                      type="radio"
                      name="incharge"
                      value={person.name}
                      checked={selectedIncharge === person.name}
                      onChange={(e) => setSelectedIncharge(e.target.value)}
                      className="w-4 h-4"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-text-dark">{person.name}</p>
                      <p className="text-xs text-text-light">{person.email}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      </div>
    </AdminLayout>
  );
};

export default InventoryManagement;
