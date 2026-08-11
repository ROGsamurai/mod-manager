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
    if (os.platform() === 'win32') {
      return new Promise(res => {
        exec('reg query "HKCU\\Software\\Valve\\Steam" /v SteamPath', (e, o) => {
          if (e) return res(null);
          const m = o.match(/SteamPath\s+REG_SZ\s+(.+)/i);
          res(m ? m[1].trim() : null);
        });
      });
    }
    // Linux (incl. Steam Deck) / macOS: Steam has no registry, but its root is
    // in a small set of well-known places. Return the first that exists —
    // _findInSteam() then reads steamapps/ and libraryfolders.vdf from it, which
    // is already platform-agnostic.
    for (const root of this._steamRootsUnix()) {
      try { if (fs.existsSync(path.join(root, 'steamapps'))) return root; } catch {}
    }
    return null;
  }

  /**
   * Candidate Steam roots on Linux/macOS, including Steam Deck layouts.
   * Ordered most-likely-first.
   */
  _steamRootsUnix() {
    const home = os.homedir();
    if (os.platform() === 'darwin') {
      return [path.join(home, 'Library/Application Support/Steam')];
    }
    return [
      path.join(home, '.local/share/Steam'),          // default on Linux + Steam Deck
      path.join(home, '.steam/steam'),                // classic symlink
      path.join(home, '.steam/root'),
      path.join(home, '.var/app/com.valvesoftware.Steam/.local/share/Steam'), // Flatpak Steam
      path.join(home, '.local/share/steam'),          // case variations seen in the wild
    ];
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
    if (os.platform() !== 'win32') {
      const l = [];
      // Steam roots (incl. Flatpak) …
      for (const root of this._steamRootsUnix()) {
        l.push(path.join(root, 'steamapps', 'common', GAME_FOLDER));
      }
      // … plus Steam Deck removable media: the microSD card and any other
      // mounted drive Steam has been pointed at.
      for (const media of ['/run/media', path.join(os.homedir(), '.local/share/Steam/steamapps')]) {
        try {
          if (!fs.existsSync(media)) continue;
          for (const entry of fs.readdirSync(media, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            const base = path.join(media, entry.name);
            l.push(path.join(base, 'steamapps', 'common', GAME_FOLDER));
            // /run/media/deck/<label>/ nests one level deeper
            try {
              for (const sub of fs.readdirSync(base, { withFileTypes: true })) {
                if (sub.isDirectory()) l.push(path.join(base, sub.name, 'steamapps', 'common', GAME_FOLDER));
              }
            } catch {}
          }
        } catch {}
      }
      return l;
    }
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

  /**
   * Build an ordered list of things we could launch for a given game folder.
   *
   * Xbox Game Pass installs are laid out as:
   *   <install root>\gamelaunchhelper.exe
   *   <install root>\Content\Card Shop Simulator.exe
   * so the user may have pointed us at EITHER the install root or Content.
   * Steam/manual installs just have the exe directly in the folder. Checking only
   * "<gamePath>\<exe>" meant a Game Pass user who set the install root got no
   * match and fell through to the Steam launcher — the reported bug.
   */
  _resolveLaunchCandidates(gamePath) {
    const out = [];
    const seen = new Set();
    const add = (p, kind) => {
      if (!p) return;
      const key = p.toLowerCase();
      if (seen.has(key)) return;
      try { if (!fs.existsSync(p) || !fs.statSync(p).isFile()) return; } catch { return; }
      seen.add(key);
      out.push({ exe: p, cwd: path.dirname(p), kind });
    };

    const parent = path.dirname(gamePath);

    // 1. The exe exactly where the user pointed us.
    add(path.join(gamePath, GAME_EXE), 'exe');
    // 2. Game Pass: the exe lives under Content\.
    add(path.join(gamePath, 'Content', GAME_EXE), 'exe');
    // 3. User pointed at Content\ — nothing more to find there, but check siblings.
    add(path.join(parent, GAME_EXE), 'exe');
    // 4. Any other single-level subfolder holding the exe (unusual layouts).
    try {
      for (const e of fs.readdirSync(gamePath, { withFileTypes: true })) {
        if (e.isDirectory()) add(path.join(gamePath, e.name, GAME_EXE), 'exe');
      }
    } catch {}
    // 5. Game Pass launch helper — the supported way to start a Game Pass title
    //    when running the exe directly is refused by licensing. It starts the
    //    real exe from Content\, so BepInEx's proxy DLL still loads.
    add(path.join(gamePath, 'gamelaunchhelper.exe'), 'gamepass');
    add(path.join(parent, 'gamelaunchhelper.exe'), 'gamepass');

    return out;
  }

  launchGame(gamePath) {
    const { shell } = require('electron');
    const launchSteam = () => { shell.openExternal(`steam://rungameid/${STEAM_APP_ID}`); };

    if (!gamePath) { launchSteam(); return { success: true, method: 'steam' }; }

    // Decide by whether this is a STEAM install, not by guessing "is it Xbox".
    // Steam games always live under "steamapps\common" — a reliable signal.
    // Everything else (Game Pass in ANY folder, or a manual copy) launches the
    // real executable from the folder the user set.
    const isSteam = /(^|[\\/])steamapps[\\/]/i.test(gamePath);
    if (isSteam) { launchSteam(); return { success: true, method: 'steam' }; }

    // On Linux/macOS the game is a WINDOWS executable running under Proton/Wine.
    // Spawning "Card Shop Simulator.exe" directly would either do nothing or
    // start it outside the Proton prefix (no BepInEx, no saves). Steam has to
    // launch it, so always use the steam:// protocol there. Xbox Game Pass does
    // not exist on these platforms, so nothing is lost.
    if (os.platform() !== 'win32') {
      launchSteam();
      return { success: true, method: 'steam', proton: true };
    }

    const candidates = this._resolveLaunchCandidates(gamePath);
    if (candidates.length === 0) {
      // Nothing runnable found — fall back so the button still does something.
      launchSteam();
      return { success: true, method: 'steam', exeMissing: true };
    }

    // Spawn candidates in order; a spawn error (e.g. EACCES on a licensing-locked
    // Game Pass exe) is asynchronous, so failures roll on to the next candidate
    // and only reach the Steam fallback once everything has been tried.
    const { spawn } = require('child_process');
    const tryAt = (i) => {
      if (i >= candidates.length) { launchSteam(); return; }
      const { exe, cwd } = candidates[i];
      try {
        // detached + unref so the game keeps running if the manager is closed.
        const child = spawn(exe, [], { cwd, detached: true, stdio: 'ignore' });
        child.on('error', () => tryAt(i + 1));
        child.unref();
      } catch {
        tryAt(i + 1);
      }
    };
    tryAt(0);

    return { success: true, method: candidates[0].kind === 'gamepass' ? 'gamepass' : 'exe', exePath: candidates[0].exe };
  }
}

module.exports = new GameDetector();
