// ─────────────────────────────────────────────────────────────────────────────
// Themes
//
// Rule that makes the pills read the way Midnight's do:
//
//   STATUS COLOURS ARE SEMANTIC, NOT DECORATIVE.
//
// Green means enabled, red means blocked or destructive, blue means an update
// is waiting. Those never take the theme's accent, and no theme is allowed an
// accent sitting near them on the colour wheel — otherwise the "On" pill and
// the version chip end up the same colour, which is what made Forest and Ocean
// look flat while Midnight looked right.
//
// A theme's character therefore lives in its SURFACES, with the accent chosen
// to contrast against them. Where a surface hue is itself close to a status
// hue (Ocean is blue, Crimson is red), that theme overrides the clashing status
// colour instead of the accent — Ocean and Crimson use violet for "update"
// rather than blue.
//
// tools/check-theme-contrast.mjs enforces the minimum hue separation.
//
// ids are preserved so a saved theme preference keeps working.
// ─────────────────────────────────────────────────────────────────────────────

/** rgba() string from a hex colour — used for the tinted fills and glows. */
function tint(hex, alpha) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/**
 * Expand a compact spec into the full variable set.
 *
 * surfaces  deepest → highest: [deep, base, surface, elevated, hover, active]
 * texts     brightest → dimmest: [text, text-2, text-3, text-4]
 * borders   [border, border-2]
 * accent    [accent, accent-dim] — accent-dim is the hover/darker step
 * onAccent  text colour that sits ON a solid accent fill
 * status    [green, greenBright, red, redBright, info, infoBright]
 */
function buildTheme({ id, name, group, surfaces, texts, borders, accent, onAccent, status }) {
  const [deep, base, surface, elevated, hover, active] = surfaces;
  const [t1, t2, t3, t4] = texts;
  const [b1, b2] = borders;
  const [acc, accDim] = accent;
  const [green, greenBright, red, redBright, info, infoBright] = status;
  const light = group === 'light';

  // Tinted fills carry the pill colour. Too faint and every pill reads as grey
  // against a dark surface, which is what "the badges blend in" meant.
  const fill = light ? 0.17 : 0.16;
  const edge = light ? 0.42 : 0.38;

  return {
    id, name, group,
    vars: {
      '--bg-deep': deep, '--bg-base': base, '--bg-surface': surface,
      '--bg-elevated': elevated, '--bg-hover': hover, '--bg-active': active,

      '--accent': acc, '--accent-dim': accDim,
      '--accent-glow': tint(acc, 0.28), '--accent-soft': tint(acc, fill),
      '--accent-border': tint(acc, edge), '--on-accent': onAccent,

      '--green': green, '--green-bright': greenBright,
      '--green-soft': tint(greenBright, fill), '--green-border': tint(greenBright, edge),
      '--red': red, '--red-bright': redBright,
      '--red-soft': tint(redBright, fill), '--red-border': tint(redBright, edge),
      '--info': info, '--info-bright': infoBright,
      '--info-soft': tint(infoBright, fill), '--info-border': tint(infoBright, edge),

      '--text': t1, '--text-2': t2, '--text-3': t3, '--text-4': t4,
      '--border': b1, '--border-2': b2,
      '--scrollbar': b2, '--scrollbar-hover': t4,
    },
  };
}

// Shared status palettes. Only a theme whose own surface hue collides with one
// of these overrides it, and then only the colour that collides.
const DARK_STATUS   = ['#2f9c4e', '#46c46a', '#a33a32', '#e06a60', '#4a7fc1', '#6fa8e8'];
const LIGHT_STATUS  = ['#246b2a', '#1f7a33', '#9c2a22', '#b8342a', '#26538f', '#2a63aa'];
// "Update" in violet, for themes built on blue or red surfaces.
const DARK_VIOLET   = ['#2f9c4e', '#46c46a', '#a33a32', '#e06a60', '#6b5bd6', '#9b8cff'];
const LIGHT_VIOLET  = ['#246b2a', '#1f7a33', '#9c2a22', '#b8342a', '#4a37a8', '#5a46c2'];

