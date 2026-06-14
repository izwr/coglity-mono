import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chip, type ChipVariant } from './ui/Chip';
import { useEntitySearch } from '../hooks/useEntitySearch';
import { useTheme } from '../theme/ThemeContext';
import { useDensity } from '../theme/DensityContext';

type Scope = 'all' | 'cases' | 'suites' | 'bugs';
const SCOPES: Scope[] = ['all', 'cases', 'suites', 'bugs'];

interface PaletteItem {
  id: string;
  group: string;
  title: string;
  sub?: string;
  chip?: { variant: ChipVariant; label: string };
  perform: () => void;
}

interface RecentEntry {
  type: 'case' | 'suite' | 'bug';
  id: string;
  projectId: string;
  title: string;
  sub?: string;
}

const RECENTS_KEY = 'coglity-recents';

function readRecents(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const parsed = raw ? (JSON.parse(raw) as RecentEntry[]) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 10) : [];
  } catch {
    return [];
  }
}

export function pushRecent(entry: RecentEntry) {
  const next = [entry, ...readRecents().filter((r) => !(r.type === entry.type && r.id === entry.id))];
  localStorage.setItem(RECENTS_KEY, JSON.stringify(next.slice(0, 10)));
}

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { toggle: toggleTheme } = useTheme();
  const { toggle: toggleDensity } = useDensity();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const [selected, setSelected] = useState(0);
  const { cases, suites, bugs, loading } = useEntitySearch(q, { limit: 8, debounceMs: 150 });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const go = (to: string) => {
    onClose();
    navigate(to);
  };

  const items = useMemo<PaletteItem[]>(() => {
    if (q.length < 2) {
      const recents: PaletteItem[] = readRecents().map((r) => ({
        id: `recent-${r.type}-${r.id}`,
        group: 'Recent',
        title: r.title,
        sub: r.sub,
        perform: () =>
          go(
            r.type === 'case'
              ? `/test-cases/${r.projectId}/${r.id}`
              : r.type === 'bug'
                ? `/bugs/${r.projectId}/${r.id}`
                : '/test-suites',
          ),
      }));
      const actions: PaletteItem[] = [
        { id: 'go-dashboard', group: 'Actions', title: 'Go to Mission Control', sub: 'dashboard', perform: () => go('/dashboard') },
        { id: 'go-reporting', group: 'Actions', title: 'Go to Reports', sub: 'drill-down explorer', perform: () => go('/reporting') },
        { id: 'go-cases', group: 'Actions', title: 'Go to Test cases', perform: () => go('/test-cases') },
        { id: 'go-bugs', group: 'Actions', title: 'Go to Bugs', perform: () => go('/bugs') },
        { id: 'new-case', group: 'Actions', title: 'Generate test cases with AI', perform: () => go('/test-cases/generate') },
        { id: 'toggle-theme', group: 'Actions', title: 'Toggle light/dark theme', perform: () => { toggleTheme(); onClose(); } },
        { id: 'toggle-density', group: 'Actions', title: 'Toggle compact density', perform: () => { toggleDensity(); onClose(); } },
      ];
      return [...recents, ...actions];
    }

    const out: PaletteItem[] = [];
    if (scope === 'all' || scope === 'cases') {
      out.push(
        ...cases.map((c) => ({
          id: `case-${c.id}`,
          group: 'Cases',
          title: c.title,
          sub: c.testSuiteName,
          chip: { variant: c.testCaseType as ChipVariant, label: c.testCaseType },
          perform: () => {
            pushRecent({ type: 'case', id: c.id, projectId: c.projectId, title: c.title, sub: c.testSuiteName });
            go(`/test-cases/${c.projectId}/${c.id}`);
          },
        })),
      );
    }
    if (scope === 'all' || scope === 'suites') {
      out.push(
        ...suites.map((s) => ({
          id: `suite-${s.id}`,
          group: 'Suites',
          title: s.name,
          sub: s.description || undefined,
          perform: () => {
            pushRecent({ type: 'suite', id: s.id, projectId: s.projectId, title: s.name });
            go('/test-suites');
          },
        })),
      );
    }
    if (scope === 'all' || scope === 'bugs') {
      out.push(
        ...bugs.map((b) => ({
          id: `bug-${b.id}`,
          group: 'Bugs',
          title: b.title,
          sub: b.state,
          chip: { variant: 'fail' as ChipVariant, label: b.priority },
          perform: () => {
            pushRecent({ type: 'bug', id: b.id, projectId: b.projectId, title: b.title, sub: b.state });
            go(`/bugs/${b.projectId}/${b.id}`);
          },
        })),
      );
    }
    out.push({
      id: 'view-all',
      group: 'More',
      title: `View all results for “${q}”`,
      perform: () => go('/search'),
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, scope, cases, suites, bugs]);

  useEffect(() => {
    setSelected(0);
  }, [q, scope]);

  useEffect(() => {
    const el = listRef.current?.querySelector('[aria-selected="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((s) => Math.min(items.length - 1, s + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((s) => Math.max(0, s - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      items[selected]?.perform();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      setScope((s) => SCOPES[(SCOPES.indexOf(s) + 1) % SCOPES.length]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  let lastGroup = '';

  return (
    <div className="cmdk-overlay" onClick={onClose}>
      <div className="cmdk" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Command palette">
        <div className="cmdk-input-row">
          <svg className="ico" width="15" height="15" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3-3" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search cases, suites, bugs — or jump anywhere…"
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-list"
            aria-activedescendant={items[selected]?.id}
          />
          <span className="cmdk-scope">{scope}</span>
        </div>
        <div className="cmdk-list" id="cmdk-list" role="listbox" ref={listRef}>
          {items.length === 0 ? (
            <div className="cmdk-empty">
              {loading ? 'Searching…' : q.length < 2 ? 'No recent items yet.' : `Nothing matches “${q}”.`}
            </div>
          ) : (
            items.map((item, i) => {
              const groupHeader =
                item.group !== lastGroup ? (
                  <div key={`g-${item.group}`} className="cmdk-group">
                    <span className="microlabel">{item.group}</span>
                  </div>
                ) : null;
              lastGroup = item.group;
              return (
                <div key={item.id}>
                  {groupHeader}
                  <button
                    type="button"
                    id={item.id}
                    className="cmdk-item"
                    role="option"
                    aria-selected={i === selected}
                    onMouseEnter={() => setSelected(i)}
                    onClick={() => item.perform()}
                  >
                    {item.chip && (
                      <Chip variant={item.chip.variant} size="sm">
                        {item.chip.label}
                      </Chip>
                    )}
                    <span className="item-title">{item.title}</span>
                    {item.sub && <span className="item-sub">{item.sub}</span>}
                  </button>
                </div>
              );
            })
          )}
        </div>
        <div className="cmdk-footer">
          <span>
            <kbd>↑↓</kbd> navigate
          </span>
          <span>
            <kbd>↵</kbd> open
          </span>
          <span>
            <kbd>tab</kbd> scope
          </span>
          <span>
            <kbd>esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
