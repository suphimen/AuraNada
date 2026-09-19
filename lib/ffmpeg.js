"use strict";
// Direct Node.js counterpart of the filter-chain / loudnorm-pass1 / batch
// processing logic in the original Python main.py.

const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn, execFile } = require("child_process");

const AUDIO_EXTS = new Set([
  ".mp3", ".m4a", ".aac", ".wav", ".flac", ".ogg", ".opus",
  ".wma", ".aiff", ".aif", ".alac", ".mka", ".mp4", ".webm",
]);

let _appBaseOverride = null;

function setAppBaseOverride(p) {
  _appBaseOverride = p;
}

function isAudio(p) {
  return AUDIO_EXTS.has(path.extname(p).toLowerCase());
}

function safeFilename(name) {
  const cleaned = String(name).replace(/[\\/:*?"<>|]/g, "_").trim().replace(/\.+$/, "");
  return cleaned || "track";
}

function uniquePath(p) {
  if (!fs.existsSync(p)) return p;
  const ext = path.extname(p);
  const base = p.slice(0, -ext.length || undefined);
  let i = 1;
  while (true) {
    const candidate = `${base} (${i})${ext}`;
    if (!fs.existsSync(candidate)) return candidate;
    i++;
  }
}

function appBase() {
  if (_appBaseOverride && fs.existsSync(path.join(_appBaseOverride, "ffmpeg.exe"))) {
    return _appBaseOverride;
  }
  // If packaged (electron-builder): resources folder; in dev: project root.
  const candidates = [
    process.resourcesPath,
    path.join(process.resourcesPath, "app"),
    path.join(__dirname, ".."),
    path.join(__dirname, "..", ".."),
    path.join(__dirname, "..", "resources"), // build.bat copies to dist/win-unpacked/resources
    (typeof require !== "undefined" && require("electron").app?.getAppPath?.()) || "",
  ].filter(Boolean);
  
  for (const base of candidates) {
    if (base && fs.existsSync(path.join(base, "ffmpeg.exe"))) {
      return base;
    }
  }
  return __dirname.replace(/lib$/, "");
}

function ffmpegExe() {
  const p = path.join(appBase(), "ffmpeg.exe");
  return fs.existsSync(p) ? p : "ffmpeg";
}

function ffprobeExe() {
  const p = path.join(appBase(), "ffprobe.exe");
  return fs.existsSync(p) ? p : "ffprobe";
}

function ffmpegVarMi() {
  return new Promise((resolve) => {
    execFile(ffmpegExe(), ["-version"], { timeout: 5000, windowsHide: true }, (err) => resolve(!err));
  });
}

async function writeMetadata(dosya, tags) {
  const ext = path.extname(dosya);
  const tmp = dosya.replace(/[^\\/]+$/, (m) => m + ".meta") + ext;
  const args = ["-i", dosya, "-map", "0:a", "-c", "copy"];
  for (const [k, v] of Object.entries(tags)) {
    if (v) args.push("-metadata", `${k}=${v}`);
  }
  args.push("-y", tmp);
  const r = await runFF(args);
  if (r.code === 0 && fs.existsSync(tmp)) {
    fs.renameSync(tmp, dosya);
    return true;
  }
  try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch {}
  return false;
}

// ── Cancellable ffmpeg processes ────────────────────────────────────────
// When "Cancel" is pressed during conversion, the running ffmpeg process is
// also actually killed (taskkill /T /F). Long files are not waited for.
const aktifSurecler = new Set();
const MAKS_CAPTI = 1024 * 1024 * 32; // output cap: 32 MB

function runFF(args) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(ffmpegExe(), args, { windowsHide: true });
    } catch (err) {
      return resolve({ code: 1, stdout: "", stderr: String((err && err.message) || err) });
    }
    aktifSurecler.add(child);
    let stdout = "", stderr = "";
    const yapistir = (buf, tara) => {
      const ek = buf.toString();
      const birlesik = tara + ek;
      return birlesik.length > MAKS_CAPTI ? birlesik.slice(-MAKS_CAPTI) : birlesik;
    };
    child.stdout.on("data", (d) => { stdout = yapistir(d, stdout); });
    child.stderr.on("data", (d) => { stderr = yapistir(d, stderr); });
    child.on("error", (err) => {
      aktifSurecler.delete(child);
      resolve({ code: (err && err.code) || 1, stdout, stderr });
    });
    child.on("close", (code) => {
      aktifSurecler.delete(child);
      resolve({ code: code === null ? 1 : code, stdout, stderr });
    });
  });
}

