// src/Routes.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import MainApp from "./components/MainApp";
import AdminPanel from "./components/admin/AdminPanel";
import Register from "./components/admin/Register";
import AccountPage from "./components/account/AccountPage";
import FilePermissionsManager from "./components/admin/FilePermissionsManager";
import AuthPage from "./components/AuthPage";
import SSOCallback from "./components/auth/SSOCallback";
import MfaVerify from "./components/MfaVerify";
import ProtectedRoute from "./components/ProtectedRoute";
import UnauthorizedPage from "./components/UnauthorizedPage";

// Professional Tier Features
import APIKeyManagement from "./components/APIKeyManagement";

// Enterprise Features
import WorkflowManagement from "./components/enterprise/WorkflowManagement";
import AnalyticsDashboard from "./components/enterprise/AnalyticsDashboard";
import IntegrationSettings from "./components/enterprise/IntegrationSettings";
import AlertsManagement from "./components/enterprise/AlertsManagement";

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<AuthPage />} />
      <Route path="/passcode" element={<AuthPage />} />
      <Route path="/forgot-password" element={<AuthPage />} />
      <Route path="/reset-password" element={<AuthPage />} />
      <Route path="/mfa/verify" element={<MfaVerify />} />
      <Route path="/auth/callback" element={<SSOCallback />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      {/* Protected routes - basic user access */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<MainApp />} />
        <Route path="/profile" element={<AccountPage tab="profile" />} />
        <Route path="/security" element={<AccountPage tab="security" />} />
        <Route path="/password" element={<AccountPage tab="password" />} />
        <Route path="/sessions" element={<AccountPage tab="sessions" />} />
      </Route>

      {/* Professional tier features */}
      <Route
        element={
          <ProtectedRoute
            requireFeatures={["data_export"]}
            fallback={<Navigate to="/account/upgrade" />}
          />
        }
      >
        <Route path="/api-keys" element={<APIKeyManagement />} />
      </Route>

      {/* Admin routes */}
      <Route
        element={
          <ProtectedRoute
            requireRoles={["admin", "super_admin"]}
            fallback={<Navigate to="/unauthorized" />}
          />
        }
      >
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/admin/register" element={<Register />} />
        <Route path="/admin/permissions" element={<FilePermissionsManager />} />
      </Route>

      {/* Enterprise features */}
      <Route
        element={
          <ProtectedRoute
            requireFeatures={["custom_workflows"]}
            fallback={<Navigate to="/account/upgrade" />}
          />
        }
      >
        <Route path="/workflows" element={<WorkflowManagement />} />
      </Route>

      <Route
        element={
          <ProtectedRoute
            requireFeatures={["advanced_analytics"]}
            fallback={<Navigate to="/account/upgrade" />}
          />
        }
      >
        <Route path="/analytics" element={<AnalyticsDashboard />} />
      </Route>

      <Route
        element={
          <ProtectedRoute
            requireFeatures={["custom_integrations"]}
            fallback={<Navigate to="/account/upgrade" />}
          />
        }
      >
        <Route path="/integrations" element={<IntegrationSettings />} />
      </Route>

      <Route
        element={
          <ProtectedRoute
            requireFeatures={["automated_alerts"]}
            fallback={<Navigate to="/account/upgrade" />}
          />
        }
      >
        <Route path="/alerts" element={<AlertsManagement />} />
      </Route>

      {/* Fallback route */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default AppRoutes;
