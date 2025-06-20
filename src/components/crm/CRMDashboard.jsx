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
  Work,
  Inventory,
  Assessment,
  Visibility,
  Email,
  Phone,
  LocationOn,
  Label,
  Schedule,
  PersonAdd,
  CheckCircle,
  Cancel,
  TrendingUp,
  AttachMoney,
  Receipt,
  Payment,
  AccountBalance,
  CalendarToday,
  Group,
  Assignment,
  Description,
  Code,
  Category,
  AccessTime,
  MonetizationOn,
  Package,
  LocalOffer,
  BarChart,
  PieChart,
  Timeline,
  GetApp,
  FilterList,
  MoreVert,
  Mail,
} from "@mui/icons-material";

// Add CSS for loading animation
const loadingStyles = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

// Inject the styles
if (typeof document !== "undefined") {
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = loadingStyles;
  document.head.appendChild(styleSheet);
}

function useWindowSize() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return width;
}

// Services data from ZenotiServicesSection
const allServices = [
  {
    id: "e4852445-973d-4a4e-9a49-399210f23afb",
    code: "Serv-18",
    name: "Brows",
    description: "",
    category: "Tattoo Removal",
    duration: 75,
    price: 350,
    recovery_time: 15,
    is_active: true,
    is_couple_service: false,
  },
  {
    id: "276150c6-7b79-4642-8587-2c378bc61e58",
    code: "Serv-09",
    name: "Clean-Up Session",
    description: "",
    category: "Tattoo Removal",
    duration: 75,
    price: 150,
    recovery_time: 15,
    is_active: true,
    is_couple_service: false,
  },
  {
    id: "9c3f9ea0-2a84-4f97-846d-4d572b68809c",
    code: "Serv-02",
    name: "Follow Up",
    description: "",
    category: "Consultation",
    duration: 15,
    price: 0,
    recovery_time: 0,
    is_active: true,
    is_couple_service: false,
  },
  {
    id: "2dc5cbc4-0001-46c6-a832-07432906559e",
    code: "Serv-03",
    name: "Microneedling",
    description: "",
    category: "Skin Treatment",
    duration: 75,
    price: 150,
    recovery_time: 15,
    is_active: true,
    is_couple_service: false,
  },
  {
    id: "4eede2f1-3776-4de8-b055-04640fb898f9",
    code: "Packages",
    name: "Packages",
    description: "",
    category: "Package Category",
    duration: 15,
    price: 0,
    recovery_time: 0,
    is_active: true,
    is_couple_service: false,
  },
  {
    id: "80d479d3-d562-4443-87d7-cd49767a86c1",
    code: "Serv-10",
    name: "Partial Session",
    description: "",
    category: "Tattoo Removal",
    duration: 0,
    price: 0,
    recovery_time: 0,
    is_active: true,
    is_couple_service: false,
  },
  {
    id: "49832dfb-138f-4749-873b-fd357484e8ea",
    code: "Single Sessions",
    name: "Single Sessions",
    description: "",
    category: "Session Category",
    duration: 15,
    price: 0,
    recovery_time: 0,
    is_active: true,
    is_couple_service: false,
  },
  {
    id: "38a914cb-a14e-4d2e-b351-2ffefb19c756",
    code: "Serv-04",
    name: "SS (Large)",
    description: "2 templates (276 dots)",
    category: "Tattoo Removal",
    duration: 180,
    price: 600,
    recovery_time: 15,
    is_active: true,
    is_couple_service: false,
  },
  {
    id: "55b8853d-8d82-4830-939a-a1961a85d5c9",
    code: "Serv-05",
    name: "SS (Medium)",
    description: "1.5 templates (207 dots)",
    category: "Tattoo Removal",
    duration: 150,
    price: 500,
    recovery_time: 15,
    is_active: true,
    is_couple_service: false,
  },
  {
    id: "aee62eef-bfff-4d37-ac6f-7cc7cebd6a68",
    code: "Serv-06",
    name: "SS (Small)",
    description: "1 Template (138 dots)",
    category: "Tattoo Removal",
    duration: 120,
    price: 400,
    recovery_time: 15,
    is_active: true,
    is_couple_service: false,
  },
];

