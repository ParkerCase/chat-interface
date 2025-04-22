// src/components/AuthDebugger.jsx
import React, { useState, useEffect, useContext } from "react";
import { supabase } from "../lib/supabase";
import { debugAuth } from "../utils/authDebug";
import AuthContext from "../context/AuthContext";

/**
 * Debug component that displays authentication state
 * Only visible in development mode
 */
function AuthDebugger() {
  // Always define hooks at the top level, regardless of whether we'll use them
  const [visible, setVisible] = useState(false);
  const [logs, setLogs] = useState([]);
  const [authState, setAuthState] = useState({});
  const [supabaseSession, setSupabaseSession] = useState(null);
  const [refreshed, setRefreshed] = useState(0);
  const [activeTab, setActiveTab] = useState("state");

  // SAFE: Direct context access with null checking
  const auth = useContext(AuthContext) || {};
  const currentUser = auth.currentUser || null;
  const mfaState = auth.mfaState || { required: false, verified: false };

  // Only show toggle button in development mode or if debug is enabled
  const shouldRender =
    process.env.NODE_ENV === "development" || debugAuth.isEnabled;

  // Load auth state and logs when visible
  useEffect(() => {
    if (!visible || !shouldRender) return;

    const loadDebugInfo = async () => {
      // Get logs from session storage
      const storedLogs = debugAuth.getLogs();
      setLogs(storedLogs);

      // Capture current auth state
      const state = debugAuth.captureAuthState();
      setAuthState(state);

      // Get Supabase session
      try {
        const { data } = await supabase.auth.getSession();
        setSupabaseSession(data.session);
      } catch (e) {
        console.error("Error getting Supabase session:", e);
      }
    };

    loadDebugInfo();
  }, [visible, refreshed, shouldRender]);

  // Return nothing if not in development mode
  if (!shouldRender) {
    return null;
  }

  // Define styles for the debugger
  const styles = {
    toggle: {
      position: "fixed",
      bottom: "10px",
      right: "10px",
      backgroundColor: "#4f46e5",
      color: "white",
      border: "none",
      borderRadius: "4px",
      padding: "5px 10px",
      cursor: "pointer",
      zIndex: 10000,
      fontSize: "12px",
    },
    container: {
      position: "fixed",
      bottom: "50px",
      right: "10px",
      width: "600px",
      maxHeight: "80vh",
      backgroundColor: "#f8fafc",
      border: "1px solid #cbd5e1",
      borderRadius: "8px",
      boxShadow: "0 0 20px rgba(0, 0, 0, 0.1)",
      zIndex: 10000,
      overflow: "hidden",
      display: visible ? "flex" : "none",
      flexDirection: "column",
    },
    header: {
      padding: "10px",
      backgroundColor: "#f1f5f9",
      borderBottom: "1px solid #cbd5e1",
      fontSize: "14px",
      fontWeight: "bold",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
    content: {
      flex: 1,
      overflow: "auto",
      padding: "10px",
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
    infoTable: {
      width: "100%",
      fontSize: "12px",
      borderCollapse: "collapse",
      marginBottom: "10px",
    },
    row: {
      borderBottom: "1px solid #e2e8f0",
    },
    cell: {
      padding: "5px",
      verticalAlign: "top",
    },
    key: {
      fontWeight: "bold",
      color: "#334155",
      width: "120px",
    },
    value: {
      fontFamily: "monospace",
      wordBreak: "break-all",
    },
    logsTable: {
      width: "100%",
      fontSize: "11px",
      borderCollapse: "collapse",
    },
    logRow: {
      borderBottom: "1px solid #e2e8f0",
    },
    logCell: {
      padding: "5px",
      verticalAlign: "top",
    },
    logTime: {
      width: "70px",
      color: "#64748b",
    },
    logComponent: {
      width: "100px",
      fontWeight: "bold",
      color: "#334155",
    },
    logMessage: {
      wordBreak: "break-all",
    },
    tabs: {
      display: "flex",
      borderBottom: "1px solid #cbd5e1",
    },
    tab: {
      padding: "8px 12px",
      cursor: "pointer",
      borderBottom: "2px solid transparent",
      fontSize: "12px",
    },
    activeTab: {
      borderBottomColor: "#4f46e5",
      fontWeight: "bold",
      color: "#4f46e5",
    },
    actions: {
      display: "flex",
      gap: "5px",
    },
    actionButton: {
      padding: "3px 8px",
      fontSize: "11px",
      backgroundColor: "#e2e8f0",
      border: "none",
      borderRadius: "3px",
      cursor: "pointer",
    },
  };

  // Handle clearing logs
  const handleClearLogs = () => {
    debugAuth.clearLogs();
    setLogs([]);
  };

  // Handle refreshing data
  const handleRefresh = () => {
    setRefreshed(Date.now());
  };

  return (
    <>
      <button style={styles.toggle} onClick={() => setVisible(!visible)}>
        {visible ? "Hide Auth Debug" : "Show Auth Debug"}
      </button>

      {visible && (
        <div style={styles.container}>
          <div style={styles.header}>
            <div>Auth Debugger</div>
            <div style={styles.actions}>
              <button style={styles.actionButton} onClick={handleRefresh}>
                Refresh
              </button>
              <button style={styles.actionButton} onClick={handleClearLogs}>
                Clear Logs
              </button>
              <button
                style={styles.actionButton}
                onClick={() => setVisible(false)}
              >
                Close
              </button>
            </div>
          </div>

          <div style={styles.tabs}>
            <div
              style={{
                ...styles.tab,
                ...(activeTab === "state" ? styles.activeTab : {}),
              }}
              onClick={() => setActiveTab("state")}
            >
              Auth State
            </div>
            <div
              style={{
                ...styles.tab,
                ...(activeTab === "storage" ? styles.activeTab : {}),
              }}
              onClick={() => setActiveTab("storage")}
            >
              Storage
            </div>
            <div
              style={{
                ...styles.tab,
                ...(activeTab === "logs" ? styles.activeTab : {}),
              }}
              onClick={() => setActiveTab("logs")}
            >
              Logs ({logs.length})
            </div>
            <div
              style={{
                ...styles.tab,
                ...(activeTab === "supabase" ? styles.activeTab : {}),
              }}
              onClick={() => setActiveTab("supabase")}
            >
              Supabase
            </div>
          </div>

          <div style={styles.content}>
            {activeTab === "state" && (
              <div style={styles.section}>
                <div style={styles.sectionTitle}>Auth Context State</div>
                <table style={styles.infoTable}>
                  <tbody>
                    <tr style={styles.row}>
                      <td style={{ ...styles.cell, ...styles.key }}>User ID</td>
                      <td style={{ ...styles.cell, ...styles.value }}>
                        {currentUser?.id || "Not authenticated"}
                      </td>
                    </tr>
                    <tr style={styles.row}>
                      <td style={{ ...styles.cell, ...styles.key }}>Email</td>
                      <td style={{ ...styles.cell, ...styles.value }}>
                        {currentUser?.email || "-"}
                      </td>
                    </tr>
                    <tr style={styles.row}>
                      <td style={{ ...styles.cell, ...styles.key }}>Name</td>
                      <td style={{ ...styles.cell, ...styles.value }}>
                        {currentUser?.name || "-"}
                      </td>
                    </tr>
                    <tr style={styles.row}>
                      <td style={{ ...styles.cell, ...styles.key }}>Roles</td>
                      <td style={{ ...styles.cell, ...styles.value }}>
                        {currentUser?.roles?.join(", ") || "-"}
                      </td>
                    </tr>
                    <tr style={styles.row}>
                      <td style={{ ...styles.cell, ...styles.key }}>
                        MFA Required
                      </td>
                      <td style={{ ...styles.cell, ...styles.value }}>
                        {mfaState?.required ? "Yes" : "No"}
                      </td>
                    </tr>
                    <tr style={styles.row}>
                      <td style={{ ...styles.cell, ...styles.key }}>
                        MFA Verified
                      </td>
                      <td style={{ ...styles.cell, ...styles.value }}>
                        {mfaState?.verified ? "Yes" : "No"}
                      </td>
                    </tr>
                    <tr style={styles.row}>
                      <td style={{ ...styles.cell, ...styles.key }}>
                        MFA Methods
                      </td>
                      <td style={{ ...styles.cell, ...styles.value }}>
                        {currentUser?.mfaMethods?.length
                          ? currentUser.mfaMethods
                              .map((m) => `${m.type} (${m.id})`)
                              .join(", ")
                          : "None"}
                      </td>
                    </tr>
                    <tr style={styles.row}>
                      <td style={{ ...styles.cell, ...styles.key }}>
                        Current Path
                      </td>
                      <td style={{ ...styles.cell, ...styles.value }}>
                        {window.location.pathname}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "storage" && (
              <div style={styles.section}>
                <div style={styles.sectionTitle}>Local Storage</div>
                <table style={styles.infoTable}>
                  <tbody>
                    {authState?.localStorage &&
                      Object.entries(authState.localStorage).map(
                        ([key, value]) => (
                          <tr key={key} style={styles.row}>
                            <td style={{ ...styles.cell, ...styles.key }}>
                              {key}
                            </td>
                            <td style={{ ...styles.cell, ...styles.value }}>
                              {typeof value === "string"
                                ? value.substring(0, 100)
                                : String(value)}
                              {typeof value === "string" && value?.length > 100
                                ? "..."
                                : ""}
                            </td>
                          </tr>
                        )
                      )}
                  </tbody>
                </table>

                <div style={{ ...styles.sectionTitle, marginTop: "15px" }}>
                  Session Storage
                </div>
                <table style={styles.infoTable}>
                  <tbody>
                    {authState?.sessionStorage &&
                      Object.entries(authState.sessionStorage).map(
                        ([key, value]) => (
                          <tr key={key} style={styles.row}>
                            <td style={{ ...styles.cell, ...styles.key }}>
                              {key}
                            </td>
                            <td style={{ ...styles.cell, ...styles.value }}>
                              {typeof value === "string"
                                ? value.substring(0, 100)
                                : String(value)}
                              {typeof value === "string" && value?.length > 100
                                ? "..."
                                : ""}
                            </td>
                          </tr>
                        )
                      )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "logs" && (
              <div style={styles.section}>
                <div style={styles.sectionTitle}>Auth Debug Logs</div>
                <table style={styles.logsTable}>
                  <tbody>
                    {logs
                      .slice()
                      .reverse()
                      .map((log, index) => (
                        <tr key={index} style={styles.logRow}>
                          <td style={{ ...styles.logCell, ...styles.logTime }}>
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </td>
                          <td
                            style={{
                              ...styles.logCell,
                              ...styles.logComponent,
                            }}
                          >
                            [{log.component}]
                          </td>
                          <td
                            style={{ ...styles.logCell, ...styles.logMessage }}
                          >
                            {log.message}
                            {log.data && (
                              <pre
                                style={{
                                  margin: "3px 0 0 0",
                                  fontSize: "10px",
                                  color: "#64748b",
                                }}
                              >
                                {typeof log.data === "string"
                                  ? log.data.substring(0, 200)
                                  : String(log.data)}
                                {typeof log.data === "string" &&
                                log.data?.length > 200
                                  ? "..."
                                  : ""}
                              </pre>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {logs.length === 0 && (
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#64748b",
                      textAlign: "center",
                      padding: "10px",
                    }}
                  >
                    No logs to display
                  </div>
                )}
              </div>
            )}

            {activeTab === "supabase" && (
              <div style={styles.section}>
                <div style={styles.sectionTitle}>Supabase Session</div>
                {supabaseSession ? (
                  <table style={styles.infoTable}>
                    <tbody>
                      <tr style={styles.row}>
                        <td style={{ ...styles.cell, ...styles.key }}>
                          User ID
                        </td>
                        <td style={{ ...styles.cell, ...styles.value }}>
                          {supabaseSession.user.id}
                        </td>
                      </tr>
                      <tr style={styles.row}>
                        <td style={{ ...styles.cell, ...styles.key }}>Email</td>
                        <td style={{ ...styles.cell, ...styles.value }}>
                          {supabaseSession.user.email}
                        </td>
                      </tr>
                      <tr style={styles.row}>
                        <td style={{ ...styles.cell, ...styles.key }}>
                          Created At
                        </td>
                        <td style={{ ...styles.cell, ...styles.value }}>
                          {new Date(
                            supabaseSession.user.created_at
                          ).toLocaleString()}
                        </td>
                      </tr>
                      <tr style={styles.row}>
                        <td style={{ ...styles.cell, ...styles.key }}>
                          Last Sign In
                        </td>
                        <td style={{ ...styles.cell, ...styles.value }}>
                          {new Date(
                            supabaseSession.user.last_sign_in_at
                          ).toLocaleString()}
                        </td>
                      </tr>
                      <tr style={styles.row}>
                        <td style={{ ...styles.cell, ...styles.key }}>
                          Token Expires
                        </td>
                        <td style={{ ...styles.cell, ...styles.value }}>
                          {new Date(
                            supabaseSession.expires_at * 1000
                          ).toLocaleString()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                ) : (
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#64748b",
                      padding: "10px",
                    }}
                  >
                    No active Supabase session
                  </div>
                )}

                <div style={{ marginTop: "15px" }}>
                  <button
                    style={{ ...styles.actionButton, marginRight: "5px" }}
                    onClick={async () => {
                      const { data } = await supabase.auth.getSession();
                      setSupabaseSession(data.session);
                    }}
                  >
                    Refresh Session
                  </button>

                  <button
                    style={styles.actionButton}
                    onClick={async () => {
                      try {
                        await supabase.auth.signOut();
                        setSupabaseSession(null);
                        handleRefresh();
                        alert("Successfully signed out from Supabase");
                      } catch (e) {
                        alert(`Error signing out: ${e.message}`);
                      }
                    }}
                  >
                    Force Supabase Signout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default AuthDebugger;
