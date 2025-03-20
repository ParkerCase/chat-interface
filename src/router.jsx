// src/router.jsx (updated version)
import React from "react";
import { createBrowserRouter, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { useFeatureFlags } from "./utils/featureFlags";

// Layouts
import AppLayout from "./components/layouts/AppLayout";
import AuthLayout from "./components/layouts/AuthLayout";

// Pages
import AuthPage from "./components/AuthPage"; // Updated to match your actual component
import MfaVerify from "./components/MfaVerify"; // Updated to match your actual component
import MainApp from "./components/MainApp";
import AccountSettings from "./components/account/AccountSettings";

// Admin pages
import AdminPanel from "./components/admin/AdminPanel";
import Register from "./components/admin/Register";

// Enterprise pages
import WorkflowManagement from "./components/enterprise/WorkflowManagement";
import IntegrationSettings from "./components/enterprise/IntegrationSettings";
import AlertsManagement from "./components/enterprise/AlertsManagement";
import AnalyticsDashboard from "./components/enterprise/AnalyticsDashboard";

// Error fallback components
const NotFoundPage = () => (
  <div className="error-page">
    <h1>404 - Page Not Found</h1>
    <p>The page you are looking for does not exist.</p>
  </div>
);

const ForbiddenPage = () => (
  <div className="error-page">
    <h1>403 - Forbidden</h1>
    <p>You don't have permission to access this resource.</p>
  </div>
);

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

  // Super admin always has access
  if (hasRole("super_admin")) {
    return children;
  }

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
        element: <AuthPage />,
      },
      {
        path: "/forgot-password",
        element: <AuthPage />,
      },
      {
        path: "/reset-password",
        element: <AuthPage />,
      },
      {
        path: "/passcode",
        element: <AuthPage />,
      },
      {
        path: "/mfa/verify",
        element: <MfaVerify />,
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
        element: <MainApp />,
      },
      {
        path: "/profile",
        element: <AccountSettings tab="profile" />,
      },
      {
        path: "/security",
        element: <AccountSettings tab="security" />,
      },
      {
        path: "/password",
        element: <AccountSettings tab="password" />,
      },
      {
        path: "/sessions",
        element: <AccountSettings tab="sessions" />,
      },

      // Admin routes
      {
        path: "/admin",
        element: (
          <RoleProtectedRoute roles={["admin", "super_admin"]}>
            <AdminPanel />
          </RoleProtectedRoute>
        ),
      },
      {
        path: "/admin/register",
        element: (
          <RoleProtectedRoute roles={["admin", "super_admin"]}>
            <Register />
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
