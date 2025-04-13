// src/utils/analytics-helpers.js
// This file serves as a compatibility layer for the analytics utilities

import analyticsUtils from "./analyticsUtils";

// Define CRM-specific event types to add to the existing ones
const CRM_EVENT_TYPES = {
  // CRM-related events
  CRM_CONTACT_LOOKUP: "crm:contact_lookup",
  CRM_CONTACT_CREATE: "crm:contact_create",
  CRM_CONTACT_UPDATE: "crm:contact_update",
  CRM_CONTACT_DELETE: "crm:contact_delete",
  CRM_CONTACT_VIEW: "crm:contact_view",
  CRM_CONTACT_SEARCH: "crm:contact_search",
  CRM_CONTACT_SELECT: "crm:contact_select",

  // Document events
  CRM_DOCUMENT_LINK: "crm:document_link",
  CRM_DOCUMENT_VIEW: "crm:document_view",

  // Appointment events
  CRM_APPOINTMENT_CREATE: "crm:appointment_create",
  CRM_APPOINTMENT_CANCEL: "crm:appointment_cancel",
  CRM_APPOINTMENT_RESCHEDULE: "crm:appointment_reschedule",
  CRM_APPOINTMENT_VIEW: "crm:appointment_view",

  // Report events
  CRM_REPORT_GENERATE: "crm:report_generate",
  CRM_REPORT_EXPORT: "crm:report_export",
  CRM_REPORT_SHARE: "crm:report_share",

  // Import/export events
  CRM_FILE_UPLOAD: "crm:file_upload",
  CRM_IMPORT_START: "crm:import_start",
  CRM_IMPORT_COMPLETE: "crm:import_complete",
  CRM_EXPORT: "crm:export",

  // Connection events
  CRM_CONNECTION_ERROR: "crm:connection_error",
  CRM_CONNECTION_SUCCESS: "crm:connection_success",

  // Analytics events
  CRM_ANALYTICS_VIEW: "crm:analytics_view",
  CRM_ANALYTICS_EXPORT: "crm:analytics_export",
};

// Re-export everything from analyticsUtils with our additions
const analyticsHelpers = {
  ...analyticsUtils,

  // Add the trackServerEvent function that's being called in backend code
  trackServerEvent: (req, eventType, eventData = {}) => {
    // This function emulates a server-side tracking function
    // but runs in the client
    try {
      // Strip the request object (not needed in client-side)
      const cleanedData = { ...eventData };

      // Add timestamp if not present
      if (!cleanedData.timestamp) {
        cleanedData.timestamp = new Date().toISOString();
      }

      // Track using the client-side method
      analyticsUtils.trackEvent(eventType, cleanedData);

      return true;
    } catch (error) {
      console.warn("Failed to track analytics event:", error);
      return false;
    }
  },

  // Make sure EVENT_TYPES is exposed properly with all our additions
  EVENT_TYPES: {
    ...analyticsUtils.EVENT_TYPES,
    ...CRM_EVENT_TYPES,
    // Add any additional event types needed by other components
    IMAGE_VIEW: "image:view",
  },

  // Add trackError if not already in analyticsUtils
  trackError:
    analyticsUtils.trackError ||
    ((error, context = "unknown") => {
      try {
        const errorProperties = {
          message: error.message,
          stack: error.stack,
          context,
          timestamp: new Date().toISOString(),
        };

        // Add response data if available
        if (error.response) {
          errorProperties.responseStatus = error.response.status;
          errorProperties.responseData = JSON.stringify(
            error.response.data
          ).substring(0, 500);
        }

        analyticsUtils.trackEvent("error", errorProperties);
      } catch (e) {
        console.error("Error tracking error event:", e);
      }
    }),
};

export default analyticsHelpers;
