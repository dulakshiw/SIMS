import React, { useState } from "react";
import AdminLayout from "../../Components/Layouts/AdminLayout";
import { Card, Button, SearchBox, Table, Badge, Modal, FormInput, Select } from "../../Components/UI";
import { ROLES, ROLE_HIERARCHY, ACCOUNT_REQUEST_STATUS } from "../../utils/constants";
import { getAssignableRoles, canApproveAccountCreation } from "../../utils/permissionUtils";

const UserManagement = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isChangeRoleModalOpen, setIsChangeRoleModalOpen] = useState(false);
  const [isApproveAccountModalOpen, setIsApproveAccountModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedUserName, setSelectedUserName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [activeTab, setActiveTab] = useState("active-users"); // active-users or pending-approvals
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    mobileNo: "",
    officeExtNo: "",
    role: "staff",
    department: "",
  });

  const [users, setUsers] = useState([
    {
      id: 1,
      name: "R.D. Wageeshani",
      email: "dulakshiw@uom.lk",
      role: "admin",
      department: "Information Technology",
      status: "active",
      createdDate: "2026-01-15",
    },
    {
      id: 2,
      name: "M.D.C.N. Abeynayake",
      email: "charithana@uom.lk",
      role: "inventory_incharge",
      department: "Information Technology",
      status: "active",
      createdDate: "2026-01-20",
    },
    {
      id: 3,
      name: "B.H. Sudantha",
      email: "dean@uom.lk",
      role: "Dean",
      department: "Dean's Office",
      status: "active",
      createdDate: "2026-01-22",
    },
    {
      id: 4,
      name: "B.H. Sudantha",
      email: "sudanthabh@uom.lk",
      role: "staff",
      department: "Information Technology",
      status: "active",
      createdDate: "2026-01-22",
    },
   
  ]);

  // Pending account creation requests
  const [accountRequests, setAccountRequests] = useState([
    {
      id: 101,
      name: "A.S. Liyanagoda",
      email: "alokal@uom.lk",
      requestedRole: "staff",
      department: "Information Technology",
      requestedDate: "2026-01-25",
      requestedByDeptHead: "",
      approvalStatus: ACCOUNT_REQUEST_STATUS.PENDING_DEPT_HEAD,
    },
    {
      id: 102,
      name: "S.T.K. Gamhewage",
      email: "sampathg@uom.lk",
      requestedRole: "inventory_incharge",
      department: "Interdisciplinary Studies",
      requestedDate: "2026-01-26",
      requestedByDeptHead: "",
      approvalStatus: ACCOUNT_REQUEST_STATUS.APPROVED_BY_DEPT_HEAD,
    },
  ]);

  const columns = [
    { field: "name", label: "Name", sortable: true },
    { field: "email", label: "Email", sortable: true },
    { field: "department", label: "Department", sortable: true },
    {
      field: "role",
      label: "Role",
      render: (value) => (
        <Badge
          label={ROLE_HIERARCHY[value]?.label || value.toUpperCase()}
          variant="primary"
          size="sm"
        />
      ),
    },
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

  const accountRequestColumns = [
    { field: "name", label: "Name", sortable: true },
    { field: "email", label: "Email", sortable: true },
    {
      field: "requestedRole",
      label: "Requested Role",
      render: (value) => (
        <Badge
          label={ROLE_HIERARCHY[value]?.label || value.toUpperCase()}
          variant="info"
          size="sm"
        />
      ),
    },
    { field: "requestedByDeptHead", label: "Requested By", sortable: true },
    { field: "department", label: "Department", sortable: true },
    {
      field: "approvalStatus",
      label: "Status",
      render: (value) => {
        const statusConfig = {
          pending_dept_head: { label: "Pending HOD Approval", variant: "warning" },
          approved_by_dept_head: { label: "Pending Admin Approval", variant: "info" },
          approved_by_admin: { label: "Approved", variant: "success" },
          rejected: { label: "Rejected", variant: "error" },
        };
        const config = statusConfig[value] || { label: value, variant: "secondary" };
        return <Badge label={config.label} variant={config.variant} size="sm" />;
      },
    },
    { field: "requestedDate", label: "Requested Date" },
  ];

  const actions = [
    { label: "Edit", icon: "edit", onClick: (row) => console.log("Edit", row) },
    { label: "Change Role", icon: "admin_panel_settings", onClick: (row) => handleChangeRole(row) },
    {
      label: "Toggle Status",
      icon: "toggle_on",
      onClick: (row) => handleToggleStatus(row),
    },
    { label: "Delete", icon: "delete", onClick: (row) => console.log("Delete", row) },
  ];

  const requestActions = [
    {
      label: "Approve",
      icon: "check_circle",
      onClick: (row) => handleApproveAccount(row),
    },
    {
      label: "Reject",
      icon: "cancel",
      onClick: (row) => handleRejectAccount(row),
    },
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newUser = {
      id: users.length + 1,
      ...formData,
      status: "inactive", // New users start inactive, need admin activation
      createdDate: new Date().toISOString().split("T")[0],
    };
    // Create an account request that needs approval
    const newRequest = {
      id: accountRequests.length + 101,
      name: formData.name,
      email: formData.email,
      mobileNo: formData.mobileNo,
      officeExtNo: formData.officeExtNo,
      requestedRole: formData.role,
      department: formData.department,
      requestedDate: new Date().toISOString().split("T")[0],
      requestedByDeptHead: "Department Head", // In real app, get current user's dept head
      approvalStatus: ACCOUNT_REQUEST_STATUS.PENDING_DEPT_HEAD,
    };
    setAccountRequests([...accountRequests, newRequest]);
    console.log("New account request created:", newRequest);
    setIsModalOpen(false);
    setFormData({ name: "", email: "", mobileNo: "", officeExtNo: "", role: "staff", department: "" });
  };

  const handleToggleStatus = (user) => {
    setUsers((prevUsers) =>
      prevUsers.map((u) =>
        u.id === user.id
          ? { ...u, status: u.status === "active" ? "inactive" : "active" }
          : u
      )
    );
    console.log("Toggled status for user:", user.name);
  };

  const handleChangeRole = (user) => {
    setSelectedUserId(user.id);
    setSelectedUserName(user.name);
    setNewRole(user.role);
    setIsChangeRoleModalOpen(true);
  };

  const handleRoleChangeSubmit = () => {
    setUsers((prevUsers) =>
      prevUsers.map((u) =>
        u.id === selectedUserId ? { ...u, role: newRole } : u
      )
    );
    console.log(`Changed ${selectedUserName}'s role to ${newRole}`);
    setIsChangeRoleModalOpen(false);
    setSelectedUserId(null);
    setSelectedUserName("");
    setNewRole("");
  };

  const handleApproveAccount = (request) => {
    setSelectedUserId(request.id);
    setSelectedUserName(request.name);
    setIsApproveAccountModalOpen(true);
  };

  const handleRejectAccount = (request) => {
    setAccountRequests((prev) =>
      prev.map((r) =>
        r.id === request.id
          ? { ...r, approvalStatus: ACCOUNT_REQUEST_STATUS.REJECTED }
          : r
      )
    );
    console.log("Rejected account request for:", request.name);
  };

  const handleApproveAccountSubmit = () => {
    setAccountRequests((prev) =>
      prev.map((r) =>
        r.id === selectedUserId
          ? { ...r, approvalStatus: ACCOUNT_REQUEST_STATUS.APPROVED_BY_ADMIN }
          : r
      )
    );
    // Add user to active users list
    const request = accountRequests.find((r) => r.id === selectedUserId);
    if (request) {
      const newUser = {
        id: Math.max(...users.map((u) => u.id), 0) + 1,
        name: request.name,
        email: request.email,
        mobileNo: request.mobileNo || "",
        officeExtNo: request.officeExtNo || "",
        role: request.requestedRole,
        department: request.department,
        status: "active",
        createdDate: new Date().toISOString().split("T")[0],
      };
      setUsers([...users, newUser]);
    }
    console.log("Approved account request for:", selectedUserName);
    setIsApproveAccountModalOpen(false);
    setSelectedUserId(null);
    setSelectedUserName("");
  };

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRequests = accountRequests.filter(
    (request) =>
      request.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status === "active").length;
  const inactiveUsers = users.filter((u) => u.status === "inactive").length;
  const pendingRequests = accountRequests.filter(
    (r) => r.approvalStatus !== ACCOUNT_REQUEST_STATUS.APPROVED_BY_ADMIN && r.approvalStatus !== ACCOUNT_REQUEST_STATUS.REJECTED
  ).length;

  const modalFooter = (
    <div className="flex gap-3 justify-end">
      <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
        Cancel
      </Button>
      <Button variant="primary" onClick={handleSubmit}>
        Submit Request
      </Button>
    </div>
  );

  const changeRoleModalFooter = (
    <div className="flex gap-3 justify-end">
      <Button variant="secondary" onClick={() => setIsChangeRoleModalOpen(false)}>
        Cancel
      </Button>
      <Button variant="primary" onClick={handleRoleChangeSubmit}>
        Change Role
      </Button>
    </div>
  );

  const approveAccountFooter = (
    <div className="flex gap-3 justify-end">
      <Button variant="secondary" onClick={() => setIsApproveAccountModalOpen(false)}>
        Cancel
      </Button>
      <Button variant="primary" onClick={handleApproveAccountSubmit}>
        Approve & Activate Account
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
            <p className="text-text-light mt-2">Manage system users, roles, and account approvals</p>
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card title="Total Users" icon="people">
            <p className="text-3xl font-bold text-primary-800">{totalUsers}</p>
          </Card>
          <Card title="Active" icon="check_circle">
            <p className="text-3xl font-bold text-success">{activeUsers}</p>
          </Card>
          <Card title="Inactive" icon="person_off">
            <p className="text-3xl font-bold text-warning">{inactiveUsers}</p>
          </Card>
          <Card title="Pending Approvals" icon="hourglass_empty">
            <p className="text-3xl font-bold text-info">{pendingRequests}</p>
          </Card>
        </div>

        {/* Tabs */}
        <div className="border-b border-border-light">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("active-users")}
              className={`px-6 py-3 border-b-2 font-medium transition-colors ${
                activeTab === "active-users"
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-text-light hover:text-text-dark"
              }`}
            >
              Active Users
            </button>
            <button
              onClick={() => setActiveTab("pending-approvals")}
              className={`px-6 py-3 border-b-2 font-medium transition-colors ${
                activeTab === "pending-approvals"
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-text-light hover:text-text-dark"
              }`}
            >
              Pending Approvals {pendingRequests > 0 && `(${pendingRequests})`}
            </button>
          </div>
        </div>

        {/* Search */}
        <SearchBox
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={activeTab === "active-users" ? "Search users..." : "Search account requests..."}
        />

        {/* Users Table or Requests Table */}
        {activeTab === "active-users" ? (
          <Card>
            <Table columns={columns} data={filteredUsers} actions={actions} rowsPerPage={10} />
          </Card>
        ) : (
          <Card>
            <Table columns={accountRequestColumns} data={filteredRequests} actions={requestActions} rowsPerPage={10} />
          </Card>
        )}
      </div>

      {/* Create User Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New User Account"
        footer={modalFooter}
        size="md"
      >
        <form className="space-y-4">
          <p className="text-sm text-text-light bg-background-light p-3 rounded">
            Note: New account requests will be sent to your Department Head for approval, then to Admin for activation.
          </p>
          <FormInput
            label="Full Name"
            name="name"
            placeholder="ABC Silva"
            value={formData.name}
            onChange={handleInputChange}
            required
          />
          <FormInput
            label="Email"
            name="email"
            type="email"
            placeholder="abcsilva@example.com"
            value={formData.email}
            onChange={handleInputChange}
            required
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput
              label="Mobile No"
              name="mobileNo"
              placeholder="e.g., 0771234567"
              value={formData.mobileNo}
              onChange={handleInputChange}
            />
            <FormInput
              label="Office Extension No"
              name="officeExtNo"
              placeholder="e.g., 8100"
              value={formData.officeExtNo}
              onChange={handleInputChange}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Requested Role"
              name="role"
              value={formData.role}
              onChange={handleInputChange}
              options={[
                { value: "staff", label: ROLE_HIERARCHY.staff.label },
                { value: "inventory_incharge", label: ROLE_HIERARCHY.inventory_incharge.label },
                { value: "head_of_department", label: ROLE_HIERARCHY.head_of_department.label },
                { value: "dean", label: ROLE_HIERARCHY.dean.label },
              ]}
              required
            />
            <Select
              label="Department"
              name="department"
              value={formData.department}
              onChange={handleInputChange}
              options={[
                { value: "Dean's Office", label: "Dean's Office" },
                { value: "Information Technology", label: "Information Technology" },
                { value: "Computational Mathematics", label: "Computational Mathematics" },
                { value: "Interdisciplinary Studies", label: "Interdisciplinary Studies" },
                { value: "Undergraduate Studies", label: "Undergraduate Studies" },
                { value: "Postgraduate Studies", label: "Postgraduate Studies" },
              ]}
              required
            />
          </div>
        </form>
      </Modal>

      {/* Change Role Modal */}
      <Modal
        isOpen={isChangeRoleModalOpen}
        onClose={() => setIsChangeRoleModalOpen(false)}
        title={`Change Role for ${selectedUserName}`}
        footer={changeRoleModalFooter}
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-background-light p-4 rounded-lg">
            <p className="text-sm text-text-light">User</p>
            <p className="text-lg font-semibold text-text-dark">{selectedUserName}</p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-text-dark">Select New Role:</label>
            <div className="space-y-2">
              {Object.entries(ROLE_HIERARCHY)
                .filter(([key]) => key !== "admin" && key !== "registrar")
                .map(([role, data]) => (
                  <label
                    key={role}
                    className={`flex items-center gap-3 p-3 border rounded cursor-pointer transition ${
                      newRole === role
                        ? "border-primary-600 bg-primary-50"
                        : "border-border-light hover:border-primary-600"
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={role}
                      checked={newRole === role}
                      onChange={(e) => setNewRole(e.target.value)}
                      className="w-4 h-4"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-text-dark">{data.label}</p>
                      <p className="text-xs text-text-light">{data.description}</p>
                    </div>
                  </label>
                ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Approve Account Modal */}
      <Modal
        isOpen={isApproveAccountModalOpen}
        onClose={() => setIsApproveAccountModalOpen(false)}
        title={`Approve Account for ${selectedUserName}`}
        footer={approveAccountFooter}
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-success-50 border border-success p-4 rounded-lg">
            <p className="text-sm text-text-dark">
              <strong>Note:</strong> Approving this account will activate the user with the requested role and they will be able to access the system.
            </p>
          </div>

          {accountRequests.find((r) => r.id === selectedUserId) && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-text-light">Name</p>
                  <p className="font-semibold text-text-dark">{selectedUserName}</p>
                </div>
                <div>
                  <p className="text-text-light">Email</p>
                  <p className="font-semibold text-text-dark">{accountRequests.find((r) => r.id === selectedUserId)?.email}</p>
                </div>
                <div>
                  <p className="text-text-light">Mobile No</p>
                  <p className="font-semibold text-text-dark">
                    {accountRequests.find((r) => r.id === selectedUserId)?.mobileNo || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-text-light">Office Extension</p>
                  <p className="font-semibold text-text-dark">
                    {accountRequests.find((r) => r.id === selectedUserId)?.officeExtNo || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-text-light">Requested Role</p>
                  <p className="font-semibold text-text-dark">
                    {ROLE_HIERARCHY[accountRequests.find((r) => r.id === selectedUserId)?.requestedRole]?.label}
                  </p>
                </div>
                <div>
                  <p className="text-text-light">Department</p>
                  <p className="font-semibold text-text-dark">{accountRequests.find((r) => r.id === selectedUserId)?.department}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </AdminLayout>
  );
};

export default UserManagement;

