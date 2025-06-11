import React from "react";

const integrations = [
  { name: "Zenoti", status: "active" },
  { name: "Close.io", status: "active" },
  { name: "Google Drive", status: "active" },
  { name: "Dropbox", status: "active" },
  { name: "Slack", status: "active" },
];

export default function IntegrationStatusIndicators() {
  return (
    <div className="integration-status">
      {integrations.map((i) => (
        <span key={i.name} className={`integration ${i.status}`}>
          {i.name} {i.status === "active" ? "✅" : "❌"}
        </span>
      ))}
    </div>
  );
}
