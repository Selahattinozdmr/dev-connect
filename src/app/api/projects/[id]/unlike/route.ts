import { auth } from "@/auth";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAuth,
} from "@/utils/api-helpers";
import logger from "@/utils/logger";
import { prisma } from "@/utils/prisma";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

/**
 * Removes a user's like from a project
 *
 * This endpoint allows authenticated users to unlike a project they previously liked.
 * It performs authentication and verifies that both the project and the user's like exist.
 *
 * @param req - The incoming Next.js request object
 * @param params - The route parameters containing the project ID
 * @param params.id - The unique identifier of the project to unlike
 *
 * @returns A NextResponse containing:
 *  - 200: Confirmation of successful unlike operation with project ID
 *  - 400: Invalid project ID format or database error
 *  - 401: User not authenticated
 *  - 404: Project not found or like not found
 *  - 500: Server error during processing
 *
 * @example
 * // Success response
 * {
 *   "success": true,
 *   "message": "Like deleted successfully",
 *   "data": {
 *     "id": "cmbfcbcux0001tfa0uo4qlonh"
 *   }
 * }
 */

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const projectId = (await params).id;

    logger.info("Processing DELETE project by ID request", {
      projectId,
      path: req.nextUrl.pathname,
    });

    const session = await auth();
    const authError = requireAuth(session);
    if (authError) {
      logger.warn("Authentication failed for project by ID DELETE request", {
        projectId,
        userId: session?.user?.id || "anonymous",
      });
      return authError;
    }

    if (!projectId || typeof projectId !== "string") {
      logger.warn("Invalid project ID format for DELETE", { projectId });
      return createErrorResponse(
        "Invalid project ID",
        "Project ID must be a valid string",
        400
      );
    }

    const startTime = performance.now();
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      logger.warn("Project not found for DELETE", { projectId });
      return createErrorResponse("Project not found", "Project not found", 404);
    }
    const like = await prisma.like.findFirst({
      where: { projectId, userId: session?.user.id },
    });
    if (!like) {
      logger.warn("Like not found for DELETE", {
        projectId,
        userId: session?.user.id,
      });
      return createErrorResponse(
        "Like not found",
        "Like not found for this project",
        404
      );
    }

    const duration = performance.now() - startTime;
    logger.debug("Valid project ID format for DELETE and project found", {
      projectId,
      durationMs: Math.round(duration),
    });

    const startDeleteTime = performance.now();
    await prisma.like.delete({
      where: { id: like.id },
    });
    const deleteDuration = performance.now() - startDeleteTime;
    logger.debug("Like deleted successfully", {
      projectId,
      durationMs: Math.round(deleteDuration),
    });

    logger.info("Like by ID deleted successfully", {
      projectId,
      userId: session?.user?.id,
    });
    return createSuccessResponse(
      { id: projectId },
      "Like deleted successfully",
      200
    );
  } catch (error) {
    logger.error("Error DELETE like by ID", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return createErrorResponse("Database error", error.message, 400);
    }
    return createErrorResponse(
      "Error deleting like by ID",
      { server: ["Internal server error"] },
      500
    );
  }
}
