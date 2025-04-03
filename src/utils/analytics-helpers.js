// src/utils/analytics-helpers.js
// This file serves as a compatibility layer for the analytics utilities

import analyticsUtils from "./analyticsUtils";

// Re-export everything from analyticsUtils
const analyticsHelpers = {
  ...analyticsUtils,

  // Add the trackServerEvent function that's being called in ChatbotTabContent.jsx
  trackServerEvent: (req, eventType, eventData = {}) => {
    // This function emulates a server-side tracking function
    // but runs in the client
    try {
      // Strip the request object (not needed in client-side)
      const cleanedData = { ...eventData };

      // Track using the client-side method
      analyticsUtils.trackEvent(eventType, cleanedData);

      return true;
    } catch (error) {
      console.warn("Failed to track analytics event:", error);
      return false;
    }
  },

  // Make sure EVENT_TYPES is exposed properly
  EVENT_TYPES: {
    ...analyticsUtils.EVENT_TYPES,
    // Add any additional event types needed by ChatbotTabContent
    IMAGE_VIEW: "image:view",
  },
};

export default analyticsHelpers;
