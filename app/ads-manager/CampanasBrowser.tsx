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

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { Dropdown } from '../components/Dropdown';
import { MakoStar } from '../_components/MakoBrand';
import { cifra, cuentaAUsd, editaPresupuestoAca, esConvertible, horaDeEscritura, inicialTipeado, montoCuenta, presupuestosVigentes, saltoPresupuesto, tipeadoACuenta, type EscritoPresupuesto } from '@/lib/presupuesto-cambio';
import type { SenalRecon, ReconVeredicto, RitmoEstado } from '@/lib/queries';
import {
  colorDeSemaforo, bgDeSemaforo, explicarIssueEs, esAprobacionPendiente, linkAprobarEnMeta,
  statusLabel as metaStatusLabel, statusSemaforo as metaStatusSemaforo,
  type MetaHealth, type NodoEstado, type Semaforo, type Issue,
} from '@/lib/meta-health-ui';

type ProblemAd = { id: string; name: string; issues: Issue[]; statusLabel: string };
import type { CrossData } from './EntityDetalle';
import { resolverAd, synthSenal } from './ad-resolver';
import { ProductoCelda } from './ProductoCelda';
import { campanasAsignadasAction, previaCampanaAction, asignarCampanaAction, quitarCampanaAction, deshacerAsignacionAction, type ProductoNombre } from '../crm/campanas-actions';
import type { CampanaAsignada } from '@/lib/campana-config';
import type { Movido } from '../crm/campanas-actions';
import { hayQuePreguntar, valorDeProducto, funnelDeValor } from '@/lib/campana-asignar';
import { Confirm, Modal, Toast, useToast } from '@/app/_ui';
import { Icon } from '../_components/icons';
import { MenuAcciones, FiltrosMenu, BarraLoteAds } from './BarraAcciones';

const AdDetailTabs = dynamic(() => import('../marketing/ad-charts').then((m) => m.AdDetailTabs), { ssr: false });
const EntityDetalle = dynamic(() => import('./EntityDetalle').then((m) => m.EntityDetalle), { ssr: false });
const NuevaCampanaModal = dynamic(() => import('./NuevaCampanaModal').then((m) => m.NuevaCampanaModal), { ssr: false });
const EditarTextosModal = dynamic(() => import('./EditarTextosModal').then((m) => m.EditarTextosModal), { ssr: false });
const EditarPublicoModal = dynamic(() => import('./EditarPublicoModal').then((m) => m.EditarPublicoModal), { ssr: false });
const AgregarAnuncioModal = dynamic(() => import('./AgregarAnuncioModal').then((m) => m.AgregarAnuncioModal), { ssr: false });
const AgregarConjuntoModal = dynamic(() => import('./AgregarConjuntoModal').then((m) => m.AgregarConjuntoModal), { ssr: false });
const TutorialAprobacionMeta = dynamic(() => import('./TutorialAprobacionMeta').then((m) => m.TutorialAprobacionMeta), { ssr: false });

const pad = (n: number, w: number): string => String(Math.max(0, Math.floor(n))).padStart(w, '0');
const letraANum = (s: string): number => { let n = 0; for (const ch of s.toLowerCase()) n = n * 26 + (ch.charCodeAt(0) - 96); return n; };
// Siguiente sufijo de nomenclatura a partir del MÁXIMO hijo existente (no del conteo),
// para no colisionar/saltear tras borrar un hijo.
const nextSuffix = (kids: Array<{ name: string }>, kind: 'letra' | 'num'): number => {
  let max = 0;
  for (const k of kids) {
    const seg = k.name.split(/\s+/)[0].split('.').pop() ?? '';
    if (kind === 'letra') { if (/^[a-z]+$/i.test(seg)) max = Math.max(max, letraANum(seg)); }
    else if (/^\d+$/.test(seg)) max = Math.max(max, Number(seg));
  }
  return max + 1;
};

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

