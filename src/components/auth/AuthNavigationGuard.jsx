// src/components/auth/AuthNavigationGuard.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { Loader2 } from "lucide-react";

/**
 * Navigation guard component that handles authentication redirects
 * and fixes auth state issues
 */
function AuthNavigationGuard({ children }) {
  const { currentUser, isInitialized, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState("");

  const isAuthRoute =
    location.pathname === "/login" ||
    location.pathname === "/register" ||
    location.pathname === "/forgot-password" ||
    location.pathname === "/reset-password" ||
    location.pathname.startsWith("/auth/");

  const isMfaRoute =
    location.pathname === "/mfa/verify" ||
    location.pathname.includes("/verify");

  // Handle authentication state and redirects
  useEffect(() => {
    // Skip if auth is still initializing
    if (!isInitialized) return;

    const handleNavigation = async () => {
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
          await logout();
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
        // If already authenticated, redirect to dashboard
        if (currentUser && !loading) {
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
      if (!currentUser && !loading) {
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
  ]);

  // Handle serious authentication issues
  useEffect(() => {
    if (!isInitialized) return;

    // Check for auth state issues on important routes
    if (!currentUser && !loading && !isAuthRoute && !isMfaRoute) {
      console.log("Auth inconsistency detected, attempting recovery...");

      const runRecovery = async () => {
        setIsRecovering(true);
        setRecoveryMessage("Checking authentication status...");

        try {
          // Check if we have a session but no user
          const { data } = await supabase.auth.getSession();

          if (data?.session) {
            setRecoveryMessage("Recovering authentication state...");

            try {
              // Try to get user data
              const { data: userData } = await supabase.auth.getUser();

              if (userData?.user) {
                // Get profile data
                const { data: profileData } = await supabase
                  .from("profiles")
                  .select("*")
                  .eq("id", userData.user.id)
                  .single();

                // Create user object
                const user = {
                  id: userData.user.id,
                  email: userData.user.email,
                  name: profileData?.full_name || userData.user.email,
                  roles: profileData?.roles || ["user"],
                  tier: "enterprise",
                };

                // Update localStorage
                localStorage.setItem("authToken", data.session.access_token);
                localStorage.setItem(
                  "refreshToken",
                  data.session.refresh_token
                );
                localStorage.setItem("currentUser", JSON.stringify(user));
                localStorage.setItem("isAuthenticated", "true");

                // Reload the page to reinitialize auth context
                window.location.reload();
                return;
              }
            } catch (recoveryError) {
              console.error("Auth recovery error:", recoveryError);
            }
          }

          // If recovery fails or no session, redirect to login
          console.log(
            "Auth recovery failed or no session, redirecting to login"
          );
          const returnUrl = encodeURIComponent(
            location.pathname + location.search
          );
          navigate(`/login?returnUrl=${returnUrl}`, { replace: true });
        } catch (error) {
          console.error("Auth recovery error:", error);
          // On error, redirect to login
          navigate("/login", { replace: true });
        } finally {
          setIsRecovering(false);
        }
      };

      runRecovery();
    }
  }, [
    currentUser,
    loading,
    isInitialized,
    navigate,
    location,
    isAuthRoute,
    isMfaRoute,
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

  // Render children when everything is good
  return children;
}

export default AuthNavigationGuard;
