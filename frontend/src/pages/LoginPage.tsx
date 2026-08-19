import { useState, type FormEvent } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import GoogleIcon from '../components/GoogleIcon';
import { API_BASE_URL, loginWithCredentials } from '../services/api';
import './login.css';

/**
 * LoginPage — /login
 *
 * Supports dual authentication:
 * 1. Google OAuth 2.0 (GET /auth/google)
 * 2. Manual Email + Password login (POST /auth/login)
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const errorParam = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  let queryErrorMessage: string | null = null;
  if (errorParam === 'oauth_failed') {
    queryErrorMessage = 'Google authentication failed or was cancelled. Please try again.';
  } else if (errorParam === 'unauthorized') {
    queryErrorMessage = 'Your session has expired. Please log in again.';
  } else if (errorParam) {
    queryErrorMessage = 'Authentication error. Please try logging in again.';
  }

  const activeError = formError || queryErrorMessage;

  /**
   * Navigate the browser to the backend Google OAuth entry point.
   */
  function handleGoogleLogin() {
    window.location.href = `${API_BASE_URL}/auth/google`;
  }

  /**
   * Submit manual email and password credentials to POST /auth/login.
   */
  async function handleManualLogin(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setFormError('Please enter both email and password.');
      return;
    }

    setFormError(null);
    setLoading(true);

    try {
      await loginWithCredentials({ email: email.trim(), password });
      navigate('/scheduled');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid email or password.';
      setFormError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">

        <h1 className="login-heading">Login</h1>

        {activeError && (
          <div className="login-error-banner" role="alert">
            {activeError}
          </div>
        )}

        {/* Google OAuth button */}
        <button
          type="button"
          className="btn-google"
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          <GoogleIcon />
          Login with Google
        </button>

        {/* Divider */}
        <div className="login-divider" aria-hidden="true">
          <span className="login-divider-text">or sign in through email</span>
        </div>

        {/* Email / password credentials form */}
        <form onSubmit={handleManualLogin}>
          <input
            className="login-input"
            type="email"
            placeholder="Email ID"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (formError) setFormError(null);
            }}
            disabled={loading}
            required
          />
          <input
            className="login-input"
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (formError) setFormError(null);
            }}
            disabled={loading}
            required
          />

          <button
            type="submit"
            className="btn-login"
            disabled={loading || !email.trim() || !password}
          >
            {loading ? 'Logging in…' : 'Login'}
          </button>
        </form>

      </div>
    </div>
  );
}
