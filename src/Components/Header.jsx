import { useState, useEffect } from "react";
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
        <h3 className="header-title">Inventory Management System</h3>
      </div>
      <div className="header-right">
        <span className="header-greeting">Hello, {username}</span>
      </div>
    </div>
  );
}

export default Header;
