import { useState, useEffect } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import { getSenders } from '../services/api';
import type { SenderItem } from '../types/sender';
import './senders.css';

/**
 * SendersPage — /senders
 *
 * Displays the authenticated user's configured email senders fetched from GET /senders.
 * Shows loading, empty, error, and populated states.
 * Includes a disabled "Add Sender" button indicating sender creation is not yet implemented.
 */
export default function SendersPage() {
  const [senders, setSenders] = useState<SenderItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getSenders()
      .then(data => {
        if (!cancelled) {
          setSenders(data);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load sender accounts');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

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

          <button
            type="button"
            className="btn-add-sender"
            disabled
            title="Sender creation is not yet implemented"
            aria-label="Add Sender (disabled)"
          >
            <PlusIcon />
            Add Sender
          </button>
        </div>

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
              {senders.map(sender => (
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
                    </span>
                  </div>
                  <span className="sender-badge">Active</span>
                </div>
              ))}
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
