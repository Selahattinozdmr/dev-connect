import { auth } from "@/auth";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAuth,
} from "@/utils/api-helpers";
import logger from "@/utils/logger";
import { prisma } from "@/utils/prisma";
import { getPaginationParams } from "@/utils/search-helpers";
import { CommentSchema, CommentType, QuerySchema } from "@/utils/validation";
import { validateFormData } from "@/utils/validation-helpers";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const projectId = (await params).id;
    logger.info("Processing GET comments for project by ID request", {
      projectId,
      path: req.nextUrl.pathname,
    });

    const url: URL = new URL(req.url);
    const rawParams = Object.fromEntries(url.searchParams.entries());
    const validationResult = QuerySchema.safeParse(rawParams);
    if (!validationResult.success) {
      logger.warn("Invalid query parameters", {
        projectId,
        errors: validationResult.error.flatten().fieldErrors,
      });

      return createErrorResponse(
        "Invalid query parameters",
        validationResult.error.flatten().fieldErrors,
        400
      );
    }

    const { page, limit } = validationResult.data;
    const { skip, take } = getPaginationParams(page, limit);

    const session = await auth();
    const authError = requireAuth(session);
    if (authError) {
      logger.warn("Authentication failed for comments by ID GET request", {
        projectId,
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
    const totalCount = await prisma.comment.count({ where: { projectId } });
    const comments = await prisma.comment.findMany({
      where: {
        projectId,
      },
      select: {
        id: true,
        author: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        content: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take,
    });

    const duration = performance.now() - startTime;
    logger.debug("Database query completed for comments by projectId", {
      projectId,
      durationMs: Math.round(duration),
    });

    logger.info("Comments by projectId fetched successfully", {
      projectId,
      userId: session?.user?.id,
      commentCount: comments.length,
    });

    return createSuccessResponse(
      {
        comments,
        pagination: {
          currentPage: page,
          pageSize: limit,
          totalCount: totalCount,
        },
      },
      "Comments fetched successfully",
      200
    );
  } catch (error) {
    logger.error("Error fetching comments for project by ID", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return createErrorResponse("Database error", error.message, 400);
    }
    return createErrorResponse(
      "Error fetching comments for project by ID",
      { server: ["Internal server error"] },
      500
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const projectId = (await params).id;
    logger.info("Processing POST comments for project by ID request", {
      projectId,
      path: req.nextUrl.pathname,
    });

    const formData = await req.formData();

    const session = await auth();
    const authError = requireAuth(session);
    if (authError) {
      logger.warn("Authentication failed for comments by ID POST request", {
        projectId,
        userId: session?.user?.id || "anonymous",
      });
      return authError;
    }

    const validation = await validateFormData(formData, CommentSchema);
    if (!validation.success) {
      logger.warn("Validation error for create comment", {
        projectId,
        userId: session?.user?.id,
      });

      return validation.response;
    }

    const { content }: CommentType = validation.data;

    if (!session?.user.id) {
      logger.warn("User ID not found in session", {
        userId: "unknown",
        operation: "create comment",
      });
      return createErrorResponse(
        "Authentication error",
        { auth: ["User ID not found in session"] },
        401
      );
    }

    const startTime = performance.now();

    const newComment = await prisma.$transaction(async (tx) => {
      const projectExists = await tx.project.findUnique({
        where: { id: projectId },
        select: { id: true },
      });
      if (!projectExists) {
        logger.warn("Attempted to comment on non-existent project", {
          projectId,
          userId: session.user.id,
        });
        return createErrorResponse(
          "Project not found",
          { project: ["Project does not exist"] },
          404
        );
      }
      return await tx.comment.create({
        data: {
          content,
          projectId,
          authorId: session?.user.id,
        },
        select: {
          id: true,
          content: true,
          createdAt: true,
          author: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
      });
    });
    const duration = performance.now() - startTime;
    logger.debug("Created new comment", {
      durationMs: Math.round(duration),
      userId: session.user.id,
      projectId,
    });

    return createSuccessResponse(
      newComment,
      "Comment created succesfully",
      201
    );
  } catch (error) {
    logger.error("Error creating new comments for project by ID", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return createErrorResponse("Database error", error.message, 400);
    }
    return createErrorResponse(
      "Error POST comments for project by ID",
      { server: ["Internal server error"] },
      500
    );
  }
}