// ── formato ──
const fmtUSD = (n: number | null | undefined, d?: number) => {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const dec = d ?? (Math.abs(n) < 100 ? 2 : 0);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: dec, minimumFractionDigits: dec }).format(n);
};
const fmtNum = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : new Intl.NumberFormat('es-MX').format(Math.round(n)));

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
type ColId = 'entrega' | 'resultados' | 'costoRes' | 'presupuesto' | 'gastado' | 'impresiones' | 'cierres' | 'cash' | 'aprendizaje' | 'producto';
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
  // Un anuncio no se asigna: el ruteo es por campaña o conjunto (lib/campana-config.ts).
  { id: 'producto', label: 'Funnel (CRM)', levels: ['campaign', 'adset'] },
];
const ALWAYS_ON: ColId[] = ['entrega'];
const COLS_KEY = (tab: Tab) => `mako.adsTable.cols.${tab}`;
function defaultCols(): Record<ColId, boolean> {
  return { entrega: true, resultados: true, costoRes: true, presupuesto: true, gastado: true, impresiones: true, cierres: true, cash: true, aprendizaje: true, producto: true };
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

/**
 * Un cambio de presupuesto esperando el «sí» (tarea #349). Sirve igual para UNA fila
 * (la celda) y para N (la barra de lote), así hay un solo cartel y un solo camino a
 * `writeBudget`. Los montos van en la MONEDA DE LA CUENTA, y la moneda viaja acá
 * adentro: el cartel y la escritura tienen que hablar de la misma.
 */
type PideBudget = {
  filas: Array<{ lvl: 'campaign' | 'adset'; id: string; nombre: string; viejo: number | null }>;
  nuevo: number;
  /** Elegidas que no se pueden cambiar en este nivel (o que tienen presupuesto total). */
  afuera: number;
  moneda: string;
};

const th: CSSProperties = { padding: '9px 12px', fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 700, whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', position: 'sticky', top: 0, zIndex: 3 };
const td: CSSProperties = { padding: '7px 12px', fontSize: 13, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' };

// El detalle de un anuncio es direccionable: /ads-manager/<ad_id>. La URL se
// mantiene sincronizada con lo que tenés abierto, así el link se puede copiar,
// compartir y MaKo puede mandarte el anuncio exacto en vez de dejarte en la tab.
// Se usa la History API nativa (Next 16 la sincroniza con su router) en vez de
// router.push: navegar de verdad remontaría el browser y perdería el árbol de
// Meta que ya se bajó — abrir un modal no puede costar una recarga.
const urlDeAd = (adId: string | null) => {
  const qs = typeof window === 'undefined' ? '' : window.location.search;
  return `/ads-manager${adId ? `/${adId}` : ''}${qs}`;
};
const adIdDeLaUrl = (): string | null => {
  const m = /^\/ads-manager\/([^/?#]+)/.exec(window.location.pathname);
  return m ? decodeURIComponent(m[1]) : null;
};

export function CampanasBrowser({ senales, desde, hasta, adInicial = null, hoyReal }: { senales: SenalRecon[]; desde: string; hasta: string; adInicial?: string | null; hoyReal: string }) {
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
  // A qué PRODUCTO del CRM entran los leads de cada campaña. La pieza entera es del CRM
  // (app/crm/campanas-actions.ts): acá sólo se ofrece donde Martín la pidió. Se pregunta
  // UNA vez y no llama a Meta. Si no contesta (no sos admin), la columna no se dibuja —
  // un desplegable que no puede escribir se lee como que la app está rota.
  const [asig, setAsig] = useState<{ productos: ProductoNombre[]; asignadas: CampanaAsignada[] } | null>(null);
  const { toast: toastProd, show: showProd, clear: clearProd } = useToast(7000);
  const [elegirCampana, setElegirCampana] = useState(false);
  const [pideLote, setPideLote] = useState<{ valor: string; funnelId: number | null; nombre: string; aTraer: number; n: number } | null>(null);

  // escrituras
  // `budget` va en la MONEDA DE LA CUENTA (no en MXN: se llamaba `budgetMxn` por historia).
  const [optimistic, setOptimistic] = useState<Map<string, { status?: 'ACTIVE' | 'PAUSED'; budget?: number; name?: string }>>(new Map());
  const [writing, setWriting] = useState<Set<string>>(new Set());
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // Ningún presupuesto se escribe sin pasar por acá: la celda y el lote arman esto, el
  // cartel lo muestra, y sólo su «sí» llama a writeBudget. (El `confirmDel` que vivía en
  // este lugar era código muerto: el borrado confirma en la barra de lote.)
  const [pideBudget, setPideBudget] = useState<PideBudget | null>(null);
  // El pedido que ya se está aplicando. Enter en el cartel tiene DOS caminos al mismo
  // onConfirm —el listener del documento y el click nativo del botón enfocado—; con el
  // mismo objeto en la mano, el segundo no escribe de nuevo.
  const aplicandoBudget = useRef<PideBudget | null>(null);
  // Presupuestos escritos desde esta pestaña, con la hora del servidor (null = en vuelo):
  // ver presupuestosVigentes.
  const escritos = useRef<Map<string, EscritoPresupuesto>>(new Map());

  // modales
  const [adSel, setAdSel] = useState<SenalRecon | null>(null);
  const [entSel, setEntSel] = useState<{ node: NodoEstado; level: 'campaign' | 'adset'; cross: CrossData } | null>(null);
  const [recosOpen, setRecosOpen] = useState(false);
  const [nuevaOpen, setNuevaOpen] = useState(false);
  // modo del wizard: campaña nueva vs subir creativos a una campaña existente
  const [nuevaModo, setNuevaModo] = useState<'nueva' | 'existente'>('nueva');
  const [editCopyAd, setEditCopyAd] = useState<{ id: string; name: string } | null>(null);
  const [problemaSel, setProblemaSel] = useState<{ titulo: string; ads: ProblemAd[] } | null>(null);
  const [editPublicoAdset, setEditPublicoAdset] = useState<{ id: string; name: string } | null>(null);
  // Sube cada vez que se guarda un público: el detalle abierto relee «Dónde se muestra»
  // (y sólo eso; un `key` remontaría el detalle entero y volvería a pedir las métricas).
  const [versionGeo, setVersionGeo] = useState(0);
  // La campaña y su objetivo viajan con el anuncio: sin ellos el registro de la publicación
  // nacía con el default de la tabla (Leads) y sin campaña (revisión de la #59).
  const [addAnuncioAdset, setAddAnuncioAdset] = useState<{ id: string; name: string; campaignId: string | null; objective: string | null } | null>(null);
  const [addConjuntoCamp, setAddConjuntoCamp] = useState<{ id: string; name: string } | null>(null);

  const cargar = (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    fetch('/api/meta-health', { cache: 'no-store' }).then((r) => r.json())
      // Datos frescos de Meta = autoridad: soltamos los overrides optimistas para que
      // el effectiveStatus real (ACTIVE / CAMPAIGN_PAUSED / IN_REVIEW / DISAPPROVED…)
      // reemplace a lo que pintamos al vuelo y la columna "entrega" no mienta.
      // ⚠️ Salvo los presupuestos recién escritos: esta lectura puede venir de una caché
      // que la escritura no invalida —y que sirve vencido—, y soltarlos pintaba el monto
      // VIEJO en la fila (lib/presupuesto-cambio.ts → presupuestosVigentes).
      .then((j) => { if (j.error) setError(j.error); else { setHealth(j); setOptimistic(optimistasQueSiguen(j)); } })
      .catch((e) => setError(String(e))).finally(() => { if (!silent) setLoading(false); });
  };
  const optimistasQueSiguen = (h: MetaHealth) => {
    const reales = new Map<string, number | null>([...h.campaigns, ...h.adsets].map((n) => [n.id, n.dailyBudgetMxn ?? null]));
    // Cuándo EMPEZÓ esta lectura en el servidor, no cuándo llegó acá: de una caché puede
    // llegar una lectura de hace diez minutos.
    const leidaDesde = Date.parse(h.inicioLecturaISO ?? '');
    const { mantener, soltar } = presupuestosVigentes(escritos.current, reales, Number.isFinite(leidaDesde) ? leidaDesde : null);
    for (const id of soltar) escritos.current.delete(id);
    return new Map([...mantener].map(([id, budget]) => [id, { budget }]));
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

  useEffect(() => {
    let vivo = true;
    campanasAsignadasAction()
      .then((r) => { if (vivo && r.ok) setAsig({ productos: r.productos, asignadas: r.asignadas }); })
      .catch(() => { /* sin productos no hay columna: no poder preguntar no apaga la tabla */ });
    return () => { vivo = false; };
  }, []);
  const asignadaDe = useMemo(() => new Map((asig?.asignadas ?? []).map((a) => [a.id, a])), [asig]);

  const campaignsById = useMemo(() => new Map((health?.campaigns ?? []).map((c) => [c.id, c])), [health]);
  const adsetsById = useMemo(() => new Map((health?.adsets ?? []).map((a) => [a.id, a])), [health]);
  // Rollup de problemas: los anuncios "con problemas" (semáforo rojo) tienen que
  // marcar también su conjunto y su campaña como URGENTE, con el motivo real de Meta.
  const rollup = useMemo(() => {
    const adsByAdset = new Map<string, ProblemAd[]>(), adsByCamp = new Map<string, ProblemAd[]>();
    const push = (m: Map<string, ProblemAd[]>, k: string, v: ProblemAd) => { const a = m.get(k); if (a) a.push(v); else m.set(k, [v]); };
    for (const ad of health?.ads ?? []) {
      if (ad.semaforo !== 'rojo') continue;
      const item: ProblemAd = { id: ad.id, name: ad.name, issues: ad.issues ?? [], statusLabel: ad.statusLabel };
      const adsetId = ad.parentId;
      if (adsetId) push(adsByAdset, adsetId, item);
      const campId = adsetId ? adsetsById.get(adsetId)?.parentId ?? null : null;
      if (campId) push(adsByCamp, campId, item);
    }
    return { adsByAdset, adsByCamp };
  }, [health, adsetsById]);
  const campName = (id: string | null) => (id ? campaignsById.get(id)?.name ?? null : null);
  const adsetCampId = (adsetId: string | null) => (adsetId ? adsetsById.get(adsetId)?.parentId ?? null : null);

  // ── Deep link a un anuncio (/ads-manager/<ad_id>) ──────────────────────────
  // Resuelve un ad_id de Meta contra el árbol YA cargado. No depende de la tab ni
  // de los filtros: un link tiene que abrir el anuncio aunque estés parado en
  // Campañas. Si el anuncio no tuvo gasto en el rango no está en `senales`, así
  // que cae a la señal sintética — el mismo fallback que el click en la fila.
  const senalDeAd = useCallback((adId: string) => resolverAd(adId, senales, health), [senales, health]);

  // Abrir/cerrar SIEMPRE por acá: mantiene la URL y el modal en el mismo estado.
  const abrirAd = useCallback((senal: SenalRecon | null, syncUrl = true) => {
    setAdSel(senal);
    if (!syncUrl) return;
    const destino = urlDeAd(senal?.ad_id ?? null);
    if (window.location.pathname + window.location.search !== destino) window.history.pushState(null, '', destino);
  }, []);

  // El link entrante: espera a que baje el árbol y abre. `adAbierto` recuerda cuál
  // ya se consumió, para no reabrirlo si lo cerraste (la prop no cambia).
  //
  // Si el anuncio no aparece (id viejo, borrado en Meta, o sin datos en el rango de
  // fechas), NO se abre nada y quedás en la tabla: el link degrada a la tab, que es
  // exactamente donde estabas antes de que existiera esta ruta. No rompe.
  const adAbierto = useRef<string | null>(null);
  useEffect(() => {
    if (!health || !adInicial || adAbierto.current === adInicial) return;
    adAbierto.current = adInicial;
    const s = senalDeAd(adInicial);
    if (s) abrirAd(s, false);            // ya estamos en la URL: no la re-escribas
  }, [health, adInicial, senalDeAd, abrirAd]);

  // Atrás/adelante del navegador: la URL manda. Sin esto, cerrar con ← dejaba el
  // modal abierto sobre una URL que decía lo contrario.
  useEffect(() => {
    const onPop = () => {
      const id = adIdDeLaUrl();
      if (!id) { setAdSel(null); return; }
      const s = senalDeAd(id);
      if (s) setAdSel(s);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [senalDeAd]);

  const accountFrozen = !!health && (health.account.severidad === 'rojo' || health.account.status === 3);

  // overrides optimistas
  const effStatusOf = (node: NodoEstado) => optimistic.get(node.id)?.status ?? node.effectiveStatus;
  const budgetOf = (node: NodoEstado) => optimistic.get(node.id)?.budget ?? node.dailyBudgetMxn ?? null;
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
      // Sin asignar al final: lo que hay que mirar es lo que YA entra a un producto.
      case 'producto': return asignadaDe.get(r.node.id) ? (asig?.productos.find((p) => p.id === asignadaDe.get(r.node.id)!.funnelId)?.nombre ?? 'zz') : 'zzz';
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
  const setOpt = (id: string, patch: { status?: 'ACTIVE' | 'PAUSED'; budget?: number; name?: string }) =>
    setOptimistic((m) => { const n = new Map(m); n.set(id, { ...(n.get(id) ?? {}), ...patch }); return n; });
  const clearOpt = (id: string, k: 'status' | 'budget' | 'name') =>
    setOptimistic((m) => { const n = new Map(m); const cur = { ...(n.get(id) ?? {}) }; delete cur[k]; if (Object.keys(cur).length === 0) n.delete(id); else n.set(id, cur); return n; });
  const permMsg = (j: { error_subcode?: number; message?: string; error?: string }) => {
    if (j.error_subcode === 4841013)
      return `Meta bloqueó la escritura (permiso 4841013). El token ya es System User con ads_management y rol MANAGE; el bloqueo restante suele ser la 2FA obligatoria de la empresa (el admin que controla el system user debe tener 2FA activada) y/o la cuenta restringida por pago. Detalle: ${j.message ?? ''}`;
    // Si el backend mandó un error propio (p.ej. el guard de workspace), mostralo tal cual
    // en vez de disfrazarlo como un rechazo de Meta.
    if (j.error) return j.error;
    return `Meta rechazó el cambio: ${j.message ?? 'error'}`;
  };

  // Ids a ACTIVAR en cascada: el subárbol (hijos) + los ancestros, para que el árbol
  // COMPLETO entregue. Activar SOLO la campaña deja adsets/ads con su status propio en
  // PAUSED → la campaña no entrega. Toda la jerarquía ya está en `health` (con parentId).
  function statusCascadeIds(lvl: Level, id: string): string[] {
    if (!health) return [id];
    const ids = new Set<string>([id]);
    if (lvl === 'campaign') {
      const adsetIds = new Set<string>();
      for (const a of health.adsets) if (a.parentId === id) { ids.add(a.id); adsetIds.add(a.id); }
      for (const ad of health.ads) if (ad.parentId && adsetIds.has(ad.parentId)) ids.add(ad.id);
    } else if (lvl === 'adset') {
      const campId = adsetCampId(id);
      if (campId) ids.add(campId);
      for (const ad of health.ads) if (ad.parentId === id) ids.add(ad.id);
    } else {
      const ad = health.ads.find((x) => x.id === id);
      const adsetId = ad?.parentId ?? null;
      if (adsetId) { ids.add(adsetId); const campId = adsetCampId(adsetId); if (campId) ids.add(campId); }
    }
    return [...ids];
  }
  const levelOf = (id: string): Level => (campaignsById.has(id) ? 'campaign' : adsetsById.has(id) ? 'adset' : 'ad');

  // POST de status de UN id (optimistic + revert). Devuelve ok/mensaje; no togglea selección.
  async function writeOneStatus(lvl: Level, id: string, next: 'ACTIVE' | 'PAUSED'): Promise<{ ok: boolean; msg?: string }> {
    setWriting((w) => new Set(w).add(id));
    setOpt(id, { status: next });
    try {
      const r = await fetch('/api/meta-write', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level: lvl, id, op: 'status', status: next }) });
      const j = await r.json();
      if (!j.ok) { clearOpt(id, 'status'); return { ok: false, msg: permMsg(j) }; }
      return { ok: true };
    } catch (e) { clearOpt(id, 'status'); return { ok: false, msg: `Error de red: ${String(e)}` }; }
    finally { setWriting((w) => { const n = new Set(w); n.delete(id); return n; }); }
  }

  async function writeStatus(lvl: Level, id: string, next: 'ACTIVE' | 'PAUSED') {
    // PAUSAR: una sola entidad. Pausar la raíz en Meta ya frena la entrega de todo el
    // subárbol (los hijos pasan a CAMPAIGN_PAUSED/ADSET_PAUSED solos), así que basta 1 call.
    if (next === 'PAUSED') { const r = await writeOneStatus(lvl, id, 'PAUSED'); if (!r.ok) setToast(r.msg ?? 'Meta rechazó el cambio'); cargar(true); return; }
    // ACTIVAR: cascada a padres + hijos para que el árbol completo entregue.
    const results = await Promise.allSettled(statusCascadeIds(lvl, id).map((cid) => writeOneStatus(levelOf(cid), cid, 'ACTIVE')));
    const fail = results.find((res): res is PromiseFulfilledResult<{ ok: boolean; msg?: string }> => res.status === 'fulfilled' && !res.value.ok);
    if (fail) setToast(fail.value.msg ?? 'Meta rechazó activar parte del árbol');
    cargar(true); // reconciliar con el estado EFECTIVO real de Meta (sin spinner)
  }
  // POST del presupuesto de UN id, con el molde de writeOneStatus: devuelve si salió,
  // porque el lote lo necesita para no afirmar «cambiado en N» sobre fallos (antes no
  // devolvía nada y el toast del lote pisaba el error con un éxito).
  //
  // ⚠️ La llama SÓLO aplicarPresupuesto, que la llama SÓLO el «sí» del cartel. La celda
  // y la barra de lote arman `pideBudget` y nada más: lo fija
  // tests/ads-presupuesto-confirma.test.ts.
  //
  // `monto` va en la MONEDA DE LA CUENTA; el campo del contrato se llama
  // `dailyBudgetMxn` por historia y renombrarlo es una migración de contrato.
  async function writeBudget(lvl: 'campaign' | 'adset', id: string, monto: number): Promise<{ ok: boolean; msg?: string }> {
    setWriting((w) => new Set(w).add(id));
    // ⚠️ Se anota ANTES del POST, en vuelo (`en: null`). Un cargar() que resuelva en el
    // medio —la pausa de otra fila, el ↻— reemplaza el mapa optimista entero y deja sólo
    // lo que está en `escritos`: anotado recién al volver OK, la fila perdía el monto
    // nuevo y no lo recuperaba nunca, con el aviso «Presupuesto cambiado» encima.
    const previo = escritos.current.get(id);
    const mio: EscritoPresupuesto = { valor: monto, en: null };
    escritos.current.set(id, mio);
    setOpt(id, { budget: monto });
    // Si falla, la fila vuelve a lo que mostraba ANTES, no al árbol cargado: si hubo una
    // escritura anterior confirmada, el árbol puede ser de antes de ella y pintaría un
    // monto que Meta ya no tiene (y el próximo cartel compararía contra ése). Dos
    // escrituras de la MISMA fila no se cruzan: la celda y el lote se apagan con `writing`.
    const volver = () => {
      if (escritos.current.get(id) !== mio) return;
      if (previo) { escritos.current.set(id, previo); setOpt(id, { budget: previo.valor }); }
      else { escritos.current.delete(id); clearOpt(id, 'budget'); }
    };
    try {
      const r = await fetch('/api/meta-write', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level: lvl, id, op: 'budget', dailyBudgetMxn: monto }) });
      const j = await r.json();
      if (!j.ok) { volver(); return { ok: false, msg: permMsg(j) }; }
      mio.en = horaDeEscritura(r.headers.get('date'), Date.now());
      // Y se repone: lo que haya pasado con el mapa mientras el POST viajaba, la fila
      // termina mostrando lo que Meta acaba de aceptar.
      if (escritos.current.get(id) === mio) setOpt(id, { budget: monto });
      return { ok: true };
    } catch (e) { volver(); return { ok: false, msg: `Error de red: ${String(e)}` }; }
    finally { setWriting((w) => { const n = new Set(w); n.delete(id); return n; }); }
  }
  // Cuenta los que NO salieron y arma un aviso. Sin esto una pausa en lote podía
  // fallar sin decir nada: seleccionabas 5 campañas, 2 no se pausaban, la tabla se
  // recargaba mostrándolas ACTIVE (el estado no miente) y no aparecía ningún cartel
  // — quedaban gastando y el usuario lo leía como "todavía no refrescó".
  const avisarFallos = (results: PromiseSettledResult<{ ok: boolean; msg?: string }>[], verbo: string) => {
    const fallidos = results.filter((r) => r.status === 'rejected' || !r.value.ok);
    if (!fallidos.length) return;
    const primero = fallidos.find((r): r is PromiseFulfilledResult<{ ok: boolean; msg?: string }> => r.status === 'fulfilled');
    const detalle = primero?.value.msg ?? 'Meta rechazó el cambio';
    setToast(fallidos.length === 1 ? `No se pudo ${verbo}: ${detalle}` : `No se pudieron ${verbo} ${fallidos.length} de ${results.length}: ${detalle}`);
  };
  const bulkStatus = async (next: 'ACTIVE' | 'PAUSED') => {
    const seeds = [...selSet];
    if (next === 'PAUSED') {
      const results = await Promise.allSettled(seeds.map((id) => writeOneStatus(level, id, 'PAUSED')));
      avisarFallos(results, 'pausar');
      cargar(true);
      return;
    }
    // ACTIVAR en lote: unir los subárboles de todo lo seleccionado y postear cada id 1 vez.
    const all = new Set<string>();
    for (const id of seeds) for (const cid of statusCascadeIds(level, id)) all.add(cid);
    const results = await Promise.allSettled([...all].map((cid) => writeOneStatus(levelOf(cid), cid, 'ACTIVE')));
    avisarFallos(results, 'activar');
    cargar(true); // reconciliar con el estado EFECTIVO real de Meta (sin spinner)
  };
  // ── presupuesto: la celda y el lote PREGUNTAN; sólo el cartel escribe (tarea #349) ──
  // El «viejo» sale de budgetOf, o sea de lo que la fila MUESTRA (con lo recién escrito),
  // no del árbol cacheado: el cartel compara contra lo que la persona está viendo.
  const filaBudget = (r: Row) => ({ lvl: r.level as 'campaign' | 'adset', id: r.node.id, nombre: nameOf(r.node), viejo: budgetOf(r.node) });

  // La celda: cerrar el editor y armar la pregunta. Nada de esto escribe.
  const pedirPresupuesto = (r: Row, nuevo: number) => {
    setEditingBudgetId(null);
    if (!health || !editaPresupuestoAca(r.node, r.level)) return;
    setPideBudget({ filas: [filaBudget(r)], nuevo, afuera: 0, moneda: health.account.currency });
  };

  // Presupuesto en lote. Sólo donde el DIARIO se edita en ESTE nivel (CBO→campaña,
  // ABO→conjunto, y nunca con presupuesto total): postear el resto sería pedirle a Meta
  // algo que va a rechazar —o escribir un diario sobre un total—, y el cartel dice
  // cuántos quedan afuera. Un lote que hace menos de lo que se le pidió y no lo dice es
  // el «éxito falso» de siempre.
  const bulkPresupuesto = (nuevo: number) => {
    if (!health) return;
    const elegidas = sorted.filter((r) => selSet.has(r.node.id));
    const puede = elegidas.filter((r) => editaPresupuestoAca(r.node, r.level));
    if (!puede.length) { setToast('Sin presupuesto diario en este nivel.'); return; }
    setPideBudget({ filas: puede.map(filaBudget), nuevo, afuera: elegidas.length - puede.length, moneda: health.account.currency });
  };

  // El «sí» del cartel. Todas en paralelo, como la pausa en lote, y el éxito se afirma
  // sólo si salieron TODAS. Sin cargar() después: la caché del árbol no se entera de la
  // escritura y no traería nada nuevo (ver presupuestosVigentes).
  const aplicarPresupuesto = async (p: PideBudget) => {
    const results = await Promise.allSettled(p.filas.map((f) => writeBudget(f.lvl, f.id, p.nuevo)));
    if (results.some((res) => res.status === 'rejected' || !res.value.ok)) { avisarFallos(results, 'cambiar'); return; }
    const n = p.filas.length;
    setToast(`${n === 1 ? 'Presupuesto cambiado' : `Presupuesto cambiado en ${n}`}${p.afuera ? ` · ${p.afuera} sin cambiar` : ''}`);
  };

  // Producto en lote. Pregunta UNA vez con el total —doce confirmaciones no son una
  // decisión— y deja UN deshacer, no N (la regla de la barra de lote del plan).
  const bulkProducto = async (valor: string) => {
    if (!asig) return;
    const elegidas = sorted.filter((r) => selSet.has(r.node.id) && r.level !== 'ad');
    if (!elegidas.length) return;
    const items = elegidas.map((r) => ({
      tipo: (r.level === 'campaign' ? 'campana' : 'conjunto') as 'campana' | 'conjunto',
      id: r.node.id, nombre: nameOf(r.node),
      campanaId: r.level === 'adset' ? (r.node.parentId ?? undefined) : undefined,
    }));

    if (valor === '') {
      const antes = items.map((i) => asignadaDe.get(i.id)).filter(Boolean) as CampanaAsignada[];
      for (const i of items) await quitarCampanaAction(i.id).then((r) => { if (r.ok) setAsig((v) => (v ? { ...v, asignadas: r.asignadas } : v)); });
      showProd(`${antes.length} sin funnel`, async () => {
        for (const a of antes) await asignarCampanaAction(a.funnelId, { tipo: a.tipo, id: a.id, nombre: a.nombre, campanaId: a.campanaId }, false)
          .then((r) => { if (r.ok) setAsig((v) => (v ? { ...v, asignadas: r.asignadas } : v)); });
      });
      return;
    }

    const funnelId = funnelDeValor(valor);
    const nombreProd = asig.productos.find((p) => p.id === funnelId)?.nombre ?? 'el funnel';
    const previas = await Promise.all(items.map((i) => previaCampanaAction(funnelId, i).catch(() => null)));
    const aTraer = previas.reduce((n, p) => n + (p && p.ok ? p.aTraer : 0), 0);
    const enOtro = items.some((i) => { const a = asignadaDe.get(i.id); return !!a && a.funnelId !== funnelId; });
    if (hayQuePreguntar(aTraer, enOtro ? 'otro funnel' : null)) {
      setPideLote({ valor, funnelId, nombre: nombreProd, aTraer, n: items.length });
      return;
    }
    await aplicarProductoLote(funnelId, items, nombreProd);
  };

  const aplicarProductoLote = async (funnelId: number | null, items: Array<{ tipo: 'campana' | 'conjunto'; id: string; nombre: string; campanaId?: string }>, nombreProd: string) => {
    const hechos: Array<{ id: string; antes: CampanaAsignada | null; movidos: Movido[] }> = [];
    let movidos = 0;
    for (const i of items) {
      const r = await asignarCampanaAction(funnelId, i, true);
      if (!r.ok) { showProd(r.error, undefined, 'bad'); continue; }
      setAsig((v) => (v ? { ...v, asignadas: r.asignadas } : v));
      hechos.push({ id: i.id, antes: r.antes, movidos: r.movidos });
      movidos += r.movidos.length;
    }
    showProd(movidos ? `${movidos} leads a ${nombreProd}` : `${hechos.length} en ${nombreProd}`, async () => {
      for (const h of hechos) await deshacerAsignacionAction(h.id, h.antes, h.movidos)
        .then((r) => { if (r.ok) setAsig((v) => (v ? { ...v, asignadas: r.asignadas } : v)); });
    });
  };

  // Eliminar (solo PAUSADAS, con confirmación). Borrar campaña cascadea conjuntos/anuncios.
  const bulkDelete = async () => {
    const ids = [...selSet];
    const rowsSel = sorted.filter((r) => selSet.has(r.node.id));
    if (rowsSel.some((r) => effStatusOf(r.node) === 'ACTIVE')) { setToast('Solo se pueden eliminar campañas pausadas. Pausa primero las activas seleccionadas.'); return; }
    let ok = 0; let lastErr = '';
    for (const id of ids) {
      setWriting((w) => new Set(w).add(id));
      try {
        const r = await fetch('/api/meta-write', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level, id, op: 'delete' }) });
        const j = await r.json();
        if (j.ok) ok++; else lastErr = permMsg(j);
      } catch (e) { lastErr = `Error de red: ${String(e)}`; }
      finally { setWriting((w) => { const n = new Set(w); n.delete(id); return n; }); }
    }
    setSelSet(new Set());
    setToast(ok === ids.length ? `Eliminada${ok === 1 ? '' : 's'} ${ok}.` : `Eliminadas ${ok}/${ids.length}. Meta rechazó el resto: ${lastErr}`);
    cargar();
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
    if (r.level === 'ad') { abrirAd(r.senal ?? synthSenal(r.node, r.campName, r.adsetName)); return; }
    setEntSel({ node: r.node, level: r.level as 'campaign' | 'adset', cross: { cierres: r.perf.cierres, cash_usd: r.perf.cash_usd, agendasCrm: r.perf.agendas } });
  };

  /**
   * Acciones de EDICIÓN por fila. Agregar ya no vive acá: «+ conjunto» y «+ anuncio»
   * se fueron a la barra de la selección múltiple (Martín, 06/10: «elimina el botón de
   * "+conjunto" que hay en cada fila… como también el "+anuncio" en los adset»). Una
   * fila es para mirar y corregir lo que ya existe; crear algo nuevo se decide sobre lo
   * que uno eligió.
   *
   * El ícono sale del catálogo y nunca es un emoji: el 👥 de «público» se dibujaba
   * distinto en cada sistema y no heredaba el color del botón.
   */
  const rowActionsFor = (r: Row): Array<{ icono: string; label: string; title: string; onClick: () => void }> => {
    if (r.level === 'ad') return [{ icono: 'escribir', label: 'Textos', title: 'Editar textos del anuncio', onClick: () => setEditCopyAd({ id: r.node.id, name: nameOf(r.node) }) }];
    if (r.level === 'adset') return [{ icono: 'users', label: 'Público', title: 'Editar el público de este conjunto', onClick: () => setEditPublicoAdset({ id: r.node.id, name: nameOf(r.node) }) }];
    return [];
  };

  // Los nombres de lo que se crea salen con la nomenclatura (001.01.a…), igual que antes.
  const nombreConjuntoNuevo = (camp: NodoEstado) => {
    const code = nameOf(camp).match(/^\d+/)?.[0] ?? '000';
    const kids = (health?.adsets ?? []).filter((a) => a.parentId === camp.id);
    return `${code}.${pad(nextSuffix(kids, 'num'), 2)} Conjunto`;
  };
  const nombreAnuncioNuevo = (adset: NodoEstado) => {
    const code = nameOf(adset).split(/\s+/)[0] || (nameOf(adset).match(/^\d+/)?.[0] ?? '000');
    const kids = (health?.ads ?? []).filter((a) => a.parentId === adset.id);
    return `${code}.${letra(nextSuffix(kids, 'letra'))} Anuncio`;
  };

  // columnas visibles para la tab actual
  const hayCol = (c: ColDef) => (!c.levels || c.levels.includes(level)) && (c.id !== 'producto' || (!!asig && asig.productos.length > 1));
  const cols = ALL_COLS.filter((c) => hayCol(c) && (ALWAYS_ON.includes(c.id) || visibleCols[c.id]));
  const configurables = ALL_COLS.filter(hayCol);

  const tabs: Array<{ key: Tab; label: string; n: number }> = [
    { key: 'campanas', label: 'Campañas', n: health?.campaigns.length ?? 0 },
    { key: 'conjuntos', label: selCamp.size > 0 ? `Conjuntos · ${selCamp.size} campaña${selCamp.size === 1 ? '' : 's'}` : 'Conjuntos', n: health?.adsets.length ?? 0 },
    { key: 'anuncios', label: selAdset.size > 0 ? `Anuncios · ${selAdset.size} conjunto${selAdset.size === 1 ? '' : 's'}` : selCamp.size > 0 ? `Anuncios · ${selCamp.size} campaña${selCamp.size === 1 ? '' : 's'}` : 'Anuncios', n: health?.ads.length ?? 0 },
  ];

  // Entidades del nivel actual (todas, con su jerarquía) para el renombrado con MaKo.
  const renameEntities = useMemo<RenameEntity[]>(() => {
    if (!health) return [];
    if (level === 'campaign') return health.campaigns.map((n) => ({ id: n.id, name: nameOf(n), campName: null, adsetName: null, createdTime: n.createdTime ?? null, parentId: null }));
    if (level === 'adset') return health.adsets.map((n) => ({ id: n.id, name: nameOf(n), campName: campName(n.parentId), adsetName: null, createdTime: n.createdTime ?? null, parentId: n.parentId ?? null }));
    return health.ads.map((n) => ({ id: n.id, name: nameOf(n), campName: campName(adsetCampId(n.parentId)), adsetName: n.parentId ? adsetsById.get(n.parentId)?.name ?? null : null, createdTime: n.createdTime ?? null, parentId: n.parentId ?? null }));
  }, [health, level, optimistic]); // eslint-disable-line react-hooks/exhaustive-deps

  // Agregar necesita UN padre: con dos campañas elegidas no hay de cuál colgar el
  // conjunto, así que esos botones no se dibujan (uno que no hace nada se lee como roto).
  const unaSola = selSet.size === 1 ? sorted.find((r) => selSet.has(r.node.id)) : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Sticky de la primera columna + hover. En <style> co-locado porque Tailwind
          v4 fuerza border-collapse:collapse (rompe position:sticky en celdas) y el
          CSS suelto de globals.css no siempre se emite. */}
      <style dangerouslySetInnerHTML={{ __html: `
        .adsTable{border-collapse:separate;border-spacing:0}
        .adsTable .stickyName{position:sticky;left:0;z-index:2;background:var(--surface);box-shadow:1px 0 0 var(--border)}
        .adsTable thead .stickyName{z-index:5;background:var(--surface-2)}
        .adsTable tbody tr.rowHover:hover td{background:var(--surface-2)}
        .adsTable tbody tr.rowHover:hover .stickyName{background:var(--surface-2)}
      ` }} />
      {/* cabecera: el título y, a la derecha del todo, crear + el resto de las acciones */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'inline-flex', color: 'var(--accent)' }}><Icon name="grid" size={34} /></span>
          <h1 style={{ fontWeight: 600, fontSize: 46, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Ads Manager</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" onClick={() => { setNuevaModo('nueva'); setNuevaOpen(true); }} title="Crear una campaña nueva con MaKo"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 18px', borderRadius: 12, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 14.5, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 10px rgba(47,111,237,.25)' }}>
            <MakoStar size={14} color="#fff" /> Nueva campaña
          </button>
          {/* «Ordenar nombres» se fue a la barra de la selección (renombra LO ELEGIDO) y
              «Actualizar estado» a su propio botón al lado del filtro: las dos se usan
              seguido y un menú las esconde. */}
          <MenuAcciones acciones={[
            { label: 'Subir creativos a una campaña', icono: 'creativos', onClick: () => { setNuevaModo('existente'); setNuevaOpen(true); } },
            { label: 'Agregar conjunto a una campaña', icono: 'users', onClick: () => setElegirCampana(true) },
            { label: 'Analizar con Meta', icono: 'meta', onClick: () => setRecosOpen(true) },
          ]} />
        </div>
      </header>

      {/* sub-tabs + el filtro, a la misma altura */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderBottom: '1px solid var(--border)', paddingBottom: 2 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {tabs.map((t) => {
          const on = tab === t.key;
          return (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', border: 'none', borderBottom: `2px solid ${on ? 'var(--primary)' : 'transparent'}`, background: 'transparent', cursor: 'pointer', fontSize: 15, fontWeight: on ? 600 : 500, color: on ? 'var(--ink)' : 'var(--dim)' }}>
              {t.label}
              <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', background: 'var(--surface-2)', borderRadius: 999, padding: '1px 8px' }}>{t.n}</span>
            </button>
          );
        })}
      </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 6 }}>
          <FiltrosMenu
            hoyReal={hoyReal}
            estado={estado}
            opcionesEstado={ESTADO_OPCIONES}
            onEstado={(v) => setEstado(v as EstadoFiltro)}
            columnas={configurables.filter((c) => !ALWAYS_ON.includes(c.id)).map((c) => ({ id: c.id, label: c.label }))}
            visibles={visibleCols}
            onColumna={(id) => setVisibleCols((v) => ({ ...v, [id]: !v[id as ColId] }))}
          />
          <button type="button" onClick={() => cargar()} disabled={loading} title="Actualizar estado: vuelve a preguntarle a Meta"
            aria-label="Actualizar estado"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, flex: 'none', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', cursor: loading ? 'wait' : 'pointer' }}>
            <Icon name="regenerar" size={16} />
          </button>
        </div>
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

          {/* barra de acciones masivas — sin «Limpiar»: el checkbox de la cabecera ya suelta todo */}
          {selSet.size > 0 && (
            <BarraLoteAds
              n={selSet.size}
              nivel={level}
              todosActivos={sorted.filter((r) => selSet.has(r.node.id)).every((r) => effStatusOf(r.node) === 'ACTIVE')}
              trabajando={writing.size > 0}
              onEstado={(next) => bulkStatus(next)}
              onPresupuesto={level === 'ad' ? undefined : bulkPresupuesto}
              moneda={health.account.currency}
              productos={level === 'ad' || !asig || asig.productos.length <= 1 ? null : [{ value: '', label: 'Sin asignar' }, ...asig.productos.map((p) => ({ value: valorDeProducto(p.id), label: p.nombre }))]}
              onProducto={level === 'ad' || !asig ? undefined : bulkProducto}
              onRenombrar={() => setRenameOpen(true)}
              onAgregarConjunto={level === 'campaign' && unaSola ? () => setAddConjuntoCamp({ id: unaSola.node.id, name: nombreConjuntoNuevo(unaSola.node) }) : undefined}
              onAgregarAnuncio={level === 'adset' && unaSola ? () => setAddAnuncioAdset({ id: unaSola.node.id, name: nombreAnuncioNuevo(unaSola.node), campaignId: unaSola.node.parentId ?? null, objective: health.campaigns.find((c) => c.id === unaSola.node.parentId)?.objective ?? null }) : undefined}
              onEliminar={level === 'campaign' ? bulkDelete : undefined}
            />
          )}

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'auto', maxHeight: '68vh' }}>
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
                ) : sorted.map((r) => {
                  const problemaAds: ProblemAd[] = r.level === 'ad'
                    ? (r.node.semaforo === 'rojo' ? [{ id: r.node.id, name: nameOf(r.node), issues: r.node.issues ?? [], statusLabel: r.node.statusLabel }] : [])
                    : ((r.level === 'campaign' ? rollup.adsByCamp.get(r.node.id) : rollup.adsByAdset.get(r.node.id)) ?? []);
                  return (
                  <RowView key={r.node.id} r={r} cols={cols} selected={selSet.has(r.node.id)} onSelect={() => toggleOne(r.node.id)} onOpen={() => abrir(r)}
                    effStatus={effStatusOf(r.node)} budget={budgetOf(r.node)} currency={health.account.currency} name={nameOf(r.node)} accountFrozen={accountFrozen}
                    childIssues={r.level === 'ad' ? 0 : problemaAds.length}
                    onShowProblema={problemaAds.length > 0 ? () => setProblemaSel({ titulo: nameOf(r.node), ads: problemaAds }) : undefined}
                    rowActions={rowActionsFor(r)}
                    productoCell={asig && r.level !== 'ad' ? (
                      <ProductoCelda
                        item={{ tipo: r.level === 'campaign' ? 'campana' : 'conjunto', id: r.node.id, nombre: nameOf(r.node), campanaId: r.level === 'adset' ? (r.node.parentId ?? undefined) : undefined }}
                        productos={asig.productos}
                        asignada={asignadaDe.get(r.node.id)}
                        heredadoDe={r.level === 'adset' && !asignadaDe.get(r.node.id) && r.node.parentId
                          ? (asig.productos.find((p) => p.id === asignadaDe.get(r.node.parentId!)?.funnelId)?.nombre ?? null)
                          : null}
                        onAsignadas={(a) => setAsig((v) => (v ? { ...v, asignadas: a } : v))}
                        show={showProd}
                      />
                    ) : undefined}
                    writing={writing.has(r.node.id)} editing={editingBudgetId === r.node.id} editingName={editingNameId === r.node.id}
                    onToggleStatus={(next) => writeStatus(r.level, r.node.id, next)}
                    onStartBudget={() => setEditingBudgetId(r.node.id)} onCancelBudget={() => setEditingBudgetId(null)} onSaveBudget={(monto) => pedirPresupuesto(r, monto)}
                    onStartName={() => setEditingNameId(r.node.id)} onCancelName={() => setEditingNameId(null)} onSaveName={(nm) => writeName(r.level, r.node.id, nm)} />
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 90, maxWidth: 560, background: 'var(--ink)', color: 'var(--surface)', borderRadius: 12, padding: '14px 18px', boxShadow: '0 16px 40px rgba(18,21,27,.4)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 13.5, lineHeight: 1.4 }}>{toast}</span>
          <button type="button" onClick={() => setToast(null)} style={{ flex: 'none', background: 'transparent', border: 'none', color: 'var(--surface)', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
      )}

      {adSel && <AdDetailTabs key={adSel.ad_id} senal={adSel} desde={desde} hasta={hasta} defaultTab="rendimiento" onClose={() => abrirAd(null)} />}
      {entSel && (
        <EntityDetalle id={entSel.node.id} level={entSel.level} name={entSel.node.name} statusLabel={entSel.node.statusLabel} semaforo={entSel.node.semaforo}
          desde={desde} hasta={hasta} cross={entSel.cross} recosMeta={entSel.node.recosMeta} presupuestoMxn={entSel.node.dailyBudgetMxn ?? null} onClose={() => setEntSel(null)}
          // La segunda puerta al MISMO editor que «Público» de la fila: los dos refrescan igual.
          onCambiarLugar={entSel.level === 'adset' ? () => setEditPublicoAdset({ id: entSel.node.id, name: nameOf(entSel.node) }) : undefined}
          versionGeo={versionGeo} />
      )}
      {recosOpen && <RecosModal onClose={() => setRecosOpen(false)} />}
      {/* Renombra LO ELEGIDO, no la tab entera: el único camino de entrada es la barra
          de la selección, y proponerle una nomenclatura a 80 campañas cuando se tildaron
          tres es cambiar lo que nadie pidió. */}
      {renameOpen && <RenameModal level={level} entities={renameEntities.filter((e) => selSet.has(e.id))} onClose={() => setRenameOpen(false)} onApply={bulkRename} />}
      {/* key: si cambia el modo con el modal abierto, se remonta limpio (el estado inicial depende del modo) */}
      {nuevaOpen && <NuevaCampanaModal key={nuevaModo} modo={nuevaModo} health={health} healthError={error} senales={senales} campaignCount={health?.campaigns.length ?? 0} onClose={() => setNuevaOpen(false)} onPublished={cargar} />}
      {editCopyAd && <EditarTextosModal adId={editCopyAd.id} adName={editCopyAd.name} onClose={() => setEditCopyAd(null)} onSaved={() => { setEditCopyAd(null); setToast('Textos actualizados. Meta va a revisar el anuncio de nuevo.'); cargar(true); }} />}
      {problemaSel && <ProblemaModal ads={problemaSel.ads} accountId={health?.account.accountId ?? null} onClose={() => setProblemaSel(null)} onEditAd={(id, name) => { setProblemaSel(null); setEditCopyAd({ id, name }); }} />}
      {editPublicoAdset && <EditarPublicoModal adsetId={editPublicoAdset.id} adsetName={editPublicoAdset.name} onClose={() => setEditPublicoAdset(null)} onSaved={() => { setEditPublicoAdset(null); setVersionGeo((v) => v + 1); setToast('Público actualizado. Meta va a revisar el conjunto.'); cargar(true); }} />}
      {addAnuncioAdset && <AgregarAnuncioModal adsetId={addAnuncioAdset.id} defaultName={addAnuncioAdset.name} campaignId={addAnuncioAdset.campaignId} campaignObjective={addAnuncioAdset.objective} senales={senales} onClose={() => setAddAnuncioAdset(null)} onSaved={() => { setAddAnuncioAdset(null); setToast('Anuncio agregado en pausa.'); cargar(); }} />}
      {addConjuntoCamp && <AgregarConjuntoModal campaignId={addConjuntoCamp.id} defaultAdsetName={addConjuntoCamp.name} senales={senales} monedaRespaldo={health?.account.currency ?? null} onClose={() => setAddConjuntoCamp(null)} onSaved={() => { setAddConjuntoCamp(null); setToast('Conjunto agregado en pausa.'); cargar(); }} />}
      {elegirCampana && (
        <Modal titulo="¿A qué campaña?" onCerrar={() => setElegirCampana(false)} ancho={480}>
          <Dropdown
            value=""
            placeholder="Elige una campaña"
            options={(health?.campaigns ?? []).map((c) => ({ value: c.id, label: nameOf(c) }))}
            onChange={(id) => {
              const c = (health?.campaigns ?? []).find((x) => x.id === id);
              if (!c) return;
              const campCode = nameOf(c).match(/^\d+/)?.[0] ?? '000';
              const kids = (health?.adsets ?? []).filter((a) => a.parentId === c.id);
              setElegirCampana(false);
              setAddConjuntoCamp({ id: c.id, name: `${campCode}.${pad(nextSuffix(kids, 'num'), 2)} Conjunto` });
            }}
            width="100%"
            search
          />
        </Modal>
      )}
      {/* El cartel del presupuesto (tarea #349): el único camino a writeBudget. Lo arman la
          celda (una fila) y la barra de lote (N); lo que dice está en MensajePresupuesto. */}
      {pideBudget && (
        <Confirm
          title="¿Cambiar el presupuesto?"
          message={<MensajePresupuesto p={pideBudget} />}
          confirmLabel={`Poner ${montoCuenta(pideBudget.nuevo, pideBudget.moneda)}/día`}
          cancelLabel="No cambiar"
          tone="primary"
          onConfirm={() => {
            const p = pideBudget;
            if (aplicandoBudget.current === p) return;
            aplicandoBudget.current = p;
            setPideBudget(null);
            void aplicarPresupuesto(p);
          }}
          onCancel={() => setPideBudget(null)}
        />
      )}
      {pideLote && (
        <Confirm
          title={pideLote.aTraer > 0 ? `¿Traer ${pideLote.aTraer} ${pideLote.aTraer === 1 ? 'lead' : 'leads'} a «${pideLote.nombre}»?` : `¿Mover ${pideLote.n} a «${pideLote.nombre}»?`}
          message={pideLote.aTraer > 0
            ? `Se mueven de su funnel actual al nuevo. Los que entren desde ahora van a «${pideLote.nombre}».`
            : 'Los leads que ya entraron se quedan donde están; sólo cambia a dónde van los nuevos.'}
          confirmLabel={pideLote.aTraer > 0 ? `Traer ${pideLote.aTraer}` : 'Mover'}
          cancelLabel="No asignar"
          tone="primary"
          onConfirm={() => {
            const items = sorted.filter((r) => selSet.has(r.node.id) && r.level !== 'ad').map((r) => ({
              tipo: (r.level === 'campaign' ? 'campana' : 'conjunto') as 'campana' | 'conjunto',
              id: r.node.id, nombre: nameOf(r.node),
              campanaId: r.level === 'adset' ? (r.node.parentId ?? undefined) : undefined,
            }));
            const pl = pideLote;
            setPideLote(null);
            void aplicarProductoLote(pl.funnelId, items, pl.nombre);
          }}
          onCancel={() => setPideLote(null)}
        />
      )}
      <Toast state={toastProd} onClose={clearProd} />
    </div>
  );
}

type RenameEntity = { id: string; name: string; campName: string | null; adsetName: string | null; createdTime: string | null; parentId: string | null };

/**
 * Un monto de la cuenta como lo muestra la tabla: en dólares si hay tasa (como el resto
 * de la tabla), y crudo en SU moneda si no la hay — sin inventar una conversión.
 * Antes era `fmtUSD(mxnAUsd(x))` siempre: en una cuenta que cobra en dólares mostraba
 * la 17,3ava parte del presupuesto real.
 */
function fmtPresupuesto(monto: number, currency: string): string {
  const usd = cuentaAUsd(monto, currency);
  if (usd != null) return fmtUSD(usd, 0);
  try { return new Intl.NumberFormat('es-MX', { style: 'currency', currency, maximumFractionDigits: 0 }).format(monto); }
  catch { return montoCuenta(Math.round(monto), currency); }
}

/**
 * Lo que dice el cartel del presupuesto. Corto (AGENTS.md: la consecuencia, pegada al
 * botón): QUÉ cambia, de cuánto a cuánto, y en qué moneda. Los montos van en la moneda
 * de la CUENTA —que es lo que se escribe— y al lado su equivalente en dólares, que es la
 * unidad en la que se tipeó. Sin tasa, se dice que va sin convertir.
 *
 * El salto ×5 en las DOS direcciones (saltoPresupuesto): un cero de más gasta plata y
 * uno de menos frena la campaña. Sin el glifo de advertencia: lo caza el guard de emoji
 * de tests/ads-barra.test.ts, y el color alcanza.
 */
function MensajePresupuesto({ p }: { p: PideBudget }) {
  const { filas, nuevo, afuera, moneda } = p;
  const conv = esConvertible(moneda);
  const enUsd = (m: number) => `US$${Math.round(cuentaAUsd(m, moneda) ?? 0).toLocaleString('es-MX')}`;
  const dolares = conv && moneda !== 'USD';
  const viejos = filas.map((f) => f.viejo).filter((v): v is number => v != null);
  const min = viejos.length ? Math.min(...viejos) : null;
  const max = viejos.length ? Math.max(...viejos) : null;
  const una = filas.length === 1 ? filas[0] : null;
  const s = saltoPresupuesto(nuevo, min);
  const salto = s?.sube ? s : (() => { const b = saltoPresupuesto(nuevo, max); return b && !b.sube ? b : null; })();
  const fuerte: CSSProperties = { color: 'var(--ink)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' };
  const nivel = (filas[0]?.lvl ?? 'campaign') === 'campaign' ? ['Campaña', 'campañas'] : ['Conjunto', 'conjuntos'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {una ? (
        <>
          <span>{nivel[0]} «{una.nombre}»</span>
          <span style={fuerte}>
            {una.viejo != null ? cifra(una.viejo) : '—'} → {montoCuenta(nuevo, moneda)}/día
          </span>
          {dolares && <span>≈ {una.viejo != null ? enUsd(una.viejo) : '—'} → {enUsd(nuevo)}</span>}
        </>
      ) : (
        <>
          <span style={fuerte}>{filas.length} {nivel[1]} → {montoCuenta(nuevo, moneda)}/día{dolares ? ` (≈ ${enUsd(nuevo)})` : ''}</span>
          {min != null && max != null && (
            <span>Hoy: {min === max ? `${montoCuenta(min, moneda)}/día` : `entre ${cifra(min)} y ${montoCuenta(max, moneda)}/día`}</span>
          )}
        </>
      )}
      {salto && (
        <span style={{ color: 'var(--warn)', fontWeight: 600 }}>
          {una ? 'Es' : 'Hasta'} {salto.veces} veces {salto.sube ? 'el actual' : 'menos que el actual'}.
        </span>
      )}
      {!conv && <span>Va en {moneda}, sin convertir.</span>}
      {afuera > 0 && <span>{afuera} {afuera === 1 ? 'queda afuera: no tiene' : 'quedan afuera: no tienen'} presupuesto diario en este nivel.</span>}
    </div>
  );
}

const bulkBtn: CSSProperties = { padding: '7px 14px', borderRadius: 9, border: '1px solid rgba(243,245,248,.25)', background: 'rgba(243,245,248,.10)', color: 'var(--surface)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' };

// ── header ordenable ──
function SortLabel({ label, active, dir, onClick, align }: { label: string; active: boolean; dir: 'asc' | 'desc'; onClick: () => void; align: 'left' | 'right' }) {
  return (
    <button type="button" onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexDirection: align === 'right' ? 'row-reverse' : 'row', background: 'transparent', border: 'none', cursor: 'pointer', font: 'inherit', color: active ? 'var(--ink)' : 'inherit', letterSpacing: 'inherit', textTransform: 'inherit', padding: 0 }}>
      {label}
      <span style={{ fontSize: 9, color: active ? 'var(--primary)' : 'var(--faint)' }}>{active ? (dir === 'asc' ? '▲' : '▼') : '⇅'}</span>
    </button>
  );
}

