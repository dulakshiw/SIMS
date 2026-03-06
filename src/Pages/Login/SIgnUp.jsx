import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Card, Button } from "../../Components/UI";

const SignUp = () => {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    mobileNo: "",
    officeExtNo: "",
    password: "",
    confirmPassword: "",
    role: "Staff",
    department: "Information Technology"
  });

  const [passwordStrength, setPasswordStrength] = useState(0);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    // Calculate password strength
    if (name === "password") {
      let strength = 0;
      if (value.length >= 8) strength++;
      if (/[A-Z]/.test(value)) strength++;
      if (/[0-9]/.test(value)) strength++;
      if (/[^A-Za-z0-9]/.test(value)) strength++;
      setPasswordStrength(strength);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    if (passwordStrength < 2) {
      alert("Password is too weak. Please use a stronger password.");
      return;
    }

    console.log("Sign Up Data:", formData);
    alert("Account Created Successfully!");
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength <= 1) return "bg-danger";
    if (passwordStrength <= 2) return "bg-warning";
    return "bg-success";
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
      <div className="w-full max-w-4xl">
        <Card className="shadow-2xl">
          <div className="space-y-6">
            {/* Header */}
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold text-text-dark">Create Account</h1>
              <p className="text-text-light text-sm">
                Join the Inventory Management System
              </p>
            </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Two Column Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 gap-y-6">
              {/* Full Name */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-text-dark">
                  Full Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  name="fullName"
                  placeholder="Enter your full name"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  style={{ backgroundColor: '#F2F0F0' }}
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-text-dark">
                  Email <span className="text-danger">*</span>
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

              {/* Mobile Number */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-text-dark">Mobile No</label>
                <input
                  type="tel"
                  name="mobileNo"
                  placeholder="e.g., 0771234567"
                  value={formData.mobileNo}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  style={{ backgroundColor: '#F2F0F0' }}
                />
              </div>

              {/* Office Extension Number */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-text-dark">Office Extension No</label>
                <input
                  type="text"
                  name="officeExtNo"
                  placeholder="e.g., 8100"
                  value={formData.officeExtNo}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  style={{ backgroundColor: '#F2F0F0' }}
                />
              </div>

              {/* Role */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-text-dark">
                  Requested Role <span className="text-danger">*</span>
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  style={{ backgroundColor: '#F2F0F0' }}
                >
                  <option value="Staff">Staff Member</option>
                  <option value="hod">Head of Department</option>
                  <option value="dean">Dean</option>
                  <option value="registrar">Registrar</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>

              {/* Department */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-text-dark">
                  Department <span className="text-danger">*</span>
                </label>
                <select
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  style={{ backgroundColor: '#F2F0F0' }}
                >
                  <option value="Dean's Office">Dean's Office</option>
                  <option value="Information Technology">Information Technology</option>
                  <option value="Computational Mathematics">Computational Mathematics</option>
                  <option value="Interdisciplinary Studies">Interdisciplinary Studies</option>
                  <option value="Undergraduate Studies">Undergraduate Studies</option>
                  <option value="Postgraduate Studies">Postgraduate Studies</option>
                </select>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-text-dark">
                  Password <span className="text-danger">*</span>
                </label>
                <input
                  type="password"
                  name="password"
                  placeholder="Enter password (min 8 characters)"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  style={{ backgroundColor: '#F2F0F0' }}
                />
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-text-dark">
                  Confirm Password <span className="text-danger">*</span>
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  style={{ backgroundColor: '#F2F0F0' }}
                />
              </div>
            </div>

            {/* Password Strength Indicator - Full Width */}
            {formData.password && (
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex gap-1">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className={`h-2 flex-1 rounded ${
                        i < passwordStrength ? getPasswordStrengthColor() : "bg-gray-200"
                      }`}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-text-light">
                    {passwordStrength <= 1 && "Weak password"}
                    {passwordStrength === 2 && "Fair password"}
                    {passwordStrength >= 3 && "Strong password"}
                  </p>
                  {formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword && (
                    <p className="text-xs text-danger font-semibold">✗ Passwords do not match</p>
                  )}
                  {formData.password && formData.confirmPassword && formData.password === formData.confirmPassword && (
                    <p className="text-xs text-success font-semibold">✓ Passwords match</p>
                  )}
                </div>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              className="w-full"
            >
              Create Account
            </Button>
          </form>

          {/* Footer Link */}
          <div className="pt-4 border-t border-border text-center">
            <p className="text-sm text-text-light">
              Already have an account?{" "}
              <Link to="/" className="text-primary-600 hover:text-primary-700 font-semibold">
                Login here
              </Link>
            </p>
          </div>
        </div>
        </Card>
      </div>
    </div>
  );
};
export default SignUp;
