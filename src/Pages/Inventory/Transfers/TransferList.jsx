import React, { useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import MainLayout from "../../../Components/Layouts/MainLayout";
import { Card, Button, SearchBox, Table, Badge, PageHeader, SummaryCard, SummaryCardsGrid } from "../../../Components/UI";
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

        <SummaryCardsGrid showTitle={false} columns="4-equal">
          <SummaryCard title="Total Transfers" count={45} description="All transfer requests recorded." icon="compare_arrows" hover={false} />
          <SummaryCard title="Pending" count={5} description="Transfers awaiting approval." icon="schedule" countClassName="text-warning" hover={false} />
          <SummaryCard title="In Transit" count={8} description="Transfers currently in progress." icon="local_shipping" countClassName="text-info" hover={false} />
          <SummaryCard title="Completed" count={32} description="Transfers successfully completed." icon="done_all" countClassName="text-success" hover={false} />
        </SummaryCardsGrid>

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
