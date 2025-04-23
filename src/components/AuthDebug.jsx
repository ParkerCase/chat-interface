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
    setStatusMessage("Attempting to fix auth issues...");

    try {
      // Check if we have a valid session
      const { data } = await supabase.auth.getSession();

      if (data?.session) {
        // Valid session exists - fix localStorage state
        localStorage.setItem("isAuthenticated", "true");
        localStorage.setItem("authStage", "post-mfa");
        localStorage.setItem("mfa_verified", "true");
        sessionStorage.setItem("mfa_verified", "true");

        // Check if user email matches one of the admins
        const isAdmin =
          data.session.user.email === "itsus@tatt2away.com" ||
          data.session.user.email === "parker@tatt2away.com";

        // Current user checks
        let currentUserJson = localStorage.getItem("currentUser");
        let currentUser = null;

        if (currentUserJson) {
          try {
            currentUser = JSON.parse(currentUserJson);
          } catch (e) {
            currentUser = null;
          }
        }

        // If missing/invalid currentUser, create a new one
        if (!currentUser || !currentUser.email) {
          currentUser = {
            id: data.session.user.id,
            email: data.session.user.email,
            name: data.session.user.email.split("@")[0],
            roles: isAdmin ? ["super_admin", "admin", "user"] : ["user"],
          };
        } else if (
          isAdmin &&
          (!currentUser.roles || !currentUser.roles.includes("super_admin"))
        ) {
          // Ensure admin roles for admin users
          currentUser.roles = ["super_admin", "admin", "user"];
        }

        // Save the fixed user
        localStorage.setItem("currentUser", JSON.stringify(currentUser));

        setStatusMessage("Auth state fixed! Reload the page to apply changes.");
      } else {
        // No valid session - clear invalid auth state
        localStorage.removeItem("isAuthenticated");
        localStorage.removeItem("authToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("mfa_verified");
        sessionStorage.removeItem("mfa_verified");

        setStatusMessage("No valid session found. Auth state cleared.");
      }

      // Reload auth state
      await loadAuthState();
    } catch (error) {
      console.error("Error fixing auth state:", error);
      setStatusMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Force reload the page
  const reloadPage = () => {
    window.location.reload();
  };

  // Completely reset auth state
  const resetAuthState = () => {
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("authToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("mfa_verified");
    localStorage.removeItem("authStage");
    localStorage.removeItem("currentUser");
    sessionStorage.removeItem("mfa_verified");

    setStatusMessage("Auth state completely reset. Reload to apply changes.");
    loadAuthState();
  };

  // Inline styles
  const styles = {
    debugButton: {
      position: "fixed",
      bottom: "10px",
      left: "10px",
      backgroundColor: "#4f46e5",
      color: "white",
      border: "none",
      borderRadius: "4px",
      padding: "5px 10px",
      fontSize: "12px",
      cursor: "pointer",
      zIndex: 9999,
    },
    container: {
      position: "fixed",
      bottom: isVisible ? "50px" : "-100%",
      left: "10px",
      width: "90%",
      maxWidth: "600px",
      height: "500px",
      backgroundColor: "white",
      border: "1px solid #e2e8f0",
      borderRadius: "8px",
      boxShadow: "0 0 20px rgba(0, 0, 0, 0.1)",
      transition: "bottom 0.3s ease-in-out",
      zIndex: 9999,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    },
    header: {
      padding: "10px",
      borderBottom: "1px solid #e2e8f0",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: "#f8fafc",
    },
    title: {
      margin: 0,
      fontSize: "14px",
      fontWeight: "bold",
    },
    closeButton: {
      background: "none",
      border: "none",
      cursor: "pointer",
      color: "#64748b",
      fontSize: "18px",
    },
    content: {
      padding: "10px",
      overflowY: "auto",
      flex: 1,
    },
    section: {
      marginBottom: "15px",
    },
    sectionTitle: {
      fontSize: "14px",
      fontWeight: "bold",
      marginBottom: "5px",
      color: "#334155",
    },
    infoItem: {
      display: "flex",
      fontSize: "12px",
      marginBottom: "3px",
    },
    key: {
      width: "150px",
      fontWeight: "bold",
      color: "#334155",
    },
    value: {
      flex: 1,
      fontFamily: "monospace",
      wordBreak: "break-all",
    },
    actions: {
      display: "flex",
      gap: "5px",
      padding: "10px",
      borderTop: "1px solid #e2e8f0",
      backgroundColor: "#f8fafc",
    },
    button: {
      padding: "5px 10px",
      fontSize: "12px",
      backgroundColor: "#4f46e5",
      color: "white",
      border: "none",
      borderRadius: "4px",
      cursor: "pointer",
    },
    dangerButton: {
      backgroundColor: "#ef4444",
    },
    statusMessage: {
      padding: "5px 10px",
      fontSize: "12px",
      color: "#64748b",
      fontStyle: "italic",
      flex: 1,
      textAlign: "right",
    },
  };

  return (
    <>
      <button
        style={styles.debugButton}
        onClick={() => setIsVisible(!isVisible)}
      >
        {isVisible ? "Hide Auth Debug" : "Show Auth Debug"}
      </button>

      <div style={styles.container}>
        <div style={styles.header}>
          <h3 style={styles.title}>Auth Debug</h3>
          <button
            style={styles.closeButton}
            onClick={() => setIsVisible(false)}
          >
            &times;
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

          {/* LocalStorage */}
          <div style={styles.section}>
            <h4 style={styles.sectionTitle}>LocalStorage</h4>
            <div style={styles.infoItem}>
              <span style={styles.key}>isAuthenticated</span>
              <span style={styles.value}>
                {storageState.localStorage?.isAuthenticated ? "true" : "false"}
              </span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.key}>mfa_verified</span>
              <span style={styles.value}>
                {storageState.localStorage?.mfa_verified ? "true" : "false"}
              </span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.key}>authStage</span>
              <span style={styles.value}>
                {storageState.localStorage?.authStage || "Not set"}
              </span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.key}>Has Auth Token</span>
              <span style={styles.value}>
                {storageState.localStorage?.authToken ? "Yes" : "No"}
              </span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.key}>Has Refresh Token</span>
              <span style={styles.value}>
                {storageState.localStorage?.refreshToken ? "Yes" : "No"}
              </span>
            </div>
            {storageState.localStorage?.parsedUser && (
              <>
                <div style={styles.infoItem}>
                  <span style={styles.key}>User Email</span>
                  <span style={styles.value}>
                    {storageState.localStorage.parsedUser.email}
                  </span>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.key}>User Roles</span>
                  <span style={styles.value}>
                    {storageState.localStorage.parsedUser.roles?.join(", ") ||
                      "None"}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Session Storage */}
          <div style={styles.section}>
            <h4 style={styles.sectionTitle}>SessionStorage</h4>
            <div style={styles.infoItem}>
              <span style={styles.key}>mfa_verified</span>
              <span style={styles.value}>
                {storageState.sessionStorage?.mfa_verified ? "true" : "false"}
              </span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.key}>Has lastMfaCodeSent</span>
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
