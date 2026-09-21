import { useState, useEffect } from 'react';
import { useI18n } from '../i18n';
import { APP_VERSION } from '../version';

export default function Settings({ gamePath, bepinex, onSetPath, onDetect, notify, onRefreshMods, onRefreshStaged, onSetBepinex }) {
  const { t } = useI18n();
  const [deleteAfterInstall, setDeleteAfterInstall] = useState(false);
  const [minimizeToTray, setMinimizeToTray] = useState(false);
  const [minimizeBtnToTray, setMinimizeBtnToTray] = useState(false);
  const [confirmFresh, setConfirmFresh] = useState(false);
  const [freshBusy, setFreshBusy] = useState(false);
  const [healthCheck, setHealthCheck] = useState(null);
  const [healthBusy, setHealthBusy] = useState(false);
  const [dupBusy, setDupBusy] = useState(false);

  const [regroupBusy, setRegroupBusy] = useState(false);

  useEffect(() => {
    window.api.getDeleteAfterInstall().then(setDeleteAfterInstall).catch(e => console.error('[getDeleteAfterInstall]', e));
    window.api.getMinimizeToTray().then(setMinimizeToTray).catch(e => console.error('[getMinimizeToTray]', e));
    window.api.getMinimizeBtnToTray().then(setMinimizeBtnToTray).catch(e => console.error('[getMinimizeBtnToTray]', e));
  }, []);
  const toggleDelete = () => { const v = !deleteAfterInstall; setDeleteAfterInstall(v); window.api.setDeleteAfterInstall(v); };
  const toggleTray = () => { const v = !minimizeToTray; setMinimizeToTray(v); window.api.setMinimizeToTray(v); };
  const toggleBtnTray = () => { const v = !minimizeBtnToTray; setMinimizeBtnToTray(v); window.api.setMinimizeBtnToTray(v); };

  const doFreshInstall = async () => {
    setFreshBusy(true);
    const r = await window.api.freshInstall();
    if (r.success) {
      notify(t('Fresh install complete. All mods removed, configs preserved.'), 'success');
      await onRefreshMods();
      await onRefreshStaged();
      await onSetBepinex();
    } else {
      notify(r.error, 'error');
    }
    setFreshBusy(false);
    setConfirmFresh(false);
  };

  const doRegroupAll = async () => {
    setRegroupBusy(true);
    const r = await window.api.regroupAllMods();
    if (r.success) {
      notify(`${t('Re-applied auto-group rules')}: ${r.assigned} / ${r.total} ${t('mods grouped')}`, 'success');
      if (onRefreshMods) await onRefreshMods();
    } else {
      notify(r.error || t('Regroup failed'), 'error');
    }
    setRegroupBusy(false);
  };

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <div style={{ padding: 24 }}>
      <h1 className="page-title">{t('Settings')}</h1>
      <p className="page-sub" style={{ marginBottom: 20 }}>{t('Game folder, mod status and maintenance.')}</p>
      {/* Two fixed columns rather than CSS columns. With `columns` the browser
          rebalances by height, so expanding the Health Check results shoved the
          Mod Management panel into the other column. Panels now stay where they
          are whatever their content does, and the grid falls back to a single
          column when the window is too narrow for two. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(520px, 1fr))', gap: 18, alignItems: 'start' }}>
        <div>
      <S title={t('Game Location')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1, padding: '10px 14px', background: 'var(--bg-base)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius)', fontSize: 14, fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: gamePath ? 'var(--text-2)' : 'var(--text-4)' }}>
            {gamePath || t('Not Installed')}
          </div>
          <button className="btn btn-ghost" onClick={onSetPath} >{t('Browse')}</button>
          <button className="btn btn-ghost" onClick={onDetect} >{t('Auto-Detect')}</button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-4)', lineHeight: 1.6 }}>
          {t('Point this to the folder containing "Card Shop Simulator.exe".')}<br />
          {t('Xbox Game Pass: this is the "Content" folder inside the install folder — mods must sit next to the .exe.')}
        </div>
      </S>
      <S title={t('Mod Status')}>
        {/* Game executable check — shown first because BepInEx (and every mod)
            is meaningless if the game folder itself is wrong. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span className={`dot ${bepinex.gameFound ? 'dot-ok' : 'dot-bad'}`} />
          <span style={{ fontSize: 15, fontWeight: 600 }}>
            {bepinex.gameFound ? t('Game detected') : t('Game not detected')}
          </span>
        </div>
        {!bepinex.gameFound && (
          <div style={{ fontSize: 14, color: 'var(--red-bright)', lineHeight: 1.7, marginBottom: 12 }}>
            {t('"Card Shop Simulator.exe" was not found in the selected folder. Mods cannot be installed until the game location is correct.')}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span className={`dot ${bepinex.installed ? 'dot-ok' : 'dot-bad'}`} />
          <span style={{ fontSize: 15, fontWeight: 600 }}>{bepinex.installed ? t('BepInEx Installed') : t('BepInEx Not Installed')}</span>
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.7, marginBottom: 12 }}>
          {bepinex.installed ? t('BepInEx is ready. Plugin mods should extract to "BepInEx / plugins".') : bepinex.reason}
        </div>
        {/* Live duplicate check — same treatment as the game and BepInEx rows,
            because a duplicate plugin DLL makes a mod look installed and enabled
            while BepInEx silently skips it. Refreshes with the rest of the
            status, not only when the Health Check is run. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span className={`dot ${bepinex.duplicateCount > 0 ? 'dot-bad' : 'dot-ok'}`} />
          <span style={{ fontSize: 15, fontWeight: 600 }}>
            {bepinex.duplicateCount > 0 ? t('Duplicate Mods Found') : t('No Duplicate Mods')}
          </span>
          {bepinex.duplicateCount > 0 && (
            <button className="btn btn-accent btn-sm" disabled={dupBusy} onClick={async () => {
              setDupBusy(true);
              const r = await window.api.removeDuplicatePlugins();
              await onSetBepinex();
              if (healthCheck) setHealthCheck(await window.api.bepinexHealthCheck());
              setDupBusy(false);
              if (r?.success) notify(`${r.removed.length} ${t('duplicate DLLs removed')}`, 'success');
              else notify(r?.error || t('Could not remove duplicates'), 'error');
            }}>{dupBusy && <span className="spinner" style={{ width: 13, height: 13 }} />}{t('Remove duplicates')}</button>
          )}
        </div>
        <div style={{ fontSize: 14, color: bepinex.duplicateCount > 0 ? 'var(--red-bright)' : 'var(--text-3)', lineHeight: 1.7, marginBottom: 12 }}>
          {bepinex.duplicateCount > 0
            ? `${t('More than one copy of')} ${(bepinex.duplicateDlls || []).join(', ')} ${t('is installed. BepInEx loads only one, so the mod can appear enabled while doing nothing.')}`
            : t('No plugin is installed twice.')}
        </div>
      </S>
      <S title={t('Mod Management')}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={() => window.api.openStagingFolder()} >{t('Open Staging Folder')}</button>
          <button className="btn btn-ghost" onClick={() => window.api.openGameFolder()} >{t('Open Game Folder')}</button>
          <button className="btn btn-ghost" onClick={() => window.api.openSavesFolder()} >{t('Open Save Game Folder')}</button>
        </div>
        <Opt title={t('Delete zip from staging folder after installing')}
          hint={t('When enabled, the .zip file is removed from the staging folder as soon as the mod is installed.')} last>
          <Toggle on={deleteAfterInstall} onChange={toggleDelete} label={t('Delete zip from staging folder after installing')} />
        </Opt>
        <div style={{ paddingTop: 14, borderTop: '1px solid var(--border)', marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <button className="btn btn-ghost" disabled={regroupBusy} onClick={doRegroupAll}>
              {regroupBusy && <span className="spinner" style={{ width: 13, height: 13 }} />}{t('Re-apply Auto-Grouping')}
            </button>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-4)' }}>
            {t('Re-runs author-detection rules (DraX / HellHound / Munchmatoast / Knarf247 / Main Core) against all currently-installed mods. Only moves ungrouped mods; manually-placed mods are preserved.')}
          </div>
        </div>
      </S>
        </div>
        <div>
      <S title={t('Health Check')}>
        <button className="btn btn-ghost" onClick={async () => { setHealthBusy(true); setHealthCheck(await window.api.bepinexHealthCheck()); setHealthBusy(false); }} disabled={healthBusy} style={{ borderColor: 'var(--green-bright)' }}>
          {healthBusy && <span className="spinner" style={{ width: 13, height: 13 }} />}{t('Health Check')}
        </button>
        {healthCheck && (
          <div style={{ marginTop: 12, padding: 14, background: 'var(--bg-base)', borderRadius: 'var(--radius)', border: `1px solid ${healthCheck.ok ? 'var(--green)' : 'var(--red)'}` }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: healthCheck.ok ? 'var(--green-bright)' : 'var(--red-bright)' }}>
              {healthCheck.ok ? t('All checks passed') : t('Issues found')}
            </div>
            {healthCheck.checks.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', fontSize: 13, borderBottom: i < healthCheck.checks.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>
                  {c.status === 'ok' ? (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--green-bright)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>) : c.status === 'warn' ? (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4l9 16H3z" /><path d="M12 10v4" /><path d="M12 17.5v.5" /></svg>) : (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--red-bright)" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>)}
                </span>
                <span style={{ fontFamily: 'var(--mono)', color: 'var(--text-2)', minWidth: 160 }}>{c.file}</span>
                <span style={{ color: c.status === 'ok' ? 'var(--text-4)' : c.status === 'warn' ? 'var(--accent)' : 'var(--red-bright)', flex: 1 }}>{c.detail}</span>
                {c.fixable === 'duplicate-dlls' && (
                  <button className="btn btn-accent btn-sm" disabled={healthBusy} onClick={async () => {
                    setHealthBusy(true);
                    const r = await window.api.removeDuplicatePlugins();
                    setHealthCheck(await window.api.bepinexHealthCheck());
                    setHealthBusy(false);
                    if (r?.success) notify(`${t('Removed')} ${r.removed.length} ${t('duplicate DLLs removed')}`, 'success');
                    else notify(r?.error || t('Could not remove duplicates'), 'error');
                  }}>{t('Remove duplicates')}</button>
                )}
              </div>
            ))}
            {!healthCheck.ok && (
              <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 10, lineHeight: 1.6 }}>
                {t('If BepInEx was working before, try restarting your PC. If files are missing, reinstall BepInEx from the Getting Started tab.')}
              </div>
            )}
          </div>
        )}
      </S>
      <S title={t('System')}>
        <Opt title={t('Minimize to system tray when closing')}
          hint={t('When enabled, closing the window hides the app to the system tray instead of quitting. Right-click the tray icon to quit.')}>
          <Toggle on={minimizeToTray} onChange={toggleTray} label={t('Minimize to system tray when closing')} />
        </Opt>
        <Opt title={t('Minimize button sends to system tray')}
          hint={t('When enabled, the minimize button hides the app to the system tray instead of the taskbar.')}>
          <Toggle on={minimizeBtnToTray} onChange={toggleBtnTray} label={t('Minimize button sends to system tray')} />
        </Opt>
        <Opt title={t('Open App Data Folder')} hint={t('Opens the folder where settings and mod database are stored.')} last>
          <button className="btn btn-ghost btn-sm" onClick={() => window.api.openAppDataFolder()}>{t('Open')}</button>
        </Opt>
      </S>
      <S title={t('Fresh Install')} danger>
        <div>
          {!confirmFresh ? (
            <button className="btn btn-danger" onClick={() => setConfirmFresh(true)}>
              {t('Fresh Install')}
            </button>
          ) : (
            <div style={{ padding: 14, background: 'var(--red-soft)', border: '1px solid var(--red-border)', borderRadius: 'var(--radius)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--red-bright)', marginBottom: 8 }}>
                {t('Are you sure?')}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 12, lineHeight: 1.6 }}>
                {t('This will delete everything in BepInEx except your config files. All mods will be removed and need to be reinstalled.')}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-danger" onClick={doFreshInstall} disabled={freshBusy}>
                  {freshBusy && <span className="spinner" style={{ width: 13, height: 13 }} />}{t('Yes, wipe everything')}
                </button>
                <button className="btn btn-ghost" onClick={() => setConfirmFresh(false)}>
                  {t('Cancel')}
                </button>
              </div>
            </div>
          )}
          <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 8 }}>
            {t('Removes all mods and BepInEx files. Your config files (.cfg) are preserved.')}
          </div>
        </div>
      </S>
      <S title={t('About')}>
        <div style={{ fontSize: 13, color: 'var(--text-4)', lineHeight: 1.9 }}>
          TCG Card Shop Mod Manager v{APP_VERSION} — {t('Portable Edition')}<br />
          {t('Local, offline mod manager. No API keys, no accounts, no tracking.')}<br />
          {t('Staging folder lives right next to the .exe')}
        </div>
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 10 }}>
            {t('Created by')} <strong style={{ color: 'var(--accent)' }}>iiTzSamurai</strong>
          </div>
          <button
            className="btn"
            onClick={() => window.api.openUrl('https://discord.gg/NHSvm22TSh')}
            style={{
              background: '#5865F2', color: '#fff', fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}>
            {t('Join Discord')}
          </button>
          <button
            className="btn"
            onClick={() => window.api.openUrl('https://www.paypal.com/ncp/payment/26PS2DCFDGQZG')}
            style={{
              background: '#0070ba', color: '#fff', fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 8,
            }}>
            {t('Donate')}
          </button>
          <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 10 }}>
            {t("Donations are not required but are very much appreciated!")}
          </div>
        </div>
      </S>
        </div>
      </div>
      </div>
    </div>
  );
}

/* Toggle switch. The old square checkbox with a tick glyph read as a form
   control; these rows are settings, so they get a switch. */
function Toggle({ on, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onChange}
      style={{ width: 46, height: 26, flexShrink: 0, borderRadius: 'var(--radius-pill)', position: 'relative',
        background: on ? 'var(--accent-soft)' : 'var(--bg-elevated)',
        border: `1px solid ${on ? 'var(--accent-border)' : 'var(--border-2)'}`, transition: 'background .15s, border-color .15s' }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 24 : 4, width: 18, height: 18, borderRadius: '50%',
        background: on ? 'var(--accent)' : 'var(--text-3)', transition: 'left .15s ease, background .15s' }} />
    </button>
  );
}

/* Title + explanation on the left, control on the right. */
function Opt({ title, hint, children, last }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      padding: '11px 0', borderBottom: last ? 'none' : '1px solid var(--border)' }}>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: 'var(--text)' }}>{title}</span>
        {hint && <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text-3)', marginTop: 2, lineHeight: 1.5 }}>{hint}</span>}
      </span>
      {children}
    </div>
  );
}

function S({ title, children, danger }) {
  // breakInside keeps a panel whole when the container splits into columns.
  return <div className="panel" style={{ marginBottom: 18, breakInside: 'avoid', WebkitColumnBreakInside: 'avoid',
    ...(danger ? { borderColor: 'var(--red-border)' } : null) }}>
    <h3 className="label" style={{ fontSize: 11, marginBottom: 14, color: danger ? 'var(--red-bright)' : undefined }}>{title}</h3>{children}
  </div>;
}
