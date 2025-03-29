// src/components/UnauthorizedPage.jsx
import React from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, Home, ArrowLeft } from "lucide-react";
import { useAuth } from "../context/AuthContext";

function UnauthorizedPage() {
  const { getUserTier } = useAuth();
  const currentTier = getUserTier();

  return (
    <div className="unauthorized-container">
      <div className="unauthorized-content">
        <ShieldAlert className="unauthorized-icon" size={64} />
        <h1>Access Denied</h1>
        <p>
          You don't have permission to access this page. This feature may
          require a higher subscription tier or additional permissions.
        </p>

        <div className="tier-info">
          <p>
            Your current tier: <strong>{currentTier}</strong>
          </p>

          {currentTier !== "enterprise" && (
            <div className="upgrade-section">
              <p>Need more features?</p>
              <Link to="/account/upgrade" className="upgrade-button">
                Upgrade Your Account
              </Link>
            </div>
          )}
        </div>

        <div className="navigation-options">
          <Link to="/" className="home-button">
            <Home size={16} />
            <span>Go to Dashboard</span>
          </Link>

          <button onClick={() => window.history.back()} className="back-button">
            <ArrowLeft size={16} />
            <span>Go Back</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default UnauthorizedPage;
