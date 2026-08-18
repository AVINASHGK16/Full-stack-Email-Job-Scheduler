import DashboardLayout from '../layouts/DashboardLayout';
import EmailRow from '../components/dashboard/EmailRow';

/**
 * SentPage — /sent
 *
 * Displays the Sent emails list inside the Dashboard shell.
 * Uses static representative placeholder data for Phase 9.4.
 */
export default function SentPage() {
  return (
    <DashboardLayout activeNav="sent">
      <div className="email-list">
        <EmailRow
          recipient="Sarah Wilson"
          status="Sent"
          badgeType="sent"
          subject="Re: Project Update"
          preview="Thanks for the update, Sarah. Looks good!"
        />
        <EmailRow
          recipient="Support"
          status="Sent"
          badgeType="sent"
          subject="Issue with login"
          preview="I am having trouble logging in to the dashboard..."
        />
      </div>
    </DashboardLayout>
  );
}
