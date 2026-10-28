// =============================================================================
// calendario-publicar — programar en la red una «Publicación» del Calendario, por Zernio (28/10/2026)
// =============================================================================
// Martín a Teo (28/10, 00:23:08): «publicás reels e historias desde el Calendar los días y a la hora que elijas». El
// Cerebro: la decisión que esperaba docs/hallazgos-calendario.md es ese pedido. Lo que se hace acá:
//   · la cuenta donde se publica (las conectadas en Zernio), el texto y el archivo de un evento (columnas de la mig 0342);
//   · el archivo: el navegador lo sube por una URL firmada al bucket privado `ig-media`, en una ruta que arma ESTE server;
//   · programar uno o varios (en serie): se reclama el evento (`programando`), se firma la media hasta 7 días después de la
//     hora, Zernio lo programa y queda `programada` con su `post_id`;
//   · cancelar, y releer el estado de lo programado cuyo horario ya pasó (al abrir el Calendario: sin cron nuevo).
// Las decisiones puras: lib/calendario-publicar-reglas.ts. Los posts de Zernio: lib/zernio-publicar.ts.
//
// ⚠️ LAS COLUMNAS SE LEEN APARTE y su ausencia se tolera: sumarlas a la lectura de siempre (`COLS`, lib/calendario.ts)
//    rompería el Calendario entero en una base sin la 0342 (docs/hallazgos-pagos.md, «Una columna nueva en un select
//    explícito rompe la lectura entera sin la migración»).
// ⚠️ PUBLICAR ES ESCRIBIR AFUERA, a la vista de todos: desde la API de MaKo va con confirmación (`programar_publicacion`).
// =============================================================================

import 'server-only';
import { randomBytes, randomUUID } from 'node:crypto';
import { getTenantDb, getWorkspaceActual } from './workspace';
import { getSupabaseServer } from './supabase';
import { conexionesViaZernio, type ZernioConectarError } from './zernio-conectar';
import { borrarPostZernio, crearPostZernio, leerPostZernio } from './zernio-publicar';
import { ZernioError } from './zernio';
import { esFormato, sumarDias, type FormatoPublicacion } from './calendario-modelo';
import { instanteDe } from './cron-aviso';
import {
  BUCKET_PUBLICAR, cuerpoDelPost, esRedPublicar, estaProgramada, estadoDeZernio, motivoParaNoProgramar, REDES_PUBLICAR, rutaDelArchivo,
  rutaValida, segundosDeFirma, tipoDeArchivo, TOPE_TEXTO, type DatosPublicacion, type EventoParaPublicar, type RedPublicar,
} from './calendario-publicar-reglas';

export const COLS_PUBLICACION = 'red, cuenta_red, archivo, archivo_tipo, texto, post_id, publicacion, publicacion_motivo, publicacion_url';
const COLS_EVENTO = 'id, tipo, formato, titulo, inicio, dia_completo, estado';
export const FALTA_MIGRACION_PUBLICAR = 'Falta la migración 0342 para publicar desde el Calendario.';
/** Hasta cuántas se programan de una vez (el mismo tope de un lote del Calendario). */
export const MAX_PROGRAMAR = 40;

/** ¿El error es el de una base sin la 0342? (la columna no existe, o PostgREST todavía no la ve). */
export const esSinMigracion = (m: string | null | undefined): boolean =>
  /(red|cuenta_red|archivo|texto|post_id|publicacion)/.test(m ?? '') && /(does not exist|schema cache|could not find)/i.test(m ?? '');

const datosDeFila = (f: Record<string, unknown>): DatosPublicacion => ({
  red: esRedPublicar(f.red) ? f.red : null,
  cuenta_red: typeof f.cuenta_red === 'string' ? f.cuenta_red : null,
  archivo: typeof f.archivo === 'string' ? f.archivo : null,
  archivo_tipo: f.archivo_tipo === 'image' || f.archivo_tipo === 'video' ? f.archivo_tipo : null,
  texto: typeof f.texto === 'string' ? f.texto : '',
  post_id: typeof f.post_id === 'string' ? f.post_id : null,
  publicacion: ['programando', 'programada', 'publicada', 'fallo'].includes(String(f.publicacion)) ? (f.publicacion as DatosPublicacion['publicacion']) : null,
  publicacion_motivo: typeof f.publicacion_motivo === 'string' ? f.publicacion_motivo : null,
  publicacion_url: typeof f.publicacion_url === 'string' ? f.publicacion_url : null,
});

