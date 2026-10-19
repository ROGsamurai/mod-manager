import { useState, useEffect, useMemo } from 'react';
import { useI18n } from '../i18n';
import { APP_VERSION } from '../version';

const LEVEL_STYLE = {
  Fatal: 'pill-danger', Error: 'pill-danger', Warning: 'pill-accent',
  Message: '', Info: '', Debug: '',
};
const EVERYTHING_LIMIT = 1500;

/**
 * Game Log: what BepInEx wrote the last time the game ran, with every warning
 * and error matched to the installed mod it came from.
 */
export default function GameLog({ onNav, onLogLoaded }) {
  const { t, locale } = useI18n();
  const [log, setLog] = useState(null);
  const [tab, setTab] = useState('problems');
  const [source, setSource] = useState(null);
  const [search, setSearch] = useState('');
  const [follow, setFollow] = useState(true);
  const [open, setOpen] = useState(new Set());
  const [copied, setCopied] = useState(false);

  const load = async () => {
    try { const r = await window.api.readGameLog(); setLog(r); onLogLoaded?.(r); } catch { setLog({ exists: false }); }
  };
  useEffect(() => { load(); }, []);
  // Follow while the game runs: re-read every couple of seconds. The backend
  // returns its cached result when the file has not changed, so this is cheap.
  useEffect(() => {
    if (!follow) return;
    const id = setInterval(load, 2500);
    return () => clearInterval(id);
  }, [follow]);

  const ago = useMemo(() => {
    if (!log?.modifiedAt) return '';
    const s = Math.round((log.modifiedAt - Date.now()) / 1000);
    const rtf = new Intl.RelativeTimeFormat(locale === 'pt-BR' ? 'pt-BR' : locale, { numeric: 'auto' });
    const a = Math.abs(s);
    if (a < 60) return rtf.format(s, 'second');
    if (a < 3600) return rtf.format(Math.round(s / 60), 'minute');
    if (a < 86400) return rtf.format(Math.round(s / 3600), 'hour');
    return rtf.format(Math.round(s / 86400), 'day');
  }, [log?.modifiedAt, locale]);

  const shown = useMemo(() => {
    if (!log?.entries) return [];
    let list = log.entries;
    if (tab === 'problems') list = list.filter(e => e.level === 'Error' || e.level === 'Fatal' || e.level === 'Warning');
    else if (tab === 'errors') list = list.filter(e => e.level === 'Error' || e.level === 'Fatal');
    else if (tab === 'warnings') list = list.filter(e => e.level === 'Warning');
    if (source) list = list.filter(e => e.label === source);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e => `${e.source} ${e.label || ''} ${e.message} ${e.detail}`.toLowerCase().includes(q));
    }
    return tab === 'all' ? list.slice(-EVERYTHING_LIMIT) : list;
  }, [log, tab, source, search]);

  const copyReport = async () => {
    if (!log?.exists) return;
    const lines = [
      `Real TCG Overhaul Mod Manager v${APP_VERSION}`,
      `BepInEx ${log.bepinexVersion || '?'} · Unity ${log.unityVersion || '?'} · ${log.pluginCount} plugins loaded`,
      `Log written ${new Date(log.modifiedAt).toLocaleString()}`,
      `${log.counts.errors} error(s), ${log.counts.warnings} warning(s)`,
      '',
    ];
    for (const e of log.entries.filter(x => x.level === 'Error' || x.level === 'Fatal' || x.level === 'Warning')) {
      lines.push(`[${e.level}] ${e.label}${e.label !== e.source ? ` (${e.source})` : ''}: ${e.message}`);
      if (e.detail) lines.push(...e.detail.split('\n').slice(0, 6).map(l => `    ${l.trim()}`));
    }
    try { await navigator.clipboard.writeText('```\n' + lines.join('\n') + '\n```'); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };

  const toggleOpen = (i) => setOpen(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });

  const Tile = ({ n, label, color, small }) => (
    <div className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: small ? 19 : 30, fontWeight: 700, lineHeight: small ? '36px' : 1.1, color: color || 'var(--text)' }}>{n}</span>
      <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{label}</span>
    </div>
  );
  // The source column is as wide as the longest mod name on screen (within
  // limits), so names show in full and the messages still line up.
  const labelW = Math.min(340, Math.max(130, Math.round(Math.max(0, ...shown.map(x => (x.label || x.source || '').length)) * 7.6) + 8));
  const TabBtn = ({ id, label }) => (
    <button type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
      className={`btn btn-sm ${tab === id ? 'btn-ghost' : 'btn-quiet'}`}
      style={tab === id ? { color: 'var(--accent)', borderColor: 'var(--accent-border)', background: 'var(--accent-soft)' } : undefined}>{label}</button>
  );

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div className="mono" style={{ fontSize: 11.5, letterSpacing: 1.5, color: 'var(--accent)' }}>BEPINEX · LOGOUTPUT.LOG</div>
          <h1 className="page-title" style={{ marginTop: 4 }}>{t('Game Log')}</h1>
          <p className="page-sub">{t('What BepInEx wrote the last time the game ran, with every problem matched to the mod it came from.')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-accent" onClick={copyReport} disabled={!log?.exists}>{copied ? t('Copied') : t('Copy report')}</button>
          <button type="button" className="btn btn-ghost" onClick={() => window.api.openLogFolder()}>{t('Open log folder')}</button>
        </div>
      </div>

      {log && !log.exists && (
        <div className="panel" style={{ color: 'var(--text-3)', lineHeight: 1.6 }}>
          {t('No game log yet. Start the game once with BepInEx installed and the log will appear here.')}
        </div>
      )}

      {log?.exists && (<>
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <Tile n={log.counts.errors} label={t('Errors')} color={log.counts.errors ? 'var(--red-bright)' : undefined} />
          <Tile n={log.counts.warnings} label={t('Warnings')} color={log.counts.warnings ? 'var(--accent)' : undefined} />
          <Tile n={log.pluginCount} label={t('Plugins loaded')} color="var(--info-bright)" />
          <Tile n={`BepInEx ${log.bepinexVersion || '?'}`} label={`${t('Last run')} ${ago}`} small />
        </section>

        {log.sources.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text-3)', marginRight: 4 }}>{t('By mod')}</span>
            {log.sources.map(s => (
              <button key={s.label} type="button" onClick={() => setSource(source === s.label ? null : s.label)}
                className="btn btn-sm btn-ghost" aria-pressed={source === s.label}
                style={source === s.label ? { borderColor: 'var(--accent)', color: 'var(--text)' } : undefined}>
                {s.label}
                {s.errors > 0 && <span className="pill pill-danger" style={{ height: 20, padding: '0 7px', fontSize: 11 }}>{s.errors}</span>}
                {s.warnings > 0 && <span className="pill pill-accent" style={{ height: 20, padding: '0 7px', fontSize: 11 }}>{s.warnings}</span>}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <div role="tablist" aria-label={t('Show')} style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <TabBtn id="problems" label={t('Problems')} />
            <TabBtn id="errors" label={t('Errors')} />
            <TabBtn id="warnings" label={t('Warnings')} />
            <TabBtn id="all" label={t('Everything')} />
          </div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-2)', cursor: 'pointer' }}>
              <input type="checkbox" checked={follow} onChange={e => setFollow(e.target.checked)} style={{ width: 15, height: 15, accentColor: 'var(--accent)' }} />
              {t('Follow while the game runs')}
            </label>
            <input className="input" aria-label={t('Search the log')} placeholder={t('Search the log')} value={search} onChange={e => setSearch(e.target.value)} style={{ width: 220 }} />
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {shown.length === 0 && (
            <div style={{ padding: 24, color: 'var(--text-3)', textAlign: 'center' }}>
              {tab === 'problems' && !source && !search ? t('No warnings or errors in the last game session.') : t('Nothing matches.')}
            </div>
          )}
          {shown.map(e => {
            const isOpen = open.has(e.index);
            const expandable = !!e.detail || !!e.modId;
            return (
              <div key={e.index} style={{ borderBottom: '1px solid var(--border)' }}>
                <button type="button" onClick={expandable ? () => toggleOpen(e.index) : undefined} aria-expanded={expandable ? isOpen : undefined}
                  style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 14px', background: 'transparent', border: 'none', color: 'inherit', font: 'inherit', textAlign: 'left', cursor: expandable ? 'pointer' : 'default', userSelect: 'text' }}>
                  <span className={`pill ${LEVEL_STYLE[e.level] || ''} mono`} style={{ flex: '0 0 auto', minWidth: 78, padding: '0 8px', justifyContent: 'center', height: 22, fontSize: 10.5, textTransform: 'uppercase' }}>{t(e.level)}</span>
                  <span style={{ flex: `0 0 ${labelW}px`, minWidth: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-2)', lineHeight: 1.5, overflowWrap: 'anywhere' }} title={e.label || e.source}>{e.label || e.source}</span>
                  <span className="mono" style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.5, color: 'var(--text)', overflowWrap: 'anywhere' }}>{e.message}</span>
                  {expandable && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2.4" aria-hidden="true" style={{ flex: '0 0 auto', marginTop: 3, transform: isOpen ? 'rotate(180deg)' : 'none' }}><path d="M6 9l6 6 6-6" /></svg>}
                </button>
                {isOpen && (
                  <div style={{ margin: '0 14px 12px 104px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {e.detail && <pre className="mono" style={{ margin: 0, padding: 12, borderRadius: 'var(--radius)', background: 'var(--bg-deep)', border: '1px solid var(--border)', fontSize: 12, lineHeight: 1.6, color: 'var(--text-2)', whiteSpace: 'pre-wrap', userSelect: 'text' }}>{e.detail}</pre>}
                    {e.modId && (
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 13, color: 'var(--text-3)' }}>
                        <span>{t('Comes from')} <b style={{ color: 'var(--text)' }}>{e.modName}</b></span>
                        <button type="button" className="pill pill-info pill-btn" onClick={() => onNav('mods')}>{t('Show in Installed')}</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {tab === 'all' && log.entries.length > EVERYTHING_LIMIT && (
            <div style={{ padding: 12, fontSize: 12.5, color: 'var(--text-3)', textAlign: 'center' }}>{t('Showing the most recent lines. Open the log folder for the full file.')}</div>
          )}
        </div>
      </>)}
    </div>
  );
}
