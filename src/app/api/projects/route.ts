import { auth } from "@/auth";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAuth,
} from "@/utils/api-helpers";
import logger from "@/utils/logger";
import { prisma } from "@/utils/prisma";
import {
  buildProjectSearchConditions,
  createPaginationMeta,
  getPaginationParams,
} from "@/utils/search-helpers";
import { ProjectsSchema, ProjectType, QuerySchema } from "@/utils/validation";
import { validateFormData } from "@/utils/validation-helpers";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/projects
 *
 * Retrieves a paginated list of projects with optional filtering, sorting and search.
 *
 * @param {NextRequest} req - The Next.js request object
 * @param {Object} req.searchParams - Search parameters
 * @param {string} [req.searchParams.search] - Search term for filtering projects across title, description and technologies
 * @param {number} [req.searchParams.page=1] - Page number for pagination
 * @param {number} [req.searchParams.limit=10] - Number of items per page
 * @param {string} [req.searchParams.sortBy='createdAt'] - Field to sort by
 * @param {string} [req.searchParams.sortOrder='desc'] - Sort direction (asc/desc)
 * @returns {NextResponse} JSON response with projects data or error message
 */

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    logger.info("Processing GET projects request", {
      path: req.nextUrl.pathname,
      query: Object.fromEntries(new URL(req.url).searchParams.entries()),
    });

    const session = await auth();
    const authError = requireAuth(session);
    if (authError) {
      logger.warn("Authentication failed for projects request", {
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

    const { page, limit, sortBy, sortOrder, search } = validationResult.data;
    const searchTerm: string = search?.toString() || "";
    const where = buildProjectSearchConditions(searchTerm);
    const { skip, take } = getPaginationParams(page, limit);

    const startTime = performance.now();

    const [projects, totalCount] = await Promise.all([
      prisma.project.findMany({
        where,
        skip,
        take,
        orderBy: {
          [sortBy]: sortOrder,
        },
      }),
      prisma.project.count({ where }),
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

    if (!projects || (projects.length === 0 && page > 1)) {
      logger.warn("No projects found for the given criteria", {
        search,
        page,
        limit,
        sortBy,
        sortOrder,
      });
      return createErrorResponse("No projects found", "No projects found", 404);
    }
    const meta = createPaginationMeta(page, limit, totalCount);

    logger.info("Projects fetched successfully", {
      userId: session?.user?.id,
      projectCount: projects.length,
    });

    return createSuccessResponse(
      { projects, meta },
      "Projects fetched successfully",
      200
    );
  } catch (error) {
    logger.error("Error processing GET projects request", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : "No stack trace",
    });
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2001") {
        return createErrorResponse(
          "Resource not found",
          "The requested resource does not exist",
          404
        );
      }
      return createErrorResponse("Database error", error.message, 400);
    }
    return createErrorResponse(
      "Internal server error",
      { server: ["Internal server error"] },
      500
    );
  }
}

/**
 * POST /api/projects
 *
 * Creates a new project for the authenticated user with the provided details.
 * Validates input data through schema validation and associates the project with the current user.
 *
 * @async
 * @param {NextRequest} req - The Next.js request object containing FormData
 * @param {FormData} req.formData - The form data containing project information
 * @param {string} req.formData.title - Project title (required, unique)
 * @param {string} req.formData.description - Project description (required)
 * @param {string} [req.formData.repoUrl] - URL to the project repository (optional)
 * @param {string} [req.formData.liveUrl] - URL to the live project (optional)
 * @param {string[]} [req.formData.tags] - Array of technology tags associated with the project
 *
 * @throws {Error} When authentication fails or database operation fails
 * @throws {Prisma.PrismaClientKnownRequestError} When a database constraint is violated (e.g., unique title)
 *
 * @returns {Promise<NextResponse>} JSON response with created project data or error message
 * @returns {201} Project created successfully with project data
 * @returns {400} Validation error with specific field errors
 * @returns {401} Unauthorized if user is not authenticated
 * @returns {409} Conflict if project with same title already exists
 * @returns {500} Server error if project creation fails for other reasons
 */

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    const authError = requireAuth(session);
    if (authError) return authError;

    const formData = await req.formData();

    // Special handling for tags - convert from string to array if needed
    const tagsValue = formData.get("tags");
    if (tagsValue && typeof tagsValue === "string" && tagsValue.includes(",")) {
      formData.delete("tags");

      const tagsArray = tagsValue
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      tagsArray.forEach((tag) => {
        formData.append("tags", tag);
      });
    }

    const validation = await validateFormData(formData, ProjectsSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { title, description, repoUrl, liveUrl, tags }: ProjectType =
      validation.data; // Ensure we have a valid authorId - should always be true due to requireAuth check
    if (!session?.user?.id) {
      return createErrorResponse(
        "Authentication error",
        { auth: ["User ID not found in session"] },
        401
      );
    }

    const newProject = await prisma.project.create({
      data: {
        title,
        description,
        repoUrl: repoUrl || null,
        liveUrl: liveUrl || null,
        tags: {
          set: tags,
        },
        authorId: session.user.id,
      },
    });

    return createSuccessResponse(
      newProject,
      "Project created successfully",
      201
    );
  } catch (error) {
    console.error("API Error in POST /api/projects: ", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return createErrorResponse(
          "Project creation failed",
          { title: ["A project with this title already exists"] },
          409
        );
      }

      // Handle other Prisma errors
      return createErrorResponse("Database error", error.message, 400);
    }

    if (error instanceof Error) {
      // Log detailed error but return safe message
      console.error(`Project creation error details: ${error.stack}`);
    }

    return createErrorResponse(
      "Internal Server Error",
      { server: ["Failed to create project"] },
      500
    );
  }
}
