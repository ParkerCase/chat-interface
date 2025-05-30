// src/utils/testZenotiIntegration.js
import { supabase } from "../lib/supabase";
import supabaseZenotiService from "../services/supabaseZenotiService";

/**
 * Utility to test and debug Zenoti integration with Supabase Edge Functions
 */
const testZenotiIntegration = {
  /**
   * Test the basic Supabase Edge Function connectivity
   */
  testEdgeFunctionConnectivity: async () => {
    try {
      console.log("Testing basic Supabase Edge Function connectivity...");

      // Call a simple function to check connectivity
      const { data, error } = await supabase.functions.invoke(
        "zenoti-connector",
        {
          body: { test: true },
        }
      );

      if (error) {
        console.error("Edge Function error:", error);
        return {
          success: false,
          error: `Failed to connect to Edge Function: ${error.message}`,
          status: "error",
        };
      }

      return {
        success: true,
        message: "Successfully connected to Supabase Edge Function",
        data,
        status: "connected",
      };
    } catch (err) {
      console.error("Error testing Edge Function:", err);
      return {
        success: false,
        error: `Exception: ${err.message}`,
        status: "error",
      };
    }
  },

  /**
   * Test the Zenoti environment variables in Edge Function
   */
  testZenotiEnvironment: async () => {
    try {
      console.log("Testing Zenoti environment in Edge Function...");

      const { data, error } = await supabase.functions.invoke(
        "zenoti-connector",
        {
          body: { endpoint: "debug-env" },
        }
      );

      if (error) {
        console.error("Edge Function error:", error);
        return {
          success: false,
          error: `Failed to check Zenoti environment: ${error.message}`,
          status: "error",
        };
      }

      if (!data?.env) {
        return {
          success: false,
          error: "No environment data returned",
          status: "error",
          raw: data,
        };
      }

      // Check if all required environment variables are set
      const requiredVars = [
        "apiUrl",
        "hasApiKey",
        "useOAuth",
        "hasUsername",
        "hasPassword",
      ];
      const missingVars = requiredVars.filter((v) => !data.env[v]);

      if (missingVars.length > 0) {
        return {
          success: false,
          error: `Missing required environment variables: ${missingVars.join(
            ", "
          )}`,
          status: "incomplete",
          env: data.env,
        };
      }

      return {
        success: true,
        message: "Zenoti environment is properly configured",
        env: data.env,
        status: "configured",
      };
    } catch (err) {
      console.error("Error testing Zenoti environment:", err);
      return {
        success: false,
        error: `Exception: ${err.message}`,
        status: "error",
      };
    }
  },

  /**
   * Test Zenoti authentication
   */
  testZenotiAuth: async () => {
    try {
      console.log("Testing Zenoti authentication...");

      const { data, error } = await supabase.functions.invoke(
        "zenoti-connector",
        {
          body: { endpoint: "test-auth" },
        }
      );

      if (error) {
        console.error("Edge Function error:", error);
        return {
          success: false,
          error: `Failed to test authentication: ${error.message}`,
          status: "error",
        };
      }

      if (!data?.success) {
        return {
          success: false,
          error: data?.error || "Authentication failed",
          status: "unauthorized",
          raw: data,
        };
      }

      return {
        success: true,
        message: `Successfully authenticated with Zenoti using ${data.authMethod}`,
        authMethod: data.authMethod,
        status: "authorized",
      };
    } catch (err) {
      console.error("Error testing Zenoti auth:", err);
      return {
        success: false,
        error: `Exception: ${err.message}`,
        status: "error",
      };
    }
  },

  /**
   * Test getting centers (a real Zenoti API call)
   */
  testGetCenters: async () => {
    try {
      console.log("Testing Zenoti getCenters API...");
      const response = await supabaseZenotiService.getCenters();

      if (!response.data?.success) {
        return {
          success: false,
          error: response.data?.error || "Failed to get centers",
          status: "error",
          raw: response.data,
        };
      }

      const centers = response.data.centers || [];
      return {
        success: true,
        message: `Successfully retrieved ${centers.length} centers from Zenoti`,
        centers,
        status: "connected",
      };
    } catch (err) {
      console.error("Error testing getCenters:", err);
      return {
        success: false,
        error: `Exception: ${err.message}`,
        status: "error",
      };
    }
  },

  /**
   * Test searching contacts
   */
  testSearchContacts: async (centerCode) => {
    try {
      console.log(`Testing search contacts for center: ${centerCode}`);

      if (!centerCode) {
        return {
          success: false,
          error: "Center code is required",
          status: "error",
        };
      }

      const response = await supabaseZenotiService.searchClients({
        centerCode,
        limit: 5, // Small limit for testing
      });

      if (!response.data?.success) {
        return {
          success: false,
          error: response.data?.error || "Failed to search contacts",
          status: "error",
          raw: response.data,
        };
      }

      const clients = response.data.clients || [];
      return {
        success: true,
        message: `Successfully retrieved ${clients.length} contacts from Zenoti`,
        count: clients.length,
        clients: clients.slice(0, 3), // Only return first 3 for the report
        status: "connected",
      };
    } catch (err) {
      console.error("Error testing search contacts:", err);
      return {
        success: false,
        error: `Exception: ${err.message}`,
        status: "error",
      };
    }
  },

  /**
   * Run a complete diagnostic test
   */
  runDiagnostic: async (centerCode) => {
    console.log("Running complete Zenoti integration diagnostic...");

    const results = {
      connectivity: await this.testEdgeFunctionConnectivity(),
      environment: await this.testZenotiEnvironment(),
      auth: await this.testZenotiAuth(),
      centers: null,
      contacts: null,
    };

    // Only test API calls if auth is working
    if (results.auth.success) {
      results.centers = await this.testGetCenters();

      // Only test contacts if we have a center code and centers were retrieved
      if (centerCode && results.centers.success) {
        results.contacts = await this.testSearchContacts(centerCode);
      }
    }

    // Overall success determination
    const success =
      results.connectivity.success &&
      results.environment.success &&
      results.auth.success &&
      (results.centers?.success || false);

    return {
      success,
      results,
      timestamp: new Date().toISOString(),
    };
  },

  /**
   * Generate a detailed report in HTML format
   */
  generateReport: async (centerCode) => {
    const diagnostic = await this.runDiagnostic(centerCode);
    const results = diagnostic.results;

    let html = `
      <style>
        .report-container { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .report-header { text-align: center; margin-bottom: 20px; }
        .success { color: green; }
        .error { color: red; }
        .warning { color: orange; }
        .result-item { margin-bottom: 15px; padding: 10px; border: 1px solid #ddd; border-radius: 5px; }
        .result-title { font-weight: bold; margin-bottom: 5px; display: flex; align-items: center; }
        .status-indicator { width: 12px; height: 12px; border-radius: 50%; margin-right: 8px; }
        .success-bg { background-color: green; }
        .error-bg { background-color: red; }
        .warning-bg { background-color: orange; }
        .details { margin-left: 20px; }
        pre { background-color: #f5f5f5; padding: 10px; border-radius: 5px; overflow: auto; }
      </style>
      
      <div class="report-container">
        <div class="report-header">
          <h1>Zenoti Integration Diagnostic Report</h1>
          <p>Timestamp: ${diagnostic.timestamp}</p>
          <p class="${diagnostic.success ? "success" : "error"}">
            <strong>Overall Status: ${
              diagnostic.success ? "PASSED" : "FAILED"
            }</strong>
          </p>
        </div>
    `;

    // Connectivity
    html += `
      <div class="result-item">
        <div class="result-title">
          <div class="status-indicator ${
            results.connectivity.success ? "success-bg" : "error-bg"
          }"></div>
          <span>Edge Function Connectivity: ${
            results.connectivity.success ? "PASSED" : "FAILED"
          }</span>
        </div>
        <div class="details">
          ${
            results.connectivity.success
              ? `<p>${results.connectivity.message}</p>`
              : `<p class="error">Error: ${results.connectivity.error}</p>`
          }
        </div>
      </div>
    `;

    // Environment
    html += `
      <div class="result-item">
        <div class="result-title">
          <div class="status-indicator ${
            results.environment.success ? "success-bg" : "error-bg"
          }"></div>
          <span>Zenoti Environment: ${
            results.environment.success ? "PASSED" : "FAILED"
          }</span>
        </div>
        <div class="details">
          ${
            results.environment.success
              ? `<p>${results.environment.message}</p>`
              : `<p class="error">Error: ${results.environment.error}</p>`
          }
          
          ${
            results.environment.env
              ? `
            <p><strong>Environment Configuration:</strong></p>
            <pre>${JSON.stringify(results.environment.env, null, 2)}</pre>
          `
              : ""
          }
        </div>
      </div>
    `;

    // Auth
    html += `
      <div class="result-item">
        <div class="result-title">
          <div class="status-indicator ${
            results.auth.success ? "success-bg" : "error-bg"
          }"></div>
          <span>Zenoti Authentication: ${
            results.auth.success ? "PASSED" : "FAILED"
          }</span>
        </div>
        <div class="details">
          ${
            results.auth.success
              ? `<p>${results.auth.message}</p>`
              : `<p class="error">Error: ${results.auth.error}</p>`
          }
        </div>
      </div>
    `;

    // Centers
    if (results.centers) {
      html += `
        <div class="result-item">
          <div class="result-title">
            <div class="status-indicator ${
              results.centers.success ? "success-bg" : "error-bg"
            }"></div>
            <span>Zenoti Centers API: ${
              results.centers.success ? "PASSED" : "FAILED"
            }</span>
          </div>
          <div class="details">
            ${
              results.centers.success
                ? `<p>${results.centers.message}</p>`
                : `<p class="error">Error: ${results.centers.error}</p>`
            }
            
            ${
              results.centers.centers
                ? `
              <p><strong>Centers (${
                results.centers.centers.length
              }):</strong></p>
              <pre>${JSON.stringify(
                results.centers.centers.slice(0, 3),
                null,
                2
              )}${
                    results.centers.centers.length > 3
                      ? "\n... and " +
                        (results.centers.centers.length - 3) +
                        " more"
                      : ""
                  }</pre>
            `
                : ""
            }
          </div>
        </div>
      `;
    }

    // Contacts
    if (results.contacts) {
      html += `
        <div class="result-item">
          <div class="result-title">
            <div class="status-indicator ${
              results.contacts.success ? "success-bg" : "error-bg"
            }"></div>
            <span>Zenoti Contacts API: ${
              results.contacts.success ? "PASSED" : "FAILED"
            }</span>
          </div>
          <div class="details">
            ${
              results.contacts.success
                ? `<p>${results.contacts.message}</p>`
                : `<p class="error">Error: ${results.contacts.error}</p>`
            }
            
            ${
              results.contacts.clients
                ? `
              <p><strong>Sample Contacts:</strong></p>
              <pre>${JSON.stringify(results.contacts.clients, null, 2)}</pre>
            `
                : ""
            }
          </div>
        </div>
      `;
    }

    html += `
      </div>
    `;

    return html;
  },

  /**
   * Expose this method to window for easy console testing
   */
  exposeToConsole: () => {
    window.testZenotiIntegration = {
      runDiagnostic: (centerCode) =>
        testZenotiIntegration.runDiagnostic(centerCode),
      generateReport: (centerCode) => {
        testZenotiIntegration.generateReport(centerCode).then((html) => {
          // Create a hidden div to hold the report
          const reportDiv = document.createElement("div");
          reportDiv.style.position = "fixed";
          reportDiv.style.top = "10px";
          reportDiv.style.right = "10px";
          reportDiv.style.width = "800px";
          reportDiv.style.height = "90vh";
          reportDiv.style.backgroundColor = "white";
          reportDiv.style.zIndex = "9999";
          reportDiv.style.overflow = "auto";
          reportDiv.style.padding = "20px";
          reportDiv.style.boxShadow = "0 0 10px rgba(0, 0, 0, 0.5)";
          reportDiv.style.borderRadius = "5px";

          // Add a close button
          const closeButton = document.createElement("button");
          closeButton.innerText = "Close Report";
          closeButton.style.position = "sticky";
          closeButton.style.top = "0";
          closeButton.style.right = "0";
          closeButton.style.padding = "8px 16px";
          closeButton.style.backgroundColor = "#f44336";
          closeButton.style.color = "white";
          closeButton.style.border = "none";
          closeButton.style.borderRadius = "4px";
          closeButton.style.cursor = "pointer";
          closeButton.style.marginBottom = "10px";
          closeButton.onclick = () => document.body.removeChild(reportDiv);

          // Add content and close button
          reportDiv.innerHTML = html;
          reportDiv.insertBefore(closeButton, reportDiv.firstChild);

          // Add to body
          document.body.appendChild(reportDiv);

          console.log(
            "Report generated and displayed. Click the close button when done."
          );
        });
      },
    };

    console.log(
      "Zenoti integration testing utilities exposed to window.testZenotiIntegration"
    );
    return "Use window.testZenotiIntegration.runDiagnostic() or window.testZenotiIntegration.generateReport() to test integration";
  },
};

// Self-invoking function to expose testing methods to window
(() => {
  if (typeof window !== "undefined") {
    testZenotiIntegration.exposeToConsole();
  }
})();

export default testZenotiIntegration;
