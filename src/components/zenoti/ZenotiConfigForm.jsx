import React, { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Button,
  Input,
  Label,
  Alert,
  Spinner,
  Select,
} from "../../ui/index.js";
import { RefreshCw, Save, Lock, Unlock, Info } from "lucide-react";
import apiService from "../../services/apiService";
import zenotiService from "../../services/zenotiService";

const ZenotiConfigForm = ({ onSuccess, onCancel }) => {
  const [config, setConfig] = useState({
    apiUrl: "https://api.zenoti.com/v1",
    apiKey: "fbc6eda6b8274b218b1bc3f036ccf76af182d536cb0e4952bc693b8df19018b5",
    username: "parker@tatt2away.com",
    password: "January_0119!",
    defaultCenterCode: "AUS", // Choose one of your center codes
    useOAuth: true, // Set to true to use username/password authentication
    refreshRate: "daily",
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [centers, setCenters] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);

  useEffect(() => {
    // Load current configuration
    const loadConfig = async () => {
      try {
        setIsLoading(true);

        // Try to get existing configuration
        const response = await apiService.zenoti.checkConnectionStatus();

        if (response.data && response.data.success && response.data.details) {
          setConfig({
            apiUrl: response.data.details.apiUrl || "",
            apiKey: response.data.details.apiKey ? "••••••••••••••••" : "",
            username: response.data.details.username || "",
            password: response.data.details.password ? "••••••••••••••••" : "",
            defaultCenterCode: response.data.details.defaultCenterCode || "",
            useOAuth: response.data.details.useOAuth || false,
            refreshRate: response.data.details.refreshRate || "daily",
          });

          // If connected, try to get centers
          if (response.data.status === "connected") {
            loadCenters();
          }
        }
      } catch (error) {
        console.error("Error loading Zenoti configuration:", error);
        setError(
          "Failed to load current configuration. Please enter new details."
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, []);

  // In your frontend, add a debug page with:
  const testDirectZenotiConnection = async () => {
    try {
      // Try direct API call with different auth methods
      const testConfig = {
        appId: "A34B1BC5-E598-4187-B2D9-0C37451EC58E",
        apiKey:
          "fbc6eda6b8274b218b1bc3f036ccf76af182d536cb0e4952bc693b8df19018b5",
        apiSecret:
          "dfbc618cb2fb4173889537c475f79671607f85f855874db0808fa8cb29e3871e",
        // Test different auth methods by setting a type
        authMethod: "headers", // or "body" or "signature"
      };

      const response = await apiService.zenoti.testDirectAuth(testConfig);
      console.log("Auth result:", response);
    } catch (error) {
      console.error("Direct auth test failed:", error);
    }
  };

  console.log(testDirectZenotiConnection);

  const loadCenters = async () => {
    try {
      const response = await zenotiService.getCenters();

      if (response.data && response.data.success) {
        setCenters(response.data.centers || []);
      }
    } catch (error) {
      console.error("Error loading Zenoti centers:", error);
      // Don't set error here since it's not critical
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setConfig((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleTestConnection = async () => {
    try {
      setIsTestingConnection(true);
      setError(null);
      setSuccess(null);
      setConnectionStatus(null);

      // Make a test config
      const testConfig = {
        apiUrl: config.apiUrl,
        apiKey: config.apiKey === "••••••••••••••••" ? null : config.apiKey,
        username: config.username || "parker@tatt2away.com",
        password:
          config.password === "••••••••••••••••"
            ? "January_0119!"
            : config.password,
        useOAuth: true, // Force OAuth to be true for Zenoti
        defaultCenterCode: config.defaultCenterCode || "AUS",
      };

      // Call API to test connection
      const response = await apiService.zenoti.testConnection(testConfig);

      if (response.data && response.data.success) {
        setConnectionStatus({
          success: true,
          message: "Successfully connected to Zenoti!",
        });

        // If connection successful, load centers
        loadCenters();
      } else {
        setConnectionStatus({
          success: false,
          message: response.data?.error || "Connection test failed.",
        });
      }
    } catch (error) {
      console.error("Error testing Zenoti connection:", error);
      setConnectionStatus({
        success: false,
        message: error.message || "Connection test failed.",
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);

      // Prepare config for submission
      const submitConfig = {
        ...config,
        apiKey: config.apiKey === "••••••••••••••••" ? null : config.apiKey,
        password:
          config.password === "••••••••••••••••" ? null : config.password,
      };

      // Call API to save configuration
      const response = await apiService.zenoti.saveConfiguration(submitConfig);

      if (response.data && response.data.success) {
        setSuccess("Zenoti configuration saved successfully!");

        // Test connection immediately after saving
        try {
          const statusResponse = await zenotiService.checkConnectionStatus();
          // Force refresh component state
          if (statusResponse.data?.success) {
            console.log("Connection verified after saving configuration");
          }
        } catch (err) {
          console.error("Error verifying connection after save:", err);
        }

        if (onSuccess) {
          setTimeout(() => {
            onSuccess(response.data);
          }, 1500);
        }
      } else {
        setError(response.data?.error || "Failed to save configuration");
      }
    } catch (error) {
      console.error("Error saving Zenoti configuration:", error);
      setError(error.message || "Failed to save configuration");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full max-w-xl mx-auto">
        <CardContent className="p-6 text-center">
          <Spinner className="mx-auto mb-4" />
          <p>Loading Zenoti configuration...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-xl mx-auto">
      <CardHeader>
        <CardTitle>Zenoti Integration Configuration</CardTitle>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <Info className="h-4 w-4" />
              <p>{error}</p>
            </Alert>
          )}

          {success && (
            <Alert variant="success">
              <Info className="h-4 w-4" />
              <p>{success}</p>
            </Alert>
          )}

          {connectionStatus && (
            <Alert
              variant={connectionStatus.success ? "success" : "destructive"}
            >
              <Info className="h-4 w-4" />
              <p>{connectionStatus.message}</p>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="apiUrl">Zenoti API URL</Label>
            <Input
              id="apiUrl"
              name="apiUrl"
              value={config.apiUrl}
              onChange={handleChange}
              placeholder="https://api.zenoti.com/v1"
              required
            />
            <p className="text-sm text-gray-500">
              The base URL for Zenoti API (usually https://api.zenoti.com/v1)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              name="apiKey"
              type="password"
              value={config.apiKey}
              onChange={handleChange}
              placeholder="Enter your Zenoti API key"
              required={!config.username || !config.password}
            />
            <p className="text-sm text-gray-500">
              Your Zenoti API key (required for API access)
            </p>
          </div>

          <div className="flex items-center space-x-2 my-4">
            <input
              type="checkbox"
              id="useOAuth"
              name="useOAuth"
              checked={config.useOAuth}
              onChange={handleChange}
              className="h-4 w-4"
            />
            <Label htmlFor="useOAuth" className="mb-0">
              Use Username/Password Authentication (OAuth)
            </Label>
          </div>

          {config.useOAuth && (
            <>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  name="username"
                  value={config.username}
                  onChange={handleChange}
                  placeholder="Enter your Zenoti username"
                  required={config.useOAuth}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={config.password}
                    onChange={handleChange}
                    placeholder="Enter your Zenoti password"
                    required={config.useOAuth}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <Lock className="h-4 w-4 text-gray-500" />
                    ) : (
                      <Unlock className="h-4 w-4 text-gray-500" />
                    )}
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="defaultCenterCode">Default Center</Label>
            <Select
              id="defaultCenterCode"
              name="defaultCenterCode"
              value={config.defaultCenterCode}
              onChange={handleChange}
            >
              <option value="">-- Select a default center --</option>
              {centers.map((center) => (
                <option key={center.code} value={center.code}>
                  {center.name} ({center.code})
                </option>
              ))}
            </Select>
            <p className="text-sm text-gray-500">
              Select a default center for Zenoti operations
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="refreshRate">Data Refresh Rate</Label>
            <Select
              id="refreshRate"
              name="refreshRate"
              value={config.refreshRate}
              onChange={handleChange}
            >
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="manual">Manual Only</option>
            </Select>
            <p className="text-sm text-gray-500">
              How often to sync data from Zenoti
            </p>
          </div>

          <div className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleTestConnection}
              disabled={
                isTestingConnection ||
                !config.apiUrl ||
                (!config.apiKey && !config.useOAuth) ||
                (config.useOAuth && (!config.username || !config.password))
              }
              className="w-full"
            >
              {isTestingConnection ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Testing Connection...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Test Connection
                </>
              )}
            </Button>
          </div>
        </CardContent>

        <CardFooter className="flex justify-between space-x-4 border-t px-6 py-4">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSaving}
            >
              Cancel
            </Button>
          )}

          <Button
            type="submit"
            disabled={isSaving || isTestingConnection}
            className="flex-1"
          >
            {isSaving ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Configuration
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

export default ZenotiConfigForm;
