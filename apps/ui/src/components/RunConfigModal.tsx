import { useState } from "react";
import { SUPPORTED_LANGUAGES, SUPPORTED_ENVIRONMENTS } from "@coglity/shared";
import { Button } from "./ui/Button";
import { Select } from "./ui/Select";

export interface RunConfig {
  languages: string[];
  environments: string[];
  crossProduct: boolean;
  combinations: Array<{ language: string; environment: string }>;
}

interface Props {
  onSubmit: (config: RunConfig) => void;
  onCancel: () => void;
  submitting?: boolean;
}

export function RunConfigModal({ onSubmit, onCancel, submitting }: Props) {
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(["en-US"]);
  const [selectedEnvironments, setSelectedEnvironments] = useState<string[]>(["quiet"]);
  const [mode, setMode] = useState<"crossProduct" | "mixMatch">("crossProduct");
  const [combinations, setCombinations] = useState<Array<{ language: string; environment: string }>>([
    { language: "en-US", environment: "quiet" },
  ]);

  const toggleLanguage = (code: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(code) ? prev.filter((l) => l !== code) : [...prev, code],
    );
  };

  const toggleEnvironment = (id: string) => {
    setSelectedEnvironments((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id],
    );
  };

  const runCount = mode === "crossProduct"
    ? selectedLanguages.length * selectedEnvironments.length
    : combinations.length;

  const handleSubmit = () => {
    if (mode === "crossProduct") {
      onSubmit({ languages: selectedLanguages, environments: selectedEnvironments, crossProduct: true, combinations: [] });
    } else {
      onSubmit({ languages: [], environments: [], crossProduct: false, combinations });
    }
  };

  const addCombination = () => {
    setCombinations((prev) => [...prev, { language: "en-US", environment: "quiet" }]);
  };

  const removeCombination = (idx: number) => {
    setCombinations((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateCombination = (idx: number, field: "language" | "environment", value: string) => {
    setCombinations((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  };

  return (
    <div style={overlayStyle} onClick={onCancel}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <h3 style={{ margin: 0 }}>Configure Test Run</h3>
          <button style={closeStyle} onClick={onCancel}>&times;</button>
        </div>

        <div style={bodyStyle}>
          <div style={sectionStyle}>
            <label style={labelStyle}>Languages</label>
            <div className="tag-picker">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  className={`chip-btn${selectedLanguages.includes(lang.code) ? " selected" : ""}`}
                  onClick={() => toggleLanguage(lang.code)}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          <div style={sectionStyle}>
            <label style={labelStyle}>Environment</label>
            <div className="tag-picker">
              {SUPPORTED_ENVIRONMENTS.map((env) => (
                <button
                  key={env.id}
                  type="button"
                  className={`chip-btn${selectedEnvironments.includes(env.id) ? " selected" : ""}`}
                  onClick={() => toggleEnvironment(env.id)}
                >
                  {env.label}
                </button>
              ))}
            </div>
          </div>

          <div style={sectionStyle}>
            <label style={labelStyle}>Execution Mode</label>
            <div style={{ display: "flex", gap: 12 }}>
              <label style={radioLabelStyle}>
                <input
                  type="radio"
                  checked={mode === "crossProduct"}
                  onChange={() => setMode("crossProduct")}
                />
                <span>Cross Product</span>
                <span className="muted" style={{ fontSize: 11 }}> — every language &times; every environment</span>
              </label>
              <label style={radioLabelStyle}>
                <input
                  type="radio"
                  checked={mode === "mixMatch"}
                  onChange={() => setMode("mixMatch")}
                />
                <span>Mix &amp; Match</span>
                <span className="muted" style={{ fontSize: 11 }}> — manually pair combinations</span>
              </label>
            </div>
          </div>

          {mode === "mixMatch" && (
            <div style={sectionStyle}>
              <label style={labelStyle}>Combinations</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {combinations.map((combo, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ flex: 1 }}>
                      <Select
                        value={{ value: combo.language, label: SUPPORTED_LANGUAGES.find((l) => l.code === combo.language)?.label ?? combo.language }}
                        onChange={(opt) => updateCombination(idx, "language", (opt as { value: string }).value)}
                        options={SUPPORTED_LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <Select
                        value={{ value: combo.environment, label: SUPPORTED_ENVIRONMENTS.find((e) => e.id === combo.environment)?.label ?? combo.environment }}
                        onChange={(opt) => updateCombination(idx, "environment", (opt as { value: string }).value)}
                        options={SUPPORTED_ENVIRONMENTS.map((e) => ({ value: e.id, label: e.label }))}
                      />
                    </div>
                    <button
                      type="button"
                      style={removeBtnStyle}
                      onClick={() => removeCombination(idx)}
                      disabled={combinations.length <= 1}
                    >
                      &times;
                    </button>
                  </div>
                ))}
                <Button variant="ghost" size="sm" onClick={addCombination}>+ Add Combination</Button>
              </div>
            </div>
          )}

          <div style={summaryStyle}>
            <strong>{runCount}</strong> test run{runCount !== 1 ? "s" : ""} will be created
            {mode === "crossProduct" && runCount > 1 && (
              <span className="muted"> ({selectedLanguages.length} language{selectedLanguages.length !== 1 ? "s" : ""} &times; {selectedEnvironments.length} environment{selectedEnvironments.length !== 1 ? "s" : ""})</span>
            )}
          </div>
        </div>

        <div style={footerStyle}>
          <Button variant="ghost" onClick={onCancel} disabled={submitting}>Cancel</Button>
          <Button variant="teal" onClick={handleSubmit} disabled={submitting || runCount === 0}>
            {submitting ? "Starting…" : `Run ${runCount} test${runCount !== 1 ? "s" : ""}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  background: "var(--bg-1)",
  border: "1px solid var(--line)",
  borderRadius: 16,
  width: "100%",
  maxWidth: 600,
  maxHeight: "85vh",
  overflow: "auto",
  boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "16px 20px",
  borderBottom: "1px solid var(--line)",
};

const closeStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  fontSize: 22,
  cursor: "pointer",
  color: "var(--muted)",
  lineHeight: 1,
};

const bodyStyle: React.CSSProperties = {
  padding: "16px 20px",
};

const sectionStyle: React.CSSProperties = {
  marginBottom: 20,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--muted)",
  marginBottom: 8,
};

const radioLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 13,
  cursor: "pointer",
};

const removeBtnStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid var(--line)",
  borderRadius: 6,
  width: 28,
  height: 28,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  fontSize: 16,
  color: "var(--muted)",
};

const summaryStyle: React.CSSProperties = {
  padding: "12px 14px",
  background: "var(--bg-2)",
  borderRadius: 8,
  fontSize: 13,
  border: "1px solid var(--line)",
};

const footerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  padding: "12px 20px",
  borderTop: "1px solid var(--line)",
};
