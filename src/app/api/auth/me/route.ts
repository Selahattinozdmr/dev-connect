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
    const session: Session | null = await auth();
    const authError = requireAuth(session);
    if (authError) return authError;

    const email = session!.user?.email;
    if (!email) {
      return createErrorResponse(
        "Auth Error",
        "User email not available in session",
        400
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session!.user?.email as string },
      select: USER_SELECT_FIELDS,
    });
    if (!user) {
      return createErrorResponse("User not found", "User not Found", 404);
    }
    return createSuccessResponse(user, "User fetched Successfully", 200);
  } catch (error) {
    console.error("API Error in GET /api/auth/me: ", error);

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
