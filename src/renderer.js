"use strict";

const $ = (id) => document.getElementById(id);

const state = {
  profiles: [],        // [{ id, name, builtin, settings }]  → SINGLE SOURCE OF TRUTH
  selectedId: null,    // id of the selected profile
  settings: null,      // = profiles[selectedId].settings (live reference)
  appSettings: { cikti_klasor: "" },
  mode: "klasor",
  klasorYolu: "",
  tekDosya: "",
  isleniyor: false,
  abA: null,
  abB: null,
  analizLines: null,
};

const DEFAULT_KEYS = [
  "lufs", "bitrate", "format", "pitch", "tempo", "watermark",
  "stereo", "stereo_width", "warmth", "warmth_gain",
  "reverb", "reverb_amount", "noise", "noise_level", "kompres",
  "metadata_mode", "sample_rate", "true_peak", "lra", "normalize",
];

const PRESET_KEYS = [
  "lufs", "bitrate", "format", "pitch", "tempo", "watermark",
  "stereo", "stereo_width", "warmth", "warmth_gain",
  "reverb", "reverb_amount", "noise", "noise_level", "kompres",
  "metadata_mode", "sample_rate", "true_peak", "lra",
];

// ── Small helper modal (Toplevel dialog equivalent) ─────────────────────
function modal(build) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:1000;";
    const box = document.createElement("div");
    box.style.cssText = "background:var(--card);border:1px solid var(--line);border-radius:12px;padding:22px;min-width:260px;box-shadow:0 30px 60px rgba(0,0,0,.5);font-family:'Inter',sans-serif;color:var(--text);";
    const close = (result) => { document.body.removeChild(overlay); resolve(result); };
    build(box, close);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  });
}

// ── Theme-aware notification modal (instead of alert/confirm) ───────────
const NOTIFY_STYLES = {
  success: { icon: "✓", color: "var(--green)" },
  error:   { icon: "✕", color: "var(--red)" },
  warn:    { icon: "⚠", color: "var(--warn)" },
  info:    { icon: "ℹ", color: "var(--violet)" },
};

function notice(title, message, type = "info", onOk) {
  const cfg = NOTIFY_STYLES[type] || NOTIFY_STYLES.info;
  return modal((box, close) => {
    box.style.width = "min(440px, 92vw)";
    box.style.textAlign = "center";
    box.innerHTML = `
      <div style="font-size:34px;line-height:1;margin-bottom:10px;color:${cfg.color};">${cfg.icon}</div>
      <div class="an-title"></div>
      <div class="an-msg"></div>
      <div style="display:flex;gap:8px;margin-top:18px;">
        <button class="btn-primary an-ok" style="flex:1;padding:11px;border-radius:7px;">OK</button>
      </div>`;
    box.querySelector(".an-title").textContent = title;
    box.querySelector(".an-msg").textContent = message;
    box.querySelector(".an-ok").addEventListener("click", () => { close(true); if (onOk) onOk(); });
  });
}

function confirmModal(title, message, okLabel = "Yes", cancelLabel = "No") {
  return modal((box, close) => {
    box.style.width = "min(400px, 92vw)";
    box.style.textAlign = "center";
    box.innerHTML = `
      <div style="font-size:30px;line-height:1;margin-bottom:10px;color:var(--warn);">⚠</div>
      <div class="an-title"></div>
      <div class="an-msg"></div>
      <div style="display:flex;gap:8px;margin-top:18px;">
        <button class="btn-primary an-yes" style="flex:1;padding:11px;border-radius:7px;">${okLabel}</button>
        <button class="btn-ghost an-no" style="flex:1;padding:11px;border-radius:7px;">${cancelLabel}</button>
      </div>`;
    box.querySelector(".an-title").textContent = title;
    box.querySelector(".an-msg").textContent = message;
    box.querySelector(".an-yes").addEventListener("click", () => close(true));
    box.querySelector(".an-no").addEventListener("click", () => close(false));
  });
}

