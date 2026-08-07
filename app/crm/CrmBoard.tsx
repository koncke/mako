'use client';

// =============================================================================
// CrmBoard — tablero del CRM (rediseño Marketing OS)
// =============================================================================
// Réplica fiel del prototipo (Dashboard CRM.dc.html) sobre datos reales de
// Supabase. Persisten: mover de etapa, Closer, Setter, links de Fathom, motivo
// y borrar lead (server actions). Plan de pagos / cuotas / nutrición se editan
// en sesión (no se persisten en esta iteración).

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  CHIP,
  CATEGORY,
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
  ignorarPendientesAction,
  ignorarPendientesMasaAction,
  reagendarReunionAction,
  permisoCalendarioAction,
} from './actions';
import type { ReagendarResultado } from './actions';
import { ImportarLeadsModal } from './ImportarLeadsModal';
import { ExportarLeadsModal } from './ExportarLeadsModal';
import { LeadEditModal } from './LeadEditModal';
import { CrmAutoToggle } from './CrmAutoToggle';
import { StageMoveDialog, leadToMoveInfo, type StageMoveTarget } from './StageMoveDialog';
import { SelectorHora, horaLegible } from './SelectorHora';
import type { Step } from '@/lib/stage-requirements';
import type { MiembroEquipo } from './actions';
import { WizardShell, wizardInput } from '@/app/_components/WizardShell';
import { ConfirmDialog } from '@/app/components/ConfirmDialog';
import { sectionForStage } from './edit-logic';
import { missingForStage, funnelReqInfo } from '@/lib/stage-requirements';
import { coincideBusqueda } from '@/lib/buscar-texto';
import { Dropdown, type DropdownOption } from '../components/Dropdown';
import { openCalendlyFor, calendlyUrlFor } from './calendly-widget';
import { Icon } from '../_components/icons';
import {
  AccionesHeader,
  BandasToggle,
  Buscador,
  ConteoLeads,
  CrmFilterMenu,
  CrmToolbarStyles,
  DivisorHeader,
  FiltroChips,
  SinResultados,
  VistaSelector,
  type CrmVista,
  type FiltroAbierto,
  type FiltroCat,
} from './CrmToolbar';

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
  tipo: 'A' | 'B' | 'C' | 'M' | 'R';   // A=faltan datos  M=nutrición manual vencida  R=reunión pasada sin desenlace
  /** true = solo faltan datos estáticos (tel/empresa/detalle): se editan, no wizard. */
  soloEdit?: boolean;
  /** Dónde resolver: wizard, Deal Details (cobranza), Meetings, o Editar. */
  solTab?: 'wizard' | 'cobranza' | 'reuniones' | 'edit';
  /** Lista exacta de datos faltantes (para el wizard in-place, pasada única). */
  faltantes?: Step[];
};

const fmt = (n: number) => '$' + n.toLocaleString('en-US');

/** Una confirmación pendiente: qué se va a cambiar, dicho concreto. */
type Confirmacion = {
  titulo: string;
  mensaje: ReactNode;
  confirmLabel: string;
  /** `primary` para lo que avanza el pipeline; `danger` para lo que silencia o pierde. */
  tono?: 'danger' | 'primary';
  onOk: () => void;
};

/** Las salidas del form "¿Qué hacer ahora?" (una por opción del primer paso). */
type QhOpcion = 'reprog' | 'noasistio' | 'mover' | 'perdido' | 'nutrir';

