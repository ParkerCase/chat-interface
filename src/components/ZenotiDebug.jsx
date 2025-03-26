// src/components/ZenotiDebug.jsx
import React, { useState, useEffect } from "react";
import zenotiService from "../services/zenotiService";
import crmService from "../services/crmService";
import { testConnection } from "../services/apiService";

const ZenotiDebug = () => {
  const [zenotiStatus, setZenotiStatus] = useState(null);
  const [crmProviders, setCrmProviders] = useState(null);
  const [corsTest, setCorsTest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const runTests = async () => {
    setLoading(true);
    setError(null);

    try {
      // Test CORS
      const corsResult = await testConnection();
      setCorsTest(corsResult);
      console.log("CORS test result:", corsResult);

      // Test Zenoti status
      const zenotiResult = await zenotiService.checkConnectionStatus();
      setZenotiStatus(zenotiResult.data);
      console.log("Zenoti status result:", zenotiResult.data);

      // Test CRM providers
      const providersResult = await crmService.getProviders();
      setCrmProviders(providersResult.data);
      console.log("CRM providers result:", providersResult.data);
    } catch (err) {
      console.error("Test failed:", err);
      setError(err.message || "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Integration Diagnostic Tool</h2>

      <button
        onClick={runTests}
        disabled={loading}
        className="bg-blue-500 text-white px-4 py-2 rounded mb-4 disabled:bg-gray-400"
      >
        {loading ? "Running Tests..." : "Run Integration Tests"}
      </button>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 p-3 rounded mb-4">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border p-4 rounded">
          <h3 className="font-bold mb-2">CORS Test</h3>
          {corsTest ? (
            <pre className="bg-gray-100 p-2 rounded text-sm">
              {JSON.stringify(corsTest, null, 2)}
            </pre>
          ) : (
            <p className="text-gray-500">Not tested yet</p>
          )}
        </div>

        <div className="border p-4 rounded">
          <h3 className="font-bold mb-2">Zenoti Status</h3>
          {zenotiStatus ? (
            <pre className="bg-gray-100 p-2 rounded text-sm">
              {JSON.stringify(zenotiStatus, null, 2)}
            </pre>
          ) : (
            <p className="text-gray-500">Not tested yet</p>
          )}
        </div>

        <div className="border p-4 rounded">
          <h3 className="font-bold mb-2">CRM Providers</h3>
          {crmProviders ? (
            <pre className="bg-gray-100 p-2 rounded text-sm">
              {JSON.stringify(crmProviders, null, 2)}
            </pre>
          ) : (
            <p className="text-gray-500">Not tested yet</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ZenotiDebug;
