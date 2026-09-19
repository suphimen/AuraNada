"use strict";
const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const store = require("./lib/store");
const ff = require("./lib/ffmpeg");

const APP_NAME = "AuraNada";
app.setName(APP_NAME);

// ── Startup hardening ────────────────────────────────────────
// Closes doors against reverse engineering / code injection:
// rejects an external debugger, remote debugging and web security flags.
function startupSecurity() {
  const forbidden = [
    "--inspect", "--inspect-brk", "--inspect-port",
    "--remote-debugging-port", "--remote-debugging-pipe",
    "--show-devtools", "--disable-web-security",
    "--allow-file-access", "--allow-file-access-from-files",
    "--disable-webgl", "--disable-gpu",
  ];
  const harmful = process.argv.some((arg) => {
    const lo = arg.toLowerCase();
    return forbidden.some((y) => lo === y || lo.startsWith(y + "=") || lo.startsWith(y + ":"));
  });
  if (process.env.ELECTRON_RUN_AS_NODE) {
    throw new Error("ELECTRON_RUN_AS_NODE disabled");
  }
  if (harmful) {
    throw new Error("Unsafe startup flag rejected");
  }
}
try {
  startupSecurity();
} catch (err) {
  console.error(err.message);
  app.exit(1);
}

// In every opened window: block external window/navigation,
// close devtools immediately, ignore dangerous permission requests.
app.on("web-contents-created", (_event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: "deny" }));
  contents.on("will-navigate", (e) => e.preventDefault());
  contents.on("devtools-opened", () => contents.closeDevTools());
});

// Set FFmpeg base path for bundled/unbundled scenarios
const getFfmpegBase = () => {
  // In production (packaged), ffmpeg.exe is in resources/
  // In development, it's in the project root.
  if (app.isPackaged) {
    return process.resourcesPath;
  }
  return path.join(__dirname); // project root where ffmpeg.exe sits
};
ff.setAppBaseOverride(getFfmpegBase());

const APPDATA = app.getPath("userData"); // On Windows: %APPDATA%\AuraNada
fs.mkdirSync(APPDATA, { recursive: true });
const SETTINGS_FILE = path.join(APPDATA, "settings.json");
const PROFILES_FILE = path.join(APPDATA, "profiles.json");
const HISTORY_FILE = path.join(APPDATA, "history.json");

const DEFAULT_SETTINGS = {
  lufs: "-14", bitrate: "192k", format: "m4a",
  pitch: 0.0, tempo: 0.0, watermark: false,
  stereo: true, stereo_width: 1.15,
  warmth: true, warmth_gain: 1.5,
  reverb: false, reverb_amount: 0.20,
  noise: false, noise_level: 0.08,
  kompres: false,
  metadata_mode: "Clean + Write Core Info",
  sample_rate: "44100", true_peak: "-1.0", lra: "11",
  normalize: true,
  cikti_klasor: "",
  output_dir_name: "AuraNada_Output",
};

const PRESETS = {
  "YouTube Master": { lufs: "-14", bitrate: "320k", format: "m4a", sample_rate: "48000", stereo: true, stereo_width: 1.10, warmth: true, warmth_gain: 1.2, kompres: false, reverb: false, noise: false, true_peak: "-1.0", lra: "11" },
  "Natural": { lufs: "-14", bitrate: "192k", format: "m4a", stereo: false, stereo_width: 1.00, warmth: false, warmth_gain: 0.0, kompres: false, reverb: false, noise: false, sample_rate: "44100", true_peak: "-1.0", lra: "11" },
  "High Quality": { lufs: "-16", bitrate: "320k", format: "m4a", sample_rate: "48000", stereo: true, stereo_width: 1.15, warmth: true, warmth_gain: 1.0, kompres: false, reverb: false, noise: false, true_peak: "-1.0", lra: "11" },
  "Original": { lufs: "-14", bitrate: "192k", format: "m4a", stereo: false, stereo_width: 1.00, warmth: false, warmth_gain: 0.0, kompres: false, reverb: false, noise: false, normalize: false },
  "Loud": { lufs: "-10", bitrate: "192k", format: "m4a", stereo: true, stereo_width: 1.10, warmth: true, warmth_gain: 1.0, kompres: true, reverb: false, noise: false },
};

let win;
let cancelFlag = false;

