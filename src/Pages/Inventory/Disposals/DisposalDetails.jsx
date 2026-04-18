import React from "react";
import { useLocation, useParams } from "react-router-dom";
import MainLayout from "../../../Components/Layouts/MainLayout";
import { Card, Button, Badge, Tabs, PageHeader } from "../../../Components/UI";
import { resolveSidebarVariant } from "../../../utils/helpers";

const DisposalDetails = () => {
  const location = useLocation();
  const { role } = useParams();
  const sidebarVariant = resolveSidebarVariant(location.pathname, role);
  const disposal = {
    id: "DSL-001",
    itemName: "Old Laptop",
    category: "Electronics",
    reason: "Obsolete",
    status: "pending",
    originalValue: 1200,
    salvageValue: 200,
    condition: "Poor",
    description: "Non-functional laptop, used for 8 years",
    submittedBy: "John Doe",
    submittedDate: "2024-01-15",
    attachments: 2,
  };

  const tabs = [
    {
      label: "Details",
      icon: "description",
      content: (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-text-light">Item Name</p>
              <p className="text-lg font-semibold text-text-dark mt-1">{disposal.itemName}</p>
            </div>
            <div>
              <p className="text-sm text-text-light">Category</p>
              <p className="text-lg font-semibold text-text-dark mt-1">{disposal.category}</p>
            </div>
            <div>
              <p className="text-sm text-text-light">Reason</p>
              <p className="text-lg font-semibold text-text-dark mt-1">{disposal.reason}</p>
            </div>
            <div>
              <p className="text-sm text-text-light">Condition</p>
              <p className="text-lg font-semibold text-text-dark mt-1">{disposal.condition}</p>
            </div>
            <div>
              <p className="text-sm text-text-light">Original Value</p>
              <p className="text-lg font-semibold text-text-dark mt-1">${disposal.originalValue}</p>
            </div>
            <div>
              <p className="text-sm text-text-light">Salvage Value</p>
              <p className="text-lg font-semibold text-text-dark mt-1">${disposal.salvageValue}</p>
            </div>
          </div>
          <div>
            <p className="text-sm text-text-light">Description</p>
            <p className="text-base text-text-dark mt-2">{disposal.description}</p>
          </div>
        </div>
      ),
    },
    {
      label: "Approvals",
      icon: "check_circle",
      content: (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-border-lighter rounded-lg">
            <div>
              <p className="font-semibold text-text-dark">Department Manager</p>
              <p className="text-sm text-text-light">Pending approval</p>
            </div>
            <Badge label="Pending" variant="warning" />
          </div>
          <div className="flex items-center justify-between p-4 border border-border-lighter rounded-lg">
            <div>
              <p className="font-semibold text-text-dark">Finance Team</p>
              <p className="text-sm text-text-light">Awaiting review</p>
            </div>
            <Badge label="Pending" variant="warning" />
          </div>
        </div>
      ),
    },
    {
      label: "History",
      icon: "history",
      content: (
        <div className="space-y-3">
          <div className="flex gap-4 pb-4 border-b border-border-lighter last:border-0">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary-800">add</span>
              </div>
            </div>
            <div>
              <p className="font-medium text-text-dark">Created</p>
              <p className="text-sm text-text-light">2024-01-15 by {disposal.submittedBy}</p>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <MainLayout variant={sidebarVariant}>
      <PageHeader
        title={disposal.itemName}
        subtitle={`Disposal Request #${disposal.id}`}
        actions={<Badge label={disposal.status.toUpperCase()} variant={disposal.status} size="lg" />}
      />

      <div className="p-6 space-y-6">

        {/* Actions */}
        <div className="flex gap-4">
          <Button variant="primary">Approve</Button>
          <Button variant="danger">Reject</Button>
          <Button variant="secondary">Download Report</Button>
        </div>

        {/* Details Tabs */}
        <Card>
          <Tabs tabs={tabs} />
        </Card>
      </div>
    </MainLayout>
  );
};

export default DisposalDetails;
