import React from "react";
import Card from "./Card";

export const SUMMARY_GRID_COLUMNS = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-2 xl:grid-cols-4",
  "4-equal": "md:grid-cols-4",
  "4-lg": "md:grid-cols-2 lg:grid-cols-4",
};

const SummaryCard = ({
  title,
  count,
  description,
  icon,
  active = false,
  onClick,
  loading = false,
  countClassName = "text-primary-800",
  hover = true,
  className = "",
}) => {
  const isClickable = Boolean(onClick);

  return (
    <Card
      icon={icon}
      hover={hover && isClickable}
      onClick={onClick}
      className={`!border-primary-600 ${
        isClickable ? "cursor-pointer transition-all" : ""
      } ${
        active ? "ring-2 ring-primary-600 !border-primary-400 shadow-md" : ""
      } ${className}`}
    >
      <p className="text-lg font-semibold text-text-dark border-b border-border-lighter pb-2">
        {title}
      </p>
      <p className={`mt-2 text-3xl font-bold ${countClassName}`}>
        {loading ? "..." : count}
      </p>
      {description ? (
        <p className="mt-2 text-sm text-text-light">{description}</p>
      ) : null}
    </Card>
  );
};

export const SummaryCardsGrid = ({
  title = "Summary",
  showTitle = true,
  columns = 3,
  gridClassName = "",
  className = "",
  children,
}) => {
  const columnClass = SUMMARY_GRID_COLUMNS[columns] || SUMMARY_GRID_COLUMNS[3];

  return (
    <div className={className}>
      {showTitle && title ? (
        <h2 className="text-lg font-semibold text-text-dark mb-3">{title}</h2>
      ) : null}
      <div className={`grid grid-cols-1 gap-4 ${columnClass} ${gridClassName}`.trim()}>
        {children}
      </div>
    </div>
  );
};

export default SummaryCard;