function askText(title, value) {
  return modal((box, close) => {
    box.innerHTML = `
      <div style="font-family:'Sora',sans-serif;font-weight:700;font-size:13px;margin-bottom:10px;">${title}</div>
      <input id="m-input" type="text" style="width:220px;background:var(--card-hi);border:1px solid var(--line);border-radius:6px;color:var(--text);padding:8px 10px;font-size:12.5px;outline:none;">
      <div style="display:flex;gap:8px;margin-top:16px;">
        <button id="m-ok" class="btn-primary">Save</button>
        <button id="m-cancel" class="btn-ghost">Cancel</button>
      </div>`;
    const inp = box.querySelector("#m-input");
    inp.value = value || "";
    inp.focus();
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") close(inp.value.trim()); });
    box.querySelector("#m-ok").onclick = () => close(inp.value.trim());
    box.querySelector("#m-cancel").onclick = () => close(null);
  });
}

function pickFromList(title, names) {
  return modal((box, close) => {
    box.innerHTML = `
      <div style="font-family:'Sora',sans-serif;font-weight:700;font-size:13px;margin-bottom:10px;">${title}</div>
      <div id="m-list" style="max-height:240px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;min-width:260px;"></div>
      <div style="display:flex;gap:8px;margin-top:14px;"><button id="m-cancel" class="btn-ghost">Close</button></div>`;
    const list = box.querySelector("#m-list");
    names.forEach((n) => {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--card-hi);border-radius:6px;cursor:pointer;font-size:12.5px;";
      row.innerHTML = `<span>${n}</span><span style="color:var(--red);font-size:11px;">Delete</span>`;
      row.children[0].onclick = () => close(n);
      row.children[1].onclick = async (e) => {
        e.stopPropagation();
        await window.auradio.deleteProfile(n);
        row.remove();
      };
      list.appendChild(row);
    });
    box.querySelector("#m-cancel").onclick = () => close(null);
  });
}

function flash(el, text, ms = 2200) {
  const old = el.textContent;
  el.textContent = text;
  setTimeout(() => { if (el.textContent === text) el.textContent = old; }, ms);
}

// ── Progresif butonlar ────────────────────────────────────────────────
// Buttons now work like a progress bar: .btn-fill fills with --p; .busy = indeterminate animation.
function setBtnProgress(btn, pct, label) {
  btn.classList.add("running");
  btn.classList.remove("busy");
  btn.style.setProperty("--p", pct + "%");
  const lbl = btn.querySelector(".btn-label");
  if (lbl) lbl.textContent = label;
  else btn.textContent = label;
}
function setBtnBusy(btn, label) {
  btn.classList.add("running", "busy");
  btn.style.setProperty("--p", "100%");
  const lbl = btn.querySelector(".btn-label");
  if (lbl) lbl.textContent = label;
  else btn.textContent = label;
}
function setBtnIdle(btn, label) {
  btn.classList.remove("running", "busy");
  btn.style.setProperty("--p", "0%");
  const lbl = btn.querySelector(".btn-label");
  if (lbl) lbl.textContent = label;
  else btn.textContent = label;
  document.body.style.cursor = "default";
}

// ── Profiles + settings lock (during conversion) ────────────────────────
const AYAR_KONTROLLER = [
  "set-format", "set-bitrate", "set-lufs", "set-metadata", "set-samplerate",
  "set-truepeak", "set-lra", "set-normalize",
  "sl-pitch", "sl-tempo", "sl-stereo", "sl-warmth", "sl-reverb", "sl-noise",
];
const PROFIL_BUTONLARI = ["btn-profil-kaydet", "btn-profil-sifirla", "btn-profil-sil"];

function kilitlePanel(kilit) {
  document.body.classList.toggle("panel-kilitli", kilit);
  AYAR_KONTROLLER.forEach((id) => { const el = $(id); if (el) el.disabled = kilit; });
  PROFIL_BUTONLARI.forEach((id) => { const el = $(id); if (el) el.disabled = kilit; });
}
function islemeBasla() { state.isleniyor = true; kilitlePanel(true); }
function islemeBitti() { state.isleniyor = false; kilitlePanel(false); }

