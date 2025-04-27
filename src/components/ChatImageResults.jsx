// src/components/ChatImageResults.jsx
import React, { useState } from "react";
import { useSupabase } from "../hooks/useSupabase";

/**
 * Component to display image search results in a chat message
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
  const supabase = useSupabase();
  const [expanded, setExpanded] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);

  // Display settings
  const maxImagesToShow = images.length > 8 ? 6 : images.length;
  const hasMoreImages = images.length > maxImagesToShow;

  /**
   * Generate image URL based on storage provider
   * @param {string} imagePath - Path to the image
   * @returns {string} URL for the image
   */
  const getImageUrl = (imagePath) => {
    if (!imagePath) return "/placeholder-image.jpg";

    // Handle different storage providers
    if (imagePath.startsWith("dropbox:")) {
      // For Dropbox paths, use our proxy endpoint
      const path = encodeURIComponent(imagePath.replace("dropbox:", ""));
      return `/api/image-proxy?path=${path}`;
    }

    // For Supabase storage
    if (imagePath.startsWith("supabase:")) {
      const path = imagePath.replace("supabase:", "");
      return supabase.storage.from("images").getPublicUrl(path).data.publicUrl;
    }

    // For local development testing or relative paths
    if (imagePath.startsWith("/")) {
      return imagePath;
    }

    // For absolute URLs
    if (imagePath.startsWith("http")) {
      return imagePath;
    }

    // Default fallback - assume it's a relative path
    return `/api/image-proxy?path=${encodeURIComponent(imagePath)}`;
  };

  /**
   * Handle clicking "Show more" button
   */
  const handleShowMore = () => {
    // Navigate to full search results view
    // This could link to your standalone search UI with these results pre-loaded
    console.log("Show more clicked", searchParams);
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
          {images.slice(0, maxImagesToShow).map((image, index) => (
            <div
              key={image.id || index}
              className="chat-image-item"
              onClick={() => handleImageClick(image)}
            >
              <div className="image-container">
                <img
                  src={getImageUrl(image.path)}
                  alt={image.filename || "Image"}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "/placeholder-image.jpg";
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
              </div>

              <div className="image-caption">
                {image.filename || image.path?.split("/").pop() || "Image"}
              </div>
            </div>
          ))}
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
                alt={selectedImage.filename || "Image"}
              />
            </div>

            <div className="image-details">
              <h3>{selectedImage.filename}</h3>
              <p className="image-path">{selectedImage.path}</p>

              {selectedImage.insights?.bodyPart && (
                <p className="detail-item">
                  <strong>Body part:</strong> {selectedImage.insights.bodyPart}
                </p>
              )}

              {selectedImage.similarity !== undefined && (
                <p className="detail-item">
                  <strong>Similarity:</strong>{" "}
                  {Math.round(selectedImage.similarity * 100)}%
                </p>
              )}

              {selectedImage.insights?.isLikelyTattoo !== undefined && (
                <p className="detail-item">
                  <strong>Contains tattoo:</strong>{" "}
                  {selectedImage.insights.isLikelyTattoo ? "Yes" : "No"}
                </p>
              )}

              {selectedImage.insights?.hasFaded && (
                <p className="detail-item">
                  <strong>Faded:</strong> Yes
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatImageResults;
