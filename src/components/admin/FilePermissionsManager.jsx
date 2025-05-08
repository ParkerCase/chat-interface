// src/components/admin/FilePermissionsManager.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import apiService from "@/services/apiService";
import { RedisCache } from "../../utils/RedisCache"; // Import Redis Cache
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
  Lock,
  FileQuestion,
} from "lucide-react";
import "./FilePermissionsManager.css";

// Cache key constants
const FILES_CACHE_KEY = "files:permissions:list";
const FILES_COUNT_CACHE_KEY = "files:permissions:count";
const FILE_CACHE_PREFIX = "files:permissions:file:";

const FilePermissionsManager = ({ currentUser }) => {
  const [files, setFiles] = useState([]);
  const [totalFiles, setTotalFiles] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [showOnlyRestricted, setShowOnlyRestricted] = useState(false);
  const [cacheEnabled, setCacheEnabled] = useState(true); // Cache control

  // Check if Redis cache is available
  const checkCacheAvailability = async () => {
    try {
      // Only try to use cache if RedisCache utility is loaded
      if (typeof RedisCache === "undefined" || !RedisCache || !RedisCache.get) {
        console.log("Redis cache not available - disabling cache");
        setCacheEnabled(false);
        return false;
      }

      // Test Redis cache connection
      const testResult = await RedisCache.get("cache_test");
      console.log(
        "Cache availability check:",
        testResult !== null ? "Available" : "Unavailable"
      );
      return true;
    } catch (e) {
      console.log("Redis cache test failed - disabling cache", e);
      setCacheEnabled(false);
      return false;
    }
  };

  // Load files on component mount
  useEffect(() => {
    // Check cache availability first
    checkCacheAvailability().then((isAvailable) => {
      setCacheEnabled(isAvailable);
      fetchFiles(isAvailable);
    });
  }, []);

  useEffect(() => {
    const fetchFileCount = async () => {
      try {
        // Try to get count from cache first if enabled
        if (cacheEnabled) {
          try {
            const cachedCount = await RedisCache.get(FILES_COUNT_CACHE_KEY);
            if (cachedCount !== null) {
              console.log("Using cached file count:", cachedCount);
              setTotalFiles(cachedCount);
              setIsLoading(false);

              // Still fetch fresh count in background
              fetchFreshCount();
              return;
            }
          } catch (cacheError) {
            console.warn("Cache error getting file count:", cacheError);
          }
        }

        // Fetch fresh count if no cache or cache disabled
        fetchFreshCount();
      } catch (error) {
        console.error("Error in fetchFileCount:", error);
        setTotalFiles(0);
        setIsLoading(false);
      }
    };

    // Function to fetch fresh count
    const fetchFreshCount = async () => {
      try {
        // Get actual file count from Supabase
        const { count, error } = await supabase.storage
          .from("documents")
          .list("", {
            limit: 1,
            sortBy: { column: "name", order: "asc" },
          });

        if (error) throw error;

        setTotalFiles(count || 0);

        // Cache the count if caching is enabled
        if (cacheEnabled) {
          try {
            await RedisCache.set(FILES_COUNT_CACHE_KEY, count || 0, 3600); // Cache for 1 hour
          } catch (cacheError) {
            console.warn("Error caching file count:", cacheError);
          }
        }
      } catch (error) {
        console.error("Error fetching file count:", error);
        // Fallback to API call if storage direct access fails
        try {
          const response = await apiService.storage.searchFiles("", {
            count: true,
          });
          if (response.data?.totalCount) {
            const count = response.data.totalCount;
            setTotalFiles(count);

            // Cache the count if caching is enabled
            if (cacheEnabled) {
              try {
                await RedisCache.set(FILES_COUNT_CACHE_KEY, count, 3600); // Cache for 1 hour
              } catch (cacheError) {
                console.warn("Error caching file count:", cacheError);
              }
            }
          }
        } catch (apiError) {
          console.error("API file count error:", apiError);
          setTotalFiles(0);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchFileCount();
  }, [cacheEnabled]);

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

  // Fetch files from Supabase with caching
  const fetchFiles = async (useCache = cacheEnabled) => {
    try {
      setLoading(true);
      setError(null);

      // Try to get from cache first if caching is enabled
      if (useCache) {
        try {
          const cachedFiles = await RedisCache.get(FILES_CACHE_KEY);
          if (cachedFiles && Array.isArray(cachedFiles)) {
            console.log(
              "Using cached files list:",
              cachedFiles.length,
              "files"
            );
            setFiles(cachedFiles);
            setLoading(false);

            // Still fetch fresh data in background
            fetchFreshFiles();
            return;
          }
        } catch (cacheError) {
          console.warn("Cache error getting files:", cacheError);
        }
      }

      // Fetch fresh data if cache is disabled or empty
      await fetchFreshFiles();
    } catch (err) {
      console.error("Error in fetchFiles:", err);
      setError(`Failed to load files: ${err.message}`);
      setLoading(false);
    }
  };

  // Function to fetch fresh files data
  const fetchFreshFiles = async () => {
    try {
      // Get documents from the documents table
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Process the files to extract more readable information
      const processedFiles = data.map((file) => {
        let fileType = "document";
        let title = "Untitled Document";
        let isRestricted = false;
        let visibleTo = ["super_admin", "admin", "user"];

        // Process file metadata
        try {
          // Try to extract title from various properties
          if (file.name) {
            title = file.name;
          } else if (file.path) {
            const pathParts = file.path.split("/");
            title = pathParts[pathParts.length - 1];
          } else if (file.metadata && file.metadata.fileName) {
            title = file.metadata.fileName;
          } else if (file.metadata && file.metadata.path) {
            const pathParts = file.metadata.path.split("/");
            title = pathParts[pathParts.length - 1];
          } else if (file.title) {
            title = file.title;
          }

          // Determine file type
          if (
            file.document_type === "image" ||
            (file.content &&
              typeof file.content === "string" &&
              file.content.includes("image")) ||
            (title && /\.(jpg|jpeg|png|gif|bmp|svg)$/i.test(title))
          ) {
            fileType = "image";
          }

          // Extract visibility settings
          if (file.metadata && file.metadata.visible_to) {
            if (typeof file.metadata.visible_to === "string") {
              try {
                visibleTo = JSON.parse(file.metadata.visible_to);
              } catch (e) {
                visibleTo = file.metadata.visible_to.split(",");
              }
            } else if (Array.isArray(file.metadata.visible_to)) {
              visibleTo = file.metadata.visible_to;
            }
          }

          // Check if file is restricted
          isRestricted = !visibleTo.includes("user");
        } catch (e) {
          console.warn(`Error processing file ${file.id}:`, e);
        }

        // Ensure the title isn't just the ID if we couldn't extract a proper name
        if (!title || title === "Untitled Document") {
          if (file.id.includes("_")) {
            // Try to extract a meaningful name from the ID
            const idParts = file.id.split("_");
            title =
              idParts[0].length > 3
                ? idParts[0]
                : `File ${file.id.substring(0, 8)}...`;
          } else {
            title = `File ${file.id.substring(0, 8)}...`;
          }
        }

        // Format ID for display - truncate long IDs
        const displayId =
          file.id.length > 12 ? `${file.id.substring(0, 10)}...` : file.id;

        return {
          id: file.id,
          displayId: displayId,
          title: title,
          fileType,
          createdAt: file.created_at,
          status: file.status || "Active",
          documentType: file.document_type,
          sourceType: file.source_type,
          visibleTo,
          isRestricted,
          rawMetadata: file.metadata || {},
        };
      });

      setFiles(processedFiles);

      // Cache the processed files if caching is enabled
      if (cacheEnabled) {
        try {
          await RedisCache.set(FILES_CACHE_KEY, processedFiles, 1800); // Cache for 30 minutes
        } catch (cacheError) {
          console.warn("Error caching files:", cacheError);
        }
      }
    } catch (err) {
      console.error("Error fetching fresh files:", err);
      setError(`Failed to load files: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Toggle file visibility with cache management
  const toggleFileVisibility = async (file) => {
    try {
      setLoading(true);

      // Determine new visibility settings
      let newVisibleTo = ["super_admin"]; // Super admin can always see

      // Toggle visibility to users and admins
      if (file.isRestricted) {
        // If currently restricted, make it visible to everyone
        newVisibleTo = ["super_admin", "admin", "user"];
      } else {
        // If not restricted, restrict to super admin only
        newVisibleTo = ["super_admin"];
      }

      // Update the metadata to include visibility settings
      let updatedMetadata = { ...file.rawMetadata };

      // Ensure metadata is an object
      if (typeof updatedMetadata === "string") {
        try {
          updatedMetadata = JSON.parse(updatedMetadata);
        } catch (e) {
          updatedMetadata = {};
        }
      }

      // If metadata is null or undefined, initialize as empty object
      if (!updatedMetadata) {
        updatedMetadata = {};
      }

      updatedMetadata.visible_to = newVisibleTo;

      // Update the document in Supabase
      const { error } = await supabase
        .from("documents")
        .update({ metadata: updatedMetadata })
        .eq("id", file.id);

      if (error) throw error;

      // Update the file in local state
      const updatedFiles = files.map((f) =>
        f.id === file.id
          ? {
              ...f,
              visibleTo: newVisibleTo,
              isRestricted: !f.isRestricted,
              rawMetadata: updatedMetadata,
            }
          : f
      );

      setFiles(updatedFiles);

      // Update cache if enabled
      if (cacheEnabled) {
        try {
          // Update the files cache
          await RedisCache.set(FILES_CACHE_KEY, updatedFiles, 1800);

          // Update the single file cache
          const fileCacheKey = `${FILE_CACHE_PREFIX}${file.id}`;
          const updatedFile = updatedFiles.find((f) => f.id === file.id);
          if (updatedFile) {
            await RedisCache.set(fileCacheKey, updatedFile, 1800);
          }
        } catch (cacheError) {
          console.warn(
            "Error updating cache after visibility toggle:",
            cacheError
          );
        }
      }

      setSuccess(`File visibility for "${file.title}" updated successfully`);
    } catch (err) {
      console.error("Error updating file visibility:", err);
      setError(`Failed to update file visibility: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Format date string
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    // Format to MM/DD/YYYY, HH:MM
    return (
      date.toLocaleDateString() +
      ", " +
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
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

  // Filter files based on search and filters
  const getFilteredFiles = () => {
    return files.filter((file) => {
      // Apply search filter
      const matchesSearch =
        searchQuery === "" ||
        file.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.id.includes(searchQuery);

      // Apply file type filter
      const matchesType = filterType === "all" || file.fileType === filterType;

      // Apply visibility filter
      const matchesVisibility = !showOnlyRestricted || file.isRestricted;

      return matchesSearch && matchesType && matchesVisibility;
    });
  };

  // Get filter count
  const getFilteredCount = () => {
    const filteredFiles = getFilteredFiles();
    return filteredFiles.length;
  };

  // Force refresh - clear cache and fetch fresh data
  const forceRefresh = async () => {
    try {
      setLoading(true);

      // Clear caches if caching is enabled
      if (cacheEnabled) {
        try {
          await RedisCache.delete(FILES_CACHE_KEY);
          await RedisCache.delete(FILES_COUNT_CACHE_KEY);
          console.log("Cache cleared for refresh");
        } catch (cacheError) {
          console.warn("Error clearing cache for refresh:", cacheError);
        }
      }

      // Fetch fresh data without using cache
      await fetchFiles(false);
    } catch (err) {
      console.error("Error refreshing data:", err);
      setError(`Failed to refresh: ${err.message}`);
    }
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
              <span style={{ marginBottom: "10px" }}>Show restricted only</span>
            </div>

            <button
              className="refresh-button"
              onClick={forceRefresh}
              disabled={loading}
              title="Refresh files"
            >
              <RefreshCw
                style={{ marginBottom: "0" }}
                size={16}
                className={loading ? "spinning" : ""}
              />
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
                {searchQuery || filterType !== "all" || showOnlyRestricted
                  ? "No files match your search criteria."
                  : "There are no files in the system yet."}
              </p>
              {(searchQuery || filterType !== "all" || showOnlyRestricted) && (
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
                              <span className="file-id" title={file.id}>
                                ID: {file.displayId}
                              </span>
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
                          <span
                            className={`status-badge ${file.status.toLowerCase()}`}
                          >
                            {file.status}
                          </span>
                        </td>
                        <td className="visibility-column">
                          <div className="visibility-tags">
                            {file.isRestricted ? (
                              <span className="visibility-tag restricted">
                                <Shield size={14} />
                                Admin Only
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
                                <span>Unrestrict</span>
                              </>
                            ) : (
                              <>
                                <Lock size={16} />
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
