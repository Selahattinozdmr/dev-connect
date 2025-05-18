import { auth } from "@/auth";
import { prisma } from "@/utils/prisma";
import { QueryParams, QuerySchema } from "@/utils/validation";
import { NextRequest, NextResponse } from "next/server";
import { Prisma, User } from "@prisma/client";

interface UsersResponse {
  users: Array<Partial<User>>;
  meta: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}
interface ErrorResponse {
  message: string;
  errors?: Record<string, string[]>;
}

type UserFilterOptions = {
  role?: string;
  isActive?: boolean;
  joinedAfter?: String;
  joinedBefore?: String;
};

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const url = new URL(req.url);
    const rawParams = Object.fromEntries(url.searchParams.entries());
    const validationResult = QuerySchema.safeParse(rawParams);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          message: "Invalid query parameters",
          errors: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { page, limit, sortBy, sortOrder, search }: QueryParams =
      validationResult.data;

    const skip = (page - 1) * limit;
    let where: Prisma.UserWhereInput = {};
    if (search) {
      where = {
        OR: [
          { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
          {
            username: {
              contains: search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
          { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
        ],
      };
    }

    const [users, totalCount] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
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
    if (!users || (users.length === 0 && page > 1)) {
      return NextResponse.json({ message: "No users found" }, { status: 404 });
    }

    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    const headers = new Headers();
    headers.set("Cache-Control", "public,max-age=30,stale-while-revalidate=60");

    return NextResponse.json(
      {
        users,
        meta: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNextPage,
          hasPrevPage,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("API Error in GET /api/users: ", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
