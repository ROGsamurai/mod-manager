import { useState } from 'react';
import { useI18n } from '../i18n';

const SUGGESTED_MODS = [
  { name:'Pre-configured BepInEx with Configuration Manager', description:'Pre-configured BepInEx with Configuration Manager preinstalled.', category:'Core / Required', nexusUrl:'https://www.nexusmods.com/tcgcardshopsimulator/mods/2' },
  { name:'Enhanced Prefab Loader', description:'Enhanced Prefab loader is a modders tool to allow other modders to more easily add new items to the game.', category:'Core / Required', nexusUrl:'https://www.nexusmods.com/tcgcardshopsimulator/mods/496' },
  { name:'Phone Overhaul', description:'Overhauls the Phone, turning it into a Smartphone. Gives modders an API framework to make new Apps.', category:'Core / Required', nexusUrl:'https://www.nexusmods.com/tcgcardshopsimulator/mods/685' },
  { name:'Holographic Overhaul', description:'Allows you to replace in-game Holographics with your own hotswap-able live PNGs using my own custom shader.', category:'Overhauls', nexusUrl:'https://www.nexusmods.com/tcgcardshopsimulator/mods/617' },
  { name:'Grading Overhaul', description:'Completely reworks the grading system.', category:'Overhauls', nexusUrl:'https://www.nexusmods.com/tcgcardshopsimulator/mods/612' },
  { name:'Collection Tracker', description:'Collection Tracker is a comprehensive card collection management mod that replaces the vanilla restock shop with a fully custom interface.', category:'UI / QoL', nexusUrl:'https://www.nexusmods.com/tcgcardshopsimulator/mods/867' },
  { name:'Yu-Gi-Oh Expansions', description:'Adds various textures (Cards, Packs, Boxes etc...) in the game to Yu-Gi-Oh themed ones.', category:'Content Packs', nexusUrl:'https://www.nexusmods.com/tcgcardshopsimulator/mods/987' },
  { name:'Yu-Gi-Oh Accessories', description:'Adds various textures (Starter Decks, Manga, Playmats etc...) in the game to Yu-Gi-Oh themed ones.', category:'Content Packs', nexusUrl:'https://www.nexusmods.com/tcgcardshopsimulator/mods/988' },
  { name:'RTCGO Custom TV', description:'Custom Television by Real TCG Overhaul.', category:'Content Packs', nexusUrl:'https://www.nexusmods.com/tcgcardshopsimulator/mods/895' },
  { name:'TextureReplacer', description:'A simple mod with which you can easily replace textures, meshes and data.', category:'Core / Required', nexusUrl:'https://www.nexusmods.com/tcgcardshopsimulator/mods/69' },
  { name:'ArtExpander', description:'Unique art for every border, expansion, and holographics. Unique white/black ghost art. Animated cards. Custom foil mask for each card.', category:'Visuals', nexusUrl:'https://www.nexusmods.com/tcgcardshopsimulator/mods/417' },
  { name:'Schwarz Shelves Set', description:'Add 4 new shelf options to the game for more compact organization!', category:'Content Packs', nexusUrl:'https://www.nexusmods.com/tcgcardshopsimulator/mods/908' },
  { name:'Showcase', description:'BIGGER CARDS for showing off in display cases!', category:'Visuals', nexusUrl:'https://www.nexusmods.com/tcgcardshopsimulator/mods/408' },
  { name:'Enhanced Number Formatter', description:'Improves number readability across the game with region formatting and optional cleaner whole numbers.', category:'UI / QoL', nexusUrl:'https://www.nexusmods.com/tcgcardshopsimulator/mods/755' },
  { name:'Put It Back', description:'From EnhancedQOL. Put it back - Allows you to put cards back into the binder without having to close and reopen the binder.', category:'UI / QoL', nexusUrl:'https://www.nexusmods.com/tcgcardshopsimulator/mods/449' },
];

const CATEGORY_ICONS = { 'Core / Required':'🔧', 'Overhauls':'⚡', 'Content Packs':'🃏', 'Visuals':'🎨', 'UI / QoL':'📱' };

export default function SuggestedMods() {
  const { t, tMod } = useI18n();
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  const categories = ['All', ...new Set(SUGGESTED_MODS.map(m => m.category))];

  const filtered = SUGGESTED_MODS.filter(m => {
    if (filter !== 'All' && m.category !== filter) return false;
    const translated = tMod(m.name, m.description);
    if (search && !translated.name.toLowerCase().includes(search.toLowerCase()) && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>⭐ {t('Recommended Mods')}</div>
          <div style={{ fontSize: 14, color: 'var(--text-3)', marginTop: 2 }}>{t('Curated list of recommended mods. Click download to get them from Nexus Mods.')}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, padding: '12px 20px', background: '#232323', borderBottom: '1px solid var(--border)', flexShrink: 0, alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>{t('Category')}</span>
          <select className="select" value={filter} onChange={e => setFilter(e.target.value)}>
            {categories.map(c => <option key={c} value={c}>{c === 'All' ? t('All') : t(c)}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>{t('SEARCH')}</span>
          <input className="input" placeholder={t('Filter by name...')} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((mod, i) => {
            const translated = tMod(mod.name, mod.description);
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <div style={{ width: 44, height: 44, borderRadius: 'var(--radius)', background: 'var(--bg-active)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                  {CATEGORY_ICONS[mod.category] || '📦'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{translated.name}</span>
                  <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 3, lineHeight: 1.5 }}>{translated.description}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 3 }}>{t(mod.category)}</div>
                </div>
                <button className="btn btn-accent" onClick={() => window.api.openUrl(mod.nexusUrl)} style={{ flexShrink: 0 }}>⬇️ {t('Download')}</button>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 50, color: 'var(--text-3)' }}>
              <div style={{ fontSize: 44, marginBottom: 10, opacity: .3 }}>⭐</div>
              <div style={{ fontSize: 17 }}>{t('No mods match your filter')}</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)', fontSize: 13, color: 'var(--text-4)', flexShrink: 0 }}>
        {SUGGESTED_MODS.length} {t('recommended mods')} · {t('Downloads open on Nexus Mods in your browser')}
      </div>
    </div>
  );
}
