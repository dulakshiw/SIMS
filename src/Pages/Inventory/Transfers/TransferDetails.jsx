import React from "react";
import MainLayout from "../../../Components/Layouts/MainLayout";
import { Card, Button, Badge, Tabs } from "../../../Components/UI";

const TransferDetails = () => {
  const transfer = {
    id: "TRF-001",
    item: "Laptop Dell XPS",
    from: "Room 101",
    to: "Room 202",
    status: "pending",
    date: "2024-01-15",
    approvedBy: "Admin",
    gatePass: "GP-001",
  };

  const tabs = [
    {
      label: "Details",
      icon: "description",
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-text-light">Item Name</p>
            <p className="text-lg font-semibold text-text-dark mt-1">{transfer.item}</p>
          </div>
          <div>
            <p className="text-sm text-text-light">Transfer ID</p>
            <p className="text-lg font-semibold text-text-dark mt-1">{transfer.id}</p>
          </div>
          <div>
            <p className="text-sm text-text-light">From Location</p>
            <p className="text-lg font-semibold text-text-dark mt-1">{transfer.from}</p>
          </div>
          <div>
            <p className="text-sm text-text-light">To Location</p>
            <p className="text-lg font-semibold text-text-dark mt-1">{transfer.to}</p>
          </div>
          <div>
            <p className="text-sm text-text-light">Transfer Date</p>
            <p className="text-lg font-semibold text-text-dark mt-1">{transfer.date}</p>
          </div>
          <div>
            <p className="text-sm text-text-light">Gate Pass</p>
            <p className="text-lg font-semibold text-text-dark mt-1">{transfer.gatePass}</p>
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
              <p className="font-semibold text-text-dark">Department Head</p>
              <p className="text-sm text-text-light">Approved</p>
            </div>
            <Badge label="Approved" variant="success" />
          </div>
        </div>
      ),
    },
    {
      label: "Tracking",
      icon: "location_on",
      content: (
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-success flex items-center justify-center text-white">
                <span className="material-symbols-outlined">check</span>
              </div>
            </div>
            <div>
              <p className="font-medium text-text-dark">Picked up from {transfer.from}</p>
              <p className="text-sm text-text-light">2024-01-15 09:30 AM</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-warning flex items-center justify-center text-white">
                <span className="material-symbols-outlined">schedule</span>
              </div>
            </div>
            <div>
              <p className="font-medium text-text-dark">In transit to {transfer.to}</p>
              <p className="text-sm text-text-light">Pending arrival</p>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text-dark">{transfer.item}</h1>
            <p className="text-text-light mt-2">Transfer Request #{transfer.id}</p>
          </div>
          <Badge label={transfer.status.toUpperCase()} variant={transfer.status} size="lg" />
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <Button variant="primary" icon="download">
            Download Gate Pass
          </Button>
          <Button variant="secondary" icon="print">
            Print
          </Button>
        </div>

        {/* Tabs */}
        <Card>
          <Tabs tabs={tabs} />
        </Card>
      </div>
    </MainLayout>
  );
};

export default TransferDetails;
