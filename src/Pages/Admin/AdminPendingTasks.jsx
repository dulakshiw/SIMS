import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../../Components/Layouts/AdminLayout";
import { Card, Button, Table, Badge, Modal, SearchBox } from "../../Components/UI";
import { ACCOUNT_REQUEST_STATUS, INVENTORY_REQUEST_STATUS, ROLE_HIERARCHY } from "../../utils/constants";

const AdminPendingTasks = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("account-approvals");
  const [searchTerm, setSearchTerm] = useState("");

  // -- Confirm modal state --
  const [confirmModal, setConfirmModal] = useState({ open: false, action: null, item: null, type: "" });

  // -- Account requests awaiting admin action --
  const [accountRequests, setAccountRequests] = useState([
    {
      id: 101,
      name: "A.S. Liyanagoda",
      email: "alokal@uom.lk",
      requestedRole: "staff",
      department: "Information Technology",
      designation: "Lecturer",
      requestedDate: "2026-01-25",
      requestedByDeptHead: "Dr. N. Perera",
      approvalStatus: ACCOUNT_REQUEST_STATUS.APPROVED_BY_DEPT_HEAD,
    },
    {
      id: 102,
      name: "S.T.K. Gamhewage",
      email: "sampathg@uom.lk",
      requestedRole: "inventory_incharge",
      department: "Interdisciplinary Studies",
      designation: "Senior Lecturer",
      requestedDate: "2026-01-26",
      requestedByDeptHead: "Prof. R. Dias",
      approvalStatus: ACCOUNT_REQUEST_STATUS.APPROVED_BY_DEPT_HEAD,
    },
  ]);

  // -- Users that need activate / deactivate action --
  const [users, setUsers] = useState([
    {
      id: 3,
      name: "P.L. Jayawardena",
      email: "pljaya@uom.lk",
      role: "staff",
      department: "Operations",
      designation: "Assistant Lecturer",
      status: "inactive",
      createdDate: "2026-01-28",
    },
    {
      id: 5,
      name: "T.M. Ranasinghe",
      email: "tmrana@uom.lk",
      role: "inventory_incharge",
      department: "Human Resources",
      designation: "Lecturer",
      status: "inactive",
      createdDate: "2026-02-03",
    },
  ]);

  // -- Inventory creation requests awaiting admin action (approved by HOD) --
  const [inventoryRequests, setInventoryRequests] = useState([
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
    {
      id: 203,
      name: "Medical Supplies",
      department: "Health Sciences",
      requestedBy: "Dr. Nimal Silva",
      requestedDate: "2026-02-01",
      approvalStatus: INVENTORY_REQUEST_STATUS.APPROVED_BY_HOD,
      hodApprovedDate: "2026-02-02",
      hodApprovedBy: "HS Department Head",
      reason: "New clinic setup",
    },
  ]);

  // ---- Handlers ----
  const openConfirm = (action, item, type) => {
    setConfirmModal({ open: true, action, item, type });
  };

  const handleConfirm = () => {
    const { action, item, type } = confirmModal;

    if (type === "approve-account") {
      setAccountRequests((prev) =>
        prev.map((r) =>
          r.id === item.id ? { ...r, approvalStatus: ACCOUNT_REQUEST_STATUS.APPROVED_BY_ADMIN } : r
        )
      );
    } else if (type === "reject-account") {
      setAccountRequests((prev) =>
        prev.map((r) =>
          r.id === item.id ? { ...r, approvalStatus: ACCOUNT_REQUEST_STATUS.REJECTED } : r
        )
      );
    } else if (type === "activate-user") {
      setUsers((prev) =>
        prev.map((u) => (u.id === item.id ? { ...u, status: "active" } : u))
      );
    } else if (type === "deactivate-user") {
      setUsers((prev) =>
        prev.map((u) => (u.id === item.id ? { ...u, status: "inactive" } : u))
      );
    } else if (type === "approve-inventory") {
      setInventoryRequests((prev) =>
        prev.map((r) =>
          r.id === item.id ? { ...r, approvalStatus: INVENTORY_REQUEST_STATUS.APPROVED_BY_REGISTRAR } : r
        )
      );
    } else if (type === "reject-inventory") {
      setInventoryRequests((prev) =>
        prev.map((r) =>
          r.id === item.id ? { ...r, approvalStatus: INVENTORY_REQUEST_STATUS.REJECTED } : r
        )
      );
    }

    setConfirmModal({ open: false, action: null, item: null, type: "" });
  };

  // ---- Column / Action definitions ----
  const accountRequestColumns = [
    { field: "name", label: "Name", sortable: true },
    { field: "email", label: "Email" },
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
    { field: "department", label: "Department", sortable: true },
    { field: "requestedByDeptHead", label: "Recommended By" },
    { field: "requestedDate", label: "Date" },
    {
      field: "approvalStatus",
      label: "Status",
      render: (value) => {
        const map = {
          approved_by_dept_head: { label: "Pending Admin Approval", variant: "warning" },
          approved_by_admin: { label: "Approved", variant: "success" },
          rejected: { label: "Rejected", variant: "error" },
        };
        const cfg = map[value] || { label: value, variant: "secondary" };
        return <Badge label={cfg.label} variant={cfg.variant} size="sm" />;
      },
    },
  ];

  const accountRequestActions = [
    {
      label: "Approve",
      icon: "check_circle",
      onClick: (row) => openConfirm("approve", row, "approve-account"),
    },
    {
      label: "Reject",
      icon: "cancel",
      onClick: (row) => openConfirm("reject", row, "reject-account"),
    },
  ];

  const userColumns = [
    { field: "name", label: "Name", sortable: true },
    { field: "email", label: "Email" },
    {
      field: "role",
      label: "Role",
      render: (value) => (
        <Badge label={ROLE_HIERARCHY[value]?.label || value} variant="primary" size="sm" />
      ),
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
    { field: "createdDate", label: "Created Date" },
  ];

  const userActions = [
    {
      label: "Activate",
      icon: "check_circle",
      onClick: (row) => openConfirm("activate", row, "activate-user"),
    },
    {
      label: "Deactivate",
      icon: "block",
      onClick: (row) => openConfirm("deactivate", row, "deactivate-user"),
    },
  ];

  const inventoryRequestColumns = [
    { field: "name", label: "Inventory Name", sortable: true },
    { field: "department", label: "Department", sortable: true },
    { field: "requestedBy", label: "Requested By" },
    { field: "hodApprovedBy", label: "HOD Approved By" },
    { field: "hodApprovedDate", label: "HOD Approval Date" },
    { field: "reason", label: "Reason" },
    {
      field: "approvalStatus",
      label: "Status",
      render: (value) => {
        const map = {
          approved_by_hod: { label: "Pending Admin Approval", variant: "warning" },
          approved_by_registrar: { label: "Approved", variant: "success" },
          rejected: { label: "Rejected", variant: "error" },
        };
        const cfg = map[value] || { label: value, variant: "secondary" };
        return <Badge label={cfg.label} variant={cfg.variant} size="sm" />;
      },
    },
  ];

  const inventoryRequestActions = [
    {
      label: "Approve & Create",
      icon: "check_circle",
      onClick: (row) => openConfirm("approve", row, "approve-inventory"),
    },
    {
      label: "Reject",
      icon: "cancel",
      onClick: (row) => openConfirm("reject", row, "reject-inventory"),
    },
  ];

  // ---- Filtered data ----
  const pendingAccountRequests = accountRequests.filter(
    (r) => r.approvalStatus === ACCOUNT_REQUEST_STATUS.APPROVED_BY_DEPT_HEAD
  );
  const pendingInventoryRequests = inventoryRequests.filter(
    (r) => r.approvalStatus === INVENTORY_REQUEST_STATUS.APPROVED_BY_HOD
  );
  const inactiveUsers = users.filter((u) => u.status === "inactive");

  const filteredAccountRequests = pendingAccountRequests.filter(
    (r) =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.department.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredUsers = inactiveUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.department.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredInventoryRequests = pendingInventoryRequests.filter(
    (r) =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPending =
    pendingAccountRequests.length + inactiveUsers.length + pendingInventoryRequests.length;

  // ---- Confirm modal text ----
  const getConfirmText = () => {
    const { type, item } = confirmModal;
    if (!item) return {};
    if (type === "approve-account")
      return { title: "Approve Account", body: `Approve and create account for ${item.name}? They will be granted "${ROLE_HIERARCHY[item.requestedRole]?.label || item.requestedRole}" access.` };
    if (type === "reject-account")
      return { title: "Reject Account Request", body: `Reject account creation request for ${item.name}?` };
    if (type === "activate-user")
      return { title: "Activate User", body: `Activate ${item.name}'s account? They will be able to log in.` };
    if (type === "deactivate-user")
      return { title: "Deactivate User", body: `Deactivate ${item.name}'s account? They will lose system access.` };
    if (type === "approve-inventory")
      return { title: "Approve Inventory Creation", body: `Approve creation of the "${item.name}" inventory for ${item.department}?` };
    if (type === "reject-inventory")
      return { title: "Reject Inventory Request", body: `Reject the inventory creation request for "${item.name}"?` };
    return {};
  };

  const { title: confirmTitle, body: confirmBody } = getConfirmText();
  const isDestructive = confirmModal.type?.startsWith("reject") || confirmModal.type === "deactivate-user";

  const tabs = [
    {
      id: "account-approvals",
      label: "Account Approvals",
      icon: "how_to_reg",
      count: pendingAccountRequests.length,
    },
    {
      id: "user-activation",
      label: "User Activation",
      icon: "manage_accounts",
      count: inactiveUsers.length,
    },
    {
      id: "inventory-requests",
      label: "Inventory Requests",
      icon: "inventory_2",
      count: pendingInventoryRequests.length,
    },
  ];

  return (
    <AdminLayout>
      <div className="gradient-primary py-6 rounded-t">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Pending Tasks</h1>
            <p className="text-sm text-primary-50 mt-1">Actions requiring admin approval or intervention</p>
          </div>
          {totalPending > 0 && (
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white font-semibold text-sm">
              <span className="material-symbols-outlined text-base">schedule</span>
              {totalPending} task{totalPending !== 1 ? "s" : ""} pending
            </span>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`text-left p-5 rounded-lg border transition-all ${
                activeTab === tab.id
                  ? "border-primary-600 bg-primary-50 shadow-sm"
                  : "border-border-lighter bg-white hover:border-primary-300 hover:shadow-sm"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`material-symbols-outlined text-2xl ${
                    activeTab === tab.id ? "text-primary-600" : "text-text-light"
                  }`}
                >
                  {tab.icon}
                </span>
                <div>
                  <p className="text-sm text-text-light">{tab.label}</p>
                  <p
                    className={`text-2xl font-bold mt-0.5 ${
                      tab.count > 0 ? "text-warning" : "text-success"
                    }`}
                  >
                    {tab.count}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="border-b border-border-light">
          <div className="flex gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 border-b-2 font-medium transition-colors text-sm ${
                  activeTab === tab.id
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-text-light hover:text-text-dark"
                }`}
              >
                <span className="material-symbols-outlined text-base">{tab.icon}</span>
                {tab.label}
                {tab.count > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                      activeTab === tab.id
                        ? "bg-primary-600 text-white"
                        : "bg-warning/20 text-warning"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <SearchBox
          placeholder="Search by name or department..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          icon="search"
        />

        {/* Tab Content */}
        {activeTab === "account-approvals" && (
          <Card title="Pending Account Creation Requests" icon="how_to_reg">
            <div className="space-y-4">
              <p className="text-sm text-text-light bg-background-light p-3 rounded">
                These account requests have been approved by the department head and are awaiting
                your final approval to create and activate the user account.
              </p>
              {filteredAccountRequests.length === 0 ? (
                <div className="text-center py-10 text-text-light">
                  <span className="material-symbols-outlined text-5xl mb-2 block">check_circle</span>
                  No pending account approvals
                </div>
              ) : (
                <Table
                  columns={accountRequestColumns}
                  data={filteredAccountRequests}
                  actions={accountRequestActions}
                  rowsPerPage={10}
                />
              )}
            </div>
          </Card>
        )}

        {activeTab === "user-activation" && (
          <Card title="Users Requiring Activation / Deactivation" icon="manage_accounts">
            <div className="space-y-4">
              <p className="text-sm text-text-light bg-background-light p-3 rounded">
                Inactive users below need to be activated before they can access the system, or
                deactivated to revoke access.
              </p>
              {filteredUsers.length === 0 ? (
                <div className="text-center py-10 text-text-light">
                  <span className="material-symbols-outlined text-5xl mb-2 block">check_circle</span>
                  No users pending activation
                </div>
              ) : (
                <Table
                  columns={userColumns}
                  data={filteredUsers}
                  actions={userActions}
                  rowsPerPage={10}
                />
              )}
            </div>
          </Card>
        )}

        {activeTab === "inventory-requests" && (
          <Card title="Inventory Creation Requests (HOD Approved)" icon="inventory_2">
            <div className="space-y-4">
              <p className="text-sm text-text-light bg-background-light p-3 rounded">
                These inventory creation requests have been recommended by the HOD and are awaiting
                your approval. Approving will create the inventory in the system.
              </p>
              {filteredInventoryRequests.length === 0 ? (
                <div className="text-center py-10 text-text-light">
                  <span className="material-symbols-outlined text-5xl mb-2 block">check_circle</span>
                  No pending inventory requests
                </div>
              ) : (
                <Table
                  columns={inventoryRequestColumns}
                  data={filteredInventoryRequests}
                  actions={inventoryRequestActions}
                  rowsPerPage={10}
                />
              )}
            </div>
          </Card>
        )}

        {/* Quick link to full management pages */}
        <div className="flex gap-3 flex-wrap">
          <Button variant="secondary" icon="people" onClick={() => navigate("/admin/users")}>
            Manage All Users
          </Button>
          <Button variant="secondary" icon="inventory_2" onClick={() => navigate("/admin/inventory")}>
            Manage All Inventories
          </Button>
        </div>
      </div>

      {/* Confirm Action Modal */}
      <Modal
        isOpen={confirmModal.open}
        title={confirmTitle}
        onClose={() => setConfirmModal({ open: false, action: null, item: null, type: "" })}
        footer={
          <div className="flex gap-3 justify-end">
            <Button
              variant="secondary"
              onClick={() => setConfirmModal({ open: false, action: null, item: null, type: "" })}
            >
              Cancel
            </Button>
            <Button variant={isDestructive ? "danger" : "primary"} onClick={handleConfirm}>
              Confirm
            </Button>
          </div>
        }
        size="sm"
      >
        <p className="text-text-dark text-sm">{confirmBody}</p>
      </Modal>
    </AdminLayout>
  );
};

export default AdminPendingTasks;
