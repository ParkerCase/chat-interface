// Enhanced ChatImageResults.jsx with better error handling and pagination
import React, { useState, useEffect, useRef } from "react";
import "./ChatImageResults.css";

/**
 * Production-ready ChatImageResults component with improved reliability
 * Displays image search results in chat messages
 */
const ChatImageResults = ({
  images = [],
  responseText = "",
  searchParams = {},
  onImageClick,
  onSearchWithImage = null,
  onCopyPath = null,
  onGetMore = null,
}) => {
  const [expanded, setExpanded] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [errorStates, setErrorStates] = useState({});
  const [loadingMore, setLoadingMore] = useState(false);

  // Add an image cache ref to avoid reloading images
  const imageCache = useRef({});
  const retryTimeouts = useRef({});

  // Reset states when images change
  useEffect(() => {
    setErrorStates({});
  }, [images]);

  // Clear retry timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(retryTimeouts.current).forEach((timeout) =>
        clearTimeout(timeout)
      );
    };
  }, []);

  // Display settings
  const maxImagesToShow = images.length > 8 ? 6 : images.length;
  const hasMoreImages = images.length > maxImagesToShow;

  /**
   * Enhanced function to generate image URL with improved error handling
   */
  const getImageUrl = (imagePath) => {
    if (!imagePath) return "/placeholder-image.jpg";

    // Add cache busting parameter
    const cacheBuster = `t=${Date.now()}`;

    // Clean up the path
    let normalizedPath = "";

    // Handle different input formats
    if (typeof imagePath === "string") {
      normalizedPath = imagePath.trim();

      // Remove leading slash for consistency if it exists
      if (normalizedPath.startsWith("/")) {
        normalizedPath = normalizedPath.substring(1);
      }

      // Add dropbox: prefix if not present and not already prefixed
      if (
        !normalizedPath.includes("://") &&
        !normalizedPath.startsWith("dropbox:")
      ) {
        normalizedPath = `dropbox:${normalizedPath}`;
      }
    } else if (typeof imagePath === "object" && imagePath.path) {
      return getImageUrl(imagePath.path);
    } else {
      console.warn("Invalid image path format:", imagePath);
      return "/placeholder-image.jpg";
    }

    // Use the direct backend URL
    return `/api/image-proxy?path=${encodeURIComponent(
      normalizedPath
    )}&${cacheBuster}`;
  };

  /**
   * Handle getting more images
   */
  const handleGetMore = async () => {
    if (!searchParams || !onGetMore || loadingMore) return;

    try {
      setLoadingMore(true);
      await onGetMore(searchParams);
    } catch (error) {
      console.error("Error getting more images:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  /**
   * Custom hook to safely load cross-origin images with retry logic
   */
  function useImageLoader(src, cacheKey) {
    const [status, setStatus] = useState("loading");
    const [dataUrl, setDataUrl] = useState(null);
    const retryCount = useRef(0);

    useEffect(() => {
      // Skip if no src
      if (!src) {
        setStatus("error");
        return;
      }

      // Check cache first
      if (imageCache.current[cacheKey]) {
        setDataUrl(imageCache.current[cacheKey]);
        setStatus("loaded");
        return;
      }

      // Reset retry count when src changes
      retryCount.current = 0;

      // Show loading state
      setStatus("loading");

      // Function to attempt loading with retry logic
      const attemptLoad = () => {
        // Create an image element to load the image
        const img = new Image();

        // Set up event handlers
        img.onload = () => {
          try {
            // Create a canvas to convert the image to a data URL
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;

            // Draw the image to the canvas
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);

            // Convert to data URL
            const dataUrl = canvas.toDataURL("image/jpeg");

            // Cache the result
            imageCache.current[cacheKey] = dataUrl;

            // Update state
            setDataUrl(dataUrl);
            setStatus("loaded");
          } catch (error) {
            console.error("Error converting image to data URL:", error);
            setStatus("error");
          }
        };

        img.onerror = () => {
          console.error(
            `Failed to load image (attempt ${retryCount.current + 1}): ${src}`
          );

          // Attempt retry with different approach if we haven't exceeded max retries
          if (retryCount.current < 2) {
            retryCount.current += 1;

            // Clear any existing timeout
            if (retryTimeouts.current[cacheKey]) {
              clearTimeout(retryTimeouts.current[cacheKey]);
            }

            // Different retry strategy based on retry count
            let retrySrc = src;

            if (retryCount.current === 1) {
              // First retry: Try with a different path format
              if (typeof src === "string") {
                // Try without dropbox: prefix if it has one, or add it if it doesn't
                if (src.includes("dropbox:")) {
                  retrySrc = src.replace("dropbox:", "");
                } else {
                  const parts = new URL(src, window.location.origin);
                  const path = new URLSearchParams(parts.search).get("path");
                  if (path) {
                    const modifiedPath = path.startsWith("dropbox:")
                      ? path.substring(7)
                      : `dropbox:${path}`;
                    retrySrc = `/api/image-proxy?path=${encodeURIComponent(
                      modifiedPath
                    )}&t=${Date.now()}`;
                  }
                }
              }

              // Try immediately with the modified URL
              setTimeout(attemptLoad, 100);
            } else {
              // Second retry: Try direct API URL with delay
              retryTimeouts.current[cacheKey] = setTimeout(() => {
                // Try direct URL with cache buster
                const directUrl = `/api/direct-image?path=${encodeURIComponent(
                  typeof src === "string" && src.includes("?path=")
                    ? new URL(src, window.location.origin).searchParams.get(
                        "path"
                      )
                    : src
                )}&t=${Date.now()}`;

                img.src = directUrl;
              }, 2000);
            }
          } else {
            // Max retries exceeded
            setStatus("error");
          }
        };

        // Set crossOrigin to anonymous to prevent CORS issues when using canvas
        img.crossOrigin = "anonymous";

        // Begin image loading
        img.src = src;
      };

      // Start first attempt
      attemptLoad();

      // Cleanup function
      return () => {
        // Clear any pending retry timeouts for this image
        if (retryTimeouts.current[cacheKey]) {
          clearTimeout(retryTimeouts.current[cacheKey]);
          delete retryTimeouts.current[cacheKey];
        }
      };
    }, [src, cacheKey]);

    return { status, dataUrl };
  }

  /**
   * Image component that handles CORS issues
   */
  function SafeImage({ src, alt, imageId }) {
    const { status, dataUrl } = useImageLoader(src, imageId);

    if (status === "loading") {
      return (
        <div className="image-loading-indicator">
          <div className="spinner"></div>
        </div>
      );
    }

    if (status === "error") {
      return (
        <img
          src="/placeholder-image.jpg"
          alt={`Failed to load: ${alt}`}
          className="search-result-image error-image"
        />
      );
    }

    return <img src={dataUrl} alt={alt} className="search-result-image" />;
  }

  /**
   * Handle clicking an image
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
            const imageUrl = getImageUrl(image.path);
            const hasError = !!errorStates[imageId];

            return (
              <div
                key={imageId}
                className={`chat-image-item ${hasError ? "failed" : ""}`}
                onClick={() => !hasError && handleImageClick(image)}
              >
                <div className="image-container">
                  <SafeImage
                    src={imageUrl}
                    alt={image.filename || image.name || "Image"}
                    imageId={imageId}
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

                  {/* Show provider badge if available */}
                  {image.provider && (
                    <div className="provider-badge">{image.provider}</div>
                  )}
                </div>

                <div className="image-caption">
                  {image.filename ||
                    image.name ||
                    (typeof image.path === "string" &&
                      image.path.split("/").pop()) ||
                    "Image"}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* "Get more images" button */}
      {expanded && searchParams?.hasMore && (
        <div className="chat-results-footer">
          <button
            className="get-more-btn"
            onClick={handleGetMore}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading more..." : "Get more images"}
          </button>
        </div>
      )}

      {/* Image detail modal */}
      {selectedImage && (
        <div className="image-detail-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Image Viewer</h3>
              <button
                className="close-modal-btn"
                onClick={() => setSelectedImage(null)}
              >
                &times;
              </button>
            </div>

            <div className="modal-image-container">
              <SafeImage
                src={getImageUrl(selectedImage.path)}
                alt={selectedImage.filename || selectedImage.name || "Image"}
                imageId={`modal-${selectedImage.id || "image"}`}
              />
            </div>

            <div className="modal-footer">
              <div className="image-path">
                {typeof selectedImage.path === "string"
                  ? selectedImage.path.replace(/^dropbox:/, "")
                  : "Unknown path"}
              </div>

              <div className="modal-actions">
                <button
                  className="modal-action-button copy-path-btn"
                  onClick={() => {
                    const cleanPath =
                      typeof selectedImage.path === "string"
                        ? selectedImage.path.replace(/^dropbox:/, "")
                        : "";
                    navigator.clipboard.writeText(cleanPath);

                    // Show feedback toast
                    const toast = document.createElement("div");
                    toast.className = "copy-toast";
                    toast.innerText = "Path copied to clipboard";
                    document.body.appendChild(toast);

                    // Remove toast after 2 seconds
                    setTimeout(() => {
                      toast.classList.add("fade-out");
                      setTimeout(() => document.body.removeChild(toast), 500);
                    }, 1500);

                    // Call optional callback
                    if (onCopyPath) onCopyPath(cleanPath);
                  }}
                >
                  <span className="action-icon">📋</span>
                  Copy Path
                </button>

                <button
                  className="modal-action-button search-btn"
                  onClick={() => {
                    // Close the modal
                    setSelectedImage(null);

                    // Create search query
                    const searchQuery = `Find images similar to: ${selectedImage.path.replace(
                      /^dropbox:/,
                      ""
                    )}`;

                    // If you have a search function in parent component, call it via prop
                    if (onSearchWithImage) {
                      onSearchWithImage(selectedImage.path, searchQuery);
                    } else {
                      console.log("Search with image:", selectedImage.path);
                    }
                  }}
                >
                  <span className="action-icon">🔍</span>
                  Use in Search
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