function showContextMenu(x, y, items) {
  // Remove existing context menu
  const existing = document.getElementById("custom-context-menu");
  if (existing) existing.remove();

  const menu = document.createElement("div");
  menu.id = "custom-context-menu";
  menu.style.cssText = `
    position: fixed; left: ${x}px; top: ${y}px;
    background: var(--card); border: 1px solid var(--line);
    border-radius: 8px; padding: 4px 0; z-index: 10000;
    min-width: 160px; box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    font-family: 'Inter', sans-serif; font-size: 12px;
  `;
  items.forEach(item => {
    if (item.type === "separator") {
      const sep = document.createElement("div");
      sep.style.cssText = "height: 1px; background: var(--line); margin: 4px 8px;";
      menu.appendChild(sep);
    } else {
      const btn = document.createElement("div");
      btn.textContent = item.label;
      btn.style.cssText = "padding: 8px 12px; cursor: pointer; color: var(--text);";
      btn.addEventListener("mouseenter", () => btn.style.background = "var(--card-hi)");
      btn.addEventListener("mouseleave", () => btn.style.background = "transparent");
      btn.addEventListener("click", () => { item.action(); menu.remove(); });
      menu.appendChild(btn);
    }
  });
  document.body.appendChild(menu);
  // Close on click outside
  const closeFn = (e) => { if (!menu.contains(e.target)) menu.remove(); document.removeEventListener("click", closeFn); };
  setTimeout(() => document.addEventListener("click", closeFn), 0);
}

// ── Format helpers ─────────────────────────────────────────────────────
const fmtSigned = (v, d) => (v >= 0 ? "+" : "") + Number(v).toFixed(d);

function syncSettingsToUI() {
  const s = state.settings;
  if (!s) return;
  $("set-format").value = s.format;
  $("set-bitrate").value = s.bitrate;
  $("set-lufs").value = s.lufs;
  $("set-metadata").value = s.metadata_mode;
  $("set-samplerate").value = s.sample_rate;
  $("set-truepeak").value = s.true_peak;
  if ($("set-lra")) $("set-lra").value = String(s.lra ?? "11");
  if ($("set-normalize")) $("set-normalize").value = String(s.normalize !== false);

  const sliders = [
    ["sl-pitch", "val-pitch", s.pitch, (v) => fmtSigned(v, 1) + "c"],
    ["sl-tempo", "val-tempo", s.tempo, (v) => fmtSigned(v, 2) + "%"],
    ["sl-stereo", "val-stereo", s.stereo_width, (v) => "×" + Number(v).toFixed(2)],
    ["sl-warmth", "val-warmth", s.warmth_gain, (v) => "+" + Number(v).toFixed(1) + "dB"],
    ["sl-reverb", "val-reverb", s.reverb_amount, (v) => Number(v).toFixed(2)],
    ["sl-noise", "val-noise", s.noise_level, (v) => Number(v).toFixed(3)],
  ];
  for (const [slId, valId, v, fmt] of sliders) {
    $(slId).value = v;
    $(valId).textContent = fmt(Number(v));
  }

  const toggles = { watermark: s.watermark, stereo: s.stereo, warmth: s.warmth, kompres: s.kompres, reverb: s.reverb, noise: s.noise };
  for (const [key, on] of Object.entries(toggles)) {
    $("chk-" + key).classList.toggle("on", !!on);
    const body = $("body-" + key);
    if (body) body.classList.toggle("open", !!on);
  }
}

// ── PROFILE SYSTEM - SINGLE SOURCE OF TRUTH ─────────────────────────────
function renderProfileChips() {
  const build = (container) => {
    container.innerHTML = "";
    state.profiles.forEach((p) => {
      if (p.id === "Default") return;
      const chip = document.createElement("div");
      chip.className = "chip" + (state.selectedId === p.id ? " active" : "");
      chip.dataset.profile = p.id;
      chip.textContent = p.name;
      chip.addEventListener("click", () => selectProfile(p.id));
      container.appendChild(chip);
    });
  };
  const c1 = $("profile-chips");
  if (c1) build(c1);
  const c2 = $("ab-profile-chips");
  if (c2 && c2 !== c1) build(c2);
}

function currentProfile() {
  return state.profiles.find((p) => p.id === state.selectedId) || null;
}

// Changing selection → state.settings = live settings of the selected profile
function selectProfile(id) {
  const p = state.profiles.find((x) => x.id === id);
  if (!p) return;
  state.selectedId = id;
  state.settings = p.settings;
  renderProfileChips();
  syncSettingsToUI();
  persistAppSettings();
  if (state.abA || state.abB) resetAbProfil(p.name);
}

function persistAppSettings() {
  const s = state.settings || {};
  window.auradio.saveSettings({ ...state.appSettings, cikti_klasor: s.cikti_klasor || state.appSettings.cikti_klasor, output_dir_name: s.output_dir_name || state.appSettings.output_dir_name, son_profil: state.selectedId });
}

