import React from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../../Components/Layouts/AdminLayout'
import { Card } from '../../Components/UI'

const AdminDashboard = () => {
  const navigate = useNavigate();

  const stats = [
    { title: "Total Users", value: "50", icon: "people", color: "primary-800", link: "/admin/users" },
    { title: "Active Users", value: "40", icon: "check_circle", color: "success", link: "/admin/users" },
    { title: "Inventories", value: "12", icon: "inventory_2", color: "info", link: "/admin/inventory" },
    { title: "Pending Tasks", value: "8", icon: "task_alt", color: "warning", link: "/admin/pending-tasks" },
  ];

  return (
    <AdminLayout>
      <div className="gradient-primary py-6 rounded-t">
        <div className="max-w-7xl mx-auto px-6">
          <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-sm text-primary-50 mt-1">System overview and management</p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <Card key={index} icon={stat.icon} hover={true} onClick={() => navigate(stat.link)} className="cursor-pointer">
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
              <p className="text-text-dark">New Inventory Created - CL3/PIB 01</p>
              <p className="text-text-dark">Disposal process completed - CL2/PIB 01</p>
              <p className="text-text-dark">Item transfer process completed - CL1/PIB 01 to CL2/PIB 01

              </p>
            </div>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}

export default AdminDashboard