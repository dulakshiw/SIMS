import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../../Components/Layouts/AdminLayout";
import { Card, Button, SearchBox, Table, Badge, Modal, FormInput, Select, EntityDetailsModal, PageHeader } from "../../Components/UI";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const DepartmentManagement = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDepartmentDetailsModalOpen, setIsDepartmentDetailsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // create or edit
  const [selectedDeptId, setSelectedDeptId] = useState(null);
  const [selectedDepartmentDetails, setSelectedDepartmentDetails] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    head: "",
    description: "",
  });

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignType, setAssignType] = useState("user"); // user or inventory
  const [selectedDept, setSelectedDept] = useState(null);

  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [inventories, setInventories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        setError("");

        const [departmentsResponse, usersResponse, inventoriesResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/departments`),
          fetch(`${API_BASE_URL}/api/users`),
          fetch(`${API_BASE_URL}/api/inventories`),
        ]);

        const [departmentsData, usersData, inventoriesData] = await Promise.all([
          departmentsResponse.json(),
          usersResponse.json(),
          inventoriesResponse.json(),
        ]);

        if (!isMounted) return;

        if (!departmentsResponse.ok || !departmentsData.success) {
          throw new Error(departmentsData.error || departmentsData.message || "Failed to load departments.");
        }

        if (!usersResponse.ok || !usersData.success) {
          throw new Error(usersData.error || usersData.message || "Failed to load users.");
        }

        if (!inventoriesResponse.ok || !inventoriesData.success) {
          throw new Error(inventoriesData.error || inventoriesData.message || "Failed to load inventories.");
        }

        setDepartments(departmentsData.departments || []);
        setUsers(usersData.users || []);
        setInventories(inventoriesData.inventories || []);

        // Check if we got empty data - if so, use fallback mock data
        if ((!departmentsData.departments || departmentsData.departments.length === 0) &&
            (!usersData.users || usersData.users.length === 0) &&
            (!inventoriesData.inventories || inventoriesData.inventories.length === 0)) {
          console.log("API returned empty data, using fallback mock data");
          setDepartments([
            {
              id: 1,
              name: "Information Technology",
              code: "IT",
              head: "CRJ Amalraj",
              status: "active",
              createdDate: "2026-01-15",
              userCount: 5,
              inventoryCount: 2,
            },
            {
              id: 2,
              name: "Dean's Office",
              code: "DO",
              head: "Yashodara Karunarathne",
              status: "active",
              createdDate: "2026-01-20",
              userCount: 3,
              inventoryCount: 1,
            },
            {
              id: 3,
              name: "Computational Mathematics",
              code: "CM",
              head: "YTS Piyatilake",
              status: "inactive",
              createdDate: "2026-02-01",
              userCount: 2,
              inventoryCount: 0,
            },
          ]);
          setUsers([
            { id: 1, name: "Alice Johnson", email: "alice@example.com", role: "admin", department: "Information Technology" },
            { id: 2, name: "Bob Smith", email: "bob@example.com", role: "inventory officer", department: "Information Technology" },
            { id: 3, name: "Carol White", email: "carol@example.com", role: "admin", department: "Dean's Office" },
            { id: 4, name: "David Brown", email: "david@example.com", role: "staff", department: "Dean's Office" },
            { id: 5, name: "Emma Davis", email: "emma@example.com", role: "admin", department: "Computational Mathematics" },
          ]);
          setInventories([
            { id: 1, name: "Server Room", department: "Information Technology" },
            { id: 2, name: "IT Equipment", department: "Information Technology" },
            { id: 3, name: "Office Supplies", department: "Dean's Office" },
          ]);
        }
      } catch (error) {
        if (isMounted) {
          console.error("Failed to load department data:", error);
          setError(error.message || "Failed to load data.");
          // Fallback to mock data for development
          setDepartments([
            {
              id: 1,
              name: "Information Technology",
              code: "IT",
              head: "CRJ Amalraj",
              status: "active",
              createdDate: "2026-01-15",
              userCount: 5,
              inventoryCount: 2,
            },
            {
              id: 2,
              name: "Dean's Office",
              code: "DO",
              head: "Yashodara Karunarathne",
              status: "active",
              createdDate: "2026-01-20",
              userCount: 3,
              inventoryCount: 1,
            },
            {
              id: 3,
              name: "Computational Mathematics",
              code: "CM",
              head: "YTS Piyatilake",
              status: "inactive",
              createdDate: "2026-02-01",
              userCount: 2,
              inventoryCount: 0,
            },
          ]);
          setUsers([
            { id: 1, name: "Alice Johnson", email: "alice@example.com", role: "admin", department: "Information Technology" },
            { id: 2, name: "Bob Smith", email: "bob@example.com", role: "inventory officer", department: "Information Technology" },
            { id: 3, name: "Carol White", email: "carol@example.com", role: "admin", department: "Dean's Office" },
            { id: 4, name: "David Brown", email: "david@example.com", role: "staff", department: "Dean's Office" },
            { id: 5, name: "Emma Davis", email: "emma@example.com", role: "admin", department: "Computational Mathematics" },
          ]);
          setInventories([
            { id: 1, name: "Server Room", department: "Information Technology" },
            { id: 2, name: "IT Equipment", department: "Information Technology" },
            { id: 3, name: "Office Supplies", department: "Dean's Office" },
          ]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredDepartments = departments.filter((dept) =>
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

  const handleAssignClick = (dept) => {
    setSelectedDept(dept);
    setAssignModalOpen(true);
  };

  const columns = [
    { field: "id", label: "ID", sortable: true },
    { field: "name", label: "Department Name", sortable: true },
    { field: "code", label: "Code", sortable: true },
    { field: "head", label: "Department Head", sortable: true },
    {
      field: "status",
      label: "Status",
      render: (value) => (
        <Badge
          label={value ? value.charAt(0).toUpperCase() + value.slice(1) : "Unknown"}
          variant={value === "active" ? "success" : "warning"}
          size="sm"
        />
      ),
    },
    { field: "userCount", label: "Users", sortable: true },
    { field: "inventoryCount", label: "Inventories", sortable: true },
    { field: "createdDate", label: "Created Date", sortable: true },
  ];

  const actions = [
    {
      label: "Edit",
      icon: "edit",
      onClick: handleEdit,
      variant: "secondary",
    },
    {
      label: "Assign",
      icon: "person_add",
      onClick: handleAssignClick,
      variant: "primary",
    },
  ];

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

  const handleViewDepartmentDetails = (department) => {
    setSelectedDepartmentDetails(department);
    setIsDepartmentDetailsModalOpen(true);
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
      <PageHeader
        title="Department Management"
        subtitle="Manage departments and assign users and inventories"
        actions={
          <Button
            icon="add_circle"
            onClick={() => navigate('/admin/departments/create')}
          >
            Add Department
          </Button>
        }
      />

      <div className="p-6 space-y-6">

        {/* Search */}
        <SearchBox
          placeholder="Search departments by name or code..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          icon="search"
        />

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {/* Departments Table */}
        <Card title="All Departments" icon="business">
          {loading ? (
            <div className="text-center py-10 text-text-light">
              <span className="material-symbols-outlined text-5xl mb-2 block">hourglass_empty</span>
              Loading departments...
            </div>
          ) : (
            <Table
              columns={columns}
              data={filteredDepartments}
              actions={actions}
              onRowClick={handleViewDepartmentDetails}
              rowsPerPage={10}
            />
          )}
        </Card>

        {/* Department Details Modal */}
        <EntityDetailsModal
          isOpen={isDepartmentDetailsModalOpen}
          onClose={() => setIsDepartmentDetailsModalOpen(false)}
          title={`Department Details${selectedDepartmentDetails?.name ? ` - ${selectedDepartmentDetails.name}` : ""}`}
          selectedLabel="Selected Department"
          selectedName={selectedDepartmentDetails?.name}
          details={[
            { label: "Code", value: selectedDepartmentDetails?.code },
            { label: "Department Head", value: selectedDepartmentDetails?.head },
            {
              label: "Status",
              value: selectedDepartmentDetails?.status
                ? selectedDepartmentDetails.status.charAt(0).toUpperCase() + selectedDepartmentDetails.status.slice(1)
                : "-",
            },
            { label: "Created Date", value: selectedDepartmentDetails?.createdDate },
            { label: "Assigned Users", value: selectedDepartmentDetails?.userCount || 0 },
            { label: "Assigned Inventories", value: selectedDepartmentDetails?.inventoryCount || 0 },
          ]}
        />

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
                    {users.map((user) => (
                      <label key={user.id} className="flex items-center gap-3 p-2 hover:bg-background-light rounded">
                        <input
                          type="checkbox"
                          defaultChecked={user.department === selectedDept?.name}
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
                    {inventories.map((inventory) => (
                      <label key={inventory.id} className="flex items-center gap-3 p-2 hover:bg-background-light rounded">
                        <input
                          type="checkbox"
                          defaultChecked={inventory.department === selectedDept?.name}
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
