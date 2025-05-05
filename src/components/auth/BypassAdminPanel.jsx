// src/components/admin/BypassAdminPanel.jsx
// This component bypasses the normal route protection for the admin panel

import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Loader } from "lucide-react";
import AdminPanel from "../admin/AdminPanel";
import AuthDiagnostic from "../auth/AuthDiagnostic";

function BypassAdminPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [error, setError] = useState(null);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check if we have a valid session
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (data?.session) {
          console.log(
            "BypassAdmin: Valid session found for",
            data.session.user.email
          );

          // Set auth flags in localStorage
          localStorage.setItem("isAuthenticated", "true");
          localStorage.setItem("mfa_verified", "true");
          sessionStorage.setItem("mfa_verified", "true");
          localStorage.setItem("authStage", "post-mfa");

          // Special case for test admin
          if (data.session.user.email === "itsus@tatt2away.com") {
            console.log("BypassAdmin: Test admin detected");

            // Store user data
            const adminUser = {
              id: data.session.user.id,
              email: data.session.user.email,
              name: "Tatt2Away Admin",
              roles: ["super_admin", "admin", "user"],
              tier: "enterprise",
            };

            localStorage.setItem("currentUser", JSON.stringify(adminUser));
            setUserData(adminUser);
            setIsAuthorized(true);
            setIsLoading(false);
            return;
          }

          // Check user role using safe RPC function
          const { data: profileData, error: profileError } = await supabase
            .rpc("get_user_profile", { user_id: data.session.user.id });

          if (profileError) {
            console.log("BypassAdmin: No profile found, creating one");

            // Create a basic profile if none exists
            const newUser = {
              id: data.session.user.id,
              email: data.session.user.email,
              name:
                data.session.user.user_metadata?.full_name ||
                data.session.user.email,
              roles: ["user"],
              tier: "basic",
            };

            // Try to store the user data
            localStorage.setItem("currentUser", JSON.stringify(newUser));
            setUserData(newUser);

            // For now, allow access (you might want to change this logic)
            setIsAuthorized(true);
          } else {
            console.log("BypassAdmin: Profile found", profileData);

            // Check if user has admin role
            const isAdmin =
              profileData.roles?.includes("admin") ||
              profileData.roles?.includes("super_admin");

            // Store user data
            localStorage.setItem("currentUser", JSON.stringify(profileData));
            setUserData(profileData);

            if (isAdmin) {
              setIsAuthorized(true);
            } else {
              setError("You don't have permission to access the admin panel");
            }
          }
        } else {
          setError("No valid session found. Please log in again.");
        }
      } catch (err) {
        console.error("BypassAdmin: Error", err);
        setError(err.message || "An error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
        }}
      >
        <Loader size={40} className="spinner" />
        <p style={{ marginTop: "20px" }}>Loading admin panel...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          maxWidth: "500px",
          margin: "100px auto",
          padding: "20px",
          textAlign: "center",
          border: "1px solid #e2e8f0",
          borderRadius: "8px",
          backgroundColor: "#fff",
        }}
      >
        <h2 style={{ color: "#e53e3e", marginBottom: "20px" }}>
          Access Denied
        </h2>
        <p>{error}</p>
        <button
          style={{
            marginTop: "20px",
            padding: "8px 16px",
            backgroundColor: "#4f46e5",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
          onClick={() => (window.location.href = "/login")}
        >
          Back to Login
        </button>
      </div>
    );
  }

  if (isAuthorized) {
    return (
      <>
        <AdminPanel />
        {process.env.NODE_ENV !== "production" && <AuthDiagnostic />}
      </>
    );
  }

  return (
    <div
      style={{
        maxWidth: "500px",
        margin: "100px auto",
        padding: "20px",
        textAlign: "center",
        border: "1px solid #e2e8f0",
        borderRadius: "8px",
        backgroundColor: "#fff",
      }}
    >
      <h2 style={{ color: "#e53e3e", marginBottom: "20px" }}>Unauthorized</h2>
      <p>You don't have permission to access the admin panel.</p>
      <button
        style={{
          marginTop: "20px",
          padding: "8px 16px",
          backgroundColor: "#4f46e5",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
        }}
        onClick={() => (window.location.href = "/login")}
      >
        Back to Login
      </button>
    </div>
  );
}

export default BypassAdminPanel;
