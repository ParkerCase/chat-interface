// src/components/BodyPartSearchComponent.jsx
import React, { useState, useEffect } from "react";
import { useImageBodyPartSearch } from "../hooks/useImageBodyPartSearch";
import ImageGrid from "./ImageGrid";

// Default body part options if API doesn't return any
const defaultBodyPartOptions = [
  "arm",
  "leg",
  "back",
  "chest",
  "neck",
  "face",
  "hand",
  "foot",
  "ankle",
  "shoulder",
  "ribs",
  "hip",
  "thigh",
  "calf",
  "forearm",
];

const BodyPartSearchComponent = () => {
  const [selectedBodyPart, setSelectedBodyPart] = useState("");
  const [bodyParts, setBodyParts] = useState([]);
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(20);
  const [bodyPartCounts, setBodyPartCounts] = useState({});

  const {
    searchByBodyPart,
    loadAvailableBodyParts,
    results,
    loading,
    error,
    totalCount,
  } = useImageBodyPartSearch();

  // Load available body parts on component mount
  useEffect(() => {
    const loadBodyParts = async () => {
      const parts = await loadAvailableBodyParts();

      if (parts && parts.length > 0) {
        setBodyParts(parts);
        // Select first body part by default
        setSelectedBodyPart(parts[0]);
      } else {
        // Fall back to default options
        setBodyParts(defaultBodyPartOptions);
        setSelectedBodyPart(defaultBodyPartOptions[0]);
      }
    };

    loadBodyParts();
  }, []);

  // Perform initial search when selected body part changes
  useEffect(() => {
    if (selectedBodyPart) {
      handleSearch();
    }
  }, [selectedBodyPart]);

  // Reset page when body part changes
  useEffect(() => {
    setPage(0);
  }, [selectedBodyPart]);

  // Handle search by body part
  const handleSearch = async () => {
    if (selectedBodyPart) {
      await searchByBodyPart(selectedBodyPart, { limit, page });
    }
  };

  // Handle body part selection
  const handleBodyPartChange = (bodyPart) => {
    setSelectedBodyPart(bodyPart);
    setPage(0);
  };

  // Pagination handlers
  const handleNextPage = async () => {
    const nextPage = page + 1;
    setPage(nextPage);
    await searchByBodyPart(selectedBodyPart, { limit, page: nextPage });
  };

  const handlePrevPage = async () => {
    const prevPage = Math.max(0, page - 1);
    setPage(prevPage);
    await searchByBodyPart(selectedBodyPart, { limit, page: prevPage });
  };

  return (
    <div className="body-part-search">
      <div className="search-header">
        <h2>Search Images by Body Part</h2>
        <p className="search-description">
          Find tattoo images by specific body parts detected in the images.
        </p>
      </div>

      <div className="search-form">
        <div className="body-part-selector">
          <label htmlFor="body-part-select">Select body part:</label>
          <select
            id="body-part-select"
            value={selectedBodyPart}
            onChange={(e) => handleBodyPartChange(e.target.value)}
            className="body-part-select"
            disabled={loading || bodyParts.length === 0}
          >
            {bodyParts.length === 0 ? (
              <option value="">Loading body parts...</option>
            ) : (
              bodyParts.map((part) => (
                <option key={part} value={part}>
                  {part.charAt(0).toUpperCase() + part.slice(1)}
                  {bodyPartCounts[part] ? ` (${bodyPartCounts[part]})` : ""}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="search-options">
          <label>
            Results per page:
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(0); // Reset to first page when changing limit
                if (selectedBodyPart) {
                  searchByBodyPart(selectedBodyPart, {
                    limit: Number(e.target.value),
                    page: 0,
                  });
                }
              }}
              className="limit-select"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
        </div>
      </div>

      {/* Visual body part selector */}
      <div className="visual-body-selector">
        <div className="body-diagram">
          {/* This could be an SVG with clickable body regions */}
          <div
            className={`body-region ${
              selectedBodyPart === "arm" ? "active" : ""
            }`}
            onClick={() => handleBodyPartChange("arm")}
          >
            Arms
          </div>
          <div
            className={`body-region ${
              selectedBodyPart === "leg" ? "active" : ""
            }`}
            onClick={() => handleBodyPartChange("leg")}
          >
            Legs
          </div>
          <div
            className={`body-region ${
              selectedBodyPart === "back" ? "active" : ""
            }`}
            onClick={() => handleBodyPartChange("back")}
          >
            Back
          </div>
          <div
            className={`body-region ${
              selectedBodyPart === "chest" ? "active" : ""
            }`}
            onClick={() => handleBodyPartChange("chest")}
          >
            Chest
          </div>
          {/* Add more body regions as needed */}
        </div>
      </div>

      {error && <div className="error-message">Error: {error}</div>}

      {results.length > 0 && (
        <div className="search-results">
          <div className="results-header">
            <h3>Search Results</h3>
            <p>
              Found {totalCount} images for body part: {selectedBodyPart}
            </p>

            {totalCount > limit && (
              <div className="pagination">
                <button
                  onClick={handlePrevPage}
                  disabled={page === 0 || loading}
                  className="pagination-button"
                >
                  Previous
                </button>
                <span className="page-info">
                  Page {page + 1} of {Math.ceil(totalCount / limit)}
                </span>
                <button
                  onClick={handleNextPage}
                  disabled={(page + 1) * limit >= totalCount || loading}
                  className="pagination-button"
                >
                  Next
                </button>
              </div>
            )}
          </div>

          <ImageGrid
            images={results}
            onImageClick={(image) => {
              console.log("Image clicked:", image);
              // You can add modal preview or navigation here
            }}
          />
        </div>
      )}

      {!loading && selectedBodyPart && results.length === 0 && (
        <div className="no-results">
          <p>No images found for body part: {selectedBodyPart}</p>
          <p>Try selecting a different body part</p>
        </div>
      )}
    </div>
  );
};

export default BodyPartSearchComponent;
