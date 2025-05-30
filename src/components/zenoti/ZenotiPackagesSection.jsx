// src/components/zenoti/ZenotiPackagesSection.jsx
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
  { field: "type", headerName: "Type", width: 100 },
  { field: "price", headerName: "Price", width: 100 },
  { field: "booking_start_date", headerName: "Start Date", width: 120 },
  { field: "booking_end_date", headerName: "End Date", width: 120 },
  { field: "center_id", headerName: "Center ID", width: 180 },
  // Add more fields as needed
];

const ZenotiPackagesSection = ({
  selectedCenter,
  centerCodeToId,
  centerIdToCode,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [packages, setPackages] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [debugLogs, setDebugLogs] = useState([]);

  const logDebug = (msg, data) => {
    setDebugLogs((logs) => [
      { timestamp: new Date().toISOString(), msg, data },
      ...logs.slice(0, 49),
    ]);
    if (process.env.NODE_ENV === "development") {
      console.debug("[Packages DEBUG]", msg, data);
    }
  };

  useEffect(() => {
    const fetchPackages = async () => {
      setIsLoading(true);
      setError(null);
      logDebug("Fetching packages", { selectedCenter });
      let query = supabase
        .from("zenoti_packages")
        .select("*", { count: "exact" });
      const { data, error } = await query;
      if (error) {
        setPackages([]);
        setError(error?.message || "Failed to load packages");
        logDebug("Package fetch error", { error });
      } else if (!data || data.length === 0) {
        setPackages([]);
        setError("No packages found");
        logDebug("Package fetch returned empty", {});
      } else {
        let packages = data.map((row) => ({
          ...(row.details && typeof row.details === "object"
            ? row.details
            : {}),
          ...row,
        }));
        // Filter in JS
        let filtered = packages;
        if (selectedCenter && selectedCenter !== "ALL") {
          filtered = packages.filter(
            (p) => p.center_id === centerCodeToId[selectedCenter]
          );
          logDebug("Packages filtered in JS", {
            selectedCenter,
            count: filtered.length,
          });
        }
        logDebug(
          "Packages first 5 rows after flattening",
          filtered.slice(0, 5)
        );
        setPackages(filtered);
        logDebug("Packages loaded", { count: filtered.length });
      }
      setIsLoading(false);
    };
    fetchPackages();
  }, [selectedCenter, centerCodeToId, centerIdToCode]);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom>
        Packages (Read Only)
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
          rows={packages.map((p, i) => ({ id: p.id || i, ...p }))}
          columns={columns}
          pageSize={10}
          rowsPerPageOptions={[10, 20, 50]}
          onRowClick={({ row }) => setSelectedPackage(row)}
        />
      )}
      {/* Raw JSON Modal */}
      <Dialog
        open={!!selectedPackage}
        onClose={() => setSelectedPackage(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Package Raw JSON</DialogTitle>
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
            {selectedPackage && JSON.stringify(selectedPackage, null, 2)}
          </pre>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedPackage(null)}>Close</Button>
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

export default ZenotiPackagesSection;
