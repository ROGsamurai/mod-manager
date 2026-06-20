import { useState, useMemo, useEffect } from 'react';
import { useI18n } from '../i18n';

export default function InstalledMods({ mods, conflicts, onToggle, onRemove, onMarkCore, togglingId, toggleProgress }) {
  const { t, tMod } = useI18n();
  const [search, setSearch] = useState('');
  const [statusF, setStatusF] = useState('All');
  const [targetF, setTargetF] = useState('All');
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [depWarnings, setDepWarnings] = useState([]);
  const [groups, setGroups] = useState([]);
  const [collapsed, setCollapsed] = useState(new Set());
  const [newGroupName, setNewGroupName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [editName, setEditName] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [dragGroupId, setDragGroupId] = useState(null);
  const [dragOverGroupId, setDragOverGroupId] = useState(null);

  useEffect(() => { window.api.checkDependencies().then(setDepWarnings).catch(e => console.error('[checkDependencies]', e)); }, [mods]);
  useEffect(() => { window.api.getModGroups().then(setGroups).catch(e => console.error('[getModGroups]', e)); }, [mods]);
  useEffect(() => { window.api.getCollapsedGroups().then(ids => setCollapsed(new Set(ids || []))).catch(e => console.error('[getCollapsedGroups]', e)); }, []);

  const conflictIds = useMemo(() => { const s = new Set(); conflicts.forEach(c => c.mods.forEach(m => s.add(m.modId))); return s; }, [conflicts]);
  const depMap = useMemo(() => { const m = {}; depWarnings.forEach(w => { if (!m[w.modId]) m[w.modId] = []; m[w.modId].push(w.missingDep); }); return m; }, [depWarnings]);
  const uniqueTargets = useMemo(() => ['All', ...new Set(mods.map(m => m.targetLabel).filter(Boolean))], [mods]);

  // Pin "Main Core Mods" to the top regardless of stored group order.
  // The user can still reorder other groups freely; Main Core always stays first.
  const displayGroups = useMemo(() => {
    const pinned = groups.filter(g => g.name === 'Main Core Mods');
    const rest = groups.filter(g => g.name !== 'Main Core Mods');
    return [...pinned, ...rest];
  }, [groups]);

  const filtered = useMemo(() => mods.filter(m => {
    if (statusF === 'Enabled' && !m.enabled) return false;
    if (statusF === 'Disabled' && m.enabled) return false;
    if (targetF !== 'All' && m.targetLabel !== targetF) return false;
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [mods, statusF, targetF, search]);

  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    return [...filtered].sort((a, b) => {
      let av = a[sortCol] ?? '', bv = b[sortCol] ?? '';
      if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
      return sortDir === 'asc' ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1);
    });
  }, [filtered, sortCol, sortDir]);

  const doSort = c => { if (sortCol === c) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol(c); setSortDir('asc'); } };
  const arrow = c => sortCol === c ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : ' \u21C5';

  const groupedModIds = useMemo(() => {
    const s = new Set();
    groups.forEach(g => g.modIds.forEach(id => s.add(id)));
    return s;
  }, [groups]);
  const ungroupedMods = useMemo(() => sorted.filter(m => !groupedModIds.has(m.id)), [sorted, groupedModIds]);

  const toggleCollapse = id => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    window.api.setCollapsedGroups([...next]);
    return next;
  });

  const toggleSelect = id => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const selectAll = () => { if (selected.size === sorted.length) setSelected(new Set()); else setSelected(new Set(sorted.map(m => m.id))); };

  const createGroup = async () => {
    if (!newGroupName.trim()) return;
    await window.api.createModGroup(newGroupName.trim());
    setNewGroupName(''); setShowCreate(false);
    setGroups(await window.api.getModGroups());
  };

  // Lock/Unlock All: apply core status to every mod currently passing the
  // filters (status/search/target). Uses a single bulk IPC call so the DB
  // saves once, then triggers one parent refresh via onMarkCore(null, …) –
  // we deliberately pass a sentinel id=null so App.jsx's handleMarkCore
  // pattern-match lets us just refresh rather than double-toggle.
  const applyLockAll = async (isCore) => {
    if (filtered.length === 0) return;
    const ids = filtered.map(m => m.id);
    const r = await window.api.markCoreBulk(ids, isCore);
    if (r?.success && r.updated > 0) {
      // Trigger refresh via the existing onMarkCore plumbing — we pass null
      // id so the parent notifies generically and re-fetches mods.
      onMarkCore(null, isCore, { bulk: true, count: r.updated });
    }
  };
  const deleteGroup = async id => { await window.api.deleteModGroup(id); setGroups(await window.api.getModGroups()); };
  const renameGroup = async id => {
    if (!editName.trim()) return;
    await window.api.renameModGroup(id, editName.trim());
    setEditingGroup(null); setEditName('');
    setGroups(await window.api.getModGroups());
  };
  const moveToGroup = async (modId, groupId) => {
    await window.api.setModGroup(modId, groupId || null);
    setGroups(await window.api.getModGroups());
  };
  const bulkMoveToGroup = async (groupId) => {
    await window.api.setModsGroup([...selected], groupId || null);
    setSelected(new Set());
    setGroups(await window.api.getModGroups());
  };
  const handleGroupDrop = async (targetId) => {
    if (!dragGroupId || dragGroupId === targetId) { setDragGroupId(null); setDragOverGroupId(null); return; }
    // "Main Core Mods" is always pinned to the top via displayGroups.
    // Prevent drag-drop from trying to move it or drop onto it.
    const dragged = groups.find(g => g.id === dragGroupId);
    const target = groups.find(g => g.id === targetId);
    if (dragged?.name === 'Main Core Mods' || target?.name === 'Main Core Mods') {
      setDragGroupId(null); setDragOverGroupId(null); return;
    }
    const ids = groups.map(g => g.id);
    const fromIdx = ids.indexOf(dragGroupId);
    const toIdx = ids.indexOf(targetId);
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, dragGroupId);
    await window.api.reorderModGroups(ids);
    setGroups(await window.api.getModGroups());
    setDragGroupId(null);
    setDragOverGroupId(null);
  };

  const rowProps = (m, i) => ({
    key: m.id, mod: m, i, conflict: conflictIds.has(m.id), missingDeps: depMap[m.id],
    onToggle: () => onToggle(m.id), onRemove: () => onRemove(m.id), onMarkCore: c => onMarkCore(m.id, c),
    selected: selected.has(m.id), onSelect: () => toggleSelect(m.id), t, tMod,
    busy: togglingId === m.id,
    progress: (toggleProgress && toggleProgress.id === m.id) ? toggleProgress : null,
    anyToggling: !!togglingId,
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, padding: '14px 16px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', alignItems: 'flex-end', flexWrap: 'wrap', flexShrink: 0 }}>
        <FL label={t('STATUS')}><select className="select" value={statusF} onChange={e => setStatusF(e.target.value)}><option value="All">{t('All')}</option><option value="Enabled">{t('Enabled')}</option><option value="Disabled">{t('Disabled')}</option></select></FL>
        <FL label={t('SEARCH')} style={{ flex: 2, minWidth: 140 }}><input className="input" placeholder={t('Filter by name...')} value={search} onChange={e => setSearch(e.target.value)} /></FL>
        <FL label={t('EXTRACT TARGET')}><select className="select" value={targetF} onChange={e => setTargetF(e.target.value)}>{uniqueTargets.map(u => <option key={u} value={u}>{u === 'All' ? t('All') : u}</option>)}</select></FL>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', paddingBottom: 1 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => applyLockAll(true)} title={t('Mark every visible mod as Core (locked from toggle/remove)')} style={{ whiteSpace: 'nowrap' }}>🔒 {t('Lock All')}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => applyLockAll(false)} title={t('Unmark every visible mod as Core (allow toggling/removing)')} style={{ whiteSpace: 'nowrap' }}>🔓 {t('Unlock All')}</button>
          {!showCreate ? (
            <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(true)} style={{ whiteSpace: 'nowrap' }}>📁 {t('Create Group')}</button>
          ) : (
            <div style={{ display: 'flex', gap: 4 }}>
              <input className="input" placeholder={t('Group name...')} value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createGroup(); if (e.key === 'Escape') setShowCreate(false); }}
                autoFocus style={{ width: 140, padding: '4px 8px', fontSize: 13 }} />
              <button className="btn btn-accent btn-sm" onClick={createGroup}>✓</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>✕</button>
            </div>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && groups.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', background: 'var(--accent-glow)', borderBottom: '1px solid var(--accent)', flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>
            {selected.size} {t('selected')}
          </span>
          <span style={{ fontSize: 13, color: 'var(--text-3)' }}>→</span>
          <select className="select" onChange={e => { if (e.target.value !== '') bulkMoveToGroup(e.target.value === '__none' ? null : e.target.value); e.target.value = ''; }}
            defaultValue="" style={{ fontSize: 13, padding: '4px 8px' }}>
            <option value="" disabled>{t('Move to group...')}</option>
            <option value="__none">— {t('Ungrouped')}</option>
            {groups.map(g => <option key={g.id} value={g.id}>📁 {g.name}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())} style={{ marginLeft: 'auto' }}>✕ {t('Clear')}</button>
        </div>
      )}

      {/* Column headers */}
      <div style={{ display: 'flex', padding: '10px 16px', background: 'var(--bg-surface)', borderBottom: '2px solid var(--border-2)', fontSize: 13, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'var(--mono)', flexShrink: 0, alignItems: 'center' }}>
        {groups.length > 0 && (
          <div style={{ width: 30, display: 'flex', justifyContent: 'center' }}>
            <input type="checkbox" checked={sorted.length > 0 && selected.size === sorted.length} onChange={selectAll} style={{ cursor: 'pointer', width: 15, height: 15 }} />
          </div>
        )}
        <div style={{ width: 95 }}>{t('STATUS')}</div>
        <div style={{ flex: 2, cursor: 'pointer' }} onClick={() => doSort('name')}>{t('NAME')}{arrow('name')}</div>
        <div style={{ width: 90, cursor: 'pointer' }} onClick={() => doSort('version')}>{t('VERSION')}{arrow('version')}</div>
        <div style={{ width: 155 }}>{t('TARGET')}</div>
        <div style={{ width: 60, textAlign: 'center' }}>{t('FILES')}</div>
        <div style={{ width: 60, textAlign: 'center' }}>{t('DEPS')}</div>
        <div style={{ width: 100, textAlign: 'center' }}>{t('ACTIONS')}</div>
      </div>

      {/* Mod list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {displayGroups.map(g => {
          const groupMods = sorted.filter(m => g.modIds.includes(m.id));
          if (groupMods.length === 0 && search) return null;
          const isCollapsed = collapsed.has(g.id);
          return (
            <div key={g.id}>
              <GroupHeader name={g.name} count={groupMods.length} isCollapsed={isCollapsed}
                onToggle={() => toggleCollapse(g.id)}
                isEditing={editingGroup === g.id} editName={editName}
                onEditStart={() => { setEditingGroup(g.id); setEditName(g.name); }}
                onEditChange={setEditName} onEditSave={() => renameGroup(g.id)} onEditCancel={() => setEditingGroup(null)}
                onDelete={() => deleteGroup(g.id)} t={t} hasCheckbox={groups.length > 0}
                isDragging={dragGroupId === g.id} isDragOver={dragOverGroupId === g.id}
                onDragStart={() => setDragGroupId(g.id)} onDragEnd={() => { setDragGroupId(null); setDragOverGroupId(null); }}
                onDragOver={() => setDragOverGroupId(g.id)} onDrop={() => handleGroupDrop(g.id)} />
              {!isCollapsed && groupMods.map((m, i) => <Row {...rowProps(m, i)} hasCheckbox={groups.length > 0} />)}
              {!isCollapsed && groupMods.length === 0 && (
                <div style={{ padding: '12px 16px 12px 54px', fontSize: 13, color: 'var(--text-4)', fontStyle: 'italic', borderBottom: '1px solid var(--border)' }}>
                  {t('No mods in this group. Select mods using checkboxes and move them here.')}
                </div>
              )}
            </div>
          );
        })}

        {groups.length > 0 && ungroupedMods.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px',
            background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)',
            cursor: 'pointer', userSelect: 'none',
          }} onClick={() => toggleCollapse('__ungrouped')}>
            <span style={{ fontSize: 14, color: 'var(--text-3)', transition: 'transform .15s', transform: collapsed.has('__ungrouped') ? 'rotate(-90deg)' : 'rotate(0deg)' }}>&#9660;</span>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-3)' }}>{t('Ungrouped')}</span>
            <span style={{ fontSize: 13, color: 'var(--text-4)', fontFamily: 'var(--mono)' }}>{ungroupedMods.length} {t('mods')}</span>
          </div>
        )}

        {(groups.length === 0 ? sorted : (collapsed.has('__ungrouped') ? [] : ungroupedMods)).map((m, i) => <Row {...rowProps(m, i)} hasCheckbox={groups.length > 0} />)}

        {sorted.length === 0 && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 50, color: 'var(--text-3)' }}>
          <div style={{ fontSize: 44, marginBottom: 10, opacity: .3 }}>🔧</div>
          <div style={{ fontSize: 17 }}>{mods.length === 0 ? t('No mods installed') : t('No mods match filters')}</div>
          {mods.length === 0 && <div style={{ fontSize: 14, color: 'var(--text-4)', marginTop: 8, textAlign: 'center', lineHeight: 1.8 }}>
            {t('Start by installing BepInEx from the Recommended Mods tab, then add mod archives to the Downloaded Mods tab.')}
          </div>}
        </div>}
      </div>
    </div>
  );
}

function GroupHeader({ name, count, isCollapsed, onToggle, isEditing, editName, onEditStart, onEditChange, onEditSave, onEditCancel, onDelete, t, hasCheckbox, isDragging, isDragOver, onDragStart, onDragEnd, onDragOver, onDrop }) {
  return (
    <div draggable={!isEditing} onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart(); }}
      onDragEnd={onDragEnd} onDragOver={e => { e.preventDefault(); onDragOver(); }} onDrop={e => { e.preventDefault(); onDrop(); }}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px',
        background: isDragOver ? 'var(--accent-glow)' : 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border)',
        borderTop: isDragOver ? '2px solid var(--accent)' : '2px solid transparent',
        cursor: isEditing ? 'default' : 'default', userSelect: 'none',
        opacity: isDragging ? 0.4 : 1, transition: 'opacity .15s, border-top .1s',
      }} onClick={onToggle}>
      {hasCheckbox && <div style={{ width: 30 }} />}
      <span style={{ fontSize: 14, color: 'var(--text-3)', transition: 'transform .15s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>&#9660;</span>
      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>📁</span>
      {isEditing ? (
        <div style={{ display: 'flex', gap: 4, flex: 1 }} onClick={e => e.stopPropagation()}>
          <input className="input" value={editName} onChange={e => onEditChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onEditSave(); if (e.key === 'Escape') onEditCancel(); }}
            autoFocus style={{ flex: 1, padding: '2px 8px', fontSize: 14 }} />
          <button className="btn btn-accent btn-sm" onClick={onEditSave} style={{ padding: '2px 8px' }}>✓</button>
        </div>
      ) : (
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', flex: 1 }}>{name}</span>
      )}
      <span style={{ fontSize: 13, color: 'var(--text-4)', fontFamily: 'var(--mono)' }}>{count} {t('mods')}</span>
      <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); onEditStart(); }} title={t('Rename')} style={{ padding: '2px 6px', fontSize: 12 }}>✏️</button>
      <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); onDelete(); }} title={t('Remove')} style={{ padding: '2px 6px', fontSize: 12, color: 'var(--red-bright)' }}>🗑</button>
    </div>
  );
}

function FL({ label, children, style }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 90, ...style }}>
    <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</span>{children}
  </div>;
}

function Row({ mod, i, conflict, missingDeps, onToggle, onRemove, onMarkCore, selected, onSelect, hasCheckbox, t, tMod, busy, progress, anyToggling }) {
  const [h, setH] = useState(false);
  const isCore = mod.core;
  const isPrefab = isCore && mod.files?.some(f => f.toLowerCase().includes('_prefabloader'));
  const isRoot = mod.targetKey === 'game_root' || mod.targetKey === 'bepinex';
  const translatedName = tMod(mod.name, '').name;
  const hasDeps = missingDeps && missingDeps.length > 0;
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ display: 'flex', padding: '8px 16px', alignItems: 'center', borderBottom: '1px solid var(--border)', transition: 'background .1s', fontSize: 15, position: 'relative',
        animation: `fadeIn .15s ease ${i * .015}s both`,
        background: selected ? 'var(--accent-glow)' : h ? 'var(--bg-hover)' : i % 2 === 0 ? 'var(--bg-base)' : 'var(--bg-surface)' }}>
      {hasCheckbox && (
        <div style={{ width: 30, display: 'flex', justifyContent: 'center' }}>
          <input type="checkbox" checked={selected} onChange={onSelect} style={{ cursor: 'pointer', width: 15, height: 15 }} />
        </div>
      )}
      <div style={{ width: 95 }}>
        {isCore ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 600, background: 'var(--accent-glow)', color: 'var(--accent)' }}>🔒 {isPrefab ? t('Prefab') : t('Core')}</span>
        ) : busy ? (
          <div title={t('Working…')} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'default', background: 'var(--bg-active)' }}>
            <span style={{ display: 'inline-block', width: 11, height: 11, border: '2px solid rgba(255,255,255,.35)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .6s linear infinite' }} />
            {progress && progress.total > 0 ? `${Math.min(100, Math.round(progress.done / progress.total * 100))}%` : '…'}
          </div>
        ) : (
          <div onClick={anyToggling ? undefined : onToggle} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 600, color: '#fff', cursor: anyToggling ? 'default' : 'pointer', opacity: anyToggling ? .5 : 1, background: mod.enabled ? 'var(--green)' : 'var(--bg-active)' }}>
            {mod.enabled ? `✓ ${t('On')}` : `✕ ${t('Off')}`}<span style={{ fontSize: 11, opacity: .6 }}>▾</span></div>
        )}
      </div>
      <div style={{ flex: 2, fontWeight: 500, color: 'var(--text)', minWidth: 0 }}>
        {translatedName}
        {hasDeps && (
          <div style={{ fontSize: 11, color: 'var(--red-bright)', marginTop: 2 }}>
            ⚠️ {t('Missing')}: {missingDeps.join(', ')}
          </div>
        )}
      </div>
      <div style={{ width: 90, color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 13 }}>{mod.version || '—'}</div>
      <div style={{ width: 155 }}><span style={{ fontSize: 13, padding: '3px 8px', borderRadius: 'var(--radius)', background: isRoot ? 'rgba(218,155,60,.15)' : 'rgba(92,185,80,.12)', color: isRoot ? 'var(--accent)' : 'var(--green-bright)' }}>{mod.targetLabel}</span></div>
      <div style={{ width: 60, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>{mod.fileCount || '—'}</div>
      <div style={{ width: 60, textAlign: 'center' }}>
        {hasDeps ? <span title={missingDeps.join(', ')} style={{ color: 'var(--red-bright)', fontSize: 16 }}>⚠️</span> :
         conflict ? <span style={{ color: 'var(--accent)', fontSize: 18, animation: 'pulse 2s infinite' }}>⚡</span> :
         <span style={{ color: 'var(--text-4)' }}>—</span>}
      </div>
      <div style={{ width: 100, display: 'flex', gap: 5, justifyContent: 'center' }}>
        <button className="btn btn-ghost btn-sm" disabled={anyToggling} onClick={() => onMarkCore(!isCore)} title={isCore ? t('Unlock (allow toggling)') : t('Lock as core mod')}>{isCore ? '🔓' : '🔒'}</button>
        {!isCore && <button className="btn btn-danger btn-sm" disabled={anyToggling} onClick={anyToggling ? undefined : onRemove}>🗑</button>}
      </div>
      {busy && (
        <div style={{ position: 'absolute', left: 0, bottom: 0, height: 3, width: '100%', background: 'var(--bg-active)', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            background: 'var(--accent)',
            transition: 'width .15s ease',
            width: progress && progress.total > 0 ? `${Math.min(100, Math.round(progress.done / progress.total * 100))}%` : '15%',
            ...(progress && progress.total > 0 ? {} : { animation: 'ctIndeterminate 1s ease-in-out infinite' }),
          }} />
        </div>
      )}
    </div>
  );
}
