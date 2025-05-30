import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { DataGrid } from "@mui/x-data-grid";
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";

const columns = [
  { field: "name", headerName: "Name", width: 180 },
  { field: "code", headerName: "Code", width: 120 },
  { field: "description", headerName: "Description", width: 220 },
  { field: "category", headerName: "Category", width: 140 },
  { field: "duration", headerName: "Duration", width: 100 },
  { field: "price", headerName: "Price", width: 100 },
  { field: "center_id", headerName: "Center ID", width: 180 },
  { field: "booking_start_date", headerName: "Start Date", width: 120 },
  { field: "booking_end_date", headerName: "End Date", width: 120 },
  // Add more fields as needed
];

const ZenotiServicesSection = ({
  selectedCenter,
  centerCodeToId,
  centerIdToCode,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [debugLogs, setDebugLogs] = useState([]);

  const logDebug = (msg, data) => {
    setDebugLogs((logs) => [
      { timestamp: new Date().toISOString(), msg, data },
      ...logs.slice(0, 49),
    ]);
    if (process.env.NODE_ENV === "development") {
      console.debug("[Services DEBUG]", msg, data);
    }
  };

  useEffect(() => {
    const fetchServices = async () => {
      setIsLoading(true);
      setError(null);
      logDebug("Fetching services", { selectedCenter });
      let query = supabase
        .from("zenoti_services")
        .select("*", { count: "exact" });
      const { data, error } = await query;
      if (error) {
        setServices([]);
        setError(error?.message || "Failed to load services");
        logDebug("Service fetch error", { error });
      } else if (!data || data.length === 0) {
        setServices([]);
        setError("No services found");
        logDebug("Service fetch returned empty", {});
      } else {
        let services = data.map((row) => ({
          ...(row.details && typeof row.details === "object"
            ? row.details
            : {}),
          ...row,
        }));
        // Filter in JS
        let filtered = services;
        if (selectedCenter && selectedCenter !== "ALL") {
          filtered = services.filter(
            (s) => s.center_id === centerCodeToId[selectedCenter]
          );
          logDebug("Services filtered in JS", {
            selectedCenter,
            count: filtered.length,
          });
        }
        logDebug(
          "Services first 5 rows after flattening",
          filtered.slice(0, 5)
        );
        setServices(filtered);
        logDebug("Services loaded", { count: filtered.length });
      }
      setIsLoading(false);
    };
    fetchServices();
  }, [selectedCenter, centerCodeToId, centerIdToCode]);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom>
        Services (Read Only)
      </Typography>
      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <DataGrid
          autoHeight
          rows={services.map((s, i) => ({ id: s.id || i, ...s }))}
          columns={columns}
          pageSize={10}
          rowsPerPageOptions={[10, 20, 50]}
          onRowClick={({ row }) => setSelectedService(row)}
        />
      )}
      {/* Raw JSON Modal */}
      <Dialog
        open={!!selectedService}
        onClose={() => setSelectedService(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Service Raw JSON</DialogTitle>
        <DialogContent>
          <pre
            style={{
              background: "#f5f5f5",
              padding: 8,
              borderRadius: 4,
              maxHeight: 400,
              overflow: "auto",
            }}
          >
            {selectedService && JSON.stringify(selectedService, null, 2)}
          </pre>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedService(null)}>Close</Button>
        </DialogActions>
      </Dialog>
      {/* Debug log UI */}
      <Box
        sx={{
          mt: 4,
          bgcolor: "#222",
          color: "#fff",
          p: 2,
          borderRadius: 2,
          fontSize: 12,
          maxHeight: 200,
          overflow: "auto",
        }}
      >
        <b>Debug Logs</b>
        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {debugLogs.map((log, i) => (
            <li key={i} style={{ marginBottom: 4 }}>
              <span style={{ color: "#aaa" }}>{log.timestamp}</span> -{" "}
              <b>{log.msg}</b>
              <pre style={{ margin: 0, color: "#8ff" }}>
                {JSON.stringify(log.data, null, 2)}
              </pre>
            </li>
          ))}
        </ul>
      </Box>
    </Box>
  );
};

export default ZenotiServicesSection;
