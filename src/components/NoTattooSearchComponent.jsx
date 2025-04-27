// src/components/NoTattooSearchComponent.jsx
import React, { useState, useEffect } from "react";
import { useImageNoTattooSearch } from "../hooks/useImageNoTattooSearch";
import ImageGrid from "./ImageGrid";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

const NoTattooSearchComponent = () => {
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(20);
  const [stats, setStats] = useState(null);

  const {
    searchImagesWithoutTattoos,
    getTattooStats,
    results,
    loading,
    error,
    totalCount,
  } = useImageNoTattooSearch();

  // Load initial data on component mount
  useEffect(() => {
    handleSearch();
    loadStats();
  }, []);

  // Handle search for non-tattoo images
  const handleSearch = async () => {
    await searchImagesWithoutTattoos({ limit, page });
  };

  // Load tattoo vs non-tattoo statistics
  const loadStats = async () => {
    try {
      const statsData = await getTattooStats();
      setStats(statsData);
    } catch (err) {
      console.error("Error loading stats:", err);
    }
  };

  // Pagination handlers
  const handleNextPage = async () => {
    const nextPage = page + 1;
    setPage(nextPage);
    await searchImagesWithoutTattoos({ limit, page: nextPage });
  };

  const handlePrevPage = async () => {
    const prevPage = Math.max(0, page - 1);
    setPage(prevPage);
    await searchImagesWithoutTattoos({ limit, page: prevPage });
  };

  // Prepare chart data
  const chartData = stats
    ? [
        { name: "Tattoo Images", value: stats.tattooCount },
        { name: "Non-Tattoo Images", value: stats.nonTattooCount },
      ]
    : [];

  const COLORS = ["#8884d8", "#82ca9d"];

  return (
    <div className="no-tattoo-search">
      <div className="search-header">
        <h2>Find Images Without Tattoos</h2>
        <p className="search-description">
          View all images in the database that have been analyzed and classified
          as not containing tattoos.
        </p>
      </div>

      <div className="search-options">
        <label>
          Results per page:
          <select
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(0); // Reset to first page when changing limit
              searchImagesWithoutTattoos({
                limit: Number(e.target.value),
                page: 0,
              });
            }}
            className="limit-select"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>

        <button
          onClick={handleSearch}
          disabled={loading}
          className="search-button"
        >
          {loading ? "Loading..." : "Refresh Results"}
        </button>
      </div>

      {/* Stats section */}
      {stats && (
        <div className="stats-section">
          <h3>Image Analysis Statistics</h3>

          <div className="stats-container">
            <div className="stats-numbers">
              <div className="stat-item">
                <div className="stat-value">{stats.totalAnalyzed}</div>
                <div className="stat-label">Total Analyzed Images</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{stats.tattooCount}</div>
                <div className="stat-label">Images with Tattoos</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{stats.nonTattooCount}</div>
                <div className="stat-label">Images without Tattoos</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">
                  {stats.tattooPercentage.toFixed(1)}%
                </div>
                <div className="stat-label">Tattoo Percentage</div>
              </div>
            </div>

            <div className="stats-chart">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name}: ${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {error && <div className="error-message">Error: {error}</div>}

      {results.length > 0 && (
        <div className="search-results">
          <div className="results-header">
            <h3>Non-Tattoo Images</h3>
            <p>Found {totalCount} images without tattoos</p>

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

      {!loading && results.length === 0 && (
        <div className="no-results">
          <p>No images without tattoos found in the database</p>
          <p>
            This might mean all images contain tattoos, or images haven't been
            analyzed yet
          </p>
        </div>
      )}
    </div>
  );
};

export default NoTattooSearchComponent;
