#!/usr/bin/env node
/**
 * Print what the manager has stored for each installed mod.
 *
 *   node dump-mods.mjs
 *   node dump-mods.mjs "C:\path\to\mod-manager.json"
 *
 * The update check asks Nexus by mod id, and that id is recovered from the
 * archive filename recorded at install time. If a mod shows "id: MISSING"
 * below, the stored filename is the reason — and this prints the filename, so
 * it is obvious why.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function findStore() {
  const arg = process.argv[2];
  if (arg && fs.existsSync(arg)) return arg;

  const roots = [
    process.env.APPDATA,
    path.join(os.homedir(), 'AppData', 'Roaming'),
    path.join(os.homedir(), '.config'),
    process.cwd(),
  ].filter(Boolean);

  const found = [];
  for (const root of roots) {
    try {
      for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const candidate = path.join(root, entry.name, 'mod-manager.json');
        if (fs.existsSync(candidate)) found.push(candidate);
      }
      const direct = path.join(root, 'mod-manager.json');
      if (fs.existsSync(direct)) found.push(direct);
    } catch { /* unreadable folder, skip */ }
  }
  return found[0] || null;
}

const store = findStore();
if (!store) {
  console.log('Could not find mod-manager.json.');
  console.log('Open Settings -> System -> Open App Data Folder in the manager,');
  console.log('then run:  node dump-mods.mjs "<that folder>\\mod-manager.json"');
  process.exit(1);
}

console.log('store:', store);
const data = JSON.parse(fs.readFileSync(store, 'utf8'));
const mods = Object.values(data.installedMods || {});
console.log('migrationVersion:', data.migrationVersion);
console.log('installed mods  :', mods.length);
console.log();

let missing = 0;
for (const m of mods) {
  const id = m.nexusId ? String(m.nexusId) : 'MISSING';
  if (!m.nexusId) missing++;
  console.log(`  id: ${id.padEnd(8)} name: ${String(m.name).slice(0, 34).padEnd(36)}`);
  console.log(`      filename: ${m.filename ?? '(none recorded)'}`);
}

console.log(`\n${mods.length - missing} of ${mods.length} have a Nexus mod id.`);
if (missing) {
  console.log('For the ones missing it, look at the filename printed above: the id is');
  console.log('the number between the mod name and the version, e.g. "... 69 1.6.6 ...".');
  console.log('If the filename has no number there, that mod was installed from a');
  console.log('renamed archive and the id cannot be recovered from it.');
}
