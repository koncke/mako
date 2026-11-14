import 'server-only';

// =============================================================================
// spy-otras-redes — encontrar sus otras redes por Google, y decidir con criterio si son de ella (3/11 y 4/11/2026)
// =============================================================================
// La red. Lo que se lee y el criterio (`veredictoDe`) están en `./spy-otras-redes-reglas.ts`, con test.
//
// Martín, 4/11: «Lo de "Buscar sus otras redes" debe ser automático, no un botón, de última que te muestre opciones y
// te pregunte si es ese o no... Por la foto, o que razone. Y mucho mejor si hacemos un proceso que vaya buscando hasta
// encontrar efectivamente el usuario correcto».
//
// Cómo «va buscando»: primero por su nombre; si a alguna red le falta un candidato seguro, otra vez por su @. Cada
// candidato se LEE (su canal: la descripción y la foto; su perfil: la bio, la web y la foto) y se compara con lo que
// ya se sabe del competidor: si se enlazan, si la foto es la misma, si el nombre es el mismo.
//
// ⚠️ ESTE ARCHIVO NO ESCRIBE EN LA BASE: devuelve qué es seguro y qué hay que preguntar. Lo seguro lo agrega la
// action con el mismo camino que pegarlo a mano (`agregarCompetidor`), y se puede deshacer.
//
// ⚠️ LO PAGA EL NEGOCIO, con SU clave de Spy (`APIFY_CLAVE_DE_SPY`). Sin clave no se busca. Cada búsqueda de Google son
// US$0,00455; leer los perfiles de Instagram candidatos gasta lecturas del cupo (con la reserva del alta). Los canales
// de YouTube son unidades de cuota, gratis.
// =============================================================================

import { fetchSeguro } from './fetch-seguro';
import { cadenaDeRedes, type CompetidorCadena, type LeidoRed, type ResultadoCadena } from './spy-cadena';
import { lecturaCompartida } from './spy-compartido-db';
import { clavesApifyDeSpy, leerPerfilesEnLote } from './instagram-perfil-server';
import { claveDeHuella, conLaPrimeraConCredito, type ClaveApify } from './spy-claves';
import { RESERVA_DEL_ALTA } from './spy-alta-reglas';
import { hashDeImagen } from './spy-foto-hash';
import { APIFY_ACTOR_REDES, TECHO_USD_POR_CORRIDA_REDES, TOPE_BUSQUEDAS_REDES_POR_DIA } from './spy-otras-redes-reglas';
import {
  CLAVE_RECHAZADA, GOOGLE_PENDIENTE, GOOGLE_SIN_CUPO, PREGUNTAR_CADA_MS, SEGUIR_CORRIDA_MS, TIMEOUT_CORRIDA_S, claveCorridaGoogle, leerCorrida,
  queHacerConLaCorrida, type RespuestaGoogle,
} from './spy-google-corrida';
import { estadoDeCorrida, rechazoLaClave } from './spy-todo-reglas';
import { cambiarSettingSi, getSettingEstricto } from './settings';
import { apuntaDeRef, leerCanalCorto, leerCanalesDeVideos } from './spy-youtube';
import { claveDeYoutube } from './youtube';

/** Medido en 6 y 11 s. */
/** Lo que se espera por una foto: si no llega, se compara sin ella. */
const TOPE_FOTO_MS = 4_000;
const PESO_MAXIMO_FOTO = 3_000_000;
/** Una página de enlaces: tarda poco y pesa poco. Si no contesta, la cadena sigue sin ella. */
const TOPE_PAGINA_MS = 8_000;
const PESO_MAXIMO_PAGINA = 1_500_000;

// El mismo molde que el tope de lecturas (`apifyHoy`, lib/instagram-perfil-server.ts): por negocio y por día.
const g = globalThis as unknown as { __spyRedesHoy?: Map<string, number> };
const redesHoy = (g.__spyRedesHoy ??= new Map<string, number>());
const hoy = () => new Date().toISOString().slice(0, 10);
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export type { CandidatoVerificado } from './spy-cadena';
export type BusquedaRedes = ResultadoCadena;

