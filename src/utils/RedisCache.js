// src/utils/RedisCache.js
import { supabase } from "../lib/supabase";

/**
 * Redis Cache utility for document caching
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
};

// Document-specific cache helpers
export const DocumentCache = {
  async getDocument(id) {
    return RedisCache.getOrSet(
      `doc:${id}:data`,
      async () => {
        const { data } = await supabase
          .from("documents")
          .select("*")
          .eq("id", id)
          .single();

        return data;
      },
      1800 // 30 minutes
    );
  },

  invalidateDocument(id) {
    return RedisCache.delete(`doc:${id}:data`);
  },
};

export default RedisCache;
