'use client';

// =============================================================================
// CampanasBrowser — réplica de Meta Ads Manager (Campañas · Conjuntos · Anuncios)
// =============================================================================
// Tabla genérica <TablaMeta>: ordenable por header, multiselección con scope
// cruzado (seleccionar campañas filtra sus conjuntos/anuncios, como Meta),
// columnas configurables (localStorage), primera columna fija al scroll-x,
// encender/apagar (toggle) y editar presupuesto en la celda (CBO/ABO). Las
// escrituras pegan a /api/meta-write con optimistic update + revert + toast.
//   - fila de anuncio  → modal AdDetalle. campaña/conjunto → EntityDetalle.
//   - botón "Analizar (Meta)" → /api/meta-recommendations (sin MaKo).

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import { Dropdown } from '../components/Dropdown';
import { MakoStar, MakoWord } from '../_components/MakoBrand';
import type { SenalRecon, ReconVeredicto, RitmoEstado } from '@/lib/queries';
import {
  colorDeSemaforo, bgDeSemaforo,
  statusLabel as metaStatusLabel, statusSemaforo as metaStatusSemaforo,
  type MetaHealth, type NodoEstado, type Semaforo,
} from '@/lib/meta-health';
import type { CrossData } from './EntityDetalle';

const AdDetailTabs = dynamic(() => import('../marketing/ad-charts').then((m) => m.AdDetailTabs), { ssr: false });
const EntityDetalle = dynamic(() => import('./EntityDetalle').then((m) => m.EntityDetalle), { ssr: false });

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

// ── formato ──
const fmtUSD = (n: number | null | undefined, d?: number) => {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const dec = d ?? (Math.abs(n) < 100 ? 2 : 0);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: dec, minimumFractionDigits: dec }).format(n);
};
const fmtNum = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : new Intl.NumberFormat('es-MX').format(Math.round(n)));
const fmtMXN0 = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n));

type Perf = { spend_usd: number; impressions: number; link_clicks: number; leads: number; agendas: number; cierres: number; cash_usd: number };
const emptyPerf = (): Perf => ({ spend_usd: 0, impressions: 0, link_clicks: 0, leads: 0, agendas: 0, cierres: 0, cash_usd: 0 });
function addPerf(a: Perf, s: SenalRecon) {
  a.spend_usd += s.spend_usd; a.impressions += s.impressions; a.link_clicks += s.link_clicks;
  a.leads += s.leads; a.agendas += s.agendas; a.cierres += s.cierres; a.cash_usd += s.cash_usd;
}

type Tab = 'campanas' | 'conjuntos' | 'anuncios';
type Level = 'campaign' | 'adset' | 'ad';
type EstadoFiltro = 'all' | 'verde' | 'ambar' | 'gris' | 'rojo';
const ESTADO_OPCIONES = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'rojo', label: 'Rechazados / con problemas', color: 'var(--bad)' },
  { value: 'ambar', label: 'En revisión / aprendizaje', color: 'var(--warn-fill)' },
  { value: 'verde', label: 'Activos', color: 'var(--good)' },
  { value: 'gris', label: 'Pausados', color: 'var(--dim)' },
];

// ── columnas (data-driven: sort + show/hide) ──
type ColId = 'entrega' | 'resultados' | 'costoRes' | 'presupuesto' | 'gastado' | 'impresiones' | 'cierres' | 'cash' | 'aprendizaje';
type ColDef = { id: ColId; label: string; levels?: Level[] };
const ALL_COLS: ColDef[] = [
  { id: 'entrega', label: 'Entrega' },
  { id: 'resultados', label: 'Resultados' },
  { id: 'costoRes', label: 'Coste/resultado' },
  { id: 'presupuesto', label: 'Presupuesto', levels: ['campaign', 'adset'] },
  { id: 'gastado', label: 'Importe gastado' },
  { id: 'impresiones', label: 'Impresiones' },
  { id: 'cierres', label: 'Cierres (CRM)' },
  { id: 'cash', label: 'Cash (CRM)' },
  { id: 'aprendizaje', label: 'Aprendizaje', levels: ['adset'] },
];
const ALWAYS_ON: ColId[] = ['entrega'];
const COLS_KEY = (tab: Tab) => `mako.adsTable.cols.${tab}`;
function defaultCols(): Record<ColId, boolean> {
  return { entrega: true, resultados: true, costoRes: true, presupuesto: true, gastado: true, impresiones: true, cierres: true, cash: true, aprendizaje: true };
}
function loadCols(tab: Tab): Record<ColId, boolean> {
  const def = defaultCols();
  if (typeof window === 'undefined') return def;
  try { const raw = window.localStorage.getItem(COLS_KEY(tab)); if (raw) return { ...def, ...JSON.parse(raw) }; } catch { /* noop */ }
  return def;
}

type Row = {
  node: NodoEstado;
  level: Level;
  perf: Perf;
  senal: SenalRecon | null;
  campName: string | null;
  adsetName: string | null;
};

// Senal sintética para abrir AdDetalle en anuncios sin gasto en el rango.
function synthSenal(node: NodoEstado, campana: string | null, adset: string | null): SenalRecon {
  return {
    ad_id: node.id, ad_name: node.name, campana, adset_name: adset,
    spend_usd: 0, leads: 0, meta_leads: 0, dias_corriendo: 0,
    ritmo: 'sin_datos' as RitmoEstado, ritmo_dias: [], veredicto: 'explorando' as ReconVeredicto,
    agendas: 0, cierres: 0, cash_usd: 0, hook_rate: null, hold_rate: null, ctr_link: null,
    cpl_usd: null, frequency: null, impressions: 0, link_clicks: 0, cpm_usd: null, cpc_usd: null,
    ad_thumbnail_url: null, ad_permalink: null, ad_creative_sin_enlace: true,
  };
}

