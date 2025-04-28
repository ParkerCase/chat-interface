// src/components/ChatImageResults.jsx
import React, { useState } from "react";

/**
 * Enhanced component to display image search results in a chat message
 * Works with multiple storage providers using StorageManager
 *
 * @param {Object} props - Component props
 * @param {Array} props.images - Image results to display
 * @param {string} props.responseText - Natural language response
 * @param {Object} props.searchParams - Search parameters
 * @param {Function} props.onImageClick - Function to call when image is clicked
 * @returns {JSX.Element} Chat image results component
 */
const ChatImageResults = ({
  images = [],
  responseText = "",
  searchParams = {},
  onImageClick,
}) => {
  const [expanded, setExpanded] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [failedImages, setFailedImages] = useState({});

  // Display settings
  const maxImagesToShow = images.length > 8 ? 6 : images.length;
  const hasMoreImages = images.length > maxImagesToShow;

  /**
   * Enhanced function to generate image URL using the image proxy
   * @param {string} imagePath - Path to the image
   * @returns {string} URL for the image
   */
  const getImageUrl = (imagePath) => {
    if (!imagePath) return "/placeholder-image.jpg";

    // Add cache busting parameter
    const cacheBuster = `t=${Date.now()}`;

    // Handle different path formats to ensure they work with our image proxy
    let formattedPath = imagePath;

    // If the image has a provider explicitly set, use provider:// format
    if (
      imagePath.provider &&
      !formattedPath.startsWith(`${imagePath.provider}://`)
    ) {
      // Remove leading slash if present
      const normalizedPath = formattedPath.startsWith("/")
        ? formattedPath.substring(1)
        : formattedPath;
      formattedPath = `${imagePath.provider}://${normalizedPath}`;
    }

    // Always proxy through our backend API to handle any storage provider
    return `/api/image-proxy?path=${encodeURIComponent(
      formattedPath
    )}&${cacheBuster}`;
  };

  /**
   * Handle image load error
   * @param {string} imageId - ID of the image
   */
  const handleImageError = (imageId) => {
    setFailedImages((prev) => ({
      ...prev,
      [imageId]: true,
    }));
  };

  /**
   * Handle clicking "Show more" button
   */
  const handleShowMore = () => {
    // Navigate to full search results view
    console.log("Show more clicked", searchParams);
    // Implementation for showing more results
  };

  /**
   * Handle clicking an image
   * @param {Object} image - Image data
   */
  const handleImageClick = (image) => {
    setSelectedImage(image);
    if (onImageClick) {
      onImageClick(image);
    }
  };

  // If no images, just show the response text
  if (!images || images.length === 0) {
    return <div className="chat-response">{responseText}</div>;
  }

  return (
    <div className="chat-image-results">
      {/* Response text */}
      <div className="chat-response">{responseText}</div>

      {/* Collapse/expand control */}
      <div className="results-controls">
        <button
          className="toggle-results-btn"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Hide Images" : "Show Images"}
        </button>
      </div>

      {/* Results grid - only shown when expanded */}
      {expanded && (
        <div className="chat-image-grid">
          {images.slice(0, maxImagesToShow).map((image, index) => {
            const imageId = image.id || `chat-img-${index}`;
            const hasFailed = !!failedImages[imageId];

            return (
              <div
                key={imageId}
                className={`chat-image-item ${hasFailed ? "failed" : ""}`}
                onClick={() => handleImageClick(image)}
              >
                <div className="image-container">
                  <img
                    src={getImageUrl(image.path)}
                    alt={image.filename || image.name || "Image"}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = "/placeholder-image.jpg";
                      handleImageError(imageId);
                    }}
                  />

                  {/* Show similarity score badge if available */}
                  {image.similarity !== undefined && (
                    <div className="similarity-badge">
                      {Math.round(image.similarity * 100)}%
                    </div>
                  )}

                  {/* Show body part badge if available */}
                  {image.bodyPart && (
                    <div className="body-part-badge">{image.bodyPart}</div>
                  )}

                  {/* Show error badge if image failed to load */}
                  {hasFailed && (
                    <div className="image-error-badge">
                      <span className="error-icon">⚠️</span>
                    </div>
                  )}

                  {/* Provider badge if available */}
                  {image.provider && (
                    <div className="provider-badge">{image.provider}</div>
                  )}
                </div>

                <div className="image-caption">
                  {image.filename ||
                    image.name ||
                    image.path?.split("/").pop() ||
                    "Image"}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Show more button */}
      {hasMoreImages && expanded && (
        <div className="chat-results-footer">
          <button className="show-more-btn" onClick={handleShowMore}>
            Show all {images.length} results
          </button>
        </div>
      )}

      {/* Image detail modal */}
      {selectedImage && (
        <div className="image-detail-modal">
          <div className="modal-content">
            <button
              className="close-modal-btn"
              onClick={() => setSelectedImage(null)}
            >
              &times;
            </button>

            <div className="modal-image">
              <img
                src={getImageUrl(selectedImage.path)}
                alt={selectedImage.filename || selectedImage.name || "Image"}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "/placeholder-image.jpg";
                }}
              />
            </div>

            <div className="image-details">
              <h3>
                {selectedImage.filename ||
                  selectedImage.name ||
                  selectedImage.path?.split("/").pop()}
              </h3>

              <div className="detail-item">
                <strong>Path:</strong> {selectedImage.path}
              </div>

              {selectedImage.provider && (
                <div className="detail-item">
                  <strong>Provider:</strong> {selectedImage.provider}
                </div>
              )}

              {selectedImage.insights?.bodyPart && (
                <div className="detail-item">
                  <strong>Body part:</strong> {selectedImage.insights.bodyPart}
                </div>
              )}

              {selectedImage.similarity !== undefined && (
                <div className="detail-item">
                  <strong>Similarity:</strong>{" "}
                  {Math.round(selectedImage.similarity * 100)}%
                </div>
              )}

              {selectedImage.insights?.isLikelyTattoo !== undefined && (
                <div className="detail-item">
                  <strong>Contains tattoo:</strong>{" "}
                  {selectedImage.insights.isLikelyTattoo ? "Yes" : "No"}
                </div>
              )}

              {selectedImage.insights?.hasFaded && (
                <div className="detail-item">
                  <strong>Faded:</strong> Yes
                </div>
              )}

              <div className="modal-actions">
                <button
                  className="action-button copy-path"
                  onClick={() => {
                    navigator.clipboard.writeText(selectedImage.path);
                    alert("Path copied to clipboard");
                  }}
                >
                  Copy Path
                </button>

                <button
                  className="action-button view-full"
                  onClick={() => {
                    window.open(getImageUrl(selectedImage.path), "_blank");
                  }}
                >
                  View Full Size
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatImageResults;
