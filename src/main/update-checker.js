const https = require('https');
const Store = require('electron-store');

const store = new Store({ name: 'mod-manager' });

/**
 * Mod update checking.
 *
 * The manager never talks to the Nexus API. A scheduled job (see
 * .github/workflows/update-versions.yml) calls the API once a day with the
 * author's own key and publishes a small static JSON file; this module fetches
 * that file and compares it against what is installed.
 *
 * Consequences of that design, all deliberate:
 *   - no API key ships with the app and users never enter one
 *   - the number of users has no effect on API usage, because users only ever
 *     fetch a static file
 *   - a failed fetch means no update badges, never a broken app
 *
 * Runs automatically on startup. One small request to a static file on a CDN;
 * if it fails the last good list is reused, and if there is none the app simply
 * shows no update badges.
 */

/**
 * Where the version list lives. Built and published by
 * https://github.com/ROGsamurai/Mod-Manager-Version-Checker — a scheduled job
 * that calls the Nexus API once a day with the author's own key. Baked in
 * rather than configurable: it is part of the app, not a user setting.
 */
const MANIFEST_URL = 'https://raw.githubusercontent.com/ROGsamurai/Mod-Manager-Version-Checker/refs/heads/main/versions.json';

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;   // re-fetch at most every 6 hours
const FETCH_TIMEOUT_MS = 10000;
const MAX_BYTES = 2 * 1024 * 1024;         // a version list should be a few KB

/** Name key for matching, identical to the renderer's and the backend's rules. */
const ident = v => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    let req;
    const done = (err, val) => { try { req?.destroy(); } catch {} err ? reject(err) : resolve(val); };
    try {
      req = https.get(url, {
        timeout: FETCH_TIMEOUT_MS,
        headers: { 'User-Agent': 'RealTCGOverhaulModManager', 'Accept': 'application/json' },
      }, res => {
        // One hop of redirect is enough for raw.githubusercontent.com.
        if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.resume();
          return fetchJson(res.headers.location).then(v => done(null, v), e => done(e));
        }
        if (res.statusCode !== 200) { res.resume(); return done(new Error(`HTTP ${res.statusCode}`)); }
        let size = 0; const chunks = [];
        res.on('data', c => {
          size += c.length;
          if (size > MAX_BYTES) return done(new Error('manifest too large'));
          chunks.push(c);
        });
        res.on('end', () => {
          try { done(null, JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
          catch (e) { done(new Error('manifest is not valid JSON')); }
        });
      });
      req.on('timeout', () => done(new Error('timed out')));
      req.on('error', e => done(e));
    } catch (e) { done(e); }
  });
}

class UpdateChecker {
  getManifestUrl() { return MANIFEST_URL; }

  /**
   * Flatten the manifest into "name -> latest version" entries.
   *
   * A mod's files each carry their own version, so a multi-file mod such as the
   * Pokemon pack resolves per file: "Pokemon Expansions - Generation 2" is
   * matched and compared on its own, not against the mod's headline version.
   */
  _index(manifest) {
    const byName = new Map();
    for (const [modId, mod] of Object.entries(manifest?.mods || {})) {
      const add = (name, version) => {
        const key = ident(name);
        if (!key || !version) return;
        byName.set(key, { name, version: String(version), modId: Number(modId), modName: mod.name || name });
      };
      add(mod.name, mod.version);
      for (const f of mod.files || []) add(f.name, f.version);
    }
    return byName;
  }

  /** Newest-first comparison, same rules as the staging list uses. */
  _isNewer(latest, installed) {
    const pa = String(latest).split('.').map(n => parseInt(n, 10) || 0);
    const pb = String(installed).split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const a = pa[i] || 0, b = pb[i] || 0;
      if (a > b) return true;
      if (a < b) return false;
    }
    return false;
  }

  async getManifest(force = false) {
    const cached = store.get('updateCache', null);
    if (!force && cached?.data && Date.now() - (cached.fetchedAt || 0) < CACHE_TTL_MS) {
      return { data: cached.data, fetchedAt: cached.fetchedAt, cached: true };
    }
    const data = await fetchJson(MANIFEST_URL);
    const fetchedAt = Date.now();
    store.set('updateCache', { fetchedAt, data });
    return { data, fetchedAt, cached: false };
  }

  /**
   * Compare installed mods against the manifest.
   * Returns { enabled, checkedAt, error, updates: { [modId]: {...} } } keyed by
   * the manager's own mod id, so the renderer can look up a row directly.
   */
  async check(installedMods, force = false) {
    let manifest;
    try {
      manifest = await this.getManifest(force);
    } catch (err) {
      // Offline, blocked, or the file is not there yet: no badges, no noise.
      console.warn('[updates] manifest fetch failed:', err.message);
      const cached = store.get('updateCache', null);
      if (!cached?.data) return { updates: {}, error: err.message };
      manifest = { data: cached.data, fetchedAt: cached.fetchedAt, cached: true };
    }

    const index = this._index(manifest.data);
    const updates = {};
    for (const mod of installedMods || []) {
      if (!mod?.version) continue;                 // nothing to compare against
      const hit = index.get(ident(mod.name));
      if (!hit) continue;                          // not tracked, or renamed by the user
      if (this._isNewer(hit.version, mod.version)) {
        updates[mod.id] = {
          name: mod.name, installed: mod.version, latest: hit.version,
          modId: hit.modId, modName: hit.modName,
        };
      }
    }
    return { checkedAt: manifest.fetchedAt, cached: manifest.cached, updates };
  }
}

module.exports = new UpdateChecker();
module.exports.UpdateChecker = UpdateChecker;