// Immediately terminates all active ffmpeg processes (including sub-trees).
function iptalEt() {
  for (const cp of [...aktifSurecler]) {
    if (!cp || !cp.pid) continue;
    try {
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(cp.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
      }
      cp.kill("SIGKILL");
    } catch {}
  }
  aktifSurecler.clear();
}

function runFFProbeJson(args) {
  return new Promise((resolve, reject) => {
    execFile(ffprobeExe(), args, { windowsHide: true, maxBuffer: 1024 * 1024 * 16 },
      (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr || err.message));
        try { resolve(JSON.parse(stdout)); } catch (e) { reject(e); }
      });
  });
}

// ── Filter chain (exact Python _filtre_zinciri_olustur counterpart) ──────
function buildFilterChain(s, { watermark = true, loudnormOverride = null } = {}) {
  const filters = [];
  if (watermark && s.watermark) {
    // Deterministic creative pitch/tempo adjustment only. Does not bypass
    // provenance, fingerprinting or DRM.
    const pitchCent = parseFloat(s.pitch) || 0;
    const tempoPct = parseFloat(s.tempo) || 0;
    if (Math.abs(pitchCent) > 0.01) {
      const rate = Math.round(48000 * Math.pow(2, pitchCent / 1200));
      filters.push(`asetrate=${rate}`, "aresample=48000");
    }
    if (Math.abs(tempoPct) > 0.001) {
      filters.push(`atempo=${(1.0 + tempoPct / 100.0).toFixed(5)}`);
    }
  }
  if (s.stereo) {
    const w = Number(s.stereo_width).toFixed(2);
    filters.push(`stereotools=mode=1,stereotools=slev=${w}:mode=2`);
  }
  if (s.warmth) {
    const g = Number(s.warmth_gain);
    filters.push(`equalizer=f=250:width_type=o:width=2:g=${g.toFixed(1)}`,
                 `equalizer=f=10000:width_type=o:width=1:g=${(-g * 0.4).toFixed(1)}`);
  }
  if (s.kompres) {
    filters.push("acompressor=threshold=-18dB:ratio=2:attack=20:release=200:makeup=1.5");
  }
  if (s.reverb) {
    const a = Number(s.reverb_amount);
    filters.push(`aecho=0.8:0.85:${Math.round(a * 60)}:${(a * 0.15).toFixed(2)}`);
  }
  if (s.noise) {
    const n = Number(s.noise_level);
    filters.push(`aeval=val(0)+random(0)*${(n * 0.002).toFixed(6)}:c=same`);
  }
  if (s.normalize !== false) {
    if (loudnormOverride) {
      filters.push(loudnormOverride);
    } else {
      filters.push(`loudnorm=I=${s.lufs}:TP=${s.true_peak}:LRA=${s.lra}`);
      filters.push("alimiter=limit=0.891:level=false:attack=5:release=50");
    }
  }
  return filters.join(",");
}

async function loudnormPass1(dosya, s) {
  const args = ["-i", dosya, "-map", "0:a",
    "-af", `loudnorm=I=${s.lufs}:TP=${s.true_peak}:LRA=${s.lra}:print_format=json`,
    "-f", "null", "-"];
  const r = await runFF(args);
  const out = r.stderr + r.stdout;
  const g = (key) => {
    const m = out.match(new RegExp(`"${key}"\\s*:\\s*"([-0-9.]+)"`));
    return m ? m[1] : null;
  };
  const vals = ["input_i", "input_lra", "input_tp", "input_thresh", "target_offset"].map(g);
  return vals.every(Boolean) ? vals : null;
}

const CODEC_ARGS = (ext, bitrate) => ({
  mp3: ["-c:a", "libmp3lame", "-b:a", bitrate],
  m4a: ["-c:a", "aac", "-b:a", bitrate, "-movflags", "+faststart"],
  aac: ["-c:a", "aac", "-b:a", bitrate],
  wav: ["-c:a", "pcm_s24le"],
  flac: ["-c:a", "flac"],
  ogg: ["-c:a", "libvorbis", "-b:a", bitrate],
  opus: ["-c:a", "libopus", "-b:a", bitrate],
}[ext] || ["-c:a", "aac", "-b:a", bitrate]);

