// src/components/admin/FilePermissionsManager.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import {
  Search,
  FileText,
  Image,
  File,
  EyeOff,
  Eye,
  Shield,
  CheckCircle,
  AlertCircle,
  X,
  Loader,
  RefreshCw,
  Filter,
  FileQuestion,
} from "lucide-react";
import "./FilePermissionsManager.css";

const FilePermissionsManager = ({ currentUser }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [showOnlyRestricted, setShowOnlyRestricted] = useState(false);

  // Load files on component mount
  useEffect(() => {
    fetchFiles();
  }, []);

  // Clear success message after 5 seconds
  useEffect(() => {
    let timeout;
    if (success) {
      timeout = setTimeout(() => {
        setSuccess(null);
      }, 5000);
    }
    return () => clearTimeout(timeout);
  }, [success]);

  // Fetch files from Supabase
  const fetchFiles = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get documents from the documents table
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Process the files to extract more readable information
      const processedFiles = data.map((file) => {
        let content = {};
        let fileType = "document";
        let title = file.id;
        let thumbnailUrl = null;

        // Try to parse the content JSON
        try {
          if (file.content) {
            content =
              typeof file.content === "object"
                ? file.content
                : JSON.parse(file.content);
          }

          // Determine file type
          if (
            file.document_type === "image" ||
            (content.analysis && content.analysis.type === "image")
          ) {
            fileType = "image";
            // Extract potential image path if available
            if (content.metadata && content.metadata.path) {
              title = content.metadata.path.split("/").pop() || file.id;
            }
          } else {
            fileType = "document";
            // Extract title from metadata if available
            if (content.metadata && content.metadata.fileName) {
              title = content.metadata.fileName;
            }
          }
        } catch (e) {
          console.warn("Error processing file content:", e);
        }

        // Extract visibility settings
        let visibleTo = ["super_admin", "admin", "user"];
        try {
          if (file.metadata && file.metadata.visible_to) {
            visibleTo = file.metadata.visible_to;
          }
        } catch (e) {
          console.warn("Error processing visibility settings:", e);
        }

        // Check if this file is restricted (not visible to everyone)
        const isRestricted =
          !visibleTo.includes("user") || !visibleTo.includes("admin");

        return {
          id: file.id,
          title: title || `File ${file.id}`,
          fileType,
          createdAt: file.created_at,
          status: file.status,
          documentType: file.document_type,
          sourceType: file.source_type,
          visibleTo,
          isRestricted,
          content,
          rawContent: file.content,
          rawMetadata: file.metadata,
        };
      });

      setFiles(processedFiles);
    } catch (err) {
      console.error("Error fetching files:", err);
      setError(`Failed to load files: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Filter files based on search and filters
  const getFilteredFiles = () => {
    return files.filter((file) => {
      // Apply search filter
      const matchesSearch =
        searchQuery === "" ||
        file.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.id.toString().includes(searchQuery);

      // Apply file type filter
      const matchesType = filterType === "all" || file.fileType === filterType;

      // Apply visibility filter
      const matchesVisibility = !showOnlyRestricted || file.isRestricted;

      return matchesSearch && matchesType && matchesVisibility;
    });
  };

  // Toggle file visibility for admin and basic users
  const toggleFileVisibility = async (file) => {
    try {
      setLoading(true);

      // Determine new visibility settings
      const currentVisibleTo = file.visibleTo || [
        "super_admin",
        "admin",
        "user",
      ];
      let newVisibleTo = ["super_admin"]; // Super admin can always see

      // If currently restricted, make it visible to everyone
      if (file.isRestricted) {
        newVisibleTo = ["super_admin", "admin", "user"];
      }
      // If not restricted, restrict to super admin only
      else {
        newVisibleTo = ["super_admin"];
      }

      // Update the metadata to include visibility settings
      let updatedMetadata = file.rawMetadata || {};
      if (typeof updatedMetadata === "string") {
        try {
          updatedMetadata = JSON.parse(updatedMetadata);
        } catch (e) {
          updatedMetadata = {};
        }
      }

      updatedMetadata.visible_to = newVisibleTo;

      // Update the document in Supabase
      const { error } = await supabase
        .from("documents")
        .update({ metadata: updatedMetadata })
        .eq("id", file.id);

      if (error) throw error;

      // Update the file in local state
      setFiles((prevFiles) =>
        prevFiles.map((f) =>
          f.id === file.id
            ? {
                ...f,
                visibleTo: newVisibleTo,
                isRestricted: !f.isRestricted,
              }
            : f
        )
      );

      setSuccess(`File visibility updated successfully`);
    } catch (err) {
      console.error("Error updating file visibility:", err);
      setError(`Failed to update file visibility: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Format date string
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  // Get file icon based on type
  const getFileIcon = (fileType) => {
    switch (fileType) {
      case "image":
        return <Image size={20} />;
      case "document":
        return <FileText size={20} />;
      default:
        return <File size={20} />;
    }
  };

  // Get filter count
  const getFilteredCount = () => {
    const filteredFiles = getFilteredFiles();
    return filteredFiles.length;
  };

  return (
    <div className="file-permissions-manager">
      <div className="admin-section">
        <h2 className="admin-section-title">File Permissions Manager</h2>
        <p className="section-description">
          Control which files are visible to different user roles. Files marked
          as restricted will only be visible to Super Admin users and will not
          appear in search results for other users.
        </p>

        {/* Success message */}
        {success && (
          <div className="success-message">
            <CheckCircle className="success-icon" size={18} />
            <p>{success}</p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="error-message">
            <AlertCircle className="error-icon" size={18} />
            <p>{error}</p>
            <button className="dismiss-button" onClick={() => setError(null)}>
              <X size={16} />
            </button>
          </div>
        )}

        {/* Search and filters */}
        <div className="files-toolbar">
          <div className="search-container">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search files by title or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            {searchQuery && (
              <button
                className="clear-search-button"
                onClick={() => setSearchQuery("")}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="filter-controls">
            <div className="filter-group">
              <label>Type:</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Files</option>
                <option value="document">Documents</option>
                <option value="image">Images</option>
              </select>
            </div>

            <div className="filter-toggle">
              <label className="switch">
                <input
                  type="checkbox"
                  checked={showOnlyRestricted}
                  onChange={() => setShowOnlyRestricted(!showOnlyRestricted)}
                />
                <span className="slider"></span>
              </label>
              <span>Show restricted only</span>
            </div>

            <button
              className="refresh-button"
              onClick={fetchFiles}
              disabled={loading}
              title="Refresh files"
            >
              <RefreshCw size={16} className={loading ? "spinning" : ""} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Files list */}
        <div className="files-container">
          {loading && files.length === 0 ? (
            <div className="loading-state">
              <Loader size={32} className="spinning" />
              <p>Loading files...</p>
            </div>
          ) : getFilteredFiles().length === 0 ? (
            <div className="empty-state">
              <FileQuestion size={48} />
              <h3>No files found</h3>
              <p>
                {searchQuery
                  ? "No files match your search criteria."
                  : "There are no files in the system yet."}
              </p>
              {searchQuery && (
                <button
                  className="clear-filters-button"
                  onClick={() => {
                    setSearchQuery("");
                    setFilterType("all");
                    setShowOnlyRestricted(false);
                  }}
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="files-count">
                Showing {getFilteredCount()} of {files.length} files
              </div>

              <div className="files-table-container">
                <table className="files-table">
                  <thead>
                    <tr>
                      <th className="file-column">File</th>
                      <th className="type-column">Type</th>
                      <th className="date-column">Created</th>
                      <th className="status-column">Status</th>
                      <th className="visibility-column">Visibility</th>
                      <th className="actions-column">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredFiles().map((file) => (
                      <tr
                        key={file.id}
                        className={file.isRestricted ? "restricted-file" : ""}
                      >
                        <td className="file-column">
                          <div className="file-info">
                            {getFileIcon(file.fileType)}
                            <div className="file-name-container">
                              <span className="file-name" title={file.title}>
                                {file.title}
                              </span>
                              <span className="file-id">ID: {file.id}</span>
                            </div>
                          </div>
                        </td>
                        <td className="type-column">
                          <span className="file-type-badge">
                            {file.fileType === "image" ? "Image" : "Document"}
                          </span>
                        </td>
                        <td className="date-column">
                          {formatDate(file.createdAt)}
                        </td>
                        <td className="status-column">
                          <span className={`status-badge ${file.status}`}>
                            {file.status}
                          </span>
                        </td>
                        <td className="visibility-column">
                          <div className="visibility-tags">
                            {file.isRestricted ? (
                              <span className="visibility-tag restricted">
                                <Shield size={14} />
                                Super Admin Only
                              </span>
                            ) : (
                              <span className="visibility-tag all-users">
                                <Eye size={14} />
                                All Users
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="actions-column">
                          <button
                            className="visibility-toggle-button"
                            onClick={() => toggleFileVisibility(file)}
                            disabled={loading}
                            title={
                              file.isRestricted
                                ? "Make visible to all users"
                                : "Restrict to Super Admin only"
                            }
                          >
                            {file.isRestricted ? (
                              <>
                                <Eye size={16} />
                                <span>Make Visible</span>
                              </>
                            ) : (
                              <>
                                <EyeOff size={16} />
                                <span>Restrict</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilePermissionsManager;
