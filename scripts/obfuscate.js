"use strict";
// Pre-build: copies the source into dist-obf/ and obfuscates the JS files
// with javascript-obfuscator. Development files are NEVER modified.
// electron-builder packages from this copy using --projectDir dist-obf.

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const JavaScriptObfuscator = require("javascript-obfuscator");

const KOK = path.join(__dirname, "..");
const HEDEF = path.join(KOK, "dist-obf");

const KOPYALANACAK = [
  "package.json",
  "main.js",
  "preload.js",
  "AuraNada_icon.png",
  "ffmpeg.exe",
  "ffprobe.exe",
  "USER_GUIDE.txt",
];

const KOPYALANACAK_KLASORLER = ["lib", "src", "build"];

const OBFUSCATE_EDILECEK = [
  "main.js",
  "preload.js",
  "lib/store.js",
  "lib/ffmpeg.js",
  "src/renderer.js",
];

// Balanced but safe obfuscation: does not break runtime, makes reading harder.
const OBF_CONFIG = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.4,
  deadCodeInjection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: "hexadecimal",
  numbersToExpressions: false,
  renameGlobals: true,
  selfDefending: false,
  simplify: true,
  splitStrings: false,
  stringArray: true,
  stringArrayEncoding: [],
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayThreshold: 0.6,
  transformObjectKeys: false,
  unicodeEscapeSequence: false,
};

function kopyala(src, dst) {
  fs.copyFileSync(src, dst);
}

function kopyalaKlasor(srcDir, dstDir) {
  fs.mkdirSync(dstDir, { recursive: true });
  for (const isim of fs.readdirSync(srcDir)) {
    const a = path.join(srcDir, isim);
    const b = path.join(dstDir, isim);
    if (fs.statSync(a).isDirectory()) kopyalaKlasor(a, b);
    else kopyala(a, b);
  }
}

function obfuscatRel(goreli) {
  const dosya = path.join(HEDEF, goreli);
  const ham = fs.readFileSync(dosya, "utf-8");
  const sonuc = JavaScriptObfuscator.obfuscate(ham, OBF_CONFIG).getObfuscatedCode();
  fs.writeFileSync(dosya, sonuc, "utf-8");
  execFileSync(process.execPath, ["--check", dosya], { stdio: "pipe" });
  console.log("  obfuscate ✓", goreli, `(${(sonuc.length / 1024).toFixed(0)} KB)`);
}

function hazirla() {
  fs.rmSync(HEDEF, { recursive: true, force: true });
  fs.mkdirSync(HEDEF, { recursive: true });

  for (const g of KOPYALANACAK) {
    const kaynak = path.join(KOK, g);
    if (!fs.existsSync(kaynak)) continue;
    kopyala(kaynak, path.join(HEDEF, g));
  }

  // Staging has no node_modules; electron-builder cannot resolve the version.
  // Pin the exact installed electron version into the build config.
  try {
    const electronVersion = require(path.join(KOK, "node_modules", "electron", "package.json")).version;
    const stagingPkg = path.join(HEDEF, "package.json");
    const pkg = JSON.parse(fs.readFileSync(stagingPkg, "utf-8"));
    pkg.build = pkg.build || {};
    pkg.build.electronVersion = electronVersion;
    fs.writeFileSync(stagingPkg, JSON.stringify(pkg, null, 2), "utf-8");
  } catch (err) {
    console.error("Could not read Electron version: " + err.message);
  }
  for (const k of KOPYALANACAK_KLASORLER) {
    kopyalaKlasor(path.join(KOK, k), path.join(HEDEF, k));
  }

  console.log("Obfuscation started…");
  for (const g of OBFUSCATE_EDILECEK) {
    const kaynak = path.join(KOK, g);
    const hedef = path.join(HEDEF, g);
    if (!fs.existsSync(kaynak)) continue;
    kopyala(kaynak, hedef);
    obfuscatRel(g);
  }

  // All copying done — dist-obf
  return HEDEF;
}

module.exports = { hazirla, HEDEF };