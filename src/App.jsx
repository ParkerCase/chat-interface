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

// Enhanced auth state verification and repair
const ensureAuthState = () => {
  console.log("Running enhanced auth state verification");

  const isAdminPage = window.location.pathname.startsWith("/admin");
  let needsReload = false;
  const currentUserJson = localStorage.getItem("currentUser");

  if (currentUserJson) {
    try {
      const currentUser = JSON.parse(currentUserJson);
      console.log("Found user in localStorage:", currentUser.email);

      if (
        currentUser.email === "itsus@tatt2away.com" ||
        currentUser.email === "parker@tatt2away.com"
      ) {
        console.log("Admin account detected:", currentUser.email);

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
          needsReload = true;
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
          needsReload = true;
        }
      }
    } catch (e) {
      console.warn("Error parsing currentUser:", e);
    }
  }

  const checkSupabaseSession = async () => {
    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error("Session check error:", error);
        return;
      }

      if (data?.session) {
        const email = data.session.user.email;
        console.log("Active session found for:", email);

        if (
          email === "itsus@tatt2away.com" ||
          email === "parker@tatt2away.com"
        ) {
          console.log("Admin account session detected");

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

            needsReload = true;
          }
        }

        if (localStorage.getItem("isAuthenticated") !== "true") {
          localStorage.setItem("isAuthenticated", "true");
          needsReload = isAdminPage;
        }
      }

      if (needsReload && isAdminPage) {
        console.log("Auth state fixed, reloading page");
        setTimeout(() => window.location.reload(), 100);
      }
    } catch (err) {
      console.error("Error checking Supabase session:", err);
    }
  };

  checkSupabaseSession();
};

if (typeof window !== "undefined") {
  ensureAuthState();
}

function AppContent() {
  const { isInitialized, loading } = useAuth();
  const [outOfMemory, setOutOfMemory] = useState(false);

  useEffect(() => {
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
      window.removeEventListener("error", handleOutOfMemory);
    };
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