const th: CSSProperties = { padding: '11px 14px', fontFamily: MONO, fontSize: 10.5, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--dim)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)', background: 'var(--surface)' };
const td: CSSProperties = { padding: '11px 14px', fontSize: 13.5, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' };

export function CampanasBrowser({ senales, desde, hasta }: { senales: SenalRecon[]; desde: string; hasta: string }) {
  const [health, setHealth] = useState<MetaHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>('campanas');
  const [estado, setEstado] = useState<EstadoFiltro>('all');
  const [sortKey, setSortKey] = useState<ColId | 'name'>('gastado');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // selección por nivel (scope cruzado, como Meta)
  const [selCamp, setSelCamp] = useState<Set<string>>(new Set());
  const [selAdset, setSelAdset] = useState<Set<string>>(new Set());
  const [selAd, setSelAd] = useState<Set<string>>(new Set());

  const [visibleCols, setVisibleCols] = useState<Record<ColId, boolean>>(defaultCols);
  const [colsOpen, setColsOpen] = useState(false);

  // escrituras
  const [optimistic, setOptimistic] = useState<Map<string, { status?: 'ACTIVE' | 'PAUSED'; budgetMxn?: number; name?: string }>>(new Map());
  const [writing, setWriting] = useState<Set<string>>(new Set());
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // modales
  const [adSel, setAdSel] = useState<SenalRecon | null>(null);
  const [entSel, setEntSel] = useState<{ node: NodoEstado; level: 'campaign' | 'adset'; cross: CrossData } | null>(null);
  const [recosOpen, setRecosOpen] = useState(false);

  const cargar = () => {
    setLoading(true); setError(null);
    fetch('/api/meta-health').then((r) => r.json())
      .then((j) => { if (j.error) setError(j.error); else setHealth(j); })
      .catch((e) => setError(String(e))).finally(() => setLoading(false));
  };
  useEffect(() => { cargar(); }, []);
  // al cambiar de sub-tab: recargar columnas y resetear orden/edición.
  useEffect(() => { setVisibleCols(loadCols(tab)); setSortKey('gastado'); setSortDir('desc'); setEditingBudgetId(null); }, [tab]);
  useEffect(() => { if (typeof window !== 'undefined') { try { window.localStorage.setItem(COLS_KEY(tab), JSON.stringify(visibleCols)); } catch { /* noop */ } } }, [visibleCols, tab]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 7000); return () => clearTimeout(t); }, [toast]);

  // ── merges senales → perf ──
  const { byAd, byCamp, byAdset } = useMemo(() => {
    const byAd = new Map<string, SenalRecon>();
    const byCamp = new Map<string, Perf>();
    const byAdset = new Map<string, Perf>();
    for (const s of senales) {
      byAd.set(s.ad_id, s);
      const ck = s.campana ?? '—';
      const cp = byCamp.get(ck) ?? emptyPerf(); addPerf(cp, s); byCamp.set(ck, cp);
      const ak = `${s.campana ?? '—'}||${s.adset_name ?? '—'}`;
      const ap = byAdset.get(ak) ?? emptyPerf(); addPerf(ap, s); byAdset.set(ak, ap);
    }
    return { byAd, byCamp, byAdset };
  }, [senales]);

  const campaignsById = useMemo(() => new Map((health?.campaigns ?? []).map((c) => [c.id, c])), [health]);
  const adsetsById = useMemo(() => new Map((health?.adsets ?? []).map((a) => [a.id, a])), [health]);
  const campName = (id: string | null) => (id ? campaignsById.get(id)?.name ?? null : null);
  const adsetCampId = (adsetId: string | null) => (adsetId ? adsetsById.get(adsetId)?.parentId ?? null : null);

  const accountFrozen = !!health && (health.account.severidad === 'rojo' || health.account.status === 3);

  // overrides optimistas
  const effStatusOf = (node: NodoEstado) => optimistic.get(node.id)?.status ?? node.effectiveStatus;
  const budgetOf = (node: NodoEstado) => optimistic.get(node.id)?.budgetMxn ?? node.dailyBudgetMxn ?? null;
  const nameOf = (node: NodoEstado) => optimistic.get(node.id)?.name ?? node.name;

  // ── filas por nivel (con scope de selección cruzado) ──
  const matchEstado = (node: NodoEstado) => estado === 'all' || metaStatusSemaforo(effStatusOf(node)) === estado;

  const rows: Row[] = useMemo(() => {
    if (!health) return [];
    if (tab === 'campanas') {
      return health.campaigns.filter(matchEstado).map((node) => ({ node, level: 'campaign' as Level, perf: byCamp.get(node.name) ?? emptyPerf(), senal: null, campName: node.name, adsetName: null }));
    }
    if (tab === 'conjuntos') {
      return health.adsets
        .filter((a) => selCamp.size === 0 || (a.parentId && selCamp.has(a.parentId)))
        .filter(matchEstado)
        .map((node) => { const cn = campName(node.parentId); return { node, level: 'adset' as Level, perf: byAdset.get(`${cn ?? '—'}||${node.name}`) ?? emptyPerf(), senal: null, campName: cn, adsetName: node.name }; });
    }
    return health.ads
      .filter((ad) => {
        if (selAdset.size > 0) return ad.parentId && selAdset.has(ad.parentId);
        if (selCamp.size > 0) { const cid = adsetCampId(ad.parentId); return !!cid && selCamp.has(cid); }
        return true;
      })
      .filter(matchEstado)
      .map((node) => { const cn = campName(adsetCampId(node.parentId)); const an = node.parentId ? adsetsById.get(node.parentId)?.name ?? null : null; const senal = byAd.get(node.id) ?? null; return { node, level: 'ad' as Level, perf: senal ? { spend_usd: senal.spend_usd, impressions: senal.impressions, link_clicks: senal.link_clicks, leads: senal.leads, agendas: senal.agendas, cierres: senal.cierres, cash_usd: senal.cash_usd } : emptyPerf(), senal, campName: cn, adsetName: an }; });
  }, [health, tab, byCamp, byAdset, byAd, selCamp, selAdset, estado, optimistic]);

  // ── orden ──
  const sortVal = (r: Row, key: ColId | 'name'): number | string => {
    switch (key) {
      case 'name': return r.node.name.toLowerCase();
      case 'entrega': return metaStatusLabel(effStatusOf(r.node));
      case 'resultados': return r.perf.agendas;
      case 'costoRes': return r.perf.agendas > 0 ? r.perf.spend_usd / r.perf.agendas : -1;
      case 'presupuesto': return budgetOf(r.node) ?? -1;
      case 'gastado': return r.perf.spend_usd;
      case 'impresiones': return r.perf.impressions;
      case 'cierres': return r.perf.cierres;
      case 'cash': return r.perf.cash_usd;
      case 'aprendizaje': return r.node.learning?.status ?? '';
    }
  };
  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      const va = sortVal(a, sortKey), vb = sortVal(b, sortKey);
      const c = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'es');
      return sortDir === 'asc' ? c : -c;
    });
    return arr;
  }, [rows, sortKey, sortDir, optimistic]);

  const onSort = (key: ColId | 'name') => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir(key === 'name' ? 'asc' : 'desc'); }
  };

  // ── selección ──
  const level: Level = tab === 'campanas' ? 'campaign' : tab === 'conjuntos' ? 'adset' : 'ad';
  const selSet = tab === 'campanas' ? selCamp : tab === 'conjuntos' ? selAdset : selAd;
  const setSelSet = tab === 'campanas' ? setSelCamp : tab === 'conjuntos' ? setSelAdset : setSelAd;
  const toggleOne = (id: string) => setSelSet((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allSelected = sorted.length > 0 && sorted.every((r) => selSet.has(r.node.id));
  const someSelected = sorted.some((r) => selSet.has(r.node.id));
  const toggleAll = () => setSelSet(() => (allSelected ? new Set() : new Set(sorted.map((r) => r.node.id))));

  // ── escrituras ──
  const setOpt = (id: string, patch: { status?: 'ACTIVE' | 'PAUSED'; budgetMxn?: number; name?: string }) =>
    setOptimistic((m) => { const n = new Map(m); n.set(id, { ...(n.get(id) ?? {}), ...patch }); return n; });
  const clearOpt = (id: string, k: 'status' | 'budgetMxn' | 'name') =>
    setOptimistic((m) => { const n = new Map(m); const cur = { ...(n.get(id) ?? {}) }; delete cur[k]; if (Object.keys(cur).length === 0) n.delete(id); else n.set(id, cur); return n; });
  const permMsg = (j: { error_subcode?: number; message?: string }) =>
    j.error_subcode === 4841013
      ? `Meta bloqueó la escritura (permiso 4841013). El token ya es System User con ads_management y rol MANAGE; el bloqueo restante suele ser la 2FA obligatoria de la empresa (el admin que controla el system user debe tener 2FA activada) y/o la cuenta restringida por pago. Detalle: ${j.message ?? ''}`
      : `Meta rechazó el cambio: ${j.message ?? 'error'}`;

  async function writeStatus(lvl: Level, id: string, next: 'ACTIVE' | 'PAUSED') {
    setWriting((w) => new Set(w).add(id));
    setOpt(id, { status: next });
    try {
      const r = await fetch('/api/meta-write', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level: lvl, id, op: 'status', status: next }) });
      const j = await r.json();
      if (!j.ok) { clearOpt(id, 'status'); setToast(permMsg(j)); }
    } catch (e) { clearOpt(id, 'status'); setToast(`Error de red: ${String(e)}`); }
    finally { setWriting((w) => { const n = new Set(w); n.delete(id); return n; }); }
  }
  async function writeBudget(lvl: Level, id: string, mxn: number) {
    setEditingBudgetId(null);
    setWriting((w) => new Set(w).add(id));
    setOpt(id, { budgetMxn: mxn });
    try {
      const r = await fetch('/api/meta-write', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level: lvl, id, op: 'budget', dailyBudgetMxn: mxn }) });
      const j = await r.json();
      if (!j.ok) { clearOpt(id, 'budgetMxn'); setToast(permMsg(j)); }
    } catch (e) { clearOpt(id, 'budgetMxn'); setToast(`Error de red: ${String(e)}`); }
    finally { setWriting((w) => { const n = new Set(w); n.delete(id); return n; }); }
  }
  const bulkStatus = async (next: 'ACTIVE' | 'PAUSED') => {
    const ids = [...selSet];
    await Promise.allSettled(ids.map((id) => writeStatus(level, id, next)));
  };
  // Renombrar (campaña/adset/anuncio) → POST /{id} con name. Optimistic + revert.
  async function writeName(lvl: Level, id: string, name: string): Promise<{ ok: boolean; error?: string }> {
    setEditingNameId(null);
    const clean = name.trim();
    if (!clean) return { ok: false, error: 'nombre vacío' };
    setWriting((w) => new Set(w).add(id));
    setOpt(id, { name: clean });
    try {
      const r = await fetch('/api/meta-write', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level: lvl, id, op: 'name', name: clean }) });
      const j = await r.json();
      if (!j.ok) { clearOpt(id, 'name'); const msg = permMsg(j); setToast(msg); return { ok: false, error: msg }; }
      return { ok: true };
    } catch (e) { clearOpt(id, 'name'); const msg = `Error de red: ${String(e)}`; setToast(msg); return { ok: false, error: msg }; }
    finally { setWriting((w) => { const n = new Set(w); n.delete(id); return n; }); }
  }
  // Aplica en lote los renombres propuestos por MaKo (secuencial, para no chocar
  // con el rate-limit de Meta). Devuelve cuántos salieron OK + refresca el estado.
  const bulkRename = async (items: Array<{ id: string; level: Level; name: string }>): Promise<number> => {
    let ok = 0; let lastErr = '';
    for (const it of items) { const r = await writeName(it.level, it.id, it.name); if (r.ok) ok++; else lastErr = r.error || lastErr; }
    // Si fallaron, NO tapar el detalle del error con un resumen benigno.
    setToast(ok === items.length ? `Renombrados ${ok}/${items.length}.` : `Renombrados ${ok}/${items.length}. Meta rechazó el resto: ${lastErr}`);
    cargar(); // reconciliar los nombres optimistas con el estado real de Meta
    return ok;
  };

  // ── abrir modales ──
  const abrir = (r: Row) => {
    if (r.level === 'ad') { setAdSel(r.senal ?? synthSenal(r.node, r.campName, r.adsetName)); return; }
    setEntSel({ node: r.node, level: r.level as 'campaign' | 'adset', cross: { cierres: r.perf.cierres, cash_usd: r.perf.cash_usd, agendasCrm: r.perf.agendas } });
  };

  // columnas visibles para la tab actual
  const cols = ALL_COLS.filter((c) => (!c.levels || c.levels.includes(level)) && (ALWAYS_ON.includes(c.id) || visibleCols[c.id]));
  const configurables = ALL_COLS.filter((c) => !c.levels || c.levels.includes(level));

  const tabs: Array<{ key: Tab; label: string; n: number }> = [
    { key: 'campanas', label: 'Campañas', n: health?.campaigns.length ?? 0 },
    { key: 'conjuntos', label: selCamp.size > 0 ? `Conjuntos · ${selCamp.size} campaña${selCamp.size === 1 ? '' : 's'}` : 'Conjuntos', n: health?.adsets.length ?? 0 },
    { key: 'anuncios', label: selAdset.size > 0 ? `Anuncios · ${selAdset.size} conjunto${selAdset.size === 1 ? '' : 's'}` : selCamp.size > 0 ? `Anuncios · ${selCamp.size} campaña${selCamp.size === 1 ? '' : 's'}` : 'Anuncios', n: health?.ads.length ?? 0 },
  ];

  // Entidades del nivel actual (todas, con su jerarquía) para el renombrado con MaKo.
  const renameEntities = useMemo<RenameEntity[]>(() => {
    if (!health) return [];
    if (level === 'campaign') return health.campaigns.map((n) => ({ id: n.id, name: nameOf(n), campName: null, adsetName: null, createdTime: n.createdTime ?? null }));
    if (level === 'adset') return health.adsets.map((n) => ({ id: n.id, name: nameOf(n), campName: campName(n.parentId), adsetName: null, createdTime: n.createdTime ?? null }));
    return health.ads.map((n) => ({ id: n.id, name: nameOf(n), campName: campName(adsetCampId(n.parentId)), adsetName: n.parentId ? adsetsById.get(n.parentId)?.name ?? null : null, createdTime: n.createdTime ?? null }));
  }, [health, level, optimistic]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Sticky de la primera columna + hover. En <style> co-locado porque Tailwind
          v4 fuerza border-collapse:collapse (rompe position:sticky en celdas) y el
          CSS suelto de globals.css no siempre se emite. */}
      <style dangerouslySetInnerHTML={{ __html: `
        .adsTable{border-collapse:separate;border-spacing:0}
        .adsTable .stickyName{position:sticky;left:0;z-index:2;background:var(--surface);box-shadow:1px 0 0 var(--border)}
        .adsTable thead .stickyName{z-index:4}
        .adsTable tbody tr.rowHover:hover td{background:var(--surface-2)}
        .adsTable tbody tr.rowHover:hover .stickyName{background:var(--surface-2)}
      ` }} />
      {/* sub-tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid var(--border)', paddingBottom: 2 }}>
        {tabs.map((t) => {
          const on = tab === t.key;
          return (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', border: 'none', borderBottom: `2px solid ${on ? 'var(--accent)' : 'transparent'}`, background: 'transparent', cursor: 'pointer', fontSize: 15, fontWeight: on ? 600 : 500, color: on ? 'var(--ink)' : 'var(--dim)' }}>
              {t.label}
              <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', background: 'var(--surface-2)', borderRadius: 999, padding: '1px 8px' }}>{t.n}</span>
            </button>
          );
        })}
      </div>

      {/* toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <MakoMenu actions={[
          { label: 'Analizar con Meta', sub: 'Recomendaciones y oportunity score', onClick: () => setRecosOpen(true) },
          { label: 'Ordenar nombres', sub: 'Propone una nomenclatura y la aplica', onClick: () => setRenameOpen(true) },
        ]} />
        <Dropdown value={estado} options={ESTADO_OPCIONES} onChange={(v) => setEstado(v as EstadoFiltro)} ariaLabel="Filtrar por estado" width={220} />
        <ColumnsButton open={colsOpen} setOpen={setColsOpen} configurables={configurables} visibleCols={visibleCols} setVisibleCols={setVisibleCols} />
        {(selCamp.size > 0 || selAdset.size > 0) && (
          <button type="button" onClick={() => { setSelCamp(new Set()); setSelAdset(new Set()); setSelAd(new Set()); }} style={{ fontSize: 13, color: 'var(--dim)', background: 'transparent', border: '1px solid var(--border)', borderRadius: 999, padding: '7px 13px', cursor: 'pointer' }}>✕ Limpiar selección</button>
        )}
        <button type="button" onClick={cargar} style={{ marginLeft: 'auto', padding: '9px 14px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--dim)', fontSize: 13.5, fontWeight: 500, cursor: 'pointer' }}>↻ Actualizar estado</button>
      </div>

      {loading && <div style={{ fontSize: 14, color: 'var(--faint)', padding: '20px 4px' }}>Cargando estado de Meta…</div>}
      {error && (
        <div style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 14, padding: '18px 22px' }}>
          <p style={{ fontWeight: 600, color: 'var(--bad)', margin: '0 0 4px' }}>No se pudo leer el estado de Meta</p>
          <p style={{ fontFamily: MONO, fontSize: 13, color: 'var(--dim)', margin: 0 }}>{error}</p>
        </div>
      )}

      {health && !loading && (
        <>
          {accountFrozen && (
            <div style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 12, padding: '12px 16px' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--bad)' }}>Cuenta: {health.account.statusLabel}.</span>
              <span style={{ fontSize: 13.5, color: 'var(--dim)' }}> Las campañas activas figuran “Error en el pago”. Encender/cambiar presupuesto requiere resolver el pago y un token con permiso de escritura.</span>
            </div>
          )}

          {/* barra de acciones masivas */}
          {selSet.size > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--ink)', color: 'var(--surface)', borderRadius: 12, padding: '10px 16px' }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{selSet.size} seleccionado{selSet.size === 1 ? '' : 's'}</span>
              <button type="button" onClick={() => bulkStatus('ACTIVE')} style={bulkBtn}>Activar</button>
              <button type="button" onClick={() => bulkStatus('PAUSED')} style={bulkBtn}>Pausar</button>
              <button type="button" onClick={() => setSelSet(new Set())} style={{ ...bulkBtn, marginLeft: 'auto', opacity: 0.8 }}>Limpiar</button>
            </div>
          )}

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflowX: 'auto' }}>
            <table className="adsTable" style={{ width: '100%', minWidth: 760 }}>
              <thead>
                <tr>
                  <th className="stickyName" style={{ ...th, textAlign: 'left', cursor: 'default' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                      <input type="checkbox" checked={allSelected} ref={(el) => { if (el) el.indeterminate = !allSelected && someSelected; }} onChange={toggleAll} style={{ cursor: 'pointer' }} aria-label="Seleccionar todo" />
                      <SortLabel label={tab === 'campanas' ? 'Campaña' : tab === 'conjuntos' ? 'Conjunto' : 'Anuncio'} active={sortKey === 'name'} dir={sortDir} onClick={() => onSort('name')} align="left" />
                    </span>
                  </th>
                  {cols.map((c) => (
                    <th key={c.id} style={{ ...th, textAlign: c.id === 'aprendizaje' ? 'left' : 'right' }}>
                      <SortLabel label={c.label} active={sortKey === c.id} dir={sortDir} onClick={() => onSort(c.id)} align={c.id === 'aprendizaje' ? 'left' : 'right'} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr><td className="stickyName" style={{ ...td, color: 'var(--faint)' }} colSpan={1}>Sin filas para este filtro.</td>{cols.map((c) => <td key={c.id} style={td} />)}</tr>
                ) : sorted.map((r) => (
                  <RowView key={r.node.id} r={r} cols={cols} selected={selSet.has(r.node.id)} onSelect={() => toggleOne(r.node.id)} onOpen={() => abrir(r)}
                    effStatus={effStatusOf(r.node)} budgetMxn={budgetOf(r.node)} name={nameOf(r.node)} accountFrozen={accountFrozen}
                    writing={writing.has(r.node.id)} editing={editingBudgetId === r.node.id} editingName={editingNameId === r.node.id}
                    onToggleStatus={(next) => writeStatus(r.level, r.node.id, next)}
                    onStartBudget={() => setEditingBudgetId(r.node.id)} onCancelBudget={() => setEditingBudgetId(null)} onSaveBudget={(mxn) => writeBudget(r.level as Level, r.node.id, mxn)}
                    onStartName={() => setEditingNameId(r.node.id)} onCancelName={() => setEditingNameId(null)} onSaveName={(nm) => writeName(r.level, r.node.id, nm)} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <footer style={{ fontFamily: MONO, fontSize: 12, color: 'var(--faint)', paddingTop: 4 }}>
        Estado en vivo de Meta + rendimiento del rango cruzado con cierres/cash del CRM. Presupuesto en MXN (como Meta). Las escrituras requieren un token con permiso de administración.
      </footer>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 90, maxWidth: 560, background: 'var(--ink)', color: 'var(--surface)', borderRadius: 12, padding: '14px 18px', boxShadow: '0 16px 40px rgba(23,21,17,.4)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 13.5, lineHeight: 1.4 }}>{toast}</span>
          <button type="button" onClick={() => setToast(null)} style={{ flex: 'none', background: 'transparent', border: 'none', color: 'var(--surface)', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
      )}

      {adSel && <AdDetailTabs key={adSel.ad_id} senal={adSel} desde={desde} hasta={hasta} defaultTab="rendimiento" onClose={() => setAdSel(null)} />}
      {entSel && (
        <EntityDetalle id={entSel.node.id} level={entSel.level} name={entSel.node.name} statusLabel={entSel.node.statusLabel} semaforo={entSel.node.semaforo}
          desde={desde} hasta={hasta} cross={entSel.cross} recosMeta={entSel.node.recosMeta} presupuestoMxn={entSel.node.dailyBudgetMxn ?? null} onClose={() => setEntSel(null)} />
      )}
      {recosOpen && <RecosModal onClose={() => setRecosOpen(false)} />}
      {renameOpen && <RenameModal level={level} entities={renameEntities} onClose={() => setRenameOpen(false)} onApply={bulkRename} />}
    </div>
  );
}

type RenameEntity = { id: string; name: string; campName: string | null; adsetName: string | null; createdTime: string | null };

const bulkBtn: CSSProperties = { padding: '7px 14px', borderRadius: 9, border: '1px solid rgba(243,240,231,.25)', background: 'rgba(243,240,231,.10)', color: 'var(--surface)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' };

// ── header ordenable ──
function SortLabel({ label, active, dir, onClick, align }: { label: string; active: boolean; dir: 'asc' | 'desc'; onClick: () => void; align: 'left' | 'right' }) {
  return (
    <button type="button" onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexDirection: align === 'right' ? 'row-reverse' : 'row', background: 'transparent', border: 'none', cursor: 'pointer', font: 'inherit', color: active ? 'var(--ink)' : 'inherit', letterSpacing: 'inherit', textTransform: 'inherit', padding: 0 }}>
      {label}
      <span style={{ fontSize: 9, color: active ? 'var(--accent)' : 'var(--faint)' }}>{active ? (dir === 'asc' ? '▲' : '▼') : '⇅'}</span>
    </button>
  );
}

// ── fila ──
function RowView({ r, cols, selected, onSelect, onOpen, effStatus, budgetMxn, name, accountFrozen, writing, editing, editingName, onToggleStatus, onStartBudget, onCancelBudget, onSaveBudget, onStartName, onCancelName, onSaveName }: {
  r: Row; cols: ColDef[]; selected: boolean; onSelect: () => void; onOpen: () => void;
  effStatus: string; budgetMxn: number | null; name: string; accountFrozen: boolean; writing: boolean; editing: boolean; editingName: boolean;
  onToggleStatus: (next: 'ACTIVE' | 'PAUSED') => void; onStartBudget: () => void; onCancelBudget: () => void; onSaveBudget: (mxn: number) => void;
  onStartName: () => void; onCancelName: () => void; onSaveName: (name: string) => void;
}) {
  const active = effStatus === 'ACTIVE';
  const entrega = accountFrozen && active ? { label: 'Error en el pago', semaforo: 'rojo' as Semaforo } : { label: metaStatusLabel(effStatus), semaforo: metaStatusSemaforo(effStatus) };
  const costo = r.perf.agendas > 0 ? r.perf.spend_usd / r.perf.agendas : null;
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const cell = (c: ColDef) => {
    switch (c.id) {
      case 'entrega': return <Pill semaforo={entrega.semaforo} label={entrega.label} />;
      case 'resultados': return r.perf.agendas > 0 ? fmtNum(r.perf.agendas) : '—';
      case 'costoRes': return fmtUSD(costo);
      case 'gastado': return r.level === 'ad' && !r.senal ? '—' : fmtUSD(r.perf.spend_usd, 0);
      case 'impresiones': return r.level === 'ad' && !r.senal ? '—' : fmtNum(r.perf.impressions);
      case 'cierres': return r.perf.cierres > 0 ? fmtNum(r.perf.cierres) : '—';
      case 'cash': return r.perf.cash_usd > 0 ? fmtUSD(r.perf.cash_usd, 0) : '—';
      case 'aprendizaje': return r.node.learning ? <Pill semaforo={r.node.learning.semaforo} label={r.node.learning.label} /> : '—';
      case 'presupuesto': return <BudgetCell r={r} budgetMxn={budgetMxn} editing={editing} writing={writing} onStart={onStartBudget} onCancel={onCancelBudget} onSave={onSaveBudget} />;
    }
  };

  return (
    <tr className="rowHover" onClick={onOpen} style={{ cursor: 'pointer' }}>
      <td className="stickyName" style={{ ...td, textAlign: 'left', maxWidth: 360 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <input type="checkbox" checked={selected} onClick={stop} onChange={onSelect} style={{ flex: 'none', cursor: 'pointer' }} aria-label="Seleccionar" />
          <span onClick={stop} style={{ flex: 'none' }}>
            <Toggle on={active} disabled={writing} onChange={(next) => onToggleStatus(next ? 'ACTIVE' : 'PAUSED')} />
          </span>
          {r.level === 'ad' && (r.senal?.ad_thumbnail_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={r.senal.ad_thumbnail_url} alt="" style={{ width: 28, height: 38, borderRadius: 5, objectFit: 'cover', flex: 'none', border: '1px solid var(--border)' }} />
            : <span style={{ width: 28, height: 38, borderRadius: 5, flex: 'none', background: 'var(--surface-2)', border: '1px solid var(--border)' }} />)}
          {editingName ? (
            <span onClick={stop} style={{ flex: 1, minWidth: 0 }}><NameEditor value={name} onSave={onSaveName} onCancel={onCancelName} /></span>
          ) : (
            <>
              <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--accent)' }}>{name}</span>
              <button type="button" title="Renombrar" disabled={writing} onClick={(e) => { stop(e); onStartName(); }}
                style={{ flex: 'none', background: 'transparent', border: 'none', cursor: writing ? 'default' : 'pointer', color: 'var(--faint)', fontSize: 12, padding: '2px 4px', lineHeight: 1 }}>✎</button>
            </>
          )}
        </span>
      </td>
      {cols.map((c) => (
        <td key={c.id} style={{ ...td, textAlign: c.id === 'entrega' || c.id === 'aprendizaje' || c.id === 'presupuesto' ? 'left' : 'right' }}>{cell(c)}</td>
      ))}
    </tr>
  );
}

function BudgetCell({ r, budgetMxn, editing, writing, onStart, onCancel, onSave }: { r: Row; budgetMxn: number | null; editing: boolean; writing: boolean; onStart: () => void; onCancel: () => void; onSave: (mxn: number) => void }) {
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  // Ads no tienen presupuesto.
  if (r.level === 'ad') return <span style={{ color: 'var(--faint)' }}>—</span>;
  const editable = r.node.budgetLevel === r.level; // CBO→campaña editable; ABO→conjunto editable
  // CBO: en la fila de conjunto el budget vive en la campaña.
  if (!editable) {
    if (r.level === 'adset') return <span style={{ color: 'var(--faint)', fontSize: 12.5 }}>Presupuesto de campaña</span>;
    return <span style={{ color: 'var(--faint)' }}>—</span>; // campaña ABO (budget en conjuntos)
  }
  if (editing) return <span onClick={stop}><BudgetEditor mxn={budgetMxn} onSave={onSave} onCancel={onCancel} /></span>;
  return (
    <button type="button" onClick={(e) => { stop(e); onStart(); }} disabled={writing} title="Editar presupuesto"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid transparent', borderRadius: 8, padding: '4px 8px', cursor: writing ? 'default' : 'pointer', color: 'var(--ink)', font: 'inherit', fontVariantNumeric: 'tabular-nums' }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; }}>
      {budgetMxn != null ? `${fmtMXN0(budgetMxn)}/día` : '—'}<span style={{ fontSize: 11, color: 'var(--faint)' }}>✎</span>
    </button>
  );
}

function BudgetEditor({ mxn, onSave, onCancel }: { mxn: number | null; onSave: (mxn: number) => void; onCancel: () => void }) {
  const [v, setV] = useState(mxn != null ? String(Math.round(mxn)) : '');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  const save = () => { const n = Number(v); if (Number.isFinite(n) && n > 0) onSave(n); };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ color: 'var(--faint)', fontSize: 13 }}>$</span>
      <input ref={ref} value={v} onChange={(e) => setV(e.target.value.replace(/[^\d]/g, ''))}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onCancel(); }}
        inputMode="numeric" style={{ width: 78, padding: '5px 8px', borderRadius: 8, border: '1px solid var(--accent)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13, outline: 'none', textAlign: 'right' }} />
      <span style={{ color: 'var(--faint)', fontSize: 12 }}>MXN/día</span>
      <button type="button" onClick={save} style={{ border: 'none', background: 'var(--good)', color: '#fff', borderRadius: 7, width: 26, height: 26, cursor: 'pointer', fontSize: 13 }}>✓</button>
      <button type="button" onClick={onCancel} style={{ border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', borderRadius: 7, width: 26, height: 26, cursor: 'pointer', fontSize: 13 }}>✕</button>
    </span>
  );
}

function NameEditor({ value, onSave, onCancel }: { value: string; onSave: (name: string) => void; onCancel: () => void }) {
  const [v, setV] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  const save = () => { const t = v.trim(); if (t && t !== value) onSave(t); else onCancel(); };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, width: '100%' }}>
      <input ref={ref} value={v} maxLength={400} onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onCancel(); }}
        style={{ flex: 1, minWidth: 0, padding: '5px 8px', borderRadius: 7, border: '1px solid var(--accent)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5, outline: 'none' }} />
      <button type="button" onClick={save} title="Guardar" style={{ flex: 'none', border: 'none', background: 'var(--good)', color: '#fff', borderRadius: 6, width: 26, height: 26, cursor: 'pointer', fontSize: 13 }}>✓</button>
      <button type="button" onClick={onCancel} title="Cancelar" style={{ flex: 'none', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', borderRadius: 6, width: 26, height: 26, cursor: 'pointer', fontSize: 13 }}>✕</button>
    </span>
  );
}

function Toggle({ on, disabled, onChange }: { on: boolean; disabled: boolean; onChange: (next: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)} title={on ? 'Pausar' : 'Activar'}
      style={{ width: 34, height: 20, borderRadius: 999, border: 'none', padding: 2, cursor: disabled ? 'default' : 'pointer', background: on ? 'var(--good)' : 'var(--border-strong)', opacity: disabled ? 0.5 : 1, transition: 'background .15s', display: 'inline-flex' }}>
      <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', transform: on ? 'translateX(14px)' : 'translateX(0)', transition: 'transform .15s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
    </button>
  );
}

function Pill({ semaforo, label }: { semaforo: Semaforo; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flex: 'none', fontFamily: MONO, fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 999, color: colorDeSemaforo(semaforo), background: bgDeSemaforo(semaforo), whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: colorDeSemaforo(semaforo) }} />{label}
    </span>
  );
}

