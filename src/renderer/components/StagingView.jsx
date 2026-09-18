import { useState, useEffect, useRef } from 'react';
import { useI18n } from '../i18n';

const fmt = b => b>1048576?`${(b/1048576).toFixed(1)} MB`:b>1024?`${(b/1024).toFixed(0)} KB`:`${b} B`;

export default function StagingView({ staged, onInstall, onAdd, onRefresh, notify, installing, installProgress, gameFound = true }) {
  const { t, tMod } = useI18n();
  const [targets, setTargets] = useState([]);
  const [sels, setSels] = useState({});
  // Archive contents used to render only the first 60 entries inside a 180px box,
  // so a 229-entry mod could not be scrolled past entry 60 — the rest simply were
  // not in the DOM. The list is virtualized instead: every entry is reachable, and
  // a 5000-file expansion pack stays responsive because only the visible slice is
  // rendered. Fixed row height is what makes the offset maths work.
  const CONTENTS_ROW_H = 22;
  const CONTENTS_VIEW_H = 320;
  const CONTENTS_OVERSCAN = 6;
  const [previewScroll, setPreviewScroll] = useState(0);
  const [names, setNames] = useState({});
  const [analyzed, setAnalyzed] = useState(new Set());
  const [peek, setPeek] = useState(null);
  const [preview, setPreview] = useState(null);
  const [securityMap, setSecurityMap] = useState({});
  const [blockedMap, setBlockedMap] = useState({});
  // Filenames currently being deleted — hidden from the list immediately so the
  // ✕ click feels instant instead of waiting for the disk + refresh round trip.
  const [removing, setRemoving] = useState(new Set());

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
      // No 'plugins' placeholder: sels is display-only now, and guessing here
      // would show a destination that detection then contradicts.
      if (f.olderVersions) {
        for (const ov of f.olderVersions) {
          if (!names[ov.filename]) setNames(p => ({ ...p, [ov.filename]: f.parsedName || f.filename.replace(/\.(zip|rar|7z)$/i, '') }));
        }
      }
      if (!securityMap[f.filename] && isVerifiedFile(f.filename) && !blockedMap[f.filename]) {
        setSecurityMap(p => ({ ...p, [f.filename]: { safe: true, blocked: [], warnings: [], scanned: 0, verified: true } }));
      }
      if (!analyzed.has(f.filename)) {
        setAnalyzed(prev => new Set(prev).add(f.filename));
        window.api.peekArchive(f.filename).then(r => {
          if (r.security) setSecurityMap(p => ({ ...p, [f.filename]: r.security }));
          // Mods on the blocklist are refused by the backend too; showing it here
          // just means the user finds out before clicking Install.
          setBlockedMap(p => ({ ...p, [f.filename]: r.blockedMod || null }));
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

  // Detected target key -> human label. While detection is still in flight the
  // key is undefined; say so rather than showing a wrong destination.
  const targetLabel = (key) => {
    if (!key) return t('Detecting...');
    const hit = targets.find(x => x.key === key);
    return hit ? hit.label : key;
  };
  const doPeek = async filename => {
    if (peek === filename) { setPeek(null); setPreview(null); return; }
    setPeek(filename);
    setPreviewScroll(0);
    const r = await window.api.peekArchive(filename);
    if (r.success) { setPreview(r); if (r.suggestedTarget) setSels(p => ({ ...p, [filename]: r.suggestedTarget })); }
    else { notify(`Could not peek: ${r.error}`, 'error'); setPreview(null); }
  };
  // Install / update / downgrade all take the same path now: the backend always
  // removes the previously installed copy's files before extracting the new one.
  const doInstall = async (filename) => {
    // No target argument: installMod detects the destination from the archive
    // itself. The renderer's detected value is display only.
    await onInstall(filename, null, names[filename] || filename.replace(/\.(zip|rar|7z)$/i, ''));
    setPeek(null); setPreview(null);
  };
  const [bulkAction, setBulkAction] = useState(null); // 'installNew' | 'updateAll'
  const doInstallNew = async () => { setBulkAction('installNew'); try { for (const f of staged) { if (f.status === 'new' && !blockedMap[f.filename]) await doInstall(f.filename); } } finally { setBulkAction(null); } };
  const doUpdateAll = async () => { setBulkAction('updateAll'); try { for (const f of staged) { if (f.status === 'update' && !blockedMap[f.filename]) await doInstall(f.filename); } } finally { setBulkAction(null); } };
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

  // Blocked archives are excluded from the bulk counts: doInstallNew/doUpdateAll
  // skip them, so counting them made "Install New (5)" promise installs that
  // never happen — and the button showed up at all when every staged mod was
  // blocked.
  const newCount = staged.filter(f => f.status === 'new' && !blockedMap[f.filename]).length;
  const updateCount = staged.filter(f => f.status === 'update' && !blockedMap[f.filename]).length;

  // Sort: updates first, then new, then reinstalls — updates are the most time-sensitive
  // so they deserve to be at the top. Stable sort preserves the manager's natural order
  // (filesystem / arrival) within each status group.
  const statusRank = { update: 0, new: 1, reinstall: 2 };
  const stagedSorted = staged
    .filter(f => !removing.has(f.filename))
    .sort((a, b) => {
      const ra = statusRank[a.status] ?? 3;
      const rb = statusRank[b.status] ?? 3;
      return ra - rb;
    });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, padding: '24px 24px 18px', flexShrink: 0 }}>
        <div style={{ minWidth: 0 }}>
          <h1 className="page-title">{t('Staged Mods')}</h1>
          <p className="page-sub">{t('Archives waiting to be installed. The manager decides where each one goes.')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
          <button className="btn btn-ghost" onClick={onAdd} disabled={isBusy}>{t('Add Archives')}</button>
          {newCount > 0 && <button className="btn btn-accent" onClick={doInstallNew} disabled={isBusy || !gameFound}>
            {bulkAction === 'installNew' ? t('Installing...') : `${t('Install New')} (${newCount})`}
          </button>}
          {updateCount > 0 && <button className="btn btn-success" onClick={doUpdateAll} disabled={isBusy || !gameFound} style={{ animation: bulkAction === 'updateAll' ? 'none' : 'updateAllBtnGlow 2.4s ease-in-out infinite' }}>
            {bulkAction === 'updateAll' ? t('Updating...') : `${t('Update All')} (${updateCount})`}
          </button>}
          {stagedSorted.length > 0 && !confirmClear && <button className="btn btn-danger" onClick={() => setConfirmClear(true)} disabled={isBusy}>{t('Clear All')}</button>}
          {confirmClear && <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--red-bright)' }}>{t('Are you sure?')}</span>
            <button className="btn btn-danger btn-sm" onClick={doClearAll}>{t('Yes')}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmClear(false)}>{t('Cancel')}</button>
          </div>}
        </div>
      </div>
      {!gameFound && (
        <div className="card card-danger" style={{ margin: '0 24px 14px', background: 'var(--red-soft)', color: 'var(--red-bright)', fontSize: 14, lineHeight: 1.6, flexShrink: 0 }}>
          <strong>{t('Game not detected')}</strong>
          <div style={{ marginTop: 4, color: 'var(--text-3)' }}>
            {t('"Card Shop Simulator.exe" was not found in the selected folder, so installing would put mods where the game cannot load them. Fix the game location in Settings.')}
          </div>
        </div>
      )}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {stagedSorted.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 56, border: '1px dashed var(--border-2)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-surface)', minHeight: 280 }}>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="var(--text-4)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginBottom: 16 }}>
              <path d="M4 7l8-4 8 4v10l-8 4-8-4z" /><path d="M4 7l8 4 8-4" /><path d="M12 11v10" />
            </svg>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>{t('No mod archives staged')}</div>
            <div style={{ fontSize: 14, color: 'var(--text-4)', textAlign: 'center', lineHeight: 1.7, maxWidth: 420 }}>
              {t('Click "+ Add Archives" above to select .zip / .rar / .7z files, or drop them into your staging folder next to the .exe')}
            </div>
            <button className="btn btn-ghost" onClick={onAdd} style={{ marginTop: 20 }}>{t('Browse for archives...')}</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {stagedSorted.map(f => {
              const isUpdate = f.status === 'update';
              const isInstalled = f.status === 'reinstall';
              return (
              <div key={f.filename}
                className={`card${blockedMap[f.filename] ? ' card-danger' : peek === f.filename || isUpdate ? ' card-accent' : ''}`}
                style={{ padding: 0, overflow: 'hidden', animation: isUpdate ? 'updateGlow 2.4s ease-in-out infinite' : 'fadeIn .2s ease',
                  opacity: isInstalled ? 0.5 : 1, transition: 'opacity .2s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
                  <div style={{ width: 42, height: 42, borderRadius: 11, background: blockedMap[f.filename] ? 'var(--red-soft)' : 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: blockedMap[f.filename] ? 'var(--red-bright)' : isUpdate ? 'var(--accent)' : 'var(--text-3)' }}>
                    {blockedMap[f.filename] ? (
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></svg>
                    ) : (
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7l8-4 8 4v10l-8 4-8-4z" /><path d="M4 7l8 4 8-4" /><path d="M12 11v10" /></svg>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 16, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tMod(names[f.filename] || f.parsedName || '', '').name}
                      </span>
                      {f.parsedVersion && <span className="badge badge-accent">{f.parsedVersion}</span>}
                      {f.status === 'update' && <span className="pill pill-info pill-pulse">{t('Update Ready')}</span>}
                      {blockedMap[f.filename] && <span className="pill pill-danger">{t('Blocked')}</span>}
                    </div>
                    {/* Filename on its own line — it is long enough to fill the
                        row by itself — with size and version notes underneath. */}
                    <div className="mono truncate" style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 4 }}>
                      {f.filename}
                    </div>
                    <div className="mono truncate" style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 2 }}>
                      {f.statError
                        ? <span style={{ color: 'var(--red-bright)' }} title={`The manager can list this file but cannot read it (${f.statError}). It is usually locked by OneDrive/antivirus, still downloading, or on a path Windows considers too long. This also prevents deleting and installing it.`}>{t('unreadable')} ({f.statError})</span>
                        : fmt(f.size)}
                      {f.status === 'update' && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>{t('updates')} v{f.installedVersion}</span>}
                      {f.olderVersions?.length > 0 && <span style={{ color: 'var(--text-3)', marginLeft: 8 }}>v{f.olderVersions.map(o => o.version).join(', v')} {t('also staged')}</span>}
                    </div>
                    {/* Blocked notice lives under the mod name, not in the
                        destination column: the reason is a sentence, and putting a
                        sentence in a fixed-width column squeezed the name and
                        filename into one word per line. */}
                    {blockedMap[f.filename] && (
                      <div style={{ fontSize: 13, color: 'var(--red-bright)', marginTop: 4, lineHeight: 1.5 }}>
                        {blockedMap[f.filename].reason}
                        {blockedMap[f.filename].useInstead && <> {t('Use')} <b>{blockedMap[f.filename].useInstead}</b> {t('instead.')}</>}
                      </div>
                    )}
                  </div>
                  {/* Destination is decided by the manager from the archive's own
                      structure (and re-checked in the backend at install time), so
                      this is a label, not a control. Users picking the wrong target
                      was a common cause of "installed fine but does nothing". */}
                  {!blockedMap[f.filename] && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0, width: 160 }}>
                      <div className="label">{t('Installs To')}</div>
                      <div className="mono" style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
                        {targetLabel(sels[f.filename])}
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                    {securityMap[f.filename] && (
                      <span className={`pill ${securityMap[f.filename].blocked.length > 0 ? 'pill-danger' : securityMap[f.filename].warnings.length > 0 ? 'pill-accent' : 'pill-success'}`}
                        title={securityMap[f.filename].blocked.length > 0 ? securityMap[f.filename].blocked[0] : securityMap[f.filename].warnings.length > 0 ? securityMap[f.filename].warnings[0] : securityMap[f.filename].verified ? t('Verified Safe') : t('Safe')}
                        style={{ width: 34, height: 34, padding: 0, justifyContent: 'center', borderRadius: 'var(--radius-sm)', cursor: 'default' }}>
                        {securityMap[f.filename].blocked.length > 0 ? (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></svg>
                        ) : securityMap[f.filename].warnings.length > 0 ? (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4l9 16H3z" /><path d="M12 10v4" /><path d="M12 17.5v.5" /></svg>
                        ) : (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
                        )}
                      </span>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={() => doPeek(f.filename)}>{peek === f.filename ? '▲' : '▼'}</button>
                    {/* Blocked rows keep only the preview and delete buttons —
                        a disabled Install button still reads as "maybe later". */}
                    {!blockedMap[f.filename] && f.olderVersions?.length > 0 && (
                      <button className="btn btn-danger btn-sm" onClick={() => doInstall(f.olderVersions[0].filename)} disabled={isBusy || !gameFound}>
                        {t('Downgrade')}
                      </button>
                    )}
                    {!blockedMap[f.filename] && (
                      <button className={`btn btn-sm ${f.status === 'reinstall' ? 'btn-ghost' : 'btn-accent'}`} onClick={() => doInstall(f.filename)} disabled={isBusy || !gameFound} style={isUpdate ? { animation: 'updateBtnGlow 2.4s ease-in-out infinite' } : undefined}>
                        {installing === f.filename && <span className="spinner" style={{ width: 13, height: 13 }} />}
                        {f.status === 'update' ? t('Update') : f.status === 'reinstall' ? t('Re-install') : t('Install')}
                      </button>
                    )}
                    <button className="btn btn-danger btn-sm btn-icon" aria-label={t('Remove')} disabled={removing.has(f.filename)} onClick={async () => {
                      // A row can represent several archives of the same mod (the
                      // primary plus f.olderVersions). Deleting only the primary
                      // leaves the others on disk and the row instantly re-appears
                      // with the next version — which looks like "delete did
                      // nothing". Remove every file the row stands for.
                      const filenames = [f.filename, ...(f.olderVersions || []).map(o => o.filename)];
                      // Hide the row immediately so the click feels instant, then
                      // reconcile against the real folder contents.
                      setRemoving(prev => { const n = new Set(prev); filenames.forEach(x => n.add(x)); return n; });
                      try {
                        const results = await Promise.all(filenames.map(fn => window.api.removeFromStaging(fn)));
                        const failed = results.filter(r => r && r.success === false);
                        if (failed.length) notify(failed[0].error || 'Could not remove file', 'error');
                        else {
                          const deferred = results.find(r => r && r.deferred && r.note);
                          if (deferred) notify(deferred.note, 'warn');
                        }
                        await onRefresh();
                      } catch (e) {
                        notify(e?.message || 'Could not remove file', 'error');
                        await onRefresh();
                      } finally {
                        setRemoving(prev => { const n = new Set(prev); filenames.forEach(x => n.delete(x)); return n; });
                      }
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
                {installing === f.filename && installProgress && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '10px 16px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7, fontSize: 12.5 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--accent)', fontWeight: 600 }}>
                        <span className="spinner" style={{ width: 12, height: 12 }} />
                        {installProgress.phase === 'removing' ? `${t('Removing old version')}...` : `${t('Installing')}...`}
                      </span>
                      <span className="mono" style={{ color: 'var(--text-4)' }}>
                        {installProgress.total > 0 ? `${installProgress.done} / ${installProgress.total}` : `${installProgress.done} ${t('files')}`}
                        {installProgress.percent >= 0 ? ` · ${installProgress.percent}%` : ''}
                      </span>
                    </div>
                    <div className="progress">
                      {installProgress.percent >= 0
                        ? <div className="bar" style={{ width: `${installProgress.percent}%` }} />
                        : <div className="bar-indeterminate" />}
                    </div>
                  </div>
                )}
                {peek === f.filename && preview && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '14px 16px' }}>
                    {/* Security Status */}
                    {preview.security && (
                      <div style={{ marginBottom: 14, padding: '9px 13px', borderRadius: 'var(--radius)',
                        background: preview.security.blocked.length > 0 ? 'var(--red-soft)' : preview.security.warnings.length > 0 ? 'var(--accent-soft)' : 'var(--green-soft)',
                        border: `1px solid ${preview.security.blocked.length > 0 ? 'var(--red-border)' : preview.security.warnings.length > 0 ? 'var(--accent-border)' : 'var(--green-border)'}`,
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: preview.security.blocked.length + preview.security.warnings.length > 0 ? 6 : 0,
                          color: preview.security.blocked.length > 0 ? 'var(--red-bright)' : preview.security.warnings.length > 0 ? 'var(--accent)' : 'var(--green-bright)' }}>
                          {preview.security.blocked.length > 0 ? `${t('BLOCKED')} — ${t('Security threats detected')}` :
                           preview.security.warnings.length > 0 ? t('Warnings') :
                           preview.security.verified ? `${t('Verified Safe')} — ${preview.security.scanned} ${t('files')} ${t('scanned')}` :
                           `${t('Safe')} — ${preview.security.scanned} ${t('files')} ${t('scanned')}`}
                        </div>
                        {preview.security.blocked.map((msg, i) => (
                          <div key={'b'+i} style={{ fontSize: 12, color: 'var(--red-bright)', padding: '2px 0' }}>{msg}</div>
                        ))}
                        {preview.security.warnings.map((msg, i) => (
                          <div key={'w'+i} style={{ fontSize: 12, color: 'var(--accent)', padding: '2px 0' }}>{msg}</div>
                        ))}
                      </div>
                    )}
                    {(() => {
                      const entries = preview.entries || [];
                      // Count FILES, not entries: the security scanner reports
                      // non-directory entries, so counting folders here made the
                      // two numbers disagree ("156 scanned" vs "229 files").
                      const fileCount = entries.filter(e => !e.isDir).length;
                      const folderCount = entries.length - fileCount;
                      const total = entries.length;
                      const start = Math.max(0, Math.floor(previewScroll / CONTENTS_ROW_H) - CONTENTS_OVERSCAN);
                      const end = Math.min(total, Math.ceil((previewScroll + CONTENTS_VIEW_H) / CONTENTS_ROW_H) + CONTENTS_OVERSCAN);
                      return (
                        <>
                          <div className="label" style={{ marginBottom: 8 }}>
                            {t('Contents')} — {fileCount} {t('files')}{folderCount > 0 ? `, ${folderCount} ${t('folders')}` : ''}
                          </div>
                          <div
                            onScroll={e => setPreviewScroll(e.currentTarget.scrollTop)}
                            style={{ height: Math.min(CONTENTS_VIEW_H, Math.max(CONTENTS_ROW_H, total * CONTENTS_ROW_H)), overflow: 'auto',
                              fontSize: 12.5, fontFamily: 'var(--mono)', color: 'var(--text-3)',
                              border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-deep)', padding: '6px 10px' }}>
                            <div style={{ height: total * CONTENTS_ROW_H, position: 'relative' }}>
                              {entries.slice(start, end).map((e, i) => {
                                const idx = start + i;
                                return (
                                  <div key={idx} title={e.path} style={{ position: 'absolute', top: idx * CONTENTS_ROW_H, left: 0, right: 0,
                                    height: CONTENTS_ROW_H, lineHeight: `${CONTENTS_ROW_H}px`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                    color: e.path.endsWith('.dll') ? 'var(--green-bright)' : e.path.startsWith('BepInEx/') ? 'var(--accent)' : 'var(--text-4)' }}>
                                    {e.isDir ? '▸ ' : '   '}{e.path}{e.size > 0 && !e.isDir && <span style={{ color: 'var(--text-4)', marginLeft: 8 }}>{fmt(e.size)}</span>}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      );
                    })()}
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
