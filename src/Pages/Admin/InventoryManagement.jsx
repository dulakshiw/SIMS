import React, { useState } from "react";
import AdminLayout from "../../Components/Layouts/AdminLayout";
import { Card, Button, SearchBox, Table, Badge, Modal, FormInput, Select, EntityDetailsModal } from "../../Components/UI";
import { INVENTORY_REQUEST_STATUS } from "../../utils/constants";

const InventoryManagement = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("inventories"); // inventories or requests
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInventoryDetailsModalOpen, setIsInventoryDetailsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [selectedInventoryId, setSelectedInventoryId] = useState(null);
  const [selectedInventoryDetails, setSelectedInventoryDetails] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    department: "",
    incharge: "",
    Hod: "",
    description: "",
  });

  const [assignInchargeModalOpen, setAssignInchargeModalOpen] = useState(false);
  const [selectedInventory, setSelectedInventory] = useState(null);
  const [selectedIncharge, setSelectedIncharge] = useState("");

  const mockInventories = [
    {
      id: 1,
      name: "Server Room",
      department: "Information Technology",
      incharge: "Alice Johnson",
      hod: "Dr. N. Perera",
      status: "active",
      createdDate: "2026-01-10",
      lastUpdated: "2026-01-25",
      itemCount: 45,
    },
    {
      id: 2,
      name: "IT Equipment",
      department: "Information Technology",
      incharge: "Bob Smith",
      hod: "Dr. N. Perera",
      status: "active",
      createdDate: "2026-01-15",
      lastUpdated: "2026-01-24",
      itemCount: 120,
    },
    {
      id: 3,
      name: "Office Supplies",
      department: "Operations",
      incharge: "Carol White",
      hod: "Prof. S. Jayasinghe",
      status: "inactive",
      createdDate: "2026-01-20",
      lastUpdated: "2026-01-20",
      itemCount: 250,
    },
    {
      id: 4,
      name: "Machinery",
      department: "Operations",
      incharge: "David Brown",
      hod: "Prof. S. Jayasinghe",
      status: "active",
      createdDate: "2026-02-01",
      lastUpdated: "2026-01-26",
      itemCount: 15,
    },
    {
      id: 5,
      name: "HR Equipment",
      department: "Human Resources",
      incharge: "Emma Davis",
      hod: "Dr. P. Fernando",
      status: "active",
      createdDate: "2026-02-05",
      lastUpdated: "2026-01-26",
      itemCount: 30,
    },
  ];

  // Pending inventory creation requests
  const [inventoryRequests, setInventoryRequests] = useState([
    {
      id: 201,
      name: "Laboratory Equipment",
      department: "Science",
      requestedBy: "Frank Wilson",
      requestedDate: "2026-01-24",
      approvalStatus: INVENTORY_REQUEST_STATUS.PENDING_STAFF,
      hodApprovedDate: null,
      hodApprovedBy: null,
      reason: "New lab setup for chemistry department",
    },
    {
      id: 202,
      name: "Sports Equipment",
      department: "Physical Education",
      requestedBy: "Grace Lee",
      requestedDate: "2026-01-25",
      approvalStatus: INVENTORY_REQUEST_STATUS.APPROVED_BY_HOD,
      hodApprovedDate: "2026-01-26",
      hodApprovedBy: "PE Department Head",
      reason: "Sports facilities expansion",
    },
  ]);

  const mockDepartments = [
    { id: 1, name: "Information Technology" },
    { id: 2, name: "Operations" },
    { id: 3, name: "Human Resources" },
    { id: 4, name: "Finance" },
    { id: 5, name: "Marketing" },
  ];

  const mockIncharges = [
    { id: 1, name: "Alice Johnson", email: "alice@example.com" },
    { id: 2, name: "Bob Smith", email: "bob@example.com" },
    { id: 3, name: "Carol White", email: "carol@example.com" },
    { id: 4, name: "David Brown", email: "david@example.com" },
    { id: 5, name: "Emma Davis", email: "emma@example.com" },
  ];

  const columns = [
    { field: "name", label: "Inventory Name", sortable: true },
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
    { label: "Edit", icon: "edit", onClick: (row) => handleEdit(row) },
    { label: "Assign In-Charge", icon: "person_add", onClick: (row) => handleAssignIncharge(row) },
    {
      label: "Toggle Status",
      icon: "toggle_on",
      onClick: (row) => console.log("Toggle status", row),
    },
    { label: "Delete", icon: "delete", onClick: (row) => console.log("Delete", row) },
  ];

  const requestColumns = [
    { field: "name", label: "Inventory Name", sortable: true },
    { field: "department", label: "Department", sortable: true },
    { field: "requestedBy", label: "Requested By", sortable: true },
    { field: "requestedDate", label: "Request Date" },
    {
      field: "approvalStatus",
      label: "Status",
      render: (value) => {
        const statusConfig = {
          pending_staff: { label: "Pending HOD Review", variant: "warning" },
          approved_by_hod: { label: "Pending Registrar Approval", variant: "info" },
          pending_registrar: { label: "Awaiting Registrar", variant: "info" },
          approved_by_registrar: { label: "Approved", variant: "success" },
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

  const filteredInventories = mockInventories.filter((inv) =>
    inv.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRequests = inventoryRequests.filter((req) =>
    req.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleApproveRequest = (request) => {
    // Update approval status
    setInventoryRequests((prev) =>
      prev.map((r) =>
        r.id === request.id
          ? {
              ...r,
              approvalStatus:
                request.approvalStatus === INVENTORY_REQUEST_STATUS.PENDING_STAFF
                  ? INVENTORY_REQUEST_STATUS.APPROVED_BY_HOD
                  : INVENTORY_REQUEST_STATUS.APPROVED_BY_REGISTRAR,
              hodApprovedDate:
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

  const handleEdit = (inventory) => {
    setModalMode("edit");
    setSelectedInventoryId(inventory.id);
    setFormData({
      name: inventory.name,
      department: inventory.department,
      incharge: inventory.incharge,
      description: "",
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (modalMode === "create") {
      console.log("New inventory:", formData);
    } else {
      console.log("Updated inventory:", selectedInventoryId, formData);
    }
    setIsModalOpen(false);
    setFormData({ name: "", department: "", incharge: "", description: "" });
    setModalMode("create");
    setSelectedInventoryId(null);
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
      <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
        Cancel
      </Button>
      <Button variant="primary" onClick={handleSubmit}>
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text-dark">Inventory Management</h1>
            <p className="text-text-light mt-2">Manage inventories, approve creation requests, and assign in-charge persons</p>
          </div>
          <Button
            icon="add_circle"
            variant="primary"
            onClick={() => {
              setModalMode("create");
              setFormData({ name: "", department: "", incharge: "", hod: "", description: "" });
              setIsModalOpen(true);
            }}
          >
            Create Inventory
          </Button>
        </div>

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
                Review and approve inventory creation requests from staff members. Requests go through HOD approval, then Registrar approval before inventory is created.
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
            <FormInput
              label="Inventory Name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Enter inventory name"
              required
            />

            <Select
              label="Department"
              name="department"
              value={formData.department}
              onChange={handleInputChange}
              options={mockDepartments.map((dept) => ({
                value: dept.name,
                label: dept.name,
              }))}
              required
            />

            <Select
              label="In-Charge Person"
              name="incharge"
              value={formData.incharge}
              onChange={handleInputChange}
              options={mockIncharges.map((person) => ({
                value: person.name,
                label: person.name,
              }))}
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
                {mockIncharges.map((person) => (
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
