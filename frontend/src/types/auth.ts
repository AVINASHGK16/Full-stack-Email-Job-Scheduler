/**
 * auth.ts — Frontend TypeScript types for the Authentication API.
 *
 * Derived directly from:
 *  - backend/src/controllers/auth.controller.ts (getMe response shape)
 *  - backend/prisma/schema.prisma (User model fields)
 *
 * Phase 9.7: read-only — no backend types modified.
 */

/**
 * Authenticated user profile returned by GET /auth/me.
 */
export interface AuthUser {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
}

/**
 * Full response envelope from GET /auth/me.
 */
export interface GetMeResponse {
  status: 'success';
  data: AuthUser;
}
