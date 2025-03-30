// src/components/LoginForm.jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import {
  AlertCircle,
  Loader2,
  Lock,
  Mail,
  LogIn,
  Eye,
  EyeOff,
  ArrowRight,
  Shield,
} from "lucide-react";
import MFAVerification from "./auth/MFAVerification";
import "./LoginForm.css";

/**
 * LoginForm component handles user authentication through:
 * - Email/password login with Supabase
 * - Single Sign-On with Google and Apple (restricted to tatt2away.com domain)
 * - MFA verification when required
 */
function LoginForm() {
  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [providers, setProviders] = useState([]);
  const [loginMethod, setLoginMethod] = useState("password");
  const [processingCode, setProcessingCode] = useState(false);

  // Error handling
  const [formError, setFormError] = useState("");

  // MFA state
  const [showMfaVerification, setShowMfaVerification] = useState(false);
  const [mfaData, setMfaData] = useState(null);

  // Get auth context
  const {
    login,
    error: authError,
    setError,
    processTokenExchange,
    setCurrentUser,
  } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  // Load authentication providers on component mount
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        setLoadingProviders(true);
        console.log("Fetching auth providers...");

        // For this implementation, we'll use hardcoded providers
        // In a real app, you would fetch this from your backend
        setProviders([
          {
            id: "google",
            name: "Google",
            type: "oauth",
            icon: "google",
            enabled: true,
          },
          {
            id: "apple",
            name: "Apple",
            type: "oauth",
            icon: "apple",
            enabled: true,
          },
        ]);

        // Default to password login
        setLoginMethod("password");
      } catch (error) {
        console.error("Failed to fetch providers:", error);
        setLoginMethod("password");
      } finally {
        setLoadingProviders(false);
      }
    };

    fetchProviders();
  }, []);

  // Check for token exchange code in URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get("code");

    if (code) {
      setProcessingCode(true);

      processTokenExchange(code)
        .then((success) => {
          if (success) {
            // Get return URL from params or default to home
            const returnUrl = params.get("returnUrl") || "/";
            navigate(returnUrl);
          } else {
            setFormError(
              "Failed to authenticate with SSO provider. Please try again."
            );
          }
        })
        .finally(() => {
          setProcessingCode(false);
        });
    }
  }, [location, navigate, processTokenExchange]);

  // Password-based login handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setError("");

    if (!email) {
      setFormError("Email is required");
      return;
    }

    if (!password) {
      setFormError("Password is required");
      return;
    }

    // Email domain validation for tatt2away.com
    if (!email.endsWith("@tatt2away.com") && email !== "itsus@tatt2away.com") {
      setFormError("Only @tatt2away.com email addresses are allowed");
      return;
    }

    try {
      setIsLoading(true);
      console.log("Attempting login with:", email);

      const result = await login(email, password);

      if (result.success) {
        if (result.mfaRequired && result.mfaData) {
          // Show MFA verification screen
          console.log("MFA verification required:", result.mfaData);
          setShowMfaVerification(true);
          setMfaData(result.mfaData);
          setIsLoading(false);
        } else {
          // Get redirect URL from query params
          const params = new URLSearchParams(location.search);
          const returnUrl = params.get("returnUrl") || "/";

          // Redirect to destination based on role
          if (result.isAdmin) {
            navigate(returnUrl.includes("/admin") ? returnUrl : "/admin");
          } else {
            navigate(returnUrl);
          }
        }
      } else {
        setFormError(result.error || "Invalid credentials");
      }
    } catch (error) {
      console.error("Login error:", error);
      setFormError(error.message || "Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

  // SSO login handler
  const handleSSOLogin = async (provider) => {
    try {
      setIsLoading(true);
      setFormError("");

      // Prepare redirect URL
      let redirectUrl = `${window.location.origin}/auth/callback`;

      // Add return URL if specified
      const params = new URLSearchParams(location.search);
      const returnUrl = params.get("returnUrl");
      if (returnUrl) {
        redirectUrl += `?returnUrl=${encodeURIComponent(returnUrl)}`;
      }

      console.log(`Initiating SSO login with ${provider}`);

      // Provider-specific configurations
      let queryParams = {};

      // For Google, restrict to tatt2away.com domain
      if (provider === "google") {
        queryParams.hd = "tatt2away.com";
      }

      // Sign in with OAuth provider
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: redirectUrl,
          queryParams,
        },
      });

      if (error) throw error;

      // Handle the redirect URL from Supabase
      if (data?.url) {
        // Redirect to the OAuth provider
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("SSO login error:", error);
      setFormError(`Error connecting to ${provider}: ${error.message}`);
      setIsLoading(false);
    }
  };

  // Handle MFA verification success
  const handleMfaSuccess = () => {
    // Get redirect URL from query params
    const params = new URLSearchParams(location.search);
    const returnUrl = params.get("returnUrl") || "/";

    // Redirect to appropriate page based on user role
    navigate(returnUrl);
  };

  // Handle MFA verification cancel
  const handleMfaCancel = () => {
    setShowMfaVerification(false);
  };

  // If processing an SSO code, show loading indicator
  if (processingCode) {
    return (
      <div className="login-form">
        <div className="processing-sso">
          <Loader2 className="h-10 w-10 animate-spin" />
          <h2>Authenticating...</h2>
          <p>Please wait while we complete your login.</p>
        </div>
      </div>
    );
  }

  // If MFA verification is needed, show MFA screen
  if (showMfaVerification) {
    return (
      <div className="login-form">
        <MFAVerification
          mfaData={mfaData}
          onSuccess={handleMfaSuccess}
          onCancel={handleMfaCancel}
        />
      </div>
    );
  }

  // Regular login form
  return (
    <div className="login-form">
      <div className="login-header">
        <img src="/logo.png" alt="Tatt2Away Logo" className="login-logo" />
        <h2>Sign in to your account</h2>
      </div>

      {/* Login method toggle */}
      <div className="login-method-toggle">
        <button
          className={`method-tab ${loginMethod === "password" ? "active" : ""}`}
          onClick={() => setLoginMethod("password")}
          disabled={isLoading}
        >
          <Lock size={16} />
          <span>Password</span>
        </button>
        <button
          className={`method-tab ${loginMethod === "sso" ? "active" : ""}`}
          onClick={() => setLoginMethod("sso")}
          disabled={isLoading || providers.length === 0}
        >
          <LogIn size={16} />
          <span>Single Sign-On</span>
        </button>
      </div>

      {/* Display error message if any */}
      {(formError || authError) && (
        <div className="error-alert">
          <AlertCircle className="h-4 w-4" />
          <p>{formError || authError}</p>
        </div>
      )}

      {loginMethod === "password" ? (
        <form onSubmit={handleSubmit} className="login-form-fields">
          {/* Hidden username field for browser autocomplete */}
          <input
            type="text"
            id="username"
            name="username"
            autoComplete="username"
            className="hidden-username"
            aria-hidden="true"
            tabIndex="-1"
          />

          {/* Email Field */}
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <div className="input-with-icon">
              <Mail className="input-icon" size={18} />
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="youremail@tatt2away.com"
                className="form-input"
                autoComplete="email"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="form-group">
            <div className="password-label-row">
              <label htmlFor="password">Password</label>
              <Link to="/forgot-password" className="forgot-password">
                Forgot password?
              </Link>
            </div>
            <div className="password-input-wrapper">
              <div className="input-with-icon">
                <Lock className="input-icon" size={18} />
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="form-input"
                  autoComplete="current-password"
                  disabled={isLoading}
                />
              </div>
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Test credentials info for development */}
          <div className="test-credentials-info">
            <p>
              Use test credentials: <strong>itsus@tatt2away.com</strong> with
              password <strong>password</strong>
            </p>
          </div>

          {/* Submit Button */}
          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="spinner h-4 w-4" />
                Logging in...
              </>
            ) : (
              <>
                Login
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      ) : (
        <div className="sso-section">
          {loadingProviders ? (
            <div className="sso-loading">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p>Loading authentication providers...</p>
            </div>
          ) : providers.length === 0 ? (
            <div className="sso-error">
              <AlertCircle className="h-6 w-6" />
              <p>
                No authentication providers available. Please use password
                login.
              </p>
            </div>
          ) : (
            <div className="sso-providers">
              <button
                onClick={() => handleSSOLogin("google")}
                className="sso-button google"
                disabled={isLoading}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"
                    fill="#4285F4"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <button
                onClick={() => handleSSOLogin("apple")}
                className="sso-button apple"
                disabled={isLoading}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12.152,6.896c-0.948,0-2.415-1.078-3.96-1.04c-2.04,0.027-3.91,1.183-4.961,3.014c-2.117,3.675-0.546,9.103,1.519,12.066c1.013,1.455,2.208,3.09,3.792,3.039c1.52-0.065,2.09-0.987,3.935-0.987c1.831,0,2.35,0.987,3.96,0.948c1.637-0.026,2.676-1.48,3.676-2.948c1.156-1.688,1.636-3.325,1.662-3.415c-0.039-0.013-3.182-1.221-3.22-4.857c-0.026-3.04,2.48-4.494,2.597-4.559c-1.429-2.09-3.623-2.324-4.39-2.376C14.641,5.781,13.073,6.896,12.152,6.896z M15.629,3.039c0.831-1.014,1.39-2.428,1.237-3.831c-1.195,0.052-2.64,0.793-3.486,1.794c-0.766,0.884-1.443,2.313-1.26,3.675C13.507,4.793,14.786,4.039,15.629,3.039z"
                    fill="#000"
                  />
                </svg>
                <span>Continue with Apple</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Divider between login methods */}
      <div className="login-divider">
        <span>Or continue with</span>
      </div>

      {/* Alternative login method button */}
      {loginMethod === "password" ? (
        <button
          onClick={() => setLoginMethod("sso")}
          className="alt-login-button"
          disabled={isLoading || providers.length === 0}
        >
          <LogIn className="h-4 w-4" />
          <span>Single Sign-On</span>
        </button>
      ) : (
        <button
          onClick={() => setLoginMethod("password")}
          className="alt-login-button"
          disabled={isLoading}
        >
          <Lock className="h-4 w-4" />
          <span>Password</span>
        </button>
      )}

      {/* Quick Access Passcode link */}
      <div className="quick-access-link">
        <Link to="/passcode">Use Quick Access Passcode</Link>
      </div>
    </div>
  );
}

export default LoginForm;
