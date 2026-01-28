import React from "react";
import { STATUS_COLORS } from "../../utils/constants";

const Badge = ({ label, variant = "primary", size = "md", className = "" }) => {
  // Variant styles
  const variantStyles = {
    primary: "bg-primary-50 text-primary-800 border border-primary-200",
    success: "bg-green-50 text-green-800 border border-green-200",
    warning: "bg-yellow-50 text-yellow-800 border border-yellow-200",
    error: "bg-red-50 text-red-800 border border-red-200",
    info: "bg-blue-50 text-blue-800 border border-blue-200",
    pending: "bg-yellow-50 text-yellow-800 border border-yellow-200",
    approved: "bg-green-50 text-green-800 border border-green-200",
    rejected: "bg-red-50 text-red-800 border border-red-200",
    completed: "bg-cyan-50 text-cyan-800 border border-cyan-200",
  };

  // Size styles
  const sizeStyles = {
    sm: "px-2 py-1 text-xs font-medium",
    md: "px-3 py-1.5 text-sm font-medium",
    lg: "px-4 py-2 text-base font-medium",
  };

  const baseStyles = "inline-flex items-center justify-center rounded-full whitespace-nowrap";

  return (
    <span className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}>
      {label}
    </span>
  );
};

export default Badge;
