// src/components/Login.jsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import {
  AlertCircle,
  Loader2,
  Key,
  Lock,
  Mail,
  LogIn,
  Coffee,
} from "lucide-react";
import api from "../services/api";
import "./Login.css";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [providers, setProviders] = useState([]);
  const [defaultProvider, setDefaultProvider] = useState(null);
  const [loginMethod, setLoginMethod] = useState("password");
  const [processingCode, setProcessingCode] = useState(false);

  const { login, error: authError, setError, processTokenExchange } = useAuth();
  const [formError, setFormError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  // Get providers on mount
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        setLoadingProviders(true);
        const response = await api.get("/api/auth/providers");

        if (response.data.success) {
          setProviders(Object.values(response.data.providers));
          setDefaultProvider(response.data.defaultProvider);

          // If SSO providers exist, default to the first one
          if (Object.keys(response.data.providers).length > 0) {
            setLoginMethod("sso");
          }
        }
      } catch (error) {
        console.error("Failed to fetch providers:", error);
        setLoginMethod("password"); // Fall back to password login
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    // Validate email
    if (!email) {
      setFormError("Email is required");
      return;
    }

    // Validate email domain
    if (!email.endsWith("@tatt2away.com")) {
      setFormError("Only @tatt2away.com email addresses are allowed");
      return;
    }

    // Validate password
    if (!password) {
      setFormError("Password is required");
      return;
    }

    try {
      setIsLoading(true);
      const success = await login(email, password);

      if (success) {
        // Get return URL from query params or default to home
        const params = new URLSearchParams(location.search);
        const returnUrl = params.get("returnUrl") || "/";
        navigate(returnUrl);
      }
    } catch (error) {
      setFormError("An unexpected error occurred. Please try again.");
      console.error("Login error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle SSO login
  const handleSSOLogin = (provider) => {
    // Generate return URL
    const params = new URLSearchParams(location.search);
    const returnUrl = params.get("returnUrl") || "/";

    // Create URL with return URL param
    const ssoUrl = `${provider.loginUrl}?returnUrl=${encodeURIComponent(
      returnUrl
    )}`;

    // Redirect to SSO provider
    window.location.href = ssoUrl;
  };

  // Render SSO buttons
  const renderSSOButtons = () => {
    if (loadingProviders) {
      return (
        <div className="sso-loading">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p>Loading authentication providers...</p>
        </div>
      );
    }

    if (providers.length === 0) {
      return (
        <div className="sso-error">
          <AlertCircle className="h-6 w-6" />
          <p>
            No authentication providers available. Please use password login.
          </p>
        </div>
      );
    }

    return (
      <div className="sso-providers">
        {providers.map((provider) => (
          <button
            key={provider.id}
            onClick={() => handleSSOLogin(provider)}
            className={`sso-button ${provider.type}`}
            disabled={isLoading || processingCode}
          >
            {getProviderIcon(provider.type)}
            <span>Continue with {provider.name}</span>
          </button>
        ))}
      </div>
    );
  };

  // Get icon for provider type
  const getProviderIcon = (type) => {
    switch (type) {
      case "google":
        return (
          <svg
            className="provider-icon"
            viewBox="0 0 24 24"
            width="24"
            height="24"
          >
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
        );
      case "azure":
      case "microsoft":
        return (
          <svg
            className="provider-icon"
            viewBox="0 0 24 24"
            width="24"
            height="24"
          >
            <path fill="#f25022" d="M1 1h10v10H1z" />
            <path fill="#00a4ef" d="M1 13h10v10H1z" />
            <path fill="#7fba00" d="M13 1h10v10H13z" />
            <path fill="#ffb900" d="M13 13h10v10H13z" />
          </svg>
        );
      case "okta":
        return (
          <svg
            className="provider-icon"
            viewBox="0 0 24 24"
            width="24"
            height="24"
          >
            <path
              fill="#007dc1"
              d="M12 0C5.389 0 0 5.35 0 12s5.35 12 12 12 12-5.35 12-12S18.611 0 12 0zm0 18c-3.309 0-6-2.691-6-6s2.691-6 6-6 6 2.691 6 6-2.691 6-6 6z"
            />
          </svg>
        );
      case "saml":
        return <Key className="provider-icon" />;
      case "oidc":
        return <LogIn className="provider-icon" />;
      default:
        return <Coffee className="provider-icon" />;
    }
  };

  if (processingCode) {
    return (
      <div className="login-container">
        <div className="login-form">
          <div className="processing-sso">
            <Loader2 className="h-10 w-10 animate-spin" />
            <h2>Authenticating...</h2>
            <p>Please wait while we complete your login.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-form">
        <div className="login-header">
          <img
            src="/Tatt2Away-Color-Black-Logo-300.png"
            alt="Tatt2Away Logo"
            className="login-logo"
          />
          <h2>Sign in to your account</h2>
        </div>

        {/* Login method toggle */}
        <div className="login-method-toggle">
          <button
            className={`method-tab ${
              loginMethod === "password" ? "active" : ""
            }`}
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
            {/* Hidden username field for accessibility */}
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
                <a href="/forgot-password" className="forgot-password">
                  Forgot password?
                </a>
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
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button type="submit" className="login-button" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="spinner h-4 w-4" />
                  Logging in...
                </>
              ) : (
                "Login"
              )}
            </button>
          </form>
        ) : (
          <div className="sso-section">{renderSSOButtons()}</div>
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
      </div>
    </div>
  );
}

export default Login;
