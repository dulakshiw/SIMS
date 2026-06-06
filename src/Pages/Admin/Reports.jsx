import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import AdminLayout from "../../Components/Layouts/AdminLayout";
import MainLayout from "../../Components/Layouts/MainLayout";
import { Card, Button, Table, Badge, PageHeader, SummaryCard, SummaryCardsGrid } from "../../Components/UI";
import { ROLE_HIERARCHY } from "../../utils/constants";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const formatDateTime = (value) => {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatRoleLabel = (role) =>
  ROLE_HIERARCHY[role]?.label || String(role || "Unknown").replace(/_/g, " ");

const Reports = ({ layoutVariant = "admin", sidebarVariant }) => {
  const params = useParams();
  const resolvedSidebarVariant = sidebarVariant || params?.role || "staff";
  const Layout = layoutVariant === "admin" ? AdminLayout : MainLayout;
  const [activeTab, setActiveTab] = useState("user-details");
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalItems: 0,
    inventories: 0,
    pendingRequests: 0,
  });
  const [recentActivities, setRecentActivities] = useState([]);
  const [userDetailsData, setUserDetailsData] = useState([]);
  const [userLoginData, setUserLoginData] = useState([]);
  const [inventoryDetailsData, setInventoryDetailsData] = useState([]);
  const [departmentDetailsData, setDepartmentDetailsData] = useState([]);

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [summaryRes, usersRes, inventoriesRes, departmentsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/dashboard/summary`),
        fetch(`${API_BASE_URL}/api/users`),
        fetch(`${API_BASE_URL}/api/inventories`),
        fetch(`${API_BASE_URL}/api/departments?includeInactive=true`),
      ]);

      const [summaryJson, usersJson, inventoriesJson, departmentsJson] = await Promise.all([
        summaryRes.json().catch(() => ({})),
        usersRes.json().catch(() => ({})),
        inventoriesRes.json().catch(() => ({})),
        departmentsRes.json().catch(() => ({})),
      ]);

      if (!summaryRes.ok || !summaryJson.success) {
        throw new Error(summaryJson.error || summaryJson.message || "Failed to load dashboard summary.");
      }
      if (!usersRes.ok || !usersJson.success) {
        throw new Error(usersJson.error || usersJson.message || "Failed to load users report.");
      }
      if (!inventoriesRes.ok || !inventoriesJson.success) {
        throw new Error(inventoriesJson.error || inventoriesJson.message || "Failed to load inventories report.");
      }
      if (!departmentsRes.ok || !departmentsJson.success) {
        throw new Error(departmentsJson.error || departmentsJson.message || "Failed to load departments report.");
      }

      const adminSummary = summaryJson.adminSummary || {};
      const inventorySummary = summaryJson.inventorySummary || {};

      setSummary({
        totalUsers: adminSummary.totalUsers ?? 0,
        activeUsers: adminSummary.activeUsers ?? 0,
        totalItems: adminSummary.totalItems ?? 0,
        inventories: adminSummary.inventories ?? 0,
        pendingRequests: inventorySummary.pendingRequests ?? 0,
      });
      setRecentActivities(summaryJson.recentActivities || []);

      const users = usersJson.users || [];
      setUserDetailsData(
        users.map((user) => ({
          id: user.id,
          name: user.name || "—",
          email: user.email || "—",
          role: formatRoleLabel(user.role),
          department: user.department || "—",
          designation: user.designation || "—",
          status: String(user.status || "inactive").toLowerCase(),
          joinDate: user.createdDate || "—",
          lastActive: formatDateTime(user.lastLogin),
        }))
      );

      setUserLoginData(
        users.map((user) => ({
          id: user.id,
          name: user.name || "—",
          email: user.email || "—",
          lastLogin: formatDateTime(user.lastLogin),
          loginDate: user.lastLogin ? new Date(user.lastLogin).toISOString().split("T")[0] : "—",
          status: String(user.status || "inactive").toLowerCase(),
        }))
      );

      setInventoryDetailsData(
        (inventoriesJson.inventories || []).map((inventory) => ({
          id: inventory.id,
          name: inventory.name || "—",
          department: inventory.department || "—",
          incharge: inventory.incharge || "—",
          itemCount: inventory.itemCount ?? 0,
          createdDate: inventory.createdDate || "—",
          lastUpdated: inventory.lastUpdated || "—",
          status: String(inventory.status || "active").toLowerCase(),
        }))
      );

      setDepartmentDetailsData(
        (departmentsJson.departments || []).map((department) => ({
          id: department.id,
          name: department.name || "—",
          code: department.code || "—",
          head: department.head || "—",
          userCount: department.userCount ?? 0,
          inventoryCount: department.inventoryCount ?? 0,
          status: String(department.status || "active").toLowerCase(),
          createdDate: department.createdDate || "—",
        }))
      );
    } catch (loadError) {
      setError(loadError.message || "Unable to load report data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

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

  const stats = useMemo(
    () => [
      { title: "Total Users", count: summary.totalUsers, description: "Registered user accounts.", icon: "people" },
      { title: "Total Assets", count: summary.totalItems, description: "Items tracked in inventories.", icon: "inventory_2", countClassName: "text-info" },
      { title: "Pending Requests", count: summary.pendingRequests, description: "Open requests awaiting action.", icon: "request_quote", countClassName: "text-warning" },
      { title: "Inventories", count: summary.inventories, description: "Active inventory locations.", icon: "storehouse", countClassName: "text-success" },
    ],
    [summary]
  );

  const roleDistribution = useMemo(() => {
    const counts = userDetailsData.reduce((accumulator, user) => {
      const key = user.role || "Unknown";
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    }, {});

    return Object.entries(counts)
      .map(([role, count]) => ({ role, count }))
      .sort((left, right) => right.count - left.count);
  }, [userDetailsData]);

  const userDetailsColumns = [
    { field: "name", label: "Name", sortable: true },
    { field: "email", label: "Email", sortable: true },
    {
      field: "role",
      label: "Role",
      render: (value) => <Badge label={value} variant="primary" size="sm" />,
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
    { field: "lastLogin", label: "Last Login" },
    { field: "loginDate", label: "Login Date", sortable: true },
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
        headers: ["Name", "Email", "Last Login", "Login Date", "Status"],
        rows: userLoginData.map((userLogin) => [
          userLogin.name,
          userLogin.email,
          userLogin.lastLogin,
          userLogin.loginDate,
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

    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const generatedAt = new Date().toLocaleString();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const systemTitle = "Inventory Management System - Faculty of Information Technology";

    autoTable(doc, {
      head: [selectedReport.headers],
      body: selectedReport.rows,
      startY: 52,
      styles: { fontSize: 11, cellPadding: 4 },
      headStyles: { fillColor: [17, 76, 126], fontSize: 11, halign: "center" },
      bodyStyles: { fontSize: 11 },
      margin: { top: 52, bottom: 36, left: 28, right: 28 },
      didDrawPage: () => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.text(systemTitle, pageWidth / 2, 22, { align: "center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.text(selectedReport.title, pageWidth / 2, 38, { align: "center" });
      },
    });

    const pageCount = doc.getNumberOfPages();
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      doc.setPage(pageNumber);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(`${pageNumber} of ${pageCount}`, pageWidth / 2, pageHeight - 16, { align: "center" });
      doc.text(`Generated: ${generatedAt}`, 28, pageHeight - 16);
    }

    doc.save(`${selectedReport.fileName}.pdf`);
  };

  const handleExportReport = (reportType, format) => {
    if (format === "pdf") {
      handleExportPdf(reportType);
      return;
    }

    handleExportCsv(reportType);
  };

  const maxRoleCount = roleDistribution[0]?.count || 1;

  return (
    <Layout {...(layoutVariant === "admin" ? {} : { variant: resolvedSidebarVariant })}>
      <PageHeader
        title="Reports & Analytics"
        subtitle="Live system analytics and performance metrics"
        actions={
          <div className="relative" ref={exportDropdownRef}>
            <Button
              icon="download"
              onClick={() => setIsExportDropdownOpen((prev) => !prev)}
              disabled={loading || Boolean(error)}
            >
              Export Report
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
        {error ? (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        <SummaryCardsGrid showTitle={false} columns="4-lg">
          {stats.map((stat) => (
            <SummaryCard
              key={stat.title}
              title={stat.title}
              count={stat.count}
              description={stat.description}
              icon={stat.icon}
              loading={loading}
              countClassName={stat.countClassName}
              hover={false}
            />
          ))}
        </SummaryCardsGrid>

        <div className="border-b border-border-light">
          <div className="flex gap-2 overflow-x-auto">
            {[
              { id: "user-details", label: "User Details" },
              { id: "user-login", label: "User Login Details" },
              { id: "inventory-details", label: "Inventory Details" },
              { id: "department-details", label: "Department Details" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 border-b-2 font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-text-light hover:text-text-dark"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6">
          {loading ? (
            <Card>
              <p className="text-sm text-text-light p-6">Loading report data...</p>
            </Card>
          ) : null}

          {!loading && activeTab === "user-details" ? (
            <Card title="User Details Report" icon="people">
              {userDetailsData.length === 0 ? (
                <p className="text-sm text-text-light p-4">No users found.</p>
              ) : (
                <Table columns={userDetailsColumns} data={userDetailsData} itemsPerPage={10} />
              )}
            </Card>
          ) : null}

          {!loading && activeTab === "user-login" ? (
            <Card title="User Login Details Report" icon="login">
              <p className="mb-4 text-sm text-text-light bg-background-light p-3 rounded">
                Shows the most recent login recorded for each user account.
              </p>
              {userLoginData.length === 0 ? (
                <p className="text-sm text-text-light p-4">No login records found.</p>
              ) : (
                <Table columns={userLoginColumns} data={userLoginData} itemsPerPage={10} />
              )}
            </Card>
          ) : null}

          {!loading && activeTab === "inventory-details" ? (
            <Card title="Inventory Details Report" icon="inventory_2">
              {inventoryDetailsData.length === 0 ? (
                <p className="text-sm text-text-light p-4">No inventories found.</p>
              ) : (
                <Table columns={inventoryDetailsColumns} data={inventoryDetailsData} itemsPerPage={10} />
              )}
            </Card>
          ) : null}

          {!loading && activeTab === "department-details" ? (
            <Card title="Department Details Report" icon="business">
              {departmentDetailsData.length === 0 ? (
                <p className="text-sm text-text-light p-4">No departments found.</p>
              ) : (
                <Table columns={departmentDetailsColumns} data={departmentDetailsData} itemsPerPage={10} />
              )}
            </Card>
          ) : null}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Recent System Activity" icon="history">
            {loading ? (
              <p className="text-sm text-text-light">Loading activity...</p>
            ) : recentActivities.length === 0 ? (
              <p className="text-sm text-text-light">No recent activity recorded.</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {recentActivities.slice(0, 8).map((activity) => (
                  <div
                    key={activity.id}
                    className="rounded-lg border border-border-lighter px-3 py-2.5 text-sm"
                  >
                    <p className="font-medium text-text-dark">{activity.message}</p>
                    {activity.timestamp ? (
                      <p className="text-xs text-text-light mt-1">{formatDateTime(activity.timestamp)}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="User Distribution by Role" icon="groups">
            {loading ? (
              <p className="text-sm text-text-light">Loading distribution...</p>
            ) : roleDistribution.length === 0 ? (
              <p className="text-sm text-text-light">No user role data available.</p>
            ) : (
              <div className="space-y-4">
                {roleDistribution.map((entry) => (
                  <div key={entry.role}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-text-dark">{entry.role}</span>
                      <span className="text-text-light">{entry.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-background-light overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary-600 transition-all"
                        style={{ width: `${Math.max((entry.count / maxRoleCount) * 100, 4)}%` }}
                      />
                    </div>
                  </div>
                ))}
                <p className="text-xs text-text-light pt-2 border-t border-border-lighter">
                  {summary.activeUsers} of {summary.totalUsers} users are currently active.
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Reports;
