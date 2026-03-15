use nightkite_configurator::serial_bridge::{open_connection, run_command_internal};
use std::{env, thread, time::Duration};

fn main() {
    if let Err(message) = run() {
        eprintln!("serial-smoke error: {message}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), String> {
    let mut args = env::args().skip(1);
    let port_name = args
        .next()
        .ok_or_else(|| "usage: cargo run --bin serial-smoke -- <port> [command ...]".to_string())?;
    let commands: Vec<String> = args.collect();
    let commands = if commands.is_empty() {
        vec![
            "show".to_string(),
            "patterns".to_string(),
            "battery".to_string(),
            "sensor".to_string(),
            "timing".to_string(),
            "offsets".to_string(),
        ]
    } else {
        commands
    };

    let mut connection = open_connection(&port_name, None)?;

    // Give the controller time to settle if opening the port triggers a reset.
    thread::sleep(Duration::from_millis(1_200));

    println!(
        "connected port={} baud={}",
        connection.port_name, connection.baud_rate
    );

    for command in commands {
        let wait_for_calibration_finish = command.starts_with("calibrate ");
        let read_until_idle = command == "help";
        let timeout_ms = if wait_for_calibration_finish {
            180_000
        } else {
            4_000
        };
        let reply = run_command_internal(
            connection.port.as_mut(),
            &command,
            timeout_ms,
            wait_for_calibration_finish,
            read_until_idle,
        )?;

        println!("> {command}");
        for line in reply.lines {
            println!("{line}");
        }
    }

    Ok(())
}
