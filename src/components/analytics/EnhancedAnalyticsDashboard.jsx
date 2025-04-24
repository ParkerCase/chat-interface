// src/components/analytics/EnhancedAnalyticsDashboard.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useFeatureFlags } from "../../utils/featureFlags";
import { supabase } from "../../lib/supabase";
import { SupabaseAnalytics } from "../../utils/SupabaseAnalyticsIntegration";
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
      .catch((err) =>
        console.warn("Error fetching initial realtime stats:", err)
      );

    return () => {
      // Clean up subscriptions and intervals
      supabase.removeChannel(statsChannel);
      clearInterval(interval);
    };
  }, []);

  // Main function to fetch all dashboard data
  const fetchDashboardData = async () => {
    try {
      setLoading(true); // Use setLoading instead of setIsLoading
      setError(null);

      // Track analytics view event
      SupabaseAnalytics.trackEvent("dashboard_view", {
        timeframe,
        activeTab,
        preset: selectedPreset,
      });

      // We'll fetch different data based on the active tab
      switch (activeTab) {
        case "overview":
          const overviewData = await SupabaseAnalytics.getDashboardData(
            timeframe,
            dateRange
          );
          setDashboardData(overviewData);
          break;
        case "users":
          const userMetricsData = await SupabaseAnalytics.getUserMetrics(
            timeframe,
            dateRange
          );
          setUserMetrics(userMetricsData);
          break;
        case "content":
          const contentMetricsData = await SupabaseAnalytics.getContentMetrics(
            timeframe,
            dateRange
          );
          setContentMetrics(contentMetricsData);
          break;
        case "search":
          const searchMetricsData = await SupabaseAnalytics.getSearchMetrics(
            timeframe,
            dateRange
          );
          setSearchMetrics(searchMetricsData);
          break;
        case "system":
          const systemMetricsData = await SupabaseAnalytics.getSystemMetrics(
            timeframe,
            dateRange
          );
          setSystemMetrics(systemMetricsData);
          break;
        default:
          // Default to overview
          const defaultData = await SupabaseAnalytics.getDashboardData(
            timeframe,
            dateRange
          );
          setDashboardData(defaultData);
      }

      // Get realtime data regardless of the tab
      const realtimeData = await SupabaseAnalytics.getRealtimeStats();
      setRealtimeData(realtimeData);
    } catch (err) {
      console.error("Error loading analytics:", err);
      setError(`Failed to load analytics data: ${err.message}`);
    } finally {
      setLoading(false); // Use setLoading instead of setIsLoading
    }
  };

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

  // Fetch overview dashboard data
  const fetchOverviewData = async () => {
    try {
      // In a real app, you would fetch from your Supabase tables
      // Here we're generating sample data for demonstration

      // Get user counts from profiles table
      const { data: userCountData, error: userCountError } = await supabase
        .from("profiles")
        .select("id, created_at", { count: "exact" });

      if (userCountError) throw userCountError;

      // Get recent users
      const { data: recentUsersData, error: recentUsersError } = await supabase
        .from("profiles")
        .select("id, full_name, created_at")
        .order("created_at", { ascending: false })
        .limit(5);

      if (recentUsersError) throw recentUsersError;

      // Calculate user growth
      const totalUsers = userCountData.length;
      const usersInTimeframe = userCountData.filter(
        (user) => new Date(user.created_at) >= new Date(dateRange.start)
      ).length;

      // Get session counts from analytics_events
      const { data: sessionData, error: sessionError } = await supabase
        .from("analytics_events")
        .select("id")
        .eq("event_type", "session_start")
        .gte("created_at", dateRange.start)
        .lte("created_at", dateRange.end);

      if (sessionError && sessionError.code !== "PGRST116") throw sessionError;

      // Generate time series data for the overview
      const timeSeriesData = generateTimeSeriesData(timeframe, dateRange);

      // Generate sample data for remaining metrics
      // In a real app, these would come from your database
      const overview = {
        summary: {
          totalUsers: totalUsers,
          activeUsers: Math.round(totalUsers * 0.65),
          totalSessions: sessionData?.length || Math.round(totalUsers * 2.5),
          avgSessionDuration: 8.2,
          totalSearches: Math.round(totalUsers * 15),
          totalDocuments: 1248,
          totalImages: 723,
        },
        timeSeriesData: timeSeriesData,
        userGrowth: {
          total: totalUsers,
          newInPeriod: usersInTimeframe,
          percentChange:
            usersInTimeframe > 0
              ? Math.round((usersInTimeframe / totalUsers) * 100)
              : 0,
        },
        topSearches: [
          { term: "tattoo removal process", count: 145 },
          { term: "pricing", count: 98 },
          { term: "before and after", count: 76 },
          { term: "procedure details", count: 62 },
          { term: "safety information", count: 49 },
        ],
        popularContent: [
          { name: "Treatment Guide", views: 312, type: "document" },
          { name: "Aftercare Instructions", views: 245, type: "document" },
          { name: "Before/After Gallery", views: 198, type: "gallery" },
          { name: "Pricing Information", views: 176, type: "document" },
          { name: "FAQ Document", views: 145, type: "document" },
        ],
        recentUsers: recentUsersData || [],
      };

      setDashboardData(overview);
    } catch (error) {
      console.error("Error fetching overview data:", error);
      throw error;
    }
  };

  // Handle refresh button click
  const handleRefresh = async () => {
    try {
      setLoading(true);
      setError(null);

      await fetchDashboardData();

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
      default:
        return renderOverviewDashboard();
    }
  };

  // Render overview dashboard
  const renderOverviewDashboard = () => {
    if (!dashboardData) {
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
                {formatNumber(dashboardData.summary.totalUsers)}
              </div>
              <div className="stat-detail">
                <span className="stat-label">Active:</span>
                <span className="stat-subvalue">
                  {formatNumber(dashboardData.summary.activeUsers)}
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
                {formatNumber(dashboardData.summary.totalSessions)}
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
                {formatNumber(dashboardData.summary.totalSearches)}
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
                {formatNumber(dashboardData.summary.totalDocuments)}
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
                {formatNumber(dashboardData.summary.totalImages)}
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
                    {formatNumber(dashboardData.userGrowth.total)}
                  </span>
                  <span className="total-label">Total Users</span>
                </div>
                <div className="growth-change">
                  <div className="change-value">
                    <span className="new-users">
                      +{formatNumber(dashboardData.userGrowth.newInPeriod)}
                    </span>
                    <span className="percentage">
                      <span className="arrow">↑</span>
                      <span>{dashboardData.userGrowth.percentChange}%</span>
                    </span>
                  </div>
                  <div className="change-label">New in selected period</div>
                </div>
              </div>
              <div className="growth-chart">
                <ResponsiveContainer width="100%" height={120}>
                  <AreaChart data={dashboardData.timeSeriesData.slice(-20)}>
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
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Top Searches */}
          <div className="chart-card">
            <h3 className="chart-title">Top Searches</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  layout="vertical"
                  data={dashboardData.topSearches}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={true}
                    vertical={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 12, fill: "#64748b" }}
                  />
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
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Popular Content */}
          <div className="chart-card">
            <h3 className="chart-title">Popular Content</h3>
            <div className="chart-container">
              <div className="popular-content-list">
                {dashboardData.popularContent.map((item, index) => (
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
                {dashboardData.recentUsers.map((user, index) => (
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
    if (!userMetrics) {
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
                {formatNumber(userMetrics.summary.totalUsers)}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <h3>Active Users</h3>
              <div className="stat-value">
                {formatNumber(userMetrics.summary.activeUsers)}
              </div>
              <div className="stat-detail">
                <span className="stat-percentage">
                  {Math.round(
                    (userMetrics.summary.activeUsers /
                      userMetrics.summary.totalUsers) *
                      100
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
                {formatNumber(userMetrics.summary.newUsers)}
              </div>
              <div className="stat-detail">
                <span className="stat-label">In selected period</span>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <h3>Churn Rate</h3>
              <div className="stat-value">{userMetrics.summary.churnRate}%</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <h3>Avg. Sessions</h3>
              <div className="stat-value">
                {userMetrics.summary.averageSessionsPerUser}
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
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={userMetrics.userGrowth}>
                  <defs>
                    <linearGradient id="totalUsers" x1="0" y1="0" x2="0" y2="1">
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
                    <linearGradient
                      id="activeUsers"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor={COLORS[1]}
                        stopOpacity={0.8}
                      />
                      <stop
                        offset="95%"
                        stopColor={COLORS[1]}
                        stopOpacity={0.1}
                      />
                    </linearGradient>
                    <linearGradient id="newUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={COLORS[2]}
                        stopOpacity={0.8}
                      />
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
                    labelFormatter={(date) =>
                      new Date(date).toLocaleDateString()
                    }
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
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* User Role Distribution */}
          <div className="chart-card">
            <h3 className="chart-title">User Role Distribution</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={Object.entries(userMetrics.roleDistribution).map(
                      ([key, value]) => ({
                        name: key,
                        value,
                      })
                    )}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {Object.entries(userMetrics.roleDistribution).map(
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
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* User Engagement by Type */}
          <div className="chart-card large">
            <h3 className="chart-title">User Engagement by Type</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={userMetrics.engagementData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
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
                    labelFormatter={(date) =>
                      new Date(date).toLocaleDateString()
                    }
                  />
                  <Legend />
                  <Bar dataKey="Search" stackId="a" fill={COLORS[0]} />
                  <Bar dataKey="Chat" stackId="a" fill={COLORS[1]} />
                  <Bar dataKey="Upload" stackId="a" fill={COLORS[2]} />
                  <Bar dataKey="Download" stackId="a" fill={COLORS[3]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Feature Engagement */}
          <div className="chart-card">
            <h3 className="chart-title">Engagement by Feature</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  layout="vertical"
                  data={userMetrics.engagementByFeature}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={true}
                    vertical={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 12, fill: "#64748b" }}
                  />
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
                </BarChart>
              </ResponsiveContainer>
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
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={userMetrics.retentionData}>
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
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* User Referrals */}
          <div className="chart-card">
            <h3 className="chart-title">User Referrals</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={userMetrics.userReferrals}
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
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render content dashboard
  const renderContentDashboard = () => {
    if (!contentMetrics) {
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
                {formatNumber(contentMetrics.summary.totalDocuments)}
              </div>
              <div className="stat-detail">
                <span className="stat-change positive">
                  +{formatNumber(contentMetrics.summary.documentsAddedInPeriod)}
                </span>
                <span className="stat-label">in period</span>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <h3>Total Images</h3>
              <div className="stat-value">
                {formatNumber(contentMetrics.summary.totalImages)}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <h3>Total Folders</h3>
              <div className="stat-value">
                {formatNumber(contentMetrics.summary.totalFolders)}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <h3>Total Storage</h3>
              <div className="stat-value">
                {contentMetrics.summary.totalStorage} GB
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <h3>Avg File Size</h3>
              <div className="stat-value">
                {contentMetrics.summary.avgFileSize} MB
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
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={contentMetrics.storageGrowth}>
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
                    labelFormatter={(date) =>
                      new Date(date).toLocaleDateString()
                    }
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
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Content Type Distribution */}
          <div className="chart-card">
            <h3 className="chart-title">Content Type Distribution</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={contentMetrics.contentDistribution}
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
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Content Engagement */}
          <div className="chart-card large">
            <h3 className="chart-title">Content Engagement Over Time</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={contentMetrics.contentEngagement}>
                  <CartesianGrid strokeDasharray="3 3" />
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
                </BarChart>
              </ResponsiveContainer>
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
                    {contentMetrics.popularContent.map((item, index) => (
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
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Folder Access */}
          <div className="chart-card">
            <h3 className="chart-title">Folder Access</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  layout="vertical"
                  data={contentMetrics.folderAccess}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={true}
                    vertical={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 12, fill: "#64748b" }}
                  />
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
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render search dashboard
  const renderSearchDashboard = () => {
    if (!searchMetrics) {
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
                {formatNumber(searchMetrics.summary.totalSearches)}
              </div>
              <div className="stat-detail">
                <span className="stat-subvalue">
                  {formatNumber(searchMetrics.summary.searchesInPeriod)}
                </span>
                <span className="stat-label">in period</span>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <h3>Unique Searches</h3>
              <div className="stat-value">
                {formatNumber(searchMetrics.summary.uniqueSearches)}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <h3>Avg Per User</h3>
              <div className="stat-value">
                {searchMetrics.summary.avgSearchesPerUser}
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
                {searchMetrics.summary.zeroResultRate}%
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <h3>Avg Results</h3>
              <div className="stat-value">
                {searchMetrics.summary.avgResultsPerSearch}
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
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={searchMetrics.searchVolume}>
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
                    labelFormatter={(date) =>
                      new Date(date).toLocaleDateString()
                    }
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
                </LineChart>
              </ResponsiveContainer>
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
                    {searchMetrics.topSearchTerms.map((item, index) => (
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
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={searchMetrics.searchCategories}
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
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Search Types */}
          <div className="chart-card">
            <h3 className="chart-title">Search by Type</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={searchMetrics.searchByType}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
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
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Search Performance */}
          <div className="chart-card">
            <h3 className="chart-title">Search Performance</h3>
            <div className="chart-container">
              <div className="metrics-list">
                {searchMetrics.searchPerformance.map((metric, index) => (
                  <div key={index} className="metric-item">
                    <div className="metric-name">{metric.metric}</div>
                    <div className="metric-value">{metric.value}</div>
                  </div>
                ))}
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
                    {searchMetrics.zeroResultSearches.map((item, index) => (
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
        </div>
      </div>
    );
  };

  // Render system dashboard
  const renderSystemDashboard = () => {
    if (!systemMetrics) {
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
                {formatNumber(systemMetrics.summary.apiCalls)}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <h3>Error Rate</h3>
              <div className="stat-value">
                {systemMetrics.summary.errorRate}%
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <h3>Avg Response</h3>
              <div className="stat-value">
                {systemMetrics.summary.avgResponseTime}s
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <h3>P95 Response</h3>
              <div className="stat-value">
                {systemMetrics.summary.p95ResponseTime}s
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <h3>Uptime</h3>
              <div className="stat-value">{systemMetrics.summary.uptime}%</div>
            </div>
          </div>
        </div>

        {/* System Charts */}
        <div className="charts-grid">
          {/* Performance Over Time */}
          <div className="chart-card large">
            <h3 className="chart-title">System Performance Over Time</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={systemMetrics.performance}>
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
                    labelFormatter={(date) =>
                      new Date(date).toLocaleDateString()
                    }
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
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Resource Usage */}
          <div className="chart-card large">
            <h3 className="chart-title">Resource Usage</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={systemMetrics.resourceUsage}>
                  <defs>
                    <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
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
                    <linearGradient
                      id="colorMemory"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor={COLORS[1]}
                        stopOpacity={0.8}
                      />
                      <stop
                        offset="95%"
                        stopColor={COLORS[1]}
                        stopOpacity={0.1}
                      />
                    </linearGradient>
                    <linearGradient
                      id="colorStorage"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor={COLORS[2]}
                        stopOpacity={0.8}
                      />
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
                    labelFormatter={(date) =>
                      new Date(date).toLocaleDateString()
                    }
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
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Error Types */}
          <div className="chart-card">
            <h3 className="chart-title">Errors by Type</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
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
                    formatter={(value) => [
                      `${formatNumber(value)} errors`,
                      null,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
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
                    {systemMetrics.endpointPerformance.map((item, index) => (
                      <tr key={index}>
                        <td>{item.endpoint}</td>
                        <td>{formatNumber(item.calls)}</td>
                        <td>{item.avgTime}s</td>
                        <td
                          className={item.errorRate > 1 ? "value-warning" : ""}
                        >
                          {item.errorRate}%
                        </td>
                      </tr>
                    ))}
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
                {systemMetrics.alertsAndIncidents.map((alert, index) => (
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
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="enhanced-analytics-dashboard">
      <div className="dashboard-content">
        <div className="dashboard-header">
          <div className="header-title">
            <h1>Analytics Dashboard</h1>
            <span className="tier-badge">{organizationTier}</span>
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
                className="action-button save-button"
                onClick={() => setShowSaveModal(true)}
              >
                <Save size={16} />
                <span>Save As</span>
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
                className="action-button refresh-button"
                onClick={handleRefresh}
                disabled={loading}
              >
                <RefreshCw size={16} className={loading ? "spinning" : ""} />
                <span>Refresh</span>
              </button>

              <button
                className="action-button export-button"
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
