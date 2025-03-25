const logger = require("../logger");
const AnalyticsManager = require("../analytics/AnalyticsManager");
const AlertManager = require("../analytics/AlertManager");
const DashboardPresets = require("../analytics/DashboardPresets");

/**
 * Creates a minimal ThemeManager with fallback functionality
 * @returns {Object} Simple theme manager with basic methods
 */
function createFallbackThemeManager() {
  return {
    initialized: true,
    getTheme: () => ({
      colors: {
        primary: "#1976D2",
        background: "#FFFFFF",
        text: { primary: "#212121" },
      },
    }),
    getAllThemes: () => [
      {
        id: "default",
        name: "Default Theme",
        description: "Default system theme",
        preview: {
          primary: "#1976D2",
          background: "#FFFFFF",
          text: "#212121",
        },
        isDefault: true,
      },
    ],
    getThemeCSS: () => `:root {
      --color-primary: #1976D2;
      --color-background: #FFFFFF;
      --color-text-primary: #212121;
    }`,
    getUserPreference: () => Promise.resolve("default"),
    setUserPreference: () => Promise.resolve(true),
  };
}

/**
 * Initialize application services
 * @param {Express} app - Express application
 * @param {Object} imageMatcher - Initialized image matcher
 * @returns {Promise<boolean>} Success status
 */
async function initialize(app, imageMatcher) {
  try {
    logger.info("Initializing application services...");

    try {
      const themeManager =
        app.get("themeManager") || require("../ui/ThemeManager");
      if (themeManager && typeof themeManager.initialize === "function") {
        const success = await themeManager.initialize();
        if (success) {
          logger.info("Theme Manager initialized successfully");
          app.set("themeManager", themeManager);
        } else {
          logger.warn("Theme Manager initialization returned false");
        }
      } else {
        logger.warn("Theme Manager doesn't have an initialize method");
      }
    } catch (themeErr) {
      logger.error("Failed to initialize Theme Manager:", {
        error: themeErr.message,
        stack: themeErr.stack,
      });
      // Create basic theme manager with minimal functionality
      app.set("themeManager", createFallbackThemeManager());
    }

    try {
      logger.info("Initializing analytics services...");

      // Initialize analytics manager
      const analyticsManager = new AnalyticsManager({
        collectSearchMetrics: true,
        collectUserMetrics: true,
        collectSystemMetrics: true,
        collectContentMetrics: true,
      });
      await analyticsManager.initialize();
      app.set("analyticsManager", analyticsManager);
      global.analyticsManager = analyticsManager;
      logger.info("Analytics Manager initialized successfully");

      // Initialize dashboard presets
      const dashboardPresets = new DashboardPresets(global.supabaseClient);
      app.set("dashboardPresets", dashboardPresets);
      logger.info("Dashboard Presets initialized successfully");

      // Initialize alert manager
      const alertManager = new AlertManager(
        global.supabaseClient,
        analyticsManager
      );
      await alertManager.initialize();
      app.set("alertManager", alertManager);
      logger.info("Alert Manager initialized successfully");
    } catch (analyticsErr) {
      logger.error("Failed to initialize analytics services:", {
        error: analyticsErr.message,
        stack: analyticsErr.stack,
      });
      // Continue despite analytics initialization failure
    }

    try {
      logger.info("Initializing Zenoti connector...");

      // Initialize the Zenoti connector
      const ZenotiConnector = require("../integration/connectors/ZenotiConnector");
      const zenotiConnector = new ZenotiConnector({
        // Default config
        baseUrl: process.env.ZENOTI_API_URL || "https://api.zenoti.com/v1",
        timeout: 30000,
      });

      // Register with app
      app.set("zenotiConnector", zenotiConnector);
      logger.info("Zenoti connector initialized successfully");
    } catch (zenotiErr) {
      logger.error("Failed to initialize Zenoti connector:", {
        error: zenotiErr.message,
        stack: zenotiErr.stack,
      });
      // Continue despite Zenoti initialization failure
    }

    // Try to load DependencyManager if available
    let dependencyManager;
    try {
      const DependencyManager = require("../DependencyManager");
      if (typeof DependencyManager === "function") {
        dependencyManager = new DependencyManager();
        logger.info("Dependency manager initialized");
      } else if (typeof DependencyManager.getInstance === "function") {
        dependencyManager = DependencyManager.getInstance();
        logger.info("Dependency manager singleton accessed");
      } else {
        dependencyManager = DependencyManager;
        logger.info("Using Dependency manager instance");
      }
    } catch (err) {
      logger.warn("Dependency manager not available:", {
        error: err.message,
      });
      // Create simple dependency manager
      dependencyManager = {
        register(name, service) {
          this[name] = service;
          return service;
        },
        get(name) {
          return this[name];
        },
      };
    }

    // Register services with dependency manager if available
    if (dependencyManager && typeof dependencyManager.register === "function") {
      // Register image matcher
      dependencyManager.register("imageMatcher", imageMatcher);

      // Register analytics services if available
      if (app.get("analyticsManager")) {
        dependencyManager.register(
          "analyticsManager",
          app.get("analyticsManager")
        );
      }
      if (app.get("alertManager")) {
        dependencyManager.register("alertManager", app.get("alertManager"));
      }

      if (app.get("zenotiConnector")) {
        dependencyManager.register(
          "zenotiConnector",
          app.get("zenotiConnector")
        );
      }
      if (app.get("dashboardPresets")) {
        dependencyManager.register(
          "dashboardPresets",
          app.get("dashboardPresets")
        );
      }
    }

    // Try to load services from services directory
    try {
      const fs = require("fs");
      const path = require("path");
      const servicesDir = path.join(__dirname, "../services");

      if (fs.existsSync(servicesDir)) {
        const serviceFiles = fs
          .readdirSync(servicesDir)
          .filter((file) => file.endsWith(".js"));

        for (const file of serviceFiles) {
          try {
            const servicePath = path.join(servicesDir, file);
            const service = require(servicePath);

            // Get service name from filename
            const serviceName = file.replace(".js", "");

            // Initialize service if it has an initialize method
            if (typeof service.initialize === "function") {
              await service.initialize(app);
              logger.info(`Initialized service: ${serviceName}`);
            }

            // Register with dependency manager
            if (
              dependencyManager &&
              typeof dependencyManager.register === "function"
            ) {
              dependencyManager.register(serviceName, service);
            }

            // Set on app for middleware to access
            app.set(serviceName, service);
          } catch (serviceErr) {
            logger.warn(`Failed to initialize service: ${file}`, {
              error: serviceErr.message,
            });
          }
        }
      }
    } catch (servicesErr) {
      logger.warn("Error loading services directory:", {
        error: servicesErr.message,
      });
    }

    // Set dependency manager on app
    if (dependencyManager) {
      app.set("dependencyManager", dependencyManager);
    }

    logger.info("Application services initialized successfully");
    return true;
  } catch (error) {
    logger.error("Failed to initialize services:", {
      error: error.message,
      stack: error.stack,
    });
    return false;
  }
}

module.exports = {
  initialize,
};
