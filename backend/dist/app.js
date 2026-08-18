"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const express_session_1 = __importDefault(require("express-session"));
const passport_1 = __importDefault(require("./config/passport"));
const env_1 = require("./config/env");
const routes_1 = __importDefault(require("./routes"));
const notFound_1 = require("./middleware/notFound");
const error_1 = require("./middleware/error");
const app = (0, express_1.default)();
// Standard middleware
app.use((0, cors_1.default)({
    origin: env_1.env.NODE_ENV === 'production' ? false : 'http://localhost:3000',
    credentials: true, // Allow cookies to be sent cross-origin (needed for session cookie)
}));
app.use(express_1.default.json());
// Session middleware — must be registered BEFORE passport middleware.
// HTTP-only cookie prevents JavaScript access to the session ID.
// MemoryStore is used in Phase 8.1 (suitable for development/testing).
// Cast required: express-session's RequestHandler type signature differs
// slightly from Express's own overloads. This is a well-known ecosystem
// type conflict and is safe to cast here.
app.use((0, express_session_1.default)({
    // Reuse JWT_SECRET as the session signing secret.
    secret: env_1.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true, // Prevent client-side JS from reading the cookie
        secure: env_1.env.NODE_ENV === 'production', // HTTPS-only in production
        sameSite: 'lax', // Protect against CSRF while allowing OAuth redirects
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
}));
// Passport authentication middleware.
// initialize() sets up req.user and related helpers.
// session() integrates with express-session to persist authentication.
// Same cast needed for passport handlers (passport uses its own Handler type).
app.use(passport_1.default.initialize());
app.use(passport_1.default.session());
// API Routes
app.use(routes_1.default);
// Centralized 404 handling
app.use(notFound_1.notFoundHandler);
// Centralized error middleware
app.use(error_1.errorHandler);
exports.default = app;
