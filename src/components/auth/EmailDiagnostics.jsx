// src/components/auth/EmailDiagnostics.jsx
import React, { useState } from "react";
import { supabase } from "../../lib/supabase";

function EmailDiagnostics() {
  const [email, setEmail] = useState("");
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [projectSettings, setProjectSettings] = useState(null);

  const addLog = (message, type = "info") => {
    setLogs((prev) => [
      ...prev,
      { message, type, timestamp: new Date().toISOString() },
    ]);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const testEmailDelivery = async () => {
    if (!email) {
      addLog("Please enter an email address", "error");
      return;
    }

    setLoading(true);
    addLog(`Starting email diagnostic for ${email}...`);

    try {
      // Step 1: Check if we have a valid session
      addLog("Checking Supabase session...");
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        addLog(`Session error: ${sessionError.message}`, "error");
      } else if (sessionData?.session) {
        addLog("Active session found", "success");
      } else {
        addLog(
          "No active session found, but that's OK for password reset",
          "warning"
        );
      }

      // Step 2: Try to send the reset email
      addLog("Attempting to send password reset email...");

      const startTime = Date.now();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/reset-password`,
          // Add debugging info to the request
          options: {
            data: {
              origin: window.location.origin,
              timestamp: new Date().toISOString(),
              diagnostic: true,
            },
          },
        }
      );
      const responseTime = Date.now() - startTime;

      addLog(`API response time: ${responseTime}ms`);

      if (resetError) {
        addLog(`Password reset error: ${resetError.message}`, "error");
        addLog(`Error details: ${JSON.stringify(resetError)}`, "error");

        // Additional diagnostics for specific errors
        if (resetError.message?.includes("rate limit")) {
          addLog(
            "Rate limiting detected. Supabase limits password resets to prevent abuse.",
            "warning"
          );
          addLog("Wait a few minutes before trying again.", "warning");
        } else if (resetError.message?.includes("Invalid login credentials")) {
          addLog("Email address may not exist in the system", "warning");
        } else if (responseTime < 500) {
          addLog(
            "Response was unusually fast, which may indicate the request didn't reach the email service",
            "warning"
          );
        }
      } else {
        addLog("Password reset request was successful", "success");
        addLog(
          "Note: This only means the request was accepted, not necessarily that the email was delivered",
          "info"
        );
      }

      // Step 3: Provide guidance
      addLog("------- NEXT STEPS -------");
      addLog("1. Check your email inbox AND spam/junk folder");
      addLog("2. Verify Supabase project has email delivery configured");
      addLog("3. Check project URL and redirects in Supabase auth settings");
      addLog(`Current origin: ${window.location.origin}`);

      // Try to query project settings if possible
      try {
        // This might not work if not admin, but we'll try
        const { data: projectData, error: projectError } = await supabase.rpc(
          "get_project_settings"
        );

        if (!projectError && projectData) {
          setProjectSettings(projectData);
          addLog("Retrieved project settings", "success");
        }
      } catch (error) {
        addLog(
          "Could not retrieve project settings (normal if not admin)",
          "info"
        );
      }
    } catch (error) {
      addLog(`Unexpected error: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
      <h2>Email Delivery Diagnostics</h2>

      <div style={{ marginBottom: "20px" }}>
        <p>
          This tool helps diagnose issues with password reset emails in your
          Supabase project.
        </p>
      </div>

      <div style={{ marginBottom: "20px", display: "flex", gap: "10px" }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter email address"
          style={{
            flex: "1",
            padding: "10px",
            borderRadius: "4px",
            border: "1px solid #ccc",
          }}
        />
        <button
          onClick={testEmailDelivery}
          disabled={loading}
          style={{
            padding: "10px 20px",
            backgroundColor: "#4f46e5",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Testing..." : "Test Email Delivery"}
        </button>
        <button
          onClick={clearLogs}
          style={{
            padding: "10px 15px",
            backgroundColor: "#6b7280",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Clear Logs
        </button>
      </div>

      <div
        style={{
          backgroundColor: "#f9fafb",
          border: "1px solid #e5e7eb",
          borderRadius: "4px",
          padding: "15px",
          maxHeight: "400px",
          overflowY: "auto",
          fontFamily: "monospace",
          fontSize: "14px",
        }}
      >
        {logs.length === 0 ? (
          <p style={{ color: "#6b7280", fontStyle: "italic" }}>
            Logs will appear here...
          </p>
        ) : (
          logs.map((log, index) => (
            <div
              key={index}
              style={{
                marginBottom: "8px",
                color:
                  log.type === "error"
                    ? "#ef4444"
                    : log.type === "success"
                    ? "#10b981"
                    : log.type === "warning"
                    ? "#f59e0b"
                    : "#374151",
              }}
            >
              <span style={{ opacity: 0.7 }}>
                {new Date(log.timestamp).toLocaleTimeString()}{" "}
              </span>
              {log.message}
            </div>
          ))
        )}
      </div>

      {projectSettings && (
        <div
          style={{
            marginTop: "20px",
            backgroundColor: "#ecfdf5",
            border: "1px solid #d1fae5",
            borderRadius: "4px",
            padding: "15px",
          }}
        >
          <h3>Project Settings</h3>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: "12px" }}>
            {JSON.stringify(projectSettings, null, 2)}
          </pre>
        </div>
      )}

      <div
        style={{
          marginTop: "20px",
          padding: "15px",
          backgroundColor: "#fffbeb",
          borderRadius: "4px",
          border: "1px solid #fbbf24",
        }}
      >
        <h3 style={{ margin: "0 0 10px 0" }}>Troubleshooting Guide</h3>
        <ul style={{ paddingLeft: "20px", margin: 0 }}>
          <li style={{ marginBottom: "8px" }}>
            <strong>Check Supabase Project Settings:</strong> Make sure email
            provider is configured in your Supabase dashboard.
          </li>
          <li style={{ marginBottom: "8px" }}>
            <strong>Verify Site URL:</strong> Ensure authorized redirect URLs
            include <code>{window.location.origin}</code> in Supabase Auth
            settings.
          </li>
          <li style={{ marginBottom: "8px" }}>
            <strong>Check Spam Folders:</strong> Password reset emails often get
            caught in spam filters.
          </li>
          <li style={{ marginBottom: "8px" }}>
            <strong>Rate Limiting:</strong> Supabase limits the number of emails
            sent to prevent abuse. Wait before retrying.
          </li>
          <li style={{ marginBottom: "8px" }}>
            <strong>Try Direct API Test:</strong> Use Supabase API docs to test
            email delivery directly from their console.
          </li>
          <li>
            <strong>Email Template:</strong> Check that your password reset
            email template is set up correctly in Supabase Authentication
            settings.
          </li>
        </ul>
      </div>
    </div>
  );
}

export default EmailDiagnostics;
