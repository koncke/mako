// =============================================================================
// datos-tipos — lo que el server de /general le pasa a los bloques (sólo TIPOS)
// =============================================================================
// Desde la segunda vuelta del 14/10/2026 los bloques de General se dibujan EN EL NAVEGADOR con sus opciones (cuántas,
// cómo se ve, de qué funnel: lib/general-piezas.ts), así que el server ya no manda bloques dibujados sino sus DATOS
// (./datos.ts los lee; ./bloques/ los dibuja). Elegir una opción en el panel cambia el bloque sin volver al server.
//
// ⚠️ CADA BLOQUE FALLA SOLO: `Leido` separa «no pude leer» (`ok: false`, con la frase) de «no hay» (`ok: true` con la
//    lista vacía). El primero lo dice el bloque; el segundo dibuja el placeholder con su acción.
// ⚠️ Sin `server-only` y sin valores: lo importan el server y el navegador.
// =============================================================================

import type { ObjectiveConAvance, CapacidadLeida } from '@/lib/objectives';
import type { Foco } from '@/lib/focus';
import type { ProgresoQuarter, MetricaObjetivo, UnidadObjetivo } from '@/lib/objectives-modelo';
import type { DesgloseData } from '@/app/_components/Desglose';
import type { EstadoFuentes, EstadoLampara } from '@/lib/vista-general-modelo';
import type { Pendientes, ResumenComparativo } from '@/lib/queries';
import type { BoardTask, Label } from '@/app/plan/board/types';
import type { ItemCalendario } from '@/lib/calendario-modelo';
import type { ConteoFunnel } from '@/lib/general-alcance';
import type { CobroM } from '@/app/m/dashboard/modelo';
import type { KpiVista, CandidatoVista } from './KpisCard';

/** Lo que se leyó, o por qué no. */
export type Leido<T> = { ok: true; d: T } | { ok: false; error: string };

/** Un OKR como lo dibuja General: el objetivo, su avance y dónde «debería ir» a esta altura. */
export type OkrVista = {
  id: string;
  titulo: string;
  metrica: MetricaObjetivo;
  metricaLabel: string;
  unidad: UnidadObjetivo;
  metaValor: number;
  /** null = anual. */
  quarter: number | null;
  avanceManual: number | null;
  /** null = no se pudo leer la métrica (nunca cero por error). */
  actual: number | null;
  /** 0..100 o null. */
  pct: number | null;
  /** true = va por debajo del ritmo. null = no se sabe. */
  atrasado: boolean | null;
  /** Dónde cae la marca del tiempo, 0..1 (`fraccionDelObjetivo`). */
  fraccion: number;
  principal: boolean;
};

/** Una alerta del semáforo, como la dibuja el escritorio (la de cuotas con su desglose). */
export type AlertaVista = { nivel: 'rojo' | 'ambar' | 'verde'; titulo: string; href: string; hrefLabel: string; desglose?: DesgloseData };

/** Una tarea del Plan, liviana (sin el detalle ni el historial: la tarjeta no los dibuja). */
export type TareaVista = BoardTask;

export type DatosGeneral = {
  cabecera: Leido<{
    objetivo: ObjectiveConAvance | null; foco: Foco; capacidad: CapacidadLeida; progreso: ProgresoQuarter; fraccion: number;
    anio: number; quarter: number; desglose: DesgloseData | null;
    complemento: { label: string; valor: string; pie: string; desglose: DesgloseData | null } | null;
  }>;
  okrs: Leido<{ anio: number; quarter: number; lista: OkrVista[] }>;
  kpis: Leido<{ kpis: KpiVista[]; candidatos: CandidatoVista[]; objetivos: Array<{ id: string; titulo: string }>; objetivoPrincipalId: string | null }>;
  semaforo: Leido<{ alertas: AlertaVista[]; fuentes: EstadoFuentes; lampara: EstadoLampara; objetivoAtrasado: boolean }>;
  pendientes: Leido<Pick<Pendientes, 'total' | 'porTipo' | 'aviso'>>;
  /** `comparativo` null = el mes no se pudo comparar (se dice). */
  mes: Leido<{ comparativo: ResumenComparativo | null; desgloses: Record<string, DesgloseData> }>;
  plan: Leido<{
    /** Las de la vista Prioridades del Plan, en su orden (hasta 5). */
    prioridades: TareaVista[];
    /** Las abiertas que compiten, por score (hasta 10): «Tareas prioritarias». */
    top: TareaVista[];
    /** Lo abierto con deadline hasta 30 días, y lo vencido, por fecha: «Próximos deadlines». */
    deadlines: { tareas: TareaVista[]; proyectos: Label[] };
    /** El «hoy» del negocio (YYYY-MM-DD): lo que vence se cuenta desde acá, igual en el server y en el navegador. */
    hoy: string;
    /** El Objetivo Principal del tablero. */
    objetivo: Label | null;
    /** Los proyectos abiertos, por prioridad (los de «Proyectos del Plan»). */
    proyectos: Label[];
    /** Todos los proyectos que nombran las tarjetas (para el chip de cada tarea). */
    etiquetas: Label[];
    /** Las tareas de los proyectos que se dibujan, livianas: el avance de cada tarjeta (`projProgress`). */
    tareasDeProyectos: TareaVista[];
    /** El tablero del dueño (con #N y escritura por /api/plan-board) o el de un cliente. */
    tablero: 'dueno' | 'cliente';
  }>;
  /** Los próximos 14 días del Calendario (lo que dibujan Mi día, las llamadas y las publicaciones). */
  calendario: Leido<{ items: ItemCalendario[]; tz: string; hoy: string; falla: boolean }>;
  /** Los funnels con su conteo de hoy (`conteo` null = ése no se pudo contar). */
  funnels: Leido<Array<{ id: number; nombre: string; principal: boolean; conteo: ConteoFunnel | null }>>;
  /** Las cuotas por cobrar. `deQuien` (de qué funnel es cada cliente) null = no se pudo leer. */
  cobranza: Leido<{ cobros: CobroM[]; tz: string; deQuien: Record<number, number[]> | null }>;
};
