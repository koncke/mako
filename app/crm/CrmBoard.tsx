'use client';

// =============================================================================
// CrmBoard — tablero del CRM (rediseño Marketing OS)
// =============================================================================
// Réplica fiel del prototipo (Dashboard CRM.dc.html) sobre datos reales de
// Supabase. Persisten: mover de etapa, Closer, Setter, links de Fathom, motivo
// y borrar lead (server actions). Plan de pagos / cuotas / nutrición se editan
// en sesión (no se persisten en esta iteración).

import { useSearchParams, usePathname } from 'next/navigation';
import { useRouter } from '@/app/_ui/Link';
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
  etapaNoShowDe,
  salidasDeEtapa,
  stageMeta as findStage,
  stageMetaOpt,
  type OpcionSalida,
  type Stage,
  type StageBand,
  type FunnelTransition,
} from '@/lib/pipeline';
// Sin 'server-only' a propósito (ver su cabecera): es la fuente única del mapeo
// etapa→R1/R2, y la usa también este componente de cliente.
import { useCapaModal } from '@/app/_components/pila-modales';
import { slotDeReunion } from '@/lib/funnel-etapas';
import type { EstadoLead, FathomLink } from '@/lib/leads';
import {
  setLeadStageAction,
  undoStageMoveAction,
  markManualNutritionAction,
  markMeetingManualAction,
  bulkFillLeadFieldAction,
  bulkIgnoreEmpresaAction,
  ignorarPendientesAction,
  reactivarPendientesAction,
  ignorarPendientesMasaAction,
  reagendarReunionAction,
  permisoCalendarioAction,
  duracionReunionAction,
  requisitosDeEtapaAction,
  resolverQueHacerAction,
  linkDeAgendaAction,
} from './actions';
import type { ReagendarResultado, StageMoveData } from './actions';
import { ImportarLeadsModal } from './ImportarLeadsModal';
import { ExportarLeadsModal } from './ExportarLeadsModal';
import { LeadEditModal } from './LeadEditModal';
import { CrmAutoToggle } from './CrmAutoToggle';
import { StageMoveDialog, leadToMoveInfo, type StageMoveTarget } from './StageMoveDialog';
import { SelectorHora, horaLegible, ANCLA_DEFECTO } from './SelectorHora';
import { motivosDeSalida, motivoFinalDe, pideMotivo } from './motivos-salida';
import {
  leerRespuestaHorarios, normalizarRango, hhmm, instanteDeLocal, AVISO_SIN_AGENDA,
  DURACION_DEFECTO_MIN, type RespuestaHorarios, type SlotAgenda, type RangoGrilla,
} from './horarios-respuesta';
import { fmtDDMMYYYY } from '@/lib/date-utils';
import type { Step } from '@/lib/stage-requirements';
import type { MiembroEquipo } from './actions';
import { WizardShell, wizardInput } from '@/app/_components/WizardShell';
import { ConfirmDialog } from '@/app/components/ConfirmDialog';
import { senalesAOfrecer, hayAlgoQueOfrecer, asistenciaImplicita } from './senales-meta';
// La misma pieza que usan las fichas: los dos toques de Meta viven en UN lugar.
import { SenalesMetaChips } from './MoverEtapaConfirm';
import { coincideBusqueda } from '@/lib/buscar-texto';
import type { FunnelResumen } from '@/lib/funnel-fila';
import { Dropdown, type DropdownOption } from '../components/Dropdown';
import { openCalendlyEn } from './calendly-widget';
import { Icon } from '../_components/icons';
import {
  AccionesHeader,
  BandasToggle,
  Buscador,
  SelectorFunnel,
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

import { Toast, useToast } from '@/app/_ui/Toast';
import { motivoCorto, chipsFaltantes } from './worklist-fila';
import { Modal } from '@/app/_ui/Modal';
import { NewLeadForm } from './new/NewLeadForm';

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
  /** Solo tipo 'R': cuál de las dos reuniones pasó. Lo decidió el server. */
  cual?: 'r1' | 'r2';
  /**
   * Cuánto dura ESA reunión, en minutos, si se sabe (sale del evento del
   * calendario). Es lo que decide si un hueco sirve: con 45' fijos, una R1 de 60'
   * se ofrecía a las 18:30 teniendo algo a las 19:15 y se pisaba.
   * Opcional a propósito: mientras el view-model no lo traiga se cae al default
   * del server (DURACION_DEFECTO_MIN), que es el mismo que usa el alta del evento.
   */
  duracionMin?: number;
  /** La etapa REAL del lead al calcularse el pendiente (no la optimista del board). */
  etapa?: string;
};

const fmt = (n: number) => '$' + n.toLocaleString('en-US');

/**
 * Las tres bandas del Kanban, en el orden en que se dibujan.
 *
 * ⚠️ EL DEFAULT ES SOLO `pipeline`, y es el arreglo de la tanda 3. Con las tres
 * encendidas el tablero abría con 1.142 tarjetas y las 26 de Activo quedaban entre
 * 1.089 de nutrición y 23 descartadas: apagar una banda era un clic DESPUÉS de
 * haberlas dibujado, y no se recordaba. Lo que se trabaja es el pipeline; nutrición
 * y salidas son consulta, y se piden.
 *
 * No se esconde nada sin pista: el toggle sigue arriba a la derecha con el CONTEO de
 * cada banda al lado, así que se ve que hay 1.089 en nutrición sin dibujarlas.
 */
const KANBAN_BANDS: StageBand[] = ['pipeline', 'nutricion', 'salidas'];
const BANDAS_DEFAULT: StageBand[] = ['pipeline'];
const BANDAS_CLAVE = 'crm.bandas';

/**
 * Qué bandas dejó encendidas la última vez ESTE navegador. Es una PREFERENCIA, así
 * que va en `localStorage` y no en la base: no es un dato del negocio y no tiene por
 * qué viajar a otra sesión.
 *
 * ⚠️ Se lee en un efecto y NO en el `useState`: el board se renderiza en el server
 * (la página es `force-dynamic`), y ahí `localStorage` no existe — leerlo en el
 * inicializador es un HTML distinto del que hidrata. Devuelve `null` cuando no hay
 * nada que restaurar, para que el default siga siendo del código y no de un catch.
 */
function bandasGuardadas(): StageBand[] | null {
  try {
    const crudo = window.localStorage.getItem(BANDAS_CLAVE);
    if (!crudo) return null;
    const leidas = (JSON.parse(crudo) as unknown[]).filter((b): b is StageBand => KANBAN_BANDS.includes(b as StageBand));
    // Una lista vacía dejaría el tablero sin una sola columna, que es el estado muerto
    // que `toggleBand` ya impide a mano. Si lo guardado no sirve, manda el default.
    return leidas.length ? leidas : null;
  } catch {
    return null;
  }
}

/** Una confirmación pendiente: qué se va a cambiar, dicho concreto. */
type Confirmacion = {
  titulo: string;
  mensaje: ReactNode;
  confirmLabel: string;
  /** `primary` para lo que avanza el pipeline; `danger` para lo que silencia o pierde. */
  tono?: 'danger' | 'primary';
  onOk: () => void;
};

/**
 * Las salidas del form "¿Qué hacer ahora?".
 *
 * Para el pendiente de reunión (R) la primera pregunta ya no es qué ACCIÓN de CRM
 * querés hacer, sino qué HECHO ocurrió con la reunión que pasó: ese pendiente
 * existe justamente porque nadie sabe si el lead se presentó. Con el hecho
 * declarado, la consecuencia se deriva del funnel y ya no se puede dar por
 * perdido un lead marcándole en silencio que asistió.
 *
 *  R · hecha        — "Sí, la tuvimos"      → asistió = true, se elige el desenlace
 *  R · noshow       — "No se presentó"      → asistió = false, la etapa se DEDUCE
 *  R · noshowcierra — salida secundaria del no-show: cerrar sin reintentar
 *  R · reprog       — "Se reprogramó"       → fecha, horarios reales, sin tocar la etapa
 *  M · avanza / nodecide / sinresp / cierra — la nutrición manual vencida
 */
type QhOpcion =
  | 'hecha' | 'noshow' | 'noshowcierra' | 'reprog'
  | 'avanza' | 'nodecide' | 'sinresp' | 'cierra';

