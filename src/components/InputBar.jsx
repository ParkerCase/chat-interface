// src/components/InputBar.jsx
import React, { useState, useRef } from "react";
import { Loader2, X, Upload, Send } from "lucide-react";
import { useFeatureFlags } from "../utils/featureFlags";
import "./InputBar.css";

function InputBar({
  onSend,
  onFileUpload,
  onImageSearch,
  setFile,
  isLoading,
  disabled,
  uploadProgress,
  showImageSearch = true,
}) {
  const { isFeatureEnabled } = useFeatureFlags();
  const [text, setText] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const fileInputRef = useRef(null);

  // Check if file upload is available for this user's tier
  const canUploadFiles = isFeatureEnabled("file_upload");

  const handleSend = () => {
    if (selectedImage) {
      // If we have a selected image
      if (text.trim()) {
        // If there's also text, treat as follow-up query with the image
        onImageSearch(selectedImage, text);
        setText("");
        // Don't clear image yet to allow for further follow-ups
      } else {
        // If just the image, show search modal
        setShowSearchModal(true);
      }
    } else if (text.trim()) {
      // Just text, no image
      onSend(text);
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

      // Store the file but DON'T call onFileUpload yet
      setSelectedImage(file);
      setFile(file);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);

      // If image search is enabled, show search modal
      // Otherwise, proceed with regular file upload
      if (showImageSearch) {
        setShowSearchModal(true);
      } else {
        onFileUpload(file);
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSearchMode = (mode) => {
    // Hide modal
    setShowSearchModal(false);

    // Process search with the selected mode
    if (selectedImage) {
      // Use onImageSearch instead of onFileUpload to ensure proper mode selection
      onImageSearch(selectedImage, text, mode);

      // Clear the text field after search
      setText("");

      // Don't clear the image yet - keep it in the input bar for follow-up questions
      // It will be cleared when the user clicks send or manually removes it
    }
  };

  const clearImageSelection = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setFile(null);
  };

  return (
    <>
      <div className="input-bar">
        {imagePreview && (
          <div className="selected-image-container">
            <img
              src={imagePreview}
              alt="Selected"
              className="selected-image-preview"
            />
            <button
              className="clear-image-btn"
              onClick={clearImageSelection}
              aria-label="Remove selected image"
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
            selectedImage
              ? "Add a message or press Send to search"
              : "Type your message here..."
          }
          disabled={isLoading || disabled}
          className={disabled ? "disabled" : ""}
          aria-label="Message input"
        />

        {canUploadFiles && (
          <>
            <input
              type="file"
              id="file-upload"
              onChange={handleFileChange}
              ref={fileInputRef}
              accept="image/*"
              disabled={isLoading || disabled}
              aria-label="Upload image"
              className="file-input-hidden"
            />

            <label
              htmlFor="file-upload"
              className={`upload-btn ${disabled ? "disabled" : ""} ${
                selectedImage ? "hidden" : ""
              }`}
              role="button"
              aria-label="Upload image"
              tabIndex="0"
            >
              <Upload size={20} />
            </label>
          </>
        )}

        <button
          onClick={handleSend}
          disabled={isLoading || disabled || (!text.trim() && !selectedImage)}
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
              <img src={imagePreview} alt="Upload preview" />
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
