// src/utils/SupabaseAnalyticsIntegration.js
import { supabase } from "../lib/supabase";

/**
 * Utility functions to integrate with Supabase Analytics tables
 * This provides a consistent interface for analytics operations
 */
export const SupabaseAnalytics = {
  /**
   * Track an event
   * @param {string} eventType - Type of event
   * @param {Object} eventData - Event data
   * @param {string} userId - User ID (optional)
   * @returns {Promise<Object>} Result
   */
  trackEvent: async (eventType, eventData = {}, userId = null) => {
    try {
      // Use current user ID if not provided
      if (!userId) {
        const { data } = await supabase.auth.getUser();
        userId = data?.user?.id;
      }

      const event = {
        event_type: eventType,
        user_id: userId,
        data: eventData,
        created_at: new Date().toISOString(),
        session_id: localStorage.getItem("sessionId") || null,
        url: window.location.href,
        user_agent: navigator.userAgent,
      };

      const { data, error } = await supabase
        .from("analytics_events")
        .insert([event]);

      if (error) {
        console.warn("Error tracking event:", error);
        // Still return success - analytics shouldn't break the app
        return { success: false, error };
      }

      return { success: true, data };
    } catch (error) {
      console.warn("Error tracking analytics event:", error);
      // Return success anyway - analytics shouldn't break the app
      return { success: false, error };
    }
  },

  /**
   * Get analytics for a specific time period
   * @param {string} timeframe - Timeframe (day, week, month, year)
   * @param {string} userId - User ID (optional)
   * @returns {Promise<Object>} Analytics data
   */
  getDashboard: async (timeframe = "week", userId = null) => {
    try {
      // Calculate date range based on timeframe
      const endDate = new Date();
      let startDate = new Date();

      switch (timeframe) {
        case "day":
          startDate.setDate(endDate.getDate() - 1);
          break;
        case "week":
          startDate.setDate(endDate.getDate() - 7);
          break;
        case "month":
          startDate.setMonth(endDate.getMonth() - 1);
          break;
        case "year":
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
        default:
          startDate.setDate(endDate.getDate() - 7);
      }

      // Convert to ISO strings for query
      const startDateStr = startDate.toISOString();
      const endDateStr = endDate.toISOString();

      // Build query for events in the date range
      let query = supabase
        .from("analytics_events")
        .select("*")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr);

      // Add user filter if provided
      if (userId) {
        query = query.eq("user_id", userId);
      }

      // Execute query
      const { data, error } = await query;

      if (error) {
        throw error;
      }

      // Process the data to create a dashboard
      return processDashboardData(data, timeframe);
    } catch (error) {
      console.error("Error getting analytics dashboard:", error);
      throw error;
    }
  },

  /**
   * Get user activity
   * @param {string} userId - User ID
   * @param {string} timeframe - Timeframe (day, week, month, year)
   * @returns {Promise<Object>} User activity data
   */
  getUserActivity: async (userId, timeframe = "week") => {
    try {
      if (!userId) {
        throw new Error("User ID is required");
      }

      // Get dashboard data filtered by user
      return await SupabaseAnalytics.getDashboard(timeframe, userId);
    } catch (error) {
      console.error("Error getting user activity:", error);
      throw error;
    }
  },

  /**
   * Get system metrics
   * @returns {Promise<Object>} System metrics
   */
  getSystemMetrics: async () => {
    try {
      // This would typically come from a system_metrics table
      // For now, we'll just return dummy data

      // In a real implementation, you might query a server-side function
      // or a table with aggregated metrics

      return {
        success: true,
        metrics: {
          cpu: Math.round(Math.random() * 50) + 10,
          memory: Math.round(Math.random() * 60) + 20,
          storage: Math.round(Math.random() * 40) + 30,
          requests: Math.round(Math.random() * 1000) + 100,
          errors: Math.round(Math.random() * 20),
          avgResponseTime: (Math.random() * 0.5 + 0.1).toFixed(2),
        },
      };
    } catch (error) {
      console.error("Error getting system metrics:", error);
      throw error;
    }
  },

  /**
   * Get search analytics
   * @param {Object} options - Filter options
   * @returns {Promise<Object>} Search analytics
   */
  getSearchAnalytics: async (options = {}) => {
    try {
      // Build query for search events
      let query = supabase
        .from("analytics_events")
        .select("*")
        .eq("event_type", "search");

      // Add date filters if provided
      if (options.startDate) {
        query = query.gte("created_at", options.startDate);
      }

      if (options.endDate) {
        query = query.lte("created_at", options.endDate);
      }

      // Add user filter if provided
      if (options.userId) {
        query = query.eq("user_id", options.userId);
      }

      // Add search type filter if provided
      if (options.searchType) {
        query = query.eq("data->type", options.searchType);
      }

      // Add limit if provided
      if (options.limit) {
        query = query.limit(options.limit);
      }

      // Execute query
      const { data, error } = await query;

      if (error) {
        throw error;
      }

      // Process the search data
      return processSearchAnalytics(data);
    } catch (error) {
      console.error("Error getting search analytics:", error);
      throw error;
    }
  },

  /**
   * Get content analytics
   * @param {Object} options - Filter options
   * @returns {Promise<Object>} Content analytics
   */
  getContentAnalytics: async (options = {}) => {
    try {
      // Build query for content events (views, downloads, etc.)
      let query = supabase
        .from("analytics_events")
        .select("*")
        .in("event_type", [
          "content_view",
          "content_download",
          "content_share",
        ]);

      // Add date filters if provided
      if (options.startDate) {
        query = query.gte("created_at", options.startDate);
      }

      if (options.endDate) {
        query = query.lte("created_at", options.endDate);
      }

      // Add filters for content type or ID if provided
      if (options.contentType) {
        query = query.eq("data->content_type", options.contentType);
      }

      if (options.contentId) {
        query = query.eq("data->content_id", options.contentId);
      }

      // Execute query
      const { data, error } = await query;

      if (error) {
        throw error;
      }

      // Process the content data
      return processContentAnalytics(data);
    } catch (error) {
      console.error("Error getting content analytics:", error);
      throw error;
    }
  },

  /**
   * Get realtime stats
   * Ideally this would use Supabase Realtime, but we'll simulate it for now
   * @returns {Promise<Object>} Realtime stats
   */
  getRealtimeStats: async () => {
    try {
      // In a real implementation, this would query a table with current stats
      // or use Supabase Realtime features

      // For now, return dummy data
      return {
        activeUsers: Math.floor(Math.random() * 50) + 10,
        queries: Math.floor(Math.random() * 100) + 50,
        errorRate: (Math.random() * 2).toFixed(2),
        avgResponseTime: (Math.random() * 0.5 + 0.1).toFixed(2),
      };
    } catch (error) {
      console.error("Error getting realtime stats:", error);
      throw error;
    }
  },
};

