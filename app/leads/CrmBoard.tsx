'use client';

// =============================================================================
// CrmBoard — tablero del CRM (rediseño Marketing OS)
// =============================================================================
// Réplica fiel del prototipo (Dashboard CRM.dc.html) sobre datos reales de
// Supabase. Persisten: mover de etapa, Closer, Setter, links de Fathom, motivo
// y borrar lead (server actions). Plan de pagos / cuotas / nutrición se editan
// en sesión (no se persisten en esta iteración).

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useEffect,
  useMemo,
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
  transitionsFrom,
  type Stage,
  type StageBand,
  type FunnelTransition,
} from '@/lib/pipeline';
import type { EstadoLead, FathomLink } from '@/lib/leads';
import {
  setLeadStageAction,
  saveLeadMetaAction,
  deleteLeadInlineAction,
  markManualNutritionAction,
  markMeetingManualAction,
} from './actions';
import { LeadDetail } from './LeadDetail';
import { seedEdits as seedEditsBase, missingFor, sectionForStage } from './edit-logic';
import { Dropdown } from '../components/Dropdown';
import { openCalendlyFor, calendlyUrlFor } from './calendly-widget';

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
  landingVisitas: number;
  landingDias: number;
  originChannel: string;       // canal real (Meta / Campaña / Directo), no hardcodeado
  vslPlays: number;            // reproducciones del VSL (vsl_events)
  vslMaxPct: number | null;    // retención máx del VSL (%)
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
};

export type Edits = {
  nombre: string;
  email: string;
  telefono: string;
  empresa: string;
  closer: string;
  setter: string;
  motivo: string;
  fechaJ1: string;   // ISO YYYY-MM-DD (editable al mover a Agenda J1)
  fechaJ2: string;   // ISO YYYY-MM-DD (editable al mover a Agenda J2 / Facturando)
  fathom: FathomLink[];
  nutriciones: { name: string; dt: string }[];
  plan: { total: string; cierre: string; inicio: string; duracion: string };
  cuotas: { monto: string; fecha: string }[];
};

