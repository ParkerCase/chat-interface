// You can add this component temporarily to help debug authentication issues
import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

function AuthDebugHelper() {
  const [authState, setAuthState] = useState({
    hasSession: false,
    sessionExpires: null,
    user: null,
    storedToken: null,
    storedRefreshToken: null,
    localStorageUser: null,
  });
  const [actionResult, setActionResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      setIsLoading(true);

      // Check current Supabase session
      const { data: sessionData } = await supabase.auth.getSession();

      // Check localStorage
      const storedToken = localStorage.getItem("authToken");
      const storedRefreshToken = localStorage.getItem("refreshToken");
      const storedUserJson = localStorage.getItem("currentUser");

      setAuthState({
        hasSession: !!sessionData?.session,
        sessionExpires: sessionData?.session?.expires_at
          ? new Date(sessionData.session.expires_at * 1000).toLocaleString()
          : null,
        user: sessionData?.session?.user || null,
        storedToken: storedToken ? `${storedToken.slice(0, 10)}...` : null,
        storedRefreshToken: storedRefreshToken
          ? `${storedRefreshToken.slice(0, 10)}...`
          : null,
        localStorageUser: storedUserJson ? JSON.parse(storedUserJson) : null,
      });
    } catch (error) {
      console.error("Error checking auth state:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const testPasswordChange = async () => {
    try {
      setIsLoading(true);
      setActionResult(null);

      // Get values from form
      const currentPassword = document.getElementById("current-password").value;
      const newPassword = document.getElementById("new-password").value;

      if (!currentPassword || !newPassword) {
        setActionResult({
          success: false,
          message: "Both current and new passwords are required",
        });
        return;
      }

      // Try sign in to verify current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: authState.user?.email || authState.localStorageUser?.email,
        password: currentPassword,
      });

      if (signInError) {
        setActionResult({
          success: false,
          message:
            "Current password verification failed: " + signInError.message,
        });
        return;
      }

      // Try update password
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setActionResult({
          success: false,
          message: "Password update failed: " + error.message,
        });
      } else {
        setActionResult({
          success: true,
          message: "Password changed successfully",
          data,
        });

        // Set flags for login flow
        localStorage.setItem("passwordChanged", "true");
        localStorage.setItem("passwordChangedAt", new Date().toISOString());

        // Refresh auth state
        setTimeout(() => checkAuthState(), 1000);
      }
    } catch (error) {
      setActionResult({
        success: false,
        message: "Error: " + error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const forceSignOut = async () => {
    try {
      setIsLoading(true);
      setActionResult(null);

      // Sign out from Supabase (both locally and on other devices)
      await supabase.auth.signOut({ scope: "global" });

      // Clear all auth-related localStorage
      localStorage.removeItem("authToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("currentUser");
      localStorage.removeItem("isAuthenticated");
      localStorage.removeItem("authStage");
      localStorage.removeItem("mfa_verified");

      setActionResult({
        success: true,
        message: "Successfully signed out and cleared all auth data",
      });

      // Refresh state
      setTimeout(() => checkAuthState(), 1000);
    } catch (error) {
      setActionResult({
        success: false,
        message: "Sign out error: " + error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testConnection = async () => {
    try {
      setIsLoading(true);
      setActionResult(null);

      const start = Date.now();

      // Test simple supabase call
      const { data, error } = await supabase
        .from("profiles")
        .select("count")
        .limit(1);

      const elapsed = Date.now() - start;

      if (error) {
        setActionResult({
          success: false,
          message: `Connection failed in ${elapsed}ms: ${error.message}`,
        });
      } else {
        setActionResult({
          success: true,
          message: `Connection successful! Response received in ${elapsed}ms`,
          data,
        });
      }
    } catch (error) {
      setActionResult({
        success: false,
        message: "Connection test error: " + error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: "8px",
        padding: "20px",
        margin: "20px",
        backgroundColor: "#f9f9f9",
      }}
    >
      <h2>Auth Debug Helper</h2>

      <div style={{ marginBottom: "20px" }}>
        <button
          onClick={checkAuthState}
          disabled={isLoading}
          style={{ marginRight: "10px" }}
        >
          Refresh State
        </button>
        <button
          onClick={testConnection}
          disabled={isLoading}
          style={{ marginRight: "10px" }}
        >
          Test Connection
        </button>
        <button
          onClick={forceSignOut}
          disabled={isLoading}
          style={{ backgroundColor: "#ff6b6b" }}
        >
          Force Sign Out
        </button>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <h3>Current Auth State</h3>
        <div
          style={{
            backgroundColor: "#fff",
            padding: "10px",
            borderRadius: "4px",
            border: "1px solid #ddd",
            maxHeight: "300px",
            overflow: "auto",
          }}
        >
          <pre>{JSON.stringify(authState, null, 2)}</pre>
        </div>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <h3>Test Password Change</h3>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            marginBottom: "10px",
          }}
        >
          <input
            id="current-password"
            type="password"
            placeholder="Current Password"
            style={{ padding: "8px" }}
          />
          <input
            id="new-password"
            type="password"
            placeholder="New Password"
            style={{ padding: "8px" }}
          />
          <button
            onClick={testPasswordChange}
            disabled={isLoading}
            style={{ padding: "8px" }}
          >
            Test Password Change
          </button>
        </div>
      </div>

      {actionResult && (
        <div
          style={{
            marginTop: "20px",
            padding: "10px",
            borderRadius: "4px",
            backgroundColor: actionResult.success ? "#d4edda" : "#f8d7da",
            color: actionResult.success ? "#155724" : "#721c24",
          }}
        >
          <h3>{actionResult.success ? "Success" : "Error"}</h3>
          <p>{actionResult.message}</p>
          {actionResult.data && (
            <pre
              style={{
                backgroundColor: "rgba(255,255,255,0.5)",
                padding: "8px",
                borderRadius: "4px",
                maxHeight: "200px",
                overflow: "auto",
              }}
            >
              {JSON.stringify(actionResult.data, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export default AuthDebugHelper;
