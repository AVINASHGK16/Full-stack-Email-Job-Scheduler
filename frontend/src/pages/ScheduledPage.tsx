import { useState, useEffect, useCallback, useRef } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import EmailRow from '../components/dashboard/EmailRow';
import { getScheduledEmails } from '../services/api';
import type { ScheduledEmailItem } from '../types/campaign';

/**
 * ScheduledPage — /scheduled
 *
 * Displays the list of scheduled emails fetched from GET /campaigns/scheduled.
 * Supports initial load, manual header refresh, error, empty, and populated states.
 */
export default function ScheduledPage() {
  const [emails, setEmails] = useState<ScheduledEmailItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef<boolean>(true);

  const fetchEmails = useCallback(async (isManual = false) => {
    if (isManual) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const data = await getScheduledEmails();
      if (isMountedRef.current) {
        setEmails(data);
        setError(null);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load scheduled emails');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchEmails(false);

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchEmails]);

  const handleRefresh = useCallback(() => {
    if (refreshing || loading) return;
    fetchEmails(true);
  }, [fetchEmails, refreshing, loading]);

  return (
    <DashboardLayout
      activeNav="scheduled"
      onRefresh={handleRefresh}
      isRefreshing={refreshing}
    >
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
