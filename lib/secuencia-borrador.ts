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
// ⚠️ Y LA BASE LA PONE LA PESTAÑA, NO EL MOMENTO DE GUARDAR (revisión de la sexta tanda, 10/10/2026).
// Hasta acá `guardarBorradorSecuencia` leía lo publicado AL GUARDAR y lo anotaba como base: una pestaña
// que abrió X, mientras otra (o MaKo por WhatsApp, o un hand-off que suma un caso a «Si responde»)
// publicaba Y, guardaba su X-más-un-cambio con base Y. Al recargar, en TODAS las pestañas, se abría ese
// borrador encima de Y como si se hubiera armado sobre lo de hoy, y Publicar revertía Y sin aviso. La
// regla de arriba se cumplía sobre el dato equivocado: la base decía «lo de hoy» y era «lo de cuando
// se guardó». Ahora la base es la huella de lo que la pestaña ABRIÓ (la calcula el server en el GET,
// `getSettingData`, sobre la misma columna cruda que lee esto) y viaja en cada guardado: si ya no es lo
// publicado, no se guarda nada y vuelve `desactualizado` (la ruta contesta 409). La huella NO la calcula
// el navegador: `setSecuenciaPasos` reconstruye cada paso campo por campo y le mergea las variantes, así
// que la firma de lo que el lienzo mandó a publicar no es la de lo que quedó guardado. Después de
// publicar, la pestaña toma la base nueva de la respuesta de `descartar-borrador`.
//
// ⚠️ PUBLICAR Y DESCARTAR DESDE UNA FOTO TAMBIÉN PIDEN LO QUE VIERON (MaKo Mobile, 12/10/2026). El teléfono
// (/m/automations) no edita: publica o descarta el borrador TAL COMO LO LEYÓ, y la pantalla puede llevar
// horas abierta. Sin precondición, «Publicar» mandaba el borrador v1 encima de un v2 que la computadora
// ya había publicado (y empezaba a salir a los leads), y el descarte de después borraba el v2 guardado sin
// rastro. Ahora el que escribe desde una foto manda `visto` = { base, guardado_at } (la huella de lo
// publicado y CUÁL borrador había) y el server no escribe nada si ya no es así: `comprobarVisto`, 409
// `desactualizado` en las dos rutas. Es OPCIONAL: el lienzo de escritorio publica lo que tiene en memoria
// (lo suyo, editado en esa pestaña) y no lo manda.
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
      eq(col: string, v: number): { maybeSingle(): Resp<{ id: number; pasos: unknown; pasos_borrador?: unknown }> };
    };
    update(fila: Record<string, unknown>): { eq(col: string, v: number): { select(cols: string): Resp<Array<{ id: number; pasos?: unknown }>> } };
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
  | { ok: false; motivo: 'sin_columna' | 'no_existe' | 'invalido' | 'desactualizado'; error?: string };

/**
 * Guarda el borrador de una automatización (lo que tiene el lienzo, ENTERO). Saneado acá también:
 * lo que llega por HTTP no se cree. Un borrador igual a lo publicado se guarda como null (no queda nada
 * sin publicar: `guardado_at` null).
 *
 * ⚠️ `baseCliente` ES LA HUELLA DE LO QUE LA PESTAÑA ABRIÓ (ver la cabecera), y tiene que ser lo publicado
 * de AHORA, leído acá: si no lo es —o no vino—, el borrador se armó sobre otro flujo y NO se escribe nada
 * (`desactualizado`). Guardarlo con la base de ahora lo haría abrirse encima de lo nuevo y pisarlo al
 * publicar; guardarlo con la del cliente lo dejaría guardado y sin abrirse nunca, que es perderlo sin
 * aviso. La única salida honesta es que la pantalla lo diga.
 *
 * No toca `updated_at` ni `pasos`: guardar un borrador no es editar la automatización que corre.
 */
