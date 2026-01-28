import React, { useState } from "react";
import Button from "./Button";

const Modal = ({ isOpen, onClose, title, size = "md", children, footer = null, closeButton = true }) => {
  if (!isOpen) return null;

  const sizeStyles = {
    sm: "w-full max-w-sm",
    md: "w-full max-w-md",
    lg: "w-full max-w-lg",
    xl: "w-full max-w-xl",
    full: "w-full max-w-4xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose}></div>

      {/* Modal */}
      <div className={`relative bg-white rounded-lg shadow-xl ${sizeStyles[size]} max-h-[90vh] overflow-y-auto`}>
        {/* Header */}
        {(title || closeButton) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-border-lighter">
            {title && <h2 className="text-xl font-semibold text-text-dark">{title}</h2>}
            {closeButton && (
              <button
                onClick={onClose}
                className="text-text-light hover:text-text-dark transition-colors material-symbols-outlined"
              >
                close
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="px-6 py-4">{children}</div>

        {/* Footer */}
        {footer && <div className="px-6 py-4 border-t border-border-lighter">{footer}</div>}
      </div>
    </div>
  );
};

export default Modal;
