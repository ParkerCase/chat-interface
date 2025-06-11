import React from "react";
import "./ClaudeResearchModal.css";

const TelescopeIcon = () => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#3b82f6"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 2l3.5 6L12 14l-3.5-6L12 2z" />
    <path d="M12 14v8" />
    <path d="M8 18h8" />
    <circle cx="12" cy="20" r="1" />
  </svg>
);

export default function ClaudeResearchModal({ open, onClose, context }) {
  if (!open) return null;

  return (
    <div className="claude-modal-overlay">
      <div className="claude-modal-card">
        <div className="claude-modal-header">
          <div className="claude-modal-title">
            <TelescopeIcon />
            <span>
              Deep Research <span className="claude-badge">Claude MCP</span>
            </span>
          </div>
          <button
            className="claude-modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>
        <div className="claude-modal-body">
          <div className="claude-context-label">Context:</div>
          <div
            className={`claude-context-box${
              !context ? " claude-context-empty" : ""
            }`}
          >
            {context ? (
              context
            ) : (
              <span className="claude-context-placeholder">
                No context provided.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
