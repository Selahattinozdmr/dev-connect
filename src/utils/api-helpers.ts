import { NextResponse } from "next/server";
import { ApiResponse } from "@/utils/types";
import { Session } from "next-auth";

export const createSuccessResponse = <T>(
  data: T,
  message: string = "Operation successful",
  status: number = 200
): NextResponse => {
  return NextResponse.json<ApiResponse<T>>(
    {
      success: true,
      message,
      data,
    },
    { status }
  );
};

export const createErrorResponse = (
  message: string,
  errors?: unknown,
  status: number = 400
): NextResponse => {
  return NextResponse.json<ApiResponse<null>>(
    {
      success: false,
      message,
      errors,
    },
    { status }
  );
};

export const requireAuth = (session: Session | null): NextResponse | null => {
  if (!session) {
    return createErrorResponse(
      "Unauthorized access",
      "Authentication required",
      401
    );
  }
  return null;
};

export const verifyOwnership = (
  sessionUserId: string | undefined,
  resourceOwnerId: string
): NextResponse | null => {
  if (!sessionUserId || sessionUserId !== resourceOwnerId) {
    return createErrorResponse(
      "Forbidden",
      "You do not have permission to perform this action",
      403
    );
  }
  return null;
};
