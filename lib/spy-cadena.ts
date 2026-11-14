// =============================================================================
// spy-cadena — sus otras redes y su web, solas y en cadena (4/11/2026)
// =============================================================================
// Martín, 4/11: «tampoco está haciendo el ejercicio de buscar en YouTube y también buscar su web… Yo busqué literalmente el
// usuario exacto y ya me apareció el primer resultado… Eso debería traerlo automáticamente, y en correlación mirar las
// biografías para traer sus webs. Si no encuentra el usuario exacto, que lo busque por el nombre».
//
// El recorrido, de lo más barato y seguro a lo más caro:
//   1. Lo que ÉL enlaza: su bio de Instagram, la descripción de su canal y su web cargada. Si alguna es una página de
//      enlaces (beacons, linktree…), se abre y se leen sus enlaces: ahí están sus redes y su web de verdad. Lo que él
//      enlaza es su firma: entra solo.
//   2. Su MISMO usuario en la red que le falta (@den.borgg → el canal @den.borgg o @denborgg): gratis en YouTube. Con
//      su nombre o su cara, entra solo; sin eso, se pregunta.
//   3. Google, por su nombre y por su @: sólo si todavía le falta Instagram o YouTube. Lo que más trae Google de YouTube
//      son videos: se lee el canal de cada uno.
//
// ⚠️ ESTE MÓDULO NO SALE A LA RED: recibe cada lectura como una función (`DepsCadena`). Así se prueba con dobles y se
// cuenta cuántas veces se le pide algo a Apify. Las de verdad las pone `buscarOtrasRedes` (lib/spy-otras-redes.ts).
// ⚠️ Y NO ESCRIBE NADA: devuelve qué es seguro, qué hay que preguntar y su web; lo guarda la ruta.
// =============================================================================

import { videosDeGoogle } from './spy-buscar-reglas';
import { CLAVE_RECHAZADA, esClaveRechazada, esPendiente, esSinCupo } from './spy-google-corrida';
import {
  CANDIDATOS_POR_RED, candidatosDeLaRespuesta, claveDeCanal, consultaDeRedes, consultaPorUsuario, distanciaHash, enlacesDeHtml, enlacesDelTexto,
  esAgregador, loQueEnlaza, nombraA, nombresParecidos, porqueDe, redDeUrl, REDES_CLAVE_RECHAZADA, usuariosParaProbar, veredictoDe,
  type CandidatoRed, type Firma, type RedOtra, type RedesQueYaTiene,
} from './spy-otras-redes-reglas';

/** Un candidato ya mirado: con su foto para mostrarlo y el porqué de lo que se concluyó. */
export type CandidatoVerificado = CandidatoRed & {
  foto: string | null; porque: string;
  /** El id que devolvió la red al leerlo (el `UC…` de un canal, el usuario de un perfil): lo que lo identifica (`claveDeCanal`). */
  id?: string | null;
  /** Sus suscriptores o seguidores, para distinguir dos con el mismo nombre. */
  seguidores?: number | null;
};

/** Lo que se sabe de un perfil o canal para compararlo: su nombre, su texto (bio, descripción, web) y su foto. */
export type LeidoRed = { nombre: string | null; texto: string; foto: string | null; id?: string | null; seguidores?: number | null };

export type CompetidorCadena = RedesQueYaTiene & { nombre: string; avatar?: string | null; landing_url?: string | null };

