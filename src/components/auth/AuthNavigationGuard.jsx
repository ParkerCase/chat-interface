// src/components/auth/AuthNavigationGuard.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { Loader2 } from "lucide-react";
import { debugAuth } from "../../utils/authDebug";

/**
 * Navigation guard component that handles authentication redirects
 * and fixes auth state issues
 */
function AuthNavigationGuard({ children }) {
  // Add null safety to auth context access
  const auth = useAuth() || {};
  const { currentUser, isInitialized, loading, logout } = auth;

  const navigate = useNavigate();
  const location = useLocation();
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState("");

  // Identify route types for conditional handling
  const isAuthRoute =
    location.pathname === "/login" ||
    location.pathname === "/register" ||
    location.pathname === "/forgot-password" ||
    location.pathname === "/auth/callback";

  const isPasswordResetRoute = location.pathname === "/reset-password";

  const isMfaRoute =
    location.pathname === "/mfa/verify" ||
    location.pathname.includes("/verify");

  // Handle authentication state and redirects
  useEffect(() => {
    // Skip if auth is still initializing or loading
    if (!isInitialized || loading) return;

    const handleNavigation = async () => {
      // CRITICAL: Check if we're in password reset flow - if so, bypass all redirects
      const inPasswordResetFlow =
        localStorage.getItem("password_reset_in_progress") === "true" ||
        sessionStorage.getItem("password_reset_in_progress") === "true";

      if (isPasswordResetRoute && inPasswordResetFlow) {
        console.log(
          "User is in password reset flow, bypassing all navigation guards"
        );
        return;
      }

      // Check password reset route for token parameters to recognize a fresh reset attempt
      if (isPasswordResetRoute) {
        const params = new URLSearchParams(location.search);
        const hasResetParams =
          params.has("token") ||
          params.has("code") || // Add code parameter detection
          params.has("type") ||
          params.has("access_token") ||
          window.location.hash;

        if (hasResetParams) {
          console.log(
            "Reset parameters detected in URL, allowing access to reset page"
          );
          // Set the flag to prevent future redirects during this flow
          localStorage.setItem("password_reset_in_progress", "true");
          sessionStorage.setItem("password_reset_in_progress", "true");
          return;
        }
      }

      // Check if this is a post-password-change state
      const passwordChanged =
        localStorage.getItem("passwordChanged") === "true";
      const forceLogout = localStorage.getItem("forceLogout") === "true";

      if (passwordChanged || forceLogout) {
        console.log("Detected password change state, redirecting to login");
        setIsRecovering(true);
        setRecoveryMessage("Finalizing password change...");

        try {
          // Force a clean logout
          if (logout) {
            await logout();
          }
          // Keep the passwordChanged flag
          localStorage.setItem("passwordChanged", "true");
          // Navigate to login
          navigate("/login?passwordChanged=true", { replace: true });
        } catch (err) {
          console.error("Error handling password change redirect:", err);
          // Last resort - just reload the page
          window.location.href = "/login?passwordChanged=true";
        } finally {
          setIsRecovering(false);
        }

        return;
      }

      // Public routes - no auth needed
      if (isAuthRoute) {
        // If already authenticated, redirect to dashboard (except in special cases)
        if (currentUser && !loading && !isPasswordResetRoute) {
          navigate("/admin", { replace: true });
        }
        return;
      }

      // MFA routes - special handling
      if (isMfaRoute) {
        // Allow access even if not fully authenticated
        return;
      }

      // Protected routes - auth required
      if (!currentUser && !loading && !isPasswordResetRoute) {
        console.log("Auth required but no user, redirecting to login");
        // Save the current location to redirect back after login
        const returnUrl = encodeURIComponent(
          location.pathname + location.search
        );
        navigate(`/login?returnUrl=${returnUrl}`, { replace: true });
        return;
      }

      // Admin routes - admin role required
      if (location.pathname.startsWith("/admin")) {
        const isAdmin =
          currentUser?.roles?.includes("admin") ||
          currentUser?.roles?.includes("super_admin") ||
          currentUser?.email === "itsus@tatt2away.com";

        if (!isAdmin) {
          console.log("Admin access required but user is not admin");
          navigate("/unauthorized", { replace: true });
          return;
        }
      }
    };

    handleNavigation();
  }, [
    currentUser,
    isInitialized,
    loading,
    navigate,
    location,
    logout,
    isAuthRoute,
    isMfaRoute,
    isPasswordResetRoute,
  ]);

  // Show recovery screen when fixing auth issues
  if (isRecovering) {
    return (
      <div className="auth-recovery-container">
        <Loader2 className="spinner" size={36} />
        <p>{recoveryMessage}</p>
      </div>
    );
  }

  // Show loading state when auth is initializing
  if (loading && !isInitialized) {
    return (
      <div className="auth-loading-container">
        <Loader2 className="spinner" size={36} />
        <p>Loading authentication state...</p>
      </div>
    );
  }

  // Render children when everything is good
  return children;
}

export default AuthNavigationGuard;
