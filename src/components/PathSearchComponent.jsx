// src/components/PathSearchComponent.jsx
import React, { useState, useEffect } from "react";
import { useImagePathSearch } from "../hooks/useImagePathSearch";
import ImageGrid from "./ImageGrid";

const PathSearchComponent = () => {
  const [pathPattern, setPathPattern] = useState("");
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState("");
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(20);
  const [viewMode, setViewMode] = useState("search"); // 'search' or 'browse'

  const {
    searchByPath,
    getFolderHierarchy,
    results,
    loading,
    error,
    totalCount,
  } = useImagePathSearch();

  // Load folder hierarchy on component mount
  useEffect(() => {
    const loadFolders = async () => {
      const folderList = await getFolderHierarchy();
      setFolders(folderList);
    };

    loadFolders();
  }, []);

  // Reset page when search criteria changes
  useEffect(() => {
    setPage(0);
  }, [pathPattern, selectedFolder]);

  // Handle search by path pattern
  const handleSearch = async (e) => {
    e?.preventDefault();

    if (pathPattern.trim()) {
      await searchByPath(pathPattern, { limit, page });
    }
  };

  // Handle folder selection
  const handleFolderSelect = async (folder) => {
    setSelectedFolder(folder);
    await searchByPath(folder, { limit, page: 0 });
    setPage(0);
  };

  // Pagination handlers
  const handleNextPage = async () => {
    const nextPage = page + 1;
    setPage(nextPage);

    if (viewMode === "search") {
      await searchByPath(pathPattern, { limit, page: nextPage });
    } else {
      await searchByPath(selectedFolder, { limit, page: nextPage });
    }
  };

  const handlePrevPage = async () => {
    const prevPage = Math.max(0, page - 1);
    setPage(prevPage);

    if (viewMode === "search") {
      await searchByPath(pathPattern, { limit, page: prevPage });
    } else {
      await searchByPath(selectedFolder, { limit, page: prevPage });
    }
  };

  // Render folder tree for browsing
  const renderFolderTree = () => {
    // Group folders by parent for tree structure
    const foldersByParent = {};
    folders.forEach((folder) => {
      const parentKey = folder.parent || "root";
      if (!foldersByParent[parentKey]) {
        foldersByParent[parentKey] = [];
      }
      foldersByParent[parentKey].push(folder);
    });

    // Helper function to render a folder and its children
    const renderFolder = (parentKey = "root", depth = 0) => {
      const childFolders = foldersByParent[parentKey] || [];

      return childFolders.map((folder) => (
        <div key={folder.path} className="folder-item">
          <button
            className={`folder-button ${
              selectedFolder === folder.path ? "selected" : ""
            }`}
            onClick={() => handleFolderSelect(folder.path)}
            style={{ marginLeft: `${depth * 16}px` }}
          >
            <span className="folder-icon">📁</span>
            <span className="folder-name">{folder.name}</span>
            <span className="folder-count">({folder.count})</span>
          </button>

          {foldersByParent[folder.path] && renderFolder(folder.path, depth + 1)}
        </div>
      ));
    };

    return (
      <div className="folder-tree">
        <h3>Folders</h3>
        {renderFolder()}
      </div>
    );
  };

  return (
    <div className="path-search">
      <div className="search-header">
        <h2>Find Images by Path</h2>
        <p className="search-description">
          Search for images based on their file path or browse folders.
        </p>

        <div className="view-mode-toggle">
          <button
            className={`toggle-button ${viewMode === "search" ? "active" : ""}`}
            onClick={() => setViewMode("search")}
          >
            Search by Path
          </button>
          <button
            className={`toggle-button ${viewMode === "browse" ? "active" : ""}`}
            onClick={() => setViewMode("browse")}
          >
            Browse Folders
          </button>
        </div>
      </div>

      {viewMode === "search" ? (
        <form onSubmit={handleSearch} className="search-form">
          <div className="input-wrapper">
            <input
              type="text"
              value={pathPattern}
              onChange={(e) => setPathPattern(e.target.value)}
              placeholder="Enter path or folder name (e.g., chicago, arm)"
              className="search-input"
            />
            <button
              type="submit"
              className="search-button"
              disabled={loading || !pathPattern.trim()}
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
      ) : (
        <div className="browse-container">
          <div className="folder-container">{renderFolderTree()}</div>

          <div className="browse-options">
            <label>
              Images per page:
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
        </div>
      )}

      {error && <div className="error-message">Error: {error}</div>}

      {results.length > 0 && (
        <div className="search-results">
          <div className="results-header">
            <h3>Search Results</h3>
            {viewMode === "search" ? (
              <p>
                Found {totalCount} images matching "{pathPattern}"
              </p>
            ) : (
              <p>
                Found {totalCount} images in folder: {selectedFolder}
              </p>
            )}

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

      {!loading &&
        viewMode === "search" &&
        pathPattern &&
        results.length === 0 && (
          <div className="no-results">
            <p>No images found for path "{pathPattern}"</p>
            <p>Try a different search pattern</p>
          </div>
        )}

      {!loading &&
        viewMode === "browse" &&
        selectedFolder &&
        results.length === 0 && (
          <div className="no-results">
            <p>No images found in folder "{selectedFolder}"</p>
          </div>
        )}
    </div>
  );
};

export default PathSearchComponent;
