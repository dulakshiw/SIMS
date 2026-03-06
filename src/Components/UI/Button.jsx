import React from "react";

const Button = ({
  children,
  variant = "primary",
  size = "md",
  disabled = false,
  icon = null,
  iconPosition = "left",
  loading = false,
  onClick,
  title = "",
  className = "",
  type = "button",
  fullWidth = false,
}) => {
  // Variant styles
  const variantStyles = {
    primary: "bg-primary-800 text-white hover:bg-primary-700 active:bg-primary-900",
    secondary: "bg-border-lighter text-text-dark hover:bg-border-light active:bg-primary-100",
    ghost: "bg-transparent text-primary-800 hover:bg-primary-50 active:bg-primary-100",
    danger: "bg-error text-white hover:bg-red-600 active:bg-red-800",
  };

  // Size styles
  const sizeStyles = {
    sm: "px-3 py-1.5 text-sm gap-2",
    md: "px-4 py-2 text-base gap-2",
    lg: "px-6 py-3 text-lg gap-3",
  };

  const baseStyles =
    "inline-flex items-center justify-center font-medium rounded-md transition-smooth disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none";

  const widthStyles = fullWidth ? "w-full" : "";

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      title={title || undefined}
      aria-label={title || undefined}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyles} ${className}`}
    >
      {loading && (
        <span className="animate-spin">
          <span className="material-symbols-outlined text-sm">refresh</span>
        </span>
      )}
      {icon && iconPosition === "left" && !loading && (
        <span className="material-symbols-outlined text-base">{icon}</span>
      )}
      {children}
      {icon && iconPosition === "right" && !loading && (
        <span className="material-symbols-outlined text-base">{icon}</span>
      )}
    </button>
  );
};

export default Button;
