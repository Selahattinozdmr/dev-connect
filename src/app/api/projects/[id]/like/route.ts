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
 * API endpoint to create a like for a project
 *
 * This route handler allows authenticated users to like a specific project.
 * It performs several validations:
 * - Ensures the user is authenticated
 * - Validates that the project ID is valid
 * - Checks if the project exists
 * - Verifies the user hasn't already liked this project
 *
 * If all validations pass, it creates a new like record in the database.
 * Performance metrics are captured throughout the process for monitoring.
 *
 * @async
 * @function POST
 * @param {NextRequest} req - The incoming request object
 * @param {Object} params - The route parameters
 * @param {string} params.id - The ID of the project to like
 * @returns {Promise<NextResponse>} A JSON response indicating success (201) or failure with appropriate status code
 * @throws Will be caught and return error responses for various failure conditions:
 *  - 400 if project ID is invalid
 *  - 401 if user is not authenticated
 *  - 404 if project does not exist
 *  - 409 if user has already liked the project
 *  - 500 for server errors
 */

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const projectId = (await params).id;

    logger.info("Processing POST like for project by ID request", {
      projectId,
      path: req.nextUrl.pathname,
    });

    const session = await auth();
    const authError = requireAuth(session);
    if (authError) {
      logger.warn("Authentication failed for project by ID POST request", {
        projectId,
        userId: session?.user?.id || "anonymous",
      });
      return authError;
    }

    if (!session?.user?.id) {
      return createErrorResponse(
        "Authentication error",
        "User ID is missing from session",
        401
      );
    }

    if (!projectId || typeof projectId !== "string") {
      logger.warn("Invalid project ID format for POST", { projectId });
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
      logger.warn("Project not found for POST", { projectId });
      return createErrorResponse("Project not found", "Project not found", 404);
    }

    const like = await prisma.like.findFirst({
      where: { projectId, userId: session?.user.id },
    });
    if (like) {
      logger.warn("Like already exists for POST", {
        projectId,
        userId: session?.user.id,
      });
      return createErrorResponse(
        "Like already exists",
        "User has already liked this project",
        409
      );
    }

    const duration = performance.now() - startTime;
    logger.debug("Valid project ID format for POST and project found", {
      projectId,
      durationMs: Math.round(duration),
    });

    const startCreateTime = performance.now();
    await prisma.like.create({
      data: {
        projectId,
        userId: session?.user.id,
      },
    });
    const createDuration = performance.now() - startCreateTime;
    logger.debug("Like created successfully", {
      projectId,
      durationMs: Math.round(createDuration),
    });

    logger.info("Like for project by ID created successfully", {
      projectId,
      userId: session?.user?.id,
    });
    return createSuccessResponse(
      { id: projectId },
      "Like created successfully",
      201
    );
  } catch (error) {
    logger.error("Error POST like for project by ID", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return createErrorResponse("Database error", error.message, 400);
    }
    return createErrorResponse(
      "Error creating like for project by ID",
      { server: ["Internal server error"] },
      500
    );
  }
}
