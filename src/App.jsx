// src/App.jsx
import React, { useState, useEffect, useCallback } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { NotificationProvider } from "./context/NotificationContext";
import { FeatureFlagProvider } from "./utils/featureFlags";
import { SupabaseAuthProvider } from "./context/SupabaseAuthProvider";
import { AuthCompatibilityProvider } from "./context/AuthCompatibilityProvider";
import MainApp from "./components/MainApp";
import Register from "./components/admin/Register";
import MfaVerify from "./components/MfaVerify";
import ErrorBoundary from "./components/ErrorBoundary";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import AuthPage from "./components/AuthPage";
import AdminPanel from "./components/admin/AdminPanel";
import EnhancedUserManagement from "./components/admin/EnhancedUserManagement";
import EnhancedSystemSettings from "./components/admin/EnhancedSystemSettings";
import FeatureProtectedRoute from "./components/FeatureProtectedRoute";
import { supabase } from "./lib/supabase";
import SSOCallback from "./components/auth/SSOCallback";
import AccountPage from "./components/account/AccountPage";
import AuthDebugger from "./components/AuthDebugger";
import { debugAuth } from "./utils/authDebug";
import AuthNavigationGuard from "./components/auth/AuthNavigationGuard";
import AuthLoading from "./components/auth/AuthLoading";
import ResetPasswordPage from "./components/auth/ResetPasswordPage";
import UnauthorizedPage from "./components/UnauthorizedPage";
import EnhancedAnalyticsDashboard from "./components/analytics/EnhancedAnalyticsDashboard";
import StorageManagement from "./components/storage/StorageManagement";

// Professional Tier Features
import APIKeyManagement from "./components/APIKeyManagement";

// Enterprise Features
import WorkflowManagement from "./components/enterprise/WorkflowManagement";
import IntegrationSettings from "./components/enterprise/IntegrationSettings";
import AlertsManagement from "./components/enterprise/AlertsManagement";
import { setupAuthRedirects } from "./utils/authRedirect";

import "./App.css";

// Load environment variables with fallbacks
const ENV = {
  API_URL: process.env.REACT_APP_API_URL || "http://147.182.247.128:4000",
  TEAM_PASSCODE: process.env.REACT_APP_TEAM_PASSCODE || "R3m0v@al$Ru$",
};

