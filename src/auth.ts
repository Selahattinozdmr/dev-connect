import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/utils/prisma";
import { encode as defaultEncode } from "@auth/core/jwt";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcrypt";

// Extend the User type to include the role property
declare module "next-auth" {
  interface User {
    role?: string;
  }
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role?: string | null;
      image?: string | null;
      emailVerified?: Date | null;
    }
  }
}

class InvalidLoginError extends CredentialsSignin {
  code = "Invalid identifier or password";
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      // You can specify which fields should be submitted, by adding keys to the `credentials` object.
      // e.g. domain, username, password, 2FA token, etc.
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials) => {
        let user = null;

        user = await prisma.user.findUnique({
          where: {
            email: credentials.email as string,
          },
        });
        const isPasswordValid = bcrypt.compareSync(credentials.password as string, user?.password || "");
        if (!user || !isPasswordValid) {
          // If no user is found or password is invalid, throw an error
          throw new InvalidLoginError();
        }

        // return user object with their profile data
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          image: user.avatarUrl,
        };
      },
    }),
  ],
  adapter: PrismaAdapter(prisma),
  callbacks: {
    async session({ session, user }) {
      session.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        image: user.image,
        emailVerified: user.emailVerified,
      };
      return session;
    },
    async jwt({ token, account }) {
      if (account?.provider === "credentials") {
        token.credentials = true;
      }
      return token;
    },
  },
  jwt: {
    encode: async function (params) {
      if (params.token?.credentials) {
        const sessionToken = crypto.randomUUID();
        if (!params.token.sub) {
          throw new Error("No user ID found in token");
        }
        const createSession=await PrismaAdapter(prisma).createSession?.({
            sessionToken,
            userId : params.token.sub,
            expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        });
        if (!createSession) {
          throw new Error("Failed to create session");
        }
        return sessionToken;
      }
      return defaultEncode(params);
    },
  },
  secret:process.env.AUTH_SECRET,
  experimental:{enableWebAuthn:true},
});