// Returns only the profile keys (DEFAULT_KEYS)
function minProfile(settings) {
  const veri = {};
  DEFAULT_KEYS.forEach((k) => (veri[k] = settings[k]));
  return veri;
}

// When a setting changes → write to the selected profile's real settings + save to disk
function persistProfile() {
  const p = currentProfile();
  if (!p) return;
  window.auradio.saveProfile(p.name, minProfile(p.settings));
}

// ── Sekmeler ──────────────────────────────────────────────────────────
function wireTabs() {
  document.querySelectorAll(".tab").forEach((t) => {
    t.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((x) => x.classList.remove("active"));
      t.classList.add("active");
      $(t.dataset.p).classList.add("active");
    });
  });
}

// ── Profile actions (create / load / delete) ────────────────────────────
function wireProfiles() {
  $("btn-profil-kaydet").addEventListener("click", async () => {
    const ad = await askText("New profile name", "Custom Profile");
    if (!ad) return;
    const mevcut = state.profiles.find((p) => p.id === ad || (p.name || "").toLowerCase() === ad.toLowerCase());
    if (mevcut) { notice("Cannot Create Profile", "A profile with this name already exists.", "warn"); return; }
    const defaults = await window.auradio.defaultSettings();
    const ayar = {};
    DEFAULT_KEYS.forEach((k) => (ayar[k] = defaults[k]));
    Object.assign(ayar, { cikti_klasor: state.appSettings.cikti_klasor, output_dir_name: defaults.output_dir_name });
    state.profiles.push({ id: ad, name: ad, builtin: false, settings: ayar });
    await window.auradio.saveProfile(ad, ayar);
    selectProfile(ad);
  });

  $("btn-profil-sifirla").addEventListener("click", async () => {
    const p = currentProfile();
    if (!p) return;
    const fabrika = await window.auradio.profileFactory(p.name);
    Object.keys(fabrika).forEach((k) => (p.settings[k] = fabrika[k]));
    await window.auradio.saveProfile(p.name, minProfile(p.settings));
    selectProfile(p.id);
  });

  $("btn-profil-sil").addEventListener("click", async () => {
    const p = currentProfile();
    if (!p) return;
    if (p.builtin) { notice("Cannot Delete Profile", "Default profiles cannot be deleted.", "warn"); return; }
    if (!(await confirmModal("Delete Profile", `Delete profile "${p.name}"?\n\nThis action cannot be undone.`))) return;
    await window.auradio.deleteProfile(p.name);
    state.profiles = state.profiles.filter((x) => x.id !== p.id);
    renderProfileChips();
    selectProfile("YouTube Master");
  });

  $("suphimen-link").addEventListener("click", () => window.auradio.openExternal("https://x.com/suphimen"));
}

// ── Pencere kontrolleri ───────────────────────────────────────────────
function wireWindowControls() {
  $("btn-min").addEventListener("click", () => window.auradio.minimize());
  $("btn-max").addEventListener("click", () => window.auradio.maximize());
  $("btn-close").addEventListener("click", () => window.auradio.close());
}

// ── Convert tab ─────────────────────────────────────────────────────────
function setMode(mode) {
  state.mode = mode;
  $("sw-klasor").classList.toggle("on", mode === "klasor");
  $("sw-klasor").classList.toggle("off", mode !== "klasor");
  $("sw-tek").classList.toggle("on", mode === "tek");
  $("sw-tek").classList.toggle("off", mode !== "tek");
  $("dz-klasor").classList.toggle("hidden", mode !== "klasor");
  $("dz-tek").classList.toggle("hidden", mode !== "tek");
  $("field-names").classList.toggle("hidden", mode !== "klasor");
  $("field-sarki").classList.toggle("hidden", mode !== "tek");
  resetSelection();
}

function resetSelection() {
  state.klasorYolu = "";
  state.tekDosya = "";
  $("dz-klasor-selected").textContent = "";
  $("dz-tek-selected").textContent = "";
  $("f-count").textContent = "-"; $("f-count").style.color = "";
  $("f-names").textContent = "-"; $("f-names").style.color = "";
  $("f-ciktiklasoru").textContent = "-";
  $("inp-sarki").value = "";
  setBtnIdle($("btn-basla"), "▷ Start");
  kilitlePanel(false);
}

