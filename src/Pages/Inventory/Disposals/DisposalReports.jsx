import React from "react";
import MainLayout from "../../../Components/Layouts/MainLayout";
import { Card, Button } from "../../../Components/UI";

const DisposalReports = () => {
  const mockStats = [
    { title: "Total Disposals", value: "45", icon: "delete_sweep", color: "primary-800" },
    { title: "Total Value", value: "$15,200", icon: "paid", color: "success" },
    { title: "Pending", value: "8", icon: "schedule", color: "warning" },
    { title: "Completed", value: "32", icon: "done_all", color: "info" },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text-dark">Disposal Reports</h1>
            <p className="text-text-light mt-2">Analytics and reports on item disposals</p>
          </div>
          <Button icon="download" variant="primary">
            Export Report
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {mockStats.map((stat, index) => (
            <Card key={index} icon={stat.icon}>
              <p className="text-sm text-text-light">{stat.title}</p>
              <p className={`text-3xl font-bold text-${stat.color} mt-2`}>{stat.value}</p>
            </Card>
          ))}
        </div>

        {/* Charts Placeholder */}
        <Card title="Disposal Trends">
          <div className="h-64 flex items-center justify-center bg-background-light rounded-lg">
            <p className="text-text-light">Chart visualization area</p>
          </div>
        </Card>

        {/* Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="By Reason">
            <div className="h-64 flex items-center justify-center bg-background-light rounded-lg">
              <p className="text-text-light">Category breakdown chart</p>
            </div>
          </Card>
          <Card title="By Status">
            <div className="h-64 flex items-center justify-center bg-background-light rounded-lg">
              <p className="text-text-light">Status distribution chart</p>
            </div>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
};

export default DisposalReports;
