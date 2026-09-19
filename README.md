# AuraNada

AuraNada is a free, open-source audio mastering studio for Windows. It analyzes, normalizes and re-masters audio files with a clean, native-feeling interface. Everything runs locally on your machine.

## Features

- Multi-format conversion (MP4, MP3, FLAC, WAV) powered by FFmpeg
- 2-pass loudness normalization to an exact LUFS target
- Loudness Range (LRA) and true-peak analysis
- One-click metadata cleaning, protected-tag preserving, or complete wipe
- Real-time A/B preview of the original versus the processed result
- Pitch/tempo micro-adjust, stereo widening, warmth EQ, dynamic compression, room reverb and tape-hiss textures
- Built-in profiles plus fully customizable, saveable profiles
- Batch conversion with optional `names.txt` output naming
- 100% offline; FFmpeg is bundled with the installer

## Install

Download `AuraNada-Setup-3.2.0.exe` from the [Releases](https://github.com/suphimen/AuraNada/releases) page.

No runtime is required. FFmpeg, FFprobe, Node.js and everything else is either bundled or only needed for development.

## Development

Requirements:

- Node.js 18+ and npm
- `ffmpeg.exe` and `ffprobe.exe` placed in the project root (development only; the binaries are not committed to the repository)
- Inno Setup 6 (only to build the installer)

```bash
npm install
npm start
```

## Building the installer

```bash
npm install
npm run dist
```

`npm run dist` packages the unpacked app with Electron Builder and compiles the Inno Setup installer into `dist\AuraNada-Setup-3.2.0.exe`.

## Application data

Settings, profiles and processing history live in `%APPDATA%\AuraNada\`:

- `settings.json` - current defaults
- `profiles.json` - custom profiles
- `history.json` - normalization history

## Project structure

```text
main.js             Electron main process, security hardening, IPC handlers
preload.js          Safe IPC bridge (contextIsolation kept on)
lib/ffmpeg.js       FFmpeg wrapper: analysis, filter chain, conversion
lib/store.js        JSON storage helpers
src/index.html      Interface markup
src/styles.css      Interface styling (dark theme)
src/renderer.js     Interface logic and profile system
scripts/dist-inno.js  Installer build script
build/inno-template.iss  Inno Setup template
showcase.html       Project landing page
USER_GUIDE.txt      Bundled user guide
```

## License

MIT - see [LICENSE](LICENSE).