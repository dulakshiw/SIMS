import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../../Components/Layouts/AdminLayout'
import { Card, PageHeader } from '../../Components/UI'
import RegistrarDashboard from './RegistrarDashboard'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

const getTimeOfDayGreeting = () => {
  const hour = new Date().getHours();

  if (hour < 12) {
    return 'Good morning';
  }

  if (hour < 18) {
    return 'Good afternoon';
  }

  return 'Good evening';
};

const getLastName = (fullName = 'User') => {
  const nameParts = String(fullName).trim().split(/\s+/).filter(Boolean);
  return nameParts[nameParts.length - 1] || 'User';
};

const formatActivityTime = (timestamp) => {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getActivityIcon = (category) => {
  switch (category) {
    case 'account_request':
    case 'user':
      return 'person_add';
    case 'inventory_request':
    case 'inventory':
      return 'inventory_2';
    case 'transfer':
      return 'swap_horiz';
    case 'disposal':
      return 'delete';
    default:
      return 'history';
  }
};

const AdminDashboardContent = () => {
  const navigate = useNavigate();
  const [lastName, setLastName] = useState('User');
  const [summary, setSummary] = useState({
    totalUsers: 0,
    activeUsers: 0,
    inventories: 0,
    pendingTasks: 0,
    totalItems: 0,
  });
  const [recentActivities, setRecentActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const storedUsername = localStorage.getItem('username') || 'User';
    setLastName(getLastName(storedUsername));

    let isMounted = true;

    const loadSummary = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await fetch(`${API_BASE_URL}/api/dashboard/summary`);
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to load dashboard summary.');
        }

        if (isMounted) {
          setSummary(data.adminSummary || {});
          setRecentActivities(data.recentActivities || []);
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

  const handleActivityClick = (activity) => {
    if (!activity?.link) return;

    navigate(
      activity.link,
      activity.tab ? { state: { activeTab: activity.tab } } : undefined
    );
  };

  const stats = [
    { title: "Total Users", value: summary.totalUsers ?? 0, colorClass: "text-primary-800", icon: "people", link: "/admin/users" },
    {
      title: "Active Users",
      value: summary.activeUsers ?? 0,
      colorClass: "text-success",
      icon: "check_circle",
      link: "/admin/users",
      state: { hideSummaryCards: true },
    },
    { title: "Inventories", value: summary.inventories ?? 0, colorClass: "text-info", icon: "inventory_2", link: "/admin/inventory" },
    { title: "Pending Tasks", value: summary.pendingTasks ?? 0, colorClass: "text-warning", icon: "task_alt", link: "/admin/pending-tasks" },
  ];

  return (
    <AdminLayout>
      <PageHeader
        title="Dashboard"
        subtitle="System overview and management"
      />
      <div className="p-6 space-y-6">
        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <Card
              key={index}
              icon={stat.icon}
              hover={true}
              onClick={() => navigate(stat.link, stat.state ? { state: stat.state } : undefined)}
              className="cursor-pointer"
            >
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
              {loading ? (
                <p className="text-text-light">Loading recent activities...</p>
              ) : recentActivities.length > 0 ? (
                recentActivities.map((activity) => {
                  const isClickable = Boolean(activity.link);

                  return (
                    <button
                      key={activity.id}
                      type="button"
                      onClick={() => handleActivityClick(activity)}
                      disabled={!isClickable}
                      className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                        isClickable
                          ? 'border-border-lighter bg-white hover:border-primary-300 hover:bg-primary-50 cursor-pointer'
                          : 'border-transparent bg-transparent cursor-default'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-base text-primary-700 mt-0.5">
                          {getActivityIcon(activity.category || activity.type)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-text-dark font-medium">{activity.message}</p>
                          {activity.timestamp && (
                            <p className="text-xs text-text-light mt-1">
                              {formatActivityTime(activity.timestamp)}
                            </p>
                          )}
                        </div>
                        {isClickable && (
                          <span className="material-symbols-outlined text-base text-text-light">
                            chevron_right
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              ) : (
                <p className="text-text-light">No recent activities yet.</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}

const AdminDashboard = () => {
  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();
  if (userRole === "registrar") {
    return <RegistrarDashboard />;
  }
  return <AdminDashboardContent />;
};

export default AdminDashboard;