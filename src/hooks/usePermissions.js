// src/hooks/usePermissions.js - Complete implementation

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

export function usePermissions(filePath = null) {
  const { currentUser, hasRole } = useAuth();
  const [hasAccess, setHasAccess] = useState(true); // Default to true until checked
  const [isAdmin, setIsAdmin] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState(null);
  const [permissionDetails, setPermissionDetails] = useState(null);

  // Check file permissions
  const checkFilePermission = useCallback(async () => {
    if (!filePath || !currentUser) {
      setIsChecking(false);
      return;
    }

    try {
      // Admin and super_admin always have access
      if (hasRole("admin") || hasRole("super_admin")) {
        setIsAdmin(true);
        setHasAccess(true);
        setIsChecking(false);
        return;
      }

      // Check if this file has specific permissions
      const { data, error: permError } = await supabase
        .from("file_permissions")
        .select("required_role, allowed_users, allowed_groups, inherit_parent")
        .eq("file_path", filePath)
        .single();

      if (permError && permError.code !== "PGRST116") {
        // PGRST116 is "no rows returned" error
        throw permError;
      }

      // If file has specific permissions
      if (data) {
        // Check if user is explicitly allowed
        if (data.allowed_users && data.allowed_users.includes(currentUser.id)) {
          setHasAccess(true);
          setPermissionDetails({
            type: "direct",
            details: "User explicitly allowed",
          });
          setIsChecking(false);
          return;
        }

        // Check if user has the required role
        if (data.required_role) {
          const { data: roleData, error: roleError } = await supabase
            .from("roles")
            .select("name")
            .eq("id", data.required_role)
            .single();

          if (roleError) throw roleError;

          if (roleData && hasRole(roleData.name)) {
            setHasAccess(true);
            setPermissionDetails({
              type: "role",
              details: `Access granted via role: ${roleData.name}`,
            });
            setIsChecking(false);
            return;
          }
        }

        // Check user groups
        if (data.allowed_groups && data.allowed_groups.length > 0) {
          const { data: userGroups, error: groupError } = await supabase
            .from("user_groups")
            .select("group_id")
            .eq("user_id", currentUser.id);

          if (groupError) throw groupError;

          if (userGroups && userGroups.length > 0) {
            const userGroupIds = userGroups.map((ug) => ug.group_id);
            const hasGroup = data.allowed_groups.some((g) =>
              userGroupIds.includes(g)
            );

            if (hasGroup) {
              setHasAccess(true);
              setPermissionDetails({
                type: "group",
                details: "Access granted via group membership",
              });
              setIsChecking(false);
              return;
            }
          }
        }

        // If inheritance is turned off and no direct access, deny access
        if (data.inherit_parent === false) {
          setHasAccess(false);
          setPermissionDetails({
            type: "denied",
            details: "No access rights and inheritance disabled",
          });
          setIsChecking(false);
          return;
        }
      }

      // If we get here, we need to check parent directories (or this file has no specific permissions)
      // Only check parent directories if file has no permissions or if inheritance is on
      if (!data || data.inherit_parent) {
        // Try parent directories recursively
        let currentPath = filePath;
        let accessGranted = false;
        let foundDetails = null;

        while (currentPath.includes("/") && !accessGranted) {
          // Move up one directory
          currentPath = currentPath.substring(0, currentPath.lastIndexOf("/"));
          if (currentPath === "") currentPath = "/"; // Root directory

          const { data: parentData, error: parentError } = await supabase
            .from("file_permissions")
            .select(
              "required_role, allowed_users, allowed_groups, inherit_parent"
            )
            .eq("file_path", currentPath)
            .single();

          if (parentError && parentError.code !== "PGRST116") throw parentError;

          if (parentData) {
            // Check if user is explicitly allowed in parent
            if (
              parentData.allowed_users &&
              parentData.allowed_users.includes(currentUser.id)
            ) {
              accessGranted = true;
              foundDetails = {
                type: "parent",
                details: `Inherited from parent: ${currentPath}`,
              };
              break;
            }

            // Check if user has the required role for parent
            if (parentData.required_role) {
              const { data: roleData, error: roleError } = await supabase
                .from("roles")
                .select("name")
                .eq("id", parentData.required_role)
                .single();

              if (roleError) throw roleError;

              if (roleData && hasRole(roleData.name)) {
                accessGranted = true;
                foundDetails = {
                  type: "parent_role",
                  details: `Inherited via role from parent: ${currentPath}`,
                };
                break;
              }
            }

            // Check user groups for parent
            if (
              parentData.allowed_groups &&
              parentData.allowed_groups.length > 0
            ) {
              const { data: userGroups, error: groupError } = await supabase
                .from("user_groups")
                .select("group_id")
                .eq("user_id", currentUser.id);

              if (groupError) throw groupError;

              if (userGroups && userGroups.length > 0) {
                const userGroupIds = userGroups.map((ug) => ug.group_id);
                const hasGroup = parentData.allowed_groups.some((g) =>
                  userGroupIds.includes(g)
                );

                if (hasGroup) {
                  accessGranted = true;
                  foundDetails = {
                    type: "parent_group",
                    details: `Inherited via group from parent: ${currentPath}`,
                  };
                  break;
                }
              }
            }

            // If inheritance is turned off at this level, stop checking parents
            if (parentData.inherit_parent === false) {
              break;
            }
          }

          // Stop if we've reached the root
          if (currentPath === "/") break;
        }

        // Set access based on parent check results
        if (accessGranted) {
          setHasAccess(true);
          setPermissionDetails(foundDetails);
        } else {
          // If we've checked everything and found no permissions, use default policy
          // Default to organization-wide settings or deny
          setHasAccess(false);
          setPermissionDetails({
            type: "default",
            details: "No specific permissions found",
          });
        }
      } else {
        // No access rights found for this file and no inheritance
        setHasAccess(false);
        setPermissionDetails({
          type: "denied",
          details: "Access denied - no permissions found",
        });
      }
    } catch (err) {
      console.error("Permission check error:", err);
      setError(err.message || "Error checking permissions");
      setHasAccess(false);
      setPermissionDetails({
        type: "error",
        details: err.message,
      });
    } finally {
      setIsChecking(false);
    }
  }, [filePath, currentUser, hasRole]);

  // Run permission check when dependencies change
  useEffect(() => {
    checkFilePermission();
  }, [checkFilePermission]);

  // Function to set permissions for a file
  const setFilePermissions = async (permissionData) => {
    try {
      // Validate input
      if (!filePath) {
        throw new Error("File path is required");
      }

      // Prepare data for upsert
      const data = {
        file_path: filePath,
        ...permissionData,
        updated_at: new Date().toISOString(),
      };

      // Upsert (insert or update) permissions
      const { error } = await supabase.from("file_permissions").upsert(data, {
        onConflict: "file_path",
        returning: "minimal",
      });

      if (error) throw error;

      // Refresh permissions
      await checkFilePermission();

      return { success: true };
    } catch (err) {
      console.error("Error setting permissions:", err);
      return {
        success: false,
        error: err.message,
      };
    }
  };

  // Function to delete permissions for a file
  const deleteFilePermissions = async () => {
    try {
      if (!filePath) {
        throw new Error("File path is required");
      }

      const { error } = await supabase
        .from("file_permissions")
        .delete()
        .eq("file_path", filePath);

      if (error) throw error;

      // Refresh permissions
      await checkFilePermission();

      return { success: true };
    } catch (err) {
      console.error("Error deleting permissions:", err);
      return {
        success: false,
        error: err.message,
      };
    }
  };

  return {
    hasAccess,
    isAdmin,
    isChecking,
    error,
    permissionDetails,
    setFilePermissions,
    deleteFilePermissions,
    recheckPermissions: checkFilePermission,
  };
}

// Use this hook in components that need file permissions
export default usePermissions;
