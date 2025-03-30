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

// Professional Tier Features
import APIKeyManagement from "./components/APIKeyManagement";

// Enterprise Features
import WorkflowManagement from "./components/enterprise/WorkflowManagement";
import AnalyticsDashboard from "./components/enterprise/AnalyticsDashboard";
import IntegrationSettings from "./components/enterprise/IntegrationSettings";
import AlertsManagement from "./components/enterprise/AlertsManagement";

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
