// src/components/KeywordSearchComponent.jsx
import React, { useState, useEffect } from "react";
import { useImageKeywordSearch } from "../hooks/useImageKeywordSearch";
import ImageGrid from "./ImageGrid";

const KeywordSearchComponent = () => {
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(20);
  const { searchByKeyword, results, loading, error, totalCount } =
    useImageKeywordSearch();

  // Reset page when keyword changes
  useEffect(() => {
    setPage(0);
  }, [keyword]);

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (keyword.trim()) {
      await searchByKeyword(keyword, { limit, page });
    }
  };

  const handleNextPage = async () => {
    const nextPage = page + 1;
    setPage(nextPage);
    await searchByKeyword(keyword, { limit, page: nextPage });
  };

  const handlePrevPage = async () => {
    const prevPage = Math.max(0, page - 1);
    setPage(prevPage);
    await searchByKeyword(keyword, { limit, page: prevPage });
  };

  return (
    <div className="keyword-search">
      <div className="search-header">
        <h2>Search Images by Keyword</h2>
        <p className="search-description">
          Search for tattoo images using keywords. You can search for body
          parts, tattoo styles, or other features detected in images.
        </p>
      </div>

      <form onSubmit={handleSearch} className="search-form">
        <div className="input-wrapper">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Enter keywords (e.g., faded, arm, rose)"
            className="search-input"
          />
          <button
            type="submit"
            className="search-button"
            disabled={loading || !keyword.trim()}
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </div>

        <div className="search-options">
          <label>
            Results per page:
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="limit-select"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
        </div>
      </form>

      {error && <div className="error-message">Error: {error}</div>}

      {results.length > 0 && (
        <div className="search-results">
          <div className="results-header">
            <h3>Search Results</h3>
            <p>
              Found {totalCount} images matching "{keyword}"
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

      {!loading && keyword && results.length === 0 && (
        <div className="no-results">
          <p>No images found for "{keyword}"</p>
          <p>Try different keywords or check your spelling</p>
        </div>
      )}
    </div>
  );
};

export default KeywordSearchComponent;
