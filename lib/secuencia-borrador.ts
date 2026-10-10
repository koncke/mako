// =============================================================================
// secuencia-borrador — lo que se está armando en el lienzo de /automations, SIN publicar
// =============================================================================
// Pedido de Martín (09/10/2026, sexta tanda, punto 7 de «General»): «Que se elimine una flecha no
// significa que se elimine la tarjeta posterior, sino que queda "flotando". Lo que no se puede es
// publicar o probar una automatización incompleta. Y eso significa que también puedo crear pasos
// sueltos en cualquier momento y lugar del tablero».
//
// MEDIDO (09/10/2026) cómo se guardaba hasta acá: NO HABÍA BORRADOR. El lienzo edita en memoria
// (`SecuenciaPerfil`: un `useState` con los pasos) y lo único que escribe los pasos es Publicar
// (PATCH /api/whatsapp/secuencias → `setSecuenciaPasos`, que valida con `validarGrafo`). Una
// automatización con una tarjeta suelta no se podía guardar de ninguna forma: al cambiar de
// automatización o al recargar se perdía (con el «¿seguro?» de la quinta tanda delante, y nada más).
//
// Esto es el borrador: la columna `nutricion_secuencias.pasos_borrador` (mig 0240). La escribe SU
// acción (POST /api/chat-agent/secuencias, `action: 'borrador'`), que valida sólo lo que rompe el
// DATO (`validarParaGuardar`, lib/flujo-grafo.ts). EL MOTOR NO LA LEE NUNCA: lee `pasos`, lo
// publicado. Así una tarjeta suelta, una condición a medias o un ciclo sin espera sobreviven sin
// correr. Publicar sigue siendo `setSecuenciaPasos`, con `validarGrafo`.
//
// ⚠️ UN BORRADOR SE ABRE SÓLO SI SE ARMÓ SOBRE LO PUBLICADO DE HOY (`base`). Si después se publicó
// otra cosa —otra pestaña, la API de MaKo, «Crear con IA», el mismo borrador publicado—, el borrador
// habla de un flujo que ya no está: abrirlo y publicarlo pisaría lo nuevo. Ahí no se abre
// (`borradorVigente`). Así publicar no tiene que acordarse de borrarlo para que no vuelva.
//
// SIN `server-only`: recibe la base por parámetro (como lib/secuencia-posiciones.ts), para que el
// test pruebe la columna que falta con una base falsa.

import { normalizar, validarParaGuardar, TOPE_NODOS, type PasoGrafo } from './flujo-grafo';
import { esColumnaInexistente } from './nutricion-grafo-motor';
import { sanearHtmlEmail } from './email-html-seguro';

/** Lo más grande que se guarda: 60 tarjetas con sus textos y un email en HTML entran de sobra. */
export const TOPE_BORRADOR_BYTES = 400_000;

/** Lo que guarda la columna: los pasos, sobre qué publicado se armaron y cuándo. */
export type BorradorGuardado = { pasos: PasoGrafo[]; base: string; guardado_at: string };

