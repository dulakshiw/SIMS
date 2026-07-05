import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, Button } from "../../Components/UI";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const OTP_EXPIRY_SECONDS = 600;

const ForgotPW = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [timer, setTimer] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || "Unable to send verification code.");
      }

      if (data.devOtp) {
        setOtp(String(data.devOtp));
        setMessage(
          data.message ||
            `Email is not configured. Use this development code: ${data.devOtp}`
        );
      } else {
        setMessage(
          data.message || "If an account exists with that email, a verification code has been sent."
        );
      }
      setMessageType("success");
      setStep(2);
      setTimer(Number(data.expiresInSeconds) || OTP_EXPIRY_SECONDS);
    } catch (error) {
      setMessage(error.message || "Unable to send verification code.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/verify-reset-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || "Invalid verification code.");
      }

      setMessage("Verification code accepted. Redirecting...");
      setMessageType("success");
      setTimeout(() => {
        navigate(`/resetPassword?email=${encodeURIComponent(email.trim().toLowerCase())}&otp=${encodeURIComponent(otp)}`);
      }, 800);
    } catch (error) {
      setMessage(error.message || "Invalid verification code.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    let interval;
    if (timer > 0) {
      interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const formatTimer = () => {
    const minutes = Math.floor(timer / 60);
    const seconds = timer % 60;
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundImage: "linear-gradient(rgba(0,0,0,0.5),rgba(0,0,0,0.5)), url(/src/assets/loginbg1.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="max-w-md w-full">
        <Card className="shadow-2xl">
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold text-text-dark">Reset Password</h1>
              <p className="text-text-light text-sm">
                {step === 1
                  ? "Enter your email address to receive an OTP"
                  : "Enter the OTP sent to your email"}
              </p>
            </div>

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

            {step === 1 && (
              <form onSubmit={handleSendOTP} className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-dark">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your registered email"
                    required
                    className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    style={{ backgroundColor: "#F2F0F0" }}
                  />
                  <p className="text-xs text-text-light">
                    We&apos;ll send a verification code to this email
                  </p>
                </div>

                <Button type="submit" variant="primary" className="w-full" disabled={loading}>
                  {loading ? "Sending..." : "Send OTP"}
                </Button>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-dark">
                    Verification Code <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    maxLength="6"
                    required
                    className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-center text-2xl tracking-widest"
                    style={{ backgroundColor: "#F2F0F0" }}
                  />
                  <p className="text-xs text-text-light">
                    Enter the 6-digit code sent to <strong>{email}</strong>
                  </p>
                </div>

                <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                  <span className="text-sm text-text-dark font-medium">Expires in:</span>
                  <span className={`font-semibold ${timer < 60 ? "text-danger" : "text-text-dark"}`}>
                    {formatTimer()}
                  </span>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full"
                  disabled={loading || otp.length !== 6}
                >
                  {loading ? "Verifying..." : "Verify OTP"}
                </Button>

                <div className="text-center">
                  <p className="text-sm text-text-light">
                    Didn&apos;t receive the code?{" "}
                    {timer === 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setStep(1);
                          setOtp("");
                          setMessage("");
                        }}
                        className="text-primary-600 hover:text-primary-700 font-semibold"
                      >
                        Send again
                      </button>
                    ) : (
                      <span className="text-gray-400">Try again in {formatTimer()}</span>
                    )}
                  </p>
                </div>
              </form>
            )}

            <div className="pt-4 border-t border-border text-center">
              <p className="text-sm text-text-light">
                Remember your password?{" "}
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

export default ForgotPW;