// ── Batch conversion (exact Python _coklu_isle counterpart) ──────────────
async function convertMany(dosyalar, isimler, s, meta, hooks) {
  const toplam = dosyalar.length;
  const hatalar = [];
  const baslangic = Date.now();
  const ext = s.format;
  let i = 0;
  let sonCiktiKlasoru = "";

  for (i = 0; i < toplam; i++) {
    if (hooks.isCancelled()) break;
    const dosya = dosyalar[i];
    let isim = (isimler && isimler[i]) || meta.sarki || path.basename(dosya, path.extname(dosya));

    if (i > 0) {
      const gecen = (Date.now() - baslangic) / 1000;
      const kalan = Math.round((gecen / i) * (toplam - i));
      hooks.onStatus(`~${kalan}s remaining`, "sure");
    }
    hooks.onStatus(`[${i + 1}/${toplam}]  ${isim} — analyzing...`, "durum");

    hooks.onProgress(i, toplam);
    let loudnormAf = null;
    if (s.normalize !== false) {
      const p1 = await loudnormPass1(dosya, s);
      hooks.onProgress(i + 0.4, toplam);
      if (p1) {
        const [mi, mlra, mtp, mthresh, moffset] = p1;
        loudnormAf = `loudnorm=I=${s.lufs}:TP=${s.true_peak}:LRA=${s.lra}:linear=true:` +
          `measured_I=${mi}:measured_LRA=${mlra}:measured_TP=${mtp}:` +
          `measured_thresh=${mthresh}:offset=${moffset},` +
          `alimiter=limit=0.891:level=false:attack=5:release=50`;
      } else {
        loudnormAf = `loudnorm=I=${s.lufs}:TP=${s.true_peak}:LRA=${s.lra},` +
          `alimiter=limit=0.891:level=false:attack=5:release=50`;
      }
    }

    if (hooks.isCancelled()) break;
    hooks.onStatus(`[${i + 1}/${toplam}]  ${isim}`, "durum");

    const outputDirName = s.output_dir_name || "AuraNada_Output";
    const ciktiYolu = meta.ciktiOverride || path.join(path.dirname(dosya), outputDirName);
    fs.mkdirSync(ciktiYolu, { recursive: true });
    sonCiktiKlasoru = ciktiYolu;
    isim = safeFilename(isim);
    const ciktiDosya = uniquePath(path.join(ciktiYolu, `${isim}.${ext}`));

    const metaArgs = [];
    if (s.metadata_mode !== "Completely Clear") {
      if (meta.album) metaArgs.push("-metadata", `album=${meta.album}`);
      if (meta.artist) metaArgs.push("-metadata", `artist=${meta.artist}`);
      metaArgs.push("-metadata", `title=${isim}`);
    }
    const metaPrefix = s.metadata_mode === "Keep Protected Tags"
      ? ["-map_metadata", "0"] : ["-map_metadata", "-1"];

    const af = buildFilterChain(s, { loudnormOverride: loudnormAf });
    const args = ["-i", dosya, ...metaPrefix, "-map", "0:a", ...metaArgs];
    if (af) args.push("-af", af);
    args.push("-ar", String(s.sample_rate), ...CODEC_ARGS(ext, s.bitrate), "-y", ciktiDosya);
    const r = await runFF(args);
    if (r.code !== 0) hatalar.push(isim);
    hooks.onProgress(i + 1, toplam);
  }

  const toplamSure = Math.round((Date.now() - baslangic) / 1000);
  const sureStr = toplamSure >= 60 ? `${Math.floor(toplamSure / 60)}d ${toplamSure % 60}s` : `${toplamSure}s`;

  return {
    islenen: hooks.isCancelled() ? i : toplam,
    toplam, hatalar, sureStr,
    cikti: meta.ciktiOverride || sonCiktiKlasoru || (dosyalar[0] ? path.join(path.dirname(dosyalar[0]), "AAC") : ""),
    iptal: hooks.isCancelled(),
    klasor: dosyalar[0] ? path.dirname(dosyalar[0]) : "",
  };
}

