import { useState, useCallback } from 'react';

const STORAGE_KEY = 'emailSchedulerStarredIds';

/**
 * Reads safely from localStorage. Returns empty Set if unavailable or invalid JSON.
 */
function getInitialStarredIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return new Set();
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((id): id is string => typeof id === 'string'));
    }
    return new Set();
  } catch {
    return new Set();
  }
}

/**
 * useStarredEmails — lightweight client-side bookmark hook with localStorage persistence.
 */
export function useStarredEmails() {
  const [starredSet, setStarredSet] = useState<Set<string>>(getInitialStarredIds);

  const toggleStar = useCallback((id: string) => {
    setStarredSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch {
        // Fail safely if localStorage is unavailable
      }
      return next;
    });
  }, []);

  const isStarred = useCallback((id: string) => starredSet.has(id), [starredSet]);

  return { isStarred, toggleStar };
}
