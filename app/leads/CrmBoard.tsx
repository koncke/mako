'use client';

// =============================================================================
// CrmBoard — tablero del CRM (rediseño Marketing OS)
// =============================================================================
// Réplica fiel del prototipo (Dashboard CRM.dc.html) sobre datos reales de
// Supabase. Persisten: mover de etapa, Closer, Setter, links de Fathom, motivo
// y borrar lead (server actions). Plan de pagos / cuotas / nutrición se editan
// en sesión (no se persisten en esta iteración).

import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
} from 'react';
import {
  CHIP,
  CATEGORY,
  BAND_LABEL,
  bandToCategory,
  stageMeta as findStage,
  type Stage,
  type StageBand,
  type FunnelTransition,
} from '@/lib/pipeline';
import type { EstadoLead, FathomLink } from '@/lib/leads';
import {
  setLeadStageAction,
  undoStageMoveAction,
  markManualNutritionAction,
  markMeetingManualAction,
  bulkFillLeadFieldAction,
  bulkIgnoreEmpresaAction,
} from './actions';
import { LeadEditModal } from './LeadEditModal';
import { StageMoveDialog, leadToMoveInfo, type StageMoveTarget } from './StageMoveDialog';
import type { Step } from '@/lib/stage-requirements';
import type { MiembroEquipo } from './actions';
import { WizardShell, wizardInput } from '@/app/_components/WizardShell';
import { sectionForStage } from './edit-logic';
import { missingForStage, funnelReqInfo } from '@/lib/stage-requirements';
import { Dropdown, type DropdownOption } from '../components/Dropdown';
import { openCalendlyFor, calendlyUrlFor } from './calendly-widget';
import { Icon } from '../_components/icons';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

// ── Tipos del view-model (los arma el server en page.tsx) ──
export type CrmLead = {
  id: number;
  name: string;
  email: string;
  company: string;
  origin: string;
  stage: string;
  derivedStage: string;   // posición real en el funnel (ignora override) — para el worklist
  created: string;
  telefonoNorm: string | null;   // teléfono solo-dígitos — para wa.me / WhatsApp
  // Fechas crudas (ISO) para la línea de tiempo del recorrido.
  createdISO: string;
  agendaISO: string | null;
  confirmacionISO: string | null;
  primerPagoISO: string | null;
  cierreISO: string | null;
  nutriManualDeadline: string | null;   // deadline de la nutrición manual (null si no aplica)
  monto: number;
  totalCobrado: number;
  agenda: string | null;
  j2: string | null;
  fechaJ1: string | null;   // fecha_junta_1 (o fecha_agenda) en ISO, para editar
  fechaJ2: string | null;   // fecha_junta_2 en ISO, para editar
  phone: string;
  estadoLead: EstadoLead;
  asistioJ1: boolean | null;
  asistioJ2: boolean | null;
  calificado: boolean | null;
  closer: string;
  setter: string;
  fathom: FathomLink[];
  motivo: string;
  calendly: { q: string; a: string }[];
  originChannel: string;       // canal real (Meta / Campaña / Directo), no hardcodeado
  confirmacion: string | null; // fecha de confirmación verbal de pago (real), o null
  cierre: string | null;       // fecha de cierre ganado (real), o null
};
export type CrmJunta = {
  id: string;
  leadId: number;
  when: string;
  warn: boolean;
  warnText: string;
  name: string;
  company: string;
  phone: string;
  goal: string;
};
export type CrmMarcar = {
  id: string;
  leadId: number;
  name: string;
  company: string;
  message: string;
  tipo: 'A' | 'B' | 'C' | 'M';   // A=¿asistió J1?  B=tuvo J1, falta J2/resolución  C=¿asistió J2?  M=nutrición manual vencida
  /** true = solo faltan datos estáticos (tel/empresa/detalle): se editan, no wizard. */
  soloEdit?: boolean;
  /** Dónde resolver: wizard, Deal Details (cobranza), Meetings, o Editar. */
  solTab?: 'wizard' | 'cobranza' | 'reuniones' | 'edit';
  /** Lista exacta de datos faltantes (para el wizard in-place, pasada única). */
  faltantes?: Step[];
};

const fmt = (n: number) => '$' + n.toLocaleString('en-US');

function chipStyle(tone: Stage['tone']): CSSProperties {
  const c = CHIP[tone] || CHIP.neutral;
  return {
    display: 'inline-block', fontSize: 12, fontWeight: 600, padding: '4px 10px',
    borderRadius: 999, background: c.bg, color: c.fg, border: '1px solid ' + c.bd, whiteSpace: 'nowrap',
  };
}

