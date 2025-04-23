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
    // Modify the AdminRoute.jsx component
    // Add these debug logs to the verifyAdminRights function

    // This is inside the useEffect in AdminRoute.jsx:
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
            console.log("AdminRoute: Parsed user data from localStorage", {
              email: userData.email,
              roles: userData.roles,
            });

            // Add parker@tatt2away.com as a special test admin as well
            isTestAdmin =
              userData.email === "itsus@tatt2away.com" ||
              userData.email === "parker@tatt2away.com";

            if (isTestAdmin) {
              console.log("AdminRoute: Special admin account detected");
              setIsAuthenticated(true);
              setHasAdminRights(true);
              setIsVerifying(false);

              // Ensure admin rights are properly set in localStorage
              if (!userData.roles || !userData.roles.includes("admin")) {
                console.log(
                  "AdminRoute: Fixing admin roles for special admin account"
                );
                userData.roles = ["super_admin", "admin", "user"];
                localStorage.setItem("currentUser", JSON.stringify(userData));
              }

              // Ensure MFA is verified for admin
              if (!mfaVerified) {
                console.log("AdminRoute: Setting MFA verification for admin");
                localStorage.setItem("mfa_verified", "true");
                sessionStorage.setItem("mfa_verified", "true");
                localStorage.setItem("authStage", "post-mfa");
              }

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
              } else {
                console.log(
                  "AdminRoute: User doesn't have admin role",
                  userData.roles
                );
              }
            }
          } catch (e) {
            console.warn("Error parsing stored user:", e);
          }
        }

        // Double-check session with Supabase
        console.log("AdminRoute: Checking Supabase session");
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("AdminRoute: Session verification error:", error);
          setIsAuthenticated(false);
          setHasAdminRights(false);
          setIsVerifying(false);
          return;
        }

        if (data?.session) {
          console.log(
            "AdminRoute: Valid session found for",
            data.session.user.email
          );

          // Check if it's the test admin account
          if (
            data.session.user.email === "itsus@tatt2away.com" ||
            data.session.user.email === "parker@tatt2away.com"
          ) {
            console.log("AdminRoute: Test admin account detected");

            // Set all required flags
            localStorage.setItem("isAuthenticated", "true");
            localStorage.setItem("mfa_verified", "true");
            sessionStorage.setItem("mfa_verified", "true");
            localStorage.setItem("authStage", "post-mfa");

            // Save admin user info to localStorage if missing
            if (!storedUser) {
              const adminUser = {
                id: data.session.user.id,
                email: data.session.user.email,
                name:
                  data.session.user.email === "itsus@tatt2away.com"
                    ? "Tatt2Away Admin"
                    : "Parker Admin",
                roles: ["super_admin", "admin", "user"],
                tier: "enterprise",
              };
              localStorage.setItem("currentUser", JSON.stringify(adminUser));
              console.log("AdminRoute: Saved admin user to localStorage");
            }

            setIsAuthenticated(true);
            setHasAdminRights(true);
            setIsVerifying(false);
            return;
          }

          // For other users, check their roles from profiles table
          try {
            console.log("AdminRoute: Checking user role in profiles table");
            const { data: profileData, error: profileError } = await supabase
              .from("profiles")
              .select("roles")
              .eq("id", data.session.user.id)
              .single();

            if (
              profileError &&
              !profileError.message.includes("no rows found")
            ) {
              console.error(
                "AdminRoute: Error fetching profile:",
                profileError
              );
            }

            const hasAdminRole =
              profileData?.roles?.includes("admin") ||
              profileData?.roles?.includes("super_admin");

            console.log(
              "AdminRoute: User roles from database:",
              profileData?.roles
            );
            console.log("AdminRoute: Has admin rights:", hasAdminRole);

            // Update localStorage with correct roles
            if (storedUser && profileData?.roles) {
              try {
                const userData = JSON.parse(storedUser);
                if (
                  JSON.stringify(userData.roles) !==
                  JSON.stringify(profileData.roles)
                ) {
                  console.log("AdminRoute: Updating roles in localStorage");
                  userData.roles = profileData.roles;
                  localStorage.setItem("currentUser", JSON.stringify(userData));
                }
              } catch (e) {
                console.warn("Error updating user roles:", e);
              }
            }

            setIsAuthenticated(true);
            setHasAdminRights(hasAdminRole);
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
  if (loading || isVerifying || (!currentUser && !isAuthenticated)) {
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
