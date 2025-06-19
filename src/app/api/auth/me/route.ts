import { auth } from "@/auth";
import { prisma } from "@/utils/prisma";
import { Prisma } from "@prisma/client";
import { Session } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAuth,
} from "@/utils/api-helpers";
import logger from "@/utils/logger";

const USER_SELECT_FIELDS: Prisma.UserSelect = {
  id: true,
  name: true,
  email: true,
  username: true,
  avatarUrl: true,
  bio: true,
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    logger.info("Processing GET user profile request", {
      path: req.nextUrl.pathname,
    });

    const session: Session | null = await auth();
    const authError = requireAuth(session);
    if (authError) {
      logger.warn("Authentication failed for me request", {
        userId: session?.user?.id || "anonymous",
      });
      return authError;
    }

    const email = session!.user?.email;
    if (!email) {
      logger.warn("User email not available in session", {
        userId: session?.user?.id || "anonymous",
      });
      return createErrorResponse(
        "Auth Error",
        "User email not available in session",
        400
      );
    }

    const startTime = performance.now();

    const user = await prisma.user.findUnique({
      where: { email: session!.user?.email as string },
      select: USER_SELECT_FIELDS,
    });

    const duration = performance.now() - startTime;
    logger.debug("Database query completed get session info", {
      userId: session?.user?.id || "anonymous",
      durationMs: Math.round(duration),
    });

    if (!user) {
      logger.warn("User not found", {
        userId: session?.user?.id || "anonymous",
        email: session!.user?.email,
      });
      return createErrorResponse("User not found", "User not Found", 404);
    }
    return createSuccessResponse(user, "User fetched Successfully", 200);
  } catch (error) {
    logger.error("Error fetching me: in path " + req.nextUrl.pathname, {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : "No stack trace",
    });

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return createErrorResponse("Database Error", error.message, 500);
    }

    return createErrorResponse(
      "Internal Server Error",
      { server: "Internal Server Error" },
      500
    );
  }
}
