'use server';

// =============================================================================
// Server actions de la Vista General — Objectives, KPIs y capacidad
// =============================================================================
// ⚠️ TODAS EMPIEZAN CON EL MISMO GUARD, y no es prolijidad. Una server action es
// la API de esta pantalla: que el Sidebar esconda la tab no impide que alguien
// invoque la action. La regla de la casa lo dice con todas las letras — «un flag
// de visibilidad protege la PANTALLA; la API hay que cerrarla aparte».
//
// `requireRolWs([])` NO significa «solo la agencia»: el admin-cliente de cada
// workspace también pasa, que es exactamente lo que queremos — cada dueño edita
// SUS objetivos. El aislamiento entre clientes lo pone `getTenantDb()` abajo.
// =============================================================================

import { revalidatePath, updateTag } from 'next/cache';
import { setSetting } from '@/lib/settings';
import { TAG } from '@/lib/cache';
import { requireRolWs } from '@/lib/tab-access';
import {
  upsertObjective, cerrarObjective, upsertKpi, apagarKpi, registrarKpi,
  sembrarKpis, proponerKpis, setCapacidad,
} from '@/lib/objectives';
import {
  type Cadencia, type MetricaObjetivo, type UnidadObjetivo, type FuenteKpi,
  type CandidatoKpi, fuenteKpi,
} from '@/lib/objectives-modelo';

const guard = () => requireRolWs([], { nav: 'general' });

/**
 * Invalida la caché de lectura. Va en try/catch: la escritura YA ocurrió, y si la
 * caché fallara vence sola por TTL — nunca puede tumbar un guardado.
 */
function bust() {
  try { updateTag(TAG.settings); } catch { /* vence por TTL */ }
  revalidatePath('/general');
}

// ─────────────────────────────────────────────────────────────────────────────
// Objectives
// ─────────────────────────────────────────────────────────────────────────────

const METRICAS: MetricaObjetivo[] = ['cash_usd', 'sold_usd', 'cierres', 'agendas', 'leads', 'libre'];

/**
 * ⚠️ SANEO EN EL SERVER, NO EN EL FORMULARIO. Lo que llega es lo que mandó el
 * navegador, y un `<select>` deshabilitado no impide nada. Una métrica fuera del
 * conjunto quedaría escrita en la base y la pantalla contestaría «métrica
 * desconocida» para siempre, sin que nadie sepa de dónde salió.
 */
export async function guardarObjectiveAction(input: {
  id?: string;
  anio: number;
  quarter: number | null;
  titulo: string;
  metrica: string;
  metaValor: number;
  avanceManual?: number | null;
}): Promise<void> {
  await guard();
  const metrica = METRICAS.includes(input.metrica as MetricaObjetivo)
    ? (input.metrica as MetricaObjetivo)
    : 'cash_usd';
  const unidad: UnidadObjetivo = metrica === 'cash_usd' || metrica === 'sold_usd' ? 'usd' : 'cantidad';
  const q = input.quarter === null ? null : Math.max(1, Math.min(4, Math.trunc(input.quarter)));
  await upsertObjective({
    id: input.id,
    anio: Math.trunc(input.anio),
    quarter: q,
    titulo: input.titulo,
    metrica,
    metaValor: Math.max(0, Number(input.metaValor) || 0),
    unidad,
    // El avance a mano SOLO tiene sentido en `libre`. En el resto se limpia: si
    // quedara escrito y alguien cambiara la métrica, el número lo pisaría la
    // lectura real sin aviso — o peor, se mostraría el viejo.
    avanceManual: metrica === 'libre' ? (input.avanceManual ?? null) : null,
  });
  bust();
}

export async function cerrarObjectiveAction(id: string): Promise<void> {
  await guard();
  await cerrarObjective(id);
  bust();
}

// ─────────────────────────────────────────────────────────────────────────────
// KPIs
// ─────────────────────────────────────────────────────────────────────────────

