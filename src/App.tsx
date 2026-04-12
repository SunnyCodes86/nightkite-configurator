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

const PATTERN_VIEW_MODE_KEY = "nightkite.patternViewMode";
const LOCALIZED_PATTERN_DESCRIPTIONS: Record<
  AppLanguage,
  Record<number, string>
> = {
  de: {
    1: "Klassischer Regenbogenverlauf über beide Strips.",
    2: "Beide Strips in einer festen Vollfarbe.",
    3: "Die Helligkeit folgt direkt der Bewegung.",
    4: "Ein einzelner Lichtläufer mit fixer Richtung.",
    5: "Reaktiver Läufer, der auf Bewegung anspringt.",
    6: "Zwei parallele Läufer mit getrennter Farbe.",
    7: "Pulsierender Herzschlag-Look über beide Strips.",
    8: "Ein Lichtpunkt läuft wie beim Ping Pong hin und her.",
    9: "Mehrere Kometen ziehen gleichzeitig über den Strip.",
    10: "Weiche Atembewegung mit sturmartigem Farbspiel.",
    11: "Wellenimpuls, der durch ruckartige Bewegung getriggert wird.",
    12: "Rotierender Farbspinner auf Basis des Yaw-Winkels.",
    13: "Yaw-Spinner mit ringartiger Kreisbewegung.",
    14: "Doppelläufer mit invertierter Bewegungsrichtung.",
    15: "Sanft fließende Farbpaletten mit Beat und Bewegung.",
    16: "Ozeanisch fließendes Wellenpattern mit Yaw-Farbsteuerung.",
    17: "Funkelnde Lichter, die auf Bewegung reagieren.",
    18: "Feuerähnlicher Strahl mit reaktiver Flammendynamik.",
    19: "Weicher Farbnebel aus langsam driftendem Noise.",
    20: "Schillernde Pride-Wellen mit Yaw-abhängiger Farbe.",
    21: "Konfetti-Bursts bei Bewegungsspitzen und kleinen Ruckern.",
    22: "Von der Mitte ausgehende Ripple-Welle über beide Strips.",
  },
  en: {
    1: "Classic rainbow gradient across both strips.",
    2: "Both strips shown in one solid color.",
    3: "Brightness responds directly to motion.",
    4: "Single runner with a fixed travel direction.",
    5: "Reactive runner that wakes up with motion.",
    6: "Two parallel runners with separate colors.",
    7: "Heartbeat-style pulse across both strips.",
    8: "A light point bounces back and forth like ping pong.",
    9: "Multiple comets travel across the strip at once.",
    10: "Soft breathing motion with storm-like color flow.",
    11: "Wave pulse triggered by sudden motion changes.",
    12: "Rotating color spinner driven by yaw angle.",
    13: "Yaw spinner with a circular ring-like motion.",
    14: "Dual runner with inverted motion direction.",
    15: "Smooth flowing color palettes with beat and motion.",
    16: "Ocean-like wave pattern with yaw-controlled color.",
    17: "Twinkling lights reacting to movement.",
    18: "Fire-like jet with reactive flame dynamics.",
    19: "Soft color mist built from slowly drifting noise.",
    20: "Shimmering pride waves with yaw-driven color.",
    21: "Confetti bursts on motion spikes and little jerks.",
    22: "Center-out ripple wave expanding across both strips.",
  },
};
const LOCALIZED_PATTERN_NAMES: Record<
  AppLanguage,
  Record<number, string>
