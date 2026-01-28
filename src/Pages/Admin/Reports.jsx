import React from "react";
import AdminLayout from "../../Components/Layouts/AdminLayout";
import { Card, Button } from "../../Components/UI";

const Reports = () => {
  const mockStats = [
    { title: "Total Assets", value: "425", icon: "inventory_2", color: "primary-800" },
    { title: "Pending Requests", value: "12", icon: "request_quote", color: "warning" },
    { title: "Transfers", value: "28", icon: "compare_arrows", color: "info" },
    { title: "Disposals", value: "8", icon: "delete_sweep", color: "error" },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text-dark">Reports & Analytics</h1>
            <p className="text-text-light mt-2">System analytics and performance metrics</p>
          </div>
          <Button icon="download" variant="primary">
            Export Report
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {mockStats.map((stat, index) => (
            <Card key={index} icon={stat.icon}>
              <p className="text-sm text-text-light">{stat.title}</p>
              <p className={`text-3xl font-bold text-${stat.color} mt-2`}>{stat.value}</p>
            </Card>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Asset Distribution">
            <div className="h-64 flex items-center justify-center bg-background-light rounded-lg">
              <p className="text-text-light">Asset distribution chart</p>
            </div>
          </Card>
          <Card title="Request Trends">
            <div className="h-64 flex items-center justify-center bg-background-light rounded-lg">
              <p className="text-text-light">Request trends chart</p>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Monthly Transfers">
            <div className="h-64 flex items-center justify-center bg-background-light rounded-lg">
              <p className="text-text-light">Monthly transfers chart</p>
            </div>
          </Card>
          <Card title="User Activity">
            <div className="h-64 flex items-center justify-center bg-background-light rounded-lg">
              <p className="text-text-light">User activity chart</p>
            </div>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Reports;
