import { useState, useEffect, useMemo, useRef } from 'react';
import { useI18n } from '../i18n';

/**
 * EPL .json Editor.
 *
 * Finds the Enhanced Prefab Loader .json files in the game folder (inside any
 * folder ending in "_prefabloader") and lets people change their values with
 * plain labels instead of raw JSON. The first save of a file keeps its
 * original, and "Restore original" puts it back in one click.
 *
 * Every field shows the file's own key name under its friendly label, so a
 * mod author can still match what they see to the file.
 */

// ── Field descriptions ───────────────────────────────────────────────────────
// label + hint shown for known keys. Unknown keys fall back to the key itself
// split into words ("MaxTextureSize" → "Max Texture Size").
const FIELDS = {
  Name: ['Name', 'The name shown in the game.'],
  ItemCategory: ['Category', 'Where the product is listed in the shop.'],
  BaseCost: ['Base cost', 'What one costs to buy from the shop app.'],
  LicensePrice: ['License price', 'What it costs to unlock this product.'],
  LicenseLevelRequirement: ['Unlock level', 'Shop level needed before it can be unlocked.'],
  MinMarketPricePercent: ['Lowest market price', 'Lowest market price, as a multiple of the cost (1.5 = 150%).'],
  MaxMarketPricePercent: ['Highest market price', 'Highest market price, as a multiple of the cost (2.5 = 250%).'],
  FollowItemPrice: ['Copy price from', 'Uses the price of this game item instead. "None" keeps its own price.'],
  AutoSetBoxPrice: ['Price box from its packs', 'Works the box price out from the packs inside it.'],
  HideTillUnlocked: ['Hidden until unlocked', 'Keeps it out of the shop until it is unlocked.'],
  IsBigBox: ['Sold in big boxes', ''],
  PhoneAppId: ['Shop app', 'Which phone shop app sells it.'],
  CardExpansion: ['Card set', 'The card set its packs are opened from.'],
  CanHaveDuplicates: ['Duplicates in a pack', 'Whether one pack can hold the same card twice.'],
  CanHaveGodPacks: ['God packs', 'Whether rare "god packs" can appear.'],
  GodPackPercentage: ['God pack chance', 'Chance of a god pack, from 0 to 1 (0.0002 = 0.02%).'],
  PackGenerationStrategy: ['How packs are filled', ''],
  SpawnsPackType: ['Packs inside', 'The pack product this box is filled with.'],
  SlotWeights: ['Pack odds', 'For each card slot in a pack: how likely each rarity is.'],
  // Prefabs
  Price: ['Price', 'What it costs to buy.'],
  LevelRequirement: ['Unlock level', 'Shop level needed before it can be bought.'],
  AddItemToFurnitureShop: ['Sold in the furniture shop', ''],
  Description: ['Description', ''],
  DecoBonus: ['Decoration bonus', 'How much it adds to the shop\'s decoration score.'],
  DecoType: ['Decoration type', ''],
  // Card sets
  MenuCategory: ['Menu name', 'The set name shown in menus and the binder.'],
  TradeUnlockLevel: ['Trade unlock level', 'Shop level needed before customers trade cards from this set.'],
  CardPriceStrategy: ['Card prices', 'How card prices are worked out.'],
  RarityDrivenFloor: ['Lowest card price', 'Price of the cheapest rarity.'],
  RarityDrivenStepSize: ['Price step per rarity', 'Each rarity up costs this many times more.'],
  RarityDrivenBorderMultiplierBase: ['Border price boost', 'How much rarer borders raise the price.'],
  RarityDrivenFoilMultiplier: ['Foil price boost', 'How many times more a foil card is worth.'],
  DefaultBorderMultiplierBase: ['Border price boost', 'How much rarer borders raise the price.'],
  DefaultFoilMultiplier: ['Foil price boost', 'How many times more a foil card is worth.'],
  HasRandomFoils: ['Random foils', 'Whether any card can randomly be foil.'],
  FoilChance: ['Random foil chance', 'From 0 to 1.'],
  Rarities: ['Rarities', 'The rarities this set uses, one per line.'],
  // Cards
  Rarity: ['Rarity', ''],
  BorderType: ['Border', ''],
  IsFoil: ['Foil', ''],
  // Custom shops
  AppDisplayName: ['App name', 'The name shown on the phone.'],
};

// Keys that link things together inside EPL (and to other mods). Changing one
// can break the pack, so they are read-only unless "Show all fields" is on,
// and marked even then.
const LINK_KEYS = new Set(['BundleId', 'ItemType', 'PrefabName', 'ObjectType', 'DecoObject', 'SpriteName', 'Sprite',
  'FoilMask', 'CardbackSprite', 'Mesh', 'MeshSecondary', 'MeshToUse', 'Material', 'MaterialSecondary', 'MaterialList',
  'PackType', 'CardExpansion', 'SpawnsPackType', 'PhoneAppId', 'AppIcon', 'AppInnerBGImage', 'AppOuterBGImage',
  'SiteLogo', 'SiteHeader', 'SiteBackground', 'Texture', 'RoughnessMap', 'NormalMap', 'CardBack', 'PlayCardMaterials']);

// The fields shown straight away for each kind of entry. Everything else is
// under "Show all fields".
const BASIC = {
  Items: ['Name', 'ItemCategory', 'BaseCost', 'LicensePrice', 'LicenseLevelRequirement', 'MinMarketPricePercent',
    'MaxMarketPricePercent', 'FollowItemPrice', 'AutoSetBoxPrice', 'HideTillUnlocked'],
  ItemsPack: ['CanHaveDuplicates', 'CanHaveGodPacks', 'GodPackPercentage'],
  Prefabs: ['Name', 'Price', 'LevelRequirement', 'AddItemToFurnitureShop', 'DecoBonus', 'Description'],
  CardExpansions: ['Name', 'MenuCategory', 'TradeUnlockLevel', 'CardPriceStrategy', 'RarityDrivenFloor',
    'RarityDrivenStepSize', 'RarityDrivenBorderMultiplierBase', 'RarityDrivenFoilMultiplier', 'HasRandomFoils', 'FoilChance'],
  CustomShops: ['AppDisplayName'],
};
const KNOWN_BORDERS = ['Base', 'FirstEdition', 'Silver', 'Gold', 'EX', 'FullArt'];
const SECTIONS = [
  { key: 'Items', label: 'Products', hint: 'Things the shop sells: packs, boxes, accessories, figurines.' },
  { key: 'Prefabs', label: 'Decorations', hint: 'Furniture and decorations placed in the shop.' },
  { key: 'CardExpansions', label: 'Card sets', hint: 'Card sets with their cards, rarities and prices.' },
  { key: 'CustomShops', label: 'Shop app', hint: 'The phone app these products are sold in.' },
];

const words = k => String(k).replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').replace(/([a-zA-Z])(\d)/g, '$1 $2');
const pretty = v => (typeof v === 'number' && Number.isFinite(v) ? String(Number(v.toPrecision(7))) : String(v ?? ''));
const isVec = v => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0
  && Object.keys(v).every(k => ['x', 'y', 'z', 'w', 'r', 'g', 'b', 'a'].includes(k)) && Object.values(v).every(n => typeof n === 'number');
