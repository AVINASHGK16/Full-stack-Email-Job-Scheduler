import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import { scheduleCampaign, ApiError } from '../services/api';
import './compose.css';

/**
 * SENDER_ID — The development seed sender UUID.
 *
 * The backend seed (backend/src/db/seed.ts) always creates:
 *   id: '00000000-0000-0000-0000-000000000000'
 *
 * POST /campaigns requires a valid senderId. Phase 9.6 hardcodes this seeded
 * value because the Compose UI has no sender-selection control. A later phase
 * will add proper sender management.
 */
const SENDER_ID = '00000000-0000-0000-0000-000000000000';

/**
 * ComposePage — /compose
 *
 * Phase 9.6: form fields are controlled state. On submit, calls POST /campaigns
 * via the api service. Navigates to /scheduled on success (201 or 207).
 * Displays an inline error on failure — including a login hint on 401.
 *
 * No backend files were modified for this page.
 * No new dependencies were installed.
 */
export default function ComposePage() {
  const navigate = useNavigate();

  /* ── Form state ── */
  const [to, setTo]           = useState('john@example.com');
  const [subject, setSubject] = useState('Meeting Follow-up');
  const [message, setMessage] = useState(
    'Hi John,\n\nJust following up regarding our meeting earlier this week. I wanted to make sure we\'re aligned on the next steps before the end of the month.\n\nLooking forward to hearing from you.\n\nBest regards,\nOliver'
  );
  const [date, setDate]       = useState('2026-08-25');
  const [time, setTime]       = useState('09:00');

  /* ── Submit state ── */
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  /* ── Submit handler ── */
  async function handleSubmit() {
    setError(null);
    setSubmitting(true);

    // Combine date + time into an ISO timestamp the backend accepts.
    // The backend validates: new Date(startTime).getTime() > Date.now()
    const startTime = new Date(`${date}T${time}:00`).toISOString();

    try {
      await scheduleCampaign({
        senderId:     SENDER_ID,
        subject:      subject.trim(),
        body:         message.trim(),
        startTime,
        delaySeconds: 0,
        hourlyLimit:  0,
        recipients:   [to.trim()],
      });

      // 201 Created or 207 Multi-Status — both treated as success for navigation.
      navigate('/scheduled');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 401) {
          setError(
            'You must be logged in to schedule an email. ' +
            'Please log in with your Google account first.'
          );
        } else {
          setError(err.message);
        }
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

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

        {/* ── Inline error banner ── */}
        {error && (
          <div className="compose-error" role="alert">
            {error}
          </div>
        )}

        {/* ── Compose form card ── */}
        <div className="compose-form">

          {/* To */}
          <div className="compose-field-row">
            <label className="compose-field-label" htmlFor="compose-to">To</label>
            <input
              id="compose-to"
              className="compose-field-input"
              type="email"
              placeholder="Recipient email address"
              value={to}
              onChange={e => setTo(e.target.value)}
              aria-label="Recipient email address"
            />
          </div>

          {/* Subject */}
          <div className="compose-field-row">
            <label className="compose-field-label" htmlFor="compose-subject">Subject</label>
            <input
              id="compose-subject"
              className="compose-field-input"
              type="text"
              placeholder="Email subject"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              aria-label="Email subject"
            />
          </div>

          {/* Message */}
          <div className="compose-message-wrapper">
            <label className="compose-message-label" htmlFor="compose-message">
              Message
            </label>
            <textarea
              id="compose-message"
              className="compose-message-textarea"
              placeholder="Write your message here..."
              value={message}
              onChange={e => setMessage(e.target.value)}
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
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  aria-label="Schedule date"
                />
              </div>
              <div className="compose-schedule-field">
                <label htmlFor="compose-time">Schedule time</label>
                <input
                  id="compose-time"
                  className="compose-schedule-input"
                  type="time"
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  aria-label="Schedule time"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="compose-actions">
            <Link
              to="/scheduled"
              className="compose-btn-cancel"
              aria-disabled={submitting}
              tabIndex={submitting ? -1 : undefined}
            >
              Cancel
            </Link>
            <button
              id="compose-submit"
              type="button"
              className="compose-btn-primary"
              onClick={handleSubmit}
              disabled={submitting}
              aria-label={submitting ? 'Scheduling…' : 'Schedule email'}
            >
              <CalendarIcon />
              {submitting ? 'Scheduling…' : 'Schedule Email'}
            </button>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}

/* ── Inline SVG icons ─────────────────────────────────────────────────────── */

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
