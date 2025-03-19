// src/components/layouts/AuthLayout.jsx
import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./AuthLayout.css";

/**
 * Layout for authentication pages
 * Shows a simplified layout with branding
 * Redirects to dashboard if already authenticated
 */
const AuthLayout = () => {
  const { currentUser, loading } = useAuth();
  const location = useLocation();

  // Skip redirect for MFA verification or callbacks
  const skipAuthCheck =
    location.pathname === "/mfa/verify" ||
    location.pathname === "/auth/callback";

  // Parse the intended redirect location
  const params = new URLSearchParams(location.search);
  const redirectPath = params.get("redirect") || "/";

  // Show loading state
  if (loading) {
    return (
      <div className="auth-loading-container">
        <div className="spinner"></div>
      </div>
    );
  }

  // Redirect to dashboard if already logged in
  // But allow MFA and callback routes to work even when authenticated
  if (currentUser && !skipAuthCheck) {
    return <Navigate to={redirectPath} replace />;
  }

  return (
    <div className="auth-layout">
      <div className="auth-container">
        <div className="auth-branding">
          <img src="/logo.png" alt="Tatt2Away Logo" className="auth-logo" />
        </div>

        <div className="auth-content">
          <Outlet />
        </div>

        <div className="auth-footer">
          <p>© {new Date().getFullYear()} Tatt2Away. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
