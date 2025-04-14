// src/components/auth/AuthLoading.jsx
import React, { useState, useEffect } from "react";
import { Loader, AlertCircle } from "lucide-react";
import "./AuthLoading.css"; // Create this file with the styles below

function AuthLoading({
  message = "Checking authentication...",
  timeout = 20000, // 20 seconds timeout
  timeoutMessage = "Taking longer than expected. You may need to refresh the page.",
  showTimeoutMessage = true,
  showSpinner = true,
  onTimeout = null,
}) {
  const [showTimeout, setShowTimeout] = useState(false);
  const [timePassed, setTimePassed] = useState(0);
  const [intervalId, setIntervalId] = useState(null);

  useEffect(() => {
    // Start a timer to show timeout message
    const id = setInterval(() => {
      setTimePassed((prev) => prev + 1000);
    }, 1000);

    setIntervalId(id);

    // Start timeout
    const timeoutId = setTimeout(() => {
      setShowTimeout(true);
      if (onTimeout && typeof onTimeout === "function") {
        onTimeout();
      }
    }, timeout);

    return () => {
      clearInterval(id);
      clearTimeout(timeoutId);
    };
  }, [timeout, onTimeout]);

  // Calculate progress percentage
  const progressPercent = Math.min(100, (timePassed / timeout) * 100);

  return (
    <div className="auth-loading-container">
      {showSpinner && <Loader className="spinner" size={36} />}

      <p className="loading-message">{message}</p>

      <div className="loading-progress-bar">
        <div
          className="loading-progress-fill"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {showTimeout && showTimeoutMessage && (
        <div className="timeout-message">
          <AlertCircle size={16} />
          <p>{timeoutMessage}</p>
        </div>
      )}
    </div>
  );
}

export default AuthLoading;
