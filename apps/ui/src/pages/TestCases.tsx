import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { insertTestCaseSchema } from '@coglity/shared/schema';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import type { Tag } from '@coglity/shared';
import { testCaseService, type TestCaseListRow } from '../services/testCaseService';
import { testSuiteService, type TestSuiteWithTags } from '../services/testSuiteService';
import { tagService } from '../services/tagService';
import { botConnectionService, type BotConnectionWithUser } from '../services/botConnectionService';
import { Button } from '../components/ui/Button';
import { Chip } from '../components/ui/Chip';
import { Select } from '../components/ui/Select';
import { DataTable } from '../components/data/DataTable';
import { DensityToggle } from '../components/ui/DensityToggle';
import { useSetBreadcrumbs } from '../context/BreadcrumbsContext';
import { ProjectFilter, useSelectedProjectIds } from '../components/ProjectFilter';
import { ProjectPickerField, useWritableProjects } from '../components/ProjectPickerField';
import { useCurrentOrg } from '../context/OrgContext';
import { useTestCasesInfinite, type TestCaseFilters } from '../queries/testCases';
import { queryKeys } from '../lib/queryKeys';
import { formatCount, formatRelative } from '../lib/format';
import { useLocalStorage } from '../hooks/useLocalStorage';

import { TEST_CASE_TYPES } from '@coglity/shared';
import {
  TEST_CASE_TYPE_CHIP_VARIANT,
  TEST_CASES_VIEWS_KEY,
  TEST_CASES_COLS_KEY,
  TEST_CASES_OPTIONAL_COLUMNS,
} from '../lib/constants/testCase.constants';

type QuickView = 'all' | 'active' | 'draft';

interface SavedView {
  name: string;
  filters: { search: string; suiteId: string; testCaseType: string; status: string };
}


