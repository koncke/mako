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
import { APIFY_CLAVE_DE_SPY } from './instagram-perfil';
import { leerPerfilesEnLote } from './instagram-perfil-server';
import { RESERVA_DEL_ALTA } from './spy-alta-reglas';
import { hashDeImagen } from './spy-foto-hash';
import {
  APIFY_ACTOR_REDES, TECHO_USD_POR_CORRIDA_REDES, TOPE_BUSQUEDAS_REDES_POR_DIA,
  candidatosDeLaRespuesta, consultaDeRedes, consultaPorUsuario, distanciaHash, nombraA, nombresParecidos, porqueDe, veredictoDe,
  type CandidatoRed, type Firma, type RedOtra, type RedesQueYaTiene,
} from './spy-otras-redes-reglas';
import { apuntaDeRef, leerCanalCorto } from './spy-youtube';
import { claveDeYoutube } from './youtube';

/** Medido en 6 y 11 s. */
const TOPE_MS = 45_000;
/** Lo que se espera por una foto: si no llega, se compara sin ella. */
const TOPE_FOTO_MS = 4_000;
const PESO_MAXIMO_FOTO = 3_000_000;

// El mismo molde que el tope de lecturas (`apifyHoy`, lib/instagram-perfil-server.ts): por negocio y por día.
const g = globalThis as unknown as { __spyRedesHoy?: Map<string, number> };
const redesHoy = (g.__spyRedesHoy ??= new Map<string, number>());
const hoy = () => new Date().toISOString().slice(0, 10);
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Un candidato ya mirado: con su foto para mostrarlo y el porqué de lo que se concluyó. */
export type CandidatoVerificado = CandidatoRed & { foto: string | null; porque: string };
export type BusquedaRedes =
  | { ok: true; seguros: CandidatoVerificado[]; candidatos: CandidatoVerificado[] }
  | { ok: false; error: string };

type Competidor = RedesQueYaTiene & { nombre: string; avatar?: string | null; landing_url?: string | null };

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

/** Lo que se sabe de un perfil o canal para compararlo: su nombre, su texto (bio, descripción, web) y su foto. */
type Leido = { nombre: string | null; texto: string; foto: string | null };

/** Lee los candidatos: los canales por `channels.list` (gratis) y los perfiles de Instagram en UNA corrida. */
async function leerCandidatos(ws: number, cs: readonly CandidatoRed[]): Promise<Map<string, Leido>> {
  const out = new Map<string, Leido>();
  const clave = await claveDeYoutube().catch(() => null);
  const igs = cs.filter((k) => k.red === 'instagram').map((k) => k.ref);
  const [perfiles] = await Promise.all([
    igs.length ? leerPerfilesEnLote(igs, { ws, reserva: RESERVA_DEL_ALTA }) : Promise.resolve(null),
    ...cs.filter((k) => k.red === 'youtube').map(async (k) => {
      const apunta = apuntaDeRef(k.ref);
      if (!apunta || !clave) return;
      const l = await leerCanalCorto(apunta, clave, fetch).catch(() => null);
      if (l?.ok) out.set(`youtube|${k.ref}`, { nombre: l.canal.nombre || null, texto: l.canal.descripcion, foto: l.canal.foto });
    }),
  ]);
  for (const [u, l] of perfiles ?? []) {
    if (l.ok) out.set(`instagram|${u}`, { nombre: l.perfil.nombre, texto: [l.perfil.bio, l.perfil.web].filter(Boolean).join(' '), foto: l.perfil.foto });
  }
  // TikTok no se lee: lo que hay es el título de Google («Nombre (@x) | TikTok»).
  for (const k of cs) if (k.red === 'tiktok') out.set(`tiktok|${k.ref}`, { nombre: k.titulo.replace(/\s*\(@[^)]*\).*$/, '').replace(/\s*[|·-]\s*TikTok.*$/i, '').trim() || null, texto: '', foto: null });
  return out;
}

/** Lo que el competidor ya dice de sí mismo: su bio de Instagram y la descripción de su canal. */
async function textosDelCompetidor(ws: number, c: Competidor): Promise<string> {
  const partes: string[] = [];
  const clave = c.youtube_id ? await claveDeYoutube().catch(() => null) : null;
  const apunta = c.youtube_id ? apuntaDeRef(c.youtube_id) : null;
  const [ig, yt] = await Promise.all([
    c.instagram ? leerPerfilesEnLote([c.instagram], { ws, reserva: RESERVA_DEL_ALTA }) : Promise.resolve(null),
    apunta && clave ? leerCanalCorto(apunta, clave, fetch).catch(() => null) : Promise.resolve(null),
  ]);
  const p = ig?.get(c.instagram as string);
  if (p?.ok) partes.push(p.perfil.bio, p.perfil.web ?? '');
  if (yt?.ok) partes.push(yt.canal.descripcion);
  return partes.filter(Boolean).join(' ');
}

