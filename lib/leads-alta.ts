// =============================================================================
// leads-alta — CUÁNDO nació un lead para el negocio, y cómo se cuentan los NUEVOS de un período (18/11/2026)
// =============================================================================
// F152 (docs/pendientes-verificados-17-11.md). Un lead MIGRADO de otro CRM (`migrar_contactos`, la promesa a la agencia
// de Thiago: docs/relevo/nube-thiago-migrar.md) guarda en `fecha_original` (mig 0405) cuándo se creó allá; `created_at`
// sigue siendo cuándo entró a MaKo, a propósito (lo comparan reglas contra filas que nacen en el acto). Hasta hoy TODO
// lector de «leads nuevos del período» contaba `created_at`, así que migrar 5.000 contactos era «5.000 leads nuevos hoy»
// en el embudo de /general, en el KPI «Leads nuevos» de los objetivos, en el Dashboard y en las métricas que lee MaKo.
//
// LA REGLA: el día de alta es `coalesce(fecha_original, created_at)`. PostgREST no hace un `coalesce` en un filtro, así
// que «el alta cae en [desde, hasta]» se parte en DOS conjuntos que no se pisan:
//   · `fecha_original` es NULL y `created_at` cae en el rango (todo lead que no vino de una migración), y
//   · `fecha_original` cae en el rango (el migrado, por su fecha de allá, entre cuando entre a MaKo).
// Un conteo es la suma de los dos conteos; una lectura de filas, la unión de las dos (disjuntas por construcción).
//
// ⚠️ LA COLUMNA PUEDE NO ESTAR. La 0405 se aplica a mano (el relevo de Thiago la deja «antes del deploy, o junto») y un
// `select` o un filtro con una columna que no existe rechaza la consulta ENTERA (AGENTS.md). Por eso se pregunta UNA vez
// por proceso si la columna está (`hayFechaOriginal`): sin ella, todo cuenta por `created_at`, como siempre. La sonda va
// por GET y no por un `count` con `head: true`: un HEAD que falla vuelve sin cuerpo y no dice qué falló (postgrest-js
// arma `{ message: '' }`), así que no distingue «falta la columna» de cualquier otra cosa.
//
// Sin `server-only` a propósito: recibe el cliente YA scopeado (`getTenantDb()`) y los tests lo ejecutan con uno falso.
// Lo usan lib/queries.ts (el embudo y sus semanas), lib/objectives-fuentes.ts (el KPI «Leads nuevos»),
// lib/metricas-negocio.ts (las métricas por día) y lib/graficos-datos.ts (el conjunto «Leads» por alta del Dashboard).
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { leerTodo, type ConsultaPaginada, type OpcionesPaginado } from './supabase-paginado';

/** Lo mínimo de una fila de `leads` para saber cuándo nació. `fecha_original` falta si la 0405 no está aplicada. */
export type FilaConAlta = { created_at?: string | null; fecha_original?: string | null };

/**
 * El instante en que el lead nació PARA EL NEGOCIO: la fecha del CRM anterior si se migró (y es legible), si no cuando
 * entró a MaKo. null = no se sabe (ninguna de las dos).
 */
export function momentoDeAlta(r: FilaConAlta): string | null {
  const fo = typeof r.fecha_original === 'string' ? r.fecha_original.trim() : '';
  if (fo && Number.isFinite(Date.parse(fo))) return fo;
  const ca = typeof r.created_at === 'string' ? r.created_at.trim() : '';
  return ca || null;
}

/** El día de alta en UTC (YYYY-MM-DD): lo que cortaban los lectores con `created_at.slice(0, 10)`. */
export function diaDeAltaUtc(r: FilaConAlta): string | null {
  const m = momentoDeAlta(r);
  return m ? m.slice(0, 10) : null;
}

/**
 * ¿El alta cae en el período? `desde` y `hasta` son instantes ISO (como los que ya se le pasaban a `created_at`), con
 * `hasta` incluido. Es la regla en memoria que tienen que respetar las dos consultas de abajo.
 */
export function altaEnRango(r: FilaConAlta, desde: string, hasta: string): boolean {
  const m = momentoDeAlta(r);
  if (!m) return false;
  const t = Date.parse(m);
  return Number.isFinite(t) && t >= Date.parse(desde) && t <= Date.parse(hasta);
}

/** ¿El error de PostgREST es «esa columna no existe»? (la 0405 sin aplicar). */
export function faltaFechaOriginal(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const x = e as { code?: unknown; message?: unknown };
  const code = typeof x.code === 'string' ? x.code : '';
  const msg = typeof x.message === 'string' ? x.message : '';
  if (code === '42703' || code === 'PGRST204') return /fecha_original/.test(msg) || code === '42703';
  return /fecha_original/.test(msg) && /(does not exist|could not find|no existe)/i.test(msg);
}

// ── La sonda: ¿está la columna? ──────────────────────────────────────────────