async function scanKlasor(klasor) {
  state.klasorYolu = klasor;
  const kisa = klasor.length > 45 ? "..." + klasor.slice(-42) : klasor;
  $("dz-klasor-selected").textContent = kisa;
  const info = await window.auradio.scanFolder(klasor);
  if (!info.count) {
    $("f-count").textContent = "No audio files found"; $("f-count").style.color = "var(--red)";
    $("btn-basla").disabled = true;
    return;
  }
  $("f-count").textContent = `${info.count} files`; $("f-count").style.color = "var(--green)";
  if (info.namesFound) { $("f-names").textContent = `Found (${info.namesCount} names)`; $("f-names").style.color = "var(--green)"; }
  else { $("f-names").textContent = "Not found (original names)"; $("f-names").style.color = "var(--orange, #F2B134)"; }
  const cikti = $("inp-cikti").value.trim() || (klasor + "/AuraNada_Output");
  $("f-ciktiklasoru").textContent = cikti;
  $("btn-basla").disabled = false;
}

function selectTekDosya(dosya) {
  state.tekDosya = dosya;
  const isim = dosya.split(/[\\/]/).pop();
  $("dz-tek-selected").textContent = isim.length > 47 ? "..." + isim.slice(-44) : isim;
  $("inp-sarki").value = isim.replace(/\.[^.]+$/, "");
  $("f-count").textContent = "1 file"; $("f-count").style.color = "var(--green)";
  const dir = dosya.replace(/[\\/][^\\/]*$/, "");
  const cikti = $("inp-cikti").value.trim() || (dir + "/AuraNada_Output");
  $("f-ciktiklasoru").textContent = cikti;
  $("btn-basla").disabled = false;
}

function wireAnaPanel() {
  $("sw-klasor").addEventListener("click", () => setMode("klasor"));
  $("sw-tek").addEventListener("click", () => setMode("tek"));

  $("dz-klasor").addEventListener("click", async () => {
    if (state.isleniyor) return;
    const k = await window.auradio.pickFolder("Select Audio Folder");
    if (k) scanKlasor(k);
  });
  $("dz-tek").addEventListener("click", async () => {
    if (state.isleniyor) return;
    const f = await window.auradio.pickAudioFile("Select Audio File");
    if (f) selectTekDosya(f);
  });

  $("btn-cikti-sec").addEventListener("click", async () => {
    const k = await window.auradio.pickFolder("Select Output Folder");
    if (k) { $("inp-cikti").value = k; $("f-ciktiklasoru").textContent = k; }
  });
  $("btn-cikti-reset").addEventListener("click", () => {
    $("inp-cikti").value = "";
    const base = state.mode === "klasor" ? state.klasorYolu : state.tekDosya.replace(/[\\/][^\\/]*$/, "");
    if (base) $("f-ciktiklasoru").textContent = base + "/AuraNada_Output";
  });

  $("btn-sifirla").addEventListener("click", () => { if (!state.isleniyor) resetSelection(); });

  $("btn-basla").addEventListener("click", startConvert);
  $("btn-iptal").addEventListener("click", () => window.auradio.cancelConvert());
}

async function startConvert() {
  if (state.isleniyor) return;
  if (!state.klasorYolu && !state.tekDosya) {
    notice("No File Selected", "Please select a folder or file to convert first.", "warn");
    return;
  }

  const payload = {
    mod: state.mode === "tek" ? "tek" : "klasor",
    klasor: state.klasorYolu,
    tekDosya: state.tekDosya,
    sarki: $("inp-sarki").value.trim(),
    artist: $("inp-artist").value.trim(),
    album: $("inp-album").value.trim(),
    cikti: $("inp-cikti").value.trim(),
    settings: state.settings,
    profilAdi: currentProfile() ? currentProfile().name : "",
  };

  islemeBasla();
  $("btn-basla").disabled = true;
  setBtnBusy($("btn-basla"), "Processing…");
  $("btn-iptal").disabled = false;

  let sonuc;
  try {
    sonuc = await window.auradio.startConvert(payload);
  } catch (err) {
    islemeBitti();
    $("btn-iptal").disabled = true;
    $("btn-basla").disabled = false;
    setBtnIdle($("btn-basla"), "▷ Retry · Error");
    notice("Conversion Error", "An unexpected error occurred during conversion:\n\n" + (err && err.message ? err.message : err), "error");
    return;
  }
  islemeBitti();
  $("btn-iptal").disabled = true;

  if (sonuc.iptal) {
    $("btn-basla").disabled = false;
    setBtnIdle($("btn-basla"), `▷ Retry · Canceled (${sonuc.islenen}/${sonuc.toplam})`);
      notice("Operation Canceled", "The operation was canceled.\n\nNo changes were made apart from the processed files.", "warn");
  } else if (sonuc.hatalar && sonuc.hatalar.length) {
    $("btn-basla").disabled = false;
    setBtnIdle($("btn-basla"), `▷ Retry · ${sonuc.hatalar.length} errors`);
    notice("Failed Files", "These files could not be converted:\n\n" + sonuc.hatalar.map((h) => "• " + h).join("\n"), "error");
  } else {
    $("btn-basla").disabled = false;
    setBtnIdle($("btn-basla"), `▷ Retry · ${sonuc.sureStr}`);
    window.auradio.openPath(sonuc.cikti);
    const dosyaAdi = state.tekDosya ? state.tekDosya.split(/[\\/]/).pop() : "";
    const sarkiAdi = $("inp-sarki").value.trim();
    const profilAd2 = currentProfile() ? currentProfile().name : "Selected profile";
    const ustSatir = state.mode === "tek" ? (sarkiAdi || dosyaAdi || "1 file") : `${sonuc.toplam} files`;
    const mesaj2 = ustSatir + `\nProfile: ${profilAd2}\nDuration: ${sonuc.sureStr}\nLocation: ${sonuc.cikti}`;
    notice("Conversion Complete", mesaj2, "success");
  }
}

