import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import { scheduleCampaign, getSenders, ApiError } from '../services/api';
import type { SenderItem } from '../types/sender';
import type { ScheduleCampaignPartial } from '../types/campaign';
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
 * Extracts and deduplicates valid email addresses from raw text / CSV data.
 */
function extractEmailsFromText(text: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex) || [];

  const seen = new Set<string>();
  const uniqueEmails: string[] = [];

  for (const match of matches) {
    const trimmed = match.trim();
    const lower = trimmed.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      uniqueEmails.push(trimmed);
    }
  }

  return uniqueEmails;
}

/**
 * Parses manual recipient string, separating valid emails and identifying invalid tokens.
 * Supports comma, semicolon, space, or newline delimiters.
 */
function parseManualRecipients(raw: string): {
  validEmails: string[];
  invalidTokens: string[];
  uniqueValidEmails: string[];
} {
  const trimmedRaw = raw.trim();
  if (!trimmedRaw) {
    return { validEmails: [], invalidTokens: [], uniqueValidEmails: [] };
  }

  const tokens = trimmedRaw
    .split(/[,;\s\n\r]+/)
    .map(t => t.trim())
    .filter(Boolean);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const validEmails: string[] = [];
  const invalidTokens: string[] = [];
  const seen = new Set<string>();
  const uniqueValidEmails: string[] = [];

  for (const token of tokens) {
    if (emailRegex.test(token)) {
      validEmails.push(token);
      const lower = token.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        uniqueValidEmails.push(token);
      }
    } else {
      invalidTokens.push(token);
    }
  }

  return { validEmails, invalidTokens, uniqueValidEmails };
}

/**
 * Combines and deduplicates manual recipients and imported file recipients.
 */
function getUnifiedRecipientSummary(manualRaw: string, imported: string[]) {
  const { validEmails: manualValid, invalidTokens: manualInvalid, uniqueValidEmails: manualUnique } =
    parseManualRecipients(manualRaw);

  const seen = new Set<string>();
  const finalRecipients: string[] = [];

  // Add manual unique emails first
  for (const email of manualUnique) {
    seen.add(email.toLowerCase());
    finalRecipients.push(email);
  }

  // Add imported emails if not already present
  for (const email of imported) {
    const trimmed = email.trim();
    const lower = trimmed.toLowerCase();
    if (trimmed && !seen.has(lower)) {
      seen.add(lower);
      finalRecipients.push(trimmed);
    }
  }

  return {
    manualValidCount: manualValid.length,
    manualUniqueCount: manualUnique.length,
    manualInvalid,
    importedCount: imported.length,
    totalUniqueCount: finalRecipients.length,
    finalRecipients,
  };
}

/**
 * Returns today's date formatted as YYYY-MM-DD for HTML date input initialization.
 */
function getDefaultScheduleDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns a default schedule time (1 hour in the future) formatted as HH:MM.
 */
