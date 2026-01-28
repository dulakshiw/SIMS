import React, { useState } from "react";

const Tabs = ({ tabs = [], activeTab = 0, onChange, className = "" }) => {
  const [active, setActive] = useState(activeTab);

  const handleTabChange = (index) => {
    setActive(index);
    onChange && onChange(index);
  };

  return (
    <div className={className}>
      <div className="flex border-b border-border-light gap-0">
        {tabs.map((tab, index) => (
          <button
            key={index}
            onClick={() => handleTabChange(index)}
            className={`
              px-6 py-4 text-base font-medium transition-smooth
              border-b-2 -mb-px
              ${
                active === index
                  ? "border-primary-800 text-primary-800"
                  : "border-transparent text-text-light hover:text-text-dark"
              }
            `}
          >
            {tab.icon && <span className="material-symbols-outlined mr-2">{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tabs[active] && tabs[active].content && (
          <div>{tabs[active].content}</div>
        )}
      </div>
    </div>
  );
};

export default Tabs;
