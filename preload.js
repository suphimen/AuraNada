"use strict";
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("auradio", {
  // Window
  minimize: () => ipcRenderer.send("win:minimize"),
  maximize: () => ipcRenderer.send("win:maximize"),
  close: () => ipcRenderer.send("win:close"),

  // Settings / profiles
  loadSettings: () => ipcRenderer.invoke("settings:load"),
  saveSettings: (s) => ipcRenderer.invoke("settings:save", s),
  defaultSettings: () => ipcRenderer.invoke("settings:defaults"),
  getPreset: (ad) => ipcRenderer.invoke("settings:preset", ad),

  loadProfiles: () => ipcRenderer.invoke("profiles:load"),
  listProfiles: () => ipcRenderer.invoke("profiles:list"),
  saveProfile: (ad, veri) => ipcRenderer.invoke("profiles:save", ad, veri),
  deleteProfile: (ad) => ipcRenderer.invoke("profiles:delete", ad),
  profileFactory: (ad) => ipcRenderer.invoke("profiles:factory", ad),

  // Dialogs
  pickFolder: (title) => ipcRenderer.invoke("dialog:folder", title),
  pickAudioFile: (title) => ipcRenderer.invoke("dialog:audioFile", title),
  openPath: (p) => ipcRenderer.invoke("shell:openPath", p),

  scanFolder: (klasor) => ipcRenderer.invoke("folder:scan", klasor),
  checkFfmpeg: () => ipcRenderer.invoke("ffmpeg:check"),
  openExternal: (url) => ipcRenderer.invoke("shell:openExternal", url),

  // Conversion
  startConvert: (payload) => ipcRenderer.invoke("convert:start", payload),
  cancelConvert: () => ipcRenderer.send("convert:cancel"),
  onConvertProgress: (cb) => ipcRenderer.on("convert:progress", (e, d) => cb(d)),
  onConvertStatus: (cb) => ipcRenderer.on("convert:status", (e, d) => cb(d)),

  // Analysis
  analyzeFile: (dosya) => ipcRenderer.invoke("analyze:file", dosya),

  // A/B
  generateAB: (dosya, start, dur, settings) => ipcRenderer.invoke("ab:generate", { dosya, start, dur, settings }),
});
