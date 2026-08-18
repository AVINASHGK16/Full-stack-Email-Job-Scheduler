import { Request, Response, NextFunction } from 'express';

/**
 * GET /auth/me
 *
 * Returns the currently authenticated user's profile.
 * req.user is populated by Passport's deserializeUser after session validation.
 * The Google client secret is never included in this response.
 */
export function getMe(req: Request, res: Response): void {
  const user = req.user!;

  res.status(200).json({
    status: 'success',
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    },
  });
}

/**
 * POST /auth/logout
 *
 * Invalidates the current session and clears the session cookie.
 * Uses Passport's req.logout() with the callback form (required in Passport v0.6+).
 */
export function logout(req: Request, res: Response, next: NextFunction): void {
  req.logout((err) => {
    if (err) {
      return next(err);
    }

    // Destroy the entire session on the server side for full invalidation.
    req.session.destroy((destroyErr) => {
      if (destroyErr) {
        return next(destroyErr);
      }

      // Clear the session cookie on the client side.
      res.clearCookie('connect.sid');

      res.status(200).json({
        status: 'success',
        message: 'Logged out successfully.',
      });
    });
  });
}

/**
 * GET /auth/failure
 *
 * Handles OAuth failure or user cancellation gracefully.
 * Returns 401 — does not expose any internal error details.
 */
export function oauthFailure(_req: Request, res: Response): void {
  res.status(401).json({
    status: 'error',
    message: 'Google authentication failed or was cancelled.',
  });
}
