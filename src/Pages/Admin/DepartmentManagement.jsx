import React, { useState } from "react";
import AdminLayout from "../../Components/Layouts/AdminLayout";
import { Card, Button, SearchBox, Table, Badge, Modal, FormInput, Select } from "../../Components/UI";

const DepartmentManagement = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // create or edit
  const [selectedDeptId, setSelectedDeptId] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    head: "",
    description: "",
  });

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignType, setAssignType] = useState("user"); // user or inventory
  const [selectedDept, setSelectedDept] = useState(null);

  const mockDepartments = [
    {
      id: 1,
      name: "Information Technology",
      code: "IT",
      head: "Alice Johnson",
      description: "IT Department",
      status: "active",
      createdDate: "2024-01-15",
      users: ["Alice Johnson", "Bob Smith"],
      inventories: ["Server Room", "IT Equipment"],
    },
    {
      id: 2,
      name: "Operations",
      code: "OPS",
      head: "Carol White",
      description: "Operations Department",
      status: "active",
      createdDate: "2024-01-20",
      users: ["Carol White", "David Brown"],
      inventories: ["Office Supplies", "Machinery"],
    },
    {
      id: 3,
      name: "Human Resources",
      code: "HR",
      head: "Emma Davis",
      description: "HR Department",
      status: "inactive",
      createdDate: "2024-02-01",
      users: ["Emma Davis"],
      inventories: ["HR Equipment"],
    },
  ];

  const mockUsers = [
    { id: 1, name: "Alice Johnson", email: "alice@example.com", role: "admin" },
    { id: 2, name: "Bob Smith", email: "bob@example.com", role: "incharge" },
    { id: 3, name: "Carol White", email: "carol@example.com", role: "admin" },
    { id: 4, name: "David Brown", email: "david@example.com", role: "staff" },
    { id: 5, name: "Emma Davis", email: "emma@example.com", role: "admin" },
  ];

  const mockInventories = [
    { id: 1, name: "Server Room", type: "Computing" },
    { id: 2, name: "IT Equipment", type: "Computing" },
    { id: 3, name: "Office Supplies", type: "Supplies" },
    { id: 4, name: "Machinery", type: "Equipment" },
    { id: 5, name: "HR Equipment", type: "Equipment" },
  ];

  const columns = [
    { field: "name", label: "Department Name", sortable: true },
    { field: "code", label: "Code", sortable: true },
    { field: "head", label: "Department Head", sortable: true },
    { field: "description", label: "Description" },
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
    { field: "createdDate", label: "Created Date" },
  ];

  const actions = [
    { label: "Edit", icon: "edit", onClick: (row) => handleEdit(row) },
    { label: "Assign", icon: "person_add", onClick: (row) => handleAssignClick(row) },
    { label: "Deactivate", icon: "block", onClick: (row) => console.log("Deactivate", row) },
    { label: "Delete", icon: "delete", onClick: (row) => console.log("Delete", row) },
  ];

  const filteredDepartments = mockDepartments.filter((dept) =>
    dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dept.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleEdit = (dept) => {
    setModalMode("edit");
    setSelectedDeptId(dept.id);
    setFormData({
      name: dept.name,
      code: dept.code,
      head: dept.head,
      description: dept.description,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (modalMode === "create") {
      console.log("New department:", formData);
    } else {
      console.log("Updated department:", selectedDeptId, formData);
    }
    setIsModalOpen(false);
    setFormData({ name: "", code: "", head: "", description: "" });
    setModalMode("create");
    setSelectedDeptId(null);
  };

  const handleAssignClick = (dept) => {
    setSelectedDept(dept);
    setAssignModalOpen(true);
  };

  const modalFooter = (
    <div className="flex gap-3 justify-end">
      <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
        Cancel
      </Button>
      <Button variant="primary" onClick={handleSubmit}>
        {modalMode === "create" ? "Create Department" : "Update Department"}
      </Button>
    </div>
  );

  const assignModalFooter = (
    <div className="flex gap-3 justify-end">
      <Button variant="secondary" onClick={() => setAssignModalOpen(false)}>
        Cancel
      </Button>
      <Button variant="primary" onClick={() => {
        console.log(`Assign ${assignType} to ${selectedDept.name}`);
        setAssignModalOpen(false);
      }}>
        Assign {assignType === "user" ? "User" : "Inventory"}
      </Button>
    </div>
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text-dark">Department Management</h1>
            <p className="text-text-light mt-2">Manage departments and assign users/inventories</p>
          </div>
          <Button
            icon="add_circle"
            variant="primary"
            onClick={() => {
              setModalMode("create");
              setFormData({ name: "", code: "", head: "", description: "" });
              setIsModalOpen(true);
            }}
          >
            Add Department
          </Button>
        </div>

        {/* Search */}
        <SearchBox
          placeholder="Search departments by name or code..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          icon="search"
        />

        {/* Departments Table */}
        <Card title="All Departments" icon="business">
          <Table
            columns={columns}
            data={filteredDepartments}
            actions={actions}
            rowsPerPage={10}
          />
        </Card>

        {/* Create/Edit Department Modal */}
        <Modal
          isOpen={isModalOpen}
          title={modalMode === "create" ? "Create New Department" : "Edit Department"}
          onClose={() => setIsModalOpen(false)}
          footer={modalFooter}
          size="md"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormInput
              label="Department Name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Enter department name"
              required
            />

            <FormInput
              label="Department Code"
              name="code"
              value={formData.code}
              onChange={handleInputChange}
              placeholder="e.g., IT, HR, OPS"
              required
            />

            <FormInput
              label="Department Head"
              name="head"
              value={formData.head}
              onChange={handleInputChange}
              placeholder="Select or enter department head name"
              required
            />

            <FormInput
              label="Description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Department description"
              as="textarea"
              rows={3}
            />
          </form>
        </Modal>

        {/* Assign Users/Inventories Modal */}
        <Modal
          isOpen={assignModalOpen}
          title={`Assign ${assignType === "user" ? "Users" : "Inventories"} to ${selectedDept?.name}`}
          onClose={() => setAssignModalOpen(false)}
          footer={assignModalFooter}
          size="md"
        >
          <div className="space-y-4">
            <div className="flex gap-4">
              <Button
                variant={assignType === "user" ? "primary" : "secondary"}
                onClick={() => setAssignType("user")}
                className="flex-1"
              >
                Users
              </Button>
              <Button
                variant={assignType === "inventory" ? "primary" : "secondary"}
                onClick={() => setAssignType("inventory")}
                className="flex-1"
              >
                Inventories
              </Button>
            </div>

            <div className="border-t pt-4">
              {assignType === "user" ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-text-dark">Select Users to Assign</p>
                  <div className="space-y-2">
                    {mockUsers.map((user) => (
                      <label key={user.id} className="flex items-center gap-3 p-2 hover:bg-background-light rounded">
                        <input
                          type="checkbox"
                          defaultChecked={selectedDept?.users?.includes(user.name)}
                          className="w-4 h-4 accent-primary-600"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-text-dark">{user.name}</p>
                          <p className="text-xs text-text-light">{user.email}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-text-dark">Select Inventories to Assign</p>
                  <div className="space-y-2">
                    {mockInventories.map((inventory) => (
                      <label key={inventory.id} className="flex items-center gap-3 p-2 hover:bg-background-light rounded">
                        <input
                          type="checkbox"
                          defaultChecked={selectedDept?.inventories?.includes(inventory.name)}
                          className="w-4 h-4 accent-primary-600"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-text-dark">{inventory.name}</p>
                          <p className="text-xs text-text-light">{inventory.type}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Modal>
      </div>
    </AdminLayout>
  );
};

export default DepartmentManagement;
