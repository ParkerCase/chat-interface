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
  const [isProcessingOAuth, setIsProcessingOAuth] = useState(false);

  // Handle OAuth callback if we're on the callback route
  useEffect(() => {
    const handleOAuthCallback = async () => {
      // Add delay to ensure URL params are available
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check multiple sources for OAuth callback parameters
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace('#', ''));
      
      const code = urlParams.get('code') || hashParams.get('code');
      const errorParam = urlParams.get('error') || hashParams.get('error');
      const accessToken = urlParams.get('access_token') || hashParams.get('access_token');
      
      console.log('OAuth parameter check:', {
        url: window.location.href,
        hasCode: !!code,
        hasError: !!errorParam,
        hasAccessToken: !!accessToken,
        searchParams: urlParams.toString(),
        hashParams: hashParams.toString()
      });
      
      // Also check if Supabase auto-detected the session
      let hasSession = false;
      try {
        const { data } = await supabase.auth.getSession();
        hasSession = !!data?.session;
        console.log('Immediate session check:', { hasSession, email: data?.session?.user?.email });
      } catch (e) {
        console.log('Session check failed:', e.message);
      }
      
      if (code || errorParam || accessToken || hasSession) {
        console.log('OAuth callback detected in AuthPage - Processing...');
        setIsProcessingOAuth(true);
        
        if (errorParam) {
          setError(`OAuth error: ${urlParams.get('error_description') || hashParams.get('error_description') || errorParam}`);
          setIsProcessingOAuth(false);
          return;
        }
        
        try {
          // If we already have a session, use it immediately
          if (hasSession) {
            console.log('Session already available, proceeding to admin');
            setSuccessMessage('Login successful! Redirecting...');
            setTimeout(() => {
              window.location.href = '/admin';
            }, 1000);
            return;
          }
          
          // Let Supabase handle the OAuth callback automatically
          console.log('Waiting for session to establish...');
          await new Promise(resolve => setTimeout(resolve, 2500));
          
          // Check for session multiple times with retries
          let sessionData = null;
          let attempts = 0;
          const maxAttempts = 5;
          
          while (!sessionData?.session && attempts < maxAttempts) {
            console.log(`Session check attempt ${attempts + 1}`);
            const { data, error: authError } = await supabase.auth.getSession();
            
            if (authError) {
              console.error('OAuth callback error:', authError);
              break;
            }
            
            sessionData = data;
            if (!sessionData?.session) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              attempts++;
            }
          }
          
          if (sessionData?.session) {
            console.log('OAuth login successful:', sessionData.session.user.email);
            setSuccessMessage('Login successful! Redirecting...');
            
            // Wait for auth context to fully update
            console.log('Waiting for auth context to update...');
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Force navigate to admin
            console.log('Navigating to /admin');
            window.location.href = '/admin';
          } else {
            console.log('No session found, trying manual code exchange...');
            const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession();
            
            if (exchangeError) {
              console.error('Manual code exchange failed:', exchangeError);
              setError(`Authentication failed: ${exchangeError.message}`);
            } else if (exchangeData?.session) {
              console.log('Manual code exchange successful');
              setSuccessMessage('Login successful! Redirecting...');
              await new Promise(resolve => setTimeout(resolve, 1500));
              window.location.href = '/admin';
            } else {
              setError('Authentication failed: Unable to establish session');
            }
          }
        } catch (err) {
          console.error('OAuth processing error:', err);
          setError(`Authentication failed: ${err.message}`);
        }
        
        setIsProcessingOAuth(false);
        return;
      }
    };
    
    handleOAuthCallback();
  }, [navigate]);

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

  // Show OAuth processing state
  if (isProcessingOAuth) {
    return (
      <div className="auth-layout">
        <div className="auth-container">
          <div className="auth-branding">
            <InkOutLogo />
          </div>
          <div className="auth-content">
            <div className="sso-callback-container" style={{ textAlign: 'center', padding: '20px' }}>
              <Loader className="spinner" size={48} style={{ margin: '0 auto 20px', color: '#4f46e5' }} />
              <h2 style={{ color: '#1f2937', marginBottom: '16px' }}>Completing Google Sign-In</h2>
              <p style={{ color: '#6b7280', marginBottom: '20px' }}>Please wait while we process your authentication...</p>
              
              {process.env.NODE_ENV === 'development' && (
                <div style={{
                  background: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  color: '#374151',
                  marginTop: '16px'
                }}>
                  <strong>Debug:</strong> Processing OAuth callback...<br/>
                  URL: {window.location.href}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

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
            redirectTo={`${window.location.origin}/login?oauth=callback&returnUrl=${encodeURIComponent(returnUrl)}`}
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