function getDefaultScheduleTime(): string {
  const future = new Date(Date.now() + 60 * 60 * 1000);
  const hours = String(future.getHours()).padStart(2, '0');
  const minutes = String(future.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * ComposePage — /compose
 *
 * Form fields are controlled state. Fetches the authenticated user's senders
 * from GET /senders on mount, populating the "From" selector.
 * Supports multiple manual recipients and CSV/TXT file import.
 * Handles 201 Created (navigate to /scheduled) and 207 Multi-Status (partial success UI with failure breakdown).
 */
export default function ComposePage() {
  const navigate = useNavigate();

  /* ── Sender state ── */
  const [senders, setSenders] = useState<SenderItem[]>([]);
  const [loadingSenders, setLoadingSenders] = useState<boolean>(true);
  const [selectedSenderId, setSelectedSenderId] = useState<string>('');

  /* ── Form state ── */
  const [to, setTo]           = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [date, setDate]       = useState(getDefaultScheduleDate);
  const [time, setTime]       = useState(getDefaultScheduleTime);

  /* ── File Import state ── */
  const [importedEmails, setImportedEmails] = useState<string[]>([]);
  const [fileName, setFileName]             = useState<string | null>(null);

  /* ── Validation & Submission state ── */
  const [fieldErrors, setFieldErrors]     = useState<FieldErrors>({});
  const [submitting, setSubmitting]       = useState(false);
  const [apiError, setApiError]           = useState<string | null>(null);
  const [partialResult, setPartialResult] = useState<ScheduleCampaignPartial | null>(null);

  /* ── Computed Unified Recipient Summary ── */
  const recipientSummary = useMemo(() => {
    return getUnifiedRecipientSummary(to, importedEmails);
  }, [to, importedEmails]);

  /* ── Fetch Senders on Mount / Refresh ── */
  const fetchSenders = useCallback(async () => {
    setLoadingSenders(true);
    try {
      const data = await getSenders();
      setSenders(data);
      if (data.length > 0) {
        setSelectedSenderId(prev => (prev && data.some(s => s.id === prev) ? prev : data[0].id));
      }
      setApiError(null);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to load sender accounts');
    } finally {
      setLoadingSenders(false);
    }
  }, []);

  useEffect(() => {
    fetchSenders();
  }, [fetchSenders]);

  /* ── Handle File Upload ── */
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        const emails = extractEmailsFromText(content);
        setImportedEmails(emails);
        setFileName(file.name);
        if (fieldErrors.to) {
          setFieldErrors(prev => ({ ...prev, to: undefined }));
        }
      }
    };
    reader.readAsText(file);
  }

  /* ── Handle Remove File ── */
  function handleRemoveFile() {
    setImportedEmails([]);
    setFileName(null);
    const input = document.getElementById('compose-file-input') as HTMLInputElement | null;
    if (input) input.value = '';
  }

  /* ── Client-side form validation ── */
  function validateForm(): boolean {
    const errors: FieldErrors = {};

    if (!selectedSenderId) {
      errors.sender = 'Please select a sender email address.';
    }

    // Check for invalid manual email tokens
    if (recipientSummary.manualInvalid.length > 0) {
      const invalidList = recipientSummary.manualInvalid.slice(0, 3).join(', ');
      const extra = recipientSummary.manualInvalid.length > 3 ? '...' : '';
      errors.to = `Invalid email address${recipientSummary.manualInvalid.length > 1 ? 'es' : ''}: ${invalidList}${extra}`;
    } else if (recipientSummary.totalUniqueCount === 0) {
      errors.to = 'At least one valid recipient is required (enter emails or upload a CSV/TXT file).';
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
    setPartialResult(null);

    // Prevent duplicate simultaneous submissions
    if (submitting) return;

    // Validate form inputs client-side
    const isValid = validateForm();
    if (!isValid) return;

    const { finalRecipients } = recipientSummary;
    if (finalRecipients.length === 0) return;

    setSubmitting(true);

    const startTime = new Date(`${date}T${time}:00`).toISOString();

    try {
      const response = await scheduleCampaign({
        senderId:     selectedSenderId,
        subject:      subject.trim(),
        body:         message.trim(),
        startTime,
        delaySeconds: 0,
        hourlyLimit:  0,
        recipients:   finalRecipients,
      });

      // Handle 207 Multi-Status (partial success)
      if (response.status === 'partial_success' || 'failures' in response) {
        setPartialResult(response as ScheduleCampaignPartial);
        return;
      }

      // Handle 201 Created (full success)
      navigate('/scheduled');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 401) {
          setApiError(
            'You must be logged in to schedule an email. ' +
            'Please log in with your Google account first.'
          );
        } else if (err.statusCode === 403) {
          setApiError('Forbidden: You do not have permission to use the selected sender account.');
        } else if (err.statusCode === 404) {
          setApiError('The requested sender account or user profile could not be found.');
        } else if (err.statusCode === 400) {
          setApiError(err.message || 'Validation failed. Please check your schedule settings and recipient list.');
        } else {
          setApiError(err.message || `Scheduling failed with HTTP error ${err.statusCode}.`);
        }
      } else {
        setApiError('Unable to connect to the scheduling service. Please check your network and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const isScheduleDisabled = submitting || loadingSenders || senders.length === 0;

  return (
    <DashboardLayout
      activeNav="compose"
      onRefresh={fetchSenders}
      isRefreshing={loadingSenders}
    >
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

        {/* ── Partial Success (HTTP 207 Multi-Status) Result Card ── */}
        {partialResult && (
          <div className="compose-partial-card" role="alert">
            <div className="compose-partial-header">
              <span className="compose-partial-icon" aria-hidden="true">⚠️</span>
              <div className="compose-partial-title">
                Campaign Created with Partial Failures (HTTP 207)
              </div>
            </div>
            <p className="compose-partial-desc">
              Your campaign was created in the database, but some recipient jobs could not be queued.
            </p>

            <div className="compose-partial-stats">
              <div className="compose-partial-stat success">
                <span className="compose-stat-num">{partialResult.recipients.length}</span>
                <span className="compose-stat-label">Scheduled</span>
              </div>
              <div className="compose-partial-stat failure">
                <span className="compose-stat-num">{partialResult.failures.length}</span>
                <span className="compose-stat-label">Failed</span>
              </div>
              <div className="compose-partial-stat total">
                <span className="compose-stat-num">
                  {partialResult.recipients.length + partialResult.failures.length}
                </span>
                <span className="compose-stat-label">Total</span>
              </div>
            </div>

            {partialResult.failures.length > 0 && (
              <div className="compose-partial-failures-list">
                <div className="compose-failures-title">Queue Failures:</div>
                <ul>
                  {partialResult.failures.map(f => (
                    <li key={f.id}>
                      <strong>{f.email}</strong>: {f.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="compose-partial-actions">
              <button
                type="button"
                className="compose-btn-partial-dismiss"
                onClick={() => setPartialResult(null)}
              >
                Dismiss
              </button>
              <Link to="/scheduled" className="compose-btn-partial-view">
                View Scheduled Emails →
              </Link>
            </div>
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

          {/* To (Manual Multiple Recipients) */}
          <div className="compose-field-row">
            <label className="compose-field-label" htmlFor="compose-to">To</label>
            <div className="compose-field-control">
              <input
                id="compose-to"
                className={`compose-field-input${fieldErrors.to ? ' invalid' : ''}`}
                type="text"
                placeholder="e.g. user1@example.com, user2@example.com or import file"
                value={to}
                onChange={e => {
                  setTo(e.target.value);
                  if (fieldErrors.to) {
                    setFieldErrors(prev => ({ ...prev, to: undefined }));
                  }
                }}
                aria-label="Recipient email addresses"
                aria-invalid={!!fieldErrors.to}
                disabled={submitting}
              />
              {fieldErrors.to && (
                <span className="compose-inline-error">{fieldErrors.to}</span>
              )}
            </div>
          </div>

          {/* Import CSV/TXT */}
          <div className="compose-upload-row">
            <label className="compose-field-label">Import</label>
            <div className="compose-upload-control">
              <div className="compose-file-picker">
                <input
                  id="compose-file-input"
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  className="compose-file-hidden"
                  onChange={handleFileUpload}
                  disabled={submitting}
                />
                <label htmlFor="compose-file-input" className="compose-upload-btn">
                  <UploadIcon />
                  <span>Choose CSV or TXT file</span>
                </label>

                {fileName && (
                  <div className="compose-file-info">
                    <span className="compose-file-name">{fileName}</span>
                    {importedEmails.length > 0 ? (
                      <span className="compose-file-badge success">
                        ✓ {importedEmails.length} {importedEmails.length === 1 ? 'email' : 'emails'} imported
                      </span>
                    ) : (
                      <span className="compose-file-badge warning">
                        No valid emails detected
                      </span>
                    )}
                    <button
                      type="button"
                      className="compose-file-remove"
                      onClick={handleRemoveFile}
                      title="Remove imported file"
                      disabled={submitting}
                      aria-label="Remove imported file"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {/* Recipient Count Breakdown & Summary */}
              {recipientSummary.totalUniqueCount > 0 && (
                <div className="compose-recipient-summary">
                  {recipientSummary.manualUniqueCount > 0 && (
                    <span className="compose-recipient-pill">
                      {recipientSummary.manualUniqueCount} manual
                    </span>
                  )}
                  {recipientSummary.importedCount > 0 && (
                    <span className="compose-recipient-pill">
                      {recipientSummary.importedCount} imported
                    </span>
                  )}
                  <span className="compose-recipient-pill total">
                    {recipientSummary.totalUniqueCount} total unique {recipientSummary.totalUniqueCount === 1 ? 'recipient' : 'recipients'}
                  </span>
                </div>
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

function UploadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
