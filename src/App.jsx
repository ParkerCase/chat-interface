// src/App.jsx
import React, { useState, useEffect, useRef } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";
import DocumentUploadDemo from "./components/admin/DocumentUploadDemo";

// Auth components
import AuthPage from "./components/AuthPage";
import MfaVerify from "./components/MfaVerify";
import SSOCallback from "./components/auth/SSOCallback";
import EnhancedPasswordReset from "./components/auth/EnhancedPasswordReset";
import ResetPasswordPage from "./components/auth/ResetPasswordPage";
import AccountPage from "./components/account/AccountPage";
import RealtimeChatApp from "./components/messages/RealtimeChatApp";

// Route protection
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import UnauthorizedPage from "./components/UnauthorizedPage";

// Admin components
import AdminPanel from "./components/admin/AdminPanel";
import Register from "./components/admin/Register";
import EnhancedUserManagement from "./components/admin/EnhancedUserManagement";
import EnhancedSystemSettings from "./components/admin/EnhancedSystemSettings";
import EnhancedAnalyticsDashboard from "./components/analytics/EnhancedAnalyticsDashboard";
import StorageManagement from "./components/storage/StorageManagement";

// Enterprise features
import WorkflowManagement from "./components/enterprise/WorkflowManagement";
import IntegrationSettings from "./components/enterprise/IntegrationSettings";
import AlertsManagement from "./components/enterprise/AlertsManagement";
import APIKeyManagement from "./components/APIKeyManagement";

// Error handling
import ErrorBoundary from "./components/ErrorBoundary";

import { supabase } from "./lib/supabase";
import "./App.css";
import "./styles/theme.css";
import { useSessionTracker } from "./utils/api-utils";

// Anti reload-loop protection
if (typeof window !== "undefined") {
  const lastReload = sessionStorage.getItem("lastReloadTime");
  const now = Date.now();

  if (lastReload && now - parseInt(lastReload) < 3000) {
    console.warn("Reload loop detected - breaking the cycle");
    sessionStorage.setItem("breakReloadLoop", "true");
    sessionStorage.removeItem("authRefreshInProgress");
    localStorage.removeItem("authRefreshCount");
  } else {
    sessionStorage.setItem("lastReloadTime", now.toString());
  }

  if (sessionStorage.getItem("breakReloadLoop") === "true") {
    console.log("Reload loop protection active - monitoring navigation events");

    window.safeNavigation = {
      reload: function () {
        console.warn("Reload attempted during reload-loop protection");
        console.trace("Reload call stack:");
        return false;
      },

      navigateTo: function (url) {
        if (typeof url === "string" && url.includes("/admin")) {
          console.warn(`Admin navigation attempted: ${url}`);
          console.trace("Navigation call stack:");
        }
        return true;
      },
    };

    window.addEventListener("beforeunload", function (e) {
      if (sessionStorage.getItem("breakReloadLoop") === "true") {
        console.log("Navigation/reload attempted during protection");
      }
    });

    setTimeout(() => {
      console.log("Reload protection removed - normal navigation restored");
      sessionStorage.removeItem("breakReloadLoop");
      delete window.safeNavigation;
    }, 15000);
  }
}

