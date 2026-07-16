import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Card, Button, Modal } from "../../Components/UI";
import {
  getPasswordStrength,
  getPasswordStrengthColorClass,
  isPasswordValid,
  PASSWORD_MAX_LENGTH,
  PASSWORD_REQUIREMENTS_MESSAGE,
} from "../../utils/passwordValidation";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: ""
  });

  const [passwordStrength, setPasswordStrength] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPasswordChangedModal, setShowPasswordChangedModal] = useState(false);

  const email = searchParams.get("email");
  const otp = searchParams.get("otp");

  // Verify OTP and email from URL
  useEffect(() => {
    if (!email || !otp) {
      setMessage("Invalid reset link. Please request a new password reset.");
      setMessageType("error");
      setTimeout(() => navigate("/forgotPassword"), 3000);
    }
  }, [email, otp, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    if (name === "newPassword") {
      setPasswordStrength(getPasswordStrength(value));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    // Validation
    if (!isPasswordValid(formData.newPassword)) {
      setMessage(PASSWORD_REQUIREMENTS_MESSAGE);
      setMessageType("error");
      setLoading(false);
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setMessage("Passwords do not match");
      setMessageType("error");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp,
          password: formData.newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || "Unable to reset password.");
      }

      setMessage(data.message || "Password changed successfully. Please login again.");
      setMessageType("success");
      setShowPasswordChangedModal(true);
    } catch (error) {
      setMessage(error.message || "Unable to reset password.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  if (!email || !otp) {
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
            <div className="text-center space-y-4">
              <h1 className="text-2xl font-bold text-text-dark">Invalid Link</h1>
              <p className="text-text-light">
                This password reset link has expired or is invalid.
              </p>
              <Button
                variant="primary"
                onClick={() => navigate("/forgotPassword")}
                className="w-full"
              >
                Request New Link
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

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
              <h1 className="text-3xl font-bold text-text-dark">Set New Password</h1>
              <p className="text-text-light text-sm">
                Create a strong password for your account
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
              {/* New Password */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-text-dark">
                  New Password <span className="text-danger">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="newPassword"
                    value={formData.newPassword}
                    onChange={handleChange}
                    placeholder="Enter new password"
                    required
                    maxLength={PASSWORD_MAX_LENGTH}
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

                {/* Password Strength Indicator */}
                {formData.newPassword && (
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1">
                      {[...Array(4)].map((_, i) => (
                        <div
                          key={i}
                          className={`h-2 flex-1 rounded ${
                            i < passwordStrength ? getPasswordStrengthColorClass(passwordStrength) : "bg-gray-200"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-text-light">
                      {passwordStrength <= 1 && "Weak password"}
                      {passwordStrength === 2 && "Fair password"}
                      {passwordStrength >= 3 && "Strong password"}
                    </p>
                    <p className="text-xs text-text-light mt-1">{PASSWORD_REQUIREMENTS_MESSAGE}</p>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-text-dark">
                  Confirm Password <span className="text-danger">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Confirm new password"
                    required
                    className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    style={{ backgroundColor: '#F2F0F0' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-light hover:text-text-dark"
                  >
                    {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
                  </button>
                </div>

                {/* Match Indicator */}
                {formData.newPassword && formData.confirmPassword && (
                  <div>
                    {formData.newPassword === formData.confirmPassword ? (
                      <p className="text-xs text-success">✓ Passwords match</p>
                    ) : (
                      <p className="text-xs text-danger">✗ Passwords do not match</p>
                    )}
                  </div>
                )}
              </div>

              {/* Security Info */}
              <div className="bg-info-50 border border-info-200 rounded-lg p-3">
                <p className="text-xs text-info-700">
                  <strong>Security Tip:</strong> Use a combination of uppercase, lowercase, numbers, and special characters for a strong password.
                </p>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                className="w-full"
                disabled={
                  loading ||
                  !formData.newPassword ||
                  !formData.confirmPassword ||
                  formData.newPassword !== formData.confirmPassword ||
                  !isPasswordValid(formData.newPassword)
                }
              >
                {loading ? "Resetting..." : "Reset Password"}
              </Button>
            </form>

            {/* Footer Link */}
            <div className="pt-4 border-t border-border text-center">
              <p className="text-sm text-text-light">
                Remember your password?{" "}
                <Link
                  to="/"
                  className="text-primary-600 hover:text-primary-700 font-semibold"
                >
                  Login here
                </Link>
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Modal
        isOpen={showPasswordChangedModal}
        onClose={() => {
          setShowPasswordChangedModal(false);
          navigate("/");
        }}
        title="Password Changed"
        size="sm"
        footer={(
          <div className="flex justify-end">
            <Button
              variant="primary"
              onClick={() => {
                setShowPasswordChangedModal(false);
                navigate("/");
              }}
            >
              Login Again
            </Button>
          </div>
        )}
      >
        <p className="text-sm text-text-dark">Password changed successfully.</p>
        <p className="mt-2 text-sm text-text-light">Please login again with your new password.</p>
      </Modal>
    </div>
  );
};

export default ResetPassword;