/** Un hash corto y estable de un texto (el de `firmaFlujo` de lib/simulador-grafo.ts). */
function huella(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${s.length}:${(h >>> 0).toString(36)}`;
}

/**
 * LA HUELLA DE UN FLUJO, en la forma en que se publica: ordenado por `orden`, normalizado y con el
 * orden renumerado (lo mismo que hace `setSecuenciaPasos` y lo que el lienzo carga). Es la `base` de
 * un borrador al guardarlo y lo que se compara al abrirlo: tiene que ser el MISMO cálculo de los dos
 * lados, o ningún borrador se abriría nunca.
 */
export function firmaPublicado(pasos: unknown): string {
  const arr = Array.isArray(pasos) ? (pasos.filter((p) => p && typeof p === 'object' && !Array.isArray(p)) as PasoGrafo[]) : [];
  const ordenados = [...arr].sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));
  return huella(JSON.stringify(normalizar(ordenados).map((p, i) => ({ ...p, orden: i + 1 }))));
}

/**
 * Lo que llega del navegador como borrador, saneado: una lista de tarjetas (objetos), que entra en el
 * tope, con el HTML de los emails pasado por la lista blanca (el borrador se vuelve a DIBUJAR), y que
 * no rompe el dato (`validarParaGuardar`). Lo INCOMPLETO pasa: para eso existe.
 */
export function sanearBorrador(raw: unknown): { ok: true; pasos: PasoGrafo[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: 'el borrador no es una lista de tarjetas' };
  if (raw.length > TOPE_NODOS + 1) return { ok: false, error: `una automatización tiene como mucho ${TOPE_NODOS} tarjetas` };
  let json: string;
  try { json = JSON.stringify(raw); } catch { return { ok: false, error: 'el borrador no se puede leer' }; }
  if (json.length > TOPE_BORRADOR_BYTES) return { ok: false, error: 'el borrador es demasiado grande' };
  const pasos = (JSON.parse(json) as unknown[])
    .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object' && !Array.isArray(p))
    .map((p) => (typeof p.cuerpo_html === 'string' ? { ...p, cuerpo_html: sanearHtmlEmail(p.cuerpo_html) } : p)) as PasoGrafo[];
  const grafo = normalizar(pasos);
  const errores = validarParaGuardar(grafo);
  if (errores.length) return { ok: false, error: `No se guardó el borrador: ${errores[0]}.` };
  return { ok: true, pasos: grafo };
}

/** Lo que hay en la columna, si tiene la forma de un borrador. */
function leerBorrador(x: unknown): BorradorGuardado | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  if (!Array.isArray(o.pasos) || typeof o.base !== 'string' || typeof o.guardado_at !== 'string') return null;
  return { pasos: o.pasos as PasoGrafo[], base: o.base, guardado_at: o.guardado_at };
}

/**
 * El borrador que se ABRE, o null: no hay, no tiene la forma, se armó sobre otro publicado (ver la
 * cabecera), o es igual a lo publicado (no queda nada sin publicar).
 */
export function borradorVigente(columna: unknown, publicados: unknown): { pasos: PasoGrafo[]; guardado_at: string } | null {
  const b = leerBorrador(columna);
  if (!b) return null;
  const base = firmaPublicado(publicados);
  if (b.base !== base || firmaPublicado(b.pasos) === base) return null;
  return { pasos: b.pasos, guardado_at: b.guardado_at };
}

type Err = { code?: string | null; message?: string | null } | null;
type Resp<T> = PromiseLike<{ data: T | null; error: Err }>;

/**
 * Lo mínimo que estas funciones le piden a la base del inquilino (`getTenantDb()`). La ruta pasa la
 * de verdad con un cast: el tipo de supabase-js no se deja comparar estructuralmente con esto.
 */
export type DbBorrador = {
  from(tabla: 'nutricion_secuencias'): {
    select(cols: string): {
      is(col: string, v: null): Resp<Array<{ id: number; pasos: unknown; pasos_borrador: unknown }>>;
      eq(col: string, v: number): { maybeSingle(): Resp<{ id: number; pasos: unknown }> };
    };
    update(fila: Record<string, unknown>): { eq(col: string, v: number): { select(cols: string): Resp<Array<{ id: number }>> } };
  };
};

/**
 * Los borradores VIGENTES de las automatizaciones del negocio (`borradorVigente`), por id.
 *
 * ⚠️ `null` = NO SE PUDIERON LEER (la columna falta, o la consulta falló), que no es «ninguno»: la
 * pantalla abre lo publicado y no ofrece guardar borradores. No tira: un error acá dejaba /automations sin
 * cargar por algo que es un extra.
 */
export async function leerBorradoresSecuencias(db: DbBorrador): Promise<Map<number, { pasos: PasoGrafo[]; guardado_at: string }> | null> {
  const { data, error } = await db.from('nutricion_secuencias').select('id, pasos, pasos_borrador').is('archivada_at', null);
  if (error) {
    console.warn(`[secuencia-borrador] ${esColumnaInexistente(error)
      ? 'falta nutricion_secuencias.pasos_borrador (mig 0240): el lienzo no guarda borradores'
      : `no pude leer los borradores: ${error.message ?? error.code}`}`);
    return null;
  }
  const out = new Map<number, { pasos: PasoGrafo[]; guardado_at: string }>();
  for (const r of data ?? []) {
    const v = borradorVigente(r.pasos_borrador, r.pasos);
    if (v) out.set(Number(r.id), v);
  }
  return out;
}

export type ResultadoBorrador =
  | { ok: true; guardado_at: string | null }
  | { ok: false; motivo: 'sin_columna' | 'no_existe' | 'invalido'; error?: string };

/**
 * Guarda el borrador de una automatización (lo que tiene el lienzo, ENTERO). Saneado acá también:
 * lo que llega por HTTP no se cree. La `base` es lo publicado de AHORA, leído acá. Un borrador igual a
 * lo publicado se guarda como null (no queda nada sin publicar: `guardado_at` null).
 *
 * No toca `updated_at` ni `pasos`: guardar un borrador no es editar la automatización que corre.
 */
export async function guardarBorradorSecuencia(db: DbBorrador, secuenciaId: number, raw: unknown): Promise<ResultadoBorrador> {
  const s = sanearBorrador(raw);
  if (!s.ok) return { ok: false, motivo: 'invalido', error: s.error };
  const { data: fila, error: eLeer } = await db.from('nutricion_secuencias').select('id, pasos').eq('id', secuenciaId).maybeSingle();
  if (eLeer) throw new Error(`guardarBorradorSecuencia: ${eLeer.message ?? eLeer.code}`);
  if (!fila) return { ok: false, motivo: 'no_existe' };
  const base = firmaPublicado(fila.pasos);
  const guardado_at = new Date().toISOString();
  const valor: BorradorGuardado | null = firmaPublicado(s.pasos) === base ? null : { pasos: s.pasos, base, guardado_at };
  const { data, error } = await db.from('nutricion_secuencias').update({ pasos_borrador: valor }).eq('id', secuenciaId).select('id');
  if (error) {
    if (esColumnaInexistente(error)) {
      console.warn('[secuencia-borrador] falta nutricion_secuencias.pasos_borrador (mig 0240): no se guardó');
      return { ok: false, motivo: 'sin_columna' };
    }
    throw new Error(`guardarBorradorSecuencia: ${error.message ?? error.code}`);
  }
  if (!data?.length) return { ok: false, motivo: 'no_existe' };
  return { ok: true, guardado_at: valor ? guardado_at : null };
}

/** Descarta el borrador (al publicar, o «descartar los cambios»). Sin la columna, no hay nada que descartar. */
export async function descartarBorradorSecuencia(db: DbBorrador, secuenciaId: number): Promise<{ ok: true } | { ok: false; motivo: 'sin_columna' | 'no_existe' }> {
  const { data, error } = await db.from('nutricion_secuencias').update({ pasos_borrador: null }).eq('id', secuenciaId).select('id');
  if (error) {
    if (esColumnaInexistente(error)) return { ok: false, motivo: 'sin_columna' };
    throw new Error(`descartarBorradorSecuencia: ${error.message ?? error.code}`);
  }
  if (!data?.length) return { ok: false, motivo: 'no_existe' };
  return { ok: true };
}
