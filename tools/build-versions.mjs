#!/usr/bin/env node
/**
 * Build versions.json — the static version list the Mod Manager reads.
 *
 * Runs in CI, never on a user's machine. The API key stays in a repository
 * secret and is never distributed: users only ever fetch the JSON this writes.
 *
 *   NEXUS_API_KEY=xxxx node tools/build-versions.mjs
 *
 * Request budget: one call to updated.json, plus one files.json per mod that
 * actually changed. A quiet day costs 1-2 requests; the first run costs one per
 * tracked mod. The daily allowance is 20,000.
 */

import fs from 'node:fs';
import path from 'node:path';

const API = 'https://api.nexusmods.com/v1';
const GAME = 'tcgcardshopsimulator';
const OUT = 'versions.json';
const TRACKED = JSON.parse(fs.readFileSync(new URL('./tracked-mods.json', import.meta.url), 'utf8'));

const KEY = process.env.NEXUS_API_KEY;
if (!KEY) { console.error('NEXUS_API_KEY is not set'); process.exit(1); }

const HEADERS = {
  apikey: KEY,
  'Application-Name': 'Real TCG Overhaul Mod Manager',
  'Application-Version': process.env.APP_VERSION || '2.0.0',
  'User-Agent': 'RealTCGOverhaulModManager/versions-job (+https://www.nexusmods.com/tcgcardshopsimulator/mods/974)',
  Accept: 'application/json',
};

let requests = 0;
async function api(pathname) {
  const res = await fetch(`${API}${pathname}`, { headers: HEADERS });
  requests++;
  // Rate limit headers are authoritative; the published numbers have changed
  // before, so stop on what the server actually reports rather than a constant.
  const dailyLeft = Number(res.headers.get('x-rl-daily-remaining'));
  if (Number.isFinite(dailyLeft) && dailyLeft < 50) {
    throw new Error(`Stopping: only ${dailyLeft} daily requests left`);
  }
  if (res.status === 429) throw new Error('Rate limited (429) — stopping');
  if (!res.ok) throw new Error(`${pathname} -> HTTP ${res.status}`);
  return res.json();
}

/** Files that represent something a user can have installed. */
const INSTALLABLE = new Set(['MAIN', 'OPTION', 'OPTIONAL', 'PATCH']);

async function filesFor(modId) {
  const data = await api(`/games/${GAME}/mods/${modId}/files.json`);
  return (data.files || [])
    // OLD_VERSION and DELETED entries are still listed; including them would
    // report a superseded upload as the newest available.
    .filter(f => INSTALLABLE.has(String(f.category_name || '').toUpperCase()))
    .filter(f => f.name && f.version)
    .map(f => ({ name: f.name, version: String(f.version), file_id: f.file_id, uploaded: f.uploaded_timestamp }));
}

async function main() {
  const previous = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { mods: {} };
  const out = { generated: new Date().toISOString(), game: GAME, mods: {} };

  // Which mods changed recently? One request covers the whole game.
  let changed = new Set();
  try {
    const period = process.env.FULL_REFRESH === '1' ? '1m' : '1w';
    for (const m of await api(`/games/${GAME}/mods/updated.json?period=${period}`)) changed.add(m.mod_id);
    console.log(`${changed.size} mods changed in the last ${period}`);
  } catch (err) {
    console.warn('updated.json failed, refreshing everything:', err.message);
    changed = new Set(TRACKED.map(m => m.id));
  }

  for (const mod of TRACKED) {
    const prev = previous.mods?.[mod.id];
    // Unchanged mods keep whatever was published last time — no request at all.
    if (prev && !changed.has(mod.id) && process.env.FULL_REFRESH !== '1') {
      out.mods[mod.id] = prev;
      continue;
    }
    try {
      const info = await api(`/games/${GAME}/mods/${mod.id}.json`);
      const files = await filesFor(mod.id);
      out.mods[mod.id] = {
        name: info.name || mod.name,
        version: String(info.version || ''),
        updated: info.updated_timestamp,
        files,
      };
      console.log(`  ${mod.id} ${info.name} v${info.version} (${files.length} files)`);
    } catch (err) {
      console.warn(`  ${mod.id} ${mod.name}: ${err.message}`);
      // Never drop a mod because one request failed — keep the last good data.
      if (prev) out.mods[mod.id] = prev;
      if (/Rate limited|daily requests left/.test(err.message)) break;
    }
  }

  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
  console.log(`\nwrote ${OUT}: ${Object.keys(out.mods).length} mods, ${requests} API requests used`);
}

main().catch(err => { console.error(err); process.exit(1); });
