import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import AdminLayout from "../../Components/Layouts/AdminLayout";
import { Card, Button, Table, Badge, Modal, SearchBox, PageHeader } from "../../Components/UI";
import {
  ACCOUNT_REQUEST_STATUS,
  ACCOUNT_REQUEST_STATUS_META,
  INVENTORY_REQUEST_STATUS_META,
  INVENTORY_REQUEST_TYPE,
  INVENTORY_REQUEST_TYPE_LABELS,
  ROLE_HIERARCHY,
} from "../../utils/constants";

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("currentUser") || "{}");
  } catch {
    return {};
  }
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const AdminPendingTasks = () => {
  const location = useLocation();
  const userRole = localStorage.getItem("userRole") || "admin";
  const isRegistrar = userRole === "registrar";
  const initialTab = location.state?.activeTab;
  const [activeTab, setActiveTab] = useState(
    initialTab || (isRegistrar ? "inventory-requests" : "account-approvals")
  );
  const [searchTerm, setSearchTerm] = useState("");

  // -- Confirm modal state --
  const [confirmModal, setConfirmModal] = useState({ open: false, action: null, item: null, type: "" });
  const [selectedDetails, setSelectedDetails] = useState(null);
  const [detailsModalType, setDetailsModalType] = useState(null);

  const [accountRequests, setAccountRequests] = useState([]);
  const [loadingErrors, setLoadingErrors] = useState({
    accountRequests: "",
    users: "",
    inventoryRequests: "",
    transferRequests: "",
    disposalRequests: "",
  });

  // -- Users that need activate / deactivate action --
  const [users, setUsers] = useState([]);

  const [inventoryRequests, setInventoryRequests] = useState([]);
  const [transferRequests, setTransferRequests] = useState([]);
  const [disposalRequests, setDisposalRequests] = useState([]);

  const loadAccountRequests = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/account-requests?requestType=account_creation,deactivation`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to load account requests.");
      }

      setAccountRequests(data.requests || []);
      setLoadingErrors((prev) => ({ ...prev, accountRequests: "" }));
    } catch (error) {
      setLoadingErrors((prev) => ({ ...prev, accountRequests: error.message || "Failed to load account requests." }));
    }
  };

  const loadInventoryRequests = async () => {
    const approvalStatus = isRegistrar ? "pending_registrar" : "pending_admin";
    const requestTypeQuery = isRegistrar ? "&requestType=new_inventory_creation" : "";

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/inventory-creation-requests?approvalStatus=${approvalStatus}${requestTypeQuery}`
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to load inventory requests.");
      }

      setInventoryRequests(
        (data.requests || []).map((request) => ({
          ...request,
          requestedBy: request.requestedByName || request.requestedBy || "—",
          hodApprovedBy: request.hodApprovedBy || "—",
          hodApprovedDate: request.hodApprovedDate || "",
        }))
      );
      setLoadingErrors((prev) => ({ ...prev, inventoryRequests: "" }));
    } catch (error) {
      setInventoryRequests([]);
      setLoadingErrors((prev) => ({
        ...prev,
        inventoryRequests: error.message || "Failed to load inventory requests.",
      }));
    }
  };

  const loadUsers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/users`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to load users.");
      }

      setUsers(data.users || []);
      setLoadingErrors((prev) => ({ ...prev, users: "" }));
    } catch (error) {
      setLoadingErrors((prev) => ({ ...prev, users: error.message || "Failed to load users." }));
    }
  };

  const loadTransferRequests = async () => {
    if (!isRegistrar) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/item-transfers?approvalStatus=pending_registrar`
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to load transfer requests.");
      }

      setTransferRequests(data.transfers || []);
      setLoadingErrors((prev) => ({ ...prev, transferRequests: "" }));
    } catch (error) {
      setTransferRequests([]);
      setLoadingErrors((prev) => ({
        ...prev,
        transferRequests: error.message || "Failed to load transfer requests.",
      }));
    }
  };

  const loadDisposalRequests = async () => {
    if (!isRegistrar) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/item-disposals?approvalStatus=pending_registrar`
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to load disposal requests.");
      }

      setDisposalRequests(data.disposals || []);
      setLoadingErrors((prev) => ({ ...prev, disposalRequests: "" }));
    } catch (error) {
      setDisposalRequests([]);
      setLoadingErrors((prev) => ({
        ...prev,
        disposalRequests: error.message || "Failed to load disposal requests.",
      }));
    }
  };

  const refreshPendingTasks = () => {
    if (!isRegistrar) {
      loadAccountRequests();
      loadUsers();
    }
    loadInventoryRequests();
    loadTransferRequests();
    loadDisposalRequests();
  };

  React.useEffect(() => {
    refreshPendingTasks();
  }, []);

  React.useEffect(() => {
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
    }
  }, [location.state?.activeTab]);

  React.useEffect(() => {
    const intervalId = window.setInterval(() => {
      refreshPendingTasks();
    }, 15000);

    const handleFocus = () => {
      refreshPendingTasks();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  // ---- Handlers ----
  const openConfirm = (action, item, type) => {
    setConfirmModal({ open: true, action, item, type });
  };

  const openDetails = (item, type) => {
    setSelectedDetails(item);
    setDetailsModalType(type);
  };

  const closeDetails = () => {
    setSelectedDetails(null);
    setDetailsModalType(null);
  };


  const handleConfirm = () => {
    const { action, item, type } = confirmModal;

    if (type === "approve-account") {
      fetch(`${API_BASE_URL}/api/account-requests/${item.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approverRole: "admin" }),
      })
        .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
        .then(({ ok, data }) => {
          if (!ok || !data.success) {
            throw new Error(data.message || data.error || "Failed to approve account.");
          }

          setAccountRequests((prev) =>
            prev.map((r) =>
              r.id === item.id ? { ...r, approvalStatus: ACCOUNT_REQUEST_STATUS.APPROVED_BY_ADMIN } : r
            )
          );

          if (item.requestType === "deactivation" && item.userId) {
            setUsers((prev) =>
              prev.map((u) => (Number(u.id) === Number(item.userId) ? { ...u, status: "inactive" } : u))
            );
          }

          if (data.user) {
            setUsers((prev) => {
              const existingIndex = prev.findIndex((user) => user.email === data.user.email);
              const nextUser = {
                ...(existingIndex >= 0 ? prev[existingIndex] : {}),
                id: data.user.id,
                name: data.user.name || item.name,
                email: data.user.email || item.email,
                role: data.user.role || (["head_of_department", "dean", "registrar", "admin"].includes(item.requestedRole)
                  ? item.requestedRole
                  : "staff"),
                department: item.department,
                designation: data.user.designation || item.designation || "",
                status: "active",
              };

              if (existingIndex >= 0) {
                return prev.map((user, index) => (index === existingIndex ? nextUser : user));
              }

              return [nextUser, ...prev];
            });
          }
        })
        .catch((error) => {
          window.alert(error.message || "Failed to approve account.");
        });
    } else if (type === "reject-account") {
      fetch(`${API_BASE_URL}/api/account-requests/${item.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Rejected from admin pending tasks" }),
      })
        .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
        .then(({ ok, data }) => {
          if (!ok || !data.success) {
            throw new Error(data.message || data.error || "Failed to reject account.");
          }

          setAccountRequests((prev) =>
            prev.map((r) =>
              r.id === item.id ? { ...r, approvalStatus: ACCOUNT_REQUEST_STATUS.REJECTED } : r
            )
          );
        })
        .catch((error) => {
          window.alert(error.message || "Failed to reject account.");
        });
    } else if (type === "activate-user") {
      fetch(`${API_BASE_URL}/api/users/${item.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      })
        .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
        .then(({ ok, data }) => {
          if (!ok || !data.success) {
            throw new Error(data.message || data.error || "Failed to activate user.");
          }

          setUsers((prev) =>
            prev.map((u) => (u.id === item.id ? { ...u, status: "active" } : u))
          );
        })
        .catch((error) => {
          window.alert(error.message || "Failed to activate user.");
        });
    } else if (type === "deactivate-user") {
      fetch(`${API_BASE_URL}/api/users/${item.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "inactive" }),
      })
        .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
        .then(({ ok, data }) => {
          if (!ok || !data.success) {
            throw new Error(data.message || data.error || "Failed to deactivate user.");
          }

          setUsers((prev) =>
            prev.map((u) => (u.id === item.id ? { ...u, status: "inactive" } : u))
          );
        })
        .catch((error) => {
          window.alert(error.message || "Failed to deactivate user.");
        });
    } else if (type === "approve-registrar-inventory") {
      const registrarUser = getStoredUser();
      fetch(`${API_BASE_URL}/api/inventory-creation-requests/${item.id}/approve-registrar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approverUserId: registrarUser.id ?? null }),
      })
        .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
        .then(({ ok, data }) => {
          if (!ok || !data.success) {
            throw new Error(data.message || data.error || "Failed to approve inventory request.");
          }

          setInventoryRequests((prev) => prev.filter((r) => r.id !== item.id));
        })
        .catch((error) => {
          window.alert(error.message || "Failed to approve inventory request.");
        });
    } else if (type === "approve-inventory") {
      const adminUser = getStoredUser();
      fetch(`${API_BASE_URL}/api/inventory-creation-requests/${item.id}/approve-admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approverUserId: adminUser.id ?? null }),
      })
        .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
        .then(({ ok, data }) => {
          if (!ok || !data.success) {
            throw new Error(data.message || data.error || "Failed to approve inventory request.");
          }

          setInventoryRequests((prev) => prev.filter((r) => r.id !== item.id));
        })
        .catch((error) => {
          window.alert(error.message || "Failed to approve inventory request.");
        });
    } else if (type === "reject-inventory") {
      const currentUser = getStoredUser();
      fetch(`${API_BASE_URL}/api/inventory-creation-requests/${item.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approverUserId: currentUser.id ?? null,
          approverRole: isRegistrar ? "registrar" : "admin",
          reason: isRegistrar ? "Rejected from registrar pending tasks" : "Rejected from admin pending tasks",
        }),
      })
        .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
        .then(({ ok, data }) => {
          if (!ok || !data.success) {
            throw new Error(data.message || data.error || "Failed to reject inventory request.");
          }

          setInventoryRequests((prev) => prev.filter((r) => r.id !== item.id));
        })
        .catch((error) => {
          window.alert(error.message || "Failed to reject inventory request.");
        });
    } else if (type === "approve-registrar-transfer") {
      const registrarUser = getStoredUser();
      fetch(`${API_BASE_URL}/api/item-transfers/${item.id}/approve-registrar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approverUserId: registrarUser.id ?? null }),
      })
        .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
        .then(({ ok, data }) => {
          if (!ok || !data.success) {
            throw new Error(data.message || data.error || "Failed to approve transfer request.");
          }
          setTransferRequests((prev) => prev.filter((r) => r.id !== item.id));
        })
        .catch((error) => {
          window.alert(error.message || "Failed to approve transfer request.");
        });
    } else if (type === "reject-transfer") {
      fetch(`${API_BASE_URL}/api/item-transfers/${item.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approverRole: "registrar",
          reason: "Rejected from registrar pending tasks",
        }),
      })
        .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
        .then(({ ok, data }) => {
          if (!ok || !data.success) {
            throw new Error(data.message || data.error || "Failed to reject transfer request.");
          }
          setTransferRequests((prev) => prev.filter((r) => r.id !== item.id));
        })
        .catch((error) => {
          window.alert(error.message || "Failed to reject transfer request.");
        });
    } else if (type === "approve-registrar-disposal") {
      const registrarUser = getStoredUser();
      fetch(`${API_BASE_URL}/api/item-disposals/${item.id}/approve-registrar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approverUserId: registrarUser.id ?? null }),
      })
        .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
        .then(({ ok, data }) => {
          if (!ok || !data.success) {
            throw new Error(data.message || data.error || "Failed to approve disposal request.");
          }
          setDisposalRequests((prev) => prev.filter((r) => r.id !== item.id));
        })
        .catch((error) => {
          window.alert(error.message || "Failed to approve disposal request.");
        });
    } else if (type === "reject-disposal") {
      fetch(`${API_BASE_URL}/api/item-disposals/${item.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approverRole: "registrar",
          reason: "Rejected from registrar pending tasks",
        }),
      })
        .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
        .then(({ ok, data }) => {
          if (!ok || !data.success) {
            throw new Error(data.message || data.error || "Failed to reject disposal request.");
          }
          setDisposalRequests((prev) => prev.filter((r) => r.id !== item.id));
        })
        .catch((error) => {
          window.alert(error.message || "Failed to reject disposal request.");
        });
    }

    setConfirmModal({ open: false, action: null, item: null, type: "" });
    closeDetails();
  };

  // ---- Column / Action definitions ----
  const accountRequestColumns = [
    {
      field: "id",
      label: "No",
      sortable: false,
      render: (_value, row) => filteredAccountRequests.length - filteredAccountRequests.findIndex((request) => request.id === row.id),
    },
    { field: "name", label: "Name", sortable: true },
    { field: "email", label: "Email" },
    {
      field: "designation",
      label: "Designation",
      render: (value) => (
        <Badge
          label={value ? value : "N/A"}
          variant="info"
          size="sm"
        />
      ),
    },
    { field: "department", label: "Department", sortable: true },
    { field: "requestedDate", label: "Date" },
    {
      field: "approvalStatus",
      label: "Status",
      render: (value) => {
        const cfg = ACCOUNT_REQUEST_STATUS_META[value] || { label: value, variant: "secondary" };
        return <Badge label={cfg.label} variant={cfg.variant} size="sm" />;
      },
    },
  ];

  const userColumns = [
    {
      field: "id",
      label: "No",
      sortable: false,
      render: (_value, row) => filteredUsers.length - filteredUsers.findIndex((user) => user.id === row.id),
    },
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

  const transferRequestColumns = [
    {
      field: "id",
      label: "No",
      sortable: false,
      render: (_value, row) =>
        filteredTransferRequests.length -
        filteredTransferRequests.findIndex((request) => request.id === row.id),
    },
    { field: "itemName", label: "Item", sortable: true },
    { field: "fromInventory", label: "From" },
    { field: "toInventory", label: "To" },
    { field: "quantity", label: "Qty" },
    { field: "initiatedBy", label: "Requested By" },
    { field: "transferDate", label: "Date" },
    {
      field: "approvalStatus",
      label: "Status",
      render: (value) => {
        const cfg = INVENTORY_REQUEST_STATUS_META[value] || { label: value, variant: "secondary" };
        return <Badge label={cfg.label} variant={cfg.variant} size="sm" />;
      },
    },
  ];

  const disposalRequestColumns = [
    {
      field: "id",
      label: "No",
      sortable: false,
      render: (_value, row) =>
        filteredDisposalRequests.length -
        filteredDisposalRequests.findIndex((request) => request.id === row.id),
    },
    { field: "itemName", label: "Item", sortable: true },
    { field: "inventory", label: "Inventory" },
    { field: "reason", label: "Reason" },
    { field: "condition", label: "Condition" },
    { field: "initiatedBy", label: "Requested By" },
    { field: "disposalDate", label: "Date" },
    {
      field: "approvalStatus",
      label: "Status",
      render: (value) => {
        const cfg = INVENTORY_REQUEST_STATUS_META[value] || { label: value, variant: "secondary" };
        return <Badge label={cfg.label} variant={cfg.variant} size="sm" />;
      },
    },
  ];

  const inventoryRequestColumns = [
    {
      field: "id",
      label: "No",
      sortable: false,
      render: (_value, row) => filteredInventoryRequests.length - filteredInventoryRequests.findIndex((request) => request.id === row.id),
    },
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
    { field: "requestedBy", label: "Requested By" },
    { field: "hodApprovedBy", label: "HOD Approved By" },
    { field: "hodApprovedDate", label: "HOD Approval Date" },
    { field: "reason", label: "Reason" },
    {
      field: "approvalStatus",
      label: "Status",
      render: (value) => {
        const cfg = INVENTORY_REQUEST_STATUS_META[value] || { label: value, variant: "secondary" };
        return <Badge label={cfg.label} variant={cfg.variant} size="sm" />;
      },
    },
  ];

  // ---- Filtered data ----
  const pendingAccountRequests = accountRequests.filter(
    (r) => r.approvalStatus === ACCOUNT_REQUEST_STATUS.PENDING_ADMIN
  );
  const blockedAccountUserIds = new Set(
    accountRequests
      .filter((request) => request.approvalStatus !== ACCOUNT_REQUEST_STATUS.APPROVED_BY_ADMIN)
      .map((request) => Number(request.userId))
      .filter((userId) => Number.isInteger(userId) && userId > 0)
  );
  const pendingInventoryRequests = inventoryRequests;
  const inactiveUsers = users.filter(
    (u) => u.status === "inactive" && !blockedAccountUserIds.has(Number(u.id))
  );

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
  const filteredTransferRequests = transferRequests.filter((r) => {
    const term = searchTerm.toLowerCase();
    return (
      r.itemName?.toLowerCase().includes(term) ||
      r.fromInventory?.toLowerCase().includes(term) ||
      r.toInventory?.toLowerCase().includes(term) ||
      r.initiatedBy?.toLowerCase().includes(term)
    );
  });
  const filteredDisposalRequests = disposalRequests.filter((r) => {
    const term = searchTerm.toLowerCase();
    return (
      r.itemName?.toLowerCase().includes(term) ||
      r.inventory?.toLowerCase().includes(term) ||
      r.reason?.toLowerCase().includes(term) ||
      r.initiatedBy?.toLowerCase().includes(term)
    );
  });

  const totalPending = isRegistrar
    ? pendingInventoryRequests.length + transferRequests.length + disposalRequests.length
    : pendingAccountRequests.length + inactiveUsers.length + pendingInventoryRequests.length;

  // ---- Confirm modal text ----
  const getConfirmText = () => {
    const { type, item } = confirmModal;
    if (!item) return {};
    if (type === "approve-account") {
      const isDeactivation = item.requestType === "deactivation";
      return isDeactivation
        ? {
            title: "Approve Deactivation",
            body: `Approve the deactivation request for ${item.name}? Their account will be set to inactive.`,
          }
        : {
            title: "Approve Account",
            body: `Approve and create account for ${item.name}? They will be granted "${ROLE_HIERARCHY[item.requestedRole]?.label || item.requestedRole}" access.`,
          };
    }
    if (type === "reject-account") {
      const isDeactivation = item.requestType === "deactivation";
      return {
        title: isDeactivation ? "Reject Deactivation Request" : "Reject Account Request",
        body: isDeactivation
          ? `Reject the deactivation request for ${item.name}?`
          : `Reject account creation request for ${item.name}?`,
      };
    }
    if (type === "activate-user")
      return { title: "Activate User", body: `Activate ${item.name}'s account? They will be able to log in.` };
    if (type === "deactivate-user")
      return { title: "Deactivate User", body: `Deactivate ${item.name}'s account? They will lose system access.` };
    if (type === "approve-registrar-inventory") {
      return {
        title: "Approve for Admin Activation",
        body: `Approve "${item.name}" for ${item.department} and forward it to the administrator for activation?`,
      };
    }
    if (type === "approve-inventory") {
      const isAddExisting = item.requestType === INVENTORY_REQUEST_TYPE.ADD_EXISTING;
      return isAddExisting
        ? { title: "Activate Inventory", body: `Activate the existing inventory "${item.name}" for ${item.department} in the system?` }
        : { title: "Approve Inventory Creation", body: `Approve creation of the "${item.name}" inventory for ${item.department}?` };
    }
    if (type === "reject-inventory")
      return { title: "Reject Inventory Request", body: `Reject the inventory creation request for "${item.name}"?` };
    if (type === "approve-registrar-transfer") {
      return {
        title: "Approve Item Transfer",
        body: `Approve transfer of "${item.itemName}" from ${item.fromInventory} to ${item.toInventory} and forward to the administrator?`,
      };
    }
    if (type === "reject-transfer") {
      return {
        title: "Reject Item Transfer",
        body: `Reject the transfer request for "${item.itemName}"?`,
      };
    }
    if (type === "approve-registrar-disposal") {
      return {
        title: "Approve Item Disposal",
        body: `Approve disposal of "${item.itemName}" from ${item.inventory} and forward to the administrator?`,
      };
    }
    if (type === "reject-disposal") {
      return {
        title: "Reject Item Disposal",
        body: `Reject the disposal request for "${item.itemName}"?`,
      };
    }
    return {};
  };

  const { title: confirmTitle, body: confirmBody } = getConfirmText();
  const isDestructive = confirmModal.type?.startsWith("reject") || confirmModal.type === "deactivate-user";

  const buildAccountDetailFields = (request) => {
    const statusConfig = ACCOUNT_REQUEST_STATUS_META[request.approvalStatus] || {
      label: request.approvalStatus,
    };

    return [
      { label: "Name", value: request.name },
      { label: "Email", value: request.email },
      { label: "Department", value: request.department },
      { label: "Designation", value: request.designation },
      {
        label: "Requested role",
        value: ROLE_HIERARCHY[request.requestedRole]?.label || request.requestedRole,
      },
      {
        label: "Request type",
        value: request.requestType === "deactivation" ? "Deactivation" : "Account creation",
      },
      { label: "Requested date", value: request.requestedDate },
      { label: "Status", value: statusConfig.label },
    ];
  };

  const buildUserDetailFields = (user) => [
    { label: "Name", value: user.name },
    { label: "Email", value: user.email },
    { label: "Department", value: user.department },
    { label: "Role", value: ROLE_HIERARCHY[user.role]?.label || user.role },
    {
      label: "Status",
      value: user.status ? user.status.charAt(0).toUpperCase() + user.status.slice(1) : "-",
    },
    { label: "Created date", value: user.createdDate },
  ];

  const buildTransferDetailFields = (request) => {
    const statusConfig = INVENTORY_REQUEST_STATUS_META[request.approvalStatus] || {
      label: request.approvalStatus,
    };

    return [
      { label: "Item", value: request.itemName },
      { label: "From inventory", value: request.fromInventory },
      { label: "To inventory", value: request.toInventory },
      { label: "Quantity", value: request.quantity },
      { label: "Requested by", value: request.initiatedBy },
      { label: "Transfer date", value: request.transferDate },
      { label: "Status", value: statusConfig.label },
      { label: "Reason", value: request.reason, fullWidth: true },
    ];
  };

  const buildDisposalDetailFields = (request) => {
    const statusConfig = INVENTORY_REQUEST_STATUS_META[request.approvalStatus] || {
      label: request.approvalStatus,
    };

    return [
      { label: "Item", value: request.itemName },
      { label: "Inventory", value: request.inventory },
      { label: "Quantity", value: request.quantity },
      { label: "Reason", value: request.reason },
      { label: "Condition", value: request.condition },
      { label: "Requested by", value: request.initiatedBy },
      { label: "Disposal date", value: request.disposalDate },
      { label: "Status", value: statusConfig.label },
      { label: "Description", value: request.description, fullWidth: true },
    ];
  };

  const buildInventoryDetailFields = (request) => {
    const statusConfig = INVENTORY_REQUEST_STATUS_META[request.approvalStatus] || {
      label: request.approvalStatus,
    };

    return [
      {
        label: "Request type",
        value: INVENTORY_REQUEST_TYPE_LABELS[request.requestType] || request.requestType,
      },
      { label: "Inventory name", value: request.name },
      { label: "Department", value: request.department },
      { label: "Requested by", value: request.requestedBy },
      { label: "HOD approved by", value: request.hodApprovedBy },
      { label: "HOD approval date", value: request.hodApprovedDate },
      { label: "Status", value: statusConfig.label },
      { label: "Reason", value: request.reason, fullWidth: true },
    ];
  };

  const detailFields =
    detailsModalType === "account" && selectedDetails
      ? buildAccountDetailFields(selectedDetails)
      : detailsModalType === "user" && selectedDetails
        ? buildUserDetailFields(selectedDetails)
        : detailsModalType === "inventory" && selectedDetails
          ? buildInventoryDetailFields(selectedDetails)
          : detailsModalType === "transfer" && selectedDetails
            ? buildTransferDetailFields(selectedDetails)
            : detailsModalType === "disposal" && selectedDetails
              ? buildDisposalDetailFields(selectedDetails)
              : [];

  const detailModalTitle =
    detailsModalType === "account"
      ? "Account request details"
      : detailsModalType === "user"
        ? "User details"
        : detailsModalType === "inventory"
          ? "Inventory creation details"
          : detailsModalType === "transfer"
            ? "Item transfer details"
            : detailsModalType === "disposal"
              ? "Item disposal details"
              : "Details";

  const detailSelectedName =
    detailsModalType === "transfer" || detailsModalType === "disposal"
      ? selectedDetails?.itemName
      : selectedDetails?.name;

  const tabs = isRegistrar
    ? [
        {
          id: "inventory-requests",
          label: "Inventory Creation",
          icon: "inventory_2",
          count: pendingInventoryRequests.length,
        },
        {
          id: "transfer-requests",
          label: "Item Transfers",
          icon: "compare_arrows",
          count: transferRequests.length,
        },
        {
          id: "disposal-requests",
          label: "Item Disposals",
          icon: "delete_sweep",
          count: disposalRequests.length,
        },
      ]
    : [
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
      <PageHeader
        title={isRegistrar ? "Approvals" : "Pending Tasks"}
        subtitle={
          isRegistrar
            ? "Review and approve inventory creation, item transfers, and item disposals"
            : "Actions requiring admin approval or intervention"
        }
        actions={
          totalPending > 0 ? (
            <span className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/15 px-4 py-2 text-sm font-semibold text-white">
              <span className="material-symbols-outlined text-base">schedule</span>
              {totalPending} task{totalPending !== 1 ? "s" : ""} pending
            </span>
          ) : null
        }
      />

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
          placeholder={
            isRegistrar ? "Search by item, inventory, or requester..." : "Search by name or department..."
          }
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          icon="search"
        />

        {(loadingErrors.accountRequests ||
          loadingErrors.users ||
          loadingErrors.inventoryRequests ||
          loadingErrors.transferRequests ||
          loadingErrors.disposalRequests) && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {[
              loadingErrors.accountRequests,
              loadingErrors.users,
              loadingErrors.inventoryRequests,
              loadingErrors.transferRequests,
              loadingErrors.disposalRequests,
            ]
              .filter(Boolean)
              .join(" ")}
          </div>
        )}

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
                  onRowClick={(row) => openDetails(row, "account")}
                  searchable={false}
                  itemsPerPage={10}
                />
              )}
            </div>
          </Card>
        )}

        {activeTab === "user-activation" && (
          <Card title="Users Requiring Activation / Deactivation" icon="manage_accounts">
            <div className="space-y-4">
              <p className="text-sm text-text-light bg-background-light p-3 rounded">
                Only inactive users outside the signup approval workflow are shown here. Newly signed-up users stay hidden until the HOD and admin approval chain is completed.
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
                  onRowClick={(row) => openDetails(row, "user")}
                  searchable={false}
                  itemsPerPage={10}
                />
              )}
            </div>
          </Card>
        )}

        {activeTab === "transfer-requests" && isRegistrar && (
          <Card title="Item Transfers (Awaiting Registrar)" icon="compare_arrows">
            <div className="space-y-4">
              <p className="text-sm text-text-light bg-background-light p-3 rounded">
                Item transfer requests approved by the HOD are listed here. Approve to forward them to the
                administrator for final processing.
              </p>
              {filteredTransferRequests.length === 0 ? (
                <div className="text-center py-10 text-text-light">
                  <span className="material-symbols-outlined text-5xl mb-2 block">check_circle</span>
                  No pending transfer requests
                </div>
              ) : (
                <Table
                  columns={transferRequestColumns}
                  data={filteredTransferRequests}
                  onRowClick={(row) => openDetails(row, "transfer")}
                  searchable={false}
                  itemsPerPage={10}
                />
              )}
            </div>
          </Card>
        )}

        {activeTab === "disposal-requests" && isRegistrar && (
          <Card title="Item Disposals (Awaiting Registrar)" icon="delete_sweep">
            <div className="space-y-4">
              <p className="text-sm text-text-light bg-background-light p-3 rounded">
                Item disposal requests approved by the HOD are listed here. Approve to forward them to the
                administrator for final processing.
              </p>
              {filteredDisposalRequests.length === 0 ? (
                <div className="text-center py-10 text-text-light">
                  <span className="material-symbols-outlined text-5xl mb-2 block">check_circle</span>
                  No pending disposal requests
                </div>
              ) : (
                <Table
                  columns={disposalRequestColumns}
                  data={filteredDisposalRequests}
                  onRowClick={(row) => openDetails(row, "disposal")}
                  searchable={false}
                  itemsPerPage={10}
                />
              )}
            </div>
          </Card>
        )}

        {activeTab === "inventory-requests" && (
          <Card
            title={isRegistrar ? "Inventory Creation (Awaiting Registrar)" : "Inventory Requests (Awaiting Admin)"}
            icon="inventory_2"
          >
            <div className="space-y-4">
              <p className="text-sm text-text-light bg-background-light p-3 rounded">
                {isRegistrar
                  ? "New inventory creation requests approved by the HOD are listed here. Approve to forward them to the administrator for activation."
                  : "New inventory creation and existing inventory addition requests approved by the HOD (or registrar) are listed here. Approve to create or activate the inventory in the system."}
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
                  onRowClick={(row) => openDetails(row, "inventory")}
                  searchable={false}
                  itemsPerPage={10}
                />
              )}
            </div>
          </Card>
        )}

      </div>

      <Modal
        isOpen={Boolean(selectedDetails && detailsModalType)}
        onClose={closeDetails}
        title={detailModalTitle}
        size="lg"
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="secondary" onClick={closeDetails}>
              Close
            </Button>
            {detailsModalType === "account" && selectedDetails ? (
              <>
                <Button
                  variant="danger"
                  icon="cancel"
                  onClick={() => openConfirm("reject", selectedDetails, "reject-account")}
                >
                  Reject
                </Button>
                <Button
                  variant="primary"
                  icon="check_circle"
                  onClick={() => openConfirm("approve", selectedDetails, "approve-account")}
                >
                  Approve
                </Button>
              </>
            ) : null}
            {detailsModalType === "user" && selectedDetails ? (
              selectedDetails.status === "inactive" ? (
                <Button
                  variant="primary"
                  icon="check_circle"
                  onClick={() => openConfirm("activate", selectedDetails, "activate-user")}
                >
                  Activate
                </Button>
              ) : (
                <Button
                  variant="danger"
                  icon="block"
                  onClick={() => openConfirm("deactivate", selectedDetails, "deactivate-user")}
                >
                  Deactivate
                </Button>
              )
            ) : null}
            {detailsModalType === "inventory" && selectedDetails ? (
              <>
                <Button
                  variant="danger"
                  icon="cancel"
                  onClick={() => openConfirm("reject", selectedDetails, "reject-inventory")}
                >
                  Reject
                </Button>
                <Button
                  variant="primary"
                  icon="check_circle"
                  onClick={() =>
                    openConfirm(
                      "approve",
                      selectedDetails,
                      isRegistrar ? "approve-registrar-inventory" : "approve-inventory"
                    )
                  }
                >
                  {isRegistrar ? "Approve & Forward" : "Approve & Create"}
                </Button>
              </>
            ) : null}
            {detailsModalType === "transfer" && selectedDetails ? (
              <>
                <Button
                  variant="danger"
                  icon="cancel"
                  onClick={() => openConfirm("reject", selectedDetails, "reject-transfer")}
                >
                  Reject
                </Button>
                <Button
                  variant="primary"
                  icon="check_circle"
                  onClick={() =>
                    openConfirm("approve", selectedDetails, "approve-registrar-transfer")
                  }
                >
                  Approve & Forward
                </Button>
              </>
            ) : null}
            {detailsModalType === "disposal" && selectedDetails ? (
              <>
                <Button
                  variant="danger"
                  icon="cancel"
                  onClick={() => openConfirm("reject", selectedDetails, "reject-disposal")}
                >
                  Reject
                </Button>
                <Button
                  variant="primary"
                  icon="check_circle"
                  onClick={() =>
                    openConfirm("approve", selectedDetails, "approve-registrar-disposal")
                  }
                >
                  Approve & Forward
                </Button>
              </>
            ) : null}
          </div>
        }
      >
        {selectedDetails ? (
          <div className="space-y-4">
            <div className="bg-background-light p-4 rounded-lg">
              <p className="text-sm text-text-light">Selected</p>
              <p className="text-lg font-semibold text-text-dark">{detailSelectedName || "-"}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {detailFields.map((detail) => (
                <div key={detail.label} className={detail.fullWidth ? "md:col-span-2" : ""}>
                  <p className="text-text-light">{detail.label}</p>
                  <p className="font-semibold text-text-dark whitespace-pre-wrap">{detail.value || "-"}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-text-light">Select an action below to approve, reject, or update status.</p>
          </div>
        ) : null}
      </Modal>

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
