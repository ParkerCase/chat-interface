// src/components/auth/SSOCallback.jsx
import React, { useEffect, useState, useRef } from "react";
import { Loader, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "../../lib/supabase";
import "../auth.css";
import { useNavigate } from "react-router-dom";

/**
 * Enhanced callback handler for Supabase auth
 * Handles code exchange and ensures proper state setting
 */
function SSOCallback() {
  const [status, setStatus] = useState("processing");
  const [error, setError] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [redirectTarget, setRedirectTarget] = useState("/admin");
  const [debugInfo, setDebugInfo] = useState("");
  const navigate = useNavigate();
  const processedRef = useRef(false);
  const timeoutRef = useRef(null);

  // Helper function for debugging
  const logCallback = (message, data = null) => {
    const timestamp = new Date().toISOString();
    const logMsg = `[${timestamp}] SSOCallback: ${message}`;
    console.log(logMsg, data || "");

    // Store logs in sessionStorage for debugging
    try {
      const logs = JSON.parse(
        sessionStorage.getItem("sso_callback_logs") || "[]"
      );
      logs.push({
        timestamp,
        message,
        data: data ? JSON.stringify(data) : null,
      });

      if (logs.length > 50) {
        logs.splice(0, logs.length - 50);
      }

      sessionStorage.setItem("sso_callback_logs", JSON.stringify(logs));
      
      // Update debug info for UI
      setDebugInfo(`${message}${data ? ` - ${JSON.stringify(data)}` : ''}`);
    } catch (e) {
      console.error("Error saving log:", e);
    }
  };

  // Main callback processing logic
  useEffect(() => {
    // Prevent double processing
    if (processedRef.current) {
      logCallback("Already processed, skipping");
      return;
    }
    
    processedRef.current = true;
    
    const processCallback = async () => {
      try {
        logCallback("Starting OAuth callback processing");
        
        // Add immediate status display
        setStatus("processing");
        setDebugInfo("Component mounted and processing started");
        
        // Get URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");
        const error = urlParams.get("error");
        const errorDescription = urlParams.get("error_description");
        const state = urlParams.get("state");
        const redirectTo = urlParams.get("returnUrl") || "/admin";
        
        setRedirectTarget(redirectTo);
        
        logCallback("URL parameters extracted", {
          hasCode: !!code,
          hasError: !!error,
          hasState: !!state,
          redirectTo,
          currentURL: window.location.href
        });
        
        // Add artificial delay to see if component is visible
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check for OAuth errors first
        if (error) {
          const errorMsg = errorDescription || error;
          logCallback("OAuth error detected", { error, errorDescription });
          setError(`OAuth error: ${errorMsg}`);
          setStatus("error");
          return;
        }
        
        // Check for missing code parameter
        if (!code) {
          logCallback("No code parameter found in URL");
          setError("Authentication failed: No code parameter found");
          setStatus("error");
          return;
        }
        
        logCallback("Code parameter found, attempting exchange", { codePrefix: code.substring(0, 10) + "..." });
        setStatus("processing");
        setDebugInfo(`Found code: ${code.substring(0, 10)}... - Starting exchange`);
        
        // Set timeout for the entire process
        timeoutRef.current = setTimeout(() => {
          logCallback("Timeout reached during code exchange");
          setError("Authentication timed out. Please try again.");
          setStatus("error");
        }, 30000); // 30 second timeout
        
        try {
          // Use Supabase's built-in PKCE code exchange
          // This should automatically handle the code from the current URL
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession();
          
          // Clear timeout if successful
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          
          if (exchangeError) {
            logCallback("Code exchange failed", { 
              error: exchangeError.message,
              code: exchangeError.code
            });
            
            // Handle specific PKCE errors
            if (exchangeError.message?.includes("pkce") || exchangeError.message?.includes("code_verifier")) {
              setError("PKCE verification failed. Please try signing in again.");
            } else if (exchangeError.message?.includes("expired")) {
              setError("Authorization code expired. Please try signing in again.");
            } else {
              setError(`Authentication failed: ${exchangeError.message}`);
            }
            setStatus("error");
            return;
          }
          
          if (!data?.session) {
            logCallback("No session data returned from code exchange");
            setError("Authentication failed: No session data returned");
            setStatus("error");
            return;
          }
          
          logCallback("Code exchange successful", { 
            userId: data.session.user.id,
            email: data.session.user.email
          });
          
          setUserEmail(data.session.user.email);
          setStatus("success");
          
          // Give the auth context time to update
          setTimeout(() => {
            logCallback("Redirecting to target", { target: redirectTo });
            window.location.href = redirectTo;
          }, 1000);
          
        } catch (codeExchangeError) {
          logCallback("Code exchange exception", { error: codeExchangeError.message });
          setError(`Code exchange failed: ${codeExchangeError.message}`);
          setStatus("error");
        }
        
      } catch (processError) {
        logCallback("Callback processing exception", { error: processError.message });
        setError(`Callback processing failed: ${processError.message}`);
        setStatus("error");
      }
    };
    
    processCallback();
    
    // Cleanup timeout on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [navigate]);

  // Success state
  if (status === "success") {
    return (
      <div className="sso-callback-container">
        <div className="success-icon-container">
          <CheckCircle className="success-icon" size={48} />
        </div>
        <h2>Authentication Successful</h2>
        <p>
          {userEmail ? `Signed in as ${userEmail}` : "Authentication completed"}
        </p>
        <p className="redirect-message">Redirecting to your account...</p>
        <div className="loading-indicator">
          <Loader className="spinner" size={24} />
        </div>
        <div className="manual-redirect">
          If you are not redirected automatically,{" "}
          <a href={redirectTarget} className="manual-link">
            click here
          </a>
        </div>
      </div>
    );
  }

  // Error state
  if (status === "error") {
    return (
      <div className="sso-callback-container">
        <div className="error-icon-container">
          <AlertCircle className="error-icon" size={48} />
        </div>
        <h2>Authentication Failed</h2>
        <p>{error || "An unexpected error occurred"}</p>
        {process.env.NODE_ENV === 'development' && debugInfo && (
          <div style={{ 
            marginTop: '16px', 
            padding: '12px', 
            background: '#f3f4f6', 
            borderRadius: '6px',
            fontSize: '12px',
            fontFamily: 'monospace',
            color: '#374151',
            maxHeight: '200px',
            overflow: 'auto'
          }}>
            <strong>Debug Info:</strong><br/>
            {debugInfo}
          </div>
        )}
        <div className="manual-redirect">
          <a href="/login" className="manual-link">
            Return to Login
          </a>
        </div>
      </div>
    );
  }

  // Processing state (default)
  return (
    <div className="sso-callback-container">
      <Loader className="spinner" size={48} />
      <h2>Authentication in Progress</h2>
      <p>Please wait while we complete your sign-in...</p>
      {process.env.NODE_ENV === 'development' && debugInfo && (
        <div style={{ 
          marginTop: '16px', 
          padding: '12px', 
          background: '#e3f2fd', 
          borderRadius: '6px',
          fontSize: '12px',
          fontFamily: 'monospace',
          color: '#1976d2',
          maxHeight: '200px',
          overflow: 'auto',
          border: '2px solid #2196f3'
        }}>
          <strong>Debug Info:</strong><br/>
          {debugInfo}
        </div>
      )}
    </div>
  );
}

export default SSOCallback;