// ── fila ──
function RowView({ r, cols, selected, onSelect, onOpen, effStatus, budget, currency, name, accountFrozen, childIssues, onShowProblema, rowActions, productoCell, writing, editing, editingName, onToggleStatus, onStartBudget, onCancelBudget, onSaveBudget, onStartName, onCancelName, onSaveName }: {
  r: Row; cols: ColDef[]; selected: boolean; onSelect: () => void; onOpen: () => void;
  /** En la MONEDA DE LA CUENTA (`currency`), que es lo que Meta guarda. */
  effStatus: string; budget: number | null; currency: string; name: string; accountFrozen: boolean; childIssues: number; onShowProblema?: () => void; rowActions?: Array<{ icono: string; label: string; title: string; onClick: () => void }>; productoCell?: ReactNode; writing: boolean; editing: boolean; editingName: boolean;
  onToggleStatus: (next: 'ACTIVE' | 'PAUSED') => void; onStartBudget: () => void; onCancelBudget: () => void; onSaveBudget: (monto: number) => void;
  onStartName: () => void; onCancelName: () => void; onSaveName: (name: string) => void;
}) {
  const active = effStatus === 'ACTIVE';
  // Padre (campaña/conjunto) con anuncios problemáticos → hereda "Con problemas" URGENTE.
  const entrega = accountFrozen && active ? { label: 'Error en el pago', semaforo: 'rojo' as Semaforo }
    : childIssues > 0 ? { label: `Con problemas · ${childIssues}`, semaforo: 'rojo' as Semaforo }
    : { label: metaStatusLabel(effStatus), semaforo: metaStatusSemaforo(effStatus) };
  const costo = r.perf.agendas > 0 ? r.perf.spend_usd / r.perf.agendas : null;
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const cell = (c: ColDef) => {
    switch (c.id) {
      case 'entrega': return <Pill semaforo={entrega.semaforo} label={entrega.label} onClick={onShowProblema} />;
      case 'resultados': return r.perf.agendas > 0 ? fmtNum(r.perf.agendas) : '—';
      case 'costoRes': return fmtUSD(costo);
      case 'gastado': return r.level === 'ad' && !r.senal ? '—' : fmtUSD(r.perf.spend_usd, 0);
      case 'impresiones': return r.level === 'ad' && !r.senal ? '—' : fmtNum(r.perf.impressions);
      case 'cierres': return r.perf.cierres > 0 ? fmtNum(r.perf.cierres) : '—';
      case 'cash': return r.perf.cash_usd > 0 ? fmtUSD(r.perf.cash_usd, 0) : '—';
      case 'aprendizaje': return r.node.learning ? <Pill semaforo={r.node.learning.semaforo} label={r.node.learning.label} /> : '—';
      case 'presupuesto': return <BudgetCell r={r} budget={budget} currency={currency} editing={editing} writing={writing} onStart={onStartBudget} onCancel={onCancelBudget} onSave={onSaveBudget} />;
      case 'producto': return productoCell ?? <span style={{ color: 'var(--faint)' }}>—</span>;
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
              <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--primary)' }}>{name}</span>
              <button type="button" title="Renombrar" disabled={writing} onClick={(e) => { stop(e); onStartName(); }}
                style={{ flex: 'none', display: 'inline-flex', background: 'transparent', border: 'none', cursor: writing ? 'default' : 'pointer', color: 'var(--faint)', padding: '2px 4px', lineHeight: 1 }}><Icon name="pen" size={13} /></button>
              {(rowActions ?? []).map((a) => (
                <button key={a.label} type="button" title={a.title} onClick={(e) => { stop(e); a.onClick(); }}
                  style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, background: 'transparent', border: '1px solid var(--border-strong)', borderRadius: 7, cursor: 'pointer', color: 'var(--dim)', fontFamily: SANS, fontSize: 11.5, fontWeight: 600, padding: '3px 7px', lineHeight: 1.3, whiteSpace: 'nowrap' }}>
                  <Icon name={a.icono} size={12} />{a.label}
                </button>
              ))}
            </>
          )}
        </span>
      </td>
      {cols.map((c) => (
        <td key={c.id} style={{ ...td, textAlign: c.id === 'entrega' || c.id === 'aprendizaje' || c.id === 'presupuesto' || c.id === 'producto' ? 'left' : 'right' }}>{cell(c)}</td>
      ))}
    </tr>
  );
}

