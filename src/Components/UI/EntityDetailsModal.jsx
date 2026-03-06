import React from "react";
import Modal from "./Modal";
import Button from "./Button";

const EntityDetailsModal = ({
  isOpen,
  onClose,
  title,
  selectedLabel = "Selected",
  selectedName,
  details = [],
  size = "md",
}) => {
  const formatValue = (value) => {
    if (value === 0) {
      return "0";
    }

    return value || "-";
  };

  const footer = (
    <div className="flex justify-end">
      <Button variant="secondary" onClick={onClose}>
        Close
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      title={title}
      onClose={onClose}
      footer={footer}
      size={size}
    >
      <div className="space-y-4">
        <div className="bg-background-light p-4 rounded-lg">
          <p className="text-sm text-text-light">{selectedLabel}</p>
          <p className="text-lg font-semibold text-text-dark">{formatValue(selectedName)}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {details.map((detail) => (
            <div key={detail.label} className={detail.fullWidth ? "md:col-span-2" : ""}>
              <p className="text-text-light">{detail.label}</p>
              <p className="font-semibold text-text-dark">{formatValue(detail.value)}</p>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
};

export default EntityDetailsModal;
