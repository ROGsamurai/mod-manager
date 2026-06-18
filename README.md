# Real TCG Overhaul Mod Manager

**A portable, offline mod manager for TCG Card Shop Simulator.**

Created by **iiTzSamurai** · [Discord](https://discord.gg/NHSvm22TSh)

> ⚠️ **Unofficial fan-made tool.** Not affiliated with or endorsed by OPNeonGames.

---

## Features

### Mod Installation & Management
- Install mods from **.zip**, **.rar**, and **.7z** archives
- Auto-detects where each mod should go (Game Root, BepInEx, plugins, patchers, or config)
- Handles wrapper folders, case-insensitive BepInEx detection, and loose DLL archives
- Toggle mods on/off without deleting them
- Lock core mods to prevent accidental disabling
- Auto-locks mods containing prefabloader data as core (prevents save corruption)
- Clean uninstall with config file (.cfg) preservation
- Version tracking with Install, Update, Re-install, and Downgrade options

### Staging System
- Drop mod archives into the staging folder next to the .exe, or browse for them
- Parses Nexus Mods filenames automatically for name and version
- Smart status detection: shows if a staged mod is new, an update, or a reinstall
- **Install New** — installs only new mods without touching existing ones
- **Update All** — overwrites only mods that have updates staged
- Progress bar persists even when switching tabs

### Security Scanner
- Every archive is automatically scanned before installation
- **Blocked**: executables (.exe, .bat, .ps1, etc.), path traversal, system DLLs, zip bombs
- **Warnings**: unknown loose DLLs, whitelisted tools
- **Verified Safe**: 27 developer-verified mods show an instant ✅ badge
- Security badge visible on each mod panel at a glance

### Mod Profiles
- Save which mods are enabled/disabled as a named profile
- Switch between mod setups instantly
- Active profile highlighted with a green indicator

### Game Integration
- Auto-detects **Steam** and **Xbox Game Pass** installations
- One-click game launch
- BepInEx status indicator
- Quick-open buttons for Staging Folder, Game Folder, Save Folder, and App Data

### 10 Themes
- **Dark**: Midnight (default), Cyberpunk, Forest, Ocean, Crimson
- **Light**: Clean, Cream, Lavender, Mint, Sunrise

### 10 Languages
English, Español, Français, Deutsch, Italiano, Português (Brasil), 中文, 日本語, 한국어, Русский

### 19 Suggested Mods
Curated list of recommended mods with category filters. Download links open Nexus Mods in your browser.

---

## Installation

1. Download **Real TCG Overhaul Mod Manager.exe** from the Files tab
2. Place it wherever you like (Desktop, game folder, etc.)
3. Run it — a **staging** folder is automatically created next to the .exe
4. The manager auto-detects your game installation

**That's it.** No installer, no setup wizard, no accounts.

## How to Use

1. Download mod archives (.zip / .rar / .7z) from Nexus Mods
2. Drop them into the **staging** folder next to the .exe, or click **+ Add Archives**
3. The manager auto-detects the correct install target for each mod
4. Click **Install New** to install all new mods, or install individually
5. Use **Profiles** to save and switch between mod configurations

---

## Privacy & Security

**This app does not connect to the internet.** At all.

- No telemetry or analytics
- No auto-updater
- No API calls
- No accounts or login
- No data collection

The only "network" actions are opening Nexus Mods pages and Discord in your default browser, and launching the game via Steam protocol.

All data is stored locally:
- `%APPDATA%/Real TCG Overhaul Mod Manager/` — settings and mod database
- `<exe-location>/staging/` — staged mod archives
- `<exe-location>/disabled-mods/` — disabled mod files

---

## Anti-Virus / Windows SmartScreen

This is an **unsigned** Electron app. Some antivirus programs and Windows SmartScreen may flag unsigned portable executables as a precaution. **This is a false positive.**

To verify:
1. Upload to [VirusTotal](https://www.virustotal.com) and check scan results
2. Monitor network activity — you will see none
3. Run in a VM or sandbox first if concerned

---

## Requirements

- Windows 10/11 (64-bit)
- TCG Card Shop Simulator (Steam or Xbox Game Pass)
- No additional software required

---

## Credits

- **iiTzSamurai** — Development
- **OPNeonGames** — TCG Card Shop Simulator
- **BepInEx** — Modding framework

## License

Copyright © 2026 iiTzSamurai. All Rights Reserved. See [LICENSE](./LICENSE).

## Contact & Support

- Discord: https://discord.gg/NHSvm22TSh
- Nexus Mods: Report bugs on the mod page
