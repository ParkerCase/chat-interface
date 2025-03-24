// src/components/admin/FilePermissionsManager.jsx - Updates

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import usePermissions from "../../hooks/usePermissions";
import {
  Folder,
  File,
  Users,
  Shield,
  Search,
  RefreshCw,
  Save,
  AlertCircle,
  CheckCircle,
  User,
  UserPlus,
  UserMinus,
  Lock,
  X,
  ChevronRight,
  Loader,
} from "lucide-react";
import "./Admin.css";

function FilePermissionsManager() {
  const { currentUser, isAdmin } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Data states
  const [files, setFiles] = useState([]);
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);

  // Selection states
  const [currentPath, setCurrentPath] = useState("/");
  const [selectedFile, setSelectedFile] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Permissions state
  const [permissions, setPermissions] = useState({
    requiredRole: "",
    allowedUsers: [],
    allowedGroups: [],
    inheritParent: true,
  });

  // Use the permission hook for the selected file
  const {
    hasAccess,
    isAdmin: fileAdmin,
    permissionDetails,
    setFilePermissions,
    deleteFilePermissions,
  } = usePermissions(selectedFile?.path);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch roles
        const { data: rolesData, error: rolesError } = await supabase
          .from("roles")
          .select("id, name, description")
          .order("name");

        if (rolesError) throw rolesError;
        setRoles(rolesData || []);

        // Fetch users
        const { data: usersData, error: usersError } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .order("full_name");

        if (usersError) throw usersError;
        setUsers(usersData || []);

        // Fetch groups
        const { data: groupsData, error: groupsError } = await supabase
          .from("groups")
          .select("id, name, description")
          .order("name");

        if (groupsError) throw groupsError;
        setGroups(groupsData || []);

        // Load files for the current path
        await loadFiles(currentPath);
      } catch (err) {
        console.error("Error loading initial data:", err);
        setError("Failed to load necessary data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Function to load files for a specific path
  const loadFiles = async (path) => {
    try {
      setIsLoading(true);

      // In a real app, this would be an API call to get files from storage
      // For now, let's simulate some files
      const filesForPath = await fetchFilesFromStorage(path);

      setFiles(filesForPath);
      setCurrentPath(path);
    } catch (err) {
      console.error("Error loading files:", err);
      setError(`Failed to load files for path: ${path}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Load permissions for a file
  const loadPermissions = async (file) => {
    try {
      setIsLoading(true);
      setSelectedFile(file);

      // Get the organization_id
      const organizationId = currentUser.organization_id;

      // Get permissions for this file path in this organization
      const { data, error } = await supabase
        .from("file_permissions")
        .select("*")
        .eq("file_path", file.path)
        .eq("organization_id", organizationId)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 is "no rows returned" error
        throw error;
      }

      if (data) {
        // Load user data for display
        const usersPromise =
          data.allowed_users?.length > 0
            ? supabase
                .from("profiles")
                .select("id, full_name")
                .in("id", data.allowed_users)
            : Promise.resolve({ data: [] });

        const restrictedUsersPromise =
          data.restricted_users?.length > 0
            ? supabase
                .from("profiles")
                .select("id, full_name")
                .in("id", data.restricted_users)
            : Promise.resolve({ data: [] });

        const [usersResult, restrictedUsersResult] = await Promise.all([
          usersPromise,
          restrictedUsersPromise,
        ]);

        // Set permissions with user display info
        setPermissions({
          restrictedToRoles: data.restricted_to_roles || [],
          allowedUsers: data.allowed_users || [],
          restrictedUsers: data.restricted_users || [],
          inheritParent: data.inherit_parent !== false,
          // Add display names for UI
          allowedUserNames:
            usersResult.data?.map((u) => ({ id: u.id, name: u.full_name })) ||
            [],
          restrictedUserNames:
            restrictedUsersResult.data?.map((u) => ({
              id: u.id,
              name: u.full_name,
            })) || [],
        });
      } else {
        // No permissions set, use defaults
        setPermissions({
          restrictedToRoles: [],
          allowedUsers: [],
          restrictedUsers: [],
          inheritParent: true,
          allowedUserNames: [],
          restrictedUserNames: [],
        });
      }
    } catch (error) {
      console.error("Error loading permissions:", error);
      setError(`Failed to load permissions for ${file.path}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Save permissions
  const savePermissions = async () => {
    if (!selectedFile) return;

    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);

      const organizationId = currentUser.organization_id;

      // Prepare permission data
      const permissionData = {
        file_path: selectedFile.path,
        organization_id: organizationId,
        restricted_to_roles: permissions.restrictedToRoles,
        allowed_users: permissions.allowedUsers,
        restricted_users: permissions.restrictedUsers,
        inherit_parent: permissions.inheritParent,
      };

      // Check if permissions already exist
      const { data: existingPermission } = await supabase
        .from("file_permissions")
        .select("id")
        .eq("file_path", selectedFile.path)
        .eq("organization_id", organizationId)
        .single();

      if (existingPermission) {
        // Update existing permissions
        const { error } = await supabase
          .from("file_permissions")
          .update(permissionData)
          .eq("id", existingPermission.id);

        if (error) throw error;
      } else {
        // Insert new permissions
        const { error } = await supabase
          .from("file_permissions")
          .insert(permissionData);

        if (error) throw error;
      }

      setSuccess(`Permissions updated for: ${selectedFile.name}`);
    } catch (error) {
      console.error("Error saving permissions:", error);
      setError(
        `Failed to save permissions: ${error.message || "Unknown error"}`
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Stub function for fetching files - replace with actual API call
  const fetchFilesFromStorage = async (path) => {
    // Simulated API call to your backend
    try {
      const response = await fetch(
        `${
          process.env.REACT_APP_API_URL
        }/api/storage/files?path=${encodeURIComponent(path)}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch files: ${response.status}`);
      }

      const data = await response.json();
      return data.files || [];
    } catch (error) {
      console.error("Error fetching files:", error);
      // Return some mock data as fallback
      return [
        { name: "Document1.pdf", path: `${path}/Document1.pdf`, type: "file" },
        { name: "Images", path: `${path}/Images`, type: "folder" },
        { name: "Clients", path: `${path}/Clients`, type: "folder" },
      ];
    }
  };

  // Helper to get role name from ID
  const getRoleName = async (roleId) => {
    if (!roleId) return "";

    const { data, error } = await supabase
      .from("roles")
      .select("name")
      .eq("id", roleId)
      .single();

    if (error) {
      console.error("Error fetching role name:", error);
      return "";
    }

    return data?.name || "";
  };

  // Helper to get role ID from name
  const getRoleId = async (roleName) => {
    if (!roleName) return null;

    const { data, error } = await supabase
      .from("roles")
      .select("id")
      .eq("name", roleName)
      .single();

    if (error) {
      console.error("Error fetching role ID:", error);
      return null;
    }

    return data?.id || null;
  };

  // Search files by name
  const searchFiles = useCallback(async () => {
    if (!searchQuery.trim()) return;

    try {
      setIsSearching(true);

      // API call to search files
      const response = await fetch(
        `${
          process.env.REACT_APP_API_URL
        }/api/storage/search?q=${encodeURIComponent(searchQuery)}`
      );

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setFiles(data.files || []);
      } else {
        throw new Error(data.error || "Search failed");
      }
    } catch (err) {
      console.error("Error searching files:", err);
      setError(`Search failed: ${err.message}`);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  // Navigate to parent directory
  const navigateUp = () => {
    if (currentPath === "/") return;

    const parentPath = currentPath.substring(0, currentPath.lastIndexOf("/"));
    loadFiles(parentPath || "/");
  };

  // Handle file/folder click
  const handleFileClick = (file) => {
    if (file.type === "folder") {
      loadFiles(file.path);
    } else {
      loadPermissions(file);
    }
  };

  // Handle form input changes
  const handlePermissionChange = (field, value) => {
    setPermissions((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // If user is not an admin, show unauthorized message
  if (!isAdmin) {
    return (
      <div className="unauthorized-message">
        <AlertCircle />
        <h3>Admin Access Required</h3>
        <p>You need administrator privileges to manage file permissions.</p>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <h1>File Permissions Management</h1>

      {/* Error message */}
      {error && (
        <div className="error-alert">
          <AlertCircle size={18} />
          <p>{error}</p>
          <button
            className="close-button"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Success message */}
      {success && (
        <div className="success-alert">
          <CheckCircle size={18} />
          <p>{success}</p>
        </div>
      )}

      <div className="admin-content-grid">
        {/* File browser section */}
        <div className="file-browser-section">
          <div className="file-browser-header">
            <h3>File Browser</h3>
            <div className="file-browser-controls">
              <button
                className="browser-button"
                onClick={navigateUp}
                disabled={currentPath === "/" || isLoading}
                title="Go up one level"
              >
                <ChevronRight size={18} className="rotate-180" />
              </button>

              <button
                className="browser-button"
                onClick={() => loadFiles(currentPath)}
                disabled={isLoading}
                title="Refresh"
              >
                <RefreshCw size={18} />
              </button>
            </div>
          </div>

          <div className="file-path-bar">
            <span>Current path: </span>
            <span className="current-path">{currentPath}</span>
          </div>

          <div className="file-search-bar">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className="search-input"
            />
            <button
              className="search-button"
              onClick={searchFiles}
              disabled={isSearching || !searchQuery.trim()}
            >
              {isSearching ? (
                <Loader className="spinner" size={16} />
              ) : (
                <Search size={16} />
              )}
            </button>
          </div>

          <div className="file-list">
            {isLoading ? (
              <div className="loading-indicator">
                <Loader className="spinner" size={24} />
                <p>Loading files...</p>
              </div>
            ) : files.length === 0 ? (
              <div className="empty-state">
                <p>No files found in this location.</p>
              </div>
            ) : (
              <ul>
                {files.map((file) => (
                  <li
                    key={file.path}
                    className={`file-item ${
                      selectedFile?.path === file.path ? "selected" : ""
                    }`}
                    onClick={() => handleFileClick(file)}
                  >
                    {file.type === "folder" ? (
                      <Folder size={18} className="file-icon folder" />
                    ) : (
                      <File size={18} className="file-icon file" />
                    )}
                    <span className="file-name">{file.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Permissions section */}
        <div className="permissions-section">
          <h3>Permissions</h3>

          {!selectedFile ? (
            <div className="no-selection">
              <Shield size={48} className="no-selection-icon" />
              <p>Select a file to manage permissions</p>
            </div>
          ) : (
            <div className="permissions-form">
              <div className="selected-file-info">
                <h4>
                  {selectedFile.type === "folder" ? (
                    <Folder size={18} className="mr-2" />
                  ) : (
                    <File size={18} className="mr-2" />
                  )}
                  {selectedFile.name}
                </h4>
                <p className="file-path">{selectedFile.path}</p>

                {/* Permission Details */}
                {permissionDetails && (
                  <div className="permission-details">
                    <h5>Current Access Details:</h5>
                    <p
                      className={hasAccess ? "access-granted" : "access-denied"}
                    >
                      {hasAccess ? "Access Granted" : "Access Denied"} -{" "}
                      {permissionDetails.details}
                    </p>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={permissions.inheritParent}
                    onChange={(e) =>
                      handlePermissionChange("inheritParent", e.target.checked)
                    }
                  />
                  <span>Inherit permissions from parent folder</span>
                </label>
                <p className="field-hint">
                  When enabled, this item will also inherit all permissions from
                  its parent folders
                </p>
              </div>

              <div className="form-group">
                <label htmlFor="requiredRole">Required Role</label>
                <select
                  id="requiredRole"
                  value={permissions.requiredRole}
                  onChange={(e) =>
                    handlePermissionChange("requiredRole", e.target.value)
                  }
                  className="form-input"
                  disabled={isLoading}
                >
                  <option value="">No specific role required</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.name}>
                      {role.name}
                    </option>
                  ))}
                </select>
                <p className="field-hint">
                  Users must have this role or higher to access this{" "}
                  {selectedFile.type}
                </p>
              </div>

              <div className="form-group">
                <label htmlFor="allowedUsers">Allowed Users</label>
                <select
                  id="allowedUsers"
                  multiple
                  value={permissions.allowedUsers}
                  onChange={(e) =>
                    handlePermissionChange(
                      "allowedUsers",
                      Array.from(
                        e.target.selectedOptions,
                        (option) => option.value
                      )
                    )
                  }
                  className="form-input multi-select"
                  disabled={isLoading}
                >
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name} ({user.email})
                    </option>
                  ))}
                </select>
                <p className="field-hint">
                  Hold Ctrl (or Cmd) to select multiple users
                </p>
              </div>

              <div className="form-group">
                <label htmlFor="allowedGroups">Allowed Groups</label>
                <select
                  id="allowedGroups"
                  multiple
                  value={permissions.allowedGroups}
                  onChange={(e) =>
                    handlePermissionChange(
                      "allowedGroups",
                      Array.from(
                        e.target.selectedOptions,
                        (option) => option.value
                      )
                    )
                  }
                  className="form-input multi-select"
                  disabled={isLoading}
                >
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
                <p className="field-hint">
                  Hold Ctrl (or Cmd) to select multiple groups
                </p>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => setSelectedFile(null)}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="save-button"
                  onClick={savePermissions}
                  disabled={isSaving || isLoading}
                >
                  {isSaving ? (
                    <>
                      <Loader className="spinner" size={16} />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      <span>Save Permissions</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FilePermissionsManager;
