// src/components/LoginForm.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  AlertCircle,
  Loader2,
  Lock,
  Mail,
  LogIn,
  Eye,
  EyeOff,
  X,
} from "lucide-react";
import { ssoProviders, signInWithSSO, handleSSOCallback } from "../lib/sso";

// Custom social icon components
const GoogleIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    stroke="currentColor"
    strokeWidth="1.5"
    fill="none"
  >
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

const MicrosoftIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24">
    <path d="M11.4 24H0V12.6h11.4V24Z" fill="#F1511B" />
    <path d="M24 24H12.6V12.6H24V24Z" fill="#80CC28" />
    <path d="M11.4 11.4H0V0h11.4v11.4Z" fill="#00ADEF" />
    <path d="M24 11.4H12.6V0H24v11.4Z" fill="#FBBC09" />
  </svg>
);

const CompanyIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
  >
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [providers, setProviders] = useState([]);
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

        // Get available SSO providers
        const availableProviders = Object.values(ssoProviders).filter(
          (p) => p.enabled
        );
        setProviders(availableProviders);

        // If SSO providers exist, default to the SSO tab
        if (availableProviders.length > 0) {
          setLoginMethod("sso");
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

  // Check for SSO callback in URL
  useEffect(() => {
    const checkSSOCallback = async () => {
      if (location.pathname === "/auth/callback") {
        setProcessingCode(true);
        const success = await handleSSOCallback();
        if (!success) {
          navigate("/login");
        }
      }
    };

    checkSSOCallback();
  }, [location, navigate]);

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

  // Handle form submission for password login
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    try {
      setIsLoading(true);

      // Call the login function
      const success = await login(email, password);

      if (success) {
        // Get return URL from query params or default to home
        const params = new URLSearchParams(location.search);
        const returnUrl = params.get("returnUrl") || "/";
        navigate(returnUrl);
      }
    } catch (error) {
      console.error("Login error:", error);
      setFormError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle SSO login
  const handleSSOLogin = async (providerId) => {
    try {
      setIsLoading(true);
      setFormError("");

      // Get return URL from query params or default to home
      const params = new URLSearchParams(location.search);
      const returnUrl = params.get("returnUrl") || "/";

      // Sign in with the selected SSO provider
      await signInWithSSO(providerId, {
        redirectTo: `${
          window.location.origin
        }/auth/callback?returnUrl=${encodeURIComponent(returnUrl)}`,
      });

      // The page will be redirected to the provider's login page
    } catch (error) {
      console.error("SSO login error:", error);
      setFormError(`Error connecting to ${providerId} login: ${error.message}`);
      setIsLoading(false);
    }
  };

  // Get provider icon based on provider ID
  const getProviderIcon = (providerId) => {
    switch (providerId) {
      case "google":
        return <GoogleIcon />;
      case "azure":
        return <MicrosoftIcon />;
      case "custom_saml":
        return <CompanyIcon />;
      default:
        return <LogIn />;
    }
  };

  // If processing SSO callback, show loading
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

  return (
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
              <a
                href="/forgot-password"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/forgot-password");
                }}
                className="forgot-password"
              >
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
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {process.env.NODE_ENV === "development" && (
              <div
                style={{
                  margin: "20px 0",
                  padding: "10px",
                  border: "1px dashed #ccc",
                }}
              >
                <h4>Development Login</h4>
                <button
                  onClick={async () => {
                    try {
                      setEmail("admin@tatt2away.com");
                      setPassword("adminpassword123");
                      setTimeout(() => {
                        handleSubmit({ preventDefault: () => {} });
                      }, 500);
                    } catch (error) {
                      console.error("Error:", error);
                    }
                  }}
                >
                  Quick Admin Access
                </button>
              </div>
            )}
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
              {providers.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => handleSSOLogin(provider.id)}
                  className={`sso-button ${provider.id}`}
                  disabled={isLoading}
                >
                  {getProviderIcon(provider.id)}
                  <span>Continue with {provider.name}</span>
                </button>
              ))}
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

      <div className="quick-access-link">
        <a
          href="/passcode"
          onClick={(e) => {
            e.preventDefault();
            navigate("/passcode");
          }}
        >
          Use Quick Access Passcode
        </a>
      </div>
    </div>
  );
}

export default LoginForm;
