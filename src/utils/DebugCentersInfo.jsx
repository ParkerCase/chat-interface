// DebugCentersInfo.jsx
// This is a utility component to debug centers loading issues

import React, { useState, useEffect } from "react";
import zenotiService from "../services/zenotiService";

const DebugCentersInfo = () => {
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState(null);

  // Load centers on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // First check connection status
      const statusResponse = await zenotiService.getStatus();
      console.log("Zenoti connection status:", statusResponse.data);

      if (statusResponse.data) {
        setConnectionStatus(statusResponse.data);
      }

      // Then load centers
      const response = await zenotiService.getCenters();
      console.log("Centers API response:", response.data);

      if (response.data?.success) {
        setCenters(response.data.centers || []);
      } else {
        setError(
          "Failed to load centers: " + (response.data?.error || "Unknown error")
        );
      }
    } catch (err) {
      console.error("Error loading centers data:", err);
      setError("Error: " + (err.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        padding: "20px",
        backgroundColor: "#f5f5f5",
        borderRadius: "8px",
        margin: "20px 0",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
      }}
    >
      <h3 style={{ marginTop: 0 }}>Debug: Zenoti Centers</h3>

      {loading ? (
        <div>Loading centers data...</div>
      ) : error ? (
        <div style={{ color: "red" }}>{error}</div>
      ) : (
        <>
          <div style={{ marginBottom: "15px" }}>
            <h4>Connection Status:</h4>
            {connectionStatus ? (
              <pre
                style={{
                  backgroundColor: "#eee",
                  padding: "10px",
                  borderRadius: "4px",
                  overflow: "auto",
                }}
              >
                {JSON.stringify(connectionStatus, null, 2)}
              </pre>
            ) : (
              <div>No connection status information available</div>
            )}
          </div>

          <div>
            <h4>Centers ({centers.length}):</h4>
            {centers.length > 0 ? (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={tableHeaderStyle}>ID</th>
                    <th style={tableHeaderStyle}>Name</th>
                    <th style={tableHeaderStyle}>Code</th>
                  </tr>
                </thead>
                <tbody>
                  {centers.map((center) => (
                    <tr key={center.id} style={tableRowStyle}>
                      <td style={tableCellStyle}>{center.id}</td>
                      <td style={tableCellStyle}>{center.name}</td>
                      <td style={tableCellStyle}>{center.code}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div>No centers available</div>
            )}
          </div>
        </>
      )}

      <div style={{ marginTop: "15px" }}>
        <button
          onClick={loadData}
          disabled={loading}
          style={{
            padding: "8px 16px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Loading..." : "Refresh Data"}
        </button>
      </div>
    </div>
  );
};

// Styles
const tableHeaderStyle = {
  backgroundColor: "#007bff",
  color: "white",
  padding: "8px",
  textAlign: "left",
};

const tableRowStyle = {
  borderBottom: "1px solid #ddd",
};

const tableCellStyle = {
  padding: "8px",
};

export default DebugCentersInfo;