const isNumMap = v => v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every(n => typeof n === 'number');
const isTable = v => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0 && Object.values(v).every(isNumMap);

/** Immutable set at a path, copying only the objects along the way. */
function setIn(obj, path, value) {
  if (!path.length) return value;
  const [k, ...rest] = path;
  const copy = Array.isArray(obj) ? obj.slice() : { ...obj };
  copy[k] = setIn(obj[k], rest, value);
  return copy;
}
const getIn = (obj, path) => path.reduce((o, k) => (o == null ? o : o[k]), obj);

// ── Small inputs ─────────────────────────────────────────────────────────────

function Switch({ on, onChange, disabled }) {
  return (
    <button type="button" role="switch" aria-checked={!!on} disabled={disabled} onClick={() => onChange(!on)}
      style={{ width: 40, height: 22, borderRadius: 11, position: 'relative', flexShrink: 0, cursor: disabled ? 'default' : 'pointer', padding: 0,
        border: `1px solid ${on ? 'var(--accent)' : 'var(--border-2)'}`, background: on ? 'var(--accent)' : 'var(--bg-elevated)', transition: 'all .15s', opacity: disabled ? .5 : 1 }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 20 : 2, width: 16, height: 16, borderRadius: '50%', transition: 'left .15s',
        background: on ? 'var(--on-accent)' : 'var(--text-3)' }} />
    </button>
  );
}

/**
 * A number field that keeps what is typed while it is being typed, and only
 * hands a number back when the text is a valid number. A value that is not
 * touched is never rewritten, so 1.79999995 stays exactly as the file had it.
 */
function NumberInput({ value, onChange, onValid, disabled, small }) {
  const [text, setText] = useState(pretty(value));
  const shown = useRef(pretty(value));
  useEffect(() => { if (pretty(value) !== shown.current) { shown.current = pretty(value); setText(pretty(value)); } }, [value]);
  const valid = text.trim() !== '' && Number.isFinite(Number(text));
  useEffect(() => { onValid?.(valid); }, [valid]);
  return (
    <input className="input mono" inputMode="decimal" value={text} disabled={disabled}
      onChange={e => {
        const t = e.target.value; setText(t);
        if (t.trim() !== '' && Number.isFinite(Number(t))) { shown.current = t; onChange(Number(t)); }
      }}
      style={{ padding: small ? '5px 8px' : undefined, fontSize: small ? 12.5 : 13.5, width: small ? 100 : '100%',
        borderColor: valid ? undefined : 'var(--red-bright)' }} />
  );
}

// ── One field ────────────────────────────────────────────────────────────────

function Field({ k, value, path, onSet, onValid, showAll, options, t }) {
  const [label, hint] = FIELDS[k] || [words(k), ''];
  const linked = LINK_KEYS.has(k);
  const locked = linked && !showAll;
  const set = v => onSet(path, v);
  let control;
  if (typeof value === 'boolean') control = <Switch on={value} onChange={set} disabled={locked} />;
  else if (typeof value === 'number') control = <NumberInput value={value} onChange={set} onValid={ok => onValid(path, ok)} disabled={locked} />;
  else if (typeof value === 'string') {
    control = options?.length
      ? <select className="select" value={value} disabled={locked} onChange={e => set(e.target.value)} style={{ width: '100%' }}>
          {[...new Set([value, ...options])].map(o => <option key={o} value={o}>{o || '—'}</option>)}
        </select>
      : (k === 'Description' && !locked
        ? <textarea className="textarea" rows={2} value={value} onChange={e => set(e.target.value)} />
        : <input className="input" value={value} disabled={locked} onChange={e => set(e.target.value)} style={{ fontSize: 13.5 }} />);
  } else if (Array.isArray(value) && value.every(x => typeof x === 'string')) {
    control = <textarea className="textarea mono" rows={Math.min(8, Math.max(2, value.length))} disabled={locked}
      value={value.join('\n')} onChange={e => set(e.target.value.split('\n').map(s => s.trim()).filter(Boolean))}
      style={{ fontSize: 12.5 }} />;
  } else if (isVec(value)) {
    control = <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {Object.entries(value).map(([ax, n]) => (
        <label key={ax} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-3)' }}>
          <span className="mono">{ax}</span><NumberInput small value={n} disabled={locked} onChange={v => onSet([...path, ax], v)} onValid={ok => onValid([...path, ax], ok)} />
        </label>))}
    </div>;
  } else if (value === null || value === undefined) {
    control = <span style={{ fontSize: 13, color: 'var(--text-4)' }}>{t('empty')}</span>;
  } else if (Array.isArray(value)) {
    control = <span style={{ fontSize: 13, color: 'var(--text-4)' }}>{value.length === 0 ? t('empty list') : `${value.length} ${t('entries')}`}</span>;
  } else if (isNumMap(value)) {
    control = Object.keys(value).length === 0
      ? <span style={{ fontSize: 13, color: 'var(--text-4)' }}>{t('empty')}</span>
      : <WeightsRow row={value} path={path} onSet={onSet} onValid={onValid} t={t} />;
  } else {
    control = <span style={{ fontSize: 13, color: 'var(--text-4)' }}>{`${Object.keys(value).length} ${t('values')}`}</span>;
  }
  const wide = (Array.isArray(value) && value.length) || isNumMap(value) || k === 'Description';
  return (
    <div style={{ gridColumn: wide ? '1 / -1' : undefined, display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t(label)}</span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-4)' }}>{k}</span>
        {linked && <span className="pill" title={t('Used to link things together. Changing it can break the mod.')} style={{ fontSize: 10.5, padding: '0 7px', color: 'var(--accent)' }}>{t('link')}</span>}
      </div>
      {control}
      {hint && <span style={{ fontSize: 12, color: 'var(--text-4)', lineHeight: 1.4 }}>{t(hint)}</span>}
    </div>
  );
}

/** One row of weights (rarity → weight), with each one's share as a percentage. */
function WeightsRow({ row, path, onSet, onValid, t }) {
  const total = Object.values(row).reduce((a, b) => a + (Number(b) || 0), 0);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {Object.entries(row).map(([r, w]) => (
        <label key={r} style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11.5, color: 'var(--text-3)' }}>
          <span className="truncate" style={{ maxWidth: 120 }} title={r}>{r}</span>
          <NumberInput small value={w} onChange={v => onSet([...path, r], v)} onValid={ok => onValid([...path, r], ok)} />
          <span className="mono" style={{ color: w > 0 ? 'var(--info-bright)' : 'var(--text-4)' }}>{total > 0 ? `${(w / total * 100).toFixed(w / total < 0.01 && w > 0 ? 3 : 1)}%` : '—'}</span>
        </label>))}
    </div>
  );
}