// ── Analysis (ffprobe + ffmpeg loudnorm/astats) ─────────────────────────
async function analyzeFile(dosya) {
  // First get basic info via ffprobe
  const d = await runFFProbeJson(["-v", "quiet", "-print_format", "json", "-show_streams", "-show_format", dosya]);
  const streams = d.streams || [];
  const s = streams.find((x) => x.codec_type === "audio") || streams[0] || {};
  const fmt = d.format || {};
  const tags = fmt.tags || {};
  const size = fs.statSync(dosya).size / 1024 / 1024;
  const dur = parseFloat(fmt.duration || 0) || 0;
  const codec = s.codec_name || "?";
  const sr = s.sample_rate || "?";
  const ch = s.channels || "?";
  const bitrate = fmt.bit_rate || "?";

  const enc = String(tags.encoder || "");

  // Run loudnorm analysis pass 1 for loudness metrics
  let loudnessData = null;
  try {
    const lnArgs = ["-i", dosya, "-map", "0:a", "-af", "loudnorm=print_format=json", "-f", "null", "-"];
    const r = await runFF(lnArgs);
    const out = r.stderr + r.stdout;
    const g = (key) => {
      const m = out.match(new RegExp(`"${key}"\\s*:\\s*"([-0-9.]+)"`));
      return m ? parseFloat(m[1]) : null;
    };
    const input_i = g("input_i");
    const input_tp = g("input_tp");
    const input_lra = g("input_lra");
    const input_thresh = g("input_thresh");
    const target_offset = g("target_offset");
    if (input_i !== null) {
      loudnessData = { input_i, input_tp, input_lra, input_thresh, target_offset };
    }
  } catch (e) {
    // Ignore loudnorm errors
  }

  // Run astats for additional analysis
  let statsData = null;
  try {
    const stArgs = ["-i", dosya, "-map", "0:a", "-af", "astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:key=lavfi.astats.Overall.Peak_level:key=lavfi.astats.Overall.DC_offset", "-f", "null", "-"];
    const r = await runFF(stArgs);
    const out = r.stderr + r.stdout;
    const rmsMatch = out.match(/lavfi\.astats\.Overall\.RMS_level=([-\d.]+)/);
    const peakMatch = out.match(/lavfi\.astats\.Overall\.Peak_level=([-\d.]+)/);
    const dcMatch = out.match(/lavfi\.astats\.Overall\.DC_offset=([-\d.]+)/);
    if (rmsMatch || peakMatch || dcMatch) {
      statsData = {
        rms: rmsMatch ? parseFloat(rmsMatch[1]) : null,
        peak: peakMatch ? parseFloat(peakMatch[1]) : null,
        dc: dcMatch ? parseFloat(dcMatch[1]) : null,
      };
    }
  } catch (e) {
    // Ignore astats errors
  }

  // Run ebur128 for more loudness metrics (if available)
  let ebuData = null;
  try {
    const ebuArgs = ["-i", dosya, "-map", "0:a", "-af", "ebur128=metadata=1", "-f", "null", "-"];
    const r = await runFF(ebuArgs);
    const out = r.stderr + r.stdout;
    const m = out.match(/M\s+([-\d.]+)\s+S\s+([-\d.]+)\s+I\s+([-\d.]+)/);
    if (m) {
      ebuData = { m: parseFloat(m[1]), s: parseFloat(m[2]), i: parseFloat(m[3]) };
    }
  } catch (e) {
    // Ignore
  }

  const lines = [];
  lines.push({ t: "── AuraNada AUDIO ANALYSIS ──", cls: "baslik" });
  lines.push({ t: `File: ${path.basename(dosya)}`, cls: "" });
  lines.push({ t: `Size: ${size.toFixed(2)} MB`, cls: "" });
  lines.push({ t: `Duration: ${Math.floor(dur / 60)}:${String(Math.floor(dur % 60)).padStart(2, "0")}`, cls: "" });
  lines.push({ t: `Codec: ${codec} · ${sr}Hz · ${ch}ch`, cls: "" });
  lines.push({ t: /^\d+$/.test(String(bitrate)) ? `Bitrate: ${Math.round(bitrate / 1000)} kbps` : "Bitrate: ?", cls: "" });
  lines.push({ t: "", cls: "" });

  // Loudness Analysis
  lines.push({ t: "── LOUDNESS (EBU R128) ──", cls: "baslik" });
  if (loudnessData) {
    lines.push({ t: `Integrated: ${loudnessData.input_i.toFixed(1)} LUFS`, cls: "deger" });
    lines.push({ t: `True Peak: ${loudnessData.input_tp.toFixed(1)} dBTP`, cls: "deger" });
    lines.push({ t: `LRA: ${loudnessData.input_lra.toFixed(1)} LU`, cls: "deger" });
    lines.push({ t: `Threshold: ${loudnessData.input_thresh.toFixed(1)} LUFS`, cls: "deger" });
    lines.push({ t: `Target Offset: ${loudnessData.target_offset.toFixed(1)} LU`, cls: "deger" });
  } else if (ebuData) {
    lines.push({ t: `Momentary: ${ebuData.m.toFixed(1)} LUFS`, cls: "deger" });
    lines.push({ t: `Short-term: ${ebuData.s.toFixed(1)} LUFS`, cls: "deger" });
    lines.push({ t: `Integrated: ${ebuData.i.toFixed(1)} LUFS`, cls: "deger" });
  } else {
    lines.push({ t: "Loudness data unavailable (ffmpeg loudnorm/ebur128 required)", cls: "uyari" });
  }
  lines.push({ t: "", cls: "" });

  // Peak/RMS Analysis
  lines.push({ t: "── PEAK / RMS / DC ──", cls: "baslik" });
  if (statsData) {
    if (statsData.peak !== null) lines.push({ t: `True Peak: ${statsData.peak.toFixed(2)} dBFS`, cls: "deger" });
    if (statsData.rms !== null) lines.push({ t: `RMS Level: ${statsData.rms.toFixed(2)} dBFS`, cls: "deger" });
    if (statsData.dc !== null) lines.push({ t: `DC Offset: ${statsData.dc.toFixed(4)}`, cls: statsData.dc > 0.01 ? "uyari" : "deger" });
  else lines.push({ t: "DC Offset: N/A", cls: "deger" });
  } else {
    lines.push({ t: "Peak/RMS data unavailable", cls: "uyari" });
  }
  lines.push({ t: "", cls: "" });

  // Metadata
  lines.push({ t: "── METADATA ──", cls: "baslik" });
  const tagEntries = Object.entries(tags);
  if (tagEntries.length) tagEntries.forEach(([k, v]) => lines.push({ t: `${k}: ${v}`, cls: "deger" }));
  else lines.push({ t: "No tags found", cls: "" });
  lines.push({ t: "", cls: "" });

  // Encoder
  if (enc) lines.push({ t: `Encoder: ${enc}`, cls: "deger" });
  lines.push({ t: "", cls: "" });

  return lines;
}

