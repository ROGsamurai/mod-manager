const https = require('https');

/**
 * Mod update checking.
 *
 * Asks Nexus Mods' public GraphQL endpoint about the mods THIS user has
 * installed, and nothing else. Nexus Mods support confirmed this design is
 * permitted without registration or an API key.
 *
 * The rules it is built to respect, after an earlier version of this feature
 * broke them:
 *
 *   - Per user, not en masse. Only the mod ids found in this install are asked
 *     about. There is no sweep of the game's catalogue.
 *   - Nothing is rehosted. The answer lives in memory for the session and is
 *     never written to disk, published, or shared between users.
 *   - Read only. A result can show "Update Available" and open the mod's page
 *     in the browser. Nothing is downloaded.
 *   - Once per launch, and a failure is silent: no badges, no error.
 */

const ENDPOINT = 'https://api.nexusmods.com/v2/graphql';
const GAME_DOMAIN = 'tcgcardshopsimulator';   // for the mod-page links only
const APP_MOD_ID = 974;              // the manager's own page
const TIMEOUT_MS = 15000;
// The endpoint paginates; the job that listed the whole game used 50 per page
// and worked, so stay at that. Asking for more can be rejected outright, which
// would fail the whole check silently.
const PAGE = 50;

/** Name key for matching, identical to the rules used elsewhere. */
const ident = v => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function post(query, variables) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query, variables });
    const req = https.request(ENDPOINT, {
      method: 'POST',
      timeout: TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent': 'RealTCGOverhaulModManager (+https://www.nexusmods.com/tcgcardshopsimulator/mods/974)',
      },
    }, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        try {
          const parsed = JSON.parse(data);
          if (parsed.errors?.length) return reject(new Error(parsed.errors.map(e => e.message).join('; ')));
          resolve(parsed.data);
        } catch { reject(new Error('Unreadable response')); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('Timed out')));
    req.on('error', reject);
    req.end(body);
  });
}

/**
 * One alias per mod, each asking about a SINGLE mod id.
 *
 * Putting several ids in one filter returns nothing: multiple values in the
 * same field are combined as AND, so "modId = 69 AND modId = 685" matches no
 * mod at all — which looked exactly like "no updates" rather than an error.
 * A single id per filter is the shape confirmed working against the live
 * endpoint, and aliases keep it to one request.
 */
function modsQuery(ids, gameId) {
  const fields = ids.map(id => `  m${id}: mods(filter: { gameId: [{ value: "${gameId}", op: EQUALS }], modId: [{ value: "${id}", op: EQUALS }] }, count: 1) {
    nodes { modId gameId name version status updatedAt }
  }`).join('\n');
  return `query InstalledMods {\n${fields}\n}`;
}

/**
 * TCG Card Shop Simulator's numeric id on Nexus Mods. The endpoint requires it
 * whenever the filter includes modId ("gameId is required when filtering by
 * modId"). It is fixed, so it is baked in; GAME_ID_QUERY below is only a
 * fallback in case that ever changes.
 */
const GAME_ID = 6826;

/**
 * One request covering every installed mod's file list, using GraphQL aliases
 * rather than a request per mod.
 */
function filesQuery(entries) {
  const fields = entries
    .map(({ modId, gameId }) => `  m${modId}: modFiles(modId: "${modId}", gameId: "${gameId}") { name version category }`)
    .join('\n');
  return `query InstalledModFiles {\n${fields}\n}`;
}

const INSTALLABLE_EXCLUDED = new Set(['OLD_VERSION', 'DELETED', 'ARCHIVED', 'REMOVED']);

class UpdateCheck {
  constructor() {
    this._session = null;      // in-memory only, cleared when the app closes
  }

