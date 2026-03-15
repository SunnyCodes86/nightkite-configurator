interface ManualPanelProps {
  title: string;
  subtitle: string;
  content: string;
  loading: boolean;
  loadingText: string;
  emptyText: string;
  helpTooltip: string;
}

function renderLine(line: string, index: number) {
  const trimmed = line.trim();
  if (!trimmed) {
    return <div key={`spacer-${index}`} className="manual-spacer" />;
  }

  if (trimmed.startsWith("### ")) {
    return (
      <h4 key={`h4-${index}`} className="manual-h4">
        {trimmed.slice(4)}
      </h4>
    );
  }

  if (trimmed.startsWith("## ")) {
    return (
      <h3 key={`h3-${index}`} className="manual-h3">
        {trimmed.slice(3)}
      </h3>
    );
  }

  if (trimmed.startsWith("# ")) {
    return (
      <h2 key={`h2-${index}`} className="manual-h2">
        {trimmed.slice(2)}
      </h2>
    );
  }

  if (trimmed.startsWith("- ")) {
    return (
      <div key={`li-${index}`} className="manual-list-item">
        <span className="manual-bullet">•</span>
        <span>{trimmed.slice(2)}</span>
      </div>
    );
  }

  if (/^\d+\.\s/.test(trimmed)) {
    const separatorIndex = trimmed.indexOf(" ");
    return (
      <div key={`ol-${index}`} className="manual-list-item">
        <span className="manual-bullet manual-bullet-number">{trimmed.slice(0, separatorIndex)}</span>
        <span>{trimmed.slice(separatorIndex + 1)}</span>
      </div>
    );
  }

  return (
    <p key={`p-${index}`} className="manual-paragraph">
      {line}
    </p>
  );
}

export function ManualPanel(props: ManualPanelProps) {
  const { title, subtitle, content, loading, loadingText, emptyText, helpTooltip } = props;
  const lines = content.split("\n");

  return (
    <section className="panel panel-manual">
      <div className="panel-header">
        <h2>{title}</h2>
        <div className="panel-header-meta">
          <span className="muted">{subtitle}</span>
          <span className="help-badge" title={helpTooltip} aria-label={helpTooltip}>
            ?
          </span>
        </div>
      </div>

      <div className="manual-box">
        {loading ? <p className="manual-paragraph">{loadingText}</p> : content.trim() ? lines.map(renderLine) : <p className="manual-paragraph">{emptyText}</p>}
      </div>
    </section>
  );
}
