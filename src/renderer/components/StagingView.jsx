import { useState, useEffect, useRef } from 'react';
import { useI18n } from '../i18n';

const fmt = b => b>1048576?`${(b/1048576).toFixed(1)} MB`:b>1024?`${(b/1024).toFixed(0)} KB`:`${b} B`;

export default function StagingView({ staged, onInstall, onAdd, onRefresh, notify, installing, installProgress }) {
  const { t, tMod } = useI18n();
  const [targets, setTargets] = useState([]);
  const [sels, setSels] = useState({});
  const [names, setNames] = useState({});
  const [analyzed, setAnalyzed] = useState(new Set());
  const [peek, setPeek] = useState(null);
  const [preview, setPreview] = useState(null);
  const [securityMap, setSecurityMap] = useState({});

  const VERIFIED_PATTERNS = ['fast pack opening','fast opening pack','fastpackopening',
    'rtcgo custom furniture','custom furniture','furniture_prefabloader',
    'base set theme decks','jungle theme decks','fossil theme decks',
    'base set 2 theme decks','team rocket theme decks',
    'gym heroes theme decks','gym challenge theme decks',
    'pokemon adventures manga','pokemon statues','pokemon shop textures',
    'rtcgo shop textures','pokemon n64 games','pokemon gameboy games',
    'pokemon plushies','neo expansions','base expansions','gym expansions',
    'texturereplacer','collection tracker','enhancedprefabloader',
    'bepinex with configuration manager'];
  const isVerifiedFile = (fn) => { const l = fn.toLowerCase(); return VERIFIED_PATTERNS.some(p => l.includes(p)); };

  useEffect(() => { window.api.getTargets().then(setTargets).catch(e => console.error('[getTargets]', e)); }, []);

  // Batch detect all targets whenever staged files change
  const lastDetectRef = useRef(0);
  useEffect(() => {
    // Populate defaults
    staged.forEach(f => {
      if (!names[f.filename]) setNames(p => ({ ...p, [f.filename]: f.parsedName || f.filename.replace(/\.(zip|rar|7z)$/i, '') }));
      if (!sels[f.filename]) setSels(p => ({ ...p, [f.filename]: 'plugins' }));
      if (f.olderVersions) {
        for (const ov of f.olderVersions) {
          if (!names[ov.filename]) setNames(p => ({ ...p, [ov.filename]: f.parsedName || f.filename.replace(/\.(zip|rar|7z)$/i, '') }));
          if (!sels[ov.filename]) setSels(p => ({ ...p, [ov.filename]: sels[f.filename] || 'plugins' }));
        }
      }
      if (!securityMap[f.filename] && isVerifiedFile(f.filename)) {
        setSecurityMap(p => ({ ...p, [f.filename]: { safe: true, blocked: [], warnings: [], scanned: 0, verified: true } }));
      }
      if (!analyzed.has(f.filename)) {
        setAnalyzed(prev => new Set(prev).add(f.filename));
        window.api.peekArchive(f.filename).then(r => {
          if (r.security) setSecurityMap(p => ({ ...p, [f.filename]: r.security }));
        }).catch(() => {});
      }
    });
    // Batch detect all targets in one IPC call
    if (staged.length > 0) {
      const id = ++lastDetectRef.current;
      window.api.detectTargets().then(results => {
        if (lastDetectRef.current !== id) return;
        if (results && typeof results === 'object') {
          setSels(prev => {
            const next = { ...prev };
            for (const [fn, target] of Object.entries(results)) {
              next[fn] = target;
            }
            return next;
          });
        }
      }).catch(() => {});
    }
  }, [staged]);

  const doPeek = async filename => {
    if (peek === filename) { setPeek(null); setPreview(null); return; }
    setPeek(filename);
    const r = await window.api.peekArchive(filename);
    if (r.success) { setPreview(r); if (r.suggestedTarget) setSels(p => ({ ...p, [filename]: r.suggestedTarget })); }
    else { notify(`Could not peek: ${r.error}`, 'error'); setPreview(null); }
  };
  const doInstall = async (filename, skipRemoval = false) => {
    await onInstall(filename, sels[filename] || 'plugins', names[filename] || filename.replace(/\.(zip|rar|7z)$/i, ''), skipRemoval);
    setPeek(null); setPreview(null);
  };
  const [bulkAction, setBulkAction] = useState(null); // 'installNew' | 'updateAll'
  const doInstallNew = async () => { setBulkAction('installNew'); try { for (const f of staged) { if (f.status === 'new') await doInstall(f.filename, true); } } finally { setBulkAction(null); } };
  const doUpdateAll = async () => { setBulkAction('updateAll'); try { for (const f of staged) { if (f.status === 'update') await doInstall(f.filename, true); } } finally { setBulkAction(null); } };
  const isBusy = !!bulkAction || !!installing;

  const [confirmClear, setConfirmClear] = useState(false);
  const doClearAll = async () => {
    const result = await window.api.clearStaging();
    setConfirmClear(false);
    onRefresh();
    if (result && result.success === false) {
      notify(result.error || t('Staging folder cleared'), 'error');
    } else {
      notify(t('Staging folder cleared'), 'success');
    }
  };

  const newCount = staged.filter(f => f.status === 'new').length;
  const updateCount = staged.filter(f => f.status === 'update').length;

  // Sort: updates first, then new, then reinstalls — updates are the most time-sensitive
  // so they deserve to be at the top. Stable sort preserves the manager's natural order
  // (filesystem / arrival) within each status group.
  const statusRank = { update: 0, new: 1, reinstall: 2 };
  const stagedSorted = [...staged].sort((a, b) => {
    const ra = statusRank[a.status] ?? 3;
    const rb = statusRank[b.status] ?? 3;
    return ra - rb;
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>📥 {t('Downloaded Mods')}</div>
          <div style={{ fontSize: 14, color: 'var(--text-3)', marginTop: 2 }}>{t('Add mod archives, choose where each one goes, then install.')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={onAdd} disabled={isBusy}>{t('+ Add Archives')}</button>
          {newCount > 0 && <button className="btn btn-accent" onClick={doInstallNew} disabled={isBusy}>
            {bulkAction === 'installNew' ? '⏳' : '📥'} {bulkAction === 'installNew' ? t('Installing...') : `${t('Install New')} (${newCount})`}
          </button>}
          {updateCount > 0 && <button className="btn btn-accent" onClick={doUpdateAll} disabled={isBusy} style={{ background: 'var(--green)', animation: bulkAction === 'updateAll' ? 'none' : 'updateAllBtnGlow 2.4s ease-in-out infinite' }}>
            {bulkAction === 'updateAll' ? '⏳' : '⬆️'} {bulkAction === 'updateAll' ? t('Updating...') : `${t('Update All')} (${updateCount})`}
          </button>}
          {staged.length > 0 && !confirmClear && <button className="btn btn-ghost" onClick={() => setConfirmClear(true)} disabled={isBusy} style={{ color: 'var(--red-bright)', borderColor: 'var(--red)' }}>🗑 {t('Clear All')}</button>}
          {confirmClear && <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--red-bright)' }}>{t('Are you sure?')}</span>
            <button className="btn btn-danger btn-sm" onClick={doClearAll}>✓ {t('Yes')}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmClear(false)}>{t('Cancel')}</button>
          </div>}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {staged.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60, border: '2px dashed var(--border-2)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-base)', minHeight: 280 }}>
            <div style={{ fontSize: 52, marginBottom: 16, opacity: .4 }}>📦</div>
            <div style={{ fontSize: 19, fontWeight: 600, color: 'var(--text-3)', marginBottom: 6 }}>{t('No mod archives staged')}</div>
            <div style={{ fontSize: 15, color: 'var(--text-4)', textAlign: 'center', lineHeight: 1.8, maxWidth: 420 }}>
              {t('Click "+ Add Archives" above to select .zip / .rar / .7z files, or drop them into your staging folder next to the .exe')}
            </div>
            <button className="btn btn-ghost" onClick={onAdd} style={{ marginTop: 20 }}>📁 {t('Browse for archives...')}</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stagedSorted.map(f => {
              const isUpdate = f.status === 'update';
              const isInstalled = f.status === 'reinstall';
              return (
              <div key={f.filename} style={{ animation: 'fadeIn .2s ease', opacity: isInstalled ? 0.5 : 1, transition: 'opacity .2s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: isUpdate ? 'rgba(218,155,60,.06)' : 'var(--bg-elevated)', borderRadius: 'var(--radius)', border: `1px solid ${peek === f.filename ? 'var(--accent)' : isUpdate ? 'var(--accent)' : 'var(--border)'}`, animation: isUpdate ? 'updateGlow 2.4s ease-in-out infinite' : undefined }}>
                  <div style={{ width: 44, height: 44, borderRadius: 'var(--radius)', background: 'var(--bg-active)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>📦</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 16, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tMod(names[f.filename] || f.parsedName || '', '').name}
                      </span>
                      {f.parsedVersion && <span style={{ fontSize: 13, fontFamily: 'var(--mono)', color: 'var(--accent)', background: 'rgba(218,155,60,.12)', padding: '2px 8px', borderRadius: 3 }}>v{f.parsedVersion}</span>}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-4)', marginTop: 2 }}>
                      {f.filename} · {fmt(f.size)}
                      {f.status === 'update' && <span style={{ color: 'var(--accent)', marginLeft: 6 }}>⬆️ {t('updates')} v{f.installedVersion}</span>}
                      {f.olderVersions?.length > 0 && <span style={{ color: 'var(--text-3)', marginLeft: 6 }}>· v{f.olderVersions.map(o => o.version).join(', v')} {t('also staged')}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>{t('Extract To')}</div>
                    <select className="select" value={sels[f.filename] || 'plugins'} onChange={e => setSels(p => ({ ...p, [f.filename]: e.target.value }))} style={{ minWidth: 180 }}>
                      {targets.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                    {securityMap[f.filename] && (
                      <span title={securityMap[f.filename].blocked.length > 0 ? securityMap[f.filename].blocked[0] : securityMap[f.filename].warnings.length > 0 ? securityMap[f.filename].warnings[0] : securityMap[f.filename].verified ? t('Verified Safe') : `✓ ${t('Safe')}`}
                        style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, cursor: 'default',
                          background: securityMap[f.filename].blocked.length > 0 ? 'var(--red)' : securityMap[f.filename].warnings.length > 0 ? 'rgba(218,155,60,.2)' : 'rgba(92,185,80,.15)',
                          color: securityMap[f.filename].blocked.length > 0 ? '#fff' : securityMap[f.filename].warnings.length > 0 ? 'var(--accent)' : 'var(--green-bright)',
                          border: `1px solid ${securityMap[f.filename].blocked.length > 0 ? 'var(--red)' : securityMap[f.filename].warnings.length > 0 ? 'var(--accent)' : 'var(--green)'}`,
                        }}>
                        {securityMap[f.filename].blocked.length > 0 ? '🛑' : securityMap[f.filename].warnings.length > 0 ? '⚠️' : '✅'}
                      </span>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={() => doPeek(f.filename)}>{peek === f.filename ? '▲' : '▼'}</button>
                    {f.olderVersions?.length > 0 && (
                      <button className="btn btn-ghost btn-sm" onClick={() => doInstall(f.olderVersions[0].filename, false)} disabled={isBusy} style={{ color: '#c0392b', borderColor: '#c0392b44' }}>
                        ⬇️ {t('Downgrade')}
                      </button>
                    )}
                    <button className="btn btn-accent btn-sm" onClick={() => doInstall(f.filename, f.status === 'new' || f.status === 'update')} disabled={isBusy} style={isUpdate ? { animation: 'updateBtnGlow 2.4s ease-in-out infinite' } : undefined}>
                      {installing === f.filename ? '⏳' : f.status === 'update' ? '⬆️' : f.status === 'reinstall' ? '🔄' : '📥'}
                      {' '}{f.status === 'update' ? t('Update') : f.status === 'reinstall' ? t('Re-install') : t('Install')}
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={async () => {
                      const r = await window.api.removeFromStaging(f.filename);
                      onRefresh();
                      if (r && r.success === false) notify(r.error || 'Could not remove file', 'error');
                    }}>✕</button>
                  </div>
                </div>
                {installing === f.filename && installProgress && (
                  <div style={{ padding: '8px 16px 12px 16px', background: 'var(--bg-elevated)', borderRadius: '0 0 var(--radius) var(--radius)',
                    borderTop: 'none', marginTop: -1, border: '1px solid var(--border)', borderTopColor: 'transparent' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: 'var(--text-3)' }}>
                      <span>📦 {t('Installing')}...</span>
                      <span>{installProgress.percent >= 0 ? `${installProgress.percent}%` : `${installProgress.done} ${t('files')}`}{installProgress.total > 0 ? ` (${installProgress.done}/${installProgress.total})` : ''}</span>
                    </div>
                    <div style={{ width: '100%', height: 6, background: 'var(--bg-base)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        width: installProgress.percent >= 0 ? `${installProgress.percent}%` : '100%',
                        height: '100%', borderRadius: 3, transition: 'width 0.15s ease',
                        background: installProgress.percent >= 0 ? 'var(--accent)' : 'var(--accent)',
                        animation: installProgress.percent < 0 ? 'pulse 1.5s infinite' : 'none',
                      }} />
                    </div>
                  </div>
                )}
                {peek === f.filename && preview && (
                  <div style={{ margin: '0 0 0 56px', padding: 14, background: 'var(--bg-base)', borderRadius: '0 0 var(--radius) var(--radius)', border: '1px solid var(--border)', borderTop: 'none' }}>
                    {/* Security Status */}
                    {preview.security && (
                      <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 'var(--radius)',
                        background: preview.security.blocked.length > 0 ? 'rgba(192,57,43,.12)' : preview.security.warnings.length > 0 ? 'rgba(218,155,60,.12)' : 'rgba(92,185,80,.12)',
                        border: `1px solid ${preview.security.blocked.length > 0 ? 'var(--red)' : preview.security.warnings.length > 0 ? 'var(--accent)' : 'var(--green)'}`,
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: preview.security.blocked.length + preview.security.warnings.length > 0 ? 6 : 0,
                          color: preview.security.blocked.length > 0 ? 'var(--red-bright)' : preview.security.warnings.length > 0 ? 'var(--accent)' : 'var(--green-bright)' }}>
                          {preview.security.blocked.length > 0 ? `🛑 ${t('BLOCKED')} — ${t('Security threats detected')}` :
                           preview.security.warnings.length > 0 ? `⚠️ ${t('Warnings')}` :
                           preview.security.verified ? `✅ ${t('Verified Safe')} — ${preview.security.scanned} ${t('files')} ${t('scanned')}` :
                           `✅ ${t('Safe')} — ${preview.security.scanned} ${t('files')} ${t('scanned')}`}
                        </div>
                        {preview.security.blocked.map((msg, i) => (
                          <div key={'b'+i} style={{ fontSize: 12, color: 'var(--red-bright)', padding: '2px 0' }}>🛑 {msg}</div>
                        ))}
                        {preview.security.warnings.map((msg, i) => (
                          <div key={'w'+i} style={{ fontSize: 12, color: 'var(--accent)', padding: '2px 0' }}>⚠️ {msg}</div>
                        ))}
                      </div>
                    )}
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>{t('Contents')} ({preview.entries?.length || 0} {t('files')})</div>
                    <div style={{ maxHeight: 180, overflow: 'auto', fontSize: 13, fontFamily: 'var(--mono)', color: 'var(--text-3)', lineHeight: 1.7 }}>
                      {preview.entries?.slice(0, 60).map((e, i) => (
                        <div key={i} style={{ color: e.path.endsWith('.dll') ? 'var(--green-bright)' : e.path.startsWith('BepInEx/') ? 'var(--accent)' : 'var(--text-4)' }}>
                          {e.isDir ? '📁' : '  '} {e.path}{e.size > 0 && !e.isDir && <span style={{ color: 'var(--text-4)', marginLeft: 8 }}>{fmt(e.size)}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )})}
          </div>
        )}
      </div>
    </div>
  );
}