export type DepsCadena = {
  /** Su bio de Instagram y la descripción de su canal, juntas. Sin pagar otra lectura si ya se leyó. */
  textoPropio: () => Promise<string>;
  /** El HTML de una página de enlaces. null = no se pudo abrir. */
  abrirPagina: (url: string) => Promise<string | null>;
  /** Canales de YouTube por lo que guarda el alta (`@handle`, `UC…`): la clave es el ref pedido. Gratis. */
  leerCanales: (refs: string[]) => Promise<Map<string, LeidoRed>>;
  /** Perfiles de Instagram, en UNA corrida de Apify. La clave es el usuario. `CLAVE_RECHAZADA`: Apify rechazó la clave (401/403). */
  leerPerfiles: (usuarios: string[]) => Promise<Map<string, LeidoRed> | typeof CLAVE_RECHAZADA>;
  /**
   * Una búsqueda en Google por Apify. null como función = el negocio no tiene la clave de Spy. Devuelve el cuerpo,
   * `GOOGLE_PENDIENTE` (la corrida sigue: se retoma sin pagar), `GOOGLE_SIN_CUPO`, `CLAVE_RECHAZADA` o null (no se pudo). Recibe `gastar`:
   * una búsqueda cuenta en el cupo del día sólo al EMPEZAR una corrida, no al retomarla (lib/spy-google-corrida.ts).
   */
  googlear: ((consulta: string, gastar: () => boolean) => Promise<unknown | null>) | null;
  /** ¿Quedan búsquedas hoy? (`TOPE_BUSQUEDAS_REDES_POR_DIA`). Lo cuenta: llamarla gasta una. */
  gastarBusqueda: () => boolean;
  /** De qué canal es cada video. */
  canalesDeVideos: (ids: string[]) => Promise<Array<{ id: string; nombre: string | null }>>;
  hashDeFoto: (url: string | null | undefined) => Promise<string | null>;
};

export type ResultadoCadena =
  /** `pendiente`: Google todavía no terminó; la pantalla vuelve a pedir sola, sin texto, y la corrida se retoma sin pagar. */
  /** `clave: 'rechazada'`: Apify rechazó la clave de Spy (14/11/2026). La ficha lo dice en UNA línea con el botón, aunque algo se encontró. */
  | { ok: true; seguros: CandidatoVerificado[]; candidatos: CandidatoVerificado[]; web: string | null; pendiente?: boolean; clave?: 'rechazada' }
  | { ok: false; error: string; clave?: 'rechazada' };

