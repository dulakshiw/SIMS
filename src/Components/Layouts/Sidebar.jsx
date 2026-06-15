import React, { useEffect, useMemo, useState } from "react";
import {
  ADMIN_NAV_ITEMS,
  DEAN_NAV_ITEMS,
  HOD_NAV_ITEMS,
  INVENTORY_NAV_ITEMS,
  REGISTRAR_NAV_ITEMS,
  STAFF_NAV_ITEMS,
} from "../../utils/constants";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { logoutUser } from "../../utils/helpers";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("currentUser") || "{}");
  } catch {
    return {};
  }
};

const normalizeDesignation = (designation = "") => String(designation).trim().toLowerCase();

const isStaffInventoryCreator = (designation = "") => {
  const normalizedDesignation = normalizeDesignation(designation);
  return normalizedDesignation === "technical officer" || normalizedDesignation === "management assistant";
};

const buildStaffNavItems = (currentUser) => {
  const hasAssignedInventories = Number(currentUser.assignedInventoryCount ?? 0) > 0;
  const canCreateInventoryRequests = isStaffInventoryCreator(currentUser.designation);

  const items = [
    { id: "staff-dashboard", type: "item", label: "Dashboard", path: "/staff/dashboard", icon: "dashboard" },
    { id: "staff-item-requests", type: "section", label: "Item Requests", icon: "receipt_long" },
    { id: "staff-request-items", type: "item", label: "Request Items", path: "/inventory/requests/new/staff", icon: "add_circle", nested: true },
    { id: "staff-my-requests", type: "item", label: "My Requests", path: "/requests/my/staff", icon: "fact_check", nested: true },
    { id: "staff-my-issued-items", type: "item", label: "My Issued Items", path: "/inventory/list/staff", icon: "inventory_2", nested: true },
  ];

  if (canCreateInventoryRequests) {
    items.push(
      {
        id: "staff-inventory-request",
        type: "item",
        label: "New Inventory Creation",
        path: "/requests/inventory/staff",
        icon: "playlist_add",
      }
    );
  }

  if (hasAssignedInventories || canCreateInventoryRequests) {
    items.push({ id: "staff-inventories", type: "section", label: "Inventories", icon: "inventory_2" });
    items.push({
      id: "staff-my-inventories",
      type: "item",
      label: "My Inventories",
      path: "/inventory/list/incharge",
      icon: "inventory",
      nested: true,
    });
  }

  if (hasAssignedInventories) {
    items.push(
      { id: "staff-add-item", type: "item", label: "Add New Item", path: "/inventory/add/incharge", icon: "playlist_add", nested: true },
      { id: "staff-transfers", type: "item", label: "Transfers", path: "/inventory/transfers/list/incharge", icon: "compare_arrows", nested: true },
      { id: "staff-disposals", type: "item", label: "Disposals", path: "/inventory/disposals/list/incharge", icon: "delete_sweep", nested: true },
      { id: "staff-warranty-claims", type: "item", label: "Warranty Claims", path: "/inventory/repairs/warranty-claims/list/incharge", icon: "verified_user", nested: true },
      { id: "staff-repairs", type: "item", label: "Repairs", path: "/inventory/repairs/list/incharge", icon: "handyman", nested: true },
      { id: "staff-inventory-requests", type: "item", label: "Inventory Requests", path: "/inventory/requests/list/incharge", icon: "request_quote", nested: true },
      { id: "staff-reports", type: "item", label: "Reports", path: "/inventory/reports/incharge", icon: "assessment", nested: true }
    );
  }

  items.push({ id: "staff-profile", type: "item", label: "Profile", path: "/profile/staff", icon: "person" });

  return items;
};

