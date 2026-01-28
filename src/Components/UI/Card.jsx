import React from "react";

const Card = ({ title, subtitle, icon, children, className = "", onClick, hover = true }) => {
  const hoverStyles = hover ? "hover:shadow-md transition-shadow" : "";

  return (
    <div
      className={`bg-white rounded-lg shadow-sm p-6 border border-border-lighter ${hoverStyles} ${className}`}
      onClick={onClick}
    >
      {(title || subtitle || icon) && (
        <div className="flex items-start gap-3 mb-4">
          {icon && (
            <span className="material-symbols-outlined text-primary-800 text-2xl flex-shrink-0">
              {icon}
            </span>
          )}
          <div>
            {title && <h3 className="text-lg font-semibold text-text-dark">{title}</h3>}
            {subtitle && <p className="text-sm text-text-light mt-1">{subtitle}</p>}
          </div>
        </div>
      )}
      {children && <div className="text-base text-text-dark">{children}</div>}
    </div>
  );
};

export default Card;
