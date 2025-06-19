import { auth } from "@/auth";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAuth,
  verifyOwnership,
} from "@/utils/api-helpers";
import logger from "@/utils/logger";
import { prisma } from "@/utils/prisma";
import { ProjectsSchema, ProjectType } from "@/utils/validation";
import { validateFormData } from "@/utils/validation-helpers";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

/**
 * Retrieves a project by its unique identifier
 *
 * This endpoint fetches a project with its associated comments and author information.
 * It requires authentication and performs appropriate validation before accessing the database.
 *
 * @param req - The incoming Next.js request object
 * @param params - The route parameters containing the project ID
 * @param params.id - The unique identifier of the project to retrieve
 *
 * @returns A NextResponse containing:
 *  - 200: Project data with comments and author information
 *  - 400: Invalid project ID format
 *  - 401: User not authenticated
 *  - 404: Project not found
 *  - 500: Server error during processing
 *
 * @example
 * // Success response
 * {
 *   "success": true,
 *   "message": "Project fetched successfully",
 *   "data": {
 *     "id": "cmbfcbcux0001tfa0uo4qlonh",
 *     "title": "Example Project",
 *     // other project fields
 *     "author": {
 *       "id": "cmbe4t5hq0000tfws3hwm91ku",
 *       "name": "John Doe",
 *       "avatarUrl": "https://example.com/avatar.jpg"
 *     },
 *     "comments": [
 *       {
 *         "id": "comment123",
 *         "content": "Great project!",
 *         "createdAt": "2025-06-19T00:44:52.000Z",
 *         "author": { "id": "user123", "name": "Jane Smith" }
 *       }
 *     ]
 *   }
 * }
 */

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const projectId = (await params).id;

    logger.info("Processing GET project by id request", {
      projectId,
      path: req.nextUrl.pathname,
    });
    const session = await auth();
    const authError = requireAuth(session);
    if (authError) {
      logger.warn("Authentication failed for project by id request", {
        projectId: params.id,
        userId: session?.user?.id || "anonymous",
      });
      return authError;
    }

    if (!projectId || typeof projectId !== "string") {
      logger.warn("Invalid project ID format", { projectId });
      return createErrorResponse(
        "Invalid project ID",
        "Project ID must be a valid string",
        400
      );
    }

    const startTime = performance.now();

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        comments: {
          select: {
            id: true,
            content: true,
            createdAt: true,
            author: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
    const duration = performance.now() - startTime;
    logger.debug("Database query completed for project by id", {
      projectId,
      durationMs: Math.round(duration),
    });

    if (!project) {
      logger.warn("Project by id not found", { projectId });
      return createErrorResponse("Project not found", "Project not found", 404);
    }

    logger.info("Project by id fetched successfully", {
      projectId,
      userId: session?.user?.id,
      commentCount: project.comments.length,
    });
    return createSuccessResponse(project, "Project fetched successfully", 200);
  } catch (error) {
    logger.error("Error fetching project by id", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return createErrorResponse("Database error", error.message, 400);
    }
    return createErrorResponse(
      "Error fetching project by id",
      { server: ["Internal server error"] },
      500
    );
  }
}

