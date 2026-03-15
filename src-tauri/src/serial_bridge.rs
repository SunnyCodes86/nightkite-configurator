use serde::Serialize;
use serialport::{available_ports, SerialPort, SerialPortType};
use std::{
    thread,
    time::{Duration, Instant},
};

pub const DEFAULT_BAUD_RATE: u32 = 115_200;

pub struct SerialConnection {
    pub port_name: String,
    pub baud_rate: u32,
    pub port: Box<dyn SerialPort>,
}

#[derive(Serialize)]
pub struct SerialPortInfo {
    pub name: String,
    pub port_type: String,
}

#[derive(Serialize)]
pub struct ConnectionStatus {
    pub connected: bool,
    pub port_name: Option<String>,
    pub baud_rate: Option<u32>,
}

#[derive(Serialize)]
pub struct CommandReply {
    pub lines: Vec<String>,
}

fn port_type_label(port_type: &SerialPortType) -> &'static str {
    match port_type {
        SerialPortType::UsbPort(_) => "usb",
        SerialPortType::BluetoothPort => "bluetooth",
        SerialPortType::PciPort => "pci",
        SerialPortType::Unknown => "unknown",
    }
}

pub fn list_serial_ports() -> Result<Vec<SerialPortInfo>, String> {
    let mut ports = available_ports().map_err(|error| error.to_string())?;
    ports.sort_by(|left, right| left.port_name.cmp(&right.port_name));

    Ok(ports
        .into_iter()
        .map(|port| SerialPortInfo {
            name: port.port_name,
            port_type: port_type_label(&port.port_type).to_string(),
        })
        .collect())
}

pub fn open_connection(
    port_name: &str,
    baud_rate: Option<u32>,
) -> Result<SerialConnection, String> {
    let baud_rate = baud_rate.unwrap_or(DEFAULT_BAUD_RATE);
    let port = serialport::new(port_name, baud_rate)
        .timeout(Duration::from_millis(100))
        .open()
        .map_err(|error| error.to_string())?;

    Ok(SerialConnection {
        port_name: port_name.to_string(),
        baud_rate,
        port,
    })
}

fn normalize_cli_prefix(line: &str) -> String {
    let mut normalized = line.trim().to_string();
    loop {
        let trimmed = normalized.trim_start();
        if let Some(rest) = trimmed.strip_prefix("nk>") {
            normalized = rest.trim_start().to_string();
            continue;
        }
        break;
    }
    normalized
}

pub fn drain_pending_input(port: &mut dyn SerialPort) -> Result<(), String> {
    let mut scratch = [0_u8; 256];
    loop {
        match port.read(&mut scratch) {
            Ok(0) => break,
            Ok(_) => continue,
            Err(error) if error.kind() == std::io::ErrorKind::TimedOut => break,
            Err(error) => return Err(error.to_string()),
        }
    }
    Ok(())
}

fn reply_is_complete(normalized: &str, wait_for_calibration_finish: bool) -> bool {
    if normalized.starts_with("ERR ") {
        return true;
    }

    if wait_for_calibration_finish {
        false
    } else {
        normalized.starts_with("OK ")
    }
}

pub fn run_command_internal(
    port: &mut dyn SerialPort,
    command: &str,
    timeout_ms: u64,
    wait_for_calibration_finish: bool,
    read_until_idle: bool,
) -> Result<CommandReply, String> {
    drain_pending_input(port)?;

    port.write_all(command.as_bytes())
        .map_err(|error| error.to_string())?;
    port.write_all(b"\n").map_err(|error| error.to_string())?;
    port.flush().map_err(|error| error.to_string())?;

    let deadline = Instant::now() + Duration::from_millis(timeout_ms);
    let mut chunk = [0_u8; 256];
    let mut pending = Vec::<u8>::new();
    let mut lines = Vec::<String>::new();
    let mut calibration_finished_seen = false;
    let mut last_received_at: Option<Instant> = None;

    while Instant::now() < deadline {
        match port.read(&mut chunk) {
            Ok(bytes_read) if bytes_read > 0 => {
                pending.extend_from_slice(&chunk[..bytes_read]);
                last_received_at = Some(Instant::now());

                while let Some(newline_index) = pending.iter().position(|byte| *byte == b'\n') {
                    let line_bytes: Vec<u8> = pending.drain(..=newline_index).collect();
                    let line = String::from_utf8_lossy(&line_bytes)
                        .replace('\r', "")
                        .trim()
                        .to_string();

                    if line.is_empty() {
                        continue;
                    }

                    let normalized = normalize_cli_prefix(&line);
                    if normalized.is_empty() {
                        continue;
                    }

                    lines.push(normalized.clone());
                    if wait_for_calibration_finish {
                        if calibration_finished_seen
                            && (normalized.starts_with("OK ") || normalized.starts_with("ERR "))
                        {
                            return Ok(CommandReply { lines });
                        }

                        if normalized.starts_with("OK ")
                            && normalized.contains("calibrate_finished=1")
                        {
                            calibration_finished_seen = true;
                        }
                    }

                    if reply_is_complete(&normalized, wait_for_calibration_finish) {
                        return Ok(CommandReply { lines });
                    }
                }
            }
            Ok(_) => {}
            Err(error) if error.kind() == std::io::ErrorKind::TimedOut => {
                if read_until_idle
                    && !lines.is_empty()
                    && last_received_at
                        .map(|instant| instant.elapsed() >= Duration::from_millis(180))
                        .unwrap_or(false)
                {
                    return Ok(CommandReply { lines });
                }
                thread::sleep(Duration::from_millis(20));
            }
            Err(error) => return Err(error.to_string()),
        }
    }

    Err(format!("Timed out waiting for reply to '{}'", command))
}