// ── A/B preview ─────────────────────────────────────────────────────────
async function generateAB(dosya, start, dur, s) {
  const base = path.join(os.tmpdir(), "AuraNada_preview");
  const a = base + "_A.m4a";
  const b = base + "_B.m4a";
  const ra = await runFF(["-ss", String(start), "-t", String(dur), "-i", dosya, "-map", "0:a",
    "-map_metadata", "-1", "-c:a", "aac", "-b:a", s.bitrate, "-y", a]);
  const af = buildFilterChain(s, {});
  const rbArgs = ["-ss", String(start), "-t", String(dur), "-i", dosya, "-map", "0:a",
    "-map_metadata", "-1"];
  if (af) rbArgs.push("-af", af);
  rbArgs.push("-ar", String(s.sample_rate), "-c:a", "aac", "-b:a", s.bitrate, "-y", b);
  const rb = await runFF(rbArgs);
  return {
    a: ra.code === 0 ? a : null,
    b: rb.code === 0 ? b : null,
    log: (ra.code === 0 ? "A OK\n" : "A ERROR\n") + (rb.code === 0 ? "B OK\n" : "B ERROR\n") + rb.stderr.slice(-1000),
  };
}

module.exports = {
  isAudio, safeFilename, uniquePath, ffmpegExe, ffprobeExe, ffmpegVarMi, writeMetadata,
  buildFilterChain, loudnormPass1, convertMany, analyzeFile, generateAB, AUDIO_EXTS,
  setAppBaseOverride, iptalEt,
};
