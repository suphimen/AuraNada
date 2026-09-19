"use strict";
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { hazirla } = require("./obfuscate");

const root = path.join(__dirname, "..");
const pfx = path.join(root, "build", "cert", "AuraNada.pfx");
if (!fs.existsSync(pfx)) {
  console.error("Signing certificate not found: " + pfx);
  process.exit(1);
}

process.env.CSC_LINK = pfx;
process.env.CSC_KEY_PASSWORD = "AuraNada-CS-2026";

const staging = hazirla();

const cli = require.resolve("electron-builder/out/cli/cli.js");
const child = spawn(
  process.execPath,
  [cli, "--win", "--x64", "--dir", "--publish", "never", "--projectDir", staging],
  { stdio: "inherit", cwd: staging }
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
  const appDir = path.join(staging, "dist", "win-unpacked");
  const appExe = path.join(appDir, "AuraNada.exe");
  if (!fs.existsSync(appExe)) {
    console.error("win-unpacked AuraNada.exe not found: " + appExe);
    process.exit(1);
  }

  const distOut = path.join(root, "dist");
  fs.mkdirSync(distOut, { recursive: true });

  const signtool = path.join(
    process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
    "electron-builder", "Cache", "winCodeSign", "winCodeSign-2.6.0",
    "windows-10", "x64", "signtool.exe"
  );
  if (!fs.existsSync(signtool)) {
    console.error("signtool not found: " + signtool);
    process.exit(1);
  }

  const pfxTmp = path.join(
    process.env.TEMP || "C:\\Windows\\Temp", "opencode", "AuraNada.pfx"
  );
  fs.mkdirSync(path.dirname(pfxTmp), { recursive: true });
  fs.copyFileSync(pfx, pfxTmp);

  const signer =
    `${signtool} sign /f ${pfxTmp} /p AuraNada-CS-2026 /fd SHA256 ` +
    "/tr http://timestamp.digicert.com /td SHA256 $f";

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

  const r = spawnSync(iscc, [gen, "/Saurasign=" + signer], { stdio: "inherit" });
  if (r.status !== 0) {
    console.error("Setup compilation failed (code: " + r.status + ")");
    process.exit(1);
  }

  const setupExe = path.join(distOut, "AuraNada Setup 3.2.0.exe");
  if (fs.existsSync(setupExe)) {
    console.log("Setup ready: " + setupExe);
  } else {
    console.error("Setup could not be produced: " + setupExe);
    process.exit(1);
  }
});