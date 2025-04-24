// src/App.jsx
import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";

// Auth components
import AuthPage from "./components/AuthPage";
import MfaVerify from "./components/MfaVerify";
import SSOCallback from "./components/auth/SSOCallback";
import EnhancedPasswordReset from "./components/auth/EnhancedPasswordReset";
import ResetPasswordPage from "./components/auth/ResetPasswordPage";
import AccountPage from "./components/account/AccountPage";

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

// Add at the beginning of your App.jsx file, before calling ensureAuthState:
if (typeof window !== "undefined") {
  // Anti reload-loop protection
  const lastReload = sessionStorage.getItem("lastReloadTime");
  const now = Date.now();

  if (lastReload && now - parseInt(lastReload) < 3000) {
    console.warn("Reload loop detected - breaking the cycle");
    // Set a flag to prevent further auto-reloads
    sessionStorage.setItem("breakReloadLoop", "true");
    // Clear any flags that might be causing reloads
    sessionStorage.removeItem("authRefreshInProgress");
    localStorage.removeItem("authRefreshCount");
  } else {
    sessionStorage.setItem("lastReloadTime", now.toString());
  }

  if (sessionStorage.getItem("breakReloadLoop") === "true") {
    // Allow the app to function normally but log potential reload triggers
    console.log("Reload loop protection active - monitoring navigation events");

    // Create a safe navigation object we can use throughout the app
    window.safeNavigation = {
      // Safe version of reload that uses history API instead
      reload: function () {
        console.warn("Reload attempted during reload-loop protection");
        console.trace("Reload call stack:");
        // Don't actually reload
        return false;
      },

      // Log navigation attempts without blocking them
      navigateTo: function (url) {
        if (typeof url === "string" && url.includes("/admin")) {
          console.warn(`Admin navigation attempted: ${url}`);
          console.trace("Navigation call stack:");
        }
        return true; // Allow normal navigation
      },
    };

    // Add a way to safely monitor navigation events
    window.addEventListener("beforeunload", function (e) {
      if (sessionStorage.getItem("breakReloadLoop") === "true") {
        console.log("Navigation/reload attempted during protection");
        // We don't prevent navigation, just log it
      }
    });

    // Apply protection for 15 seconds, then restore normal behavior
    setTimeout(() => {
      console.log("Reload protection removed - normal navigation restored");
      sessionStorage.removeItem("breakReloadLoop");
      delete window.safeNavigation;
    }, 15000);
  }
}

// NOW, MODIFIED ensureAuthState FUNCTION WITH ADDITIONAL SAFEGUARDS:

