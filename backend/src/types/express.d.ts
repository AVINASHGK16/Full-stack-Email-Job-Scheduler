/**
 * Represents a User record as stored in PostgreSQL.
 * Mirrors the Prisma User model exactly so req.user is fully typed
 * without relying on generated Prisma type exports.
 */
export interface UserRecord {
  id: string;
  googleId: string | null;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Augment Express's global User type to match the Prisma User shape.
 * This ensures req.user is fully typed throughout the application.
 */
declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface User extends UserRecord {}
  }
}

