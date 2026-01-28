import React, { useState } from "react";
import { ADMIN_NAV_ITEMS, INVENTORY_NAV_ITEMS, ROLES } from "../../utils/constants";
import { Link, useLocation } from "react-router-dom";

const Sidebar = ({ variant = "inventory", onCollapseChange }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();

  const handleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    if (onCollapseChange) {
      onCollapseChange(newState);
    }
  };

  const navItems = variant === "admin" ? ADMIN_NAV_ITEMS : INVENTORY_NAV_ITEMS;

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
