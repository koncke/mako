import 'server-only';

// =============================================================================
// spy-buscar — la red de la búsqueda de Spy por red (4/11/2026)
// =============================================================================
// Lo puro (qué se busca, cómo se lee Google, cómo se ordena) está en `./spy-buscar-reglas.ts`, con test. Acá vive lo
// que sale a la red: Google por Apify, el buscador de Instagram por Apify, la lectura de un @ y la de un canal.
//
// ⚠️ NADA DE ACÁ ESCRIBE EN LA BASE. Devuelve CANDIDATOS: buscar por nombre trae a otras personas, y sólo el «Sí,
// agregar» de la pantalla guarda (Martín, 2/11: «súper importante que lo valides»).
//
// ⚠️ LO PAGA EL NEGOCIO, con SU clave de Spy (`APIFY_CLAVE_DE_SPY`). Sin clave no se busca por nombre: la plataforma no
// le paga búsquedas a nadie. Lo de YouTube sale con `claveDeYoutube` (la del negocio y, si no tiene, la de la
// plataforma), que son unidades de cuota gratis: nunca `search.list` (lib/spy-youtube.ts explica por qué).
// =============================================================================

import { credDelCliente } from './credenciales';
import { APIFY_CLAVE_DE_SPY } from './instagram-perfil';
import { gastarBusquedaDeSpy, leerPerfilesEnLote, leerPerfilInstagram } from './instagram-perfil-server';
import { normalizarBusqueda } from './instagram-buscar';
import { buscarPerfilesApify } from './instagram-buscar-apify';
import { APIFY_ACTOR_REDES, TECHO_USD_POR_CORRIDA_REDES } from './spy-otras-redes-reglas';
import {
  canalesDeGoogle, consultasDeNombre, perfilesDeGoogle, videosDeGoogle, POR_RED, type CanalHallado, type PerfilHallado,
} from './spy-buscar-reglas';
import { apuntaDeRef, leerCanalCorto, leerCanalesDeVideos, type CanalYoutube } from './spy-youtube';
import { claveDeYoutube } from './youtube';

/** Lo que tarda Google por Apify: medido en 6 y 11 s el 3/11/2026, con una página. Con dos, un poco más. */
const TOPE_GOOGLE_MS = 45_000;
/** Lo encontrado vive media hora: escribir otra cosa y volver no se paga dos veces. */
const TTL_MS = 30 * 60_000;
const TOPE_CACHE = 400;

