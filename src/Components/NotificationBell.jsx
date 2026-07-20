import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const POLL_INTERVAL_MS = 60_000;

const getStoredUserId = () => {
  try {
    const user = JSON.parse(localStorage.getItem("currentUser") || "{}");
    return Number(user.id ?? user.user_id ?? user.userId ?? 0);
  } catch {
    return 0;
  }
};

const formatNotificationTime = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getNotificationIcon = (type = "") => {
  if (type.startsWith("warranty_")) {
    return "event_busy";
  }
  if (type === "item_request_received") {
    return "receipt_long";
  }
  if (type.startsWith("approval_")) {
    return "task_alt";
  }
  return "notifications";
};

function NotificationBell() {
  const navigate = useNavigate();
  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState("");

  const userId = getStoredUserId();

  const fetchNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications?userId=${userId}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Unable to load notifications.");
      }

      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      setUnreadCount(Number(data.unreadCount ?? 0));
    } catch (fetchError) {
      setError(fetchError.message || "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchNotifications();
    const intervalId = window.setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAsRead = async (notificationId) => {
    if (!userId || !notificationId) {
      return;
    }

    await fetch(`${API_BASE_URL}/api/notifications/${notificationId}/read`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });

    setNotifications((prev) =>
      prev.map((entry) => (entry.id === notificationId ? { ...entry, isRead: true } : entry))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    if (!userId) {
      return;
    }

    await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });

    setNotifications((prev) => prev.map((entry) => ({ ...entry, isRead: true })));
    setUnreadCount(0);
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }

    setOpen(false);

    if (notification.link) {
      navigate(notification.link);
    }
  };

  if (!userId) {
    return null;
  }

  return (
    <div className="notification-bell" ref={panelRef}>
      <button
        type="button"
        className="notification-bell-button"
        aria-label="Notifications"
        onClick={() => {
          setOpen((prev) => !prev);
          if (!open) {
            fetchNotifications();
          }
        }}
      >
        <span className="material-symbols-outlined">notifications</span>
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notification-panel">
          <div className="notification-panel-header">
            <h4>Notifications</h4>
            {unreadCount > 0 && (
              <button type="button" className="notification-mark-all" onClick={markAllAsRead}>
                Mark all read
              </button>
            )}
          </div>

          <div className="notification-panel-body">
            {loading && notifications.length === 0 && (
              <p className="notification-empty">Loading notifications...</p>
            )}

            {!loading && error && (
              <p className="notification-error">{error}</p>
            )}

            {!loading && !error && notifications.length === 0 && (
              <p className="notification-empty">No notifications yet.</p>
            )}

            {!error &&
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  className={`notification-item ${notification.isRead ? "is-read" : "is-unread"}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <span className="material-symbols-outlined notification-item-icon">
                    {getNotificationIcon(notification.type)}
                  </span>
                  <span className="notification-item-content">
                    <span className="notification-item-title">{notification.title}</span>
                    <span className="notification-item-message">{notification.message}</span>
                    <span className="notification-item-time">
                      {formatNotificationTime(notification.createdAt)}
                    </span>
                  </span>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
