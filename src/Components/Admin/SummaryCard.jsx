import React from "react";
import "../../Styles/SummaryCard.css";

const SummaryCard = ({ title, value, icon: Icon }) => {
  return (
    <div className="summary-card">
      <div className="summary-icon">
        <Icon />
      </div>

      <div className="summary-details">
        <h4>{title}</h4>
        <h2>{value}</h2>
      </div>
    </div>
  );
};

export default SummaryCard;
