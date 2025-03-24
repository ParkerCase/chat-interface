import React, { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Spinner,
} from "../../ui/index.js";
import { RefreshCw, CheckCircle, AlertTriangle, Settings } from "lucide-react";
import zenotiService from "../../services/zenotiService";

const ZenotiStatus = ({ onConfigureClick }) => {
  const [status, setStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const checkStatus = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await zenotiService.checkConnectionStatus();

      if (response.data.success) {
        setStatus(response.data);
      } else {
        setError("Failed to get Zenoti status");
      }
    } catch (err) {
      setError("Error checking Zenoti connection");
      console.error("Zenoti status check error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Zenoti Connection Status</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={checkStatus}
          disabled={isLoading}
        >
          {isLoading ? <Spinner size="sm" /> : <RefreshCw size={16} />}
        </Button>
      </CardHeader>

      <CardContent>
        {isLoading && !status ? (
          <div className="flex items-center justify-center p-4">
            <Spinner size="md" />
            <span className="ml-2">Checking Zenoti connection...</span>
          </div>
        ) : error ? (
          <div className="text-red-500 flex items-center">
            <AlertTriangle className="mr-2" size={16} />
            {error}
          </div>
        ) : status ? (
          <div className="space-y-4">
            <div className="flex items-center">
              <span className="mr-2">Status:</span>
              {status.status === "connected" ? (
                <Badge variant="success" className="flex items-center">
                  <CheckCircle size={12} className="mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="destructive" className="flex items-center">
                  <AlertTriangle size={12} className="mr-1" />
                  Disconnected
                </Badge>
              )}
            </div>

            {status.details && (
              <div className="text-sm space-y-2">
                <p>
                  <strong>API URL:</strong>{" "}
                  {status.details.apiUrl || "Not configured"}
                </p>
                {status.details.lastSync && (
                  <p>
                    <strong>Last Synced:</strong>{" "}
                    {new Date(status.details.lastSync).toLocaleString()}
                  </p>
                )}
                {status.details.error && (
                  <p className="text-red-500">
                    <strong>Error:</strong> {status.details.error}
                  </p>
                )}
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={onConfigureClick}
            >
              <Settings size={14} className="mr-2" />
              Configure Connection
            </Button>
          </div>
        ) : (
          <div className="text-amber-500 flex items-center">
            <AlertTriangle className="mr-2" size={16} />
            No status information available
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ZenotiStatus;
