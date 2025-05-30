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
  Grid,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { supabase } from "../../lib/supabase";
import dayjs from "dayjs";

const AppointmentDetails = ({ appointment, onClose, centerCode }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [appointmentDetails, setAppointmentDetails] = useState(null);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    if (appointment && appointment.id) {
      loadAppointmentData();
    }
    // eslint-disable-next-line
  }, [appointment]);

  const loadAppointmentData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch appointment details from Supabase
      const { data, error: apptError } = await supabase
        .from("zenoti_appointments")
        .select("*")
        .eq("id", appointment.id)
        .single();
      if (apptError) throw apptError;
      setAppointmentDetails(data);
    } catch (err) {
      setError(err.message || "Failed to load appointment details");
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (_, newValue) => setTab(newValue);

  if (loading)
    return (
      <Dialog open onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>Loading Appointment Details...</DialogTitle>
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
  if (!appointmentDetails) return null;

  // Helper to format date/time
  const formatDate = (dt) => (dt ? dayjs(dt).format("YYYY-MM-DD HH:mm") : "—");

  // All fields from zenoti_appointments
  const fields = [
    { label: "Appointment ID", value: appointmentDetails.appointment_id },
    { label: "Guest Name", value: appointmentDetails.guest_name },
    { label: "Center Code", value: appointmentDetails.center_code },
    { label: "Service ID", value: appointmentDetails.service_id },
    { label: "Service Name", value: appointmentDetails.service_name },
    { label: "Therapist ID", value: appointmentDetails.therapist_id },
    { label: "Therapist Name", value: appointmentDetails.therapist_name },
    { label: "Start Time", value: formatDate(appointmentDetails.start_time) },
    { label: "End Time", value: formatDate(appointmentDetails.end_time) },
    { label: "Status", value: appointmentDetails.status },
    { label: "Last Synced", value: formatDate(appointmentDetails.last_synced) },
    {
      label: "Actual Start Time",
      value: formatDate(appointmentDetails.actual_start_time),
    },
    {
      label: "Actual Completed Time",
      value: formatDate(appointmentDetails.actual_completed_time),
    },
    {
      label: "Checkin Time",
      value: formatDate(appointmentDetails.checkin_time),
    },
    { label: "Center ID", value: appointmentDetails.center_id },
    {
      label: "Appointment Group ID",
      value: appointmentDetails.appointment_group_id,
    },
    { label: "Invoice ID", value: appointmentDetails.invoice_id },
    { label: "Price", value: appointmentDetails.price },
    { label: "Updated At", value: formatDate(appointmentDetails.updated_at) },
    { label: "Notes", value: appointmentDetails.notes },
  ];

  // Tabs: Details, Service, Guest, Therapist, Raw JSON
  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Appointment Details</DialogTitle>
      <DialogContent>
        <Tabs value={tab} onChange={handleTabChange} sx={{ mb: 2 }}>
          <Tab label="Details" />
          <Tab label="Service" />
          <Tab label="Guest" />
          <Tab label="Therapist" />
          <Tab label="Raw JSON" />
        </Tabs>
        {tab === 0 && (
          <Box>
            <Grid container spacing={2}>
              {fields.map((f) => (
                <Grid item xs={6} key={f.label}>
                  <Typography variant="subtitle2">{f.label}</Typography>
                  <Typography>{f.value || "—"}</Typography>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}
        {tab === 1 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Service Info
            </Typography>
            <pre style={{ background: "#f5f5f5", padding: 8, borderRadius: 4 }}>
              {JSON.stringify(appointmentDetails.service, null, 2)}
            </pre>
          </Box>
        )}
        {tab === 2 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Guest Info
            </Typography>
            <pre style={{ background: "#f5f5f5", padding: 8, borderRadius: 4 }}>
              {JSON.stringify(appointmentDetails.guest, null, 2)}
            </pre>
          </Box>
        )}
        {tab === 3 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Therapist Info
            </Typography>
            <pre style={{ background: "#f5f5f5", padding: 8, borderRadius: 4 }}>
              {JSON.stringify(appointmentDetails.therapist, null, 2)}
            </pre>
          </Box>
        )}
        {tab === 4 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Raw Appointment JSON
            </Typography>
            <pre
              style={{
                background: "#f5f5f5",
                padding: 8,
                borderRadius: 4,
                maxHeight: 300,
                overflow: "auto",
              }}
            >
              {JSON.stringify(appointmentDetails, null, 2)}
            </pre>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default AppointmentDetails;
