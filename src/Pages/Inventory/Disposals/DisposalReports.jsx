import React from "react";
import { useLocation, useParams } from "react-router-dom";
import MainLayout from "../../../Components/Layouts/MainLayout";
import { Card, Button, PageHeader, SummaryCard, SummaryCardsGrid } from "../../../Components/UI";
import { resolveSidebarVariant } from "../../../utils/helpers";

const DisposalReports = () => {
  const location = useLocation();
  const { role } = useParams();
  const sidebarVariant = resolveSidebarVariant(location.pathname, role);
  const mockStats = [
    { title: "Total Disposals", count: "45", description: "All disposal records.", icon: "delete_sweep" },
    { title: "Total Value", count: "$15,200", description: "Combined value of disposals.", icon: "paid", countClassName: "text-success" },
    { title: "Pending", count: "8", description: "Disposals awaiting completion.", icon: "schedule", countClassName: "text-warning" },
    { title: "Completed", count: "32", description: "Disposals fully processed.", icon: "done_all", countClassName: "text-info" },
  ];

  return (
    <MainLayout variant={sidebarVariant}>
      <PageHeader
        title="Disposal Reports"
        subtitle="Analytics and reports on item disposals"
        actions={
          <Button icon="download" variant="primary">
            Export Report
          </Button>
        }
      />

      <div className="p-6 space-y-6">

        <SummaryCardsGrid showTitle={false} columns="4-lg">
          {mockStats.map((stat) => (
            <SummaryCard
              key={stat.title}
              title={stat.title}
              count={stat.count}
              description={stat.description}
              icon={stat.icon}
              countClassName={stat.countClassName}
              hover={false}
            />
          ))}
        </SummaryCardsGrid>

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
