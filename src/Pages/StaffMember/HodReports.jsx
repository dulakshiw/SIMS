import React, { useCallback, useEffect, useMemo, useState } from "react";
import MainLayout from "../../Components/Layouts/MainLayout";
import WorkflowReportExport from "../../Components/Inventory/WorkflowReportExport";
import {
  Badge,
  Card,
  PageHeader,
  SummaryCard,
  SummaryCardsGrid,
  Table,
} from "../../Components/UI";
import { ROLE_HIERARCHY } from "../../utils/constants";
import { fetchHodLiveReports, resolveHodProfile } from "../../utils/hodReportData";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const REPORT_TABS = [
  { id: "department-users", label: "Department Users", icon: "people" },
  { id: "inventories", label: "Inventories", icon: "inventory_2" },
  { id: "issued-items", label: "Items Issued to Staff", icon: "assignment_ind" },
  { id: "transfers", label: "Transfers", icon: "swap_horiz" },
  { id: "disposals", label: "Disposals", icon: "category" },
  { id: "repairs", label: "Repairs", icon: "build" },
];

const EMPTY_REPORTS = {
  summary: {
    totalUsers: 0,
    totalInventories: 0,
    totalAssets: 0,
    totalValue: "0.00",
    issuedToStaffCount: 0,
  },
  departmentUsers: [],
  inventories: [],
  assets: [],
  issuedItems: [],
  transfers: [],
  disposals: [],
  repairs: [],
};

const formatRoleLabel = (role) =>
  ROLE_HIERARCHY[role]?.label || String(role || "Unknown").replace(/_/g, " ");

