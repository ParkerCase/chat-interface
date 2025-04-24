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
  // 1. Add this function to your AdminRoute component, near the top:
  const checkRedirectLoop = () => {
    try {
      const redirectCount = parseInt(
        sessionStorage.getItem("adminRedirectCount") || "0"
      );
      const now = Date.now();
      const lastRedirect = sessionStorage.getItem("lastAdminRedirectTime");

      // If multiple redirects happened in a short time frame
      if (
        lastRedirect &&
        now - parseInt(lastRedirect) < 3000 &&
        redirectCount > 1
      ) {
        logDebug("Redirect loop detected in AdminRoute - breaking cycle");
        return true;
      }

      // Update redirect tracking
      sessionStorage.setItem(
        "adminRedirectCount",
        (redirectCount + 1).toString()
      );
      sessionStorage.setItem("lastAdminRedirectTime", now.toString());

      // Safety valve - too many redirects
      if (redirectCount > 5) {
        logDebug("Too many admin redirects - breaking cycle");
        return true;
      }

      return false;
    } catch (e) {
      console.error("Error in redirect loop check:", e);
      return false;
    }
  };
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

  // 2. REPLACE THE NAVIGATION SECTION in the same component:

  // Show loading during initialization
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
    // Reset redirect counter on successful access
    sessionStorage.removeItem("adminRedirectCount");
    return <Outlet />;
  }

  // Check for redirect loops before proceeding
  const inRedirectLoop = checkRedirectLoop();

  // Not authenticated at all
  if (!isAuthenticated) {
    // If in a redirect loop, show message instead of redirecting again
    if (inRedirectLoop) {
      logDebug("Breaking redirect loop - showing message instead");
      return (
        <div className="auth-error-container">
          <div className="auth-error">
            <h3>Authentication Issue</h3>
            <p>There seems to be an issue with your authentication.</p>
            <p>
              <a
                href="/login"
                onClick={() => {
                  // Clear loop detection on manual navigation
                  sessionStorage.removeItem("adminRedirectCount");
                  sessionStorage.removeItem("lastAdminRedirectTime");
                }}
              >
                Click here to log in again
              </a>
            </p>
          </div>
        </div>
      );
    }

    // Normal redirect to login
    logDebug("Not authenticated, redirecting to login");
    return (
      <Navigate
        to={`/login?returnUrl=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }

  // User is authenticated but not admin, redirect to unauthorized
  // But check for loops first
  if (inRedirectLoop) {
    logDebug("Breaking unauthorized redirect loop");
    return (
      <div className="auth-error-container">
        <div className="auth-error">
          <h3>Access Denied</h3>
          <p>You don't have permission to access the admin area.</p>
          <p>
            <a
              href="/"
              onClick={() => {
                // Clear loop detection on manual navigation
                sessionStorage.removeItem("adminRedirectCount");
                sessionStorage.removeItem("lastAdminRedirectTime");
              }}
            >
              Return to home page
            </a>
          </p>
        </div>
      </div>
    );
  }

  logDebug("User lacks admin rights, redirecting to unauthorized");
  return <Navigate to="/unauthorized" replace />;
}

export default AdminRoute;
