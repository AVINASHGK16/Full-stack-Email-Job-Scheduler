import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getMe, logoutUser } from '../../services/api';
import type { AuthUser } from '../../types/auth';
import './sidebar.css';

interface SidebarProps {
  activeNav: 'scheduled' | 'sent' | 'compose';
}

/**
 * Sidebar — left navigation panel.
 *
 * Phase 9.7: Fetches the real authenticated user from GET /auth/me on mount.
 * Falls back to initials "?" and empty strings while loading or if unauthenticated.
 * Logout button calls POST /auth/logout and navigates to /login.
 *
 * Visual layout is unchanged from Phase 9.4.
 */
export default function Sidebar({ activeNav }: SidebarProps) {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);

  /* ── Fetch authenticated user on mount ── */
  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => {
        // 401 = unauthenticated, or backend unreachable.
        // Leave user as null — fallback UI is shown.
      });
  }, []);

  /* ── Logout handler ── */
  async function handleLogout() {
    try {
      await logoutUser();
    } catch {
      // Even if the server-side logout fails, clear the local state
      // and redirect — the user should not be stuck on the dashboard.
    }
    setUser(null);
    navigate('/login');
  }

  /* ── Derive display values from real user or fallback ── */
  const displayName  = user?.name  ?? '—';
  const displayEmail = user?.email ?? '';
  const initials     = deriveInitials(user?.name ?? null);

  return (
    <aside className="sidebar">

      {/* ── Logo ── */}
      <div className="sidebar-logo">
        <span className="sidebar-logo-text">ONB</span>
        <EnvelopeIcon className="sidebar-logo-icon" />
      </div>

      {/* ── Profile card — real user data from GET /auth/me ── */}
      <div className="sidebar-profile">
        <div className="sidebar-avatar" aria-label="User avatar">{initials}</div>
        <div className="sidebar-profile-info">
          <div className="sidebar-profile-name">{displayName}</div>
          <div className="sidebar-profile-email">{displayEmail}</div>
        </div>
        <ChevronDownIcon className="sidebar-profile-chevron" />
      </div>

      {/* ── Logout button — wired to POST /auth/logout ── */}
      <button
        type="button"
        className="sidebar-logout-btn"
        onClick={handleLogout}
        aria-label="Log out"
      >
        <LogOutIcon className="sidebar-logout-icon" />
        Log out
      </button>

      {/* ── Compose button ── */}
      <Link to="/compose" className={`sidebar-compose-btn${activeNav === 'compose' ? ' active' : ''}`}>
        Compose
      </Link>

      {/* ── Navigation ── */}
      <div className="sidebar-section-label">CORE</div>
      <nav className="sidebar-nav" aria-label="Main navigation">

        <Link
          to="/scheduled"
          className={`sidebar-nav-item${activeNav === 'scheduled' ? ' active' : ''}`}
        >
          <ClockIcon className="sidebar-nav-icon" />
          <span className="sidebar-nav-label">Scheduled</span>
          <span className="sidebar-nav-count">12</span>
        </Link>

        <Link
          to="/sent"
          className={`sidebar-nav-item${activeNav === 'sent' ? ' active' : ''}`}
        >
          <PaperPlaneIcon className="sidebar-nav-icon" />
          <span className="sidebar-nav-label">Sent</span>
          <span className="sidebar-nav-count">785</span>
        </Link>

      </nav>
    </aside>
  );
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

/**
 * Derive up to 2 uppercase initials from a display name.
 * Examples: "Oliver Brown" → "OB", "Alice" → "A", null → "?"
 */
function deriveInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* ── Inline SVG icons ─────────────────────────────────────────────────────── */

function EnvelopeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function PaperPlaneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function LogOutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
