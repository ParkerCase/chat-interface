// src/components/analytics/EnhancedAnalyticsDashboard.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useFeatureFlags } from "../../utils/featureFlags";
import { supabase } from "../../lib/supabase";
import { SupabaseAnalytics } from "../../utils/SupabaseAnalyticsIntegration";
import { AnalyticsCache } from "../../utils/RedisCache";

import analyticsUtils from "../../utils/analyticsUtils";
import {
  BarChart as BarChartIcon,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  AreaChart,
  RefreshCw,
  Calendar,
  Download,
  Filter,
  Loader,
  AlertCircle,
  BarChart4,
  FileText,
  Image,
  Search,
  Users,
  MessageSquare,
  Clock,
  Save,
  Plus,
  Settings,
  HelpCircle,
  FileUp,
  Check,
  X,
  ChevronDown,
  Eye,
  Share2,
  Printer,
  ClipboardList,
  ArrowDownCircle,
  Filter as FilterIcon,
  Link as LinkIcon,
} from "lucide-react";
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
  AreaChart as RechartsAreaChart,
  Area,
} from "recharts";
import "./EnhancedAnalyticsDashboard.css";

const EnhancedAnalyticsDashboard = () => {
  const { currentUser, logout } = useAuth();
  const { isFeatureEnabled, organizationTier } = useFeatureFlags();
  const navigate = useNavigate();

  // State
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeframe, setTimeframe] = useState("week");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [activeTab, setActiveTab] = useState("overview");
  const [userMetrics, setUserMetrics] = useState(null);
  const [contentMetrics, setContentMetrics] = useState(null);
  const [searchMetrics, setSearchMetrics] = useState(null);
  const [systemMetrics, setSystemMetrics] = useState(null);
  const [selectedPreset, setSelectedPreset] = useState("default");
  const [presets, setPresets] = useState([
    { id: "default", name: "Default Dashboard", isDefault: true },
    { id: "user-focused", name: "User Activity", isDefault: false },
    { id: "content-focused", name: "Content Performance", isDefault: false },
    { id: "system", name: "System Health", isDefault: false },
  ]);
  const [dashboardName, setDashboardName] = useState("");
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [realtimeData, setRealtimeData] = useState({
    activeUsers: 0,
    queries: 0,
    errorRate: 0,
    avgResponseTime: 0,
  });
  const [integrationMetrics, setIntegrationMetrics] = useState(null);

  // Colors for charts
  const COLORS = useMemo(
    () => [
      "#4f46e5", // indigo
      "#0ea5e9", // sky
      "#10b981", // emerald
      "#f59e0b", // amber
      "#ef4444", // red
      "#8b5cf6", // violet
      "#ec4899", // pink
      "#06b6d4", // cyan
      "#84cc16", // lime
      "#f97316", // orange
    ],
    []
  );

  // Safe chart renderer function to prevent Recharts errors
  const SafeChart = ({
    data,
    children,
    type = "line",
    height = 300,
    className = "",
  }) => {
    // Only render chart if data exists and is an array with items
    if (!data || !Array.isArray(data) || data.length === 0) {
      return (
        <div className={`chart-placeholder ${className}`} style={{ height }}>
          <p>No data available for chart</p>
        </div>
      );
    }

    // Choose chart type
    const ChartComponent = (() => {
      switch (type) {
        case "bar":
          return BarChart;
        case "pie":
          return PieChart;
        case "area":
          return RechartsAreaChart;
        case "line":
        default:
          return LineChart;
      }
    })();

    // Render the chart
    return (
      <ResponsiveContainer width="100%" height={height} className={className}>
        <ChartComponent data={data}>{children}</ChartComponent>
      </ResponsiveContainer>
    );
  };

  // Initialize dashboard based on date range
  useEffect(() => {
    calculateDateRange(timeframe);
  }, [timeframe]);

  // Fetch all dashboard data when dependencies change
  useEffect(() => {
    if (dateRange.start && dateRange.end) {
      fetchDashboardData();
    }
  }, [dateRange, activeTab, selectedPreset]);

  // Calculate date range based on timeframe
  const calculateDateRange = (tf) => {
    const today = new Date();
    const endDate = new Date(today);
    let startDate = new Date(today);

    switch (tf) {
      case "day":
        startDate.setDate(today.getDate() - 1);
        break;
      case "week":
        startDate.setDate(today.getDate() - 7);
        break;
      case "month":
        startDate.setMonth(today.getMonth() - 1);
        break;
      case "quarter":
        startDate.setMonth(today.getMonth() - 3);
        break;
      case "year":
        startDate.setFullYear(today.getFullYear() - 1);
        break;
      default:
        startDate.setDate(today.getDate() - 7);
    }

    setDateRange({
      start: startDate.toISOString().split("T")[0],
      end: endDate.toISOString().split("T")[0],
    });
  };

  useEffect(() => {
    // Set up realtime subscription for analytics stats
    const statsChannel = supabase
      .channel("analytics-realtime")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "analytics_stats",
        },
        (payload) => {
          if (payload.new) {
            setRealtimeData({
              activeUsers: payload.new.active_users || 0,
              queries: payload.new.queries_last_hour || 0,
              errorRate: payload.new.error_rate || 0,
              avgResponseTime: payload.new.avg_response_time || 0,
            });
          }
        }
      )
      .subscribe();

    // Set up a periodic refresh as backup
    const interval = setInterval(async () => {
      try {
        const realtimeData = await SupabaseAnalytics.getRealtimeStats();
        setRealtimeData(realtimeData);
      } catch (err) {
        console.warn("Error fetching realtime stats:", err);
      }
    }, 30000); // 30 seconds

    // Initial fetch of realtime data
    SupabaseAnalytics.getRealtimeStats()
      .then(setRealtimeData)
      .catch((err) => {
        // If analytics_stats is missing, fallback to sample data
        setRealtimeData({
          activeUsers: 0,
          queries: 0,
          errorRate: 0,
          avgResponseTime: 0,
        });
      });

    return () => {
      // Clean up subscriptions and intervals
      supabase.removeChannel(statsChannel);
      clearInterval(interval);
    };
  }, []);

  // Helper: Fetch count from a table
  const fetchCount = async (table, filter = {}) => {
    let query = supabase
      .from(table)
      .select("id", { count: "exact", head: true });
    Object.entries(filter).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
  };

  // Helper: Fetch time series data (group by date)
  const fetchTimeSeries = async (table, dateField, start, end, filter = {}) => {
    if (!start || !end) return [];
    let query = supabase
      .from(table)
      .select(`${dateField}`)
      .gte(dateField, start)
      .lte(dateField, end);
    Object.entries(filter).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
    const { data, error } = await query;
    if (error) throw error;
    // Group by date
    const counts = {};
    data.forEach((row) => {
      const date = row[dateField].split("T")[0];
      counts[date] = (counts[date] || 0) + 1;
    });
    return Object.entries(counts).map(([date, value]) => ({ date, value }));
  };

  // Main function to fetch all dashboard data
  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!dateRange.start || !dateRange.end) {
        setLoading(false);
        return;
      }
      // Fetch all main stats
      const [
        totalUsers,
        totalDocuments,
        totalImages,
        totalSearches,
        totalSessions,
      ] = await Promise.all([
        fetchCount("profiles"),
        fetchCount("documents"),
        fetchCount("images"),
        fetchCount("analytics_events", { event_type: "search" }),
        fetchCount("analytics_events", { event_type: "session_start" }),
      ]);

      // Fetch time series for users, searches, documents
      const [userSeries, searchSeries, docSeries] = await Promise.all([
        fetchTimeSeries(
          "profiles",
          "created_at",
          dateRange.start,
          dateRange.end
        ),
        fetchTimeSeries(
          "analytics_events",
          "created_at",
          dateRange.start,
          dateRange.end,
          { event_type: "search" }
        ),
        fetchTimeSeries(
          "documents",
          "created_at",
          dateRange.start,
          dateRange.end
        ),
      ]);

      // Fetch top searches
      const { data: topSearchesData } = await supabase
        .from("analytics_events")
        .select("search_term, count")
        .eq("event_type", "search")
        .order("count", { ascending: false })
        .limit(5);
      const topSearches = (topSearchesData || []).map((row) => ({
        term: row.search_term,
        count: row.count,
      }));

      // Fetch popular content
      const { data: popularContentData } = await supabase
        .from("documents")
        .select("name, views, type")
        .order("views", { ascending: false })
        .limit(5);
      const popularContent = (popularContentData || []).map((row) => ({
        name: row.name,
        views: row.views,
        type: row.type,
      }));

      // Fetch recent users
      const { data: recentUsersData } = await supabase
        .from("profiles")
        .select("id, email, full_name, created_at")
        .order("created_at", { ascending: false })
        .limit(5);

      setDashboardData({
        summary: {
          totalUsers,
          totalDocuments,
          totalImages,
          totalSearches,
          totalSessions,
          // Add more real stats as needed
        },
        timeSeriesData: userSeries.map((u, i) => ({
          date: u.date,
          users: u.value,
          searches: searchSeries[i]?.value || 0,
          documents: docSeries[i]?.value || 0,
        })),
        topSearches,
        popularContent,
        recentUsers: recentUsersData || [],
      });
    } catch (error) {
      setError("Failed to load analytics data.");
      setDashboardData({ summary: {} });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const generateTimeSeriesData = (tf, range) => {
    const data = [];
    const startDate = new Date(range.start);
    const endDate = new Date(range.end);

    let currentDate = new Date(startDate);

    // Generate time series data
    while (currentDate <= endDate) {
      const userValue = Math.floor(Math.random() * 100) + 50;
      const searchValue = Math.floor(Math.random() * 200) + 100;
      const documentValue = Math.floor(Math.random() * 50) + 20;

      data.push({
        date: new Date(currentDate).toISOString().split("T")[0],
        users: userValue,
        searches: searchValue,
        documents: documentValue,
      });

      // Increment by appropriate amount based on timeframe
      switch (tf) {
        case "day":
          currentDate.setHours(currentDate.getHours() + 1);
          break;
        case "week":
        case "month":
          currentDate.setDate(currentDate.getDate() + 1);
          break;
        case "quarter":
          currentDate.setDate(currentDate.getDate() + 7);
          break;
        case "year":
          currentDate.setDate(currentDate.getDate() + 14);
          break;
        default:
          currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    return data;
  };

  // Handle refresh button click
  const handleRefresh = async () => {
    try {
      setLoading(true);
      setError(null);

      // Clear cache for current view
      const cacheKey = `${activeTab}:${timeframe}:${selectedPreset}`;

      // Clear specific caches based on active tab
      switch (activeTab) {
        case "overview":
          await AnalyticsCache.cacheDashboardData(cacheKey, null, 1); // Expire immediately
          break;
        case "users":
          await AnalyticsCache.cacheUserMetrics(timeframe, null, 1); // Expire immediately
          break;
        case "integrations":
          // No cache for mock, but could clear real cache here
          break;
        // Handle other tabs as needed
      }

      if (activeTab === "integrations") {
        await fetchIntegrationMetrics();
      } else {
        await fetchDashboardData();
      }

      // Track refresh action
      analyticsUtils.trackButtonClick("refresh_analytics", {
        timeframe,
        activeTab,
      });
    } catch (err) {
      console.error("Error refreshing analytics:", err);
      setError("Failed to refresh analytics data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle timeframe change
  const handleTimeframeChange = (newTimeframe) => {
    setTimeframe(newTimeframe);

    // Track timeframe change
    analyticsUtils.trackButtonClick("change_timeframe", {
      from: timeframe,
      to: newTimeframe,
    });
  };

  // Export dashboard data
  const handleExport = async (format = "csv") => {
    try {
      setLoading(true);

      // Prepare data for export based on active tab
      let exportData;
      let filename;

      switch (activeTab) {
        case "overview":
          exportData = dashboardData?.timeSeriesData || [];
          filename = `overview-dashboard-${timeframe}`;
          break;
        case "users":
          exportData = userMetrics?.userGrowth || [];
          filename = `user-metrics-${timeframe}`;
          break;
        case "content":
          exportData = contentMetrics?.storageGrowth || [];
          filename = `content-metrics-${timeframe}`;
          break;
        case "search":
          exportData = searchMetrics?.searchVolume || [];
          filename = `search-metrics-${timeframe}`;
          break;
        case "system":
          exportData = systemMetrics?.performance || [];
          filename = `system-metrics-${timeframe}`;
          break;
        case "integrations":
          exportData = integrationMetrics?.integrations || [];
          filename = `integration-metrics-${timeframe}`;
          break;
        default:
          exportData = dashboardData?.timeSeriesData || [];
          filename = `analytics-dashboard-${timeframe}`;
      }

      // Convert to CSV string
      let csvContent = "";

      // Add headers
      if (exportData.length > 0) {
        csvContent += Object.keys(exportData[0]).join(",") + "\n";

        // Add data rows
        exportData.forEach((item) => {
          csvContent += Object.values(item).join(",") + "\n";
        });
      }

      // Create and download file
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Track export action
      analyticsUtils.trackButtonClick("export_analytics", {
        timeframe,
        format,
        activeTab,
      });
    } catch (err) {
      console.error("Error exporting dashboard:", err);
      setError("Failed to export dashboard data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle save dashboard
  const handleSaveDashboard = async () => {
    try {
      if (!dashboardName) return;

      setLoading(true);

      // Prepare dashboard configuration
      const dashboardConfig = {
        name: dashboardName,
        timeframe,
        activeTab,
        dateRange,
        created_by: currentUser?.id,
        created_at: new Date().toISOString(),
      };

      // Save to Supabase
      const { data, error } = await supabase
        .from("dashboard_presets")
        .insert([dashboardConfig])
        .select();

      if (error) throw error;

      // Add to presets
      if (data && data.length > 0) {
        setPresets([
          ...presets,
          {
            id: data[0].id,
            name: data[0].name,
            isDefault: false,
          },
        ]);

        // Select the new preset
        setSelectedPreset(data[0].id);
      }

      // Close modal and reset form
      setShowSaveModal(false);
      setDashboardName("");

      // Track save action
      analyticsUtils.trackButtonClick("save_dashboard", {
        timeframe,
        activeTab,
      });
    } catch (err) {
      console.error("Error saving dashboard:", err);
      setError("Failed to save dashboard. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Helper to format numbers
  const formatNumber = (num) => {
    if (num === undefined || num === null) return "0";

    return new Intl.NumberFormat().format(num);
  };

  // Render dashboard based on active tab
  const renderDashboard = () => {
    switch (activeTab) {
      case "overview":
        return renderOverviewDashboard();
      case "users":
        return renderUsersDashboard();
      case "content":
        return renderContentDashboard();
      case "search":
        return renderSearchDashboard();
      case "system":
        return renderSystemDashboard();
      case "integrations":
        return renderIntegrationsDashboard();
      default:
        return renderOverviewDashboard();
    }
  };

  // Render overview dashboard
  const renderOverviewDashboard = () => {
    if (!dashboardData || !dashboardData.summary) {
      return (
        <div className="analytics-loading">
          <Loader className="spinner" size={32} />
          <p>Loading dashboard data...</p>
        </div>
      );
    }

    return (
      <div className="analytics-dashboard">
        {/* Stats Summary */}
        <div className="stats-summary">
          <div className="stat-card users-stat">
            <div className="stat-icon">
              <Users size={24} />
            </div>
            <div className="stat-content">
              <h3>Total Users</h3>
              <div className="stat-value">
                {dashboardData && dashboardData.summary
                  ? formatNumber(dashboardData.summary.totalUsers)
                  : 0}
              </div>
              <div className="stat-detail">
                <span className="stat-label">Active:</span>
                <span className="stat-subvalue">
                  {dashboardData && dashboardData.summary
                    ? formatNumber(dashboardData.summary.activeUsers)
                    : 0}
                </span>
              </div>
            </div>
          </div>

          <div className="stat-card sessions-stat">
            <div className="stat-icon">
              <Clock size={24} />
            </div>
            <div className="stat-content">
              <h3>Total Sessions</h3>
              <div className="stat-value">
                {dashboardData && dashboardData.summary
                  ? formatNumber(dashboardData.summary.totalSessions)
                  : 0}
              </div>
              <div className="stat-detail">
                <span className="stat-label">Avg Duration:</span>
                <span className="stat-subvalue">
                  {dashboardData.summary.avgSessionDuration} min
                </span>
              </div>
            </div>
          </div>

          <div className="stat-card searches-stat">
            <div className="stat-icon">
              <Search size={24} />
            </div>
            <div className="stat-content">
              <h3>Total Searches</h3>
              <div className="stat-value">
                {dashboardData && dashboardData.summary
                  ? formatNumber(dashboardData.summary.totalSearches)
                  : 0}
              </div>
            </div>
          </div>

          <div className="stat-card documents-stat">
            <div className="stat-icon">
              <FileText size={24} />
            </div>
            <div className="stat-content">
              <h3>Documents</h3>
              <div className="stat-value">
                {dashboardData && dashboardData.summary
                  ? formatNumber(dashboardData.summary.totalDocuments)
                  : 0}
              </div>
            </div>
          </div>

          <div className="stat-card images-stat">
            <div className="stat-icon">
              <Image size={24} />
            </div>
            <div className="stat-content">
              <h3>Images</h3>
              <div className="stat-value">
                {dashboardData && dashboardData.summary
                  ? formatNumber(dashboardData.summary.totalImages)
                  : 0}
              </div>
            </div>
          </div>
        </div>

        {/* Realtime Stats */}
        <div className="realtime-stats-container">
          <h3 className="section-title">
            <div className="title-with-indicator">
              <span>Realtime Activity</span>
              <span className="realtime-indicator"></span>
            </div>
          </h3>

          <div className="realtime-stats">
            <div className="realtime-stat-card">
              <div className="realtime-stat-title">Active Users</div>
              <div className="realtime-stat-value">
                {realtimeData.activeUsers}
              </div>
            </div>

            <div className="realtime-stat-card">
              <div className="realtime-stat-title">Queries (Last Hour)</div>
              <div className="realtime-stat-value">{realtimeData.queries}</div>
            </div>

            <div className="realtime-stat-card">
              <div className="realtime-stat-title">Error Rate</div>
              <div className="realtime-stat-value">
                {realtimeData.errorRate.toFixed(2)}%
              </div>
            </div>

            <div className="realtime-stat-card">
              <div className="realtime-stat-title">Avg Response Time</div>
              <div className="realtime-stat-value">
                {realtimeData.avgResponseTime.toFixed(2)}s
              </div>
            </div>
          </div>
        </div>

        {/* Main Charts */}
        <div className="charts-grid">
          {/* Activity Over Time Chart */}
          <div className="chart-card large">
            <h3 className="chart-title">Activity Over Time</h3>
            <div className="chart-container">
              <SafeChart
                data={dashboardData.timeSeriesData}
                type="line"
                height={300}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  tickFormatter={(date) => {
                    const d = new Date(date);
                    return d.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    });
                  }}
                />
                <YAxis tick={{ fontSize: 12, fill: "#64748b" }} />
                <Tooltip
                  formatter={(value) => [`${formatNumber(value)}`, null]}
                  labelFormatter={(date) =>
                    new Date(date).toLocaleDateString(undefined, {
                      weekday: "short",
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  }
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "0.375rem",
                    padding: "0.5rem",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="users"
                  name="Users"
                  stroke={COLORS[0]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="searches"
                  name="Searches"
                  stroke={COLORS[1]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="documents"
                  name="Documents"
                  stroke={COLORS[2]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
              </SafeChart>
            </div>
          </div>

          {/* User Growth */}
          <div className="chart-card">
            <h3 className="chart-title">User Growth</h3>
            <div className="chart-container user-growth-chart">
              <div className="growth-summary">
                <div className="growth-value">
                  <span className="total-value">
                    {dashboardData && dashboardData.userGrowth
                      ? formatNumber(dashboardData.userGrowth.total)
                      : 0}
                  </span>
                  <span className="total-label">Total Users</span>
                </div>
                <div className="growth-change">
                  <div className="change-value">
                    <span className="new-users">
                      +
                      {dashboardData && dashboardData.userGrowth
                        ? formatNumber(dashboardData.userGrowth.newInPeriod)
                        : 0}
                    </span>
                    <span className="percentage">
                      <span className="arrow">↑</span>
                      <span>
                        {dashboardData && dashboardData.userGrowth
                          ? dashboardData.userGrowth.percentChange + "%"
                          : 0}
                      </span>
                    </span>
                  </div>
                  <div className="change-label">New in selected period</div>
                </div>
              </div>
              <div className="growth-chart">
                <SafeChart
                  data={dashboardData?.timeSeriesData?.slice(-20) || []}
                  type="area"
                  height={120}
                >
                  {" "}
                  <defs>
                    <linearGradient
                      id="userGrowthGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor={COLORS[0]}
                        stopOpacity={0.8}
                      />
                      <stop
                        offset="95%"
                        stopColor={COLORS[0]}
                        stopOpacity={0.1}
                      />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    formatter={(value) => [
                      `${formatNumber(value)} users`,
                      null,
                    ]}
                    labelFormatter={(date) =>
                      new Date(date).toLocaleDateString()
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="users"
                    stroke={COLORS[0]}
                    fillOpacity={1}
                    fill="url(#userGrowthGradient)"
                  />
                </SafeChart>
              </div>
            </div>
          </div>

          {/* Top Searches */}
          <div className="chart-card">
            <h3 className="chart-title">Top Searches</h3>
            <div className="chart-container">
              <SafeChart
                data={dashboardData?.topSearches || []}
                type="bar"
                height={220}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={true}
                  vertical={false}
                />
                <XAxis type="number" tick={{ fontSize: 12, fill: "#64748b" }} />
                <YAxis
                  dataKey="term"
                  type="category"
                  width={150}
                  tick={{ fontSize: 12, fill: "#64748b" }}
                />
                <Tooltip
                  formatter={(value) => [
                    `${formatNumber(value)} searches`,
                    null,
                  ]}
                />
                <Bar dataKey="count" fill={COLORS[1]} radius={[0, 4, 4, 0]} />
              </SafeChart>
            </div>
          </div>

          {/* Popular Content */}
          <div className="chart-card">
            <h3 className="chart-title">Popular Content</h3>
            <div className="chart-container">
              <div className="popular-content-list">
                {(dashboardData.popularContent || []).map((item, index) => (
                  <div key={index} className="popular-content-item">
                    <div className="content-icon">
                      {item.type === "document" ? (
                        <FileText size={18} />
                      ) : item.type === "gallery" ? (
                        <Image size={18} />
                      ) : (
                        <FileText size={18} />
                      )}
                    </div>
                    <div className="content-info">
                      <div className="content-name">{item.name}</div>
                      <div className="content-stats">
                        <span className="content-views">
                          {formatNumber(item.views)} views
                        </span>
                      </div>
                    </div>
                    <div className="content-rank">{index + 1}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Users */}
          <div className="chart-card">
            <h3 className="chart-title">Recent Users</h3>
            <div className="chart-container">
              <div className="recent-users-list">
                {(dashboardData.recentUsers || []).map((user, index) => (
                  <div key={index} className="recent-user-item">
                    <div className="user-avatar">
                      {user.full_name?.charAt(0) || "U"}
                    </div>
                    <div className="user-info">
                      <div className="user-name">{user.full_name}</div>
                      <div className="user-joined">
                        Joined {new Date(user.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}

                {(!dashboardData.recentUsers ||
                  dashboardData.recentUsers.length === 0) && (
                  <div className="no-data-message">
                    <p>No recent users to display</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render users dashboard
  const renderUsersDashboard = () => {
    if (!userMetrics || !userMetrics.summary) {
      return (
        <div className="analytics-loading">
          <Loader className="spinner" size={32} />
          <p>Loading user metrics...</p>
        </div>
      );
    }

    return (
      <div className="analytics-dashboard">
        {/* User Stats Summary */}
        <div className="stats-summary">
          <div className="stat-card">
            <div className="stat-content">
              <h3>Total Users</h3>
              <div className="stat-value">
                {dashboardData && dashboardData.summary
                  ? formatNumber(dashboardData.summary.totalUsers)
                  : 0}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <h3>Active Users</h3>
              <div className="stat-value">
                {dashboardData && dashboardData.summary
                  ? formatNumber(dashboardData.summary.activeUsers)
                  : 0}
              </div>
              <div className="stat-detail">
                <span className="stat-percentage">
                  {Math.round(
                    (dashboardData && dashboardData.summary
                      ? dashboardData.summary.activeUsers
                      : 0 / dashboardData && dashboardData.summary
                      ? dashboardData.summary.totalUsers
                      : 0) * 100
                  )}
                  %
                </span>
                <span className="stat-label">of total</span>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <h3>New Users</h3>
              <div className="stat-value">
                {dashboardData && dashboardData.summary
                  ? formatNumber(dashboardData.summary.newUsers)
                  : 0}
              </div>
              <div className="stat-detail">
                <span className="stat-label">In selected period</span>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <h3>Churn Rate</h3>
              <div className="stat-value">
                {dashboardData && dashboardData.summary
                  ? dashboardData.summary.churnRate + "%"
                  : 0}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <h3>Avg. Sessions</h3>
              <div className="stat-value">
                {dashboardData && dashboardData.summary
                  ? dashboardData.summary.averageSessionsPerUser
                  : 0}
              </div>
              <div className="stat-detail">
                <span className="stat-label">per user</span>
              </div>
            </div>
          </div>
        </div>

        {/* User Charts */}
        <div className="charts-grid">
          {/* User Growth Chart */}
          <div className="chart-card large">
            <h3 className="chart-title">User Growth Over Time</h3>
            <div className="chart-container">
              <SafeChart
                data={userMetrics?.userGrowth || []}
                type="area"
                height={300}
              >
                <defs>
                  <linearGradient id="totalUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS[0]} stopOpacity={0.8} />
                    <stop
                      offset="95%"
                      stopColor={COLORS[0]}
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                  <linearGradient id="activeUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS[1]} stopOpacity={0.8} />
                    <stop
                      offset="95%"
                      stopColor={COLORS[1]}
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                  <linearGradient id="newUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS[2]} stopOpacity={0.8} />
                    <stop
                      offset="95%"
                      stopColor={COLORS[2]}
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  tickFormatter={(date) => {
                    const d = new Date(date);
                    return d.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    });
                  }}
                />
                <YAxis tick={{ fontSize: 12, fill: "#64748b" }} />
                <Tooltip
                  formatter={(value) => [`${formatNumber(value)}`, null]}
                  labelFormatter={(date) => new Date(date).toLocaleDateString()}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="users"
                  name="Total Users"
                  stroke={COLORS[0]}
                  fillOpacity={1}
                  fill="url(#totalUsers)"
                />
                <Area
                  type="monotone"
                  dataKey="activeUsers"
                  name="Active Users"
                  stroke={COLORS[1]}
                  fillOpacity={1}
                  fill="url(#activeUsers)"
                />
                <Area
                  type="monotone"
                  dataKey="newUsers"
                  name="New Users"
                  stroke={COLORS[2]}
                  fillOpacity={1}
                  fill="url(#newUsers)"
                />
              </SafeChart>
            </div>
          </div>

          {/* User Role Distribution */}
          <div className="chart-card">
            <h3 className="chart-title">User Role Distribution</h3>
            <div className="chart-container">
              <SafeChart
                data={
                  userMetrics?.roleDistribution
                    ? Object.entries(userMetrics.roleDistribution).map(
                        ([key, value]) => ({
                          name: key,
                          value,
                        })
                      )
                    : []
                }
                type="pie"
                height={250}
              >
                <Pie
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {userMetrics?.roleDistribution &&
                    Object.entries(userMetrics.roleDistribution).map(
                      ([key, value], index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      )
                    )}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [
                    `${formatNumber(value)} users`,
                    name,
                  ]}
                />
                <Legend />
              </SafeChart>
            </div>
          </div>

          {/* User Engagement by Type */}
          <div className="chart-card large">
            <h3 className="chart-title">User Engagement by Type</h3>
            <div className="chart-container">
              <SafeChart
                data={userMetrics?.engagementData || []}
                type="bar"
                height={250}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  tickFormatter={(date) => {
                    const d = new Date(date);
                    return d.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    });
                  }}
                />
                <YAxis tick={{ fontSize: 12, fill: "#64748b" }} />
                <Tooltip
                  formatter={(value) => [
                    `${formatNumber(value)} actions`,
                    null,
                  ]}
                  labelFormatter={(date) => new Date(date).toLocaleDateString()}
                />
                <Legend />
                <Bar dataKey="Search" stackId="a" fill={COLORS[0]} />
                <Bar dataKey="Chat" stackId="a" fill={COLORS[1]} />
                <Bar dataKey="Upload" stackId="a" fill={COLORS[2]} />
                <Bar dataKey="Download" stackId="a" fill={COLORS[3]} />
              </SafeChart>
            </div>
          </div>

          {/* Feature Engagement */}
          <div className="chart-card">
            <h3 className="chart-title">Engagement by Feature</h3>
            <div className="chart-container">
              <SafeChart
                data={userMetrics?.engagementByFeature || []}
                type="bar"
                height={250}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={true}
                  vertical={false}
                />
                <XAxis type="number" tick={{ fontSize: 12, fill: "#64748b" }} />
                <YAxis
                  dataKey="feature"
                  type="category"
                  width={120}
                  tick={{ fontSize: 12, fill: "#64748b" }}
                />
                <Tooltip
                  formatter={(value) => [`${formatNumber(value)} uses`, null]}
                />
                <Bar dataKey="count" fill={COLORS[4]} radius={[0, 4, 4, 0]} />
              </SafeChart>
            </div>
          </div>

          {/* User Funnel */}
          <div className="chart-card">
            <h3 className="chart-title">User Funnel</h3>
            <div className="chart-container">
              <div className="funnel-chart">
                {userMetrics.userFunnel.map((item, index) => {
                  const widthPercentage = Math.max(
                    10,
                    (item.value / userMetrics.userFunnel[0].value) * 100
                  );
                  return (
                    <div key={index} className="funnel-step">
                      <div className="funnel-label">{item.name}</div>
                      <div className="funnel-bar-container">
                        <div
                          className="funnel-bar"
                          style={{
                            width: `${widthPercentage}%`,
                            backgroundColor: COLORS[index % COLORS.length],
                          }}
                        >
                          <span className="funnel-value">
                            {formatNumber(item.value)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* User Retention */}
          <div className="chart-card">
            <h3 className="chart-title">User Retention</h3>
            <div className="chart-container">
              <SafeChart
                data={userMetrics?.retentionData || []}
                type="line"
                height={250}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: "#64748b" }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  formatter={(value) => [`${value}%`, "Retention Rate"]}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="retention"
                  name="Retention Rate"
                  stroke={COLORS[5]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </SafeChart>
            </div>
          </div>

          {/* User Referrals */}
          <div className="chart-card">
            <h3 className="chart-title">User Referrals</h3>
            <div className="chart-container">
              <SafeChart
                data={userMetrics?.userReferrals || []}
                type="pie"
                height={250}
              >
                <Pie
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {userMetrics.userReferrals.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [
                    `${formatNumber(value)} users`,
                    name,
                  ]}
                />
              </SafeChart>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render content dashboard
  const renderContentDashboard = () => {
    if (!contentMetrics || !contentMetrics.summary) {
      return (
        <div className="analytics-loading">
          <Loader className="spinner" size={32} />
          <p>Loading content metrics...</p>
        </div>
      );
    }

    return (
      <div className="analytics-dashboard">
        {/* Content Stats Summary */}
        <div className="stats-summary">
          <div className="stat-card">
            <div className="stat-content">
              <h3>Total Documents</h3>
              <div className="stat-value">
                {dashboardData && dashboardData.summary
                  ? formatNumber(dashboardData.summary.totalDocuments)
                  : 0}
              </div>
              <div className="stat-detail">
                <span className="stat-change positive">
                  +
                  {dashboardData && dashboardData.summary
                    ? formatNumber(dashboardData.summary.documentsAddedInPeriod)
                    : 0}
                </span>
                <span className="stat-label">in period</span>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <h3>Total Images</h3>
              <div className="stat-value">
                {dashboardData && dashboardData.summary
                  ? formatNumber(dashboardData.summary.totalImages)
                  : 0}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <h3>Total Folders</h3>
              <div className="stat-value">
                {dashboardData && dashboardData.summary
                  ? formatNumber(dashboardData.summary.totalFolders)
                  : 0}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <h3>Total Storage</h3>
              <div className="stat-value">
                {dashboardData && dashboardData.summary
                  ? dashboardData.summary.totalStorage + " GB"
                  : 0}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <h3>Avg File Size</h3>
              <div className="stat-value">
                {dashboardData && dashboardData.summary
                  ? dashboardData.summary.avgFileSize + " MB"
                  : 0}
              </div>
            </div>
          </div>
        </div>

        {/* Content Charts */}
        <div className="charts-grid">
          {/* Storage Growth Chart */}
          <div className="chart-card large">
            <h3 className="chart-title">Storage Usage Over Time</h3>
            <div className="chart-container">
              <SafeChart
                data={contentMetrics?.storageGrowth || []}
                type="line"
                height={300}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  tickFormatter={(date) => {
                    const d = new Date(date);
                    return d.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    });
                  }}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 12, fill: "#64748b" }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12, fill: "#64748b" }}
                />
                <Tooltip
                  formatter={(value, name) => {
                    if (name === "storageUsed")
                      return [`${value} GB`, "Storage Used"];
                    return [`${formatNumber(value)}`, "Documents"];
                  }}
                  labelFormatter={(date) => new Date(date).toLocaleDateString()}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="storageUsed"
                  name="Storage Used"
                  stroke={COLORS[1]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="documentsCount"
                  name="Documents"
                  stroke={COLORS[0]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
              </SafeChart>
            </div>
          </div>

          {/* Content Type Distribution */}
          <div className="chart-card">
            <h3 className="chart-title">Content Type Distribution</h3>
            <div className="chart-container">
              <SafeChart
                data={contentMetrics?.contentDistribution || []}
                type="pie"
                height={250}
              >
                <Pie
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  paddingAngle={2}
                  dataKey="count"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {contentMetrics.contentDistribution.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [`${formatNumber(value)} files`, ""]}
                />
              </SafeChart>
            </div>
          </div>

          {/* Content Engagement */}
          <div className="chart-card large">
            <h3 className="chart-title">Content Engagement Over Time</h3>
            <div className="chart-container">
              <SafeChart
                data={contentMetrics?.contentEngagement || []}
                type="bar"
                height={300}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: "#64748b" }}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: "#64748b" }}
                />
                <YAxis tick={{ fontSize: 12, fill: "#64748b" }} />
                <Tooltip
                  formatter={(value) => [`${formatNumber(value)}`, null]}
                />
                <Legend />
                <Bar dataKey="views" name="Views" fill={COLORS[0]} />
                <Bar dataKey="downloads" name="Downloads" fill={COLORS[1]} />
                <Bar dataKey="shares" name="Shares" fill={COLORS[2]} />
              </SafeChart>
            </div>
          </div>

          {/* Popular Content */}
          <div className="chart-card">
            <h3 className="chart-title">Top 10 Popular Content</h3>
            <div className="chart-container">
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Views</th>
                      <th>Downloads</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(contentMetrics.popularContent || []).map(
                      (item, index) => (
                        <tr key={index}>
                          <td className="content-name-cell">
                            {item.type === "document" ? (
                              <FileText size={16} />
                            ) : item.type === "gallery" ? (
                              <Image size={16} />
                            ) : (
                              <FileText size={16} />
                            )}
                            <span>{item.name}</span>
                          </td>
                          <td>{formatNumber(item.views)}</td>
                          <td>{formatNumber(item.downloads)}</td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Folder Access */}
          <div className="chart-card">
            <h3 className="chart-title">Folder Access</h3>
            <div className="chart-container">
              <SafeChart
                data={contentMetrics?.folderAccess || []}
                type="bar"
                height={250}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={true}
                  vertical={false}
                />
                <XAxis type="number" tick={{ fontSize: 12, fill: "#64748b" }} />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={150}
                  tick={{ fontSize: 12, fill: "#64748b" }}
                />
                <Tooltip
                  formatter={(value) => [
                    `${formatNumber(value)} accesses`,
                    null,
                  ]}
                />
                <Legend />
                <Bar
                  dataKey="accessCount"
                  name="Access Count"
                  fill={COLORS[3]}
                  radius={[0, 4, 4, 0]}
                />
                <Bar
                  dataKey="userCount"
                  name="User Count"
                  fill={COLORS[4]}
                  radius={[0, 4, 4, 0]}
                />
              </SafeChart>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render search dashboard
  const renderSearchDashboard = () => {
    if (!searchMetrics || !searchMetrics.summary) {
      return (
        <div className="analytics-loading">
          <Loader className="spinner" size={32} />
          <p>Loading search metrics...</p>
        </div>
      );
    }

    return (
      <div className="analytics-dashboard">
        {/* Search Stats Summary */}
        <div className="stats-summary">
          <div className="stat-card">
            <div className="stat-content">
              <h3>Total Searches</h3>
              <div className="stat-value">
                {dashboardData && dashboardData.summary
                  ? formatNumber(dashboardData.summary.totalSearches)
                  : 0}
              </div>
              <div className="stat-detail">
                <span className="stat-subvalue">
                  {dashboardData && dashboardData.summary
                    ? formatNumber(dashboardData.summary.searchesInPeriod)
                    : 0}
                </span>
                <span className="stat-label">in period</span>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <h3>Unique Searches</h3>
              <div className="stat-value">
                {dashboardData && dashboardData.summary
                  ? formatNumber(dashboardData.summary.uniqueSearches)
                  : 0}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <h3>Avg Per User</h3>
              <div className="stat-value">
                {dashboardData && dashboardData.summary
                  ? dashboardData.summary.avgSearchesPerUser
                  : 0}
              </div>
              <div className="stat-detail">
                <span className="stat-label">searches</span>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <h3>Zero Result Rate</h3>
              <div className="stat-value">
                {dashboardData && dashboardData.summary
                  ? dashboardData.summary.zeroResultRate + "%"
                  : 0}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <h3>Avg Results</h3>
              <div className="stat-value">
                {dashboardData && dashboardData.summary
                  ? dashboardData.summary.avgResultsPerSearch
                  : 0}
              </div>
              <div className="stat-detail">
                <span className="stat-label">per search</span>
              </div>
            </div>
          </div>
        </div>

        {/* Search Charts */}
        <div className="charts-grid">
          {/* Search Volume Chart */}
          <div className="chart-card large">
            <h3 className="chart-title">Search Volume Over Time</h3>
            <div className="chart-container">
              <SafeChart
                data={searchMetrics?.searchVolume || []}
                type="line"
                height={300}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  tickFormatter={(date) => {
                    const d = new Date(date);
                    return d.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    });
                  }}
                />
                <YAxis tick={{ fontSize: 12, fill: "#64748b" }} />
                <Tooltip
                  formatter={(value) => [`${formatNumber(value)}`, null]}
                  labelFormatter={(date) => new Date(date).toLocaleDateString()}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="searches"
                  name="Searches"
                  stroke={COLORS[0]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="uniqueUsers"
                  name="Unique Users"
                  stroke={COLORS[1]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
              </SafeChart>
            </div>
          </div>

          {/* Top Search Terms */}
          <div className="chart-card">
            <h3 className="chart-title">Top Search Terms</h3>
            <div className="chart-container">
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Term</th>
                      <th>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(searchMetrics.topSearchTerms || []).map((item, index) => (
                      <tr key={index}>
                        <td>{item.term}</td>
                        <td>{formatNumber(item.count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Search Categories */}
          <div className="chart-card">
            <h3 className="chart-title">Search Categories</h3>
            <div className="chart-container">
              <SafeChart
                data={searchMetrics?.searchCategories || []}
                type="pie"
                height={250}
              >
                <Pie
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="percentage"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {searchMetrics.searchCategories.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value}%`, ""]} />
              </SafeChart>
            </div>
          </div>

          {/* Search Types */}
          <div className="chart-card">
            <h3 className="chart-title">Search by Type</h3>
            <div className="chart-container">
              <SafeChart
                data={searchMetrics?.searchByType || []}
                type="bar"
                height={250}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="type"
                  tick={{ fontSize: 12, fill: "#64748b" }}
                />
                <YAxis tick={{ fontSize: 12, fill: "#64748b" }} />
                <Tooltip
                  formatter={(value) => [
                    `${formatNumber(value)} searches`,
                    null,
                  ]}
                />
                <Bar dataKey="count" fill={COLORS[2]} radius={[4, 4, 0, 0]} />
              </SafeChart>
            </div>
          </div>

          {/* Search Performance */}
          <div className="chart-card">
            <h3 className="chart-title">Search Performance</h3>
            <div className="chart-container">
              <div className="metrics-list">
                {(searchMetrics.searchPerformance || []).map(
                  (metric, index) => (
                    <div key={index} className="metric-item">
                      <div className="metric-name">{metric.metric}</div>
                      <div className="metric-value">{metric.value}</div>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Zero Result Searches */}
          <div className="chart-card">
            <h3 className="chart-title">Top Zero Result Searches</h3>
            <div className="chart-container">
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Term</th>
                      <th>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(searchMetrics.zeroResultSearches || []).map(
                      (item, index) => (
                        <tr key={index}>
                          <td>{item.term}</td>
                          <td>{formatNumber(item.count)}</td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render system dashboard
  const renderSystemDashboard = () => {
    if (!systemMetrics || !systemMetrics.summary) {
      return (
        <div className="analytics-loading">
          <Loader className="spinner" size={32} />
          <p>Loading system metrics...</p>
        </div>
      );
    }

    return (
      <div className="analytics-dashboard">
        {/* System Stats Summary */}
        <div className="stats-summary">
          <div className="stat-card">
            <div className="stat-content">
              <h3>API Calls</h3>
              <div className="stat-value">
                {dashboardData && dashboardData.summary
                  ? formatNumber(dashboardData.summary.apiCalls)
                  : 0}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <h3>Error Rate</h3>
              <div className="stat-value">
                {dashboardData && dashboardData.summary
                  ? dashboardData.summary.errorRate + "%"
                  : 0}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <h3>Avg Response</h3>
              <div className="stat-value">
                {dashboardData && dashboardData.summary
                  ? dashboardData.summary.avgResponseTime + "s"
                  : 0}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <h3>P95 Response</h3>
              <div className="stat-value">
                {dashboardData && dashboardData.summary
                  ? dashboardData.summary.p95ResponseTime + "s"
                  : 0}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <h3>Uptime</h3>
              <div className="stat-value">
                {dashboardData && dashboardData.summary
                  ? dashboardData.summary.uptime + "%"
                  : 0}
              </div>
            </div>
          </div>
        </div>

        {/* System Charts */}
        <div className="charts-grid">
          {/* Performance Over Time */}
          <div className="chart-card large">
            <h3 className="chart-title">System Performance Over Time</h3>
            <div className="chart-container">
              <SafeChart
                data={systemMetrics?.performance || []}
                type="line"
                height={300}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  tickFormatter={(date) => {
                    const d = new Date(date);
                    return d.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    });
                  }}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 12, fill: "#64748b" }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12, fill: "#64748b" }}
                />
                <Tooltip
                  formatter={(value, name) => {
                    if (name === "responseTime")
                      return [`${value}s`, "Response Time"];
                    if (name === "errorRate")
                      return [`${value}%`, "Error Rate"];
                    return [`${formatNumber(value)}`, "Requests"];
                  }}
                  labelFormatter={(date) => new Date(date).toLocaleDateString()}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="responseTime"
                  name="Response Time"
                  stroke={COLORS[0]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="errorRate"
                  name="Error Rate"
                  stroke={COLORS[3]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="requests"
                  name="Requests"
                  stroke={COLORS[1]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
              </SafeChart>
            </div>
          </div>

          {/* Resource Usage */}
          <div className="chart-card large">
            <h3 className="chart-title">Resource Usage</h3>
            <div className="chart-container">
              <SafeChart
                data={systemMetrics?.resourceUsage || []}
                type="area"
                height={250}
              >
                <defs>
                  <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS[0]} stopOpacity={0.8} />
                    <stop
                      offset="95%"
                      stopColor={COLORS[0]}
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                  <linearGradient id="colorMemory" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS[1]} stopOpacity={0.8} />
                    <stop
                      offset="95%"
                      stopColor={COLORS[1]}
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                  <linearGradient id="colorStorage" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS[2]} stopOpacity={0.8} />
                    <stop
                      offset="95%"
                      stopColor={COLORS[2]}
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  tickFormatter={(date) => {
                    const d = new Date(date);
                    return d.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    });
                  }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  formatter={(value) => [`${value}%`, null]}
                  labelFormatter={(date) => new Date(date).toLocaleDateString()}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="cpu"
                  name="CPU Usage"
                  stroke={COLORS[0]}
                  fillOpacity={1}
                  fill="url(#colorCpu)"
                />
                <Area
                  type="monotone"
                  dataKey="memory"
                  name="Memory Usage"
                  stroke={COLORS[1]}
                  fillOpacity={1}
                  fill="url(#colorMemory)"
                />
                <Area
                  type="monotone"
                  dataKey="storage"
                  name="Storage Usage"
                  stroke={COLORS[2]}
                  fillOpacity={1}
                  fill="url(#colorStorage)"
                />
              </SafeChart>
            </div>
          </div>

          {/* Error Types */}
          <div className="chart-card">
            <h3 className="chart-title">Errors by Type</h3>
            <div className="chart-container">
              <SafeChart
                data={systemMetrics?.errorsByType || []}
                type="pie"
                height={250}
              >
                <Pie
                  data={systemMetrics.errorsByType}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="count"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {systemMetrics.errorsByType.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [`${formatNumber(value)} errors`, null]}
                />
              </SafeChart>
            </div>
          </div>

          {/* Endpoint Performance */}
          <div className="chart-card large">
            <h3 className="chart-title">Endpoint Performance</h3>
            <div className="chart-container">
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Endpoint</th>
                      <th>Calls</th>
                      <th>Avg Time</th>
                      <th>Error Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(systemMetrics.endpointPerformance || []).map(
                      (item, index) => (
                        <tr key={index}>
                          <td>{item.endpoint}</td>
                          <td>{formatNumber(item.calls)}</td>
                          <td>{item.avgTime}s</td>
                          <td
                            className={
                              item.errorRate > 1 ? "value-warning" : ""
                            }
                          >
                            {item.errorRate}%
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Alerts & Incidents */}
          <div className="chart-card">
            <h3 className="chart-title">Recent Alerts & Incidents</h3>
            <div className="chart-container">
              <div className="alerts-list">
                {(systemMetrics.alertsAndIncidents || []).map(
                  (alert, index) => (
                    <div key={index} className="alert-item">
                      <div className="alert-header">
                        <div className="alert-title">{alert.title}</div>
                        <div
                          className={`alert-status ${alert.status.toLowerCase()}`}
                        >
                          {alert.status}
                        </div>
                      </div>
                      <div className="alert-info">
                        <div className="alert-date">{alert.date}</div>
                        <div className="alert-duration">
                          Duration: {alert.duration}
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Fetch integration analytics (mock for now)
  const fetchIntegrationMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all integrations
      const { data: integrationsData, error: integrationsError } =
        await supabase
          .from("integrations")
          .select("id, provider, config, created_at, updated_at");
      if (integrationsError) throw integrationsError;

      // Fetch all integration logs in the selected date range
      const { data: logsData, error: logsError } = await supabase
        .from("integration_logs")
        .select("provider, event_type, created_at")
        .gte("created_at", dateRange.start)
        .lte("created_at", dateRange.end);
      if (logsError) throw logsError;

      // Summarize integrations
      const totalIntegrations = integrationsData.length;
      let connected = 0;
      let disconnected = 0;
      let lastSync = null;
      let errors = 0;
      const integrationMap = {};
      const now = new Date();

      // Map logs by provider
      const logsByProvider = {};
      logsData.forEach((log) => {
        if (!logsByProvider[log.provider]) logsByProvider[log.provider] = [];
        logsByProvider[log.provider].push(log);
        if (log.event_type === "error") errors++;
      });

      // Build integration analytics
      const integrations = integrationsData.map((integration) => {
        const provider = integration.provider;
        const logs = logsByProvider[provider] || [];
        // Status: if there are logs in the period, consider connected
        const status = logs.length > 0 ? "connected" : "disconnected";
        if (status === "connected") connected++;
        else disconnected++;
        // Last sync: latest log
        const lastLog = logs.reduce((latest, log) => {
          const logDate = new Date(log.created_at);
          return !latest || logDate > new Date(latest.created_at)
            ? log
            : latest;
        }, null);
        if (
          lastLog &&
          (!lastSync || new Date(lastLog.created_at) > new Date(lastSync))
        ) {
          lastSync = lastLog.created_at;
        }
        // Usage: number of logs
        const usage = logs.length;
        // Errors: number of error logs for this integration
        const integrationErrors = logs.filter(
          (log) => log.event_type === "error"
        ).length;
        return {
          id: integration.id,
          name: provider.charAt(0).toUpperCase() + provider.slice(1),
          status,
          lastSync: lastLog ? lastLog.created_at : null,
          errors: integrationErrors,
          usage,
        };
      });

      setIntegrationMetrics({
        summary: {
          totalIntegrations,
          connected,
          disconnected,
          lastSync,
          errors,
        },
        integrations,
      });
    } catch (err) {
      setError("Failed to load integration analytics.");
      setIntegrationMetrics(null);
    } finally {
      setLoading(false);
    }
  };

  // Fetch integration metrics when tab/date changes
  useEffect(() => {
    if (activeTab === "integrations" && dateRange.start && dateRange.end) {
      fetchIntegrationMetrics();
    }
  }, [activeTab, dateRange]);

  // Add after other render*Dashboard functions
  const renderIntegrationsDashboard = () => {
    if (!integrationMetrics || !integrationMetrics.summary) {
      return (
        <div className="analytics-loading">
          <Loader className="spinner" size={32} />
          <p>Loading integration analytics...</p>
        </div>
      );
    }
    const { summary, integrations } = integrationMetrics;
    return (
      <div className="analytics-dashboard">
        {/* Integrations Summary */}
        <div className="stats-summary">
          <div className="stat-card">
            <div className="stat-content">
              <h3>Total Integrations</h3>
              <div className="stat-value">
                {formatNumber(summary.totalIntegrations)}
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-content">
              <h3>Connected</h3>
              <div className="stat-value">
                {formatNumber(summary.connected)}
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-content">
              <h3>Disconnected</h3>
              <div className="stat-value">
                {formatNumber(summary.disconnected)}
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-content">
              <h3>Errors</h3>
              <div className="stat-value">{formatNumber(summary.errors)}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-content">
              <h3>Last Sync</h3>
              <div className="stat-value">
                {summary.lastSync
                  ? new Date(summary.lastSync).toLocaleString()
                  : "-"}
              </div>
            </div>
          </div>
        </div>
        {/* Integrations Table */}
        <div className="chart-card large">
          <h3 className="chart-title">Integration Status & Usage</h3>
          <div className="chart-container">
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Last Sync</th>
                    <th>Errors</th>
                    <th>Usage</th>
                  </tr>
                </thead>
                <tbody>
                  {integrations.map((item, idx) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>
                        <span
                          className={
                            item.status === "connected"
                              ? "stat-subvalue"
                              : item.status === "disconnected"
                              ? "stat-label"
                              : ""
                          }
                        >
                          {item.status.charAt(0).toUpperCase() +
                            item.status.slice(1)}
                        </span>
                      </td>
                      <td>
                        {item.lastSync
                          ? new Date(item.lastSync).toLocaleString()
                          : "-"}
                      </td>
                      <td>{item.errors}</td>
                      <td>{formatNumber(item.usage)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Top-level null check for dashboardData and summary
  if (!dashboardData || !dashboardData.summary) {
    return (
      <div className="analytics-loading">
        <Loader className="spinner" size={32} />
        <p>Loading analytics dashboard...</p>
      </div>
    );
  }

  return (
    <div className="enhanced-analytics-dashboard">
      <div className="dashboard-content">
        <div className="dashboard-header">
          <div className="header-title">
            <h1>Analytics Dashboard</h1>
          </div>

          <div className="dashboard-actions">
            <div className="dashboard-presets">
              <select
                value={selectedPreset}
                onChange={(e) => setSelectedPreset(e.target.value)}
                className="preset-select"
              >
                {presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>

              <button
                className="save-button"
                onClick={() => setShowSaveModal(true)}
              >
                <Save size={16} />
                <span>Save</span>
              </button>
            </div>

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
                className={timeframe === "quarter" ? "active" : ""}
                onClick={() => handleTimeframeChange("quarter")}
              >
                Quarter
              </button>
              <button
                className={timeframe === "year" ? "active" : ""}
                onClick={() => handleTimeframeChange("year")}
              >
                Year
              </button>
            </div>

            <div className="dashboard-buttons">
              <button
                className=" refresh-button"
                onClick={handleRefresh}
                disabled={loading}
                style={{
                  backgroundColor: "#fff",
                  color: "#000",
                  marginRight: "0",
                  padding: "auto",
                  justifyContent: "center",
                  textAlign: "center",
                  alignItems: "center",
                }}
              >
                <RefreshCw
                  style={{
                    marginBottom: "0",
                    color: "#fff",
                    padding: "0",
                    justifyContent: "center",
                    textAlign: "center",
                    alignItems: "center",
                    marginRight: "0",
                  }}
                  size={16}
                  className={loading ? "spinning" : ""}
                />
                <span></span>
              </button>

              <button
                className=" export-button"
                onClick={() => handleExport("csv")}
                disabled={loading}
              >
                <Download size={16} />
                <span>Export</span>
              </button>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="error-message">
            <AlertCircle size={16} />
            <p>{error}</p>
          </div>
        )}

        {/* Dashboard tabs */}
        <div className="dashboard-tabs">
          <button
            className={activeTab === "overview" ? "active" : ""}
            onClick={() => setActiveTab("overview")}
          >
            <BarChart4 size={16} />
            <span>Overview</span>
          </button>
          <button
            className={activeTab === "users" ? "active" : ""}
            onClick={() => setActiveTab("users")}
          >
            <Users size={16} />
            <span>Users</span>
          </button>
          <button
            className={activeTab === "content" ? "active" : ""}
            onClick={() => setActiveTab("content")}
          >
            <FileText size={16} />
            <span>Content</span>
          </button>
          <button
            className={activeTab === "search" ? "active" : ""}
            onClick={() => setActiveTab("search")}
          >
            <Search size={16} />
            <span>Search</span>
          </button>
          <button
            className={activeTab === "system" ? "active" : ""}
            onClick={() => setActiveTab("system")}
          >
            <Settings size={16} />
            <span>System</span>
          </button>
          <button
            className={activeTab === "integrations" ? "active" : ""}
            onClick={() => setActiveTab("integrations")}
          >
            <LinkIcon size={16} />
            <span>Integrations</span>
          </button>
        </div>

        {/* Dashboard content */}
        <div className="dashboard-main">
          {loading &&
          !dashboardData &&
          !userMetrics &&
          !contentMetrics &&
          !searchMetrics &&
          !systemMetrics ? (
            <div className="analytics-loading">
              <Loader className="spinner" size={32} />
              <p>Loading dashboard data...</p>
            </div>
          ) : (
            renderDashboard()
          )}
        </div>
      </div>

      {/* Save Dashboard Modal */}
      {showSaveModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3>Save Dashboard</h3>
              <button
                className="modal-close"
                onClick={() => setShowSaveModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="dashboardName">Dashboard Name</label>
                <input
                  type="text"
                  id="dashboardName"
                  value={dashboardName}
                  onChange={(e) => setDashboardName(e.target.value)}
                  placeholder="My Custom Dashboard"
                  className="form-input"
                />
              </div>

              <div className="form-info">
                <p>
                  This will save your current dashboard configuration including
                  selected timeframe, active tab, and filter settings.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="cancel-button"
                onClick={() => setShowSaveModal(false)}
              >
                Cancel
              </button>
              <button
                className="submit-button"
                onClick={handleSaveDashboard}
                disabled={!dashboardName}
              >
                <Save size={14} />
                Save Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedAnalyticsDashboard;
