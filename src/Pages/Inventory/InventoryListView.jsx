import React, { useState } from "react";
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import MainLayout from "../../Components/Layouts/MainLayout";
import { Card, Button, SearchBox, Table, Badge } from "../../Components/UI";
import { ITEM_STATUS } from "../../utils/constants";
import { resolveSidebarVariant } from "../../utils/helpers";

const InventoryListView = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useParams();
  const sidebarVariant = resolveSidebarVariant(location.pathname, role);

  // Mock data
  const mockItems = [
    {
      id: 1,
      name: "Laptop Dell XPS 13",
      category: "Electronics",
      status: "available",
      location: "Room 101",
      lastUpdated: "2024-01-15",
    },
    {
      id: 2,
      name: "Office Chair",
      category: "Furniture",
      status: "in-use",
      location: "Room 102",
      lastUpdated: "2024-01-10",
    },
    {
      id: 3,
      name: "Printer HP M433",
      category: "Equipment",
      status: "maintenance",
      location: "Storage",
      lastUpdated: "2024-01-12",
    },
  ];

  const columns = [
    { field: "name", label: "Item Name", sortable: true },
    { field: "category", label: "Category", sortable: true },
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

  const actions = [
    { label: "View", icon: "visibility", onClick: (row) => navigate(`/inventory/item/${row.id}`) },
    { label: "Edit", icon: "edit", onClick: (row) => console.log("Edit", row) },
    { label: "Delete", icon: "delete", onClick: (row) => console.log("Delete", row) },
  ];

  return (
    <MainLayout variant={sidebarVariant}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text-dark">Inventory Items</h1>
            <p className="text-text-light mt-2">Manage your inventory items</p>
          </div>
          <Button icon="add_circle" variant="primary">
            Add New Item
          </Button>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-4">
          <div className="flex-1">
            <SearchBox
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search items..."
            />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <Card title="Total Items" icon="inventory_2">
            <p className="text-3xl font-bold text-primary-800">42</p>
          </Card>
          <Card title="Available" icon="check_circle">
            <p className="text-3xl font-bold text-success">28</p>
          </Card>
          <Card title="In Use" icon="assignment">
            <p className="text-3xl font-bold text-info">10</p>
          </Card>
          <Card title="Maintenance" icon="build">
            <p className="text-3xl font-bold text-warning">4</p>
          </Card>
        </div>

        {/* Items Table */}
        <Card>
          <Table
            columns={columns}
            data={mockItems}
            actions={actions}
            searchable={true}
            paginated={true}
          />
        </Card>
      </div>
    </MainLayout>
  );
};

export default InventoryListView;
