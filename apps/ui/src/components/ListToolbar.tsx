import { useEffect, useState } from "react";
import type { Tag } from "@coglity/shared";
import type { TestSuiteWithTags } from "../services/testSuiteService";
import { Select } from "./ui/Select";

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
        <Select
          compact
          value={pendingSuiteId ? { value: pendingSuiteId, label: suites.find((s) => s.id === pendingSuiteId)?.name ?? "" } : null}
          onChange={(opt) => setPendingSuiteId(opt?.value ?? "")}
          options={suites.map((suite) => ({ value: suite.id, label: suite.name }))}
          placeholder="All Suites"
          isClearable
        />
      )}
      {statusToggle && (
        <div className="tabs tabs-segmented">
          <button
            type="button"
            className={`tab${pendingStatus === "" ? " active" : ""}`}
            onClick={() => setPendingStatus("")}
          >
            <span className="tab-label">All</span>
          </button>
          {statusToggle.options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`tab${pendingStatus === opt.value ? " active" : ""}`}
              onClick={() => setPendingStatus(pendingStatus === opt.value ? "" : opt.value)}
            >
              <span className="tab-label">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
      <Select
        compact
        value={pendingTagId ? { value: pendingTagId, label: tags.find((t) => t.id === pendingTagId)?.name ?? "" } : null}
        onChange={(opt) => setPendingTagId(opt?.value ?? "")}
        options={tags.map((tag) => ({ value: tag.id, label: tag.name }))}
        placeholder="All Tags"
        isClearable
      />
      <Select
        compact
        value={{ value: pendingSort, label: sortOptions.find((o) => `${o.field}-${o.dir}` === pendingSort)?.label ?? "" }}
        onChange={(opt) => setPendingSort(opt?.value ?? `${sortOptions[0].field}-${sortOptions[0].dir}`)}
        options={sortOptions.map((opt) => ({ value: `${opt.field}-${opt.dir}`, label: opt.label }))}
        placeholder="Sort by"
      />
      <button type="button" className="list-toolbar-apply" onClick={handleApply}>Apply</button>
    </div>
  );
}