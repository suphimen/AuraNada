"use strict";
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

// Stage 1 - package the unpacked app directly from source (no obfuscation, no signing)
const cli = require.resolve("electron-builder/out/cli/cli.js");
const child = spawn(
  process.execPath,
  [cli, "--win", "--x64", "--dir", "--publish", "never"],
  { stdio: "inherit", cwd: root }
);

child.on("error", (err) => {
  console.error(err);
  process.exit(1);
});

child.on("exit", (code) => {
  if (code !== 0) {
    console.error("Packaging failed (code: " + code + ")");
    process.exit(code == null ? 1 : code);
  }

  const appDir = path.join(root, "dist", "win-unpacked");
  const appExe = path.join(appDir, "AuraNada.exe");
  if (!fs.existsSync(appExe)) {
    console.error("win-unpacked AuraNada.exe not found: " + appExe);
    process.exit(1);
  }

  const distOut = path.join(root, "dist");
  fs.mkdirSync(distOut, { recursive: true });

  // Stage 2 - compile the Inno Setup installer (unsigned)
  let tpl = fs.readFileSync(path.join(root, "build", "inno-template.iss"), "utf8");
  tpl = tpl
    .replace(/@@APPSRCDIR@@/g, appDir)
    .replace(/@@OUTPUTDIR@@/g, distOut)
    .replace(/@@SETUPICON@@/g, path.join(root, "build", "AuraNada_icon.ico"));

  const gen = path.join(root, "build", "AuraNada.inno.iss");
  fs.writeFileSync(gen, tpl, "utf8");

  const iscc = "C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe";
  if (!fs.existsSync(iscc)) {
    console.error("Inno Setup 6 not installed: " + iscc);
    process.exit(1);
  }

  const r = spawnSync(iscc, [gen], { stdio: "inherit" });
  if (r.status !== 0) {
    console.error("Setup compilation failed (code: " + r.status + ")");
    process.exit(1);
  }

  const setupExe = path.join(distOut, "AuraNada_Setup.exe");
  if (fs.existsSync(setupExe)) {
    console.log("Setup ready: " + setupExe);
  } else {
    console.error("Setup could not be produced: " + setupExe);
    process.exit(1);
  }
});