export function TestCases() {
  useSetBreadcrumbs([{ label: 'Test cases' }]);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { org } = useCurrentOrg();
  const orgId = org?.organizationId ?? '';
  const selectedProjectIds = useSelectedProjectIds();
  // No selection means "all projects I can read" — the backend scopes to
  // readable projects regardless.
  const projectIds = useMemo(
    () =>
      selectedProjectIds.length > 0
        ? selectedProjectIds
        : (org?.projects ?? []).map((p) => p.projectId),
    [selectedProjectIds, org?.projects],
  );
  const writable = useWritableProjects();

  // ── Filters (server-driven) ──
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [suiteId, setSuiteId] = useState('');
  const [testCaseType, setTestCaseType] = useState('');
  const [quickView, setQuickView] = useState<QuickView>('all');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'updatedAt', desc: true }]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [savedViews, setSavedViews] = useLocalStorage<SavedView[]>(TEST_CASES_VIEWS_KEY, []);
  const [visibleCols, setVisibleCols] = useLocalStorage<string[]>(
    TEST_CASES_COLS_KEY,
    TEST_CASES_OPTIONAL_COLUMNS.map((c) => c.id),
  );
  const [colPopOpen, setColPopOpen] = useState(false);
  const colPopRef = useRef<HTMLDivElement>(null);

  // Debounced filter-as-you-type
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (!colPopOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!colPopRef.current?.contains(e.target as Node)) setColPopOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [colPopOpen]);

  const sort = sorting[0] ?? { id: 'updatedAt', desc: true };
  const sortBy = (['createdAt', 'updatedAt', 'title'].includes(sort.id) ? sort.id : 'updatedAt') as
    | 'createdAt'
    | 'updatedAt'
    | 'title';

  const filters: TestCaseFilters = {
    ...(search ? { search } : {}),
    ...(suiteId ? { testSuiteId: suiteId } : {}),
    ...(testCaseType ? { testCaseType } : {}),
    ...(quickView !== 'all' ? { status: quickView } : {}),
    sortBy,
    sortDir: sort.desc ? 'desc' : 'asc',
    limit: 60,
  };

  const cases = useTestCasesInfinite(orgId, projectIds, filters);

  // ── Form metadata (suites, tags, bots) ──
  const [showForm, setShowForm] = useState(false);
  const [formProjectId, setFormProjectId] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const allTags = useQuery({
    queryKey: queryKeys.tags.list(orgId, { projectIds }),
    queryFn: () => tagService.getAll(orgId, projectIds),
    enabled: Boolean(orgId) && projectIds.length > 0,
  });
  const writableIdsKey = writable.map((p) => p.projectId).join(',');
  const allSuites = useQuery({
    queryKey: ['orgs', orgId, 'test-suites', 'picker', writableIdsKey],
    queryFn: () =>
      testSuiteService
        .getAll(orgId, writableIdsKey.split(','), { limit: 100, page: 1 })
        .then((r) => r.data),
    enabled: Boolean(orgId) && writableIdsKey.length > 0,
  });
  const allBots = useQuery({
    queryKey: ['orgs', orgId, 'bot-connections', 'picker', writableIdsKey],
    queryFn: () =>
      botConnectionService
        .getAll(orgId, writableIdsKey.split(','), { limit: 100, page: 1 })
        .then((r) => r.data),
    enabled: Boolean(orgId) && writableIdsKey.length > 0,
  });

  const suitesForFilter: TestSuiteWithTags[] = (allSuites.data ?? []).filter(
    (s) => projectIds.length === 0 || projectIds.includes(s.projectId),
  );

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting, isValid },
  } = useForm({
    resolver: zodResolver(insertTestCaseSchema),
    mode: 'onChange',
    defaultValues: { title: '', testSuiteId: '', testCaseType: 'web', botConnectionId: '' },
  });

  const selectedType = watch('testCaseType');
  const showBotConnectionPicker = selectedType === 'chat' || selectedType === 'voice';
  const filteredBotConnections: BotConnectionWithUser[] = (allBots.data ?? []).filter(
    (bc) => bc.botType === selectedType && bc.projectId === formProjectId,
  );

  const invalidateCases = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.testCases.all(orgId) });

  const closeForm = () => {
    reset({ title: '', testSuiteId: '', testCaseType: 'web', botConnectionId: '' });
    setSelectedTagIds([]);
    setFormProjectId('');
    setShowForm(false);
  };

  const openCreate = () => {
    reset({ title: '', testSuiteId: '', testCaseType: 'web', botConnectionId: '' });
    setSelectedTagIds([]);
    setFormProjectId(writable[0]?.projectId ?? '');
    setShowForm(true);
  };

  const onSubmit = async (data: any) => {
    if (!org || !formProjectId) return;
    const created = await testCaseService.create(orgId, formProjectId, {
      title: data.title,
      testSuiteId: data.testSuiteId,
      preCondition: '',
      testSteps: '',
      data: '',
      expectedResults: '',
      tagIds: selectedTagIds,
      testCaseType: data.testCaseType as 'web' | 'mobile' | 'chat' | 'voice' | 'agent',
      botConnectionId: data.botConnectionId || null,
    });
    closeForm();
    invalidateCases();
    navigate(`/test-cases/${formProjectId}/${created.id}`);
  };

  const deleteRows = async (rows: TestCaseListRow[]) => {
    if (!org || rows.length === 0) return;
    const label = rows.length === 1 ? `"${rows[0].title}"` : `${rows.length} test cases`;
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
    for (const row of rows) {
      await testCaseService.remove(orgId, row.projectId, row.id);
    }
    setSelectedIds(new Set());
    invalidateCases();
  };

  const saveCurrentView = () => {
    const name = window.prompt('Name this view:');
    if (!name) return;
    const next = [
      ...savedViews.filter((v) => v.name !== name),
      { name, filters: { search, suiteId, testCaseType, status: quickView === 'all' ? '' : quickView } },
    ].slice(0, 8);
    setSavedViews(next);
  };

  const applyView = (view: SavedView) => {
    setSearchInput(view.filters.search);
    setSearch(view.filters.search);
    setSuiteId(view.filters.suiteId);
    setTestCaseType(view.filters.testCaseType);
    setQuickView((view.filters.status as QuickView) || 'all');
  };

  const removeView = (name: string) => {
    const next = savedViews.filter((v) => v.name !== name);
    setSavedViews(next);
  };

  const toggleCol = (id: string) => {
    const next = visibleCols.includes(id)
      ? visibleCols.filter((c) => c !== id)
      : [...visibleCols, id];
    setVisibleCols(next);
  };

  const hasCustomFilters = Boolean(search || suiteId || testCaseType);

  // ── Columns ──
  const columns = useMemo<ColumnDef<TestCaseListRow, unknown>[]>(() => {
    const cols: ColumnDef<TestCaseListRow, unknown>[] = [
      {
        id: 'title',
        header: 'Title',
        size: 280,
        meta: { flex: true },
        cell: ({ row }) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span
              style={{
                fontWeight: 500,
                color: 'var(--ink)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {row.original.title}
            </span>
            <span className="row-actions" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/test-cases/${row.original.projectId}/${row.original.id}`)}
              >
                Open
              </Button>
              <Button variant="ghost" size="sm" onClick={() => deleteRows([row.original])}>
                Delete
              </Button>
            </span>
          </div>
        ),
      },
    ];
    if (visibleCols.includes('type'))
      cols.push({
        id: 'type',
        header: 'Type',
        size: 86,
        cell: ({ row }) => (
          <Chip variant={TEST_CASE_TYPE_CHIP_VARIANT[row.original.testCaseType] ?? 'neutral'} size="sm">
            {row.original.testCaseType}
          </Chip>
        ),
      });
    if (visibleCols.includes('suite'))
      cols.push({
        id: 'suite',
        header: 'Suite',
        size: 170,
        cell: ({ row }) => (
          <span className="muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {row.original.testSuiteName}
          </span>
        ),
      });
    if (visibleCols.includes('status'))
      cols.push({
        id: 'status',
        header: 'Status',
        size: 92,
        cell: ({ row }) =>
          row.original.status === 'active' ? (
            <Chip variant="pass" size="sm" dot>
              active
            </Chip>
          ) : (
            <Chip variant="warn" size="sm" dot>
              draft
            </Chip>
          ),
      });
    if (visibleCols.includes('updatedAt'))
      cols.push({
        id: 'updatedAt',
        header: 'Updated',
        size: 104,
        cell: ({ row }) => <span className="num">{formatRelative(row.original.updatedAt)}</span>,
      });
    if (visibleCols.includes('createdByName'))
      cols.push({
        id: 'createdByName',
        header: 'Created by',
        size: 130,
        cell: ({ row }) => (
          <span className="muted" style={{ fontSize: 'var(--fs-meta)' }}>
            {row.original.createdByName ?? '—'}
          </span>
        ),
      });
    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleCols, orgId]);

  const selectedRows = cases.rows.filter((row) => selectedIds.has(row.id));
  const isLibraryEmpty =
    !cases.isLoading && cases.rows.length === 0 && !hasCustomFilters && quickView === 'all';

  return (
    <div className="page wide">
      <div className="page-head--console">
        <h1>
          Test case <em className="italic-teal">library</em>
          <span className="head-count">{formatCount(cases.totalCount)}</span>
        </h1>
        {!showForm && (
          <div className="row gap-lg">
            <Button variant="ghost" onClick={() => navigate('/test-cases/generate')}>
              <svg className="ico" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              Generate with AI
            </Button>
            <Button
              variant="primary"
              disabled={writable.length === 0}
              title={
                writable.length === 0
                  ? "You don't have write access to any project in this organization"
                  : undefined
              }
              onClick={openCreate}
            >
              <svg className="ico" viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New test case
            </Button>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        <ProjectFilter placeholder="Filter by project pick one or more…" />
      </div>

      {showForm && (
        <form className="ts-form" onSubmit={handleSubmit(onSubmit)}>
          <div className="ts-form-title">New test case</div>
          <div className="ts-form-field">
            <label htmlFor="tc-project">Project</label>
            <ProjectPickerField
              id="tc-project"
              value={formProjectId}
              onChange={(id) => {
                setFormProjectId(id);
                setValue('testSuiteId', '', { shouldValidate: true });
                setValue('botConnectionId', '', { shouldValidate: true });
              }}
              required
            />
          </div>
          <div className="ts-form-field">
            <label htmlFor="tc-title">Title</label>
            <input
              id="tc-title"
              type="text"
              placeholder="e.g., Billing · update payment method"
              autoFocus
              {...register('title')}
            />
            {errors.title?.message && <span className="ts-form-error">{String(errors.title.message)}</span>}
          </div>
          <div className="ts-form-field">
            <label htmlFor="tc-suite">Test suite</label>
            {(() => {
              const suites = (allSuites.data ?? []).filter(
                (s) => !formProjectId || s.projectId === formProjectId,
              );
              return suites.length === 0 ? (
                <p className="ts-form-hint">No test suites available. Create a suite first.</p>
              ) : (
                <Select
                  value={
                    watch('testSuiteId')
                      ? {
                          value: watch('testSuiteId'),
                          label: suites.find((s) => s.id === watch('testSuiteId'))?.name ?? '',
                        }
                      : null
                  }
                  onChange={(opt) =>
                    setValue('testSuiteId', opt?.value ?? '', { shouldValidate: true })
                  }
                  options={suites.map((suite) => ({ value: suite.id, label: suite.name }))}
                  placeholder="Select a test suite"
                />
              );
            })()}
            {errors.testSuiteId && (
              <span className="ts-form-error">{String(errors.testSuiteId.message)}</span>
            )}
          </div>
          <div className="ts-form-field">
            <label>Type</label>
            <div className="tag-picker">
              {TEST_CASE_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={`chip-btn${selectedType === t.value ? ' selected' : ''}`}
                  onClick={() => {
                    setValue('testCaseType', t.value as any, { shouldValidate: true });
                    if (t.value !== 'chat' && t.value !== 'voice') {
                      setValue('botConnectionId', '', { shouldValidate: true });
                    }
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          {showBotConnectionPicker && (
            <div className="ts-form-field">
              <label>Bot connection</label>
              {filteredBotConnections.length === 0 ? (
                <p className="ts-form-hint">
                  No {selectedType} bot connections available. Add one from Bot Connections.
                </p>
              ) : (
                <Select
                  value={
                    watch('botConnectionId')
                      ? {
                          value: (watch('botConnectionId') || '') as string,
                          label:
                            filteredBotConnections.find((bc) => bc.id === watch('botConnectionId'))
                              ?.name ?? '',
                        }
                      : null
                  }
                  onChange={(opt) =>
                    setValue('botConnectionId', opt?.value ?? '', { shouldValidate: true })
                  }
                  options={filteredBotConnections.map((bc) => ({
                    value: bc.id,
                    label: `${bc.name} (${bc.provider})`,
                  }))}
                  placeholder={`Select ${selectedType} bot connection`}
                />
              )}
            </div>
          )}
          <div className="ts-form-field">
            <label>Tags</label>
            {(allTags.data ?? []).length === 0 ? (
              <p className="ts-form-hint">No tags available. Create tags first.</p>
            ) : (
              <div className="tag-picker">
                {(allTags.data ?? []).map((tag: Tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    className={`chip-btn${selectedTagIds.includes(tag.id) ? ' selected' : ''}`}
                    onClick={() =>
                      setSelectedTagIds((prev) =>
                        prev.includes(tag.id)
                          ? prev.filter((i) => i !== tag.id)
                          : [...prev, tag.id],
                      )
                    }
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="ts-form-actions">
            <Button type="button" variant="ghost" onClick={closeForm}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!isValid || isSubmitting || !formProjectId}
            >
              Create
            </Button>
          </div>
        </form>
      )}

      {isLibraryEmpty && !showForm ? (
        <div className="empty">
          <div className="title">
            Your <em className="italic-teal">library</em> is empty.
          </div>
          <div className="sub">
            Author a test case by hand, or let Coglity draft some from a user story.
          </div>
          <div className="row">
            <Button variant="primary" onClick={openCreate}>
              New test case
            </Button>
            <Button variant="teal" onClick={() => navigate('/test-cases/generate')}>
              Generate with AI
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* ── Workbench toolbar ── */}
          <div
            className="dt-toolbar"
            style={{
              border: '1px solid var(--hairline-strong)',
              borderRadius: 10,
              background: 'var(--surface)',
              marginBottom: 10,
            }}
          >
            <div className="search" style={{ width: 260 }}>
              <svg className="ico" width="13" height="13" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3-3" />
              </svg>
              <input
                placeholder="Filter test cases…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <div className="tag-picker" style={{ gap: 4 }}>
              {(['all', 'active', 'draft'] as QuickView[]).map((view) => (
                <button
                  key={view}
                  type="button"
                  className={`chip-btn${quickView === view ? ' selected' : ''}`}
                  onClick={() => setQuickView(view)}
                >
                  {view === 'all' ? 'All' : view === 'active' ? 'Active' : 'Drafts'}
                </button>
              ))}
              {savedViews.map((view) => (
                <button
                  key={view.name}
                  type="button"
                  className="chip-btn"
                  onClick={() => applyView(view)}
                  title="Apply saved view (double-click to remove)"
                  onDoubleClick={() => removeView(view.name)}
                >
                  ★ {view.name}
                </button>
              ))}
              {hasCustomFilters && (
                <button type="button" className="chip-btn" onClick={saveCurrentView}>
                  + Save view
                </button>
              )}
            </div>
            <div className="spacer" />
            <div style={{ width: 170 }}>
              <Select
                compact
                isClearable
                value={
                  suiteId
                    ? {
                        value: suiteId,
                        label: suitesForFilter.find((s) => s.id === suiteId)?.name ?? 'Suite',
                      }
                    : null
                }
                onChange={(opt) => setSuiteId(opt?.value ?? '')}
                options={suitesForFilter.map((s) => ({ value: s.id, label: s.name }))}
                placeholder="Suite"
              />
            </div>
            <div style={{ width: 130 }}>
              <Select
                compact
                isClearable
                value={
                  testCaseType
                    ? {
                        value: testCaseType,
                        label:
                          TEST_CASE_TYPES.find((t) => t.value === testCaseType)?.label ?? 'Type',
                      }
                    : null
                }
                onChange={(opt) => setTestCaseType(opt?.value ?? '')}
                options={TEST_CASE_TYPES}
                placeholder="Type"
              />
            </div>
            <div style={{ position: 'relative' }} ref={colPopRef}>
              <Button variant="ghost" size="sm" onClick={() => setColPopOpen((v) => !v)}>
                Columns
              </Button>
              {colPopOpen && (
                <div className="col-pop">
                  {TEST_CASES_OPTIONAL_COLUMNS.map((col) => (
                    <label key={col.id}>
                      <input
                        type="checkbox"
                        checked={visibleCols.includes(col.id)}
                        onChange={() => toggleCol(col.id)}
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <DensityToggle />
          </div>

          <DataTable<TestCaseListRow>
            columns={columns}
            data={cases.rows}
            getRowId={(row) => row.id}
            totalCount={cases.totalCount}
            hasNextPage={cases.hasNextPage}
            isFetchingNextPage={cases.isFetchingNextPage}
            fetchNextPage={() => cases.fetchNextPage()}
            isLoading={cases.isLoading}
            sorting={sorting}
            onSortingChange={setSorting}
            sortableColumnIds={['title', 'updatedAt', 'createdAt']}
            onRowClick={(row) => navigate(`/test-cases/${row.projectId}/${row.id}`)}
            enableRowSelection
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            height="calc(100vh - 300px)"
            emptyState={
              <div className="empty--inline">
                <span className="microlabel">No matches</span>
                <div className="sub">
                  0 of {formatCount(cases.totalCount)} cases match these filters.
                </div>
                <div className="actions">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setSearchInput('');
                      setSuiteId('');
                      setTestCaseType('');
                      setQuickView('all');
                    }}
                  >
                    Clear filters
                  </Button>
                  {hasCustomFilters && (
                    <Button variant="ghost" size="sm" onClick={saveCurrentView}>
                      Save as view
                    </Button>
                  )}
                </div>
              </div>
            }
          />

          {selectedIds.size > 0 && (
            <div className="bulk-bar">
              <span className="count">{selectedIds.size} selected</span>
              <Button variant="danger" size="sm" onClick={() => deleteRows(selectedRows)}>
                Delete
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                Clear
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
