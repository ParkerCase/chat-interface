import React from "react";
import { X, AlertCircle } from "lucide-react";
import "./ComingSoonOverlay.css";

/**
 * A reusable Coming Soon overlay component for features in development
 */
const ComingSoonOverlay = ({
  title = "Feature Coming Soon!",
  featureName = "This feature",
  description,
  onClose,
}) => {
  return (
    <div className="coming-soon-overlay">
      <div className="coming-soon-modal">
        <div className="coming-soon-header">
          <h3>{title}</h3>
          <button className="close-button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="coming-soon-content">
          <AlertCircle size={48} className="coming-soon-icon" />
          <p>
            <strong>{featureName}</strong> is currently in development.
          </p>
          {description && <p>{description}</p>}
          <p>
            We're working with Zenoti to finalize this feature and it will be
            available soon.
          </p>
        </div>

        <div className="coming-soon-footer">
          <button onClick={onClose}>OK, I'll check back later</button>
        </div>
      </div>
    </div>
  );
};

export default ComingSoonOverlay;
