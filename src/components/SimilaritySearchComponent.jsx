// src/components/SimilaritySearchComponent.jsx
import React, { useState, useRef } from "react";
import { useImageSimilaritySearch } from "../hooks/useImageSimilaritySearch";
import { useImagePathSearch } from "../hooks/useImagePathSearch";
import ImageGrid from "./ImageGrid";

const SimilaritySearchComponent = () => {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [searchMode, setSearchMode] = useState("upload"); // 'upload' or 'select'
  const [limit, setLimit] = useState(20);
  const [threshold, setThreshold] = useState(0.6);
  const [showProcessingOptions, setShowProcessingOptions] = useState(false);
  const [processingOptions, setProcessingOptions] = useState({
    generateFull: true,
    generatePartial: false,
    analyze: true,
    store: false,
    imagePath: "",
  });
  const [recentlySearched, setRecentlySearched] = useState([]);
  const [selectedPath, setSelectedPath] = useState("");
  const [folderFilter, setFolderFilter] = useState("");

  // Hooks
  const {
    searchSimilarImages,
    searchSimilarByPath,
    processNewImage,
    results,
    loading,
    error,
    processingProgress,
  } = useImageSimilaritySearch();

  const { searchByPath, results: pathResults } = useImagePathSearch();

  // Handle file upload change
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);

      // Create preview URL
      const fileUrl = URL.createObjectURL(file);
      setPreviewUrl(fileUrl);

      // Reset results
      setRecentlySearched(
        [
          ...recentlySearched,
          {
            type: "file",
            name: file.name,
            timestamp: new Date().toISOString(),
          },
        ].slice(-5)
      );
    }
  };

  // Trigger file dialog
  const handleBrowseClick = () => {
    fileInputRef.current.click();
  };

  // Handle image drop
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("image/")) {
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));

        // Add to recently searched
        setRecentlySearched(
          [
            ...recentlySearched,
            {
              type: "file",
              name: file.name,
              timestamp: new Date().toISOString(),
            },
          ].slice(-5)
        );
      }
    }
  };

  // Prevent default drag behavior
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Handle search with the selected file
  const handleSearch = async () => {
    if (searchMode === "upload" && selectedFile) {
      await searchSimilarImages(selectedFile, {
        limit,
        threshold: parseFloat(threshold),
      });
    } else if (searchMode === "select" && selectedPath) {
      await searchSimilarByPath(selectedPath, {
        limit,
        threshold: parseFloat(threshold),
      });

      // Add to recently searched
      if (!recentlySearched.some((item) => item.path === selectedPath)) {
        setRecentlySearched(
          [
            ...recentlySearched,
            {
              type: "path",
              path: selectedPath,
              name: selectedPath.split("/").pop(),
              timestamp: new Date().toISOString(),
            },
          ].slice(-5)
        );
      }
    }
  };

  // Handle processing with the selected file
  const handleProcessImage = async () => {
    if (selectedFile) {
      try {
        const result = await processNewImage(selectedFile, processingOptions);
        console.log("Image processed:", result);

        // Show success message or notification
        alert("Image successfully processed and stored in database");
      } catch (err) {
        console.error("Error processing image:", err);
        alert("Error processing image: " + err.message);
      }
    }
  };

  // Handle path search to select an image
  const handlePathSearch = async () => {
    if (folderFilter) {
      await searchByPath(folderFilter, { limit: 20 });
    }
  };

  // Select image from path results
  const handleSelectImage = (image) => {
    setSelectedPath(image.path);
    setPreviewUrl(`/api/image-proxy?path=${encodeURIComponent(image.path)}`);
  };

  return (
    <div className="similarity-search">
      <div className="search-header">
        <h2>Find Similar Images</h2>
        <p className="search-description">
          Search for similar images using vector embeddings. You can upload a
          new image or select an existing image from the database.
        </p>
      </div>

      {/* Search mode toggle */}
      <div className="search-mode-toggle">
        <button
          className={`mode-button ${searchMode === "upload" ? "active" : ""}`}
          onClick={() => setSearchMode("upload")}
        >
          Upload Image
        </button>
        <button
          className={`mode-button ${searchMode === "select" ? "active" : ""}`}
          onClick={() => setSearchMode("select")}
        >
          Select Existing Image
        </button>
      </div>

      {/* File upload section */}
      {searchMode === "upload" && (
        <div className="file-upload-section">
          <div
            className="drop-zone"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={handleBrowseClick}
          >
            {previewUrl ? (
              <img src={previewUrl} alt="Preview" className="image-preview" />
            ) : (
              <div className="drop-zone-content">
                <p>Drag and drop an image here or click to browse</p>
                <p className="drop-zone-small">
                  Supported formats: JPG, PNG, GIF
                </p>
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              style={{ display: "none" }}
            />
          </div>

          {selectedFile && (
            <div className="selected-file-info">
              <p>Selected file: {selectedFile.name}</p>
              <p>Size: {(selectedFile.size / 1024).toFixed(2)} KB</p>
            </div>
          )}

          <div className="processing-options-toggle">
            <button
              onClick={() => setShowProcessingOptions(!showProcessingOptions)}
              className="toggle-options-button"
            >
              {showProcessingOptions
                ? "Hide Processing Options"
                : "Show Processing Options"}
            </button>
          </div>

          {showProcessingOptions && (
            <div className="processing-options">
              <h4>Image Processing Options</h4>

              <label className="option-checkbox">
                <input
                  type="checkbox"
                  checked={processingOptions.generateFull}
                  onChange={() =>
                    setProcessingOptions({
                      ...processingOptions,
                      generateFull: !processingOptions.generateFull,
                    })
                  }
                />
                Generate Full Embedding
              </label>

              <label className="option-checkbox">
                <input
                  type="checkbox"
                  checked={processingOptions.generatePartial}
                  onChange={() =>
                    setProcessingOptions({
                      ...processingOptions,
                      generatePartial: !processingOptions.generatePartial,
                    })
                  }
                />
                Generate Partial Embedding
              </label>

              <label className="option-checkbox">
                <input
                  type="checkbox"
                  checked={processingOptions.analyze}
                  onChange={() =>
                    setProcessingOptions({
                      ...processingOptions,
                      analyze: !processingOptions.analyze,
                    })
                  }
                />
                Run Image Analysis
              </label>

              <label className="option-checkbox">
                <input
                  type="checkbox"
                  checked={processingOptions.store}
                  onChange={() =>
                    setProcessingOptions({
                      ...processingOptions,
                      store: !processingOptions.store,
                    })
                  }
                />
                Store in Database
              </label>

              {processingOptions.store && (
                <div className="path-input">
                  <label>Storage Path:</label>
                  <input
                    type="text"
                    value={processingOptions.imagePath}
                    onChange={(e) =>
                      setProcessingOptions({
                        ...processingOptions,
                        imagePath: e.target.value,
                      })
                    }
                    placeholder="e.g., dropbox:/photos/new-uploads/image.jpg"
                  />
                </div>
              )}

              <button
                onClick={handleProcessImage}
                disabled={!selectedFile || loading}
                className="process-button"
              >
                {loading ? "Processing..." : "Process Image"}
              </button>

              {loading && processingProgress > 0 && (
                <div className="processing-progress">
                  <div className="progress-bar">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${processingProgress}%` }}
                    ></div>
                  </div>
                  <p>{processingProgress}% complete</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Image selection section */}
      {searchMode === "select" && (
        <div className="image-selection-section">
          <div className="image-search">
            <div className="input-wrapper">
              <input
                type="text"
                value={folderFilter}
                onChange={(e) => setFolderFilter(e.target.value)}
                placeholder="Enter folder name or path to filter images"
                className="search-input"
              />
              <button
                onClick={handlePathSearch}
                disabled={loading || !folderFilter.trim()}
                className="search-button"
              >
                Search
              </button>
            </div>
          </div>

          {/* Show path search results */}
          {pathResults.length > 0 && (
            <div className="path-results">
              <h4>Select an image:</h4>
              <div className="image-grid-small">
                <ImageGrid
                  images={pathResults}
                  onImageClick={handleSelectImage}
                  columns={6}
                  showDetails={false}
                />
              </div>
            </div>
          )}

          {/* Show selected image preview */}
          {selectedPath && (
            <div className="selected-image-preview">
              <h4>Selected image:</h4>
              <img
                src={`/api/image-proxy?path=${encodeURIComponent(
                  selectedPath
                )}`}
                alt="Selected"
                className="preview-image"
              />
              <p>{selectedPath}</p>
            </div>
          )}

          {/* Recently searched items */}
          {recentlySearched.length > 0 && (
            <div className="recent-searches">
              <h4>Recent searches:</h4>
              <div className="recent-list">
                {recentlySearched.map((item, index) => (
                  <div
                    key={index}
                    className="recent-item"
                    onClick={() => {
                      if (item.type === "path") {
                        setSelectedPath(item.path);
                        setPreviewUrl(
                          `/api/image-proxy?path=${encodeURIComponent(
                            item.path
                          )}`
                        );
                      }
                    }}
                  >
                    <span className="recent-icon">
                      {item.type === "file" ? "📁" : "🖼️"}
                    </span>
                    <span className="recent-name">{item.name}</span>
                    <span className="recent-time">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search options */}
      <div className="search-controls">
        <div className="search-options">
          <div className="option-group">
            <label>
              Results limit:
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="limit-select"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </label>
          </div>

          <div className="option-group">
            <label>
              Similarity threshold:
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.05"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="threshold-slider"
              />
              <span className="threshold-value">{threshold}</span>
            </label>
          </div>
        </div>

        <button
          onClick={handleSearch}
          disabled={
            loading ||
            (searchMode === "upload" && !selectedFile) ||
            (searchMode === "select" && !selectedPath)
          }
          className="search-button primary"
        >
          {loading ? "Searching..." : "Find Similar Images"}
        </button>
      </div>

      {error && <div className="error-message">Error: {error}</div>}

      {/* Results section */}
      {results.length > 0 && (
        <div className="search-results">
          <div className="results-header">
            <h3>Similar Images</h3>
            <p>Found {results.length} similar images (sorted by similarity)</p>
          </div>

          <ImageGrid
            images={results}
            onImageClick={(image) => {
              console.log("Similar image clicked:", image);
              // You can add modal preview or navigation here
            }}
          />
        </div>
      )}

      {!loading &&
        ((searchMode === "upload" && selectedFile) ||
          (searchMode === "select" && selectedPath)) &&
        results.length === 0 && (
          <div className="no-results">
            <p>No similar images found</p>
            <p>
              Try adjusting the similarity threshold or using a different image
            </p>
          </div>
        )}
    </div>
  );
};

export default SimilaritySearchComponent;