const NOMBRE: Record<RedOtra, string> = { instagram: 'Instagram', youtube: 'canal de YouTube', tiktok: 'TikTok' };
const hostDe = (u: string | null | undefined): string | null => {
  if (!u) return null;
  try { return new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`).hostname.toLowerCase().replace(/^www\./, ''); } catch { return null; }
};

export async function cadenaDeRedes(c: CompetidorCadena, deps: DepsCadena): Promise<ResultadoCadena> {
  const falta = (r: RedOtra) => !(r === 'youtube' ? c.youtube_id : c[r]);
  const landingEsPagina = esAgregador(c.landing_url);
  if (!falta('instagram') && !falta('youtube') && !falta('tiktok') && c.landing_url && !landingEsPagina) {
    return { ok: true, seguros: [], candidatos: [], web: null };
  }

  const firmaC: Firma = { instagram: c.instagram, youtube: c.youtube_id, tiktok: c.tiktok, sitio: landingEsPagina ? null : c.landing_url ?? null };
  const [textoC, hashC] = await Promise.all([deps.textoPropio(), deps.hashDeFoto(c.avatar)]);

  // ── 1. Lo que él enlaza, y lo que enlaza su página de enlaces ─────────────────────────────────
  const propios = [...new Set([...enlacesDelTexto(textoC), ...(c.landing_url ? [c.landing_url] : [])])];
  const paginas = propios.filter((u) => esAgregador(u)).slice(0, 2);
  const htmls = await Promise.all(paginas.map((u) => deps.abrirPagina(u).catch(() => null)));
  const deLasPaginas = htmls.flatMap((h, i) => (h ? enlacesDeHtml(h, paginas[i]) : []));
  const enlaza = loQueEnlaza([...propios.filter((u) => !esAgregador(u)), ...deLasPaginas]);
  const enPagina = new Set(deLasPaginas.map((u) => redDeUrl(u)).filter(Boolean).map((r) => `${r!.red}|${r!.ref.toLowerCase()}`));
  // Su web: sólo si no tenía, o si la que tenía era su página de enlaces. Nunca se pisa una web que eligió el negocio.
  const web = enlaza.web && (!c.landing_url || landingEsPagina) && hostDe(enlaza.web) !== hostDe(c.landing_url) ? enlaza.web : null;

  const seguros = new Map<RedOtra, CandidatoVerificado>();
  const dudosos: CandidatoVerificado[] = [];
  const vistos = new Set<string>();
  const clave = (k: CandidatoRed) => `${k.red}|${k.ref.toLowerCase()}`;
  // Apify rechazó la clave de Spy en algún paso (Google o los perfiles): se dice al final, nunca como «no encontré nada».
  let rechazada = false;
  const conClave = () => (rechazada ? { clave: 'rechazada' as const } : {});

  const leer = async (cs: CandidatoRed[]): Promise<Map<string, LeidoRed>> => {
    const yt = cs.filter((k) => k.red === 'youtube').map((k) => k.ref);
    const ig = cs.filter((k) => k.red === 'instagram').map((k) => k.ref);
    const [mY, crudoI] = await Promise.all([
      yt.length ? deps.leerCanales(yt).catch(() => new Map<string, LeidoRed>()) : Promise.resolve(new Map<string, LeidoRed>()),
      ig.length ? deps.leerPerfiles(ig).catch(() => new Map<string, LeidoRed>()) : Promise.resolve(new Map<string, LeidoRed>()),
    ]);
    if (esClaveRechazada(crudoI)) rechazada = true;
    const mI = esClaveRechazada(crudoI) ? new Map<string, LeidoRed>() : crudoI;
    const out = new Map<string, LeidoRed>();
    for (const k of cs) {
      const l = k.red === 'youtube' ? mY.get(k.ref) : k.red === 'instagram' ? mI.get(k.ref)
        // TikTok no se lee: lo que hay es el título de Google («Nombre (@x) | TikTok»).
        : k.titulo ? { nombre: k.titulo.replace(/\s*\(@[^)]*\).*$/, '').replace(/\s*[|·-]\s*TikTok.*$/i, '').trim() || null, texto: '', foto: null } : undefined;
      if (l) out.set(clave(k), l);
    }
    return out;
  };

  // El mismo canal por dos refs (`@x` y su `UC…`) es UN canal: se reconoce por el id que devuelve la red (`claveDeCanal`).
  const canalesVistos = new Set<string>();
  const evaluar = async (cs: CandidatoRed[], extra: { enlaza?: boolean; mismoUsuario?: boolean; soloSiExiste?: boolean; porque?: (k: CandidatoRed) => string }) => {
    const nuevos = cs.filter((k) => falta(k.red) && !seguros.has(k.red) && !vistos.has(clave(k)));
    for (const k of nuevos) vistos.add(clave(k));
    if (!nuevos.length) return;
    const leidos = await leer(nuevos);
    const hashes = await Promise.all(nuevos.map((k) => deps.hashDeFoto(leidos.get(clave(k))?.foto).catch(() => null)));
    nuevos.forEach((k, i) => {
      const l = leidos.get(clave(k));
      // Un @ probado a ciegas que no existe no es un candidato.
      if (!l && extra.soloSiExiste) return;
      const ll: LeidoRed = l ?? { nombre: null, texto: '', foto: null };
      const canal = claveDeCanal({ red: k.red, ref: k.ref, id: ll.id });
      if (canalesVistos.has(canal)) return;
      const firmaK: Firma = k.red === 'youtube' ? { youtube: k.ref } : k.red === 'instagram' ? { instagram: k.ref } : { tiktok: k.ref };
      const nombraAlCompetidor = nombraA(`${ll.texto} ${k.titulo}`, firmaC);
      const loNombraElCompetidor = !!extra.enlaza || nombraA(textoC, firmaK);
      const e = {
        enlaza: nombraAlCompetidor || loNombraElCompetidor, mismoUsuario: !!extra.mismoUsuario,
        mismoNombre: nombresParecidos(ll.nombre ?? k.titulo, c.nombre), distanciaFoto: distanciaHash(hashC, hashes[i]),
      };
      const v = veredictoDe(e);
      if (v === 'no') return;
      // Se marca recién cuando se muestra: un «no» por un camino no le cierra la puerta al mismo canal por otro con más evidencia.
      canalesVistos.add(canal);
      const porque = extra.porque?.(k)
        ?? (loNombraElCompetidor ? `Su perfil enlaza a este ${NOMBRE[k.red]}` : nombraAlCompetidor ? `Este ${NOMBRE[k.red]} enlaza a sus otras redes` : porqueDe(e));
      const vk: CandidatoVerificado = { ...k, titulo: ll.nombre ?? (k.titulo || k.ref), foto: ll.foto, porque, id: ll.id ?? null, seguidores: ll.seguidores ?? null };
      if (v === 'es' && !seguros.has(k.red)) seguros.set(k.red, vk);
      else dudosos.push(vk);
    });
  };

  await evaluar(enlaza.redes.map((k) => ({ ...k, titulo: '' })), {
    enlaza: true,
    porque: (k) => (enPagina.has(clave(k)) ? `Su página de enlaces lleva a este ${NOMBRE[k.red]}` : `Su perfil enlaza a este ${NOMBRE[k.red]}`),
  });

  // ── 2. Su mismo usuario en la red que le falta ────────────────────────────────────────────────
  const probar = usuariosParaProbar(c);
  await evaluar([
    ...probar.youtube.map((h): CandidatoRed => ({ red: 'youtube', ref: h, url: `https://www.youtube.com/${h}`, titulo: '' })),
    ...probar.instagram.map((u): CandidatoRed => ({ red: 'instagram', ref: u, url: `https://www.instagram.com/${u}/`, titulo: '' })),
  ], { mismoUsuario: true, soloSiExiste: true });

  // ── 3. Google: sólo si todavía le falta Instagram o YouTube (TikTok sale de la misma página, si aparece) ───
  const faltaLoQueImporta = () => (['instagram', 'youtube'] as const).some((r) => falta(r) && !seguros.has(r));
  const algo = () => seguros.size > 0 || dudosos.length > 0 || !!web;
  if (faltaLoQueImporta()) {
    const consultas = [...new Set([consultaDeRedes(c), consultaPorUsuario(c)].filter(Boolean))];
    if (!deps.googlear) {
      if (!algo()) return { ok: false, error: 'Para buscar sus otras redes hace falta tu clave de Apify (Integraciones).' };
    } else {
      let algunaCorrio = false;
      for (const consulta of consultas) {
        const cuerpo = await deps.googlear(consulta, deps.gastarBusqueda).catch(() => null);
        if (esClaveRechazada(cuerpo)) {
          rechazada = true;
          break;
        }
        if (esSinCupo(cuerpo)) {
          if (!algunaCorrio && !algo()) return { ok: false, error: 'Ya no quedan búsquedas de redes por hoy.' };
          break;
        }
        // ⚠️ SIGUE CORRIENDO NO ES «NO PUDE» (4/11/2026): Google por Apify a veces tarda más de lo que se espera en un pedido, y
        // cortarlo tiraba un resultado ya pagado. Se devuelve lo que haya con `pendiente` y la pantalla vuelve a pedir sola.
        if (esPendiente(cuerpo)) return { ok: true, seguros: [...seguros.values()], candidatos: dudosos.filter((k) => !seguros.has(k.red)), web, pendiente: true, ...conClave() };
        if (cuerpo == null) {
          // Sin texto en pantalla (Martín, 4/11: «Elimina textos innecesarios como "No pude buscar sus otras redes ahora"»).
          if (!algunaCorrio && !algo()) return rechazada ? { ok: false, error: REDES_CLAVE_RECHAZADA, clave: 'rechazada' } : { ok: false, error: '' };
          break;
        }
        algunaCorrio = true;
        const cands = candidatosDeLaRespuesta(cuerpo, c);
        // De YouTube, Google trae sobre todo VIDEOS: el canal de cada uno es el candidato.
        if (falta('youtube') && !seguros.has('youtube') && !cands.some((k) => k.red === 'youtube')) {
          const ids = videosDeGoogle(cuerpo);
          const canales = ids.length ? await deps.canalesDeVideos(ids).catch(() => []) : [];
          cands.push(...canales.slice(0, CANDIDATOS_POR_RED).map((ch): CandidatoRed => ({ red: 'youtube', ref: ch.id, url: `https://www.youtube.com/channel/${ch.id}`, titulo: ch.nombre ?? '' })));
        }
        await evaluar(cands, {});
        if (!faltaLoQueImporta()) break;
      }
    }
  }
  // La clave rechazada sin nada encontrado no es «no encontré nada»: es la línea con el botón (app/competitor-spy/OtrasRedes.tsx).
  if (rechazada && !algo()) return { ok: false, error: REDES_CLAVE_RECHAZADA, clave: 'rechazada' };
  return { ok: true, seguros: [...seguros.values()], candidatos: dudosos.filter((k) => !seguros.has(k.red)), web, ...conClave() };
}
