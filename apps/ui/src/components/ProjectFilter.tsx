import { useCallback, useMemo } from "react";
import ReactSelect, { type StylesConfig } from "react-select";
import { useSearchParams } from "react-router-dom";
import { useCurrentOrg } from "../context/OrgContext";

const URL_PARAM = "projects";

const cssVar = (name: string, fallback: string) => `var(${name}, ${fallback})`;

interface Option {
  value: string;
  label: string;
}

const styles: StylesConfig<Option, true> = {
  control: (base, state) => ({
    ...base,
    background: cssVar("--surface", "#fff"),
    borderColor: state.isFocused ? cssVar("--teal", "#0D9488") : cssVar("--line", "#EDEAE4"),
    borderRadius: 10,
    minHeight: 40,
    fontSize: 14,
    color: cssVar("--ink", "#0A0A0A"),
    boxShadow: state.isFocused ? `0 0 0 3px ${cssVar("--teal-50", "#F0FDFA")}` : "none",
    "&:hover": { borderColor: cssVar("--teal", "#0D9488") },
  }),
  valueContainer: (base) => ({ ...base, padding: "0 12px" }),
  placeholder: (base) => ({ ...base, color: cssVar("--muted-2", "#A8A29E"), fontSize: 14 }),
  menu: (base) => ({
    ...base,
    background: cssVar("--surface", "#fff"),
    border: `1px solid ${cssVar("--line", "#EDEAE4")}`,
    borderRadius: 10,
    boxShadow: cssVar("--shadow-md", "0 8px 40px rgba(0,0,0,0.06)"),
    zIndex: 50,
    fontSize: 13,
    overflow: "hidden",
  }),
  menuList: (base) => ({ ...base, padding: 4 }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? cssVar("--teal", "#0D9488")
      : state.isFocused
        ? cssVar("--bg-2", "#F5F3EE")
        : "transparent",
    color: state.isSelected ? "#fff" : cssVar("--ink", "#0A0A0A"),
    padding: "7px 10px",
    borderRadius: 6,
    cursor: "pointer",
  }),
  multiValue: (base) => ({ ...base, background: cssVar("--bg-2", "#F5F3EE"), borderRadius: 999 }),
  multiValueLabel: (base) => ({
    ...base,
    color: cssVar("--ink-3", "#44403C"),
    fontSize: 12,
    padding: "2px 6px 2px 10px",
  }),
  multiValueRemove: (base) => ({
    ...base,
    color: cssVar("--muted", "#78716C"),
    borderRadius: 999,
    "&:hover": { background: "transparent", color: cssVar("--ink", "#0A0A0A") },
  }),
  indicatorSeparator: () => ({ display: "none" }),
  dropdownIndicator: (base) => ({ ...base, padding: "0 8px", color: cssVar("--muted-2", "#A8A29E") }),
  clearIndicator: (base) => ({ ...base, padding: "0 4px", color: cssVar("--muted-2", "#A8A29E") }),
};

function parseIds(raw: string | null): string[] {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * Returns the currently-selected project ids from the `?projects=` URL param,
 * filtered to ones the current user still has access to in the current org.
 */
export function useSelectedProjectIds(): string[] {
  const [searchParams] = useSearchParams();
  const { org } = useCurrentOrg();
  return useMemo(() => {
    const raw = parseIds(searchParams.get(URL_PARAM));
    if (!org) return [];
    const valid = new Set(org.projects.map((p) => p.projectId));
    return raw.filter((id) => valid.has(id));
  }, [searchParams, org]);
}

/**
 * Convenience: returns the single selected project id if exactly one is
 * selected, else null. Used to gate "New X" buttons and single-project
 * admin pages.
 */
export function useSingleProjectId(): string | null {
  const ids = useSelectedProjectIds();
  return ids.length === 1 ? ids[0] : null;
}

export function ProjectFilter({ placeholder = "Filter by project…" }: { placeholder?: string }) {
  const { org } = useCurrentOrg();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedIds = useSelectedProjectIds();

  const options: Option[] = useMemo(
    () => (org?.projects ?? []).map((p) => ({ value: p.projectId, label: p.projectName })),
    [org],
  );

  const value = options.filter((o) => selectedIds.includes(o.value));

  const onChange = useCallback(
    (next: readonly Option[]) => {
      const newParams = new URLSearchParams(searchParams);
      if (next.length === 0) {
        newParams.delete(URL_PARAM);
      } else {
        newParams.set(URL_PARAM, next.map((o) => o.value).join(","));
      }
      setSearchParams(newParams, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  if (!org) return null;

  return (
    <div style={{ minWidth: 260, maxWidth: 520 }}>
      <ReactSelect<Option, true>
        isMulti
        isClearable
        options={options}
        value={value}
        onChange={(next) => onChange(next ?? [])}
        placeholder={placeholder}
        styles={styles}
        menuPortalTarget={document.body}
        menuPosition="fixed"
      />
    </div>
  );
}
