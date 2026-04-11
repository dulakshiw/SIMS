import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../../Components/Layouts/AdminLayout'
import { Card } from '../../Components/UI'

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState({
    totalUsers: 0,
    activeUsers: 0,
    inventories: 0,
    pendingTasks: 0,
    totalItems: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadSummary = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await fetch('/api/dashboard/summary');
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to load dashboard summary.');
        }

        if (isMounted) {
          setSummary(data.adminSummary || {});
        }
      } catch (fetchError) {
        console.error('Failed to load admin dashboard summary:', fetchError);
        if (isMounted) {
          setError(fetchError.message || 'Unable to load dashboard summary.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadSummary();
    return () => {
      isMounted = false;
    };
  }, []);

  const stats = [
    { title: "Total Users", value: summary.totalUsers ?? 0, colorClass: "text-primary-800", icon: "people", link: "/admin/users" },
    { title: "Active Users", value: summary.activeUsers ?? 0, colorClass: "text-success", icon: "check_circle", link: "/admin/users" },
    { title: "Inventories", value: summary.inventories ?? 0, colorClass: "text-info", icon: "inventory_2", link: "/admin/inventory" },
    { title: "Pending Tasks", value: summary.pendingTasks ?? 0, colorClass: "text-warning", icon: "task_alt", link: "/admin/pending-tasks" },
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
        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <Card key={index} icon={stat.icon} hover={true} onClick={() => navigate(stat.link)} className="cursor-pointer">
              <p className="text-sm text-text-light">{stat.title}</p>
              <p className={`text-3xl font-bold mt-2 ${stat.colorClass}`}>
                {loading ? '...' : stat.value}
              </p>
            </Card>
          ))}
        </div>

        {/* Dashboard Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="System Summary" icon="dashboard">
            <div className="space-y-3 text-sm text-text-dark">
              <p>• Total registered users: {loading ? '...' : summary.totalUsers ?? 0}</p>
              <p>• Active system inventories: {loading ? '...' : summary.inventories ?? 0}</p>
              <p>• Total items managed: {loading ? '...' : summary.totalItems ?? 0}</p>
              <p>• Pending approvals: {loading ? '...' : summary.pendingTasks ?? 0}</p>
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