/** Pack odds: one block per card slot, with each rarity's chance. */
function PackOdds({ value, path, onSet, onValid, t }) {
  const slots = Object.entries(value || {});
  if (!slots.length) return null;
  return (
    <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{t('Pack odds')}</span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-4)' }}>SlotWeights</span>
      </div>
      <span style={{ fontSize: 12, color: 'var(--text-4)' }}>{t('For each card slot in a pack: how likely each rarity is. The percentages update as you type.')}</span>
      {slots.map(([slot, row]) => (
        <div key={slot} style={{ padding: '10px 12px', borderRadius: 'var(--radius)', background: 'var(--bg-base)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>{words(slot)}</div>
          <WeightsRow row={row} path={[...path, slot]} onSet={onSet} onValid={onValid} t={t} />
        </div>))}
    </div>
  );
}

// ── One entry (product, decoration, card set, shop) ──────────────────────────

function Entry({ section, entry, index, onSet, onValid, open, onToggle, t, borderOptions, notify, fileName }) {
  const [showAll, setShowAll] = useState(false);
  const base = [section, index];
  const isPack = section === 'Items' && entry.IsCardPack;
  let basic = (BASIC[section] || []).slice();
  if (isPack) basic = basic.concat(BASIC.ItemsPack);
  // A card set shows the price settings of the strategy it uses.
  if (section === 'CardExpansions' && entry.CardPriceStrategy !== 'RarityDriven') {
    basic = basic.filter(k => !k.startsWith('RarityDriven')).concat(['DefaultBorderMultiplierBase', 'DefaultFoilMultiplier']);
  }
  basic = basic.filter(k => k in entry);
  const special = new Set(['SlotWeights', 'Cards']);
  const rest = Object.keys(entry).filter(k => !basic.includes(k) && !special.has(k));
  const title = entry.Name || entry.AppDisplayName || `${t('Entry')} ${index + 1}`;
  const summary = section === 'Items'
    ? [entry.IsCardPack ? t('Card pack') : entry.IsCardBox ? t('Card box') : entry.ItemCategory, typeof entry.LicenseLevelRequirement === 'number' ? `${t('Unlock level')} ${entry.LicenseLevelRequirement}` : null].filter(Boolean).join(' · ')
    : section === 'Prefabs' ? [entry.DecoType, typeof entry.Price === 'number' ? `${t('Price')} ${pretty(entry.Price)}` : null].filter(Boolean).join(' · ')
    : section === 'CardExpansions' ? `${(entry.Cards || []).length} ${t('cards')}` : (entry.PhoneAppId || '');
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', flexShrink: 0 }}>
      <button type="button" onClick={onToggle} aria-expanded={open}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'transparent', border: 'none', color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2.4" aria-hidden="true" style={{ flexShrink: 0, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}><path d="M9 6l6 6-6 6" /></svg>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="truncate" style={{ display: 'block', fontSize: 14.5, fontWeight: 600 }}>{title}</span>
          {summary && <span className="truncate" style={{ display: 'block', fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>{summary}</span>}
        </span>
      </button>
      {open && (
        <div style={{ padding: '4px 16px 16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14, paddingTop: 12 }}>
            {basic.map(k => <Field key={k} k={k} value={entry[k]} path={[...base, k]} onSet={onSet} onValid={onValid} showAll={showAll} t={t}
              options={k === 'CardPriceStrategy' ? ['Default', 'RarityDriven'] : undefined} />)}
            {isPack && <PackOdds value={entry.SlotWeights} path={[...base, 'SlotWeights']} onSet={onSet} onValid={onValid} t={t} />}
          </div>
          {section === 'CardExpansions' && Array.isArray(entry.Cards) && (
            <CardsTable notify={notify} fileName={fileName} expansion={entry} cards={entry.Cards} rarities={entry.Rarities || []} borders={borderOptions} path={[...base, 'Cards']} onSet={onSet} t={t} />
          )}
          {rest.length > 0 && (
            <div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAll(v => !v)}>
                {showAll ? t('Hide extra fields') : `${t('Show all fields')} (${rest.length})`}
              </button>
              {showAll && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--accent)', padding: '8px 12px', borderRadius: 'var(--radius)', background: 'var(--accent-soft)', border: '1px solid var(--accent-border)' }}>
                    {t('Fields marked "link" connect this entry to models, textures and other entries. Change them only if you know what they point to.')}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14 }}>
                    {rest.map(k => (isTable(entry[k])
                      ? <PackOdds key={k} value={entry[k]} path={[...base, k]} onSet={onSet} onValid={onValid} t={t} />
                      : <Field key={k} k={k} value={entry[k]} path={[...base, k]} onSet={onSet} onValid={onValid} showAll t={t} />))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Card price preview ───────────────────────────────────────────────────────
// The same formulas as the EPL bundle tool (BundleVerificationWindow.cs,
// DisplayCardPrice and GenerateCardMarketPrice*), so the range shown here is
// the range the game generates a card's market price in.
const BORDER_INDEX = { Base: 0, FirstEdition: 1, Silver: 2, Gold: 3, EX: 4, FullArt: 5 };
const lerp = (a, b, t) => a + (b - a) * Math.min(1, Math.max(0, t));   // Unity's Mathf.Lerp clamps t
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** [min, max] market price for one card, or null when the API supplies prices. */
function cardPriceRange(card, exp, isFoil) {
  if (exp.CardPriceStrategySuppliedByApi) return null;
  const rarities = Array.isArray(exp.Rarities) ? exp.Rarities : [];
  const ri = Math.max(0, rarities.indexOf(card.Rarity));
  const rc = rarities.length;
  const b = BORDER_INDEX[card.BorderType] ?? 0;   // unknown border → Base, as the tool does
  if (exp.CardPriceStrategy === 'RarityDriven') {
    const base = num(exp.RarityDrivenFloor, 4) + ri * num(exp.RarityDrivenStepSize, 1026);
    const v = base * Math.pow(num(exp.RarityDrivenBorderMultiplierBase, 1.15), b) * (isFoil ? num(exp.RarityDrivenFoilMultiplier, 1.4) : 1);
    return [v * lerp(0.05, 0.7, ri / 20), v * 1.3];
  }
  const pct = rc > 1 ? ri / (rc - 1) : 0.5;
  const v = (1 + pct) * Math.pow(num(exp.DefaultBorderMultiplierBase, 3.15), b) * (1 + Math.pow(pct, 1.6) * 4)
    * (isFoil ? num(exp.DefaultFoilMultiplier, 2.9) : 1);
  return [v * lerp(0.2, 0.85, b / 5), v * 1.15];
}
// t() with {name} placeholders, so translations can put the numbers where their grammar needs them.
const tf = (t, key, vals) => Object.entries(vals).reduce((str, [k, v]) => str.split(`{${k}}`).join(String(v)), t(key));
const fmtPrice = r => (r ? `${r[0].toFixed(2)} – ${r[1].toFixed(2)}` : '—');

// ── Cards ⇄ spreadsheet ──────────────────────────────────────────────────────
// Columns are the cards' own keys (CardNumber, Name, Rarity, BorderType,
// IsFoil, ...), so a sheet maps 1:1 onto the file. Price columns are added on
// export for convenience and ignored on import.
const PRICE_COLS = ['PriceMin', 'PriceMax', 'FoilPriceMin', 'FoilPriceMax'];

function cardColumns(cards) {
  const cols = [];
  for (const c of cards) for (const k of Object.keys(c || {})) if (!cols.includes(k)) cols.push(k);
  return cols;
}

function cardsToTable(cards, exp) {
  const cols = cardColumns(cards);
  const api = !!exp.CardPriceStrategySuppliedByApi;
  const extra = api ? [] : exp.HasRandomFoils ? PRICE_COLS : PRICE_COLS.slice(0, 2);
  const rows = cards.map(c => {
    const row = cols.map(k => (c[k] === undefined || c[k] === null ? '' : (typeof c[k] === 'object' ? JSON.stringify(c[k]) : String(c[k]))));
    if (!api) {
      const r = cardPriceRange(c, exp, exp.HasRandomFoils ? false : !!c.IsFoil);
      row.push(r[0].toFixed(2), r[1].toFixed(2));
      if (exp.HasRandomFoils) { const f = cardPriceRange(c, exp, true); row.push(f[0].toFixed(2), f[1].toFixed(2)); }
    }
    return row;
  });
  return [cols.concat(extra), ...rows];
}

const cell = (v, sep) => (/["\r\n]/.test(v) || v.includes(sep) || /^\s|\s$/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const toDelimited = (table, sep) => table.map(r => r.map(v => cell(String(v), sep)).join(sep)).join('\r\n') + '\r\n';

/** CSV / TSV parser with quoted fields. The separator is taken from the header line. */
function parseDelimited(text) {
  const src = String(text || '').replace(/^\uFEFF/, '');
  const first = src.split(/\r?\n/)[0] || '';
  const count = ch => first.split(ch).length - 1;
  const sep = [['\t', count('\t')], [';', count(';')], [',', count(',')]].sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], v = '', q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"') { if (src[i + 1] === '"') { v += '"'; i++; } else q = false; }
      else v += c;
      continue;
    }
    if (c === '"' && v === '') { q = true; continue; }
    if (c === sep) { row.push(v); v = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { row.push(v); rows.push(row); row = []; v = ''; continue; }
    v += c;
  }
  if (v !== '' || row.length) { row.push(v); rows.push(row); }
  return rows.filter(r => r.some(x => String(x).trim() !== ''));
}

const keyOf = h => String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const BOOL = { true: true, yes: true, y: true, '1': true, x: true, false: false, no: false, n: false, '0': false, '': false };

/**
 * Turn a pasted or imported table back into cards. Each value takes the type
 * the file already uses for that key (number, true/false, text), so a sheet
 * cannot turn a number into text by accident.
 *
 * Rows are matched to the existing cards by CardNumber when the sheet has that
 * column, otherwise by Sprite, otherwise by Name. A matched row updates that
 * card and keeps any key the sheet leaves out; a row that matches nothing is a
 * new card. Cards the sheet does not mention are listed separately, so the
 * caller decides whether to keep or remove them. Nothing here changes the file.
 */
function tableToCards(table, existing, rarities) {
  if (table.length < 2) return { error: 'The table needs a header row and at least one card.' };
  const known = cardColumns(existing);
  const types = {};
  for (const k of known) { const ex = existing.find(c => c && c[k] !== undefined && c[k] !== null); types[k] = ex ? (Array.isArray(ex[k]) ? 'json' : typeof ex[k]) : 'string'; }
  const header = table[0].map(h => String(h).trim());
  const map = header.map(h => known.find(k => keyOf(k) === keyOf(h)) || (PRICE_COLS.some(p => keyOf(p) === keyOf(h)) ? null : undefined));
  const unknown = header.filter((h, i) => map[i] === undefined && h);
  if (!map.some(Boolean)) return { error: 'None of the columns match. Keep the header row from an export (CardNumber, Name, Rarity, BorderType, IsFoil, ...).' };
  if (!map.includes('Name')) return { error: 'The table needs a Name column.' };
  const matchKey = ['CardNumber', 'Sprite', 'Name'].find(k => map.includes(k) && known.includes(k));
  const keyStr = v => String(v ?? '').trim().toLowerCase();
  const byKey = new Map();
  existing.forEach((c, i) => { const k = keyStr(c?.[matchKey]); if (k !== '' && !byKey.has(k)) byKey.set(k, i); });
  const blank = Object.fromEntries(known.map(k => [k, types[k] === 'number' ? 0 : types[k] === 'boolean' ? false : types[k] === 'json' ? [] : '']));
  const problems = [];
  const used = new Set();
  let updated = 0, added = 0;
  const hits = [];
  const cards = table.slice(1).map((r, ri) => {
    const colIdx = map.indexOf(matchKey);
    const hit = byKey.get(keyStr(r[colIdx]));
    const isMatch = hit !== undefined && !used.has(hit);
    if (isMatch) { used.add(hit); updated++; } else added++;
    hits.push(isMatch ? hit : -1);
    const card = isMatch ? { ...existing[hit] } : { ...blank };
    map.forEach((k, ci) => {
      if (!k) return;
      const raw = String(r[ci] ?? '').trim();
      const ty = types[k] || 'string';
      if (ty === 'number') {
        const n = Number(raw.replace(',', '.'));
        if (raw === '' || !Number.isFinite(n)) { problems.push(`Row ${ri + 2}: ${k} "${raw}" is not a number`); return; }
        card[k] = n;
      } else if (ty === 'boolean') {
        const b = BOOL[raw.toLowerCase()];
        if (b === undefined) { problems.push(`Row ${ri + 2}: ${k} "${raw}" is not true or false`); return; }
        card[k] = b;
      } else if (ty === 'json') {
        try { card[k] = raw ? JSON.parse(raw) : []; } catch { problems.push(`Row ${ri + 2}: ${k} could not be read`); }
      } else card[k] = raw;
    });
    // A rarity or border the set does not have is not applied: the card keeps
    // its current one (a new card gets the set's first rarity / Base).
    const prev = isMatch ? existing[hit] : null;
    if (rarities.length && card.Rarity !== undefined && !rarities.includes(card.Rarity)) {
      problems.push(`Row ${ri + 2}: rarity "${card.Rarity}" is not one of this set's rarities`);
      card.Rarity = prev ? prev.Rarity : rarities[0];
    }
    if (card.BorderType && !(card.BorderType in BORDER_INDEX)) {
      problems.push(`Row ${ri + 2}: border "${card.BorderType}" is not a known border`);
      card.BorderType = prev ? prev.BorderType : 'Base';
    }
    if (!isMatch && known.includes('Sprite') && !card.Sprite) problems.push(`Row ${ri + 2}: new card "${card.Name}" has no Sprite, so it will have no picture`);
    return Object.fromEntries(known.map(k => [k, card[k]]));
  });
  const missing = existing.filter((_, i) => !used.has(i));
  return { cards, hits, missing, problems, unknown, updated, added, matchKey };
}

/** Every card of a set in one table: rarity, border, foil and its price range. */
function CardsTable({ expansion, cards, rarities, borders, path, onSet, t, notify, fileName }) {
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(60);
  const [pending, setPending] = useState(null);   // { cards, problems, unknown, source } waiting for confirmation
  const baseName = `${fileName ? fileName.replace(/\.json$/i, '') : 'cards'} - ${expansion.Name || 'cards'}`;
  const copyTable = async () => {
    const r = await window.api.eplCopy(toDelimited(cardsToTable(cards, expansion), '\t'));
    notify?.(r?.success ? tf(t, '{n} cards copied. Paste them into a spreadsheet.', { n: cards.length }) : (r?.error || t('Could not copy')), r?.success ? 'success' : 'error');
  };
  const exportCsv = async () => {
    const r = await window.api.eplExportCsv(toDelimited(cardsToTable(cards, expansion), ','), baseName);
    if (r?.success) notify?.(tf(t, 'Exported to {path}', { path: r.path }), 'success', 6000);
    else if (!r?.canceled) notify?.(r?.error || t('Could not export'), 'error');
  };
  const load = (text, source) => {
    const res = tableToCards(parseDelimited(text), cards, rarities);
    if (res.error) { notify?.(t(res.error), 'error', 7000); return; }
    setPending({ ...res, source, removeMissing: false });
  };
  const pasteTable = async () => {
    const r = await window.api.eplPaste();
    if (!r?.success || !String(r.text || '').trim()) { notify?.(t('The clipboard is empty. Copy the table in your spreadsheet first, including the header row.'), 'warn', 6000); return; }
    load(r.text, t('clipboard'));
  };
  const importCsv = async () => {
    const r = await window.api.eplImportCsv();
    if (r?.success) load(r.text, r.name);
    else if (!r?.canceled) notify?.(r?.error || t('Could not import'), 'error');
  };
  const apply = () => {
    // Keeping the other cards keeps the set's order: matched cards change in
    // place and new ones go at the end. Removing them uses the sheet's order.
    let next;
    if (pending.removeMissing) next = pending.cards;
    else {
      next = cards.slice();
      pending.cards.forEach((c, i) => { if (pending.hits[i] >= 0) next[pending.hits[i]] = c; else next.push(c); });
    }
    onSet(path, next);
    notify?.(tf(t, '{n} cards loaded. Save changes to write them to the file.', { n: next.length }), 'success', 6000);
    setPending(null);
  };
  const rows = cards.map((c, i) => ({ c, i })).filter(({ c }) => !q || String(c.Name || '').toLowerCase().includes(q.toLowerCase()));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{t('Cards')} <span className="mono" style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 400 }}>Cards · {cards.length}</span></span>
        <input className="input" placeholder={t('Find a card...')} value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 240, padding: '6px 10px', fontSize: 13 }} />
        <span style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={copyTable} title={t('Copies every card as a table you can paste into Excel, Google Sheets or LibreOffice.')}>{t('Copy table')}</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={pasteTable} title={t('Loads cards from a table copied from a spreadsheet. Include the header row.')}>{t('Paste table')}</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={exportCsv}>{t('Export CSV')}</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={importCsv}>{t('Import CSV')}</button>
        </span>
      </div>
      {pending && (
        <div style={{ padding: '12px 14px', borderRadius: 'var(--radius)', border: `1px solid ${pending.problems.length ? 'var(--red-border)' : 'var(--accent-border)'}`, background: pending.problems.length ? 'var(--red-soft)' : 'var(--accent-soft)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{tf(t, 'Load {n} cards from {source}?', { n: pending.cards.length, source: pending.source })}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
            {tf(t, '{updated} updated · {added} new', { updated: pending.updated, added: pending.added })}
            <span style={{ color: 'var(--text-4)' }}>{` · ${tf(t, 'matched by {key}', { key: pending.matchKey })}`}</span>
          </div>
          {pending.missing.length > 0 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-2)', cursor: 'pointer' }}>
              <input type="checkbox" checked={pending.removeMissing} onChange={e => setPending(p => ({ ...p, removeMissing: e.target.checked }))} />
              {tf(t, 'Remove the {n} cards that are not in the sheet', { n: pending.missing.length })}
            </label>
          )}
          {pending.unknown.length > 0 && <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{t('Columns ignored:')} <span className="mono">{pending.unknown.join(', ')}</span></div>}
          {pending.problems.length > 0 && (
            <div style={{ fontSize: 12.5, color: 'var(--red-bright)' }}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{tf(t, '{n} problems found. Values that could not be read or are not allowed keep their current value.', { n: pending.problems.length })}</div>
              {pending.problems.slice(0, 6).map((p, i) => <div key={i} className="mono" style={{ fontSize: 11.5 }}>{p}</div>)}
              {pending.problems.length > 6 && <div>{`+${pending.problems.length - 6}`}</div>}
            </div>
          )}
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{t('Nothing is written until you press Save changes, and Discard undoes it.')}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-accent btn-sm" onClick={apply}>{t('Load cards')}</button>
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => setPending(null)}>{t('Cancel')}</button>
          </div>
        </div>
      )}
      <span style={{ fontSize: 12, color: 'var(--text-4)' }}>
        {expansion.CardPriceStrategySuppliedByApi ? t('Card prices for this set are set by an API mod, so no price range can be shown.')
          : `${t('Price range: the range the game picks each card\'s market price from, worked out from its rarity, border and foil and the set\'s price settings above.')}${expansion.HasRandomFoils ? ` ${t('Random foils are on, so each card shows its normal range and, below it, its foil range.')}` : ''}`}
      </span>
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '44px minmax(120px, 1fr) 160px 120px 48px 150px', gap: 8, padding: '7px 10px', background: 'var(--bg-base)', fontSize: 11, fontWeight: 700, letterSpacing: .6, textTransform: 'uppercase', color: 'var(--text-4)' }}>
          <span>#</span><span>{t('Name')}</span><span>{t('Rarity')}</span><span>{t('Border')}</span><span>{t('Foil')}</span><span title={t('The range the game picks this card\'s market price from. It updates as you change the card or the set\'s price settings.')}>{t('Price range')}</span>
        </div>
        {rows.slice(0, limit).map(({ c, i }) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '44px minmax(120px, 1fr) 160px 120px 48px 150px', gap: 8, padding: '5px 10px', alignItems: 'center', borderTop: '1px solid var(--border)' }}>
            <span className="mono" style={{ fontSize: 12, color: 'var(--text-4)' }}>{typeof c.CardNumber === 'number' ? c.CardNumber : i}</span>
            <input className="input" value={c.Name ?? ''} onChange={e => onSet([...path, i, 'Name'], e.target.value)} style={{ padding: '5px 8px', fontSize: 13 }} />
            {'Rarity' in c
              ? <select className="select" value={c.Rarity} onChange={e => onSet([...path, i, 'Rarity'], e.target.value)} style={{ padding: '5px 8px', fontSize: 12.5, width: '100%' }}>
                  {[...new Set([c.Rarity, ...rarities])].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              : <span />}
            {'BorderType' in c
              ? <select className="select" value={c.BorderType} onChange={e => onSet([...path, i, 'BorderType'], e.target.value)} style={{ padding: '5px 8px', fontSize: 12.5, width: '100%' }}>
                  {[...new Set([c.BorderType, ...borders])].map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              : <span />}
            {'IsFoil' in c ? <Switch on={c.IsFoil} onChange={v => onSet([...path, i, 'IsFoil'], v)} /> : <span />}
            {expansion.CardPriceStrategySuppliedByApi
              ? <span style={{ fontSize: 12, color: 'var(--text-4)' }}>{t('Set by API')}</span>
              : expansion.HasRandomFoils
                ? <span className="mono" style={{ fontSize: 11.5, lineHeight: 1.35, color: 'var(--text-2)' }}>
                    <span style={{ display: 'block' }}>{fmtPrice(cardPriceRange(c, expansion, false))}</span>
                    <span style={{ display: 'block', color: 'var(--accent)' }} title={t('Foil')}>{fmtPrice(cardPriceRange(c, expansion, true))}</span>
                  </span>
                : <span className="mono" style={{ fontSize: 12, color: c.IsFoil ? 'var(--accent)' : 'var(--text-2)' }}>{fmtPrice(cardPriceRange(c, expansion, !!c.IsFoil))}</span>}
          </div>
        ))}
        {rows.length === 0 && <div style={{ padding: 14, fontSize: 13, color: 'var(--text-4)', textAlign: 'center' }}>{t('Nothing matches.')}</div>}
      </div>
      {rows.length > limit && <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setLimit(l => l + 100)}>{t('Show more')} ({rows.length - limit})</button>}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

