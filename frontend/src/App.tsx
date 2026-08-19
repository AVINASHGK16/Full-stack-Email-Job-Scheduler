import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import ScheduledPage from './pages/ScheduledPage';
import SentPage from './pages/SentPage';
import ComposePage from './pages/ComposePage';
import ProtectedRoute from './components/auth/ProtectedRoute';

/**
 * Root application component.
 *
 * Defines all top-level routes for the Email Job Scheduler.
 *
 * Routes:
 *   /           → HomePage     (public)
 *   /login      → LoginPage    (public — Google OAuth entry point)
 *   /scheduled  → ScheduledPage  ← Protected (Phase 9.8)
 *   /sent       → SentPage       ← Protected (Phase 9.8)
 *   /compose    → ComposePage    ← Protected (Phase 9.8)
 *
 * ProtectedRoute calls GET /auth/me on every mount.
 * Unauthenticated sessions are redirected to /login.
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── Public routes ── */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* ── Protected dashboard routes (Phase 9.8) ── */}
        <Route
          path="/scheduled"
          element={
            <ProtectedRoute>
              <ScheduledPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sent"
          element={
            <ProtectedRoute>
              <SentPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/compose"
          element={
            <ProtectedRoute>
              <ComposePage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
