import { useState, useEffect, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { getMe, ApiError } from '../../services/api';
import './protected-route.css';


type AuthState = 'checking' | 'authenticated' | 'unauthenticated';

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * ProtectedRoute — Phase 9.8
 *
 * Wraps dashboard routes that require an authenticated session.
 *
 * Behaviour:
 *  - 'checking'       → renders a minimal full-screen loading indicator
 *                        while GET /auth/me is in-flight.
 *  - 'authenticated'  → renders the requested child page.
 *  - 'unauthenticated'→ redirects to /login (replaces history entry so
 *                        the back button does not loop back to the guard).
 *
 * Uses the existing getMe() helper from api.ts — no new auth mechanism.
 * No authentication logic is duplicated inside individual page components.
 */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [authState, setAuthState] = useState<AuthState>('checking');

  useEffect(() => {
    let cancelled = false;

    getMe()
      .then(() => {
        if (!cancelled) setAuthState('authenticated');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // 401 = no valid session. Any other error (network down, 500)
        // is also treated as unauthenticated — better to redirect to
        // login than to show a broken dashboard.
        if (err instanceof ApiError && err.statusCode !== 401) {
          console.warn('[ProtectedRoute] Unexpected auth check error:', err);
        }
        setAuthState('unauthenticated');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (authState === 'checking') {
    return (
      <div className="protected-route-loading" aria-label="Checking authentication…">
        <span className="protected-route-spinner" aria-hidden="true" />
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    // replace: true so the protected URL is not pushed to browser history —
    // pressing Back will not create a redirect loop.
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
