# Praxisbildschirm – Patienteninformation für den 800×480-Zweitbildschirm

Animierte Dauerschleife mit Praxis-Informationen (Hausarztmodell, Online-Angebote, Google-Bewertung, Grippeimpfung, Terminhinweise) für den kleinen, den Patienten zugewandten Bildschirm am Anmeldungs-PC.

Das Programm sucht beim Start automatisch den Bildschirm mit **800 × 480 Pixeln** und zeigt die Anzeige nur dort im Vollbild an. Der Hauptbildschirm bleibt unberührt. Wird der kleine Bildschirm später angesteckt oder abgezogen, reagiert das Programm von selbst (alle 15 Sekunden bzw. bei Display-Änderungen).

## Praxisbetrieb (EXE)

1. `dist\Praxisbildschirm-Setup-1.0.0.exe` auf den Anmeldungs-PC kopieren und doppelklicken. Der Installer läuft ohne Rückfragen durch (Installation nur für den angemeldeten Benutzer, keine Adminrechte nötig) und startet die Anzeige sofort auf dem 800×480-Bildschirm.
2. Beim ersten Start trägt sich das Programm selbst in den **Windows-Autostart** ein – nach jeder Anmeldung läuft die Anzeige automatisch. Das lässt sich im Tray-Menü abschalten.
3. Die Inhalte liegen in `config.json` im Installationsordner (`%LOCALAPPDATA%\Programs\praxis-patientenbildschirm\resources\config.json`) – am einfachsten über das Tray-Menü **Konfiguration öffnen** erreichbar.

Im Infobereich der Taskleiste (neben der Uhr) erscheint ein kleines Praxislogo. Rechtsklick darauf bietet: **Neu laden**, **Konfiguration öffnen**, **Bildschirme erneut suchen**, **Protokoll öffnen**, **Automatisch mit Windows starten** (an/aus), **Beenden**.

Neue Version einspielen: einfach den neuen Setup-Installer ausführen – er ersetzt das Programm. Achtung: Eine angepasste `config.json` vorher sichern, da der Installer die mitgelieferte Standardkonfiguration wieder einspielt.

Deinstallation über „Apps & Features“ (Eintrag „Praxisbildschirm (Patienteninfo)“).

Das Fenster nimmt niemals den Fokus – die MFAs können am Hauptbildschirm ungestört weiterarbeiten. Der Bildschirmschoner / Energiesparmodus des Displays wird unterdrückt, solange das Programm läuft.

## Inhalte anpassen (`config.json`)

Die Datei `config.json` kann mit jedem Texteditor bearbeitet werden (Tray-Menü → Konfiguration öffnen). Nach dem Speichern lädt die Anzeige **automatisch** neu – kein Neustart nötig. Eine `config.json` direkt neben der `Praxisbildschirm.exe` hat Vorrang, falls man die Inhalte lieber dort pflegt.

```jsonc
{
  "praxis":  { "name": "...", "subtitle": "..." },     // Kopfzeile
  "timing":  { "defaultDuration": 12, "tickerInterval": 8 },  // Sekunden
  "ticker":  [ "Hinweis 1", "Hinweis 2", ... ],       // Laufleiste unten, wechselt durch
  "scenes":  [ ... ]                                   // Szenen in Reihenfolge der Schleife
}
```

Jede Szene hat:

| Feld | Bedeutung |
|---|---|
| `type` | `welcome`, `hero`, `steps`, `qr`, `team` oder `stars` (siehe unten) |
| `enabled` | `false` = Szene wird übersprungen |
| `duration` | Anzeigedauer in Sekunden |
| `theme` | `light` (hell, Warmweiß) oder `dark` (Petrolblau) |
| `from` / `until` | optional, Format `MM-TT`: Szene nur in diesem Zeitraum zeigen (z. B. Grippe `09-01` bis `01-31`) |
| `badge` | kleines Schlagwort über dem Titel |
| `title` | Überschrift (kurz halten, max. ca. 35 Zeichen) |
| `text` | Fließtext (1–2 Sätze) |
| `bullets` | Liste mit Häkchen (max. 4) |
| `cta` | hervorgehobener Handlungshinweis unten |
| `image` | Illustration rechts (`assets/img/…` eingebaut, oder eigene Datei neben der EXE, z. B. `bilder/foto.jpg`) |
| `imagePosition` | Bildausschnitt, z. B. `"60% 50%"` (Standard `center`) |
| `video` | animierte Version der Illustration (WebM, stumm, läuft in Schleife); `image` dient dann als Standbild bis das Video geladen ist |
| `persons` | nur Typ `team`: Liste `{ "name", "role", "text", "photo" }`; ohne `photo` werden die Initialen gezeigt, sonst z. B. `"bilder/darian.jpg"` neben der EXE |
| `qr` | Link, der als QR-Code angezeigt wird; `qrLabel` und `qrHint` beschriften ihn |
| `steps` | nur Typ `steps`: drei Karten `{ "icon", "title", "text" }`; Icons: `chat`, `pen`, `check`, `calendar`, `video`, `phone`, `syringe`, `heart`, `clock` |

Szenentypen:

- **welcome** – Logo mit Puls-Ringen, große Begrüßung.
- **hero** – Titel + Text oder Bullets links, Illustration rechts (mit langsamem Zoom), optional kleiner QR-Code im Bild.
- **steps** – Titel + drei Karten (z. B. „So einfach geht's“).
- **qr** – Titel + Bullets links, großer QR-Code mit Scan-Animation rechts.
- **team** – Vorstellung neuer Teammitglieder als Karten (Foto oder Initialen, Name, Funktion).
- **stars** – dunkle Szene, fünf Sterne springen nacheinander ein, QR-Code zur Google-Bewertung.

Aktuelle Schleife (ca. 4,5 Minuten): Willkommen → Hausarztmodell → HZV „So einfach geht's" → Online-Angebote (QR) → Mit Termin geht's schneller → Infektsprechstunde → Grippeimpfung (nur Sept.–Jan.) → Vorsorge/IGeL → Videosprechstunde → Neu im Team → Google-Bewertung. Jede Szene steht 20–30 Sekunden.

**Google-Bewertungslink:** Aktuell zeigt der QR-Code auf die Google-Maps-Suche der Praxis (wie auf der Website). Wenn ein direkter „Rezension schreiben“-Link vorliegt (Google Business Profile → „Mehr Rezensionen erhalten“ → Link kopieren, Form `https://g.page/r/…/review`), diesen in der Szene `bewertung` unter `qr` eintragen – dann landet der Patient direkt im Bewertungsformular.

## Entwicklung

Voraussetzung: Node.js (getestet mit v24).

```bash
npm install
npm run preview      # 800x480-Fenster auf dem Hauptbildschirm, Esc beendet
npm start            # Kiosk-Modus auf dem 800x480-Display
npm run build        # Ein-Klick-Installer (NSIS) nach dist/
```

Kontrolle aller Szenen als Screenshots: `electron . --preview --screenshot <Ordner>`.

Dateien:

- `main.js` – Display-Erkennung, Kiosk-Fenster, Tray, Konfigurations-Überwachung, QR-Erzeugung
- `renderer/app.js` – Szenen-Engine (Vorlagen, Übergänge, Ticker, Uhr)
- `renderer/style.css` – Gestaltung nach Praxis-CI (Petrolblau `#025669`, Kupfer `#BB4E26`, Merriweather / Arial)
- `renderer/assets/img/` – Illustrationen (erzeugt mit Z-Image Turbo über ComfyUI, Palette der Praxis-CI)
- `config.json` – Inhalte
