const express = require("express");
const app = express();

const multer = require("multer");
const tf = require("@tensorflow/tfjs-node");
const path = require("path");
const http = require("http");
const https = require("https");
const sharp = require("sharp");
const { imageHash } = require("image-hash");
const fs = require("fs").promises;
const fsSync = require("fs"); // For sync operations if needed
const cors = require("cors");
const logger = require("./logger");
const rateLimit = require("express-rate-limit");
const vision = require("@google-cloud/vision");
const { OpenAI } = require("openai");
const dropboxManager = require("./dropboxManager");
const openaiClient = require("./openaiClient");
const knowledgeBase = require("./knowledgeBase");
const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");
const Redis = require("redis");
const { promisify } = require("util");
const AsyncLock = require("async-lock");
const imageHashAsync = promisify(imageHash);
const config = require("./config");
const utils = require("./utils");
const VisionEnhancer = require("./visionEnhancer");
const RobustBatchProcessor = require("./batchProcessor");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const ExcelJS = require("exceljs");
const Papa = require("papaparse");
const storageManager = require("./storage/StorageManager");
const crmManager = require("./integration/CRMManager");
const ThemeManager = require("./ui/ThemeManager");
const AnalyticsManager = require("./analytics/AnalyticsManager");
const TenantManager = require("./tenant/TenantManager");
const WorkflowEngine = require("./workflow/WorkflowEngine");
const {
  authMiddleware,
  requireAdmin,
  requireRole,
} = require("./middleware/auth");
const { ensureAdminUserExists } = require("./user-service");
const authRoutes = require("./routes/auth-routes");
const { RBACManager, ssoManager } = require("./auth");
const ZenotiConnector = require("./integration/connectors/ZenotiConnector");
const passport = require("passport");
const cookieSession = require("cookie-session");
const jwt = require("jsonwebtoken");
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
  console.log("Warning: JWT_SECRET not set, using auto-generated secret");
}

const rbacManager = new RBACManager();
const themeManager = new ThemeManager();
const analyticsManager = new AnalyticsManager({
  collectSearchMetrics: true,
  collectUserMetrics: true,
  collectSystemMetrics: true,
  collectContentMetrics: true,
});
const tenantManager = TenantManager.getInstance();
const workflowEngine = new WorkflowEngine();

let zenotiConnector = null;

let cv;
try {
  cv = require("@u4/opencv4nodejs");
  logger.info("OpenCV loaded successfully", {
    service: "tatt2awai-bot",
    version: cv.getBuildInformation
      ? cv.getBuildInformation().split("\n")[0]
      : "unknown",
  });
} catch (e) {
  logger.error("Failed to load OpenCV:", {
    service: "tatt2awai-bot",
    error: e.message,
    stack: e.stack,
  });
  throw new Error(
    "OpenCV is required for tattoo analysis. Please ensure it is properly installed."
  );
}

let pixelmatch;
(async () => {
  pixelmatch = (await import("pixelmatch")).default;
})();

require("dotenv").config();

async function performWithMemoryCheck(operation, description) {
  const startMemory = process.memoryUsage().heapUsed / 1024 / 1024;
  try {
    const result = await operation();
    return result;
  } finally {
    const endMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    logger.info(`Memory usage for ${description}:`, {
      service: "tatt2awai-bot",
      before: Math.round(startMemory),
      after: Math.round(endMemory),
      diff: Math.round(endMemory - startMemory),
    });

    // Force garbage collection if memory increase is large
    if (endMemory - startMemory > 200 && global.gc) {
      global.gc();
    }
  }
}

class SystemMonitor {
  constructor() {
    this.healthChecks = new Map();
    this.startTime = Date.now();
    this.lastMemoryCheck = Date.now();
    this.criticalErrors = new Set();
  }

  startMonitoring() {
    setInterval(
      () => this.performHealthCheck(),
      SYSTEM_HEALTH.HEALTH_CHECK_INTERVAL
    );
  }

  async performHealthCheck() {
    try {
      const memoryUsage = process.memoryUsage();

      // Check memory usage
      if (memoryUsage.heapUsed > SYSTEM_HEALTH.MAX_MEMORY_USAGE) {
        if (global.gc) {
          global.gc();
        }
        logger.warn("High memory usage detected", {
          service: "tatt2awai-bot",
          memoryUsage: memoryUsage.heapUsed / 1024 / 1024,
        });
      }

      // Check matcher health with proper null checks
      if (typeof imageMatcher !== "undefined" && imageMatcher !== null) {
        try {
          if (typeof imageMatcher.getStats === "function") {
            const matcherStats = imageMatcher.getStats();
            if (matcherStats.error) {
              this.criticalErrors.add("matcher_error");
              logger.error("Matcher error detected", {
                service: "tatt2awai-bot",
                error: matcherStats.error,
              });
            }
          } else {
            logger.warn("Matcher exists but getStats method is not available", {
              service: "tatt2awai-bot",
              matcherKeys: Object.keys(imageMatcher),
            });
          }
        } catch (matcherError) {
          logger.error("Error checking matcher health:", {
            service: "tatt2awai-bot",
            error: matcherError.message,
          });
        }
      } else {
        // Don't log error, just log info that matcher is not yet initialized
        logger.info("Matcher not yet initialized during health check", {
          service: "tatt2awai-bot",
        });
      }

      // Check Dropbox connection
      try {
        const dropboxStatus = await storageManager.validateConnection();
        if (!dropboxStatus) {
          this.criticalErrors.add("dropbox_connection");
          logger.error("Dropbox connection lost", {
            service: "tatt2awai-bot",
          });
        }
      } catch (dropboxError) {
        logger.error("Error checking Dropbox connection:", {
          service: "tatt2awai-bot",
          error: dropboxError.message,
        });
      }

      // Auto-recovery attempts
      if (this.criticalErrors.size > 0) {
        await this.attemptRecovery();
      }
    } catch (error) {
      logger.error("Health check failed:", {
        service: "tatt2awai-bot",
        error: error.message,
      });
    }
  }

  async attemptRecovery() {
    for (const error of this.criticalErrors) {
      switch (error) {
        case "matcher_error":
          try {
            await imageMatcher.reinitialize();
            this.criticalErrors.delete("matcher_error");
          } catch (e) {
            logger.error("Failed to recover matcher:", e);
          }
          break;

        case "dropbox_connection":
          try {
            await storageManager.ensureAuth(true);
            this.criticalErrors.delete("dropbox_connection");
          } catch (e) {
            logger.error("Failed to recover Dropbox connection:", e);
          }
          break;
      }
    }
  }
  getSystemStatus() {
    return {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      criticalErrors: Array.from(this.criticalErrors),
      matcherStatus:
        typeof imageMatcher !== "undefined" &&
        imageMatcher !== null &&
        typeof imageMatcher.getStats === "function"
          ? imageMatcher.getStats()
          : null,
      lastHealthCheck: this.lastHealthCheck,
    };
  }
}

// Initialize the monitor
const systemMonitor = new SystemMonitor();

const RobustImageMatcher = require("./RobustImageMatcher");
let imageMatcher = null;

let isShuttingDown = false;

// Configuration validation
console.log("Environment check:", {
  SUPABASE_URL: process.env.SUPABASE_URL,
  NODE_ENV: process.env.NODE_ENV,
});

const MATCHER_SETTINGS = {
  CLEANUP_THRESHOLD: 100, // Files processed before cleanup
  CACHE_MAX_SIZE: 10000, // Maximum signatures to keep in memory
  BATCH_SIZE: 8, // Process 8 files at a time
  RATE_LIMIT_DELAY: 200, // 200ms between operations
};

const CORE_SETTINGS = {
  HTTP_PORT: process.env.HTTP_PORT || 4000,
  HTTPS_PORT: process.env.HTTPS_PORT || 4001,
  CACHE_TTL: 24 * 60 * 60 * 1000, // 24 hours
  RATE_LIMIT_DELAY: 200,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  RETRY_ATTEMPTS: 3,
  BATCH_SIZE: 8,
  MAX_CONCURRENT: 5,
};

const SYSTEM_HEALTH = {
  STARTUP_TIMEOUT: 60000,
  HEALTH_CHECK_INTERVAL: 30000,
  MATCHER_READY_TIMEOUT: 10000,
  MAX_MEMORY_USAGE: 1024 * 1024 * 1024, // 1GB
};

// Initialize state variables
let allImageFiles = null;
let lastAuthTime = null;
let isInitialized = false;
const featureCache = new Map();
const imageMetadataCache = new Map();
const imageSignatureCache = new Map();
const analysisCache = new Map();
const imageSignatures = new Map();
const lock = new AsyncLock();
const dropboxCache = new Map();

// Update the shutdown handler

async function gracefulShutdown(signal) {
  if (isShuttingDown) {
    logger.info("Shutdown already in progress...");
    return;
  }

  isShuttingDown = true;

  logger.info("Received shutdown signal, starting graceful shutdown...", {
    service: "tatt2awai-bot",
    signal,
  });

  // Set a timeout for force shutdown
  const forceShutdownTimeout = setTimeout(() => {
    logger.error("Force shutdown due to timeout");
    process.exit(1);
  }, 30000); // 30 seconds timeout

  try {
    // Save matcher state
    if (imageMatcher) {
      await imageMatcher.saveState();
    }

    // Close servers
    await new Promise((resolve) => {
      httpServer.close(() => {
        httpsServer.close(resolve);
      });
    });

    clearTimeout(forceShutdownTimeout);
    logger.info("Graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    logger.error("Error during shutdown:", {
      error: error.message,
      stack: error.stack,
    });
    clearTimeout(forceShutdownTimeout);
    process.exit(1);
  }
}

// Update signal handlers
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGUSR2", () => gracefulShutdown("SIGUSR2"));

// Initialize Redis
const redis = Redis.createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

// Promisify Redis methods
const redisGet = promisify(redis.get).bind(redis);
const redisSet = promisify(redis.set).bind(redis);

// Initialize Vision client
const visionClient = new vision.ImageAnnotatorClient({
  keyFilename: path.join(__dirname, process.env.GOOGLE_APPLICATION_CREDENTIALS),
});

// Initialize Supabase
console.log("Supabase Configuration:", {
  hasUrl: !!process.env.SUPABASE_URL,
  hasKey: !!process.env.SUPABASE_KEY,
  url: process.env.SUPABASE_URL,
  keyPreview: process.env.SUPABASE_KEY
    ? `${process.env.SUPABASE_KEY.slice(0, 8)}...`
    : "missing",
});

const supabase = createClient(
  process.env.SUPABASE_URL || "missing-url",
  process.env.SUPABASE_KEY || "missing-key",
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    },
  }
);

global.supabaseClient = supabase;

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.ORGANIZATION_ID,
  maxRetries: 3,
  timeout: 30000,
});

// Active threads management

// Set up upload directory
const uploadDir = path.join(__dirname, "uploads");
if (!fsSync.existsSync(uploadDir)) {
  fsSync.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log("Setting destination");
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    console.log("Setting filename");
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only images are allowed"));
    }
  },
});

async function ensureDirectoryExists(directory) {
  return await utils.ensureDirectoryExists(directory);
}

// Add this at the start of your server initialization
async function initializeDirectories() {
  const directories = [
    path.join(__dirname, "uploads"),
    path.join(__dirname, "signatures"),
    path.join(__dirname, "model-cache"),
  ];

  await Promise.all(directories.map((dir) => ensureDirectoryExists(dir)));
}

async function initializeZenoti() {
  try {
    if (process.env.ENABLE_ZENOTI === "true") {
      const ZenotiConnector = require("./integration/connectors/ZenotiConnector");

      zenotiConnector = new ZenotiConnector({
        apiKey: process.env.ZENOTI_API_KEY,
        apiSecret: process.env.ZENOTI_API_SECRET,
        centerCode: process.env.ZENOTI_CENTER_CODE,
      });

      await zenotiConnector.initialize();
      logger.info("Zenoti connector initialized", {
        service: "integration-init",
      });
    } else {
      logger.info("Zenoti integration not enabled, skipping initialization", {
        service: "integration-init",
      });
    }
  } catch (error) {
    logger.error("Failed to initialize Zenoti connector:", error);
  }
}

// Then call it
initializeZenoti();

// Configure rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per windowMs
  message: { error: "Too many requests, please try again later." },
});

const authRoutes = require("./routes/auth");

// Apply middleware
app.use("/auth", authRoutes);
app.use("/api", authMiddleware);
app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(limiter);
const cookieParser = require("cookie-parser");
app.use(cookieParser());

// Make available globally
app.set("themeManager", themeManager);
app.set("analyticsManager", analyticsManager);
app.set("rbacManager", rbacManager);
app.set("tenantManager", tenantManager);
app.set("workflowEngine", workflowEngine);
app.set("ssoManager", ssoManager);
app.set("zenotiConnector", zenotiConnector);

global.enterpriseInitialized = false;

app.use(
  cookieSession({
    name: "session",
    keys: [
      process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
    ],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  })
);

// Initialize passport for SSO
app.use(passport.initialize());
app.use(passport.session());

// Passport serialization
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

app.use("/api/auth", authRoutes);

// Tenant middleware - applied to all API routes
app.use("/api", async (req, res, next) => {
  // Skip auth check in development with bypass header
  if (
    process.env.NODE_ENV === "development" &&
    req.headers["x-tenant-bypass"] === process.env.TENANT_BYPASS_KEY
  ) {
    req.tenant = { id: "dev-tenant", name: "Development Tenant" };
    return next();
  }

  try {
    // Extract tenant ID from various possible sources
    let tenantId = null;

    // From request header
    if (req.headers["x-tenant-id"]) {
      tenantId = req.headers["x-tenant-id"];
    }
    // From subdomain
    else if (req.headers.host && req.headers.host.includes(".")) {
      const subdomain = req.headers.host.split(".")[0];
      // Look up tenant by subdomain
      tenantId = await tenantManager.getTenantIdBySubdomain(subdomain);
    }
    // From authenticated user
    else if (req.user && req.user.tenantId) {
      tenantId = req.user.tenantId;
    }
    // From query parameter (lowest priority)
    else if (req.query.tenantId) {
      tenantId = req.query.tenantId;
    }

    if (!tenantId) {
      return res.status(400).json({
        error: "Tenant ID is required",
        code: "MISSING_TENANT",
      });
    }

    // Get tenant details
    const tenant = await tenantManager.getTenant(tenantId);

    if (!tenant) {
      return res.status(404).json({
        error: "Tenant not found",
        code: "TENANT_NOT_FOUND",
      });
    }

    // Check if tenant is active
    if (!tenant.active) {
      return res.status(403).json({
        error: "Tenant is inactive",
        code: "TENANT_INACTIVE",
      });
    }

    // Add tenant to request
    req.tenant = tenant;

    // Check tenant-specific rate limits
    const rateLimit = await tenantManager.checkRateLimit(tenantId, req.path);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: "Rate limit exceeded",
        code: "RATE_LIMIT_EXCEEDED",
        resetAt: rateLimit.resetAt,
      });
    }

    next();
  } catch (error) {
    logger.error("Tenant middleware error:", {
      service: "tenant-middleware",
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: "Error determining tenant",
      code: "TENANT_ERROR",
    });
  }
});

// Tracking middleware for analytics - goes after tenant middleware
app.use((req, res, next) => {
  // Skip tracking for certain paths
  if (
    req.path.startsWith("/health") ||
    req.path.startsWith("/static") ||
    req.path === "/favicon.ico"
  ) {
    return next();
  }

  // Track start time
  req.requestStartTime = Date.now();

  // Track event after response
  res.on("finish", () => {
    const duration = Date.now() - req.requestStartTime;

    // Skip tracking for non-successful responses
    if (res.statusCode >= 200 && res.statusCode < 300) {
      analyticsManager.trackEvent(
        "api:request",
        {
          path: req.path,
          method: req.method,
          duration,
          statusCode: res.statusCode,
          clientId: req.tenant?.id,
          userAgent: req.headers["user-agent"],
        },
        req.user
      );
    } else if (res.statusCode >= 400) {
      // Track errors separately
      analyticsManager.trackEvent(
        "api:error",
        {
          path: req.path,
          method: req.method,
          duration,
          statusCode: res.statusCode,
          clientId: req.tenant?.id,
          userAgent: req.headers["user-agent"],
        },
        req.user
      );
    }
  });

  next();
});

app.use((req, res, next) => {
  const startTime = Date.now();
  const originalEnd = res.end;

  // Override the response end method
  res.end = function () {
    // Call the original end method
    originalEnd.apply(res, arguments);

    // Perform cleanup after response
    const duration = Date.now() - startTime;

    // Only cleanup for longer operations
    if (duration > 1000) {
      setImmediate(() => {
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      });
    }
  };

  next();
});

app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info("Request completed", {
      id: req.id,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
    });
  });

  next();
});

// Error boundary middleware
app.use((err, req, res, next) => {
  logger.error("Unhandled error:", {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    error: "Internal server error",
    requestId: req.id,
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error("Unhandled error:", { error: err.message, stack: err.stack });
  res.status(500).json({ error: "Internal server error" });
});

// Process Uncaught Exceptions and Rejections
// Add to top of server.js
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  // Optionally restart the process
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled Rejection:", error);
  // Optionally restart the process
});

// Setup enterprise components - call this during server startup
async function initializeEnterpriseFeatures() {
  try {
    logger.info("Initializing enterprise features", {
      service: "enterprise-init",
    });

    // Initialize components in order
    await rbacManager.initialize();
    await ssoManager.initialize(app);

    await themeManager.initialize();
    await analyticsManager.initialize();
    await tenantManager.initialize();
    await workflowEngine.initialize();

    // Initialize integration connectors based on configuration
    initializeIntegrationConnectors();

    global.enterpriseInitialized = true;

    logger.info("Enterprise features initialized successfully", {
      service: "enterprise-init",
    });

    return true;
  } catch (error) {
    logger.error("Failed to initialize enterprise features:", {
      service: "enterprise-init",
      error: error.message,
      stack: error.stack,
    });

    return false;
  }
}

// Initialize integration connectors based on configuration
async function initializeIntegrationConnectors() {
  try {
    // Check if Zenoti is enabled
    if (process.env.ENABLE_ZENOTI === "true") {
      const ZenotiConnector = require("./integration/connectors/ZenotiConnector");

      const zenotiConnector = new ZenotiConnector({
        apiKey: process.env.ZENOTI_API_KEY,
        apiSecret: process.env.ZENOTI_API_SECRET,
        centerCode: process.env.ZENOTI_CENTER_CODE,
      });

      await zenotiConnector.initialize();
      app.set("zenotiConnector", zenotiConnector);

      logger.info("Zenoti connector initialized", {
        service: "integration-init",
      });
    }

    // Add other connectors as needed
  } catch (error) {
    logger.error("Error initializing integration connectors:", {
      service: "integration-init",
      error: error.message,
      stack: error.stack,
    });
  }
}

// Add these helper functions before initializeImageCache
// Update this function in server.js
async function fileExists(filePath) {
  return await utils.fileExists(filePath);
}

// Also add this if not already present
function generateUUID(input) {
  return utils.generateUUID(input);
}

app.get("/health", async (req, res) => {
  const status = systemMonitor.getSystemStatus();
  const isHealthy = status.criticalErrors.length === 0;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "healthy" : "unhealthy",
    uptime: status.uptime,
    matcher: {
      initialized: !!imageMatcher,
      status: imageMatcher?.getStats() || "not_initialized",
    },
    memory: {
      used: Math.round(status.memoryUsage.heapUsed / 1024 / 1024),
      total: Math.round(status.memoryUsage.heapTotal / 1024 / 1024),
    },
    errors: status.criticalErrors,
    timestamp: new Date().toISOString(),
  });
});

// Health Check Endpoints
app.get("/cache/status", async (req, res) => {
  const { data: count } = await supabase
    .from("image_signatures")
    .select("count", { count: "exact" });

  res.json({
    total: count,
    isInitialized,
    lastUpdate: new Date().toISOString(),
  });
});

// Add to server.js - new endpoint for exports
app.post("/api/export", async (req, res) => {
  try {
    const { format, content, type } = req.body;

    if (!content) {
      return res.status(400).json({ error: "No content provided for export" });
    }

    let exportData;
    let contentType;
    let filename;

    switch (format.toLowerCase()) {
      case "pdf":
        // Use html-pdf or similar library
        const pdf = require("html-pdf");
        const htmlContent =
          type === "chat"
            ? formatChatToPDF(content)
            : formatAnalysisToPDF(content);

        exportData = await new Promise((resolve, reject) => {
          pdf
            .create(htmlContent, { format: "Letter" })
            .toBuffer((err, buffer) => {
              if (err) reject(err);
              else resolve(buffer);
            });
        });

        contentType = "application/pdf";
        filename = `export-${Date.now()}.pdf`;
        break;

      case "csv":
        if (type === "analysis") {
          exportData = convertAnalysisToCSV(content);
          contentType = "text/csv";
          filename = `analysis-${Date.now()}.csv`;
        } else {
          return res
            .status(400)
            .json({ error: "CSV format only supported for analysis exports" });
        }
        break;

      case "json":
        exportData = JSON.stringify(content, null, 2);
        contentType = "application/json";
        filename = `export-${Date.now()}.json`;
        break;

      case "txt":
      default:
        exportData =
          type === "chat"
            ? formatChatToText(content)
            : JSON.stringify(content, null, 2);
        contentType = "text/plain";
        filename = `export-${Date.now()}.txt`;
    }

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(exportData);

    // Log the export for analytics
    logger.info("Export created", {
      service: "tatt2awai-bot",
      format,
      type,
      size: exportData.length,
      user: req.body.userId || "anonymous",
    });
  } catch (error) {
    logger.error("Export error:", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({ error: error.message });
  }
});

// Helper functions for formatting
function formatChatToPDF(chatMessages) {
  let html = `
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; }
        .message { margin-bottom: 15px; }
        .user { color: #0066cc; }
        .assistant { color: #006600; }
        .timestamp { color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <h1>Chat Transcript</h1>
      <p>Exported on ${new Date().toLocaleString()}</p>
      <div class="chat">
  `;

  chatMessages.forEach((msg) => {
    const time = new Date(msg.timestamp).toLocaleString();
    html += `
      <div class="message ${msg.sender}">
        <div class="sender">${msg.sender}:</div>
        <div class="content">${msg.text}</div>
        <div class="timestamp">${time}</div>
      </div>
    `;
  });

  html += `
      </div>
    </body>
    </html>
  `;

  return html;
}

function formatAnalysisToPDF(analysis) {
  // Start with a basic HTML template with professional styling
  let html = `
    <html>
    <head>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          margin: 0;
          padding: 20px;
          color: #333;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          padding-bottom: 10px;
          border-bottom: 1px solid #ddd;
        }
        .logo {
          max-width: 180px;
          margin-bottom: 10px;
        }
        .title {
          font-size: 24px;
          font-weight: bold;
          margin: 0;
          color: #2c3e50;
        }
        .subtitle {
          font-size: 16px;
          color: #7f8c8d;
          margin: 5px 0 0;
        }
        .section {
          margin-bottom: 25px;
        }
        .section-title {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 15px;
          padding-bottom: 5px;
          border-bottom: 1px solid #eee;
          color: #2980b9;
        }
        .info-row {
          display: flex;
          margin-bottom: 10px;
        }
        .info-label {
          font-weight: bold;
          width: 200px;
        }
        .info-value {
          flex: 1;
        }
        .metadata {
          background-color: #f9f9f9;
          padding: 15px;
          border-radius: 5px;
          margin-bottom: 20px;
        }
        .image-details img {
          max-width: 100%;
          max-height: 300px;
          border: 1px solid #ddd;
          margin-bottom: 15px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        table, th, td {
          border: 1px solid #ddd;
        }
        th, td {
          padding: 12px;
          text-align: left;
        }
        th {
          background-color: #f2f2f2;
          font-weight: bold;
        }
        tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        .footer {
          margin-top: 30px;
          text-align: center;
          font-size: 12px;
          color: #7f8c8d;
          padding-top: 10px;
          border-top: 1px solid #ddd;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 class="title">Image Analysis Report</h1>
        <p class="subtitle">Generated on ${new Date().toLocaleString()}</p>
      </div>
  `;

  // Add image information section if available
  if (analysis.imagePath) {
    html += `
      <div class="section">
        <h2 class="section-title">Image Information</h2>
        <div class="metadata">
          <div class="info-row">
            <div class="info-label">File Path:</div>
            <div class="info-value">${analysis.imagePath}</div>
          </div>
    `;

    // Add image metadata if available
    if (analysis.metadata) {
      const metadata = analysis.metadata;
      if (metadata.dimensions) {
        html += `
          <div class="info-row">
            <div class="info-label">Dimensions:</div>
            <div class="info-value">${metadata.dimensions.width} × ${metadata.dimensions.height} pixels</div>
          </div>
        `;
      }
      if (metadata.fileSize) {
        html += `
          <div class="info-row">
            <div class="info-label">File Size:</div>
            <div class="info-value">${formatFileSize(metadata.fileSize)}</div>
          </div>
        `;
      }
      if (metadata.fileType) {
        html += `
          <div class="info-row">
            <div class="info-label">File Type:</div>
            <div class="info-value">${metadata.fileType.toUpperCase()}</div>
          </div>
        `;
      }
      if (metadata.createdAt) {
        html += `
          <div class="info-row">
            <div class="info-label">Created:</div>
            <div class="info-value">${new Date(
              metadata.createdAt
            ).toLocaleString()}</div>
          </div>
        `;
      }
    }

    html += `
      </div>
    </div>
    `;
  }

  // Add image content analysis section
  html += `
    <div class="section">
      <h2 class="section-title">Content Analysis</h2>
  `;

  // Add labels if available
  if (analysis.labels && analysis.labels.length > 0) {
    html += `
      <div class="subsection">
        <h3>Image Content Labels</h3>
        <table>
          <tr>
            <th>Label</th>
            <th>Confidence</th>
          </tr>
    `;

    analysis.labels.forEach((label) => {
      html += `
        <tr>
          <td>${label.description}</td>
          <td>${(label.confidence * 100).toFixed(2)}%</td>
        </tr>
      `;
    });

    html += `
      </table>
      </div>
    `;
  }

  // Add tattoo-specific analysis if available
  if (analysis.tattooInsights) {
    const insights = analysis.tattooInsights;
    html += `
      <div class="subsection">
        <h3>Tattoo Analysis</h3>
    `;

    if (insights.isTattoo) {
      html += `<p>This image contains a tattoo`;

      if (insights.bodyPart) {
        html += ` located on the <strong>${insights.bodyPart}</strong>`;
      }

      html += `.</p>`;

      // Add color information
      if (insights.colors && insights.colors.length > 0) {
        html += `
          <div class="info-row">
            <div class="info-label">Colors:</div>
            <div class="info-value">
        `;

        insights.colors.forEach((color) => {
          html += `
            <span style="
              display: inline-block; 
              width: 20px; 
              height: 20px; 
              background-color: ${getRgbColor(color)}; 
              margin-right: 5px;
              vertical-align: middle;
              border: 1px solid #ddd;
            "></span> ${color.name} (${(color.score * 100).toFixed(1)}%)
            &nbsp;&nbsp;
          `;
        });

        html += `
            </div>
          </div>
        `;
      }

      // Add style if available
      if (insights.style) {
        html += `
          <div class="info-row">
            <div class="info-label">Style:</div>
            <div class="info-value">${insights.style}</div>
          </div>
        `;
      }

      // Add subject if available
      if (insights.subject) {
        html += `
          <div class="info-row">
            <div class="info-label">Subject:</div>
            <div class="info-value">${insights.subject}</div>
          </div>
        `;
      }
    } else {
      html += `<p>This image does not appear to contain a tattoo.</p>`;
    }

    html += `
      </div>
    `;
  }

  // Add removal analysis if available
  if (analysis.removalAnalysis) {
    const removal = analysis.removalAnalysis;
    html += `
      <div class="subsection">
        <h3>Tattoo Removal Analysis</h3>
    `;

    if (removal.isInRemovalProcess) {
      html += `<p>This tattoo appears to be in the process of removal.</p>`;

      if (removal.removalStage) {
        html += `
          <div class="info-row">
            <div class="info-label">Stage:</div>
            <div class="info-value">${removal.removalStage}</div>
          </div>
        `;
      }

      if (removal.progress && removal.progress.fadingPercentage) {
        html += `
          <div class="info-row">
            <div class="info-label">Fading Progress:</div>
            <div class="info-value">
              <div style="
                width: 200px;
                height: 20px;
                background-color: #f0f0f0;
                border: 1px solid #ddd;
                border-radius: 3px;
                overflow: hidden;
              ">
                <div style="
                  width: ${removal.progress.fadingPercentage}%;
                  height: 100%;
                  background-color: #3498db;
                "></div>
              </div>
              <span style="margin-left: 10px;">${removal.progress.fadingPercentage}%</span>
            </div>
          </div>
        `;
      }

      if (removal.removalMethod) {
        html += `
          <div class="info-row">
            <div class="info-label">Method:</div>
            <div class="info-value">${removal.removalMethod}</div>
          </div>
        `;
      }

      if (removal.timeframe) {
        html += `
          <div class="info-row">
            <div class="info-label">Timeframe:</div>
            <div class="info-value">${removal.timeframe}</div>
          </div>
        `;
      }
    } else {
      html += `<p>This tattoo does not appear to be in the process of removal.</p>`;
    }

    html += `
      </div>
    `;
  }

  // Add similar images section if available
  if (analysis.similarImages && analysis.similarImages.length > 0) {
    html += `
      <div class="section">
        <h2 class="section-title">Similar Images</h2>
        <table>
          <tr>
            <th>Path</th>
            <th>Similarity</th>
          </tr>
    `;

    analysis.similarImages.forEach((similar) => {
      html += `
        <tr>
          <td>${similar.path}</td>
          <td>${(similar.score * 100).toFixed(2)}%</td>
        </tr>
      `;
    });

    html += `
      </table>
      </div>
    `;
  }

  // Add custom professional recommendations section
  if (analysis.tattooInsights && analysis.tattooInsights.isTattoo) {
    html += `
      <div class="section">
        <h2 class="section-title">Professional Assessment</h2>
    `;

    if (
      analysis.removalAnalysis &&
      analysis.removalAnalysis.isInRemovalProcess
    ) {
      // Provide recommendations based on removal stage
      if (analysis.removalAnalysis.removalStage === "right after treatment") {
        html += `
          <p>This appears to be a recent treatment where proper healing is essential. The client should:</p>
          <ul>
            <li>Continue following aftercare instructions carefully</li>
            <li>Keep the area clean and dry</li>
            <li>Avoid sun exposure</li>
            <li>Not pick at any scabs that form</li>
            <li>Schedule a follow-up in 6-8 weeks</li>
          </ul>
        `;
      } else if (
        analysis.removalAnalysis.removalStage === "ready for next treatment"
      ) {
        html += `
          <p>The area appears well-healed from the previous treatment and shows good progress. Based on the visual evidence:</p>
          <ul>
            <li>The characteristic healing patterns indicate readiness for the next treatment session</li>
            <li>This would be an appropriate time to schedule a follow-up appointment</li>
            <li>Continued sun protection is recommended between treatments</li>
          </ul>
        `;
      } else {
        html += `
          <p>Based on visual analysis, we recommend:</p>
          <ul>
            <li>Continue with the scheduled treatment plan</li>
            <li>Maintain proper aftercare between sessions</li>
            <li>Document progress with consistent photography</li>
          </ul>
        `;
      }
    } else {
      // Recommendations for tattoos not in removal process
      html += `
        <p>This tattoo is not currently undergoing removal treatment. If removal is being considered:</p>
        <ul>
          <li>A consultation with a removal specialist is recommended</li>
          <li>The tattoo's characteristics suggest it would require approximately ${getEstimatedSessions(
            analysis.tattooInsights
          )} sessions</li>
          <li>Factors affecting removal include ink colors, density, and location on the body</li>
        </ul>
      `;
    }

    html += `
      </div>
    `;
  }

  // Add footer with company info
  html += `
      <div class="footer">
        <p>Report generated by Tatt2Away Image Analysis System</p>
        <p>© ${new Date().getFullYear()} | Confidential</p>
      </div>
    </body>
    </html>
  `;

  return html;
}

function formatChatToText(chatMessages) {
  let text = `Chat Transcript\nExported on ${new Date().toLocaleString()}\n\n`;

  chatMessages.forEach((msg) => {
    const time = new Date(msg.timestamp).toLocaleString();
    text += `${msg.sender} (${time}):\n${msg.text}\n\n`;
  });

  return text;
}

function convertAnalysisToCSV(analysis) {
  // Start with headers row
  let csv = ["Property,Value,Confidence,Additional_Info"];

  // Add image metadata
  if (analysis.imagePath) {
    csv.push(`Image Path,${escapeCsvField(analysis.imagePath)},,`);
  }

  if (analysis.metadata) {
    if (analysis.metadata.dimensions) {
      csv.push(
        `Dimensions,${analysis.metadata.dimensions.width} × ${analysis.metadata.dimensions.height} pixels,,`
      );
    }
    if (analysis.metadata.fileSize) {
      csv.push(`File Size,${formatFileSize(analysis.metadata.fileSize)},,`);
    }
    if (analysis.metadata.fileType) {
      csv.push(`File Type,${analysis.metadata.fileType.toUpperCase()},,`);
    }
    if (analysis.metadata.createdAt) {
      csv.push(
        `Created Date,${new Date(
          analysis.metadata.createdAt
        ).toLocaleString()},,`
      );
    }
  }

  // Add timestamp
  csv.push(`Analysis Date,${new Date().toLocaleString()},,`);

  // Add labels
  if (analysis.labels && analysis.labels.length > 0) {
    csv.push(",,,"); // Empty row as separator
    csv.push("IMAGE CONTENT LABELS,,,");

    analysis.labels.forEach((label) => {
      csv.push(
        `Label,${escapeCsvField(label.description)},${(
          label.confidence * 100
        ).toFixed(2)}%,`
      );
    });
  }

  // Add tattoo insights
  if (analysis.tattooInsights) {
    csv.push(",,,"); // Empty row as separator
    csv.push("TATTOO ANALYSIS,,,");

    const insights = analysis.tattooInsights;
    csv.push(`Contains Tattoo,${insights.isTattoo ? "Yes" : "No"},,`);

    if (insights.isTattoo) {
      if (insights.bodyPart) {
        csv.push(`Body Part,${escapeCsvField(insights.bodyPart)},,`);
      }

      if (insights.style) {
        csv.push(`Style,${escapeCsvField(insights.style)},,`);
      }

      if (insights.subject) {
        csv.push(`Subject,${escapeCsvField(insights.subject)},,`);
      }

      // Add colors as separate rows
      if (insights.colors && insights.colors.length > 0) {
        csv.push(",,,"); // Empty row as separator
        csv.push("TATTOO COLORS,,,");

        insights.colors.forEach((color) => {
          csv.push(
            `Color,${escapeCsvField(color.name)},${(color.score * 100).toFixed(
              1
            )}%,${getRgbColor(color)}`
          );
        });
      }
    }
  }

  // Add removal analysis
  if (analysis.removalAnalysis) {
    csv.push(",,,"); // Empty row as separator
    csv.push("REMOVAL ANALYSIS,,,");

    const removal = analysis.removalAnalysis;
    csv.push(
      `In Removal Process,${removal.isInRemovalProcess ? "Yes" : "No"},,`
    );

    if (removal.isInRemovalProcess) {
      if (removal.removalStage) {
        csv.push(`Removal Stage,${escapeCsvField(removal.removalStage)},,`);
      }

      if (removal.progress && removal.progress.fadingPercentage) {
        csv.push(`Fading Percentage,${removal.progress.fadingPercentage}%,,`);
      }

      if (removal.removalMethod) {
        csv.push(`Removal Method,${escapeCsvField(removal.removalMethod)},,`);
      }

      if (removal.timeframe) {
        csv.push(`Timeframe,${escapeCsvField(removal.timeframe)},,`);
      }
    }
  }

  // Add similar images
  if (analysis.similarImages && analysis.similarImages.length > 0) {
    csv.push(",,,"); // Empty row as separator
    csv.push("SIMILAR IMAGES,,,");

    analysis.similarImages.forEach((similar) => {
      csv.push(
        `Similar Image,${escapeCsvField(similar.path)},${(
          similar.score * 100
        ).toFixed(2)}%,`
      );
    });
  }

  // Join all rows with newlines
  return csv.join("\n");
}

// Helper functions
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  else if (bytes < 1048576) return (bytes / 1024).toFixed(2) + " KB";
  else if (bytes < 1073741824) return (bytes / 1048576).toFixed(2) + " MB";
  else return (bytes / 1073741824).toFixed(2) + " GB";
}