function BudgetCell({ r, budget, currency, editing, writing, onStart, onCancel, onSave }: { r: Row; budget: number | null; currency: string; editing: boolean; writing: boolean; onStart: () => void; onCancel: () => void; onSave: (monto: number) => void }) {
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  // Ads no tienen presupuesto.
  if (r.level === 'ad') return <span style={{ color: 'var(--faint)' }}>—</span>;
  // CBO: en la fila de conjunto el budget vive en la campaña.
  if (r.node.budgetLevel !== r.level) {
    if (r.level === 'adset') return <span style={{ color: 'var(--faint)', fontSize: 12.5 }}>Presupuesto de campaña</span>;
    return <span style={{ color: 'var(--faint)' }}>—</span>; // campaña ABO (budget en conjuntos)
  }
  // Presupuesto TOTAL: se muestra y no se edita acá. Antes llevaba el lápiz, decía «—» y
  // el editor escribía un `daily_budget` sobre una entidad que no lo tiene. Sin lápiz a
  // propósito (tests/ads-barra.test.ts cuenta DOS por fila: nombre y presupuesto diario).
  if (!editaPresupuestoAca(r.node, r.level)) {
    const total = r.node.lifetimeBudgetMxn;
    return <span title="Presupuesto total: se cambia en Meta" style={{ color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>{total != null ? `${fmtPresupuesto(total, currency)} total` : '—'}</span>;
  }
  if (editing) return <span onClick={stop}><BudgetEditor budget={budget} currency={currency} onSave={onSave} onCancel={onCancel} /></span>;
  return (
    <button type="button" onClick={(e) => { stop(e); onStart(); }} disabled={writing} title="Editar presupuesto"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid transparent', borderRadius: 8, padding: '4px 8px', cursor: writing ? 'default' : 'pointer', color: 'var(--ink)', font: 'inherit', fontVariantNumeric: 'tabular-nums' }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; }}>
      {budget != null ? `${fmtPresupuesto(budget, currency)}/día` : '—'}<span style={{ display: 'inline-flex', color: 'var(--faint)' }}><Icon name="pen" size={12} /></span>
    </button>
  );
}

/**
 * El editor de la celda. NO escribe: devuelve el monto (en la moneda de la cuenta) y el
 * padre arma el cartel.
 *
 * Se TIPEA en dólares, como en el wizard y en «Agregar conjunto», y se convierte a la
 * moneda de la cuenta con `usdACuenta`; sin tasa para esa moneda, se tipea en ella. Antes
 * multiplicaba SIEMPRE por 17,30: en una cuenta en dólares, tipear 50 escribía 865 USD/día.
 */
function BudgetEditor({ budget, currency, onSave, onCancel }: { budget: number | null; currency: string; onSave: (monto: number) => void; onCancel: () => void }) {
  const inicial = inicialTipeado(budget, currency);
  const [v, setV] = useState(inicial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  const unidad = esConvertible(currency) ? 'USD' : currency;
  // Sin cambio no hay cartel. Se compara lo TIPEADO contra lo que el editor mostró al
  // abrirse, no los montos de la cuenta: con el redondeo, 500 MXN se muestra 29 y vuelve
  // como 502, y guardar sin tocar reescribía 500 → 502 sin que nadie lo pidiera.
  const save = () => {
    if (v === inicial) { onCancel(); return; }
    const monto = tipeadoACuenta(v, currency);
    if (monto != null) onSave(monto);
  };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {unidad === 'USD' && <span style={{ color: 'var(--faint)', fontSize: 13 }}>$</span>}
      <input ref={ref} value={v} onChange={(e) => setV(e.target.value.replace(/[^\d]/g, ''))}
        // ⚠️ preventDefault en el Enter: el cartel se monta en este mismo keydown y
        // enfoca su botón de confirmar, y el `keypress` que sigue —el que activa un botón
        // con Enter— le llega a ÉL. Medido el 07/10/2026 en el navegador, sacando esta
        // línea: un Enter = 1 POST, y el cartel no llegó a verse.
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (!e.repeat) save(); } if (e.key === 'Escape') onCancel(); }}
        inputMode="numeric" style={{ width: 78, padding: '5px 8px', borderRadius: 8, border: '1px solid var(--primary)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13, outline: 'none', textAlign: 'right' }} />
      <span style={{ color: 'var(--faint)', fontSize: 12 }}>{unidad}/día</span>
      <button type="button" onClick={save} title="Guardar" style={{ border: 'none', background: 'var(--good)', color: '#fff', borderRadius: 7, width: 26, height: 26, cursor: 'pointer', fontSize: 13 }}>✓</button>
      <button type="button" onClick={onCancel} title="No cambiar" style={{ border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', borderRadius: 7, width: 26, height: 26, cursor: 'pointer', fontSize: 13 }}>✕</button>
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
        style={{ flex: 1, minWidth: 0, padding: '5px 8px', borderRadius: 7, border: '1px solid var(--primary)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5, outline: 'none' }} />
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

function Pill({ semaforo, label, onClick }: { semaforo: Semaforo; label: string; onClick?: () => void }) {
  const base: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, flex: 'none', fontFamily: MONO, fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 999, color: colorDeSemaforo(semaforo), background: bgDeSemaforo(semaforo), whiteSpace: 'nowrap' };
  const dot = <span style={{ width: 6, height: 6, borderRadius: '50%', background: colorDeSemaforo(semaforo) }} />;
  if (onClick) {
    return (
      <button type="button" title="Ver por qué y cómo resolverlo" onClick={(e) => { e.stopPropagation(); onClick(); }}
        style={{ ...base, border: `1px solid ${colorDeSemaforo(semaforo)}`, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}>
        {dot}{label}<span style={{ display: 'inline-flex', textDecoration: 'none' }}><Icon name="eye" size={12} /></span>
      </button>
    );
  }
  return <span style={base}>{dot}{label}</span>;
}

// ── modal: por qué "Con problemas" (en español) + arreglar desde ahí ──
function ProblemaModal({ ads, accountId, onClose, onEditAd }: { ads: ProblemAd[]; accountId: string | null; onClose: () => void; onEditAd: (id: string, name: string) => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 84, background: 'rgba(18,21,27,.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 18px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 540, maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 30px 80px rgba(18,21,27,.4)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <span style={{ fontFamily: SANS, fontSize: 15, fontWeight: 600, color: 'var(--ink)', margin: '0 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Por qué no está entregando</span>
          <button aria-label="Cerrar" onClick={onClose} style={{ width: 30, height: 30, flex: 'none', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 14, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ads.length === 0 ? <p style={{ color: 'var(--dim)', fontSize: 13.5, textAlign: 'center' }}>Sin detalle disponible.</p> : ads.map((ad) => {
            const issues = ad.issues.length ? ad.issues : [{ resumen: ad.statusLabel, mensaje: '' }];
            const exps = issues.map(explicarIssueEs);
            // Retenido por la aprobación de pares de Meta: no es un problema de
            // textos, es un permiso. El botón útil es el que lleva a aprobarlo.
            const pendienteAprobar = issues.some(esAprobacionPendiente);
            return (
              <div key={ad.id} style={{ border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px', background: 'var(--surface-2)' }}>
                <div style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--dim)', marginBottom: 8 }}>{ad.name}</div>
                {exps.map((e, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{e.titulo}</div>
                    <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.5, marginTop: 2 }}>{e.detalle}</div>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                  {pendienteAprobar && (
                    <a href={linkAprobarEnMeta(accountId, ad.id)} target="_blank" rel="noopener noreferrer"
                      style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>
                      Aprobar en Meta ↗
                    </a>
                  )}
                  <button type="button" onClick={() => onEditAd(ad.id, ad.name)} style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}><span style={{ display: 'inline-flex', marginRight: 6, verticalAlign: '-2px' }}><Icon name="escribir" size={13} /></span>Editar textos</button>
                </div>
                {pendienteAprobar && <div style={{ marginTop: 10 }}><TutorialAprobacionMeta /></div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── popover de columnas ──
// ── modal "Analizar (Meta)" — espejo honesto del edge de recomendaciones ──
type RecoUI = { titulo: string; detalle: string; lift?: string | null; importancia: string; entidades?: number; url?: string | null };
type RecosResp = { ok: boolean; opportunityScore?: number | null; recomendaciones?: RecoUI[]; empty?: boolean; reason?: string; message?: string };
function RecosModal({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<RecosResp | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    fetch('/api/meta-recommendations').then((r) => r.json()).then((j) => { if (alive) setData(j); }).catch((e) => { if (alive) setData({ ok: false, message: String(e) }); }).finally(() => { if (alive) setLoading(false); });
  }, []);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(18,21,27,.52)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '60px 20px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 640, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>Recomendaciones de Meta · API</div>
            <h2 style={{ fontWeight: 600, fontSize: 20, margin: '3px 0 0', color: 'var(--ink)' }}>Analizar (Meta)</h2>
          </div>
          <button aria-label="Cerrar" onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 16, cursor: 'pointer' }}>✕</button>
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
              {(data.recomendaciones ?? []).length === 0 && (
                <p style={{ fontSize: 13.5, color: 'var(--dim)', margin: 0, lineHeight: 1.5 }}>Meta puntuó tu cuenta pero no listó recomendaciones concretas ahora mismo.</p>
              )}
              {(data.recomendaciones ?? []).map((r, i) => (
                <div key={i} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{r.titulo}</span>
                    {r.lift && <span style={{ fontFamily: MONO, fontSize: 11, padding: '3px 8px', borderRadius: 999, background: 'var(--good-bg)', color: 'var(--good)' }}>{r.lift}</span>}
                  </div>
                  <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.5 }}>{r.detalle}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                    {r.entidades ? <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>{r.entidades} {r.entidades === 1 ? 'entidad' : 'entidades'}</span> : null}
                    {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: 'var(--primary-strong)', textDecoration: 'none' }}>Aplicarla en Meta ↗</a>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── modal "MaKo · Ordenar nombres" — propone una nomenclatura y la aplica ──
const NIVEL_NOUN: Record<Level, string> = { campaign: 'campañas', adset: 'conjuntos', ad: 'anuncios' };
const MESES_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const anioDe = (iso: string | null) => { if (!iso) return ''; const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : String(d.getFullYear()); };
const mesDe = (iso: string | null) => { if (!iso) return ''; const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : MESES_ES[d.getMonth()]; };
const diaDe = (iso: string | null) => { if (!iso) return ''; const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }; // "YYYY-MM-DD" para el filtro de rango
const MES_ABBR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const diaLegible = (iso: string) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${Number(d)} ${MES_ABBR[Number(m) - 1] ?? ''} ${y}`; };
const addMeses = (iso: string, n: number) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + n, d)).toISOString().slice(0, 10); };
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
// Índice → letra (1→a, 26→z, 27→aa…). Para {a} (correlativo del anuncio dentro del conjunto).
function letra(n: number): string { let s = ''; while (n > 0) { n--; s = String.fromCharCode(97 + (n % 26)) + s; n = Math.floor(n / 26); } return s; }
// Código del padre = el prefijo numérico de SU nombre actual (ya renombrado).
// Ej: "001. Leads…" → "001"; "001.02 Ad Set…" → "001.02". Vacío si el padre no
// fue renombrado todavía (hay que renombrar de arriba hacia abajo).
function codigoPadre(parentName: string | null): string {
  if (!parentName) return '';
  const m = parentName.match(/^\s*([0-9]+(?:\.[0-9]+)*(?:\.[a-zA-Z]+)?)/);
  return m ? m[1] : '';
}
// Variables de plantilla según el nivel. {nnn}/{nombre}/{mes}/{anio}/{padre}/{sub}/{a}
// los pone el CÓDIGO; objetivo/ángulo/audiencia los completa MaKo.
function renameVars(level: Level): Array<{ tok: string; label: string }> {
  const base: Array<{ tok: string; label: string }> = [
    { tok: '{nnn}', label: 'N° global (001)' },
    { tok: '{objetivo}', label: 'Objetivo' },
    { tok: '{angulo}', label: 'Ángulo' },
    { tok: '{audiencia}', label: 'Audiencia' },
    { tok: '{mes}', label: 'Mes' },
    { tok: '{anio}', label: 'Año' },
    { tok: '{nombre}', label: 'Nombre original' },
  ];
  if (level === 'campaign') return base;
  const padreLabel = level === 'adset' ? 'Código de la campaña (001)' : 'Código del conjunto (001.02)';
  return [
    { tok: '{padre}', label: padreLabel },
    { tok: '{sub}', label: 'N° dentro del padre (02)' },
    { tok: '{a}', label: 'Letra dentro del padre (b)' },
    ...base,
  ];
}
// Plantilla por defecto según el nivel: campaña = N° global; conjunto/anuncio =
// anclados al código del padre (lo que pidió Martín: 001.02 / 001.02.a).
const TEMPLATE_DEFAULT_BY_LEVEL: Record<Level, string> = {
  campaign: '{nnn}. {objetivo} / {angulo} - {mes} / {anio}',
  adset: '{padre}.{sub} {objetivo} / {angulo}',
  ad: '{padre}.{a} {objetivo} / {angulo}',
};
// Renderiza la plantilla: correlativo global {n+}, índice por-padre {sub}/{a}, las
// demás variables por substitución; limpia slots sin resolver + separadores sueltos.
function applyTemplate(tpl: string, vars: Record<string, string>, counters: { n: number; sub: number }): string {
  let out = tpl
    .replace(/\{n+\}/g, (m) => String(counters.n).padStart(Math.max(1, m.length - 2), '0'))
    .replace(/\{sub\}/g, counters.sub ? String(counters.sub).padStart(2, '0') : '')
    .replace(/\{a\}/g, counters.sub ? letra(counters.sub) : '');
  for (const [k, v] of Object.entries(vars)) if (v) out = out.split(`{${k}}`).join(v);
  return out.replace(/\{[a-zA-Z_]+\}/g, '').replace(/\s{2,}/g, ' ').replace(/^[\s/|·.\-]+|[\s/|·.\-]+$/g, '').trim();
}

// Panel flotante reutilizable: el menú vive en un PORTAL (position:fixed) anclado
// al botón → FLOTA sobre el contenido (no empuja el layout) y no lo recorta el
// overflow:hidden del modal. Cierra por click afuera, Escape, scroll o resize.
function FloatingPanel({ trigger, triggerStyle, ariaLabel, panelWidth = 320, align = 'left', children }: {
  trigger: ReactNode; triggerStyle: CSSProperties; ariaLabel?: string; panelWidth?: number; align?: 'left' | 'right'; children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left?: number; right?: number } | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const place = () => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const up = below < 380 && r.top > below;
    setPos({ ...(up ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }), ...(align === 'right' ? { right: window.innerWidth - r.right } : { left: r.left }) });
  };
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { const t = e.target as Node; if (ref.current?.contains(t) || panelRef.current?.contains(t)) return; setOpen(false); };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onSR = () => setOpen(false);
    document.addEventListener('mousedown', onDoc); document.addEventListener('keydown', onEsc);
    window.addEventListener('scroll', onSR, true); window.addEventListener('resize', onSR);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc); window.removeEventListener('scroll', onSR, true); window.removeEventListener('resize', onSR); };
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" aria-label={ariaLabel} aria-expanded={open} onClick={() => { if (!open) place(); setOpen((v) => !v); }} style={triggerStyle}>{trigger}</button>
      {open && pos && createPortal(
        <div ref={panelRef} style={{ position: 'fixed', top: pos.top, bottom: pos.bottom, left: pos.left, right: pos.right, zIndex: 1000, width: panelWidth, maxWidth: '92vw', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: '0 18px 44px rgba(18,21,27,.28)', padding: 12 }}>
          {children(() => setOpen(false))}
        </div>,
        document.body,
      )}
    </div>
  );
}

// Filtro de rango por fecha de creación (look de FechaFiltro), CONTROLADO y en
// un FloatingPanel (flota, no mueve el layout). Fechas "YYYY-MM-DD".
function RangoFechaCreacion({ desde, hasta, onChange }: { desde: string; hasta: string; onChange: (d: string, h: string) => void }) {
  const [cd, setCd] = useState(desde);
  const [ch, setCh] = useState(hasta);
  useEffect(() => { setCd(desde); setCh(hasta); }, [desde, hasta]); // refleja el rango aplicado

  const hoy = useMemo(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }, []);
  const year = Number(hoy.slice(0, 4));
  const presets: Array<{ key: string; label: string; d: string; h: string }> = [
    { key: 'all', label: 'Todas', d: '', h: '' },
    { key: 'y', label: `${year}`, d: `${year}-01-01`, h: hoy },
    { key: 'ya', label: `${year - 1}`, d: `${year - 1}-01-01`, h: `${year - 1}-12-31` },
    { key: 'from-ya', label: `${year - 1} en adelante`, d: `${year - 1}-01-01`, h: hoy },
    { key: 'm3', label: 'Últ. 3 meses', d: addMeses(hoy, -3), h: hoy },
    { key: 'm6', label: 'Últ. 6 meses', d: addMeses(hoy, -6), h: hoy },
  ];
  const activo = !!(desde || hasta);
  const presetActivo = presets.find((p) => p.key !== 'all' && p.d === desde && p.h === hasta);
  const etiqueta = !activo ? 'Todas las fechas' : presetActivo ? presetActivo.label : `${desde ? diaLegible(desde) : 'inicio'} → ${hasta ? diaLegible(hasta) : 'hoy'}`;
  const customValido = (!!cd || !!ch) && (!cd || !ch || cd <= ch);
  const di: CSSProperties = { flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13, outline: 'none' };
  const triggerStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 9, maxWidth: '100%', padding: '10px 14px', borderRadius: 11, border: '1px solid ' + (activo ? 'var(--primary)' : 'var(--border-strong)'), background: activo ? 'rgba(47,111,237,.10)' : 'var(--surface)', color: activo ? 'var(--primary)' : 'var(--dim)', fontFamily: SANS, fontSize: 14, fontWeight: 500, cursor: 'pointer' };

  return (
    <FloatingPanel ariaLabel="Rango de fecha de creación" panelWidth={300} triggerStyle={triggerStyle}
      trigger={<><span style={{ whiteSpace: 'nowrap' }}>{etiqueta}</span><span aria-hidden style={{ fontSize: 10, opacity: 0.5 }}>▾</span></>}>
      {(close) => (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            {presets.map((p) => {
              const sel = p.key === 'all' ? !activo : (p.d === desde && p.h === hasta);
              return (
                <button key={p.key} type="button" onClick={() => { onChange(p.d, p.h); close(); }}
                  style={{ padding: '8px 10px', borderRadius: 9, textAlign: 'center', cursor: 'pointer', fontFamily: SANS, fontSize: 12.5, whiteSpace: 'nowrap', border: '1px solid ' + (sel ? 'var(--primary)' : 'var(--border)'), background: sel ? 'rgba(47,111,237,.10)' : 'var(--surface)', color: sel ? 'var(--primary)' : 'var(--ink)' }}>{p.label}</button>
              );
            })}
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 8 }}>Rango exacto</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="date" value={cd} max={ch || hoy} onChange={(e) => setCd(e.target.value)} style={di} />
              <span style={{ color: 'var(--faint)' }}>→</span>
              <input type="date" value={ch} min={cd || undefined} max={hoy} onChange={(e) => setCh(e.target.value)} style={di} />
            </div>
            <button type="button" disabled={!customValido} onClick={() => { onChange(cd, ch); close(); }}
              style={{ marginTop: 8, width: '100%', padding: '9px', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: customValido ? 'pointer' : 'not-allowed', opacity: customValido ? 1 : 0.4 }}>Aplicar rango</button>
          </div>
        </>
      )}
    </FloatingPanel>
  );
}

// Inserta una variable de plantilla en el cursor — menú flotante (declutter del
// chip row). El correlativo {nnn} y {nombre} los pone el código; el resto MaKo.
function InsertarVariable({ onInsert, vars }: { onInsert: (tok: string) => void; vars: Array<{ tok: string; label: string }> }) {
  const triggerStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '0 14px', height: '100%', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' };
  return (
    <FloatingPanel ariaLabel="Insertar variable" panelWidth={250} align="right" triggerStyle={triggerStyle}
      trigger={<><span style={{ fontFamily: MONO, color: 'var(--accent)' }}>{'{ }'}</span>Insertar<span aria-hidden style={{ fontSize: 10, opacity: 0.5 }}>▾</span></>}>
      {(close) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {vars.map((v) => (
            <button key={v.tok} type="button" onClick={() => { onInsert(v.tok); close(); }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer' }}>
              <code style={{ fontFamily: MONO, fontSize: 12, color: 'var(--accent)', minWidth: 58 }}>{v.tok}</code>
              <span style={{ fontFamily: SANS, fontSize: 13.5, color: 'var(--ink)' }}>{v.label}</span>
            </button>
          ))}
        </div>
      )}
    </FloatingPanel>
  );
}

function RenameModal({ level, entities, onClose, onApply }: { level: Level; entities: RenameEntity[]; onClose: () => void; onApply: (items: Array<{ id: string; level: Level; name: string }>) => Promise<number> }) {
  const [template, setTemplate] = useState(TEMPLATE_DEFAULT_BY_LEVEL[level]);
  const [desde, setDesde] = useState(''); // "YYYY-MM-DD" (filtro por fecha de creación, opcional)
  const [hasta, setHasta] = useState('');
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
  const padreDe = (e: RenameEntity) => codigoPadre(level === 'adset' ? e.campName : level === 'ad' ? e.adsetName : null);
  // Filtradas por rango y ORDENADAS del MÁS VIEJO al más nuevo (createdTime asc) →
  // 001 = la primera publicada. En conjuntos/anuncios además se AGRUPAN por código
  // del padre, así la lista se lee 001.01, 001.02, 002.01… y el {sub} por-padre cuadra.
  const enAlcance = useMemo(() => entities.filter((e) => {
    const k = diaDe(e.createdTime);
    if (!k) return !desde && !hasta; // sin fecha → solo si no hay filtro
    return (!desde || k >= desde) && (!hasta || k <= hasta);
  }).sort((a, b) => {
    if (level !== 'campaign') { const pa = padreDe(a), pb = padreDe(b); if (pa !== pb) return pa < pb ? -1 : 1; }
    return (a.createdTime || '9999') < (b.createdTime || '9999') ? -1 : 1;
  }), [entities, desde, hasta, level]);
  // Índice POR PADRE (resetea por campaña en conjuntos, por conjunto en anuncios) →
  // alimenta {sub} (02) y {a} (b). En campañas no aplica (no tienen padre).
  const subByEntity = useMemo(() => {
    const cnt = new Map<string, number>(), out = new Map<string, number>();
    for (const e of enAlcance) { if (!e.parentId) continue; const n = (cnt.get(e.parentId) ?? 0) + 1; cnt.set(e.parentId, n); out.set(e.id, n); }
    return out;
  }, [enAlcance]);
  // Variables que pide la IA: solo las SEMÁNTICAS. El resto ({nnn}/{nombre}/{mes}/
  // {anio}/{padre}/{sub}/{a}) los pone el CÓDIGO (determinístico).
  const varsNeeded = useMemo(() => [...new Set([...template.matchAll(/\{([a-zA-Z_]+)\}/g)].map((m) => m[1]))].filter((v) => !/^n+$/.test(v) && !['nombre', 'mes', 'anio', 'padre', 'sub', 'a'].includes(v)), [template]);

  const insertar = (tok: string) => {
    const el = tplRef.current;
    if (!el) { setTemplate((t) => t + tok); return; }
    const s = el.selectionStart ?? template.length, e = el.selectionEnd ?? template.length;
    setTemplate(template.slice(0, s) + tok + template.slice(e));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + tok.length, s + tok.length); });
  };

  const proponer = async () => {
    if (!template.trim()) { setErr('Escribe una plantilla.'); return; }
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
      // Render determinístico: correlativo global, índice por-padre y código del
      // padre por código; objetivo/ángulo de la IA.
      const map: Record<string, string> = {};
      const inc = new Set<string>();
      enAlcance.forEach((e, i) => {
        const { mes, anio } = fechaDeNombre(e.name, e.createdTime);
        const v = { ...valores[e.id], nombre: e.name, mes, anio, padre: padreDe(e) };
        const nuevo = applyTemplate(template, v, { n: i + 1, sub: subByEntity.get(e.id) ?? 0 });
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
  const lbl: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--dim)' };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 75, background: 'rgba(18,21,27,.52)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 20px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 760, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>MaKo · Ordenar nombres</div>
            <h2 style={{ fontWeight: 600, fontSize: 20, margin: '3px 0 0', color: 'var(--ink)' }}>Renombrar {NIVEL_NOUN[level]}</h2>
          </div>
          <button aria-label="Cerrar" onClick={onClose} style={{ width: 34, height: 34, flex: 'none', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 16, cursor: 'pointer' }}>✕</button>
        </div>

        {phase !== 'review' ? (
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <p style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.55, margin: 0 }}>Armas una <b>plantilla</b> con variables. MaKo completa cada variable mirando el nombre y la jerarquía; el sistema arma el nombre con ese formato exacto. Revisas antes de escribir en Meta.</p>

            {/* Plantilla + insertar variable + vista previa en vivo */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={lbl}>Plantilla del nombre</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                <input ref={tplRef} value={template} onChange={(e) => setTemplate(e.target.value)} placeholder="{nnn}. {objetivo} / {angulo} - {mes} / {anio}" style={{ ...inp, flex: 1, minWidth: 0, fontFamily: MONO, fontSize: 13.5 }} />
                <InsertarVariable onInsert={insertar} vars={renameVars(level)} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', borderRadius: 10, background: 'rgba(200,135,12,.07)', border: '1px solid var(--border)' }}>
                <span style={{ ...lbl, color: 'var(--faint)' }}>Previa</span>
                <code style={{ fontFamily: MONO, fontSize: 13, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{applyTemplate(template, { objetivo: 'Leads', angulo: 'Dolor', audiencia: 'Dueños', mes: 'Julio', anio: '2025', nombre: 'Ej', padre: level === 'ad' ? '001.01' : '001' }, { n: 1, sub: 1 }) || '— (plantilla vacía)'}</code>
              </div>
            </div>

            {/* Fecha de creación */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={lbl}>Renombrar solo las creadas en…</span>
              <div><RangoFechaCreacion desde={desde} hasta={hasta} onChange={(d, h) => { setDesde(d); setHasta(h); }} /></div>
            </div>

            {/* Notas de estilo */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={lbl}>Notas de estilo para MaKo (opcional)</span>
              <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} placeholder="Cómo nombrar (estilo), NO para filtrar. Ej: objetivo en 1 palabra; ángulo corto; las de retargeting que el ángulo diga RTG." style={{ ...inp, resize: 'vertical' }} />
            </div>

            {/* Resumen del alcance */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--dim)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 13px' }}>
              <span style={{ display: 'inline-flex', flex: 'none', color: 'var(--faint)' }}><Icon name="notepencil" size={15} /></span>
              <span>Se renombrarán <b style={{ color: 'var(--ink)' }}>{enAlcance.length}</b> de {entities.length} {NIVEL_NOUN[level]}{(desde || hasta) ? `, creadas${desde ? ` desde ${diaLegible(desde)}` : ''}${hasta ? ` hasta ${diaLegible(hasta)}` : ''}. El resto no se toca.` : '.'} Se numeran de la más vieja a la más nueva.</span>
            </div>

            {err && <div style={{ fontSize: 13, color: 'var(--bad)' }}>Error: {err}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button aria-label="Cerrar" onClick={onClose} style={{ padding: '10px 16px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={proponer} disabled={phase === 'loading' || enAlcance.length === 0} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 11, border: 'none', background: phase === 'loading' || enAlcance.length === 0 ? 'var(--border-strong)' : 'var(--ink)', color: 'var(--surface)', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: phase === 'loading' || enAlcance.length === 0 ? 'default' : 'pointer' }}>{phase === 'loading' ? 'MaKo completando…' : <><MakoStar size={13} color="var(--surface)" /> Generar con MaKo</>}</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ padding: '16px 24px', maxHeight: '56vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ fontSize: 13, color: 'var(--dim)' }}>{cambios.length} de {enAlcance.length} cambian. Destilda los que no quieras o edita el nombre generado.</span>
                {uso && <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)', whiteSpace: 'nowrap' }}>✦ {uso.tokens >= 1000 ? `${(uso.tokens / 1000).toFixed(1)}k` : uso.tokens} tok · ${uso.costUsd >= 1 ? uso.costUsd.toFixed(2) : uso.costUsd.toFixed(3)}</span>}
              </div>
              {enAlcance.map((e) => {
                const nuevo = prop[e.id] ?? e.name;
                const cambia = incl.has(e.id) && nuevo.trim() !== e.name;
                return (
                  <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '22px 1fr 1fr', gap: 10, alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                    <input type="checkbox" checked={incl.has(e.id)} onChange={() => setIncl((s) => { const n = new Set(s); if (n.has(e.id)) n.delete(e.id); else n.add(e.id); return n; })} style={{ cursor: 'pointer' }} />
                    <span style={{ fontSize: 12.5, color: 'var(--faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: cambia ? 'line-through' : 'none' }} title={e.name}>{e.name}</span>
                    <input value={nuevo} maxLength={400} onChange={(ev) => setProp((p) => ({ ...p, [e.id]: ev.target.value }))} style={{ width: '100%', padding: '6px 9px', borderRadius: 8, border: `1px solid ${cambia ? 'var(--primary)' : 'var(--border)'}`, background: incl.has(e.id) ? 'var(--surface)' : 'var(--surface-2)', color: incl.has(e.id) ? 'var(--ink)' : 'var(--faint)', fontFamily: SANS, fontSize: 13, outline: 'none' }} />
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
