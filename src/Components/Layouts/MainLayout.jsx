import React, { useState } from "react";
import Header from "../Header";
import Sidebar from "./Sidebar";
import Footer from "../Footer";

const MainLayout = ({ children, variant = "inventory" }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-background-light">
      {/* Sidebar */}
      <Sidebar variant={variant} onCollapseChange={setSidebarCollapsed} />

      {/* Main Content */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarCollapsed ? "ml-20" : "ml-64"}`}>
        {/* Header */}
        <Header />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-6">
            {children}
          </div>
        </main>

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
};

export default MainLayout;
