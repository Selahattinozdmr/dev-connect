import { prisma } from "@/utils/prisma";
import { RegisterFormData, registerSchema } from "@/utils/validation";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { validateFormData } from "@/utils/validation-helpers";
import {
  createErrorResponse,
  createSuccessResponse,
} from "@/utils/api-helpers";
import logger from "@/utils/logger";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    logger.info("Processing POST registration request", {
      path: req.nextUrl.pathname,
    });

    const formData = await req.formData();
    const validation = await validateFormData(formData, registerSchema);

    if (!validation.success) {
      logger.warn("Registration validation failed", {
        errors: "Validation failed",
      });
      return validation.response;
    }
    const { name, email, password, username }: RegisterFormData =
      validation.data;

    logger.info("Registration data validated successfully", {
      user: { name, email, username },
    });

    const startTime = performance.now();

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    const duration = performance.now() - startTime;
    logger.debug("Database query completed existing user", {
      durationMs: Math.round(duration),
      path: req.nextUrl.pathname,
    });

    if (existingUser) {
      logger.warn("User already exists", {
        email: existingUser.email,
        username: existingUser.username,
      });
      return createErrorResponse(
        "User already exists",
        { field: existingUser.email === email ? "email" : "username" },
        409
      );
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const startTime1 = performance.now();

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        username,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        username: true,
      },
    });

    const duration1 = performance.now() - startTime1;
    logger.debug("Database query completed create user", {
      durationMs: Math.round(duration1),
      path: req.nextUrl.pathname,
    });

    logger.info("User registered successfully", {
      userId: newUser.id,
      email: newUser.email,
      username: newUser.username,
    });

    return createSuccessResponse(newUser, "User created successfully", 201);
  } catch (error: unknown) {
    logger.error("Error fetching me: in path " + req.nextUrl.pathname, {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : "No stack trace",
    });
    if (error instanceof Error) {
      if (error.message.includes("Unique constraint failed")) {
        return createErrorResponse(
          "Email or username already taken",
          { conflict: true }, // Don't expose raw error message
          409
        );
      }

      // Log detailed error but return safe message
      console.error(`Registration error details: ${error.stack}`);
    }

    return createErrorResponse(
      "Internal Server Error",
      { server: ["Internal server error"] },
      500
    );
  }
}
