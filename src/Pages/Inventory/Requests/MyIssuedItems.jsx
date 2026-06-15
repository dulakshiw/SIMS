import React, { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import MainLayout from "../../../Components/Layouts/MainLayout";
import {
  Card,
  SearchBox,
  Table,
  Badge,
  EntityDetailsModal,
  PageHeader,
} from "../../../Components/UI";
import { ITEM_REQUEST_STATUS_META, ITEM_STATUS } from "../../../utils/constants";
import { resolveSidebarVariant } from "../../../utils/helpers";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("currentUser") || "{}");
  } catch {
    return {};
  }
};

const MyIssuedItems = () => {
  const location = useLocation();
  const { role } = useParams();
  const sidebarVariant = resolveSidebarVariant(location.pathname, role);
  const [searchTerm, setSearchTerm] = useState("");
  const [issuedItems, setIssuedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadIssuedItems = async () => {
      const currentUser = getStoredUser();
      const requestedById = Number(currentUser.id ?? 0);

      if (!Number.isInteger(requestedById) || requestedById <= 0) {
        if (isMounted) {
          setIssuedItems([]);
          setLoadError("Your session is missing a user id. Please sign in again.");
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        setLoadError("");

        const [requestsResponse, locationItemsResponse] = await Promise.all([
          fetch(
            `${API_BASE_URL}/api/item-requests?requestedById=${requestedById}&requesterScope=issued`
          ),
          fetch(`${API_BASE_URL}/api/items?issuedToUserId=${requestedById}`),
        ]);
        const [data, locationItemsData] = await Promise.all([
          requestsResponse.json().catch(() => ({})),
          locationItemsResponse.json().catch(() => ({})),
        ]);

        if (!requestsResponse.ok || !data.success) {
          throw new Error(data.message || data.error || "Failed to load your issued items.");
        }

        if (!isMounted) {
          return;
        }

        const requestEntries = (data.requests || []).map((request) => {
          const allocated = request.allocatedItem || {};
          return {
            id: `REQ-${request.id}`,
            rawId: request.id,
            requestedItem: request.itemName || "—",
            issuedItem: allocated.itemName || request.itemName || "—",
            itemCode: allocated.itemCode || "—",
            inventory: request.inventoryLocation || request.inventoryName || "—",
            issuedDate: request.issuedDate || "—",
            returnedDate: request.returnedDate || "—",
            status: request.approvalStatus || "approved",
            itemStatus: allocated.status || (request.approvalStatus === "returned" ? "Returned" : "in-use"),
            location: allocated.location || "—",
            remarks: allocated.remarks || "—",
            serialNo: allocated.serialNo || "—",
            model: allocated.model || "—",
            ginNo: allocated.ginNo || "—",
            quantity: request.quantity ?? "—",
            reason: request.reason || "",
            specification: request.specification || "",
            priority: request.priority || "normal",
            requestedDate: request.requestedDate || "",
            allocatedItemId: allocated.id ?? request.allocatedInventoryItemId ?? null,
            source: "request",
          };
        });

        const allocatedItemIds = new Set(
          requestEntries
            .map((entry) => Number(entry.allocatedItemId))
            .filter((id) => Number.isInteger(id) && id > 0)
        );

        const locationEntries = (locationItemsResponse.ok && locationItemsData.success
          ? locationItemsData.items || []
          : [])
          .filter((item) => !allocatedItemIds.has(Number(item.id)))
          .map((item) => ({
            id: `LOC-${item.id}`,
            rawId: item.id,
            requestedItem: item.itemName || item.name || "—",
            issuedItem: item.itemName || item.name || "—",
            itemCode: item.itemCode || "—",
            inventory: item.inventoryName || "—",
            issuedDate: item.updated_at || item.created_at || "—",
            returnedDate: "—",
            status: "approved",
            itemStatus: "issued",
            location: item.locationLabel || item.location || "—",
            remarks: item.remarks || "—",
            serialNo: item.serialNo || "—",
            model: item.model || "—",
            ginNo: item.ginNo || "—",
            quantity: "—",
            reason: "",
            specification: "",
            priority: "normal",
            requestedDate: "",
            allocatedItemId: item.id ?? null,
            source: "location",
          }));

        setIssuedItems([...requestEntries, ...locationEntries]);
      } catch (error) {
        if (isMounted) {
          setIssuedItems([]);
          setLoadError(error.message || "Failed to load your issued items.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadIssuedItems();

    return () => {
      isMounted = false;
    };
  }, []);

  const statusBadge = (statusKey) => {
    const config = ITEM_REQUEST_STATUS_META[statusKey] || {
      label: statusKey,
      variant: "secondary",
    };

    return <Badge label={config.label} variant={config.variant} size="sm" />;
  };

  const itemStatusBadge = (value, row) => {
    if (row?.statusLabel) {
      return <Badge label={row.statusLabel} variant="info" size="sm" />;
    }

    const statusObj = ITEM_STATUS.find((entry) => entry.value === value);
    return <Badge label={statusObj?.label || value || "-"} variant={statusObj?.color || "primary"} size="sm" />;
  };

  const columns = [
    { field: "id", label: "Request ID", sortable: true },
    { field: "requestedItem", label: "Requested Item", sortable: true },
    { field: "issuedItem", label: "Issued Item", sortable: true },
    { field: "itemCode", label: "Item Code", sortable: true },
    { field: "inventory", label: "Lab Inventory", sortable: true },
    { field: "issuedDate", label: "Issued Date", sortable: true },
    {
      field: "returnedDate",
      label: "Returned Date",
      sortable: true,
      render: (value) => value || "—",
    },
    {
      field: "itemStatus",
      label: "Item Status",
      render: (value, row) => itemStatusBadge(value, row),
    },
    {
      field: "status",
      label: "Request Status",
      render: (value) => statusBadge(value),
    },
  ];

  const filtered = issuedItems.filter((entry) =>
    `${entry.id} ${entry.requestedItem} ${entry.issuedItem} ${entry.itemCode} ${entry.inventory} ${entry.location}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const handleViewDetails = (entry) => {
    setSelectedItem(entry);
    setIsDetailModalOpen(true);
  };

  const handleCloseDetails = () => {
    setIsDetailModalOpen(false);
    setSelectedItem(null);
  };

  return (
    <MainLayout variant={sidebarVariant}>
      <PageHeader
        title="My Issued Items"
        subtitle="View inventory items issued to you from approved requests or direct assignment"
      />

      <div className="p-6 space-y-6">
        {loadError ? <p className="text-sm text-error">{loadError}</p> : null}

        <Card>
          <div className="mb-4">
            <SearchBox
              placeholder="Search by request ID, item, code, inventory, or location"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <Table
            columns={columns}
            data={filtered}
            onRowClick={handleViewDetails}
            loading={loading}
            paginated={filtered.length > 10}
            itemsPerPage={10}
          />
        </Card>
      </div>

      <EntityDetailsModal
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetails}
        title="Issued Item Details"
        selectedLabel="Request ID"
        selectedName={selectedItem?.id}
        details={
          selectedItem
            ? [
                { label: "Requested Item", value: selectedItem.requestedItem },
                { label: "Issued Item", value: selectedItem.issuedItem },
                { label: "Item Code", value: selectedItem.itemCode },
                { label: "Serial No.", value: selectedItem.serialNo },
                { label: "Model", value: selectedItem.model },
                { label: "GIN No.", value: selectedItem.ginNo },
                { label: "Lab Inventory", value: selectedItem.inventory },
                { label: "Quantity", value: selectedItem.quantity },
                { label: "Current Location", value: selectedItem.location },
                {
                  label: "Item Status",
                  value: selectedItem.location === "Stores"
                    ? "Returned"
                    : selectedItem.status === "approved"
                      ? "In Use"
                      : ITEM_REQUEST_STATUS_META[selectedItem.status]?.label || selectedItem.status,
                },
                {
                  label: "Request Status",
                  value: ITEM_REQUEST_STATUS_META[selectedItem.status]?.label || selectedItem.status,
                },
                { label: "Requested Date", value: selectedItem.requestedDate || "—" },
                { label: "Issued Date", value: selectedItem.issuedDate || "—" },
                { label: "Returned Date", value: selectedItem.returnedDate || "—" },
                { label: "Priority", value: selectedItem.priority },
                { label: "Reason", value: selectedItem.reason || "—", fullWidth: true },
                { label: "Specifications", value: selectedItem.specification || "—", fullWidth: true },
                { label: "Remarks", value: selectedItem.remarks || "—", fullWidth: true },
              ]
            : []
        }
      />
    </MainLayout>
  );
};

export default MyIssuedItems;
