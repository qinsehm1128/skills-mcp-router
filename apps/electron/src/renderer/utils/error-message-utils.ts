import { ParsedPaymentError } from "@mcp_router/shared";

/**
 * Error message parsing utilities for better user experience
 */

/**
 * Parse error message to detect payment errors and extract user-friendly messages
 */
export function parseErrorMessage(errorMessage: string): ParsedPaymentError {
  const result: ParsedPaymentError = {
    isPaymentError: false,
    displayMessage: errorMessage,
    originalMessage: errorMessage,
  };

  try {
    // Try to parse as JSON
    const parsed = JSON.parse(errorMessage);

    // Handle JSON error formats
    if (parsed.message) {
      result.displayMessage = parsed.message;
    }
  } catch {
    // Not JSON, treat as plain text
  }

  return result;
}
