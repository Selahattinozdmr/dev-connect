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
    const session = await auth();
    const authError = requireAuth(session);
    if (authError) return authError;

    const userId = (await params).id;

    const userProfile = await prisma.user.findUnique({
      where: { id: userId },
      select: {
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
      },
    });
    if (!userProfile) {
      return createErrorResponse("User not found", "User not found", 404);
    }
    return createSuccessResponse(userProfile, "User fetched successfully", 200);
  } catch (error) {
    console.error("Error fetching user:", error);
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
    const session = await auth();

    const authError = requireAuth(session);
    if (authError) return authError;

    const userId = (await params).id;

    // At this point we know session is not null because requireAuth would have returned an error
    const ownershipError = verifyOwnership(session!.user?.id, userId);
    if (ownershipError) return ownershipError;

    const formData = await req.formData();
    const validation = await validateFormData(formData, UserSchema);
    if (!validation.success) {
      return validation.response;
    }

    const {
      name,
      email,
      username,
      bio,
      avatarUrl,
      location,
      website,
      githubUrl,
      linkedinUrl,
    }: UserType = validation.data;
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        email,
        username,
        bio,
        avatarUrl,
        location,
        website,
        githubUrl,
        linkedinUrl,
      },
      select: {
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
      },
    });

    return createSuccessResponse(updatedUser, "User updated successfully", 200);
  } catch (error) {
    console.error("Error updating user:", error);
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