> = {
  de: {
    1: "Regenbogen",
    2: "Vollfarbe",
    3: "Bewegungshelligkeit",
    4: "Läufer fix",
    5: "Läufer reaktiv",
    6: "Doppelläufer",
    7: "Herzschlag",
    8: "Ping Pong",
    9: "Kometenschwarm",
    10: "Atemsturm",
    11: "Ruckwelle",
    12: "Yaw-Spinner",
    13: "Yaw-Spinner Kreis",
    14: "Doppelläufer invertiert",
    15: "Palettenbeat",
    16: "Pacifica Kite",
    17: "Funkelbewegung",
    18: "Feuerstrahl",
    19: "Rauschring",
    20: "Pride Yaw",
    21: "Konfetti-Ruck",
    22: "Mittenwelle",
  },
  en: {
    1: "Rainbow",
    2: "Full Color",
    3: "Motion Brightness",
    4: "Runner Fixed",
    5: "Runner Reactive",
    6: "Runner Dual",
    7: "Heartbeat",
    8: "Ping Pong",
    9: "Comet Swarm",
    10: "Breath Storm",
    11: "Jerk Wave",
    12: "Yaw Spinner",
    13: "Yaw Spinner Circle",
    14: "Runner Dual Inverted",
    15: "Palette Beat Motion",
    16: "Pacifica Kite",
    17: "Twinkle Motion",
    18: "Fire Jet",
    19: "Noise Ring",
    20: "Pride Yaw",
    21: "Confetti Jerk",
    22: "Center Ripple",
  },
};

function readPatternViewMode(): "comfortable" | "compact" {
  if (typeof window === "undefined") {
    return "compact";
  }
  const stored = window.localStorage.getItem(PATTERN_VIEW_MODE_KEY);
  return stored === "comfortable" ? "comfortable" : "compact";
}

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

function getLocalizedPatternName(patternId: number, fallbackName: string, language: AppLanguage) {
  return LOCALIZED_PATTERN_NAMES[language][patternId] ?? fallbackName;
}

