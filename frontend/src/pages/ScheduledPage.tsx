import DashboardLayout from '../layouts/DashboardLayout';
import EmailRow from '../components/dashboard/EmailRow';

/**
 * ScheduledPage — /scheduled
 *
 * Displays the Scheduled emails list inside the Dashboard shell.
 * Uses static representative placeholder data for Phase 9.4.
 */
export default function ScheduledPage() {
  return (
    <DashboardLayout activeNav="scheduled">
      <div className="email-list">
        <EmailRow
          recipient="John Smith"
          status="Scheduled"
          badgeType="scheduled"
          subject="Meeting follow-up"
          preview="Hi John, just wanted to follow up on our meeting..."
        />
        <EmailRow
          recipient="Olive"
          status="Scheduled"
          badgeType="scheduled"
          subject="Ramit, great to meet you - you'll love it"
          preview="Hi Olive, just wanted to follow up on our meeting..."
        />
      </div>
    </DashboardLayout>
  );
}
