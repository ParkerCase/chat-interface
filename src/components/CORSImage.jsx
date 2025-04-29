// src/components/CORSImage.jsx
import React, { useState, useEffect } from "react";

/**
 * Component that handles CORS image loading with credentials
 */
const CORSImage = ({
  src,
  alt = "Image",
  className = "search-result-image",
  fallbackSrc = "/placeholder-image.jpg",
  onLoad,
  onError,
}) => {
  const [status, setStatus] = useState("loading");
  const [imageSrc, setImageSrc] = useState(null);

  useEffect(() => {
    setStatus("loading");

    // Fetch image as blob with credentials
    fetch(src, {
      method: "GET",
      credentials: "include", // Send cookies and auth headers
      mode: "cors", // Enable CORS
      headers: {
        Accept: "image/*",
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `Failed to load image: ${response.status} ${response.statusText}`
          );
        }
        return response.blob();
      })
      .then((blob) => {
        // Create object URL from blob
        const objectUrl = URL.createObjectURL(blob);
        setImageSrc(objectUrl);
        setStatus("loaded");
        if (onLoad) onLoad();
      })
      .catch((error) => {
        console.error(error.message || `Failed to load image: ${src}`);
        setStatus("error");
        if (onError) onError(error);
      });

    // Cleanup function
    return () => {
      if (imageSrc) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [src, onLoad, onError]);

  return (
    <div className={`image-wrapper ${status}`}>
      {status === "loading" && (
        <div className="image-loading-indicator">
          <div className="spinner"></div>
        </div>
      )}

      {status === "loaded" && (
        <img
          src={imageSrc}
          alt={alt}
          className={className}
          onError={() => {
            console.error(`Image loaded but failed to display: ${src}`);
            setStatus("error");
            if (onError)
              onError(new Error("Image loaded but failed to display"));
          }}
        />
      )}

      {status === "error" && (
        <img
          src={fallbackSrc}
          alt={`Failed to load: ${alt}`}
          className={`${className} error-image`}
        />
      )}
    </div>
  );
};

export default CORSImage;
