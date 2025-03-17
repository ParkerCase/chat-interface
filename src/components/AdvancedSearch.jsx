import React, { useState } from "react";
import { Search, X } from "lucide-react";
import "./AdvancedSearch.css";

function AdvancedSearch({ onResults }) {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState("all");
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();

    if (!searchQuery.trim()) return;

    try {
      setIsSearching(true);

      const response = await fetch(
        "http://147.182.247.128:4000/api/search/dropbox",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: searchQuery,
            type: searchType,
            limit: 20,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();

      // Format results for display
      let resultsText = `Search results for "${searchQuery}":\n\n`;

      if (data.results && data.results.length > 0) {
        data.results.forEach((result, index) => {
          resultsText += `${index + 1}. ${
            result.title || result.path || "Untitled"
          }\n`;

          if (result.path) {
            const encodedPath = encodeURIComponent(result.path);
            resultsText += `Path: <a href="/image-viewer?path=${encodedPath}" target="_blank">${result.path}</a>\n`;
          }

          if (result.text) {
            resultsText += `Content: ${result.text.substring(0, 150)}${
              result.text.length > 150 ? "..." : ""
            }\n`;
          }

          if (result.score) {
            resultsText += `Relevance: ${(result.score * 100).toFixed(1)}%\n`;
          }

          resultsText += "\n";
        });
      } else {
        resultsText +=
          "No results found. Try different search terms or categories.";
      }

      // Pass results to parent component
      onResults(resultsText);

      // Close search panel after successful search
      setShowSearch(false);
    } catch (error) {
      onResults(`Search error: ${error.message}. Please try again.`);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="advanced-search">
      <button
        onClick={() => setShowSearch(!showSearch)}
        className="search-toggle"
        aria-expanded={showSearch}
        aria-label="Toggle advanced search"
      >
        {showSearch ? <X size={18} /> : <Search size={18} />}
        <span>{showSearch ? "Close" : "Advanced Search"}</span>
      </button>

      {showSearch && (
        <div className="search-panel">
          <form onSubmit={handleSearch}>
            <div className="search-inputs">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search the image repository..."
                className="search-input"
                disabled={isSearching}
              />

              <select
                value={searchType}
                onChange={(e) => setSearchType(e.target.value)}
                className="search-type"
                disabled={isSearching}
              >
                <option value="all">All Content</option>
                <option value="images">Images Only</option>
                <option value="tattoos">Tattoos</option>
                <option value="removal">Removal Progress</option>
              </select>

              <button
                type="submit"
                className="search-button"
                disabled={isSearching || !searchQuery.trim()}
              >
                {isSearching ? "Searching..." : "Search"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default AdvancedSearch;