function getLocalizedPatternDescription(patternId: number, language: AppLanguage) {
  return LOCALIZED_PATTERN_DESCRIPTIONS[language][patternId] ?? "";
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
    createFallbackPatternStates(
      DEFAULT_CONFIG.pattern,
      DEFAULT_CONFIG.enabledPatterns,
      DEFAULT_CONFIG.invertedPatterns,
    ),
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
  const [patternViewMode, setPatternViewMode] = useState<"comfortable" | "compact">(readPatternViewMode);
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

      if (line.values.pattern || line.values.autoplay || line.values.autoplay_interval) {
        setConfig((current) => {
          const nextConfig = configFromCliLine(line, current);
          setDraftConfig((draft) => ({
            ...draft,
            ...(line.values.pattern ? { pattern: nextConfig.pattern } : {}),
            ...(line.values.autoplay ? { autoplayEnabled: nextConfig.autoplayEnabled } : {}),
            ...(line.values.autoplay_interval
              ? { autoplayIntervalSeconds: nextConfig.autoplayIntervalSeconds }
              : {}),
          }));
          setPatterns((existing) => {
            if (existing.length === 0) {
              return createFallbackPatternStates(
                nextConfig.pattern,
                nextConfig.enabledPatterns,
                nextConfig.invertedPatterns,
              );
            }
            return existing.map((pattern) => ({
              ...pattern,
              enabled: nextConfig.enabledPatterns.includes(pattern.id),
              active: pattern.id === nextConfig.pattern,
              inverted: nextConfig.invertedPatterns.includes(pattern.id),
            }));
          });
          return nextConfig;
        });
      }
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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(PATTERN_VIEW_MODE_KEY, patternViewMode);
  }, [patternViewMode]);

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
        return createFallbackPatternStates(
          nextConfig.pattern,
          nextConfig.enabledPatterns,
          nextConfig.invertedPatterns,
        );
      }
      return current.map((pattern) => ({
        ...pattern,
        enabled: nextConfig.enabledPatterns.includes(pattern.id),
        active: pattern.id === nextConfig.pattern,
        inverted: nextConfig.invertedPatterns.includes(pattern.id),
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
    setPatterns(
      patternStatesFromCliLine(
        line,
        nextConfig.pattern,
        nextConfig.enabledPatterns,
        nextConfig.invertedPatterns,
      ),
    );
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
      if (draftConfig.autoplayEnabled !== config.autoplayEnabled) {
        await clientRef.current.runSimpleCommand(`set autoplay ${draftConfig.autoplayEnabled ? "on" : "off"}`);
      }
      if (draftConfig.autoplayIntervalSeconds !== config.autoplayIntervalSeconds) {
        await clientRef.current.runSimpleCommand(
          `set autoplay_interval ${draftConfig.autoplayIntervalSeconds}`,
        );
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

  function handleToggleInvertedPattern(patternId: number) {
    setPatterns((current) =>
      current.map((pattern) =>
        pattern.id === patternId ? { ...pattern, inverted: !pattern.inverted } : pattern,
      ),
    );
  }

  async function handleApplyPatterns() {
    await withBusy(async () => {
      const desiredEnabled = patterns.filter((pattern) => pattern.enabled).map((pattern) => pattern.id);
      const currentlyEnabled = new Set(config.enabledPatterns);
      const desiredEnabledSet = new Set(desiredEnabled);
      const desiredInverted = patterns.filter((pattern) => pattern.inverted).map((pattern) => pattern.id);
      const currentlyInverted = new Set(config.invertedPatterns);
      const desiredInvertedSet = new Set(desiredInverted);

      const toEnable = desiredEnabled.filter((patternId) => !currentlyEnabled.has(patternId));
      const toDisable = config.enabledPatterns.filter((patternId) => !desiredEnabledSet.has(patternId));
      const toInvert = desiredInverted.filter((patternId) => !currentlyInverted.has(patternId));
      const toNormalize = config.invertedPatterns.filter((patternId) => !desiredInvertedSet.has(patternId));

      if (toEnable.length > 0) {
        await clientRef.current.runSimpleCommand(`enable_pattern ${toEnable.join(",")}`);
      }
      if (toDisable.length > 0) {
        await clientRef.current.runSimpleCommand(`disable_pattern ${toDisable.join(",")}`);
      }
      if (toInvert.length > 0) {
        await clientRef.current.runSimpleCommand(`invert_pattern ${toInvert.join(",")}`);
      }
      if (toNormalize.length > 0) {
        await clientRef.current.runSimpleCommand(`normal_pattern ${toNormalize.join(",")}`);
      }
      if (draftConfig.pattern !== config.pattern) {
        await clientRef.current.runSimpleCommand(`set pattern ${draftConfig.pattern}`);
      }
      await readAll();
    });
  }

  function handleEnableAllPatterns() {
    setPatterns((current) => {
      const allEnabled = current.every((pattern) => pattern.enabled);
      if (allEnabled) {
        return current.map((pattern) => ({ ...pattern, enabled: pattern.id === 1 }));
      }
      return current.map((pattern) => ({ ...pattern, enabled: true }));
    });
  }

  function handleInvertAllPatterns() {
    setPatterns((current) => {
      const allInverted = current.every((pattern) => pattern.inverted);
      return current.map((pattern) => ({ ...pattern, inverted: !allInverted }));
    });
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
        key === "inverted_patterns" ||
        key === "pattern" ||
        key === "brightness" ||
        key === "strip_length" ||
        key === "smoothing" ||
        key === "accel_range" ||
        key === "gyro_range" ||
        key === "boot_calibration" ||
        key === "autoplay" ||
        key === "autoplay_interval"
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
      if (
        command.startsWith("enable_pattern ") ||
        command.startsWith("disable_pattern ") ||
        command.startsWith("invert_pattern ") ||
        command.startsWith("normal_pattern ")
      ) {
        await readAll();
      }
    });
  }

  const calibrationLogLines = useMemo(() => logLines.slice(-14), [logLines]);
  const localizedPatterns = useMemo(
    () =>
      patterns.map((pattern) => ({
        ...pattern,
        name: getLocalizedPatternName(pattern.id, pattern.name, language),
        description: getLocalizedPatternDescription(pattern.id, language),
      })),
    [language, patterns],
  );

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
          patternViewMode={patternViewMode}
          autoRefreshEnabled={autoRefreshEnabled}
          autoRefreshSeconds={autoRefreshSeconds}
          helpTooltip={text.options.sectionHelp}
          onLanguageChange={setLanguage}
          onPatternViewModeChange={setPatternViewMode}
          onAutoRefreshEnabledChange={setAutoRefreshEnabled}
          onAutoRefreshSecondsChange={(seconds) => {
            setAutoRefreshSeconds(Number.isFinite(seconds) ? Math.max(2, Math.min(300, seconds)) : 10);
          }}
          labels={text.options}
        />
        <PatternsPanel
          patterns={localizedPatterns.map((pattern) => ({
            ...pattern,
            active: pattern.id === activePatternId,
          }))}
          viewMode={patternViewMode}
          connected={connection.connected}
          busy={busy}
          helpTooltip={text.patterns.sectionHelp}
          labels={text.patterns}
          onToggleEnabled={handleTogglePattern}
          onToggleInverted={handleToggleInvertedPattern}
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
          onInvertAll={handleInvertAllPatterns}
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
      autoplay: "Autoplay",
      autoplayInterval: "Autoplay-Intervall (s)",
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
      autoplayHint: "Schaltet das automatische Durchschalten durch die aktiven Pattern global ein oder aus.",
      autoplayIntervalHint: "Legt fest, nach wie vielen Sekunden Autoplay zum nächsten aktiven Pattern wechselt. Bereich: 1 bis 300 Sekunden.",
      readDeviceHint: "Liest die aktuelle Konfiguration und alle Diagnosewerte erneut vom Controller.",
      applyChangesHint: "Schreibt die geänderten Konfigurationswerte direkt in die laufende Firmware.",
      saveToDeviceHint: "Speichert die aktuelle Konfiguration dauerhaft im Flash des Controllers.",
      loadSavedHint: "Lädt die zuletzt gespeicherte Konfiguration aus dem Controller.",
      defaultsHint: "Setzt die Firmware auf ihre Standardwerte zurück.",
      sectionHelp:
        "Laufende Firmware-Konfiguration. Active Pattern und Helligkeit beeinflussen die Hardware direkt, während Strip-Länge, Smoothing, Sensorbereiche, Boot-Kalibrierung und Autoplay das Geräteverhalten steuern. Mit Controller lesen, Änderungen anwenden, Speichern, Laden und Standardwerte steuerst du das Übernehmen und Sichern der Werte.",
    },
    options: {
      title: "Optionen",
      subtitle: "App-Verhalten",
      language: "Sprache",
      patternView: "Pattern-Ansicht",
      autoRefresh: "Auto-Refresh",
      refreshInterval: "Refresh-Intervall",
      languageDe: "Deutsch",
      languageEn: "Englisch",
      patternViewComfortable: "Komfort",
      patternViewCompact: "Kompakt",
      autoRefreshOn: "Ein",
      autoRefreshOff: "Aus",
      secondsSuffix: "Sekunden",
      languageHint: "Schaltet die Oberfläche und die eingebundene Anleitung zwischen Deutsch und Englisch um.",
      patternViewHint: "Schaltet die Pattern-Sektion zwischen Kartenansicht und kompakter Tabellenansicht um.",
      autoRefreshHint: "Aktualisiert die Live-Werte automatisch in einem festen Intervall.",
      refreshIntervalHint: "Legt fest, wie oft der automatische Refresh ausgeführt wird.",
      sectionHelp:
        "App-Optionen. Hier stellst du Sprache, Pattern-Ansicht und den automatischen Refresh der Live-Daten ein.",
    },
    patterns: {
      title: "Patterns",
      subtitle: "Button-Zyklusfilter",
      enabled: "Aktiv",
      disabled: "Aus",
      active: "Live",
      inverted: "Invertiert",
      includeInCycle: "Im Button-Zyklus",
      invertDirection: "Richtung invertieren",
      makeActive: "Aktivieren",
      enableAll: "Alle aktivieren",
      invertAll: "Alle invertieren",
      readPatternList: "Pattern-Liste lesen",
      applySelection: "Auswahl anwenden",
      includeInCycleHint: "Legt fest, ob dieses Pattern per Button-Zyklus auf der Hardware erreichbar ist.",
      invertDirectionHint: "Kehrt die Laufrichtung dieses Patterns um, sofern das Firmware-Pattern Richtungsumschaltung unterstützt.",
      makeActiveHint: "Schaltet dieses Pattern sofort live auf der Hardware aktiv.",
      enableAllHint: "Markiert alle Patterns als im Button-Zyklus verfügbar.",
      invertAllHint: "Markiert alle Patterns als invertiert. Die Änderung wird erst mit 'Auswahl anwenden' auf die Hardware übertragen.",
      readPatternListHint: "Liest den aktuellen Pattern-Status erneut vom Controller.",
      applySelectionHint: "Überträgt die aktuelle Pattern-Auswahl auf die Hardware.",
      compactId: "ID",
      compactName: "Name",
      compactState: "Status",
      compactEnabled: "Zyklus",
      compactInverted: "Invertiert",
      compactActions: "Aktion",
      sectionHelp:
        "Pattern-Verwaltung. Jede Zeile zeigt ein Firmware-Pattern mit ID, Namen, Aktiv-Status, Button-Zyklus-Auswahl und optional invertierter Laufrichtung. Du kannst einzelne Patterns in den Zyklus aufnehmen oder entfernen, die Richtung umkehren, ein Pattern sofort live aktivieren, alle aktivieren, die aktuelle Liste neu lesen oder die Auswahl gesammelt anwenden.",
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
      autoplay: "Autoplay",
      autoplayInterval: "Autoplay Interval (s)",
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
      autoplayHint: "Globally enables or disables automatic cycling through active patterns.",
      autoplayIntervalHint: "Defines after how many seconds autoplay advances to the next active pattern. Range: 1 to 300 seconds.",
      readDeviceHint: "Reads configuration and diagnostics again from the controller.",
      applyChangesHint: "Writes the changed configuration values into the running firmware.",
      saveToDeviceHint: "Stores the current configuration persistently in controller flash.",
      loadSavedHint: "Loads the last saved configuration from the controller.",
      defaultsHint: "Resets firmware settings back to their defaults.",
      sectionHelp:
        "Running firmware configuration. Active Pattern and Brightness affect the hardware immediately, while Strip Length, Smoothing, sensor ranges, Boot Calibration, and Autoplay control device behavior. Read Device, Apply Changes, Save, Load, and Defaults handle refreshing, applying, and storing those values.",
    },
    options: {
      title: "Options",
      subtitle: "App behavior",
      language: "Language",
      patternView: "Pattern View",
      autoRefresh: "Auto Refresh",
      refreshInterval: "Refresh Interval",
      languageDe: "German",
      languageEn: "English",
      patternViewComfortable: "Comfortable",
      patternViewCompact: "Compact",
      autoRefreshOn: "On",
      autoRefreshOff: "Off",
      secondsSuffix: "seconds",
      languageHint: "Switches the UI and embedded manual between German and English.",
      patternViewHint: "Switches the pattern section between card view and compact table view.",
      autoRefreshHint: "Refreshes live values automatically on a fixed interval.",
      refreshIntervalHint: "Defines how often automatic refresh should run.",
      sectionHelp:
        "Application options. This section controls language, pattern view mode, and automatic live refresh.",
    },
    patterns: {
      title: "Patterns",
      subtitle: "Button cycling filter",
      enabled: "Enabled",
      disabled: "Disabled",
      active: "Active",
      inverted: "Inverted",
      includeInCycle: "Include in button cycle",
      invertDirection: "Invert direction",
      makeActive: "Make Active",
      enableAll: "Enable All",
      invertAll: "Invert All",
      readPatternList: "Read Pattern List",
      applySelection: "Apply Selection",
      includeInCycleHint: "Controls whether this pattern is reachable through hardware button cycling.",
      invertDirectionHint: "Reverses this pattern's animation direction if the firmware pattern supports direction switching.",
      makeActiveHint: "Makes this pattern live on the hardware immediately.",
      enableAllHint: "Marks all patterns as available in the button cycle.",
      invertAllHint: "Marks all patterns as inverted. The change is only sent to the hardware after 'Apply Selection'.",
      readPatternListHint: "Reads the current pattern state again from the controller.",
      applySelectionHint: "Transfers the current pattern selection to the hardware.",
      compactId: "ID",
      compactName: "Name",
      compactState: "State",
      compactEnabled: "Cycle",
      compactInverted: "Inverted",
      compactActions: "Action",
      sectionHelp:
        "Pattern management. Each row shows one firmware pattern with its ID, name, active state, button-cycle inclusion, and optional inverted direction. You can include or exclude patterns from the hardware button cycle, reverse their direction, make one pattern live immediately, enable all, reread the list, or apply the current selection in one step.",
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
