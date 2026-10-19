import { useI18n } from '../i18n';
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
    id: 'home', labelKey: 'Home',
    icon: <><path d="M3 11l9-8 9 8" /><path d="M5 10v10h5v-6h4v6h5V10" /></>,
  },
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
    id: 'log', labelKey: 'Game Log', badge: 'logErrors',
    icon: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9l3 3-3 3" /><path d="M12 15h5" /></>,
  },
  {
    id: 'settings', labelKey: 'Settings',
    icon: <><circle cx="12" cy="12" r="3.2" /><path d="M19.1 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.2A1.6 1.6 0 0 0 4.3 7.4l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1.2z" /></>,
  },
];


export default function Sidebar({ view, onNav, modCount, enabledCount = 0, stagedCount, logErrors = 0, bepinex = {}, platform = null, onLaunch, appUpdate }) {
  const { t } = useI18n();
  const gameOk = bepinex.gameFound !== false;
  const platformText = !platform ? '' : platform.platform === 'gamepass' ? 'Xbox Game Pass'
    : platform.platform === 'steam' ? (platform.betaKey ? `Steam · ${platform.betaKey}` : t('Steam · default'))
    : '';

  return (
    <aside style={{ width: 234, flexShrink: 0, background: 'var(--bg-base)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '18px 12px' }}>

      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '2px 8px 20px' }}>
        <img src={logoImg} alt="" style={{ width: 44, height: 44, flexShrink: 0, objectFit: 'contain' }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.15 }}>Real TCG Overhaul</div>
          <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-4)', letterSpacing: .4 }}>MOD MANAGER</div>
        </div>
      </div>

      <div className="label" style={{ padding: '0 10px 8px' }}>{t('Library')}</div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {NAV.map(n => {
          const active = view === n.id;
          const badge = n.badge === 'mods' ? modCount : n.badge === 'staged' ? stagedCount : n.badge === 'logErrors' ? logErrors : 0;
          return (
            <button key={n.id} type="button" onClick={() => onNav(n.id)} className={`nav-item${active ? ' active' : ''}`}>
              <span style={{ display: 'flex', color: active ? 'var(--accent)' : 'inherit' }}><Icon path={n.icon} /></span>
              <span className="truncate">{t(n.labelKey)}</span>
              {badge > 0 && <span className="nav-count" style={n.badge === 'logErrors' ? { background: 'var(--red-soft)', color: 'var(--red-bright)', borderColor: 'var(--red-border)' } : undefined}>{badge}</span>}
            </button>
          );
        })}
      </nav>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Status at a glance: is the game found, is BepInEx in, how many mods
            are on. The same checks as Settings, visible from every page. */}
        <div style={{ borderRadius: 'var(--radius)', background: 'var(--bg-surface)', border: '1px solid var(--border)', overflow: 'hidden', fontSize: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', fontWeight: 600,
            background: gameOk ? 'var(--green-soft)' : 'var(--red-soft)', color: gameOk ? 'var(--green-bright)' : 'var(--red-bright)' }}>
            <span className={`dot ${gameOk ? 'dot-ok' : 'dot-bad'}`} />
            <span className="truncate" title={gameOk ? t('Game found') : undefined}>{gameOk ? (platformText || t('Game found')) : t('Game not detected')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderTop: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-3)' }}>BepInEx</span>
            <span style={{ color: bepinex.installed ? 'var(--text-2)' : 'var(--red-bright)' }}>{bepinex.installed ? (bepinex.version ? <span className="mono">v{bepinex.version}</span> : t('Installed')) : t('Missing')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderTop: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-3)' }}>{t('Mods Active')}</span>
            <span className="mono" style={{ color: 'var(--text-2)' }}>{enabledCount}</span>
          </div>
        </div>
        <button type="button" className="btn btn-accent" onClick={onLaunch}
          style={{ height: 46, justifyContent: 'center', fontSize: 15, fontWeight: 700, letterSpacing: .5 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4l13 8-13 8z" /></svg>
          {t('Play')}
        </button>

        {/* The manager's own update state. The label says "Mod Manager" so it is
            never mistaken for a mod update. */}
        {appUpdate ? (
          <button type="button" className="pill pill-info pill-pulse pill-btn"
            title={`v${appUpdate.installed} → v${appUpdate.latest} · ${t('Open on Nexus Mods')}`}
            onClick={() => window.api.openUrl(`https://www.nexusmods.com/tcgcardshopsimulator/mods/${appUpdate.modId}`)}
            style={{ width: '100%', justifyContent: 'center', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {t('Mod Manager Update Available')}
          </button>
        ) : (
          <span className="pill" style={{ width: '100%', justifyContent: 'center', gap: 6, color: 'var(--text-4)', whiteSpace: 'nowrap' }}>
            {t('Current Version')}
            <span className="mono" style={{ color: 'var(--accent)', fontWeight: 700 }}>{APP_VERSION}</span>
          </span>
        )}
      </div>
    </aside>
  );
}
