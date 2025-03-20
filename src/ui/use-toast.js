// src/components/ui/use-toast.js
import React, { createContext, useContext, useState, useCallback } from "react";

// Create a context for toast notifications
const ToastContext = createContext({
  toast: () => {},
  toasts: [],
  dismiss: () => {},
});

// Toast component for displaying notifications
const Toast = ({ id, title, description, variant, onDismiss }) => {
  return (
    <div className={`toast toast-${variant || "default"}`}>
      <div className="toast-content">
        {title && <h4 className="toast-title">{title}</h4>}
        {description && <p className="toast-description">{description}</p>}
      </div>
      <button className="toast-close" onClick={() => onDismiss(id)}>
        ×
      </button>
    </div>
  );
};

// Provider component for the toast system
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  // Add a new toast notification
  const toast = useCallback(({ title, description, variant = "default" }) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, title, description, variant }]);

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 5000);

    return id;
  }, []);

  // Dismiss a specific toast by ID
  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast, toasts, dismiss }}>
      {children}

      {/* Toast container */}
      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map((t) => (
            <Toast
              key={t.id}
              id={t.id}
              title={t.title}
              description={t.description}
              variant={t.variant}
              onDismiss={dismiss}
            />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
};

// Hook for accessing the toast system
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};
