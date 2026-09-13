// Praxisbildschirm – Electron-Hauptprozess
// Sucht den Bildschirm mit 800x480 und zeigt dort die Patienteninformation im Kiosk-Modus.
'use strict';

const { app, BrowserWindow, screen, powerSaveBlocker, ipcMain, Tray, Menu, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const QRCode = require('qrcode');

const TARGET = { width: 800, height: 480 };
const args = process.argv.slice(1);
const PREVIEW = args.includes('--preview');
const SCREENSHOT_DIR = (() => {
  const i = args.findIndex(a => a === '--screenshot');
  return i >= 0 ? args[i + 1] : null;
})();

// Konfiguration: bevorzugt neben der EXE, sonst im resources-Ordner der Installation, sonst im Projektordner.
function configCandidates() {
  const list = [];
  if (process.env.PORTABLE_EXECUTABLE_DIR) list.push(path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'config.json'));
  if (app.isPackaged) list.push(path.join(path.dirname(process.execPath), 'config.json'));
  if (process.resourcesPath) list.push(path.join(process.resourcesPath, 'config.json'));
  list.push(path.join(__dirname, 'config.json'));
  return list;
}
function findConfigPath() {
  return configCandidates().find(p => fs.existsSync(p)) || path.join(__dirname, 'config.json');
}
const CONFIG_PATH = findConfigPath();

let win = null;
let tray = null;
let blockerId = null;
let watchTimer = null;

// Protokoll: Konsole + Datei (%APPDATA%\praxis-patientenbildschirm\praxisbildschirm.log) zur Fehlersuche im Praxisbetrieb
let logStream = null;
function log(...a) {
  const line = new Date().toISOString() + ' ' + a.map(x => (x instanceof Error ? x.stack : String(x))).join(' ');
  console.log(line);
  try {
    if (!logStream) {
      const dir = app.getPath('userData'); fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, 'praxisbildschirm.log');
      try { if (fs.existsSync(file) && fs.statSync(file).size > 2_000_000) fs.unlinkSync(file); } catch (_) {}
      logStream = fs.createWriteStream(file, { flags: 'a' });
    }
    logStream.write(line + '\n');
  } catch (_) { /* Protokoll ist optional */ }
}
process.on('uncaughtException', e => log('Unerwarteter Fehler:', e));
process.on('unhandledRejection', e => log('Unbehandelte Promise-Ablehnung:', e));

// ---------- Konfiguration laden + QR-Codes vorrendern ----------
async function loadConfig() {
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (e) {
    log('Konfiguration fehlerhaft:', e.message);
    cfg = { error: 'config.json konnte nicht gelesen werden: ' + e.message, scenes: [], ticker: [] };
  }
  const qrOpts = { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#013D4B', light: '#00000000' } };
  const configDir = path.dirname(CONFIG_PATH);
  for (const s of cfg.scenes || []) {
    if (s.qr) {
      try { s.qrSvg = await QRCode.toString(s.qr, qrOpts); } catch (e) { log('QR-Fehler', s.id, e.message); }
    }
    // Eigene Bilder: liegt die Datei neben der config.json (z. B. "bilder/foto.jpg" oder absoluter Pfad),
    // wird sie von dort geladen; sonst gilt der Pfad relativ zum eingebauten renderer-Ordner.
    const externalUrl = (p) => {
      if (!p || /^[a-z]+:/i.test(p)) return null;
      const abs = path.isAbsolute(p) ? p : path.join(configDir, p);
      return (fs.existsSync(abs) && !abs.startsWith(path.join(__dirname, 'renderer'))) ? pathToFileURL(abs).href : null;
    };
    const imgUrl = externalUrl(s.image);
    if (imgUrl) s.imageUrl = imgUrl;
    const vidUrl = externalUrl(s.video);
    if (vidUrl) s.videoUrl = vidUrl;
    for (const p of s.persons || []) { const u = externalUrl(p.photo); if (u) p.photoUrl = u; }
  }
  cfg.__configPath = CONFIG_PATH;
  cfg.__preview = PREVIEW;
  return cfg;
}

// ---------- Display-Erkennung ----------
function isTargetDisplay(d) {
  const pairs = [
    [d.size.width, d.size.height],
    [d.bounds.width, d.bounds.height],
    [Math.round(d.size.width * d.scaleFactor), Math.round(d.size.height * d.scaleFactor)],
    [d.workAreaSize.width, d.workAreaSize.height],
  ];
  return pairs.some(([w, h]) => w === TARGET.width && h === TARGET.height);
}
function findTargetDisplay() {
  const all = screen.getAllDisplays();
  const found = all.find(isTargetDisplay);
  log('Displays:', all.map(d => `${d.id}:${d.size.width}x${d.size.height}@${d.bounds.x},${d.bounds.y} sf=${d.scaleFactor}`).join(' | '), '=> Ziel:', found ? found.id : 'keins');
  return found || null;
}

// ---------- Fenster ----------
function createWindow(display) {
  if (win) return;
  const opts = {
    show: false,
    frame: false,
    backgroundColor: '#FDF8F5',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  };
  if (PREVIEW) {
    Object.assign(opts, { width: TARGET.width, height: TARGET.height, useContentSize: true, resizable: false, frame: true, title: 'Praxisbildschirm – Vorschau 800x480' });
  } else {
    Object.assign(opts, {
      x: display.bounds.x, y: display.bounds.y,
      width: display.bounds.width, height: display.bounds.height,
      kiosk: true, fullscreen: true, alwaysOnTop: true, skipTaskbar: true,
      focusable: false, minimizable: false, movable: false,
    });
  }
  win = new BrowserWindow(opts);
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => {
    if (PREVIEW) { win.setContentSize(TARGET.width, TARGET.height); win.show(); } else win.showInactive();
    if (!PREVIEW && display) win.setBounds(display.bounds); // sicherheitshalber nochmal auf das Zieldisplay
  });
  win.on('closed', () => { win = null; });
  win.webContents.on('render-process-gone', () => {
    log('Renderer abgestuerzt - Neustart');
    if (win) { win.destroy(); win = null; }
    ensureWindow();
  });
  if (PREVIEW) {
    win.webContents.on('before-input-event', (e, input) => { if (input.key === 'Escape') app.quit(); });
  }
  if (blockerId === null) blockerId = powerSaveBlocker.start('prevent-display-sleep');
}

