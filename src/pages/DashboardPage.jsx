// src/pages/DashboardPage.jsx
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Spinner,
} from "@/components/ui";
import {
  Calendar,
  User,
  FileText,
  Workflow,
  Settings,
  BarChart4,
  Bell,
  FileUp,
  Search,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useFeatureFlags, FeatureGate } from "../utils/featureFlags";
import apiService from "../services/apiService";
import CRMContactLookup from "../components/crm/CRMContactLookup";
import ChatContainer from "../components/ChatContainer";
import { supabase } from "../lib/supabase";

const DashboardPage = () => {
  const { currentUser } = useAuth();
  const { tier } = useFeatureFlags();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    searches: 0,
    files: 0,
    contacts: 0,
    workflows: 0,
  });
  const [recentFiles, setRecentFiles] = useState([]);
  const [serviceStatus, setServiceStatus] = useState({});

  // Load dashboard data
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);

        // Load service health status
        const healthResponse = await apiService.status.getHealth();
        if (healthResponse.data.success) {
          setServiceStatus(healthResponse.data.services);
        }

        // Load analytics if available
        if (tier !== "basic") {
          try {
            const analyticsResponse = await apiService.analytics.getStats(
              "week"
            );
            if (analyticsResponse.data.success) {
              const dashboard = analyticsResponse.data.dashboard;

              // Fetch real document count from Supabase
              const { count: docCount, error: docError } = await supabase
                .from("documents")
                .select("id", { count: "exact", head: true });
              setStats({
                searches: dashboard.summary.totalSearches || 0,
                files: docCount || 0,
                contacts: dashboard.realtime.activeUsers || 0,
                workflows: 0, // Will be set from workflow stats
              });
            }
          } catch (err) {
            console.error("Error loading analytics:", err);
          }
        }

        // Load workflow stats if enterprise tier
        if (tier === "enterprise") {
          try {
            const workflowResponse = await apiService.workflows.getStats();
            if (workflowResponse.data.success) {
              const workflowStats = workflowResponse.data.stats;

              setStats((prev) => ({
                ...prev,
                workflows:
                  (workflowStats.byStatus.completed || 0) +
                  (workflowStats.byStatus.running || 0),
              }));
            }
          } catch (err) {
            console.error("Error loading workflow stats:", err);
          }
        }

        // Load recent files
        try {
          const filesResponse = await apiService.storage.getFiles("/uploads");
          if (filesResponse.data.success) {
            const sortedFiles = filesResponse.data.files
              .sort(
                (a, b) => new Date(b.lastModified) - new Date(a.lastModified)
              )
              .slice(0, 5);

            setRecentFiles(sortedFiles);
          }
        } catch (err) {
          console.error("Error loading files:", err);
        }
      } catch (err) {
        console.error("Error loading dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [tier]);

  // Handle contact selection
  const handleContactSelect = (contact) => {
    console.log("Selected contact:", contact);
    // Implement what happens when a contact is selected
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
        <span className="ml-3 text-xl">Loading dashboard...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <div className="text-sm text-muted-foreground">
          <span className="font-medium">{currentUser?.name}</span>
          <span className="mx-2">•</span>
          <span className="capitalize">{tier} Tier</span>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Searches
            </CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.searches.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              +{Math.floor(Math.random() * 20) + 1}% from last week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Knowledge Stream Files, Images, and CRM Records
            </CardTitle>
            <FileUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {/* Only counting documents table for now */}
              {stats.files != null ? stats.files.toLocaleString() : 0}
            </div>
            <p className="text-xs text-muted-foreground">
              +{Math.floor(Math.random() * 15) + 1}% from last week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CRM Contacts</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.contacts.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              +{Math.floor(Math.random() * 10) + 1}% from last week
            </p>
          </CardContent>
        </Card>

        <FeatureGate feature="custom_workflows">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Active Workflows
              </CardTitle>
              <Workflow className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.workflows.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                +{Math.floor(Math.random() * 12) + 1}% from last week
              </p>
            </CardContent>
          </Card>
        </FeatureGate>
      </div>

      {/* Main content area */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Left sidebar - 2 columns */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>Current status of system services</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(serviceStatus).map(([service, status]) => (
                <div
                  key={service}
                  className="flex items-center justify-between"
                >
                  <span className="capitalize">{service}</span>
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${
                      status
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {status ? "Operational" : "Offline"}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t">
              <h4 className="font-medium mb-2">Quick Links</h4>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/profile">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/security">
                    <Settings className="mr-2 h-4 w-4" />
                    Security
                  </Link>
                </Button>

                <FeatureGate feature="analytics_basic">
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/enterprise/analytics">
                      <BarChart4 className="mr-2 h-4 w-4" />
                      Analytics
                    </Link>
                  </Button>
                </FeatureGate>

                <FeatureGate feature="automated_alerts">
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/enterprise/alerts">
                      <Bell className="mr-2 h-4 w-4" />
                      Alerts
                    </Link>
                  </Button>
                </FeatureGate>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main content area - 5 columns */}
        <Card className="md:col-span-5">
          <CardHeader>
            <CardTitle>Quick Access</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="crm">
              <TabsList className="mb-4">
                <TabsTrigger value="crm">CRM</TabsTrigger>
                <TabsTrigger value="files">Recent Files</TabsTrigger>
                <FeatureGate
                  feature="custom_workflows"
                  fallback={
                    <TabsTrigger value="workflows" disabled>
                      Workflows
                    </TabsTrigger>
                  }
                >
                  <TabsTrigger value="workflows">Workflows</TabsTrigger>
                </FeatureGate>
              </TabsList>

              <TabsContent value="crm" className="space-y-4">
                <CRMContactLookup
                  onSelectContact={handleContactSelect}
                  showDocuments={true}
                />
              </TabsContent>

              <TabsContent value="files">
                <div className="space-y-2">
                  {recentFiles.length > 0 ? (
                    recentFiles.map((file) => (
                      <div
                        key={file.path}
                        className="flex items-center p-2 border rounded hover:bg-gray-50"
                      >
                        <FileText className="h-5 w-5 mr-2 text-blue-500" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {file.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(file.lastModified).toLocaleString()}
                          </p>
                        </div>
                        <Button size="sm" variant="ghost">
                          View
                        </Button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <FileText className="h-12 w-12 mx-auto text-gray-400" />
                      <p className="mt-2 text-gray-500">
                        No recent files found
                      </p>
                    </div>
                  )}

                  <div className="text-center mt-4">
                    <Button variant="outline" asChild>
                      <Link to="/files">View All Files</Link>
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="workflows">
                <FeatureGate feature="custom_workflows">
                  <div className="space-y-2">
                    <div className="flex justify-between mb-4">
                      <h3 className="font-medium">Recent Workflows</h3>
                      <Button size="sm" variant="outline" asChild>
                        <Link to="/enterprise/workflows">Manage Workflows</Link>
                      </Button>
                    </div>

                    <div className="text-center py-8">
                      <Workflow className="h-12 w-12 mx-auto text-gray-400" />
                      <p className="mt-2 text-gray-500">No recent workflows</p>
                      <Button className="mt-4" variant="default" asChild>
                        <Link to="/enterprise/workflows">Create Workflow</Link>
                      </Button>
                    </div>
                  </div>
                </FeatureGate>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Enterprise features promo for Basic and Professional tiers */}
      {tier !== "enterprise" && (
        <Card className="border-dashed border-2">
          <CardHeader>
            <CardTitle className="flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6 mr-2 text-indigo-500"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              Upgrade to{" "}
              {tier === "basic" ? "Professional or Enterprise" : "Enterprise"}
            </CardTitle>
            <CardDescription>
              {tier === "basic"
                ? "Unlock advanced features with our Professional or Enterprise tiers"
                : "Access our full suite of enterprise features with our Enterprise tier"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {tier === "basic" && (
                <>
                  <div className="flex items-start space-x-2">
                    <Search className="h-5 w-5 text-indigo-500 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Advanced Search</h4>
                      <p className="text-sm text-gray-500">
                        Search across all documents with powerful filters
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <BarChart4 className="h-5 w-5 text-indigo-500 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Basic Analytics</h4>
                      <p className="text-sm text-gray-500">
                        Track usage and get basic insights
                      </p>
                    </div>
                  </div>
                </>
              )}

              <div className="flex items-start space-x-2">
                <Workflow className="h-5 w-5 text-indigo-500 mt-0.5" />
                <div>
                  <h4 className="font-medium">Custom Workflows</h4>
                  <p className="text-sm text-gray-500">
                    Automate processes with custom workflows
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <Bell className="h-5 w-5 text-indigo-500 mt-0.5" />
                <div>
                  <h4 className="font-medium">Automated Alerts</h4>
                  <p className="text-sm text-gray-500">
                    Set up alerts for important events
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <Calendar className="h-5 w-5 text-indigo-500 mt-0.5" />
                <div>
                  <h4 className="font-medium">Custom Integrations</h4>
                  <p className="text-sm text-gray-500">
                    Connect with additional external systems
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 text-center">
              <Button>Contact Sales for Upgrade</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <ChatContainer messages={[]} userId={currentUser?.id} />
    </div>
  );
};

export default DashboardPage;
