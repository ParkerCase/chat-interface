// src/utils/analyticsUtils.js - Create this file

/**
 * Utility functions for analytics on the frontend
 */
import apiService from "../services/apiService";
import React, { useEffect } from "react";

// Event Types - should match backend constants
export const EVENT_TYPES = {
  // UI events
  UI_PAGE_VIEW: "ui:page_view",
  UI_BUTTON_CLICK: "ui:button_click",
  UI_FEATURE_USED: "ui:feature_used",
  UI_MODAL_OPEN: "ui:modal_open",
  UI_SEARCH_USED: "ui:search_used",
  UI_ERROR: "ui:error",

  // User events
  USER_SESSION_START: "user:session_start",
  USER_SESSION_END: "user:session_end",

  // Feature usage
  FEATURE_CHAT: "feature:chat",
  FEATURE_IMAGE_SEARCH: "feature:image_search",
  FEATURE_DOCUMENT_UPLOAD: "feature:document_upload",
  FEATURE_API_KEY: "feature:api_key",
  FEATURE_CRM: "feature:crm",
};

/**
 * Track a user event on the frontend
 * @param {String} eventType - Type of event to track
 * @param {Object} eventData - Additional event data
 */
export const trackEvent = async (eventType, eventData = {}) => {
  try {
    // Add standard data to all events
    const enrichedData = {
      ...eventData,
      url: window.location.href,
      path: window.location.pathname,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      // Add session ID if available
      sessionId: localStorage.getItem("sessionId") || null,
    };

    // Post to backend analytics endpoint
    await apiService.post("/api/analytics/events", {
      eventType,
      data: enrichedData,
    });
  } catch (error) {
    // Silently fail - analytics should never break the app
    console.warn("Failed to track analytics event:", error);
  }
};

/**
 * Track a page view
 * @param {String} pageName - Name of the page
 * @param {Object} additionalData - Any additional data to track
 */
export const trackPageView = (pageName, additionalData = {}) => {
  trackEvent(EVENT_TYPES.UI_PAGE_VIEW, {
    pageName,
    ...additionalData,
  });
};

/**
 * Track a button click
 * @param {String} buttonName - Name of the button
 * @param {Object} additionalData - Any additional data to track
 */
export const trackButtonClick = (buttonName, additionalData = {}) => {
  trackEvent(EVENT_TYPES.UI_BUTTON_CLICK, {
    buttonName,
    ...additionalData,
  });
};

/**
 * Track a feature being used
 * @param {String} featureName - Name of the feature
 * @param {Object} additionalData - Any additional data to track
 */
export const trackFeatureUsed = (featureName, additionalData = {}) => {
  trackEvent(EVENT_TYPES.UI_FEATURE_USED, {
    featureName,
    ...additionalData,
  });
};

/**
 * Track an error occurring on the frontend
 * @param {Error} error - The error object
 * @param {String} context - Context where the error occurred
 */
export const trackError = (error, context) => {
  trackEvent(EVENT_TYPES.UI_ERROR, {
    message: error.message,
    stack: error.stack,
    context,
  });
};

/**
 * Create a higher-order component for tracking page views
 * @param {Component} WrappedComponent - The component to wrap
 * @param {String} pageName - Name of the page for analytics
 */
export const withPageTracking = (WrappedComponent, pageName) => {
  const WithPageTracking = (props) => {
    useEffect(() => {
      trackPageView(pageName);
    }, []);

    return <WrappedComponent {...props} />;
  };

  WithPageTracking.displayName = `WithPageTracking(${getDisplayName(
    WrappedComponent
  )})`;
  return WithPageTracking;
};

// Helper to get component display name
function getDisplayName(WrappedComponent) {
  return WrappedComponent.displayName || WrappedComponent.name || "Component";
}

// Export an object with all methods
const analyticsUtils = {
  EVENT_TYPES,
  trackEvent,
  trackPageView,
  trackButtonClick,
  trackFeatureUsed,
  trackError,
  withPageTracking,
};

export default analyticsUtils;
