import { invoke } from "@tauri-apps/api/core";
import { parseCliLine } from "./cli";
import type { CliLine, ConnectionInfo } from "./types";

interface SerialPortInfo {
  name: string;
  portType: string;
}

function inTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export class DeviceClient {
  private queue: Promise<unknown> = Promise.resolve();
  private lineHandler: ((line: CliLine) => void) | null = null;

  async start(lineHandler: (line: CliLine) => void) {
    this.lineHandler = lineHandler;
  }

  async stop() {
    this.lineHandler = null;
  }

  async listPorts(): Promise<string[]> {
    if (!inTauriRuntime()) {
      return [];
    }

    const ports = await invoke<SerialPortInfo[]>("list_serial_ports");
    return ports.map((port) => port.name);
  }

  async getConnectionStatus(): Promise<ConnectionInfo> {
    if (!inTauriRuntime()) {
      return { connected: false, portName: "", baudRate: 115200 };
    }

    const status = await invoke<{ connected: boolean; port_name?: string; baud_rate?: number }>(
      "get_connection_status",
    );
    return {
      connected: status.connected,
      portName: status.port_name ?? "",
      baudRate: status.baud_rate ?? 115200,
    };
  }

  async connect(portName: string, baudRate = 115200): Promise<ConnectionInfo> {
    const status = await invoke<{ connected: boolean; port_name?: string; baud_rate?: number }>(
      "connect_serial",
      { portName, baudRate },
    );
    return {
      connected: status.connected,
      portName: status.port_name ?? portName,
      baudRate: status.baud_rate ?? baudRate,
    };
  }

  async disconnect(): Promise<ConnectionInfo> {
    const status = await invoke<{ connected: boolean; port_name?: string; baud_rate?: number }>(
      "disconnect_serial",
    );
    return {
      connected: status.connected,
      portName: status.port_name ?? "",
      baudRate: status.baud_rate ?? 115200,
    };
  }

  async getManualContent(language: "de" | "en"): Promise<string> {
    if (!inTauriRuntime()) {
      return "";
    }

    return invoke<string>("get_manual_content", { language });
  }

  async runSimpleCommand(command: string, timeoutMs = 4000): Promise<CliLine> {
    return this.enqueue(async () => {
      const parsedLines = await this.runCommand(command, {
        timeoutMs,
        waitForCalibrationFinish: false,
        readUntilIdle: false,
      });
      parsedLines.forEach((line) => this.lineHandler?.(line));
      const lastLine = parsedLines[parsedLines.length - 1];
      if (!lastLine) {
        throw new Error(`No reply received for '${command}'`);
      }
      if (lastLine.kind === "err") {
        throw new Error(lastLine.message);
      }
      return lastLine;
    });
  }

  async runCalibration(mode: "quick" | "precise", timeoutMs = 180000): Promise<CliLine[]> {
    const command = `calibrate ${mode}`;
    return this.enqueue(async () => {
      const parsedLines = await this.runCommand(command, {
        timeoutMs,
        waitForCalibrationFinish: true,
        readUntilIdle: false,
      });
      parsedLines.forEach((line) => this.lineHandler?.(line));
      const lastLine = parsedLines[parsedLines.length - 1];
      if (!lastLine) {
        throw new Error(`No reply received for '${command}'`);
      }
      if (lastLine.kind === "err") {
        throw new Error(lastLine.message);
      }
      return parsedLines;
    });
  }

  async runTextCommand(command: string, timeoutMs = 4000): Promise<CliLine[]> {
    return this.enqueue(async () => {
      const parsedLines = await this.runCommand(command, {
        timeoutMs,
        waitForCalibrationFinish: false,
        readUntilIdle: true,
      });
      parsedLines.forEach((line) => this.lineHandler?.(line));
      if (parsedLines.length === 0) {
        throw new Error(`No reply received for '${command}'`);
      }
      return parsedLines;
    });
  }

  private async runCommand(
    command: string,
    options: {
      timeoutMs: number;
      waitForCalibrationFinish: boolean;
      readUntilIdle: boolean;
    },
  ): Promise<CliLine[]> {
    const reply = await invoke<{ lines: string[] }>("run_cli_command", {
      command,
      timeoutMs: options.timeoutMs,
      waitForCalibrationFinish: options.waitForCalibrationFinish,
      readUntilIdle: options.readUntilIdle,
    });
    return reply.lines.map((line) => parseCliLine(line));
  }

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work, work);
    this.queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }
}
