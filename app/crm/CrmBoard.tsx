'use client';

// =============================================================================
// CrmBoard — tablero del CRM (rediseño Marketing OS)
// =============================================================================
// Réplica fiel del prototipo (Dashboard CRM.dc.html) sobre datos reales de
// Supabase. Persisten: mover de etapa, Closer, Setter, links de Fathom, motivo
// y borrar lead (server actions). Plan de pagos / cuotas / nutrición se editan
// en sesión (no se persisten en esta iteración).

import { useSearchParams, usePathname } from 'next/navigation';
import { empujeDeColumna } from './arrastre-columna';
import { fotoVaciaDeArrastre, useArrastreCopia } from '@/app/plan/board/arrastre-copia';
import { useRouter } from '@/app/_ui/Link';
import { Fragment,
  useCallback,
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
  esTerminal,
  etapasVisibles,
  MAX_LABEL_ETAPA,
  terminalEstadoFor,
} from '@/lib/pipeline';
// Sin 'server-only' a propósito (ver su cabecera): es la fuente única del mapeo
// etapa→R1/R2, y la usa también este componente de cliente.
import { useCapaModal } from '@/app/_components/pila-modales';
import { slotDeReunion } from '@/lib/funnel-etapas';
import type { EstadoLead, FathomLink } from '@/lib/leads';
import { montoDeTarjeta, type VentaTipo } from '@/lib/venta-tipo';
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
  editarEtapaAction,
  eliminarLeadsAction,
  type OpEtapa,
} from './actions';
import type { ReagendarResultado, StageMoveData } from './actions';
import { ImportarLeadsModal } from './ImportarLeadsModal';
import { EtapasModal } from './EtapasModal';
import { TraerDeOtroProducto } from './TraerDeOtroProducto';
import { CampanasModal } from './CampanasModal';
import { FlechaDerechaIcon, FlechaIzquierdaIcon } from './iconos';
import { ExportarLeadsModal } from './ExportarLeadsModal';
import { LeadEditModal } from './LeadEditModal';
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
  FiltroChips,
  SinResultados,
  VistaSelector,
  type CrmVista,
  type FiltroAbierto,
  type FiltroCat,
  type ListaFiltro,
} from './CrmToolbar';
import { opcionesDeFiltro, SIN_ORIGEN_ADS } from '@/lib/campana-atribucion';
import { antesDeQuien, columnaConInsercion, mismaLista } from '@/app/customer-success/orden-manual';
import { ordenarKanbanManual, ORDEN_KANBAN, type OrdenKanban } from './orden-kanban';
import { ordenarColumnaCrmAction } from './orden-actions';
import { moverEtapaEnProductoAction } from './lead-funnel-actions';
import { cambiarCursoAlGanarAction } from './curso-al-ganar-actions';

import { Toast, useToast } from '@/app/_ui/Toast';
import { motivoCorto, chipsFaltantes } from './worklist-fila';
import { Modal } from '@/app/_ui/Modal';
import { NewLeadForm } from './new/NewLeadForm';
import { AccionesLoteLeads } from './AccionesLoteLeads';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

// ── Tipos del view-model (los arma el server en page.tsx) ──
export type CrmLead = {
  id: number;
  name: string;
  email: string;
  company: string;
  origin: string;
  /** De qué campaña y de qué creativo vino (lib/campana-atribucion.ts → `origenAds`). La
   *  clave es el id; `null` = no se sabe. Alimentan los filtros «Campaña» y «Creativo». */
  campanaKey?: string | null;
  campanaNombre?: string | null;
  anuncioKey?: string | null;
  anuncioNombre?: string | null;
  stage: string;
  /**
   * El producto en el que este lead es un AGREGADO (mig 0207): está en este tablero por una
   * fila de `lead_funnel` y no porque sea su casa. Ausente = este tablero ES su casa.
   *
   * ⚠️ CAMBIA QUÉ ESCRIBE MOVER SU TARJETA. Con `deFila`, soltarla en otra columna escribe la
   * etapa de ESA fila (`moverEtapaEnProductoAction`) y nada más: ni `setLeadStageAction`, ni
   * la nutrición manual, ni la agenda, ni las señales a Meta, que son del recorrido de la casa.
   */
  deFila?: number;
  derivedStage: string;
  /** La etapa guardada que este funnel ya no contiene. null = está donde dice. */
  stageFuera?: string | null;   // posición real en el funnel (ignora override) — para el worklist
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
  /**
   * El tipo de venta guardado (`leads.venta_tipo`). Lo lee `leadToMoveInfo` para el wizard.
   *
   * ⚠️ OBLIGATORIO A PROPÓSITO. Faltaba (07/10/2026), y a un becado (#747) ya marcado el
   * wizard del tablero le volvía a pedir el monto: `stepsForStage` sin el tipo no sabe que
   * es «sin cobro», el placeholder entra en la UNIÓN con el server, y el paso del tipo
   * abría en «Pago único». «Guardar y completar después» escribía `venta_tipo = 'unico'`
   * y el becado volvía a contar como venta de US$0. Opcional, un mapper nuevo lo olvida.
   */
  ventaTipo: VentaTipo | null;
  /**
   * La mensualidad y el plazo de una SUSCRIPCIÓN (null si no lo es), de `suscripcionDeFila`.
   *
   * ⚠️ OBLIGATORIOS por lo mismo que `ventaTipo`. Una suscripción guarda su plata acá y deja
   * `monto` (= monto_cierre_usd) en 0: sin estos dos la tarjeta de Ganado decía «$0» con 444
   * guardados (08/10/2026), y `leadToMoveInfo` reabría el wizard con el monto vacío, que al
   * guardar escribía NULL encima de la mensualidad.
   */
  suscripcionMonto: number | null;
  suscripcionMeses: number | null;
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

// La plata de la tarjeta y de la lista ya no se formatea acá: la dibuja `montoDeTarjeta`
// (lib/venta-tipo.ts), que sabe que una suscripción es «$X/mes» y un becado «Sin cobro».

/** Los rotulos de los controles de una fila. Viven en una funcion y no inline porque
 *  cada uno sale DOS veces (el `title` que se ve al pasar el cursor y el `aria-label`
 *  que se anuncia), y dos copias de un texto divergen a la primera correccion. */
const rotQuitar = (nombre: string) => `Quitar «${nombre}» de la selección`;
const rotPoner = (nombre: string) => `Seleccionar «${nombre}»`;
const rotWa = (nombre: string) => `Escribirle a ${nombre} por WhatsApp`;
const rotEliminar = (nombre: string) => `Eliminar «${nombre}»`;
/** El telefono ya viene solo-digitos (`telefonoNorm`), que es lo que wa.me espera. */
const waDe = (telefono: string) => `https://wa.me/${telefono}`;

function IconoWhatsapp() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2m0 2a8 8 0 1 1-4.1 14.9l-.3-.2-2.5.7.7-2.4-.2-.3A8 8 0 0 1 12 4m-3.4 4c-.2 0-.5 0-.7.4-.2.4-.8.9-.8 2s.8 2.3.9 2.4c.1.2 1.6 2.6 4 3.5 1.9.8 2.3.6 2.8.6.4 0 1.3-.5 1.5-1.1.2-.5.2-1 .1-1.1l-.6-.3-1.4-.7c-.2 0-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.1-.3 0-.4.1-.5l.4-.5.2-.4v-.4l-.7-1.6c-.1-.4-.3-.4-.4-.4Z" />
    </svg>
  );
}
function IconoTachoFila() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </svg>
  );
}

/** Por que columna se ordena la tabla. */
type OrdenTabla = 'nombre' | 'empresa' | 'origen' | 'etapa' | 'agenda' | 'monto' | 'creado';

/** Las columnas de la tabla, en una sola constante: la usan el encabezado Y cada fila.
 *  Con dos listas, agregar una columna desalinea la tabla entera y no lo dice nadie. */
const COLS_TABLA = '34px 2fr 1.4fr 1.5fr 1.25fr .95fr .95fr .8fr 64px';

/**
 * Un encabezado que ORDENA. Copiado del `Th` de la tabla del plan
 * (app/plan/board/Tablas.tsx), con lo mismo que lo hace usable ahi:
 *
 *   · sin `onSort` no dibuja boton — una columna que no se puede ordenar no finge que si;
 *   · la flecha sale SOLO en la columna activa, o siete flechas grises compiten con los
 *     rotulos y ninguna dice nada;
 *   · `aria-sort` para que se anuncie, que es lo unico que le queda a quien no ve la flecha.
 */
function ThCrm({ children, activo, dir, onSort, alinear = 'left' }: {
  children: ReactNode;
  activo?: boolean;
  dir?: 'asc' | 'desc';
  onSort?: () => void;
  alinear?: 'left' | 'right';
}) {
  const base: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 4, minWidth: 0,
    justifyContent: alinear === 'right' ? 'flex-end' : 'flex-start',
  };
  if (!onSort) return <span style={base}>{children}</span>;
  return (
    <span style={base} aria-sort={activo ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={onSort}
        title={`Ordenar por ${typeof children === 'string' ? children.toLowerCase() : 'esta columna'}`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, padding: 0, border: 0,
          background: 'none', cursor: 'pointer', font: 'inherit', letterSpacing: 'inherit',
          textTransform: 'inherit', color: activo ? 'var(--ink)' : 'inherit',
          fontWeight: activo ? 700 : 'inherit',
        }}>
        {children}
        {activo && <span aria-hidden style={{ fontSize: 9, lineHeight: 1 }}>{dir === 'asc' ? '▲' : '▼'}</span>}
      </button>
    </span>
  );
}

/**
 * Las tres bandas del Kanban, en el orden en que se dibujan.
 *
 * ⚠️ LAS TRES ARRANCAN ENCENDIDAS, Y NO SE RECUERDA LO QUE SE APAGÓ. Es pedido
 * explícito de Martín, el 27/09/2026: «tampoco hagas que al entrar al CRM esté
 * desmarcado nutrición y descartado, que estén siempre activos».
 *
 * Esto REVIERTE lo que se había hecho ese mismo día por la fila «el tablero abre con
 * todo» del plan de fricción (tanda 3), que las hacía arrancar sólo con `pipeline` y
 * recordaba la elección por navegador. El argumento de esa fila sigue siendo cierto
 * —1.089 tarjetas de nutrición alrededor de las 26 que se trabajan— y aun así pierde:
 * entrar al tablero y no ver un lead que uno sabe que existe es peor que verlo entre
 * muchos, y el toggle para apagarlas sigue ahí, con su conteo al lado.
 *
 * Y no se recuerda a propósito: con persistencia, apagar nutrición UNA vez hacía que
 * cada entrada siguiente empezara con ella apagada — que es exactamente «al entrar
 * está desmarcado», el mismo síntoma por otra puerta. Dentro de la sesión el toggle
 * funciona igual.
 */
const KANBAN_BANDS: StageBand[] = ['pipeline', 'nutricion', 'salidas'];
/**
 * La línea de 2 px que dice dónde va a caer la columna que se está arrastrando.
 *
 * Las mismas dos del pop-up de etapas (`MARCA` / `MARCA_FIN` en app/crm/EtapasModal.tsx),
 * giradas: ahí la lista es vertical y la marca es horizontal, acá es al revés.
 */
