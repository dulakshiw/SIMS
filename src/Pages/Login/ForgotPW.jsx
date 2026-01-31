import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Card, Button } from "../../Components/UI";

const ForgotPW = () => {
  const [step, setStep] = useState(1); // Step 1: Email input, Step 2: OTP verification
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [timer, setTimer] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState(""); // 'success' or 'error'

  // Handle email submission
  const handleSendOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    // Simulate API call
    setTimeout(() => {
      console.log("OTP sent to:", email);
      setMessage("OTP has been sent to your email!");
      setMessageType("success");
      setStep(2);
      setTimer(300); // 5 minutes
      setLoading(false);
    }, 1000);
  };

  // Handle OTP verification
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    // Simulate API call
    setTimeout(() => {
      if (otp.length === 6) {
        console.log("OTP verified:", otp);
        setMessage("OTP verified successfully! Redirecting...");
        setMessageType("success");
        // Redirect to reset password page
        setTimeout(() => {
          window.location.href = `/resetPassword?email=${email}&otp=${otp}`;
        }, 1500);
      } else {
        setMessage("Please enter a valid 6-digit OTP");
        setMessageType("error");
      }
      setLoading(false);
    }, 1000);
  };

  // Countdown timer effect
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
              <h1 className="text-3xl font-bold text-text-dark">Reset Password</h1>
              <p className="text-text-light text-sm">
                {step === 1
                  ? "Enter your email address to receive an OTP"
                  : "Enter the OTP sent to your email"}
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

            {/* Step 1: Email Input */}
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
                    style={{ backgroundColor: '#F2F0F0' }}
                  />
                  <p className="text-xs text-text-light">
                    We'll send a verification code to this email
                  </p>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? "Sending..." : "Send OTP"}
                </Button>
              </form>
            )}

            {/* Step 2: OTP Verification */}
            {step === 2 && (
              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-dark">
                    Verification Code <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="000000"
                    maxLength="6"
                    required
                    className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-center text-2xl tracking-widest"
                    style={{ backgroundColor: '#F2F0F0' }}
                  />
                  <p className="text-xs text-text-light">
                    Enter the 6-digit code sent to <strong>{email}</strong>
                  </p>
                </div>

                {/* Timer */}
                <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                  <span className="text-sm text-text-dark font-medium">
                    Expires in:
                  </span>
                  <span
                    className={`font-semibold ${
                      timer < 60 ? "text-danger" : "text-text-dark"
                    }`}
                  >
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

                {/* Resend OTP */}
                <div className="text-center">
                  <p className="text-sm text-text-light">
                    Didn't receive the code?{" "}
                    {timer === 0 ? (
                      <button
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
                      <span className="text-gray-400">
                        Try again in {formatTimer()}
                      </span>
                    )}
                  </p>
                </div>
              </form>
            )}

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
    </div>
  );
};

export default ForgotPW;
