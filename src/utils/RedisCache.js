// src/utils/RedisCache.js
import { supabase } from "../lib/supabase";

/**
 * Redis Cache utility for intelligent caching
 */
export const RedisCache = {
  /**
   * Set a value in Redis cache
   * @param {string} key - The cache key
   * @param {any} value - Value to cache (will be JSON stringified)
   * @param {number} expiry - Expiration time in seconds (default: 1 hour)
   */
  async set(key, value, expiry = 3600) {
    try {
      const { data, error } = await supabase.rpc("redis_set", {
        key,
        value: typeof value === "string" ? value : JSON.stringify(value),
        expiry,
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Redis cache set error:", error);
      return null;
    }
  },

  /**
   * Get a value from Redis cache
   * @param {string} key - The cache key
   * @returns {Promise<any>} The cached value or null
   */
  async get(key) {
    try {
      const { data, error } = await supabase.rpc("redis_get", { key });

      if (error) throw error;

      if (data) {
        try {
          return JSON.parse(data);
        } catch (e) {
          // If not valid JSON, return as-is
          return data;
        }
      }

      return null;
    } catch (error) {
      console.error("Redis cache get error:", error);
      return null;
    }
  },

  /**
   * Delete a value from Redis cache
   * @param {string} key - The cache key to delete
   */
  async delete(key) {
    try {
      const { error } = await supabase.rpc("redis_del", { key });
      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Redis cache delete error:", error);
      return false;
    }
  },

  /**
   * Get or set a value in Redis cache
   * @param {string} key - The cache key
   * @param {Function} fetchFn - Function that returns the value if not in cache
   * @param {number} expiry - Expiration time in seconds
   */
  async getOrSet(key, fetchFn, expiry = 3600) {
    const cachedValue = await this.get(key);

    if (cachedValue !== null) {
      return cachedValue;
    }

    const freshValue = await fetchFn();

    if (freshValue !== null && freshValue !== undefined) {
      await this.set(key, freshValue, expiry);
    }

    return freshValue;
  },

  /**
   * Get multiple values by pattern
   * @param {string} pattern - Key pattern to match (e.g., "user:*:profile")
   * @returns {Promise<Object>} - Object with keys and values
   */
  async getByPattern(pattern) {
    try {
      const { data, error } = await supabase.rpc("redis_keys", { pattern });

      if (error) throw error;

      if (!data || !Array.isArray(data) || data.length === 0) {
        return {};
      }

      const results = {};

      // Process in batches of 10 to avoid overwhelming the RPC endpoint
      for (let i = 0; i < data.length; i += 10) {
        const batch = data.slice(i, i + 10);
        const promises = batch.map(async (key) => {
          const value = await this.get(key);
          if (value !== null) {
            results[key] = value;
          }
        });

        await Promise.all(promises);
      }

      return results;
    } catch (error) {
      console.error("Redis pattern search error:", error);
      return {};
    }
  },

  /**
   * Delete multiple keys by pattern
   * @param {string} pattern - Key pattern to match (e.g., "user:*:profile")
   * @returns {Promise<number>} - Number of keys deleted
   */
  async deleteByPattern(pattern) {
    try {
      const { data, error } = await supabase.rpc("redis_del_pattern", {
        pattern,
      });

      if (error) throw error;
      return data || 0;
    } catch (error) {
      console.error("Redis pattern delete error:", error);
      return 0;
    }
  },

  /**
   * Increment a counter in Redis
   * @param {string} key - The counter key
   * @param {number} increment - Amount to increment by
   * @returns {Promise<number>} - New counter value
   */
  async increment(key, increment = 1) {
    try {
      const { data, error } = await supabase.rpc("redis_incr", {
        key,
        increment_by: increment,
      });

      if (error) throw error;
      return data || 0;
    } catch (error) {
      console.error("Redis increment error:", error);
      return 0;
    }
  },
};

// Document-specific cache helpers
export const DocumentCache = {
  /**
   * Get document by ID with intelligent caching
   * @param {string} id - Document ID
   * @param {Object} options - Options like forceFresh
   * @returns {Promise<Object>} - Document data
   */
  async getDocument(id, options = {}) {
    const cacheKey = `doc:${id}:data`;

    // Force fresh fetch if needed
    if (options.forceFresh) {
      await RedisCache.delete(cacheKey);
    }

    // Determine appropriate TTL based on document activity
    const ttl = options.ttl || (await this._getDocumentTTL(id));

    return RedisCache.getOrSet(
      cacheKey,
      async () => {
        const { data } = await supabase
          .from("documents")
          .select("*")
          .eq("id", id)
          .single();

        return data;
      },
      ttl
    );
  },

  /**
   * Get documents by folder with caching
   * @param {string} folderId - Folder ID
   * @returns {Promise<Array>} - Documents in folder
   */
  async getDocumentsByFolder(folderId) {
    const cacheKey = `folder:${folderId}:docs`;

    return RedisCache.getOrSet(
      cacheKey,
      async () => {
        const { data } = await supabase
          .from("documents")
          .select("*")
          .eq("folder_id", folderId);

        return data || [];
      },
      900 // 15 minutes
    );
  },

  /**
   * Get document permissions with caching
   * @param {string} id - Document ID
   * @returns {Promise<Object>} - Permission data
   */
  async getDocumentPermissions(id) {
    const cacheKey = `doc:${id}:permissions`;

    return RedisCache.getOrSet(
      cacheKey,
      async () => {
        const { data } = await supabase
          .from("document_permissions")
          .select("*")
          .eq("document_id", id);

        return data || [];
      },
      300 // 5 minutes - shorter TTL for security-related data
    );
  },

  /**
   * Invalidate document cache
   * @param {string} id - Document ID
   * @returns {Promise<boolean>} Success flag
   */
  async invalidateDocument(id) {
    try {
      // Delete main document cache
      await RedisCache.delete(`doc:${id}:data`);

      // Delete permissions cache
      await RedisCache.delete(`doc:${id}:permissions`);

      // Delete from folder listings
      const { data: doc } = await supabase
        .from("documents")
        .select("folder_id")
        .eq("id", id)
        .single();

      if (doc?.folder_id) {
        await RedisCache.delete(`folder:${doc.folder_id}:docs`);
      }

      return true;
    } catch (error) {
      console.error("Error invalidating document cache:", error);
      return false;
    }
  },

  /**
   * Determine intelligent TTL based on document activity
   * @private
   * @param {string} id - Document ID
   * @returns {Promise<number>} TTL in seconds
   */
  async _getDocumentTTL(id) {
    try {
      // Get last access information
      const { data } = await supabase
        .from("document_access_logs")
        .select("created_at")
        .eq("document_id", id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!data || data.length === 0) {
        return 1800; // Default 30 minutes
      }

      const lastAccess = new Date(data[0].created_at);
      const now = new Date();
      const hoursSinceAccess = (now - lastAccess) / (1000 * 60 * 60);

      // Recently accessed documents get shorter TTL because they'll likely be accessed again
      if (hoursSinceAccess < 1) {
        return 3600; // 1 hour
      } else if (hoursSinceAccess < 24) {
        return 7200; // 2 hours
      } else {
        return 86400; // 24 hours for rarely accessed docs
      }
    } catch (error) {
      console.warn("Error determining document TTL:", error);
      return 1800; // Default 30 minutes on error
    }
  },
};

// Analytics cache helpers
export const AnalyticsCache = {
  /**
   * Cache analytics dashboard data
   * @param {string} dashboardId - Dashboard ID or 'default'
   * @param {Object} data - Dashboard data
   * @param {number} ttl - Cache TTL in seconds
   */
  async cacheDashboardData(dashboardId = "default", data, ttl = 300) {
    return RedisCache.set(`analytics:dashboard:${dashboardId}`, data, ttl);
  },

  /**
   * Get cached dashboard data
   * @param {string} dashboardId - Dashboard ID or 'default'
   * @returns {Promise<Object>} Dashboard data
   */
  async getDashboardData(dashboardId = "default") {
    return RedisCache.get(`analytics:dashboard:${dashboardId}`);
  },

  /**
   * Cache user metrics data
   * @param {string} timeframe - Time period (day, week, month)
   * @param {Object} data - Metrics data
   */
  async cacheUserMetrics(timeframe, data) {
    return RedisCache.set(`analytics:users:${timeframe}`, data, 900); // 15 minutes
  },

  /**
   * Get cached user metrics
   * @param {string} timeframe - Time period
   */
  async getUserMetrics(timeframe) {
    return RedisCache.get(`analytics:users:${timeframe}`);
  },
};

// Chat and Search cache helpers
export const ChatCache = {
  /**
   * Cache chat thread messages
   * @param {string} threadId - Thread ID
   * @param {Array} messages - Thread messages
   */
  async cacheThreadMessages(threadId, messages) {
    return RedisCache.set(`chat:thread:${threadId}:messages`, messages, 300); // 5 minutes
  },

  /**
   * Get cached thread messages
   * @param {string} threadId - Thread ID
   */
  async getThreadMessages(threadId) {
    return RedisCache.get(`chat:thread:${threadId}:messages`);
  },

  /**
   * Cache search results
   * @param {string} query - Search query hash
   * @param {Object} results - Search results
   */
  async cacheSearchResults(query, results) {
    // Hash the query to create a safe key
    const queryHash = btoa(query).replace(/[^a-zA-Z0-9]/g, "");
    return RedisCache.set(`chat:search:${queryHash}`, results, 600); // 10 minutes
  },

  /**
   * Get cached search results
   * @param {string} query - Search query
   */
  async getSearchResults(query) {
    const queryHash = btoa(query).replace(/[^a-zA-Z0-9]/g, "");
    return RedisCache.get(`chat:search:${queryHash}`);
  },
};

export default RedisCache;
