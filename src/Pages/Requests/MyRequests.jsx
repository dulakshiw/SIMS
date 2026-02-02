import React, { useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import MainLayout from "../../Components/Layouts/MainLayout";
import { Card, SearchBox, Table, Badge } from "../../Components/UI";
import { resolveSidebarVariant } from "../../utils/helpers";

const MyRequests = () => {
  const location = useLocation();
  const { role } = useParams();
  const sidebarVariant = resolveSidebarVariant(location.pathname, role);
  const [searchTerm, setSearchTerm] = useState("");

  // Mock data for current user's requests
  const myRequests = [
    {
      id: "REQ-1001",
      item: "Projector",
      priority: "urgent",
      status: "pending",
      date: "2024-01-20",
    },
    {
      id: "REQ-1002",
      item: "Whiteboard",
      priority: "normal",
      status: "approved",
      date: "2024-01-18",
    },
    {
      id: "REQ-1003",
      item: "HDMI Cables",
      priority: "low",
      status: "completed",
      date: "2024-01-10",
    },
  ];

  const columns = [
    { field: "id", label: "Request ID", sortable: true },
    { field: "item", label: "Item Requested", sortable: true },
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
    { field: "date", label: "Date", sortable: true },
  ];

  const filtered = myRequests.filter((r) =>
    `${r.id} ${r.item} ${r.status}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <MainLayout variant={sidebarVariant}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-text-dark">My Requests</h1>
          <p className="text-text-light mt-2">Track your item requests and their approval status</p>
        </div>

        <Card>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <SearchBox
              placeholder="Search by ID, item, or status"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <Table columns={columns} data={filtered} />
        </Card>
      </div>
    </MainLayout>
  );
};

export default MyRequests;
