// src/components/AuthTest.jsx
import React, { useState } from "react";
import apiService from "../services/apiService";

const AuthTest = () => {
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const testConnection = async () => {
    try {
      setStatus("loading");
      setError(null);

      const result = await apiService.utils.testConnection();
      setResult(result);
      setStatus("success");
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  };

  const testProviders = async () => {
    try {
      setStatus("loading");
      setError(null);

      // Use fetch directly
      const response = await fetch(
        `${apiService.utils.getBaseUrl()}/api/auth/providers`
      );
      const data = await response.json();

      setResult(data);
      setStatus("success");
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 800, margin: "0 auto" }}>
      <h2>Auth API Testing</h2>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <button onClick={testConnection}>Test Connection</button>
        <button onClick={testProviders}>Test Auth Providers</button>
      </div>

      <div style={{ marginBottom: 20 }}>
        Status: {status}
        {error && <div style={{ color: "red" }}>{error}</div>}
      </div>

      {result && (
        <pre
          style={{
            background: "#f5f5f5",
            padding: 10,
            overflow: "auto",
            maxHeight: 400,
          }}
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
};

export default AuthTest;
