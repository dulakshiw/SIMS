import React, { useState } from "react";
import MainLayout from "../../../Components/Layouts/MainLayout";
import { Card, Button, SearchBox, Table, Badge } from "../../../Components/UI";
import { DISPOSAL_STATUS } from "../../../utils/constants";

const DisposalList = () => {
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
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text-dark">Disposal Management</h1>
            <p className="text-text-light mt-2">Manage item disposals</p>
          </div>
          <Button icon="add_circle" variant="primary">
            Create Disposal
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card title="Total Disposals" icon="delete_sweep">
            <p className="text-3xl font-bold text-primary-800">15</p>
          </Card>
          <Card title="Pending" icon="schedule">
            <p className="text-3xl font-bold text-warning">3</p>
          </Card>
          <Card title="Approved" icon="check_circle">
            <p className="text-3xl font-bold text-success">8</p>
          </Card>
          <Card title="Completed" icon="done_all">
            <p className="text-3xl font-bold text-info">4</p>
          </Card>
        </div>

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
