import React, { useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import MainLayout from "../../../Components/Layouts/MainLayout";
import { Card, Button, SearchBox, Table, Badge, PageHeader } from "../../../Components/UI";
import { REQUEST_PRIORITY } from "../../../utils/constants";
import { resolveSidebarVariant } from "../../../utils/helpers";

const RequestList = () => {
  const location = useLocation();
  const { role } = useParams();
  const sidebarVariant = resolveSidebarVariant(location.pathname, role);
  const [searchTerm, setSearchTerm] = useState("");

  const mockRequests = [
    {
      id: "REQ-001",
      item: "New Monitors",
      requester: "John Doe",
      priority: "urgent",
      status: "pending",
      date: "2024-01-15",
    },
    {
      id: "REQ-002",
      item: "Office Supplies",
      requester: "Jane Smith",
      priority: "normal",
      status: "approved",
      date: "2024-01-10",
    },
    {
      id: "REQ-003",
      item: "Server RAM",
      requester: "Bob Wilson",
      priority: "low",
      status: "completed",
      date: "2024-01-05",
    },
  ];

  const columns = [
    { field: "id", label: "ID", sortable: true },
    { field: "item", label: "Item Requested", sortable: true },
    { field: "requester", label: "Requester", sortable: true },
    {
      field: "priority",
      label: "Priority",
      render: (value) => (
        <Badge
          label={value.charAt(0).toUpperCase() + value.slice(1)}
          variant={value}
          size="sm"
        />
      ),
    },
    {
      field: "status",
      label: "Status",
      render: (value) => (
        <Badge
          label={value.charAt(0).toUpperCase() + value.slice(1)}
          variant={value === "approved" ? "success" : value === "pending" ? "warning" : "info"}
          size="sm"
        />
      ),
    },
  ];

  const actions = [
    { label: "View", icon: "visibility", onClick: (row) => console.log("View", row) },
    { label: "Approve", icon: "check_circle", onClick: (row) => console.log("Approve", row) },
  ];

  return (
    <MainLayout variant={sidebarVariant}>
      <PageHeader
        title="Item Requests"
        subtitle="Manage item requests"
        actions={
          <Button icon="add_circle" variant="primary">
            Create Request
          </Button>
        }
      />

      <div className="p-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card title="Total Requests" icon="request_quote">
            <p className="text-3xl font-bold text-primary-800">28</p>
          </Card>
          <Card title="Pending" icon="schedule">
            <p className="text-3xl font-bold text-warning">8</p>
          </Card>
          <Card title="Approved" icon="check_circle">
            <p className="text-3xl font-bold text-success">15</p>
          </Card>
          <Card title="Completed" icon="done_all">
            <p className="text-3xl font-bold text-info">5</p>
          </Card>
        </div>

        {/* Search */}
        <SearchBox value={searchTerm} onChange={setSearchTerm} placeholder="Search requests..." />

        {/* Table */}
        <Card>
          <Table columns={columns} data={mockRequests} actions={actions} />
        </Card>
      </div>
    </MainLayout>
  );
};

export default RequestList;
