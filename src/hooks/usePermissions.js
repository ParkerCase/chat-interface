// src/hooks/usePermissions.js
import { useState, useEffect } from "react";
import apiService from "../services/apiService";

export function usePermissions(filePath) {
  const [hasAccess, setHasAccess] = useState(true); // Default to true until checked
  const [isAdmin, setIsAdmin] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState(null);
  const [permissionDetails, setPermissionDetails] = useState(null);

  useEffect(() => {
    const checkPermissions = async () => {
      if (!filePath) {
        // If no path, assume access (will be handled elsewhere)
        setIsChecking(false);
        return;
      }

      try {
        setIsChecking(true);
        setError(null);

        // Get effective permissions for this file
        const response = await apiService.permissions.getEffectivePermissions(
          filePath
        );

        if (response.data?.success) {
          setHasAccess(response.data.hasAccess === true);
          setIsAdmin(response.data.isAdmin === true);
          setPermissionDetails(response.data.permissions || null);
        } else {
          // If API returns an error, default to no access
          setHasAccess(false);
          throw new Error(
            response.data?.error || "Failed to check permissions"
          );
        }
      } catch (err) {
        console.error(`Permission check error for ${filePath}:`, err);
        setError(err.message || "Error checking file permissions");
        // Default to restricting access on error
        setHasAccess(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkPermissions();
  }, [filePath]);

  return { hasAccess, isAdmin, isChecking, error, permissionDetails };
}

export default usePermissions;
