import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import "../../Styles/AdminSidebar.css";

const AdminSidebar = () => {
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [UserOpen, setUserOpen] = useState(false);
  const [DeptOpen, setDeptOpen] = useState(false);

  return (
    <div className="sidebar">
      <NavLink to="/admin/dashboard" className="menu-item">Dashboard </NavLink>
      
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
       <NavLink to="/admin/reports" className="menu-item">Reports </NavLink>
       <NavLink to="/admin/reports" className="menu-item">Profile </NavLink>
      <NavLink to="/logout" className="menu-item logout"> Logout</NavLink>
     
    </div>
  );
};

export default AdminSidebar;
