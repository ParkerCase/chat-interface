// src/App.jsx
import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";
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
import AuthNavigationGuard from "./components/auth/AuthNavigationGuard";
import AuthLoading from "./components/auth/AuthLoading";
// Professional Tier Features
import APIKeyManagement from "./components/APIKeyManagement";

// Enterprise Features
import WorkflowManagement from "./components/enterprise/WorkflowManagement";
import AnalyticsDashboard from "./components/enterprise/AnalyticsDashboard";
import IntegrationSettings from "./components/enterprise/IntegrationSettings";
import AlertsManagement from "./components/enterprise/AlertsManagement";
import { setupAuthRedirects } from "./utils/authRedirect";
import { authRecovery } from "./utils/authRecovery";

import "./App.css";

// Load environment variables with fallbacks
const ENV = {
  API_URL: process.env.REACT_APP_API_URL || "http://147.182.247.128:4000",
  TEAM_PASSCODE: process.env.REACT_APP_TEAM_PASSCODE || "R3m0v@al$Ru$",
};

function App() {
  // Check if we're in an out-of-memory situation (common error)
  const [outOfMemory, setOutOfMemory] = useState(false);

  // Listen for password change events from other tabs
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'passwordChanged' && e.newValue === 'true') {
        console.log('Password change detected from another tab');
        // Force page reload to update auth state
        window.location.reload();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Consolidated MFA handling
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("App.jsx detected auth event:", event);

      if (event === "SIGNED_IN") {
        // Check if we're on MFA verification page
        const isOnMfaPage =
          window.location.pathname.includes("/mfa") ||
          window.location.pathname.includes("/verify");

        if (isOnMfaPage) {
          console.log("SIGNED_IN detected on MFA page - forcing redirect to admin");
          // Set all success flags
          sessionStorage.setItem("mfa_verified", "true");
          sessionStorage.setItem("mfaSuccess", "true");
          sessionStorage.setItem("mfaVerifiedAt", Date.now().toString());

          // Force redirect after a small delay to allow other handlers to run
          setTimeout(() => {
            window.location.href = "/admin";
          }, 500);
        }
      } else if (event === "MFA_CHALLENGE_VERIFIED") {
        console.log("MFA_CHALLENGE_VERIFIED event detected in App.jsx");
        sessionStorage.setItem("mfa_verified", "true");
        sessionStorage.setItem("mfaSuccess", "true");
        sessionStorage.setItem("mfaVerifiedAt", Date.now().toString());
        // Force redirect to admin
        window.location.href = "/admin";
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Consolidated pending redirects handling
  useEffect(() => {
    // Check if there's a pending redirect from MFA or any other flags
    const checkAndHandleRedirects = () => {
      // Check mfa flags and handle redirects
      const mfaVerified = sessionStorage.getItem("mfa_verified") === "true";
      const mfaSuccess = sessionStorage.getItem("mfaSuccess") === "true";
      const pendingRedirect = sessionStorage.getItem("mfaRedirectPending") === "true";
      const redirectTarget = sessionStorage.getItem("mfaRedirectTarget");
      const mfaVerifiedAt = sessionStorage.getItem("mfaVerifiedAt");
      const currentPath = window.location.pathname;
      const isOnMfaPage = currentPath.includes("/mfa") || currentPath.includes("/verify");
      
      // Clear MFA verification flags to avoid redirect loops
      if ((mfaVerified || mfaSuccess) && isOnMfaPage) {
        console.log("MFA verification success detected on MFA page");
        sessionStorage.removeItem("mfa_verified");
        sessionStorage.removeItem("mfaSuccess");
        
        // Redirect to admin page
        window.location.href = "/admin";
        return;
      }
      
      // Handle explicit redirect requests
      if (pendingRedirect && redirectTarget) {
        console.log("Executing pending MFA redirect to:", redirectTarget);
        sessionStorage.removeItem("mfaRedirectPending");
        sessionStorage.removeItem("mfaRedirectTarget");
        window.location.href = redirectTarget;
        return;
      }
      
      // Handle recent verifications
      if (mfaVerifiedAt) {
        const verifiedTime = parseInt(mfaVerifiedAt, 10);
        const now = Date.now();
        const timeSinceVerification = now - verifiedTime;
        
        if (timeSinceVerification < 10000) { // within 10 seconds
          console.log("Recent MFA verification detected");
          sessionStorage.removeItem("mfaVerifiedAt");
          
          if (isOnMfaPage) {
            console.log("Redirecting from MFA page to admin");
            window.location.href = "/admin";
          }
        }
      }
    };
    
    // Run check on mount and on focus
    checkAndHandleRedirects();
    window.addEventListener("focus", checkAndHandleRedirects);
    
    return () => {
      window.removeEventListener("focus", checkAndHandleRedirects);
    };
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

  // Handle unhandled promise rejections
  useEffect(() => {
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
        <NotificationProvider>
          <FeatureFlagProvider>
            <Router>
              <AuthNavigationGuard>
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
                    <Route path="*" element={<Navigate to="/admin" />} />
                  </Routes>
                </div>
              </AuthNavigationGuard>
            </Router>
          </FeatureFlagProvider>
        </NotificationProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

// Export environment variables for use in other components
export { ENV };
export default App;
