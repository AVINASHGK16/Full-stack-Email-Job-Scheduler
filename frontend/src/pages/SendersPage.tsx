import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import { getSenders, createSender, verifySender, ApiError } from '../services/api';
import type { SenderItem } from '../types/sender';
import './senders.css';

interface FormErrors {
  email?: string;
  smtpHost?: string;
  smtpPort?: string;
  smtpUser?: string;
  smtpPassword?: string;
}

/**
 * SendersPage — /senders
 *
 * Displays the authenticated user's configured email senders fetched from GET /senders.
 * Reflects persisted verification status (PENDING, VERIFIED, FAILED) and verified timestamp from database.
 * Supports adding new senders and testing SMTP connectivity with automatic persisted state refresh.
 */
export default function SendersPage() {
  const [senders, setSenders] = useState<SenderItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError]     = useState<string | null>(null);

  /* ── Sender Creation Form State ── */
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);
  const [email, setEmail]                   = useState<string>('');
  const [smtpHost, setSmtpHost]             = useState<string>('');
  const [smtpPort, setSmtpPort]             = useState<string>('587');
  const [smtpUser, setSmtpUser]             = useState<string>('');
  const [smtpPassword, setSmtpPassword]     = useState<string>('');

  const [formErrors, setFormErrors]         = useState<FormErrors>({});
  const [submitting, setSubmitting]         = useState<boolean>(false);
  const [createError, setCreateError]       = useState<string | null>(null);

  /* ── Verification In-Flight State ── */
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  /* ── Fetch Senders (source of truth from DB) ── */
  const fetchSenders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSenders();
      setSenders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sender accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSenders();
  }, [fetchSenders]);

  /* ── Reset Creation Form ── */
  function resetForm() {
    setEmail('');
    setSmtpHost('');
    setSmtpPort('587');
    setSmtpUser('');
    setSmtpPassword('');
    setFormErrors({});
    setCreateError(null);
    setShowCreateForm(false);
  }

  /* ── Client-side Validation ── */
  function validateForm(): boolean {
    const errors: FormErrors = {};

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      errors.email = 'Sender email address is required.';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        errors.email = 'Please enter a valid sender email address.';
      }
    }

    if (!smtpHost.trim()) {
      errors.smtpHost = 'SMTP host is required.';
    }

    const portNum = Number(smtpPort.trim());
    if (!smtpPort.trim() || isNaN(portNum) || portNum < 1 || portNum > 65535) {
      errors.smtpPort = 'Please enter a valid SMTP port (1–65535).';
    }

    if (!smtpUser.trim()) {
      errors.smtpUser = 'SMTP username is required.';
    }

    if (!smtpPassword) {
      errors.smtpPassword = 'SMTP password is required.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  /* ── Handle Sender Submission ── */
  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);

    if (submitting) return;

    const isValid = validateForm();
    if (!isValid) return;

    setSubmitting(true);

    try {
      await createSender({
        email: email.trim(),
        smtpHost: smtpHost.trim(),
        smtpPort: Number(smtpPort.trim()),
        smtpUser: smtpUser.trim(),
        smtpPassword,
      });

      // Clear password and form state immediately upon success
      resetForm();

      // Refresh sender list from server (source of truth)
      await fetchSenders();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 409) {
          setCreateError('A sender with this email address already exists.');
        } else {
          setCreateError(err.message);
        }
      } else {
        setCreateError('Failed to create sender. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Handle SMTP Verification ── */
  async function handleVerify(senderId: string) {
    if (verifyingId) return; // Prevent duplicate concurrent verification

    setVerifyingId(senderId);

    try {
      await verifySender(senderId);
    } catch {
      // Backend automatically updates DB state to FAILED on verification error
    } finally {
      // Refresh persisted state from server
      await fetchSenders();
      setVerifyingId(null);
    }
  }

  return (
    <DashboardLayout activeNav="senders">
      <div className="senders-content">

        {/* ── Page Header ── */}
        <div className="senders-header">
          <div className="senders-header-text">
            <h1 className="senders-title">Senders</h1>
            <p className="senders-description">
              Manage email sender accounts used for scheduling campaigns.
            </p>
          </div>

          {!showCreateForm && (
            <button
              type="button"
              className="btn-add-sender"
              onClick={() => setShowCreateForm(true)}
              aria-label="Add Sender"
            >
              <PlusIcon />
              Add Sender
            </button>
          )}
        </div>

        {/* ── Sender Creation Card (shown when showCreateForm is true) ── */}
        {showCreateForm && (
          <div className="sender-create-card">
            <h2 className="sender-create-title">Add New Sender</h2>

            {createError && (
              <div className="sender-create-error-banner" role="alert">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} noValidate>
              <div className="sender-form-grid">

                {/* Sender Email */}
                <div className="sender-form-group full-width">
                  <label className="sender-form-label" htmlFor="sender-email">
                    Sender Email
                  </label>
                  <input
                    id="sender-email"
                    className={`sender-form-input${formErrors.email ? ' invalid' : ''}`}
                    type="email"
                    placeholder="e.g. sender@example.com"
                    value={email}
                    onChange={e => {
                      setEmail(e.target.value);
                      if (formErrors.email) setFormErrors(prev => ({ ...prev, email: undefined }));
                    }}
                    disabled={submitting}
                    aria-invalid={!!formErrors.email}
                  />
                  {formErrors.email && (
                    <span className="sender-form-error">{formErrors.email}</span>
                  )}
                </div>

                {/* SMTP Host */}
                <div className="sender-form-group">
                  <label className="sender-form-label" htmlFor="sender-smtp-host">
                    SMTP Host
                  </label>
                  <input
                    id="sender-smtp-host"
                    className={`sender-form-input${formErrors.smtpHost ? ' invalid' : ''}`}
                    type="text"
                    placeholder="e.g. smtp.ethereal.email"
                    value={smtpHost}
                    onChange={e => {
                      setSmtpHost(e.target.value);
                      if (formErrors.smtpHost) setFormErrors(prev => ({ ...prev, smtpHost: undefined }));
                    }}
                    disabled={submitting}
                    aria-invalid={!!formErrors.smtpHost}
                  />
                  {formErrors.smtpHost && (
                    <span className="sender-form-error">{formErrors.smtpHost}</span>
                  )}
                </div>

                {/* SMTP Port */}
                <div className="sender-form-group">
                  <label className="sender-form-label" htmlFor="sender-smtp-port">
                    SMTP Port
                  </label>
                  <input
                    id="sender-smtp-port"
                    className={`sender-form-input${formErrors.smtpPort ? ' invalid' : ''}`}
                    type="number"
                    placeholder="587"
                    min="1"
                    max="65535"
                    value={smtpPort}
                    onChange={e => {
                      setSmtpPort(e.target.value);
                      if (formErrors.smtpPort) setFormErrors(prev => ({ ...prev, smtpPort: undefined }));
                    }}
                    disabled={submitting}
                    aria-invalid={!!formErrors.smtpPort}
                  />
                  {formErrors.smtpPort && (
                    <span className="sender-form-error">{formErrors.smtpPort}</span>
                  )}
                </div>

                {/* SMTP Username */}
                <div className="sender-form-group">
                  <label className="sender-form-label" htmlFor="sender-smtp-user">
                    SMTP Username
                  </label>
                  <input
                    id="sender-smtp-user"
                    className={`sender-form-input${formErrors.smtpUser ? ' invalid' : ''}`}
                    type="text"
                    placeholder="SMTP username or email"
                    value={smtpUser}
                    onChange={e => {
                      setSmtpUser(e.target.value);
                      if (formErrors.smtpUser) setFormErrors(prev => ({ ...prev, smtpUser: undefined }));
                    }}
                    disabled={submitting}
                    aria-invalid={!!formErrors.smtpUser}
                  />
                  {formErrors.smtpUser && (
                    <span className="sender-form-error">{formErrors.smtpUser}</span>
                  )}
                </div>

                {/* SMTP Password */}
                <div className="sender-form-group">
                  <label className="sender-form-label" htmlFor="sender-smtp-password">
                    SMTP Password
                  </label>
                  <input
                    id="sender-smtp-password"
                    className={`sender-form-input${formErrors.smtpPassword ? ' invalid' : ''}`}
                    type="password"
                    placeholder="••••••••••••"
                    value={smtpPassword}
                    onChange={e => {
                      setSmtpPassword(e.target.value);
                      if (formErrors.smtpPassword) setFormErrors(prev => ({ ...prev, smtpPassword: undefined }));
                    }}
                    disabled={submitting}
                    aria-invalid={!!formErrors.smtpPassword}
                  />
                  {formErrors.smtpPassword && (
                    <span className="sender-form-error">{formErrors.smtpPassword}</span>
                  )}
                </div>

              </div>

              {/* Action Buttons */}
              <div className="sender-form-actions">
                <button
                  type="button"
                  className="btn-create-cancel"
                  onClick={resetForm}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-create-submit"
                  disabled={submitting}
                  aria-label={submitting ? 'Creating…' : 'Create Sender'}
                >
                  {submitting ? 'Creating…' : 'Create Sender'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Senders Card ── */}
        <div className="senders-card">
          {loading && (
            <div className="senders-status">Loading senders...</div>
          )}

          {!loading && error && (
            <div className="senders-error">{error}</div>
          )}

          {!loading && !error && senders.length === 0 && (
            <div className="senders-empty">No configured senders found.</div>
          )}

          {!loading && !error && senders.length > 0 && (
            <div className="senders-list">
              {senders.map(sender => {
                const isVerifying = verifyingId === sender.id;

                return (
                  <div key={sender.id} className="sender-row">
                    <div className="sender-info">
                      <span className="sender-email">{sender.email}</span>
                      <span className="sender-meta">
                        Added on{' '}
                        {new Date(sender.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                        {sender.verificationStatus === 'VERIFIED' && sender.verifiedAt && (
                          <>
                            {' • '}Verified on{' '}
                            {new Date(sender.verifiedAt).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </>
                        )}
                      </span>
                    </div>

                    <div className="sender-actions">
                      {sender.verificationStatus === 'VERIFIED' && (
                        <span className="sender-badge verified">✓ SMTP verified</span>
                      )}

                      {sender.verificationStatus === 'FAILED' && (
                        <span className="sender-badge failed">✕ Verification failed</span>
                      )}

                      {sender.verificationStatus === 'PENDING' && (
                        <span className="sender-badge pending">○ Not verified</span>
                      )}

                      <button
                        type="button"
                        className="btn-verify-sender"
                        onClick={() => handleVerify(sender.id)}
                        disabled={isVerifying || verifyingId !== null}
                        aria-label={`Verify SMTP connection for ${sender.email}`}
                      >
                        {isVerifying ? 'Verifying…' : 'Verify'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}

/* ── Inline SVG Icon ──────────────────────────────────────────────────────── */

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