function wireConvertEvents() {
  window.auradio.onConvertProgress(({ i, toplam }) => {
    const pct = Math.round((i / toplam) * 100);
    setBtnProgress($("btn-basla"), pct, `Processing ${i}/${toplam} · ${pct}%`);
  });
}

// ── Profile settings editor (the only settings panel in the Convert tab) ─
function wireProfilEditor() {
  // Controls write live to the selected profile's settings + save to disk
  let kayitTimer = null;
  const autoSave = () => {
    persistProfile();
    persistAppSettings();
    clearTimeout(kayitTimer);
  };

  const bind = (id, key, transform = (v) => v) => {
    $(id).addEventListener("change", () => { state.settings[key] = transform($(id).value); autoSave(); });
  };
  bind("set-format", "format");
  bind("set-bitrate", "bitrate");
  bind("set-lufs", "lufs");
  bind("set-metadata", "metadata_mode");
  bind("set-samplerate", "sample_rate");
  bind("set-truepeak", "true_peak");
  bind("set-lra", "lra", (v) => String(v || "11"));
  bind("set-normalize", "normalize", (v) => String(v) === "true");

  const bindSlider = (slId, valId, key, fmt) => {
    $(slId).addEventListener("input", () => {
      const v = Number($(slId).value);
      state.settings[key] = v;
      $(valId).textContent = fmt(v);
      persistProfile();
    });
  };
  bindSlider("sl-pitch", "val-pitch", "pitch", (v) => fmtSigned(v, 1) + "c");
  bindSlider("sl-tempo", "val-tempo", "tempo", (v) => fmtSigned(v, 2) + "%");
  bindSlider("sl-stereo", "val-stereo", "stereo_width", (v) => "×" + Number(v).toFixed(2));
  bindSlider("sl-warmth", "val-warmth", "warmth_gain", (v) => "+" + Number(v).toFixed(1) + "dB");
  bindSlider("sl-reverb", "val-reverb", "reverb_amount", (v) => Number(v).toFixed(2));
  bindSlider("sl-noise", "val-noise", "noise_level", (v) => Number(v).toFixed(3));

  document.querySelectorAll(".toggle-head").forEach((head) => {
    head.addEventListener("click", (e) => {
      if (e.target.tagName === "INPUT") return;
      const key = head.dataset.toggle;
      const on = !$("chk-" + key).classList.contains("on");
      $("chk-" + key).classList.toggle("on", on);
      const body = $("body-" + key);
      if (body) body.classList.toggle("open", on);
      state.settings[key] = on;
      autoSave();
    });
  });
}