/** Los pasos posibles del form. La rama decide CUÁLES y en qué orden. */
type QhPasoId = 'que' | 'salida' | 'noshowEtapa' | 'calificado' | 'motivo' | 'motivoDetalle' | 'fecha' | 'hora' | 'plazo' | 'resumen';


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
  marcarAviso = '',
  transitions,
  total,
  errorMsg,
  hoy,
  equipo = [],
  calendlyStages = [],
  funnels = [],
  funnelActivo = null,
}: {
  leads: CrmLead[];
  stages: Stage[];
  juntas: CrmJunta[];
  marcar: CrmMarcar[];
  /** Por qué la lista de arriba puede estar incompleta ('' = está entera). */
  marcarAviso?: string;
  transitions: FunnelTransition[];
  total: number;
  errorMsg: string | null;
  hoy: string;
  equipo?: MiembroEquipo[];
  /**
   * Qué etapas se agendan por Calendly EN ESTE workspace. Lo decide el SERVER
   * (app/crm/page.tsx) mirando la config de Calendly del cliente. Antes era una
   * constante del bundle con la agenda del dueño adentro, servida a todos: un
   * módulo de cliente no puede decidir nada que dependa de quién está mirando.
   * Vacío = este negocio no agenda por Calendly, y la opción no se ofrece.
   */
  calendlyStages?: string[];
  /** Las ofertas/funnels del workspace. El selector reemplaza al viejo «N de N». */
  funnels?: FunnelResumen[];
  /** null = el funnel del negocio (sin `?funnel=` en la URL). */
  funnelActivo?: number | null;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [view, setView] = useState<'kanban' | 'table'>('kanban');
  const [activeBands, setActiveBands] = useState<Set<StageBand>>(() => new Set<StageBand>(BANDAS_DEFAULT));
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
  // `pendientes`: lo que la etapa pide y todavía falta. Desde el 17/09 eso NO frena
  // el movimiento (08-T22): se guarda igual y se avisa acá, sin pedir nada.
  const [undoInfo, setUndoInfo] = useState<{ id: number; name: string; from: string; toLabel: string; monto: number | null; motivo: string | null; pendientes?: string[] } | null>(null);
  // Los dos toques opcionales de Meta que viajan en la confirmación de mover (ver
  // senales-meta.ts). Ref y no estado: la confirmación guarda su `onOk` al abrirse,
  // y tiene que leer lo que se tocó DESPUÉS, al confirmar.
  const senalesRef = useRef<{ asistio: boolean | null; calificado: boolean | null }>({ asistio: null, calificado: null });
  const [manualNutri, setManualNutri] = useState<{ leadId: number; name: string } | null>(null);
  const [manualMotivo, setManualMotivo] = useState('');
  const [manualDeadline, setManualDeadline] = useState('');
  const [manualNutriPaso, setManualNutriPaso] = useState(0);   // wizard: 0=motivo, 1=fecha límite
  // "¿Qué hacer ahora?": lo usan DOS pendientes distintos — la nutrición manual
  // vencida (M) y la reunión que ya pasó sin desenlace (R). Cada uno necesita su
  // copy y sus salidas propias (nuevo plazo vs. reagendar la reunión).
  const [queHacer, setQueHacer] = useState<{ leadId: number; name: string; tipo: 'M' | 'R'; cual: 'r1' | 'r2'; etapa: string; duracionMin: number } | null>(null);
  const [qhPaso, setQhPaso] = useState(0);
  const [qhVisitados, setQhVisitados] = useState<QhPasoId[]>([]);   // Atrás vuelve al paso VISITADO
  const [qhOpcion, setQhOpcion] = useState<QhOpcion | null>(null);
  const [qhEtapa, setQhEtapa] = useState('');     // etapa destino elegida (o deducida)
  const [qhCalificado, setQhCalificado] = useState<boolean | null>(null);
  const [qhMotivoCat, setQhMotivoCat] = useState('');   // categoría del motivo de salida
  const [qhMotivoDet, setQhMotivoDet] = useState('');   // detalle concreto
  const [qhPlazo, setQhPlazo] = useState('');     // nuevo deadline de nutrición manual
  // Lo que el server va a exigir para el destino elegido, consultado al entrar al
  // resumen con las respuestas ya dadas. null = todavía viajando.
  const [qhFaltan, setQhFaltan] = useState<Step[] | null>(null);
  const [reagFecha, setReagFecha] = useState('');
  const [reagHora, setReagHora] = useState('');
  // Horarios del día elegido leídos de Google. null = no se sabe (SelectorHora
  // se comporta como siempre: grilla completa, todo elegible).
  const [reagSlots, setReagSlots] = useState<SlotAgenda[] | null>(null);
  const [reagSlotsCargando, setReagSlotsCargando] = useState(false);
  const [reagSlotsNota, setReagSlotsNota] = useState<string>('');
  const [reagTz, setReagTz] = useState<string>('');
  // Con qué números armó el server la grilla (jornada, paso, duración). Se lo pasa
  // al selector: cuando la agenda NO se pudo verificar el selector dibuja la grilla
  // por su cuenta y tiene que ofrecer EL MISMO rango, o el usuario ve una jornada
  // distinta según si Google contestó o no.
  const [reagRango, setReagRango] = useState<RangoGrilla>(() => normalizarRango());
  // El no-show ya ocurrió y por eso se reagenda: hay que dejarlo en el historial
  // ANTES del update (reagendar pone asistio_jN en null).
  const [qhNoShowPrevio, setQhNoShowPrevio] = useState(false);
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

  // Movimiento de una card. Optimista + revert solo ante una falla real: faltar
  // datos YA NO frena (08-T22) — vuelven como `pendientes` y se avisan en el toast.
  const persistStage = (
    id: number, key: string, from?: string, tr?: FunnelTransition,
    senales?: { asistio: boolean | null; calificado: boolean | null },
  ) => {
    setLocalStage((m) => ({ ...m, [id]: key }));
    const revertir = () => {
      setLocalStage((m) => { const n = { ...m }; if (from) n[id] = from; else delete n[id]; return n; });
      setUndoInfo(null);
    };
    startTransition(async () => {
      try {
        // Lo que la persona tocó gana; si no tocó nada, la asistencia que el paso
        // implica — salvo que sea una pérdida, que no implica nada (ver
        // asistenciaImplicita: copiar ese flag escribía "asistió" sin que nadie lo dijera).
        const r = await setLeadStageAction(id, key, {
          asistio_j1: senales?.asistio ?? asistenciaImplicita(tr),
          asistio_j2: tr?.category === 'perdida' ? undefined : tr?.asistioJ2,
          calificado: senales?.calificado ?? undefined,
        });
        if (r.ok && r.pendientes?.length) {
          const labels = r.pendientes.map((p) => p.label);
          setUndoInfo((u) => (u && u.id === id ? { ...u, pendientes: labels } : u));
        }
        // Red de seguridad: el server de hoy ya no devuelve ok:false por datos
        // faltantes, pero si algún día lo hiciera, se abre el wizard en vez de
        // revertir la card en silencio.
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
  /** Deja el wizard en cero. Lo llaman abrir Y cerrar: si limpia uno solo, la
   *  respuesta de una sesión anterior se filtra a la siguiente. */
  const limpiarQueHacer = () => {
    setQhPaso(0); setQhVisitados([]); setQhOpcion(null); setQhEtapa('');
    setQhCalificado(null); setQhMotivoCat(''); setQhMotivoDet(''); setQhPlazo('');
    setQhFaltan(null); setQhError(null); setQhNoShowPrevio(false);
    setReagFecha(''); setReagHora(''); setReagOut(null); setReagCal(null);
    setReagSlots(null); setReagSlotsCargando(false); setReagSlotsNota(''); setReagTz('');
    setReagRango(normalizarRango());
  };
  /**
   * Cuál de las dos reuniones es la etapa del lead, cuando el pendiente no lo
   * trae. Sale del FUNNEL del workspace, no de comparar contra 'agendaj2': esa
   * key es la del funnel por defecto, así que un cliente cuyas reuniones se
   * llamen distinto caía siempre en 'r1' — el mismo mapeo índice→R1/R2 que ya
   * vive en lib/funnel-etapas, copiado a mano acá (ver "una cosa, un lugar").
   */
  const cualDeEtapa = (stageKey: string | undefined): 'r1' | 'r2' =>
    slotDeReunion(stages, stageKey)?.cual ?? 'r1';

  const abrirQueHacer = (id: number) => {
    const l = leads.find((x) => x.id === id);
    const m = marcar.find((x) => x.leadId === id);
    const tipo = m?.tipo === 'R' ? 'R' : 'M';
    limpiarQueHacer();
    // `cual` viene del PENDIENTE (lo decidió el server mirando pipeline_stage), no
    // de la etapa local: un drag optimista o un movimiento previo la pudieron
    // cambiar y entonces reagendábamos la reunión equivocada.
    setQueHacer({
      leadId: id,
      name: l?.name ?? 'lead',
      tipo,
      cual: m?.cual ?? cualDeEtapa(l?.stage),
      // La etapa de ORIGEN viene del mismo lugar que `cual` y por el mismo
      // motivo: `effStage` lee el estado optimista, así que entre un drag y el
      // router.refresh() el wizard ofrecía los desenlaces de una etapa en la que
      // el lead todavía no está (y el resumen prometía un movimiento falso).
      etapa: m?.etapa ?? l?.stage ?? 'agenda',
      // La duración REAL de la reunión, cuando el pendiente la trae. Viaja al
      // server al pedir los horarios: es la que define si el hueco alcanza.
      duracionMin: m?.duracionMin && m.duracionMin > 0 ? m.duracionMin : DURACION_DEFECTO_MIN,
    });
    if (tipo === 'R') {
      void permisoCalendarioAction().then(setReagCal).catch(() => setReagCal(null));
      // La duración REAL del evento se pide ACÁ, al abrir, y no en el paso de la
      // hora: así el viaje a Google ocurre mientras el usuario elige la fecha y no
      // se le suma a la espera de la grilla. Cuando llega, el efecto de los
      // horarios se vuelve a disparar solo (depende de queHacer.duracionMin).
      const cualR = m?.cual ?? cualDeEtapa(l?.stage);
      void duracionReunionAction(id, cualR)
        .then((min) => setQueHacer((q) => (q && q.leadId === id && min > 0 && min !== q.duracionMin ? { ...q, duracionMin: min } : q)))
        .catch(() => {});
    }
  };
  const cerrarQueHacer = () => { setQueHacer(null); limpiarQueHacer(); };

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

  // El toast se autodescarta a los 5s; con datos pendientes, a los 10s — hay algo
  // más que leer. Si se va sin que nadie toque «Completar ahora», no se pierde
  // nada: lo pendiente queda marcado en la card y en la ficha.
  useEffect(() => {
    if (!undoInfo) return;
    const t = setTimeout(() => setUndoInfo(null), undoInfo.pendientes?.length ? 10000 : 5000);
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

  // Lo que se apagó a mano se recuerda: sin esto, cada entrada y cada `router.refresh()`
  // devolvía el tablero a su default y había que volver a apagar las dos bandas.
  // Se escribe acá y no en `toggleBand` para cubrir también el arranque restaurado.
  useEffect(() => {
    try {
      window.localStorage.setItem(BANDAS_CLAVE, JSON.stringify([...activeBands]));
    } catch {
      // Ventana privada o datos del sitio bloqueados: la preferencia no sobrevive y
      // el tablero funciona igual con el default.
    }
  }, [activeBands]);

  // La restauración va en su PROPIO efecto y corre una sola vez, antes de que el de
  // arriba pueda pisar lo guardado con el default del primer render.
  useEffect(() => {
    const g = bandasGuardadas();
    if (g) setActiveBands(new Set(g));
  }, []);

  // (Acá vivía `needsFicha`: decidía si soltar una card abría el wizard de datos
  // en vez de moverla. Se fue con 08-T22 — mover ya no depende de los datos.)

  // Abrir el pop-up chico de completar movimiento (no la ficha entera).
  const openStageMove = (l: CrmLead, move: StageMoveTarget) => setStageMove({ leadId: l.id, move });

  // Abre Calendly (prefill nombre/email); la fecha la setea el webhook al reservar
  // y el lead avanza solo. NO persistimos acá.
  const doOpenCalendly = (lead: CrmLead, key: string) => {
    // La URL la resuelve el SERVER contra la cuenta de Calendly de este
    // workspace. Si no está configurada, se dice — nunca se cae a la de otro.
    void (async () => {
      const { url, motivo } = await linkDeAgendaAction(key === 'agenda' ? 'agenda' : 'agendaj2');
      if (!url) { setAvisoAgenda(motivo ?? 'No pude abrir Calendly.'); return; }
      await openCalendlyEn(url, {
        name: lead.name,
        email: lead.email,
        onScheduled: () => { setTimeout(() => router.refresh(), 2500); },
      });
    })();
  };

  /** ¿Esta etapa se agenda por Calendly en ESTE workspace? */
  const esEtapaCalendly = (stageKey: string) => calendlyStages.includes(stageKey);

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
    if (esEtapaCalendly(stageKey)) { scheduleViaCalendly(lead, stageKey); return; }
    const from = effStage(lead);
    const tr = transitionFor(from, stageKey);
    // YA NO se abre el wizard de datos al soltar (08-T22). Antes, si la etapa pedía
    // algo que faltaba, la card no se movía hasta contestarlo todo; Mauricio: «me
    // pregunta un chorro de cosas… lo abandono». Ahora se mueve, y lo que falta se
    // avisa en el toast con «Completar ahora» — opcional, nunca en el camino.
    //
    // Arrastrar una card es el gesto más fácil de hacer sin querer del tablero: por
    // eso sigue pasando por la confirmación, que dice el movimiento exacto.
    const destino = findStage(stages, stageKey).label;
    const origen = findStage(stages, from).label;
    const ofrecer = senalesAOfrecer(lead, { tr, hoyISO: hoy });
    senalesRef.current = { asistio: null, calificado: null };
    setConfirmacion({
      titulo: `Mover a ${destino} a ${lead.name}`,
      mensaje: (
        <>
          Pasa de <b>{origen}</b> a <b>{destino}</b>. Queda registrado en el historial del lead y vas a poder deshacerlo.
          {hayAlgoQueOfrecer(ofrecer) && (
            <SenalesMetaChips ofrecer={ofrecer} onChange={(v) => { senalesRef.current = v; }} />
          )}
        </>
      ),
      confirmLabel: `Mover a ${destino}`,
      tono: 'primary',
      onOk: () => persistStage(id, stageKey, from, tr, senalesRef.current),
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

  // ── El árbol del form, derivado del FUNNEL del workspace ────────────────────
  // Nada de listas de etapas armadas a mano acá: `salidasDeEtapa` (lib/pipeline)
  // es la fuente única. Filtra por el hecho ya declarado, así nunca se ofrece un
  // destino que contradiga la asistencia que el usuario acaba de contestar.
  // ⚠️ ESTOS OVERLAYS ENTRAN A LA PILA DE MODALES. Estaban en `zIndex: 100` y la
  // pila arranca en `Z_BASE = 130`: abiertos SOBRE un `<Modal>` del kit se
  // dibujaban DETRAS — con el fondo del otro encima y sin poder tocarlos. No hay
  // error: se ve como un modal que no responde.
  //
  // `useCapaModal` le da a cada uno el z que le toca y lo esconde con
  // `display:none` cuando deja de ser el de arriba, que es el contrato del kit.
  const capaQueHacer = useCapaModal(!!queHacer);
  const capaMeeting = useCapaModal(!!meetingChoice);

  const qhEtapaActual = queHacer?.etapa ?? 'agenda';
  const qhCual = queHacer?.cual ?? 'r1';

  /** Desenlaces cuando la reunión SÍ se tuvo. Los negativos van al final, separados. */
  const salidasAsistio = useMemo(
    () => (queHacer?.tipo === 'R' ? salidasDeEtapa(stages, transitions, qhEtapaActual, { asistio: true, cual: qhCual }) : []),
    [stages, transitions, qhEtapaActual, qhCual, queHacer?.tipo],
  );
  /** Cerrar el lead tras un no-show: solo pérdidas, con la asistencia FORZADA a false. */
  const salidasNoShowCierre = useMemo(
    () => salidasDeEtapa(stages, transitions, qhEtapaActual, { asistio: false, cual: qhCual }).filter((o) => o.category === 'perdida'),
    [stages, transitions, qhEtapaActual, qhCual],
  );
  /** Nutrición manual vencida: a dónde vuelve / cómo se cierra. Sin tocar asistencias. */
  const salidasManual = useMemo(() => salidasDeEtapa(stages, transitions, qhEtapaActual), [stages, transitions, qhEtapaActual]);
  const salidasManualAvanza = useMemo(() => salidasManual.filter((o) => o.category !== 'perdida'), [salidasManual]);
  const salidasManualCierre = useMemo(() => salidasManual.filter((o) => o.category === 'perdida'), [salidasManual]);

  /** La etapa de No Show que dicta el funnel (null = este funnel no la modela). */
  const qhEtapaNoShow = useMemo(
    () => (queHacer?.tipo === 'R' ? etapaNoShowDe(stages, transitions, qhEtapaActual, qhCual) : null),
    [stages, transitions, qhEtapaActual, qhCual, queHacer?.tipo],
  );
  /**
   * PANTALLA DE EXCEPCIÓN: el funnel del workspace no tiene etapa de No Show para
   * esta reunión. No aparece nunca en el funnel default ni en ninguno generado.
   * Se ofrecen SOLO nutrición y salidas — nunca una etapa de avance, que
   * contradiría el no-show que se acaba de declarar.
   */
  const salidasNoShowExcepcion = useMemo(() => {
    const todas = salidasDeEtapa(stages, transitions, qhEtapaActual, { asistio: false, cual: qhCual });
    const sinAvance = todas.filter((o) => o.category !== 'avanza');
    // Nunca vacía: si el funnel no deja ni una, mejor todas que una pantalla muerta.
    return sinAvance.length ? sinAvance : todas;
  }, [stages, transitions, qhEtapaActual, qhCual]);

  /** Las opciones que se le ofrecen al paso `salida` de la rama en curso. */
  const qhSalidas: OpcionSalida[] =
    qhOpcion === 'hecha' ? salidasAsistio
    : qhOpcion === 'noshowcierra' ? salidasNoShowCierre
    : qhOpcion === 'avanza' ? salidasManualAvanza
    : qhOpcion === 'cierra' ? salidasManualCierre
    : [];
  const qhSalidaElegida = qhSalidas.find((o) => o.to === qhEtapa) ?? null;

  // El destino REAL: el elegido, o el que dicta el funnel en la rama de no-show.
  // Todo lo que dependa del destino (motivo, chips, verbo del botón) se calcula
  // sobre ESTO y nunca sobre `qhEtapa`: en la rama de no-show `qhEtapa` está
  // vacía, y con un funnel cuyo no-show apunta a Perdido el wizard cerraba el
  // lead sin pedir el motivo — el mismo agujero, por otra puerta.
  const qhDestino = qhOpcion === 'noshow' ? (qhEtapaNoShow ?? qhEtapa) : qhEtapa;

  /** El destino es una etapa de agenda: la reunión se AGENDA, no se "mueve". */
  const qhVaACalendly = qhOpcion === 'avanza' && !!qhDestino && esEtapaCalendly(qhDestino);

  // ¿El destino saca al lead del juego? Se pregunta SIEMPRE el motivo, aunque el
  // lead ya tenga uno viejo: `stepsForStage` devuelve [] cuando `motivo_perdida`
  // trae cualquier texto, y por eso la pérdida NUEVA se quedaba con el motivo de
  // la anterior. La decisión de repreguntar es de ESTE wizard, no del validador —
  // tocarlo allá haría que "Completar datos" repregunte el motivo de todo lead ya
  // perdido, para siempre.
  const qhPideMotivo = pideMotivo(qhDestino);
  const qhEsSalida = qhPideMotivo || (!!qhDestino && (stageMetaOpt(stages, qhDestino)?.band ?? 'pipeline') === 'salidas');
  // "¿Era calificado?" solo cuando el lead asistió Y se va por una salida: es la
  // ÚLTIMA vez que alguien mira este lead. `stepsForStage` corta en perdido/descal
  // y solo pide el motivo, y una vez en Perdido el worklist ya no lo vuelve a
  // listar nunca — el dato de CAPI se perdía para siempre. En cualquier otro
  // destino lo pide StageMoveDialog con su propio gate; preguntarlo acá sería
  // alargar el wizard por nada.
  const qhLead = queHacer ? leads.find((x) => x.id === queHacer.leadId) ?? null : null;
  // ⚠️ Y solo si la respuesta se va a poder GUARDAR. `updateLead` tiene una regla
  // de coherencia dura: sin `fecha_junta_1` o con `asistio_j1 !== true` fuerza
  // `calificado = null` (lib/leads.ts). En un pendiente de R2 con la R1 nunca
  // marcada, el wizard preguntaba —diciendo encima "es la última vez que te lo
  // podemos preguntar"— y el server tiraba la respuesta en silencio. Si el dato
  // no va a sobrevivir, la pregunta no se hace.
  const qhCalificadoPersiste = !!qhLead?.fechaJ1 && (qhCual === 'r1' || qhLead?.asistioJ1 === true);
  const qhPideCalificado = qhOpcion === 'hecha' && qhEsSalida && qhLead?.calificado == null && qhCalificadoPersiste;

  const qhMotivoFinal = motivoFinalDe(qhMotivoCat, qhMotivoDet);

  /** Los pasos de la rama en curso, en orden. Ids literales, nunca números. */
  const qhPasos: QhPasoId[] = useMemo(() => {
    if (!qhOpcion) return ['que'];
    const p: QhPasoId[] = ['que'];
    switch (qhOpcion) {
      case 'hecha':
        p.push('salida');
        if (qhPideCalificado) p.push('calificado');
        if (qhPideMotivo) p.push('motivo', 'motivoDetalle');
        break;
      case 'noshow':
        // CERO preguntas: la etapa la dicta el funnel. Solo si este funnel no la
        // modela hay que preguntarla (pantalla de excepción).
        if (!qhEtapaNoShow) p.push('noshowEtapa');
        // Y si esa etapa de excepción resulta ser una salida (Perdido/Descal), el
        // motivo se pide igual que en cualquier otro cierre: sin esto el lead se
        // cerraba heredando el `motivo_perdida` de la pérdida anterior.
        if (qhPideMotivo) p.push('motivo', 'motivoDetalle');
        break;
      case 'noshowcierra':
      case 'cierra':
        p.push('salida');
        if (qhPideMotivo) p.push('motivo', 'motivoDetalle');
        break;
      case 'avanza':
        p.push('salida');
        break;
      case 'reprog':
        p.push('fecha', 'hora');
        break;
      case 'nodecide':
      case 'sinresp':
        p.push('plazo');
        break;
    }
    p.push('resumen');
    return p;
  }, [qhOpcion, qhPideCalificado, qhPideMotivo, qhEtapaNoShow]);

  /** ¿Esta rama termina moviendo al lead de etapa? (reagendar y los plazos no.) */
  const qhMueveEtapa = (op: QhOpcion | null): boolean =>
    op === 'hecha' || op === 'noshow' || op === 'noshowcierra' || op === 'avanza' || op === 'cierra';

  const qhPasoId: QhPasoId = qhPasos[Math.min(qhPaso, qhPasos.length - 1)];
  /** El movimiento pasa por otro wizard porque el server todavía pide datos. */
  const qhHayHandoff = (qhFaltan?.length ?? 0) > 0;

  /**
   * El instante que se guardaría con la fecha y la hora elegidas — SOLO para el
   * aviso de "esa hora ya pasó". El que se guarda de verdad lo calcula el server
   * (ver reagendarReunionAction): acá no hay forma de saber la zona del negocio.
   *
   * Tres fuentes, de más a menos confiable:
   *   1. el `inicioIso` del slot, que el server ya calculó en la zona correcta;
   *   2. `reagTz` + instanteDeLocal — la MISMA función que arma la grilla, así que
   *      da exactamente el mismo instante para una hora tipeada a mano;
   *   3. el reloj del navegador, último recurso cuando no se sabe ni la zona. Acá
   *      el aviso puede errarle por el huso, pero es solo un aviso.
   */
  const reagInstante = (): number => {
    const slot = reagSlots?.find((s) => s.hora === reagHora);
    if (slot) return Date.parse(slot.inicioIso);
    const m = /^(\d{1,2}):(\d{2})$/.exec(reagHora);
    if (m && reagTz) {
      const iso = instanteDeLocal(reagFecha, Number(m[1]) * 60 + Number(m[2]), reagTz);
      if (iso) return Date.parse(iso);
    }
    return Date.parse(`${reagFecha}T${reagHora}`);
  };
  /**
   * Reagendar hacia atrás es el bucle más tonto del worklist: el lead vuelve a
   * quedar pendiente en el mismo render (y encima con la asistencia recién
   * borrada). El server filtra los horarios pasados, pero cuando Google no
   * contesta se ofrece el día entero — y el campo del selector SIEMPRE deja
   * escribir una hora que no está en la lista. Este es el único freno duro.
   */
  const reagHoraPasada = (() => {
    if (!reagFecha || !reagHora) return false;
    const ms = reagInstante();
    return Number.isFinite(ms) && ms <= Date.now();
  })();

  /** Cuántos horarios quedan REALMENTE para elegir (null = agenda no verificada). */
  const reagLibres = reagSlots ? reagSlots.filter((s) => s.libre).length : null;
  /**
   * Dónde ABRE el desplegable. Para otro día, la mañana. Para HOY, el primer
   * horario que el server dejó en pie (ya descontó lo pasado y el margen, y lo
   * hizo en la zona del WORKSPACE, que es la que vale).
   *
   * Sin agenda verificada se usa el reloj del navegador PERO leído en la zona del
   * workspace cuando se la conoce (`reagTz` llega también en las respuestas de
   * error). El ancla es solo dónde arranca el scroll: equivocarse cuesta un
   * scroll, no una reunión mal agendada.
   */
  const reagAncla = (() => {
    if (reagFecha !== hoy) return ANCLA_DEFECTO;
    if (reagSlots && reagSlots.length) return reagSlots[0].hora;
    const d = new Date(Date.now() + 60 * 60_000);
    if (reagTz) {
      try {
        const p = new Intl.DateTimeFormat('en-GB', { timeZone: reagTz, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
        const g = (t: string) => Number(p.find((x) => x.type === t)?.value);
        const min = (g('hour') % 24) * 60 + g('minute');
        if (Number.isFinite(min)) return hhmm(min);
      } catch { /* zona rota: se cae al reloj del navegador */ }
    }
    return hhmm(d.getHours() * 60 + d.getMinutes());
  })();

  const qhPuede = (() => {
    switch (qhPasoId) {
      case 'que': return qhOpcion != null;
      case 'salida': case 'noshowEtapa': return !!qhEtapa;
      case 'calificado': return qhCalificado != null;
      case 'motivo': return !!qhMotivoCat.trim();
      case 'motivoDetalle': return !!qhMotivoDet.trim();
      // El `min` del input es una restricción BLANDA (el onChange dispara igual):
      // una fecha de ayer tipeada a mano volvía al worklist al instante.
      case 'fecha': return !!reagFecha && reagFecha >= hoy;
      case 'hora': return !!reagHora && !reagHoraPasada;
      case 'plazo': return !!qhPlazo && qhPlazo >= hoy;
      // El resumen espera a saber si el server pide algo más: hasta entonces el
      // botón no puede prometer ni "listo" ni "faltan 2 datos".
      case 'resumen': return qhMueveEtapa(qhOpcion) && !qhVaACalendly ? qhFaltan !== null : true;
      default: return true;
    }
  })();

  /** Lo que el usuario ya contestó, en el formato que entiende el server. */
  const qhDatos = (): StageMoveData => ({
    ...(qhOpcion === 'noshow' ? (qhCual === 'r2' ? { asistioJ2: false } : { asistioJ1: false }) : {}),
    ...(qhSalidaElegida?.asistioJ1 != null ? { asistioJ1: qhSalidaElegida.asistioJ1 } : {}),
    ...(qhSalidaElegida?.asistioJ2 != null ? { asistioJ2: qhSalidaElegida.asistioJ2 } : {}),
    ...(qhCalificado != null ? { calificado: qhCalificado } : {}),
    ...(qhMotivoFinal ? { motivo: qhMotivoFinal } : {}),
  });

  // Al entrar al resumen: preguntarle al server qué falta para ese destino CON lo
  // ya contestado. De eso dependen el verbo del botón y si el wizard termina el
  // trabajo o se lo pasa a StageMoveDialog — y así el resumen deja de prometer
  // "esto es lo que va a pasar" para después abrir otro formulario de 5 preguntas.
  useEffect(() => {
    if (!queHacer || qhPasoId !== 'resumen' || !qhMueveEtapa(qhOpcion) || !qhDestino || qhVaACalendly) return;
    let vivo = true;
    setQhFaltan(null);
    const datos = qhDatos();
    requisitosDeEtapaAction(queHacer.leadId, qhDestino, datos)
      .then((r) => { if (vivo) setQhFaltan(r); })
      // Si la consulta falla no se bloquea el movimiento: se intenta y, si el
      // server reclama algo, el handoff lo resuelve igual.
      .catch(() => { if (vivo) setQhFaltan([]); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queHacer?.leadId, qhPasoId, qhOpcion, qhDestino, qhCalificado, qhMotivoFinal]);

  // Los horarios reales del día elegido. Se piden al ENTRAR al paso de la hora
  // (no al elegir la fecha): así la pantalla de fecha responde al instante y la
  // consulta se hace una sola vez, cuando de verdad hace falta.
  useEffect(() => {
    if (qhPasoId !== 'hora' || !reagFecha) return;
    let vivo = true;
    setReagSlotsCargando(true); setReagSlotsNota('');
    // La DURACIÓN es lo único que se manda: la jornada y el paso los decide el
    // server (horarios-respuesta.ts es la fuente única) y vuelven en `rango`.
    // Mandar acá un `desde`/`hasta` propio era volver a tener dos verdades.
    const duracion = queHacer?.duracionMin ?? DURACION_DEFECTO_MIN;
    // Con timeout propio: una red que acepta la conexión y no responde nunca
    // (proxy, captive portal, VPN a medio caer) dejaba el `cargando` prendido
    // para siempre, y con él TODA la grilla deshabilitada.
    fetch(`/api/crm/horarios?fecha=${encodeURIComponent(reagFecha)}&duracion=${duracion}`, { signal: AbortSignal.timeout(9000) })
      .then((r) => r.json())
      .then((j: RespuestaHorarios) => {
        if (!vivo) return;
        // Cómo se lee la respuesta vive en su módulo (y tiene tests): acá solo
        // se reparte en el estado.
        const r = leerRespuestaHorarios(j);
        if (r.errorTecnico) console.error('[crm/horarios]', r.errorTecnico);
        setReagSlots(r.slots);
        // La zona se guarda SIEMPRE, también sin slots (el server la manda igual
        // cuando Google falla). Antes solo se pisaba con `r.slots`: si un día
        // resolvía bien y el siguiente fallaba, quedaba pegada la zona vieja y la
        // pantalla afirmaba "Horarios en America/Montevideo" justo debajo de
        // "Agenda sin verificar" — la única vez que no se leyó ninguna.
        setReagTz(r.tz);
        setReagSlotsNota(r.nota);
        setReagRango(r.rango);
      })
      // Ni siquiera el camino de error se queda sin rango: el selector va a tener
      // que dibujar la grilla solo, que es justo cuando más lo necesita.
      // Ni el `tz` se hereda del día anterior: si esta consulta ni salió, no se
      // sabe en qué zona se están leyendo los horarios y no se puede afirmar una.
      .catch(() => { if (vivo) { setReagSlots(null); setReagTz(''); setReagSlotsNota(AVISO_SIN_AGENDA); setReagRango(normalizarRango({ duracionMin: duracion })); } })
      .finally(() => { if (vivo) setReagSlotsCargando(false); });
    return () => { vivo = false; };
  }, [qhPasoId, reagFecha, queHacer?.duracionMin]);

  /**
   * Elegir una opción del primer paso: limpia lo contestado en la rama anterior.
   *
   * Antes el click no limpiaba nada, y volver atrás para cambiar de opción dejaba
   * la respuesta vieja seleccionada y el botón de confirmar habilitado: se podía
   * confirmar una etapa elegida contestando OTRA pregunta.
   */
  const elegirQhOpcion = (v: QhOpcion) => {
    setQhOpcion(v);
    setQhEtapa(''); setQhCalificado(null); setQhMotivoCat(''); setQhMotivoDet('');
    setQhPlazo(''); setQhFaltan(null); setQhError(null); setQhNoShowPrevio(false);
    setReagFecha(''); setReagHora(''); setReagSlots(null); setReagSlotsNota('');
    setQhVisitados(['que']);
    setQhPaso(1);
  };

  /**
   * Elegir el DESTINO: limpia lo que se contestó para el destino anterior.
   *
   * Sin esto, volver atrás y cambiar de destino arrastraba la respuesta vieja:
   * los chips de motivo de Descalificado se pintaban sin ninguno seleccionado
   * (la categoría "Precio" no está en esa lista) pero el botón seguía habilitado
   * porque `qhMotivoCat` no estaba vacío, y el lead se guardaba con el motivo de
   * la otra pérdida. Igual con "calificado", que viajaba a un destino que ya no
   * lo pedía.
   */
  const elegirQhEtapa = (to: string) => {
    if (to === qhEtapa) return;
    setQhEtapa(to);
    setQhCalificado(null); setQhMotivoCat(''); setQhMotivoDet(''); setQhFaltan(null);
  };

  const qhAvanzar = () => {
    setQhError(null);
    setQhVisitados((v) => [...v, qhPasoId]);
    setQhPaso((i) => Math.min(i + 1, qhPasos.length - 1));
  };
  const qhAtras = () => {
    setQhError(null);
    const prev = qhVisitados[qhVisitados.length - 1];
    if (!prev) { cerrarQueHacer(); return; }
    setQhVisitados((v) => v.slice(0, -1));
    const i = qhPasos.indexOf(prev);
    setQhPaso(i >= 0 ? i : Math.max(0, qhPaso - 1));
  };

  /** Saltar a otra rama desde el resumen del no-show (las dos salidas secundarias). */
  const qhSaltarA = (op: QhOpcion, paso: QhPasoId) => {
    setQhError(null);
    setQhOpcion(op);
    setQhFaltan(null);
    // Se limpia lo de la rama vieja: si el funnel no tenía etapa de No Show, el
    // usuario ya eligió una en la pantalla de excepción y esa key no pertenece a
    // la lista de la rama nueva.
    setQhEtapa(''); setQhMotivoCat(''); setQhMotivoDet(''); setQhCalificado(null);
    // Atrás vuelve a la primera pregunta: es la única que sigue siendo válida en
    // las dos ramas (volver al resumen de un no-show que ya no se está marcando
    // sería mostrar un resumen de algo que el usuario descartó).
    setQhVisitados(['que']);
    // El paso se resuelve contra la lista NUEVA recién en el próximo render:
    // hasta entonces alcanza con el índice que le toca en esa rama.
    const nuevos: QhPasoId[] = op === 'reprog' ? ['que', 'fecha', 'hora', 'resumen'] : ['que', 'salida', 'resumen'];
    setQhPaso(Math.max(1, nuevos.indexOf(paso)));
  };

  /** La frase que queda en el historial: por qué se movió, en castellano llano. */
  const qhFrase = (destinoLabel: string): string => {
    const nR = qhCual === 'r2' ? 2 : 1;
    switch (qhOpcion) {
      case 'hecha': return `La Reunión ${nR} se hizo — pasa a ${destinoLabel}${qhMotivoFinal ? ` (${qhMotivoFinal})` : ''}`;
      case 'noshow': return `No se presentó a la Reunión ${nR} — pasa a ${destinoLabel}`;
      case 'noshowcierra': return `No se presentó a la Reunión ${nR} y no vuelve a intentarse — pasa a ${destinoLabel}${qhMotivoFinal ? ` (${qhMotivoFinal})` : ''}`;
      case 'avanza': return `Contestó la nutrición manual y vuelve a ${destinoLabel}`;
      case 'cierra': return `Venció la nutrición manual — pasa a ${destinoLabel}${qhMotivoFinal ? ` (${qhMotivoFinal})` : ''}`;
      default: return '';
    }
  };

  const confirmarQueHacer = () => {
    if (!queHacer || !qhOpcion) return;
    setQhError(null);
    const { leadId, cual } = queHacer;
    const l = leads.find((x) => x.id === leadId);

    // Reagendar: el modal NO se cierra — mover el evento en Google es la mitad del
    // trabajo y su resultado se cuenta acá mismo, en el paso siguiente.
    if (qhOpcion === 'reprog') {
      // Viaja la hora PELADA ('HH:MM'), nunca un instante armado acá. El navegador
      // no sabe en qué zona vive el negocio: `new Date('2026-08-10T18:00')` es hora
      // local del navegador por spec, así que un closer en otro huso guardaba un
      // momento distinto del que eligió — y con `sendUpdates=all` el invitado
      // recibía el mail con esa hora. La conversión la hace el server, que sí
      // conoce la zona del workspace, con la misma función que armó la grilla.
      const noShowPrevio = qhNoShowPrevio;
      const duracionMin = queHacer.duracionMin;
      startTransition(async () => {
        try { setReagOut(await reagendarReunionAction(leadId, cual, reagFecha, reagHora, { noShowPrevio, duracionMin })); router.refresh(); }
        catch (e) { setQhError(e instanceof Error ? e.message : 'No se pudo reagendar.'); }
      });
      return;
    }

    // Nutrición manual: el motivo NO se pregunta, se DEDUCE de la opción elegida.
    // Antes iba una frase fija ("Se extendió el plazo…") pasara lo que pasara, y
    // eso era lo que quedaba en el historial.
    if (qhOpcion === 'nodecide' || qhOpcion === 'sinresp') {
      const plazo = qhPlazo;
      const motivo = qhOpcion === 'nodecide'
        ? 'Sigue interesado pero no decide — se extiende el plazo'
        : 'No respondió — se extiende el plazo de la nutrición manual';
      cerrarQueHacer();
      setLocalStage((m) => ({ ...m, [leadId]: 'manual' }));
      startTransition(async () => {
        await markManualNutritionAction(leadId, motivo, plazo);
        router.refresh();
      });
      return;
    }

    const destino = qhDestino;
    if (!l || !destino) return;

    // Volver al pipeline desde la nutrición: si el destino es una etapa de
    // agenda, la reunión hay que AGENDARLA. Pasa por la misma intercepción que
    // el drag (¿ya ocurrió o la vas a agendar?) en vez de mover la card a mano.
    // Sin esto el lead aterrizaba en Agenda R1 con la fecha vieja de la reunión
    // que ya pasó, y volvía al worklist como pendiente en el render siguiente.
    // Solo en esta rama: en las de reunión el usuario acaba de declarar una
    // asistencia y mandarlo a Calendly perdería ese hecho.
    if (qhOpcion === 'avanza' && esEtapaCalendly(destino)) {
      cerrarQueHacer();
      scheduleViaCalendly(l, destino);
      return;
    }

    const destinoLabel = stageMetaOpt(stages, destino)?.label ?? destino;
    const datos = qhDatos();
    const move: StageMoveTarget = {
      to: destino,
      asistioJ1: datos.asistioJ1,
      asistioJ2: datos.asistioJ2,
      yaRespondido: { calificado: qhCalificado, motivo: qhMotivoFinal || null },
    };

    // Este wizard TERMINA el trabajo siempre. Si falta algo que no pregunta
    // (fechas, Fathom, Deal Details), antes se lo pasaba a StageMoveDialog: otro
    // formulario más, justo lo que hacía abandonar el CRM (08-T22). Ahora guarda,
    // y lo que falta vuelve como pendiente: se avisa en el toast, queda en la
    // ficha y MaKo lo pide después.
    const from = effStage(l);
    startTransition(async () => {
      try {
        const r = await resolverQueHacerAction(leadId, destino, datos, qhFrase(destinoLabel));
        // Red de seguridad: el server ya no devuelve ok:false por datos faltantes.
        if (!r.ok) { cerrarQueHacer(); openStageMove(l, move); return; }
        cerrarQueHacer();
        setLocalStage((m) => ({ ...m, [leadId]: destino }));
        if (from !== destino) {
          const pendientes = r.pendientes?.map((p) => p.label);
          setUndoInfo({ id: leadId, name: l.name, from, toLabel: destinoLabel, monto: l.monto || null, motivo: l.motivo || null, pendientes });
        }
        router.refresh();
      } catch (e) {
        setQhError(e instanceof Error ? e.message : 'No se pudo guardar.');
      }
    });
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

  // Importar / exportar leads: MISMO patrón que el board del plan — un botón de
  // icono que abre un formulario de a una pregunta (nada de bajar todo de una ni
  // de abrir el buscador de archivos del sistema sin avisar qué va a pasar).
  const [exportar, setExportar] = useState(false);
  const [importar, setImportar] = useState(false);
  const [nuevoLead, setNuevoLead] = useState(false);
  const { toast: avisoBoard, show: mostrarAviso, clear: limpiarAviso } = useToast();
  const [flashCsv, setFlashCsv] = useState<string | null>(null);
  // Por qué no se pudo abrir Calendly (este negocio no lo tiene configurado, el
  // event type no coincide…). Se DICE: antes, cuando no había config, el botón
  // caía a la agenda del dueño y el usuario ni se enteraba de que faltaba algo.
  const [avisoAgenda, setAvisoAgenda] = useState<string | null>(null);

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
                style={{ background: 'var(--surface-2)', borderTop: '1px solid var(--border)', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', borderLeft: overdueManual ? '3px solid var(--bad)' : '1px solid var(--border)', borderRadius: 11, padding: '13px 14px', cursor: 'grab', transition: 'opacity .15s, transform .15s, box-shadow .15s', opacity: dragId === l.id ? 0.5 : 1, transform: dragId === l.id ? 'scale(0.97)' : 'none', boxShadow: dragId === l.id ? '0 10px 26px rgba(18,21,27,.20)' : 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.25, minWidth: 0 }}>{l.name}</div>
                  {/* Sin parpadeo (08-T22). Un tablero donde cada card incompleta
                      titilaba en rojo le decía a Mauricio, apenas entraba, que tenía
                      un chorro de cosas por contestar — y lo abandonaba. Lo que falta
                      se marca, sereno; no se reclama. «Vencida» sí es una alerta (una
                      fecha que pasó) y conserva el rojo, pero tampoco titila. */}
                  {overdueManual
                    ? <span title="Venció el deadline de la nutrición manual" style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, color: 'var(--bad)', background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 999, padding: '1px 7px', whiteSpace: 'nowrap' }}><span aria-hidden>🚨</span> Vencida</span>
                    : waiting && <span title="Faltan datos de esta etapa. Se pueden completar cuando quieras: MaKo te los pide después." style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 600, color: 'var(--dim)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 999, padding: '1px 7px', whiteSpace: 'nowrap' }}><span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--warn)' }} /> Datos pendientes</span>}
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
          <AccionesHeader total={total} onImportar={() => setImportar(true)} onExportar={() => setExportar(true)} onNuevo={() => setNuevoLead(true)} />
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

      {/* No se pudo abrir la agenda: el motivo, con el lugar donde se arregla. */}
      {avisoAgenda && (
        <button type="button" onClick={() => setAvisoAgenda(null)}
          style={{ display: 'block', width: '100%', textAlign: 'left', background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 13, padding: '13px 18px', marginBottom: 14, color: 'var(--bad)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>
          {avisoAgenda}
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
                  <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 6, background: 'var(--ink)', color: 'var(--on-ink)' }}>{j.when}</span>
                  {j.warn && <span style={{ fontSize: 11, color: 'var(--bad)', background: 'var(--bad-bg)', padding: '3px 7px', borderRadius: 6 }}>⚠ {j.warnText}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.name}</span>
                  <span
                    onClick={() => { const l = leads.find((x) => x.id === j.leadId); if (l) openDetail(l); }}
                    style={{ flex: 'none', fontSize: 12, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none', cursor: 'pointer' }}
                  >Abrir →</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--dim)' }}><span style={{ color: 'var(--dim)' }}>Quiere:</span> {j.goal}</div>
                <div style={{ fontSize: 11.5, color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>☎ {j.phone}</div>
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
        {vista !== 'pendientes' && <SelectorFunnel funnels={funnels} activo={funnelActivo} />}
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
          aviso={marcarAviso}
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

      {/* Alta a mano SIN salir del tablero: el mismo form de /crm/new adentro de un
          Modal. Al crear se cierra, se abre la ficha del lead nuevo y se recarga la
          lista — el filtro, la búsqueda y el scroll quedan donde estaban.

          El toast va aparte de la ficha a propósito: si la recarga tarda o falla, la
          ficha no se abre (`selected` la busca en `leads`) y sin el aviso el botón
          se leería como que no hizo nada. */}
      {nuevoLead && (
        <Modal titulo="Nuevo lead" ancho={720} onCerrar={() => setNuevoLead(false)}>
          <NewLeadForm enModal={{
            onCerrar: () => setNuevoLead(false),
            onCreado: (id) => { setNuevoLead(false); setSelectedId(id); mostrarAviso('Lead creado'); router.refresh(); },
          }} />
        </Modal>
      )}
      <Toast state={avisoBoard} onClose={limpiarAviso} />

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
          pregunta={manualNutriPaso === 0 ? '¿Por qué pasa a nutrición manual?' : manualNutriPaso === 1 ? '¿Hasta cuándo la sigues?' : 'Revisa y confirma'}
          sub={manualNutriPaso === 0
            ? 'Cuenta el motivo del parking. Queda en el historial del lead.'
            : manualNutriPaso === 1
              ? 'Pon una fecha límite: si llega sin que el lead avance, vuelve a «datos sin marcar» en rojo.'
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
        <div onClick={cerrarQueHacer} style={{ position: 'fixed', inset: 0, zIndex: capaQueHacer.z, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: capaQueHacer.visible ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
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
              <button type="button" onClick={cerrarQueHacer} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: 'var(--ink)', color: 'var(--on-ink)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>Listo</button>
            </div>
          </div>
        </div>
      )}

      {queHacer && !reagOut && (() => {
        const esR = queHacer.tipo === 'R';
        const nR = qhCual === 'r2' ? 2 : 1;
        const etiqueta = (k: string) => stageMetaOpt(stages, k)?.label ?? k;
        const etapaLabel = etiqueta(qhEtapaActual);
        const destinoLabel = qhDestino ? etiqueta(qhDestino) : '—';

        // Paso 1 — la primera pregunta es un HECHO, no una acción de CRM.
        //
        // Este pendiente existe porque nadie sabe si la reunión que ya pasó
        // ocurrió. Preguntar "¿ya avanzó / se perdió?" era pedir la consecuencia
        // antes que la causa: por eso "Se perdió" terminaba marcando en silencio
        // que el lead había asistido. Con el hecho primero, la consecuencia se
        // deriva del funnel y nunca puede contradecirlo.
        //
        // El orden (lo bueno → la falla normal → la excepción) es el mismo que ya
        // usa el paso de asistencia de StageMoveDialog: no se inventa nada.
        const opciones: Array<{ v: QhOpcion; label: string; sub: string }> = esR
          ? [
              { v: 'hecha', label: 'Sí, la tuvimos', sub: 'Se presentó y la reunión ocurrió' },
              { v: 'noshow', label: 'No se presentó', sub: 'No apareció, o canceló y no volvió a agendar' },
              { v: 'reprog', label: 'Se reprogramó', sub: 'No se hizo: quedó para otro día y hora' },
            ]
          : [
              { v: 'avanza', label: 'Contestó y avanza', sub: 'Se reactivó: vuelve al pipeline' },
              { v: 'nodecide', label: 'Contestó, pero todavía no decide', sub: 'Sigue interesado: le doy más tiempo' },
              { v: 'sinresp', label: 'Sigue sin responder', sub: 'Le doy un plazo más antes de cerrarlo' },
              { v: 'cierra', label: 'No sigue: cerrarlo', sub: 'Sale del pipeline y se registra el motivo' },
            ];

        // Los textos en un mapa y no en una escalera de ternarios: es el patrón
        // limpio del repo (ver ExportarLeadsModal) y el único que se sigue
        // leyendo cuando la rama tiene cinco pantallas.
        const PREGUNTAS: Record<QhPasoId, { q: string; sub: string }> = {
          que: {
            q: esR ? `¿Qué pasó con la Reunión ${nR}?` : '¿Qué pasó con este lead?',
            sub: esR
              ? `La Reunión ${nR} ya pasó y nadie marcó cómo salió.`
              : 'Venció la nutrición manual sin resolverse.',
          },
          salida: {
            q: qhOpcion === 'hecha' ? `¿Cómo salió la Reunión ${nR}?`
              : qhOpcion === 'avanza' ? '¿A dónde vuelve?'
              : '¿Cómo lo cierras?',
            sub: qhOpcion === 'hecha'
              ? `Ya queda registrado que asistió a la Reunión ${nR}. Elige qué sigue.`
              : qhOpcion === 'avanza' ? 'Solo las etapas a las que tu funnel deja avanzar desde aquí.'
              : 'El lead sale del pipeline. Después te pedimos el motivo.',
          },
          noshowEtapa: {
            q: '¿A qué etapa pasa?',
            sub: 'Tu funnel no tiene una etapa de No Show para esta reunión: elige a dónde va.',
          },
          calificado: {
            q: '¿Era un lead calificado?',
            // Sin la jerga ni la presión: «CAPI» no le dice nada a nadie, y «la
            // última vez que te lo podemos preguntar» convierte un dato opcional
            // en una amenaza. Lo que hay que saber es para qué sirve.
            sub: 'Ayuda a Meta a buscar más gente como esta.',
          },
          motivo: {
            q: qhDestino === 'descal' ? '¿Por qué se descalificó?' : '¿Por qué se perdió?',
            sub: 'Elige la categoría. En la pantalla siguiente cuentas el caso concreto.',
          },
          motivoDetalle: {
            q: 'Sé específico: ¿qué pasó?',
            sub: `Categoría: ${qhMotivoCat || '—'}. Agrega el detalle concreto — es lo que se lee en el historial.`,
          },
          fecha: {
            q: `¿Para qué día quedó la Reunión ${nR}?`,
            sub: reagCal && !reagCal.conectado
              ? 'Se actualiza en el CRM y queda en el historial. Conecta tu Google Calendar para que además se mueva el evento.'
              : 'Elige el día. En la pantalla siguiente te traemos los horarios libres de tu agenda.',
          },
          hora: {
            q: '¿A qué hora?',
            // El sub describe LO QUE SE ESTÁ MOSTRANDO, y nada más. Prometía que
            // "los ocupados se ven tachados" incluso cuando la agenda no se había
            // podido leer: el usuario no veía nada tachado y concluía que tenía el
            // día libre. Ahora los ocupados directamente no se listan, así que lo
            // que hay que decir es otra cosa — cuántos quedan y que se puede
            // escribir una hora que no esté en la lista.
            sub: reagSlotsCargando ? 'Leyendo los horarios libres de tu agenda…'
              : reagLibres ? `${reagLibres} horarios libres${reagTz ? ` en ${reagTz}` : ''}. Puedes escribir cualquier otra hora, aunque no esté en la lista.`
              : reagSlots ? 'No quedan horarios libres ese día: vuelve atrás y elige otro, o escribe la hora igual.'
              : 'No pudimos verificar tu agenda: se ofrece el día entero y no se oculta nada.',
          },
          plazo: {
            q: '¿Hasta cuándo le das tiempo?',
            sub: 'Si llega esa fecha sin que el lead avance, vuelve a aparecer aquí en rojo.',
          },
          resumen: {
            q: 'Revisa y confirma',
            sub: qhVaACalendly
              ? 'La reunión hay que agendarla: seguimos ahí.'
              : qhMueveEtapa(qhOpcion) && qhFaltan === null
              ? 'Revisando qué datos faltan para esa etapa…'
              : qhHayHandoff
                ? 'Se guarda igual. Lo que falta queda pendiente en la ficha y MaKo te lo pide después.'
                : 'Esto es lo que va a pasar cuando confirmes.',
          },
        };

        // ── Resumen: la frase concreta de lo que se va a hacer ──
        const filas: Array<[string, string]> = [['Lead', queHacer.name]];
        if (qhOpcion === 'reprog') {
          filas.push([`Reunión ${nR}`, `pasa al ${fmtDDMMYYYY(reagFecha)} a las ${horaLegible(reagHora)}`]);
          filas.push(['Asistencia', 'queda sin marcar hasta esa fecha']);
          // `reagCal` en null es "todavía no sé" (la consulta viaja o falló), y
          // no "sí se mueve": prometerlo era afirmar algo que no se puede saber.
          filas.push(['Google Calendar', !reagCal
            ? 'si tu agenda está conectada, se mueve el evento (te lo confirmamos al terminar)'
            : !reagCal.conectado
              ? 'no hay agenda conectada: solo se actualiza el CRM'
              : !reagCal.puedeMover
                ? 'no se va a mover: tu permiso es de solo lectura, reconéctalo'
                : 'se mueve el evento y se le avisa al invitado']);
          if (qhNoShowPrevio) filas.push([`Reunión ${nR} anterior`, 'queda registrado que no se presentó']);
        } else if (qhOpcion === 'nodecide' || qhOpcion === 'sinresp') {
          filas.push(['Nutrición manual', `nuevo plazo hasta el ${fmtDDMMYYYY(qhPlazo)}`]);
          filas.push(['Si llega esa fecha', 'vuelve a aparecer aquí en rojo']);
        } else {
          if (esR) filas.push([`Reunión ${nR}`, qhOpcion === 'hecha' ? 'sí, asistió' : 'no se presentó']);
          filas.push(['Etapa', `${etapaLabel} → ${destinoLabel}`]);
          if (qhVaACalendly) filas.push(['La reunión', 'te preguntamos si ya ocurrió o la agendas por Calendly']);
          if (qhOpcion === 'noshow') filas.push(['La etapa', 'la define tu funnel: se activa la secuencia de recuperación de No Show']);
          if (qhCalificado != null) filas.push(['Calificado', qhCalificado ? 'sí' : 'no']);
          if (qhMotivoFinal) filas.push(['Motivo', qhMotivoFinal]);
          if (qhHayHandoff) filas.push(['Queda pendiente', (qhFaltan ?? []).map((f) => f.label).join(' · ')]);
        }

        // El botón dice el VERBO de lo que hace. "Continuar" a secas era el tell de
        // que el wizard no terminaba el trabajo.
        const confirmLabel =
          qhOpcion === 'reprog' ? 'Reagendar'
          : qhOpcion === 'nodecide' || qhOpcion === 'sinresp' ? 'Guardar el nuevo plazo'
          : qhVaACalendly ? `Agendar ${destinoLabel} →`
          : qhFaltan === null ? 'Revisando qué datos faltan…'
          // Sin «Continuar: faltan N datos →»: ya no hay otro formulario después
          // (08-T22). El botón dice lo que hace, y lo que falta queda pendiente.
          : qhOpcion === 'noshow' ? `Marcar el no-show y pasar a ${destinoLabel}`
          : qhDestino === 'perdido' ? 'Dar por perdido'
          : qhDestino === 'descal' ? 'Descalificarlo'
          : qhDestino === 'noresp' ? 'Marcar como No responde'
          : `Mover a ${destinoLabel}`;

        const btnOpcion = (activo: boolean): CSSProperties => ({
          width: '100%', textAlign: 'left', padding: '13px 16px', borderRadius: 12, fontFamily: SANS, cursor: 'pointer',
          background: activo ? 'var(--ink)' : 'var(--surface)',
          border: '1px solid ' + (activo ? 'var(--ink)' : 'var(--border-strong)'),
          color: activo ? 'var(--on-ink)' : 'var(--ink)',
        });

        /** Grilla de desenlaces con el separador "No sigue" antes de los negativos. */
        const listaSalidas = (ops: OpcionSalida[]) => {
          let separado = false;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ops.map((o) => {
                // El negativo no puede leerse como una opción más de la misma lista:
                // ese fue el reclamo de "ya avanzó y me ofrecés Perdido".
                const primeroNegativo = o.category === 'perdida' && !separado && ops.some((x) => x.category !== 'perdida');
                if (primeroNegativo) separado = true;
                const activo = qhEtapa === o.to;
                return (
                  <div key={o.to} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {primeroNegativo && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0 0' }}>
                        <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' }}>No sigue</span>
                        <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                      </div>
                    )}
                    <button type="button" onClick={() => elegirQhEtapa(o.to)} style={btnOpcion(activo)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 14.5, fontWeight: 700 }}>
                        <span aria-hidden style={{ width: 9, height: 9, borderRadius: '50%', flex: 'none', background: stageMetaOpt(stages, o.to)?.dot ?? CATEGORY[o.category].c }} />
                        {o.label}
                      </div>
                      {o.sub && o.sub !== o.label && (
                        <div style={{ fontSize: 12.5, fontWeight: 500, marginTop: 2, marginLeft: 18, color: activo ? 'rgba(255,255,255,.72)' : 'var(--dim)' }}>{o.sub}</div>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          );
        };

        /** Link de texto: las salidas secundarias del resumen del no-show. */
        const linkSalida = (texto: string, onClick: () => void) => (
          <button type="button" onClick={onClick}
            style={{ alignSelf: 'flex-start', padding: 0, border: 'none', background: 'none', color: 'var(--primary)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS, textAlign: 'left' }}>
            {texto}
          </button>
        );

        return (
          <WizardShell
            titulo={`¿Qué hacer ahora? · ${queHacer.name}`}
            // En la primera pantalla el largo de la rama TODAVÍA no se sabe: los
            // dots decían "1 paso" y saltaban a 3 al elegir. Sin dots es honesto.
            total={qhOpcion ? qhPasos.length : 0}
            idx={Math.min(qhPaso, qhPasos.length - 1)}
            pregunta={PREGUNTAS[qhPasoId].q}
            sub={PREGUNTAS[qhPasoId].sub}
            error={qhError}
            puedeAvanzar={qhPuede}
            enUltimo={qhPasoId === 'resumen'}
            confirmLabel={confirmLabel}
            pending={isPending}
            atrasLabel={qhPaso === 0 ? 'Cancelar' : 'Atrás'}
            onClose={cerrarQueHacer}
            onAtras={qhAtras}
            onSiguiente={qhAvanzar}
            onConfirmar={confirmarQueHacer}
            ancho={560}
          >
            {qhPasoId === 'que' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {opciones.map((o) => (
                  <button key={o.v} type="button" onClick={() => elegirQhOpcion(o.v)} style={btnOpcion(qhOpcion === o.v)}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{o.label}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 500, marginTop: 2, color: qhOpcion === o.v ? 'rgba(255,255,255,.72)' : 'var(--dim)' }}>{o.sub}</div>
                  </button>
                ))}
              </div>
            )}

            {(qhPasoId === 'salida' || qhPasoId === 'noshowEtapa') && listaSalidas(
              qhPasoId === 'noshowEtapa' ? salidasNoShowExcepcion : qhSalidas,
            )}

            {qhPasoId === 'calificado' && (
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                {([[true, 'Sí, calificado'], [false, 'No calificado']] as const).map(([v, lbl]) => (
                  <button key={lbl} type="button" onClick={() => setQhCalificado(v)}
                    style={{ minWidth: 160, padding: '13px 22px', borderRadius: 12, fontFamily: SANS, fontSize: 14.5, fontWeight: 700, cursor: 'pointer', background: qhCalificado === v ? 'var(--ink)' : 'var(--surface)', border: '1px solid ' + (qhCalificado === v ? 'var(--ink)' : 'var(--border-strong)'), color: qhCalificado === v ? 'var(--on-ink)' : 'var(--ink)' }}>
                    {lbl}
                  </button>
                ))}
              </div>
            )}

            {qhPasoId === 'motivo' && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {motivosDeSalida(qhDestino).map((s) => (
                  <button key={s} type="button" onClick={() => setQhMotivoCat(s)}
                    style={{ padding: '9px 15px', borderRadius: 11, fontSize: 13.5, fontWeight: 700, fontFamily: SANS, cursor: 'pointer', background: qhMotivoCat === s ? 'var(--ink)' : 'var(--surface)', border: '1px solid ' + (qhMotivoCat === s ? 'var(--ink)' : 'var(--border-strong)'), color: qhMotivoCat === s ? 'var(--on-ink)' : 'var(--ink)' }}>
                    {s}
                  </button>
                ))}
              </div>
            )}

            {qhPasoId === 'motivoDetalle' && (
              <textarea value={qhMotivoDet} onChange={(e) => setQhMotivoDet(e.target.value)} autoFocus
                placeholder="Ej: pidió la mitad del precio y no hubo margen; se fue con la agencia de un conocido…"
                style={{ ...wizardInput, minHeight: 96, textAlign: 'left', lineHeight: 1.5 }} />
            )}

            {qhPasoId === 'fecha' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Opciones antes que tipear: los tres días que cubren casi todo. */}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {([['Mañana', 1], ['En 3 días', 3], ['La semana que viene', 7]] as const).map(([lbl, d]) => {
                    const iso = masDiasISO(hoy, d);
                    return (
                      <button key={lbl} type="button" onClick={() => { setReagFecha(iso); setReagHora(''); }}
                        style={{ padding: '9px 15px', borderRadius: 11, fontSize: 13.5, fontWeight: 700, fontFamily: SANS, cursor: 'pointer', background: reagFecha === iso ? 'var(--ink)' : 'var(--surface)', border: '1px solid ' + (reagFecha === iso ? 'var(--ink)' : 'var(--border-strong)'), color: reagFecha === iso ? 'var(--on-ink)' : 'var(--ink)' }}>
                        {lbl}
                      </button>
                    );
                  })}
                </div>
                <input type="date" value={reagFecha} min={hoy} onChange={(e) => { setReagFecha(e.target.value); setReagHora(''); }} aria-label="Fecha nueva"
                  style={{ ...wizardInput, maxWidth: 260, margin: '0 auto', display: 'block' }} />
                {/* Conectar la agenda va ACÁ y no en la pantalla de horarios: ahí ya
                    sería tarde para que sirva de algo. */}
                {reagCal && !reagCal.puedeMover && (
                  <button type="button" onClick={() => router.push('/integraciones')} style={{ alignSelf: 'center', padding: 0, border: 'none', background: 'none', color: 'var(--primary)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS, textDecoration: 'underline' }}>
                    {reagCal.conectado ? 'Reconectar para poder mover reuniones →' : 'Conectar Google Calendar →'}
                  </button>
                )}
              </div>
            )}

            {qhPasoId === 'hora' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Los horarios salen de la agenda REAL (freeBusy). Si Google no
                    contesta llegan en null y el selector ofrece el día entero sin
                    ocultar nada: perder la ayuda no puede impedir reagendar. */}
                <SelectorHora
                  value={reagHora}
                  onChange={setReagHora}
                  ariaLabel="Hora nueva"
                  slots={reagSlots}
                  cargando={reagSlotsCargando}
                  rango={reagRango}
                  ancla={reagAncla}
                  // La zona ya la dice el sub del paso cuando hay horarios; acá va
                  // solo el motivo del server, para no repetir la misma frase dos
                  // veces una debajo de la otra.
                  nota={reagSlotsNota || (reagTz && !reagLibres ? `Horarios en ${reagTz}.` : null)}
                />
                {reagHoraPasada ? (
                  <div style={{ fontSize: 12.5, color: 'var(--bad)', lineHeight: 1.45 }}>
                    Esa hora ya pasó: el lead volvería a quedar pendiente al instante. Elige otra hora o cambia el día.
                  </div>
                ) : (
                  <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>Vuelve a quedar pendiente recién a esa hora.</div>
                )}
              </div>
            )}

            {qhPasoId === 'plazo' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {([['1 semana', 7], ['2 semanas', 14], ['1 mes', 30]] as const).map(([lbl, d]) => {
                    const iso = masDiasISO(hoy, d);
                    return (
                      <button key={lbl} type="button" onClick={() => setQhPlazo(iso)}
                        style={{ padding: '9px 15px', borderRadius: 11, fontSize: 13.5, fontWeight: 700, fontFamily: SANS, cursor: 'pointer', background: qhPlazo === iso ? 'var(--ink)' : 'var(--surface)', border: '1px solid ' + (qhPlazo === iso ? 'var(--ink)' : 'var(--border-strong)'), color: qhPlazo === iso ? 'var(--on-ink)' : 'var(--ink)' }}>
                        + {lbl}
                      </button>
                    );
                  })}
                </div>
                <input type="date" value={qhPlazo} min={hoy} onChange={(e) => setQhPlazo(e.target.value)} aria-label="Nuevo plazo"
                  style={{ ...wizardInput, maxWidth: 260, margin: '0 auto', display: 'block' }} />
              </div>
            )}

            {qhPasoId === 'resumen' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <ResumenFilas filas={filas} />
                {/* Las dos salidas del no-show que NO merecen una pregunta extra
                    para los otros noventa casos: van acá, donde el usuario mira. */}
                {qhOpcion === 'noshow' && (
                  <>
                    {linkSalida('Ya tengo la fecha nueva →', () => { setQhNoShowPrevio(true); qhSaltarA('reprog', 'fecha'); })}
                    {salidasNoShowCierre.length > 0 && linkSalida('No vuelve a intentarse: cerrarlo →', () => qhSaltarA('noshowcierra', 'salida'))}
                  </>
                )}
              </div>
            )}
          </WizardShell>
        );
      })()}

      {/* ¿La reunión ya ocurrió o se va a agendar? Paso previo a Calendly */}
      {meetingChoice && (
        <div onClick={() => setMeetingChoice(null)} style={{ position: 'fixed', inset: 0, zIndex: capaMeeting.z, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: capaMeeting.visible ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
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
                : 'Revisa y confirma'}
            sub={mmPaso === 0
              ? (esPasada ? 'La reunión ya ocurrió: regístrala a mano (sin Calendly) para avanzar el lead.' : 'Ya está agendada por fuera de Calendly. Carga la fecha; la asistencia se marca cuando ocurra.')
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
                    <button key={lbl} onClick={() => setMmAsistio(v)} style={{ minWidth: 120, padding: '12px 16px', borderRadius: 12, border: `1px solid ${mmAsistio === v ? 'var(--ink)' : 'var(--border-strong)'}`, background: mmAsistio === v ? 'var(--ink)' : 'var(--surface)', color: mmAsistio === v ? 'var(--on-ink)' : 'var(--ink)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>{lbl}</button>
                  ))}
                </div>
              ) : (
                <textarea value={mmNota} onChange={(e) => setMmNota(e.target.value)} autoFocus placeholder="Cuenta el motivo de la excepción…" style={{ ...wizardInput, minHeight: 90, textAlign: 'left', lineHeight: 1.5 }} />
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
        <div role="status" style={{ position: 'fixed', left: '50%', bottom: 28, transform: 'translateX(-50%)', zIndex: 70, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px 14px', maxWidth: 'min(640px, calc(100vw - 32px))', background: '#14161B', color: '#F3F5F8', padding: '12px 16px', borderRadius: 12, boxShadow: '0 12px 32px rgba(18,21,27,.35)', fontFamily: SANS, fontSize: 14 }}>
          <span><strong>{undoInfo.name}</strong> → {undoInfo.toLabel}</span>
          {/* Lo que falta se AVISA, no se pide (08-T22): el movimiento ya está
              guardado. «Completar ahora» es opcional; si nadie lo toca, queda
              pendiente en la card y en la ficha, y MaKo lo pide después. */}
          {!!undoInfo.pendientes?.length && (
            <>
              <span style={{ color: 'rgba(243,245,248,.72)', fontSize: 13 }}>
                Queda pendiente: {undoInfo.pendientes.join(' · ')}
              </span>
              <button type="button" onClick={() => {
                const l = leads.find((x) => x.id === undoInfo.id);
                setUndoInfo(null);
                if (l) openStageMove(l, { to: effStage(l) });
              }} style={{ background: '#F3F5F8', border: 'none', color: '#14161B', fontWeight: 700, fontSize: 13.5, padding: '6px 12px', borderRadius: 9, cursor: 'pointer', fontFamily: SANS }}>Completar ahora</button>
            </>
          )}
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
  // Mismo caso que los dos de CrmBoard: estaba en `zIndex: 100` contra una pila
  // que arranca en 130.
  const capaBulk = useCapaModal(!!open);
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
        <div onClick={() => !pending && setOpen(null)} style={{ position: 'fixed', inset: 0, zIndex: capaBulk.z, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: capaBulk.visible ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 30px 70px rgba(18,21,27,.35)', padding: '22px 24px' }}>
            <h3 style={{ fontWeight: 700, fontSize: 18, margin: '0 0 4px', color: 'var(--ink)' }}>Asignar {open.label} a {open.ids.length} lead{open.ids.length === 1 ? '' : 's'}</h3>
            <p style={{ fontSize: 13, color: 'var(--dim)', margin: '0 0 16px', lineHeight: 1.45 }}>
              {open.field === 'setter' ? 'El que agendó la reunión.' : 'El que corrió la llamada de venta.'} Elígelo de tu equipo. Solo rellena los que están vacíos.
            </p>
            {equipo.length > 0 ? (
              <Dropdown value={sel} options={opts} onChange={setSel} placeholder="Elige del equipo…" width="100%" ariaLabel={open.label} />
            ) : (
              <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.5, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                Todavía no tienes equipo configurado. Agrega a tus setters y closers en <b>Configuraciones › Equipo</b> y después vas a poder asignarlos aquí.
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
          // El porqué —que la empresa muchas veces no se tiene, que el aviso sigue
          // vivo adentro de cada ficha y que se puede reactivar— vive acá y no en el
          // modal: son 33 palabras para una acción reversible, y el techo de una
          // confirmación es UNA frase con la consecuencia (AGENTS.md).
          message="Deja de contar en el CRM. El aviso sigue en cada ficha."
          confirmLabel={`Ignorar en los ${idsEmpresa.length}`}
          loading={pending}
          onConfirm={ignorarEmpresa}
          onCancel={() => setOpenEmpresa(false)}
        />
      )}

      {openIgnorar && (
        <ConfirmDialog
          title={`Ignorar los datos sin marcar de ${idsIgnorar.length} lead${idsIgnorar.length === 1 ? '' : 's'}`}
          message="Salen del worklist. Sus avisos siguen en cada ficha."
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
  marcar, aviso = '', equipo, onSolucionar, onQueHacer, onBulkDone,
}: {
  marcar: CrmMarcar[];
  /** Texto de "esta lista puede estar incompleta". Vacío = se leyó todo. */
  aviso?: string;
  equipo: MiembroEquipo[];
  onSolucionar: (leadId: number) => void;
  onQueHacer: (leadId: number) => void;
  onBulkDone: () => void;
}) {
  const btn: CSSProperties = { flex: 'none', padding: '9px 18px', borderRadius: 10, border: 'none', background: 'var(--bad)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS };
  const ghost: CSSProperties = { flex: 'none', padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS };
  const [ignorando, startIgnorar] = useTransition();
  const [ignId, setIgnId] = useState<number | null>(null);
  const { toast, show, clear } = useToast();
  // ⚠️ IGNORAR NO PREGUNTA, AVISA CON DESHACER (27/09/2026). Antes abría un
  // ConfirmDialog de tres renglones sobre algo que el propio texto declaraba
  // reversible — y es la acción que MÁS se usa del worklist (21 leads ignorados en
  // el workspace del dueño). La red no se pierde: el toast deja la salida puesta
  // cinco segundos, que es la misma regla que ya declara app/_ui/Toast.tsx.
  const ignorar = (m: CrmMarcar) => {
    setIgnId(m.leadId);
    startIgnorar(async () => {
      try {
        await ignorarPendientesAction(m.leadId);
        onBulkDone();
        // Tres palabras y el nombre: qué pasó y a quién. El porqué (sigue en la
        // ficha, se puede reactivar) no va acá — va en el comentario y en la ficha.
        show(<>Ignorado · <b>{m.name}</b></>, () => deshacerIgnorar(m.leadId));
      } catch (e) {
        show(`No se pudo ignorar: ${e instanceof Error ? e.message : 'error'}`, undefined, 'bad');
      } finally { setIgnId(null); }
    });
  };

  // Deshacer escribe en el SERVER, no solo en la pantalla: lo ignorado ya se guardó,
  // así que revertir solo el estado local sería mentir hasta el próximo F5.
  const deshacerIgnorar = (leadId: number) => {
    startIgnorar(async () => {
      try { await reactivarPendientesAction(leadId); onBulkDone(); }
      catch (e) { show(`No se pudo deshacer: ${e instanceof Error ? e.message : 'error'}`, undefined, 'bad'); }
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
      {aviso && marcar.length > 0 && (
        <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, background: 'var(--warn-fill)', border: '1px solid var(--warn)', color: 'var(--ink)', fontSize: 13, lineHeight: 1.45 }}>
          {aviso}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {marcar.map((m) => (
          <div key={m.id} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '15px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              {/* ⚠️ LA FILA NO ES EL MENSAJE DEL SERVER. Ese mensaje trae el detalle
                  pegado al final y con 20 pendientes son 20 párrafos donde lo único
                  que cambia está al final. Se parte en dos: el motivo como texto y
                  los faltantes como chips (`./worklist-fila`). El dato no se toca —
                  `mensaje` sigue entero para los avisos y para «Marcar en lote». */}
              <div style={{ minWidth: 240, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: 15.5, color: 'var(--ink)' }}>{m.name}</span>
                  {m.company && <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>{m.company}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginTop: 5 }}>
                  {motivoCorto(m.message) && (
                    <span style={{ fontSize: 13, color: 'var(--dim)' }}>{motivoCorto(m.message)}</span>
                  )}
                  {(() => {
                    const { chips, resto } = chipsFaltantes(m.faltantes);
                    return (<>
                      {chips.map((f) => (
                        <span key={f.id} style={{ flex: 'none', fontSize: 11.5, fontWeight: 600, color: 'var(--dim)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 999, padding: '2px 9px' }}>{f.label}</span>
                      ))}
                      {resto > 0 && (
                        <span style={{ flex: 'none', fontSize: 11.5, color: 'var(--dim)' }}>+{resto}</span>
                      )}
                    </>);
                  })()}
                </div>
              </div>
              {/* Solucionar abre el wizard de datos. La nutrición manual vencida
                  pregunta "¿qué hacer ahora?" (elegir la etapa destino). "Ignorar"
                  saca el lead del worklist (sigue con sus avisos en la ficha). */}
              {m.tipo === 'M' || m.tipo === 'R'
                ? <button type="button" style={{ ...btn, background: 'var(--warn-fill)' }} onClick={() => onQueHacer(m.leadId)}>¿Qué hacer ahora?</button>
                : (
                  <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
                    <button type="button" style={btn} onClick={() => onSolucionar(m.leadId)}>Solucionar</button>
                    <button type="button" style={ghost} disabled={ignorando && ignId === m.leadId} onClick={() => { clear(); ignorar(m); }}>
                      {ignorando && ignId === m.leadId ? 'Ignorando…' : 'Ignorar'}
                    </button>
                  </div>
                )}
            </div>
          </div>
        ))}
        {/* El ✓ verde es una AFIRMACIÓN, y solo se puede hacer si la lista se pudo
            calcular entera. Con una lectura caída la lista también llega vacía, y
            celebrar ahí es el peor final posible: el usuario deja de mirar. */}
        {marcar.length === 0 && (aviso
          ? <div style={{ padding: 28, textAlign: 'center', color: 'var(--warn)', fontSize: 14.5, fontWeight: 600, lineHeight: 1.5 }}>{aviso}<br /><span style={{ fontWeight: 500, color: 'var(--dim)', fontSize: 13 }}>Recarga en un momento: no se puede afirmar que no haya nada pendiente.</span></div>
          : <div style={{ padding: 36, textAlign: 'center', color: 'var(--good)', fontSize: 15.5, fontWeight: 600 }}>✓ Todo marcado — datos al día.</div>)}
      </div>
      </div>

      <Toast state={toast} onClose={clear} />
    </div>
  );
}

// Los controles del header y de la barra (acciones, vista, buscador, filtros y
// bandas) viven en ./CrmToolbar. La gestión de etapas y transiciones vive en la
// tab /funnel (FunnelEditor), a la que se llega desde el menú "···".
