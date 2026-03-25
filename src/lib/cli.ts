import type {
  BootCalibrationMode,
  CliLine,
  ConfigSnapshot,
  DiagnosticSnapshot,
  PatternState,
} from "./types";

export const FIRST_PATTERN_ID = 1;
export const LAST_PATTERN_ID = 14;

const KEY_VALUE_PATTERN = /([a-z_]+)=("[^"]*"|[^\s]+)/gi;

export const DEFAULT_CONFIG: ConfigSnapshot = {
  pattern: 1,
  brightness: 95,
  stripLength: 25,
  smoothing: 100,
  accelRange: 2,
  gyroRange: 2000,
  bootCalibration: "quick",
  enabledPatterns: Array.from({ length: LAST_PATTERN_ID }, (_, index) => index + 1),
};

export const DEFAULT_DIAGNOSTICS: DiagnosticSnapshot = {
  batteryRaw: "-",
  batteryVoltage: "-",
  usbPowerRaw: "-",
  serialSessionActive: "-",
  sensorSummary: "No data yet",
  timingSummary: "No data yet",
  offsetsSummary: "No data yet",
  smoothingConfig: null,
  smoothingActive: null,
  accelRangeConfig: null,
  accelRangeActive: null,
  gyroRangeConfig: null,
  gyroRangeActive: null,
};

export function parseCliLine(rawLine: string): CliLine {
  const raw = rawLine.trim();
  const normalized = raw.replace(/^(nk>\s*)+/i, "").trim();
  const values: Record<string, string> = {};
  let kind: CliLine["kind"] = "other";
  let message = normalized;

  if (normalized.startsWith("OK ")) {
    kind = "ok";
    message = normalized.slice(3);
  } else if (normalized.startsWith("ERR ")) {
    kind = "err";
    message = normalized.slice(4);
  } else if (normalized.startsWith("INFO ")) {
    kind = "info";
    message = normalized.slice(5);
  }

  for (const match of message.matchAll(KEY_VALUE_PATTERN)) {
    const key = match[1].toLowerCase();
    const value = match[2].replace(/^"|"$/g, "");
    values[key] = value;
  }

  return { raw, kind, values, message };
}

export function parsePatternIdList(value?: string): number[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((item) => Number.isInteger(item));
}

function parseInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBootCalibration(value: string | undefined): BootCalibrationMode {
  return value === "off" ? "off" : "quick";
}

export function configFromCliLine(line: CliLine, currentConfig: ConfigSnapshot): ConfigSnapshot {
  return {
    pattern: parseInteger(line.values.pattern, currentConfig.pattern),
    brightness: parseInteger(line.values.brightness, currentConfig.brightness),
    stripLength: parseInteger(line.values.strip_length, currentConfig.stripLength),
    smoothing: parseInteger(line.values.smoothing, currentConfig.smoothing),
    accelRange: parseInteger(line.values.accel_range, currentConfig.accelRange),
    gyroRange: parseInteger(line.values.gyro_range, currentConfig.gyroRange),
    bootCalibration: parseBootCalibration(line.values.boot_calibration),
    enabledPatterns:
      parsePatternIdList(line.values.enabled_patterns).length > 0
        ? parsePatternIdList(line.values.enabled_patterns)
        : currentConfig.enabledPatterns,
  };
}

export function patternStatesFromCliLine(
  line: CliLine,
  activePattern: number,
  enabledPatterns: number[],
): PatternState[] {
  const payload = line.values.patterns ?? "";
  if (!payload) {
    return createFallbackPatternStates(activePattern, enabledPatterns);
  }

  return payload.split(",").map((item) => {
    const [idText, nameText, stateText] = item.split(":");
    const id = parseInteger(idText, FIRST_PATTERN_ID);
    return {
      id,
      name: nameText || `Pattern ${id}`,
      enabled: stateText === "on",
      active: id === activePattern,
    };
  });
}

export function createFallbackPatternStates(
  activePattern: number,
  enabledPatterns: number[],
): PatternState[] {
  return Array.from({ length: LAST_PATTERN_ID }, (_, index) => {
    const id = index + 1;
    return {
      id,
      name: `Pattern ${id}`,
      enabled: enabledPatterns.includes(id),
      active: id === activePattern,
    };
  });
}

export function batteryDiagnosticsFromCliLine(
  line: CliLine,
  current: DiagnosticSnapshot,
): DiagnosticSnapshot {
  return {
    ...current,
    batteryRaw: line.values.battery_raw ?? current.batteryRaw,
    batteryVoltage: line.values.battery_voltage ? `${line.values.battery_voltage} V` : current.batteryVoltage,
    usbPowerRaw: line.values.usb_power_raw ?? current.usbPowerRaw,
    serialSessionActive: line.values.serial_session_active ?? current.serialSessionActive,
  };
}

export function sensorDiagnosticsFromCliLine(
  line: CliLine,
  current: DiagnosticSnapshot,
): DiagnosticSnapshot {
  const parts = [
    `mpu=${line.values.mpu_connected ?? "?"}`,
    `dmp=${line.values.dmp_ready ?? "?"}`,
    `dev=${line.values.dev_status ?? "?"}`,
    `pkt=${line.values.packet_size ?? "?"}`,
    `accel=${line.values.accel_range_active ?? "?"}g`,
    `gyro=${line.values.gyro_range_active ?? "?"}dps`,
    `smooth=${line.values.smoothing_active ?? "?"}`,
  ];

  return {
    ...current,
    sensorSummary: parts.join("  "),
    smoothingConfig: parseInteger(line.values.smoothing_config, current.smoothingConfig ?? 0),
    smoothingActive: parseInteger(line.values.smoothing_active, current.smoothingActive ?? 0),
    accelRangeConfig: parseInteger(line.values.accel_range_config, current.accelRangeConfig ?? 0),
    accelRangeActive: parseInteger(line.values.accel_range_active, current.accelRangeActive ?? 0),
    gyroRangeConfig: parseInteger(line.values.gyro_range_config, current.gyroRangeConfig ?? 0),
    gyroRangeActive: parseInteger(line.values.gyro_range_active, current.gyroRangeActive ?? 0),
  };
}

export function timingDiagnosticsFromCliLine(
  line: CliLine,
  current: DiagnosticSnapshot,
): DiagnosticSnapshot {
  const parts = [
    `fps=${line.values.fps ?? "?"}`,
    `last loop=${line.values.last_loop_us ?? "?"} us`,
    `avg loop=${line.values.avg_loop_us ?? "?"} us`,
    `max loop=${line.values.max_loop_us ?? "?"} us`,
    `last work=${line.values.last_work_us ?? "?"} us`,
    `avg work=${line.values.avg_work_us ?? "?"} us`,
  ];

  return {
    ...current,
    timingSummary: parts.join("  "),
  };
}

export function offsetsDiagnosticsFromCliLine(
  line: CliLine,
  current: DiagnosticSnapshot,
): DiagnosticSnapshot {
  const parts = [
    `ax=${line.values.x_accel_offset ?? "?"}`,
    `ay=${line.values.y_accel_offset ?? "?"}`,
    `az=${line.values.z_accel_offset ?? "?"}`,
    `gx=${line.values.x_gyro_offset ?? "?"}`,
    `gy=${line.values.y_gyro_offset ?? "?"}`,
    `gz=${line.values.z_gyro_offset ?? "?"}`,
  ];

  return {
    ...current,
    offsetsSummary: parts.join("  "),
  };
}
