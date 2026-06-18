import { useState, useEffect } from 'react';
import { useI18n } from '../i18n';

export default function Settings({ gamePath, bepinex, onSetPath, onDetect, notify, onRefreshMods, onRefreshStaged, onSetBepinex }) {
  const { t } = useI18n();
  const [deleteAfterInstall, setDeleteAfterInstall] = useState(false);
  const [minimizeToTray, setMinimizeToTray] = useState(false);
  const [minimizeBtnToTray, setMinimizeBtnToTray] = useState(false);
  const [confirmFresh, setConfirmFresh] = useState(false);
  const [freshBusy, setFreshBusy] = useState(false);
  const [healthCheck, setHealthCheck] = useState(null);
  const [healthBusy, setHealthBusy] = useState(false);
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
      <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>⚙️ {t('Settings')}</h2>
      <S title={t('Game Location')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1, padding: '10px 14px', background: 'var(--bg-base)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius)', fontSize: 14, fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: gamePath ? 'var(--text-2)' : 'var(--text-4)' }}>
            {gamePath || t('Not Installed')}
          </div>
          <button className="btn btn-ghost" onClick={onSetPath} style={{ borderColor: 'var(--info)' }}>{t('Browse')}</button>
          <button className="btn btn-ghost" onClick={onDetect} style={{ borderColor: 'var(--accent)' }}>{t('Auto-Detect')}</button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-4)', lineHeight: 1.6 }}>{t('Point this to the folder containing "Card Shop Simulator.exe".')}</div>
      </S>
      <S title={t('BepInEx Status')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', background: bepinex.installed ? 'var(--green-bright)' : 'var(--red-bright)' }} />
          <span style={{ fontSize: 16, fontWeight: 600 }}>{bepinex.installed ? t('Installed ✓') : t('Not Installed')}</span>
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.7, marginBottom: 12 }}>
          {bepinex.installed ? t('BepInEx is ready. Plugin mods should extract to "BepInEx / plugins".') : bepinex.reason}
        </div>
        <button className="btn btn-ghost" onClick={async () => { setHealthBusy(true); setHealthCheck(await window.api.bepinexHealthCheck()); setHealthBusy(false); }} disabled={healthBusy} style={{ borderColor: 'var(--green-bright)' }}>
          {healthBusy ? '⏳' : '🩺'} {t('Health Check')}
        </button>
        {healthCheck && (
          <div style={{ marginTop: 12, padding: 14, background: 'var(--bg-base)', borderRadius: 'var(--radius)', border: `1px solid ${healthCheck.ok ? 'var(--green)' : 'var(--red)'}` }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: healthCheck.ok ? 'var(--green-bright)' : 'var(--red-bright)' }}>
              {healthCheck.ok ? `✅ ${t('All checks passed')}` : `❌ ${t('Issues found')}`}
            </div>
            {healthCheck.checks.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', fontSize: 13, borderBottom: i < healthCheck.checks.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>
                  {c.status === 'ok' ? '✅' : c.status === 'warn' ? '⚠️' : '❌'}
                </span>
                <span style={{ fontFamily: 'var(--mono)', color: 'var(--text-2)', minWidth: 160 }}>{c.file}</span>
                <span style={{ color: c.status === 'ok' ? 'var(--text-4)' : c.status === 'warn' ? 'var(--accent)' : 'var(--red-bright)', flex: 1 }}>{c.detail}</span>
              </div>
            ))}
            {!healthCheck.ok && (
              <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 10, lineHeight: 1.6 }}>
                {t('If BepInEx was working before, try restarting your PC. If files are missing, reinstall BepInEx from the Recommended Mods tab.')}
              </div>
            )}
          </div>
        )}
      </S>
      <S title={t('Mod Management')}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={() => window.api.openStagingFolder()} style={{ borderColor: 'var(--info)' }}>📂 {t('Open Staging Folder')}</button>
          <button className="btn btn-ghost" onClick={() => window.api.openGameFolder()} style={{ borderColor: 'var(--info)' }}>🎮 {t('Open Game Folder')}</button>
          <button className="btn btn-ghost" onClick={() => window.api.openSavesFolder()} style={{ borderColor: 'var(--info)' }}>💾 {t('Open Save Game Folder')}</button>
        </div>
        <label onClick={toggleDelete} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontSize: 15, color: 'var(--text-2)' }}>
          <div style={{ width: 20, height: 20, borderRadius: 3, border: '2px solid var(--border-2)', background: deleteAfterInstall ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0 }}>
            {deleteAfterInstall && <span style={{ color: 'var(--bg-deep)', fontSize: 14, fontWeight: 700 }}>✓</span>}
          </div>
          {t('Delete zip from staging folder after installing')}
        </label>
        <div style={{ fontSize: 13, color: 'var(--text-4)', marginTop: 6, marginLeft: 32, marginBottom: 18 }}>
          {t('When enabled, the .zip file is removed from the staging folder as soon as the mod is installed.')}
        </div>
        <div style={{ paddingTop: 14, borderTop: '1px solid var(--border)', marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <button className="btn btn-ghost" disabled={regroupBusy} onClick={doRegroupAll} style={{ borderColor: 'var(--accent)' }}>
              {regroupBusy ? '⏳' : '📁'} {t('Re-apply Auto-Grouping')}
            </button>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-4)' }}>
            {t('Re-runs author-detection rules (DraX / HellHound / Munchmatoast / Knarf247 / Main Core) against all currently-installed mods. Only moves ungrouped mods; manually-placed mods are preserved.')}
          </div>
        </div>
        <div style={{ paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          {!confirmFresh ? (
            <button className="btn btn-danger" onClick={() => setConfirmFresh(true)}>
              🔄 {t('Fresh Install')}
            </button>
          ) : (
            <div style={{ padding: 14, background: 'rgba(192,57,43,.1)', border: '1px solid var(--red)', borderRadius: 'var(--radius)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--red-bright)', marginBottom: 8 }}>
                ⚠️ {t('Are you sure?')}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 12, lineHeight: 1.6 }}>
                {t('This will delete everything in BepInEx except your config files. All mods will be removed and need to be reinstalled.')}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-danger" onClick={doFreshInstall} disabled={freshBusy}>
                  {freshBusy ? '⏳' : '🗑'} {t('Yes, wipe everything')}
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
      <S title={t('System')}>
        <label onClick={toggleTray} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontSize: 15, color: 'var(--text-2)' }}>
          <div style={{ width: 20, height: 20, borderRadius: 3, border: '2px solid var(--border-2)', background: minimizeToTray ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0 }}>
            {minimizeToTray && <span style={{ color: 'var(--bg-deep)', fontSize: 14, fontWeight: 700 }}>✓</span>}
          </div>
          {t('Minimize to system tray when closing')}
        </label>
        <div style={{ fontSize: 13, color: 'var(--text-4)', marginTop: 6, marginLeft: 32, marginBottom: 18 }}>
          {t('When enabled, closing the window hides the app to the system tray instead of quitting. Right-click the tray icon to quit.')}
        </div>
        <label onClick={toggleBtnTray} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontSize: 15, color: 'var(--text-2)' }}>
          <div style={{ width: 20, height: 20, borderRadius: 3, border: '2px solid var(--border-2)', background: minimizeBtnToTray ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0 }}>
            {minimizeBtnToTray && <span style={{ color: 'var(--bg-deep)', fontSize: 14, fontWeight: 700 }}>✓</span>}
          </div>
          {t('Minimize button sends to system tray')}
        </label>
        <div style={{ fontSize: 13, color: 'var(--text-4)', marginTop: 6, marginLeft: 32, marginBottom: 18 }}>
          {t('When enabled, the minimize button hides the app to the system tray instead of the taskbar.')}
        </div>
        <button className="btn btn-ghost" onClick={() => window.api.openAppDataFolder()} style={{ borderColor: 'var(--info)' }}>🗂️ {t('Open App Data Folder')}</button>
        <div style={{ fontSize: 13, color: 'var(--text-4)', marginTop: 6 }}>
          {t('Opens the folder where settings and mod database are stored.')}
        </div>
      </S>
      <S title={t('About')}>
        <div style={{ fontSize: 13, color: 'var(--text-4)', lineHeight: 1.9 }}>
          TCG Card Shop Mod Manager v1.0.5 — {t('Portable Edition')}<br />
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
            <span style={{ fontSize: 16 }}>💬</span> {t('Join Discord')}
          </button>
          <button
            className="btn"
            onClick={() => window.api.openUrl('https://www.paypal.com/ncp/payment/26PS2DCFDGQZG')}
            style={{
              background: '#0070ba', color: '#fff', fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 8,
            }}>
            <span style={{ fontSize: 16 }}>💖</span> {t('Donate')}
          </button>
          <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 10 }}>
            {t("Donations are not required but are very much appreciated!")}
          </div>
        </div>
      </S>
      </div>
    </div>
  );
}

function S({ title, children }) {
  return <div style={{ marginBottom: 20, padding: 20, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
    <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'var(--mono)' }}>{title}</h3>{children}
  </div>;
}
