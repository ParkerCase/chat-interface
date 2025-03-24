// src/utils/permissionUtils.js

import { supabase } from "../lib/supabase";

/**
 * Checks if a user has access to a specific file
 * @param {string} filePath - The file path to check
 * @param {object} user - The current user object
 * @param {string} organizationId - The organization ID
 * @returns {Promise<boolean>} - Whether the user has access
 */
export async function checkFileAccess(filePath, user, organizationId) {
  // Admins have access to all files
  if (user.roles?.includes("admin") || user.roles?.includes("super_admin")) {
    return true;
  }

  try {
    // Check direct file permissions
    const { data: permission } = await supabase
      .from("file_permissions")
      .select("*")
      .eq("file_path", filePath)
      .eq("organization_id", organizationId)
      .single();

    if (permission) {
      // Check if user is explicitly allowed
      if (permission.allowed_users?.includes(user.id)) {
        return true;
      }

      // Check if user is explicitly restricted
      if (permission.restricted_users?.includes(user.id)) {
        return false;
      }

      // Check role restrictions
      if (permission.restricted_to_roles?.length > 0) {
        const hasRequiredRole = permission.restricted_to_roles.some((role) =>
          user.roles?.includes(role)
        );

        if (!hasRequiredRole) {
          return false;
        }
      }
    }

    // If no specific permissions or inheriting from parent
    if (!permission || permission.inherit_parent) {
      // Check parent directories
      const pathParts = filePath.split("/");

      while (pathParts.length > 1) {
        pathParts.pop();
        const parentPath = pathParts.join("/");

        const { data: parentPermission } = await supabase
          .from("file_permissions")
          .select("*")
          .eq("file_path", parentPath)
          .eq("organization_id", organizationId)
          .single();

        if (parentPermission) {
          // Check if user is explicitly allowed
          if (parentPermission.allowed_users?.includes(user.id)) {
            return true;
          }

          // Check if user is explicitly restricted
          if (parentPermission.restricted_users?.includes(user.id)) {
            return false;
          }

          // Check role restrictions
          if (parentPermission.restricted_to_roles?.length > 0) {
            const hasRequiredRole = parentPermission.restricted_to_roles.some(
              (role) => user.roles?.includes(role)
            );

            if (!hasRequiredRole) {
              return false;
            }
          }

          // If not inheriting further, stop checking
          if (!parentPermission.inherit_parent) {
            break;
          }
        }
      }
    }

    // Default allow if no specific restrictions found
    return true;
  } catch (error) {
    console.error("Error checking file access:", error);
    // Default deny on error
    return false;
  }
}

/**
 * Filter files based on user access permissions
 * @param {Array} filePaths - Array of file paths
 * @param {object} user - Current user
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Array>} - Array of accessible files
 */
export async function filterAccessibleFiles(filePaths, user, organizationId) {
  // Admins can access all files
  if (user.roles?.includes("admin") || user.roles?.includes("super_admin")) {
    return filePaths;
  }

  // Check each file
  const accessPromises = filePaths.map((filePath) =>
    checkFileAccess(filePath, user, organizationId).then((hasAccess) => ({
      filePath,
      hasAccess,
    }))
  );

  const accessResults = await Promise.all(accessPromises);

  // Filter to only accessible files
  return accessResults
    .filter((result) => result.hasAccess)
    .map((result) => result.filePath);
}
