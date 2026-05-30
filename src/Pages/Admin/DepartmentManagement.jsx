import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../../Components/Layouts/AdminLayout";
import { Card, Button, SearchBox, Table, Badge, Modal, FormInput, EntityDetailsModal, PageHeader } from "../../Components/UI";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const normalizeStatus = (status) => String(status || "").toLowerCase();

const formatDisplayValue = (value) => {
  if (value === 0) return "0";
  const text = String(value ?? "").trim();
  return text || "—";
};

const resolveDepartmentHod = (department, usersList = []) => {
  if (!department) return "—";
  const explicitHead = String(department.head || "").trim();
  if (explicitHead) return explicitHead;

  const departmentName = String(department.name || "").trim().toLowerCase();
  const hodUser = usersList.find(
    (user) =>
      normalizeStatus(user.status) === "active" &&
      user.role === "head_of_department" &&
      String(user.department || "").trim().toLowerCase() === departmentName
  );

  return hodUser?.name || "—";
};

const DepartmentManagement = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDepartmentDetailsModalOpen, setIsDepartmentDetailsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [selectedDeptId, setSelectedDeptId] = useState(null);
  const [selectedDepartmentDetails, setSelectedDepartmentDetails] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [inventories, setInventories] = useState([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);
  const [departmentsError, setDepartmentsError] = useState("");
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    head: "",
    description: "",
  });

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignType, setAssignType] = useState("user");
  const [selectedDept, setSelectedDept] = useState(null);

  const loadDepartments = useCallback(async () => {
    try {
      setDepartmentsLoading(true);
      setDepartmentsError("");
      const response = await fetch(`${API_BASE_URL}/api/departments?includeInactive=true`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || "Failed to load departments from database.");
      }

      setDepartments(data.departments || []);
    } catch (error) {
      console.error("Failed to fetch departments:", error);
      setDepartments([]);
      setDepartmentsError(error.message || "Unable to load departments from the database.");
    } finally {
      setDepartmentsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadReferenceData = async () => {
      try {
        const [usersResponse, inventoriesResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/users`),
          fetch(`${API_BASE_URL}/api/inventories`),
        ]);

        const [usersData, inventoriesData] = await Promise.all([
          usersResponse.json().catch(() => ({})),
          inventoriesResponse.json().catch(() => ({})),
        ]);

        if (!isMounted) return;

        if (usersResponse.ok && usersData.success) {
          setUsers(usersData.users || []);
        }

        if (inventoriesResponse.ok && inventoriesData.success) {
          setInventories(inventoriesData.inventories || []);
        }
      } catch (error) {
        console.error("Failed to load assign options:", error);
      }
    };

    loadDepartments();
    loadReferenceData();

    return () => {
      isMounted = false;
    };
  }, [loadDepartments]);

  const getDepartmentMembers = useCallback(
    (department) => {
      if (!department) return { users: [], inventories: [] };

      const departmentName = String(department.name || "").trim().toLowerCase();

      return {
        users: users.filter((user) => {
          const userDept = String(user.department || "").trim().toLowerCase();
          return userDept === departmentName;
        }),
        inventories: inventories.filter((inventory) => {
          const inventoryDept = String(inventory.department || "").trim().toLowerCase();
          return inventoryDept === departmentName;
        }),
      };
    },
    [users, inventories]
  );

  const enrichDepartmentDetails = useCallback(
    (department) => {
      if (!department) return null;
      const { users: memberUsers, inventories: memberInventories } = getDepartmentMembers(department);
      const hodName = resolveDepartmentHod(department, users);

      return {
        ...department,
        code: String(department.code ?? "").trim(),
        head: hodName === "—" ? "" : hodName,
        hod: hodName,
        userCount: Number(department.userCount ?? memberUsers.length ?? 0),
        inventoryCount: Number(department.inventoryCount ?? memberInventories.length ?? 0),
      };
    },
    [getDepartmentMembers, users]
  );

  const columns = [
    { field: "name", label: "Department Name", sortable: true },
    {
      field: "code",
      label: "Dept Code",
      sortable: true,
      render: (value) => formatDisplayValue(value),
    },
    {
      field: "head",
      label: "HOD",
      sortable: true,
      render: (_value, row) => formatDisplayValue(resolveDepartmentHod(row, users)),
    },
    {
      field: "userCount",
      label: "No. of Staff",
      sortable: true,
      render: (value) => formatDisplayValue(value ?? 0),
    },
    {
      field: "inventoryCount",
      label: "No. of Inventories",
      sortable: true,
      render: (value) => formatDisplayValue(value ?? 0),
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
  ];

  const filteredDepartments = departments.filter(
    (dept) =>
      String(dept.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(dept.code || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(dept.head || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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

  const closeDepartmentDetails = () => {
    setIsDepartmentDetailsModalOpen(false);
    setSelectedDepartmentDetails(null);
  };

  const handleAssignClick = (dept) => {
    setSelectedDept(enrichDepartmentDetails(dept));
    setAssignType("user");
    setAssignModalOpen(true);
  };

  const handleViewDepartmentDetails = (department) => {
    setSelectedDepartmentDetails(enrichDepartmentDetails(department));
    setIsDepartmentDetailsModalOpen(true);
  };

  const updateDepartmentStatus = async (department, nextStatus) => {
    try {
      setStatusUpdating(true);
      const response = await fetch(`${API_BASE_URL}/api/departments/${department.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to update department status.");
      }

      setDepartments((prev) =>
        prev.map((dept) => (dept.id === department.id ? { ...dept, status: nextStatus } : dept))
      );
      setSelectedDepartmentDetails((prev) =>
        prev && prev.id === department.id ? enrichDepartmentDetails({ ...prev, status: nextStatus }) : prev
      );

      return { success: true, message: data.message };
    } catch (error) {
      window.alert(error.message || "Failed to update department status.");
      return { success: false };
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleDeactivateDepartment = async (department) => {
    const confirmed = window.confirm(
      `Deactivate "${department.name}"? Department history is preserved; reactivate when needed.`
    );
    if (!confirmed) return;

    const result = await updateDepartmentStatus(department, "inactive");
    if (result?.success) {
      window.alert(result.message || `"${department.name}" has been deactivated.`);
    }
  };

  const handleReactivateDepartment = async (department) => {
    const confirmed = window.confirm(
      `Reactivate "${department.name}"? Users and inventories can be assigned again.`
    );
    if (!confirmed) return;

    const result = await updateDepartmentStatus(department, "active");
    if (result?.success) {
      window.alert(result.message || `"${department.name}" has been reactivated.`);
    }
  };

  const selectedDepartmentIsInactive =
    normalizeStatus(selectedDepartmentDetails?.status) === "inactive";

  const assignableUsers = useMemo(() => {
    if (!selectedDept) return [];
    return getDepartmentMembers(selectedDept).users;
  }, [selectedDept, getDepartmentMembers]);

  const assignableInventories = useMemo(() => {
    if (!selectedDept) return [];
    return getDepartmentMembers(selectedDept).inventories;
  }, [selectedDept, getDepartmentMembers]);

  const allUsersForAssign = useMemo(
    () => users.filter((user) => normalizeStatus(user.status) === "active"),
    [users]
  );

  const allInventoriesForAssign = useMemo(
    () => inventories.filter((inventory) => normalizeStatus(inventory.status) === "active"),
    [inventories]
  );

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

  const departmentDetailsFooter = (
    <div className="flex flex-wrap justify-end gap-3">
      <Button variant="secondary" onClick={closeDepartmentDetails} disabled={statusUpdating}>
        Close
      </Button>
      {selectedDepartmentDetails ? (
        selectedDepartmentIsInactive ? (
          <Button
            variant="primary"
            icon="check_circle"
            onClick={() => handleReactivateDepartment(selectedDepartmentDetails)}
            disabled={statusUpdating}
          >
            {statusUpdating ? "Updating..." : "Reactivate"}
          </Button>
        ) : (
          <>
            <Button
              variant="primary"
              icon="person_add"
              onClick={() => handleAssignClick(selectedDepartmentDetails)}
              disabled={statusUpdating}
            >
              Assign
            </Button>
            <Button
              variant="danger"
              icon="block"
              onClick={() => handleDeactivateDepartment(selectedDepartmentDetails)}
              disabled={statusUpdating}
            >
              {statusUpdating ? "Updating..." : "Deactivate"}
            </Button>
          </>
        )
      ) : null}
    </div>
  );

  const assignModalFooter = (
    <div className="flex gap-3 justify-end">
      <Button variant="secondary" onClick={() => setAssignModalOpen(false)}>
        Cancel
      </Button>
      <Button
        variant="primary"
        onClick={() => {
          window.alert("User and inventory assignment updates will be saved in a future release.");
          setAssignModalOpen(false);
        }}
      >
        Assign {assignType === "user" ? "User" : "Inventory"}
      </Button>
    </div>
  );

  return (
    <AdminLayout>
      <PageHeader
        title="Department Management"
        subtitle="Manage departments and assign users and inventories"
        actions={
          <Button icon="add_circle" onClick={() => navigate("/admin/departments/create")}>
            Add Department
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        <SearchBox
          placeholder="Search departments by name or code..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          icon="search"
        />

        <Card title="All Departments" icon="business">
          <p className="mb-4 text-sm text-text-light bg-background-light p-3 rounded">
            Click a department row to open details. Assign users or inventories and deactivate from the detail view only.
            Departments are not deleted so history is preserved.
          </p>

          {departmentsError ? (
            <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {departmentsError}
            </div>
          ) : null}

          {departmentsLoading ? (
            <p className="text-sm text-text-light p-4">Loading departments from database...</p>
          ) : filteredDepartments.length === 0 ? (
            <div className="text-center py-10 text-text-light">
              <span className="material-symbols-outlined text-5xl mb-2 block">business</span>
              No departments found
            </div>
          ) : (
            <Table
              columns={columns}
              data={filteredDepartments}
              onRowClick={handleViewDepartmentDetails}
              paginated
              itemsPerPage={10}
            />
          )}
        </Card>

        <EntityDetailsModal
          isOpen={isDepartmentDetailsModalOpen}
          onClose={closeDepartmentDetails}
          title={`Department Details${selectedDepartmentDetails?.name ? ` - ${selectedDepartmentDetails.name}` : ""}`}
          selectedLabel="Selected Department"
          selectedName={selectedDepartmentDetails?.name}
          size="lg"
          footer={departmentDetailsFooter}
          details={[
            { label: "Dept Code", value: formatDisplayValue(selectedDepartmentDetails?.code) },
            {
              label: "HOD",
              value: formatDisplayValue(
                selectedDepartmentDetails?.hod || resolveDepartmentHod(selectedDepartmentDetails, users)
              ),
            },
            {
              label: "Status",
              value: selectedDepartmentDetails?.status
                ? normalizeStatus(selectedDepartmentDetails.status).charAt(0).toUpperCase() +
                  normalizeStatus(selectedDepartmentDetails.status).slice(1)
                : "—",
            },
            { label: "No. of Staff", value: selectedDepartmentDetails?.userCount ?? 0 },
            { label: "No. of Inventories", value: selectedDepartmentDetails?.inventoryCount ?? 0 },
          ]}
        >
          {selectedDepartmentIsInactive ? (
            <p className="border-t border-border-lighter pt-4 text-sm text-text-light">
              Reactivate this department to assign users and inventories again.
            </p>
          ) : null}
        </EntityDetailsModal>

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
              placeholder="e.g., IT, IDS"
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
          </form>
        </Modal>

        <Modal
          isOpen={assignModalOpen}
          title={`Assign ${assignType === "user" ? "Users" : "Inventories"} to ${selectedDept?.name || ""}`}
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
                Users ({assignableUsers.length} assigned)
              </Button>
              <Button
                variant={assignType === "inventory" ? "primary" : "secondary"}
                onClick={() => setAssignType("inventory")}
                className="flex-1"
              >
                Inventories ({assignableInventories.length} assigned)
              </Button>
            </div>

            <div className="border-t pt-4">
              {assignType === "user" ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-text-dark">Users in this department</p>
                  {allUsersForAssign.length === 0 ? (
                    <p className="text-sm text-text-light">No active users loaded.</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {allUsersForAssign.map((user) => {
                        const isAssigned = assignableUsers.some((assigned) => assigned.id === user.id);
                        return (
                          <label
                            key={user.id}
                            className={`flex items-center gap-3 p-2 rounded ${
                              isAssigned ? "bg-primary-50 border border-primary-200" : "hover:bg-background-light"
                            }`}
                          >
                            <input
                              type="checkbox"
                              readOnly
                              checked={isAssigned}
                              className="w-4 h-4 accent-primary-600"
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-text-dark">{user.name}</p>
                              <p className="text-xs text-text-light">
                                {user.email} · {user.department || "No department"}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-text-dark">Inventories in this department</p>
                  {allInventoriesForAssign.length === 0 ? (
                    <p className="text-sm text-text-light">No active inventories loaded.</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {allInventoriesForAssign.map((inventory) => {
                        const isAssigned = assignableInventories.some((assigned) => assigned.id === inventory.id);
                        return (
                          <label
                            key={inventory.id}
                            className={`flex items-center gap-3 p-2 rounded ${
                              isAssigned ? "bg-primary-50 border border-primary-200" : "hover:bg-background-light"
                            }`}
                          >
                            <input
                              type="checkbox"
                              readOnly
                              checked={isAssigned}
                              className="w-4 h-4 accent-primary-600"
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-text-dark">{inventory.name}</p>
                              <p className="text-xs text-text-light">
                                {inventory.department || "No department"} · {inventory.location || "—"}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
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
