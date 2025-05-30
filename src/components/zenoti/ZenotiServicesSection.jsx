import React, { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "../../lib/supabase";
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
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  InputAdornment,
  Chip,
  IconButton,
  Card,
  CardContent,
  Grid,
} from "@mui/material";
import {
  Search,
  Refresh,
  Visibility,
  AttachMoney,
  Schedule,
  Category,
} from "@mui/icons-material";

const ZenotiServicesSection = ({
  selectedCenter,
  centerMapping = {},
  onRefresh,
}) => {
  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalServices, setTotalServices] = useState(0);

  // Memoized center mapping
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

  // Utility to extract data from details JSON
  const extractFromDetails = useCallback((details, path, fallback = null) => {
    if (!details || typeof details !== "object") return fallback;

    const pathArray = path.split(".");
    let current = details;

    for (const key of pathArray) {
      if (current && typeof current === "object" && key in current) {
        current = current[key];
      } else {
        return fallback;
      }
    }

    return current !== null && current !== undefined ? current : fallback;
  }, []);

  // Format currency
  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Format duration
  const formatDuration = (minutes) => {
    if (!minutes && minutes !== 0) return "N/A";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Fetch services from Supabase
  const fetchServices = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log("Fetching services for center:", selectedCenter);
      console.log("Center mapping:", centerMapping);

      // Since all services are stored under center_id d406abe6-6118-4d52-9794-546729918f52
      // but are available to all centers, we always fetch ALL services
      let query = supabase
        .from("zenoti_services")
        .select("*", { count: "exact" });

      // Apply search filter if provided
      if (searchTerm.trim()) {
        const search = searchTerm.trim();
        query = query.or(
          `name.ilike.%${search}%,code.ilike.%${search}%,description.ilike.%${search}%,category.ilike.%${search}%`
        );
      }

      // Apply pagination
      const from = page * rowsPerPage;
      const to = from + rowsPerPage - 1;
      query = query.range(from, to);

      // Order by name
      query = query.order("name", { ascending: true });

      const { data, error, count } = await query;

      if (error) throw error;

      console.log("Services query result:", {
        data: data?.length,
        count,
        selectedCenter,
        note: "All services are shared across centers",
      });

      // Process services data
      const processedServices = (data || []).map((row) => {
        const details = row.details || {};
        const priceInfo = details.price_info || {};

        return {
          id: row.id,
          code: row.code || details.code || "N/A",
          name: row.name || details.name || "Unknown Service",
          description: row.description || details.description || "",
          category:
            row.category ||
            extractFromDetails(details, "additional_info.category.name") ||
            "Uncategorized",
          duration: row.duration || details.duration || 0,
          price:
            row.price || priceInfo.sale_price || priceInfo.final_price || 0,
          center_id: row.center_id,
          center_code: "All Centers", // Since services are shared across all centers
          is_active: details.active !== false, // Default to true if not specified
          recovery_time: details.recovery_time || 0,
          image_paths: details.image_paths,
          prerequisites: extractFromDetails(details, "prerequisites_info"),
          parallel_groups: details.parallel_groups,
          is_couple_service: details.is_couple_service || false,
          _raw: details,
        };
      });

      setServices(processedServices);
      setTotalServices(count || 0);

      console.log("Final processed services:", processedServices.length);
    } catch (err) {
      console.error("Error fetching services:", err);
      setError(`Failed to fetch services: ${err.message}`);
      setServices([]);
      setTotalServices(0);
    } finally {
      setIsLoading(false);
    }
  }, [
    searchTerm,
    page,
    rowsPerPage,
    selectedCenter, // Keep this for consistency but don't use it for filtering
    extractFromDetails,
  ]);

  // Load services on mount and when dependencies change
  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  // Reset page when search or center changes
  useEffect(() => {
    setPage(0);
  }, [searchTerm, selectedCenter]);

  // Refresh function
  const handleRefresh = useCallback(() => {
    fetchServices();
    if (onRefresh) {
      onRefresh();
    }
  }, [fetchServices, onRefresh]);

  // Get summary statistics
  const summaryStats = useMemo(() => {
    const totalActive = services.filter((s) => s.is_active).length;
    const avgPrice =
      services.length > 0
        ? services.reduce((sum, s) => sum + (s.price || 0), 0) / services.length
        : 0;
    const avgDuration =
      services.length > 0
        ? services.reduce((sum, s) => sum + (s.duration || 0), 0) /
          services.length
        : 0;
    const categories = new Set(services.map((s) => s.category)).size;

    return {
      total: totalServices, // Use total from query, not filtered results
      active: totalActive,
      avgPrice,
      avgDuration,
      categories,
    };
  }, [services, totalServices]);

  return (
    <Paper
      elevation={1}
      sx={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 2,
          }}
        >
          <Typography variant="h6">Services</Typography>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <IconButton onClick={handleRefresh} disabled={isLoading}>
              <Refresh />
            </IconButton>
          </Box>
        </Box>

        {/* Debug Info */}
        {process.env.NODE_ENV === "development" && (
          <Box sx={{ mb: 2, p: 1, bgcolor: "#f5f5f5", borderRadius: 1 }}>
            <Typography variant="caption" display="block">
              Debug: Selected Center: {selectedCenter} | Center ID:{" "}
              {centerCodeToId[selectedCenter] || "N/A"} | Services Found:{" "}
              {services.length} | Total Count: {totalServices}
            </Typography>
          </Box>
        )}

        {/* Summary Cards */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Total Services
                </Typography>
                <Typography variant="h6">
                  {summaryStats.total.toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Active Services
                </Typography>
                <Typography variant="h6">{summaryStats.active}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Avg Price
                </Typography>
                <Typography variant="h6">
                  {formatCurrency(summaryStats.avgPrice)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Avg Duration
                </Typography>
                <Typography variant="h6">
                  {formatDuration(summaryStats.avgDuration)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Categories
                </Typography>
                <Typography variant="h6">{summaryStats.categories}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Search */}
        <TextField
          size="small"
          placeholder="Search services by name, code, or category..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
          sx={{ width: "100%", maxWidth: 400 }}
        />
      </Box>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ m: 2 }}>
          {error}
        </Alert>
      )}

      {/* Services Table */}
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
        ) : services.length === 0 ? (
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
              No services found
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {searchTerm
                ? "Try adjusting your search criteria"
                : "No services are available in the database"}
            </Typography>
            <Button variant="outlined" onClick={handleRefresh}>
              Refresh
            </Button>
          </Box>
        ) : (
          <TableContainer sx={{ height: "100%" }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Code</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell align="right">
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        gap: 0.5,
                      }}
                    >
                      <Schedule fontSize="small" />
                      Duration
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        gap: 0.5,
                      }}
                    >
                      <AttachMoney fontSize="small" />
                      Price
                    </Box>
                  </TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Center</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {services.map((service) => (
                  <TableRow key={service.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {service.code}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {service.name}
                        </Typography>
                        {service.description && (
                          <Typography
                            variant="caption"
                            color="textSecondary"
                            noWrap
                          >
                            {service.description.length > 50
                              ? `${service.description.substring(0, 50)}...`
                              : service.description}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={service.category}
                        size="small"
                        variant="outlined"
                        icon={<Category fontSize="small" />}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">
                        {formatDuration(service.duration)}
                      </Typography>
                      {service.recovery_time > 0 && (
                        <Typography
                          variant="caption"
                          color="textSecondary"
                          display="block"
                        >
                          +{formatDuration(service.recovery_time)} recovery
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium">
                        {formatCurrency(service.price)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={service.is_active ? "Active" : "Inactive"}
                        size="small"
                        color={service.is_active ? "success" : "default"}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={service.center_code}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => setSelectedService(service)}
                        color="primary"
                      >
                        <Visibility fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* Pagination */}
      <TablePagination
        component="div"
        count={totalServices}
        page={page}
        onPageChange={(e, newPage) => setPage(newPage)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => {
          setRowsPerPage(parseInt(e.target.value, 10));
          setPage(0);
        }}
        rowsPerPageOptions={[10, 25, 50, 100]}
      />

      {/* Service Detail Modal */}
      <Dialog
        open={!!selectedService}
        onClose={() => setSelectedService(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Service Details: {selectedService?.name}</DialogTitle>
        <DialogContent>
          {selectedService && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {/* Basic Information */}
              <Box>
                <Typography variant="h6" gutterBottom>
                  Basic Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="textSecondary">
                      Service Code
                    </Typography>
                    <Typography variant="body1" fontFamily="monospace">
                      {selectedService.code}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="textSecondary">
                      Category
                    </Typography>
                    <Typography variant="body1">
                      {selectedService.category}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="textSecondary">
                      Duration
                    </Typography>
                    <Typography variant="body1">
                      {formatDuration(selectedService.duration)}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="textSecondary">
                      Price
                    </Typography>
                    <Typography variant="body1">
                      {formatCurrency(selectedService.price)}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="textSecondary">
                      Recovery Time
                    </Typography>
                    <Typography variant="body1">
                      {formatDuration(selectedService.recovery_time)}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="textSecondary">
                      Status
                    </Typography>
                    <Chip
                      label={selectedService.is_active ? "Active" : "Inactive"}
                      size="small"
                      color={selectedService.is_active ? "success" : "default"}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="textSecondary">
                      Center
                    </Typography>
                    <Typography variant="body1">
                      {selectedService.center_code}
                    </Typography>
                  </Grid>
                  {selectedService.description && (
                    <Grid item xs={12}>
                      <Typography variant="body2" color="textSecondary">
                        Description
                      </Typography>
                      <Typography variant="body1">
                        {selectedService.description}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </Box>

              {/* Additional Features */}
              {(selectedService.is_couple_service ||
                selectedService.parallel_groups) && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Service Features
                  </Typography>
                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                    {selectedService.is_couple_service && (
                      <Chip label="Couple Service" size="small" color="info" />
                    )}
                    {selectedService.parallel_groups && (
                      <Chip
                        label="Parallel Groups Available"
                        size="small"
                        color="info"
                      />
                    )}
                  </Box>
                </Box>
              )}

              {/* Raw Data */}
              <Box>
                <Typography variant="h6" gutterBottom>
                  Raw Service Data
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
                    fontFamily: "monospace",
                  }}
                >
                  {JSON.stringify(selectedService._raw, null, 2)}
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedService(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default ZenotiServicesSection;