export function CrmBoard({
  leads,
  stages,
  juntas,
  marcar,
  transitions,
  total,
  errorMsg,
  hoy,
  equipo = [],
}: {
  leads: CrmLead[];
  stages: Stage[];
  juntas: CrmJunta[];
  marcar: CrmMarcar[];
  transitions: FunnelTransition[];
  total: number;
  errorMsg: string | null;
  hoy: string;
  equipo?: MiembroEquipo[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [view, setView] = useState<'kanban' | 'table'>('kanban');
  const [activeBands, setActiveBands] = useState<Set<StageBand>>(() => new Set<StageBand>(['pipeline', 'nutricion', 'salidas']));
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('todos');
  const [originFilter, setOriginFilter] = useState('todos');
  // ?pendientes=1 mantiene el worklist abierto: al volver de una ficha (Solucionar)
  // se restaura la vista de "Datos sin marcar" con su scroll (restauración de Next).
  const [showSinMarcar, setShowSinMarcar] = useState(sp.get('pendientes') === '1');
  const toggleSinMarcar = () => {
    const abrir = !showSinMarcar;
    setShowSinMarcar(abrir);
    const params = new URLSearchParams(sp.toString());
    if (abrir) params.set('pendientes', '1'); else params.delete('pendientes');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [stageMove, setStageMove] = useState<{ leadId: number; move: StageMoveTarget } | null>(null);   // pop-up chico de completar movimiento
  const [localStage, setLocalStage] = useState<Record<number, string>>({});
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  // Auto-scroll horizontal del tablero al arrastrar cerca de un borde: sin esto
  // no se puede soltar en una columna que quedó fuera de la vista.
  const boardScrollRef = useRef<HTMLDivElement | null>(null);
  const autoScrollDir = useRef(0);
  const autoScrollRaf = useRef(0);
  const stopAutoScroll = () => { autoScrollDir.current = 0; if (autoScrollRaf.current) { cancelAnimationFrame(autoScrollRaf.current); autoScrollRaf.current = 0; } };
  const tickAutoScroll = () => {
    const el = boardScrollRef.current;
    if (el && autoScrollDir.current !== 0) el.scrollLeft += autoScrollDir.current * 16;
    if (autoScrollDir.current !== 0) autoScrollRaf.current = requestAnimationFrame(tickAutoScroll);
    else autoScrollRaf.current = 0;
  };
  const onBoardDragOver = (e: React.DragEvent) => {
    const el = boardScrollRef.current;
    if (!el || dragId == null) return;
    const r = el.getBoundingClientRect();
    const EDGE = 90;
    const dir = e.clientX < r.left + EDGE ? -1 : e.clientX > r.right - EDGE ? 1 : 0;
    autoScrollDir.current = dir;
    if (dir !== 0 && autoScrollRaf.current === 0) autoScrollRaf.current = requestAnimationFrame(tickAutoScroll);
  };
  useEffect(() => () => stopAutoScroll(), []);
  const [undoInfo, setUndoInfo] = useState<{ id: number; name: string; from: string; toLabel: string; monto: number | null; motivo: string | null } | null>(null);
  const [manualNutri, setManualNutri] = useState<{ leadId: number; name: string } | null>(null);
  const [manualMotivo, setManualMotivo] = useState('');
  const [manualDeadline, setManualDeadline] = useState('');
  const [manualNutriPaso, setManualNutriPaso] = useState(0);   // wizard: 0=motivo, 1=fecha límite
  const [queHacer, setQueHacer] = useState<{ leadId: number; name: string } | null>(null);   // manual vencida: "¿qué hacer ahora?"
  // modo 'pasada' = ya ocurrió (pide asistencia); 'futura' = ya está agendada
  // por fuera de Calendly pero todavía no se tuvo (solo fecha).
  const [manualMeeting, setManualMeeting] = useState<{ leadId: number; name: string; which: 'agenda' | 'agendaj2'; modo: 'pasada' | 'futura' } | null>(null);
  const [mmFecha, setMmFecha] = useState('');
  const [mmAsistio, setMmAsistio] = useState<'si' | 'no' | ''>('si');
  const [mmNota, setMmNota] = useState('');   // por qué se agendó fuera de Calendly (excepción)
  const [mmPaso, setMmPaso] = useState(0);    // wizard: 0=fecha, 1=asistencia (pasada) / motivo (futura)
  const [meetingChoice, setMeetingChoice] = useState<{ leadId: number; name: string; which: 'agenda' | 'agendaj2' } | null>(null);

  const stageKeys = useMemo(() => new Set(stages.map((s) => s.key)), [stages]);
  const firstKey = stages[0]?.key ?? 'lead';

  const effStage = (l: CrmLead): string => {
    const k = localStage[l.id] ?? l.stage;
    return stageKeys.has(k) ? k : firstKey;
  };

  // Abrir la ficha del lead (preview).
  const openDetail = (l: CrmLead) => setSelectedId(l.id);
  const closeDetail = () => setSelectedId(null);

  // Transición del grafo que define el movimiento `from → to` (si existe). Lleva
  // la asistencia (R1/R2) que ese paso implica, igual que en "Datos sin marcar".
  const transitionFor = (from: string, to: string): FunnelTransition | undefined =>
    transitions.find((t) => t.from === from && t.to === to);

  // Movimiento directo (etapas que no piden completar datos). Optimista + revert.
  const persistStage = (id: number, key: string, from?: string, tr?: FunnelTransition) => {
    setLocalStage((m) => ({ ...m, [id]: key }));
    startTransition(async () => {
      try {
        await setLeadStageAction(id, key, { asistio_j1: tr?.asistioJ1, asistio_j2: tr?.asistioJ2 });
      } catch {
        // El server rechazó el movimiento (invariante): revertir el optimista y
        // limpiar el toast de deshacer. router.refresh() resincroniza con la verdad.
        setLocalStage((m) => { const n = { ...m }; if (from) n[id] = from; else delete n[id]; return n; });
        setUndoInfo(null);
      }
      router.refresh();
    });
    // Toast "Deshacer" (5s) tras concretar un movimiento en el tablero.
    if (from && from !== key) {
      const lead = leads.find((l) => l.id === id);
      setUndoInfo({ id, name: lead?.name ?? `Lead ${id}`, from, toLabel: findStage(stages, key).label, monto: lead?.monto || null, motivo: lead?.motivo || null });
    }
  };

  // Revertir el último movimiento a su etapa anterior (ventana del toast, 5s).
  // No deja huella en el historial: un movimiento deshecho al instante es un
  // mis-click, no historia. Lleva el monto/motivo previos para reponerlos si el
  // movimiento los borró (des-ganar).
  const undoMove = () => {
    if (!undoInfo) return;
    const { id, from, monto, motivo } = undoInfo;
    setUndoInfo(null);
    setLocalStage((m) => ({ ...m, [id]: from }));
    startTransition(async () => {
      try { await undoStageMoveAction(id, from, { monto, motivo }); }
      catch { setLocalStage((m) => { const n = { ...m }; delete n[id]; return n; }); }
      router.refresh();
    });
  };

  // Refresh al volver a la pestaña/ventana (throttled): los cambios hechos en la
  // ficha (restaurar, editar) se reflejan en el tablero sin F5.
  useEffect(() => {
    let last = 0;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - last > 15_000) { last = now; router.refresh(); }
    };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.removeEventListener('focus', onVisible); document.removeEventListener('visibilitychange', onVisible); };
  }, [router]);

  // El toast se autodescarta a los 5s.
  useEffect(() => {
    if (!undoInfo) return;
    const t = setTimeout(() => setUndoInfo(null), 5000);
    return () => clearTimeout(t);
  }, [undoInfo]);

  // Mostrar/ocultar una banda del Kanban (multi-selección) + limpiar drag.
  const toggleBand = (band: StageBand) => {
    setActiveBands((prev) => { const n = new Set(prev); if (n.has(band)) n.delete(band); else n.add(band); return n; });
    setDragId(null); setDragOverCol(null);
  };

  // ¿Mover a `key` exige pasar por la ficha? Sí cuando hay un campo obligatorio
  // faltante (bloquea) o cuando la etapa tiene una sección que completar (motivo,
  // plan de pagos, nutrición). El resto de etapas se mueven en silencio.
  const missingForLead = (l: CrmLead, key: string) => missingForStage(key, {
    ...funnelReqInfo(stages, key),
    fechaJ1: l.fechaJ1, fechaJ2: l.fechaJ2,
    asistioJ1: l.asistioJ1, asistioJ2: l.asistioJ2, calificado: l.calificado,
    hasFathomUrl: l.fathom.some((f) => f.url?.trim()),
    monto: l.monto || null, motivo: l.motivo, setter: l.setter,
    hoyISO: hoy,
  });
  const needsFicha = (l: CrmLead, key: string) => missingForLead(l, key).length > 0 || !!sectionForStage(key);

  // Abrir el pop-up chico de completar movimiento (no la ficha entera).
  const openStageMove = (l: CrmLead, move: StageMoveTarget) => setStageMove({ leadId: l.id, move });

  // Abre Calendly (prefill nombre/email); la fecha la setea el webhook al reservar
  // y el lead avanza solo. NO persistimos acá.
  const doOpenCalendly = (lead: CrmLead, key: string) => {
    void openCalendlyFor(key, {
      name: lead.name,
      email: lead.email,
      onScheduled: () => { setTimeout(() => router.refresh(), 2500); },
    });
  };

  // Antes de tocar Calendly preguntamos: ¿la reunión ya ocurrió (marcar a mano) o
  // se va a agendar? Único punto de intercepción (worklist, ficha, drag y chips).
  const scheduleViaCalendly = (lead: CrmLead, key: string) => {
    setMeetingChoice({ leadId: lead.id, name: lead.name, which: key as 'agenda' | 'agendaj2' });
  };

  const handleDrop = (stageKey: string) => {
    const id = dragId;
    setDragId(null);
    if (id == null) return;
    const lead = leads.find((l) => l.id === id);
    if (!lead || effStage(lead) === stageKey) return;
    if (stageKey === 'manual') { openManualNutri(id); return; }
    if (calendlyUrlFor(stageKey)) { scheduleViaCalendly(lead, stageKey); return; }
    const from = effStage(lead);
    const tr = transitionFor(from, stageKey);
    if (needsFicha(lead, stageKey)) openStageMove(lead, { to: stageKey, asistioJ1: tr?.asistioJ1, asistioJ2: tr?.asistioJ2 });
    else persistStage(id, stageKey, from, tr);
  };

  // "Solucionar" un dato sin marcar → abre el wizard IN-PLACE (pop-up), sin salir
  // del kanban. La pasada única resuelve TODO (reuniones/venta/higiene + Deal
  // Details + documentos + respuestas R2). El paso final ofrece ver la ficha o salir.
  const solucionarMarcar = (leadId: number) => {
    const l = leads.find((x) => x.id === leadId);
    if (!l) { router.push(`/leads/${leadId}?solucionar=1`); return; }
    openStageMove(l, { to: effStage(l) });
  };

  // "Nutrición - Manual" desde el worklist: pide MOTIVO antes de guardar.
  const openManualNutri = (leadId: number) => {
    const l = leads.find((x) => x.id === leadId);
    setManualMotivo('');
    setManualDeadline('');
    setManualNutriPaso(0);
    setManualNutri({ leadId, name: l?.name ?? 'lead' });
  };
  const confirmManualNutri = () => {
    if (!manualNutri || !manualMotivo.trim() || !manualDeadline) return;
    const { leadId } = manualNutri;
    const deadline = manualDeadline;
    setManualNutri(null);
    setLocalStage((m) => ({ ...m, [leadId]: 'manual' }));
    startTransition(async () => { await markManualNutritionAction(leadId, manualMotivo.trim(), deadline); router.refresh(); });
  };

  // Reunión (R1/R2) sin Calendly: 'pasada' = ya ocurrió (fecha + asistencia);
  // 'futura' = ya está agendada por fuera pero todavía no se tuvo (solo fecha).
  const openManualMeeting = (leadId: number, which: 'agenda' | 'agendaj2', modo: 'pasada' | 'futura') => {
    const l = leads.find((x) => x.id === leadId);
    setMmFecha(''); setMmAsistio('si'); setMmNota(''); setMmPaso(0);
    setManualMeeting({ leadId, name: l?.name ?? 'lead', which, modo });
  };
  const confirmManualMeeting = () => {
    if (!manualMeeting || !mmFecha) return;
    if (manualMeeting.modo === 'futura' && !mmNota.trim()) return;
    const { leadId, which, modo } = manualMeeting;
    const asistio = modo === 'futura' ? null : mmAsistio === '' ? null : mmAsistio === 'si';
    const lead = leads.find((l) => l.id === leadId);
    const from = lead ? effStage(lead) : undefined;
    const nota = modo === 'futura' ? mmNota.trim() : null;
    setManualMeeting(null);
    startTransition(async () => {
      await markMeetingManualAction(leadId, which, mmFecha, asistio, nota);
      router.refresh();
    });
    // Toast Deshacer también en este camino (antes solo lo tenía el drag directo).
    if (lead && from && from !== which) {
      setUndoInfo({ id: leadId, name: lead.name, from, toLabel: findStage(stages, which).label, monto: lead.monto || null, motivo: lead.motivo || null });
    }
  };

  // ── Filtro ──
  const matches = (l: CrmLead) => {
    const q = search.trim().toLowerCase();
    if (q && !(l.name.toLowerCase().includes(q) || l.company.toLowerCase().includes(q) || l.email.toLowerCase().includes(q))) return false;
    if (stageFilter !== 'todos' && effStage(l) !== stageFilter) return false;
    if (originFilter !== 'todos' && l.origin !== originFilter) return false;
    return true;
  };
  const filtered = leads.filter(matches);
  const originOptions = useMemo(() => [...new Set(leads.map((l) => l.origin))], [leads]);

  // ── worklist "datos sin marcar" ──
  const marcarPending = marcar.length;

  // ── estilos de tabs/botones ──
  const tabActive: CSSProperties = { padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: SANS, fontSize: 14, fontWeight: 600, background: 'var(--ink)', color: 'var(--on-sidebar)' };
  const tabIdle: CSSProperties = { ...tabActive, fontWeight: 500, background: 'transparent', color: 'var(--dim)' };
  // Búsqueda (crece) con lupa interior
  const searchWrap: CSSProperties = { position: 'relative', flex: 1, minWidth: 240, display: 'flex', alignItems: 'center' };
  const searchInput: CSSProperties = { width: '100%', padding: '11px 16px 11px 42px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14.5, outline: 'none' };
  const gearBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 14px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 14, fontWeight: 500, cursor: 'pointer' };

  const btnBase: CSSProperties = { padding: '11px 17px', borderRadius: 11, cursor: 'pointer', fontFamily: SANS, fontSize: 14, fontWeight: 600 };
  let sinMarcarBtnStyle: CSSProperties;
  let sinMarcarBtnLabel: string;
  if (showSinMarcar) {
    sinMarcarBtnStyle = { ...btnBase, border: '1px solid var(--bad)', background: 'var(--bad)', color: '#fff' };
    sinMarcarBtnLabel = '✕ Cerrar';
  } else if (marcarPending > 0) {
    sinMarcarBtnStyle = { ...btnBase, border: '1px solid var(--bad)', background: 'var(--bad-bg)', color: 'var(--bad)', animation: 'pulseRed 1.6s infinite' };
    sinMarcarBtnLabel = '⚠ ' + marcarPending + ' datos sin marcar';
  } else {
    sinMarcarBtnStyle = { ...btnBase, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontWeight: 500 };
    sinMarcarBtnLabel = '✓ Datos al día';
  }

  const selected = selectedId != null ? leads.find((l) => l.id === selectedId) ?? null : null;

  // Leads que esperan tu validación (los que están en "Datos sin marcar").
  const pendingLeadIds = new Set(marcar.map((m) => m.leadId));
  const KANBAN_BANDS: StageBand[] = ['pipeline', 'nutricion', 'salidas'];

  // Una columna del Kanban (reutilizada por cada banda).
  const renderColumn = (c: Stage) => {
    const cards = filtered.filter((l) => effStage(l) === c.key);
    const bandC = CATEGORY[bandToCategory(c.band)].c;
    return (
      <div key={c.key}
        onDragOver={(e) => { e.preventDefault(); if (dragId != null && dragOverCol !== c.key) setDragOverCol(c.key); }}
        onDrop={(e) => { e.preventDefault(); handleDrop(c.key); setDragOverCol(null); }}
        style={{ flex: 'none', width: 282, background: dragOverCol === c.key && dragId != null ? 'var(--surface-2)' : 'var(--surface)', borderLeft: '1px solid ' + (dragOverCol === c.key && dragId != null ? 'var(--primary)' : 'var(--border)'), borderRight: '1px solid ' + (dragOverCol === c.key && dragId != null ? 'var(--primary)' : 'var(--border)'), borderBottom: '1px solid ' + (dragOverCol === c.key && dragId != null ? 'var(--primary)' : 'var(--border)'), borderTop: '3px solid ' + bandC, borderRadius: 16, display: 'flex', flexDirection: 'column', maxHeight: '68vh', transition: 'background .15s, border-color .15s, box-shadow .15s', boxShadow: dragOverCol === c.key && dragId != null ? '0 0 0 3px var(--primary-weak)' : 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '14px 16px 11px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
            <span style={{ width: 9, height: 9, flex: 'none', borderRadius: '50%', background: c.dot }} />
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</span>
          </div>
          <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: 'var(--dim)', background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 999, fontVariantNumeric: 'tabular-nums' }}>{cards.length}</span>
        </div>
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
          {cards.map((l) => {
            const isGanado = effStage(l) === 'ganado';
            const isManual = effStage(l) === 'manual';
            const dl = l.nutriManualDeadline;
            const dlFmt = dl ? `${dl.slice(8, 10)}/${dl.slice(5, 7)}/${dl.slice(0, 4)}` : null;
            const overdueManual = isManual && l.estadoLead === 'abierto' && !!dl && dl < hoy;
            const waiting = pendingLeadIds.has(l.id);
            return (
              <div key={l.id}
                onClick={() => openDetail(l)}
                draggable
                onDragStart={(ev) => { setDragId(l.id); ev.dataTransfer.effectAllowed = 'move'; }}
                onDragEnd={() => { setDragId(null); setDragOverCol(null); stopAutoScroll(); }}
                style={{ background: 'var(--surface-2)', borderTop: '1px solid var(--border)', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', borderLeft: overdueManual ? '3px solid var(--bad)' : waiting ? '3px solid var(--bad)' : '1px solid var(--border)', borderRadius: 11, padding: '13px 14px', cursor: 'grab', transition: 'opacity .15s, transform .15s, box-shadow .15s', opacity: dragId === l.id ? 0.5 : 1, transform: dragId === l.id ? 'scale(0.97)' : 'none', boxShadow: dragId === l.id ? '0 10px 26px rgba(18,21,27,.20)' : 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.25, minWidth: 0 }}>{l.name}</div>
                  {overdueManual
                    ? <span title="Venció el deadline de la nutrición manual" style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, color: 'var(--bad)', background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 999, padding: '1px 7px', whiteSpace: 'nowrap', animation: 'blinkRed 1.2s infinite' }}><span aria-hidden>🚨</span> Vencida</span>
                    : waiting && <span title="Faltan datos posibles de conseguir para esta etapa" style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700, color: 'var(--bad)', background: 'var(--bad-bg)', border: '1px solid #EBBFBC', borderRadius: 999, padding: '1px 7px', whiteSpace: 'nowrap' }}><span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--bad)', animation: 'blinkRed 1.2s infinite' }} /> Datos sin marcar</span>}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.company}</div>
                <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.03em', color: 'var(--faint)', marginTop: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.origin}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12, color: 'var(--dim)' }}>{isGanado ? 'Ganado' : isManual ? (overdueManual ? 'Venció' : 'Vence') : l.agenda ? 'Agenda' : l.created}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: isGanado ? 'var(--good)' : overdueManual ? 'var(--bad)' : 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>{isGanado ? fmt(l.monto) : isManual ? (dlFmt ?? 'sin fecha') : l.agenda || '—'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 60px', display: 'flex', flexDirection: 'column' }}>
      {/* HEADER */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'inline-flex', color: 'var(--accent)' }}><Icon name="crm" size={34} /></span>
          <h1 style={{ fontWeight: 600, fontSize: 46, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>CRM</h1>
          <span style={{ fontSize: 15, color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>{filtered.length} de {total} leads</span>
        </div>
        <Link href="/leads/new" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 19px', borderRadius: 11, background: 'var(--ink)', color: '#F3F5F8', fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>+ Nuevo lead</Link>
      </header>

      {errorMsg && (
        <div style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 13, padding: '14px 18px', marginBottom: 14, color: 'var(--bad)', fontSize: 14 }}>
          No se pudo leer Supabase: <span style={{ fontFamily: MONO }}>{errorMsg}</span>
        </div>
      )}

      {/* TUS JUNTAS */}
      {juntas.length > 0 && (
        <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 13, padding: '13px 16px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
            <h2 style={{ fontFamily: MONO, fontWeight: 600, fontSize: 11.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--dim)', margin: 0 }}>Tus reuniones</h2>
            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--dim)' }}>{juntas.length}</span>
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 2 }}>
            {juntas.map((j) => (
              <div key={j.id} style={{ flex: 'none', width: 288, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 11, padding: '11px 13px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 6, background: 'var(--ink)', color: 'var(--on-sidebar)' }}>{j.when}</span>
                  {j.warn && <span style={{ fontSize: 11, color: 'var(--bad)', background: 'var(--bad-bg)', padding: '3px 7px', borderRadius: 6 }}>⚠ {j.warnText}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.name}</span>
                  <span
                    onClick={() => { const l = leads.find((x) => x.id === j.leadId); if (l) openDetail(l); }}
                    style={{ flex: 'none', fontSize: 12, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none', cursor: 'pointer' }}
                  >Abrir →</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--dim)' }}><span style={{ color: 'var(--faint)' }}>Quiere:</span> {j.goal}</div>
                <div style={{ fontSize: 11.5, color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>☎ {j.phone}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TOOLBAR — vista · búsqueda | filtros | acciones */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
        {/* Vista */}
        <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 11, padding: 4, gap: 4 }}>
          <button onClick={() => setView('kanban')} style={view === 'kanban' ? tabActive : tabIdle}>Kanban</button>
          <button onClick={() => setView('table')} style={view === 'table' ? tabActive : tabIdle}>Tabla</button>
        </div>

        {/* Búsqueda */}
        <div style={searchWrap}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ position: 'absolute', left: 15, pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, empresa o email…" style={searchInput} />
        </div>

        {/* Filtros */}
        <div style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
          <Dropdown
            value={stageFilter}
            onChange={setStageFilter}
            ariaLabel="Filtrar por etapa"
            options={[{ value: 'todos', label: 'Etapa: todas' }, ...stages.map((s) => ({ value: s.key, label: s.label, color: s.dot }))]}
          />
          <Dropdown
            value={originFilter}
            onChange={setOriginFilter}
            ariaLabel="Filtrar por origen"
            options={[{ value: 'todos', label: 'Origen: todos' }, ...originOptions.map((o) => ({ value: o, label: o }))]}
          />
        </div>

        {/* Acciones */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
          <Link href="/funnel" title="Editar el funnel (etapas y flechas)" style={{ ...gearBtn, textDecoration: 'none' }}>✎ Funnel</Link>
          <button onClick={toggleSinMarcar} style={sinMarcarBtnStyle}>{sinMarcarBtnLabel}</button>
        </div>
      </div>

      {/* DATOS SIN MARCAR */}
      {showSinMarcar ? (
        <SinMarcar
          marcar={marcar}
          equipo={equipo}
          onSolucionar={solucionarMarcar}
          onQueHacer={(id) => { const l = leads.find((x) => x.id === id); setQueHacer({ leadId: id, name: l?.name ?? 'lead' }); }}
          onBulkDone={() => router.refresh()}
        />
      ) : view === 'kanban' ? (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Bandas (multi-selección): mostrá las que quieras a la vez */}
          <div style={{ display: 'inline-flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {KANBAN_BANDS.map((band) => {
              const on = activeBands.has(band);
              const accent = CATEGORY[bandToCategory(band)].c;
              const n = filtered.filter((l) => (stages.find((s) => s.key === effStage(l))?.band ?? 'pipeline') === band).length;
              return (
                <button key={band} onClick={() => toggleBand(band)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 11, border: '1px solid ' + (on ? accent : 'var(--border-strong)'), background: on ? accent : 'var(--surface)', color: on ? '#fff' : 'var(--dim)', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: on ? '#fff' : accent }} />
                  {BAND_LABEL[band]}
                  <span style={{ fontSize: 12.5, fontWeight: 600, opacity: 0.85 }}>{n}</span>
                </button>
              );
            })}
          </div>
          <div ref={boardScrollRef} onDragOver={onBoardDragOver} onDrop={stopAutoScroll} style={{ flex: 1, minHeight: 0, overflowX: 'auto', paddingBottom: 14 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', width: 'max-content' }}>
              {stages
                .filter((s) => activeBands.has(s.band ?? 'pipeline'))
                .sort((a, b) => (KANBAN_BANDS.indexOf(a.band ?? 'pipeline') - KANBAN_BANDS.indexOf(b.band ?? 'pipeline')) || ((a.col ?? 0) - (b.col ?? 0)))
                .map((c) => renderColumn(c))}
            </div>
          </div>
          {activeBands.size === 0 && <div style={{ padding: 30, color: 'var(--dim)', fontSize: 14 }}>Elegí al menos una banda arriba para ver el tablero.</div>}
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.6fr 1.3fr 1fr 1fr 0.8fr', gap: 12, padding: '15px 22px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', fontFamily: MONO, fontSize: 11, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--dim)' }}>
            <span>Nombre</span><span>Empresa</span><span>Origen</span><span>Etapa</span><span>¿Agendó?</span><span>Estado / Monto</span><span style={{ textAlign: 'right' }}>Creado</span>
          </div>
          {filtered.map((l) => {
            const m = findStage(stages, effStage(l));
            const isGanado = effStage(l) === 'ganado';
            return (
              <div key={l.id} onClick={() => openDetail(l)} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.6fr 1.3fr 1fr 1fr 0.8fr', gap: 12, padding: '15px 22px', borderBottom: '1px solid var(--border)', alignItems: 'center', cursor: 'pointer' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.name}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.email}</div>
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--ink)', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.company}</div>
                <div style={{ fontSize: 12.5, color: 'var(--dim)', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.origin}</div>
                <div><span style={chipStyle(m.tone)}>{m.label}</span></div>
                <div style={{ fontSize: 13, color: 'var(--dim)' }}>{l.agenda ?? '—'}</div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: isGanado ? 'var(--good)' : 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>{isGanado ? fmt(l.monto) : '—'}</div>
                <div style={{ fontSize: 12.5, color: 'var(--faint)', textAlign: 'right', whiteSpace: 'nowrap' }}>{l.created}</div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--dim)', fontSize: 14.5 }}>Sin resultados para los filtros actuales.</div>
          )}
        </div>
      )}

      {selected && (
        <LeadEditModal leadId={selected.id} seed={{ nombre: selected.name, empresa: selected.company }} onClose={closeDetail} />
      )}

      {/* Pop-up chico de completar movimiento (drag/worklist a etapa que pide datos) */}
      {stageMove && (() => {
        const l = leads.find((x) => x.id === stageMove.leadId);
        if (!l) return null;
        const from = effStage(l);
        const esCompletar = stageMove.move.to === from;
        const faltantesLead = esCompletar ? marcar.find((m) => m.leadId === l.id)?.faltantes : undefined;
        return (
          <StageMoveDialog
            lead={leadToMoveInfo(l)}
            stages={stages}
            move={stageMove.move}
            titulo={esCompletar ? 'Completar datos' : undefined}
            completarDatos={esCompletar}
            faltantes={faltantesLead}
            equipo={equipo}
            onVerDetalle={esCompletar ? () => router.push(`/leads/${l.id}`) : undefined}
            onClose={() => setStageMove(null)}
            onDone={() => {
              setStageMove(null);
              setLocalStage((m) => ({ ...m, [l.id]: stageMove.move.to }));
              if (from !== stageMove.move.to) {
                setUndoInfo({ id: l.id, name: l.name, from, toLabel: findStage(stages, stageMove.move.to).label, monto: l.monto || null, motivo: l.motivo || null });
              }
              router.refresh();
            }}
          />
        );
      })()}

      {/* Nutrición manual — wizard de 2 pasos (motivo + fecha límite) */}
      {manualNutri && (
        <WizardShell
          titulo={`Nutrición manual · ${manualNutri.name}`}
          total={2}
          idx={manualNutriPaso}
          pregunta={manualNutriPaso === 0 ? '¿Por qué pasa a nutrición manual?' : '¿Hasta cuándo la seguís?'}
          sub={manualNutriPaso === 0
            ? 'Contá el motivo del parking. Queda en el historial del lead.'
            : 'Poné una fecha límite: si llega sin que el lead avance, vuelve a «datos sin marcar» en rojo.'}
          puedeAvanzar={manualNutriPaso === 0 ? !!manualMotivo.trim() : !!manualDeadline}
          enUltimo={manualNutriPaso === 1}
          confirmLabel="Guardar nutrición manual"
          pending={isPending}
          atrasLabel={manualNutriPaso === 0 ? 'Cancelar' : 'Atrás'}
          onClose={() => setManualNutri(null)}
          onAtras={() => (manualNutriPaso === 0 ? setManualNutri(null) : setManualNutriPaso(0))}
          onSiguiente={() => setManualNutriPaso(1)}
          onConfirmar={confirmManualNutri}
        >
          {manualNutriPaso === 0 ? (
            <textarea value={manualMotivo} onChange={(e) => setManualMotivo(e.target.value)} autoFocus placeholder="Ej: pidió que lo contactemos en 2 meses; está cerrando presupuesto…" style={{ ...wizardInput, minHeight: 96, textAlign: 'left', lineHeight: 1.5 }} />
          ) : (
            <input type="date" value={manualDeadline} min={hoy} onChange={(e) => setManualDeadline(e.target.value)} autoFocus style={{ ...wizardInput, maxWidth: 260, margin: '0 auto', display: 'block' }} />
          )}
        </WizardShell>
      )}

      {/* Manual vencida: "¿qué hacer ahora?" — seguir nutriendo o mover de etapa */}
      {queHacer && (() => {
        const l = leads.find((x) => x.id === queHacer.leadId);
        const opt = (band: 'pipeline' | 'salidas') => stages.filter((s) => (s.band ?? 'pipeline') === band && s.key !== 'lead').sort((a, b) => (a.col ?? 0) - (b.col ?? 0));
        const stageBtn = (s: Stage) => (
          <button key={s.key} type="button" onClick={() => { setQueHacer(null); if (l) openStageMove(l, { to: s.key }); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>
            <span aria-hidden style={{ width: 9, height: 9, borderRadius: '50%', background: s.dot, flex: 'none' }} />{s.label}
          </button>
        );
        return (
          <div onClick={() => setQueHacer(null)} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 520, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 30px 70px rgba(18,21,27,.35)', padding: '22px 24px' }}>
              <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '.14em', color: 'var(--accent)', marginBottom: 8 }}>✦ MAKO</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>¿Qué hacer ahora? — {queHacer.name}</div>
              <div style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.5, marginBottom: 16 }}>Venció la nutrición manual sin resolverse. Elegí cómo sigue.</div>
              <button type="button" onClick={() => { const id = queHacer.leadId; setQueHacer(null); openManualNutri(id); }} style={{ width: '100%', padding: '12px 16px', borderRadius: 11, border: '1px solid var(--warn-fill)', background: 'var(--warn-bg)', color: 'var(--warn)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: SANS, textAlign: 'left', marginBottom: 14 }}>🔁 Seguir nutriendo — nuevo plazo</button>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--dim)', marginBottom: 8 }}>o mover a otra etapa</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {opt('pipeline').map(stageBtn)}
                {opt('salidas').map(stageBtn)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="button" onClick={() => setQueHacer(null)} style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: 'transparent', color: 'var(--dim)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>Cancelar</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ¿La reunión ya ocurrió o se va a agendar? Paso previo a Calendly */}
      {meetingChoice && (
        <div onClick={() => setMeetingChoice(null)} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 30px 70px rgba(18,21,27,.35)', padding: '22px 24px' }}>
            <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '.14em', color: 'var(--accent)', marginBottom: 8 }}>✦ MAKO</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>Reunión {meetingChoice.which === 'agenda' ? 'R1' : 'R2'} — {meetingChoice.name}</div>
            <div style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.5, marginBottom: 18 }}>¿En qué situación está esta {meetingChoice.which === 'agenda' ? 'R1' : 'R2'}?</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => { const c = meetingChoice; setMeetingChoice(null); openManualMeeting(c.leadId, c.which, 'pasada'); }}
                style={{ width: '100%', padding: '13px 16px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: SANS, textAlign: 'left' }}
              >
                <div>Ya la tuve</div>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--dim)', marginTop: 2 }}>Marcar fecha y asistencia a mano</div>
              </button>
              <button
                onClick={() => { const c = meetingChoice; setMeetingChoice(null); openManualMeeting(c.leadId, c.which, 'futura'); }}
                style={{ width: '100%', padding: '13px 16px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: SANS, textAlign: 'left' }}
              >
                <div>Ya está agendada (todavía no se tuvo)</div>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--dim)', marginTop: 2 }}>Se agendó por fuera de Calendly — cargar la fecha</div>
              </button>
              <button
                onClick={() => { const c = meetingChoice; setMeetingChoice(null); const l = leads.find((x) => x.id === c.leadId); if (l) doOpenCalendly(l, c.which); }}
                style={{ width: '100%', padding: '13px 16px', borderRadius: 11, border: '1px solid var(--primary)', background: 'rgba(47,111,237,.10)', color: 'var(--primary-strong)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: SANS, textAlign: 'left' }}
              >
                <div>Agendarla por Calendly</div>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--primary-strong)', opacity: 0.85, marginTop: 2 }}>Abrir Calendly para reservar fecha</div>
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setMeetingChoice(null)} style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: 'transparent', color: 'var(--dim)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Marcar/Registrar reunión (R1/R2) a mano — wizard de 2 pasos */}
      {manualMeeting && (() => {
        const esPasada = manualMeeting.modo === 'pasada';
        const rLabel = manualMeeting.which === 'agenda' ? 'R1' : 'R2';
        const puede = mmPaso === 0 ? !!mmFecha : (esPasada ? true : !!mmNota.trim());
        return (
          <WizardShell
            titulo={`${esPasada ? 'Marcar' : 'Registrar'} ${rLabel} · ${manualMeeting.name}`}
            total={2}
            idx={mmPaso}
            pregunta={mmPaso === 0
              ? (esPasada ? `¿Cuándo fue la ${rLabel}?` : `¿Para cuándo está agendada la ${rLabel}?`)
              : (esPasada ? `¿Asistió a la ${rLabel}?` : '¿Por qué se agendó fuera de Calendly?')}
            sub={mmPaso === 0
              ? (esPasada ? 'La reunión ya ocurrió: registrala a mano (sin Calendly) para avanzar el lead.' : 'Ya está agendada por fuera de Calendly. Cargá la fecha; la asistencia se marca cuando ocurra.')
              : (esPasada ? undefined : 'Es una excepción: todas las reuniones deberían agendarse por Calendly.')}
            puedeAvanzar={puede}
            enUltimo={mmPaso === 1}
            confirmLabel="Guardar reunión"
            pending={isPending}
            atrasLabel={mmPaso === 0 ? 'Cancelar' : 'Atrás'}
            onClose={() => setManualMeeting(null)}
            onAtras={() => (mmPaso === 0 ? setManualMeeting(null) : setMmPaso(0))}
            onSiguiente={() => setMmPaso(1)}
            onConfirmar={confirmManualMeeting}
          >
            {mmPaso === 0 ? (
              <input type="date" value={mmFecha} min={esPasada ? undefined : hoy} max={esPasada ? hoy : undefined} onChange={(e) => setMmFecha(e.target.value)} autoFocus style={{ ...wizardInput, maxWidth: 260, margin: '0 auto', display: 'block' }} />
            ) : esPasada ? (
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                {([['si', 'Sí, asistió'], ['no', 'No asistió'], ['', 'No sé']] as const).map(([v, lbl]) => (
                  <button key={lbl} onClick={() => setMmAsistio(v)} style={{ minWidth: 120, padding: '12px 16px', borderRadius: 12, border: `1px solid ${mmAsistio === v ? 'var(--ink)' : 'var(--border-strong)'}`, background: mmAsistio === v ? 'var(--ink)' : 'var(--surface)', color: mmAsistio === v ? '#F3F5F8' : 'var(--ink)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>{lbl}</button>
                ))}
              </div>
            ) : (
              <textarea value={mmNota} onChange={(e) => setMmNota(e.target.value)} autoFocus placeholder="Contá el motivo de la excepción…" style={{ ...wizardInput, minHeight: 90, textAlign: 'left', lineHeight: 1.5 }} />
            )}
          </WizardShell>
        );
      })()}

      {/* Toast Deshacer (5s) tras mover una card en el tablero */}
      {undoInfo && (
        <div style={{ position: 'fixed', left: '50%', bottom: 28, transform: 'translateX(-50%)', zIndex: 70, display: 'flex', alignItems: 'center', gap: 14, background: '#14161B', color: '#F3F5F8', padding: '12px 16px', borderRadius: 12, boxShadow: '0 12px 32px rgba(18,21,27,.35)', fontFamily: SANS, fontSize: 14 }}>
          <span><strong>{undoInfo.name}</strong> → {undoInfo.toLabel}</span>
          <button type="button" onClick={undoMove} style={{ background: 'transparent', border: '1px solid rgba(243,245,248,.35)', color: 'var(--primary-weak)', fontWeight: 600, fontSize: 13.5, padding: '6px 12px', borderRadius: 9, cursor: 'pointer', fontFamily: SANS }}>↶ Deshacer</button>
          <button type="button" onClick={() => setUndoInfo(null)} aria-label="cerrar" style={{ background: 'transparent', border: 'none', color: 'rgba(243,245,248,.6)', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>
      )}
    </main>
  );
}

// ── Marcar en lote: asigna un dato que se repite (Setter/Closer) a todos ──
// Los "Datos sin marcar" están dominados por datos iguales para muchos leads
// (ej. el mismo Setter). En vez de abrir 400 fichas, se asigna de una — con el
// MISMO formulario simple (desplegable del equipo) que la ficha y el wizard.
function BulkHigiene({ marcar, equipo, onDone }: {
  marcar: CrmMarcar[];
  equipo: MiembroEquipo[];
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<string | null>(null);
  const [open, setOpen] = useState<{ field: 'setter' | 'closer'; label: string; ids: number[] } | null>(null);
  const [openEmpresa, setOpenEmpresa] = useState(false);
  const [sel, setSel] = useState('');

  const idsCon = (stepId: string) => marcar.filter((m) => m.faltantes?.some((f) => f.id === stepId)).map((m) => m.leadId);
  const grupos = ([
    { field: 'setter', label: 'Setter', ids: idsCon('setter') },
    { field: 'closer', label: 'Closer', ids: idsCon('closer') },
  ] as const).filter((g) => g.ids.length > 0);
  const idsEmpresa = idsCon('empresa');

  if (!grupos.length && !idsEmpresa.length) return null;

  const abrir = (g: { field: 'setter' | 'closer'; label: string; ids: number[] }) => { setSel(''); setFlash(null); setOpen(g); };

  const ignorarEmpresa = () => {
    startTransition(async () => {
      try {
        const r = await bulkIgnoreEmpresaAction(idsEmpresa);
        setOpenEmpresa(false);
        setFlash(`✓ Empresa ignorada en ${r.updated} lead${r.updated === 1 ? '' : 's'} — ya no la pide el CRM (sigue en la ficha).`);
        onDone();
      } catch (e) {
        setFlash(`No se pudo: ${e instanceof Error ? e.message : 'error'}`);
      }
    });
  };

  const confirmar = () => {
    if (!open || !sel.trim()) return;
    const { field, ids, label } = open;
    const value = sel.trim();
    startTransition(async () => {
      try {
        const r = await bulkFillLeadFieldAction(field, value, ids);
        setOpen(null);
        setFlash(r.updated === 0
          ? `Sin cambios: esos leads ya tenían ${label} cargado.`
          : `✓ ${label} «${value}» asignado a ${r.updated} lead${r.updated === 1 ? '' : 's'}.`);
        onDone();
      } catch (e) {
        setFlash(`No se pudo: ${e instanceof Error ? e.message : 'error'}`);
      }
    });
  };

  const opts: DropdownOption[] = equipo.map((m) => ({ value: m.nombre, label: m.nombre, avatar: m.foto_url ?? null }));
  const btn: CSSProperties = { padding: '9px 16px', borderRadius: 10, border: 'none', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS };

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--primary)', borderRadius: 16, padding: 'var(--card-pad)', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span aria-hidden style={{ fontSize: 16 }}>⚡</span>
        <h3 style={{ fontWeight: 700, fontSize: 17, margin: 0, color: 'var(--ink)' }}>Marcar en lote</h3>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {grupos.map((g) => (
          <button key={g.field} type="button" onClick={() => abrir(g)} style={{ ...btn, background: 'var(--primary)', color: '#fff' }}>
            Asignar {g.label} · {g.ids.length}
          </button>
        ))}
        {idsEmpresa.length > 0 && (
          <button type="button" onClick={() => { setFlash(null); setOpenEmpresa(true); }} style={{ ...btn, background: 'var(--surface)', color: 'var(--dim)', border: '1px solid var(--border-strong)' }}>
            Ignorar Empresa · {idsEmpresa.length}
          </button>
        )}
      </div>
      {flash && <div style={{ marginTop: 10, fontSize: 13.5, fontWeight: 600, color: flash.startsWith('✓') ? 'var(--good)' : flash.startsWith('Sin cambios') ? 'var(--dim)' : 'var(--bad)' }}>{flash}</div>}

      {open && (
        <div onClick={() => !pending && setOpen(null)} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 30px 70px rgba(18,21,27,.35)', padding: '22px 24px' }}>
            <h3 style={{ fontWeight: 700, fontSize: 18, margin: '0 0 4px', color: 'var(--ink)' }}>Asignar {open.label} a {open.ids.length} lead{open.ids.length === 1 ? '' : 's'}</h3>
            <p style={{ fontSize: 13, color: 'var(--dim)', margin: '0 0 16px', lineHeight: 1.45 }}>
              {open.field === 'setter' ? 'El que agendó la reunión.' : 'El que corrió la llamada de venta.'} Elegilo de tu equipo. Solo rellena los que están vacíos.
            </p>
            {equipo.length > 0 ? (
              <Dropdown value={sel} options={opts} onChange={setSel} placeholder="Elegí del equipo…" width="100%" ariaLabel={open.label} />
            ) : (
              <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.5, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                Todavía no tenés equipo configurado. Agregá a tus setters y closers en <b>Configuraciones › Equipo</b> y después vas a poder asignarlos acá.
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button type="button" disabled={pending} onClick={() => setOpen(null)} style={{ ...btn, background: 'var(--surface)', color: 'var(--dim)', border: '1px solid var(--border-strong)' }}>Cancelar</button>
              <button type="button" disabled={pending || !sel.trim()} onClick={confirmar}
                style={{ ...btn, background: sel.trim() && !pending ? 'var(--primary)' : 'var(--surface-2)', color: sel.trim() && !pending ? '#fff' : 'var(--faint)' }}>
                {pending ? 'Asignando…' : `Asignar a los ${open.ids.length}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {openEmpresa && (
        <div onClick={() => !pending && setOpenEmpresa(false)} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 30px 70px rgba(18,21,27,.35)', padding: '22px 24px' }}>
            <h3 style={{ fontWeight: 700, fontSize: 18, margin: '0 0 4px', color: 'var(--ink)' }}>Ignorar Empresa en {idsEmpresa.length} lead{idsEmpresa.length === 1 ? '' : 's'}</h3>
            <p style={{ fontSize: 13, color: 'var(--dim)', margin: '0 0 16px', lineHeight: 1.45 }}>
              Muchas veces no tenés la empresa. Al ignorarla, deja de contar como “dato sin marcar” en el CRM general — pero sigue apareciendo como recordatorio suave dentro de la ficha de cada lead. Reversible.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" disabled={pending} onClick={() => setOpenEmpresa(false)} style={{ ...btn, background: 'var(--surface)', color: 'var(--dim)', border: '1px solid var(--border-strong)' }}>Cancelar</button>
              <button type="button" disabled={pending} onClick={ignorarEmpresa} style={{ ...btn, background: 'var(--ink)', color: 'var(--surface)' }}>{pending ? 'Ignorando…' : `Ignorar en los ${idsEmpresa.length}`}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Datos sin marcar (worklist) ──
function SinMarcar({
  marcar, equipo, onSolucionar, onQueHacer, onBulkDone,
}: {
  marcar: CrmMarcar[];
  equipo: MiembroEquipo[];
  onSolucionar: (leadId: number) => void;
  onQueHacer: (leadId: number) => void;
  onBulkDone: () => void;
}) {
  const btn: CSSProperties = { flex: 'none', padding: '9px 18px', borderRadius: 10, border: 'none', background: 'var(--bad)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS };
  return (
    <div>
      <BulkHigiene marcar={marcar} equipo={equipo} onDone={onBulkDone} />
      <div style={{ background: 'var(--surface)', border: '1px solid var(--bad)', borderRadius: 16, padding: 'var(--card-pad)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <h2 style={{ fontWeight: 600, fontSize: 23, letterSpacing: '-0.015em', margin: 0, color: 'var(--ink)' }}>Datos sin marcar</h2>
        <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: 'var(--bad-bg)', border: '1px solid var(--bad)', color: 'var(--bad)' }}>{marcar.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {marcar.map((m) => (
          <div key={m.id} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '15px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 240, flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--ink)' }}>{m.name}</div>
                <div style={{ fontSize: 13.5, color: 'var(--dim)', marginTop: 2 }}>{m.company ? m.company + ' · ' : ''}{m.message}</div>
              </div>
              {/* Solucionar abre el wizard de datos. La nutrición manual vencida
                  pregunta "¿qué hacer ahora?" (elegir la etapa destino). */}
              {m.tipo === 'M'
                ? <button type="button" style={{ ...btn, background: 'var(--warn-fill)' }} onClick={() => onQueHacer(m.leadId)}>¿Qué hacer ahora?</button>
                : <button type="button" style={btn} onClick={() => onSolucionar(m.leadId)}>Solucionar</button>}
            </div>
          </div>
        ))}
        {marcar.length === 0 && <div style={{ padding: 36, textAlign: 'center', color: 'var(--good)', fontSize: 15.5, fontWeight: 600 }}>✓ Todo marcado — datos al día.</div>}
      </div>
      </div>
    </div>
  );
}

// La gestión de etapas y transiciones vive ahora en la tab /funnel (FunnelEditor).
