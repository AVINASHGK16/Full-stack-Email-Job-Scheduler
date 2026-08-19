import type { ReactNode } from 'react';
import Sidebar from '../components/dashboard/Sidebar';
import DashboardHeader from '../components/dashboard/DashboardHeader';
import './dashboard-layout.css';

interface DashboardLayoutProps {
  children: ReactNode;
  /** Which nav item is currently active: 'scheduled' | 'sent' | 'compose' | 'senders' */
  activeNav: 'scheduled' | 'sent' | 'compose' | 'senders';
  /** Optional refresh callback provided by the active dashboard page */
  onRefresh?: () => void;
  /** Optional indicator whether the active page is currently refreshing */
  isRefreshing?: boolean;
}

/**
 * DashboardLayout — shared shell for Scheduled, Sent, Compose, and Senders pages.
 *
 * Renders the sidebar + header and places page content in the
 * scrollable main area.
 */
export default function DashboardLayout({
  children,
  activeNav,
  onRefresh,
  isRefreshing,
}: DashboardLayoutProps) {
  return (
    <div className="dashboard-layout">
      <Sidebar activeNav={activeNav} />

      <div className="dashboard-main">
        <DashboardHeader onRefresh={onRefresh} isRefreshing={isRefreshing} />
        <div className="dashboard-content">
          {children}
        </div>
      </div>
    </div>
  );
}
