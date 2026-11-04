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

import { credDelCliente } from './credenciales';
import { fetchSeguro } from './fetch-seguro';
import { cadenaDeRedes, type CompetidorCadena, type LeidoRed, type ResultadoCadena } from './spy-cadena';
import { lecturaCompartida } from './spy-compartido-db';
import { APIFY_CLAVE_DE_SPY } from './instagram-perfil';
import { leerPerfilesEnLote } from './instagram-perfil-server';
import { RESERVA_DEL_ALTA } from './spy-alta-reglas';
import { hashDeImagen } from './spy-foto-hash';
import { APIFY_ACTOR_REDES, TECHO_USD_POR_CORRIDA_REDES, TOPE_BUSQUEDAS_REDES_POR_DIA } from './spy-otras-redes-reglas';
import { apuntaDeRef, leerCanalCorto, leerCanalesDeVideos } from './spy-youtube';
import { claveDeYoutube } from './youtube';

/** Medido en 6 y 11 s. */
const TOPE_MS = 45_000;
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

/** Una corrida de Google por Apify. null = no se pudo (la pantalla lo dice). */
async function googlear(token: string, consulta: string): Promise<unknown | null> {
  try {
    const params = new URLSearchParams({ maxTotalChargeUsd: String(TECHO_USD_POR_CORRIDA_REDES) });
    const r = await fetch(`https://api.apify.com/v2/acts/${APIFY_ACTOR_REDES}/run-sync-get-dataset-items?${params}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      // UNA página: es lo que se midió, y las redes de la persona salen arriba o no salen.
      body: JSON.stringify({ queries: consulta, resultsPerPage: 10, maxPagesPerQuery: 1, mobileResults: false, saveHtml: false }),
      signal: AbortSignal.timeout(TOPE_MS),
      cache: 'no-store',
    });
    if (r.status < 200 || r.status >= 300) {
      console.error(`[spy-otras-redes] HTTP ${r.status} buscando «${consulta}»`);
      return null;
    }
    return await r.json().catch(() => null);
  } catch (e) {
    console.error(`[spy-otras-redes] «${consulta}»: ${msg(e)}`);
    return null;
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
    if (l?.ok) out.set(ref, { nombre: l.canal.nombre || null, texto: l.canal.descripcion, foto: l.canal.foto });
  }));
  return out;
}

/** Perfiles de Instagram en UNA corrida (con la reserva del alta). */
async function leerPerfiles(ws: number, usuarios: string[]): Promise<Map<string, LeidoRed>> {
  const out = new Map<string, LeidoRed>();
  const perfiles = await leerPerfilesEnLote(usuarios, { ws, reserva: RESERVA_DEL_ALTA });
  for (const [u, l] of perfiles ?? []) {
    if (l.ok) out.set(u, { nombre: l.perfil.nombre, texto: [l.perfil.bio, l.perfil.web].filter(Boolean).join(' '), foto: l.perfil.foto });
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
  const token = await credDelCliente(APIFY_CLAVE_DE_SPY, ws).catch(() => null);
  return cadenaDeRedes(c, {
    textoPropio: () => textosDelCompetidor(ws, c),
    abrirPagina,
    leerCanales,
    leerPerfiles: (us) => leerPerfiles(ws, us),
    googlear: token ? (q) => googlear(token, q) : null,
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
