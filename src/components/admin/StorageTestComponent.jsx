// src/components/admin/StorageTestComponent.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";

const StorageTestComponent = () => {
  const [providers, setProviders] = useState([]);
  const [testPath, setTestPath] = useState(
    "dropbox:/photos - sequence/to be watermarked 11-12-18/let go 2.jpg"
  );
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load active providers on mount
  useEffect(() => {
    fetchProviders();
  }, []);

  // Fetch active storage providers from the server
  const fetchProviders = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/status/health");

      if (response.data.providers) {
        setProviders(response.data.providers);
      }

      setLoading(false);
    } catch (err) {
      console.error("Error fetching providers:", err);
      setError("Failed to fetch storage providers");
      setLoading(false);
    }
  };

  // Test image loading from a specific path
  const testImagePath = async () => {
    try {
      setLoading(true);
      setTestResult(null);
      setError(null);

      // Use our image proxy endpoint to test the path
      const response = await axios.get(
        `/api/image-proxy?path=${encodeURIComponent(testPath)}`,
        {
          responseType: "blob",
        }
      );

      // Create a blob URL to display the image
      const imageUrl = URL.createObjectURL(response.data);

      setTestResult({
        success: true,
        imageUrl,
        contentType: response.headers["content-type"],
        size: response.data.size,
        timestamp: new Date().toISOString(),
      });

      setLoading(false);
    } catch (err) {
      console.error("Error testing image path:", err);

      setTestResult({
        success: false,
        error: err.response?.data || err.message,
        status: err.response?.status,
        timestamp: new Date().toISOString(),
      });

      setLoading(false);
    }
  };

  return (
    <div className="storage-test-container">
      <h2>Storage Provider Test</h2>

      <div className="provider-status">
        <h3>Active Providers</h3>
        {loading && <p>Loading providers...</p>}
        {error && <p className="error">{error}</p>}

        {providers.length > 0 ? (
          <ul className="provider-list">
            {providers.map((provider) => (
              <li key={provider} className={`provider-item ${provider}`}>
                {provider}
              </li>
            ))}
          </ul>
        ) : (
          <p>No active storage providers found</p>
        )}
      </div>

      <div className="image-test-section">
        <h3>Test Image Loading</h3>
        <div className="input-group">
          <label htmlFor="test-path">Image Path:</label>
          <input
            type="text"
            id="test-path"
            value={testPath}
            onChange={(e) => setTestPath(e.target.value)}
            className="path-input"
            placeholder="Enter image path to test (e.g., dropbox:/path/to/image.jpg)"
          />
        </div>

        <button
          onClick={testImagePath}
          disabled={loading || !testPath}
          className="test-button"
        >
          {loading ? "Testing..." : "Test Path"}
        </button>

        {testResult && (
          <div
            className={`test-result ${
              testResult.success ? "success" : "failure"
            }`}
          >
            <h4>Test Result: {testResult.success ? "Success" : "Failed"}</h4>

            {testResult.success ? (
              <div className="image-preview-container">
                <img
                  src={testResult.imageUrl}
                  alt="Test result"
                  className="test-image"
                />
                <div className="image-info">
                  <p>
                    <strong>Content Type:</strong> {testResult.contentType}
                  </p>
                  <p>
                    <strong>Size:</strong> {(testResult.size / 1024).toFixed(2)}{" "}
                    KB
                  </p>
                  <p>
                    <strong>Tested:</strong>{" "}
                    {new Date(testResult.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ) : (
              <div className="error-details">
                <p>
                  <strong>Error:</strong> {testResult.error}
                </p>
                {testResult.status && (
                  <p>
                    <strong>Status:</strong> {testResult.status}
                  </p>
                )}
                <p>
                  <strong>Tested:</strong>{" "}
                  {new Date(testResult.timestamp).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="storage-provider-help">
        <h3>Path Format Help</h3>
        <p>Use one of these formats to test different storage providers:</p>
        <ul>
          <li>
            <code>dropbox:/path/to/image.jpg</code> - Dropbox
          </li>
          <li>
            <code>googledrive:/path/to/image.jpg</code> - Google Drive
          </li>
          <li>
            <code>s3:/path/to/image.jpg</code> - AWS S3
          </li>
          <li>
            <code>azureblob:/path/to/image.jpg</code> - Azure Blob Storage
          </li>
          <li>
            <code>/path/to/image.jpg</code> - Default provider
          </li>
        </ul>
      </div>

      <style jsx>{`
        .storage-test-container {
          background-color: #f9f9f9;
          border-radius: 8px;
          padding: 20px;
          max-width: 800px;
          margin: 0 auto;
        }

        .provider-list {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          padding: 0;
          list-style: none;
        }

        .provider-item {
          padding: 6px 12px;
          border-radius: 16px;
          color: white;
          font-weight: 500;
          font-size: 14px;
        }

        .provider-item.dropbox {
          background-color: #0061ff;
        }

        .provider-item.googledrive {
          background-color: #149d41;
        }

        .provider-item.s3 {
          background-color: #ff9900;
        }

        .provider-item.azureblob {
          background-color: #0078d4;
        }

        .input-group {
          margin-bottom: 16px;
        }

        .path-input {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-family: monospace;
        }

        .test-button {
          background-color: #4a6cf7;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
        }

        .test-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .test-result {
          margin-top: 20px;
          padding: 16px;
          border-radius: 8px;
        }

        .test-result.success {
          background-color: #f0fff4;
          border: 1px solid #c6f6d5;
        }

        .test-result.failure {
          background-color: #fff5f5;
          border: 1px solid #fed7d7;
        }

        .image-preview-container {
          display: flex;
          align-items: flex-start;
          gap: 20px;
          margin-top: 15px;
        }

        .test-image {
          max-width: 300px;
          max-height: 300px;
          border-radius: 4px;
          border: 1px solid #ddd;
        }

        .image-info {
          flex: 1;
        }

        .error-details {
          background-color: #fff0f0;
          padding: 12px;
          border-radius: 4px;
          font-family: monospace;
          font-size: 13px;
        }

        .storage-provider-help {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #eee;
        }

        .storage-provider-help code {
          background-color: #f0f0f0;
          padding: 3px 6px;
          border-radius: 3px;
          font-family: monospace;
        }
      `}</style>
    </div>
  );
};

export default StorageTestComponent;