export const THEMES = [
  // ── DARK ──────────────────────────────────────────────────────────────────
  buildTheme({
    // The reference. Neutral graphite so amber, green, red and blue all read.
    id: 'midnight', name: 'Midnight', group: 'dark',
    surfaces: ['#0e1014', '#121519', '#14181e', '#1c232c', '#222a34', '#2a3340'],
    texts: ['#e9ecf1', '#cdd5e0', '#7f8b9c', '#5b6676'],
    borders: ['#1d242c', '#262e39'],
    accent: ['#e8a33d', '#c46a1f'], onAccent: '#17120a', status: DARK_STATUS,
  }),
  buildTheme({
    // Violet-black surfaces, magenta accent — already well clear of the status trio.
    id: 'cyberpunk', name: 'Cyberpunk', group: 'dark',
    surfaces: ['#0b0a14', '#100f1c', '#141326', '#1e1b33', '#282348', '#332c58'],
    texts: ['#eceaff', '#c9c5e8', '#8983b0', '#635e85'],
    borders: ['#221f3a', '#2f2a4d'],
    accent: ['#e94ff0', '#b134bd'], onAccent: '#140a17', status: DARK_STATUS,
  }),
  buildTheme({
    // Green surfaces, so the accent moves to gold: a green accent was
    // indistinguishable from the "On" pill.
    id: 'forest', name: 'Forest', group: 'dark',
    surfaces: ['#0b1210', '#0f1a16', '#12201a', '#1b2d25', '#243a30', '#2d483c'],
    texts: ['#e7f2ec', '#c4d8cd', '#7d9489', '#5a6f66'],
    borders: ['#1b2b25', '#263a32'],
    accent: ['#d4b13c', '#9c7d1c'], onAccent: '#14120a', status: DARK_STATUS,
  }),
  buildTheme({
    // Blue surfaces: cyan accent, and "update" becomes violet so it is not
    // another blue on blue.
    id: 'ocean', name: 'Ocean', group: 'dark',
    surfaces: ['#0a121b', '#0e1926', '#111e2e', '#18293d', '#20374f', '#284460'],
    texts: ['#e6eef7', '#c3d3e4', '#7b8fa5', '#596b80'],
    borders: ['#182838', '#22364a'],
    accent: ['#35c6d8', '#17869a'], onAccent: '#06141a', status: DARK_VIOLET,
  }),
  buildTheme({
    // Red surfaces: a red accent would have been the danger colour, so the
    // accent goes complementary cyan and "update" goes violet.
    id: 'crimson', name: 'Crimson', group: 'dark',
    surfaces: ['#140d0e', '#1a1113', '#1f1518', '#2c1f22', '#39292d', '#463337'],
    texts: ['#f4eaec', '#dcc8cc', '#9c8286', '#75605f'],
    borders: ['#2c1e21', '#3a2a2e'],
    accent: ['#3fd0e8', '#1a8ba1'], onAccent: '#06161a', status: DARK_VIOLET,
  }),

  // ── LIGHT ─────────────────────────────────────────────────────────────────
  buildTheme({
    id: 'clean', name: 'Clean', group: 'light',
    surfaces: ['#eef0f3', '#f7f8fa', '#ffffff', '#f1f3f6', '#e5e8ed', '#d9dde4'],
    texts: ['#151a21', '#3b444f', '#6d7885', '#98a1ad'],
    borders: ['#e0e4ea', '#cbd2db'],
    accent: ['#b07d12', '#8a610b'], onAccent: '#ffffff', status: LIGHT_STATUS,
  }),
  buildTheme({
    id: 'cream', name: 'Cream', group: 'light',
    surfaces: ['#f3eee4', '#fbf7ef', '#fffdf8', '#f5efe3', '#eae2d2', '#ddd3bf'],
    texts: ['#1f1a12', '#463d2e', '#7c7160', '#a79c88'],
    borders: ['#e7ded0', '#d3c8b4'],
    accent: ['#a06a0f', '#7d520a'], onAccent: '#fffdf8', status: LIGHT_STATUS,
  }),
  buildTheme({
    id: 'lavender', name: 'Lavender', group: 'light',
    surfaces: ['#efecf6', '#f8f6fd', '#ffffff', '#f2eefa', '#e5def3', '#d7cdeb'],
    texts: ['#1a1428', '#3e3355', '#726788', '#9e95b0'],
    borders: ['#e3dcf0', '#cfc4e3'],
    accent: ['#7a33c9', '#5c2599'], onAccent: '#ffffff', status: LIGHT_STATUS,
  }),
  buildTheme({
    // Mint surfaces: a teal accent sat between the green and blue pills, so it
    // moves to magenta.
    id: 'mint', name: 'Mint', group: 'light',
    surfaces: ['#e9f3ee', '#f5fbf8', '#ffffff', '#eef7f2', '#dcece4', '#c9e0d5'],
    texts: ['#11241b', '#2f4a3b', '#658474', '#94ad9f'],
    borders: ['#dcebe3', '#c3dbd0'],
    accent: ['#b0338c', '#8a256c'], onAccent: '#ffffff', status: LIGHT_STATUS,
  }),
  buildTheme({
    // Warm surfaces: the orange accent was nearly the danger red, so it shifts
    // to gold and "update" goes violet to stay clear of the warm ground.
    id: 'sunrise', name: 'Sunrise', group: 'light',
    surfaces: ['#f6ece3', '#fdf6ee', '#fffaf4', '#f7ede1', '#eddccb', '#e0cab2'],
    texts: ['#241608', '#4a3520', '#84705c', '#b0a08c'],
    borders: ['#ecdccb', '#d8c4ab'],
    accent: ['#a8720c', '#855808'], onAccent: '#fffaf4', status: LIGHT_VIOLET,
  }),
];

export function applyTheme(themeId) {
  const theme = THEMES.find(t => t.id === themeId) || THEMES[0];
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme.vars)) {
    root.style.setProperty(key, value);
  }
  // Marks the document for anything that needs to know light from dark.
  root.setAttribute('data-theme-group', theme.group);

  // Scrollbar pseudo-elements don't reliably pick up custom properties, so they
  // get a generated rule instead.
  let styleEl = document.getElementById('theme-scrollbar');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'theme-scrollbar';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `
    ::-webkit-scrollbar-thumb { background: ${theme.vars['--scrollbar']} !important; }
    ::-webkit-scrollbar-thumb:hover { background: ${theme.vars['--scrollbar-hover']} !important; }
  `;
  return theme;
}
