// src/components/UpgradePrompt.jsx
import React from "react";
import { X, CheckCircle, ArrowUp } from "lucide-react";
import { useFeatureFlags } from "../utils/featureFlags";
import "./UpgradePrompt.css";

const UpgradePrompt = ({ feature, onClose }) => {
  const { getFeatureDescription, getUserTier, getTierUpgradeBenefits } =
    useFeatureFlags();

  // Get current tier and required tier information
  const currentTier = getUserTier();
  const upgradeBenefits = getTierUpgradeBenefits(currentTier);

  // Get information about the specific feature that triggered this prompt
  const featureDescription = getFeatureDescription(feature);

  // Determine which tier is needed for this feature
  let requiredTier = "professional"; // Default to professional
  if (currentTier === "professional") {
    requiredTier = "enterprise"; // If already on professional, must be enterprise feature
  }

  // Get the list of benefits for the next tier up
  const nextTierBenefits = upgradeBenefits[requiredTier] || [];

  // Pricing information based on tiers
  const pricingInfo = {
    basic: {
      price: "$2,500",
      period: "one-time setup",
    },
    professional: {
      price: "$5,000-10,000",
      period: "one-time setup",
    },
    enterprise: {
      price: "$15,000-25,000",
      period: "one-time setup",
    },
  };

  // Get the next tier pricing info
  const pricing = pricingInfo[requiredTier] || pricingInfo.professional;

  return (
    <div className="upgrade-overlay">
      <div className="upgrade-modal">
        <div className="upgrade-modal-header">
          <h2>Upgrade Required</h2>
          <button className="close-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="upgrade-modal-content">
          <div className="feature-info">
            <h3>This feature requires an upgrade</h3>
            <p>
              <span className="feature-name">
                {feature
                  .replace(/_/g, " ")
                  .split(" ")
                  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(" ")}
              </span>{" "}
              is available in the{" "}
              <strong>
                {requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1)}
              </strong>{" "}
              tier.
            </p>
            <p className="feature-description">{featureDescription}</p>
          </div>

          <div className="tier-comparison">
            <div className="current-tier">
              <h4>Your Current Tier</h4>
              <div className="tier-badge">
                {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}
              </div>
            </div>

            <div className="tier-upgrade-arrow">
              <ArrowUp size={24} />
            </div>

            <div className="upgrade-tier">
              <h4>Upgrade To</h4>
              <div className="tier-badge upgrade">
                {requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1)}
              </div>
              <div className="pricing-info">
                <span className="price">{pricing.price}</span>
                <span className="period">{pricing.period}</span>
              </div>
            </div>
          </div>

          <div className="tier-benefits">
            <h4>Additional Benefits Include:</h4>
            <ul>
              {nextTierBenefits.map((benefit, index) => (
                <li key={index}>
                  <CheckCircle className="benefit-icon" size={16} />
                  <span>{benefit.description}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="upgrade-modal-footer">
          <button className="cancel-button" onClick={onClose}>
            Not Now
          </button>
          <a
            href="mailto:sales@tatt2away.com?subject=Tier%20Upgrade%20Request&body=I'm%20interested%20in%20upgrading%20my%20Tatt2Away%20AI%20Bot%20subscription.%20Please%20provide%20more%20information."
            className="upgrade-button"
          >
            Contact Sales
          </a>
        </div>
      </div>
    </div>
  );
};

export default UpgradePrompt;
