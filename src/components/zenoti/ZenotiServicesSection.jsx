import React, { useState, useMemo } from "react";
import {
  Box,
  Typography,
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

const ZenotiServicesSection = ({ onRefresh }) => {
  // Hardcoded services data based on your SQL
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

  // State management
  const [selectedService, setSelectedService] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

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

  // Filter services based on search term
  const filteredServices = useMemo(() => {
    if (!searchTerm.trim()) return allServices;

    const search = searchTerm.toLowerCase().trim();
    return allServices.filter(
      (service) =>
        service.name.toLowerCase().includes(search) ||
        service.code.toLowerCase().includes(search) ||
        service.description.toLowerCase().includes(search) ||
        service.category.toLowerCase().includes(search)
    );
  }, [searchTerm]);

  // Get paginated services
  const paginatedServices = useMemo(() => {
    const startIndex = page * rowsPerPage;
    return filteredServices.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredServices, page, rowsPerPage]);

  // Reset page when search changes
  React.useEffect(() => {
    setPage(0);
  }, [searchTerm]);

  // Get summary statistics
  const summaryStats = useMemo(() => {
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
            <IconButton onClick={onRefresh}>
              <Refresh />
            </IconButton>
          </Box>
        </Box>

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

      {/* Services Table */}
      <Box sx={{ flex: 1, overflow: "hidden" }}>
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
                <TableCell>Availability</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedServices.map((service) => (
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
                      label="All Centers"
                      size="small"
                      variant="outlined"
                      color="primary"
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
      </Box>

      {/* Pagination */}
      <TablePagination
        component="div"
        count={filteredServices.length}
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
                      Availability
                    </Typography>
                    <Typography variant="body1">All Centers</Typography>
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
              {selectedService.is_couple_service && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Service Features
                  </Typography>
                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                    <Chip label="Couple Service" size="small" color="info" />
                  </Box>
                </Box>
              )}
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
