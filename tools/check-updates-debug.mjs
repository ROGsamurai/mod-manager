#!/usr/bin/env node
/**
 * Update-check diagnostic.
 *
 *   node tools/check-updates-debug.mjs            # uses mod 69 (TextureReplacer)
 *   node tools/check-updates-debug.mjs 69 685 974
 *
 * Runs exactly the queries the manager runs and prints the raw replies. The app
 * itself fails silently by design — no badges, no error popup — so when a mod
 * that should show an update does not, run this to see what Nexus actually says.
 *
 * Needs nothing but Node. No API key, no login.
 */

const ENDPOINT = 'https://api.nexusmods.com/v2/graphql';
const ids = process.argv.slice(2).filter(a => /^\d+$/.test(a)).map(Number);
const MOD_IDS = ids.length ? ids : [69];

async function gql(label, query, variables) {
  console.log(`\n── ${label} ──`);
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'RealTCGOverhaulModManager (+https://www.nexusmods.com/tcgcardshopsimulator/mods/974)',
    },
    body: JSON.stringify({ query, variables }),
  });
  const text = await res.text();
  console.log('HTTP', res.status);
  let body;
  try { body = JSON.parse(text); } catch {
    console.log('Body was not JSON:\n', text.slice(0, 600));
    return null;
  }
  if (body.errors?.length) {
    console.log('GraphQL errors:');
    for (const e of body.errors) console.log('  -', e.message);
  }
  return body.data || null;
}

const MODS_QUERY = `
  query InstalledMods($filter: ModsFilter, $count: Int) {
    mods(filter: $filter, count: $count) {
      nodes { modId gameId name version status updatedAt }
    }
  }`;

// The endpoint requires gameId whenever the filter includes modId, so learn it
// from a single mod first.
// The manager has 6826 baked in; this confirms it independently.
const gameData = await gql('game id (one mod, by domain name)', `
  query GameId($filter: ModsFilter) { mods(filter: $filter, count: 1) { nodes { gameId } } }`,
  { filter: { gameDomainName: [{ value: 'tcgcardshopsimulator', op: 'EQUALS' }] } });
const GAME_ID = gameData?.mods?.nodes?.[0]?.gameId;
console.log('  gameId =', GAME_ID ?? 'NOT FOUND');
if (!GAME_ID) process.exit(1);

// One alias per mod, each filter carrying a SINGLE mod id — several ids in one
// filter are ANDed by the server and match nothing.
const aliasQuery = `query InstalledMods {\n${MOD_IDS.map(id => `  m${id}: mods(filter: { gameId: [{ value: "${GAME_ID}", op: EQUALS }], modId: [{ value: "${id}", op: EQUALS }] }, count: 1) { nodes { modId gameId name version status updatedAt } }`).join('\n')}\n}`;
const aliased = await gql(`mods, one alias per id (${MOD_IDS.length} id(s))`, aliasQuery, {});
const nodes = MOD_IDS.map(id => aliased?.[`m${id}`]?.nodes?.[0]).filter(Boolean);
console.log(`  -> ${nodes.length} of ${MOD_IDS.length} answered`);

// For comparison: what the old multi-id filter does.
if (MOD_IDS.length > 1) {
  const multi = await gql('mods, all ids in ONE filter (expected to return nothing)', MODS_QUERY, {
    filter: { gameId: [{ value: String(GAME_ID), op: 'EQUALS' }], modId: MOD_IDS.map(id => ({ value: String(id), op: 'EQUALS' })) },
    count: 50,
  });
  console.log(`  -> ${(multi?.mods?.nodes || []).length} mod(s)`);
}

if (!nodes.length) {
  console.log('\nNo shape returned anything. The errors above say which field or');
  console.log('operator was rejected — paste them and the filter can be corrected.');
  process.exit(1);
}
for (const n of nodes) {
  console.log(`  ${n.modId}  ${n.name}  version=${n.version}  gameId=${n.gameId}  status=${n.status}`);
}

const withGame = nodes.filter(n => n.gameId);
if (withGame.length) {
  const fields = withGame
    .map(n => `  m${n.modId}: modFiles(modId: "${n.modId}", gameId: "${n.gameId}") { name version category }`)
    .join('\n');
  const files = await gql('modFiles, all mods in one request', `query InstalledModFiles {\n${fields}\n}`, {});
  for (const n of withGame) {
    const rows = files?.[`m${n.modId}`] || [];
    // Old and archived uploads are the bulk of a long-lived mod's file list and
    // the manager ignores them, so only what it actually considers is printed.
    const IGNORED = new Set(['OLD_VERSION', 'ARCHIVED', 'DELETED', 'REMOVED']);
    const current = rows.filter(f => !IGNORED.has(String(f.category).toUpperCase()));
    console.log(`  mod ${n.modId}: ${current.length} current file(s), ${rows.length - current.length} old/archived ignored`);
    for (const f of current) console.log(`      ${String(f.category).padEnd(14)} ${String(f.version).padEnd(10)} ${f.name}`);
  }
}

console.log('\nWhat the manager compares:');
console.log('  installed version  vs  the file whose name matches the installed mod');
console.log('  (a trailing version in the file name is ignored when matching)');
console.log('  falling back to the mod version above when no file name matches.');
