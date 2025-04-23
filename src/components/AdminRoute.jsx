// src/components/AdminRoute.jsx
import React, { useState, useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

/**
 * Enhanced route that requires admin privileges
 * With special handling for admin test accounts and improved verification
 */
function AdminRoute() {
  console.log("🛡️ AdminRoute: Evaluating access...");
  console.log("→ currentUser:", currentUser);
  console.log("→ isAdmin:", isAdmin);

  // Use the auth context
  const { currentUser, loading, isAdmin, isInitialized } = useAuth();
  const [isVerifying, setIsVerifying] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasAdminRights, setHasAdminRights] = useState(false);
  const [debugLogs, setDebugLogs] = useState([]);

  // Get location for redirects
  const location = useLocation();

  // Helper for logging
  const logDebug = (message, data = null) => {
    console.log(`AdminRoute: ${message}`, data || "");
    setDebugLogs((prev) => [
      ...prev,
      { message, data, time: new Date().toISOString() },
    ]);
  };

  // Verify authentication and admin rights
  useEffect(() => {
    const verifyAdminRights = async () => {
      logDebug("Starting admin rights verification");

      // FASTEST PATH: Check for test admin accounts first
      const storedUser = localStorage.getItem("currentUser");

      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          logDebug("Found user in localStorage", { email: userData.email });

          // Special case for admin accounts
          if (
            userData.email === "itsus@tatt2away.com" ||
            userData.email === "parker@tatt2away.com"
          ) {
            logDebug("Admin account detected!", { email: userData.email });

            // Force all required auth flags
            localStorage.setItem("isAuthenticated", "true");
            localStorage.setItem("mfa_verified", "true");
            sessionStorage.setItem("mfa_verified", "true");
            localStorage.setItem("authStage", "post-mfa");

            // Ensure correct roles
            if (!userData.roles?.includes("super_admin")) {
              logDebug("Fixing admin roles");
              userData.roles = ["super_admin", "admin", "user"];
              localStorage.setItem("currentUser", JSON.stringify(userData));
            }

            setIsAuthenticated(true);
            setHasAdminRights(true);
            setIsVerifying(false);
            return; // Short circuit - we know this is an admin
          }

          // Not a test admin, but check roles in localStorage
          const hasAdminRole =
            userData.roles?.includes("admin") ||
            userData.roles?.includes("super_admin");
          if (hasAdminRole) {
            logDebug("User has admin role in localStorage");
            setIsAuthenticated(true);
            setHasAdminRights(true);
          }
        } catch (e) {
          logDebug("Error parsing stored user:", e.message);
        }
      }

      // Check Supabase session next
      try {
        logDebug("Checking Supabase session");
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          logDebug("Session verification error:", error.message);
          setIsVerifying(false);
          return;
        }

        if (data?.session) {
          logDebug("Valid session found for", data.session.user.email);

          // Check if it's an admin account
          if (
            data.session.user.email === "itsus@tatt2away.com" ||
            data.session.user.email === "parker@tatt2away.com"
          ) {
            logDebug("Admin account detected in session");

            // Force all required auth flags
            localStorage.setItem("isAuthenticated", "true");
            localStorage.setItem("mfa_verified", "true");
            sessionStorage.setItem("mfa_verified", "true");
            localStorage.setItem("authStage", "post-mfa");

            // Create admin user if not in localStorage
            if (!storedUser) {
              const adminUser = {
                id: data.session.user.id || "admin-uuid",
                email: data.session.user.email,
                name:
                  data.session.user.email === "itsus@tatt2away.com"
                    ? "Tatt2Away Admin"
                    : "Parker Admin",
                roles: ["super_admin", "admin", "user"],
                tier: "enterprise",
              };

              localStorage.setItem("currentUser", JSON.stringify(adminUser));
            }

            setIsAuthenticated(true);
            setHasAdminRights(true);
            setIsVerifying(false);
            return; // Short circuit - we know this is an admin
          }

          // For regular users, we're at least authenticated
          setIsAuthenticated(true);

          // Check profile table for admin role
          try {
            logDebug("Checking user role in profiles table");
            const { data: profileData, error: profileError } = await supabase
              .from("profiles")
              .select("roles")
              .eq("id", data.session.user.id)
              .single();

            if (profileError) {
              if (!profileError.message.includes("No rows found")) {
                logDebug("Error fetching profile:", profileError.message);
              }
            } else {
              // Check roles from profile
              const isAdminFromProfile =
                profileData?.roles?.includes("admin") ||
                profileData?.roles?.includes("super_admin");

              logDebug("Admin rights from profile:", isAdminFromProfile);
              setHasAdminRights(isAdminFromProfile);

              // Update localStorage if needed
              if (storedUser && isAdminFromProfile) {
                try {
                  const userData = JSON.parse(storedUser);
                  if (!userData.roles?.includes("admin")) {
                    logDebug("Updating roles in localStorage");
                    userData.roles = [...(userData.roles || []), "admin"];
                    localStorage.setItem(
                      "currentUser",
                      JSON.stringify(userData)
                    );
                  }
                } catch (e) {
                  logDebug("Error updating user roles:", e.message);
                }
              }
            }
          } catch (profileError) {
            logDebug("Profile check error:", profileError.message);
          }
        } else {
          logDebug("No valid session found");
        }
      } catch (error) {
        logDebug("Verification error:", error.message);
      } finally {
        // Fall back to auth context if we haven't confirmed admin rights yet
        if (!hasAdminRights && !isAuthenticated) {
          logDebug("Falling back to auth context", {
            isAdmin,
            currentUserEmail: currentUser?.email,
          });

          // Use auth context status
          setIsAuthenticated(!!currentUser);
          setHasAdminRights(isAdmin);
        }

        setIsVerifying(false);
      }
    };

    // Start verification
    verifyAdminRights();
  }, [currentUser, isAdmin]);

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
        <p>Verifying admin access...</p>
      </div>
    );
  }

  // IMPORTANT: Special case for test admin user - MUST be handled first
  // This ensures the test admin accounts always work
  if (
    currentUser?.email === "itsus@tatt2away.com" ||
    currentUser?.email === "parker@tatt2away.com"
  ) {
    logDebug("Special admin account verified, granting access");
    return <Outlet />;
  }

  // Check admin rights next
  if (hasAdminRights) {
    logDebug("Admin rights verified, granting access");
    return <Outlet />;
  }

  // Not authenticated at all, redirect to login
  if (!isAuthenticated) {
    logDebug("Not authenticated, redirecting to login");
    return (
      <Navigate
        to={`/login?returnUrl=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }

  // User is authenticated but not admin, redirect to unauthorized
  logDebug("User lacks admin rights, redirecting to unauthorized");
  return <Navigate to="/unauthorized" replace />;
}

export default AdminRoute;
