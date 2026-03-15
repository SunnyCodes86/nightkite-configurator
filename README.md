# NightKite Configurator

Desktop configuration tool for the NightKite Multi firmware.

Current status:
- `Tauri + React + TypeScript`
- native serial bridge in the Tauri backend using `serialport`
- parses the existing NightKite CLI replies (`OK`, `ERR`, `INFO`)
- live panels for connection, configuration, patterns, diagnostics and calibration
- supports reading and changing the current firmware settings over USB serial

Implemented device actions:
- list serial ports
- connect / disconnect
- read `show`, `patterns`, `battery`, `sensor`, `timing`, `offsets`
- apply `set ...` changes for pattern, brightness, strip length, smoothing, accel range, gyro range and boot calibration
- enable / disable patterns through `enable_pattern` and `disable_pattern`
- run `save`, `load`, `defaults`, `reboot`
- run `calibrate quick` and `calibrate precise`

## Development

Frontend build:

```bash
npm install
npm run build
```

Run the desktop app in development:

```bash
npm install
npm run tauri dev
```

Create a debug app bundle:

```bash
npm run tauri build -- --debug --bundles app
```

## Notes

- The app is built against the current NightKite Multi CLI protocol.
- The full macOS `.dmg` packaging step is not set up yet, but the app binary and `.app` bundle build successfully.