// ── Analyze tab ────────────────────────────────────────────────────────
function wireAnalizPanel() {
  $("btn-analiz-sec").addEventListener("click", async () => {
    const f = await window.auradio.pickAudioFile("File to Analyze");
    if (!f) return;
    const btn = $("btn-analiz-sec");
    $("analiz-label").textContent = f.split(/[\\/]/).pop();
    $("analiz-text").textContent = "Starting analysis…";
    btn.disabled = true;
    setBtnBusy(btn, "Analyzing…");
    const r = await window.auradio.analyzeFile(f);
    setBtnIdle(btn, "📁 Select File & Analyze");
    btn.disabled = false;
    if (!r.ok) { $("analiz-text").textContent = "Error: " + r.error; return; }
    state.analizLines = r.lines;
    $("btn-analiz-kopyala").disabled = false;
    $("analiz-text").innerHTML = r.lines.map((l) => {
      const cls = l.cls ? ` class="l-${l.cls}"` : "";
      return `<span${cls}>${escapeHtml(l.t)}</span>`;
    }).join("\n");
  });
  $("btn-analiz-kopyala").addEventListener("click", async () => {
    if (!state.analizLines) { notice("Analysis Required", "Analyze a file first.", "warn"); return; }
    const metin = state.analizLines.map((l) => l.t).join("\n");
    try {
      await navigator.clipboard.writeText(metin);
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = metin;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    flash($("btn-analiz-kopyala"), "✓ Copied");
    notice("Copied", "Analysis results copied to clipboard.", "success");
  });
  $("btn-analiz-temizle").addEventListener("click", () => {
    state.analizLines = null;
    $("analiz-label").textContent = "No file selected";
    $("analiz-text").innerHTML = "Results will appear here.";
    $("btn-analiz-kopyala").disabled = true;
    flash($("btn-analiz-temizle"), "✓ Cleared");
  });
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── A/B Preview tab ────────────────────────────────────────────────────
// Item 3: When one of the A/B players is playing, the others pause automatically.
function wireAbMutex() {
  const ids = ["audio-a", "audio-b", "ab-cikti-a", "ab-cikti-b"];
  ids.forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener("play", () => {
      ids.forEach((o) => {
        if (o !== id) {
          const di = $(o);
          if (di && !di.paused) {
            di.pause();
            di.currentTime = 0;
          }
        }
      });
    });
  });
}

function abBellekBosalt(id) {
  const el = $(id);
  el.pause();
  el.removeAttribute("src");
  el.load();
}
function resetAbCekirdek() {
  abBellekBosalt("audio-a");
  abBellekBosalt("audio-b");
  $("ab-info-a").textContent = "";
  $("ab-info-b").textContent = "";
  $("ab-durum").style.color = "var(--warn)";
  $("ab-log").textContent = "";
  state.abA = null; state.abB = null;
}
function resetAbDosya(ad) {
  resetAbCekirdek();
  $("ab-label").textContent = ad;
  $("ab-durum").textContent = "";
}
function resetAbProfil(id) {
  resetAbCekirdek();
  const dosyaAdi = $("ab-label").textContent && $("ab-label").textContent !== "No file selected"
    ? $("ab-label").textContent : "";
  $("ab-durum").textContent = dosyaAdi ? `File: ${dosyaAdi} · Profile changed, memory cleared. File kept.`
    : `Profile: ${id} · Profile changed, memory cleared.`;
}

function wireOnizlePanel() {
  let dosya = null;
  const setDosya = (f) => {
    dosya = f;
    $("ab-label").textContent = f.split(/[\\/]/).pop();
    $("ab-label").title = f;
    $("btn-ab-generate").disabled = false;
    resetAbDosya(f.split(/[\\/]/).pop());
  };
  $("btn-ab-sec").addEventListener("click", async () => {
    const f = await window.auradio.pickAudioFile("File to Preview");
    if (!f) return;
    setDosya(f);
  });
  $("btn-ab-sifirla").addEventListener("click", () => {
    dosya = null;
    $("ab-label").textContent = "No file selected";
    $("ab-label").title = "";
    $("btn-ab-generate").disabled = true;
    resetAbCekirdek();
    $("ab-durum").textContent = "Test reset, removed from memory.";
    $("ab-durum").style.color = "var(--warn)";
  });
  $("btn-ab-generate").addEventListener("click", async () => {
    if (!dosya) return;
    if (state.isleniyor) return;
    const btn = $("btn-ab-generate");
    btn.disabled = true;
    setBtnBusy(btn, "Generating…");
    const start = Number($("ab-start").value) || 0;
    const dur = Number($("ab-dur").value) || 15;
    const p = currentProfile();
    $("ab-durum").textContent = `${p ? p.name : state.selectedId} - generating…`;
    $("ab-durum").style.color = "var(--warn)";
    const r = await window.auradio.generateAB(dosya, start, dur, state.settings);
    setBtnIdle(btn, "▷ Generate A/B");
    btn.disabled = false;
    state.abA = r.a; state.abB = r.b;

    if (r.a) {
      $("audio-a").src = "file:///" + r.a.replace(/\\/g, "/");
      $("ab-info-a").textContent = `Original · ${dur}s`;
    } else {
      $("audio-a").src = "";
      $("ab-info-a").textContent = "Could not be created";
    }
    if (r.b) {
      $("audio-b").src = "file:///" + r.b.replace(/\\/g, "/");
      $("ab-info-b").textContent = `Processed · ${dur}s · ${state.settings.bitrate} ${state.settings.format}`;
    } else {
      $("audio-b").src = "";
      $("ab-info-b").textContent = "Could not be created";
    }
    $("ab-durum").textContent = `A/B ready · ${p ? p.name : ""} · ${r.elapsed.toFixed(1)}s`;
    $("ab-durum").style.color = (r.a && r.b) ? "var(--green)" : "var(--red)";
    $("ab-log").textContent = r.log;
  });
}