/** Los datos de publicación de varios eventos. Sin la 0342, vacío (el Calendario sigue igual). */
export async function leerPublicaciones(ids: readonly string[]): Promise<Map<string, DatosPublicacion>> {
  const out = new Map<string, DatosPublicacion>();
  if (!ids.length) return out;
  const db = await getTenantDb();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db.from('calendario_eventos').select(`id, ${COLS_PUBLICACION}`).in('id', ids.slice(i, i + 200));
    if (error) {
      if (esSinMigracion(error.message)) return new Map();
      throw new Error(`No pude leer las publicaciones: ${error.message}`);
    }
    for (const f of (data ?? []) as Record<string, unknown>[]) out.set(String(f.id), datosDeFila(f));
  }
  return out;
}

/** Un evento con sus datos de publicación. 'sin-migracion' si la base no tiene la 0342. */
async function eventoParaPublicar(id: string): Promise<EventoParaPublicar | null | 'sin-migracion'> {
  const db = await getTenantDb();
  const { data, error } = await db.from('calendario_eventos').select(`${COLS_EVENTO}, ${COLS_PUBLICACION}`).eq('id', id).maybeSingle();
  if (error) {
    if (esSinMigracion(error.message)) return 'sin-migracion';
    throw new Error(`No pude leer el evento: ${error.message}`);
  }
  if (!data) return null;
  const f = data as Record<string, unknown>;
  return {
    id: String(f.id), tipo: String(f.tipo), formato: esFormato(f.formato) ? (f.formato as FormatoPublicacion) : null, titulo: String(f.titulo ?? ''),
    inicio: String(f.inicio), dia_completo: f.dia_completo === true, estado: f.estado === 'hecho' ? 'hecho' : 'planeado', ...datosDeFila(f),
  };
}

/**
 * ¿Este evento está esperando a Zernio? Lo usan mover, borrar y tildar (lib/calendario.ts): uno programado se CANCELA
 * primero. Sin la 0342 nada está programado. Si no se puede leer, tira (no se da por libre lo que no se pudo mirar).
 */
export async function estaProgramadoEnLaRed(id: string): Promise<boolean> {
  const db = await getTenantDb();
  const { data, error } = await db.from('calendario_eventos').select('publicacion').eq('id', id).maybeSingle();
  if (error) {
    if (esSinMigracion(error.message)) return false;
    throw new Error(`No pude leer si el evento está programado: ${error.message}`);
  }
  return estaProgramada(data ? datosDeFila(data as Record<string, unknown>) : null);
}

/**
 * Cambia la publicación de un evento NO programado (lo programado se cancela primero). Sólo los campos que vienen.
 * `{ ok: false }` con el motivo en palabras.
 */
