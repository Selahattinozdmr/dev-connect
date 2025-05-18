import {z} from 'zod';

export const registerSchema= z.object({
    name:z.string().min(2,"Name must be at least 2 character"),
    username:z.string().min(3,"Username must be ad least 3 characters")
    .regex(/^[a-zA-Z0-9_-]+$/,"Username can only contain letters,numbers,underscores and hyphens"),
    email:z.string().email("Invalid email address"),
    password:z.string().min(8,"Password must be at least 8 characters").regex(new RegExp('^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9]).{8,}$'),{
        message:"Password must contain at least one uppercase letter,one lowercase letter and one number"
    })
})

export type RegisterFormData=z.infer<typeof registerSchema>


export const QuerySchema= z.object({
    page:z.coerce.number().int().positive().optional().default(1),
    limit:z.coerce.number().int().positive().optional().default(10),
    sortBy:z.enum(["name","username","createdAt"]).optional().default("createdAt"),
    sortOrder:z.enum(["asc","desc"]).optional().default("desc"),
    search:z.string().optional()
})

export type QueryParams=z.infer<typeof QuerySchema>

export const UserSchema=z.object({
    id:z.string(),
    name:z.string(),
    username:z.string(),
    email:z.string().email("Invalid email address"),
    bio:z.string().optional(),
    avatarUrl:z.string().optional(),
    location:z.string().optional(),
    website:z.string().optional(),
    githubUrl:z.string().optional(),
    linkedinUrl:z.string().optional(),
    createdAt:z.coerce.date(),
    updatedAt:z.coerce.date()
})
export type UserType=z.infer<typeof UserSchema>