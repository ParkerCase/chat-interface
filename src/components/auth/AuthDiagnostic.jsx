// src/components/auth/AuthDiagnostic.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

/**
 * Helper component to diagnose auth issues
 * Add this to your admin panel page to see what's happening
 */
function AuthDiagnostic() {
  const [diagnosticData, setDiagnosticData] = useState({
    localStorage: {},
    sessionStorage: {},
    supabaseSession: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    const runDiagnostic = async () => {
      try {
        // Get localStorage data
        const localStorageData = {};
        const relevantKeys = [
          "isAuthenticated",
          "authStage",
          "mfa_verified",
          "currentUser",
          "pendingVerificationEmail",
        ];

        relevantKeys.forEach((key) => {
          localStorageData[key] = localStorage.getItem(key);
          if (key === "currentUser" && localStorageData[key]) {
            try {
              localStorageData[key] = JSON.parse(localStorageData[key]);
            } catch (e) {
              localStorageData[key] = `ERROR PARSING: ${localStorageData[
                key
              ].substring(0, 30)}...`;
            }
          }
        });

        // Get sessionStorage data
        const sessionStorageData = {};
        const sessionKeys = ["mfa_verified", "lastMfaCodeSent", "mfaSuccess"];

        sessionKeys.forEach((key) => {
          sessionStorageData[key] = sessionStorage.getItem(key);
        });

        // Get Supabase session
        const { data, error } = await supabase.auth.getSession();

        // Update state with all diagnostic info
        setDiagnosticData({
          localStorage: localStorageData,
          sessionStorage: sessionStorageData,
          supabaseSession: data?.session,
          error: error,
          loading: false,
        });

        // Log to console too
        console.log("Auth Diagnostic:", {
          localStorage: localStorageData,
          sessionStorage: sessionStorageData,
          supabaseSession: data?.session,
          error: error,
        });

        // If we detect issues, try to fix them
        if (data?.session && !localStorageData.isAuthenticated) {
          console.log(
            "Detected session but missing isAuthenticated flag, fixing..."
          );
          localStorage.setItem("isAuthenticated", "true");
          localStorage.setItem("mfa_verified", "true");
          sessionStorage.setItem("mfa_verified", "true");
          localStorage.setItem("authStage", "post-mfa");

          // Force reload after 1 second to apply fixes
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      } catch (err) {
        setDiagnosticData((prev) => ({
          ...prev,
          error: err.message,
          loading: false,
        }));
      }
    };

    runDiagnostic();
  }, []);

  // Simple styling
  const styles = {
    container: {
      position: "fixed",
      top: "10px",
      right: "10px",
      width: "400px",
      maxHeight: "80vh",
      overflowY: "auto",
      backgroundColor: "#fff",
      border: "1px solid #ddd",
      borderRadius: "4px",
      padding: "10px",
      zIndex: 9999,
      fontSize: "12px",
      boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
    },
    section: {
      marginBottom: "15px",
    },
    title: {
      fontWeight: "bold",
      marginBottom: "5px",
      borderBottom: "1px solid #eee",
      paddingBottom: "5px",
    },
    item: {
      margin: "5px 0",
      display: "flex",
    },
    key: {
      fontWeight: "bold",
      marginRight: "5px",
      width: "120px",
    },
    value: {
      wordBreak: "break-all",
      fontFamily: "monospace",
    },
    fix: {
      padding: "8px 12px",
      backgroundColor: "#4f46e5",
      color: "white",
      border: "none",
      borderRadius: "4px",
      cursor: "pointer",
      marginTop: "10px",
    },
  };

  const fixAuthState = () => {
    // Get current session
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) {
        // Set all needed auth flags
        localStorage.setItem("isAuthenticated", "true");
        localStorage.setItem("mfa_verified", "true");
        sessionStorage.setItem("mfa_verified", "true");
        localStorage.setItem("authStage", "post-mfa");

        // If no currentUser, try to create one
        if (!localStorage.getItem("currentUser")) {
          const userObj = {
            id: data.session.user.id,
            email: data.session.user.email,
            name:
              data.session.user.user_metadata?.full_name ||
              data.session.user.email,
            roles: ["user"],
          };

          // Special case for admin
          if (data.session.user.email === "itsus@tatt2away.com") {
            userObj.roles = ["super_admin", "admin", "user"];
          }

          localStorage.setItem("currentUser", JSON.stringify(userObj));
        }

        alert("Auth state has been fixed. Reloading page...");
        window.location.reload();
      } else {
        alert("No active session found. Cannot fix auth state.");
      }
    });
  };

  return (
    <div style={styles.container}>
      <h3>Auth Diagnostic</h3>

      {diagnosticData.loading ? (
        <p>Loading diagnostic data...</p>
      ) : (
        <>
          <div style={styles.section}>
            <div style={styles.title}>Local Storage</div>
            {Object.entries(diagnosticData.localStorage).map(([key, value]) => (
              <div key={key} style={styles.item}>
                <div style={styles.key}>{key}:</div>
                <div style={styles.value}>
                  {typeof value === "object"
                    ? JSON.stringify(value)
                    : value || "(empty)"}
                </div>
              </div>
            ))}
          </div>

          <div style={styles.section}>
            <div style={styles.title}>Session Storage</div>
            {Object.entries(diagnosticData.sessionStorage).map(
              ([key, value]) => (
                <div key={key} style={styles.item}>
                  <div style={styles.key}>{key}:</div>
                  <div style={styles.value}>{value || "(empty)"}</div>
                </div>
              )
            )}
          </div>

          <div style={styles.section}>
            <div style={styles.title}>Supabase Session</div>
            {diagnosticData.supabaseSession ? (
              <>
                <div style={styles.item}>
                  <div style={styles.key}>User ID:</div>
                  <div style={styles.value}>
                    {diagnosticData.supabaseSession.user.id}
                  </div>
                </div>
                <div style={styles.item}>
                  <div style={styles.key}>Email:</div>
                  <div style={styles.value}>
                    {diagnosticData.supabaseSession.user.email}
                  </div>
                </div>
                <div style={styles.item}>
                  <div style={styles.key}>Provider:</div>
                  <div style={styles.value}>
                    {diagnosticData.supabaseSession.user.app_metadata
                      ?.provider || "email"}
                  </div>
                </div>
                <div style={styles.item}>
                  <div style={styles.key}>Expires:</div>
                  <div style={styles.value}>
                    {new Date(
                      diagnosticData.supabaseSession.expires_at * 1000
                    ).toLocaleString()}
                  </div>
                </div>
              </>
            ) : (
              <div>No active Supabase session found</div>
            )}
          </div>

          <button style={styles.fix} onClick={fixAuthState}>
            Fix Authentication State
          </button>
        </>
      )}
    </div>
  );
}

export default AuthDiagnostic;
