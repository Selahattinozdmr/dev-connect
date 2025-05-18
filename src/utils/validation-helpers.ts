import { NextResponse } from "next/server";
import { ZodSchema } from "zod";
import { createErrorResponse } from "./api-helpers";

/**
 * Validates request form data against a Zod schema
 * @param formData - FormData from the request
 * @param schema - Zod schema to validate against
 * @returns Validation result object with success flag and data or error response
 */

export const validateFormData =async <T>(
  formData: FormData,
  schema: ZodSchema<T>
): Promise<
  { success: true; data: T } | { success: false; response: NextResponse }
> => {
  const rawData: Record<string, FormDataEntryValue> =
    Object.fromEntries(formData);
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
