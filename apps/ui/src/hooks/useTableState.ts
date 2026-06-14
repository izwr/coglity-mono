import { useState, useCallback } from 'react';
import type { AppliedFilters } from '../components/ListToolbar';

export interface UseTableStateProps {
  initialFilters?: Partial<AppliedFilters>;
  initialPage?: number;
}

export function useTableState({
  initialFilters = {},
  initialPage = 1,
}: UseTableStateProps = {}) {
  const [filters, setFilters] = useState<AppliedFilters>({
    search: '',
    tagId: '',
    sortBy: 'createdAt',
    sortDir: 'desc',
    status: '',
    ...initialFilters,
  });
  const [page, setPage] = useState(initialPage);

  const handleApplyFilters = useCallback((applied: AppliedFilters) => {
    setFilters(applied);
    setPage(1); // Reset to first page on filter change
  }, []);

  return {
    filters,
    setFilters: handleApplyFilters,
    page,
    setPage,
  };
}
