import { prisma } from "@/utils/prisma";
import { RegisterFormData, registerSchema } from "@/utils/validation";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const rawFormData: Record<string, FormDataEntryValue> =
      Object.fromEntries(formData);

    const validationResult = registerSchema.safeParse(rawFormData);
    if (!validationResult.success)
      return NextResponse.json(
        {
          message: "Validation failed",
          erros: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    const { name, email, password, username }: RegisterFormData =
      validationResult.data;
    const [emailExist,usernameExist] = await Promise.all([
        prisma.user.findUnique({where:{email}}),
        prisma.user.findUnique({where:{username}})
    ])

    if (emailExist)
      return NextResponse.json(
        { message: "Email already in use" },
        { status: 400 }
      );
    if (usernameExist)
      return NextResponse.json(
        { message: "Username already taken" },
        { status: 400 }
      );
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newUsser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        username,
      },
      select:{
        id:true,
        name:true,
        email:true,
        createdAt:true,
        username:true
      }
    });
    return NextResponse.json({ message: "User created" ,user:newUsser}, { status: 200 });
  } catch (error) {
    console.log("Registration Error: ",error);
    if(error instanceof Error){
        if(error.message.includes("Unique constraint failed")){
            return NextResponse.json({message:"Email or username already taken"},{status:409})
        }
    }
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
