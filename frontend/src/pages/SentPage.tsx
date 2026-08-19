import { useState, useEffect, useCallback, useRef } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import EmailRow from '../components/dashboard/EmailRow';
import { getSentEmails } from '../services/api';
import { useStarredEmails } from '../hooks/useStarredEmails';
import type { SentEmailItem } from '../types/campaign';

/**
 * SentPage — /sent
 *
 * Displays the list of sent emails fetched from GET /campaigns/sent.
 * Supports initial load, manual header refresh, search filtering, bookmarking, error, empty, and populated states.
 */
export default function SentPage() {
  const [emails, setEmails] = useState<SentEmailItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const { isStarred, toggleStar } = useStarredEmails();
  const isMountedRef = useRef<boolean>(true);

  const fetchEmails = useCallback(async (isManual = false) => {
    if (isManual) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const data = await getSentEmails();
      if (isMountedRef.current) {
        setEmails(data);
        setError(null);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load sent emails');
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

  // Client-side search matching recipient, subject, and preview
  const query = searchQuery.trim().toLowerCase();
  const filteredEmails = emails.filter(item => {
    if (!query) return true;
    return (
      (item.email || '').toLowerCase().includes(query) ||
      (item.subject || '').toLowerCase().includes(query) ||
      (item.bodyPreview || '').toLowerCase().includes(query)
    );
  });

  return (
    <DashboardLayout
      activeNav="sent"
      onRefresh={handleRefresh}
      isRefreshing={refreshing}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
    >
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

        {!loading && !error && emails.length > 0 && filteredEmails.length === 0 && (
          <div className="email-list-empty">No emails match your search.</div>
        )}

        {!loading && !error && filteredEmails.map(item => (
          <EmailRow
            key={item.id}
            id={item.id}
            recipient={item.email}
            status="Sent"
            badgeType="sent"
            subject={item.subject}
            preview={item.bodyPreview}
            isStarred={isStarred(item.id)}
            onToggleStar={toggleStar}
          />
        ))}
      </div>
    </DashboardLayout>
  );
}
