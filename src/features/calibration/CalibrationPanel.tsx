import { useEffect, useRef } from "react";

interface CalibrationPanelProps {
  connected: boolean;
  busy: boolean;
  helpTooltip: string;
  labels: {
    title: string;
    subtitle: string;
    quickCalibration: string;
    preciseCalibration: string;
    rebootDevice: string;
    restartAlias: string;
    showCliHelp: string;
    readSingleCliKey: string;
    runGet: string;
    cliTerminal: string;
    send: string;
    terminalPlaceholder: string;
    quickCalibrationHint: string;
    preciseCalibrationHint: string;
    rebootDeviceHint: string;
    restartAliasHint: string;
    showCliHelpHint: string;
    readSingleCliKeyHint: string;
    runGetHint: string;
    cliTerminalHint: string;
    sendHint: string;
  };
  onQuickCalibration: () => void;
  onPreciseCalibration: () => void;
  onReboot: () => void;
  onRestart: () => void;
  onHelp: () => void;
  onReadKey: (key: string) => void;
  selectedGetKey: string;
  onSelectedGetKeyChange: (key: string) => void;
  commandDraft: string;
  onCommandDraftChange: (command: string) => void;
  onRunCommand: () => void;
  logLines: string[];
}

export function CalibrationPanel(props: CalibrationPanelProps) {
  const {
    connected,
    busy,
    helpTooltip,
    labels,
    onQuickCalibration,
    onPreciseCalibration,
    onReboot,
    onRestart,
    onHelp,
    onReadKey,
    selectedGetKey,
    onSelectedGetKeyChange,
    commandDraft,
    onCommandDraftChange,
    onRunCommand,
    logLines,
  } = props;
  const logBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = logBoxRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [logLines]);

  return (
    <section className="panel panel-calibration calibration-panel">
      <div className="panel-header">
        <h2>{labels.title}</h2>
        <div className="panel-header-meta">
          <span className="muted">{labels.subtitle}</span>
          <span className="help-badge" title={helpTooltip} aria-label={helpTooltip}>
            ?
          </span>
        </div>
      </div>

      <div className="button-row">
        <button
          type="button"
          className="primary"
          onClick={onQuickCalibration}
          disabled={!connected || busy}
          title={labels.quickCalibrationHint}
        >
          {labels.quickCalibration}
        </button>
        <button type="button" onClick={onPreciseCalibration} disabled={!connected || busy} title={labels.preciseCalibrationHint}>
          {labels.preciseCalibration}
        </button>
        <button type="button" onClick={onReboot} disabled={!connected || busy} title={labels.rebootDeviceHint}>
          {labels.rebootDevice}
        </button>
        <button type="button" onClick={onRestart} disabled={!connected || busy} title={labels.restartAliasHint}>
          {labels.restartAlias}
        </button>
        <button type="button" onClick={onHelp} disabled={!connected || busy} title={labels.showCliHelpHint}>
          {labels.showCliHelp}
        </button>
      </div>

      <div className="field-grid single-column">
        <label className="field">
          <span>{labels.readSingleCliKey}</span>
          <div className="button-row">
            <select
              value={selectedGetKey}
              onChange={(event) => onSelectedGetKeyChange(event.target.value)}
              disabled={!connected || busy}
              title={labels.readSingleCliKeyHint}
            >
              <option value="pattern">pattern</option>
              <option value="brightness">brightness</option>
              <option value="strip_length">strip_length</option>
              <option value="smoothing">smoothing</option>
              <option value="accel_range">accel_range</option>
              <option value="gyro_range">gyro_range</option>
              <option value="boot_calibration">boot_calibration</option>
              <option value="autoplay">autoplay</option>
              <option value="autoplay_interval">autoplay_interval</option>
              <option value="enabled_patterns">enabled_patterns</option>
            </select>
            <button type="button" onClick={() => onReadKey(selectedGetKey)} disabled={!connected || busy} title={labels.runGetHint}>
              {labels.runGet}
            </button>
          </div>
        </label>
      </div>

      <div ref={logBoxRef} className="log-box">
        {logLines.map((line, index) => (
          <div key={`${index}-${line}`}>{line}</div>
        ))}
      </div>

      <label className="field terminal-field">
        <span>{labels.cliTerminal}</span>
        <input
          type="text"
          value={commandDraft}
          onChange={(event) => onCommandDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onRunCommand();
            }
          }}
          placeholder={labels.terminalPlaceholder}
          disabled={!connected || busy}
          title={labels.cliTerminalHint}
        />
        <button type="button" className="primary" onClick={onRunCommand} disabled={!connected || busy} title={labels.sendHint}>
          {labels.send}
        </button>
      </label>
    </section>
  );
}