export async function guardarBorradorSecuencia(db: DbBorrador, secuenciaId: number, raw: unknown, baseCliente: unknown): Promise<ResultadoBorrador> {
  const s = sanearBorrador(raw);
  if (!s.ok) return { ok: false, motivo: 'invalido', error: s.error };
  const { data: fila, error: eLeer } = await db.from('nutricion_secuencias').select('id, pasos').eq('id', secuenciaId).maybeSingle();
  if (eLeer) throw new Error(`guardarBorradorSecuencia: ${eLeer.message ?? eLeer.code}`);
  if (!fila) return { ok: false, motivo: 'no_existe' };
  const base = firmaPublicado(fila.pasos);
  if (typeof baseCliente !== 'string' || baseCliente !== base) return { ok: false, motivo: 'desactualizado' };
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

/**
 * LO QUE UNA PANTALLA VIO (ver la cabecera): la huella de lo publicado (`base`, la de `getSettingData`) y
 * CUÁL borrador había (`guardado_at` de la columna; null = ninguno). `base` puede faltar SÓLO donde lo
 * publicado cambió a propósito: el descarte que sigue a un Publicar, que ya movió la base.
 */
export type VistoBorrador = { base?: string; guardado_at: string | null };

/** Lo que llega por HTTP como `visto`, o null si no tiene la forma (y entonces no se escribe: no se sabe qué vio). */
export function leerVisto(x: unknown): VistoBorrador | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  if (!('guardado_at' in o) || (o.guardado_at !== null && typeof o.guardado_at !== 'string')) return null;
  if (o.base !== undefined && typeof o.base !== 'string') return null;
  return { guardado_at: o.guardado_at as string | null, ...(typeof o.base === 'string' ? { base: o.base } : {}) };
}

/**
 * ¿La fila sigue siendo la que se vio? Lo publicado con la misma huella y el MISMO borrador en la columna
 * (por su `guardado_at`, crudo: cualquier guardado de otra pestaña lo cambia, y un descarte lo deja null).
 */
export function sigueComoSeVio(fila: { pasos: unknown; pasos_borrador: unknown }, visto: VistoBorrador): boolean {
  if (visto.base !== undefined && firmaPublicado(fila.pasos) !== visto.base) return false;
  return (leerBorrador(fila.pasos_borrador)?.guardado_at ?? null) === visto.guardado_at;
}

/**
 * La precondición de quien escribe desde una foto (Publicar y Descartar del teléfono): lee la fila y dice
 * si sigue como se vio. `visto` sin la forma es `desactualizado` (no se escribe a ciegas). Lee y después
 * escribe, como `guardarBorradorSecuencia`: lo que queda abierto son los milisegundos entre las dos.
 */
export async function comprobarVisto(db: DbBorrador, secuenciaId: number, visto: unknown): Promise<{ ok: true } | { ok: false; motivo: 'desactualizado' | 'no_existe' | 'sin_columna' }> {
  const v = leerVisto(visto);
  if (!v) return { ok: false, motivo: 'desactualizado' };
  const { data, error } = await db.from('nutricion_secuencias').select('id, pasos, pasos_borrador').eq('id', secuenciaId).maybeSingle();
  if (error) {
    if (esColumnaInexistente(error)) return { ok: false, motivo: 'sin_columna' };
    throw new Error(`comprobarVisto: ${error.message ?? error.code}`);
  }
  if (!data) return { ok: false, motivo: 'no_existe' };
  return sigueComoSeVio({ pasos: data.pasos, pasos_borrador: data.pasos_borrador ?? null }, v) ? { ok: true } : { ok: false, motivo: 'desactualizado' };
}

/**
 * Descarta el borrador (al publicar, «Volver a lo publicado», «Descartar cambios»). Sin la columna, no hay
 * nada que descartar.
 *
 * Devuelve la `base` de lo publicado que quedó (la huella de la fila, calculada acá): es la que la pestaña
 * toma DESPUÉS DE PUBLICAR para seguir guardando borradores encima de lo suyo (ver la cabecera: el
 * navegador no puede calcularla). Las otras dos no la toman: no publicaron nada, y adoptarla dejaría a
 * una pestaña con lo publicado viejo guardando sobre lo nuevo.
 *
 * Con `visto` (el teléfono), descarta SÓLO si la fila sigue como se vio (`comprobarVisto`): si no, no borra
 * nada y vuelve `desactualizado`. Sin `visto` (el lienzo de escritorio), como siempre.
 */
export async function descartarBorradorSecuencia(db: DbBorrador, secuenciaId: number, visto?: unknown): Promise<{ ok: true; base: string } | { ok: false; motivo: 'sin_columna' | 'no_existe' | 'desactualizado' }> {
  if (visto !== undefined) {
    const c = await comprobarVisto(db, secuenciaId, visto);
    if (!c.ok) return c;
  }
  const { data, error } = await db.from('nutricion_secuencias').update({ pasos_borrador: null }).eq('id', secuenciaId).select('id, pasos');
  if (error) {
    if (esColumnaInexistente(error)) return { ok: false, motivo: 'sin_columna' };
    throw new Error(`descartarBorradorSecuencia: ${error.message ?? error.code}`);
  }
  if (!data?.length) return { ok: false, motivo: 'no_existe' };
  return { ok: true, base: firmaPublicado(data[0].pasos) };
}
