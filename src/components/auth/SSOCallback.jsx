// src/components/auth/SSOCallback.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Loader2 } from "lucide-react";

function SSOCallback() {
  const [error, setError] = useState("");
  const [processingState, setProcessingState] = useState("Authenticating...");
  const { processTokenExchange } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    async function handleCallback() {
      try {
        // Get the code from URL
        const params = new URLSearchParams(location.search);
        const code = params.get("code");
        const error = params.get("error");
        const returnUrl = params.get("returnUrl") || "/";

        if (error) {
          setProcessingState("Authentication failed");
          setError(`Error: ${error}`);
          return;
        }

        if (!code) {
          setProcessingState("Missing authentication code");
          setError("No authentication code provided");
          return;
        }

        setProcessingState("Processing authentication...");
        const success = await processTokenExchange(code);

        if (success) {
          setProcessingState("Authentication successful! Redirecting...");
          setTimeout(() => {
            navigate(returnUrl);
          }, 1000);
        } else {
          setProcessingState("Authentication failed");
          setError("Failed to authenticate with the provided code");
        }
      } catch (err) {
        console.error("SSO callback error:", err);
        setProcessingState("Authentication error");
        setError(err.message || "An unexpected error occurred");
      }
    }

    handleCallback();
  }, [location, navigate, processTokenExchange]);

  return (
    <div className="sso-callback-container">
      <div className="auth-processing">
        <Loader2 className="h-10 w-10 animate-spin" />
        <h2>{processingState}</h2>
        {error && (
          <div className="auth-error">
            <p>{error}</p>
            <button
              onClick={() => navigate("/login")}
              className="back-to-login-button"
            >
              Back to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default SSOCallback;
