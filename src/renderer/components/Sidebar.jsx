import { useI18n, SUPPORTED_LOCALES } from '../i18n';
import { THEMES } from '../themes';
import { APP_VERSION } from '../version';
import logoImg from '../assets/logo.png';

/* Stroke icons, sized and coloured by the surrounding text so they inherit the
   active/hover states without extra wiring. Replaces the emoji set: emoji render
   at different sizes per platform and ignore the theme entirely. */
const Icon = ({ path, size = 17 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    style={{ flexShrink: 0 }}>
    {path}
  </svg>
);

const NAV = [
  {
    id: 'suggested', labelKey: 'Getting Started',
    icon: <path d="M12 3l2.6 5.6 6.1.8-4.5 4.2 1.2 6L12 16.8 6.6 19.6l1.2-6L3.3 9.4l6.1-.8z" />,
  },
  {
    id: 'staging', labelKey: 'Staged', badge: 'staged',
    icon: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></>,
  },
  {
    id: 'mods', labelKey: 'Installed', badge: 'mods',
    icon: <><path d="M20 7h-9" /><path d="M14 17H5" /><circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" /></>,
  },
  {
    id: 'config', labelKey: 'Config Editor',
    icon: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 9h8" /><path d="M8 13h5" /></>,
  },
  {
    id: 'profiles', labelKey: 'Profiles',
    icon: <><path d="M4 5h12" /><path d="M4 12h16" /><path d="M4 19h9" /></>,
  },
  {
    id: 'settings', labelKey: 'Settings',
    icon: <><circle cx="12" cy="12" r="3.2" /><path d="M19.1 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.2A1.6 1.6 0 0 0 4.3 7.4l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1.2z" /></>,
  },
];

const darkThemes = THEMES.filter(t => t.group === 'dark');
const lightThemes = THEMES.filter(t => t.group === 'light');

export default function Sidebar({ view, onNav, modCount, stagedCount, themeId, onChangeTheme, appUpdate }) {
  const { t, locale, setLocale } = useI18n();

  return (
    <aside style={{ width: 234, flexShrink: 0, background: 'var(--bg-base)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '18px 12px' }}>

      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '2px 8px 20px' }}>
        <img src={logoImg} alt="" style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 11, objectFit: 'cover' }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.15 }}>Real TCG Overhaul</div>
          <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-4)', letterSpacing: .4 }}>MOD MANAGER</div>
        </div>
      </div>

      <div className="label" style={{ padding: '0 10px 8px' }}>{t('Library')}</div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {NAV.map(n => {
          const active = view === n.id;
          const badge = n.badge === 'mods' ? modCount : n.badge === 'staged' ? stagedCount : 0;
          return (
            <button key={n.id} type="button" onClick={() => onNav(n.id)} className={`nav-item${active ? ' active' : ''}`}>
              <span style={{ display: 'flex', color: active ? 'var(--accent)' : 'inherit' }}><Icon path={n.icon} /></span>
              <span className="truncate">{t(n.labelKey)}</span>
              {badge > 0 && <span className="nav-count">{badge}</span>}
            </button>
          );
        })}
      </nav>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label className="label" htmlFor="sb-lang" style={{ paddingLeft: 2 }}>{t('Language')}</label>
          <select id="sb-lang" className="select" style={{ width: '100%', padding: '8px 10px', fontSize: 13 }}
            value={locale} onChange={e => setLocale(e.target.value)}>
            {SUPPORTED_LOCALES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>

          <label className="label" htmlFor="sb-theme" style={{ paddingLeft: 2, marginTop: 2 }}>{t('Theme')}</label>
          <select id="sb-theme" className="select" style={{ width: '100%', padding: '8px 10px', fontSize: 13 }}
            value={themeId} onChange={e => onChangeTheme(e.target.value)}>
            <optgroup label={t('Dark')}>
              {darkThemes.map(th => <option key={th.id} value={th.id}>{th.name}</option>)}
            </optgroup>
            <optgroup label={t('Light')}>
              {lightThemes.map(th => <option key={th.id} value={th.id}>{th.name}</option>)}
            </optgroup>
          </select>
        </div>

        {/* Same chip as a mod's version in Installed Mods, so the manager's
            own version reads the same way as everything else. */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '0 4px' }}>
          <span className="badge badge-accent">{APP_VERSION}</span>
        </div>
        {/* The manager's own update state. The label says "Mod Manager" so it is
            never mistaken for a mod update. */}
        {appUpdate ? (
          <button type="button" className="pill pill-info pill-pulse"
            title={`v${appUpdate.installed} → v${appUpdate.latest} · ${t('Open on Nexus Mods')}`}
            onClick={() => window.api.openUrl(`https://www.nexusmods.com/tcgcardshopsimulator/mods/${appUpdate.modId}`)}
            style={{ width: '100%', justifyContent: 'center', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {t('Mod Manager Update Available')}
          </button>
        ) : (
          <span className="pill" style={{ width: '100%', justifyContent: 'center', color: 'var(--text-4)' }}>
            {t('Current Version')}
          </span>
        )}
      </div>
    </aside>
  );
}