type Entrada = { hasta: number; valor: unknown };
const g = globalThis as unknown as { __spyBuscar?: Map<string, Entrada> };
const cache = (g.__spyBuscar ??= new Map<string, Entrada>());
function leerCache<T>(k: string): T | undefined {
  const e = cache.get(k);
  if (!e) return undefined;
  if (e.hasta <= Date.now()) { cache.delete(k); return undefined; }
  return e.valor as T;
}
function guardarCache(k: string, valor: unknown): void {
  cache.delete(k);
  cache.set(k, { hasta: Date.now() + TTL_MS, valor });
  while (cache.size > TOPE_CACHE) cache.delete(cache.keys().next().value as string);
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Por qué una búsqueda volvió vacía, si no es «no había nadie»: la pantalla lo dice en vez de «no encontré». */
export type PorQueVacio = 'sin-clave' | 'limite' | 'fallo' | null;

/** ¿El negocio tiene la clave de Spy? Sin ella no se busca por nombre (y la pantalla ofrece conectarla). */
export async function tieneClaveDeSpy(ws: number): Promise<boolean> {
  return !!(await credDelCliente(APIFY_CLAVE_DE_SPY, ws).catch(() => null));
}

/** Un canal de YouTube como fila. */
const canalHallado = (c: CanalYoutube, ref: string): CanalHallado => ({
  ref: c.handle ?? (c.id || ref), nombre: c.nombre || null, foto: c.foto, suscriptores: c.suscriptores,
  url: c.handle ? `https://www.youtube.com/${c.handle}` : `https://www.youtube.com/channel/${c.id}`,
});

/**
 * Un canal por lo que guarda el alta (`UC…`, `@handle`, `user:x`): 1 unidad de cuota. `canal: null` con `vacio: null` =
 * no existe; con `vacio`, no se pudo preguntar (sin la clave de YouTube, la cuota, la red) y la pantalla lo dice.
 *
 * ⚠️ Antes devolvía null en los dos casos: sin la clave, el grupo de YouTube quedaba vacío sin decir nada, y la lista
 * parecía completa (Martín, 4/11: «ya no busca a usuarios de YouTube»).
 */
export async function leerCanalHallado(ref: string): Promise<{ canal: CanalHallado | null; vacio: 'sin-clave' | 'fallo' | null }> {
  const apunta = apuntaDeRef(ref);
  if (!apunta) return { canal: null, vacio: null };
  const k = `yt:${ref.toLowerCase()}`;
  const ya = leerCache<CanalHallado | null>(k);
  if (ya !== undefined) return { canal: ya, vacio: null };
  const clave = await claveDeYoutube().catch(() => null);
  if (!clave) return { canal: null, vacio: 'sin-clave' };
  try {
    const l = await leerCanalCorto(apunta, clave, fetch);
    const c = l.ok ? canalHallado(l.canal, ref) : null;
    // «No existe» se recuerda; un fallo de la cuota o de la red no (la próxima vuelve a preguntar).
    if (l.ok || l.motivo === 'no-esta') guardarCache(k, c);
    return { canal: c, vacio: l.ok || l.motivo === 'no-esta' ? null : 'fallo' };
  } catch (e) {
    console.error(`[spy-buscar] el canal ${ref}: ${msg(e)}`);
    return { canal: null, vacio: 'fallo' };
  }
}

/**
 * Los canales de los VIDEOS que trajo Google (`videosDeGoogle`): `videos.list` dice de qué canal es cada uno (1 unidad
 * por todos) y cada canal se lee con su foto (1 unidad cada uno). Sin los que ya vinieron como canal.
 */
async function canalesDeLosVideos(ids: readonly string[], ya: ReadonlySet<string>, cuantos: number): Promise<{ canales: CanalHallado[]; vacio: 'sin-clave' | 'fallo' | null }> {
  if (!ids.length || cuantos <= 0) return { canales: [], vacio: null };
  const clave = await claveDeYoutube().catch(() => null);
  if (!clave) return { canales: [], vacio: 'sin-clave' };
  try {
    const r = await leerCanalesDeVideos(ids, clave, fetch);
    if (!r.ok) return { canales: [], vacio: 'fallo' };
    const nuevos = r.canales.filter((c) => !ya.has(c.id.toLowerCase())).slice(0, cuantos);
    const canales = await Promise.all(nuevos.map(async (c) => {
      const l = await leerCanalHallado(c.id);
      return l.canal ?? { ref: c.id, url: `https://www.youtube.com/channel/${c.id}`, nombre: c.nombre, foto: null, suscriptores: null };
    }));
    return { canales, vacio: null };
  } catch (e) {
    console.error(`[spy-buscar] los canales de ${ids.length} videos: ${msg(e)}`);
    return { canales: [], vacio: 'fallo' };
  }
}

/**
 * Google, por nombre: los perfiles de Instagram y los canales de YouTube en UNA corrida de dos páginas (US$0,009).
 * Google ordena por popularidad, que es lo que el buscador de Instagram hace con sesión y un scraper no puede hacer.
 * Los canales salen con su foto (una unidad de cuota cada uno); los perfiles, con los seguidores que Google escribe en
 * su descripción, y sin foto: la completa `completarPerfiles`.
 */
export async function buscarEnGoogle(ws: number, nombre: string): Promise<{ instagram: PerfilHallado[]; youtube: CanalHallado[]; vacio: PorQueVacio; vacioYoutube?: 'sin-clave' | 'fallo' | null }> {
  const consulta = consultasDeNombre(nombre);
  if (!consulta) return { instagram: [], youtube: [], vacio: null };
  const k = `g:${ws}:${normalizarBusqueda(nombre)}`;
  const ya = leerCache<{ instagram: PerfilHallado[]; youtube: CanalHallado[] }>(k);
  if (ya) return { ...ya, vacio: null };
  const token = await credDelCliente(APIFY_CLAVE_DE_SPY, ws).catch(() => null);
  if (!token) return { instagram: [], youtube: [], vacio: 'sin-clave' };
  if (!gastarBusquedaDeSpy(ws)) return { instagram: [], youtube: [], vacio: 'limite' };
  try {
    const params = new URLSearchParams({ maxTotalChargeUsd: String(TECHO_USD_POR_CORRIDA_REDES) });
    const r = await fetch(`https://api.apify.com/v2/acts/${APIFY_ACTOR_REDES}/run-sync-get-dataset-items?${params}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries: consulta, resultsPerPage: 10, maxPagesPerQuery: 1, mobileResults: false, saveHtml: false }),
      signal: AbortSignal.timeout(TOPE_GOOGLE_MS),
      cache: 'no-store',
    });
    if (r.status < 200 || r.status >= 300) {
      console.error(`[spy-buscar] Google HTTP ${r.status} buscando «${nombre}»`);
      return { instagram: [], youtube: [], vacio: 'fallo' };
    }
    const cuerpo = await r.json().catch(() => null);
    const instagram = perfilesDeGoogle(cuerpo);
    // La foto de cada canal: en paralelo, y un canal que no se pudo leer queda con lo que dijo Google.
    const directos = await Promise.all(canalesDeGoogle(cuerpo).map(async (c) => {
      const leido = (await leerCanalHallado(c.ref)).canal;
      return leido ? { ...c, ...leido, suscriptores: leido.suscriptores ?? c.suscriptores, nombre: leido.nombre ?? c.nombre } : c;
    }));
    // Lo que más trae Google de YouTube son VIDEOS: se ofrece el canal de cada uno.
    // Sin repetir: un canal que vino como enlace y como video sale una vez (se compara por lo que guarda el alta).
    const ya = new Set(directos.map((c) => c.ref.toLowerCase()));
    const deVideos = await canalesDeLosVideos(videosDeGoogle(cuerpo), ya, POR_RED - directos.length);
    const youtube = [...directos, ...deVideos.canales.filter((c, i, xs) => !ya.has(c.ref.toLowerCase()) && xs.findIndex((x) => x.ref.toLowerCase() === c.ref.toLowerCase()) === i)];
    // Un fallo leyendo los videos no se guarda: la próxima búsqueda vuelve a probar.
    if (!deVideos.vacio) guardarCache(k, { instagram, youtube });
    return { instagram, youtube, vacio: null, vacioYoutube: youtube.length ? null : deVideos.vacio };
  } catch (e) {
    console.error(`[spy-buscar] Google «${nombre}»: ${msg(e)}`);
    return { instagram: [], youtube: [], vacio: 'fallo' };
  }
}

/** El buscador de Instagram (Apify, ~20 s, US$0,012). Trae a los que Google no conoce: cuentas nuevas o chicas. */
export async function buscarEnInstagram(ws: number, nombre: string): Promise<{ perfiles: PerfilHallado[]; vacio: PorQueVacio }> {
  const k = `ig:${ws}:${normalizarBusqueda(nombre)}`;
  const ya = leerCache<PerfilHallado[]>(k);
  if (ya) return { perfiles: ya, vacio: null };
  const token = await credDelCliente(APIFY_CLAVE_DE_SPY, ws).catch(() => null);
  if (!token) return { perfiles: [], vacio: 'sin-clave' };
  // Cada corrida cuenta una del cupo de búsquedas: una búsqueda por nombre gasta dos (ésta y la de Google).
  if (!gastarBusquedaDeSpy(ws)) return { perfiles: [], vacio: 'limite' };
  const hallados = await buscarPerfilesApify(nombre, token);
  const perfiles = hallados.map((p) => ({ ...p, seguidores: null }));
  if (perfiles.length) guardarCache(k, perfiles);
  return { perfiles, vacio: null };
}

/** Un perfil de Instagram como fila, con lo que se leyó. */
const perfilHallado = (p: { usuario: string; nombre: string | null; foto: string | null; seguidores: number | null; bio?: string; web?: string | null }): PerfilHallado => ({
  usuario: p.usuario, nombre: p.nombre, foto: p.foto, seguidores: p.seguidores, bio: p.bio ? p.bio.slice(0, 220) : null, web: p.web ?? null,
});

/**
 * Un @ exacto, lo más rápido que se puede: con la clave de Spy primero (es la única que ve cualquier cuenta pública), y
 * la Meta del negocio sólo si no hay clave.
 *
 * ⚠️ ANTES SE PREGUNTABA EN FILA: la Meta del negocio (hasta 12 s), la de la plataforma, Google y recién Apify. Martín,
 * 4/11: «busqué @den.borgg exacto y demoró bastante». De once negocios con Meta, uno tiene permisos de Instagram: las
 * esperas de adelante casi nunca traían nada.
 */
export async function leerExacto(ws: number, usuario: string, opts: { reserva?: number } = {}): Promise<{ perfil: PerfilHallado | null; vacio: PorQueVacio }> {
  const conClave = await tieneClaveDeSpy(ws);
  const l = await leerPerfilInstagram(usuario, {
    ws, conPiezas: false, reservaApify: opts.reserva,
    fuentes: conClave ? ['apify-spy', 'meta-negocio'] : ['meta-negocio', 'meta-plataforma'],
  });
  if (l.ok) return { perfil: perfilHallado(l.perfil), vacio: null };
  return { perfil: null, vacio: l.motivo === 'limite' ? 'limite' : !conClave ? 'sin-clave' : l.motivo === 'no-esta' ? null : 'fallo' };
}

/** Las primeras filas, completadas con su foto y sus seguidores en UNA corrida. */
export async function completarPerfiles(ws: number, usuarios: readonly string[], reserva: number): Promise<{ perfiles: PerfilHallado[]; limite: boolean }> {
  const leidos = await leerPerfilesEnLote(usuarios, { ws, reserva });
  const perfiles: PerfilHallado[] = [];
  let limite = false;
  for (const [, l] of leidos) {
    if (l.ok) perfiles.push(perfilHallado(l.perfil));
    else if (l.motivo === 'limite') limite = true;
  }
  return { perfiles, limite };
}