export async function guardarPublicacion(id: string, cambio: {
  red?: string | null; cuentaRed?: string | null; texto?: string; archivo?: string | null; archivoTipo?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const ws = await getWorkspaceActual();
  if (ws == null) return { ok: false, error: 'No hay un negocio elegido.' };
  const fila: Record<string, unknown> = {};
  if (cambio.red !== undefined) {
    if (cambio.red !== null && !esRedPublicar(cambio.red)) return { ok: false, error: 'Esa red no se publica desde aquí.' };
    fila.red = cambio.red;
  }
  if (cambio.cuentaRed !== undefined) {
    if (cambio.cuentaRed !== null && !/^[A-Za-z0-9_-]{1,80}$/.test(cambio.cuentaRed)) return { ok: false, error: 'Esa cuenta no es válida.' };
    fila.cuenta_red = cambio.cuentaRed;
  }
  if (cambio.texto !== undefined) {
    const t = String(cambio.texto ?? '');
    if (t.length > TOPE_TEXTO) return { ok: false, error: `El texto tiene más de ${TOPE_TEXTO} caracteres.` };
    fila.texto = t;
  }
  if (cambio.archivo !== undefined) {
    if (cambio.archivo !== null && !rutaValida(cambio.archivo, ws, id)) return { ok: false, error: 'Ese archivo no es de este evento.' };
    if (cambio.archivo !== null && cambio.archivoTipo !== 'image' && cambio.archivoTipo !== 'video') return { ok: false, error: 'El archivo tiene que ser una imagen o un video.' };
    fila.archivo = cambio.archivo;
    fila.archivo_tipo = cambio.archivo === null ? null : cambio.archivoTipo;
  }
  if (!Object.keys(fila).length) return { ok: true };
  fila.updated_at = new Date().toISOString();
  const db = await getTenantDb();
  // Sólo si NO está esperando a Zernio: lo que se programó es lo que se publica (cambiarlo acá no lo cambia allá).
  for (const libre of [null, 'publicada', 'fallo'] as const) {
    const q = db.from('calendario_eventos').update(fila).eq('id', id);
    const { data, error } = await (libre === null ? q.is('publicacion', null) : q.eq('publicacion', libre)).select('id');
    if (error) {
      if (esSinMigracion(error.message)) return { ok: false, error: FALTA_MIGRACION_PUBLICAR };
      throw new Error(`No pude guardar la publicación: ${error.message}`);
    }
    if (data?.length) return { ok: true };
  }
  return (await estaProgramadoEnLaRed(id)) ? { ok: false, error: 'Está programada: cancélala para cambiarla.' } : { ok: false, error: 'Ese evento ya no existe.' };
}

/**
 * La URL firmada para que el navegador SUBA el archivo (imagen o video) de un evento. La ruta la arma el server, con un
 * nombre al azar: el navegador no elige dónde escribe. Después se guarda con `guardarPublicacion({ archivo, archivoTipo })`.
 */
export async function subidaDelArchivo(id: string, mime: string): Promise<{ ok: true; ruta: string; url: string; apikey: string | null; tipo: 'image' | 'video' } | { ok: false; error: string }> {
  const ws = await getWorkspaceActual();
  if (ws == null) return { ok: false, error: 'No hay un negocio elegido.' };
  const tipo = tipoDeArchivo(mime);
  const ruta = rutaDelArchivo(ws, id, mime, randomBytes(12).toString('hex'));
  if (!tipo || !ruta) return { ok: false, error: 'Sube una imagen (JPG, PNG o WEBP) o un video (MP4 o MOV).' };
  const ev = await eventoParaPublicar(id);
  if (ev === 'sin-migracion') return { ok: false, error: FALTA_MIGRACION_PUBLICAR };
  if (!ev) return { ok: false, error: 'Ese evento ya no existe.' };
  if (estaProgramada(ev)) return { ok: false, error: 'Está programada: cancélala para cambiar el archivo.' };
  const { data, error } = await getSupabaseServer().storage.from(BUCKET_PUBLICAR).createSignedUploadUrl(ruta);
  if (error || !data?.signedUrl) return { ok: false, error: 'No pude preparar la subida del archivo.' };
  // La clave PÚBLICA (anon): la subida firmada de Storage la pide en el encabezado (lib/setting-adjuntos.ts, el mismo molde).
  return { ok: true, ruta, url: data.signedUrl, apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? null, tipo };
}

/** Una cuenta donde se puede publicar (las conectadas en Zernio, de las redes que se publican). */
export type CuentaParaPublicar = { red: RedPublicar; accountId: string; usuario: string; nombre: string; vencida: boolean };

/** Las cuentas conectadas del negocio donde se puede publicar. Nunca tira: un fallo vuelve con su motivo. */
export async function cuentasParaPublicar(): Promise<{ ok: true; cuentas: CuentaParaPublicar[] } | { ok: false; motivo: string }> {
  const ws = await getWorkspaceActual();
  if (ws == null) return { ok: false, motivo: 'sin-negocio' };
  try {
    const todas = await conexionesViaZernio(ws);
    const cuentas = todas
      .filter((c) => c.activa && (REDES_PUBLICAR as readonly string[]).includes(c.plataforma))
      .map((c) => ({ red: c.plataforma as RedPublicar, accountId: c.accountId, usuario: c.usuario, nombre: c.nombre, vencida: c.vencida }));
    return { ok: true, cuentas };
  } catch (e) {
    return { ok: false, motivo: (e as ZernioConectarError)?.motivo ?? 'error' };
  }
}

/** Un fallo de Zernio o de la red, en una línea para el evento (sin la clave ni el cuerpo entero). */
function motivoDeFallo(e: unknown): string {
  if (e instanceof ZernioError) {
    const b = e.body;
    const det = b?.platformError ? ` (${String(typeof b.platformError === 'string' ? b.platformError : JSON.stringify(b.platformError)).slice(0, 120)})` : '';
    return `Zernio no la programó: ${(b?.error ?? e.message).slice(0, 160)}${det}`.slice(0, 300);
  }
  return `No se pudo programar: ${(e instanceof Error ? e.message : String(e)).slice(0, 200)}`;
}

export type ResultadoProgramar = { programadas: string[]; fallidas: Array<{ id: string; titulo: string; motivo: string }> };

/** Las publicaciones LISTAS de un rango de días (con cuenta y archivo, sin programar): lo que se programa «en serie». */
export async function listasParaProgramar(desde: string, hasta: string, tz: string): Promise<string[] | 'sin-migracion'> {
  const dia = (f: string) => { const [y, m, d] = f.split('-').map(Number); return instanteDe(tz, y, m, d, 0, 0).toISOString(); };
  const db = await getTenantDb();
  const ids: string[] = [];
  // Sin un `or`: las que nunca se programaron y las que fallaron, en dos lecturas.
  for (const libre of [null, 'fallo'] as const) {
    const q = db.from('calendario_eventos').select('id').eq('tipo', 'publicacion').not('red', 'is', null).not('archivo', 'is', null)
      .gte('inicio', dia(desde)).lt('inicio', dia(sumarDias(hasta, 1))).order('inicio', { ascending: true }).limit(MAX_PROGRAMAR);
    const { data, error } = await (libre === null ? q.is('publicacion', null) : q.eq('publicacion', libre));
    if (error) {
      if (esSinMigracion(error.message)) return 'sin-migracion';
      throw new Error(`No pude leer las publicaciones listas: ${error.message}`);
    }
    for (const f of (data ?? []) as Array<{ id: string }>) ids.push(String(f.id));
  }
  return ids.slice(0, MAX_PROGRAMAR);
}

export type RevisionProgramar = {
  listas: Array<{ id: string; titulo: string; red: RedPublicar; formato: FormatoPublicacion | null; inicio: string }>;
  no: Array<{ id: string; titulo: string; motivo: string }>;
};

/** Lo que se programaría y lo que no (y por qué), SIN escribir nada: el resumen que se confirma. */
export async function revisarParaProgramar(ids: readonly string[], ahora = Date.now()): Promise<RevisionProgramar | 'sin-migracion'> {
  const out: RevisionProgramar = { listas: [], no: [] };
  for (const id of [...new Set(ids.map(String))].slice(0, MAX_PROGRAMAR)) {
    const ev = await eventoParaPublicar(id);
    if (ev === 'sin-migracion') return 'sin-migracion';
    if (!ev) { out.no.push({ id, titulo: '', motivo: 'Ese evento ya no existe.' }); continue; }
    const no = motivoParaNoProgramar(ev, ahora);
    if (no) out.no.push({ id, titulo: ev.titulo, motivo: no });
    else out.listas.push({ id, titulo: ev.titulo, red: ev.red as RedPublicar, formato: ev.formato, inicio: ev.inicio });
  }
  return out;
}

/**
 * Programa en la red uno o varios eventos (en serie: la semana entera de una vez). Cada uno se valida, se RECLAMA
 * (`programando`, con compare-and-set: dos pedidos a la vez no programan dos veces) y se le pide a Zernio. Uno que falla no
 * frena a los otros: queda en `fallo` con su motivo, y se puede volver a programar.
 */
export async function programarPublicaciones(ids: readonly string[], ahora = Date.now()): Promise<ResultadoProgramar | { error: string }> {
  const ws = await getWorkspaceActual();
  if (ws == null) return { error: 'No hay un negocio elegido.' };
  const unicos = [...new Set(ids.map(String))];
  if (!unicos.length) return { error: 'No hay nada para programar.' };
  if (unicos.length > MAX_PROGRAMAR) return { error: `Hasta ${MAX_PROGRAMAR} publicaciones de una vez.` };
  const db = await getTenantDb();
  const out: ResultadoProgramar = { programadas: [], fallidas: [] };
  for (const id of unicos) {
    const ev = await eventoParaPublicar(id);
    if (ev === 'sin-migracion') return { error: FALTA_MIGRACION_PUBLICAR };
    if (!ev) { out.fallidas.push({ id, titulo: '', motivo: 'Ese evento ya no existe.' }); continue; }
    const no = motivoParaNoProgramar(ev, ahora);
    if (no) { out.fallidas.push({ id, titulo: ev.titulo, motivo: no }); continue; }
    if (!rutaValida(ev.archivo as string, ws, id)) { out.fallidas.push({ id, titulo: ev.titulo, motivo: 'El archivo no es de este evento: súbelo de nuevo.' }); continue; }
    // El reclamo: de `null` o `fallo` a `programando`. Si no lo gana, otro pedido lo está programando.
    const q = db.from('calendario_eventos').update({ publicacion: 'programando', publicacion_motivo: null, updated_at: new Date().toISOString() }).eq('id', id);
    const { data: ganado, error: eRec } = await (ev.publicacion === 'fallo' ? q.eq('publicacion', 'fallo') : q.is('publicacion', null)).select('id');
    if (eRec) throw new Error(`No pude reclamar la publicación: ${eRec.message}`);
    if (!ganado?.length) { out.fallidas.push({ id, titulo: ev.titulo, motivo: 'Ya está programada.' }); continue; }
    try {
      const firma = await getSupabaseServer().storage.from(BUCKET_PUBLICAR).createSignedUrl(ev.archivo as string, segundosDeFirma(ev.inicio, ahora));
      if (firma.error || !firma.data?.signedUrl) throw new Error('No encontré el archivo: súbelo de nuevo.');
      const postId = await crearPostZernio(ws, cuerpoDelPost(ev, firma.data.signedUrl), randomUUID());
      const { error } = await db.from('calendario_eventos')
        .update({ publicacion: 'programada', post_id: postId, publicacion_motivo: null, updated_at: new Date().toISOString() })
        .eq('id', id).eq('publicacion', 'programando');
      if (error) throw new Error(`Quedó programada en Zernio (${postId}) y no pude anotarlo: ${error.message}`);
      out.programadas.push(id);
    } catch (e) {
      const motivo = motivoDeFallo(e);
      await db.from('calendario_eventos').update({ publicacion: 'fallo', publicacion_motivo: motivo, updated_at: new Date().toISOString() })
        .eq('id', id).eq('publicacion', 'programando');
      out.fallidas.push({ id, titulo: ev.titulo, motivo });
    }
  }
  return out;
}

/** Cancela una publicación programada (la saca de Zernio). Una ya publicada no se cancela: se borra en la red. */
export async function cancelarPublicacion(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const ws = await getWorkspaceActual();
  if (ws == null) return { ok: false, error: 'No hay un negocio elegido.' };
  const ev = await eventoParaPublicar(id);
  if (ev === 'sin-migracion') return { ok: false, error: FALTA_MIGRACION_PUBLICAR };
  if (!ev) return { ok: false, error: 'Ese evento ya no existe.' };
  if (ev.publicacion === 'programando') return { ok: false, error: 'Se está programando ahora: prueba en un minuto.' };
  if (ev.publicacion !== 'programada' || !ev.post_id) return { ok: false, error: ev.publicacion === 'publicada' ? 'Ya se publicó: se borra desde la red.' : 'No está programada.' };
  try {
    await borrarPostZernio(ws, ev.post_id);
  } catch (e) {
    // Si Zernio ya no lo tiene, no hay nada que cancelar allá. Si ya se publicó, lo dice la relectura.
    if (!(e instanceof ZernioError && e.status === 404)) return { ok: false, error: motivoDeFallo(e).replace('no la programó', 'no la canceló') };
  }
  const db = await getTenantDb();
  const { error } = await db.from('calendario_eventos')
    .update({ publicacion: null, post_id: null, publicacion_motivo: null, updated_at: new Date().toISOString() })
    .eq('id', id).eq('publicacion', 'programada');
  if (error) throw new Error(`Se canceló en Zernio y no pude anotarlo: ${error.message}`);
  return { ok: true };
}

/**
 * Relee en Zernio lo programado cuya hora ya pasó (al abrir el Calendario: sin cron). Publicada → el evento pasa a `hecho`
 * con su link; fallo → su motivo. Nunca tira: si Zernio no contesta, queda como estaba y se relee la próxima vez.
 */
export async function releerPublicaciones(ahora = Date.now()): Promise<number> {
  const ws = await getWorkspaceActual();
  if (ws == null) return 0;
  const db = await getTenantDb();
  const { data, error } = await db.from('calendario_eventos').select('id, post_id, inicio')
    .eq('publicacion', 'programada').lte('inicio', new Date(ahora).toISOString()).order('inicio', { ascending: true }).limit(20);
  if (error) return 0;
  let cambiados = 0;
  for (const f of (data ?? []) as Array<{ id: string; post_id: string | null }>) {
    if (!f.post_id) continue;
    try {
      const e = estadoDeZernio(await leerPostZernio(ws, f.post_id));
      if (!e) continue;
      const fila = e.publicacion === 'publicada'
        ? { publicacion: 'publicada', estado: 'hecho', publicacion_url: e.url?.slice(0, 500) ?? null, publicacion_motivo: null }
        : { publicacion: 'fallo', publicacion_motivo: e.motivo };
      const { data: ok } = await db.from('calendario_eventos').update({ ...fila, updated_at: new Date().toISOString() })
        .eq('id', f.id).eq('publicacion', 'programada').select('id');
      if (ok?.length) cambiados++;
    } catch (e) {
      console.warn(`[calendario-publicar] no pude releer el post ${f.post_id} (evento ${f.id}):`, e instanceof Error ? e.message : String(e));
    }
  }
  return cambiados;
}
