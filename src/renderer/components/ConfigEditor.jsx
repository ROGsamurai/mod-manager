import { useState, useEffect } from 'react';
import { useI18n } from '../i18n';

export default function ConfigEditor({ notify }) {
  const { t } = useI18n();
  const [files, setFiles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [config, setConfig] = useState(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(null);

  useEffect(() => { window.api.getConfigFiles().then(setFiles).catch(e => console.error('[getConfigFiles]', e)); }, []);

  const loadFile = async (filename) => {
    setSelected(filename);
    const r = await window.api.readConfigFile(filename);
    if (r.success) setConfig(r.config);
    else { notify(r.error, 'error'); setConfig(null); }
  };

  const saveValue = async (section, key, value) => {
    setSaving(`${section}.${key}`);
    const r = await window.api.saveConfigValue(selected, section, key, String(value));
    if (r.success) notify(`${key} = ${value}`, 'success');
    else notify(r.error, 'error');
    setSaving(null);
  };

  const filteredSections = config?.sections?.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.entries.some(e => e.key.toLowerCase().includes(search.toLowerCase()) || e.description.toLowerCase().includes(search.toLowerCase()))
  ) || [];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>⚙️ {t('Config Editor')}</div>
        <div style={{ fontSize: 14, color: 'var(--text-3)', marginTop: 2 }}>{t('Edit BepInEx mod configuration files directly.')}</div>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* File list sidebar */}
        <div style={{ width: 260, borderRight: '1px solid var(--border)', overflowY: 'auto', background: 'var(--bg-base)', flexShrink: 0 }}>
          <div style={{ padding: '10px 12px', fontSize: 12, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 1 }}>
            {t('Config Files')} ({files.length})
          </div>
          {files.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-4)', fontSize: 13 }}>
              {t('No config files found. Install BepInEx mods first.')}
            </div>
          ) : files.map(f => (
            <div key={f.name} onClick={() => loadFile(f.name)}
              style={{
                padding: '8px 12px', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--mono)',
                borderLeft: selected === f.name ? '3px solid var(--accent)' : '3px solid transparent',
                background: selected === f.name ? 'var(--bg-elevated)' : 'transparent',
                color: selected === f.name ? 'var(--accent)' : 'var(--text-3)',
                transition: 'all .1s', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
              {f.name.replace('.cfg', '')}
            </div>
          ))}
        </div>

        {/* Editor panel */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 0 }}>
          {!config ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-4)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 44, opacity: .3, marginBottom: 10 }}>📝</div>
                <div style={{ fontSize: 16 }}>{t('Select a config file to edit')}</div>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{selected}</span>
                  <input className="input" placeholder={t('Search settings...')} value={search} onChange={e => setSearch(e.target.value)}
                    style={{ flex: 1, maxWidth: 300, padding: '5px 10px', fontSize: 13 }} />
                </div>
              </div>
              {filteredSections.map(section => (
                <div key={section.name} style={{ borderBottom: '1px solid var(--border)' }}>
                  <div style={{ padding: '10px 20px', background: 'var(--bg-elevated)', fontSize: 14, fontWeight: 700, color: 'var(--text-2)', fontFamily: 'var(--mono)' }}>
                    [{section.name}]
                  </div>
                  {section.entries.filter(e =>
                    !search || e.key.toLowerCase().includes(search.toLowerCase()) || e.description.toLowerCase().includes(search.toLowerCase())
                  ).map(entry => (
                    <ConfigEntry key={`${section.name}.${entry.key}`} entry={entry} section={section.name}
                      saving={saving === `${section.name}.${entry.key}`} onSave={saveValue} />
                  ))}
                </div>
              ))}
              {filteredSections.length === 0 && (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-4)' }}>{t('No settings match your search')}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ConfigEntry({ entry, section, saving, onSave }) {
  const [val, setVal] = useState(entry.value);
  const changed = val !== entry.value;

  const handleSave = () => { onSave(section, entry.key, val); entry.value = val; };

  return (
    <div style={{ padding: '10px 20px', display: 'flex', alignItems: 'flex-start', gap: 16, borderBottom: '1px solid var(--border)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--mono)' }}>{entry.key}</div>
        {entry.description && (
          <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 3, lineHeight: 1.5 }}>
            {entry.description.split('\n').filter(l => !l.startsWith('Setting type') && !l.startsWith('Default value')).join(' ').trim()}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {entry.type === 'boolean' ? (
          <div onClick={() => { const nv = val === 'true' ? 'false' : 'true'; setVal(nv); onSave(section, entry.key, nv); entry.value = nv; }}
            style={{
              width: 44, height: 24, borderRadius: 12, cursor: 'pointer', transition: 'all .15s', position: 'relative',
              background: val === 'true' ? 'var(--green)' : 'var(--bg-active)',
            }}>
            <div style={{
              width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3,
              left: val === 'true' ? 23 : 3, transition: 'left .15s',
            }} />
          </div>
        ) : entry.type === 'select' && entry.acceptable ? (
          <select className="select" value={val} onChange={e => { setVal(e.target.value); onSave(section, entry.key, e.target.value); entry.value = e.target.value; }}
            style={{ fontSize: 13, padding: '4px 8px', minWidth: 120 }}>
            {entry.acceptable.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        ) : entry.type === 'number' && entry.range ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="range" min={entry.range.min} max={entry.range.max}
              step={Number.isInteger(entry.range.min) && Number.isInteger(entry.range.max) ? 1 : 0.1}
              value={val} onChange={e => setVal(e.target.value)}
              onMouseUp={() => { onSave(section, entry.key, val); entry.value = val; }}
              style={{ width: 100 }} />
            <span style={{ fontSize: 13, fontFamily: 'var(--mono)', color: 'var(--text-3)', minWidth: 40, textAlign: 'right' }}>{val}</span>
          </div>
        ) : (
          <>
            <input className="input" value={val} onChange={e => setVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && changed) handleSave(); }}
              style={{ width: 160, fontSize: 13, padding: '4px 8px', borderColor: changed ? 'var(--accent)' : undefined }} />
            {changed && (
              <button className="btn btn-accent btn-sm" onClick={handleSave} disabled={saving} style={{ padding: '3px 10px', fontSize: 12 }}>
                {saving ? '⏳' : '✓'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
