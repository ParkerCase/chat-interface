// src/components/auth/GoogleLoginButton.jsx
import React, { useState } from "react";
import { signInWithGoogle } from "../../utils/ssoDebugger";
import { Google, Loader2 } from "lucide-react";

/**
 * Enhanced Google Login button with better error handling
 */
function GoogleLoginButton({ onSuccess, onError }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      setError("");

      const result = await signInWithGoogle();

      if (result.action === "redirecting") {
        // Don't do anything - we're being redirected
        return;
      }

      if (!result.success) {
        setError(result.error || "Failed to sign in with Google");
        if (onError) onError(result.error);
        return;
      }

      if (onSuccess) onSuccess(result);
    } catch (error) {
      console.error("Google login error:", error);
      setError(error.message || "An unexpected error occurred");
      if (onError) onError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="google-login-container">
      <button
        onClick={handleGoogleLogin}
        className="google-login-button"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="spinner" size={18} />
            <span>Connecting...</span>
          </>
        ) : (
          <>
            <Google size={18} />
            <span>Sign in with Google</span>
          </>
        )}
      </button>

      {error && <div className="google-login-error">{error}</div>}

      <style jsx>{`
        .google-login-container {
          width: 100%;
          margin: 16px 0;
        }

        .google-login-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 10px 16px;
          background-color: white;
          color: #333;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .google-login-button:hover {
          background-color: #f8f8f8;
        }

        .google-login-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .google-login-error {
          margin-top: 8px;
          color: #e53e3e;
          font-size: 14px;
        }

        .spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

export default GoogleLoginButton;
