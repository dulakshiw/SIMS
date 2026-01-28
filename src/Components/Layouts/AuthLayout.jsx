import React from "react";

const AuthLayout = ({ children }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-800 to-primary-900 p-4">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-700 rounded-full opacity-20"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary-700 rounded-full opacity-20"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white rounded-xl shadow-2xl overflow-hidden">
          {/* Branding */}
          <div className="bg-gradient-to-r from-primary-800 to-primary-700 px-8 py-8 text-center">
            <h1 className="text-3xl font-bold text-white mb-2">SIMS</h1>
            <p className="text-primary-100">Smart Inventory Management System</p>
          </div>

          {/* Form */}
          <div className="p-8">
            {children}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-primary-100 text-sm mt-6">
          © 2024 Smart Inventory Management System. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default AuthLayout;