const MARCA_COL: CSSProperties = { boxShadow: 'inset 2px 0 0 0 var(--primary)' };
const MARCA_COL_FIN: CSSProperties = { boxShadow: 'inset -2px 0 0 0 var(--primary)' };
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
type QhPasoId = 'que' | 'salida' | 'noshowEtapa' | 'calificado' | 'motivo' | 'fecha' | 'hora' | 'plazo' | 'resumen';


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
  errorMsg,
  hoy,
  equipo = [],
  calendlyStages = [],
  funnels = [],
  abrirEmbudo = null,
  funnelActivo = null,
  ordenManual = {},
  cursoAlGanar = null,
}: {
  leads: CrmLead[];
  stages: Stage[];
  juntas: CrmJunta[];
  marcar: CrmMarcar[];
  /** Por qué la lista de arriba puede estar incompleta ('' = está entera). */
  marcarAviso?: string;
  transitions: FunnelTransition[];
  // ⚠️ ACÁ HABÍA UN `total: number` Y NO LO LEÍA NADIE. Lo mandaba `app/crm/page.tsx` y su
  // único consumidor era el botón «Importar CSV» del header, que se fue el 30/09 al menú
  // de los tres puntos. Se sacó de los TRES lugares en vez de dejarlo «por si acaso»: una
  // prop que viaja y nadie lee es la que el día que se rompa nadie va a extrañar, y la que
  // hace creer que el número está disponible cuando ya no llega a ningún lado.
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
  /**
   * Abrir el pop-up del embudo al entrar, en esta subtab. Viene de `?embudo=` .
   *
   * Existe para que un link pueda llevar a una CONFIGURACION y no solo a una pantalla:
   * el panel de tracking que ve el cliente en su landing dice «activar la landing como
   * entrada de leads», y eso es una casilla adentro de este pop-up.
   */
  abrirEmbudo?: 'etapas' | 'entradas' | null;
  /** null = el funnel del negocio (sin `?funnel=` en la URL). */
  funnelActivo?: number | null;
  /** El orden que se armó arrastrando tarjetas en este embudo: etapa → leads (mig 0200). */
  ordenManual?: Record<string, number[]>;
  /**
   * Si este embudo invita SOLO al curso cuando un lead pasa a Ganado (lib/crm-curso-al-ganar.ts).
   * `null` = la opción no se ofrece: su producto no tiene clases, o no se pudo leer.
   */
  cursoAlGanar?: { prendido: boolean } | null;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [view, setView] = useState<'kanban' | 'table'>('kanban');
  const [activeBands, setActiveBands] = useState<Set<StageBand>>(() => new Set<StageBand>(KANBAN_BANDS));
  const [search, setSearch] = useState('');
  // Multi-selección: el set VACÍO significa "todas" (no hay valor centinela 'todos').
  const [stageFilter, setStageFilter] = useState<Set<string>>(() => new Set());
  const [originFilter, setOriginFilter] = useState<Set<string>>(() => new Set());
  // «Un filtro por creativo o por campaña, para ver de qué ads vinieron los leads»
  // (Martín, 06/10/2026). Mismo modelo que los otros: vacío = todas.
  const [campanaFilter, setCampanaFilter] = useState<Set<string>>(() => new Set());
  const [creativoFilter, setCreativoFilter] = useState<Set<string>>(() => new Set());
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
  /**
   * LO TILDADO, COMPARTIDO POR LAS DOS VISTAS. Un `Set` de ids y no de leads: la lista se
   * recarga sola (`router.refresh`) y guardar los objetos dejaria la barra operando sobre
   * copias viejas — el mismo caso que `selectedId`, que por eso tambien es un id.
   *
   * ⚠️ VIVE EN EL TABLERO Y NO EN CADA VISTA, a proposito: conmutar entre Kanban y tabla
   * NO pierde la seleccion. En el plan eso se aprendio al reves (tildar en la tabla y
   * conmutar a tarjetas dejaba la barra actuando sobre lo que no estaba en pantalla), y la
   * cura fue exactamente esta: un solo estado arriba de las dos.
   */
  const [selLeads, setSelLeads] = useState<Set<number>>(new Set());
  /** El lead cuyo tacho de fila se apreto, esperando confirmacion. Es un LEAD y no un id
   *  porque la pregunta lo NOMBRA, y volver a buscarlo para escribir el nombre seria
   *  pedirle a la lista que no haya cambiado entre el click y la respuesta. */
  const [borrarUno, setBorrarUno] = useState<CrmLead | null>(null);
  /** La fila en la mano. Es un REF y no estado: se escribe en el `dragstart` y leerlo no
   *  dibuja nada — un `setState` ahi redibuja la tabla justo en el frame en que arranca
   *  el gesto, que es el bug clasico de esta familia. */
  const filaAgarrada = useRef<number | null>(null);
  /** La fila sobre la que esta el cursor mientras se arrastra. ESTO si es estado: es lo
   *  unico que se dibuja. */
  const [filaDestino, setFilaDestino] = useState<number | null>(null);
  const limpiarSel = useCallback(() => setSelLeads(new Set()), []);
  const alternarSel = useCallback((id: number) => setSelLeads((p) => {
    const q = new Set(p);
    if (q.has(id)) q.delete(id); else q.add(id);
    return q;
  }), []);
  const [stageMove, setStageMove] = useState<{ leadId: number; move: StageMoveTarget } | null>(null);   // pop-up chico de completar movimiento
  const [localStage, setLocalStage] = useState<Record<number, string>>({});
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  // Auto-scroll horizontal del tablero al arrastrar cerca de un borde: sin esto
  // no se puede soltar en una columna que quedó fuera de la vista. El handler vive
  // más abajo (`onBoardDragOver`), junto al arrastre de columnas: los dos gestos
  // usan el mismo `dragover` del contenedor.
  const boardScrollRef = useRef<HTMLDivElement | null>(null);

  // ── Arrastrar una COLUMNA para cambiar el orden de las etapas ────────────────
  // Pedido de Martín (29/09/2026): «en las columnas del CRM, si agarro una, debería
  // dejar arrastrar también, para cambiar el orden».
  //
  // Es el molde del pop-up de etapas (app/crm/EtapasModal.tsx), dado vuelta al eje
  // horizontal: imagen de arrastre VACÍA + una copia propia que seguimos con
  // `transform` sobre un ref. La foto que sigue al cursor la dibuja el sistema
  // operativo y ninguna regla CSS la gobierna; y un `setState` por `dragover`
  // redibujaría el tablero 60 veces por segundo, con lo que el gesto se ve roto.
  /** La columna en la mano. Ref y no estado: lo leen los handlers del `document`. */
  const colAgarrada = useRef<string | null>(null);
  const copiaCol = useRef<HTMLElement | null>(null);
  /**
   * Puntos medios en X de las columnas reordenables, EN COORDENADAS DEL CONTENEDOR.
   *
   * ⚠️ NO en coordenadas de pantalla, y es la diferencia con el pop-up. Acá el tablero
   * auto-scrollea en horizontal mientras arrastrás: un `left + width / 2` cacheado en
   * coordenadas de ventana queda viejo en cuanto cambia `scrollLeft`, y la marca de
   * destino apunta a la columna equivocada. Sumándole el `scrollLeft` de cuando se midió,
   * el número deja de depender del scroll y el caché sirve todo el gesto.
   */
  const mediosCol = useRef<{ key: string; x: number }[]>([]);
  const [arrastrandoCol, setArrastrandoCol] = useState<string | null>(null);
  /** Dónde caería la columna si soltaras ahora (índice entre las reordenables). */
  const [insCol, setInsCol] = useState<number | null>(null);
  /**
   * El orden que la pantalla ya pintó, antes de que el server confirme.
   *
   * ⚠️ HACE FALTA porque `stages` es un prop del SERVER: sin esto el único repintado
   * posible es el `router.refresh()`, que es exactamente la queja que el pop-up ya
   * resolvió («cuando muevo de lugar una columna o etapa, se tarda muchísimo»).
   *
   * ⚠️ Y VIAJA CON EL ID DEL EMBUDO AL QUE PERTENECE. Cambiar de producto es un
   * `router.push('/crm?funnel=…')` y el tablero NO se vuelve a montar (no lleva `key`):
   * el orden local sobrevive la navegación. Y las claves de etapa se REPITEN entre
   * embudos (`registro`, `conversando`, `checkout`, `agenda`… las reparten todas las
   * plantillas de lib/pipeline.ts), así que sin este id el orden arrastrado en un
   * producto le reordenaba las columnas al siguiente — mostrando un embudo que no
   * existe, y sin forma de volver salvo tocar las etapas.
   */
  const [ordenCols, setOrdenCols] = useState<{ funnel: number | null; keys: string[] } | null>(null);
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
  const [mmPaso, setMmPaso] = useState(0);    // wizard: 0=fecha (+motivo si es futura), 1=asistencia (solo pasada), último=resumen
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

  /**
   * Qué lead está entrando a `handleDrop` cuando no vino de un arrastre.
   *
   * ⚠️ REF Y NO ESTADO: `altaAEtapa` lo escribe y llama a `handleDrop` en el MISMO tick, y
   * un `setDragId` recién se vería en el render siguiente. Existe para que el placeholder
   * «Nuevo lead» de cada columna entre por EL MISMO handler que soltar una tarjeta ahí
   * (pedido 7) — si esa columna abre un diálogo al soltar, lo abre también al crear — y no
   * haya dos caminos que digan cosas distintas sobre la misma columna.
   */
  const idASoltar = useRef<number | null>(null);

  /**
   * Mover la tarjeta de un AGREGADO (`lead.deFila`, mig 0207) a otra columna de ESTE producto.
   *
   * «No se debe "Mover" se debe agregar al otro producto» (Martín, 06/10/2026). Un agregado
   * está acá por una fila de `lead_funnel`; su casa es otro producto y sigue su propio
   * recorrido. Por eso esto escribe SÓLO la etapa de la fila (`moverEtapaEnProductoAction`,
   * que deja una línea de historial) y NO pasa por `persistStage`: `setLeadStageAction`
   * tocaría `pipeline_stage`, `estado_lead`, el monto y el CAPI de calificado DE LA CASA.
   *
   * ⚠️ Y NO ABRE NINGÚN DIÁLOGO. La nutrición manual (su plazo), la agenda de Calendly y la
   * confirmación con las señales a Meta son del recorrido de la casa: el motor, MaKo y las
   * métricas leen sólo la casa (decisión v1 del modelo, lib/lead-funnel.ts), así que pedirlos
   * acá sería pedir datos que nadie va a usar — o peor, escribirlos sobre otro producto.
   *
   * Optimista con vuelta atrás si la acción falla, y el aviso trae Deshacer que vuelve a
   * llamar a la MISMA acción con la etapa anterior: deshacer escribe en el server.
   */
  const moverEnProducto = (lead: CrmLead, producto: number, stageKey: string, guardarLugar: () => void) => {
    const id = lead.id;
    const from = effStage(lead);
    const previo = localStage[id];
    const destino = findStage(stages, stageKey).label;
    /** Devuelve la tarjeta a donde la pantalla la tenía antes de este movimiento. */
    const volverPantalla = () => setLocalStage((m) => {
      const n = { ...m };
      if (previo === undefined) delete n[id]; else n[id] = previo;
      return n;
    });
    setLocalStage((m) => ({ ...m, [id]: stageKey }));
    startTransition(async () => {
      // ⚠️ UNA ACCIÓN QUE NO LLEGA (sin red) RECHAZA LA PROMESA, y adentro de una transición eso
      // tumba la pantalla entera: se ataja como un error más (igual que `reordenarColumna`).
      const r = await moverEtapaEnProductoAction(id, producto, stageKey)
        .catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : 'No se pudo mover.' }));
      if (!r.ok) {
        volverPantalla();
        mostrarAviso('No se pudo mover', undefined, 'bad');
        return;
      }
      // A dónde vuelve el Deshacer: la etapa que la fila tenía, si sigue existiendo en este
      // embudo; si era una huérfana (la tarjeta se dibujaba en la entrada), la columna de
      // donde salió — la acción rechaza una etapa que el producto no tiene.
      const volverA = stageKeys.has(r.antes) ? r.antes : from;
      mostrarAviso(`Movido a ${destino}`, () => {
        setLocalStage((m) => ({ ...m, [id]: volverA }));
        startTransition(async () => {
          const d = await moverEtapaEnProductoAction(id, producto, volverA)
            .catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : 'No se pudo deshacer.' }));
          if (!d.ok) {
            setLocalStage((m) => ({ ...m, [id]: stageKey }));
            mostrarAviso('No se pudo deshacer', undefined, 'bad');
            return;
          }
          router.refresh();
        });
      });
      router.refresh();
    });
    // El lugar en la columna, igual que un movimiento de la casa: con la tarjeta ya en su
    // columna nueva. Si la acción de arriba falla, la tarjeta vuelve y el orden guardado sólo
    // la nombra en una columna donde no está, que el orden manual ignora.
    guardarLugar();
  };

  /**
   * `antesDe` = DÓNDE cayó adentro de la columna: antes de qué lead (`null` = al final). Lo
   * manda el arrastre, que es el único que dibujó un hueco; el alta desde el placeholder no
   * lo manda (`undefined`) y entonces el orden no se toca.
   *
   * ⚠️ HASTA EL 06/10 SOLTAR EN LA MISMA COLUMNA NO HACÍA NADA, y el hueco seguía al cursor
   * igual: dibujaba un lugar que después no se respetaba. Ahora reordena (`reordenarColumna`).
   */
  const handleDrop = (stageKey: string, antesDe?: number | null) => {
    const id = idASoltar.current ?? dragId;
    idASoltar.current = null;
    setDragId(null);
    if (id == null) return;
    const lead = leads.find((l) => l.id === id);
    if (!lead) return;
    if (effStage(lead) === stageKey) {
      if (antesDe !== undefined) reordenarColumna(id, stageKey, antesDe, false);
      return;
    }
    // El lugar donde cayó se guarda recién cuando el movimiento SE HACE: si la confirmación
    // se cancela, la tarjeta vuelve a su columna y no hay lugar que respetar. Las etapas que
    // abren un diálogo propio (el plazo de la manual, la agenda) no lo guardan: la tarjeta
    // entra por fecha de llegada, como siempre.
    const guardarLugar = antesDe !== undefined ? () => reordenarColumna(id, stageKey, antesDe, true) : () => {};
    // ⚠️ UN AGREGADO VA ANTES QUE TODO DIÁLOGO: lo que sigue (la nutrición manual, la agenda,
    // las señales a Meta) es del recorrido de la CASA. Ver `moverEnProducto`. El producto va
    // como `deFila` y no como `funnelActivo`: es el id REAL de la fila (el del negocio ya
    // resuelto, que `funnelActivo` nombra como null), y nombra a este mismo tablero.
    if (lead.deFila != null) { moverEnProducto(lead, lead.deFila, stageKey, guardarLugar); return; }
    if (stageKey === 'manual') { openManualNutri(id); return; }
    if (esEtapaCalendly(stageKey)) { scheduleViaCalendly(lead, stageKey); return; }
    const from = effStage(lead);
    const tr = transitionFor(from, stageKey);
    // YA NO se abre el wizard de datos al soltar (08-T22). Antes, si la etapa pedía
    // algo que faltaba, la card no se movía hasta contestarlo todo; Mauricio: «me
    // pregunta un chorro de cosas… lo abandono». Ahora se mueve, y lo que falta se
    // avisa en el toast con «Completar ahora» — opcional, nunca en el camino.
    //
    const destino = findStage(stages, stageKey).label;
    const origen = findStage(stages, from).label;
    const ofrecer = senalesAOfrecer(lead, { tr, hoyISO: hoy });
    senalesRef.current = { asistio: null, calificado: null };

    // ⚠️ LA CONFIRMACIÓN DEL ARRASTRE ES CONDICIONAL desde el 27/09/2026, y es la
    // DECISIÓN 2 del plan de fricción. La regla original (06/08) era pedirla SIEMPRE:
    // «arrastrar una card es el gesto más fácil de hacer sin querer del tablero».
    // Cierto — y lo que cambió desde entonces es que ese gesto ya tiene DOS redes, las
    // dos medidas antes de tocar esto:
    //   · el toast «↶ Deshacer» de 5 s, que NO revierte sólo la pantalla: llama a
    //     `undoStageMoveAction`, que escribe en el server.
    //   · el historial del lead, donde el movimiento queda con autor y fecha.
    // Con las dos puestas, una pantalla que sólo dice «pasa de A a B» antes de un
    // movimiento reversible es un peaje: se aprieta sin leer, que es justo lo que hace
    // que después no se lea la que sí importa.
    //
    // DÓNDE SIGUE APARECIENDO, y por eso no se borró: cuando hay algo que ofrecerle a
    // Meta (la asistencia o el calificado sin marcar, con la R1 ya pasada). Ahí la
    // pantalla no es una confirmación — es el único momento en que esos dos datos se
    // pueden dar, y son los únicos dos que el CRM le manda a Meta.
    //
    // Y los otros dos desvíos del arrastre siguen intactos, arriba: «Nutrición -
    // Manual» pide su plazo (el plazo ES la etapa) y las etapas de reunión abren el
    // menú de agenda. Ninguno de los dos es una confirmación.
    if (!hayAlgoQueOfrecer(ofrecer)) {
      persistStage(id, stageKey, from, tr, senalesRef.current);
      guardarLugar();
      return;
    }

    setConfirmacion({
      titulo: `Mover a ${destino} a ${lead.name}`,
      mensaje: (
        <>
          Pasa de <b>{origen}</b> a <b>{destino}</b>. Queda en el historial y puedes deshacerlo.
          <SenalesMetaChips ofrecer={ofrecer} onChange={(v) => { senalesRef.current = v; }} />
        </>
      ),
      confirmLabel: `Mover a ${destino}`,
      tono: 'primary',
      onOk: () => { persistStage(id, stageKey, from, tr, senalesRef.current); guardarLugar(); },
    });
  };

  // ── El alta desde el placeholder de una columna, segundo tiempo ──────────────
  /**
   * El lead del placeholder «Nuevo lead» ya se creó; lo que falta es LLEVARLO a esa
   * columna, y por el mismo camino que soltar una tarjeta ahí (`handleDrop`).
   *
   * ⚠️ POR QUÉ SON DOS TIEMPOS Y NO UNO. El alta no acepta una etapa a propósito:
   * meterla en `LeadCreateInput` crearía un SEGUNDO escritor de `pipeline_stage` que
   * saltea el choke point donde `setPipelineStage` audita TODO movimiento (lib/leads.ts,
   * y está documentado ahí por qué se hizo así). Y se espera a que el `router.refresh()`
   * traiga el lead porque ese camino NECESITA el lead: la nutrición manual pide su
   * plazo, las etapas de reunión abren la agenda y la confirmación lo nombra.
   *
   * Si el refresh nunca lo trae, no pasa nada: el lead quedó creado donde el alta lo
   * pone, que es lo que hacía el botón del header antes de este pedido.
   */
  const [altaPendiente, setAltaPendiente] = useState<{ id: number; etapa: string } | null>(null);
  /** El lead recién creado entra por el MISMO `handleDrop` que una tarjeta soltada ahí. */
  const altaAEtapa = (id: number, stageKey: string) => { idASoltar.current = id; handleDrop(stageKey); };
  useEffect(() => {
    if (!altaPendiente) return;
    if (!leads.some((l) => l.id === altaPendiente.id)) return;
    const { id, etapa } = altaPendiente;
    setAltaPendiente(null);
    altaAEtapa(id, etapa);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [altaPendiente, leads]);

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
        if (qhPideMotivo) p.push('motivo');
        break;
      case 'noshow':
        // CERO preguntas: la etapa la dicta el funnel. Solo si este funnel no la
        // modela hay que preguntarla (pantalla de excepción).
        if (!qhEtapaNoShow) p.push('noshowEtapa');
        // Y si esa etapa de excepción resulta ser una salida (Perdido/Descal), el
        // motivo se pide igual que en cualquier otro cierre: sin esto el lead se
        // cerraba heredando el `motivo_perdida` de la pérdida anterior.
        if (qhPideMotivo) p.push('motivo');
        break;
      case 'noshowcierra':
      case 'cierra':
        p.push('salida');
        if (qhPideMotivo) p.push('motivo');
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
      case 'motivo': return !!qhMotivoCat.trim() && !!qhMotivoDet.trim();
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
    // ⚠️ EL MOTIVO DE LA EXCEPCIÓN ES OPCIONAL desde el 27/09/2026. Era obligatorio:
    // elegir «Ya está agendada» y no dejar seguir hasta escribir por qué no se usó
    // Calendly. Es la DECISIÓN 1 del plan de fricción.
    //
    // ⚠️ Y LA PREGUNTA DEL PLAN PARTÍA DE UNA PREMISA FALSA. Decía «¿lo querés como
    // desincentivo, sabiendo que NADA LO LEE?» — y sí lo lee alguien: el texto va a
    // `logLeadEvent(id, 'Agendada fuera de Calendly', …)` (app/crm/actions.ts,
    // `markMeetingManualAction`), o sea al HISTORIAL del lead, que se consulta en su
    // pestaña. Medido antes de tocar nada.
    //
    // Por eso no se saca el campo: se saca el CANDADO. Con la premisa corregida las dos
    // cosas que el plan quería siguen valiendo — el que tiene algo que contar lo cuenta
    // y queda registrado, y el que no, no queda trabado escribiendo para nadie. Un dato
    // que se exige para poder avanzar se llena con «.» y entonces el registro miente.
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
  // `salvo` deja afuera UNA categoría: es lo que usan las opciones de esa misma categoría
  // para contar sobre lo que dejan pasar las DEMÁS (ver `opcionesCreativo`).
  const matches = (l: CrmLead, salvo?: 'campana' | 'creativo') => {
    // Buscar como busca una persona (sin acentos, por palabras sueltas, por #id):
    // la regla vive en lib/buscar-texto, no acá — ver «Una cosa, un lugar».
    if (!coincideBusqueda([l.id, l.name, l.company, l.email, l.phone], search)) return false;
    if (stageFilter.size > 0 && !stageFilter.has(effStage(l))) return false;
    if (originFilter.size > 0 && !originFilter.has(l.origin)) return false;
    // `null` entra por la opción «Sin campaña» / «Sin creativo», que tiene su clave propia.
    if (salvo !== 'campana' && campanaFilter.size > 0 && !campanaFilter.has(l.campanaKey ?? SIN_ORIGEN_ADS)) return false;
    if (salvo !== 'creativo' && creativoFilter.size > 0 && !creativoFilter.has(l.anuncioKey ?? SIN_ORIGEN_ADS)) return false;
    return true;
  };
  const filtered = leads.filter((l) => matches(l));
  const originOptions = useMemo(() => [...new Set(leads.map((l) => l.origin))].filter(Boolean).sort((a, b) => a.localeCompare(b)), [leads]);
  // Las opciones salen de los leads de ESTE tablero, con cuántos tiene cada una: una
  // campaña que no trajo a nadie acá no es una opción que filtre algo.
  //
  // ⚠️ Y SE CUENTAN SOBRE LO QUE DEJAN PASAR LOS DEMÁS FILTROS: con una campaña elegida,
  // «Creativo» lista los anuncios de ESA campaña, que es justo la pregunta («de qué ads
  // vinieron»). Lo ya elegido se queda en la lista aunque cuente cero, o quedaría tildado
  // sin forma de destildarlo desde acá.
  const facetas = (salvo: 'campana' | 'creativo', sel: Set<string>, sinRotulo: string) => {
    const pares = leads.filter((l) => matches(l, salvo)).map((l) => (salvo === 'campana'
      ? { key: l.campanaKey ?? null, nombre: l.campanaNombre ?? null }
      : { key: l.anuncioKey ?? null, nombre: l.anuncioNombre ?? null }));
    const op = opcionesDeFiltro(pares, sinRotulo);
    for (const v of sel) {
      if (op.some((o) => o.value === v)) continue;
      const l = leads.find((x) => (salvo === 'campana' ? x.campanaKey : x.anuncioKey) === v);
      op.push({ value: v, label: (salvo === 'campana' ? l?.campanaNombre : l?.anuncioNombre) ?? (v === SIN_ORIGEN_ADS ? sinRotulo : v), n: 0 });
    }
    return op;
  };
  const opcionesCampana = facetas('campana', campanaFilter, 'Sin campaña');
  const opcionesCreativo = facetas('creativo', creativoFilter, 'Sin creativo');
  // ⚠️ Si TODOS caen en «Sin …» (un negocio sin Meta), la categoría no se ofrece: una sola
  // opción que es todo el tablero no filtra nada.
  const listasFiltro: ListaFiltro[] = [
    { cat: 'campana', label: 'Campaña', todas: 'Todas', opciones: opcionesCampana.some((o) => o.value !== SIN_ORIGEN_ADS) ? opcionesCampana : [], sel: campanaFilter, set: setCampanaFilter },
    { cat: 'creativo', label: 'Creativo', todas: 'Todos', opciones: opcionesCreativo.some((o) => o.value !== SIN_ORIGEN_ADS) ? opcionesCreativo : [], sel: creativoFilter, set: setCreativoFilter },
  ];
  const hayFiltros = stageFilter.size > 0 || originFilter.size > 0 || campanaFilter.size > 0 || creativoFilter.size > 0 || search.trim().length > 0;
  const limpiarTodo = () => { setStageFilter(new Set()); setOriginFilter(new Set()); setCampanaFilter(new Set()); setCreativoFilter(new Set()); setSearch(''); setOrdenElegido(null); };

  /**
   * EL ORDEN DE LA TABLA. Es lo que separa una tabla de una lista: el plan ordena por
   * cualquiera de sus columnas y esta no ordenaba por ninguna — llegaba como la devolvia
   * la consulta y no habia forma de pedir «los de mayor monto» ni «los mas viejos».
   *
   * ⚠️ VIVE SOLO EN LA TABLA. El Kanban tiene su propio orden (la columna y la posicion
   * dentro de ella), y conmutar de vista no puede reordenar un tablero que se ordena solo.
   */
  const [ordenTabla, setOrdenTabla] = useState<OrdenTabla>('creado');
  const [dirTabla, setDirTabla] = useState<'asc' | 'desc'>('desc');
  const sortearTabla = (c: OrdenTabla) => {
    if (c === ordenTabla) { setDirTabla((d) => (d === 'asc' ? 'desc' : 'asc')); return; }
    setOrdenTabla(c);
    // Al CAMBIAR de columna se arranca por lo que esa columna contesta mejor: un nombre de
    // la A a la Z, un monto y una fecha de mayor a menor. Heredar la direccion anterior
    // deja la primera vista de cada columna al reves la mitad de las veces.
    setDirTabla(c === 'monto' || c === 'creado' ? 'desc' : 'asc');
  };

  const filasTabla = useMemo(() => {
    const etiqueta = (l: CrmLead) => findStage(stages, effStage(l)).label;
    // Lo vacio va SIEMPRE al final, suba o baje el orden: un hueco no es «antes de la A»
    // ni «despues de la Z», y mezclarlo con los valores deja la tabla contestando que el
    // lead sin empresa es el primero de la lista.
    const txt = (v: string) => (v ?? '').trim();
    const cmp = (a: CrmLead, b: CrmLead): number => {
      const signo = dirTabla === 'asc' ? 1 : -1;
      const porTexto = (x: string, y: string) => {
        if (!x && !y) return 0;
        if (!x) return 1;        // sin signo: el vacio al fondo en las dos direcciones
        if (!y) return -1;
        return signo * x.localeCompare(y, 'es');
      };
      switch (ordenTabla) {
        case 'nombre':  return porTexto(txt(a.name), txt(b.name));
        case 'empresa': return porTexto(txt(a.company), txt(b.company));
        case 'origen':  return porTexto(txt(a.origin), txt(b.origin));
        case 'etapa':   return porTexto(etiqueta(a), etiqueta(b));
        case 'agenda':  return porTexto(txt(a.agendaISO ?? ''), txt(b.agendaISO ?? ''));
        // Por lo que se DIBUJA (montoDeTarjeta): una suscripción ordena por su mensualidad,
        // no por el 0 de su monto de cierre.
        case 'monto':   return signo * (montoDeTarjeta(a).valor - montoDeTarjeta(b).valor);
        // Por el ISO y no por lo que se DIBUJA: «04/10/2026» ordenado como texto pone
        // noviembre antes que octubre, y el error no se ve hasta que cambia el mes.
        default:        return porTexto(txt(a.createdISO), txt(b.createdISO));
      }
    };
    return [...filtered].sort(cmp);
  }, [filtered, ordenTabla, dirTabla, stages]);

  /** Lo tildado que TODAVIA existe. La lista se recarga sola, asi que un id que ya no
   *  esta (lo borro otra pestaña, se movio de producto) no puede seguir contando. */
  const elegidos = useMemo(() => leads.filter((l) => selLeads.has(l.id)), [leads, selLeads]);
  const idsVisibles = filtered.map((l) => l.id);
  const todosSel = idsVisibles.length > 0 && idsVisibles.every((id) => selLeads.has(id));
  const abrirFiltro = (cat: FiltroCat) => setFiltroAbierto(cat);

  // ── worklist "datos sin marcar" ──
  const marcarPending = marcar.length;

  // ⚠️ LA COPIA QUE SIGUE AL CURSOR LA DIBUJAMOS NOSOTROS, no el navegador. La foto
  // del arrastre la pinta el SISTEMA OPERATIVO y no la gobierna ningún CSS: en Windows
  // sale semitransparente y anclada donde quiere, así que un `getComputedStyle` puede
  // decir `opacity: 1` mientras en pantalla se ve un fantasma. Por eso va un canvas de
  // 1x1 como imagen (el SO no pinta nada) y la copia la monta el hook.
  // La pieza es la MISMA que usa el Plan (`app/plan/board/arrastre-copia.ts`): no se
  // reescribe, porque adentro están las tres cosas que costaron tres rondas allá — la
  // copia se mueve con `transform` sobre un ref y nunca con `setState` (uno por
  // `dragover` redibuja el tablero 60 veces por segundo), el listener va en `document`
  // y en CAPTURA (el `dragover` de las columnas no cubre los huecos entre ellas), y se
  // limpia en `dragend` Y en `drop`, los dos.
  const { pararScroll, montarCopia, soltarCopia } = useArrastreCopia();

  /**
   * DÓNDE VA A CAER LA TARJETA: la columna Y el índice exacto. Es lo que dibuja el HUECO.
   *
   * ⚠️ HASTA EL 05/10 EL CRM SÓLO TEÑÍA LA COLUMNA. Martín: «al arrastrar se marca el
   * lugar donde dejarlas, y en el CRM no pasa». Teñir el fondo contesta «la estoy
   * soltando en esta columna»; el hueco contesta «la estoy soltando ACÁ», que es la
   * mitad del gesto que el Plan sí tiene. El molde corto es el kanban de la entrega
   * (`app/customer-success/KanbanEntrega.tsx`), no las 3.000 líneas de `BoardShell`.
   */
  const [insTarjeta, setInsTarjeta] = useState<{ col: string; idx: number } | null>(null);

  /**
   * LOS PUNTOS MEDIOS DE CADA TARJETA, MEDIDOS UNA VEZ Y EN COORDENADAS DE PÁGINA.
   *
   * ⚠️ UNA VEZ, porque leer layout en cada `dragover` es lo que hace que un arrastre se
   * sienta pegajoso: el tablero del Plan se reportó roto siete veces por re-medir sus 55
   * tarjetas sesenta veces por segundo.
   *
   * ⚠️ Y DE PÁGINA (`+ window.scrollY` y `+ scrollTop` del carril), porque los dos
   * auto-scroll que este gesto ya tiene invalidan cualquier rectángulo medido contra la
   * ventana: después de correr 600 px, lo medido al agarrar apunta 600 px arriba del
   * cursor — o sea que el scroll rompía el destino justo cuando hacía su trabajo. El
   * `dragover` suma lo mismo del otro lado, así que la comparación se sostiene.
   */
  const medidasTarjetas = useRef<Record<string, number[]>>({});

  /** Al agarrar: fotografía los puntos medios de TODAS las columnas, una sola vez. */
  const medirTarjetas = () => {
    const out: Record<string, number[]> = {};
    for (const col of document.querySelectorAll<HTMLElement>('[data-colkey]')) {
      const dy = window.scrollY + (col.querySelector<HTMLElement>('[data-carril]')?.scrollTop ?? 0);
      out[col.dataset.colkey ?? ''] = [...col.querySelectorAll<HTMLElement>('[data-leadcard]')]
        .map((el) => { const q = el.getBoundingClientRect(); return q.top + q.height / 2 + dy; });
    }
    medidasTarjetas.current = out;
  };

  /** Al soltar o cancelar: sin esto el hueco queda dibujado después del gesto. */
  const limpiarArrastreTarjeta = () => {
    setDragId(null);
    setDragOverCol(null);
    setInsTarjeta(null);
    medidasTarjetas.current = {};
    pararScroll();
    soltarCopia();
  };

  const selected = selectedId != null ? leads.find((l) => l.id === selectedId) ?? null : null;

  // Leads que esperan tu validación (los que están en "Datos sin marcar").
  const pendingLeadIds = new Set(marcar.map((m) => m.leadId));

  // Importar / exportar leads: MISMO patrón que el board del plan — un botón de
  // icono que abre un formulario de a una pregunta (nada de bajar todo de una ni
  // de abrir el buscador de archivos del sistema sin avisar qué va a pasar).
  const [exportar, setExportar] = useState(false);
  const [importar, setImportar] = useState(false);
  // La tabla de campañas de Meta del producto que se está mirando, abierta desde el «⋯» de
  // la columna de entrada. Si en el medio se trajeron leads, al cerrar se refresca: si no,
  // el tablero sigue sin los que acaban de llegar.
  const [campanasAbierto, setCampanasAbierto] = useState(false);
  const cambiaronCampanas = useRef(false);
  // El alta lleva A DÓNDE va: `etapa: null` = el botón del header (cae donde el alta lo
  // ponga), una clave = el placeholder de esa columna (pedido 7).
  /**
   * El modal de alta. `etapa` = la columna desde donde se abrió (el placeholder);
   * `traer` = está en la vista de traer de otro producto en vez de en el formulario.
   *
   * Las dos viven en el MISMO estado porque son la misma caja: volver de «traer» al alta
   * no puede perder desde qué columna se abrió.
   */
  const [nuevoLead, setNuevoLead] = useState<{ etapa: string | null; traer?: boolean } | null>(null);
  // El pop-up de etapas guarda A CUAL funnel abrió, no un booleano: el lápiz de cada
  // renglón del selector puede abrir uno que no es el del tablero.
  const [etapasDe, setEtapasDe] = useState<{ id: number | null; nombre: string; entradas?: boolean } | null>(null);
  // Las etapas que esta pantalla YA dibujó, con el mismo mapeo que usa el server. Es lo
  // que hace que el pop-up abra pintado en vez de con el giro.
  const semillaEtapas = useMemo(() => {
    const { propias, fijas } = etapasVisibles(stages);
    return { etapas: propias, fijas };
  }, [stages]);
  // Y si la URL lo pidio, se abre solo al entrar. Una sola vez: despues es estado de la
  // pantalla, no de la URL — reabrirlo en cada render lo volveria imposible de cerrar.
  const pedidoAbrir = useRef(abrirEmbudo);
  useEffect(() => {
    if (!pedidoAbrir.current) return;
    const sub = pedidoAbrir.current;
    pedidoAbrir.current = null;
    setEtapasDe({ id: funnelActivo, nombre: nombreDeFunnel(funnelActivo), entradas: sub === 'entradas' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // ⚠️ SE MUESTRA EL PRODUCTO, igual que en el selector: «Funnel principal» es el nombre
  // que puso la migración y es el mismo en todos los workspaces. El encabezado del
  // pop-up tiene que decir CUÁL embudo se está tocando, y para eso ese nombre no sirve.
  const nombreDeFunnel = (id: number | null) => {
    const f = funnels.find((x) => x.id === id) ?? funnels.find((x) => x.esDefault);
    return f?.producto?.trim() || f?.nombre || 'Tu embudo';
  };
  // Cerrar el aviso de error es SÓLO de esta vista: al recargar vuelve a calcularse.
  const [errorCerrado, setErrorCerrado] = useState(false);
  const { toast: avisoBoard, show: mostrarAviso, clear: limpiarAviso } = useToast();

  // ── «Invitar al curso al ganar» (pedido de Martín, 07/10/2026) ──────────────
  // ⚠️ NO ES UN useState SEMBRADO DE LA PROP: el tablero no se desmonta al cambiar de embudo, y
  // un estado sembrado mostraría el interruptor del embudo anterior. Lo que se guarda es lo que
  // ESTA pestaña cambió, con su embudo, y gana sólo sobre ese embudo hasta que el server lo diga.
  const [cursoCambiado, setCursoCambiado] = useState<{ funnel: number | null; prendido: boolean } | null>(null);
  const cursoPrendido = cursoCambiado && cursoCambiado.funnel === funnelActivo ? cursoCambiado.prendido : cursoAlGanar?.prendido ?? false;
  const cambiarCurso = async (prendido: boolean): Promise<void> => {
    const funnel = funnelActivo;
    setCursoCambiado({ funnel, prendido });
    const r = await cambiarCursoAlGanarAction(funnel, prendido);
    if (!r.ok) {
      setCursoCambiado({ funnel, prendido: !prendido });
      mostrarAviso(r.error, undefined, 'bad');
      return;
    }
    setCursoCambiado({ funnel, prendido: r.prendido });
    mostrarAviso(r.prendido ? 'Invitación prendida' : 'Invitación apagada', () => { void cambiarCurso(!r.prendido); });
  };

  // ── El orden de las tarjetas adentro de cada columna (mig 0200) ─────────────
  // «Es como poner un "ORDENAMIENTO" dentro de filtros» (Martín, 06/10/2026). La pieza pura
  // y el porqué de cada regla están en app/crm/orden-kanban.ts.
  /**
   * Lo que se arrastró en esta pestaña, encima de lo que mandó el server, hasta que el server
   * lo confirme. La clave lleva el EMBUDO: las claves de etapa se repiten entre embudos, y
   * sin él el orden arrastrado en uno se aplicaría a la columna del mismo nombre en otro.
   */
  const [ordenMovs, setOrdenMovs] = useState<Record<string, number[]>>({});
  const claveCol = (etapa: string) => `${funnelActivo ?? 0}:${etapa}`;
  const listaManual = (etapa: string): number[] | undefined => ordenMovs[claveCol(etapa)] ?? ordenManual[etapa];
  const hayOrdenManual = stages.some((s) => (listaManual(s.key)?.length ?? 0) > 0);
  /**
   * «Ordenar». `null` = nadie eligió en este embudo, y manda la BASE: «Manual» si hay algo
   * arrastrado, si no la fecha de llegada.
   *
   * ⚠️ SE CALCULA, NO SE INICIALIZA. Arrancando en un `useState` fijo, el orden armado
   * arrastrando desaparecería en cada F5 (se leería como que no se guardó), y al cambiar de
   * embudo quedaría el criterio del anterior. Y por la misma cuenta «Limpiar filtros» vuelve
   * a lo arrastrado: es volver a la base.
   */
  const [ordenElegido, setOrdenElegido] = useState<{ funnel: number | null; valor: OrdenKanban } | null>(null);
  const ordenBase: OrdenKanban = hayOrdenManual ? 'manual' : 'llegada';
  const ordenKanban: OrdenKanban = ordenElegido && ordenElegido.funnel === funnelActivo ? ordenElegido.valor : ordenBase;
  const elegirOrden = (v: OrdenKanban) => setOrdenElegido(v === ordenBase ? null : { funnel: funnelActivo, valor: v });
  /** «Ordenar» del menú, sólo en el kanban: la tabla se ordena por sus columnas. */
  const ordenFiltro = vista === 'kanban'
    ? { valor: ordenKanban, base: ordenBase, opciones: ORDEN_KANBAN, elegir: (v: string) => elegirOrden(v === 'manual' ? 'manual' : 'llegada') }
    : undefined;
  /** Una columna en el orden en que se dibuja con el criterio de ahora. */
  const enOrden = (ls: CrmLead[]) => (ordenKanban === 'manual' ? ordenarKanbanManual(ls, (l) => l.id, effStage, listaManual) : ls);

  /**
   * Soltar en un lugar de una columna: guarda la columna ENTERA con la tarjeta ahí y deja
   * «Ordenar» en «Manual».
   *
   * ⚠️ LA COLUMNA ES LA ENTERA, también los que el buscador o un filtro esconden: guardar sólo
   * lo que se ve mandaría a los escondidos al final. Por eso llega un VECINO («antes de Juan»)
   * y no un número.
   *
   * ⚠️ SOLTAR DONDE YA ESTABA NO ES UN CAMBIO: no se guarda, no se anuncia y no pasa «Ordenar»
   * a «Manual» — un gesto que no movió nada no puede reacomodar la pantalla.
   *
   * Un movimiento de etapa (`mueve`) ya ofrece SU deshacer; un reordenamiento en la misma
   * columna ofrece uno que devuelve la lista y el criterio de antes, y lo escribe en el server.
   */
  const reordenarColumna = (id: number, etapa: string, antesDe: number | null, mueve: boolean) => {
    const columna = enOrden(leads.filter((l) => effStage(l) === etapa)).map((l) => l.id);
    const nueva = columnaConInsercion(columna, [id], antesDe);
    if (!mueve && mismaLista(nueva, columna)) return;
    const clave = claveCol(etapa);
    const previa = listaManual(etapa) ?? [];
    const elegidoAntes = ordenElegido;
    const funnel = funnelActivo;
    setOrdenMovs((v) => ({ ...v, [clave]: nueva }));
    setOrdenElegido(null);   // con algo arrastrado, la base pasa a ser «Manual»
    startTransition(async () => {
      // ⚠️ UNA ACCIÓN QUE NO LLEGA (sin red) RECHAZA LA PROMESA, y adentro de una transición eso
      // tumba la pantalla entera. Se ataja como un error más (medido en Customer Success).
      const r = await ordenarColumnaCrmAction(funnel, etapa, nueva)
        .catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : 'No se pudo guardar el orden.' }));
      if (!r.ok) {
        setOrdenMovs((v) => ({ ...v, [clave]: previa }));
        mostrarAviso('No se guardó el orden', undefined, 'bad');
        return;
      }
      if (mueve) return;
      mostrarAviso('Reordenado', () => {
        setOrdenMovs((v) => ({ ...v, [clave]: previa }));
        setOrdenElegido(elegidoAntes);
        startTransition(async () => {
          const d = await ordenarColumnaCrmAction(funnel, etapa, previa)
            .catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : 'No se pudo deshacer.' }));
          if (!d.ok) mostrarAviso('No se pudo deshacer', undefined, 'bad');
        });
      });
    });
  };

  const [flashCsv, setFlashCsv] = useState<string | null>(null);
  // Por qué no se pudo abrir Calendly (este negocio no lo tiene configurado, el
  // event type no coincide…). Se DICE: antes, cuando no había config, el botón
  // caía a la agenda del dueño y el usuario ni se enteraba de que faltaba algo.
  const [avisoAgenda, setAvisoAgenda] = useState<string | null>(null);

  // ── Editar las etapas desde la cabecera de su columna ──────────────────────
  // Pedido de Martín (28/09/2026). El menú vive acá y no en /funnel porque es donde se
  // ve el problema: la columna que sobra o el nombre que no es el del negocio se notan
  // mirando el tablero, no el mapa.
  const [renombrando, setRenombrando] = useState<string | null>(null);
  const [borrarEtapa, setBorrarEtapa] = useState<{ key: string; label: string } | null>(null);
  const [errorEtapa, setErrorEtapa] = useState<string | null>(null);

  /**
   * ⚠️ MANDA LA OPERACIÓN, NO EL PIPELINE. El tablero recibe las etapas ya GENERADAS
   * (`filaAFunnel` corre en el server); el pipeline crudo nunca llega acá. Reconstruirlo
   * desde lo que se dibuja le haría perder todo lo que la derivación agrega y quita.
   *
   * Y `router.refresh()` al final porque las etapas las decide el SERVER: sin eso el
   * cambio se guarda y la pantalla sigue mostrando lo de antes.
   */
  const opEtapa = async (op: OpEtapa) => {
    setErrorEtapa(null);
    const r = await editarEtapaAction(op, funnelActivo ?? undefined);
    if (!r.ok) { setErrorEtapa(r.error); return; }
    setRenombrando(null);
    setBorrarEtapa(null);
    // Agregar o quitar una etapa cambia la lista: el orden local recién arrastrado no sabe
    // dónde va la nueva, así que se descarta y manda el del server.
    if (op.op !== 'reordenar') setOrdenCols(null);
    router.refresh();
    return r;
  };

  /**
   * Quitar una etapa desde el «···» de su columna.
   *
   * ⚠️ SIN FRICCIÓN SI LA COLUMNA ESTÁ VACÍA. «Si intento eliminar una columna que NO
   * tiene ningún lead, no debería haber nada de fricción. Solo que me salte el pop-up de
   * deshacer que dura 5 segundos». Acá el conteo es gratis: el tablero ya lo tiene
   * dibujado al lado del nombre de la columna.
   *
   * Con leads adentro sigue preguntando, porque ahí el deshacer no alcanza — entre medio
   * quedan fuera del embudo.
   */
  const quitarColumna = async (c: Stage) => {
    const cuantos = filtered.filter((l) => effStage(l) === c.key).length;
    if (cuantos > 0) { setBorrarEtapa({ key: c.key, label: c.label }); return; }
    const r = await opEtapa({ op: 'eliminar', key: c.key });
    if (!r?.ok) return;
    const d = r.deshacer;
    mostrarAviso(`Quitada «${c.label}»`, d ? () => { void opEtapa({ op: 'insertar', etapa: d.etapa, at: d.at }); } : undefined);
  };

  const guardarNombre = (key: string, valor: string) => {
    const limpio = valor.trim();
    const previo = stages.find((st) => st.key === key)?.label ?? '';
    // Sin cambio no se escribe: el `onBlur` salta también al apretar Escape o al hacer
    // clic afuera, y un guardado por cada foco perdido es ruido en el historial.
    if (!limpio || limpio === previo) { setRenombrando(null); return; }
    void opEtapa({ op: 'renombrar', key, label: limpio });
  };

  // ── El orden de las columnas del Kanban ─────────────────────────────────────
  // Las bandas primero (pipeline · nutrición · salidas) y dentro de cada una el `col`
  // que puso la derivación — salvo que haya un orden local recién arrastrado.
  const columnasKanban = useMemo(() => {
    // El orden local vale SÓLO para el embudo en el que se arrastró (ver `ordenCols`).
    const orden = ordenCols && ordenCols.funnel === funnelActivo ? ordenCols.keys : null;
    const pos = (s: Stage) => {
      const i = orden ? orden.indexOf(s.key) : -1;
      if (i >= 0) return i;
      // Lo que el arrastre no nombró va DESPUÉS, que es exactamente lo que hace el server
      // (`reordenar` en app/crm/actions.ts re-agrega al final lo que no viajó). Si la
      // pantalla no lo imitara, mostraría medio segundo un orden que el refresh corrige.
      return (orden ? orden.length : 0) + (s.col ?? 0);
    };
    return stages
      .filter((s) => activeBands.has(s.band ?? 'pipeline'))
      .sort((a, b) => (KANBAN_BANDS.indexOf(a.band ?? 'pipeline') - KANBAN_BANDS.indexOf(b.band ?? 'pipeline')) || (pos(a) - pos(b)));
  }, [stages, activeBands, ordenCols, funnelActivo]);


  /**
   * Las columnas que el arrastre puede reordenar: las etapas PROPIAS del pipeline.
   *
   * ⚠️ NI LAS TERMINALES NI LAS DE NUTRICIÓN/SALIDAS. Ésas no están en el pipeline: las
   * agrega `generateFunnel` en CADA lectura (lib/pipeline.ts), así que moverlas
   * «funcionaría» —el server ignora la clave— y la pantalla las volvería a poner donde
   * estaban, que es la peor forma de no hacer nada.
   */
  const colsPropias = useMemo(
    () => columnasKanban.filter((s) => (s.band ?? 'pipeline') === 'pipeline' && !esTerminal(s.key)).map((s) => s.key),
    [columnasKanban],
  );
  /**
   * Las columnas que el menú puede ofrecer BORRAR: exactamente las que el server sabe
   * borrar, ni una más.
   *
   * ⚠️ ES UNA PREGUNTA DISTINTA DE `colsPropias`, aunque hoy se derive de ella. Aquélla
   * contesta «¿esto se puede arrastrar?»; ésta, «¿`editarEtapaAction` va a aceptar un
   * `eliminar` con esta clave?». Las tres respuestas del server son:
   *   · no está en `pipeline`  → «Esa etapa no es del pipeline: no se puede eliminar»
   *   · es terminal            → «está en todos los funnels»
   *   · es la ENTRADA          → «por esa etapa entra tu gente»
   * Las dos primeras las cubre `colsPropias`; la tercera va acá.
   *
   * Medido el 04/10/2026 contra producción antes de escribirlo: con la condición vieja
   * (`!esTerminal`) el menú ofrecía «Eliminar etapa» en **102 columnas de los 16 embudos**,
   * todas de la banda `nutricion`, y el server las rechazaba SIEMPRE. Es lo que Leila
   * encontró en vivo el 01/10 (00:11:07) sobre «Nutrición No Show R1».
   */
  const colsBorrables = useMemo(
    () => new Set(columnasKanban.filter((s) => colsPropias.includes(s.key) && s.kind !== 'entrada').map((s) => s.key)),
    [columnasKanban, colsPropias],
  );
  /** Dónde puede caer una columna: nunca antes de la entrada, que el server fuerza a 0. */
  const pisoCol = useMemo(() => {
    const ent = columnasKanban.find((s) => s.kind === 'entrada');
    const i = ent ? colsPropias.indexOf(ent.key) : -1;
    return i >= 0 ? i + 1 : 0;
  }, [columnasKanban, colsPropias]);
  /** Por esta columna se agarra. La entrada no se mueve (nada va antes de ella). */
  const seArrastraCol = (c: Stage) => colsPropias.includes(c.key) && c.kind !== 'entrada';

  const limpiarDragCol = () => {
    colAgarrada.current = null;
    mediosCol.current = [];
    setArrastrandoCol(null);
    setInsCol(null);
    copiaCol.current?.remove();
    copiaCol.current = null;
  };

  const agarrarCol = (e: React.DragEvent<HTMLElement>, key: string) => {
    // Donde se escribe o se clickea no arranca el arrastre: ahí arrastrar significa otra
    // cosa (seleccionar el título, abrir el menú).
    if ((e.target as HTMLElement | null)?.closest?.('[data-nodrag]')) { e.preventDefault(); return; }
    const col = e.currentTarget.closest<HTMLElement>('[data-colprop]');
    if (!col) return;
    e.dataTransfer.setData('text/plain', key);
    e.dataTransfer.effectAllowed = 'move';
    try {
      const vacio = document.createElement('canvas');
      vacio.width = 1; vacio.height = 1;
      e.dataTransfer.setDragImage(vacio, 0, 0);
    } catch { /* si no deja, queda la del navegador */ }

    const r = col.getBoundingClientRect();
    const clon = col.cloneNode(true) as HTMLElement;
    Object.assign(clon.style, {
      position: 'fixed', top: '0', left: '0', width: `${r.width}px`, margin: '0',
      // La copia se corta: una columna con veinte tarjetas es media pantalla siguiendo al
      // cursor y tapa justo el lugar donde hay que soltar.
      maxHeight: '200px', overflow: 'hidden',
      background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: '16px',
      boxShadow: '0 18px 40px rgba(18,21,27,.34)', pointerEvents: 'none', zIndex: '3000',
      transform: `translate3d(${r.left}px, ${r.top}px, 0)`, transition: 'none', opacity: '1',
    });
    document.body.appendChild(clon);
    copiaCol.current = clon;

    const dx = e.clientX - r.left, dy = e.clientY - r.top;
    const seguir = (ev: globalThis.DragEvent) => {
      if (!copiaCol.current) { document.removeEventListener('dragover', seguir, true); return; }
      copiaCol.current.style.transform = `translate3d(${ev.clientX - dx}px, ${ev.clientY - dy}px, 0)`;
    };
    document.addEventListener('dragover', seguir, true);
    const fin = () => {
      document.removeEventListener('dragover', seguir, true);
      document.removeEventListener('dragend', fin, true);
      document.removeEventListener('drop', fin, true);
      copiaCol.current?.remove();
      copiaCol.current = null;
    };
    document.addEventListener('dragend', fin, true);
    document.addEventListener('drop', fin, true);
    colAgarrada.current = key;
    mediosCol.current = [];
    // A la columna ORIGEN no se le toca el TAMAÑO: se marca. Y va en el tick siguiente,
    // porque el navegador saca la foto del arrastre al terminar este handler.
    setTimeout(() => setArrastrandoCol(key), 0);
  };

  /**
   * EL EMPUJE HORIZONTAL DEL TABLERO VIVE EN `document` Y EN CAPTURA, no en el tablero.
   *
   * ⚠️ Martín, 05/10/2026: «si lo muevo muy al costado, se sale del contenedor del
   * kanban y deja de desplazar». Y era exactamente eso: el handler colgaba del `div`
   * que scrollea, así que en cuanto el cursor salía de su caja —pasando el borde
   * derecho, o por arriba y por abajo— el navegador dejaba de mandarle `dragover` y el
   * tablero se frenaba. Lo incómodo es justo el caso en que más falta hace: para llegar
   * a una columna que está fuera de la vista hay que llevar el cursor AL borde, y el
   * borde es donde el evento se corta.
   *
   * La regla ya estaba escrita en AGENTS.md para la copia que sigue al cursor —«el
   * listener va en `document` y en captura: el `dragover` de las columnas no cubre los
   * huecos entre ellas ni el fondo de la página»— y `useArrastreCopia` la cumple. Lo
   * que faltaba era aplicarla al SCROLL, que es el otro efecto del mismo gesto.
   *
   * La cuenta no cambia: la dirección sale de comparar el cursor con los bordes del
   * tablero, y pasado el borde la condición sigue siendo verdadera. Lo único que
   * cambiaba era si el evento llegaba.
   *
   * ⚠️ Y el `dragover` del `document` NO lleva `preventDefault()`: eso habilitaría el
   * drop sobre CUALQUIER punto de la página, incluida la barra lateral, y soltar ahí
   * tiene que seguir sin hacer nada.
   */
  useEffect(() => {
    if (dragId == null && arrastrandoCol == null) return;
    const empujeDelRiel = (e: DragEvent) => {
      const el = boardScrollRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const EDGE = 90;
      const dir = e.clientX < r.left + EDGE ? -1 : e.clientX > r.right - EDGE ? 1 : 0;
      if (dir !== 0) el.scrollLeft += dir * 18;
    };
    document.addEventListener('dragover', empujeDelRiel, true);
    return () => document.removeEventListener('dragover', empujeDelRiel, true);
  }, [dragId, arrastrandoCol]);

  /**
   * El `dragover` del contenedor, que atiende los DOS gestos.
   *
   * ⚠️ EL AUTO-SCROLL VA ACÁ Y NO EN UN `requestAnimationFrame`. Durante un arrastre
   * nativo el navegador congela rAF Y los timers: medido, 0 px en 1,2 s sobre el borde, y
   * el único tick llegando DESPUÉS de soltar (AGENTS.md). Lo único que el navegador sigue
   * entregando es `dragover`. La versión anterior armaba un rAF que no movía nada.
   *
   * ⚠️ Y MIRA LAS DOS MANOS. El guard viejo era `if (!el || dragId == null) return`: con
   * una columna agarrada `dragId` es null, así que ni llegaba a mirar el borde.
   */
  const onBoardDragOver = (e: React.DragEvent) => {
    const el = boardScrollRef.current;
    if (!el) return;
    const agarre = colAgarrada.current;
    if (dragId == null && !agarre) return;
    // ⚠️ EL EMPUJE HORIZONTAL YA NO ESTÁ ACÁ: vive en un listener de `document` (ver
    // `empujeDelRiel` más arriba). Dejarlo en los dos lo duplicaría —el tablero
    // correría al doble de velocidad mientras el cursor está encima— y «una cosa, un
    // lugar» vale igual para un gesto.
    if (!agarre) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    // El rect se mide acá y ya no arriba: lo único que lo usaba era el empuje, que se
    // mudó al `document`. Lo que queda es el reorden de COLUMNAS, que sí necesita saber
    // dónde empieza el tablero para pasar el cursor a coordenadas del contenedor.
    const r = el.getBoundingClientRect();
    // Se mide desde el `dragover` y no desde el `dragstart` —el mismo motivo que
    // `medirSiHaceFalta` en app/plan/board/BoardShell.tsx— y se re-mide sólo si cambió la
    // CANTIDAD de columnas: `getBoundingClientRect` fuerza layout y acá no puede correr
    // sesenta veces por segundo. El scroll no invalida nada porque las X son del contenedor.
    const nodos = el.querySelectorAll<HTMLElement>('[data-colprop]');
    if (mediosCol.current.length !== nodos.length) {
      mediosCol.current = [...nodos].map((n) => {
        const q = n.getBoundingClientRect();
        return { key: n.dataset.colprop ?? '', x: q.left - r.left + el.scrollLeft + q.width / 2 };
      });
    }
    const x = e.clientX - r.left + el.scrollLeft;
    const m = mediosCol.current;
    let idx = m.length;
    for (let i = 0; i < m.length; i++) { if (x < m[i].x) { idx = i; break; } }
    // ⚠️ LA MARCA NO PUEDE PROMETER UN LUGAR QUE EL DROP CORRIGE. Las tres bandas van en
    // una sola fila, así que el cursor puede terminar pasada la última columna de salidas:
    // el índice se calcula SÓLO sobre las reordenables, y el piso es la entrada.
    if (idx < pisoCol) idx = pisoCol;
    // Sólo se repinta cuando el destino CAMBIA: es la diferencia medida entre un arrastre
    // que se siente bien (4 repintados en todo el gesto) y uno que se ve roto (60 por segundo).
    setInsCol((p) => (p === idx ? p : idx));
  };

  const soltarCol = (key: string, destino: number) => {
    const i = colsPropias.indexOf(key);
    if (i < 0) return;
    const resto = colsPropias.filter((k) => k !== key);
    // El índice se corre uno cuando la columna venía de más a la izquierda, o soltar hacia
    // la derecha cae un lugar antes. Y nunca por delante de la entrada.
    const pos = Math.max(pisoCol, i < destino ? destino - 1 : destino);
    if (pos === i) return;
    const keys = [...resto.slice(0, pos), key, ...resto.slice(pos)];
    setOrdenCols({ funnel: funnelActivo, keys });
    // Si el server lo rechaza, el orden local se cae: dejarlo pintado sería mostrar un
    // embudo que no existe hasta la próxima recarga.
    void opEtapa({ op: 'reordenar', keys }).then((r) => { if (!r?.ok) setOrdenCols(null); });
  };

  /**
   * Mover una columna UN lugar, con el botón partido de su cabecera.
   *
   * ⚠️ PASA POR `soltarCol`, el mismo camino que el arrastre: es el que clampea contra la
   * entrada, el que pinta optimista y el que devuelve el orden si el server rechaza. Un
   * segundo camino acá serían dos formas de reordenar que se desincronizan en el primer
   * ajuste — y el arrastre y el botón se ven en la misma pantalla.
   *
   * El `+1` del destino a la derecha compensa que `soltarCol` interpreta el índice como
   * «antes de esta posición» sobre la lista SIN la columna que viaja.
   */
  const moverCol = (key: string, delta: -1 | 1) => {
    const i = colsPropias.indexOf(key);
    if (i < 0) return;
    soltarCol(key, delta < 0 ? i - 1 : i + 2);
  };

  // Una columna del Kanban (reutilizada por cada banda).
  const renderColumn = (c: Stage) => {
    const cards = enOrden(filtered.filter((l) => effStage(l) === c.key));
    const bandC = CATEGORY[bandToCategory(c.band)].c;
    // Dónde está esta columna entre las reordenables, y si la marca de destino cae acá.
    const iProp = colsPropias.indexOf(c.key);
    const marcaCol = insCol == null || iProp < 0
      ? null
      : insCol === iProp
        ? MARCA_COL
        : insCol === iProp + 1 && iProp === colsPropias.length - 1 ? MARCA_COL_FIN : null;
    return (
      <div key={c.key}
        /* `data-colprop` marca las columnas que el arrastre reordena: es de donde
           `onBoardDragOver` saca los puntos medios, así que no es decoración. */
        data-colprop={iProp >= 0 ? c.key : undefined}
        /* `data-colkey` es de donde `medirTarjetas` saca los puntos medios de ESTA
           columna. Va en TODAS, no sólo en las reordenables como `data-colprop`: una
           tarjeta se puede soltar en cualquiera. */
        data-colkey={c.key}
        onDragOver={(e) => {
          e.preventDefault();
          if (dragId != null && dragOverCol !== c.key) setDragOverCol(c.key);
          // El scroller es el hijo con `overflowY`, no la columna: la columna topea
          // en 68vh y el que desborda es el carril de tarjetas de adentro.
          const carril = (e.currentTarget as HTMLElement).querySelector('[data-carril]') as HTMLElement | null;
          if (!carril) return;
          const d = empujeDeColumna(carril.getBoundingClientRect(), e.clientY);
          if (d !== 0) carril.scrollTop += d;
          // DÓNDE cae: el primer punto medio que queda por debajo del cursor. Y sólo se
          // re-renderiza cuando el destino cambia DE VERDAD — con un `setState` por
          // `dragover` el tablero se redibuja sesenta veces por segundo y el arrastre
          // se siente roto, que es el bug que el Plan pagó siete veces.
          if (dragId == null) return;
          const y = e.clientY + window.scrollY + carril.scrollTop;
          const ms = medidasTarjetas.current[c.key] ?? [];
          let idx = ms.length;
          for (let k = 0; k < ms.length; k++) { if (y < ms[k]) { idx = k; break; } }
          setInsTarjeta((p) => (p && p.col === c.key && p.idx === idx ? p : { col: c.key, idx }));
        }}
        onDragLeave={(e) => {
          // Sólo al salir DE VERDAD: `dragleave` también salta al pasar de la columna a
          // una tarjeta de adentro, y sin esta guarda el hueco parpadea en cada cruce.
          if (dragId == null) return;
          if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) {
            setInsTarjeta((p) => (p && p.col === c.key ? null : p));
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          // Antes de QUIÉN cae, leído del hueco que se dibujó. Sin hueco en esta columna no se
          // prometió ningún lugar, y el orden no se toca.
          const antes = dragId != null && insTarjeta?.col === c.key
            ? antesDeQuien(cards.map((x) => x.id), insTarjeta.idx, [dragId])
            : undefined;
          handleDrop(c.key, antes);
          limpiarArrastreTarjeta();
        }}
        style={{ flex: 'none', width: 282, background: dragOverCol === c.key && dragId != null ? 'var(--surface-2)' : 'var(--surface)', borderLeft: '1px solid ' + (dragOverCol === c.key && dragId != null ? 'var(--primary)' : 'var(--border)'), borderRight: '1px solid ' + (dragOverCol === c.key && dragId != null ? 'var(--primary)' : 'var(--border)'), borderBottom: '1px solid ' + (dragOverCol === c.key && dragId != null ? 'var(--primary)' : 'var(--border)'), borderTop: '3px solid ' + bandC, borderRadius: 16, display: 'flex', flexDirection: 'column', maxHeight: '68vh', transition: 'background .15s, border-color .15s, box-shadow .15s', boxShadow: dragOverCol === c.key && dragId != null ? '0 0 0 3px var(--primary-weak)' : 'none', opacity: arrastrandoCol === c.key ? 0.55 : 1, ...marcaCol }}
      >
        {/* ⚠️ EL CONTADOR VA DESPUÉS DEL TÍTULO, y el lugar de la derecha es para el menú.
            Pedido de Martín: «en el lugar donde hoy está el 14 que estén 3 puntitos para
            opciones de editar esa columna/etapa del funnel. El actual 14 que esté posterior
            al título». El contador es un dato DE la etapa y va pegado a su nombre; el borde
            derecho de una fila es donde el ojo busca las acciones. */}
        {/* ⚠️ EL `draggable` VA EN LA CABECERA, NO EN LA COLUMNA. El div de la columna es el
            drop target de las TARJETAS: hecho arrastrable, los dos gestos se pisan y agarrar
            una tarjeta movería la columna. Acá arriba no hay tarjetas.
            Y el drop lo atiende el CONTENEDOR del tablero, que es el único que sabe entre qué
            dos columnas quedó el cursor. */}
        <div
          draggable={seArrastraCol(c) && renombrando !== c.key}
          onDragStart={(e) => agarrarCol(e, c.key)}
          onDragEnd={limpiarDragCol}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '14px 16px 11px', borderBottom: '1px solid var(--border)', cursor: seArrastraCol(c) && renombrando !== c.key ? 'grab' : 'default' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, flex: 1 }}>
            <span style={{ width: 9, height: 9, flex: 'none', borderRadius: '50%', background: c.dot }} />
            {renombrando === c.key ? (
              /* El nombre se edita EN SU LUGAR. Un modal para cambiar una palabra es un
                 paso de más, y acá se ve contra las otras columnas mientras se escribe. */
              <input
                autoFocus
                data-nodrag
                defaultValue={c.label}
                maxLength={MAX_LABEL_ETAPA}
                onBlur={(e) => guardarNombre(c.key, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') { setRenombrando(null); }
                }}
                style={{ flex: 1, minWidth: 0, fontFamily: SANS, fontWeight: 600, fontSize: 14, color: 'var(--ink)', background: 'var(--surface-2)', border: '1px solid var(--primary)', borderRadius: 7, padding: '3px 7px' }}
              />
            ) : (
              <>
                {/* ⚠️ EL INPUT ABRE SÓLO DESDE EL TEXTO. Pedido de Martín (29/09/2026): «si le
                    doy click a un título, dejarme cambiar el nombre» — y el molde del pop-up
                    de etapas ya tenía resuelto el matiz: «solo si clickeo en el texto del
                    título de esa etapa debería abrirme el input, no en toda la fila». Por eso
                    el botón NO estira, y `data-nodrag` para que arrastrar sobre el texto
                    seleccione en vez de mover la columna.
                    `title` con el nombre entero: el ellipsis oculta y no hay otra forma de leerlo. */}
                <button type="button" data-nodrag title={c.label} onClick={() => setRenombrando(c.key)}
                  style={{ flex: '0 1 auto', minWidth: 0, textAlign: 'left', fontFamily: SANS, fontWeight: 600, fontSize: 14, color: 'var(--ink)', background: 'none', border: 'none', padding: 0, cursor: 'text', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                >{c.label}</button>
                <span style={{ flex: 'none', fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: 'var(--dim)', background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 999, fontVariantNumeric: 'tabular-nums' }}>{cards.length}</span>
                {/* ⚠️ EL HUECO VA DESPUÉS DEL CONTADOR, no entre el título y el contador: ahí
                    el `space-between` le empujaría el número al otro extremo, que es el layout
                    que Martín pidió cambiar. Y es por donde se agarra para arrastrar. */}
                <span aria-hidden style={{ flex: 1, alignSelf: 'stretch', minWidth: 8 }} />
              </>
            )}
          </div>
          {renombrando !== c.key && (
            /* ⚠️ EL `⋯` QUEDA FUERA DEL AGARRE, y por eso el `<span data-nodrag>`: el
               `Dropdown` tiene la lista de props cerrada (sin `...rest`), así que el atributo
               no se le puede pasar. Sin esto, abrir el menú arrastra la columna. */
            <span data-nodrag style={{ flex: 'none', display: 'inline-flex' }}>
              {/* ⚠️ VA EL `Dropdown` DEL REPO Y NO UN MENÚ PROPIO: el tablero vive dentro de un
                 `overflowX: auto`, así que un menú en flujo normal se recorta contra el borde
                 de la columna. Éste se dibuja por portal. */}
              <Dropdown
                value=""
                placeholder="⋯"
                align="right"
                resetAfterSelect
                sinFlecha
                ariaLabel={`Opciones de la etapa ${c.label}`}
                buttonStyle={{ width: 28, height: 28, padding: 0, justifyContent: 'center', border: '1px solid transparent', background: 'transparent', color: 'var(--dim)', fontSize: 16, lineHeight: 1 }}
                options={[
                  // ⚠️ LAS FLECHAS VAN PRIMERO Y SIN RÓTULO: «el botón de mover no debería
                  // tener la palabra mover, solo las flechas. Debería estar primero de todos
                  // ese botón, y en realidad, deberían ser 2 botones diferentes, solo que
                  // están en la misma linea» (Martín, 30/09/2026). Antes de eso estuvieron
                  // sueltas en la cabecera menos de un día —con 12 columnas son dos botones
                  // más por cabecera, o sea una barra de controles arriba de cada lista— y
                  // después como un renglón «Mover» con las flechas al costado.
                  //
                  // `soloAcciones` es lo que hace que sean DOS botones y no un renglón con
                  // adornos: sin él, el rótulo se queda con el `flex: 1` y media fila queda
                  // clicable sin hacer nada. Y sólo se dibuja en las que se pueden mover: es
                  // el MISMO predicado que habilita el arrastre, para que las dos formas del
                  // gesto no se contradigan.
                  ...(seArrastraCol(c) ? [{
                    value: 'mover', label: 'Mover', soloAcciones: true,
                    acciones: [
                      {
                        icono: <FlechaIzquierdaIcon />,
                        title: `Mover ${c.label} a la izquierda`,
                        onClick: () => moverCol(c.key, -1),
                      },
                      {
                        icono: <FlechaDerechaIcon />,
                        title: `Mover ${c.label} a la derecha`,
                        onClick: () => moverCol(c.key, 1),
                      },
                    ],
                  }] : []),
                  // «En la opción de los 3 puntos de "Lead entrante" debería estar la opción
                  // para asignar una campaña» (Martín, 05/10/2026). Sólo en la ENTRADA: es la
                  // etapa por la que entra un lead de Meta, y es el mismo lugar donde vive la
                  // sección en el pop-up del embudo.
                  ...(c.kind === 'entrada' ? [{ value: 'campanas', label: 'Campañas de Meta' }] : []),
                  // «Automatizar la invitación al curso cuando un lead cae a Ganado... Pero que sea
                  // opcional» (Martín, 07/10/2026). En Ganado, que es donde se ve a quién le llega, y
                  // sólo si el producto tiene clases (sin curso no hay a qué invitar).
                  ...(cursoAlGanar && terminalEstadoFor(c.key) === 'ganado'
                    ? [{ value: 'curso', label: 'Invitar al curso al ganar', sub: cursoPrendido ? 'Prendido' : 'Apagado' }]
                    : []),
                  { value: 'renombrar', label: 'Cambiar el nombre' },
                  // «En lugar de "Agregar etapa después" simplemente "Agregar etapa"» (Martín,
                  // 29/09/2026). Sigue insertando DESPUÉS de esta: el rótulo explicaba el
                  // mecanismo, y desde el menú de una columna el lugar ya se entiende.
                  { value: 'agregar', label: 'Agregar etapa' },
                  // ⚠️ LA OPCIÓN NO EXISTE CUANDO NO SE PUEDE, en vez de dibujarse apagada:
                  // «si no se puede eliminar, no pongas directamente esa opción, no la dejes en
                  // gris» (Martín, 29/09/2026). Las cuatro terminales están en todos los
                  // funnels: se renombran, no se borran — y el que lo hace cumplir es el server
                  // (`editarEtapaAction` rechaza `eliminar` sobre una terminal), no este array.
                  //
                  // ⚠️ Y LA CONDICIÓN ES `colsPropias`, NO `!esTerminal`. El server sólo sabe
                  // borrar lo que está GUARDADO en `pipeline` (app/crm/actions.ts: «Esa etapa
                  // no es del pipeline: no se puede eliminar, solo renombrar»), y las de
                  // nutrición/salidas no están ahí: las agrega `generateFunnel` en cada
                  // lectura. Con `!esTerminal` el menú las ofrecía igual y el server las
                  // rechazaba SIEMPRE — medido el 04/10/2026 contra producción: **102 columnas
                  // en los 16 embudos**, todas de la banda `nutricion`. Leila lo encontró en
                  // vivo el 01/10 intentando borrar «Nutrición No Show R1» (00:11:07).
                  //
                  // La condición correcta ya estaba escrita arriba, en `colsPropias`, con su
                  // porqué — y la usaba el ARRASTRE (`seArrastraCol`) y no el borrado. Es «una
                  // regla aplicada en un lugar de dos no está implementada, está documentada».
                  ...(colsBorrables.has(c.key) ? [{ value: 'eliminar', label: 'Eliminar etapa' }] : []),
                ]}
                onChange={(v) => {
                  if (v === 'campanas') { setCampanasAbierto(true); return; }
                  if (v === 'curso') { void cambiarCurso(!cursoPrendido); return; }
                  if (v === 'renombrar') { setRenombrando(c.key); return; }
                  if (v === 'agregar') { void opEtapa({ op: 'agregar', despuesDe: c.key }); return; }
                  if (v === 'eliminar') void quitarColumna(c);
                }}
              />
            </span>
          )}
        </div>
        <div data-carril style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
          {/* ⚠️ EL PLACEHOLDER PASA POR EL MISMO CAMINO QUE SOLTAR UNA TARJETA ACÁ.
              Pedido de Martín (29/09/2026): «en todas las columnas, siempre al principio un
              placeholder más finito que las cards normales, que diga Nuevo lead».

              Por qué NO crea el lead «en esta etapa» de una: el alta no acepta una etapa a
              propósito. Escribir `pipeline_stage` en el alta sería un SEGUNDO escritor que
              saltea el choke point donde `setPipelineStage` audita TODO movimiento
              (lib/leads.ts). Y hay columnas donde un alta a ciegas MIENTE: «Nutrición -
              Manual» pide su plazo, las de reunión abren la agenda, Ganado escribiría una
              venta sin monto que después cuentan los números de facturación, y Perdido un
              lead nacido perdido sin motivo. Entrando por `handleDrop`, cada columna abre lo mismo
              que abre al soltar una tarjeta ahí.

              Apagado y se ilumina al pasar el cursor: el mismo molde que «＋ Nueva tarea» del
              tablero del plan. El hover lo pone el velo de `.crm-hover button:hover`. */}
          <button type="button" onClick={() => { setAltaPendiente(null); setNuevoLead({ etapa: c.key }); }}
            title={`Cargar un lead en ${c.label}`}
            style={{ flex: 'none', textAlign: 'left', border: '1px dashed var(--border-strong)', background: 'none', color: 'var(--faint)', borderRadius: 11, padding: '7px 13px', fontFamily: SANS, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
          >＋ Nuevo lead</button>
          {cards.map((l, iCard) => {
            const isGanado = effStage(l) === 'ganado';
            const isManual = effStage(l) === 'manual';
            const dl = l.nutriManualDeadline;
            const dlFmt = dl ? `${dl.slice(8, 10)}/${dl.slice(5, 7)}/${dl.slice(0, 4)}` : null;
            const overdueManual = isManual && l.estadoLead === 'abierto' && !!dl && dl < hoy;
            const waiting = pendingLeadIds.has(l.id);
            const hueco = insTarjeta?.col === c.key && insTarjeta.idx === iCard;
            return (
              <Fragment key={l.id}>
              {/* EL HUECO: el alto de una tarjeta, punteado del color de la banda, en el
                  índice exacto donde va a caer. Es lo que convierte «en esta columna» en
                  «acá». */}
              {hueco && <div aria-hidden style={{ flex: 'none', height: 92, borderRadius: 11, border: '2px dashed ' + bandC, background: 'var(--surface-2)' }} />}
              <div
                data-leadcard
                className="mk-tarjeta-lead"
                onClick={() => openDetail(l)}
                draggable
                onDragStart={(ev) => {
                  setDragId(l.id);
                  ev.dataTransfer.effectAllowed = 'move';
                  fotoVaciaDeArrastre(ev.dataTransfer);
                  const nodo = ev.currentTarget as HTMLElement;
                  const r = nodo.getBoundingClientRect();
                  montarCopia(nodo, ev.clientX - r.left, ev.clientY - r.top);
                  // Los puntos medios se fotografían ACÁ, con el tablero todavía quieto.
                  medirTarjetas();
                }}
                onDragEnd={limpiarArrastreTarjeta}
                style={{ background: 'var(--surface-2)', borderTop: '1px solid var(--border)', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', borderLeft: overdueManual ? '3px solid var(--bad)' : '1px solid var(--border)', borderRadius: 11, padding: '13px 14px', cursor: 'grab', transition: 'opacity .15s, transform .15s, box-shadow .15s', opacity: 1, transform: 'none', boxShadow: 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  {/* LA CASILLA. `onClick` con `stopPropagation` y no `onChange`: el click
                      en la tarjeta ABRE la ficha, asi que sin frenarlo tildar abriria el
                      lead. Y el `onPointerDown` frena el ARRASTRE — la tarjeta entera es
                      `draggable`, y sin esto agarrar la casilla empieza a mover el lead en
                      vez de tildarlo (el molde de `data-nodrag` de la tabla del plan). */}
                  <input type="checkbox" checked={selLeads.has(l.id)}
                    className="mk-sel-tarjeta"
                    data-marcada={selLeads.has(l.id) ? '1' : '0'}
                    onPointerDown={(ev) => ev.stopPropagation()}
                    onClick={(ev) => { ev.stopPropagation(); alternarSel(l.id); }}
                    onChange={() => { /* lo hace el onClick: ver arriba */ }}
                    title={selLeads.has(l.id) ? rotQuitar(l.name) : rotPoner(l.name)}
                    aria-label={selLeads.has(l.id) ? rotQuitar(l.name) : rotPoner(l.name)}
                    /* ⚠️ SIN `width`: lo gobierna `.mk-sel-tarjeta`, que lo lleva de 0 a 15 al
                       pasar el cursor. Un ancho en linea le gana a la clase y dejaria la
                       casilla siempre ancha —o sea el nombre corrido por defecto, que es
                       justo lo que se saco— con la transicion de opacidad funcionando, que
                       es como se ve arreglado sin estarlo. */
                    style={{ height: 15, marginTop: 2, cursor: 'pointer', accentColor: 'var(--primary)', flex: 'none' }} />
                  <div style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.25, minWidth: 0, flex: 1 }}>{l.name}</div>
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
                {/* ⚠️ ESTÁ DIBUJADO ACÁ Y NO ES DE ACÁ. La etapa guardada del lead no
                    existe en este funnel, así que el tablero lo ubica donde puede —
                    la derivada, o la primera columna. Medido en el relevamiento del
                    25/09: 1.057 de los 1.138 leads del ws1 están en este caso, por
                    `reactivacion`, `noshow_r1` y `noshow_r2`, etapas que el funnel
                    dejó de tener.

                    Sin el chip, esos leads se leen como «Nuevo» y no hay forma de
                    saber que no lo son. El chip no los mueve: dice dónde están de
                    verdad. Mover 1.057 leads es una decisión, y decirlo no.

                    `stageMetaOpt` y NO `stageMeta`: el segundo cae a `stages[0]`, o
                    sea que contestaría «Nuevo» — el mismo dato falso otra vez. */}
                {l.stageFuera && (
                  <div title={`Este lead quedó guardado en «${stageMetaOpt(stages, l.stageFuera)?.label ?? l.stageFuera}», una etapa que tu embudo ya no tiene. Se muestra aquí porque no hay columna donde ponerlo.`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, fontSize: 10.5, fontWeight: 600, color: 'var(--dim)', background: 'var(--surface)', border: '1px dashed var(--border-strong)', borderRadius: 999, padding: '1px 8px', maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {stageMetaOpt(stages, l.stageFuera)?.label ?? l.stageFuera} · fuera del embudo
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12, color: 'var(--dim)' }}>{isGanado ? 'Ganado' : isManual ? (overdueManual ? 'Venció' : 'Vence') : l.agenda ? 'Agenda' : l.created}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: isGanado ? 'var(--good)' : overdueManual ? 'var(--bad)' : 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>{isGanado ? montoDeTarjeta(l).texto : isManual ? (dlFmt ?? 'sin fecha') : l.agenda || '—'}</span>
                </div>
              </div>
              </Fragment>
            );
          })}
          {/* EL HUECO DEL FINAL: soltar DEBAJO de la última tarjeta. Es el único índice
              que no tiene una tarjeta delante, así que sin esto la columna no puede
              decir «va al fondo» — y el fondo es donde cae casi todo lo que se mueve a
              una columna vacía. */}
          {insTarjeta?.col === c.key && insTarjeta.idx >= cards.length && (
            <div aria-hidden style={{ flex: 'none', height: 92, borderRadius: 11, border: '2px dashed ' + bandC, background: 'var(--surface-2)' }} />
          )}
        </div>
      </div>
    );
  };

  return (
    <main className="crm-hover" style={{ flex: 1, minWidth: 0, padding: '34px 44px 60px', display: 'flex', flexDirection: 'column' }}>
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
        {/* El pill del CRM automático y su divisor se fueron del header: el interruptor es
            ahora un renglón del menú de `AccionesHeader` (ver su comentario en CrmToolbar).
            Este call site se desenchufa acá porque el componente que lo montaba ya no existe. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <AccionesHeader
            onImportar={() => setImportar(true)} onExportar={() => setExportar(true)} onNuevo={() => setNuevoLead({ etapa: null })}
            onEditarEtapas={() => setEtapasDe({ id: funnelActivo, nombre: nombreDeFunnel(funnelActivo) })} />
        </div>
      </header>

      {/* ⚠️ SE PUEDE CERRAR Y SE PUEDE REINTENTAR, desde el 27/09/2026. Era una barra
          roja con el mensaje crudo de Postgres y ninguna salida: no se cerraba, no
          ofrecía volver a intentar, y se quedaba ahí arriba tapando el tablero hasta
          que alguien recargaba a mano. Es la fila «errores que no se pueden cerrar ni
          resolver» del plan, que estaba marcada como aplicada con sólo la mitad hecha
          (el reintento del chat del lead).

          El mensaje técnico se queda: es lo único que dice qué pasó. Lo que se agrega
          es qué HACER con él. */}
      {errorMsg && !errorCerrado && (
        <div style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 13, padding: '14px 18px', marginBottom: 14, color: 'var(--bad)', fontSize: 14, display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ flex: '1 1 260px', minWidth: 0 }}>
            No se pudo leer Supabase: <span style={{ fontFamily: MONO }}>{errorMsg}</span>
          </span>
          <span style={{ flex: 'none', display: 'inline-flex', gap: 10 }}>
            <button type="button" onClick={() => router.refresh()}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13.5, fontWeight: 700, color: 'var(--bad)', fontFamily: SANS, textDecoration: 'underline' }}>
              Reintentar
            </button>
            <button type="button" onClick={() => setErrorCerrado(true)} aria-label="Cerrar el aviso"
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 15, lineHeight: 1, color: 'var(--bad)', fontFamily: SANS }}>
              ×
            </button>
          </span>
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
            listas={listasFiltro}
            orden={ordenFiltro}
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
        {vista !== 'pendientes' && <SelectorFunnel funnels={funnels} activo={funnelActivo} onEditarEtapas={(id, nombre) => setEtapasDe({ id, nombre })} />}
      </div>

      {/* Fila 2 — solo si hay filtros activos (el buscador no genera chip). */}
      {vista !== 'pendientes' && (
        <FiltroChips
          stages={stages}
          etapas={stageFilter} setEtapas={setStageFilter}
          origen={originFilter} setOrigen={setOriginFilter}
          listas={listasFiltro}
          orden={ordenFiltro}
          onAbrir={abrirFiltro}
        />
      )}

      {/* LA BARRA DE LOTE: UNA, ARRIBA DE LAS DOS VISTAS.
          La seleccion vive en el tablero y SOBREVIVE al cambio de vista (ver `selLeads`),
          asi que la barra tambien: montarla adentro de cada rama serian dos copias del
          mismo control, y el dia que una gane una accion la otra se queda vieja.

          No se dibuja en «datos sin marcar»: esa vista tiene su propio lote
          (`BulkHigiene`), que contesta otra pregunta — ahi los leads los eligio un
          filtro y aca los tildo una persona.

          `position: sticky` + `top: 8` es `BarraPegada` del plan, escrita aca porque es
          una linea y porque importarla arrastraria `Tablas.tsx` entero (95 KB) al bundle
          del CRM. ⚠️ Y VA AFUERA de la caja de la tabla, que lleva `overflow: hidden`:
          un sticky adentro de algo que recorta se queda clavado igual que si no lo
          tuviera, con el `position` puesto y sin un solo error. */}
      {!showSinMarcar && elegidos.length > 0 && (
        <div style={{ position: 'sticky', top: 8, zIndex: 20, marginBottom: 10 }}>
          <AccionesLoteLeads
            elegidos={elegidos.map((l) => ({ id: l.id, name: l.name, stage: effStage(l), closer: l.closer, setter: l.setter }))}
            stages={stages}
            productos={funnels.map((f) => ({ id: f.id, nombre: f.nombre, esDefault: f.esDefault }))}
            equipo={equipo}
            funnelActivo={funnelActivo}
            onLimpiar={limpiarSel}
            // ⚠️ EL DESHACER DEL LOTE LO CUELGA EL TABLERO, no la barra: la barra se desmonta
            // al limpiar la selección y un aviso suyo moriría con ella. Hoy lo trae «agregar a
            // un producto» (mig 0207), que borra sólo las filas que ese lote creó. Deshacer
            // escribe en el server; si no puede, se dice.
            onListo={(r) => {
              const deshacer = r.deshacer;
              mostrarAviso(r.texto, deshacer ? () => {
                startTransition(async () => {
                  try { await deshacer(); } catch { mostrarAviso('No se pudo deshacer', undefined, 'bad'); }
                  router.refresh();
                });
              } : undefined);
              router.refresh();
            }}
            estilo={{ boxShadow: '0 8px 24px rgba(18,21,27,.14)' }} />
        </div>
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
          {/* ⚠️ CON CERO LEADS SE DIBUJAN LAS COLUMNAS IGUAL, y eso cambió el 28/09/2026.
              Antes, sin tarjetas el Kanban no pintaba NINGUNA columna — y desde que cada
              funnel tiene sus propios leads, un tablero recién creado arranca justamente en
              cero: mostraba una pantalla en blanco donde tenía que mostrar el embudo que la
              persona acaba de elegir. Peor: sin columnas tampoco hay cabecera, así que el
              menú para ajustar las etapas no existía justo cuando más hace falta.

              El aviso de «no hay nada» sigue, pero ARRIBA de las columnas y no en su lugar:
              es un dato sobre el tablero, no un reemplazo del tablero. Y sólo cuando hay
              FILTROS puestos se ofrece limpiarlos — con el funnel vacío de verdad, lo que
              corresponde es cargar un lead, no limpiar nada. */}
          {/* ⚠️ Y LA CONDICIÓN LLEVA `hayFiltros` TAMBIÉN ACÁ, no sólo adentro de
              `SinResultados`. El componente ya devuelve null sin filtros, pero este `div`
              se dibujaba igual: un hueco vacío de 14 px entre la barra y las columnas
              cada vez que el funnel está en cero. */}
          {filtered.length === 0 && hayFiltros && (
            <div style={{ marginBottom: 14 }}>
              <SinResultados hayFiltros={hayFiltros} onLimpiar={limpiarTodo} />
            </div>
          )}
          {(
            /* ⚠️ EL DROP DE UNA COLUMNA LO ATIENDE ESTE CONTENEDOR, no la columna: es el único
               que sabe entre qué dos columnas quedó el cursor. El drop de una TARJETA lo sigue
               atendiendo cada columna y llega acá por burbujeo, donde no hace nada. */
            <div ref={boardScrollRef} onDragOver={onBoardDragOver}
              onDrop={(e) => {
                if (!colAgarrada.current) return;
                e.preventDefault();
                const key = e.dataTransfer.getData('text/plain') || colAgarrada.current;
                const destino = insCol ?? colsPropias.length;
                limpiarDragCol();
                if (key) soltarCol(key, destino);
              }}
              style={{ flex: 1, minHeight: 0, overflowX: 'auto', paddingBottom: 14 }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', width: 'max-content' }}>
                {columnasKanban.map((c) => renderColumn(c))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          {/* ⚠️ LA CASILLA DE «TODAS» MARCA LO QUE SE VE, no la tabla entera. Con un filtro
              puesto, «todas» tiene que significar las que el filtro dejo — seleccionar en
              silencio 1.100 leads que no estan en pantalla y despues ofrecer «Eliminar» es
              exactamente el boton que nadie puede auditar antes de apretarlo. */}
          <div style={{ display: 'grid', gridTemplateColumns: COLS_TABLA, gap: 12, padding: '15px 22px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', fontFamily: MONO, fontSize: 11, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--dim)', alignItems: 'center' }}>
            <span>
              <input type="checkbox" checked={todosSel}
                ref={(el) => { if (el) el.indeterminate = !todosSel && idsVisibles.some((id) => selLeads.has(id)); }}
                onChange={() => setSelLeads(todosSel ? new Set() : new Set(idsVisibles))}
                title={todosSel ? 'Quitar la selección' : 'Seleccionar los de esta vista'}
                aria-label={todosSel ? 'Quitar la selección' : 'Seleccionar los de esta vista'}
                style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--primary)' }} />
            </span>
            <ThCrm activo={ordenTabla === 'nombre'} dir={dirTabla} onSort={() => sortearTabla('nombre')}>Nombre</ThCrm>
            <ThCrm activo={ordenTabla === 'empresa'} dir={dirTabla} onSort={() => sortearTabla('empresa')}>Empresa</ThCrm>
            <ThCrm activo={ordenTabla === 'origen'} dir={dirTabla} onSort={() => sortearTabla('origen')}>Origen</ThCrm>
            <ThCrm activo={ordenTabla === 'etapa'} dir={dirTabla} onSort={() => sortearTabla('etapa')}>Etapa</ThCrm>
            <ThCrm activo={ordenTabla === 'agenda'} dir={dirTabla} onSort={() => sortearTabla('agenda')}>¿Agendó?</ThCrm>
            <ThCrm activo={ordenTabla === 'monto'} dir={dirTabla} onSort={() => sortearTabla('monto')}>Monto</ThCrm>
            <ThCrm activo={ordenTabla === 'creado'} dir={dirTabla} onSort={() => sortearTabla('creado')} alinear="right">Creado</ThCrm>
            {/* SIN ROTULO: la columna trae dos acciones distintas y una palabra nombraria
                mal a una de las dos. Cada boton se anuncia por su `title`/`aria-label`,
                que es donde el texto no ocupa lugar. */}
            <span aria-label="Acciones" />
          </div>
          {filasTabla.map((l) => {
            const m = findStage(stages, effStage(l));
            const isGanado = effStage(l) === 'ganado';
            const tildado = selLeads.has(l.id);
            return (
              <div key={l.id} onClick={() => openDetail(l)}
                draggable
                onDragStart={(ev) => {
                  filaAgarrada.current = l.id;
                  ev.dataTransfer.effectAllowed = 'move';
                  // La misma pieza compartida que usa el Kanban: foto vacia para que el
                  // SO no pinte su version translucida, y una copia que dibujamos
                  // nosotros y movemos con transform desde un dragover en captura.
                  fotoVaciaDeArrastre(ev.dataTransfer);
                  const nodo = ev.currentTarget as HTMLElement;
                  const r = nodo.getBoundingClientRect();
                  montarCopia(nodo, ev.clientX - r.left, ev.clientY - r.top);
                }}
                onDragOver={(ev) => {
                  // Solo es destino si hay algo en la mano y la etapa CAMBIA: resaltar una
                  // fila que no va a hacer nada es ofrecer un movimiento que no existe.
                  const id = filaAgarrada.current;
                  if (id == null || id === l.id) return;
                  const origen = leads.find((x) => x.id === id);
                  if (!origen || effStage(origen) === effStage(l)) return;
                  ev.preventDefault();
                  ev.dataTransfer.dropEffect = 'move';
                  setFilaDestino((prev) => (prev === l.id ? prev : l.id));
                }}
                onDragLeave={(ev) => {
                  if (ev.currentTarget.contains(ev.relatedTarget as Node | null)) return;
                  setFilaDestino((prev) => (prev === l.id ? null : prev));
                }}
                onDrop={(ev) => {
                  ev.preventDefault();
                  const id = filaAgarrada.current;
                  filaAgarrada.current = null;
                  setFilaDestino(null);
                  soltarCopia();
                  const origen = id == null ? null : leads.find((x) => x.id === id);
                  if (!origen || effStage(origen) === effStage(l)) return;
                  // ⚠️ EL MISMO `handleDrop` QUE EL KANBAN, no una escritura propia. Ese
                  // camino ya sabe lo que esta tabla no: que «Nutricion - Manual» pide su
                  // plazo, que las etapas de Calendly abren la agenda, que hay senales que
                  // ofrecerle a Meta, y que al soltar va el toast con «Deshacer» que
                  // escribe en el SERVER.
                  idASoltar.current = origen.id;
                  handleDrop(effStage(l));
                }}
                onDragEnd={() => { filaAgarrada.current = null; setFilaDestino(null); soltarCopia(); }}
                style={{
                  display: 'grid', gridTemplateColumns: COLS_TABLA, gap: 12, padding: '15px 22px',
                  borderBottom: '1px solid var(--border)', alignItems: 'center', cursor: 'pointer',
                  background: filaDestino === l.id ? 'var(--surface-2)' : tildado ? 'var(--surface-2)' : undefined,
                  // El destino se marca con un filete, no con un hueco: en una tabla, abrir
                  // un espacio del alto de una fila empuja todo lo de abajo y el ojo pierde
                  // la referencia de donde estaba soltando.
                  boxShadow: filaDestino === l.id ? 'inset 3px 0 0 var(--primary)' : undefined,
                  transition: 'background .12s, box-shadow .12s',
                }}>
                {/* Igual que en la tarjeta: el click de la FILA abre la ficha, asi que la
                    casilla frena la propagacion o tildar abriria el lead. */}
                <input type="checkbox" checked={tildado}
                  onClick={(ev) => { ev.stopPropagation(); alternarSel(l.id); }}
                  onChange={() => { /* lo hace el onClick */ }}
                  title={tildado ? rotQuitar(l.name) : rotPoner(l.name)}
                  aria-label={tildado ? rotQuitar(l.name) : rotPoner(l.name)}
                  style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--primary)' }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.name}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.email}</div>
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--ink)', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.company}</div>
                <div style={{ fontSize: 12.5, color: 'var(--dim)', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.origin}</div>
                <div style={{ minWidth: 0 }}><span style={chipStyle(m.tone)}>{m.label}</span></div>
                <div style={{ fontSize: 13, color: 'var(--dim)' }}>{l.agenda ?? '—'}</div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: isGanado ? 'var(--good)' : 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>{isGanado ? montoDeTarjeta(l).texto : '—'}</div>
                <div style={{ fontSize: 12.5, color: 'var(--faint)', textAlign: 'right', whiteSpace: 'nowrap' }}>{l.created}</div>
                {/* ── LAS ACCIONES DE LA FILA. «Con acciones utiles» (05/10/2026). Son las dos
                    que hoy obligan a abrir la ficha para nada: escribirle, y sacarlo. Las dos
                    frenan la propagacion — un tacho que ademas abre la ficha deja la
                    confirmacion detras de un panel. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end' }}>
                  {/* Solo con telefono: un boton de WhatsApp sin numero no puede ir a ningun
                      lado, y uno apagado en cada fila es ruido por fila. */}
                  {l.telefonoNorm && (
                    <a href={waDe(l.telefonoNorm)} target="_blank" rel="noopener noreferrer"
                      onClick={(ev) => ev.stopPropagation()}
                      title={rotWa(l.name)} aria-label={rotWa(l.name)}
                      className="mk-icon-btn" data-tone="dim"
                      style={{ width: 28, height: 28, textDecoration: 'none' }}>
                      <IconoWhatsapp />
                    </a>
                  )}
                  <button type="button" className="mk-icon-btn" data-tone="dim"
                    onClick={(ev) => { ev.stopPropagation(); setBorrarUno(l); }}
                    title={rotEliminar(l.name)} aria-label={rotEliminar(l.name)}
                    style={{ width: 28, height: 28 }}>
                    <IconoTachoFila />
                  </button>
                </div>
              </div>
            );
          })}
          {/* ⚠️ EL AVISO DE «TODAVÍA NO HAY LEADS» SE FUE, el de FILTROS se queda. Pedido de
              Martín (29/09/2026): «elimina todo el recuadro de Todavía no hay leads para
              mostrar / Importa un CSV o carga tu primer lead para empezar». Con cero leads y
              sin filtros la tabla queda con su cabecera y nada debajo, que es lo pedido.
              El de filtros no es lo mismo: filtrar hasta cero sin que nada lo diga se lee
              como que la app se rompió, y encima es el único que trae la salida. */}
          {filtered.length === 0 && hayFiltros && (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ color: 'var(--dim)', fontSize: 14.5 }}>Sin resultados para estos filtros</div>
              {/* El aviso sin el botón deja al usuario buscando a mano cuál de los filtros
                  fue el que vació la lista. */}
              <button type="button" onClick={limpiarTodo}
                style={{ marginTop: 14, padding: '9px 18px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      )}

      {selected && (
        <LeadEditModal leadId={selected.id} seed={{ nombre: selected.name, empresa: selected.company }} onClose={closeDetail} />
      )}

      {/* Importar / exportar: los MISMOS formularios de a una pregunta que el plan. */}
      {campanasAbierto && (
        <CampanasModal
          // ⚠️ EL PRINCIPAL VA COMO `null`: `funnelActivo` puede traer su id numérico, y con
          // ese número la tabla no reconocería sus propias campañas como «Este».
          funnelId={funnelActivo == null || funnels.find((f) => f.id === funnelActivo)?.esDefault ? null : funnelActivo}
          nombreProducto={nombreDeFunnel(funnelActivo)}
          onCambio={() => { cambiaronCampanas.current = true; }}
          onCerrar={() => {
            setCampanasAbierto(false);
            if (cambiaronCampanas.current) { cambiaronCampanas.current = false; router.refresh(); }
          }} />
      )}
      {importar && <ImportarLeadsModal funnelId={funnelActivo} productos={funnels.map((f) => ({ id: f.id, nombre: f.nombre, esDefault: f.esDefault }))} onClose={() => setImportar(false)} onListo={(resumen) => { setImportar(false); setFlashCsv(resumen); router.refresh(); }} />}
      {exportar && <ExportarLeadsModal onClose={() => setExportar(false)} />}
      {/* ⚠️ LA SEMILLA VA SÓLO SI EL POP-UP ABRE SOBRE EL EMBUDO QUE SE ESTÁ MIRANDO.
          Desde el desplegable se puede editar OTRO producto sin cambiar de tablero, y
          ahí estas etapas son las de un embudo distinto: pintarlas sería mostrar la
          lista equivocada durante medio segundo, que es peor que el giro. */}
      {etapasDe && (
        <EtapasModal funnelId={etapasDe.id} nombre={etapasDe.nombre} abrirEntradas={etapasDe.entradas}
          semilla={etapasDe.id === funnelActivo ? semillaEtapas : null}
          onCerrar={() => setEtapasDe(null)} />
      )}

      {/* Alta a mano SIN salir del tablero: el mismo form de /crm/new adentro de un
          Modal. Al crear se cierra, se abre la ficha del lead nuevo y se recarga la
          lista — el filtro, la búsqueda y el scroll quedan donde estaban.

          El toast va aparte de la ficha a propósito: si la recarga tarda o falla, la
          ficha no se abre (`selected` la busca en `leads`) y sin el aviso el botón
          se leería como que no hizo nada. */}
      {nuevoLead && (
        // ⚠️ DOS VISTAS, DOS TAMAÑOS. El alta es un formulario de seis campos y entra en
        // 720; traer de otro producto es una tabla con seis columnas, su buscador y su
        // filtro, y ahí 720 deja cada fila en dos renglones. Por eso la vista la decide el
        // PADRE y no el form: un formulario no puede cambiar el tamaño de la caja que lo
        // contiene. Y el alto va FIJO, o la caja salta al cambiar de vista.
        <Modal
          titulo={nuevoLead.traer ? 'Traer de otro producto' : 'Nuevo lead'}
          ancho={nuevoLead.traer ? 1040 : 720}
          alto={nuevoLead.traer ? "min(88vh, 720px)" : undefined}
          onCerrar={() => setNuevoLead(null)}
        >
          {nuevoLead.traer ? (
            <TraerDeOtroProducto
              productos={funnels.map((f) => ({ id: f.id, nombre: f.nombre, esDefault: f.esDefault }))}
              destino={funnelActivo}
              onAtras={() => setNuevoLead({ ...nuevoLead, traer: false })}
              onTraidos={(movidos, fallaron) => {
                setNuevoLead(null);
                const falla = fallaron ? ` · ${fallaron} no se pudieron` : '';
                mostrarAviso(`${movidos} ${movidos === 1 ? 'lead traído' : 'leads traídos'}${falla}`);
                router.refresh();
              }}
            />
          ) : (
          <NewLeadForm enModal={{
            funnelId: funnelActivo,
            onTraer: () => setNuevoLead({ ...nuevoLead, traer: true }),
            onCerrar: () => setNuevoLead(null),
            onCreado: (id) => {
              const etapa = nuevoLead.etapa;
              setNuevoLead(null);
              // Desde el placeholder de una columna NO se abre la ficha: el camino de esa
              // columna puede abrir su propio diálogo (el plazo de la nutrición manual, la
              // agenda) y la ficha se lo taparía. Lo hace `altaPendiente`.
              if (etapa) setAltaPendiente({ id, etapa }); else setSelectedId(id);
              mostrarAviso('Lead creado');
              router.refresh();
            },
          }} />
          )}
        </Modal>
      )}
      {/* EL TACHO DE UNA FILA. Misma pregunta que la del lote, en singular y nombrando
          al lead: «No se puede deshacer» es lo unico que convierte un icono chico al
          borde de una fila en una decision. */}
      {borrarUno && (
        <ConfirmDialog
          title={`¿Eliminar «${borrarUno.name}»?`}
          message="Se va con su historial y sus pagos. No se puede deshacer."
          confirmLabel="Eliminar"
          tone="danger"
          onConfirm={() => {
            const id = borrarUno.id;
            const nombre = borrarUno.name;
            setBorrarUno(null);
            void eliminarLeadsAction([id]).then((r) => {
              mostrarAviso(r.borrados ? `Eliminado «${nombre}»` : 'No se pudo eliminar');
              router.refresh();
            });
          }}
          onCancel={() => setBorrarUno(null)} />
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
            // El detalle es lo único del CRM que no se deduce de ningún lado, así que
            // el `sub` dice para qué sirve — no explica la pantalla siguiente, que ya
            // no existe.
            sub: 'El detalle es lo que se lee después en el historial.',
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {motivosDeSalida(qhDestino).map((s) => (
                  <button key={s} type="button" onClick={() => setQhMotivoCat(s)}
                    style={{ padding: '9px 15px', borderRadius: 11, fontSize: 13.5, fontWeight: 700, fontFamily: SANS, cursor: 'pointer', background: qhMotivoCat === s ? 'var(--ink)' : 'var(--surface)', border: '1px solid ' + (qhMotivoCat === s ? 'var(--ink)' : 'var(--border-strong)'), color: qhMotivoCat === s ? 'var(--on-ink)' : 'var(--ink)' }}>
                    {s}
                  </button>
                ))}
              </div>
              {/* El detalle va autoFocus: los chips se tocan con el mouse y escribir es
                  lo que de verdad pide la pantalla. */}
              <textarea value={qhMotivoDet} onChange={(e) => setQhMotivoDet(e.target.value)} autoFocus
                placeholder="Ej: pidió la mitad del precio y no hubo margen; se fue con la agencia de un conocido…"
                style={{ ...wizardInput, minHeight: 96, textAlign: 'left', lineHeight: 1.5 }} />
              </div>
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
        // El motivo de la excepción no frena: ver el comentario de `confirmManualMeeting`.
        const puede = mmPaso === 0 ? !!mmFecha : true;
        // ⚠️ DOS PANTALLAS EN «ya está agendada», TRES en «ya la tuve». La fecha y el
        // motivo se responden juntos: son la misma pregunta partida en dos, y con el
        // motivo ya opcional la segunda pantalla podía quedar entera en blanco. Es el
        // mismo molde que el motivo de la pérdida (StageMoveDialog, 27/09).
        //
        // La asistencia NO se fusiona: en «ya la tuve» son dos hechos distintos —cuándo
        // fue y qué pasó— y el segundo tiene tres salidas.
        const pasos = esPasada ? 3 : 2;
        const ultimo = pasos - 1;
        return (
          <WizardShell
            titulo={`${esPasada ? 'Marcar' : 'Registrar'} ${rLabel} · ${manualMeeting.name}`}
            total={pasos}
            idx={mmPaso}
            pregunta={mmPaso === ultimo
              ? 'Revisa y confirma'
              : mmPaso === 0
                ? (esPasada ? `¿Cuándo fue la ${rLabel}?` : `¿Para cuándo está agendada la ${rLabel}?`)
                : `¿Asistió a la ${rLabel}?`}
            sub={mmPaso === ultimo
              ? 'Esto es lo que va a pasar cuando confirmes.'
              : mmPaso === 0
                ? (esPasada ? 'La reunión ya ocurrió: regístrala a mano (sin Calendly) para avanzar el lead.' : 'La asistencia se marca cuando ocurra.')
                : undefined}
            puedeAvanzar={puede}
            enUltimo={mmPaso === ultimo}
            confirmLabel="Guardar reunión"
            pending={isPending}
            atrasLabel={mmPaso === 0 ? 'Cancelar' : 'Atrás'}
            onClose={() => setManualMeeting(null)}
            onAtras={() => (mmPaso === 0 ? setManualMeeting(null) : setMmPaso(mmPaso - 1))}
            onSiguiente={() => setMmPaso(mmPaso + 1)}
            onConfirmar={confirmManualMeeting}
          >
            {mmPaso === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <input type="date" value={mmFecha} min={esPasada ? undefined : hoy} max={esPasada ? hoy : undefined} onChange={(e) => setMmFecha(e.target.value)} autoFocus style={{ ...wizardInput, maxWidth: 260, margin: '0 auto', display: 'block' }} />
                {/* El motivo viaja con la fecha y es opcional: el que tiene algo que
                    contar lo cuenta acá mismo y queda en el historial del lead. */}
                {!esPasada && (
                  <label style={{ display: 'block', textAlign: 'left' }}>
                    <span style={{ display: 'block', fontSize: 12.5, color: 'var(--dim)', marginBottom: 6 }}>¿Por qué se agendó fuera de Calendly? (opcional)</span>
                    <textarea value={mmNota} onChange={(e) => setMmNota(e.target.value)}
                      placeholder="Queda en el historial del lead."
                      style={{ ...wizardInput, minHeight: 80, textAlign: 'left', lineHeight: 1.5 }} />
                  </label>
                )}
              </div>
            ) : mmPaso === 1 && esPasada ? (
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                {([['si', 'Sí, asistió'], ['no', 'No asistió'], ['', 'No sé']] as const).map(([v, lbl]) => (
                  <button key={lbl} onClick={() => setMmAsistio(v)} style={{ minWidth: 120, padding: '12px 16px', borderRadius: 12, border: `1px solid ${mmAsistio === v ? 'var(--ink)' : 'var(--border-strong)'}`, background: mmAsistio === v ? 'var(--ink)' : 'var(--surface)', color: mmAsistio === v ? 'var(--on-ink)' : 'var(--ink)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>{lbl}</button>
                ))}
              </div>
            ) : (
              <ResumenFilas filas={[
                ['Lead', manualMeeting.name],
                ['Reunión', rLabel],
                ['Fecha', mmFecha || '—'],
                ...(esPasada
                  ? ([['Asistió', mmAsistio === 'si' ? 'Sí' : mmAsistio === 'no' ? 'No' : 'Sin marcar']] as Array<[string, string]>)
                  : ([['Motivo de la excepción', mmNota.trim() || '—']] as Array<[string, string]>)),
                ['Etapa', findStage(stages, manualMeeting.which).label],              ]} />
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
      {/* Eliminar una etapa es irreversible y mueve leads: se pregunta, y la pregunta dice
          la consecuencia pegada al botón. */}
      {borrarEtapa && (
        <ConfirmDialog
          title={`Eliminar la etapa «${borrarEtapa.label}»`}
          message="Los leads que estén ahí pasan a la primera etapa del funnel. La nutrición que salía de esta etapa también se va."
          confirmLabel="Eliminar la etapa"
          loading={isPending}
          onConfirm={() => { void opEtapa({ op: 'eliminar', key: borrarEtapa.key }); }}
          onCancel={() => setBorrarEtapa(null)}
        />
      )}

      {/* El error del server se DICE. La acción puede fallar por rol o porque la lectura
          del funnel se cayó, y sin esto el menú se cierra y no pasa nada visible. */}
      {errorEtapa && (
        <ConfirmDialog
          title="No se pudo cambiar la etapa"
          message={errorEtapa}
          confirmLabel="Entendido"
          onConfirm={() => setErrorEtapa(null)}
          onCancel={() => setErrorEtapa(null)}
        />
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
  // ⚠️ ÁMBAR, NO ROJO — y es la fila «Pendientes pintado del color de los errores»
  // del plan de fricción, que estaba marcada como aplicada sin un solo cambio en el
  // código. El worklist es trabajo POR HACER; el rojo de esta casa es el de «Perdido»
  // y el de los errores. Con el mismo color, la pantalla que más se mira del CRM se
  // lee como una lista de cosas rotas — y un rojo permanente se deja de ver.
  //
  // Es el mismo cambio que ya se le hizo al aviso de la ficha; acá quedó a medias.
  //
  // `--warn` (#B4530E) y no `--warn-fill` (#EE7B1C): el relleno naranja es para barras
  // y chips sin texto encima — con blanco arriba da 2,6:1. El oscuro es el legible, y
  // es para lo que existe (ver el comentario de los tokens en app/globals.css).
  const btn: CSSProperties = { flex: 'none', padding: '9px 18px', borderRadius: 10, border: 'none', background: 'var(--warn)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS };
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
      <div style={{ background: 'var(--surface)', border: '1px solid var(--warn)', borderRadius: 16, padding: 'var(--card-pad)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <h2 style={{ fontWeight: 600, fontSize: 23, letterSpacing: '-0.015em', margin: 0, color: 'var(--ink)' }}>Datos sin marcar</h2>
        <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: 'var(--warn-bg)', border: '1px solid var(--warn)', color: 'var(--warn)' }}>{marcar.length}</span>
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
