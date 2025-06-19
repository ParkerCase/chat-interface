import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import ZenotiServicesSection from "../zenoti/ZenotiServicesSection";
import ZenotiPackagesSection from "../zenoti/ZenotiPackagesSection";
import CRMAnalyticsDashboard from "./CRMAnalyticsDashboard";
import "./CRMDashboard.css";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
  Alert,
  Box,
  Paper,
  Typography,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  InputAdornment,
} from "@mui/material";
import {
  Search,
  Refresh,
  Person,
  Event,
  Business,
  Analytics,
  Close as CloseIcon,
} from "@mui/icons-material";

function useWindowSize() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return width;
}

const CRMDashboard = ({
  onClose,
  onRefresh,
  centers = [],
  centerMapping = {},
}) => {
  // State management
  const [isLoading, setIsLoading] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [activeSection, setActiveSection] = useState("contacts");
  const [selectedCenter, setSelectedCenter] = useState("ALL");
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [error, setError] = useState(null);

  // Pagination state
  const [contactsPage, setContactsPage] = useState(0);
  const [contactsRowsPerPage, setContactsRowsPerPage] = useState(10);
  const [appointmentsPage, setAppointmentsPage] = useState(0);
  const [appointmentsRowsPerPage, setAppointmentsRowsPerPage] = useState(10);
  const [totalContacts, setTotalContacts] = useState(0);
  const [totalAppointments, setTotalAppointments] = useState(0);

  // Search state
  const [contactsSearch, setContactsSearch] = useState("");
  const [appointmentsSearch, setAppointmentsSearch] = useState("");

  // Memoized center mapping for performance
  const centerCodeToId = useMemo(() => {
    const mapping = {};
    Object.entries(centerMapping).forEach(([key, value]) => {
      if (key.length < 10) {
        // This is a code
        mapping[key] = value;
      }
    });
    return mapping;
  }, [centerMapping]);

  const centerIdToCode = useMemo(() => {
    const mapping = {};
    Object.entries(centerMapping).forEach(([key, value]) => {
      if (key.length > 10) {
        // This is an ID
        mapping[key] = value;
      }
    });
    return mapping;
  }, [centerMapping]);

  // Utility function to safely extract data from details JSON
  const extractFromDetails = useCallback((details, path) => {
    if (!details || typeof details !== "object") return null;

    const pathArray = path.split(".");
    let current = details;

    for (const key of pathArray) {
      if (current && typeof current === "object" && key in current) {
        current = current[key];
      } else {
        return null;
      }
    }

    return current;
  }, []);

  // Fetch contacts with pagination and search
  const fetchContacts = useCallback(async () => {
    if (activeSection !== "contacts") return;

    setIsLoading(true);
    setError(null);

    try {
      console.log("Fetching contacts for center:", selectedCenter);
      console.log("Center mapping:", centerMapping);

      // Build query - we need to fetch enough data to filter properly
      let query = supabase
        .from("zenoti_clients")
        .select("*", { count: "exact" });

      // Apply search filter first
      if (contactsSearch.trim()) {
        const searchTerm = contactsSearch.trim().toLowerCase();
        query = query.or(
          `details->personal_info->>first_name.ilike.%${searchTerm}%,details->personal_info->>last_name.ilike.%${searchTerm}%,details->personal_info->>email.ilike.%${searchTerm}%`
        );
      }

      // For center filtering, we need to fetch ALL data first, then filter in memory
      // because center info is in JSON details
      if (selectedCenter === "ALL") {
        // For "All Centers", use normal pagination
        const from = contactsPage * contactsRowsPerPage;
        const to = from + contactsRowsPerPage - 1;
        query = query.range(from, to);
      } else {
        // For specific centers, filter in the query!
        query = query
          .eq("details->>center_id", selectedCenter)
          .order("last_synced", { ascending: false });
        const from = contactsPage * contactsRowsPerPage;
        const to = from + contactsRowsPerPage - 1;
        query = query.range(from, to);
      }

      // Order by last synced
      query = query.order("last_synced", { ascending: false });

      const { data, error, count } = await query;

      if (error) throw error;

      console.log("Raw contacts data:", data?.length);

      // Process contacts
      let processedContacts = (data || []).map((row) => {
        const details = row.details || {};
        const personalInfo = details.personal_info || {};
        const centerId = details.center_id;

        return {
          id: row.id,
          name:
            `${personalInfo.first_name || ""} ${
              personalInfo.last_name || ""
            }`.trim() || "Unknown",
          first_name: personalInfo.first_name || "",
          last_name: personalInfo.last_name || "",
          email: personalInfo.email || "",
          phone: personalInfo.mobile_phone?.number || "",
          center_id: centerId,
          center_code: centerIdToCode[centerId] || "Unknown",
          center_name:
            centers.find((c) => c.center_id === centerId)?.name || "Unknown",
          last_visit_date: row.last_visit_date,
          created_date: details.created_date,
          guest_code: details.code,
          gender: personalInfo.gender_name || "Not specified",
          _raw: details,
        };
      });

      console.log(
        "Processed contacts before center filter:",
        processedContacts.length
      );

      // Apply center filter and pagination
      if (selectedCenter === "ALL") {
        // For "All Centers", data is already paginated
        setContacts(processedContacts);
        setTotalContacts(count || 0);
      } else {
        // For specific centers, data is already filtered and paginated by Supabase
        setContacts(processedContacts);
        setTotalContacts(count || 0);
      }

      // Debug: Log unique center codes and IDs found
      const uniqueCenterCodes = [
        ...new Set(processedContacts.map((c) => c.center_code)),
      ];
      const uniqueCenterIds = [
        ...new Set(processedContacts.map((c) => c.center_id)),
      ];
      console.log("Unique center codes found:", uniqueCenterCodes);
      console.log("Unique center IDs found:", uniqueCenterIds);
    } catch (err) {
      console.error("Error fetching contacts:", err);
      setError(`Failed to fetch contacts: ${err.message}`);
      setContacts([]);
      setTotalContacts(0);
    } finally {
      setIsLoading(false);
    }
  }, [
    activeSection,
    selectedCenter,
    centerCodeToId,
    centerIdToCode,
    centers,
    contactsPage,
    contactsRowsPerPage,
    contactsSearch,
  ]);

  // Fetch appointments with pagination and search
  const fetchAppointments = useCallback(async () => {
    if (activeSection !== "appointments") return;

    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("zenoti_appointments")
        .select("*", { count: "exact" });

      // Apply center filter
      if (selectedCenter !== "ALL" && centerCodeToId[selectedCenter]) {
        const targetCenterId = centerCodeToId[selectedCenter];
        query = query.eq("center_id", targetCenterId);
      }

      // Apply search filter
      if (appointmentsSearch.trim()) {
        const searchTerm = appointmentsSearch.trim();
        query = query.or(
          `guest_name.ilike.%${searchTerm}%,service_name.ilike.%${searchTerm}%,therapist_name.ilike.%${searchTerm}%`
        );
      }

      // Apply pagination
      const from = appointmentsPage * appointmentsRowsPerPage;
      const to = from + appointmentsRowsPerPage - 1;
      query = query.range(from, to);

      // Order by start time descending
      query = query.order("start_time", { ascending: false });

      const { data, error, count } = await query;

      if (error) throw error;

      // Process appointments
      const processedAppointments = (data || []).map((row) => {
        const details = row.details || {};

        return {
          id: row.id,
          appointment_id: row.appointment_id,
          guest_name:
            row.guest_name ||
            details.guest_name ||
            extractFromDetails(details, "guest.name") ||
            "Unknown",
          service_name:
            row.service_name ||
            details.service_name ||
            extractFromDetails(details, "service.name") ||
            "Unknown",
          therapist_name:
            row.therapist_name ||
            details.serviced_by ||
            extractFromDetails(details, "therapist.name") ||
            "Unassigned",
          start_time: row.start_time,
          end_time: row.end_time,
          status: row.status || details.status || "Unknown",
          center_code:
            row.center_code || centerIdToCode[row.center_id] || "Unknown",
          center_name:
            centers.find((c) => c.center_id === row.center_id)?.name ||
            "Unknown",
          invoice_no: details.invoice_no || "",
          guest_email: details.email || "",
          appointment_notes: details.appointment_notes || "",
          _raw: details,
        };
      });

      setAppointments(processedAppointments);
      setTotalAppointments(count || 0);
    } catch (err) {
      console.error("Error fetching appointments:", err);
      setError(`Failed to fetch appointments: ${err.message}`);
      setAppointments([]);
      setTotalAppointments(0);
    } finally {
      setIsLoading(false);
    }
  }, [
    activeSection,
    selectedCenter,
    centerCodeToId,
    centerIdToCode,
    centers,
    appointmentsPage,
    appointmentsRowsPerPage,
    appointmentsSearch,
    extractFromDetails,
  ]);

  // Load data when dependencies change
  useEffect(() => {
    if (activeSection === "contacts") {
      fetchContacts();
    } else if (activeSection === "appointments") {
      fetchAppointments();
    }
  }, [activeSection, fetchContacts, fetchAppointments]);

  // Reset pagination when search or center changes
  useEffect(() => {
    setContactsPage(0);
  }, [contactsSearch, selectedCenter]);

  useEffect(() => {
    setAppointmentsPage(0);
  }, [appointmentsSearch, selectedCenter]);

  // Refresh data function
  const refreshData = useCallback(() => {
    if (activeSection === "contacts") {
      fetchContacts();
    } else if (activeSection === "appointments") {
      fetchAppointments();
    }
    if (onRefresh) {
      onRefresh();
    }
  }, [activeSection, fetchContacts, fetchAppointments, onRefresh]);

  // Handle center change
  const handleCenterChange = (centerId) => {
    setSelectedCenter(centerId);
  };

  // Format date utility
  const formatDateTime = (dateString) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return "Invalid date";
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return "Invalid date";
    }
  };

  const width = useWindowSize();
  const isMobile = width <= 600;
  const isTablet = width > 600 && width <= 1030;

  return (
    <div className="crm-dashboard">
      {isMobile ? (
        <div
          className="crm-mobile"
          style={{
            width: "100vw",
            padding: 16,
            boxSizing: "border-box",
            background: "#f9fafb",
            minHeight: "100vh",
          }}
        >
          {/* Header */}
          <div style={{ width: "100%", marginBottom: 20 }}>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "#1f2937",
                marginBottom: 12,
              }}
            >
              CRM Dashboard
            </h1>
            <p style={{ fontSize: 16, color: "#6b7280", margin: 0 }}>
              Manage your contacts and appointments
            </p>
          </div>

          {/* Stats Cards */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                background: "#fff",
                borderRadius: 12,
                padding: 16,
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              }}
            >
              <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 4 }}>
                Total Contacts
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#1f2937" }}>
                {contacts.length}
              </div>
            </div>
            <div
              style={{
                background: "#fff",
                borderRadius: 12,
                padding: 16,
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              }}
            >
              <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 4 }}>
                Total Appointments
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#1f2937" }}>
                {appointments.length}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", width: "100%", marginBottom: 20 }}>
            <button
              onClick={() => setActiveSection("contacts")}
              style={{
                flex: 1,
                padding: 12,
                fontSize: 16,
                fontWeight: 600,
                background:
                  activeSection === "contacts" ? "#4f46e5" : "#f3f4f6",
                color: activeSection === "contacts" ? "#fff" : "#374151",
                border: "none",
                borderRadius: 8,
                marginRight: 8,
              }}
            >
              Contacts
            </button>
            <button
              onClick={() => setActiveSection("appointments")}
              style={{
                flex: 1,
                padding: 12,
                fontSize: 16,
                fontWeight: 600,
                background:
                  activeSection === "appointments" ? "#4f46e5" : "#f3f4f6",
                color: activeSection === "appointments" ? "#fff" : "#374151",
                border: "none",
                borderRadius: 8,
                marginLeft: 8,
              }}
            >
              Appointments
            </button>
          </div>

          {/* Content */}
          {activeSection === "contacts" ? (
            <div style={{ width: "100%" }}>
              {/* Contact Cards */}
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  style={{
                    background: "#fff",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 12,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 600,
                        color: "#1f2937",
                      }}
                    >
                      {contact.name}
                    </div>
                    <div style={{ fontSize: 14, color: "#6b7280" }}>
                      {contact.status}
                    </div>
                  </div>
                  <div
                    style={{ fontSize: 16, color: "#374151", marginBottom: 8 }}
                  >
                    {contact.email}
                  </div>
                  <div
                    style={{ fontSize: 16, color: "#374151", marginBottom: 8 }}
                  >
                    {contact.phone}
                  </div>
                  <div style={{ fontSize: 14, color: "#6b7280" }}>
                    Company: {contact.company}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ width: "100%" }}>
              {/* Appointment Cards */}
              {appointments.map((appointment) => (
                <div
                  key={appointment.id}
                  style={{
                    background: "#fff",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 12,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 600,
                        color: "#1f2937",
                      }}
                    >
                      {appointment.title}
                    </div>
                    <div style={{ fontSize: 14, color: "#6b7280" }}>
                      {appointment.status}
                    </div>
                  </div>
                  <div
                    style={{ fontSize: 16, color: "#374151", marginBottom: 8 }}
                  >
                    Client: {appointment.client}
                  </div>
                  <div
                    style={{ fontSize: 16, color: "#374151", marginBottom: 8 }}
                  >
                    Date: {appointment.date}
                  </div>
                  <div
                    style={{ fontSize: 16, color: "#374151", marginBottom: 8 }}
                  >
                    Time: {appointment.time}
                  </div>
                  <div style={{ fontSize: 14, color: "#6b7280" }}>
                    Notes: {appointment.notes}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : isTablet ? (
        <div
          className="crm-tablet"
          style={{
            width: "100vw",
            padding: 20,
            boxSizing: "border-box",
            background: "#f9fafb",
            minHeight: "100vh",
          }}
        >
          {/* Header */}
          <div style={{ width: "100%", marginBottom: 24 }}>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: "#1f2937",
                marginBottom: 12,
              }}
            >
              CRM Dashboard
            </h1>
            <p style={{ fontSize: 18, color: "#6b7280", margin: 0 }}>
              Manage your contacts and appointments
            </p>
          </div>

          {/* Stats Cards */}
          <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
            <div
              style={{
                flex: 1,
                background: "#fff",
                borderRadius: 12,
                padding: 20,
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              }}
            >
              <div style={{ fontSize: 16, color: "#6b7280", marginBottom: 8 }}>
                Total Contacts
              </div>
              <div style={{ fontSize: 32, fontWeight: 700, color: "#1f2937" }}>
                {contacts.length}
              </div>
            </div>
            <div
              style={{
                flex: 1,
                background: "#fff",
                borderRadius: 12,
                padding: 20,
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              }}
            >
              <div style={{ fontSize: 16, color: "#6b7280", marginBottom: 8 }}>
                Total Appointments
              </div>
              <div style={{ fontSize: 32, fontWeight: 700, color: "#1f2937" }}>
                {appointments.length}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", width: "100%", marginBottom: 24 }}>
            <button
              onClick={() => setActiveSection("contacts")}
              style={{
                flex: 1,
                padding: 16,
                fontSize: 18,
                fontWeight: 600,
                background:
                  activeSection === "contacts" ? "#4f46e5" : "#f3f4f6",
                color: activeSection === "contacts" ? "#fff" : "#374151",
                border: "none",
                borderRadius: 8,
                marginRight: 12,
              }}
            >
              Contacts
            </button>
            <button
              onClick={() => setActiveSection("appointments")}
              style={{
                flex: 1,
                padding: 16,
                fontSize: 18,
                fontWeight: 600,
                background:
                  activeSection === "appointments" ? "#4f46e5" : "#f3f4f6",
                color: activeSection === "appointments" ? "#fff" : "#374151",
                border: "none",
                borderRadius: 8,
                marginLeft: 12,
              }}
            >
              Appointments
            </button>
          </div>

          {/* Content */}
          {activeSection === "contacts" ? (
            <div style={{ width: "100%", overflowX: "auto" }}>
              <TableContainer sx={{ minWidth: 600 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell style={{ fontSize: 16, fontWeight: 600 }}>
                        Name
                      </TableCell>
                      <TableCell style={{ fontSize: 16, fontWeight: 600 }}>
                        Email
                      </TableCell>
                      <TableCell style={{ fontSize: 16, fontWeight: 600 }}>
                        Phone
                      </TableCell>
                      <TableCell style={{ fontSize: 16, fontWeight: 600 }}>
                        Company
                      </TableCell>
                      <TableCell style={{ fontSize: 16, fontWeight: 600 }}>
                        Status
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {contacts.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell style={{ fontSize: 16 }}>
                          {contact.name}
                        </TableCell>
                        <TableCell style={{ fontSize: 16 }}>
                          {contact.email}
                        </TableCell>
                        <TableCell style={{ fontSize: 16 }}>
                          {contact.phone}
                        </TableCell>
                        <TableCell style={{ fontSize: 16 }}>
                          {contact.company}
                        </TableCell>
                        <TableCell style={{ fontSize: 16 }}>
                          {contact.status}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </div>
          ) : (
            <div style={{ width: "100%", overflowX: "auto" }}>
              <TableContainer sx={{ minWidth: 600 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell style={{ fontSize: 16, fontWeight: 600 }}>
                        Title
                      </TableCell>
                      <TableCell style={{ fontSize: 16, fontWeight: 600 }}>
                        Client
                      </TableCell>
                      <TableCell style={{ fontSize: 16, fontWeight: 600 }}>
                        Date
                      </TableCell>
                      <TableCell style={{ fontSize: 16, fontWeight: 600 }}>
                        Time
                      </TableCell>
                      <TableCell style={{ fontSize: 16, fontWeight: 600 }}>
                        Status
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {appointments.map((appointment) => (
                      <TableRow key={appointment.id}>
                        <TableCell style={{ fontSize: 16 }}>
                          {appointment.title}
                        </TableCell>
                        <TableCell style={{ fontSize: 16 }}>
                          {appointment.client}
                        </TableCell>
                        <TableCell style={{ fontSize: 16 }}>
                          {appointment.date}
                        </TableCell>
                        <TableCell style={{ fontSize: 16 }}>
                          {appointment.time}
                        </TableCell>
                        <TableCell style={{ fontSize: 16 }}>
                          {appointment.status}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </div>
          )}
        </div>
      ) : (
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
          {/* Header */}
          <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 2,
              }}
            >
              <Typography variant="h5" component="h1">
                CRM Dashboard
              </Typography>
              <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                <IconButton onClick={refreshData} disabled={isLoading}>
                  <Refresh />
                </IconButton>
                {onClose && (
                  <IconButton onClick={onClose}>
                    <CloseIcon />
                  </IconButton>
                )}
              </Box>
            </Box>

            {/* Navigation Tabs */}
            <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
              {[
                { id: "contacts", label: "Contacts", icon: <Person /> },
                { id: "appointments", label: "Appointments", icon: <Event /> },
                { id: "services", label: "Services", icon: <Business /> },
                { id: "packages", label: "Packages", icon: <Business /> },
                { id: "analytics", label: "Analytics", icon: <Analytics /> },
              ].map((tab) => (
                <Button
                  key={tab.id}
                  variant={activeSection === tab.id ? "contained" : "outlined"}
                  startIcon={tab.icon}
                  onClick={() => setActiveSection(tab.id)}
                  size="small"
                >
                  {tab.label}
                </Button>
              ))}
            </Box>

            {/* Center Filter */}
            {centers.length > 0 && (
              <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                <Typography variant="body2">Center:</Typography>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  <Chip
                    label="All Centers"
                    variant={selectedCenter === "ALL" ? "filled" : "outlined"}
                    onClick={() => handleCenterChange("ALL")}
                    size="small"
                    color={selectedCenter === "ALL" ? "primary" : "default"}
                  />
                  {centers.map((center) => (
                    <Chip
                      key={center.center_id}
                      label={`${center.center_code} - ${center.name}`}
                      variant={
                        selectedCenter === center.center_id
                          ? "filled"
                          : "outlined"
                      }
                      onClick={() => handleCenterChange(center.center_id)}
                      size="small"
                      color={
                        selectedCenter === center.center_id
                          ? "primary"
                          : "default"
                      }
                    />
                  ))}
                </Box>
              </Box>
            )}
          </Paper>

          {/* Error Display */}
          {error && (
            <Alert
              severity="error"
              sx={{ mb: 2 }}
              onClose={() => setError(null)}
            >
              {error}
            </Alert>
          )}

          {/* Content */}
          <Box sx={{ flex: 1, overflow: "hidden" }}>
            {/* Contacts Section */}
            {activeSection === "contacts" && (
              <Paper
                elevation={1}
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      mb: 2,
                    }}
                  >
                    <Typography variant="h6">Contacts</Typography>
                    <TextField
                      size="small"
                      placeholder="Search contacts..."
                      value={contactsSearch}
                      onChange={(e) => setContactsSearch(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Search />
                          </InputAdornment>
                        ),
                      }}
                      sx={{ width: 300 }}
                    />
                  </Box>
                </Box>

                <Box sx={{ flex: 1, overflow: "hidden" }}>
                  {isLoading ? (
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        height: "100%",
                      }}
                    >
                      <CircularProgress />
                    </Box>
                  ) : contacts.length === 0 ? (
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        height: "100%",
                        flexDirection: "column",
                        gap: 2,
                      }}
                    >
                      <Typography variant="h6" color="textSecondary">
                        No contacts found
                      </Typography>
                      <Typography
                        variant="body2"
                        color="textSecondary"
                        textAlign="center"
                      >
                        {selectedCenter !== "ALL"
                          ? `No contacts found for ${selectedCenter} center. Try selecting "All Centers" to see all contacts.`
                          : contactsSearch
                          ? "No contacts match your search criteria. Try adjusting your search terms."
                          : "No contacts are available."}
                      </Typography>
                      {selectedCenter !== "ALL" && (
                        <Button
                          variant="outlined"
                          onClick={() => handleCenterChange("ALL")}
                        >
                          View All Centers
                        </Button>
                      )}
                    </Box>
                  ) : (
                    <div className="crm-tablet">
                      <TableContainer sx={{ height: "100%" }}>
                        <Table stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell>Name</TableCell>
                              <TableCell>Email</TableCell>
                              <TableCell>Phone</TableCell>
                              <TableCell>Center</TableCell>
                              <TableCell>Guest Code</TableCell>
                              <TableCell>Created</TableCell>
                              <TableCell>Actions</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {contacts.map((contact) => (
                              <TableRow key={contact.id} hover>
                                <TableCell>{contact.name}</TableCell>
                                <TableCell>{contact.email}</TableCell>
                                <TableCell>{contact.phone}</TableCell>
                                <TableCell>
                                  <Chip
                                    label={contact.center_code}
                                    size="small"
                                    variant="outlined"
                                  />
                                </TableCell>
                                <TableCell>{contact.guest_code}</TableCell>
                                <TableCell>
                                  {formatDate(contact.created_date)}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    size="small"
                                    onClick={() => setSelectedContact(contact)}
                                  >
                                    View
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </div>
                  )}
                </Box>

                <TablePagination
                  component="div"
                  count={totalContacts}
                  page={contactsPage}
                  onPageChange={(e, newPage) => setContactsPage(newPage)}
                  rowsPerPage={contactsRowsPerPage}
                  onRowsPerPageChange={(e) => {
                    setContactsRowsPerPage(parseInt(e.target.value, 10));
                    setContactsPage(0);
                  }}
                  rowsPerPageOptions={[5, 10, 25, 50]}
                  labelDisplayedRows={({ from, to, count }) =>
                    `${from}–${to} of ${
                      count !== -1 ? count.toLocaleString() : `more than ${to}`
                    }`
                  }
                  showFirstButton
                  showLastButton
                />
              </Paper>
            )}

            {/* Appointments Section */}
            {activeSection === "appointments" && (
              <Paper
                elevation={1}
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      mb: 2,
                    }}
                  >
                    <Typography variant="h6">Appointments</Typography>
                    <TextField
                      size="small"
                      placeholder="Search appointments..."
                      value={appointmentsSearch}
                      onChange={(e) => setAppointmentsSearch(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Search />
                          </InputAdornment>
                        ),
                      }}
                      sx={{ width: 300 }}
                    />
                  </Box>
                </Box>

                <Box sx={{ flex: 1, overflow: "hidden" }}>
                  {isLoading ? (
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        height: "100%",
                      }}
                    >
                      <CircularProgress />
                    </Box>
                  ) : isMobile || isTablet ? (
                    <div className="crm-mobile">
                      {appointments.map((appointment) => (
                        <Paper
                          key={appointment.id}
                          sx={{
                            mb: 2,
                            p: 2,
                            borderRadius: 2,
                            boxShadow: 1,
                            width: "100%",
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 1,
                            }}
                          >
                            <Box>
                              <strong>Guest:</strong> {appointment.guest_name}
                            </Box>
                            <Box>
                              <strong>Service:</strong>{" "}
                              {appointment.service_name}
                            </Box>
                            <Box>
                              <strong>Therapist:</strong>{" "}
                              {appointment.therapist_name}
                            </Box>
                            <Box>
                              <strong>Start Time:</strong>{" "}
                              {formatDateTime(appointment.start_time)}
                            </Box>
                            <Box>
                              <strong>Status:</strong>{" "}
                              <Chip
                                label={appointment.status}
                                size="small"
                                color={
                                  appointment.status === "Closed"
                                    ? "success"
                                    : appointment.status === "Deleted"
                                    ? "error"
                                    : "default"
                                }
                              />
                            </Box>
                            <Box>
                              <strong>Center:</strong>{" "}
                              <Chip
                                label={appointment.center_code}
                                size="small"
                                variant="outlined"
                              />
                            </Box>
                            <Box>
                              <Button
                                size="small"
                                fullWidth
                                onClick={() =>
                                  setSelectedAppointment(appointment)
                                }
                              >
                                View
                              </Button>
                            </Box>
                          </Box>
                        </Paper>
                      ))}
                    </div>
                  ) : (
                    <div className="crm-tablet">
                      <TableContainer sx={{ height: "100%" }}>
                        <Table stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell>Guest</TableCell>
                              <TableCell>Service</TableCell>
                              <TableCell>Therapist</TableCell>
                              <TableCell>Start Time</TableCell>
                              <TableCell>Status</TableCell>
                              <TableCell>Center</TableCell>
                              <TableCell>Actions</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {appointments.map((appointment) => (
                              <TableRow key={appointment.id} hover>
                                <TableCell>{appointment.guest_name}</TableCell>
                                <TableCell>
                                  {appointment.service_name}
                                </TableCell>
                                <TableCell>
                                  {appointment.therapist_name}
                                </TableCell>
                                <TableCell>
                                  {formatDateTime(appointment.start_time)}
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    label={appointment.status}
                                    size="small"
                                    color={
                                      appointment.status === "Closed"
                                        ? "success"
                                        : appointment.status === "Deleted"
                                        ? "error"
                                        : "default"
                                    }
                                  />
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    label={appointment.center_code}
                                    size="small"
                                    variant="outlined"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Button
                                    size="small"
                                    onClick={() =>
                                      setSelectedAppointment(appointment)
                                    }
                                  >
                                    View
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </div>
                  )}
                </Box>

                <TablePagination
                  component="div"
                  count={totalAppointments}
                  page={appointmentsPage}
                  onPageChange={(e, newPage) => setAppointmentsPage(newPage)}
                  rowsPerPage={appointmentsRowsPerPage}
                  onRowsPerPageChange={(e) => {
                    setAppointmentsRowsPerPage(parseInt(e.target.value, 10));
                    setAppointmentsPage(0);
                  }}
                  rowsPerPageOptions={[5, 10, 25, 50]}
                  labelDisplayedRows={({ from, to, count }) =>
                    `${from}–${to} of ${
                      count !== -1 ? count.toLocaleString() : `more than ${to}`
                    }`
                  }
                  showFirstButton
                  showLastButton
                />
              </Paper>
            )}

            {/* Services Section */}
            {activeSection === "services" && (
              <ZenotiServicesSection
                selectedCenter={selectedCenter}
                centerMapping={centerMapping}
                onRefresh={refreshData}
              />
            )}

            {/* Packages Section */}
            {activeSection === "packages" && (
              <ZenotiPackagesSection
                selectedCenter={selectedCenter}
                centerMapping={centerMapping}
                onRefresh={refreshData}
              />
            )}

            {/* Analytics Section */}
            {activeSection === "analytics" && (
              <CRMAnalyticsDashboard
                selectedCenter={selectedCenter}
                centerMapping={centerMapping}
                onRefresh={refreshData}
              />
            )}
          </Box>

          {/* Contact Detail Modal */}
          <Dialog
            open={!!selectedContact}
            onClose={() => setSelectedContact(null)}
            maxWidth="md"
            fullWidth
          >
            <DialogTitle>Contact Details</DialogTitle>
            <DialogContent>
              {selectedContact && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(250px, 1fr))",
                      gap: 2,
                    }}
                  >
                    <Box>
                      <strong>Name:</strong> {selectedContact.name}
                    </Box>
                    <Box>
                      <strong>Email:</strong> {selectedContact.email || "N/A"}
                    </Box>
                    <Box>
                      <strong>Phone:</strong> {selectedContact.phone || "N/A"}
                    </Box>
                    <Box>
                      <strong>Center:</strong> {selectedContact.center_code} -{" "}
                      {selectedContact.center_name}
                    </Box>
                    <Box>
                      <strong>Guest Code:</strong>{" "}
                      {selectedContact.guest_code || "N/A"}
                    </Box>
                    <Box>
                      <strong>Gender:</strong> {selectedContact.gender}
                    </Box>
                  </Box>
                  <Box>
                    <Typography variant="h6" sx={{ mb: 1 }}>
                      Raw Data
                    </Typography>
                    <Box
                      component="pre"
                      sx={{
                        backgroundColor: "#f5f5f5",
                        p: 2,
                        borderRadius: 1,
                        maxHeight: 300,
                        overflow: "auto",
                        fontSize: "12px",
                      }}
                    >
                      {JSON.stringify(selectedContact._raw, null, 2)}
                    </Box>
                  </Box>
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedContact(null)}>Close</Button>
            </DialogActions>
          </Dialog>

          {/* Appointment Detail Modal */}
          <Dialog
            open={!!selectedAppointment}
            onClose={() => setSelectedAppointment(null)}
            maxWidth="md"
            fullWidth
          >
            <DialogTitle>Appointment Details</DialogTitle>
            <DialogContent>
              {selectedAppointment && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(250px, 1fr))",
                      gap: 2,
                    }}
                  >
                    <Box>
                      <strong>Guest:</strong> {selectedAppointment.guest_name}
                    </Box>
                    <Box>
                      <strong>Service:</strong>{" "}
                      {selectedAppointment.service_name}
                    </Box>
                    <Box>
                      <strong>Therapist:</strong>{" "}
                      {selectedAppointment.therapist_name}
                    </Box>
                    <Box>
                      <strong>Start Time:</strong>{" "}
                      {formatDateTime(selectedAppointment.start_time)}
                    </Box>
                    <Box>
                      <strong>End Time:</strong>{" "}
                      {formatDateTime(selectedAppointment.end_time)}
                    </Box>
                    <Box>
                      <strong>Status:</strong> {selectedAppointment.status}
                    </Box>
                    <Box>
                      <strong>Center:</strong> {selectedAppointment.center_code}{" "}
                      - {selectedAppointment.center_name}
                    </Box>
                    <Box>
                      <strong>Invoice:</strong>{" "}
                      {selectedAppointment.invoice_no || "N/A"}
                    </Box>
                  </Box>
                  {selectedAppointment.appointment_notes && (
                    <Box>
                      <Typography variant="h6" sx={{ mb: 1 }}>
                        Notes
                      </Typography>
                      <Typography>
                        {selectedAppointment.appointment_notes}
                      </Typography>
                    </Box>
                  )}
                  <Box>
                    <Typography variant="h6" sx={{ mb: 1 }}>
                      Raw Data
                    </Typography>
                    <Box
                      component="pre"
                      sx={{
                        backgroundColor: "#f5f5f5",
                        p: 2,
                        borderRadius: 1,
                        maxHeight: 300,
                        overflow: "auto",
                        fontSize: "12px",
                      }}
                    >
                      {JSON.stringify(selectedAppointment._raw, null, 2)}
                    </Box>
                  </Box>
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedAppointment(null)}>
                Close
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      )}
    </div>
  );
};

export default CRMDashboard;
