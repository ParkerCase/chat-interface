// src/components/ImageGrid.jsx
import React from "react";
import { useSupabase } from "../hooks/useSupabase";

/**
 * Reusable component for displaying a grid of images with details
 * @param {Object} props - Component props
 * @param {Array} props.images - Array of image objects
 * @param {Function} props.onImageClick - Function to call when an image is clicked
 * @param {boolean} props.showDetails - Whether to show image details
 * @param {string} props.emptyMessage - Message to show when no images
 * @param {number} props.columns - Number of columns in the grid
 * @returns {JSX.Element} ImageGrid component
 */
const ImageGrid = ({
  images = [],
  onImageClick,
  showDetails = true,
  emptyMessage = "No images found",
  columns = 4,
}) => {
  const supabase = useSupabase();

  // If no images, show empty state
  if (!images || images.length === 0) {
    return (
      <div className="image-grid-empty">
        <p>{emptyMessage}</p>
      </div>
    );
  }

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

  return (
    <div
      className="image-grid"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: "16px",
      }}
    >
      {images.map((image, index) => (
        <div
          key={image.id || index}
          className="image-card"
          onClick={() => onImageClick && onImageClick(image)}
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

          {showDetails && (
            <div className="image-details">
              <p className="image-filename">
                {image.filename || image.path?.split("/").pop() || "Unknown"}
              </p>

              {/* Show additional details if available */}
              {image.insights?.bodyPart && (
                <p className="image-body-part">
                  Body part: {image.insights.bodyPart}
                </p>
              )}

              {image.insights?.isLikelyTattoo !== undefined && (
                <p className="image-tattoo-status">
                  {image.insights.isLikelyTattoo
                    ? "Contains tattoo"
                    : "No tattoo detected"}
                </p>
              )}

              {image.insights?.hasFaded && (
                <p className="image-faded-status">Faded tattoo</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default ImageGrid;
