<!-- {/_ Notification Settings _/}
{activeSection === "notifications" && (
<div className="settings-section">
<h3 className="settings-title">Notification Settings</h3>
<p className="settings-description">
Configure system notifications and alerts.
</p>

                    <form onSubmit={(e) => handleSubmit(e, "notifications")}>
                      <div className="form-group checkbox-group">
                        <label className="checkbox-container">
                          <input
                            type="checkbox"
                            name="emailNotifications"
                            checked={notificationSettings.emailNotifications}
                            onChange={(e) =>
                              handleInputChange(e, "notifications")
                            }
                          />
                          <span className="checkbox-label">
                            Enable email notifications
                          </span>
                        </label>
                      </div>

                      <div className="form-group checkbox-group">
                        <label className="checkbox-container">
                          <input
                            type="checkbox"
                            name="slackNotifications"
                            checked={notificationSettings.slackNotifications}
                            onChange={(e) =>
                              handleInputChange(e, "notifications")
                            }
                          />
                          <span className="checkbox-label">
                            Enable Slack notifications
                          </span>
                        </label>
                      </div>

                      <div className="form-group">
                        <label htmlFor="slackWebhookUrl">
                          Slack Webhook URL
                        </label>
                        <input
                          type="text"
                          id="slackWebhookUrl"
                          name="slackWebhookUrl"
                          value={notificationSettings.slackWebhookUrl}
                          onChange={(e) =>
                            handleInputChange(e, "notifications")
                          }
                          className="form-input"
                          disabled={!notificationSettings.slackNotifications}
                        />
                      </div>

                      <div className="form-group checkbox-group">
                        <h4 className="checkbox-group-title">
                          Notification Triggers
                        </h4>
                        <label className="checkbox-container">
                          <input
                            type="checkbox"
                            name="notifyOnNewUsers"
                            checked={notificationSettings.notifyOnNewUsers}
                            onChange={(e) =>
                              handleInputChange(e, "notifications")
                            }
                          />
                          <span className="checkbox-label">
                            New user registrations
                          </span>
                        </label>

                        <label className="checkbox-container">
                          <input
                            type="checkbox"
                            name="notifyOnErrors"
                            checked={notificationSettings.notifyOnErrors}
                            onChange={(e) =>
                              handleInputChange(e, "notifications")
                            }
                          />
                          <span className="checkbox-label">System errors</span>
                        </label>

                        <label className="checkbox-container">
                          <input
                            type="checkbox"
                            name="notifyOnStorageLimit"
                            checked={notificationSettings.notifyOnStorageLimit}
                            onChange={(e) =>
                              handleInputChange(e, "notifications")
                            }
                          />
                          <span className="checkbox-label">
                            Storage limit warnings
                          </span>
                        </label>
                      </div>

                      <div className="form-group">
                        <label htmlFor="digestFrequency">
                          Digest Frequency
                        </label>
                        <select
                          id="digestFrequency"
                          name="digestFrequency"
                          value={notificationSettings.digestFrequency}
                          onChange={(e) =>
                            handleInputChange(e, "notifications")
                          }
                          className="form-select"
                        >
                          <option value="realtime">Real-time</option>
                          <option value="hourly">Hourly</option>
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                        </select>
                        <p className="input-help">
                          How often to send notification digests.
                        </p>
                      </div>

                      <div className="form-group checkbox-group">
                        <label className="checkbox-container">
                          <input
                            type="checkbox"
                            name="adminAlerts"
                            checked={notificationSettings.adminAlerts}
                            onChange={(e) =>
                              handleInputChange(e, "notifications")
                            }
                          />
                          <span className="checkbox-label">
                            Admin-only alerts
                          </span>
                        </label>
                        <p className="input-help">
                          Send certain alerts only to administrators.
                        </p>
                      </div>

                      <div className="form-actions">
                        <button
                          type="submit"
                          className="submit-button"
                          disabled={saving}
                        >
                          {saving ? (
                            <>
                              <Loader size={14} className="spinner" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save size={14} />
                              Save Settings
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                API Settings
                {activeSection === "api" && (
                  <div className="settings-section">
                    <h3 className="settings-title">API Settings</h3>
                    <p className="settings-description">
                      Configure API access and settings.
                    </p>

                    <form onSubmit={(e) => handleSubmit(e, "api")}>
                      <div className="form-group checkbox-group">
                        <label className="checkbox-container">
                          <input
                            type="checkbox"
                            name="apiEnabled"
                            checked={apiSettings.apiEnabled}
                            onChange={(e) => handleInputChange(e, "api")}
                          />
                          <span className="checkbox-label">
                            Enable API access
                          </span>
                        </label>
                      </div>

                      <div className="form-group">
                        <label htmlFor="rateLimit">
                          Rate Limit (requests/hour)
                        </label>
                        <input
                          type="number"
                          id="rateLimit"
                          name="rateLimit"
                          min="1"
                          value={apiSettings.rateLimit}
                          onChange={(e) => handleInputChange(e, "api")}
                          className="form-input"
                          disabled={!apiSettings.apiEnabled}
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="allowedDomains">
                          Allowed Domains (CORS)
                        </label>
                        <input
                          type="text"
                          id="allowedDomains"
                          name="allowedDomains"
                          value={apiSettings.allowedDomains}
                          onChange={(e) => handleInputChange(e, "api")}
                          className="form-input"
                          disabled={!apiSettings.apiEnabled}
                        />
                        <p className="input-help">
                          Comma-separated list of domains allowed to make API
                          requests. Leave empty to allow all.
                        </p>
                      </div>

                      <div className="form-group">
                        <label htmlFor="webhookUrl">Webhook URL</label>
                        <input
                          type="text"
                          id="webhookUrl"
                          name="webhookUrl"
                          value={apiSettings.webhookUrl}
                          onChange={(e) => handleInputChange(e, "api")}
                          className="form-input"
                          disabled={!apiSettings.apiEnabled}
                        />
                        <p className="input-help">
                          URL to receive webhook notifications for API events.
                        </p>
                      </div>

                      <div className="form-group checkbox-group">
                        <label className="checkbox-container">
                          <input
                            type="checkbox"
                            name="logAllRequests"
                            checked={apiSettings.logAllRequests}
                            onChange={(e) => handleInputChange(e, "api")}
                          />
                          <span className="checkbox-label">
                            Log all API requests
                          </span>
                        </label>
                      </div>

                      <div className="form-actions">
                        <button
                          type="submit"
                          className="submit-button"
                          disabled={saving}
                        >
                          {saving ? (
                            <>
                              <Loader size={14} className="spinner" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save size={14} />
                              Save Settings
                            </>
                          )}
                        </button>
                      </div>
                    </form>

                    {/* API Keys Management */}
                    <div className="api-keys-section">
                      <div className="section-header">
                        <h4>API Keys</h4>
                        <button
                          className="add-key-button"
                          onClick={() => {
                            const name = prompt(
                              "Enter a name for this API key:"
                            );
                            if (name) {
                              generateApiKey(name);
                            }
                          }}
                          disabled={!apiSettings.apiEnabled || saving}
                        >
                          <Key size={14} />
                          Generate New Key
                        </button>
                      </div>

                      {apiSettings.apiKeys && apiSettings.apiKeys.length > 0 ? (
                        <div className="api-keys-list">
                          {apiSettings.apiKeys.map((key) => (
                            <div
                              key={key.id}
                              className={`api-key-item ${
                                !key.is_active ? "revoked" : ""
                              }`}
                            >
                              <div className="api-key-info">
                                <div className="api-key-name">{key.name}</div>
                                <div className="api-key-details">
                                  <span className="api-key-created">
                                    Created:{" "}
                                    {new Date(
                                      key.created_at
                                    ).toLocaleDateString()}
                                  </span>
                                  {key.expires_at && (
                                    <span className="api-key-expires">
                                      Expires:{" "}
                                      {new Date(
                                        key.expires_at
                                      ).toLocaleDateString()}
                                    </span>
                                  )}
                                  {key.revoked_at && (
                                    <span className="api-key-revoked">
                                      Revoked:{" "}
                                      {new Date(
                                        key.revoked_at
                                      ).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="api-key-value">
                                {key.key.substring(0, 10)}...
                              </div>
                              <div className="api-key-actions">
                                {key.is_active && (
                                  <button
                                    className="revoke-key-button"
                                    onClick={() => revokeApiKey(key.id)}
                                    disabled={saving}
                                  >
                                    <X size={14} />
                                    Revoke
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="no-keys-message">
                          <p>
                            No API keys found. Generate a key to access the API.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )} -->
