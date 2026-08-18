import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { env } from './env';
import { findOrCreateUser } from '../services/auth.service';
import { prisma } from '../db';

/**
 * Configure Passport's Google OAuth 2.0 strategy.
 *
 * Credentials are read exclusively from validated environment variables —
 * GOOGLE_CLIENT_SECRET is never logged or returned to the client.
 */
passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: env.GOOGLE_CALLBACK_URL,
      // Request that Google always return the user's email address.
      scope: ['profile', 'email'],
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const user = await findOrCreateUser(profile);
        return done(null, user);
      } catch (err) {
        return done(err as Error);
      }
    }
  )
);

/**
 * Serialize the authenticated user into the session.
 * Only the user's primary key (UUID) is stored in the session cookie —
 * never the full user object or any credentials.
 */
passport.serializeUser((user, done) => {
  done(null, user.id);
});

/**
 * Deserialize the user from the session on every authenticated request.
 * Loads the full User record from PostgreSQL using the stored ID.
 */
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return done(null, false);
    }
    return done(null, user);
  } catch (err) {
    return done(err as Error);
  }
});

export default passport;
