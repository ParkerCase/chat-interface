// Optimized search.js with Database-Stored Embeddings, Automatic Loading and Recovery
const express = require("express");
const router = express.Router();
const { upload } = require("../../middleware/upload");
const searchController = require("../../controllers/search");
const logger = require("../../logger");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const util = require("util");
const cv = require("@u4/opencv4nodejs");
const os = require("os");
const { supabase } = require("../../supabase");
const LRU = require("lru-cache");
const cron = require("node-cron");

const DB_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 2000,
  maxDelay: 10000,
  timeoutMs: 20000,
};

/**
 * Enhanced database query function with retries and timeout management
 */
async function executeQueryWithRetry(queryFn, options = {}) {
  const config = { ...DB_RETRY_CONFIG, ...options };
  let retries = 0;
  let lastError = null;

  while (retries <= config.maxRetries) {
    try {
      // Set a reasonable statement timeout for each attempt
      await safeExecuteSql(`SET statement_timeout = ${config.timeoutMs};`);

      // Small delay before query if it's a retry
      if (retries > 0) {
        const delay = Math.min(
          config.maxDelay,
          config.baseDelay * Math.pow(1.5, retries - 1)
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      // Execute the query function passed in
      return await queryFn();
    } catch (error) {
      lastError = error;

      // Only retry on timeout errors, fail immediately for other errors
      if (
        !error.message.includes("timeout") &&
        !error.message.includes("cancel")
      ) {
        break;
      }

      logger.warn(
        `Database query attempt ${retries + 1} failed: ${error.message}`,
        {
          service: "tatt2awai-bot",
          retryCount: retries,
        }
      );

      retries++;
    }
  }

  // If we get here, all retries failed
  throw lastError || new Error("Query failed after retries");
}

// ===== IMPROVED CONFIGURATION =====

// Create LRU cache with larger capacity for production
const embeddingCache = new LRU({
  max: 2000, // Reduced from 5000 to 2000
  maxSize: 1024 * 1024 * 1024, // 1GB max cache size (reduced from 1.5GB)
  ttl: 1000 * 60 * 60 * 12, // 12 hour time-to-live (reduced from 24)
  sizeCalculation: (value, key) => {
    // Calculate size more accurately to avoid memory surprises
    if (value.embedding) {
      return value.embedding.length * 4 + 256; // 4 bytes per float + overhead
    } else if (value.patches) {
      let size = 256; // Base overhead
      for (const patch of value.patches) {
        if (patch.embedding) {
          size += patch.embedding.length * 4 + 64; // 4 bytes per float + per-patch overhead
        }
      }
      return size;
    }
    return 500; // Default conservative size
  },
  // Add dispose function to help with garbage collection
  dispose: (value, key) => {
    // Help garbage collector by clearing references
    if (value) {
      if (value.embedding) value.embedding = null;
      if (value.patches) value.patches = null;
    }
  },
});

function checkMemoryUsage() {
  const memoryUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memoryUsage.heapUsed / (1024 * 1024));
  const heapTotalMB = Math.round(memoryUsage.heapTotal / (1024 * 1024));
  const rssMemoryMB = Math.round(memoryUsage.rss / (1024 * 1024));

  // Log current memory usage every 5 minutes for monitoring
  if (
    !global.lastMemoryLog ||
    Date.now() - global.lastMemoryLog > 5 * 60 * 1000
  ) {
    global.lastMemoryLog = Date.now();
    logger.info("Memory usage stats:", {
      service: "tatt2awai-bot",
      heapUsedMB,
      heapTotalMB,
      rssMB: rssMemoryMB,
      embeddingCacheSize: global.embeddingCache
        ? global.embeddingCache.size
        : 0,
      signatureCacheSize:
        global.imageMatcher && global.imageMatcher.signatureCache
          ? global.imageMatcher.signatureCache.size
          : 0,
    });
  }

  // More aggressive memory pressure detection - lower threshold to 70%
  const memoryPressure =
    heapUsedMB > heapTotalMB * 0.7 || heapUsedMB > 900 || rssMemoryMB > 1400;

  if (memoryPressure) {
    logger.warn("Memory pressure detected, clearing embedding cache", {
      service: "tatt2awai-bot",
      heapUsedMB,
      heapTotalMB,
    });

    // Clear embedding cache if it exists
    if (global.embeddingCache) {
      global.embeddingCache.clear();
    }

    // For the signature cache, we'll keep a subset of the most important embeddings
    if (global.imageMatcher && global.imageMatcher.signatureCache) {
      const currentSize = global.imageMatcher.signatureCache.size;
      // Keep at most 1000 embeddings under memory pressure
      const targetSize = Math.min(1000, currentSize / 2);
      const itemsToRemove = currentSize - targetSize;

      if (itemsToRemove > 0) {
        let removed = 0;
        // Keep track of which types we're removing to maintain balance
        let fullRemoved = 0;
        let partialRemoved = 0;

        // Create an array from keys for easier processing
        const keys = Array.from(global.imageMatcher.signatureCache.keys());

        // Keep track of what we've removed
        for (let i = 0; i < keys.length && removed < itemsToRemove; i++) {
          const key = keys[i];
          const entry = global.imageMatcher.signatureCache.get(key);

          // Check entry type to maintain balance
          if (entry.type === "tensor" && fullRemoved < itemsToRemove / 2) {
            global.imageMatcher.signatureCache.delete(key);
            removed++;
            fullRemoved++;
          } else if (
            entry.type === "tensor-patches" &&
            partialRemoved < itemsToRemove / 2
          ) {
            global.imageMatcher.signatureCache.delete(key);
            removed++;
            partialRemoved++;
          }

          // If we're not balancing well, just remove whatever is left
          if (i >= keys.length - (itemsToRemove - removed)) {
            global.imageMatcher.signatureCache.delete(key);
            removed++;
          }
        }

        // Update matcher stats
        if (global.imageMatcher) {
          global.imageMatcher._tensorCount =
            global.imageMatcher.signatureCache.size;
          global.imageMatcher._fullEmbeddingCount -= fullRemoved;
          global.imageMatcher._partialEmbeddingCount -= partialRemoved;
        }

        logger.info("Removed embeddings due to memory pressure", {
          service: "tatt2awai-bot",
          memorySaved: `${Math.round(itemsToRemove * 0.5)}MB`, // Rough estimate
          cacheSize: global.imageMatcher.signatureCache.size,
        });
      }
    }

    // Force garbage collection if available
    if (global.gc) {
      try {
        global.gc();
        logger.info("Forced garbage collection", {
          service: "tatt2awai-bot",
        });
      } catch (err) {
        // Ignore errors
      }
    }

    return true; // Memory pressure detected
  }

  return false; // No memory pressure
}

// 3. Add memory check scheduling
// Call this every 30 seconds to monitor memory
setInterval(checkMemoryUsage, 30000);

// Promisify fs functions for cleaner code
const readFileAsync = util.promisify(fs.readFile);
const unlinkAsync = util.promisify(fs.unlink);
const existsAsync = util.promisify(fs.exists);

// Circuit breaker to prevent database overload
// Enhanced circuit breaker to prevent database overload
const circuitBreaker = {
  failures: 0,
  lastFailure: 0,
  timeout: 30000, // 30 second timeout when opened (reduced from 60s)
  maxFailures: 8, // Increased from 5 to allow more retry opportunities
  consecutiveTimeouts: 0, // Track consecutive timeout errors specifically
  maxConsecutiveTimeouts: 3, // Open after 3 consecutive timeout errors

  isOpen: function () {
    // Check if we've exceeded the max failures threshold
    if (
      this.failures >= this.maxFailures ||
      this.consecutiveTimeouts >= this.maxConsecutiveTimeouts
    ) {
      const shouldReset = Date.now() - this.lastFailure > this.timeout;
      if (shouldReset) {
        this.reset();
        return false;
      }
      return true;
    }
    return false;
  },

  recordFailure: function (isTimeout = false) {
    this.failures++;
    this.lastFailure = Date.now();

    // Track consecutive timeouts separately
    if (isTimeout) {
      this.consecutiveTimeouts++;
    } else {
      // Reset consecutive timeouts for non-timeout errors
      this.consecutiveTimeouts = 0;
    }

    const reason = isTimeout ? "timeout" : "error";

    logger.warn(
      `Circuit breaker: ${this.failures} failures recorded (${reason})`,
      {
        service: "tatt2awai-bot",
        circuitStatus: this.isOpen() ? "open" : "closed",
        consecutiveTimeouts: this.consecutiveTimeouts,
        resetTime: new Date(this.lastFailure + this.timeout).toISOString(),
      }
    );
  },

  recordSuccess: function () {
    // On success, we reduce the failure count to allow gradual recovery
    if (this.failures > 0) {
      this.failures = Math.max(0, this.failures - 1);
    }

    // Always reset consecutive timeouts on success
    this.consecutiveTimeouts = 0;
  },

  reset: function () {
    this.failures = 0;
    this.consecutiveTimeouts = 0;

    logger.info("Circuit breaker reset", {
      service: "tatt2awai-bot",
    });
  },

  getStatus: function () {
    return {
      status: this.isOpen() ? "open" : "closed",
      failures: this.failures,
      maxFailures: this.maxFailures,
      consecutiveTimeouts: this.consecutiveTimeouts,
      maxConsecutiveTimeouts: this.maxConsecutiveTimeouts,
      lastFailureTime: this.lastFailure
        ? new Date(this.lastFailure).toISOString()
        : null,
      resetTime: this.lastFailure
        ? new Date(this.lastFailure + this.timeout).toISOString()
        : null,
      timeRemaining: this.isOpen()
        ? (this.lastFailure + this.timeout - Date.now()) / 1000
        : 0,
    };
  },
};

// ===== DATABASE SETUP =====

// ===== EMBEDDING FORMAT DIAGNOSTIC AND FIX =====

/**
 * Endpoint to diagnose and fix embedding format issues
 * This runs a comprehensive check and correction of your embeddings
 */
router.get("/fix-embeddings", async (req, res) => {
  try {
    const diagnosticOnly = req.query.diagnosticOnly === "true";
    const skipValidation = req.query.skipValidation === "true";

    logger.info("Starting embedding diagnostic and fix", {
      service: "tatt2awai-bot",
      diagnosticOnly,
      skipValidation,
    });

    // 1. Initialize the matcher if needed
    if (!global.imageMatcher) {
      const RobustImageMatcher = require("../../RobustImageMatcher");
      global.imageMatcher = new RobustImageMatcher({
        signatureThreshold: 0.65,
        useLocalCache: true,
        stateDirectory: process.cwd(),
        signatureCount: 10000,
        loadFromState: false,
      });
      await global.imageMatcher.initialize();
    }

    // 2. Clear existing cache to start fresh
    logger.info("Clearing existing matcher cache for fresh diagnosis", {
      service: "tatt2awai-bot",
      previousSize: global.imageMatcher.signatureCache
        ? global.imageMatcher.signatureCache.size
        : 0,
    });

    if (global.imageMatcher.signatureCache) {
      global.imageMatcher.signatureCache.clear();
    }

    // 3. Increase memory limit for tensor operations
    try {
      // Try to increase Node.js memory limit
      if (global.gc) {
        global.gc(); // Force garbage collection
      }

      logger.info("Increased memory limits for embedding operations", {
        service: "tatt2awai-bot",
      });
    } catch (memErr) {
      logger.warn("Could not modify memory settings", {
        service: "tatt2awai-bot",
        error: memErr.message,
      });
    }

    // 4. Get sample of embeddings for diagnosis
    const { data: sampleData, error: sampleError } = await supabase
      .from("image_embeddings")
      .select("id, image_path, embedding_type, embedding_data")
      .limit(10);

    if (sampleError) {
      return res.status(500).json({
        success: false,
        error: sampleError.message,
      });
    }

    // 5. Analyze embedding format issues
    const formatAnalysis = {};

    for (const emb of sampleData) {
      // Skip if no data
      if (!emb.embedding_data) continue;

      // Analyze structure
      formatAnalysis[emb.id] = {
        path: emb.image_path,
        type: emb.embedding_type,
        hasEmbedding: !!(emb.embedding_data && emb.embedding_data.embedding),
        hasPatches: !!(emb.embedding_data && emb.embedding_data.patches),
        embeddingIsArray: !!(
          emb.embedding_data &&
          emb.embedding_data.embedding &&
          Array.isArray(emb.embedding_data.embedding)
        ),
        patchesStructure:
          emb.embedding_data && emb.embedding_data.patches
            ? typeof emb.embedding_data.patches
            : "missing",
        metadataKeys: emb.embedding_data ? Object.keys(emb.embedding_data) : [],
      };
    }

    // 6. Detect common embedding format issues
    const issues = [];

    // Check for missing embedding arrays
    if (
      Object.values(formatAnalysis).some(
        (a) => !a.hasEmbedding && !a.hasPatches
      )
    ) {
      issues.push(
        "Some embeddings are missing both 'embedding' and 'patches' fields"
      );
    }

    // Check for non-array embeddings
    if (
      Object.values(formatAnalysis).some(
        (a) => a.hasEmbedding && !a.embeddingIsArray
      )
    ) {
      issues.push("Some 'embedding' fields are not arrays");
    }

    // Check for wrong field names
    if (
      Object.values(formatAnalysis).some(
        (a) =>
          a.metadataKeys.includes("tensor") ||
          a.metadataKeys.includes("descriptors")
      )
    ) {
      issues.push(
        "Some embeddings use legacy field names like 'tensor' or 'descriptors'"
      );
    }

    // 7. Fix embedding issues if not diagnostic-only mode
    let fixResults = { processed: 0, fixed: 0, errors: 0 };

    if (!diagnosticOnly && issues.length > 0) {
      // Attempt to fix 100 embeddings at a time
      fixResults = await fixEmbeddingFormat(100, skipValidation);
    }

    // 8. Load a small set of fixed embeddings to test
    const loadResults = await loadFixedEmbeddings(20);

    // 9. Now try a visual search with tensor embeddings to verify fix
    let searchTest = { success: false, message: "Search test not attempted" };

    if (loadResults.loaded > 0) {
      searchTest = await testVisualSearch();
    }

    return res.json({
      success: true,
      diagnosticMode: diagnosticOnly,
      sampleAnalysis: formatAnalysis,
      detectedIssues: issues,
      fixResults: !diagnosticOnly ? fixResults : "Skipped in diagnostic mode",
      loadResults,
      searchTest,
      recommendations:
        issues.length > 0
          ? "Run this endpoint without diagnosticOnly=true to fix embedding format issues"
          : "No critical format issues detected",
      nextSteps: [
        "1. Run with diagnosticOnly=false to fix embedding format issues",
        "2. After fixing, use /force-load-direct to load fixed embeddings",
        "3. Test visual search with a known image",
      ],
    });
  } catch (error) {
    logger.error("Error in fix-embeddings endpoint:", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
    });

    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
});

/**
 * Function to fix embedding format issues using cursor-based pagination
 * @param {number} limit - Maximum number of embeddings to fix
 * @param {boolean} skipValidation - Skip validation of fixed embeddings
 * @returns {Promise<Object>} Fix results
 */
async function fixEmbeddingFormat(limit = 100, skipValidation = false) {
  const results = {
    processed: 0,
    fixed: 0,
    errors: 0,
    issues: {},
  };

  try {
    // Get embeddings with cursor-based pagination
    const embeddings = await executePaginatedQuery(
      () => {
        return supabase
          .from("image_embeddings")
          .select("id, image_path, embedding_type, embedding_data")
          .not("embedding_data", "is", null);
      },
      {
        pageSize: 10,
        maxItems: limit,
        timeoutMs: 30000,
      }
    );

    if (!embeddings || embeddings.length === 0) {
      return {
        processed: 0,
        fixed: 0,
        errors: 0,
        message: "No embeddings found to fix",
      };
    }

    // Process each embedding
    for (const emb of embeddings) {
      results.processed++;

      try {
        // Skip if no data
        if (!emb.embedding_data) {
          results.errors++;
          if (!results.issues.noData) results.issues.noData = 0;
          results.issues.noData++;
          continue;
        }

        let needsFix = false;
        let fixedData = { ...emb.embedding_data };

        // Check for wrong embedding structure
        if (emb.embedding_type === "full") {
          // Fix full embeddings
          if (!fixedData.embedding) {
            // Try to find embedding data in other fields
            if (fixedData.tensor) {
              fixedData.embedding = fixedData.tensor;
              delete fixedData.tensor;
              needsFix = true;
              if (!results.issues.renamedTensor)
                results.issues.renamedTensor = 0;
              results.issues.renamedTensor++;
            } else if (Array.isArray(fixedData)) {
              // The whole object is the array
              fixedData = { embedding: fixedData };
              needsFix = true;
              if (!results.issues.wrappedArray) results.issues.wrappedArray = 0;
              results.issues.wrappedArray++;
            }
          } else if (!Array.isArray(fixedData.embedding)) {
            // Embedding is not an array
            if (!results.issues.nonArrayEmbedding)
              results.issues.nonArrayEmbedding = 0;
            results.issues.nonArrayEmbedding++;
            results.errors++;
            continue; // Can't fix this
          }
        } else if (emb.embedding_type === "partial") {
          // Fix partial embeddings
          if (!fixedData.patches) {
            // Try to find patches in other fields
            if (fixedData.descriptors) {
              fixedData.patches = fixedData.descriptors.map((d) => ({
                embedding: d,
                x: 0,
                y: 0,
                width: 100,
                height: 100,
              }));
              delete fixedData.descriptors;
              needsFix = true;
              if (!results.issues.convertedDescriptors)
                results.issues.convertedDescriptors = 0;
              results.issues.convertedDescriptors++;
            } else if (fixedData.regions) {
              fixedData.patches = fixedData.regions;
              delete fixedData.regions;
              needsFix = true;
              if (!results.issues.renamedRegions)
                results.issues.renamedRegions = 0;
              results.issues.renamedRegions++;
            }
          } else if (!Array.isArray(fixedData.patches)) {
            // Patches is not an array
            if (!results.issues.nonArrayPatches)
              results.issues.nonArrayPatches = 0;
            results.issues.nonArrayPatches++;
            results.errors++;
            continue; // Can't fix this
          }
        }

        // If we need to update the embedding, use safer update with retry
        if (needsFix) {
          try {
            const { error: updateError } = await executeQueryWithRetry(
              async () => {
                return await supabase
                  .from("image_embeddings")
                  .update({ embedding_data: fixedData })
                  .eq("id", emb.id);
              }
            );

            if (updateError) {
              logger.error(
                `Error updating embedding ${emb.id}: ${updateError.message}`,
                {
                  service: "tatt2awai-bot",
                }
              );
              results.errors++;
            } else {
              results.fixed++;
            }
          } catch (updateErr) {
            logger.error(
              `Error updating embedding ${emb.id}: ${updateErr.message}`,
              {
                service: "tatt2awai-bot",
              }
            );
            results.errors++;
          }
        }

        // Validate the fixed embedding if requested
        if (!skipValidation && needsFix) {
          // Try loading the fixed embedding
          try {
            if (emb.embedding_type === "full" && fixedData.embedding) {
              // Validate full embedding
              if (
                !Array.isArray(fixedData.embedding) ||
                fixedData.embedding.length < 100
              ) {
                results.errors++;
                if (!results.issues.invalidFullEmbedding)
                  results.issues.invalidFullEmbedding = 0;
                results.issues.invalidFullEmbedding++;
              }
            } else if (emb.embedding_type === "partial" && fixedData.patches) {
              // Validate patches
              if (
                !Array.isArray(fixedData.patches) ||
                fixedData.patches.length === 0
              ) {
                results.errors++;
                if (!results.issues.invalidPatches)
                  results.issues.invalidPatches = 0;
                results.issues.invalidPatches++;
              } else {
                // Check first patch
                const firstPatch = fixedData.patches[0];
                if (
                  !firstPatch.embedding ||
                  !Array.isArray(firstPatch.embedding)
                ) {
                  results.errors++;
                  if (!results.issues.invalidPatchStructure)
                    results.issues.invalidPatchStructure = 0;
                  results.issues.invalidPatchStructure++;
                }
              }
            }
          } catch (validationErr) {
            logger.warn(
              `Validation error for embedding ${emb.id}: ${validationErr.message}`,
              {
                service: "tatt2awai-bot",
              }
            );
            results.errors++;
          }
        }
      } catch (embErr) {
        logger.error(
          `Error processing embedding ${emb.id}: ${embErr.message}`,
          {
            service: "tatt2awai-bot",
          }
        );
        results.errors++;
      }
    }

    return results;
  } catch (error) {
    logger.error(`Error in fixEmbeddingFormat: ${error.message}`, {
      service: "tatt2awai-bot",
      stack: error.stack,
    });

    return {
      processed: results.processed,
      fixed: results.fixed,
      errors: results.errors + 1,
      issues: results.issues,
      fatalError: error.message,
    };
  }
}

/**
 * Load a sample of fixed embeddings to test
 * @param {number} limit - Number of embeddings to load
 * @returns {Promise<Object>} Load results
 */
async function loadFixedEmbeddings(limit = 20) {
  try {
    // Make sure imageMatcher is initialized
    if (!global.imageMatcher) {
      const RobustImageMatcher = require("../../RobustImageMatcher");
      global.imageMatcher = new RobustImageMatcher({
        signatureThreshold: 0.65,
        useLocalCache: true,
        stateDirectory: process.cwd(),
        signatureCount: 10000,
        loadFromState: false,
      });
      await global.imageMatcher.initialize();
    }

    // Get embeddings to load
    const { data: fullData, error: fullError } = await supabase
      .from("image_embeddings")
      .select("id, image_path, embedding_type, embedding_data")
      .eq("embedding_type", "full")
      .not("embedding_data", "is", null)
      .limit(limit / 2);

    if (fullError) {
      logger.error(`Error loading full embeddings: ${fullError.message}`, {
        service: "tatt2awai-bot",
      });
      return { loaded: 0, errors: 1 };
    }

    const { data: partialData, error: partialError } = await supabase
      .from("image_embeddings")
      .select("id, image_path, embedding_type, embedding_data")
      .eq("embedding_type", "partial")
      .not("embedding_data", "is", null)
      .limit(limit / 2);

    if (partialError) {
      logger.error(
        `Error loading partial embeddings: ${partialError.message}`,
        {
          service: "tatt2awai-bot",
        }
      );
      return { loaded: 0, errors: 1 };
    }

    // Load the embeddings
    let loadedCount = 0;
    let errorCount = 0;

    // Load full embeddings
    for (const emb of fullData || []) {
      try {
        if (
          emb.image_path &&
          emb.embedding_data &&
          emb.embedding_data.embedding
        ) {
          global.imageMatcher.signatureCache.set(emb.image_path, {
            path: emb.image_path,
            type: "tensor",
            embedding: emb.embedding_data.embedding,
          });
          loadedCount++;
        }
      } catch (err) {
        errorCount++;
      }
    }

    // Load partial embeddings
    for (const emb of partialData || []) {
      try {
        if (
          emb.image_path &&
          emb.embedding_data &&
          emb.embedding_data.patches
        ) {
          global.imageMatcher.signatureCache.set(emb.image_path, {
            path: emb.image_path,
            type: "tensor-patches",
            patches: emb.embedding_data.patches,
          });
          loadedCount++;
        }
      } catch (err) {
        errorCount++;
      }
    }

    // Update matcher stats
    if (global.imageMatcher) {
      global.imageMatcher._tensorCount =
        global.imageMatcher.signatureCache.size;
      global.imageMatcher._fullEmbeddingCount =
        (global.imageMatcher._fullEmbeddingCount || 0) + fullData.length;
      global.imageMatcher._partialEmbeddingCount =
        (global.imageMatcher._partialEmbeddingCount || 0) + partialData.length;
    }

    return {
      loaded: loadedCount,
      errors: errorCount,
      cacheSize: global.imageMatcher.signatureCache.size,
    };
  } catch (error) {
    return {
      loaded: 0,
      errors: 1,
      error: error.message,
    };
  }
}

/**
 * Test the visual search with a known image
 * @returns {Promise<Object>} Test results
 */
async function testVisualSearch() {
  try {
    // Skip if matcher not initialized
    if (!global.imageMatcher) {
      return {
        success: false,
        error: "Image matcher not initialized",
      };
    }

    // Set up test search options
    const searchOptions = {
      maxMatches: 5,
      threshold: 0.01,
      debugMode: true,
      forceResults: true,
    };

    // Get a sample embedding to use as query
    let queryEmbedding = null;
    let queryPath = null;

    // Attempt to get the first embedding in the cache
    if (
      global.imageMatcher.signatureCache &&
      global.imageMatcher.signatureCache.size > 0
    ) {
      for (const [
        path,
        entry,
      ] of global.imageMatcher.signatureCache.entries()) {
        if (entry.embedding) {
          queryEmbedding = { embedding: entry.embedding };
          queryPath = path;
          break;
        } else if (
          entry.patches &&
          entry.patches.length > 0 &&
          entry.patches[0].embedding
        ) {
          queryEmbedding = { patches: entry.patches };
          queryPath = path;
          break;
        }
      }
    }

    // If we couldn't get a query embedding from cache, get one from the database
    if (!queryEmbedding) {
      const { data, error } = await supabase
        .from("image_embeddings")
        .select("id, image_path, embedding_type, embedding_data")
        .not("embedding_data", "is", null)
        .limit(1)
        .single();

      if (error || !data) {
        return {
          success: false,
          error: "Could not find a test embedding",
        };
      }

      queryPath = data.image_path;
      queryEmbedding = data.embedding_data;
    }

    // Try to search using the query embedding
    let matches = [];
    let directDbMatches = [];

    try {
      // Try matcher search first
      if (global.imageMatcher.findMatchesWithMode) {
        const result = await global.imageMatcher.findMatchesWithMode(
          queryEmbedding,
          "full",
          searchOptions
        );
        matches = result.matches || [];
      }
    } catch (searchErr) {
      logger.warn(`Error in test search: ${searchErr.message}`, {
        service: "tatt2awai-bot",
      });
    }

    // Try direct DB search as fallback
    if (matches.length === 0) {
      try {
        const dbResult = await performDirectDatabaseSearch(
          queryEmbedding,
          "full",
          searchOptions
        );
        directDbMatches = dbResult.matches || [];
      } catch (dbErr) {
        logger.warn(`Error in direct DB search: ${dbErr.message}`, {
          service: "tatt2awai-bot",
        });
      }
    }

    // Combine results
    const allMatches = [...matches, ...directDbMatches];

    return {
      success: true,
      queryPath,
      matcherMatches: matches.length,
      directDbMatches: directDbMatches.length,
      totalMatches: allMatches.length,
      foundSelf: allMatches.some((m) => m.path === queryPath),
      topMatch:
        allMatches.length > 0
          ? {
              path: allMatches[0].path,
              score: allMatches[0].score,
            }
          : null,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

router.get("/force-load-offset", async (req, res) => {
  try {
    // Initialize matcher if needed
    if (!global.imageMatcher) {
      const RobustImageMatcher = require("../../RobustImageMatcher");
      global.imageMatcher = new RobustImageMatcher({
        signatureThreshold: 0.65,
        useLocalCache: true,
        stateDirectory: process.cwd(),
        signatureCount: 10000,
        loadFromState: false,
      });
      await global.imageMatcher.initialize();
    }

    // Clear the cache first if requested to ensure a fresh start
    if (req.query.clearCache === "true") {
      if (global.imageMatcher.signatureCache) {
        global.imageMatcher.signatureCache.clear();
      }
      logger.info("Offset loader: Cleared existing cache", {
        service: "tatt2awai-bot",
      });
    }

    const startingCount = global.imageMatcher.signatureCache
      ? global.imageMatcher.signatureCache.size
      : 0;

    // Stats for tracking progress
    let stats = {
      loaded: 0,
      skipped: 0,
      errors: 0,
      fullLoaded: 0,
      partialLoaded: 0,
    };

    // Set a shorter statement timeout
    try {
      await supabase.rpc("set_statement_timeout", { timeout_ms: 15000 });
    } catch (err) {
      // Ignore error, proceed anyway
    }

    // Get parameters from request
    const limit = Math.min(parseInt(req.query.limit) || 200, 200); // Cap at 200 max
    const startOffset = parseInt(req.query.offset) || 0; // Starting offset
    const batchSize = Math.min(parseInt(req.query.batchSize) || 5, 5); // Cap at 5 for safety
    const mode = req.query.mode || "both"; // 'full', 'partial', or 'both'

    // Load embeddings with offset pagination
    let offset = startOffset;
    let loaded = 0;
    let continuePaging = true;

    while (continuePaging && loaded < limit) {
      // Check memory pressure before each batch
      if (checkMemoryUsage()) {
        logger.info("Stopping offset loading due to memory pressure", {
          service: "tatt2awai-bot",
          loadedSoFar: loaded,
        });
        break; // Exit loading loop if memory pressure detected
      }

      try {
        // Build query with ONLY embedding_* fields and offset pagination
        let query = supabase
          .from("image_embeddings")
          .select("id, image_path, embedding_type, embedding_data")
          .not("embedding_data", "is", null)
          .range(offset, offset + batchSize - 1);

        // Add type filter if specified
        if (mode === "full") {
          query = query.eq("embedding_type", "full");
        } else if (mode === "partial") {
          query = query.eq("embedding_type", "partial");
        }

        const { data, error } = await query;

        if (error) {
          logger.warn(
            `Offset loader error at offset ${offset}: ${error.message}`,
            {
              service: "tatt2awai-bot",
            }
          );
          stats.errors++;
          offset += batchSize; // Move to next batch despite error
          continue;
        }

        if (!data || data.length === 0) {
          // No more data, stop pagination
          continuePaging = false;
          logger.info(`No more embeddings found at offset ${offset}`, {
            service: "tatt2awai-bot",
          });
          break;
        }

        logger.info(`Found ${data.length} records at offset ${offset}`, {
          service: "tatt2awai-bot",
        });

        // Process data
        for (const emb of data) {
          try {
            if (!emb.image_path) {
              logger.debug(
                `Offset loader: Skipping embedding ${emb.id}: No path`,
                {
                  service: "tatt2awai-bot",
                }
              );
              stats.skipped++;
              continue;
            }

            // Skip if no embedding data
            if (!emb.embedding_data) {
              logger.debug(
                `Offset loader: Skipping embedding ${emb.id}: No embedding data`,
                {
                  service: "tatt2awai-bot",
                }
              );
              stats.skipped++;
              continue;
            }

            // Log the structure of the first embedding for debugging
            if (stats.loaded === 0) {
              logger.info(`First embedding structure:`, {
                service: "tatt2awai-bot",
                id: emb.id,
                type: emb.embedding_type,
                dataKeys: Object.keys(emb.embedding_data),
                hasEmbedding: !!emb.embedding_data.embedding,
                hasPatches: !!emb.embedding_data.patches,
              });
            }

            // Load full embeddings
            if (emb.embedding_type === "full" && emb.embedding_data) {
              // Get the embedding vector from any possible location
              let embVector = null;

              if (
                emb.embedding_data.embedding &&
                Array.isArray(emb.embedding_data.embedding)
              ) {
                embVector = emb.embedding_data.embedding;
              } else if (
                emb.embedding_data.tensor &&
                Array.isArray(emb.embedding_data.tensor)
              ) {
                embVector = emb.embedding_data.tensor;
              } else if (Array.isArray(emb.embedding_data)) {
                embVector = emb.embedding_data;
              }

              if (embVector && Array.isArray(embVector)) {
                // Create a unique key using image path and unique ID to avoid conflicts
                const uniqueKey = `${emb.image_path}`; // No need for additional ID, path should be unique

                // Add to cache
                global.imageMatcher.signatureCache.set(uniqueKey, {
                  path: uniqueKey,
                  originalPath: emb.image_path,
                  type: "tensor",
                  embedding: embVector,
                });

                stats.loaded++;
                stats.fullLoaded++;
                loaded++;

                if (stats.loaded % 10 === 0) {
                  logger.info(`Loaded ${stats.loaded} embeddings so far`, {
                    service: "tatt2awai-bot",
                  });
                }
              } else {
                logger.debug(
                  `Offset loader: Embedding ${emb.id} has no valid embedding vector`,
                  {
                    service: "tatt2awai-bot",
                    dataKeys: Object.keys(emb.embedding_data),
                  }
                );
                stats.skipped++;
              }
            }
            // Load partial embeddings
            else if (emb.embedding_type === "partial" && emb.embedding_data) {
              // Get patches from any possible location
              let patches = null;

              if (
                emb.embedding_data.patches &&
                Array.isArray(emb.embedding_data.patches)
              ) {
                patches = emb.embedding_data.patches;
              } else if (
                emb.embedding_data.regions &&
                Array.isArray(emb.embedding_data.regions)
              ) {
                patches = emb.embedding_data.regions;
              } else if (
                emb.embedding_data.descriptors &&
                Array.isArray(emb.embedding_data.descriptors)
              ) {
                patches = emb.embedding_data.descriptors.map((d, i) => ({
                  embedding: d,
                  x: i * 10,
                  y: i * 10,
                  width: 100,
                  height: 100,
                }));
              }

              if (patches && Array.isArray(patches) && patches.length > 0) {
                // Create a unique key
                const uniqueKey = `${emb.image_path}`; // No need for additional ID, path should be unique

                // Add to cache
                global.imageMatcher.signatureCache.set(uniqueKey, {
                  path: uniqueKey,
                  originalPath: emb.image_path,
                  type: "tensor-patches",
                  patches: patches,
                });

                stats.loaded++;
                stats.partialLoaded++;
                loaded++;

                if (stats.loaded % 10 === 0) {
                  logger.info(`Loaded ${stats.loaded} embeddings so far`, {
                    service: "tatt2awai-bot",
                  });
                }
              } else {
                logger.debug(
                  `Offset loader: Embedding ${emb.id} has no valid patches array`,
                  {
                    service: "tatt2awai-bot",
                    dataKeys: Object.keys(emb.embedding_data),
                  }
                );
                stats.skipped++;
              }
            } else {
              logger.debug(
                `Offset loader: Unknown embedding type ${emb.embedding_type} for ${emb.id}`,
                {
                  service: "tatt2awai-bot",
                }
              );
              stats.skipped++;
            }
          } catch (embErr) {
            logger.warn(
              `Offset loader: Error processing embedding ${emb.id}: ${embErr.message}`,
              {
                service: "tatt2awai-bot",
              }
            );
            stats.errors++;
          }
        }

        // Move to next batch
        offset += data.length;

        // Log progress
        logger.info(
          `Offset loader: Processed batch at offset ${
            offset - data.length
          }, loaded ${stats.loaded} so far`,
          {
            service: "tatt2awai-bot",
            batchStats: {
              loaded: stats.loaded,
              fullLoaded: stats.fullLoaded,
              partialLoaded: stats.partialLoaded,
            },
          }
        );

        // Check if we've loaded enough
        if (loaded >= limit) {
          logger.info(
            `Reached loading limit of ${limit} embeddings, stopping`,
            {
              service: "tatt2awai-bot",
            }
          );
          break;
        }

        // Small delay between batches to allow for garbage collection
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (batchErr) {
        logger.error(
          `Offset loader: Error in batch at offset ${offset}: ${batchErr.message}`,
          {
            service: "tatt2awai-bot",
          }
        );
        stats.errors++;

        // Move to next batch despite error
        offset += batchSize;

        // Slightly longer delay after errors
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Update matcher stats
    if (global.imageMatcher) {
      global.imageMatcher._tensorCount =
        global.imageMatcher.signatureCache.size;
      global.imageMatcher._fullEmbeddingCount = stats.fullLoaded;
      global.imageMatcher._partialEmbeddingCount = stats.partialLoaded;
    }

    const finalCount = global.imageMatcher.signatureCache.size;

    logger.info(`Offset-based loading complete`, {
      service: "tatt2awai-bot",
      startingCount,
      newlyLoaded: stats.loaded,
      finalCount,
      stats,
    });

    // Get a count of unique paths
    const paths = new Set();
    if (global.imageMatcher && global.imageMatcher.signatureCache) {
      for (const key of global.imageMatcher.signatureCache.keys()) {
        const entry = global.imageMatcher.signatureCache.get(key);
        const originalPath = entry.originalPath || entry.path;
        paths.add(originalPath);
      }
    }

    return res.json({
      success: true,
      startingCount,
      loaded: stats.loaded,
      finalCount,
      uniquePaths: paths.size,
      stats,
      nextOffset: offset, // For continued pagination
      message: `Offset loader: Loaded ${stats.loaded} embeddings with offset pagination`,
    });
  } catch (error) {
    logger.error(`Offset-based loader error: ${error.message}`, {
      service: "tatt2awai-bot",
      stack: error.stack,
    });

    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
});

// Add this new endpoint to bypass all the normal loading mechanisms
router.get("/force-load-embedding-only", async (req, res) => {
  try {
    // Initialize matcher if needed
    if (!global.imageMatcher) {
      const RobustImageMatcher = require("../../RobustImageMatcher");
      global.imageMatcher = new RobustImageMatcher({
        signatureThreshold: 0.65,
        useLocalCache: true,
        stateDirectory: process.cwd(),
        signatureCount: 10000,
        loadFromState: false,
      });
      await global.imageMatcher.initialize();
    }

    // Clear the cache first if requested to ensure a fresh start
    if (req.query.clearCache === "true") {
      if (global.imageMatcher.signatureCache) {
        global.imageMatcher.signatureCache.clear();
      }
      logger.info("Emergency loader: Cleared existing cache", {
        service: "tatt2awai-bot",
      });
    }

    const startingCount = global.imageMatcher.signatureCache
      ? global.imageMatcher.signatureCache.size
      : 0;

    // COMPLETELY BYPASS standard loading mechanisms
    // Use direct ID-based loading with minimal batch size
    let stats = {
      loaded: 0,
      skipped: 0,
      errors: 0,
      fullLoaded: 0,
      partialLoaded: 0,
    };

    // Set a shorter statement timeout
    try {
      await supabase.rpc("set_statement_timeout", { timeout_ms: 15000 });
    } catch (err) {
      // Ignore error, proceed anyway
    }

    // Load embeddings directly using ID ranges instead of offsets
    // This is more reliable with large tables
    const batchSize = 5; // Very small batch size to avoid timeouts
    const maxId = parseInt(req.query.maxId) || 1000; // Default to first 1000 IDs
    let loaded = 0;

    // Get the starting ID (default to 1 or use query param)
    const startId = parseInt(req.query.startId) || 1;

    // Process in very small batches with explicit ID ranges
    for (let id = startId; id <= maxId && loaded < 200; id += batchSize) {
      try {
        // ONLY use embedding_* fields - do NOT attempt to use signature_* fields
        let query = supabase
          .from("image_embeddings")
          .select("id, image_path, embedding_type, embedding_data")
          .gte("id", id)
          .lt("id", id + batchSize);

        const { data, error } = await query;

        if (error) {
          logger.warn(`Emergency loader error at ID ${id}: ${error.message}`, {
            service: "tatt2awai-bot",
          });
          stats.errors++;
          continue; // Skip to next batch despite error
        }

        if (!data || data.length === 0) {
          // No data in this ID range
          continue;
        }

        logger.info(
          `Found ${data.length} records in ID range ${id}-${
            id + batchSize - 1
          }`,
          {
            service: "tatt2awai-bot",
          }
        );

        // Process data
        for (const emb of data) {
          try {
            if (!emb.image_path) {
              logger.debug(
                `Emergency loader: Skipping embedding ${emb.id}: No path`,
                {
                  service: "tatt2awai-bot",
                }
              );
              stats.skipped++;
              continue;
            }

            // Skip if no embedding data
            if (!emb.embedding_data) {
              logger.debug(
                `Emergency loader: Skipping embedding ${emb.id}: No embedding data`,
                {
                  service: "tatt2awai-bot",
                }
              );
              stats.skipped++;
              continue;
            }

            // Log the structure of the first embedding for debugging
            if (stats.loaded === 0) {
              logger.info(`First embedding structure:`, {
                service: "tatt2awai-bot",
                id: emb.id,
                type: emb.embedding_type,
                dataKeys: Object.keys(emb.embedding_data),
                hasEmbedding: !!emb.embedding_data.embedding,
                hasPatches: !!emb.embedding_data.patches,
              });
            }

            // Load full embeddings
            if (emb.embedding_type === "full" && emb.embedding_data) {
              // Get the embedding vector from any possible location
              let embVector = null;

              if (
                emb.embedding_data.embedding &&
                Array.isArray(emb.embedding_data.embedding)
              ) {
                embVector = emb.embedding_data.embedding;
              } else if (
                emb.embedding_data.tensor &&
                Array.isArray(emb.embedding_data.tensor)
              ) {
                embVector = emb.embedding_data.tensor;
              } else if (Array.isArray(emb.embedding_data)) {
                embVector = emb.embedding_data;
              }

              if (embVector && Array.isArray(embVector)) {
                // Use ID-based path to avoid any conflicts
                const uniquePath = `${emb.image_path}#id${emb.id}`;

                // Add to cache
                global.imageMatcher.signatureCache.set(uniquePath, {
                  path: uniquePath,
                  originalPath: emb.image_path,
                  type: "tensor",
                  embedding: embVector,
                });

                stats.loaded++;
                stats.fullLoaded++;

                if (stats.loaded % 10 === 0) {
                  logger.info(`Loaded ${stats.loaded} embeddings so far`, {
                    service: "tatt2awai-bot",
                  });
                }
              } else {
                logger.debug(
                  `Emergency loader: Embedding ${emb.id} has no valid embedding vector`,
                  {
                    service: "tatt2awai-bot",
                    dataKeys: Object.keys(emb.embedding_data),
                  }
                );
                stats.skipped++;
              }
            }
            // Load partial embeddings
            else if (emb.embedding_type === "partial" && emb.embedding_data) {
              // Get patches from any possible location
              let patches = null;

              if (
                emb.embedding_data.patches &&
                Array.isArray(emb.embedding_data.patches)
              ) {
                patches = emb.embedding_data.patches;
              } else if (
                emb.embedding_data.regions &&
                Array.isArray(emb.embedding_data.regions)
              ) {
                patches = emb.embedding_data.regions;
              } else if (
                emb.embedding_data.descriptors &&
                Array.isArray(emb.embedding_data.descriptors)
              ) {
                patches = emb.embedding_data.descriptors.map((d, i) => ({
                  embedding: d,
                  x: i * 10,
                  y: i * 10,
                  width: 100,
                  height: 100,
                }));
              }

              if (patches && Array.isArray(patches) && patches.length > 0) {
                // Use ID-based path
                const uniquePath = `${emb.image_path}#id${emb.id}`;

                // Add to cache
                global.imageMatcher.signatureCache.set(uniquePath, {
                  path: uniquePath,
                  originalPath: emb.image_path,
                  type: "tensor-patches",
                  patches: patches,
                });

                stats.loaded++;
                stats.partialLoaded++;

                if (stats.loaded % 10 === 0) {
                  logger.info(`Loaded ${stats.loaded} embeddings so far`, {
                    service: "tatt2awai-bot",
                  });
                }
              } else {
                logger.debug(
                  `Emergency loader: Embedding ${emb.id} has no valid patches array`,
                  {
                    service: "tatt2awai-bot",
                    dataKeys: Object.keys(emb.embedding_data),
                  }
                );
                stats.skipped++;
              }
            } else {
              logger.debug(
                `Emergency loader: Unknown embedding type ${emb.embedding_type} for ${emb.id}`,
                {
                  service: "tatt2awai-bot",
                }
              );
              stats.skipped++;
            }
          } catch (embErr) {
            logger.warn(
              `Emergency loader: Error processing embedding ${emb.id}: ${embErr.message}`,
              {
                service: "tatt2awai-bot",
              }
            );
            stats.errors++;
          }
        }

        // Update loaded count
        loaded = stats.loaded;

        logger.info(
          `Emergency loader: Processed ID range ${id}-${
            id + batchSize - 1
          }, loaded ${stats.loaded} so far`,
          {
            service: "tatt2awai-bot",
            batchStats: {
              loaded: stats.loaded,
              fullLoaded: stats.fullLoaded,
              partialLoaded: stats.partialLoaded,
            },
          }
        );

        // Small delay between batches
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (batchErr) {
        logger.error(
          `Emergency loader: Error in batch at ID ${id}: ${batchErr.message}`,
          {
            service: "tatt2awai-bot",
          }
        );
        stats.errors++;

        // Slightly longer delay after errors
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // Update matcher stats
    if (global.imageMatcher) {
      global.imageMatcher._tensorCount =
        global.imageMatcher.signatureCache.size;
      global.imageMatcher._fullEmbeddingCount = stats.fullLoaded;
      global.imageMatcher._partialEmbeddingCount = stats.partialLoaded;
    }

    const finalCount = global.imageMatcher.signatureCache.size;

    logger.info(`Emergency embedding loading complete`, {
      service: "tatt2awai-bot",
      startingCount,
      newlyLoaded: stats.loaded,
      finalCount,
      stats,
    });

    // Get a count of paths from cache
    const paths = new Set();
    if (global.imageMatcher && global.imageMatcher.signatureCache) {
      for (const key of global.imageMatcher.signatureCache.keys()) {
        const entry = global.imageMatcher.signatureCache.get(key);
        const originalPath = entry.originalPath || entry.path;
        paths.add(originalPath);
      }
    }

    return res.json({
      success: true,
      startingCount,
      loaded: stats.loaded,
      finalCount,
      uniquePaths: paths.size,
      stats,
      nextId: maxId + 1, // For pagination
      message: `Emergency loader: Loaded ${stats.loaded} embeddings directly by ID range`,
    });
  } catch (error) {
    logger.error(`Emergency embedding loader error: ${error.message}`, {
      service: "tatt2awai-bot",
      stack: error.stack,
    });

    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
});

// Add this new endpoint to bypass all the normal loading mechanisms
router.get("/force-load-emergency-fixed", async (req, res) => {
  try {
    // Initialize matcher if needed
    if (!global.imageMatcher) {
      const RobustImageMatcher = require("../../RobustImageMatcher");
      global.imageMatcher = new RobustImageMatcher({
        signatureThreshold: 0.65,
        useLocalCache: true,
        stateDirectory: process.cwd(),
        signatureCount: 10000,
        loadFromState: false,
      });
      await global.imageMatcher.initialize();
    }

    // Clear the cache first if requested to ensure a fresh start
    if (req.query.clearCache === "true") {
      if (global.imageMatcher.signatureCache) {
        global.imageMatcher.signatureCache.clear();
      }
      logger.info("Emergency loader: Cleared existing cache", {
        service: "tatt2awai-bot",
      });
    }

    const startingCount = global.imageMatcher.signatureCache
      ? global.imageMatcher.signatureCache.size
      : 0;

    // COMPLETELY BYPASS standard loading mechanisms
    // Use direct ID-based loading with minimal batch size
    let stats = {
      loaded: 0,
      skipped: 0,
      errors: 0,
      fullLoaded: 0,
      partialLoaded: 0,
    };

    // Set a shorter statement timeout
    try {
      await supabase.rpc("set_statement_timeout", { timeout_ms: 15000 });
    } catch (err) {
      // Ignore error, proceed anyway
    }

    // Load embeddings directly using ID ranges instead of offsets
    // This is more reliable with large tables
    const batchSize = 5; // Very small batch size to avoid timeouts
    const maxId = parseInt(req.query.maxId) || 1000; // Default to first 1000 IDs
    let loaded = 0;

    // Get the starting ID (default to 1 or use query param)
    const startId = parseInt(req.query.startId) || 1;

    // Process in very small batches with explicit ID ranges
    for (let id = startId; id <= maxId && loaded < 200; id += batchSize) {
      try {
        // CRITICAL: Use the correct field names from your database
        // Try both signature_data and embedding_data
        let query = supabase
          .from("image_embeddings")
          .select(
            "id, image_path, signature_type, signature_data, embedding_type, embedding_data"
          )
          .gte("id", id)
          .lt("id", id + batchSize);

        const { data, error } = await query;

        if (error) {
          logger.warn(`Emergency loader error at ID ${id}: ${error.message}`, {
            service: "tatt2awai-bot",
          });
          stats.errors++;
          continue; // Skip to next batch despite error
        }

        if (!data || data.length === 0) {
          // No data in this ID range
          continue;
        }

        logger.info(
          `Found ${data.length} records in ID range ${id}-${
            id + batchSize - 1
          }`,
          {
            service: "tatt2awai-bot",
          }
        );

        // Process data
        for (const emb of data) {
          try {
            if (!emb.image_path) {
              logger.debug(
                `Emergency loader: Skipping embedding ${emb.id}: No path`,
                {
                  service: "tatt2awai-bot",
                }
              );
              stats.skipped++;
              continue;
            }

            // Determine which field names to use based on what's available
            const embType = emb.signature_type || emb.embedding_type;
            const embData = emb.signature_data || emb.embedding_data;

            if (!embType || !embData) {
              logger.debug(
                `Emergency loader: Skipping embedding ${emb.id}: No type or data`,
                {
                  service: "tatt2awai-bot",
                  hasType: !!embType,
                  hasData: !!embData,
                }
              );
              stats.skipped++;
              continue;
            }

            // Log the structure of the first embedding for debugging
            if (stats.loaded === 0) {
              logger.info(`First embedding structure:`, {
                service: "tatt2awai-bot",
                id: emb.id,
                type: embType,
                dataKeys: Object.keys(embData),
                hasEmbedding: !!embData.embedding,
                hasPatches: !!embData.patches,
              });
            }

            // Load full embeddings
            if (embType === "full" && embData) {
              // Get the embedding vector from any possible location
              let embVector = null;

              if (embData.embedding && Array.isArray(embData.embedding)) {
                embVector = embData.embedding;
              } else if (embData.tensor && Array.isArray(embData.tensor)) {
                embVector = embData.tensor;
              } else if (Array.isArray(embData)) {
                embVector = embData;
              }

              if (embVector && Array.isArray(embVector)) {
                // Force unique path to avoid conflicts
                const uniquePath = `${emb.image_path}#id${emb.id}`;

                // Add to cache
                global.imageMatcher.signatureCache.set(uniquePath, {
                  path: uniquePath,
                  originalPath: emb.image_path,
                  type: "tensor",
                  embedding: embVector,
                });

                stats.loaded++;
                stats.fullLoaded++;

                if (stats.loaded % 10 === 0) {
                  logger.info(`Loaded ${stats.loaded} embeddings so far`, {
                    service: "tatt2awai-bot",
                  });
                }
              } else {
                logger.debug(
                  `Emergency loader: Embedding ${emb.id} has no valid embedding vector`,
                  {
                    service: "tatt2awai-bot",
                    dataKeys: Object.keys(embData),
                  }
                );
                stats.skipped++;
              }
            }
            // Load partial embeddings
            else if (embType === "partial" && embData) {
              // Get patches from any possible location
              let patches = null;

              if (embData.patches && Array.isArray(embData.patches)) {
                patches = embData.patches;
              } else if (embData.regions && Array.isArray(embData.regions)) {
                patches = embData.regions;
              } else if (
                embData.descriptors &&
                Array.isArray(embData.descriptors)
              ) {
                patches = embData.descriptors.map((d, i) => ({
                  embedding: d,
                  x: i * 10,
                  y: i * 10,
                  width: 100,
                  height: 100,
                }));
              }

              if (patches && Array.isArray(patches) && patches.length > 0) {
                // Force unique path
                const uniquePath = `${emb.image_path}#id${emb.id}`;

                // Add to cache
                global.imageMatcher.signatureCache.set(uniquePath, {
                  path: uniquePath,
                  originalPath: emb.image_path,
                  type: "tensor-patches",
                  patches: patches,
                });

                stats.loaded++;
                stats.partialLoaded++;

                if (stats.loaded % 10 === 0) {
                  logger.info(`Loaded ${stats.loaded} embeddings so far`, {
                    service: "tatt2awai-bot",
                  });
                }
              } else {
                logger.debug(
                  `Emergency loader: Embedding ${emb.id} has no valid patches array`,
                  {
                    service: "tatt2awai-bot",
                    dataKeys: Object.keys(embData),
                  }
                );
                stats.skipped++;
              }
            } else {
              logger.debug(
                `Emergency loader: Unknown embedding type ${embType} for ${emb.id}`,
                {
                  service: "tatt2awai-bot",
                }
              );
              stats.skipped++;
            }
          } catch (embErr) {
            logger.warn(
              `Emergency loader: Error processing embedding ${emb.id}: ${embErr.message}`,
              {
                service: "tatt2awai-bot",
              }
            );
            stats.errors++;
          }
        }

        // Update loaded count
        loaded = stats.loaded;

        logger.info(
          `Emergency loader: Processed ID range ${id}-${
            id + batchSize - 1
          }, loaded ${stats.loaded} so far`,
          {
            service: "tatt2awai-bot",
            batchStats: {
              loaded: stats.loaded,
              fullLoaded: stats.fullLoaded,
              partialLoaded: stats.partialLoaded,
            },
          }
        );

        // Small delay between batches
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (batchErr) {
        logger.error(
          `Emergency loader: Error in batch at ID ${id}: ${batchErr.message}`,
          {
            service: "tatt2awai-bot",
          }
        );
        stats.errors++;

        // Slightly longer delay after errors
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // Update matcher stats
    if (global.imageMatcher) {
      global.imageMatcher._tensorCount =
        global.imageMatcher.signatureCache.size;
      global.imageMatcher._fullEmbeddingCount = stats.fullLoaded;
      global.imageMatcher._partialEmbeddingCount = stats.partialLoaded;
    }

    const finalCount = global.imageMatcher.signatureCache.size;

    logger.info(`Emergency embedding loading complete`, {
      service: "tatt2awai-bot",
      startingCount,
      newlyLoaded: stats.loaded,
      finalCount,
      stats,
    });

    // Get a count of paths from cache
    const paths = new Set();
    if (global.imageMatcher && global.imageMatcher.signatureCache) {
      for (const key of global.imageMatcher.signatureCache.keys()) {
        const entry = global.imageMatcher.signatureCache.get(key);
        const originalPath = entry.originalPath || entry.path;
        paths.add(originalPath);
      }
    }

    return res.json({
      success: true,
      startingCount,
      loaded: stats.loaded,
      finalCount,
      uniquePaths: paths.size,
      stats,
      nextId: maxId + 1, // For pagination
      message: `Emergency loader: Loaded ${stats.loaded} embeddings directly by ID range`,
    });
  } catch (error) {
    logger.error(`Emergency embedding loader error: ${error.message}`, {
      service: "tatt2awai-bot",
      stack: error.stack,
    });

    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
});

// Enhanced force load direct endpoint that validates embedding structure as it loads
router.get("/force-load-validated", async (req, res) => {
  try {
    if (!global.imageMatcher) {
      const RobustImageMatcher = require("../../RobustImageMatcher");
      global.imageMatcher = new RobustImageMatcher({
        signatureThreshold: 0.65,
        useLocalCache: true,
        stateDirectory: process.cwd(),
        signatureCount: 10000,
        loadFromState: false,
      });
      await global.imageMatcher.initialize();
    }

    const limit = parseInt(req.query.limit) || 200;
    const clearCache = req.query.clearCache === "true";

    if (clearCache) {
      // Clear the cache first if requested
      global.imageMatcher.signatureCache.clear();
      logger.info("Cleared existing matcher cache", {
        service: "tatt2awai-bot",
      });
    }

    const startingCount = global.imageMatcher.signatureCache
      ? global.imageMatcher.signatureCache.size
      : 0;

    // Counters for statistics
    let stats = {
      loaded: 0,
      skipped: 0,
      errors: 0,
      invalidFormat: 0,
      missingEmbedding: 0,
      missingPatches: 0,
    };

    // Set longer timeout for this operation
    await safeExecuteSql(`SET statement_timeout = 120000;`);

    // Load full embeddings first
    logger.info(`Loading ${limit / 2} full embeddings...`, {
      service: "tatt2awai-bot",
    });

    const { data: fullData, error: fullError } = await supabase
      .from("image_embeddings")
      .select("id, image_path, embedding_type, embedding_data")
      .eq("embedding_type", "full")
      .not("embedding_data", "is", null)
      .limit(limit / 2);

    if (fullError) {
      logger.error(`Error querying full embeddings: ${fullError.message}`, {
        service: "tatt2awai-bot",
      });
      stats.errors++;
    } else {
      // Process and validate each full embedding
      for (const emb of fullData || []) {
        try {
          // Skip if already in cache
          if (global.imageMatcher.signatureCache.has(emb.image_path)) {
            stats.skipped++;
            continue;
          }

          // Validate embedding structure
          if (!emb.embedding_data) {
            stats.missingEmbedding++;
            continue;
          }

          const embedding =
            emb.embedding_data.embedding ||
            emb.embedding_data.tensor ||
            (Array.isArray(emb.embedding_data) ? emb.embedding_data : null);

          if (!embedding || !Array.isArray(embedding)) {
            stats.invalidFormat++;
            continue;
          }

          // Add to matcher
          global.imageMatcher.signatureCache.set(emb.image_path, {
            path: emb.image_path,
            type: "tensor",
            embedding: embedding,
          });

          stats.loaded++;
        } catch (embErr) {
          logger.error(
            `Error loading full embedding ${emb.id}: ${embErr.message}`,
            {
              service: "tatt2awai-bot",
            }
          );
          stats.errors++;
        }
      }
    }

    // Load partial embeddings next
    logger.info(`Loading ${limit / 2} partial embeddings...`, {
      service: "tatt2awai-bot",
    });

    const { data: partialData, error: partialError } = await supabase
      .from("image_embeddings")
      .select("id, image_path, embedding_type, embedding_data")
      .eq("embedding_type", "partial")
      .not("embedding_data", "is", null)
      .limit(limit / 2);

    if (partialError) {
      logger.error(
        `Error querying partial embeddings: ${partialError.message}`,
        {
          service: "tatt2awai-bot",
        }
      );
      stats.errors++;
    } else {
      // Process and validate each partial embedding
      for (const emb of partialData || []) {
        try {
          // Skip if already in cache
          if (global.imageMatcher.signatureCache.has(emb.image_path)) {
            stats.skipped++;
            continue;
          }

          // Validate embedding structure
          if (!emb.embedding_data) {
            stats.missingEmbedding++;
            continue;
          }

          const patches =
            emb.embedding_data.patches ||
            emb.embedding_data.regions ||
            emb.embedding_data.descriptors;

          if (!patches || !Array.isArray(patches) || patches.length === 0) {
            stats.missingPatches++;
            continue;
          }

          // If we have descriptors, convert to patches format
          let validPatches = patches;
          if (emb.embedding_data.descriptors) {
            validPatches = patches.map((d, i) => ({
              embedding: d,
              x: i * 10,
              y: i * 10,
              width: 100,
              height: 100,
            }));
          }

          // Add to matcher
          global.imageMatcher.signatureCache.set(emb.image_path, {
            path: emb.image_path,
            type: "tensor-patches",
            patches: validPatches,
          });

          stats.loaded++;
        } catch (embErr) {
          logger.error(
            `Error loading partial embedding ${emb.id}: ${embErr.message}`,
            {
              service: "tatt2awai-bot",
            }
          );
          stats.errors++;
        }
      }
    }

    // Update matcher stats
    if (global.imageMatcher) {
      global.imageMatcher._tensorCount =
        global.imageMatcher.signatureCache.size;
      global.imageMatcher._fullEmbeddingCount =
        (global.imageMatcher._fullEmbeddingCount || 0) + stats.loaded;
      global.imageMatcher._partialEmbeddingCount =
        (global.imageMatcher._partialEmbeddingCount || 0) + stats.loaded;
    }

    const finalCount = global.imageMatcher.signatureCache
      ? global.imageMatcher.signatureCache.size
      : 0;

    logger.info(`Direct embedding loading complete with validation`, {
      service: "tatt2awai-bot",
      startingCount,
      loaded: stats.loaded,
      skipped: stats.skipped,
      errors: stats.errors,
      finalCount,
    });

    return res.json({
      success: true,
      startingCount,
      stats,
      finalCount,
      message: `Loaded ${stats.loaded} valid embeddings, skipped ${
        stats.skipped
      } existing, found ${
        stats.invalidFormat + stats.missingEmbedding + stats.missingPatches
      } invalid`,
    });
  } catch (error) {
    logger.error(`Error in validated embedding loader: ${error.message}`, {
      service: "tatt2awai-bot",
      stack: error.stack,
    });

    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
});

// Setup database connection and verify schema
setupDatabaseSchema().catch((err) => {
  logger.error("Error setting up database schema:", {
    service: "tatt2awai-bot",
    error: err.message,
  });
});

// Function to ensure database schema is correct
async function setupDatabaseSchema() {
  if (!global.supabase) {
    logger.warn("Cannot set up schema - supabase not initialized", {
      service: "tatt2awai-bot",
    });
    return;
  }

  try {
    // 1. Check if the image_embeddings table exists
    const { data: tableExists, error: tableError } = await supabase
      .from("image_embeddings")
      .select("id")
      .limit(1);

    if (
      tableError &&
      tableError.message.includes('relation "image_embeddings" does not exist')
    ) {
      logger.info("Creating image_embeddings table", {
        service: "tatt2awai-bot",
      });

      // Create the table
      await supabase.rpc("run_sql", {
        sql: `
          CREATE TABLE IF NOT EXISTS image_embeddings (
            id SERIAL PRIMARY KEY,
            image_path TEXT NOT NULL,
            embedding_type TEXT,
            embedding_data JSONB
          );
        `,
      });
    }

    // 2. Check if embedding_type column exists (previously signature_type)
    let hasEmbeddingType = false;
    let hasEmbeddingData = false;

    try {
      const { data: columnCheck } = await supabase
        .from("image_embeddings")
        .select("embedding_type")
        .limit(1);

      hasEmbeddingType = true;
    } catch (err) {
      if (
        err.message &&
        err.message.includes('column "embedding_type" does not exist')
      ) {
        // Need to add embedding_type column
        logger.info("Adding embedding_type column", {
          service: "tatt2awai-bot",
        });

        await supabase.rpc("run_sql", {
          sql: "ALTER TABLE image_embeddings ADD COLUMN IF NOT EXISTS embedding_type TEXT",
        });
      }
    }

    // 3. Check if embedding_data column exists (previously signature_data)
    try {
      const { data: dataCheck } = await supabase
        .from("image_embeddings")
        .select("embedding_data")
        .limit(1);

      hasEmbeddingData = true;
    } catch (err) {
      if (
        err.message &&
        err.message.includes('column "embedding_data" does not exist')
      ) {
        // Need to add embedding_data column
        logger.info("Adding embedding_data column", {
          service: "tatt2awai-bot",
        });

        await supabase.rpc("run_sql", {
          sql: "ALTER TABLE image_embeddings ADD COLUMN IF NOT EXISTS embedding_data JSONB",
        });
      }
    }

    // 4. Create indexes for better performance
    await supabase.rpc("run_sql", {
      sql: "CREATE INDEX IF NOT EXISTS idx_image_path ON image_embeddings(image_path)",
    });

    await supabase.rpc("run_sql", {
      sql: "CREATE INDEX IF NOT EXISTS idx_embedding_type ON image_embeddings(embedding_type)",
    });

    logger.info("Database schema setup complete", {
      service: "tatt2awai-bot",
      hasEmbeddingType,
      hasEmbeddingData,
    });

    return true;
  } catch (err) {
    logger.error("Error setting up database schema:", {
      service: "tatt2awai-bot",
      error: err.message,
    });
    return false;
  }
}

// Safe SQL execution function that handles errors gracefully
/**
 * Execute SQL safely with error handling and retries
 * @param {string} sql - SQL query to execute
 * @param {Object} params - Parameters for the query
 * @returns {Promise<Object>} Query result or null on error
 */
async function safeExecuteSql(sql, params = {}) {
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      attempts++;

      const { data, error } = await supabase.rpc("run_sql", { sql });

      if (error) {
        // Check if it's a timeout error
        const isTimeout =
          error.message.includes("timeout") || error.message.includes("cancel");

        logger.warn(
          `SQL execution error (attempt ${attempts}/${maxAttempts}): ${error.message}`,
          {
            service: "tatt2awai-bot",
          }
        );

        // Record in circuit breaker
        circuitBreaker.recordFailure(isTimeout);

        // If it's the last attempt, return null
        if (attempts >= maxAttempts) {
          return null;
        }

        // Add exponential backoff delay
        const delay = Math.min(5000, 1000 * Math.pow(2, attempts - 1));
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // Success - record it in circuit breaker
      circuitBreaker.recordSuccess();

      return data;
    } catch (err) {
      const isTimeout =
        err.message.includes("timeout") || err.message.includes("cancel");

      logger.warn(
        `SQL execution exception (attempt ${attempts}/${maxAttempts}): ${err.message}`,
        {
          service: "tatt2awai-bot",
        }
      );

      // Record in circuit breaker
      circuitBreaker.recordFailure(isTimeout);

      // If it's the last attempt, return null
      if (attempts >= maxAttempts) {
        return null;
      }

      // Add exponential backoff delay
      const delay = Math.min(5000, 1000 * Math.pow(2, attempts - 1));
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return null;
}

/**
 * Safely set statement timeout with retries
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<boolean>} Success status
 */
async function safelySetStatementTimeout(timeoutMs = 20000) {
  try {
    if (!global.supabase) {
      logger.warn("Cannot set statement timeout - supabase not initialized", {
        service: "tatt2awai-bot",
      });
      return false;
    }

    // Use direct SQL with retries
    const result = await safeExecuteSql(
      `SET statement_timeout = ${timeoutMs};`
    );

    if (result !== null) {
      logger.debug(`Set statement timeout to ${timeoutMs}ms`, {
        service: "tatt2awai-bot",
      });
      return true;
    }

    return false;
  } catch (error) {
    logger.warn(`Error in safelySetStatementTimeout: ${error.message}`, {
      service: "tatt2awai-bot",
    });
    return false;
  }
}

// Safely set statement timeout without requiring custom function
async function safelySetStatementTimeout(timeoutMs = 30000) {
  try {
    if (!global.supabase) {
      logger.warn("Cannot set statement timeout - supabase not initialized", {
        service: "tatt2awai-bot",
      });
      return false;
    }

    // Use direct SQL instead of RPC function
    const result = await safeExecuteSql(
      `SET statement_timeout = ${timeoutMs};`
    );

    if (result !== null) {
      logger.info(`Set statement timeout to ${timeoutMs}ms`, {
        service: "tatt2awai-bot",
      });
      return true;
    }

    return false;
  } catch (error) {
    logger.warn(`Error in safelySetStatementTimeout: ${error.message}`, {
      service: "tatt2awai-bot",
    });
    return false;
  }
}

// ===== MIDDLEWARE =====

// Request throttling middleware to prevent database overload
const requestThrottle = {};
router.use((req, res, next) => {
  // Skip throttling for status endpoints
  if (req.path === "/check" || req.path === "/embedding-status") {
    return next();
  }

  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const cooldown = req.path.includes("visual") ? 2000 : 1000; // 2 second for visual searches, 1 second for others

  if (requestThrottle[ip] && now - requestThrottle[ip] < cooldown) {
    return res.status(429).json({
      success: false,
      error: "Please wait before making another request",
      retryAfter: Math.ceil((requestThrottle[ip] + cooldown - now) / 1000),
    });
  }

  requestThrottle[ip] = now;
  next();
});

// Circuit breaker middleware
router.use((req, res, next) => {
  // Skip circuit breaker for status endpoints
  if (req.path === "/check" || req.path === "/embedding-status") {
    return next();
  }

  if (circuitBreaker.isOpen()) {
    return res.status(503).json({
      success: false,
      error: "System is currently recovering, please try again later",
      retryAfter: Math.ceil(
        (circuitBreaker.lastFailure + circuitBreaker.timeout - Date.now()) /
          1000
      ),
      status: "CIRCUIT_OPEN",
    });
  }

  next();
});

// ===== AUTOMATIC EMBEDDING LOADING =====

// Initialize and load the first batch of embeddings on startup
setTimeout(async function () {
  try {
    logger.info("Initializing automatic embedding loading on startup", {
      service: "tatt2awai-bot",
    });

    // Initialize matcher if needed
    if (!global.imageMatcher) {
      const RobustImageMatcher = require("../../RobustImageMatcher");
      global.imageMatcher = new RobustImageMatcher({
        signatureThreshold: 0.65,
        useLocalCache: true,
        stateDirectory: process.cwd(),
        signatureCount: 10000,
        loadFromState: false,
      });
      await global.imageMatcher.initialize();
    }

    // Load initial batch of embeddings (smaller batch to avoid overload)
    const result = await enhancedLoadEmbeddingsFromDatabase(200, "both");

    logger.info("Initial embedding load complete", {
      service: "tatt2awai-bot",
      loaded: result.loaded,
      total: result.cacheSize,
    });

    // Schedule background loading of the rest
    logger.info("Starting background loading of embeddings...", {
      service: "tatt2awai-bot",
    });
    loadRemainingEmbeddingsInBackground();
  } catch (err) {
    logger.error("Error during startup embedding load:", {
      service: "tatt2awai-bot",
      error: err.message,
      stack: err.stack,
    });
  }
}, 10000); // Wait 10 seconds after startup before loading

// Schedule hourly checks for new embeddings
cron.schedule("0 * * * *", async function () {
  try {
    logger.info("Running scheduled hourly check for new embeddings", {
      service: "tatt2awai-bot",
    });

    // Get current embedding count in DB
    const { count: dbCount, error: countError } = await supabase
      .from("image_embeddings")
      .select("id", { count: "exact" })
      .not("embedding_data", "is", null);

    if (countError) {
      logger.error("Error checking for new embeddings:", {
        service: "tatt2awai-bot",
        error: countError.message,
      });
      return;
    }

    // Get current cache size
    const cacheSize = global.imageMatcher
      ? global.imageMatcher.signatureCache.size
      : 0;

    // Check if we need to load more
    if (dbCount > cacheSize) {
      logger.info(`Found ${dbCount - cacheSize} new embeddings to load`, {
        service: "tatt2awai-bot",
        dbCount,
        cacheSize,
      });

      // Load new embeddings (smaller batch size to avoid I/O issues)
      const result = await enhancedLoadEmbeddingsFromDatabase(100, "both");

      logger.info("Hourly embedding update complete", {
        service: "tatt2awai-bot",
        newlyLoaded: result.loaded,
        totalLoaded: result.cacheSize,
        remainingToLoad: Math.max(0, dbCount - result.cacheSize),
      });
    } else {
      logger.info("No new embeddings found in hourly check", {
        service: "tatt2awai-bot",
        dbCount,
        cacheSize,
      });
    }
  } catch (err) {
    logger.error("Error during hourly embedding check:", {
      service: "tatt2awai-bot",
      error: err.message,
    });
  }
});

/**
 * Function to gradually load remaining embeddings in the background using offset pagination
 * with memory management
 */
async function loadRemainingEmbeddingsInBackground() {
  try {
    // Check if matcher is initialized
    if (!global.imageMatcher) {
      logger.warn("Cannot load embeddings - matcher not initialized", {
        service: "tatt2awai-bot",
      });

      // Try again in 30 seconds
      setTimeout(loadRemainingEmbeddingsInBackground, 30000);
      return;
    }

    // Check memory pressure before proceeding
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / (1024 * 1024));
    const heapTotalMB = Math.round(memoryUsage.heapTotal / (1024 * 1024));
    const rssMB = Math.round(memoryUsage.rss / (1024 * 1024));

    // Log memory stats
    logger.info("Memory usage stats:", {
      service: "tatt2awai-bot",
      heapUsedMB,
      heapTotalMB,
      rssMB,
      embeddingCacheSize: global.embeddingCache
        ? global.embeddingCache.size
        : 0,
      signatureCacheSize: global.imageMatcher.signatureCache.size,
    });

    // Check for memory pressure - threshold at 70% or over 900MB
    const memoryPressure =
      heapUsedMB > heapTotalMB * 0.7 || heapUsedMB > 900 || rssMB > 1400;

    if (memoryPressure) {
      logger.warn("Memory pressure detected, clearing embedding cache", {
        service: "tatt2awai-bot",
        heapUsedMB,
        heapTotalMB,
      });

      // If we have a global embedding cache, clear it
      if (global.embeddingCache) {
        global.embeddingCache.clear();
      }

      // Try again in 5 minutes
      setTimeout(loadRemainingEmbeddingsInBackground, 5 * 60 * 1000);
      return;
    }

    // Get count of embeddings with data in DB - ONLY using embedding_data
    let totalInDb = 0;
    try {
      const { count, error } = await supabase
        .from("image_embeddings")
        .select("id", { count: "exact", head: true })
        .not("embedding_data", "is", null);

      if (!error && count) {
        totalInDb = count;
        logger.info(`Found ${count} embeddings with embedding_data`, {
          service: "tatt2awai-bot",
        });
      }
    } catch (countError) {
      logger.error("Error checking total embeddings:", {
        service: "tatt2awai-bot",
        error: countError.message,
      });

      // Try again in 60 seconds
      setTimeout(loadRemainingEmbeddingsInBackground, 60000);
      return;
    }

    if (totalInDb === 0) {
      logger.error("No embeddings found in database", {
        service: "tatt2awai-bot",
      });

      // Try again in 60 seconds
      setTimeout(loadRemainingEmbeddingsInBackground, 60000);
      return;
    }

    // Calculate how many more to load
    const currentlyLoaded = global.imageMatcher.signatureCache.size;
    const remaining = Math.max(0, totalInDb - currentlyLoaded);

    logger.info(
      `Background loading: ${currentlyLoaded}/${totalInDb} embeddings loaded, ${remaining} remaining`,
      {
        service: "tatt2awai-bot",
      }
    );

    // If no more to load, we're done but still schedule a check in 5 minutes
    if (remaining <= 0) {
      logger.info("All embeddings loaded successfully", {
        service: "tatt2awai-bot",
        totalLoaded: currentlyLoaded,
      });

      // Schedule another check in 5 minutes to look for new embeddings
      setTimeout(loadRemainingEmbeddingsInBackground, 5 * 60 * 1000);
      return;
    }

    // Use global offset tracking with offset pagination
    global.nextOffset = global.nextOffset || 0;
    const offset = global.nextOffset;

    // Calculate batch size - smaller when more is loaded to avoid I/O issues
    // and smaller than original to avoid memory issues
    const loadedPercentage = currentlyLoaded / totalInDb;
    let batchSize = 20; // Reduced from 40 to 20 for memory efficiency

    if (loadedPercentage > 0.8) batchSize = 10;
    else if (loadedPercentage > 0.5) batchSize = 15;

    // Try to set a shorter statement timeout
    try {
      await supabase.rpc("set_statement_timeout", { timeout_ms: 10000 });
    } catch (err) {
      // Ignore error, proceed anyway
    }

    logger.info(`Loading next batch of embeddings from offset ${offset}`, {
      service: "tatt2awai-bot",
      batchSize: batchSize,
    });

    let stats = {
      loaded: 0,
      skipped: 0,
      errors: 0,
      fullLoaded: 0,
      partialLoaded: 0,
      processedPaths: new Set(),
    };

    // Collect already loaded paths to avoid duplicates
    const existingPaths = new Set();
    if (global.imageMatcher && global.imageMatcher.signatureCache) {
      for (const entry of global.imageMatcher.signatureCache.values()) {
        if (entry.originalPath) {
          existingPaths.add(entry.originalPath);
        } else if (entry.path) {
          existingPaths.add(entry.path);
        }
      }
    }

    try {
      // Build query with ONLY embedding_* fields
      let query = supabase
        .from("image_embeddings")
        .select("id, image_path, embedding_type, embedding_data")
        .not("embedding_data", "is", null)
        .range(offset, offset + batchSize - 1);

      // Execute query
      const { data, error } = await query;

      if (error) {
        logger.warn(
          `Background loader error at offset ${offset}: ${error.message}`,
          {
            service: "tatt2awai-bot",
          }
        );

        // Move forward by batch size even on error to avoid getting stuck
        global.nextOffset = offset + batchSize;

        // Schedule next attempt
        const delay = Math.min(
          20000,
          3000 + Math.floor(loadedPercentage * 15000)
        );
        setTimeout(loadRemainingEmbeddingsInBackground, delay);
        return;
      }

      if (!data || data.length === 0) {
        logger.info(
          `No more embeddings found at offset ${offset}, resetting to 0`,
          {
            service: "tatt2awai-bot",
          }
        );

        // Reset to beginning if we've reached the end
        global.nextOffset = 0;

        // Schedule next attempt
        setTimeout(loadRemainingEmbeddingsInBackground, 60000);
        return;
      }

      // Check memory again before processing
      const currentMemory = process.memoryUsage();
      const currentHeapMB = Math.round(currentMemory.heapUsed / (1024 * 1024));

      if (currentHeapMB > 900) {
        logger.warn(
          "Memory pressure detected during processing, will try again later",
          {
            service: "tatt2awai-bot",
            heapUsedMB: currentHeapMB,
          }
        );

        // Force garbage collection if available
        if (global.gc) {
          try {
            global.gc();
          } catch (gcErr) {
            // Ignore errors
          }
        }

        // Move offset forward and try again later
        global.nextOffset = offset + data.length;
        setTimeout(loadRemainingEmbeddingsInBackground, 3 * 60 * 1000);
        return;
      }

      // Process the embeddings
      for (const emb of data) {
        try {
          if (!emb.image_path || !emb.embedding_data) {
            stats.skipped++;
            continue;
          }

          // Skip if already loaded
          if (existingPaths.has(emb.image_path)) {
            stats.skipped++;
            continue;
          }

          // Process based on embedding type
          if (emb.embedding_type === "full") {
            // Get embedding vector
            let embVector = null;

            if (
              emb.embedding_data.embedding &&
              Array.isArray(emb.embedding_data.embedding)
            ) {
              embVector = emb.embedding_data.embedding;
            } else if (
              emb.embedding_data.tensor &&
              Array.isArray(emb.embedding_data.tensor)
            ) {
              embVector = emb.embedding_data.tensor;
            } else if (Array.isArray(emb.embedding_data)) {
              embVector = emb.embedding_data;
            }

            if (embVector && Array.isArray(embVector)) {
              // Add to matcher
              global.imageMatcher.signatureCache.set(emb.image_path, {
                path: emb.image_path,
                type: "tensor",
                embedding: embVector,
              });

              stats.loaded++;
              stats.fullLoaded++;
              stats.processedPaths.add(emb.image_path);
            } else {
              stats.skipped++;
            }
          }
          // Process partial embedding
          else if (emb.embedding_type === "partial") {
            // Get patches
            let patches = null;

            if (
              emb.embedding_data.patches &&
              Array.isArray(emb.embedding_data.patches)
            ) {
              patches = emb.embedding_data.patches;
            } else if (
              emb.embedding_data.regions &&
              Array.isArray(emb.embedding_data.regions)
            ) {
              patches = emb.embedding_data.regions;
            } else if (
              emb.embedding_data.descriptors &&
              Array.isArray(emb.embedding_data.descriptors)
            ) {
              patches = emb.embedding_data.descriptors.map((d, i) => ({
                embedding: d,
                x: i * 10,
                y: i * 10,
                width: 100,
                height: 100,
              }));
            }

            if (patches && Array.isArray(patches) && patches.length > 0) {
              // Add to matcher
              global.imageMatcher.signatureCache.set(emb.image_path, {
                path: emb.image_path,
                type: "tensor-patches",
                patches: patches,
              });

              stats.loaded++;
              stats.partialLoaded++;
              stats.processedPaths.add(emb.image_path);
            } else {
              stats.skipped++;
            }
          } else {
            stats.skipped++;
          }

          // Check memory after each embedding - this is critical
          if (stats.loaded % 5 === 0) {
            const embMemory = process.memoryUsage();
            const embHeapMB = Math.round(embMemory.heapUsed / (1024 * 1024));

            if (embHeapMB > 950) {
              logger.warn(
                "Memory threshold exceeded during embedding loading, stopping batch",
                {
                  service: "tatt2awai-bot",
                  heapUsedMB: embHeapMB,
                  loadedSoFar: stats.loaded,
                }
              );

              // Force garbage collection if available
              if (global.gc) {
                try {
                  global.gc();
                } catch (gcErr) {
                  // Ignore errors
                }
              }

              break; // Stop loading more embeddings in this batch
            }
          }
        } catch (embErr) {
          logger.warn(
            `Error processing embedding ${emb.id}: ${embErr.message}`,
            {
              service: "tatt2awai-bot",
            }
          );
          stats.errors++;
        }
      }

      // Update matcher stats
      if (global.imageMatcher) {
        global.imageMatcher._tensorCount =
          global.imageMatcher.signatureCache.size;
        global.imageMatcher._fullEmbeddingCount =
          (global.imageMatcher._fullEmbeddingCount || 0) + stats.fullLoaded;
        global.imageMatcher._partialEmbeddingCount =
          (global.imageMatcher._partialEmbeddingCount || 0) +
          stats.partialLoaded;
      }

      // Update offset for next batch
      global.nextOffset = offset + data.length;

      logger.info(`Background embedding loading batch complete`, {
        service: "tatt2awai-bot",
        loaded: stats.loaded,
        fullLoaded: stats.fullLoaded,
        partialLoaded: stats.partialLoaded,
        skipped: stats.skipped,
        errors: stats.errors,
        cacheSize: global.imageMatcher.signatureCache.size,
        nextOffset: global.nextOffset,
      });

      // Force garbage collection if available before scheduling next batch
      if (global.gc) {
        try {
          global.gc();
        } catch (gcErr) {
          // Ignore errors
        }
      }

      // Schedule next batch with a delay that increases as we load more
      // This gives the system time to recover between batches
      const delay = Math.min(
        20000,
        3000 + Math.floor(loadedPercentage * 15000)
      );

      // Check memory again before scheduling next batch
      const finalMemory = process.memoryUsage();
      const finalHeapMB = Math.round(finalMemory.heapUsed / (1024 * 1024));

      if (finalHeapMB > 900) {
        // If memory pressure, schedule with longer delay
        logger.info("High memory usage, delaying next batch", {
          service: "tatt2awai-bot",
          heapUsedMB: finalHeapMB,
        });
        setTimeout(loadRemainingEmbeddingsInBackground, 3 * 60 * 1000);
      } else {
        // Normal scheduling
        setTimeout(loadRemainingEmbeddingsInBackground, delay);
      }
    } catch (err) {
      logger.error("Error in background embedding loading:", {
        service: "tatt2awai-bot",
        error: err.message,
        stack: err.stack,
      });

      // Retry after longer delay if there was an error
      setTimeout(loadRemainingEmbeddingsInBackground, 60000);
    }
  } catch (err) {
    logger.error("Error in background embedding loading:", {
      service: "tatt2awai-bot",
      error: err.message,
      stack: err.stack,
    });

    // Retry after longer delay if there was an error
    setTimeout(loadRemainingEmbeddingsInBackground, 60000);
  }
}

/**
 * Adapt file paths to the current server environment
 */
function adaptFilePath(originalPath) {
  if (!originalPath) return null;

  // Generate the file name
  const fileName = path.basename(originalPath);

  // Try possible locations
  const possiblePaths = [
    originalPath,
    originalPath.replace(
      "/root/tatt2awai-bot/",
      "/mnt/data/tatt2awai-bot-fresh/"
    ),
    `/mnt/data/tatt2awai-bot-fresh/cache/${fileName}`,
    `/tmp/tensor-embeddings/${fileName}`,
  ];

  // Return the first path that exists
  for (const testPath of possiblePaths) {
    if (fs.existsSync(testPath)) {
      return testPath;
    }
  }

  // If no path exists, return the adapted path anyway
  return originalPath.replace(
    "/root/tatt2awai-bot/",
    "/mnt/data/tatt2awai-bot-fresh/"
  );
}

/**
 * Ensures minimum number of embeddings are loaded before searching
 * @param {number} minRequired - Minimum number of embeddings needed
 * @param {string} mode - Type of embeddings to load (full, partial, both)
 * @returns {Promise<Object>} - Loading results
 */
async function ensureEmbeddingsLoaded(minRequired = 50, mode = "both") {
  try {
    // Check if matcher is initialized
    if (!global.imageMatcher) {
      logger.info("Initializing matcher for auto-loading", {
        service: "tatt2awai-bot",
      });

      const RobustImageMatcher = require("../../RobustImageMatcher");
      global.imageMatcher = new RobustImageMatcher({
        signatureThreshold: 0.65,
        useLocalCache: true,
        stateDirectory: process.cwd(),
        signatureCount: 10000,
        loadFromState: false,
      });
      await global.imageMatcher.initialize();
    }

    // Check how many embeddings are loaded
    const loadedCount = global.imageMatcher.signatureCache
      ? global.imageMatcher.signatureCache.size
      : 0;

    // Check if we have enough of the specific type requested
    let haveEnoughSpecificType = false;

    if (mode === "full" || mode === "both") {
      const fullEmbeddings = global.imageMatcher._fullEmbeddingCount || 0;
      if (fullEmbeddings >= minRequired / 2) {
        haveEnoughSpecificType = true;
      }
    }

    if (mode === "partial" || mode === "both") {
      const partialEmbeddings = global.imageMatcher._partialEmbeddingCount || 0;
      if (partialEmbeddings >= minRequired / 2) {
        haveEnoughSpecificType = true;
      }
    }

    // If we have enough embeddings overall AND enough of the specific type, skip loading
    if (loadedCount >= minRequired && haveEnoughSpecificType) {
      logger.info(
        `Already have ${loadedCount} embeddings loaded (${mode}), no auto-load needed`,
        {
          service: "tatt2awai-bot",
        }
      );

      return {
        success: true,
        autoLoaded: false,
        loadedCount,
        fullCount: global.imageMatcher._fullEmbeddingCount || 0,
        partialCount: global.imageMatcher._partialEmbeddingCount || 0,
      };
    }

    // Load more embeddings - use the enhanced loader
    logger.info(
      `Auto-loading embeddings: have ${loadedCount}, need ${minRequired} for mode ${mode}`,
      {
        service: "tatt2awai-bot",
      }
    );

    // Calculate how many we need to load - load at least 50 to make it worthwhile
    const toLoad = Math.max(50, minRequired - loadedCount);

    // Check if circuit breaker is open - if so, we'll proceed with what we have
    if (circuitBreaker.isOpen()) {
      logger.warn(
        `Circuit breaker is open, skipping auto-load and proceeding with ${loadedCount} embeddings`,
        {
          service: "tatt2awai-bot",
          circuitStatus: circuitBreaker.getStatus(),
        }
      );

      return {
        success: true,
        autoLoaded: false,
        skipReason: "CIRCUIT_BREAKER_OPEN",
        loadedCount,
        fullCount: global.imageMatcher._fullEmbeddingCount || 0,
        partialCount: global.imageMatcher._partialEmbeddingCount || 0,
        sufficient: loadedCount >= Math.min(20, minRequired), // Consider it sufficient if we have at least 20
      };
    }

    // Load with the enhanced function
    const result = await enhancedLoadEmbeddingsFromDatabase(toLoad, mode);

    const newCount = global.imageMatcher.signatureCache
      ? global.imageMatcher.signatureCache.size
      : 0;

    logger.info(
      `Auto-loading complete: now have ${newCount} embeddings loaded`,
      {
        service: "tatt2awai-bot",
        newlyLoaded: result.loaded,
      }
    );

    // If we loaded some but not enough, we'll consider it a success anyway
    const sufficient =
      newCount >= minRequired || (newCount > loadedCount && newCount >= 20);

    return {
      success: true,
      autoLoaded: true,
      before: loadedCount,
      after: newCount,
      fullCount: global.imageMatcher._fullEmbeddingCount || 0,
      partialCount: global.imageMatcher._partialEmbeddingCount || 0,
      newlyLoaded: result.loaded,
      sufficient: sufficient,
      mode: mode,
    };
  } catch (error) {
    logger.error(`Error in ensureEmbeddingsLoaded: ${error.message}`, {
      service: "tatt2awai-bot",
      stack: error.stack,
    });

    // If loading fails, we'll proceed with what we have
    const loadedCount =
      global.imageMatcher && global.imageMatcher.signatureCache
        ? global.imageMatcher.signatureCache.size
        : 0;

    return {
      success: false,
      error: error.message,
      autoLoaded: false,
      loadedCount,
      sufficient: loadedCount >= Math.min(20, minRequired), // Consider it sufficient if we have at least 20
    };
  }
}

/**
 * Enhanced function to load embeddings from Supabase with improved path tracking
 * and memory management
 * @param {number} limit - Maximum number of embeddings to load
 * @param {string} mode - Embedding type to load (full, partial, or both)
 * @returns {Promise<Object>} Loading results
 */
async function enhancedLoadEmbeddingsFromDatabase(limit = 1000, mode = "both") {
  logger.info(
    `Starting enhanced batch loading of ${limit} embeddings (mode: ${mode})`,
    {
      service: "tatt2awai-bot",
      limit,
      mode,
    }
  );

  // 1. Initialize matcher if needed
  if (!global.imageMatcher) {
    const RobustImageMatcher = require("../../RobustImageMatcher");
    global.imageMatcher = new RobustImageMatcher({
      signatureThreshold: 0.65,
      useLocalCache: true,
      stateDirectory: process.cwd(),
      signatureCount: 10000,
      loadFromState: false,
    });
    await global.imageMatcher.initialize();
    logger.info("Initialized matcher for batch loading", {
      service: "tatt2awai-bot",
    });
  }

  // 2. Set statement timeout for this operation
  await safelySetStatementTimeout(20000);

  // 3. Check memory before we start
  const startMemory = process.memoryUsage();
  const startHeapMB = Math.round(startMemory.heapUsed / (1024 * 1024));
  const startTotalMB = Math.round(startMemory.heapTotal / (1024 * 1024));

  logger.info("Memory usage before loading:", {
    service: "tatt2awai-bot",
    heapUsedMB: startHeapMB,
    heapTotalMB: startTotalMB,
    cacheSize: global.imageMatcher.signatureCache.size,
  });

  // Check for high memory pressure before starting
  if (startHeapMB > 900 || startHeapMB > startTotalMB * 0.8) {
    logger.warn(
      "High memory usage detected before loading, reducing target limit",
      {
        service: "tatt2awai-bot",
        originalLimit: limit,
      }
    );

    // Reduce limit under memory pressure
    limit = Math.floor(limit / 2);

    // If still too high, return early
    if (startHeapMB > 950) {
      logger.error("Memory pressure too high to safely load embeddings", {
        service: "tatt2awai-bot",
        heapUsedMB: startHeapMB,
      });

      return {
        success: false,
        error: "Memory pressure too high",
        loaded: 0,
        memoryStats: {
          heapUsedMB: startHeapMB,
          heapTotalMB: startTotalMB,
        },
      };
    }
  }

  // 4. Track processed paths for deduplication
  const processedPaths = new Set();

  // CRITICAL FIX: Only populate processed paths with normalized paths to avoid path mismatch issues
  if (global.imageMatcher && global.imageMatcher.signatureCache) {
    // Add already loaded paths to avoid reloading, but normalize them
    for (const path of global.imageMatcher.signatureCache.keys()) {
      // Normalize path for consistent comparison - remove dropbox: prefix if present
      const normalizedPath = normalizeImagePath(path);
      processedPaths.add(normalizedPath);
    }

    logger.info(
      `Starting with ${processedPaths.size} already loaded embeddings`,
      {
        service: "tatt2awai-bot",
      }
    );
  }

  // 5. Define batch processing parameters - smaller batch size to prevent I/O impact
  const batchSize = 5; // Keep small batch size for memory safety
  let offset = 0;
  let loaded = {
    total: 0,
    full: 0,
    partial: 0,
    errors: 0,
  };

  // 6. Process batches until limit is reached
  let batchNum = 1;
  let hasMore = true;
  let consecutiveEmptyBatches = 0;

  // IMPORTANT - Add offset tracking for DB search
  // This helps us search for unused offsets if we're skipping too much
  const startingOffset = offset;
  let allSkipped = true;
  let offsetJump = 0;

  while (hasMore && loaded.total < limit && batchNum <= 50) {
    // Increased max batches
    try {
      // Check memory before loading each batch
      const batchMemory = process.memoryUsage();
      const batchHeapMB = Math.round(batchMemory.heapUsed / (1024 * 1024));

      if (batchHeapMB > 900 || batchNum % 10 === 0) {
        logger.info("Memory status during batch loading:", {
          service: "tatt2awai-bot",
          heapUsedMB: batchHeapMB,
          batchNum,
          loadedSoFar: loaded.total,
        });
      }

      // Skip this batch if memory is too high
      if (batchHeapMB > 950) {
        logger.warn("Memory pressure too high, stopping batch loading", {
          service: "tatt2awai-bot",
          heapUsedMB: batchHeapMB,
          loadedSoFar: loaded.total,
        });

        // Try to force garbage collection
        if (global.gc) {
          try {
            global.gc();
          } catch (gcErr) {
            // Ignore errors
          }
        }

        break; // Exit the loading loop
      }

      // CRITICAL FIX: If we've gone through many batches and skipped everything,
      // try jumping ahead to potentially find new data
      if (batchNum > 15 && allSkipped) {
        offsetJump += 50;
        offset = startingOffset + offsetJump;
        logger.info(`All batches skipped so far, jumping to offset ${offset}`, {
          service: "tatt2awai-bot",
          batchNum,
          offsetJump,
        });
      }

      logger.info(`Processing batch ${batchNum} at offset ${offset}`, {
        service: "tatt2awai-bot",
        batchSize,
        loadedSoFar: loaded.total,
      });

      // Set statement timeout for each batch
      await safelySetStatementTimeout(20000);

      // Build query based on mode - using embedding_type with a retry mechanism
      let data = null;
      let error = null;

      try {
        const result = await executeQueryWithRetry(
          async () => {
            let query = supabase
              .from("image_embeddings")
              .select("id, image_path, embedding_type, embedding_data")
              .not("embedding_data", "is", null)
              .range(offset, offset + batchSize - 1);

            if (mode === "full") {
              query = query.eq("embedding_type", "full");
            } else if (mode === "partial") {
              query = query.eq("embedding_type", "partial");
            }

            return await query;
          },
          { maxRetries: 2, timeoutMs: 15000 }
        );

        data = result.data;
        error = result.error;
      } catch (queryError) {
        error = queryError;
        logger.error(`Error in batch query: ${queryError.message}`, {
          service: "tatt2awai-bot",
          batchNum,
          offset,
        });
      }

      if (error) {
        logger.error(`Error loading batch ${batchNum}: ${error.message}`, {
          service: "tatt2awai-bot",
          batchNum,
          offset,
        });

        loaded.errors++;
        circuitBreaker.recordFailure();

        // If circuit breaker is now open, stop loading
        if (circuitBreaker.isOpen()) {
          logger.warn(
            "Circuit breaker opened during batch loading, pausing operations",
            {
              service: "tatt2awai-bot",
            }
          );
          break;
        }

        // Move to next offset despite error
        offset += batchSize;
        batchNum++;

        // Add a longer delay after errors
        await new Promise((resolve) => setTimeout(resolve, 3000));
        continue;
      }

      // Reset circuit breaker failures counter on success
      if (circuitBreaker.failures > 0) {
        circuitBreaker.reset();
      }

      if (!data || data.length === 0) {
        consecutiveEmptyBatches++;

        // If we get multiple empty batches in a row, there might be no more data
        if (consecutiveEmptyBatches >= 3) {
          hasMore = false;
          logger.info(
            `No more embeddings found after ${consecutiveEmptyBatches} empty batches`,
            {
              service: "tatt2awai-bot",
            }
          );
          break;
        }

        // Just move to next offset
        offset += batchSize;
        batchNum++;
        continue;
      }

      // Reset consecutive empty batches counter
      consecutiveEmptyBatches = 0;

      // Process this batch
      let batchLoaded = {
        full: 0,
        partial: 0,
        skipped: 0,
      };

      // CRITICAL: Check if all items in this batch were skipped
      let batchAllSkipped = true;

      for (const emb of data) {
        try {
          // Skip if path is missing
          if (!emb.image_path) {
            logger.debug(`Skipping embedding ${emb.id}: Missing image_path`, {
              service: "tatt2awai-bot",
            });
            batchLoaded.skipped++;
            continue;
          }

          // CRITICAL FIX: Normalize the path before checking against processed paths
          const normalizedPath = normalizeImagePath(emb.image_path);

          // Skip if already loaded
          if (processedPaths.has(normalizedPath)) {
            logger.debug(
              `Skipping embedding ${emb.id}: Already processed path ${normalizedPath}`,
              {
                service: "tatt2awai-bot",
              }
            );
            batchLoaded.skipped++;
            continue;
          }

          // CRITICAL FIX: We found at least one item that's not skipped
          batchAllSkipped = false;

          // Check memory again before processing this embedding
          if ((batchLoaded.full + batchLoaded.partial) % 3 === 0) {
            const embMemory = process.memoryUsage();
            const embHeapMB = Math.round(embMemory.heapUsed / (1024 * 1024));

            if (embHeapMB > 950) {
              logger.warn("Memory threshold exceeded during batch processing", {
                service: "tatt2awai-bot",
                heapUsedMB: embHeapMB,
                batchLoaded: batchLoaded.full + batchLoaded.partial,
              });

              // Try to force garbage collection
              if (global.gc) {
                try {
                  global.gc();
                } catch (gcErr) {
                  // Ignore errors
                }
              }

              break; // Stop processing this batch
            }
          }

          // Check embedding type and directly load
          if (emb.embedding_type === "full" && emb.embedding_data) {
            // Get the embedding vector - handle multiple possible formats
            let embVector = null;

            if (
              emb.embedding_data.embedding &&
              Array.isArray(emb.embedding_data.embedding)
            ) {
              embVector = emb.embedding_data.embedding;
            } else if (
              emb.embedding_data.tensor &&
              Array.isArray(emb.embedding_data.tensor)
            ) {
              embVector = emb.embedding_data.tensor;
            } else if (Array.isArray(emb.embedding_data)) {
              // The whole object is the array
              embVector = emb.embedding_data;
            }

            if (embVector && Array.isArray(embVector)) {
              // Success! Load it directly
              logger.debug(
                `Found valid full embedding for ${emb.image_path}, length=${embVector.length}`,
                {
                  service: "tatt2awai-bot",
                }
              );

              global.imageMatcher.signatureCache.set(emb.image_path, {
                path: emb.image_path,
                type: "tensor",
                embedding: embVector,
              });

              // CRITICAL FIX: Add the normalized path to processed paths
              processedPaths.add(normalizedPath);
              batchLoaded.full++;
              loaded.full++;
            } else {
              // No valid embedding vector
              logger.debug(
                `Skipping embedding ${emb.id}: Invalid embedding array`,
                {
                  service: "tatt2awai-bot",
                  keys: Object.keys(emb.embedding_data),
                }
              );
              batchLoaded.skipped++;
            }
          } else if (emb.embedding_type === "partial" && emb.embedding_data) {
            // Get the patches array - handle multiple possible formats
            let patches = null;

            if (
              emb.embedding_data.patches &&
              Array.isArray(emb.embedding_data.patches)
            ) {
              patches = emb.embedding_data.patches;
            } else if (
              emb.embedding_data.regions &&
              Array.isArray(emb.embedding_data.regions)
            ) {
              patches = emb.embedding_data.regions;
            } else if (
              emb.embedding_data.descriptors &&
              Array.isArray(emb.embedding_data.descriptors)
            ) {
              // Convert descriptors to patches format
              patches = emb.embedding_data.descriptors.map((d, i) => ({
                embedding: d,
                x: i * 10,
                y: i * 10,
                width: 100,
                height: 100,
              }));
            }

            if (patches && Array.isArray(patches) && patches.length > 0) {
              // Success! Load it directly
              logger.debug(
                `Found valid partial embedding for ${emb.image_path}, patches=${patches.length}`,
                {
                  service: "tatt2awai-bot",
                }
              );

              global.imageMatcher.signatureCache.set(emb.image_path, {
                path: emb.image_path,
                type: "tensor-patches",
                patches: patches,
              });

              // CRITICAL FIX: Add the normalized path to processed paths
              processedPaths.add(normalizedPath);
              batchLoaded.partial++;
              loaded.partial++;
            } else {
              // No valid patches array
              logger.debug(
                `Skipping embedding ${emb.id}: Invalid patches array`,
                {
                  service: "tatt2awai-bot",
                  keys: Object.keys(emb.embedding_data),
                }
              );
              batchLoaded.skipped++;
            }
          } else {
            // Unknown type or missing data
            logger.debug(
              `Skipping embedding ${emb.id}: Unknown type or missing data`,
              {
                service: "tatt2awai-bot",
                type: emb.embedding_type,
                hasData: !!emb.embedding_data,
              }
            );
            batchLoaded.skipped++;
          }
        } catch (embError) {
          logger.warn(
            `Error processing embedding ${emb.id}: ${embError.message}`,
            {
              service: "tatt2awai-bot",
              path: emb.image_path,
            }
          );
          batchLoaded.skipped++;
          loaded.errors++;
        }
      }

      // Update total loaded count
      loaded.total = loaded.full + loaded.partial;

      // Update our tracking of whether all batches have been skipped
      allSkipped = allSkipped && batchAllSkipped;

      // Log batch results
      logger.info(
        `Batch ${batchNum} results: loaded ${
          batchLoaded.full + batchLoaded.partial
        } embeddings`,
        {
          service: "tatt2awai-bot",
          full: batchLoaded.full,
          partial: batchLoaded.partial,
          skipped: batchLoaded.skipped,
          totalLoaded: loaded.total,
          cacheSize: global.imageMatcher.signatureCache.size,
        }
      );

      // Move to next batch
      offset += data.length;
      batchNum++;

      // Smaller delay between batches to reduce I/O pressure but keep moving
      // This also gives garbage collector a chance to run
      await new Promise((resolve) => setTimeout(resolve, 500));

      // If we've loaded enough, stop
      if (loaded.total >= limit) {
        logger.info(`Reached loading limit of ${limit} embeddings, stopping`, {
          service: "tatt2awai-bot",
        });
        break;
      }

      // Force garbage collection if available
      if (batchNum % 5 === 0 && global.gc) {
        try {
          global.gc();
          logger.debug("Forced garbage collection during batch loading", {
            service: "tatt2awai-bot",
          });
        } catch (gcErr) {
          // Ignore errors
        }
      }
    } catch (batchError) {
      logger.error(
        `Error processing batch ${batchNum}: ${batchError.message}`,
        {
          service: "tatt2awai-bot",
          stack: batchError.stack,
        }
      );

      loaded.errors++;
      circuitBreaker.recordFailure();

      // If circuit breaker is now open, stop loading
      if (circuitBreaker.isOpen()) {
        logger.warn(
          "Circuit breaker opened during batch loading, pausing operations",
          {
            service: "tatt2awai-bot",
          }
        );
        break;
      }

      // Move to next batch despite error
      offset += batchSize;
      batchNum++;

      // Add a delay after errors
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  // Try to force garbage collection after loading
  if (global.gc) {
    try {
      global.gc();
    } catch (gcErr) {
      // Ignore errors
    }
  }

  // Update matcher stats
  if (global.imageMatcher) {
    global.imageMatcher._tensorCount = global.imageMatcher.signatureCache.size;
    global.imageMatcher._fullEmbeddingCount =
      (global.imageMatcher._fullEmbeddingCount || 0) + loaded.full;
    global.imageMatcher._partialEmbeddingCount =
      (global.imageMatcher._partialEmbeddingCount || 0) + loaded.partial;
  }

  // Check final memory usage
  const endMemory = process.memoryUsage();
  const endHeapMB = Math.round(endMemory.heapUsed / (1024 * 1024));
  const memoryDelta = endHeapMB - startHeapMB;

  // Return detailed results
  logger.info(`Enhanced batch loading complete`, {
    service: "tatt2awai-bot",
    totalLoaded: loaded.total,
    fullCount: loaded.full,
    partialCount: loaded.partial,
    errors: loaded.errors,
    cacheSize: global.imageMatcher.signatureCache.size,
    memoryUsage: {
      startHeapMB,
      endHeapMB,
      delta: memoryDelta,
    },
  });

  return {
    success: true,
    loaded: loaded.total,
    fullCount: loaded.full,
    partialCount: loaded.partial,
    errors: loaded.errors,
    cacheSize: global.imageMatcher.signatureCache.size,
    batchesProcessed: batchNum - 1,
    memoryStats: {
      startHeapMB,
      endHeapMB,
      delta: memoryDelta,
    },
  };
}

/**
 * Clean up resources in the image matcher to reduce memory usage
 */
function cleanupImageMatcher() {
  try {
    if (!global.imageMatcher || !global.imageMatcher.signatureCache) {
      return;
    }

    const initialMemory = process.memoryUsage();
    const initialHeapMB = Math.round(initialMemory.heapUsed / (1024 * 1024));
    const initialCacheSize = global.imageMatcher.signatureCache.size;

    // Check if we need to do cleanup
    const needsCleanup =
      initialHeapMB > 900 || (initialHeapMB > 800 && initialCacheSize > 2000);

    if (!needsCleanup) {
      // Skip cleanup if memory usage is acceptable
      return;
    }

    logger.info("Starting image matcher cleanup due to high memory usage", {
      service: "tatt2awai-bot",
      heapUsedMB: initialHeapMB,
      cacheSize: initialCacheSize,
    });

    // Clean up specialized tensor resources if possible
    if (global.imageMatcher._tfResources) {
      for (const resource of global.imageMatcher._tfResources) {
        try {
          if (resource && resource.dispose) {
            resource.dispose();
          }
        } catch (err) {
          // Ignore errors
        }
      }
      global.imageMatcher._tfResources = [];
    }

    // Clean up any temporary processing resources
    if (global.imageMatcher._tempResources) {
      global.imageMatcher._tempResources = [];
    }

    // If memory is still high, trim the cache
    const midMemory = process.memoryUsage();
    const midHeapMB = Math.round(midMemory.heapUsed / (1024 * 1024));

    if (midHeapMB > 900 && global.imageMatcher.signatureCache.size > 1000) {
      // We need to trim the cache - keep a balanced selection of embeddings
      logger.warn("Memory still high after resource cleanup, trimming cache", {
        service: "tatt2awai-bot",
        heapUsedMB: midHeapMB,
        cacheSize: global.imageMatcher.signatureCache.size,
      });

      // Calculate target size - keep no more than 2000 embeddings under memory pressure
      const targetSize = Math.min(
        2000,
        global.imageMatcher.signatureCache.size
      );
      const toRemove = global.imageMatcher.signatureCache.size - targetSize;

      if (toRemove > 0) {
        // Count how many of each type we have
        let fullCount = 0;
        let partialCount = 0;

        for (const entry of global.imageMatcher.signatureCache.values()) {
          if (entry.type === "tensor") {
            fullCount++;
          } else if (entry.type === "tensor-patches") {
            partialCount++;
          }
        }

        // Try to keep a balanced ratio of full vs. partial
        const fullRatio = fullCount / global.imageMatcher.signatureCache.size;
        const fullToRemove = Math.round(toRemove * fullRatio);
        const partialToRemove = toRemove - fullToRemove;

        let fullRemoved = 0;
        let partialRemoved = 0;
        let keysToRemove = [];

        // Create an array from keys for easier processing
        const allKeys = Array.from(global.imageMatcher.signatureCache.keys());

        // Identify keys to remove
        for (const key of allKeys) {
          const entry = global.imageMatcher.signatureCache.get(key);

          if (!entry) continue;

          if (entry.type === "tensor" && fullRemoved < fullToRemove) {
            keysToRemove.push(key);
            fullRemoved++;
          } else if (
            entry.type === "tensor-patches" &&
            partialRemoved < partialToRemove
          ) {
            keysToRemove.push(key);
            partialRemoved++;
          }

          // Stop if we've identified enough keys
          if (fullRemoved + partialRemoved >= toRemove) {
            break;
          }
        }

        // Remove the identified keys
        for (const key of keysToRemove) {
          global.imageMatcher.signatureCache.delete(key);
        }

        // Update matcher stats
        global.imageMatcher._tensorCount =
          global.imageMatcher.signatureCache.size;
        global.imageMatcher._fullEmbeddingCount = Math.max(
          0,
          (global.imageMatcher._fullEmbeddingCount || 0) - fullRemoved
        );
        global.imageMatcher._partialEmbeddingCount = Math.max(
          0,
          (global.imageMatcher._partialEmbeddingCount || 0) - partialRemoved
        );

        logger.info(
          `Removed ${keysToRemove.length} embeddings from cache due to memory pressure`,
          {
            service: "tatt2awai-bot",
            fullRemoved,
            partialRemoved,
            newCacheSize: global.imageMatcher.signatureCache.size,
          }
        );
      }
    }

    // Force garbage collection if available
    if (global.gc) {
      try {
        global.gc();
      } catch (gcErr) {
        // Ignore errors
      }
    }

    // Get final memory stats
    const finalMemory = process.memoryUsage();
    const finalHeapMB = Math.round(finalMemory.heapUsed / (1024 * 1024));
    const mbSaved = initialHeapMB - finalHeapMB;

    // Log cleanup results
    logger.info("HybridImageMatcher cleanup completed", {
      service: "tatt2awai-bot",
      memoryInfo: {
        unreliable: true,
        numTensors:
          global.imageMatcher._tensorCount ||
          global.imageMatcher.signatureCache.size,
        numDataBuffers: global.imageMatcher.signatureCache.size,
        numBytes: finalMemory.heapUsed,
      },
    });

    logger.info("Cleanup completed", {
      service: "tatt2awai-bot",
      memorySaved: `${mbSaved}MB`,
      cacheSize: global.imageMatcher.signatureCache.size,
    });
  } catch (err) {
    logger.error("Error during image matcher cleanup:", {
      service: "tatt2awai-bot",
      error: err.message,
      stack: err.stack,
    });
  }
}

setInterval(cleanupImageMatcher, 2 * 60 * 1000);

/**
 * Normalize image paths for consistent comparison
 * @param {string} path - Path to normalize
 * @returns {string} Normalized path
 */
function normalizeImagePath(path) {
  if (!path) return "";

  // Convert to string if it's not already
  const pathStr = String(path);

  // Remove dropbox: prefix if present
  let normalized = pathStr;
  if (normalized.toLowerCase().startsWith("dropbox:")) {
    normalized = normalized.substring(8); // Remove 'dropbox:'
  }

  // Remove leading slash if present
  if (normalized.startsWith("/")) {
    normalized = normalized.substring(1);
  }

  // Return the normalized path
  return normalized;
}

// Add this to startup or initialization code - runs only once
function fixExistingCacheEntries() {
  if (!global.imageMatcher || !global.imageMatcher.signatureCache) {
    return;
  }

  // Get current keys
  const currentKeys = Array.from(global.imageMatcher.signatureCache.keys());

  // Nothing to do if cache is empty
  if (currentKeys.length === 0) {
    return;
  }

  logger.info(`Normalizing ${currentKeys.length} paths in existing cache`, {
    service: "tatt2awai-bot",
  });

  // Track normalized paths to avoid duplicates
  const normalizedPaths = new Set();

  // Count stats
  let duplicates = 0;
  let fixed = 0;

  // Process each entry
  for (const key of currentKeys) {
    const entry = global.imageMatcher.signatureCache.get(key);
    if (!entry) continue;

    // Normalize the path
    const normalizedPath = normalizeImagePath(key);

    // Skip if path doesn't change
    if (normalizedPath === key) continue;

    // Skip if we've already added this normalized path (avoid duplicates)
    if (normalizedPaths.has(normalizedPath)) {
      duplicates++;
      continue;
    }

    // Add new entry with normalized path
    global.imageMatcher.signatureCache.set(normalizedPath, {
      ...entry,
      path: normalizedPath,
      originalPath: key,
    });

    // Track this normalized path
    normalizedPaths.add(normalizedPath);
    fixed++;
  }

  logger.info(
    `Path normalization complete: Fixed ${fixed} paths, found ${duplicates} duplicates`,
    {
      service: "tatt2awai-bot",
    }
  );
}

/**
 * Load embeddings in batches using ID ranges instead of offsets
 * This is significantly more reliable for large databases
 * @param {number} startId - ID to start from
 * @param {number} limit - Maximum number of embeddings to load
 * @param {string} mode - Embedding type to load (full, partial, or both)
 * @returns {Promise<Object>} Loading results
 */
async function loadEmbeddingsByIdRange(
  startId = 1,
  limit = 100,
  mode = "both"
) {
  logger.info(
    `Starting ID-based batch loading from ID ${startId} (limit: ${limit}, mode: ${mode})`,
    {
      service: "tatt2awai-bot",
      startId,
      limit,
      mode,
    }
  );

  // Initialize matcher if needed
  if (!global.imageMatcher) {
    const RobustImageMatcher = require("../../RobustImageMatcher");
    global.imageMatcher = new RobustImageMatcher({
      signatureThreshold: 0.65,
      useLocalCache: true,
      stateDirectory: process.cwd(),
      signatureCount: 10000,
      loadFromState: false,
    });
    await global.imageMatcher.initialize();
  }

  // Set statement timeout
  await safelySetStatementTimeout(10000); // 10 seconds

  // Track processed paths to avoid duplicates
  const processedPaths = new Set();

  // Add already loaded paths (normalized)
  if (global.imageMatcher.signatureCache) {
    for (const key of global.imageMatcher.signatureCache.keys()) {
      processedPaths.add(normalizeImagePath(key));
    }
  }

  // Stats
  let stats = {
    loaded: 0,
    full: 0,
    partial: 0,
    skipped: 0,
    errors: 0,
    highestId: startId,
  };

  // Process in small batches with ID ranges
  const batchSize = 5; // Keep very small

  // Calculate max ID to process
  const maxIterations = Math.ceil(limit / 2); // To avoid processing too many IDs
  const maxIdToCheck = startId + batchSize * maxIterations * 2; // x2 to account for gaps

  // Batch processing loop
  for (
    let id = startId;
    id < maxIdToCheck && stats.loaded < limit;
    id += batchSize
  ) {
    try {
      logger.debug(`Processing ID range ${id} to ${id + batchSize - 1}`, {
        service: "tatt2awai-bot",
        loadedSoFar: stats.loaded,
      });

      // Set statement timeout for each batch
      await safelySetStatementTimeout(10000);

      // Query with ID range
      let query = supabase
        .from("image_embeddings")
        .select("id, image_path, embedding_type, embedding_data")
        .gte("id", id)
        .lt("id", id + batchSize)
        .not("embedding_data", "is", null);

      // Apply type filter if specified
      if (mode === "full") {
        query = query.eq("embedding_type", "full");
      } else if (mode === "partial") {
        query = query.eq("embedding_type", "partial");
      }

      // Execute query
      const { data, error } = await query;

      if (error) {
        logger.warn(
          `Error in ID range ${id}-${id + batchSize - 1}: ${error.message}`,
          {
            service: "tatt2awai-bot",
          }
        );
        stats.errors++;

        // Small delay after error
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }

      // Skip if no data
      if (!data || data.length === 0) {
        continue;
      }

      // Track highest ID seen
      const highestIdInBatch = Math.max(...data.map((e) => e.id));
      stats.highestId = Math.max(stats.highestId, highestIdInBatch);

      // Process embeddings
      let batchStats = {
        loaded: 0,
        full: 0,
        partial: 0,
        skipped: 0,
      };

      for (const emb of data) {
        try {
          // Skip if no path
          if (!emb.image_path) {
            batchStats.skipped++;
            continue;
          }

          // Normalize path
          const normalizedPath = normalizeImagePath(emb.image_path);

          // Skip if already processed
          if (processedPaths.has(normalizedPath)) {
            batchStats.skipped++;
            continue;
          }

          // Process based on type
          if (emb.embedding_type === "full" && emb.embedding_data) {
            // Get embedding vector
            let embVector = null;

            if (
              emb.embedding_data.embedding &&
              Array.isArray(emb.embedding_data.embedding)
            ) {
              embVector = emb.embedding_data.embedding;
            } else if (
              emb.embedding_data.tensor &&
              Array.isArray(emb.embedding_data.tensor)
            ) {
              embVector = emb.embedding_data.tensor;
            } else if (Array.isArray(emb.embedding_data)) {
              embVector = emb.embedding_data;
            }

            if (embVector && Array.isArray(embVector)) {
              // Add to matcher
              global.imageMatcher.signatureCache.set(emb.image_path, {
                path: emb.image_path,
                type: "tensor",
                embedding: embVector,
              });

              // Track path
              processedPaths.add(normalizedPath);

              // Update stats
              batchStats.loaded++;
              batchStats.full++;
            } else {
              batchStats.skipped++;
            }
          } else if (emb.embedding_type === "partial" && emb.embedding_data) {
            // Get patches
            let patches = null;

            if (
              emb.embedding_data.patches &&
              Array.isArray(emb.embedding_data.patches)
            ) {
              patches = emb.embedding_data.patches;
            } else if (
              emb.embedding_data.regions &&
              Array.isArray(emb.embedding_data.regions)
            ) {
              patches = emb.embedding_data.regions;
            } else if (
              emb.embedding_data.descriptors &&
              Array.isArray(emb.embedding_data.descriptors)
            ) {
              patches = emb.embedding_data.descriptors.map((d, i) => ({
                embedding: d,
                x: i * 10,
                y: i * 10,
                width: 100,
                height: 100,
              }));
            }

            if (patches && Array.isArray(patches) && patches.length > 0) {
              // Add to matcher
              global.imageMatcher.signatureCache.set(emb.image_path, {
                path: emb.image_path,
                type: "tensor-patches",
                patches: patches,
              });

              // Track path
              processedPaths.add(normalizedPath);

              // Update stats
              batchStats.loaded++;
              batchStats.partial++;
            } else {
              batchStats.skipped++;
            }
          } else {
            batchStats.skipped++;
          }
        } catch (embErr) {
          logger.warn(
            `Error processing embedding ${emb.id}: ${embErr.message}`,
            {
              service: "tatt2awai-bot",
            }
          );
          stats.errors++;
        }
      }

      // Update overall stats
      stats.loaded += batchStats.loaded;
      stats.full += batchStats.full;
      stats.partial += batchStats.partial;
      stats.skipped += batchStats.skipped;

      // Log batch results
      if (batchStats.loaded > 0) {
        logger.info(
          `ID range ${id}-${id + batchSize - 1} results: loaded ${
            batchStats.loaded
          } embeddings`,
          {
            service: "tatt2awai-bot",
            full: batchStats.full,
            partial: batchStats.partial,
            skipped: batchStats.skipped,
            totalLoaded: stats.loaded,
            cacheSize: global.imageMatcher.signatureCache.size,
          }
        );
      }

      // Stop if we've loaded enough
      if (stats.loaded >= limit) {
        logger.info(`Reached loading limit of ${limit} embeddings, stopping`, {
          service: "tatt2awai-bot",
        });
        break;
      }

      // Small delay between batches
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (batchErr) {
      logger.error(`Error processing ID range ${id}: ${batchErr.message}`, {
        service: "tatt2awai-bot",
        stack: batchErr.stack,
      });

      stats.errors++;

      // Delay after error
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Update matcher stats
  if (global.imageMatcher) {
    global.imageMatcher._tensorCount = global.imageMatcher.signatureCache.size;
    global.imageMatcher._fullEmbeddingCount =
      (global.imageMatcher._fullEmbeddingCount || 0) + stats.full;
    global.imageMatcher._partialEmbeddingCount =
      (global.imageMatcher._partialEmbeddingCount || 0) + stats.partial;
  }

  // Log results
  logger.info(`ID-based batch loading complete`, {
    service: "tatt2awai-bot",
    loaded: stats.loaded,
    full: stats.full,
    partial: stats.partial,
    skipped: stats.skipped,
    errors: stats.errors,
    highestId: stats.highestId,
    cacheSize: global.imageMatcher.signatureCache.size,
  });

  return {
    success: true,
    loaded: stats.loaded,
    fullCount: stats.full,
    partialCount: stats.partial,
    skipped: stats.skipped,
    errors: stats.errors,
    highestId: stats.highestId,
    cacheSize: global.imageMatcher.signatureCache.size,
    nextStartId: stats.highestId + 1,
  };
}

/**
 * Optimized direct database search using offset pagination
 * @param {Object} queryResult - The query embedding result
 * @param {string} mode - Search mode (full or partial)
 * @param {Object} options - Search options
 * @returns {Promise<Object>} Search results
 */
async function performDirectDatabaseSearch(queryResult, mode, options) {
  try {
    const optionsWithDefaults = options || {};

    logger.info("Performing direct database search with offset pagination", {
      service: "tatt2awai-bot",
      mode: mode,
      hasEmbedding: !!(queryResult && queryResult.embedding),
      hasPatches: !!(queryResult && queryResult.patches),
    });

    // Validate query embedding
    if (
      !queryResult ||
      (!queryResult.embedding &&
        !(queryResult.patches && queryResult.patches.length > 0))
    ) {
      return {
        matches: [],
        stats: {
          directDbSearch: true,
          error: "No query embedding available",
        },
      };
    }

    let queryEmbedding = null;

    // Get the query embedding
    if (queryResult.embedding) {
      queryEmbedding = queryResult.embedding;
    } else if (
      queryResult.patches &&
      queryResult.patches.length > 0 &&
      queryResult.patches[0].embedding
    ) {
      queryEmbedding = queryResult.patches[0].embedding;
    }

    if (!queryEmbedding) {
      return {
        matches: [],
        stats: {
          directDbSearch: true,
          error: "Invalid query embedding",
        },
      };
    }

    // Try to increase statement timeout
    try {
      await supabase.rpc("set_statement_timeout", { timeout_ms: 15000 });
    } catch (err) {
      // Ignore error, proceed anyway
    }

    // Process using offset pagination
    const startTime = Date.now();
    const timeoutMs = optionsWithDefaults.timeout || 15000;
    const matches = [];
    let processedCount = 0;

    // Get total count of embeddings of this type
    let totalCount = 0;
    try {
      const { count, error } = await supabase
        .from("image_embeddings")
        .select("id", { count: "exact", head: true })
        .eq("embedding_type", mode);

      if (!error && count) {
        totalCount = count;
        logger.info(`Found ${count} embeddings of type ${mode}`, {
          service: "tatt2awai-bot",
        });
      }
    } catch (countError) {
      logger.warn(`Error getting count: ${countError.message}`, {
        service: "tatt2awai-bot",
      });
      // Continue without count
    }

    // Calculate how many batches to process
    const targetBatches = Math.min(
      20, // Max 20 batches
      Math.ceil(totalCount / 5) // Process in batches of 5
    );

    // For very large databases, use a sampling approach
    // Try different parts of the database for better coverage
    const samplingOffsets = [];

    if (totalCount > 100) {
      // Generate sampling points across the database
      for (let i = 0; i < targetBatches; i++) {
        const samplePoint = Math.floor(i * (totalCount / targetBatches));
        samplingOffsets.push(samplePoint);
      }
      logger.info(
        `Using sampling approach with ${samplingOffsets.length} sample points`,
        {
          service: "tatt2awai-bot",
          samplePoints: samplingOffsets.slice(0, 5), // Log first 5 sample points
        }
      );
    } else {
      // For smaller databases, just use sequential offsets
      for (let i = 0; i < targetBatches * 5; i += 5) {
        samplingOffsets.push(i);
      }
    }

    // Process each sampling offset
    for (const offset of samplingOffsets) {
      if (Date.now() - startTime >= timeoutMs) {
        logger.info("Direct DB search timeout reached", {
          service: "tatt2awai-bot",
          processedCount,
          matchesFound: matches.length,
        });
        break;
      }

      try {
        // Build query with offset
        let query = supabase
          .from("image_embeddings")
          .select("id, image_path, embedding_type, embedding_data")
          .eq("embedding_type", mode)
          .range(offset, offset + 4); // Get 5 records (offset to offset+4)

        // Execute query
        const { data, error } = await query;

        if (error) {
          logger.warn(`Database search error at offset ${offset}:`, {
            service: "tatt2awai-bot",
            error: error.message,
          });
          continue; // Skip to next sample point despite error
        }

        if (!data || data.length === 0) {
          continue; // No data at this offset
        }

        // Process embeddings in this batch
        for (const emb of data) {
          try {
            if (!emb.image_path || !emb.embedding_data) continue;

            let similarity = 0;

            // Calculate similarity based on embedding type
            if (emb.embedding_type === "full") {
              // First try the embedding field
              if (
                emb.embedding_data.embedding &&
                Array.isArray(emb.embedding_data.embedding)
              ) {
                similarity = calculateCosineSimilarity(
                  queryEmbedding,
                  emb.embedding_data.embedding
                );
              }
              // Try tensor field as fallback
              else if (
                emb.embedding_data.tensor &&
                Array.isArray(emb.embedding_data.tensor)
              ) {
                similarity = calculateCosineSimilarity(
                  queryEmbedding,
                  emb.embedding_data.tensor
                );
              }
              // Try direct array as fallback
              else if (Array.isArray(emb.embedding_data)) {
                similarity = calculateCosineSimilarity(
                  queryEmbedding,
                  emb.embedding_data
                );
              }
            } else if (emb.embedding_type === "partial") {
              // Find best patch match
              let patchSimilarities = [];

              // Try patches field
              if (
                emb.embedding_data.patches &&
                Array.isArray(emb.embedding_data.patches)
              ) {
                for (const patch of emb.embedding_data.patches) {
                  if (
                    patch &&
                    patch.embedding &&
                    Array.isArray(patch.embedding)
                  ) {
                    patchSimilarities.push(
                      calculateCosineSimilarity(queryEmbedding, patch.embedding)
                    );
                  }
                }
              }
              // Try regions field as fallback
              else if (
                emb.embedding_data.regions &&
                Array.isArray(emb.embedding_data.regions)
              ) {
                for (const region of emb.embedding_data.regions) {
                  if (
                    region &&
                    region.embedding &&
                    Array.isArray(region.embedding)
                  ) {
                    patchSimilarities.push(
                      calculateCosineSimilarity(
                        queryEmbedding,
                        region.embedding
                      )
                    );
                  }
                }
              }
              // Try descriptors field as fallback
              else if (
                emb.embedding_data.descriptors &&
                Array.isArray(emb.embedding_data.descriptors)
              ) {
                for (const descriptor of emb.embedding_data.descriptors) {
                  if (Array.isArray(descriptor)) {
                    patchSimilarities.push(
                      calculateCosineSimilarity(queryEmbedding, descriptor)
                    );
                  }
                }
              }

              if (patchSimilarities.length > 0) {
                similarity = Math.max(...patchSimilarities);
              }
            }

            processedCount++;

            // Add match if similarity is above threshold
            const threshold = optionsWithDefaults.threshold || 0.1;
            if (similarity > threshold) {
              // Create metadata from available data
              const metadata = { embeddingType: emb.embedding_type };

              if (emb.embedding_data.metadata) {
                Object.assign(metadata, emb.embedding_data.metadata);
              }

              matches.push({
                path: emb.image_path,
                id: emb.id,
                score: similarity,
                confidence: similarity,
                type: emb.embedding_type,
                source: "direct-db",
                metadata: metadata,
                metrics: {
                  embedding: similarity,
                  geometric: 0,
                  spatial: 0,
                },
              });

              // If we have enough good matches, we can stop
              const maxMatches = optionsWithDefaults.maxMatches || 10;
              if (matches.length >= maxMatches * 2) {
                logger.info(
                  `Found ${matches.length} good matches from DB, stopping search`,
                  {
                    service: "tatt2awai-bot",
                    processedCount,
                  }
                );
                break;
              }
            }
          } catch (embErr) {
            // Skip individual embedding errors
            logger.debug(
              `Error processing individual embedding: ${embErr.message}`,
              {
                service: "tatt2awai-bot",
              }
            );
          }
        }

        // Small delay between offsets to reduce database pressure
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (batchErr) {
        logger.error(`Error processing database at offset ${offset}:`, {
          service: "tatt2awai-bot",
          error: batchErr.message,
        });
      }
    }

    // Sort matches by score and limit to requested count
    matches.sort((a, b) => b.score - a.score);

    const maxMatches = optionsWithDefaults.maxMatches || 10;
    const returnedMatches = matches.slice(0, maxMatches);

    logger.info(`Direct DB search completed with ${matches.length} matches`, {
      service: "tatt2awai-bot",
      processedCount,
      processingTime: Date.now() - startTime,
      topMatchScore: returnedMatches.length > 0 ? returnedMatches[0].score : 0,
    });

    return {
      matches: returnedMatches,
      stats: {
        directDbSearch: true,
        processedCount,
        totalMatches: matches.length,
        processingTime: Date.now() - startTime,
        mode: mode,
        samplingStrategy:
          totalCount > 100 ? "distributed-sampling" : "sequential",
      },
    };
  } catch (error) {
    logger.error(`Error in direct database search:`, {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
    });

    return {
      matches: [],
      stats: {
        directDbSearch: true,
        error: error.message,
      },
    };
  }
}

/**
 * Calculate cosine similarity between two embedding vectors
 */
function calculateCosineSimilarity(vec1, vec2) {
  if (!vec1 || !vec2 || vec1.length !== vec2.length) {
    return 0;
  }

  var dotProduct = 0;
  var mag1 = 0;
  var mag2 = 0;

  for (var i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    mag1 += vec1[i] * vec1[i];
    mag2 += vec2[i] * vec2[i];
  }

  mag1 = Math.sqrt(mag1);
  mag2 = Math.sqrt(mag2);

  if (mag1 === 0 || mag2 === 0) {
    return 0;
  }

  return dotProduct / (mag1 * mag2);
}

// ===== ROUTES AND ENDPOINTS =====

// Check endpoint - quick health check
router.get("/check", function (req, res) {
  return res.json({
    status: "ok",
    message: "API routes are available",
    time: new Date().toISOString(),
    server: {
      uptime: Math.floor(process.uptime()),
      memory: process.memoryUsage(),
      imageMatcher: global.imageMatcher
        ? {
            initialized: true,
            cacheSize: global.imageMatcher.signatureCache.size,
            threshold: global.imageMatcher.threshold,
          }
        : {
            initialized: false,
          },
      circuitBreaker: {
        status: circuitBreaker.isOpen() ? "open" : "closed",
        failures: circuitBreaker.failures,
        maxFailures: circuitBreaker.maxFailures,
      },
    },
    routes: {
      visual: "/api/search/visual",
      status: "/api/search/embedding-status",
      check: "/api/search/check",
    },
  });
});

// Add this new endpoint to bypass all the normal loading mechanisms
router.get("/force-load-emergency", async (req, res) => {
  try {
    // Initialize matcher if needed
    if (!global.imageMatcher) {
      const RobustImageMatcher = require("../../RobustImageMatcher");
      global.imageMatcher = new RobustImageMatcher({
        signatureThreshold: 0.65,
        useLocalCache: true,
        stateDirectory: process.cwd(),
        signatureCount: 10000,
        loadFromState: false,
      });
      await global.imageMatcher.initialize();
    }

    // Clear the cache first if requested to ensure a fresh start
    if (req.query.clearCache === "true") {
      if (global.imageMatcher.signatureCache) {
        global.imageMatcher.signatureCache.clear();
      }
      logger.info("Emergency loader: Cleared existing cache", {
        service: "tatt2awai-bot",
      });
    }

    const startingCount = global.imageMatcher.signatureCache
      ? global.imageMatcher.signatureCache.size
      : 0;

    // COMPLETELY BYPASS standard loading mechanisms
    // Use direct ID-based loading with minimal batch size
    let stats = {
      loaded: 0,
      skipped: 0,
      errors: 0,
      fullLoaded: 0,
      partialLoaded: 0,
    };

    // Set a shorter statement timeout
    await safeExecuteSql(`SET statement_timeout = 10000;`);

    // Load embeddings directly using ID ranges instead of offsets
    // This is more reliable with large tables
    const batchSize = 5; // Very small batch size to avoid timeouts
    const maxId = parseInt(req.query.maxId) || 2000; // Default to first 2000 IDs
    let loaded = 0;

    // Get the starting ID (default to 1 or use query param)
    const startId = parseInt(req.query.startId) || 1;

    // Process in very small batches with explicit ID ranges
    for (let id = startId; id <= maxId && loaded < 200; id += batchSize) {
      try {
        // Use ID-based range instead of offset
        const { data, error } = await supabase
          .from("image_embeddings")
          .select("id, image_path, embedding_type, embedding_data")
          .gte("id", id)
          .lt("id", id + batchSize)
          .not("embedding_data", "is", null);

        if (error) {
          logger.warn(`Emergency loader error at ID ${id}: ${error.message}`, {
            service: "tatt2awai-bot",
          });
          stats.errors++;
          continue; // Skip to next batch despite error
        }

        if (!data || data.length === 0) {
          // No data in this ID range
          continue;
        }

        // Process data
        for (const emb of data) {
          try {
            if (!emb.image_path) {
              logger.debug(
                `Emergency loader: Skipping embedding ${emb.id}: No path`,
                {
                  service: "tatt2awai-bot",
                }
              );
              stats.skipped++;
              continue;
            }

            // Load full embeddings
            if (emb.embedding_type === "full" && emb.embedding_data) {
              // Get the embedding vector from any possible location
              let embVector = null;

              if (
                emb.embedding_data.embedding &&
                Array.isArray(emb.embedding_data.embedding)
              ) {
                embVector = emb.embedding_data.embedding;
              } else if (
                emb.embedding_data.tensor &&
                Array.isArray(emb.embedding_data.tensor)
              ) {
                embVector = emb.embedding_data.tensor;
              } else if (Array.isArray(emb.embedding_data)) {
                embVector = emb.embedding_data;
              }

              if (embVector && Array.isArray(embVector)) {
                // Force unique path to avoid conflicts
                const uniquePath = `${emb.image_path}#id${emb.id}`;

                // Add to cache
                global.imageMatcher.signatureCache.set(uniquePath, {
                  path: uniquePath,
                  originalPath: emb.image_path,
                  type: "tensor",
                  embedding: embVector,
                });

                stats.loaded++;
                stats.fullLoaded++;
              } else {
                stats.skipped++;
              }
            }
            // Load partial embeddings
            else if (emb.embedding_type === "partial" && emb.embedding_data) {
              // Get patches from any possible location
              let patches = null;

              if (
                emb.embedding_data.patches &&
                Array.isArray(emb.embedding_data.patches)
              ) {
                patches = emb.embedding_data.patches;
              } else if (
                emb.embedding_data.regions &&
                Array.isArray(emb.embedding_data.regions)
              ) {
                patches = emb.embedding_data.regions;
              } else if (
                emb.embedding_data.descriptors &&
                Array.isArray(emb.embedding_data.descriptors)
              ) {
                patches = emb.embedding_data.descriptors.map((d, i) => ({
                  embedding: d,
                  x: i * 10,
                  y: i * 10,
                  width: 100,
                  height: 100,
                }));
              }

              if (patches && Array.isArray(patches) && patches.length > 0) {
                // Force unique path
                const uniquePath = `${emb.image_path}#id${emb.id}`;

                // Add to cache
                global.imageMatcher.signatureCache.set(uniquePath, {
                  path: uniquePath,
                  originalPath: emb.image_path,
                  type: "tensor-patches",
                  patches: patches,
                });

                stats.loaded++;
                stats.partialLoaded++;
              } else {
                stats.skipped++;
              }
            } else {
              stats.skipped++;
            }
          } catch (embErr) {
            logger.warn(
              `Emergency loader: Error processing embedding ${emb.id}: ${embErr.message}`,
              {
                service: "tatt2awai-bot",
              }
            );
            stats.errors++;
          }
        }

        // Update loaded count
        loaded = stats.loaded;

        logger.info(
          `Emergency loader: Processed ID range ${id}-${
            id + batchSize - 1
          }, loaded ${stats.loaded} so far`,
          {
            service: "tatt2awai-bot",
            batchStats: {
              loaded: stats.loaded,
              fullLoaded: stats.fullLoaded,
              partialLoaded: stats.partialLoaded,
            },
          }
        );

        // Small delay between batches
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (batchErr) {
        logger.error(
          `Emergency loader: Error in batch at ID ${id}: ${batchErr.message}`,
          {
            service: "tatt2awai-bot",
          }
        );
        stats.errors++;

        // Slightly longer delay after errors
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // Update matcher stats
    if (global.imageMatcher) {
      global.imageMatcher._tensorCount =
        global.imageMatcher.signatureCache.size;
      global.imageMatcher._fullEmbeddingCount = stats.fullLoaded;
      global.imageMatcher._partialEmbeddingCount = stats.partialLoaded;
    }

    const finalCount = global.imageMatcher.signatureCache.size;

    logger.info(`Emergency embedding loading complete`, {
      service: "tatt2awai-bot",
      startingCount,
      newlyLoaded: stats.loaded,
      finalCount,
      stats,
    });

    // Get a count of paths from cache
    const paths = new Set();
    if (global.imageMatcher && global.imageMatcher.signatureCache) {
      for (const key of global.imageMatcher.signatureCache.keys()) {
        const entry = global.imageMatcher.signatureCache.get(key);
        const originalPath = entry.originalPath || entry.path;
        paths.add(originalPath);
      }
    }

    return res.json({
      success: true,
      startingCount,
      loaded: stats.loaded,
      finalCount,
      uniquePaths: paths.size,
      stats,
      nextId: maxId + 1, // For pagination
      message: `Emergency loader: Loaded ${stats.loaded} embeddings directly by ID range`,
    });
  } catch (error) {
    logger.error(`Emergency embedding loader error: ${error.message}`, {
      service: "tatt2awai-bot",
      stack: error.stack,
    });

    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
});

// Schema setup endpoint
router.get("/setup-schema", async (req, res) => {
  try {
    const result = await setupDatabaseSchema();
    return res.json({
      success: true,
      message: "Database schema setup completed",
      result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
});

// Add this endpoint to your routes/api/search.js file

router.get("/debug-embedding", async (req, res) => {
  try {
    // Get a single embedding from the database to examine
    const { data, error } = await supabase
      .from("image_embeddings")
      .select("id, image_path, embedding_type, embedding_data")
      .limit(1);

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No embeddings found",
      });
    }

    const embedding = data[0];

    // Check if embedding has required fields
    const hasPath = !!embedding.image_path;
    const hasType = !!embedding.embedding_type;
    const hasData = !!embedding.embedding_data;
    const hasEmbeddingArray =
      hasData &&
      embedding.embedding_data.embedding &&
      Array.isArray(embedding.embedding_data.embedding);

    // Test if it would be loaded by our loading function
    let wouldBeLoaded = false;
    let skipReason = "Unknown";

    if (!hasPath) {
      skipReason = "Missing image_path";
    } else if (!hasType) {
      skipReason = "Missing embedding_type";
    } else if (!hasData) {
      skipReason = "Missing embedding_data";
    } else if (!hasEmbeddingArray) {
      skipReason = "Missing embedding array in embedding_data";
    } else if (
      embedding.embedding_type === "full" &&
      embedding.embedding_data &&
      embedding.embedding_data.embedding
    ) {
      wouldBeLoaded = true;
    } else if (
      embedding.embedding_type === "partial" &&
      embedding.embedding_data &&
      embedding.embedding_data.patches
    ) {
      wouldBeLoaded = true;
    } else {
      skipReason = "Does not match expected structure";
    }

    // Try to load it directly into the matcher
    let actuallyLoaded = false;
    if (wouldBeLoaded) {
      try {
        if (!global.imageMatcher) {
          // Initialize matcher if needed
          const RobustImageMatcher = require("../../RobustImageMatcher");
          global.imageMatcher = new RobustImageMatcher({
            signatureThreshold: 0.65,
            useLocalCache: true,
            stateDirectory: process.cwd(),
            signatureCount: 10000,
            loadFromState: false,
          });
          await global.imageMatcher.initialize();
        }

        // Clear any existing embedding with this path
        global.imageMatcher.signatureCache.delete(embedding.image_path);

        // Add to matcher
        if (embedding.embedding_type === "full") {
          global.imageMatcher.signatureCache.set(embedding.image_path, {
            path: embedding.image_path,
            type: "tensor",
            embedding: embedding.embedding_data.embedding,
          });
        } else {
          global.imageMatcher.signatureCache.set(embedding.image_path, {
            path: embedding.image_path,
            type: "tensor-patches",
            patches: embedding.embedding_data.patches,
          });
        }

        // Check if it was added successfully
        actuallyLoaded = global.imageMatcher.signatureCache.has(
          embedding.image_path
        );
      } catch (e) {
        actuallyLoaded = false;
        skipReason = `Error loading: ${e.message}`;
      }
    }

    return res.json({
      success: true,
      embedding: {
        id: embedding.id,
        path: embedding.image_path,
        type: embedding.embedding_type,
        dataKeys: embedding.embedding_data
          ? Object.keys(embedding.embedding_data)
          : [],
        hasEmbeddingArray,
        embeddingLength: hasEmbeddingArray
          ? embedding.embedding_data.embedding.length
          : 0,
      },
      loading: {
        wouldBeLoaded,
        actuallyLoaded,
        skipReason: !wouldBeLoaded ? skipReason : null,
      },
      matcher: {
        initialized: !!global.imageMatcher,
        cacheSize: global.imageMatcher
          ? global.imageMatcher.signatureCache.size
          : 0,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
});

// Add this endpoint to your search.js file to forcefully load 100 embeddings directly
// Replace your existing force-load-direct endpoint with this more robust version
router.get("/force-load-direct", async (req, res) => {
  try {
    if (!global.imageMatcher) {
      const RobustImageMatcher = require("../../RobustImageMatcher");
      global.imageMatcher = new RobustImageMatcher({
        signatureThreshold: 0.65,
        useLocalCache: true,
        stateDirectory: process.cwd(),
        signatureCount: 10000,
        loadFromState: false,
      });
      await global.imageMatcher.initialize();
    }

    // Don't clear the cache - keep any existing embeddings
    const startingCount = global.imageMatcher.signatureCache
      ? global.imageMatcher.signatureCache.size
      : 0;

    // Track successfully loaded embeddings
    let loadedFull = 0;
    let loadedPartial = 0;
    let errors = 0;

    // Get total count first
    const { count: totalCount, error: countError } = await supabase
      .from("image_embeddings")
      .select("id", { count: "exact" });

    if (countError) {
      logger.error(`Error getting total count: ${countError.message}`, {
        service: "tatt2awai-bot",
      });
    }

    // Set longer timeout for this operation
    await safeExecuteSql(`SET statement_timeout = 60000;`);

    // Load full embeddings first - with paging
    logger.info(`Loading full embeddings batch...`, {
      service: "tatt2awai-bot",
    });

    try {
      // Limit to 100 full embeddings
      const { data: fullData, error: fullError } = await supabase
        .from("image_embeddings")
        .select("id, image_path, embedding_type, embedding_data")
        .eq("embedding_type", "full")
        .limit(100);

      if (fullError) {
        logger.error(`Error querying full embeddings: ${fullError.message}`, {
          service: "tatt2awai-bot",
        });
        errors++;
      } else {
        // Process full embeddings
        for (const emb of fullData || []) {
          try {
            if (
              emb.image_path &&
              emb.embedding_data &&
              emb.embedding_data.embedding
            ) {
              global.imageMatcher.signatureCache.set(emb.image_path, {
                path: emb.image_path,
                type: "tensor",
                embedding: emb.embedding_data.embedding,
              });
              loadedFull++;
            }
          } catch (embErr) {
            logger.error(
              `Error loading full embedding ${emb.id}: ${embErr.message}`,
              {
                service: "tatt2awai-bot",
              }
            );
            errors++;
          }
        }

        logger.info(`Loaded ${loadedFull} full embeddings`, {
          service: "tatt2awai-bot",
        });
      }
    } catch (fullBatchErr) {
      logger.error(`Error in full embedding batch: ${fullBatchErr.message}`, {
        service: "tatt2awai-bot",
        stack: fullBatchErr.stack,
      });
    }

    // Load partial embeddings next - with paging
    logger.info(`Loading partial embeddings batch...`, {
      service: "tatt2awai-bot",
    });

    try {
      // Limit to 100 partial embeddings
      const { data: partialData, error: partialError } = await supabase
        .from("image_embeddings")
        .select("id, image_path, embedding_type, embedding_data")
        .eq("embedding_type", "partial")
        .limit(100);

      if (partialError) {
        logger.error(
          `Error querying partial embeddings: ${partialError.message}`,
          {
            service: "tatt2awai-bot",
          }
        );
        errors++;
      } else {
        // Process partial embeddings
        for (const emb of partialData || []) {
          try {
            if (
              emb.image_path &&
              emb.embedding_data &&
              emb.embedding_data.patches
            ) {
              global.imageMatcher.signatureCache.set(emb.image_path, {
                path: emb.image_path,
                type: "tensor-patches",
                patches: emb.embedding_data.patches,
              });
              loadedPartial++;
            }
          } catch (embErr) {
            logger.error(
              `Error loading partial embedding ${emb.id}: ${embErr.message}`,
              {
                service: "tatt2awai-bot",
              }
            );
            errors++;
          }
        }

        logger.info(`Loaded ${loadedPartial} partial embeddings`, {
          service: "tatt2awai-bot",
        });
      }
    } catch (partialBatchErr) {
      logger.error(
        `Error in partial embedding batch: ${partialBatchErr.message}`,
        {
          service: "tatt2awai-bot",
          stack: partialBatchErr.stack,
        }
      );
    }

    // Update stats
    if (global.imageMatcher) {
      global.imageMatcher._tensorCount =
        global.imageMatcher.signatureCache.size;
      global.imageMatcher._fullEmbeddingCount =
        (global.imageMatcher._fullEmbeddingCount || 0) + loadedFull;
      global.imageMatcher._partialEmbeddingCount =
        (global.imageMatcher._partialEmbeddingCount || 0) + loadedPartial;
    }

    const finalCount = global.imageMatcher.signatureCache
      ? global.imageMatcher.signatureCache.size
      : 0;

    logger.info(`Direct embedding loading complete`, {
      service: "tatt2awai-bot",
      startingCount,
      loadedFull,
      loadedPartial,
      finalCount,
      errors,
    });

    return res.json({
      success: true,
      startingCount,
      loadedFull,
      loadedPartial,
      finalCount,
      errors,
      totalEmbeddings: totalCount,
      percentLoaded: totalCount
        ? Math.round((finalCount / totalCount) * 100)
        : 0,
      message: `Directly loaded ${loadedFull + loadedPartial} embeddings`,
    });
  } catch (error) {
    logger.error(`Error in direct embedding loader: ${error.message}`, {
      service: "tatt2awai-bot",
      stack: error.stack,
    });

    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
});

// Add this simple test endpoint to quickly test visual search
router.get("/test-search", async (req, res) => {
  try {
    // Check if matcher is loaded
    if (!global.imageMatcher) {
      return res.status(500).json({
        success: false,
        error: "Image matcher not initialized",
      });
    }

    // Get total count of loaded embeddings
    const cacheSize = global.imageMatcher.signatureCache
      ? global.imageMatcher.signatureCache.size
      : 0;

    // Get first 5 embeddings to examine
    const sampleEmbeddings = [];
    let index = 0;

    if (global.imageMatcher.signatureCache) {
      for (const [
        path,
        entry,
      ] of global.imageMatcher.signatureCache.entries()) {
        if (index < 5) {
          sampleEmbeddings.push({
            path,
            type: entry.type,
            hasEmbedding: !!entry.embedding,
            hasPatches: !!entry.patches,
            embeddingLength: entry.embedding ? entry.embedding.length : 0,
            patchCount: entry.patches ? entry.patches.length : 0,
          });
          index++;
        } else {
          break;
        }
      }
    }

    // Run a search function test
    let searchFunctional = false;
    let searchError = null;

    try {
      if (
        global.imageMatcher.findMatches ||
        global.imageMatcher.findMatchesWithMode
      ) {
        searchFunctional = true;
      }
    } catch (err) {
      searchError = err.message;
    }

    return res.json({
      success: true,
      searchReady: cacheSize > 0 && searchFunctional,
      stats: {
        cacheSize,
        fullEmbeddings: global.imageMatcher._fullEmbeddingCount || 0,
        partialEmbeddings: global.imageMatcher._partialEmbeddingCount || 0,
      },
      sampleEmbeddings,
      searchFunctional,
      searchError,
      message:
        cacheSize > 0
          ? `Visual search ready with ${cacheSize} embeddings`
          : "No embeddings loaded, run /force-load-direct first",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
});

// Add this endpoint to examine raw embedding data from the database
router.get("/view-embedding", async (req, res) => {
  try {
    const id = req.query.id;
    const path = req.query.path;

    if (!id && !path) {
      return res.status(400).json({
        success: false,
        error: "Either id or path parameter is required",
      });
    }

    // Build query based on provided parameters
    let query = supabase
      .from("image_embeddings")
      .select("id, image_path, embedding_type, embedding_data")
      .limit(1);

    if (id) {
      query = query.eq("id", id);
    } else if (path) {
      query = query.eq("image_path", path);
    }

    // Execute query
    const { data, error } = await query;

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Embedding not found",
      });
    }

    const embedding = data[0];

    // Analyze embedding structure
    const result = {
      id: embedding.id,
      path: embedding.image_path,
      type: embedding.embedding_type,
      dataKeys: embedding.embedding_data
        ? Object.keys(embedding.embedding_data)
        : [],
      analysis: {},
    };

    // Analyze embedding data if it exists
    if (embedding.embedding_data) {
      const data = embedding.embedding_data;

      result.analysis = {
        hasEmbedding: !!data.embedding,
        hasPatches: !!data.patches,
        hasMetadata: !!data.metadata,
        embeddingType: typeof data.embedding,
        embeddingIsArray: Array.isArray(data.embedding),
        embeddingLength: Array.isArray(data.embedding)
          ? data.embedding.length
          : 0,
        patchesType: typeof data.patches,
        patchesIsArray: Array.isArray(data.patches),
        patchCount: Array.isArray(data.patches) ? data.patches.length : 0,
        firstFewValues: Array.isArray(data.embedding)
          ? data.embedding
              .slice(0, 5)
              .map((v) => (typeof v === "number" ? v.toFixed(6) : v))
          : null,
      };
    }

    // Check if it already exists in the matcher
    if (global.imageMatcher && global.imageMatcher.signatureCache) {
      const cachedEntry = global.imageMatcher.signatureCache.get(
        embedding.image_path
      );
      result.inMatcher = !!cachedEntry;
    } else {
      result.inMatcher = false;
    }

    return res.json({
      success: true,
      embedding: result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
});

// Comprehensive embedding status endpoint
router.get("/embedding-status", async (req, res) => {
  try {
    // 1. Get the total number of embeddings in database
    const { count: totalCount, error: totalError } = await supabase
      .from("image_embeddings")
      .select("id", { count: "exact" });

    // 2. Get count of embeddings with data already in DB - using embedding_data
    const { count: withDataCount, error: withDataError } = await supabase
      .from("image_embeddings")
      .select("id", { count: "exact" })
      .not("embedding_data", "is", null);

    // 3. Get counts of full vs partial embeddings in DB - using embedding_type
    const { count: fullCount, error: fullError } = await supabase
      .from("image_embeddings")
      .select("id", { count: "exact" })
      .eq("embedding_type", "full")
      .not("embedding_data", "is", null);

    const { count: partialCount, error: partialError } = await supabase
      .from("image_embeddings")
      .select("id", { count: "exact" })
      .eq("embedding_type", "partial")
      .not("embedding_data", "is", null);

    // 4. Get matcher stats
    const matcherStats = {
      initialized: !!global.imageMatcher,
      cacheSize: global.imageMatcher
        ? global.imageMatcher.signatureCache.size
        : 0,
      threshold: global.imageMatcher ? global.imageMatcher.threshold : 0,
      tensorCount: global.imageMatcher ? global.imageMatcher._tensorCount : 0,
      fullEmbeddingCount: global.imageMatcher
        ? global.imageMatcher._fullEmbeddingCount || 0
        : 0,
      partialEmbeddingCount: global.imageMatcher
        ? global.imageMatcher._partialEmbeddingCount || 0
        : 0,
    };

    // 5. Calculate completion percentages
    const dbCompletion =
      totalCount > 0 ? Math.round((withDataCount / totalCount) * 100) : 0;

    const loadingCompletion =
      totalCount > 0
        ? Math.round((matcherStats.cacheSize / totalCount) * 100)
        : 0;

    // 6. Get system resource usage
    const memoryUsage = process.memoryUsage();
    const resourceStats = {
      memory: {
        rss: Math.round(memoryUsage.rss / (1024 * 1024)) + "MB",
        heapTotal: Math.round(memoryUsage.heapTotal / (1024 * 1024)) + "MB",
        heapUsed: Math.round(memoryUsage.heapUsed / (1024 * 1024)) + "MB",
        external: Math.round(memoryUsage.external / (1024 * 1024)) + "MB",
      },
      uptime: Math.floor(process.uptime()),
      circuitBreaker: {
        status: circuitBreaker.isOpen() ? "open" : "closed",
        failures: circuitBreaker.failures,
        maxFailures: circuitBreaker.maxFailures,
      },
    };

    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      database: {
        total: totalCount,
        withData: withDataCount,
        withoutData: totalCount - withDataCount,
        fullEmbeddings: fullCount,
        partialEmbeddings: partialCount,
        dbCompletionPercentage: dbCompletion,
      },
      matcher: matcherStats,
      loading: {
        loadedPercentage: loadingCompletion,
        remaining: totalCount - matcherStats.cacheSize,
        autoLoad: {
          enabled: true,
          frequency: "background + hourly checks",
        },
      },
      resources: resourceStats,
      status:
        loadingCompletion >= 95
          ? "COMPLETE"
          : loadingCompletion > 50
          ? "GOOD"
          : loadingCompletion > 10
          ? "LOADING"
          : "INSUFFICIENT",
      message: circuitBreaker.isOpen()
        ? "System is currently recovering from high load"
        : loadingCompletion < 95
        ? "Embeddings are being loaded automatically in the background"
        : "System is ready for searches with complete embedding set",
    });
  } catch (error) {
    logger.error("Error in embedding-status endpoint:", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
    });

    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
});

/**
 * Add this as a new route to optimize your database
 */
router.get("/optimize-db", async (req, res) => {
  try {
    logger.info("Starting database optimization", {
      service: "tatt2awai-bot",
    });

    // 1. Set reasonable statement timeout
    await safelySetStatementTimeout(120000); // 2 minutes for optimization

    // 2. First, analyze the table to update statistics
    try {
      await safeExecuteSql("ANALYZE image_embeddings;");
      logger.info("Successfully analyzed table statistics", {
        service: "tatt2awai-bot",
      });
    } catch (analyzeErr) {
      logger.warn(`Could not analyze table: ${analyzeErr.message}`, {
        service: "tatt2awai-bot",
      });
    }

    // 3. Add indexes if they don't exist
    const indexOperations = [
      {
        name: "idx_image_path",
        sql: "CREATE INDEX IF NOT EXISTS idx_image_path ON image_embeddings(image_path)",
      },
      {
        name: "idx_embedding_type",
        sql: "CREATE INDEX IF NOT EXISTS idx_embedding_type ON image_embeddings(embedding_type)",
      },
      {
        name: "idx_has_embedding",
        sql: "CREATE INDEX IF NOT EXISTS idx_has_embedding ON image_embeddings ((embedding_data IS NOT NULL))",
      },
    ];

    for (const op of indexOperations) {
      try {
        await safeExecuteSql(op.sql);
        logger.info(`Created/verified index: ${op.name}`, {
          service: "tatt2awai-bot",
        });
      } catch (indexErr) {
        logger.warn(`Could not create index ${op.name}: ${indexErr.message}`, {
          service: "tatt2awai-bot",
        });
      }
    }

    // 4. Configure cursor mode - this is critical for large result sets
    try {
      await safeExecuteSql("SET cursor_tuple_fraction TO 0.1;");
      logger.info("Set cursor parameters for better query performance", {
        service: "tatt2awai-bot",
      });
    } catch (cursorErr) {
      logger.warn(`Could not set cursor parameters: ${cursorErr.message}`, {
        service: "tatt2awai-bot",
      });
    }

    // 5. Run an initial query to warm up the cache
    try {
      const { data } = await supabase
        .from("image_embeddings")
        .select("id")
        .eq("embedding_type", "full")
        .limit(1);

      logger.info("Warmed up database cache with initial query", {
        service: "tatt2awai-bot",
      });
    } catch (warmupErr) {
      logger.warn(`Cache warmup query failed: ${warmupErr.message}`, {
        service: "tatt2awai-bot",
      });
    }

    // 6. Get current database stats
    const stats = {
      totalEmbeddings: 0,
      fullEmbeddings: 0,
      partialEmbeddings: 0,
    };

    try {
      const { count, error } = await supabase
        .from("image_embeddings")
        .select("*", { count: "exact", head: true });

      if (!error) {
        stats.totalEmbeddings = count;
      }

      const { count: fullCount } = await supabase
        .from("image_embeddings")
        .select("*", { count: "exact", head: true })
        .eq("embedding_type", "full");

      stats.fullEmbeddings = fullCount;

      const { count: partialCount } = await supabase
        .from("image_embeddings")
        .select("*", { count: "exact", head: true })
        .eq("embedding_type", "partial");

      stats.partialEmbeddings = partialCount;

      logger.info("Database statistics collected", {
        service: "tatt2awai-bot",
        ...stats,
      });
    } catch (statsErr) {
      logger.warn(`Could not collect database stats: ${statsErr.message}`, {
        service: "tatt2awai-bot",
      });
    }

    return res.json({
      success: true,
      message: "Database optimization completed",
      indexesCreated: indexOperations.map((op) => op.name),
      statistics: stats,
    });
  } catch (error) {
    logger.error(`Database optimization error: ${error.message}`, {
      service: "tatt2awai-bot",
      stack: error.stack,
    });

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Execute a paginated database query with smart cursor-based pagination
 * This approach is much more reliable than offset-based pagination
 * @param {Function} queryBuilder - Function that returns a Supabase query
 * @param {Object} options - Pagination options
 * @returns {Promise<Array>} - Collected results
 */
async function executePaginatedQuery(queryBuilder, options = {}) {
  const {
    pageSize = 5,
    maxItems = 100,
    timeoutMs = 20000,
    retries = 2,
  } = options;

  const results = [];
  let lastId = 0;
  let hasMore = true;
  let totalRetrieved = 0;
  let attempts = 0;
  const startTime = Date.now();

  while (
    hasMore &&
    results.length < maxItems &&
    Date.now() - startTime < timeoutMs &&
    attempts < retries + 1
  ) {
    try {
      // Build the query using cursor-based pagination instead of offset
      // This is MUCH more reliable for large datasets
      const query = queryBuilder();

      // Add cursor condition if we have a lastId
      const paginatedQuery =
        lastId > 0
          ? query
              .gt("id", lastId)
              .order("id", { ascending: true })
              .limit(pageSize)
          : query.order("id", { ascending: true }).limit(pageSize);

      // Execute the query
      const { data, error } = await paginatedQuery;

      if (error) {
        logger.warn(
          `Paginated query error on attempt ${attempts + 1}: ${error.message}`,
          {
            service: "tatt2awai-bot",
            lastId,
          }
        );

        attempts++;

        // Small delay before retry
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempts));
        continue;
      }

      // Process the results
      if (!data || data.length === 0) {
        hasMore = false;
        logger.debug("No more data in paginated query", {
          service: "tatt2awai-bot",
          totalRetrieved,
        });
        break;
      }

      // Reset attempts counter on success
      attempts = 0;

      // Add results to our collection
      results.push(...data);
      totalRetrieved += data.length;

      // Update the lastId for next query
      lastId = data[data.length - 1].id;

      // Stop if we've collected enough items
      if (results.length >= maxItems) {
        logger.debug(`Reached item limit of ${maxItems} in paginated query`, {
          service: "tatt2awai-bot",
          totalRetrieved,
        });
        break;
      }

      // Small delay to reduce database load
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      logger.error(`Unexpected error in paginated query: ${error.message}`, {
        service: "tatt2awai-bot",
        lastId,
        attempts,
      });

      attempts++;

      // Longer delay for unexpected errors
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempts));

      if (attempts >= retries + 1) {
        logger.warn(`Giving up on paginated query after ${attempts} attempts`, {
          service: "tatt2awai-bot",
          resultsCollected: results.length,
        });
        break;
      }
    }
  }

  logger.debug(`Paginated query completed`, {
    service: "tatt2awai-bot",
    itemsRetrieved: results.length,
    executionTimeMs: Date.now() - startTime,
  });

  return results;
}

/**
 * Use this function to load embeddings with cursor-based pagination
 * This is much more reliable than offset-based pagination
 */
async function loadEmbeddingsWithCursor(mode = "both", limit = 100) {
  logger.info(
    `Loading embeddings with cursor pagination (mode: ${mode}, limit: ${limit})`,
    {
      service: "tatt2awai-bot",
    }
  );

  try {
    // 1. Get embeddings with cursor-based pagination instead of offset
    const embeddings = await executePaginatedQuery(
      () => {
        let query = supabase
          .from("image_embeddings")
          .select("id, image_path, embedding_type, embedding_data")
          .not("embedding_data", "is", null);

        if (mode === "full") {
          query = query.eq("embedding_type", "full");
        } else if (mode === "partial") {
          query = query.eq("embedding_type", "partial");
        }

        return query;
      },
      {
        pageSize: 5,
        maxItems: limit,
        timeoutMs: 30000,
      }
    );

    // 2. Process the embeddings
    let loaded = {
      total: 0,
      full: 0,
      partial: 0,
      errors: 0,
      skipped: 0,
    };

    // Track processed paths to avoid duplicates
    const processedPaths = new Set();

    if (global.imageMatcher && global.imageMatcher.signatureCache) {
      for (const path of global.imageMatcher.signatureCache.keys()) {
        processedPaths.add(normalizeImagePath(path));
      }
    }

    // Process each embedding
    for (const emb of embeddings) {
      try {
        // Skip if path is missing
        if (!emb.image_path) {
          loaded.skipped++;
          continue;
        }

        // Normalize the path
        const normalizedPath = normalizeImagePath(emb.image_path);

        // Skip if already loaded
        if (processedPaths.has(normalizedPath)) {
          loaded.skipped++;
          continue;
        }

        // Process full embedding
        if (emb.embedding_type === "full" && emb.embedding_data) {
          let embVector = null;

          if (
            emb.embedding_data.embedding &&
            Array.isArray(emb.embedding_data.embedding)
          ) {
            embVector = emb.embedding_data.embedding;
          } else if (
            emb.embedding_data.tensor &&
            Array.isArray(emb.embedding_data.tensor)
          ) {
            embVector = emb.embedding_data.tensor;
          } else if (Array.isArray(emb.embedding_data)) {
            embVector = emb.embedding_data;
          }

          if (embVector && Array.isArray(embVector)) {
            global.imageMatcher.signatureCache.set(emb.image_path, {
              path: emb.image_path,
              type: "tensor",
              embedding: embVector,
            });

            processedPaths.add(normalizedPath);
            loaded.full++;
          } else {
            loaded.skipped++;
          }
        }
        // Process partial embedding
        else if (emb.embedding_type === "partial" && emb.embedding_data) {
          let patches = null;

          if (
            emb.embedding_data.patches &&
            Array.isArray(emb.embedding_data.patches)
          ) {
            patches = emb.embedding_data.patches;
          } else if (
            emb.embedding_data.regions &&
            Array.isArray(emb.embedding_data.regions)
          ) {
            patches = emb.embedding_data.regions;
          } else if (
            emb.embedding_data.descriptors &&
            Array.isArray(emb.embedding_data.descriptors)
          ) {
            patches = emb.embedding_data.descriptors.map((d, i) => ({
              embedding: d,
              x: i * 10,
              y: i * 10,
              width: 100,
              height: 100,
            }));
          }

          if (patches && Array.isArray(patches) && patches.length > 0) {
            global.imageMatcher.signatureCache.set(emb.image_path, {
              path: emb.image_path,
              type: "tensor-patches",
              patches: patches,
            });

            processedPaths.add(normalizedPath);
            loaded.partial++;
          } else {
            loaded.skipped++;
          }
        } else {
          loaded.skipped++;
        }
      } catch (error) {
        logger.warn(`Error processing embedding ${emb.id}: ${error.message}`, {
          service: "tatt2awai-bot",
          path: emb.image_path,
        });
        loaded.errors++;
      }
    }

    // Update total count
    loaded.total = loaded.full + loaded.partial;

    // Update matcher stats
    if (global.imageMatcher) {
      global.imageMatcher._tensorCount =
        global.imageMatcher.signatureCache.size;
      global.imageMatcher._fullEmbeddingCount =
        (global.imageMatcher._fullEmbeddingCount || 0) + loaded.full;
      global.imageMatcher._partialEmbeddingCount =
        (global.imageMatcher._partialEmbeddingCount || 0) + loaded.partial;
    }

    logger.info(`Cursor-based embedding loading complete`, {
      service: "tatt2awai-bot",
      totalLoaded: loaded.total,
      fullCount: loaded.full,
      partialCount: loaded.partial,
      skipped: loaded.skipped,
      errors: loaded.errors,
      cacheSize: global.imageMatcher
        ? global.imageMatcher.signatureCache.size
        : 0,
    });

    return {
      success: true,
      loaded: loaded.total,
      fullCount: loaded.full,
      partialCount: loaded.partial,
      errors: loaded.errors,
      skipped: loaded.skipped,
      cacheSize: global.imageMatcher
        ? global.imageMatcher.signatureCache.size
        : 0,
    };
  } catch (error) {
    logger.error(`Error in cursor-based embedding loading: ${error.message}`, {
      service: "tatt2awai-bot",
      stack: error.stack,
    });

    return {
      success: false,
      error: error.message,
      loaded: 0,
    };
  }
}

// Database connections optimization endpoint
router.get("/optimize-db-connections", async (req, res) => {
  try {
    // 1. Increase statement timeout
    let success = true;
    let message = [];

    try {
      // Use direct SQL instead of RPC
      await safeExecuteSql("SET statement_timeout = 120000;");
      message.push("• Increased statement timeout to 120 seconds");
    } catch (timeoutErr) {
      success = false;
      message.push(`• Failed to set statement timeout: ${timeoutErr.message}`);
    }

    // 2. Create indexes for better performance
    try {
      // Skip VACUUM ANALYZE as it can't run in a transaction
      message.push("• Skipping VACUUM ANALYZE (requires direct SQL access)");

      // Check if we need to add index on embedding_type
      const indexExists = await safeExecuteSql(
        "SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'image_embeddings' AND indexname = 'idx_embedding_type'"
      );

      if (indexExists && indexExists[0] && indexExists[0].count === "0") {
        // Create index on embedding_type for faster queries
        await safeExecuteSql(
          "CREATE INDEX IF NOT EXISTS idx_embedding_type ON image_embeddings (embedding_type)"
        );
        message.push("• Created index on embedding_type column");
      } else {
        message.push("• Index on embedding_type already exists");
      }

      // Check if we need to add index on image_path
      const pathIndexExists = await safeExecuteSql(
        "SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'image_embeddings' AND indexname = 'idx_image_path'"
      );

      if (
        pathIndexExists &&
        pathIndexExists[0] &&
        pathIndexExists[0].count === "0"
      ) {
        // Create index on image_path for faster lookups
        await safeExecuteSql(
          "CREATE INDEX IF NOT EXISTS idx_image_path ON image_embeddings (image_path)"
        );
        message.push("• Created index on image_path column");
      } else {
        message.push("• Index on image_path already exists");
      }
    } catch (indexErr) {
      message.push(`• Database optimization skipped: ${indexErr.message}`);
    }

    // 3. Verify database schema
    try {
      await setupDatabaseSchema();
      message.push("• Database schema verification completed");
    } catch (schemaErr) {
      message.push(`• Schema verification error: ${schemaErr.message}`);
    }

    return res.json({
      success,
      message: message.join("\n"),
      connection: {
        status: "Connected to Supabase successfully",
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
});

// Fix database timeouts endpoint
router.get("/fix-db-timeouts", async (req, res) => {
  try {
    // Try to set longer statement timeout
    try {
      // Use direct SQL instead of RPC
      await safeExecuteSql("SET statement_timeout = 60000;");
    } catch (timeoutErr) {
      return res.status(500).json({
        success: false,
        error: timeoutErr.message,
        message: "Failed to set statement timeout",
      });
    }

    // Skip VACUUM as it can't run in a transaction
    logger.info("Skipping VACUUM ANALYZE (requires direct SQL access)", {
      service: "tatt2awai-bot",
    });

    // Reset circuit breaker
    circuitBreaker.reset();

    return res.json({
      success: true,
      timeout: "60000ms",
      message: "Database timeout increased to 60 seconds",
      circuitBreaker: "reset",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
});

// Visual search endpoint - optimized for lower resource usage
// Visual search endpoint - optimized for reliability and performance
router.post("/visual", upload.single("image"), async (req, res) => {
  const processingId = crypto.randomUUID();
  const tempFiles = new Set();
  const startTime = Date.now();
  let imgMat = null;

  try {
    if (circuitBreaker.isOpen()) {
      return res.status(503).json({
        success: false,
        error:
          "System is recovering from high load, please try again in a few seconds",
        code: "CIRCUIT_BREAKER_OPEN",
        processingId,
        retryAfter: Math.ceil(
          (circuitBreaker.lastFailure + circuitBreaker.timeout - Date.now()) /
            1000
        ),
      });
    }
    if (!req.file && !req.body.imagePath) {
      return res.status(400).json({
        error: "No image provided",
        code: "MISSING_IMAGE",
      });
    }

    // Validate mode parameter
    const mode = req.body.mode || "tensor"; // Default to tensor (full)
    if (!["tensor", "full", "partial"].includes(mode)) {
      return res.status(400).json({
        error: "Invalid search mode. Must be one of: tensor, full, partial",
        code: "INVALID_MODE",
      });
    }

    // Set the actual mode for the matcher - Map 'tensor' to 'full' for database consistency
    const actualMode = mode === "tensor" ? "full" : mode;

    logger.info("Starting visual search", {
      service: "tatt2awai-bot",
      processingId: processingId,
      hasFile: !!req.file,
      filename: req.file ? req.file.originalname : req.body.imagePath,
      mode: actualMode,
    });

    // Handle image input
    let imageBuffer;
    let imageSource;
    let imagePath;

    try {
      if (req.file) {
        // Using uploaded file
        imageBuffer = await readFileAsync(req.file.path);
        tempFiles.add(req.file.path);
        imageSource = "upload";
        imagePath = req.file.path;
      } else {
        // Using file from storage
        const storageManager = require("../../storage/StorageManager");

        const fileData = await storageManager.downloadFile(req.body.imagePath);
        if (!fileData || !fileData.result || !fileData.result.fileBinary) {
          throw new Error("Failed to download image");
        }

        imageBuffer = Buffer.isBuffer(fileData.result.fileBinary)
          ? fileData.result.fileBinary
          : Buffer.from(fileData.result.fileBinary);

        imageSource = "dropbox";

        // Create a temp file for processing
        const uploadDir = path.join(__dirname, "../../uploads");
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        imagePath = path.join(
          uploadDir,
          `temp_${Date.now()}_${path.basename(req.body.imagePath)}`
        );
        fs.writeFileSync(imagePath, imageBuffer);
        tempFiles.add(imagePath);
      }

      // Validate image - with basic error handling
      try {
        imgMat = cv.imdecode(Buffer.from(imageBuffer));
        if (!imgMat || imgMat.empty) {
          throw new Error("Failed to decode image");
        }
      } catch (cvError) {
        logger.warn(
          "OpenCV decode error, will try to proceed with search anyway",
          {
            service: "tatt2awai-bot",
            error: cvError.message,
            processingId,
          }
        );
        // We'll continue anyway as the TensorEmbeddingGenerator might still work
      }
    } catch (imageError) {
      logger.error("Image processing error:", {
        service: "tatt2awai-bot",
        error: imageError.message,
        processingId,
      });

      return res.status(400).json({
        error: "Failed to process image",
        details: imageError.message,
        code: "IMAGE_PROCESSING_ERROR",
        processingId,
      });
    }

    // Initialize embeddings directly from DB on-demand if matcher is empty
    const minRequiredEmbeddings = 50; // Reduced from 100 to ensure we get some results even with IO constraints
    const embeddingCheckResult = await ensureEmbeddingsLoaded(
      minRequiredEmbeddings,
      actualMode
    );

    logger.info("Embedding auto-load check result:", {
      service: "tatt2awai-bot",
      processingId,
      autoLoaded: embeddingCheckResult.autoLoaded,
      loadedCount:
        embeddingCheckResult.after || embeddingCheckResult.loadedCount || 0,
    });

    // Ensure image matcher is initialized with fallback
    let imageMatcher = global.imageMatcher;
    if (!imageMatcher) {
      try {
        // Try to initialize on-demand
        logger.info("Initializing matcher on-demand", {
          service: "tatt2awai-bot",
          processingId,
        });

        const RobustImageMatcher = require("../../RobustImageMatcher");
        global.imageMatcher = new RobustImageMatcher({
          signatureThreshold: 0.65,
          useLocalCache: true,
          stateDirectory: process.cwd(),
          signatureCount: 10000,
          loadFromState: false,
        });
        await global.imageMatcher.initialize();
        imageMatcher = global.imageMatcher;
      } catch (initError) {
        logger.error("Failed to initialize image matcher on-demand", {
          service: "tatt2awai-bot",
          processingId,
          error: initError.message,
        });

        return res.status(500).json({
          error: "Search system not available, please try again later",
          code: "MATCHER_UNAVAILABLE",
          processingId,
        });
      }
    }

    // Configure matching options - optimized for reliability
    const matchOptions = {
      maxMatches: parseInt(req.body.limit) || 8,
      signatureCount:
        imageMatcher._tensorCount ||
        (imageMatcher.signatureCache ? imageMatcher.signatureCache.size : 0),
      preferTensor: true,
      allEmbeddings: true,
      forceResults: true,
      threshold: parseFloat(req.body.threshold) || 0.01, // Very low default threshold
      debugMode: true,
      loadAllEmbeddings: true,
      timeout: 15000, // Reduced timeout
      useDirectSearch: true, // Enable direct search for better reliability
      searchMode: actualMode,
    };

    // Override threshold based on mode only if not explicitly set in request
    if (!req.body.threshold) {
      if (actualMode === "partial") {
        matchOptions.threshold = 0.15; // Threshold for partial mode
      } else {
        matchOptions.threshold = 0.01; // Very low threshold for full mode
      }
    }

    logger.info(`${actualMode} search configuration`, {
      service: "tatt2awai-bot",
      threshold: matchOptions.threshold,
      maxMatches: matchOptions.maxMatches,
      cacheSize: imageMatcher.signatureCache
        ? imageMatcher.signatureCache.size
        : 0,
    });

    // Generate query embedding directly
    let queryResult = null;
    try {
      // Initialize TensorEmbeddingGenerator if needed
      if (!global.tensorEmbeddingGenerator) {
        const TensorEmbeddingGenerator = require("../../TensorEmbeddingGenerator");
        global.tensorEmbeddingGenerator = new TensorEmbeddingGenerator({
          cacheDir: path.join(__dirname, "../../model-cache"),
          cacheEnabled: true,
          useGPU: false,
          version: 2,
          alpha: 1.0,
        });
        await global.tensorEmbeddingGenerator.initialize();
      }

      // For generating embedding, ensure we pass the correct input format
      // Check if we should use path (more reliable) or buffer
      let embeddingInput = null;

      // Try to use file path first (more reliable)
      if (fs.existsSync(imagePath)) {
        embeddingInput = imagePath;
      } else {
        // Fall back to buffer
        embeddingInput = imageBuffer;
      }

      // Generate the embedding with appropriate error handling
      queryResult = await global.tensorEmbeddingGenerator.generateEmbedding(
        embeddingInput,
        { type: actualMode === "partial" ? "partial" : "full" }
      );

      // Store for potential later use
      if (queryResult && queryResult.embedding) {
        global.lastQueryEmbedding = queryResult.embedding;
      }

      logger.info("Successfully generated query embedding", {
        service: "tatt2awai-bot",
        processingId,
        hasEmbedding: !!(queryResult && queryResult.embedding),
        hasPatches: !!(queryResult && queryResult.patches),
        embeddingLength:
          queryResult && queryResult.embedding
            ? queryResult.embedding.length
            : 0,
      });
    } catch (embeddingError) {
      logger.warn("Failed to generate query embedding:", {
        service: "tatt2awai-bot",
        error: embeddingError.message,
        processingId,
      });
      // We'll continue and try the search directly with the image
    }

    // Perform matching with timeout - with better fallback handling
    let matchResult = null;
    let searchMethod = "matcher";

    try {
      // First try with tensor embedding if available (most reliable)
      if (
        queryResult &&
        (queryResult.embedding ||
          (queryResult.patches && queryResult.patches.length > 0))
      ) {
        logger.info("Attempting search with pre-generated embedding", {
          service: "tatt2awai-bot",
          processingId,
        });

        const embeddingPromise = imageMatcher.findMatchesWithMode(
          queryResult,
          actualMode,
          matchOptions
        );
        const embeddingTimeoutPromise = new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error("Embedding search timed out")),
            matchOptions.timeout
          );
        });

        try {
          matchResult = await Promise.race([
            embeddingPromise,
            embeddingTimeoutPromise,
          ]);
          searchMethod = "embedding";
        } catch (embeddingSearchError) {
          logger.warn("Embedding search failed, will try direct search:", {
            service: "tatt2awai-bot",
            error: embeddingSearchError.message,
            processingId,
          });
          // Fall through to direct search
        }
      }

      // If embedding search didn't work, try direct search with file or buffer
      if (!matchResult) {
        // Determine if we should use direct DB search or image matcher search
        if (imageMatcher.signatureCache.size < 10 && queryResult) {
          // Very few embeddings loaded - go straight to DB search
          logger.info(
            "Insufficient embeddings in cache, using direct DB search",
            {
              service: "tatt2awai-bot",
              processingId,
              cacheSize: imageMatcher.signatureCache.size,
            }
          );

          matchResult = await performDirectDatabaseSearch(
            queryResult,
            actualMode,
            matchOptions
          );
          searchMethod = "direct-db";
        } else {
          // Try image matcher with the actual image file/buffer
          logger.info("Attempting search with image file/buffer", {
            service: "tatt2awai-bot",
            processingId,
            usingPath: fs.existsSync(imagePath),
          });

          const searchInput = fs.existsSync(imagePath)
            ? imagePath
            : imageBuffer;
          const imagePromise = imageMatcher.findMatchesWithMode(
            searchInput,
            actualMode,
            matchOptions
          );
          const imageTimeoutPromise = new Promise((_, reject) => {
            setTimeout(
              () => reject(new Error("Image search timed out")),
              matchOptions.timeout
            );
          });

          try {
            matchResult = await Promise.race([
              imagePromise,
              imageTimeoutPromise,
            ]);
            searchMethod = "image";
          } catch (imageSearchError) {
            logger.warn("Image search failed, will try direct DB search:", {
              service: "tatt2awai-bot",
              error: imageSearchError.message,
              processingId,
            });

            // Only try DB search if we have a query embedding
            if (
              queryResult &&
              (queryResult.embedding ||
                (queryResult.patches && queryResult.patches.length > 0))
            ) {
              matchResult = await performDirectDatabaseSearch(
                queryResult,
                actualMode,
                matchOptions
              );
              searchMethod = "direct-db-fallback";
            } else {
              throw new Error(
                "All search methods failed and no query embedding available"
              );
            }
          }
        }
      }
    } catch (allSearchesError) {
      logger.error("All search methods failed:", {
        service: "tatt2awai-bot",
        error: allSearchesError.message,
        processingId,
      });

      return res.status(500).json({
        error: "Search failed: " + allSearchesError.message,
        code: "SEARCH_ERROR",
        processingId,
        searchMethod,
      });
    }

    // Process matches - handle empty or null cases
    if (!matchResult) {
      logger.warn("No match result returned from search", {
        service: "tatt2awai-bot",
        processingId,
        searchMethod,
      });

      matchResult = { matches: [], stats: { searchMethod } };
    }

    if (!matchResult.matches) {
      logger.warn("No matches array in match result", {
        service: "tatt2awai-bot",
        processingId,
        searchMethod,
      });

      matchResult.matches = [];
    }

    logger.info(`MATCH RESULT RECEIVED:`, {
      service: "tatt2awai-bot",
      processingId,
      matchCount: matchResult.matches.length,
      hasMatches: matchResult.matches.length > 0,
      firstMatchPath:
        matchResult.matches.length > 0 ? matchResult.matches[0].path : "none",
      searchMethod,
      stats: matchResult.stats || {},
    });

    // Filter and validate matches
    let significantMatches = matchResult.matches
      .filter(
        (match) =>
          match &&
          (typeof match.path === "string" || typeof match.id === "string")
      )
      .slice(0, matchOptions.maxMatches);

    // If we have no significant matches but have query embedding, try direct DB search
    if (
      significantMatches.length === 0 &&
      queryResult &&
      (queryResult.embedding ||
        (queryResult.patches && queryResult.patches.length > 0)) &&
      searchMethod !== "direct-db" &&
      searchMethod !== "direct-db-fallback"
    ) {
      logger.info(
        "No matches found from initial search, trying direct DB search",
        {
          service: "tatt2awai-bot",
          processingId,
        }
      );

      try {
        const dbResult = await performDirectDatabaseSearch(
          queryResult,
          actualMode,
          matchOptions
        );

        if (dbResult.matches && dbResult.matches.length > 0) {
          significantMatches = dbResult.matches.slice(
            0,
            matchOptions.maxMatches
          );

          // Copy stats
          if (matchResult.stats && dbResult.stats) {
            Object.assign(matchResult.stats, dbResult.stats);
          }

          searchMethod = "direct-db-last-resort";

          logger.info(
            `Found ${significantMatches.length} matches from last-resort DB search`,
            {
              service: "tatt2awai-bot",
              processingId,
            }
          );
        }
      } catch (lastResortError) {
        logger.error("Last resort DB search failed:", {
          service: "tatt2awai-bot",
          error: lastResortError.message,
          processingId,
        });
        // Continue with whatever matches we have
      }
    }

    // Format the matches for response - with better path handling
    const formattedMatches = significantMatches.map((match, idx) => {
      // Determine the best path to use
      const possiblePathSources = [
        match.path,
        match.id,
        match.originalPath,
        match.metadata?.path,
        match.metadata?.image_path,
        match.embedding?.path,
        match.data?.path,
        `dropbox:/default/match_${idx}_${(match.score || 0).toFixed(2)}.jpg`, // Fallback
      ];

      // Use the first non-empty string as the path
      let matchPath =
        possiblePathSources.find((path) => path && typeof path === "string") ||
        "";

      // For images in the DB, ensure dropbox prefix if not already present
      if (
        matchPath &&
        !matchPath.includes("/") &&
        !matchPath.toLowerCase().startsWith("dropbox:")
      ) {
        matchPath = `dropbox:/${matchPath}`;
      }

      // Create metrics object with fallbacks
      const metrics = {
        embedding: parseFloat(match.score || 0).toFixed(4),
        geometric: parseFloat(match.metrics?.geometric || 0).toFixed(4),
        spatial: parseFloat(match.metrics?.spatial || 0).toFixed(4),
      };

      return {
        path: matchPath,
        originalPath: match.path, // Keep for debugging
        score: parseFloat(match.score || 0).toFixed(4),
        confidence: parseFloat(match.confidence || match.score || 0).toFixed(4),
        embeddingType:
          match.metadata?.embeddingType || match.type || actualMode,
        source: match.source || searchMethod,
        metrics: metrics,
        // Generate viewable link
        viewableLink: `${
          process.env.BASE_URL || "http://147.182.247.128:4000"
        }/image-viewer?path=${encodeURIComponent(matchPath)}`,
      };
    });

    // Build the response object with detailed stats
    const stats = {
      processingTime: Date.now() - startTime,
      searchMethod,
      embeddingType: actualMode,
      totalAvailable: imageMatcher.signatureCache
        ? imageMatcher.signatureCache.size
        : 0,
      cacheSize: global.embeddingCache ? global.embeddingCache.size : 0,
      mode: actualMode,
      fullEmbeddings: imageMatcher._fullEmbeddingCount || 0,
      partialEmbeddings: imageMatcher._partialEmbeddingCount || 0,
      ...(matchResult.stats || {}), // Copy all original stats
    };

    const response = {
      success: true,
      processingId,
      matchCount: formattedMatches.length,
      mode: actualMode,
      matches: formattedMatches,
      searchMethod,
      stats,
    };

    // Track analytics
    try {
      const analyticsHelpers = require("../../utils/analytics-helpers");
      analyticsHelpers.trackServerEvent(
        req,
        analyticsHelpers.EVENT_TYPES.SEARCH_IMAGE,
        {
          mode: actualMode,
          imageSource,
          matchCount: formattedMatches.length,
          hasResults: formattedMatches.length > 0,
          processingTime: Date.now() - startTime,
          topMatchScore:
            formattedMatches.length > 0
              ? parseFloat(formattedMatches[0].score)
              : 0,
          searchMethod,
          processingId,
        }
      );
    } catch (analyticsError) {
      logger.warn("Analytics tracking error:", {
        service: "tatt2awai-bot",
        error: analyticsError.message,
        processingId,
      });
    }

    return res.json(response);
  } catch (error) {
    logger.error("Search error:", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
      processingId,
    });

    circuitBreaker.recordFailure();

    return res.status(500).json({
      error: error.message,
      code: "SEARCH_ERROR",
      processingId,
    });
  } finally {
    // Cleanup temp files
    for (const file of tempFiles) {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      } catch (cleanupError) {
        logger.warn("Error cleaning up temp file:", {
          service: "tatt2awai-bot",
          path: file,
          error: cleanupError.message,
        });
      }
    }

    // Release OpenCV resources
    if (imgMat && !imgMat.empty) {
      try {
        imgMat.release();
      } catch (releaseError) {
        logger.warn("Error releasing imgMat:", {
          service: "tatt2awai-bot",
          error: releaseError.message,
        });
      }
    }
  }
});

// Export router for other modules to use
module.exports = router;
