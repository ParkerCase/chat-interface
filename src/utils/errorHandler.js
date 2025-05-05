// src/utils/errorHandler.js
/**
 * Standardized error handling utility for Tatt2Away application
 */

export const ErrorTypes = {
  AUTHENTICATION: "AUTH_ERROR",
  AUTHORIZATION: "AUTH_Z_ERROR",
  VALIDATION: "VALIDATION_ERROR",
  NETWORK: "NETWORK_ERROR",
  DATABASE: "DATABASE_ERROR",
  SUPABASE: "SUPABASE_ERROR",
  ZENOTI: "ZENOTI_ERROR",
  FILE_UPLOAD: "FILE_UPLOAD_ERROR",
  UNKNOWN: "UNKNOWN_ERROR",
};

/**
 * Standardized error class for better error handling
 */
export class AppError extends Error {
  constructor(type, message, originalError = null, context = {}) {
    super(message);
    this.name = "AppError";
    this.type = type;
    this.originalError = originalError;
    this.context = context;
    this.timestamp = new Date().toISOString();
    this.code = originalError?.code || type;
    this.status = originalError?.status || 500;
  }

  toJSON() {
    return {
      type: this.type,
      message: this.message,
      code: this.code,
      status: this.status,
      context: this.context,
      timestamp: this.timestamp,
      stack: process.env.NODE_ENV === "development" ? this.stack : undefined,
    };
  }
}

/**
 * Handle Supabase-specific errors
 */
export const handleSupabaseError = (error, context = {}) => {
  console.error("Supabase Error:", error);

  // Handle specific Supabase error codes
  if (error.code === "PGRST301") {
    return new AppError(
      ErrorTypes.AUTHORIZATION,
      "You do not have permission to perform this action",
      error,
      context
    );
  }

  if (error.code === "PGRST116") {
    return new AppError(ErrorTypes.DATABASE, "No rows found", error, context);
  }

  if (error.code === "42P01") {
    return new AppError(
      ErrorTypes.DATABASE,
      "Table does not exist",
      error,
      context
    );
  }

  if (error.message?.includes("JWT expired")) {
    return new AppError(
      ErrorTypes.AUTHENTICATION,
      "Your session has expired. Please login again.",
      error,
      context
    );
  }

  return new AppError(
    ErrorTypes.SUPABASE,
    error.message || "A database error occurred",
    error,
    context
  );
};

/**
 * Handle authentication errors
 */
export const handleAuthError = (error, context = {}) => {
  console.error("Auth Error:", error);

  if (error.message?.includes("Invalid login credentials")) {
    return new AppError(
      ErrorTypes.AUTHENTICATION,
      "Invalid email or password",
      error,
      context
    );
  }

  if (error.message?.includes("Email not confirmed")) {
    return new AppError(
      ErrorTypes.AUTHENTICATION,
      "Please verify your email before logging in",
      error,
      context
    );
  }

  return new AppError(
    ErrorTypes.AUTHENTICATION,
    error.message || "Authentication failed",
    error,
    context
  );
};

/**
 * Handle API errors (for external services like Zenoti)
 */
export const handleApiError = (error, context = {}) => {
  console.error("API Error:", error);

  if (error.response?.status === 401) {
    return new AppError(
      ErrorTypes.AUTHENTICATION,
      "API authentication failed. Please check your credentials.",
      error,
      context
    );
  }

  if (error.response?.status === 403) {
    return new AppError(
      ErrorTypes.AUTHORIZATION,
      "You do not have permission to access this resource",
      error,
      context
    );
  }

  if (error.response?.status === 429) {
    return new AppError(
      ErrorTypes.NETWORK,
      "Too many requests. Please try again later.",
      error,
      context
    );
  }

  return new AppError(
    ErrorTypes.NETWORK,
    error.message || "An API error occurred",
    error,
    context
  );
};

/**
 * Generic error handler that can route to specific handlers
 */
export const handleError = (error, context = {}) => {
  // If it's already an AppError, return it
  if (error instanceof AppError) {
    return error;
  }

  // Route to specific handlers based on error type or context
  if (error.name === "PostgrestError" || error.code?.startsWith("PG")) {
    return handleSupabaseError(error, context);
  }

  if (error.response?.config?.baseURL?.includes("zenoti")) {
    return handleApiError(error, context);
  }

  if (error.message?.includes("auth") || error.code?.includes("AUTH")) {
    return handleAuthError(error, context);
  }

  // Default to unknown error
  return new AppError(
    ErrorTypes.UNKNOWN,
    error.message || "An unexpected error occurred",
    error,
    context
  );
};

/**
 * Format error for user display
 */
export const formatErrorForUser = (error) => {
  const appError = handleError(error);

  // Translate technical errors to user-friendly messages
  const userMessages = {
    [ErrorTypes.AUTHENTICATION]:
      "Authentication failed. Please check your credentials.",
    [ErrorTypes.AUTHORIZATION]:
      "You do not have permission to perform this action.",
    [ErrorTypes.VALIDATION]: "Please check your input and try again.",
    [ErrorTypes.NETWORK]: "Network error. Please check your connection.",
    [ErrorTypes.DATABASE]: "Database error. Please try again later.",
    [ErrorTypes.SUPABASE]: "Database connection error. Please try again.",
    [ErrorTypes.ZENOTI]: "External service error. Please try again later.",
    [ErrorTypes.FILE_UPLOAD]: "File upload failed. Please try again.",
    [ErrorTypes.UNKNOWN]: "An unexpected error occurred. Please try again.",
  };

  return userMessages[appError.type] || appError.message;
};

/**
 * Log error to monitoring service (extend as needed)
 */
export const logError = (error, context = {}) => {
  const appError = handleError(error);

  // In development, log full error
  if (process.env.NODE_ENV === "development") {
    console.error("Error logged:", appError.toJSON());
  }

  // In production, send to monitoring service
  if (process.env.NODE_ENV === "production") {
    // Here you would send to your error monitoring service
    // Example: Sentry, LogRocket, etc.
    try {
      // Send to monitoring service
      // await monitoringService.log(appError);
    } catch (loggingError) {
      console.error("Failed to log error:", loggingError);
    }
  }

  return appError;
};

/**
 * Create success response
 */
export const createSuccessResponse = (data, message = null) => {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  };
};

/**
 * Create error response
 */
export const createErrorResponse = (error, context = {}) => {
  const appError = handleError(error, context);

  return {
    success: false,
    error: appError.toJSON(),
    timestamp: new Date().toISOString(),
  };
};

// Export everything needed
export default {
  handleError,
  handleSupabaseError,
  handleAuthError,
  handleApiError,
  formatErrorForUser,
  logError,
  createSuccessResponse,
  createErrorResponse,
  AppError,
  ErrorTypes,
};