const isEdited = f => f?.backup === 'edited' || f?.backup === 'outside';

export default function EplEditor({ notify, gameFound = true }) {
  const { t } = useI18n();
  const [files, setFiles] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [filter, setFilter] = useState('');
  const [sel, setSel] = useState(null);          // file row
  const [orig, setOrig] = useState(null);        // data as loaded
  const [data, setData] = useState(null);        // data being edited
  const [dirty, setDirty] = useState(false);
  const [invalid, setInvalid] = useState({});    // path → true while a number field holds bad text
  const [tab, setTab] = useState('Items');
  const [openIdx, setOpenIdx] = useState({});
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(null);        // 'save' | 'restore'
  const [confirmRestore, setConfirmRestore] = useState(false);
  // In-game price reset through the RTCGO Manager Bridge plugin.
  const [reset, setReset] = useState(null);      // { status, picked:Set, busy, results, error } while the panel is open

  const editedBundles = useMemo(() => {
    const m = new Map();
    for (const f of files) if (isEdited(f) && f.bundleId && !m.has(f.bundleId)) m.set(f.bundleId, f);
    return [...m.values()];
  }, [files]);
  const openReset = async () => {
    const r = await window.api.eplScan();
    const list = r?.success === false ? files : (r?.files || files);
    if (r?.success !== false) setFiles(list);
    const ids = [...new Set(list.filter(f => isEdited(f) && f.bundleId).map(f => f.bundleId))];
    const st = await window.api.eplBridgeStatus();
    setReset({ status: st || {}, picked: new Set(ids), busy: false, results: null, error: null });
  };
  const runReset = async () => {
    setReset(r => ({ ...r, busy: true, error: null, results: null }));
    const res = await window.api.eplResetPrices([...reset.picked]);
    setReset(r => ({ ...r, busy: false, results: res?.success ? res.results : null, error: res?.success ? null : (res?.error || 'Could not reset prices') }));
    if (res?.success) {
      const n = res.results.filter(x => x.status === 'reset').length;
      notify(tf(t, 'Prices reset for {n} bundles. Save in the game to keep them.', { n }), n ? 'success' : 'warn', 7000);
    }
  };

  // Latest values for the focus listener, which is registered once.
  const live = useRef({});
  live.current = { sel, dirty };
  const scan = async (quiet = false) => {
    if (!quiet) setScanning(true);
    try {
      const r = await window.api.eplScan();
      if (r?.success === false && r.error) { if (!quiet) notify(t(r.error), 'error'); return; }
      const list = (r?.files || []).map(f => ({ ...f }));
      setFiles(list);
      if (r?.bridge?.changed) notify(t('RTCGO Manager Bridge was added to the game so Reset prices in game works. Restart the game to load it.'), 'success', 8000);
      // The open file was overwritten on disk: show the new contents, unless
      // there are unsaved changes here (those are never thrown away).
      const { sel: cur, dirty: isDirty } = live.current;
      const fresh = cur && list.find(x => x.path === cur.path);
      if (fresh && !isDirty && (fresh.modifiedAt !== cur.modifiedAt || fresh.backup !== cur.backup)) {
        const rr = await window.api.eplRead(cur.path);
        if (rr?.success && live.current.sel?.path === cur.path && !live.current.dirty) {
          setSel(rr.info || fresh); setOrig(rr.data); setData(rr.data); setInvalid({}); setConfirmRestore(false);
        }
      } else if (fresh) setSel(s => (s && s.path === fresh.path ? { ...s, backup: fresh.backup, modifiedAt: fresh.modifiedAt } : s));
    } finally { if (!quiet) setScanning(false); setScanned(true); }
  };
  useEffect(() => { if (gameFound) scan(); }, [gameFound]);
  // Files copied into the game folder while the manager is open are picked up
  // when the window gets focus again.
  useEffect(() => {
    if (!gameFound) return undefined;
    const onFocus = () => { scan(true); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [gameFound]);

  const confirmLeave = () => !dirty || window.confirm(t('You have unsaved changes. Discard them?'));
  const open = async (f) => {
    if (sel?.path === f.path || !confirmLeave()) return;
    const r = await window.api.eplRead(f.path);
    if (!r?.success) { notify(r?.error || t('Could not read this file'), 'error'); return; }
    setSel(r.info || f); setOrig(r.data); setData(r.data); setDirty(false); setInvalid({}); setOpenIdx({}); setQ(''); setConfirmRestore(false);
    const first = SECTIONS.find(s => Array.isArray(r.data[s.key]) && r.data[s.key].length);
    setTab(first ? first.key : 'settings');
  };

  const onSet = (path, value) => { setData(d => setIn(d, path, value)); setDirty(true); };
  const onValid = (path, ok) => setInvalid(m => {
    const key = path.join('\u0001');
    if (ok && !m[key]) return m;
    const n = { ...m }; if (ok) delete n[key]; else n[key] = true; return n;
  });
  const badCount = Object.keys(invalid).length;

  const save = async () => {
    if (badCount) return;
    setBusy('save');
    try {
      const r = await window.api.eplSave(sel.path, data);
      if (!r?.success) { notify(r?.error || t('Could not save'), 'error'); return; }
      setOrig(data); setDirty(false);
      setSel(r.info || sel);
      setFiles(fs => fs.map(x => (x.path === sel.path ? (r.info || x) : x)));
      const savedMsg = r.backupCreated ? t('Saved. The original was kept, so you can restore it any time.') : t('Saved.');
      notify(r.bridge?.changed ? `${savedMsg} ${t('RTCGO Manager Bridge was added to the game so Reset prices in game works. Restart the game to load it.')}` : savedMsg, 'success', r.bridge?.changed ? 8000 : 5000);
    } finally { setBusy(null); }
  };
  const discard = () => { setData(orig); setDirty(false); setInvalid({}); };
  const restore = async () => {
    setBusy('restore');
    try {
      const r = await window.api.eplRestore(sel.path);
      if (!r?.success) { notify(t(r?.error || 'Could not restore'), 'error'); return; }
      const rr = await window.api.eplRead(sel.path);
      if (rr?.success) { setOrig(rr.data); setData(rr.data); setSel(rr.info); }
      setDirty(false); setInvalid({}); setConfirmRestore(false);
      setFiles(fs => fs.map(x => (x.path === sel.path ? (rr.info || x) : x)));
      notify(t('Original restored.'), 'success');
    } finally { setBusy(null); }
  };

  // File list, grouped by the mod folder above each _prefabloader folder.
  const groups = useMemo(() => {
    const ql = filter.toLowerCase();
    const m = new Map();
    for (const f of files) {
      if (ql && ![f.group, f.fileName, f.name].some(s => String(s || '').toLowerCase().includes(ql))) continue;
      if (!m.has(f.group)) m.set(f.group, []);
      m.get(f.group).push(f);
    }
    return [...m.entries()];
  }, [files, filter]);

  const countText = f => {
    const c = f.counts || {};
    const parts = [];
    if (c.items) parts.push(`${c.items} ${c.items === 1 ? t('product') : t('products')}`);
    if (c.prefabs) parts.push(`${c.prefabs} ${c.prefabs === 1 ? t('decoration') : t('decorations')}`);
    if (c.cards) parts.push(`${c.cards} ${t('cards')}`);
    return parts.join(' · ') || t('No products');
  };

  // Border names used anywhere in the open file, plus the common ones.
  const borderOptions = useMemo(() => {
    const s = new Set(KNOWN_BORDERS);
    for (const x of (data?.CardExpansions || [])) for (const c of (x.Cards || [])) if (c.BorderType) s.add(c.BorderType);
    return [...s];
  }, [data?.CardExpansions]);

  const list = data && tab !== 'settings' ? (data[tab] || []) : [];
  const shown = list.map((e, i) => ({ e, i })).filter(({ e }) => !q || String(e?.Name || e?.AppDisplayName || '').toLowerCase().includes(q.toLowerCase()));
  const topLevel = data ? Object.keys(data).filter(k => !Array.isArray(data[k]) || (data[k].every(x => typeof x === 'string'))) : [];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ padding: '24px 24px 16px', flexShrink: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h1 className="page-title">{t('EPL .json Editor')}</h1>
          <p className="page-sub">{t('Change prices, unlock levels, pack odds and cards in Enhanced Prefab Loader packs. The original of each file is kept the first time you save it.')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-ghost" onClick={() => (reset ? setReset(null) : openReset())} disabled={!gameFound}
            title={t('Resets the prices of every edited bundle in the running game at once, like EPL\'s Force Price Reset does for one bundle.')}>
            {t('Reset prices in game')}
            {editedBundles.length > 0 && <span className="pill pill-accent" style={{ fontSize: 11, padding: '0 7px' }}>{editedBundles.length}</span>}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => confirmLeave() && scan()} disabled={scanning || !gameFound}>
            {scanning && <span className="spinner" style={{ width: 13, height: 13 }} />}{t('Scan game folder')}
          </button>
        </div>
      </div>

      {reset && (() => {
        const st = reset.status;
        const started = st.startedAt ? Date.parse(st.startedAt) : NaN;
        const stale = f => Number.isFinite(started) && f.modifiedAt > started;
        const anyStale = editedBundles.some(f => reset.picked.has(f.bundleId) && stale(f));
        const statusText = { reset: t('Prices reset'), 'no-price-data': t('No prices saved yet, nothing to reset'), 'not-loaded': t('Not loaded in the game'), uninstalled: t('Uninstalled this session'), error: t('Failed') };
        const statusColor = { reset: 'var(--green-bright)', error: 'var(--red-bright)' };
        return (
          <div style={{ margin: '0 24px 16px', padding: 16, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-2)', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0, maxHeight: '45vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 15, fontWeight: 700, flex: 1 }}>{t('Reset prices in game')}</span>
              <button type="button" className="btn btn-quiet btn-sm" onClick={() => setReset(null)}>{t('Close')}</button>
            </div>
            {!st.running ? (
              <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
                {st.installed
                  ? t('Start the game and load your save, then open this again. The manager resets the prices through the RTCGO Manager Bridge plugin running in the game.')
                  : t('This needs the RTCGO Manager Bridge plugin in the game. The manager adds it the first time you save an edit. Save a change, start the game and load your save, then open this again.')}
                <div style={{ marginTop: 8 }}><button type="button" className="btn btn-ghost btn-sm" onClick={openReset}>{t('Check again')}</button></div>
              </div>
            ) : editedBundles.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{t('No edited bundles yet. Save a change to a file first; edited files are marked Edited in the list.')}</div>
            ) : (
              <>
                <div style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.5 }}>
                  {t('Throws away the current market prices of these bundles\' products and cards in your save and generates new ones from the bundle settings, the same as EPL\'s Force Price Reset. Save in the game afterwards to keep them.')}
                  {!st.eplReady && <div style={{ color: 'var(--accent)', marginTop: 4 }}>{t('Enhanced Prefab Loader is still loading. Wait until you are in your save.')}</div>}
                </div>
                {dirty && <div style={{ fontSize: 12.5, color: 'var(--accent)' }}>{t('The open file has unsaved changes. Save them first so the reset uses them after a game restart.')}</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {editedBundles.map(f => {
                    const r = reset.results?.find(x => x.bundleId === f.bundleId);
                    return (
                      <label key={f.bundleId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-base)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={reset.picked.has(f.bundleId)} disabled={reset.busy}
                          onChange={e => setReset(x => { const p = new Set(x.picked); if (e.target.checked) p.add(f.bundleId); else p.delete(f.bundleId); return { ...x, picked: p }; })} />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span className="truncate" style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>{f.name || f.fileName}</span>
                          <span className="truncate mono" style={{ display: 'block', fontSize: 11, color: 'var(--text-4)' }}>{f.group} · {f.fileName}</span>
                        </span>
                        {r ? <span style={{ fontSize: 12, fontWeight: 600, color: statusColor[r.status] || 'var(--text-3)' }} title={r.error || ''}>{statusText[r.status] || r.status}</span>
                          : stale(f) ? <span style={{ fontSize: 11.5, color: 'var(--accent)' }}>{t('Saved after the game started')}</span> : null}
                      </label>
                    );
                  })}
                </div>
                {anyStale && (
                  <div style={{ fontSize: 12.5, color: 'var(--accent)', padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', lineHeight: 1.45 }}>
                    {t('Some of these files were saved after the game started. EPL reads bundle files when the game starts, so restart the game first, or the new prices are made from the old settings.')}
                  </div>
                )}
                {reset.error && <div style={{ fontSize: 13, color: 'var(--red-bright)' }}>{t(reset.error)}</div>}
                <div>
                  <button type="button" className="btn btn-accent btn-sm" onClick={runReset} disabled={reset.busy || reset.picked.size === 0 || !st.eplReady}>
                    {reset.busy && <span className="spinner" style={{ width: 12, height: 12 }} />}{tf(t, 'Reset prices for {n} bundles', { n: reset.picked.size })}
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })()}

      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', borderTop: '1px solid var(--border)' }}>
        {/* File list */}
        <div style={{ width: 290, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: 10 }}>
            <input className="input" placeholder={t('Filter files...')} value={filter} onChange={e => setFilter(e.target.value)} style={{ fontSize: 13, padding: '7px 10px' }} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 10 }}>
            {!gameFound && <div style={{ padding: 16, fontSize: 13, color: 'var(--text-3)' }}>{t('Set the game location in Settings first.')}</div>}
            {gameFound && scanned && files.length === 0 && (
              <div style={{ padding: 16, fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>{t('No EPL .json files found. They are inside folders ending in "_prefabloader" under BepInEx.')}</div>
            )}
            {groups.map(([g, fs]) => (
              <div key={g}>
                <div className="truncate" title={g} style={{ padding: '10px 14px 4px', fontSize: 11, fontWeight: 700, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--text-4)' }}>{g}</div>
                {fs.map(f => {
                  const active = sel?.path === f.path;
                  return (
                    <button key={f.path} type="button" onClick={() => open(f)} title={f.rel}
                      style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2, padding: '7px 14px', textAlign: 'left', font: 'inherit', cursor: 'pointer', border: 'none',
                        borderLeft: `3px solid ${active ? 'var(--accent)' : 'transparent'}`, background: active ? 'var(--bg-elevated)' : 'transparent', color: 'inherit' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <span className="truncate mono" style={{ fontSize: 12.5, color: active ? 'var(--accent)' : 'var(--text-2)' }}>{f.fileName}</span>
                        {isEdited(f) && <span className="pill pill-accent" style={{ fontSize: 10, padding: '0 6px', flexShrink: 0 }} title={f.backup === 'outside' ? t('Changed in the game folder, not in the manager') : undefined}>{t('Edited')}</span>}
                      </span>
                      <span className="truncate" style={{ fontSize: 11.5, color: f.error ? 'var(--red-bright)' : 'var(--text-4)' }}>{f.error ? t('Cannot be read') : countText(f)}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Editor */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {!data ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 30, color: 'var(--text-3)', fontSize: 14, textAlign: 'center' }}>
              {files.length ? t('Pick a file on the left to edit it.') : ''}
            </div>
          ) : (
            <>
              <div style={{ padding: '16px 22px 12px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 18, fontWeight: 700 }} className="truncate">{data.Name || sel.fileName}</div>
                    <div className="mono truncate" style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 2 }} title={sel.rel}>{sel.rel}</div>
                    {sel.backup === 'outside' && <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 4 }}>{t('This file was changed in the game folder, not in the manager. Restore original puts back the version the manager had before.')}</div>}
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => window.api.eplShow(sel.path)}>{t('Show in folder')}</button>
                  {isEdited(sel) && !confirmRestore && (
                    <button type="button" className="btn btn-outline-accent btn-sm" onClick={() => setConfirmRestore(true)} disabled={!!busy}>{t('Restore original')}</button>
                  )}
                  {confirmRestore && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{t('Undo every change to this file?')}</span>
                      <button type="button" className="btn btn-danger btn-sm" onClick={restore} disabled={!!busy}>{busy === 'restore' && <span className="spinner" style={{ width: 12, height: 12 }} />}{t('Restore')}</button>
                      <button type="button" className="btn btn-quiet btn-sm" onClick={() => setConfirmRestore(false)}>{t('Cancel')}</button>
                    </span>
                  )}
                </div>
                <div role="tablist" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                  {SECTIONS.filter(s => Array.isArray(data[s.key]) && data[s.key].length).map(s => (
                    <button key={s.key} type="button" role="tab" aria-selected={tab === s.key} title={t(s.hint)}
                      onClick={() => { setTab(s.key); setQ(''); }}
                      className={`btn btn-sm ${tab === s.key ? 'btn-ghost' : 'btn-quiet'}`}
                      style={tab === s.key ? { color: 'var(--accent)', borderColor: 'var(--accent-border)', background: 'var(--accent-soft)' } : undefined}>
                      {t(s.label)} <span className="mono" style={{ fontSize: 11.5, opacity: .8 }}>{data[s.key].length}</span>
                    </button>
                  ))}
                  <button type="button" role="tab" aria-selected={tab === 'settings'} onClick={() => setTab('settings')}
                    className={`btn btn-sm ${tab === 'settings' ? 'btn-ghost' : 'btn-quiet'}`}
                    style={tab === 'settings' ? { color: 'var(--accent)', borderColor: 'var(--accent-border)', background: 'var(--accent-soft)' } : undefined}>
                    {t('File settings')}
                  </button>
                  {tab !== 'settings' && list.length > 6 && (
                    <input className="input" placeholder={t('Find by name...')} value={q} onChange={e => setQ(e.target.value)} style={{ marginLeft: 'auto', maxWidth: 220, padding: '6px 10px', fontSize: 13 }} />
                  )}
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {tab === 'settings' ? (
                  <div className="card" style={{ padding: 16, flexShrink: 0 }}>
                    <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 12 }}>{t('Settings for the whole pack. Most of these are for the mod author.')}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14 }}>
                      {topLevel.map(k => <Field key={k} k={k} value={data[k]} path={[k]} onSet={onSet} onValid={onValid} showAll={k !== 'BundleId'} t={t} />)}
                    </div>
                  </div>
                ) : (
                  <>
                    {shown.map(({ e, i }) => (
                      <Entry key={`${tab}-${i}`} section={tab} entry={e} index={i} onSet={onSet} onValid={onValid} t={t} borderOptions={borderOptions} notify={notify} fileName={sel?.fileName}
                        open={!!openIdx[`${tab}-${i}`] || list.length === 1}
                        onToggle={() => setOpenIdx(m => ({ ...m, [`${tab}-${i}`]: !m[`${tab}-${i}`] }))} />
                    ))}
                    {shown.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-4)' }}>{t('Nothing matches.')}</div>}
                  </>
                )}
              </div>

              {(dirty || badCount > 0) && (
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 22px', borderTop: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                  <span style={{ flex: 1, fontSize: 13, color: badCount ? 'var(--red-bright)' : 'var(--text-2)' }}>
                    {badCount ? t('Some numbers are not valid. Fix the fields marked in red to save.')
                      : isEdited(sel) ? t('Unsaved changes.') : t('Unsaved changes. Saving keeps the original so you can restore it.')}
                  </span>
                  <button type="button" className="btn btn-quiet" onClick={discard} disabled={!!busy}>{t('Discard')}</button>
                  <button type="button" className="btn btn-accent" onClick={save} disabled={!!busy || badCount > 0}>
                    {busy === 'save' && <span className="spinner" style={{ width: 13, height: 13 }} />}{t('Save changes')}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
