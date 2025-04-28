// src/components/ImageGrid.jsx
import React, { useState } from "react";

/**
 * Enhanced ImageGrid component that works with the StorageManager format
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
  const [loadingImages, setLoadingImages] = useState({});
  const [failedImages, setFailedImages] = useState({});

  // If no images, show empty state
  if (!images || images.length === 0) {
    return (
      <div className="image-grid-empty">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  /**
   * Enhanced function to generate image URL based on storage provider
   * This works with the unified path format from StorageManager
   * @param {string} imagePath - Path to the image
   * @returns {string} URL for the image
   */
  const getImageUrl = (imagePath) => {
    if (!imagePath) return "/placeholder-image.jpg";

    // Add cache busting parameter for better development experience
    const cacheBuster = `t=${Date.now()}`;

    // Always proxy through our backend API to handle any storage provider
    return `/api/image-proxy?path=${encodeURIComponent(
      imagePath
    )}&${cacheBuster}`;
  };

  /**
   * Handle image load start
   * @param {string} imageId - ID of the image
   */
  const handleImageLoadStart = (imageId) => {
    setLoadingImages((prev) => ({
      ...prev,
      [imageId]: true,
    }));
  };

  /**
   * Handle image load success
   * @param {string} imageId - ID of the image
   */
  const handleImageLoadSuccess = (imageId) => {
    setLoadingImages((prev) => {
      const newState = { ...prev };
      delete newState[imageId];
      return newState;
    });

    // Clear any previous failure state
    setFailedImages((prev) => {
      if (!prev[imageId]) return prev;
      const newState = { ...prev };
      delete newState[imageId];
      return newState;
    });
  };

  /**
   * Handle image load error
   * @param {string} imageId - ID of the image
   * @param {Object} image - Image object
   */
  const handleImageLoadError = (imageId, image) => {
    console.warn(`Failed to load image: ${image.path}`);

    // Mark image as failed
    setFailedImages((prev) => ({
      ...prev,
      [imageId]: true,
    }));

    // Clear loading state
    setLoadingImages((prev) => {
      const newState = { ...prev };
      delete newState[imageId];
      return newState;
    });
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
      {images.map((image, index) => {
        const imageId = image.id || `img-${index}`;
        const isLoading = !!loadingImages[imageId];
        const hasFailed = !!failedImages[imageId];

        // Handle different path formats to ensure they work with our image proxy
        let imagePath = image.path;

        // If the image has a provider explicitly set, use provider:// format
        if (image.provider && !imagePath.startsWith(`${image.provider}://`)) {
          // Remove leading slash if present
          const normalizedPath = imagePath.startsWith("/")
            ? imagePath.substring(1)
            : imagePath;
          imagePath = `${image.provider}://${normalizedPath}`;
        }

        // Get the final image URL for display
        const imageUrl = getImageUrl(imagePath);

        return (
          <div
            key={imageId}
            className={`image-card ${isLoading ? "loading" : ""} ${
              hasFailed ? "failed" : ""
            }`}
            onClick={() => onImageClick && onImageClick(image)}
          >
            <div className="image-container">
              {isLoading && (
                <div className="image-loading-indicator">
                  <div className="spinner"></div>
                </div>
              )}

              <img
                src={imageUrl}
                alt={image.filename || image.name || "Image"}
                onLoad={() => handleImageLoadSuccess(imageId)}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "/placeholder-image.jpg";
                  handleImageLoadError(imageId, image);
                }}
                style={{ opacity: isLoading ? 0.3 : 1 }}
                onLoadStart={() => handleImageLoadStart(imageId)}
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
                <div className="image-error-badge">Failed to load</div>
              )}
            </div>

            {showDetails && (
              <div className="image-details">
                <p className="image-filename">
                  {image.filename ||
                    image.name ||
                    image.path?.split("/").pop() ||
                    "Unknown"}
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

                {/* Show provider if available */}
                {image.provider && (
                  <p className="image-provider">Provider: {image.provider}</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ImageGrid;
