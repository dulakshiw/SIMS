import React, { useState } from "react";
import AdminLayout from "../../Components/Layouts/AdminLayout";
import { Card, Button, SearchBox, Table, Badge, Modal, FormInput } from "../../Components/UI";
import { ROLES } from "../../utils/constants";

const UserManagement = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "staff",
    department: "",
  });

  const mockUsers = [
    {
      id: 1,
      name: "Alice Johnson",
      email: "alice@example.com",
      role: "admin",
      department: "IT",
      status: "active",
    },
    {
      id: 2,
      name: "Bob Smith",
      email: "bob@example.com",
      role: "incharge",
      department: "Inventory",
      status: "active",
    },
    {
      id: 3,
      name: "Carol White",
      email: "carol@example.com",
      role: "staff",
      department: "Operations",
      status: "inactive",
    },
  ];

  const columns = [
    { field: "name", label: "Name", sortable: true },
    { field: "email", label: "Email", sortable: true },
    {
      field: "role",
      label: "Role",
      render: (value) => <Badge label={value.toUpperCase()} variant="primary" size="sm" />,
    },
    { field: "department", label: "Department", sortable: true },
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
    { label: "Edit", icon: "edit", onClick: (row) => console.log("Edit", row) },
    { label: "Delete", icon: "delete", onClick: (row) => console.log("Delete", row) },
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("New user:", formData);
    setIsModalOpen(false);
    setFormData({ name: "", email: "", role: "staff", department: "" });
  };

  const modalFooter = (
    <div className="flex gap-3 justify-end">
      <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
        Cancel
      </Button>
      <Button variant="primary" onClick={handleSubmit}>
        Create User
      </Button>
    </div>
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text-dark">User Management</h1>
            <p className="text-text-light mt-2">Manage system users and permissions</p>
          </div>
          <Button
            icon="add_circle"
            variant="primary"
            onClick={() => setIsModalOpen(true)}
          >
            Create User
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card title="Total Users" icon="people">
            <p className="text-3xl font-bold text-primary-800">24</p>
          </Card>
          <Card title="Active" icon="check_circle">
            <p className="text-3xl font-bold text-success">20</p>
          </Card>
          <Card title="Inactive" icon="person_off">
            <p className="text-3xl font-bold text-warning">4</p>
          </Card>
        </div>

        {/* Search */}
        <SearchBox value={searchTerm} onChange={setSearchTerm} placeholder="Search users..." />

        {/* Users Table */}
        <Card>
          <Table columns={columns} data={mockUsers} actions={actions} />
        </Card>

        {/* Create User Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Create New User"
          footer={modalFooter}
        >
          <form className="space-y-4">
            <FormInput
              label="Full Name"
              name="name"
              placeholder="John Doe"
              value={formData.name}
              onChange={handleInputChange}
              required
            />
            <FormInput
              label="Email"
              name="email"
              type="email"
              placeholder="john@example.com"
              value={formData.email}
              onChange={handleInputChange}
              required
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <select
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                className="px-4 py-2.5 border border-border-light rounded-md"
              >
                <option value="staff">Staff</option>
                <option value="incharge">In-Charge</option>
                <option value="admin">Admin</option>
              </select>
              <FormInput
                label="Department"
                name="department"
                placeholder="e.g., IT"
                value={formData.department}
                onChange={handleInputChange}
              />
            </div>
          </form>
        </Modal>
      </div>
    </AdminLayout>
  );
};

export default UserManagement;
