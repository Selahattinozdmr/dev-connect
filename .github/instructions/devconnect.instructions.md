---
applyTo: '**/*.ts'
---
Coding standards, domain knowledge, and preferences that AI should follow.
# Copilot Instructions for Developer Social Network Platform

## 📘 Project Description
This is a developer-focused social network platform where users can:
- Create and customize profiles
- Share and showcase their projects
- Follow and interact with other developers

## ⚙️ Tech Stack
- **Framework:** Next.js (App Router)
- **ORM:** Prisma
- **Auth:** Auth.js (NextAuth alternative)
- **Database:** PostgreSQL
- **Language:** TypeScript (Strict Mode Enabled)

## 📁 Project Structure Guidelines
- Use `/app` directory with Next.js App Router.
- API routes should be under `/app/api/**/route.ts`.
- Shared UI components go into `/components`.
- Utility and helper functions live in `/utils`.
- Prisma Client should be in `/utils/prisma.ts`.

## ✅ Coding Standards for Copilot

### ✅ TypeScript Rules
- Always use **explicit types**. No `any` type is allowed.
- Prefer type-safe utilities (  Prisma types).
- Define types/interfaces in a dedicated `/types` folder or co-located files.
- Use `inferAsyncReturnType`, `ReturnType`, and generics when needed for reuse.

### ✅ Prisma Usage
- Use auto-generated Prisma types (`Prisma.User`, etc.).
- Do not write raw SQL unless strictly necessary.
- Always handle async/await and database errors gracefully.

### ✅ Auth.js Usage
- Use `getServerSession()` for protected pages and APIs.
- Do not expose user-sensitive data in public components.
- Include session checks in all API routes needing auth.

### ✅ Next.js App Router
- Use server components where possible.
- Place client components under `"use client"` directive.
- Use `generateStaticParams` and `generateMetadata` when generating dynamic routes.

### ✅ UI & Components
- Write accessible HTML and semantic elements.
- Reuse components, avoid duplication.
- Use Tailwind CSS or your project’s design system.
- Separate logic and view in components.

## ❌ Forbidden Practices
- ❌ Do not use `any`. Use proper type definitions or inference.
- ❌ Do not use `@ts-ignore` unless absolutely required and explained.
- ❌ Do not use JavaScript files (`.js`). Use `.ts` or `.tsx` only.
- ❌ Avoid inline styles unless dynamic styling is necessary.

## 🧠 Example Prompt for Copilot
> Create a server component that fetches a user's profile using Prisma, includes session check with Auth.js, and defines all types explicitly.

## 📂 Directory Examples
