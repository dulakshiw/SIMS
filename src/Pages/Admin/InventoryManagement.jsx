import React, { useEffect, useMemo, useState } from "react";
import AdminLayout from "../../Components/Layouts/AdminLayout";
import { Card, Button, SearchBox, Table, Badge, Modal, FormInput, Select, EntityDetailsModal, PageHeader } from "../../Components/UI";
import { INVENTORY_REQUEST_STATUS, INVENTORY_REQUEST_TYPE } from "../../utils/constants";
import { canCreateInventory } from "../../utils/permissionUtils";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const ALLOWED_INCHARGE_DESIGNATIONS = new Set(["Technical Officer", "Management Assistant"]);

const InventoryManagement = () => {
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

  // Pending inventory creation requests
  const [inventoryRequests, setInventoryRequests] = useState([
    {
      id: 201,
      name: "Laboratory Equipment",
      department: "Science",
      requestedBy: "Frank Wilson",
      requestedDate: "2026-01-24",
      requestType: INVENTORY_REQUEST_TYPE.ADD_EXISTING,
      approvalStatus: INVENTORY_REQUEST_STATUS.PENDING_HOD,
      hodApprovedDate: null,
      hodApprovedBy: null,
      reason: "Existing faculty inventory to be added to the system",
    },
    {
      id: 202,
      name: "Sports Equipment",
      department: "Physical Education",
      requestedBy: "Grace Lee",
      requestedDate: "2026-01-25",
      requestType: INVENTORY_REQUEST_TYPE.CREATE_NEW,
      approvalStatus: INVENTORY_REQUEST_STATUS.PENDING_ADMIN,
      hodApprovedDate: "2026-01-26",
      hodApprovedBy: "PE Department Head",
      registrarApprovedDate: "2026-01-27",
      reason: "Sports facilities expansion",
    },
  ]);

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
              user.role === "staff" &&
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
    { field: "incharge", label: "In-Charge", sortable: true },
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

  const actions = [
    { label: "Assign In-Charge", icon: "person_add", onClick: (row) => handleAssignIncharge(row) },
    {
      label: "Toggle Status",
      icon: "toggle_on",
      onClick: (row) => console.log("Toggle status", row),
    },
  ];

  const requestColumns = [
    { field: "name", label: "Inventory Name", sortable: true },
    {
      field: "requestType",
      label: "Request Type",
      render: (value) => (
        <Badge
          label={value === INVENTORY_REQUEST_TYPE.ADD_EXISTING ? "Add Inventory" : "New Inventory Creation"}
          variant={value === INVENTORY_REQUEST_TYPE.ADD_EXISTING ? "info" : "primary"}
          size="sm"
        />
      ),
    },
    { field: "department", label: "Department", sortable: true },
    { field: "requestedBy", label: "Requested By", sortable: true },
    { field: "requestedDate", label: "Request Date" },
    {
      field: "approvalStatus",
      label: "Status",
      render: (value) => {
        const statusConfig = {
          pending_hod: { label: "Pending HOD Review", variant: "warning" },
          pending_staff: { label: "Pending HOD Review", variant: "warning" },
          approved_by_hod: { label: "HOD Approved", variant: "info" },
          pending_registrar: { label: "Awaiting Registrar", variant: "info" },
          pending_admin: { label: "Awaiting Admin", variant: "warning" },
          approved_by_admin: { label: "Approved", variant: "success" },
          approved_by_registrar: { label: "Approved", variant: "success" },
          completed: { label: "Completed", variant: "success" },
          rejected: { label: "Rejected", variant: "error" },
        };
        const config = statusConfig[value] || { label: value, variant: "secondary" };
        return <Badge label={config.label} variant={config.variant} size="sm" />;
      },
    },
  ];

  const requestActions = [
    {
      label: "Approve",
      icon: "check_circle",
      onClick: (row) => handleApproveRequest(row),
    },
    {
      label: "Reject",
      icon: "cancel",
      onClick: (row) => handleRejectRequest(row),
    },
  ];

  const filteredInventories = inventories.filter((inv) =>
    inv.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRequests = inventoryRequests.filter((req) =>
    req.requestType !== INVENTORY_REQUEST_TYPE.ADD_EXISTING && (
    req.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.department.toLowerCase().includes(searchTerm.toLowerCase())
    ));

  const handleApproveRequest = (request) => {
    // Update approval status
    setInventoryRequests((prev) =>
      prev.map((r) =>
        r.id === request.id
          ? {
              ...r,
              approvalStatus:
                request.approvalStatus === INVENTORY_REQUEST_STATUS.PENDING_HOD ||
                request.approvalStatus === INVENTORY_REQUEST_STATUS.PENDING_STAFF
                  ? INVENTORY_REQUEST_STATUS.APPROVED_BY_HOD
                  : request.approvalStatus === INVENTORY_REQUEST_STATUS.PENDING_REGISTRAR
                    ? INVENTORY_REQUEST_STATUS.APPROVED_BY_REGISTRAR
                    : INVENTORY_REQUEST_STATUS.APPROVED_BY_ADMIN,
              hodApprovedDate:
                request.approvalStatus === INVENTORY_REQUEST_STATUS.PENDING_HOD ||
                request.approvalStatus === INVENTORY_REQUEST_STATUS.PENDING_STAFF
                  ? new Date().toISOString().split("T")[0]
                  : r.hodApprovedDate,
            }
          : r
      )
    );
    console.log("Approved inventory request:", request.name);
  };

  const handleRejectRequest = (request) => {
    setInventoryRequests((prev) =>
      prev.map((r) =>
        r.id === request.id
          ? { ...r, approvalStatus: INVENTORY_REQUEST_STATUS.REJECTED }
          : r
      )
    );
    console.log("Rejected inventory request:", request.name);
  };

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
    setSelectedIncharge(inventory.incharge);
    setAssignInchargeModalOpen(true);
  };

  const handleViewInventoryDetails = (inventory) => {
    setSelectedInventoryDetails(inventory);
    setIsInventoryDetailsModalOpen(true);
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
        Assign In-Charge
      </Button>
    </div>
  );

  return (
    <AdminLayout>
      <PageHeader
        title="Inventory Management"
        subtitle="Manage inventories, approve creation requests, and assign in-charge persons"
        actions={canCreateInventory(currentUserRole) ? (
          <Button
            icon="add_circle"
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
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
              onClick={() => setActiveTab("inventories")}
              className={`px-6 py-3 border-b-2 font-medium transition-colors ${
                activeTab === "inventories"
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-text-light hover:text-text-dark"
              }`}
            >
              All Inventories
            </button>
            <button
              onClick={() => setActiveTab("requests")}
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
            <Table
              columns={columns}
              data={filteredInventories}
              actions={actions}
              onRowClick={handleViewInventoryDetails}
              rowsPerPage={10}
            />
          </Card>
        ) : (
          <Card title="Inventory Creation Requests" icon="request_quote">
            <div className="space-y-4">
              <p className="text-sm text-text-light bg-background-light p-3 rounded">
                New inventory creation requests appear here after earlier approvals. Existing inventory additions are completed with HOD approval and do not require admin approval again.
              </p>
              <Table
                columns={requestColumns}
                data={filteredRequests}
                actions={requestActions}
                rowsPerPage={10}
              />
            </div>
          </Card>
        )}

        {/* Inventory Details Modal */}
        <EntityDetailsModal
          isOpen={isInventoryDetailsModalOpen}
          onClose={() => setIsInventoryDetailsModalOpen(false)}
          title={`Inventory Details${selectedInventoryDetails?.name ? ` - ${selectedInventoryDetails.name}` : ""}`}
          selectedLabel="Selected Inventory"
          selectedName={selectedInventoryDetails?.name}
          details={[
            { label: "Department", value: selectedInventoryDetails?.department },
            { label: "In-Charge", value: selectedInventoryDetails?.incharge },
            { label: "HOD", value: selectedInventoryDetails?.hod },
            { label: "Inventory Location", value: selectedInventoryDetails?.location },
            { label: "Item Count", value: selectedInventoryDetails?.itemCount },
            {
              label: "Status",
              value: selectedInventoryDetails?.status
                ? selectedInventoryDetails.status.charAt(0).toUpperCase() + selectedInventoryDetails.status.slice(1)
                : "-",
            },
            { label: "Created Date", value: selectedInventoryDetails?.createdDate },
            { label: "Last Updated", value: selectedInventoryDetails?.lastUpdated },
            { label: "Inventory ID", value: selectedInventoryDetails?.id },
          ]}
        />

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
              label="In-Charge Person"
              name="incharge"
              value={formData.incharge}
              onChange={handleSelectChange("incharge")}
              options={inchargeOptions}
              placeholder={formData.department ? "Select an in-charge person" : "Select a department first"}
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

        {/* Assign In-Charge Modal */}
        <Modal
          isOpen={assignInchargeModalOpen}
          title={`Assign In-Charge to ${selectedInventory?.name}`}
          onClose={() => setAssignInchargeModalOpen(false)}
          footer={assignInchargeFooter}
          size="md"
        >
          <div className="space-y-4">
            <p className="text-sm text-text-light">
              Current In-Charge: <span className="font-semibold text-text-dark">{selectedInventory?.incharge}</span>
            </p>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-text-dark">Select New In-Charge:</label>
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
