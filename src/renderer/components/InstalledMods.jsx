import { useState, useMemo, useEffect } from 'react';
import { useI18n } from '../i18n';

export default function InstalledMods({ openFilter, mods, conflicts, updates = {}, latestVersions = {}, onToggle, onRemove, onMarkCore, onRename, togglingId, toggleProgress }) {
  const { t, tMod } = useI18n();
  const [search, setSearch] = useState('');
  const [statusF, setStatusF] = useState(openFilter?.filter || 'All');
  useEffect(() => { if (openFilter?.filter) setStatusF(openFilter.filter); }, [openFilter?.n]);
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
    if (statusF === 'Updates' && !updates[m.id]) return false;
    if (statusF === 'Issues' && !(depMap[m.id]?.length || conflictIds.has(m.id))) return false;
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [mods, statusF, search, updates, depMap, conflictIds]);

  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    if (sortCol === 'update') {
      // Mods with an update first (or last, when reversed), then by name, so
      // the ones that need attention sit together at the top of each group.
      const byName = (a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
      return [...filtered].sort((a, b) => {
        const d = (updates[b.id] ? 1 : 0) - (updates[a.id] ? 1 : 0);
        if (d) return sortDir === 'asc' ? d : -d;
        return byName(a, b);
      });
    }
    return [...filtered].sort((a, b) => {
      let av = a[sortCol] ?? '', bv = b[sortCol] ?? '';
      if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
      return sortDir === 'asc' ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1);
    });
  }, [filtered, sortCol, sortDir, updates]);

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
    key: m.id, mod: m, i, conflict: conflictIds.has(m.id), conflictInfo: conflictMap[m.id], missingDeps: depMap[m.id], update: updates[m.id], latest: latestVersions[m.id],
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
        <h1 className="page-title">{t('Installed Mods')}</h1>
        <p className="page-sub">{mods.length} {t('mods')} · {mods.filter(m => m.enabled).length} {t('active')}</p>
      </div>
      {/* Quick filters with counts: the questions people actually ask of this
          list — what needs updating, what has a problem, what is switched off. */}
      <div role="tablist" aria-label={t('Filter')} style={{ display: 'flex', gap: 4, flexWrap: 'wrap', padding: '16px 24px 0' }}>
        {[
          ['All', t('All'), mods.length],
          ['Updates', t('Updates'), mods.filter(m => updates[m.id]).length],
          ['Issues', t('Issues'), mods.filter(m => depMap[m.id]?.length || conflictIds.has(m.id)).length],
          ['Disabled', t('Off'), mods.filter(m => !m.enabled).length],
        ].map(([id, label, n]) => (
          <button key={id} type="button" role="tab" aria-selected={statusF === id} onClick={() => setStatusF(id)}
            className={`btn btn-sm ${statusF === id ? 'btn-ghost' : 'btn-quiet'}`}
            style={statusF === id ? { color: 'var(--accent)', borderColor: 'var(--accent-border)', background: 'var(--accent-soft)' } : undefined}>
            {label} <span className="mono" style={{ fontSize: 11.5, opacity: .8 }}>{n}</span>
          </button>
        ))}
      </div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, padding: '14px 24px 18px', alignItems: 'flex-end', flexWrap: 'wrap', flexShrink: 0 }}>
        <FL label={t('SEARCH')} style={{ flex: 2, minWidth: 140 }}><input className="input" placeholder={t('Filter by name...')} value={search} onChange={e => setSearch(e.target.value)} /></FL>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', paddingBottom: 1 }}>
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
        <div style={{ flex: 2, minWidth: 180, cursor: 'pointer' }} onClick={() => doSort('name')}>{t('NAME')}{arrow('name')}</div>
        <div style={{ width: 90, cursor: 'pointer' }} onClick={() => doSort('version')}>{t('VERSION')}{arrow('version')}</div>
        <div style={{ width: 134, marginLeft: 28, cursor: 'pointer' }} onClick={() => doSort('update')}>{t('UPDATE')}{arrow('update')}</div>
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

