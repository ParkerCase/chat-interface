// src/components/auth/SupabaseAuthUI.jsx
import React, { useEffect, useState } from "react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "../../lib/supabase";
import { Loader, AlertCircle } from "lucide-react";

/**
 * Enhanced Supabase Auth UI wrapper
 * Provides a consistent authentication UI with proper event handling
 *
 * @param {Object} props Component props
 * @param {string} props.view Initial view to show (sign_in, sign_up, etc.)
 * @param {string} props.redirectTo URL to redirect after authentication
 * @param {Array} props.providers List of OAuth providers to display
 * @param {Function} props.onAuthChange Callback for auth state changes
 * @param {boolean} props.magicLink Enable magic link option
 * @param {Function} props.onError Error handler
 * @returns {React.Component} Supabase Auth UI component
 */
const SupabaseAuthUI = ({
  view = "sign_in",
  redirectTo = `${window.location.origin}/auth/callback`,
  providers = ["google", "apple"],
  onAuthChange,
  magicLink = false,
  onError,
  className = "",
}) => {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState("");

  // Initialize component
  useEffect(() => {
    const checkAuthState = async () => {
      try {
        // Get current session
        const { data, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("Error checking auth state:", sessionError);
          handleError(sessionError);
          setIsReady(true);
          return;
        }

        // If we have an active session, trigger the callback
        if (data?.session && typeof onAuthChange === "function") {
          onAuthChange("SIGNED_IN", data.session);
        }

        setIsReady(true);
      } catch (err) {
        console.error("Error initializing auth UI:", err);
        handleError(err);
        setIsReady(true);
      }
    };

    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`Auth state change in AuthUI: ${event}`);

      if (typeof onAuthChange === "function") {
        onAuthChange(event, session);
      }
    });

    checkAuthState();

    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
    };
  }, [onAuthChange]);

  // Handle errors
  const handleError = (err) => {
    const errorMessage =
      err.message || "An error occurred during authentication";
    setError(errorMessage);

    if (typeof onError === "function") {
      onError(err);
    }
  };

  // Show loading state
  if (!isReady) {
    return (
      <div className="auth-ui-loading">
        <Loader size={24} className="spinner" />
        <p>Loading authentication...</p>
      </div>
    );
  }

  return (
    <div className={`supabase-auth-ui ${className}`}>
      {error && (
        <div className="auth-ui-error">
          <AlertCircle size={18} />
          <p>{error}</p>
        </div>
      )}

      <Auth
        supabaseClient={supabase}
        appearance={{
          theme: ThemeSupa,
          variables: {
            default: {
              colors: {
                brand: "#4f46e5",
                brandAccent: "#4338ca",
              },
              borderWidths: {
                buttonBorderWidth: "1px",
                inputBorderWidth: "1px",
              },
              radii: {
                borderRadiusButton: "6px",
                buttonBorderRadius: "6px",
                inputBorderRadius: "6px",
              },
            },
          },
          className: {
            container: "auth-form-container",
            button: "auth-button",
            label: "auth-label",
            input: "auth-input",
            message: "auth-message",
          },
        }}
        providers={providers}
        redirectTo={redirectTo}
        theme="light"
        view={view}
        showLinks={true}
        magicLink={magicLink}
        localization={{
          variables: {
            sign_in: {
              email_label: "Email address",
              password_label: "Password",
              button_label: "Sign in",
              loading_button_label: "Signing in...",
              link_text: "Already have an account? Sign in",
              password_required: "Please enter your password",
              email_required: "Please enter your email address",
            },
            sign_up: {
              email_label: "Email address",
              password_label: "Create a password",
              button_label: "Create account",
              loading_button_label: "Creating account...",
              link_text: "Don't have an account? Sign up",
              password_required: "Please create a password",
              email_required: "Please enter your email address",
            },
            forgotten_password: {
              email_label: "Email address",
              password_label: "Password",
              button_label: "Send reset link",
              loading_button_label: "Sending reset link...",
              link_text: "Forgot your password?",
              confirmation_text: "Check your email for the reset link",
            },
          },
        }}
      />
    </div>
  );
};

export default SupabaseAuthUI;
