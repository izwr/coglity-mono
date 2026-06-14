import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Tag } from '@coglity/shared';
import { insertTestSuiteSchema } from '@coglity/shared/schema';
import { testSuiteService, type TestSuiteWithTags } from '../services/testSuiteService';
import { tagService } from '../services/tagService';
import { ListToolbar, type AppliedFilters } from '../components/ListToolbar';
import { Button } from '../components/ui/Button';
import { Chip } from '../components/ui/Chip';
import { BarSparkline } from '../components/ui/Sparkline';
import { PageHead } from '../components/ui/PageHead';
import { useSetBreadcrumbs } from '../context/BreadcrumbsContext';
import { ProjectFilter, useSelectedProjectIds } from '../components/ProjectFilter';
import { ProjectPickerField, useWritableProjects } from '../components/ProjectPickerField';
import { useCurrentOrg } from '../context/OrgContext';
import { useTableState } from '../hooks/useTableState';
import { useQueryClient } from '@tanstack/react-query';
import { useTestSuitesPaginated } from '../queries/testSuites';
import { queryKeys } from '../lib/queryKeys';

const PAGE_SIZE = 12;

const SORT_OPTIONS = [
  { label: 'Newest first', field: 'createdAt', dir: 'desc' as const },
  { label: 'Oldest first', field: 'createdAt', dir: 'asc' as const },
  { label: 'Name A–Z', field: 'name', dir: 'asc' as const },
  { label: 'Name Z–A', field: 'name', dir: 'desc' as const },
  { label: 'Recently updated', field: 'updatedAt', dir: 'desc' as const },
];

// stable pseudo-data so cards have visual rhythm without real run metrics yet
function seed(id: string, n = 13, min = 70, max = 100) {
  const data: number[] = [];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  for (let i = 0; i < n; i++) {
    h = (h * 1664525 + 1013904223) >>> 0;
    const r = (h % 1000) / 1000;
    data.push(Math.round(min + r * (max - min)));
  }
  return data;
}

