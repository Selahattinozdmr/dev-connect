import { auth } from "@/auth";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAuth,
} from "@/utils/api-helpers";
import logger from "@/utils/logger";
import { prisma } from "@/utils/prisma";
import {
  createPaginationMeta,
  getPaginationParams,
} from "@/utils/search-helpers";
import { QuerySchema } from "@/utils/validation";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

/**
 * Handles GET requests to fetch user notifications with pagination and sorting.
 *
 * This endpoint retrieves notifications for the authenticated user with support for:
 * - Pagination (page, limit)
 * - Sorting by specified fields (sortBy, sortOrder)
 * - Performance monitoring and comprehensive logging
 *
 * @param req - The Next.js request object containing query parameters
 * @returns Promise<NextResponse> - JSON response with notifications and pagination metadata
 *
 * @example
 * GET /api/notifications?page=1&limit=20&sortBy=createdAt&sortOrder=desc
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Notifications fetched successfully",
 *   "data": {
 *     "notifications": [...],
 *     "meta": {
 *       "page": 1,
 *       "limit": 20,
 *       "total": 100,
 *       "totalPages": 5
 *     }
 *   }
 * }
 *
 * @throws {400} Invalid query parameters - When validation fails
 * @throws {401} Authentication required - When user is not authenticated
 * @throws {500} Database error - When Prisma query fails
 * @throws {500} Internal server error - For unexpected errors
 *
 * @requires Authentication - User must be logged in via Auth.js session
 * @security Only returns notifications belonging to the authenticated user
 */

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    const authError = requireAuth(session);

    if (authError) {
      logger.warn("Authentication failed for GET notification request", {
        userId: session?.user?.id || "anonymous",
      });
      return authError;
    }
    const userId: string = session!.user.id;
    logger.info("Processing GET notifications request", {
      path: req.nextUrl.pathname,
    });

    const url: URL = new URL(req.url);
    const rawParams = Object.fromEntries(url.searchParams.entries());
    const validationResult = QuerySchema.safeParse(rawParams);
    if (!validationResult.success) {
      logger.warn("Invalid query parameters", {
        userId: session!.user.id,
        errors: validationResult.error.flatten().fieldErrors,
      });
      return createErrorResponse(
        "Invalid query parameters",
        validationResult.error.flatten().fieldErrors,
        400
      );
    }
    const { page, limit, sortBy, sortOrder } = validationResult.data;
    const { skip, take } = getPaginationParams(page, limit);

    const startTime = performance.now();

    const [notifications, totalCount] = await Promise.all([
      prisma.notification.findMany({
        where: {
          userId,
        },
        skip,
        take,
        orderBy: {
          [sortBy]: sortOrder,
        },
      }),
      prisma.notification.count({
        where: {
          userId,
        },
      }),
    ]);
    const duration = performance.now() - startTime;
    logger.debug("GET notifications query duration", {
      durationMs: `${duration.toFixed(2)}`,
      userId,
    });
    logger.info("GET notifications request completed successfully", {
      userId: session!.user.id,
      count: notifications.length,
    });

    const meta = createPaginationMeta(page, limit, totalCount);

    return createSuccessResponse(
      { notifications, meta },
      "Notifications fetched successfully",
      200
    );
  } catch (error) {
    logger.error("Error processing GET notifications request", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return createErrorResponse("Database error", error.message, 500);
    }
    return createErrorResponse(
      "Error processing GET notifications request",
      { server: ["Internal server error"] },
      500
    );
  }
}
