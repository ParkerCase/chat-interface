// src/components/enterprise/AnalyticsDashboard.jsx - Enhanced version

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useFeatureFlags } from "../../utils/featureFlags";
import apiService from "../../services/apiService";
import analyticsUtils from "../../utils/analyticsUtils";
import {
  BarChart as BarChartIcon,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  RefreshCw,
  Calendar,
  Download,
  Filter,
  Loader,
  AlertCircle,
  BarChart4,
  ExternalLink,
  Search,
} from "lucide-react";
import Header from "../Header";
import UpgradePrompt from "../UpgradePrompt";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import "./EnterpriseComponents.css";

const AnalyticsDashboard = () => {
  const { currentUser, logout } = useAuth();
  const { isFeatureEnabled } = useFeatureFlags();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeframe, setTimeframe] = useState("week");
  const [selectedTab, setSelectedTab] = useState("overview");
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  // Additional state for drill-down
  const [searchAnalytics, setSearchAnalytics] = useState(null);
  const [systemPerformance, setSystemPerformance] = useState(null);
  const [isLoadingDrilldown, setIsLoadingDrilldown] = useState(false);

  // Fetch dashboard data when component mounts or timeframe changes
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log("Fetching dashboard data:", {
          timeframe,
          clientId: currentUser?.clientId,
        });

        // Call the API to get dashboard data
        const response = await apiService.analytics.getDashboard(
          timeframe,
          currentUser?.clientId
        );

        if (response.data && response.data.success) {
          setStats(response.data.dashboard || {});

          // Track dashboard view
          analyticsUtils.trackPageView("analytics_dashboard", {
            timeframe,
          });
        } else {
          console.error("API returned error:", response.data);
          throw new Error(
            response.data?.error || "Failed to load analytics data"
          );
        }
      } catch (err) {
        console.error("Error loading analytics:", err);
        setError(`Failed to load analytics data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    // Only fetch if feature is enabled
    if (
      isFeatureEnabled("analytics_basic") ||
      isFeatureEnabled("advanced_analytics")
    ) {
      fetchDashboardData();
    } else {
      setShowUpgradePrompt(true);
    }
  }, [timeframe, currentUser, isFeatureEnabled]);

  // Load additional data when tab changes
  useEffect(() => {
    if (selectedTab === "search" && !searchAnalytics) {
      loadSearchAnalytics();
    } else if (selectedTab === "system" && !systemPerformance) {
      loadSystemPerformance();
    }
  }, [selectedTab]);

  const loadSearchAnalytics = async () => {
    try {
      setIsLoadingDrilldown(true);
      const response = await apiService.analytics.getSearchAnalytics({
        startDate: getStartDateForTimeframe(timeframe),
        endDate: new Date().toISOString().split("T")[0],
        clientId: currentUser?.clientId,
      });

      if (response.data && response.data.success) {
        setSearchAnalytics(response.data.analytics || {});
      }
    } catch (error) {
      console.error("Error loading search analytics:", error);
    } finally {
      setIsLoadingDrilldown(false);
    }
  };

  const loadSystemPerformance = async () => {
    try {
      setIsLoadingDrilldown(true);
      const response = await apiService.analytics.getSystemPerformance({
        startDate: getStartDateForTimeframe(timeframe),
        endDate: new Date().toISOString().split("T")[0],
        resolution: timeframe === "day" ? "hour" : "day",
      });

      if (response.data && response.data.success) {
        setSystemPerformance(response.data.performance || {});
      }
    } catch (error) {
      console.error("Error loading system performance:", error);
    } finally {
      setIsLoadingDrilldown(false);
    }
  };

  // Helper to get start date based on timeframe
  const getStartDateForTimeframe = (tf) => {
    const now = new Date();
    const date = new Date(now);

    switch (tf) {
      case "day":
        date.setDate(date.getDate() - 1);
        break;
      case "week":
        date.setDate(date.getDate() - 7);
        break;
      case "month":
        date.setMonth(date.getMonth() - 1);
        break;
      case "year":
        date.setFullYear(date.getFullYear() - 1);
        break;
      default:
        date.setDate(date.getDate() - 7);
    }

    return date.toISOString().split("T")[0];
  };

  const handleRefresh = async () => {
    try {
      setLoading(true);
      setError(null);

      // Call the API to get fresh dashboard data
      const response = await apiService.analytics.getDashboard(
        timeframe,
        currentUser?.clientId
      );

      if (response.data && response.data.success) {
        setStats(response.data.dashboard || {});

        // Also refresh drill-down data if we're on that tab
        if (selectedTab === "search") {
          loadSearchAnalytics();
        } else if (selectedTab === "system") {
          loadSystemPerformance();
        }

        // Track refresh action
        analyticsUtils.trackButtonClick("refresh_analytics", {
          timeframe,
        });
      } else {
        throw new Error(
          response.data?.error || "Failed to refresh analytics data"
        );
      }
    } catch (err) {
      console.error("Error refreshing analytics:", err);
      setError("Failed to refresh analytics data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleTimeframeChange = (newTimeframe) => {
    setTimeframe(newTimeframe);

    // Reset drill-down data when timeframe changes
    setSearchAnalytics(null);
    setSystemPerformance(null);

    // Track timeframe change
    analyticsUtils.trackButtonClick("change_timeframe", {
      from: timeframe,
      to: newTimeframe,
    });
  };

  const handleExport = async (format) => {
    try {
      setLoading(true);

      // Call the export endpoint
      const response = await apiService.analytics.exportDashboard(
        timeframe,
        currentUser?.clientId,
        format
      );

      // Create a download link for the exported file
      const blob = new Blob([response.data], {
        type:
          format === "csv"
            ? "text/csv"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `analytics-dashboard-${timeframe}-${
        new Date().toISOString().split("T")[0]
      }.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Track export action
      analyticsUtils.trackButtonClick("export_analytics", {
        timeframe,
        format,
      });
    } catch (err) {
      console.error("Error exporting dashboard:", err);
      setError("Failed to export dashboard data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Show upgrade prompt if feature not available
  if (showUpgradePrompt) {
    return (
      <UpgradePrompt
        feature="advanced_analytics"
        onClose={() => navigate("/")}
      />
    );
  }

  // Generate chart colors
  const COLORS = [
    "#3B82F6",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#8B5CF6",
    "#EC4899",
  ];

  // Helper to add thousands separators
  const formatNumber = (num) => {
    return new Intl.NumberFormat().format(num);
  };

  return (
    <div className="enterprise-container">
      <Header currentUser={currentUser} onLogout={logout} />

      <div className="enterprise-content">
        <div className="enterprise-header">
          <h1>Analytics Dashboard</h1>
          <div className="header-actions">
            <div className="timeframe-selector">
              <button
                className={timeframe === "day" ? "active" : ""}
                onClick={() => handleTimeframeChange("day")}
              >
                Day
              </button>
              <button
                className={timeframe === "week" ? "active" : ""}
                onClick={() => handleTimeframeChange("week")}
              >
                Week
              </button>
              <button
                className={timeframe === "month" ? "active" : ""}
                onClick={() => handleTimeframeChange("month")}
              >
                Month
              </button>
              <button
                className={timeframe === "year" ? "active" : ""}
                onClick={() => handleTimeframeChange("year")}
              >
                Year
              </button>
            </div>
            <button className="refresh-button" onClick={handleRefresh}>
              <RefreshCw size={16} />
              Refresh
            </button>
            <button
              className="export-button"
              onClick={() => handleExport("csv")}
            >
              <Download size={16} />
              Export
            </button>
          </div>
        </div>

        {error && (
          <div className="error-message">
            <AlertCircle size={16} />
            <p>{error}</p>
          </div>
        )}

        {/* Tab navigation */}
        <div className="analytics-tabs">
          <button
            className={selectedTab === "overview" ? "active" : ""}
            onClick={() => setSelectedTab("overview")}
          >
            <BarChart4 size={16} />
            Overview
          </button>
          <button
            className={selectedTab === "search" ? "active" : ""}
            onClick={() => setSelectedTab("search")}
          >
            <Search size={16} />
            Search Analytics
          </button>
          <button
            className={selectedTab === "system" ? "active" : ""}
            onClick={() => setSelectedTab("system")}
          >
            <BarChartIcon size={16} />
            System Performance
          </button>
        </div>

        {loading ? (
          <div className="loading-container">
            <Loader className="spinner" size={32} />
            <p>Loading analytics data...</p>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {selectedTab === "overview" && stats && (
              <div className="analytics-dashboard">
                <div className="stats-summary">
                  <div className="stat-card">
                    <h3>Total Queries</h3>
                    <div className="stat-value">
                      {formatNumber(stats.summary?.totalSearches || 0)}
                    </div>
                    <div
                      className={`stat-change ${
                        (stats.searchChange || 0) >= 0 ? "positive" : "negative"
                      }`}
                    >
                      {(stats.searchChange || 0) >= 0 ? "↑" : "↓"}{" "}
                      {Math.abs(stats.searchChange || 0)}%
                    </div>
                  </div>
                  <div className="stat-card">
                    <h3>Active Users</h3>
                    <div className="stat-value">
                      {formatNumber(stats.summary?.uniqueUsers || 0)}
                    </div>
                    <div
                      className={`stat-change ${
                        (stats.userChange || 0) >= 0 ? "positive" : "negative"
                      }`}
                    >
                      {(stats.userChange || 0) >= 0 ? "↑" : "↓"}{" "}
                      {Math.abs(stats.userChange || 0)}%
                    </div>
                  </div>
                  <div className="stat-card">
                    <h3>Images Processed</h3>
                    <div className="stat-value">
                      {formatNumber(stats.summary?.imagesProcessed || 0)}
                    </div>
                    <div
                      className={`stat-change ${
                        (stats.imageChange || 0) >= 0 ? "positive" : "negative"
                      }`}
                    >
                      {(stats.imageChange || 0) >= 0 ? "↑" : "↓"}{" "}
                      {Math.abs(stats.imageChange || 0)}%
                    </div>
                  </div>
                  <div className="stat-card">
                    <h3>Avg. Response Time</h3>
                    <div className="stat-value">
                      {(stats.summary?.avgResponseTime || 0).toFixed(2)}s
                    </div>
                    <div
                      className={`stat-change ${
                        (stats.responseTimeChange || 0) <= 0
                          ? "positive"
                          : "negative"
                      }`}
                    >
                      {(stats.responseTimeChange || 0) <= 0 ? "↓" : "↑"}{" "}
                      {Math.abs(stats.responseTimeChange || 0)}%
                    </div>
                  </div>
                </div>

                <div className="charts-grid">
                  {/* Searches Over Time Chart */}
                  <div className="chart-card wide">
                    <h3>Query Volume Over Time</h3>
                    {stats.charts?.searchesOverTime &&
                    stats.charts.searchesOverTime.length > 0 ? (
                      <div className="chart-container">
                        <ResponsiveContainer width="100%" height={250}>
                          <LineChart data={stats.charts.searchesOverTime}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="date"
                              tick={{ fontSize: 12 }}
                              tickFormatter={(date) => {
                                // Different formats based on timeframe
                                if (timeframe === "day") {
                                  return new Date(date).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  });
                                } else if (timeframe === "year") {
                                  return new Date(date).toLocaleDateString([], {
                                    month: "short",
                                  });
                                } else {
                                  return new Date(date).toLocaleDateString([], {
                                    month: "short",
                                    day: "numeric",
                                  });
                                }
                              }}
                            />
                            <YAxis />
                            <Tooltip
                              formatter={(value) => [
                                formatNumber(value),
                                "Searches",
                              ]}
                              labelFormatter={(date) =>
                                new Date(date).toLocaleDateString([], {
                                  weekday: "short",
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })
                              }
                            />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="count"
                              stroke="#3B82F6"
                              strokeWidth={2}
                              name="Searches"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="chart-placeholder">
                        <LineChartIcon size={32} />
                        <p>No data available for this time period</p>
                      </div>
                    )}
                  </div>

                  {/* Popular Searches Chart */}
                  <div className="chart-card">
                    <h3>Popular Searches</h3>
                    {stats.charts?.popularSearches &&
                    stats.charts.popularSearches.length > 0 ? (
                      <div className="chart-container">
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart
                            layout="vertical"
                            data={stats.charts.popularSearches.slice(0, 5)}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis
                              dataKey="query"
                              type="category"
                              tick={{ fontSize: 12 }}
                              width={120}
                            />
                            <Tooltip
                              formatter={(value) => [
                                formatNumber(value),
                                "Searches",
                              ]}
                            />
                            <Bar
                              dataKey="count"
                              fill="#10B981"
                              name="Search Count"
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="chart-placeholder">
                        <BarChartIcon size={32} />
                        <p>No search data available</p>
                      </div>
                    )}
                  </div>

                  {/* Users Over Time Chart */}
                  <div className="chart-card">
                    <h3>User Activity</h3>
                    {stats.charts?.usersOverTime &&
                    stats.charts.usersOverTime.length > 0 ? (
                      <div className="chart-container">
                        <ResponsiveContainer width="100%" height={250}>
                          <LineChart data={stats.charts.usersOverTime}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="date"
                              tick={{ fontSize: 12 }}
                              tickFormatter={(date) => {
                                // Different formats based on timeframe
                                if (timeframe === "year") {
                                  return new Date(date).toLocaleDateString([], {
                                    month: "short",
                                  });
                                } else {
                                  return new Date(date).toLocaleDateString([], {
                                    month: "numeric",
                                    day: "numeric",
                                  });
                                }
                              }}
                            />
                            <YAxis />
                            <Tooltip
                              formatter={(value) => [
                                formatNumber(value),
                                "Users",
                              ]}
                              labelFormatter={(date) =>
                                new Date(date).toLocaleDateString([], {
                                  weekday: "short",
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })
                              }
                            />
                            <Line
                              type="monotone"
                              dataKey="count"
                              stroke="#F59E0B"
                              strokeWidth={2}
                              name="Users"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="chart-placeholder">
                        <LineChartIcon size={32} />
                        <p>No user data available</p>
                      </div>
                    )}
                  </div>

                  {/* Realtime Stats */}
                  <div className="chart-card">
                    <h3>Realtime Activity</h3>
                    <div className="realtime-stats">
                      <div className="realtime-stat">
                        <h4>Active Users</h4>
                        <div className="realtime-value">
                          {stats.realtime?.activeUsers || 0}
                        </div>
                      </div>
                      <div className="realtime-stat">
                        <h4>Searches (Last Hour)</h4>
                        <div className="realtime-value">
                          {stats.realtime?.searchesLastHour || 0}
                        </div>
                      </div>
                      <div className="realtime-stat">
                        <h4>Processing (Last Hour)</h4>
                        <div className="realtime-value">
                          {stats.realtime?.processingLastHour || 0}
                        </div>
                      </div>
                      <div className="realtime-stat">
                        <h4>Errors (Last Hour)</h4>
                        <div className="realtime-value">
                          {stats.realtime?.errorsLastHour || 0}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Search Analytics Tab */}
            {selectedTab === "search" && (
              <div className="analytics-dashboard">
                {isLoadingDrilldown ? (
                  <div className="loading-container">
                    <Loader className="spinner" size={32} />
                    <p>Loading search analytics...</p>
                  </div>
                ) : searchAnalytics ? (
                  <>
                    <div className="stats-summary">
                      <div className="stat-card">
                        <h3>Total Searches</h3>
                        <div className="stat-value">
                          {formatNumber(searchAnalytics.totalSearches || 0)}
                        </div>
                      </div>
                      <div className="stat-card">
                        <h3>Avg. Response Time</h3>
                        <div className="stat-value">
                          {(searchAnalytics.performance?.avg || 0).toFixed(2)}s
                        </div>
                      </div>
                      <div className="stat-card">
                        <h3>Avg. Results</h3>
                        <div className="stat-value">
                          {formatNumber(
                            searchAnalytics.resultStats?.avgResults || 0
                          )}
                        </div>
                      </div>
                      <div className="stat-card">
                        <h3>Zero Results Rate</h3>
                        <div className="stat-value">
                          {(
                            searchAnalytics.resultStats
                              ?.zeroResultsPercentage || 0
                          ).toFixed(1)}
                          %
                        </div>
                      </div>
                    </div>

                    <div className="charts-grid">
                      {/* Search Volume Over Time */}
                      <div className="chart-card wide">
                        <h3>Search Volume Over Time</h3>
                        {searchAnalytics.timeSeries &&
                        searchAnalytics.timeSeries.length > 0 ? (
                          <div className="chart-container">
                            <ResponsiveContainer width="100%" height={250}>
                              <LineChart data={searchAnalytics.timeSeries}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                  dataKey="date"
                                  tick={{ fontSize: 12 }}
                                  tickFormatter={(date) => {
                                    return new Date(date).toLocaleDateString(
                                      [],
                                      {
                                        month: "numeric",
                                        day: "numeric",
                                      }
                                    );
                                  }}
                                />
                                <YAxis />
                                <Tooltip
                                  formatter={(value) => [
                                    formatNumber(value),
                                    "Searches",
                                  ]}
                                  labelFormatter={(date) =>
                                    new Date(date).toLocaleDateString([], {
                                      weekday: "short",
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric",
                                    })
                                  }
                                />
                                <Legend />
                                <Line
                                  type="monotone"
                                  dataKey="count"
                                  stroke="#3B82F6"
                                  strokeWidth={2}
                                  name="Searches"
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div className="chart-placeholder">
                            <LineChartIcon size={32} />
                            <p>No search data available for this time period</p>
                          </div>
                        )}
                      </div>

                      {/* Search Types Breakdown */}
                      <div className="chart-card">
                        <h3>Search Types</h3>
                        {searchAnalytics.byType &&
                        Object.keys(searchAnalytics.byType).length > 0 ? (
                          <div className="chart-container">
                            <ResponsiveContainer width="100%" height={250}>
                              <PieChart>
                                <Pie
                                  data={Object.entries(
                                    searchAnalytics.byType
                                  ).map(([key, value]) => ({
                                    name: key,
                                    value,
                                  }))}
                                  cx="50%"
                                  cy="50%"
                                  labelLine={false}
                                  outerRadius={80}
                                  fill="#8884d8"
                                  dataKey="value"
                                  nameKey="name"
                                  label={({ name, percent }) =>
                                    `${name} ${(percent * 100).toFixed(0)}%`
                                  }
                                >
                                  {Object.entries(searchAnalytics.byType).map(
                                    ([key, value], index) => (
                                      <Cell
                                        key={`cell-${index}`}
                                        fill={COLORS[index % COLORS.length]}
                                      />
                                    )
                                  )}
                                </Pie>
                                <Tooltip
                                  formatter={(value) => [
                                    formatNumber(value),
                                    "Searches",
                                  ]}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div className="chart-placeholder">
                            <PieChartIcon size={32} />
                            <p>No search type data available</p>
                          </div>
                        )}
                      </div>

                      {/* Top Search Terms */}
                      <div className="chart-card">
                        <h3>Top Search Terms</h3>
                        {searchAnalytics.byQuery &&
                        Object.keys(searchAnalytics.byQuery).length > 0 ? (
                          <div className="chart-container">
                            <div className="table-container">
                              <table className="analytics-table">
                                <thead>
                                  <tr>
                                    <th>Search Term</th>
                                    <th>Count</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Object.entries(searchAnalytics.byQuery)
                                    .sort(([, a], [, b]) => b - a)
                                    .slice(0, 10)
                                    .map(([term, count], index) => (
                                      <tr key={index}>
                                        <td>{term}</td>
                                        <td>{formatNumber(count)}</td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : (
                          <div className="chart-placeholder">
                            <Search size={32} />
                            <p>No search terms data available</p>
                          </div>
                        )}
                      </div>

                      {/* Performance Metrics */}
                      <div className="chart-card">
                        <h3>Performance Metrics</h3>
                        <div className="performance-metrics">
                          <div className="performance-metric">
                            <h4>Average Response Time</h4>
                            <div className="metric-value">
                              {(searchAnalytics.performance?.avg || 0).toFixed(
                                2
                              )}
                              s
                            </div>
                          </div>
                          <div className="performance-metric">
                            <h4>Minimum Response Time</h4>
                            <div className="metric-value">
                              {(searchAnalytics.performance?.min || 0).toFixed(
                                2
                              )}
                              s
                            </div>
                          </div>
                          <div className="performance-metric">
                            <h4>Maximum Response Time</h4>
                            <div className="metric-value">
                              {(searchAnalytics.performance?.max || 0).toFixed(
                                2
                              )}
                              s
                            </div>
                          </div>
                          <div className="performance-metric">
                            <h4>95th Percentile</h4>
                            <div className="metric-value">
                              {(searchAnalytics.performance?.p95 || 0).toFixed(
                                2
                              )}
                              s
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="empty-state">
                    <Search size={48} />
                    <h3>No search analytics data available</h3>
                    <p>
                      There is no search analytics data for the selected time
                      period.
                    </p>
                    <button
                      className="refresh-button"
                      onClick={loadSearchAnalytics}
                    >
                      <RefreshCw size={16} />
                      Load Search Analytics
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* System Performance Tab */}
            {selectedTab === "system" && (
              <div className="analytics-dashboard">
                {isLoadingDrilldown ? (
                  <div className="loading-container">
                    <Loader className="spinner" size={32} />
                    <p>Loading system performance data...</p>
                  </div>
                ) : systemPerformance ? (
                  <>
                    <div className="stats-summary">
                      <div className="stat-card">
                        <h3>Current Memory</h3>
                        <div className="stat-value">
                          {(systemPerformance.memory?.current || 0).toFixed(1)}{" "}
                          MB
                        </div>
                      </div>
                      <div className="stat-card">
                        <h3>Current CPU</h3>
                        <div className="stat-value">
                          {(systemPerformance.cpu?.current || 0).toFixed(1)}%
                        </div>
                      </div>
                      <div className="stat-card">
                        <h3>API Calls / Day</h3>
                        <div className="stat-value">
                          {formatNumber(
                            Math.round(systemPerformance.api?.callsPerDay || 0)
                          )}
                        </div>
                      </div>
                      <div className="stat-card">
                        <h3>Error Rate</h3>
                        <div className="stat-value">
                          {systemPerformance.errors && systemPerformance.api
                            ? (
                                (systemPerformance.errors.total /
                                  systemPerformance.api.totalCalls) *
                                100
                              ).toFixed(2)
                            : 0}
                          %
                        </div>
                      </div>
                    </div>

                    <div className="charts-grid">
                      {/* Memory Usage Chart */}
                      <div className="chart-card">
                        <h3>Memory Usage</h3>
                        {systemPerformance.memory?.timeSeries &&
                        systemPerformance.memory.timeSeries.length > 0 ? (
                          <div className="chart-container">
                            <ResponsiveContainer width="100%" height={250}>
                              <LineChart
                                data={systemPerformance.memory.timeSeries}
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                  dataKey="timestamp"
                                  tick={{ fontSize: 12 }}
                                  tickFormatter={(timestamp) => {
                                    return new Date(
                                      timestamp
                                    ).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    });
                                  }}
                                />
                                <YAxis />
                                <Tooltip
                                  formatter={(value) => [
                                    `${value.toFixed(1)} MB`,
                                    "Memory Usage",
                                  ]}
                                  labelFormatter={(timestamp) =>
                                    new Date(timestamp).toLocaleString()
                                  }
                                />
                                <Line
                                  type="monotone"
                                  dataKey="value"
                                  stroke="#3B82F6"
                                  strokeWidth={2}
                                  name="Memory Usage"
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div className="chart-placeholder">
                            <LineChartIcon size={32} />
                            <p>No memory data available</p>
                          </div>
                        )}
                      </div>

                      {/* CPU Usage Chart */}
                      <div className="chart-card">
                        <h3>CPU Usage</h3>
                        {systemPerformance.cpu?.timeSeries &&
                        systemPerformance.cpu.timeSeries.length > 0 ? (
                          <div className="chart-container">
                            <ResponsiveContainer width="100%" height={250}>
                              <LineChart
                                data={systemPerformance.cpu.timeSeries}
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                  dataKey="timestamp"
                                  tick={{ fontSize: 12 }}
                                  tickFormatter={(timestamp) => {
                                    return new Date(
                                      timestamp
                                    ).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    });
                                  }}
                                />
                                <YAxis />
                                <Tooltip
                                  formatter={(value) => [
                                    `${value.toFixed(1)}%`,
                                    "CPU Usage",
                                  ]}
                                  labelFormatter={(timestamp) =>
                                    new Date(timestamp).toLocaleString()
                                  }
                                />
                                <Line
                                  type="monotone"
                                  dataKey="value"
                                  stroke="#10B981"
                                  strokeWidth={2}
                                  name="CPU Usage"
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div className="chart-placeholder">
                            <LineChartIcon size={32} />
                            <p>No CPU data available</p>
                          </div>
                        )}
                      </div>

                      {/* API Endpoints Chart */}
                      <div className="chart-card">
                        <h3>API Endpoints</h3>
                        {systemPerformance.api?.byEndpoint &&
                        Object.keys(systemPerformance.api.byEndpoint).length >
                          0 ? (
                          <div className="chart-container">
                            <ResponsiveContainer width="100%" height={250}>
                              <BarChart
                                layout="vertical"
                                data={Object.entries(
                                  systemPerformance.api.byEndpoint
                                )
                                  .map(([endpoint, count]) => ({
                                    endpoint,
                                    count,
                                  }))
                                  .sort((a, b) => b.count - a.count)
                                  .slice(0, 5)}
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" />
                                <YAxis
                                  dataKey="endpoint"
                                  type="category"
                                  tick={{ fontSize: 12 }}
                                  width={120}
                                />
                                <Tooltip
                                  formatter={(value) => [
                                    formatNumber(value),
                                    "Calls",
                                  ]}
                                />
                                <Bar
                                  dataKey="count"
                                  fill="#F59E0B"
                                  name="API Calls"
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div className="chart-placeholder">
                            <BarChartIcon size={32} />
                            <p>No API endpoint data available</p>
                          </div>
                        )}
                      </div>

                      {/* Error Types Chart */}
                      <div className="chart-card">
                        <h3>Error Types</h3>
                        {systemPerformance.errors?.byType &&
                        Object.keys(systemPerformance.errors.byType).length >
                          0 ? (
                          <div className="chart-container">
                            <ResponsiveContainer width="100%" height={250}>
                              <PieChart>
                                <Pie
                                  data={Object.entries(
                                    systemPerformance.errors.byType
                                  ).map(([key, value]) => ({
                                    name: key,
                                    value,
                                  }))}
                                  cx="50%"
                                  cy="50%"
                                  labelLine={false}
                                  outerRadius={80}
                                  fill="#8884d8"
                                  dataKey="value"
                                  nameKey="name"
                                  label={({ name, percent }) =>
                                    `${name} ${(percent * 100).toFixed(0)}%`
                                  }
                                >
                                  {Object.entries(
                                    systemPerformance.errors.byType
                                  ).map(([key, value], index) => (
                                    <Cell
                                      key={`cell-${index}`}
                                      fill={COLORS[index % COLORS.length]}
                                    />
                                  ))}
                                </Pie>
                                <Tooltip
                                  formatter={(value) => [
                                    formatNumber(value),
                                    "Errors",
                                  ]}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div className="chart-placeholder">
                            <PieChartIcon size={32} />
                            <p>No error data available</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="empty-state">
                    <BarChartIcon size={48} />
                    <h3>No system performance data available</h3>
                    <p>
                      There is no system performance data for the selected time
                      period.
                    </p>
                    <button
                      className="refresh-button"
                      onClick={loadSystemPerformance}
                    >
                      <RefreshCw size={16} />
                      Load System Performance
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
