import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import MainLayout from "../../Components/Layouts/MainLayout";
import WorkflowReportExport from "../../Components/Inventory/WorkflowReportExport";
import {
  Badge,
  Button,
  Card,
  PageHeader,
  SummaryCard,
  SummaryCardsGrid,
  Table,
} from "../../Components/UI";
import { ITEM_REQUEST_STATUS, ITEM_REQUEST_STATUS_META } from "../../utils/constants";
import {
  fetchInventoryOfficerItemRequests,
  fetchInventoryOfficerLiveReports,
  resolveOfficerProfile,
} from "../../utils/inventoryOfficerReportData";
import { resolveSidebarVariant } from "../../utils/helpers";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const REPORT_TABS = [
  { key: "inventories", label: "Assigned Inventories" },
  { key: "assets-by-inventory", label: "Assets by Inventory" },
  { key: "issued-items", label: "Items Issued to Staff" },
  { key: "assets-by-category", label: "Assets by Category" },
  { key: "item-requests", label: "Inventory Requests" },
];

const formatStatusBadge = (status) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "active") {
    return <Badge variant="completed">Active</Badge>;
  }
  if (normalized === "inactive") {
    return <Badge variant="rejected">Inactive</Badge>;
  }
  return <Badge variant="info">{status || "—"}</Badge>;
};

const INVENTORY_COLUMNS = [
  { field: "name", label: "Inventory" },
  { field: "department", label: "Department" },
  { field: "location", label: "Location" },
  { field: "hod", label: "HOD" },
  { field: "itemCount", label: "Total Assets" },
  { field: "totalValue", label: "Total Value (LKR)" },
  {
    field: "status",
    label: "Status",
    render: (value) => formatStatusBadge(value),
  },
];

const ASSETS_BY_INVENTORY_COLUMNS = [
  { field: "inventoryName", label: "Inventory" },
  { field: "location", label: "Location" },
  { field: "department", label: "Department" },
  { field: "itemCount", label: "Asset Count" },
  { field: "totalValue", label: "Total Value (LKR)" },
];

const ISSUED_ITEMS_COLUMNS = [
  { field: "staffName", label: "Staff Member" },
  { field: "department", label: "Department" },
  { field: "designation", label: "Designation" },
  { field: "itemName", label: "Item" },
  { field: "itemCode", label: "Item Code" },
  { field: "serialNo", label: "Serial No" },
  { field: "inventoryName", label: "Inventory" },
  { field: "status", label: "Status" },
  { field: "value", label: "Value (LKR)" },
];

const CATEGORY_COLUMNS = [
  { field: "category", label: "Category" },
  { field: "itemCount", label: "Count" },
  { field: "label", label: "Summary" },
  { field: "totalValue", label: "Total Value (LKR)" },
];

const ITEM_REQUEST_COLUMNS = [
  { field: "id", label: "Request ID" },
  { field: "requester", label: "Requested by" },
  { field: "department", label: "Department" },
  { field: "itemName", label: "Item" },
  { field: "quantity", label: "Qty" },
  { field: "inventory", label: "Inventory" },
  { field: "priority", label: "Priority" },
  { field: "status", label: "Status" },
  { field: "requestedDate", label: "Requested" },
  { field: "issuedDate", label: "Issued" },
  { field: "returnedDate", label: "Returned" },
];

const formatRequestStatusLabel = (statusKey) =>
  ITEM_REQUEST_STATUS_META[statusKey]?.label
  || String(statusKey || "").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

const mapItemRequestReportRow = (request = {}) => {
  const statusKey = String(request.approvalStatus || "").toLowerCase();

  return {
    id: `REQ-${request.id}`,
    requester: request.requestedByName || "—",
    department: request.departmentName || "—",
    itemName: request.itemName || "—",
    quantity: request.quantity ?? "—",
    inventory: request.inventoryName || request.inventoryLocation || "—",
    priority: request.priority || "normal",
    statusKey,
    status: formatRequestStatusLabel(statusKey),
    requestedDate: request.requestedDate || "—",
    issuedDate: request.issuedDate || "—",
    returnedDate: request.returnedDate || "—",
    date: request.issuedDate || request.returnedDate || request.requestedDate || "—",
  };
};

