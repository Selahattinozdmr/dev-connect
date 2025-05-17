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