export type PendingMove = { id: number; from: string; to: string; asistioJ1?: boolean; asistioJ2?: boolean };

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
}: {
  leads: CrmLead[];
  stages: Stage[];
  juntas: CrmJunta[];
  marcar: CrmMarcar[];
  transitions: FunnelTransition[];
  total: number;
  errorMsg: string | null;
  hoy: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [view, setView] = useState<'kanban' | 'table'>('kanban');
  const [activeBands, setActiveBands] = useState<Set<StageBand>>(() => new Set<StageBand>(['pipeline', 'nutricion', 'salidas']));
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('todos');
  const [originFilter, setOriginFilter] = useState('todos');
  const [showSinMarcar, setShowSinMarcar] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [moveError, setMoveError] = useState(false);
  const [editsMap, setEditsMap] = useState<Record<number, Edits>>({});
  const [localStage, setLocalStage] = useState<Record<number, string>>({});
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [undoInfo, setUndoInfo] = useState<{ id: number; name: string; from: string; toLabel: string } | null>(null);
  const [contactConfirm, setContactConfirm] = useState<CrmLead | null>(null);
  const [manualNutri, setManualNutri] = useState<{ leadId: number; name: string } | null>(null);
  const [manualMotivo, setManualMotivo] = useState('');
  const [manualDeadline, setManualDeadline] = useState('');
  const [manualMeeting, setManualMeeting] = useState<{ leadId: number; name: string; which: 'agenda' | 'agendaj2' } | null>(null);
  const [mmFecha, setMmFecha] = useState('');
  const [mmAsistio, setMmAsistio] = useState<'si' | 'no' | ''>('si');
  const [meetingChoice, setMeetingChoice] = useState<{ leadId: number; name: string; which: 'agenda' | 'agendaj2' } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<CrmLead | null>(null);
  const [saveError, setSaveError] = useState(false);

  const stageKeys = useMemo(() => new Set(stages.map((s) => s.key)), [stages]);
  const firstKey = stages[0]?.key ?? 'lead';

  const effStage = (l: CrmLead): string => {
    const k = localStage[l.id] ?? l.stage;
    return stageKeys.has(k) ? k : firstKey;
  };

  const seedEdits = (l: CrmLead): Edits => seedEditsBase(l, effStage(l));

  const editsFor = (l: CrmLead): Edits => editsMap[l.id] ?? seedEdits(l);
  const patchEdits = (id: number, patch: Partial<Edits>) =>
    setEditsMap((m) => ({ ...m, [id]: { ...(m[id] ?? seedEdits(leads.find((x) => x.id === id)!)), ...patch } }));

  const openDetail = (l: CrmLead) => {
    // Re-sembrar siempre desde los datos frescos: si quedó un edits viejo en caché
    // (p.ej. tras un reagende de Calendly o asistencia marcada por Fathom), no debe
    // pisar lo nuevo. Limpiar al cerrar/guardar garantiza que acá no haya entrada.
    setEditsMap((m) => (m[l.id] ? m : { ...m, [l.id]: seedEdits(l) }));
    setSelectedId(l.id);
    setPendingMove(null);
    setMoveError(false);
    setSaveError(false);
  };
  const closeDetail = () => {
    if (selectedId != null) setEditsMap((m) => { const n = { ...m }; delete n[selectedId]; return n; });
    setSelectedId(null);
    setPendingMove(null);
    setMoveError(false);
    setSaveError(false);
  };

  // Transición del grafo que define el movimiento `from → to` (si existe). Lleva
  // la asistencia (R1/R2) que ese paso implica, igual que en "Datos sin marcar".
  const transitionFor = (from: string, to: string): FunnelTransition | undefined =>
    transitions.find((t) => t.from === from && t.to === to);

  const persistStage = (id: number, key: string, e: Edits, from?: string, tr?: FunnelTransition) => {
    setLocalStage((m) => ({ ...m, [id]: key }));
    startTransition(async () => {
      await setLeadStageAction(id, key, {
        monto: key === 'ganado' ? Number(e.plan.total) || null : null,
        motivo: key === 'perdido' || key === 'descal' ? e.motivo : null,
        asistio_j1: tr?.asistioJ1,
        asistio_j2: tr?.asistioJ2,
      });
      router.refresh();
    });
    // Toast "Deshacer" (5s) tras concretar un movimiento en el tablero.
    if (from && from !== key) {
      const lead = leads.find((l) => l.id === id);
      setUndoInfo({ id, name: lead?.name ?? `Lead ${id}`, from, toLabel: findStage(stages, key).label });
    }
  };

  // Revertir el último movimiento a su etapa anterior.
  const undoMove = () => {
    if (!undoInfo) return;
    const { id, from } = undoInfo;
    setUndoInfo(null);
    setLocalStage((m) => ({ ...m, [id]: from }));
    startTransition(async () => { await setLeadStageAction(id, from); router.refresh(); });
  };

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
  const needsFicha = (key: string, e: Edits) => missingFor(key, e).length > 0 || !!sectionForStage(key);

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

  const requestStage = (l: CrmLead, key: string) => {
    if (key === effStage(l)) { setPendingMove(null); setMoveError(false); return; }
    // "Nutrición - Manual" SIEMPRE pasa por el modal que exige motivo + deadline.
    if (key === 'manual') { openManualNutri(l.id); setPendingMove(null); setMoveError(false); return; }
    if (calendlyUrlFor(key)) { scheduleViaCalendly(l, key); setPendingMove(null); setMoveError(false); return; }
    const e = editsFor(l);
    const tr = transitionFor(effStage(l), key);
    if (needsFicha(key, e)) {
      setPendingMove({ id: l.id, from: effStage(l), to: key, asistioJ1: tr?.asistioJ1, asistioJ2: tr?.asistioJ2 });
      setMoveError(false);
    } else {
      persistStage(l.id, key, e, effStage(l), tr);
      setPendingMove(null);
      setMoveError(false);
    }
  };

  const handleDrop = (stageKey: string) => {
    const id = dragId;
    setDragId(null);
    if (id == null) return;
    const lead = leads.find((l) => l.id === id);
    if (!lead || effStage(lead) === stageKey) return;
    if (stageKey === 'manual') { openManualNutri(id); return; }
    if (calendlyUrlFor(stageKey)) { scheduleViaCalendly(lead, stageKey); return; }
    const e = editsFor(lead);
    const from = effStage(lead);
    const tr = transitionFor(from, stageKey);
    if (needsFicha(stageKey, e)) {
      openDetail(lead);
      setPendingMove({ id, from, to: stageKey, asistioJ1: tr?.asistioJ1, asistioJ2: tr?.asistioJ2 });
    } else {
      persistStage(id, stageKey, e, from, tr);
    }
  };

  // Resolver un "dato sin marcar": abre la ficha con el pase pendiente (lleva la
  // asistencia que implica la transición) para completar lo obligatorio y guardar.
  const resolveMarcar = (leadId: number, t: FunnelTransition) => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;
    if (calendlyUrlFor(t.to)) { scheduleViaCalendly(lead, t.to); return; }
    openDetail(lead);
    setPendingMove({ id: leadId, from: effStage(lead), to: t.to, asistioJ1: t.asistioJ1, asistioJ2: t.asistioJ2 });
  };

  // "Nutrición - Manual" desde el worklist: pide MOTIVO antes de guardar.
  const openManualNutri = (leadId: number) => {
    const l = leads.find((x) => x.id === leadId);
    setManualMotivo('');
    setManualDeadline('');
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

  // Reunión (R1/R2) ya realizada: marcar a mano (fecha + asistencia), sin Calendly.
  const openManualMeeting = (leadId: number, which: 'agenda' | 'agendaj2') => {
    const l = leads.find((x) => x.id === leadId);
    setMmFecha(''); setMmAsistio('si');
    setManualMeeting({ leadId, name: l?.name ?? 'lead', which });
  };
  const confirmManualMeeting = () => {
    if (!manualMeeting || !mmFecha) return;
    const { leadId, which } = manualMeeting;
    const asistio = mmAsistio === '' ? null : mmAsistio === 'si';
    setManualMeeting(null);
    startTransition(async () => { await markMeetingManualAction(leadId, which, mmFecha, asistio); router.refresh(); });
  };

  // ¿Cambió algún dato de contacto respecto del origen? (gatilla confirmación)
  const contactChanged = (l: CrmLead, e: Edits) => {
    const ph = l.phone === '—' ? '' : l.phone;
    const co = l.company === 'Sin empresa' ? '' : l.company;
    return e.nombre.trim() !== l.name.trim() || e.email.trim() !== l.email.trim() || e.telefono.trim() !== ph.trim() || e.empresa.trim() !== co.trim();
  };

  const persistDetail = (l: CrmLead) => {
    const e = editsFor(l);
    const move = pendingMove && pendingMove.id === l.id ? pendingMove : null;
    setSaveError(false);
    startTransition(async () => {
      try {
        await saveLeadMetaAction(l.id, {
          closer: e.closer, setter: e.setter, fathom_links: e.fathom, motivo_perdida: e.motivo,
          nombre: e.nombre.trim() || undefined, email: e.email.trim() || null,
          telefono: e.telefono.trim() || null, empresa: e.empresa.trim() || null,
          fecha_junta_1: e.fechaJ1 || null, fecha_junta_2: e.fechaJ2 || null,
        });
        if (move) {
          await setLeadStageAction(l.id, move.to, {
            monto: move.to === 'ganado' ? Number(e.plan.total) || null : null,
            motivo: e.motivo,
            asistio_j1: move.asistioJ1,
            asistio_j2: move.asistioJ2,
          });
          setLocalStage((m) => ({ ...m, [l.id]: move.to }));
        }
        router.refresh();
        closeDetail();   // limpia el edits cacheado + cierra solo si TODO salió bien
      } catch {
        // No cerramos: el usuario ve el error y sus cambios siguen en el modal.
        setSaveError(true);
      }
    });
  };

  const saveDetail = (l: CrmLead) => {
    const e = editsFor(l);
    if (pendingMove && pendingMove.id === l.id && missingFor(pendingMove.to, e).length) {
      setMoveError(true);
      return;
    }
    if (contactChanged(l, e)) { setContactConfirm(l); return; } // contacto: pedir confirmación
    persistDetail(l);
  };

  // Borrar es irreversible: lo confirmamos en un diálogo aparte (como el de contacto).
  const confirmRemove = () => {
    if (!deleteConfirm) return;
    const id = deleteConfirm.id;
    setDeleteConfirm(null);
    setSaveError(false);
    startTransition(async () => {
      try {
        await deleteLeadInlineAction(id);
        router.refresh();
        closeDetail();
      } catch {
        setSaveError(true);
      }
    });
  };

  // Opciones contextuales del worklist: las transiciones salientes de la etapa
  // actual del lead, filtradas por coherencia de asistencia ya marcada.
  const optionsForMarcar = (m: CrmMarcar): FunnelTransition[] => {
    const lead = leads.find((l) => l.id === m.leadId);
    if (!lead) return [];
    // Opciones según la posición REAL en el funnel (derivada de los datos), no
    // según el override manual (ej. un lead parkeado en "Nutrición - Manual" igual
    // muestra los pasos que le corresponden por su etapa real).
    // !t.auto: excluye nutriciones automáticas (ej. Post Agenda, que corre antes
    // de la reunión) — no son resultados que el humano elija acá.
    let opts = transitionsFrom(transitions, lead.derivedStage).filter((t) => !t.auto);
    if (lead.asistioJ1 === true) opts = opts.filter((t) => t.asistioJ1 !== false);
    if (lead.asistioJ2 === true) opts = opts.filter((t) => t.asistioJ2 !== false);
    return opts;
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
        style={{ flex: 'none', width: 282, background: dragOverCol === c.key && dragId != null ? 'var(--surface-2)' : 'var(--surface)', border: '1px solid ' + (dragOverCol === c.key && dragId != null ? 'var(--accent)' : 'var(--border)'), borderTop: '3px solid ' + bandC, borderRadius: 16, display: 'flex', flexDirection: 'column', maxHeight: '68vh', transition: 'background .15s, border-color .15s, box-shadow .15s', boxShadow: dragOverCol === c.key && dragId != null ? '0 0 0 3px var(--accent-soft)' : 'none' }}
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
                onDragEnd={() => { setDragId(null); setDragOverCol(null); }}
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderLeft: overdueManual ? '3px solid var(--bad)' : waiting ? '3px solid var(--warn-fill)' : '1px solid var(--border)', borderRadius: 11, padding: '13px 14px', cursor: 'grab', transition: 'opacity .15s, transform .15s, box-shadow .15s', opacity: dragId === l.id ? 0.5 : 1, transform: dragId === l.id ? 'scale(0.97)' : 'none', boxShadow: dragId === l.id ? '0 10px 26px rgba(23,21,17,.20)' : 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.25, minWidth: 0 }}>{l.name}</div>
                  {overdueManual
                    ? <span title="Venció el deadline de la nutrición manual" style={{ flex: 'none', fontSize: 10.5, fontWeight: 700, color: 'var(--bad)', background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 999, padding: '1px 7px', whiteSpace: 'nowrap' }}>● vencida</span>
                    : waiting && <span title="Esperando que marques cómo quedó" style={{ flex: 'none', fontSize: 10.5, fontWeight: 700, color: 'var(--warn)', background: 'var(--warn-bg)', border: '1px solid var(--warn-fill)', borderRadius: 999, padding: '1px 7px', whiteSpace: 'nowrap' }}>✋ te espera</span>}
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
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
          <h1 style={{ fontWeight: 600, fontSize: 46, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>CRM</h1>
          <span style={{ fontSize: 15, color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>{filtered.length} de {total} leads</span>
        </div>
        <Link href="/leads/new" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 19px', borderRadius: 11, background: 'var(--ink)', color: '#F3F0E7', fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>+ Nuevo lead</Link>
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
                    style={{ flex: 'none', fontSize: 12, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none', cursor: 'pointer' }}
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
          <button onClick={() => setShowSinMarcar((v) => !v)} style={sinMarcarBtnStyle}>{sinMarcarBtnLabel}</button>
        </div>
      </div>

      {/* DATOS SIN MARCAR */}
      {showSinMarcar ? (
        <SinMarcar marcar={marcar} optionsFor={optionsForMarcar} onResolve={resolveMarcar} onManualNutri={openManualNutri} stageLabel={(k) => findStage(stages, k).label} />
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
          <div style={{ flex: 1, minHeight: 0, overflowX: 'auto', paddingBottom: 14 }}>
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
                  <div style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--accent)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.name}</div>
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
        <LeadDetail
          lead={selected}
          stages={stages}
          effStage={effStage(selected)}
          pendingMove={pendingMove && pendingMove.id === selected.id ? pendingMove : null}
          moveError={moveError}
          edits={editsFor(selected)}
          missing={pendingMove && pendingMove.id === selected.id ? missingFor(pendingMove.to, editsFor(selected)) : []}
          focus={pendingMove && pendingMove.id === selected.id ? sectionForStage(pendingMove.to) : undefined}
          onPatch={(patch) => patchEdits(selected.id, patch)}
          onPickStage={(key) => requestStage(selected, key)}
          onClose={closeDetail}
          onSave={() => saveDetail(selected)}
          onDelete={() => setDeleteConfirm(selected)}
          onSchedule={(key) => scheduleViaCalendly(selected, key)}
          saveError={saveError}
        />
      )}

      {/* Confirmación de borrado (irreversible) */}
      {deleteConfirm && (
        <div onClick={() => setDeleteConfirm(null)} style={{ position: 'fixed', inset: 0, zIndex: 110, background: 'rgba(23,21,17,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 440, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 30px 70px rgba(23,21,17,.35)', padding: '22px 24px' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>Borrar lead</div>
            <div style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.5 }}>Vas a borrar definitivamente a <b style={{ color: 'var(--ink)' }}>{deleteConfirm.name}</b> y todo su historial. <b style={{ color: 'var(--bad)' }}>No se puede deshacer.</b></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>Cancelar</button>
              <button onClick={confirmRemove} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: 'var(--bad)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>Borrar definitivamente</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmación al editar datos de contacto */}
      {contactConfirm && (
        <div onClick={() => setContactConfirm(null)} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(23,21,17,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 440, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 30px 70px rgba(23,21,17,.35)', padding: '22px 24px' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>Confirmar cambios de contacto</div>
            <div style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.5 }}>Vas a editar datos de contacto (nombre, email, teléfono o empresa) de <b style={{ color: 'var(--ink)' }}>{contactConfirm.name}</b>. Normalmente se sincronizan del origen (Meta/Calendly); un cambio manual puede desincronizarse.</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button onClick={() => setContactConfirm(null)} style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>Cancelar</button>
              <button onClick={() => { const l = contactConfirm; setContactConfirm(null); persistDetail(l); }} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: 'var(--accent-soft)', color: '#171511', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>Confirmar y guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmación: motivo de la nutrición manual */}
      {manualNutri && (
        <div onClick={() => setManualNutri(null)} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(23,21,17,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 30px 70px rgba(23,21,17,.35)', padding: '22px 24px' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>Nutrición manual — {manualNutri.name}</div>
            <div style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.5, marginBottom: 12 }}>Contá el motivo y poné una fecha límite. Si llega esa fecha sin que el lead avance, vuelve a &quot;datos sin marcar&quot; en rojo.</div>
            <textarea value={manualMotivo} onChange={(e) => setManualMotivo(e.target.value)} autoFocus placeholder="Ej: pidió que lo contactemos en 2 meses; está cerrando presupuesto…" style={{ width: '100%', minHeight: 84, resize: 'vertical', padding: '12px 14px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, lineHeight: 1.5, outline: 'none' }} />
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>Fecha límite para concluir</div>
              <input type="date" value={manualDeadline} min={hoy} onChange={(e) => setManualDeadline(e.target.value)} style={{ width: '100%', padding: '11px 14px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button onClick={() => setManualNutri(null)} style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>Cancelar</button>
              <button onClick={confirmManualNutri} disabled={!manualMotivo.trim() || !manualDeadline} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: manualMotivo.trim() && manualDeadline ? 'var(--accent-soft)' : 'var(--border)', color: '#171511', fontSize: 14, fontWeight: 700, cursor: manualMotivo.trim() && manualDeadline ? 'pointer' : 'default', opacity: manualMotivo.trim() && manualDeadline ? 1 : 0.6, fontFamily: SANS }}>Guardar nutrición manual</button>
            </div>
          </div>
        </div>
      )}

      {/* ¿La reunión ya ocurrió o se va a agendar? Paso previo a Calendly */}
      {meetingChoice && (
        <div onClick={() => setMeetingChoice(null)} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(23,21,17,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 30px 70px rgba(23,21,17,.35)', padding: '22px 24px' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>Reunión {meetingChoice.which === 'agenda' ? 'R1' : 'R2'} — {meetingChoice.name}</div>
            <div style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.5, marginBottom: 18 }}>¿Ya tuviste esta {meetingChoice.which === 'agenda' ? 'R1' : 'R2'} o la querés agendar?</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => { const c = meetingChoice; setMeetingChoice(null); openManualMeeting(c.leadId, c.which); }}
                style={{ width: '100%', padding: '13px 16px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: SANS, textAlign: 'left' }}
              >
                <div>Ya la tuve</div>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--dim)', marginTop: 2 }}>Marcar fecha y asistencia a mano (sin Calendly)</div>
              </button>
              <button
                onClick={() => { const c = meetingChoice; setMeetingChoice(null); const l = leads.find((x) => x.id === c.leadId); if (l) doOpenCalendly(l, c.which); }}
                style={{ width: '100%', padding: '13px 16px', borderRadius: 11, border: '1px solid var(--accent)', background: 'rgba(200,135,12,.08)', color: '#9A6A09', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: SANS, textAlign: 'left' }}
              >
                <div>📅 Agendarla por Calendly</div>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: '#9A6A09', opacity: 0.85, marginTop: 2 }}>Abrir Calendly para reservar fecha</div>
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setMeetingChoice(null)} style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: 'transparent', color: 'var(--dim)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Marcar reunión (R1/R2) a mano — para casos viejos cuya reunión ya ocurrió */}
      {manualMeeting && (
        <div onClick={() => setManualMeeting(null)} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(23,21,17,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 30px 70px rgba(23,21,17,.35)', padding: '22px 24px' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>Marcar {manualMeeting.which === 'agenda' ? 'R1' : 'R2'} manual — {manualMeeting.name}</div>
            <div style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.5, marginBottom: 16 }}>La reunión ya ocurrió. Registrala a mano (sin Calendly) para avanzar el lead.</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>¿Cuándo fue?</div>
            <input type="date" value={mmFecha} onChange={(e) => setMmFecha(e.target.value)} style={{ width: '100%', padding: '11px 14px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none' }} />
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', margin: '16px 0 6px' }}>¿Asistió?</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {([['si', 'Sí'], ['no', 'No'], ['', 'No sé']] as const).map(([v, lbl]) => (
                <button key={lbl} onClick={() => setMmAsistio(v)} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: `1px solid ${mmAsistio === v ? 'var(--ink)' : 'var(--border-strong)'}`, background: mmAsistio === v ? 'var(--ink)' : 'var(--surface)', color: mmAsistio === v ? 'var(--surface)' : 'var(--dim)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>{lbl}</button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button onClick={() => setManualMeeting(null)} style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>Cancelar</button>
              <button onClick={confirmManualMeeting} disabled={!mmFecha} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: mmFecha ? 'var(--accent-soft)' : 'var(--border)', color: '#171511', fontSize: 14, fontWeight: 700, cursor: mmFecha ? 'pointer' : 'default', opacity: mmFecha ? 1 : 0.6, fontFamily: SANS }}>Guardar reunión</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Deshacer (5s) tras mover una card en el tablero */}
      {undoInfo && (
        <div style={{ position: 'fixed', left: '50%', bottom: 28, transform: 'translateX(-50%)', zIndex: 70, display: 'flex', alignItems: 'center', gap: 14, background: '#171511', color: '#F3F0E7', padding: '12px 16px', borderRadius: 12, boxShadow: '0 12px 32px rgba(23,21,17,.35)', fontFamily: SANS, fontSize: 14 }}>
          <span><strong>{undoInfo.name}</strong> → {undoInfo.toLabel}</span>
          <button type="button" onClick={undoMove} style={{ background: 'transparent', border: '1px solid rgba(243,240,231,.35)', color: 'var(--accent-soft)', fontWeight: 600, fontSize: 13.5, padding: '6px 12px', borderRadius: 9, cursor: 'pointer', fontFamily: SANS }}>↶ Deshacer</button>
          <button type="button" onClick={() => setUndoInfo(null)} aria-label="cerrar" style={{ background: 'transparent', border: 'none', color: 'rgba(243,240,231,.6)', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>
      )}
    </main>
  );
}

// ── Datos sin marcar (worklist) ──
function SinMarcar({
  marcar, optionsFor, onResolve, onManualNutri, stageLabel,
}: {
  marcar: CrmMarcar[];
  optionsFor: (m: CrmMarcar) => FunnelTransition[];
  onResolve: (leadId: number, t: FunnelTransition) => void;
  onManualNutri: (leadId: number) => void;
  stageLabel: (key: string) => string;
}) {
  // Intención del movimiento, para distinguir claramente nutrir vs dar de baja.
  const intent = (cat: FunnelTransition['category']) => (cat === 'avanza' ? 'avanza en el pipeline' : cat === 'nutricion' ? 'sigue en nutrición' : 'se da de baja');
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--bad)', borderRadius: 16, padding: 'var(--card-pad)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <h2 style={{ fontWeight: 600, fontSize: 23, letterSpacing: '-0.015em', margin: 0, color: 'var(--ink)' }}>Datos sin marcar</h2>
        <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: 'var(--bad-bg)', border: '1px solid var(--bad)', color: 'var(--bad)' }}>{marcar.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {marcar.map((m) => {
          const options = optionsFor(m);
          // Al elegir una reunión (R1/R2) salta un pop-up que pregunta si ya ocurrió
          // o se agenda — no hace falta una opción aparte acá.
          // "Nutrición - Manual" SIEMPRE disponible (pide motivo antes de guardar).
          const ddOptions = [
            ...options.map((opt, i) => ({ value: String(i), label: stageLabel(opt.to), sub: intent(opt.category), color: CATEGORY[opt.category].c })),
            { value: 'MANUAL', label: 'Nutrición - Manual', sub: 'sigue en nutrición · pide motivo', color: CATEGORY.nutricion.c },
          ];
          return (
            <div key={m.id} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '15px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 240, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--ink)' }}>{m.name}</div>
                  <div style={{ fontSize: 13.5, color: 'var(--dim)', marginTop: 2 }}>{m.company ? m.company + ' · ' : ''}{m.message}</div>
                </div>
                <Dropdown
                  value=""
                  resetAfterSelect
                  align="right"
                  width={232}
                  placeholder="Mover a…"
                  ariaLabel={'Mover a ' + m.name}
                  onChange={(v) => {
                    if (v === 'MANUAL') { onManualNutri(m.leadId); return; }
                    const t = options[Number(v)]; if (t) onResolve(m.leadId, t);
                  }}
                  options={ddOptions}
                />
              </div>
            </div>
          );
        })}
        {marcar.length === 0 && <div style={{ padding: 36, textAlign: 'center', color: 'var(--good)', fontSize: 15.5, fontWeight: 600 }}>✓ Todo marcado — datos al día.</div>}
      </div>
    </div>
  );
}

// La gestión de etapas y transiciones vive ahora en la tab /funnel (FunnelEditor).