const InventoryOfficerReports = () => {
  const location = useLocation();
  const { role } = useParams();
  const sidebarVariant = resolveSidebarVariant(location.pathname, role);
  const [activeTab, setActiveTab] = useState("inventories");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [officerName, setOfficerName] = useState("");
  const [reports, setReports] = useState({
    summary: {
      totalInventories: 0,
      totalAssets: 0,
      totalValue: "0.00",
      issuedToStaffCount: 0,
    },
    inventories: [],
    assetsByInventory: [],
    issuedItems: [],
    assetsByCategory: [],
  });
  const [itemRequests, setItemRequests] = useState([]);

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");

      const { officerUserId, profile } = await resolveOfficerProfile(API_BASE_URL);
      setOfficerName(profile?.name || "");

      if (!Number.isInteger(officerUserId) || officerUserId <= 0) {
        setReports({
          summary: {
            totalInventories: 0,
            totalAssets: 0,
            totalValue: "0.00",
            issuedToStaffCount: 0,
          },
          inventories: [],
          assetsByInventory: [],
          issuedItems: [],
          assetsByCategory: [],
        });
        setItemRequests([]);
        setLoadError("Unable to identify the signed-in inventory officer. Please sign in again.");
        return;
      }

      const [liveReports, requestRows] = await Promise.all([
        fetchInventoryOfficerLiveReports(API_BASE_URL, officerUserId),
        fetchInventoryOfficerItemRequests(API_BASE_URL, officerUserId),
      ]);

      setReports(liveReports);
      setItemRequests(requestRows.map(mapItemRequestReportRow));
    } catch (error) {
      setReports({
        summary: {
          totalInventories: 0,
          totalAssets: 0,
          totalValue: "0.00",
          issuedToStaffCount: 0,
        },
        inventories: [],
        assetsByInventory: [],
        issuedItems: [],
        assetsByCategory: [],
      });
      setItemRequests([]);
      setLoadError(error.message || "Failed to load inventory reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const itemRequestSummary = useMemo(() => {
    const summary = {
      total: itemRequests.length,
      pendingIssue: 0,
      issued: 0,
      returned: 0,
      other: 0,
    };

    itemRequests.forEach((request) => {
      const statusKey = String(request.statusKey || "").toLowerCase();
      if (
        statusKey === ITEM_REQUEST_STATUS.APPROVED_TO_ISSUE
        || statusKey === "pending_issue"
      ) {
        summary.pendingIssue += 1;
      } else if (statusKey === ITEM_REQUEST_STATUS.APPROVED) {
        summary.issued += 1;
      } else if (statusKey === ITEM_REQUEST_STATUS.RETURNED) {
        summary.returned += 1;
      } else {
        summary.other += 1;
      }
    });

    return summary;
  }, [itemRequests]);

  const inventoryRows = useMemo(() => reports.inventories || [], [reports.inventories]);
  const isItemRequestsTab = activeTab === "item-requests";

  const activeTabConfig = useMemo(() => {
    switch (activeTab) {
      case "assets-by-inventory":
        return {
          rows: reports.assetsByInventory || [],
          columns: ASSETS_BY_INVENTORY_COLUMNS,
          searchFields: ["inventoryName", "location", "department"],
          searchPlaceholder: "Search by inventory, location, or department...",
          reportTitle: "Assets by Inventory",
          fileNamePrefix: "assets-by-inventory",
        };
      case "issued-items":
        return {
          rows: reports.issuedItems || [],
          columns: ISSUED_ITEMS_COLUMNS,
          searchFields: [
            "staffName",
            "department",
            "designation",
            "itemName",
            "itemCode",
            "serialNo",
            "inventoryName",
            "status",
          ],
          searchPlaceholder: "Search by staff name, department, item, or inventory...",
          reportTitle: "Items Issued to Staff",
          fileNamePrefix: "issued-items",
        };
      case "assets-by-category":
        return {
          rows: reports.assetsByCategory || [],
          columns: CATEGORY_COLUMNS,
          searchFields: ["category", "label"],
          searchPlaceholder: "Search by category...",
          reportTitle: "Assets by Category",
          fileNamePrefix: "assets-by-category",
          dateField: "date",
          showDateFilters: false,
        };
      case "item-requests":
        return {
          rows: itemRequests,
          columns: ITEM_REQUEST_COLUMNS,
          searchFields: [
            "id",
            "requester",
            "department",
            "itemName",
            "inventory",
            "priority",
            "status",
          ],
          searchPlaceholder: "Search by request ID, staff name, department, item, or status...",
          reportTitle: "Inventory Requests",
          fileNamePrefix: "inventory-requests",
          dateField: "date",
          showDateFilters: true,
        };
      default:
        return {
          rows: reports.inventories || [],
          columns: INVENTORY_COLUMNS,
          searchFields: ["name", "department", "location", "hod", "description"],
          searchPlaceholder: "Search by inventory name, department, location, or HOD...",
          reportTitle: "Assigned Inventories",
          fileNamePrefix: "assigned-inventories",
          dateField: "date",
          showDateFilters: false,
        };
    }
  }, [activeTab, reports, itemRequests]);

  const exportRows = activeTabConfig.rows;
  const pageSubtitle = officerName
    ? `Live inventory data for ${officerName}`
    : "Assigned inventories, asset totals, issued items, category breakdown, and item requests";

  return (
    <MainLayout variant={sidebarVariant}>
      <PageHeader
        title="Inventory Reports"
        subtitle={pageSubtitle}
        actions={(
          <Button
            type="button"
            variant="secondary"
            icon="refresh"
            onClick={loadReports}
            disabled={loading}
          >
            Refresh
          </Button>
        )}
      />

      <div className="p-6 space-y-6">
        <SummaryCardsGrid columns={4} showTitle={false}>
          <SummaryCard
            title="Assigned Inventories"
            count={reports.summary?.totalInventories ?? 0}
            icon="inventory_2"
            loading={loading}
          />
          <SummaryCard
            title="Total Assets"
            count={reports.summary?.totalAssets ?? 0}
            icon="category"
            loading={loading}
          />
          <SummaryCard
            title="Total Asset Value (LKR)"
            count={reports.summary?.totalValue ?? "0.00"}
            icon="payments"
            loading={loading}
          />
          <SummaryCard
            title="Inventory Requests"
            count={itemRequestSummary.total}
            icon="request_quote"
            loading={loading}
          />
        </SummaryCardsGrid>

        {isItemRequestsTab ? (
          <SummaryCardsGrid columns={4} showTitle={false}>
            <SummaryCard title="Pending issue" count={itemRequestSummary.pendingIssue} icon="pending_actions" />
            <SummaryCard title="Issued" count={itemRequestSummary.issued} icon="inventory_2" />
            <SummaryCard title="Returned" count={itemRequestSummary.returned} icon="undo" />
            <SummaryCard title="Other statuses" count={itemRequestSummary.other} icon="fact_check" />
          </SummaryCardsGrid>
        ) : null}

        <Card>
          <div className="flex flex-wrap gap-2 border-b border-border-lighter pb-4 mb-4">
            {REPORT_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? "bg-primary text-white"
                    : "bg-background-light text-text-dark hover:bg-border-lighter"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {loadError ? (
            <p className="text-sm text-error mb-4">{loadError}</p>
          ) : null}

          <WorkflowReportExport
            rows={exportRows}
            columns={activeTabConfig.columns}
            reportTitle={activeTabConfig.reportTitle}
            fileNamePrefix={activeTabConfig.fileNamePrefix}
            dateField={activeTabConfig.dateField || "date"}
            searchFields={activeTabConfig.searchFields}
            searchPlaceholder={activeTabConfig.searchPlaceholder}
            disabled={loading}
            showDateFilters={activeTabConfig.showDateFilters ?? false}
          />

          <Table
            columns={activeTab === "inventories" ? INVENTORY_COLUMNS : activeTabConfig.columns}
            data={activeTab === "inventories" ? inventoryRows : activeTabConfig.rows}
            searchable
            loading={loading}
            itemsPerPage={15}
          />
        </Card>
      </div>
    </MainLayout>
  );
};

export default InventoryOfficerReports;
