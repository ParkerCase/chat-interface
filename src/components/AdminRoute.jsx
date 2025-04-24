// src/components/AdminRoute.jsx - Production-Ready Implementation
import React, { useState, useEffect, useRef } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

/**
 * Enhanced route that requires admin privileges
 * With special handling for admin test accounts
 */
function AdminRoute() {
  // State for verification
  const [isVerifying, setIsVerifying] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasAdminRights, setHasAdminRights] = useState(false);

  // Use ref to prevent logging during render which can cause re-renders
  const logsRef = useRef([]);

  // Add process flag to prevent duplicate checks
  const processRef = useRef(false);
  // Flag to track if we've verified admin status from localStorage
  const verifiedFromStorageRef = useRef(false);

  // Use the auth context
  const { currentUser, loading, isAdmin } = useAuth();

  // Get location for redirects
  const location = useLocation();

  // Helper for logging - using ref to avoid state updates during render
  const logDebug = (message, data = null) => {
    const logMsg = `AdminRoute: ${message}`;
    console.log(logMsg, data || "");

    // Store in ref instead of state to avoid render loops
    if (logsRef.current) {
      logsRef.current.push({
        message,
        data,
        time: new Date().toISOString(),
      });
    }

    // Store in sessionStorage for debugging
    try {
      const logs = JSON.parse(
        sessionStorage.getItem("admin_route_logs") || "[]"
      );
      logs.push({
        timestamp: new Date().toISOString(),
        message,
        data: data ? JSON.stringify(data) : null,
      });

      if (logs.length > 50) {
        logs.splice(0, logs.length - 50);
      }

      sessionStorage.setItem("admin_route_logs", JSON.stringify(logs));
    } catch (e) {
      console.error("Error saving log:", e);
    }
  };

  // Quick check for admin from localStorage - this can run during render safely
  const quickCheckAdminStatus = () => {
    try {
      // Avoid repeating this check
      if (verifiedFromStorageRef.current) return false;

      const storedUserJson = localStorage.getItem("currentUser");
      if (!storedUserJson) return false;

      const storedUser = JSON.parse(storedUserJson);

      // Check admin email addresses
      if (
        storedUser.email === "itsus@tatt2away.com" ||
        storedUser.email === "parker@tatt2away.com"
      ) {
        // Mark as admin and authenticated
        if (!hasAdminRights) setHasAdminRights(true);
        if (!isAuthenticated) setIsAuthenticated(true);

        // Update verification state if needed
        if (isVerifying) {
          setIsVerifying(false);
          verifiedFromStorageRef.current = true;
          logDebug(
            "Admin account verified from localStorage",
            storedUser.email
          );
        }

        return true;
      }

      // Check for admin/super_admin roles
      if (
        storedUser.roles &&
        (storedUser.roles.includes("admin") ||
          storedUser.roles.includes("super_admin"))
      ) {
        // Mark as admin and authenticated
        if (!hasAdminRights) setHasAdminRights(true);
        if (!isAuthenticated) setIsAuthenticated(true);

        // Update verification state if needed
        if (isVerifying) {
          setIsVerifying(false);
          verifiedFromStorageRef.current = true;
          logDebug(
            "Admin status verified from localStorage roles",
            storedUser.roles
          );
        }

        return true;
      }

      return false;
    } catch (err) {
      console.error("Error in quickCheckAdminStatus:", err);
      return false;
    }
  };

  // Check if user is one of the admin test accounts
  const isAdminTestAccount = (email) => {
    return email === "itsus@tatt2away.com" || email === "parker@tatt2away.com";
  };

  // Verify authentication and admin rights
  useEffect(() => {
    // Quick check from localStorage first
    if (quickCheckAdminStatus()) {
      return; // Already verified admin status
    }

    // Use ref to prevent duplicate processing
    if (processRef.current) return;
    processRef.current = true;

    const verifyAdminRights = async () => {
      logDebug("Starting admin rights verification");

      try {
        // First check if currentUser is admin
        if (currentUser) {
          const isCurrentUserAdmin =
            isAdminTestAccount(currentUser.email) ||
            currentUser.roles?.includes("admin") ||
            currentUser.roles?.includes("super_admin") ||
            isAdmin;

          if (isCurrentUserAdmin) {
            logDebug("User has admin privileges in context", {
              email: currentUser.email,
            });
            setIsAuthenticated(true);
            setHasAdminRights(true);
            setIsVerifying(false);
            processRef.current = false;
            return;
          }
        }

        // NEXT PATH: Check localStorage for user data
        const storedUser = localStorage.getItem("currentUser");

        if (storedUser) {
          try {
            const userData = JSON.parse(storedUser);
            logDebug("Found user in localStorage", { email: userData.email });

            // Special case for admin accounts
            if (isAdminTestAccount(userData.email)) {
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
              processRef.current = false;
              return;
            }

            // Not a test admin, but check roles in localStorage
            const hasAdminRole =
              userData.roles?.includes("admin") ||
              userData.roles?.includes("super_admin");

            if (hasAdminRole) {
              logDebug("User has admin role in localStorage");
              setIsAuthenticated(true);
              setHasAdminRights(true);
              setIsVerifying(false);
              processRef.current = false;
              return;
            }
          } catch (e) {
            logDebug("Error parsing stored user:", e.message);
          }
        }

        // Only check Supabase session if we haven't confirmed admin rights yet
        if (!hasAdminRights) {
          logDebug("Checking Supabase session");
          const { data, error } = await supabase.auth.getSession();

          if (error) {
            logDebug("Session verification error:", error.message);
            setIsVerifying(false);
            processRef.current = false;
            return;
          }

          if (data?.session) {
            logDebug("Valid session found for", data.session.user.email);

            // Check if it's an admin account
            if (isAdminTestAccount(data.session.user.email)) {
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
              processRef.current = false;
              return;
            }

            // For regular users, we're at least authenticated
            setIsAuthenticated(true);

            // Use auth context value for admin check (avoid database query)
            setHasAdminRights(isAdmin || false);
          } else {
            logDebug("No valid session found");
          }
        }
      } catch (error) {
        logDebug("Verification error:", error.message);
      } finally {
        // Always complete verification
        setIsVerifying(false);
        processRef.current = false;
      }
    };

    // Start verification
    verifyAdminRights();
  }, [currentUser, isAdmin]); // Only run when these deps change

  // Additional quick check for test admin accounts
  if (currentUser && isAdminTestAccount(currentUser.email)) {
    // Always grant access to test admin accounts
    if (isVerifying) {
      setIsVerifying(false);
      setIsAuthenticated(true);
      setHasAdminRights(true);
    }
    logDebug("Special admin account verified, granting access");
    return <Outlet />;
  }

  // Show loading during initialization
  if (loading || isVerifying) {
    return (
      <div className="auth-loading-container">
        <div className="auth-loading">
          <Loader className="spinner" size={24} />
          <p>Verifying admin access...</p>
        </div>
      </div>
    );
  }

  // Check admin rights
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
