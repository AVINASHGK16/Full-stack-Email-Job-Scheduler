import GoogleIcon from '../components/GoogleIcon';
import './login.css';

/**
 * LoginPage — /login
 *
 * Visual-only implementation of the login UI (Phase 9.2).
 * Buttons and inputs are rendered but perform no actions yet.
 * Google OAuth and form submission are wired in a later phase.
 */
export default function LoginPage() {
  return (
    <div className="login-page">
      <div className="login-card">

        <h1 className="login-heading">Login</h1>

        {/* Google OAuth button — visual only, no handler yet */}
        <button type="button" className="btn-google" disabled>
          <GoogleIcon />
          Login with Google
        </button>

        {/* Divider */}
        <div className="login-divider" aria-hidden="true">
          <span className="login-divider-text">or sign up through email</span>
        </div>

        {/* Email / password inputs — visual only */}
        <input
          className="login-input"
          type="email"
          placeholder="Email ID"
          autoComplete="email"
          readOnly
        />
        <input
          className="login-input"
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          readOnly
        />

        {/* Login button — visual only, no handler yet */}
        <button type="button" className="btn-login" disabled>
          Login
        </button>

      </div>
    </div>
  );
}
