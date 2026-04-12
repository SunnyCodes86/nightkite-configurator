export type BootCalibrationMode = "off" | "quick";

export interface ConfigSnapshot {
  pattern: number;
  brightness: number;
  stripLength: number;
  smoothing: number;
  accelRange: number;
  gyroRange: number;
  bootCalibration: BootCalibrationMode;
  autoplayEnabled: boolean;
  autoplayIntervalSeconds: number;
  enabledPatterns: number[];
  invertedPatterns: number[];
}

export interface PatternState {
  id: number;
  name: string;
  description?: string;
  enabled: boolean;
  active: boolean;
  inverted: boolean;
}

export interface DiagnosticSnapshot {
  batteryRaw: string;
  batteryVoltage: string;
  usbPowerRaw: string;
  serialSessionActive: string;
  sensorSummary: string;
  timingSummary: string;
  offsetsSummary: string;
  smoothingConfig: number | null;
  smoothingActive: number | null;
  accelRangeConfig: number | null;
  accelRangeActive: number | null;
  gyroRangeConfig: number | null;
  gyroRangeActive: number | null;
}

export interface ConnectionInfo {
  connected: boolean;
  portName: string;
  baudRate: number;
}

export type AppLanguage = "de" | "en";

export interface CliLine {
  raw: string;
  kind: "ok" | "err" | "info" | "other";
  values: Record<string, string>;
  message: string;
}
