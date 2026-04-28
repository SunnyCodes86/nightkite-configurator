import type { DiagnosticSnapshot } from "../../lib/types";

interface DiagnosticsPanelProps {
  diagnostics: DiagnosticSnapshot;
  connected: boolean;
  busy: boolean;
  helpTooltip: string;
  labels: {
    title: string;
    subtitle: string;
    battery: string;
    raw: string;
    refresh: string;
    reset: string;
    usbPower: string;
    serialSession: string;
    online: string;
    offline: string;
    active: string;
    idle: string;
    sensorState: string;
    timing: string;
    offsets: string;
    smoothingCfgActive: string;
    accelCfgActive: string;
    gyroCfgActive: string;
    noSensorData: string;
    noTimingData: string;
    noOffsetData: string;
    packetSize: string;
    activeAccel: string;
    activeGyro: string;
    smoothing: string;
    refreshBatteryHint: string;
    refreshSensorHint: string;
    refreshTimingHint: string;
    resetTimingHint: string;
    refreshOffsetsHint: string;
  };
  onBattery: () => void;
  onSensor: () => void;
  onTiming: () => void;
  onTimingReset: () => void;
  onOffsets: () => void;
}

export function DiagnosticsPanel(props: DiagnosticsPanelProps) {
  const { diagnostics, connected, busy, helpTooltip, labels, onBattery, onSensor, onTiming, onTimingReset, onOffsets } = props;
  const batteryVoltageValue = Number.parseFloat(diagnostics.batteryVoltage);
  const batteryPercent = Number.isFinite(batteryVoltageValue)
    ? Math.max(0, Math.min(100, ((batteryVoltageValue - 3.2) / (4.2 - 3.2)) * 100))
    : null;
  const smoothingDetail =
    diagnostics.smoothingConfig === null || diagnostics.smoothingActive === null
      ? "?"
      : `${diagnostics.smoothingConfig} / ${diagnostics.smoothingActive}`;
  const accelDetail =
    diagnostics.accelRangeConfig === null || diagnostics.accelRangeActive === null
      ? "?"
      : `${diagnostics.accelRangeConfig}g / ${diagnostics.accelRangeActive}g`;
  const gyroDetail =
    diagnostics.gyroRangeConfig === null || diagnostics.gyroRangeActive === null
      ? "?"
      : `${diagnostics.gyroRangeConfig} dps / ${diagnostics.gyroRangeActive} dps`;
  const serialActive = diagnostics.serialSessionActive === "1";
  const usbActive = diagnostics.usbPowerRaw === "1";
  const sensorItems = diagnostics.sensorSummary === "No data yet" ? [] : diagnostics.sensorSummary.split("  ");
  const timingItems = diagnostics.timingSummary === "No data yet" ? [] : diagnostics.timingSummary.split("  ");
  const offsetItems = diagnostics.offsetsSummary === "No data yet" ? [] : diagnostics.offsetsSummary.split("  ");
  const sensorMap = Object.fromEntries(
    sensorItems.map((item) => {
      const [key, ...rest] = item.split("=");
      return [key, rest.join("=")];
    }),
  );
  const mpuConnected = sensorMap.mpu === "1";
  const dmpReady = sensorMap.dmp === "1";
  const devOk = sensorMap.dev === "0";

  return (
    <section className="panel panel-diagnostics">
      <div className="panel-header">
        <h2>{labels.title}</h2>
        <div className="panel-header-meta">
          <span className="muted">{labels.subtitle}</span>
          <span className="help-badge" title={helpTooltip} aria-label={helpTooltip}>
            ?
          </span>
        </div>
      </div>

      <div className="diagnostics-showcase">
        <div className="diagnostic-hero-card">
          <div className="diagnostic-hero-top">
            <div>
              <span className="diagnostic-label">{labels.battery}</span>
              <div className="diagnostic-hero-value">{diagnostics.batteryVoltage}</div>
            </div>
            <div className="diagnostic-hero-actions">
              <span className="diagnostic-meta">{`${labels.raw} ${diagnostics.batteryRaw}`}</span>
              <button type="button" className="button-compact" onClick={onBattery} disabled={!connected || busy} title={labels.refreshBatteryHint}>
                {labels.refresh}
              </button>
            </div>
          </div>
          <div className="battery-meter">
            <div className="battery-meter-fill" style={{ width: `${batteryPercent ?? 0}%` }} />
          </div>
        </div>

        <div className="diagnostic-status-row">
          <div className="diagnostic-status-card">
            <span className="diagnostic-label">{labels.usbPower}</span>
            <strong className={usbActive ? "status-text is-on" : "status-text is-off"}>{usbActive ? labels.online : labels.offline}</strong>
          </div>
          <div className="diagnostic-status-card">
            <span className="diagnostic-label">{labels.serialSession}</span>
            <strong className={serialActive ? "status-text is-on" : "status-text is-off"}>{serialActive ? labels.active : labels.idle}</strong>
          </div>
        </div>

        <dl className="diagnostic-grid diagnostics-enhanced">
          <div className="diagnostic-card">
            <dt className="diagnostic-card-top">
              <span>{labels.sensorState}</span>
              <button type="button" className="button-compact" onClick={onSensor} disabled={!connected || busy} title={labels.refreshSensorHint}>
                {labels.refresh}
              </button>
            </dt>
            <dd>
              <div className="sensor-state-panel">
                {sensorItems.length > 0 ? (
                  <>
                    <div className="sensor-health-row">
                      <div className={`sensor-health-card${mpuConnected ? " is-good" : " is-bad"}`}>
                        <span className="sensor-health-label">MPU</span>
                        <strong>{mpuConnected ? "ON" : "OFF"}</strong>
                      </div>
                      <div className={`sensor-health-card${dmpReady ? " is-good" : " is-bad"}`}>
                        <span className="sensor-health-label">DMP</span>
                        <strong>{dmpReady ? "RDY" : "WAIT"}</strong>
                      </div>
                      <div className={`sensor-health-card${devOk ? " is-good" : " is-warn"}`}>
                        <span className="sensor-health-label">Dev</span>
                        <strong>{devOk ? "OK" : `C${sensorMap.dev ?? "?"}`}</strong>
                      </div>
                    </div>
                    <div className="sensor-detail-row">
                      <div className="sensor-detail-card">
                        <span className="sensor-health-label">Packet Size</span>
                        <strong>{sensorMap.pkt ?? "?"}</strong>
                      </div>
                      <div className="sensor-detail-card">
                        <span className="sensor-health-label">Active Accel</span>
                        <strong>{sensorMap.accel ?? "?"}</strong>
                      </div>
                      <div className="sensor-detail-card">
                        <span className="sensor-health-label">Active Gyro</span>
                        <strong>{sensorMap.gyro ?? "?"}</strong>
                      </div>
                      <div className="sensor-detail-card">
                        <span className="sensor-health-label">Smoothing</span>
                        <strong>{sensorMap.smooth ?? "?"}</strong>
                      </div>
                    </div>
                  </>
                ) : (
                  <span className="metric-empty">{labels.noSensorData}</span>
                )}
              </div>
            </dd>
          </div>
          <div className="diagnostic-card">
            <dt className="diagnostic-card-top">
              <span>{labels.timing}</span>
              <div className="diagnostic-card-actions">
                <button type="button" className="button-compact" onClick={onTimingReset} disabled={!connected || busy} title={labels.resetTimingHint}>
                  {labels.reset}
                </button>
                <button type="button" className="button-compact" onClick={onTiming} disabled={!connected || busy} title={labels.refreshTimingHint}>
                  {labels.refresh}
                </button>
              </div>
            </dt>
            <dd>
              <div className="metric-list">
                {timingItems.length > 0 ? (
                  timingItems.map((item) => (
                    <div key={item} className="metric-row">
                      <span>{item.split("=")[0]}</span>
                      <strong>{item.includes("=") ? item.slice(item.indexOf("=") + 1) : item}</strong>
                    </div>
                  ))
                ) : (
                  <span className="metric-empty">{labels.noTimingData}</span>
                )}
              </div>
            </dd>
          </div>
          <div className="diagnostic-card">
            <dt>{labels.smoothingCfgActive}</dt>
            <dd>{smoothingDetail}</dd>
          </div>
          <div className="diagnostic-card">
            <dt>{labels.accelCfgActive}</dt>
            <dd>{accelDetail}</dd>
          </div>
          <div className="diagnostic-card">
            <dt>{labels.gyroCfgActive}</dt>
            <dd>{gyroDetail}</dd>
          </div>
          <div className="diagnostic-card diagnostic-span">
            <dt className="diagnostic-card-top">
              <span>{labels.offsets}</span>
              <button type="button" className="button-compact" onClick={onOffsets} disabled={!connected || busy} title={labels.refreshOffsetsHint}>
                {labels.refresh}
              </button>
            </dt>
            <dd>
              <div className="offset-grid">
                {offsetItems.length > 0 ? (
                  offsetItems.map((item) => (
                    <div key={item} className="offset-cell">
                      <span>{item.split("=")[0]}</span>
                      <strong>{item.includes("=") ? item.slice(item.indexOf("=") + 1) : item}</strong>
                    </div>
                  ))
                ) : (
                  <span className="metric-empty">{labels.noOffsetData}</span>
                )}
              </div>
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
