// src/components/InputBar.jsx
import React, { useState, useRef, useEffect } from "react";
import { Loader2, X, Upload, Send, Globe, File, FileText } from "lucide-react";
import { useFeatureFlags } from "../utils/featureFlags";
import { useAuth } from "../context/AuthContext";
import "./InputBar.css";

function InputBar({
  onSend,
  onFileUpload,
  onImageSearch,
  onAdvancedSearch,
  setFile,
  isLoading,
  disabled,
  uploadProgress,
  showImageSearch = true,
}) {
  const { isFeatureEnabled } = useFeatureFlags();
  const { hasRole } = useAuth();
  const [text, setText] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [fileType, setFileType] = useState(null);
  const [useInternet, setUseInternet] = useState(false);
  const [showSourceSelector, setShowSourceSelector] = useState(false);
  const [sourceType, setSourceType] = useState("local");
  const fileInputRef = useRef(null);
  const dropboxInputRef = useRef(null);

  // Check if file upload is available for this user's tier
  const canUploadFiles = isFeatureEnabled("file_upload");

  // Check if internet search is available for this user
  const canUseInternet = hasRole("admin") || hasRole("super_admin");

  // Check if the file is an image
  const isImage = (file) => {
    return file?.type?.startsWith("image/");
  };

  // Check if the file is a document
  const isDocument = (file) => {
    const documentTypes = [
      "text/plain",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    return documentTypes.includes(file?.type);
  };

  const handleSend = () => {
    if (selectedFile) {
      // If we have a selected file
      if (text.trim()) {
        // If there's also text, treat as follow-up query with the file
        if (isImage(selectedFile) && showImageSearch) {
          onImageSearch(selectedFile, text);
        } else {
          onFileUpload(selectedFile, text);
        }
        setText("");
        // Don't clear file yet to allow for further follow-ups
      } else {
        // If just the file, determine what action to take
        if (isImage(selectedFile) && showImageSearch) {
          setShowSearchModal(true);
        } else {
          onFileUpload(selectedFile);
        }
      }
    } else if (text.trim()) {
      // Just text, no file
      if (useInternet && canUseInternet) {
        // If internet search is enabled, use advanced search
        onAdvancedSearch(text);
      } else {
        // Regular message
        onSend(text);
      }
      setText("");
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        alert("File size exceeds 10MB limit. Please choose a smaller file.");
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        return;
      }

      // Store the file
      setSelectedFile(file);
      setFile(file);
      setFileType(file.type);

      // Create preview for images
      if (isImage(file)) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setFilePreview(e.target.result);
        };
        reader.readAsDataURL(file);

        // If image search is enabled, show search modal
        if (showImageSearch) {
          setShowSearchModal(true);
        } else {
          onFileUpload(file);
        }
      } else if (isDocument(file)) {
        // Set a generic file preview for documents
        setFilePreview("document");
        // Process document upload
        onFileUpload(file);
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Handle Dropbox or other cloud storage file selection
  const handleCloudFileSelect = async (source) => {
    try {
      // This would integrate with your existing storageManager
      const storageManager = window.storageManager;

      if (source === "dropbox") {
        // Show Dropbox file picker using their SDK
        const options = {
          success: function (files) {
            // Files contains information about the selected file(s)
            const selectedPath = files[0].link;
            const fileName = files[0].name;

            // Process file from Dropbox
            if (fileName.match(/\.(jpg|jpeg|png|gif)$/i)) {
              setFileType("image");
              setFilePreview("cloud-image");
              // Use path-based image analysis
              onImageSearch(null, text, "tensor", selectedPath);
            } else {
              setFileType("document");
              setFilePreview("cloud-document");
              // Handle document from Dropbox
              onFileUpload(null, text, selectedPath);
            }
          },
          cancel: function () {
            console.log("Dropbox file selection canceled");
          },
          linkType: "direct",
          multiselect: false,
        };

        if (window.Dropbox) {
          window.Dropbox.choose(options);
        } else {
          alert("Dropbox SDK not loaded. Please try again later.");
        }
      } else if (source === "googledrive") {
        // Google Drive integration would go here
        alert("Google Drive integration coming soon!");
      }

      setShowSourceSelector(false);
    } catch (error) {
      console.error("Error selecting cloud file:", error);
      alert("Failed to connect to cloud storage. Please try again.");
    }
  };

  const handleSearchMode = (mode) => {
    // Hide modal
    setShowSearchModal(false);

    // Process search with the selected mode
    if (selectedFile) {
      // Use onImageSearch instead of onFileUpload to ensure proper mode selection
      onImageSearch(selectedFile, text, mode);

      // Clear the text field after search
      setText("");

      // Don't clear the file yet - keep it in the input bar for follow-up questions
    }
  };

  const clearFileSelection = () => {
    setSelectedFile(null);
    setFilePreview(null);
    setFile(null);
    setFileType(null);
  };

  const toggleInternet = () => {
    if (canUseInternet) {
      setUseInternet(!useInternet);
    } else {
      alert("Internet search is only available for admin users.");
    }
  };

  const openSourceSelector = () => {
    setShowSourceSelector(!showSourceSelector);
  };

  return (
    <>
      <div className="input-bar">
        {/* Internet search toggle for admins */}
        {canUseInternet && (
          <button
            className={`internet-toggle ${useInternet ? "active" : ""}`}
            onClick={toggleInternet}
            title={
              useInternet ? "Internet search enabled" : "Enable internet search"
            }
            aria-label="Toggle internet search"
          >
            <Globe size={18} />
          </button>
        )}

        {filePreview && (
          <div className="selected-file-container">
            {filePreview === "document" || filePreview === "cloud-document" ? (
              <div className="document-preview">
                <FileText size={24} />
                <span className="file-name">
                  {selectedFile?.name || "Document"}
                </span>
              </div>
            ) : filePreview === "cloud-image" ? (
              <div className="cloud-image-preview">
                <File size={24} />
                <span className="file-name">Cloud Image</span>
              </div>
            ) : (
              <img
                src={filePreview}
                alt="Selected"
                className="selected-image-preview"
              />
            )}
            <button
              className="clear-file-btn"
              onClick={clearFileSelection}
              aria-label="Remove selected file"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={
            selectedFile
              ? "Add a message or press Send to search"
              : useInternet
              ? "Search the web..."
              : "Type your message here..."
          }
          disabled={isLoading || disabled}
          className={`${disabled ? "disabled" : ""} ${
            useInternet ? "web-search-active" : ""
          }`}
          aria-label="Message input"
        />

        {canUploadFiles && (
          <>
            <div className="file-source-container">
              <button
                className="file-source-btn"
                onClick={openSourceSelector}
                aria-label="Select file source"
                title="Select file source"
              >
                <Upload size={20} />
              </button>

              {showSourceSelector && (
                <div className="source-selector">
                  <button
                    onClick={() => {
                      fileInputRef.current.click();
                      setShowSourceSelector(false);
                    }}
                    className="source-option"
                  >
                    <Upload size={16} />
                    <span>Upload from device</span>
                  </button>
                  <button
                    onClick={() => handleCloudFileSelect("dropbox")}
                    className="source-option"
                  >
                    <File size={16} />
                    <span>Choose from Dropbox</span>
                  </button>
                  <button
                    onClick={() => handleCloudFileSelect("googledrive")}
                    className="source-option"
                  >
                    <File size={16} />
                    <span>Choose from Google Drive</span>
                  </button>
                </div>
              )}
            </div>

            <input
              type="file"
              id="file-upload"
              onChange={handleFileChange}
              ref={fileInputRef}
              accept="image/*,text/plain,application/pdf,.doc,.docx,.csv,.xls,.xlsx"
              disabled={isLoading || disabled}
              aria-label="Upload file"
              className="file-input-hidden"
            />
          </>
        )}

        <button
          onClick={handleSend}
          disabled={isLoading || disabled || (!text.trim() && !selectedFile)}
          className={`send-btn ${disabled ? "disabled" : ""} ${
            isLoading ? "loading" : ""
          }`}
          aria-label={isLoading ? "Sending..." : "Send message"}
        >
          {isLoading ? (
            <>
              <Loader2 className="spinner" aria-hidden="true" />
              <span className="sr-only">Sending...</span>
            </>
          ) : (
            <Send size={20} />
          )}
        </button>
      </div>

      {showSearchModal && (
        <div
          className="search-modal-overlay"
          role="dialog"
          aria-labelledby="search-modal-title"
          aria-modal="true"
        >
          <div className="search-modal">
            <h3 id="search-modal-title">
              How would you like to search with this image?
            </h3>
            <div className="image-preview">
              <img src={filePreview} alt="Upload preview" />
            </div>
            <div className="search-options">
              <button
                onClick={() => handleSearchMode("tensor")}
                className="search-option-btn full-match"
              >
                <span className="option-title">Full Image Match</span>
                <span className="option-desc">
                  Find exact or very similar images
                </span>
              </button>
              <button
                onClick={() => handleSearchMode("partial")}
                className="search-option-btn partial-match"
              >
                <span className="option-title">Partial Image Match</span>
                <span className="option-desc">
                  Find images containing parts of this image
                </span>
              </button>
            </div>
            <button
              className="cancel-btn"
              onClick={() => setShowSearchModal(false)}
              aria-label="Cancel image search"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default InputBar;
