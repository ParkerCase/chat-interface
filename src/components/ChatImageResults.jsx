// src/components/ChatImageResults.jsx
import React, { useState, useEffect, useRef } from "react";
import "./ChatImageResults.css"; // Make sure to create this CSS file

/**
 * Production-ready ChatImageResults component
 * Displays image search results in chat messages
 */
const ChatImageResults = ({
  images = [],
  responseText = "",
  searchParams = {},
  onImageClick,
  onSearchWithImage = null, // Add this prop with default value
  onCopyPath = null, // Add this prop with default value
  onGetMore = null, // Add this new prop
}) => {
  const [expanded, setExpanded] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [errorStates, setErrorStates] = useState({});

  // Add an image cache ref to avoid reloading images
  const imageCache = useRef({});

  // Reset states when images change
  useEffect(() => {
    setErrorStates({});
  }, [images]);

  // Display settings
  const maxImagesToShow = images.length > 8 ? 6 : images.length;
  const hasMoreImages = images.length > maxImagesToShow;

  /**
   * Enhanced function to generate image URL with direct backend access
   * @param {string|Object} imagePath - Path to the image or image object
   * @returns {string} URL for the image
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
    } else if (typeof imagePath === "object" && imagePath.path) {
      normalizedPath = imagePath.path.trim();
    } else {
      console.warn("Invalid image path format:", imagePath);
      return "/placeholder-image.jpg";
    }

    // Ensure path has the proper prefix format
    if (!normalizedPath.includes("://")) {
      // Remove any leading slashes for consistency
      if (normalizedPath.startsWith("/")) {
        normalizedPath = normalizedPath.substring(1);
      }

      // Add dropbox: prefix if not present
      if (!normalizedPath.startsWith("dropbox:")) {
        normalizedPath = `dropbox:${normalizedPath}`;
      }
    }

    // Use the DIRECT backend URL instead of relying on proxy
    return `http://147.182.247.128:4000/api/image-proxy?path=${encodeURIComponent(
      normalizedPath
    )}&${cacheBuster}`;
  };

  const handleGetMore = async () => {
    if (!searchParams || !onGetMore) return;

    // Call the parent component's onGetMore handler
    onGetMore(searchParams);
  };

  /**
   * Custom hook to safely load cross-origin images
   */
  function useImageLoader(src, cacheKey) {
    const [status, setStatus] = useState("loading");
    const [dataUrl, setDataUrl] = useState(null);

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

      // Show loading state
      setStatus("loading");

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
        console.error(`Failed to load image: ${src}`);
        setStatus("error");
      };

      // Set crossOrigin to anonymous to prevent CORS issues when using canvas
      img.crossOrigin = "anonymous";

      // Begin image loading
      img.src = src;

      // Cleanup function
      return () => {
        img.onload = null;
        img.onerror = null;
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
   * @param {Object} image - Image data
   */
  const handleImageClick = (image) => {
    setSelectedImage(image);
    if (onImageClick) {
      onImageClick(image);
    }
  };

  /**
   * Handle clicking "Show more" button
   */
  const handleShowMore = () => {
    console.log("Show more clicked", searchParams);
    // Implementation for showing more results
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

      {searchParams?.hasMore && (
        <div style={{ marginTop: "1rem", textAlign: "center" }}>
          <button
            className="get-more-btn"
            onClick={() => onGetMore(searchParams)}
          >
            Get more images
          </button>
        </div>
      )}

      {/* Image detail modal - Enhanced Version */}
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
                {expanded && hasMoreImages && (
                  <div className="chat-results-footer">
                    <button className="get-more-btn" onClick={handleGetMore}>
                      Get More Images
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatImageResults;
