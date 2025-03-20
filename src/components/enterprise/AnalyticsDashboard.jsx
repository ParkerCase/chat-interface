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

  useEffect(() => {
    // Check if user has access to this feature
    // For analytics, check if they have at least basic analytics (Pro tier)
    // or advanced analytics (Enterprise tier)
    if (
      !isFeatureEnabled("analytics_basic") &&
      !isFeatureEnabled("advanced_analytics")
    ) {
      setShowUpgradePrompt(true);
      return;
    }

    // Check if they have advanced analytics for the full dashboard
    const hasAdvancedAnalytics = isFeatureEnabled("advanced_analytics");

    // Load analytics data
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const response = await apiService.analytics.getStats(timeframe);

        if (response.data && response.data.success) {
          setStats(response.data.stats || {});
        } else {
          setError("Failed to load analytics data");
        }
      } catch (err) {
        console.error("Error loading analytics:", err);
        setError("Failed to load analytics data. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [timeframe, isFeatureEnabled]);

  const handleRefresh = () => {
    setLoading(true);
    // Refetch the data
    // Implementation would go here
  };

  const handleTimeframeChange = (newTimeframe) => {
    setTimeframe(newTimeframe);
  };

  const handleExport = (format) => {
    // Implementation would go here
    console.log("Export analytics as", format);
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
                  {stats?.totalQueries?.toLocaleString() || 0}
                </div>
                <div className="stat-change positive">
                  ↑ {stats?.queryChange || 0}%
                </div>
              </div>
              <div className="stat-card">
                <h3>Images Processed</h3>
                <div className="stat-value">
                  {stats?.imagesProcessed?.toLocaleString() || 0}
                </div>
                <div className="stat-change positive">
                  ↑ {stats?.imageChange || 0}%
                </div>
              </div>
              <div className="stat-card">
                <h3>Active Users</h3>
                <div className="stat-value">
                  {stats?.activeUsers?.toLocaleString() || 0}
                </div>
                <div className="stat-change negative">
                  ↓ {stats?.userChange || 0}%
                </div>
              </div>
              <div className="stat-card">
                <h3>Avg. Response Time</h3>
                <div className="stat-value">
                  {stats?.avgResponseTime?.toFixed(2) || 0}s
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
