import { useMemo } from "react";
import { useCurrentOrg } from "../context/OrgContext";
import type { ProjectMembership } from "../context/AuthContext";
import { Select } from "./ui/Select";

/**
 * A writable project is one where the current user can create/update content:
 *   - org super_admin → all projects in the org
 *   - otherwise → projects where their role is "admin" or "writer"
 */
export function useWritableProjects(): ProjectMembership[] {
  const { org } = useCurrentOrg();
  return useMemo(() => {
    if (!org) return [];
    if (org.orgRole === "super_admin") return org.projects;
    return org.projects.filter((p) => p.role === "admin" || p.role === "writer");
  }, [org]);
}

interface Props {
  value: string;
  onChange: (projectId: string) => void;
  disabled?: boolean;
  id?: string;
  required?: boolean;
  placeholder?: string;
}

/**
 * Project dropdown for create/edit forms. Uses the shared Select component so
 * the styling matches every other picker in the app.
 */
export function ProjectPickerField({ value, onChange, disabled, id, required, placeholder }: Props) {
  const writable = useWritableProjects();

  if (writable.length === 0) {
    return (
      <p className="ts-form-hint">You don't have write access to any project in this organization.</p>
    );
  }

  const options = writable.map((p) => ({ value: p.projectId, label: p.projectName }));
  const selected = value ? options.find((o) => o.value === value) ?? null : null;

  return (
    <Select
      inputId={id}
      value={selected}
      onChange={(opt) => onChange(opt?.value ?? "")}
      options={options}
      placeholder={placeholder ?? "Select a project…"}
      isDisabled={disabled}
      required={required}
    />
  );
}
