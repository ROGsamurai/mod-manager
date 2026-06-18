const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const os = require('os');

const GAME_FOLDER = 'TCG Card Shop Simulator';
const GAME_EXE = 'Card Shop Simulator.exe';
const STEAM_APP_ID = '3070070';

// Xbox Game Pass possible folder names (may vary)
const XBOX_FOLDER_NAMES = [
  'TCG Card Shop Simulator',
  'Card Shop Simulator',
  'TCGCardShopSimulator',
  'CardShopSimulator',
];

class GameDetector {
  async detect() {
    // 1. Try Steam first
    const steam = await this._findSteam();
    if (steam) { const g = await this._findInSteam(steam); if (g) return g; }

    // 2. Try Xbox Game Pass
    const xbox = this._findXbox();
    if (xbox) return xbox;

    // 3. Fall back to common Steam paths
    for (const l of this._defaultsSteam()) { if (this._ok(l)) return l; }

    return null;
  }

  _ok(p) { return p && fs.existsSync(path.join(p, GAME_EXE)); }

  // ─── Steam Detection ───

  async _findSteam() {
    if (os.platform() !== 'win32') return null;
    return new Promise(res => {
      exec('reg query "HKCU\\Software\\Valve\\Steam" /v SteamPath', (e, o) => {
        if (e) return res(null);
        const m = o.match(/SteamPath\s+REG_SZ\s+(.+)/i);
        res(m ? m[1].trim() : null);
      });
    });
  }

  async _findInSteam(steam) {
    const def = path.join(steam, 'steamapps', 'common', GAME_FOLDER);
    if (this._ok(def)) return def;
    const vdf = path.join(steam, 'steamapps', 'libraryfolders.vdf');
    if (!fs.existsSync(vdf)) return null;
    try {
      const c = fs.readFileSync(vdf, 'utf-8');
      const re = /"path"\s+"([^"]+)"/gi; let m;
      while ((m = re.exec(c)) !== null) {
        const p = path.join(m[1].replace(/\\\\/g, '\\'), 'steamapps', 'common', GAME_FOLDER);
        if (this._ok(p)) return p;
      }
    } catch {} return null;
  }

  _defaultsSteam() {
    if (os.platform() !== 'win32') return [];
    const l = [];
    for (const d of ['C','D','E','F','G']) {
      l.push(`${d}:\\Program Files (x86)\\Steam\\steamapps\\common\\${GAME_FOLDER}`,
        `${d}:\\Program Files\\Steam\\steamapps\\common\\${GAME_FOLDER}`,
        `${d}:\\SteamLibrary\\steamapps\\common\\${GAME_FOLDER}`,
        `${d}:\\Steam\\steamapps\\common\\${GAME_FOLDER}`,
        `${d}:\\Games\\Steam\\steamapps\\common\\${GAME_FOLDER}`);
    } return l;
  }

  // ─── Xbox Game Pass Detection ───

  _findXbox() {
    if (os.platform() !== 'win32') return null;

    for (const d of ['C','D','E','F','G']) {
      for (const folderName of XBOX_FOLDER_NAMES) {
        // Modern Xbox app: X:\XboxGames\GameName\Content\
        const xboxPath = `${d}:\\XboxGames\\${folderName}\\Content`;
        if (this._ok(xboxPath)) return xboxPath;

        // Also check without Content subfolder
        const xboxDirect = `${d}:\\XboxGames\\${folderName}`;
        if (this._ok(xboxDirect)) return xboxDirect;
      }

      // Scan XboxGames folder on each drive for any folder containing the game exe
      const xboxRoot = `${d}:\\XboxGames`;
      if (fs.existsSync(xboxRoot)) {
        try {
          for (const entry of fs.readdirSync(xboxRoot, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            // Check Content subfolder
            const contentPath = path.join(xboxRoot, entry.name, 'Content');
            if (this._ok(contentPath)) return contentPath;
            // Check directly
            const directPath = path.join(xboxRoot, entry.name);
            if (this._ok(directPath)) return directPath;
          }
        } catch {}
      }

      // Also check Program Files\WindowsApps (Microsoft Store / older Game Pass)
      for (const folderName of XBOX_FOLDER_NAMES) {
        const msStorePath = `${d}:\\Program Files\\WindowsApps\\${folderName}`;
        if (this._ok(msStorePath)) return msStorePath;
      }

      // Scan WindowsApps for matching game folders
      const winApps = `${d}:\\Program Files\\WindowsApps`;
      if (fs.existsSync(winApps)) {
        try {
          for (const entry of fs.readdirSync(winApps, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            if (entry.name.toLowerCase().includes('cardshop') || entry.name.toLowerCase().includes('card shop')) {
              const p = path.join(winApps, entry.name);
              if (this._ok(p)) return p;
            }
          }
        } catch {} // WindowsApps is often permission-locked, that's fine
      }
    }

    return null;
  }

  // ─── Launch ───

  launchGame(gamePath) {
    const { shell } = require('electron');
    const isXbox = gamePath && (
      gamePath.toLowerCase().includes('xboxgames') ||
      gamePath.toLowerCase().includes('windowsapps')
    );

    if (isXbox) {
      // Xbox Game Pass — launch the exe directly
      const exePath = path.join(gamePath, GAME_EXE);
      if (fs.existsSync(exePath)) {
        const { execFile } = require('child_process');
        execFile(exePath, { cwd: gamePath }, () => {});
      } else {
        // Fallback: try Steam anyway
        shell.openExternal(`steam://rungameid/${STEAM_APP_ID}`);
      }
    } else {
      // Steam — use Steam protocol
      shell.openExternal(`steam://rungameid/${STEAM_APP_ID}`);
    }
  }
}

module.exports = new GameDetector();