function AppContent() {
  const { isInitialized, loading, currentUser, forceInitComplete } = useAuth();
  const [outOfMemory, setOutOfMemory] = useState(false);
  const [initTimeout, setInitTimeout] = useState(null);
  const [countdown, setCountdown] = useState(3);
  const [showRefreshButton, setShowRefreshButton] = useState(false);
  const refreshTimeoutRef = useRef(null);
  const hasRefreshedRef = useRef(false);

  // Handle out of memory errors
  useEffect(() => {
    const handleOutOfMemory = (e) => {
      if (
        e.message?.includes("allocation failed") ||
        e.message?.includes("out of memory") ||
        e.message?.includes("memory limit")
      ) {
        console.error("Out of memory error detected");
        setOutOfMemory(true);
        try {
          localStorage.removeItem("imageCache");
          if (window.gc) window.gc();
        } catch (e) {
          console.error("Cleanup failed:", e);
        }
      }
    };

    window.addEventListener("error", handleOutOfMemory);

    return () => {
      window.removeEventListener("error", handleOutOfMemory);
    };
  }, []);

  // Emergency timeout protection for auth initialization
  useEffect(() => {
    console.log("Auth timeout effect triggered:", { isInitialized, loading });

    if (!isInitialized && !loading) {
      // If we're not initialized but not loading, something is wrong
      console.warn("Auth stuck in uninitialized state - forcing completion");
      forceInitComplete();
    }

    // Set a backup timeout to force completion if auth hangs
    if (!isInitialized) {
      // Start countdown
      const countdownInterval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      const timeout = setTimeout(() => {
        console.warn("App auth initialization timeout - forcing completion");
        console.log("Current auth state:", {
          isInitialized,
          loading,
          hasRefreshed: hasRefreshedRef.current,
        });
        forceInitComplete();
        clearInterval(countdownInterval);
        setShowRefreshButton(true); // Show manual refresh button

        // Auto-refresh the page immediately after timeout
        if (!hasRefreshedRef.current) {
          console.log(
            "Auto-refreshing page due to auth initialization timeout"
          );
          hasRefreshedRef.current = true;
          // Force a hard refresh with cache busting
          const currentUrl = window.location.href;
          const separator = currentUrl.includes("?") ? "&" : "?";
          const cacheBuster = `_t=${Date.now()}`;
          const refreshUrl = currentUrl + separator + cacheBuster;
          console.log("Refreshing to:", refreshUrl);
          window.location.href = refreshUrl;
        } else {
          console.log("Refresh already triggered, skipping");
        }
      }, 3000); // 3 second timeout

      setInitTimeout(timeout);

      return () => {
        if (timeout) clearTimeout(timeout);
        clearInterval(countdownInterval);
      };
    } else {
      // Clear timeout if we initialized successfully
      if (initTimeout) {
        clearTimeout(initTimeout);
        setInitTimeout(null);
      }
      hasRefreshedRef.current = false; // Reset refresh flag
      setShowRefreshButton(false); // Hide refresh button
      setCountdown(3); // Reset countdown
    }
  }, [isInitialized, loading, forceInitComplete, initTimeout]);

  // Guaranteed refresh after 4 seconds if still loading
  useEffect(() => {
    if (!isInitialized || loading) {
      console.log("Setting up guaranteed refresh timer");
      const guaranteedRefresh = setTimeout(() => {
        console.log("Guaranteed refresh triggered after 4 seconds");
        if (!hasRefreshedRef.current) {
          hasRefreshedRef.current = true;
          const currentUrl = window.location.href;
          const separator = currentUrl.includes("?") ? "&" : "?";
          const cacheBuster = `_t=${Date.now()}`;
          const refreshUrl = currentUrl + separator + cacheBuster;
          console.log("Guaranteed refresh to:", refreshUrl);
          window.location.href = refreshUrl;
        }
      }, 4000);

      return () => {
        console.log("Clearing guaranteed refresh timer");
        clearTimeout(guaranteedRefresh);
      };
    }
  }, [isInitialized, loading]);

  // Handle storage events to detect auth changes from other tabs
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (
        e.key === "currentUser" ||
        e.key === "isAuthenticated" ||
        e.key === "authToken" ||
        e.key === "mfa_verified"
      ) {
        console.log("Auth storage changed, updating app state");
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  if (outOfMemory) {
    return (
      <div className="memory-error-container">
        <div className="memory-error-message">
          <h2>Out of Memory Error</h2>
          <p>The application has encountered a memory limitation.</p>
          <button onClick={() => window.location.reload()}>Refresh Page</button>
        </div>
      </div>
    );
  }

  if (!isInitialized || loading) {
    return (
      <div className="auth-loading-screen">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            margin: "25%",
          }}
        >
          <div className="spinner" style={{ marginBottom: "20px" }}></div>
          <p>Initializing authentication...</p>
          {initTimeout && (
            <p style={{ fontSize: "12px", color: "#666", marginTop: "10px" }}>
              This may take a moment... (Auto-refresh in {countdown}s if needed)
            </p>
          )}
          {showRefreshButton && (
            <button
              onClick={() => {
                console.log("Manual refresh triggered");
                const currentUrl = window.location.href;
                const separator = currentUrl.includes("?") ? "&" : "?";
                const cacheBuster = `_t=${Date.now()}`;
                window.location.href = currentUrl + separator + cacheBuster;
              }}
              style={{
                marginTop: "20px",
                padding: "10px 20px",
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              Refresh Now
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <Router>
      <NotificationProvider>
        <div className="app-container">
          <Routes>
            {/* Your routes here */}
            <Route path="/login" element={<AuthPage />} />
            <Route
              path="/forgot-password"
              element={<EnhancedPasswordReset />}
            />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/auth/callback" element={<SSOCallback />} />
            <Route path="/mfa/verify" element={<MfaVerify />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Navigate to="/admin" replace />} />
              <Route path="/profile" element={<AccountPage tab="profile" />} />
              <Route path="/messages" element={<RealtimeChatApp />} />
              <Route
                path="/security"
                element={<AccountPage tab="security" />}
              />
              <Route
                path="/sessions"
                element={<AccountPage tab="sessions" />}
              />
              <Route
                path="/analytics"
                element={<EnhancedAnalyticsDashboard />}
              />
              <Route path="/workflows" element={<WorkflowManagement />} />
              <Route path="/integrations" element={<IntegrationSettings />} />
              <Route path="/alerts" element={<AlertsManagement />} />
              <Route path="/api-keys" element={<APIKeyManagement />} />

              <Route element={<AdminRoute />}>
                <Route path="/admin" element={<AdminPanel />} />
                <Route path="/admin/register" element={<Register />} />
                <Route
                  path="/admin/document-demo"
                  element={<DocumentUploadDemo />}
                />

                <Route
                  path="/admin/users"
                  element={<EnhancedUserManagement />}
                />
                <Route
                  path="/admin/settings"
                  element={<EnhancedSystemSettings />}
                />

                <Route path="/admin/storage" element={<StorageManagement />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/admin" />} />
          </Routes>
        </div>
      </NotificationProvider>
    </Router>
  );
}

function App() {
  const { user } = useAuth();
  useSessionTracker(user);
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
