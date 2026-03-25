import type { BootCalibrationMode, ConfigSnapshot } from "../../lib/types";

interface ConfigPanelProps {
  config: ConfigSnapshot;
  connected: boolean;
  busy: boolean;
  rebootRequiredReasons: string[];
  helpTooltip: string;
  labels: {
    title: string;
    subtitle: string;
    rebootRequired: string;
    activePattern: string;
    brightness: string;
    stripLength: string;
    smoothing: string;
    accelRange: string;
    gyroRange: string;
    bootCalibration: string;
    readDevice: string;
    applyChanges: string;
    saveToDevice: string;
    loadSaved: string;
    defaults: string;
    activePatternHint: string;
    brightnessHint: string;
    stripLengthHint: string;
    smoothingHint: string;
    accelRangeHint: string;
    gyroRangeHint: string;
    bootCalibrationHint: string;
    readDeviceHint: string;
    applyChangesHint: string;
    saveToDeviceHint: string;
    loadSavedHint: string;
    defaultsHint: string;
  };
  onChange: <K extends keyof ConfigSnapshot>(key: K, value: ConfigSnapshot[K]) => void;
  onLiveBrightnessChange: (value: number) => void;
  onReadDevice: () => void;
  onApplyChanges: () => void;
  onSave: () => void;
  onLoad: () => void;
  onDefaults: () => void;
}

const BRIGHTNESS_LEVELS = [95, 127, 159, 191, 223, 255];
const ACCEL_RANGES = [2, 4, 8, 16];
const GYRO_RANGES = [250, 500, 1000, 2000];

export function ConfigPanel(props: ConfigPanelProps) {
  const {
    config,
    connected,
    busy,
    rebootRequiredReasons,
    helpTooltip,
    labels,
    onChange,
    onLiveBrightnessChange,
    onReadDevice,
    onApplyChanges,
    onSave,
    onLoad,
    onDefaults,
  } = props;

  return (
    <section className="panel panel-config">
      <div className="panel-header">
        <h2>{labels.title}</h2>
        <div className="panel-header-meta">
          <span className="muted">{labels.subtitle}</span>
          <span className="help-badge" title={helpTooltip} aria-label={helpTooltip}>
            ?
          </span>
        </div>
      </div>
      {rebootRequiredReasons.length > 0 ? (
        <p className="muted">{labels.rebootRequired}: {rebootRequiredReasons.join(", ")}</p>
      ) : null}

      <div className="field-grid config-grid">
        <label className="field">
          <span>{labels.activePattern}</span>
          <input
            type="number"
            min={1}
            max={14}
            value={config.pattern}
            onChange={(event) => onChange("pattern", Number.parseInt(event.target.value || "1", 10))}
            disabled={!connected || busy}
            title={labels.activePatternHint}
          />
        </label>
        <label className="field">
          <span>{labels.brightness}</span>
          <select
            value={config.brightness}
            onChange={(event) => onLiveBrightnessChange(Number.parseInt(event.target.value, 10))}
            disabled={!connected || busy}
            title={labels.brightnessHint}
          >
            {BRIGHTNESS_LEVELS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{labels.stripLength}</span>
          <input
            type="number"
            min={10}
            max={35}
            value={config.stripLength}
            onChange={(event) => onChange("stripLength", Number.parseInt(event.target.value || "10", 10))}
            disabled={!connected || busy}
            title={labels.stripLengthHint}
          />
        </label>
        <label className="field">
          <span>{labels.smoothing}</span>
          <input
            type="number"
            min={1}
            max={512}
            value={config.smoothing}
            onChange={(event) => onChange("smoothing", Number.parseInt(event.target.value || "1", 10))}
            disabled={!connected || busy}
            title={labels.smoothingHint}
          />
        </label>
        <label className="field">
          <span>{labels.accelRange}</span>
          <select
            value={config.accelRange}
            onChange={(event) => onChange("accelRange", Number.parseInt(event.target.value, 10))}
            disabled={!connected || busy}
            title={labels.accelRangeHint}
          >
            {ACCEL_RANGES.map((value) => (
              <option key={value} value={value}>
                {value} g
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{labels.gyroRange}</span>
          <select
            value={config.gyroRange}
            onChange={(event) => onChange("gyroRange", Number.parseInt(event.target.value, 10))}
            disabled={!connected || busy}
            title={labels.gyroRangeHint}
          >
            {GYRO_RANGES.map((value) => (
              <option key={value} value={value}>
                {value} dps
              </option>
            ))}
          </select>
        </label>
        <label className="field field-wide">
          <span>{labels.bootCalibration}</span>
          <select
            value={config.bootCalibration}
            onChange={(event) => onChange("bootCalibration", event.target.value as BootCalibrationMode)}
            disabled={!connected || busy}
            title={labels.bootCalibrationHint}
          >
            <option value="off">off</option>
            <option value="quick">quick</option>
          </select>
        </label>
      </div>

      <div className="button-row config-actions">
        <button type="button" onClick={onReadDevice} disabled={!connected || busy} title={labels.readDeviceHint}>
          {labels.readDevice}
        </button>
        <button type="button" className="primary" onClick={onApplyChanges} disabled={!connected || busy} title={labels.applyChangesHint}>
          {labels.applyChanges}
        </button>
        <button type="button" onClick={onSave} disabled={!connected || busy} title={labels.saveToDeviceHint}>
          {labels.saveToDevice}
        </button>
        <button type="button" onClick={onLoad} disabled={!connected || busy} title={labels.loadSavedHint}>
          {labels.loadSaved}
        </button>
        <button type="button" onClick={onDefaults} disabled={!connected || busy} title={labels.defaultsHint}>
          {labels.defaults}
        </button>
      </div>
    </section>
  );
}
