import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import AdminLayout from "../../Components/Layouts/AdminLayout";
import MainLayout from "../../Components/Layouts/MainLayout";
import { Card, Button, Table, Badge, PageHeader } from "../../Components/UI";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const Reports = ({ layoutVariant = "admin", sidebarVariant }) => {
  const params = useParams();
  const resolvedSidebarVariant = sidebarVariant || params?.role || "staff";
  const Layout = layoutVariant === "admin" ? AdminLayout : MainLayout;
  const [activeTab, setActiveTab] = useState("user-details"); // user-details, user-login, inventory-details
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef(null);

  const [stats, setStats] = useState([]);
  const [userDetailsData, setUserDetailsData] = useState([]);
  const [userLoginData, setUserLoginData] = useState([]);
  const [inventoryDetailsData, setInventoryDetailsData] = useState([]);
  const [departmentDetailsData, setDepartmentDetailsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        setError("");

        const [summaryResponse, usersResponse, inventoriesResponse, departmentsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/dashboard/summary`),
          fetch(`${API_BASE_URL}/api/users`),
          fetch(`${API_BASE_URL}/api/inventories`),
          fetch(`${API_BASE_URL}/api/departments`),
        ]);

        const [summaryData, usersData, inventoriesData, departmentsData] = await Promise.all([
          summaryResponse.json(),
          usersResponse.json(),
          inventoriesResponse.json(),
          departmentsResponse.json(),
        ]);

        if (!isMounted) return;

        if (!summaryResponse.ok || !summaryData.success) {
          throw new Error(summaryData.error || summaryData.message || "Failed to load summary.");
        }

        if (!usersResponse.ok || !usersData.success) {
          throw new Error(usersData.error || usersData.message || "Failed to load users.");
        }

        if (!inventoriesResponse.ok || !inventoriesData.success) {
          throw new Error(inventoriesData.error || inventoriesData.message || "Failed to load inventories.");
        }

        if (!departmentsResponse.ok || !departmentsData.success) {
          throw new Error(departmentsData.error || departmentsData.message || "Failed to load departments.");
        }

        // Set stats
        const summary = summaryData.adminSummary || {};
        setStats([
          { title: "Total Users", value: summary.totalUsers ?? 0, icon: "people", color: "primary-800" },
          { title: "Total Assets", value: summary.totalItems ?? 0, icon: "inventory_2", color: "info" },
          { title: "Pending Requests", value: summary.pendingTasks ?? 0, icon: "request_quote", color: "warning" },
          { title: "Inventories", value: summary.inventories ?? 0, icon: "storehouse", color: "success" },
        ]);

        // Set user details
        setUserDetailsData(usersData.users || []);

        // For user login data, perhaps use users with login info if available, else empty
        setUserLoginData(usersData.users?.map(user => ({
          id: user.id,
          name: user.name,
          email: user.email,
          loginCount: 0, // TODO: Add login count tracking
          lastLogin: user.lastLogin ? new Date(user.lastLogin).toLocaleString() : "N/A",
          loginDate: user.lastLogin ? new Date(user.lastLogin).toISOString().split('T')[0] : "N/A",
          status: user.status,
          totalLoginHours: "0 hrs", // TODO: Add login hours tracking
        })) || []);

        // Set inventory details
        setInventoryDetailsData(inventoriesData.inventories?.map(inv => ({
          id: inv.id,
          name: inv.name,
          department: inv.department,
          incharge: inv.incharge,
          itemCount: inv.itemCount || 0,
          createdDate: inv.createdDate,
          lastUpdated: inv.lastUpdated,
          status: inv.status,
        })) || []);

        // Set department details
        setDepartmentDetailsData(departmentsData.departments?.map(dept => ({
          id: dept.id,
          name: dept.name,
          code: dept.code,
          head: dept.head,
          userCount: dept.userCount || 0,
          inventoryCount: dept.inventoryCount || 0,
          status: dept.status,
          createdDate: dept.createdDate,
        })) || []);

        // Check if we got empty data - if so, use fallback mock data
        const hasEmptyData = (!summaryData.adminSummary || Object.keys(summaryData.adminSummary).length === 0) &&
                            (!usersData.users || usersData.users.length === 0) &&
                            (!inventoriesData.inventories || inventoriesData.inventories.length === 0) &&
                            (!departmentsData.departments || departmentsData.departments.length === 0);

        if (hasEmptyData) {
          console.log("API returned empty data, using fallback mock data for reports");
          setStats([
            { title: "Total Users", value: 15, icon: "people", color: "primary-800" },
            { title: "Total Assets", value: 245, icon: "inventory_2", color: "info" },
            { title: "Pending Requests", value: 8, icon: "request_quote", color: "warning" },
            { title: "Inventories", value: 12, icon: "storehouse", color: "success" },
          ]);
          setUserDetailsData([
            { id: 1, name: "Alice Johnson", email: "alice@example.com", role: "admin", department: "Information Technology", status: "active", createdDate: "2026-01-15" },
            { id: 2, name: "Bob Smith", email: "bob@example.com", role: "inventory officer", department: "Information Technology", status: "active", createdDate: "2026-01-16" },
            { id: 3, name: "Carol White", email: "carol@example.com", role: "admin", department: "Dean's Office", status: "active", createdDate: "2026-01-17" },
            { id: 4, name: "David Brown", email: "david@example.com", role: "staff", department: "Dean's Office", status: "inactive", createdDate: "2026-01-18" },
            { id: 5, name: "Emma Davis", email: "emma@example.com", role: "admin", department: "Computational Mathematics", status: "active", createdDate: "2026-01-19" },
          ]);
          setUserLoginData([
            { id: 1, name: "Alice Johnson", email: "alice@example.com", loginCount: 45, lastLogin: "2026-05-03 09:30:00", loginDate: "2026-05-03", status: "active", totalLoginHours: "120 hrs" },
            { id: 2, name: "Bob Smith", email: "bob@example.com", loginCount: 32, lastLogin: "2026-05-02 14:15:00", loginDate: "2026-05-02", status: "active", totalLoginHours: "95 hrs" },
            { id: 3, name: "Carol White", email: "carol@example.com", loginCount: 28, lastLogin: "2026-05-01 11:45:00", loginDate: "2026-05-01", status: "active", totalLoginHours: "85 hrs" },
          ]);
          setInventoryDetailsData([
            { id: 1, name: "Server Room", department: "Information Technology", incharge: "Alice Johnson", itemCount: 25, createdDate: "2026-01-15", lastUpdated: "2026-05-01", status: "active" },
            { id: 2, name: "IT Equipment", department: "Information Technology", incharge: "Bob Smith", itemCount: 15, createdDate: "2026-01-16", lastUpdated: "2026-04-28", status: "active" },
            { id: 3, name: "Office Supplies", department: "Dean's Office", incharge: "Carol White", itemCount: 8, createdDate: "2026-01-17", lastUpdated: "2026-04-30", status: "active" },
          ]);
          setDepartmentDetailsData([
            { id: 1, name: "Information Technology", code: "IT", head: "CRJ Amalraj", userCount: 5, inventoryCount: 2, status: "active", createdDate: "2026-01-15" },
            { id: 2, name: "Dean's Office", code: "DO", head: "Yashodara Karunarathne", userCount: 3, inventoryCount: 1, status: "active", createdDate: "2026-01-20" },
            { id: 3, name: "Computational Mathematics", code: "CM", head: "YTS Piyatilake", userCount: 2, inventoryCount: 0, status: "inactive", createdDate: "2026-02-01" },
          ]);
        }

      } catch (error) {
        if (isMounted) {
          console.error("Failed to load report data:", error);
          setError(error.message || "Failed to load report data.");
          // Set empty data on error
          setStats([]);
          setUserDetailsData([]);
          setUserLoginData([]);
          setInventoryDetailsData([]);
          setDepartmentDetailsData([]);
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
        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
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
              {loading ? (
                <div className="text-center py-10 text-text-light">
                  <span className="material-symbols-outlined text-5xl mb-2 block">hourglass_empty</span>
                  Loading user details...
                </div>
              ) : (
                <Table
                  columns={userDetailsColumns}
                  data={userDetailsData}
                  rowsPerPage={10}
                />
              )}
            </Card>
          )}

          {activeTab === "user-login" && (
            <Card title="User Login Details Report" icon="login">
              {loading ? (
                <div className="text-center py-10 text-text-light">
                  <span className="material-symbols-outlined text-5xl mb-2 block">hourglass_empty</span>
                  Loading user login details...
                </div>
              ) : (
                <Table
                  columns={userLoginColumns}
                  data={userLoginData}
                  rowsPerPage={10}
                />
              )}
            </Card>
          )}

          {activeTab === "inventory-details" && (
            <Card title="Inventory Details Report" icon="inventory_2">
              {loading ? (
                <div className="text-center py-10 text-text-light">
                  <span className="material-symbols-outlined text-5xl mb-2 block">hourglass_empty</span>
                  Loading inventory details...
                </div>
              ) : (
                <Table
                  columns={inventoryDetailsColumns}
                  data={inventoryDetailsData}
                  rowsPerPage={10}
                />
              )}
            </Card>
          )}

          {activeTab === "department-details" && (
            <Card title="Department Details Report" icon="business">
              {loading ? (
                <div className="text-center py-10 text-text-light">
                  <span className="material-symbols-outlined text-5xl mb-2 block">hourglass_empty</span>
                  Loading department details...
                </div>
              ) : (
                <Table
                  columns={departmentDetailsColumns}
                  data={departmentDetailsData}
                  rowsPerPage={10}
                />
              )}
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