function ensureWindow() {
  if (PREVIEW) { createWindow(null); return; }
  const d = findTargetDisplay();
  if (d && !win) createWindow(d);
  else if (d && win) {
    const b = win.getBounds();
    if (b.x !== d.bounds.x || b.y !== d.bounds.y) win.setBounds(d.bounds);
  } else if (!d && win) { log('Zieldisplay entfernt - Fenster wird geschlossen'); win.destroy(); win = null; }
}

// ---------- Screenshot-Modus (zur Kontrolle jeder Szene) ----------
async function screenshotRun() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(1500);
  const n = await win.webContents.executeJavaScript('window.__praxis.sceneCount()');
  for (let i = 0; i < n; i++) {
    await win.webContents.executeJavaScript(`window.__praxis.goto(${i})`);
    await wait(2800);
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(SCREENSHOT_DIR, `scene-${String(i + 1).padStart(2, '0')}.png`), img.toPNG());
    const vids = await win.webContents.executeJavaScript(`[...document.querySelectorAll('video')].map(v => ({ src: v.getAttribute('src'), t: v.currentTime.toFixed(2), paused: v.paused, ready: v.readyState, err: v.error ? v.error.code : null }))`);
    if (vids.length) log('Szene', i + 1, 'Video:', JSON.stringify(vids));
  }
  log('Screenshots gespeichert in', SCREENSHOT_DIR);
  app.quit();
}

// ---------- Autostart (Windows-Anmeldung) ----------
function autostartEnabled() { try { return app.getLoginItemSettings().openAtLogin; } catch (_) { return false; } }
function setAutostart(on) {
  try { app.setLoginItemSettings({ openAtLogin: on, name: 'Praxisbildschirm' }); log('Autostart', on ? 'aktiviert' : 'deaktiviert'); }
  catch (e) { log('Autostart nicht moeglich:', e.message); }
}
function ensureAutostartDefault() {
  // Beim ersten Start der installierten Version Autostart aktivieren; danach entscheidet die Tray-Einstellung.
  if (!app.isPackaged) return;
  const marker = path.join(app.getPath('userData'), 'autostart-initialisiert');
  if (fs.existsSync(marker)) return;
  setAutostart(true);
  try { fs.mkdirSync(path.dirname(marker), { recursive: true }); fs.writeFileSync(marker, new Date().toISOString()); } catch (_) {}
}

// ---------- Tray ----------
function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: 'Neu laden', click: () => win && win.webContents.reload() },
    { label: 'Konfiguration oeffnen (config.json)', click: () => shell.openPath(CONFIG_PATH) },
    { label: 'Bildschirme erneut suchen', click: ensureWindow },
    { label: 'Protokoll oeffnen', click: () => shell.openPath(path.join(app.getPath('userData'), 'praxisbildschirm.log')) },
    { type: 'separator' },
    { label: 'Automatisch mit Windows starten', type: 'checkbox', checked: autostartEnabled(), click: (item) => { setAutostart(item.checked); tray.setContextMenu(buildTrayMenu()); } },
    { type: 'separator' },
    { label: 'Beenden', click: () => app.quit() },
  ]);
}
function createTray() {
  try {
    const icon = nativeImage.createFromPath(path.join(__dirname, 'renderer', 'assets', 'logo.png')).resize({ width: 16, height: 16 });
    tray = new Tray(icon);
    tray.setToolTip('Praxisbildschirm (Patienteninfo)');
    tray.setContextMenu(buildTrayMenu());
  } catch (e) { log('Tray nicht moeglich:', e.message); }
}

// ---------- IPC ----------
ipcMain.handle('get-config', loadConfig);

// ---------- Start ----------
if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  app.on('second-instance', () => ensureWindow());
  app.whenReady().then(() => {
    log('Start', app.getVersion(), app.isPackaged ? '(installiert)' : '(Entwicklung)', 'Konfiguration:', CONFIG_PATH);
    ensureWindow();
    if (!PREVIEW) { ensureAutostartDefault(); createTray(); }
    screen.on('display-added', () => setTimeout(ensureWindow, 1500));
    screen.on('display-removed', () => setTimeout(ensureWindow, 1500));
    screen.on('display-metrics-changed', () => setTimeout(ensureWindow, 1500));
    watchTimer = setInterval(ensureWindow, 15000);

    // Konfiguration live nachladen, sobald config.json gespeichert wird
    let debounce = null;
    try {
      fs.watch(path.dirname(CONFIG_PATH), (ev, file) => {
        if (file !== path.basename(CONFIG_PATH)) return;
        clearTimeout(debounce);
        debounce = setTimeout(async () => { if (win) win.webContents.send('config-updated', await loadConfig()); }, 400);
      });
    } catch (e) { log('Datei-Ueberwachung nicht moeglich:', e.message); }

    if (SCREENSHOT_DIR && win) win.webContents.once('did-finish-load', screenshotRun);
  });
  // Im Kiosk-Modus weiterlaufen und auf das Display warten; nur die Vorschau beendet sich.
  app.on('window-all-closed', () => { if (PREVIEW) app.quit(); });
  app.on('before-quit', () => { clearInterval(watchTimer); });
}
