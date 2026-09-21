import { useState, useEffect } from 'react';
import { useI18n } from '../i18n';

export default function ProfileManager({ notify, onRefresh, mods = [] }) {
  const { t } = useI18n();
  const [profiles, setProfiles] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [activateProgress, setActivateProgress] = useState(null);
  const [editing, setEditing] = useState(null);      // profile id whose mods are open
  const [picked, setPicked] = useState(new Set());   // working set while editing
  const [saving, setSaving] = useState(false);

  // A profile is the set of mods that should be ON. Older profiles stored a
  // snapshot of every mod's state instead, so read either shape.
  const enabledIdsOf = p => Array.isArray(p.enabledIds)
    ? p.enabledIds
    : (p.mods || []).filter(m => m.enabled).map(m => m.id);

  const startEdit = p => { setEditing(p.id); setPicked(new Set(enabledIdsOf(p))); };
  const togglePick = id => setPicked(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const saveMods = async id => {
    setSaving(true);
    const r = await window.api.setProfileMods(id, [...picked]);
    setSaving(false);
    if (!r?.success) { notify(r?.error || t('Could not save'), 'error'); return; }
    setEditing(null);
    await load();
    // Editing the profile that is currently in use has to take effect now.
    // Saving alone only rewrites the list, so a mod removed from an active
    // profile would stay enabled until it was activated again.
    if (id === activeId) await activate(id);
    else notify(t('Profile updated'), 'success');
  };

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
    const created = await window.api.createProfile(newName.trim());
    setNewName(''); await load();
    // A new profile is empty by design, so go straight to choosing its mods
    // rather than leaving something that would disable everything.
    if (created?.id) { setEditing(created.id); setPicked(new Set()); }
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
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>{t('Mod Profiles')}</h2>
      <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 20, lineHeight: 1.6 }}>
        {t('Save which mods are on/off. Switch between setups instantly.')}
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, padding: 16, background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
        <input className="input" placeholder={t('New profile name...')} value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && create()} style={{ flex: 1 }} />
        <button className="btn btn-accent" onClick={create}>{t('+ Save Current')}</button>
        <button className="btn btn-ghost" onClick={doImport}>{t('Import')}</button>
      </div>
      {profiles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-3)', background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
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
                background: isActive ? 'var(--green-soft)' : 'var(--bg-surface)',
                borderRadius: 'var(--radius-lg)',
                border: isActive ? '1px solid var(--green-border)' : '1px solid var(--border)',
                overflow: 'hidden',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
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
                  <div style={{ fontSize: 13, color: 'var(--text-4)', marginTop: 2 }}>
                    {enabledIdsOf(p).length} {t('of')} {mods.length} {t('mods enabled')} · {new Date(p.createdAt).toLocaleDateString()}
                  </div>
                </div>
                {isActive ? (
                  <button className="btn btn-ghost btn-sm" onClick={() => activate(p.id)} disabled={busy}
                    title={t('Apply this profile again')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 96, justifyContent: 'center' }}>
                    {busy && activateProgress ? (
                      <>
                        <span className="spinner" style={{ width: 11, height: 11 }} />
                        {activateProgress.total > 0 ? `${activateProgress.current}/${activateProgress.total}` : '…'}
                      </>
                    ) : busy ? '…' : t('Re-apply')}
                  </button>
                ) : (
                  <button className="btn btn-accent btn-sm" onClick={() => activate(p.id)} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 96, justifyContent: 'center' }}>
                    {busy && activateProgress ? (
                      <>
                        <span style={{ display: 'inline-block', width: 11, height: 11, border: '2px solid rgba(255,255,255,.35)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .6s linear infinite' }} />
                        {activateProgress.total > 0 ? `${activateProgress.current}/${activateProgress.total}` : '…'}
                      </>
                    ) : busy ? '…' : `${t('Activate')}`}
                  </button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => editing === p.id ? setEditing(null) : startEdit(p)} disabled={busy}>
                  {editing === p.id ? t('Close') : t('Edit Mods')}
                </button>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => doExport(p.id)} title={t('Export')} aria-label={t('Export')} disabled={busy}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12" /><path d="M7 8l5-5 5 5" /><path d="M4 17v3h16v-3" /></svg>
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => remove(p.id, p.name)} disabled={busy}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16" /><path d="M9 7V5h6v2" /><path d="M6 7l1 13h10l1-13" /></svg></button>
              </div>

              {/* Membership editor. Ticking a mod means "this profile turns it
                  on"; everything unticked is turned off when the profile is
                  activated, including mods installed after it was created. */}
              {editing === p.id && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                    <span className="label">{t('Mods in this profile')}</span>
                    <span className="pill">{picked.size} {t('of')} {mods.length}</span>
                    <div style={{ flex: 1 }} />
                    <button className="btn btn-ghost btn-sm" onClick={() => setPicked(new Set(mods.map(m => m.id)))}>{t('All')}</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setPicked(new Set())}>{t('None')}</button>
                    <button className="btn btn-accent btn-sm" onClick={() => saveMods(p.id)} disabled={saving}>
                      {saving && <span className="spinner" style={{ width: 13, height: 13 }} />}{t('Save')}
                    </button>
                  </div>

                  <div style={{ maxHeight: 320, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-deep)' }}>
                    {mods.length === 0 && (
                      <div style={{ padding: 16, fontSize: 13, color: 'var(--text-4)' }}>{t('No mods installed')}</div>
                    )}
                    {mods.map(m => (
                      <label key={m.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                        borderBottom: '1px solid var(--border)', cursor: 'pointer',
                      }}>
                        <input type="checkbox" checked={picked.has(m.id)}
                          onChange={() => togglePick(m.id)} style={{ width: 15, height: 15, accentColor: 'var(--accent)' }} />
                        <span style={{ flex: 1, minWidth: 0, fontSize: 14 }}>{m.name}</span>
                        {m.core && <span className="pill pill-accent">{t('Core')}</span>}
                        {m.version && <span className="badge">{m.version}</span>}
                      </label>
                    ))}
                  </div>
                  {mods.some(m => m.core && !picked.has(m.id)) && (
                    <div style={{ fontSize: 12.5, color: 'var(--accent)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4l9 16H3z" /><path d="M12 10v4" /><path d="M12 17.5v.5" /></svg>
                      {t('This profile turns off a core mod. Without BepInEx the game loads no mods at all.')}
                    </div>
                  )}
                </div>
              )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
