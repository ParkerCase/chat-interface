import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import {
  Loader2,
  Key,
  Plus,
  AlertCircle,
  CheckCircle,
  Copy,
  Calendar,
  Clock,
  X,
  RefreshCw,
  Trash2,
  EyeOff,
  Eye,
  Lock,
} from "lucide-react";
import "./APIKeyManagement.css";

function APIKeyManagement() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [keys, setKeys] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // New key state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [expiryDays, setExpiryDays] = useState("30");
  const [createdKey, setCreatedKey] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Delete state
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Expiry options
  const expiryOptions = [
    { value: "7", label: "7 days" },
    { value: "30", label: "30 days" },
    { value: "90", label: "90 days" },
    { value: "365", label: "1 year" },
    { value: "0", label: "No expiry" },
  ];

  const keyInputRef = useRef(null);

  useEffect(() => {
    fetchAPIKeys();
  }, []);

  // Reset dialog state when closing
  useEffect(() => {
    if (!showCreateDialog) {
      setNewKeyName("");
      setExpiryDays("30");
      setCreatedKey(null);
      setCopySuccess(false);
      setError("");
      setSuccess("");
    }
  }, [showCreateDialog]);

  // Auto-select key when created
  useEffect(() => {
    if (createdKey && keyInputRef.current) {
      keyInputRef.current.select();
    }
  }, [createdKey]);

  const fetchAPIKeys = async () => {
    try {
      setLoading(true);
      const response = await api.get("/api/api-keys");

      if (response.data.success) {
        setKeys(response.data.apiKeys || []);
      } else {
        setError("Failed to load API keys");
      }
    } catch (error) {
      console.error("Error fetching API keys:", error);
      setError("Failed to load API keys");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async () => {
    try {
      setError("");
      setSuccess("");

      if (!newKeyName.trim()) {
        setError("Key name is required");
        return;
      }

      const payload = {
        name: newKeyName.trim(),
        expiresIn: expiryDays === "0" ? null : parseInt(expiryDays, 10),
      };

      setLoading(true);
      const response = await api.post("/api/api-keys", payload);

      if (response.data.success) {
        setCreatedKey(response.data.apiKey);
        setSuccess("API key created successfully");

        // Update keys list, but don't show the one we just created yet
        // We'll add it after they dismiss the dialog
        fetchAPIKeys();
      } else {
        setError(response.data.error);
      }
    } catch (error) {
      console.error("Error creating API key:", error);
      setError(error.response?.data?.error || "Failed to create API key");
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeKey = async (keyId) => {
    try {
      setError("");
      setSuccess("");

      if (deleteConfirm !== keyId) {
        setDeleteConfirm(keyId);
        return;
      }

      setLoading(true);
      const response = await api.delete(`/api/api-keys/${keyId}`);

      if (response.data.success) {
        setSuccess("API key revoked successfully");
        setDeleteConfirm(null);

        // Update keys list
        setKeys(keys.filter((k) => k.id !== keyId));
      } else {
        setError(response.data.error);
      }
    } catch (error) {
      console.error("Error revoking API key:", error);
      setError(error.response?.data?.error || "Failed to revoke API key");
    } finally {
      setLoading(false);
    }
  };

  const copyKeyToClipboard = () => {
    if (keyInputRef.current) {
      keyInputRef.current.select();
      document.execCommand("copy");
      setCopySuccess(true);

      setTimeout(() => {
        setCopySuccess(false);
      }, 3000);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Never expires";

    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const renderCreateDialog = () => {
    if (!showCreateDialog) return null;

    return (
      <div className="api-key-dialog-overlay">
        <div className="api-key-dialog">
          <div className="dialog-header">
            <h3>{createdKey ? "API Key Created" : "Create New API Key"}</h3>
            <button
              className="close-button"
              onClick={() => setShowCreateDialog(false)}
            >
              <X size={20} />
            </button>
          </div>

          <div className="dialog-content">
            {error && (
              <div className="dialog-alert error">
                <AlertCircle size={16} />
                <p>{error}</p>
              </div>
            )}

            {success && !createdKey && (
              <div className="dialog-alert success">
                <CheckCircle size={16} />
                <p>{success}</p>
              </div>
            )}

            {!createdKey ? (
              <>
                <div className="dialog-form-field">
                  <label htmlFor="keyName">Key Name</label>
                  <input
                    type="text"
                    id="keyName"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g., Development API, Production Server"
                  />
                  <p className="field-hint">
                    Give your key a name to identify its purpose
                  </p>
                </div>

                <div className="dialog-form-field">
                  <label htmlFor="expiryDays">Expiration</label>
                  <select
                    id="expiryDays"
                    value={expiryDays}
                    onChange={(e) => setExpiryDays(e.target.value)}
                  >
                    {expiryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="field-hint">
                    Set when this API key should expire
                  </p>
                </div>

                <div className="dialog-actions">
                  <button
                    className="cancel-button"
                    onClick={() => setShowCreateDialog(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="create-button"
                    onClick={handleCreateKey}
                    disabled={loading || !newKeyName.trim()}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="spinner" size={16} />
                        <span>Creating...</span>
                      </>
                    ) : (
                      <>
                        <Key size={16} />
                        <span>Create Key</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : (
              <div className="created-key-display">
                <div className="created-key-info">
                  <CheckCircle className="success-icon" size={40} />
                  <h4>API Key Created Successfully</h4>
                  <p className="key-warning">
                    Make sure to copy your API key now. You won't be able to see
                    it again!
                  </p>
                </div>

                <div className="api-key-container">
                  <div className="api-key-input-group">
                    <input
                      type="text"
                      ref={keyInputRef}
                      value={createdKey.key}
                      readOnly
                      className="api-key-input"
                    />
                    <button
                      className="copy-button"
                      onClick={copyKeyToClipboard}
                      disabled={copySuccess}
                    >
                      {copySuccess ? (
                        <>
                          <CheckCircle size={16} />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={16} />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="key-details">
                  <div className="key-detail">
                    <span className="detail-label">Name:</span>
                    <span className="detail-value">{createdKey.name}</span>
                  </div>
                  <div className="key-detail">
                    <span className="detail-label">Expires:</span>
                    <span className="detail-value">
                      {createdKey.expiresAt
                        ? new Date(createdKey.expiresAt).toLocaleDateString()
                        : "Never"}
                    </span>
                  </div>
                </div>

                <div className="dialog-actions centered">
                  <button
                    className="done-button"
                    onClick={() => setShowCreateDialog(false)}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading && keys.length === 0) {
    return (
      <div className="api-key-management">
        <div className="loading-indicator">
          <Loader2 className="spinner" />
          <p>Loading API keys...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="api-key-management">
      <div className="api-key-header">
        <div className="api-key-title">
          <Key className="key-icon" />
          <h2>API Keys</h2>
        </div>
        <button
          className="add-key-button"
          onClick={() => setShowCreateDialog(true)}
        >
          <Plus size={16} />
          <span>New API Key</span>
        </button>
      </div>

      {error && (
        <div className="api-key-alert error">
          <AlertCircle size={16} />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="api-key-alert success">
          <CheckCircle size={16} />
          <p>{success}</p>
        </div>
      )}

      <div className="api-key-content">
        <div className="api-key-info">
          <p>
            API keys allow external applications to authenticate with the
            Tatt2Away API. Keep your API keys secure and don't share them in
            publicly accessible areas.
          </p>
          <p className="warning-text">
            <Lock size={14} /> Anyone with your API key can make API calls on
            your behalf.
          </p>
        </div>

        {keys.length === 0 ? (
          <div className="no-keys">
            <p>You haven't created any API keys yet.</p>
            <button
              className="create-key-button"
              onClick={() => setShowCreateDialog(true)}
            >
              <Key size={16} />
              <span>Create API Key</span>
            </button>
          </div>
        ) : (
          <div className="api-key-list">
            <div className="api-key-list-header">
              <span className="header-name">Name</span>
              <span className="header-created">Created</span>
              <span className="header-expires">Expires</span>
              <span className="header-last-used">Last Used</span>
              <span className="header-actions">Actions</span>
            </div>

            {keys.map((key) => (
              <div
                key={key.id}
                className={`api-key-item ${!key.active ? "inactive" : ""}`}
              >
                <div className="key-name">
                  <div className="key-badge">
                    <Key size={14} />
                  </div>
                  <span>{key.name}</span>
                  {!key.active && (
                    <span className="inactive-badge">Inactive</span>
                  )}
                </div>

                <div className="key-created">
                  <Calendar size={14} className="date-icon" />
                  <span>{new Date(key.createdAt).toLocaleDateString()}</span>
                </div>

                <div className="key-expires">
                  <Clock size={14} className="date-icon" />
                  <span>{formatDate(key.expiresAt)}</span>
                </div>

                <div className="key-last-used">
                  {key.lastUsed ? (
                    <>
                      <Clock size={14} className="date-icon" />
                      <span>{new Date(key.lastUsed).toLocaleString()}</span>
                    </>
                  ) : (
                    <span className="never-used">Never</span>
                  )}
                </div>

                <div className="key-actions">
                  {deleteConfirm === key.id ? (
                    <div className="delete-confirm">
                      <button
                        className="delete-confirm-button"
                        onClick={() => handleRevokeKey(key.id)}
                      >
                        Confirm
                      </button>
                      <button
                        className="delete-cancel-button"
                        onClick={() => setDeleteConfirm(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      className="delete-key-button"
                      onClick={() => handleRevokeKey(key.id)}
                      title="Revoke API Key"
                    >
                      <Trash2 size={16} />
                      <span className="sr-only">Revoke</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {renderCreateDialog()}
    </div>
  );
}

export default APIKeyManagement;