type Sondeo = { ok: boolean; at: number };
/** De TODOS los inquilinos del proceso, y está bien: es una pregunta sobre el esquema, no sobre los datos de nadie. */
let sondeo: Sondeo | null = null;
/** Sin la columna, cuánto se espera para volver a preguntar (la migración se puede aplicar con el server andando). */
export const REPREGUNTAR_SIN_COLUMNA_MS = 10 * 60_000;

/** Sólo para los tests: olvidar lo que se averiguó. */
export function olvidarSondeoFechaOriginal(): void { sondeo = null; }

/**
 * ¿`leads.fecha_original` existe? Una vez que sí, para siempre (una columna no se va sola); sin ella, se vuelve a
 * preguntar a los `REPREGUNTAR_SIN_COLUMNA_MS`. Si la sonda falla por OTRA cosa (la base caída) contesta `false` sin
 * guardar nada: la lectura de siempre (`created_at`) es la que va a fallar o andar igual que antes de este cambio.
 */
export async function hayFechaOriginal(db: SupabaseClient, ahora: number = Date.now()): Promise<boolean> {
  if (sondeo?.ok) return true;
  if (sondeo && ahora - sondeo.at < REPREGUNTAR_SIN_COLUMNA_MS) return false;
  try {
    const { error } = await db.from('leads').select('fecha_original').limit(1);
    if (!error) { sondeo = { ok: true, at: ahora }; return true; }
    if (faltaFechaOriginal(error)) sondeo = { ok: false, at: ahora };
    return false;
  } catch {
    return false;
  }
}

// ── Las consultas ────────────────────────────────────────────────────────────

type Extra = (q: ConsultaPaginada) => ConsultaPaginada;
const nada: Extra = (q) => q;

/**
 * Cuántos leads NACIERON en el período (`desde`/`hasta`: instantes ISO, `hasta` incluido), con el filtro `extra` encima
 * (`.eq('estado_lead', 'ganado')`). Un COUNT sin traer filas. Tira si la base no contesta: «no pude contar» no es cero.
 */
export async function contarAltas(db: SupabaseClient, desde: string, hasta: string, extra: Extra = nada): Promise<number> {
  const contar = async (filtros: Extra, que: string): Promise<number> => {
    const q = filtros(extra(db.from('leads').select('id', { count: 'exact', head: true }) as ConsultaPaginada));
    const { count, error } = await q;
    if (error) throw new Error(`contar las altas (${que}) falló: ${error.message || 'sin detalle'}`);
    if (typeof count !== 'number') throw new Error(`contar las altas (${que}): la base no devolvió el conteo`);
    return count;
  };
  if (!(await hayFechaOriginal(db))) {
    return contar((q) => q.gte('created_at', desde).lte('created_at', hasta) as ConsultaPaginada, 'por created_at');
  }
  const [nativas, migradas] = await Promise.all([
    contar((q) => q.is('fecha_original', null).gte('created_at', desde).lte('created_at', hasta) as ConsultaPaginada, 'sin fecha original'),
    contar((q) => q.gte('fecha_original', desde).lte('fecha_original', hasta) as ConsultaPaginada, 'migradas'),
  ]);
  return nativas + migradas;
}

/**
 * Las FILAS de los leads que nacieron en el período, paginadas (`leerTodo`, con su orden). `cols` tiene que traer
 * `created_at`; `fecha_original` se le suma sola cuando la columna existe, para que quien llama corte el día con
 * `diaDeAltaUtc`. Tira si la base no contesta.
 */
export async function leerAltas<T extends FilaConAlta>(
  db: SupabaseClient, cols: string, desde: string, hasta: string,
  opts: Omit<OpcionesPaginado, 'filtros'> & { extra?: Extra } = {},
): Promise<T[]> {
  const { extra = nada, ...resto } = opts;
  if (!(await hayFechaOriginal(db))) {
    return leerTodo<T>(db, 'leads', cols, { ...resto, filtros: (q) => extra(q).gte('created_at', desde).lte('created_at', hasta) as ConsultaPaginada });
  }
  const conOriginal = /\bfecha_original\b/.test(cols) ? cols : `${cols}, fecha_original`;
  const [nativas, migradas] = await Promise.all([
    leerTodo<T>(db, 'leads', conOriginal, { ...resto, filtros: (q) => extra(q).is('fecha_original', null).gte('created_at', desde).lte('created_at', hasta) as ConsultaPaginada }),
    leerTodo<T>(db, 'leads', conOriginal, { ...resto, filtros: (q) => extra(q).gte('fecha_original', desde).lte('fecha_original', hasta) as ConsultaPaginada }),
  ]);
  return [...nativas, ...migradas];
}

/**
 * Las columnas de una lectura de leads que NO filtra por el alta (las métricas por día leen la tabla entera): con la
 * columna, `fecha_original` va adentro; sin ella, no se nombra (rechazaría la consulta entera).
 */
export async function colsConFechaOriginal(db: SupabaseClient, cols: string): Promise<string> {
  if (/\bfecha_original\b/.test(cols)) return cols;
  return (await hayFechaOriginal(db)) ? `${cols}, fecha_original` : cols;
}
