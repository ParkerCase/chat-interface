// src/components/storage/FileUploadDropzone.jsx
import React, { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { supabase } from "../../lib/supabase";
import { SupabaseAnalytics } from "../../utils/SupabaseAnalyticsIntegration";
import documentProcessor from "../../utils/DocumentProcessor";
import {
  Upload,
  File,
  FileText,
  Image,
  Film,
  Archive,
  Music,
  Code,
  Database,
  X,
  CheckCircle,
  AlertCircle,
  Loader,
} from "lucide-react";
import "./FileUploadDropzone.css";

const FileUploadDropzone = ({
  bucket = "documents",
  folder = "",
  maxFiles = 10,
  maxSize = 50 * 1024 * 1024, // 50MB default
  acceptedFileTypes = undefined,
  onUploadComplete = () => {},
  onUploadError = () => {},
  processForKnowledgeBase = false, // New option to process documents
}) => {
  const [files, setFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadStatus, setUploadStatus] = useState({});
  const [overallStatus, setOverallStatus] = useState("idle"); // idle, uploading, complete, error
  const [errorMessage, setErrorMessage] = useState("");
  const [storageSettings, setStorageSettings] = useState(null);
  const [isProcessorInitialized, setIsProcessorInitialized] = useState(false);

  // Initialize document processor and get storage settings
  useEffect(() => {
    const initializeProcessor = async () => {
      try {
        await documentProcessor.initialize();
        setStorageSettings(documentProcessor.settings);
        setIsProcessorInitialized(true);
      } catch (error) {
        console.error("Failed to initialize document processor:", error);
        setErrorMessage("Error loading storage settings. Using defaults.");
      }
    };

    initializeProcessor();
  }, []);

  // Update maxSize and acceptedFileTypes based on storage settings if they're provided
  useEffect(() => {
    if (storageSettings) {
      if (!maxSize) {
        const settingsMaxSize = storageSettings.maxFileSize * 1024 * 1024; // Convert MB to bytes
        setMaxFileSize(settingsMaxSize);
      }
      if (!acceptedFileTypes && storageSettings.acceptedFileTypes) {
        setAcceptedTypes(
          storageSettings.acceptedFileTypes
            .split(",")
            .map((type) => `.${type.trim()}`)
        );
      }
    }
  }, [storageSettings, maxSize, acceptedFileTypes]);

  // Function to set max file size
  const [maxFileSize, setMaxFileSize] = useState(maxSize);
  // Function to set accepted file types
  const [acceptedTypes, setAcceptedTypes] = useState(acceptedFileTypes);

  // Define file type icons mapping
  const fileTypeIcons = {
    pdf: <FileText size={24} />,
    doc: <FileText size={24} />,
    docx: <FileText size={24} />,
    txt: <FileText size={24} />,
    jpg: <Image size={24} />,
    jpeg: <Image size={24} />,
    png: <Image size={24} />,
    gif: <Image size={24} />,
    svg: <Image size={24} />,
    mp4: <Film size={24} />,
    mov: <Film size={24} />,
    avi: <Film size={24} />,
    mp3: <Music size={24} />,
    wav: <Music size={24} />,
    zip: <Archive size={24} />,
    rar: <Archive size={24} />,
    js: <Code size={24} />,
    jsx: <Code size={24} />,
    css: <Code size={24} />,
    html: <Code size={24} />,
    csv: <Database size={24} />,
    xls: <Database size={24} />,
    xlsx: <Database size={24} />,
    default: <File size={24} />,
  };

  // Function to get file icon based on extension
  const getFileIcon = (fileName) => {
    const extension = fileName.split(".").pop().toLowerCase();
    return fileTypeIcons[extension] || fileTypeIcons["default"];
  };

  // Function to format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  /**
   * Normalize file object to ensure consistent structure
   * @param {Object} file - File object to normalize
   * @returns {Object} - Normalized file object
   */
  const normalizeFileObject = (file, additionalData = {}) => {
    return {
      // Ensure core properties are always present
      name:
        file.name || additionalData.path?.split("/").pop() || "Unknown File",
      size: file.size || 0,
      type:
        file.type ||
        additionalData.metadata?.fileType ||
        "application/octet-stream",

      // Add path information if available
      path: additionalData.path || file.path || null,

      // Add any additional properties from the original file and extra data
      ...file,
      ...additionalData,

      // Add timestamp for display purposes
      uploadedAt: new Date().toISOString(),
    };
  };

  // Get the actual accepted file types to display
  const getAcceptedFileTypesForDisplay = () => {
    if (acceptedTypes) {
      if (typeof acceptedTypes === "string") {
        return acceptedTypes;
      } else if (Array.isArray(acceptedTypes)) {
        return acceptedTypes.join(", ");
      } else if (typeof acceptedTypes === "object") {
        return Object.keys(acceptedTypes).join(", ");
      }
    }
    return storageSettings?.acceptedFileTypes || "all files";
  };

  // Handle file drops
  const onDrop = useCallback(
    (acceptedFiles) => {
      // Reset states when new files are dropped
      setErrorMessage("");
      setOverallStatus("idle");

      const actualMaxSize = maxFileSize || maxSize;

      // Filter out files that exceed max size
      const validFiles = acceptedFiles.filter(
        (file) => file.size <= actualMaxSize
      );
      const invalidFiles = acceptedFiles.filter(
        (file) => file.size > actualMaxSize
      );

      if (invalidFiles.length > 0) {
        setErrorMessage(
          `${
            invalidFiles.length
          } file(s) exceed the maximum size limit of ${formatFileSize(
            actualMaxSize
          )}`
        );
      }

      // Use DocumentProcessor to validate file types if we're processing for knowledge base
      if (processForKnowledgeBase && isProcessorInitialized) {
        const invalidTypeFiles = validFiles.filter((file) => {
          const validation = documentProcessor.validateFile(file);
          return !validation.valid;
        });

        if (invalidTypeFiles.length > 0) {
          setErrorMessage(
            (prev) =>
              prev +
              (prev ? " Also, " : "") +
              `${invalidTypeFiles.length} file(s) have unsupported file types. Accepted types: ${storageSettings.acceptedFileTypes}`
          );

          // Remove invalid type files
          const validTypeFiles = validFiles.filter((file) => {
            const validation = documentProcessor.validateFile(file);
            return validation.valid;
          });

          // Combine with existing files, but don't exceed maxFiles
          setFiles((prevFiles) => {
            const newFiles = [...prevFiles, ...validTypeFiles].slice(
              0,
              maxFiles
            );
            return newFiles;
          });

          return;
        }
      }

      // Combine with existing files, but don't exceed maxFiles
      setFiles((prevFiles) => {
        const newFiles = [...prevFiles, ...validFiles].slice(0, maxFiles);
        return newFiles;
      });
    },
    [
      maxFileSize,
      maxSize,
      maxFiles,
      processForKnowledgeBase,
      isProcessorInitialized,
      storageSettings,
    ]
  );

  // Configure dropzone
  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragAccept,
    isDragReject,
  } = useDropzone({
    onDrop,
    maxFiles,
    maxSize: maxFileSize || maxSize,
    accept: acceptedTypes,
  });

  // Remove a file from the list
  const removeFile = (index) => {
    setFiles((prevFiles) => prevFiles.filter((_, i) => i !== index));

    // Also clean up progress and status for this file
    setUploadProgress((prev) => {
      const newProgress = { ...prev };
      delete newProgress[index];
      return newProgress;
    });

    setUploadStatus((prev) => {
      const newStatus = { ...prev };
      delete newStatus[index];
      return newStatus;
    });
  };

  // Upload files to Supabase Storage
  const uploadFiles = async () => {
    if (files.length === 0) return;

    setOverallStatus("uploading");
    setErrorMessage("");
    let hasErrors = false;
    const successfulFiles = [];

    for (let i = 0; i < files.length; i++) {
      // Skip files that have already been uploaded successfully
      if (uploadStatus[i] === "success") {
        successfulFiles.push(files[i]);
        continue;
      }

      const file = files[i];

      try {
        // Start upload and track progress
        setUploadStatus((prev) => ({ ...prev, [i]: "uploading" }));
        setUploadProgress((prev) => ({ ...prev, [i]: 0 }));

        // Get user ID for tracking uploads
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const userId = user?.id;

        if (processForKnowledgeBase && isProcessorInitialized) {
          // Process and upload file using DocumentProcessor
          setUploadProgress((prev) => ({ ...prev, [i]: 10 })); // Show some initial progress

          // When using the DocumentProcessor, it already handles versioning correctly
          const uploadResult = await documentProcessor.processAndUploadDocument(
            file,
            bucket,
            { userId }
          );

          if (!uploadResult.success) {
            throw new Error(uploadResult.error || "Failed to process document");
          }

          // Update progress to 100% - consider it a success even if DB insert fails
          setUploadProgress((prev) => ({ ...prev, [i]: 100 }));
          setUploadStatus((prev) => ({ ...prev, [i]: "success" }));

          // Add the file to successful files list even if DB had issues
          successfulFiles.push(
            normalizeFileObject(file, {
              path: uploadResult.filePath,
              metadata: uploadResult.metadata,
              version: uploadResult.version,
            })
          );

          // Log warning if database insert failed but file upload succeeded
          if (uploadResult.databaseSuccess === false) {
            console.warn(
              `File ${
                file.name
              } was uploaded successfully but database record creation failed. Error: ${
                uploadResult.databaseError || "Unknown database error"
              }`
            );
          }

          // Track successful upload event
          SupabaseAnalytics.trackEvent("document_processed", {
            filename: file.name,
            filetype: file.name.split(".").pop() || "unknown",
            filesize: file.size,
            bucket: bucket,
            folder: folder || "root",
            version: uploadResult.version,
          });

          // After successful upload (DocumentProcessor branch)
          if (uploadResult.success) {
            try {
              await supabase.from("documents").insert({
                name: file.name,
                type:
                  file.type ||
                  uploadResult.metadata?.fileType ||
                  "application/octet-stream",
                size: file.size,
                storage_path: uploadResult.filePath,
                url: uploadResult.metadata?.publicUrl || null,
                uploaded_by: userId,
                uploaded_at: new Date().toISOString(),
                // Add more fields as needed
              });
            } catch (err) {
              console.error("Failed to insert document metadata:", err);
            }
          }
        } else {
          // Regular file upload logic (not changed)
          // For regular uploads (not using DocumentProcessor)
          // We need to handle versioning manually

          let filePath = folder ? `${folder}/${file.name}` : file.name;

          // Check if the file already exists and versioning is needed
          if (storageSettings?.enableVersioning) {
            try {
              // Check if file exists by attempting to get its URL (will throw if not found)
              const { data } = await supabase.storage
                .from(bucket)
                .getPublicUrl(filePath);

              if (data) {
                // File exists, need to create a versioned filename
                const timestamp = Date.now();
                const fileExt = file.name.split(".").pop();
                const baseName = file.name.substring(
                  0,
                  file.name.length - fileExt.length - 1
                );
                filePath = folder
                  ? `${folder}/${baseName}_v${timestamp}.${fileExt}`
                  : `${baseName}_v${timestamp}.${fileExt}`;
              }
            } catch (err) {
              // File doesn't exist, use the original path
              console.log("File doesn't exist yet, using original path");
            }
          }

          // Regular file upload to Supabase Storage
          const { data, error } = await supabase.storage
            .from(bucket)
            .upload(filePath, file, {
              cacheControl: "3600",
              upsert: !storageSettings?.enableVersioning, // Only upsert if versioning is disabled
              onUploadProgress: (progress) => {
                const progressPercent = Math.round(
                  (progress.loaded / progress.total) * 100
                );
                setUploadProgress((prev) => ({
                  ...prev,
                  [i]: progressPercent,
                }));
              },
            });

          if (error) {
            throw error;
          }

          setUploadStatus((prev) => ({ ...prev, [i]: "success" }));
          successfulFiles.push(
            normalizeFileObject(file, {
              path: filePath,
              url: supabase.storage.from(bucket).getPublicUrl(filePath).data
                .publicUrl,
            })
          );

          // Track successful upload event
          SupabaseAnalytics.trackEvent("file_upload", {
            filename: file.name,
            filetype: file.name.split(".").pop() || "unknown",
            filesize: file.size,
            bucket: bucket,
            folder: folder || "root",
          });

          // After successful upload (regular upload branch)
          if (!error) {
            try {
              await supabase.from("documents").insert({
                name: file.name,
                type: file.type,
                size: file.size,
                storage_path: filePath,
                url: supabase.storage.from(bucket).getPublicUrl(filePath).data
                  .publicUrl,
                uploaded_by: userId,
                uploaded_at: new Date().toISOString(),
                // Add more fields as needed
              });
            } catch (err) {
              console.error("Failed to insert document metadata:", err);
            }
          }
        }
      } catch (err) {
        console.error("Error in upload process:", err);
        setUploadStatus((prev) => ({ ...prev, [i]: "error" }));
        hasErrors = true;
        onUploadError(err, file);
      }
    }

    // Update overall status after all uploads are complete
    setOverallStatus(hasErrors ? "error" : "complete");

    // Call the completion callback with the successfully uploaded files
    if (successfulFiles.length > 0) {
      onUploadComplete(successfulFiles);
    }
  };

  // Reset the component state
  const resetUploader = () => {
    setFiles([]);
    setUploadProgress({});
    setUploadStatus({});
    setOverallStatus("idle");
    setErrorMessage("");
  };

  // Effect to update overall status when all files are uploaded
  useEffect(() => {
    if (files.length === 0) {
      setOverallStatus("idle");
      return;
    }

    // Check if all files have been processed
    const allProcessed = files.every(
      (_, index) =>
        uploadStatus[index] === "success" || uploadStatus[index] === "error"
    );

    // Check if any files have errors
    const hasErrors = files.some((_, index) => uploadStatus[index] === "error");

    if (allProcessed) {
      setOverallStatus(hasErrors ? "error" : "complete");
    }
  }, [files, uploadStatus]);

  return (
    <div className="file-uploader-container">
      {/* Dropzone area */}
      <div
        {...getRootProps()}
        className={`dropzone ${isDragActive ? "active" : ""} ${
          isDragAccept ? "accept" : ""
        } ${isDragReject ? "reject" : ""}`}
      >
        <input {...getInputProps()} />
        <div className="dropzone-content">
          <Upload size={48} className="upload-icon" />
          <p className="dropzone-text">
            {isDragActive
              ? isDragAccept
                ? "Drop the files here..."
                : "Some files will be rejected..."
              : "Drag & drop files here, or click to select files"}
          </p>
          <p className="dropzone-hint">
            Maximum {maxFiles} files, up to{" "}
            {formatFileSize(maxFileSize || maxSize)} each
            <br />
            Accepted types: {getAcceptedFileTypesForDisplay()}
          </p>
        </div>
      </div>

      {/* Error message */}
      {errorMessage && (
        <div className="upload-error-message">
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="file-list">
          <div className="file-list-header">
            <h3>Files to upload ({files.length})</h3>
            {overallStatus === "idle" && (
              <button
                className="clear-files-button"
                onClick={resetUploader}
                type="button"
              >
                Clear All
              </button>
            )}
          </div>

          <div className="file-items">
            {files.map((file, index) => (
              <div key={index} className="file-item">
                <div className="file-icon">{getFileIcon(file.name)}</div>
                <div className="file-details">
                  <div className="file-name-row">
                    <span className="file-name" title={file.name}>
                      {file.name}
                    </span>
                    {uploadStatus[index] !== "uploading" &&
                      overallStatus !== "uploading" && (
                        <button
                          className="remove-file"
                          onClick={() => removeFile(index)}
                          type="button"
                        >
                          <X size={16} />
                        </button>
                      )}
                  </div>
                  <div className="file-size">{formatFileSize(file.size)}</div>

                  {/* Progress bar */}
                  {uploadStatus[index] && (
                    <div className="file-progress-container">
                      <div
                        className={`file-progress-bar ${uploadStatus[index]}`}
                        style={{ width: `${uploadProgress[index] || 0}%` }}
                      ></div>
                      <div className="file-status">
                        {uploadStatus[index] === "uploading" && (
                          <>
                            <Loader size={14} className="spinning" />
                            <span>{uploadProgress[index] || 0}%</span>
                          </>
                        )}
                        {uploadStatus[index] === "success" && (
                          <>
                            <CheckCircle size={14} className="success-icon" />
                            <span>
                              {processForKnowledgeBase
                                ? "Processed"
                                : "Complete"}
                            </span>
                          </>
                        )}
                        {uploadStatus[index] === "error" && (
                          <>
                            <AlertCircle size={14} className="error-icon" />
                            <span>Failed</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      {files.length > 0 && (
        <div className="upload-actions">
          {overallStatus === "idle" && (
            <button
              className="upload-button"
              onClick={uploadFiles}
              type="button"
            >
              <Upload size={16} />
              {processForKnowledgeBase
                ? "Process & Upload Files"
                : "Upload Files"}
            </button>
          )}

          {overallStatus === "uploading" && (
            <button className="uploading-button" disabled type="button">
              <Loader size={16} className="spinning" />
              {processForKnowledgeBase ? "Processing..." : "Uploading..."}
            </button>
          )}

          {overallStatus === "complete" && (
            <div className="upload-complete">
              <CheckCircle size={16} className="success-icon" />
              <span>
                {processForKnowledgeBase
                  ? "Processing Complete"
                  : "Upload Complete"}
              </span>
              <button
                className="upload-more-button"
                onClick={resetUploader}
                type="button"
              >
                Upload More
              </button>
            </div>
          )}

          {overallStatus === "error" && (
            <div className="upload-error">
              <AlertCircle size={16} className="error-icon" />
              <span>
                Some files failed to{" "}
                {processForKnowledgeBase ? "process" : "upload"}
              </span>
              <button
                className="retry-button"
                onClick={uploadFiles}
                type="button"
              >
                Retry Failed
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FileUploadDropzone;