const ensureAuthState = () => {
  // Skip completely if breaking a reload loop
  if (sessionStorage.getItem("breakReloadLoop") === "true") {
    console.log(
      "✅ Skipping auth state verification due to reload loop protection"
    );
    return;
  }

  console.log("Running enhanced auth state verification");

  // CRITICAL: Prevent multiple refreshes in a short time period
  const lastRefreshTime = sessionStorage.getItem("lastAuthRefreshTime");
  const currentTime = Date.now();

  // Skip if we refreshed within the last 10 seconds
  if (lastRefreshTime && currentTime - parseInt(lastRefreshTime) < 10000) {
    console.log("Skipping auth state verification (ran recently)");
    return;
  }

  // Also skip if we're already in a refresh cycle
  if (sessionStorage.getItem("authRefreshInProgress") === "true") {
    console.log("Auth refresh already in progress, skipping");
    return;
  }

  // Track this verification attempt
  sessionStorage.setItem("lastAuthRefreshTime", currentTime.toString());

  const isAdminPage = window.location.pathname.startsWith("/admin");
  let needsReload = false;
  const currentUserJson = localStorage.getItem("currentUser");

  // Step 1: Test for admin accounts in localStorage
  if (currentUserJson) {
    try {
      const currentUser = JSON.parse(currentUserJson);
      console.log("Found user in localStorage:", currentUser.email);

      if (
        currentUser.email === "itsus@tatt2away.com" ||
        currentUser.email === "parker@tatt2away.com"
      ) {
        console.log("Admin account detected:", currentUser.email);

        // Ensure all auth flags are set
        if (
          localStorage.getItem("isAuthenticated") !== "true" ||
          localStorage.getItem("mfa_verified") !== "true" ||
          sessionStorage.getItem("mfa_verified") !== "true" ||
          localStorage.getItem("authStage") !== "post-mfa"
        ) {
          console.log("Setting required auth flags for admin account");
          localStorage.setItem("isAuthenticated", "true");
          localStorage.setItem("mfa_verified", "true");
          sessionStorage.setItem("mfa_verified", "true");
          localStorage.setItem("authStage", "post-mfa");
          // Don't set needsReload here - just fix the flags
        }

        const hasCorrectRoles =
          Array.isArray(currentUser.roles) &&
          currentUser.roles.includes("super_admin") &&
          currentUser.roles.includes("admin") &&
          currentUser.roles.includes("user");

        if (!hasCorrectRoles) {
          console.log("Fixing admin roles");
          currentUser.roles = ["super_admin", "admin", "user"];
          localStorage.setItem("currentUser", JSON.stringify(currentUser));
          // No reload needed after fixing roles
        }
      }
    } catch (e) {
      console.warn("Error parsing currentUser:", e);
      // Clear corrupted data
      localStorage.removeItem("currentUser");
      // Here we actually need to reload
      needsReload = true;
    }
  }

  // Step 2: Check Supabase session
  const checkSupabaseSession = async () => {
    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error("Session check error:", error);
        sessionStorage.removeItem("authRefreshInProgress");
        return;
      }

      if (data?.session) {
        const email = data.session.user.email;
        console.log("Active session found for:", email);

        // Special handling for admin accounts
        if (
          email === "itsus@tatt2away.com" ||
          email === "parker@tatt2away.com"
        ) {
          console.log("Admin account session detected");

          // Create or update admin user in localStorage
          if (!currentUserJson) {
            console.log("Creating admin user in localStorage");

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

            // We'll let the app naturally re-render instead of forcing a reload
          }
        } else {
          // For regular users, make sure isAuthenticated is set
          if (localStorage.getItem("isAuthenticated") !== "true") {
            localStorage.setItem("isAuthenticated", "true");

            // For logged in users without profile, set a basic one
            if (!currentUserJson) {
              const basicUser = {
                id: data.session.user.id,
                email: email,
                name: email,
                roles: ["user"],
                tier: "basic",
              };
              localStorage.setItem("currentUser", JSON.stringify(basicUser));
            }
          }
        }
      } else {
        console.log("No active session found");

        // If no active session but we have localStorage data, clear it
        if (
          currentUserJson &&
          localStorage.getItem("isAuthenticated") === "true"
        ) {
          console.log("Clearing stale auth data");
          localStorage.removeItem("currentUser");
          localStorage.removeItem("isAuthenticated");
          localStorage.removeItem("mfa_verified");
          sessionStorage.removeItem("mfa_verified");
          localStorage.removeItem("authStage");
          needsReload = isAdminPage;
        }
      }

      // Carefully handle reload if necessary, without actually modifying
      // window.location.reload
      if (needsReload && isAdminPage) {
        // Get current reload count
        const refreshCount = parseInt(
          localStorage.getItem("authRefreshCount") || "0"
        );

        // Safety check - don't reload more than 3 times
        if (refreshCount > 3) {
          console.warn("Too many auth refreshes detected, breaking the loop");
          sessionStorage.setItem("breakReloadLoop", "true");
          sessionStorage.removeItem("authRefreshInProgress");
          localStorage.removeItem("authRefreshCount");
          return;
        }

        // Set in-progress flag and increment counter
        console.log(`Auth state needs reload (attempt ${refreshCount + 1})`);
        sessionStorage.setItem("authRefreshInProgress", "true");
        localStorage.setItem("authRefreshCount", (refreshCount + 1).toString());

        // Use setTimeout to trigger the reload using history API
        setTimeout(() => {
          if (sessionStorage.getItem("breakReloadLoop") !== "true") {
            sessionStorage.removeItem("authRefreshInProgress");
            // Use history API instead of location.reload()
            window.history.go(0);
          } else {
            console.log("Reload cancelled due to reload loop protection");
            sessionStorage.removeItem("authRefreshInProgress");
          }
        }, 1000);
      } else {
        // Reset refresh count if no refresh needed
        localStorage.removeItem("authRefreshCount");
        sessionStorage.removeItem("authRefreshInProgress");
      }
    } catch (err) {
      console.error("Error checking Supabase session:", err);
      // Clear the in-progress flag on error
      sessionStorage.removeItem("authRefreshInProgress");
    }
  };

  // Run session check
  checkSupabaseSession();
};

if (typeof window !== "undefined") {
  ensureAuthState();
}

function AppContent() {
  const { isInitialized, loading } = useAuth();
  const [outOfMemory, setOutOfMemory] = useState(false);

  useEffect(() => {
    // Skip verification entirely if we're in a reload loop
    if (sessionStorage.getItem("breakReloadLoop") === "true") {
      console.log("Skipping auth verification due to reload loop protection");

      // Create a way out of the loop protection after 15 seconds
      const resetTimer = setTimeout(() => {
        console.log("Removing reload loop protection");
        sessionStorage.removeItem("breakReloadLoop");
      }, 15000);

      return () => clearTimeout(resetTimer);
    }

    // Run auth verification after a short delay
    const verifyTimer = setTimeout(() => {
      ensureAuthState();
    }, 500);

    // Handle out of memory errors as before
    const handleOutOfMemory = () => {
      console.error("Out of memory error detected");
      setOutOfMemory(true);
      try {
        localStorage.removeItem("imageCache");
        if (window.gc) window.gc();
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
      clearTimeout(verifyTimer);
      window.removeEventListener("error", handleOutOfMemory);
    };
  }, []);

  // Custom event for auth verification completion
  useEffect(() => {
    if (isInitialized && !loading) {
      // Dispatch a custom event that other components can listen for
      window.dispatchEvent(
        new CustomEvent("authInitialized", {
          detail: { success: true, timestamp: Date.now() },
        })
      );
    }
  }, [isInitialized, loading]);

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
        <p>Initializing authentication...</p>
      </div>
    );
  }

  return (
    <Router>
      <NotificationProvider>
        <div className="app-container">
          <Routes>
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
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
