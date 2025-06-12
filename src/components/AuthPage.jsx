// src/components/AuthPage.jsx
import React, { useState, useEffect } from "react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "../lib/supabase";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  Info,
  CheckCircle,
  Loader,
  Sparkles,
  BarChart4,
  MessageCircle,
  LayoutDashboard,
  Cpu,
} from "lucide-react";
import "./auth.css";

const AuthPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [returnUrl, setReturnUrl] = useState("/admin");

  // Extract query parameters
  useEffect(() => {
    console.log("Auth page initialized");

    // Get return URL if present
    const redirectPath = searchParams.get("returnUrl") || "/admin";
    setReturnUrl(redirectPath);
    console.log("Return URL:", redirectPath);

    // Check for password changed notification
    const passwordChanged = searchParams.get("passwordChanged") === "true";
    if (passwordChanged) {
      setSuccessMessage(
        "Password changed successfully. Please sign in with your new password."
      );
    }

    // Check for expired session
    const expired = searchParams.get("expired") === "true";
    if (expired) {
      setError("Your session has expired. Please sign in again.");
    }

    // Check for account linking completion
    const linked = searchParams.get("linked") === "true";
    if (linked) {
      setSuccessMessage("Your account has been successfully linked.");
    }
  }, [searchParams]);

  return (
    <div className="auth-layout">
      <div className="auth-container">
        <div className="auth-branding">
          <InkOutLogo />
        </div>

        <div className="auth-content">
          <div
            className="info-box"
            style={{
              marginBottom: 24,
              background: "#f9fafb",
              borderRadius: 8,
              padding: 16,
              color: "#374151",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              fontSize: 15,
            }}
          >
            <strong>
              Sign in or sign up with your company Google or Apple account.
            </strong>
          </div>

          {error && (
            <div className="error-alert">
              <AlertCircle size={18} />
              <p>{error}</p>
            </div>
          )}

          {successMessage && (
            <div className="success-alert">
              <CheckCircle size={18} />
              <p>{successMessage}</p>
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
            providers={["google", "apple"]}
            redirectTo={`${
              window.location.origin
            }/auth/callback?returnUrl=${encodeURIComponent(returnUrl)}`}
            theme="light"
            onlyThirdPartyProviders={true}
          />
        </div>

        <div className="auth-footer">
          <p>© {new Date().getFullYear()} Tatt2Away. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;

export function InkOutLogo() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#18181b",
        borderRadius: 24,
        boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
        padding: "32px 40px",
        marginBottom: 32,
        gap: 24,
        minWidth: 320,
      }}
    >
      <Cpu size={56} color="#f4f4ed" strokeWidth={2.5} />
      <span
        style={{
          fontFamily: "Inter, Arial, sans-serif",
          fontWeight: 800,
          fontSize: 48,
          letterSpacing: 2,
          color: "#f4f4ed",
          lineHeight: 1,
        }}
      >
        Ink
        <span style={{ color: "#ff5733" }}>Out</span>
      </span>
    </div>
  );
}