function App() {
  // Check if we're in an out-of-memory situation (common error)
  const [outOfMemory, setOutOfMemory] = useState(false);
  // Track if we're in password reset mode
  const [isInResetMode, setIsInResetMode] = useState(false);

  // Immediately check URL for password reset tokens
  useEffect(() => {
    const checkForPasswordReset = () => {
      // Check if URL contains reset parameters
      const url = window.location.href;
      const isResetPath = url.includes("/reset-password");
      const hasResetParams =
        url.includes("?token=") ||
        url.includes("?code=") ||
        url.includes("type=recovery") ||
        url.includes("access_token=") ||
        (window.location.hash &&
          window.location.hash.includes("type=recovery"));

      if (isResetPath && hasResetParams) {
        debugAuth.log("App", "Password reset detected - setting reset mode");

        // Flag for the reset flow
        localStorage.setItem("password_reset_in_progress", "true");
        sessionStorage.setItem("password_reset_in_progress", "true");
        setIsInResetMode(true);

        // Prevent auth redirects during reset flow
        localStorage.setItem("bypass_auth_redirects", "true");

        // Clear any conflicting flags
        localStorage.removeItem("authStage");
        sessionStorage.removeItem("mfa_verified");
        sessionStorage.removeItem("mfaSuccess");
      }
    };

    checkForPasswordReset();
  }, []);

  // Listen for password change events from other tabs
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === "passwordChanged" && e.newValue === "true") {
        debugAuth.log("App", "Password change detected from another tab");
        // Force page reload to update auth state
        window.location.reload();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Setup auth redirects
  useEffect(() => {
    // Skip auth redirects if in password reset mode
    if (localStorage.getItem("password_reset_in_progress") === "true") {
      debugAuth.log(
        "App",
        "Skipping auth redirects setup due to password reset in progress"
      );
      return;
    }

    // Setup auth redirects using the existing utility
    const subscription = setupAuthRedirects();

    // Cleanup on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Handle out of memory errors
  useEffect(() => {
    const handleOutOfMemory = () => {
      console.error("Out of memory error detected");
      setOutOfMemory(true);

      // Attempt cleanup
      try {
        // Clear any large objects from local storage
        localStorage.removeItem("imageCache");

        // Force garbage collection if possible
        if (window.gc) {
          window.gc();
        }
      } catch (e) {
        console.error("Cleanup failed:", e);
      }
    };

    window.addEventListener("error", (e) => {
      if (
        e.message.includes("allocation failed") ||
        e.message.includes("out of memory") ||
        e.message.includes("memory limit")
      ) {
        handleOutOfMemory();
      }
    });

    return () => {
      window.removeEventListener("error", handleOutOfMemory);
    };
  }, []);

  // Handle unhandled promise rejections
  useEffect(() => {
    const handleUnhandledRejection = (event) => {
      debugAuth.log("App", "Unhandled Promise Rejection", event.reason);

      // If this is during MFA or password change, try to recover
      if (
        window.location.pathname.includes("/mfa") ||
        window.location.pathname.includes("/security")
      ) {
        debugAuth.log(
          "App",
          "Critical auth operation detected, attempting recovery"
        );
        // Try to redirect to a safe state
        if (sessionStorage.getItem("mfaStarted") === "true") {
          sessionStorage.removeItem("mfaStarted");
          window.location.replace("/admin");
        }
      }
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection
      );
    };
  }, []);

  // If we detected an out of memory condition, show a helpful message
  if (outOfMemory) {
    return (
      <div className="memory-error-container">
        <div className="memory-error-message">
          <h2>Out of Memory Error</h2>
          <p>
            The application has encountered a memory limitation. This might be
            due to:
          </p>
          <ul>
            <li>Processing very large files</li>
            <li>Having too many browser tabs open</li>
            <li>Running other memory-intensive applications</li>
          </ul>
          <p>Please try:</p>
          <ul>
            <li>Refreshing the page</li>
            <li>Closing other browser tabs</li>
            <li>Using smaller files</li>
            <li>Restarting your browser</li>
          </ul>
          <button onClick={() => window.location.reload()}>Refresh Page</button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      {/* Use the new SupabaseAuthProvider with compatibility layer */}
      <SupabaseAuthProvider>
        <AuthCompatibilityProvider>
          <Router>
            <AuthNavigationGuard>
              <NotificationProvider>
                <FeatureFlagProvider>
                  <div className="app-container">
                    <Routes>
                      {/* Public routes */}
                      <Route path="/login" element={<AuthPage />} />

                      <Route path="/passcode" element={<AuthPage />} />
                      <Route path="/forgot-password" element={<AuthPage />} />
                      <Route
                        path="/reset-password"
                        element={<ResetPasswordPage />}
                      />
                      <Route path="/mfa/verify" element={<MfaVerify />} />
                      <Route path="/auth/callback" element={<SSOCallback />} />
                      <Route
                        path="/unauthorized"
                        element={<UnauthorizedPage />}
                      />

                      {/* Protected routes that require authentication */}
                      <Route element={<ProtectedRoute />}>
                        <Route
                          path="/"
                          element={<Navigate to="/admin" replace />}
                        />
                        <Route
                          path="/profile"
                          element={<AccountPage tab="profile" />}
                        />
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
                        <Route
                          path="/workflows"
                          element={<WorkflowManagement />}
                        />
                        <Route
                          path="/integrations"
                          element={<IntegrationSettings />}
                        />
                        <Route path="/alerts" element={<AlertsManagement />} />
                        <Route
                          path="/api-keys"
                          element={<APIKeyManagement />}
                        />

                        {/* Admin-only routes for user management */}
                        <Route element={<AdminRoute />}>
                          <Route path="/admin" element={<AdminPanel />} />
                          <Route
                            path="/admin/register"
                            element={<Register />}
                          />
                          <Route
                            path="/admin/users"
                            element={<EnhancedUserManagement />}
                          />
                          <Route
                            path="/admin/settings"
                            element={<EnhancedSystemSettings />}
                          />
                          <Route
                            path="/admin/storage"
                            element={<StorageManagement />}
                          />
                        </Route>
                      </Route>

                      {/* Fallback route */}
                      <Route path="*" element={<Navigate to="/admin" />} />
                    </Routes>
                  </div>
                </FeatureFlagProvider>
              </NotificationProvider>
            </AuthNavigationGuard>
          </Router>
        </AuthCompatibilityProvider>
      </SupabaseAuthProvider>
    </ErrorBoundary>
  );
}

// Export environment variables for use in other components
export { ENV };
export default App;
