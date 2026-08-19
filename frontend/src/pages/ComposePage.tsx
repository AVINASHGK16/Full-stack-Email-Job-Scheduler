import { Link } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import './compose.css';

/**
 * ComposePage — /compose
 *
 * Visual-only email composition form for Phase 9.5.
 * No backend calls, no API requests, no scheduling logic.
 * Cancel navigates back to /scheduled via React Router Link.
 * Schedule Email button has no-op onClick.
 */
export default function ComposePage() {
  return (
    <DashboardLayout activeNav="compose">
      <div className="compose-content">

        {/* ── Page header ── */}
        <div className="compose-page-header">
          <Link to="/scheduled" className="compose-back-btn" aria-label="Back to Scheduled">
            <BackArrowIcon />
          </Link>
          <h1 className="compose-page-title">Compose</h1>
        </div>

        {/* ── Compose form card ── */}
        <div className="compose-form">

          {/* To */}
          <div className="compose-field-row">
            <span className="compose-field-label">To</span>
            <input
              id="compose-to"
              className="compose-field-input"
              type="email"
              placeholder="Recipient email address"
              defaultValue="john@example.com"
              aria-label="Recipient email address"
            />
          </div>

          {/* Subject */}
          <div className="compose-field-row">
            <span className="compose-field-label">Subject</span>
            <input
              id="compose-subject"
              className="compose-field-input"
              type="text"
              placeholder="Email subject"
              defaultValue="Meeting Follow-up"
              aria-label="Email subject"
            />
          </div>

          {/* Message */}
          <div className="compose-message-wrapper">
            <span className="compose-message-label">Message</span>
            <textarea
              id="compose-message"
              className="compose-message-textarea"
              placeholder="Write your message here..."
              defaultValue={`Hi John,\n\nJust following up regarding our meeting earlier this week. I wanted to make sure we're aligned on the next steps before the end of the month.\n\nLooking forward to hearing from you.\n\nBest regards,\nOliver`}
              aria-label="Email message"
            />
          </div>

          {/* Schedule section */}
          <div className="compose-schedule-section">
            <div className="compose-schedule-heading">Schedule</div>
            <div className="compose-schedule-fields">
              <div className="compose-schedule-field">
                <label htmlFor="compose-date">Schedule date</label>
                <input
                  id="compose-date"
                  className="compose-schedule-input"
                  type="date"
                  defaultValue="2026-08-25"
                  aria-label="Schedule date"
                />
              </div>
              <div className="compose-schedule-field">
                <label htmlFor="compose-time">Schedule time</label>
                <input
                  id="compose-time"
                  className="compose-schedule-input"
                  type="time"
                  defaultValue="09:00"
                  aria-label="Schedule time"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="compose-actions">
            <Link to="/scheduled" className="compose-btn-cancel">
              Cancel
            </Link>
            <button
              id="compose-submit"
              type="button"
              className="compose-btn-primary"
              onClick={() => {}}
              aria-label="Schedule email"
            >
              <CalendarIcon />
              Schedule Email
            </button>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}

/* ── Inline SVG icons ─────────────────────────────────────── */

function BackArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
