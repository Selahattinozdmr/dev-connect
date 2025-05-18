import { prisma } from "@/utils/prisma";
import { RegisterFormData, registerSchema } from "@/utils/validation";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { validateFormData } from "@/utils/validation-helpers";
import {
  createErrorResponse,
  createSuccessResponse,
} from "@/utils/api-helpers";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const formData = await req.formData();
    const validation = await validateFormData(formData, registerSchema);

    if (!validation.success) {
      return validation.response;
    }
    const { name, email, password, username }: RegisterFormData =
      validation.data;

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      return createErrorResponse(
        "User already exists",
        { field: existingUser.email === email ? "email" : "username" },
        409
      );
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
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
    return createSuccessResponse(newUser, "User created successfully", 201);
  } catch (error: unknown) {
    console.error("Registration Error: ", error);
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
