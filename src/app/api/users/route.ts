import { auth } from "@/auth";
import { prisma } from "@/utils/prisma";
import { QueryParams, QuerySchema } from "@/utils/validation";
import { NextRequest, NextResponse } from "next/server";
import { Prisma, User } from "@prisma/client";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAuth,
} from "@/utils/api-helpers";
import {
  buildUserSearchConditions,
  createPaginationMeta,
  getPaginationParams,
} from "@/utils/search-helpers";
import logger from "@/utils/logger";

/**
 * Retrieves a paginated list of users with optional filtering and sorting
 * @param req - The Next.js request object containing search parameters
 * @returns A JSON response with paginated user data or an error message
 *
 * @example
 * // Example query parameters
 * // /api/users?page=1&limit=10&search=john&sortBy=createdAt&sortOrder=desc
 *
 * // Query parameters:
 * // - page: Page number (default: 1)
 * // - limit: Items per page (default: 10)
 * // - search: Search term for name, username, or email
 * // - sortBy: Field to sort by (default: createdAt)
 * // - sortOrder: Sort order, 'asc' or 'desc' (default: desc)
 */

type UsersResponse = {
  users: Array<Partial<User>>;
  meta: ReturnType<typeof createPaginationMeta>;
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    logger.info("Processing GET users request", {
      path: req.nextUrl.pathname,
      query: Object.fromEntries(new URL(req.url).searchParams.entries()),
    });

    const session = await auth();
    const authError = requireAuth(session);
    if (authError) {
      logger.warn("Authentication failed for users request", {
        userId: session?.user?.id || "anonymous",
      });
      return authError;
    }

    const url: URL = new URL(req.url);

    const rawParams = Object.fromEntries(url.searchParams.entries());
    const validationResult = QuerySchema.safeParse(rawParams);

    if (!validationResult.success) {
      logger.warn("Invalid query parameters", {
        userId: session?.user?.id || "anonymous",
        errors: validationResult.error.flatten().fieldErrors,
      });
      return createErrorResponse(
        "Invalid query parameters",
        validationResult.error.flatten().fieldErrors,
        400
      );
    }

    const { page, limit, sortBy, sortOrder, search }: QueryParams =
      validationResult.data;

    const where = buildUserSearchConditions(search as string);
    const { skip, take } = getPaginationParams(page, limit);

    const startTime = performance.now();

    const [users, totalCount] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: {
          [sortBy]: sortOrder,
        },
        select: {
          id: true,
          name: true,
          email: session ? true : false,
          username: true,
          createdAt: true,
          updatedAt: true,
          avatarUrl: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    const duration = performance.now() - startTime;
    logger.debug("Database query completed", {
      userId: session?.user?.id || "anonymous",
      durationMs: Math.round(duration),
      search,
      page,
      limit,
      sortBy,
      sortOrder,
    });

    if (!users || (users.length === 0 && page > 1)) {
      logger.warn("No users found", {
        userId: session?.user?.id || "anonymous",
        search,
        page,
        limit,
      });
      return createErrorResponse("No users found", "No users found", 404);
    }

    const meta = createPaginationMeta(page, limit, totalCount);

    // Add dynamic cache control based on user authentication
    const headers = new Headers();
    const cacheControl = session
      ? "private, max-age=10, stale-while-revalidate=30"
      : "public, max-age=60, stale-while-revalidate=300";

    headers.set("Cache-Control", cacheControl);

    logger.info("Users fetched successfully", {
      userId: session?.user?.id || "anonymous",
      userCount: users.length,
    });

    return createSuccessResponse<UsersResponse>(
      {
        users,
        meta,
      },
      "Users fetched successfully",
      200
    );
  } catch (error) {
    logger.error("Error processing GET users request", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : "No stack trace",
    });
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return createErrorResponse("Database error", error.message, 400);
    }
    return createErrorResponse(
      "Internal server error",
      { server: ["Internal server error"] },
      500
    );
  }
}
