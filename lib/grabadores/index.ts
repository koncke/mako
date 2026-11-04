// =============================================================================
// grabadores — LA puerta para leer reuniones grabadas, de cualquier grabador (server)
// =============================================================================
// Todo lo que lee reuniones (el Plan, el Closing, Customer Success, el CRM, la API de MaKo) pasa por acá y no por un
// grabador: «¿qué reuniones hay?» junta las de todos los grabadores que el negocio tiene conectados, y «leeme ésta»
// le pregunta al que la tiene. La forma es una sola (lib/grabadores/reunion.ts).
//
// ⚠️ UN GRABADOR CAÍDO NO TAPA A LOS OTROS, Y TAMPOCO SE CALLA. Con dos grabadores conectados, que uno no conteste no
// vacía la lista: vuelven las del otro y el fallo viaja en `fallos`, para que quien llama lo diga. Si fallan TODOS,
// tira: «no pude leer» no es «no hay reuniones» (la regla de lib/fathom-auto.ts y del cron del Plan).
// =============================================================================

import 'server-only';
import { credWs, credDelCliente, integracionConectada } from '../credenciales';
import { CLAVES_DE_LECTURA } from './catalogo';
import { getTenantDb } from '../workspace';
import { GRABADORES, esClaveDeFathom, leerRef, type GrabadorId, type Reunion, type TurnoReunion } from './reunion';
import { ReunionSinRefError, GrabadorSinConectarError } from './errores';
import type { Lector, PaginaGrabador } from './lector';
import { lectorFathom } from './fathom';
import { lectorTldv } from './tldv';
import { lectorFireflies } from './fireflies';
import { lectorZoom } from './zoom';
import { lectorOtter } from './otter';

/**
 * Los grabadores con lector. Los del catálogo que no están acá (Loom, Read AI, Google Meet: `conectable: false` en
 * lib/grabadores/catalogo.ts) se muestran en Integraciones y no se leen: su tarjeta dice por qué.
 */
const LECTORES: Partial<Record<GrabadorId, Lector>> = {
  fathom: lectorFathom,
  tldv: lectorTldv,
  fireflies: lectorFireflies,
  zoom: lectorZoom,
  otter: lectorOtter,
};

/** Los que MaKo sabe leer, en el orden del catálogo. Es la lista que recorren los crons (`correrRonda`). */
export const GRABADORES_QUE_SE_LEEN: readonly GrabadorId[] = GRABADORES.filter((g) => !!LECTORES[g]);

export type FalloGrabador = { grabador: GrabadorId; error: string };

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/**
 * Los grabadores CONECTADOS de este negocio (o de `ws`): todos los campos obligatorios de su tarjeta. Es la vara de las
 * puertas y de los crons (`correrRonda`). «No pude evaluarlo» = no conectado, como la ronda.
 */
export async function grabadoresConectados(ws?: number): Promise<GrabadorId[]> {
  const conectados = await Promise.all(GRABADORES_QUE_SE_LEEN.map((g) => integracionConectada(g, ws).catch(() => false)));
  return GRABADORES_QUE_SE_LEEN.filter((_, i) => conectados[i]);
}

/** ¿Tiene el negocio ALGÚN grabador conectado? Es lo que antes era `integracionConectada('fathom')`. */
export async function hayGrabadorConectado(ws?: number): Promise<boolean> {
  return (await grabadoresConectados(ws)).length > 0;
}

/**
 * Los grabadores que se pueden LEER: los que tienen las claves de su lector (`CLAVES_DE_LECTURA`). Fathom con `credWs`,
 * como lo leía siempre lib/fathom-api.ts (el ws1 cae a su entorno); los demás, sólo con la clave del negocio.
 */
async function grabadoresParaLeer(ws?: number): Promise<GrabadorId[]> {
  const tiene = await Promise.all(GRABADORES_QUE_SE_LEEN.map(async (g) => {
    const claves = CLAVES_DE_LECTURA[g] ?? [];
    if (!claves.length) return false;
    const leer = g === 'fathom' ? credWs : credDelCliente;
    const vals = await Promise.all(claves.map((k) => leer(k, ws).catch(() => null)));
    return vals.every((v) => !!v && !!v.trim());
  }));
  return GRABADORES_QUE_SE_LEEN.filter((_, i) => tiene[i]);
}

/**
 * Sin ningún grabador que leer, TIRA (como tiraba Fathom sin su key, «FATHOM_API_KEY no configurada»): una lista vacía
 * se leería «no hubo reuniones», y el enganche al CRM y el Closing lo contarían como cero (la mentira de lib/fathom-auto.ts).
 */
const SIN_GRABADOR = 'No hay un grabador de reuniones conectado (Fathom, tl;dv, Fireflies, Zoom u Otter).';

function lector(g: GrabadorId): Lector {
  const l = LECTORES[g];
  if (!l) throw new GrabadorSinConectarError(g, `MaKo todavía no lee reuniones de ${g}.`);
  return l;
}

