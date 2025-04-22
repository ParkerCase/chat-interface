// src/Routes.jsx (update relevant sections)
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

// Import existing components
import MainApp from "./components/MainApp";
import AdminPanel from "./components/admin/AdminPanel";
import AuthPage from "./components/AuthPage";
import SSOCallback from "./components/auth/SSOCallback";
import MfaVerify from "./components/MfaVerify";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import UnauthorizedPage from "./components/UnauthorizedPage";
import ResetPasswordPage from "./components/auth/ResetPasswordPage";
import AccountPage from "./components/account/AccountPage";

// Import enhanced components
import EnhancedUserManagement from "./components/admin/EnhancedUserManagement";
import EnhancedAnalyticsDashboard from "./components/analytics/EnhancedAnalyticsDashboard";
import StorageManagement from "./components/storage/StorageManagement";
import EnhancedSystemSettings from "./components/admin/EnhancedSystemSettings";

// Enterprise Features
import WorkflowManagement from "./components/enterprise/WorkflowManagement";
import IntegrationSettings from "./components/enterprise/IntegrationSettings";
import AlertsManagement from "./components/enterprise/AlertsManagement";

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<AuthPage />} />
      <Route path="/passcode" element={<AuthPage />} />
      <Route path="/forgot-password" element={<AuthPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/mfa/verify" element={<MfaVerify />} />
      <Route path="/auth/callback" element={<SSOCallback />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      {/* Protected routes that require authentication */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/profile" element={<AccountPage tab="profile" />} />
        <Route path="/security" element={<AccountPage tab="security" />} />
        <Route path="/sessions" element={<AccountPage tab="sessions" />} />

        {/* Enhanced Analytics Dashboard */}
        <Route path="/analytics" element={<EnhancedAnalyticsDashboard />} />

        <Route path="/workflows" element={<WorkflowManagement />} />
        <Route path="/integrations" element={<IntegrationSettings />} />
        <Route path="/alerts" element={<AlertsManagement />} />

        {/* Admin-only routes */}
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminPanel />} />

          {/* Enhanced User Management */}
          <Route path="/admin/users" element={<EnhancedUserManagement />} />

          {/* Enhanced Storage Management (replaces file permissions) */}
          <Route path="/admin/storage" element={<StorageManagement />} />

          {/* Enhanced System Settings */}
          <Route path="/admin/settings" element={<EnhancedSystemSettings />} />
        </Route>
      </Route>

      {/* Fallback route */}
      <Route path="*" element={<Navigate to="/admin" />} />
    </Routes>
  );
}

export default AppRoutes;
