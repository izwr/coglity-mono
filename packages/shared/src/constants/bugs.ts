export const PRIORITY_LABELS: Record<string, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const SEVERITY_LABELS: Record<string, string> = {
  blocker: 'Blocker',
  critical: 'Critical',
  major: 'Major',
  minor: 'Minor',
  trivial: 'Trivial',
};

export const BUG_TYPE_LABELS: Record<string, string> = {
  functional: 'Functional',
  performance: 'Performance',
  security: 'Security',
  usability: 'Usability',
  compatibility: 'Compatibility',
  regression: 'Regression',
  other: 'Other',
};

export const BUG_STATE_LABELS: Record<string, string> = {
  new: 'New',
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
  reopened: 'Reopened',
};
