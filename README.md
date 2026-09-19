# AuraNada — Electron Edition

This folder is a full **Electron + Node.js** rewrite of the previous Python/Tkinter
release. Because the interface is now real HTML/CSS, it is **pixel-identical** to the
`auradio-redesign-v2.html` mockup — the mockup itself became the real interface with
very little change (`src/index.html` + `src/styles.css`).

All of the business logic (FFmpeg filter chain, 2-pass loudnorm, profile system,
analysis, A/B preview, history) was **ported 1:1** from the Python version — no
features were dropped. In this edition, the download modules and Suno-provenance
detection were removed; the app now works purely as an **audio analysis / mastering
tool**.

## Setup (development / run)

1. [Node.js](https://nodejs.org) must be installed (18+ recommended).
2. Put `ffmpeg.exe` and `ffprobe.exe` in the root of this folder (as in the Python
   version — at the project root, not next to the `lib/` folder).
3. In the terminal, in this folder:
   ```
   npm install
   npm start
   ```
   This downloads the `electron` package and opens the app.

## Packaging as .exe

Requirements: [Node.js](https://nodejs.org) (18+), [Inno Setup 6](https://jrsoftware.org/isdl.php)
(installed at `C:\Program Files (x86)\Inno Setup 6\ISCC.exe`), and the code-signing
certificate at `build\cert\AuraNada.pfx` (the password is in `scripts\dist-inno.js`;
the cert itself is **gitignored**, so you need your own to sign — un-signed builds
can be produced by removing/editing the signing steps).

```
npm install
node scripts/dist-inno.js
```

`scripts/dist-inno.js` obfuscates the source with `javascript-obfuscator`, packages the
app with `electron-builder --dir`, then compiles an **Inno Setup** installer
(`build\inno-template.iss` → `build\AuraNada.inno.iss`) in the `dist/` folder:
`AuraNada Setup 3.2.0.exe`.

`ffmpeg.exe`/`ffprobe.exe` are automatically embedded in the package
(`extraResources`). They are **not committed** to this repository (they are near the
100 MB GitHub limit and are GPL binaries) — place `ffmpeg.exe` and `ffprobe.exe` in the
project root before running the packaging step (same requirement as the dev setup).

## Data location

Settings / profiles / history are kept in `%APPDATA%\AuraNada\`
(`settings.json`, `profiles.json`, `history.json`). The JSON schema is kept
compatible, so switching between the Python and Electron versions does not lose
your settings.

## Folder structure

```
main.js          → Electron main process: window, IPC, file dialogs
preload.js       → safe API exposed to the renderer via contextBridge (window.auradio.*)
lib/ffmpeg.js    → filter chain / loudnorm / conversion logic ported from Python
lib/store.js     → JSON read/write helpers
src/index.html   → Interface (the real, functional mockup)
src/styles.css   → CSS from the mockup (the window is a real window now, so
                   the fake "desktop background" was removed; it fills the screen)
src/renderer.js  → All interface logic: state, IPC calls, progress events
```

## Limitations / notes

- No **live Electron runtime test** was possible in this sandbox environment
  (no display server; the `electron` package could not be installed because it
  requires internet). All JS files were syntax-validated with `node --check`;
  every HTML id, every `window.auradio.*` call and every IPC channel name was
  cross-checked between main/preload/renderer. If the first run shows an error
  (visible in the DevTools console — `Ctrl+Shift+I`), paste the message and it
  will be fixed right away.
- The window is **frameless** — the custom title bar from the mockup really
  works (drag + minimize/maximize/close buttons).
- Google Fonts (Sora/Inter/JetBrains Mono) are loaded from the internet; when
  running offline they fall back to system fonts. The fonts can be embedded as
  local files to become fully offline.

## Download

- Installer: `AuraNada Setup 3.2.0.exe` — available on the
  [Releases](https://github.com/suphimen/AuraNada/releases) page.
- Portable: run `dist\win-unpacked\AuraNada.exe` directly.

## License

MIT — see [LICENSE](LICENSE).

## Credit
**suphimen**