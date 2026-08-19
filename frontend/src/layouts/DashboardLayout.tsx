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
  /** Optional filter toggle callback provided by the active dashboard page */
  onFilter?: () => void;
  /** Optional indicator whether filtering is currently active */
  isFiltered?: boolean;
  /** Optional search query for filtering emails */
  searchQuery?: string;
  /** Optional search query change handler */
  onSearchChange?: (query: string) => void;
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
  onFilter,
  isFiltered,
  searchQuery,
  onSearchChange,
}: DashboardLayoutProps) {
  return (
    <div className="dashboard-layout">
      <Sidebar activeNav={activeNav} />

      <div className="dashboard-main">
        <DashboardHeader
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
          onFilter={onFilter}
          isFiltered={isFiltered}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
        />
        <div className="dashboard-content">
          {children}
        </div>
      </div>
    </div>
  );
}