export async function guardarKpiAction(input: {
  id?: string;
  objectiveId?: string | null;
  nombre: string;
  cadencia: string;
  compromiso: number;
  unidad: string;
  fuente: string;
  fuenteId?: string | null;
  umbralVerde?: number;
  umbralAmbar?: number;
}): Promise<void> {
  await guard();
  const cadencia: Cadencia = input.cadencia === 'diaria' ? 'diaria' : 'semanal';
  const fuente: FuenteKpi = input.fuente === 'auto' ? 'auto' : 'manual';
  // Una fuente que no está en el catálogo degrada el KPI a MANUAL en vez de
  // guardarse rota. Guardarla dejaría un KPI que contesta «fuente desconocida»
  // para siempre y que la persona no puede arreglar sin entender por qué.
  const def = fuente === 'auto' ? fuenteKpi(input.fuenteId) : undefined;
  const fuenteFinal: FuenteKpi = fuente === 'auto' && def ? 'auto' : 'manual';
  const unidad: UnidadObjetivo = def
    ? def.unidad
    : input.unidad === 'usd' ? 'usd' : 'cantidad';
  // Los umbrales son % del compromiso, y el ámbar NO puede quedar por encima del
  // verde: con verde=70 y ámbar=100 nada sería nunca ámbar y el estado se partiría
  // en dos colores. Se ordenan acá y no en el formulario.
  const verde = Math.max(1, Math.min(200, input.umbralVerde ?? 100));
  const ambar = Math.max(1, Math.min(verde, input.umbralAmbar ?? 70));
  await upsertKpi({
    id: input.id,
    objectiveId: input.objectiveId ?? null,
    nombre: input.nombre,
    cadencia,
    compromiso: Math.max(0, Number(input.compromiso) || 0),
    unidad,
    umbralVerde: verde,
    umbralAmbar: ambar,
    fuente: fuenteFinal,
    fuenteId: fuenteFinal === 'auto' ? (input.fuenteId ?? null) : null,
  });
  bust();
}

export async function apagarKpiAction(id: string): Promise<void> {
  await guard();
  await apagarKpi(id);
  bust();
}

/**
 * Registra el valor de un KPI manual para el período que contiene `fecha`.
 *
 * La `fecha` llega del server (el «hoy» del workspace) y no del navegador: la zona
 * horaria de quien mira no decide a qué semana pertenece el trabajo de un negocio.
 */
export async function registrarKpiAction(kpiId: string, cadencia: string, fecha: string, valor: number): Promise<void> {
  await guard();
  const cad: Cadencia = cadencia === 'diaria' ? 'diaria' : 'semanal';
  await registrarKpi(kpiId, cad, fecha, Math.max(0, Number(valor) || 0));
  bust();
}

// ─────────────────────────────────────────────────────────────────────────────
// El seed
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Siembra los KPIs propuestos que la persona aceptó.
 *
 * ⚠️ EL NAVEGADOR MANDA NOMBRES, NO OBJETOS. Los candidatos se vuelven a resolver
 * ACÁ contra la propuesta real. Si viajaran armados desde el cliente, cualquiera
 * podría sembrar un KPI con la fuente y el compromiso que quisiera — y sobre todo
 * con un `fuenteId` inventado, que es la forma de dejar un KPI roto de nacimiento.
 */
export async function sembrarKpisAction(nombres: string[], objectiveId: string | null): Promise<number> {
  await guard();
  const propuestos = await proponerKpis();
  const pedidos = new Set(nombres);
  const elegidos: CandidatoKpi[] = propuestos.filter((c) => pedidos.has(c.nombre));
  if (elegidos.length === 0) return 0;
  const n = await sembrarKpis(elegidos, objectiveId);
  bust();
  return n;
}

// ─────────────────────────────────────────────────────────────────────────────
// Capacidad instalada
// ─────────────────────────────────────────────────────────────────────────────

export async function setCapacidadAction(cupo: string, mesesEntrega: string): Promise<void> {
  await guard();
  await setCapacidad(cupo.trim(), mesesEntrega.trim());
  bust();
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy
// ─────────────────────────────────────────────────────────────────────────────

const PERMITIDAS = new Set(['objetivo_cierres', 'objetivo_cash_usd', 'objetivo_desde']);

/**
 * @deprecated Las metas ahora son `objectives` (mig 0155).
 *
 * Se deja viva por dos razones concretas: los tres settings siguen siendo el
 * ORIGEN de la migración —`migrarSettingsAObjectives` los lee— y hay avisos y
 * lecturas viejas (`getObjetivoProgreso`) que todavía los miran. Borrar el origen
 * el mismo día que se migra deja sin red al que descubra un error mañana.
 */
export async function setObjetivoAction(key: string, value: string): Promise<void> {
  await guard();
  if (!PERMITIDAS.has(key)) throw new Error(`Setting no permitida: ${key}`);
  await setSetting(key, value.trim());
  bust();
}
