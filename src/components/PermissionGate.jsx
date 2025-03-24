// src/components/PermissionGate.jsx - Complete implementation

import React from "react";
import { AlertCircle, Lock } from "lucide-react";
import usePermissions from "../hooks/usePermissions";

// Default access denied component
const AccessDenied = ({ message, filePath }) => (
  <div className="access-denied-container">
    <div className="access-denied-icon">
      <Lock size={36} />
    </div>
    <h3>Access Denied</h3>
    <p>
      {message ||
        `You don't have permission to access this content: ${filePath}`}
    </p>
  </div>
);

// Loading component
const PermissionLoading = () => (
  <div className="permission-loading">
    <div className="permission-spinner"></div>
    <p>Checking access permissions...</p>
  </div>
);

// Error component
const PermissionError = ({ error }) => (
  <div className="permission-error">
    <AlertCircle size={24} />
    <p>Error checking permissions: {error}</p>
  </div>
);

/**
 * Component to gate content based on file permissions
 *
 * @param {string} filePath - Path to the file/folder to check permissions for
 * @param {React.ReactNode} children - Content to show if access is granted
 * @param {React.ReactNode} fallback - Optional custom component to show if access is denied
 * @param {React.ReactNode} loadingComponent - Optional custom loading component
 * @param {React.ReactNode} errorComponent - Optional custom error component
 * @param {string} accessDeniedMessage - Custom message to show when access is denied
 */
const PermissionGate = ({
  filePath,
  children,
  fallback,
  loadingComponent = <PermissionLoading />,
  errorComponent = PermissionError,
  accessDeniedMessage,
}) => {
  // Use the permission hook
  const { hasAccess, isChecking, error, permissionDetails } =
    usePermissions(filePath);

  // If still checking permissions
  if (isChecking) {
    return loadingComponent;
  }

  // If there was an error checking permissions
  if (error) {
    if (React.isValidElement(errorComponent)) {
      return React.cloneElement(errorComponent, { error });
    }
    return <PermissionError error={error} />;
  }

  // If user has access, show the children
  if (hasAccess) {
    return children;
  }

  // User denied access - show custom fallback or default component
  if (fallback) {
    return fallback;
  }

  return <AccessDenied message={accessDeniedMessage} filePath={filePath} />;
};

export default PermissionGate;
