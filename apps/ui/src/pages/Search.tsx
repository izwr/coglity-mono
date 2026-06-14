import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHead } from '../components/ui/PageHead';
import { Chip } from '../components/ui/Chip';
import { Tabs } from '../components/ui/Tabs';
import { useSetBreadcrumbs } from '../context/BreadcrumbsContext';
import { useEntitySearch } from '../hooks/useEntitySearch';

type Kind = 'all' | 'cases' | 'suites' | 'bugs';

export function Search() {
  useSetBreadcrumbs([{ label: 'Search' }]);
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<Kind>('all');
  const { cases, suites, bugs, loading } = useEntitySearch(q);

  const totalCount = cases.length + suites.length + bugs.length;
  const show = useMemo(
    () => ({
      cases: kind === 'all' || kind === 'cases',
      suites: kind === 'all' || kind === 'suites',
      bugs: kind === 'all' || kind === 'bugs',
    }),
    [kind],
  );

  return (
    <div className="page">
      <PageHead
        title={
          <>
            <em className="italic-teal">Search</em>
          </>
        }
        subtitle={
          q.length < 2
            ? 'Type to search cases, suites and bugs.'
            : `${totalCount} result${totalCount !== 1 ? 's' : ''} for "${q}"`
        }
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div className="search" style={{ flex: 1, maxWidth: 720 }}>
          <svg className="ico" width="14" height="14" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3-3" />
          </svg>
          <input
            autoFocus
            placeholder="Search cases, suites, bugs…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {loading && (
            <span className="mono muted-2" style={{ fontSize: 11 }}>
              loading…
            </span>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <Tabs
          variant="chip"
          value={kind}
          onChange={(v) => setKind(v as Kind)}
          options={[
            {
              value: 'all',
              label: 'All',
              count: totalCount,
              chipVariant: 'teal',
              dotColor: 'var(--teal)',
            },
            { value: 'cases', label: 'Cases', count: cases.length, chipVariant: 'info' },
            { value: 'suites', label: 'Suites', count: suites.length, chipVariant: 'agent' },
            { value: 'bugs', label: 'Bugs', count: bugs.length, chipVariant: 'fail' },
          ]}
        />
      </div>

      {q.length < 2 ? (
        <div className="empty">
          <div className="title">
            Find anything <em className="italic-teal">fast</em>.
          </div>
          <div className="sub">Matches test cases, suites and bugs across your workspace.</div>
        </div>
      ) : totalCount === 0 && !loading ? (
        <div className="empty">
          <div className="title">No matches</div>
          <div className="sub">Try a different term or check spelling.</div>
        </div>
      ) : (
        <div className="col gap-lg">
          {show.cases && cases.length > 0 && (
            <div className="card">
              <div className="card-head">
                <h3>
                  Cases{' '}
                  <span className="muted" style={{ fontSize: 13, marginLeft: 8 }}>
                    {cases.length}
                  </span>
                </h3>
              </div>
              <div>
                {cases.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => nav(`/test-cases/${c.projectId}/${c.id}`)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '12px 20px',
                      borderBottom: '1px solid var(--line)',
                      cursor: 'pointer',
                    }}
                  >
                    <div className="row" style={{ gap: 8, marginBottom: 3 }}>
                      <Chip variant={c.testCaseType as any}>{c.testCaseType}</Chip>
                      <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{c.title}</span>
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {c.testSuiteName}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {show.suites && suites.length > 0 && (
            <div className="card">
              <div className="card-head">
                <h3>
                  Suites{' '}
                  <span className="muted" style={{ fontSize: 13, marginLeft: 8 }}>
                    {suites.length}
                  </span>
                </h3>
              </div>
              <div>
                {suites.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => nav(`/test-suites`)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '12px 20px',
                      borderBottom: '1px solid var(--line)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ color: 'var(--ink)', fontWeight: 500, marginBottom: 3 }}>
                      {s.name}
                    </div>
                    {s.description && (
                      <div className="muted" style={{ fontSize: 12 }}>
                        {s.description}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
          {show.bugs && bugs.length > 0 && (
            <div className="card">
              <div className="card-head">
                <h3>
                  Bugs{' '}
                  <span className="muted" style={{ fontSize: 13, marginLeft: 8 }}>
                    {bugs.length}
                  </span>
                </h3>
              </div>
              <div>
                {bugs.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => nav(`/bugs/${b.projectId}/${b.id}`)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '12px 20px',
                      borderBottom: '1px solid var(--line)',
                      cursor: 'pointer',
                    }}
                  >
                    <div className="row" style={{ gap: 8, marginBottom: 3 }}>
                      <span className={`bug-badge priority-${b.priority}`}>{b.priority}</span>
                      <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{b.title}</span>
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      State: {b.state}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
