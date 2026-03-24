import { useEffect, useMemo, useRef, useState } from "react";
import { ConnectionPanel } from "./features/connection/ConnectionPanel";
import { ConfigPanel } from "./features/config/ConfigPanel";
import { OptionsPanel } from "./features/options/OptionsPanel";
import { PatternsPanel } from "./features/patterns/PatternsPanel";
import { DiagnosticsPanel } from "./features/diagnostics/DiagnosticsPanel";
import { CalibrationPanel } from "./features/calibration/CalibrationPanel";
import { ManualPanel } from "./features/manual/ManualPanel";
import {
  batteryDiagnosticsFromCliLine,
  configFromCliLine,
  createFallbackPatternStates,
  DEFAULT_CONFIG,
  DEFAULT_DIAGNOSTICS,
  offsetsDiagnosticsFromCliLine,
  parseCliLine,
  patternStatesFromCliLine,
  sensorDiagnosticsFromCliLine,
  timingDiagnosticsFromCliLine,
} from "./lib/cli";
import { DeviceClient } from "./lib/deviceClient";
import type { AppLanguage, CliLine, ConfigSnapshot, ConnectionInfo, DiagnosticSnapshot, PatternState } from "./lib/types";

const INITIAL_CONNECTION: ConnectionInfo = {
  connected: false,
  portName: "",
  baudRate: 115200,
};

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function formatLogLine(message: string) {
  const timestamp = new Date().toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return `[${timestamp}] ${message}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isLikelyConnectionLoss(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("timed out waiting for reply") ||
    normalized.includes("not connected to a serial device") ||
    normalized.includes("device disconnected") ||
    normalized.includes("device not configured") ||
    normalized.includes("broken pipe") ||
    normalized.includes("input/output error") ||
    normalized.includes("no such file") ||
    normalized.includes("cannot find the file") ||
    normalized.includes("system cannot find the file") ||
    normalized.includes("access is denied")
  );
}

export default function App() {
  const clientRef = useRef(new DeviceClient());
  const [ports, setPorts] = useState<string[]>([]);
  const [selectedPort, setSelectedPort] = useState("");
  const [connection, setConnection] = useState(INITIAL_CONNECTION);
  const [config, setConfig] = useState<ConfigSnapshot>(DEFAULT_CONFIG);
  const [draftConfig, setDraftConfig] = useState<ConfigSnapshot>(DEFAULT_CONFIG);
  const [patterns, setPatterns] = useState<PatternState[]>(
    createFallbackPatternStates(DEFAULT_CONFIG.pattern, DEFAULT_CONFIG.enabledPatterns),
  );
  const [diagnostics, setDiagnostics] = useState<DiagnosticSnapshot>(DEFAULT_DIAGNOSTICS);
  const [logLines, setLogLines] = useState<string[]>([
    formatLogLine("Ready."),
    formatLogLine("Connect to a NightKite controller to start reading CLI output."),
  ]);
  const [busy, setBusy] = useState(false);
  const [bootCalibrationPendingReboot, setBootCalibrationPendingReboot] = useState(false);
  const [selectedGetKey, setSelectedGetKey] = useState("pattern");
  const [commandDraft, setCommandDraft] = useState("help");
  const [language, setLanguage] = useState<AppLanguage>("de");
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [autoRefreshSeconds, setAutoRefreshSeconds] = useState(10);
  const [manualContent, setManualContent] = useState("");
  const [manualLoading, setManualLoading] = useState(false);

  const activePatternId = draftConfig.pattern;
  const text = translations[language];
  const rebootRequiredReasons = useMemo(() => {
    const reasons: string[] = [];

    if (
      diagnostics.smoothingConfig !== null &&
      diagnostics.smoothingActive !== null &&
      diagnostics.smoothingConfig !== diagnostics.smoothingActive
    ) {
      reasons.push("Smoothing");
    }
    if (
      diagnostics.accelRangeConfig !== null &&
      diagnostics.accelRangeActive !== null &&
      diagnostics.accelRangeConfig !== diagnostics.accelRangeActive
    ) {
      reasons.push("Accel Range");
    }
    if (
      diagnostics.gyroRangeConfig !== null &&
      diagnostics.gyroRangeActive !== null &&
      diagnostics.gyroRangeConfig !== diagnostics.gyroRangeActive
    ) {
      reasons.push("Gyro Range");
    }
    if (bootCalibrationPendingReboot) {
      reasons.push("Boot Calibration");
    }

    return reasons;
  }, [bootCalibrationPendingReboot, diagnostics]);

  useEffect(() => {
    if (!autoRefreshEnabled || !connection.connected || busy) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void withBusy(async () => {
        await readAll();
      });
    }, Math.max(2, autoRefreshSeconds) * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [autoRefreshEnabled, autoRefreshSeconds, connection.connected, busy]);

  useEffect(() => {
    if (!connection.connected || busy) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void verifyConnectedPortStillPresent();
    }, 2000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [connection.connected, connection.portName, busy]);

  useEffect(() => {
    const client = clientRef.current;
    void client.start((line) => {
      setLogLines((current) => [...current.slice(-119), formatLogLine(line.raw)]);
    });

    void refreshPorts();
    void syncConnectionStatus();

    return () => {
      void client.stop();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadManual() {
      setManualLoading(true);
      try {
        const content = await clientRef.current.getManualContent(language);
        if (!cancelled) {
          setManualContent(content);
        }
      } catch (error) {
        if (!cancelled) {
          setManualContent("");
          appendError(error);
        }
      } finally {
        if (!cancelled) {
          setManualLoading(false);
        }
      }
    }

    void loadManual();

    return () => {
      cancelled = true;
    };
  }, [language]);

  async function refreshPorts() {
    try {
      const availablePorts = await clientRef.current.listPorts();
      setPorts(availablePorts);
      setSelectedPort((current) => {
        if (current && availablePorts.includes(current)) {
          return current;
        }
        return availablePorts[0] ?? "";
      });
    } catch (error) {
      appendError(error);
    }
  }

  async function verifyConnectedPortStillPresent() {
    try {
      const availablePorts = await clientRef.current.listPorts();
      setPorts(availablePorts);

      if (connection.connected && connection.portName && !availablePorts.includes(connection.portName)) {
        await handleConnectionLost(`controller on '${connection.portName}' was disconnected`);
      }
    } catch (error) {
      appendError(error);
    }
  }

  async function syncConnectionStatus() {
    try {
      const status = await clientRef.current.getConnectionStatus();
      setConnection(status);
      if (status.portName) {
        setSelectedPort(status.portName);
      }
    } catch (error) {
      appendError(error);
    }
  }

  function appendError(error: unknown) {
    const message = getErrorMessage(error);
    setLogLines((current) => [...current.slice(-119), formatLogLine(`ERR ${message}`)]);
  }

  async function handleConnectionLost(reason: string) {
    if (!connection.connected) {
      return;
    }

    try {
      await clientRef.current.disconnect();
    } catch {
      // Ignore cleanup failures if the device is already gone.
    }

    setConnection(INITIAL_CONNECTION);
    setDiagnostics(DEFAULT_DIAGNOSTICS);
    setBootCalibrationPendingReboot(false);
    setLogLines((current) => [
      ...current.slice(-119),
      formatLogLine(`INFO Connection lost: ${reason}`),
    ]);

    try {
      const availablePorts = await clientRef.current.listPorts();
      setPorts(availablePorts);
      setSelectedPort((current) => {
        if (current && availablePorts.includes(current)) {
          return current;
        }
        return availablePorts[0] ?? "";
      });
    } catch {
      // Ignore follow-up refresh errors.
    }
  }

  function updateConfigDraft<K extends keyof ConfigSnapshot>(key: K, value: ConfigSnapshot[K]) {
    setDraftConfig((current) => ({ ...current, [key]: value }));
    if (key === "pattern") {
      const patternId = value as number;
      setPatterns((current) =>
        current.map((pattern) => ({
          ...pattern,
          active: pattern.id === patternId,
        })),
      );
    }
  }

  function mergeConfig(nextConfig: ConfigSnapshot) {
    setConfig(nextConfig);
    setDraftConfig(nextConfig);
    setPatterns((current) => {
      if (current.length === 0) {
        return createFallbackPatternStates(nextConfig.pattern, nextConfig.enabledPatterns);
      }
      return current.map((pattern) => ({
        ...pattern,
        enabled: nextConfig.enabledPatterns.includes(pattern.id),
        active: pattern.id === nextConfig.pattern,
      }));
    });
  }

  async function readConfig() {
    const line = await clientRef.current.runSimpleCommand("show");
    const nextConfig = configFromCliLine(line, config);
    mergeConfig(nextConfig);
    return nextConfig;
  }

  async function readPatterns(nextConfig = config) {
    const line = await clientRef.current.runSimpleCommand("patterns");
    setPatterns(patternStatesFromCliLine(line, nextConfig.pattern, nextConfig.enabledPatterns));
  }

  async function readBattery() {
    const line = await clientRef.current.runSimpleCommand("battery");
    setDiagnostics((current) => batteryDiagnosticsFromCliLine(line, current));
  }

  async function readSensor() {
    const line = await clientRef.current.runSimpleCommand("sensor");
    setDiagnostics((current) => sensorDiagnosticsFromCliLine(line, current));
  }

  async function readTiming() {
    const line = await clientRef.current.runSimpleCommand("timing");
    setDiagnostics((current) => timingDiagnosticsFromCliLine(line, current));
  }

  async function readOffsets() {
    const line = await clientRef.current.runSimpleCommand("offsets");
    setDiagnostics((current) => offsetsDiagnosticsFromCliLine(line, current));
  }

  async function readAll() {
    const nextConfig = await readConfig();
    await readPatterns(nextConfig);
    await readBattery();
    await readSensor();
    await readTiming();
    await readOffsets();
  }

  async function readAllWithRetries(attempts: number, retryDelayMs: number) {
    let lastError: unknown = null;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        await readAll();
        return;
      } catch (error) {
        lastError = error;
        if (attempt < attempts - 1) {
          await delay(retryDelayMs);
        }
      }
    }

    throw lastError;
  }

  async function withBusy(work: () => Promise<void>) {
    setBusy(true);
    try {
      await work();
    } catch (error) {
      appendError(error);
      const message = getErrorMessage(error);
      if (connection.connected && isLikelyConnectionLoss(message)) {
        await handleConnectionLost(message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleConnect() {
    await withBusy(async () => {
      const status = await clientRef.current.connect(selectedPort);
      setConnection(status);
      await delay(1800);
      await readAllWithRetries(4, 900);
      setBootCalibrationPendingReboot(false);
    });
  }

  async function handleDisconnect() {
    await withBusy(async () => {
      const status = await clientRef.current.disconnect();
      setConnection(status);
      setDiagnostics(DEFAULT_DIAGNOSTICS);
    });
  }

  async function handleApplyConfig() {
    await withBusy(async () => {
      if (draftConfig.pattern !== config.pattern) {
        const line = await clientRef.current.runSimpleCommand(`set pattern ${draftConfig.pattern}`);
        mergeConfig(configFromCliLine(parseCliLine(`OK pattern=${line.values.pattern ?? draftConfig.pattern}`), draftConfig));
      }
      if (draftConfig.stripLength !== config.stripLength) {
        await clientRef.current.runSimpleCommand(`set strip_length ${draftConfig.stripLength}`);
      }
      if (draftConfig.smoothing !== config.smoothing) {
        await clientRef.current.runSimpleCommand(`set smoothing ${draftConfig.smoothing}`);
      }
      if (draftConfig.accelRange !== config.accelRange) {
        await clientRef.current.runSimpleCommand(`set accel_range ${draftConfig.accelRange}`);
      }
      if (draftConfig.gyroRange !== config.gyroRange) {
        await clientRef.current.runSimpleCommand(`set gyro_range ${draftConfig.gyroRange}`);
      }
      if (draftConfig.bootCalibration !== config.bootCalibration) {
        await clientRef.current.runSimpleCommand(`set boot_calibration ${draftConfig.bootCalibration}`);
        setBootCalibrationPendingReboot(true);
      }
      await readAll();
    });
  }

  async function handleLiveBrightnessChange(value: number) {
    updateConfigDraft("brightness", value);
    await withBusy(async () => {
      const line = await clientRef.current.runSimpleCommand(`set brightness ${value}`);
      const nextConfig = configFromCliLine(line, { ...config, brightness: value });
      mergeConfig(nextConfig);
    });
  }

  async function handleSave() {
    await withBusy(async () => {
      await clientRef.current.runSimpleCommand("save");
      await readAll();
    });
  }

  async function handleLoad() {
    await withBusy(async () => {
      await clientRef.current.runSimpleCommand("load");
      setBootCalibrationPendingReboot(false);
      await readAll();
    });
  }

  async function handleDefaults() {
    await withBusy(async () => {
      await clientRef.current.runSimpleCommand("defaults");
      setBootCalibrationPendingReboot(true);
      await readAll();
    });
  }

  async function handleReadDevice() {
    await withBusy(async () => {
      await readAll();
    });
  }

  function handleTogglePattern(patternId: number) {
    setPatterns((current) => {
      const enabledCount = current.filter((pattern) => pattern.enabled).length;
      return current.map((pattern) => {
        if (pattern.id !== patternId) {
          return pattern;
        }
        if (pattern.enabled && enabledCount === 1) {
          return pattern;
        }
        return { ...pattern, enabled: !pattern.enabled };
      });
    });
  }

  function handleSetActivePattern(patternId: number) {
    setDraftConfig((current) => ({ ...current, pattern: patternId }));
    setPatterns((current) =>
      current.map((pattern) => ({
        ...pattern,
        active: pattern.id === patternId,
      })),
    );
  }

  async function handleApplyPatterns() {
    await withBusy(async () => {
      const desiredEnabled = patterns.filter((pattern) => pattern.enabled).map((pattern) => pattern.id);
      if (desiredEnabled.length === 0) {
        throw new Error("At least one pattern must remain enabled");
      }

      const currentlyEnabled = new Set(config.enabledPatterns);
      const desiredEnabledSet = new Set(desiredEnabled);

      const toEnable = desiredEnabled.filter((patternId) => !currentlyEnabled.has(patternId));
      const toDisable = config.enabledPatterns.filter((patternId) => !desiredEnabledSet.has(patternId));

      if (toEnable.length > 0) {
        await clientRef.current.runSimpleCommand(`enable_pattern ${toEnable.join(",")}`);
      }
      if (toDisable.length > 0) {
        await clientRef.current.runSimpleCommand(`disable_pattern ${toDisable.join(",")}`);
      }
      if (draftConfig.pattern !== config.pattern) {
        await clientRef.current.runSimpleCommand(`set pattern ${draftConfig.pattern}`);
      }
      await readAll();
    });
  }

  function handleEnableAllPatterns() {
    setPatterns((current) => current.map((pattern) => ({ ...pattern, enabled: true })));
  }

  async function handleActivatePattern(patternId: number) {
    await withBusy(async () => {
      const line = await clientRef.current.runSimpleCommand(`set pattern ${patternId}`);
      const nextConfig = configFromCliLine(line, config);
      mergeConfig(nextConfig);
      await readPatterns(nextConfig);
    });
  }

  async function handleQuickCalibration() {
    await withBusy(async () => {
      await clientRef.current.runCalibration("quick");
      await readOffsets();
    });
  }

  async function handlePreciseCalibration() {
    await withBusy(async () => {
      await clientRef.current.runCalibration("precise");
      await readOffsets();
    });
  }

  async function handleReboot() {
    await withBusy(async () => {
      await executeRebootCommand("reboot");
    });
  }

  async function handleRestartAlias() {
    await withBusy(async () => {
      await executeRebootCommand("restart");
    });
  }

  async function executeRebootCommand(command: "reboot" | "restart") {
    await clientRef.current.runSimpleCommand(command, 8000);
    await clientRef.current.disconnect();
    setConnection(INITIAL_CONNECTION);
    setDiagnostics(DEFAULT_DIAGNOSTICS);
    setBootCalibrationPendingReboot(false);
      setLogLines((current) => [
        ...current.slice(-119),
        formatLogLine(`INFO ${command} requested; reconnect after the controller restarts.`),
      ]);
    await delay(1500);
    await refreshPorts();
  }

  async function handleHelp() {
    await withBusy(async () => {
      await clientRef.current.runTextCommand("help", 4000);
    });
  }

  async function handleReadSingleKey(key: string) {
    await withBusy(async () => {
      const line = await clientRef.current.runSimpleCommand(`get ${key}`);
      if (
        key === "enabled_patterns" ||
        key === "pattern" ||
        key === "brightness" ||
        key === "strip_length" ||
        key === "smoothing" ||
        key === "accel_range" ||
        key === "gyro_range" ||
        key === "boot_calibration"
      ) {
        const nextConfig = configFromCliLine(line, config);
        mergeConfig(nextConfig);
      }
    });
  }

  async function handleRunCommand() {
    const command = commandDraft.trim();
    if (!command) {
      return;
    }

    await withBusy(async () => {
      setLogLines((current) => [...current.slice(-119), formatLogLine(`> ${command}`)]);

      if (command === "help") {
        await clientRef.current.runTextCommand(command, 4000);
        return;
      }

      if (command === "reboot" || command === "restart") {
        await executeRebootCommand(command);
        return;
      }

      if (command === "load") {
        await clientRef.current.runSimpleCommand(command);
        setBootCalibrationPendingReboot(false);
        await readAll();
        return;
      }

      if (command === "defaults") {
        await clientRef.current.runSimpleCommand(command);
        setBootCalibrationPendingReboot(true);
        await readAll();
        return;
      }

      if (command === "sensor") {
        await readSensor();
        return;
      }
      if (command === "battery") {
        await readBattery();
        return;
      }
      if (command === "timing") {
        await readTiming();
        return;
      }
      if (command === "offsets") {
        await readOffsets();
        return;
      }
      if (command === "show") {
        await readConfig();
        return;
      }
      if (command === "patterns") {
        await readPatterns(draftConfig);
        return;
      }

      if (command.startsWith("calibrate ")) {
        const mode = command.slice("calibrate ".length).trim();
        if (mode === "quick" || mode === "precise") {
          await clientRef.current.runCalibration(mode);
          await readOffsets();
          return;
        }
      }

      const line = await clientRef.current.runSimpleCommand(command);
      if (
        command.startsWith("get ") ||
        command.startsWith("set ") ||
        command === "save"
      ) {
        const nextConfig = configFromCliLine(line, config);
        mergeConfig(nextConfig);

        if (command.startsWith("set boot_calibration ")) {
          setBootCalibrationPendingReboot(true);
        }
        if (command.startsWith("set smoothing ") || command.startsWith("set accel_range ") || command.startsWith("set gyro_range ")) {
          await readSensor();
        }
        if (command === "save") {
          await readAll();
        }
      }
      if (command.startsWith("enable_pattern ") || command.startsWith("disable_pattern ")) {
        await readAll();
      }
    });
  }

  const calibrationLogLines = useMemo(() => logLines.slice(-14), [logLines]);

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">NightKite</p>
          <h1>Configurator</h1>
          <p className="hero-copy">
            {text.heroCopy}
          </p>
        </div>
      </header>

      <section className="layout-grid">
        <ConnectionPanel
          ports={ports}
          selectedPort={selectedPort}
          connected={connection.connected}
          helpTooltip={text.connection.sectionHelp}
          labels={text.connection}
          onSelectedPortChange={setSelectedPort}
          onRefreshPorts={() => {
            void refreshPorts();
          }}
          onConnect={() => {
            void handleConnect();
          }}
          onDisconnect={() => {
            void handleDisconnect();
          }}
          busy={busy}
        />
        <ConfigPanel
          config={draftConfig}
          connected={connection.connected}
          busy={busy}
          rebootRequiredReasons={rebootRequiredReasons}
          helpTooltip={text.config.sectionHelp}
          labels={text.config}
          onChange={updateConfigDraft}
          onLiveBrightnessChange={(value) => {
            void handleLiveBrightnessChange(value);
          }}
          onReadDevice={() => {
            void handleReadDevice();
          }}
          onApplyChanges={() => {
            void handleApplyConfig();
          }}
          onSave={() => {
            void handleSave();
          }}
          onLoad={() => {
            void handleLoad();
          }}
          onDefaults={() => {
            void handleDefaults();
          }}
        />
        <OptionsPanel
          connected={connection.connected}
          busy={busy}
          language={language}
          autoRefreshEnabled={autoRefreshEnabled}
          autoRefreshSeconds={autoRefreshSeconds}
          helpTooltip={text.options.sectionHelp}
          onLanguageChange={setLanguage}
          onAutoRefreshEnabledChange={setAutoRefreshEnabled}
          onAutoRefreshSecondsChange={(seconds) => {
            setAutoRefreshSeconds(Number.isFinite(seconds) ? Math.max(2, Math.min(300, seconds)) : 10);
          }}
          labels={text.options}
        />
        <PatternsPanel
          patterns={patterns.map((pattern) => ({
            ...pattern,
            active: pattern.id === activePatternId,
          }))}
          connected={connection.connected}
          busy={busy}
          helpTooltip={text.patterns.sectionHelp}
          labels={text.patterns}
          onToggleEnabled={handleTogglePattern}
          onSetActive={(patternId) => {
            void handleActivatePattern(patternId);
          }}
          onRefresh={() => {
            void withBusy(async () => {
              await readPatterns(draftConfig);
            });
          }}
          onApply={() => {
            void handleApplyPatterns();
          }}
          onEnableAll={handleEnableAllPatterns}
        />
        <DiagnosticsPanel
          diagnostics={diagnostics}
          connected={connection.connected}
          busy={busy}
          helpTooltip={text.diagnostics.sectionHelp}
          labels={text.diagnostics}
          onBattery={() => {
            void withBusy(async () => {
              await readBattery();
            });
          }}
          onSensor={() => {
            void withBusy(async () => {
              await readSensor();
            });
          }}
          onTiming={() => {
            void withBusy(async () => {
              await readTiming();
            });
          }}
          onOffsets={() => {
            void withBusy(async () => {
              await readOffsets();
            });
          }}
        />
        <CalibrationPanel
          connected={connection.connected}
          busy={busy}
          helpTooltip={text.calibration.sectionHelp}
          labels={text.calibration}
          onQuickCalibration={() => {
            void handleQuickCalibration();
          }}
          onPreciseCalibration={() => {
            void handlePreciseCalibration();
          }}
          onReboot={() => {
            void handleReboot();
          }}
          onRestart={() => {
            void handleRestartAlias();
          }}
          onHelp={() => {
            void handleHelp();
          }}
          onReadKey={(key) => {
            void handleReadSingleKey(key);
          }}
          selectedGetKey={selectedGetKey}
          onSelectedGetKeyChange={setSelectedGetKey}
          commandDraft={commandDraft}
          onCommandDraftChange={setCommandDraft}
          onRunCommand={() => {
            void handleRunCommand();
          }}
          logLines={calibrationLogLines}
        />
        <ManualPanel
          title={text.manual.title}
          subtitle={text.manual.subtitle}
          content={manualContent}
          loading={manualLoading}
          loadingText={text.manual.loading}
          emptyText={text.manual.empty}
          helpTooltip={text.manual.sectionHelp}
        />
      </section>
    </main>
  );
}

const translations = {
  de: {
    heroCopy:
      "Konfiguriere den Controller über die vorhandene USB-CLI, ohne die Firmware anfassen zu müssen. Die App spricht direkt mit der seriellen Schnittstelle und wertet die Live-Antworten der Firmware aus.",
    connection: {
      title: "Verbindung",
      connected: "Verbunden",
      disconnected: "Getrennt",
      serialPort: "Serieller Port",
      noSerialPorts: "Keine seriellen Ports gefunden",
      refreshPorts: "Ports aktualisieren",
      connect: "Verbinden",
      disconnect: "Trennen",
      serialPortHint: "Wählt den USB-Seriell-Port des angeschlossenen NightKite-Controllers aus.",
      refreshPortsHint: "Liest die aktuell verfügbaren seriellen Ports vom System neu ein.",
      connectHint: "Öffnet die serielle Verbindung zum ausgewählten Controller und liest danach die Live-Daten ein.",
      disconnectHint: "Schließt die serielle Verbindung zur Hardware.",
      sectionHelp:
        "Verbindung zum NightKite-Controller. Hier wählst du den seriellen Port, aktualisierst die Portliste, verbindest die App mit der Hardware oder trennst sie wieder. Der Status zeigt, ob aktuell eine aktive serielle Sitzung besteht.",
    },
    config: {
      title: "Konfiguration",
      subtitle: "Live-Firmware-Werte",
      rebootRequired: "Neustart nötig für",
      activePattern: "Aktives Pattern",
      brightness: "Helligkeit",
      stripLength: "Strip-Länge",
      smoothing: "Smoothing",
      accelRange: "Accel-Range",
      gyroRange: "Gyro-Range",
      bootCalibration: "Boot-Kalibrierung",
      readDevice: "Controller lesen",
      applyChanges: "Änderungen anwenden",
      saveToDevice: "Auf Controller speichern",
      loadSaved: "Gespeichertes laden",
      defaults: "Standardwerte",
      activePatternHint: "Setzt die numerische ID des aktuell aktiven Patterns auf dem Controller.",
      brightnessHint: "Ändert die Helligkeit sofort live auf der Hardware.",
      stripLengthHint: "Legt fest, für wie viele LEDs die Firmware rechnet.",
      smoothingHint: "Bestimmt die Stärke der Bewegungsglättung. Greift erst nach Neustart vollständig.",
      accelRangeHint: "Wählt den Beschleunigungsbereich des Sensors. Greift erst nach Neustart vollständig.",
      gyroRangeHint: "Wählt den Gyrobereich des Sensors. Greift erst nach Neustart vollständig.",
      bootCalibrationHint: "Legt fest, ob beim Start automatisch kalibriert wird.",
      readDeviceHint: "Liest die aktuelle Konfiguration und alle Diagnosewerte erneut vom Controller.",
      applyChangesHint: "Schreibt die geänderten Konfigurationswerte direkt in die laufende Firmware.",
      saveToDeviceHint: "Speichert die aktuelle Konfiguration dauerhaft im Flash des Controllers.",
      loadSavedHint: "Lädt die zuletzt gespeicherte Konfiguration aus dem Controller.",
      defaultsHint: "Setzt die Firmware auf ihre Standardwerte zurück.",
      sectionHelp:
        "Laufende Firmware-Konfiguration. Active Pattern und Helligkeit beeinflussen die Hardware direkt, während Strip-Länge, Smoothing, Sensorbereiche und Boot-Kalibrierung die Gerätekonfiguration steuern. Mit Controller lesen, Änderungen anwenden, Speichern, Laden und Standardwerte steuerst du das Übernehmen und Sichern der Werte.",
    },
    options: {
      title: "Optionen",
      subtitle: "App-Verhalten",
      language: "Sprache",
      autoRefresh: "Auto-Refresh",
      refreshInterval: "Refresh-Intervall",
      languageDe: "Deutsch",
      languageEn: "Englisch",
      autoRefreshOn: "Ein",
      autoRefreshOff: "Aus",
      secondsSuffix: "Sekunden",
      languageHint: "Schaltet die Oberfläche und die eingebundene Anleitung zwischen Deutsch und Englisch um.",
      autoRefreshHint: "Aktualisiert die Live-Werte automatisch in einem festen Intervall.",
      refreshIntervalHint: "Legt fest, wie oft der automatische Refresh ausgeführt wird.",
      sectionHelp:
        "App-Optionen. Hier stellst du die Sprache der Oberfläche und der eingebundenen Anleitung um, aktivierst den automatischen Refresh der Live-Daten und bestimmst das Zeitintervall dafür.",
    },
    patterns: {
      title: "Patterns",
      subtitle: "Button-Zyklusfilter",
      enabled: "Aktiv",
      disabled: "Aus",
      active: "Live",
      includeInCycle: "Im Button-Zyklus",
      makeActive: "Aktivieren",
      enableAll: "Alle aktivieren",
      readPatternList: "Pattern-Liste lesen",
      applySelection: "Auswahl anwenden",
      includeInCycleHint: "Legt fest, ob dieses Pattern per Button-Zyklus auf der Hardware erreichbar ist.",
      makeActiveHint: "Schaltet dieses Pattern sofort live auf der Hardware aktiv.",
      enableAllHint: "Markiert alle Patterns als im Button-Zyklus verfügbar.",
      readPatternListHint: "Liest den aktuellen Pattern-Status erneut vom Controller.",
      applySelectionHint: "Überträgt die aktuelle Pattern-Auswahl auf die Hardware.",
      sectionHelp:
        "Pattern-Verwaltung. Jede Zeile zeigt ein Firmware-Pattern mit ID, Namen, Aktiv-Status und Auswahl für den Button-Zyklus. Du kannst einzelne Patterns in den Zyklus aufnehmen oder entfernen, ein Pattern sofort live aktivieren, alle aktivieren, die aktuelle Liste neu lesen oder die Auswahl gesammelt anwenden.",
    },
    diagnostics: {
      title: "Diagnose",
      subtitle: "Live-Gerätestatus",
      battery: "Akku",
      raw: "raw",
      refresh: "Refresh",
      usbPower: "USB Power",
      serialSession: "Serielle Sitzung",
      online: "Online",
      offline: "Offline",
      active: "Aktiv",
      idle: "Idle",
      sensorState: "Sensorstatus",
      timing: "Timing",
      offsets: "Offsets",
      smoothingCfgActive: "Smoothing cfg / active",
      accelCfgActive: "Accel cfg / active",
      gyroCfgActive: "Gyro cfg / active",
      noSensorData: "Noch keine Sensordaten",
      noTimingData: "Noch keine Timingdaten",
      noOffsetData: "Noch keine Offsetdaten",
      packetSize: "Packet Size",
      activeAccel: "Active Accel",
      activeGyro: "Active Gyro",
      smoothing: "Smoothing",
      refreshBatteryHint: "Liest Batteriewert und USB-Status erneut von der Hardware.",
      refreshSensorHint: "Liest den Sensorstatus und die aktiven IMU-Einstellungen erneut ein.",
      refreshTimingHint: "Liest die aktuellen Laufzeit- und Frame-Timing-Werte erneut ein.",
      refreshOffsetsHint: "Liest die aktuell gespeicherten Sensor-Offsets erneut vom Controller.",
      sectionHelp:
        "Diagnoseübersicht der Hardware. Akku zeigt Spannung und Rohwert, USB Power und serielle Sitzung den aktuellen Verbindungsstatus. Sensor State zeigt MPU-, DMP- und Gerätestatus samt aktiven IMU-Werten. Timing listet Loop- und Arbeitszeiten, Offsets zeigt die aktuellen Kalibrierwerte. Die Refresh-Buttons lesen den jeweiligen Bereich gezielt neu ein.",
    },
    calibration: {
      title: "Kalibrierung",
      subtitle: "Sensor-Wartung",
      quickCalibration: "Quick-Kalibrierung",
      preciseCalibration: "Präzise Kalibrierung",
      rebootDevice: "Gerät neu starten",
      restartAlias: "Restart Alias",
      showCliHelp: "CLI-Hilfe anzeigen",
      readSingleCliKey: "Einzelnen CLI-Key lesen",
      runGet: "Get ausführen",
      cliTerminal: "CLI-Terminal",
      send: "Senden",
      terminalPlaceholder: "help, get pattern, set brightness 127, patterns, calibrate quick",
      quickCalibrationHint: "Startet die schnelle Sensor-Kalibrierung und liest danach die Offsets neu ein.",
      preciseCalibrationHint: "Startet die präzisere, längere Sensor-Kalibrierung.",
      rebootDeviceHint: "Sendet den Reboot-Befehl an den Controller. Danach muss neu verbunden werden.",
      restartAliasHint: "Sendet den alternativen Neustart-Befehl `restart` an die Firmware.",
      showCliHelpHint: "Liest die komplette CLI-Hilfe direkt aus der Firmware aus.",
      readSingleCliKeyHint: "Liest einen einzelnen Firmware-Wert über `get <key>` aus.",
      runGetHint: "Führt den ausgewählten `get`-Befehl aus.",
      cliTerminalHint: "Sendet einen freien CLI-Befehl direkt an den Controller und zeigt die Antwort im Terminal an.",
      sendHint: "Schickt den aktuell eingegebenen CLI-Befehl an die Hardware.",
      sectionHelp:
        "Werkzeuge für Wartung und direkte CLI-Arbeit. Hier startest du die schnelle oder präzise Kalibrierung, rebootest den Controller, rufst die CLI-Hilfe ab, liest einzelne Keys per `get` aus und sendest freie Befehle im Terminal. Das Terminal zeigt die letzten Antworten der Firmware mit Zeitstempel und scrollt automatisch nach unten.",
    },
    manual: {
      title: "Anleitung",
      subtitle: "Eingebundene Controller-Dokumentation",
      loading: "Anleitung wird geladen...",
      empty: "Keine Anleitung verfügbar.",
      sectionHelp:
        "Eingebundene Dokumentation des Controllers. Dieser Bereich zeigt automatisch die deutsche oder englische Anleitung passend zur in der App gewählten Sprache. So kannst du Funktionen, CLI-Befehle und Bedienhinweise direkt in der App nachlesen.",
    },
  },
  en: {
    heroCopy:
      "Configure the controller over the existing USB CLI without touching firmware code. The app talks directly to the serial interface and parses the live firmware replies.",
    connection: {
      title: "Connection",
      connected: "Connected",
      disconnected: "Disconnected",
      serialPort: "Serial Port",
      noSerialPorts: "No serial ports found",
      refreshPorts: "Refresh Ports",
      connect: "Connect",
      disconnect: "Disconnect",
      serialPortHint: "Selects the USB serial port of the connected NightKite controller.",
      refreshPortsHint: "Reloads the currently available serial ports from the system.",
      connectHint: "Opens the serial connection to the selected controller and then reads live device data.",
      disconnectHint: "Closes the serial connection to the hardware.",
      sectionHelp:
        "Connection to the NightKite controller. Use this area to choose the serial port, refresh the port list, connect the app to the hardware, or disconnect again. The status indicator shows whether an active serial session currently exists.",
    },
    config: {
      title: "Configuration",
      subtitle: "Live firmware settings",
      rebootRequired: "Reboot required for",
      activePattern: "Active Pattern",
      brightness: "Brightness",
      stripLength: "Strip Length",
      smoothing: "Smoothing",
      accelRange: "Accel Range",
      gyroRange: "Gyro Range",
      bootCalibration: "Boot Calibration",
      readDevice: "Read Device",
      applyChanges: "Apply Changes",
      saveToDevice: "Save to Device",
      loadSaved: "Load Saved",
      defaults: "Defaults",
      activePatternHint: "Sets the numeric ID of the currently active pattern on the controller.",
      brightnessHint: "Changes brightness immediately on the live hardware.",
      stripLengthHint: "Defines how many LEDs the firmware should drive.",
      smoothingHint: "Controls motion smoothing strength. Fully applies after reboot.",
      accelRangeHint: "Selects the accelerometer range. Fully applies after reboot.",
      gyroRangeHint: "Selects the gyroscope range. Fully applies after reboot.",
      bootCalibrationHint: "Controls whether calibration runs automatically at boot.",
      readDeviceHint: "Reads configuration and diagnostics again from the controller.",
      applyChangesHint: "Writes the changed configuration values into the running firmware.",
      saveToDeviceHint: "Stores the current configuration persistently in controller flash.",
      loadSavedHint: "Loads the last saved configuration from the controller.",
      defaultsHint: "Resets firmware settings back to their defaults.",
      sectionHelp:
        "Running firmware configuration. Active Pattern and Brightness affect the hardware immediately, while Strip Length, Smoothing, sensor ranges, and Boot Calibration control device behavior. Read Device, Apply Changes, Save, Load, and Defaults handle refreshing, applying, and storing those values.",
    },
    options: {
      title: "Options",
      subtitle: "App behavior",
      language: "Language",
      autoRefresh: "Auto Refresh",
      refreshInterval: "Refresh Interval",
      languageDe: "German",
      languageEn: "English",
      autoRefreshOn: "On",
      autoRefreshOff: "Off",
      secondsSuffix: "seconds",
      languageHint: "Switches the UI and embedded manual between German and English.",
      autoRefreshHint: "Refreshes live values automatically on a fixed interval.",
      refreshIntervalHint: "Defines how often automatic refresh should run.",
      sectionHelp:
        "Application options. This section switches the UI language and embedded manual language, enables automatic live refresh, and defines the refresh interval.",
    },
    patterns: {
      title: "Patterns",
      subtitle: "Button cycling filter",
      enabled: "Enabled",
      disabled: "Disabled",
      active: "Active",
      includeInCycle: "Include in button cycle",
      makeActive: "Make Active",
      enableAll: "Enable All",
      readPatternList: "Read Pattern List",
      applySelection: "Apply Selection",
      includeInCycleHint: "Controls whether this pattern is reachable through hardware button cycling.",
      makeActiveHint: "Makes this pattern live on the hardware immediately.",
      enableAllHint: "Marks all patterns as available in the button cycle.",
      readPatternListHint: "Reads the current pattern state again from the controller.",
      applySelectionHint: "Transfers the current pattern selection to the hardware.",
      sectionHelp:
        "Pattern management. Each row shows one firmware pattern with its ID, name, active state, and button-cycle inclusion. You can include or exclude patterns from the hardware button cycle, make one pattern live immediately, enable all, reread the list, or apply the current selection in one step.",
    },
    diagnostics: {
      title: "Diagnostics",
      subtitle: "Live device status",
      battery: "Battery",
      raw: "raw",
      refresh: "Refresh",
      usbPower: "USB Power",
      serialSession: "Serial Session",
      online: "Online",
      offline: "Offline",
      active: "Active",
      idle: "Idle",
      sensorState: "Sensor State",
      timing: "Timing",
      offsets: "Offsets",
      smoothingCfgActive: "Smoothing cfg / active",
      accelCfgActive: "Accel cfg / active",
      gyroCfgActive: "Gyro cfg / active",
      noSensorData: "No sensor data yet",
      noTimingData: "No timing data yet",
      noOffsetData: "No offset data yet",
      packetSize: "Packet Size",
      activeAccel: "Active Accel",
      activeGyro: "Active Gyro",
      smoothing: "Smoothing",
      refreshBatteryHint: "Reads battery level and USB power state from the hardware again.",
      refreshSensorHint: "Reads sensor status and active IMU settings again.",
      refreshTimingHint: "Reads current loop and frame timing metrics again.",
      refreshOffsetsHint: "Reads the currently stored sensor offsets from the controller again.",
      sectionHelp:
        "Hardware diagnostics overview. Battery shows voltage and raw value, USB Power and Serial Session show the current connection state. Sensor State shows MPU, DMP, device state, and active IMU values. Timing lists loop and work timing metrics, and Offsets shows the current calibration values. Each Refresh button reloads only its own section.",
    },
    calibration: {
      title: "Calibration",
      subtitle: "Sensor maintenance",
      quickCalibration: "Quick Calibration",
      preciseCalibration: "Precise Calibration",
      rebootDevice: "Reboot Device",
      restartAlias: "Restart Alias",
      showCliHelp: "Show CLI Help",
      readSingleCliKey: "Read Single CLI Key",
      runGet: "Run get",
      cliTerminal: "CLI Terminal",
      send: "Send",
      terminalPlaceholder: "help, get pattern, set brightness 127, patterns, calibrate quick",
      quickCalibrationHint: "Starts the quick sensor calibration and then refreshes offsets.",
      preciseCalibrationHint: "Starts the slower, more precise sensor calibration.",
      rebootDeviceHint: "Sends the reboot command to the controller. You will need to reconnect afterwards.",
      restartAliasHint: "Sends the alternate `restart` reboot alias to the firmware.",
      showCliHelpHint: "Reads the complete CLI help text directly from firmware.",
      readSingleCliKeyHint: "Reads a single firmware value using `get <key>`.",
      runGetHint: "Runs the selected `get` command.",
      cliTerminalHint: "Sends any CLI command directly to the controller and prints the reply in the terminal.",
      sendHint: "Sends the currently entered CLI command to the hardware.",
      sectionHelp:
        "Maintenance and direct CLI tools. Use this area to start quick or precise calibration, reboot the controller, fetch CLI help, read individual keys with `get`, and send free-form commands in the terminal. The terminal shows the latest firmware replies with timestamps and auto-scrolls as new lines arrive.",
    },
    manual: {
      title: "Manual",
      subtitle: "Embedded controller documentation",
      loading: "Loading manual...",
      empty: "No manual available.",
      sectionHelp:
        "Embedded controller documentation. This panel automatically shows the German or English manual based on the language currently selected in the app, so you can read command and usage details without leaving the configurator.",
    },
  },
} satisfies Record<AppLanguage, any>;
