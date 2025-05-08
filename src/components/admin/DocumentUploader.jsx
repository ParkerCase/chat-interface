// src/components/admin/DocumentUploader.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import FileUploadDropzone from "../storage/FileUploadDropzone";
import documentProcessor from "../../utils/DocumentProcessor";
import {
  Upload,
  Database,
  Settings,
  CheckCircle,
  AlertCircle,
  Clock,
  Loader,
  FileText,
} from "lucide-react";
import "./DocumentUploader.css";

const DocumentUploader = () => {
  const [storageSettings, setStorageSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [recentUploads, setRecentUploads] = useState([]);
  const [processingStats, setProcessingStats] = useState({
    documentsProcessed: 0,
    totalDocuments: 0,
    failedDocuments: 0,
  });

  // Load settings and recent uploads on component mount
  useEffect(() => {
    const init = async () => {
      try {
        setIsLoading(true);

        // Initialize document processor to get settings
        await documentProcessor.initialize();
        setStorageSettings(documentProcessor.settings);

        // Fetch recent document uploads
        await fetchRecentUploads();
      } catch (error) {
        console.error("Error initializing document uploader:", error);
        setError("Failed to load storage settings or recent uploads");
      } finally {
        setIsLoading(false);
      }
    };

    init();
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

  // Fetch recent document uploads
  const fetchRecentUploads = async () => {
    try {
      // Get recent documents from the documents table
      const { data, error } = await supabase
        .from("documents")
        .select("id, name, created_at, metadata, document_type, status")
        .eq("source_type", "upload")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;

      setRecentUploads(data || []);

      // Get processing stats
      const { count: totalCount, error: countError } = await supabase
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("source_type", "upload");

      if (countError) throw countError;

      const { count: failedCount, error: failedError } = await supabase
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("source_type", "upload")
        .eq("status", "failed");

      if (failedError) throw failedError;

      setProcessingStats({
        documentsProcessed: totalCount || 0,
        totalDocuments: totalCount || 0,
        failedDocuments: failedCount || 0,
      });
    } catch (error) {
      console.error("Error fetching recent uploads:", error);
      setError("Failed to load recent document uploads");
    }
  };

  // Handle upload complete
  const handleUploadComplete = async (files) => {
    setSuccess(`Successfully processed ${files.length} document(s)`);
    // Refresh recent uploads
    await fetchRecentUploads();
  };

  // Handle upload error
  const handleUploadError = (error, file) => {
    setError(`Error processing ${file.name}: ${error.message}`);
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return "Unknown";
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return "Unknown";
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="document-uploader">
      <div className="admin-section">
        <h2 className="admin-section-title">Document Uploader</h2>
        <p className="section-description">
          Upload documents to be processed for the knowledge base. Documents
          will be processed according to your storage settings.
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

        {/* Storage settings summary */}
        {storageSettings && (
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
            </div>
          </div>
        )}

        {/* Upload dropzone */}
        <div className="upload-section">
          <h3>
            <Upload size={18} /> Upload Documents
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

        {/* Processing stats */}
        <div className="processing-stats">
          <h3>
            <Database size={18} /> Processing Statistics
          </h3>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">
                {processingStats.documentsProcessed}
              </div>
              <div className="stat-label">Documents Processed</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {processingStats.totalDocuments -
                  processingStats.failedDocuments}
              </div>
              <div className="stat-label">Successfully Processed</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {processingStats.failedDocuments}
              </div>
              <div className="stat-label">Failed Documents</div>
            </div>
          </div>
        </div>

        {/* Recent uploads */}
        <div className="recent-uploads">
          <h3>
            <Clock size={18} /> Recent Uploads
          </h3>
          {isLoading ? (
            <div className="loading">
              <Loader size={24} className="spinner" />
              <p>Loading recent uploads...</p>
            </div>
          ) : recentUploads.length === 0 ? (
            <div className="no-uploads">
              <FileText size={48} />
              <p>No documents have been uploaded yet.</p>
            </div>
          ) : (
            <div className="uploads-table-container">
              <table className="uploads-table">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Type</th>
                    <th>Size</th>
                    <th>Version</th>
                    <th>Uploaded</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentUploads.map((doc) => (
                    <tr key={doc.id}>
                      <td>{doc.name || "Unnamed Document"}</td>
                      <td>{doc.document_type || "document"}</td>
                      <td>{formatFileSize(doc.metadata?.fileSize || 0)}</td>
                      <td>{doc.metadata?.version || 1}</td>
                      <td>{formatDate(doc.created_at)}</td>
                      <td
                        className={`status ${(
                          doc.status || "active"
                        ).toLowerCase()}`}
                      >
                        {doc.status || "Active"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentUploader;
