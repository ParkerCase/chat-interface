// src/components/SimpleImage.jsx
import React, { useState, useEffect } from "react";

/**
 * Production-ready image component with proper error handling and loading states
 */
const SimpleImage = ({
  src,
  alt = "Image",
  className = "search-result-image",
  fallbackSrc = "/placeholder-image.jpg",
  onLoad,
  onError,
}) => {
  const [status, setStatus] = useState("loading");
  const [imageSrc, setImageSrc] = useState(src);

  // Reset state when src changes
  useEffect(() => {
    setStatus("loading");
    setImageSrc(src);
  }, [src]);

  const handleLoad = (e) => {
    setStatus("loaded");
    if (onLoad) onLoad(e);
  };

  const handleError = (e) => {
    console.error(`Failed to load image: ${src}`);
    setStatus("error");
    setImageSrc(fallbackSrc);
    if (onError) onError(e);
  };

  return (
    <div className={`image-wrapper ${status}`}>
      {status === "loading" && (
        <div className="image-loading-indicator">
          <div className="spinner"></div>
        </div>
      )}

      <img
        src={imageSrc}
        alt={alt}
        className={className}
        onLoad={handleLoad}
        onError={handleError}
        style={{
          opacity: status === "loading" ? 0.3 : 1,
          transition: "opacity 0.3s ease",
        }}
      />

      {status === "error" && (
        <div className="image-error-badge">
          <span>Failed to load</span>
        </div>
      )}
    </div>
  );
};

export default SimpleImage;
