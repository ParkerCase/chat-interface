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
import AdminRoute from "./components/AdminRoute";
import FilePermissionsRoute from "./components/FilePermissionsRoute";
import UnauthorizedPage from "./components/UnauthorizedPage";
import AuthNavigationGuard from "./components/auth/AuthNavigationGuard";
import ResetPasswordPage from "./components/auth/ResetPasswordPage";

// Professional Tier Features
import APIKeyManagement from "./components/APIKeyManagement";

// Enterprise Features
import WorkflowManagement from "./components/enterprise/WorkflowManagement";
import AnalyticsDashboard from "./components/enterprise/AnalyticsDashboard";
import IntegrationSettings from "./components/enterprise/IntegrationSettings";
import AlertsManagement from "./components/enterprise/AlertsManagement";

function AppRoutes() {
  return (
    <AuthNavigationGuard>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<AuthPage />} />
        <Route path="/passcode" element={<AuthPage />} />
        <Route path="/forgot-password" element={<AuthPage />} />

        {/* CRITICAL: Password reset route must be outside ProtectedRoute */}
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
          <Route path="/analytics" element={<AnalyticsDashboard />} />
          <Route path="/workflows" element={<WorkflowManagement />} />
          <Route path="/integrations" element={<IntegrationSettings />} />
          <Route path="/alerts" element={<AlertsManagement />} />
          <Route path="/api-keys" element={<APIKeyManagement />} />

          {/* Admin-only routes for user management */}
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/admin/register" element={<Register />} />
            <Route path="/admin/users" element={<AdminPanel tab="users" />} />
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
    </AuthNavigationGuard>
  );
}

export default AppRoutes;
