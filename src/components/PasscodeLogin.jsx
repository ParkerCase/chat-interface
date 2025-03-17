// src/components/PasscodeLogin.jsx
import React, { useState } from "react";
import { AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./Login.css";

// Use environment variable for security
const TEAM_PASSCODE = process.env.REACT_APP_TEAM_PASSCODE || "R3m0v@al$Ru$";

function PasscodeLogin() {
  const [passcode, setPasscode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handlePasscodeSubmit = async (e) => {
    e.preventDefault();

    if (passcode === TEAM_PASSCODE) {
      localStorage.setItem("isAuthenticated", "true");
      navigate("/");
      setError("");
    } else {
      setError("Incorrect passcode");
      setPasscode("");
    }
  };

  return (
    <div className="login-container">
      <form onSubmit={handlePasscodeSubmit} className="login-form">
        <h2>Quick Access</h2>
        <p className="login-info">
          Enter team passcode for basic access or{" "}
          <a href="/login" className="admin-link">
            login as admin
          </a>{" "}
          for full features.
        </p>
        {error && <p className="error-message">{error}</p>}

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

        <div className="password-input-wrapper">
          <input
            type={showPassword ? "text" : "password"}
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Enter passcode"
            className="password-input"
            autoComplete="current-password"
            id="current-password"
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
        <button type="submit" className="login-button">
          Enter
        </button>
      </form>
    </div>
  );
}

export default PasscodeLogin;