const NOMBRE: Record<RedOtra, string> = { instagram: 'Instagram', youtube: 'canal de YouTube', tiktok: 'TikTok' };

export async function buscarOtrasRedes(ws: number, c: Competidor): Promise<BusquedaRedes> {
  if (c.instagram && c.youtube_id && c.tiktok) return { ok: true, seguros: [], candidatos: [] };
  const consultas = [...new Set([consultaDeRedes(c), consultaPorUsuario(c)].filter(Boolean))];
  if (!consultas.length) return { ok: true, seguros: [], candidatos: [] };
  const token = await credDelCliente(APIFY_CLAVE_DE_SPY, ws).catch(() => null);
  if (!token) return { ok: false, error: 'Para buscar sus otras redes hace falta tu clave de Apify (Integraciones).' };

  const firmaC: Firma = { instagram: c.instagram, youtube: c.youtube_id, tiktok: c.tiktok, sitio: c.landing_url ?? null };
  const [textoC, hashC] = await Promise.all([textosDelCompetidor(ws, c), hashDeFoto(c.avatar)]);
  const seguros = new Map<RedOtra, CandidatoVerificado>();
  const dudosos: CandidatoVerificado[] = [];
  const vistos = new Set<string>();
  let algunaCorrio = false;

  for (const consulta of consultas) {
    const cuenta = `${ws}|${hoy()}`;
    const usadas = redesHoy.get(cuenta) ?? 0;
    if (usadas >= TOPE_BUSQUEDAS_REDES_POR_DIA) {
      if (!algunaCorrio) return { ok: false, error: `Ya buscaste ${TOPE_BUSQUEDAS_REDES_POR_DIA} veces hoy. Mañana se puede de nuevo, o pega el enlace a mano.` };
      break;
    }
    redesHoy.set(cuenta, usadas + 1);
    const cuerpo = await googlear(token, consulta);
    if (cuerpo == null) {
      if (!algunaCorrio) return { ok: false, error: 'No pude buscar sus otras redes ahora. Prueba en un rato.' };
      break;
    }
    algunaCorrio = true;
    const nuevos = candidatosDeLaRespuesta(cuerpo, c).filter((k) => !seguros.has(k.red) && !vistos.has(`${k.red}|${k.ref.toLowerCase()}`));
    for (const k of nuevos) vistos.add(`${k.red}|${k.ref.toLowerCase()}`);
    const leidos = await leerCandidatos(ws, nuevos);
    const hashes = await Promise.all(nuevos.map((k) => hashDeFoto(leidos.get(`${k.red}|${k.ref}`)?.foto)));
    nuevos.forEach((k, i) => {
      const l = leidos.get(`${k.red}|${k.ref}`) ?? { nombre: null, texto: '', foto: null };
      const firmaK: Firma = k.red === 'youtube' ? { youtube: k.ref } : k.red === 'instagram' ? { instagram: k.ref } : { tiktok: k.ref };
      const nombraAlCompetidor = nombraA(`${l.texto} ${k.titulo}`, firmaC);
      const loNombraElCompetidor = nombraA(textoC, firmaK);
      const e = { enlaza: nombraAlCompetidor || loNombraElCompetidor, mismoNombre: nombresParecidos(l.nombre ?? k.titulo, c.nombre), distanciaFoto: distanciaHash(hashC, hashes[i]) };
      const v = veredictoDe(e);
      if (v === 'no') return;
      const enlace = loNombraElCompetidor ? `Su perfil enlaza a este ${NOMBRE[k.red]}` : nombraAlCompetidor ? `Este ${NOMBRE[k.red]} enlaza a sus otras redes` : null;
      const vk: CandidatoVerificado = { ...k, titulo: l.nombre ?? k.titulo, foto: l.foto, porque: enlace ?? porqueDe(e) };
      if (v === 'es' && !seguros.has(k.red)) seguros.set(k.red, vk);
      else dudosos.push(vk);
    });
    // Si a cada red que le falta ya se le encontró la segura, no hace falta seguir buscando.
    const faltan = (['instagram', 'youtube', 'tiktok'] as const).filter((r) => !(r === 'youtube' ? c.youtube_id : c[r]) && !seguros.has(r));
    if (!faltan.length) break;
  }
  return { ok: true, seguros: [...seguros.values()], candidatos: dudosos.filter((k) => !seguros.has(k.red)) };
}
