// src/components/AuthDebug.jsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

/**
 * Debug component that shows auth state and provides repair functions
 * You can add this anywhere in your app for debugging
 */
function AuthDebug({ showByDefault = false }) {
  const [isVisible, setIsVisible] = useState(showByDefault);
  const [authState, setAuthState] = useState({});
  const [supabaseState, setSupabaseState] = useState({});
  const [storageState, setStorageState] = useState({});
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const auth = useAuth();

  // Load auth state when visible
  useEffect(() => {
    if (isVisible) {
      loadAuthState();
    }
  }, [isVisible]);

  // Load all auth state
  const loadAuthState = async () => {
    setLoading(true);
    setStatusMessage("Loading auth state...");

    try {
      // Get auth context state
      setAuthState({
        currentUser: auth.currentUser,
        isAdmin: auth.isAdmin,
        isSuperAdmin: auth.isSuperAdmin,
        loading: auth.loading,
        mfaState: auth.mfaState,
        initialized: auth.isInitialized,
      });

      // Get supabase session
      const { data, error } = await supabase.auth.getSession();
      setSupabaseState({
        hasSession: !!data?.session,
        sessionUser: data?.session?.user?.email,
        sessionError: error?.message,
      });

      // Get storage state
      const storage = {
        localStorage: {
          currentUser: localStorage.getItem("currentUser"),
          isAuthenticated: localStorage.getItem("isAuthenticated") === "true",
          mfa_verified: localStorage.getItem("mfa_verified") === "true",
          authStage: localStorage.getItem("authStage"),
          refreshToken: !!localStorage.getItem("refreshToken"),
          authToken: !!localStorage.getItem("authToken"),
        },
        sessionStorage: {
          mfa_verified: sessionStorage.getItem("mfa_verified") === "true",
          lastMfaCodeSent: !!sessionStorage.getItem("lastMfaCodeSent"),
        },
      };

      // Parse currentUser if available
      if (storage.localStorage.currentUser) {
        try {
          const user = JSON.parse(storage.localStorage.currentUser);
          storage.localStorage.parsedUser = {
            email: user.email,
            roles: user.roles,
          };
        } catch (e) {
          storage.localStorage.parsedUserError = e.message;
        }
      }

      setStorageState(storage);
      setStatusMessage("");
    } catch (error) {
      console.error("Error loading auth state:", error);
      setStatusMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Fix common auth issues
  const fixAuthIssues = async () => {
    setLoading(true);
    setStatusMessage("Fixing auth issues...");

    try {
      // Clear any corrupted data
      if (storageState.localStorage?.parsedUserError) {
        localStorage.removeItem("currentUser");
        setStatusMessage("Cleared corrupted user data");
      }

      // Ensure admin accounts have proper roles
      if (
        auth.currentUser?.email === "itsus@tatt2away.com" ||
        auth.currentUser?.email === "parker@tatt2away.com"
      ) {
        const adminUser = {
          ...auth.currentUser,
          roles: ["super_admin", "admin", "user"],
        };
        localStorage.setItem("currentUser", JSON.stringify(adminUser));
        setStatusMessage("Fixed admin roles");
      }

      // Ensure auth flags are set
      if (auth.currentUser) {
        localStorage.setItem("isAuthenticated", "true");
        localStorage.setItem("mfa_verified", "true");
        sessionStorage.setItem("mfa_verified", "true");
        localStorage.setItem("authStage", "post-mfa");
        setStatusMessage("Fixed auth flags");
      }

      // Reload auth state
      await loadAuthState();
      setStatusMessage("Auth issues fixed successfully");
    } catch (error) {
      setStatusMessage(`Error fixing auth: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Reset auth state completely
  const resetAuthState = async () => {
    if (
      !window.confirm(
        "This will log you out and clear all auth data. Continue?"
      )
    ) {
      return;
    }

    setLoading(true);
    setStatusMessage("Resetting auth state...");

    try {
      await auth.logout();
      setStatusMessage("Auth state reset successfully");
      await loadAuthState();
    } catch (error) {
      setStatusMessage(`Error resetting auth: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Reload page
  const reloadPage = () => {
    window.location.reload();
  };

  // Force init completion
  const forceInit = () => {
    if (auth.forceInitComplete) {
      auth.forceInitComplete();
      setStatusMessage("Forced initialization completion");
    } else {
      setStatusMessage("Force init function not available");
    }
  };

  const styles = {
    container: {
      position: "fixed",
      top: "20px",
      right: "20px",
      width: "400px",
      maxHeight: "80vh",
      backgroundColor: "#fff",
      border: "1px solid #e2e8f0",
      borderRadius: "8px",
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
      zIndex: 1000,
      overflow: "hidden",
    },
    header: {
      backgroundColor: "#f8fafc",
      padding: "12px 16px",
      borderBottom: "1px solid #e2e8f0",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
    title: {
      margin: 0,
      fontSize: "14px",
      fontWeight: "600",
      color: "#374151",
    },
    toggleButton: {
      background: "none",
      border: "none",
      fontSize: "20px",
      cursor: "pointer",
      color: "#6b7280",
    },
    content: {
      padding: "16px",
      maxHeight: "60vh",
      overflowY: "auto",
    },
    section: {
      marginBottom: "20px",
    },
    sectionTitle: {
      fontSize: "12px",
      fontWeight: "600",
      color: "#374151",
      marginBottom: "8px",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
    },
    infoItem: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "4px 0",
      fontSize: "12px",
      borderBottom: "1px solid #f3f4f6",
    },
    key: {
      color: "#6b7280",
      fontWeight: "500",
    },
    value: {
      color: "#111827",
      fontWeight: "400",
      maxWidth: "200px",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    actions: {
      padding: "16px",
      borderTop: "1px solid #e2e8f0",
      backgroundColor: "#f8fafc",
    },
    button: {
      backgroundColor: "#3b82f6",
      color: "white",
      border: "none",
      padding: "6px 12px",
      borderRadius: "4px",
      fontSize: "12px",
      cursor: "pointer",
      marginRight: "8px",
      marginBottom: "8px",
    },
    dangerButton: {
      backgroundColor: "#ef4444",
    },
    statusMessage: {
      fontSize: "12px",
      color: "#6b7280",
      marginTop: "8px",
      fontStyle: "italic",
    },
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        style={{
          position: "fixed",
          top: "20px",
          right: "20px",
          backgroundColor: "#3b82f6",
          color: "white",
          border: "none",
          padding: "8px 12px",
          borderRadius: "4px",
          fontSize: "12px",
          cursor: "pointer",
          zIndex: 999,
        }}
      >
        Debug Auth
      </button>
    );
  }

  return (
    <>
      <div style={styles.container}>
        <div style={styles.header}>
          <h3 style={styles.title}>Auth Debug Panel</h3>
          <button
            onClick={() => setIsVisible(false)}
            style={styles.toggleButton}
          >
            ×
          </button>
        </div>

        <div style={styles.content}>
          {/* AuthContext State */}
          <div style={styles.section}>
            <h4 style={styles.sectionTitle}>Auth Context</h4>
            <div style={styles.infoItem}>
              <span style={styles.key}>Current User</span>
              <span style={styles.value}>
                {auth.currentUser?.email || "Not logged in"}
              </span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.key}>Is Admin</span>
              <span style={styles.value}>{auth.isAdmin ? "Yes" : "No"}</span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.key}>Is Super Admin</span>
              <span style={styles.value}>
                {auth.isSuperAdmin ? "Yes" : "No"}
              </span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.key}>Roles</span>
              <span style={styles.value}>
                {auth.currentUser?.roles?.join(", ") || "None"}
              </span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.key}>MFA Required</span>
              <span style={styles.value}>
                {auth.mfaState?.required ? "Yes" : "No"}
              </span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.key}>MFA Verified</span>
              <span style={styles.value}>
                {auth.mfaState?.verified ? "Yes" : "No"}
              </span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.key}>Loading</span>
              <span style={styles.value}>{auth.loading ? "Yes" : "No"}</span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.key}>Initialized</span>
              <span style={styles.value}>
                {auth.isInitialized ? "Yes" : "No"}
              </span>
            </div>
          </div>

          {/* Supabase Session */}
          <div style={styles.section}>
            <h4 style={styles.sectionTitle}>Supabase Session</h4>
            <div style={styles.infoItem}>
              <span style={styles.key}>Has Session</span>
              <span style={styles.value}>
                {supabaseState.hasSession ? "Yes" : "No"}
              </span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.key}>Session User</span>
              <span style={styles.value}>
                {supabaseState.sessionUser || "None"}
              </span>
            </div>
            {supabaseState.sessionError && (
              <div style={styles.infoItem}>
                <span style={styles.key}>Session Error</span>
                <span style={styles.value}>{supabaseState.sessionError}</span>
              </div>
            )}
          </div>

          {/* Local Storage */}
          <div style={styles.section}>
            <h4 style={styles.sectionTitle}>Local Storage</h4>
            <div style={styles.infoItem}>
              <span style={styles.key}>Is Authenticated</span>
              <span style={styles.value}>
                {storageState.localStorage?.isAuthenticated ? "Yes" : "No"}
              </span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.key}>MFA Verified</span>
              <span style={styles.value}>
                {storageState.localStorage?.mfa_verified ? "Yes" : "No"}
              </span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.key}>Auth Stage</span>
              <span style={styles.value}>
                {storageState.localStorage?.authStage || "None"}
              </span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.key}>User Email</span>
              <span style={styles.value}>
                {storageState.localStorage?.parsedUser?.email || "None"}
              </span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.key}>User Roles</span>
              <span style={styles.value}>
                {storageState.localStorage?.parsedUser?.roles?.join(", ") ||
                  "None"}
              </span>
            </div>
            {storageState.localStorage?.parsedUserError && (
              <div style={styles.infoItem}>
                <span style={styles.key}>Parse Error</span>
                <span style={styles.value}>
                  {storageState.localStorage.parsedUserError}
                </span>
              </div>
            )}
          </div>

          {/* Session Storage */}
          <div style={styles.section}>
            <h4 style={styles.sectionTitle}>Session Storage</h4>
            <div style={styles.infoItem}>
              <span style={styles.key}>MFA Verified</span>
              <span style={styles.value}>
                {storageState.sessionStorage?.mfa_verified ? "Yes" : "No"}
              </span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.key}>MFA Code Sent</span>
              <span style={styles.value}>
                {storageState.sessionStorage?.lastMfaCodeSent ? "Yes" : "No"}
              </span>
            </div>
          </div>
        </div>

        <div style={styles.actions}>
          <button
            style={styles.button}
            onClick={loadAuthState}
            disabled={loading}
          >
            Refresh
          </button>
          <button
            style={styles.button}
            onClick={fixAuthIssues}
            disabled={loading}
          >
            Fix Auth Issues
          </button>
          <button style={styles.button} onClick={forceInit} disabled={loading}>
            Force Init
          </button>
          <button style={styles.button} onClick={reloadPage} disabled={loading}>
            Reload Page
          </button>
          <button
            style={{ ...styles.button, ...styles.dangerButton }}
            onClick={resetAuthState}
            disabled={loading}
          >
            Reset Auth
          </button>
          <div style={styles.statusMessage}>{statusMessage}</div>
        </div>
      </div>
    </>
  );
}

export default AuthDebug;
