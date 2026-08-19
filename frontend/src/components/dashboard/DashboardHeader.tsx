import './dashboard-header.css';

interface DashboardHeaderProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onFilter?: () => void;
  isFiltered?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

/**
 * DashboardHeader — search bar + filter/refresh icon buttons.
 *
 * Supports client-side search, onRefresh callback, isRefreshing state, onFilter callback, and isFiltered state.
 */
export default function DashboardHeader({
  onRefresh,
  isRefreshing,
  onFilter,
  isFiltered,
  searchQuery,
  onSearchChange,
}: DashboardHeaderProps) {
  return (
    <header className="dashboard-header">

      {/* Search */}
      <div className="header-search-wrapper">
        <SearchIcon className="header-search-icon" />
        <input
          className="header-search-input"
          type="search"
          placeholder="Search"
          aria-label="Search emails"
          value={searchQuery ?? ''}
          onChange={(e) => onSearchChange?.(e.target.value)}
        />
      </div>

      {/* Filter */}
      <button
        className={`header-icon-btn${isFiltered ? ' active' : ''}`}
        type="button"
        aria-label="Filter"
        onClick={onFilter}
        disabled={!onFilter}
      >
        <FilterIcon />
      </button>

      {/* Refresh */}
      <button
        className={`header-icon-btn${isRefreshing ? ' refreshing' : ''}`}
        type="button"
        aria-label="Refresh"
        onClick={onRefresh}
        disabled={!onRefresh || isRefreshing}
      >
        <RefreshIcon className={isRefreshing ? 'spin' : ''} />
      </button>

    </header>
  );
}

/* ── Inline SVG icons ─────────────────────────────────────── */

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="11" y1="18" x2="13" y2="18" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}