// ── Startup ────────────────────────────────────────────────────────────
async function init() {
  // Check if window.auradio is available (preload script worked)
  if (!window.auradio) {
    console.error("window.auradio is undefined - preload script failed!");
    document.body.innerHTML = `
      <div style="padding: 40px; text-align: center; color: var(--red); font-family: 'Inter', sans-serif;">
        <h2>⚠ Preload Script Error</h2>
        <p>The window.auradio API could not be loaded.</p>
        <p>Open the developer console (Ctrl+Shift+I) and check for errors.</p>
        <p><small>CSP or contextIsolation settings may be blocking the preload script.</small></p>
      </div>
    `;
    return;
  }

  wireTabs();
  wireWindowControls();
  wireProfiles();
  wireAnaPanel();
  wireConvertEvents();
  wireProfilEditor();
  wireAnalizPanel();
  wireAbMutex();
  wireOnizlePanel();

  // Load profiles from a single source (built-in + user profiles)
  const appSettings = await window.auradio.loadSettings();
  state.appSettings = {
    cikti_klasor: appSettings.cikti_klasor || "",
    output_dir_name: appSettings.output_dir_name || "AuraNada_Output",
  };

  state.profiles = await window.auradio.listProfiles();
  if (!state.profiles.length) {
    const defaults = await window.auradio.defaultSettings();
    state.profiles = [{ id: "YouTube Master", name: "YouTube Master", builtin: true, settings: { ...defaults } }];
  }

  const baslangic = state.profiles.find((p) => p.id === "YouTube Master") || state.profiles[0];
  state.selectedId = baslangic.id;
  state.settings = baslangic.settings;
  renderProfileChips();
  syncSettingsToUI();

  $("inp-cikti").value = state.appSettings.cikti_klasor || "";
  setMode("klasor");

  const ok = await window.auradio.checkFfmpeg();
  const el = $("ffmpeg-status");
  el.textContent = ok ? "FFmpeg active" : "FFmpeg not found";
  el.dataset.ok = ok ? "1" : "0";
  el.style.color = ok ? "var(--green)" : "var(--red)";

  // Context menu for inputs/textareas (copy/paste/cut/select all)
  document.addEventListener("contextmenu", (e) => {
    const target = e.target;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
      e.preventDefault();
      const pasteGenel = async () => {
        if (document.execCommand("paste")) return;
        try {
          const metin = await navigator.clipboard.readText();
          if (!metin) return;
          const el = target;
          el.focus();
          const bas = el.selectionStart ?? el.value.length;
          const son = el.selectionEnd ?? el.value.length;
          el.value = el.value.slice(0, bas) + metin + el.value.slice(son);
          el.dispatchEvent(new Event("input", { bubbles: true }));
        } catch (_) { /* no access */ }
      };
      const menu = [
        { label: "Cut", action: () => document.execCommand("cut") },
        { label: "Copy", action: () => document.execCommand("copy") },
        { label: "Paste", action: pasteGenel },
        { type: "separator" },
        { label: "Select All", action: () => { target.focus(); target.select?.(); } },
      ];
      showContextMenu(e.clientX, e.clientY, menu);
    }
  });
}

document.addEventListener("DOMContentLoaded", init);
