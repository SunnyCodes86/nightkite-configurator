import type { PatternState } from "../../lib/types";

interface PatternsPanelProps {
  patterns: PatternState[];
  connected: boolean;
  busy: boolean;
  helpTooltip: string;
  labels: {
    title: string;
    subtitle: string;
    enabled: string;
    disabled: string;
    active: string;
    includeInCycle: string;
    makeActive: string;
    enableAll: string;
    readPatternList: string;
    applySelection: string;
    includeInCycleHint: string;
    makeActiveHint: string;
    enableAllHint: string;
    readPatternListHint: string;
    applySelectionHint: string;
  };
  onToggleEnabled: (patternId: number) => void;
  onSetActive: (patternId: number) => void;
  onRefresh: () => void;
  onApply: () => void;
  onEnableAll: () => void;
}

export function PatternsPanel(props: PatternsPanelProps) {
  const { patterns, connected, busy, helpTooltip, labels, onToggleEnabled, onSetActive, onRefresh, onApply, onEnableAll } = props;

  return (
    <section className="panel panel-patterns">
      <div className="panel-header">
        <h2>{labels.title}</h2>
        <div className="panel-header-meta">
          <span className="muted">{labels.subtitle}</span>
          <span className="help-badge" title={helpTooltip} aria-label={helpTooltip}>
            ?
          </span>
        </div>
      </div>

      <div className="pattern-grid">
        {patterns.map((pattern) => (
          <div
            key={pattern.id}
            className={`pattern-card${pattern.enabled ? " enabled" : ""}${pattern.active ? " active" : ""}`}
          >
            <div className="pattern-main">
              <div className="pattern-card-header">
                <span className="pattern-id">#{pattern.id}</span>
                <div className="pattern-badges">
                  <span className={`pattern-badge ${pattern.enabled ? "is-enabled" : "is-disabled"}`}>
                    {pattern.enabled ? labels.enabled : labels.disabled}
                  </span>
                  {pattern.active ? <span className="pattern-badge is-active">{labels.active}</span> : null}
                </div>
              </div>
              <div className="pattern-name">{pattern.name}</div>
            </div>
            <label className="pattern-toggle">
              <input
                type="checkbox"
                checked={pattern.enabled}
                onChange={() => onToggleEnabled(pattern.id)}
                disabled={!connected || busy}
                title={labels.includeInCycleHint}
              />
              <span>{labels.includeInCycle}</span>
            </label>
            <button
              type="button"
              className="pattern-activate"
              onClick={() => onSetActive(pattern.id)}
              disabled={!connected || busy}
              title={labels.makeActiveHint}
            >
              {labels.makeActive}
            </button>
          </div>
        ))}
      </div>

      <div className="button-row">
        <button type="button" onClick={onEnableAll} disabled={!connected || busy} title={labels.enableAllHint}>
          {labels.enableAll}
        </button>
        <button type="button" onClick={onRefresh} disabled={!connected || busy} title={labels.readPatternListHint}>
          {labels.readPatternList}
        </button>
        <button type="button" className="primary" onClick={onApply} disabled={!connected || busy} title={labels.applySelectionHint}>
          {labels.applySelection}
        </button>
      </div>
    </section>
  );
}
