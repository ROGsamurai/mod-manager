#!/usr/bin/env node
/**
 * Theme checks. Run with: node tools/check-theme-contrast.mjs
 *
 * Two things go wrong with themes, and both are easy to miss by eye:
 *
 *   1. The accent drifts close to a status colour, so the version chip and the
 *      "On" pill end up the same colour and the UI reads as flat. Midnight sits
 *      31 degrees from its nearest status hue and looks right, so 30 is the
 *      floor and 45+ is the target.
 *   2. Pill text stops being legible against its own tinted fill on a light
 *      surface, which only shows up on the light themes.
 */

import { THEMES } from '../src/renderer/themes.js';

const hex = h => {
  const s = h.replace('#', '');
  const f = s.length === 3 ? s.split('').map(c => c + c).join('') : s;
  const n = parseInt(f, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const hue = h => {
  const [r, g, b] = hex(h).map(v => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return 0;
  let x;
  if (mx === r) x = ((g - b) / d) % 6;
  else if (mx === g) x = (b - r) / d + 2;
  else x = (r - g) / d + 4;
  return Math.round(x * 60 + 360) % 360;
};

const sep = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };

const lum = h => {
  const [r, g, b] = hex(h).map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.0722 * b + 0.7152 * g;
};
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return +((x + 0.05) / (y + 0.05)).toFixed(2);
};

const MIN_SEPARATION = 30;      // Midnight's own margin
const MIN_TEXT_CONTRAST = 3.0;  // pill text on the surface behind it

let failures = 0;
console.log('theme       accent  nearest status  separation   pill text contrast (green/red/info/accent)');

for (const t of THEMES) {
  const v = t.vars;
  const a = hue(v['--accent']);
  const statuses = {
    green: hue(v['--green-bright']),
    red: hue(v['--red-bright']),
    info: hue(v['--info-bright']),
  };
  let nearest = null, best = 999;
  for (const [name, h] of Object.entries(statuses)) {
    const d = sep(a, h);
    if (d < best) { best = d; nearest = name; }
  }

  // Pill text sits on a tint of itself over the card surface; approximate with
  // the text colour against the card surface, which is the worst case.
  const cs = v['--bg-surface'];
  const ratios = {
    green: contrast(v['--green-bright'], cs),
    red: contrast(v['--red-bright'], cs),
    info: contrast(v['--info-bright'], cs),
    accent: contrast(v['--accent'], cs),
  };

  const sepBad = best < MIN_SEPARATION;
  const textBad = Object.entries(ratios).filter(([, r]) => r < MIN_TEXT_CONTRAST);
  if (sepBad || textBad.length) failures++;

  console.log(
    t.id.padEnd(11),
    String(a).padStart(4),
    nearest.padStart(14),
    `${String(best).padStart(8)}°${sepBad ? ' FAIL' : '    '}`,
    '  ' + Object.entries(ratios).map(([k, r]) => `${k[0]}:${r}${r < MIN_TEXT_CONTRAST ? '!' : ''}`).join(' '),
  );
}

console.log(
  failures === 0
    ? `\nPASS — all ${THEMES.length} themes keep the accent at least ${MIN_SEPARATION}° from every status colour, with legible pill text.`
    : `\nFAIL — ${failures} theme(s) need attention.`,
);
process.exit(failures === 0 ? 0 : 1);
