// src/components/PermissionGate.jsx
import React, { useState, useEffect } from "react";
import { AlertCircle, Lock } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

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
  permission,
  children,
  fallback,
  loadingComponent = <Spinner />,
  errorComponent = PermissionError,
  accessDeniedComponent = AccessDenied,
}) => {
  const { currentUser, hasPermission, hasRole } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState(null);

  // Check permissions
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        setIsChecking(true);
        setError(null);

        // Skip permission check for admins
        if (hasRole("admin") || hasRole("super_admin")) {
          setHasAccess(true);
          setIsChecking(false);
          return;
        }

        // If we're checking for a specific permission
        if (permission) {
          const permissionGranted = hasPermission(permission);
          setHasAccess(permissionGranted);
          setIsChecking(false);
          return;
        }

        // If we're checking file path permissions
        if (filePath) {
          // First check if the user is in the allowed users list
          const { data, error } = await supabase
            .from("file_permissions")
            .select(
              "required_role, allowed_users, allowed_groups, inherit_parent"
            )
            .eq("file_path", filePath)
            .single();

          if (error && error.code !== "PGRST116") {
            // PGRST116 is "no rows returned" error
            throw error;
          }

          // If no specific permission found for this file
          if (!data) {
            // Check if there's a parent folder with permissions
            const parts = filePath.split("/");
            let hasParentPermission = false;

            // Try each parent path
            while (parts.length > 1) {
              parts.pop(); // Remove the last part
              const parentPath = parts.join("/");

              const { data: parentData, error: parentError } = await supabase
                .from("file_permissions")
                .select(
                  "required_role, allowed_users, allowed_groups, inherit_parent"
                )
                .eq("file_path", parentPath)
                .single();

              if (!parentError && parentData) {
                // Check if permissions inherit
                if (parentData.inherit_parent) {
                  // Check if user is explicitly allowed
                  if (
                    parentData.allowed_users &&
                    Array.isArray(parentData.allowed_users) &&
                    parentData.allowed_users.includes(currentUser.id)
                  ) {
                    hasParentPermission = true;
                    break;
                  }

                  // Check if user has the required role
                  if (parentData.required_role) {
                    const { data: role, error: roleError } = await supabase
                      .from("roles")
                      .select("name")
                      .eq("id", parentData.required_role)
                      .single();

                    if (!roleError && role && hasRole(role.name)) {
                      hasParentPermission = true;
                      break;
                    }
                  }

                  // Check user groups
                  if (
                    parentData.allowed_groups &&
                    Array.isArray(parentData.allowed_groups)
                  ) {
                    const { data: userGroups, error: groupError } =
                      await supabase
                        .from("user_groups")
                        .select("group_id")
                        .eq("user_id", currentUser.id);

                    if (!groupError && userGroups) {
                      const userGroupIds = userGroups.map((ug) => ug.group_id);
                      const hasGroup = parentData.allowed_groups.some((g) =>
                        userGroupIds.includes(g)
                      );

                      if (hasGroup) {
                        hasParentPermission = true;
                        break;
                      }
                    }
                  }
                }
              }
            }

            // If we found parent permissions that allow access
            if (hasParentPermission) {
              setHasAccess(true);
              setIsChecking(false);
              return;
            }

            // Default to basic access if no specific permissions set
            setHasAccess(true);
            setIsChecking(false);
            return;
          }

          // Check if user is explicitly allowed
          if (
            data.allowed_users &&
            Array.isArray(data.allowed_users) &&
            data.allowed_users.includes(currentUser.id)
          ) {
            setHasAccess(true);
            setIsChecking(false);
            return;
          }

          // Check if user has the required role
          if (data.required_role) {
            const { data: role, error: roleError } = await supabase
              .from("roles")
              .select("name")
              .eq("id", data.required_role)
              .single();

            if (!roleError && role && hasRole(role.name)) {
              setHasAccess(true);
              setIsChecking(false);
              return;
            }
          }

          // Check user groups
          if (data.allowed_groups && Array.isArray(data.allowed_groups)) {
            const { data: userGroups, error: groupError } = await supabase
              .from("user_groups")
              .select("group_id")
              .eq("user_id", currentUser.id);

            if (!groupError && userGroups) {
              const userGroupIds = userGroups.map((ug) => ug.group_id);
              const hasGroup = data.allowed_groups.some((g) =>
                userGroupIds.includes(g)
              );

              if (hasGroup) {
                setHasAccess(true);
                setIsChecking(false);
                return;
              }
            }
          }

          // No permissions granted
          setHasAccess(false);
          setIsChecking(false);
          return;
        }

        // If no permission or filePath is specified, just check if user is authenticated
        setHasAccess(!!currentUser);
        setIsChecking(false);
      } catch (err) {
        console.error(`Permission check error:`, err);
        setError(err.message || "Error checking permissions");
        // Default to restricting access on error
        setHasAccess(false);
        setIsChecking(false);
      }
    };

    checkPermissions();
  }, [filePath, permission, currentUser, hasPermission, hasRole]);

  // If path is checking
  if (isChecking) {
    return loadingComponent;
  }

  // If there was an error checking permissions
  if (error) {
    return React.createElement(errorComponent, { error });
  }

  // If user has access, show the children
  if (hasAccess) {
    return children;
  }

  // User denied access - show custom component or fallback
  if (fallback) {
    return fallback;
  }

  return React.createElement(accessDeniedComponent, {
    message: filePath
      ? `You don't have permission to access: ${filePath}`
      : permission
      ? `You don't have the required permission: ${permission}`
      : "You don't have permission to access this resource.",
  });
};

export default PermissionGate;