// ── popover de columnas ──
function ColumnsButton({ open, setOpen, configurables, visibleCols, setVisibleCols }: { open: boolean; setOpen: (b: boolean) => void; configurables: ColDef[]; visibleCols: Record<ColId, boolean>; setVisibleCols: (f: (v: Record<ColId, boolean>) => Record<ColId, boolean>) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc); return () => document.removeEventListener('mousedown', onDoc);
  }, [open, setOpen]);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(!open)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>▦ Columnas</button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50, minWidth: 220, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 16px 40px rgba(23,21,17,.22)', padding: 8 }}>
          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--dim)', padding: '4px 8px 8px' }}>Mostrar columnas</div>
          {configurables.map((c) => {
            const forced = ALWAYS_ON.includes(c.id);
            const on = forced || visibleCols[c.id];
            return (
              <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 8px', borderRadius: 8, cursor: forced ? 'default' : 'pointer', fontSize: 13.5, color: forced ? 'var(--faint)' : 'var(--ink)' }}>
                <input type="checkbox" checked={on} disabled={forced} onChange={() => setVisibleCols((v) => ({ ...v, [c.id]: !v[c.id] }))} style={{ cursor: forced ? 'default' : 'pointer' }} />
                {c.label}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── modal "Analizar (Meta)" — espejo honesto del edge de recomendaciones ──
type RecosResp = { ok: boolean; opportunityScore?: number | null; recomendaciones?: Array<{ titulo: string; detalle: string; importancia: string }>; empty?: boolean; reason?: string; message?: string };
function RecosModal({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<RecosResp | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    fetch('/api/meta-recommendations').then((r) => r.json()).then((j) => { if (alive) setData(j); }).catch((e) => { if (alive) setData({ ok: false, message: String(e) }); }).finally(() => { if (alive) setLoading(false); });
  }, []);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(23,21,17,.52)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '60px 20px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 640, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 30px 70px rgba(23,21,17,.35)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>Recomendaciones de Meta · API</div>
            <h2 style={{ fontWeight: 600, fontSize: 20, margin: '3px 0 0', color: 'var(--ink)' }}>Analizar (Meta)</h2>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 16, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: '22px 24px' }}>
          {loading && <p style={{ fontSize: 14, color: 'var(--faint)', margin: 0 }}>Consultando a Meta…</p>}
          {!loading && data && !data.ok && (
            <div style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 12, padding: '14px 18px' }}>
              <p style={{ fontWeight: 600, color: 'var(--bad)', margin: '0 0 4px' }}>Meta devolvió un error</p>
              <p style={{ fontFamily: MONO, fontSize: 13, color: 'var(--dim)', margin: 0 }}>{data.message ?? 'error'}</p>
            </div>
          )}
          {!loading && data && data.ok && data.empty && (
            <div style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-fill)', borderRadius: 12, padding: '16px 18px' }}>
              <p style={{ fontWeight: 600, color: 'var(--warn)', margin: '0 0 6px' }}>Meta no devolvió recomendaciones por API</p>
              <p style={{ fontSize: 13.5, color: 'var(--dim)', margin: 0, lineHeight: 1.5 }}>{data.reason}</p>
            </div>
          )}
          {!loading && data && data.ok && !data.empty && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {data.opportunityScore != null && (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 40, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{Math.round(data.opportunityScore)}</span>
                  <span style={{ fontSize: 13.5, color: 'var(--dim)' }}>Opportunity Score (Meta)</span>
                </div>
              )}
              {(data.recomendaciones ?? []).map((r, i) => (
                <div key={i} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)', marginBottom: 3 }}>{r.titulo}</div>
                  <div style={{ fontSize: 13.5, color: 'var(--dim)' }}>{r.detalle}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── botón negro de MaKo con menú de acciones (Analizar / Ordenar nombres) ──
function MakoMenu({ actions }: { actions: Array<{ label: string; sub?: string; onClick: () => void }> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc); document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc); };
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative', flex: 'none' }}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} title="Acciones con MaKo"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 15px', borderRadius: 999, border: 'none', background: '#171511', color: '#F3F0E7', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(23,21,17,.18)' }}>
        <MakoStar size={14} /><MakoWord>MaKo</MakoWord>
        <span style={{ fontSize: 10, opacity: 0.85, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
      </button>
      {open && (
        <div role="menu" style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50, minWidth: 270, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 16px 40px rgba(23,21,17,.22)', padding: 6 }}>
          {actions.map((a) => (
            <button key={a.label} type="button" role="menuitem" onClick={() => { setOpen(false); a.onClick(); }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              style={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%', textAlign: 'left', padding: '9px 11px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: SANS }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{a.label}</span>
              {a.sub && <span style={{ fontSize: 12, color: 'var(--dim)' }}>{a.sub}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── modal "MaKo · Ordenar nombres" — propone una nomenclatura y la aplica ──
const NIVEL_NOUN: Record<Level, string> = { campaign: 'campañas', adset: 'conjuntos', ad: 'anuncios' };
const MESES_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const anioDe = (iso: string | null) => { if (!iso) return ''; const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : String(d.getFullYear()); };
const mesDe = (iso: string | null) => { if (!iso) return ''; const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : MESES_ES[d.getMonth()]; };
const mesAnioKey = (iso: string | null) => { if (!iso) return ''; const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }; // "YYYY-MM" para el filtro de rango
const MES_RE = /\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/i;
// Mes/año DETERMINÍSTICOS: del nombre si los menciona, si no de la fecha de creación.
// (Antes los inferia la IA y se equivocaba, ej. "Webinar 9 de julio" → Junio.)
function fechaDeNombre(name: string, createdTime: string | null): { mes: string; anio: string } {
  const m = name.match(MES_RE);
  let mes = m ? m[1].toLowerCase() : '';
  if (mes === 'setiembre') mes = 'septiembre';
  mes = mes ? mes.charAt(0).toUpperCase() + mes.slice(1) : mesDe(createdTime);
  const y = name.match(/\b(20\d{2})\b/);
  return { mes, anio: y ? y[1] : anioDe(createdTime) };
}
// Variables que el usuario puede meter en la plantilla. {n}/{nn}/{nnn} = correlativo
// (lo pone el código). El resto las completa MaKo extrayéndolas del nombre/jerarquía.
const RENAME_VARS: Array<{ tok: string; label: string }> = [
  { tok: '{nnn}', label: 'N° (001)' },
  { tok: '{objetivo}', label: 'Objetivo' },
  { tok: '{angulo}', label: 'Ángulo' },
  { tok: '{audiencia}', label: 'Audiencia' },
  { tok: '{mes}', label: 'Mes' },
  { tok: '{anio}', label: 'Año' },
  { tok: '{nombre}', label: 'Nombre original' },
];
// Renderiza la plantilla: el correlativo {n+} con padding, las demás variables por
// substitución, y limpia los slots que quedaron sin resolver + separadores sueltos.
function applyTemplate(tpl: string, vars: Record<string, string>, n: number): string {
  let out = tpl.replace(/\{n+\}/g, (m) => String(n).padStart(Math.max(1, m.length - 2), '0'));
  for (const [k, v] of Object.entries(vars)) if (v) out = out.split(`{${k}}`).join(v);
  return out.replace(/\{[a-zA-Z_]+\}/g, '').replace(/\s{2,}/g, ' ').replace(/^[\s/|·.\-]+|[\s/|·.\-]+$/g, '').trim();
}

const TEMPLATE_DEFAULT = '{nnn}. {objetivo} / {angulo} - {mes} / {anio}';
function RenameModal({ level, entities, onClose, onApply }: { level: Level; entities: RenameEntity[]; onClose: () => void; onApply: (items: Array<{ id: string; level: Level; name: string }>) => Promise<number> }) {
  const [template, setTemplate] = useState(TEMPLATE_DEFAULT);
  const [desdeMes, setDesdeMes] = useState(''); // "YYYY-MM" (filtro por fecha de creación, opcional)
  const [hastaMes, setHastaMes] = useState('');
  const [notas, setNotas] = useState('');
  const [phase, setPhase] = useState<'idle' | 'loading' | 'review'>('idle');
  const [prop, setProp] = useState<Record<string, string>>({});
  const [incl, setIncl] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [uso, setUso] = useState<{ tokens: number; costUsd: number } | null>(null);
  const tplRef = useRef<HTMLInputElement>(null);

  // Entidades en alcance: filtradas por RANGO de fecha de creación (las de afuera NO
  // se tocan). El filtro lo hace el código, NO la IA (antes lo metían en las notas y
  // la IA "filtraba" dejando objetivo/ángulo vacíos).
  const enAlcance = useMemo(() => entities.filter((e) => {
    const k = mesAnioKey(e.createdTime);
    if (!k) return !desdeMes && !hastaMes; // sin fecha → solo si no hay filtro
    return (!desdeMes || k >= desdeMes) && (!hastaMes || k <= hastaMes);
  }), [entities, desdeMes, hastaMes]);
  // Variables que pide la IA: solo las SEMÁNTICAS. El correlativo, {nombre}, {mes} y
  // {anio} los pone el código (determinístico) → la IA nunca se equivoca con la fecha.
  const varsNeeded = useMemo(() => [...new Set([...template.matchAll(/\{([a-zA-Z_]+)\}/g)].map((m) => m[1]))].filter((v) => !/^n+$/.test(v) && !['nombre', 'mes', 'anio'].includes(v)), [template]);

  const insertar = (tok: string) => {
    const el = tplRef.current;
    if (!el) { setTemplate((t) => t + tok); return; }
    const s = el.selectionStart ?? template.length, e = el.selectionEnd ?? template.length;
    setTemplate(template.slice(0, s) + tok + template.slice(e));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + tok.length, s + tok.length); });
  };

  const proponer = async () => {
    if (!template.trim()) { setErr('Escribí una plantilla.'); return; }
    setPhase('loading'); setErr(null);
    try {
      const valores: Record<string, Record<string, string>> = {};
      if (varsNeeded.length > 0) {
        const r = await fetch('/api/ads-manager/rename-suggest', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ level, notas, vars: varsNeeded, entities: enAlcance.map((e) => ({ id: e.id, name: e.name, campana: e.campName, adset: e.adsetName, anio: anioDe(e.createdTime), mes: mesDe(e.createdTime) })) }),
        });
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || 'MaKo no pudo proponer');
        for (const v of (j.valores ?? []) as Array<{ id: string; vars: Record<string, string> }>) valores[v.id] = v.vars ?? {};
        setUso(j.uso ?? null);
      }
      // Render determinístico: correlativo + mes/año por código; objetivo/ángulo de la IA.
      const map: Record<string, string> = {};
      const inc = new Set<string>();
      enAlcance.forEach((e, i) => {
        const { mes, anio } = fechaDeNombre(e.name, e.createdTime);
        const v = { ...valores[e.id], nombre: e.name, mes, anio };
        const nuevo = applyTemplate(template, v, i + 1);
        map[e.id] = nuevo || e.name;
        if (nuevo && nuevo !== e.name) inc.add(e.id);
      });
      setProp(map); setIncl(inc); setPhase('review');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setPhase('idle'); }
  };

  const cambios = enAlcance.filter((e) => incl.has(e.id) && prop[e.id] && prop[e.id].trim() && prop[e.id].trim() !== e.name);
  const aplicar = async () => {
    setApplying(true);
    try { await onApply(cambios.map((e) => ({ id: e.id, level, name: prop[e.id].trim() }))); onClose(); }
    finally { setApplying(false); }
  };

  const inp: CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none' };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 75, background: 'rgba(23,21,17,.52)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 20px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 760, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 30px 70px rgba(23,21,17,.35)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>MaKo · Ordenar nombres</div>
            <h2 style={{ fontWeight: 600, fontSize: 20, margin: '3px 0 0', color: 'var(--ink)' }}>Renombrar {NIVEL_NOUN[level]}</h2>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, flex: 'none', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 16, cursor: 'pointer' }}>✕</button>
        </div>

        {phase !== 'review' ? (
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.55, margin: 0 }}>Definís la <b>plantilla</b> con variables; MaKo completa cada variable mirando el nombre actual y la jerarquía, y el sistema arma el nombre con ese formato EXACTO. Revisás y confirmás antes de escribir en Meta.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--dim)' }}>Plantilla del nombre</span>
              <input ref={tplRef} value={template} onChange={(e) => setTemplate(e.target.value)} placeholder="{nnn}. {objetivo} / {angulo} - {mes} / {anio}" style={{ ...inp, fontFamily: MONO, fontSize: 13.5 }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--dim)' }}>Renombrar solo las creadas en este rango (por fecha de creación)</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>Desde</span>
                <input type="month" value={desdeMes} onChange={(e) => setDesdeMes(e.target.value)} style={{ ...inp, width: 160 }} />
                <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>hasta</span>
                <input type="month" value={hastaMes} onChange={(e) => setHastaMes(e.target.value)} style={{ ...inp, width: 160 }} />
                {(desdeMes || hastaMes) && <button type="button" onClick={() => { setDesdeMes(''); setHastaMes(''); }} style={{ border: 'none', background: 'transparent', color: 'var(--accent)', fontFamily: SANS, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Limpiar fechas</button>}
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>Insertar:</span>
              {RENAME_VARS.map((v) => (
                <button key={v.tok} type="button" onClick={() => insertar(v.tok)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 12, cursor: 'pointer' }}><code style={{ fontFamily: MONO, fontSize: 11, color: 'var(--accent)' }}>{v.tok}</code> {v.label}</button>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--dim)' }}>Notas de estilo para MaKo (opcional)</span>
              <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} placeholder="Cómo nombrar (estilo), NO para filtrar. Ej: objetivo en 1 palabra; ángulo corto; las de retargeting que el ángulo diga RTG." style={{ ...inp, resize: 'vertical' }} />
            </div>

            <div style={{ fontSize: 12.5, color: 'var(--dim)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
              Se renombrarán <b style={{ color: 'var(--ink)' }}>{enAlcance.length}</b> de {entities.length} {NIVEL_NOUN[level]}{(desdeMes || hastaMes) ? ` (creadas${desdeMes ? ` desde ${desdeMes}` : ''}${hastaMes ? ` hasta ${hastaMes}` : ''}; el resto no se toca)` : ''}. Ejemplo: <code style={{ fontFamily: MONO, color: 'var(--ink)' }}>{applyTemplate(template, { objetivo: 'Leads', angulo: 'Dolor', audiencia: 'Dueños', mes: 'Julio', anio: '2025', nombre: 'Ej' }, 1) || '—'}</code>
            </div>

            {err && <div style={{ fontSize: 13, color: 'var(--bad)' }}>Error: {err}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={proponer} disabled={phase === 'loading' || enAlcance.length === 0} style={{ padding: '10px 18px', borderRadius: 11, border: 'none', background: phase === 'loading' || enAlcance.length === 0 ? 'var(--border-strong)' : 'var(--ink)', color: 'var(--surface)', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: phase === 'loading' ? 'wait' : 'pointer' }}>{phase === 'loading' ? 'MaKo completando…' : '✦ Generar con MaKo'}</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ padding: '16px 24px', maxHeight: '56vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ fontSize: 13, color: 'var(--dim)' }}>{cambios.length} de {enAlcance.length} cambian. Destildá los que no quieras o editá el nombre generado.</span>
                {uso && <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)', whiteSpace: 'nowrap' }}>✦ {uso.tokens >= 1000 ? `${(uso.tokens / 1000).toFixed(1)}k` : uso.tokens} tok · ${uso.costUsd >= 1 ? uso.costUsd.toFixed(2) : uso.costUsd.toFixed(3)}</span>}
              </div>
              {enAlcance.map((e) => {
                const nuevo = prop[e.id] ?? e.name;
                const cambia = incl.has(e.id) && nuevo.trim() !== e.name;
                return (
                  <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '22px 1fr 1fr', gap: 10, alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                    <input type="checkbox" checked={incl.has(e.id)} onChange={() => setIncl((s) => { const n = new Set(s); if (n.has(e.id)) n.delete(e.id); else n.add(e.id); return n; })} style={{ cursor: 'pointer' }} />
                    <span style={{ fontSize: 12.5, color: 'var(--faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: cambia ? 'line-through' : 'none' }} title={e.name}>{e.name}</span>
                    <input value={nuevo} maxLength={400} onChange={(ev) => setProp((p) => ({ ...p, [e.id]: ev.target.value }))} style={{ width: '100%', padding: '6px 9px', borderRadius: 8, border: `1px solid ${cambia ? 'var(--accent)' : 'var(--border)'}`, background: incl.has(e.id) ? 'var(--surface)' : 'var(--surface-2)', color: incl.has(e.id) ? 'var(--ink)' : 'var(--faint)', fontFamily: SANS, fontSize: 13, outline: 'none' }} />
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 24px', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => { setPhase('idle'); setConfirming(false); }} style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13.5, cursor: 'pointer' }}>← Volver</button>
              {confirming ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, color: 'var(--ink)' }}>¿Renombrar {cambios.length} en Meta?</span>
                  <button onClick={aplicar} disabled={applying} style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--good)', color: '#fff', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: applying ? 'wait' : 'pointer' }}>{applying ? 'Aplicando…' : 'Confirmar'}</button>
                  <button onClick={() => setConfirming(false)} disabled={applying} style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13.5, cursor: 'pointer' }}>No</button>
                </div>
              ) : (
                <button onClick={() => setConfirming(true)} disabled={cambios.length === 0} style={{ padding: '10px 18px', borderRadius: 11, border: 'none', background: cambios.length === 0 ? 'var(--border-strong)' : 'var(--ink)', color: 'var(--surface)', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: cambios.length === 0 ? 'default' : 'pointer' }}>Aplicar {cambios.length} en Meta</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
