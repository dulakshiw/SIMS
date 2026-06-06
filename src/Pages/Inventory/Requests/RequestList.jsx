import React, { useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import MainLayout from "../../../Components/Layouts/MainLayout";
import { Card, SearchBox, Table, Badge, PageHeader } from "../../../Components/UI";
import { resolveSidebarVariant } from "../../../utils/helpers";
import HodStaffItemRequests from "./HodStaffItemRequests";
import InchargeStaffItemRequests from "./InchargeStaffItemRequests";

const RequestList = () => {
  const location = useLocation();
  const { role } = useParams();
  const sidebarVariant = resolveSidebarVariant(location.pathname, role);
  const [searchTerm, setSearchTerm] = useState("");

  const normalizedRole = String(role || "").toLowerCase();

  if (normalizedRole === "hod") {
    return <HodStaffItemRequests />;
  }

  if (normalizedRole === "incharge") {
    return <InchargeStaffItemRequests />;
  }

  const requestList = [];

  const columns = [
    { field: "id", label: "ID", sortable: true },
    { field: "item", label: "Item Requested", sortable: true },
    { field: "requester", label: "Requested by", sortable: true },
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

  return (
    <MainLayout variant={sidebarVariant}>
      <PageHeader
        title="Item Requests"
        subtitle="Manage item requests"
      />

      <div className="p-6 space-y-6">
        <SearchBox value={searchTerm} onChange={setSearchTerm} placeholder="Search requests..." />

        <Card>
          <Table columns={columns} data={requestList} />
        </Card>
      </div>
    </MainLayout>
  );
};

export default RequestList;
