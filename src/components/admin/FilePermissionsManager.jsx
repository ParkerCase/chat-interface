// src/components/admin/FilePermissionsManager.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import {
  Search,
  FileText,
  Folder,
  Lock,
  Unlock,
  Trash,
  Check,
  AlertCircle,
  Loader,
  Info,
  RefreshCw,
  FolderPlus,
  Upload,
  Download,
  Eye,
  EyeOff,
  Shield,
  X,
} from "lucide-react";
import "./FilePermissionsManager.css"; // We'll create this next

const FilePermissionsManager = ({ currentUser }) => {
  const [files, setFiles] = useState([]);
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [blockedFiles, setBlockedFiles] = useState([]);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [fileToBlock, setFileToBlock] = useState(null);
  const [showUnblockModal, setShowUnblockModal] = useState(false);
  const [fileToUnblock, setFileToUnblock] = useState(null);
  const [currentBucket, setCurrentBucket] = useState("documents");
  const [buckets, setBuckets] = useState([]);
  const [blockReason, setBlockReason] = useState("");

  // Predefined block reasons for quick selection
  const blockReasons = [
    "Contains sensitive information",
    "Personal identifiable information (PII)",
    "Confidential business data",
    "Outdated content",
    "Legal concerns",
    "Temporarily unavailable",
  ];

  useEffect(() => {
    fetchBuckets();
    fetchFiles();
    fetchBlockedFiles();
  }, [currentBucket]);

  useEffect(() => {
    // Apply search filter when search query changes
    if (searchQuery.trim() === "") {
      setFilteredFiles(files);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = files.filter(
        (file) =>
          file.name.toLowerCase().includes(query) ||
          file.path.toLowerCase().includes(query)
      );
      setFilteredFiles(filtered);
    }
  }, [searchQuery, files]);

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

  const fetchBuckets = async () => {
    try {
      const { data, error } = await supabase.storage.listBuckets();

      if (error) throw error;

      if (data && data.length > 0) {
        setBuckets(data);
        // Set current bucket if it's not in the list
        if (!data.find((b) => b.name === currentBucket)) {
          setCurrentBucket(data[0].name);
        }
      }
    } catch (error) {
      console.error("Error fetching buckets:", error);
      setError(`Failed to load storage buckets: ${error.message}`);
    }
  };

  const fetchFiles = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // List files in the bucket and path (recursively)
      const fileList = await listFilesRecursively(currentBucket, "");
      setFiles(fileList);
      setFilteredFiles(fileList);
    } catch (error) {
      console.error("Error fetching files:", error);
      setError(`Failed to load files: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBlockedFiles = async () => {
    try {
      // Fetch blocked files from the excluded_files table
      const { data, error } = await supabase.from("excluded_files").select("*");

      if (error) throw error;

      if (data) {
        setBlockedFiles(data);
      }
    } catch (error) {
      console.error("Error fetching blocked files:", error);
      // Non-critical error, don't show to user
    }
  };

  // Recursive function to list all files in a bucket
  const listFilesRecursively = async (bucket, path, files = []) => {
    try {
      const { data, error } = await supabase.storage.from(bucket).list(path);

      if (error) throw error;

      if (data) {
        // Process each item
        for (const item of data) {
          const itemPath = path ? `${path}/${item.name}` : item.name;

          if (!item.metadata) {
            // It's a folder, recursively list its contents
            await listFilesRecursively(bucket, itemPath, files);
          } else {
            // It's a file, add it to the list
            const isBlocked = blockedFiles.some(
              (blockedFile) =>
                blockedFile.bucket === bucket && blockedFile.path === itemPath
            );

            files.push({
              name: item.name,
              path: itemPath,
              fullPath: `${bucket}/${itemPath}`,
              size: item.metadata?.size || 0,
              lastModified: item.metadata?.lastModified,
              type: item.metadata?.mimetype || getFileTypeFromName(item.name),
              bucket: bucket,
              isBlocked: isBlocked,
              blockReason: isBlocked
                ? blockedFiles.find(
                    (bf) => bf.bucket === bucket && bf.path === itemPath
                  )?.reason
                : null,
            });
          }
        }
      }

      return files;
    } catch (error) {
      console.error("Error in recursive file listing:", error);
      throw error;
    }
  };

  const getFileTypeFromName = (filename) => {
    const extension = filename.split(".").pop().toLowerCase();
    const mimeTypes = {
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      txt: "text/plain",
      csv: "text/csv",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
    };

    return mimeTypes[extension] || "application/octet-stream";
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "Unknown";
    return new Date(timestamp).toLocaleString();
  };

  const handleFileSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleBlockFile = async () => {
    if (!fileToBlock) return;

    try {
      setIsLoading(true);

      // Add file to excluded_files table
      const { error } = await supabase.from("excluded_files").insert({
        bucket: fileToBlock.bucket,
        path: fileToBlock.path,
        excluded_by: currentUser.id,
        excluded_at: new Date().toISOString(),
        reason: blockReason || "No reason provided",
      });

      if (error) throw error;

      // Update local state
      setBlockedFiles((prev) => [
        ...prev,
        {
          id: Date.now(), // Temporary ID until we refresh
          bucket: fileToBlock.bucket,
          path: fileToBlock.path,
          excluded_by: currentUser.id,
          excluded_at: new Date().toISOString(),
          reason: blockReason || "No reason provided",
        },
      ]);

      // Update file in the files list
      setFiles((prev) =>
        prev.map((file) => {
          if (file.fullPath === fileToBlock.fullPath) {
            return {
              ...file,
              isBlocked: true,
              blockReason: blockReason || "No reason provided",
            };
          }
          return file;
        })
      );

      setFilteredFiles((prev) =>
        prev.map((file) => {
          if (file.fullPath === fileToBlock.fullPath) {
            return {
              ...file,
              isBlocked: true,
              blockReason: blockReason || "No reason provided",
            };
          }
          return file;
        })
      );

      setSuccess(`File "${fileToBlock.name}" blocked from chat results`);
      setShowBlockModal(false);
      setFileToBlock(null);
      setBlockReason("");
    } catch (error) {
      console.error("Error blocking file:", error);
      setError(`Failed to block file: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnblockFile = async () => {
    if (!fileToUnblock) return;

    try {
      setIsLoading(true);

      // Remove file from excluded_files table
      const { error } = await supabase
        .from("excluded_files")
        .delete()
        .eq("bucket", fileToUnblock.bucket)
        .eq("path", fileToUnblock.path);

      if (error) throw error;

      // Update local state
      setBlockedFiles((prev) =>
        prev.filter(
          (file) =>
            !(
              file.bucket === fileToUnblock.bucket &&
              file.path === fileToUnblock.path
            )
        )
      );

      // Update file in the files list
      setFiles((prev) =>
        prev.map((file) => {
          if (file.fullPath === fileToUnblock.fullPath) {
            return {
              ...file,
              isBlocked: false,
              blockReason: null,
            };
          }
          return file;
        })
      );

      setFilteredFiles((prev) =>
        prev.map((file) => {
          if (file.fullPath === fileToUnblock.fullPath) {
            return {
              ...file,
              isBlocked: false,
              blockReason: null,
            };
          }
          return file;
        })
      );

      setSuccess(
        `File "${fileToUnblock.name}" unblocked and restored to chat results`
      );
      setShowUnblockModal(false);
      setFileToUnblock(null);
    } catch (error) {
      console.error("Error unblocking file:", error);
      setError(`Failed to unblock file: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="file-permissions-container">
      <div className="admin-section">
        <h2 className="admin-section-title">File Permissions Management</h2>
        <p className="admin-section-subtitle">
          Control which files are accessible in chat results. Blocked files
          won't be processed by the chat AI.
        </p>

        {/* Success message */}
        {success && (
          <div className="success-message">
            <Check className="success-icon" size={18} />
            <p>{success}</p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="error-message">
            <AlertCircle className="error-icon" size={18} />
            <p>{error}</p>
          </div>
        )}

        <div className="permissions-controls">
          <div className="search-container">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={handleFileSearch}
              className="search-input"
            />
            {searchQuery && (
              <button
                className="clear-search-button"
                onClick={() => setSearchQuery("")}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="bucket-selector">
            <label htmlFor="bucket-select">Storage Bucket:</label>
            <select
              id="bucket-select"
              value={currentBucket}
              onChange={(e) => setCurrentBucket(e.target.value)}
              className="bucket-select"
            >
              {buckets.map((bucket) => (
                <option key={bucket.id} value={bucket.name}>
                  {bucket.name}
                </option>
              ))}
            </select>
          </div>

          <button
            className="refresh-button"
            onClick={fetchFiles}
            disabled={isLoading}
          >
            <RefreshCw size={16} className={isLoading ? "spinning" : ""} />
            Refresh
          </button>
        </div>

        <div className="note-box">
          <Info size={16} />
          <p>
            When a file is blocked, it will not be accessible to the AI
            assistant during chat sessions. This is useful for sensitive
            documents or files containing private information.
          </p>
        </div>

        {isLoading ? (
          <div className="loading-container">
            <Loader size={32} className="spinning" />
            <p>Loading files...</p>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="empty-state">
            <FileText size={48} />
            <h3>No Files Found</h3>
            <p>
              No files match your search query or the selected bucket is empty.
            </p>
          </div>
        ) : (
          <div className="files-table-container">
            <table className="files-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Path</th>
                  <th>Size</th>
                  <th>Last Modified</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map((file) => (
                  <tr
                    key={file.fullPath}
                    className={file.isBlocked ? "blocked" : ""}
                  >
                    <td className="file-name-cell">
                      <div className="file-name">
                        <FileText size={16} />
                        <span>{file.name}</span>
                      </div>
                    </td>
                    <td className="file-path-cell">{file.path}</td>
                    <td>{formatFileSize(file.size)}</td>
                    <td>{formatDate(file.lastModified)}</td>
                    <td>
                      {file.isBlocked ? (
                        <div className="status-badge blocked">
                          <Lock size={14} />
                          <span>Blocked</span>
                        </div>
                      ) : (
                        <div className="status-badge accessible">
                          <Unlock size={14} />
                          <span>Accessible</span>
                        </div>
                      )}
                    </td>
                    <td>
                      {file.isBlocked ? (
                        <button
                          className="unblock-button"
                          onClick={() => {
                            setFileToUnblock(file);
                            setShowUnblockModal(true);
                          }}
                          title="Unblock file"
                        >
                          <Unlock size={14} />
                          <span>Unblock</span>
                        </button>
                      ) : (
                        <button
                          className="block-button"
                          onClick={() => {
                            setFileToBlock(file);
                            setShowBlockModal(true);
                          }}
                          title="Block file"
                        >
                          <Lock size={14} />
                          <span>Block</span>
                        </button>
                      )}

                      <button
                        className="info-button"
                        onClick={() => {
                          if (file.isBlocked) {
                            alert(
                              `Block reason: ${
                                file.blockReason || "No reason provided"
                              }`
                            );
                          }
                        }}
                        title="View details"
                        disabled={!file.isBlocked}
                      >
                        <Info size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Block File Modal */}
      {showBlockModal && fileToBlock && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3>Block File from Chat Results</h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowBlockModal(false);
                  setFileToBlock(null);
                  setBlockReason("");
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to block this file from being used in chat
                results?
              </p>

              <div className="file-info">
                <div className="file-info-item">
                  <strong>File:</strong> {fileToBlock.name}
                </div>
                <div className="file-info-item">
                  <strong>Path:</strong> {fileToBlock.path}
                </div>
                <div className="file-info-item">
                  <strong>Size:</strong> {formatFileSize(fileToBlock.size)}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="blockReason">
                  Reason for blocking (optional):
                </label>
                <textarea
                  id="blockReason"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  className="form-textarea"
                  placeholder="Provide a reason for blocking this file..."
                  rows={3}
                ></textarea>
              </div>

              <div className="quick-reasons">
                <label>Quick select:</label>
                <div className="reason-buttons">
                  {blockReasons.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      className="reason-button"
                      onClick={() => setBlockReason(reason)}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>

              <div className="warning-note">
                <AlertCircle size={14} />
                <p>
                  Blocking this file will prevent it from being used by the AI
                  in chat responses.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="cancel-button"
                onClick={() => {
                  setShowBlockModal(false);
                  setFileToBlock(null);
                  setBlockReason("");
                }}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                className="block-button"
                onClick={handleBlockFile}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader size={14} className="spinning" />
                    Blocking...
                  </>
                ) : (
                  <>
                    <Lock size={14} />
                    Block File
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unblock File Modal */}
      {showUnblockModal && fileToUnblock && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3>Unblock File</h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowUnblockModal(false);
                  setFileToUnblock(null);
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to unblock this file and make it available
                in chat results?
              </p>

              <div className="file-info">
                <div className="file-info-item">
                  <strong>File:</strong> {fileToUnblock.name}
                </div>
                <div className="file-info-item">
                  <strong>Path:</strong> {fileToUnblock.path}
                </div>
                <div className="file-info-item">
                  <strong>Reason Blocked:</strong>{" "}
                  {fileToUnblock.blockReason || "No reason provided"}
                </div>
              </div>

              <div className="info-note">
                <Info size={14} />
                <p>
                  Unblocking this file will make it accessible to the AI
                  assistant during chat sessions.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="cancel-button"
                onClick={() => {
                  setShowUnblockModal(false);
                  setFileToUnblock(null);
                }}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                className="unblock-button"
                onClick={handleUnblockFile}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader size={14} className="spinning" />
                    Unblocking...
                  </>
                ) : (
                  <>
                    <Unlock size={14} />
                    Unblock File
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilePermissionsManager;
