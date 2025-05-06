// Enhanced ImageGrid component for improved rendering reliability
// Update src/components/ImageGrid.jsx

import React, { useState, useEffect, useRef } from "react";

/**
 * Enhanced ImageGrid component with better error handling and rendering
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
  const [imageCache, setImageCache] = useState({});
  const retryTimeouts = useRef({});

  // Clear retry timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(retryTimeouts.current).forEach((timeout) =>
        clearTimeout(timeout)
      );
    };
  }, []);

  // Reset states when images change
  useEffect(() => {
    setFailedImages({});
    setLoadingImages({});
  }, [images]);

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
   * This works with the unified path format
   */
  const getImageUrl = (imagePath) => {
    if (!imagePath) return "/placeholder-image.jpg";

    // Add cache busting parameter for better development experience
    const cacheBuster = `t=${Date.now()}`;

    // Handle different path formats
    let normalizedPath = imagePath;

    // Remove 'dropbox:' prefix if present
    if (
      typeof normalizedPath === "string" &&
      normalizedPath.startsWith("dropbox:")
    ) {
      normalizedPath = normalizedPath.substring(7);
    }

    // Ensure path starts with '/' for proper URL construction
    if (typeof normalizedPath === "string" && !normalizedPath.startsWith("/")) {
      normalizedPath = "/" + normalizedPath;
    }

    // Always proxy through our backend API to handle any storage provider
    return `/api/image-proxy?path=${encodeURIComponent(
      normalizedPath
    )}&${cacheBuster}`;
  };

  /**
   * Handle image load start
   */
  const handleImageLoadStart = (imageId) => {
    setLoadingImages((prev) => ({
      ...prev,
      [imageId]: true,
    }));
  };

  /**
   * Handle image load success
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

    // Clear any retry timeouts
    if (retryTimeouts.current[imageId]) {
      clearTimeout(retryTimeouts.current[imageId]);
      delete retryTimeouts.current[imageId];
    }
  };

  /**
   * Handle image load error with retry logic
   */
  const handleImageLoadError = (imageId, image, imgElement, retryCount = 0) => {
    console.warn(
      `Failed to load image (attempt ${retryCount + 1}): ${image.path}`
    );

    // Mark image as failed if we've exceeded retries
    if (retryCount >= 2) {
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

      return;
    }

    // Try with a different error handling approach based on retry count
    if (retryCount === 0) {
      // First retry: Try with a different path format
      let altPath = image.path;

      // Try alternative path format (add/remove dropbox prefix)
      if (typeof altPath === "string") {
        if (altPath.startsWith("dropbox:")) {
          altPath = altPath.substring(7);
        } else {
          altPath = "dropbox:" + altPath;
        }
      }

      const altUrl = `/api/image-proxy?path=${encodeURIComponent(
        altPath
      )}&t=${Date.now()}`;

      // Clear previous error handler to avoid loops
      imgElement.onerror = null;

      // Set new error handler for this retry
      imgElement.onerror = () => {
        handleImageLoadError(imageId, image, imgElement, retryCount + 1);
      };

      // Try with the alternative URL
      imgElement.src = altUrl;
    } else {
      // Second retry: Try with a timeout and direct API URL
      // Clear any existing timeouts
      if (retryTimeouts.current[imageId]) {
        clearTimeout(retryTimeouts.current[imageId]);
      }

      // Set a timeout to retry loading after a delay
      retryTimeouts.current[imageId] = setTimeout(() => {
        // Try with a direct API URL if available
        const apiBaseUrl = window.location.origin;
        const directUrl = `${apiBaseUrl}/api/direct-image?path=${encodeURIComponent(
          image.path
        )}&t=${Date.now()}`;

        // Clear previous error handler
        imgElement.onerror = null;

        // Set final error handler
        imgElement.onerror = () => {
          // Final failure - set to placeholder
          imgElement.onerror = null;
          imgElement.src = "/placeholder-image.jpg";
          handleImageLoadError(imageId, image, imgElement, retryCount + 1);
        };

        // Try with direct URL
        imgElement.src = directUrl;
      }, 1000);
    }
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

        // Get the image URL
        const imageUrl = imageCache[imageId] || getImageUrl(image.path);

        return (
          <div
            key={imageId}
            className={`image-card ${isLoading ? "loading" : ""} ${
              hasFailed ? "failed" : ""
            }`}
            onClick={() => !isLoading && onImageClick && onImageClick(image)}
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
                  handleImageLoadError(imageId, image, e.target);
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
                    (typeof image.path === "string" &&
                      image.path.split("/").pop()) ||
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
