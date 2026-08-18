import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import ScheduledPage from './pages/ScheduledPage';
import SentPage from './pages/SentPage';
import ComposePage from './pages/ComposePage';

/**
 * Root application component.
 *
 * Defines all top-level routes for the Email Job Scheduler.
 * Pages are currently placeholder stubs; real UI is added incrementally
 * in Phase 9.2 and beyond.
 *
 * Routes:
 *   /           → HomePage     (Dashboard — Phase 9.2+)
 *   /login      → LoginPage    (Google OAuth login — Phase 9.2)
 *   /scheduled  → ScheduledPage
 *   /sent       → SentPage
 *   /compose    → ComposePage
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/scheduled" element={<ScheduledPage />} />
        <Route path="/sent" element={<SentPage />} />
        <Route path="/compose" element={<ComposePage />} />
      </Routes>
    </BrowserRouter>
  );
}
