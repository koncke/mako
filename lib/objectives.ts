// =============================================================================
// objectives — Objectives y KPIs contra la base
// =============================================================================
// La aritmética (en qué Q cae una fecha, de qué color va un KPI, qué candidatos
// proponer) vive en `objectives-modelo.ts`, SIN `server-only`, para que se pueda
// testear. Acá está lo que habla con Supabase y lo que resuelve las fuentes.
//
// Dos invariantes que valen para todo el archivo:
//
//  1. EL AVANCE NO SE GUARDA. Ni el de un objetivo ni el de un KPI automático. Se
//     lee de los datos cada vez. Una copia guardada es un segundo productor del
//     mismo número y el segundo se queda viejo.
//  2. UNA LECTURA QUE FALLA NO ES CERO. Se propaga `null` y su motivo hasta la
//     pantalla, que dice «no pude leer». Nunca un cero inventado.
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';
import { getSetting, getSettingNum, setSetting } from './settings';
import { getFunnelDefault } from './funnels';
import { getDiagnosticoFase } from './fase-store';
import { hoyEnWorkspace } from './timezone';
import { leerFuente, inversionUsd, type LecturaFuente } from './objectives-fuentes';
import {
  type Objective, type Kpi, type Quarter, type EstadoKpi, type Cadencia,
  type MetricaObjetivo, type UnidadObjetivo, type FuenteKpi, type CandidatoKpi, type Capacidad,
  quarterDe, quarterKey, rangoQuarter, rangoAnio, progresoQuarter, ritmoObjetivo,
  periodoDe, estadoKpi, pctKpi, PESO_ESTADO, proponerCandidatos, capacidadDe,
  nuevoId, MESES_ENTREGA_DEFAULT, type ProgresoQuarter, type Ritmo,
} from './objectives-modelo';

// ─────────────────────────────────────────────────────────────────────────────
// Filas ↔ modelo
// ─────────────────────────────────────────────────────────────────────────────

type ObjRow = {
  id: string; anio: number; quarter: number | null; titulo: string; metrica: string;
  meta_valor: number | string; unidad: string; avance_manual: number | string | null;
  orden: number; estado: string; origen: string;
};
type KpiRow = {
  id: string; objective_id: string | null; nombre: string; cadencia: string;
  compromiso: number | string; unidad: string; umbral_verde: number | string;
  umbral_ambar: number | string; fuente: string; fuente_id: string | null;
  orden: number; activo: boolean; origen: string;
};

