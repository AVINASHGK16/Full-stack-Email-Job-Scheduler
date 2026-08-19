import { useState, useEffect } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import EmailRow from '../components/dashboard/EmailRow';
import { getSentEmails } from '../services/api';
import type { SentEmailItem } from '../types/campaign';

/**
 * SentPage — /sent
 *
 * Displays the list of sent emails fetched from GET /campaigns/sent.
 * Shows loading, error, empty, and populated states using the existing EmailRow component.
 */
export default function SentPage() {
  const [emails, setEmails] = useState<SentEmailItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getSentEmails()
      .then(data => {
        if (!cancelled) {
          setEmails(data);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load sent emails');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DashboardLayout activeNav="sent">
      <div className="email-list">
        {loading && (
          <div className="email-list-status">Loading sent emails...</div>
        )}

        {!loading && error && (
          <div className="email-list-error">{error}</div>
        )}

        {!loading && !error && emails.length === 0 && (
          <div className="email-list-empty">No sent emails.</div>
        )}

        {!loading && !error && emails.map(item => (
          <EmailRow
            key={item.id}
            recipient={item.email}
            status="Sent"
            badgeType="sent"
            subject={item.subject}
            preview={item.bodyPreview}
          />
        ))}
      </div>
    </DashboardLayout>
  );
}
