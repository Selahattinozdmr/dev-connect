import { Prisma } from "@prisma/client";

/**
 * Builds user search query conditions for Prisma
 * @param search - Search term to match against user fields
 * @returns Prisma WHERE conditions for searching across name, username, and email
 */

export const buildUserSearchConditions=(
    search: string|null
):Prisma.UserWhereInput=>{
    if(!search || search.trim()===''){
        return {};
    }
    return {
        OR:[
            {name:{contains:search,mode:Prisma.QueryMode.insensitive}},
            {username:{contains:search,mode:Prisma.QueryMode.insensitive}},
            {email:{contains:search,mode:Prisma.QueryMode.insensitive}},
        ],
    };
}

/**
 * Creates pagination parameters for Prisma queries
 * @param page - Current page number
 * @param limit - Items per page
 * @returns Object with skip and take values for Prisma
 */

export const getPaginationParams = (page:number,limit:number):
{
    skip:number
    take:number
}=>{
    return {
        skip:(page-1)*limit,
        take:limit
    }
}

/**
 * Calculates pagination metadata for API responses
 * @param page - Current page number
 * @param limit - Items per page
 * @param totalCount - Total number of items
 * @returns Pagination metadata object
 */

export const createPaginationMeta = (
    page:number,
    limit:number,
    totalCount:number


) : {
    page:number
    limit:number
    totalCount:number
    totalPages:number
    hasNextPage:boolean
    hasPrevPage:boolean
}=>{
    const totalPages=Math.ceil(totalCount/limit)

    return{
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage:page<totalPages,
        hasPrevPage:page>1
    }
}