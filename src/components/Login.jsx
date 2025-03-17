// src/components/Login.jsx
import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { AlertCircle } from "lucide-react";
import "./Login.css";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { login, error: authError } = useAuth();
  const [formError, setFormError] = useState("");

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

      if (!success) {
        // Error will be set in auth context
      }
    } catch (error) {
      setFormError("An unexpected error occurred. Please try again.");
      console.error("Login error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <form onSubmit={handleSubmit} className="login-form">
        <h2>Tatt2Away Admin Login</h2>

        {/* Display error message if any */}
        {(formError || authError) && (
          <div className="error-alert">
            <AlertCircle className="h-4 w-4" />
            <p>{formError || authError}</p>
          </div>
        )}

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

        {/* Password Field */}
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <div className="password-input-wrapper">
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
              <span className="spinner"></span>
              Logging in...
            </>
          ) : (
            "Login"
          )}
        </button>
      </form>
    </div>
  );
}

export default Login;
