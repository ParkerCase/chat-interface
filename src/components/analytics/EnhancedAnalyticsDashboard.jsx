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
  Shield,
  Database,
  Cloud,
  Monitor,
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
  const [selectedPreset, setSelectedPreset] = useState("default");
  const [presets, setPresets] = useState([
    { id: "default", name: "Default Dashboard", isDefault: true },
    { id: "user-focused", name: "User Activity", isDefault: false },
    { id: "content-focused", name: "Content Performance", isDefault: false },
    { id: "system", name: "System Health", isDefault: false },
  ]);
  const [dashboardName, setDashboardName] = useState("");
  const [showSaveModal, setShowSaveModal] = useState(false);

  // At the top of the EnhancedAnalyticsDashboard component:
  const [usersData, setUsersData] = useState(null);
  const [contentData, setContentData] = useState(null);
  const [searchData, setSearchData] = useState(null);
  const [systemData, setSystemData] = useState(null);
  const [integrationsData, setIntegrationsData] = useState(null);
  const [groupsData, setGroupsData] = useState(null);
  const [storageData, setStorageData] = useState(null);
  const [chatActivityData, setChatActivityData] = useState(null);
  const [mcpClicksCount, setMcpClicksCount] = useState(0);

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
    if (!data || !Array.isArray(data) || data.length === 0) {
      return (
        <div className={`chart-placeholder ${className}`} style={{ height }}>
          <p>No data available for chart</p>
        </div>
      );
    }

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

    return (
      <ResponsiveContainer width="100%" height={height} className={className}>
        <ChartComponent data={data}>{children}</ChartComponent>
      </ResponsiveContainer>
    );
  };

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

  // Fetch data for each tab when activeTab or dateRange changes
  useEffect(() => {
    if (activeTab === "users") fetchUsersData().then(setUsersData);
    if (activeTab === "content") fetchContentData().then(setContentData);
    if (activeTab === "search") fetchSearchData().then(setSearchData);
    if (activeTab === "system") fetchSystemData().then(setSystemData);
    if (activeTab === "integrations")
      fetchIntegrationsData().then(setIntegrationsData);
    if (activeTab === "groups") fetchGroupsData().then(setGroupsData);
    if (activeTab === "storage") fetchStorageData().then(setStorageData);
  }, [activeTab, dateRange]);

  // Helper: Fetch count from a table
  const fetchCount = async (table, filter = {}) => {
    try {
      let query = supabase
        .from(table)
        .select("id", { count: "exact", head: true });

      Object.entries(filter).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    } catch (err) {
      console.warn(`Error fetching count from ${table}:`, err);
      return 0;
    }
  };

  // Helper: Fetch time series data
  const fetchTimeSeries = async (table, dateField, start, end, filter = {}) => {
    try {
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
    } catch (err) {
      console.warn(`Error fetching time series from ${table}:`, err);
      return [];
    }
  };

  // TODO: Ensure 'sessions' table has 'is_current', 'last_active', and 'user_id' fields.
  const fetchSessionCount = async (start, end) => {
    const { count, error } = await supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("is_current", true)
      .gte("last_active", start)
      .lte("last_active", end);
    return count || 0;
  };
  const fetchSessionSeries = async (start, end) => {
    const { data, error } = await supabase
      .from("sessions")
      .select("last_active")
      .eq("is_current", true)
      .gte("last_active", start)
      .lte("last_active", end);
    if (error || !data) return [];
    const counts = {};
    data.forEach((row) => {
      const date = row.last_active.split("T")[0];
      counts[date] = (counts[date] || 0) + 1;
    });
    return Object.entries(counts).map(([date, value]) => ({ date, value }));
  };

  // Main function to fetch all dashboard data
  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    if (!dateRange.start || !dateRange.end) {
      setLoading(false);
      return;
    }

    try {
      // Fetch overview data
      const [
        totalUsers,
        totalDocuments,
        totalImages,
        totalIntegrations,
        totalSessions,
      ] = await Promise.all([
        fetchCount("profiles"),
        fetchCount("documents"),
        fetchCount("image_embeddings"),
        // fetchCount("integrations"),
        fetchSessionCount(dateRange.start, dateRange.end),
      ]);

      // Fetch time series data
      const [userSeries, documentSeries, sessionSeries] = await Promise.all([
        fetchTimeSeries(
          "profiles",
          "created_at",
          dateRange.start,
          dateRange.end
        ),
        fetchTimeSeries(
          "documents",
          "created_at",
          dateRange.start,
          dateRange.end
        ),
        fetchSessionSeries(dateRange.start, dateRange.end),
      ]);

      // Fetch analytics events for search data
      let searchEvents = [];
      try {
        const { data, error } = await supabase
          .from("analytics_events")
          .select("data, created_at")
          .eq("event_type", "search")
          .gte("created_at", dateRange.start)
          .lte("created_at", dateRange.end)
          .order("created_at", { ascending: false })
          .limit(100);
        searchEvents = data || [];
      } catch (err) {
        searchEvents = [];
      }

      // Process search data
      const searchTerms = {};
      let totalSearches = 0;

      if (searchEvents) {
        searchEvents.forEach((event) => {
          totalSearches++;
          if (event.data && event.data.query) {
            const term = event.data.query.toLowerCase();
            searchTerms[term] = (searchTerms[term] || 0) + 1;
          }
        });
      }

      const topSearches = Object.entries(searchTerms)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([term, count]) => ({ term, count }));

      // Fetch popular documents
      let popularDocs = [];
      try {
        const { data, error } = await supabase
          .from("documents")
          .select("id, name, metadata, created_at")
          .limit(5);
        popularDocs = data || [];
      } catch (err) {
        popularDocs = [];
      }

      // Fetch recent users
      const { data: recentUsers } = await supabase
        .from("profiles")
        .select("id, email, full_name, created_at")
        .order("created_at", { ascending: false })
        .limit(5);

      // Create combined time series data
      const timeSeriesData = [];
      const dates = new Set([
        ...userSeries.map((d) => d.date),
        ...documentSeries.map((d) => d.date),
        ...sessionSeries.map((d) => d.date),
      ]);

      Array.from(dates)
        .sort()
        .forEach((date) => {
          const userCount = userSeries.find((d) => d.date === date)?.value || 0;
          const docCount =
            documentSeries.find((d) => d.date === date)?.value || 0;
          const sessionCount =
            sessionSeries.find((d) => d.date === date)?.value || 0;

          timeSeriesData.push({
            date,
            users: userCount,
            documents: docCount,
            sessions: sessionCount,
          });
        });

      setDashboardData({
        summary: {
          totalUsers,
          totalDocuments,
          totalImages,
          totalIntegrations,
          totalSessions,
          totalSearches,
        },
        timeSeriesData,
        topSearches,
        popularContent: popularDocs || [],
        recentUsers: recentUsers || [],
      });
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError("Failed to load analytics data.");
      setDashboardData({
        summary: {
          totalUsers: 0,
          totalDocuments: 0,
          totalImages: 0,
          totalIntegrations: 0,
          totalSessions: 0,
          totalSearches: 0,
        },
        timeSeriesData: [],
        topSearches: [],
        popularContent: [],
        recentUsers: [],
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch users data
  const fetchUsersData = async () => {
    if (!dateRange.start || !dateRange.end) return;
    try {
      // Get user counts and growth
      const { data: userGrowthData } = await supabase
        .from("profiles")
        .select("created_at")
        .gte("created_at", dateRange.start)
        .lte("created_at", dateRange.end)
        .order("created_at");

      // Get active sessions
      const { data: activeSessions } = await supabase
        .from("sessions")
        .select("user_id, created_at")
        .gte("created_at", dateRange.start)
        .lte("created_at", dateRange.end);

      // Get login attempts
      const { data: loginAttempts } = await supabase
        .from("login_attempts")
        .select("success, created_at")
        .gte("created_at", dateRange.start)
        .lte("created_at", dateRange.end);

      // Process data
      const usersByDate = {};
      userGrowthData?.forEach((user) => {
        const date = user.created_at.split("T")[0];
        usersByDate[date] = (usersByDate[date] || 0) + 1;
      });

      const userGrowthSeries = Object.entries(usersByDate).map(
        ([date, count]) => ({
          date,
          newUsers: count,
          cumulativeUsers: Object.entries(usersByDate)
            .filter(([d]) => d <= date)
            .reduce((sum, [, c]) => sum + c, 0),
        })
      );

      // Process login data
      const successfulLogins =
        loginAttempts?.filter((attempt) => attempt.success).length || 0;
      const failedLogins =
        loginAttempts?.filter((attempt) => !attempt.success).length || 0;
      const loginSuccessRate =
        loginAttempts?.length > 0
          ? ((successfulLogins / loginAttempts.length) * 100).toFixed(1)
          : 0;

      // Add: totalMessages, activeChannels, newUsersThisPeriod, messagesPerUser
      const { data: messages, error: msgErr } = await supabase
        .from("messages")
        .select("user_id");
      const { data: chatMessages, error: chatMsgErr } = await supabase
        .from("chat_messages")
        .select("user_id");
      const { data: channels, error: chErr } = await supabase
        .from("channels")
        .select("id");
      // Count new users in dateRange
      const { count: newUsersThisPeriod } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .gte("created_at", dateRange.start)
        .lte("created_at", dateRange.end);
      // Aggregate messages per user
      const userMsgCounts = {};
      messages?.forEach((m) => {
        userMsgCounts[m.user_id] = (userMsgCounts[m.user_id] || 0) + 1;
      });
      chatMessages?.forEach((m) => {
        userMsgCounts[m.user_id] = (userMsgCounts[m.user_id] || 0) + 1;
      });

      return {
        summary: {
          totalUsers: await fetchCount("profiles"),
          activeUsers: new Set(activeSessions?.map((s) => s.user_id)).size || 0,
          newUsers: userGrowthData?.length || 0,
          loginSuccessRate,
          successfulLogins,
          failedLogins,
          totalMessages: (messages?.length || 0) + (chatMessages?.length || 0),
          activeChannels: channels?.length || 0,
          newUsersThisPeriod: newUsersThisPeriod || 0,
        },
        userGrowthSeries,
        loginData: [
          { name: "Successful", value: successfulLogins, color: COLORS[2] },
          { name: "Failed", value: failedLogins, color: COLORS[4] },
        ],
        messagesPerUser: userMsgCounts,
      };
    } catch (err) {
      console.error("Error fetching users data:", err);
      return null;
    }
  };

  // Fetch content data
  const fetchContentData = async () => {
    if (!dateRange.start || !dateRange.end) return null;
    try {
      // Get documents in date range
      const { data: docs } = await supabase
        .from("documents")
        .select("id, name, metadata, created_at")
        .gte("created_at", dateRange.start)
        .lte("created_at", dateRange.end)
        .limit(10000);
      // Get images in date range
      const { data: images } = await supabase
        .from("image_embeddings")
        .select("id, metadata, created_at")
        .gte("created_at", dateRange.start)
        .lte("created_at", dateRange.end)
        .limit(10000);
      // Source breakdown for pie chart
      const sourceDistribution = {
        Dropbox: 0,
        Google: 0,
        Zenoti: 0,
        "Image Embeddings": 0,
        Other: 0,
      };
      docs?.forEach((doc) => {
        const meta = doc.metadata || {};
        const path = (meta.path || "").toLowerCase();
        const sourceType = (meta.source_type || "").toLowerCase();
        if (path.includes("dropbox") || sourceType === "dropbox")
          sourceDistribution.Dropbox++;
        else if (path.includes("google") || sourceType === "google")
          sourceDistribution.Google++;
        else if (path.includes("zenoti") || sourceType === "zenoti")
          sourceDistribution.Zenoti++;
        else if (
          path.includes("image_embeddings") ||
          sourceType === "image_embeddings"
        )
          sourceDistribution["Image Embeddings"]++;
        else sourceDistribution.Other++;
      });
      images?.forEach((img) => {
        sourceDistribution["Image Embeddings"]++;
      });
      const contentDistribution = Object.entries(sourceDistribution)
        .filter(([, count]) => count > 0)
        .map(([name, value]) => ({ name, value }));
      // Upload trends by day (count of uploads per day)
      const uploadsByDate = {};
      docs?.forEach((doc) => {
        const date = doc.created_at ? doc.created_at.split("T")[0] : "unknown";
        uploadsByDate[date] = (uploadsByDate[date] || 0) + 1;
      });
      images?.forEach((img) => {
        const date = img.created_at ? img.created_at.split("T")[0] : "unknown";
        uploadsByDate[date] = (uploadsByDate[date] || 0) + 1;
      });
      const uploadTrends = Object.entries(uploadsByDate)
        .sort(([a], [b]) => new Date(a) - new Date(b))
        .map(([date, count]) => ({ date, uploads: count }));
      // File size calculation for docs and images in range
      const allSizes = [
        ...(docs?.map((doc) => Number(doc.metadata?.size) || 0) || []),
        ...(images?.map((img) => Number(img.metadata?.size) || 0) || []),
      ];
      const totalStorage =
        allSizes.reduce((sum, s) => sum + (s || 0), 0) / 1024 / 1024 / 1024;
      const avgFileSize = allSizes.length
        ? allSizes.reduce((sum, s) => sum + (s || 0), 0) /
          allSizes.length /
          1024 /
          1024
        : 0;
      return {
        summary: {
          totalDocuments: docs?.length || 0,
          totalImages: images?.length || 0,
          totalStorage: totalStorage.toFixed(2),
          avgFileSize: avgFileSize.toFixed(2),
        },
        contentDistribution,
        uploadTrends,
        docs: docs || [],
        images: images || [],
      };
    } catch (err) {
      console.error("Error fetching content data:", err);
      return null;
    }
  };

  // Fetch search data
  const fetchSearchData = async () => {
    if (!dateRange.start || !dateRange.end) return null;
    try {
      // Get search events
      const { data: searchEvents } = await supabase
        .from("analytics_events")
        .select("event_data, created_at")
        .eq("event_type", "search")
        .gte("created_at", dateRange.start)
        .lte("created_at", dateRange.end);

      // Process search data
      const searchByDate = {};
      const searchTerms = {};
      let totalSearches = 0;

      searchEvents?.forEach((event) => {
        totalSearches++;
        const date = event.created_at.split("T")[0];
        searchByDate[date] = (searchByDate[date] || 0) + 1;

        if (event.event_data?.query) {
          const term = event.event_data.query.toLowerCase();
          searchTerms[term] = (searchTerms[term] || 0) + 1;
        }
      });

      const searchVolume = Object.entries(searchByDate).map(
        ([date, count]) => ({
          date,
          searches: count,
        })
      );

      const topSearchTerms = Object.entries(searchTerms)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([term, count]) => ({ term, count }));

      return {
        summary: {
          totalSearches,
          uniqueSearches: Object.keys(searchTerms).length,
          avgSearchesPerDay:
            totalSearches / Math.max(1, Object.keys(searchByDate).length),
        },
        searchVolume,
        topSearchTerms,
      };
    } catch (err) {
      console.error("Error fetching search data:", err);
      return null;
    }
  };

  // Fetch system data
  const fetchSystemData = async () => {
    if (!dateRange.start || !dateRange.end) return null;
    try {
      // Get system stats
      const { data: systemStats } = await supabase
        .from("system_stats")
        .select("*")
        .gte("created_at", dateRange.start)
        .lte("created_at", dateRange.end)
        .order("created_at");

      // Get error logs
      const { data: errorLogs } = await supabase
        .from("error_logs")
        .select("*")
        .gte("created_at", dateRange.start)
        .lte("created_at", dateRange.end);

      // Get API key usage
      const apiKeyCount = await fetchCount("api_keys");

      // Process system performance
      const performanceData =
        systemStats?.map((stat) => ({
          date: stat.created_at.split("T")[0],
          cpu_usage: stat.cpu_usage || 0,
          memory_usage: stat.memory_usage || 0,
          disk_usage: stat.disk_usage || 0,
          active_connections: stat.active_connections || 0,
        })) || [];

      // Process errors by type
      const errorsByType = {};
      errorLogs?.forEach((log) => {
        const type = log.error_type || "unknown";
        errorsByType[type] = (errorsByType[type] || 0) + 1;
      });

      const errorDistribution = Object.entries(errorsByType).map(
        ([type, count]) => ({
          name: type,
          value: count,
        })
      );

      // Get daily chat activity
      const { data: chatMsgs } = await supabase
        .from("chat_messages")
        .select("created_at");
      const { data: msgs } = await supabase
        .from("messages")
        .select("created_at");
      const allMsgs = [...(chatMsgs || []), ...(msgs || [])];
      const chatByDate = {};
      allMsgs.forEach((m) => {
        const date = m.created_at.split("T")[0];
        chatByDate[date] = (chatByDate[date] || 0) + 1;
      });
      const chatActivity = Object.entries(chatByDate).map(([date, count]) => ({
        date,
        count,
      }));
      // Deep Research MCP Claude clicks
      const { count: mcpClicks } = await supabase
        .from("analytics_events")
        .select("id", { count: "exact", head: true })
        .eq("event_type", "deep_research_mcp_claude");

      return {
        summary: {
          totalErrors: errorLogs?.length || 0,
          apiKeys: apiKeyCount,
          avgCpuUsage:
            systemStats?.length > 0
              ? (
                  systemStats.reduce(
                    (sum, stat) => sum + (stat.cpu_usage || 0),
                    0
                  ) / systemStats.length
                ).toFixed(1)
              : 0,
          avgMemoryUsage:
            systemStats?.length > 0
              ? (
                  systemStats.reduce(
                    (sum, stat) => sum + (stat.memory_usage || 0),
                    0
                  ) / systemStats.length
                ).toFixed(1)
              : 0,
        },
        performanceData,
        errorDistribution,
        chatActivity,
        mcpClicks: mcpClicks || 0,
      };
    } catch (err) {
      console.error("Error fetching system data:", err);
      return null;
    }
  };

  // Fetch integrations data
  const fetchIntegrationsData = async () => {
    try {
      // Get integrations
      const { data: integrations } = await supabase
        .from("integrations")
        .select("*");

      // Get integration logs
      const { data: logs } = await supabase
        .from("integration_logs")
        .select("*")
        .gte("created_at", dateRange.start)
        .lte("created_at", dateRange.end);

      // Process integration status
      const integrationStatus =
        integrations?.map((integration) => {
          const integrationLogs =
            logs?.filter((log) => log.integration_id === integration.id) || [];
          const lastSync =
            integrationLogs.length > 0
              ? integrationLogs.sort(
                  (a, b) => new Date(b.created_at) - new Date(a.created_at)
                )[0].created_at
              : null;
          const errors = integrationLogs.filter(
            (log) => log.log_level === "ERROR"
          ).length;

          return {
            name: integration.provider || integration.name || "Unknown",
            status: integration.status || "unknown",
            lastSync: lastSync
              ? new Date(lastSync).toLocaleDateString()
              : "Never",
            errors,
            totalLogs: integrationLogs.length,
          };
        }) || [];

      const connectedCount =
        integrations?.filter(
          (i) => i.status === "active" || i.status === "connected"
        ).length || 0;
      const disconnectedCount = (integrations?.length || 0) - connectedCount;

      return {
        summary: {
          totalIntegrations: integrations?.length || 0,
          connected: connectedCount,
          disconnected: disconnectedCount,
          totalLogs: logs?.length || 0,
          errors: logs?.filter((log) => log.log_level === "ERROR").length || 0,
        },
        integrationStatus,
      };
    } catch (err) {
      console.error("Error fetching integrations data:", err);
      return null;
    }
  };

  // Fetch groups and roles data
  const fetchGroupsData = async () => {
    try {
      // Get groups
      const groupCount = await fetchCount("groups");

      // Get group roles
      const { data: groupRoles } = await supabase
        .from("group_roles")
        .select("*");

      // Get role permissions
      const { data: rolePerms } = await supabase
        .from("role_permissions")
        .select("*");

      return {
        summary: {
          totalGroups: groupCount,
          totalRoles: groupRoles?.length || 0,
          totalPermissions: rolePerms?.length || 0,
        },
        groupRoles: groupRoles || [],
        rolePermissions: rolePerms || [],
      };
    } catch (err) {
      console.error("Error fetching groups data:", err);
      return null;
    }
  };

  // Fetch storage data
  const fetchStorageData = async () => {
    try {
      // Get storage stats
      const { data: storageStats } = await supabase
        .from("storage_stats")
        .select("*")
        .order("created_at", { ascending: false });

      // Get storage access grants
      const accessGrantsCount = await fetchCount("storage_access_grants");

      // Get storage permissions
      const permissionsCount = await fetchCount("storage_permissions");

      const latestStats = storageStats?.[0];

      return {
        summary: {
          totalStorage: latestStats?.total_size_gb || 0,
          usedStorage: latestStats?.used_size_gb || 0,
          fileCount: latestStats?.file_count || 0,
          accessGrants: accessGrantsCount,
          permissions: permissionsCount,
        },
        storageHistory: storageStats?.slice(0, 30).reverse() || [],
      };
    } catch (err) {
      console.error("Error fetching storage data:", err);
      return null;
    }
  };

  // Handle refresh button click
  const handleRefresh = async () => {
    await fetchDashboardData();
  };

  // Handle timeframe change
  const handleTimeframeChange = (newTimeframe) => {
    setTimeframe(newTimeframe);
    analyticsUtils.trackButtonClick("change_timeframe", {
      from: timeframe,
      to: newTimeframe,
    });
  };

  // Export dashboard data
  const handleExport = async (format = "csv") => {
    try {
      setLoading(true);

      let exportData = [];
      let filename = `analytics-${activeTab}-${timeframe}`;

      if (dashboardData?.timeSeriesData) {
        exportData = dashboardData.timeSeriesData;
      }

      if (exportData.length === 0) {
        setError("No data available to export");
        return;
      }

      // Convert to CSV
      let csvContent = "";
      if (exportData.length > 0) {
        csvContent += Object.keys(exportData[0]).join(",") + "\n";
        exportData.forEach((item) => {
          csvContent += Object.values(item).join(",") + "\n";
        });
      }

      // Download file
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      analyticsUtils.trackButtonClick("export_analytics", {
        timeframe,
        format,
        activeTab,
      });
    } catch (err) {
      console.error("Error exporting dashboard:", err);
      setError("Failed to export dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  // Handle save dashboard
  const handleSaveDashboard = async () => {
    try {
      if (!dashboardName) return;

      setLoading(true);

      const dashboardConfig = {
        name: dashboardName,
        timeframe,
        active_tab: activeTab,
        date_range: dateRange,
        created_by: currentUser?.id,
        created_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("dashboard_presets")
        .insert([dashboardConfig])
        .select();

      if (error) throw error;

      if (data && data.length > 0) {
        setPresets([
          ...presets,
          {
            id: data[0].id,
            name: data[0].name,
            isDefault: false,
          },
        ]);
        setSelectedPreset(data[0].id);
      }

      setShowSaveModal(false);
      setDashboardName("");

      analyticsUtils.trackButtonClick("save_dashboard", {
        timeframe,
        activeTab,
      });
    } catch (err) {
      console.error("Error saving dashboard:", err);
      setError("Failed to save dashboard.");
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
      case "storage":
        return renderStorageDashboard();
      case "groups":
        return renderGroupsDashboard();
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

          {/* <div className="stat-card sessions-stat">
            <div className="stat-icon">
              <Clock size={24} />
            </div>
            <div className="stat-content">
              <h3>Sessions</h3>
              <div className="stat-value">
                {formatNumber(dashboardData.summary.totalSessions)}
              </div>
            </div>
          </div> */}

          <div className="stat-card mcp-clicks-stat">
            <div className="stat-icon">
              <Monitor size={24} color="#10b981" />
            </div>
            <div className="stat-content">
              <h3>Claude MCP Clicks</h3>
              <div className="stat-value">
                {typeof mcpClicksCount === "number"
                  ? formatNumber(mcpClicksCount)
                  : "—"}
              </div>
            </div>
          </div>
        </div>

        <div className="charts-grid">
          <div className="chart-card large">
            <h3 className="chart-title">Activity Over Time</h3>
            <div className="chart-container">
              <SafeChart data={chatActivityData || []} type="line" height={300}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="chatMessages"
                  stroke="#6366f1"
                  name="Chat Messages"
                />
                <Line
                  type="monotone"
                  dataKey="mcpClicks"
                  stroke="#10b981"
                  name="Claude MCP Clicks"
                />
              </SafeChart>
            </div>
          </div>
          <div className="chart-card">
            <h3 className="chart-title">Content Breakdown</h3>
            <SafeChart
              data={contentData?.contentDistribution || []}
              type="pie"
              height={300}
            >
              <Pie
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={({ name, percent }) =>
                  `${name}: ${(percent * 100).toFixed(0)}%`
                }
                isAnimationActive={true}
              >
                {(contentData?.contentDistribution || []).map((entry, idx) => (
                  <Cell
                    key={`cell-${idx}`}
                    fill={COLORS[idx % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [`${formatNumber(value)}`, name]}
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e2e8f0",
                  borderRadius: "0.375rem",
                  padding: "0.5rem",
                }}
              />
              <Legend />
            </SafeChart>
          </div>
        </div>
        <div className="charts-grid">
          <div className="chart-card">
            <h3 className="chart-title">Popular Content</h3>
            <PopularContentTable />
          </div>
          <div className="chart-card">
            <h3 className="chart-title">Recent Users</h3>
            <div className="recent-users-list improved">
              {dashboardData.recentUsers.map((user, index) => (
                <div key={index} className="recent-user-item improved">
                  <div className="user-avatar improved">
                    {user.full_name?.charAt(0).toUpperCase() ||
                      user.email?.charAt(0).toUpperCase() ||
                      "U"}
                  </div>
                  <div className="user-info improved">
                    <div className="user-name improved">
                      {user.full_name || user.email}
                    </div>
                    <div className="user-email improved">{user.email}</div>
                    <div className="user-joined improved">
                      Joined {new Date(user.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  function PopularContentTable() {
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
      async function fetchDocs() {
        setLoading(true);
        const { data, error } = await supabase
          .from("documents")
          .select("id, name, metadata, created_at")
          .order("created_at", { ascending: false })
          .limit(20);
        setDocs(data || []);
        setLoading(false);
      }
      fetchDocs();
    }, []);
    if (loading) return <div>Loading...</div>;
    // Only show docs with a valid name and type (not 'unknown')
    const filteredDocs = docs.filter((doc) => {
      let type = "unknown";
      if (doc.metadata?.type) {
        type = doc.metadata.type.replace(/^\./, "").toLowerCase();
      } else if (doc.metadata?.name) {
        const match = doc.metadata.name.match(/\.([a-zA-Z0-9]+)$/);
        if (match) type = match[1].toLowerCase();
      }
      const name = doc.metadata?.name || doc.metadata?.path || doc.id;
      return name && type !== "unknown";
    });
    if (!filteredDocs.length) return <div>No popular content found.</div>;
    return (
      <div style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Size</th>
              <th>Path</th>
              <th>Last Modified</th>
            </tr>
          </thead>
          <tbody>
            {filteredDocs.map((doc) => {
              let type = "unknown";
              if (doc.metadata?.type) {
                type = doc.metadata.type.replace(/^\./, "").toLowerCase();
              } else if (doc.metadata?.name) {
                const match = doc.metadata.name.match(/\.([a-zA-Z0-9]+)$/);
                if (match) type = match[1].toLowerCase();
              }
              const name = doc.metadata?.name || doc.metadata?.path || doc.id;
              const size = doc.metadata?.size
                ? `${(Number(doc.metadata.size) / 1024 / 1024).toFixed(2)} MB`
                : "—";
              return (
                <tr key={doc.id}>
                  <td>{name}</td>
                  <td>{type}</td>
                  <td>{size}</td>
                  <td
                    style={{
                      maxWidth: 180,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {doc.metadata?.path || "—"}
                  </td>
                  <td>
                    {doc.metadata?.modified
                      ? new Date(doc.metadata.modified).toLocaleDateString()
                      : doc.created_at
                      ? new Date(doc.created_at).toLocaleDateString()
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // Render users dashboard
  const renderUsersDashboard = () => {
    if (!usersData) {
      return (
        <div className="analytics-loading">
          <Loader className="spinner" size={32} />
          <p>Loading user metrics...</p>
        </div>
      );
    }
    return (
      <div className="analytics-dashboard">
        <div className="stats-summary">
          <div className="stat-card">
            <h3>Total Users</h3>
            <div className="stat-value">
              {formatNumber(usersData.summary.totalUsers)}
            </div>
          </div>
          <div className="stat-card">
            <h3>New Users</h3>
            <div className="stat-value">
              {formatNumber(usersData.summary.newUsersThisPeriod)}
            </div>
          </div>
          <div className="stat-card">
            <h3>Total Messages</h3>
            <div className="stat-value">
              {formatNumber(usersData.summary.totalMessages)}
            </div>
          </div>
          <div className="stat-card">
            <h3>Active Channels</h3>
            <div className="stat-value">
              {formatNumber(usersData.summary.activeChannels)}
            </div>
          </div>
        </div>
        <div className="chart-card large">
          <h3 className="chart-title">Messages Sent Per User</h3>
          <MessagesPerUserChart data={usersData.messagesPerUser} />
        </div>
      </div>
    );
  };

  function MessagesPerUserChart({ data }) {
    const chartData = Object.entries(data || {}).map(([user, count]) => ({
      user,
      count,
    }));
    if (!chartData.length) return <div>No message data.</div>;
    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={chartData}
          margin={{ top: 16, right: 16, left: 16, bottom: 16 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="user" tick={{ fontSize: 12, fill: "#64748b" }} />
          <YAxis tick={{ fontSize: 12, fill: "#64748b" }} />
          <Tooltip />
          <Bar dataKey="count" fill="#4f46e5" />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Render content dashboard
  const renderContentDashboard = () => {
    if (!contentData) {
      return (
        <div className="analytics-loading">
          <Loader className="spinner" size={32} />
          <p>Loading content metrics...</p>
        </div>
      );
    }
    return (
      <div className="analytics-dashboard">
        <div className="stats-summary">
          <div className="stat-card">
            <div className="stat-content">
              <h3>Documents</h3>
              <div className="stat-value">
                {formatNumber(contentData.summary.totalDocuments)}
              </div>
            </div>
          </div>
          <div className="stat-card images-stat">
            <div className="stat-content">
              <h3>Images</h3>
              <div className="stat-value">
                {formatNumber(contentData.summary.totalImages)}
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-content">
              <h3>Total Storage</h3>
              <div className="stat-value">
                {contentData.summary.totalStorage} GB
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-content">
              <h3>Avg File Size</h3>
              <div className="stat-value">
                {contentData.summary.avgFileSize} MB
              </div>
            </div>
          </div>
        </div>
        <div className="charts-grid">
          <div className="chart-card wide">
            <h3 className="chart-title">Upload Trends</h3>
            <SafeChart data={contentData.uploadTrends} type="line" height={300}>
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
                dataKey="uploads"
                name="Uploads"
                stroke={COLORS[0]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
              />
            </SafeChart>
          </div>
          <div className="chart-card wide">
            <h3 className="chart-title">Content Breakdown</h3>
            {contentData.contentDistribution &&
            contentData.contentDistribution.length > 0 ? (
              <SafeChart
                data={contentData.contentDistribution}
                type="pie"
                height={300}
              >
                <Pie
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={({ name, percent }) =>
                    `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                  isAnimationActive={true}
                >
                  {contentData.contentDistribution.map((entry, idx) => (
                    <Cell
                      key={`cell-${idx}`}
                      fill={COLORS[idx % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [`${formatNumber(value)}`, name]}
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "0.375rem",
                    padding: "0.5rem",
                  }}
                />
                <Legend />
              </SafeChart>
            ) : (
              <div
                className="chart-placeholder"
                style={{
                  height: 300,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <img
                  src="/illustrations/no-content.svg"
                  alt="No content"
                  style={{ width: 120, marginBottom: 16, opacity: 0.7 }}
                />
                <p>
                  No data available for chart. Try uploading more files or
                  expanding your date range.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render storage dashboard
  const renderStorageDashboard = () => {
    if (!storageData) {
      return (
        <div className="analytics-loading">
          <Loader className="spinner" size={32} />
          <p>Loading storage metrics...</p>
        </div>
      );
    }

    return (
      <div className="analytics-dashboard">
        <div className="stats-summary">
          <div className="stat-card">
            <div className="stat-icon">
              <Database size={24} />
            </div>
            <div className="stat-content">
              <h3>Total Storage</h3>
              <div className="stat-value">
                {storageData.summary.totalStorage} GB
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">
              <Cloud size={24} />
            </div>
            <div className="stat-content">
              <h3>Used Storage</h3>
              <div className="stat-value">
                {storageData.summary.usedStorage} GB
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">
              <FileText size={24} />
            </div>
            <div className="stat-content">
              <h3>File Count</h3>
              <div className="stat-value">
                {formatNumber(storageData.summary.fileCount)}
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">
              <Shield size={24} />
            </div>
            <div className="stat-content">
              <h3>Access Grants</h3>
              <div className="stat-value">
                {formatNumber(storageData.summary.accessGrants)}
              </div>
            </div>
          </div>
        </div>

        <div className="chart-card large">
          <h3 className="chart-title">Storage Usage History</h3>
          <div className="chart-container">
            <SafeChart
              data={storageData.storageHistory}
              type="line"
              height={300}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="created_at"
                tick={{ fontSize: 12, fill: "#64748b" }}
                tickFormatter={(date) => new Date(date).toLocaleDateString()}
              />
              <YAxis tick={{ fontSize: 12, fill: "#64748b" }} />
              <Tooltip
                labelFormatter={(date) => new Date(date).toLocaleDateString()}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="total_size_gb"
                name="Total Storage (GB)"
                stroke={COLORS[0]}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="used_size_gb"
                name="Used Storage (GB)"
                stroke={COLORS[1]}
                strokeWidth={2}
              />
            </SafeChart>
          </div>
        </div>

        <div className="chart-card">
          <h3 className="chart-title">Largest Files in Storage</h3>
          <LargestFilesTable />
        </div>
      </div>
    );
  };

  function LargestFilesTable() {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
      async function fetchFiles() {
        setLoading(true);
        const { data, error } = await supabase
          .from("documents")
          .select("id, name, metadata, created_at")
          .limit(10);
        setFiles(data || []);
        setLoading(false);
      }
      fetchFiles();
    }, []);
    if (loading) return <div>Loading...</div>;
    if (!files.length) return <div>No files found.</div>;
    return (
      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Size</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => {
            let type = "unknown";
            if (file.metadata?.type) {
              type = file.metadata.type.replace(/^\./, "").toLowerCase();
            } else if (file.metadata?.name) {
              const match = file.metadata.name.match(/\.([a-zA-Z0-9]+)$/);
              if (match) type = match[1].toLowerCase();
            }
            const size = file.metadata?.size
              ? `${(Number(file.metadata.size) / 1024 / 1024).toFixed(2)} MB`
              : "—";
            return (
              <tr key={file.id}>
                <td>{file.name}</td>
                <td>{type}</td>
                <td>{size}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  // Fetch chat activity data
  const fetchChatActivityData = async () => {
    if (!dateRange.start || !dateRange.end) return;
    try {
      // Fetch chat messages per day
      const { data: chatMessages } = await supabase
        .from("chat_messages")
        .select("id, created_at")
        .gte("created_at", dateRange.start)
        .lte("created_at", dateRange.end)
        .limit(10000);

      // Fetch messages from 'messages' table as well
      const { data: messages } = await supabase
        .from("messages")
        .select("id, created_at")
        .gte("created_at", dateRange.start)
        .lte("created_at", dateRange.end)
        .limit(10000);

      // Fetch Claude MCP click events
      const { data: mcpEvents } = await supabase
        .from("analytics_events")
        .select("id, created_at")
        .eq("event_type", "deep_research_mcp_claude")
        .gte("created_at", dateRange.start)
        .lte("created_at", dateRange.end)
        .limit(10000);

      // Group by day
      const groupByDay = (items) => {
        const counts = {};
        items.forEach((item) => {
          const day = item.created_at.split("T")[0];
          counts[day] = (counts[day] || 0) + 1;
        });
        return counts;
      };
      const chatCounts = groupByDay([
        ...(chatMessages || []),
        ...(messages || []),
      ]);
      const mcpCounts = groupByDay(mcpEvents || []);

      // Build chart data
      const days = Object.keys({ ...chatCounts, ...mcpCounts }).sort();
      const chartData = days.map((day) => ({
        date: day,
        chatMessages: chatCounts[day] || 0,
        mcpClicks: mcpCounts[day] || 0,
      }));

      setChatActivityData(chartData);
    } catch (err) {
      setChatActivityData([]);
    }
  };

  // In useEffect or wherever data is loaded, call fetchChatActivityData when dateRange changes
  useEffect(() => {
    if (activeTab === "system" || activeTab === "overview") {
      fetchChatActivityData();
    }
  }, [dateRange, activeTab]);

  // In fetchSystemData or fetchOverviewData, fetch total Claude MCP clicks
  const fetchMcpClicksCount = async () => {
    if (!dateRange.start || !dateRange.end) return;
    const { count } = await supabase
      .from("analytics_events")
      .select("id", { count: "exact" })
      .eq("event_type", "deep_research_mcp_claude")
      .gte("created_at", dateRange.start)
      .lte("created_at", dateRange.end);
    setMcpClicksCount(count || 0);
  };

  // In useEffect or wherever data is loaded, call fetchMcpClicksCount when dateRange changes
  useEffect(() => {
    fetchMcpClicksCount();
  }, [dateRange]);

  // Ensure renderGroupsDashboard is defined
  const renderGroupsDashboard = () => {
    return (
      <div className="analytics-loading">
        <Loader className="spinner" size={32} />
        <p>Loading groups metrics...</p>
      </div>
    );
  };

  if (loading && !dashboardData) {
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
              {/* <select
                value={selectedPreset}
                onChange={(e) => setSelectedPreset(e.target.value)}
                className="preset-select"
              >
                {presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select> */}

              {/* <button
                className="save-button"
                onClick={() => setShowSaveModal(true)}
              >
                <Save size={16} />
                <span>Save</span>
              </button> */}
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
                className="refresh-button"
                onClick={handleRefresh}
                disabled={loading}
              >
                <RefreshCw
                  size={16}
                  style={{ marginBottom: "0", color: "white" }}
                  className={loading ? "spinning" : ""}
                />
              </button>

              <button
                className="export-button"
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
            className={activeTab === "storage" ? "active" : ""}
            onClick={() => setActiveTab("storage")}
          >
            <Database size={16} />
            <span>Storage</span>
          </button>
        </div>

        {/* Dashboard content */}
        <div className="dashboard-main">{renderDashboard()}</div>
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