/**
 * Anota de qué grabador es cada clave negativa (tabla `grabador_reuniones`): es lo que deja volver a abrir una reunión
 * desde su número. Best-effort: sin la tabla (la migración sin aplicar) no frena nada. Las de Fathom no se anotan.
 */
async function anotarReuniones(reuniones: readonly Reunion[]): Promise<void> {
  const filas = reuniones
    .filter((r) => r.grabador !== 'fathom' && Number.isSafeInteger(r.clave) && r.clave < 0 && r.id)
    .map((r) => ({ clave: r.clave, grabador: r.grabador, grabacion_id: r.id.slice(0, 200), titulo: r.titulo.slice(0, 300), inicio: r.inicio }));
  if (!filas.length) return;
  try {
    const db = await getTenantDb();
    const { error } = await db.from('grabador_reuniones').upsert(filas, { onConflict: 'workspace_id,clave', ignoreDuplicates: true });
    if (error) console.warn(`[grabadores] no pude anotar ${filas.length} clave(s): ${error.message}`);
  } catch (e) { console.warn(`[grabadores] no pude anotar las claves: ${msg(e)}`); }
}

/** El cursor de la lista JUNTA: el de cada grabador, por nombre. Uno vencido o de otra versión = empezar de cero. */
function leerCursores(c: string | null | undefined): Partial<Record<GrabadorId, string>> | null {
  if (!c) return null;
  try {
    const o = JSON.parse(c) as unknown;
    if (o && typeof o === 'object' && !Array.isArray(o)) return o as Partial<Record<GrabadorId, string>>;
  } catch { /* un cursor viejo de Fathom (texto suelto): es de Fathom */ }
  return { fathom: c };
}

export type PaginaReuniones = { reuniones: Reunion[]; cursor: string | null; fallos: FalloGrabador[] };

/**
 * Las reuniones recientes de TODOS los grabadores conectados, de la más nueva a la más vieja (metadata, sin
 * transcripción). `desde` = cuándo aparecieron en el grabador. `cursor` = el de la página anterior («cargar más»):
 * sigue sólo con los grabadores que tenían más.
 */
export async function listarReunionesRecientes(opts: { desde?: string; limite?: number; cursor?: string | null; conAcciones?: boolean; solo?: GrabadorId } = {}): Promise<PaginaReuniones> {
  const cursores = leerCursores(opts.cursor);
  const conectados = opts.solo ? [opts.solo] : await grabadoresParaLeer();
  if (!conectados.length) throw new GrabadorSinConectarError('fathom', SIN_GRABADOR);
  const aLeer = cursores ? conectados.filter((g) => cursores[g]) : conectados;
  const fallos: FalloGrabador[] = [];
  const paginas: Array<{ g: GrabadorId; p: PaginaGrabador | null; e?: unknown }> = await Promise.all(aLeer.map(async (g) => {
    try {
      return { g, p: await lector(g).listar({ desde: opts.desde, limite: opts.limite, cursor: cursores?.[g] ?? null, conAcciones: opts.conAcciones }) };
    } catch (e) {
      fallos.push({ grabador: g, error: msg(e) });
      return { g, p: null, e };
    }
  }));
  if (aLeer.length && fallos.length === aLeer.length) throw paginas.find((x) => x.e)?.e ?? new Error(fallos[0].error);
  const reuniones = paginas.flatMap((x) => x.p?.reuniones ?? [])
    .sort((a, b) => (b.inicio ?? '').localeCompare(a.inicio ?? ''));
  const siguientes: Partial<Record<GrabadorId, string>> = {};
  for (const x of paginas) if (x.p?.cursor) siguientes[x.g] = x.p.cursor;
  await anotarReuniones(reuniones);
  return { reuniones, cursor: Object.keys(siguientes).length ? JSON.stringify(siguientes) : null, fallos };
}

/** TODO el histórico de todos los grabadores conectados (metadata). Mismas reglas de fallo que la lista reciente. */
export async function listarTodasLasReuniones(opts: { maxPaginas?: number } = {}): Promise<{ reuniones: Reunion[]; fallos: FalloGrabador[] }> {
  const conectados = await grabadoresParaLeer();
  if (!conectados.length) throw new GrabadorSinConectarError('fathom', SIN_GRABADOR);
  const fallos: FalloGrabador[] = [];
  let primerError: unknown = null;
  const listas = await Promise.all(conectados.map(async (g) => {
    try { return await lector(g).listarTodas({ maxPaginas: opts.maxPaginas }); }
    catch (e) { fallos.push({ grabador: g, error: msg(e) }); primerError ??= e; return [] as Reunion[]; }
  }));
  if (conectados.length && fallos.length === conectados.length) throw primerError;
  const reuniones = listas.flat();
  await anotarReuniones(reuniones);
  return { reuniones, fallos };
}

