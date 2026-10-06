// =============================================================================
// objectives-fuentes — de dónde sale el número de un KPI automático
// =============================================================================
// UNA REGLA GOBIERNA TODO ESTE ARCHIVO:
//
//   Si la lectura falla, el valor es `null` — NUNCA cero.
//
// Es la distinción que `lib/sources.ts` ya hace para /marketing («la fuente no
// está» ≠ «la fuente dice cero») aplicada al tablero de KPIs, y acá pesa más que
// allá: un cero inventado por un timeout de Meta pinta el KPI de inversión en
// ROJO, y el rojo de un KPI es lo que elige LA acción prioritaria de la pantalla
// de entrada. O sea que un error de red se convierte en una orden de trabajo
// falsa, arriba de todo, con cara de dato.
//
// Por eso ninguna función de acá hace `?? 0` sobre un error, y ninguna colapsa el
// fallo en el camino feliz. El `catch` devuelve null con su motivo.
//
// ⚠️ EL VALOR DE UN KPI AUTOMÁTICO NO SE GUARDA. Se calcula al leer, contra los
// datos que ya están en la base. Una copia guardada sería un segundo productor
// del mismo número, y el segundo se queda viejo — el antipatrón que este repo ya
// pagó con el score de proyectos.
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';
import { leerPorPaginas } from './supabase-paginado';
import { mxnAUsd } from './config';
import type { FuenteDef, FuenteId } from './objectives-modelo';
import { FUENTES_KPI } from './objectives-modelo';

/** Lo que devuelve toda fuente. `valor: null` = no se pudo leer, con el motivo al lado. */
export type LecturaFuente = { valor: number | null; error?: string };

const fallo = (e: unknown): LecturaFuente => ({ valor: null, error: e instanceof Error ? e.message : String(e) });

// `hasta` es un DÍA, y las columnas de timestamp guardan la hora. Comparar contra
// el día pelado se come el último día entero del período — un bug que se lee como
// «hoy no cuenta» y que nadie reporta, porque mañana ya está bien.
const finDeDia = (hasta: string) => `${hasta}T23:59:59.999Z`;

/**
 * Cuántas filas hay, sin traer ni un byte de datos.
 *
 * ⚠️ `count` puede venir `null` sin que haya error. Eso NO es cero: es no saber.
 */
type Filtro = { col: string; op: 'eq' | 'gte' | 'lte' | 'noNull'; val?: string | boolean };

async function contar(tabla: string, filtros: Filtro[]): Promise<LecturaFuente> {
  try {
    const db = await getTenantDb();
    let q = db.from(tabla).select('*', { count: 'exact', head: true });
    for (const f of filtros) {
      if (f.op === 'noNull') q = q.not(f.col, 'is', null);
      else if (f.op === 'eq') q = q.eq(f.col, f.val);
      else if (f.op === 'gte') q = q.gte(f.col, f.val as string);
      else q = q.lte(f.col, f.val as string);
    }
    const { count, error } = await q;
    if (error) return { valor: null, error: error.message };
    if (typeof count !== 'number') return { valor: null, error: 'la base no devolvió el conteo' };
    return { valor: count };
  } catch (e) {
    return fallo(e);
  }
}

/**
 * El gasto de Meta del período, en USD.
 *
 * ⚠️ PAGINA, Y ESO NO ES PROLIJIDAD. `marketing_metrics_daily` tiene una fila por
 * ANUNCIO por DÍA, así que un trimestre con cien anuncios corriendo pasa las 1000
 * filas del tope de PostgREST — que no da error: devuelve mil filas y se calla. La
 * suma sale más chica, en silencio y siempre para el mismo lado. Este repo ya pagó
 * ese bug ocho veces en `queries.ts`.
 *
 * Y si ni paginando alcanza, devuelve null con el motivo: decir «no pude» es mejor
 * que devolver una suma que sabemos incompleta.
 */
export async function inversionUsd(desde: string, hasta: string): Promise<LecturaFuente> {
  try {
    const db = await getTenantDb();
    let mxn = 0;
    // ⚠️ El bucle `.range()` escrito a mano que había acá paginaba SIN `.order()`.
    // Sin ORDER BY, el OFFSET de la página 2 se aplica sobre otro orden y salen
    // filas repetidas y filas salteadas — y como esto es una SUMA, el error va
    // para cualquier lado: podía dar una inversión MAYOR a la real. Con 1714
    // filas meta en ws1 ya entraba a la página 2. `leerPorPaginas` ordena por
    // `id` (única) y agrega al vuelo sin juntar las filas.
    //
    // El techo de 50 páginas (50.000 días-anuncio) sigue siendo un cinturón: si
    // se pasa, `leerPorPaginas` LANZA y acá se devuelve null con el motivo, que
    // es mejor que una suma que sabemos incompleta.
    await leerPorPaginas<{ spend: number | null }>(
      db, 'marketing_metrics_daily', 'id, spend',
      (filas) => { for (const f of filas) mxn += Number(f.spend ?? 0); },
      {
        eq: { plataforma: 'meta' },
        filtros: (q) => q.gte('fecha', desde).lte('fecha', hasta),
        maxPaginas: 50,
      },
    );
    return { valor: mxnAUsd(mxn) };
  } catch (e) {
    return fallo(e);
  }
}

