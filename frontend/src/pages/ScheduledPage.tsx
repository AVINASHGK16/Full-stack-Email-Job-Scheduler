import { useState, useEffect } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import EmailRow from '../components/dashboard/EmailRow';
import { getScheduledEmails } from '../services/api';
import type { ScheduledEmailItem } from '../types/campaign';

/**
 * ScheduledPage — /scheduled
 *
 * Displays the list of scheduled emails fetched from GET /campaigns/scheduled.
 * Shows loading, error, empty, and populated states using the existing EmailRow component.
 */
export default function ScheduledPage() {
  const [emails, setEmails] = useState<ScheduledEmailItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getScheduledEmails()
      .then(data => {
        if (!cancelled) {
          setEmails(data);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load scheduled emails');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DashboardLayout activeNav="scheduled">
      <div className="email-list">
        {loading && (
          <div className="email-list-status">Loading scheduled emails...</div>
        )}

        {!loading && error && (
          <div className="email-list-error">{error}</div>
        )}

        {!loading && !error && emails.length === 0 && (
          <div className="email-list-empty">No scheduled emails.</div>
        )}

        {!loading && !error && emails.map(item => (
          <EmailRow
            key={item.id}
            recipient={item.email}
            status="Scheduled"
            badgeType="scheduled"
            subject={item.subject}
            preview={item.bodyPreview}
          />
        ))}
      </div>
    </DashboardLayout>
  );
}
