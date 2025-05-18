export type UserResponse={
    id:string,
    name:string,
    email:string,
    avatarUrl:string |null,
    bio:string |null,
}

export type ApiResponse<T = unknown> = {
  success: boolean;
  message: string;
  data?: T;
  errors?: unknown;
};