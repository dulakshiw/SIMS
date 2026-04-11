import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import "../../Styles/InchargeSidebar.css";
import { logoutUser } from "../../utils/helpers";

const InchargeSidebar = () => {
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [UserOpen, setUserOpen] = useState(false);
  const [DeptOpen, setDeptOpen] = useState(false);
  const navigate = useNavigate();

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
    <div className="sidebar">
      <NavLink to="/incharge/dashboard" className="menu-item">Dashboard </NavLink>
      
      <div className="menu-item" onClick={() => setInventoryOpen(!inventoryOpen)}>
        Inventories
        <span className="arrow">{inventoryOpen ? "▼" : "▶"}</span>
      </div>
      {inventoryOpen && (
        <div className="submenu">
          <NavLink to="/inventory/add" className="submenu-item">Add Inventory </NavLink>
          <NavLink to="/inventory/view" className="submenu-item">View Inventories</NavLink>
        </div>
      )}

      <div className="menu-item" onClick={() => setUserOpen(!UserOpen)}>
        Users
        <span className="arrow">{UserOpen ? "▼" : "▶"}</span>
      </div>
      {UserOpen && (
        <div className="submenu">
          <NavLink to="/user/add" className="submenu-item">Add User </NavLink>
          <NavLink to="/user/view" className="submenu-item">View Users</NavLink>
        </div>
      )}
     
     <div className="menu-item" onClick={() => setDeptOpen(!DeptOpen)}>
        Departments
        <span className="arrow">{DeptOpen ? "▼" : "▶"}</span>
      </div>
      {DeptOpen && (
        <div className="submenu">
          <NavLink to="/dept/add" className="submenu-item">Add Department </NavLink>
          <NavLink to="/dept/view" className="submenu-item">View Departments</NavLink>
        </div>
      )}
       <NavLink to="/incharge/reports" className="menu-item">Reports </NavLink>
      <button type="button" onClick={handleLogout} className="menu-item logout">Logout</button>
     
    </div>
  );
};

export default InchargeSidebar;
