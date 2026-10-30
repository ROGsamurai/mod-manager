import { useState } from 'react';
import { useI18n } from '../i18n';
import logoImg from '../assets/logo.png';

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
    blurb: 'Pokemon Expansions, Accessories, Figurines, Statues and Games, plus everything they depend on.',
    mods: [
      { name: 'Pokemon Expansions, Accessories, Figurines, Statues & Games', role: 'pack', id: 577,
        note: 'Download all 9 main files from the Files tab (about 3.6 GB).',
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
          'Pokemon Games',
        ] },

      { name: 'BepInEx with Configuration Manager', role: 'required', id: 1555 },
      { name: 'QOL ShopOS', role: 'required', id: 1754, note: 'Required for the Shop App.' },
      { name: 'Purchase Overhaul', role: 'required', id: 1609, note: 'Required for the Shop App.' },
      { name: 'Enhanced Prefab Loader', role: 'required', id: 496, note: 'Two builds: the plain one for Steam\'s default branch and Xbox Game Pass (New Render), (1.0classic) for Steam\'s 1.0classic beta. Either needs Enhanced Prefab Loader API.' },
      { name: 'Enhanced Prefab Loader API', role: 'required', id: 1144 },
      { name: 'TextureReplacer', role: 'required', id: 69, note: 'Required for Shop Textures. One build for every game version.' },
      { name: 'Collection Tracker', role: 'required', id: 867, note: 'Required for Promo Cards.' },

      { name: 'RTCGO Holographics', role: 'recommended', id: 1676, note: 'Holographic card foils.' },
      { name: 'Enhanced Binder', role: 'recommended', id: 1116 },
      { name: 'EPL Demand', role: 'recommended', id: 1084 },
      { name: 'CardGrade Overhaul', role: 'recommended', id: 1728 },
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
      // TextureReplacer, and Collection Tracker is required outright.
      { name: 'BepInEx with Configuration Manager', role: 'required', id: 1555 },
      { name: 'QOL ShopOS', role: 'required', id: 1754, note: 'Required for the Shop App.' },
      { name: 'Purchase Overhaul', role: 'required', id: 1609, note: 'Required for the Shop App.' },
      { name: 'Enhanced Prefab Loader', role: 'required', id: 496, note: 'Two builds: the plain one for Steam\'s default branch and Xbox Game Pass (New Render), (1.0classic) for Steam\'s 1.0classic beta. Either needs Enhanced Prefab Loader API.' },
      { name: 'Enhanced Prefab Loader API', role: 'required', id: 1144 },
      { name: 'Collection Tracker', role: 'required', id: 867 },

      { name: 'EPL Card Animator', role: 'recommended', id: 1100, note: 'Recommended for the Animated Cards.' },
      { name: 'Enhanced Binder', role: 'recommended', id: 1116 },
      { name: 'EPL Demand', role: 'recommended', id: 1084 },
      { name: 'CardGrade Overhaul', role: 'recommended', id: 1728 },
      { name: 'RTCGO Holographics', role: 'recommended', id: 1676, note: 'Holographic card foils.' },
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

  // Also index each installed name without a bracketed tag, so a variant such
  // as "EnhancedPrefabLoader (1.0classic)" counts as Enhanced Prefab Loader.
  const untag = v => String(v || '').replace(/\s*[([][^()[\]]*[)\]]\s*/g, ' ');
  const installedNames = new Set(mods.flatMap(m => [ident(m.name), ident(untag(m.name))]));
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

  // One card per bundle: banner, status, progress through its files and
  // requirements. The full list opens underneath the cards.
  const renderCard = b => {
    const expanded = open === b.id;
    // Progress counts what the pack needs — its own files and its
    // requirements. Recommended mods are optional, so they don't count as missing.
    const needed = { ...b, mods: b.mods.filter(m => m.role !== 'recommended') };
    const have = countInstalled(needed);
    const total = countTotal(needed);
    const complete = have === total;
    const status = complete ? { cls: 'pill pill-success', text: t('Complete') }
      : have === 0 ? { cls: 'pill', text: t('Not installed') }
      : { cls: 'pill pill-accent', text: `${total - have} ${t('missing')}` };
    const pct = total ? Math.round(have / total * 100) : 0;
    return (
      <article key={b.id} className={`card${expanded ? ' card-accent' : ''}`} style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div aria-hidden="true" style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'radial-gradient(120% 120% at 50% 0%, var(--accent-soft) 0%, var(--bg-elevated) 70%)', borderBottom: '1px solid var(--border)' }}>
          <img src={logoImg} alt="" style={{ height: 112, width: 112, objectFit: 'contain' }} />
        </div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
          <div><span className={status.cls}>{status.text}</span></div>
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>{b.name}</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>{b.blurb}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)' }}>
              <span>{t('Files and requirements')}</span><span className="mono">{have} / {total}</span>
            </div>
            <div className="progress"><div className="bar" style={{ width: `${pct}%`, background: complete ? 'var(--green-bright)' : 'linear-gradient(90deg, var(--info), var(--info-bright))' }} /></div>
          </div>
          <button type="button" onClick={() => setOpen(expanded ? null : b.id)} aria-expanded={expanded}
            className={`btn ${complete || expanded ? 'btn-ghost' : 'btn-accent'}`} style={{ marginTop: 'auto', justifyContent: 'center' }}>
            {expanded ? t('Hide list') : complete ? t('Show the list') : t("Show what's needed")}
          </button>
        </div>
      </article>
    );
  };

  const renderDetails = b => (
    <div className="card card-accent" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ fontSize: 15.5, fontWeight: 700 }}>{b.name}</span>
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => setOpen(null)}>{t('Close')}</button>
      </div>
      <div style={{ padding: '6px 16px 12px' }}>
        {b.mods.map((m, i) => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0',
            borderBottom: i < b.mods.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <span style={{ width: 96, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              {!entryInstalled(m) && (
                <span className={rolePill[m.role]} style={{ width: '100%', justifyContent: 'center' }}>
                  {roleLabel[m.role]}
                </span>
              )}
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
    </div>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '24px 24px 18px', flexShrink: 0 }}>
        <h1 className="page-title">{t('Getting Started')}</h1>
        <p className="page-sub">{t('Pick a pack and get everything it needs. Each mod opens on Nexus Mods in your browser.')}</p>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 24px' }}>

        {/* Bundles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {BUNDLES.map(renderCard)}
        </div>
        {open && BUNDLES.find(b => b.id === open) && (
          <div style={{ marginTop: 16 }}>{renderDetails(BUNDLES.find(b => b.id === open))}</div>
        )}


      </div>

      <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', fontSize: 12.5, color: 'var(--text-4)', flexShrink: 0 }}>
        {t('Downloads open on Nexus Mods in your browser')}
      </div>
    </div>
  );
}
