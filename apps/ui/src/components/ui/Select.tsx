import ReactSelect, { type Props, type GroupBase, type StylesConfig } from "react-select";

const getStyles = <
  Option,
  IsMulti extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>,
>(): StylesConfig<Option, IsMulti, Group> => ({
  control: (base, state) => ({
    ...base,
    background: "var(--color-surface, #fff)",
    borderColor: state.isFocused ? "var(--color-accent, #2563eb)" : "var(--color-border, #e2e5eb)",
    borderRadius: 6,
    minHeight: 32,
    fontSize: 13,
    boxShadow: state.isFocused ? "0 0 0 1px var(--color-accent, #2563eb)" : "none",
    "&:hover": {
      borderColor: "var(--color-accent, #2563eb)",
    },
  }),
  valueContainer: (base) => ({
    ...base,
    padding: "0 8px",
  }),
  input: (base) => ({
    ...base,
    margin: 0,
    padding: 0,
    color: "var(--color-text, #1a1d24)",
  }),
  singleValue: (base) => ({
    ...base,
    color: "var(--color-text, #1a1d24)",
  }),
  placeholder: (base) => ({
    ...base,
    color: "var(--color-text-tertiary, #8b93a1)",
    fontSize: 13,
  }),
  menu: (base) => ({
    ...base,
    background: "var(--color-surface, #fff)",
    border: "1px solid var(--color-border, #e2e5eb)",
    borderRadius: 6,
    boxShadow: "var(--shadow-md, 0 2px 8px rgba(0,0,0,0.06))",
    zIndex: 20,
    fontSize: 13,
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? "var(--color-accent, #2563eb)"
      : state.isFocused
        ? "var(--color-bg-muted, #eef0f4)"
        : "transparent",
    color: state.isSelected ? "var(--color-accent-text, #fff)" : "var(--color-text, #1a1d24)",
    padding: "6px 10px",
    cursor: "pointer",
    "&:active": {
      backgroundColor: "var(--color-accent-subtle, #eff4ff)",
    },
  }),
  indicatorSeparator: () => ({ display: "none" }),
  dropdownIndicator: (base) => ({
    ...base,
    padding: "0 6px",
    color: "var(--color-text-tertiary, #8b93a1)",
  }),
  clearIndicator: (base) => ({
    ...base,
    padding: "0 4px",
    color: "var(--color-text-tertiary, #8b93a1)",
  }),
});

export interface SelectOption {
  value: string;
  label: string;
}

type SelectProps = Omit<Props<SelectOption, false>, "styles" | "theme"> & {
  compact?: boolean;
};

export function Select({ compact, ...props }: SelectProps) {
  const styles = getStyles<SelectOption, false>();
  if (compact) {
    styles.control = (base, state) => ({
      ...getStyles<SelectOption, false>().control!(base, state),
      minHeight: 28,
      fontSize: 12,
    });
    styles.valueContainer = (base) => ({
      ...base,
      padding: "0 6px",
    });
    styles.dropdownIndicator = (base) => ({
      ...base,
      padding: "0 4px",
    });
  }
  return (
    <ReactSelect<SelectOption, false>
      styles={styles}
      menuPortalTarget={document.body}
      menuPosition="fixed"
      {...props}
    />
  );
}