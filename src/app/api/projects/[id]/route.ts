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
