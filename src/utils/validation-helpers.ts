import { NextResponse } from "next/server";
import { ZodSchema } from "zod";
import { createErrorResponse } from "./api-helpers";
import { SanitizationResult } from "./validation";

/**
 * Validates request form data against a Zod schema
 * @param formData - FormData from the request
 * @param schema - Zod schema to validate against
 * @returns Validation result object with success flag and data or error response
 */

export const validateFormData = async <T>(
  formData: FormData,
  schema: ZodSchema<T>
): Promise<
  { success: true; data: T } | { success: false; response: NextResponse }
> => {
  // Process form data to handle arrays correctly
  const rawData: Record<string, unknown> = {};

  // Get all form entries
  const formEntries = Array.from(formData.entries());
  const keys = new Set(formEntries.map(([key]) => key));

  // Process each unique key
  keys.forEach((key) => {
    const values = formData.getAll(key);
    // If multiple values with same key, treat as array
    if (values.length > 1) {
      rawData[key] = values;
    } else {
      // Single value
      rawData[key] = values[0];
    }
  });

  const result = schema.safeParse(rawData);
  if (!result.success) {
    return {
      success: false,
      response: createErrorResponse(
        "Validation failed",
        result.error.flatten().fieldErrors,
        400
      ),
    };
  }
  return {
    success: true,
    data: result.data,
  };
};

export const sanitizeId = (rawId: string): SanitizationResult => {
  if (typeof rawId !== "string") {
    return {
      isValid: false,
      sanitized: null,
      error: "ID must be a string",
    };
  }
  const trimmed = rawId.trim();
  if (trimmed.length === 0) {
    return {
      isValid: false,
      sanitized: null,
      error: "ID cannot be empty",
    };
  }

  const idPattern = /^[a-zA-Z0-9_-]+$/;
  if (!idPattern.test(trimmed)) {
    return {
      isValid: false,
      sanitized: null,
      error: "ID contains invalid characters",
    };
  }
  if (trimmed.length > 50) {
    return {
      isValid: false,
      sanitized: null,
      error: "ID is too long, maximum length is 50 characters",
    };
  }
  return {
    isValid: true,
    sanitized: trimmed,
  };
};
