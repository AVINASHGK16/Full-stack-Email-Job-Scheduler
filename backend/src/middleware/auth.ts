import { Request, Response, NextFunction } from 'express';

/**
 * Middleware that guards routes requiring an authenticated session.
 *
 * Uses Passport's req.isAuthenticated() to verify the session.
 * Never trusts user-supplied IDs — authentication state is derived
 * solely from the server-side session.
 *
 * Returns 401 if the request does not carry a valid authenticated session.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.isAuthenticated()) {
    return next();
  }

  res.status(401).json({
    status: 'error',
    message: 'Unauthorized. Please log in to access this resource.',
  });
}
