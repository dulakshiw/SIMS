import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Card, Button } from "../../Components/UI";

const Login = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    // Simulate API call
    setTimeout(() => {
      console.log("Login Data:", formData);
      setMessage("Login successful! Redirecting...");
      setMessageType("success");
      // In a real app, you would redirect to dashboard here
      setTimeout(() => {
        // window.location.href = "/inventory/dashboard";
      }, 1500);
      setLoading(false);
    }, 1000);
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
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold text-text-dark">Welcome Back</h1>
              <p className="text-text-light text-sm">
                Inventory Management System
              </p>
            </div>

            {/* Message Alert */}
            {message && (
              <div
                className={`p-3 rounded-lg text-sm ${
                  messageType === "success"
                    ? "bg-success-50 text-success-700 border border-success-200"
                    : "bg-danger-50 text-danger-700 border border-danger-200"
                }`}
              >
                {message}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-text-dark">
                  Email Address <span className="text-danger">*</span>
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
                  Password <span className="text-danger">*</span>
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
