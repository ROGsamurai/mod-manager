import { useState } from 'react';
import { useI18n, SUPPORTED_LOCALES } from '../i18n';
import { THEMES } from '../themes';

const NAV = [
  { id:'suggested', icon:'⭐', labelKey:'RECOMMENDED MODS' },
  { id:'staging', icon:'📥', labelKey:'DOWNLOADED MODS', badge:'staged' },
  { id:'mods', icon:'🔧', labelKey:'INSTALLED MODS', badge:'mods' },
  { id:'config', icon:'📝', labelKey:'CONFIG EDITOR' },
  { id:'profiles', icon:'📋', labelKey:'PROFILES' },
  { id:'settings', icon:'⚙️', labelKey:'SETTINGS' },
];

const darkThemes = THEMES.filter(t => t.group === 'dark');
const lightThemes = THEMES.filter(t => t.group === 'light');

export default function Sidebar({ view, onNav, modCount, stagedCount, themeId, onChangeTheme }) {
  const { t, locale, setLocale } = useI18n();
  const [h, setH] = useState(null);
  return (
    <aside style={{width:195,background:'var(--bg-base)',borderRight:'1px solid var(--border)',display:'flex',flexDirection:'column',flexShrink:0}}>
      <div style={{padding:'16px 14px 8px',fontSize:12,fontWeight:700,color:'var(--text-4)',letterSpacing:2,fontFamily:'var(--mono)'}}>{t('NAVIGATION')}</div>
      {NAV.map(n => {
        const active = view===n.id, hov = h===n.id;
        const badge = n.badge==='mods'?modCount:n.badge==='staged'?stagedCount:0;
        return (
          <div key={n.id} onClick={()=>onNav(n.id)} onMouseEnter={()=>setH(n.id)} onMouseLeave={()=>setH(null)}
            style={{padding:'11px 14px',display:'flex',alignItems:'center',gap:10,cursor:'pointer',fontSize:15,fontWeight:600,letterSpacing:.5,transition:'all .12s',
              color:active?'var(--accent)':'var(--text-2)',background:active||hov?'var(--bg-elevated)':'transparent',
              borderLeft:active?'3px solid var(--accent)':'3px solid transparent'}}>
            <span style={{fontSize:17,width:22,textAlign:'center'}}>{n.icon}</span><span>{t(n.labelKey)}</span>
            {badge>0&&<span style={{marginLeft:'auto',background:active?'var(--accent)':'var(--bg-active)',color:active?'var(--bg-deep)':'var(--text-2)',padding:'2px 8px',borderRadius:10,fontSize:13,fontWeight:700}}>{badge}</span>}
          </div>
        );
      })}
      <div style={{marginTop:'auto',padding:14,borderTop:'1px solid var(--border)'}}>
        <select value={locale} onChange={e=>setLocale(e.target.value)} style={{width:'100%',padding:'4px 6px',fontSize:12,background:'var(--bg-base)',color:'var(--text-3)',border:'1px solid var(--border)',borderRadius:'var(--radius)',cursor:'pointer',marginBottom:6}}>
          {SUPPORTED_LOCALES.map(l=><option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
        <select value={themeId} onChange={e=>onChangeTheme(e.target.value)} style={{width:'100%',padding:'4px 6px',fontSize:12,background:'var(--bg-base)',color:'var(--text-3)',border:'1px solid var(--border)',borderRadius:'var(--radius)',cursor:'pointer'}}>
          <optgroup label={`🌙 ${t('Dark')}`}>
            {darkThemes.map(th=><option key={th.id} value={th.id}>{th.name}</option>)}
          </optgroup>
          <optgroup label={`☀️ ${t('Light')}`}>
            {lightThemes.map(th=><option key={th.id} value={th.id}>{th.name}</option>)}
          </optgroup>
        </select>
        <div style={{fontSize:12,color:'var(--text-4)',fontFamily:'var(--mono)',marginTop:8,textAlign:'center'}}>v1.0.6</div>
      </div>
    </aside>
  );
}