const HodReports = () => {
  const [activeTab, setActiveTab] = useState("department-users");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [reports, setReports] = useState(EMPTY_REPORTS);

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const { hodUserId } = await resolveHodProfile(API_BASE_URL);

      if (!Number.isInteger(hodUserId) || hodUserId <= 0) {
        setDepartmentName("");
        setReports(EMPTY_REPORTS);
        setError("Unable to identify the signed-in head of department. Please sign in again.");
        return;
      }

      const liveReports = await fetchHodLiveReports(API_BASE_URL, hodUserId);
      setDepartmentName(liveReports.departmentName || "");
      setReports(liveReports.reports);
    } catch (loadError) {
      setDepartmentName("");
      setReports(EMPTY_REPORTS);
      setError(loadError.message || "Failed to load department reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const departmentUserData = useMemo(
    () => (reports.departmentUsers || []).map((user) => ({
      id: user.id,
      name: user.name || "—",
      email: user.email || "—",
      role: formatRoleLabel(user.role),
      designation: user.designation || "—",
      status: String(user.status || "inactive").toLowerCase(),
    })),
    [reports.departmentUsers]
  );

  const inventoryData = useMemo(
    () => (reports.inventories || []).map((inventory) => ({
      id: inventory.id,
      name: inventory.name || "—",
      department: inventory.department || departmentName || "—",
      location: inventory.location || "—",
      incharge: inventory.incharge || "—",
      itemCount: inventory.itemCount ?? 0,
      totalValue: inventory.totalValue ?? "0.00",
      status: String(inventory.status || "active").toLowerCase(),
      createdDate: inventory.createdDate || "—",
      date: inventory.createdDate || "—",
    })),
    [reports.inventories, departmentName]
  );

  const assetData = useMemo(
    () => (reports.assets || []).map((asset) => ({
      id: asset.itemId,
      itemName: asset.itemName || "—",
      itemCode: asset.itemCode || "—",
      serialNo: asset.serialNo || "—",
      inventoryName: asset.inventoryName || "—",
      location: asset.location || "—",
      status: asset.status || "—",
      value: asset.value ?? "0.00",
      updatedDate: asset.updatedDate || "—",
      date: asset.date || asset.updatedDate || asset.createdDate || asset.purchaseDate || "—",
    })),
    [reports.assets]
  );

  const issuedItemData = useMemo(
    () => (reports.issuedItems || []).map((item) => ({
      id: item.itemId,
      staffName: item.staffName || "—",
      department: item.department || departmentName || "—",
      designation: item.designation || "—",
      itemName: item.itemName || "—",
      itemCode: item.itemCode || "—",
      serialNo: item.serialNo || "—",
      inventoryName: item.inventoryName || "—",
      status: item.status || "—",
      value: item.value ?? "0.00",
      issuedDate: item.issuedDate || "—",
      returnedDate: item.returnedDate || "—",
      date: item.date || item.issuedDate || "—",
    })),
    [reports.issuedItems, departmentName]
  );

  const renderApprovalStatus = (value) => {
    const s = String(value || "").toLowerCase();
    const label = String(value || "—").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    let variant = "warning";
    if (s.includes("complet") || s === "approved" || s === "repaired") variant = "success";
    else if (s.includes("reject") || s.includes("cancel")) variant = "danger";
    else if (s.includes("progress")) variant = "primary";
    else if (s.includes("registrar")) variant = "info";
    return <Badge label={label} variant={variant} size="sm" />;
  };

  const transferData = useMemo(
    () => (reports.transfers || []).map((t) => ({
      id: t.id,
      itemName: t.itemName || "—",
      fromInventory: t.fromInventory || "—",
      toInventory: t.toInventory || "—",
      quantity: t.quantity ?? 1,
      reason: t.reason || "—",
      approvalStatus: t.approvalStatus || "",
      transferDate: t.transferDate || "—",
      completedDate: t.completedDate || "—",
      initiatedBy: t.initiatedBy || "—",
      date: t.date || t.transferDate || "—",
    })),
    [reports.transfers]
  );

  const disposalData = useMemo(
    () => (reports.disposals || []).map((d) => ({
      id: d.id,
      itemName: d.itemName || "—",
      inventory: d.inventory || "—",
      quantity: d.quantity ?? 1,
      reason: d.reason || "—",
      disposalType: d.disposalType || "—",
      approvalStatus: d.approvalStatus || "",
      disposalDate: d.disposalDate || "—",
      initiatedBy: d.initiatedBy || "—",
      date: d.date || d.disposalDate || "—",
    })),
    [reports.disposals]
  );

  const repairData = useMemo(
    () => (reports.repairs || []).map((r) => ({
      id: r.id,
      itemName: r.itemName || "—",
      inventory: r.inventory || "—",
      quantity: r.quantity ?? 1,
      faultDescription: r.faultDescription || "—",
      approvalStatus: r.approvalStatus || "",
      repairCost: r.repairCost || "—",
      repairDate: r.repairDate || "—",
      initiatedBy: r.initiatedBy || "—",
      date: r.date || r.repairDate || "—",
    })),
    [reports.repairs]
  );

  const stats = useMemo(
    () => [
      {
        tabId: "department-users",
        title: "Total Users",
        count: reports.summary?.totalUsers ?? 0,
        description: "Registered users in your department.",
        icon: "people",
      },
      {
        tabId: "inventories",
        title: "Inventories",
        count: reports.summary?.totalInventories ?? 0,
        description: "Inventory locations in your department.",
        icon: "inventory_2",
        countClassName: "text-success",
      },
      {
        tabId: "assets",
        title: "Total Assets",
        count: reports.summary?.totalAssets ?? 0,
        description: "Items tracked across department inventories.",
        icon: "category",
        countClassName: "text-info",
      },
      {
        tabId: "issued-items",
        title: "Items Issued to Staff",
        count: reports.summary?.issuedToStaffCount ?? 0,
        description: "Assets currently issued to department staff.",
        icon: "assignment_ind",
        countClassName: "text-warning",
      },
    ],
    [reports.summary]
  );

  const departmentUserColumns = [
    { field: "name", label: "Name", sortable: true },
    { field: "email", label: "Email", sortable: true },
    {
      field: "role",
      label: "Role",
      render: (value) => <Badge label={value} variant="primary" size="sm" />,
    },
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
  ];

  const inventoryColumns = [
    { field: "name", label: "Inventory Name", sortable: true },
    { field: "department", label: "Department", sortable: true },
    { field: "location", label: "Location", sortable: true },
    { field: "incharge", label: "Inventory Officer", sortable: true },
    { field: "itemCount", label: "Item Count", sortable: true },
    { field: "totalValue", label: "Total Value (LKR)", sortable: true },
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

  const assetColumns = [
    { field: "itemName", label: "Item Name", sortable: true },
    { field: "itemCode", label: "Item Code", sortable: true },
    { field: "serialNo", label: "Serial No", sortable: true },
    { field: "inventoryName", label: "Inventory", sortable: true },
    { field: "location", label: "Location", sortable: true },
    { field: "status", label: "Status", sortable: true },
    { field: "updatedDate", label: "Last Updated", sortable: true },
    { field: "value", label: "Value (LKR)", sortable: true },
  ];

  const issuedItemColumns = [
    { field: "staffName", label: "Staff Member", sortable: true },
    { field: "department", label: "Department", sortable: true },
    { field: "designation", label: "Designation", sortable: true },
    { field: "itemName", label: "Item", sortable: true },
    { field: "itemCode", label: "Item Code", sortable: true },
    { field: "serialNo", label: "Serial No", sortable: true },
    { field: "inventoryName", label: "Inventory", sortable: true },
    { field: "status", label: "Status", sortable: true },
    { field: "issuedDate", label: "Issued Date", sortable: true },
    { field: "returnedDate", label: "Return Date", sortable: true },
    { field: "value", label: "Value (LKR)", sortable: true },
  ];

  const transferColumns = [
    { field: "itemName", label: "Item", sortable: true },
    { field: "fromInventory", label: "From Inventory", sortable: true },
    { field: "toInventory", label: "To Inventory", sortable: true },
    { field: "quantity", label: "Qty", sortable: true },
    { field: "reason", label: "Reason", sortable: true },
    {
      field: "approvalStatus",
      label: "Status",
      render: renderApprovalStatus,
    },
    { field: "transferDate", label: "Transfer Date", sortable: true },
    { field: "completedDate", label: "Completed Date", sortable: true },
    { field: "initiatedBy", label: "Initiated By", sortable: true },
  ];

  const disposalColumns = [
    { field: "itemName", label: "Item", sortable: true },
    { field: "inventory", label: "Inventory", sortable: true },
    { field: "quantity", label: "Qty", sortable: true },
    { field: "reason", label: "Reason", sortable: true },
    { field: "disposalType", label: "Type", sortable: true },
    {
      field: "approvalStatus",
      label: "Status",
      render: renderApprovalStatus,
    },
    { field: "disposalDate", label: "Disposal Date", sortable: true },
    { field: "initiatedBy", label: "Initiated By", sortable: true },
  ];

  const repairColumns = [
    { field: "itemName", label: "Item", sortable: true },
    { field: "inventory", label: "Inventory", sortable: true },
    { field: "quantity", label: "Qty", sortable: true },
    { field: "faultDescription", label: "Fault Description", sortable: true },
    {
      field: "approvalStatus",
      label: "Status",
      render: renderApprovalStatus,
    },
    { field: "repairCost", label: "Repair Cost (LKR)", sortable: true },
    { field: "repairDate", label: "Repair Date", sortable: true },
    { field: "initiatedBy", label: "Initiated By", sortable: true },
  ];

  const activeTabConfig = useMemo(() => {
    switch (activeTab) {
      case "inventories":
        return {
          rows: inventoryData,
          columns: inventoryColumns,
          searchFields: ["name", "department", "location", "incharge", "status"],
          searchPlaceholder: "Search by inventory name, location, or officer...",
          reportTitle: "Department Inventories Report",
          fileNamePrefix: "department-inventories",
          dateField: "date",
          showDateFilters: true,
        };
      case "assets":
        return {
          rows: assetData,
          columns: assetColumns,
          searchFields: ["itemName", "itemCode", "serialNo", "inventoryName", "location", "status"],
          searchPlaceholder: "Search by item name, code, inventory, or location...",
          reportTitle: "Department Assets Report",
          fileNamePrefix: "department-assets",
          dateField: "date",
          showDateFilters: true,
        };
      case "issued-items":
        return {
          rows: issuedItemData,
          columns: issuedItemColumns,
          searchFields: [
            "staffName",
            "department",
            "designation",
            "itemName",
            "itemCode",
            "serialNo",
            "inventoryName",
            "status",
            "issuedDate",
            "returnedDate",
          ],
          searchPlaceholder: "Search by staff name, item, or inventory...",
          reportTitle: "Items Issued to Staff Report",
          fileNamePrefix: "issued-items",
          dateField: "date",
          showDateFilters: true,
        };
      case "transfers":
        return {
          rows: transferData,
          columns: transferColumns,
          searchFields: ["itemName", "fromInventory", "toInventory", "reason", "approvalStatus", "initiatedBy"],
          searchPlaceholder: "Search by item, inventory, reason, or status...",
          reportTitle: "Department Item Transfers Report",
          fileNamePrefix: "department-transfers",
          dateField: "date",
          showDateFilters: true,
        };
      case "disposals":
        return {
          rows: disposalData,
          columns: disposalColumns,
          searchFields: ["itemName", "inventory", "reason", "disposalType", "approvalStatus", "initiatedBy"],
          searchPlaceholder: "Search by item, inventory, reason, or type...",
          reportTitle: "Department Item Disposals Report",
          fileNamePrefix: "department-disposals",
          dateField: "date",
          showDateFilters: true,
        };
      case "repairs":
        return {
          rows: repairData,
          columns: repairColumns,
          searchFields: ["itemName", "inventory", "faultDescription", "approvalStatus", "initiatedBy"],
          searchPlaceholder: "Search by item, inventory, fault, or status...",
          reportTitle: "Department Item Repairs Report",
          fileNamePrefix: "department-repairs",
          dateField: "date",
          showDateFilters: true,
        };
      default:
        return {
          rows: departmentUserData,
          columns: departmentUserColumns,
          searchFields: ["name", "email", "role", "designation", "status"],
          searchPlaceholder: "Search by name, email, role, or designation...",
          reportTitle: "Department Users Report",
          fileNamePrefix: "department-users",
          dateField: "date",
          showDateFilters: false,
        };
    }
  }, [
    activeTab,
    departmentUserData,
    inventoryData,
    assetData,
    issuedItemData,
    transferData,
    disposalData,
    repairData,
    departmentUserColumns,
    inventoryColumns,
    assetColumns,
    issuedItemColumns,
    transferColumns,
    disposalColumns,
    repairColumns,
  ]);

  const activeTabMeta = REPORT_TABS.find((tab) => tab.id === activeTab) || REPORT_TABS[0];
  const pageSubtitle = departmentName
    ? `Live department analytics for ${departmentName}`
    : "Department users, inventories, assets, and issued items";

  return (
    <MainLayout variant="hod">
      <PageHeader
        title="Reports & Analytics"
        subtitle={pageSubtitle}
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
              key={stat.tabId}
              title={stat.title}
              count={stat.count}
              description={stat.description}
              icon={stat.icon}
              loading={loading}
              countClassName={stat.countClassName}
              active={activeTab === stat.tabId}
              onClick={() => setActiveTab(stat.tabId)}
            />
          ))}
        </SummaryCardsGrid>

        <div className="border-b border-border-light">
          <div className="flex gap-2 overflow-x-auto">
            {REPORT_TABS.map((tab) => (
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
          ) : (
            <Card title={activeTabConfig.reportTitle} icon={activeTabMeta.icon}>
              <WorkflowReportExport
                key={activeTab}
                rows={activeTabConfig.rows}
                columns={activeTabConfig.columns}
                reportTitle={activeTabConfig.reportTitle}
                fileNamePrefix={activeTabConfig.fileNamePrefix}
                dateField={activeTabConfig.dateField}
                searchFields={activeTabConfig.searchFields}
                searchPlaceholder={activeTabConfig.searchPlaceholder}
                disabled={loading}
                showDateFilters={activeTabConfig.showDateFilters}
              />

              {activeTabConfig.rows.length === 0 ? (
                <p className="text-sm text-text-light p-4">No records found.</p>
              ) : (
                <Table
                  columns={activeTabConfig.columns}
                  data={activeTabConfig.rows}
                  searchable
                  loading={loading}
                  itemsPerPage={15}
                />
              )}
            </Card>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default HodReports;
