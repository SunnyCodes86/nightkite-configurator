interface OptionsPanelProps {
  connected: boolean;
  busy: boolean;
  language: "de" | "en";
  autoRefreshEnabled: boolean;
  autoRefreshSeconds: number;
  helpTooltip: string;
  onLanguageChange: (language: "de" | "en") => void;
  onAutoRefreshEnabledChange: (enabled: boolean) => void;
  onAutoRefreshSecondsChange: (seconds: number) => void;
  labels: {
    title: string;
    subtitle: string;
    language: string;
    autoRefresh: string;
    refreshInterval: string;
    languageDe: string;
    languageEn: string;
    autoRefreshOn: string;
    autoRefreshOff: string;
    secondsSuffix: string;
    languageHint: string;
    autoRefreshHint: string;
    refreshIntervalHint: string;
  };
}

export function OptionsPanel(props: OptionsPanelProps) {
  const {
    connected,
    busy,
    language,
    autoRefreshEnabled,
    autoRefreshSeconds,
    helpTooltip,
    onLanguageChange,
    onAutoRefreshEnabledChange,
    onAutoRefreshSecondsChange,
    labels,
  } = props;

  return (
    <section className="panel panel-options">
      <div className="panel-header">
        <h2>{labels.title}</h2>
        <div className="panel-header-meta">
          <span className="muted">{labels.subtitle}</span>
          <span className="help-badge" title={helpTooltip} aria-label={helpTooltip}>
            ?
          </span>
        </div>
      </div>

      <div className="field-grid single-column options-grid">
        <label className="field">
          <span>{labels.language}</span>
          <select
            value={language}
            onChange={(event) => onLanguageChange(event.target.value as "de" | "en")}
            disabled={busy}
            title={labels.languageHint}
          >
            <option value="de">{labels.languageDe}</option>
            <option value="en">{labels.languageEn}</option>
          </select>
        </label>

        <label className="field">
          <span>{labels.autoRefresh}</span>
          <select
            value={autoRefreshEnabled ? "on" : "off"}
            onChange={(event) => onAutoRefreshEnabledChange(event.target.value === "on")}
            disabled={busy || !connected}
            title={labels.autoRefreshHint}
          >
            <option value="off">{labels.autoRefreshOff}</option>
            <option value="on">{labels.autoRefreshOn}</option>
          </select>
        </label>

        <label className="field">
          <span>{labels.refreshInterval}</span>
          <input
            type="number"
            min={2}
            max={300}
            step={1}
            value={autoRefreshSeconds}
            onChange={(event) => onAutoRefreshSecondsChange(Number.parseInt(event.target.value || "5", 10))}
            disabled={busy || !connected || !autoRefreshEnabled}
            title={labels.refreshIntervalHint}
          />
          <span className="muted">{labels.secondsSuffix}</span>
        </label>
      </div>
    </section>
  );
}
