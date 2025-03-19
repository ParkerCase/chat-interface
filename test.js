require("dotenv").config();
const express = require("express");
const path = require("path");
const logger = require("./logger");
const crypto = require("crypto");
const fs = require("fs");
const dependencyManager = require("./DependencyManager");

// Make sure JWT secret is available
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
  console.log("Warning: JWT_SECRET not set, using auto-generated secret");
}

// Initialize express app
const app = express();

// Register core dependencies with dependency manager
dependencyManager.register("logger", logger);
dependencyManager.register("config", require("./config"));
dependencyManager.register("supabase", require("./supabase"), ["logger"]);

// Make global for backward compatibility
global.supabase = dependencyManager.get("supabase");
global.supabaseClient = global.supabase; // Set both for compatibility

dependencyManager.register(
  "storageManager",
  require("./storage/StorageManager"),
  ["logger", "config"]
);
dependencyManager.register("visionEnhancer", require("./visionEnhancer"), [
  "logger",
  "config",
]);
dependencyManager.register("imageMatcher", null, [
  "logger",
  "config",
  "storageManager",
]); // Will be set after initialization
dependencyManager.register("themeManager", require("./ui/ThemeManager"), [
  "logger",
  "supabase",
]);
dependencyManager.register(
  "analyticsManager",
  require("./analytics/AnalyticsManager"),
  ["logger", "supabase"]
);
dependencyManager.register("rbacManager", require("./auth/RBACManager"), [
  "logger",
  "supabase",
]);
dependencyManager.register(
  "workflowEngine",
  require("./workflow/WorkflowEngine"),
  ["logger", "supabase"]
);
dependencyManager.register(
  "alertManager",
  require("./analytics/AlertManager"),
  ["logger", "supabase", "analyticsManager"]
);
dependencyManager.register("openaiClient", require("./openaiClient"), [
  "logger",
  "config",
]);

// Initialize middleware
require("./middleware")(app, dependencyManager);

// Initialize routes
const routes = require("./routes");
routes.initRoutes(app, dependencyManager);

// Start the server
const init = require("./init");
init
  .startServer(app, dependencyManager)
  .then(({ httpServer, httpsServer }) => {
    // Store servers for graceful shutdown
    global.httpServer = httpServer;
    global.httpsServer = httpsServer;

    logger.info("Server started successfully", {
      service: "tatt2awai-bot",
      signatureCount: global.imageMatcher?.signatureCache?.size || 0,
      memoryUsage: Math.round(process.memoryUsage().heapUsed / (1024 * 1024)),
      enterpriseFeaturesEnabled: global.enterpriseInitialized || false,
    });
  })
  .catch((error) => {
    logger.error(`Server failed to start: ${error.message}`, {
      service: "tatt2awai-bot",
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  });

// Handle process events
process.on("SIGTERM", () => init.gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => init.gracefulShutdown("SIGINT"));
process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception:", {
    service: "server",
    error: error.message,
    stack: error.stack,
  });

  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled rejection:", {
    service: "server",
    error: reason.message || reason,
    stack: reason.stack || "No stack trace",
  });
});

// Add to the end of server.js temporarily
function printRoutes() {
  console.log("ROUTES:");
  app._router.stack.forEach(function (middleware) {
    if (middleware.route) {
      console.log(middleware.route.path, Object.keys(middleware.route.methods));
    }
  });
}
printRoutes();

// For testing
module.exports = { app };
