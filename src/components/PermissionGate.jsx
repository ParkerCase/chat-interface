// src/components/PermissionGate.jsx
import React from "react";
import { AlertCircle, Lock } from "lucide-react";
import usePermissions from "../hooks/usePermissions";

// Simple loading spinner component
const Spinner = () => (
  <div className="permission-check-loading">
    <div className="permission-spinner"></div>
    <p>Checking permissions...</p>
  </div>
);

// Default access denied component
const AccessDenied = ({ message }) => (
  <div className="access-denied">
    <div className="access-denied-icon">
      <Lock size={36} />
    </div>
    <h3>Access Denied</h3>
    <p>{message || "You don't have permission to access this content."}</p>
  </div>
);

// Permission check error component
const PermissionError = ({ error }) => (
  <div className="permission-error">
    <AlertCircle size={24} />
    <p>Error checking permissions: {error}</p>
  </div>
);

const PermissionGate = ({
  filePath,
  children,
  fallback,
  loadingComponent = <Spinner />,
  errorComponent = PermissionError,
  accessDeniedComponent = AccessDenied,
}) => {
  const { hasAccess, isChecking, error } = usePermissions(filePath);

  // If path is checking
  if (isChecking) {
    return loadingComponent;
  }

  // If there was an error checking permissions
  if (error) {
    return errorComponent({ error });
  }

  // If user has access, show the children
  if (hasAccess) {
    return children;
  }

  // User denied access - show custom component or fallback
  if (fallback) {
    return fallback;
  }

  return accessDeniedComponent({
    message: `You don't have permission to access: ${filePath}`,
  });
};

export default PermissionGate;
