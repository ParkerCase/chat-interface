// src/components/auth/AppleLoginButton.jsx
import React, { useState } from "react";
import { signInWithApple } from "../../utils/ssoDebugger";
import { Apple, Loader2 } from "lucide-react";

/**
 * Apple Login button with error handling
 */
function AppleLoginButton({ onSuccess, onError }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAppleLogin = async () => {
    try {
      setIsLoading(true);
      setError("");

      const result = await signInWithApple();

      if (result.action === "redirecting") {
        // Don't do anything - we're being redirected
        return;
      }

      if (!result.success) {
        setError(result.error || "Failed to sign in with Apple");
        if (onError) onError(result.error);
        return;
      }

      if (onSuccess) onSuccess(result);
    } catch (error) {
      console.error("Apple login error:", error);
      setError(error.message || "An unexpected error occurred");
      if (onError) onError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="apple-login-container">
      <button
        onClick={handleAppleLogin}
        className="apple-login-button"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="spinner" size={18} />
            <span>Connecting...</span>
          </>
        ) : (
          <>
            <Apple size={18} />
            <span>Sign in with Apple</span>
          </>
        )}
      </button>

      {error && <div className="apple-login-error">{error}</div>}

      <style jsx>{`
        .apple-login-container {
          width: 100%;
          margin: 16px 0;
        }

        .apple-login-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 10px 16px;
          background-color: black;
          color: white;
          border: 1px solid #000;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .apple-login-button:hover {
          background-color: #333;
        }

        .apple-login-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .apple-login-error {
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

export default AppleLoginButton;
