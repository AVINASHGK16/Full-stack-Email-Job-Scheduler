import type { ReactNode } from 'react';
import Sidebar from '../components/dashboard/Sidebar';
import DashboardHeader from '../components/dashboard/DashboardHeader';
import './dashboard-layout.css';

interface DashboardLayoutProps {
  children: ReactNode;
  /** Which nav item is currently active: 'scheduled' | 'sent' | 'compose' */
  activeNav: 'scheduled' | 'sent' | 'compose';
}

/**
 * DashboardLayout — shared shell for Scheduled, Sent, and Compose pages.
 *
 * Renders the sidebar + header and places page content in the
 * scrollable main area. Static placeholder data only in Phase 9.3.
 */
export default function DashboardLayout({ children, activeNav }: DashboardLayoutProps) {
  return (
    <div className="dashboard-layout">
      <Sidebar activeNav={activeNav} />

      <div className="dashboard-main">
        <DashboardHeader />
        <div className="dashboard-content">
          {children}
        </div>
      </div>
    </div>
  );
}
