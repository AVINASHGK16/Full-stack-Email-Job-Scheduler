import { Link } from 'react-router-dom';
import './sidebar.css';

interface SidebarProps {
  activeNav: 'scheduled' | 'sent';
}

/**
 * Sidebar — left navigation panel.
 *
 * Static placeholder data for Phase 9.4.
 * Real user info and dynamic counts are wired in a later phase.
 */
export default function Sidebar({ activeNav }: SidebarProps) {
  return (
    <aside className="sidebar">

      {/* ── Logo ── */}
      <div className="sidebar-logo">
        <span className="sidebar-logo-text">ONB</span>
        <EnvelopeIcon className="sidebar-logo-icon" />
      </div>

      {/* ── Profile card — static placeholder ── */}
      <div className="sidebar-profile">
        <div className="sidebar-avatar" aria-label="User avatar">OB</div>
        <div className="sidebar-profile-info">
          <div className="sidebar-profile-name">Oliver Brown</div>
          <div className="sidebar-profile-email">oliver.brown@domain.io</div>
        </div>
        <ChevronDownIcon className="sidebar-profile-chevron" />
      </div>

      {/* ── Compose button (White background + green outline) ── */}
      <Link to="/compose" className="sidebar-compose-btn">
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

/* ── Inline SVG icons ─────────────────────────────────────────────────── */

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
