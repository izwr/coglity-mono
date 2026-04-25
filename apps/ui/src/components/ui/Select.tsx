import ReactSelect, { type Props, type GroupBase, type StylesConfig } from "react-select";

const cssVar = (name: string, fallback: string) => `var(${name}, ${fallback})`;

const getStyles = <
  Option,
  IsMulti extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>,
>(): StylesConfig<Option, IsMulti, Group> => ({
  control: (base, state) => ({
    ...base,
    background: cssVar("--surface", "#fff"),
    borderColor: state.isFocused ? cssVar("--teal", "#0D9488") : cssVar("--line", "#EDEAE4"),
    borderRadius: 10,
    minHeight: 40,
    fontSize: 14,
    color: cssVar("--ink", "#0A0A0A"),
    boxShadow: state.isFocused ? `0 0 0 3px ${cssVar("--teal-50", "#F0FDFA")}` : "none",
    "&:hover": {
      borderColor: cssVar("--teal", "#0D9488"),
    },
  }),
  valueContainer: (base) => ({
    ...base,
    padding: "0 12px",
  }),
  input: (base) => ({
    ...base,
    margin: 0,
    padding: 0,
    color: cssVar("--ink", "#0A0A0A"),
  }),
  singleValue: (base) => ({
    ...base,
    color: cssVar("--ink", "#0A0A0A"),
  }),
  placeholder: (base) => ({
    ...base,
    color: cssVar("--muted-2", "#A8A29E"),
    fontSize: 14,
  }),
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
    "&:active": {
      backgroundColor: cssVar("--teal-50", "#F0FDFA"),
    },
  }),
  multiValue: (base) => ({
    ...base,
    background: cssVar("--bg-2", "#F5F3EE"),
    borderRadius: 999,
  }),
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
  dropdownIndicator: (base) => ({
    ...base,
    padding: "0 8px",
    color: cssVar("--muted-2", "#A8A29E"),
  }),
  clearIndicator: (base) => ({
    ...base,
    padding: "0 4px",
    color: cssVar("--muted-2", "#A8A29E"),
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
      minHeight: 32,
      fontSize: 13,
      borderRadius: 8,
    });
    styles.valueContainer = (base) => ({
      ...base,
      padding: "0 8px",
    });
    styles.dropdownIndicator = (base) => ({
      ...base,
      padding: "0 6px",
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
