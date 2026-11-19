/**
 * EPL .json Editor — backend.
 *
 * Enhanced Prefab Loader packs keep their definitions in .json files inside
 * folders whose names end in "_prefabloader" (for example
 * BepInEx/plugins/Real TCG Overhaul/Base Expansions/Base_prefabloader/
 * basesetexpansion.json). This module finds those files, reads them, saves
 * edits, and keeps the original of every file the first time it is edited so
 * a single click can put it back.
 *
 * Backups live in the manager's own data folder, not next to the file, so the
 * game and EPL never see them, and uninstalling or updating a mod cannot leave
 * stray copies in the game folder.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_DEPTH = 9;            // how deep under BepInEx to look for _prefabloader folders
const MAX_FILES = 2000;         // safety cap for very large installs
const SKIP_DIRS = new Set(['cache', 'core', 'patchers', 'config', 'unity-libs', 'interop', 'unhollowed']);

const sha1 = buf => crypto.createHash('sha1').update(buf).digest('hex');
const isPrefabLoaderDir = name => /_prefabloader$/i.test(name);

class EplJson {
  constructor() {
    this.backupRoot = null;     // set by init() once Electron's app paths are known
  }

  init(userDataDir) {
    this.backupRoot = path.join(userDataDir, 'epl-json-backups');
  }

  // ── Paths and safety ──────────────────────────────────────────────────────

  /**
   * Only .json files inside a *_prefabloader folder inside the game folder may
   * be read, written or restored. Everything the renderer sends is checked
   * here, so a bad path can never touch anything else on disk.
   */
  _check(gamePath, file) {
    if (!gamePath) throw new Error('The game folder is not set.');
    const root = path.resolve(gamePath);
    const abs = path.resolve(file || '');
    const rel = path.relative(root, abs);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('That file is not inside the game folder.');
    if (!/\.json$/i.test(abs)) throw new Error('Only .json files can be edited here.');
    const parts = rel.split(/[\\/]/).slice(0, -1);
    if (!parts.some(isPrefabLoaderDir)) throw new Error('That file is not inside a _prefabloader folder.');
    return { abs, rel: rel.replace(/\\/g, '/') };
  }

  _backupPaths(rel) {
    const id = sha1(rel.toLowerCase()).slice(0, 16);
    const dir = path.join(this.backupRoot, id);
    return { dir, file: path.join(dir, 'original.json'), meta: path.join(dir, 'meta.json') };
  }

  _readMeta(rel) {
    try { return JSON.parse(fs.readFileSync(this._backupPaths(rel).meta, 'utf8')); } catch { return null; }
  }

  /**
   * Backup state for one file:
   *  'none'     never edited here
   *  'edited'   edited here and unchanged since (Restore puts the original back)
   *  'replaced' the file changed after our last save — a mod update replaced
   *             it — so the stored original is out of date and is dropped
   */
  _backupState(abs, rel) {
    const meta = this._readMeta(rel);
    if (!meta) return 'none';
    try {
      const cur = sha1(fs.readFileSync(abs));
      if (cur === meta.savedHash) return 'edited';
      if (cur === meta.originalHash) return 'none';   // restored by hand, or never really changed
      return 'replaced';
    } catch { return 'none'; }
  }

  _dropBackup(rel) {
    try { fs.rmSync(this._backupPaths(rel).dir, { recursive: true, force: true }); } catch { /* nothing to drop */ }
  }

  // ── Parsing ───────────────────────────────────────────────────────────────

  /**
   * JSON.parse, with a fallback for what EPL's reader (Newtonsoft) tolerates
   * and plain JSON does not: a UTF-8 BOM, // and block comments, and trailing
   * commas. The fallback only removes those, outside of strings.
   */
  _parse(text) {
    const src = String(text).replace(/^﻿/, '');
    try { return JSON.parse(src); } catch (first) {
      let out = '', i = 0, inStr = false;
      while (i < src.length) {
        const c = src[i], n = src[i + 1];
        if (inStr) {
          out += c;
          if (c === '\\') { out += n || ''; i += 2; continue; }
          if (c === '"') inStr = false;
          i++; continue;
        }
        if (c === '"') { inStr = true; out += c; i++; continue; }
        if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
        if (c === '/' && n === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
        out += c; i++;
      }
      out = out.replace(/,(\s*[}\]])/g, '$1');
      try { return JSON.parse(out); } catch { throw first; }
    }
  }

  // ── Scan ──────────────────────────────────────────────────────────────────

  scan(gamePath) {
    if (!gamePath) return { success: false, error: 'The game folder is not set.', files: [] };
    const root = path.join(gamePath, 'BepInEx');
    if (!fs.existsSync(root)) return { success: true, files: [] };
    const files = [];

    const collectJson = (dir, depth) => {
      let entries = [];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        if (files.length >= MAX_FILES) return;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (depth < 3) collectJson(p, depth + 1); continue; }
        if (!/\.json$/i.test(e.name)) continue;
        files.push(this._describe(gamePath, p));
      }
    };
    const walk = (dir, depth) => {
      if (depth > MAX_DEPTH || files.length >= MAX_FILES) return;
      let entries = [];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        if (depth === 0 && SKIP_DIRS.has(e.name.toLowerCase())) continue;
        const p = path.join(dir, e.name);
        if (isPrefabLoaderDir(e.name)) collectJson(p, 0);
        else walk(p, depth + 1);
      }
    };
    walk(root, 0);
    files.sort((a, b) => a.group.localeCompare(b.group) || a.fileName.localeCompare(b.fileName));
    return { success: true, files };
  }

  /** One row for the file list: where it is, what it holds, whether it was edited. */
  _describe(gamePath, abs) {
    const rel = path.relative(gamePath, abs).replace(/\\/g, '/');
    const parts = rel.split('/');
    const loaderIdx = parts.findIndex(isPrefabLoaderDir);
    // The folder above the _prefabloader folder is usually the mod's own folder
    // ("Base Expansions"); fall back to the loader folder itself.
    const group = (loaderIdx > 0 ? parts[loaderIdx - 1] : parts[loaderIdx]) || 'Other';
    const row = {
      path: abs, rel, group, loaderFolder: parts[loaderIdx] || '', fileName: parts[parts.length - 1],
      name: '', bundleId: '', modifiedAt: 0, counts: { items: 0, prefabs: 0, expansions: 0, cards: 0, shops: 0 }, error: null,
      backup: this._backupState(abs, rel),
    };
    try {
      const st = fs.statSync(abs);
      row.modifiedAt = st.mtimeMs;
      if (st.size > 50 * 1024 * 1024) { row.error = 'File is too large to edit here.'; return row; }
      const data = this._parse(fs.readFileSync(abs, 'utf8'));
      row.name = typeof data?.Name === 'string' ? data.Name : '';
      row.bundleId = typeof data?.BundleId === 'string' ? data.BundleId : '';
      const len = k => (Array.isArray(data?.[k]) ? data[k].length : 0);
      row.counts.items = len('Items');
      row.counts.prefabs = len('Prefabs');
      row.counts.expansions = len('CardExpansions');
      row.counts.shops = len('CustomShops');
      row.counts.cards = (Array.isArray(data?.CardExpansions) ? data.CardExpansions : [])
        .reduce((n, x) => n + (Array.isArray(x?.Cards) ? x.Cards.length : 0), 0);
    } catch (e) { row.error = `Could not read this file: ${e.message}`; }
    return row;
  }

  // ── Read / save / restore ─────────────────────────────────────────────────

  read(gamePath, file) {
    try {
      const { abs, rel } = this._check(gamePath, file);
      const data = this._parse(fs.readFileSync(abs, 'utf8'));
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('This file does not hold an EPL definition.');
      return { success: true, data, info: this._describe(gamePath, abs), rel };
    } catch (e) { return { success: false, error: e.message }; }
  }

  /**
   * Write the edited definition. The first save of a file stores the file as
   * it was on disk as the original; later saves keep that original, so Restore
   * always goes back to what the mod shipped, not to the previous edit. If the
   * file was replaced since (a mod update), the stale original is replaced by
   * the new file before saving.
   */
  save(gamePath, file, data) {
    try {
      const { abs, rel } = this._check(gamePath, file);
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Nothing valid to save.');
      const current = fs.readFileSync(abs);
      const state = this._backupState(abs, rel);
      const bp = this._backupPaths(rel);
      let meta = this._readMeta(rel);
      if (state !== 'edited') {
        fs.mkdirSync(bp.dir, { recursive: true });
        fs.writeFileSync(bp.file, current);
        meta = { rel, originalHash: sha1(current), backedUpAt: new Date().toISOString() };
      }
      // Four-space indent, like EPL's own files. Values keep their JSON types,
      // so numbers stay numbers and true/false stay booleans.
      const out = Buffer.from(JSON.stringify(data, null, 4) + '\n', 'utf8');
      const tmp = `${abs}.mm-tmp`;
      fs.writeFileSync(tmp, out);
      fs.renameSync(tmp, abs);
      meta.savedHash = sha1(out);
      meta.savedAt = new Date().toISOString();
      fs.writeFileSync(bp.meta, JSON.stringify(meta, null, 2));
      return { success: true, info: this._describe(gamePath, abs), backupCreated: state !== 'edited' };
    } catch (e) {
      try { fs.rmSync(`${path.resolve(file || '')}.mm-tmp`, { force: true }); } catch {}
      return { success: false, error: e.message };
    }
  }

  restore(gamePath, file) {
    try {
      const { abs, rel } = this._check(gamePath, file);
      const bp = this._backupPaths(rel);
      if (!fs.existsSync(bp.file)) throw new Error('There is no original saved for this file.');
      if (this._backupState(abs, rel) === 'replaced') {
        this._dropBackup(rel);
        throw new Error('This file was replaced by a mod update after it was edited, so it already is a fresh original.');
      }
      const tmp = `${abs}.mm-tmp`;
      fs.copyFileSync(bp.file, tmp);
      fs.renameSync(tmp, abs);
      this._dropBackup(rel);
      return { success: true, info: this._describe(gamePath, abs) };
    } catch (e) { return { success: false, error: e.message }; }
  }
}

module.exports = new EplJson();
