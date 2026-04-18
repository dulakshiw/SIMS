import React, { useState } from "react";
import Header from "../Header";
import Sidebar from "./Sidebar";
import Footer from "../Footer";

const AdminLayout = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-background-light">
      {/* Sidebar */}
      <Sidebar variant="admin" onCollapseChange={setSidebarCollapsed} />

      {/* Main Content */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarCollapsed ? "ml-20" : "ml-64"}`}>
        {/* Header */}
        <Header />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl p-6">
            {children}
          </div>
        </main>

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
};

export default AdminLayout;
