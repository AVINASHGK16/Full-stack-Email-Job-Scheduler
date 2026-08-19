import './email-row.css';

export interface EmailRowProps {
  id: string;
  recipient: string;
  status: string;
  badgeType: 'scheduled' | 'sent';
  subject: string;
  preview: string;
  isStarred?: boolean;
  onToggleStar?: (id: string) => void;
}

/**
 * EmailRow — visual component for an individual email row in Scheduled & Sent lists.
 *
 * Supports star/bookmark toggle.
 */
export default function EmailRow({
  id,
  recipient,
  status,
  badgeType,
  subject,
  preview,
  isStarred = false,
  onToggleStar,
}: EmailRowProps) {
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