// Packages data from ZenotiPackagesSection
const allPackages = [
  {
    id: "a447ce61-ad06-4c78-b391-50034ea6eb14",
    code: "Pkg1",
    name: "(Large-2tx) Removal Package",
    description: "2 Templates",
    type: 2,
    type_label: "Series",
    time: 15,
    is_active: true,
    validity_expiry: 730,
    validity_expiry_date: null,
    freeze_count: -2,
    cost_to_center: 0,
    terms_and_conditions: "",
    price: 0,
    commission: { type: 0, value: 0, factor: 100, eligible: false },
    instalments: 12,
    payment_frequency: 30,
  },
  {
    id: "91a39ae0-bfad-4a44-b3c2-f88cde7d681d",
    code: "Pkg2",
    name: "(Large-4tx) Removal Package",
    description: "2 templates",
    type: 2,
    type_label: "Series",
    time: 15,
    is_active: true,
    validity_expiry: 730,
    validity_expiry_date: null,
    freeze_count: -2,
    cost_to_center: 0,
    terms_and_conditions: "",
    price: 0,
    commission: { type: 0, value: 0, factor: 100, eligible: false },
    instalments: 18,
    payment_frequency: 30,
  },
  {
    id: "e887cf78-e008-45e9-a1d0-b574be64c680",
    code: "Pkg3",
    name: "(Medium-2tx) Removal Package",
    description: "",
    type: 2,
    type_label: "Series",
    time: 15,
    is_active: true,
    validity_expiry: 730,
    validity_expiry_date: null,
    freeze_count: -2,
    cost_to_center: 0,
    terms_and_conditions: "",
    price: 0,
    commission: { type: 0, value: 0, factor: 100, eligible: false },
    instalments: 12,
    payment_frequency: 30,
  },
  {
    id: "a390244e-f380-42a8-ac84-345b647238d6",
    code: "Pkg4",
    name: "(Medium-4tx) Removal Package",
    description: "1.5 templates, 4 treatments",
    type: 2,
    type_label: "Series",
    time: 15,
    is_active: true,
    validity_expiry: 730,
    validity_expiry_date: null,
    freeze_count: -2,
    cost_to_center: 0,
    terms_and_conditions: "",
    price: 0,
    commission: { type: 0, value: 0, factor: 100, eligible: false },
    instalments: 18,
    payment_frequency: 30,
  },
  {
    id: "2e1ee9c3-742f-4a06-8b7e-2443231137eb",
    code: "Pkg5",
    name: "(Small-2tx) Removal Package",
    description: "1 template, 2 treatments",
    type: 2,
    type_label: "Series",
    time: 15,
    is_active: true,
    validity_expiry: 0,
    validity_expiry_date: "2100-01-01",
    freeze_count: -2,
    cost_to_center: 0,
    terms_and_conditions: "",
    price: 0,
    commission: { type: 0, value: 0, factor: 100, eligible: false },
    instalments: 6,
    payment_frequency: 30,
  },
  {
    id: "f36451a0-391b-4d4a-85da-ee895186ac99",
    code: "Pkg6",
    name: "(Small-4tx) Removal Package",
    description: "1 template, 4 treatments",
    type: 2,
    type_label: "Series",
    time: 15,
    is_active: true,
    validity_expiry: 0,
    validity_expiry_date: "2100-01-01",
    freeze_count: -2,
    cost_to_center: 0,
    terms_and_conditions: "",
    price: 0,
    commission: { type: 0, value: 0, factor: 100, eligible: false },
    instalments: 12,
    payment_frequency: 30,
  },
  {
    id: "e99adfb0-7dc3-48c3-bdd4-466b6475f984",
    code: "Pkg7",
    name: "(XS-2tx) Removal Package",
    description: "1/2 template, 2 treatments",
    type: 2,
    type_label: "Series",
    time: 15,
    is_active: true,
    validity_expiry: 730,
    validity_expiry_date: null,
    freeze_count: -2,
    cost_to_center: 0,
    terms_and_conditions: "",
    price: 0,
    commission: { type: 0, value: 0, factor: 100, eligible: false },
    instalments: 6,
    payment_frequency: 30,
  },
  {
    id: "c45543a3-8acb-40a9-84d5-ff784f7fc124",
    code: "Pkg8",
    name: "(XS-4tx) Removal Package",
    description: "1/2 template, 4 treatments",
    type: 2,
    type_label: "Series",
    time: 15,
    is_active: true,
    validity_expiry: 0,
    validity_expiry_date: "2100-01-01",
    freeze_count: -2,
    cost_to_center: 0,
    terms_and_conditions: "",
    price: 0,
    commission: { type: 0, value: 0, factor: 100, eligible: false },
    instalments: 12,
    payment_frequency: 30,
  },
  {
    id: "3713d7aa-bf42-499f-9c4a-9ba8296a358b",
    code: "Pkg9",
    name: "(XXS-2tx) Removal Package",
    description: "Minimum pricing, 20 dots or less",
    type: 2,
    type_label: "Series",
    time: 15,
    is_active: true,
    validity_expiry: 0,
    validity_expiry_date: "2100-01-01",
    freeze_count: -2,
    cost_to_center: 0,
    terms_and_conditions: "",
    price: 0,
    commission: { type: 0, value: 0, factor: 100, eligible: false },
    instalments: 6,
    payment_frequency: 30,
  },
  {
    id: "8bfd92d1-72c2-469e-a8d5-9e9a346742e7",
    code: "Pkg11",
    name: "(Brows-2tx) Removal Package",
    description: "Two treatments on brows",
    type: 2,
    type_label: "Series",
    time: 15,
    is_active: true,
    validity_expiry: 365,
    validity_expiry_date: null,
    freeze_count: -2,
    cost_to_center: 0,
    terms_and_conditions: "",
    price: 0,
    commission: { type: 0, value: 0, factor: 100, eligible: false },
    instalments: 6,
    payment_frequency: 30,
  },
];

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

  // Utility functions for mobile sections
  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDuration = (minutes) => {
    if (!minutes && minutes !== 0) return "N/A";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Calculate services summary stats
  const servicesSummaryStats = useMemo(() => {
    const totalActive = allServices.filter((s) => s.is_active).length;
    const avgPrice =
      allServices.length > 0
        ? allServices.reduce((sum, s) => sum + (s.price || 0), 0) /
          allServices.length
        : 0;
    const avgDuration =
      allServices.length > 0
        ? allServices.reduce((sum, s) => sum + (s.duration || 0), 0) /
          allServices.length
        : 0;
    const categories = new Set(allServices.map((s) => s.category)).size;

    return {
      total: allServices.length,
      active: totalActive,
      avgPrice,
      avgDuration,
      categories,
    };
  }, []);

  // Calculate packages summary stats
  const packagesSummaryStats = useMemo(() => {
    const totalActive = allPackages.filter((p) => p.is_active).length;
    const typeGroups = allPackages.reduce((acc, pkg) => {
      acc[pkg.type_label] = (acc[pkg.type_label] || 0) + 1;
      return acc;
    }, {});

    return {
      total: allPackages.length,
      active: totalActive,
      inactive: allPackages.length - totalActive,
      types: Object.keys(typeGroups).length,
      typeGroups,
    };
  }, []);

  // State for mobile search
  const [servicesSearch, setServicesSearch] = useState("");
  const [packagesSearch, setPackagesSearch] = useState("");

  // Analytics state for mobile
  const [analyticsReportType, setAnalyticsReportType] = useState("accrual");
  const [analyticsDateRange, setAnalyticsDateRange] = useState("30days");
  const [analyticsData, setAnalyticsData] = useState({
    accrualReports: [],
    cashReports: [],
    appointmentReports: [],
    summaryStats: {
      totalSales: 0,
      totalRefunds: 0,
      netSales: 0,
      totalAppointments: 0,
      completedAppointments: 0,
      cancellationRate: 0,
      averageValue: 0,
      topService: "",
      totalRevenue: 0,
    },
    chartData: [],
    rawReportData: [],
  });
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState(null);

  // Utility to safely parse JSON data
  const safeJsonParse = useCallback((jsonString) => {
    if (!jsonString) return [];
    if (Array.isArray(jsonString)) return jsonString;
    if (typeof jsonString === "object") return [jsonString];

    try {
      const parsed = JSON.parse(jsonString);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      console.error("Error parsing JSON:", e);
      return [];
    }
  }, []);

  // Calculate date range
  const getDateRange = useCallback(() => {
    const now = new Date();
    const start = new Date();

    switch (analyticsDateRange) {
      case "7days":
        start.setDate(now.getDate() - 7);
        break;
      case "30days":
        start.setDate(now.getDate() - 30);
        break;
      case "90days":
        start.setDate(now.getDate() - 90);
        break;
      case "1year":
        start.setFullYear(now.getFullYear() - 1);
        break;
      default:
        start.setDate(now.getDate() - 30);
    }

    return {
      startDate: start.toISOString().split("T")[0],
      endDate: now.toISOString().split("T")[0],
    };
  }, [analyticsDateRange]);

  // Fetch analytics data
  const fetchAnalyticsData = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);

    try {
      const { startDate: filterStartDate, endDate: filterEndDate } =
        getDateRange();

      console.log("Fetching analytics data:", {
        analyticsReportType,
        selectedCenter,
        dateRange: { filterStartDate, filterEndDate },
      });

      // Build base queries
      let accrualQuery = supabase
        .from("zenoti_sales_accrual_reports")
        .select("*")
        .gte("start_date", filterStartDate)
        .lte("end_date", filterEndDate)
        .order("start_date", { ascending: false });

      let cashQuery = supabase
        .from("zenoti_sales_cash_reports")
        .select("*")
        .gte("start_date", filterStartDate)
        .lte("end_date", filterEndDate)
        .order("start_date", { ascending: false });

      let appointmentQuery = supabase
        .from("zenoti_appointments_reports")
        .select("*")
        .gte("start_date", filterStartDate)
        .lte("end_date", filterEndDate)
        .order("start_date", { ascending: false });

      // Apply center filter if selected
      if (selectedCenter !== "ALL") {
        const centerCode = selectedCenter.split(" - ")[0];
        const centerId = centerCodeToId[centerCode];

        if (centerId) {
          accrualQuery = accrualQuery.eq("center_id", centerId);
          cashQuery = cashQuery.eq("center_id", centerId);
          appointmentQuery = appointmentQuery.eq("center_id", centerId);
        }
      }

      // Execute queries
      const [accrualResult, cashResult, appointmentResult] = await Promise.all([
        accrualQuery,
        cashQuery,
        appointmentQuery,
      ]);

      if (accrualResult.error) throw accrualResult.error;
      if (cashResult.error) throw cashResult.error;
      if (appointmentResult.error) throw appointmentResult.error;

      console.log("Query results:", {
        accrual: accrualResult.data?.length,
        cash: cashResult.data?.length,
        appointments: appointmentResult.data?.length,
      });

      // Process the data based on selected report type
      processAnalyticsData(
        accrualResult.data || [],
        cashResult.data || [],
        appointmentResult.data || []
      );
    } catch (err) {
      console.error("Error fetching analytics data:", err);
      setAnalyticsError(`Failed to fetch analytics data: ${err.message}`);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [selectedCenter, centerCodeToId, getDateRange, analyticsReportType]);

  // Process analytics data based on selected report type
  const processAnalyticsData = useCallback(
    (accrualData, cashData, appointmentData) => {
      let processedData = [];
      let stats = {
        totalSales: 0,
        totalRefunds: 0,
        netSales: 0,
        totalAppointments: 0,
        completedAppointments: 0,
        cancellationRate: 0,
        averageValue: 0,
        topService: "",
        totalRevenue: 0,
      };

      let serviceCount = {};
      let dailyData = {};

      // Process based on report type
      if (analyticsReportType === "accrual") {
        // Process accrual data only
        accrualData.forEach((report) => {
          const salesItems = safeJsonParse(report.data);
          salesItems.forEach((item) => {
            // Apply center filter at item level if needed
            if (selectedCenter !== "ALL") {
              const centerCode = selectedCenter.split(" - ")[0];
              const centerId = centerCodeToId[centerCode];
              if (item.center_id !== centerId) {
                return;
              }
            }

            const saleAmount = parseFloat(item.sales_inc_tax || 0);
            const isRefund = saleAmount < 0;

            if (isRefund) {
              stats.totalRefunds += Math.abs(saleAmount);
            } else {
              stats.totalSales += saleAmount;
              stats.totalRevenue += saleAmount;
            }

            // Track services
            const serviceName = item.item_name || "Unknown";
            serviceCount[serviceName] = (serviceCount[serviceName] || 0) + 1;

            // Track daily data
            const date =
              item.sale_date?.split("T")[0] ||
              new Date().toISOString().split("T")[0];
            if (!dailyData[date]) {
              dailyData[date] = { date, sales: 0, refunds: 0, transactions: 0 };
            }
            if (isRefund) {
              dailyData[date].refunds += Math.abs(saleAmount);
            } else {
              dailyData[date].sales += saleAmount;
            }
            dailyData[date].transactions += 1;

            processedData.push({
              sale_date: item.sale_date,
              guest_name: item.guest_name,
              item_name: item.item_name,
              sales_inc_tax: saleAmount,
              center_name: item.center_name,
              invoice_no: item.invoice_no,
              payment_type: item.payment_type || "",
              sold_by: item.sold_by,
              status: item.status,
              report_type: "Accrual Basis",
            });
          });
        });
        stats.netSales = stats.totalSales - stats.totalRefunds;
        stats.averageValue =
          processedData.length > 0
            ? stats.totalSales / processedData.length
            : 0;
      } else if (analyticsReportType === "cash_basis") {
        // Process cash data only
        cashData.forEach((report) => {
          const salesItems = safeJsonParse(report.data);
          salesItems.forEach((item) => {
            // Apply center filter at item level if needed
            if (selectedCenter !== "ALL") {
              const centerCode = selectedCenter.split(" - ")[0];
              const centerId = centerCodeToId[centerCode];
              if (item.center_id !== centerId) {
                return;
              }
            }

            const collectedAmount = parseFloat(
              item.sales_collected_inc_tax || 0
            );
            stats.totalSales += collectedAmount;
            stats.totalRevenue += collectedAmount;

            // Track services
            const serviceName = item.item_name || "Unknown";
            serviceCount[serviceName] = (serviceCount[serviceName] || 0) + 1;

            // Track daily data
            const date =
              item.sale_date?.split("T")[0] ||
              new Date().toISOString().split("T")[0];
            if (!dailyData[date]) {
              dailyData[date] = { date, collected: 0, transactions: 0 };
            }
            dailyData[date].collected += collectedAmount;
            dailyData[date].transactions += 1;

            processedData.push({
              sale_date: item.sale_date,
              guest_name: item.guest_name,
              item_name: item.item_name,
              sales_collected_inc_tax: collectedAmount,
              center_name: item.center_name,
              invoice_no: item.invoice_no,
              payment_type: item.payment_type || "",
              created_by: item.created_by,
              report_type: "Cash Basis",
            });
          });
        });
        stats.netSales = stats.totalSales;
        stats.averageValue =
          processedData.length > 0
            ? stats.totalSales / processedData.length
            : 0;
      } else if (analyticsReportType === "appointments") {
        // Process appointment data only
        appointmentData.forEach((report) => {
          const appointments = safeJsonParse(report.data);
          appointments.forEach((appointment) => {
            // Apply center filter at item level if needed
            if (selectedCenter !== "ALL") {
              const centerCode = selectedCenter.split(" - ")[0];
              const centerId = centerCodeToId[centerCode];
              if (appointment.center_id !== centerId) {
                return;
              }
            }

            stats.totalAppointments += 1;
            if ((appointment.status || "").toLowerCase() === "completed") {
              stats.completedAppointments += 1;
            }

            // Track services
            const serviceName = appointment.service_name || "Unknown";
            serviceCount[serviceName] = (serviceCount[serviceName] || 0) + 1;

            // Track daily data
            const date =
              appointment.appointment_date?.split("T")[0] ||
              new Date().toISOString().split("T")[0];
            if (!dailyData[date]) {
              dailyData[date] = { date, appointments: 0, completed: 0 };
            }
            dailyData[date].appointments += 1;
            if ((appointment.status || "").toLowerCase() === "completed") {
              dailyData[date].completed += 1;
            }

            processedData.push({
              appointment_date: appointment.appointment_date,
              guest_name: appointment.guest_name,
              service_name: appointment.service_name,
              serviced_by: appointment.serviced_by,
              status: appointment.status,
              center_name: appointment.center_name,
              start_time: appointment.start_time,
              end_time: appointment.end_time,
              guest_code: appointment.guest_code,
              report_type: "Appointments",
            });
          });
        });
        stats.cancellationRate =
          stats.totalAppointments > 0
            ? ((stats.totalAppointments - stats.completedAppointments) /
                stats.totalAppointments) *
              100
            : 0;
      }

      // Find top service
      const topServiceEntry = Object.entries(serviceCount).sort(
        ([, a], [, b]) => b - a
      )[0];
      stats.topService = topServiceEntry ? topServiceEntry[0] : "N/A";

      // Create chart data
      let chartData = Object.values(dailyData).sort(
        (a, b) => new Date(a.date) - new Date(b.date)
      );

      setAnalyticsData({
        accrualReports: accrualData,
        cashReports: cashData,
        appointmentReports: appointmentData,
        summaryStats: stats,
        chartData,
        rawReportData: processedData,
      });

      console.log("Processed analytics data:", {
        records: processedData.length,
        stats,
        chartPoints: chartData.length,
      });
    },
    [analyticsReportType, selectedCenter, centerCodeToId, safeJsonParse]
  );

  // Load analytics data when dependencies change
  useEffect(() => {
    if (activeSection === "analytics") {
      fetchAnalyticsData();
    }
  }, [activeSection, fetchAnalyticsData]);

  // Reprocess data when report type changes
  useEffect(() => {
    if (
      analyticsData.accrualReports.length > 0 ||
      analyticsData.cashReports.length > 0 ||
      analyticsData.appointmentReports.length > 0
    ) {
      processAnalyticsData(
        analyticsData.accrualReports,
        analyticsData.cashReports,
        analyticsData.appointmentReports
      );
    }
  }, [
    analyticsReportType,
    processAnalyticsData,
    analyticsData.accrualReports,
    analyticsData.cashReports,
    analyticsData.appointmentReports,
  ]);

  // Filter services based on search
  const filteredServices = useMemo(() => {
    if (!servicesSearch.trim()) return allServices;

    const search = servicesSearch.toLowerCase().trim();
    return allServices.filter(
      (service) =>
        service.name.toLowerCase().includes(search) ||
        service.code.toLowerCase().includes(search) ||
        service.description.toLowerCase().includes(search) ||
        service.category.toLowerCase().includes(search)
    );
  }, [servicesSearch]);

  // Filter packages based on search
  const filteredPackages = useMemo(() => {
    if (!packagesSearch.trim()) return allPackages;

    const search = packagesSearch.toLowerCase().trim();
    return allPackages.filter(
      (pkg) =>
        pkg.name.toLowerCase().includes(search) ||
        pkg.code.toLowerCase().includes(search) ||
        pkg.description.toLowerCase().includes(search)
    );
  }, [packagesSearch]);

  // State for mobile detail modals
  const [selectedService, setSelectedService] = useState(null);
  const [selectedPackage, setSelectedPackage] = useState(null);

  return (
    <div
      className="crm-dashboard"
      style={{
        maxWidth: "100vw",
        overflowX: "hidden",
        boxSizing: "border-box",
      }}
    >
      {isMobile || isTablet ? (
        <div
          style={{
            height: "100vh",
            overflowY: "auto",
            maxWidth: "100vw",
            width: "100vw",
            boxSizing: "border-box",
            background: "#f8fafc",
            padding: 0,
          }}
        >
          {/* Header */}
          <div
            style={{
              background: "#ffffff",
              borderBottom: "1px solid #e2e8f0",
              padding: "16px",
              position: "sticky",
              top: 0,
              zIndex: 10,
            }}
          >
            {onClose && (
              <button
                onClick={onClose}
                style={{
                  position: "absolute",
                  top: 16,
                  right: 16,
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "#ef4444",
                  color: "#fff",
                  border: "none",
                  fontSize: 18,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 600,
                }}
              >
                ×
              </button>
            )}
            <div style={{ paddingRight: onClose ? "60px" : "0" }}>
              <h1
                style={{
                  fontSize: isMobile ? "20px" : "24px",
                  fontWeight: 700,
                  color: "#1f2937",
                  margin: "0 0 4px 0",
                }}
              >
                CRM Dashboard
              </h1>
              <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>
                Manage your contacts and appointments
              </p>
            </div>
          </div>

          {/* Center Filter */}
          {centers.length > 0 && (
            <div
              style={{
                background: "#ffffff",
                borderBottom: "1px solid #e2e8f0",
                padding: "12px 16px",
              }}
            >
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#374151",
                  marginBottom: "8px",
                }}
              >
                Center Filter
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                  maxHeight: "120px",
                  overflowY: "auto",
                }}
              >
                <button
                  onClick={() => handleCenterChange("ALL")}
                  style={{
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: 600,
                    background:
                      selectedCenter === "ALL" ? "#4f46e5" : "#f3f4f6",
                    color: selectedCenter === "ALL" ? "#fff" : "#374151",
                    border: "none",
                    borderRadius: "16px",
                    whiteSpace: "nowrap",
                  }}
                >
                  All Centers
                </button>
                {centers.map((center) => (
                  <button
                    key={center.center_id}
                    onClick={() => handleCenterChange(center.center_id)}
                    style={{
                      padding: "6px 12px",
                      fontSize: "12px",
                      fontWeight: 600,
                      background:
                        selectedCenter === center.center_id
                          ? "#4f46e5"
                          : "#f3f4f6",
                      color:
                        selectedCenter === center.center_id
                          ? "#fff"
                          : "#374151",
                      border: "none",
                      borderRadius: "16px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {center.center_code}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Navigation Tabs */}
          <div
            style={{
              background: "#ffffff",
              borderBottom: "1px solid #e2e8f0",
              padding: "0 16px",
            }}
          >
            <div
              style={{
                display: "flex",
                overflowX: "auto",
                gap: "0",
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              }}
            >
              {[
                { id: "contacts", label: "Contacts", icon: <Person /> },
                { id: "appointments", label: "Appointments", icon: <Event /> },
                { id: "services", label: "Services", icon: <Work /> },
                { id: "packages", label: "Packages", icon: <Inventory /> },
                { id: "analytics", label: "Analytics", icon: <Assessment /> },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSection(tab.id)}
                  style={{
                    flex: "1 0 auto",
                    minWidth: "80px",
                    padding: "12px 8px",
                    fontSize: "13px",
                    fontWeight: 600,
                    background: "transparent",
                    color: activeSection === tab.id ? "#4f46e5" : "#6b7280",
                    border: "none",
                    borderBottom:
                      activeSection === tab.id
                        ? "2px solid #4f46e5"
                        : "2px solid transparent",
                    whiteSpace: "nowrap",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "16px",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    {tab.icon}
                  </span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#dc2626",
                padding: "12px 16px",
                margin: "8px 16px",
                borderRadius: "8px",
                fontSize: "14px",
              }}
            >
              {error}
            </div>
          )}

          {/* Content Area */}
          <div
            style={{
              flex: 1,
              padding: "16px",
              background: "#f8fafc",
              minHeight: "calc(100vh - 200px)",
              overflowY: "auto",
              paddingBottom: "100px",
            }}
          >
            {/* Contacts Section */}
            {activeSection === "contacts" && (
              <div>
                {/* Search Bar */}
                <div style={{ marginBottom: "16px" }}>
                  <div
                    style={{
                      position: "relative",
                      background: "#ffffff",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                    }}
                  >
                    <input
                      type="text"
                      placeholder="Search contacts..."
                      value={contactsSearch}
                      onChange={(e) => setContactsSearch(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "12px 16px 12px 40px",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: "14px",
                        outline: "none",
                      }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        left: "12px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#9ca3af",
                        fontSize: "16px",
                      }}
                    >
                      <Search style={{ fontSize: "16px" }} />
                    </span>
                  </div>
                </div>

                {/* Loading State */}
                {isLoading && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      padding: "40px",
                    }}
                  >
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        border: "3px solid #e5e7eb",
                        borderTop: "3px solid #4f46e5",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                      }}
                    />
                  </div>
                )}

                {/* Contacts List */}
                {!isLoading && contacts.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "40px 20px",
                      background: "#ffffff",
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                      <Mail style={{ fontSize: "48px" }} />
                    </div>
                    <div
                      style={{
                        fontSize: "16px",
                        fontWeight: 600,
                        color: "#374151",
                        marginBottom: "8px",
                      }}
                    >
                      No contacts found
                    </div>
                    <div style={{ fontSize: "14px", color: "#6b7280" }}>
                      {selectedCenter !== "ALL"
                        ? `No contacts found for this center. Try selecting "All Centers".`
                        : contactsSearch
                        ? "No contacts match your search criteria."
                        : "No contacts are available."}
                    </div>
                  </div>
                ) : (
                  <div>
                    {contacts.map((contact) => (
                      <div
                        key={contact.id}
                        style={{
                          background: "#ffffff",
                          borderRadius: "8px",
                          border: "1px solid #e5e7eb",
                          padding: "16px",
                          marginBottom: "12px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            marginBottom: "8px",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "16px",
                              fontWeight: 600,
                              color: "#111827",
                            }}
                          >
                            {contact.name}
                          </div>
                          <button
                            onClick={() => setSelectedContact(contact)}
                            style={{
                              padding: "4px 8px",
                              fontSize: "12px",
                              background: "#4f46e5",
                              color: "#fff",
                              border: "none",
                              borderRadius: "4px",
                              fontWeight: 500,
                            }}
                          >
                            View
                          </button>
                        </div>
                        <div
                          style={{
                            fontSize: "14px",
                            color: "#6b7280",
                            marginBottom: "4px",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <Email style={{ fontSize: "16px" }} />
                          {contact.email || "No email"}
                        </div>
                        <div
                          style={{
                            fontSize: "14px",
                            color: "#6b7280",
                            marginBottom: "4px",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <Phone style={{ fontSize: "16px" }} />
                          {contact.phone || "No phone"}
                        </div>
                        <div
                          style={{
                            fontSize: "14px",
                            color: "#6b7280",
                            marginBottom: "4px",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <LocationOn style={{ fontSize: "16px" }} />
                          {contact.center_name}
                        </div>
                        <div
                          style={{
                            fontSize: "14px",
                            color: "#6b7280",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <Label style={{ fontSize: "16px" }} />
                          Code: {contact.guest_code || "N/A"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pagination */}
                {!isLoading && contacts.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "16px 0",
                      borderTop: "1px solid #e5e7eb",
                      marginTop: "16px",
                      background: "#ffffff",
                      borderRadius: "8px",
                      padding: "16px",
                      marginTop: "16px",
                    }}
                  >
                    <div style={{ fontSize: "14px", color: "#6b7280" }}>
                      {`${contactsPage * contactsRowsPerPage + 1}-${Math.min(
                        (contactsPage + 1) * contactsRowsPerPage,
                        totalContacts
                      )} of ${totalContacts.toLocaleString()}`}
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={() =>
                          setContactsPage(Math.max(0, contactsPage - 1))
                        }
                        disabled={contactsPage === 0}
                        style={{
                          padding: "8px 12px",
                          fontSize: "14px",
                          background:
                            contactsPage === 0 ? "#f3f4f6" : "#4f46e5",
                          color: contactsPage === 0 ? "#9ca3af" : "#fff",
                          border: "none",
                          borderRadius: "6px",
                          fontWeight: 500,
                        }}
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setContactsPage(contactsPage + 1)}
                        disabled={
                          (contactsPage + 1) * contactsRowsPerPage >=
                          totalContacts
                        }
                        style={{
                          padding: "8px 12px",
                          fontSize: "14px",
                          background:
                            (contactsPage + 1) * contactsRowsPerPage >=
                            totalContacts
                              ? "#f3f4f6"
                              : "#4f46e5",
                          color:
                            (contactsPage + 1) * contactsRowsPerPage >=
                            totalContacts
                              ? "#9ca3af"
                              : "#fff",
                          border: "none",
                          borderRadius: "6px",
                          fontWeight: 500,
                        }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Appointments Section */}
            {activeSection === "appointments" && (
              <div>
                {/* Search Bar */}
                <div style={{ marginBottom: "16px" }}>
                  <div
                    style={{
                      position: "relative",
                      background: "#ffffff",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                    }}
                  >
                    <input
                      type="text"
                      placeholder="Search appointments..."
                      value={appointmentsSearch}
                      onChange={(e) => setAppointmentsSearch(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "12px 16px 12px 40px",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: "14px",
                        outline: "none",
                      }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        left: "12px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#9ca3af",
                        fontSize: "16px",
                      }}
                    >
                      <Search style={{ fontSize: "16px" }} />
                    </span>
                  </div>
                </div>

                {/* Loading State */}
                {isLoading && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      padding: "40px",
                    }}
                  >
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        border: "3px solid #e5e7eb",
                        borderTop: "3px solid #4f46e5",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                      }}
                    />
                  </div>
                )}

                {/* Appointments List */}
                {!isLoading && appointments.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "40px 20px",
                      background: "#ffffff",
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                      <Event style={{ fontSize: "48px" }} />
                    </div>
                    <div
                      style={{
                        fontSize: "16px",
                        fontWeight: 600,
                        color: "#374151",
                        marginBottom: "8px",
                      }}
                    >
                      No appointments found
                    </div>
                    <div style={{ fontSize: "14px", color: "#6b7280" }}>
                      {selectedCenter !== "ALL"
                        ? `No appointments found for this center. Try selecting "All Centers".`
                        : appointmentsSearch
                        ? "No appointments match your search criteria."
                        : "No appointments are available."}
                    </div>
                  </div>
                ) : (
                  <div>
                    {appointments.map((appointment) => (
                      <div
                        key={appointment.id}
                        style={{
                          background: "#ffffff",
                          borderRadius: "8px",
                          border: "1px solid #e5e7eb",
                          padding: "16px",
                          marginBottom: "12px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            marginBottom: "8px",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "16px",
                              fontWeight: 600,
                              color: "#111827",
                            }}
                          >
                            {appointment.service_name}
                          </div>
                          <button
                            onClick={() => setSelectedAppointment(appointment)}
                            style={{
                              padding: "4px 8px",
                              fontSize: "12px",
                              background: "#4f46e5",
                              color: "#fff",
                              border: "none",
                              borderRadius: "4px",
                              fontWeight: 500,
                            }}
                          >
                            View
                          </button>
                        </div>
                        <div
                          style={{
                            fontSize: "14px",
                            color: "#6b7280",
                            marginBottom: "4px",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <Person style={{ fontSize: "16px" }} />
                          {appointment.guest_name}
                        </div>
                        <div
                          style={{
                            fontSize: "14px",
                            color: "#6b7280",
                            marginBottom: "4px",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <PersonAdd style={{ fontSize: "16px" }} />
                          {appointment.therapist_name}
                        </div>
                        <div
                          style={{
                            fontSize: "14px",
                            color: "#6b7280",
                            marginBottom: "4px",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <Schedule style={{ fontSize: "16px" }} />
                          {formatDateTime(appointment.start_time)}
                        </div>
                        <div
                          style={{
                            fontSize: "14px",
                            color: "#6b7280",
                            marginBottom: "4px",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <LocationOn style={{ fontSize: "16px" }} />
                          {appointment.center_name}
                        </div>
                        <div style={{ fontSize: "14px", color: "#6b7280" }}>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: "12px",
                              fontSize: "12px",
                              fontWeight: 500,
                              background:
                                appointment.status === "Closed"
                                  ? "#dcfce7"
                                  : appointment.status === "Deleted"
                                  ? "#fef2f2"
                                  : "#f3f4f6",
                              color:
                                appointment.status === "Closed"
                                  ? "#166534"
                                  : appointment.status === "Deleted"
                                  ? "#dc2626"
                                  : "#374151",
                            }}
                          >
                            {appointment.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pagination */}
                {!isLoading && appointments.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "16px 0",
                      borderTop: "1px solid #e5e7eb",
                      marginTop: "16px",
                      background: "#ffffff",
                      borderRadius: "8px",
                      padding: "16px",
                      marginTop: "16px",
                    }}
                  >
                    <div style={{ fontSize: "14px", color: "#6b7280" }}>
                      {`${
                        appointmentsPage * appointmentsRowsPerPage + 1
                      }-${Math.min(
                        (appointmentsPage + 1) * appointmentsRowsPerPage,
                        totalAppointments
                      )} of ${totalAppointments.toLocaleString()}`}
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={() =>
                          setAppointmentsPage(Math.max(0, appointmentsPage - 1))
                        }
                        disabled={appointmentsPage === 0}
                        style={{
                          padding: "8px 12px",
                          fontSize: "14px",
                          background:
                            appointmentsPage === 0 ? "#f3f4f6" : "#4f46e5",
                          color: appointmentsPage === 0 ? "#9ca3af" : "#fff",
                          border: "none",
                          borderRadius: "6px",
                          fontWeight: 500,
                        }}
                      >
                        Previous
                      </button>
                      <button
                        onClick={() =>
                          setAppointmentsPage(appointmentsPage + 1)
                        }
                        disabled={
                          (appointmentsPage + 1) * appointmentsRowsPerPage >=
                          totalAppointments
                        }
                        style={{
                          padding: "8px 12px",
                          fontSize: "14px",
                          background:
                            (appointmentsPage + 1) * appointmentsRowsPerPage >=
                            totalAppointments
                              ? "#f3f4f6"
                              : "#4f46e5",
                          color:
                            (appointmentsPage + 1) * appointmentsRowsPerPage >=
                            totalAppointments
                              ? "#9ca3af"
                              : "#fff",
                          border: "none",
                          borderRadius: "6px",
                          fontWeight: 500,
                        }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Services Section */}
            {activeSection === "services" && (
              <div>
                {/* Mobile Services Layout */}
                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: "8px",
                    border: "1px solid #e5e7eb",
                    padding: "16px",
                    marginBottom: "16px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "16px",
                    }}
                  >
                    <h3
                      style={{
                        fontSize: "18px",
                        fontWeight: 600,
                        color: "#111827",
                        margin: 0,
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <Work style={{ fontSize: "20px" }} />
                      Services Overview
                    </h3>
                    <button
                      onClick={refreshData}
                      style={{
                        padding: "8px 12px",
                        fontSize: "14px",
                        background: "#4f46e5",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        fontWeight: 500,
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <Refresh style={{ fontSize: "16px" }} />
                      Refresh
                    </button>
                  </div>

                  {/* Summary Cards */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(140px, 1fr))",
                      gap: "12px",
                      marginBottom: "16px",
                    }}
                  >
                    <div
                      style={{
                        background: "#f8fafc",
                        padding: "12px",
                        borderRadius: "8px",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "24px",
                          fontWeight: 700,
                          color: "#4f46e5",
                        }}
                      >
                        {servicesSummaryStats.total}
                      </div>
                      <div style={{ fontSize: "12px", color: "#6b7280" }}>
                        Total Services
                      </div>
                    </div>
                    <div
                      style={{
                        background: "#f8fafc",
                        padding: "12px",
                        borderRadius: "8px",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "24px",
                          fontWeight: 700,
                          color: "#10b981",
                        }}
                      >
                        {servicesSummaryStats.active}
                      </div>
                      <div style={{ fontSize: "12px", color: "#6b7280" }}>
                        Active
                      </div>
                    </div>
                    <div
                      style={{
                        background: "#f8fafc",
                        padding: "12px",
                        borderRadius: "8px",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "24px",
                          fontWeight: 700,
                          color: "#f59e0b",
                        }}
                      >
                        {formatCurrency(servicesSummaryStats.avgPrice)}
                      </div>
                      <div style={{ fontSize: "12px", color: "#6b7280" }}>
                        Avg Price
                      </div>
                    </div>
                    <div
                      style={{
                        background: "#f8fafc",
                        padding: "12px",
                        borderRadius: "8px",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "24px",
                          fontWeight: 700,
                          color: "#8b5cf6",
                        }}
                      >
                        {formatDuration(servicesSummaryStats.avgDuration)}
                      </div>
                      <div style={{ fontSize: "12px", color: "#6b7280" }}>
                        Avg Duration
                      </div>
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div style={{ marginBottom: "16px" }}>
                    <div
                      style={{
                        position: "relative",
                        background: "#ffffff",
                        borderRadius: "8px",
                        border: "1px solid #d1d5db",
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Search services..."
                        value={servicesSearch}
                        onChange={(e) => setServicesSearch(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "12px 16px 12px 40px",
                          border: "none",
                          borderRadius: "8px",
                          fontSize: "14px",
                          outline: "none",
                        }}
                      />
                      <span
                        style={{
                          position: "absolute",
                          left: "12px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "#9ca3af",
                          fontSize: "16px",
                        }}
                      >
                        <Search style={{ fontSize: "16px" }} />
                      </span>
                    </div>
                  </div>

                  {/* Services List */}
                  <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                    {filteredServices.length === 0 ? (
                      <div
                        style={{
                          textAlign: "center",
                          padding: "40px 20px",
                          background: "#ffffff",
                          borderRadius: "8px",
                          border: "1px solid #e5e7eb",
                        }}
                      >
                        <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                          <Search style={{ fontSize: "16px" }} />
                        </div>
                        <div
                          style={{
                            fontSize: "16px",
                            fontWeight: 600,
                            color: "#374151",
                            marginBottom: "8px",
                          }}
                        >
                          No services found
                        </div>
                        <div style={{ fontSize: "14px", color: "#6b7280" }}>
                          {servicesSearch
                            ? "No services match your search criteria."
                            : "No services are available."}
                        </div>
                      </div>
                    ) : (
                      filteredServices.map((service) => (
                        <div
                          key={service.id}
                          style={{
                            background: "#ffffff",
                            border: "1px solid #e5e7eb",
                            borderRadius: "8px",
                            padding: "16px",
                            marginBottom: "12px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                              marginBottom: "8px",
                            }}
                          >
                            <div>
                              <div
                                style={{
                                  fontSize: "16px",
                                  fontWeight: 600,
                                  color: "#111827",
                                }}
                              >
                                {service.name}
                              </div>
                              <div
                                style={{
                                  fontSize: "12px",
                                  color: "#6b7280",
                                  fontFamily: "monospace",
                                }}
                              >
                                {service.code}
                              </div>
                            </div>
                            <span
                              style={{
                                padding: "4px 8px",
                                borderRadius: "12px",
                                fontSize: "12px",
                                fontWeight: 500,
                                background: service.is_active
                                  ? "#dcfce7"
                                  : "#fef2f2",
                                color: service.is_active
                                  ? "#166534"
                                  : "#dc2626",
                              }}
                            >
                              {service.is_active ? "Active" : "Inactive"}
                            </span>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "8px",
                              marginBottom: "8px",
                            }}
                          >
                            <span
                              style={{
                                padding: "4px 8px",
                                borderRadius: "12px",
                                fontSize: "12px",
                                background: "#f3f4f6",
                                color: "#374151",
                              }}
                            >
                              {service.category}
                            </span>
                            <span
                              style={{
                                padding: "4px 8px",
                                borderRadius: "12px",
                                fontSize: "12px",
                                background: "#eff6ff",
                                color: "#1d4ed8",
                              }}
                            >
                              <AccessTime style={{ fontSize: "16px" }} />{" "}
                              {formatDuration(service.duration)}
                            </span>
                            <span
                              style={{
                                padding: "4px 8px",
                                borderRadius: "12px",
                                fontSize: "12px",
                                background: "#fef3c7",
                                color: "#92400e",
                              }}
                            >
                              <AttachMoney style={{ fontSize: "16px" }} />{" "}
                              {formatCurrency(service.price)}
                            </span>
                          </div>
                          {service.description && (
                            <div
                              style={{
                                fontSize: "14px",
                                color: "#6b7280",
                                marginBottom: "8px",
                              }}
                            >
                              {service.description}
                            </div>
                          )}
                          <button
                            onClick={() => setSelectedService(service)}
                            style={{
                              padding: "6px 12px",
                              fontSize: "12px",
                              background: "#4f46e5",
                              color: "#fff",
                              border: "none",
                              borderRadius: "4px",
                              fontWeight: 500,
                            }}
                          >
                            View Details
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Packages Section */}
            {activeSection === "packages" && (
              <div>
                {/* Mobile Packages Layout */}
                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: "8px",
                    border: "1px solid #e5e7eb",
                    padding: "16px",
                    marginBottom: "16px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "16px",
                    }}
                  >
                    <h3
                      style={{
                        fontSize: "18px",
                        fontWeight: 600,
                        color: "#111827",
                        margin: 0,
                      }}
                    >
                      <Inventory style={{ fontSize: "20px" }} /> Packages
                      Overview
                    </h3>
                    <button
                      onClick={refreshData}
                      style={{
                        padding: "8px 12px",
                        fontSize: "14px",
                        background: "#4f46e5",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        fontWeight: 500,
                      }}
                    >
                      <Refresh style={{ fontSize: "16px" }} /> Refresh
                    </button>
                  </div>

                  {/* Summary Cards */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(140px, 1fr))",
                      gap: "12px",
                      marginBottom: "16px",
                    }}
                  >
                    <div
                      style={{
                        background: "#f8fafc",
                        padding: "12px",
                        borderRadius: "8px",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "24px",
                          fontWeight: 700,
                          color: "#4f46e5",
                        }}
                      >
                        {packagesSummaryStats.total}
                      </div>
                      <div style={{ fontSize: "12px", color: "#6b7280" }}>
                        Total Packages
                      </div>
                    </div>
                    <div
                      style={{
                        background: "#f8fafc",
                        padding: "12px",
                        borderRadius: "8px",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "24px",
                          fontWeight: 700,
                          color: "#10b981",
                        }}
                      >
                        {packagesSummaryStats.active}
                      </div>
                      <div style={{ fontSize: "12px", color: "#6b7280" }}>
                        Active
                      </div>
                    </div>
                    <div
                      style={{
                        background: "#f8fafc",
                        padding: "12px",
                        borderRadius: "8px",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "24px",
                          fontWeight: 700,
                          color: "#ef4444",
                        }}
                      >
                        {packagesSummaryStats.inactive}
                      </div>
                      <div style={{ fontSize: "12px", color: "#6b7280" }}>
                        Inactive
                      </div>
                    </div>
                    <div
                      style={{
                        background: "#f8fafc",
                        padding: "12px",
                        borderRadius: "8px",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "24px",
                          fontWeight: 700,
                          color: "#8b5cf6",
                        }}
                      >
                        {packagesSummaryStats.types}
                      </div>
                      <div style={{ fontSize: "12px", color: "#6b7280" }}>
                        Types
                      </div>
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div style={{ marginBottom: "16px" }}>
                    <div
                      style={{
                        position: "relative",
                        background: "#ffffff",
                        borderRadius: "8px",
                        border: "1px solid #d1d5db",
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Search packages..."
                        value={packagesSearch}
                        onChange={(e) => setPackagesSearch(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "12px 16px 12px 40px",
                          border: "none",
                          borderRadius: "8px",
                          fontSize: "14px",
                          outline: "none",
                        }}
                      />
                      <span
                        style={{
                          position: "absolute",
                          left: "12px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "#9ca3af",
                          fontSize: "16px",
                        }}
                      >
                        <Search style={{ fontSize: "16px" }} />
                      </span>
                    </div>
                  </div>

                  {/* Packages List */}
                  <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                    {filteredPackages.length === 0 ? (
                      <div
                        style={{
                          textAlign: "center",
                          padding: "40px 20px",
                          background: "#ffffff",
                          borderRadius: "8px",
                          border: "1px solid #e5e7eb",
                        }}
                      >
                        <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                          <Search style={{ fontSize: "16px" }} />
                        </div>
                        <div
                          style={{
                            fontSize: "16px",
                            fontWeight: 600,
                            color: "#374151",
                            marginBottom: "8px",
                          }}
                        >
                          No packages found
                        </div>
                        <div style={{ fontSize: "14px", color: "#6b7280" }}>
                          {packagesSearch
                            ? "No packages match your search criteria."
                            : "No packages are available."}
                        </div>
                      </div>
                    ) : (
                      filteredPackages.map((pkg) => (
                        <div
                          key={pkg.id}
                          style={{
                            background: "#ffffff",
                            border: "1px solid #e5e7eb",
                            borderRadius: "8px",
                            padding: "16px",
                            marginBottom: "12px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                              marginBottom: "8px",
                            }}
                          >
                            <div>
                              <div
                                style={{
                                  fontSize: "16px",
                                  fontWeight: 600,
                                  color: "#111827",
                                }}
                              >
                                {pkg.name}
                              </div>
                              <div
                                style={{
                                  fontSize: "12px",
                                  color: "#6b7280",
                                  fontFamily: "monospace",
                                }}
                              >
                                {pkg.code}
                              </div>
                            </div>
                            <span
                              style={{
                                padding: "4px 8px",
                                borderRadius: "12px",
                                fontSize: "12px",
                                fontWeight: 500,
                                background: pkg.is_active
                                  ? "#dcfce7"
                                  : "#fef2f2",
                                color: pkg.is_active ? "#166534" : "#dc2626",
                              }}
                            >
                              {pkg.is_active ? "Active" : "Inactive"}
                            </span>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "8px",
                              marginBottom: "8px",
                            }}
                          >
                            <span
                              style={{
                                padding: "4px 8px",
                                borderRadius: "12px",
                                fontSize: "12px",
                                background: "#eff6ff",
                                color: "#1d4ed8",
                              }}
                            >
                              <Assignment style={{ fontSize: "16px" }} />{" "}
                              {pkg.type_label}
                            </span>
                            <span
                              style={{
                                padding: "4px 8px",
                                borderRadius: "12px",
                                fontSize: "12px",
                                background: "#fef3c7",
                                color: "#92400e",
                              }}
                            >
                              <AccessTime style={{ fontSize: "16px" }} />{" "}
                              {formatDuration(pkg.time)}
                            </span>
                            <span
                              style={{
                                padding: "4px 8px",
                                borderRadius: "12px",
                                fontSize: "12px",
                                background: "#f3f4f6",
                                color: "#374151",
                              }}
                            >
                              <Payment style={{ fontSize: "16px" }} />{" "}
                              {pkg.instalments} installments
                            </span>
                          </div>
                          {pkg.description && (
                            <div
                              style={{
                                fontSize: "14px",
                                color: "#6b7280",
                                marginBottom: "8px",
                              }}
                            >
                              {pkg.description}
                            </div>
                          )}
                          <div
                            style={{
                              fontSize: "14px",
                              color: "#6b7280",
                              marginBottom: "8px",
                            }}
                          >
                            <strong>Validity:</strong>{" "}
                            {pkg.validity_expiry > 0
                              ? `${pkg.validity_expiry} days`
                              : "No expiry"}
                          </div>
                          <button
                            onClick={() => setSelectedPackage(pkg)}
                            style={{
                              padding: "6px 12px",
                              fontSize: "12px",
                              background: "#4f46e5",
                              color: "#fff",
                              border: "none",
                              borderRadius: "4px",
                              fontWeight: 500,
                            }}
                          >
                            View Details
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Analytics Section */}
            {activeSection === "analytics" && (
              <div>
                {/* Mobile Analytics Layout */}
                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: "8px",
                    border: "1px solid #e5e7eb",
                    padding: "16px",
                    marginBottom: "16px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "16px",
                    }}
                  >
                    <h3
                      style={{
                        fontSize: "18px",
                        fontWeight: 600,
                        color: "#111827",
                        margin: 0,
                      }}
                    >
                      <Assessment style={{ fontSize: "20px" }} /> Analytics
                      Overview
                    </h3>
                    <button
                      onClick={refreshData}
                      style={{
                        padding: "8px 12px",
                        fontSize: "14px",
                        background: "#4f46e5",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        fontWeight: 500,
                      }}
                    >
                      <Refresh style={{ fontSize: "16px" }} /> Refresh
                    </button>
                  </div>

                  {/* Report Type Selector */}
                  <div style={{ marginBottom: "16px" }}>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "#374151",
                        marginBottom: "8px",
                      }}
                    >
                      Report Type
                    </div>
                    <div
                      style={{
                        display: "flex",
                        background: "#f3f4f6",
                        borderRadius: "8px",
                        padding: "4px",
                      }}
                    >
                      {[
                        {
                          id: "accrual",
                          label: "Accrual",
                          icon: <AttachMoney style={{ fontSize: "16px" }} />,
                        },
                        {
                          id: "cash_basis",
                          label: "Cash",
                          icon: <Payment style={{ fontSize: "16px" }} />,
                        },
                        {
                          id: "appointments",
                          label: "Appointments",
                          icon: <Event style={{ fontSize: "16px" }} />,
                        },
                      ].map((type) => (
                        <button
                          key={type.id}
                          onClick={() => setAnalyticsReportType(type.id)}
                          style={{
                            flex: 1,
                            padding: "8px 12px",
                            fontSize: "14px",
                            background:
                              analyticsReportType === type.id
                                ? "#4f46e5"
                                : "transparent",
                            color:
                              analyticsReportType === type.id
                                ? "#fff"
                                : "#6b7280",
                            border: "none",
                            borderRadius: "6px",
                            fontWeight: 500,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "4px",
                          }}
                        >
                          <span>{type.icon}</span>
                          <span>{type.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Time Period Selector */}
                  <div style={{ marginBottom: "16px" }}>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "#374151",
                        marginBottom: "8px",
                      }}
                    >
                      Date Range
                    </div>
                    <div
                      style={{
                        display: "flex",
                        background: "#f3f4f6",
                        borderRadius: "8px",
                        padding: "4px",
                      }}
                    >
                      {[
                        { id: "7days", label: "7 Days" },
                        { id: "30days", label: "30 Days" },
                        { id: "90days", label: "90 Days" },
                        { id: "1year", label: "1 Year" },
                      ].map((period) => (
                        <button
                          key={period.id}
                          onClick={() => setAnalyticsDateRange(period.id)}
                          style={{
                            flex: 1,
                            padding: "8px 12px",
                            fontSize: "14px",
                            background:
                              analyticsDateRange === period.id
                                ? "#4f46e5"
                                : "transparent",
                            color:
                              analyticsDateRange === period.id
                                ? "#fff"
                                : "#6b7280",
                            border: "none",
                            borderRadius: "6px",
                            fontWeight: 500,
                          }}
                        >
                          {period.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Loading State */}
                  {analyticsLoading && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        padding: "40px",
                      }}
                    >
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          border: "3px solid #e5e7eb",
                          borderTop: "3px solid #4f46e5",
                          borderRadius: "50%",
                          animation: "spin 1s linear infinite",
                        }}
                      />
                    </div>
                  )}

                  {/* Error State */}
                  {analyticsError && (
                    <div
                      style={{
                        background: "#fef2f2",
                        border: "1px solid #fecaca",
                        color: "#dc2626",
                        padding: "12px 16px",
                        marginBottom: "16px",
                        borderRadius: "8px",
                        fontSize: "14px",
                      }}
                    >
                      {analyticsError}
                    </div>
                  )}

                  {/* Summary Cards */}
                  {!analyticsLoading && !analyticsError && (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(140px, 1fr))",
                        gap: "12px",
                        marginBottom: "16px",
                      }}
                    >
                      {analyticsReportType === "appointments" ? (
                        <>
                          <div
                            style={{
                              background: "#f8fafc",
                              padding: "12px",
                              borderRadius: "8px",
                              textAlign: "center",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "24px",
                                fontWeight: 700,
                                color: "#4f46e5",
                              }}
                            >
                              {analyticsData.summaryStats.totalAppointments.toLocaleString()}
                            </div>
                            <div style={{ fontSize: "12px", color: "#6b7280" }}>
                              Total Appointments
                            </div>
                          </div>
                          <div
                            style={{
                              background: "#f8fafc",
                              padding: "12px",
                              borderRadius: "8px",
                              textAlign: "center",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "24px",
                                fontWeight: 700,
                                color: "#10b981",
                              }}
                            >
                              {analyticsData.summaryStats.completedAppointments.toLocaleString()}
                            </div>
                            <div style={{ fontSize: "12px", color: "#6b7280" }}>
                              Completed
                            </div>
                          </div>
                          <div
                            style={{
                              background: "#f8fafc",
                              padding: "12px",
                              borderRadius: "8px",
                              textAlign: "center",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "24px",
                                fontWeight: 700,
                                color: "#f59e0b",
                              }}
                            >
                              {analyticsData.summaryStats.cancellationRate.toFixed(
                                1
                              )}
                              %
                            </div>
                            <div style={{ fontSize: "12px", color: "#6b7280" }}>
                              Cancellation Rate
                            </div>
                          </div>
                          <div
                            style={{
                              background: "#f8fafc",
                              padding: "12px",
                              borderRadius: "8px",
                              textAlign: "center",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "24px",
                                fontWeight: 700,
                                color: "#8b5cf6",
                              }}
                            >
                              {analyticsData.summaryStats.topService.length > 10
                                ? `${analyticsData.summaryStats.topService.substring(
                                    0,
                                    10
                                  )}...`
                                : analyticsData.summaryStats.topService}
                            </div>
                            <div style={{ fontSize: "12px", color: "#6b7280" }}>
                              Top Service
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div
                            style={{
                              background: "#f8fafc",
                              padding: "12px",
                              borderRadius: "8px",
                              textAlign: "center",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "24px",
                                fontWeight: 700,
                                color: "#4f46e5",
                              }}
                            >
                              {formatCurrency(
                                analyticsData.summaryStats.totalSales
                              )}
                            </div>
                            <div style={{ fontSize: "12px", color: "#6b7280" }}>
                              Total Sales
                            </div>
                          </div>
                          <div
                            style={{
                              background: "#f8fafc",
                              padding: "12px",
                              borderRadius: "8px",
                              textAlign: "center",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "24px",
                                fontWeight: 700,
                                color: "#10b981",
                              }}
                            >
                              {formatCurrency(
                                analyticsData.summaryStats.netSales
                              )}
                            </div>
                            <div style={{ fontSize: "12px", color: "#6b7280" }}>
                              Net Sales
                            </div>
                          </div>
                          <div
                            style={{
                              background: "#f8fafc",
                              padding: "12px",
                              borderRadius: "8px",
                              textAlign: "center",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "24px",
                                fontWeight: 700,
                                color: "#f59e0b",
                              }}
                            >
                              {formatCurrency(
                                analyticsData.summaryStats.averageValue
                              )}
                            </div>
                            <div style={{ fontSize: "12px", color: "#6b7280" }}>
                              Avg Value
                            </div>
                          </div>
                          <div
                            style={{
                              background: "#f8fafc",
                              padding: "12px",
                              borderRadius: "8px",
                              textAlign: "center",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "24px",
                                fontWeight: 700,
                                color: "#8b5cf6",
                              }}
                            >
                              {analyticsData.rawReportData.length.toLocaleString()}
                            </div>
                            <div style={{ fontSize: "12px", color: "#6b7280" }}>
                              Transactions
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Chart Placeholder */}
                  {!analyticsLoading && !analyticsError && (
                    <div
                      style={{
                        background: "#f8fafc",
                        border: "2px dashed #d1d5db",
                        borderRadius: "8px",
                        padding: "40px 20px",
                        textAlign: "center",
                        marginBottom: "16px",
                      }}
                    >
                      <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                        <TrendingUp style={{ fontSize: "48px" }} />
                      </div>
                      <div
                        style={{
                          fontSize: "16px",
                          fontWeight: 600,
                          color: "#374151",
                          marginBottom: "8px",
                        }}
                      >
                        {analyticsReportType === "appointments"
                          ? "Appointment Analytics"
                          : "Sales Analytics"}
                      </div>
                      <div style={{ fontSize: "14px", color: "#6b7280" }}>
                        {analyticsData.chartData.length > 0
                          ? `${analyticsData.chartData.length} data points available`
                          : "No chart data available for selected period"}
                      </div>
                    </div>
                  )}

                  {/* Quick Stats */}
                  {!analyticsLoading && !analyticsError && (
                    <div style={{ marginBottom: "16px" }}>
                      <h4
                        style={{
                          fontSize: "16px",
                          fontWeight: 600,
                          color: "#111827",
                          marginBottom: "12px",
                        }}
                      >
                        Report Summary
                      </h4>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                        }}
                      >
                        {analyticsReportType === "appointments" ? (
                          <>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                padding: "8px 12px",
                                background: "#f8fafc",
                                borderRadius: "6px",
                              }}
                            >
                              <span
                                style={{ fontSize: "14px", color: "#6b7280" }}
                              >
                                Total Appointments
                              </span>
                              <span
                                style={{
                                  fontSize: "14px",
                                  fontWeight: 600,
                                  color: "#111827",
                                }}
                              >
                                {analyticsData.summaryStats.totalAppointments.toLocaleString()}
                              </span>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                padding: "8px 12px",
                                background: "#f8fafc",
                                borderRadius: "6px",
                              }}
                            >
                              <span
                                style={{ fontSize: "14px", color: "#6b7280" }}
                              >
                                Completed
                              </span>
                              <span
                                style={{
                                  fontSize: "14px",
                                  fontWeight: 600,
                                  color: "#111827",
                                }}
                              >
                                {analyticsData.summaryStats.completedAppointments.toLocaleString()}
                              </span>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                padding: "8px 12px",
                                background: "#f8fafc",
                                borderRadius: "6px",
                              }}
                            >
                              <span
                                style={{ fontSize: "14px", color: "#6b7280" }}
                              >
                                Cancellation Rate
                              </span>
                              <span
                                style={{
                                  fontSize: "14px",
                                  fontWeight: 600,
                                  color: "#111827",
                                }}
                              >
                                {analyticsData.summaryStats.cancellationRate.toFixed(
                                  1
                                )}
                                %
                              </span>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                padding: "8px 12px",
                                background: "#f8fafc",
                                borderRadius: "6px",
                              }}
                            >
                              <span
                                style={{ fontSize: "14px", color: "#6b7280" }}
                              >
                                Top Service
                              </span>
                              <span
                                style={{
                                  fontSize: "14px",
                                  fontWeight: 600,
                                  color: "#111827",
                                }}
                              >
                                {analyticsData.summaryStats.topService}
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                padding: "8px 12px",
                                background: "#f8fafc",
                                borderRadius: "6px",
                              }}
                            >
                              <span
                                style={{ fontSize: "14px", color: "#6b7280" }}
                              >
                                Total Sales
                              </span>
                              <span
                                style={{
                                  fontSize: "14px",
                                  fontWeight: 600,
                                  color: "#111827",
                                }}
                              >
                                {formatCurrency(
                                  analyticsData.summaryStats.totalSales
                                )}
                              </span>
                            </div>
                            {analyticsReportType === "accrual" && (
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  padding: "8px 12px",
                                  background: "#f8fafc",
                                  borderRadius: "6px",
                                }}
                              >
                                <span
                                  style={{ fontSize: "14px", color: "#6b7280" }}
                                >
                                  Total Refunds
                                </span>
                                <span
                                  style={{
                                    fontSize: "14px",
                                    fontWeight: 600,
                                    color: "#111827",
                                  }}
                                >
                                  {formatCurrency(
                                    analyticsData.summaryStats.totalRefunds
                                  )}
                                </span>
                              </div>
                            )}
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                padding: "8px 12px",
                                background: "#f8fafc",
                                borderRadius: "6px",
                              }}
                            >
                              <span
                                style={{ fontSize: "14px", color: "#6b7280" }}
                              >
                                Net Sales
                              </span>
                              <span
                                style={{
                                  fontSize: "14px",
                                  fontWeight: 600,
                                  color: "#111827",
                                }}
                              >
                                {formatCurrency(
                                  analyticsData.summaryStats.netSales
                                )}
                              </span>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                padding: "8px 12px",
                                background: "#f8fafc",
                                borderRadius: "6px",
                              }}
                            >
                              <span
                                style={{ fontSize: "14px", color: "#6b7280" }}
                              >
                                Average Value
                              </span>
                              <span
                                style={{
                                  fontSize: "14px",
                                  fontWeight: 600,
                                  color: "#111827",
                                }}
                              >
                                {formatCurrency(
                                  analyticsData.summaryStats.averageValue
                                )}
                              </span>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                padding: "8px 12px",
                                background: "#f8fafc",
                                borderRadius: "6px",
                              }}
                            >
                              <span
                                style={{ fontSize: "14px", color: "#6b7280" }}
                              >
                                Total Transactions
                              </span>
                              <span
                                style={{
                                  fontSize: "14px",
                                  fontWeight: 600,
                                  color: "#111827",
                                }}
                              >
                                {analyticsData.rawReportData.length.toLocaleString()}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Export Button */}
                  <button
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      fontSize: "14px",
                      background: "#10b981",
                      color: "#fff",
                      border: "none",
                      borderRadius: "8px",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                    }}
                  >
                    <Assessment style={{ fontSize: "20px" }} /> Export Report
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Contact Detail Modal */}
          <Dialog
            open={!!selectedContact}
            onClose={() => setSelectedContact(null)}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>Contact Details</DialogTitle>
            <DialogContent>
              {selectedContact && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr",
                      gap: "8px 16px",
                      alignItems: "center",
                    }}
                  >
                    <strong>Name:</strong>
                    <span>{selectedContact.name}</span>
                    <strong>Email:</strong>
                    <span>{selectedContact.email || "N/A"}</span>
                    <strong>Phone:</strong>
                    <span>{selectedContact.phone || "N/A"}</span>
                    <strong>Center:</strong>
                    <span>
                      {selectedContact.center_code} -{" "}
                      {selectedContact.center_name}
                    </span>
                    <strong>Guest Code:</strong>
                    <span>{selectedContact.guest_code || "N/A"}</span>
                    <strong>Gender:</strong>
                    <span>{selectedContact.gender}</span>
                  </Box>
                  <Box>
                    <Typography
                      variant="h6"
                      sx={{ mb: 1, fontSize: "1rem", fontWeight: "bold" }}
                    >
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
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>Appointment Details</DialogTitle>
            <DialogContent>
              {selectedAppointment && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr",
                      gap: "8px 16px",
                      alignItems: "center",
                    }}
                  >
                    <strong>Guest:</strong>
                    <span>{selectedAppointment.guest_name}</span>
                    <strong>Service:</strong>
                    <span>{selectedAppointment.service_name}</span>
                    <strong>Therapist:</strong>
                    <span>{selectedAppointment.therapist_name}</span>
                    <strong>Start Time:</strong>
                    <span>
                      {formatDateTime(selectedAppointment.start_time)}
                    </span>
                    <strong>End Time:</strong>
                    <span>{formatDateTime(selectedAppointment.end_time)}</span>
                    <strong>Status:</strong>
                    <span>{selectedAppointment.status}</span>
                    <strong>Center:</strong>
                    <span>
                      {selectedAppointment.center_code} -{" "}
                      {selectedAppointment.center_name}
                    </span>
                    <strong>Invoice:</strong>
                    <span>{selectedAppointment.invoice_no || "N/A"}</span>
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
                    <Typography
                      variant="h6"
                      sx={{ mb: 1, fontSize: "1rem", fontWeight: "bold" }}
                    >
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

          {/* Service Detail Modal */}
          <Dialog
            open={!!selectedService}
            onClose={() => setSelectedService(null)}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>Service Details</DialogTitle>
            <DialogContent>
              {selectedService && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr",
                      gap: "8px 16px",
                      alignItems: "center",
                    }}
                  >
                    <strong>Name:</strong>
                    <span>{selectedService.name}</span>
                    <strong>Code:</strong>
                    <span>{selectedService.code}</span>
                    <strong>Category:</strong>
                    <span>{selectedService.category}</span>
                    <strong>Duration:</strong>
                    <span>{formatDuration(selectedService.duration)}</span>
                    <strong>Price:</strong>
                    <span>{formatCurrency(selectedService.price)}</span>
                    <strong>Recovery Time:</strong>
                    <span>{selectedService.recovery_time} days</span>
                    <strong>Status:</strong>
                    <Chip
                      label={selectedService.is_active ? "Active" : "Inactive"}
                      color={selectedService.is_active ? "success" : "error"}
                      size="small"
                      sx={{ justifySelf: "start" }}
                    />
                    <strong>Couple Service:</strong>
                    <Chip
                      label={selectedService.is_couple_service ? "Yes" : "No"}
                      color={
                        selectedService.is_couple_service
                          ? "primary"
                          : "default"
                      }
                      size="small"
                      sx={{ justifySelf: "start" }}
                    />
                  </Box>
                  {selectedService.description && (
                    <Box>
                      <Typography variant="h6" sx={{ mb: 1 }}>
                        Description
                      </Typography>
                      <Typography>{selectedService.description}</Typography>
                    </Box>
                  )}
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedService(null)}>Close</Button>
            </DialogActions>
          </Dialog>

          {/* Package Detail Modal */}
          <Dialog
            open={!!selectedPackage}
            onClose={() => setSelectedPackage(null)}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>Package Details</DialogTitle>
            <DialogContent>
              {selectedPackage && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr",
                      gap: "8px 16px",
                      alignItems: "center",
                    }}
                  >
                    <strong>Name:</strong>
                    <span>{selectedPackage.name}</span>
                    <strong>Code:</strong>
                    <span>{selectedPackage.code}</span>
                    <strong>Type:</strong>
                    <span>{selectedPackage.type_label}</span>
                    <strong>Duration:</strong>
                    <span>{formatDuration(selectedPackage.time)}</span>
                    <strong>Price:</strong>
                    <span>{formatCurrency(selectedPackage.price)}</span>
                    <strong>Installments:</strong>
                    <span>{selectedPackage.instalments}</span>
                    <strong>Payment Frequency:</strong>
                    <span>{selectedPackage.payment_frequency} days</span>
                    <strong>Validity:</strong>
                    <span>
                      {selectedPackage.validity_expiry > 0
                        ? `${selectedPackage.validity_expiry} days`
                        : "No expiry"}
                    </span>
                    <strong>Status:</strong>
                    <Chip
                      label={selectedPackage.is_active ? "Active" : "Inactive"}
                      color={selectedPackage.is_active ? "success" : "error"}
                      size="small"
                      sx={{ justifySelf: "start" }}
                    />
                  </Box>
                  {selectedPackage.description && (
                    <Box>
                      <Typography variant="h6" sx={{ mb: 1 }}>
                        Description
                      </Typography>
                      <Typography>{selectedPackage.description}</Typography>
                    </Box>
                  )}
                  {selectedPackage.terms_and_conditions && (
                    <Box>
                      <Typography variant="h6" sx={{ mb: 1 }}>
                        Terms & Conditions
                      </Typography>
                      <Typography>
                        {selectedPackage.terms_and_conditions}
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedPackage(null)}>Close</Button>
            </DialogActions>
          </Dialog>
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
                { id: "services", label: "Services", icon: <Work /> },
                { id: "packages", label: "Packages", icon: <Inventory /> },
                { id: "analytics", label: "Analytics", icon: <Assessment /> },
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

          {/* Service Detail Modal */}
          <Dialog
            open={!!selectedService}
            onClose={() => setSelectedService(null)}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>Service Details</DialogTitle>
            <DialogContent>
              {selectedService && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr",
                      gap: "8px 16px",
                      alignItems: "center",
                    }}
                  >
                    <strong>Name:</strong>
                    <span>{selectedService.name}</span>
                    <strong>Code:</strong>
                    <span>{selectedService.code}</span>
                    <strong>Category:</strong>
                    <span>{selectedService.category}</span>
                    <strong>Duration:</strong>
                    <span>{formatDuration(selectedService.duration)}</span>
                    <strong>Price:</strong>
                    <span>{formatCurrency(selectedService.price)}</span>
                    <strong>Recovery Time:</strong>
                    <span>{selectedService.recovery_time} days</span>
                    <strong>Status:</strong>
                    <Chip
                      label={selectedService.is_active ? "Active" : "Inactive"}
                      color={selectedService.is_active ? "success" : "error"}
                      size="small"
                      sx={{ justifySelf: "start" }}
                    />
                    <strong>Couple Service:</strong>
                    <Chip
                      label={selectedService.is_couple_service ? "Yes" : "No"}
                      color={
                        selectedService.is_couple_service
                          ? "primary"
                          : "default"
                      }
                      size="small"
                      sx={{ justifySelf: "start" }}
                    />
                  </Box>
                  {selectedService.description && (
                    <Box>
                      <Typography variant="h6" sx={{ mb: 1 }}>
                        Description
                      </Typography>
                      <Typography>{selectedService.description}</Typography>
                    </Box>
                  )}
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedService(null)}>Close</Button>
            </DialogActions>
          </Dialog>
        </Box>
      )}
    </div>
  );
};

export default CRMDashboard;
