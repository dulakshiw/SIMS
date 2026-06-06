import React from "react";

const PageHeader = ({ title, subtitle, centerContent = null, actions = null, className = "" }) => {
  const hasActions = Boolean(actions);
  const hasCenter = Boolean(centerContent);

  const layoutClassName = hasCenter
    ? "flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center"
    : hasActions
      ? "flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      : "flex flex-col gap-1";

  return (
    <div className={`gradient-primary py-6 rounded-t ${className}`.trim()}>
      <div className="max-w-7xl mx-auto px-6">
        <div className={layoutClassName}>
          <div>
            <h1 className="text-3xl font-bold text-white">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-primary-50">{subtitle}</p> : null}
          </div>
          {hasCenter ? (
            <div className="flex items-center justify-center text-center">
              {centerContent}
            </div>
          ) : null}
          {hasActions ? (
            <div className={`flex flex-wrap items-center gap-3 ${hasCenter ? "md:justify-self-end md:justify-end" : ""}`}>
              {actions}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default PageHeader;