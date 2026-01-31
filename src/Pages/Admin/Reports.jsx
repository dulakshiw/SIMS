import React, { useState } from "react";
import AdminLayout from "../../Components/Layouts/AdminLayout";
import { Card, Button, Table, Badge } from "../../Components/UI";

const Reports = () => {
  const [activeTab, setActiveTab] = useState("user-details"); // user-details, user-login, inventory-details

  const mockStats = [
    { title: "Total Users", value: "25", icon: "people", color: "primary-800" },
    { title: "Total Assets", value: "425", icon: "inventory_2", color: "info" },
    { title: "Pending Requests", value: "12", icon: "request_quote", color: "warning" },
    { title: "Inventories", value: "5", icon: "storehouse", color: "success" },
  ];

  // User Details Report Data
  const userDetailsData = [
    {
      id: 1,
      name: "Alice Johnson",
      email: "alice@example.com",
      role: "Admin",
      department: "IT",
      status: "active",
      joinDate: "2024-01-15",
      lastActive: "2024-01-26 10:30 AM",
    },
    {
      id: 2,
      name: "Bob Smith",
      email: "bob@example.com",
      role: "Incharge",
      department: "Inventory",
      status: "active",
      joinDate: "2024-01-20",
      lastActive: "2024-01-26 09:15 AM",
    },
    {
      id: 3,
      name: "Carol White",
      email: "carol@example.com",
      role: "Admin",
      department: "Operations",
      status: "inactive",
      joinDate: "2024-01-22",
      lastActive: "2024-01-24 03:45 PM",
    },
    {
      id: 4,
      name: "David Brown",
      email: "david@example.com",
      role: "Staff",
      department: "Finance",
      status: "active",
      joinDate: "2024-02-01",
      lastActive: "2024-01-26 11:20 AM",
    },
    {
      id: 5,
      name: "Emma Davis",
      email: "emma@example.com",
      role: "Incharge",
      department: "Inventory",
      status: "active",
      joinDate: "2024-02-05",
      lastActive: "2024-01-26 02:50 PM",
    },
  ];

  // User Login Details Report Data
  const userLoginData = [
    {
      id: 1,
      name: "Alice Johnson",
      email: "alice@example.com",
      loginCount: 142,
      lastLogin: "2024-01-26 10:30 AM",
      loginDate: "2024-01-26",
      status: "active",
      totalLoginHours: "256 hrs",
    },
    {
      id: 2,
      name: "Bob Smith",
      email: "bob@example.com",
      loginCount: 98,
      lastLogin: "2024-01-26 09:15 AM",
      loginDate: "2024-01-26",
      status: "active",
      totalLoginHours: "176 hrs",
    },
    {
      id: 3,
      name: "Carol White",
      email: "carol@example.com",
      loginCount: 45,
      lastLogin: "2024-01-24 03:45 PM",
      loginDate: "2024-01-24",
      status: "inactive",
      totalLoginHours: "82 hrs",
    },
    {
      id: 4,
      name: "David Brown",
      email: "david@example.com",
      loginCount: 67,
      lastLogin: "2024-01-26 11:20 AM",
      loginDate: "2024-01-26",
      status: "active",
      totalLoginHours: "121 hrs",
    },
    {
      id: 5,
      name: "Emma Davis",
      email: "emma@example.com",
      loginCount: 89,
      lastLogin: "2024-01-26 02:50 PM",
      loginDate: "2024-01-26",
      status: "active",
      totalLoginHours: "162 hrs",
    },
  ];

  // Inventory Details Report Data
  const inventoryDetailsData = [
    {
      id: 1,
      name: "Server Room",
      department: "Information Technology",
      incharge: "Alice Johnson",
      itemCount: 45,
      createdDate: "2024-01-10",
      lastUpdated: "2024-01-26 10:30 AM",
      status: "active",
    },
    {
      id: 2,
      name: "IT Equipment",
      department: "Information Technology",
      incharge: "Bob Smith",
      itemCount: 120,
      createdDate: "2024-01-15",
      lastUpdated: "2024-01-26 09:15 AM",
      status: "active",
    },
    {
      id: 3,
      name: "Office Supplies",
      department: "Operations",
      incharge: "Carol White",
      itemCount: 250,
      createdDate: "2024-01-20",
      lastUpdated: "2024-01-24 03:45 PM",
      status: "inactive",
    },
    {
      id: 4,
      name: "Machinery",
      department: "Operations",
      incharge: "David Brown",
      itemCount: 15,
      createdDate: "2024-02-01",
      lastUpdated: "2024-01-26 11:20 AM",
      status: "active",
    },
    {
      id: 5,
      name: "HR Equipment",
      department: "Human Resources",
      incharge: "Emma Davis",
      itemCount: 30,
      createdDate: "2024-02-05",
      lastUpdated: "2024-01-26 02:50 PM",
      status: "active",
    },
  ];

  const userDetailsColumns = [
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
    { field: "joinDate", label: "Join Date" },
    { field: "lastActive", label: "Last Active" },
  ];

  const userLoginColumns = [
    { field: "name", label: "Name", sortable: true },
    { field: "email", label: "Email", sortable: true },
    { field: "loginCount", label: "Login Count", sortable: true },
    { field: "lastLogin", label: "Last Login" },
    { field: "loginDate", label: "Login Date", sortable: true },
    { field: "totalLoginHours", label: "Total Hours" },
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

  const inventoryDetailsColumns = [
    { field: "name", label: "Inventory Name", sortable: true },
    { field: "department", label: "Department", sortable: true },
    { field: "incharge", label: "In-Charge", sortable: true },
    { field: "itemCount", label: "Item Count", sortable: true },
    { field: "createdDate", label: "Created Date" },
    { field: "lastUpdated", label: "Last Updated" },
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

  const handleExportReport = (reportType) => {
    console.log(`Exporting ${reportType} report...`);
    // Implementation for CSV/PDF export
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text-dark">Reports & Analytics</h1>
            <p className="text-text-light mt-2">System analytics and performance metrics</p>
          </div>
          <Button icon="download" variant="primary" onClick={() => handleExportReport(activeTab)}>
            Export Report
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {mockStats.map((stat, index) => (
            <Card key={index} icon={stat.icon}>
              <p className="text-sm text-text-light">{stat.title}</p>
              <p className={`text-3xl font-bold text-${stat.color} mt-2`}>{stat.value}</p>
            </Card>
          ))}
        </div>

        {/* Report Tabs */}
        <div className="border-b border-border-light">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("user-details")}
              className={`px-6 py-3 border-b-2 font-medium transition-colors ${
                activeTab === "user-details"
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-text-light hover:text-text-dark"
              }`}
            >
              User Details
            </button>
            <button
              onClick={() => setActiveTab("user-login")}
              className={`px-6 py-3 border-b-2 font-medium transition-colors ${
                activeTab === "user-login"
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-text-light hover:text-text-dark"
              }`}
            >
              User Login Details
            </button>
            <button
              onClick={() => setActiveTab("inventory-details")}
              className={`px-6 py-3 border-b-2 font-medium transition-colors ${
                activeTab === "inventory-details"
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-text-light hover:text-text-dark"
              }`}
            >
              Inventory Details
            </button>
          </div>
        </div>

        {/* Report Content */}
        <div className="mt-6">
          {activeTab === "user-details" && (
            <Card title="User Details Report" icon="people">
              <Table
                columns={userDetailsColumns}
                data={userDetailsData}
                rowsPerPage={10}
              />
            </Card>
          )}

          {activeTab === "user-login" && (
            <Card title="User Login Details Report" icon="login">
              <Table
                columns={userLoginColumns}
                data={userLoginData}
                rowsPerPage={10}
              />
            </Card>
          )}

          {activeTab === "inventory-details" && (
            <Card title="Inventory Details Report" icon="inventory_2">
              <Table
                columns={inventoryDetailsColumns}
                data={inventoryDetailsData}
                rowsPerPage={10}
              />
            </Card>
          )}
        </div>

        {/* Analytics Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="System Activity">
            <div className="h-64 flex items-center justify-center bg-background-light rounded-lg">
              <p className="text-text-light">System activity chart (Chart implementation can be added with Chart.js/Recharts)</p>
            </div>
          </Card>
          <Card title="User Distribution">
            <div className="h-64 flex items-center justify-center bg-background-light rounded-lg">
              <p className="text-text-light">User distribution by role chart</p>
            </div>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Reports;
