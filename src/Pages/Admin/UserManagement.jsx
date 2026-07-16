import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AdminLayout from "../../Components/Layouts/AdminLayout";
import { Card, Button, SearchBox, Table, Badge, Modal, FormInput, Select, EntityDetailsModal, PageHeader, SummaryCard, SummaryCardsGrid } from "../../Components/UI";
import { ROLE_HIERARCHY, ACCOUNT_REQUEST_STATUS, ACCOUNT_REQUEST_STATUS_META } from "../../utils/constants";
import {
  getPasswordStrength,
  getPasswordStrengthColorClass,
  isPasswordValid,
  PASSWORD_MAX_LENGTH,
  PASSWORD_REQUIREMENTS_MESSAGE,
} from "../../utils/passwordValidation";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const normalizeStatus = (status) => String(status || "").toLowerCase();

const UserManagement = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isApproveAccountModalOpen, setIsApproveAccountModalOpen] = useState(false);
  const [isUserDetailsModalOpen, setIsUserDetailsModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedUserName, setSelectedUserName] = useState("");
  const [selectedUserDetails, setSelectedUserDetails] = useState(null);
  const [resetOtp, setResetOtp] = useState("");
  const [resetOtpSent, setResetOtpSent] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetPasswordStrength, setResetPasswordStrength] = useState(0);
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState("");
  const [activeTab, setActiveTab] = useState("active-users");
  const [otherDesignation, setOtherDesignation] = useState("");
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    mobileNo: "",
    officeExtNo: "",
    role: "staff",
    department: "",
    designation: "",
    password: "",
    confirmPassword: "",
  });
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState("");
  const [accountRequestsLoading, setAccountRequestsLoading] = useState(true);
  const [accountRequestsError, setAccountRequestsError] = useState("");
  const [submitError, setSubmitError] = useState("");

  const [accountRequests, setAccountRequests] = useState([]);
  const [departments, setDepartments] = useState([]);

  const loadUsers = async () => {
    try {
      setUsersLoading(true);
      setUsersError("");
      const response = await fetch(`${API_BASE_URL}/api/users`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to load users from database.");
      }

      setUsers(data.users || []);
    } catch (error) {
      console.error("Failed to fetch users:", error);
      setUsers([]);
      setUsersError(error.message || "Unable to load users from the database.");
    } finally {
      setUsersLoading(false);
    }
  };

  const loadAccountRequests = async () => {
    try {
      setAccountRequestsLoading(true);
      setAccountRequestsError("");
      const response = await fetch(`${API_BASE_URL}/api/account-requests?requestType=account_creation&adminQueue=true`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to load account requests.");
      }

      setAccountRequests(data.requests || []);
    } catch (error) {
      setAccountRequests([]);
      setAccountRequestsError(error.message || "Unable to load account requests.");
    } finally {
      setAccountRequestsLoading(false);
    }
  };

  const refreshAdminData = () => {
    loadUsers();
    loadAccountRequests();
  };

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
        const config = ACCOUNT_REQUEST_STATUS_META[value] || { label: value, variant: "secondary" };
        return <Badge label={config.label} variant={config.variant} size="sm" />;
      },
    },
    { field: "requestedDate", label: "Requested Date" },
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

  useEffect(() => {
    const tab = location.state?.activeTab;
    if (tab === "pending-approvals" || tab === "inactive-users" || tab === "active-users") {
      setActiveTab(tab);
    }
  }, [location.state?.activeTab]);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadDepartments = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/departments`);
        const data = await response.json();

        if (!isMounted) return;

        if (response.ok) {
          setDepartments(data.departments ?? data ?? []);
        }
      } catch (error) {
        console.error("Failed to fetch departments:", error);
      }
    };

    loadDepartments();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    loadAccountRequests();
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadAccountRequests();
    }, 15000);

    const handleFocus = () => {
      refreshAdminData();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const handleSelectChange = (name) => (value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === "password") {
      setPasswordStrength(getPasswordStrength(value));
    }
  };

  const hasDeanAccount = users.some((user) => user.role === "dean");
  const hasRegistrarAccount = users.some((user) => user.role === "registrar");
  const hasDepartmentHodAccount = users.some(
    (user) => user.role === "head_of_department" && user.department === formData.department
  );
  const createRoleOptions = [
    { value: "staff", label: ROLE_HIERARCHY.staff.label },
    ...(!hasDepartmentHodAccount ? [{ value: "head_of_department", label: ROLE_HIERARCHY.head_of_department.label }] : []),
    ...(!hasDeanAccount ? [{ value: "dean", label: ROLE_HIERARCHY.dean.label }] : []),
    ...(!hasRegistrarAccount ? [{ value: "registrar", label: ROLE_HIERARCHY.registrar.label }] : []),
  ];
  const isDirectProvisionedRole = ["head_of_department", "dean", "registrar", "admin"].includes(formData.role);
  const isRegistrarRole = formData.role === "registrar";
  const departmentOptions = useMemo(
    () => departments
      .map((dept) => ({
        value: dept.name || dept.code || String(dept.id || ""),
        label: dept.name || dept.code || String(dept.id || ""),
      }))
      .filter((option) => option.value),
    [departments]
  );

  useEffect(() => {
    if (!createRoleOptions.some((option) => option.value === formData.role)) {
      setFormData((prev) => ({ ...prev, role: "staff" }));
    }
  }, [createRoleOptions, formData.role]);

  useEffect(() => {
    if (isRegistrarRole && (formData.department || formData.designation)) {
      setFormData((prev) => ({ ...prev, department: "", designation: "" }));
      setOtherDesignation("");
    }
  }, [isRegistrarRole, formData.department, formData.designation]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");

    // Validate passwords
    if (formData.password !== formData.confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    if (!isPasswordValid(formData.password)) {
      alert(PASSWORD_REQUIREMENTS_MESSAGE);
      return;
    }
    
    // If "Other" is selected, use the custom designation
    const finalDesignation = isRegistrarRole
      ? ""
      : formData.designation === "Other"
        ? otherDesignation
        : formData.designation;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: formData.name,
          email: formData.email,
          mobileNo: formData.mobileNo,
          officeExtNo: formData.officeExtNo,
          password: formData.password,
          role: formData.role,
          createdByRole: "admin",
          department: isRegistrarRole ? "" : formData.department,
          designation: finalDesignation,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || "Failed to submit account request.");
      }

      if (data.user && !data.request) {
        setUsers((prev) => [
          {
            id: data.user.id,
            name: data.user.name || formData.name,
            email: data.user.email || formData.email,
            role: data.user.role || formData.role,
            department: data.user.department || (isRegistrarRole ? "-" : formData.department),
            designation: data.user.designation || finalDesignation,
            mobileNo: data.user.mobileNo || formData.mobileNo,
            officeExtNo: data.user.officeExtNo || formData.officeExtNo,
            status: data.user.status || "active",
            createdDate: new Date().toISOString().split("T")[0],
          },
          ...prev,
        ]);
      } else {
        setAccountRequests((prev) => [
          {
            id: data.request?.id || Date.now(),
            name: formData.name,
            email: formData.email,
            requestedRole: formData.role,
            department: isRegistrarRole ? "-" : formData.department,
            designation: finalDesignation,
            requestedDate: new Date().toISOString().split("T")[0],
            requestedByDeptHead: "-",
            approvalStatus: ACCOUNT_REQUEST_STATUS.PENDING_DEPT_HEAD,
          },
          ...prev,
        ]);
      }

      window.alert(
        data.message || (data.user ? "User account created successfully." : "Account request submitted successfully.")
      );
      setIsModalOpen(false);
      setFormData({ name: "", email: "", mobileNo: "", officeExtNo: "", role: "staff", department: "", designation: "", password: "", confirmPassword: "" });
      setOtherDesignation("");
      setPasswordStrength(0);
    } catch (error) {
      setSubmitError(error.message || "Failed to submit account request.");
    }
  };

  const updateUserStatus = async (user, nextStatus) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/${user.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to update user status.");
      }

      setUsers((prevUsers) =>
        prevUsers.map((u) =>
          u.id === user.id ? { ...u, status: nextStatus } : u
        )
      );

      return {
        success: true,
        message: data.message || `User marked as ${nextStatus}.`,
      };
    } catch (error) {
      window.alert(error.message || "Failed to update user status.");
      return { success: false };
    }
  };

  const handleDeactivateUser = async (user) => {
    const confirmed = window.confirm(
      `Deactivate ${user.name}'s account? They will lose system access until reactivated. Account history is preserved.`
    );
    if (!confirmed) return;

    const result = await updateUserStatus(user, "inactive");
    if (result?.success) {
      setSelectedUserDetails((prev) =>
        prev && prev.id === user.id ? { ...prev, status: "inactive" } : prev
      );
      window.alert(result.message || `${user.name}'s account has been deactivated.`);
    }
  };

  const handleReactivateUser = async (user) => {
    const confirmed = window.confirm(
      `Reactivate ${user.name}'s account? They will be able to log in again.`
    );
    if (!confirmed) return;

    const result = await updateUserStatus(user, "active");
    if (result?.success) {
      setSelectedUserDetails((prev) =>
        prev && prev.id === user.id ? { ...prev, status: "active" } : prev
      );
      window.alert(result.message || `${user.name}'s account has been reactivated.`);
    }
  };

  const closeUserDetails = () => {
    setIsUserDetailsModalOpen(false);
    setSelectedUserDetails(null);
    setResetOtp("");
    setResetOtpSent(false);
    setResetPassword("");
    setResetConfirmPassword("");
    setResetPasswordStrength(0);
    setResetPasswordError("");
  };

  const handleViewUserDetails = (user) => {
    setSelectedUserDetails(user);
    setResetOtp("");
    setResetOtpSent(false);
    setResetPassword("");
    setResetConfirmPassword("");
    setResetPasswordStrength(0);
    setResetPasswordError("");
    setIsUserDetailsModalOpen(true);
  };

  const handleResetPasswordChange = (e) => {
    const { name, value } = e.target;
    if (name === "resetOtp") {
      setResetOtp(value.replace(/\D/g, "").slice(0, 6));
    } else if (name === "resetPassword") {
      if (resetOtpSent) {
        setResetOtpSent(false);
        setResetOtp("");
      }
      setResetPassword(value);
      setResetPasswordStrength(getPasswordStrength(value));
    } else if (name === "resetConfirmPassword") {
      if (resetOtpSent) {
        setResetOtpSent(false);
        setResetOtp("");
      }
      setResetConfirmPassword(value);
    }
    setResetPasswordError("");
  };

  const handleAdminSendResetOtp = async () => {
    if (!selectedUserDetails?.id) return;

    setResetPasswordError("");

    if (!resetPassword) {
      setResetPasswordError("Enter the new password before sending OTP.");
      return;
    }

    if (!isPasswordValid(resetPassword)) {
      setResetPasswordError(PASSWORD_REQUIREMENTS_MESSAGE);
      return;
    }

    if (resetPassword !== resetConfirmPassword) {
      setResetPasswordError("Passwords do not match.");
      return;
    }

    const confirmed = window.confirm(
      `Send a password reset OTP email to ${selectedUserDetails.name}? Confirm this was requested by the user.`
    );
    if (!confirmed) return;

    try {
      setResetPasswordLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/users/${selectedUserDetails.id}/password-reset-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPassword }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to send password reset OTP.");
      }

      setResetOtpSent(true);
      setResetOtp("");
      window.alert(data.message || "Password reset OTP sent successfully.");
    } catch (error) {
      setResetPasswordError(error.message || "Failed to send password reset OTP.");
    } finally {
      setResetPasswordLoading(false);
    }
  };

  const handleAdminResetPassword = async () => {
    if (!selectedUserDetails?.id) return;

    setResetPasswordError("");

    if (!resetOtpSent) {
      setResetPasswordError("Send the reset OTP to the user's email first.");
      return;
    }

    if (resetOtp.length !== 6) {
      setResetPasswordError("Enter the 6-digit verification code sent to the user.");
      return;
    }

    if (!resetPassword) {
      setResetPasswordError("Enter a new password.");
      return;
    }

    if (!isPasswordValid(resetPassword)) {
      setResetPasswordError(PASSWORD_REQUIREMENTS_MESSAGE);
      return;
    }

    if (resetPassword !== resetConfirmPassword) {
      setResetPasswordError("Passwords do not match.");
      return;
    }

    const confirmed = window.confirm(
      `Reset the password for ${selectedUserDetails.name} using the verified OTP?`
    );
    if (!confirmed) return;

    try {
      setResetPasswordLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/users/${selectedUserDetails.id}/password-reset-with-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          otp: resetOtp,
          password: resetPassword,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to reset password.");
      }

      setResetOtp("");
      setResetOtpSent(false);
      setResetPassword("");
      setResetConfirmPassword("");
      setResetPasswordStrength(0);
      window.alert(data.message || "Password reset successfully.");
    } catch (error) {
      setResetPasswordError(error.message || "Failed to reset password.");
    } finally {
      setResetPasswordLoading(false);
    }
  };

  const handleApproveAccount = (request) => {
    setSelectedUserId(request.id);
    setSelectedUserName(request.name);
    setIsApproveAccountModalOpen(true);
  };

  const handleRejectAccount = (request) => {
    fetch(`${API_BASE_URL}/api/account-requests/${request.id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Rejected from admin user management" }),
    })
      .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
      .then(({ ok, data }) => {
        if (!ok || !data.success) {
          throw new Error(data.message || data.error || "Failed to reject account request.");
        }

        setAccountRequests((prev) =>
          prev.map((r) =>
            r.id === request.id ? { ...r, approvalStatus: ACCOUNT_REQUEST_STATUS.REJECTED } : r
          )
        );
      })
      .catch((error) => {
        window.alert(error.message || "Failed to reject account request.");
      });
  };

  const handleApproveAccountSubmit = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/account-requests/${selectedUserId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approverRole: "admin" }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to approve account request.");
      }

      setAccountRequests((prev) =>
        prev.map((r) =>
          r.id === selectedUserId ? { ...r, approvalStatus: ACCOUNT_REQUEST_STATUS.APPROVED_BY_ADMIN } : r
        )
      );

      const request = accountRequests.find((r) => r.id === selectedUserId);
      if (request && data.user) {
        setUsers((prev) => {
          const existingIndex = prev.findIndex((user) => user.email === request.email);
          const nextUser = {
            ...(existingIndex >= 0 ? prev[existingIndex] : {}),
            id: data.user.id,
            name: data.user.name || request.name,
            email: data.user.email || request.email,
            role: data.user.role || (["head_of_department", "dean", "registrar", "admin"].includes(request.requestedRole)
              ? request.requestedRole
              : "staff"),
            department: request.department,
            designation: data.user.designation || request.designation || "",
            status: "active",
          };

          if (existingIndex >= 0) {
            return prev.map((user, index) => (index === existingIndex ? { ...user, ...nextUser } : user));
          }

          return [
            {
              id: request.userId || Math.max(...prev.map((user) => Number(user.id) || 0), 0) + 1,
              createdDate: new Date().toISOString().split("T")[0],
              ...nextUser,
            },
            ...prev,
          ];
        });
      }

      setIsApproveAccountModalOpen(false);
      setSelectedUserId(null);
      setSelectedUserName("");
    } catch (error) {
      window.alert(error.message || "Failed to approve account request.");
    }
  };

  const blockedAccountUserIds = new Set(
    accountRequests
      .filter((request) => request.approvalStatus !== ACCOUNT_REQUEST_STATUS.APPROVED_BY_ADMIN)
      .map((request) => Number(request.userId))
      .filter((userId) => Number.isInteger(userId) && userId > 0)
  );

  const matchesUserSearch = (user) =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase());

  const filteredUsers = users.filter(
    (user) => normalizeStatus(user.status) === "active" && matchesUserSearch(user)
  );

  const inactiveUserList = users.filter(
    (user) =>
      normalizeStatus(user.status) === "inactive" &&
      !blockedAccountUserIds.has(Number(user.id))
  );

  const filteredInactiveUsers = inactiveUserList.filter(matchesUserSearch);

  const filteredRequests = accountRequests.filter(
    (request) =>
      request.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getAccountRequestActions = (row) => (
    row.canAdminAct ? requestActions : []
  );

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => normalizeStatus(u.status) === "active").length;
  const inactiveUsersCount = inactiveUserList.length;
  const pendingRequests = accountRequests.length;
  const hideSummaryCards = location.state?.hideSummaryCards === true;

  const currentUserTableRows =
    activeTab === "inactive-users" ? filteredInactiveUsers : filteredUsers;

  const userColumns = useMemo(
    () => [
      { field: "name", label: "Name", sortable: true },
      { field: "department", label: "Department", sortable: true },
      { field: "designation", label: "Designation", sortable: true },
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
        render: (value) => {
          const normalized = normalizeStatus(value);
          return (
            <Badge
              label={normalized.charAt(0).toUpperCase() + normalized.slice(1)}
              variant={normalized === "active" ? "success" : "warning"}
              size="sm"
            />
          );
        },
      },
    ],
    []
  );

  const selectedUserIsInactive =
    normalizeStatus(selectedUserDetails?.status) === "inactive";

  const modalFooter = (
    <div className="flex gap-3 justify-end">
      <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
        Cancel
      </Button>
      <Button variant="primary" onClick={handleSubmit}>
        {isDirectProvisionedRole ? "Create & Activate User" : "Submit Request"}
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

  const userDetailsFooter = (
    <div className="flex flex-wrap justify-end gap-3">
      <Button variant="secondary" onClick={closeUserDetails}>
        Close
      </Button>
      {selectedUserDetails && selectedUserIsInactive ? (
        <Button
          variant="primary"
          icon="check_circle"
          onClick={() => handleReactivateUser(selectedUserDetails)}
        >
          Reactivate
        </Button>
      ) : null}
    </div>
  );

  return (
    <AdminLayout>
      <PageHeader
        title="User Management"
        subtitle="Manage users, account approvals, and password resets"
        actions={
          <Button icon="add_circle" onClick={() => navigate('/admin/users/create')}>
            Create User
          </Button>
        }
      />

      <div className="p-6 space-y-6">

        {/* Stats */}
        {!hideSummaryCards && (
          <SummaryCardsGrid showTitle={false} columns="4-equal">
            <SummaryCard title="Total Users" count={totalUsers} icon="people" />
            <SummaryCard title="Active" count={activeUsers} icon="check_circle" countClassName="text-success" />
            <SummaryCard
              title="Inactive Users"
              count={inactiveUsersCount}
              description="Click to view and reactivate"
              icon="person_off"
              countClassName="text-warning"
              active={activeTab === "inactive-users"}
              onClick={() => setActiveTab("inactive-users")}
            />
            <SummaryCard title="Pending Approvals" count={pendingRequests} icon="hourglass_empty" countClassName="text-info" />
          </SummaryCardsGrid>
        )}

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
              onClick={() => setActiveTab("inactive-users")}
              className={`px-6 py-3 border-b-2 font-medium transition-colors ${
                activeTab === "inactive-users"
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-text-light hover:text-text-dark"
              }`}
            >
              Inactive Users {inactiveUsersCount > 0 && `(${inactiveUsersCount})`}
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
          placeholder={
            activeTab === "pending-approvals"
              ? "Search account requests..."
              : "Search users by name or email..."
          }
        />

        {activeTab !== "pending-approvals" && usersError && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {usersError}
          </div>
        )}

        {activeTab === "pending-approvals" && accountRequestsError && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {accountRequestsError}
          </div>
        )}

        {/* Users Table or Requests Table */}
        {activeTab === "active-users" || activeTab === "inactive-users" ? (
          <Card
            title={activeTab === "inactive-users" ? "Inactive Users" : "Active Users"}
            icon={activeTab === "inactive-users" ? "person_off" : "group"}
          >
            <p className="mb-4 text-sm text-text-light bg-background-light p-3 rounded">
              Click a user row to open details.
              {activeTab === "inactive-users"
                ? " Use the detail view to reactivate accounts. Password reset is available after the user is active."
                : " Reset passwords from the detail view."}
              {activeTab === "inactive-users"
                ? " Users still in the signup approval workflow are hidden until HOD and admin approval is completed."
                : ""}
            </p>
            {usersLoading ? (
              <p className="text-sm text-text-light p-4">Loading users from database...</p>
            ) : currentUserTableRows.length === 0 ? (
              <div className="text-center py-10 text-text-light">
                <span className="material-symbols-outlined text-5xl mb-2 block">
                  {activeTab === "inactive-users" ? "person_off" : "group"}
                </span>
                {activeTab === "inactive-users"
                  ? "No inactive users to display"
                  : "No active users found"}
              </div>
            ) : (
              <Table
                columns={userColumns}
                data={currentUserTableRows}
                onRowClick={handleViewUserDetails}
                paginated
                itemsPerPage={10}
              />
            )}
          </Card>
        ) : (
          <Card>
            <p className="mb-4 text-sm text-text-light bg-background-light p-3 rounded">
              Includes admin-submitted user requests (from Create User) while they await HOD or dean review.
              Approve and reject are enabled only for legacy requests still awaiting administrator approval.
            </p>
            {accountRequestsLoading ? (
              <p className="text-sm text-text-light p-4">Loading account requests...</p>
            ) : filteredRequests.length === 0 ? (
              <div className="text-center py-10 text-text-light">
                <span className="material-symbols-outlined text-5xl mb-2 block">check_circle</span>
                No pending account requests
              </div>
            ) : (
              <Table
                columns={accountRequestColumns}
                data={filteredRequests}
                getRowActions={getAccountRequestActions}
                pendingActionLabel="Awaiting HOD / dean approval"
                paginated
                itemsPerPage={10}
              />
            )}
          </Card>
        )}
      </div>

      {/* User Details Modal */}
      <EntityDetailsModal
        isOpen={isUserDetailsModalOpen}
        onClose={closeUserDetails}
        title={`User Details${selectedUserDetails?.name ? ` - ${selectedUserDetails.name}` : ""}`}
        selectedLabel="Selected User"
        selectedName={selectedUserDetails?.name}
        size="lg"
        footer={userDetailsFooter}
        details={[
          { label: "Email", value: selectedUserDetails?.email },
          { label: "Role", value: ROLE_HIERARCHY[selectedUserDetails?.role]?.label || selectedUserDetails?.role },
          { label: "Department", value: selectedUserDetails?.department },
          { label: "Designation", value: selectedUserDetails?.designation },
          {
            label: "Status",
            value: selectedUserDetails?.status
              ? normalizeStatus(selectedUserDetails.status).charAt(0).toUpperCase() +
                normalizeStatus(selectedUserDetails.status).slice(1)
              : "-",
          },
          { label: "Mobile No", value: selectedUserDetails?.mobileNo },
          { label: "Office Extension", value: selectedUserDetails?.officeExtNo },
          { label: "Created Date", value: selectedUserDetails?.createdDate },
          { label: "User ID", value: selectedUserDetails?.id },
        ]}
      >
        {selectedUserIsInactive ? (
          <p className="border-t border-border-lighter pt-4 text-sm text-text-light">
            Reactivate this account to restore login access. Password reset will be available once the user is active.
          </p>
        ) : (
          <div className="border-t border-border-lighter pt-4 space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-text-dark">Reset password (on user request)</h4>
              <p className="text-xs text-text-light mt-1">
                First enter the new password, then send the OTP to the user's registered email address. After the user verifies the email code, enter that OTP here to apply the password change.
              </p>
            </div>

            {resetPasswordError ? (
              <p className="rounded bg-error/10 px-3 py-2 text-sm text-error">{resetPasswordError}</p>
            ) : null}

            <p className="text-sm text-text-dark rounded bg-background-light px-3 py-3">
              Step 1: enter the new password. Step 2: send OTP to the user's email. Step 3: after the user shares the verified OTP, enter it here and reset the password.
            </p>

            <FormInput
              label="Verified OTP"
              name="resetOtp"
              type="text"
              placeholder="Enter 6-digit OTP"
              value={resetOtp}
              onChange={handleResetPasswordChange}
              maxLength={6}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput
                label="New Password"
                name="resetPassword"
                type="password"
                placeholder="8-12 chars: uppercase, number, symbol"
                value={resetPassword}
                onChange={handleResetPasswordChange}
                maxLength={PASSWORD_MAX_LENGTH}
              />
              <FormInput
                label="Confirm New Password"
                name="resetConfirmPassword"
                type="password"
                placeholder="Confirm new password"
                value={resetConfirmPassword}
                onChange={handleResetPasswordChange}
                maxLength={PASSWORD_MAX_LENGTH}
              />
            </div>

            {resetPassword ? (
              <div className="space-y-2">
                <div className="flex gap-1">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className={`h-2 flex-1 rounded ${
                        i < resetPasswordStrength
                          ? getPasswordStrengthColorClass(resetPasswordStrength)
                          : "bg-gray-200"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-text-light">{PASSWORD_REQUIREMENTS_MESSAGE}</p>
              </div>
            ) : null}

            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                icon="lock_reset"
                onClick={handleAdminSendResetOtp}
                disabled={resetPasswordLoading || !resetPassword || !resetConfirmPassword}
              >
                {resetPasswordLoading ? "Sending OTP..." : "Send Reset OTP"}
              </Button>
              <Button
                variant="primary"
                icon="verified"
                onClick={handleAdminResetPassword}
                disabled={resetPasswordLoading || !resetOtp || !resetPassword || !resetConfirmPassword}
              >
                {resetPasswordLoading ? "Resetting..." : "Reset Password"}
              </Button>
            </div>
          </div>
        )}
      </EntityDetailsModal>

      {/* Create User Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New User Account"
        footer={modalFooter}
        size="md"
      >
        <form className="space-y-4">
          {submitError && <p className="rounded bg-error/10 px-3 py-2 text-sm text-error">{submitError}</p>}
          <p className="text-sm text-text-light bg-background-light p-3 rounded">
            Staff accounts still enter the signup approval workflow. Dean and registrar accounts can be created only once. Each department can have only one HOD account, and those designation accounts are reused instead of recreated.
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
              onChange={handleSelectChange("role")}
              options={createRoleOptions}
              required
            />
            {!isRegistrarRole ? (
              <Select
                label="Department"
                name="department"
                value={formData.department}
                onChange={handleSelectChange("department")}
                options={departmentOptions}
                placeholder={departmentOptions.length ? "Select department" : "No departments available"}
                disabled={!departmentOptions.length}
                required
              />
            ) : (
              <div />
            )}
          </div>
          {!isRegistrarRole ? (
            <Select
              label="Designation"
              name="designation"
              value={formData.designation}
              onChange={handleSelectChange("designation")}
              options={[
                { value: "Lecturer", label: "Lecturer" },
                { value: "Instructor", label: "Instructor" },
                { value: "Technical Officer", label: "Technical Officer" },
                { value: "Management Assistant", label: "Management Assistant" },
                { value: "Laboratory Attendant", label: "Laboratory Attendant" },
                { value: "Works Aide", label: "Works Aide" },
                { value: "Other", label: "Other" },
              ]}
              required
            />
          ) : null}
          {!isRegistrarRole && formData.designation === "Other" && (
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-text-dark">
                Please Specify Designation <span className="text-danger">*</span>
              </label>
              <textarea
                name="otherDesignation"
                placeholder="Enter designation"
                value={otherDesignation}
                onChange={(e) => setOtherDesignation(e.target.value)}
                required
                rows={3}
                className="w-full px-4 py-2.5 border border-border-light rounded-md focus:ring-2 focus:ring-primary-800 focus:outline-none resize-none"
              />
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput
              label="Password"
              name="password"
              type="password"
              placeholder="8-12 chars: uppercase, number, symbol"
              value={formData.password}
              onChange={handleInputChange}
              maxLength={PASSWORD_MAX_LENGTH}
              required
            />
            <FormInput
              label="Confirm Password"
              name="confirmPassword"
              type="password"
              placeholder="Confirm password"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              required
            />
          </div>
          {formData.password && (
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="flex gap-1">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className={`h-2 flex-1 rounded ${
                      i < passwordStrength ? getPasswordStrengthColorClass(passwordStrength) : "bg-gray-200"
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-text-light">
                  {passwordStrength <= 1 && "Weak password"}
                  {passwordStrength === 2 && "Fair password"}
                  {passwordStrength >= 3 && "Strong password"}
                </p>
                {formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword && (
                  <p className="text-xs text-danger font-semibold">✗ Passwords do not match</p>
                )}
                {formData.password && formData.confirmPassword && formData.password === formData.confirmPassword && (
                  <p className="text-xs text-success font-semibold">✓ Passwords match</p>
                )}
              </div>
            </div>
          )}
          {formData.role === "staff" && createRoleOptions.length === 1 ? (
            <p className="text-xs text-text-light">
              Permanent designation accounts have already been created. Use the existing dean, HOD, or registrar accounts when assignments change.
            </p>
          ) : null}
        </form>
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