export function TestSuites() {
  useSetBreadcrumbs([{ label: 'Suites' }]);
  const { org } = useCurrentOrg();
  const projectIds = useSelectedProjectIds();
  const writable = useWritableProjects();
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formProjectId, setFormProjectId] = useState<string>('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { filters, setFilters, page, setPage } = useTableState({
    initialFilters: { sortBy: 'updatedAt', sortDir: 'desc' },
  });
  const orgId = org?.organizationId ?? '';
  const queryParams = {
    search: filters.search || undefined,
    tagId: filters.tagId || undefined,
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
    page,
    limit: PAGE_SIZE,
  };

  const { rows: suites, total, isLoading: loading } = useTestSuitesPaginated(orgId, projectIds, queryParams);
  const queryClient = useQueryClient();
  const invalidateSuites = () => queryClient.invalidateQueries({ queryKey: queryKeys.testSuites.all(orgId) });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isValid },
  } = useForm({
    resolver: zodResolver(insertTestSuiteSchema),
    mode: 'onChange',
    defaultValues: { name: '', description: '' },
  });

  useEffect(() => {
    if (!org) return;
    tagService
      .getAll(org.organizationId, projectIds)
      .then(setAllTags)
      .catch(() => setAllTags([]));
  }, [org, projectIds]);

  // Reset to page 1 when the project filter changes, otherwise a stale page (e.g. page 3)
  // is re-requested for a project set that may only have 1 page, stranding the user on an
  // empty result with the pagination bar gone.
  const projectIdsKey = projectIds.join(',');
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectIdsKey]);

  const handleApplyFilters = (applied: AppliedFilters) => {
    setFilters(applied);
  };

  const closeForm = () => {
    reset({ name: '', description: '' });
    setSelectedTagIds([]);
    setEditingId(null);
    setFormProjectId('');
    setShowForm(false);
  };

  const openCreate = () => {
    reset({ name: '', description: '' });
    setSelectedTagIds([]);
    setEditingId(null);
    setFormProjectId(writable[0]?.projectId ?? '');
    setShowForm(true);
  };

  const onSubmit = async (data: any) => {
    if (!org || !formProjectId) return;
    if (editingId) {
      await testSuiteService.update(org.organizationId, formProjectId, editingId, {
        ...data,
        tagIds: selectedTagIds,
      });
    } else {
      await testSuiteService.create(org.organizationId, formProjectId, {
        ...data,
        tagIds: selectedTagIds,
      });
    }
    closeForm();
    invalidateSuites();
  };

  const startEdit = (suite: TestSuiteWithTags) => {
    reset({ name: suite.name, description: suite.description });
    setSelectedTagIds((suite.tags ?? []).map((t) => t.id));
    setEditingId(suite.id);
    setFormProjectId(suite.projectId);
    setShowForm(true);
  };

  const handleDelete = async (suite: TestSuiteWithTags) => {
    if (!org) return;
    await testSuiteService.remove(org.organizationId, suite.projectId, suite.id);
    setDeleteConfirmId(null);
    invalidateSuites();
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((i) => i !== tagId) : [...prev, tagId],
    );
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = !!(filters.search || filters.tagId);

  return (
    <div className="page wide">
      <PageHead
        title={
          <>
            <em className="italic-teal">Suites</em>
          </>
        }
        subtitle={<>Organised collections of cases you run together against a bot.</>}
        actions={
          !showForm && (
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
              New suite
            </Button>
          )
        }
      />

      <div style={{ marginBottom: 16 }}>
        <ProjectFilter placeholder="Filter by project pick one or more…" />
      </div>

      {showForm && (
        <form className="ts-form" onSubmit={handleSubmit(onSubmit)}>
          <div className="ts-form-title">{editingId ? 'Edit suite' : 'New suite'}</div>
          <div className="ts-form-field">
            <label htmlFor="ts-project">Project</label>
            <ProjectPickerField
              id="ts-project"
              value={formProjectId}
              onChange={setFormProjectId}
              disabled={!!editingId}
              required
            />
          </div>
          <div className="ts-form-field">
            <label htmlFor="ts-name">Name</label>
            <input
              id="ts-name"
              type="text"
              placeholder="e.g., Billing regression"
              autoFocus
              {...register('name')}
            />
            {errors.name?.message && <span className="ts-form-error">{String(errors.name.message)}</span>}
          </div>
          <div className="ts-form-field">
            <label htmlFor="ts-desc">Description</label>
            <textarea
              id="ts-desc"
              placeholder="What's this suite for?"
              rows={3}
              {...register('description')}
            />
            {errors.description?.message && <span className="ts-form-error">{String(errors.description.message)}</span>}
          </div>
          <div className="ts-form-field">
            <label>Tags</label>
            {allTags.length === 0 ? (
              <p className="ts-form-hint">No tags available. Create tags first.</p>
            ) : (
              <div className="tag-picker">
                {allTags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    className={`chip-btn${selectedTagIds.includes(tag.id) ? ' selected' : ''}`}
                    onClick={() => toggleTag(tag.id)}
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
              {editingId ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      )}

      {projectIds.length === 0 ? (
        <div className="empty">
          <div className="title">
            Pick a <em className="italic-teal">project</em> to see suites.
          </div>
          <div className="sub">Use the filter above to select one or more projects.</div>
        </div>
      ) : loading && !suites.length ? (
        <p className="ts-empty">Loading…</p>
      ) : total === 0 && !hasFilters && !showForm ? (
        <div className="empty">
          <div className="title">
            No suites <em className="italic-teal">yet</em>.
          </div>
          <div className="sub">
            Group related cases into a suite to run them against a target bot on demand or on
            schedule.
          </div>
          <Button variant="primary" disabled={writable.length === 0} onClick={openCreate}>
            New suite
          </Button>
        </div>
      ) : (
        <>
          <ListToolbar
            searchPlaceholder="Search suites…"
            tags={allTags}
            sortOptions={SORT_OPTIONS}
            onApply={handleApplyFilters}
          />

          {loading ? (
            <p className="ts-empty">Loading…</p>
          ) : suites.length === 0 ? (
            <p className="ts-empty">No suites match your filters.</p>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                gap: 16,
              }}
            >
              {suites.map((suite) => {
                const bars = seed(suite.id, 13, 70, 100);
                const lastPass = bars[bars.length - 1];
                const chipVariant = lastPass >= 95 ? 'pass' : lastPass >= 85 ? 'warn' : 'fail';

                return (
                  <div
                    key={suite.id}
                    className="card hover"
                    style={{ padding: 22, cursor: 'pointer' }}
                    onClick={() => startEdit(suite)}
                  >
                    <div className="row" style={{ marginBottom: 6 }}>
                      <div
                        style={{
                          fontFamily: 'var(--serif)',
                          fontSize: 22,
                          letterSpacing: '-0.01em',
                          color: 'var(--ink)',
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {suite.name}
                      </div>
                      <Chip variant={chipVariant} dot style={{ marginLeft: 'auto' }}>
                        {lastPass}%
                      </Chip>
                    </div>
                    {suite.description && (
                      <p
                        style={{
                          fontSize: 13.5,
                          color: 'var(--muted)',
                          lineHeight: 1.55,
                          marginBottom: 14,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {suite.description}
                      </p>
                    )}
                    <BarSparkline data={bars} />

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 8,
                        marginTop: 14,
                        padding: '12px 0',
                        borderTop: '1px solid var(--line)',
                      }}
                    >
                      <div>
                        <div className="section-label" style={{ fontSize: 10.5 }}>
                          cases
                        </div>
                        <div className="mono" style={{ fontSize: 13, color: 'var(--ink)' }}>
                          {bars.length * 3}
                        </div>
                      </div>
                      <div>
                        <div className="section-label" style={{ fontSize: 10.5 }}>
                          last 13 runs
                        </div>
                        <div className="mono" style={{ fontSize: 13, color: 'var(--ink)' }}>
                          {Math.round(bars.reduce((a, b) => a + b, 0) / bars.length)}%
                        </div>
                      </div>
                      <div>
                        <div className="section-label" style={{ fontSize: 10.5 }}>
                          env
                        </div>
                        <div className="mono" style={{ fontSize: 13, color: 'var(--ink)' }}>
                          staging
                        </div>
                      </div>
                    </div>

                    {(suite.tags?.length ?? 0) > 0 && (
                      <div className="row" style={{ flexWrap: 'wrap', gap: 4, marginTop: 10 }}>
                        {(suite.tags ?? []).slice(0, 4).map((t) => (
                          <span key={t.id} className="tag-badge">
                            {t.name}
                          </span>
                        ))}
                      </div>
                    )}

                    <div
                      className="row"
                      style={{ marginTop: 14, gap: 6 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button size="sm" onClick={() => startEdit(suite)}>
                        Edit
                      </Button>
                      {deleteConfirmId === suite.id ? (
                        <div className="row" style={{ gap: 4, marginLeft: 'auto' }}>
                          <Button variant="danger" size="sm" onClick={() => handleDelete(suite)}>
                            Delete
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteConfirmId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirmId(suite.id)}
                          style={{ marginLeft: 'auto', color: 'var(--red)' }}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="pagination-btn"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  className={`pagination-btn${p === page ? ' active' : ''}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ))}
              <button
                className="pagination-btn"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
              <span className="pagination-info">
                {total} result{total !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
