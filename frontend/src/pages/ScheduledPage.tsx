import DashboardLayout from '../layouts/DashboardLayout';
import EmailRow from '../components/dashboard/EmailRow';

/**
 * ScheduledPage — /scheduled
 *
 * Displays the Scheduled emails list inside the Dashboard shell.
 * Uses static representative placeholder data for Phase 9.3.
 */
export default function ScheduledPage() {
  return (
    <DashboardLayout activeNav="scheduled">
      <div className="email-list-container">
        <EmailRow
          recipient="John Smith"
          status="Scheduled"
          subject="Meeting follow-up"
          preview="Just following up on our meeting yesterday..."
          avatarInitials="JS"
        />
        <EmailRow
          recipient="Olive"
          status="Scheduled"
          subject="Great to meet you"
          preview="Thanks for taking the time to connect..."
          avatarInitials="OL"
        />
      </div>
    </DashboardLayout>
  );
}
