import React, { useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import MainLayout from "../../Components/Layouts/MainLayout";
import { Card, Button, Badge, Tabs } from "../../Components/UI";
import { resolveSidebarVariant } from "../../utils/helpers";

const ItemRequest = () => {
  const location = useLocation();
  const { role } = useParams();
  const sidebarVariant = resolveSidebarVariant(location.pathname, role);
  const [selectedRequest, setSelectedRequest] = useState(0);

  const requests = [
    {
      id: "REQ-001",
      item: "Monitors",
      requester: "John Doe",
      status: "pending",
      priority: "urgent",
      date: "2024-01-15",
      quantity: 5,
      budget: 2500,
    },
    {
      id: "REQ-002",
      item: "Office Supplies",
      requester: "Jane Smith",
      status: "approved",
      priority: "normal",
      date: "2024-01-10",
      quantity: 10,
      budget: 500,
    },
  ];

  const currentRequest = requests[selectedRequest];

  const tabs = [
    {
      label: "Details",
      icon: "description",
      content: (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-text-light">Request ID</p>
              <p className="text-lg font-semibold text-text-dark mt-1">{currentRequest.id}</p>
            </div>
            <div>
              <p className="text-sm text-text-light">Item Requested</p>
              <p className="text-lg font-semibold text-text-dark mt-1">{currentRequest.item}</p>
            </div>
            <div>
              <p className="text-sm text-text-light">Requester</p>
              <p className="text-lg font-semibold text-text-dark mt-1">{currentRequest.requester}</p>
            </div>
            <div>
              <p className="text-sm text-text-light">Quantity</p>
              <p className="text-lg font-semibold text-text-dark mt-1">{currentRequest.quantity}</p>
            </div>
            <div>
              <p className="text-sm text-text-light">Estimated Budget</p>
              <p className="text-lg font-semibold text-text-dark mt-1">${currentRequest.budget}</p>
            </div>
            <div>
              <p className="text-sm text-text-light">Request Date</p>
              <p className="text-lg font-semibold text-text-dark mt-1">{currentRequest.date}</p>
            </div>
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
              <p className="text-sm text-text-light">Awaiting approval</p>
            </div>
            <Badge label="Pending" variant="warning" />
          </div>
          <div className="flex items-center justify-between p-4 border border-border-lighter rounded-lg">
            <div>
              <p className="font-semibold text-text-dark">Finance Team</p>
              <p className="text-sm text-text-light">Budget review</p>
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
          <div className="flex gap-4 pb-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary-800">add</span>
              </div>
            </div>
            <div>
              <p className="font-medium text-text-dark">Request Created</p>
              <p className="text-sm text-text-light">2024-01-15 10:30 AM by {currentRequest.requester}</p>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <MainLayout variant={sidebarVariant}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Requests List */}
        <div className="lg:col-span-1">
          <Card title="Requests" icon="request_quote">
            <div className="space-y-2">
              {requests.map((req, index) => (
                <button
                  key={req.id}
                  onClick={() => setSelectedRequest(index)}
                  className={`w-full text-left p-3 rounded-md transition-colors ${
                    selectedRequest === index
                      ? "bg-primary-50 border-l-4 border-primary-800"
                      : "border-l-4 border-transparent hover:bg-background-light"
                  }`}
                >
                  <p className="font-semibold text-text-dark">{req.item}</p>
                  <p className="text-sm text-text-light">by {req.requester}</p>
                  <Badge label={req.priority} variant={req.priority} size="sm" className="mt-2" />
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Request Details */}
        <div className="lg:col-span-2">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-text-dark">{currentRequest.item}</h1>
                <p className="text-text-light mt-1">#{currentRequest.id}</p>
              </div>
              <Badge label={currentRequest.status.toUpperCase()} variant={currentRequest.status} size="lg" />
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <Button variant="primary" icon="check_circle">
                Approve
              </Button>
              <Button variant="danger" icon="close">
                Reject
              </Button>
              <Button variant="secondary" icon="more_horiz">
                More Actions
              </Button>
            </div>

            {/* Tabs */}
            <Card>
              <Tabs tabs={tabs} />
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default ItemRequest;
