import { Navigate } from 'react-router-dom';

/**
 * HomePage — /
 *
 * Redirects to the default dashboard view (/scheduled).
 */
export default function HomePage() {
  return <Navigate to="/scheduled" replace />;
}