// On startup: clean up old temporary A/B preview files
function cleanupOldPreview() {
  try {
    const tmp = os.tmpdir();
    for (const isim of fs.readdirSync(tmp)) {
      if (/^AuraNada_preview_.*\.m4a$/i.test(isim)) {
        try { fs.unlinkSync(path.join(tmp, isim)); } catch {}
      }
    }
  } catch {}
}

function createWindow() {
  win = new BrowserWindow({
    width: 960, height: 700, minWidth: 880, minHeight: 600,
    backgroundColor: "#0D0E12",
    frame: false,
    icon: path.join(__dirname, "AuraNada_icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      enableExecCommandPaste: true,
      spellcheck: false,
      devTools: false,
    },
  });
  win.loadFile(path.join(__dirname, "src", "index.html"));
  win.once("ready-to-show", () => win.show());
  
  // Center window on screen
  const { screen } = require("electron");
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  const [w, h] = win.getSize();
  win.setPosition(Math.round((width - w) / 2), Math.round((height - h) / 2));
}

app.whenReady().then(() => {
  cleanupOldPreview();
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("before-quit", () => { try { ff.iptalEt(); } catch {} });

// ── Window controls ─────────────────────────────────────────
ipcMain.on("win:minimize", () => win.minimize());
ipcMain.on("win:maximize", () => (win.isMaximized() ? win.unmaximize() : win.maximize()));
ipcMain.on("win:close", () => win.close());

// ── Settings / Profiles / History ───────────────────────────
ipcMain.handle("settings:load", () => ({ ...DEFAULT_SETTINGS, ...store.load(SETTINGS_FILE, {}) }));
ipcMain.handle("settings:save", (e, s) => { store.save(SETTINGS_FILE, s); return true; });
ipcMain.handle("settings:defaults", () => ({ ...DEFAULT_SETTINGS }));
ipcMain.handle("settings:preset", (e, ad) => ({ ...DEFAULT_SETTINGS, ...(PRESETS[ad] || {}) }));

// Old preset names → new English names (+ removed Voice / Podcast)
const LEGACY_PRESET_NAMES = {
  "Doğal": "Natural",
  "Yüksek Kalite": "High Quality",
  "Yüksek Ses": "Loud",
};

// Reset: return the built-in profile to factory values
ipcMain.handle("profiles:factory", (e, ad) => ({ ...DEFAULT_SETTINGS, ...(PRESETS[ad] || {}) }));

ipcMain.handle("profiles:load", () => store.load(PROFILES_FILE, {}));
ipcMain.handle("profiles:list", async () => {
  const stored = store.load(PROFILES_FILE, {});
  delete stored["Voice / Podcast"];
  Object.keys(LEGACY_PRESET_NAMES).forEach((eski) => {
    if (stored[eski] && !stored[LEGACY_PRESET_NAMES[eski]]) stored[LEGACY_PRESET_NAMES[eski]] = stored[eski];
    delete stored[eski];
  });
  store.save(PROFILES_FILE, stored);
  const defaults = () => ({ ...DEFAULT_SETTINGS });
  const builtinNames = ["YouTube Master", "Natural", "High Quality", "Original", "Loud"];
  const profiller = [];
  for (const ad of builtinNames) {
    const eski = Object.keys(LEGACY_PRESET_NAMES).find((k) => LEGACY_PRESET_NAMES[k] === ad);
    const degiskenler = { ...(eski ? stored[eski] : {}), ...(stored[ad] || {}) };
    profiller.push({
      id: ad, name: ad, builtin: true,
      settings: { ...defaults(), ...PRESETS[ad], ...degiskenler },
    });
  }
  const bilinen = new Set([...builtinNames, ...Object.values(LEGACY_PRESET_NAMES)]);
  for (const [ad, ayar] of Object.entries(stored)) {
    if (!bilinen.has(ad)) profiller.push({ id: ad, name: ad, builtin: false, settings: { ...defaults(), ...ayar } });
  }
  return profiller;
});
ipcMain.handle("profiles:save", (e, ad, veri) => {
  const p = store.load(PROFILES_FILE, {});
  p[ad] = veri;
  store.save(PROFILES_FILE, p);
  return true;
});
ipcMain.handle("profiles:delete", (e, ad) => {
  const p = store.load(PROFILES_FILE, {});
  delete p[ad];
  store.save(PROFILES_FILE, p);
  return true;
});

// ── Dialogs ─────────────────────────────────────────────────
ipcMain.handle("dialog:folder", async (e, title) => {
  const r = await dialog.showOpenDialog(win, { title, properties: ["openDirectory"] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle("dialog:audioFile", async (e, title) => {
  const r = await dialog.showOpenDialog(win, {
    title, properties: ["openFile"],
    filters: [
      { name: "Audio Files", extensions: ["mp3", "m4a", "aac", "wav", "flac", "ogg", "opus", "wma", "aiff", "aif", "mka", "mp4", "webm"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle("shell:openPath", (e, p) => { if (p && fs.existsSync(p)) shell.openPath(p); });
ipcMain.handle("shell:openExternal", (e, url) => { if (url) shell.openExternal(url); });

// ── Folder scan ─────────────────────────────────────────────
ipcMain.handle("folder:scan", (e, klasor) => {
  const dosyalar = fs.readdirSync(klasor).filter((f) => ff.isAudio(f))
    .sort().map((f) => path.join(klasor, f));
  const namesPath = path.join(klasor, "names.txt");
  let isimler = null;
  if (fs.existsSync(namesPath)) {
    isimler = fs.readFileSync(namesPath, "utf-8").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  }
  return { count: dosyalar.length, namesFound: !!isimler, namesCount: isimler ? isimler.length : 0 };
});

// ── FFmpeg check ────────────────────────────────────────────
ipcMain.handle("ffmpeg:check", async () => ff.ffmpegVarMi());

// ── Conversion ──────────────────────────────────────────────
ipcMain.handle("convert:start", async (e, payload) => {
  const { mod, klasor, tekDosya, sarki, artist, album, cikti, settings, profilAdi } = payload;
  cancelFlag = false;

  let dosyalar = [];
  let isimler = null;
  if (mod === "tek") {
    dosyalar = [tekDosya];
  } else {
    dosyalar = fs.readdirSync(klasor).filter((f) => ff.isAudio(f)).sort().map((f) => path.join(klasor, f));
    const namesPath = path.join(klasor, "names.txt");
    if (fs.existsSync(namesPath)) {
      isimler = fs.readFileSync(namesPath, "utf-8").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    } else {
      isimler = dosyalar.map((p) => path.basename(p, path.extname(p)));
    }
    while (isimler.length < dosyalar.length) {
      const p = dosyalar[isimler.length];
      isimler.push(path.basename(p, path.extname(p)));
    }
  }

  const sonuc = await ff.convertMany(dosyalar, isimler, settings,
    { sarki, artist, album, ciktiOverride: cikti || "" },
    {
      isCancelled: () => cancelFlag,
      onProgress: (i, toplam) => win.webContents.send("convert:progress", { i, toplam }),
      onStatus: (text, kind) => win.webContents.send("convert:status", { text, kind }),
    });

  const kayitlar = store.load(HISTORY_FILE, []);
  kayitlar.push({
    tarih: new Date().toLocaleString("en-US"),
    mod,
    profil: profilAdi || "-",
    format: settings.format || "m4a",
    bitrate: settings.bitrate || "192k",
    lufs: settings.lufs || "-14",
    sample_rate: settings.sample_rate || "44100",
    normalize: settings.normalize !== false,
    efekt: [
      settings.stereo ? "Stereo" : null,
      settings.warmth ? "Warmth" : null,
      settings.kompres ? "Compression" : null,
      settings.reverb ? "Reverb" : null,
      settings.noise ? "Noise" : null,
    ].filter(Boolean).join("+") || "-",
    klasor: sonuc.klasor, cikti: sonuc.cikti,
    toplam: sonuc.toplam, basarili: sonuc.toplam - sonuc.hatalar.length,
    hatali: sonuc.hatalar.length, hataliDosyalar: sonuc.hatalar.slice(0, 20),
    sure: sonuc.sureStr, iptal: !!sonuc.iptal,
  });
  store.save(HISTORY_FILE, kayitlar.slice(-100));

  return sonuc;
});
ipcMain.on("convert:cancel", () => { cancelFlag = true; ff.iptalEt(); });

// ── Analysis ─────────────────────────────────────────────────
ipcMain.handle("analyze:file", async (e, dosya) => {
  try {
    return { ok: true, lines: await ff.analyzeFile(dosya), fileName: path.basename(dosya) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ── A/B Preview ──────────────────────────────────────────────
ipcMain.handle("ab:generate", async (e, { dosya, start, dur, settings }) => {
  const t0 = Date.now();
  const r = await ff.generateAB(dosya, start, dur, settings);
  return { ...r, elapsed: (Date.now() - t0) / 1000 };
});
