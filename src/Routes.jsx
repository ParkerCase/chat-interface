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
      <Route path="/forgot-password" element={<AuthPage />} />
      <Route path="/reset-password" element={<AuthPage />} />
      <Route path="/mfa/verify" element={<MfaVerify />} />
      <Route path="/auth/callback" element={<SSOCallback />} />

      {/* Protected routes that require authentication */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<MainApp />} />
        <Route path="/profile" element={<AccountPage tab="profile" />} />
        <Route path="/security" element={<AccountPage tab="security" />} />
        <Route path="/sessions" element={<AccountPage tab="sessions" />} />
        <Route path="/analytics" element={<AnalyticsDashboard />} />
        <Route path="/workflows" element={<WorkflowManagement />} />
        <Route path="/integrations" element={<IntegrationSettings />} />
        <Route path="/alerts" element={<AlertsManagement />} />

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
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default AppRoutes;
