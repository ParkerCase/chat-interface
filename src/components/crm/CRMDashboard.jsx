import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import ZenotiServicesSection from "../zenoti/ZenotiServicesSection";
import ZenotiPackagesSection from "../zenoti/ZenotiPackagesSection";
import CRMAnalyticsDashboard from "./CRMAnalyticsDashboard";
import ClientDetailModal from "./ClientDetailModal";
import AppointmentDetails from "./AppointmentDetails";
import "./CRMDashboard.css";
import { DataGrid } from "@mui/x-data-grid";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
  Alert,
  Box,
} from "@mui/material";

const CRMDashboard = ({ onClose, onRefresh, centers = [] }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [contacts, setContacts] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [services, setServices] = useState([]);
  const [packages, setPackages] = useState([]);
  const [activeSection, setActiveSection] = useState("contacts");
  const [selectedCenter, setSelectedCenter] = useState(
    centers[0]?.center_code || ""
  );
  const [selectedContact, setSelectedContact] = useState(null);
  const [showContactDetails, setShowContactDetails] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showAppointmentDetails, setShowAppointmentDetails] = useState(false);
  const [showRawContact, setShowRawContact] = useState(null);
  const [debugLogs, setDebugLogs] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [packagesLoading, setPackagesLoading] = useState(false);

  // Center code ↔ id mapping
  const centerCodeToId = {
    AUS: "56081b99-7e03-46de-b589-3f60cbd90556",
    CHI: "dc196a75-018b-43a2-9c27-9f7b1cc8207f",
    CW: "982982ea-50ce-483f-a4e9-a8e5a76b4725",
    Draper: "7110ab1d-5f3d-44b6-90ec-358029263a6a",
    HTN: "d406abe6-6118-4d52-9794-546729918f52",
    Houston: "90aa9708-4678-4c04-999e-63e4aff12f40",
  };
  const centerIdToCode = Object.fromEntries(
    Object.entries(centerCodeToId).map(([code, id]) => [id, code])
  );

  // Logging utility
  const logDebug = (msg, data) => {
    setDebugLogs((logs) => [
      { timestamp: new Date().toISOString(), msg, data },
      ...logs.slice(0, 49),
    ]);
    if (process.env.NODE_ENV === "development") {
      console.debug("[CRM DEBUG]", msg, data);
    }
  };

  // Fetch contacts from Supabase
  const fetchContacts = async () => {
    setContactsLoading(true);
    logDebug("Fetching contacts", { selectedCenter });
    let query = supabase.from("zenoti_clients").select("*", { count: "exact" });
    const { data, error } = await query.limit(1000);
    if (error) {
      logDebug("Contacts query error", { error, selectedCenter });
      setContacts([]);
    } else if (!data || data.length === 0) {
      logDebug("Contacts query returned empty", { selectedCenter });
      setContacts([]);
    } else {
      let contacts = data.map((row) => ({ ...row.details, ...row }));
      // Filter in JS
      let filtered = contacts;
      if (selectedCenter && selectedCenter !== "ALL") {
        filtered = contacts.filter(
          (c) => c.center_id === centerCodeToId[selectedCenter]
        );
        logDebug("Contacts filtered in JS", {
          selectedCenter,
          count: filtered.length,
        });
      }
      filtered.sort((a, b) => {
        const aDate = a.last_visit_date || a.last_modified_date || "";
        const bDate = b.last_visit_date || b.last_modified_date || "";
        return new Date(bDate) - new Date(aDate);
      });
      logDebug("Contacts first 5 rows after flattening", filtered.slice(0, 5));
      setContacts(filtered.slice(0, 10)); // Only top 10
      logDebug("Contacts loaded (top 10)", {
        count: filtered.slice(0, 10).length,
      });
    }
    setContactsLoading(false);
  };

  // Fetch appointments from Supabase
  const fetchAppointments = async () => {
    setAppointmentsLoading(true);
    logDebug("Fetching appointments", { selectedCenter });
    let query = supabase.from("zenoti_appointments").select("*");
    const { data, error } = await query
      .order("start_time", { ascending: false })
      .limit(100);
    if (error) {
      logDebug("Appointments query error", { error, selectedCenter });
      setAppointments([]);
    } else if (!data || data.length === 0) {
      logDebug("Appointments query returned empty", { selectedCenter });
      setAppointments([]);
    } else {
      let filtered = data;
      if (selectedCenter && selectedCenter !== "ALL") {
        filtered = data.filter(
          (a) => a.center_id === centerCodeToId[selectedCenter]
        );
        logDebug("Appointments filtered in JS", {
          selectedCenter,
          count: filtered.length,
        });
      }
      logDebug(
        "Appointments first 5 rows after flattening",
        filtered.slice(0, 5)
      );
      setAppointments(filtered);
      logDebug("Appointments loaded", { count: filtered.length });
    }
    setAppointmentsLoading(false);
  };

  // Fetch services from Supabase
  const fetchServices = async () => {
    setServicesLoading(true);
    logDebug("Fetching services", { selectedCenter });
    const { data, error } = await supabase
      .from("zenoti_services")
      .select("*", { count: "exact" });
    if (error) {
      logDebug("Services query error", { error, selectedCenter });
      setServices([]);
    } else if (!data || data.length === 0) {
      logDebug("Services query returned empty", { selectedCenter });
      setServices([]);
    } else {
      let services = data.map((row) => ({
        ...(row.details && typeof row.details === "object" ? row.details : {}),
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
      logDebug("Services first 5 rows after flattening", filtered.slice(0, 5));
      setServices(filtered);
      logDebug("Services loaded", { count: filtered.length });
    }
    setServicesLoading(false);
  };

  // Fetch packages from Supabase
  const fetchPackages = async () => {
    setPackagesLoading(true);
    logDebug("Fetching packages", { selectedCenter });
    const { data, error } = await supabase
      .from("zenoti_packages")
      .select("*", { count: "exact" });
    if (error) {
      logDebug("Packages query error", { error, selectedCenter });
      setPackages([]);
    } else if (!data || data.length === 0) {
      logDebug("Packages query returned empty", { selectedCenter });
      setPackages([]);
    } else {
      let packages = data.map((row) => ({
        ...(row.details && typeof row.details === "object" ? row.details : {}),
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
      logDebug("Packages first 5 rows after flattening", filtered.slice(0, 5));
      setPackages(filtered);
      logDebug("Packages loaded", { count: filtered.length });
    }
    setPackagesLoading(false);
  };

  // Load all data on mount or when center changes
  useEffect(() => {
    if (activeSection === "contacts") fetchContacts();
    if (activeSection === "appointments") fetchAppointments();
    if (activeSection === "services") fetchServices();
    if (activeSection === "packages") fetchPackages();
  }, [selectedCenter, activeSection]);

  // Handle contact selection
  const handleSelectContact = (contact) => {
    setSelectedContact(contact);
    setShowContactDetails(true);
  };

  // Handle appointment selection
  const handleSelectAppointment = (appointment) => {
    setSelectedAppointment(appointment);
    setShowAppointmentDetails(true);
  };

  // Handle center change
  const handleCenterChange = (e) => {
    setSelectedCenter(e.target.value);
  };

  // Improved contact columns for MUI DataGrid with robust null checks
  const contactColumns = [
    {
      field: "name",
      headerName: "Name",
      width: 180,
      valueGetter: (params) =>
        params?.row?.personal_info?.first_name +
          " " +
          (params?.row?.personal_info?.last_name || "") ||
        params?.row?.personal_info?.first_name ||
        params?.row?.name ||
        "",
    },
    {
      field: "email",
      headerName: "Email",
      width: 220,
      valueGetter: (params) =>
        params?.row?.personal_info?.email || params?.row?.email || "",
    },
    {
      field: "phone",
      headerName: "Phone",
      width: 160,
      valueGetter: (params) =>
        params?.row?.personal_info?.mobile_phone?.number ||
        params?.row?.mobile ||
        "",
    },
    { field: "last_visit_date", headerName: "Last Contact", width: 160 },
    {
      field: "center_id",
      headerName: "Center",
      width: 120,
      valueGetter: (params) =>
        centerIdToCode[params?.row?.center_id] || params?.row?.center_id,
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 120,
      renderCell: (params) => (
        <Button size="small" onClick={() => handleSelectContact(params?.row)}>
          View
        </Button>
      ),
    },
  ];

  // Improved appointment columns for MUI DataGrid
  const appointmentColumns = [
    {
      field: "guest_name",
      headerName: "Guest",
      width: 180,
      valueGetter: (params) =>
        params?.row?.guest_name ||
        params?.row?.details?.guest_name ||
        params?.row?.guest?.name ||
        "",
    },
    {
      field: "service_name",
      headerName: "Service",
      width: 180,
      valueGetter: (params) =>
        params?.row?.service_name ||
        params?.row?.details?.service_name ||
        params?.row?.service?.name ||
        "",
    },
    {
      field: "therapist_name",
      headerName: "Therapist",
      width: 160,
      valueGetter: (params) =>
        params?.row?.therapist_name ||
        params?.row?.details?.serviced_by ||
        params?.row?.therapist?.name ||
        "",
    },
    { field: "start_time", headerName: "Start Time", width: 180 },
    { field: "end_time", headerName: "End Time", width: 180 },
    { field: "status", headerName: "Status", width: 120 },
    {
      field: "invoice_no",
      headerName: "Invoice #",
      width: 120,
      valueGetter: (params) =>
        params?.row?.details?.invoice_no || params?.row?.invoice_no || "",
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 120,
      renderCell: (params) => (
        <Button
          size="small"
          onClick={() => handleSelectAppointment(params?.row)}
        >
          View
        </Button>
      ),
    },
  ];

  // Improved contact modal UI with robust null checks
  const ContactDetailModal = ({ contact, onClose }) => {
    if (!contact) return null;
    const personal = contact.personal_info || {};
    return (
      <Dialog open={!!contact} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>Contact Details</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
            <Box sx={{ minWidth: 200 }}>
              <b>Name:</b> {personal.first_name || ""}{" "}
              {personal.last_name || ""}
            </Box>
            <Box sx={{ minWidth: 200 }}>
              <b>Email:</b> {personal.email || contact.email || ""}
            </Box>
            <Box sx={{ minWidth: 200 }}>
              <b>Phone:</b>{" "}
              {personal.mobile_phone?.number || contact.mobile || ""}
            </Box>
            <Box sx={{ minWidth: 200 }}>
              <b>Center:</b>{" "}
              {centerIdToCode[contact.center_id] || contact.center_id}
            </Box>
            <Box sx={{ minWidth: 200 }}>
              <b>Last Contact:</b> {contact.last_visit_date || ""}
            </Box>
          </Box>
          <Box sx={{ mt: 2 }}>
            <b>Raw JSON:</b>
            <pre
              style={{
                background: "#f5f5f5",
                padding: 8,
                borderRadius: 4,
                maxHeight: 300,
                overflow: "auto",
              }}
            >
              {JSON.stringify(contact, null, 2)}
            </pre>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  };

  // Improved appointment modal UI
  const AppointmentDetailModal = ({ appointment, onClose }) => (
    <Dialog open={!!appointment} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Appointment Details</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
          <Box sx={{ minWidth: 200 }}>
            <b>Guest:</b>{" "}
            {appointment.guest_name ||
              appointment.details?.guest_name ||
              appointment.guest?.name}
          </Box>
          <Box sx={{ minWidth: 200 }}>
            <b>Service:</b>{" "}
            {appointment.service_name ||
              appointment.details?.service_name ||
              appointment.service?.name}
          </Box>
          <Box sx={{ minWidth: 200 }}>
            <b>Therapist:</b>{" "}
            {appointment.therapist_name ||
              appointment.details?.serviced_by ||
              appointment.therapist?.name}
          </Box>
          <Box sx={{ minWidth: 200 }}>
            <b>Start Time:</b> {appointment.start_time}
          </Box>
          <Box sx={{ minWidth: 200 }}>
            <b>End Time:</b> {appointment.end_time}
          </Box>
          <Box sx={{ minWidth: 200 }}>
            <b>Status:</b> {appointment.status}
          </Box>
          <Box sx={{ minWidth: 200 }}>
            <b>Invoice #:</b>{" "}
            {appointment.details?.invoice_no || appointment.invoice_no}
          </Box>
        </Box>
        <Box sx={{ mt: 2 }}>
          <b>Raw JSON:</b>
          <pre
            style={{
              background: "#f5f5f5",
              padding: 8,
              borderRadius: 4,
              maxHeight: 300,
              overflow: "auto",
            }}
          >
            {JSON.stringify(appointment, null, 2)}
          </pre>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <div className="crm-dashboard">
      <div className="crm-content">
        <div className="crm-sidebar">
          <div className="sidebar-header">
            <h3>CRM Navigation</h3>
          </div>
          <div className="sidebar-nav">
            <button
              className={activeSection === "contacts" ? "active" : ""}
              onClick={() => setActiveSection("contacts")}
            >
              Contacts
            </button>
            <button
              className={activeSection === "appointments" ? "active" : ""}
              onClick={() => setActiveSection("appointments")}
            >
              Appointments
            </button>
            <button
              className={activeSection === "services" ? "active" : ""}
              onClick={() => setActiveSection("services")}
            >
              Services
            </button>
            <button
              className={activeSection === "packages" ? "active" : ""}
              onClick={() => setActiveSection("packages")}
            >
              Packages
            </button>
            <button
              className={activeSection === "analytics" ? "active" : ""}
              onClick={() => setActiveSection("analytics")}
            >
              Analytics
            </button>
          </div>
          {centers.length > 0 && (
            <div className="center-selector">
              <h3>Zenoti Center</h3>
              <select value={selectedCenter} onChange={handleCenterChange}>
                <option value="ALL">All Centers</option>
                {centers.map((center) => (
                  <option key={center.center_code} value={center.center_code}>
                    {center.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="crm-main-content">
          {activeSection === "contacts" && (
            <div>
              <h2>Contacts</h2>
              {contactsLoading ? (
                <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
                  <CircularProgress />
                </Box>
              ) : contacts.length === 0 ? (
                <Alert severity="info">No contacts found.</Alert>
              ) : (
                <DataGrid
                  autoHeight
                  rows={contacts
                    .filter(Boolean)
                    .map((c, i) => ({ id: c.id || i, ...c }))}
                  columns={contactColumns}
                  pageSize={10}
                  rowsPerPageOptions={[10, 20, 50]}
                  sx={{
                    maxWidth: "100%",
                    wordBreak: "break-word",
                    whiteSpace: "normal",
                  }}
                />
              )}
              <ContactDetailModal
                contact={selectedContact}
                onClose={() => setShowContactDetails(false)}
              />
            </div>
          )}
          {activeSection === "appointments" && (
            <div>
              <h2>Appointments (Read Only)</h2>
              {appointmentsLoading ? (
                <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
                  <CircularProgress />
                </Box>
              ) : appointments.length === 0 ? (
                <Alert severity="info">No appointments found.</Alert>
              ) : (
                <DataGrid
                  autoHeight
                  rows={appointments
                    .filter(Boolean)
                    .map((a, i) => ({ id: a.id || i, ...a }))}
                  columns={appointmentColumns}
                  pageSize={10}
                  rowsPerPageOptions={[10, 20, 50]}
                  sx={{
                    maxWidth: "100%",
                    wordBreak: "break-word",
                    whiteSpace: "normal",
                  }}
                />
              )}
              <AppointmentDetailModal
                appointment={selectedAppointment}
                onClose={() => setShowAppointmentDetails(false)}
              />
            </div>
          )}
          {activeSection === "services" && (
            <ZenotiServicesSection
              selectedCenter={selectedCenter}
              centerCodeToId={centerCodeToId}
              centerIdToCode={centerIdToCode}
              connectionStatus={{ connected: true }}
              onRefresh={fetchServices}
            />
          )}
          {activeSection === "packages" && (
            <ZenotiPackagesSection
              selectedCenter={selectedCenter}
              centerCodeToId={centerCodeToId}
              centerIdToCode={centerIdToCode}
              connectionStatus={{ connected: true }}
              onRefresh={fetchPackages}
            />
          )}
          {activeSection === "analytics" && (
            <CRMAnalyticsDashboard
              selectedCenter={selectedCenter}
              connectionStatus={{ connected: true }}
              onRefresh={() => {}}
            />
          )}
        </div>
      </div>
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
    </div>
  );
};

export default CRMDashboard;
