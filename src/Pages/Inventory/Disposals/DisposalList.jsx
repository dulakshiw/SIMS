import React, { useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import MainLayout from "../../../Components/Layouts/MainLayout";
import { Card, Button, SearchBox, Table, Badge, PageHeader, SummaryCard, SummaryCardsGrid } from "../../../Components/UI";
import { DISPOSAL_STATUS } from "../../../utils/constants";
import { resolveSidebarVariant } from "../../../utils/helpers";

const DisposalList = () => {
  const location = useLocation();
  const { role } = useParams();
  const sidebarVariant = resolveSidebarVariant(location.pathname, role);
  const [searchTerm, setSearchTerm] = useState("");

  const mockDisposals = [
    {
      id: 1,
      itemName: "Old Laptop",
      reason: "Obsolete",
      status: "pending",
      date: "2024-01-15",
      value: "$500",
    },
    {
      id: 2,
      itemName: "Broken Printer",
      reason: "Damage",
      status: "approved",
      date: "2024-01-10",
      value: "$300",
    },
    {
      id: 3,
      itemName: "Lost Monitor",
      reason: "Lost",
      status: "completed",
      date: "2024-01-05",
      value: "$200",
    },
  ];

  const columns = [
    { field: "itemName", label: "Item Name", sortable: true },
    { field: "reason", label: "Reason", sortable: true },
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
    { field: "date", label: "Date", sortable: true },
    { field: "value", label: "Item Value" },
  ];

  const actions = [
    { label: "View", icon: "visibility", onClick: (row) => console.log("View", row) },
    { label: "Edit", icon: "edit", onClick: (row) => console.log("Edit", row) },
  ];

  return (
    <MainLayout variant={sidebarVariant}>
      <PageHeader
        title="Disposal Management"
        subtitle="Manage item disposals"
        actions={
          <Button icon="add_circle" variant="primary">
            Create Disposal
          </Button>
        }
      />

      <div className="p-6 space-y-6">

        <SummaryCardsGrid showTitle={false} columns="4-equal">
          <SummaryCard title="Total Disposals" count={15} description="All disposal requests recorded." icon="delete_sweep" hover={false} />
          <SummaryCard title="Pending" count={3} description="Disposals awaiting approval." icon="schedule" countClassName="text-warning" hover={false} />
          <SummaryCard title="Approved" count={8} description="Disposals approved for processing." icon="check_circle" countClassName="text-success" hover={false} />
          <SummaryCard title="Completed" count={4} description="Disposals fully processed." icon="done_all" countClassName="text-info" hover={false} />
        </SummaryCardsGrid>

        {/* Search */}
        <SearchBox value={searchTerm} onChange={setSearchTerm} placeholder="Search disposals..." />

        {/* Table */}
        <Card>
          <Table columns={columns} data={mockDisposals} actions={actions} />
        </Card>
      </div>
    </MainLayout>
  );
};

export default DisposalList;
