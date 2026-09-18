// ─────────────────────────────────────────────────────────────────────────────
// Themes — v2.0
//
// A theme is now declared as a handful of values and expanded into the full
// variable set by buildTheme(). Adding a palette is a few lines rather than a
// 20-line block, and every theme automatically picks up any new token added to
// the base scale.
//
// ids are preserved from v1 so a saved theme preference keeps working.
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
  return {
    id, name, group,
    vars: {
      '--bg-deep': deep, '--bg-base': base, '--bg-surface': surface,
      '--bg-elevated': elevated, '--bg-hover': hover, '--bg-active': active,

      '--accent': acc, '--accent-dim': accDim,
      '--accent-glow': tint(acc, .25), '--accent-soft': tint(acc, group === 'light' ? .14 : .12),
      '--accent-border': tint(acc, group === 'light' ? .38 : .30), '--on-accent': onAccent,

      '--green': green, '--green-bright': greenBright,
      '--green-soft': tint(greenBright, group === 'light' ? .14 : .12), '--green-border': tint(greenBright, .30),
      '--red': red, '--red-bright': redBright,
      '--red-soft': tint(redBright, group === 'light' ? .12 : .10), '--red-border': tint(redBright, .32),
      '--info': info, '--info-bright': infoBright,
      '--info-soft': tint(infoBright, .12), '--info-border': tint(infoBright, .28),

      '--text': t1, '--text-2': t2, '--text-3': t3, '--text-4': t4,
      '--border': b1, '--border-2': b2,
      '--scrollbar': b2, '--scrollbar-hover': t4,
    },
  };
}

const DARK_STATUS = ['#2f9c4e', '#46c46a', '#a33a32', '#e06a60', '#4a7fc1', '#6fa8e8'];
const LIGHT_STATUS = ['#2e7d32', '#3aa049', '#b3342b', '#d0463c', '#2f6fb5', '#3f86d4'];

export const THEMES = [
  // ── DARK ──────────────────────────────────────────────────────────────────
  buildTheme({
    id: 'midnight', name: 'Midnight', group: 'dark',
    surfaces: ['#0e1014', '#121519', '#14181e', '#1c232c', '#222a34', '#2a3340'],
    texts: ['#e9ecf1', '#cdd5e0', '#7f8b9c', '#5b6676'],
    borders: ['#1d242c', '#262e39'],
    accent: ['#e8a33d', '#c46a1f'], onAccent: '#17120a', status: DARK_STATUS,
  }),
  buildTheme({
    id: 'cyberpunk', name: 'Cyberpunk', group: 'dark',
    surfaces: ['#0b0a14', '#100f1c', '#141326', '#1d1b33', '#262343', '#302c52'],
    texts: ['#eceaff', '#c9c5e8', '#8983b0', '#635e85'],
    borders: ['#221f3a', '#2d2a4a'],
    accent: ['#d94ff0', '#a134bd'], onAccent: '#140a17', status: ['#12a361', '#22d38a', '#a3283f', '#f0506e', '#4a6fd0', '#7b9bff'],
  }),
  buildTheme({
    id: 'forest', name: 'Forest', group: 'dark',
    surfaces: ['#0b1210', '#0f1a16', '#121f1a', '#1a2c25', '#223930', '#2a463b'],
    texts: ['#e7f2ec', '#c4d8cd', '#7d9489', '#5a6f66'],
    borders: ['#1b2b25', '#243830'],
    accent: ['#5fbf72', '#3d8f4f'], onAccent: '#0a1410', status: DARK_STATUS,
  }),
  buildTheme({
    id: 'ocean', name: 'Ocean', group: 'dark',
    surfaces: ['#0a121b', '#0e1926', '#111e2e', '#18293d', '#1f354d', '#26415d'],
    texts: ['#e6eef7', '#c3d3e4', '#7b8fa5', '#596b80'],
    borders: ['#182838', '#213448'],
    accent: ['#3fb6e8', '#1d7fac'], onAccent: '#08131b', status: DARK_STATUS,
  }),
  buildTheme({
    id: 'crimson', name: 'Crimson', group: 'dark',
    surfaces: ['#140d0e', '#1a1113', '#1f1518', '#2b1e21', '#37272b', '#443035'],
    texts: ['#f4eaec', '#dcc8cc', '#9c8286', '#75605f'],
    borders: ['#2c1e21', '#38282c'],
    accent: ['#e05263', '#b02a3c'], onAccent: '#1a0b0e', status: DARK_STATUS,
  }),

  // ── LIGHT ─────────────────────────────────────────────────────────────────
  buildTheme({
    id: 'clean', name: 'Clean', group: 'light',
    surfaces: ['#eef0f3', '#f7f8fa', '#ffffff', '#f1f3f6', '#e5e8ed', '#d9dde4'],
    texts: ['#151a21', '#3b444f', '#6d7885', '#98a1ad'],
    borders: ['#e0e4ea', '#cbd2db'],
    accent: ['#c2761b', '#9a5b12'], onAccent: '#ffffff', status: LIGHT_STATUS,
  }),
  buildTheme({
    id: 'cream', name: 'Cream', group: 'light',
    surfaces: ['#f3eee4', '#fbf7ef', '#fffdf8', '#f5efe3', '#eae2d2', '#ddd3bf'],
    texts: ['#1f1a12', '#463d2e', '#7c7160', '#a79c88'],
    borders: ['#e7ded0', '#d3c8b4'],
    accent: ['#b06c17', '#8a5210'], onAccent: '#fffdf8', status: LIGHT_STATUS,
  }),
  buildTheme({
    id: 'lavender', name: 'Lavender', group: 'light',
    surfaces: ['#efecf6', '#f8f6fd', '#ffffff', '#f2eefa', '#e5def3', '#d7cdeb'],
    texts: ['#1a1428', '#3e3355', '#726788', '#9e95b0'],
    borders: ['#e3dcf0', '#cfc4e3'],
    accent: ['#6f45c0', '#54309a'], onAccent: '#ffffff', status: LIGHT_STATUS,
  }),
  buildTheme({
    id: 'mint', name: 'Mint', group: 'light',
    surfaces: ['#e9f3ee', '#f5fbf8', '#ffffff', '#eef7f2', '#dcece4', '#c9e0d5'],
    texts: ['#11241b', '#2f4a3b', '#658474', '#94ad9f'],
    borders: ['#dcebe3', '#c3dbd0'],
    accent: ['#0d8074', '#0a615a'], onAccent: '#ffffff', status: LIGHT_STATUS,
  }),
  buildTheme({
    id: 'sunrise', name: 'Sunrise', group: 'light',
    surfaces: ['#f6ece3', '#fdf6ee', '#fffaf4', '#f7ede1', '#eddccb', '#e0cab2'],
    texts: ['#241608', '#4a3520', '#84705c', '#b0a08c'],
    borders: ['#ecdccb', '#d8c4ab'],
    accent: ['#d05a13', '#a3430c'], onAccent: '#fffaf4', status: LIGHT_STATUS,
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
