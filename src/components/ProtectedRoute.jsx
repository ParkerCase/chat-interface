// src/components/ProtectedRoute.jsx
import React, { useState, useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

/**
 * Protected route component that requires authentication
 */
function ProtectedRoute() {
  // Get the location for redirects
  const location = useLocation();
  const [isVerifying, setIsVerifying] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Use the auth context
  const { currentUser, loading } = useAuth();

  // Verify authentication directly
  useEffect(() => {
    const verifyAuth = async () => {
      try {
        console.log("ProtectedRoute: Verifying authentication");

        // Check localStorage first for quicker response
        const storedAuth = localStorage.getItem("isAuthenticated") === "true";
        const mfaVerified =
          localStorage.getItem("mfa_verified") === "true" ||
          sessionStorage.getItem("mfa_verified") === "true";

        if (storedAuth && mfaVerified) {
          console.log("ProtectedRoute: Auth verified from localStorage");
          setIsAuthenticated(true);
          setIsVerifying(false);
          return;
        }

        // If not authenticated from localStorage, check Supabase session
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("ProtectedRoute: Session verification error:", error);
          setIsAuthenticated(false);
          setIsVerifying(false);
          return;
        }

        if (data?.session) {
          console.log("ProtectedRoute: Valid session found");

          // Automatically set as authenticated for OAuth logins
          if (data.session.user.app_metadata?.provider !== "email") {
            console.log("ProtectedRoute: OAuth login detected, auto-verifying");
            localStorage.setItem("isAuthenticated", "true");
            localStorage.setItem("mfa_verified", "true");
            sessionStorage.setItem("mfa_verified", "true");
            localStorage.setItem("authStage", "post-mfa");

            setIsAuthenticated(true);
          } else {
            // For email login, check if MFA is verified
            const emailMfaVerified =
              localStorage.getItem("mfa_verified") === "true" ||
              sessionStorage.getItem("mfa_verified") === "true";

            setIsAuthenticated(emailMfaVerified);
          }
        } else {
          console.log("ProtectedRoute: No valid session found");
          setIsAuthenticated(false);
        }

        setIsVerifying(false);
      } catch (error) {
        console.error("ProtectedRoute: Auth verification error:", error);
        setIsAuthenticated(false);
        setIsVerifying(false);
      }
    };

    verifyAuth();
  }, []);

  // Show loading during initialization
  if (loading || isVerifying) {
    return (
      <div
        className="auth-loading"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "30px",
          textAlign: "center",
        }}
      >
        <Loader className="spinner" size={24} />
        <p>Verifying authentication...</p>
      </div>
    );
  }

  // Special case for admin test account
  if (currentUser?.email === "itsus@tatt2away.com") {
    console.log("ProtectedRoute: Test admin access granted");
    return <Outlet />;
  }

  // Check if user is authenticated
  if (!currentUser && !isAuthenticated) {
    console.log("ProtectedRoute: Not authenticated, redirecting to login");
    // Store the current path for redirection after login
    return (
      <Navigate
        to={`/login?returnUrl=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }

  // User is authenticated, render protected content
  console.log("ProtectedRoute: Access granted");
  return <Outlet />;
}

export default ProtectedRoute;
