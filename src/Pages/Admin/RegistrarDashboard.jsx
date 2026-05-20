import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../../Components/Layouts/AdminLayout";
import { Badge, Card, PageHeader } from "../../Components/UI";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-LK", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getHistoryIcon = (type) => {
  switch (type) {
    case "inventory_creation":
      return "inventory_2";
    case "transfer":
      return "compare_arrows";
    case "disposal":
      return "delete_sweep";
    default:
      return "history";
  }
};

const RegistrarDashboard = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState({
    pendingInventory: 0,
    pendingTransfers: 0,
    pendingDisposals: 0,
    totalPending: 0,
    approvedCount: 0,
    rejectedCount: 0,
  });
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      try {
        setLoading(true);
        setError("");
        const response = await fetch(`${API_BASE_URL}/api/registrar/dashboard?limit=50`);
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || data.error || "Failed to load registrar dashboard.");
        }

        if (!isMounted) return;

        setSummary(data.summary || {});
        setHistory(data.history || []);
      } catch (fetchError) {
        if (!isMounted) return;
        setError(fetchError.message || "Unable to load dashboard.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadDashboard();
    const intervalId = window.setInterval(loadDashboard, 30000);
    const handleFocus = () => loadDashboard();
    window.addEventListener("focus", handleFocus);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const pendingCards = [
    {
      title: "Inventory Creation",
      value: summary.pendingInventory ?? 0,
      colorClass: "text-primary-800",
      icon: "inventory_2",
      tab: "inventory-requests",
    },
    {
      title: "Item Transfers",
      value: summary.pendingTransfers ?? 0,
      colorClass: "text-info",
      icon: "compare_arrows",
      tab: "transfer-requests",
    },
    {
      title: "Item Disposals",
      value: summary.pendingDisposals ?? 0,
      colorClass: "text-warning",
      icon: "delete_sweep",
      tab: "disposal-requests",
    },
    {
      title: "Total Pending",
      value: summary.totalPending ?? 0,
      colorClass: "text-error",
      icon: "pending_actions",
      tab: "inventory-requests",
    },
  ];

  const handleOpenApprovals = (tab) => {
    navigate("/admin/pending-tasks", { state: { activeTab: tab } });
  };

  return (
    <AdminLayout>
      <PageHeader title="Dashboard" subtitle="Registrar approvals overview and processing history" />

      <div className="p-6 space-y-6">
        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        <div>
          <h2 className="text-lg font-semibold text-text-dark mb-3">Pending Approvals</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {pendingCards.map((card) => (
              <Card
                key={card.title}
                icon={card.icon}
                hover
                onClick={() => handleOpenApprovals(card.tab)}
                className="cursor-pointer"
              >
                <p className="text-sm text-text-light">{card.title}</p>
                <p className={`text-3xl font-bold mt-2 ${card.colorClass}`}>
                  {loading ? "..." : card.value}
                </p>
              </Card>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card title="Approved (recent)" icon="check_circle">
            <p className="text-3xl font-bold text-success">
              {loading ? "..." : summary.approvedCount ?? 0}
            </p>
            <p className="text-sm text-text-light mt-2">Shown in history below</p>
          </Card>
          <Card title="Rejected (recent)" icon="cancel">
            <p className="text-3xl font-bold text-error">
              {loading ? "..." : summary.rejectedCount ?? 0}
            </p>
            <p className="text-sm text-text-light mt-2">Shown in history below</p>
          </Card>
        </div>

        <Card title="Approval History" icon="history">
          <div className="space-y-2">
            {loading ? (
              <p className="text-sm text-text-light">Loading history...</p>
            ) : history.length === 0 ? (
              <p className="text-sm text-text-light">No approved or rejected processes yet.</p>
            ) : (
              history.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => entry.tab && handleOpenApprovals(entry.tab)}
                  className="w-full text-left rounded-lg border border-border-lighter px-4 py-3 hover:border-primary-300 hover:bg-primary-50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-primary-700 mt-0.5">
                      {getHistoryIcon(entry.type)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-text-dark">{entry.title}</p>
                        <Badge label={entry.typeLabel} variant="info" size="sm" />
                        <Badge
                          label={entry.actionLabel}
                          variant={entry.action === "approved" ? "success" : "error"}
                          size="sm"
                        />
                      </div>
                      <p className="text-sm text-text-light mt-1">{entry.department}</p>
                      {entry.note ? (
                        <p className="text-xs text-text-light mt-1 whitespace-pre-wrap">{entry.note}</p>
                      ) : null}
                      <p className="text-xs text-text-light mt-2">{formatDateTime(entry.processedAt)}</p>
                    </div>
                    <span className="material-symbols-outlined text-text-light">chevron_right</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default RegistrarDashboard;
