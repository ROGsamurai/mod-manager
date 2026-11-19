/**
 * Talks to the RTCGO Manager Bridge plugin running inside the game, through
 * files in BepInEx/config/RTCGOManager/ (see bridge/README.md):
 *   bridge.json                 heartbeat the plugin rewrites every 5 seconds
 *   price-reset.request.json    written here
 *   price-reset.result.json     the plugin's answer
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ALIVE_MS = 15000;      // heartbeat younger than this = game is running with the bridge
const WAIT_MS = 20000;       // how long to wait for the plugin to answer a request
const POLL_MS = 300;

const dirFor = gamePath => path.join(gamePath, 'BepInEx', 'config', 'RTCGOManager');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function findPluginDll(gamePath) {
  const root = path.join(gamePath, 'BepInEx', 'plugins');
  const stack = [[root, 0]];
  while (stack.length) {
    const [dir, depth] = stack.pop();
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (e.isFile() && e.name.toLowerCase() === 'rtcgomanagerbridge.dll') return path.join(dir, e.name);
      if (e.isDirectory() && depth < 3) stack.push([path.join(dir, e.name), depth + 1]);
    }
  }
  return null;
}

/**
 * The bridge plugin ships inside the manager (assets/bridge). Put it in the
 * game, or bring an older copy up to date. Called after every .json save, so a
 * player who edits a file gets it without doing anything. A copy the player
 * already placed elsewhere under plugins is updated where it is, so there is
 * never a second copy. Returns { installed, changed, error }.
 */
const BUNDLED = [
  path.join(__dirname, '../../assets/bridge/RTCGOManagerBridge.dll'),
  path.join(__dirname, '../assets/bridge/RTCGOManagerBridge.dll'),
];
const sha1 = buf => crypto.createHash('sha1').update(buf).digest('hex');

function ensureInstalled(gamePath) {
  if (!gamePath || !fs.existsSync(path.join(gamePath, 'BepInEx'))) return { installed: false, changed: false };
  let src = null;
  for (const p of BUNDLED) { try { src = fs.readFileSync(p); break; } catch { /* try the next location */ } }
  const existing = findPluginDll(gamePath);
  if (!src) return { installed: !!existing, changed: false, error: 'bundled-missing' };
  const dest = existing || path.join(gamePath, 'BepInEx', 'plugins', 'RTCGOManagerBridge', 'RTCGOManagerBridge.dll');
  try { if (sha1(fs.readFileSync(dest)) === sha1(src)) return { installed: true, changed: false }; } catch { /* not there yet */ }
  try {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const tmp = `${dest}.mm-tmp`;
    fs.writeFileSync(tmp, src);
    fs.renameSync(tmp, dest);
    console.log(`[epl-bridge] ${existing ? 'updated' : 'installed'} ${dest}`);
    return { installed: true, changed: true, updated: !!existing };
  } catch (e) {
    // Windows locks a DLL the running game has loaded; the next save after the
    // game closes puts the new copy in.
    try { fs.rmSync(`${dest}.mm-tmp`, { force: true }); } catch {}
    return { installed: !!existing, changed: false, error: e.message };
  }
}

function status(gamePath) {
  if (!gamePath) return { installed: false, running: false };
  const installed = !!findPluginDll(gamePath);
  let hb = null;
  try { hb = JSON.parse(fs.readFileSync(path.join(dirFor(gamePath), 'bridge.json'), 'utf8')); } catch { /* not running */ }
  const lastSeen = hb?.lastSeen ? Date.parse(hb.lastSeen) : NaN;
  const running = Number.isFinite(lastSeen) && Date.now() - lastSeen < ALIVE_MS;
  return {
    installed, running,
    eplReady: running && !!hb?.eplReady,
    startedAt: running ? hb.startedAt : null,
    version: hb?.version || null,
  };
}

/**
 * Ask the running game to reset the prices of these bundles. Resolves with the
 * plugin's answer, or { success: false, error } when the game is not running,
 * the bridge is missing, or no answer comes back in time.
 */
async function resetPrices(gamePath, bundleIds) {
  // Sent exactly as the .json has them; EPL's registry keys are not trimmed.
  const ids = [...new Set((bundleIds || []).map(s => String(s ?? '')).filter(s => s.trim()))];
  if (!ids.length) return { success: false, error: 'No bundles to reset.' };
  const st = status(gamePath);
  if (!st.running) {
    return { success: false, error: st.installed
      ? 'The game is not running. Start it, load your save, then try again.'
      : 'RTCGO Manager Bridge is not installed in the game, so the manager cannot reach it.' };
  }
  const dir = dirFor(gamePath);
  const id = crypto.randomUUID();
  const reqPath = path.join(dir, 'price-reset.request.json');
  const resPath = path.join(dir, 'price-reset.result.json');
  try {
    fs.mkdirSync(dir, { recursive: true });
    try { fs.rmSync(resPath, { force: true }); } catch {}
    const tmp = `${reqPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ id, bundleIds: ids }));
    fs.renameSync(tmp, reqPath);
  } catch (e) { return { success: false, error: `Could not send the request: ${e.message}` }; }

  const until = Date.now() + WAIT_MS;
  while (Date.now() < until) {
    await sleep(POLL_MS);
    let res = null;
    try { res = JSON.parse(fs.readFileSync(resPath, 'utf8')); } catch { continue; }
    if (res?.id !== id) continue;
    try { fs.rmSync(resPath, { force: true }); } catch {}
    if (!res.ready) return { success: false, error: res.error || 'Enhanced Prefab Loader is not ready yet.' };
    return { success: true, results: Array.isArray(res.results) ? res.results : [] };
  }
  try { fs.rmSync(reqPath, { force: true }); } catch {}
  return { success: false, error: 'The game did not answer. It may be paused on a loading screen; try again once it is running.' };
}

module.exports = { status, resetPrices, ensureInstalled };
