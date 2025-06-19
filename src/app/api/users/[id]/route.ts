import { auth } from "@/auth";
import { prisma } from "@/utils/prisma";
import { UserSchema, UserType } from "@/utils/validation";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import {
  createSuccessResponse,
  createErrorResponse,
  requireAuth,
  verifyOwnership,
} from "@/utils/api-helpers";
import { validateFormData } from "@/utils/validation-helpers";
import logger from "@/utils/logger";

/**
 * Get user by ID endpoint
 * @param req - The request object
 * @param params - URL parameters containing the user ID
 * @returns User data or error response
 */

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const userId = (await params).id;

    logger.info("Processing GET user by ID request", {
      userId,
      path: req.nextUrl.pathname,
    });

    const session = await auth();
    const authError = requireAuth(session);
    if (authError) {
      logger.warn("Authentication failed for user by id request", {
        userId: session?.user?.id || "anonymous",
      });
      return authError;
    }

    if (!userId || typeof userId !== "string") {
      logger.warn("Invalid user ID format", { userId });
      return createErrorResponse(
        "Invalid user ID",
        "User ID must be a valid string",
        400
      );
    }

    const startTime = performance.now();

    const userProfile = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const duration = performance.now() - startTime;
    logger.debug("Database query completed get user by id", {
      userId: session?.user?.id || "anonymous",
      durationMs: Math.round(duration),
    });

    if (!userProfile) {
      logger.warn("User not found", { userId });
      return createErrorResponse("User not found", "User not found", 404);
    }
    logger.info("User fetched successfully", { userId });
    return createSuccessResponse(userProfile, "User fetched successfully", 200);
  } catch (error) {
    logger.error("Error fetching user:", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : "No stack trace",
    });
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return createErrorResponse("Database error", error.message, 400);
    }
    return createErrorResponse(
      "Error fetching user",
      { server: ["Internal server error"] },
      500
    );
  }
}

/**
 * Update user by ID endpoint
 * @param req - The request object with form data
 * @param params - URL parameters containing the user ID
 * @returns Updated user data or error response
 */

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const userId = (await params).id;

    logger.info("Processing PUT user by ID request", {
      userId,
      path: req.nextUrl.pathname,
    });
    const session = await auth();

    const authError = requireAuth(session);
    if (authError) {
      logger.warn("Authentication failed for user by id request", {
        userId: session?.user?.id || "anonymous",
      });
      return authError;
    }

    // At this point we know session is not null because requireAuth would have returned an error
    const ownershipError = verifyOwnership(
      session?.user?.id,
      userId,
      session?.user?.role
    );
    if (ownershipError) {
      logger.warn("Ownership verification failed", {
        requesterId: session?.user?.id,
        targetUserId: userId,
        role: session?.user?.role,
      });
      return ownershipError;
    }

    const formData = await req.formData();
    const validation = await validateFormData(formData, UserSchema);
    if (!validation.success) {
      logger.warn("Validation failed for user update", {
        userId,
        errors: "Validation failed",
      });
      return validation.response;
    }

    const {
      name,
      email,
      username,
      location,
      avatarUrl,
      bio,
      website,
      githubUrl,
      linkedinUrl,
    }: UserType = validation.data;

    const startTime = performance.now();

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        email,
        username,
        location,
        avatarUrl,
        bio,
        website,
        githubUrl,
        linkedinUrl,
      },
      select: {
        id: true,
        name: true,
        email: true,
        bio: true,
        avatarUrl: true,
        location: true,
        website: true,
        githubUrl: true,
        linkedinUrl: true,
        username: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const duration = performance.now() - startTime;
    logger.debug("Database query completed for update user by id", {
      userId: session?.user?.id || "anonymous",
      durationMs: Math.round(duration),
    });

    logger.info("User updated successfully", { userId });
    return createSuccessResponse(updatedUser, "User updated successfully", 200);
  } catch (error) {
    logger.error("Error updating user:", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : "No stack trace",
    });
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Handle unique constraint violations
      if (error.code === "P2002") {
        const target = (error.meta?.target as string[]) || [];
        return createErrorResponse(
          `${target.join(", ")} already in use`,
          error.message,
          409
        );
      }

      // Handle other database errors
      return createErrorResponse("Database error", error.message, 400);
    }

    // Handle generic errors
    return createErrorResponse(
      "Error updating user",
      { server: ["Internal server error"] },
      500
    );
  }
}

const USER_SELECT_FIELDS = {
  id: true,
  name: true,
  email: true,
  username: true,
  bio: true,
  avatarUrl: true,
  location: true,
  website: true,
  githubUrl: true,
  linkedinUrl: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const userId = (await params).id;

    logger.info("Processing DELETE user by ID request", {
      userId,
      path: req.nextUrl.pathname,
    });

    const session = await auth();
    const authError = requireAuth(session);

    if (authError) {
      logger.warn("Authentication failed for user request", {
        userId: session?.user?.id || "anonymous",
      });
      return authError;
    }

    const ownershipError = verifyOwnership(
      session?.user?.id,
      userId,
      session?.user?.role
    );
    if (ownershipError) {
      logger.warn("Ownership verification failed", {
        requesterId: session?.user?.id,
        targetUserId: userId,
        role: session?.user?.role,
      });
      return ownershipError;
    }

    const startTime = performance.now();

    const deletedUser = await prisma.user.delete({
      where: { id: userId },
      select: USER_SELECT_FIELDS,
    });

    if (!deletedUser) {
      logger.warn("User not found for deletion", { userId });
      return createErrorResponse("User not found", "User not found", 404);
    }

    const duration = performance.now() - startTime;
    logger.debug("Database query completed for delete user", {
      userId: session?.user?.id || "anonymous",
      durationMs: Math.round(duration),
    });

    logger.info("User deleted successfully", { userId });

    return createSuccessResponse(deletedUser, "User deleted successfully", 200);
  } catch (error) {
    logger.error("Error deleting user:", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : "No stack trace",
    });
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return createErrorResponse(
          "User not found",
          "Record to delete does not exist",
          404
        );
      }
      return createErrorResponse("Database error", error.message, 400);
    }

    return createErrorResponse(
      "Error deleting user",
      { server: ["Internal server error"] },
      500
    );
  }
}
