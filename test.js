const axios = require("axios");
const logger = require("../logger");
const { promisify } = require("util");
const crypto = require("crypto");
const fs = require("fs").promises;
const path = require("path");
const AsyncLock = require("async-lock");
const LRU = require("lru-cache");

/**
 * Enhanced Enterprise-Ready CRM Manager
 * Handles integration with multiple CRM providers with robust error handling,
 * rate limiting, caching, circuit breaking, and observability.
 */
class CRMManager {
  constructor(options = {}) {
    // Core properties
    this.providers = {};
    this.activeProviders = new Set();
    this.initialized = false;
    this.defaultProvider = null;

    // Enhanced properties
    this.lock = new AsyncLock();
    this.metrics = {
      requests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalResponseTime: 0,
      lastRequestTime: null,
    };

    // Response cache configuration
    this.responseCache = new LRU({
      max: options.cacheSizeMax || 1000,
      ttl: options.defaultCacheTTL || 5 * 60 * 1000, // 5 minutes default TTL
      updateAgeOnGet: true,
    });

    // Circuit breaker settings
    this.circuitBreakers = {};
    this.circuitBreakerDefaults = {
      failureThreshold: options.failureThreshold || 5,
      resetTimeout: options.resetTimeout || 30000, // 30 seconds
      halfOpenSuccessThreshold: options.halfOpenSuccessThreshold || 3,
    };

    // Rate limiting configuration
    this.rateLimits = {};
    this.rateLimitDefaults = {
      perSecond: options.requestsPerSecond || 5,
      perMinute: options.requestsPerMinute || 100,
      perHour: options.requestsPerHour || 1000,
      burstLimit: options.burstLimit || 20,
    };
  }

