import { useState } from 'react';
import { useI18n } from '../i18n';

/**
 * Bundles: everything a themed mod pack needs, in the order it should be set up.
 *
 * `role` drives the pill on each row:
 *   pack        — the mod the bundle is about
 *   required    — will not work without it
 *   recommended — works without it, better with it
 * `note` is for conditional requirements ("required for Shop Textures").
 *
 * Adding another bundle is a new entry in this array; nothing else changes.
 */
const BUNDLES = [
  {
    id: 'pokemon',
    name: 'Pokemon Mod',
    blurb: 'Pokemon Expansions, Accessories, Figurines and Statues, plus everything they depend on.',
    mods: [
      { name: 'Pokemon Expansions, Accessories, Figurines & Statues', role: 'pack', id: 577,
        note: 'Download all 8 main files from the Files tab (about 3.5 GB).',
        // Each main file installs as its own mod, so they are counted and
        // matched individually against what is actually installed.
        files: [
          'Pokemon Expansions - Generation 1',
          'Pokemon Expansions - Generation 2',
          'Pokemon Expansions - Generation 3',
          'Pokemon Accessories',
          'Pokemon Figurines',
          'Pokemon Statues',
          'Pokemon Shop Textures',
          'Pokemon Shop App',
        ] },

      { name: 'BepInEx with Configuration Manager', role: 'required', id: 1555 },
      { name: 'Phone - Overhaul', role: 'required', id: 685 },
      { name: 'Enhanced Prefab Loader', role: 'required', id: 496 },
      { name: 'Enhanced Prefab Loader API', role: 'required', id: 1144 },
      { name: 'Holographic Overhaul', role: 'required', id: 617 },
      { name: 'TextureReplacer', role: 'required', id: 69, note: 'Required for Shop Textures.' },
      { name: 'Collection Tracker', role: 'required', id: 867, note: 'Required for Promo Cards.' },

      { name: 'Enhanced Binder', role: 'recommended', id: 1116 },
      { name: 'EPL Demand', role: 'recommended', id: 1084 },
      { name: 'Grading Overhaul', role: 'recommended', id: 612 },
      { name: 'RTCGO Custom TV', role: 'recommended', id: 895 },
    ],
  },
  {
    id: 'pokemon-pocket',
    name: 'Pokemon Pocket Mod',
    blurb: 'Pokemon Pocket expansions and shop app, plus everything they depend on.',
    mods: [
      { name: 'Pokemon Pocket Expansions', role: 'pack', id: 1175,
        note: 'Download all 7 main files from the Files tab.',
        files: [
          'Pokemon Pocket Expansions - A1 and A1a',
          'Pokemon Pocket Expansions - A2 A2a and A2b',
          'Pokemon Pocket Expansions - A3 A3a and A3b',
          'Pokemon Pocket Expansions - A4 A4a and A4b',
          'Pokemon Pocket Expansions - B1 and B1a',
          'Pokemon Pocket Expansions - B2 B2a and B2b',
          'Pokemon Pocket Shop App',
        ] },

      // Pocket's requirements differ from the main Pokemon mod: no
      // TextureReplacer, Collection Tracker is required outright, and
      // Holographic Overhaul is only recommended.
      { name: 'BepInEx with Configuration Manager', role: 'required', id: 1555 },
      { name: 'Phone - Overhaul', role: 'required', id: 685 },
      { name: 'Enhanced Prefab Loader', role: 'required', id: 496 },
      { name: 'Enhanced Prefab Loader API', role: 'required', id: 1144 },
      { name: 'Collection Tracker', role: 'required', id: 867 },

      { name: 'EPL Card Animator', role: 'recommended', id: 1100, note: 'Recommended for the Animated Cards.' },
      { name: 'Enhanced Binder', role: 'recommended', id: 1116 },
      { name: 'EPL Demand', role: 'recommended', id: 1084 },
      { name: 'Grading Overhaul', role: 'recommended', id: 612 },
      { name: 'Holographic Overhaul', role: 'recommended', id: 617 },
      { name: 'RTCGO Custom TV', role: 'recommended', id: 895 },
    ],
  },
];

const nexusUrl = id => `https://www.nexusmods.com/tcgcardshopsimulator/mods/${id}`;

/**
 * Name key for matching a listed mod against an installed one. Installed names
 * come from the archive and spell things differently — "EnhancedPrefabLoader"
 * vs "Enhanced Prefab Loader", "Phone Overhaul" vs "Phone - Overhaul" — so
 * separators and case are dropped, the same way the backend matches mod names.
 */
