interface ConnectionPanelProps {
  ports: string[];
  selectedPort: string;
  connected: boolean;
  helpTooltip: string;
  labels: {
    title: string;
    connected: string;
    disconnected: string;
    serialPort: string;
    noSerialPorts: string;
    refreshPorts: string;
    connect: string;
    disconnect: string;
    serialPortHint: string;
    refreshPortsHint: string;
    connectHint: string;
    disconnectHint: string;
  };
  onSelectedPortChange: (port: string) => void;
  onRefreshPorts: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  busy: boolean;
}

export function ConnectionPanel(props: ConnectionPanelProps) {
  const {
    ports,
    selectedPort,
    connected,
    helpTooltip,
    labels,
    onSelectedPortChange,
    onRefreshPorts,
    onConnect,
    onDisconnect,
    busy,
  } = props;

  return (
    <section className="panel panel-connection connection-panel">
      <div className="panel-header">
        <h2>{labels.title}</h2>
        <div className="panel-header-meta">
          <span className={connected ? "status status-ok" : "status status-off"}>
            {connected ? labels.connected : labels.disconnected}
          </span>
          <span className="help-badge" title={helpTooltip} aria-label={helpTooltip}>
            ?
          </span>
        </div>
      </div>

      <div className="field-grid single-column connection-layout">
        <label className="field">
          <span>{labels.serialPort}</span>
          <select
            value={selectedPort}
            onChange={(event) => onSelectedPortChange(event.target.value)}
            disabled={busy || connected || ports.length === 0}
            title={labels.serialPortHint}
          >
            {ports.length === 0 ? <option value="">{labels.noSerialPorts}</option> : null}
            {ports.map((port) => (
              <option key={port} value={port}>
                {port}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="button-row connection-actions">
        <button type="button" onClick={onRefreshPorts} disabled={busy} title={labels.refreshPortsHint}>
          {labels.refreshPorts}
        </button>
        <button
          type="button"
          className="primary"
          onClick={onConnect}
          disabled={busy || connected || !selectedPort}
          title={labels.connectHint}
        >
          {labels.connect}
        </button>
        <button type="button" onClick={onDisconnect} disabled={busy || !connected} title={labels.disconnectHint}>
          {labels.disconnect}
        </button>
      </div>
    </section>
  );
}
