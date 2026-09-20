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
/**
 * Tried in order, first success wins.
 *
 * jsDelivr is first for policy reasons as much as speed. GitHub rate-limits
 * unauthenticated downloads from raw.githubusercontent.com per public IP, so a
 * user behind a shared address can be handed a 429 because of other people's
 * traffic, and sustained pulls from raw are the pattern GitHub treats as using
 * a repository as a CDN. jsDelivr's acceptable use policy explicitly allows
 * this: free for personal and commercial use, with no limits on bandwidth or
 * request count.
 *
 * raw stays as the fallback, where it is used rarely enough to never approach
 * either limit, and covers a jsDelivr outage or a stale twelve-hour cache.
 */
const MANIFEST_URLS = [
  'https://cdn.jsdelivr.net/gh/ROGsamurai/Mod-Manager-Version-Checker@main/versions.json',
  'https://raw.githubusercontent.com/ROGsamurai/Mod-Manager-Version-Checker/refs/heads/main/versions.json',
];

/** The manager's own Nexus page. It is a mod for the game, so the same version
 *  list that covers every other mod covers this one too. */
const APP_MOD_ID = 974;

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
  getManifestUrl() { return MANIFEST_URLS[0]; }

  /**
   * Flatten the manifest into "name -> latest version" entries.
   *
   * A mod's files each carry their own version, so a multi-file mod such as the
   * Pokemon pack resolves per file: "Pokemon Expansions - Generation 2" is
   * matched and compared on its own, not against the mod's headline version.
   */
  _index(manifest) {
    const byName = new Map();
    const ambiguous = new Set();
    for (const [modId, mod] of Object.entries(manifest?.mods || {})) {
      const add = (name, version) => {
        const key = ident(name);
        if (!key || !version) return;
        const existing = byName.get(key);
        // The same name genuinely belongs to two different mods on Nexus
        // ("LadyLuck" is both mod 142 and mod 939). There is no way to tell
        // which one is installed, and guessing would send someone to the wrong
        // mod page, so neither gets a badge.
        if (existing && existing.modId !== Number(modId)) ambiguous.add(key);
        byName.set(key, { name, version: String(version), modId: Number(modId), modName: mod.name || name });
      };
      add(mod.name, mod.version);
      for (const f of mod.files || []) add(f.name, f.version);
    }
    for (const key of ambiguous) byName.delete(key);
    if (ambiguous.size) console.log(`[updates] ${ambiguous.size} ambiguous mod name(s) skipped`);
    return byName;
  }

  /**
   * Newest-first comparison.
   *
   * Authors write versions freely: "v1.2", "1.0.0.3", "Beta 2", and at least
   * one mod publishes "v0.4.0" in the version field itself. Pull the numeric
   * groups out rather than trusting the string to be dotted digits, and refuse
   * to judge when either side has no numbers at all — a wrong badge is worse
   * than a missing one.
   */
  _isNewer(latest, installed) {
    const parts = v => (String(v).match(/\d+/g) || []).map(Number);
    const pa = parts(latest), pb = parts(installed);
    if (!pa.length || !pb.length) return false;
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
    let data, lastErr;
    for (const url of MANIFEST_URLS) {
      try { data = await fetchJson(url); break; }
      catch (err) {
        lastErr = err;
        console.warn(`[updates] ${new URL(url).hostname} failed: ${err.message}`);
      }
    }
    if (!data) throw lastErr || new Error('No manifest source reachable');
    const fetchedAt = Date.now();
    store.set('updateCache', { fetchedAt, data });
    return { data, fetchedAt, cached: false };
  }

  /**
   * Compare installed mods against the manifest.
   * Returns { enabled, checkedAt, error, updates: { [modId]: {...} } } keyed by
   * the manager's own mod id, so the renderer can look up a row directly.
   */
  async check(installedMods, force = false, appVersion = null) {
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
    // Published version for every tracked mod, whether or not it is newer — the
    // Installed Mods list shows it so the column reads as "this is the newest
    // there is" rather than going blank when you are up to date.
    const latest = {};
    for (const mod of installedMods || []) {
      if (!mod?.version) continue;                 // nothing to compare against
      const hit = index.get(ident(mod.name));
      if (!hit) continue;                          // not tracked, or renamed by the user
      latest[mod.id] = hit.version;
      if (this._isNewer(hit.version, mod.version)) {
        updates[mod.id] = {
          name: mod.name, installed: mod.version, latest: hit.version,
          modId: hit.modId, modName: hit.modName,
        };
      }
    }
    // The manager itself: same comparison, reported separately so the UI can
    // say "Mod Manager Update Available" rather than leaving the user guessing
    // which mod the badge refers to.
    let app = null;
    const appEntry = manifest.data?.mods?.[APP_MOD_ID];
    if (appVersion && appEntry?.version && this._isNewer(appEntry.version, appVersion)) {
      app = { installed: appVersion, latest: String(appEntry.version), modId: APP_MOD_ID, name: appEntry.name };
    }

    return { checkedAt: manifest.fetchedAt, cached: manifest.cached, updates, latest, app };
  }
  /**
   * The published name for a mod, from whatever list is already cached.
   *
   * Used to name an installed mod the way Nexus does rather than however its
   * archive happened to be called. Cache-only and synchronous: installing must
   * never wait on the network, and if nothing is cached the caller keeps the
   * name it parsed.
   */
  canonicalName(name) {
    if (!name) return null;
    const cached = store.get('updateCache', null);
    if (!cached?.data) return null;
    if (!this._nameIndex || this._nameIndexFor !== cached.fetchedAt) {
      this._nameIndex = this._index(cached.data);
      this._nameIndexFor = cached.fetchedAt;
    }
    const hit = this._nameIndex.get(ident(name));
    return hit ? hit.name : null;
  }
}

module.exports = new UpdateChecker();
module.exports.UpdateChecker = UpdateChecker;