const num = (v: number | string | null | undefined, def = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const aObjective = (r: ObjRow): Objective => ({
  id: r.id, anio: r.anio, quarter: r.quarter,
  titulo: r.titulo, metrica: r.metrica as MetricaObjetivo,
  metaValor: num(r.meta_valor), unidad: r.unidad as UnidadObjetivo,
  avanceManual: r.avance_manual === null ? null : num(r.avance_manual),
  orden: num(r.orden), estado: r.estado === 'cerrado' ? 'cerrado' : 'activo', origen: r.origen,
});

const aKpi = (r: KpiRow): Kpi => ({
  id: r.id, objectiveId: r.objective_id, nombre: r.nombre,
  cadencia: r.cadencia === 'diaria' ? 'diaria' : 'semanal',
  compromiso: num(r.compromiso), unidad: r.unidad as UnidadObjetivo,
  umbralVerde: num(r.umbral_verde, 100), umbralAmbar: num(r.umbral_ambar, 70),
  fuente: r.fuente === 'auto' ? 'auto' : 'manual', fuenteId: r.fuente_id,
  orden: num(r.orden), activo: r.activo !== false, origen: r.origen,
});

const COLS_OBJ = 'id, anio, quarter, titulo, metrica, meta_valor, unidad, avance_manual, orden, estado, origen';
const COLS_KPI = 'id, objective_id, nombre, cadencia, compromiso, unidad, umbral_verde, umbral_ambar, fuente, fuente_id, orden, activo, origen';

// ─────────────────────────────────────────────────────────────────────────────
// El Q en curso
// ─────────────────────────────────────────────────────────────────────────────

/** El Q de hoy, en la zona horaria del workspace (no la del server, que es UTC). */
export async function quarterActual(): Promise<{ qt: Quarter; hoy: string; progreso: ProgresoQuarter }> {
  const hoy = await hoyEnWorkspace();
  const qt = quarterDe(hoy);
  return { qt, hoy, progreso: progresoQuarter(qt, hoy) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Objectives
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Los objetivos de un Q, más los ANUALES de ese año.
 *
 * Los anuales van siempre porque un objetivo de año sigue vigente adentro de cada
 * Q: esconderlo mientras se mira un trimestre haría que la meta de facturación del
 * año desaparezca nueve meses al año.
 */
export async function listObjectives(qt: Quarter): Promise<Objective[]> {
  const db = await getTenantDb();
  const { data, error } = await db
    .from('objectives').select(COLS_OBJ)
    .eq('anio', qt.anio).eq('estado', 'activo')
    .order('orden', { ascending: true });
  if (error) throw new Error(`listObjectives falló: ${error.message}`);
  return ((data ?? []) as ObjRow[])
    .filter((r) => r.quarter === null || r.quarter === qt.q)
    .map(aObjective);
}

export type ObjectiveConAvance = Objective & {
  /** null = no se pudo leer la métrica. NUNCA cero por error. */
  actual: number | null;
  error?: string;
  pct: number | null;
  ritmo: Ritmo | null;
  desde: string;
  hasta: string;
};

/**
 * El avance real de un objetivo, leído de los datos.
 *
 * `metrica='libre'` es el único caso donde el número sale de una columna: no hay
 * de dónde derivarlo, así que lo mueve la persona. Y si nadie lo movió todavía, es
 * `null` —«no lo sé»— y no cero: cero afirmaría que no se avanzó nada.
 */
export async function avanceDeObjetivo(o: Objective, hoy: string): Promise<ObjectiveConAvance> {
  const rango = o.quarter === null ? rangoAnio(o.anio) : rangoQuarter({ anio: o.anio, q: o.quarter });
  const prog = o.quarter === null
    ? { ...progresoQuarter({ anio: o.anio, q: 1 }, hoy), desde: rango.desde, hasta: rango.hasta }
    : progresoQuarter({ anio: o.anio, q: o.quarter }, hoy);
  // Para el anual hay que recalcular los días sobre el año entero, no sobre el Q1.
  const progreso: ProgresoQuarter = o.quarter === null
    ? recalcularProgreso(rango.desde, rango.hasta, hoy, { anio: o.anio, q: 1 })
    : prog;

  let lectura: LecturaFuente;
  if (o.metrica === 'libre') {
    lectura = { valor: o.avanceManual, error: o.avanceManual === null ? 'todavía nadie cargó el avance' : undefined };
  } else if (o.metrica === 'cash_usd') {
    lectura = await leerFuente('cash_usd', rango.desde, rango.hasta);
  } else if (o.metrica === 'sold_usd') {
    lectura = await leerFuente('sold_usd', rango.desde, rango.hasta);
  } else if (o.metrica === 'cierres') {
    lectura = await leerFuente('cierres', rango.desde, rango.hasta);
  } else if (o.metrica === 'agendas') {
    lectura = await leerFuente('agendas', rango.desde, rango.hasta);
  } else if (o.metrica === 'leads') {
    lectura = await leerFuente('leads_nuevos', rango.desde, rango.hasta);
  } else {
    lectura = { valor: null, error: `métrica desconocida: ${o.metrica}` };
  }

  const actual = lectura.valor;
  return {
    ...o,
    actual,
    error: lectura.error,
    pct: actual === null || !(o.metaValor > 0) ? null : Math.min(100, (actual / o.metaValor) * 100),
    ritmo: actual === null ? null : ritmoObjetivo(actual, o.metaValor, progreso, hoy),
    desde: rango.desde,
    hasta: rango.hasta,
  };
}

/** El progreso temporal de un rango arbitrario (para el objetivo anual). */
function recalcularProgreso(desde: string, hasta: string, hoy: string, qt: Quarter): ProgresoQuarter {
  const dia = 86400_000;
  const a = Date.parse(`${desde}T00:00:00Z`);
  const b = Date.parse(`${hasta}T00:00:00Z`);
  const h = Date.parse(`${hoy}T00:00:00Z`);
  const diasTotales = Math.floor((b - a) / dia) + 1;
  const crudo = h < a ? 0 : h > b ? diasTotales : Math.floor((h - a) / dia) + 1;
  const diasTranscurridos = Math.max(0, Math.min(diasTotales, crudo));
  return {
    qt, desde, hasta, diasTotales, diasTranscurridos,
    diasRestantes: Math.max(0, diasTotales - diasTranscurridos),
    fraccion: diasTotales > 0 ? diasTranscurridos / diasTotales : 0,
  };
}

export type ObjectiveInput = {
  id?: string;
  anio: number;
  quarter: number | null;
  titulo: string;
  metrica: MetricaObjetivo;
  metaValor: number;
  unidad: UnidadObjetivo;
  avanceManual?: number | null;
  orden?: number;
  origen?: string;
};

export async function upsertObjective(o: ObjectiveInput): Promise<string> {
  const db = await getTenantDb();
  const id = o.id ?? nuevoId('obj');
  const { error } = await db.from('objectives').upsert({
    id,
    anio: o.anio,
    quarter: o.quarter,
    titulo: o.titulo.trim() || 'Objetivo',
    metrica: o.metrica,
    meta_valor: o.metaValor,
    unidad: o.unidad,
    avance_manual: o.avanceManual ?? null,
    orden: o.orden ?? Date.now(),
    origen: o.origen ?? 'user',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'workspace_id,id' });
  if (error) throw new Error(`upsertObjective falló: ${error.message}`);
  return id;
}

/**
 * Cerrar, no borrar. Un objetivo con KPIs colgando es historia del negocio: lo que
 * se quiere es sacarlo de la vista, no perder de qué se trataba el trimestre
 * pasado. Es la misma regla que el canal `cerrar` del plan.
 */
export async function cerrarObjective(id: string): Promise<void> {
  const db = await getTenantDb();
  const { error } = await db.from('objectives')
    .update({ estado: 'cerrado', updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(`cerrarObjective falló: ${error.message}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// KPIs
// ─────────────────────────────────────────────────────────────────────────────

export async function listKpis(soloActivos = true): Promise<Kpi[]> {
  const db = await getTenantDb();
  let q = db.from('kpis').select(COLS_KPI).order('orden', { ascending: true });
  if (soloActivos) q = q.eq('activo', true);
  const { data, error } = await q;
  if (error) throw new Error(`listKpis falló: ${error.message}`);
  return ((data ?? []) as KpiRow[]).map(aKpi);
}

export type KpiInput = {
  id?: string;
  objectiveId?: string | null;
  nombre: string;
  cadencia: Cadencia;
  compromiso: number;
  unidad: UnidadObjetivo;
  umbralVerde?: number;
  umbralAmbar?: number;
  fuente: FuenteKpi;
  fuenteId?: string | null;
  orden?: number;
  origen?: string;
};

export async function upsertKpi(k: KpiInput): Promise<string> {
  const db = await getTenantDb();
  const id = k.id ?? nuevoId('kpi');
  const { error } = await db.from('kpis').upsert({
    id,
    objective_id: k.objectiveId ?? null,
    nombre: k.nombre.trim() || 'KPI',
    cadencia: k.cadencia,
    compromiso: k.compromiso,
    unidad: k.unidad,
    umbral_verde: k.umbralVerde ?? 100,
    umbral_ambar: k.umbralAmbar ?? 70,
    fuente: k.fuente,
    // Un KPI manual no puede arrastrar una fuente vieja: si alguien lo pasa de
    // auto a manual, el `fuente_id` que quedara escrito volvería a leer solo el
    // día que otro lo mire, y el número de la persona se perdería sin aviso.
    fuente_id: k.fuente === 'auto' ? (k.fuenteId ?? null) : null,
    orden: k.orden ?? Date.now(),
    origen: k.origen ?? 'user',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'workspace_id,id' });
  if (error) throw new Error(`upsertKpi falló: ${error.message}`);
  return id;
}

/** Apagar, no borrar: los registros históricos siguen siendo del negocio. */
export async function apagarKpi(id: string): Promise<void> {
  const db = await getTenantDb();
  const { error } = await db.from('kpis')
    .update({ activo: false, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(`apagarKpi falló: ${error.message}`);
}

/**
 * Registra el valor de un KPI MANUAL para el período que contiene `fecha`.
 *
 * La clave es el INICIO del período, no el día del click: con eso el upsert es
 * idempotente y marcar dos veces la misma semana pisa la fila en vez de duplicarla
 * —que es exactamente lo que pasa con la pantalla abierta en dos pestañas.
 */
export async function registrarKpi(kpiId: string, cadencia: Cadencia, fecha: string, valor: number, nota?: string): Promise<void> {
  const db = await getTenantDb();
  const { clave } = periodoDe(cadencia, fecha);
  const { error } = await db.from('kpi_registros').upsert({
    kpi_id: kpiId,
    fecha: clave,
    valor,
    origen: 'manual',
    nota: nota ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'workspace_id,kpi_id,fecha' });
  if (error) throw new Error(`registrarKpi falló: ${error.message}`);
}

export type KpiEnTablero = Kpi & {
  /** null = no se pudo leer. NUNCA cero por error. */
  valor: number | null;
  error?: string;
  estado: EstadoKpi;
  pct: number | null;
  periodoDesde: string;
  periodoHasta: string;
  periodoClave: string;
};

/**
 * El tablero: cada KPI con su valor del período vigente y su color.
 *
 * Los automáticos se leen de los datos; los manuales, de `kpi_registros`. Un
 * manual sin registro en este período NO vale cero: vale `null`. La diferencia
 * importa porque cero dice «lo intentaste y no hiciste nada» y null dice «todavía
 * no lo cargaste», y sólo la segunda es cierta un lunes a la mañana.
 */
export async function getTableroKpis(hoy: string): Promise<KpiEnTablero[]> {
  const kpis = await listKpis(true);
  if (kpis.length === 0) return [];

  const db = await getTenantDb();
  const claves = [...new Set(kpis.map((k) => periodoDe(k.cadencia, hoy).clave))];
  const registros = new Map<string, number>();
  let errorRegistros: string | undefined;
  try {
    const { data, error } = await db
      .from('kpi_registros').select('kpi_id, fecha, valor').in('fecha', claves);
    if (error) errorRegistros = error.message;
    for (const r of (data ?? []) as Array<{ kpi_id: string; fecha: string; valor: number | string }>) {
      registros.set(`${r.kpi_id}|${r.fecha}`, num(r.valor));
    }
  } catch (e) {
    errorRegistros = e instanceof Error ? e.message : String(e);
  }

  const filas = await Promise.all(kpis.map(async (k): Promise<KpiEnTablero> => {
    const p = periodoDe(k.cadencia, hoy);
    let valor: number | null;
    let error: string | undefined;
    if (k.fuente === 'auto') {
      const l = await leerFuente(k.fuenteId, p.desde, p.hasta);
      valor = l.valor;
      error = l.error;
    } else if (errorRegistros) {
      // ⚠️ Si la tabla de registros no se pudo leer, TODOS los manuales quedan
      // «sin datos» — no en cero. Un fallo de la base no es la persona sin hacer
      // su trabajo, y pintar diez KPIs de rojo por un timeout es la forma más
      // rápida de que alguien deje de mirar esta pantalla.
      valor = null;
      error = errorRegistros;
    } else {
      const v = registros.get(`${k.id}|${p.clave}`);
      valor = v === undefined ? null : v;
      if (valor === null) error = 'todavía no lo cargaste';
    }
    return {
      ...k,
      valor, error,
      estado: estadoKpi(valor, k.compromiso, k.umbralVerde, k.umbralAmbar),
      pct: pctKpi(valor, k.compromiso),
      periodoDesde: p.desde, periodoHasta: p.hasta, periodoClave: p.clave,
    };
  }));

  // Primero lo que está peor: es un tablero para actuar, no un inventario.
  return filas.sort((a, b) => (PESO_ESTADO[a.estado] - PESO_ESTADO[b.estado]) || (a.orden - b.orden));
}

// ─────────────────────────────────────────────────────────────────────────────
// El seed
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Qué KPIs propone MaKo para este negocio, leyendo lo que ya está cargado: las
 * etapas reales del funnel y el cuello de su fase.
 *
 * Nunca devuelve vacío: sin funnel ni fase declarados, cae al set genérico. Una
 * pantalla en blanco es donde muere toda feature de objetivos, y «no sé nada de
 * este negocio» no es razón para no proponer nada — es razón para proponer lo común.
 */
export async function proponerKpis(): Promise<CandidatoKpi[]> {
  let etapas: string[] | null = null;
  let cuello: string | null = null;
  try {
    const funnel = await getFunnelDefault();
    // ⚠️ `origen !== 'declarado'` significa que el pipeline que se está viendo es
    // el DEFAULT del código, no el del cliente. Filtrar candidatos con eso sería
    // decidir por un negocio que nunca declaró nada.
    if (funnel.origen === 'declarado') etapas = funnel.pipeline.map((s) => s.key);
  } catch { /* sin funnel se propone el set genérico */ }
  try {
    // El cuello sale del diagnóstico de fase, que ya está cargado desde el
    // onboarding. No se re-pregunta nada: es el mismo dato que ya alimenta al
    // Perro Guardián y a la Retro.
    cuello = (await getDiagnosticoFase())?.cuello ?? null;
  } catch { /* sin fase, el orden es el del catálogo */ }
  return proponerCandidatos(etapas, cuello);
}

/** Crea los KPIs propuestos que la persona aceptó. Devuelve cuántos entraron. */
export async function sembrarKpis(candidatos: CandidatoKpi[], objectiveId: string | null): Promise<number> {
  let n = 0;
  for (const [i, c] of candidatos.entries()) {
    await upsertKpi({
      objectiveId,
      nombre: c.nombre,
      cadencia: c.cadencia,
      compromiso: c.compromiso,
      unidad: c.unidad,
      fuente: c.fuente,
      fuenteId: c.fuenteId ?? null,
      orden: i,
      origen: 'seed',
    });
    n++;
  }
  return n;
}

// ─────────────────────────────────────────────────────────────────────────────
// Capacidad instalada
// ─────────────────────────────────────────────────────────────────────────────

export const KEY_CUPO = 'capacidad_cupo';
export const KEY_MESES_ENTREGA = 'capacidad_meses_entrega';

/** yyyy-mm-dd + n meses, conservando el día lo mejor posible. */
function masMeses(iso: string, meses: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
  const dd = String(Math.min(d, ultimo)).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${dd}`;
}

/**
 * Cuántos clientes están ocupando un lugar hoy.
 *
 * ⚠️ SÓLO EL CUPO SE PREGUNTA. Los activos salen del CRM, que ya los sabe: pedirle
 * a alguien un número que el sistema puede contar es la config que este producto no
 * quiere. Y «activo» no es «cerró alguna vez»:
 *
 *   · suscripción con plazo → mientras el plazo no venció (la misma regla que ya
 *     usa `getMrrActivo`, para que dos pantallas no cuenten distinto)
 *   · suscripción indefinida → activo
 *   · pago único → activo mientras esté dentro de la ventana de entrega
 *     (`capacidad_meses_entrega`, default 4 = la duración típica del programa)
 *
 * La ventana existe porque un pago único no tiene fecha de fin, y sin ella un
 * cliente de hace dos años seguiría ocupando un lugar para siempre.
 */
export async function clientesActivos(hoy: string): Promise<{ valor: number | null; error?: string }> {
  try {
    const db = await getTenantDb();
    const { data, error } = await db
      .from('leads')
      .select('venta_tipo, suscripcion_meses, fecha_cierre')
      .eq('estado_lead', 'ganado');
    if (error) return { valor: null, error: error.message };
    const meses = (await getSettingNum(KEY_MESES_ENTREGA)) ?? MESES_ENTREGA_DEFAULT;
    let n = 0;
    for (const r of (data ?? []) as Array<{ venta_tipo: string | null; suscripcion_meses: number | null; fecha_cierre: string | null }>) {
      if (r.venta_tipo === 'suscripcion') {
        const activa = r.suscripcion_meses && r.suscripcion_meses > 0 && r.fecha_cierre
          ? masMeses(r.fecha_cierre, r.suscripcion_meses) >= hoy
          : true;
        if (activa) n++;
      } else {
        // Sin fecha de cierre no se puede decir que venció: cuenta como activo.
        if (!r.fecha_cierre || masMeses(r.fecha_cierre, meses) >= hoy) n++;
      }
    }
    return { valor: n };
  } catch (e) {
    return { valor: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export type CapacidadLeida = Capacidad & { error?: string; mesesEntrega: number };

export async function getCapacidad(hoy: string): Promise<CapacidadLeida> {
  const [cupo, act, meses] = await Promise.all([
    getSettingNum(KEY_CUPO),
    clientesActivos(hoy),
    getSettingNum(KEY_MESES_ENTREGA),
  ]);
  // Si no se pudo contar, no se afirma nada: `activos` en 0 con un cupo cargado
  // diría «tenés todo el lugar libre», que es la peor conclusión posible para una
  // pantalla desde la que se decide si vender más.
  if (act.valor === null) {
    return { cupo, activos: 0, libres: null, ocupacionPct: null, error: act.error, mesesEntrega: meses ?? MESES_ENTREGA_DEFAULT };
  }
  return { ...capacidadDe(cupo, act.valor), mesesEntrega: meses ?? MESES_ENTREGA_DEFAULT };
}

export async function setCapacidad(cupo: string, mesesEntrega?: string): Promise<void> {
  await setSetting(KEY_CUPO, cupo);
  if (mesesEntrega !== undefined) await setSetting(KEY_MESES_ENTREGA, mesesEntrega);
}

// ─────────────────────────────────────────────────────────────────────────────
// La migración de los tres settings viejos
// ─────────────────────────────────────────────────────────────────────────────

export const KEY_MIGRADO = 'objectives.migrado_de_settings';

/**
 * Convierte `objetivo_cash_usd` / `objetivo_cierres` / `objetivo_desde` en los
 * primeros objetivos del Q que contiene `objetivo_desde`.
 *
 * ⚠️ DEJA SU PROPIA MARCA Y SALE TEMPRANO. No deduce «ya corrí» de que existan
 * objetivos, porque eso es indistinguible de «alguien los creó a mano» — y una
 * migración que decide si le toca mirando un estado que otro puede cambiar es un
 * bucle. Pasó exactamente eso con el onboarding de las tabs (03/09/2026).
 *
 * ⚠️ Y NO BORRA LOS SETTINGS. Siguen ahí, sin que nadie los lea, hasta que la
 * migración esté probada en todos los workspaces. Borrar el origen el mismo día
 * que se migra deja sin red al que descubra un error mañana.
 */
export async function migrarSettingsAObjectives(): Promise<{ creados: number; yaEstaba: boolean }> {
  if (await getSetting(KEY_MIGRADO)) return { creados: 0, yaEstaba: true };

  const [cash, cierres, desde] = await Promise.all([
    getSettingNum('objetivo_cash_usd'),
    getSettingNum('objetivo_cierres'),
    getSetting('objetivo_desde'),
  ]);
  const hoy = await hoyEnWorkspace();
  const ancla = desde && /^\d{4}-\d{2}-\d{2}$/.test(desde) ? desde : hoy;
  const qt = quarterDe(ancla);

  let creados = 0;
  if (cash !== null && cash > 0) {
    await upsertObjective({
      anio: qt.anio, quarter: qt.q, titulo: 'Facturación del trimestre',
      metrica: 'cash_usd', metaValor: cash, unidad: 'usd', orden: 0, origen: 'migracion',
    });
    creados++;
  }
  if (cierres !== null && cierres > 0) {
    await upsertObjective({
      anio: qt.anio, quarter: qt.q, titulo: 'Cierres del trimestre',
      metrica: 'cierres', metaValor: cierres, unidad: 'cantidad', orden: 1, origen: 'migracion',
    });
    creados++;
  }
  await setSetting(KEY_MIGRADO, new Date().toISOString());
  return { creados, yaEstaba: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// El objetivo, para los que razonan
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El Q, sus objetivos y la capacidad, en el texto que lee un modelo.
 *
 * ⚠️ ES UNA FUNCIÓN Y NO UN BLOQUE COPIADO EN CADA PROMPT. La misma frase la
 * necesitan el Perro Guardián al puntuar tareas, el Perro al ordenar proyectos y
 * el system prompt de MaKo. Escrita tres veces, la tercera se queda vieja — que es
 * exactamente lo que ya pasó en este repo con el contrato del `detalle`.
 *
 * Es el gemelo de `faseNegocioTexto()`: aquélla dice en qué FASE está el negocio,
 * ésta dice a qué se comprometió ESTE trimestre. La fase cambia cada varios meses;
 * el objetivo, cada 90 días.
 *
 * ⚠️ Y NO AFIRMA LO QUE NO PUDO LEER. Un objetivo cuya métrica falló entra como
 * «no pude leerlo», nunca con un cero — un modelo que lee «llevas 0 de 20.000» va
 * a redactar una urgencia que nadie midió, y va a sonar igual de convincente.
 *
 * Devuelve '' cuando no hay nada cargado: un bloque vacío en un prompt es ruido, y
 * decir «este negocio no tiene objetivos» invita al modelo a inventarlos.
 */
export async function objetivosContextoTexto(): Promise<string> {
  try {
    const { qt, hoy, progreso } = await quarterActual();
    const base = await listObjectives(qt);
    const cap = await getCapacidad(hoy).catch(() => null);

    const lineas: string[] = [];
    if (base.length > 0) {
      const conAvance = await Promise.all(base.map((o) => avanceDeObjetivo(o, hoy)));
      for (const o of conAvance) {
        const u = o.unidad === 'usd' ? 'USD ' : '';
        if (o.actual === null) {
          lineas.push(`- ${o.titulo}: meta ${u}${o.metaValor}. No pude leer el avance (${o.error ?? 'sin motivo'}), así que no sé si va bien.`);
          continue;
        }
        const ritmo = o.ritmo
          ? o.ritmo.alDia
            ? 'al día'
            : `atrasado (a esta altura debería ir por ${u}${Math.round(o.ritmo.esperado)})`
          : 'sin ritmo todavía';
        lineas.push(`- ${o.titulo}: ${u}${Math.round(o.actual)} de ${u}${o.metaValor} — ${ritmo}.`);
      }
    }

    const kpis = await getTableroKpis(hoy).catch(() => []);
    const enRojo = kpis.filter((k) => k.estado === 'rojo');
    const kpiTxt = kpis.length === 0
      ? ''
      : enRojo.length === 0
        ? `Sus ${kpis.length} KPIs del período están en verde o ámbar.`
        : `KPIs ATRASADOS ahora mismo: ${enRojo.map((k) => `${k.nombre} (${k.valor ?? '—'} de ${k.compromiso})`).join(', ')}.`;

    // ⚠️ La capacidad se nombra SÓLO si está declarada. Sin cupo cargado no se dice
    // «no tiene capacidad definida»: se calla. Un modelo que lee eso lo trata como
    // un problema del negocio y arranca a recomendar que lo defina, cuando la
    // pregunta era otra.
    const capTxt = cap && cap.cupo !== null && !cap.error
      ? cap.libres === 0
        ? `CAPACIDAD LLENA: ${cap.activos} clientes activos sobre un cupo de ${cap.cupo}. NO puede tomar más clientes sin resolver antes la entrega.`
        : `Capacidad: ${cap.activos} clientes activos de ${cap.cupo}; le queda lugar para ${cap.libres}.`
      : '';

    const cuerpo = [
      lineas.length > 0 ? `Objetivos del Q${qt.q} ${qt.anio} (quedan ${progreso.diasRestantes} días):\n${lineas.join('\n')}` : '',
      kpiTxt,
      capTxt,
    ].filter(Boolean).join('\n\n');

    return cuerpo;
  } catch {
    return '';
  }
}

export { quarterKey, rangoQuarter, inversionUsd };
