import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import AdminLayout from "../../Components/Layouts/AdminLayout";
import MainLayout from "../../Components/Layouts/MainLayout";
import { Card, Button, Table, Badge, PageHeader } from "../../Components/UI";

const Reports = ({ layoutVariant = "admin", sidebarVariant }) => {
  const params = useParams();
  const resolvedSidebarVariant = sidebarVariant || params?.role || "staff";
  const Layout = layoutVariant === "admin" ? AdminLayout : MainLayout;
  const [activeTab, setActiveTab] = useState("user-details"); // user-details, user-login, inventory-details
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target)) {
        setIsExportDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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
      designation: "Senior Lecturer",
      status: "active",
      joinDate: "2024-01-15",
      lastActive: "2024-01-26 10:30 AM",
    },
    {
      id: 2,
      name: "Bob Smith",
      email: "bob@example.com",
      role: "Inventory Officer",
      department: "Inventory",
      designation: "Lecturer",
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
      designation: "Professor",
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
      designation: "Assistant Lecturer",
      status: "active",
      joinDate: "2024-02-01",
      lastActive: "2024-01-26 11:20 AM",
    },
    {
      id: 5,
      name: "Emma Davis",
      email: "emma@example.com",
      role: "Inventory Officer",
      department: "Inventory",
      designation: "Senior Lecturer",
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

  // Department Details Report Data
  const departmentDetailsData = [
    {
      id: 1,
      name: "Information Technology",
      code: "IT",
      head: "CRJ Amalraj",
      userCount: 12,
      inventoryCount: 2,
      status: "active",
      createdDate: "2024-01-15",
    },
    {
      id: 2,
      name: "Dean's Office",
      code: "DO",
      head: "Yashodara Karunarathne",
      userCount: 8,
      inventoryCount: 2,
      status: "active",
      createdDate: "2024-01-20",
    },
    {
      id: 3,
      name: "Computational Mathematics",
      code: "CM",
      head: "YTS Piyatilake",
      userCount: 5,
      inventoryCount: 1,
      status: "inactive",
      createdDate: "2024-02-01",
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
    { field: "designation", label: "Designation", sortable: true },
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
    { field: "incharge", label: "Inventory Officer", sortable: true },
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

  const departmentDetailsColumns = [
    { field: "name", label: "Department Name", sortable: true },
    { field: "code", label: "Code", sortable: true },
    { field: "head", label: "Department Head", sortable: true },
    { field: "userCount", label: "Users", sortable: true },
    { field: "inventoryCount", label: "Inventories", sortable: true },
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

  const getReportConfig = (reportType) => {
    const reportConfig = {
      "user-details": {
        title: "User Details Report",
        fileName: "users-report",
        headers: ["Name", "Email", "Role", "Department", "Designation", "Status", "Join Date", "Last Active"],
        rows: userDetailsData.map((user) => [
          user.name,
          user.email,
          user.role,
          user.department,
          user.designation,
          user.status,
          user.joinDate,
          user.lastActive,
        ]),
      },
      "department-details": {
        title: "Department Details Report",
        fileName: "departments-report",
        headers: ["Department Name", "Code", "Department Head", "Users", "Inventories", "Status", "Created Date"],
        rows: departmentDetailsData.map((department) => [
          department.name,
          department.code,
          department.head,
          department.userCount,
          department.inventoryCount,
          department.status,
          department.createdDate,
        ]),
      },
      "inventory-details": {
        title: "Inventory Details Report",
        fileName: "inventories-report",
        headers: ["Inventory Name", "Department", "Inventory Officer", "Item Count", "Status", "Created Date", "Last Updated"],
        rows: inventoryDetailsData.map((inventory) => [
          inventory.name,
          inventory.department,
          inventory.incharge,
          inventory.itemCount,
          inventory.status,
          inventory.createdDate,
          inventory.lastUpdated,
        ]),
      },
      "user-login": {
        title: "User Login Details Report",
        fileName: "user-logins-report",
        headers: ["Name", "Email", "Login Count", "Last Login", "Login Date", "Total Hours", "Status"],
        rows: userLoginData.map((userLogin) => [
          userLogin.name,
          userLogin.email,
          userLogin.loginCount,
          userLogin.lastLogin,
          userLogin.loginDate,
          userLogin.totalLoginHours,
          userLogin.status,
        ]),
      },
    };

    return reportConfig[reportType] || null;
  };

  const handleExportCsv = (reportType) => {
    const selectedReport = getReportConfig(reportType);

    if (!selectedReport) {
      return;
    }

    const escapeCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csvRows = [selectedReport.headers, ...selectedReport.rows]
      .map((row) => row.map(escapeCell).join(","))
      .join("\n");

    const blob = new Blob([csvRows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${selectedReport.fileName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = (reportType) => {
    const selectedReport = getReportConfig(reportType);

    if (!selectedReport) {
      return;
    }

    const doc = new jsPDF();
    const generatedAt = new Date().toLocaleString();

    autoTable(doc, {
      head: [selectedReport.headers],
      body: selectedReport.rows,
      startY: 34,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [17, 76, 126] },
      didDrawPage: () => {
        const pageHeight = doc.internal.pageSize.getHeight();

        doc.setFontSize(12);
        doc.text("Inventory Mangement System - Faculty of Information Technology", 14, 14);

        doc.setFontSize(10);
        doc.text(selectedReport.title, 14, 22);

        doc.setFontSize(9);
        doc.text(`Generated: ${generatedAt}`, 14, pageHeight - 10);
      },
      margin: { top: 30, bottom: 16 },
    });

    doc.save(`${selectedReport.fileName}.pdf`);
  };

  const handleExportReport = (reportType, format) => {
    if (format === "pdf") {
      handleExportPdf(reportType);
      return;
    }

    handleExportCsv(reportType);
  };

  return (
    <Layout {...(layoutVariant === "admin" ? {} : { variant: resolvedSidebarVariant })}>
      <PageHeader
        title="Reports & Analytics"
        subtitle="System analytics and performance metrics"
        actions={
          <div className="relative" ref={exportDropdownRef}>
            <Button
              className="min-w-[180px] justify-between bg-white text-primary-800 hover:bg-primary-50"
              onClick={() => setIsExportDropdownOpen((prev) => !prev)}
            >
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base">download</span>
                Export Report
              </span>
              <span className="material-symbols-outlined text-base">expand_more</span>
            </Button>

            {isExportDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-md border border-border-light bg-white shadow-lg z-50">
                <button
                  type="button"
                  className="w-full px-4 py-2 text-left text-sm text-text-dark transition-colors hover:bg-background-light"
                  onClick={() => {
                    handleExportReport(activeTab, "csv");
                    setIsExportDropdownOpen(false);
                  }}
                >
                  Export as CSV
                </button>
                <button
                  type="button"
                  className="w-full px-4 py-2 text-left text-sm text-text-dark transition-colors hover:bg-background-light"
                  onClick={() => {
                    handleExportReport(activeTab, "pdf");
                    setIsExportDropdownOpen(false);
                  }}
                >
                  Export as PDF
                </button>
              </div>
            )}
          </div>
        }
      />

      <div className="p-6 space-y-6">
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
            <button
              onClick={() => setActiveTab("department-details")}
              className={`px-6 py-3 border-b-2 font-medium transition-colors ${
                activeTab === "department-details"
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-text-light hover:text-text-dark"
              }`}
            >
              Department Details
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

          {activeTab === "department-details" && (
            <Card title="Department Details Report" icon="business">
              <Table
                columns={departmentDetailsColumns}
                data={departmentDetailsData}
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
    </Layout>
  );
};

export default Reports;