  /** Newest-first comparison, tolerant of "v1.2", "1.0.0.3" and "Beta 2". */
  _isNewer(latest, installed) {
    const parts = v => (String(v).match(/\d+/g) || []).map(Number);
    const a = parts(latest), b = parts(installed);
    if (!a.length || !b.length) return false;
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if ((a[i] || 0) > (b[i] || 0)) return true;
      if ((a[i] || 0) < (b[i] || 0)) return false;
    }
    return false;
  }

  /**
   * @param {Array} installedMods from the manager's database
   * @param {string} appVersion   the running app version, for its own check
   * @param {boolean} force       ignore the session result and ask again
   */
  async check(installedMods = [], appVersion = null, force = false) {
    if (this._session && !force) return this._session;

    // Only ids this user actually has, plus the manager itself.
    const ids = [...new Set(installedMods.map(m => Number(m.nexusId)).filter(Boolean))];
    if (appVersion) ids.push(APP_MOD_ID);
    if (!ids.length) return { updates: {}, latest: {}, app: null, checkedAt: Date.now() };

    const byId = new Map();
    try {
      const gameId = GAME_ID;
      // Aliased in batches: one alias per mod id, so each filter carries a
      // single id. Batched rather than sent as one huge document so a very
      // large library cannot produce a query the server rejects outright.
      for (let i = 0; i < ids.length; i += PAGE) {
        const chunk = ids.slice(i, i + PAGE);
        const data = await post(modsQuery(chunk, gameId), {});
        for (const id of chunk) {
          const n = data?.[`m${id}`]?.nodes?.[0];
          if (n) byId.set(Number(n.modId), n);
        }
      }
      this._lastError = null;
    } catch (err) {
      console.warn('[updates] check failed:', err.message);
      this._lastError = err.message;
      return { updates: {}, latest: {}, app: null, error: err.message, diagnostics: { installed: installedMods.length, withId: ids.length, answered: 0, withFiles: 0, updates: 0 } };
    }

    // Per-file versions, so a multi-file mod reports per file rather than by the
    // mod's headline version. One request for all of them.
    const fileLists = new Map();
    const withGame = [...byId.values()].filter(n => n.gameId).map(n => ({ modId: Number(n.modId), gameId: n.gameId }));
    if (withGame.length) {
      try {
        const data = await post(filesQuery(withGame), {});
        for (const { modId } of withGame) {
          const rows = data?.[`m${modId}`] || [];
          fileLists.set(modId, rows.filter(f => f?.name && f?.version
            && !INSTALLABLE_EXCLUDED.has(String(f.category || '').toUpperCase())));
        }
      } catch (err) {
        // Not fatal: without file lists the mod's headline version is used.
        console.warn('[updates] file list unavailable, using mod versions:', err.message);
        this._fileListError = err.message;
      }
    }

    /** Newest published version for one installed mod, by id then by file name. */
    const publishedFor = mod => {
      const node = byId.get(Number(mod.nexusId));
      if (!node) return null;
      const files = fileLists.get(Number(mod.nexusId)) || [];
      // Match within this mod's OWN files only — no cross-mod name matching, so
      // two mods sharing a file name can never be confused for each other.
      //
      // Many authors put the version in the file name ("TextureReplacer 1.6.7"),
      // which never equals the installed name ("TextureReplacer"). Compare with
      // a trailing version stripped as well, so those still match per file
      // instead of falling back to the mod's headline version.
      const bare = n => ident(String(n).replace(/\s+v?\d+(\.\d+)*\s*$/i, ''));
      const isMain = f => String(f.category || '').toUpperCase() === 'MAIN';
      // A mod often publishes several current files whose names share a base —
      // TextureReplacer ships MAIN "TextureReplacer 1.6.7" alongside a
      // MISCELLANEOUS "TextureReplacer 1.6.7 Newrender Version". Prefer MAIN so
      // a variant never decides the version.
      const matches = files.filter(f => ident(f.name) === ident(mod.name))
        .concat(files.filter(f => bare(f.name) === bare(mod.name)));
      const hit = matches.find(isMain) || matches[0];
      return {
        version: String(hit?.version || node.version || ''),
        modId: Number(node.modId),
        modName: node.name,
      };
    };

    const updates = {}, latest = {};
    for (const mod of installedMods) {
      if (!mod?.version || !mod?.nexusId) continue;   // nothing to compare, or not from Nexus
      const pub = publishedFor(mod);
      if (!pub?.version) continue;
      latest[mod.id] = pub.version;
      if (this._isNewer(pub.version, mod.version)) {
        updates[mod.id] = { name: mod.name, installed: mod.version, latest: pub.version, modId: pub.modId, modName: pub.modName };
      }
    }

    // The manager itself is a mod for the same game, so the same answer covers it.
    let app = null;
    const appNode = byId.get(APP_MOD_ID);
    if (appVersion && appNode?.version && this._isNewer(appNode.version, appVersion)) {
      app = { installed: appVersion, latest: String(appNode.version), modId: APP_MOD_ID, name: appNode.name };
    }

    // Reported in Settings so a check that finds nothing can be told apart from
    // a check that never ran. Silent failure was the reason this took so long to
    // diagnose the first time.
    const diagnostics = {
      installed: installedMods.length,
      withId: ids.filter(id => id !== APP_MOD_ID).length,
      answered: byId.size,
      withFiles: fileLists.size,
      updates: Object.keys(updates).length,
    };
    this._session = { updates, latest, app, diagnostics, checkedAt: Date.now() };
    return this._session;
  }
}

module.exports = new UpdateCheck();
module.exports.UpdateCheck = UpdateCheck;
module.exports.GAME_DOMAIN = GAME_DOMAIN;
