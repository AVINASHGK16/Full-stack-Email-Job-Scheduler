import express, { Express, RequestHandler } from 'express';
import cors from 'cors';
import session from 'express-session';
import passport from './config/passport';
import { env } from './config/env';
import router from './routes';
import { notFoundHandler } from './middleware/notFound';
import { errorHandler } from './middleware/error';

const app: Express = express();

// Standard middleware
app.use(cors({
  origin: env.NODE_ENV === 'production' ? false : 'http://localhost:3000',
  credentials: true, // Allow cookies to be sent cross-origin (needed for session cookie)
}));
app.use(express.json());

// Session middleware — must be registered BEFORE passport middleware.
// HTTP-only cookie prevents JavaScript access to the session ID.
// MemoryStore is used in Phase 8.1 (suitable for development/testing).
// Cast required: express-session's RequestHandler type signature differs
// slightly from Express's own overloads. This is a well-known ecosystem
// type conflict and is safe to cast here.
app.use(
  session({
    // Reuse JWT_SECRET as the session signing secret.
    secret: env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,             // Prevent client-side JS from reading the cookie
      secure: env.NODE_ENV === 'production', // HTTPS-only in production
      sameSite: 'lax',           // Protect against CSRF while allowing OAuth redirects
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }) as unknown as RequestHandler
);

// Passport authentication middleware.
// initialize() sets up req.user and related helpers.
// session() integrates with express-session to persist authentication.
// Same cast needed for passport handlers (passport uses its own Handler type).
app.use(passport.initialize() as unknown as RequestHandler);
app.use(passport.session() as unknown as RequestHandler);

// API Routes
app.use(router);

// Centralized 404 handling
app.use(notFoundHandler);

// Centralized error middleware
app.use(errorHandler);

export default app;