/** Lo cobrado en el período. `pagos` tiene una fila por cuota: no llega al tope. */
async function cashUsd(desde: string, hasta: string): Promise<LecturaFuente> {
  try {
    const db = await getTenantDb();
    const { data, error } = await db
      .from('pagos')
      .select('monto_usd')
      .eq('pagado', true)
      .gte('fecha_pago', desde)
      .lte('fecha_pago', hasta);
    if (error) return { valor: null, error: error.message };
    const total = (data ?? []).reduce((s, r) => s + Number((r as { monto_usd: number | null }).monto_usd ?? 0), 0);
    return { valor: total };
  } catch (e) {
    return fallo(e);
  }
}

/** Lo firmado en el período (Sold Revenue): la suma de los cierres. */
async function soldUsd(desde: string, hasta: string): Promise<LecturaFuente> {
  try {
    const db = await getTenantDb();
    const { data, error } = await db
      .from('leads')
      .select('monto_cierre_usd')
      .eq('cerro', true)
      .gte('fecha_cierre', desde)
      .lte('fecha_cierre', hasta);
    if (error) return { valor: null, error: error.message };
    const total = (data ?? []).reduce((s, r) => s + Number((r as { monto_cierre_usd: number | null }).monto_cierre_usd ?? 0), 0);
    return { valor: total };
  } catch (e) {
    return fallo(e);
  }
}

type Lector = (desde: string, hasta: string) => Promise<LecturaFuente>;

// ⚠️ `Record<FuenteId, Lector>` ES EL GUARD, no una anotacion. `FuenteId` se deriva
// del catalogo de `objectives-modelo.ts`, asi que el compilador exige la paridad en
// LAS DOS DIRECCIONES: una fuente del catalogo sin lector no compila, y un lector
// que nadie puede elegir tampoco. Es el reemplazo del test que no se puede escribir
// —este modulo tiene `server-only` y ningun test lo puede importar.
const LECTORES: Record<FuenteId, Lector> = {
  inversion_usd: inversionUsd,
  cash_usd: cashUsd,
  sold_usd: soldUsd,
  agendas: (desde, hasta) => contar('leads', [
    { col: 'fecha_junta_1', op: 'noNull' },
    { col: 'fecha_junta_1', op: 'gte', val: desde },
    { col: 'fecha_junta_1', op: 'lte', val: hasta },
  ]),
  leads_nuevos: (desde, hasta) => contar('leads', [
    { col: 'created_at', op: 'gte', val: desde },
    { col: 'created_at', op: 'lte', val: finDeDia(hasta) },
  ]),
  cierres: (desde, hasta) => contar('leads', [
    { col: 'cerro', op: 'eq', val: true },
    { col: 'fecha_cierre', op: 'gte', val: desde },
    { col: 'fecha_cierre', op: 'lte', val: hasta },
  ]),
  llamadas_analizadas: (desde, hasta) => contar('closing_analyses', [
    { col: 'call_date', op: 'gte', val: desde },
    { col: 'call_date', op: 'lte', val: hasta },
  ]),
  // ⚠️ Se filtra POR EL TIPO que se quiere contar, jamás por «todo menos pageview».
  // Una definición por descarte crece sola con cada evento nuevo, y en ESTA MISMA
  // tabla ya convirtió clics en reproducciones (hallazgo del 24/08/2026).
  vsl_plays: (desde, hasta) => contar('vsl_events', [
    { col: 'tipo_evento', op: 'eq', val: 'play' },
    { col: 'created_at', op: 'gte', val: desde },
    { col: 'created_at', op: 'lte', val: finDeDia(hasta) },
  ]),
  // `contenido_publicado` (contaba `contenido_posts` publicados) salió el 06/10/2026
  // con la tab Instagram: ver FUENTES_DEF en lib/objectives-modelo.ts.
};

/**
 * Lee una fuente automática en un período.
 *
 * ⚠️ Un `fuenteId` que no está en el catálogo NO devuelve cero: devuelve null con
 * el motivo. Un KPI apuntando a una fuente que ya no existe —renombrada, sacada—
 * tiene que decir que no se puede leer; pintarlo de rojo sería acusar a la persona
 * de no hacer algo por un problema nuestro.
 */
export async function leerFuente(fuenteId: string | null | undefined, desde: string, hasta: string): Promise<LecturaFuente> {
  if (!fuenteId) return { valor: null, error: 'el KPI no declara fuente' };
  // El id llega de la BASE, o sea que es un `string` cualquiera y no un `FuenteId`.
  // El lookup se hace sobre el registro sin castear el argumento: si no está, la
  // salida es «no pude leer» con el nombre adentro — nunca un cero.
  const lector = (LECTORES as Record<string, Lector | undefined>)[fuenteId];
  if (!lector) return { valor: null, error: `fuente desconocida: ${fuenteId}` };
  return lector(desde, hasta);
}

/**
 * Las fuentes que la pantalla puede ofrecer.
 *
 * Hoy son TODAS las del catálogo, y eso lo garantiza el compilador con el
 * `Record<FuenteId, Lector>` de arriba — no hace falta filtrar nada. La función
 * existe igual para que las pantallas importen de un solo lugar: el día que una
 * fuente dependa de una integración conectada, el filtro se pone acá adentro y
 * ninguna pantalla se entera.
 */
export const fuentesConLector = (): readonly FuenteDef[] => FUENTES_KPI;

