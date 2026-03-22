import { useEffect, useState } from "react";
import type { Tag } from "@coglity/shared";
import type { TestSuiteWithTags } from "../services/testSuiteService";

type SortDir = "asc" | "desc";

interface SortOption {
  label: string;
  field: string;
  dir: SortDir;
}

interface StatusToggleConfig {
  options: { value: string; label: string; activeClass: string }[];
}

export interface ListToolbarProps {
  searchPlaceholder: string;
  tags: Tag[];
  sortOptions: SortOption[];
  onApply: (filters: AppliedFilters) => void;
  suites?: TestSuiteWithTags[];
  statusToggle?: StatusToggleConfig;
}

export interface AppliedFilters {
  search: string;
  tagId: string;
  sortBy: string;
  sortDir: SortDir;
  suiteId?: string;
  status?: string;
}

export function ListToolbar({ searchPlaceholder, tags, sortOptions, onApply, suites, statusToggle }: ListToolbarProps) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [pendingTagId, setPendingTagId] = useState("");
  const [pendingSuiteId, setPendingSuiteId] = useState("");
  const [pendingStatus, setPendingStatus] = useState("");
  const [pendingSort, setPendingSort] = useState(`${sortOptions[0].field}-${sortOptions[0].dir}`);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Auto-apply on search change
  useEffect(() => {
    const [field, dir] = pendingSort.split("-") as [string, SortDir];
    onApply({
      search,
      tagId: pendingTagId,
      sortBy: field,
      sortDir: dir,
      ...(suites ? { suiteId: pendingSuiteId } : {}),
      ...(statusToggle ? { status: pendingStatus } : {}),
    });
  }, [search]);

  const handleApply = () => {
    const [field, dir] = pendingSort.split("-") as [string, SortDir];
    onApply({
      search,
      tagId: pendingTagId,
      sortBy: field,
      sortDir: dir,
      ...(suites ? { suiteId: pendingSuiteId } : {}),
      ...(statusToggle ? { status: pendingStatus } : {}),
    });
  };

  return (
    <div className="list-toolbar">
      <input
        type="text"
        className="list-toolbar-search"
        placeholder={searchPlaceholder}
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
      />
      {suites && (
        <select value={pendingSuiteId} onChange={(e) => setPendingSuiteId(e.target.value)}>
          <option value="">All Suites</option>
          {suites.map((suite) => (
            <option key={suite.id} value={suite.id}>{suite.name}</option>
          ))}
        </select>
      )}
      {statusToggle && (
        <div className="status-toggle">
          {statusToggle.options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`status-toggle-btn${pendingStatus === opt.value ? ` ${opt.activeClass}` : ""}`}
              onClick={() => setPendingStatus(pendingStatus === opt.value ? "" : opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
      <select value={pendingTagId} onChange={(e) => setPendingTagId(e.target.value)}>
        <option value="">All Tags</option>
        {tags.map((tag) => (
          <option key={tag.id} value={tag.id}>{tag.name}</option>
        ))}
      </select>
      <select value={pendingSort} onChange={(e) => setPendingSort(e.target.value)}>
        {sortOptions.map((opt) => (
          <option key={`${opt.field}-${opt.dir}`} value={`${opt.field}-${opt.dir}`}>{opt.label}</option>
        ))}
      </select>
      <button type="button" className="list-toolbar-apply" onClick={handleApply}>Apply</button>
    </div>
  );
}