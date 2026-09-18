import { useState, useMemo, useEffect } from 'react';
import { useI18n } from '../i18n';

export default function InstalledMods({ mods, conflicts, updates = {}, onToggle, onRemove, onMarkCore, onRename, togglingId, toggleProgress }) {
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
  const [editingModId, setEditingModId] = useState(null);
  const [modEditName, setModEditName] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [dragGroupId, setDragGroupId] = useState(null);
  const [dragOverGroupId, setDragOverGroupId] = useState(null);

  useEffect(() => { window.api.checkDependencies().then(setDepWarnings).catch(e => console.error('[checkDependencies]', e)); }, [mods]);
  useEffect(() => { window.api.getModGroups().then(setGroups).catch(e => console.error('[getModGroups]', e)); }, [mods]);
  useEffect(() => { window.api.getCollapsedGroups().then(ids => setCollapsed(new Set(ids || []))).catch(e => console.error('[getCollapsedGroups]', e)); }, []);

  const conflictIds = useMemo(() => { const s = new Set(); conflicts.forEach(c => c.mods.forEach(m => s.add(m.modId))); return s; }, [conflicts]);
  // Per-mod conflict detail: which other mods it collides with, and over which
  // file(s). Lets each row explain the conflict instead of showing a bare ⚡.
  const conflictMap = useMemo(() => {
    const m = {};
    conflicts.forEach(c => {
      const fileName = String(c.file || '').split('/').pop();
      c.mods.forEach(entry => {
        const others = c.mods.filter(x => x.modId !== entry.modId).map(x => x.modName);
        if (!others.length) return;
        if (!m[entry.modId]) m[entry.modId] = { others: new Set(), files: new Set() };
        others.forEach(o => m[entry.modId].others.add(o));
        if (fileName) m[entry.modId].files.add(fileName);
      });
    });
    // Freeze to plain arrays for rendering
    const out = {};
    for (const id of Object.keys(m)) out[id] = { others: [...m[id].others], files: [...m[id].files] };
    return out;
  }, [conflicts]);
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
  const startModRename = (mod) => { setEditingModId(mod.id); setModEditName(tMod(mod.name, '').name || mod.name); };
  const cancelModRename = () => { setEditingModId(null); setModEditName(''); };
  const saveModRename = async (id) => {
    const trimmed = modEditName.trim();
    if (!trimmed) { cancelModRename(); return; }
    await onRename(id, trimmed);
    setEditingModId(null); setModEditName('');
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
    key: m.id, mod: m, i, conflict: conflictIds.has(m.id), conflictInfo: conflictMap[m.id], missingDeps: depMap[m.id], update: updates[m.id],
    onToggle: () => onToggle(m.id), onRemove: () => onRemove(m.id), onMarkCore: c => onMarkCore(m.id, c),
    selected: selected.has(m.id), onSelect: () => toggleSelect(m.id), t, tMod,
    busy: togglingId === m.id,
    progress: (toggleProgress && toggleProgress.id === m.id) ? toggleProgress : null,
    anyToggling: !!togglingId,
    isEditingName: editingModId === m.id,
    modEditName,
    onNameEditStart: () => startModRename(m),
    onNameEditChange: setModEditName,
    onNameEditSave: () => saveModRename(m.id),
    onNameEditCancel: cancelModRename,
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '24px 24px 0' }}>
        <h1 className="page-title">{t('INSTALLED MODS')}</h1>
        <p className="page-sub">{mods.length} {t('mods')} · {mods.filter(m => m.enabled).length} {t('active')}</p>
      </div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, padding: '18px 24px', alignItems: 'flex-end', flexWrap: 'wrap', flexShrink: 0 }}>
        <FL label={t('STATUS')}><select className="select" value={statusF} onChange={e => setStatusF(e.target.value)}><option value="All">{t('All')}</option><option value="Enabled">{t('Enabled')}</option><option value="Disabled">{t('Disabled')}</option></select></FL>
        <FL label={t('SEARCH')} style={{ flex: 2, minWidth: 140 }}><input className="input" placeholder={t('Filter by name...')} value={search} onChange={e => setSearch(e.target.value)} /></FL>
        <FL label={t('EXTRACT TARGET')}><select className="select" value={targetF} onChange={e => setTargetF(e.target.value)}>{uniqueTargets.map(u => <option key={u} value={u}>{u === 'All' ? t('All') : u}</option>)}</select></FL>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', paddingBottom: 1 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => applyLockAll(true)} title={t('Mark every visible mod as Core (locked from toggle/remove)')} style={{ whiteSpace: 'nowrap' }}>{t('Lock All')}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => applyLockAll(false)} title={t('Unmark every visible mod as Core (allow toggling/removing)')} style={{ whiteSpace: 'nowrap' }}>{t('Unlock All')}</button>
          {!showCreate ? (
            <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(true)} style={{ whiteSpace: 'nowrap' }}>{t('Create Group')}</button>
          ) : (
            <div style={{ display: 'flex', gap: 4 }}>
              <input className="input" placeholder={t('Group name...')} value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createGroup(); if (e.key === 'Escape') setShowCreate(false); }}
                autoFocus style={{ width: 140, padding: '4px 8px', fontSize: 13 }} />
              <button className="btn btn-accent btn-sm" onClick={createGroup} aria-label={t("Save")}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg></button>
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
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())} style={{ marginLeft: 'auto' }}>✕ {t('Clear')}</button>
        </div>
      )}

      {/* Column headers */}
      <div style={{ display: 'flex', margin: '0 24px', padding: '8px 16px', border: '1px solid transparent',
        borderBottom: '1px solid var(--border)', fontSize: 10, fontWeight: 700, color: 'var(--text-4)',
        textTransform: 'uppercase', letterSpacing: 1.5, flexShrink: 0, alignItems: 'center' }}>
        {groups.length > 0 && (
          <div style={{ width: 30, display: 'flex', justifyContent: 'center' }}>
            <input type="checkbox" checked={sorted.length > 0 && selected.size === sorted.length} onChange={selectAll} style={{ cursor: 'pointer', width: 15, height: 15 }} />
          </div>
        )}
        <div style={{ width: 95 }}>{t('STATUS')}</div>
        <div style={{ flex: 2, cursor: 'pointer' }} onClick={() => doSort('name')}>{t('NAME')}{arrow('name')}</div>
        <div style={{ width: 132, cursor: 'pointer' }} onClick={() => doSort('version')}>{t('VERSION')}{arrow('version')}</div>
        <div style={{ width: 155 }}>{t('TARGET')}</div>
        <div style={{ width: 60, textAlign: 'center' }}>{t('FILES')}</div>
        <div style={{ width: 60, textAlign: 'center', cursor: 'help' }} title={t('Warnings: missing dependencies or file conflicts with another mod. Hover the icon for details.')}>{t('ISSUES')}</div>
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
            display: 'flex', alignItems: 'center', gap: 10, padding: '14px 24px 8px',
            cursor: 'pointer', userSelect: 'none',
          }} onClick={() => toggleCollapse('__ungrouped')}>
            <span style={{ fontSize: 14, color: 'var(--text-3)', transition: 'transform .15s', transform: collapsed.has('__ungrouped') ? 'rotate(-90deg)' : 'rotate(0deg)' }}>&#9660;</span>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-3)' }}>{t('Ungrouped')}</span>
            <span style={{ fontSize: 13, color: 'var(--text-4)', fontFamily: 'var(--mono)' }}>{ungroupedMods.length} {t('mods')}</span>
          </div>
        )}

        {(groups.length === 0 ? sorted : (collapsed.has('__ungrouped') ? [] : ungroupedMods)).map((m, i) => <Row {...rowProps(m, i)} hasCheckbox={groups.length > 0} />)}

        {sorted.length === 0 && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 50, color: 'var(--text-3)' }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-4)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginBottom: 12 }}>
            <path d="M20 7h-9" /><path d="M14 17H5" /><circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" />
          </svg>
          <div style={{ fontSize: 16, color: 'var(--text-2)' }}>{mods.length === 0 ? t('No mods installed') : t('No mods match filters')}</div>
          {mods.length === 0 && <div style={{ fontSize: 14, color: 'var(--text-4)', marginTop: 8, textAlign: 'center', lineHeight: 1.8 }}>
            {t('Start by installing BepInEx from the Getting Started tab, then add mod archives to the Staged Mods tab.')}
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
        display: 'flex', alignItems: 'center', gap: 10, padding: '16px 24px 8px',
        background: isDragOver ? 'var(--accent-soft)' : 'transparent',
        borderTop: isDragOver ? '2px solid var(--accent)' : '2px solid transparent',
        cursor: isEditing ? 'default' : 'default', userSelect: 'none',
        opacity: isDragging ? 0.4 : 1, transition: 'opacity .15s, border-top .1s',
      }} onClick={onToggle}>
      {hasCheckbox && <div style={{ width: 30 }} />}
      <span style={{ fontSize: 14, color: 'var(--text-3)', transition: 'transform .15s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>&#9660;</span>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}><path d="M3 7h6l2 2h10v9a2 2 0 0 1-2 2H3z" /></svg>
      {isEditing ? (
        <div style={{ display: 'flex', gap: 4, flex: 1 }} onClick={e => e.stopPropagation()}>
          <input className="input" value={editName} onChange={e => onEditChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onEditSave(); if (e.key === 'Escape') onEditCancel(); }}
            autoFocus style={{ flex: 1, padding: '2px 8px', fontSize: 14 }} />
          <button className="btn btn-accent btn-sm" onClick={onEditSave} aria-label={t('Save')} style={{ padding: '2px 8px' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg></button>
        </div>
      ) : (
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{name}</span>
      )}
      <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-4)' }}>{count} {t('mods')}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); onEditStart(); }} title={t('Rename')} style={{ padding: '2px 6px', fontSize: 12 }}>✏️</button>
      <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); onDelete(); }} title={t('Remove')} style={{ padding: '2px 6px', fontSize: 12, color: 'var(--red-bright)' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16" /><path d="M9 7V5h6v2" /><path d="M6 7l1 13h10l1-13" /></svg></button>
    </div>
  );
}

