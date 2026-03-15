# NightKite Configurator

Desktop configuration tool for the NightKite Multi firmware.

Deutsch: [README Deutsch](#deutsch)  
English: [README English](#english)

## Deutsch

Desktop-Konfigurationstool für die NightKite-Multi-Firmware.

Aktueller Stand:

- `Tauri + React + TypeScript`
- native serielle Bridge im Tauri-Backend über `serialport`
- wertet bestehende NightKite-CLI-Antworten aus (`OK`, `ERR`, `INFO`)
- Live-Panels für Verbindung, Konfiguration, Optionen, Patterns, Diagnose, Kalibrierung und Terminal
- eingebundene Dokumentation in Deutsch und Englisch
- unterstützt Lesen und Ändern zentraler Firmware-Werte über USB-Serial

Implementierte Geräteaktionen:

- serielle Ports auflisten
- verbinden / trennen
- `show`, `patterns`, `battery`, `sensor`, `timing`, `offsets` lesen
- `set ...`-Änderungen für Pattern, Helligkeit, Strip-Länge, Smoothing, Accel-Range, Gyro-Range und Boot-Kalibrierung anwenden
- Patterns über `enable_pattern` und `disable_pattern` aktivieren oder deaktivieren
- `save`, `load`, `defaults`, `reboot`, `restart` ausführen
- `calibrate quick` und `calibrate precise` ausführen
- `help` und `get ...` direkt über die App nutzen

Dokumentation:

- App-Anleitung Deutsch: [docs/manual_de.md](docs/manual_de.md)
- App-Manual English: [docs/manual_en.md](docs/manual_en.md)

## Entwicklung

Frontend bauen:

```bash
npm install
npm run build
```

Desktop-App im Entwicklungsmodus starten:

```bash
npm install
npm run tauri dev
```

Debug-App-Bundle erstellen:

```bash
npm run tauri build -- --debug --bundles app
```

macOS-`dmg` erstellen:

```bash
npm run build:dmg
```

## Hinweise

- Die App ist gegen das aktuelle NightKite-Multi-CLI-Protokoll gebaut.
- Änderungen an der Firmware-CLI können Anpassungen im Parser oder in der UI erfordern.
- Der macOS-`dmg`-Build ist eingerichtet und wurde erfolgreich verifiziert.

## English

Desktop configuration tool for the NightKite Multi firmware.

Current status:

- `Tauri + React + TypeScript`
- native serial bridge in the Tauri backend using `serialport`
- parses existing NightKite CLI replies (`OK`, `ERR`, `INFO`)
- live panels for connection, configuration, options, patterns, diagnostics, calibration, and terminal access
- embedded documentation in German and English
- supports reading and changing core firmware settings over USB serial

Implemented device actions:

- list serial ports
- connect / disconnect
- read `show`, `patterns`, `battery`, `sensor`, `timing`, `offsets`
- apply `set ...` changes for pattern, brightness, strip length, smoothing, accel range, gyro range, and boot calibration
- enable / disable patterns through `enable_pattern` and `disable_pattern`
- run `save`, `load`, `defaults`, `reboot`, and `restart`
- run `calibrate quick` and `calibrate precise`
- use `help` and `get ...` directly from the app

Documentation:

- App manual German: [docs/manual_de.md](docs/manual_de.md)
- App manual English: [docs/manual_en.md](docs/manual_en.md)

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

Create a debug app bundle:

```bash
npm run tauri build -- --debug --bundles app
```

Create a macOS `dmg`:

```bash
npm run build:dmg
```

## Notes

- The app is built against the current NightKite Multi CLI protocol.
- Changes to the firmware CLI may require parser or UI updates in the configurator.
- The macOS `dmg` build is configured and has been verified successfully.
