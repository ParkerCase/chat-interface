// src/utils/RedisCache.js
import { supabase } from "../lib/supabase";

/**
 * Helper function to store in localStorage with TTL
 * @param {string} key - The cache key
 * @param {any} value - The value to store
 * @param {number} expiry - Expiry time in seconds
 */
const localStorageSet = (key, value, expiry) => {
  const item = {
    value,
    expiry: Date.now() + expiry * 1000,
  };
  localStorage.setItem(`cache:${key}`, JSON.stringify(item));
};

/**
 * Helper function to get from localStorage with TTL check
 * @param {string} key - The cache key
 * @returns {any} - The stored value or null if expired/not found
 */
const localStorageGet = (key) => {
  const item = localStorage.getItem(`cache:${key}`);
  if (!item) return null;

  try {
    const parsed = JSON.parse(item);
    if (parsed.expiry && Date.now() > parsed.expiry) {
      localStorage.removeItem(`cache:${key}`);
      return null;
    }
    return parsed.value;
  } catch (e) {
    return null;
  }
};

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
      // Always fallback to localStorage since redis_set does not exist
      localStorageSet(key, value, expiry);
      return true;
    } catch (error) {
      console.warn("Redis cache set error:", error);
      localStorageSet(key, value, expiry);
      return true;
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

      if (error) {
        // Fallback to localStorage if Redis function fails
        return localStorageGet(key);
      }

      if (data) {
        try {
          return JSON.parse(data);
        } catch (e) {
          // If not valid JSON, return as-is
          return data;
        }
      }

      // If not in Redis, try localStorage
      return localStorageGet(key);
    } catch (error) {
      console.warn("Redis cache get error:", error);
      // Fallback to localStorage
      return localStorageGet(key);
    }
  },

  /**
   * Delete a value from Redis cache
   * @param {string} key - The cache key to delete
   */
  async delete(key) {
    try {
      const { error } = await supabase.rpc("redis_del", { key });

      // Always also remove from localStorage as a cleanup
      localStorage.removeItem(`cache:${key}`);

      if (error) {
        return true; // Already removed from localStorage
      }
      return true;
    } catch (error) {
      console.warn("Redis cache delete error:", error);
      // At least remove from localStorage
      localStorage.removeItem(`cache:${key}`);
      return true;
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

      if (error) {
        // Fallback: try to match localStorage keys with this pattern
        const results = {};
        const regex = new RegExp(`^cache:${pattern.replace(/\*/g, ".*")}$`);

        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith("cache:") && regex.test(key)) {
            const actualKey = key.substring(6); // Remove 'cache:' prefix
            const value = localStorageGet(actualKey);
            if (value !== null) {
              results[actualKey] = value;
            }
          }
        }

        return results;
      }

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
      console.warn("Redis pattern search error:", error);
      // Fallback: try to match localStorage keys
      const results = {};
      const regex = new RegExp(`^cache:${pattern.replace(/\*/g, ".*")}$`);

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("cache:") && regex.test(key)) {
          const actualKey = key.substring(6); // Remove 'cache:' prefix
          const value = localStorageGet(actualKey);
          if (value !== null) {
            results[actualKey] = value;
          }
        }
      }

      return results;
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

      // Also try to delete from localStorage
      let localCount = 0;
      const regex = new RegExp(`^cache:${pattern.replace(/\*/g, ".*")}$`);

      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key?.startsWith("cache:") && regex.test(key)) {
          localStorage.removeItem(key);
          localCount++;
        }
      }

      if (error) {
        return localCount;
      }

      return (data || 0) + localCount;
    } catch (error) {
      console.warn("Redis pattern delete error:", error);

      // Fallback: Delete matching keys from localStorage
      let count = 0;
      const regex = new RegExp(`^cache:${pattern.replace(/\*/g, ".*")}$`);

      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key?.startsWith("cache:") && regex.test(key)) {
          localStorage.removeItem(key);
          count++;
        }
      }

      return count;
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

      if (error) {
        // Fallback: implement counter in localStorage
        const current = localStorageGet(key) || 0;
        const newValue = current + increment;
        localStorageSet(key, newValue, 86400); // 24h expiry for counters
        return newValue;
      }

      return data || 0;
    } catch (error) {
      console.warn("Redis increment error:", error);

      // Fallback: implement counter in localStorage
      const current = localStorageGet(key) || 0;
      const newValue = current + increment;
      localStorageSet(key, newValue, 86400); // 24h expiry for counters
      return newValue;
    }
  },
};

// The rest of your cache implementations can remain unchanged
// since they call the base RedisCache methods that now have fallbacks

// Document-specific cache helpers
export const DocumentCache = {
  // Your existing implementation
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

  // Rest of your DocumentCache implementation...
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
  // Your existing implementation
  async cacheDashboardData(dashboardId = "default", data, ttl = 300) {
    return RedisCache.set(`analytics:dashboard:${dashboardId}`, data, ttl);
  },

  async getDashboardData(dashboardId = "default") {
    return RedisCache.get(`analytics:dashboard:${dashboardId}`);
  },

  async cacheUserMetrics(timeframe, data) {
    return RedisCache.set(`analytics:users:${timeframe}`, data, 900); // 15 minutes
  },

  async getUserMetrics(timeframe) {
    return RedisCache.get(`analytics:users:${timeframe}`);
  },
};

// Chat and Search cache helpers
export const ChatCache = {
  // Your existing implementation
  async cacheThreadMessages(threadId, messages) {
    return RedisCache.set(`chat:thread:${threadId}:messages`, messages, 300); // 5 minutes
  },

  async getThreadMessages(threadId) {
    return RedisCache.get(`chat:thread:${threadId}:messages`);
  },

  async cacheSearchResults(query, results) {
    // Hash the query to create a safe key
    const queryHash = btoa(query).replace(/[^a-zA-Z0-9]/g, "");
    return RedisCache.set(`chat:search:${queryHash}`, results, 600); // 10 minutes
  },

  async getSearchResults(query) {
    const queryHash = btoa(query).replace(/[^a-zA-Z0-9]/g, "");
    return RedisCache.get(`chat:search:${queryHash}`);
  },
};

export default RedisCache;
