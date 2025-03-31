// src/App.jsx
import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { FeatureFlagProvider } from "./utils/featureFlags";
import MainApp from "./components/MainApp";
import Register from "./components/admin/Register";
import MfaVerify from "./components/MfaVerify";
import ErrorBoundary from "./components/ErrorBoundary";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import AuthPage from "./components/AuthPage";
import AdminPanel from "./components/admin/AdminPanel";
import FilePermissionsManager from "./components/admin/FilePermissionsManager";
import FeatureProtectedRoute from "./components/FeatureProtectedRoute";
import { supabase } from "./lib/supabase";
import SSOCallback from "./components/auth/SSOCallback";
import AccountPage from "./components/account/AccountPage";
import FilePermissionsRoute from "./components/FilePermissionsRoute";
import AuthDebugger from "./components/AuthDebugger";
import { debugAuth } from "./utils/authDebug";
// Professional Tier Features
import APIKeyManagement from "./components/APIKeyManagement";

// Enterprise Features
import WorkflowManagement from "./components/enterprise/WorkflowManagement";
import AnalyticsDashboard from "./components/enterprise/AnalyticsDashboard";
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

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN") {
        // Refresh user data
        // Handle in AuthContext
      } else if (event === "SIGNED_OUT") {
        // Clear local storage / state
        // Handle in AuthContext
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Add this to App.jsx or your root component
  useEffect(() => {
    // Check if there's a pending redirect from MFA
    const pendingRedirect = sessionStorage.getItem("mfaRedirectPending");
    const redirectTarget = sessionStorage.getItem("mfaRedirectTarget");

    if (pendingRedirect === "true" && redirectTarget) {
      console.log("Executing pending MFA redirect to:", redirectTarget);
      // Clear the pending flag
      sessionStorage.removeItem("mfaRedirectPending");
      sessionStorage.removeItem("mfaRedirectTarget");

      // Execute the redirect
      window.location.replace(redirectTarget);
    }
  }, []);

  useEffect(() => {
    const checkAndClearMfaRedirect = () => {
      // Another check for MFA redirect flag
      const pendingMfaRedirect = sessionStorage.getItem("mfaRedirectPending");

      if (pendingMfaRedirect === "true") {
        console.log("Found pending MFA redirect flag - redirecting to admin");

        // Clear flags
        sessionStorage.removeItem("mfaRedirectPending");
        sessionStorage.removeItem("mfaRedirectTarget");

        // Force admin redirect
        window.location.href = "/admin";
      }
    };

    // Run check on mount
    checkAndClearMfaRedirect();
  }, []);

  useEffect(() => {
    // Setup auth redirects
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

  useEffect(() => {
    // Only check for MFA completion explicitly
    const handleMfaCompletion = () => {
      // Check if we just completed MFA
      const mfaVerified = sessionStorage.getItem("mfa_verified");

      if (mfaVerified === "true") {
        console.log("Detected successful MFA verification");
        // Clear the flag
        sessionStorage.removeItem("mfa_verified");

        // Only redirect if we're still on the MFA page
        if (
          window.location.pathname.includes("/mfa") ||
          window.location.pathname.includes("/verify")
        ) {
          console.log("Still on MFA page, redirecting to admin");
          window.location.href = "/admin";
        }
      }
    };

    // Run once on mount
    handleMfaCompletion();
  }, []);

  useEffect(() => {
    // Check for MFA success on each render/navigation
    const checkMfaSuccess = () => {
      const mfaSuccess = sessionStorage.getItem("mfaSuccess");
      if (mfaSuccess === "true") {
        debugAuth.log("App", "Detected MFA success flag, handling redirect");

        // Clear the flag
        sessionStorage.removeItem("mfaSuccess");

        // Get current location
        const currentPath = window.location.pathname;

        // If not already on admin page, redirect
        if (currentPath !== "/admin") {
          debugAuth.log("App", "Redirecting to admin from", currentPath);
          window.location.replace("/admin");
        }
      }
    };

    checkMfaSuccess();

    // Also add a global handler for unhandled promise rejections
    const handleUnhandledRejection = (event) => {
      debugAuth.log("Global", "Unhandled Promise Rejection", event.reason);

      // If this is during MFA or password change, try to recover
      if (
        window.location.pathname.includes("/mfa") ||
        window.location.pathname.includes("/security")
      ) {
        debugAuth.log(
          "Global",
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
      <AuthProvider>
        <FeatureFlagProvider>
          <Router>
            <div className="app-container">
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<AuthPage />} />
                <Route path="/forgot-password" element={<AuthPage />} />
                <Route path="/reset-password" element={<AuthPage />} />
                <Route path="/mfa/verify" element={<MfaVerify />} />
                <Route path="/auth/callback" element={<SSOCallback />} />

                {/* Protected routes that require authentication */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/" element={<MainApp />} />
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
                  <Route path="/analytics" element={<AnalyticsDashboard />} />
                  <Route path="/workflows" element={<WorkflowManagement />} />
                  <Route
                    path="/integrations"
                    element={<IntegrationSettings />}
                  />
                  <Route path="/alerts" element={<AlertsManagement />} />

                  {/* Admin-only routes for user management */}
                  <Route element={<AdminRoute />}>
                    <Route path="/admin" element={<AdminPanel />} />
                    <Route path="/admin/register" element={<Register />} />
                    <Route
                      path="/admin/users"
                      element={<AdminPanel tab="users" />}
                    />
                  </Route>

                  {/* Admin-only routes for file permissions */}
                  <Route element={<FilePermissionsRoute />}>
                    <Route
                      path="/admin/permissions"
                      element={<FilePermissionsManager />}
                    />
                  </Route>
                </Route>

                {/* Fallback route */}
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
              {process.env.NODE_ENV === "development" && <AuthDebugger />}
            </div>
          </Router>
        </FeatureFlagProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

// Export environment variables for use in other components
export { ENV };
export default App;
