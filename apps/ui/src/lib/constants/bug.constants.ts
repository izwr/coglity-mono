export const BUG_PAGE_SIZE = 10;

export const BUG_SORT_OPTIONS = [
  { label: 'Newest first', field: 'createdAt', dir: 'desc' as const },
  { label: 'Oldest first', field: 'createdAt', dir: 'asc' as const },
  { label: 'Title A-Z', field: 'title', dir: 'asc' as const },
  { label: 'Title Z-A', field: 'title', dir: 'desc' as const },
  { label: 'Recently updated', field: 'updatedAt', dir: 'desc' as const },
  { label: 'Priority', field: 'priority', dir: 'asc' as const },
  { label: 'Severity', field: 'severity', dir: 'asc' as const },
];

export const BUG_STATE_TOGGLE = {
  options: [
    { value: 'new', label: 'New', activeClass: 'state-new-selected' },
    { value: 'open', label: 'Open', activeClass: 'state-open-selected' },
    { value: 'in_progress', label: 'In Progress', activeClass: 'state-progress-selected' },
    { value: 'resolved', label: 'Resolved', activeClass: 'state-resolved-selected' },
    { value: 'closed', label: 'Closed', activeClass: 'state-closed-selected' },
  ],
};