function getRgbColor(color) {
  if (color.color) {
    return `rgb(${color.color.red}, ${color.color.green}, ${color.color.blue})`;
  }
  // Fallback colors based on common tattoo ink colors
  const colorMap = {
    black: "rgb(0, 0, 0)",
    blue: "rgb(0, 0, 255)",
    red: "rgb(255, 0, 0)",
    green: "rgb(0, 128, 0)",
    yellow: "rgb(255, 255, 0)",
    purple: "rgb(128, 0, 128)",
    orange: "rgb(255, 165, 0)",
    brown: "rgb(165, 42, 42)",
    white: "rgb(255, 255, 255)",
    gray: "rgb(128, 128, 128)",
  };

  return colorMap[color.name.toLowerCase()] || "rgb(0, 0, 0)";
}

function escapeCsvField(field) {
  if (field === null || field === undefined) {
    return "";
  }

  let result = field.toString();
  // If the field contains a comma, quote, or newline, wrap it in quotes
  if (result.includes(",") || result.includes('"') || result.includes("\n")) {
    // Double up any quotes
    result = result.replace(/"/g, '""');
    // Wrap in quotes
    result = `"${result}"`;
  }
  return result;
}

function getEstimatedSessions(insights) {
  // Estimate number of sessions based on tattoo characteristics
  let baseSessions = 6; // Default for average tattoo

  // Adjust based on colors
  if (insights.colors) {
    const hasMultipleColors = insights.colors.length > 1;
    const hasDifficultColors = insights.colors.some((color) =>
      ["yellow", "green", "blue", "purple", "white"].includes(
        color.name.toLowerCase()
      )
    );

    if (hasMultipleColors) baseSessions += 2;
    if (hasDifficultColors) baseSessions += 3;
  }

  // Adjust based on body part (extremities remove more easily)
  if (insights.bodyPart) {
    const extremities = ["wrist", "ankle", "foot", "hand"];
    const torso = ["chest", "back", "abdomen", "shoulder"];

    if (
      extremities.some((part) => insights.bodyPart.toLowerCase().includes(part))
    ) {
      baseSessions -= 1;
    } else if (
      torso.some((part) => insights.bodyPart.toLowerCase().includes(part))
    ) {
      baseSessions += 1;
    }
  }

  // Return a range
  return `${baseSessions}-${baseSessions + 2}`;
}

app.post(
  "/api/analyze/document",
  upload.single("document"),
  async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const fileExtension = path.extname(file.originalname).toLowerCase();
      let extractedText = "";
      let metadata = {};

      // Process based on file type
      switch (fileExtension) {
        case ".pdf":
          const pdfData = await fs.promises.readFile(file.path);
          const pdfResult = await pdfParse(pdfData);
          extractedText = pdfResult.text;
          metadata = {
            pageCount: pdfResult.numpages,
            author: pdfResult.info?.Author || "Unknown",
            creationDate: pdfResult.info?.CreationDate,
            title: pdfResult.info?.Title || file.originalname,
          };
          break;

        case ".docx":
          const docxResult = await mammoth.extractRawText({
            path: file.path,
          });
          extractedText = docxResult.value;
          break;

        case ".xlsx":
        case ".xls":
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.readFile(file.path);

          extractedText = "";
          workbook.eachSheet((worksheet) => {
            worksheet.eachRow({ includeEmpty: false }, (row) => {
              extractedText += row.values.slice(1).join("\t") + "\n";
            });
          });

          metadata = {
            author: workbook.creator || "Unknown",
            lastModifiedBy: workbook.lastModifiedBy,
            workbookName: file.originalname,
            sheetCount: workbook.worksheets.length,
          };
          break;

        case ".csv":
          const csvData = await fs.promises.readFile(file.path, "utf8");
          const parsedCsv = Papa.parse(csvData, { header: true });

          // Convert CSV to text representation
          extractedText = parsedCsv.data
            .map((row) => Object.values(row).join("\t"))
            .join("\n");

          metadata = {
            rowCount: parsedCsv.data.length,
            fields: parsedCsv.meta.fields,
          };
          break;

        // Handle text files
        case ".txt":
        case ".md":
        case ".json":
        case ".xml":
        case ".html":
          extractedText = await fs.promises.readFile(file.path, "utf8");
          break;

        default:
          // For unsupported files, try image analysis
          if (file.mimetype.startsWith("image/")) {
            return processImage(req, res);
          } else {
            return res.status(400).json({
              error: `Unsupported file type: ${fileExtension}`,
            });
          }
      }

      // Add the document to knowledge base
      const documentId = `doc_${Date.now()}`;
      await knowledgeBase.addDocument(documentId, extractedText, {
        fileName: file.originalname,
        fileType: fileExtension.substring(1), // Remove the dot
        fileSize: file.size,
        metadata,
        uploadedAt: new Date().toISOString(),
      });

      // Use OpenAI to analyze the document content
      const analysis = await analyzeDocumentContent(
        extractedText,
        fileExtension,
        file.originalname
      );

      // Return the document analysis
      res.json({
        success: true,
        documentId,
        fileName: file.originalname,
        fileType: fileExtension.substring(1),
        metadata,
        analysis,
        extractedLength: extractedText.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Document analysis error:", {
        service: "tatt2awai-bot",
        error: error.message,
        stack: error.stack,
      });

      res.status(500).json({ error: error.message });
    } finally {
      // Clean up the uploaded file
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    }
  }
);