function FL({ label, children, style }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 90, ...style }}>
    <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</span>{children}
  </div>;
}

function Row({ mod, i, conflict, conflictInfo, missingDeps, update, onToggle, onRemove, onMarkCore, selected, onSelect, hasCheckbox, t, tMod, busy, progress, anyToggling, isEditingName, modEditName, onNameEditStart, onNameEditChange, onNameEditSave, onNameEditCancel }) {
  const [h, setH] = useState(false);
  const isCore = mod.core;
  const isPrefab = isCore && mod.files?.some(f => f.toLowerCase().includes('_prefabloader'));
  const isRoot = mod.targetKey === 'game_root' || mod.targetKey === 'bepinex';
  const translatedName = tMod(mod.name, '').name;
  const hasDeps = missingDeps && missingDeps.length > 0;
  const hasConflict = conflict && conflictInfo && conflictInfo.others && conflictInfo.others.length > 0;
  // Human-readable conflict description used in both the tooltip and the inline line.
  const conflictText = hasConflict
    ? `${t('Conflicts with')} ${conflictInfo.others.join(', ')}`
      + (conflictInfo.files && conflictInfo.files.length
          ? ` — ${t('shared file')}: ${conflictInfo.files.slice(0, 3).join(', ')}${conflictInfo.files.length > 3 ? '…' : ''}`
          : '')
    : '';
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      className={`card${selected ? ' card-accent' : ''}${hasDeps ? ' card-accent' : ''}`}
      style={{ display: 'flex', padding: '10px 16px', alignItems: 'center', fontSize: 15, position: 'relative', overflow: 'hidden',
        margin: '0 24px 8px', opacity: mod.enabled === false ? .62 : 1,
        animation: `fadeIn .15s ease ${i * .015}s both`,
        background: selected ? 'var(--accent-soft)' : h ? 'var(--bg-base)' : 'var(--bg-surface)' }}>
      {hasCheckbox && (
        <div style={{ width: 30, display: 'flex', justifyContent: 'center' }}>
          <input type="checkbox" checked={selected} onChange={onSelect} style={{ cursor: 'pointer', width: 15, height: 15 }} />
        </div>
      )}
      <div style={{ width: 95 }}>
        {isCore ? (
          <span className="pill pill-accent" style={{ height: 28, padding: '0 11px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
            {isPrefab ? t('Prefab') : t('Core')}
          </span>
        ) : busy ? (
          <div title={t('Working…')} className="pill" style={{ height: 28, padding: '0 11px', cursor: 'default' }}>
            <span className="spinner" style={{ width: 11, height: 11 }} />
            {progress && progress.total > 0 ? `${Math.min(100, Math.round(progress.done / progress.total * 100))}%` : '…'}
          </div>
        ) : (
          <button type="button" onClick={anyToggling ? undefined : onToggle} disabled={anyToggling}
            className={`pill ${mod.enabled ? 'pill-success' : ''}`} style={{ height: 28, padding: '0 12px', cursor: anyToggling ? 'default' : 'pointer' }}>
            {mod.enabled && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>}
            {mod.enabled ? t('On') : t('Off')}
          </button>
        )}
      </div>
      <div style={{ flex: 2, fontWeight: 500, color: 'var(--text)', minWidth: 0 }}>
        {isEditingName ? (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <input className="input" value={modEditName} autoFocus
              onChange={e => onNameEditChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onNameEditSave(); if (e.key === 'Escape') onNameEditCancel(); }}
              onBlur={onNameEditSave}
              style={{ flex: 1, padding: '2px 8px', fontSize: 14, minWidth: 0 }} />
            <button className="btn btn-accent btn-sm" onMouseDown={e => e.preventDefault()} onClick={onNameEditSave} aria-label={t('Save')} style={{ padding: '2px 8px' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg></button>
            <button className="btn btn-ghost btn-sm" onMouseDown={e => e.preventDefault()} onClick={onNameEditCancel} style={{ padding: '2px 8px' }}>✕</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{translatedName}</span>
            {!anyToggling && h && (
              <button className="btn btn-quiet btn-sm btn-icon" onClick={onNameEditStart} title={t('Rename')} aria-label={t('Rename')}
                style={{ width: 24, height: 24, flexShrink: 0 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>
              </button>
            )}
          </div>
        )}
        {hasDeps && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--accent)', marginTop: 3 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4l9 16H3z" /><path d="M12 10v4" /><path d="M12 17.5v.5" /></svg>
            {t('Missing')}: {missingDeps.join(', ')}
          </div>
        )}
        {hasConflict && (
          <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={conflictText}>
            {conflictText}
          </div>
        )}
      </div>
      <div style={{ width: 132, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
        {mod.version
          ? <span className="badge badge-accent">{mod.version}</span>
          : <span className="mono" style={{ color: 'var(--text-4)', fontSize: 12.5 }}>—</span>}
        {/* Update badge comes from the published version list, not from Nexus
            directly — see src/main/update-checker.js. */}
        {update && (
          <button type="button" className="pill pill-info pill-pulse"
            title={`${update.installed} → ${update.latest} · ${t('Open on Nexus Mods')}`}
            onClick={e => { e.stopPropagation(); window.api.openUrl(`https://www.nexusmods.com/tcgcardshopsimulator/mods/${update.modId}`); }}
            style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {t('Update Available')}
          </button>
        )}
      </div>
      <div style={{ width: 155 }}><span className="badge" style={{ fontSize: 11.5 }}>{mod.targetLabel}</span></div>
      <div className="mono" style={{ width: 60, textAlign: 'center', color: 'var(--text-4)', fontSize: 12 }}>{mod.fileCount || '—'}</div>
      <div style={{ width: 60, textAlign: 'center' }}>
        {hasDeps ? <span title={`${t('Missing')}: ${missingDeps.join(', ')}`} style={{ color: 'var(--accent)', cursor: 'help', display: 'inline-flex' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4l9 16H3z" /><path d="M12 10v4" /><path d="M12 17.5v.5" /></svg>
          </span> :
         hasConflict ? <span title={conflictText} style={{ color: 'var(--info-bright)', cursor: 'help', display: 'inline-flex' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 3L5 14h6l-1 7 8-11h-6z" /></svg>
          </span> :
         <span style={{ color: 'var(--text-4)' }}>—</span>}
      </div>
      <div style={{ width: 100, display: 'flex', gap: 5, justifyContent: 'center' }}>
        <button className="btn btn-ghost btn-sm btn-icon" disabled={anyToggling} onClick={() => onMarkCore(!isCore)} aria-label={isCore ? t('Unlock (allow toggling)') : t('Lock as core mod')} title={isCore ? t('Unlock (allow toggling)') : t('Lock as core mod')}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="4" y="10" width="16" height="10" rx="2" />{isCore ? <path d="M8 10V7a4 4 0 0 1 7-2.6" /> : <path d="M8 10V7a4 4 0 0 1 8 0v3" />}
          </svg>
        </button>
        {!isCore && <button className="btn btn-danger btn-sm btn-icon" disabled={anyToggling} onClick={anyToggling ? undefined : onRemove} aria-label={t('Remove')}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16" /><path d="M9 7V5h6v2" /><path d="M6 7l1 13h10l1-13" /></svg>
        </button>}
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
