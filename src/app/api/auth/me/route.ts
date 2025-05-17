import { auth } from "@/auth";
import { prisma } from "@/utils/prisma";
import { Prisma } from "@prisma/client";
import { Session } from "next-auth";
import type { UserResponse } from "@/utils/types";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session: Session | null = await  auth();
    if (!session || !session.user?.email) {
      return NextResponse.json(
        { message: "Unauthorized access" },
        { status: 401 }
      );
    }
    console.log("session",session);
    const userSelect: Prisma.UserSelect = {
      id: true,
      name: true,
      email: true,
      username: true,
      avatarUrl: true,
      bio: true,
    };
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email as string },
      select: userSelect,
    });
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }
    return NextResponse.json(
      { user: user as UserResponse },
      { status: 200, headers: { "Cache-Control": "private,max-age=60" } }
    );
  } catch (error) {
    console.error("API Error in GET /api/auth/me: ", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json({ message: "Database Error" }, { status: 500 });
    }
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