// Helper function to process dashboard data
function processDashboardData(events, timeframe) {
  // Count various events
  const totalUsers = new Set(events.map((e) => e.user_id)).size;
  const searches = events.filter((e) => e.event_type === "search").length;
  const pageViews = events.filter((e) => e.event_type === "page_view").length;
  const uploads = events.filter((e) => e.event_type === "file_upload").length;
  const downloads = events.filter(
    (e) => e.event_type === "file_download"
  ).length;

  // Group events by date
  const eventsByDate = {};
  events.forEach((event) => {
    const date = event.created_at.split("T")[0]; // Get YYYY-MM-DD
    if (!eventsByDate[date]) {
      eventsByDate[date] = {
        date,
        users: new Set(),
        searches: 0,
        pageViews: 0,
        uploads: 0,
        downloads: 0,
      };
    }

    eventsByDate[date].users.add(event.user_id);

    if (event.event_type === "search") eventsByDate[date].searches++;
    if (event.event_type === "page_view") eventsByDate[date].pageViews++;
    if (event.event_type === "file_upload") eventsByDate[date].uploads++;
    if (event.event_type === "file_download") eventsByDate[date].downloads++;
  });

  // Convert to array and handle Set objects
  const timeSeriesData = Object.values(eventsByDate).map((day) => ({
    date: day.date,
    users: day.users.size,
    searches: day.searches,
    pageViews: day.pageViews,
    uploads: day.uploads,
    downloads: day.downloads,
  }));

  // Sort by date
  timeSeriesData.sort((a, b) => a.date.localeCompare(b.date));

  // Get top search queries
  const searchQueries = {};
  events
    .filter((e) => e.event_type === "search" && e.data?.query)
    .forEach((e) => {
      const query = e.data.query;
      searchQueries[query] = (searchQueries[query] || 0) + 1;
    });

  // Convert to array and sort
  const topSearches = Object.entries(searchQueries)
    .map(([query, count]) => ({ query, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Return processed dashboard data
  return {
    summary: {
      totalUsers,
      activeUsers: totalUsers, // This would need more logic in a real implementation
      totalSearches: searches,
      pageViews,
      uploads,
      downloads,
    },
    timeSeriesData,
    topSearches,
    // Additional data would be included in a real implementation
  };
}

// Helper function to process search analytics
function processSearchAnalytics(events) {
  // Count total searches
  const totalSearches = events.length;

  // Count unique users
  const uniqueUsers = new Set(events.map((e) => e.user_id)).size;

  // Group searches by query
  const searchesByQuery = {};
  events.forEach((event) => {
    const query = event.data?.query || "unknown";
    if (!searchesByQuery[query]) {
      searchesByQuery[query] = 0;
    }
    searchesByQuery[query]++;
  });

  // Convert to array and sort
  const topSearches = Object.entries(searchesByQuery)
    .map(([query, count]) => ({ query, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // Group searches by date
  const searchesByDate = {};
  events.forEach((event) => {
    const date = event.created_at.split("T")[0]; // Get YYYY-MM-DD
    if (!searchesByDate[date]) {
      searchesByDate[date] = {
        date,
        searches: 0,
        uniqueUsers: new Set(),
      };
    }

    searchesByDate[date].searches++;
    searchesByDate[date].uniqueUsers.add(event.user_id);
  });

  // Convert to array and handle Set objects
  const searchVolume = Object.values(searchesByDate).map((day) => ({
    date: day.date,
    searches: day.searches,
    uniqueUsers: day.uniqueUsers.size,
  }));

  // Sort by date
  searchVolume.sort((a, b) => a.date.localeCompare(b.date));

  // Calculate zero result rate
  const zeroResultSearches = events.filter(
    (e) => e.data?.resultCount === 0
  ).length;
  const zeroResultRate =
    totalSearches > 0 ? (zeroResultSearches / totalSearches) * 100 : 0;

  // Return processed search analytics
  return {
    summary: {
      totalSearches,
      uniqueSearchers: uniqueUsers,
      avgSearchesPerUser: uniqueUsers > 0 ? totalSearches / uniqueUsers : 0,
      zeroResultRate: zeroResultRate.toFixed(1),
    },
    topSearches,
    searchVolume,
    // More detailed data would be included in a real implementation
  };
}

// Helper function to process content analytics
function processContentAnalytics(events) {
  // Count events by type
  const views = events.filter((e) => e.event_type === "content_view").length;
  const downloads = events.filter(
    (e) => e.event_type === "content_download"
  ).length;
  const shares = events.filter((e) => e.event_type === "content_share").length;

  // Group by content
  const contentStats = {};
  events.forEach((event) => {
    const contentId = event.data?.content_id || "unknown";
    const contentName = event.data?.content_name || "Unknown";
    const contentType = event.data?.content_type || "unknown";

    if (!contentStats[contentId]) {
      contentStats[contentId] = {
        id: contentId,
        name: contentName,
        type: contentType,
        views: 0,
        downloads: 0,
        shares: 0,
      };
    }

    if (event.event_type === "content_view") contentStats[contentId].views++;
    if (event.event_type === "content_download")
      contentStats[contentId].downloads++;
    if (event.event_type === "content_share") contentStats[contentId].shares++;
  });

  // Convert to array and sort by views
  const popularContent = Object.values(contentStats)
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  // Return processed content analytics
  return {
    summary: {
      totalViews: views,
      totalDownloads: downloads,
      totalShares: shares,
    },
    popularContent,
    // More detailed data would be included in a real implementation
  };
}

export default SupabaseAnalytics;
