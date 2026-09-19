"use strict";
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { hazirla } = require("./obfuscate");

const pfx = path.join(__dirname, "..", "build", "cert", "AuraNada.pfx");
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
  [cli, "--win", "--x64", "--publish", "never", "--projectDir", staging],
  { stdio: "inherit", cwd: staging }
);
child.on("exit", (code) => {
  if (code !== 0) {
    console.error("Build failed (code: " + code + ")");
    process.exit(code == null ? 1 : code);
  }
  // Move the staging output into the project dist/ folder (setup + blockmap + latest.yml)
  try {
    const cikti = path.join(staging, "dist");
    const hedefDist = path.join(__dirname, "..", "dist");
    fs.mkdirSync(hedefDist, { recursive: true });
    for (const f of fs.readdirSync(cikti)) {
      if (f.endsWith(".exe") || f.endsWith(".yml") || f.endsWith(".blockmap")) {
        fs.copyFileSync(path.join(cikti, f), path.join(hedefDist, f));
      }
    }
    console.log("Setup copied: dist\\");
  } catch (err) {
    console.error("Could not copy output: " + err.message);
  }
  process.exit(0);
});
child.on("error", (err) => {
  console.error(err);
  process.exit(1);
});