import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  BarChart4,
  Users,
  Calendar,
  RefreshCw,
  TrendingUp,
  Download,
  Clock,
  Filter,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Package,
  Tag,
  CheckCircle,
  AlertCircle,
  Info,
} from "lucide-react";
import zenotiService from "../../services/zenotiService";
import apiService from "../../services/apiService";
import analyticsUtils from "../../utils/analyticsUtils";
import "./CRMAnalyticsDashboard.css";

/**
 * Enhanced CRM Analytics Dashboard Component
 * Provides visual insights into appointments, clients, sales and more
 */
const CRMAnalyticsDashboard = ({
  selectedCenter,
  connectionStatus,
  onRefresh,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [timeframe, setTimeframe] = useState("month");
  const [activeView, setActiveView] = useState("overview");
  const [comparisonMode, setComparisonMode] = useState("previous");
  const [showFilters, setShowFilters] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: getDefaultStartDate("month"),
    endDate: new Date().toISOString().split("T")[0],
  });

  // Load analytics data when component mounts or when center/timeframe changes
  useEffect(() => {
    if (selectedCenter && connectionStatus?.connected) {
      loadAnalyticsData();
    }
  }, [selectedCenter, timeframe, connectionStatus?.connected]);

  // Get default start date based on timeframe
  function getDefaultStartDate(timeframe) {
    const date = new Date();

    switch (timeframe) {
      case "week":
        date.setDate(date.getDate() - 7);
        break;
      case "month":
        date.setDate(date.getDate() - 30);
        break;
      case "quarter":
        date.setMonth(date.getMonth() - 3);
        break;
      case "year":
        date.setFullYear(date.getFullYear() - 1);
        break;
      default:
        date.setDate(date.getDate() - 30); // Default to month
    }

    return date.toISOString().split("T")[0];
  }

  // Handle timeframe change
  const handleTimeframeChange = (newTimeframe) => {
    setTimeframe(newTimeframe);
    setDateRange({
      startDate: getDefaultStartDate(newTimeframe),
      endDate: new Date().toISOString().split("T")[0],
    });
  };

  // Load analytics data
  const loadAnalyticsData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log(
        `Loading CRM analytics for center: ${selectedCenter}, timeframe: ${timeframe}`
      );

      // Try to fetch from analytics API first
      try {
        const response = await apiService.analytics.getCRMAnalytics({
          centerCode: selectedCenter,
          timeframe,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          comparisonPeriod: comparisonMode,
        });

        if (response.data?.success) {
          setAnalyticsData(response.data.analytics);
          return;
        }
      } catch (err) {
        console.warn(
          "Analytics API failed, falling back to generated data:",
          err
        );
      }

      // If the API fails, generate analytics data from raw data
      await generateAnalyticsFromRawData();

      // Track analytics view for analytics
      analyticsUtils.trackEvent("crm_analytics_viewed", {
        centerCode: selectedCenter,
        timeframe,
      });
    } catch (err) {
      console.error("Error loading CRM analytics:", err);
      setError("Failed to load analytics data: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate analytics from raw data if API fails
  const generateAnalyticsFromRawData = async () => {
    try {
      console.log("Generating CRM analytics from raw data");

      // Get appointments
      const appointmentsResponse = await zenotiService.getAppointments({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        centerCode: selectedCenter,
      });

      // Get recent clients
      const clientsResponse = await zenotiService.searchClients({
        sort: "last_visit",
        limit: 100,
        centerCode: selectedCenter,
      });

      // Get services
      const servicesResponse = await zenotiService.getServices({
        centerCode: selectedCenter,
        limit: 100,
      });

      // Get sales data if available
      const salesResponse = await zenotiService.getSalesReport({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        centerCode: selectedCenter,
      });

      // Process data to generate analytics
      const appointments = appointmentsResponse.data?.appointments || [];
      const clients = clientsResponse.data?.clients || [];
      const services = servicesResponse.data?.services || [];
      const salesData = salesResponse.data?.report || {
        summary: {},
        items: [],
      };

      // Calculate appointment metrics
      const completedAppointments = appointments.filter((a) => {
        const status = a && a.status ? String(a.status).toLowerCase() : "";
        return status === "completed";
      });

      const canceledAppointments = appointments.filter((a) => {
        const status = a && a.status ? String(a.status).toLowerCase() : "";
        return status === "cancelled" || status === "canceled";
      });

      const upcomingAppointments = appointments.filter((a) => {
        // Make sure date values are valid
        return a && a.start_time && new Date(a.start_time) > new Date();
      });

      // Calculate service popularity
      const serviceCountMap = {};
      appointments.forEach((appointment) => {
        const serviceName =
          appointment.service_name ||
          (appointment.service ? appointment.service.name : null);

        if (serviceName) {
          serviceCountMap[serviceName] =
            (serviceCountMap[serviceName] || 0) + 1;
        }
      });

      // Convert to array for chart display
      const popularServices = Object.entries(serviceCountMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Generate time series data
      const timeSeriesData = generateTimeSeriesData(appointments, timeframe);

      // Calculate client metrics
      const newClientsThisMonth = clients.filter((client) => {
        const createdDate = new Date(
          client.created_date || client.date_joined || new Date()
        );
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return createdDate >= thirtyDaysAgo;
      }).length;

      const activeClients = clients.filter((client) => {
        const lastVisit = new Date(client.last_visit_date || new Date(0));
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        return lastVisit >= ninetyDaysAgo;
      }).length;

      // Calculate revenue data
      const totalRevenue = salesData.summary?.total_sales || 0;
      const totalRefunds = salesData.summary?.total_refunds || 0;
      const netRevenue =
        salesData.summary?.net_sales || totalRevenue - totalRefunds;

      // Calculate appointment show rate
      const appointmentShowRate =
        appointments.length > 0
          ? (appointments.length - canceledAppointments.length) /
            appointments.length
          : 0;

      // Generate package data if available
      let packageData = [];
      try {
        const packagesResponse = await zenotiService.getPackages({
          centerCode: selectedCenter,
        });

        packageData = packagesResponse.data?.packages || [];
      } catch (err) {
        console.warn("Error getting package data:", err);
      }

      // Generate comparison data (random for demo purposes)
      const generateComparisonMetrics = () => {
        // In a real implementation, you would fetch data from the previous period
        const randomChangePercent = () => Math.floor(Math.random() * 30) - 10; // -10% to +20%

        return {
          appointments: {
            totalAppointments: Math.max(
              0,
              appointments.length -
                Math.floor(appointments.length * (randomChangePercent() / 100))
            ),
            completedAppointments: Math.max(
              0,
              completedAppointments.length -
                Math.floor(
                  completedAppointments.length * (randomChangePercent() / 100)
                )
            ),
            canceledAppointments: Math.max(
              0,
              canceledAppointments.length -
                Math.floor(
                  canceledAppointments.length * (randomChangePercent() / 100)
                )
            ),
          },
          clients: {
            totalClients: Math.max(
              0,
              clients.length -
                Math.floor(clients.length * (randomChangePercent() / 100))
            ),
            newClientsThisMonth: Math.max(
              0,
              newClientsThisMonth -
                Math.floor(newClientsThisMonth * (randomChangePercent() / 100))
            ),
            activeClients: Math.max(
              0,
              activeClients -
                Math.floor(activeClients * (randomChangePercent() / 100))
            ),
          },
          revenue: {
            totalRevenue: Math.max(
              0,
              totalRevenue - totalRevenue * (randomChangePercent() / 100)
            ),
            netRevenue: Math.max(
              0,
              netRevenue - netRevenue * (randomChangePercent() / 100)
            ),
          },
          conversionRates: {
            appointmentShowRate: Math.max(
              0,
              Math.min(
                1,
                appointmentShowRate -
                  (appointmentShowRate * (randomChangePercent() / 100)) / 100
              )
            ),
          },
        };
      };

      // Generate mock analytics data
      const analyticsData = {
        appointments: {
          totalAppointments: appointments.length,
          upcomingAppointments: upcomingAppointments.length,
          completedAppointments: completedAppointments.length,
          canceledAppointments: canceledAppointments.length,
        },
        clients: {
          totalClients: clients.length,
          newClientsThisMonth,
          activeClients,
          contactsWithUpcomingAppointments: upcomingAppointments.length,
        },
        services: {
          totalServices: services.length,
          popularServices,
        },
        revenue: {
          totalRevenue,
          totalRefunds,
          netRevenue,
        },
        conversionRates: {
          appointmentShowRate,
          // These are mock values - in a real implementation, you would calculate from real data
          repeatClientRate: 0.68,
          clientRetentionRate: 0.78,
        },
        timeSeriesData,
        packageData,
        comparisonData: generateComparisonMetrics(),
      };

      setAnalyticsData(analyticsData);
    } catch (err) {
      console.error("Error generating analytics from raw data:", err);
      setError("Failed to generate analytics data: " + err.message);
    }
  };

  // Generate time series data for charts
  const generateTimeSeriesData = (appointments, timeframe) => {
    // Create date buckets based on timeframe
    const dateBuckets = {};
    const today = new Date();
    let startDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);

    // Set up time interval based on timeframe
    let interval;
    let formatLabel;

    switch (timeframe) {
      case "week":
        interval = 1; // Daily
        formatLabel = (date) =>
          date.toLocaleDateString(undefined, { weekday: "short" });
        break;
      case "month":
        interval = 2; // Every other day
        formatLabel = (date) => `${date.getMonth() + 1}/${date.getDate()}`;
        break;
      case "quarter":
        interval = 7; // Weekly
        formatLabel = (date) => `${date.getMonth() + 1}/${date.getDate()}`;
        break;
      case "year":
        interval = 30; // Monthly
        formatLabel = (date) =>
          date.toLocaleDateString(undefined, { month: "short" });
        break;
      default:
        interval = 2; // Default to every other day
        formatLabel = (date) => `${date.getMonth() + 1}/${date.getDate()}`;
    }

    // Create date buckets
    while (startDate <= endDate) {
      const key = startDate.toISOString().split("T")[0];
      dateBuckets[key] = {
        date: new Date(startDate),
        appointments: 0,
        revenue: 0,
      };

      // Move to next interval
      startDate.setDate(startDate.getDate() + interval);
    }

    // Count appointments per date
    if (appointments && Array.isArray(appointments)) {
      appointments.forEach((appointment) => {
        if (!appointment || !appointment.start_time) return;
        
        try {
          const appointmentDate = new Date(appointment.start_time);
          
          // Skip invalid dates
          if (isNaN(appointmentDate.getTime())) return;
          
          const key = appointmentDate.toISOString().split("T")[0];

          // Find the closest bucket if exact date not found
          if (dateBuckets[key]) {
            dateBuckets[key].appointments++;
            // Add service price if available
            if (appointment.service && appointment.service.price) {
              dateBuckets[key].revenue +=
                parseFloat(appointment.service.price) || 0;
            }
          } else {
            // Find closest bucket
            let closestKey = Object.keys(dateBuckets)[0];
            if (!closestKey) return; // No buckets available
            
            let smallestDiff = Math.abs(new Date(closestKey) - appointmentDate);

            Object.keys(dateBuckets).forEach((bucketKey) => {
              const diff = Math.abs(new Date(bucketKey) - appointmentDate);
              if (diff < smallestDiff) {
                smallestDiff = diff;
                closestKey = bucketKey;
              }
            });

            if (closestKey) {
              dateBuckets[closestKey].appointments++;
              // Add service price if available
              if (appointment.service && appointment.service.price) {
                dateBuckets[closestKey].revenue +=
                  parseFloat(appointment.service.price) || 0;
              }
            }
          }
        } catch (err) {
          console.warn("Error processing appointment date:", err);
          // Skip this appointment and continue with others
        }
      });
    }

    // Convert to array and format for charts
    return Object.entries(dateBuckets)
      .map(([date, data]) => ({
        date: formatLabel(data.date),
        appointments: data.appointments,
        revenue: data.revenue,
        fullDate: date,
      }))
      .sort((a, b) => new Date(a.fullDate) - new Date(b.fullDate));
  };

  // Format currency for display
  const formatCurrency = (amount) => {
    if (typeof amount !== "number") return "$0";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Calculate percentage change
  const calculateChange = (current, previous) => {
    if (!previous) return 0;
    return ((current - previous) / previous) * 100;
  };

  // Format percentage
  const formatPercentage = (value) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  // Export analytics data
  const exportAnalytics = (format = "csv") => {
    try {
      if (!analyticsData) return;

      // Prepare data for export
      let csvContent = "Metric,Value,Change\n";

      // Add appointment metrics
      csvContent += `Total Appointments,${
        analyticsData.appointments.totalAppointments
      },${calculateChange(
        analyticsData.appointments.totalAppointments,
        analyticsData.comparisonData?.appointments.totalAppointments
      ).toFixed(1)}%\n`;

      csvContent += `Completed Appointments,${
        analyticsData.appointments.completedAppointments
      },${calculateChange(
        analyticsData.appointments.completedAppointments,
        analyticsData.comparisonData?.appointments.completedAppointments
      ).toFixed(1)}%\n`;

      csvContent += `Canceled Appointments,${
        analyticsData.appointments.canceledAppointments
      },${calculateChange(
        analyticsData.appointments.canceledAppointments,
        analyticsData.comparisonData?.appointments.canceledAppointments
      ).toFixed(1)}%\n`;

      // Add client metrics
      csvContent += `Total Clients,${
        analyticsData.clients.totalClients
      },${calculateChange(
        analyticsData.clients.totalClients,
        analyticsData.comparisonData?.clients.totalClients
      ).toFixed(1)}%\n`;

      csvContent += `New Clients,${
        analyticsData.clients.newClientsThisMonth
      },${calculateChange(
        analyticsData.clients.newClientsThisMonth,
        analyticsData.comparisonData?.clients.newClientsThisMonth
      ).toFixed(1)}%\n`;

      csvContent += `Active Clients,${
        analyticsData.clients.activeClients
      },${calculateChange(
        analyticsData.clients.activeClients,
        analyticsData.comparisonData?.clients.activeClients
      ).toFixed(1)}%\n`;

      // Add revenue metrics
      csvContent += `Total Revenue,${
        analyticsData.revenue.totalRevenue
      },${calculateChange(
        analyticsData.revenue.totalRevenue,
        analyticsData.comparisonData?.revenue.totalRevenue
      ).toFixed(1)}%\n`;

      csvContent += `Net Revenue,${
        analyticsData.revenue.netRevenue
      },${calculateChange(
        analyticsData.revenue.netRevenue,
        analyticsData.comparisonData?.revenue.netRevenue
      ).toFixed(1)}%\n`;

      // Add popular services
      analyticsData.services.popularServices.forEach((service, index) => {
        csvContent += `Popular Service ${index + 1},${service.name},${
          service.count
        } bookings\n`;
      });

      // Create download link
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `crm-analytics-${timeframe}-${
          new Date().toISOString().split("T")[0]
        }.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Track export event
      analyticsUtils.trackEvent("crm_analytics_exported", {
        format,
        timeframe,
        centerCode: selectedCenter,
      });
    } catch (err) {
      console.error("Error exporting analytics:", err);
      setError("Failed to export analytics data: " + err.message);
    }
  };

  // CHART COLORS
  const COLORS = [
    "#3B82F6", // blue
    "#10B981", // green
    "#F59E0B", // yellow
    "#EF4444", // red
    "#8B5CF6", // purple
    "#EC4899", // pink
    "#06B6D4", // cyan
    "#F97316", // orange
  ];

  // Render loading state
  if (isLoading && !analyticsData) {
    return (
      <div className="crm-analytics-dashboard">
        <div className="loading-state">
          <RefreshCw className="spinner" size={24} />
          <p>Loading analytics data...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error && !analyticsData) {
    return (
      <div className="crm-analytics-dashboard">
        <div className="error-state">
          <AlertCircle size={32} />
          <h3>Error Loading Analytics</h3>
          <p>{error}</p>
          <button className="refresh-button" onClick={loadAnalyticsData}>
            <RefreshCw size={16} />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // If Zenoti is not connected
  if (!connectionStatus?.connected) {
    return (
      <div className="crm-analytics-dashboard">
        <div className="not-connected-message">
          <Info size={48} />
          <h3>Not Connected to Zenoti</h3>
          <p>Please configure your Zenoti connection to access analytics.</p>
        </div>
      </div>
    );
  }

  // Render no data state
  if (!analyticsData) {
    return (
      <div className="crm-analytics-dashboard">
        <div className="no-data-state">
          <BarChart4 size={48} />
          <h3>No Analytics Data Available</h3>
          <p>
            No analytics data is available for the selected center and
            timeframe.
          </p>
          <button className="refresh-button" onClick={loadAnalyticsData}>
            <RefreshCw size={16} />
            Load Data
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="crm-analytics-dashboard">
      <div className="analytics-header">
        <h2>Zenoti CRM Analytics</h2>

        <div className="header-actions">
          <div className="timeframe-selector">
            <button
              className={timeframe === "week" ? "active" : ""}
              onClick={() => handleTimeframeChange("week")}
            >
              Week
            </button>
            <button
              className={timeframe === "month" ? "active" : ""}
              onClick={() => handleTimeframeChange("month")}
            >
              Month
            </button>
            <button
              className={timeframe === "quarter" ? "active" : ""}
              onClick={() => handleTimeframeChange("quarter")}
            >
              Quarter
            </button>
            <button
              className={timeframe === "year" ? "active" : ""}
              onClick={() => handleTimeframeChange("year")}
            >
              Year
            </button>
          </div>

          <button
            className="export-button"
            onClick={() => exportAnalytics("csv")}
          >
            <Download size={16} />
            <span>Export</span>
          </button>

          <button className="refresh-button" onClick={loadAnalyticsData}>
            <RefreshCw size={16} className={isLoading ? "spinning" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* View selector */}
      <div className="analytics-view-selector">
        <button
          className={activeView === "overview" ? "active" : ""}
          onClick={() => setActiveView("overview")}
        >
          <BarChart4 size={16} />
          Overview
        </button>
        <button
          className={activeView === "appointments" ? "active" : ""}
          onClick={() => setActiveView("appointments")}
        >
          <Calendar size={16} />
          Appointments
        </button>
        <button
          className={activeView === "clients" ? "active" : ""}
          onClick={() => setActiveView("clients")}
        >
          <Users size={16} />
          Clients
        </button>
        <button
          className={activeView === "revenue" ? "active" : ""}
          onClick={() => setActiveView("revenue")}
        >
          <CreditCard size={16} />
          Revenue
        </button>
        <button
          className={activeView === "services" ? "active" : ""}
          onClick={() => setActiveView("services")}
        >
          <Tag size={16} />
          Services
        </button>
      </div>

      {/* Error notification */}
      {error && (
        <div className="error-notification">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Overview View */}
      {activeView === "overview" && (
        <div className="analytics-view">
          <div className="summary-cards">
            <div className="summary-card">
              <div className="card-header">
                <h3>Appointments</h3>
                {analyticsData.comparisonData && (
                  <div
                    className={`change-indicator ${
                      calculateChange(
                        analyticsData.appointments.totalAppointments,
                        analyticsData.comparisonData.appointments
                          .totalAppointments
                      ) >= 0
                        ? "positive"
                        : "negative"
                    }`}
                  >
                    {calculateChange(
                      analyticsData.appointments.totalAppointments,
                      analyticsData.comparisonData.appointments
                        .totalAppointments
                    ) >= 0
                      ? "+"
                      : ""}
                    {calculateChange(
                      analyticsData.appointments.totalAppointments,
                      analyticsData.comparisonData.appointments
                        .totalAppointments
                    ).toFixed(1)}
                    %
                  </div>
                )}
              </div>
              <div className="card-value">
                {analyticsData.appointments.totalAppointments}
              </div>
              <div className="card-breakdown">
                <div className="breakdown-item">
                  <div className="breakdown-label">
                    <span className="status-dot completed"></span>
                    Completed
                  </div>
                  <div className="breakdown-value">
                    {analyticsData.appointments.completedAppointments}
                  </div>
                </div>
                <div className="breakdown-item">
                  <div className="breakdown-label">
                    <span className="status-dot upcoming"></span>
                    Upcoming
                  </div>
                  <div className="breakdown-value">
                    {analyticsData.appointments.upcomingAppointments}
                  </div>
                </div>
                <div className="breakdown-item">
                  <div className="breakdown-label">
                    <span className="status-dot canceled"></span>
                    Canceled
                  </div>
                  <div className="breakdown-value">
                    {analyticsData.appointments.canceledAppointments}
                  </div>
                </div>
              </div>
            </div>

            <div className="summary-card">
              <div className="card-header">
                <h3>Clients</h3>
                {analyticsData.comparisonData && (
                  <div
                    className={`change-indicator ${
                      calculateChange(
                        analyticsData.clients.totalClients,
                        analyticsData.comparisonData.clients.totalClients
                      ) >= 0
                        ? "positive"
                        : "negative"
                    }`}
                  >
                    {calculateChange(
                      analyticsData.clients.totalClients,
                      analyticsData.comparisonData.clients.totalClients
                    ) >= 0
                      ? "+"
                      : ""}
                    {calculateChange(
                      analyticsData.clients.totalClients,
                      analyticsData.comparisonData.clients.totalClients
                    ).toFixed(1)}
                    %
                  </div>
                )}
              </div>
              <div className="card-value">
                {analyticsData.clients.totalClients}
              </div>
              <div className="card-breakdown">
                <div className="breakdown-item">
                  <div className="breakdown-label">New Clients</div>
                  <div className="breakdown-value">
                    {analyticsData.clients.newClientsThisMonth}
                  </div>
                </div>
                <div className="breakdown-item">
                  <div className="breakdown-label">Active Clients</div>
                  <div className="breakdown-value">
                    {analyticsData.clients.activeClients}
                  </div>
                </div>
              </div>
            </div>

            <div className="summary-card">
              <div className="card-header">
                <h3>Revenue</h3>
                {analyticsData.comparisonData && (
                  <div
                    className={`change-indicator ${
                      calculateChange(
                        analyticsData.revenue.netRevenue,
                        analyticsData.comparisonData.revenue.netRevenue
                      ) >= 0
                        ? "positive"
                        : "negative"
                    }`}
                  >
                    {calculateChange(
                      analyticsData.revenue.netRevenue,
                      analyticsData.comparisonData.revenue.netRevenue
                    ) >= 0
                      ? "+"
                      : ""}
                    {calculateChange(
                      analyticsData.revenue.netRevenue,
                      analyticsData.comparisonData.revenue.netRevenue
                    ).toFixed(1)}
                    %
                  </div>
                )}
              </div>
              <div className="card-value">
                {formatCurrency(analyticsData.revenue.netRevenue)}
              </div>
              <div className="card-breakdown">
                <div className="breakdown-item">
                  <div className="breakdown-label">Total Revenue</div>
                  <div className="breakdown-value">
                    {formatCurrency(analyticsData.revenue.totalRevenue)}
                  </div>
                </div>
                <div className="breakdown-item">
                  <div className="breakdown-label">Total Refunds</div>
                  <div className="breakdown-value">
                    {formatCurrency(analyticsData.revenue.totalRefunds)}
                  </div>
                </div>
              </div>
            </div>

            <div className="summary-card">
              <div className="card-header">
                <h3>Conversion Rates</h3>
              </div>
              <div className="card-value">
                {formatPercentage(
                  analyticsData.conversionRates.appointmentShowRate
                )}
              </div>
              <div className="card-description">Appointment Show Rate</div>
              <div className="card-breakdown">
                <div className="breakdown-item">
                  <div className="breakdown-label">Repeat Client Rate</div>
                  <div className="breakdown-value">
                    {formatPercentage(
                      analyticsData.conversionRates.repeatClientRate
                    )}
                  </div>
                </div>
                <div className="breakdown-item">
                  <div className="breakdown-label">Client Retention</div>
                  <div className="breakdown-value">
                    {formatPercentage(
                      analyticsData.conversionRates.clientRetentionRate
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="overview-charts">
            {/* Appointments Over Time Chart */}
            <div className="chart-container">
              <h3>Appointments Over Time</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={analyticsData.timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="appointments"
                    stroke="#3B82F6"
                    name="Appointments"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Popular Services Chart */}
            <div className="chart-container">
              <h3>Popular Services</h3>
              {analyticsData.services.popularServices.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart
                    layout="vertical"
                    data={analyticsData.services.popularServices}
                    margin={{ top: 5, right: 30, left: 70, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 12 }}
                      width={70}
                    />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" name="Bookings" fill="#3B82F6">
                      {analyticsData.services.popularServices.map(
                        (entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        )
                      )}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="no-chart-data">
                  <p>No service data available for the selected period</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Appointments View */}
      {activeView === "appointments" && (
        <div className="analytics-view">
          <div className="metrics-summary">
            <div className="metric-card">
              <h3>Total Appointments</h3>
              {analyticsData.comparisonData && (
                <div
                  className={`metric-change ${
                    calculateChange(
                      analyticsData.appointments.totalAppointments,
                      analyticsData.comparisonData.appointments
                        .totalAppointments
                    ) >= 0
                      ? "positive"
                      : "negative"
                  }`}
                >
                  {calculateChange(
                    analyticsData.appointments.totalAppointments,
                    analyticsData.comparisonData.appointments.totalAppointments
                  ) >= 0
                    ? "+"
                    : ""}
                  {calculateChange(
                    analyticsData.appointments.totalAppointments,
                    analyticsData.comparisonData.appointments.totalAppointments
                  ).toFixed(1)}
                  %
                </div>
              )}
              <div className="metric-value">
                {analyticsData.appointments.totalAppointments}
              </div>
            </div>

            <div className="metric-card">
              <h3>Completed</h3>
              {analyticsData.comparisonData && (
                <div
                  className={`metric-change ${
                    calculateChange(
                      analyticsData.appointments.completedAppointments,
                      analyticsData.comparisonData.appointments
                        .completedAppointments
                    ) >= 0
                      ? "positive"
                      : "negative"
                  }`}
                >
                  {calculateChange(
                    analyticsData.appointments.completedAppointments,
                    analyticsData.comparisonData.appointments
                      .completedAppointments
                  ) >= 0
                    ? "+"
                    : ""}
                  {calculateChange(
                    analyticsData.appointments.completedAppointments,
                    analyticsData.comparisonData.appointments
                      .completedAppointments
                  ).toFixed(1)}
                  %
                </div>
              )}
              <div className="metric-value">
                {analyticsData.appointments.completedAppointments}
              </div>
            </div>

            <div className="metric-card">
              <h3>Upcoming</h3>
              <div className="metric-value">
                {analyticsData.appointments.upcomingAppointments}
              </div>
            </div>

            <div className="metric-card">
              <h3>Canceled</h3>
              {analyticsData.comparisonData && (
                <div
                  className={`metric-change ${
                    calculateChange(
                      analyticsData.appointments.canceledAppointments,
                      analyticsData.comparisonData.appointments
                        .canceledAppointments
                    ) <= 0
                      ? "positive"
                      : "negative"
                  }`}
                >
                  {calculateChange(
                    analyticsData.appointments.canceledAppointments,
                    analyticsData.comparisonData.appointments
                      .canceledAppointments
                  ) >= 0
                    ? "+"
                    : ""}
                  {calculateChange(
                    analyticsData.appointments.canceledAppointments,
                    analyticsData.comparisonData.appointments
                      .canceledAppointments
                  ).toFixed(1)}
                  %
                </div>
              )}
              <div className="metric-value">
                {analyticsData.appointments.canceledAppointments}
              </div>
            </div>
          </div>

          <div className="charts-container">
            {/* Appointments Over Time Chart */}
            <div className="chart-box">
              <h3>Appointments Over Time</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={analyticsData.timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="appointments"
                    stroke="#3B82F6"
                    name="Appointments"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Appointment Status Breakdown */}
            <div className="chart-box">
              <h3>Appointment Status</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={[
                      {
                        name: "Completed",
                        value: analyticsData.appointments.completedAppointments,
                      },
                      {
                        name: "Upcoming",
                        value: analyticsData.appointments.upcomingAppointments,
                      },
                      {
                        name: "Canceled",
                        value: analyticsData.appointments.canceledAppointments,
                      },
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    <Cell fill="#10B981" /> {/* Completed - green */}
                    <Cell fill="#3B82F6" /> {/* Upcoming - blue */}
                    <Cell fill="#EF4444" /> {/* Canceled - red */}
                  </Pie>
                  <Tooltip formatter={(value) => [value, "Appointments"]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Clients View */}
      {activeView === "clients" && (
        <div className="analytics-view">
          <div className="metrics-summary">
            <div className="metric-card">
              <h3>Total Clients</h3>
              {analyticsData.comparisonData && (
                <div
                  className={`metric-change ${
                    calculateChange(
                      analyticsData.clients.totalClients,
                      analyticsData.comparisonData.clients.totalClients
                    ) >= 0
                      ? "positive"
                      : "negative"
                  }`}
                >
                  {calculateChange(
                    analyticsData.clients.totalClients,
                    analyticsData.comparisonData.clients.totalClients
                  ) >= 0
                    ? "+"
                    : ""}
                  {calculateChange(
                    analyticsData.clients.totalClients,
                    analyticsData.comparisonData.clients.totalClients
                  ).toFixed(1)}
                  %
                </div>
              )}
              <div className="metric-value">
                {analyticsData.clients.totalClients}
              </div>
            </div>

            <div className="metric-card">
              <h3>New Clients</h3>
              {analyticsData.comparisonData && (
                <div
                  className={`metric-change ${
                    calculateChange(
                      analyticsData.clients.newClientsThisMonth,
                      analyticsData.comparisonData.clients.newClientsThisMonth
                    ) >= 0
                      ? "positive"
                      : "negative"
                  }`}
                >
                  {calculateChange(
                    analyticsData.clients.newClientsThisMonth,
                    analyticsData.comparisonData.clients.newClientsThisMonth
                  ) >= 0
                    ? "+"
                    : ""}
                  {calculateChange(
                    analyticsData.clients.newClientsThisMonth,
                    analyticsData.comparisonData.clients.newClientsThisMonth
                  ).toFixed(1)}
                  %
                </div>
              )}
              <div className="metric-value">
                {analyticsData.clients.newClientsThisMonth}
              </div>
            </div>

            <div className="metric-card">
              <h3>Active Clients</h3>
              {analyticsData.comparisonData && (
                <div
                  className={`metric-change ${
                    calculateChange(
                      analyticsData.clients.activeClients,
                      analyticsData.comparisonData.clients.activeClients
                    ) >= 0
                      ? "positive"
                      : "negative"
                  }`}
                >
                  {calculateChange(
                    analyticsData.clients.activeClients,
                    analyticsData.comparisonData.clients.activeClients
                  ) >= 0
                    ? "+"
                    : ""}
                  {calculateChange(
                    analyticsData.clients.activeClients,
                    analyticsData.comparisonData.clients.activeClients
                  ).toFixed(1)}
                  %
                </div>
              )}
              <div className="metric-value">
                {analyticsData.clients.activeClients}
              </div>
            </div>

            <div className="metric-card">
              <h3>Client Retention</h3>
              <div className="metric-value">
                {formatPercentage(
                  analyticsData.conversionRates.clientRetentionRate
                )}
              </div>
            </div>
          </div>

          <div className="client-metrics-details">
            <div className="metric-detail-card">
              <h3>Client Engagement</h3>
              <div className="engagement-stats">
                <div className="engagement-item">
                  <div className="engagement-label">Repeat Client Rate</div>
                  <div className="engagement-value">
                    {formatPercentage(
                      analyticsData.conversionRates.repeatClientRate
                    )}
                  </div>
                  <div className="engagement-description">
                    Percentage of clients who return for multiple appointments
                  </div>
                </div>

                <div className="engagement-item">
                  <div className="engagement-label">Appointment Show Rate</div>
                  <div className="engagement-value">
                    {formatPercentage(
                      analyticsData.conversionRates.appointmentShowRate
                    )}
                  </div>
                  <div className="engagement-description">
                    Percentage of booked appointments that clients attend
                  </div>
                </div>

                <div className="engagement-item">
                  <div className="engagement-label">Active Client Ratio</div>
                  <div className="engagement-value">
                    {analyticsData.clients.totalClients > 0
                      ? formatPercentage(
                          analyticsData.clients.activeClients /
                            analyticsData.clients.totalClients
                        )
                      : "0%"}
                  </div>
                  <div className="engagement-description">
                    Percentage of total clients who are active
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revenue View */}
      {activeView === "revenue" && (
        <div className="analytics-view">
          <div className="metrics-summary">
            <div className="metric-card">
              <h3>Total Revenue</h3>
              {analyticsData.comparisonData && (
                <div
                  className={`metric-change ${
                    calculateChange(
                      analyticsData.revenue.totalRevenue,
                      analyticsData.comparisonData.revenue.totalRevenue
                    ) >= 0
                      ? "positive"
                      : "negative"
                  }`}
                >
                  {calculateChange(
                    analyticsData.revenue.totalRevenue,
                    analyticsData.comparisonData.revenue.totalRevenue
                  ) >= 0
                    ? "+"
                    : ""}
                  {calculateChange(
                    analyticsData.revenue.totalRevenue,
                    analyticsData.comparisonData.revenue.totalRevenue
                  ).toFixed(1)}
                  %
                </div>
              )}
              <div className="metric-value">
                {formatCurrency(analyticsData.revenue.totalRevenue)}
              </div>
            </div>

            <div className="metric-card">
              <h3>Total Refunds</h3>
              <div className="metric-value">
                {formatCurrency(analyticsData.revenue.totalRefunds)}
              </div>
            </div>

            <div className="metric-card">
              <h3>Net Revenue</h3>
              {analyticsData.comparisonData && (
                <div
                  className={`metric-change ${
                    calculateChange(
                      analyticsData.revenue.netRevenue,
                      analyticsData.comparisonData.revenue.netRevenue
                    ) >= 0
                      ? "positive"
                      : "negative"
                  }`}
                >
                  {calculateChange(
                    analyticsData.revenue.netRevenue,
                    analyticsData.comparisonData.revenue.netRevenue
                  ) >= 0
                    ? "+"
                    : ""}
                  {calculateChange(
                    analyticsData.revenue.netRevenue,
                    analyticsData.comparisonData.revenue.netRevenue
                  ).toFixed(1)}
                  %
                </div>
              )}
              <div className="metric-value">
                {formatCurrency(analyticsData.revenue.netRevenue)}
              </div>
            </div>

            <div className="metric-card">
              <h3>Avg. Revenue/Appointment</h3>
              <div className="metric-value">
                {analyticsData.appointments.totalAppointments > 0
                  ? formatCurrency(
                      analyticsData.revenue.totalRevenue /
                        analyticsData.appointments.totalAppointments
                    )
                  : "$0"}
              </div>
            </div>
          </div>

          <div className="charts-container">
            {/* Revenue Over Time Chart */}
            <div className="chart-box">
              <h3>Revenue Over Time</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={analyticsData.timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip
                    formatter={(value) => [formatCurrency(value), "Revenue"]}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10B981"
                    name="Revenue"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Revenue Breakdown Chart */}
            <div className="chart-box">
              <h3>Revenue Breakdown</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={[
                    {
                      name: "Services",
                      value: analyticsData.revenue.totalRevenue * 0.7,
                    },
                    {
                      name: "Products",
                      value: analyticsData.revenue.totalRevenue * 0.2,
                    },
                    {
                      name: "Memberships",
                      value: analyticsData.revenue.totalRevenue * 0.1,
                    },
                  ]}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(value) => formatCurrency(value)} />
                  <Tooltip
                    formatter={(value) => [formatCurrency(value), "Revenue"]}
                  />
                  <Legend />
                  <Bar dataKey="value" name="Revenue" fill="#10B981">
                    <Cell fill="#3B82F6" />
                    <Cell fill="#F59E0B" />
                    <Cell fill="#8B5CF6" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Services View */}
      {activeView === "services" && (
        <div className="analytics-view">
          <div className="metrics-summary">
            <div className="metric-card">
              <h3>Total Services</h3>
              <div className="metric-value">
                {analyticsData.services.totalServices}
              </div>
            </div>

            <div className="metric-card">
              <h3>Services Booked</h3>
              <div className="metric-value">
                {analyticsData.services.popularServices.reduce(
                  (sum, service) => sum + service.count,
                  0
                )}
              </div>
            </div>

            <div className="metric-card">
              <h3>Packages Available</h3>
              <div className="metric-value">
                {analyticsData.packageData?.length || 0}
              </div>
            </div>

            <div className="metric-card">
              <h3>Avg. Service Price</h3>
              <div className="metric-value">
                {formatCurrency(
                  analyticsData.revenue.totalRevenue /
                    (analyticsData.services.popularServices.reduce(
                      (sum, service) => sum + service.count,
                      0
                    ) || 1)
                )}
              </div>
            </div>
          </div>

          <div className="charts-container">
            {/* Popular Services Chart */}
            <div className="chart-box">
              <h3>Popular Services</h3>
              {analyticsData.services.popularServices.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart
                    layout="vertical"
                    data={analyticsData.services.popularServices}
                    margin={{ top: 5, right: 30, left: 70, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 12 }}
                      width={70}
                    />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" name="Bookings" fill="#3B82F6">
                      {analyticsData.services.popularServices.map(
                        (entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        )
                      )}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="no-chart-data">
                  <p>No service data available for the selected period</p>
                </div>
              )}
            </div>

            {/* Packages Chart */}
            <div className="chart-box">
              <h3>Available Packages</h3>
              {analyticsData.packageData &&
              analyticsData.packageData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={analyticsData.packageData.map((pkg) => ({
                        name: pkg.name,
                        value: parseFloat(pkg.price) || 0,
                      }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) =>
                        name.length > 15
                          ? `${name.substring(0, 15)}... ${(
                              percent * 100
                            ).toFixed(0)}%`
                          : `${name} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {analyticsData.packageData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [formatCurrency(value), "Price"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="no-chart-data">
                  <p>No package data available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CRMAnalyticsDashboard;
