import { auth } from "@/auth";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAuth,
} from "@/utils/api-helpers";
import logger from "@/utils/logger";
import { prisma } from "@/utils/prisma";
import { sanitizeId } from "@/utils/validation-helpers";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

/**
 * Handles DELETE requests to remove a specific comment by ID.
 *
 * This endpoint allows authenticated users to delete their own comments with:
 * - Comment ID validation and sanitization
 * - Authorization check (users can only delete their own comments)
 * - Performance monitoring and comprehensive logging
 * - Proper error handling for various failure scenarios
 *
 * @param req - The Next.js request object
 * @param params - Route parameters containing the comment ID
 * @param params.id - The unique identifier of the comment to delete
 * @returns Promise<NextResponse> - JSON response confirming deletion or error details
 *
 * @example
 * DELETE /api/comments/cm123abc456def
 *
 * Success Response:
 * {
 *   "success": true,
 *   "message": "Comment deleted successfully",
 *   "data": {
 *     "id": "cm123abc456def"
 *   }
 * }
 *
 * @throws {400} Invalid comment ID - When ID format is invalid or missing
 * @throws {401} Authentication required - When user is not authenticated
 * @throws {403} Unauthorized - When user tries to delete another user's comment
 * @throws {404} Comment not found - When comment with given ID doesn't exist
 * @throws {500} Database error - When Prisma query fails
 * @throws {500} Internal server error - For unexpected errors
 *
 * @requires Authentication - User must be logged in via Auth.js session
 * @security Only allows users to delete their own comments
 * @performance Includes query timing and logging for monitoring
 */

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const rawId = (await params).id;
    const sanitizationResult = sanitizeId(rawId);
    if (!sanitizationResult.isValid) {
      logger.warn("Invalid comment ID format", {
        rawId: rawId,
        error: sanitizationResult.error,
      });
      return createErrorResponse(
        "Invalid comment ID",
        "Comment ID must be a valid string",
        400
      );
    }
    const commentId = sanitizationResult.sanitized;
    if (!commentId) {
      logger.warn("Comment ID is missing or invalid", { rawId });
      return createErrorResponse(
        "Invalid comment ID",
        "Comment ID must be a valid string",
        400
      );
    }
    logger.info("Processing DELETE comment request", {
      commentId,
      path: req.nextUrl.pathname,
    });

    const session = await auth();
    const authError = requireAuth(session);
    if (authError) {
      logger.warn("Authentication failed for DELETE comment request", {
        commentId,
        userId: session?.user?.id || "anonymous",
      });
      return authError;
    }

    const startTime = performance.now();

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, authorId: true },
    });
    if (!comment) {
      logger.warn("Comment not found", { commentId, userId: session?.user.id });
      return createErrorResponse(
        "Comment not found",
        "Comment does not exist",
        404
      );
    }

    if (comment.authorId !== session?.user.id) {
      logger.warn("Unauthorized delete attempt", {
        commentId,
        userId: session?.user.id,
      });
      return createErrorResponse(
        "Unauthorized",
        "You can only delete your own comments",
        403
      );
    }
    const deletedComment = await prisma.comment.delete({
      where: { id: commentId },
      select: { id: true },
    });

    const duration = performance.now() - startTime;
    logger.debug("DELETE comment query executed", {
      commentId,
      durationMS: Math.round(duration),
    });

    logger.info("Comment deleted successfully", {
      commentId: deletedComment.id,
      userId: session?.user.id,
    });
    return createSuccessResponse(
      deletedComment,
      "Comment deleted successfully",
      200
    );
  } catch (error) {
    logger.error("Error deleting comment  by ID", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return createErrorResponse("Database error", error.message, 500);
    }
    return createErrorResponse(
      "Error DELETE comment by ID",
      { server: ["Internal server error"] },
      500
    );
  }
}
