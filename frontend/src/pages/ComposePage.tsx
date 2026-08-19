import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import { scheduleCampaign, getSenders, ApiError } from '../services/api';
import type { SenderItem } from '../types/sender';
import './compose.css';

interface FieldErrors {
  sender?: string;
  to?: string;
  subject?: string;
  message?: string;
  date?: string;
  time?: string;
  schedule?: string;
}

/**
 * ComposePage — /compose
 *
 * Form fields are controlled state. Fetches the authenticated user's senders
 * from GET /senders on mount, populating the "From" selector.
 * Performs client-side validation before calling POST /campaigns.
 * Navigates to /scheduled on success (201 or 207).
 * Displays field-level and API errors inline.
 */
export default function ComposePage() {
  const navigate = useNavigate();

  /* ── Sender state ── */
  const [senders, setSenders] = useState<SenderItem[]>([]);
  const [loadingSenders, setLoadingSenders] = useState<boolean>(true);
  const [selectedSenderId, setSelectedSenderId] = useState<string>('');

  /* ── Form state ── */
  const [to, setTo]           = useState('john@example.com');
  const [subject, setSubject] = useState('Meeting Follow-up');
  const [message, setMessage] = useState(
    'Hi John,\n\nJust following up regarding our meeting earlier this week. I wanted to make sure we\'re aligned on the next steps before the end of the month.\n\nLooking forward to hearing from you.\n\nBest regards,\nOliver'
  );
  const [date, setDate]       = useState('2026-08-25');
  const [time, setTime]       = useState('09:00');

  /* ── Validation & Submission state ── */
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting]   = useState(false);
  const [apiError, setApiError]       = useState<string | null>(null);

  /* ── Fetch Senders on Mount ── */
  useEffect(() => {
    let cancelled = false;

    getSenders()
      .then(data => {
        if (!cancelled) {
          setSenders(data);
          if (data.length > 0) {
            setSelectedSenderId(data[0].id);
          }
          setLoadingSenders(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setApiError(err instanceof Error ? err.message : 'Failed to load sender accounts');
          setLoadingSenders(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /* ── Client-side form validation ── */
  function validateForm(): boolean {
    const errors: FieldErrors = {};

    if (!selectedSenderId) {
      errors.sender = 'Please select a sender email address.';
    }

    const trimmedTo = to.trim();
    if (!trimmedTo) {
      errors.to = 'Recipient email address is required.';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedTo)) {
        errors.to = 'Please enter a valid email address (e.g. name@example.com).';
      }
    }

    if (!subject.trim()) {
      errors.subject = 'Email subject is required.';
    }

    if (!message.trim()) {
      errors.message = 'Email message body is required.';
    }

    if (!date) {
      errors.date = 'Schedule date is required.';
    }

    if (!time) {
      errors.time = 'Schedule time is required.';
    }

    if (date && time) {
      const startTimestamp = new Date(`${date}T${time}:00`).getTime();
      if (isNaN(startTimestamp)) {
        errors.schedule = 'Invalid schedule date or time format.';
      } else if (startTimestamp <= Date.now()) {
        errors.schedule = 'Schedule time must be set to a future date and time.';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  /* ── Submit handler ── */
  async function handleSubmit() {
    setApiError(null);

    // Prevent duplicate simultaneous submissions
    if (submitting) return;

    // Validate form inputs client-side
    const isValid = validateForm();
    if (!isValid) return;

    setSubmitting(true);

    const startTime = new Date(`${date}T${time}:00`).toISOString();

    try {
      await scheduleCampaign({
        senderId:     selectedSenderId,
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
          setApiError(
            'You must be logged in to schedule an email. ' +
            'Please log in with your Google account first.'
          );
        } else {
          setApiError(err.message);
        }
      } else {
        setApiError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const isScheduleDisabled = submitting || loadingSenders || senders.length === 0;

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

        {/* ── API error banner ── */}
        {apiError && (
          <div className="compose-error" role="alert">
            {apiError}
          </div>
        )}

        {/* ── Compose form card ── */}
        <div className="compose-form">

          {/* From (Sender) */}
          <div className="compose-field-row">
            <label className="compose-field-label" htmlFor="compose-sender">From</label>
            <div className="compose-field-control">
              {loadingSenders ? (
                <div className="compose-field-loading">Loading senders...</div>
              ) : senders.length === 0 ? (
                <div className="compose-field-warning">No configured senders found.</div>
              ) : (
                <select
                  id="compose-sender"
                  className={`compose-field-select${fieldErrors.sender ? ' invalid' : ''}`}
                  value={selectedSenderId}
                  onChange={e => {
                    setSelectedSenderId(e.target.value);
                    if (fieldErrors.sender) {
                      setFieldErrors(prev => ({ ...prev, sender: undefined }));
                    }
                  }}
                  aria-label="Sender email address"
                  aria-invalid={!!fieldErrors.sender}
                  disabled={submitting}
                >
                  {senders.map(sender => (
                    <option key={sender.id} value={sender.id}>
                      {sender.email}
                    </option>
                  ))}
                </select>
              )}
              {fieldErrors.sender && (
                <span className="compose-inline-error">{fieldErrors.sender}</span>
              )}
            </div>
          </div>

          {/* To */}
          <div className="compose-field-row">
            <label className="compose-field-label" htmlFor="compose-to">To</label>
            <div className="compose-field-control">
              <input
                id="compose-to"
                className={`compose-field-input${fieldErrors.to ? ' invalid' : ''}`}
                type="email"
                placeholder="Recipient email address"
                value={to}
                onChange={e => {
                  setTo(e.target.value);
                  if (fieldErrors.to) {
                    setFieldErrors(prev => ({ ...prev, to: undefined }));
                  }
                }}
                aria-label="Recipient email address"
                aria-invalid={!!fieldErrors.to}
                disabled={submitting}
              />
              {fieldErrors.to && (
                <span className="compose-inline-error">{fieldErrors.to}</span>
              )}
            </div>
          </div>

          {/* Subject */}
          <div className="compose-field-row">
            <label className="compose-field-label" htmlFor="compose-subject">Subject</label>
            <div className="compose-field-control">
              <input
                id="compose-subject"
                className={`compose-field-input${fieldErrors.subject ? ' invalid' : ''}`}
                type="text"
                placeholder="Email subject"
                value={subject}
                onChange={e => {
                  setSubject(e.target.value);
                  if (fieldErrors.subject) {
                    setFieldErrors(prev => ({ ...prev, subject: undefined }));
                  }
                }}
                aria-label="Email subject"
                aria-invalid={!!fieldErrors.subject}
                disabled={submitting}
              />
              {fieldErrors.subject && (
                <span className="compose-inline-error">{fieldErrors.subject}</span>
              )}
            </div>
          </div>

          {/* Message */}
          <div className="compose-message-wrapper">
            <label className="compose-message-label" htmlFor="compose-message">
              Message
            </label>
            <textarea
              id="compose-message"
              className={`compose-message-textarea${fieldErrors.message ? ' invalid' : ''}`}
              placeholder="Write your message here..."
              value={message}
              onChange={e => {
                setMessage(e.target.value);
                if (fieldErrors.message) {
                  setFieldErrors(prev => ({ ...prev, message: undefined }));
                }
              }}
              aria-label="Email message"
              aria-invalid={!!fieldErrors.message}
              disabled={submitting}
            />
            {fieldErrors.message && (
              <span className="compose-inline-error">{fieldErrors.message}</span>
            )}
          </div>

          {/* Schedule section */}
          <div className="compose-schedule-section">
            <div className="compose-schedule-heading">Schedule</div>
            <div className="compose-schedule-fields">
              <div className="compose-schedule-field">
                <label htmlFor="compose-date">Schedule date</label>
                <input
                  id="compose-date"
                  className={`compose-schedule-input${fieldErrors.date ? ' invalid' : ''}`}
                  type="date"
                  value={date}
                  onChange={e => {
                    setDate(e.target.value);
                    if (fieldErrors.date || fieldErrors.schedule) {
                      setFieldErrors(prev => ({ ...prev, date: undefined, schedule: undefined }));
                    }
                  }}
                  aria-label="Schedule date"
                  aria-invalid={!!fieldErrors.date}
                  disabled={submitting}
                />
                {fieldErrors.date && (
                  <span className="compose-schedule-error">{fieldErrors.date}</span>
                )}
              </div>
              <div className="compose-schedule-field">
                <label htmlFor="compose-time">Schedule time</label>
                <input
                  id="compose-time"
                  className={`compose-schedule-input${fieldErrors.time ? ' invalid' : ''}`}
                  type="time"
                  value={time}
                  onChange={e => {
                    setTime(e.target.value);
                    if (fieldErrors.time || fieldErrors.schedule) {
                      setFieldErrors(prev => ({ ...prev, time: undefined, schedule: undefined }));
                    }
                  }}
                  aria-label="Schedule time"
                  aria-invalid={!!fieldErrors.time}
                  disabled={submitting}
                />
                {fieldErrors.time && (
                  <span className="compose-schedule-error">{fieldErrors.time}</span>
                )}
              </div>
            </div>
            {fieldErrors.schedule && (
              <div className="compose-schedule-error-banner" role="alert">
                {fieldErrors.schedule}
              </div>
            )}
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
              disabled={isScheduleDisabled}
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
