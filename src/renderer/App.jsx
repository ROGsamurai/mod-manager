import { useState, useEffect, useCallback } from 'react';
import { I18nProvider, useI18n } from './i18n';
import { applyTheme } from './themes';
import Sidebar from './components/Sidebar';
import SuggestedMods from './components/SuggestedMods';
import StagingView from './components/StagingView';
import InstalledMods from './components/InstalledMods';
import ProfileManager from './components/ProfileManager';
import ConfigEditor from './components/ConfigEditor';
import Settings from './components/Settings';
import logoImg from './assets/logo.png';

export default function App({ detectedLocale }) {
  return (
    <I18nProvider locale={detectedLocale}>
      <AppInner />
    </I18nProvider>
  );
}

function AppInner() {
  const { t } = useI18n();
  const [view, setView] = useState('suggested');
  const [mods, setMods] = useState([]);
  const [staged, setStaged] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [gamePath, setGamePath] = useState(null);
  const [bepinex, setBepinex] = useState({ installed: false });
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [themeId, setThemeId] = useState('midnight');
  const [installing, setInstalling] = useState(null);
  const [installProgress, setInstallProgress] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [toggleProgress, setToggleProgress] = useState(null);

  const changeTheme = (id) => { setThemeId(id); applyTheme(id); window.api.setTheme(id); };

  const notify = useCallback((msg, type = 'info') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3200); }, []);
  const refreshMods = async () => { setMods(await window.api.getInstalledMods()); setConflicts(await window.api.getConflicts()); };
  const refreshStaged = async () => { setStaged(await window.api.getStagedFiles()); };

  useEffect(() => {
    (async () => {
      try {
        const savedTheme = await window.api.getTheme();
        if (savedTheme) { setThemeId(savedTheme); applyTheme(savedTheme); }
        let gp = await window.api.getGamePath(); if (!gp) gp = await window.api.detectGame(); if (gp) setGamePath(gp);
        setBepinex(await window.api.getBepInExStatus()); await refreshMods(); await refreshStaged();
      } catch (e) { console.error(e); } finally { setLoading(false); }
    })();
  }, []);

  // First-time user: auto-navigate to suggested mods if nothing is installed
  useEffect(() => {
    if (!loading && mods.length === 0 && !bepinex.installed) setView('suggested');
  }, [loading]);
  useEffect(() => { window.api.onStagingChanged(files => setStaged(files)); }, []);
  useEffect(() => { window.api.onInstallProgress(data => setInstallProgress(data)); }, []);
  useEffect(() => {
    if (!window.api.onToggleProgress) return;
    const off = window.api.onToggleProgress(data => setToggleProgress(data));
    return off;
  }, []);

  // Grab-to-scroll: click and drag on non-interactive areas to scroll
  useEffect(() => {
    const interactive = 'A,BUTTON,INPUT,SELECT,TEXTAREA,LABEL';
    let scrollEl = null, startY = 0, startScroll = 0, dragging = false;
    const isInteractive = (el) => {
      while (el) {
        if (el.tagName && interactive.includes(el.tagName)) return true;
        if (el.getAttribute?.('draggable') === 'true') return true;
        if (el.classList?.contains('btn')) return true;
        if (el.type === 'checkbox') return true;
        el = el.parentElement;
      }
      return false;
    };
    const findScrollable = (el) => {
      while (el) {
        if (el.scrollHeight > el.clientHeight && getComputedStyle(el).overflowY !== 'hidden') return el;
        el = el.parentElement;
      }
      return null;
    };
    const onDown = (e) => {
      if (e.button !== 0) return;
      if (isInteractive(e.target)) return;
      const s = findScrollable(e.target);
      if (!s) return;
      scrollEl = s; startY = e.clientY; startScroll = s.scrollTop; dragging = false;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    };
    const onMove = (e) => {
      const dy = e.clientY - startY;
      if (!dragging && Math.abs(dy) > 3) { dragging = true; document.body.style.cursor = 'grabbing'; document.body.style.userSelect = 'none'; }
      if (dragging && scrollEl) scrollEl.scrollTop = startScroll - dy;
    };
    const onUp = () => {
      document.body.style.cursor = ''; document.body.style.userSelect = '';
      scrollEl = null; dragging = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, []);

  const handleInstall = async (filename, targetKey, modName, skipRemoval = false) => {
    setInstalling(filename);
    setInstallProgress({ percent: 0, done: 0, total: 0 });
    const r = await window.api.installMod(filename, targetKey, modName, skipRemoval);
    setInstalling(null);
    setInstallProgress(null);
    if (r.success) { notify(`${t('Install')}: "${r.mod.name}" → ${r.mod.targetLabel}`, 'success'); await refreshMods(); await refreshStaged(); setBepinex(await window.api.getBepInExStatus()); }
    else if (r.blocked) { notify(`🛑 ${r.error}`, 'error'); }
    else notify(r.error, 'error');
  };
  const handleToggle = async id => {
    if (togglingId) return; // ignore clicks while a toggle is in flight
    setTogglingId(id);
    setToggleProgress({ id, done: 0, total: 0 });
    try {
      const r = await window.api.toggleMod(id);
      if (r.success) { notify(`${r.mod.name} ${r.mod.enabled?t('Enabled'):t('Disabled')}`, r.mod.enabled?'success':'warn'); await refreshMods(); }
      else notify(r.error,'error');
    } finally {
      setTogglingId(null);
      setToggleProgress(null);
    }
  };
  const [pendingRemove, setPendingRemove] = useState(null);
  // Session-scoped flag: when user ticks "Ignore warning for the rest of this
  // session" on a prefab-mod removal confirmation, skip the warning modal for
  // every subsequent prefab removal. Resets to false on next app launch because
  // it's plain React state, never persisted.
  const [ignorePrefabWarning, setIgnorePrefabWarning] = useState(false);

  const handleRemove = async id => {
    const mod = mods.find(m => m.id === id);
    // Check if mod has _prefabloader files — warn about save corruption
    if (mod?.files?.some(f => f.toLowerCase().includes('_prefabloader'))) {
      if (ignorePrefabWarning) { await doRemove(id); return; }
      setPendingRemove(mod);
      return;
    }
    await doRemove(id);
  };
  const doRemove = async id => {
    const mod = mods.find(m => m.id === id);
    setTogglingId(id);
    setToggleProgress({ id, done: 0, total: 0 });
    try {
      const r = await window.api.uninstallMod(id);
      if (r.success) { notify(`${t('Remove')}: "${mod?.name}"`, 'warn'); await refreshMods(); await refreshStaged(); setBepinex(await window.api.getBepInExStatus()); }
      else notify(r.error, 'error');
    } finally {
      setTogglingId(null);
      setToggleProgress(null);
      setPendingRemove(null);
    }
  };
  const handleMarkCore = async (id, isCore, opts) => {
    // Bulk path: InstalledMods already called markCoreBulk and is telling us
    // via id=null to just refresh and notify generically.
    if (id == null && opts?.bulk) {
      notify(`${opts.count} mod(s) ${isCore ? t('Lock as core mod') : t('Unlock (allow toggling)')}`, 'info');
      await refreshMods();
      return;
    }
    const r = await window.api.markCore(id, isCore);
    if (r.success) { notify(`${r.mod.name} ${isCore?t('Lock as core mod'):t('Unlock (allow toggling)')}`, 'info'); await refreshMods(); }
    else notify(r.error,'error');
  };
  const handleAdd = async () => {
    const r = await window.api.addToStaging();
    if (r?.success) {
      const { added, skipped } = r;
      if (added?.length) notify(`${added.length} archive(s) added`, 'success');
      if (skipped?.length) notify(`${skipped.length} skipped`, 'warn');
      await refreshStaged();
    }
  };
  const handleLaunch = () => {
    window.api.launchGame();
    const isXbox = gamePath && (gamePath.toLowerCase().includes('xboxgames') || gamePath.toLowerCase().includes('windowsapps'));
    notify(isXbox ? t('Launching game...') : t('Launching via Steam...'), 'info');
  };

  if (loading) return (
    <div style={{height:'100vh',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:14}}>
      <div className="spinner" style={{width:36,height:36,borderWidth:3}}/><div style={{fontFamily:'var(--mono)',color:'var(--text-3)',fontSize:14}}>{t('Loading...')}</div>
    </div>
  );

  const enabledCount = mods.filter(m => m.enabled).length;
  return (
    <div style={{ display:'flex',flexDirection:'column',height:'100vh' }}>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      {pendingRemove && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.65)' }}>
          <div style={{ background: 'var(--bg-elevated)', border: '2px solid var(--red)', borderRadius: 'var(--radius-lg)', padding: 28, maxWidth: 460, width: '90%', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>⚠️</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>{t('Are you sure?')}</div>
            <div style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.7, marginBottom: 20 }}>
              {t('Anything still left in your store from this mod will corrupt your save data if you didn\'t remove the items first from within your game!')}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)', marginBottom: 20 }}>"{pendingRemove.name}"</div>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, color: 'var(--text-3)', marginBottom: 16, cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={ignorePrefabWarning} onChange={e => setIgnorePrefabWarning(e.target.checked)} style={{ cursor: 'pointer', width: 15, height: 15 }} />
              {t('Ignore warning for the rest of this session')}
            </label>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-ghost" onClick={() => setPendingRemove(null)} style={{ padding: '8px 24px' }}>{t('Cancel')}</button>
              <button className="btn btn-danger" onClick={() => doRemove(pendingRemove.id)} style={{ padding: '8px 24px' }}>🗑 {t('Remove Anyway')}</button>
            </div>
          </div>
        </div>
      )}

      <header className="drag-region" style={{
        display:'flex',justifyContent:'space-between',alignItems:'center',
        background:'var(--bg-elevated)',padding:'0 0 0 18px',
        borderBottom:'2px solid var(--accent)',height:56,flexShrink:0,
      }}>
        <div className="no-drag" style={{display:'flex',alignItems:'center',gap:10}}>
          <img src={logoImg} alt="Logo" style={{width:44,height:44,objectFit:'contain',flexShrink:0}} />
          <div>
            <div style={{fontSize:20,fontWeight:700,color:'var(--text)',letterSpacing:.5}}>TCG Card Shop Simulator</div>
            <div style={{fontSize:11,color:'var(--accent)',textTransform:'uppercase',letterSpacing:3,fontFamily:'var(--mono)'}}>Mod Manager</div>
          </div>
        </div>
        <div className="no-drag" style={{display:'flex',alignItems:'center',gap:12}}>
          <span className="badge" style={{background:'var(--bg-active)',color:'var(--text-2)'}}>{mods.length} {t('mods')}</span>
          <span className="badge" style={{background:'var(--green)',color:'#fff'}}>{enabledCount} {t('active')}</span>
          {staged.length>0&&<span className="badge" style={{background:'var(--accent)',color:'var(--bg-deep)'}}>{staged.length} {t('staged')}</span>}
          {conflicts.length>0&&<span className="badge" style={{background:'var(--red)',color:'#fcc'}}>{conflicts.length} {t('conflicts')}</span>}
          <button className="btn btn-accent" onClick={handleLaunch}>▶ {t('Play')}</button>
        </div>
        <div className="no-drag" style={{display:'flex',height:'100%'}}>
          <WinBtn onClick={()=>window.api.minimize()}>─</WinBtn>
          <WinBtn onClick={()=>window.api.maximize()}>☐</WinBtn>
          <WinBtn onClick={()=>window.api.close()} close>✕</WinBtn>
        </div>
      </header>

      <div style={{display:'flex',flex:1,minHeight:0}}>
        <Sidebar view={view} onNav={setView} modCount={mods.length} stagedCount={staged.length} themeId={themeId} onChangeTheme={changeTheme} />
        <main style={{flex:1,display:'flex',flexDirection:'column',minWidth:0,overflow:'auto',background:'var(--bg-surface)'}}>
          {view==='suggested'&&<SuggestedMods/>}
          {view==='staging'&&<StagingView staged={staged} onInstall={handleInstall} onAdd={handleAdd} onRefresh={refreshStaged} notify={notify} installing={installing} installProgress={installProgress}/>}
          {view==='mods'&&<InstalledMods mods={mods} conflicts={conflicts} onToggle={handleToggle} onRemove={handleRemove} onMarkCore={handleMarkCore} togglingId={togglingId} toggleProgress={toggleProgress}/>}
          {view==='config'&&<ConfigEditor notify={notify}/>}
          {view==='profiles'&&<ProfileManager notify={notify} onRefresh={refreshMods}/>}
          {view==='settings'&&<Settings gamePath={gamePath} bepinex={bepinex}
            notify={notify} onRefreshMods={refreshMods} onRefreshStaged={refreshStaged}
            onSetBepinex={async()=>setBepinex(await window.api.getBepInExStatus())}
            onSetPath={async()=>{const p=await window.api.openFolderDialog();if(p){await window.api.setGamePath(p);setGamePath(p);setBepinex(await window.api.getBepInExStatus());notify('Game path set','success');}}}
            onDetect={async()=>{const p=await window.api.detectGame();if(p){setGamePath(p);setBepinex(await window.api.getBepInExStatus());notify('Game found!','success');}else notify('Could not auto-detect.','error');}}/>}
        </main>
      </div>
    </div>
  );
}

function WinBtn({children,onClick,close}){
  const [h,setH]=useState(false);
  return <button onClick={onClick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
    style={{width:48,height:'100%',display:'flex',alignItems:'center',justifyContent:'center',
      background:h?(close?'#e81123':'var(--bg-hover)'):'transparent',
      color:h&&close?'#fff':'var(--text-4)',fontSize:15,transition:'all .1s'}}>{children}</button>;
}
