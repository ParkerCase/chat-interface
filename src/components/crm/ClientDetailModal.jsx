import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Typography,
  Box,
  Button,
  CircularProgress,
  Alert,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { supabase } from "../../lib/supabase";
import dayjs from "dayjs";

const ClientDetailModal = ({ client, onClose, centerCode }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [clientDetails, setClientDetails] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [purchaseHistory, setPurchaseHistory] = useState([]);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    if (client && client.id) {
      loadClientData();
    }
    // eslint-disable-next-line
  }, [client]);

  const loadClientData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch client details
      const { data: clientData, error: clientError } = await supabase
        .from("zenoti_clients")
        .select("*")
        .eq("id", client.id)
        .single();
      if (clientError) throw clientError;
      setClientDetails(clientData);

      // Fetch appointments for this client
      const { data: appts, error: apptError } = await supabase
        .from("zenoti_appointments")
        .select("*")
        .eq("guest->>id", client.id)
        .order("start_time", { ascending: false })
        .limit(50);
      setAppointments(appts || []);
      // Fetch purchase history (from cash sales reports, as example)
      const { data: purchases, error: purchaseError } = await supabase
        .from("zenoti_sales_cash_reports")
        .select("*")
        .contains("details->clients", [client.id])
        .order("report_date", { ascending: false })
        .limit(50);
      setPurchaseHistory(purchases || []);
    } catch (err) {
      setError(err.message || "Failed to load client details");
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (_, newValue) => setTab(newValue);

  if (loading)
    return (
      <Dialog open onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>Loading Client Details...</DialogTitle>
        <DialogContent
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: 200,
          }}
        >
          <CircularProgress />
        </DialogContent>
      </Dialog>
    );
  if (error)
    return (
      <Dialog open onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>Error</DialogTitle>
        <DialogContent>
          <Alert severity="error">{error}</Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  if (!clientDetails) return null;
  const personalInfo =
    clientDetails.details?.personal_info || clientDetails.details || {};
  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {personalInfo.first_name} {personalInfo.last_name}
      </DialogTitle>
      <DialogContent>
        <Tabs value={tab} onChange={handleTabChange} sx={{ mb: 2 }}>
          <Tab label="Details" />
          <Tab label="Appointments" />
          <Tab label="Purchase History" />
        </Tabs>
        {tab === 0 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Contact Information
            </Typography>
            <Typography>Email: {personalInfo.email || "—"}</Typography>
            <Typography>
              Phone:{" "}
              {personalInfo.mobile ||
                personalInfo.mobile_phone?.number ||
                personalInfo.phone ||
                "—"}
            </Typography>
            <Typography>
              Date of Birth:{" "}
              {personalInfo.date_of_birth
                ? dayjs(personalInfo.date_of_birth).format("YYYY-MM-DD")
                : "—"}
            </Typography>
            <Typography>Gender: {personalInfo.gender || "—"}</Typography>
            <Typography mt={2} variant="h6">
              Address
            </Typography>
            <Typography>
              {personalInfo.address || ""} {personalInfo.city || ""}{" "}
              {personalInfo.state || ""}{" "}
              {personalInfo.postal_code || personalInfo.zip || ""}{" "}
              {personalInfo.country || ""}
            </Typography>
            <Typography mt={2} variant="h6">
              Preferences
            </Typography>
            {clientDetails.details?.preferences &&
              Object.entries(clientDetails.details.preferences).map(
                ([k, v]) => (
                  <Typography key={k}>
                    {k}:{" "}
                    {typeof v === "boolean" ? (v ? "Yes" : "No") : String(v)}
                  </Typography>
                )
              )}
            <Typography mt={2} variant="h6">
              Notes
            </Typography>
            <Typography>{clientDetails.details?.notes || "—"}</Typography>
            <Typography mt={2} variant="h6">
              Account Information
            </Typography>
            <Typography>
              Customer Since:{" "}
              {clientDetails.details?.created_date
                ? dayjs(clientDetails.details.created_date).format("YYYY-MM-DD")
                : "—"}
            </Typography>
            <Typography>
              Last Visit:{" "}
              {clientDetails.details?.last_visit_date
                ? dayjs(clientDetails.details.last_visit_date).format(
                    "YYYY-MM-DD"
                  )
                : "—"}
            </Typography>
            {clientDetails.details?.memberships && (
              <Typography>
                Memberships:{" "}
                {clientDetails.details.memberships
                  .map((m) => m.name)
                  .join(", ")}
              </Typography>
            )}
            <Typography mt={2} variant="h6">
              Raw Data
            </Typography>
            <pre
              style={{
                background: "#f5f5f5",
                padding: 8,
                borderRadius: 4,
                maxHeight: 200,
                overflow: "auto",
              }}
            >
              {JSON.stringify(clientDetails, null, 2)}
            </pre>
          </Box>
        )}
        {tab === 1 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Appointments
            </Typography>
            <DataGrid
              autoHeight
              rows={appointments.map((a, i) => ({ id: a.id || i, ...a }))}
              columns={[
                {
                  field: "start_time",
                  headerName: "Start Time",
                  width: 160,
                  valueFormatter: ({ value }) =>
                    value ? dayjs(value).format("YYYY-MM-DD HH:mm") : "",
                },
                { field: "service_name", headerName: "Service", width: 180 },
                {
                  field: "therapist_name",
                  headerName: "Therapist",
                  width: 140,
                },
                { field: "status", headerName: "Status", width: 100 },
                { field: "center_code", headerName: "Center", width: 100 },
              ]}
              pageSize={5}
              rowsPerPageOptions={[5, 10, 20]}
            />
          </Box>
        )}
        {tab === 2 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Purchase History (Raw)
            </Typography>
            <DataGrid
              autoHeight
              rows={purchaseHistory.map((p, i) => ({ id: p.id || i, ...p }))}
              columns={[
                {
                  field: "report_date",
                  headerName: "Date",
                  width: 140,
                  valueFormatter: ({ value }) =>
                    value ? dayjs(value).format("YYYY-MM-DD") : "",
                },
                {
                  field: "details",
                  headerName: "Details",
                  width: 400,
                  renderCell: ({ value }) => (
                    <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>
                      {JSON.stringify(value, null, 1)}
                    </pre>
                  ),
                },
              ]}
              pageSize={5}
              rowsPerPageOptions={[5, 10, 20]}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ClientDetailModal;
