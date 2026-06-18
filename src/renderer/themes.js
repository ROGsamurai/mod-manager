// 10 themes: 5 dark, 5 light
export const THEMES = [
  // ── DARK THEMES ──
  {
    id: 'midnight', name: 'Midnight', group: 'dark',
    vars: {
      '--bg-deep':'#111','--bg-base':'#181818','--bg-surface':'#1e1e1e','--bg-elevated':'#272727',
      '--bg-hover':'#333','--bg-active':'#3a3a3a',
      '--accent':'#da9b3c','--accent-dim':'#b07830','--accent-glow':'rgba(218,155,60,.25)',
      '--green':'#3d8c35','--green-bright':'#5cb950','--red':'#8b2020','--red-bright':'#c0392b',
      '--text':'#f0f0f0','--text-2':'#cccccc','--text-3':'#999999','--text-4':'#707070',
      '--border':'#2e2e2e','--border-2':'#3e3e3e',
      '--scrollbar':'#444','--scrollbar-hover':'#666',
    }
  },
  {
    id: 'cyberpunk', name: 'Cyberpunk', group: 'dark',
    vars: {
      '--bg-deep':'#0a0a14','--bg-base':'#12121e','--bg-surface':'#1a1a2e','--bg-elevated':'#22223a',
      '--bg-hover':'#2e2e4a','--bg-active':'#363658',
      '--accent':'#e040fb','--accent-dim':'#ab47bc','--accent-glow':'rgba(224,64,251,.25)',
      '--green':'#00e676','--green-bright':'#69f0ae','--red':'#8b2020','--red-bright':'#ff1744',
      '--text':'#eeeeff','--text-2':'#c0c0dd','--text-3':'#8888aa','--text-4':'#606080',
      '--border':'#2a2a44','--border-2':'#3a3a55',
      '--scrollbar':'#3a3a55','--scrollbar-hover':'#5a5a77',
    }
  },
  {
    id: 'forest', name: 'Forest', group: 'dark',
    vars: {
      '--bg-deep':'#0c1a0c','--bg-base':'#142014','--bg-surface':'#1a2a1a','--bg-elevated':'#233223',
      '--bg-hover':'#2e422e','--bg-active':'#385038',
      '--accent':'#66bb6a','--accent-dim':'#43a047','--accent-glow':'rgba(102,187,106,.25)',
      '--green':'#4caf50','--green-bright':'#81c784','--red':'#8b2020','--red-bright':'#c0392b',
      '--text':'#e8f5e9','--text-2':'#c8e6c9','--text-3':'#81a882','--text-4':'#5a7a5b',
      '--border':'#2a3d2a','--border-2':'#3a4e3a',
      '--scrollbar':'#3a4e3a','--scrollbar-hover':'#5a705a',
    }
  },
  {
    id: 'ocean', name: 'Ocean', group: 'dark',
    vars: {
      '--bg-deep':'#0a1520','--bg-base':'#101d2a','--bg-surface':'#162535','--bg-elevated':'#1e3040',
      '--bg-hover':'#283e50','--bg-active':'#304a5e',
      '--accent':'#29b6f6','--accent-dim':'#0288d1','--accent-glow':'rgba(41,182,246,.25)',
      '--green':'#3d8c35','--green-bright':'#5cb950','--red':'#8b2020','--red-bright':'#c0392b',
      '--text':'#e0f0ff','--text-2':'#b0d0ee','--text-3':'#7099bb','--text-4':'#4a7090',
      '--border':'#1e3348','--border-2':'#2a4058',
      '--scrollbar':'#2a4058','--scrollbar-hover':'#3a5a78',
    }
  },
  {
    id: 'crimson', name: 'Crimson', group: 'dark',
    vars: {
      '--bg-deep':'#140a0a','--bg-base':'#1e1212','--bg-surface':'#281a1a','--bg-elevated':'#332222',
      '--bg-hover':'#442e2e','--bg-active':'#503838',
      '--accent':'#ef5350','--accent-dim':'#c62828','--accent-glow':'rgba(239,83,80,.25)',
      '--green':'#3d8c35','--green-bright':'#5cb950','--red':'#b71c1c','--red-bright':'#e53935',
      '--text':'#fce4ec','--text-2':'#e0b0b8','--text-3':'#a07078','--text-4':'#705058',
      '--border':'#3a2020','--border-2':'#4a3030',
      '--scrollbar':'#4a3030','--scrollbar-hover':'#6a4a4a',
    }
  },

  // ── LIGHT THEMES ──
  {
    id: 'clean', name: 'Clean', group: 'light',
    vars: {
      '--bg-deep':'#f5f5f5','--bg-base':'#ffffff','--bg-surface':'#fafafa','--bg-elevated':'#ffffff',
      '--bg-hover':'#eaeaea','--bg-active':'#e0e0e0',
      '--accent':'#1976d2','--accent-dim':'#1565c0','--accent-glow':'rgba(25,118,210,.15)',
      '--green':'#2e7d32','--green-bright':'#43a047','--red':'#c62828','--red-bright':'#e53935',
      '--text':'#1a1a1a','--text-2':'#333333','--text-3':'#777777','--text-4':'#aaaaaa',
      '--border':'#e0e0e0','--border-2':'#cccccc',
      '--scrollbar':'#ccc','--scrollbar-hover':'#aaa',
    }
  },
  {
    id: 'cream', name: 'Cream', group: 'light',
    vars: {
      '--bg-deep':'#f5f0e8','--bg-base':'#fdf8f0','--bg-surface':'#faf5ec','--bg-elevated':'#fff8ee',
      '--bg-hover':'#efe8d8','--bg-active':'#e5dcc8',
      '--accent':'#8d6e3f','--accent-dim':'#6d5530','--accent-glow':'rgba(141,110,63,.15)',
      '--green':'#558b2f','--green-bright':'#7cb342','--red':'#bf360c','--red-bright':'#e64a19',
      '--text':'#3e2c1a','--text-2':'#5a4530','--text-3':'#8a7560','--text-4':'#b0a090',
      '--border':'#e0d5c5','--border-2':'#ccc0aa',
      '--scrollbar':'#ccc0aa','--scrollbar-hover':'#aa9880',
    }
  },
  {
    id: 'lavender', name: 'Lavender', group: 'light',
    vars: {
      '--bg-deep':'#f0edf8','--bg-base':'#f8f5ff','--bg-surface':'#f4f0fc','--bg-elevated':'#faf7ff',
      '--bg-hover':'#e8e0f5','--bg-active':'#ddd5ee',
      '--accent':'#7e57c2','--accent-dim':'#5e35b1','--accent-glow':'rgba(126,87,194,.15)',
      '--green':'#2e7d32','--green-bright':'#43a047','--red':'#c62828','--red-bright':'#e53935',
      '--text':'#1a1030','--text-2':'#3a2a50','--text-3':'#7a6a90','--text-4':'#a8a0b8',
      '--border':'#ddd5ee','--border-2':'#c8bedd',
      '--scrollbar':'#c8bedd','--scrollbar-hover':'#a89abb',
    }
  },
  {
    id: 'mint', name: 'Mint', group: 'light',
    vars: {
      '--bg-deep':'#ecf5f0','--bg-base':'#f5fdf8','--bg-surface':'#f0faf5','--bg-elevated':'#f8fff8',
      '--bg-hover':'#ddf0e5','--bg-active':'#cce8d8',
      '--accent':'#00897b','--accent-dim':'#00695c','--accent-glow':'rgba(0,137,123,.15)',
      '--green':'#2e7d32','--green-bright':'#43a047','--red':'#c62828','--red-bright':'#e53935',
      '--text':'#1a2e22','--text-2':'#304a38','--text-3':'#6a8a72','--text-4':'#99b8a2',
      '--border':'#c8e0d0','--border-2':'#aacebb',
      '--scrollbar':'#aacebb','--scrollbar-hover':'#88b49a',
    }
  },
  {
    id: 'sunrise', name: 'Sunrise', group: 'light',
    vars: {
      '--bg-deep':'#f8f0e8','--bg-base':'#fff8f0','--bg-surface':'#fdf5ec','--bg-elevated':'#fff5e8',
      '--bg-hover':'#f0e0d0','--bg-active':'#e8d4c0',
      '--accent':'#e65100','--accent-dim':'#bf360c','--accent-glow':'rgba(230,81,0,.15)',
      '--green':'#2e7d32','--green-bright':'#43a047','--red':'#c62828','--red-bright':'#e53935',
      '--text':'#2a1a0a','--text-2':'#4a3520','--text-3':'#8a7060','--text-4':'#b0a090',
      '--border':'#e8d8c8','--border-2':'#d0c0aa',
      '--scrollbar':'#d0c0aa','--scrollbar-hover':'#b0a088',
    }
  },
];

export function applyTheme(themeId) {
  const theme = THEMES.find(t => t.id === themeId) || THEMES[0];
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme.vars)) {
    root.style.setProperty(key, value);
  }
  // Update scrollbar colors (can't use CSS vars in scrollbar pseudo-elements in all browsers)
  // We'll handle this with a style tag
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
