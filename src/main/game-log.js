/**
 * Reads BepInEx's LogOutput.log and turns it into something the Game Log page
 * can show: every line with its level and source, warnings and errors matched
 * to the installed mod they came from, and a short summary.
 *
 * BepInEx 5 writes one line per entry:
 *   [Info   :   BepInEx] Loading [Collection Tracker 3.0.7]
 *   [Warning:Enhanced Prefab Loader] Field name 'Common' already exists...
 *   [Error  : Unity Log] NullReferenceException: Object reference not set...
 * followed, for exceptions, by stack-trace lines that carry no prefix. Those
 * are attached to the entry above them.
 */
const fs = require('fs');
const path = require('path');

// Only the end of a long log matters; a session that ran for hours can write
// tens of megabytes, and the page shows the most recent run anyway.
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_ENTRIES = 6000;

const LINE = /^\[(Fatal|Error|Warning|Message|Info|Debug)\s*:\s*([^\]]*?)\s*\]\s?(.*)$/;

const ident = v => String(v || '').toLowerCase().replace(/\s*[([][^()[\]]*[)\]]\s*/g, ' ').replace(/[^a-z0-9]/g, '');

let cache = { key: '', result: null };

function logPathFor(gamePath) {
  return gamePath ? path.join(gamePath, 'BepInEx', 'LogOutput.log') : null;
}

function readTail(file) {
  const st = fs.statSync(file);
  const start = Math.max(0, st.size - MAX_BYTES);
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(st.size - start);
    fs.readSync(fd, buf, 0, buf.length, start);
    let text = buf.toString('utf8');
    // Starting mid-file lands mid-line; drop the partial first line.
    if (start > 0) text = text.slice(text.indexOf('\n') + 1);
    return { text, st, truncated: start > 0 };
  } finally { fs.closeSync(fd); }
}

/**
 * Match a log source (a plugin's name, or "Unity Log" with a stack trace) to an
 * installed mod. Plugin names usually equal the mod's name; for Unity Log
 * errors the first stack frame's namespace ("at CollectionTracker.UI...") is
 * the best clue. Returns the mod or null.
 */
function matchMod(source, detail, mods) {
  const keyed = mods.map(m => ({ m, k: ident(m.name) })).filter(x => x.k.length >= 4);
  const tryKey = key => {
    if (!key || key.length < 4) return null;
    return (keyed.find(x => x.k === key)
      || keyed.find(x => key.startsWith(x.k) || x.k.startsWith(key)))?.m || null;
  };
  const generic = /^(unity log|bepinex|harmonyx?|preloader|console)$/i.test(String(source || '').trim());
  if (!generic) {
    const hit = tryKey(ident(source));
    if (hit) return hit;
  }
  const frame = /\bat\s+([A-Za-z_][\w]*)\./.exec(detail || '');
  if (frame) return tryKey(ident(frame[1]));
  return null;
}

function readGameLog(gamePath, mods = []) {
  const file = logPathFor(gamePath);
  if (!file || !fs.existsSync(file)) return { exists: false, path: file };

  let tail;
  try { tail = readTail(file); }
  catch (e) { return { exists: true, path: file, error: e.code || e.message }; }

  const key = `${file}|${tail.st.size}|${tail.st.mtimeMs}|${mods.length}`;
  if (cache.key === key) return cache.result;

  const entries = [];
  let bepinexVersion = null, unityVersion = null;
  const plugins = [];
  for (const raw of tail.text.split(/\r?\n/)) {
    if (!raw) continue;
    const m = LINE.exec(raw);
    if (!m) {
      // Continuation of the previous entry (stack trace, multi-line message).
      const last = entries[entries.length - 1];
      if (last) last.detail = last.detail ? `${last.detail}\n${raw}` : raw;
      continue;
    }
    const [, level, source, message] = m;
    if (!bepinexVersion) { const v = /^BepInEx\s+(\d+(?:\.\d+)+)/.exec(message); if (v) bepinexVersion = v[1]; }
    if (!unityVersion) { const u = /Unity v?(\d+(?:\.\d+)+)/.exec(message); if (u && /running under/i.test(message)) unityVersion = u[1]; }
    const load = /^Loading \[(.+?)\s+(\d[\w.\-]*)\]$/.exec(message);
    if (load && /bepinex/i.test(source)) plugins.push({ name: load[1], version: load[2] });
    entries.push({ level, source: source.trim(), message, detail: '' });
  }
  const kept = entries.length > MAX_ENTRIES ? entries.slice(-MAX_ENTRIES) : entries;

  const problems = [];
  const bySource = new Map();
  kept.forEach((e, i) => {
    e.index = i;
    if (e.level !== 'Error' && e.level !== 'Fatal' && e.level !== 'Warning') return;
    const mod = matchMod(e.source, e.detail, mods);
    e.modId = mod ? mod.id : null;
    e.modName = mod ? mod.name : null;
    e.label = mod ? mod.name : e.source;
    problems.push(e);
    const k = e.label;
    if (!bySource.has(k)) bySource.set(k, { label: k, modId: e.modId, errors: 0, warnings: 0 });
    const g = bySource.get(k);
    if (e.level === 'Warning') g.warnings++; else g.errors++;
  });

  const result = {
    exists: true,
    path: file,
    modifiedAt: tail.st.mtimeMs,
    truncated: tail.truncated,
    bepinexVersion, unityVersion,
    pluginCount: plugins.length,
    plugins,
    counts: {
      errors: problems.filter(e => e.level !== 'Warning').length,
      warnings: problems.filter(e => e.level === 'Warning').length,
      lines: kept.length,
    },
    sources: [...bySource.values()].sort((a, b) => (b.errors - a.errors) || (b.warnings - a.warnings) || a.label.localeCompare(b.label)),
    entries: kept,
  };
  cache = { key, result };
  return result;
}

module.exports = { readGameLog, logPathFor };
