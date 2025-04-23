// src/components/AdminRoute.jsx
import React, { useState, useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

/**
 * Route that requires admin privileges
 */
function AdminRoute() {
  // Use the auth context
  const { currentUser, loading, isAdmin } = useAuth();
  const [isVerifying, setIsVerifying] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasAdminRights, setHasAdminRights] = useState(false);

  // Get location for redirects
  const location = useLocation();

  // Verify authentication and admin rights
  useEffect(() => {
    const verifyAdminRights = async () => {
      try {
        console.log("AdminRoute: Verifying authentication and admin rights");

        // Check localStorage first for quicker response
        const storedAuth = localStorage.getItem("isAuthenticated") === "true";
        const mfaVerified =
          localStorage.getItem("mfa_verified") === "true" ||
          sessionStorage.getItem("mfa_verified") === "true";

        // Special case for test admin
        const storedUser = localStorage.getItem("currentUser");
        let isTestAdmin = false;

        if (storedUser) {
          try {
            const userData = JSON.parse(storedUser);
            isTestAdmin = userData.email === "itsus@tatt2away.com";

            if (isTestAdmin) {
              console.log("AdminRoute: Test admin detected");
              setIsAuthenticated(true);
              setHasAdminRights(true);
              setIsVerifying(false);
              return;
            }

            // Also check for admin roles in stored user
            if (storedAuth && mfaVerified && userData.roles) {
              const hasAdminRole =
                userData.roles.includes("admin") ||
                userData.roles.includes("super_admin");

              if (hasAdminRole) {
                console.log("AdminRoute: Admin role detected in stored user");
                setIsAuthenticated(true);
                setHasAdminRights(true);
                setIsVerifying(false);
                return;
              }
            }
          } catch (e) {
            console.warn("Error parsing stored user:", e);
          }
        }

        // Double-check session with Supabase
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("AdminRoute: Session verification error:", error);
          setIsAuthenticated(false);
          setHasAdminRights(false);
          setIsVerifying(false);
          return;
        }

        if (data?.session) {
          console.log("AdminRoute: Valid session found");

          // Check if it's the test admin account
          if (data.session.user.email === "itsus@tatt2away.com") {
            console.log("AdminRoute: Test admin account detected");

            // Set all required flags
            localStorage.setItem("isAuthenticated", "true");
            localStorage.setItem("mfa_verified", "true");
            sessionStorage.setItem("mfa_verified", "true");
            localStorage.setItem("authStage", "post-mfa");

            setIsAuthenticated(true);
            setHasAdminRights(true);
            setIsVerifying(false);
            return;
          }

          // For OAuth login, check user's roles from profiles table
          try {
            const { data: profileData, error: profileError } = await supabase
              .from("profiles")
              .select("roles")
              .eq("id", data.session.user.id)
              .single();

            if (profileError) {
              console.error(
                "AdminRoute: Error fetching profile:",
                profileError
              );
              setIsAuthenticated(true);
              setHasAdminRights(false);
            } else {
              const hasAdminRole =
                profileData.roles?.includes("admin") ||
                profileData.roles?.includes("super_admin");

              console.log("AdminRoute: User roles:", profileData.roles);
              console.log("AdminRoute: Has admin rights:", hasAdminRole);

              setIsAuthenticated(true);
              setHasAdminRights(hasAdminRole);
            }
          } catch (profileError) {
            console.error("AdminRoute: Profile check error:", profileError);
            setIsAuthenticated(true);
            setHasAdminRights(false);
          }
        } else {
          console.log("AdminRoute: No valid session found");
          setIsAuthenticated(false);
          setHasAdminRights(false);
        }

        setIsVerifying(false);
      } catch (error) {
        console.error("AdminRoute: Verification error:", error);
        setIsAuthenticated(false);
        setHasAdminRights(false);
        setIsVerifying(false);
      }
    };

    verifyAdminRights();
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

  // Check if user is authenticated
  if (!isAuthenticated && !currentUser) {
    console.log("AdminRoute: Not authenticated, redirecting to login");
    return (
      <Navigate
        to={`/login?returnUrl=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }

  // Special handling for test admin user
  if (currentUser?.email === "itsus@tatt2away.com" || hasAdminRights) {
    console.log("AdminRoute: Admin access granted");
    return <Outlet />;
  }

  // User is authenticated but not admin, redirect to unauthorized
  console.log(
    "AdminRoute: User lacks admin rights, redirecting to unauthorized"
  );
  return <Navigate to="/unauthorized" replace />;
}

export default AdminRoute;
