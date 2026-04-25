import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, Button } from "../../Components/UI";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const SignUp = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    mobileNo: "",
    officeExtNo: "",
    password: "",
    confirmPassword: "",
    department: "Information Technology",
    designation: ""
  });

  const [passwordStrength, setPasswordStrength] = useState(0);
  const [otherDesignation, setOtherDesignation] = useState("");
  const [loading, setLoading] = useState(false);

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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    if (passwordStrength < 2) {
      alert("Password is too weak. Please use a stronger password.");
      return;
    }

    // If "Other" is selected, use the custom designation
    const finalFormData = {
      ...formData,
      designation: formData.designation === "Other" ? otherDesignation : formData.designation
    };

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(finalFormData),
      });

      const responseText = await response.text();
      let data = {};

      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch {
          throw new Error("The signup service returned an invalid response. Please make sure the API server is running.");
        }
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || "Account creation failed.");
      }

      alert(data.message || "Account request submitted successfully!");
      navigate("/", { replace: true });
    } catch (error) {
      const fallbackMessage = error?.message?.includes("Failed to fetch")
        ? "Unable to reach the signup service. Please start the API server and try again."
        : error.message || "Unable to create account right now.";

      alert(fallbackMessage);
    } finally {
      setLoading(false);
    }
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
                Create a staff member account request. Requests go to your Department Head for review and then to admin for activation.
              </p>
            </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Two Column Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 gap-y-6">
              {/* Full Name */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-text-dark">
                  Full Name 
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
                  Email 
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

              {/* Department */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-text-dark">
                  Department 
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

              {/* Designation */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-text-dark">
                  Designation 
                </label>
                <select
                  name="designation"
                  value={formData.designation}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  style={{ backgroundColor: '#F2F0F0' }}
                >
                  <option value="Lecturer">Lecturer</option>
                  <option value="Instructor">Instructor</option>
                  <option value="Technical Officer">Technical Officer</option>
                  <option value="Management Assistant">Management Assistant</option>  
                  <option value="Laboratory Attendant">Laboratory Attendant</option>
                  <option value="Works Aide">Works Aide</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Other Designation Text Area - Only shown when Other is selected */}
              {formData.designation === "Other" && (
                <div className="space-y-2 md:col-span-2">
                  <label className="block text-sm font-semibold text-text-dark">
                    Please Specify Your Designation 
                  </label>
                  <textarea
                    name="otherDesignation"
                    placeholder="Enter your designation"
                    value={otherDesignation}
                    onChange={(e) => setOtherDesignation(e.target.value)}
                    required
                    rows={3}
                    className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                    style={{ backgroundColor: '#F2F0F0' }}
                  />
                </div>
              )}

              {/* Password */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-text-dark">
                  Password 
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
                  Confirm Password 
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
              disabled={loading}
            >
              {loading ? "Submitting Request..." : "Submit Account Request"}
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
