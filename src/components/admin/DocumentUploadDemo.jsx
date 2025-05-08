// src/components/admin/DocumentUploadDemo.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import FileUploadDropzone from "../storage/FileUploadDropzone";
import documentProcessor from "../../utils/DocumentProcessor";
import {
  Upload,
  File,
  Settings,
  CheckCircle,
  AlertCircle,
  Loader,
  RefreshCw,
} from "lucide-react";

const DocumentUploadDemo = () => {
  const [storageSettings, setStorageSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [processingResult, setProcessingResult] = useState(null);

  // Load settings on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        setError(null);

        await documentProcessor.initialize();
        setStorageSettings(documentProcessor.settings);
      } catch (err) {
        console.error("Error loading settings:", err);
        setError("Failed to load storage settings");
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  // Handle upload complete
  const handleUploadComplete = async (files) => {
    setSuccess(`Successfully uploaded ${files.length} file(s)`);

    if (files.length > 0) {
      // Show the first file's details
      const file = files[0];
      setProcessingResult({
        name: file.name,
        size: file.size,
        path: file.path,
        metadata: file.metadata || {},
        version: file.metadata?.version || 1,
        uploadTime: new Date().toLocaleTimeString(),
      });
    }
  };

  // Handle upload error
  const handleUploadError = (error, file) => {
    setError(`Error uploading ${file.name}: ${error.message}`);
  };

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

  return (
    <div className="document-upload-demo">
      <h2>Document Upload & Processing Demo</h2>
      <p className="description">
        This demo shows how documents are processed according to your storage
        settings. Uploaded documents will be processed with text extraction and
        embedding generation.
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
        </div>
      )}

      {/* Current Settings */}
      {isLoading ? (
        <div className="loading-container">
          <Loader className="spinner" size={24} />
          <p>Loading settings...</p>
        </div>
      ) : storageSettings ? (
        <div className="settings-summary">
          <h3>
            <Settings size={16} /> Current Storage Settings
          </h3>
          <div className="settings-grid">
            <div className="setting-item">
              <span className="setting-label">Max File Size:</span>
              <span className="setting-value">
                {storageSettings.maxFileSize} MB
              </span>
            </div>
            <div className="setting-item">
              <span className="setting-label">Allowed File Types:</span>
              <span className="setting-value">
                {storageSettings.acceptedFileTypes}
              </span>
            </div>
            <div className="setting-item">
              <span className="setting-label">Storage Path:</span>
              <span className="setting-value">
                {storageSettings.storagePath}
              </span>
            </div>
            <div className="setting-item">
              <span className="setting-label">Versioning:</span>
              <span className="setting-value">
                {storageSettings.enableVersioning ? "Enabled" : "Disabled"}
              </span>
            </div>
            <div className="setting-item">
              <span className="setting-label">Compression:</span>
              <span className="setting-value">
                {storageSettings.compressionEnabled ? "Enabled" : "Disabled"}
              </span>
            </div>
            <div className="setting-item">
              <button
                onClick={async () => {
                  try {
                    setIsLoading(true);
                    await documentProcessor.initialize(); // Re-initialize to refresh settings
                    setStorageSettings(documentProcessor.settings);
                    setSuccess("Settings refreshed successfully");
                  } catch (err) {
                    setError("Failed to refresh settings");
                  } finally {
                    setIsLoading(false);
                  }
                }}
                className="refresh-button"
              >
                <RefreshCw size={14} />
                Refresh Settings
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="empty-settings">
          <p>
            No storage settings found. Please configure settings in the Storage
            Settings tab.
          </p>
        </div>
      )}

      {/* Upload component */}
      <div className="upload-section">
        <h3>
          <Upload size={18} /> Upload Document for Processing
        </h3>
        <FileUploadDropzone
          bucket="documents"
          folder={
            storageSettings?.storagePath?.replace(/^\//, "") || "data/uploads"
          }
          maxSize={
            storageSettings?.maxFileSize
              ? storageSettings.maxFileSize * 1024 * 1024
              : undefined
          }
          acceptedFileTypes={storageSettings?.acceptedFileTypes
            ?.split(",")
            .map((ext) => `.${ext.trim()}`)
            .reduce((acc, ext) => ({ ...acc, [ext]: [] }), {})}
          processForKnowledgeBase={true}
          onUploadComplete={handleUploadComplete}
          onUploadError={handleUploadError}
        />
      </div>

      {/* Processing result */}
      {processingResult && (
        <div className="processing-result">
          <h3>
            <File size={18} /> Processing Result
          </h3>
          <div className="result-details">
            <div className="result-item">
              <span className="result-label">Filename:</span>
              <span className="result-value">{processingResult.name}</span>
            </div>
            <div className="result-item">
              <span className="result-label">File Size:</span>
              <span className="result-value">
                {(processingResult.size / 1024).toFixed(2)} KB
              </span>
            </div>
            <div className="result-item">
              <span className="result-label">Storage Path:</span>
              <span className="result-value">{processingResult.path}</span>
            </div>
            <div className="result-item">
              <span className="result-label">Version:</span>
              <span className="result-value">{processingResult.version}</span>
            </div>
            <div className="result-item">
              <span className="result-label">Upload Time:</span>
              <span className="result-value">
                {processingResult.uploadTime}
              </span>
            </div>
            <div className="result-item">
              <span className="result-label">Compressed:</span>
              <span className="result-value">
                {processingResult.metadata.isCompressed ? "Yes" : "No"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentUploadDemo;
