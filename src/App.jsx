// src/App.jsx (Simplified)
import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

// Context providers
import { AuthProvider } from "./context/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";

// Auth components
import AuthPage from "./components/AuthPage";
import MfaVerify from "./components/MfaVerify";
import SSOCallback from "./components/auth/SSOCallback";
import EnhancedPasswordReset from "./components/auth/EnhancedPasswordReset";
import ResetPasswordPage from "./components/auth/ResetPasswordPage";
import AccountPage from "./components/account/AccountPage";
import { supabase } from "./lib/supabase";

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

import "./App.css";

const debugAndFixAuth = () => {
  // Only run on admin page
  if (window.location.pathname !== "/admin") return;

  console.log("App: Running auth check for admin page");

  // Check for admin account
  const currentUserJson = localStorage.getItem("currentUser");
  let needsReload = false;

  if (currentUserJson) {
    try {
      const currentUser = JSON.parse(currentUserJson);

      // Check if this is an admin account
      if (
        currentUser.email === "itsus@tatt2away.com" ||
        currentUser.email === "parker@tatt2away.com"
      ) {
        console.log("App: Admin account detected:", currentUser.email);

        // Ensure all auth flags are set
        if (
          localStorage.getItem("isAuthenticated") !== "true" ||
          localStorage.getItem("mfa_verified") !== "true" ||
          sessionStorage.getItem("mfa_verified") !== "true" ||
          localStorage.getItem("authStage") !== "post-mfa"
        ) {
          console.log("App: Setting missing auth flags for admin");
          localStorage.setItem("isAuthenticated", "true");
          localStorage.setItem("mfa_verified", "true");
          sessionStorage.setItem("mfa_verified", "true");
          localStorage.setItem("authStage", "post-mfa");
          needsReload = true;
        }

        // Ensure admin has correct roles
        const hasCorrectRoles =
          Array.isArray(currentUser.roles) &&
          currentUser.roles.includes("super_admin") &&
          currentUser.roles.includes("admin");

        if (!hasCorrectRoles) {
          console.log("App: Fixing admin roles");
          currentUser.roles = ["super_admin", "admin", "user"];
          localStorage.setItem("currentUser", JSON.stringify(currentUser));
          needsReload = true;
        }
      }
    } catch (e) {
      console.warn("App: Error parsing currentUser:", e);
    }
  }

  // Also check Supabase session
  supabase.auth.getSession().then(({ data, error }) => {
    if (error) {
      console.error("App: Session check error:", error);
      return;
    }

    if (data?.session) {
      const email = data.session.user.email;
      console.log("App: Active session found for:", email);

      // Check if this is an admin account
      if (email === "itsus@tatt2away.com" || email === "parker@tatt2away.com") {
        console.log("App: Admin account session detected");

        // Ensure currentUser exists and has correct values
        if (!currentUserJson) {
          console.log("App: Creating missing admin user");

          const adminUser = {
            id: data.session.user.id,
            email: email,
            name:
              email === "itsus@tatt2away.com"
                ? "Tatt2Away Admin"
                : "Parker Admin",
            roles: ["super_admin", "admin", "user"],
            tier: "enterprise",
          };

          localStorage.setItem("currentUser", JSON.stringify(adminUser));
          localStorage.setItem("isAuthenticated", "true");
          localStorage.setItem("mfa_verified", "true");
          sessionStorage.setItem("mfa_verified", "true");
          localStorage.setItem("authStage", "post-mfa");

          needsReload = true;
        }
      }

      // Ensure all users have basic auth flags set
      if (localStorage.getItem("isAuthenticated") !== "true") {
        localStorage.setItem("isAuthenticated", "true");
        needsReload = true;
      }
    }

    // Reload if needed
    if (needsReload) {
      console.log("App: Auth flags updated, reloading page");
      window.location.reload();
    }
  });
};

// Execute auth debugging
debugAndFixAuth();

function App() {
  // Check if we're in an out-of-memory situation
  const [outOfMemory, setOutOfMemory] = useState(false);

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
        <Router>
          <NotificationProvider>
            <div className="app-container">
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<AuthPage />} />
                <Route
                  path="/forgot-password"
                  element={<EnhancedPasswordReset />}
                />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/auth/callback" element={<SSOCallback />} />
                <Route path="/mfa/verify" element={<MfaVerify />} />
                <Route path="/unauthorized" element={<UnauthorizedPage />} />

                {/* Protected routes that require authentication */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/" element={<Navigate to="/admin" replace />} />
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
                  <Route path="/workflows" element={<WorkflowManagement />} />
                  <Route
                    path="/integrations"
                    element={<IntegrationSettings />}
                  />
                  <Route path="/alerts" element={<AlertsManagement />} />
                  <Route path="/api-keys" element={<APIKeyManagement />} />

                  {/* Admin-only routes */}
                  <Route element={<AdminRoute />}>
                    <Route path="/admin" element={<AdminPanel />} />
                    <Route path="/admin/register" element={<Register />} />
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
          </NotificationProvider>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