type RefLike = string | { grabador: GrabadorId; id: string };
const comoRef = (ref: RefLike): { grabador: GrabadorId; id: string } => {
  const r = typeof ref === 'string' ? leerRef(ref) : ref;
  if (!r) throw new Error(`No es la referencia de una reunión: ${String(ref).slice(0, 80)}`);
  return r;
};

/** UNA reunión con su transcripción y su resumen. `meta` = la del listado, para no volver a pedirla. */
export async function leerReunion(ref: RefLike, meta?: Reunion): Promise<Reunion> {
  const r = comoRef(ref);
  // La Grabadora de MaKo (04/11/2026) no es un grabador de afuera: su llamada vive en `llamadas_grabadas`.
  if (r.grabador === 'grabadora') return (await import('./grabadora')).leerGrabadora(r.id);
  return lector(r.grabador).leer(r.id, meta);
}

/** Sólo la transcripción de una reunión. */
export async function leerTranscripcion(ref: RefLike): Promise<TurnoReunion[]> {
  const r = comoRef(ref);
  if (r.grabador === 'grabadora') return (await import('./grabadora')).transcripcionDeGrabadora(r.id);
  return lector(r.grabador).leerTranscripcion(r.id);
}

/**
 * De la clave numérica a la reunión: positiva = Fathom (su recording_id); negativa = la tabla `grabador_reuniones`.
 * `null` = no está anotada. Tira si no pudo leer (la base caída no es «no existe»).
 */
export async function refDeClave(clave: number): Promise<{ grabador: GrabadorId; id: string } | null> {
  if (esClaveDeFathom(clave)) return { grabador: 'fathom', id: String(clave) };
  if (!Number.isSafeInteger(clave) || clave >= 0) return null;
  const db = await getTenantDb();
  const { data, error } = await db.from('grabador_reuniones').select('grabador, grabacion_id').eq('clave', clave).maybeSingle();
  if (error) {
    // Sin la tabla (la migración sin aplicar) no hay de dónde volver: es lo mismo que no tenerla anotada.
    if (error.code === '42P01' || /grabador_reuniones/.test(error.message ?? '')) return null;
    throw new Error(`grabador_reuniones: ${error.message}`);
  }
  const f = data as { grabador?: string; grabacion_id?: string } | null;
  const ref = f?.grabador && f.grabacion_id ? leerRef(`${f.grabador}:${f.grabacion_id}`) : null;
  return ref;
}

/** La ref en texto de UNA clave («fathom:123», «loom:abc»), o null si no se puede saber. Tira si no pudo leer. */
export async function refTextoDeClave(clave: number): Promise<string | null> {
  const r = await refDeClave(clave);
  return r ? `${r.grabador}:${r.id}` : null;
}

/**
 * Las refs en texto («fathom:123», «loom:abc») de varias claves, con UNA consulta. La que no se puede resolver no
 * aparece en el mapa (sin la tabla, sólo vuelven las de Fathom). Tira si no pudo leer.
 */
export async function refsDeClaves(claves: readonly number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  const negativas: number[] = [];
  for (const c of claves) {
    if (esClaveDeFathom(c)) out.set(c, `fathom:${c}`);
    else if (Number.isSafeInteger(c) && c < 0) negativas.push(c);
  }
  if (!negativas.length) return out;
  const db = await getTenantDb();
  const { data, error } = await db.from('grabador_reuniones').select('clave, grabador, grabacion_id').in('clave', [...new Set(negativas)]);
  if (error) {
    if (error.code === '42P01' || /grabador_reuniones/.test(error.message ?? '')) return out;
    throw new Error(`grabador_reuniones: ${error.message}`);
  }
  for (const f of (data ?? []) as Array<{ clave: number | string; grabador: string; grabacion_id: string }>) {
    const ref = leerRef(`${f.grabador}:${f.grabacion_id}`);
    if (ref) out.set(Number(f.clave), `${ref.grabador}:${ref.id}`);
  }
  return out;
}

/**
 * La ficha de UNA reunión sin transcripción (`Lector.meta`), para el aviso de un grabador cuya transcripción todavía no
 * está. Un grabador sin esa lectura: null.
 */
export async function leerFicha(ref: RefLike): Promise<Reunion | null> {
  const r = comoRef(ref);
  const l = lector(r.grabador);
  return l.meta ? l.meta(r.id) : null;
}

/** La reunión de una clave, con su contenido. Sin forma de volver a ella: `ReunionSinRefError`. */
export async function leerReunionPorClave(clave: number): Promise<Reunion> {
  const ref = await refDeClave(clave);
  if (!ref) throw new ReunionSinRefError(clave);
  return leerReunion(ref);
}

/** La transcripción de una clave. */
export async function leerTranscripcionPorClave(clave: number): Promise<TurnoReunion[]> {
  const ref = await refDeClave(clave);
  if (!ref) throw new ReunionSinRefError(clave);
  return leerTranscripcion(ref);
}