const ident = v => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export default function SuggestedMods({ mods = [] }) {
  const { t } = useI18n();
  // Closed by default: this is reference material, not the first thing to read.
  const [open, setOpen] = useState(null);

  const installedNames = new Set(mods.map(m => ident(m.name)));
  const isInstalled = name => installedNames.has(ident(name));
  // An entry counts as installed when its mod is; for the pack, when every one
  // of its main files is.
  const entryInstalled = m => (m.files ? m.files.every(isInstalled) : isInstalled(m.name));
  const countInstalled = b => b.mods.reduce(
    (n, m) => n + (m.files ? m.files.filter(isInstalled).length : (isInstalled(m.name) ? 1 : 0)), 0);
  const countTotal = b => b.mods.reduce((n, m) => n + (m.files ? m.files.length : 1), 0);

  const roleLabel = { pack: t('This mod'), required: t('Required'), recommended: t('Recommended') };
  // The base `pill` class carries the radius and padding; without it these were
  // just a tinted rectangle.
  const rolePill = { pack: 'pill pill-info', required: 'pill pill-accent', recommended: 'pill' };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '24px 24px 18px', flexShrink: 0 }}>
        <h1 className="page-title">{t('Getting Started')}</h1>
        <p className="page-sub">{t('Pick a pack and get everything it needs. Each mod opens on Nexus Mods in your browser.')}</p>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 24px' }}>

        {/* Bundles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {BUNDLES.map(b => {
            const expanded = open === b.id;
            const mainCount = b.mods.reduce((n, m) => n + (m.files ? m.files.length : 0), 0);
            const requiredCount = b.mods.filter(m => m.role === 'required').length;
            const recommendedCount = b.mods.filter(m => m.role === 'recommended').length;
            const installedCount = countInstalled(b);
            const totalCount = countTotal(b);
            return (
              <div key={b.id} className={`card${expanded ? ' card-accent' : ''}`} style={{ padding: 0, overflow: 'hidden' }}>
                <button type="button" onClick={() => setOpen(expanded ? null : b.id)} aria-expanded={expanded}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', width: '100%',
                    background: 'transparent', textAlign: 'left', color: 'inherit' }}>
                  <div style={{ width: 42, height: 42, flexShrink: 0, borderRadius: 11, background: 'var(--bg-elevated)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 7l8-4 8 4v10l-8 4-8-4z" /><path d="M4 7l8 4 8-4" /><path d="M12 11v10" />
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span style={{ fontSize: 15.5, fontWeight: 700 }}>{b.name}</span>
                      {/* Same colour coding as the rows below: the pack is blue,
                          required amber, recommended plain, installed green. */}
                      {mainCount > 0 && <span className="pill pill-info">{mainCount} {t('Main')}</span>}
                      <span className="pill pill-accent">{requiredCount} {t('Required')}</span>
                      {recommendedCount > 0 && <span className="pill">{recommendedCount} {t('Recommended')}</span>}
                      <span className={`pill ${installedCount > 0 ? 'pill-success' : ''}`}>
                        {installedCount} {t('Installed')}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4, lineHeight: 1.5 }}>{b.blurb}</div>
                  </div>
                  <span className="btn btn-ghost btn-sm btn-icon" style={{ flexShrink: 0, pointerEvents: 'none' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                      style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><path d="M6 9l6 6 6-6" /></svg>
                  </span>
                </button>

                {expanded && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '6px 16px 12px' }}>
                    {b.mods.map((m, i) => (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0',
                        borderBottom: i < b.mods.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <span style={{ width: 96, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <span className={rolePill[m.role]} style={{ width: '100%', justifyContent: 'center' }}>
                            {roleLabel[m.role]}
                          </span>
                          {m.files
                            ? (m.files.some(isInstalled) && (
                                <span className={`pill ${entryInstalled(m) ? 'pill-success' : 'pill-accent'}`} style={{ width: '100%', justifyContent: 'center' }}>
                                  {m.files.filter(isInstalled).length}/{m.files.length}
                                </span>
                              ))
                            : (entryInstalled(m) && (
                                <span className="pill pill-success" style={{ width: '100%', justifyContent: 'center' }}>{t('Installed')}</span>
                              ))}
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600 }}>{m.name}</span>
                          {m.note && <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text-3)', marginTop: 2 }}>{m.note}</span>}
                        </span>
                        <button className="btn btn-accent btn-sm" style={{ flexShrink: 0 }}
                          onClick={() => window.api.openUrl(nexusUrl(m.id))}>
                          {t('Get Mod')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>

      <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', fontSize: 12.5, color: 'var(--text-4)', flexShrink: 0 }}>
        {t('Downloads open on Nexus Mods in your browser')}
      </div>
    </div>
  );
}
