// src/components/admin/FilePermissionsManager.jsx
import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import apiService from "../../services/apiService";
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

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch roles, users, and groups
        const [rolesResponse, usersResponse, groupsResponse] =
          await Promise.all([
            apiService.roles.getAll(),
            apiService.users.getAll(),
            apiService.groups.getAll(),
          ]);

        if (rolesResponse.data?.success) {
          setRoles(rolesResponse.data.roles || []);
        }

        if (usersResponse.data?.success) {
          setUsers(usersResponse.data.users || []);
        }

        if (groupsResponse.data?.success) {
          setGroups(groupsResponse.data.groups || []);
        }

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

      const response = await apiService.storage.getFiles(path);

      if (response.data?.success) {
        setFiles(response.data.files || []);
        setCurrentPath(path);
      } else {
        throw new Error(response.data?.error || "Failed to load files");
      }
    } catch (err) {
      console.error("Error loading files:", err);
      setError(`Failed to load files for path: ${path}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Load permissions for a selected file
  const loadPermissions = async (file) => {
    try {
      setIsLoading(true);
      setSelectedFile(file);

      const response = await apiService.permissions.getFilePermissions(
        file.path
      );

      if (response.data?.success) {
        setPermissions({
          requiredRole: response.data.permissions?.requiredRole || "",
          allowedUsers: response.data.permissions?.allowedUsers || [],
          allowedGroups: response.data.permissions?.allowedGroups || [],
          inheritParent: response.data.permissions?.inheritParent !== false,
        });
      } else {
        // If no specific permissions, set defaults
        setPermissions({
          requiredRole: "",
          allowedUsers: [],
          allowedGroups: [],
          inheritParent: true,
        });
      }
    } catch (err) {
      console.error("Error loading permissions:", err);
      setError(`Failed to load permissions for: ${file.name}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Search files by name
  const searchFiles = useCallback(async () => {
    if (!searchQuery.trim()) return;

    try {
      setIsSearching(true);

      const response = await apiService.storage.searchFiles(searchQuery);

      if (response.data?.success) {
        setFiles(response.data.files || []);
      } else {
        throw new Error(response.data?.error || "Search failed");
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

  // Save permissions
  const savePermissions = async () => {
    if (!selectedFile) return;

    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);

      const response = await apiService.permissions.setFilePermissions(
        selectedFile.path,
        permissions
      );

      if (response.data?.success) {
        setSuccess(`Permissions updated for: ${selectedFile.name}`);

        // Clear success message after 3 seconds
        setTimeout(() => {
          setSuccess(null);
        }, 3000);
      } else {
        throw new Error(response.data?.error || "Failed to update permissions");
      }
    } catch (err) {
      console.error("Error saving permissions:", err);
      setError(`Failed to save permissions: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
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
                    <option key={role.id} value={role.id}>
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
                      {user.name} ({user.email})
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
