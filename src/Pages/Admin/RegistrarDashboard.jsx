import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../../Components/Layouts/AdminLayout";
import { Badge, Card, PageHeader, SummaryCard, SummaryCardsGrid } from "../../Components/UI";

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

  const summaryCards = [
    {
      title: "Pending Tasks",
      count: summary.totalPending ?? 0,
      description: "All approval tasks requiring action.",
      icon: "pending_actions",
      countClassName: "text-error",
      onClick: () => navigate("/admin/pending-tasks"),
    },
    {
      title: "Inventories",
      count: summary.pendingInventory ?? 0,
      description: "New inventories awaiting your approval.",
      icon: "inventory_2",
      onClick: () => handleOpenApprovals("inventory-requests"),
    },
    {
      title: "Approval History",
      count: (summary.approvedCount ?? 0) + (summary.rejectedCount ?? 0),
      description: "Recently approved and rejected processes.",
      icon: "history",
      countClassName: "text-info",
      onClick: () => {},
      hover: false,
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

        <SummaryCardsGrid title="Registrar Summary" columns={3}>
          {summaryCards.map((card) => (
            <SummaryCard
              key={card.title}
              title={card.title}
              count={card.count}
              description={card.description}
              icon={card.icon}
              loading={loading}
              countClassName={card.countClassName}
              onClick={card.onClick}
              hover={card.hover}
            />
          ))}
        </SummaryCardsGrid>

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
