#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use nightkite_configurator::serial_bridge::{
    list_serial_ports as list_serial_ports_internal, open_connection, run_command_internal,
    CommandReply, ConnectionStatus, SerialConnection, SerialPortInfo, DEFAULT_BAUD_RATE,
};
use std::{fs, path::PathBuf, sync::Mutex};
use tauri::State;

#[derive(Default)]
struct SerialState {
    connection: Mutex<Option<SerialConnection>>,
}

fn disconnect_internal(state: &SerialState) -> Result<(), String> {
    let mut guard = state
        .connection
        .lock()
        .map_err(|_| "serial state lock poisoned".to_string())?;
    guard.take();
    Ok(())
}

#[tauri::command]
fn list_serial_ports() -> Result<Vec<SerialPortInfo>, String> {
    list_serial_ports_internal()
}

#[tauri::command]
fn get_connection_status(state: State<'_, SerialState>) -> Result<ConnectionStatus, String> {
    let guard = state
        .connection
        .lock()
        .map_err(|_| "serial state lock poisoned".to_string())?;
    if let Some(connection) = guard.as_ref() {
        Ok(ConnectionStatus {
            connected: true,
            port_name: Some(connection.port_name.clone()),
            baud_rate: Some(connection.baud_rate),
        })
    } else {
        Ok(ConnectionStatus {
            connected: false,
            port_name: None,
            baud_rate: None,
        })
    }
}

#[tauri::command]
fn connect_serial(
    state: State<'_, SerialState>,
    port_name: String,
    baud_rate: Option<u32>,
) -> Result<ConnectionStatus, String> {
    disconnect_internal(&state)?;

    let mut guard = state
        .connection
        .lock()
        .map_err(|_| "serial state lock poisoned".to_string())?;
    let connection = open_connection(&port_name, baud_rate.or(Some(DEFAULT_BAUD_RATE)))?;
    let active_baud_rate = connection.baud_rate;
    *guard = Some(connection);

    Ok(ConnectionStatus {
        connected: true,
        port_name: Some(port_name),
        baud_rate: Some(active_baud_rate),
    })
}

#[tauri::command]
fn disconnect_serial(state: State<'_, SerialState>) -> Result<ConnectionStatus, String> {
    disconnect_internal(&state)?;
    Ok(ConnectionStatus {
        connected: false,
        port_name: None,
        baud_rate: None,
    })
}

#[tauri::command]
fn run_cli_command(
    state: State<'_, SerialState>,
    command: String,
    timeout_ms: Option<u64>,
    wait_for_calibration_finish: Option<bool>,
    read_until_idle: Option<bool>,
) -> Result<CommandReply, String> {
    let mut guard = state
        .connection
        .lock()
        .map_err(|_| "serial state lock poisoned".to_string())?;
    let connection = guard
        .as_mut()
        .ok_or_else(|| "not connected to a serial device".to_string())?;

    run_command_internal(
        connection.port.as_mut(),
        &command,
        timeout_ms.unwrap_or(4_000),
        wait_for_calibration_finish.unwrap_or(false),
        read_until_idle.unwrap_or(false),
    )
}

#[tauri::command]
fn get_manual_content(language: String) -> Result<String, String> {
    let file_name = match language.as_str() {
        "de" => "manual_de.md",
        "en" => "manual_en.md",
        _ => return Err("unsupported manual language".to_string()),
    };

    let manual_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .join("nightkite-multi")
        .join("manual")
        .join(file_name);

    fs::read_to_string(&manual_path)
        .map_err(|error| format!("failed to read manual '{}': {}", manual_path.display(), error))
}

fn main() {
    tauri::Builder::default()
        .manage(SerialState::default())
        .invoke_handler(tauri::generate_handler![
            list_serial_ports,
            get_connection_status,
            connect_serial,
            disconnect_serial,
            run_cli_command,
            get_manual_content,
        ])
        .run(tauri::generate_context!())
        .expect("error while running NightKite Configurator");
}