type Competidor = CompetidorCadena;

/** El dHash de una foto, o null si no se pudo bajar o no es una imagen. Nunca tira. */
async function hashDeFoto(url: string | null | undefined): Promise<string | null> {
  if (!url || !/^https:\/\//.test(url)) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(TOPE_FOTO_MS), referrerPolicy: 'no-referrer', cache: 'no-store' });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (!buf.length || buf.length > PESO_MAXIMO_FOTO) return null;
    return await hashDeImagen(buf);
  } catch {
    return null;
  }
}

const API = 'https://api.apify.com/v2';
/** Lo que se espera a UNA pregunta a Apify (empezar, mirar, leer el dataset). La corrida en sí no tiene este tope. */
const TOPE_PREGUNTA_MS = 15_000;

async function apify(token: string, ruta: string, cuerpo?: unknown): Promise<{ status: number; cuerpo: unknown } | null> {
  try {
    const r = await fetch(`${API}${ruta}`, {
      method: cuerpo === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${token}`, ...(cuerpo === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
      signal: AbortSignal.timeout(TOPE_PREGUNTA_MS), cache: 'no-store',
    });
    return { status: r.status, cuerpo: await r.json().catch(() => null) };
  } catch (e) {
    console.error(`[spy-otras-redes] Apify ${ruta.split('?')[0]}: ${msg(e)}`);
    return null;
  }
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Una búsqueda en Google por Apify, SIN CORTARSE (lib/spy-google-corrida.ts tiene el porqué): se empieza la corrida y se sigue
 * `SEGUIR_CORRIDA_MS`; si no terminó, queda anotada y el próximo pedido la retoma sin pagar otra. Devuelve el cuerpo,
 * `GOOGLE_PENDIENTE`, `GOOGLE_SIN_CUPO` (no quedan búsquedas hoy: sólo se gasta una al EMPEZAR), `CLAVE_RECHAZADA` (401/403) o null (no se pudo).
 */
async function googlear(claves: readonly ClaveApify[], consulta: string, gastar: () => boolean): Promise<RespuestaGoogle | null> {
  const clave = claveCorridaGoogle(consulta);
  const crudo = await getSettingEstricto(clave).catch(() => null);
  let corrida = leerCorrida(crudo);
  let token: string | null = null;
  // Una corrida anotada se lee con la clave que la empezó: con otra cuenta de Apify no existe. Si esa clave ya no está, se olvida.
  if (corrida && queHacerConLaCorrida(corrida, Date.now()) === 'retomar') {
    token = claveDeHuella(claves, corrida.clave)?.token ?? null;
    if (!token) corrida = null;
  }
  if (!corrida || queHacerConLaCorrida(corrida, Date.now()) === 'empezar') {
    if (!gastar()) return GOOGLE_SIN_CUPO;
    const q = new URLSearchParams({ maxTotalChargeUsd: String(TECHO_USD_POR_CORRIDA_REDES), timeout: String(TIMEOUT_CORRIDA_S) });
    // UNA página: es lo que se midió, y las redes de la persona salen arriba o no salen.
    // Varias claves de Spy (5/11/2026): la primera con crédito; un «sin crédito» pasa a la siguiente (lib/spy-claves.ts).
    const r = await conLaPrimeraConCredito(claves, async (k) => (await apify(k.token, `/acts/${APIFY_ACTOR_REDES}/runs?${q}`, { queries: consulta, resultsPerPage: 10, maxPagesPerQuery: 1, mobileResults: false, saveHtml: false })) ?? { status: 0, cuerpo: null });
    const d = (r?.cuerpo as { data?: { id?: unknown; defaultDatasetId?: unknown } } | null)?.data;
    if (r && rechazoLaClave(r.status)) {
      console.error(`[spy-otras-redes] Apify rechazó la clave ${r.clave.slot}: HTTP ${r.status}`);
      return CLAVE_RECHAZADA;
    }
    if (!r || r.status < 200 || r.status >= 300 || typeof d?.id !== 'string' || typeof d?.defaultDatasetId !== 'string') {
      console.error(`[spy-otras-redes] no pude empezar la búsqueda: HTTP ${r?.status ?? '—'} (clave ${r?.clave.slot ?? '—'})`);
      return null;
    }
    token = r.clave.token;
    corrida = { run: d.id, dataset: d.defaultDatasetId, desde: new Date().toISOString(), clave: r.clave.huella };
    // Anotarla es lo que deja retomarla sin pagar: si no se pudo, se sigue igual (lo peor es una corrida más mañana).
    await cambiarSettingSi(clave, crudo, JSON.stringify(corrida)).catch(() => false);
  }
  if (!corrida || !token) return null;
  const hasta = Date.now() + SEGUIR_CORRIDA_MS;
  for (;;) {
    const r = await apify(token, `/actor-runs/${corrida.run}`);
    // La clave con la que empezó ya no entra (la cambiaron con la corrida a medias): es la clave, no «no terminó».
    if (r && rechazoLaClave(r.status)) return CLAVE_RECHAZADA;
    const status = String((r?.cuerpo as { data?: { status?: unknown } } | null)?.data?.status ?? '');
    // No poder preguntar no es «terminó»: se vuelve a preguntar hasta el tope.
    if (r && r.status === 200 && status && estadoDeCorrida(status) !== 'corre') {
      const items = await apify(token, `/datasets/${corrida.dataset}/items?clean=true&format=json`);
      if (items && items.status === 200 && Array.isArray(items.cuerpo)) return items.cuerpo;
      return null;
    }
    if (Date.now() + PREGUNTAR_CADA_MS > hasta) return GOOGLE_PENDIENTE;
    await espera(PREGUNTAR_CADA_MS);
  }
}

/** Una página de enlaces (beacons, linktree…), como texto. null si no se pudo: un fallo no corta la cadena. */
async function abrirPagina(url: string): Promise<string | null> {
  try {
    const r = await fetchSeguro(url, { signal: AbortSignal.timeout(TOPE_PAGINA_MS), headers: { 'user-agent': 'Mozilla/5.0 (compatible; MaKoBot/1.0; +https://hola-mako.com)' } });
    if (r.status < 200 || r.status >= 300) return null;
    return (await r.text()).slice(0, PESO_MAXIMO_PAGINA);
  } catch (e) {
    console.error(`[spy-otras-redes] la página de enlaces ${url}: ${msg(e)}`);
    return null;
  }
}

/** Canales por su ref (`@handle`, `UC…`): `channels.list`, 1 unidad cada uno, gratis para el negocio. */
async function leerCanales(refs: string[]): Promise<Map<string, LeidoRed>> {
  const out = new Map<string, LeidoRed>();
  const clave = await claveDeYoutube().catch(() => null);
  if (!clave) return out;
  await Promise.all(refs.map(async (ref) => {
    const apunta = apuntaDeRef(ref);
    if (!apunta) return;
    const l = await leerCanalCorto(apunta, clave, fetch).catch(() => null);
    if (l?.ok) out.set(ref, { nombre: l.canal.nombre || null, texto: l.canal.descripcion, foto: l.canal.foto, id: l.canal.id || null, seguidores: l.canal.suscriptores });
  }));
  return out;
}

/** Perfiles de Instagram en UNA corrida (con la reserva del alta). */
async function leerPerfiles(ws: number, usuarios: string[]): Promise<Map<string, LeidoRed> | typeof CLAVE_RECHAZADA> {
  const out = new Map<string, LeidoRed>();
  const perfiles = await leerPerfilesEnLote(usuarios, { ws, reserva: RESERVA_DEL_ALTA });
  // `sin-permiso` es el 401/403 de Apify (lib/instagram-perfil-server.ts): la clave, no «ese perfil no existe» (14/11/2026).
  if ([...(perfiles?.values() ?? [])].some((l) => !l.ok && l.motivo === 'sin-permiso')) return CLAVE_RECHAZADA;
  for (const [u, l] of perfiles ?? []) {
    if (l.ok) out.set(u, { nombre: l.perfil.nombre, texto: [l.perfil.bio, l.perfil.web].filter(Boolean).join(' '), foto: l.perfil.foto, id: u.toLowerCase(), seguidores: l.perfil.seguidores ?? null });
  }
  return out;
}

/**
 * Lo que el competidor ya dice de sí mismo: su bio de Instagram y la descripción de su canal.
 *
 * ⚠️ SIN PAGAR OTRA LECTURA: la bio sale de la lectura compartida que dejó la lectura de su perfil (`spy_lecturas_canal`,
 * con su `bio` y su `web` desde el 4/11/2026). Sólo si no está, se lee el perfil.
 */
async function textosDelCompetidor(ws: number, c: Competidor): Promise<string> {
  const partes: string[] = [];
  let bio: string | null = null;
  if (c.instagram) {
    const comp = await lecturaCompartida('instagram', c.instagram).catch(() => null);
    const p = comp?.perfil ?? null;
    const t = [p?.bio, p?.web].filter((x): x is string => typeof x === 'string' && !!x.trim());
    if (p && ('bio' in p || 'web' in p)) bio = t.join(' ');
  }
  const clave = c.youtube_id ? await claveDeYoutube().catch(() => null) : null;
  const apunta = c.youtube_id ? apuntaDeRef(c.youtube_id) : null;
  const [ig, yt] = await Promise.all([
    c.instagram && bio == null ? leerPerfilesEnLote([c.instagram], { ws, reserva: RESERVA_DEL_ALTA }) : Promise.resolve(null),
    apunta && clave ? leerCanalCorto(apunta, clave, fetch).catch(() => null) : Promise.resolve(null),
  ]);
  if (bio != null) partes.push(bio);
  const p = ig?.get(c.instagram as string);
  if (p?.ok) partes.push(p.perfil.bio, p.perfil.web ?? '');
  if (yt?.ok) partes.push(yt.canal.descripcion);
  return partes.filter(Boolean).join(' ');
}

/**
 * Sus otras redes y su web, en cadena (lib/spy-cadena.ts tiene el recorrido y el porqué). Acá se ponen las lecturas de
 * verdad: lo que cuesta Apify (Google, los perfiles de Instagram) sale con la clave de Spy del negocio.
 */
export async function buscarOtrasRedes(ws: number, c: Competidor): Promise<BusquedaRedes> {
  // Las claves de Spy del negocio (5/11/2026, varias): la primera con crédito, en `googlear`.
  const claves = await clavesApifyDeSpy(ws);
  return cadenaDeRedes(c, {
    textoPropio: () => textosDelCompetidor(ws, c),
    abrirPagina,
    leerCanales,
    leerPerfiles: (us) => leerPerfiles(ws, us),
    googlear: claves.length ? (q, gastar) => googlear(claves, q, gastar) : null,
    gastarBusqueda: () => {
      const cuenta = `${ws}|${hoy()}`;
      const usadas = redesHoy.get(cuenta) ?? 0;
      if (usadas >= TOPE_BUSQUEDAS_REDES_POR_DIA) return false;
      redesHoy.set(cuenta, usadas + 1);
      return true;
    },
    canalesDeVideos: async (ids) => {
      const clave = await claveDeYoutube().catch(() => null);
      return clave ? (await leerCanalesDeVideos(ids, clave, fetch)).canales : [];
    },
    hashDeFoto,
  });
}