/** Resumen "dato → valor" de un paso de confirmación. El mismo en todos los wizards. */
function ResumenFilas({ filas }: { filas: Array<[string, string]> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {filas.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13.5, padding: '10px 13px', background: 'var(--surface-2)', borderRadius: 10, textAlign: 'left' }}>
          <span style={{ color: 'var(--dim)' }}>{k}</span>
          <span style={{ color: 'var(--ink)', fontWeight: 600, textAlign: 'right' }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

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
  // Multi-selección: el set VACÍO significa "todas" (no hay valor centinela 'todos').
  const [stageFilter, setStageFilter] = useState<Set<string>>(() => new Set());
  const [originFilter, setOriginFilter] = useState<Set<string>>(() => new Set());
  const [filtroAbierto, setFiltroAbierto] = useState<FiltroAbierto>(null);
  // ?pendientes=1 mantiene el worklist abierto: al volver de una ficha (Solucionar)
  // se restaura la vista de "Datos sin marcar" con su scroll (restauración de Next).
  const [showSinMarcar, setShowSinMarcar] = useState(sp.get('pendientes') === '1');
  // "Pendientes" es una VISTA más (reemplaza el tablero entero), así que vive en el
  // mismo selector que Kanban/Tabla. El query param se mantiene: es el que hace que
  // volver de una ficha te devuelva al worklist y no al tablero.
  const irSinMarcar = (abrir: boolean) => {
    if (abrir === showSinMarcar) return;
    setShowSinMarcar(abrir);
    const params = new URLSearchParams(sp.toString());
    if (abrir) params.set('pendientes', '1'); else params.delete('pendientes');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const vista: CrmVista = showSinMarcar ? 'pendientes' : view === 'kanban' ? 'kanban' : 'tabla';
  const cambiarVista = (v: CrmVista) => {
    if (v === 'pendientes') { irSinMarcar(true); return; }
    irSinMarcar(false);
    setView(v === 'kanban' ? 'kanban' : 'table');
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
  // "¿Qué hacer ahora?": lo usan DOS pendientes distintos — la nutrición manual
  // vencida (M) y la reunión que ya pasó sin desenlace (R). Cada uno necesita su
  // copy y sus salidas propias (nuevo plazo vs. reagendar la reunión).
  const [queHacer, setQueHacer] = useState<{ leadId: number; name: string; tipo: 'M' | 'R'; cual: 'r1' | 'r2' } | null>(null);
  const [qhPaso, setQhPaso] = useState(0);
  const [qhOpcion, setQhOpcion] = useState<QhOpcion | null>(null);
  const [qhEtapa, setQhEtapa] = useState('');     // etapa destino (mover / no asistió)
  const [qhPlazo, setQhPlazo] = useState('');     // nuevo deadline de nutrición manual
  const [reagFecha, setReagFecha] = useState('');
  const [reagHora, setReagHora] = useState('');
  // Qué puede hacer la agenda conectada (null = todavía no se sabe). Se consulta
  // al abrir el modal: hay que poder AVISAR que el permiso es de solo lectura
  // antes de reagendar, no después de que el invitado nunca se enteró.
  const [reagCal, setReagCal] = useState<{ conectado: boolean; puedeMover: boolean } | null>(null);
  // Qué pasó realmente con el evento del calendario, ya reagendado en el CRM.
  const [reagOut, setReagOut] = useState<ReagendarResultado | null>(null);
  // modo 'pasada' = ya ocurrió (pide asistencia); 'futura' = ya está agendada
  // por fuera de Calendly pero todavía no se tuvo (solo fecha).
  const [manualMeeting, setManualMeeting] = useState<{ leadId: number; name: string; which: 'agenda' | 'agendaj2'; modo: 'pasada' | 'futura' } | null>(null);
  const [mmFecha, setMmFecha] = useState('');
  const [mmAsistio, setMmAsistio] = useState<'si' | 'no' | ''>('si');
  const [mmNota, setMmNota] = useState('');   // por qué se agendó fuera de Calendly (excepción)
  const [mmPaso, setMmPaso] = useState(0);    // wizard: 0=fecha, 1=asistencia (pasada) / motivo (futura)
  const [meetingChoice, setMeetingChoice] = useState<{ leadId: number; name: string; which: 'agenda' | 'agendaj2' } | null>(null);

  // ── Confirmación única del tablero ──────────────────────────────────────────
  // Pedido textual del dueño: «siempre tiene que saltar una confirmación, y más
  // si se le va a cambiar algo a un lead». Todo lo que MODIFICA un lead sin pasar
  // por un wizard (arrastrar una card, ignorar, las acciones en lote) entra por
  // acá. El texto dice el cambio CONCRETO — "Mover a Ganado a Alan Grza" —, no un
  // "¿Estás seguro?" que no informa nada y se clickea sin leer.
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null);

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
    const revertir = () => {
      setLocalStage((m) => { const n = { ...m }; if (from) n[id] = from; else delete n[id]; return n; });
      setUndoInfo(null);
    };
    startTransition(async () => {
      try {
        const r = await setLeadStageAction(id, key, { asistio_j1: tr?.asistioJ1, asistio_j2: tr?.asistioJ2 });
        // El server ve datos faltantes que el board no vio (una edición en otra
        // pestaña, un funnel que cambió). Antes esto era un throw y la card volvía
        // sola sin explicación: ahora se revierte y se abre el wizard que los pide.
        if (!r.ok) {
          revertir();
          const lead = leads.find((l) => l.id === id);
          if (lead) openStageMove(lead, { to: key, asistioJ1: tr?.asistioJ1, asistioJ2: tr?.asistioJ2 });
        }
      } catch {
        // Falla real (red/permisos): revertir el optimista y limpiar el toast de
        // deshacer. router.refresh() resincroniza con la verdad.
        revertir();
      }
      router.refresh();
    });
    // Toast "Deshacer" (5s) tras concretar un movimiento en el tablero.
    if (from && from !== key) {
      const lead = leads.find((l) => l.id === id);
      setUndoInfo({ id, name: lead?.name ?? `Lead ${id}`, from, toLabel: findStage(stages, key).label, monto: lead?.monto || null, motivo: lead?.motivo || null });
    }
  };

  // Abrir "¿Qué hacer ahora?" limpio. Para el pendiente de reunión (R) además
  // pregunta si la agenda puede mover eventos: el chequeo pega contra Google, así
  // que se hace acá (una vez, al abrir) y no en cada render de la lista.
  const abrirQueHacer = (id: number) => {
    const l = leads.find((x) => x.id === id);
    const m = marcar.find((x) => x.leadId === id);
    const tipo = m?.tipo === 'R' ? 'R' : 'M';
    setReagFecha(''); setReagHora(''); setReagOut(null); setReagCal(null);
    setQhPaso(0); setQhOpcion(null); setQhEtapa(''); setQhPlazo(''); setQhError(null);
    setQueHacer({ leadId: id, name: l?.name ?? 'lead', tipo, cual: l && effStage(l) === 'agendaj2' ? 'r2' : 'r1' });
    if (tipo === 'R') void permisoCalendarioAction().then(setReagCal).catch(() => setReagCal(null));
  };
  const cerrarQueHacer = () => { setQueHacer(null); setReagOut(null); setReagCal(null); setQhOpcion(null); setQhPaso(0); };

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
  // La ÚLTIMA banda encendida no se puede apagar: quedaba el tablero sin una sola
  // columna y nada en pantalla explicaba por qué — un estado muerto del que había
  // que adivinar cómo salir.
  const toggleBand = (band: StageBand) => {
    setActiveBands((prev) => {
      if (prev.has(band) && prev.size === 1) return prev;
      const n = new Set(prev); if (n.has(band)) n.delete(band); else n.add(band); return n;
    });
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
    if (needsFicha(lead, stageKey)) { openStageMove(lead, { to: stageKey, asistioJ1: tr?.asistioJ1, asistioJ2: tr?.asistioJ2 }); return; }
    // Arrastrar una card es el gesto más fácil de hacer sin querer del tablero, y
    // hasta acá cambiaba la etapa del lead al soltar, sin preguntar nada. Ahora
    // pasa por la confirmación, que dice el movimiento exacto.
    const destino = findStage(stages, stageKey).label;
    const origen = findStage(stages, from).label;
    setConfirmacion({
      titulo: `Mover a ${destino} a ${lead.name}`,
      mensaje: <>Pasa de <b>{origen}</b> a <b>{destino}</b>. Queda registrado en el historial del lead y vas a poder deshacerlo.</>,
      confirmLabel: `Mover a ${destino}`,
      tono: 'primary',
      onOk: () => persistStage(id, stageKey, from, tr),
    });
  };

  // "Solucionar" un dato sin marcar → abre el wizard IN-PLACE (pop-up), sin salir
  // del kanban. La pasada única resuelve TODO (reuniones/venta/higiene + Deal
  // Details + documentos + respuestas R2). El paso final ofrece ver la ficha o salir.
  const solucionarMarcar = (leadId: number) => {
    const l = leads.find((x) => x.id === leadId);
    if (!l) { router.push(`/crm/${leadId}?solucionar=1`); return; }
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

  // ── "¿Qué hacer ahora?" — el form de a UNA pregunta ─────────────────────────
  // Era un modal armado a mano: una caja de reagendar arriba, una fila de chips de
  // etapas abajo y un "Cancelar" perdido — tres decisiones distintas en la misma
  // pantalla, con un aspecto que no se parecía a ningún otro formulario de la app.
  // Ahora es el mismo WizardShell del resto: qué pasó → el dato que haga falta →
  // confirmar. Las opciones son botones grandes; no se tipea nada evitable.
  const [qhError, setQhError] = useState<string | null>(null);

  /** ISO + n días (para los plazos de un toque de la nutrición). */
  const masDiasISO = (iso: string, d: number) => {
    const t = new Date(`${iso}T00:00:00Z`);
    t.setUTCDate(t.getUTCDate() + d);
    return t.toISOString().slice(0, 10);
  };

  // Etapas a las que se puede mandar el lead: el pipeline primero, las salidas
  // después. La nutrición queda afuera: tiene su propia opción ("seguir nutriendo").
  const etapasDestino = useMemo(() => {
    const orden = (b: StageBand) => (b === 'pipeline' ? 0 : b === 'salidas' ? 1 : 2);
    return stages
      .filter((s) => s.key !== 'lead' && (s.band ?? 'pipeline') !== 'nutricion')
      .sort((a, b) => orden(a.band ?? 'pipeline') - orden(b.band ?? 'pipeline') || ((a.col ?? 0) - (b.col ?? 0)));
  }, [stages]);
  const hayPerdido = stages.some((s) => s.key === 'perdido');

  const qhPasos: Array<'que' | 'detalle' | 'resumen'> =
    ['que', ...(qhOpcion && qhOpcion !== 'perdido' ? (['detalle'] as const) : []), 'resumen'];
  const qhPasoId = qhPasos[Math.min(qhPaso, qhPasos.length - 1)];
  const qhPuede =
    qhPasoId === 'que' ? qhOpcion != null
    : qhPasoId === 'detalle'
      ? (qhOpcion === 'reprog' ? !!reagFecha && !!reagHora : qhOpcion === 'nutrir' ? !!qhPlazo : !!qhEtapa)
      : true;

  const confirmarQueHacer = () => {
    if (!queHacer || !qhOpcion) return;
    setQhError(null);
    const { leadId, cual } = queHacer;
    const l = leads.find((x) => x.id === leadId);

    // Reagendar: el modal NO se cierra — mover el evento en Google es la mitad del
    // trabajo y su resultado se cuenta acá mismo, en el paso siguiente.
    if (qhOpcion === 'reprog') {
      // El ISO se arma en el navegador: la hora queda en la zona horaria del que
      // la carga y no hay que adivinar el huso.
      const at = new Date(`${reagFecha}T${reagHora}`).toISOString();
      startTransition(async () => {
        try { setReagOut(await reagendarReunionAction(leadId, cual, reagFecha, at)); router.refresh(); }
        catch (e) { setQhError(e instanceof Error ? e.message : 'No se pudo reagendar.'); }
      });
      return;
    }

    if (qhOpcion === 'nutrir') {
      const plazo = qhPlazo;
      cerrarQueHacer();
      setLocalStage((m) => ({ ...m, [leadId]: 'manual' }));
      startTransition(async () => {
        await markManualNutritionAction(leadId, 'Se extendió el plazo de la nutrición manual', plazo);
        router.refresh();
      });
      return;
    }

    // Mover / no asistió / se perdió: el destino lo resuelve el wizard de etapa,
    // que ya sabe pedir lo que falte (motivo, monto, asistencias) y confirma solo.
    const destino = qhOpcion === 'perdido' ? 'perdido' : qhEtapa;
    cerrarQueHacer();
    if (!l || !destino) return;
    const tr = transitionFor(effStage(l), destino);
    const move: StageMoveTarget = { to: destino, asistioJ1: tr?.asistioJ1, asistioJ2: tr?.asistioJ2 };
    // "No asistió" es un dato del lead, no solo un movimiento: viaja con la move.
    if (qhOpcion === 'noasistio') {
      if (cual === 'r2') move.asistioJ2 = false; else move.asistioJ1 = false;
    }
    openStageMove(l, move);
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
  // Cada categoría es un Set: vacío = sin filtrar (todas). Con valores, el lead pasa
  // si coincide con CUALQUIERA de los elegidos (OR dentro de la categoría, AND entre
  // categorías) — es lo que espera cualquiera que marque tres etapas a la vez.
  const matches = (l: CrmLead) => {
    // Buscar como busca una persona (sin acentos, por palabras sueltas, por #id):
    // la regla vive en lib/buscar-texto, no acá — ver «Una cosa, un lugar».
    if (!coincideBusqueda([l.id, l.name, l.company, l.email, l.phone], search)) return false;
    if (stageFilter.size > 0 && !stageFilter.has(effStage(l))) return false;
    if (originFilter.size > 0 && !originFilter.has(l.origin)) return false;
    return true;
  };
  const filtered = leads.filter(matches);
  const originOptions = useMemo(() => [...new Set(leads.map((l) => l.origin))].filter(Boolean).sort((a, b) => a.localeCompare(b)), [leads]);
  const hayFiltros = stageFilter.size > 0 || originFilter.size > 0 || search.trim().length > 0;
  const limpiarTodo = () => { setStageFilter(new Set()); setOriginFilter(new Set()); setSearch(''); };
  const abrirFiltro = (cat: FiltroCat) => setFiltroAbierto(cat);

  // ── worklist "datos sin marcar" ──
  const marcarPending = marcar.length;

  const selected = selectedId != null ? leads.find((l) => l.id === selectedId) ?? null : null;

  // Leads que esperan tu validación (los que están en "Datos sin marcar").
  const pendingLeadIds = new Set(marcar.map((m) => m.leadId));
  const KANBAN_BANDS: StageBand[] = ['pipeline', 'nutricion', 'salidas'];

  // Importar / exportar leads: MISMO patrón que el board del plan — un botón de
  // icono que abre un formulario de a una pregunta (nada de bajar todo de una ni
  // de abrir el buscador de archivos del sistema sin avisar qué va a pasar).
  const [exportar, setExportar] = useState(false);
  const [importar, setImportar] = useState(false);
  const [flashCsv, setFlashCsv] = useState<string | null>(null);

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
      <CrmToolbarStyles />

      {/* HEADER — título a la izquierda, UN solo clúster de acciones a la derecha.
          El conteo "N de M" se fue a la barra: es el resultado de los filtros, no
          parte del nombre de la pantalla. */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <span style={{ display: 'inline-flex', flex: 'none', color: 'var(--accent)' }}><Icon name="crm" size={34} /></span>
          {/* clamp(): los estilos inline no tienen @media, y a 46px fijos el título se
              salía de la pantalla en mobile. */}
          <h1 style={{ fontWeight: 600, fontSize: 'clamp(30px, 6vw, 46px)', letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>CRM</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <CrmAutoToggle />
          <DivisorHeader />
          <AccionesHeader total={total} onImportar={() => setImportar(true)} onExportar={() => setExportar(true)} />
        </div>
      </header>

      {errorMsg && (
        <div style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 13, padding: '14px 18px', marginBottom: 14, color: 'var(--bad)', fontSize: 14 }}>
          No se pudo leer Supabase: <span style={{ fontFamily: MONO }}>{errorMsg}</span>
        </div>
      )}

      {/* Resultado de la última importación (se cierra al tocarlo). */}
      {flashCsv && (
        <button type="button" onClick={() => setFlashCsv(null)}
          style={{ display: 'block', width: '100%', textAlign: 'left', background: 'var(--good-bg)', border: '1px solid var(--good)', borderRadius: 13, padding: '13px 18px', marginBottom: 14, color: 'var(--good)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>
          {flashCsv}
        </button>
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

      {/* TOOLBAR — fila 1: vista · buscar · filtrar ····· bandas · conteo.
          nowrap + flex:'none' en cada control + UN solo elástico. Nada de
          marginLeft:'auto' acá: al envolver deja un hueco del ancho de la fila. */}
      <div className="crm-tb" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'nowrap', minWidth: 0, marginBottom: 16 }}>
        <VistaSelector vista={vista} onVista={cambiarVista} pendientes={marcarPending} />
        {/* Buscar, filtrar y el conteo describen la LISTA de leads. En "Pendientes" no
            hay lista de leads sino un worklist con su propia lógica: dejarlos ahí era
            ofrecer controles que no hacían nada. */}
        {vista !== 'pendientes' && <>
          <Buscador value={search} onChange={setSearch} />
          <CrmFilterMenu
            stages={stages}
            etapas={stageFilter} setEtapas={setStageFilter}
            origenes={originOptions} origen={originFilter} setOrigen={setOriginFilter}
            abierto={filtroAbierto} setAbierto={setFiltroAbierto}
          />
        </>}
        <span className="crm-tb-elastico" style={{ flex: 1 }} />
        {/* Las bandas son una propiedad del KANBAN (qué columnas se ven), no un filtro
            de datos: solo existen en esa vista y por eso no viven en el menú. */}
        {vista === 'kanban' && (
          <BandasToggle
            bandas={activeBands}
            onToggle={toggleBand}
            conteo={(band) => filtered.filter((l) => (stages.find((s) => s.key === effStage(l))?.band ?? 'pipeline') === band).length}
          />
        )}
        {vista !== 'pendientes' && <ConteoLeads visibles={filtered.length} total={total} />}
      </div>

      {/* Fila 2 — solo si hay filtros activos (el buscador no genera chip). */}
      {vista !== 'pendientes' && (
        <FiltroChips
          stages={stages}
          etapas={stageFilter} setEtapas={setStageFilter}
          origen={originFilter} setOrigen={setOriginFilter}
          onAbrir={abrirFiltro}
        />
      )}

      {/* DATOS SIN MARCAR */}
      {showSinMarcar ? (
        <SinMarcar
          marcar={marcar}
          equipo={equipo}
          onSolucionar={solucionarMarcar}
          onQueHacer={(id) => abrirQueHacer(id)}
          onBulkDone={() => router.refresh()}
        />
      ) : view === 'kanban' ? (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Sin resultados el kanban quedaba mudo (solo la tabla avisaba): se veían
              las columnas vacías y no había forma de saber que era por un filtro. */}
          {filtered.length === 0 ? (
            <SinResultados hayFiltros={hayFiltros} onLimpiar={limpiarTodo} />
          ) : (
            <div ref={boardScrollRef} onDragOver={onBoardDragOver} onDrop={stopAutoScroll} style={{ flex: 1, minHeight: 0, overflowX: 'auto', paddingBottom: 14 }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', width: 'max-content' }}>
                {stages
                  .filter((s) => activeBands.has(s.band ?? 'pipeline'))
                  .sort((a, b) => (KANBAN_BANDS.indexOf(a.band ?? 'pipeline') - KANBAN_BANDS.indexOf(b.band ?? 'pipeline')) || ((a.col ?? 0) - (b.col ?? 0)))
                  .map((c) => renderColumn(c))}
              </div>
            </div>
          )}
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
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ color: 'var(--dim)', fontSize: 14.5 }}>
                {hayFiltros ? 'Sin resultados para estos filtros' : 'Todavía no hay leads para mostrar'}
              </div>
              {/* Misma salida que en el kanban: el aviso sin el botón deja al usuario
                  buscando a mano cuál de los filtros fue el que vació la lista. */}
              {hayFiltros && (
                <button type="button" onClick={limpiarTodo}
                  style={{ marginTop: 14, padding: '9px 18px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
                  Limpiar filtros
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {selected && (
        <LeadEditModal leadId={selected.id} seed={{ nombre: selected.name, empresa: selected.company }} onClose={closeDetail} />
      )}

      {/* Importar / exportar: los MISMOS formularios de a una pregunta que el plan. */}
      {importar && <ImportarLeadsModal onClose={() => setImportar(false)} onListo={(resumen) => { setImportar(false); setFlashCsv(resumen); router.refresh(); }} />}
      {exportar && <ExportarLeadsModal onClose={() => setExportar(false)} />}

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
            onVerDetalle={esCompletar ? () => router.push(`/crm/${l.id}`) : undefined}
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

      {/* Nutrición manual — motivo · fecha límite · confirmación */}
      {manualNutri && (
        <WizardShell
          titulo={`Nutrición manual · ${manualNutri.name}`}
          total={3}
          idx={manualNutriPaso}
          pregunta={manualNutriPaso === 0 ? '¿Por qué pasa a nutrición manual?' : manualNutriPaso === 1 ? '¿Hasta cuándo la seguís?' : 'Revisá y confirmá'}
          sub={manualNutriPaso === 0
            ? 'Contá el motivo del parking. Queda en el historial del lead.'
            : manualNutriPaso === 1
              ? 'Poné una fecha límite: si llega sin que el lead avance, vuelve a «datos sin marcar» en rojo.'
              : 'Esto es lo que va a pasar cuando confirmes.'}
          puedeAvanzar={manualNutriPaso === 0 ? !!manualMotivo.trim() : !!manualDeadline}
          enUltimo={manualNutriPaso === 2}
          confirmLabel="Guardar nutrición manual"
          pending={isPending}
          atrasLabel={manualNutriPaso === 0 ? 'Cancelar' : 'Atrás'}
          onClose={() => setManualNutri(null)}
          onAtras={() => (manualNutriPaso === 0 ? setManualNutri(null) : setManualNutriPaso(manualNutriPaso - 1))}
          onSiguiente={() => setManualNutriPaso(manualNutriPaso + 1)}
          onConfirmar={confirmManualNutri}
        >
          {manualNutriPaso === 0 ? (
            <textarea value={manualMotivo} onChange={(e) => setManualMotivo(e.target.value)} autoFocus placeholder="Ej: pidió que lo contactemos en 2 meses; está cerrando presupuesto…" style={{ ...wizardInput, minHeight: 96, textAlign: 'left', lineHeight: 1.5 }} />
          ) : manualNutriPaso === 1 ? (
            <input type="date" value={manualDeadline} min={hoy} onChange={(e) => setManualDeadline(e.target.value)} autoFocus style={{ ...wizardInput, maxWidth: 260, margin: '0 auto', display: 'block' }} />
          ) : (
            <ResumenFilas filas={[
              ['Lead', manualNutri.name],
              ['Etapa', 'Nutrición - Manual'],
              ['Motivo', manualMotivo.trim() || '—'],
              ['Vence', manualDeadline || '—'],
            ]} />
          )}
        </WizardShell>
      )}

      {/* "¿Qué hacer ahora?" — reunión que ya pasó (R) o nutrición vencida (M).
          Un WizardShell de a una pregunta: qué pasó → el dato que haga falta →
          confirmación con el resumen. */}
      {queHacer && reagOut && (
        // Ya se reagendó: lo único que falta contar es qué pasó con el calendario.
        // El CRM está guardado sí o sí — el resultado de Google no puede leerse
        // como "falló el reagendado".
        <div onClick={cerrarQueHacer} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" style={{ width: '100%', maxWidth: 480, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 30px 70px rgba(18,21,27,.35)', padding: '22px 24px' }}>
            <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '.14em', color: 'var(--accent)', marginBottom: 10 }}>✦ MAKO</div>
            <div style={{ fontSize: 15.5, fontWeight: 700, color: reagOut.ok ? 'var(--good)' : 'var(--warn)', marginBottom: 5 }}>
              {/* "avisado al invitado" solo si REALMENTE había a quién avisarle: un
                  lead sin email mueve el evento pero no notifica a nadie. */}
              {reagOut.ok
                ? `✓ Reunión ${reagOut.accion === 'creado' ? 'agendada' : 'movida'} en tu calendario${reagOut.invitado ? ' y avisado al invitado' : ''}`
                : 'El CRM quedó actualizado, pero no pude mover el evento'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.55 }}>{reagOut.mensaje}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {reagOut.reconectar && (
                <button type="button" onClick={() => router.push('/integraciones')} style={{ padding: '9px 15px', borderRadius: 10, border: '1px solid var(--primary)', background: 'var(--surface)', color: 'var(--primary)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>Reconectar Google Calendar</button>
              )}
              <button type="button" onClick={cerrarQueHacer} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: 'var(--ink)', color: 'var(--on-sidebar)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>Listo</button>
            </div>
          </div>
        </div>
      )}

      {queHacer && !reagOut && (() => {
        const esR = queHacer.tipo === 'R';
        const nR = queHacer.cual === 'r2' ? 2 : 1;
        const etiquetaEtapa = (k: string) => findStage(stages, k).label;

        // Paso 1 — las salidas reales de cada pendiente, como botones grandes.
        const opciones: Array<{ v: QhOpcion; label: string; sub: string }> = esR
          ? [
              { v: 'reprog', label: 'Se reprogramó', sub: 'Quedó para otro día y hora' },
              { v: 'noasistio', label: 'No asistió', sub: 'No se presentó a la reunión' },
              { v: 'mover', label: 'Ya avanzó, moverlo de etapa', sub: 'La reunión ocurrió y el lead sigue' },
              ...(hayPerdido ? [{ v: 'perdido' as const, label: 'Se perdió', sub: 'No sigue: se registra el motivo' }] : []),
            ]
          : [
              { v: 'nutrir', label: 'Seguir nutriendo', sub: 'Le doy un plazo nuevo' },
              { v: 'mover', label: 'Moverlo de etapa', sub: 'Se reactivó y avanza' },
              ...(hayPerdido ? [{ v: 'perdido' as const, label: 'Darlo por perdido', sub: 'No sigue: se registra el motivo' }] : []),
            ];

        const pregunta = qhPasoId === 'que'
          ? '¿Qué pasó?'
          : qhPasoId === 'resumen'
            ? 'Revisá y confirmá'
            : qhOpcion === 'reprog' ? `¿Para cuándo quedó la Reunión ${nR}?`
            : qhOpcion === 'nutrir' ? '¿Hasta cuándo la seguís?'
            : qhOpcion === 'noasistio' ? '¿A qué etapa pasa?'
            : '¿A qué etapa lo movés?';

        const sub = qhPasoId === 'que'
          ? (esR
              ? `La Reunión ${nR} ya pasó y el lead sigue esperando una decisión.`
              : 'Venció la nutrición manual sin resolverse.')
          : qhPasoId === 'resumen' ? 'Esto es lo que va a pasar cuando confirmes.'
          : qhOpcion === 'reprog'
            ? (reagCal && !reagCal.conectado
                ? 'Se actualiza en el CRM y queda en el historial. Conectá tu Google Calendar para que además se mueva el evento y se le avise al invitado.'
                : reagCal && !reagCal.puedeMover
                  ? 'Se actualiza en el CRM y queda en el historial. Tu permiso de Google es de solo lectura: reconectalo para que además se mueva el evento.'
                  : 'Se actualiza en el CRM, se mueve el evento en tu Google Calendar y se le avisa al invitado.')
          : qhOpcion === 'nutrir' ? 'Si llega esa fecha sin que el lead avance, vuelve a aparecer acá en rojo.'
          : qhOpcion === 'noasistio' ? `Se marca que no asistió a la Reunión ${nR} y el lead pasa a la etapa que elijas.`
          : 'Después te vamos a pedir solo los datos que falten para esa etapa.';

        // Resumen: la frase concreta de lo que se va a hacer.
        const resumenFilas: Array<[string, string]> =
          qhOpcion === 'reprog' ? [['Reunión ' + nR, `pasa al ${reagFecha} a las ${horaLegible(reagHora)}`], ['Asistencia', 'queda sin marcar hasta esa fecha']]
          : qhOpcion === 'nutrir' ? [['Nutrición manual', `nuevo plazo hasta el ${qhPlazo}`]]
          : qhOpcion === 'noasistio' ? [[`Reunión ${nR}`, 'no asistió'], ['Etapa', etiquetaEtapa(qhEtapa)]]
          : qhOpcion === 'perdido' ? [['Etapa', etiquetaEtapa('perdido')], ['Motivo', 'te lo pedimos en el paso siguiente']]
          : [['Etapa', qhEtapa ? etiquetaEtapa(qhEtapa) : '—']];

        const btnOpcion = (activo: boolean): CSSProperties => ({
          width: '100%', textAlign: 'left', padding: '13px 16px', borderRadius: 12, fontFamily: SANS, cursor: 'pointer',
          background: activo ? 'var(--ink)' : 'var(--surface)',
          border: '1px solid ' + (activo ? 'var(--ink)' : 'var(--border-strong)'),
          color: activo ? '#F3F5F8' : 'var(--ink)',
        });

        return (
          <WizardShell
            titulo={`¿Qué hacer ahora? · ${queHacer.name}`}
            total={qhPasos.length}
            idx={Math.min(qhPaso, qhPasos.length - 1)}
            pregunta={pregunta}
            sub={sub}
            error={qhError}
            puedeAvanzar={qhPuede}
            enUltimo={qhPasoId === 'resumen'}
            confirmLabel={qhOpcion === 'reprog' ? 'Reagendar' : qhOpcion === 'nutrir' ? 'Guardar el nuevo plazo' : 'Continuar'}
            pending={isPending}
            atrasLabel={qhPaso === 0 ? 'Cancelar' : 'Atrás'}
            onClose={cerrarQueHacer}
            onAtras={() => (qhPaso === 0 ? cerrarQueHacer() : setQhPaso(qhPaso - 1))}
            onSiguiente={() => { setQhError(null); setQhPaso(qhPaso + 1); }}
            onConfirmar={confirmarQueHacer}
            ancho={560}
          >
            {qhPasoId === 'que' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {opciones.map((o) => (
                  <button key={o.v} type="button" onClick={() => { setQhOpcion(o.v); setQhPaso(1); }} style={btnOpcion(qhOpcion === o.v)}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{o.label}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 500, marginTop: 2, color: qhOpcion === o.v ? 'rgba(255,255,255,.72)' : 'var(--dim)' }}>{o.sub}</div>
                  </button>
                ))}
              </div>
            )}

            {qhPasoId === 'detalle' && qhOpcion === 'reprog' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {reagCal && !reagCal.puedeMover && (
                  <button type="button" onClick={() => router.push('/integraciones')} style={{ alignSelf: 'center', padding: 0, border: 'none', background: 'none', color: 'var(--primary)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS, textDecoration: 'underline' }}>
                    {reagCal.conectado ? 'Reconectar para poder mover reuniones →' : 'Conectar Google Calendar →'}
                  </button>
                )}
                <input type="date" value={reagFecha} min={hoy} onChange={(e) => setReagFecha(e.target.value)} aria-label="Fecha nueva" autoFocus
                  style={{ ...wizardInput, maxWidth: 260, margin: '0 auto', display: 'block' }} />
                {/* La hora se ELIGE de la grilla: ver app/crm/SelectorHora.tsx. */}
                <SelectorHora value={reagHora} onChange={setReagHora} ariaLabel="Hora nueva" />
                <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>Vuelve a quedar pendiente recién a esa hora.</div>
              </div>
            )}

            {qhPasoId === 'detalle' && qhOpcion === 'nutrir' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {([['1 semana', 7], ['2 semanas', 14], ['1 mes', 30]] as const).map(([lbl, d]) => {
                    const iso = masDiasISO(hoy, d);
                    return (
                      <button key={lbl} type="button" onClick={() => setQhPlazo(iso)}
                        style={{ padding: '9px 15px', borderRadius: 11, fontSize: 13.5, fontWeight: 700, fontFamily: SANS, cursor: 'pointer', background: qhPlazo === iso ? 'var(--ink)' : 'var(--surface)', border: '1px solid ' + (qhPlazo === iso ? 'var(--ink)' : 'var(--border-strong)'), color: qhPlazo === iso ? '#F3F5F8' : 'var(--ink)' }}>
                        + {lbl}
                      </button>
                    );
                  })}
                </div>
                <input type="date" value={qhPlazo} min={hoy} onChange={(e) => setQhPlazo(e.target.value)} aria-label="Nuevo plazo"
                  style={{ ...wizardInput, maxWidth: 260, margin: '0 auto', display: 'block' }} />
              </div>
            )}

            {qhPasoId === 'detalle' && (qhOpcion === 'mover' || qhOpcion === 'noasistio') && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
                {etapasDestino.map((s) => (
                  <button key={s.key} type="button" onClick={() => setQhEtapa(s.key)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 14px', borderRadius: 11, fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', textAlign: 'left', background: qhEtapa === s.key ? 'var(--ink)' : 'var(--surface)', border: '1px solid ' + (qhEtapa === s.key ? 'var(--ink)' : 'var(--border-strong)'), color: qhEtapa === s.key ? '#F3F5F8' : 'var(--ink)' }}>
                    <span aria-hidden style={{ width: 9, height: 9, borderRadius: '50%', background: s.dot, flex: 'none' }} />{s.label}
                  </button>
                ))}
              </div>
            )}

            {qhPasoId === 'resumen' && <ResumenFilas filas={[['Lead', queHacer.name], ...resumenFilas]} />}
          </WizardShell>
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

      {/* Marcar/Registrar reunión (R1/R2) a mano — fecha · asistencia/motivo · confirmación */}
      {manualMeeting && (() => {
        const esPasada = manualMeeting.modo === 'pasada';
        const rLabel = manualMeeting.which === 'agenda' ? 'R1' : 'R2';
        const puede = mmPaso === 0 ? !!mmFecha : mmPaso === 1 ? (esPasada ? true : !!mmNota.trim()) : true;
        return (
          <WizardShell
            titulo={`${esPasada ? 'Marcar' : 'Registrar'} ${rLabel} · ${manualMeeting.name}`}
            total={3}
            idx={mmPaso}
            pregunta={mmPaso === 0
              ? (esPasada ? `¿Cuándo fue la ${rLabel}?` : `¿Para cuándo está agendada la ${rLabel}?`)
              : mmPaso === 1
                ? (esPasada ? `¿Asistió a la ${rLabel}?` : '¿Por qué se agendó fuera de Calendly?')
                : 'Revisá y confirmá'}
            sub={mmPaso === 0
              ? (esPasada ? 'La reunión ya ocurrió: registrala a mano (sin Calendly) para avanzar el lead.' : 'Ya está agendada por fuera de Calendly. Cargá la fecha; la asistencia se marca cuando ocurra.')
              : mmPaso === 1
                ? (esPasada ? undefined : 'Es una excepción: todas las reuniones deberían agendarse por Calendly.')
                : 'Esto es lo que va a pasar cuando confirmes.'}
            puedeAvanzar={puede}
            enUltimo={mmPaso === 2}
            confirmLabel="Guardar reunión"
            pending={isPending}
            atrasLabel={mmPaso === 0 ? 'Cancelar' : 'Atrás'}
            onClose={() => setManualMeeting(null)}
            onAtras={() => (mmPaso === 0 ? setManualMeeting(null) : setMmPaso(mmPaso - 1))}
            onSiguiente={() => setMmPaso(mmPaso + 1)}
            onConfirmar={confirmManualMeeting}
          >
            {mmPaso === 0 ? (
              <input type="date" value={mmFecha} min={esPasada ? undefined : hoy} max={esPasada ? hoy : undefined} onChange={(e) => setMmFecha(e.target.value)} autoFocus style={{ ...wizardInput, maxWidth: 260, margin: '0 auto', display: 'block' }} />
            ) : mmPaso === 1 ? (
              esPasada ? (
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  {([['si', 'Sí, asistió'], ['no', 'No asistió'], ['', 'No sé']] as const).map(([v, lbl]) => (
                    <button key={lbl} onClick={() => setMmAsistio(v)} style={{ minWidth: 120, padding: '12px 16px', borderRadius: 12, border: `1px solid ${mmAsistio === v ? 'var(--ink)' : 'var(--border-strong)'}`, background: mmAsistio === v ? 'var(--ink)' : 'var(--surface)', color: mmAsistio === v ? '#F3F5F8' : 'var(--ink)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>{lbl}</button>
                  ))}
                </div>
              ) : (
                <textarea value={mmNota} onChange={(e) => setMmNota(e.target.value)} autoFocus placeholder="Contá el motivo de la excepción…" style={{ ...wizardInput, minHeight: 90, textAlign: 'left', lineHeight: 1.5 }} />
              )
            ) : (
              <ResumenFilas filas={[
                ['Lead', manualMeeting.name],
                ['Reunión', rLabel],
                ['Fecha', mmFecha || '—'],
                ...(esPasada
                  ? ([['Asistió', mmAsistio === 'si' ? 'Sí' : mmAsistio === 'no' ? 'No' : 'Sin marcar']] as Array<[string, string]>)
                  : ([['Motivo de la excepción', mmNota.trim() || '—']] as Array<[string, string]>)),
                ['Etapa', findStage(stages, manualMeeting.which).label],
              ]} />
            )}
          </WizardShell>
        );
      })()}

      {/* LA confirmación del tablero (app/_ui/Confirm). Va sobre la pila de modales:
          preguntar «¿seguro?» tapando lo que estás por cambiar sería absurdo. */}
      {confirmacion && (
        <ConfirmDialog
          title={confirmacion.titulo}
          message={confirmacion.mensaje}
          confirmLabel={confirmacion.confirmLabel}
          tone={confirmacion.tono ?? 'danger'}
          onConfirm={() => { const c = confirmacion; setConfirmacion(null); c.onOk(); }}
          onCancel={() => setConfirmacion(null)}
        />
      )}

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
  const [openIgnorar, setOpenIgnorar] = useState(false);
  const [sel, setSel] = useState('');
  // Confirmación del "asignar en lote": guarda el valor elegido para poder
  // nombrarlo en la pregunta ("Asignar Setter «Mauricio» a 12 leads").
  const [aAsignar, setAAsignar] = useState<{ field: 'setter' | 'closer'; label: string; value: string; ids: number[] } | null>(null);

  const idsCon = (stepId: string) => marcar.filter((m) => m.faltantes?.some((f) => f.id === stepId)).map((m) => m.leadId);
  const grupos = ([
    { field: 'setter', label: 'Setter', ids: idsCon('setter') },
    { field: 'closer', label: 'Closer', ids: idsCon('closer') },
  ] as const).filter((g) => g.ids.length > 0);
  const idsEmpresa = idsCon('empresa');
  // "Ignorar todos": los datos sin marcar de verdad (tipo A). La nutrición manual
  // vencida (M) no se ignora en masa — tiene su propia resolución.
  // Ni la nutrición manual vencida (M) ni la reunión pasada sin desenlace (R) se
  // pueden ignorar: son leads TRABADOS esperando una decisión, no datos de más.
  const idsIgnorar = marcar.filter((m) => m.tipo !== 'M' && m.tipo !== 'R').map((m) => m.leadId);

  if (!grupos.length && !idsEmpresa.length && !idsIgnorar.length) return null;

  const abrir = (g: { field: 'setter' | 'closer'; label: string; ids: number[] }) => { setSel(''); setFlash(null); setOpen(g); };

  const ignorarEmpresa = () => {
    startTransition(async () => {
      try {
        const r = await bulkIgnoreEmpresaAction(idsEmpresa);
        setOpenEmpresa(false);
        setFlash(`✓ Empresa ignorada en ${r.updated} lead${r.updated === 1 ? '' : 's'} — ya no la pide el CRM (sigue en la ficha).`);
        onDone();
      } catch (e) {
        // Cerrar también al fallar: si no, el aviso queda tapado por el backdrop.
        setOpenEmpresa(false);
        setFlash(`No se pudo: ${e instanceof Error ? e.message : 'error'}`);
      }
    });
  };

  const ignorarTodos = () => {
    startTransition(async () => {
      try {
        const r = await ignorarPendientesMasaAction(idsIgnorar);
        setOpenIgnorar(false);
        setFlash(`✓ ${r.updated} lead${r.updated === 1 ? '' : 's'} ignorado${r.updated === 1 ? '' : 's'} — salen del worklist (siguen con sus avisos en la ficha, reversible).`);
        onDone();
      } catch (e) {
        setOpenIgnorar(false);
        setFlash(`No se pudo: ${e instanceof Error ? e.message : 'error'}`);
      }
    });
  };

  const confirmar = () => {
    if (!aAsignar) return;
    const { field, ids, label, value } = aAsignar;
    startTransition(async () => {
      try {
        const r = await bulkFillLeadFieldAction(field, value, ids);
        setAAsignar(null);
        setOpen(null);
        setFlash(r.updated === 0
          ? `Sin cambios: esos leads ya tenían ${label} cargado.`
          : `✓ ${label} «${value}» asignado a ${r.updated} lead${r.updated === 1 ? '' : 's'}.`);
        onDone();
      } catch (e) {
        setAAsignar(null);
        setOpen(null);
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
        {idsIgnorar.length > 0 && (
          <button type="button" onClick={() => { setFlash(null); setOpenIgnorar(true); }} style={{ ...btn, background: 'var(--surface)', color: 'var(--dim)', border: '1px solid var(--border-strong)' }}>
            Ignorar todos · {idsIgnorar.length}
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
              <button type="button" disabled={pending || !sel.trim()} onClick={() => setAAsignar({ ...open, value: sel.trim() })}
                style={{ ...btn, background: sel.trim() && !pending ? 'var(--primary)' : 'var(--surface-2)', color: sel.trim() && !pending ? '#fff' : 'var(--faint)' }}>
                {pending ? 'Asignando…' : `Asignar a los ${open.ids.length}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Las dos acciones en lote que TOCAN leads pasan por LA confirmación de la
          app, con el número exacto en el título — no por un modal propio. */}
      {openEmpresa && (
        <ConfirmDialog
          title={`Ignorar Empresa en ${idsEmpresa.length} lead${idsEmpresa.length === 1 ? '' : 's'}`}
          message="Muchas veces no tenés la empresa. Al ignorarla deja de contar como “dato sin marcar” en el CRM general, pero sigue apareciendo como recordatorio suave dentro de la ficha de cada lead. Reversible."
          confirmLabel={`Ignorar en los ${idsEmpresa.length}`}
          loading={pending}
          onConfirm={ignorarEmpresa}
          onCancel={() => setOpenEmpresa(false)}
        />
      )}

      {openIgnorar && (
        <ConfirmDialog
          title={`Ignorar los datos sin marcar de ${idsIgnorar.length} lead${idsIgnorar.length === 1 ? '' : 's'}`}
          message="Salen del worklist “Datos sin marcar” y dejan de sumar al conteo. Los mismos avisos siguen apareciendo dentro de la ficha de cada lead, con opción de reactivarlos cuando quieras. Reversible."
          confirmLabel={`Ignorar los ${idsIgnorar.length}`}
          loading={pending}
          onConfirm={ignorarTodos}
          onCancel={() => setOpenIgnorar(false)}
        />
      )}

      {/* Asignar en lote ya se explica solo en su form (dice el campo y a cuántos
          leads), pero el paso final vuelve a decirlo CON el valor elegido: es un
          write sobre decenas de fichas y el nombre recién se sabe acá. */}
      {aAsignar && (
        <ConfirmDialog
          title={`Asignar ${aAsignar.label} «${aAsignar.value}» a ${aAsignar.ids.length} lead${aAsignar.ids.length === 1 ? '' : 's'}`}
          message="Solo se rellenan los que están vacíos: nunca pisa un valor cargado a mano. Cada asignación queda en el historial del lead."
          confirmLabel={`Asignar a los ${aAsignar.ids.length}`}
          tone="primary"
          loading={pending}
          onConfirm={confirmar}
          onCancel={() => setAAsignar(null)}
        />
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
  const ghost: CSSProperties = { flex: 'none', padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS };
  const [ignorando, startIgnorar] = useTransition();
  const [ignId, setIgnId] = useState<number | null>(null);
  // Ignorar cambia el lead (lo saca del worklist): pasa por confirmación, y el
  // texto nombra al lead y a los datos concretos que se van a silenciar.
  const [aIgnorar, setAIgnorar] = useState<CrmMarcar | null>(null);
  const ignorar = (leadId: number) => {
    setIgnId(leadId);
    startIgnorar(async () => {
      try { await ignorarPendientesAction(leadId); onBulkDone(); }
      catch { /* noop: se reintenta desde la ficha */ }
      finally { setIgnId(null); }
    });
  };
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
                  pregunta "¿qué hacer ahora?" (elegir la etapa destino). "Ignorar"
                  saca el lead del worklist (sigue con sus avisos en la ficha). */}
              {m.tipo === 'M' || m.tipo === 'R'
                ? <button type="button" style={{ ...btn, background: 'var(--warn-fill)' }} onClick={() => onQueHacer(m.leadId)}>¿Qué hacer ahora?</button>
                : (
                  <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
                    <button type="button" style={btn} onClick={() => onSolucionar(m.leadId)}>Solucionar</button>
                    <button type="button" style={ghost} disabled={ignorando && ignId === m.leadId} onClick={() => setAIgnorar(m)}>
                      {ignorando && ignId === m.leadId ? 'Ignorando…' : 'Ignorar'}
                    </button>
                  </div>
                )}
            </div>
          </div>
        ))}
        {marcar.length === 0 && <div style={{ padding: 36, textAlign: 'center', color: 'var(--good)', fontSize: 15.5, fontWeight: 600 }}>✓ Todo marcado — datos al día.</div>}
      </div>
      </div>

      {aIgnorar && (
        <ConfirmDialog
          title={`Ignorar los datos sin marcar de ${aIgnorar.name}`}
          message={
            <>
              Sale del worklist y deja de sumar al conteo
              {aIgnorar.faltantes?.length ? <>: <b>{aIgnorar.faltantes.map((f) => f.label).join(', ')}</b></> : null}.
              Los mismos avisos siguen apareciendo dentro de su ficha, y podés reactivarlos cuando quieras.
            </>
          }
          confirmLabel="Ignorar"
          onConfirm={() => { const id = aIgnorar.leadId; setAIgnorar(null); ignorar(id); }}
          onCancel={() => setAIgnorar(null)}
        />
      )}
    </div>
  );
}

// Los controles del header y de la barra (acciones, vista, buscador, filtros y
// bandas) viven en ./CrmToolbar. La gestión de etapas y transiciones vive en la
// tab /funnel (FunnelEditor), a la que se llega desde el menú "···".
