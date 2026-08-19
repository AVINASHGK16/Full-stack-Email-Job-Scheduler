import GoogleIcon from '../components/GoogleIcon';
import { API_BASE_URL } from '../services/api';
import './login.css';

/**
 * LoginPage — /login
 *
 * Phase 9.7: Google button is now connected to the existing backend OAuth route.
 * Clicking "Login with Google" performs a full browser navigation to:
 *   GET /auth/google  (Vite proxy → http://localhost:5000/auth/google)
 *
 * The backend handles the full OAuth flow (Google redirect, callback, session).
 * On success the backend redirects the browser to http://localhost:3000/scheduled.
 *
 * Email/Password login is NOT supported by the backend (no email/password route
 * exists). The Login button remains disabled — this is correct behaviour.
 */
export default function LoginPage() {
  /**
   * Navigate the browser to the backend Google OAuth entry point.
   * This is a full-page navigation (not fetch) — the browser must follow
   * the redirect chain: Express → Google → Express callback → frontend.
   *
   * We use window.location.href so the browser performs a real navigation
   * rather than a client-side React Router transition, which would not
   * trigger the server-side OAuth redirect correctly.
   */
  function handleGoogleLogin() {
    window.location.href = `${API_BASE_URL}/auth/google`;
  }

  return (
    <div className="login-page">
      <div className="login-card">

        <h1 className="login-heading">Login</h1>

        {/* Google OAuth button — wired to backend in Phase 9.7 */}
        <button
          type="button"
          className="btn-google"
          onClick={handleGoogleLogin}
        >
          <GoogleIcon />
          Login with Google
        </button>

        {/* Divider */}
        <div className="login-divider" aria-hidden="true">
          <span className="login-divider-text">or sign in through email</span>
        </div>

        {/* Email / password inputs — interactive (Phase 9.6.1 fix) */}
        <input
          className="login-input"
          type="email"
          placeholder="Email ID"
          autoComplete="email"
        />
        <input
          className="login-input"
          type="password"
          placeholder="Password"
          autoComplete="current-password"
        />

        {/*
         * Login button — remains disabled.
         * The backend has NO email/password authentication endpoint.
         * Manual credential login is not supported in the current backend.
         * This will be enabled when a POST /auth/login route is added.
         */}
        <button type="button" className="btn-login" disabled>
          Login
        </button>

      </div>
    </div>
  );
}
