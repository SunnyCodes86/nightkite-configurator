# NightKite Configurator Anleitung

Diese Anleitung beschreibt die Desktop-App `NightKite Configurator` und erklärt, wie du den Controller über USB mit der grafischen Oberfläche bedienst.

Die Firmware- und Gerätefunktionen selbst sind in der separaten Controller-Dokumentation beschrieben. Diese App baut direkt auf der vorhandenen NightKite-CLI auf und macht deren wichtigste Funktionen grafisch nutzbar.

## Überblick

Der Configurator ist eine Desktop-App auf Basis von `Tauri`, `React` und `TypeScript`.  
Er verbindet sich per serieller USB-Schnittstelle mit dem NightKite-Controller und wertet die CLI-Antworten der Firmware aus.

Die App bietet unter anderem:

- Verbindung mit dem Controller über einen auswählbaren seriellen Port
- Live-Anzeige und Änderung zentraler Konfigurationswerte
- Aktivieren, Deaktivieren und direktes Umschalten von Patterns
- umschaltbare Pattern-Ansicht in `Kompakt` oder `Komfort`
- lokalisierte Pattern-Namen passend zur gewählten App-Sprache
- Grafisch aufbereitete Diagnosewerte für Akku, Sensor, Timing und Offsets
- Kalibrierung, Neustart und direkte CLI-Eingabe über ein integriertes Terminal
- Eingebundene Dokumentation in Deutsch oder Englisch

## Voraussetzungen

Für die Nutzung der App brauchst du:

- einen NightKite-Controller mit aktueller Firmware
- eine aktive USB-Verbindung zum Computer
- einen verfügbaren seriellen Port

Für die Entwicklung zusätzlich:

- `Node.js` und `npm`
- Rust-Toolchain mit Cargo
- die Tauri-Voraussetzungen für dein Betriebssystem

## App-Bereiche

## Verbindung

Im Bereich `Verbindung` wählst du den seriellen Port des Controllers aus.

Funktionen:

- `Ports aktualisieren`: liest die verfügbaren Ports neu ein
- `Verbinden`: öffnet die serielle Verbindung und liest die Gerätedaten
- `Trennen`: beendet die Verbindung wieder

Der Status zeigt an, ob aktuell eine aktive serielle Sitzung besteht.

## Konfiguration

Im Bereich `Konfiguration` bearbeitest du die wichtigsten Firmware-Einstellungen.

Felder:

- `Aktives Pattern`
- `Helligkeit`
- `Strip-Länge`
- `Smoothing`
- `Accel-Range`
- `Gyro-Range`
- `Boot-Kalibrierung`

Aktionen:

- `Controller lesen`
- `Änderungen anwenden`
- `Auf Controller speichern`
- `Gespeichertes laden`
- `Standardwerte`

Wichtige Hinweise:

- `Helligkeit` wird direkt live auf der Hardware angewendet.
- Einige Einstellungen greifen vollständig erst nach einem Neustart.
- Die App zeigt dafür einen Hinweis `Neustart nötig`.

## Optionen

Im Bereich `Optionen` stellst du das Verhalten der App ein.

Funktionen:

- Umschalten der Sprache zwischen Deutsch und Englisch
- Aktivieren oder Deaktivieren des automatischen Refreshs
- Einstellen des Refresh-Intervalls in Sekunden
- Umschalten der Pattern-Ansicht zwischen `Kompakt` und `Komfort`

Die Sprachwahl beeinflusst sowohl die Oberfläche als auch die eingebundene Anleitung in der App.
Auch die Pattern-Namen werden in der Oberfläche passend zur gewählten Sprache lokalisiert angezeigt.
Die gewählte Pattern-Ansicht wird lokal in der App gespeichert. Standardmäßig startet die App in der `Kompakt`-Ansicht.

## Patterns

Im Bereich `Patterns` verwaltest du die verfügbaren Firmware-Patterns.

Je Pattern-Zeile siehst du:

- ID und Namen
- ob das Pattern im Button-Zyklus aktiviert ist
- ob es aktuell live aktiv ist
- in der `Komfort`-Ansicht zusätzlich eine kurze Beschreibung des Patterns

Aktionen:

- Pattern im Button-Zyklus ein- oder ausschalten
- Pattern-Ansicht zwischen einer platzsparenden Tabellenform und größeren Komfort-Karten umschalten
- `Aktivieren`: Pattern sofort live auf der Hardware setzen
- `Alle aktivieren`
- `Pattern-Liste lesen`
- `Auswahl anwenden`

In der `Kompakt`-Ansicht sind die Checkboxen bewusst etwas größer dargestellt, damit die schnelle Bedienung mit vielen Pattern einfacher bleibt.
Die `Komfort`-Ansicht orientiert sich am gleichen Grundaufbau, bietet aber mehr Platz für Namen und Beschreibung.

## Diagnose

Im Bereich `Diagnose` werden Live-Daten der Hardware grafisch dargestellt.

Teilbereiche:

- `Akku`: Spannung, Rohwert und Ladezustand
- `USB Power` und `Serielle Sitzung`
- `Sensorstatus`: MPU-, DMP- und Gerätestatus sowie aktive Sensorwerte
- `Timing`: Loop- und Work-Metriken der Firmware
- `Offsets`: aktuell verwendete Sensor-Offsets

Jeder Bereich besitzt einen eigenen Refresh-Button, um nur diesen Teil gezielt neu zu laden.

## Kalibrierung und CLI

Im unteren Bereich findest du Wartungs- und CLI-Funktionen.

Aktionen:

- `Quick-Kalibrierung`
- `Präzise Kalibrierung`
- `Gerät neu starten`
- `Restart Alias`
- `CLI-Hilfe anzeigen`
- einzelne Werte über `get` lesen
- freie CLI-Befehle im Terminal senden

Das Terminal:

- zeigt Antworten mit Zeitstempel
- scrollt bei neuen Einträgen automatisch nach unten
- eignet sich für direkte Befehle wie `help`, `show`, `get pattern`, `set brightness 127`

## Eingebundene Anleitung

Die App lädt die passende Anleitung automatisch passend zur gewählten Sprache:

- Deutsch: `manual_de.md`
- Englisch: `manual_en.md`

So bleibt die Dokumentation direkt in der Oberfläche verfügbar.

## Typischer Ablauf

Ein üblicher Arbeitsablauf sieht so aus:

1. Controller per USB anschließen
2. Seriellen Port in `Verbindung` auswählen
3. `Verbinden`
4. Konfiguration und Diagnosewerte prüfen
5. Pattern oder Helligkeit live testen
6. Weitere Einstellungen anpassen
7. Änderungen bei Bedarf mit `Auf Controller speichern` dauerhaft sichern

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

Rust-Backend prüfen:

```bash
cd src-tauri
cargo check --bins
```

## Hinweise für GitHub-Nutzer

- Der Configurator spricht direkt mit der vorhandenen CLI der Firmware.
- Änderungen an der Firmware können Auswirkungen auf die App-Parser haben.
- Wenn neue CLI-Kommandos oder Antwortformate hinzukommen, sollten App und Dokumentation gemeinsam aktualisiert werden.
