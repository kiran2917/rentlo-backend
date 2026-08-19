import { toast } from "react-toastify";

/**
 * Human-Centric API Error Handler Utility
 * Parses HTTP responses and JS exceptions to return clear, actionable feedback to users.
 * 
 * @param {Response|null} res - The fetch Response object (if available)
 * @param {Object|string|null} data - Parsed JSON response body or error object
 * @param {string} fallbackMsg - Contextual fallback message if no specific detail is found
 * @param {boolean} showToast - Whether to trigger toast.error automatically (default: true)
 * @returns {string} - Clean human-friendly error message
 */
export const handleApiError = (
  res = null,
  data = null,
  fallbackMsg = "An unexpected error occurred. Please try again.",
  showToast = true
) => {
  let message = fallbackMsg;

  // 1. Handle HTTP Status Codes
  if (res) {
    const status = res.status;

    if (status === 401) {
      message = "Please sign in to complete this action.";
    } else if (status === 403) {
      message = data?.detail || "Access restricted. Your account level does not have permission for this action.";
    } else if (status === 404) {
      message = data?.detail || "The requested listing or item is no longer available.";
    } else if (status === 429) {
      message = data?.detail || "API rate limit reached to prevent automated scraping. Please wait a moment before trying again.";
    } else if (status >= 500) {
      message = "The server encountered a temporary issue. Please try again in a few moments.";
    }
  }

  // 2. Handle Specific Validation Errors from Django REST Framework (400 Bad Request)
  if (data && typeof data === "object") {
    if (data.detail && typeof data.detail === "string") {
      // Replace raw DRF technical jargon with friendly human sentences
      if (data.detail.includes("Authentication credentials were not provided")) {
        message = "Please sign in to continue.";
      } else if (data.detail.includes("Method") && data.detail.includes("not allowed")) {
        message = "This action is temporarily unavailable.";
      } else if (data.detail.includes("matching query does not exist")) {
        message = "This property listing is no longer available.";
      } else {
        message = data.detail;
      }
    } else if (data.non_field_errors && Array.isArray(data.non_field_errors)) {
      message = data.non_field_errors.join(" ");
    } else {
      // Handle Django field error dictionaries e.g. { phone: ["Mobile number already exists."] }
      const fieldErrors = [];
      for (const [key, val] of Object.entries(data)) {
        const fieldName = key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
        if (Array.isArray(val)) {
          fieldErrors.push(`${fieldName}: ${val.join(" ")}`);
        } else if (typeof val === "string") {
          fieldErrors.push(`${fieldName}: ${val}`);
        }
      }
      if (fieldErrors.length > 0) {
        message = fieldErrors.join(" • ");
      }
    }
  } else if (typeof data === "string" && data.trim()) {
    message = data;
  }

  // 3. Handle JS Fetch Network Failures
  if (data instanceof Error || (res === null && !data)) {
    if (data?.message?.includes("Failed to fetch") || data?.name === "TypeError") {
      message = "Unable to connect to server. Please check your internet connection.";
    }
  }

  if (showToast) {
    toast.error(message, { toastId: "human-api-error", autoClose: 4000 });
  }

  return message;
};