const Sidebar = ({ variant = "inventory", onCollapseChange }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState({});
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

  const handleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    if (onCollapseChange) {
      onCollapseChange(newState);
    }
  };

  const userRole = String(currentUser?.role || localStorage.getItem("userRole") || "")
    .trim()
    .toLowerCase();

  const navItemsByVariant = {
    admin: userRole === "registrar" ? REGISTRAR_NAV_ITEMS : ADMIN_NAV_ITEMS,
    registrar: REGISTRAR_NAV_ITEMS,
    inventory: INVENTORY_NAV_ITEMS,
    staff: buildStaffNavItems(currentUser),
    hod: HOD_NAV_ITEMS,
    dean: DEAN_NAV_ITEMS,
  };

  const navItems =
    userRole === "registrar"
      ? REGISTRAR_NAV_ITEMS
      : navItemsByVariant[variant] || INVENTORY_NAV_ITEMS;
  const currentPath = `${location.pathname}${location.search || ""}`;

  const menuEntries = useMemo(() => {
    const entries = [];
    let activeMenu = null;

    navItems.forEach((item) => {
      if (item.type === "section") {
        activeMenu = {
          id: item.id,
          label: item.label,
          icon: item.icon,
          type: "menu",
          children: [],
        };
        entries.push(activeMenu);
        return;
      }

      if (item.nested && activeMenu) {
        activeMenu.children.push(item);
        return;
      }

      activeMenu = null;
      entries.push({ ...item, type: "item" });
    });

    return entries;
  }, [navItems]);

  useEffect(() => {
    setOpenMenus((prev) => {
      const nextState = { ...prev };
      let didChange = false;

      menuEntries.forEach((entry) => {
        if (entry.type !== "menu") {
          return;
        }

        const hasActiveChild = entry.children.some((child) => {
          const pathMatches = currentPath === child.path || location.pathname === child.path;
          if (!pathMatches) return false;
          if (child.activeTab) {
            return (location.state?.activeTab || "inventory-requests") === child.activeTab;
          }
          return true;
        });

        if (hasActiveChild && !nextState[entry.id]) {
          nextState[entry.id] = true;
          didChange = true;
        }

        if (nextState[entry.id] === undefined) {
          nextState[entry.id] = hasActiveChild;
          didChange = true;
        }
      });

      return didChange ? nextState : prev;
    });
  }, [currentPath, location.pathname, menuEntries]);

  const toggleMenu = (menuId) => {
    setOpenMenus((prev) => ({
      ...prev,
      [menuId]: !prev[menuId],
    }));
  };

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
        flex flex-col
        ${isCollapsed ? "w-20" : "w-64"}
      `}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between p-4 h-16 border-b border-primary-700">
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

      {/* Navigation — scrolls independently so expanded menus don't cover the footer */}
      <nav className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
        {menuEntries.map((entry) => {
          if (entry.type === "menu" && !isCollapsed) {
            const isOpen = Boolean(openMenus[entry.id]);
            const hasActiveChild = entry.children.some((child) => {
              const pathMatches = currentPath === child.path || location.pathname === child.path;
              if (!pathMatches) return false;
              if (child.activeTab) {
                return (location.state?.activeTab || "inventory-requests") === child.activeTab;
              }
              return true;
            });

            return (
              <div key={entry.id} className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleMenu(entry.id)}
                  className={`
                    flex items-center gap-3 w-full px-4 py-3 rounded-md transition-colors text-left
                    ${hasActiveChild ? "bg-primary-700 text-white" : "text-primary-100 hover:bg-primary-700"}
                  `}
                >
                  {entry.icon && (
                    <span className="material-symbols-outlined flex-shrink-0">{entry.icon}</span>
                  )}
                  <span className="text-sm font-medium flex-1">{entry.label}</span>
                  <span className="material-symbols-outlined text-base flex-shrink-0">
                    {isOpen ? "expand_less" : "expand_more"}
                  </span>
                </button>

                {isOpen && (
                  <div className="space-y-1">
                    {entry.children.map((item) => {
                      const pathMatches = currentPath === item.path || location.pathname === item.path;
                      const tabMatches = item.activeTab
                        ? (location.state?.activeTab || "inventory-requests") === item.activeTab
                        : true;
                      const isActive = pathMatches && tabMatches;

                      return (
                        <Link
                          key={item.id}
                          to={item.path}
                          state={item.activeTab ? { activeTab: item.activeTab } : undefined}
                          className={`
                            flex items-center gap-4 px-4 py-2.5 ml-3 rounded-md transition-colors
                            ${isActive ? "bg-primary-700 text-white" : "text-primary-100 hover:bg-primary-700"}
                          `}
                        >
                          <span className="material-symbols-outlined flex-shrink-0">{item.icon}</span>
                          <span className="text-sm font-medium">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          if (entry.type === "menu" && isCollapsed) {
            return entry.children.map((item) => {
              const pathMatches = currentPath === item.path || location.pathname === item.path;
              const tabMatches = item.activeTab
                ? (location.state?.activeTab || "inventory-requests") === item.activeTab
                : true;
              const isActive = pathMatches && tabMatches;

              return (
                <Link
                  key={item.id}
                  to={item.path}
                  state={item.activeTab ? { activeTab: item.activeTab } : undefined}
                  className={`
                    flex items-center gap-4 px-4 py-3 rounded-md transition-colors
                    ${isActive ? "bg-primary-700 text-white" : "text-primary-100 hover:bg-primary-700"}
                  `}
                  title={item.label}
                >
                  <span className="material-symbols-outlined flex-shrink-0">{item.icon}</span>
                </Link>
              );
            });
          }

          const isActive = currentPath === entry.path || location.pathname === entry.path;

          return (
            <Link
              key={entry.id}
              to={entry.path}
              className={`
                flex items-center gap-4 px-4 py-3 rounded-md transition-colors
                ${isActive ? "bg-primary-700 text-white" : "text-primary-100 hover:bg-primary-700"}
              `}
              title={isCollapsed ? entry.label : ""}
            >
              <span className="material-symbols-outlined flex-shrink-0">{entry.icon}</span>
              {!isCollapsed && <span className="text-sm font-medium">{entry.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer — pinned below scrollable nav */}
      <div className="shrink-0 p-4 border-t border-primary-700 bg-primary-800">
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