/**
 * Updates a project by its unique identifier
 *
 * This endpoint allows authorized users (project owner or admin) to modify a project's details.
 * It performs authentication, authorization, and input validation before updating the database.
 *
 * @param req - The incoming Next.js request object containing form data with project details
 * @param params - The route parameters containing the project ID
 * @param params.id - The unique identifier of the project to update
 *
 * @returns A NextResponse containing:
 *  - 200: Updated project data with success message
 *  - 400: Invalid project ID format or validation errors
 *  - 401: User not authenticated
 *  - 403: User not authorized to update this project
 *  - 404: Project not found
 *  - 500: Server error during processing
 *
 * @example
 * // Request (multipart/form-data)
 * {
 *   "title": "Updated Project Title",
 *   "description": "New project description with more details",
 *   "tags": ["react", "typescript", "next.js"]
 * }
 *
 * // Success response
 * {
 *   "success": true,
 *   "message": "Project updated successfully",
 *   "data": {
 *     "id": "cmbfcbcux0001tfa0uo4qlonh",
 *     "title": "Updated Project Title",
 *     "description": "New project description with more details",
 *     "tags": ["react", "typescript", "next.js"],
 *     "createdAt": "2025-06-18T23:44:52.000Z",
 *     "updatedAt": "2025-06-19T10:15:30.000Z",
 *     "authorId": "cmbe4t5hq0000tfws3hwm91ku"
 *   }
 * }
 */

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const projectId = (await params).id;

    logger.info("Processing PUT project by id request", {
      projectId,
      path: req.nextUrl.pathname,
    });

    const session = await auth();
    const authError = requireAuth(session);
    if (authError) {
      logger.warn("Authentication failed for project by id PUT request", {
        projectId: params.id,
        userId: session?.user?.id || "anonymous",
      });
      return authError;
    }
    if (!projectId || typeof projectId !== "string") {
      logger.warn("Invalid project ID format for update", { projectId });
      return createErrorResponse(
        "Invalid project ID",
        "Project ID must be a valid string",
        400
      );
    }
    const startTime = performance.now();
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, authorId: true },
    });
    const duration = performance.now() - startTime;
    logger.debug("Valid project ID format for update and project found", {
      projectId,
      durationMs: Math.round(duration),
    });

    if (!project) {
      logger.warn("Project by id not found for update", { projectId });
      return createErrorResponse("Project not found", "Project not found", 404);
    }

    const ownershipError = verifyOwnership(
      session?.user.id,
      project?.authorId,
      session?.user.role
    );

    if (ownershipError) {
      logger.warn("User not authorized to update project by id", {
        projectId,
        userId: session?.user?.id || "anonymous",
      });
      return ownershipError;
    }

    const formData = await req.formData();
    const validation = await validateFormData(formData, ProjectsSchema);

    if (!validation.success) {
      logger.warn("Validation failed for project update", {
        projectId,
        errors: "Validation failed",
      });
      return validation.response;
    }
    const { title, description, tags }: ProjectType = validation.data;

    const startUpdateTime = performance.now();
    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        title,
        description,
        tags,
      },
    });
    const updateDuration = performance.now() - startUpdateTime;
    logger.debug("Project updated successfully", {
      projectId,
      durationMs: Math.round(updateDuration),
    });

    logger.info("Project by id updated successfully", {
      projectId,
      userId: session?.user?.id,
    });
    return createSuccessResponse(
      updatedProject,
      "Project updated successfully",
      200
    );
  } catch (error) {
    logger.error("Error PUT project by id", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return createErrorResponse("Database error", error.message, 400);
    }
    return createErrorResponse(
      "Error updating project by id",
      { server: ["Internal server error"] },
      500
    );
  }
}

/**
 * Deletes a project by its unique identifier
 *
 * This endpoint allows authorized users (project owner or admin) to permanently remove a project.
 * It performs authentication, authorization checks, and verifies project ownership before deletion.
 *
 * @param req - The incoming Next.js request object
 * @param params - The route parameters containing the project ID
 * @param params.id - The unique identifier of the project to delete
 *
 * @returns A NextResponse containing:
 *  - 200: Confirmation of successful deletion with project ID
 *  - 400: Invalid project ID format
 *  - 401: User not authenticated
 *  - 403: User not authorized to delete this project
 *  - 404: Project not found
 *  - 500: Server error during processing
 *
 * @example
 * // Success response
 * {
 *   "success": true,
 *   "message": "Project deleted successfully",
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
    logger.info("Processing DELETE project by id request", {
      projectId,
      path: req.nextUrl.pathname,
    });

    const session = await auth();
    const authError = requireAuth(session);
    if (authError) {
      logger.warn("Authentication failed for project by id DELETE request", {
        projectId,
        userId: session?.user?.id || "anonymous",
      });
      return authError;
    }

    if (!projectId || typeof projectId !== "string") {
      logger.warn("Invalid project ID format for delete", { projectId });
      return createErrorResponse(
        "Invalid project ID",
        "Project ID must be a valid string",
        400
      );
    }

    const startTime = performance.now();
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, authorId: true },
    });
    const duration = performance.now() - startTime;
    logger.debug("Valid project ID format for delete and project found", {
      projectId,
      durationMs: Math.round(duration),
    });

    if (!project) {
      logger.warn("Project by id not found for delete", { projectId });
      return createErrorResponse("Project not found", "Project not found", 404);
    }

    const ownershipError = verifyOwnership(
      session?.user.id,
      project?.authorId,
      session?.user.role
    );

    if (ownershipError) {
      logger.warn("User not authorized to delete project by id", {
        projectId,
        userId: session?.user?.id || "anonymous",
      });
      return ownershipError;
    }

    const startDeleteTime = performance.now();
    await prisma.project.delete({
      where: { id: projectId },
    });
    const deleteDuration = performance.now() - startDeleteTime;
    logger.debug("Project deleted successfully", {
      projectId,
      durationMs: Math.round(deleteDuration),
    });

    logger.info("Project by id deleted successfully", {
      projectId,
      userId: session?.user?.id,
    });
    return createSuccessResponse(
      { id: projectId },
      "Project deleted successfully",
      200
    );
  } catch (error) {
    logger.error("Error DELETE project by id", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return createErrorResponse("Database error", error.message, 400);
    }
    return createErrorResponse(
      "Error deleting project by id",
      { server: ["Internal server error"] },
      500
    );
  }
}
