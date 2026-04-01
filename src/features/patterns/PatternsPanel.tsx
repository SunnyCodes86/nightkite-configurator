import type { PatternState } from "../../lib/types";

interface PatternsPanelProps {
  patterns: PatternState[];
  viewMode: "comfortable" | "compact";
  connected: boolean;
  busy: boolean;
  helpTooltip: string;
  labels: {
    title: string;
    subtitle: string;
    enabled: string;
    disabled: string;
    active: string;
    inverted: string;
    includeInCycle: string;
    invertDirection: string;
    makeActive: string;
    enableAll: string;
    invertAll: string;
    readPatternList: string;
    applySelection: string;
    includeInCycleHint: string;
    invertDirectionHint: string;
    makeActiveHint: string;
    enableAllHint: string;
    invertAllHint: string;
    readPatternListHint: string;
    applySelectionHint: string;
    compactId: string;
    compactName: string;
    compactState: string;
    compactEnabled: string;
    compactInverted: string;
    compactActions: string;
  };
  onToggleEnabled: (patternId: number) => void;
  onToggleInverted: (patternId: number) => void;
  onSetActive: (patternId: number) => void;
  onRefresh: () => void;
  onApply: () => void;
  onEnableAll: () => void;
  onInvertAll: () => void;
}

export function PatternsPanel(props: PatternsPanelProps) {
  const { patterns, viewMode, connected, busy, helpTooltip, labels, onToggleEnabled, onToggleInverted, onSetActive, onRefresh, onApply, onEnableAll, onInvertAll } = props;

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

      {viewMode === "compact" ? (
        <div className="pattern-table-wrap">
          <table className="pattern-table">
            <thead>
              <tr>
                <th>{labels.compactId}</th>
                <th>{labels.compactName}</th>
                <th>{labels.compactState}</th>
                <th>{labels.compactEnabled}</th>
                <th>{labels.compactInverted}</th>
                <th>{labels.compactActions}</th>
              </tr>
            </thead>
            <tbody>
              {patterns.map((pattern) => (
                <tr key={pattern.id} className={pattern.active ? "is-active" : undefined}>
                  <td className="pattern-table-id">#{pattern.id}</td>
                  <td className="pattern-table-name">{pattern.name}</td>
                  <td>
                    <div className="pattern-table-badges">
                      <span className={`pattern-badge ${pattern.enabled ? "is-enabled" : "is-disabled"}`}>
                        {pattern.enabled ? labels.enabled : labels.disabled}
                      </span>
                      {pattern.active ? <span className="pattern-badge is-active">{labels.active}</span> : null}
                      {pattern.inverted ? <span className="pattern-badge is-active">{labels.inverted}</span> : null}
                    </div>
                  </td>
                  <td>
                    <label className="pattern-toggle pattern-toggle-compact">
                      <input
                        type="checkbox"
                        checked={pattern.enabled}
                        onChange={() => onToggleEnabled(pattern.id)}
                        disabled={!connected || busy}
                        title={labels.includeInCycleHint}
                      />
                    </label>
                  </td>
                  <td>
                    <label className="pattern-toggle pattern-toggle-compact">
                      <input
                        type="checkbox"
                        checked={pattern.inverted}
                        onChange={() => onToggleInverted(pattern.id)}
                        disabled={!connected || busy}
                        title={labels.invertDirectionHint}
                      />
                    </label>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="pattern-activate pattern-activate-compact"
                      onClick={() => onSetActive(pattern.id)}
                      disabled={!connected || busy}
                      title={labels.makeActiveHint}
                    >
                      {labels.makeActive}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
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
                    {pattern.inverted ? <span className="pattern-badge is-active">{labels.inverted}</span> : null}
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
              <label className="pattern-toggle">
                <input
                  type="checkbox"
                  checked={pattern.inverted}
                  onChange={() => onToggleInverted(pattern.id)}
                  disabled={!connected || busy}
                  title={labels.invertDirectionHint}
                />
                <span>{labels.invertDirection}</span>
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
      )}

      <div className="button-row">
        <button type="button" onClick={onEnableAll} disabled={!connected || busy} title={labels.enableAllHint}>
          {labels.enableAll}
        </button>
        <button type="button" onClick={onInvertAll} disabled={!connected || busy} title={labels.invertAllHint}>
          {labels.invertAll}
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
