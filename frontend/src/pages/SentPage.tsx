import DashboardLayout from '../layouts/DashboardLayout';
import EmailRow from '../components/dashboard/EmailRow';

/**
 * SentPage — /sent
 *
 * Displays the Sent emails list inside the Dashboard shell.
 * Uses static representative placeholder data for Phase 9.3.
 */
export default function SentPage() {
  return (
    <DashboardLayout activeNav="sent">
      <div className="email-list-container">
        <EmailRow
          recipient="Sarah Connor"
          status="Sent"
          subject="Project updates & deliverables"
          preview="Here is the weekly update report as discussed..."
          avatarInitials="SC"
        />
        <EmailRow
          recipient="Michael Scott"
          status="Sent"
          subject="Q3 Review and Quarterly Planning"
          preview="Please find the attached spreadsheet for our review..."
          avatarInitials="MS"
        />
      </div>
    </DashboardLayout>
  );
}
