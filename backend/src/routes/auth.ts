import { Router } from 'express';
import passport from '../config/passport';
import { requireAuth } from '../middleware/auth';
import { getMe, logout, oauthFailure } from '../controllers/auth.controller';

const authRouter = Router();

/**
 * GET /auth/google
 *
 * Initiates the Google OAuth 2.0 flow.
 * Redirects the browser to Google's consent/login page.
 * Requests the 'profile' and 'email' scopes so we can identify
 * and store the user. No token is exposed in the URL.
 */
authRouter.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    // Prompt the user to select an account on every login during development.
    // Remove 'prompt' in production if you prefer silent re-authentication.
    prompt: 'select_account',
  })
);

/**
 * GET /auth/google/callback
 *
 * Google redirects here after the user authenticates.
 * Passport exchanges the authorization code for tokens, fetches the profile,
 * and calls the verify callback in config/passport.ts.
 *
 * On success  → session is established, redirect to /auth/me for verification.
 * On failure  → redirect to /auth/failure which returns a clean 401 JSON response.
 */
authRouter.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/auth/failure',
    session: true,
  }),
  (_req, res) => {
    // Authentication succeeded — redirect to the frontend dashboard.
    // Phase 9 TODO completed: session is established, send the browser
    // to the React SPA so the user lands on the dashboard.
    res.redirect('http://localhost:3000/scheduled');
  }
);

/**
 * GET /auth/me
 *
 * Returns the currently authenticated user's profile.
 * Protected by requireAuth — returns 401 if not logged in.
 */
authRouter.get('/me', requireAuth, getMe);

/**
 * POST /auth/logout
 *
 * Destroys the server-side session and clears the session cookie.
 * Returns 200 on success.
 */
authRouter.post('/logout', requireAuth, logout);

/**
 * GET /auth/failure
 *
 * Graceful handler for OAuth failures and user cancellations.
 * Returns a clean 401 JSON response — no stack traces or internals.
 */
authRouter.get('/failure', oauthFailure);

export default authRouter;
