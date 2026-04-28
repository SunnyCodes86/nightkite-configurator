# NightKite Configurator Manual

This guide describes the `NightKite Configurator` desktop app and explains how to operate the controller over USB using the graphical interface.

The controller firmware and device behavior are documented separately. This app builds directly on the existing NightKite CLI and makes the most important functions accessible through a UI.

## Overview

The Configurator is a desktop application built with `Tauri`, `React`, and `TypeScript`.  
It connects to the NightKite controller over USB serial and parses the firmware CLI replies.

The app provides:

- connection to the controller through a selectable serial port
- live display and editing of core configuration values
- enabling, disabling, and directly activating patterns
- a switchable pattern view in `Compact` or `Comfort`
- localized pattern names based on the selected app language
- visually prepared diagnostics for battery, sensor, timing, and offsets
- calibration, reboot, and direct CLI input through an integrated terminal
- embedded documentation in German or English

## Requirements

To use the app you need:

- a NightKite controller with current firmware
- an active USB connection to the computer
- an available serial port

For development you also need:

- `Node.js` and `npm`
- a Rust toolchain with Cargo
- the Tauri prerequisites for your operating system

## App Areas

## Connection

In the `Connection` area, you select the serial port of the controller.

Functions:

- `Refresh Ports`: reloads the currently available serial ports
- `Connect`: opens the serial connection and reads device data
- `Disconnect`: closes the connection again

The status indicator shows whether an active serial session currently exists.

## Configuration

In the `Configuration` area, you edit the main firmware settings.

Fields:

- `Active Pattern`
- `Brightness`
- `Strip Length`
- `Smoothing`
- `Accel Range`
- `Gyro Range`
- `Boot Calibration`

Actions:

- `Read Device`
- `Apply Changes`
- `Save to Device`
- `Load Saved`
- `Defaults`

Important notes:

- `Brightness` is applied live to the hardware immediately.
- Some settings only fully apply after a reboot.
- The app shows this with a `Reboot required` hint.

## Options

In the `Options` area, you control application behavior.

Functions:

- switch the app language between German and English
- enable or disable automatic refresh
- set the refresh interval in seconds
- switch the pattern view between `Compact` and `Comfort`

The selected language affects both the UI and the embedded manual inside the app.
Pattern names in the UI are also localized to match the selected language.
The selected pattern view is stored locally in the app. By default the app starts in `Compact` view.

## Patterns

In the `Patterns` area, you manage the available firmware patterns.

Each pattern row shows:

- ID and name
- whether the pattern is enabled in the hardware button cycle
- whether it is currently live
- in `Comfort` view, an additional short description of the pattern

Actions:

- enable or disable a pattern in the button cycle
- switch the pattern list between a space-saving table and larger comfort cards
- `Make Active`: switch the pattern live on the hardware immediately
- `Enable All`
- `Read Pattern List`
- `Apply Selection`

In `Compact` view, the checkboxes are intentionally shown a bit larger so the pattern list remains easier to operate with many entries.
`Comfort` view follows the same basic structure, but adds more room for the name and description.

## Diagnostics

In the `Diagnostics` area, live hardware data is displayed in a more visual form.

Sections:

- `Battery`: voltage, raw value, and charge level
- `USB Power` and `Serial Session`
- `Sensor State`: MPU, DMP, device state, and active sensor values
- `Timing`: loop and work metrics reported by the firmware, including timing-stat reset
- `Offsets`: the currently active sensor offsets

Each section has its own refresh button so you can reload only that part. In the Timing section, `Reset` resets the firmware timing statistics and then reads fresh values.

## Calibration and CLI

The lower area contains maintenance and CLI tools.

Actions:

- `Quick Calibration`
- `Precise Calibration`
- `Reboot Device`
- `Restart Alias`
- `Show CLI Help`
- read individual values with `get`
- send free-form CLI commands in the terminal

The terminal:

- shows replies with timestamps
- auto-scrolls when new lines arrive
- is suitable for direct commands like `help`, `show`, `get pattern`, `set brightness 127`, `timing reset`

## Embedded Manual

The app automatically loads the matching manual for the currently selected language:

- German: `manual_de.md`
- English: `manual_en.md`

That keeps the documentation available directly inside the UI.

## Typical Workflow

A common workflow looks like this:

1. Connect the controller over USB
2. Select the serial port in `Connection`
3. Click `Connect`
4. Check configuration and diagnostics
5. Test pattern or brightness changes live
6. Adjust additional settings
7. Use `Save to Device` if you want the changes to persist

## Development

Build the frontend:

```bash
npm install
npm run build
```

Run the desktop app in development:

```bash
npm install
npm run tauri dev
```

Check the Rust backend:

```bash
cd src-tauri
cargo check --bins
```

## Notes for GitHub Users

- The Configurator talks directly to the existing firmware CLI.
- Firmware changes can affect the app-side parsers.
- If new CLI commands or response formats are added, the app and documentation should be updated together.
