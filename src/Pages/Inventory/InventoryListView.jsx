import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import MainLayout from "../../Components/Layouts/MainLayout";
import { Card, Button, SearchBox, Table, Badge, PageHeader } from "../../Components/UI";
import { ITEM_STATUS } from "../../utils/constants";
import { resolveSidebarVariant } from "../../utils/helpers";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const InventoryListView = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [inventories, setInventories] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useParams();
  const sidebarVariant = resolveSidebarVariant(location.pathname, role);
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("currentUser") || "{}");
    } catch {
      return {};
    }
  }, []);
  const params = new URLSearchParams(location.search);
  const selectedInventoryId = Number(params.get("inventoryId") ?? 0);
  const isInchargeView = role === "incharge" || currentUser.role === "inventory_incharge";

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        setError("");

        if (isInchargeView) {
          const inventoriesResponse = await fetch(`${API_BASE_URL}/api/inventories`);
          const inventoriesData = await inventoriesResponse.json();

          if (!inventoriesResponse.ok || !inventoriesData.success) {
            throw new Error(inventoriesData.error || inventoriesData.message || "Failed to load assigned inventories.");
          }

          if (!isMounted) {
            return;
          }

          const assignedInventories = (inventoriesData.inventories || []).filter(
            (inventory) => String(inventory.inchargeId) === String(currentUser.id)
          );
          setInventories(assignedInventories);

          if (selectedInventoryId > 0) {
            const itemsResponse = await fetch(`${API_BASE_URL}/api/items?inventoryId=${selectedInventoryId}`);
            const itemsData = await itemsResponse.json();

            if (!itemsResponse.ok || !itemsData.success) {
              throw new Error(itemsData.error || itemsData.message || "Failed to load inventory items.");
            }

            if (isMounted) {
              setItems(itemsData.items || []);
            }
          } else if (isMounted) {
            setItems([]);
          }

          return;
        }

        setInventories([]);
        setItems([
          {
            id: 1,
            itemName: "Laptop Dell XPS 13",
            itemCode: "LAP-001",
            status: "available",
            location: "Room 101",
            updated_at: "2024-01-15",
          },
          {
            id: 2,
            itemName: "Office Chair",
            itemCode: "CHR-002",
            status: "in-use",
            location: "Room 102",
            updated_at: "2024-01-10",
          },
          {
            id: 3,
            itemName: "Printer HP M433",
            itemCode: "PRN-003",
            status: "maintenance",
            location: "Storage",
            updated_at: "2024-01-12",
          },
        ]);
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message || "Failed to load inventory data.");
          setInventories([]);
          setItems([]);
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
  }, [API_BASE_URL, currentUser.id, isInchargeView, selectedInventoryId]);

  const itemColumns = [
    { field: "name", label: "Item Name", sortable: true },
    { field: "itemCode", label: "Item Code", sortable: true },
    {
      field: "status",
      label: "Status",
      render: (value) => {
        const statusObj = ITEM_STATUS.find((s) => s.value === value);
        return <Badge label={statusObj?.label || value} variant={statusObj?.color || "primary"} />;
      },
    },
    { field: "location", label: "Location", sortable: true },
    { field: "lastUpdated", label: "Last Updated", sortable: true },
  ];

  const inventoryColumns = [
    { field: "name", label: "Inventory Name", sortable: true },
    { field: "location", label: "Location", sortable: true },
    { field: "department", label: "Department", sortable: true },
    { field: "itemCount", label: "Items", sortable: true },
    {
      field: "status",
      label: "Status",
      render: (value) => (
        <Badge
          label={String(value || "active").charAt(0).toUpperCase() + String(value || "active").slice(1)}
          variant={value === "active" ? "success" : "warning"}
        />
      ),
    },
  ];

  const selectedInventory = inventories.find((inventory) => inventory.id === selectedInventoryId) || null;

  const filteredInventories = inventories.filter((inventory) =>
    `${inventory.name} ${inventory.location} ${inventory.department}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const normalizedItems = items.map((item) => ({
    ...item,
    name: item.itemName || item.name || "-",
    lastUpdated: item.updated_at
      ? new Date(item.updated_at).toISOString().split("T")[0]
      : item.lastUpdated || "-",
  }));

  const filteredItems = normalizedItems.filter((item) =>
    `${item.name} ${item.itemCode || ""} ${item.location || ""} ${item.status || ""}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const itemActions = [
    { label: "View", icon: "visibility", onClick: (row) => navigate(`/inventory/item/${row.id}/${role || sidebarVariant}`) },
  ];

  const inventoryActions = [
    {
      label: "Open Items",
      icon: "inventory_2",
      onClick: (row) => navigate(`/inventory/list/incharge?inventoryId=${row.id}`),
    },
    {
      label: "Add Item",
      icon: "add_circle",
      onClick: (row) => navigate(`/inventory/add/incharge?inventoryId=${row.id}`),
    },
  ];

  const stats = isInchargeView && !selectedInventory
    ? {
        inventories: filteredInventories.length,
        items: filteredInventories.reduce((sum, inventory) => sum + Number(inventory.itemCount || 0), 0),
      }
    : {
        items: filteredItems.length,
        available: filteredItems.filter((item) => item.status === "available").length,
        inUse: filteredItems.filter((item) => item.status === "in-use").length,
        maintenance: filteredItems.filter((item) => item.status === "maintenance").length,
      };

  return (
    <MainLayout variant={sidebarVariant}>
      <PageHeader
        title={isInchargeView && !selectedInventory ? "My Inventories" : selectedInventory ? `${selectedInventory.name} Items` : "Inventory Items"}
        subtitle={
          isInchargeView && !selectedInventory
            ? "Handle each assigned inventory separately from one account."
            : selectedInventory
              ? `Manage items for ${selectedInventory.name} at ${selectedInventory.location || "your assigned location"}.`
              : "Manage your inventory items"
        }
        actions={
          isInchargeView && !selectedInventory ? null : (
            <Button
              icon="add_circle"
              variant="primary"
              onClick={() => navigate(selectedInventory ? `/inventory/add/${role || sidebarVariant}?inventoryId=${selectedInventory.id}` : `/inventory/add/${role || sidebarVariant}`)}
            >
              Add New Item
            </Button>
          )
        }
      />

      <div className="p-6 space-y-6">
        {error && (
          <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {selectedInventory && (
          <Button variant="secondary" onClick={() => navigate('/inventory/list/incharge')}>
            Back To My Inventories
          </Button>
        )}

        <div className="flex gap-4">
          <div className="flex-1">
            <SearchBox
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search items..."
            />
          </div>
        </div>

        {isInchargeView && !selectedInventory ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card title="Assigned Inventories" icon="inventory_2">
              <p className="text-3xl font-bold text-primary-800">{loading ? '...' : stats.inventories}</p>
            </Card>
            <Card title="Total Items Across Inventories" icon="category">
              <p className="text-3xl font-bold text-info">{loading ? '...' : stats.items}</p>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card title="Total Items" icon="inventory_2">
              <p className="text-3xl font-bold text-primary-800">{loading ? '...' : stats.items}</p>
            </Card>
            <Card title="Available" icon="check_circle">
              <p className="text-3xl font-bold text-success">{loading ? '...' : stats.available}</p>
            </Card>
            <Card title="In Use" icon="assignment">
              <p className="text-3xl font-bold text-info">{loading ? '...' : stats.inUse}</p>
            </Card>
            <Card title="Maintenance" icon="build">
              <p className="text-3xl font-bold text-warning">{loading ? '...' : stats.maintenance}</p>
            </Card>
          </div>
        )}

        <Card>
          <Table
            columns={isInchargeView && !selectedInventory ? inventoryColumns : itemColumns}
            data={isInchargeView && !selectedInventory ? filteredInventories : filteredItems}
            actions={isInchargeView && !selectedInventory ? inventoryActions : itemActions}
            searchable={true}
            paginated={true}
          />
        </Card>
      </div>
    </MainLayout>
  );
};

export default InventoryListView;