// Helper function for document content analysis
async function analyzeDocumentContent(text, fileType, fileName) {
  try {
    // Truncate text if too long for API
    const truncatedText =
      text.length > 8000 ? text.substring(0, 8000) + "... [TRUNCATED]" : text;

    // Create a prompt based on document type
    let systemPrompt =
      "Analyze this document and provide a comprehensive summary.";

    switch (fileType) {
      case ".pdf":
      case ".docx":
        systemPrompt =
          "Analyze this document and extract key information including: main topics, key entities mentioned, important dates, document purpose, and a concise summary.";
        break;

      case ".xlsx":
      case ".csv":
        systemPrompt =
          "This is data from a spreadsheet. Analyze the data structure, identify what information it contains, what the columns/rows represent, and provide insights about the data patterns.";
        break;

      case ".md":
      case ".txt":
        systemPrompt =
          "Analyze this text document and provide a comprehensive summary of its content, key points, and structure.";
        break;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: truncatedText },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    return {
      summary: response.choices[0].message.content,
      documentType: fileType,
      fileName: fileName,
      extractionQuality: text.length > 8000 ? "partial" : "complete",
      analysisTimestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("OpenAI document analysis error:", {
      service: "tatt2awai-bot",
      error: error.message,
    });

    return {
      summary: "Error analyzing document content.",
      error: error.message,
    };
  }
}

app.post("/api/search/advanced", async (req, res) => {
  try {
    const {
      query,
      filters = {},
      sort = { field: "relevance", direction: "desc" },
      page = 1,
      pageSize = 20,
    } = req.body;

    logger.info("Advanced search request", {
      service: "tatt2awai-bot",
      query,
      filters,
      sort,
    });

    // Get base results using semantic search
    let results = await knowledgeBase.semanticSearch(query, {
      limit: 100, // Get more results initially for filtering
    });

    // Apply filters
    if (Object.keys(filters).length > 0) {
      results = results.filter((item) => {
        let matches = true;

        // Document type filter
        if (filters.documentType && filters.documentType.length > 0) {
          const itemType =
            item.metadata?.fileType ||
            (item.metadata?.fileName &&
              path.extname(item.metadata.fileName).substring(1));

          if (!filters.documentType.includes(itemType)) {
            matches = false;
          }
        }

        // Date range filter
        if (
          filters.dateRange &&
          (filters.dateRange.from || filters.dateRange.to)
        ) {
          const itemDate = new Date(
            item.metadata?.uploadedAt || item.metadata?.created || new Date()
          );

          if (
            filters.dateRange.from &&
            itemDate < new Date(filters.dateRange.from)
          ) {
            matches = false;
          }

          if (
            filters.dateRange.to &&
            itemDate > new Date(filters.dateRange.to)
          ) {
            matches = false;
          }
        }

        // Content filter - check if content contains certain text
        if (filters.contentContains && filters.contentContains.length > 0) {
          const contentLower = (item.content || "").toLowerCase();
          const containsMatch = filters.contentContains.some((term) =>
            contentLower.includes(term.toLowerCase())
          );

          if (!containsMatch) {
            matches = false;
          }
        }

        // Custom metadata filters
        if (filters.metadata && Object.keys(filters.metadata).length > 0) {
          for (const [key, value] of Object.entries(filters.metadata)) {
            // Skip if item has no metadata
            if (!item.metadata) {
              matches = false;
              break;
            }

            // Handle different value types
            if (Array.isArray(value)) {
              // If value is an array, check if item's value is in the array
              if (!value.includes(item.metadata[key])) {
                matches = false;
                break;
              }
            } else if (typeof value === "object") {
              // Handle range objects (min/max)
              if (value.min && item.metadata[key] < value.min) {
                matches = false;
                break;
              }
              if (value.max && item.metadata[key] > value.max) {
                matches = false;
                break;
              }
            } else {
              // Simple equality check
              if (item.metadata[key] !== value) {
                matches = false;
                break;
              }
            }
          }
        }

        return matches;
      });
    }

    // Apply sorting
    if (sort.field !== "relevance") {
      results.sort((a, b) => {
        let valueA, valueB;

        // Handle metadata fields
        if (sort.field.startsWith("metadata.")) {
          const metadataField = sort.field.substring(9); // Remove 'metadata.'
          valueA = a.metadata?.[metadataField];
          valueB = b.metadata?.[metadataField];
        } else {
          valueA = a[sort.field];
          valueB = b[sort.field];
        }

        // Handle dates
        if (
          valueA instanceof Date ||
          (typeof valueA === "string" && !isNaN(Date.parse(valueA)))
        ) {
          valueA = new Date(valueA).getTime();
          valueB = new Date(valueB).getTime();
        }

        // Handle numeric values
        if (typeof valueA === "string" && !isNaN(valueA)) {
          valueA = parseFloat(valueA);
          valueB = parseFloat(valueB);
        }

        // Compare values
        if (valueA < valueB) return sort.direction === "asc" ? -1 : 1;
        if (valueA > valueB) return sort.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    // Calculate pagination
    const totalResults = results.length;
    const totalPages = Math.ceil(totalResults / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    // Get paginated results
    const paginatedResults = results.slice(startIndex, endIndex);

    // Return results with pagination metadata
    res.json({
      success: true,
      results: paginatedResults,
      pagination: {
        page,
        pageSize,
        totalResults,
        totalPages,
      },
      facets: generateFacets(results), // Generate aggregations for filtering
      query,
      appliedFilters: filters,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Advanced search error:", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({ error: error.message });
  }
});

// Helper function to generate facets for filtering
function generateFacets(results) {
  const facets = {
    documentTypes: {},
    dates: {
      min: null,
      max: null,
    },
    metadata: {},
  };

  results.forEach((item) => {
    // Document types
    const docType =
      item.metadata?.fileType ||
      (item.metadata?.fileName &&
        path.extname(item.metadata.fileName).substring(1));

    if (docType) {
      facets.documentTypes[docType] = (facets.documentTypes[docType] || 0) + 1;
    }

    // Dates
    const itemDate = new Date(
      item.metadata?.uploadedAt || item.metadata?.created || new Date()
    );
    if (!facets.dates.min || itemDate < facets.dates.min) {
      facets.dates.min = itemDate;
    }
    if (!facets.dates.max || itemDate > facets.dates.max) {
      facets.dates.max = itemDate;
    }

    // Extract common metadata fields
    if (item.metadata) {
      for (const [key, value] of Object.entries(item.metadata)) {
        // Skip complex objects and arrays
        if (typeof value !== "object" && !Array.isArray(value)) {
          if (!facets.metadata[key]) {
            facets.metadata[key] = {};
          }

          // For numeric values, track min/max
          if (
            typeof value === "number" ||
            (typeof value === "string" && !isNaN(parseFloat(value)))
          ) {
            const numValue =
              typeof value === "number" ? value : parseFloat(value);

            if (
              facets.metadata[key].min === undefined ||
              numValue < facets.metadata[key].min
            ) {
              facets.metadata[key].min = numValue;
            }
            if (
              facets.metadata[key].max === undefined ||
              numValue > facets.metadata[key].max
            ) {
              facets.metadata[key].max = numValue;
            }

            facets.metadata[key].type = "numeric";
          }
          // For string values, count occurrences
          else if (typeof value === "string") {
            facets.metadata[key].type = "string";
            facets.metadata[key].values = facets.metadata[key].values || {};
            facets.metadata[key].values[value] =
              (facets.metadata[key].values[value] || 0) + 1;
          }
        }
      }
    }
  });

  return facets;
}

app.get("/status/check", async (req, res) => {
  try {
    const [dropboxStatus, visionStatus, matcherStatus] = await Promise.all([
      storageManager.ensureAuth(),
      visionClient
        .labelDetection(Buffer.from("test"))
        .then(() => true)
        .catch(() => false),
    ]);

    res.json({
      status: "ok",
      services: {
        dropbox: !!dropboxStatus,
        vision: !!visionStatus,
        matcher: {
          initialized: true,
          metrics: matcherStatus,
        },
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/debug/signature/:path", async (req, res) => {
  const signature = imageSignatures.get(req.params.path);
  res.json({
    hasSignature: !!signature,
    details: signature
      ? {
          aspectRatio: signature.aspectRatio,
          hasMeans: !!signature.means,
          hasFeatures: !!signature.features,
          path: signature.path,
        }
      : null,
  });
});

app.get("/status/check/services", async (req, res) => {
  try {
    const [dropboxStatus, visionStatus, supabaseStatus] = await Promise.all([
      storageManager.ensureAuth(),
      visionClient
        .labelDetection(Buffer.from("test"))
        .then(() => true)
        .catch(() => false),
      supabase
        .from("processed_images")
        .select("count")
        .then(() => true)
        .catch(() => false),
    ]);

    res.json({
      status: "ok",
      services: {
        dropbox: !!dropboxStatus,
        vision: !!visionStatus,
        supabase: !!supabaseStatus,
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Image Upload and Processing Endpoints
app.post("/upload", upload.single("image"), async (req, res) => {
  const processingId = crypto.randomUUID();
  console.log("1. Upload request start:", { processingId });

  if (!req.file) {
    return res.status(400).json({ error: "No file provided" });
  }

  try {
    const dropboxStatus = await storageManager.ensureAuth();
    const [visionResult] = await visionClient.labelDetection(req.file.path);

    // Store in documents table
    const { data: document, error: docError } = await supabase
      .from("documents")
      .insert({
        id: processingId,
        content: JSON.stringify(visionResult.labelAnnotations),
        metadata: {
          filename: req.file.filename,
          size: req.file.size,
          mimetype: req.file.mimetype,
          originalName: req.file.originalname,
          dropboxConnected: !!dropboxStatus,
        },
        document_type: "image",
        source_type: "upload",
        status: "active",
      })
      .select()
      .single();

    if (docError) {
      throw new Error(`Document insert error: ${docError.message}`);
    }

    // Process image
    const analysis = await processImage(req.file);

    res.json({
      success: true,
      processingId,
      analysis,
      document: document.id,
    });
  } catch (error) {
    logger.error("Processing error:", error);
    res.status(500).json({ error: error.message });
  } finally {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
});

app.post("/api/chat", upload.single("image"), async (req, res) => {
  try {
    const { message, userId, imagePath } = req.body;
    const defaultUserId = userId || "default-user";

    let imageData = null;
    let imageAnalysis = null;

    logger.info("Chat request received:", {
      service: "tatt2awai-bot",
      hasMessage: !!message,
      hasImagePath: !!imagePath,
      hasUploadedFile: !!req.file,
      userId: defaultUserId,
    });

    // CASE 1: Image path provided - analyze a specific image from Dropbox
    if (imagePath) {
      // Normalize path - ensure no leading slash
      const normalizedPath = imagePath.startsWith("/")
        ? imagePath.substring(1)
        : imagePath;

      logger.info("Processing chat request with image path", {
        service: "tatt2awai-bot",
        imagePath: normalizedPath,
        originalPath: imagePath,
        userId: defaultUserId,
      });

      try {
        // First ensure we have Dropbox access
        const dropboxStatus = await storageManager.ensureAuth();
        if (!dropboxStatus) {
          throw new Error("Unable to access Dropbox");
        }

        // Download the image from Dropbox - use normalized path
        const fileData = await storageManager.downloadFile(normalizedPath);
        if (!fileData?.result?.fileBinary) {
          throw new Error(
            `Failed to download image from path: ${normalizedPath}`
          );
        }

        // Create a temporary file for analysis
        const tempPath = path.join(
          uploadDir,
          `temp_${Date.now()}_${path.basename(normalizedPath)}`
        );
        try {
          fs.writeFileSync(tempPath, fileData.result.fileBinary);
          logger.info("Successfully downloaded image for analysis", {
            service: "tatt2awai-bot",
            path: tempPath,
            originalPath: normalizedPath,
          });

          // Get basic image analysis if possible
          if (
            global.imageMatcher &&
            typeof global.imageMatcher.analyzeImage === "function"
          ) {
            try {
              imageAnalysis = await global.imageMatcher.analyzeImage(tempPath);

              // Try to find similar images
              const matchResults =
                await global.imageMatcher.findMatchesWithMode(
                  tempPath,
                  "tensor",
                  { maxMatches: 10, threshold: 0.65 }
                );

              // Add matches to analysis
              imageAnalysis.similarImages = matchResults.matches || [];

              // Try to find related images in the same directory
              const dirPath = path.dirname(normalizedPath);
              const dirEntries = await storageManager.fetchDropboxEntries(
                dirPath
              );

              // Add directory info to analysis
              if (dirEntries?.result?.entries) {
                imageAnalysis.directoryContents = dirEntries.result.entries
                  .filter((entry) => entry.path_lower !== normalizedPath)
                  .map((entry) => ({
                    path: entry.path_lower,
                    name: entry.name,
                    modified: entry.server_modified,
                  }));
              }

              logger.info("Image analyzed successfully", {
                service: "tatt2awai-bot",
                hasAnalysis: !!imageAnalysis,
                path: tempPath,
                originalPath: normalizedPath,
              });
            } catch (analysisError) {
              logger.warn("Image analysis failed:", {
                service: "tatt2awai-bot",
                error: analysisError.message,
                path: tempPath,
                originalPath: normalizedPath,
              });
            }
          }
        } finally {
          // Clean up the temp file
          if (fs.existsSync(tempPath)) {
            try {
              fs.unlinkSync(tempPath);
            } catch (e) {
              logger.warn("Failed to clean up temp file:", {
                service: "tatt2awai-bot",
                path: tempPath,
                error: e.message,
              });
            }
          }
        }
      } catch (imageError) {
        logger.error("Error processing image path:", {
          service: "tatt2awai-bot",
          error: imageError.message,
          path: normalizedPath,
        });

        return res.status(400).json({
          error: `Failed to process image from path: ${imageError.message}`,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // CASE 2: Image uploaded - process the uploaded file
    if (req.file) {
      try {
        // Read the image file
        imageData = fs.readFileSync(req.file.path);

        // Get basic image analysis if possible
        if (
          global.imageMatcher &&
          typeof global.imageMatcher.analyzeImage === "function"
        ) {
          try {
            imageAnalysis = await global.imageMatcher.analyzeImage(
              req.file.path
            );

            // Store the analysis in the knowledge base for future reference
            await knowledgeBase.processImageAnalysis(
              req.file.path,
              imageAnalysis
            );

            logger.info("Uploaded image analyzed for chat:", {
              service: "tatt2awai-bot",
              hasAnalysis: !!imageAnalysis,
              path: req.file.path,
            });
          } catch (analysisError) {
            logger.warn("Uploaded image analysis failed:", {
              service: "tatt2awai-bot",
              error: analysisError.message,
              path: req.file.path,
            });
          }
        }
      } catch (imageError) {
        logger.error("Error processing uploaded image:", {
          service: "tatt2awai-bot",
          error: imageError.message,
          path: req.file?.path,
        });
      }
    }

    // Create context for OpenAI assistant
    const analysisContext = {};

    if (imageAnalysis) {
      // Add image analysis to context
      analysisContext.imageAnalysis = imageAnalysis;
    }

    if (imagePath) {
      // Normalize path for context
      const normalizedPath = imagePath.startsWith("/")
        ? imagePath.substring(1)
        : imagePath;

      // Add image path to context
      analysisContext.imagePath = normalizedPath;
      analysisContext.isSpecificImageQuery = true;
    }

    // Add additional context about capabilities
    analysisContext.additionalContext = {
      timestamp: new Date().toISOString(),
      imageUploaded: !!imageData,
      imagePathSpecified: !!imagePath,
      hasAnalysis: !!imageAnalysis,
      message:
        message ||
        (imagePath
          ? `Tell me about this image: ${imagePath}`
          : "Analyze this image"),
    };

    // Use the OpenAI client to process the message
    const response = await openaiClient.processUserMessage(
      userId || "default-user",
      message ||
        (imagePath
          ? `Tell me about this image: ${imagePath}`
          : "Analyze this image"),
      imageData,
      analysisContext
    );

    // Process the response to add clickable links
    let processedContent = response.content;

    // Remove the "I have direct access" prefix if present
    if (
      processedContent.startsWith(
        "I have direct access to the Dropbox repository"
      )
    ) {
      processedContent = processedContent.replace(
        /I have direct access to the Dropbox repository[^\.]*\.\s*/i,
        ""
      );
    }

    // Replace image paths with HTML links (more compatible than markdown)
    processedContent = processedContent.replace(
      /\/(photos|marketing)[^\s"']+\.(jpg|jpeg|png|gif|webp)/gi,
      (match) => {
        const encodedPath = encodeURIComponent(match);
        return `<a href="http://147.182.247.128:4000/image-viewer?path=${encodedPath}" target="_blank">${match}</a>`;
      }
    );

    // Return the enhanced response
    res.json({
      response: processedContent,
      threadId: response.thread_id,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Chat processing error:", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: "Failed to process chat request",
      details: error.message,
      timestamp: new Date().toISOString(),
    });
  } finally {
    // Clean up temp file if one was created
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
        logger.info("Cleaned up temp file:", {
          service: "tatt2awai-bot",
          path: req.file.path,
        });
      } catch (cleanupError) {
        logger.warn("Failed to clean up temp file:", {
          service: "tatt2awai-bot",
          path: req.file.path,
          error: cleanupError.message,
        });
      }
    }
  }
});

// Add this new endpoint to server.js
app.post("/api/analyze-search-result", async (req, res) => {
  try {
    const { imagePath } = req.body;

    if (!imagePath) {
      return res.status(400).json({ error: "Image path is required" });
    }

    // Normalize path
    const normalizedPath = imagePath.startsWith("/")
      ? imagePath.substring(1)
      : imagePath;

    // Check cache first
    const { data: cachedAnalysis } = await supabase
      .from("enhanced_image_analysis")
      .select("analysis")
      .eq("path", normalizedPath)
      .maybeSingle();

    if (cachedAnalysis?.analysis) {
      return res.json({
        success: true,
        path: imagePath,
        analysis: cachedAnalysis.analysis,
        cached: true,
      });
    }

    // Not in cache, perform analysis
    const fileData = await storageManager.downloadFile(normalizedPath);
    if (!fileData?.result?.fileBinary) {
      return res.status(404).json({ error: "Image not found" });
    }

    const buffer = Buffer.isBuffer(fileData.result.fileBinary)
      ? fileData.result.fileBinary
      : Buffer.from(fileData.result.fileBinary);

    // Make sure VisionEnhancer is initialized
    if (!global.visionEnhancer) {
      global.visionEnhancer = new VisionEnhancer({
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        enableProperties: true,
      });
      await global.visionEnhancer.initialize();
    }

    // Analyze the image
    const visionAnalysis = await global.visionEnhancer.analyzeImage(buffer, {
      imagePath: normalizedPath,
    });

    // Cache the analysis
    await supabase.from("enhanced_image_analysis").upsert({
      path: normalizedPath,
      analysis: visionAnalysis,
      created_at: new Date().toISOString(),
    });

    // Create a user-friendly description
    const description = generateDetailedDescription(visionAnalysis);

    return res.json({
      success: true,
      path: imagePath,
      analysis: visionAnalysis,
      description,
      cached: false,
    });
  } catch (error) {
    console.error("Error analyzing image:", error);
    return res.status(500).json({
      error: "Failed to analyze image",
      details: error.message,
    });
  }
});

// Helper function to generate detailed descriptions
function generateDetailedDescription(analysis) {
  let description = "";

  // Extract basic information
  if (analysis.labels && analysis.labels.length > 0) {
    const topLabels = analysis.labels
      .slice(0, 5)
      .map((l) => l.description)
      .join(", ");
    description += `Content identified as: ${topLabels}.\n\n`;
  }

  // Add tattoo-specific information
  if (analysis.tattooInsights) {
    const insights = analysis.tattooInsights;

    if (insights.isTattoo) {
      description += `This appears to be a tattoo`;

      if (insights.bodyPart) {
        description += ` on the ${insights.bodyPart}`;
      }

      if (insights.colors && insights.colors.length > 0) {
        const colorNames = insights.colors
          .slice(0, 3)
          .map((c) => c.name)
          .join(", ");
        description += ` with colors including ${colorNames}`;
      }

      description += ".\n\n";

      if (insights.style) {
        description += `Style identified as ${insights.style}.\n\n`;
      }
    }
  }

  // Add removal analysis if available
  if (analysis.removalAnalysis) {
    const removal = analysis.removalAnalysis;

    if (removal.isInRemovalProcess) {
      description += `Tattoo Removal Analysis: This tattoo appears to be in the process of removal.`;

      if (removal.removalStage) {
        description += ` Stage: ${removal.removalStage}.`;
      }

      if (removal.progress && removal.progress.fadingPercentage) {
        description += ` It is approximately ${removal.progress.fadingPercentage}% faded.`;
      }

      if (removal.removalMethod) {
        description += ` The removal method appears to be ${removal.removalMethod}.`;
      }

      description += "\n\n";
    } else if (analysis.tattooInsights?.isTattoo) {
      description += `This tattoo does not appear to be in the process of removal.\n\n`;
    }
  }

  return description;
}

app.post("/rebuild-index", async (req, res) => {
  try {
    // Force reindex of everything
    const indexingJob = knowledgeBase.buildDropboxIndex({
      forceRefresh: true,
      maxEntries: 1000000, // Allow indexing up to 1 million files
      batchSize: 500,
    });

    // Return immediately and let indexing continue in the background
    res.json({
      success: true,
      message: "Indexing started in the background",
      estimated_duration:
        "This may take several hours depending on your repository size",
    });

    // Continue with the indexing process after response is sent
    res.on("finish", async () => {
      try {
        const result = await indexingJob;
        logger.info("Background indexing completed", {
          service: "tatt2awai-bot",
          stats: result.stats,
        });
      } catch (error) {
        logger.error("Background indexing failed", {
          service: "tatt2awai-bot",
          error: error.message,
        });
      }
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

// Endpoint to get index status
app.get("/index-status", async (req, res) => {
  try {
    // Get current stats from database
    const { data: indexCount, error: indexError } = await supabase
      .from("documents")
      .select("count", { count: "exact" })
      .eq("metadata->>isIndexed", "true");

    if (indexError) throw indexError;

    // Get stats by file type
    const { data: fileTypeStats, error: statsError } = await supabase.rpc(
      "get_file_type_stats"
    );

    if (statsError) throw statsError;

    res.json({
      success: true,
      indexed_files: indexCount || 0,
      by_file_type: fileTypeStats || [],
      database_size: await getDatabaseSize(),
      last_updated: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

// Helper function to get database size
async function getDatabaseSize() {
  try {
    const { data, error } = await supabase.rpc("get_db_size");
    if (error) throw error;
    return data[0]?.size_mb || "unknown";
  } catch (error) {
    logger.error("Error getting DB size:", {
      service: "tatt2awai-bot",
      error: error.message,
    });
    return "unknown";
  }
}

// Endpoint to test specific file retrieval
app.post("/test-file-retrieval", async (req, res) => {
  try {
    const { path } = req.body;

    if (!path) {
      return res.status(400).json({ error: "Path parameter is required" });
    }

    const storageManager = require("./storageManager");
    const startTime = Date.now();

    // Test retrieval
    const fileResponse = await storageManager.downloadFile(path);

    res.json({
      success: true,
      path,
      retrieval_time_ms: Date.now() - startTime,
      file_size: fileResponse?.result?.fileBinary?.length || 0,
      from_cache: !!fileResponse?.result?.metadata?.fromCache,
      cache_source: fileResponse?.result?.metadata?.cacheSource,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

// Add database repair function for Supabase
app.post("/repair-database", async (req, res) => {
  try {
    const { action } = req.body;

    if (action === "cleanup") {
      // Remove invalid entries
      const { data: deleted, error } = await supabase
        .from("documents")
        .delete()
        .is("content", null);

      if (error) throw error;

      res.json({
        success: true,
        action: "cleanup",
        deleted: deleted?.length || 0,
      });
    } else if (action === "vacuum") {
      // Execute vacuum analyze via SQL function
      const { data, error } = await supabase.rpc("vacuum_analyze");

      if (error) throw error;

      res.json({
        success: true,
        action: "vacuum",
        result: data,
      });
    } else {
      res.status(400).json({
        error: "Invalid action specified",
      });
    }
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

/**
 * Robust endpoint for batch processing all images in a Dropbox folder
 * Fixed to work with existing code structure
 */
app.post("/process/folder", async (req, res) => {
  const startTime = Date.now();

  try {
    // Extract and validate parameters
    const {
      folderPath,
      processSubfolders = true,
      skipExisting = true,
      batchSize = 10,
      concurrentLimit = 5,
      delayBetweenBatches = 5000,
      maxRetries = 3,
      apiRateLimitPerMin = 1200, // Slightly conservative to avoid limits
      maxDepth = 10, // Maximum folder recursion depth
      jobId = crypto.randomUUID(),
    } = req.body;

    // Validate required parameters
    if (!folderPath) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameter: folderPath",
        code: "MISSING_PARAMETER",
      });
    }

    // Log the start of processing
    logger.info("Starting batch processing", {
      service: "tatt2awai-bot",
      folderPath,
      jobId,
      options: {
        processSubfolders,
        skipExisting,
        batchSize,
        concurrentLimit,
      },
    });

    // Initialize the VisionEnhancer
    // Use existing instance if available or create a new one
    let visionEnhancer;
    if (global.visionEnhancerInstance) {
      visionEnhancer = global.visionEnhancerInstance;
    } else {
      visionEnhancer = new VisionEnhancer({
        useCustomModel: true,
        enableProperties: true,
        maxLabels: 30,
        maxObjects: 15,
        minConfidence: 0.6,
        cacheEnabled: true,
      });

      // Store for future use
      global.visionEnhancerInstance = visionEnhancer;
    }

    // Initialize the image matcher - using your existing system
    // Supports multiple possible locations/patterns
    let imageMatcher;
    try {
      // Try different ways to get the image matcher
      if (req.app.get("imageMatcher")) {
        imageMatcher = req.app.get("imageMatcher");
      } else if (global.imageMatcher) {
        imageMatcher = global.imageMatcher;
      } else if (typeof ImageSignatureProcessor !== "undefined") {
        // If you have a global ImageSignatureProcessor class
        imageMatcher = new ImageSignatureProcessor();
      } else if (global.tensorFlowService) {
        imageMatcher = global.tensorFlowService;
      } else {
        // As a fallback, create a simple adapter to your existing tensor system
        // This assumes you have a different pattern for accessing tensor features
        imageMatcher = {
          analyzeImage: async (path) => {
            // Adapt this to match your actual tensor service API
            try {
              // This is a placeholder for your existing tensor system
              // You'll need to modify this to match your actual implementation
              if (typeof getTensorEmebeddings === "function") {
                return await getTensorEmebeddings(path);
              }

              // Return null if no existing implementation is found
              // The batch processor will still work, just without tensor embeddings
              return null;
            } catch (err) {
              logger.warn(
                "Error getting tensor embeddings, continuing without them",
                {
                  service: "tatt2awai-bot",
                  error: err.message,
                }
              );
              return null;
            }
          },
        };
      }
    } catch (error) {
      logger.warn(
        "Could not initialize image matcher, proceeding with Vision API only",
        {
          service: "tatt2awai-bot",
          error: error.message,
        }
      );

      // If all else fails, proceed without tensor embeddings
      imageMatcher = null;
    }

    // Initialize Supabase client (should be available in your app)
    const supabase = req.app.get("supabase") || global.supabaseClient;
    if (!supabase) {
      throw new Error("Supabase client is required but not found");
    }

    // Initialize the batch processor
    const processor = new RobustBatchProcessor({
      visionEnhancer,
      imageMatcher,
      supabase,
      batchSize,
      concurrentLimit,
      apiRateLimitPerMin,
      delayBetweenBatches,
      maxRetries,
      uploadDir: path.join(__dirname, "uploads", jobId), // Use job-specific upload dir
    });

    // Ensure the processor is initialized
    if (typeof processor.initialize === "function") {
      await processor.initialize();
    }

    // Start the batch processing job
    const jobInfo = await processor.processAllImages({
      jobId,
      folderPath,
      processSubfolders,
      skipExisting,
      maxDepth,
      saveResults: true,
    });

    // Create a monitor task to periodically log progress
    const monitorInterval = setInterval(async () => {
      try {
        const status = await processor.getStatus(jobId);
        if (status.success && status.job) {
          logger.info("Batch job progress update", {
            service: "tatt2awai-bot",
            jobId,
            status: status.job.status,
            progress: `${status.job.stats.processed}/${status.job.stats.total} (${status.job.progress}%)`,
            successful: status.job.stats.successful,
            failed: status.job.stats.failed,
            skipped: status.job.stats.skipped,
          });
        }

        // Stop monitoring if job is complete
        if (
          status.job?.status === "completed" ||
          status.job?.status === "failed" ||
          status.job?.status === "stopped"
        ) {
          clearInterval(monitorInterval);
        }
      } catch (error) {
        logger.warn("Error in job monitor", {
          service: "tatt2awai-bot",
          jobId,
          error: error.message,
        });
      }
    }, 30000); // Log progress every 30 seconds

    // Return success with job info
    return res.status(200).json({
      success: true,
      message: "Batch processing job started successfully",
      jobId: jobInfo.jobId,
      status: jobInfo.status,
      folderPath,
      setupTime: Date.now() - startTime,
      monitorEndpoint: `/batch/status/${jobInfo.jobId}`,
    });
  } catch (error) {
    logger.error("Error starting batch process", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
    });

    return res.status(500).json({
      success: false,
      message: "Error starting batch process",
      error: error.message,
      code: "INTERNAL_ERROR",
    });
  }
});

/**
 * Status endpoint to check on batch job progress
 */
app.get("/batch/status/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: "Missing jobId parameter",
      });
    }

    // Get the batch processor
    const supabase = req.app.get("supabase") || global.supabaseClient;
    if (!supabase) {
      throw new Error("Supabase client is required but not found");
    }

    const processor = new RobustBatchProcessor({ supabase });

    // Get job status
    const status = await processor.getStatus(jobId);

    // Add formatted time information if available
    if (status.job) {
      if (status.job.startTime) {
        status.job.startTimeFormatted = new Date(
          status.job.startTime
        ).toISOString();
      }
      if (status.job.endTime) {
        status.job.endTimeFormatted = new Date(
          status.job.endTime
        ).toISOString();
        status.job.durationMinutes = Math.round(
          (status.job.endTime - status.job.startTime) / 1000 / 60
        );
      } else if (status.job.startTime) {
        status.job.durationMinutes = Math.round(
          (Date.now() - status.job.startTime) / 1000 / 60
        );
      }
    }

    return res.status(200).json(status);
  } catch (error) {
    logger.error("Error getting batch status", {
      service: "tatt2awai-bot",
      error: error.message,
    });

    return res.status(500).json({
      success: false,
      message: "Error retrieving batch status",
      error: error.message,
    });
  }
});

/**
 * Stop a running batch job
 */
app.post("/batch/stop/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: "Missing jobId parameter",
      });
    }

    // Get the supabase client
    const supabase = req.app.get("supabase") || global.supabaseClient;
    if (!supabase) {
      throw new Error("Supabase client is required but not found");
    }

    // Get the batch processor
    const processor = new RobustBatchProcessor({ supabase });

    // Stop the job
    const result = await processor.stopProcessing();

    return res.status(200).json(result);
  } catch (error) {
    logger.error("Error stopping batch job", {
      service: "tatt2awai-bot",
      error: error.message,
    });

    return res.status(500).json({
      success: false,
      message: "Error stopping batch job",
      error: error.message,
    });
  }
});

/**
 * Resume a stopped/failed batch job
 */
app.post("/batch/resume/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: "Missing jobId parameter",
      });
    }

    // Initialize VisionEnhancer
    let visionEnhancer;
    if (global.visionEnhancerInstance) {
      visionEnhancer = global.visionEnhancerInstance;
    } else {
      visionEnhancer = new VisionEnhancer({
        useCustomModel: true,
        enableProperties: true,
      });
      global.visionEnhancerInstance = visionEnhancer;
    }

    // Try to get the image matcher - using similar logic as the main endpoint
    let imageMatcher;
    try {
      if (req.app.get("imageMatcher")) {
        imageMatcher = req.app.get("imageMatcher");
      } else if (global.imageMatcher) {
        imageMatcher = global.imageMatcher;
      } else if (typeof ImageSignatureProcessor !== "undefined") {
        imageMatcher = new ImageSignatureProcessor();
      } else {
        // This is a fallback adapter - you'll need to modify based on your system
        imageMatcher = null;
      }
    } catch (error) {
      imageMatcher = null;
    }

    // Get the supabase client
    const supabase = req.app.get("supabase") || global.supabaseClient;
    if (!supabase) {
      throw new Error("Supabase client is required but not found");
    }

    // Initialize the batch processor
    const processor = new RobustBatchProcessor({
      visionEnhancer,
      imageMatcher,
      supabase,
      uploadDir: path.join(__dirname, "uploads", jobId),
    });

    // Resume the job
    const result = await processor.resumeJob(jobId);

    return res.status(200).json(result);
  } catch (error) {
    logger.error("Error resuming batch job", {
      service: "tatt2awai-bot",
      error: error.message,
    });

    return res.status(500).json({
      success: false,
      message: "Error resuming batch job",
      error: error.message,
    });
  }
});

// Add this to server.js - a more sophisticated tattoo removal analyzer
// Add this to your server.js file - a more sophisticated tattoo removal analyzer
const enhancedTattooAnalysis = {
  analyzeTattooRemovalStage: function (image, analysis) {
    // Extract key features from the image and analysis
    const features = {
      hasDots: this.detectDotPattern(image, analysis),
      skinColorMetrics: this.analyzeSkinColor(image, analysis),
      inkPresence: this.detectInkPresence(image, analysis),
      scarring: this.detectScarring(image, analysis),
      circleColors: this.detectCircleColors(image, analysis),
    };

    // Determine the stage based on the features
    let stage = "unknown";
    let confidence = 0.5;
    let description = "";

    // Right after treatment (fresh application) - RED CIRCLES
    if (features.circleColors.hasRedCircles && features.hasDots) {
      stage = "right after treatment";
      confidence = 0.9;
      description =
        "This image shows a tattoo immediately after a Tatt2Away treatment. The characteristic red circular marks are fresh application sites where the solution has just been applied. This is normal immediately following a treatment session. The area should be kept clean following proper aftercare instructions.";
    }
    // Ready for next treatment (fully healed from previous) - SKIN TONE CIRCLES
    else if (
      features.circleColors.hasSkinToneCircles &&
      features.hasDots &&
      !features.scarring.hasDarkRed
    ) {
      stage = "ready for next treatment";
      confidence = 0.85;
      description =
        "The area appears well-healed from the previous treatment, with the circular marks now closer to skin tone. This indicates the area has completed its healing cycle and is ready for the next treatment session. The healing process has allowed the treated ink to be expelled, and the skin is now prepared for further removal.";
    }
    // Advanced stage (multiple treatments) - PURPLE OUTLINED CIRCLES
    else if (
      features.circleColors.hasPurpleOutlines ||
      features.inkPresence.minimal
    ) {
      stage = "advanced stage";
      confidence = 0.8;
      description =
        "This tattoo shows significant fading after multiple treatment sessions. The purple-outlined circles and overall ink reduction indicate effective progress in the removal process. The treatment is working well, with substantial portions of the original tattoo now faded or removed.";
    }
    // Ink expulsion phase - VISIBLE INK IN CIRCLES
    else if (features.inkPresence.visible && features.hasDots) {
      stage = "ink expulsion phase";
      confidence = 0.75;
      description =
        "This shows a tattoo in the ink expulsion phase where the treated ink is being pushed out. The circles are visible with ink still present inside them. This is normal during the active expulsion process where the body is naturally eliminating the loosened ink particles.";
    }
    // Untreated tattoo
    else if (!features.hasDots && features.inkPresence.high) {
      stage = "full tattoo";
      confidence = 0.95;
      description =
        "This appears to be an untreated tattoo with no evidence of removal treatments yet. The ink is intact with no characteristic circular patterns that would indicate Tatt2Away treatment.";
    }
    // General in-progress
    else if (features.hasDots) {
      stage = "in treatment process";
      confidence = 0.7;
      description =
        "This tattoo is currently in the removal process. The circular pattern is characteristic of the Tatt2Away method. Multiple treatments are typically required for complete removal, with each session targeting different areas of the tattoo.";
    }

    // Calculate approximate completion percentage based on stage and ink presence
    let estimatedCompletionPercentage = 0;
    switch (stage) {
      case "full tattoo":
        estimatedCompletionPercentage = 0;
        break;
      case "right after treatment":
        estimatedCompletionPercentage = 15;
        break;
      case "ink expulsion phase":
        estimatedCompletionPercentage = 25;
        break;
      case "ready for next treatment":
        estimatedCompletionPercentage = features.inkPresence.visible ? 30 : 45;
        break;
      case "in treatment process":
        estimatedCompletionPercentage = 40;
        break;
      case "advanced stage":
        estimatedCompletionPercentage = features.inkPresence.minimal ? 85 : 65;
        break;
      default:
        estimatedCompletionPercentage = 30;
    }

    return {
      stage,
      confidence,
      description,
      features,
      isInRemovalProcess: stage !== "full tattoo",
      estimatedCompletionPercentage,
    };
  },

  detectDotPattern: function (image, analysis) {
    // Check for circular patterns in labels and objects
    const hasDotTerms =
      analysis.labels &&
      analysis.labels.some(
        (l) =>
          l.description.toLowerCase().includes("dot") ||
          l.description.toLowerCase().includes("pattern") ||
          l.description.toLowerCase().includes("spots") ||
          l.description.toLowerCase().includes("circle")
      );

    // Also detect from objects if available
    const hasCircularObjects =
      analysis.objects &&
      analysis.objects.some(
        (obj) =>
          obj.name.toLowerCase().includes("pattern") ||
          obj.name.toLowerCase().includes("circle") ||
          obj.name.toLowerCase().includes("dot")
      );

    // Since many patterns might not be detected by labels alone,
    // also check text that might indicate patterns
    const hasPatternText =
      analysis.text &&
      analysis.text.fullText &&
      (analysis.text.fullText.toLowerCase().includes("pattern") ||
        analysis.text.fullText.toLowerCase().includes("dots") ||
        analysis.text.fullText.toLowerCase().includes("circles"));

    // Return true if any detection method found patterns
    return hasDotTerms || hasCircularObjects || hasPatternText;
  },

  analyzeSkinColor: function (image, analysis) {
    // Extract skin color metrics from image properties
    let skinTone = "normal";
    let redness = 0;
    let inflammation = 0;

    // Check for color properties from Vision API
    if (analysis.properties && analysis.properties.dominantColors) {
      const colors = analysis.properties.dominantColors;

      // Look for red tones that might indicate inflammation
      const redColors = colors.filter(
        (color) =>
          color.color.red > 220 &&
          color.color.green < 180 &&
          color.color.blue < 180
      );

      // Look for pink tones that might indicate healing
      const pinkColors = colors.filter(
        (color) =>
          color.color.red > 200 &&
          color.color.green > 150 &&
          color.color.blue > 150 &&
          color.color.red > color.color.green
      );

      // Calculate redness metric
      redness = redColors.reduce((sum, color) => sum + color.score, 0);

      // Check for inflammation based on color distribution
      if (redness > 0.3) {
        inflammation = 0.8;
        skinTone = "inflamed";
      } else if (
        pinkColors.reduce((sum, color) => sum + color.score, 0) > 0.4
      ) {
        inflammation = 0.4;
        skinTone = "healing";
      }
    }

    return {
      tone: skinTone,
      redness: redness,
      inflammation: inflammation,
    };
  },

  detectInkPresence: function (image, analysis) {
    // Analyze the likely presence of tattoo ink
    let visible = false;
    let high = false;
    let minimal = false;

    // Check labels for ink-related terms
    if (analysis.labels) {
      const inkLabels = analysis.labels.filter(
        (label) =>
          label.description.toLowerCase().includes("tattoo") ||
          label.description.toLowerCase().includes("ink")
      );

      visible = inkLabels.length > 0;

      // Determine ink density based on label confidence
      if (visible && inkLabels.some((label) => label.confidence > 0.85)) {
        high = true;
      } else if (
        visible &&
        !inkLabels.some((label) => label.confidence > 0.6)
      ) {
        minimal = true;
      }
    }

    // Check for dark areas in the image properties
    if (analysis.properties && analysis.properties.dominantColors) {
      const darkColors = analysis.properties.dominantColors.filter(
        (color) =>
          (color.color.red < 100 &&
            color.color.green < 100 &&
            color.color.blue < 100) ||
          (color.color.blue > 200 &&
            color.color.red < 100 &&
            color.color.green < 100) // Dark blue ink
      );

      const darkProportion = darkColors.reduce(
        (sum, color) => sum + color.score,
        0
      );

      if (darkProportion > 0.2) {
        visible = true;
        high = true;
      } else if (darkProportion > 0.05) {
        visible = true;
      } else if (darkProportion < 0.02) {
        minimal = true;
      }
    }

    return {
      visible: visible,
      high: high,
      minimal: minimal,
      fadingLevel: high ? 0.2 : minimal ? 0.8 : 0.5,
    };
  },

  detectScarring: function (image, analysis) {
    // Detect scarring patterns that indicate healing stages
    let hasPinkishTan = false;
    let hasDarkRed = false;
    let hasWhiteScar = false;

    // Check color properties
    if (analysis.properties && analysis.properties.dominantColors) {
      const colors = analysis.properties.dominantColors;

      // Pinkish-tan scarring (healing)
      const pinkishTanColors = colors.filter(
        (color) =>
          color.color.red > 180 &&
          color.color.green > 120 &&
          color.color.green < 180 &&
          color.color.blue > 100 &&
          color.color.blue < 160
      );

      // Dark red scarring (fresh)
      const darkRedColors = colors.filter(
        (color) =>
          color.color.red > 120 &&
          color.color.red < 180 &&
          color.color.green < 100 &&
          color.color.blue < 100
      );

      // White scarring (healed)
      const whiteScarColors = colors.filter(
        (color) =>
          color.color.red > 200 &&
          color.color.green > 200 &&
          color.color.blue > 200 &&
          Math.abs(color.color.red - color.color.green) < 20 &&
          Math.abs(color.color.green - color.color.blue) < 20
      );

      hasPinkishTan =
        pinkishTanColors.reduce((sum, color) => sum + color.score, 0) > 0.15;
      hasDarkRed =
        darkRedColors.reduce((sum, color) => sum + color.score, 0) > 0.1;
      hasWhiteScar =
        whiteScarColors.reduce((sum, color) => sum + color.score, 0) > 0.2;
    }

    // Also look for healing-related terms in labels
    if (analysis.labels) {
      const healingLabels = analysis.labels.filter(
        (label) =>
          label.description.toLowerCase().includes("scar") ||
          label.description.toLowerCase().includes("healing") ||
          label.description.toLowerCase().includes("redness") ||
          label.description.toLowerCase().includes("treatment")
      );

      if (
        healingLabels.some(
          (label) =>
            label.description.toLowerCase().includes("redness") ||
            label.description.toLowerCase().includes("fresh")
        )
      ) {
        hasDarkRed = true;
      }

      if (
        healingLabels.some(
          (label) =>
            label.description.toLowerCase().includes("healed") ||
            label.description.toLowerCase().includes("scar")
        )
      ) {
        hasPinkishTan = true;
      }
    }

    return {
      hasPinkishTan,
      hasDarkRed,
      hasWhiteScar,
    };
  },

  detectCircleColors: function (image, analysis) {
    // Detect the predominant colors of the circular treatment areas
    let hasRedCircles = false;
    let hasSkinToneCircles = false;
    let hasPurpleOutlines = false;
    let hasLightCircles = false;

    // Use Visual API color analysis
    if (analysis.properties && analysis.properties.dominantColors) {
      const colors = analysis.properties.dominantColors;

      // Check for red circles
      const redColors = colors.filter(
        (color) =>
          color.color.red > 180 &&
          color.color.green < 120 &&
          color.color.blue < 120
      );

      // Check for skin-tone circles
      const skinToneColors = colors.filter(
        (color) =>
          color.color.red > 180 &&
          color.color.green > 140 &&
          color.color.green < 180 &&
          color.color.blue > 120 &&
          color.color.blue < 160
      );

      // Check for purple outlines
      const purpleColors = colors.filter(
        (color) =>
          color.color.red > 100 &&
          color.color.red < 180 &&
          color.color.green < 120 &&
          color.color.blue > 150
      );

      // Calculate presence based on color proportions
      hasRedCircles =
        redColors.reduce((sum, color) => sum + color.score, 0) > 0.1;
      hasSkinToneCircles =
        skinToneColors.reduce((sum, color) => sum + color.score, 0) > 0.15;
      hasPurpleOutlines =
        purpleColors.reduce((sum, color) => sum + color.score, 0) > 0.05;

      // Light circles have more skin tone but with some color variation
      hasLightCircles =
        hasSkinToneCircles &&
        colors.some(
          (color) =>
            Math.abs(color.color.red - color.color.green) > 30 ||
            Math.abs(color.color.green - color.color.blue) > 30
        );
    }

    // Check for circle-related terms in labels
    if (analysis.labels) {
      const circleLabels = analysis.labels.filter(
        (label) =>
          label.description.toLowerCase().includes("circle") ||
          label.description.toLowerCase().includes("dot") ||
          label.description.toLowerCase().includes("pattern")
      );

      // If we detect circles AND redness, they're probably red circles
      if (
        circleLabels.length > 0 &&
        analysis.labels.some(
          (l) =>
            l.description.toLowerCase().includes("red") ||
            l.description.toLowerCase().includes("blood")
        )
      ) {
        hasRedCircles = true;
      }
    }

    return {
      hasRedCircles,
      hasSkinToneCircles,
      hasPurpleOutlines,
      hasLightCircles,
    };
  },

  calculateCompletionPercentage: function (features, stage) {
    // Calculate approximate completion percentage
    switch (stage) {
      case "full tattoo":
        return 0;
      case "right after treatment":
        return 15;
      case "ready for next treatment":
        return 30;
      case "in treatment process":
        return 50;
      case "advanced stage":
        return 80;
      case "multiple treatments and likely complete":
        return 95;
      default:
        return 0;
    }
  },
};

// Add this new endpoint to server.js
app.post("/api/analyze-image", async (req, res) => {
  try {
    const { imagePath } = req.body;

    if (!imagePath) {
      return res.status(400).json({
        error: "Image path is required",
      });
    }

    // Fix path normalization issues
    let normalizedPath = imagePath;
    if (normalizedPath.startsWith("/")) {
      normalizedPath = normalizedPath.substring(1);
    }

    // Remove any spaces from the path
    normalizedPath = normalizedPath.trim();

    logger.info("Processing direct image analysis request", {
      service: "tatt2awai-bot",
      originalPath: imagePath,
      normalizedPath: normalizedPath,
    });

    // Check for cached analysis first
    const { data: cachedAnalysis } = await supabase
      .from("enhanced_image_analysis")
      .select("analysis")
      .eq("path", normalizedPath)
      .maybeSingle();

    if (cachedAnalysis?.analysis) {
      logger.info("Using cached analysis", {
        service: "tatt2awai-bot",
        path: normalizedPath,
      });

      // Format a human-readable description
      const formattedAnalysis = formatImageAnalysis(
        cachedAnalysis.analysis,
        normalizedPath
      );

      return res.json({
        success: true,
        path: normalizedPath,
        analysis: cachedAnalysis.analysis,
        description: formattedAnalysis,
        fromCache: true,
      });
    }

    // Ensure Dropbox connection
    const dropboxStatus = await storageManager.ensureAuth();
    if (!dropboxStatus) {
      throw new Error("Unable to connect to Dropbox");
    }

    // Download the image with proper error handling
    const fileData = await storageManager.downloadFile(normalizedPath);
    if (!fileData?.result?.fileBinary) {
      throw new Error("No binary data received from Dropbox");
    }

    const buffer = Buffer.isBuffer(fileData.result.fileBinary)
      ? fileData.result.fileBinary
      : Buffer.from(fileData.result.fileBinary);

    // Ensure VisionEnhancer is initialized
    if (!global.visionEnhancer) {
      global.visionEnhancer = new VisionEnhancer({
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        enableProperties: true,
      });
      await global.visionEnhancer.initialize();
    }

    // Analyze the image
    const visionAnalysis = await global.visionEnhancer.analyzeImage(buffer, {
      imagePath: normalizedPath,
    });

    // Run the enhanced tattoo removal analysis
    const removalAnalysis = enhancedTattooAnalysis.analyzeTattooRemovalStage(
      buffer,
      visionAnalysis
    );

    // Update the analysis with our improved removal assessment
    visionAnalysis.removalAnalysis = {
      ...visionAnalysis.removalAnalysis,
      ...removalAnalysis,
      isInRemovalProcess:
        removalAnalysis.isInRemovalProcess ||
        visionAnalysis.removalAnalysis?.isInRemovalProcess ||
        false,
    };

    // Cache the analysis
    await supabase.from("enhanced_image_analysis").upsert({
      path: normalizedPath,
      analysis: visionAnalysis,
      created_at: new Date().toISOString(),
    });

    const conversationalAnalysis = createNaturalTattooDescription(
      visionAnalysis,
      normalizedPath
    );

    return res.json({
      success: true,
      path: normalizedPath,
      analysis: visionAnalysis,
      description: conversationalAnalysis,
      fromCache: false,
    });
  } catch (error) {
    logger.error("Direct image analysis error:", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
      path: req.body.imagePath,
    });

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Add this function to improve the conversational nature of analysis responses

/**
 * Creates a natural, conversational analysis of a tattoo image
 * @param {Object} analysis - The full analysis object
 * @param {string} imagePath - Path to the analyzed image
 * @returns {string} - Conversational description of the analysis
 */
function createNaturalTattooDescription(analysis, imagePath) {
  // Get filename for reference
  const filename = path.basename(imagePath);

  // Start with a conversational opening
  let response = `I took a close look at the image "${filename}". `;

  // Basic content identification
  if (analysis.labels && analysis.labels.length > 0) {
    response += `This appears to show ${analysis.labels[0].description.toLowerCase()}`;

    // Add additional top labels for more context
    if (analysis.labels.length > 1) {
      const additionalLabels = analysis.labels
        .slice(1, 3)
        .map((l) => l.description.toLowerCase())
        .join(" and ");
      response += ` with ${additionalLabels}. `;
    } else {
      response += ". ";
    }
  } else {
    response += "This appears to be a photo related to tattoo work. ";
  }

  // Tattoo-specific analysis with more natural language
  if (analysis.tattooInsights && analysis.tattooInsights.isTattoo) {
    // Describe the tattoo location
    if (analysis.tattooInsights.bodyPart) {
      response += `I can see this is a tattoo on the ${analysis.tattooInsights.bodyPart}. `;
    } else {
      response += "I can see this is a tattoo. ";
    }

    // Describe the style if available
    if (analysis.tattooInsights.style) {
      response += `The style appears to be ${analysis.tattooInsights.style}, `;
    }

    // Describe colors naturally
    if (
      analysis.tattooInsights.colors &&
      analysis.tattooInsights.colors.length > 0
    ) {
      if (analysis.tattooInsights.colors.length === 1) {
        response += `primarily using ${analysis.tattooInsights.colors[0].name} ink. `;
      } else {
        const colors = analysis.tattooInsights.colors
          .slice(0, 3)
          .map((c) => c.name)
          .join(", ");
        response += `featuring ${colors} coloration. `;
      }
    }

    // Describe the subject if identifiable
    if (analysis.tattooInsights.subject) {
      response += `The tattoo depicts ${analysis.tattooInsights.subject}. `;
    } else if (
      analysis.tattooInsights.tattooFeatures &&
      analysis.tattooInsights.tattooFeatures.length > 0
    ) {
      const features = analysis.tattooInsights.tattooFeatures
        .slice(0, 3)
        .join(", ");
      response += `I can identify elements including ${features}. `;
    }
  }

  // Removal analysis with personalized, empathetic language
  if (analysis.removalAnalysis && analysis.removalAnalysis.isInRemovalProcess) {
    response += "\n\nRegarding tattoo removal progress, ";

    // Describe the removal stage
    if (analysis.removalAnalysis.stage) {
      response += `this appears to be in the "${analysis.removalAnalysis.stage}" stage. `;
    } else if (analysis.removalAnalysis.removalStage) {
      response += `this appears to be in the ${analysis.removalAnalysis.removalStage} phase. `;
    } else {
      response += "this tattoo appears to be in the process of being removed. ";
    }

    // Add details about the removal method if detected
    if (analysis.removalAnalysis.removalMethod) {
      if (analysis.removalAnalysis.removalMethod === "tatt2away") {
        response +=
          "I can see the characteristic circular patterns of the Tatt2Away treatment method. ";
      } else if (analysis.removalAnalysis.removalMethod === "laser") {
        response +=
          "The fading pattern is consistent with laser removal treatment. ";
      } else {
        response += `The removal appears to be using ${analysis.removalAnalysis.removalMethod} technology. `;
      }
    }

    // Add progress percentage with appropriate wording
    if (
      analysis.removalAnalysis.progress &&
      analysis.removalAnalysis.progress.fadingPercentage
    ) {
      const percentage = analysis.removalAnalysis.progress.fadingPercentage;

      if (percentage < 25) {
        response +=
          "The removal process appears to be in its early stages with minimal fading so far. ";
      } else if (percentage < 50) {
        response +=
          "The removal is showing good progress with noticeable fading. ";
      } else if (percentage < 75) {
        response +=
          "The removal is quite advanced with significant fading evident. ";
      } else {
        response +=
          "The removal is nearly complete with very little pigment remaining visible. ";
      }

      // Add exact percentage
      response += `I'd estimate the progress at approximately ${percentage}% complete. `;
    }

    // Add healing stage indicators if available
    if (
      analysis.removalAnalysis.healingIndicators &&
      analysis.removalAnalysis.healingIndicators.length > 0
    ) {
      const healing = analysis.removalAnalysis.healingIndicators.join(", ");
      response += `I notice signs of ${healing}, `;

      if (analysis.removalAnalysis.timeframe === "recent") {
        response +=
          "suggesting this is a recent treatment that's still healing. ";
      } else if (analysis.removalAnalysis.timeframe === "healing") {
        response += "indicating this is in an active healing phase. ";
      } else {
        response += "which are typical during the recovery process. ";
      }
    }

    // Add estimated number of sessions if analyzing a partly removed tattoo
    if (analysis.removalAnalysis.sessionNumber) {
      response += `This appears to be after session #${analysis.removalAnalysis.sessionNumber}. `;
    } else if (
      analysis.removalAnalysis.progress &&
      analysis.removalAnalysis.progress.fadingPercentage > 30
    ) {
      // If no explicit session number but significant fading, estimate
      const estimatedSessions = Math.ceil(
        analysis.removalAnalysis.progress.fadingPercentage / 25
      );
      response += `Based on the fading level, this may have undergone approximately ${estimatedSessions} treatment sessions so far. `;
    }

    // Add specific professional advice based on removal stage
    response += "\n\nProfessional assessment: ";

    if (
      analysis.removalAnalysis.stage === "ready for treatment #2" ||
      (analysis.removalAnalysis.sessionNumber === 1 &&
        analysis.removalAnalysis.timeframe !== "recent")
    ) {
      response +=
        "The area appears well-healed from the previous treatment and shows good progress. The characteristic healing patterns indicate it's likely ready for the next treatment session. This would be an appropriate time to schedule your follow-up appointment.";
    } else if (
      analysis.removalAnalysis.stage === "right after first treatment" ||
      (analysis.removalAnalysis.sessionNumber === 1 &&
        analysis.removalAnalysis.timeframe === "recent")
    ) {
      response +=
        "This looks like a recent treatment where proper healing is essential. Continue following your aftercare instructions carefully - keep the area clean, avoid sun exposure, and don't pick at any scabs that form. Allow 6-8 weeks of healing before your next appointment for optimal results.";
    } else if (
      analysis.removalAnalysis.progress &&
      analysis.removalAnalysis.progress.fadingPercentage > 75
    ) {
      response +=
        "The tattoo shows excellent fading with minimal pigment remaining visible. The removal process appears to be largely complete. A follow-up assessment might be beneficial to determine if any additional touch-up treatments are needed for any subtle remaining pigment.";
    } else if (
      analysis.removalAnalysis.progress &&
      analysis.removalAnalysis.progress.fadingPercentage > 50
    ) {
      response +=
        "The removal is progressing well with significant fading. Continue with your scheduled treatments as the process seems to be effectively breaking down the ink. Maintaining consistent treatment intervals will help achieve optimal results.";
    } else if (analysis.removalAnalysis.timeframe === "recent") {
      response +=
        "This appears to be a recent treatment that's actively healing. Focus on proper aftercare: keep the area clean, apply any prescribed ointments, avoid sun exposure, and don't disturb any scabs that form. Proper healing between treatments is crucial for successful removal.";
    } else {
      response +=
        "The tattoo is currently in the removal process. Continue following your treatment schedule and aftercare instructions for optimal results. Remember that tattoo removal is a gradual process that typically requires multiple sessions spaced several weeks apart.";
    }
  } else if (analysis.tattooInsights && analysis.tattooInsights.isTattoo) {
    // For tattoos that aren't in removal process
    response +=
      "\n\nThis appears to be a full tattoo that hasn't begun the removal process. ";

    // Add details about ink density and color complexity
    if (
      analysis.tattooInsights.colors &&
      analysis.tattooInsights.colors.length > 2
    ) {
      response +=
        "The tattoo contains multiple colors, which is important to note if considering removal. Multi-colored tattoos typically require more sessions than single-color designs as different pigments respond differently to treatments. ";
    } else if (
      analysis.tattooInsights.colors &&
      analysis.tattooInsights.colors.some((c) => c.name === "black")
    ) {
      response +=
        "The tattoo appears to be primarily black ink, which generally responds well to removal treatments. Black ink typically fades more consistently than colored inks. ";
    }

    // Add information about tattoo location if identified
    if (analysis.tattooInsights.bodyPart) {
      response += `The ${analysis.tattooInsights.bodyPart} location `;

      // Add location-specific insights
      if (
        ["wrist", "ankle", "foot", "hand"].includes(
          analysis.tattooInsights.bodyPart
        )
      ) {
        response +=
          "is an area with less body fat and blood flow, which can make removal slightly more challenging but still very achievable. ";
      } else if (
        ["upper arm", "thigh", "shoulder", "back"].includes(
          analysis.tattooInsights.bodyPart
        )
      ) {
        response +=
          "is an area with good blood circulation, which typically responds well to removal treatments. ";
      } else if (["face", "neck"].includes(analysis.tattooInsights.bodyPart)) {
        response +=
          "is a sensitive area that requires careful treatment by an experienced professional. ";
      } else {
        response +=
          "can be effectively treated with proper removal techniques. ";
      }
    }

    response +=
      "If you're considering removal, I'd recommend consulting with a tattoo removal specialist who can provide a personalized assessment and treatment plan based on the specific characteristics of your tattoo.";
  }

  return response;
}

// Helper function to format image analysis into a human-readable description
function formatImageAnalysis(analysis, imagePath) {
  let description = `## Analysis of ${path.basename(imagePath)}\n\n`;

  // Add labels if available
  if (analysis.labels && analysis.labels.length > 0) {
    description += "### Image Content\n";
    const topLabels = analysis.labels
      .slice(0, 5)
      .map(
        (label) =>
          `${label.description} (${(label.confidence * 100).toFixed(1)}%)`
      )
      .join(", ");
    description += `Content identified as: ${topLabels}.\n\n`;
  }

  // Add tattoo analysis if available
  if (analysis.tattooInsights) {
    const insights = analysis.tattooInsights;

    description += "### Tattoo Analysis\n";

    if (insights.isTattoo) {
      description += "This image contains a tattoo";

      if (insights.bodyPart) {
        description += ` located on the ${insights.bodyPart}`;
      }

      description += ".\n\n";

      // Add color information
      if (insights.colors && insights.colors.length > 0) {
        const colorInfo = insights.colors
          .slice(0, 3)
          .map((color) => color.name)
          .join(", ");
        description += `**Colors**: Primarily ${colorInfo}\n\n`;
      }

      // Add style if available
      if (insights.style) {
        description += `**Style**: ${insights.style}\n\n`;
      }
    } else {
      description += "This image does not appear to contain a tattoo.\n\n";
    }
  }

  // Add removal analysis if available
  if (analysis.removalAnalysis) {
    const removal = analysis.removalAnalysis;

    description += "### Removal Analysis\n";

    if (removal.isInRemovalProcess) {
      description += "This tattoo appears to be in the process of removal.\n\n";

      if (removal.removalStage) {
        description += `**Stage**: ${removal.removalStage}\n\n`;
      }

      if (removal.progress && removal.progress.fadingPercentage) {
        description += `**Fading**: Approximately ${removal.progress.fadingPercentage}% faded\n\n`;
      }
    } else if (analysis.tattooInsights?.isTattoo) {
      description +=
        "This tattoo does not appear to be in the process of removal.\n\n";
    }
  }

  return description;
}

/**
 * Reverse Image Search API
 * Allows searching for similar images using either uploads or paths
 */
app.post("/api/search/image", upload.single("image"), async (req, res) => {
  try {
    const { imagePath, limit = 10, threshold = 0.6 } = req.body;
    let searchPath = imagePath;
    let tempFile = null;

    // If an image was uploaded, use that instead of a path
    if (req.file) {
      searchPath = req.file.path;
      tempFile = req.file.path;
    } else if (!imagePath) {
      return res.status(400).json({
        error: "Either upload an image or provide an imagePath",
        timestamp: new Date().toISOString(),
      });
    }

    logger.info("Processing image search request:", {
      service: "tatt2awai-bot",
      searchPath,
      isUpload: !!req.file,
      limit,
      threshold,
    });

    // First try using RobustImageMatcher for visual search
    let results = [];

    if (global.imageMatcher) {
      try {
        const searchResults = await global.imageMatcher.findMatchesWithMode(
          searchPath,
          "full",
          {
            maxMatches: limit,
            threshold: parseFloat(threshold),
          }
        );

        results = searchResults.matches.map((match) => ({
          path: match.path,
          score: parseFloat(match.score),
          confidence: parseFloat(match.confidence),
          source: "visual_analysis",
          viewableLink: `/image-viewer?path=${encodeURIComponent(match.path)}`, // Add viewable link
        }));

        // Enhance top matches with Vision API
        for (const match of results.slice(0, 5)) {
          try {
            if (!match.visionAnalysis && global.visionEnhancer) {
              const fileData = await storageManager.downloadFile(match.path);
              if (fileData?.result?.fileBinary) {
                const buffer = Buffer.isBuffer(fileData.result.fileBinary)
                  ? fileData.result.fileBinary
                  : Buffer.from(fileData.result.fileBinary);

                // Get vision analysis
                const visionAnalysis = await global.visionEnhancer.analyzeImage(
                  buffer,
                  { imagePath: match.path }
                );

                // Add to match
                match.visionAnalysis = visionAnalysis;

                // Cache the analysis
                await supabase.from("enhanced_image_analysis").upsert({
                  path: match.path,
                  analysis: visionAnalysis,
                  created_at: new Date().toISOString(),
                });
              }
            }
          } catch (enhanceError) {
            logger.warn("Error enhancing match with vision", {
              error: enhanceError.message,
              path: match.path,
            });
          }
        }
      } catch (matcherError) {
        logger.error("Error using RobustImageMatcher:", {
          service: "tatt2awai-bot",
          error: matcherError.message,
          searchPath,
        });
      }
    }

    // Generate detailed analysis for top match
    const topMatchAnalysis =
      results.length > 0 && results[0].visionAnalysis
        ? generateDetailedTattooAnalysis(results[0])
        : null;

    // If no results from matcher, try the knowledge base
    if (results.length === 0) {
      try {
        const kbResults = await knowledgeBase.findSimilarImages(searchPath, {
          limit: parseInt(limit),
          threshold: parseFloat(threshold),
        });

        results = kbResults.map((result) => ({
          ...result,
          source: "knowledge_base",
        }));

        logger.info("Knowledge base search completed:", {
          service: "tatt2awai-bot",
          matchCount: results.length,
          searchPath,
        });
      } catch (kbError) {
        logger.error("Error using knowledge base search:", {
          service: "tatt2awai-bot",
          error: kbError.message,
          searchPath,
        });
      }
    }

    // Return the search results
    res.json({
      success: true,
      query: {
        path: searchPath,
        isUpload: !!req.file,
        limit,
        threshold,
      },
      results: results.slice(0, parseInt(limit)),
      topMatchAnalysis,
      count: results.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Image search error:", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: "Failed to process image search",
      details: error.message,
      timestamp: new Date().toISOString(),
    });
  } finally {
    // Clean up temp file if one was created for an upload
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        logger.warn("Failed to clean up temp file:", {
          service: "tatt2awai-bot",
          path: req.file.path,
          error: cleanupError.message,
        });
      }
    }
  }
});

/**
 * Combo Search API
 * Search both text and images at once with optional OpenAI assistance
 */
app.post("/api/search/combo", upload.single("image"), async (req, res) => {
  try {
    const { query, useAI = false, limit = 10 } = req.body;
    const userId = req.body.userId || "default-user";
    let imageData = null;

    // If an image was uploaded, read it
    if (req.file) {
      imageData = fs.readFileSync(req.file.path);
    }

    logger.info("Processing combo search request:", {
      service: "tatt2awai-bot",
      hasQuery: !!query,
      hasImage: !!imageData,
      useAI,
      limit,
    });

    // Handle different search scenarios
    let results = {};

    // Text search if query provided
    if (query) {
      try {
        const textResults = await knowledgeBase.searchDocuments(query, {
          limit: parseInt(limit),
        });

        results.text = textResults;

        logger.info("Text search completed:", {
          service: "tatt2awai-bot",
          matchCount: textResults.length,
          query,
        });
      } catch (textError) {
        logger.error("Text search error:", {
          service: "tatt2awai-bot",
          error: textError.message,
          query,
        });

        results.text = { error: textError.message };
      }
    }

    // Image search if image uploaded
    if (imageData) {
      try {
        const imageResults = await global.imageMatcher.findMatchesWithMode(
          req.file.path,
          "full",
          {
            maxMatches: parseInt(limit),
            threshold: 0.6,
          }
        );

        results.image = imageResults.matches;

        logger.info("Image search completed:", {
          service: "tatt2awai-bot",
          matchCount: imageResults.matches.length,
          path: req.file.path,
        });
      } catch (imageError) {
        logger.error("Image search error:", {
          service: "tatt2awai-bot",
          error: imageError.message,
          path: req.file?.path,
        });

        results.image = { error: imageError.message };
      }
    }

    // Optional: Use OpenAI to analyze the results if requested
    if (useAI && (results.text || results.image)) {
      try {
        const aiMessage =
          `I'm searching for: ${query || "Similar images"}.\n\n` +
          `Text search results: ${
            results.text ? JSON.stringify(results.text.slice(0, 3)) : "None"
          }\n\n` +
          `Image search results: ${
            results.image ? JSON.stringify(results.image.slice(0, 3)) : "None"
          }\n\n` +
          `Please analyze these results and provide insights.`;

        const aiResponse = await openaiClient.processUserMessage(
          userId,
          aiMessage,
          imageData
        );

        results.analysis = aiResponse.content;

        logger.info("AI analysis completed:", {
          service: "tatt2awai-bot",
          hasAnalysis: !!results.analysis,
          userId,
        });
      } catch (aiError) {
        logger.error("AI analysis error:", {
          service: "tatt2awai-bot",
          error: aiError.message,
          userId,
        });

        results.analysis = { error: aiError.message };
      }
    }

    // Return the combined results
    res.json({
      success: true,
      query: {
        text: query || null,
        hasImage: !!imageData,
        useAI,
        limit,
      },
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Combo search error:", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: "Failed to process combo search",
      details: error.message,
      timestamp: new Date().toISOString(),
    });
  } finally {
    // Clean up temp file if one was created
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        logger.warn("Failed to clean up temp file:", {
          service: "tatt2awai-bot",
          path: req.file.path,
          error: cleanupError.message,
        });
      }
    }
  }
});

/**
 * Image Analysis API
 * Analyze an image with various methods and store results
 */
app.post("/api/analyze/image", upload.single("image"), async (req, res) => {
  try {
    const { imagePath, storeResults = true } = req.body;
    let analysisPath = imagePath;
    let tempFile = null;

    // If an image was uploaded, use that instead of a path
    if (req.file) {
      analysisPath = req.file.path;
      tempFile = req.file.path;
    } else if (!imagePath) {
      return res.status(400).json({
        error: "Either upload an image or provide an imagePath",
        timestamp: new Date().toISOString(),
      });
    }

    logger.info("Processing image analysis request:", {
      service: "tatt2awai-bot",
      analysisPath,
      isUpload: !!req.file,
      storeResults,
    });

    // Use RobustImageMatcher for analysis if available
    let analysis = null;
    if (
      global.imageMatcher &&
      typeof global.imageMatcher.analyzeImage === "function"
    ) {
      try {
        analysis = await global.imageMatcher.analyzeImage(analysisPath);

        logger.info("Image analysis completed:", {
          service: "tatt2awai-bot",
          hasAnalysis: !!analysis,
          analysisPath,
        });
      } catch (analysisError) {
        logger.error("Error analyzing image:", {
          service: "tatt2awai-bot",
          error: analysisError.message,
          analysisPath,
        });

        throw analysisError;
      }
    } else {
      // Fallback to basic image analysis using Sharp
      try {
        const image = require("sharp")(analysisPath);
        const metadata = await image.metadata();
        const stats = await image.stats();

        analysis = {
          metadata,
          stats,
          dimensions: {
            width: metadata.width,
            height: metadata.height,
            aspectRatio: metadata.width / metadata.height,
          },
          format: metadata.format,
          colorInfo: {
            channels: metadata.channels,
            channelStats: stats.channels,
          },
        };

        logger.info("Basic image analysis completed:", {
          service: "tatt2awai-bot",
          hasAnalysis: !!analysis,
          analysisPath,
        });
      } catch (fallbackError) {
        logger.error("Error in fallback image analysis:", {
          service: "tatt2awai-bot",
          error: fallbackError.message,
          analysisPath,
        });

        throw fallbackError;
      }
    }

    // Store results if requested
    let storageResult = null;
    if (storeResults && analysis) {
      try {
        storageResult = await knowledgeBase.processImageAnalysis(
          analysisPath,
          analysis,
          { storeEmbeddings: true }
        );

        logger.info("Analysis stored in knowledge base:", {
          service: "tatt2awai-bot",
          success: !!storageResult && !storageResult.error,
          analysisPath,
        });
      } catch (storageError) {
        logger.error("Error storing analysis:", {
          service: "tatt2awai-bot",
          error: storageError.message,
          analysisPath,
        });
      }
    }

    // Return the analysis results
    res.json({
      success: true,
      query: {
        path: analysisPath,
        isUpload: !!req.file,
        storeResults,
      },
      analysis,
      storage: storageResult,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Image analysis error:", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: "Failed to analyze image",
      details: error.message,
      timestamp: new Date().toISOString(),
    });
  } finally {
    // Clean up temp file if one was created
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        logger.warn("Failed to clean up temp file:", {
          service: "tatt2awai-bot",
          path: req.file.path,
          error: cleanupError.message,
        });
      }
    }
  }
});

/**
 * Dropbox Search API
 * Search the Dropbox repository for images and content
 */
app.post("/api/search/dropbox", async (req, res) => {
  try {
    const { query, type = "all", limit = 20 } = req.body;

    if (!query) {
      return res.status(400).json({
        error: "Search query is required",
        timestamp: new Date().toISOString(),
      });
    }

    logger.info("Processing Dropbox search request:", {
      service: "tatt2awai-bot",
      query,
      type,
      limit,
    });

    // Use the existimg openaiClient search function
    const searchResults = await openaiClient.handleSearchFunction({
      query_type: type,
      message: query,
      include_analysis: true,
    });

    // Return formatted results
    res.json({
      success: true,
      query: {
        text: query,
        type,
        limit,
      },
      results: searchResults.results || [],
      total: searchResults.total || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Dropbox search error:", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: "Failed to search Dropbox",
      details: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Chat history API
 * Get the chat history for a user
 */
app.get("/api/chat/history/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        error: "User ID is required",
        timestamp: new Date().toISOString(),
      });
    }

    logger.info("Retrieving chat history:", {
      service: "tatt2awai-bot",
      userId,
    });

    // Get the user's thread ID
    const threadId = await openaiClient.getOrCreateThread(userId);

    // Get messages for this thread
    const messages = await openaiClient.listMessages(threadId);

    // Return the messages
    res.json({
      success: true,
      userId,
      threadId,
      messages: messages,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Chat history error:", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: "Failed to retrieve chat history",
      details: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Helper function to ensure OpenAI client has the listMessages method
if (!openaiClient.listMessages) {
  openaiClient.listMessages = async (threadId) => {
    try {
      const messages = await openaiClient.openai.beta.threads.messages.list(
        threadId
      );
      return messages.data.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content[0]?.text?.value || "",
        createdAt: msg.created_at,
      }));
    } catch (error) {
      logger.error("Error listing messages:", {
        service: "tatt2awai-bot",
        error: error.message,
        threadId,
      });
      return [];
    }
  };
}

app.post(
  "/search/enhanced-visual",
  upload.single("image"),
  async (req, res) => {
    const processingId = crypto.randomUUID();
    const tempFiles = new Set();
    const startTime = Date.now();
    let imgMat = null;
    let requestTimeoutId = null;

    try {
      // Set an overall request timeout
      const requestTimeout = parseInt(req.body.timeout) || 60000; // 60 seconds default
      const timeoutPromise = new Promise((_, reject) => {
        requestTimeoutId = setTimeout(() => {
          reject(new Error("Request timed out after " + requestTimeout + "ms"));
        }, requestTimeout);
      });

      // Validate input
      if (!req.file && !req.body.imagePath) {
        return res.status(400).json({
          error: "No image provided",
          code: "MISSING_IMAGE",
          processingId,
        });
      }

      // Validate mode parameter
      const mode = req.body.mode || "auto"; // Default to auto if not specified
      if (!["auto", "tensor", "partial", "full", "combined"].includes(mode)) {
        return res.status(400).json({
          error:
            "Invalid search mode. Must be one of: auto, tensor, partial, full, combined",
          code: "INVALID_MODE",
          processingId,
        });
      }

      const useVision = req.body.useVision !== "false"; // Default to true

      logger.info("Starting enhanced visual search", {
        service: "tatt2awai-bot",
        processingId,
        hasFile: !!req.file,
        filename: req.file?.originalname || req.body.imagePath,
        mode,
        useVision,
        requestTimeout,
      });

      // Handle image input
      let imageBuffer;
      let imageSource;
      let imagePath;

      try {
        if (req.file) {
          // Use the promises API to read the file
          imageBuffer = await fs.readFile(req.file.path);
          tempFiles.add(req.file.path);
          imageSource = "upload";
          imagePath = req.file.path;
        } else {
          const storageManager = require("./storageManager");

          // Add timeout to Dropbox download
          const downloadPromise = storageManager.downloadFile(
            req.body.imagePath
          );
          const fileData = await Promise.race([
            downloadPromise,
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("Dropbox download timed out")),
                15000
              )
            ),
          ]);

          if (!fileData?.result?.fileBinary) {
            throw new Error("Failed to download image from Dropbox");
          }

          imageBuffer = Buffer.isBuffer(fileData.result.fileBinary)
            ? fileData.result.fileBinary
            : Buffer.from(fileData.result.fileBinary);

          imageSource = "dropbox";
          imagePath = req.body.imagePath;

          // Save to temp file for processing if needed
          const tempPath = path.join(
            uploadDir,
            `temp_${Date.now()}_${path.basename(req.body.imagePath)}`
          );
          await fs.writeFile(tempPath, imageBuffer);
          tempFiles.add(tempPath);
          imagePath = tempPath;
        }

        // Validate image
        imgMat = cv.imdecode(Buffer.from(imageBuffer));
        if (!imgMat || imgMat.empty) {
          throw new Error("Failed to decode image");
        }

        // Get image dimensions for logging and debugging
        const dimensions = {
          width: imgMat.cols,
          height: imgMat.rows,
          channels: imgMat.channels,
          type: imgMat.type,
        };

        logger.info("Image validated and decoded", {
          service: "tatt2awai-bot",
          processingId,
          dimensions,
          source: imageSource,
        });
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

      // Configure matching options based on selected mode
      const matchOptions = {
        maxMatches: req.body.limit ? parseInt(req.body.limit) : 20,
        threshold: parseFloat(
          req.body.threshold || (mode === "partial" ? "0.4" : "0.6")
        ),
        timeout: Math.floor(requestTimeout * 0.8), // 80% of total timeout for matching
        useCache: req.body.useCache !== "false",
      };

      // Run search with the appropriate method
      let matchResult;

      // Use Promise.race to apply timeout to the search
      try {
        const searchPromise = async () => {
          switch (mode) {
            case "auto":
              return await imageMatcher.findCombinedMatches(
                imageBuffer,
                matchOptions
              );
            case "partial":
              return await imageMatcher.findOptimizedPartialMatches(
                imageBuffer,
                matchOptions
              );
            case "combined":
              return await imageMatcher.findCombinedMatches(imageBuffer, {
                ...matchOptions,
                mode: "partial", // Force partial mode in combined matching
              });
            case "full":
              return await imageMatcher.findFullMatches(
                imageBuffer,
                matchOptions
              );
            default: // tensor
              return await imageMatcher.findMatchesWithMode(
                imageBuffer,
                "tensor",
                matchOptions
              );
          }
        };

        matchResult = await Promise.race([searchPromise(), timeoutPromise]);

        logger.info(`${mode} matching completed`, {
          service: "tatt2awai-bot",
          processingId,
          duration: Date.now() - startTime,
          matchCount: matchResult.matches?.length || 0,
        });
      } catch (searchError) {
        logger.error(`${mode} matching failed:`, {
          service: "tatt2awai-bot",
          processingId,
          error: searchError.message,
          duration: Date.now() - startTime,
        });

        return res
          .status(searchError.message.includes("timed out") ? 408 : 500)
          .json({
            error: "Image search failed",
            details: searchError.message,
            code: searchError.message.includes("timed out")
              ? "SEARCH_TIMEOUT"
              : "SEARCH_ERROR",
            processingId,
          });
      }

      // Get base matches
      const baseMatches = matchResult.matches || [];

      // Process with Vision API if enabled and we have matches
      let enhancedMatches = baseMatches;
      let queryImageAnalysis = null;

      if (useVision && baseMatches.length > 0) {
        logger.info("Enhancing with Vision API", {
          service: "tatt2awai-bot",
          processingId,
          matchCount: baseMatches.length,
        });

        try {
          // Set a timeout specific to Vision enhancement
          const visionTimeoutMs = Math.min(
            30000,
            requestTimeout - (Date.now() - startTime)
          );

          // Analyze the query image with Vision API (with timeout)
          const visionPromise = visionEnhancer.analyzeImage(imageBuffer, {
            timeout: visionTimeoutMs * 0.3, // 30% of remaining time for query analysis
          });

          queryImageAnalysis = await Promise.race([
            visionPromise,
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("Vision API query analysis timed out")),
                visionTimeoutMs * 0.3
              )
            ),
          ]);

          // Use Vision API to enhance match scoring (with timeout)
          const enhancementPromise = visionEnhancer.enhanceMatchScoring(
            baseMatches,
            queryImageAnalysis
          );

          enhancedMatches = await Promise.race([
            enhancementPromise,
            new Promise(
              (_, reject) =>
                setTimeout(
                  () => reject(new Error("Vision API enhancement timed out")),
                  visionTimeoutMs * 0.7
                ) // 70% of remaining time for match enhancement
            ),
          ]);

          logger.info("Enhanced matches with Vision API", {
            service: "tatt2awai-bot",
            processingId,
            originalMatchCount: baseMatches.length,
            enhancedMatchCount: enhancedMatches.length,
            visionDuration:
              Date.now() -
              (startTime + (Date.now() - startTime - visionTimeoutMs)),
          });
        } catch (visionError) {
          logger.error("Vision enhancement failed:", {
            service: "tatt2awai-bot",
            processingId,
            error: visionError.message,
            errorCode: visionError.code || visionError.status,
          });

          // If it's a timeout, log specifically
          if (visionError.message.includes("timed out")) {
            logger.warn(
              "Vision API timed out, falling back to tensor matches",
              {
                service: "tatt2awai-bot",
                processingId,
              }
            );
          }

          // Fall back to tensor matches if vision fails
          enhancedMatches = baseMatches;
        }
      }

      // Make sure we still have at least some matches
      if (enhancedMatches.length === 0) {
        logger.warn("No significant matches found", {
          service: "tatt2awai-bot",
          processingId,
          threshold: matchOptions.threshold,
        });
      }

      // Filter to significant matches and format for response
      const significantMatches = enhancedMatches
        .filter((match) => parseFloat(match.score) > matchOptions.threshold)
        .slice(0, matchOptions.maxMatches);

      // Format the matches for response, including vision analysis if available
      const formattedMatches = await Promise.all(
        significantMatches.map(async (match) => {
          // Base match info
          const result = {
            path: match.path,
            score:
              typeof match.score === "number"
                ? match.score.toFixed(4)
                : match.score,
            confidence:
              typeof match.confidence === "number"
                ? match.confidence.toFixed(4)
                : match.confidence,
            metrics: {
              embedding:
                typeof match.metrics?.embedding === "number"
                  ? parseFloat(match.metrics.embedding.toFixed(4))
                  : match.metrics?.embedding,
              geometric:
                typeof match.metrics?.geometric === "number"
                  ? parseFloat(match.metrics.geometric.toFixed(4))
                  : match.metrics?.geometric,
              spatial:
                typeof match.metrics?.spatial === "number"
                  ? parseFloat(match.metrics.spatial.toFixed(4))
                  : match.metrics?.spatial,
            },
          };

          // Add semantic scores if available
          if (match.semanticScores) {
            result.semanticScores = {
              total: parseFloat(match.semanticScores.total.toFixed(4)),
              labels: parseFloat(match.semanticScores.labels.toFixed(4)),
              tattooSpecific: parseFloat(
                match.semanticScores.tattooSpecific.toFixed(4)
              ),
            };
          }

          // Add enhanced confidence if available
          if (match.enhancedConfidence) {
            result.enhancedConfidence = match.enhancedConfidence;
          }

          // Add Vision API analysis if available
          if (match.visionAnalysis) {
            result.visionAnalysis = match.visionAnalysis;
          } else if (match.analysis) {
            // Extract relevant analysis data
            result.visionAnalysis = {
              labels: match.analysis.labels?.slice(0, 5) || [],
              tattooInsights: match.analysis.tattooInsights || {},
              removalAnalysis: match.analysis.removalAnalysis || {},
            };
          } else if (useVision) {
            // Try to fetch analysis from database if not already available
            try {
              const { supabase } = require("./knowledgeBase");
              const { data, error } = await supabase
                .from("enhanced_image_analysis")
                .select("analysis")
                .eq("path", match.path)
                .maybeSingle();

              if (data?.analysis) {
                result.visionAnalysis = {
                  labels: data.analysis.labels?.slice(0, 5) || [],
                  tattooInsights: data.analysis.tattooInsights || {},
                  removalAnalysis: data.analysis.removalAnalysis || {},
                  source: "database",
                };
              }
            } catch (dbError) {
              logger.warn(`Error fetching analysis for ${match.path}:`, {
                service: "tatt2awai-bot",
                error: dbError.message,
                processingId,
              });
            }
          }

          // Add partial match details if present
          if (match.partialMatchDetails) {
            result.partialMatchDetails = match.partialMatchDetails;
          }

          // Add match reasoning
          result.matchReasoning =
            match.matchReasoning ||
            generateMatchReasoning(match, result.visionAnalysis);

          return result;
        })
      );

      // Clear the timeout since we're about to respond successfully
      if (requestTimeoutId) {
        clearTimeout(requestTimeoutId);
        requestTimeoutId = null;
      }

      // Prepare the response
      const response = {
        success: true,
        processingId,
        matchCount: formattedMatches.length,
        mode: mode,
        matches: formattedMatches,
        queryAnalysis:
          useVision && queryImageAnalysis
            ? {
                labels: queryImageAnalysis.labels?.slice(0, 10) || [],
                tattooInsights: queryImageAnalysis.tattooInsights || {},
                text: queryImageAnalysis.text?.fullText || null,
                removalAnalysis: queryImageAnalysis.removalAnalysis || {},
              }
            : null,
        stats: {
          processingTime: Date.now() - startTime,
          tensorDuration: matchResult.stats?.duration || 0,
          visionDuration:
            useVision && queryImageAnalysis
              ? Date.now() - startTime - (matchResult.stats?.duration || 0)
              : 0,
          totalSignaturesSearched: imageMatcher.signatureCache.size,
          ...matchResult.stats,
        },
      };

      logger.info("Search completed successfully", {
        service: "tatt2awai-bot",
        processingId,
        matchCount: formattedMatches.length,
        totalDuration: Date.now() - startTime,
        mode: mode,
        useVision,
        querySizeBytes: imageBuffer.length,
      });

      return res.json(response);
    } catch (error) {
      // Clear timeout if it exists
      if (requestTimeoutId) {
        clearTimeout(requestTimeoutId);
        requestTimeoutId = null;
      }

      logger.error("Unhandled search error:", {
        service: "tatt2awai-bot",
        error: error.message,
        stack: error.stack,
        processingId,
      });

      // Categorize errors for better client handling
      let statusCode = 500;
      let errorCode = "SEARCH_ERROR";

      if (error.message.includes("timed out")) {
        statusCode = 408;
        errorCode = "SEARCH_TIMEOUT";
      } else if (
        error.code === 409 ||
        error.status === 409 ||
        error.message.includes("409")
      ) {
        statusCode = 409;
        errorCode = "CONFLICT_ERROR";
      } else if (
        error.code === 429 ||
        error.status === 429 ||
        error.message.includes("rate limit")
      ) {
        statusCode = 429;
        errorCode = "RATE_LIMIT_ERROR";
      }

      return res.status(statusCode).json({
        error: "Failed to process image",
        details: error.message,
        code: errorCode,
        processingId,
        duration: Date.now() - startTime,
      });
    } finally {
      // Cleanup temp files
      for (const file of tempFiles) {
        try {
          if (await fileExists(file)) {
            await fs.unlink(file);
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

      // Run garbage collection if available
      if (global.gc) {
        try {
          global.gc();
        } catch (gcError) {
          // Ignore GC errors
        }
      }
    }
  }
);

/**
 * Generate human-readable reasoning for why a match was selected
 * Now with more comprehensive reasoning
 */
function generateMatchReasoning(match, visionAnalysis) {
  const reasons = [];

  // Add tensor-based reasons
  if (parseFloat(match.metrics?.embedding) > 0.85) {
    reasons.push(
      `Very strong visual similarity (${(
        parseFloat(match.metrics.embedding) * 100
      ).toFixed(1)}% tensor match)`
    );
  } else if (parseFloat(match.metrics?.embedding) > 0.75) {
    reasons.push(
      `Strong visual similarity (${(
        parseFloat(match.metrics.embedding) * 100
      ).toFixed(1)}% tensor match)`
    );
  } else if (parseFloat(match.metrics?.embedding) > 0.5) {
    reasons.push(
      `Moderate visual similarity (${(
        parseFloat(match.metrics.embedding) * 100
      ).toFixed(1)}% tensor match)`
    );
  } else {
    reasons.push(
      `Some visual similarity (${(
        parseFloat(match.metrics.embedding) * 100
      ).toFixed(1)}% tensor match)`
    );
  }

  // Add geometric matching reasons if available
  if (match.metrics?.geometric && parseFloat(match.metrics.geometric) > 0.01) {
    if (parseFloat(match.metrics.geometric) > 0.7) {
      reasons.push(
        `Strong feature matching (${
          match.metrics.inliers || 0
        } matching points)`
      );
    } else if (parseFloat(match.metrics.geometric) > 0.4) {
      reasons.push(
        `Partial feature matching (${
          match.metrics.inliers || 0
        } matching points)`
      );
    }
  }

  // Add spatial matching reasons if available
  if (match.metrics?.spatial && parseFloat(match.metrics.spatial) > 0.01) {
    if (parseFloat(match.metrics.spatial) > 0.6) {
      reasons.push(`Consistent spatial arrangement of features`);
    }
  }

  // Add partial match details
  if (match.partialMatchDetails) {
    const { windowSize, matchPercentage } = match.partialMatchDetails;
    const percentValue = parseFloat(matchPercentage.replace("%", ""));

    if (percentValue > 80) {
      reasons.push(`Nearly complete match (${matchPercentage} of content)`);
    } else if (percentValue > 50) {
      reasons.push(`Substantial partial match (${matchPercentage} of content)`);
    } else {
      reasons.push(`Partial match detected (${matchPercentage} of content)`);
    }
  }

  // Add semantic match reasons if available
  if (match.semanticScores) {
    if (match.semanticScores.total > 0.7) {
      reasons.push(
        `Very strong content similarity (${(
          match.semanticScores.total * 100
        ).toFixed(1)}% semantic match)`
      );
    } else if (match.semanticScores.total > 0.5) {
      reasons.push(
        `Strong content similarity (${(
          match.semanticScores.total * 100
        ).toFixed(1)}% semantic match)`
      );
    }

    if (match.semanticScores.tattooSpecific > 0.7) {
      reasons.push(`Same tattoo characteristics detected`);
    }
  }

  // Add Vision API reasons if available
  if (visionAnalysis) {
    // Check for matching tattoo type
    if (
      visionAnalysis.tattooInsights &&
      visionAnalysis.tattooInsights.isTattoo
    ) {
      reasons.push(
        `Confirmed tattoo content (${(
          visionAnalysis.tattooInsights.confidence * 100
        ).toFixed(1)}% confidence)`
      );

      // Body part detection
      if (visionAnalysis.tattooInsights.bodyPart) {
        reasons.push(`Located on ${visionAnalysis.tattooInsights.bodyPart}`);
      }

      // Subject detection
      if (visionAnalysis.tattooInsights.subject) {
        reasons.push(
          `Subject identified as ${visionAnalysis.tattooInsights.subject}`
        );
      } else if (
        visionAnalysis.tattooInsights.tattooFeatures &&
        visionAnalysis.tattooInsights.tattooFeatures.length > 0
      ) {
        reasons.push(
          `Contains features: ${visionAnalysis.tattooInsights.tattooFeatures
            .slice(0, 3)
            .join(", ")}`
        );
      }

      // Style detection
      if (visionAnalysis.tattooInsights.style) {
        reasons.push(
          `Style identified as ${visionAnalysis.tattooInsights.style}`
        );
      }

      // Colors information
      if (
        visionAnalysis.tattooInsights.colors &&
        visionAnalysis.tattooInsights.colors.length > 0
      ) {
        const colorNames = visionAnalysis.tattooInsights.colors
          .slice(0, 3)
          .map((c) => c.name)
          .join(", ");
        reasons.push(`Contains colors: ${colorNames}`);
      }

      // Treatment stage if available
      if (
        visionAnalysis.tattooInsights.isInRemovalProcess &&
        visionAnalysis.tattooInsights.removalStage
      ) {
        reasons.push(
          `Treatment stage: ${visionAnalysis.tattooInsights.removalStage}`
        );
      }
    }

    // Check for matching labels
    if (visionAnalysis.labels && visionAnalysis.labels.length > 0) {
      const topLabels = visionAnalysis.labels
        .slice(0, 3)
        .map((l) => l.description)
        .join(", ");
      reasons.push(`Content identified as: ${topLabels}`);
    }

    // Add removal analysis if available
    if (
      visionAnalysis.removalAnalysis &&
      visionAnalysis.removalAnalysis.isInRemovalProcess
    ) {
      reasons.push(
        `Tattoo removal in progress (${
          visionAnalysis.removalAnalysis.removalMethod || "unknown"
        } method)`
      );

      if (visionAnalysis.removalAnalysis.progress) {
        reasons.push(
          `Removal progress: approximately ${visionAnalysis.removalAnalysis.progress.fadingPercentage}% fading`
        );
      }
    }
  }

  return reasons;
}

/**
 * Helper function to check if file exists
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

app.post(
  "/analyze/enhanced-image",
  upload.single("image"),
  async (req, res) => {
    const processingId = crypto.randomUUID();
    const tempFiles = new Set();

    try {
      if (!req.file && !req.body.imagePath) {
        return res.status(400).json({
          error: "No image provided",
          code: "MISSING_IMAGE",
        });
      }

      let imagePath;
      let imageBuffer;
      let originalPath =
        req.body.imagePath || (req.file ? req.file.originalname : null);

      // Handle file upload or path
      if (req.file) {
        imagePath = req.file.path;
        imageBuffer = await fs.readFile(imagePath);
        tempFiles.add(imagePath);
      } else {
        try {
          // Get from Dropbox
          const storageManager = require("./storageManager");
          const fileData = await storageManager.downloadFile(
            req.body.imagePath
          );

          if (!fileData?.result?.fileBinary) {
            throw new Error("Failed to download image from Dropbox");
          }

          imageBuffer = Buffer.isBuffer(fileData.result.fileBinary)
            ? fileData.result.fileBinary
            : Buffer.from(fileData.result.fileBinary);

          // Save to temp file for processing - use fs directly
          const tempPath = path.join(
            uploadDir,
            `temp_${Date.now()}_${path.basename(req.body.imagePath)}`
          );
          await fs.writeFile(tempPath, imageBuffer);
          tempFiles.add(tempPath);
          imagePath = tempPath;

          // Keep track of the original path for context
          originalPath = req.body.imagePath;
        } catch (downloadError) {
          throw new Error(
            `Failed to download or process image: ${downloadError.message}`
          );
        }
      }

      logger.info("Starting enhanced image analysis", {
        service: "tatt2awai-bot",
        processingId,
        hasFile: !!req.file,
        path: req.file?.path || req.body.imagePath,
      });

      // Get the regular image analysis (if imageMatcher is available)
      let baseAnalysis = null;
      if (imageMatcher && typeof imageMatcher.analyzeImage === "function") {
        try {
          baseAnalysis = await imageMatcher.analyzeImage(imagePath);
        } catch (analyzeError) {
          logger.warn("Base analysis failed:", {
            service: "tatt2awai-bot",
            error: analyzeError.message,
          });
          // Continue even if base analysis fails
        }
      }

      // Initialize VisionEnhancer if needed
      if (!global.visionEnhancer) {
        const VisionEnhancer = require("./visionEnhancer");
        global.visionEnhancer = new VisionEnhancer({
          keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        });
        await global.visionEnhancer.initialize();
      }

      // Get enhanced analysis with Vision API
      const visionAnalysis = await global.visionEnhancer.analyzeImage(
        imageBuffer,
        {
          imagePath: originalPath,
        }
      );

      // Process tattoo insights
      let enrichedTattooInsights = null;
      try {
        // Pass the original path to get better context for body parts and tattoo analysis
        enrichedTattooInsights =
          await global.visionEnhancer._extractTattooInsights(
            visionAnalysis,
            imageBuffer,
            originalPath
          );
      } catch (tattooError) {
        logger.warn("Tattoo insights extraction failed:", {
          service: "tatt2awai-bot",
          error: tattooError.message,
        });

        // Use basic tattoo insights if extraction fails
        enrichedTattooInsights = {
          isTattoo: visionAnalysis.labels.some(
            (l) =>
              l.description.toLowerCase().includes("tattoo") ||
              l.description.toLowerCase().includes("ink")
          ),
          bodyPart: null,
          colors: [],
        };
      }

      // Combine the analyses
      const combinedAnalysis = {
        // Regular image analysis
        base: baseAnalysis
          ? {
              metadata: baseAnalysis.metadata,
              quality: baseAnalysis.quality,
              statistics: baseAnalysis.statistics,
              features: baseAnalysis.features,
            }
          : null,

        // Vision API analysis
        vision: {
          labels: visionAnalysis.labels || [],
          objects: visionAnalysis.objects || [],
          text: visionAnalysis.text || null,
          properties: visionAnalysis.properties || {},
          tattooInsights: enrichedTattooInsights || {},
        },

        // Combined insights
        insights: {
          isLikelyTattoo: enrichedTattooInsights?.isTattoo || false,
          bodyPart: enrichedTattooInsights?.bodyPart || null,
          bodyPartConfidence: enrichedTattooInsights?.bodyPartConfidence || 0,

          hasFaded: enrichedTattooInsights?.hasFaded || false,

          isInRemovalProcess:
            enrichedTattooInsights?.isInRemovalProcess || false,
          removalStage: enrichedTattooInsights?.removalStage || null,

          colors: enrichedTattooInsights?.colors || [],

          subject: {
            main: (visionAnalysis.labels || [])
              .filter((label) => label.confidence > 0.8)
              .slice(0, 3)
              .map((label) => label.description),

            objects: (visionAnalysis.objects || [])
              .filter((obj) => obj.confidence > 0.7)
              .map((obj) => obj.name),

            features: enrichedTattooInsights?.tattooFeatures || [],
          },

          processingMetadata: {
            timestamp: new Date().toISOString(),
            processingId,
            sourcePath: originalPath,
            analysisVersion: "1.0",
          },
        },
      };

      // Save the enhanced analysis if requested
      if (req.body.saveAnalysis === "true" && supabase) {
        try {
          const { data, error } = await supabase
            .from("enhanced_image_analysis")
            .upsert({
              path: originalPath || req.file?.originalname,
              analysis: combinedAnalysis,
              created_at: new Date().toISOString(),
            });

          if (error) {
            logger.warn("Failed to save enhanced analysis:", {
              service: "tatt2awai-bot",
              error: error.message,
              processingId,
            });
          }
        } catch (saveError) {
          logger.error("Error saving analysis:", {
            service: "tatt2awai-bot",
            error: saveError.message,
            processingId,
          });
        }
      }

      return res.json({
        success: true,
        processingId,
        analysis: combinedAnalysis,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Enhanced analysis error:", {
        service: "tatt2awai-bot",
        error: error.message,
        stack: error.stack,
        processingId,
      });

      return res.status(500).json({
        error: error.message,
        code: "ANALYSIS_ERROR",
        processingId,
      });
    } finally {
      // Cleanup temp files
      for (const file of tempFiles) {
        try {
          if (
            await fs
              .access(file)
              .then(() => true)
              .catch(() => false)
          ) {
            await fs.unlink(file);
          }
        } catch (cleanupError) {
          logger.warn("Error cleaning up temp file:", {
            service: "tatt2awai-bot",
            path: file,
            error: cleanupError.message,
          });
        }
      }
    }
  }
);

app.post("/analyze/batch-enhanced", async (req, res) => {
  const processingId = crypto.randomUUID();

  try {
    const { paths, folderPath, limit } = req.body;

    // Validate input - either provide specific paths or a folder path
    if (!paths && !folderPath) {
      return res.status(400).json({
        error: "Either paths or folderPath is required",
        code: "MISSING_INPUT",
      });
    }

    // Return immediately to not block the response
    res.json({
      success: true,
      message: "Batch analysis started in background",
      processingId,
      estimatedTime:
        "This process may take several minutes depending on the number of images",
      checkStatusEndpoint: `/analyze/batch-status/${processingId}`,
    });

    // Continue processing after sending response
    res.on("finish", async () => {
      try {
        // Initialize status tracker
        const batchStatus = {
          id: processingId,
          total: 0,
          processed: 0,
          successful: 0,
          failed: 0,
          startTime: Date.now(),
          endTime: null,
          status: "in_progress",
          errors: [],
        };

        // Save initial status
        await saveBatchStatus(batchStatus);

        // Get the list of paths to process
        let imagePaths = [];

        if (paths && Array.isArray(paths)) {
          imagePaths = paths;
          batchStatus.total = paths.length;
        } else if (folderPath) {
          // Fetch from Dropbox folder
          const storageManager = require("./storageManager");
          const folderContents = await storageManager.fetchDropboxEntries(
            folderPath
          );

          if (!folderContents?.result?.entries) {
            throw new Error("Failed to fetch folder contents from Dropbox");
          }

          // Filter for images
          imagePaths = folderContents.result.entries
            .filter((entry) => /\.(jpe?g|png|webp)$/i.test(entry.path_lower))
            .map((entry) => entry.path_lower);

          // Apply limit if specified
          if (limit && !isNaN(parseInt(limit))) {
            imagePaths = imagePaths.slice(0, parseInt(limit));
          }

          batchStatus.total = imagePaths.length;
        }

        // Update status
        await saveBatchStatus(batchStatus);

        logger.info("Starting batch enhanced analysis", {
          service: "tatt2awai-bot",
          processingId,
          totalImages: imagePaths.length,
        });

        // Process in small batches to avoid overloading the system
        const batchSize = 5; // Process 5 images at a time
        const results = [];

        for (let i = 0; i < imagePaths.length; i += batchSize) {
          const batch = imagePaths.slice(
            i,
            Math.min(i + batchSize, imagePaths.length)
          );
          const batchPromises = batch.map(async (imagePath) => {
            try {
              // Get from Dropbox
              const storageManager = require("./storageManager");
              const fileData = await storageManager.downloadFile(imagePath);

              if (!fileData?.result?.fileBinary) {
                throw new Error(`Failed to download image: ${imagePath}`);
              }

              const buffer = Buffer.isBuffer(fileData.result.fileBinary)
                ? fileData.result.fileBinary
                : Buffer.from(fileData.result.fileBinary);

              // Save to temp file for processing
              const tempPath = path.join(
                uploadDir,
                `temp_${Date.now()}_${path.basename(imagePath)}`
              );
              await fs.promises.writeFile(tempPath, buffer);

              try {
                // Get regular image analysis
                const baseAnalysis = await imageMatcher.analyzeImage(tempPath);

                // Get enhanced analysis with Vision API
                const visionAnalysis = await visionEnhancer.analyzeImage(
                  buffer
                );

                // Combine the analyses
                const combinedAnalysis = {
                  base: {
                    metadata: baseAnalysis.metadata,
                    quality: baseAnalysis.quality,
                    statistics: baseAnalysis.statistics,
                    features: baseAnalysis.features,
                  },
                  vision: {
                    labels: visionAnalysis.labels,
                    objects: visionAnalysis.objects,
                    text: visionAnalysis.text,
                    properties: visionAnalysis.properties,
                    tattooInsights: visionAnalysis.tattooInsights,
                  },
                  insights: {
                    isLikelyTattoo:
                      visionAnalysis.tattooInsights?.isTattoo ||
                      (visionAnalysis.labels || []).some(
                        (label) =>
                          label.description.toLowerCase().includes("tattoo") ||
                          label.description.toLowerCase().includes("ink")
                      ),
                    colors:
                      visionAnalysis.properties?.dominantColors ||
                      baseAnalysis.statistics?.dominantColors ||
                      [],
                    subject: {
                      main: (visionAnalysis.labels || [])
                        .filter((label) => label.confidence > 0.8)
                        .slice(0, 3)
                        .map((label) => label.description),
                      objects: (visionAnalysis.objects || [])
                        .filter((obj) => obj.confidence > 0.7)
                        .map((obj) => obj.name),
                    },
                    bodyPart: visionAnalysis.tattooInsights?.bodyPart || null,
                    processingMetadata: {
                      timestamp: new Date().toISOString(),
                      processingId,
                      sourcePath: imagePath,
                    },
                  },
                };

                // Save to database
                const { data, error } = await supabase
                  .from("enhanced_image_analysis")
                  .upsert({
                    path: imagePath,
                    analysis: combinedAnalysis,
                    created_at: new Date().toISOString(),
                  });

                if (error) {
                  throw new Error(`Failed to save analysis: ${error.message}`);
                }

                batchStatus.successful++;
                results.push({
                  path: imagePath,
                  success: true,
                });
              } finally {
                // Clean up temp file
                if (fs.existsSync(tempPath)) {
                  fs.unlinkSync(tempPath);
                }
              }
            } catch (error) {
              logger.error(`Error processing ${imagePath}:`, {
                service: "tatt2awai-bot",
                processingId,
                error: error.message,
              });

              batchStatus.failed++;
              batchStatus.errors.push({
                path: imagePath,
                error: error.message,
              });

              results.push({
                path: imagePath,
                success: false,
                error: error.message,
              });
            } finally {
              batchStatus.processed++;
            }
          });

          // Wait for batch to complete
          await Promise.all(batchPromises);

          // Update status
          await saveBatchStatus(batchStatus);

          // Log progress
          logger.info(
            `Batch progress: ${batchStatus.processed}/${batchStatus.total}`,
            {
              service: "tatt2awai-bot",
              processingId,
            }
          );

          // Pause briefly between batches to avoid overloading
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        // Finalize
        batchStatus.status = "completed";
        batchStatus.endTime = Date.now();
        await saveBatchStatus(batchStatus);

        logger.info("Batch analysis complete", {
          service: "tatt2awai-bot",
          processingId,
          duration: batchStatus.endTime - batchStatus.startTime,
          successful: batchStatus.successful,
          failed: batchStatus.failed,
        });
      } catch (error) {
        logger.error("Batch analysis error:", {
          service: "tatt2awai-bot",
          processingId,
          error: error.message,
          stack: error.stack,
        });

        // Update status to failed
        try {
          await saveBatchStatus({
            id: processingId,
            status: "failed",
            endTime: Date.now(),
            error: error.message,
          });
        } catch (statusError) {
          logger.error("Failed to update batch status:", {
            service: "tatt2awai-bot",
            error: statusError.message,
          });
        }
      }
    });
  } catch (error) {
    logger.error("Error starting batch analysis:", {
      service: "tatt2awai-bot",
      processingId,
      error: error.message,
      stack: error.stack,
    });

    return res.status(500).json({
      error: error.message,
      code: "BATCH_ERROR",
      processingId,
    });
  }
});

// Add batch status endpoint
app.get("/analyze/batch-status/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Get status from database
    const { data, error } = await supabase
      .from("batch_process_status")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return res.status(404).json({
        error: "Batch process not found",
        code: "NOT_FOUND",
      });
    }

    return res.json({
      success: true,
      status: data,
    });
  } catch (error) {
    logger.error("Error getting batch status:", {
      service: "tatt2awai-bot",
      error: error.message,
    });

    return res.status(500).json({
      error: error.message,
      code: "STATUS_ERROR",
    });
  }
});

// Helper function to save batch status
async function saveBatchStatus(status) {
  try {
    const { data, error } = await supabase.from("batch_process_status").upsert({
      id: status.id,
      ...status,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      logger.error("Failed to save batch status:", {
        service: "tatt2awai-bot",
        error: error.message,
      });
    }
  } catch (error) {
    logger.error("Error saving batch status:", {
      service: "tatt2awai-bot",
      error: error.message,
    });
  }
}

app.post("/process/all-images", async (req, res) => {
  try {
    if (!global.batchProcessor) {
      return res.status(500).json({
        success: false,
        message: "Batch processor not initialized",
      });
    }

    const { folderPath, processSubfolders, skipExisting, jobId } = req.body;

    const result = await global.batchProcessor.processAllImages({
      folderPath: folderPath || "/",
      processSubfolders: processSubfolders !== false,
      skipExisting: skipExisting !== false,
      jobId,
    });

    res.json(result);
  } catch (error) {
    logger.error("Error starting batch processing", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      message: `Error starting processing: ${error.message}`,
    });
  }
});

// Endpoint to get processing status
// Update this endpoint in your server.js
app.get("/process/status/:jobId?", async (req, res) => {
  try {
    if (!global.batchProcessor) {
      return res.status(500).json({
        success: false,
        message: "Batch processor not initialized",
      });
    }

    const { jobId } = req.params;
    const status = await global.batchProcessor.getStatus(jobId);
    res.json(status);
  } catch (error) {
    logger.error("Error getting batch status", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      message: `Error getting status: ${error.message}`,
    });
  }
});

// Endpoint to resume a job
app.post("/process/resume/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    const result = await batchProcessor.resumeJob(jobId);
    res.json(result);
  } catch (error) {
    logger.error("Error resuming job", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      message: `Error resuming job: ${error.message}`,
    });
  }
});

// Endpoint to stop processing
app.post("/process/stop", async (req, res) => {
  try {
    const result = await batchProcessor.stopProcessing();
    res.json(result);
  } catch (error) {
    logger.error("Error stopping processing", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      message: `Error stopping processing: ${error.message}`,
    });
  }
});

// Endpoint to get a list of all jobs
app.get("/process/jobs", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("batch_process_jobs")
      .select("id, status, start_time, end_time, stats, error")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    res.json({
      success: true,
      jobs: data.map((job) => ({
        id: job.id,
        status: job.status,
        startTime: job.start_time,
        endTime: job.end_time,
        duration: job.end_time ? job.end_time - job.start_time : null,
        stats: job.stats,
        error: job.error,
        progress:
          job.stats && job.stats.total > 0
            ? Math.round((job.stats.processed / job.stats.total) * 100)
            : 0,
      })),
    });
  } catch (error) {
    logger.error("Error getting jobs", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      message: `Error getting jobs: ${error.message}`,
    });
  }
});

// Endpoint to process a specific folder
app.post("/process/folder", async (req, res) => {
  try {
    const { folderPath, recursive, skipExisting } = req.body;

    if (!folderPath) {
      return res.status(400).json({
        success: false,
        message: "folderPath is required",
      });
    }

    const result = await batchProcessor.processAllImages({
      folderPath,
      processSubfolders: recursive !== false,
      skipExisting: skipExisting !== false,
    });

    res.json(result);
  } catch (error) {
    logger.error("Error processing folder", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      message: `Error processing folder: ${error.message}`,
    });
  }
});

app.post("/search/visual/inspect-embeddings", async (req, res) => {
  try {
    const results = await imageMatcher.inspectEmbeddings();

    // If a specific path was provided, test it too
    if (req.body.testPath) {
      const pathTest = await imageMatcher.testEmbeddingQuality(
        req.body.testPath
      );
      results.pathTest = pathTest;
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add this before the visual search endpoint to inspect the cache
app.get("/debug/cache", (req, res) => {
  const cacheInfo = {
    size: imageSignatures.size,
    sample: Array.from(imageSignatures.entries())
      .slice(0, 5)
      .map(([path, sig]) => ({
        path,
        hasAspectRatio: !!sig.aspectRatio,
        hasMeans: !!sig.means,
        hasStdDevs: !!sig.stdDevs,
        aspectRatio: sig.aspectRatio,
      })),
  };
  res.json(cacheInfo);
});

// Add this to your server.js
app.get("/check-signatures", async (req, res) => {
  if (!imageMatcher) {
    return res.status(500).json({ error: "Matcher not initialized" });
  }

  try {
    const result = await imageMatcher.checkSignatureIntegrity();
    res.json({
      success: true,
      stats: {
        valid: result.valid,
        invalid: result.invalid,
        total: result.valid + result.invalid,
      },
      issues: result.issues.slice(0, 10), // Show first 10 issues only
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      code: "CHECK_ERROR",
    });
  }
});

// Complete Direct Image Path API for server.js

app.post("/api/analyze/path", async (req, res) => {
  try {
    const { imagePath, message, userId } = req.body;

    if (!imagePath) {
      return res.status(400).json({
        error: "Image path is required",
        timestamp: new Date().toISOString(),
      });
    }

    logger.info("Image path analysis request:", {
      service: "tatt2awai-bot",
      imagePath,
      message,
      userId,
    });

    // Normalize path - remove leading slash if present
    const normalizedPath = imagePath.startsWith("/")
      ? imagePath.substring(1)
      : imagePath;

    try {
      // Ensure Dropbox connection
      const dropboxStatus = await storageManager.ensureAuth();
      if (!dropboxStatus) {
        throw new Error("Unable to access Dropbox");
      }

      // Download the image
      const fileData = await storageManager.downloadFile(normalizedPath);
      if (!fileData?.result?.fileBinary) {
        throw new Error(
          `Failed to download image from path: ${normalizedPath}`
        );
      }

      // Create a temporary file
      const tempPath = path.join(
        uploadDir,
        `temp_${Date.now()}_${path.basename(normalizedPath)}`
      );
      try {
        fs.writeFileSync(tempPath, fileData.result.fileBinary);

        logger.info("Image downloaded successfully:", {
          service: "tatt2awai-bot",
          originalPath: imagePath,
          normalizedPath,
          tempPath,
        });

        // Use image matcher to analyze
        let imageAnalysis = null;
        let similarImages = [];
        let directoryContents = [];

        if (
          global.imageMatcher &&
          typeof global.imageMatcher.analyzeImage === "function"
        ) {
          try {
            // Analyze the image
            imageAnalysis = await global.imageMatcher.analyzeImage(tempPath);

            // Find similar images
            const matches = await global.imageMatcher.findMatchesWithMode(
              tempPath,
              "tensor",
              { maxMatches: 10, threshold: 0.65 }
            );
            similarImages = matches.matches || [];

            // Get directory contents
            const dirPath = path.dirname(normalizedPath);
            const dirEntries = await storageManager.fetchDropboxEntries(
              dirPath
            );
            if (dirEntries?.result?.entries) {
              directoryContents = dirEntries.result.entries.map((entry) => ({
                path: entry.path_lower,
                name: entry.name,
                modified: entry.server_modified,
                size: entry.size,
                isDirectory: entry[".tag"] === "folder",
              }));
            }
          } catch (analysisError) {
            logger.warn("Image analysis error:", {
              service: "tatt2awai-bot",
              error: analysisError.message,
              path: tempPath,
            });
            // Continue even if analysis fails
          }
        }

        // Process with OpenAI
        const threadId = await openaiClient.getOrCreateThread(
          userId || "default-user"
        );

        // Add the file analysis as context
        await openai.beta.threads.messages.create(threadId, {
          role: "user",
          content: `[CONTEXT] ${JSON.stringify({
            type: "image_path_analysis",
            path: normalizedPath,
            directory: path.dirname(normalizedPath),
            filename: path.basename(normalizedPath),
            analysis: imageAnalysis,
            similarImages,
            directoryContents,
            metadata: {
              timestamp: new Date().toISOString(),
              query: message || `Tell me about the image at ${normalizedPath}`,
            },
          })}`,
        });

        // Add the user's actual question
        await openai.beta.threads.messages.create(threadId, {
          role: "user",
          content: message || `Tell me about the image at ${normalizedPath}`,
        });

        // Run the assistant with special instructions for image analysis
        const run = await openai.beta.threads.runs.create(threadId, {
          assistant_id: process.env.OPENAI_ASSISTANT_ID,
          instructions: `
            You are analyzing a specific image at path: ${normalizedPath}
            
            You have the image analysis data and can "see" the image through this analysis.
            
            START EVERY RESPONSE WITH: "I have direct access to the Dropbox repository and can search/analyze all images."
            
            Describe the image in detail, including:
            1. What it shows visually
            2. Any relevant technical details
            3. Context based on the directory location
            4. Related images in the same folder
            
            If this is in a "before-after" folder, discuss what might have changed between images.
            
            NEVER say you can't access or view the image. You HAVE access to the image data and analysis.
            
            Be specific and detailed in your response.
          `,
        });

        // Wait for completion
        const response = await openaiClient.handleAssistantResponse(
          threadId,
          run
        );

        // Ensure response starts with the required acknowledgment
        let finalContent = response.content;
        if (
          !finalContent.includes(
            "I have direct access to the Dropbox repository"
          )
        ) {
          finalContent =
            "I have direct access to the Dropbox repository and can search/analyze all images.\n\n" +
            finalContent;
        }

        // Enhance response with clickable links
        const enhancedContent = response.content.replace(
          /\/([^\/\s"']+\/)*[^\/\s"']+\.(jpg|jpeg|png|gif|webp)/gi,
          (match) => {
            const encodedPath = encodeURIComponent(match);
            return `[${match}](${API_CONFIG.baseUrl}/image-viewer?path=${encodedPath})`;
          }
        );

        res.json({
          response: enhancedContent,
          threadId,
          timestamp: new Date().toISOString(),
          imagePath: normalizedPath,
          success: true,
        });
      } finally {
        // Clean up the temp file
        if (fs.existsSync(tempPath)) {
          try {
            fs.unlinkSync(tempPath);
            logger.info("Cleaned up temp file:", {
              service: "tatt2awai-bot",
              path: tempPath,
            });
          } catch (e) {
            logger.warn("Failed to clean up temp file:", {
              service: "tatt2awai-bot",
              path: tempPath,
              error: e.message,
            });
          }
        }
      }
    } catch (error) {
      logger.error("Error processing image path:", {
        service: "tatt2awai-bot",
        error: error.message,
        imagePath: normalizedPath || imagePath,
      });

      // Even on error, return a helpful response
      res.json({
        response: `I have direct access to the Dropbox repository and can search/analyze all images.\n\nI was unable to fully analyze the image at "${imagePath}" due to a technical issue: ${error.message}. Please verify the path is correct or try a different image.`,
        timestamp: new Date().toISOString(),
        success: false,
        error: error.message,
      });
    }
  } catch (error) {
    logger.error("Image path analysis error:", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Add this to your server.js file
app.get("/embedding-status-detailed", async (req, res) => {
  try {
    // Run multiple queries to get detailed stats

    // 1. Count all documents
    const { count: totalDocs, error: countError } = await supabase
      .from("documents")
      .select("id", { count: "exact", head: true });

    if (countError) {
      throw new Error(`Error counting documents: ${countError.message}`);
    }

    // 2. Count documents with embeddings
    const { count: docsWithEmbeddings, error: withEmbError } = await supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .not("embedding", "is", null);

    if (withEmbError) {
      throw new Error(
        `Error counting documents with embeddings: ${withEmbError.message}`
      );
    }

    // 3. Count by document type
    const { data: typeStats, error: typeError } = await supabase.rpc(
      "count_by_document_type"
    );

    // 4. Get the 5 most recently updated documents
    const { data: recentUpdates, error: recentError } = await supabase
      .from("documents")
      .select("id, metadata, updated_at")
      .order("updated_at", { ascending: false })
      .limit(5);

    if (recentError) {
      throw new Error(`Error fetching recent updates: ${recentError.message}`);
    }

    // 5. Count documents updated in the last hour
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const { count: recentlyUpdatedCount, error: recentCountError } =
      await supabase
        .from("documents")
        .select("id", { count: "exact", head: true })
        .gt("updated_at", oneHourAgo.toISOString());

    if (recentCountError) {
      throw new Error(
        `Error counting recent updates: ${recentCountError.message}`
      );
    }

    // 6. Check for documents with hasEmbedding=true in metadata but null embedding
    const { data: inconsistentDocs, error: inconsistentError } = await supabase
      .from("documents")
      .select("id, metadata")
      .is("embedding", null)
      .filter("metadata->hasEmbedding", "eq", true)
      .limit(5);

    if (inconsistentError) {
      throw new Error(
        `Error finding inconsistent documents: ${inconsistentError.message}`
      );
    }

    // Return comprehensive status
    res.json({
      success: true,
      stats: {
        totalDocuments: totalDocs || 0,
        documentsWithEmbeddings: docsWithEmbeddings || 0,
        embeddingPercentage: totalDocs
          ? Math.round((docsWithEmbeddings / totalDocs) * 100)
          : 0,
        typeBreakdown: typeStats || [],
        recentlyUpdated: {
          lastHour: recentlyUpdatedCount || 0,
          examples:
            recentUpdates?.map((doc) => ({
              id: doc.id,
              updatedAt: doc.updated_at,
              hasEmbedding: doc.metadata?.hasEmbedding || false,
            })) || [],
        },
        dataInconsistencies: {
          count: inconsistentDocs?.length || 0,
          examples:
            inconsistentDocs?.map((doc) => ({
              id: doc.id,
              metadata: doc.metadata,
            })) || [],
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error fetching detailed embedding status", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

async function validateAndRestoreState() {
  try {
    logger.info("Starting safe state validation", {
      service: "tatt2awai-bot",
    });

    // Backup existing signatures in chunks
    const currentSignatures = new Map(imageMatcher.signatureCache);
    const timestamp = Date.now();
    const chunkSize = 500; // Process 500 signatures at a time
    const entries = Array.from(currentSignatures.entries());

    logger.info("Starting backup of current state", {
      service: "tatt2awai-bot",
      totalSignatures: currentSignatures.size,
      estimatedChunks: Math.ceil(currentSignatures.size / chunkSize),
    });

    // Create backup directory
    const backupDir = path.join(process.cwd(), `state_backup_${timestamp}`);
    await fs.mkdir(backupDir, { recursive: true });

    // Save in chunks
    for (let i = 0; i < entries.length; i += chunkSize) {
      const chunk = entries.slice(i, i + chunkSize);
      const chunkPath = path.join(
        backupDir,
        `chunk_${Math.floor(i / chunkSize)}.json`
      );

      await fs.writeFile(
        chunkPath,
        JSON.stringify({
          signatures: chunk,
          chunkIndex: Math.floor(i / chunkSize),
          timestamp: timestamp,
        })
      );

      logger.info("Saved backup chunk", {
        service: "tatt2awai-bot",
        chunk: Math.floor(i / chunkSize),
        signatures: chunk.length,
        path: chunkPath,
      });
    }

    // Save metadata
    await fs.writeFile(
      path.join(backupDir, "metadata.json"),
      JSON.stringify({
        totalSignatures: currentSignatures.size,
        chunks: Math.ceil(entries.length / chunkSize),
        timestamp: timestamp,
        backupType: "pre-validation",
      })
    );

    // Track stats for validation
    const stats = {
      total: currentSignatures.size,
      withEmbeddings: 0,
      withValidEmbeddings: 0,
      needsValidation: 0,
    };

    // Validate existing signatures
    for (const [path, sig] of currentSignatures.entries()) {
      if (sig.embeddings) {
        stats.withEmbeddings++;
        if (Array.isArray(sig.embeddings) && sig.embeddings.length === 1280) {
          stats.withValidEmbeddings++;
        } else {
          stats.needsValidation++;
        }
      }
    }

    logger.info("Validation complete", {
      service: "tatt2awai-bot",
      stats,
      backupLocation: backupDir,
    });

    return {
      backupDir,
      stats,
      timestamp,
    };
  } catch (error) {
    logger.error("State validation error:", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

app.post("/validate-and-restore", async (req, res) => {
  try {
    // First just validate and report
    const validation = await validateAndRestoreState();

    res.json({
      success: true,
      message: "Validation complete - backup created",
      stats: validation.stats,
      backupLocation: validation.backupDir,
      nextSteps:
        validation.stats.needsValidation > 0
          ? "Call /confirm-restore to process remaining files"
          : "No restoration needed",
    });
  } catch (error) {
    logger.error("Validation error:", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: error.message,
      code: "VALIDATION_ERROR",
    });
  }
});

// Add a status endpoint that excludes image documents
app.get("/text-embedding-status", async (req, res) => {
  try {
    // Count all documents
    const { count: allDocsCount, error: allDocsError } = await supabase
      .from("documents")
      .select("*", { count: "exact", head: true });

    if (allDocsError) {
      throw new Error(`Error counting all documents: ${allDocsError.message}`);
    }

    // Count all documents that are not explicitly images and have content
    const { count: textDocsCount, error: textDocsError } = await supabase
      .from("documents")
      .select("*", { count: "exact", head: true })
      .not("content", "is", null);

    if (textDocsError) {
      throw new Error(
        `Error counting text documents: ${textDocsError.message}`
      );
    }

    // Count all documents with embeddings
    const { count: docsWithEmbeddings, error: embeddingError } = await supabase
      .from("documents")
      .select("*", { count: "exact", head: true })
      .not("embedding", "is", null);

    if (embeddingError) {
      throw new Error(
        `Error counting documents with embeddings: ${embeddingError.message}`
      );
    }

    const stats = {
      allDocumentsCount: allDocsCount || 0,
      totalTextDocuments: textDocsCount || 0,
      textDocumentsWithEmbeddings: docsWithEmbeddings || 0,
      percentage: textDocsCount
        ? Math.round((docsWithEmbeddings / textDocsCount) * 100)
        : 0,
      metadata: {
        queryInfo: "Using simplified content-based detection",
      },
    };

    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error fetching text embedding status", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.post("/regenerate-text-embeddings-aggressive", async (req, res) => {
  try {
    logger.info("Starting aggressive text document embedding regeneration", {
      service: "tatt2awai-bot",
    });

    // Return immediately to not block the response
    res.json({
      success: true,
      message: "Aggressive text document embedding regeneration started",
      notes: "This will consider any non-image document as a text document",
      estimatedCompletion:
        "This may take several minutes depending on your document count",
    });

    // Continue processing after response is sent
    res.on("finish", async () => {
      try {
        // Identify documents without embeddings that are not images
        const { data: textDocs, error } = await supabase
          .from("documents")
          .select("id, content, metadata")
          .is("embedding", null)
          .not("metadata->>fileName", "like", "%.jpg")
          .not("metadata->>fileName", "like", "%.jpeg")
          .not("metadata->>fileName", "like", "%.png")
          .not("metadata->>fileName", "like", "%.gif")
          .not("metadata->>fileName", "like", "%.webp")
          .limit(100); // Process in smaller batches

        if (error) {
          logger.error("Error fetching documents for embedding generation", {
            service: "tatt2awai-bot",
            error: error.message,
          });
          return;
        }

        logger.info(
          `Found ${textDocs?.length || 0} documents for embedding generation`,
          {
            service: "tatt2awai-bot",
          }
        );

        // Process each document
        let updatedCount = 0;
        for (const doc of textDocs || []) {
          try {
            // Only process if content exists and is a string
            if (
              doc.content &&
              typeof doc.content === "string" &&
              doc.content.trim().length > 0
            ) {
              logger.info(`Processing document ${doc.id}`, {
                service: "tatt2awai-bot",
              });

              // Generate embedding
              const embeddingResponse = await openai.embeddings.create({
                model: "text-embedding-ada-002",
                input: doc.content.substring(0, 8000), // Limit to API max
              });

              const embedding = embeddingResponse.data[0]?.embedding;

              if (embedding) {
                // Update metadata
                const updatedMetadata = {
                  ...doc.metadata,
                  hasTextEmbedding: true,
                  embeddingDimensions: embedding.length,
                  embeddingModel: "text-embedding-ada-002",
                  embeddingCreated: new Date().toISOString(),
                };

                // Update in Supabase
                await supabase
                  .from("documents")
                  .update({
                    embedding: embedding,
                    metadata: updatedMetadata,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", doc.id);

                updatedCount++;

                logger.info(`Updated document ${doc.id} with embedding`, {
                  service: "tatt2awai-bot",
                  updatedCount,
                });
              }
            }
          } catch (docError) {
            logger.warn(`Error processing document ${doc.id}:`, {
              service: "tatt2awai-bot",
              error: docError.message,
            });
          }
        }

        logger.info("Batch embedding generation complete", {
          service: "tatt2awai-bot",
          updatedCount,
        });

        // If we processed any documents, trigger another run for the next batch
        if (updatedCount > 0) {
          logger.info("Triggering next batch...", {
            service: "tatt2awai-bot",
          });

          setTimeout(() => {
            fetch(
              "http://localhost:4000/regenerate-text-embeddings-aggressive",
              {
                method: "POST",
              }
            ).catch((err) => {
              logger.error("Error triggering next batch", {
                service: "tatt2awai-bot",
                error: err.message,
              });
            });
          }, 1000);
        }
      } catch (error) {
        logger.error("Error during embedding generation", {
          service: "tatt2awai-bot",
          error: error.message,
          stack: error.stack,
        });
      }
    });
  } catch (error) {
    logger.error("Error handling regenerate-text-embeddings request", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.post("/regenerate-embeddings", async (req, res) => {
  try {
    // ALWAYS force regeneration - this is the key change
    const forceRegeneration = true;

    logger.info("Starting embedding regeneration", {
      service: "tatt2awai-bot",
      forceRegeneration: forceRegeneration,
      userRequestedForce: !!req.body.forceRegeneration,
    });

    // Return immediately with an async process running
    res.json({
      success: true,
      message: "Embedding regeneration started in background",
      estimatedTime:
        "This process will take 1-2 hours depending on your image count",
      forceRegeneration: forceRegeneration, // Make sure this is returned for debugging
    });

    // Start the regeneration process in the background after sending response
    res.on("finish", () => {
      // Use a timeout to ensure the response is fully sent
      setTimeout(() => {
        logger.info(
          "Starting background regeneration process with forced regeneration",
          {
            service: "tatt2awai-bot",
          }
        );

        // Start the actual regeneration process with force flag EXPLICITLY set to true
        regenerateEmbeddingsWithFixedModel(true)
          .then((result) => {
            logger.info("Background regeneration completed successfully", {
              service: "tatt2awai-bot",
              stats: result.stats,
            });
          })
          .catch((err) => {
            logger.error("Background regeneration failed", {
              service: "tatt2awai-bot",
              error: err.message,
            });
          });
      }, 100);
    });
  } catch (error) {
    logger.error("Error starting embeddings regeneration:", {
      service: "tatt2awai-bot",
      error: error.message,
    });

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/regeneration-status", async (req, res) => {
  try {
    const stats = {
      total: imageMatcher.signatureCache.size,
      withEmbeddings: Array.from(imageMatcher.signatureCache.values()).filter(
        (sig) =>
          sig.embeddings &&
          Array.isArray(sig.embeddings) &&
          sig.embeddings.length === 1280
      ).length,
      memoryUsage: process.memoryUsage().heapUsed / (1024 * 1024),
    };

    res.json({
      stats,
      complete: stats.withEmbeddings === stats.total,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function downloadWithRetry(storageManager, path, maxRetries = 5) {
  let delay = 1500; // Start with 1.5 second delay
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Always ensure fresh auth on retry
      if (attempt > 1) {
        try {
          await storageManager.refreshAccessToken();
          logger.info("Refreshed token for retry", {
            service: "tatt2awai-bot",
            attempt,
            path,
          });
          // Add delay after token refresh
          await new Promise((resolve) => setTimeout(resolve, 3000));
        } catch (authError) {
          logger.warn("Token refresh failed", {
            service: "tatt2awai-bot",
            error: authError.message,
            attempt,
          });
        }
      }

      // Set a timeout for the download
      const downloadPromise = storageManager.downloadFile(path);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Download timeout after 45 seconds")),
          45000
        )
      );

      const fileData = await Promise.race([downloadPromise, timeoutPromise]);

      if (!fileData?.result?.fileBinary) {
        throw new Error("No binary data received");
      }

      return Buffer.isBuffer(fileData.result.fileBinary)
        ? fileData.result.fileBinary
        : Buffer.from(fileData.result.fileBinary);
    } catch (error) {
      lastError = error;

      // Handle rate limits with special care
      if (error.status === 429) {
        const retryAfter = parseInt(error.headers?.["retry-after"] || "30", 10);
        logger.warn(
          `Rate limit hit for ${path}, waiting ${retryAfter}s before retry`,
          {
            service: "tatt2awai-bot",
            attempt,
            retryAfter,
          }
        );
        await new Promise((resolve) =>
          setTimeout(resolve, retryAfter * 1000 + 2000)
        ); // Add just 2s buffer
        continue; // Skip the rest of error handling
      }

      if (error.status === 401 || error.message.includes("Authentication")) {
        try {
          await storageManager.refreshAccessToken();
          await new Promise((resolve) => setTimeout(resolve, 3000));
        } catch (refreshError) {
          logger.error("Failed to refresh token during retry", {
            service: "tatt2awai-bot",
            error: refreshError.message,
          });
        }
        delay = 3000;
      } else if (error.message.includes("timeout")) {
        // For timeout errors, wait longer
        delay = Math.min(delay * 1.5, 15000);
      } else {
        delay = Math.min(delay * 1.2, 10000);
      }

      // If this is the last retry, throw the error
      if (attempt === maxRetries) {
        throw lastError;
      }

      logger.info(`Retrying download for ${path} in ${delay}ms`, {
        service: "tatt2awai-bot",
        attempt,
        delay,
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// Add this function to manage state persistence
async function saveRegenerationState(state) {
  try {
    const statePath = path.join(
      process.cwd(),
      "embedding-regeneration-state.json"
    );
    await fs.writeFile(statePath, JSON.stringify(state, null, 2));

    logger.info("Saved regeneration state", {
      service: "tatt2awai-bot",
      state,
    });

    return true;
  } catch (error) {
    logger.error("Error saving regeneration state", {
      service: "tatt2awai-bot",
      error: error.message,
    });
    return false;
  }
}

async function loadRegenerationState() {
  try {
    const statePath = path.join(
      process.cwd(),
      "embedding-regeneration-state.json"
    );
    const exists = await fs
      .access(statePath)
      .then(() => true)
      .catch(() => false);

    if (!exists) {
      return null;
    }

    const stateData = await fs.readFile(statePath, "utf8");
    const state = JSON.parse(stateData);

    logger.info("Loaded regeneration state", {
      service: "tatt2awai-bot",
      state,
    });

    return state;
  } catch (error) {
    logger.error("Error loading regeneration state", {
      service: "tatt2awai-bot",
      error: error.message,
    });
    return null;
  }
}

async function clearRegenerationState() {
  try {
    const statePath = path.join(
      process.cwd(),
      "embedding-regeneration-state.json"
    );
    const exists = await fs
      .access(statePath)
      .then(() => true)
      .catch(() => false);

    if (exists) {
      await fs.unlink(statePath);
      logger.info("Cleared regeneration state", {
        service: "tatt2awai-bot",
      });
    }

    return true;
  } catch (error) {
    logger.error("Error clearing regeneration state", {
      service: "tatt2awai-bot",
      error: error.message,
    });
    return false;
  }
}

app.get("/regeneration-resume", async (req, res) => {
  try {
    const state = await loadRegenerationState();

    if (!state || !state.inProgress) {
      return res.json({
        success: false,
        message: "No regeneration process to resume",
        canStart: true,
      });
    }

    // Return the current state
    res.json({
      success: true,
      message: "Found interrupted regeneration process",
      state,
      canResume: true,
    });
  } catch (error) {
    logger.error("Error checking regeneration state:", {
      service: "tatt2awai-bot",
      error: error.message,
    });

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.post("/regeneration-resume", async (req, res) => {
  try {
    const state = await loadRegenerationState();

    if (!state || !state.inProgress) {
      return res.status(400).json({
        success: false,
        message: "No regeneration process to resume",
      });
    }

    logger.info("Manually resuming regeneration process", {
      service: "tatt2awai-bot",
      state,
    });

    // Return immediately with an async process running
    res.json({
      success: true,
      message: "Regeneration resuming in background",
      state,
    });

    // Start the process after response is sent
    res.on("finish", () => {
      // Use setTimeout to ensure the response is fully sent
      setTimeout(() => {
        logger.info("Response sent, resuming regeneration process", {
          service: "tatt2awai-bot",
        });

        regenerateEmbeddingsWithFixedModel(state.forceRegeneration || true)
          .then((result) => {
            logger.info("Resumed regeneration completed successfully", {
              service: "tatt2awai-bot",
              stats: result.stats,
            });
          })
          .catch((err) => {
            logger.error("Resumed regeneration failed", {
              service: "tatt2awai-bot",
              error: err.message,
            });
          });
      }, 100);
    });
  } catch (error) {
    logger.error("Error resuming regeneration:", {
      service: "tatt2awai-bot",
      error: error.message,
    });

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/regeneration-status", async (req, res) => {
  try {
    const stats = {
      total: imageMatcher.signatureCache.size,
      withEmbeddings: Array.from(imageMatcher.signatureCache.values()).filter(
        (sig) =>
          sig.embeddings &&
          Array.isArray(sig.embeddings) &&
          sig.embeddings.length === 1280
      ).length,
      memoryUsage: process.memoryUsage().heapUsed / (1024 * 1024),
    };

    // Get regeneration state if any
    const regenerationState = await loadRegenerationState();

    res.json({
      stats,
      complete: stats.withEmbeddings === stats.total,
      regenerationInProgress: regenerationState
        ? regenerationState.inProgress
        : false,
      regenerationState: regenerationState || null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function regenerateEmbeddingsWithFixedModel(forceRegeneration = false) {
  // Set up tracking
  const startTime = Date.now();
  let stats = {
    total: imageMatcher.signatureCache.size,
    processed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    retried: 0,
    startTime: startTime,
    lastUpdateTime: startTime,
  };

  // Add adaptive pacing variables - more aggressive settings
  let consecutiveSuccesses = 0;
  let consecutiveFailures = 0;
  let currentDelay = 1000; // Start with just 1 second between requests
  const MIN_DELAY = 500; // Can go as low as 500ms
  const MAX_DELAY = 10000; // Max 10 seconds on failure

  // Set overall time limits
  const overallStartTime = Date.now();
  const MAX_RUNTIME = 15 * 60 * 60 * 1000; // 15 hours max

  // Add request rate tracking - more aggressive
  let requestCount = 0;
  let timeboxStartTime = Date.now();
  const timeBox = 60 * 60 * 1000; // 1 hour time box
  const maxRequestsPerHour = 3600; // Up to 1 request per second average

  // Check for existing state to resume from
  const existingState = await loadRegenerationState();
  let processedPaths = new Set();
  let currentIndex = 0;

  if (existingState && existingState.inProgress) {
    logger.info("Resuming previously interrupted regeneration", {
      service: "tatt2awai-bot",
      existingState,
    });

    stats = {
      ...stats,
      ...existingState.stats,
    };
    processedPaths = new Set(existingState.processedPaths || []);
    currentIndex = existingState.currentIndex || 0;

    // Update start time for accurate remaining time calculation
    stats.startTime = startTime;
    stats.lastUpdateTime = startTime;
  }

  // First make a backup
  try {
    await imageMatcher.saveState();
    logger.info("Saved state backup before regeneration", {
      service: "tatt2awai-bot",
    });
  } catch (backupError) {
    logger.warn("Failed to save backup, continuing anyway", {
      service: "tatt2awai-bot",
      error: backupError.message,
    });
  }

  // Save the regeneration state as in-progress
  await saveRegenerationState({
    inProgress: true,
    forceRegeneration,
    stats,
    processedPaths: Array.from(processedPaths),
    currentIndex,
    startedAt: new Date().toISOString(),
  });

  // Skip problematic folders known to cause issues
  const skipFolders = [
    "/marketing library/collateral/flipbook",
    "/marketing library/collateral/flipbook/useable content from flipbook",
  ];

  try {
    // Get all entries to process, with randomization
    let entries;
    if (forceRegeneration) {
      // When forcing, process ALL signatures except those in skip folders
      entries = Array.from(imageMatcher.signatureCache.entries()).filter(
        ([path]) => !skipFolders.some((folder) => path.startsWith(folder))
      );

      // Shuffle entries for more distributed access
      entries.sort(() => Math.random() - 0.5);

      logger.info("FORCE MODE: Processing ALL signatures except skip folders", {
        service: "tatt2awai-bot",
        totalToProcess: entries.length,
        forceRegeneration: true,
        randomized: true,
      });
    } else {
      // Normal mode - only process signatures with missing/invalid embeddings
      entries = Array.from(imageMatcher.signatureCache.entries()).filter(
        ([path, signature]) => {
          // Skip problematic folders
          if (skipFolders.some((folder) => path.startsWith(folder))) {
            stats.skipped++;
            return false;
          }

          // Keep if no embeddings or invalid embeddings
          return (
            !signature.embeddings ||
            !Array.isArray(signature.embeddings) ||
            signature.embeddings.length !== 1280
          );
        }
      );
      // Shuffle for more even distribution
      entries.sort(() => Math.random() - 0.5);
    }

    const totalToProcess = entries.length;

    if (totalToProcess === 0) {
      logger.warn("No signatures to process!", {
        service: "tatt2awai-bot",
        forceRegeneration,
        totalSignatures: stats.total,
      });

      // Clear regeneration state since we're done
      await clearRegenerationState();

      return {
        success: true,
        stats,
      };
    }

    logger.info(
      `Starting embedding regeneration for ${totalToProcess} signatures`,
      {
        service: "tatt2awai-bot",
        totalSignatures: imageMatcher.signatureCache.size,
        skipped: stats.skipped,
        toProcess: totalToProcess,
        forceRegeneration: forceRegeneration,
        resuming: existingState ? true : false,
        resumePoint: currentIndex,
      }
    );

    // First ensure embedding enhancer is properly initialized
    if (!imageMatcher.embeddingEnhancer?.initialized) {
      logger.info("Initializing embedding enhancer before processing", {
        service: "tatt2awai-bot",
      });
      await resetModel();
    }

    // Get dropbox manager
    const storageManager = require("./storageManager");

    // Do a token refresh at the start
    try {
      await storageManager.refreshAccessToken();
      logger.info("Refreshed token before starting", {
        service: "tatt2awai-bot",
      });
    } catch (tokenError) {
      logger.warn("Token refresh failed before starting, continuing", {
        service: "tatt2awai-bot",
        error: tokenError.message,
      });
    }

    // More efficient batch size
    const batchSize = 5; // Increase batch size for faster processing

    // Process in batches - start from currentIndex if resuming
    for (let i = currentIndex; i < entries.length; i += batchSize) {
      // Check for overall time limit
      if (Date.now() - overallStartTime > MAX_RUNTIME) {
        logger.warn("Reached maximum runtime, pausing process", {
          service: "tatt2awai-bot",
          processed: stats.processed,
          remaining: totalToProcess - stats.processed,
          runtime:
            ((Date.now() - overallStartTime) / 3600000).toFixed(2) + " hours",
        });

        // Save current state before pausing
        await imageMatcher.saveState();
        await saveRegenerationState({
          inProgress: true,
          forceRegeneration,
          stats,
          processedPaths: Array.from(processedPaths),
          currentIndex: i,
          pauseReason: "time_limit",
          pausedAt: new Date().toISOString(),
        });

        return {
          success: false,
          paused: true,
          stats,
          reason: "time_limit",
        };
      }

      // Check request quotas
      requestCount++;
      if (requestCount >= maxRequestsPerHour) {
        const elapsed = Date.now() - timeboxStartTime;
        if (elapsed < timeBox) {
          const waitTime = timeBox - elapsed;
          logger.info(
            `Reached ${maxRequestsPerHour} requests, waiting ${Math.round(
              waitTime / 1000
            )}s before continuing`,
            {
              service: "tatt2awai-bot",
            }
          );
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
        requestCount = 0;
        timeboxStartTime = Date.now();
      }

      // Save current index in case we need to resume
      currentIndex = i;
      await saveRegenerationState({
        inProgress: true,
        forceRegeneration,
        stats,
        processedPaths: Array.from(processedPaths),
        currentIndex,
        lastUpdateTime: Date.now(),
      });

      // Process batch
      const batch = entries.slice(i, Math.min(i + batchSize, entries.length));

      logger.info(
        `Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(
          entries.length / batchSize
        )}`,
        {
          service: "tatt2awai-bot",
          batchSize: batch.length,
          progress: `${i + batch.length}/${entries.length} (${(
            ((i + batch.length) / entries.length) *
            100
          ).toFixed(1)}%)`,
        }
      );

      for (const [path, signature] of batch) {
        // Skip if already processed in a previous run
        if (processedPaths.has(path)) {
          logger.info(`Skipping already processed path: ${path}`, {
            service: "tatt2awai-bot",
          });
          continue;
        }

        let buffer = null;

        try {
          // Save original OpenCV data
          const preservedData = {
            keypoints: signature.keypoints,
            descriptors: signature.descriptors,
            metadata: {
              ...(signature.metadata || {}),
              lastUpdated: new Date().toISOString(),
            },
          };

          logger.info(`Processing: ${path}`, {
            service: "tatt2awai-bot",
            progress: `${stats.processed + 1}/${entries.length}`,
          });

          // Download file with retries and proper error handling
          try {
            buffer = await downloadWithRetry(storageManager, path, 3);
            if (!buffer) {
              throw new Error("Failed to download file after retries");
            }

            // After successful download
            consecutiveSuccesses++;
            consecutiveFailures = 0;

            // Decrease delay after several consecutive successes
            if (consecutiveSuccesses > 10 && currentDelay > MIN_DELAY) {
              currentDelay = Math.max(MIN_DELAY, currentDelay * 0.8);
              logger.info(
                `Decreasing delay to ${currentDelay}ms after ${consecutiveSuccesses} consecutive successes`,
                {
                  service: "tatt2awai-bot",
                }
              );
            }

            logger.info(`Download successful: ${path}`, {
              service: "tatt2awai-bot",
              bufferSize: buffer.length,
            });
          } catch (downloadError) {
            // Handle rate limits specially
            if (
              downloadError.status === 429 ||
              downloadError.message.includes("rate limit")
            ) {
              consecutiveFailures++;
              consecutiveSuccesses = 0;

              const retryAfter =
                parseInt(downloadError.headers?.["retry-after"]) || 30;
              currentDelay = Math.min(MAX_DELAY, currentDelay * 1.2);

              logger.warn(
                `Rate limit hit during download, waiting ${retryAfter}s`,
                {
                  service: "tatt2awai-bot",
                  path,
                }
              );
              await new Promise((resolve) =>
                setTimeout(resolve, retryAfter * 1000)
              );

              // Retry this file later
              stats.retried++;
              continue;
            }

            logger.error(`Failed to download ${path}:`, {
              service: "tatt2awai-bot",
              error: downloadError.message,
            });
            throw downloadError;
          }

          // Generate embedding with error handling
          let embedding = null;
          try {
            if (!imageMatcher.embeddingEnhancer) {
              throw new Error("Embedding enhancer is null");
            }

            if (!imageMatcher.embeddingEnhancer.initialized) {
              throw new Error("Embedding enhancer not initialized");
            }

            if (!imageMatcher.embeddingEnhancer.model) {
              throw new Error("Embedding model is null");
            }

            embedding = await imageMatcher.embeddingEnhancer.generateEmbedding(
              buffer
            );

            if (!embedding) {
              throw new Error("Generated embedding is null");
            }

            logger.info(`Successfully generated embedding for ${path}`, {
              service: "tatt2awai-bot",
              embeddingLength: embedding.length,
            });
          } catch (embeddingError) {
            // If model fails, reset and retry once
            logger.warn("Embedding generation failed, resetting model", {
              service: "tatt2awai-bot",
              error: embeddingError.message,
              path,
            });

            stats.retried++;
            const resetSuccess = await resetModel();
            if (!resetSuccess) {
              throw new Error("Model reset failed after embedding error");
            }

            // Try again with fresh model
            embedding = await imageMatcher.embeddingEnhancer.generateEmbedding(
              buffer
            );

            logger.info(
              `Successfully generated embedding after retry for ${path}`,
              {
                service: "tatt2awai-bot",
                embeddingLength: embedding.length,
              }
            );
          }

          // Validate embedding
          if (!Array.isArray(embedding) || embedding.length !== 1280) {
            throw new Error(
              `Invalid embedding generated: ${
                Array.isArray(embedding) ? embedding.length : typeof embedding
              }`
            );
          }

          // Update signature while preserving OpenCV data
          imageMatcher.signatureCache.set(path, {
            ...preservedData,
            embeddings: embedding,
            metadata: {
              ...preservedData.metadata,
              embeddingUpdated: new Date().toISOString(),
            },
          });

          // Verify signature was properly updated
          const updatedSignature = imageMatcher.signatureCache.get(path);
          if (
            !updatedSignature.embeddings ||
            !Array.isArray(updatedSignature.embeddings) ||
            updatedSignature.embeddings.length !== 1280
          ) {
            logger.warn("Update verification failed for " + path, {
              service: "tatt2awai-bot",
              hasEmbeddings: !!updatedSignature.embeddings,
              isArray: Array.isArray(updatedSignature.embeddings),
              length: updatedSignature.embeddings?.length,
            });
          } else {
            logger.info(`Successfully updated signature for ${path}`, {
              service: "tatt2awai-bot",
              embeddingLength: updatedSignature.embeddings.length,
            });
          }

          stats.successful++;
        } catch (error) {
          // When catching a rate limit error
          if (error.status === 429 || error.message.includes("rate limit")) {
            consecutiveFailures++;
            consecutiveSuccesses = 0;

            // Get exact retry-after time to avoid over-waiting
            const retryAfter = parseInt(error.headers?.["retry-after"]) || 30;
            currentDelay = Math.min(MAX_DELAY, currentDelay * 1.2);

            logger.warn(`Rate limit hit, waiting ${retryAfter}s`, {
              service: "tatt2awai-bot",
              path,
            });
            await new Promise((resolve) =>
              setTimeout(resolve, retryAfter * 1000)
            );

            // Track retry but don't mark as failure
            stats.retried++;
            continue;
          }

          stats.failed++;
          logger.error(`Error processing ${path}:`, {
            service: "tatt2awai-bot",
            error: error.message,
          });
        } finally {
          stats.processed++;

          // Mark this path as processed
          processedPaths.add(path);

          // Explicitly clear buffer
          buffer = null;

          // Use a variable delay based on consecutive successes
          const adjustedDelay =
            consecutiveSuccesses > 10
              ? MIN_DELAY
              : consecutiveSuccesses > 5
              ? currentDelay / 2
              : currentDelay;

          // Wait between files, but not too long if we're having success
          await new Promise((resolve) => setTimeout(resolve, adjustedDelay));
        }
      }

      // Save state periodically but less frequently for speed
      if ((i + batch.length) % 50 === 0 && i > 0) {
        await imageMatcher.saveState();

        // Report progress
        const elapsedMinutes = (Date.now() - startTime) / 60000;
        const rate = stats.processed / elapsedMinutes;
        const remaining = totalToProcess - stats.processed;
        const estimatedMinutesLeft = remaining / rate;

        stats.lastUpdateTime = Date.now();

        logger.info("Embedding regeneration progress:", {
          service: "tatt2awai-bot",
          processed: stats.processed,
          successful: stats.successful,
          failed: stats.failed,
          skipped: stats.skipped,
          retried: stats.retried,
          percentComplete: `${(
            (stats.processed / totalToProcess) *
            100
          ).toFixed(1)}%`,
          timeElapsed: `${elapsedMinutes.toFixed(1)} minutes`,
          estimatedTimeRemaining: `${estimatedMinutesLeft.toFixed(1)} minutes`,
          processingRate: `${rate.toFixed(2)} images/minute`,
        });

        // Force cleanup after save
        if (global.gc) global.gc();
      }

      // Take longer pauses less frequently
      if (stats.processed > 0 && stats.processed % 500 === 0) {
        logger.info("Taking a short pause after 500 files", {
          service: "tatt2awai-bot",
          processed: stats.processed,
          pauseFor: "15 seconds",
        });
        await new Promise((resolve) => setTimeout(resolve, 15000)); // 15 second pause
      } else {
        // Add modest delay between batches
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Final save
    await imageMatcher.saveState();

    // Final report
    logger.info("Embedding regeneration complete:", {
      service: "tatt2awai-bot",
      stats,
      duration: `${((Date.now() - startTime) / 60000).toFixed(1)} minutes`,
    });

    // Clear the regeneration state since we're done
    await clearRegenerationState();

    return {
      success: true,
      stats,
    };
  } catch (error) {
    logger.error("Fatal error during regeneration:", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
    });

    // Try to save state on failure
    try {
      await imageMatcher.saveState();
    } catch (e) {}

    // Update state to indicate error but don't clear it
    // so we can resume on next try
    await saveRegenerationState({
      inProgress: true, // still in progress
      forceRegeneration,
      stats,
      processedPaths: Array.from(processedPaths),
      currentIndex,
      error: error.message,
      lastErrorTime: Date.now(),
      lastUpdateTime: Date.now(),
    });

    throw error;
  }
}

/**
 * Reset the model completely
 */
async function resetModel() {
  try {
    logger.info("Starting complete model reset", {
      service: "tatt2awai-bot",
    });

    // Store a reference to the constructor before cleanup
    let EnhancerClass = null;
    if (imageMatcher.embeddingEnhancer) {
      EnhancerClass = imageMatcher.embeddingEnhancer.constructor;
      logger.info("Saved enhancer constructor reference", {
        service: "tatt2awai-bot",
        hasConstructor: !!EnhancerClass,
      });
    }

    // Force cleanup all resources
    if (imageMatcher.embeddingEnhancer) {
      try {
        await imageMatcher.embeddingEnhancer.cleanup();
        logger.info("Successfully cleaned up existing enhancer", {
          service: "tatt2awai-bot",
        });
      } catch (e) {
        logger.warn("Error cleaning up embedding enhancer:", {
          service: "tatt2awai-bot",
          error: e.message,
          stack: e.stack,
        });
      }
    }

    // Force TensorFlow cleanup
    if (global.tf) {
      try {
        global.tf.dispose();
        if (global.tf.disposeVariables) {
          global.tf.disposeVariables();
        }
        logger.info("TensorFlow resources cleared", {
          service: "tatt2awai-bot",
        });
      } catch (e) {
        logger.warn("Error clearing TensorFlow resources:", {
          service: "tatt2awai-bot",
          error: e.message,
          stack: e.stack,
        });
      }
    }

    // Force garbage collection
    if (global.gc) {
      try {
        global.gc();
        logger.info("Garbage collection completed", {
          service: "tatt2awai-bot",
        });
      } catch (e) {
        logger.warn("Error during garbage collection", {
          service: "tatt2awai-bot",
          error: e.message,
        });
      }
    }

    // Wait for cleanup to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Try to create a new instance if we have the constructor
    if (EnhancerClass) {
      try {
        logger.info("Creating new enhancer instance", {
          service: "tatt2awai-bot",
        });

        const newEnhancer = new EnhancerClass();

        logger.info("Initializing new enhancer", {
          service: "tatt2awai-bot",
        });

        await newEnhancer.initialize();

        // Replace the enhancer
        imageMatcher.embeddingEnhancer = newEnhancer;

        // Test that the model works
        if (!imageMatcher.embeddingEnhancer.model) {
          throw new Error("Enhancer initialized but model is null");
        }

        logger.info("Testing model with zero tensor", {
          service: "tatt2awai-bot",
        });

        const testTensor = global.tf.zeros([1, 224, 224, 3]);
        await imageMatcher.embeddingEnhancer.model.infer(testTensor, {
          embedding: true,
        });
        testTensor.dispose();

        logger.info("Successfully created new enhancer using constructor", {
          service: "tatt2awai-bot",
          initialized: newEnhancer.initialized,
          hasModel: !!newEnhancer.model,
        });

        return true;
      } catch (error) {
        logger.error("Failed to create new enhancer using constructor:", {
          service: "tatt2awai-bot",
          error: error.message,
          stack: error.stack,
        });
      }
    } else {
      // If we don't have a constructor, try to initialize embeddings another way
      logger.warn(
        "No constructor available, trying initializeEmbeddings method",
        {
          service: "tatt2awai-bot",
        }
      );

      // Try the initializeEmbeddings method if it exists
      if (typeof imageMatcher.initializeEmbeddings === "function") {
        try {
          await imageMatcher.initializeEmbeddings();

          // Verify it worked
          if (imageMatcher.embeddingEnhancer?.initialized) {
            logger.info("Successfully initialized embeddings via method", {
              service: "tatt2awai-bot",
            });
            return true;
          } else {
            logger.warn(
              "Initialization via method did not result in initialized enhancer",
              {
                service: "tatt2awai-bot",
                hasEnhancer: !!imageMatcher.embeddingEnhancer,
                enhancerInitialized:
                  imageMatcher.embeddingEnhancer?.initialized || false,
              }
            );
          }
        } catch (e) {
          logger.error("Failed to initialize embeddings via method:", {
            service: "tatt2awai-bot",
            error: e.message,
            stack: e.stack,
          });
        }
      } else {
        logger.error("No initializeEmbeddings method available", {
          service: "tatt2awai-bot",
        });
      }
    }

    // Add a fallback approach using the EmbeddingEnhancer class directly
    try {
      logger.info(
        "Attempting fallback initialization using EmbeddingEnhancer directly",
        {
          service: "tatt2awai-bot",
        }
      );

      // Check if the EmbeddingEnhancer is directly available
      const EmbeddingEnhancer =
        require("./RobustImageMatcher").EmbeddingEnhancer;

      if (EmbeddingEnhancer) {
        const directEnhancer = new EmbeddingEnhancer();
        await directEnhancer.initialize();

        imageMatcher.embeddingEnhancer = directEnhancer;

        logger.info("Successfully initialized enhancer via direct import", {
          service: "tatt2awai-bot",
          initialized: directEnhancer.initialized,
          hasModel: !!directEnhancer.model,
        });

        return true;
      }
    } catch (fallbackError) {
      logger.error("Fallback initialization failed:", {
        service: "tatt2awai-bot",
        error: fallbackError.message,
        stack: fallbackError.stack,
      });
    }

    // If all attempts failed
    logger.error("Failed to recreate embedding enhancer after all attempts", {
      service: "tatt2awai-bot",
    });
    return false;
  } catch (error) {
    logger.error("Error resetting model:", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
    });
    return false;
  }
}

/**
 * Recreate embedding enhancer from scratch
 */
/**
 * Recreate embedding enhancer from scratch
 */
async function recreateEmbeddingEnhancer() {
  try {
    // Instead of requiring an external module, use the constructor from the existing instance
    // Store a reference to the constructor before possible errors
    let EnhancerClass = null;

    if (imageMatcher.embeddingEnhancer) {
      EnhancerClass = imageMatcher.embeddingEnhancer.constructor;
    } else {
      // If we have no existing instance, we can't get the constructor
      logger.error("No existing embedding enhancer to get constructor from", {
        service: "tatt2awai-bot",
      });
      return false;
    }

    // Create new instance using the constructor we saved
    const enhancer = new EnhancerClass();

    // Initialize it
    await enhancer.initialize();

    // Check if initialization worked
    if (!enhancer.initialized || !enhancer.model) {
      throw new Error("Enhancer initialized flag is true but model is null");
    }

    // Test that model works
    const testTensor = global.tf.zeros([1, 224, 224, 3]);
    const testResult = await enhancer.model.infer(testTensor, {
      embedding: true,
    });
    testTensor.dispose();
    testResult.dispose();

    // Replace the existing enhancer
    imageMatcher.embeddingEnhancer = enhancer;

    logger.info("Successfully recreated embedding enhancer", {
      service: "tatt2awai-bot",
      initialized: enhancer.initialized,
      hasModel: !!enhancer.model,
    });

    return true;
  } catch (error) {
    logger.error("Failed to recreate embedding enhancer:", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
    });
    return false;
  }
}

/**
 * Ensure we have a working embedding enhancer
 */
async function ensureWorkingEmbeddingEnhancer() {
  // Max retry attempts
  const maxAttempts = 3;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Check if embedding enhancer exists and is initialized
      if (
        !imageMatcher.embeddingEnhancer ||
        !imageMatcher.embeddingEnhancer.initialized
      ) {
        logger.warn("Embedding enhancer not initialized, recreating...", {
          service: "tatt2awai-bot",
          attempt: attempt + 1,
        });

        // Try to reset the model instead of just recreating the enhancer
        const resetSuccess = await resetModel();
        if (!resetSuccess) {
          throw new Error("Failed to reset model");
        }
      }

      // Verify model is actually working
      if (
        !imageMatcher.embeddingEnhancer ||
        !imageMatcher.embeddingEnhancer.model
      ) {
        throw new Error("Model not available after initialization");
      }

      const testTensor = global.tf.zeros([1, 224, 224, 3]);
      const testResult = await imageMatcher.embeddingEnhancer.model.infer(
        testTensor,
        { embedding: true }
      );
      testTensor.dispose();
      testResult.dispose();

      logger.info("Embedding enhancer verified working", {
        service: "tatt2awai-bot",
      });

      return true;
    } catch (error) {
      logger.error(
        `Embedding enhancer verification failed (attempt ${attempt + 1}):`,
        {
          service: "tatt2awai-bot",
          error: error.message,
        }
      );

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Try a complete reset on the next iteration
    }
  }

  logger.error(
    "Failed to ensure working embedding enhancer after multiple attempts",
    {
      service: "tatt2awai-bot",
    }
  );

  return false;
}

/**
 * Generate embedding with model check
 */
async function generateEmbeddingWithCheck(buffer) {
  try {
    // Verify model exists before using it
    if (
      !imageMatcher.embeddingEnhancer ||
      !imageMatcher.embeddingEnhancer.model ||
      !imageMatcher.embeddingEnhancer.initialized
    ) {
      logger.warn(
        "Model not available for embedding generation, resetting...",
        {
          service: "tatt2awai-bot",
          hasEnhancer: !!imageMatcher.embeddingEnhancer,
          initialized: imageMatcher.embeddingEnhancer?.initialized,
          hasModel: !!imageMatcher.embeddingEnhancer?.model,
        }
      );

      await resetModel();
    }

    // Generate embedding directly - no validation to improve speed
    return await imageMatcher.embeddingEnhancer.generateEmbedding(buffer);
  } catch (error) {
    // If we get a model error, try one more time with a reset
    if (
      error.message &&
      (error.message.includes("Cannot read properties of null") ||
        error.message.includes("infer") ||
        error.message.includes("model"))
    ) {
      logger.warn(
        "Model error during embedding generation, resetting and retrying:",
        {
          service: "tatt2awai-bot",
          error: error.message,
        }
      );

      // Reset model
      await resetModel();

      // Try once more
      return await imageMatcher.embeddingEnhancer.generateEmbedding(buffer);
    }

    // Other errors are rethrown
    throw error;
  }
}

/**
 * Force memory cleanup
 */
async function forceCleanup() {
  return await utils.forceMemoryCleanup();
}

// Route to handle document uploads with path specification
app.post("/api/documents/upload", upload.single("file"), async (req, res) => {
  try {
    const { path: storagePath, provider } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    if (!storagePath) {
      return res.status(400).json({ error: "Storage path is required" });
    }

    // Read the uploaded file
    const fileContent = await fs.readFile(req.file.path);

    // Determine the target path
    let targetPath = storagePath;
    if (provider) {
      // If provider is specified, use provider-specific format
      targetPath = `${provider}://${storagePath}`;
    }

    // Upload file to the specified storage location
    const result = await storageManager.uploadFile(targetPath, fileContent);

    res.json({
      success: true,
      file: {
        name: req.file.originalname,
        path: result.path,
        provider: result.provider,
        size: req.file.size,
        mimetype: req.file.mimetype,
        uploadedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error("Document upload error:", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({ error: error.message });
  } finally {
    // Clean up the temp file
    if (req.file && fs.existsSync(req.file.path)) {
      await fs.unlink(req.file.path);
    }
  }
});

// Add to server.js
const checkTierAccess = (requiredTier) => {
  return (req, res, next) => {
    const currentTier = process.env.TIER || "basic";

    // Tier hierarchy: basic -> professional -> enterprise
    const tierLevels = {
      basic: 1,
      professional: 2,
      enterprise: 3,
    };

    if (tierLevels[currentTier] >= tierLevels[requiredTier]) {
      return next();
    }

    return res.status(403).json({
      error: "Feature not available",
      message: `This feature requires ${requiredTier} tier or higher`,
      currentTier: currentTier,
      requiredTier: requiredTier,
      upgradePath: "/api/billing/upgrade",
    });
  };
};

// Apply to routes:
app.post(
  "/api/storage/providers",
  checkTierAccess("professional"),
  async (req, res) => {
    // Professional tier feature
  }
);

app.post(
  "/api/sso/configure",
  checkTierAccess("enterprise"),
  async (req, res) => {
    // Enterprise tier feature
  }
);

app.get("/signature-status", async (req, res) => {
  try {
    const status = {
      total: imageMatcher.signatureCache.size,
      withEmbeddings: 0,
      withValidEmbeddings: 0,
      withOpenCV: 0,
      embeddingStats: {
        min: Infinity,
        max: -Infinity,
        avgLength: 0,
      },
      samplePaths: [],
    };

    let totalEmbeddingLength = 0;

    for (const [path, signature] of imageMatcher.signatureCache.entries()) {
      // Check OpenCV data
      if (signature.keypoints && signature.descriptors) {
        status.withOpenCV++;
      }

      // Check embeddings
      if (signature.embeddings) {
        status.withEmbeddings++;

        if (
          Array.isArray(signature.embeddings) &&
          signature.embeddings.length === 1280
        ) {
          status.withValidEmbeddings++;
          totalEmbeddingLength += signature.embeddings.length;

          // Track min/max lengths
          status.embeddingStats.min = Math.min(
            status.embeddingStats.min,
            signature.embeddings.length
          );
          status.embeddingStats.max = Math.max(
            status.embeddingStats.max,
            signature.embeddings.length
          );

          // Store some sample paths
          if (status.samplePaths.length < 5) {
            status.samplePaths.push({
              path,
              embeddingLength: signature.embeddings.length,
            });
          }
        }
      }
    }

    // Calculate average embedding length
    status.embeddingStats.avgLength =
      status.withValidEmbeddings > 0
        ? totalEmbeddingLength / status.withValidEmbeddings
        : 0;

    // Add some example searches
    const exampleSearches = await Promise.all([
      testKnownMatch(
        "/marketing library/images/before-afters/dragon on crystal ball shoulder/photo jul 07, 4 21 37 pm.jpg"
      ),
      testPartialMatch(
        "/marketing library/images/before-afters/dragon on crystal ball shoulder/photo jul 07, 4 21 37 pm.jpg",
        0.4
      ),
    ]);

    return res.json({
      success: true,
      status,
      exampleTests: exampleSearches,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Helper function to test known matches
async function testKnownMatch(path) {
  try {
    const signature = imageMatcher.signatureCache.get(path);
    if (!signature?.embeddings) {
      return {
        path,
        status: "missing_embedding",
      };
    }

    // Test self-similarity
    const similarity = imageMatcher.calculateCosineSimilarity(
      signature.embeddings,
      signature.embeddings
    );

    return {
      path,
      selfSimilarity: similarity,
      isValid: similarity > 0.99,
    };
  } catch (error) {
    return {
      path,
      error: error.message,
    };
  }
}

// Helper function to test partial matches
async function testPartialMatch(path, percentage) {
  try {
    const storageManager = require("./storageManager");
    const fileData = await storageManager.downloadFile(path);

    if (!fileData?.result?.fileBinary) {
      throw new Error("Could not load test image");
    }

    const buffer = Buffer.isBuffer(fileData.result.fileBinary)
      ? fileData.result.fileBinary
      : Buffer.from(fileData.result.fileBinary);

    // Create partial image
    const img = sharp(buffer);
    const metadata = await img.metadata();

    const cropWidth = Math.round(metadata.width * percentage);
    const cropHeight = Math.round(metadata.height * percentage);

    const croppedBuffer = await img
      .extract({
        left: 0,
        top: 0,
        width: cropWidth,
        height: cropHeight,
      })
      .toBuffer();

    // Test match
    const result = await imageMatcher.findMatchesWithMode(
      croppedBuffer,
      "partial",
      {
        maxMatches: 5,
      }
    );

    return {
      path,
      percentage,
      matches: result.matches.slice(0, 3),
      correctMatchFound: result.matches.some(
        (m) => m.path.toLowerCase() === path.toLowerCase()
      ),
      matchRank:
        result.matches.findIndex(
          (m) => m.path.toLowerCase() === path.toLowerCase()
        ) + 1,
    };
  } catch (error) {
    return {
      path,
      percentage,
      error: error.message,
    };
  }
}

app.post("/search/visual/validate-signatures", async (req, res) => {
  try {
    const validation = await imageMatcher.validateSignatureReadiness();
    res.json(validation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/validate-signatures", async (req, res) => {
  try {
    if (!imageMatcher) {
      return res.status(500).json({ error: "Matcher not initialized" });
    }

    const stats = {
      total: imageMatcher.signatureCache.size,
      withEmbeddings: 0,
      withValidEmbeddings: 0,
      invalidEmbeddings: 0,
      sampleSignature: null,
    };

    for (const [path, sig] of imageMatcher.signatureCache.entries()) {
      if (sig.embeddings) {
        stats.withEmbeddings++;
        if (Array.isArray(sig.embeddings) && sig.embeddings.length === 1280) {
          stats.withValidEmbeddings++;
        } else {
          stats.invalidEmbeddings++;
        }
      }

      if (!stats.sampleSignature && sig.embeddings) {
        stats.sampleSignature = {
          path,
          embeddingsLength: sig.embeddings?.length,
          isArray: Array.isArray(sig.embeddings),
          metadata: sig.metadata,
        };
      }
    }

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use("/api/crm", checkTierAccess("professional"), async (req, res, next) => {
  if (!crmManager.initialized) {
    await crmManager.initialize();
  }
  next();
});

// Get available CRM providers
app.get("/api/crm/providers", async (req, res) => {
  try {
    const providers = crmManager.getActiveProviders();
    res.json({
      success: true,
      providers,
      defaultProvider: crmManager.getDefaultProvider(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get contacts from CRM
app.get("/api/crm/contacts", async (req, res) => {
  try {
    const { provider, query, limit, page } = req.query;

    const contacts = await crmManager.getContacts(provider, {
      query,
      limit: limit ? parseInt(limit) : 20,
      page: page ? parseInt(page) : 1,
    });

    res.json(contacts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a contact in CRM
app.post("/api/crm/contacts", async (req, res) => {
  try {
    const { contact, provider } = req.body;

    if (!contact) {
      return res.status(400).json({ error: "Contact data is required" });
    }

    const result = await crmManager.createContact(contact, provider);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Link document to contact
app.post("/api/crm/contacts/:contactId/documents", async (req, res) => {
  try {
    const { contactId } = req.params;
    const { documentPath, documentMetadata, provider } = req.body;

    if (!documentPath && !documentMetadata) {
      return res
        .status(400)
        .json({ error: "Document path or metadata is required" });
    }

    let metadata = documentMetadata;

    // If only path provided, get metadata from storage manager
    if (documentPath && !documentMetadata) {
      const fileInfo = await storageManager.getMetadata(documentPath);
      metadata = {
        path: documentPath,
        name: path.basename(documentPath),
        ...fileInfo.metadata,
      };
    }

    const result = await crmManager.linkDocumentToContact(
      contactId,
      metadata,
      provider
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Webhook endpoint for CRM integration
app.post("/api/webhooks/crm/:provider/:event", async (req, res) => {
  try {
    const { provider, event } = req.params;

    // Process webhook
    const result = await crmManager.processWebhook(provider, event, req.body);

    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add to server.js
app.get("/signature-diagnostics", async (req, res) => {
  try {
    // Check all possible state files and locations
    const results = {
      currentSignatures: {
        count: imageMatcher.signatureCache.size,
        paths: Array.from(imageMatcher.signatureCache.keys()).slice(0, 5), // First 5 paths as sample
        sampleQuality: {},
      },
      stateFiles: {},
      directoryCheck: {},
      timestamps: {},
    };

    // Check quality of current signatures
    if (imageMatcher.signatureCache.size > 0) {
      const samplePath = Array.from(imageMatcher.signatureCache.keys())[0];
      const sampleSig = imageMatcher.signatureCache.get(samplePath);
      results.currentSignatures.sampleQuality = {
        path: samplePath,
        hasKeypoints: !!sampleSig.keypoints,
        keypointCount: sampleSig.keypoints?.length || 0,
        hasDescriptors: !!sampleSig.descriptors,
        descriptorCount: sampleSig.descriptors?.length || 0,
        hasMetadata: !!sampleSig.metadata,
        metadata: sampleSig.metadata,
      };
    }

    // Check all possible state files
    const stateFiles = [
      "matcher-state.json",
      "matcher-state.json.backup",
      "matcher-state.minimal.json",
      "matcher-state.minimal.json.backup",
      "matcher-state-index.json",
    ];

    for (const file of stateFiles) {
      try {
        const filePath = path.join(process.cwd(), file);
        const stats = await fs.stat(filePath);
        const content = await fs.readFile(filePath, "utf8");
        const data = JSON.parse(content);

        results.stateFiles[file] = {
          exists: true,
          size: stats.size,
          modified: stats.mtime,
          signatureCount:
            data.signatures?.length || data.totalSignatures || "unknown",
          timestamp: data.timestamp
            ? new Date(data.timestamp).toISOString()
            : null,
        };
      } catch (e) {
        results.stateFiles[file] = {
          exists: false,
          error: e.message,
        };
      }
    }

    // Check for chunked state files
    const files = await fs.readdir(process.cwd());
    const chunkFiles = files.filter((f) => f.match(/matcher-state-\d+\.json$/));
    results.stateFiles.chunks = chunkFiles.length;

    // Sample the first chunk if it exists
    if (chunkFiles.length > 0) {
      try {
        const chunk0Content = await fs.readFile(
          path.join(process.cwd(), chunkFiles[0]),
          "utf8"
        );
        const chunk0Data = JSON.parse(chunk0Content);
        results.stateFiles.chunkSample = {
          signatures: chunk0Data.signatures?.length || 0,
          hasDescriptors: !!chunk0Data.signatures?.[0]?.[1]?.descriptors,
          hasKeypoints: !!chunk0Data.signatures?.[0]?.[1]?.keypoints,
          timestamp: chunk0Data.timestamp
            ? new Date(chunk0Data.timestamp).toISOString()
            : null,
        };
      } catch (e) {
        results.stateFiles.chunkSample = { error: e.message };
      }
    }

    // Total up all signatures from chunks
    let totalChunkSignatures = 0;
    for (const chunkFile of chunkFiles) {
      try {
        const content = await fs.readFile(
          path.join(process.cwd(), chunkFile),
          "utf8"
        );
        const data = JSON.parse(content);
        totalChunkSignatures += data.signatures?.length || 0;
      } catch (e) {
        // Skip failed chunks
      }
    }
    results.stateFiles.totalChunkSignatures = totalChunkSignatures;

    // Check for the reported 8400~ signature file
    results.previousStates = {
      found: false,
      possibleLocations: [
        "/root/tatt2awai-bot/matcher-state.json.old",
        "/root/tatt2awai-bot/backups/matcher-state.json",
        "/root/tatt2awai-bot/old/matcher-state.json",
      ].map(async (loc) => {
        try {
          await fs.access(loc);
          return { path: loc, exists: true };
        } catch {
          return { path: loc, exists: false };
        }
      }),
    };

    res.json(results);
  } catch (error) {
    logger.error("Diagnostics error:", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      error: error.message,
      stack: error.stack,
    });
  }
});

// Add to server.js

// Add to server.js
app.post("/complete-restore", async (req, res) => {
  if (!imageMatcher) {
    return res.status(500).json({ error: "Matcher not initialized" });
  }

  try {
    logger.info("Starting complete restoration", {
      service: "tatt2awai-bot",
    });

    const results = await imageMatcher.completeRestore();

    res.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Complete restore error:", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: error.message,
      code: "COMPLETE_RESTORE_ERROR",
    });
  }
});

app.post("/enhance-start", async (req, res) => {
  try {
    if (!imageMatcher) {
      return res.status(500).json({ error: "Matcher not initialized" });
    }

    // First validate current state
    const currentStats = {
      total: imageMatcher.signatureCache.size,
      withEmbeddings: 0,
      withValidEmbeddings: 0,
    };

    for (const [, sig] of imageMatcher.signatureCache.entries()) {
      if (sig.embeddings) {
        currentStats.withEmbeddings++;
        if (Array.isArray(sig.embeddings) && sig.embeddings.length === 1280) {
          currentStats.withValidEmbeddings++;
        }
      }
    }

    logger.info("Starting enhancement process", {
      service: "tatt2awai-bot",
      currentStats,
    });

    // Start enhancement
    const enhancementStats = await imageMatcher.enhanceExistingSignatures();

    res.json({
      success: true,
      beforeEnhancement: currentStats,
      enhancementResults: enhancementStats,
    });
  } catch (error) {
    logger.error("Enhancement error:", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: error.message,
      code: "ENHANCEMENT_ERROR",
    });
  }
});

app.get("/verify-embeddings", async (req, res) => {
  try {
    const stats = {
      total: imageMatcher.signatureCache.size,
      withEmbeddings: 0,
      withValidEmbeddings: 0,
      withOriginalFeatures: 0,
    };

    for (const [, sig] of imageMatcher.signatureCache.entries()) {
      if (sig.descriptors && sig.keypoints) stats.withOriginalFeatures++;
      if (sig.embeddings) {
        stats.withEmbeddings++;
        if (Array.isArray(sig.embeddings) && sig.embeddings.length === 1280) {
          stats.withValidEmbeddings++;
        }
      }
    }

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add to server.js
app.post("/validate-state", async (req, res) => {
  try {
    if (!imageMatcher) {
      return res.status(500).json({ error: "Matcher not initialized" });
    }

    logger.info("Starting state validation", {
      service: "tatt2awai-bot",
    });

    const results = await imageMatcher.validateAndRestoreState();
    res.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Validation error:", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: error.message,
      code: "VALIDATION_ERROR",
    });
  }
});

// Add to server.js
app.get("/inspect-state", async (req, res) => {
  try {
    const stateFiles = await fs.readdir(process.cwd());
    const chunkFiles = stateFiles.filter((f) =>
      f.match(/matcher-state-\d+\.json$/)
    );

    const stats = {};

    for (const file of chunkFiles) {
      try {
        const content = await fs.readFile(
          path.join(process.cwd(), file),
          "utf8"
        );
        const state = JSON.parse(content);

        stats[file] = {
          size: (await fs.stat(path.join(process.cwd(), file))).size,
          signatures: state.signatures?.length || 0,
          withDescriptors:
            state.signatures?.filter(
              ([_, sig]) => sig?.descriptors && Array.isArray(sig.descriptors)
            ).length || 0,
          withKeypoints:
            state.signatures?.filter(
              ([_, sig]) => sig?.keypoints && Array.isArray(sig.keypoints)
            ).length || 0,
          modifiedTime: (await fs.stat(path.join(process.cwd(), file))).mtime,
        };
      } catch (e) {
        stats[file] = { error: e.message };
      }
    }

    res.json(stats);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      stack: error.stack,
    });
  }
});

// Add to server.js
app.post("/rebuild-fresh", async (req, res) => {
  try {
    if (!imageMatcher) {
      return res.status(500).json({ error: "Matcher not initialized" });
    }

    const storageManager = require("./storageManager");
    const dropboxFiles = await storageManager.fetchDropboxEntries("");

    if (!dropboxFiles?.result?.entries) {
      throw new Error("Failed to fetch Dropbox entries");
    }

    // Get all image files
    const imageFiles = dropboxFiles.result.entries.filter((entry) =>
      /\.(jpe?g|png|webp)$/i.test(entry.path_lower)
    );

    logger.info("Starting fresh rebuild", {
      service: "tatt2awai-bot",
      totalFiles: imageFiles.length,
    });

    // Clear existing cache
    imageMatcher.signatureCache.clear();

    const stats = {
      total: imageFiles.length,
      processed: 0,
      withDescriptors: 0,
      withKeypoints: 0,
      failed: 0,
      lastSavePoint: 0,
    };

    // Process in very small batches for safety
    const batchSize = 10;
    for (let i = 0; i < imageFiles.length; i += batchSize) {
      const batch = imageFiles.slice(
        i,
        Math.min(i + batchSize, imageFiles.length)
      );

      const batchPromises = batch.map(async (file) => {
        try {
          const fileData = await storageManager.downloadFile(file.path_lower);
          if (!fileData?.result?.fileBinary) {
            throw new Error("No binary data received");
          }

          const buffer = Buffer.isBuffer(fileData.result.fileBinary)
            ? fileData.result.fileBinary
            : Buffer.from(fileData.result.fileBinary);

          const signature = await imageMatcher.generateSignature(buffer);

          if (signature.descriptors && Array.isArray(signature.descriptors)) {
            stats.withDescriptors++;
          }
          if (signature.keypoints && Array.isArray(signature.keypoints)) {
            stats.withKeypoints++;
          }

          imageMatcher.signatureCache.set(file.path_lower, signature);
          stats.processed++;

          return { success: true };
        } catch (error) {
          stats.failed++;
          logger.error("Error processing file:", {
            service: "tatt2awai-bot",
            path: file.path_lower,
            error: error.message,
          });
          return { success: false, error };
        }
      });

      await Promise.all(batchPromises);

      // Save every 50 files processed
      if (stats.processed - stats.lastSavePoint >= 50) {
        await imageMatcher.saveState();
        stats.lastSavePoint = stats.processed;

        // Force garbage collection
        if (global.gc) {
          global.gc();
        }

        // Add delay after save
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      logger.info("Rebuild progress", {
        service: "tatt2awai-bot",
        ...stats,
        percentComplete: ((stats.processed / stats.total) * 100).toFixed(2),
      });

      // Small delay between batches
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // Final save
    await imageMatcher.saveState();

    logger.info("Rebuild complete", {
      service: "tatt2awai-bot",
      finalSignatures: imageMatcher.signatureCache.size,
      stats,
    });

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    logger.error("Rebuild error:", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: error.message,
      code: "REBUILD_ERROR",
    });
  }
});

// Add to server.js
app.post("/restore-all", async (req, res) => {
  try {
    if (!imageMatcher) {
      return res.status(500).json({ error: "Matcher not initialized" });
    }

    // First, try to restore from backup in state_backup
    const backupDir = path.join(process.cwd(), "state_backup");
    let restoredSignatures = new Map();

    logger.info("Starting full restore process", {
      service: "tatt2awai-bot",
    });

    try {
      // Try to load previous progress state first
      const backupFiles = await fs.readdir(backupDir);
      const backupStateFiles = backupFiles.filter(
        (f) => f.startsWith("matcher-state-") && f.endsWith(".json")
      );

      for (const file of backupStateFiles) {
        try {
          const content = await fs.readFile(path.join(backupDir, file), "utf8");
          const state = JSON.parse(content);

          if (state.signatures) {
            for (const [path, sig] of state.signatures) {
              if (sig?.descriptors && sig?.keypoints) {
                restoredSignatures.set(path, sig);
              }
            }
          }
        } catch (e) {
          logger.warn(`Error reading backup file ${file}`, {
            service: "tatt2awai-bot",
            error: e.message,
          });
        }
      }

      logger.info("Restored signatures from backup", {
        service: "tatt2awai-bot",
        restoredCount: restoredSignatures.size,
      });
    } catch (e) {
      logger.warn("Error accessing backup directory", {
        service: "tatt2awai-bot",
        error: e.message,
      });
    }

    // Merge with current valid signatures
    const currentSignatures = imageMatcher.signatureCache;
    for (const [path, sig] of currentSignatures.entries()) {
      if (!restoredSignatures.has(path) && sig?.descriptors && sig?.keypoints) {
        restoredSignatures.set(path, sig);
      }
    }

    // Get total number of files to process
    const storageManager = require("./storageManager");
    const dropboxFiles = await storageManager.fetchDropboxEntries("");

    if (!dropboxFiles?.result?.entries) {
      throw new Error("Failed to fetch Dropbox entries");
    }

    const imageFiles = dropboxFiles.result.entries.filter((entry) =>
      /\.(jpe?g|png|webp)$/i.test(entry.path_lower)
    );

    const validPaths = new Set(restoredSignatures.keys());
    const remainingFiles = imageFiles.filter(
      (file) => !validPaths.has(file.path_lower)
    );

    logger.info("Starting processing", {
      service: "tatt2awai-bot",
      restoredSignatures: restoredSignatures.size,
      totalFiles: imageFiles.length,
      remainingToProcess: remainingFiles.length,
    });

    // Update matcher with restored signatures
    imageMatcher.signatureCache = restoredSignatures;

    // Process remaining files
    const stats = {
      total: imageFiles.length,
      alreadyRestored: restoredSignatures.size,
      processed: 0,
      failed: 0,
    };

    const batchSize = 15;
    for (let i = 0; i < remainingFiles.length; i += batchSize) {
      const batch = remainingFiles.slice(
        i,
        Math.min(i + batchSize, remainingFiles.length)
      );

      const batchPromises = batch.map(async (file) => {
        try {
          const fileData = await storageManager.downloadFile(file.path_lower);
          if (!fileData?.result?.fileBinary) {
            throw new Error("No binary data received");
          }

          const buffer = Buffer.isBuffer(fileData.result.fileBinary)
            ? fileData.result.fileBinary
            : Buffer.from(fileData.result.fileBinary);

          const signature = await imageMatcher.generateSignature(buffer);
          imageMatcher.signatureCache.set(file.path_lower, signature);
          stats.processed++;

          return { success: true };
        } catch (error) {
          stats.failed++;
          logger.error("Error processing file:", {
            service: "tatt2awai-bot",
            path: file.path_lower,
            error: error.message,
          });
          return { success: false, error };
        }
      });

      await Promise.all(batchPromises);

      // Save progress after each batch
      await imageMatcher.saveState();

      logger.info("Processing progress", {
        service: "tatt2awai-bot",
        ...stats,
        currentTotal: stats.alreadyRestored + stats.processed,
        percentComplete: (
          ((stats.alreadyRestored + stats.processed) / stats.total) *
          100
        ).toFixed(2),
      });

      // Add delay between batches
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    logger.info("Full restore complete", {
      service: "tatt2awai-bot",
      finalSignatures: imageMatcher.signatureCache.size,
      stats,
    });

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    logger.error("Full restore error:", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: error.message,
      code: "RESTORE_ERROR",
    });
  }
});

// Add to server.js
app.post("/rebuild", async (req, res) => {
  try {
    if (!imageMatcher) {
      return res.status(500).json({ error: "Matcher not initialized" });
    }

    const storageManager = require("./storageManager");
    const dropboxFiles = await storageManager.fetchDropboxEntries("");

    if (!dropboxFiles?.result?.entries) {
      throw new Error("Failed to fetch Dropbox entries");
    }

    // Get all image files with validation
    const imageFiles = dropboxFiles.result.entries.filter((entry) => {
      const isImage = /\.(jpe?g|png|webp)$/i.test(entry.path_lower);
      const isValid = entry.size > 0 && entry.size < 10 * 1024 * 1024; // 10MB limit
      return isImage && isValid;
    });

    logger.info("Starting rebuild with validated files", {
      service: "tatt2awai-bot",
      totalImages: imageFiles.length,
    });

    // Clear existing cache
    imageMatcher.signatureCache.clear();

    // Process in batches with status tracking
    const batchSize = 15; // Smaller batches for safety
    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;
    let lastSavePoint = 0;

    for (let i = 0; i < imageFiles.length; i += batchSize) {
      const batch = imageFiles.slice(
        i,
        Math.min(i + batchSize, imageFiles.length)
      );

      const batchResults = await Promise.all(
        batch.map(async (file) => {
          try {
            const fileData = await storageManager.downloadFile(file.path_lower);
            if (!fileData?.result?.fileBinary) {
              throw new Error("No binary data received");
            }

            const buffer = Buffer.isBuffer(fileData.result.fileBinary)
              ? fileData.result.fileBinary
              : Buffer.from(fileData.result.fileBinary);

            const signature = await imageMatcher.generateSignature(buffer);

            // Validate signature before accepting
            if (
              !signature.descriptors ||
              !signature.keypoints ||
              !Array.isArray(signature.descriptors) ||
              !Array.isArray(signature.keypoints)
            ) {
              throw new Error("Invalid signature generated");
            }

            imageMatcher.signatureCache.set(file.path_lower, signature);
            successCount++;
            return { success: true, path: file.path_lower };
          } catch (error) {
            failedCount++;
            logger.error("Error processing file:", {
              service: "tatt2awai-bot",
              path: file.path_lower,
              error: error.message,
            });
            return {
              success: false,
              path: file.path_lower,
              error: error.message,
            };
          } finally {
            processedCount++;
          }
        })
      );

      // Save state every 50 files
      if (processedCount - lastSavePoint >= 50) {
        await imageMatcher.saveState();
        lastSavePoint = processedCount;
      }

      logger.info("Rebuild progress", {
        service: "tatt2awai-bot",
        processed: processedCount,
        successful: successCount,
        failed: failedCount,
        total: imageFiles.length,
        percentComplete: ((processedCount / imageFiles.length) * 100).toFixed(
          2
        ),
      });

      // Add delay between batches
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // Final state save
    await imageMatcher.saveState();

    return res.json({
      success: true,
      stats: {
        total: imageFiles.length,
        processed: processedCount,
        successful: successCount,
        failed: failedCount,
      },
    });
  } catch (error) {
    logger.error("Rebuild error:", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: error.message,
      code: "REBUILD_ERROR",
    });
  }
});

// Add to server.js
app.post("/resume-from-valid", async (req, res) => {
  try {
    if (!imageMatcher) {
      return res.status(500).json({ error: "Matcher not initialized" });
    }

    const storageManager = require("./storageManager");
    const dropboxFiles = await storageManager.fetchDropboxEntries("");

    if (!dropboxFiles?.result?.entries) {
      throw new Error("Failed to fetch Dropbox entries");
    }

    // Get all image files
    const imageFiles = dropboxFiles.result.entries.filter((entry) =>
      /\.(jpe?g|png|webp)$/i.test(entry.path_lower)
    );

    // Get currently valid signatures (2500 from loaded chunks)
    const validPaths = new Set(Array.from(imageMatcher.signatureCache.keys()));

    logger.info("Starting resume from valid signatures", {
      service: "tatt2awai-bot",
      validSignatures: validPaths.size,
      totalFiles: imageFiles.length,
      needProcessing: imageFiles.length - validPaths.size,
    });

    // Find files to process (everything not in valid signatures)
    const remainingFiles = imageFiles.filter(
      (file) => !validPaths.has(file.path_lower)
    );
    const stats = {
      total: imageFiles.length,
      alreadyValid: validPaths.size,
      processed: 0,
      withDescriptors: validPaths.size,
      withKeypoints: validPaths.size,
      failed: 0,
    };

    // Process in smaller batches
    const batchSize = 15; // Smaller batch size for safety
    for (let i = 0; i < remainingFiles.length; i += batchSize) {
      const batch = remainingFiles.slice(
        i,
        Math.min(i + batchSize, remainingFiles.length)
      );

      const batchPromises = batch.map(async (file) => {
        try {
          const fileData = await storageManager.downloadFile(file.path_lower);
          if (!fileData?.result?.fileBinary) {
            throw new Error("No binary data received");
          }

          const buffer = Buffer.isBuffer(fileData.result.fileBinary)
            ? fileData.result.fileBinary
            : Buffer.from(fileData.result.fileBinary);

          const signature = await imageMatcher.generateSignature(buffer);

          // Validate signature
          if (!signature.descriptors || !signature.keypoints) {
            throw new Error("Invalid signature generated");
          }

          imageMatcher.signatureCache.set(file.path_lower, signature);
          stats.processed++;
          stats.withDescriptors++;
          stats.withKeypoints++;

          return { success: true };
        } catch (error) {
          stats.failed++;
          logger.error("Error processing file:", {
            service: "tatt2awai-bot",
            path: file.path_lower,
            error: error.message,
          });
          return { success: false, error };
        }
      });

      await Promise.all(batchPromises);

      // Save progress every batch
      await imageMatcher.saveState();

      const totalProcessed = stats.alreadyValid + stats.processed;
      logger.info("Resume progress", {
        service: "tatt2awai-bot",
        ...stats,
        currentTotal: totalProcessed,
        percentComplete: ((totalProcessed / stats.total) * 100).toFixed(2),
      });

      // Small delay between batches
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    logger.info("Resume complete", {
      service: "tatt2awai-bot",
      finalSignatures: imageMatcher.signatureCache.size,
      stats,
    });

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    logger.error("Resume error:", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: error.message,
      code: "RESUME_ERROR",
    });
  }
});

// Add to server.js
app.post("/resume-rebuild", async (req, res) => {
  try {
    if (!imageMatcher) {
      return res.status(500).json({ error: "Matcher not initialized" });
    }

    const storageManager = require("./storageManager");
    const dropboxFiles = await storageManager.fetchDropboxEntries("");

    if (!dropboxFiles?.result?.entries) {
      throw new Error("Failed to fetch Dropbox entries");
    }

    // Get all image files
    const imageFiles = dropboxFiles.result.entries.filter((entry) =>
      /\.(jpe?g|png|webp)$/i.test(entry.path_lower)
    );

    // Get already processed files
    const processedPaths = new Set(
      Array.from(imageMatcher.signatureCache.keys())
    );

    // Find remaining files
    const remainingFiles = imageFiles.filter(
      (file) => !processedPaths.has(file.path_lower)
    );

    logger.info("Resuming rebuild", {
      service: "tatt2awai-bot",
      totalImages: imageFiles.length,
      alreadyProcessed: processedPaths.size,
      remaining: remainingFiles.length,
    });

    // Process remaining files
    const batchSize = 20;
    const stats = {
      total: imageFiles.length,
      alreadyProcessed: processedPaths.size,
      newlyProcessed: 0,
      withDescriptors: processedPaths.size,
      withKeypoints: processedPaths.size,
      failed: 0,
    };

    for (let i = 0; i < remainingFiles.length; i += batchSize) {
      const batch = remainingFiles.slice(
        i,
        Math.min(i + batchSize, remainingFiles.length)
      );
      const batchPromises = batch.map(async (file) => {
        try {
          const fileData = await storageManager.downloadFile(file.path_lower);
          if (!fileData?.result?.fileBinary) {
            throw new Error("No binary data received");
          }

          const buffer = Buffer.isBuffer(fileData.result.fileBinary)
            ? fileData.result.fileBinary
            : Buffer.from(fileData.result.fileBinary);

          const signature = await imageMatcher.generateSignature(buffer);

          if (signature.descriptors && Array.isArray(signature.descriptors)) {
            stats.withDescriptors++;
          }
          if (signature.keypoints && Array.isArray(signature.keypoints)) {
            stats.withKeypoints++;
          }

          imageMatcher.signatureCache.set(file.path_lower, signature);
          stats.newlyProcessed++;

          return { success: true };
        } catch (error) {
          stats.failed++;
          logger.error("Error processing file:", {
            service: "tatt2awai-bot",
            path: file.path_lower,
            error: error.message,
          });
          return { success: false, error };
        }
      });

      await Promise.all(batchPromises);

      // Save progress after each batch
      await imageMatcher.saveState();

      logger.info("Resume progress", {
        service: "tatt2awai-bot",
        ...stats,
        percentComplete: (
          ((stats.alreadyProcessed + stats.newlyProcessed) / stats.total) *
          100
        ).toFixed(2),
      });

      // Add delay between batches
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    logger.info("Resume complete", {
      service: "tatt2awai-bot",
      finalSignatures: imageMatcher.signatureCache.size,
      stats,
    });

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    logger.error("Resume error:", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: error.message,
      code: "RESUME_ERROR",
    });
  }
});

app.post("/enhance-signatures", async (req, res) => {
  try {
    if (!imageMatcher) {
      return res.status(500).json({ error: "Matcher not initialized" });
    }

    logger.info("Starting signature enhancement", {
      service: "tatt2awai-bot",
      totalSignatures: imageMatcher.signatureCache.size,
    });

    await imageMatcher.enhanceExistingSignatures();

    res.json({
      success: true,
      message: "Enhancement complete",
    });
  } catch (error) {
    logger.error("Enhancement error:", {
      service: "tatt2awai-bot",
      error: error.message,
    });
    res.status(500).json({ error: error.message });
  }
});

// Add endpoint to check enhancement progress
app.get("/enhancement-status", async (req, res) => {
  try {
    const stats = {
      processed: imageMatcher.signatureCache.size,
      withEmbeddings: Array.from(imageMatcher.signatureCache.values()).filter(
        (sig) => sig.embeddings && sig.embeddings.length === 1280
      ).length,
      memory: process.memoryUsage(),
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add this route to your Express app
app.post("/search/index", async (req, res) => {
  if (!imageMatcher) {
    return res.status(500).json({ error: "Matcher not initialized" });
  }

  try {
    logger.info("Starting directory indexing...", {
      service: "tatt2awai-bot",
    });

    // Start the indexing process
    const results = await imageMatcher.indexDirectory("");

    res.json({
      success: true,
      stats: {
        total: results.total,
        successful: results.successful.length,
        failed: results.failed.length,
        duration: results.duration,
      },
    });
  } catch (error) {
    logger.error("Indexing error:", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: error.message,
      code: "INDEXING_ERROR",
    });
  }
});

// Modify your search endpoint
app.post("/search/visual", upload.single("image"), async (req, res) => {
  const processingId = crypto.randomUUID();
  const tempFiles = new Set();
  const startTime = Date.now();
  let imgMat = null;

  try {
    if (!req.file && !req.body.imagePath) {
      return res.status(400).json({
        error: "No image provided",
        code: "MISSING_IMAGE",
      });
    }

    // Validate mode parameter
    const mode = req.body.mode || "tensor"; // Default to tensor instead of auto
    if (!["tensor", "full", "partial"].includes(mode)) {
      return res.status(400).json({
        error: "Invalid search mode. Must be one of: tensor, full, partial",
        code: "INVALID_MODE",
      });
    }

    // Check if debug testing is enabled
    const enableTesting =
      req.body.debug === "true" || req.query.debug === "true";

    logger.info("Starting visual search", {
      service: "tatt2awai-bot",
      processingId,
      hasFile: !!req.file,
      filename: req.file?.originalname || req.body.imagePath,
      mode,
      testing: enableTesting,
    });

    // Handle image input
    let imageBuffer;
    let imageSource;

    try {
      if (req.file) {
        imageBuffer = fsSync.readFileSync(req.file.path);
        tempFiles.add(req.file.path);
        imageSource = "upload";
      } else {
        const storageManager = require("./storageManager");
        const fileData = await storageManager.downloadFile(req.body.imagePath);
        if (!fileData?.result?.fileBinary) {
          throw new Error("Failed to download image");
        }
        imageBuffer = Buffer.isBuffer(fileData.result.fileBinary)
          ? fileData.result.fileBinary
          : Buffer.from(fileData.result.fileBinary);
        imageSource = "dropbox";
      }

      // Validate image
      imgMat = cv.imdecode(Buffer.from(imageBuffer));
      if (!imgMat || imgMat.empty) {
        throw new Error("Failed to decode image");
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

    // Configure matching options based on mode
    const matchOptions = {
      maxMatches: 20,
    };

    // Set threshold based on mode
    if (mode === "partial") {
      matchOptions.threshold = 0.4; // Lower threshold for partial matches
    } else {
      matchOptions.threshold = 0.65; // Original threshold for tensor/full
    }

    const matchResult = await imageMatcher.findMatchesWithMode(
      imageBuffer,
      mode,
      matchOptions
    );

    // Process matches
    const significantMatches = matchResult.matches
      .filter(
        (match) => parseFloat(match.score) > (mode === "partial" ? 0.3 : 0.4)
      )
      .slice(0, matchOptions.maxMatches);

    // Initialize VisionEnhancer if not already available
    if (!global.visionEnhancer && typeof VisionEnhancer === "function") {
      global.visionEnhancer = new VisionEnhancer({
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        enableProperties: true,
      });
      await global.visionEnhancer.initialize();
    }

    // Get top match for detailed analysis
    let topMatchAnalysis = null;
    if (significantMatches.length > 0) {
      const topMatch = significantMatches[0];

      try {
        // Download the image
        const fileData = await storageManager.downloadFile(topMatch.path);
        if (fileData?.result?.fileBinary) {
          const buffer = Buffer.isBuffer(fileData.result.fileBinary)
            ? fileData.result.fileBinary
            : Buffer.from(fileData.result.fileBinary);

          // Check if we have cached analysis
          const { data: cachedAnalysis } = await supabase
            .from("enhanced_image_analysis")
            .select("analysis")
            .eq("path", topMatch.path)
            .maybeSingle();

          let visionAnalysis;
          if (cachedAnalysis?.analysis) {
            visionAnalysis = cachedAnalysis.analysis;
            console.log("Using cached vision analysis for", topMatch.path);
          } else if (global.visionEnhancer) {
            // Perform new analysis
            visionAnalysis = await global.visionEnhancer.analyzeImage(buffer, {
              imagePath: topMatch.path,
            });

            // Cache the result
            await supabase.from("enhanced_image_analysis").upsert({
              path: topMatch.path,
              analysis: visionAnalysis,
              created_at: new Date().toISOString(),
            });

            console.log("Generated new vision analysis for", topMatch.path);
          }

          if (visionAnalysis) {
            // Generate detailed tattoo analysis
            topMatchAnalysis = {
              path: topMatch.path,
              description: "Detailed Image Analysis:",
              labels:
                visionAnalysis.labels?.slice(0, 5).map((l) => l.description) ||
                [],
              insights: {},
            };

            // Add tattoo-specific insights if available
            if (visionAnalysis.tattooInsights) {
              const insights = visionAnalysis.tattooInsights;
              topMatchAnalysis.insights.isTattoo = insights.isTattoo;

              if (insights.bodyPart) {
                topMatchAnalysis.description += ` Tattoo located on the ${insights.bodyPart}.`;
                topMatchAnalysis.insights.bodyPart = insights.bodyPart;
              }

              if (insights.colors && insights.colors.length > 0) {
                const colorNames = insights.colors
                  .slice(0, 3)
                  .map((c) => c.name)
                  .join(", ");
                topMatchAnalysis.description += ` The tattoo contains ${colorNames} colors.`;
                topMatchAnalysis.insights.colors = insights.colors.slice(0, 3);
              }

              if (insights.style) {
                topMatchAnalysis.description += ` The style appears to be ${insights.style}.`;
                topMatchAnalysis.insights.style = insights.style;
              }
            }

            // Add removal analysis if available
            if (visionAnalysis.removalAnalysis) {
              const removal = visionAnalysis.removalAnalysis;

              if (removal.isInRemovalProcess) {
                topMatchAnalysis.description += ` This tattoo appears to be in the process of removal.`;
                topMatchAnalysis.insights.removalStage =
                  removal.removalStage || "in progress";

                if (removal.progress && removal.progress.fadingPercentage) {
                  topMatchAnalysis.description += ` It is approximately ${removal.progress.fadingPercentage}% faded.`;
                  topMatchAnalysis.insights.fadingPercentage =
                    removal.progress.fadingPercentage;
                }

                if (removal.removalMethod) {
                  topMatchAnalysis.description += ` The removal method appears to be ${removal.removalMethod}.`;
                  topMatchAnalysis.insights.removalMethod =
                    removal.removalMethod;
                }
              } else {
                topMatchAnalysis.description += ` This tattoo does not appear to be in the process of removal.`;
                topMatchAnalysis.insights.removalStage = "not in removal";
              }
            }
          }
        }
      } catch (analysisError) {
        console.error("Error analyzing top match:", analysisError);
      }
    }

    // Format the matches for response
    const formattedMatches = significantMatches.map((match) => {
      const result = {
        path: match.path,
        score: parseFloat(match.score).toFixed(4),
        confidence: parseFloat(match.confidence).toFixed(4),
        metrics: {
          embedding: parseFloat(match.metrics.embedding).toFixed(4),
          geometric: parseFloat(match.metrics.geometric).toFixed(4),
          spatial: parseFloat(match.metrics.spatial).toFixed(4),
          matches: match.metrics.matches,
          inliers: match.metrics.inliers,
        },
        // Add a viewable link
        viewableLink: `/image-viewer?path=${encodeURIComponent(match.path)}`,
      };

      // Add partial match details if present
      if (mode === "partial" && match.partialMatchDetails) {
        result.partialMatchDetails = match.partialMatchDetails;
      }
      // Add vision analysis if available
      if (match.visionAnalysis) {
        result.visionAnalysis = {
          labels: match.visionAnalysis.labels?.slice(0, 5) || [],
          tattooInsights: match.visionAnalysis.tattooInsights || {},
          removalAnalysis: match.visionAnalysis.removalAnalysis || {},
        };

        // Add tattoo removal stage analysis
        if (match.visionAnalysis.removalAnalysis?.isInRemovalProcess) {
          result.removalStageAnalysis = {
            stage:
              match.visionAnalysis.removalAnalysis.removalStage ||
              "in progress",
            confidence: match.visionAnalysis.removalAnalysis.confidence || 0.7,
            fadingPercentage:
              match.visionAnalysis.removalAnalysis.progress?.fadingPercentage ||
              "unknown",
            method:
              match.visionAnalysis.removalAnalysis.removalMethod || "unknown",
          };
        }
      }

      return {
        path: match.path,
        score: parseFloat(match.score).toFixed(4),
        confidence: parseFloat(match.confidence).toFixed(4),
        metrics: {
          embedding: parseFloat(match.metrics.embedding).toFixed(4),
          geometric: parseFloat(match.metrics.geometric).toFixed(4),
          spatial: parseFloat(match.metrics.spatial).toFixed(4),
        },
        viewableLink: `http://147.182.247.128:4000/image-viewer?path=${encodeURIComponent(
          match.path
        )}`,
      };
    });

    const response = {
      success: true,
      processingId,
      matchCount: formattedMatches.length,
      mode: mode,
      matches: formattedMatches,
      topMatchAnalysis: topMatchAnalysis,
      stats: {
        processingTime: Date.now() - startTime,
        totalSignaturesSearched: imageMatcher.signatureCache.size,
        ...matchResult.stats,
      },
    };

    return res.json(response);
  } catch (error) {
    logger.error("Search error:", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
      processingId,
    });

    return res.status(500).json({
      error: error.message,
      code: "SEARCH_ERROR",
      processingId,
    });
  } finally {
    // Cleanup temp files
    for (const file of tempFiles) {
      try {
        if (fsSync.existsSync(file)) {
          fsSync.unlinkSync(file);
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

function generateDetailedTattooAnalysis(match) {
  if (!match.visionAnalysis) return null;

  const analysis = {
    description: "",
    removalStage: "unknown",
    confidence: 0,
    details: {},
  };

  // Extract tattoo insights
  if (match.visionAnalysis.tattooInsights) {
    const insights = match.visionAnalysis.tattooInsights;

    // Determine if it's a tattoo
    if (insights.isTattoo) {
      analysis.description = `This appears to be a tattoo`;

      // Add body part if available
      if (insights.bodyPart) {
        analysis.description += ` on the ${insights.bodyPart}`;
      }

      // Add color information
      if (insights.colors && insights.colors.length > 0) {
        const colorNames = insights.colors
          .slice(0, 3)
          .map((c) => c.name)
          .join(", ");
        analysis.description += ` with colors including ${colorNames}`;
      }
    }
  }

  // Extract removal analysis
  if (match.visionAnalysis.removalAnalysis) {
    const removal = match.visionAnalysis.removalAnalysis;

    // Check if in removal process
    if (removal.isInRemovalProcess) {
      analysis.removalStage = removal.removalStage || "in progress";
      analysis.confidence = removal.confidence || 0.7;

      // Add fading percentage if available
      if (removal.progress && removal.progress.fadingPercentage) {
        analysis.details.fadingPercentage = removal.progress.fadingPercentage;
        analysis.description += `. The tattoo appears to be approximately ${removal.progress.fadingPercentage}% faded`;
      }

      // Add stage analysis
      if (removal.removalStage) {
        analysis.description += `. Based on the visual evidence, this appears to be in the ${removal.removalStage} stage of removal`;
      }
    } else {
      analysis.removalStage = "not in removal";
      analysis.description += `. This tattoo does not appear to be in the process of being removed`;
    }
  }

  return analysis;
}

// Add a new endpoint for viewing images
app.get("/image-viewer", async (req, res) => {
  try {
    const { path: imagePath } = req.query;

    if (!imagePath) {
      return res.status(400).send("Image path is required");
    }

    // Normalize path - ensure no leading slash
    const normalizedPath = imagePath.startsWith("/")
      ? imagePath.substring(1)
      : imagePath;

    // Ensure Dropbox connection
    const dropboxStatus = await storageManager.ensureAuth();
    if (!dropboxStatus) {
      return res.status(500).send("Unable to connect to Dropbox");
    }

    // Download the image
    const fileData = await storageManager.downloadFile(normalizedPath);
    if (!fileData?.result?.fileBinary) {
      return res.status(404).send("Image not found");
    }

    // Determine content type based on extension
    const ext = path.extname(normalizedPath).toLowerCase();
    let contentType = "application/octet-stream"; // default

    if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
    else if (ext === ".png") contentType = "image/png";
    else if (ext === ".gif") contentType = "image/gif";
    else if (ext === ".webp") contentType = "image/webp";

    // Set appropriate headers
    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${path.basename(normalizedPath)}"`
    );

    // Send the image data
    return res.send(fileData.result.fileBinary);
  } catch (error) {
    logger.error("Error serving image:", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
      query: req.query,
    });

    return res.status(500).send("Error serving image: " + error.message);
  }
});

// Add this new endpoint to test full matching
app.post("/search/test-matching", upload.single("image"), async (req, res) => {
  try {
    if (!req.body.imagePath) {
      return res.status(400).json({ error: "imagePath is required" });
    }

    const testResult = await imageMatcher.testFullImageMatching(
      req.body.imagePath
    );

    // Enhance the response with more details
    const response = {
      success: testResult.success,
      performance: testResult.performance,
      isOptimal: testResult.isOptimal,
      matchDetails: testResult.matches?.map((match) => ({
        path: match.path,
        score: match.finalScore,
        confidence: match.confidence,
        metrics: match.metrics,
      })),
      recommendations: !testResult.isOptimal
        ? [
            "Consider regenerating signatures",
            "Check embedding cache",
            "Verify matching thresholds",
          ]
        : [],
    };

    res.json(response);
  } catch (error) {
    logger.error("Test matching error:", {
      service: "tatt2awai-bot",
      error: error.message,
    });
    res.status(500).json({ error: error.message });
  }
});

// Add progress monitoring endpoint
app.get("/status/indexing", async (req, res) => {
  if (!imageMatcher) {
    return res.status(500).json({ error: "Matcher not initialized" });
  }

  const stats = imageMatcher.getStats();
  res.json({
    status: stats.status,
    progress: {
      total: stats.total,
      processed: stats.processed,
      failed: stats.failed,
      percentComplete: stats.progress,
    },
    duration: stats.duration,
    canResume: imageMatcher.progress.canResume(),
    lastSavePoint: stats.lastSavePoint,
  });
});

// Add resume endpoint
app.post("/resume-indexing", async (req, res) => {
  if (!imageMatcher) {
    return res.status(500).json({ error: "Matcher not initialized" });
  }

  try {
    if (!imageMatcher.progress.canResume()) {
      return res.status(400).json({ error: "No resume point available" });
    }

    const result = await imageMatcher.resumeProcessing();
    res.json({
      success: true,
      resumed: true,
      stats: imageMatcher.getStats(),
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      code: "RESUME_ERROR",
    });
  }
});

app.post("/reprocess", async (req, res) => {
  const processingId = crypto.randomUUID();

  try {
    if (!imageMatcher) {
      return res.status(500).json({ error: "Matcher not initialized" });
    }

    const options = {
      batchSize: req.body.batchSize || 20,
      forceAll: req.body.forceAll || false,
      concurrentLimit: req.body.concurrentLimit || 5,
    };

    logger.info("Starting signature reprocessing", {
      service: "tatt2awai-bot",
      processingId,
      options,
    });

    const result = await imageMatcher.reprocessSignatures(options);

    res.json({
      success: true,
      processingId,
      totalProcessed: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Reprocessing error:", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
      processingId,
    });

    res.status(500).json({
      error: error.message,
      code: "REPROCESS_ERROR",
      processingId,
    });
  }
});

// Batch processing endpoint
app.post("/process/batch", async (req, res) => {
  const processingId = crypto.randomUUID();

  try {
    const { paths } = req.body;
    if (!Array.isArray(paths) || paths.length === 0) {
      return res.status(400).json({
        error: "Invalid paths array",
        code: "INVALID_INPUT",
      });
    }

    const results = await imageMatcher.indexDirectory("/", {
      onProgress: (progress) => {
        logger.info("Batch processing progress:", {
          service: "tatt2awai-bot",
          processingId,
          ...progress,
        });
      },
    });

    return res.json({
      success: true,
      processingId,
      results: {
        processed: results.successful.length,
        failed: results.failed.length,
        skipped: results.skipped.length,
        duration: results.duration,
      },
    });
  } catch (error) {
    logger.error("Batch processing error:", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
      processingId,
    });

    return res.status(500).json({
      error: error.message,
      code: "PROCESSING_ERROR",
      processingId,
    });
  }
});

// Image analysis endpoint
app.post("/analyze/image", upload.single("image"), async (req, res) => {
  const processingId = crypto.randomUUID();
  const tempFiles = new Set();

  try {
    if (!req.file && !req.body.imagePath) {
      return res.status(400).json({
        error: "No image provided",
        code: "MISSING_IMAGE",
      });
    }

    let imagePath;
    if (req.file) {
      imagePath = req.file.path;
      tempFiles.add(imagePath);
    } else {
      const fileData = await storageManager.downloadFile(req.body.imagePath);
      if (!fileData?.result?.fileBinary) {
        throw new Error("Failed to download image");
      }
      imagePath = path.join("uploads", `temp_${Date.now()}_analysis.jpg`);
      await fs.promises.writeFile(imagePath, fileData.result.fileBinary);
      tempFiles.add(imagePath);
    }

    const analysis = await imageMatcher.analyzeImage(imagePath);

    return res.json({
      success: true,
      processingId,
      analysis: {
        features: analysis.features,
        metadata: analysis.metadata,
        quality: analysis.quality,
        statistics: analysis.statistics,
      },
    });
  } catch (error) {
    logger.error("Analysis error:", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
      processingId,
    });

    return res.status(500).json({
      error: error.message,
      code: "ANALYSIS_ERROR",
      processingId,
    });
  } finally {
    for (const file of tempFiles) {
      try {
        if (fs.existsSync(file)) {
          await fs.promises.unlink(file);
        }
      } catch (cleanupError) {
        logger.warn("Error cleaning up temp file:", {
          path: file,
          error: cleanupError.message,
        });
      }
    }
  }
});

// Status endpoint
app.get("/status", async (req, res) => {
  try {
    const metrics = imageMatcher.getMetrics();
    const dropboxStatus = await storageManager.validateConnection();

    res.json({
      status: "operational",
      timestamp: new Date().toISOString(),
      metrics: {
        processed: metrics.totalProcessed,
        matchesFound: metrics.totalMatches,
        averageProcessingTime: metrics.averageProcessingTime,
        cacheStats: metrics.cacheStats,
      },
      systems: {
        matcher: true,
        dropbox: dropboxStatus,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: error.message,
    });
  }
});

app.get("/api/rbac/roles", authMiddleware, async (req, res) => {
  try {
    const roles = rbacManager.getRoles();
    res.json({ success: true, roles });
  } catch (error) {
    logger.error("Error getting roles:", {
      service: "rbac-service",
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/api/rbac/permissions", authMiddleware, async (req, res) => {
  try {
    const permissions = rbacManager.getPermissions();
    res.json({ success: true, permissions });
  } catch (error) {
    logger.error("Error getting permissions:", {
      service: "rbac-service",
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Theme Routes
app.get("/api/themes", async (req, res) => {
  try {
    const themes = themeManager.getAllThemes({
      clientId: req.tenant?.id,
    });

    res.json({ success: true, themes });
  } catch (error) {
    logger.error("Error getting themes:", {
      service: "theme-service",
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/api/themes/:id", async (req, res) => {
  try {
    const theme = themeManager.getTheme(req.params.id);

    if (!theme) {
      return res.status(404).json({
        success: false,
        error: "Theme not found",
      });
    }

    res.json({ success: true, theme });
  } catch (error) {
    logger.error("Error getting theme:", {
      service: "theme-service",
      error: error.message,
      themeId: req.params.id,
    });

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/api/themes/:id/css", async (req, res) => {
  try {
    const css = themeManager.getThemeCSS(req.params.id);

    res.setHeader("Content-Type", "text/css");
    res.send(css);
  } catch (error) {
    logger.error("Error getting theme CSS:", {
      service: "theme-service",
      error: error.message,
      themeId: req.params.id,
    });

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.post("/api/themes", authMiddleware, async (req, res) => {
  try {
    const result = await themeManager.createTheme(req.body);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    logger.error("Error creating theme:", {
      service: "theme-service",
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Analytics Routes
app.get("/api/analytics/dashboard", authMiddleware, async (req, res) => {
  try {
    const { timeframe, clientId } = req.query;

    const data = await analyticsManager.getDashboardData(
      timeframe || "week",
      clientId || req.tenant?.id
    );

    res.json(data);
  } catch (error) {
    logger.error("Error getting analytics dashboard:", {
      service: "analytics-service",
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/api/analytics/search", authMiddleware, async (req, res) => {
  try {
    const data = await analyticsManager.getSearchAnalytics({
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      clientId: req.query.clientId || req.tenant?.id,
      searchType: req.query.searchType,
      limit: parseInt(req.query.limit) || 100,
    });

    res.json(data);
  } catch (error) {
    logger.error("Error getting search analytics:", {
      service: "analytics-service",
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/api/analytics/system", authMiddleware, async (req, res) => {
  try {
    const data = await analyticsManager.getSystemPerformance({
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      resolution: req.query.resolution || "day",
    });

    res.json(data);
  } catch (error) {
    logger.error("Error getting system performance:", {
      service: "analytics-service",
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/api/analytics/report/:clientId", authMiddleware, async (req, res) => {
  try {
    const { clientId } = req.params;
    const { period } = req.query;

    const data = await analyticsManager.generateUsageReport(
      clientId,
      period || "month"
    );

    res.json(data);
  } catch (error) {
    logger.error("Error generating usage report:", {
      service: "analytics-service",
      error: error.message,
      clientId: req.params.clientId,
    });

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Tenant Routes
app.get("/api/tenants", authMiddleware, async (req, res) => {
  try {
    // Only admins can list all tenants
    if (!req.user.roles.includes("admin")) {
      return res.status(403).json({
        success: false,
        error: "Permission denied",
      });
    }

    const tenants = await tenantManager.listTenants();
    res.json({ success: true, tenants });
  } catch (error) {
    logger.error("Error listing tenants:", {
      service: "tenant-service",
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/api/tenants/current", authMiddleware, async (req, res) => {
  try {
    res.json({
      success: true,
      tenant: req.tenant,
    });
  } catch (error) {
    logger.error("Error getting current tenant:", {
      service: "tenant-service",
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.post("/api/tenants", authMiddleware, async (req, res) => {
  try {
    // Only admins can create tenants
    if (!req.user.roles.includes("admin")) {
      return res.status(403).json({
        success: false,
        error: "Permission denied",
      });
    }

    const result = await tenantManager.createTenant(req.body);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    logger.error("Error creating tenant:", {
      service: "tenant-service",
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Workflow Routes
app.get("/api/workflows", authMiddleware, async (req, res) => {
  try {
    const workflows = await workflowEngine.getWorkflows({
      tenantId: req.tenant?.id,
    });

    res.json({ success: true, workflows });
  } catch (error) {
    logger.error("Error getting workflows:", {
      service: "workflow-service",
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/api/workflows/:id", authMiddleware, async (req, res) => {
  try {
    const workflow = await workflowEngine.getWorkflow(req.params.id);

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: "Workflow not found",
      });
    }

    // Check if user has access to this workflow
    if (
      workflow.tenantId !== req.tenant?.id &&
      !req.user.roles.includes("admin")
    ) {
      return res.status(403).json({
        success: false,
        error: "Permission denied",
      });
    }

    res.json({ success: true, workflow });
  } catch (error) {
    logger.error("Error getting workflow:", {
      service: "workflow-service",
      error: error.message,
      workflowId: req.params.id,
    });

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.post("/api/workflows", authMiddleware, async (req, res) => {
  try {
    // Set tenant ID from request
    const workflowData = {
      ...req.body,
      tenantId: req.tenant?.id,
    };

    const result = await workflowEngine.createWorkflow(workflowData);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    logger.error("Error creating workflow:", {
      service: "workflow-service",
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.post("/api/workflows/:id/execute", authMiddleware, async (req, res) => {
  try {
    const result = await workflowEngine.executeWorkflow(req.params.id, {
      input: req.body,
      user: req.user,
      tenant: req.tenant,
    });

    res.json(result);
  } catch (error) {
    logger.error("Error executing workflow:", {
      service: "workflow-service",
      error: error.message,
      workflowId: req.params.id,
    });

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Integration Routes (Zenoti example)
app.use("/api/zenoti", authMiddleware, async (req, res, next) => {
  // Check if Zenoti is enabled for this tenant
  if (!req.tenant?.integrations?.includes("zenoti")) {
    return res.status(404).json({
      success: false,
      error: "Zenoti integration not enabled for this tenant",
    });
  }

  const zenotiConnector = app.get("zenotiConnector");

  if (!zenotiConnector) {
    return res.status(500).json({
      success: false,
      error: "Zenoti connector not available",
    });
  }

  req.zenotiConnector = zenotiConnector;
  next();
});

app.get("/api/zenoti/appointments", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: "Start date and end date are required",
      });
    }

    const appointments = await req.zenotiConnector.getAppointments({
      start_date: startDate,
      end_date: endDate,
      center_code: req.query.centerCode,
    });

    res.json({ success: true, appointments });
  } catch (error) {
    logger.error("Error getting Zenoti appointments:", {
      service: "zenoti-service",
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/api/zenoti/clients", async (req, res) => {
  try {
    const clients = await req.zenotiConnector.searchClients(req.query);
    res.json({ success: true, clients });
  } catch (error) {
    logger.error("Error getting Zenoti clients:", {
      service: "zenoti-service",
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Health Check for Enterprise Features
app.get("/health/enterprise", async (req, res) => {
  try {
    const enterpriseStatus = {
      initialized: global.enterpriseInitialized,
      components: {
        rbac: rbacManager.initialized,
        themes: themeManager.initialized,
        analytics: analyticsManager.initialized,
        tenants: tenantManager.initialized,
        workflows: workflowEngine.initialized,
      },
      integrations: {},
    };

    // Check Zenoti if enabled
    const zenotiConnector = app.get("zenotiConnector");
    if (zenotiConnector) {
      enterpriseStatus.integrations.zenoti = zenotiConnector.getStatus();
    }

    res.json(enterpriseStatus);
  } catch (error) {
    logger.error("Enterprise health check error:", {
      service: "health-check",
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Public endpoint
app.get("/api/public/data", (req, res) => {
  // This is accessible without authentication
  res.json({ publicData: "This is public" });
});

// Protected endpoint
app.get("/api/protected/data", authMiddleware, (req, res) => {
  // This requires authentication
  res.json({
    message: "This is protected data",
    user: req.user,
  });
});

// Admin-only endpoint
app.get("/api/admin/data", authMiddleware, requireAdmin, (req, res) => {
  // This requires authentication AND admin role
  res.json({ adminData: "Admin only content" });
});

// Role-specific endpoint
app.get(
  "/api/moderator/data",
  authMiddleware,
  requireRole("moderator"),
  (req, res) => {
    // This requires authentication AND moderator role
    res.json({ moderatorData: "Moderator content" });
  }
);

// OpenAI Chat Endpoint
app.post("/chat", async (req, res) => {
  try {
    const { message, userId } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const userUUID = generateUUID(userId || "default-user");
    const assistant = await getOrCreateAssistant();
    const threadId = await getOrCreateThread(userId || "default-user");

    // Store chat in Supabase
    await supabase.from("chat_history").insert({
      user_id: userUUID,
      thread_id: threadId,
      message_type: "user",
      content: message,
    });

    // Add message to thread
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: message,
    });

    // Run assistant
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: assistant.id,
    });

    // Wait for completion
    const startTime = Date.now();
    const timeout = 30000;
    let assistantResponse = null;

    while (Date.now() - startTime < timeout) {
      const status = await openai.beta.threads.runs.retrieve(threadId, run.id);

      if (status.status === "completed") {
        const messages = await openai.beta.threads.messages.list(threadId);
        assistantResponse = messages.data[0].content[0].text.value;

        await supabase.from("chat_history").insert({
          user_id: userUUID,
          thread_id: threadId,
          message_type: "assistant",
          content: assistantResponse,
        });

        break;
      } else if (status.status === "failed") {
        throw new Error("Assistant run failed");
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (!assistantResponse) {
      throw new Error("Assistant response timeout");
    }

    res.json({
      response: assistantResponse,
      threadId,
      assistantId: assistant.id,
    });
  } catch (error) {
    logger.error("Chat error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Server Setup
const httpsOptions = {
  key: fsSync.readFileSync(process.env.SSL_KEY_PATH),
  cert: fsSync.readFileSync(process.env.SSL_CERT_PATH),
  secureProtocol: "TLSv1_2_method",
  rejectUnauthorized: false,
  requestCert: false,
  agent: false,
};

const httpServer = http.createServer(app);
const httpsServer = https.createServer(httpsOptions, app);

async function initializeSignatures() {
  try {
    const allImages = await storageManager.fetchDropboxEntries("");
    if (!allImages?.result?.entries) {
      throw new Error("Failed to fetch images from Dropbox");
    }

    await EnhancedSignatureStore.initialize(allImages.result.entries); // FIXED
    return true;
  } catch (error) {
    logger.error("Failed to initialize signatures:", error);
    throw error;
  }
}

// Start the server
if (require.main === module) {
  initializeWithRetry().catch((error) => {
    logger.error("Fatal error during server initialization:", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  });
}

async function checkForInterruptedRegeneration() {
  try {
    const state = await loadRegenerationState();

    if (state && state.inProgress) {
      logger.info("Found interrupted regeneration process", {
        service: "tatt2awai-bot",
        state,
      });

      // Check if it was recently updated - if not, it might be stale
      const lastUpdateAge = Date.now() - (state.lastUpdateTime || 0);
      const isStale = lastUpdateAge > 3600000; // 1 hour

      if (isStale) {
        logger.warn("Regeneration state is stale, asking for manual restart", {
          service: "tatt2awai-bot",
          ageMinutes: Math.round(lastUpdateAge / 60000),
          state,
        });

        // Don't auto-resume stale processes, but keep the state
        return;
      }

      // Auto-resume recent processes
      logger.info("Automatically resuming interrupted regeneration", {
        service: "tatt2awai-bot",
        processedSoFar: state.stats?.processed || 0,
        remainingEstimate:
          (state.stats?.total || 0) - (state.stats?.processed || 0),
      });

      // Allow some time for server to fully initialize before resuming
      setTimeout(() => {
        regenerateEmbeddingsWithFixedModel(state.forceRegeneration || true)
          .then((result) => {
            logger.info("Resumed regeneration completed successfully", {
              service: "tatt2awai-bot",
              stats: result.stats,
            });
          })
          .catch((err) => {
            logger.error("Resumed regeneration failed", {
              service: "tatt2awai-bot",
              error: err.message,
            });
          });
      }, 10000); // Wait 10 seconds after server start
    }
  } catch (error) {
    logger.error("Error checking for interrupted regeneration", {
      service: "tatt2awai-bot",
      error: error.message,
    });
  }
}

async function initializeWithRetry(maxAttempts = 3) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await startServer();
      return;
    } catch (error) {
      if (attempt === maxAttempts - 1) {
        logger.error("Server initialization failed after max retries", {
          service: "tatt2awai-bot",
          error: error.message,
          attempts: maxAttempts,
        });
        throw error;
      }

      const delay = Math.pow(2, attempt) * 10000; // Exponential backoff
      logger.info(`Retrying initialization in ${delay / 1000} seconds...`, {
        service: "tatt2awai-bot",
        attempt: attempt + 1,
        maxAttempts,
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// Add this function in your server.js file with your other functions
async function createOrUpdateUser(userData) {
  try {
    // IMPORTANT: Use the service role key, not the anon key
    const adminSupabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Set defaults if not provided
    const email = userData.email;
    const password = userData.password || generateSecurePassword(); // You'd need to implement this
    const name = userData.name || email.split("@")[0];
    const roles = userData.roles || ["user"];

    // Create user in auth system with service role
    const { data: authData, error: authError } =
      await adminSupabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: {
          roles: roles,
          is_admin: roles.includes("admin"),
        },
      });

    if (authError) {
      // If user already exists, get their ID
      if (authError.message.includes("already exists")) {
        logger.info(`Auth user ${email} already exists, looking up ID...`);

        // Look up existing user
        const { data: existingAuthUser } =
          await adminSupabase.auth.admin.listUsers();
        const existingUser = existingAuthUser.users.find(
          (user) => user.email === email
        );

        if (!existingUser) {
          throw new Error(`Unable to find existing user with email: ${email}`);
        }

        // Continue with existing user ID
        authData = { user: { id: existingUser.id } };
      } else {
        throw authError;
      }
    }

    // Create/update user in database
    const { data: userData, error: userError } = await adminSupabase
      .from("users")
      .upsert(
        {
          id: authData.user.id,
          name: name,
          email: email,
          roles: roles,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "id",
        }
      )
      .select();

    if (userError) {
      throw userError;
    }

    return {
      success: true,
      user: userData[0],
      isNewUser: !authError,
      credentials: {
        email: email,
        password: userData.password || password, // Only return password for new users
      },
    };
  } catch (error) {
    logger.error("User creation error:", {
      service: "user-service",
      error: error.message,
      stack: error.stack,
    });

    return {
      success: false,
      error: error.message,
    };
  }
}

// Add this function to generate a secure password when needed
function generateSecurePassword(length = 12) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Add an API endpoint to create users (admin only)
app.post("/api/admin/users", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const result = await createOrUpdateUser(req.body);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    logger.error("User creation API error:", {
      service: "user-service",
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Add automatic admin creation during server startup
async function ensureAdminUserExists() {
  try {
    logger.info("Checking for admin user...");

    const result = await createOrUpdateUser({
      email: "admin@example.com",
      password: "SecurePassword123!",
      name: "Admin User",
      roles: ["admin", "user"],
    });

    if (result.success) {
      logger.info("Admin user check completed", {
        service: "server-init",
        isNewUser: result.isNewUser,
        user: result.user.email,
      });
    } else {
      logger.warn("Failed to ensure admin user exists", {
        service: "server-init",
        error: result.error,
      });
    }
  } catch (error) {
    logger.error("Error ensuring admin user exists:", {
      service: "server-init",
      error: error.message,
    });
  }
}

async function warmupCache() {
  try {
    logger.info("Starting cache warmup for common paths...", {
      service: "tatt2awai-bot",
    });

    // Get most recently accessed paths
    const { data, error } = await supabase
      .from("enhanced_image_analysis")
      .select("path")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    // Warm up cache for these paths
    for (const item of data) {
      if (global.visionEnhancer?.checkCache) {
        await global.visionEnhancer.checkCache(item.path);
      }
    }

    logger.info("Cache warmup completed", {
      service: "tatt2awai-bot",
    });
  } catch (error) {
    logger.error("Cache warmup failed:", {
      service: "tatt2awai-bot",
      error: error.message,
    });
  }
}

async function startServer() {
  try {
    logger.info("Starting server initialization...", {
      service: "tatt2awai-bot",
    });

    // Initialize directories first
    await initializeDirectories();

    // Initialize Dropbox FIRST
    const dropboxStatus = await storageManager.ensureAuth();
    if (!dropboxStatus) {
      throw new Error("Failed to initialize Dropbox connection");
    }
    logger.info("Dropbox authentication successful");

    try {
      console.log("OpenCV Version:", cv.version);

      imageMatcher = new RobustImageMatcher({
        matchingThreshold: 0.65,
        maxFeatures: 5000,
        batchSize: CORE_SETTINGS.BATCH_SIZE,
        maxConcurrent: CORE_SETTINGS.MAX_CONCURRENT,
        rateLimitDelay: CORE_SETTINGS.RATE_LIMIT_DELAY,
        partialMatchOptions: {
          minAreaRatio: 0.15,
          gridSize: 4,
          minMatchDensity: 0.02,
          spatialWeights: {
            embedding: 0.35,
            geometric: 0.4,
            spatial: 0.25,
          },
        },
        detectorSettings: {
          nfeatures: 5000,
          scaleFactor: 1.1,
          nlevels: 8,
          edgeThreshold: 31,
          firstLevel: 0,
          WTA_K: 2,
          patchSize: 31,
          fastThreshold: 20,
        },
      });

      if (imageMatcher && typeof imageMatcher.analyzeImage === "function") {
        logger.info("ImageMatcher ready:", {
          service: "tatt2awai-bot",
          hasAnalyzeFunction: true,
        });
      } else {
        logger.warn("ImageMatcher not properly initialized:", {
          service: "tatt2awai-bot",
          imageMatcher: imageMatcher ? Object.keys(imageMatcher) : null,
        });
      }

      logger.info("Created matcher instance, initializing...");
      await imageMatcher.initialize();
      await imageMatcher.initializeEmbeddings();
      logger.info("Matcher initialization complete");

      // ONLY START MONITORING AFTER MATCHER IS INITIALIZED
      systemMonitor.startMonitoring();

      // Initialize Vision Enhancer after matcher is ready
      const visionEnhancer = new VisionEnhancer({
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        maxLabels: 20,
        maxObjects: 10,
        minConfidence: 0.6,
        enableText: true,
        enableLandmarks: false,
        enableLogos: false,
        enableFaces: true,
        enableProperties: true,
        cacheEnabled: true,
      });

      // Initialize the batch processor - make sure this is global
      global.batchProcessor = new RobustBatchProcessor({
        visionEnhancer,
        imageMatcher,
        supabase,
        storageManager,
        uploadDir: path.join(__dirname, "uploads"),
        batchSize: 10,
        concurrentLimit: 5,
        apiRateLimitPerMin: 1500,
        delayBetweenBatches: 5000,
      });
    } catch (matcherError) {
      logger.error("Failed to initialize matcher:", {
        service: "tatt2awai-bot",
        error: matcherError.message,
        stack: matcherError.stack,
      });
      throw matcherError;
    }

    // Load state with better validation
    const stateLoaded = await imageMatcher.loadState();

    if (stateLoaded) {
      // Add the new comprehensive signature validation
      const validationResult = await imageMatcher.validateSignatureReadiness();
      logger.info("Signature readiness check:", {
        service: "tatt2awai-bot",
        isReady: validationResult.isReady,
        stats: validationResult.stats,
        action: validationResult.recommendedAction,
      });

      // If signatures need attention, log it but continue
      if (!validationResult.isReady) {
        logger.warn("Signatures need attention:", {
          service: "tatt2awai-bot",
          recommendations: validationResult.recommendedAction,
        });
      }

      // Validate a sample signature
      const sampleEntry = Array.from(imageMatcher.signatureCache.entries())[0];
      if (sampleEntry) {
        const [path, signature] = sampleEntry;
        logger.info("Sample signature loaded:", {
          service: "tatt2awai-bot",
          path,
          hasEmbeddings: !!signature.embeddings,
          embeddingsLength: signature.embeddings?.length || 0,
          hasDescriptors: !!signature.descriptors,
          hasKeypoints: !!signature.keypoints,
          hasMetadata: !!signature.metadata,
        });
      }

      // Quick validation without processing
      const stats = {
        total: imageMatcher.signatureCache.size,
        withEmbeddings: 0,
        withValidEmbeddings: 0,
      };

      for (const [, sig] of imageMatcher.signatureCache.entries()) {
        if (sig.embeddings) {
          stats.withEmbeddings++;
          if (Array.isArray(sig.embeddings) && sig.embeddings.length === 1280) {
            stats.withValidEmbeddings++;
          }
        }
      }

      logger.info("Signature validation complete:", {
        service: "tatt2awai-bot",
        ...stats,
        needsAttention: stats.withValidEmbeddings < stats.total,
      });
    }

    checkForInterruptedRegeneration();

    warmupCache().catch((err) => {
      logger.warn("Initial cache warmup failed:", {
        service: "tatt2awai-bot",
        error: err.message,
      });
    });

    setInterval(warmupCache, 4 * 60 * 60 * 1000); // Every 4 hours

    await initializeEnterpriseFeatures();
    await ensureAdminUserExists();
    await rbacManager.initialize();
    await ssoManager.initialize(app);

    // Start auto-save interval (every 5 minutes)
    setInterval(async () => {
      if (imageMatcher.isProcessing) {
        try {
          await imageMatcher.saveState();
          logger.info("State auto-saved successfully");
        } catch (error) {
          logger.error("Failed to auto-save state:", error);
        }
      }
    }, 5 * 60 * 1000);

    // Start servers
    httpServer.listen(CORE_SETTINGS.HTTP_PORT, "0.0.0.0", () => {
      logger.info(`HTTP server running on port ${CORE_SETTINGS.HTTP_PORT}`);
    });

    httpsServer.listen(CORE_SETTINGS.HTTPS_PORT, "0.0.0.0", () => {
      logger.info(`HTTPS server running on port ${CORE_SETTINGS.HTTPS_PORT}`);
    });

    // Enhanced memory management
    setInterval(async () => {
      const memUsage = process.memoryUsage();
      const heapUsedMB = memUsage.heapUsed / (1024 * 1024);

      if (heapUsedMB > 2000) {
        // 2GB threshold - reduce from 2.5GB
        logger.info("Automatic memory cleanup triggered", {
          service: "tatt2awai-bot",
          currentMemoryMB: Math.round(heapUsedMB),
        });
        await forceCleanup();
      }
    }, 30000);
    logger.info("Server startup complete", {
      service: "tatt2awai-bot",
      signatureCount: imageMatcher.signatureCache.size,
      memoryUsage: process.memoryUsage().heapUsed / (1024 * 1024),
      enterpriseFeaturesEnabled: global.enterpriseInitialized, // Add this line
    });

    return true;
  } catch (error) {
    logger.error("Failed to start server:", {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

// Export necessary components
module.exports = {
  app,
  httpServer,
  httpsServer,
  startServer,
  imageMatcher,
};
