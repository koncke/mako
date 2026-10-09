// =============================================================================
// secuencia-posiciones — dónde puso la persona cada tarjeta del lienzo de /chatbot
// =============================================================================
// La columna `nutricion_secuencias.posiciones` (mig 0233). La lee el GET de /chatbot
// (`getSettingData`, lib/setting-secuencias.ts) y la escribe SU PROPIA acción
// (POST /api/chat-agent/secuencias, `action: 'posiciones'`), nunca el guardado del flujo.
//
// Módulo SIN `server-only` a propósito: recibe la base (`getTenantDb()`) por parámetro, como
// lib/secuencia-duplicar.ts, para que el test pruebe la columna que falta con una base falsa.
//
// ⚠️ POR QUÉ UNA COLUMNA PROPIA Y NO ADENTRO DE `pasos` NI DE `estrategia`:
//   · `pasos` lo reconstruye `setSecuenciaPasos` (lib/nutricion.ts) CAMPO POR CAMPO y tira lo que
//     no conoce: una posición guardada ahí se pierde en silencio en el primer guardado hecho desde
//     otra pantalla (la API de MaKo, «Crear con IA», el editor de antes). Ya pasó con las variantes.
//   · `estrategia` se guarda ENTERA desde varias pantallas (`guardarEstrategia`): cada una manda el
//     objeto que tiene, y una posición que una no conoce la borra la otra.
//   · Y el layout no es el flujo: mover una tarjeta no cambia qué hace la automatización, así que
//     no pasa por Publicar ni por `validarGrafo`, no se deshace con los pasos y no deja «Sin publicar».
//
// ⚠️ LA COLUMNA QUE FALTA NO ROMPE NADA (la 0233 va antes del deploy, y esto es la red por si no):
// se distingue (42703 / PGRST204, `esColumnaInexistente`) de cualquier otro error y se degrada a
// «no se guardan posiciones»: la lectura devuelve null (el lienzo se dibuja como siempre y no
// ofrece guardar) y la escritura contesta `sin_columna` (la pantalla deja de intentar).

import { esColumnaInexistente } from './nutricion-grafo-motor';
import { sanearPosiciones, type Posiciones } from './lienzo-posiciones';
import { TOPE_NODOS } from './flujo-grafo';

/** Lo que entra en el mapa: una por tarjeta del flujo (`TOPE_NODOS`) más la del CRON. */
export const TOPE_POSICIONES = TOPE_NODOS + 1;

type Err = { code?: string | null; message?: string | null } | null;
type Resp<T> = PromiseLike<{ data: T | null; error: Err }>;

/**
 * Lo mínimo que estas dos funciones le piden a la base del inquilino. La ruta pasa la de verdad con
 * un cast: el tipo de supabase-js no se deja comparar estructuralmente con esto.
 */
export type DbPosiciones = {
  from(tabla: 'nutricion_secuencias'): {
    select(cols: string): { is(col: string, v: null): Resp<Array<{ id: number; posiciones: unknown }>> };
    update(fila: Record<string, unknown>): { eq(col: string, v: number): { select(cols: string): Resp<Array<{ id: number }>> } };
  };
};

/**
 * Las posiciones de las automatizaciones vigentes del negocio, por id. Una fila sin nada guardado
 * no entra al mapa (quien lee pone `{}`).
 *
 * ⚠️ `null` = NO SE PUDIERON LEER (la columna falta, o la consulta falló), y no es lo mismo que
 * «ninguna guardada»: con `{}` la pantalla dejaría mover y el primer guardado pisaría lo que la
 * persona ya había acomodado con UNA sola tarjeta. Con null, mover funciona pero no se guarda.
 * No tira: un error acá dejaba /chatbot sin cargar por algo que es acomodar el dibujo.
 */
export async function leerPosicionesSecuencias(db: DbPosiciones): Promise<Map<number, Posiciones> | null> {
  const { data, error } = await db.from('nutricion_secuencias').select('id, posiciones').is('archivada_at', null);
  if (error) {
    console.warn(`[secuencia-posiciones] ${esColumnaInexistente(error)
      ? 'falta nutricion_secuencias.posiciones (mig 0233): el lienzo no guarda posiciones'
      : `no pude leer las posiciones: ${error.message ?? error.code}`}`);
    return null;
  }
  const out = new Map<number, Posiciones>();
  for (const r of data ?? []) {
    const p = sanearPosiciones(r.posiciones, TOPE_POSICIONES);
    if (Object.keys(p).length) out.set(Number(r.id), p);
  }
  return out;
}

export type ResultadoPosiciones = { ok: true; posiciones: Posiciones } | { ok: false; motivo: 'sin_columna' | 'no_existe' };

/**
 * Guarda el mapa ENTERO de una automatización (lo manda la pantalla ya podado: la poda necesita
 * saber qué tarjetas hay en el lienzo, incluidas las que todavía no se publicaron). Saneado acá
 * también: lo que llega por HTTP no se cree. Un mapa vacío se guarda como null (= ninguna movida).
 *
 * No toca `updated_at`: acomodar el dibujo no es editar la automatización.
 */
export async function guardarPosicionesSecuencia(db: DbPosiciones, secuenciaId: number, raw: unknown): Promise<ResultadoPosiciones> {
  const posiciones = sanearPosiciones(raw, TOPE_POSICIONES);
  const { data, error } = await db.from('nutricion_secuencias')
    .update({ posiciones: Object.keys(posiciones).length ? posiciones : null })
    .eq('id', secuenciaId)
    .select('id');
  if (error) {
    if (esColumnaInexistente(error)) {
      console.warn('[secuencia-posiciones] falta nutricion_secuencias.posiciones (mig 0233): no se guardó');
      return { ok: false, motivo: 'sin_columna' };
    }
    throw new Error(`guardarPosicionesSecuencia: ${error.message ?? error.code}`);
  }
  if (!data?.length) return { ok: false, motivo: 'no_existe' };
  return { ok: true, posiciones };
}
