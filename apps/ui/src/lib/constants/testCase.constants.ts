import type { ChipVariant } from '../../components/ui/Chip';

export const TEST_CASE_TYPE_CHIP_VARIANT: Record<string, ChipVariant> = {
  web: 'web',
  mobile: 'mobile',
  chat: 'chat',
  voice: 'voice',
  agent: 'agent',
};

export const TEST_CASES_VIEWS_KEY = 'coglity-views:testcases';
export const TEST_CASES_COLS_KEY = 'coglity-cols:testcases';

export const TEST_CASES_OPTIONAL_COLUMNS = [
  { id: 'type', label: 'Type' },
  { id: 'suite', label: 'Suite' },
  { id: 'status', label: 'Status' },
  { id: 'updatedAt', label: 'Updated' },
  { id: 'createdByName', label: 'Created by' },
];
