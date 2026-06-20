import { useState, useEffect } from 'react';
import { useI18n } from '../i18n';

export default function ProfileManager({ notify, onRefresh }) {
  const { t } = useI18n();
  const [profiles, setProfiles] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [activateProgress, setActivateProgress] = useState(null);

  useEffect(() => {
    if (!window.api.onProfileProgress) return;
    const off = window.api.onProfileProgress(data => setActivateProgress(data));
    return off;
  }, []);

  const load = async () => {
    try {
      setProfiles(await window.api.getProfiles());
      setActiveId(await window.api.getActiveProfile());
    } catch (e) { console.error('[ProfileManager.load]', e); }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!newName.trim()) return;
    await window.api.createProfile(newName.trim());
    setNewName(''); await load();
    notify(`${newName.trim()} saved`, 'success');
  };
  const activate = async id => {
    setBusy(true);
    setActivateProgress(null);
    try {
      const r = await window.api.activateProfile(id);
      if (r.success) { notify('Profile activated!', 'success'); await onRefresh(); await load(); }
      else notify(r.error, 'error');
    } finally {
      setBusy(false);
      setActivateProgress(null);
    }
  };
  const remove = async (id, name) => { await window.api.deleteProfile(id); await load(); notify(`${t('Remove')}: "${name}"`, 'warn'); };
  const doExport = async (id) => {
    const r = await window.api.exportProfile(id);
    if (r.success) notify(t('Profile exported!'), 'success');
  };
  const doImport = async () => {
    const r = await window.api.importProfile();
    if (r.success) { await load(); notify(`${t('Profile imported')}: "${r.name}"`, 'success'); }
    else if (r.error) notify(r.error, 'error');
  };

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 24, maxWidth: 600 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>📋 {t('Mod Profiles')}</h2>
      <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 20, lineHeight: 1.6 }}>
        {t('Save which mods are on/off. Switch between setups instantly.')}
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, padding: 16, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
        <input className="input" placeholder={t('New profile name...')} value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && create()} style={{ flex: 1 }} />
        <button className="btn btn-accent" onClick={create}>{t('+ Save Current')}</button>
        <button className="btn btn-ghost" onClick={doImport}>📥 {t('Import')}</button>
      </div>
      {profiles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-3)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 40, marginBottom: 10, opacity: .3 }}>📋</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{t('No profiles yet')}</div>
          <div style={{ fontSize: 14, marginTop: 4, color: 'var(--text-4)' }}>{t('Create one to snapshot your current setup.')}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {profiles.map(p => {
            const isActive = p.id === activeId;
            return (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: 16,
                background: isActive ? 'rgba(92,185,80,.08)' : 'var(--bg-elevated)',
                borderRadius: 'var(--radius)',
                border: isActive ? '1px solid var(--green)' : '1px solid var(--border)',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>{p.name}</div>
                    {isActive && (
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                        background: 'var(--green)', color: '#fff', textTransform: 'uppercase', letterSpacing: 1,
                      }}>
                        ● {t('Active')}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-4)', marginTop: 2 }}>{p.mods?.length || 0} {t('mods')} · {new Date(p.createdAt).toLocaleDateString()}</div>
                </div>
                {isActive ? (
                  <button className="btn btn-ghost btn-sm" disabled style={{ opacity: .6, cursor: 'default' }}>
                    ✓ {t('Activated')}
                  </button>
                ) : (
                  <button className="btn btn-accent btn-sm" onClick={() => activate(p.id)} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 96, justifyContent: 'center' }}>
                    {busy && activateProgress ? (
                      <>
                        <span style={{ display: 'inline-block', width: 11, height: 11, border: '2px solid rgba(255,255,255,.35)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .6s linear infinite' }} />
                        {activateProgress.total > 0 ? `${activateProgress.current}/${activateProgress.total}` : '…'}
                      </>
                    ) : busy ? '…' : `▶ ${t('Activate')}`}
                  </button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => doExport(p.id)} title={t('Export')} disabled={busy}>📤</button>
                <button className="btn btn-danger btn-sm" onClick={() => remove(p.id, p.name)} disabled={busy}>🗑</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
