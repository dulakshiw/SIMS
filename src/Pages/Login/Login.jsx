import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, Button } from "../../Components/UI";
import fitLogo from "../../assets/fit logo.png";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const DASHBOARD_BY_ROLE = {
  admin: "/admin/dashboard",
  registrar: "/admin/pending-tasks",
  staff: "/staff/dashboard",
  inventory_incharge: "/incharge/dashboard",
  head_of_department: "/hod/dashboard",
  dean: "/dean/dashboard",
};

const getDashboardPath = (role) => DASHBOARD_BY_ROLE[role] || "/";

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  useEffect(() => {
    const storedUser = localStorage.getItem("currentUser");
    if (!storedUser) {
      return;
    }

    try {
      window.currentUser = JSON.parse(storedUser);
    } catch {
      localStorage.removeItem("currentUser");
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.email.trim(),
          password: formData.password,
        }),
      });

      const responseText = await response.text();
      let data = {};

      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch {
          throw new Error("The login service returned an invalid response. Please make sure the API server is running.");
        }
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || "Login failed.");
      }

      const user = data.user;
      localStorage.setItem("username", user.name);
      localStorage.setItem("userRole", user.role);
      localStorage.setItem("currentUser", JSON.stringify(user));
      window.currentUser = user;

      setMessage(data.message || "Login successful! Redirecting...");
      setMessageType("success");

      setTimeout(() => {
        navigate(getDashboardPath(user.role), { replace: true });
      }, 600);
    } catch (error) {
      localStorage.removeItem("currentUser");
      localStorage.removeItem("username");
      localStorage.removeItem("userRole");

      const fallbackMessage = error?.message?.includes("Failed to fetch")
        ? "Unable to reach the login service. Please start the API server and try again."
        : error.message || "Unable to sign in right now.";

      setMessage(fallbackMessage);
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundImage: 'linear-gradient(rgba(0,0,0,0.5),rgba(0,0,0,0.5)), url(/src/assets/loginbg1.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      <div className="max-w-md w-full">
        <Card className="shadow-2xl">
          <div className="space-y-6">
            {/* Header */}
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center gap-3">
                <h1 className="text-2xl font-bold text-text-dark sm:text-3xl">Inventory Management System</h1>
              </div>
              <p className="mx-auto max-w-sm text-sm text-text-light">
                Sign in with a user account stored in the SIMS database.
              </p>
            </div>

            {/* Message Alert */}
            {message && (
              <div
                className={`p-3 rounded-lg text-sm text-center ${
                  messageType === "success"
                    ? "bg-success-50 text-success-700 border border-success-200"
                    : "bg-red-50 text-red-700 border border-red-300 border-l-4 border-l-red-600 font-bold"
                }`}
              >
                {message}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-text-dark">
                  Email Address 
                </label>
                <input
                  type="email"
                  name="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  style={{ backgroundColor: '#F2F0F0' }}
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-text-dark">
                  Password 
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    style={{ backgroundColor: '#F2F0F0' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-light hover:text-text-dark"
                  >
                    {showPassword ? "👁️" : "👁️‍🗨️"}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center justify-between">
                <label className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-border cursor-pointer"
                  />
                  <span className="ml-2 text-text-dark">Remember me</span>
                </label>
                <Link
                  to="/forgotPassword"
                  className="text-sm text-primary-600 hover:text-primary-700 font-semibold"
                >
                  Forgot Password?
                </Link>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                className="w-full"
                disabled={loading}
              >
                {loading ? "Signing In..." : "Sign In"}
              </Button>
            </form>

            {/* Footer Link */}
            <div className="pt-4 border-t border-border text-center">
              <p className="text-sm text-text-light">
                Don't have an account?{" "}
                <Link
                  to="/signup"
                  className="text-primary-600 hover:text-primary-700 font-semibold"
                >
                  Create one now
                </Link>
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Login;
