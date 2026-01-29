import React, { useState } from "react";

const FormInput = ({
  label,
  type = "text",
  placeholder,
  error,
  required = false,
  icon,
  helpText,
  value,
  onChange,
  disabled = false,
  className = "",
  name,
  id,
  rows,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const inputId = id || `input-${name}`;

  const inputStyles = `
    w-full px-4 py-2.5 border rounded-md text-base
    transition-smooth focus:outline-none
    ${error ? "border-error focus:ring-2 focus:ring-error focus:ring-opacity-20" : "border-border-light focus:ring-2 focus:ring-primary-800 focus:ring-opacity-20"}
    ${disabled ? "text-text-light cursor-not-allowed" : "text-text-dark"}
    placeholder-text-light
  `;

  const bgStyle = { backgroundColor: '#F2F0F0' };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-text-dark">
          {label}
          {required && <span className="text-error ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-light material-symbols-outlined">
            {icon}
          </span>
        )}

        {type === "textarea" ? (
          <textarea
            id={inputId}
            name={name}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            disabled={disabled}
            rows={rows || 4}
            style={bgStyle}
            className={`${inputStyles} ${icon ? "pl-12" : ""} resize-none`}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />
        ) : (
          <input
            id={inputId}
            type={type}
            name={name}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            disabled={disabled}
            style={bgStyle}
            className={`${inputStyles} ${icon ? "pl-12" : ""}`}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />
        )}

        {error && (
          <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-error material-symbols-outlined">
            error
          </span>
        )}
      </div>

      {error && <p className="text-sm text-error font-medium">{error}</p>}
      {helpText && !error && <p className="text-sm text-text-light">{helpText}</p>}
    </div>
  );
};

export default FormInput;
