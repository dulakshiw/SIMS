import React, { useEffect, useMemo, useState } from "react";
import {
  ADMIN_NAV_ITEMS,
  DEAN_NAV_ITEMS,
  HOD_NAV_ITEMS,
  INVENTORY_NAV_ITEMS,
  STAFF_INCHARGE_NAV_ITEMS,
  STAFF_NAV_ITEMS,
} from "../../utils/constants";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { logoutUser } from "../../utils/helpers";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("currentUser") || "{}");
  } catch {
    return {};
  }
};

const Sidebar = ({ variant = "inventory", onCollapseChange }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(getStoredUser);

  useEffect(() => {
    let isMounted = true;
    const storedUser = getStoredUser();

    setCurrentUser(storedUser);

    if (!storedUser?.email && !storedUser?.id) {
      return undefined;
    }

    const searchParams = new URLSearchParams();

    if (storedUser.email) {
      searchParams.set("email", storedUser.email);
    } else if (storedUser.id) {
      searchParams.set("userId", storedUser.id);
    }

    const loadEffectiveProfile = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/profile?${searchParams.toString()}`);
        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success || !isMounted) {
          return;
        }

        const profile = data.profile || {};
        const nextRole = profile.role || storedUser.role || localStorage.getItem("userRole") || "staff";
        const nextUser = { ...storedUser, ...profile, role: nextRole };

        localStorage.setItem("currentUser", JSON.stringify(nextUser));
        localStorage.setItem("userRole", nextRole);
        window.currentUser = nextUser;
        setCurrentUser(nextUser);
      } catch {
        // Keep rendering from the locally stored user if the refresh fails.
      }
    };

    loadEffectiveProfile();

    return () => {
      isMounted = false;
    };
  }, [location.pathname]);

  const effectiveRole = useMemo(() => {
    if (currentUser.role) {
      return currentUser.role;
    }

    if (Number(currentUser.assignedInventoryCount ?? 0) > 0) {
      return "inventory_incharge";
    }

    return localStorage.getItem("userRole") || "staff";
  }, [currentUser.assignedInventoryCount, currentUser.role]);

  const effectiveVariant = variant === "staff" && effectiveRole === "inventory_incharge"
    ? "staff-incharge"
    : variant;

  const handleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    if (onCollapseChange) {
      onCollapseChange(newState);
    }
  };

  const navItemsByVariant = {
    admin: ADMIN_NAV_ITEMS,
    inventory: INVENTORY_NAV_ITEMS,
    staff: STAFF_NAV_ITEMS,
    "staff-incharge": STAFF_INCHARGE_NAV_ITEMS,
    hod: HOD_NAV_ITEMS,
    dean: DEAN_NAV_ITEMS,
  };

  const navItems = navItemsByVariant[effectiveVariant] || INVENTORY_NAV_ITEMS;

  const handleLogout = () => {
    const shouldLogout = window.confirm("Are you sure you want to log out?");
    if (!shouldLogout) {
      return;
    }

    logoutUser();
    window.alert("You have been logged out successfully.");
    navigate("/", { replace: true });
  };

  return (
    <aside
      className={`
        fixed left-0 top-0 h-screen bg-primary-800 text-white transition-all duration-300 z-40
        ${isCollapsed ? "w-20" : "w-64"}
        overflow-y-auto
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 h-16 border-b border-primary-700">
        {!isCollapsed && <h1 className="text-lg font-bold">SIMS</h1>}
        <button
          onClick={handleCollapse}
          className="text-white hover:bg-primary-700 rounded-md p-2 transition-colors"
        >
          <span className="material-symbols-outlined">
            {isCollapsed ? "chevron_right" : "chevron_left"}
          </span>
        </button>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.id}
              to={item.path}
              className={`
                flex items-center gap-4 px-4 py-3 rounded-md transition-colors
                ${
                  isActive
                    ? "bg-primary-700 text-white"
                    : "text-primary-100 hover:bg-primary-700"
                }
              `}
              title={isCollapsed ? item.label : ""}
            >
              <span className="material-symbols-outlined flex-shrink-0">
                {item.icon}
              </span>
              {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-primary-700">
        <button
          type="button"
          onClick={handleLogout}
          className={`
            flex items-center gap-4 px-4 py-3 rounded-md w-full
            text-primary-100 hover:bg-primary-700 transition-colors
          `}
        >
          <span className="material-symbols-outlined flex-shrink-0">logout</span>
          {!isCollapsed && <span className="text-sm font-medium">Logout</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