  /**
   * Initialize CRM integrations based on environment variables
   * with enhanced error handling and monitoring
   */
  async initialize() {
    try {
      // Start initialization timer for performance tracking
      const initStart = Date.now();

      logger.info("Initializing CRM integrations...", {
        service: "crm-manager",
      });

      // Track which providers we've attempted to initialize
      const initAttempts = {};

      // Try to restore persistent state from storage
      await this._restoreState();

      // Salesforce integration
      if (
        process.env.SALESFORCE_CLIENT_ID &&
        process.env.SALESFORCE_CLIENT_SECRET
      ) {
        initAttempts.salesforce = {
          attempted: true,
          startTime: Date.now(),
        };

        try {
          const result = await this.initializeSalesforce();
          initAttempts.salesforce.success = result;
          initAttempts.salesforce.duration =
            Date.now() - initAttempts.salesforce.startTime;
        } catch (error) {
          initAttempts.salesforce.success = false;
          initAttempts.salesforce.error = error.message;
          initAttempts.salesforce.duration =
            Date.now() - initAttempts.salesforce.startTime;
        }
      }

      // HubSpot integration
      if (process.env.HUBSPOT_API_KEY) {
        initAttempts.hubspot = {
          attempted: true,
          startTime: Date.now(),
        };

        try {
          const result = await this.initializeHubspot();
          initAttempts.hubspot.success = result;
          initAttempts.hubspot.duration =
            Date.now() - initAttempts.hubspot.startTime;
        } catch (error) {
          initAttempts.hubspot.success = false;
          initAttempts.hubspot.error = error.message;
          initAttempts.hubspot.duration =
            Date.now() - initAttempts.hubspot.startTime;
        }
      }

      // Zoho CRM integration
      if (process.env.ZOHO_CLIENT_ID && process.env.ZOHO_CLIENT_SECRET) {
        initAttempts.zoho = {
          attempted: true,
          startTime: Date.now(),
        };

        try {
          const result = await this.initializeZoho();
          initAttempts.zoho.success = result;
          initAttempts.zoho.duration = Date.now() - initAttempts.zoho.startTime;
        } catch (error) {
          initAttempts.zoho.success = false;
          initAttempts.zoho.error = error.message;
          initAttempts.zoho.duration = Date.now() - initAttempts.zoho.startTime;
        }
      }

      // Microsoft Dynamics integration
      if (
        process.env.DYNAMICS_CLIENT_ID &&
        process.env.DYNAMICS_CLIENT_SECRET
      ) {
        initAttempts.dynamics = {
          attempted: true,
          startTime: Date.now(),
        };

        try {
          const result = await this.initializeDynamics();
          initAttempts.dynamics.success = result;
          initAttempts.dynamics.duration =
            Date.now() - initAttempts.dynamics.startTime;
        } catch (error) {
          initAttempts.dynamics.success = false;
          initAttempts.dynamics.error = error.message;
          initAttempts.dynamics.duration =
            Date.now() - initAttempts.dynamics.startTime;
        }
      }

      // Zenoti integration
      if (process.env.ZENOTI_API_KEY) {
        initAttempts.zenoti = {
          attempted: true,
          startTime: Date.now(),
        };

        try {
          const result = await this.initializeZenoti();
          logger.info("Zenoti CRM provider initialization result:", {
            success: result,
          });
        } catch (error) {
          logger.error("Failed to initialize Zenoti CRM provider:", {
            error: error.message,
          });
        }

        // Set default provider if available
        if (this.activeProviders.size > 0) {
          if (
            process.env.DEFAULT_CRM_PROVIDER &&
            this.activeProviders.has(process.env.DEFAULT_CRM_PROVIDER)
          ) {
            this.defaultProvider = process.env.DEFAULT_CRM_PROVIDER;
          } else {
            this.defaultProvider = Array.from(this.activeProviders)[0];
          }
        }

        this.initialized = true;

        // Calculate overall statistics
        const successfulInits = Object.values(initAttempts).filter(
          (a) => a.success
        ).length;
        const totalInits = Object.keys(initAttempts).length;

        logger.info("CRM integrations initialized", {
          service: "crm-manager",
          activeProviders: Array.from(this.activeProviders),
          defaultProvider: this.defaultProvider,
          totalDuration: Date.now() - initStart,
        });

        // Initialize circuit breakers for each provider
        this._initializeCircuitBreakers();

        // Initialize rate limiting for each provider
        this._initializeRateLimits();

        // Schedule periodic state saving
        this._scheduleStateSaving();

        return {
          success: true,
          activeProviders: Array.from(this.activeProviders),
        };
      }
    } catch (error) {
      logger.error("Failed to initialize CRM integrations", {
        service: "crm-manager",
        error: error.message,
        stack: error.stack,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  async initializeZenoti() {
    try {
      logger.info("Initializing Zenoti integration...", {
        service: "crm-manager",
      });

      // Set provider data
      const provider = {
        name: "zenoti",
        displayName: "Zenoti",
        apiKey: process.env.ZENOTI_API_KEY,
        baseUrl: process.env.ZENOTI_BASE_URL || "https://api.zenoti.com/v1",
        initialized: true,
      };

      // Add to providers
      this.providers.zenoti = provider;
      this.activeProviders.add("zenoti");

      return true;
    } catch (error) {
      logger.error("Failed to initialize Zenoti integration", {
        service: "crm-manager",
        error: error.message,
      });

      return false;
    }
  }

  /**
   * Initialize circuit breakers for active providers
   * @private
   */
  _initializeCircuitBreakers() {
    for (const provider of this.activeProviders) {
      if (!this.circuitBreakers[provider]) {
        this.circuitBreakers[provider] = {
          status: "CLOSED", // CLOSED, OPEN, HALF_OPEN
          failureCount: 0,
          failureThreshold: this.circuitBreakerDefaults.failureThreshold,
          resetTimeout: this.circuitBreakerDefaults.resetTimeout,
          halfOpenSuccessCount: 0,
          halfOpenSuccessThreshold:
            this.circuitBreakerDefaults.halfOpenSuccessThreshold,
          lastFailureTime: null,
          lastStateChange: Date.now(),
        };
      }
    }
  }

  /**
   * Initialize rate limits for active providers
   * @private
   */
  _initializeRateLimits() {
    for (const provider of this.activeProviders) {
      if (!this.rateLimits[provider]) {
        this.rateLimits[provider] = {
          perSecond: this.rateLimitDefaults.perSecond,
          perMinute: this.rateLimitDefaults.perMinute,
          perHour: this.rateLimitDefaults.perHour,
          burstLimit: this.rateLimitDefaults.burstLimit,
          counts: {
            lastSecond: 0,
            lastMinute: 0,
            lastHour: 0,
          },
          timestamps: {
            secondStart: Date.now(),
            minuteStart: Date.now(),
            hourStart: Date.now(),
            lastRequest: Date.now(),
          },
        };
      }
    }
  }

  /**
   * Schedule periodic state saving
   * @private
   */
  _scheduleStateSaving() {
    // Save state every 5 minutes
    setInterval(() => {
      this._saveState().catch((error) => {
        logger.error("Failed to save CRM manager state", {
          service: "crm-manager",
          error: error.message,
        });
      });
    }, 5 * 60 * 1000);
  }

  /**
   * Save current state for persistence across restarts
   * @private
   */
  async _saveState() {
    try {
      const state = {
        providers: this.providers,
        activeProviders: Array.from(this.activeProviders),
        defaultProvider: this.defaultProvider,
        circuitBreakers: this.circuitBreakers,
        rateLimits: this.rateLimits,
        savedAt: new Date().toISOString(),
      };

      // Safe properties to exclude sensitive data
      const safeState = this._sanitizeStateForStorage(state);

      // Create state directory if it doesn't exist
      const stateDir = path.join(process.cwd(), "state");
      try {
        await fs.mkdir(stateDir, { recursive: true });
      } catch (error) {
        // Ignore if directory already exists
      }

      // Write state to file
      const statePath = path.join(stateDir, "crm-manager-state.json");
      await fs.writeFile(statePath, JSON.stringify(safeState, null, 2));

      logger.debug("CRM manager state saved", {
        service: "crm-manager",
        statePath,
      });

      return true;
    } catch (error) {
      logger.error("Failed to save CRM manager state", {
        service: "crm-manager",
        error: error.message,
        stack: error.stack,
      });

      return false;
    }
  }

  /**
   * Restore state from file
   * @private
   */
  async _restoreState() {
    try {
      const statePath = path.join(
        process.cwd(),
        "state",
        "crm-manager-state.json"
      );

      // Check if state file exists
      try {
        await fs.access(statePath);
      } catch (error) {
        // State file doesn't exist, no restore needed
        return false;
      }

      // Read and parse state
      const data = await fs.readFile(statePath, "utf8");
      const state = JSON.parse(data);

      // Validate state
      if (!state || !state.providers || !state.activeProviders) {
        logger.warn("Invalid CRM manager state file", {
          service: "crm-manager",
          statePath,
        });
        return false;
      }

      // Restore state
      // We don't restore provider details since they contain sensitive information
      // Just restore circuit breakers and rate limits
      if (state.circuitBreakers) {
        this.circuitBreakers = state.circuitBreakers;
      }

      if (state.rateLimits) {
        // Restore settings but reset counters
        for (const [provider, limits] of Object.entries(state.rateLimits)) {
          if (limits) {
            this.rateLimits[provider] = {
              ...limits,
              counts: {
                lastSecond: 0,
                lastMinute: 0,
                lastHour: 0,
              },
              timestamps: {
                secondStart: Date.now(),
                minuteStart: Date.now(),
                hourStart: Date.now(),
                lastRequest: Date.now(),
              },
            };
          }
        }
      }

      logger.info("CRM manager state restored", {
        service: "crm-manager",
        stateTimestamp: state.savedAt,
        providers: Object.keys(state.providers || {}),
      });

      return true;
    } catch (error) {
      logger.error("Failed to restore CRM manager state", {
        service: "crm-manager",
        error: error.message,
        stack: error.stack,
      });

      return false;
    }
  }

  /**
   * Sanitize state for storage by removing sensitive data
   * @param {Object} state The full state
   * @returns {Object} Sanitized state safe for storage
   * @private
   */
  _sanitizeStateForStorage(state) {
    const safeState = { ...state };

    // Create safe copies of providers without sensitive fields
    safeState.providers = {};

    for (const [providerName, provider] of Object.entries(state.providers)) {
      safeState.providers[providerName] = {
        name: provider.name,
        displayName: provider.displayName,
        initialized: !!provider.accessToken,
        baseUrl: provider.baseUrl,
        tokenExpiry: provider.tokenExpiration,
        // Add safe fields as needed
      };
    }

    // Keep circuit breakers and rate limits, they don't contain sensitive data

    return safeState;
  }

  /**
   * Core method to execute an operation with all enterprise features
   * @param {String} provider Provider name
   * @param {Function} operation Async function to execute
   * @param {Object} options Operation options
   * @returns {Promise<any>} Operation result
   */
  async executeProviderOperation(provider, operation, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    // Check if provider is available
    if (!provider || !this.activeProviders.has(provider)) {
      throw new Error(`Provider not available: ${provider}`);
    }

    // Generate operation ID for tracking
    const operationId = options.operationId || crypto.randomUUID();

    // Check for cache if caching is enabled
    if (options.useCache !== false && options.cacheKey) {
      const cachedResult = this.responseCache.get(options.cacheKey);
      if (cachedResult) {
        logger.debug("Cache hit", {
          service: "crm-manager",
          provider,
          operationId,
          cacheKey: options.cacheKey,
        });

        return cachedResult;
      }
    }

    // Check circuit breaker
    await this._checkCircuitBreaker(provider, operationId);

    // Apply rate limiting
    await this._enforceRateLimit(provider, operationId);

    // Track metrics
    this.metrics.requests++;
    this.metrics.lastRequestTime = Date.now();

    // Setup for retries
    let retries = 0;
    const maxRetries = options.maxRetries || 3;
    let lastError = null;

    const startTime = Date.now();

    try {
      // Use concurrency control if specified
      if (options.lockKey) {
        return await this.lock.acquire(options.lockKey, async () => {
          return await this._executeWithRetries(
            provider,
            operation,
            operationId,
            maxRetries,
            options
          );
        });
      } else {
        return await this._executeWithRetries(
          provider,
          operation,
          operationId,
          maxRetries,
          options
        );
      }
    } catch (error) {
      // Record metrics for failed operation
      this.metrics.failedRequests++;
      this.metrics.totalResponseTime += Date.now() - startTime;

      // Log detailed error
      logger.error(`Operation failed for ${provider}`, {
        service: "crm-manager",
        provider,
        operationId,
        error: error.message,
        duration: Date.now() - startTime,
        status: error.response?.status,
        statusText: error.response?.statusText,
        endpoint: error.config?.url,
        method: error.config?.method,
      });

      // Augment error with additional context
      error.provider = provider;
      error.operationId = operationId;
      error.duration = Date.now() - startTime;

      throw error;
    }
  }

  /**
   * Execute operation with retries
   * @param {String} provider Provider name
   * @param {Function} operation Async function to execute
   * @param {String} operationId Unique operation ID
   * @param {Number} maxRetries Maximum number of retries
   * @param {Object} options Operation options
   * @returns {Promise<any>} Operation result
   * @private
   */
  async _executeWithRetries(
    provider,
    operation,
    operationId,
    maxRetries,
    options
  ) {
    let retries = 0;
    let lastError = null;
    let delay = 1000; // Start with 1 second delay

    while (retries <= maxRetries) {
      try {
        const startTime = Date.now();

        // Execute the operation
        const result = await operation();

        // Record successful metrics
        const duration = Date.now() - startTime;
        this.metrics.successfulRequests++;
        this.metrics.totalResponseTime += duration;

        // Log success
        logger.debug(`Operation successful for ${provider}`, {
          service: "crm-manager",
          provider,
          operationId,
          duration,
          retries,
        });

        // Update circuit breaker on success
        this._updateCircuitBreaker(provider, true);

        // Cache result if caching is enabled
        if (options.useCache !== false && options.cacheKey) {
          const ttl = options.cacheTTL || 5 * 60 * 1000; // Default 5 minutes
          this.responseCache.set(options.cacheKey, result, { ttl });

          logger.debug("Result cached", {
            service: "crm-manager",
            provider,
            operationId,
            cacheKey: options.cacheKey,
            ttl,
          });
        }

        return result;
      } catch (error) {
        lastError = error;

        // Check if we should retry
        const isRetryable = this._isRetryableError(error);

        if (isRetryable && retries < maxRetries) {
          // Calculate delay with exponential backoff and jitter
          const jitter = Math.random() * 0.3 + 0.85; // Random between 0.85 and 1.15
          delay = Math.min(delay * Math.pow(2, retries) * jitter, 30000); // Cap at 30 seconds

          // Special handling for rate limits
          if (error.response && error.response.status === 429) {
            const retryAfter = parseInt(
              error.response.headers["retry-after"] || "60",
              10
            );
            delay = Math.max(delay, retryAfter * 1000); // Use retry-after if greater
          }

          logger.warn(`Retrying ${provider} operation after error`, {
            service: "crm-manager",
            provider,
            operationId,
            error: error.message,
            status: error.response?.status,
            retryNumber: retries + 1,
            maxRetries,
            delay: Math.round(delay),
          });

          // Update circuit breaker for this failure
          this._updateCircuitBreaker(provider, false);

          // Wait before retry
          await new Promise((resolve) => setTimeout(resolve, delay));
          retries++;
        } else {
          // Update circuit breaker for final failure
          this._updateCircuitBreaker(provider, false);
          throw error;
        }
      }
    }

    // If we get here, all retries failed
    throw lastError;
  }

  /**
   * Check if an error is retryable
   * @param {Error} error The error to check
   * @returns {Boolean} Whether the error is retryable
   * @private
   */
  _isRetryableError(error) {
    // Network errors are retryable
    if (!error.response) {
      return true;
    }

    // Status code based classification
    const status = error.response.status;

    // Retryable status codes:
    // 408 - Request Timeout
    // 409 - Conflict (may resolve on retry)
    // 429 - Too Many Requests (rate limiting)
    // 500-599 - Server errors
    return (
      status === 408 ||
      status === 409 ||
      status === 429 ||
      (status >= 500 && status < 600)
    );
  }

  /**
   * Check circuit breaker before executing operation
   * @param {String} provider Provider name
   * @param {String} operationId Unique operation ID
   * @private
   */
  async _checkCircuitBreaker(provider, operationId) {
    if (!this.circuitBreakers[provider]) {
      // Initialize circuit breaker if not exists
      this._initializeCircuitBreakers();
    }

    const circuitBreaker = this.circuitBreakers[provider];
    const now = Date.now();

    switch (circuitBreaker.status) {
      case "OPEN":
        // Check if it's time to try again
        if (
          now - circuitBreaker.lastStateChange >
          circuitBreaker.resetTimeout
        ) {
          logger.info(
            `Circuit for ${provider} transitioning from OPEN to HALF_OPEN`,
            {
              service: "crm-manager",
              provider,
              operationId,
              downtime: Math.round(
                (now - circuitBreaker.lastStateChange) / 1000
              ),
            }
          );

          circuitBreaker.status = "HALF_OPEN";
          circuitBreaker.lastStateChange = now;
          circuitBreaker.halfOpenSuccessCount = 0;
          return; // Allow request through
        }

        // Otherwise, fast-fail
        throw new Error(
          `Circuit breaker open for ${provider}. Service unavailable until ${new Date(
            circuitBreaker.lastStateChange + circuitBreaker.resetTimeout
          ).toISOString()}`
        );

      case "HALF_OPEN":
        // We're testing the waters - limited requests allowed through
        return; // Allow request through for testing

      case "CLOSED":
      default:
        // Normal operation
        return; // Allow request through
    }
  }

  /**
   * Update circuit breaker state based on operation result
   * @param {String} provider Provider name
   * @param {Boolean} success Whether the operation succeeded
   * @private
   */
  _updateCircuitBreaker(provider, success) {
    if (!this.circuitBreakers[provider]) {
      // Initialize circuit breaker if not exists
      this._initializeCircuitBreakers();
    }

    const circuitBreaker = this.circuitBreakers[provider];

    if (success) {
      if (circuitBreaker.status === "HALF_OPEN") {
        // Increment success count
        circuitBreaker.halfOpenSuccessCount++;

        // Check if we have enough successes to close the circuit
        if (
          circuitBreaker.halfOpenSuccessCount >=
          circuitBreaker.halfOpenSuccessThreshold
        ) {
          logger.info(
            `Circuit for ${provider} transitioning from HALF_OPEN to CLOSED`,
            {
              service: "crm-manager",
              provider,
              halfOpenSuccesses: circuitBreaker.halfOpenSuccessCount,
              threshold: circuitBreaker.halfOpenSuccessThreshold,
            }
          );

          circuitBreaker.status = "CLOSED";
          circuitBreaker.failureCount = 0;
          circuitBreaker.lastStateChange = Date.now();
        }
      } else if (circuitBreaker.status === "CLOSED") {
        // Reset failure count on success
        circuitBreaker.failureCount = 0;
      }
    } else {
      // Increment failure count
      circuitBreaker.failureCount++;
      circuitBreaker.lastFailureTime = Date.now();

      // Check if threshold exceeded
      if (
        circuitBreaker.status === "CLOSED" &&
        circuitBreaker.failureCount >= circuitBreaker.failureThreshold
      ) {
        // Trip the circuit breaker
        logger.warn(
          `Circuit breaker tripped for ${provider}: transitioning from CLOSED to OPEN`,
          {
            service: "crm-manager",
            provider,
            failures: circuitBreaker.failureCount,
            threshold: circuitBreaker.failureThreshold,
          }
        );

        circuitBreaker.status = "OPEN";
        circuitBreaker.lastStateChange = Date.now();
      } else if (circuitBreaker.status === "HALF_OPEN") {
        // Test request failed, back to OPEN
        logger.warn(
          `Test request failed for ${provider}: transitioning from HALF_OPEN to OPEN`,
          {
            service: "crm-manager",
            provider,
          }
        );

        circuitBreaker.status = "OPEN";
        circuitBreaker.lastStateChange = Date.now();
      }
    }
  }

  /**
   * Enforce rate limiting for a provider
   * @param {String} provider Provider name
   * @param {String} operationId Unique operation ID
   * @private
   */
  async _enforceRateLimit(provider, operationId) {
    if (!this.rateLimits[provider]) {
      // Initialize rate limits if not exists
      this._initializeRateLimits();
    }

    const rateLimits = this.rateLimits[provider];
    const now = Date.now();

    // Reset counters if periods have elapsed
    if (now - rateLimits.timestamps.secondStart > 1000) {
      rateLimits.counts.lastSecond = 0;
      rateLimits.timestamps.secondStart = now;
    }

    if (now - rateLimits.timestamps.minuteStart > 60000) {
      rateLimits.counts.lastMinute = 0;
      rateLimits.timestamps.minuteStart = now;
    }

    if (now - rateLimits.timestamps.hourStart > 3600000) {
      rateLimits.counts.lastHour = 0;
      rateLimits.timestamps.hourStart = now;
    }

    // Check if we're at the burst limit
    const minTimeBetweenRequests = 1000 / rateLimits.burstLimit;
    const timeSinceLastRequest = now - rateLimits.timestamps.lastRequest;

    if (timeSinceLastRequest < minTimeBetweenRequests) {
      const backoffDelay = minTimeBetweenRequests - timeSinceLastRequest;

      logger.debug(`Rate limiting enforced for ${provider}`, {
        service: "crm-manager",
        provider,
        operationId,
        delay: Math.round(backoffDelay),
        burstLimit: rateLimits.burstLimit,
      });

      await new Promise((resolve) => setTimeout(resolve, backoffDelay));

      // After waiting, recursively call to ensure we're still within limits
      return this._enforceRateLimit(provider, operationId);
    }

    // Check if we're approaching limits and need to throttle
    let delayNeeded = 0;

    // Per-second limit check (most aggressive throttling)
    if (rateLimits.counts.lastSecond >= rateLimits.perSecond) {
      delayNeeded = Math.max(
        delayNeeded,
        rateLimits.timestamps.secondStart + 1000 - now
      );
    }

    // Per-minute limit check (medium throttling)
    if (rateLimits.counts.lastMinute >= rateLimits.perMinute) {
      delayNeeded = Math.max(
        delayNeeded,
        rateLimits.timestamps.minuteStart + 60000 - now
      );
    }

    // Per-hour limit check (last resort throttling)
    if (rateLimits.counts.lastHour >= rateLimits.perHour) {
      delayNeeded = Math.max(
        delayNeeded,
        rateLimits.timestamps.hourStart + 3600000 - now
      );
    }

    // If we need to delay, wait the required time
    if (delayNeeded > 0) {
      logger.info(
        `Rate limit throttling for ${provider}: delaying request by ${delayNeeded}ms`,
        {
          service: "crm-manager",
          provider,
          operationId,
          limits: {
            perSecond: `${rateLimits.counts.lastSecond}/${rateLimits.perSecond}`,
            perMinute: `${rateLimits.counts.lastMinute}/${rateLimits.perMinute}`,
            perHour: `${rateLimits.counts.lastHour}/${rateLimits.perHour}`,
          },
        }
      );

      await new Promise((resolve) => setTimeout(resolve, delayNeeded));

      // After waiting, recursively call to verify we're good to go
      return this._enforceRateLimit(provider, operationId);
    }

    // If we reach here, we're clear to make the request
    // Increment counters
    rateLimits.counts.lastSecond++;
    rateLimits.counts.lastMinute++;
    rateLimits.counts.lastHour++;
    rateLimits.timestamps.lastRequest = now;

    return true;
  }

  /**
   * Cache management with TTL
   * @param {String} key Cache key
   * @param {Function} fetchFn Function to fetch data if not in cache
   * @param {Object} options Cache options
   * @returns {Promise<any>} Cached or fresh data
   */
  async getCached(key, fetchFn, options = {}) {
    // Check if caching is disabled
    if (options.useCache === false) {
      return fetchFn();
    }

    // Check if we have valid cached data
    const cachedItem = this.responseCache.get(key);
    if (cachedItem) {
      logger.debug("Cache hit", {
        service: "crm-manager",
        key,
      });

      return cachedItem;
    }

    // Fetch fresh data
    logger.debug("Cache miss", {
      service: "crm-manager",
      key,
    });

    const data = await fetchFn();

    // Store in cache with expiry
    const ttl = options.ttl || 5 * 60 * 1000; // Default 5 minutes
    this.responseCache.set(key, data, { ttl });

    return data;
  }

  /**
   * Clear cache entries by prefix
   * @param {String} keyPrefix Prefix to match
   * @returns {Number} Number of entries cleared
   */
  clearCacheByPrefix(keyPrefix) {
    let cleared = 0;

    // Create array of matching keys
    const keysToDelete = [];
    this.responseCache.forEach((value, key) => {
      if (key.startsWith(keyPrefix)) {
        keysToDelete.push(key);
        cleared++;
      }
    });

    // Delete matching keys
    keysToDelete.forEach((key) => {
      this.responseCache.delete(key);
    });

    logger.info(`Cleared ${cleared} cache entries with prefix: ${keyPrefix}`, {
      service: "crm-manager",
    });

    return cleared;
  }

  /**
   * Get metrics for monitoring
   * @returns {Object} Metrics for monitoring
   */
  getMetrics() {
    const averageResponseTime = this.metrics.successfulRequests
      ? this.metrics.totalResponseTime / this.metrics.successfulRequests
      : 0;

    return {
      requests: this.metrics.requests,
      successfulRequests: this.metrics.successfulRequests,
      failedRequests: this.metrics.failedRequests,
      successRate: this.metrics.requests
        ? (this.metrics.successfulRequests / this.metrics.requests) * 100
        : 0,
      averageResponseTime,
      lastRequestTime: this.metrics.lastRequestTime,
      cacheSize: this.responseCache.size,
      providers: Array.from(this.activeProviders).map((provider) => ({
        name: provider,
        circuitBreakerStatus:
          this.circuitBreakers[provider]?.status || "UNKNOWN",
        failureCount: this.circuitBreakers[provider]?.failureCount || 0,
        rateLimits: {
          perSecond: `${this.rateLimits[provider]?.counts?.lastSecond || 0}/${
            this.rateLimits[provider]?.perSecond || 0
          }`,
          perMinute: `${this.rateLimits[provider]?.counts?.lastMinute || 0}/${
            this.rateLimits[provider]?.perMinute || 0
          }`,
          perHour: `${this.rateLimits[provider]?.counts?.lastHour || 0}/${
            this.rateLimits[provider]?.perHour || 0
          }`,
        },
      })),
    };
  }

  /**
   * Get Prometheus metrics for monitoring
   * @returns {String} Metrics in Prometheus format
   */
  getPrometheusMetrics() {
    const now = Date.now();
    const metrics = [];

    // Add basic metrics
    metrics.push("# HELP crm_manager_requests_total Total number of requests");
    metrics.push("# TYPE crm_manager_requests_total counter");
    metrics.push(`crm_manager_requests_total ${this.metrics.requests}`);

    metrics.push(
      "# HELP crm_manager_requests_successful_total Total number of successful requests"
    );
    metrics.push("# TYPE crm_manager_requests_successful_total counter");
    metrics.push(
      `crm_manager_requests_successful_total ${this.metrics.successfulRequests}`
    );

    metrics.push(
      "# HELP crm_manager_requests_failed_total Total number of failed requests"
    );
    metrics.push("# TYPE crm_manager_requests_failed_total counter");
    metrics.push(
      `crm_manager_requests_failed_total ${this.metrics.failedRequests}`
    );

    metrics.push(
      "# HELP crm_manager_average_response_time_ms Average response time in milliseconds"
    );
    metrics.push("# TYPE crm_manager_average_response_time_ms gauge");
    metrics.push(
      `crm_manager_average_response_time_ms ${
        this.metrics.successfulRequests
          ? this.metrics.totalResponseTime / this.metrics.successfulRequests
          : 0
      }`
    );

    metrics.push("# HELP crm_manager_cache_size Number of items in cache");
    metrics.push("# TYPE crm_manager_cache_size gauge");
    metrics.push(`crm_manager_cache_size ${this.responseCache.size}`);

    // Add provider-specific metrics
    for (const provider of this.activeProviders) {
      const circuitBreaker = this.circuitBreakers[provider] || {};
      const rateLimits = this.rateLimits[provider] || {};

      metrics.push(
        `# HELP crm_manager_circuit_state{provider="${provider}"} Circuit breaker state (0=closed, 1=half-open, 2=open)`
      );
      metrics.push(`# TYPE crm_manager_circuit_state gauge`);
      metrics.push(
        `crm_manager_circuit_state{provider="${provider}"} ${
          circuitBreaker.status === "CLOSED"
            ? 0
            : circuitBreaker.status === "HALF_OPEN"
            ? 1
            : 2
        }`
      );

      metrics.push(
        `# HELP crm_manager_circuit_failure_count{provider="${provider}"} Circuit breaker failure count`
      );
      metrics.push(`# TYPE crm_manager_circuit_failure_count gauge`);
      metrics.push(
        `crm_manager_circuit_failure_count{provider="${provider}"} ${
          circuitBreaker.failureCount || 0
        }`
      );

      metrics.push(
        `# HELP crm_manager_rate_limit_per_second{provider="${provider}"} Requests in the last second`
      );
      metrics.push(`# TYPE crm_manager_rate_limit_per_second gauge`);
      metrics.push(
        `crm_manager_rate_limit_per_second{provider="${provider}"} ${
          rateLimits.counts?.lastSecond || 0
        }`
      );

      metrics.push(
        `# HELP crm_manager_rate_limit_per_minute{provider="${provider}"} Requests in the last minute`
      );
      metrics.push(`# TYPE crm_manager_rate_limit_per_minute gauge`);
      metrics.push(
        `crm_manager_rate_limit_per_minute{provider="${provider}"} ${
          rateLimits.counts?.lastMinute || 0
        }`
      );
    }

    return metrics.join("\n");
  }

  /**
   * Enhanced Salesforce integration initialization with security features
   * Replaced with more robust implementation
   */
  async initializeSalesforce() {
    try {
      // Start timing for performance tracking
      const startTime = Date.now();

      // Create Salesforce provider configuration
      const provider = {
        name: "salesforce",
        displayName: "Salesforce",
        clientId: process.env.SALESFORCE_CLIENT_ID,
        clientSecret: process.env.SALESFORCE_CLIENT_SECRET,
        redirectUri: process.env.SALESFORCE_REDIRECT_URI,
        instanceUrl: process.env.SALESFORCE_INSTANCE_URL,
        accessToken: null,
        refreshToken: process.env.SALESFORCE_REFRESH_TOKEN || null,
        tokenExpiry: null,
        baseUrl: null,
        // Enhanced configuration
        securityLevel: process.env.SALESFORCE_SECURITY_LEVEL || "standard",
        maxRetries: parseInt(process.env.SALESFORCE_MAX_RETRIES || "3", 10),
        rateLimits: {
          perDay: 100000, // Default Salesforce API limit
          remaining: 100000,
          resetTime: null,
        },
        lastActivityTime: Date.now(),
        metadata: {
          createdAt: new Date().toISOString(),
          environment: process.env.NODE_ENV || "development",
        },
      };

      // Try to refresh token if we have refresh token
      if (provider.refreshToken) {
        await this.refreshSalesforceToken(provider);
      }

      // Validate connection with actual API call
      if (provider.accessToken) {
        try {
          // Make a basic API call to verify connection
          const endpoint = `${provider.baseUrl}/sobjects`;
          const response = await axios.get(endpoint, {
            headers: {
              Authorization: `Bearer ${provider.accessToken}`,
              "Content-Type": "application/json",
            },
          });

          // Store API version information
          provider.apiVersion = response.data?.maxApiVersion || "v54.0";
          provider.objectTypes =
            response.data?.sobjects?.map((obj) => obj.name) || [];

          logger.info("Salesforce connection validated", {
            service: "crm-manager",
            provider: "salesforce",
            apiVersion: provider.apiVersion,
            objectCount: provider.objectTypes.length,
            validationTime: Date.now() - startTime,
          });
        } catch (validationError) {
          logger.warn("Salesforce connection validation failed", {
            service: "crm-manager",
            provider: "salesforce",
            error: validationError.message,
            status: validationError.response?.status,
          });

          // If validation fails with auth error, try one more token refresh
          if (validationError.response?.status === 401) {
            await this.refreshSalesforceToken(provider);
          }
        }
      }

      // Store provider in active providers if token was obtained
      if (provider.accessToken) {
        this.providers["salesforce"] = provider;
        this.activeProviders.add("salesforce");

        logger.info("Salesforce integration initialized", {
          service: "crm-manager",
          provider: "salesforce",
          hasToken: !!provider.accessToken,
          expiresAt: provider.tokenExpiry
            ? new Date(provider.tokenExpiry).toISOString()
            : "unknown",
          initializationTime: Date.now() - startTime,
        });

        return true;
      } else {
        logger.error(
          "Failed to initialize Salesforce - no valid token obtained",
          {
            service: "crm-manager",
            provider: "salesforce",
          }
        );

        return false;
      }
    } catch (error) {
      logger.error("Failed to initialize Salesforce integration", {
        service: "crm-manager",
        error: error.message,
        stack: error.stack,
      });

      return false;
    }
  }

  /**
   * Get contacts from CRM with enterprise features
   */
  async getContacts(providerName = null, options = {}) {
    try {
      // Generate operation ID for tracking
      const operationId = crypto.randomUUID();

      // Cache key for this operation
      const cacheKey = `getContacts:${
        providerName || this.defaultProvider
      }:${JSON.stringify(options)}`;

      // Execute with all enterprise features
      return await this.executeProviderOperation(
        providerName || this.defaultProvider,
        async () => {
          // Get provider-specific implementation
          switch (providerName || this.defaultProvider) {
            case "salesforce":
              return await this.getSalesforceContacts(options);
            case "hubspot":
              return await this.getHubspotContacts(options);
            case "zoho":
              return await this.getZohoContacts(options);
            case "dynamics":
              return await this.getDynamicsContacts(options);
            case "zenoti":
              return await this.getZenotiCustomers(options);
            default:
              throw new Error(
                `Provider implementation not found: ${
                  providerName || this.defaultProvider
                }`
              );
          }
        },
        {
          operationId,
          useCache: options.useCache !== false,
          cacheKey: options.useCache !== false ? cacheKey : null,
          cacheTTL: options.cacheTTL || 5 * 60 * 1000, // Default 5 minutes
          maxRetries: options.maxRetries || 3,
        }
      );
    } catch (error) {
      logger.error("Error getting contacts", {
        service: "crm-manager",
        provider: providerName || this.defaultProvider,
        error: error.message,
        stack: error.stack,
        options,
      });

      throw error;
    }
  }

  /**
   * Create a contact in CRM with enterprise features
   */
  async createContact(contact, providerName = null) {
    try {
      // Generate operation ID for tracking
      const operationId = crypto.randomUUID();

      // Execute with all enterprise features but no caching for write operations
      return await this.executeProviderOperation(
        providerName || this.defaultProvider,
        async () => {
          // Validate contact data
          if (!contact.email && !contact.phone) {
            throw new Error(
              "Either email or phone is required for contact creation"
            );
          }

          // Get provider-specific implementation
          switch (providerName || this.defaultProvider) {
            case "salesforce":
              return await this.createSalesforceContact(contact);
            case "hubspot":
              return await this.createHubspotContact(contact);
            case "zoho":
              return await this.createZohoContact(contact);
            case "dynamics":
              return await this.createDynamicsContact(contact);
            case "zenoti":
              return await this.createZenotiCustomer(contact);
            default:
              throw new Error(
                `Provider implementation not found: ${
                  providerName || this.defaultProvider
                }`
              );
          }
        },
        {
          operationId,
          useCache: false, // Write operations should never be cached
          maxRetries: 2, // Fewer retries for write operations
          // Use a lock for write operations to avoid race conditions
          lockKey: `createContact:${providerName || this.defaultProvider}:${
            contact.email || contact.phone
          }`,
        }
      );
    } catch (error) {
      logger.error("Error creating contact", {
        service: "crm-manager",
        provider: providerName || this.defaultProvider,
        error: error.message,
        stack: error.stack,
        contactEmail: contact.email,
        contactPhone: contact.phone,
      });

      throw error;
    }
  }

  /**
   * Standardize and validate contact data
   * @param {Object} contact Raw contact data
   * @param {String} provider Provider name
   * @returns {Object} Standardized contact data
   */
  standardizeContactData(contact, provider) {
    // Create deep copy to avoid modifying original
    const cleanContact = JSON.parse(JSON.stringify(contact));

    // Ensure basic fields exist
    if (!cleanContact.email && !cleanContact.phone) {
      throw new Error("Contact must have either email or phone");
    }

    // Handle name fields consistently
    if (
      cleanContact.name &&
      !cleanContact.firstName &&
      !cleanContact.lastName
    ) {
      // Split full name into first and last
      const nameParts = cleanContact.name.split(" ");
      if (nameParts.length > 1) {
        cleanContact.firstName = nameParts[0];
        cleanContact.lastName = nameParts.slice(1).join(" ");
      } else {
        cleanContact.firstName = "";
        cleanContact.lastName = cleanContact.name;
      }
    }

    // Ensure lastName exists (required by many CRMs)
    if (!cleanContact.lastName) {
      cleanContact.lastName =
        cleanContact.lastName || cleanContact.name || "Unknown";
    }

    // Format phone number consistently if present
    if (cleanContact.phone) {
      cleanContact.phone = this._formatPhoneNumber(cleanContact.phone);
    }

    // Format email consistently if present
    if (cleanContact.email) {
      cleanContact.email = cleanContact.email.trim().toLowerCase();
    }

    // Add metadata
    cleanContact._meta = {
      standardizedAt: new Date().toISOString(),
      standardizedFor: provider,
      originalFields: Object.keys(contact),
    };

    return cleanContact;
  }

  /**
   * Format phone number consistently
   * @param {String} phone Phone number to format
   * @returns {String} Formatted phone number
   * @private
   */
  _formatPhoneNumber(phone) {
    if (!phone) return phone;

    // Remove all non-numeric characters
    const digits = phone.replace(/\D/g, "");

    // Format based on length
    if (digits.length === 10) {
      return `+1${digits}`; // Assume US format
    } else if (digits.length > 10) {
      return `+${digits}`; // Assume international format
    }

    // Return original if we can't determine format
    return phone;
  }

  /**
   * Enhanced health check for all providers
   * @returns {Object} Health status for all providers
   */
  async checkAllProvidersHealth() {
    const results = {};

    for (const provider of this.activeProviders) {
      try {
        const startTime = Date.now();
        let status = "unknown";
        let details = {};

        switch (provider) {
          case "salesforce":
            status = await this._checkSalesforceHealth();
            break;
          case "hubspot":
            status = await this._checkHubspotHealth();
            break;
          case "zoho":
            status = await this._checkZohoHealth();
            break;
          case "dynamics":
            status = await this._checkDynamicsHealth();
            break;
          case "zenoti":
            status = await this._checkZenotiHealth();
            break;
        }

        // Record result
        results[provider] = {
          status,
          responseTime: Date.now() - startTime,
          circuitBreakerStatus:
            this.circuitBreakers[provider]?.status || "UNKNOWN",
          tokenStatus: this.providers[provider]?.accessToken
            ? "valid"
            : "invalid",
          tokenExpiry: this.providers[provider]?.tokenExpiry
            ? new Date(this.providers[provider].tokenExpiry).toISOString()
            : "unknown",
        };
      } catch (error) {
        results[provider] = {
          status: "error",
          error: error.message,
          timestamp: new Date().toISOString(),
        };
      }
    }

    return {
      timestamp: new Date().toISOString(),
      providers: results,
      overallStatus: Object.values(results).every((r) => r.status === "healthy")
        ? "healthy"
        : "degraded",
    };
  }

  /**
   * Check Salesforce health
   * @returns {String} Health status
   * @private
   */
  async _checkSalesforceHealth() {
    try {
      const provider = this.providers["salesforce"];

      if (!provider || !provider.accessToken) {
        return "inactive";
      }

      // Check if token is still valid
      if (provider.tokenExpiry && Date.now() > provider.tokenExpiry) {
        await this.refreshSalesforceToken(provider);
      }

      // Make a simple API call to check health
      const endpoint = `${provider.baseUrl}/limits`;
      const response = await axios.get(endpoint, {
        headers: {
          Authorization: `Bearer ${provider.accessToken}`,
          "Content-Type": "application/json",
        },
      });

      // Update rate limits from response
      if (response.data && response.data.DailyApiRequests) {
        provider.rateLimits.perDay = response.data.DailyApiRequests.Max;
        provider.rateLimits.remaining =
          response.data.DailyApiRequests.Remaining;
      }

      return "healthy";
    } catch (error) {
      logger.error("Salesforce health check failed", {
        service: "crm-manager",
        error: error.message,
        status: error.response?.status,
      });

      return "unhealthy";
    }
  }

  /**
   * Rotate credentials for all providers
   * Use this periodically for enhanced security
   * @returns {Object} Results of rotation attempts
   */
  async rotateAllCredentials() {
    const results = {};

    for (const provider of this.activeProviders) {
      try {
        const startTime = Date.now();
        let success = false;

        switch (provider) {
          case "salesforce":
            success = await this._rotateSalesforceCredentials();
            break;
          case "hubspot":
            success = await this._rotateHubspotCredentials();
            break;
          case "zoho":
            success = await this._rotateZohoCredentials();
            break;
          case "dynamics":
            success = await this._rotateDynamicsCredentials();
            break;
          case "zenoti":
            success = await this._rotateZenotiCredentials();
            break;
        }

        results[provider] = {
          success,
          duration: Date.now() - startTime,
        };
      } catch (error) {
        results[provider] = {
          success: false,
          error: error.message,
        };
      }
    }

    logger.info("Credential rotation completed", {
      service: "crm-manager",
      results,
    });

    return {
      timestamp: new Date().toISOString(),
      results,
    };
  }

  /**
   * Export CRM data for backup/analysis
   * @param {String} provider Provider name
   * @param {Object} options Export options
   * @returns {Promise<Object>} Export result
   */
  async exportData(provider, options = {}) {
    if (!this.activeProviders.has(provider)) {
      throw new Error(`Provider not available: ${provider}`);
    }

    const exportId = crypto.randomUUID();
    const startTime = Date.now();

    try {
      logger.info(`Starting data export for ${provider}`, {
        service: "crm-manager",
        provider,
        exportId,
        options,
      });

      // Create export directory if it doesn't exist
      const exportDir = path.join(process.cwd(), "exports");
      await fs.mkdir(exportDir, { recursive: true });

      // Prepare export file
      const timestamp = new Date().toISOString().replace(/:/g, "-");
      const filename = `${provider}-export-${timestamp}.json`;
      const exportPath = path.join(exportDir, filename);

      // Get data based on options
      const data = {
        metadata: {
          provider,
          exportId,
          timestamp,
          options,
        },
        contacts: [],
        accounts: [],
        opportunities: [],
      };

      // Export contacts if requested
      if (!options.dataTypes || options.dataTypes.includes("contacts")) {
        data.contacts = await this._exportContacts(provider, options);
      }

      // Export accounts if requested
      if (
        (!options.dataTypes || options.dataTypes.includes("accounts")) &&
        ["salesforce", "hubspot", "zoho", "dynamics"].includes(provider)
      ) {
        data.accounts = await this._exportAccounts(provider, options);
      }

      // Export opportunities if requested
      if (
        (!options.dataTypes || options.dataTypes.includes("opportunities")) &&
        ["salesforce", "hubspot", "zoho", "dynamics"].includes(provider)
      ) {
        data.opportunities = await this._exportOpportunities(provider, options);
      }

      // Write data to file
      await fs.writeFile(exportPath, JSON.stringify(data, null, 2));

      const stats = {
        contacts: data.contacts.length,
        accounts: data.accounts.length,
        opportunities: data.opportunities.length,
        duration: Date.now() - startTime,
      };

      logger.info(`Data export completed for ${provider}`, {
        service: "crm-manager",
        provider,
        exportId,
        stats,
        exportPath,
      });

      return {
        success: true,
        exportId,
        filename,
        path: exportPath,
        stats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(`Data export failed for ${provider}`, {
        service: "crm-manager",
        provider,
        exportId,
        error: error.message,
        stack: error.stack,
        duration: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Export contacts from provider
   * @param {String} provider Provider name
   * @param {Object} options Export options
   * @returns {Promise<Array>} Exported contacts
   * @private
   */
  async _exportContacts(provider, options) {
    // Use our standard getContacts method with pagination
    const contacts = [];
    let page = 1;
    let hasMore = true;
    const pageSize = options.pageSize || 100;

    while (hasMore) {
      const result = await this.getContacts(provider, {
        ...options,
        page,
        limit: pageSize,
      });

      if (result.contacts && result.contacts.length > 0) {
        contacts.push(...result.contacts);
        page++;

        // Check if we have more pages
        if (result.pagination) {
          if (
            result.pagination.hasMore === false ||
            result.pagination.page * pageSize >= result.total
          ) {
            hasMore = false;
          }
        } else if (result.contacts.length < pageSize) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }

      // Safety limit to prevent infinite loops
      if (page > 100) {
        logger.warn(`Export safety limit reached for ${provider} contacts`, {
          service: "crm-manager",
          provider,
          contactsExported: contacts.length,
        });
        break;
      }
    }

    return contacts;
  }

  /**
   * Cleanup and finalize resources
   */
  async cleanup() {
    try {
      // Save final state
      await this._saveState();

      // Clear caches
      this.responseCache.clear();

      // Log final metrics
      logger.info("CRM Manager cleaned up", {
        service: "crm-manager",
        metrics: this.getMetrics(),
      });

      this.initialized = false;

      return true;
    } catch (error) {
      logger.error("Error during CRM Manager cleanup", {
        service: "crm-manager",
        error: error.message,
        stack: error.stack,
      });

      return false;
    }
  }
}

// Create singleton instance
const crmManager = new CRMManager();

module.exports = crmManager;
