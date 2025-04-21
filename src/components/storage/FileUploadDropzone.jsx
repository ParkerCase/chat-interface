// src/components/storage/FileUploadDropzone.jsx
import React, { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { supabase } from "../../lib/supabase";
import { SupabaseAnalytics } from "../../utils/SupabaseAnalyticsIntegration";
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
}) => {
  const [files, setFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadStatus, setUploadStatus] = useState({});
  const [overallStatus, setOverallStatus] = useState("idle"); // idle, uploading, complete, error
  const [errorMessage, setErrorMessage] = useState("");

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

  // Handle file drops
  const onDrop = useCallback(
    (acceptedFiles) => {
      // Reset states when new files are dropped
      setErrorMessage("");
      setOverallStatus("idle");

      // Filter out files that exceed max size
      const validFiles = acceptedFiles.filter((file) => file.size <= maxSize);
      const invalidFiles = acceptedFiles.filter((file) => file.size > maxSize);

      if (invalidFiles.length > 0) {
        setErrorMessage(
          `${
            invalidFiles.length
          } file(s) exceed the maximum size limit of ${formatFileSize(maxSize)}`
        );
      }

      // Combine with existing files, but don't exceed maxFiles
      setFiles((prevFiles) => {
        const newFiles = [...prevFiles, ...validFiles].slice(0, maxFiles);
        return newFiles;
      });
    },
    [maxSize, maxFiles]
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
    maxSize,
    accept: acceptedFileTypes,
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

      // Create file path - include folder if provided
      const filePath = folder ? `${folder}/${file.name}` : file.name;

      try {
        // Start upload and track progress
        setUploadStatus((prev) => ({ ...prev, [i]: "uploading" }));
        setUploadProgress((prev) => ({ ...prev, [i]: 0 }));

        const { data, error } = await supabase.storage
          .from(bucket)
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: true,
            onUploadProgress: (progress) => {
              const progressPercent = Math.round(
                (progress.loaded / progress.total) * 100
              );
              setUploadProgress((prev) => ({ ...prev, [i]: progressPercent }));
            },
          });

        if (error) {
          console.error("Error uploading file:", error);
          setUploadStatus((prev) => ({ ...prev, [i]: "error" }));
          hasErrors = true;
          onUploadError(error, file);
        } else {
          setUploadStatus((prev) => ({ ...prev, [i]: "success" }));
          successfulFiles.push(file);

          // Track successful upload event
          SupabaseAnalytics.trackEvent("file_upload", {
            filename: file.name,
            filetype: file.name.split(".").pop() || "unknown",
            filesize: file.size,
            bucket: bucket,
            folder: folder || "root",
          });

          // Get public URL for the file if needed
          const {
            data: { publicUrl },
          } = supabase.storage.from(bucket).getPublicUrl(filePath);

          // Update file info with URL
          setFiles((prevFiles) => {
            const updatedFiles = [...prevFiles];
            updatedFiles[i] = {
              ...updatedFiles[i],
              url: publicUrl,
              path: filePath,
            };
            return updatedFiles;
          });
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
            Maximum {maxFiles} files, up to {formatFileSize(maxSize)} each
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
                            <span>Complete</span>
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
              Upload Files
            </button>
          )}

          {overallStatus === "uploading" && (
            <button className="uploading-button" disabled type="button">
              <Loader size={16} className="spinning" />
              Uploading...
            </button>
          )}

          {overallStatus === "complete" && (
            <div className="upload-complete">
              <CheckCircle size={16} className="success-icon" />
              <span>Upload Complete</span>
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
              <span>Some files failed to upload</span>
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
