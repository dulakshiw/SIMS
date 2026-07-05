import { useState, useEffect } from "react";
import NotificationBell from "./NotificationBell";
import "../Styles/Header.css";

function Header() {
  const [username, setUsername] = useState("User");

  useEffect(() => {
    // Get username from localStorage or auth context
    const storedUsername = localStorage.getItem("username") || "User";
    setUsername(storedUsername);
  }, []);

  return (
    <div className="header">
      <div className="header-left">
        <h3 className="header-title">Inventory Management System - Faculty of Information Technology</h3>
      </div>
      <div className="header-right">
        <NotificationBell />
        <span className="header-greeting">Hi, {username}</span>
      </div>
    </div>
  );
}

export default Header;
