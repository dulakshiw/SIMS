import React, { useState } from "react";
import { debounce } from "../../utils/helpers";

const SearchBox = ({
  value,
  onChange,
  placeholder = "Search...",
  onSearch,
  disabled = false,
  showFilter = false,
  onFilterClick,
  debounceDelay = 300,
  className = "",
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const debouncedSearch = debounce((searchTerm) => {
    onSearch && onSearch(searchTerm);
  }, debounceDelay);

  const handleChange = (e) => {
    const newValue = e.target.value;
    onChange && onChange(newValue);
    debouncedSearch(newValue);
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      <div className="flex-1 relative">
        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-light material-symbols-outlined pointer-events-none">
          search
        </span>
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={`
            w-full pl-12 pr-4 py-2.5 border rounded-md text-base
            transition-smooth focus:outline-none
            ${isFocused ? "border-primary-800 ring-2 ring-primary-800 ring-opacity-20" : "border-border-light"}
            ${disabled ? "bg-background-light text-text-light cursor-not-allowed" : "bg-white text-text-dark"}
            placeholder-text-light
          `}
        />
      </div>

      {showFilter && (
        <button
          onClick={onFilterClick}
          className="px-4 py-2.5 bg-background-light border border-border-light rounded-md text-text-dark hover:bg-border-lighter transition-smooth flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-base">tune</span>
          Filter
        </button>
      )}
    </div>
  );
};

export default SearchBox;
