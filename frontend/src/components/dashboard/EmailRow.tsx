import './email-row.css';

export interface EmailRowProps {
  recipient: string;
  status: string;
  badgeType: 'scheduled' | 'sent';
  subject: string;
  preview: string;
}

/**
 * EmailRow — visual component for an individual email row in Scheduled & Sent lists.
 *
 * Used for static placeholder rendering in Phase 9.4.
 */
export default function EmailRow({
  recipient,
  status,
  badgeType,
  subject,
  preview,
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
        className="email-row-star"
        aria-label="Star email"
        disabled
      >
        <StarIcon />
      </button>
    </div>
  );
}

function StarIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
