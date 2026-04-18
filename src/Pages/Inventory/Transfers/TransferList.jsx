import React, { useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import MainLayout from "../../../Components/Layouts/MainLayout";
import { Card, Button, SearchBox, Table, Badge, PageHeader } from "../../../Components/UI";
import { resolveSidebarVariant } from "../../../utils/helpers";
import { TRANSFER_STATUS } from "../../../utils/constants";

const TransferList = () => {
  const location = useLocation();
  const { role } = useParams();
  const sidebarVariant = resolveSidebarVariant(location.pathname, role);
  const [searchTerm, setSearchTerm] = useState("");

  const mockTransfers = [
    {
      id: "TRF-001",
      item: "Laptop Dell XPS",
      from: "Room 101",
      to: "Room 202",
      status: "pending",
      date: "2024-01-15",
    },
    {
      id: "TRF-002",
      item: "Office Chair",
      from: "Department A",
      to: "Department B",
      status: "in-transit",
      date: "2024-01-10",
    },
    {
      id: "TRF-003",
      item: "Printer HP M433",
      from: "Storage",
      to: "Room 103",
      status: "completed",
      date: "2024-01-05",
    },
  ];

  const columns = [
    { field: "id", label: "ID", sortable: true },
    { field: "item", label: "Item", sortable: true },
    { field: "from", label: "From Location" },
    { field: "to", label: "To Location" },
    {
      field: "status",
      label: "Status",
      render: (value) => (
        <Badge
          label={value.charAt(0).toUpperCase() + value.slice(1)}
          variant={value}
          size="sm"
        />
      ),
    },
    { field: "date", label: "Date" },
  ];

  const actions = [
    { label: "View", icon: "visibility", onClick: (row) => console.log("View", row) },
    { label: "Track", icon: "location_on", onClick: (row) => console.log("Track", row) },
  ];

  return (
    <MainLayout variant={sidebarVariant}>
      <PageHeader
        title="Item Transfers"
        subtitle="Manage item transfers between locations"
        actions={
          <Button icon="add_circle" variant="primary">
            Create Transfer
          </Button>
        }
      />

      <div className="p-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card title="Total Transfers" icon="compare_arrows">
            <p className="text-3xl font-bold text-primary-800">45</p>
          </Card>
          <Card title="Pending" icon="schedule">
            <p className="text-3xl font-bold text-warning">5</p>
          </Card>
          <Card title="In Transit" icon="local_shipping">
            <p className="text-3xl font-bold text-info">8</p>
          </Card>
          <Card title="Completed" icon="done_all">
            <p className="text-3xl font-bold text-success">32</p>
          </Card>
        </div>

        {/* Search */}
        <SearchBox value={searchTerm} onChange={setSearchTerm} placeholder="Search transfers..." />

        {/* Table */}
        <Card>
          <Table columns={columns} data={mockTransfers} actions={actions} />
        </Card>
      </div>
    </MainLayout>
  );
};

export default TransferList;
