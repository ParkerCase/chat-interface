// src/components/UpgradePrompt.jsx
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
} from "@/components/ui";
import {
  X,
  CheckCircle,
  ChevronRight,
  Crown,
  Rocket,
  Star,
} from "lucide-react";
import { useFeatureFlags } from "../utils/featureFlags";

// Feature descriptions for the upgrade prompts
const featureDescriptions = {
  custom_workflows: {
    title: "Custom Workflows",
    description: "Automate business processes with custom workflows",
    tier: "enterprise",
    icon: <Rocket className="h-5 w-5 text-indigo-500" />,
  },
  advanced_analytics: {
    title: "Advanced Analytics",
    description: "Gain deeper insights with comprehensive analytics",
    tier: "enterprise",
    icon: <Rocket className="h-5 w-5 text-indigo-500" />,
  },
  automated_alerts: {
    title: "Automated Alerts",
    description: "Configure custom alerts based on system metrics",
    tier: "enterprise",
    icon: <Rocket className="h-5 w-5 text-indigo-500" />,
  },
  custom_integrations: {
    title: "Custom Integrations",
    description: "Connect with additional external systems",
    tier: "enterprise",
    icon: <Rocket className="h-5 w-5 text-indigo-500" />,
  },
  advanced_search: {
    title: "Advanced Search",
    description: "Powerful search capabilities across all content",
    tier: "professional",
    icon: <Star className="h-5 w-5 text-yellow-500" />,
  },
  image_search: {
    title: "Image Search",
    description: "Search by uploading or selecting images",
    tier: "professional",
    icon: <Star className="h-5 w-5 text-yellow-500" />,
  },
  file_upload: {
    title: "Enhanced File Upload",
    description: "Upload and process larger files with more formats",
    tier: "professional",
    icon: <Star className="h-5 w-5 text-yellow-500" />,
  },
  data_export: {
    title: "Data Export",
    description: "Export data in various formats for analysis",
    tier: "professional",
    icon: <Star className="h-5 w-5 text-yellow-500" />,
  },
};

// Default descriptions for generic features
const defaultFeatureDescriptions = {
  enterprise: {
    title: "Enterprise Feature",
    description: "This feature is only available in the Enterprise tier",
    icon: <Crown className="h-5 w-5 text-indigo-500" />,
  },
  professional: {
    title: "Professional Feature",
    description:
      "This feature is only available in the Professional tier or higher",
    icon: <Star className="h-5 w-5 text-yellow-500" />,
  },
};

const UpgradePrompt = ({ feature, onClose }) => {
  const { tier } = useFeatureFlags();

  // Get feature info or default info based on required tier
  const featureInfo =
    featureDescriptions[feature] ||
    (feature?.includes("enterprise")
      ? defaultFeatureDescriptions.enterprise
      : defaultFeatureDescriptions.professional);

  const tierRequired = featureInfo.tier || "professional";
  const currentTierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);

  // Determine which plans to show based on current tier
  const showEnterprise = tier !== "enterprise";
  const showProfessional = tier === "basic" && tierRequired === "professional";

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {featureInfo.icon}
            {featureInfo.title} - Upgrade Required
          </DialogTitle>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        </DialogHeader>

        <div className="mt-2 space-y-6">
          <div className="text-center">
            <p className="text-lg font-medium">
              You're currently on the{" "}
              <Badge variant="outline">{currentTierLabel}</Badge> plan
            </p>
            <p className="mt-2 text-muted-foreground">
              To access {featureInfo.title}, you need to upgrade to the{" "}
              {tierRequired.charAt(0).toUpperCase() + tierRequired.slice(1)}{" "}
              plan.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {showProfessional && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-500" />
                    Professional
                  </CardTitle>
                  <CardDescription>$5,000 - $10,000</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                      <span>Everything in Basic, plus:</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                      <span>Custom knowledge base structure</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                      <span>2-3 system integrations</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                      <span>Customized UI and branding</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            )}

            {showEnterprise && (
              <Card className={!showProfessional ? "sm:col-span-2" : ""}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-indigo-500" />
                    Enterprise
                  </CardTitle>
                  <CardDescription>$15,000 - $25,000</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                      <span>Everything in Professional, plus:</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                      <span>Fully customized implementation</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                      <span>Unlimited system integrations</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                      <span>Advanced security features (SSO)</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-3 mt-6">
          <Button
            onClick={onClose}
            variant="outline"
            className="sm:w-auto w-full"
          >
            Continue with current plan
          </Button>
          <Button className="sm:w-auto w-full">
            Contact sales for upgrade
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UpgradePrompt;
