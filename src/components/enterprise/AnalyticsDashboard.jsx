// src/components/enterprise/AnalyticsDashboard.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useFeatureFlags } from "../../utils/featureFlags";
import apiService from "../../services/apiService";
import {
  BarChart,
  LineChart,
  PieChart,
  RefreshCw,
  Calendar,
  Download,
  Filter,
  Loader,
  AlertCircle,
} from "lucide-react";
import Header from "../Header";
import UpgradePrompt from "../UpgradePrompt";
import "./EnterpriseComponents.css";

const AnalyticsDashboard = () => {
  const { currentUser, logout } = useAuth();
  const { isFeatureEnabled } = useFeatureFlags();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeframe, setTimeframe] = useState("week");
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  // Fetch dashboard data when component mounts or timeframe changes
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Call the API to get dashboard data
        const response = await apiService.analytics.getDashboard(
          timeframe,
          currentUser?.clientId
        );

        if (response.data && response.data.success) {
          setStats(response.data.dashboard || {});
        } else {
          throw new Error(
            response.data?.error || "Failed to load analytics data"
          );
        }
      } catch (err) {
        console.error("Error loading analytics:", err);
        setError("Failed to load analytics data. Please try again.");
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

        {loading ? (
          <div className="loading-container">
            <Loader className="spinner" size={32} />
            <p>Loading analytics data...</p>
          </div>
        ) : (
          <div className="analytics-dashboard">
            <div className="stats-summary">
              <div className="stat-card">
                <h3>Total Queries</h3>
                <div className="stat-value">
                  {stats?.summary?.totalSearches?.toLocaleString() || 0}
                </div>
                <div className="stat-change positive">
                  ↑ {stats?.searchChange || 0}%
                </div>
              </div>
              <div className="stat-card">
                <h3>Images Processed</h3>
                <div className="stat-value">
                  {stats?.summary?.imagesProcessed?.toLocaleString() || 0}
                </div>
                <div className="stat-change positive">
                  ↑ {stats?.imageChange || 0}%
                </div>
              </div>
              <div className="stat-card">
                <h3>Active Users</h3>
                <div className="stat-value">
                  {stats?.realtime?.activeUsers?.toLocaleString() || 0}
                </div>
                <div className="stat-change negative">
                  ↓ {stats?.userChange || 0}%
                </div>
              </div>
              <div className="stat-card">
                <h3>Avg. Response Time</h3>
                <div className="stat-value">
                  {stats?.summary?.avgResponseTime?.toFixed(2) || 0}s
                </div>
                <div className="stat-change positive">
                  ↑ {stats?.responseTimeChange || 0}%
                </div>
              </div>
            </div>

            <div className="charts-grid">
              <div className="chart-card wide">
                <h3>Query Volume Over Time</h3>
                <div className="chart-placeholder">
                  <LineChart size={32} />
                  <p>Usage trend visualization would appear here</p>
                  {stats?.charts?.searchesOverTime && (
                    <div className="chart-data">
                      {/* Render chart with data from stats.charts.searchesOverTime */}
                      {/* You can use recharts or another chart library here */}
                    </div>
                  )}
                </div>
              </div>
              <div className="chart-card">
                <h3>Image Types</h3>
                <div className="chart-placeholder">
                  <PieChart size={32} />
                  <p>Image type breakdown would appear here</p>
                </div>
              </div>
              <div className="chart-card">
                <h3>Popular Features</h3>
                <div className="chart-placeholder">
                  <BarChart size={32} />
                  <p>Feature usage would appear here</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
