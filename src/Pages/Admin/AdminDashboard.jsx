import React from 'react'
import AdminLayout from '../../Components/Layouts/AdminLayout'
import { Card } from '../../Components/UI'

const AdminDashboard = () => {
  const stats = [
    { title: "Total Users", value: "50", icon: "people", color: "primary-800" },
    { title: "Active Users", value: "40", icon: "check_circle", color: "success" },
    { title: "Inventories", value: "12", icon: "inventory_2", color: "info" },
    { title: "Pending Tasks", value: "8", icon: "task_alt", color: "warning" },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-text-dark">Admin Dashboard</h1>
          <p className="text-text-light mt-2">System overview and management</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <Card key={index} icon={stat.icon} hover={true}>
              <p className="text-sm text-text-light">{stat.title}</p>
              <p className={`text-3xl font-bold text-${stat.color} mt-2`}>{stat.value}</p>
            </Card>
          ))}
        </div>

        {/* Dashboard Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="System Summary" icon="dashboard">
            <div className="space-y-3 text-sm text-text-dark">
              <p>• Total registered users: 50</p>
              <p>• Active system inventories: 12</p>
              <p>• Total items managed: 425</p>
              <p>• Pending approvals: 8</p>
            </div>
          </Card>

          <Card title="Recent Activities" icon="history">
            <div className="space-y-2 text-sm">
              <p className="text-text-dark">New user registered - M.D.C.N. Abeynayake</p>
              <p className="text-text-dark">Inventory transfer completed</p>
              <p className="text-text-dark">Disposal request approved</p>
              <p className="text-text-dark">System maintenance completed</p>
            </div>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}

export default AdminDashboard