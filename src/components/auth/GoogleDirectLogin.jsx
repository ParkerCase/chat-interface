// src/components/auth/GoogleDirectLogin.jsx
import React, { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNavigate } from "react-router-dom";
import { Google, Loader } from "lucide-react";

function GoogleDirectLogin() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError("");

      console.log("Starting Google login flow...");

      // OPTION 1: Standard OAuth sign in
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          // Critical: These options help fix the "User not found" issue
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
          // Force creation of new users
          shouldCreateUser: true,
        },
      });

      if (error) {
        console.error("Google OAuth error:", error);
        throw error;
      }

      console.log("OAuth response:", data);

      if (data.url) {
        // Store info in sessionStorage for debugging
        sessionStorage.setItem("google_auth_attempt", "true");
        sessionStorage.setItem("google_auth_time", new Date().toISOString());

        // Redirect to Google's login page
        window.location.href = data.url;
        return;
      }
    } catch (err) {
      console.error("Google login error:", err);
      setError(err.message || "Failed to sign in with Google");
    } finally {
      setLoading(false);
    }
  };

  // OPTION 2: For manual account creation if OAuth doesn't work
  const createUserManually = async () => {
    try {
      setLoading(true);
      setError("");

      // Ask for email
      const email = prompt("Enter your email address to create an account:");
      if (!email) {
        setLoading(false);
        return;
      }

      // OPTION 2A: Create account with magic link (no password)
      const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        throw error;
      }

      alert(`Success! Check your email (${email}) for a login link.`);

      // OPTION 2B: Alternative - Create account with temporary password
      /*
      const tempPassword = Math.random().toString(36).slice(2) + Math.random().toString(36).toUpperCase().slice(2) + "!1";
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password: tempPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        }
      });
      
      if (error) {
        throw error;
      }
      
      alert(`Account created! Check your email (${email}) to confirm your account.`);
      */
    } catch (err) {
      console.error("Manual account creation error:", err);
      setError(err.message || "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="google-login-wrapper">
      <button
        onClick={handleGoogleLogin}
        className="google-login-button"
        disabled={loading}
      >
        {loading ? (
          <Loader className="spinning" size={20} />
        ) : (
          <Google size={20} />
        )}
        <span>Sign in with Google</span>
      </button>

      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button
            onClick={createUserManually}
            className="create-account-button"
          >
            Create Account Manually
          </button>
        </div>
      )}

      <style jsx>{`
        .google-login-wrapper {
          margin: 20px 0;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .google-login-button {
          display: flex;
          align-items: center;
          gap: 10px;
          background-color: white;
          color: #444;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 10px 15px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
          min-width: 220px;
          justify-content: center;
        }

        .google-login-button:hover {
          background-color: #f8f8f8;
        }

        .google-login-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .error-message {
          margin-top: 15px;
          color: #e53e3e;
          text-align: center;
        }

        .create-account-button {
          margin-top: 10px;
          background-color: #4a5568;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 8px 12px;
          font-size: 14px;
          cursor: pointer;
        }

        .spinning {
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

export default GoogleDirectLogin;
