import React, { useState } from "react";

const Select = ({
  label,
  options = [],
  value,
  onChange,
  placeholder = "Select an option",
  disabled = false,
  error,
  required = false,
  multiple = false,
  className = "",
  name,
  id,
}) => {
  const selectId = id || `select-${name}`;

  const handleChange = (e) => {
    if (multiple) {
      const selectedOptions = Array.from(e.target.selectedOptions, (option) => option.value);
      onChange && onChange(selectedOptions);
    } else {
      onChange && onChange(e.target.value);
    }
  };

  const selectStyles = `
    w-full px-4 py-2.5 border rounded-md text-base
    transition-smooth focus:outline-none appearance-none cursor-pointer bg-white
    ${error ? "border-error focus:ring-2 focus:ring-error focus:ring-opacity-20" : "border-border-light focus:ring-2 focus:ring-primary-800 focus:ring-opacity-20"}
    ${disabled ? "bg-background-light text-text-light cursor-not-allowed" : "text-text-dark"}
  `;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-text-dark">
          {label}
          {required && <span className="text-error ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <select
          id={selectId}
          name={name}
          value={multiple ? value : value || ""}
          onChange={handleChange}
          disabled={disabled}
          multiple={multiple}
          className={selectStyles}
        >
          {!multiple && !value && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 material-symbols-outlined text-text-light pointer-events-none">
          expand_more
        </span>
      </div>

      {error && <p className="text-sm text-error font-medium">{error}</p>}
    </div>
  );
};

export default Select;
