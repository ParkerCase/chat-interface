// src/router.jsx
import React from "react";
import { createBrowserRouter, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { useFeatureFlags } from "./utils/featureFlags";

// Layouts
import AppLayout from "./components/layouts/AppLayout";
import AuthLayout from "./components/layouts/AuthLayout";

// Pages
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import MfaVerifyPage from "./pages/auth/MfaVerifyPage";

import DashboardPage from "./pages/DashboardPage";
import ProfilePage from "./pages/ProfilePage";
import SecurityPage from "./pages/SecurityPage";

// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import UserManagement from "./pages/admin/UserManagement";

// Enterprise pages
import WorkflowManagement from "./components/enterprise/WorkflowManagement";
import IntegrationSettings from "./components/enterprise/IntegrationSettings";
import AlertsManagement from "./components/enterprise/AlertsManagement";
import AnalyticsDashboard from "./components/enterprise/AnalyticsDashboard";

// Error pages
import NotFoundPage from "./pages/errors/NotFoundPage";
import ForbiddenPage from "./pages/errors/ForbiddenPage";

// Protected route component
const ProtectedRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();
  const location = useLocation();

  // Loading state
  if (loading) {
    return <div>Loading...</div>;
  }

  // Redirect to login if not authenticated
  if (!currentUser) {
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }

  return children;
};

// Role protected route component
const RoleProtectedRoute = ({ roles, children }) => {
  const { currentUser, hasRole } = useAuth();

  // Check if user has any of the required roles
  const hasRequiredRole = roles.some((role) => hasRole(role));

  if (!hasRequiredRole) {
    return <Navigate to="/forbidden" replace />;
  }

  return children;
};

// Feature protected route component
const FeatureProtectedRoute = ({ feature, children }) => {
  const { isFeatureEnabled } = useFeatureFlags();

  // Check if feature is enabled
  if (!isFeatureEnabled(feature)) {
    return <Navigate to="/forbidden" replace />;
  }

  return children;
};

// Create router
const router = createBrowserRouter([
  // Public routes
  {
    path: "/",
    element: <AuthLayout />,
    children: [
      {
        path: "/login",
        element: <LoginPage />,
      },
      {
        path: "/register",
        element: <RegisterPage />,
      },
      {
        path: "/forgot-password",
        element: <ForgotPasswordPage />,
      },
      {
        path: "/reset-password",
        element: <ResetPasswordPage />,
      },
      {
        path: "/mfa/verify",
        element: <MfaVerifyPage />,
      },
      {
        path: "/auth/callback",
        element: <div>Processing authentication...</div>,
      },
    ],
  },

  // Protected routes
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: "/",
        element: <DashboardPage />,
      },
      {
        path: "/profile",
        element: <ProfilePage />,
      },
      {
        path: "/security",
        element: <SecurityPage />,
      },

      // Admin routes
      {
        path: "/admin",
        element: (
          <RoleProtectedRoute roles={["admin", "super_admin"]}>
            <AdminDashboard />
          </RoleProtectedRoute>
        ),
      },
      {
        path: "/admin/users",
        element: (
          <RoleProtectedRoute roles={["admin", "super_admin"]}>
            <UserManagement />
          </RoleProtectedRoute>
        ),
      },

      // Enterprise features
      {
        path: "/enterprise/workflows",
        element: (
          <FeatureProtectedRoute feature="custom_workflows">
            <WorkflowManagement />
          </FeatureProtectedRoute>
        ),
      },
      {
        path: "/enterprise/integrations",
        element: (
          <FeatureProtectedRoute feature="custom_integrations">
            <IntegrationSettings />
          </FeatureProtectedRoute>
        ),
      },
      {
        path: "/enterprise/alerts",
        element: (
          <FeatureProtectedRoute feature="automated_alerts">
            <AlertsManagement />
          </FeatureProtectedRoute>
        ),
      },
      {
        path: "/enterprise/analytics",
        element: (
          <FeatureProtectedRoute feature="advanced_analytics">
            <AnalyticsDashboard />
          </FeatureProtectedRoute>
        ),
      },
    ],
  },

  // Error pages
  {
    path: "/forbidden",
    element: <ForbiddenPage />,
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);

export default router;
