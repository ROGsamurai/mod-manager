import { useState, useEffect } from 'react';
import { useI18n } from '../i18n';

/**
 * Home: one look at whether the game is ready to play, and what needs doing.
 * Everything here comes from data the manager already has — the BepInEx
 * status, the update check, the dependency and conflict checks, Staged.
 */
export default function Home({ mods, staged, updates = {}, conflicts = [], bepinex = {}, logSummary, onLaunch, onAdd, onNav }) {
  const { t } = useI18n();
  const [depWarnings, setDepWarnings] = useState([]);
  useEffect(() => { window.api.checkDependencies().then(r => setDepWarnings(r || [])).catch(() => setDepWarnings([])); }, [mods]);

  const enabled = mods.filter(m => m.enabled).length;
  const updateList = Object.entries(updates)
    .map(([id, u]) => ({ id, u, mod: mods.find(m => m.id === id) }))
    .filter(x => x.mod);
  // Count mods with a problem, not individual warnings: one mod missing two
  // dependencies, or clashing over ten files, is one thing to look at.
  const problemMods = new Set(depWarnings.map(w => w.modId));
  conflicts.forEach(c => (c.mods || []).forEach(m => problemMods.add(m.modId)));
  const problems = problemMods.size;
  const gameOk = bepinex.gameFound !== false;

  let title = t('Ready to play');
  let sub = t('The game folder, BepInEx and every installed mod check out.');
  let tone = 'ok';
  if (!gameOk) {
    title = t('Game not detected'); tone = 'bad';
    sub = t('Set the game location in Settings before installing or playing.');
  } else if (!bepinex.installed) {
    title = t('BepInEx is not installed'); tone = 'bad';
    sub = t('Install Pre-configured BepInEx from the Getting Started tab. Mods will not load without it.');
  } else if (problems > 0) {
    title = `${problems} ${problems === 1 ? t('thing to check') : t('things to check')}`; tone = 'warn';
    sub = t('The game will start, but some mods may not work until these are fixed.');
  }

  const chip = tone === 'ok' ? 'pill pill-success' : tone === 'warn' ? 'pill pill-accent' : 'pill pill-danger';
  const chipText = tone === 'ok' ? t('Ready to play') : tone === 'warn' ? t('Check before playing') : t('Not ready');

  const Tile = ({ n, label, color, onClick }) => (
    <button type="button" onClick={onClick} className="card card-hover"
      style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, cursor: onClick ? 'pointer' : 'default', textAlign: 'left', color: 'inherit', font: 'inherit' }}>
      <span style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.1, color: color || 'var(--text)' }}>{n}</span>
      <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{label}</span>
    </button>
  );

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <section style={{
        borderRadius: 18, border: '1px solid var(--border-2)', padding: '32px 36px',
        background: 'radial-gradient(120% 140% at 85% 0%, var(--accent-soft) 0%, var(--bg-surface) 55%)',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className="pill pill-accent mono" style={{ fontSize: 11, letterSpacing: .8 }}>TCG CARD SHOP SIMULATOR</span>
          <span className={chip} style={{ fontSize: 11, letterSpacing: .8, textTransform: 'uppercase' }}>{chipText}</span>
        </div>
        <h1 style={{ margin: 0, fontSize: 46, fontWeight: 800, lineHeight: 1.05, letterSpacing: -.5 }}>{title}</h1>
        <p style={{ margin: 0, color: 'var(--text-2)', fontSize: 15, maxWidth: 560, lineHeight: 1.55 }}>{sub}</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
          {gameOk ? (
            <button type="button" className="btn btn-accent" onClick={onLaunch} style={{ height: 50, padding: '0 32px', fontSize: 16, borderRadius: 999 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4l13 8-13 8z" /></svg>
              {t('Play')}
            </button>
          ) : (
            <button type="button" className="btn btn-accent" onClick={() => onNav('settings')} style={{ height: 50, padding: '0 28px', fontSize: 15, borderRadius: 999 }}>{t('Open Settings')}</button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onAdd} style={{ height: 50, padding: '0 22px', borderRadius: 999 }}>{t('Install from file')}</button>
          <button type="button" className="btn btn-ghost" onClick={() => window.api.openGameFolder()} style={{ height: 50, padding: '0 22px', borderRadius: 999 }}>{t('Open Game Folder')}</button>
        </div>
      </section>

      <section aria-label={t('Status')} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <Tile n={enabled} label={t('Mods Active')} onClick={() => onNav('mods', { filter: 'All' })} />
        <Tile n={updateList.length} label={t('Updates available')} color={updateList.length ? 'var(--info-bright)' : undefined} onClick={() => onNav('mods', { filter: 'Updates' })} />
        <Tile n={problems} label={t('Problems')} color={problems ? 'var(--accent)' : undefined} onClick={() => onNav('mods', { filter: 'Issues' })} />
        <Tile n={staged.length} label={t('Staged')} onClick={() => onNav('staging')} />
      </section>

      {logSummary && logSummary.exists && logSummary.counts.errors > 0 && (
        <button type="button" onClick={() => onNav('log')} className="card"
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderColor: 'var(--red-border)', background: 'var(--red-soft)', color: 'var(--text)', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--red-bright)" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v6" /><path d="M12 16.5v.5" /></svg>
          <span style={{ flex: 1 }}>{t('Last game session')}: <b>{logSummary.counts.errors} {logSummary.counts.errors === 1 ? t('error') : t('errors')}</b>{logSummary.sources[0] ? ` · ${logSummary.sources[0].label}` : ''}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--red-bright)' }}>{t('Open Game Log')}</span>
        </button>
      )}

      <section>
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>{t('Updates')}</h2>
          </div>
          {updateList.length === 0 && <div style={{ fontSize: 13.5, color: 'var(--text-3)' }}>{t('Every mod is up to date.')}</div>}
          {updateList.map(({ id, u, mod }) => (
            <button key={id} type="button" onClick={() => window.api.openUrl(`https://www.nexusmods.com/tcgcardshopsimulator/mods/${u.modId}`)}
              title={t('Open on Nexus Mods')}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 'var(--radius)', background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}>
              <span className="truncate">{mod.name}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <span className="pill mono" style={{ color: 'var(--text-3)', whiteSpace: 'nowrap' }} title={t('Installed')}>{u.installed}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-4)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>
                <span className="pill pill-accent mono" style={{ whiteSpace: 'nowrap' }} title={t('Latest')}>{u.latest}</span>
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
