import './email-row.css';

export interface EmailRowProps {
  id: string;
  recipient: string;
  status: string;
  badgeType: 'scheduled' | 'sent';
  subject: string;
  preview: string;
  scheduledAt?: string | null;
  isStarred?: boolean;
  onToggleStar?: (id: string) => void;
}

/**
 * Format timestamp in user's browser timezone (e.g. "Aug 19, 2026, 3:30 PM").
 */
function formatScheduledTime(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return null;
  }
}

/**
 * EmailRow — visual component for an individual email row in Scheduled & Sent lists.
 *
 * Supports star/bookmark toggle and displays scheduled execution date/time for scheduled emails.
 */
export default function EmailRow({
  id,
  recipient,
  status,
  badgeType,
  subject,
  preview,
  scheduledAt,
  isStarred = false,
  onToggleStar,
}: EmailRowProps) {
  const formattedScheduledTime = badgeType === 'scheduled' ? formatScheduledTime(scheduledAt) : null;

  return (
    <div className="email-row">
      <div className="email-row-main-info">
        <span className="email-row-recipient">To: {recipient}</span>
        <span className={`email-row-badge ${badgeType}`}>{status}</span>
      </div>

      <div className="email-row-message">
        <span className="email-row-subject">{subject}</span>
        <span className="email-row-separator">—</span>
        <span className="email-row-preview">{preview}</span>
      </div>

      {formattedScheduledTime && (
        <div className="email-row-time" title={`Scheduled for ${formattedScheduledTime}`}>
          <ClockIcon />
          <span>{formattedScheduledTime}</span>
        </div>
      )}

      <button
        type="button"
        className={`email-row-star${isStarred ? ' active' : ''}`}
        aria-label={isStarred ? 'Unstar email' : 'Star email'}
        aria-pressed={isStarred}
        onClick={(e) => {
          e.stopPropagation();
          onToggleStar?.(id);
        }}
      >
        <StarIcon filled={isStarred} />
      </button>
    </div>
  );
}

function StarIcon({ filled }: { filled?: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={filled ? '#f59e0b' : 'none'}
      stroke={filled ? '#f59e0b' : 'currentColor'}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