function Row({ mod, i, conflict, conflictInfo, missingDeps, update, latest, onToggle, onRemove, onMarkCore, selected, onSelect, hasCheckbox, t, tMod, busy, progress, anyToggling, isEditingName, modEditName, onNameEditStart, onNameEditChange, onNameEditSave, onNameEditCancel }) {
  const [h, setH] = useState(false);
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
        {busy ? (
          <div title={t('Working…')} className="pill" style={{ height: 28, padding: '0 11px', cursor: 'default' }}>
            <span className="spinner" style={{ width: 11, height: 11 }} />
            {progress && progress.total > 0 ? `${Math.min(100, Math.round(progress.done / progress.total * 100))}%` : '…'}
          </div>
        ) : (
          <button type="button" role="switch" aria-checked={!!mod.enabled} aria-label={`${mod.enabled ? t('On') : t('Off')}: ${translatedName}`}
            title={mod.enabled ? t('On') : t('Off')}
            onClick={anyToggling ? undefined : onToggle} disabled={anyToggling}
            style={{ position: 'relative', width: 48, height: 26, borderRadius: 999, border: '1px solid',
              borderColor: mod.enabled ? 'var(--accent)' : 'var(--border-2)',
              background: mod.enabled ? 'var(--accent)' : 'var(--bg-elevated)', cursor: anyToggling ? 'default' : 'pointer', transition: 'background .15s' }}>
            <span style={{ position: 'absolute', top: 2, left: mod.enabled ? 24 : 2, width: 20, height: 20, borderRadius: '50%',
              background: mod.enabled ? 'var(--on-accent)' : 'var(--text-3)', transition: 'left .15s' }} />
          </button>
        )}
      </div>
      <div style={{ flex: 2, fontWeight: 500, color: 'var(--text)', minWidth: 180, paddingRight: 12 }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flexWrap: 'wrap' }}>
            {/* Wrap rather than collide with the version column, but stop at two
                lines and hide the rest — a long name should not stretch the row.
                The full name is in the title attribute. */}
            <span title={translatedName} style={{
              minWidth: 0, overflowWrap: 'break-word', lineHeight: 1.35,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>{translatedName}</span>
            {!anyToggling && h && (
              <button className="btn btn-quiet btn-sm btn-icon" onClick={onNameEditStart} title={t('Rename')} aria-label={t('Rename')}
                style={{ width: 24, height: 24, flexShrink: 0 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>
              </button>
            )}
          </div>
        )}
        {!isEditingName && mod.targetLabel && (
          <div className="mono truncate" style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 2 }} title={t(mod.targetLabel)}>{t(mod.targetLabel)}</div>
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
      <div style={{ width: 90 }}>
        {mod.version
          ? <span className="badge badge-accent">{mod.version}</span>
          : <span className="mono" style={{ color: 'var(--text-4)', fontSize: 12.5 }}>—</span>}
      </div>
      <div style={{ width: 134, marginLeft: 28 }}>
        {update ? (
          <button type="button" className="pill pill-info pill-pulse pill-btn"
            title={`${update.installed} → ${update.latest} · ${t('Open on Nexus Mods')}`}
            onClick={e => { e.stopPropagation(); window.api.openUrl(`https://www.nexusmods.com/tcgcardshopsimulator/mods/${update.modId}`); }}
            style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {t('Update Available')}
          </button>
        ) : (
          <span className="pill" style={{ color: 'var(--text-4)' }}
            title={latest ? `${t('Latest')}: ${latest}` : undefined}>
            {t('None')}
          </span>
        )}
      </div>
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
        {<button className="btn btn-danger btn-sm btn-icon" disabled={anyToggling} onClick={anyToggling ? undefined : onRemove} aria-label={t('Remove')}>
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
