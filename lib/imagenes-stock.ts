// =============================================================================
// imagenes-stock — buscar fotos libres (Openverse + Picsum) y COPIARLAS a un bucket propio
// =============================================================================
// Vivía adentro de app/api/portadas/route.ts y se mudó acá el 11/10/2026 porque ahora la usan dos
// pantallas: las portadas (bucket `portadas`) y el editor de landings copiado de Gamma (bucket
// `landing-imagenes`, docs/diseno-editor-landing.md D6), más la generación con IA, que le pide una
// foto por sección (`buscarYCopiar`). Lo que cambia entre las dos es el BUCKET, la PROPORCIÓN y la
// forma de la ruta: eso es lo único parametrizado. Los porqués de cada decisión vinieron con el
// código y se conservan abajo, con sus fechas.
//
// Las tres reglas de esta lib:
//   · EL NAVEGADOR MANDA UN ID, NUNCA UNA URL A BAJAR (anti-SSRF). Con el id, la URL la dice el
//     proveedor (Openverse) o la arma el server (Picsum). La única excepción es `copiarUrlABucket`
//     («Desde un enlace»), y ésa baja con la baranda de lib/landing-fetch.ts: cada salto revalidado,
//     la IP clavada (sin DNS rebinding) y el tope de bytes aplicado MIENTRAS se lee.
//   · EL TIPO SE DECIDE POR MAGIC BYTES (`sniffImagen`/`sniffMedia`), nunca por el `content-type` de
//     un tercero. Y nunca SVG.
//   · SE GUARDA NUESTRA COPIA, no la URL del tercero: una imagen apuntada afuera se rompe el día que
//     el tercero la borra, y el síntoma llega meses después como un hueco gris en la landing de un
//     cliente.
// =============================================================================

import 'server-only';
import { consultasRelajadas } from './imagenes-consulta';
import { randomUUID } from 'node:crypto';
import { isIP, type LookupFunction } from 'node:net';
import { request as pedidoHttps } from 'node:https';
import { request as pedidoHttp } from 'node:http';
import { getSupabaseServer } from './supabase';
import { validarDestino } from './landing-fetch';
import { sniffImagen, sniffMedia, esTipoVideo, BUCKET_LANDING } from './editor-landing/server-reglas';
import { TOPE_IMAGEN_BYTES, TOPE_VIDEO_BYTES, type ArchivoBiblioteca, type FotoStock } from './editor-landing/api-tipos';

export { sniffImagen, sniffMedia };

/** Extensión por tipo de IMAGEN raster. Nunca image/svg+xml (ver la cabecera). */
export const EXT_IMAGEN: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
};
const EXT_MEDIA: Readonly<Record<string, string>> = { ...EXT_IMAGEN, 'video/mp4': 'mp4', 'video/webm': 'webm' };

export type Orientacion = 'horizontal' | 'vertical' | 'cuadrada';
export type Proporcion = { w: number; h: number };

/** El tamaño en que se BAJA una foto de Picsum para cada orientación (el recorte lo hace Picsum). */
export const PROPORCION: Readonly<Record<Orientacion, Proporcion>> = {
  horizontal: { w: 1600, h: 900 },
  vertical: { w: 900, h: 1600 },
  cuadrada: { w: 1200, h: 1200 },
};

/** El `aspect_ratio` de Openverse para cada orientación. */
const ASPECTO_OV: Readonly<Record<Orientacion, string>> = { horizontal: 'wide', vertical: 'tall', cuadrada: 'square' };

export type ResultadoBusqueda = { ok: true; fotos: FotoStock[]; pagina: number; hayMas: boolean } | { ok: false; error: string };

/**
 * Lo que contesta POST /api/landing-generator/imagenes por acción, además de `ok: true` (la falla
 * es `{ ok: false, error }`). Vive acá porque una ruta no puede exportar tipos propios; la pantalla
 * lo importa con `import type`.
 *
 *   firmar     → el navegador sube con PUT multipart a `signedUrl` (molde: `subirConProgreso`,
 *                app/customer-success/curso/subir-video.ts, con `apikey`) y después llama a registrar.
 *   registrar  → la URL PÚBLICA y definitiva (la que se guarda en el documento).
 */
export type RespuestasImagenes = {
  firmar: { path: string; signedUrl: string; token: string; apikey: string | null };
  registrar: { url: string; tipo: string };
  buscar: { fotos: FotoStock[]; pagina: number; hayMas: boolean };
  elegir: { url: string };
  desdeUrl: { url: string; tipo: string };
  biblioteca: { archivos: ArchivoBiblioteca[] };
};
export type ResultadoCopia = { ok: true; url: string; tipo: string } | { ok: false; error: string; status: number };

const POR_PAGINA = 24;

// ─────────────────────────────────────────────────────────────────────────────
// Picsum: el repositorio al azar (sin texto)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CUÁNTAS PÁGINAS TIENE EL CATÁLOGO, medido con curl el 27/09/2026:
 * la 41 trae 24, la **42 trae 9** y de la 43 en adelante `[]`. O sea 993 fotos.
 *
 * ⚠️ NO HAY FORMA DE PREGUNTARLO. El header `Link` de picsum sólo trae `rel="next"`,
 * y lo trae SIEMPRE — también en la 43, que ya está vacía. Así que el final del
 * catálogo no se detecta: se cuenta. Si un día picsum crece, el único síntoma es
 * que dejamos de ofrecer lo nuevo; si encoge, una tanda vuelve vacía.
 */
const TOTAL_PAGINAS = 42;

/**
 * ⚠️ CADA TANDA SE ARMA CON VARIOS LOTES DE PÁGINAS DISTINTAS, Y ESO ES EL
 * RANDOMIZER DE VERDAD.
 *
 * La primera versión sorteaba UNA página y devolvía sus 24 fotos. El dueño lo
 * reportó mirando la grilla: «ordenaste todas las fotos, cuando ya habíamos
 * implementado el randomizer». Y tenía razón — el error no era que no sorteara, era
 * QUÉ sorteaba. En picsum los ids consecutivos son de la misma sesión de fotos: los
 * 1052 al 1063 son todos «notebook sobre un escritorio». Una página son 24 ids
 * consecutivos, así que sortear la página cambia el TEMA de la tanda y no la mezcla:
 * seis laptops, después seis bosques, después seis playas.
 *
 * Ahora cada tanda junta 4 páginas repartidas por todo el catálogo y las INTERCALA.
 * Cuesta 4 pedidos en vez de 1 — desde el server, que es donde eso es barato (medido:
 * 12 en paralelo, las 12 bien) y que además cachea cada miniatura 24 h.
 */
const LOTES_POR_TANDA = 4;
const POR_LOTE = 6;

/** El tope de tandas sin repetir: el catálogo entero dividido por lo que consume cada una. */
export const TANDAS_PICSUM = Math.ceil(TOTAL_PAGINAS / LOTES_POR_TANDA);

/**
 * Las 4 páginas de una tanda, repartidas y sin repetir entre tandas.
 *
 * El salto es un número PRIMO respecto de 42, así que multiplicarlo recorre todas las
 * páginas antes de volver a pisar una: con un salto par (digamos 2) sólo se verían las
 * pares y la mitad del catálogo no existiría nunca.
 */
function paginasDeLaTanda(semilla: number, tanda: number): number[] {
  const SALTO = 11; // primo con 42
  const base = semilla % TOTAL_PAGINAS;
  return Array.from({ length: LOTES_POR_TANDA }, (_, i) =>
    ((base + (tanda - 1) * LOTES_POR_TANDA * SALTO + i * SALTO) % TOTAL_PAGINAS) + 1);
}

/**
 * Una tanda del repositorio al azar. `semilla` la manda el NAVEGADOR a propósito: «Ver más fotos»
 * ACUMULA, así que dos tandas sorteadas por separado repetirían fotos y saltearían otras; con la
 * semilla fija por apertura del selector, las tandas CAMINAN desde donde arrancó la primera.
 *
 * `grande` es el tamaño en que se guardará la foto si se elige (la URL de Picsum ya recorta).
 */
export async function tandaPicsum(semilla: number, tandaPedida: number, grande: Proporcion): Promise<ResultadoBusqueda> {
  const pagina = Math.max(1, Math.min(TANDAS_PICSUM, Math.trunc(tandaPedida) || 1));
  const s = Math.abs(Math.trunc(semilla) || 0);
  try {
    // `signal` y no sólo el `maxDuration` de la ruta: un fetch sin corte con la red
    // caída en el medio no resuelve NUNCA, y lo que se ve es un spinner eterno.
    const trozos = await Promise.all(paginasDeLaTanda(s, pagina).map(async (pg) => {
      const r = await fetch(`https://picsum.photos/v2/list?page=${pg}&limit=${POR_LOTE}`,
        { signal: AbortSignal.timeout(12_000), cache: 'no-store' });
      if (!r.ok) throw new Error(`El catálogo de fotos contestó ${r.status}`);
      const c: unknown = await r.json();
      if (!Array.isArray(c)) throw new Error('El catálogo de fotos contestó algo que no es una lista');
      return c;
    }));
    // ⚠️ SE INTERCALAN, no se concatenan. Concatenadas quedarían seis fotos de un
    // lote, seis del siguiente… o sea grupos otra vez, sólo que de otro tamaño.
    const crudo: unknown[] = [];
    for (let i = 0; i < POR_LOTE; i++) for (const t of trozos) if (t[i] !== undefined) crudo.push(t[i]);
    const fotos: FotoStock[] = [];
    for (const f of crudo.slice(0, POR_PAGINA)) {
      const o = f as Record<string, unknown>;
      const id = typeof o.id === 'string' ? o.id : String(o.id ?? '');
      if (!/^[0-9]+$/.test(id)) continue;
      fotos.push({
        id,
        autor: typeof o.author === 'string' ? o.author : '',
        // ⚠️ LA MINIATURA SALE POR NUESTRA RUTA Y NO POR PICSUM, y no es una
        // preferencia: medido el 27/09/2026, una grilla de 24 `<img>` a
        // `picsum.photos` deja las 24 EN BLANCO — el navegador no sigue el 302 y no
        // da ningún error. El server sí puede (12 en paralelo con curl, las 12 bien).
        // El porqué completo está en `app/api/portadas/foto/route.ts` (que sólo sirve 400×140).
        mini: `/api/portadas/foto?id=${id}&w=400&h=140`,
        // ⚠️ LA GRANDE APUNTA A PICSUM, a propósito: es el DATO que queda guardado (las portadas
        // lo guardan tal cual y lo valida `ORIGENES_OK`); el editor de landings la COPIA a su
        // bucket al elegirla. El recorte lo hace el propio repositorio.
        grande: `https://picsum.photos/id/${id}/${grande.w}/${grande.h}`,
        licencia: 'Unsplash',
      });
    }
    // ⚠️ `hayMas` LO DECIDE EL SERVER, que es el único que sabe cuántas páginas hay.
    // Sin esto el botón «Ver más fotos» se dibuja para siempre y, pasada la última,
    // cada click trae una lista vacía: la pantalla no puede distinguir «no hay más»
    // de «no llegó nada», que son dos cosas y sólo una es un problema.
    return { ok: true, fotos, pagina, hayMas: pagina * LOTES_POR_TANDA < TOTAL_PAGINAS };
  } catch (e) {
    const error = e instanceof Error && e.name === 'TimeoutError'
      ? 'El catálogo de fotos tardó demasiado.'
      : e instanceof Error ? e.message : String(e);
    return { ok: false, error };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Openverse: buscar por texto
// ─────────────────────────────────────────────────────────────────────────────

/**
 * BUSCAR POR TEXTO — y no lo hace picsum, lo hace OPENVERSE.
 *
 * «Sería bueno que haya una barra de búsqueda en las fotos de portada, no sé si la API
 * que estás consumiendo tiene algo para buscar por texto» (27/09/2026). No tiene:
 * medido con curl, `picsum.photos/v2/list?q=montana` devuelve **la misma lista sin
 * filtrar**. Es Lorem Picsum — fotos al azar, sin título ni etiquetas. No hay nada que
 * buscar ahí, así que buscar exige otra fuente.
 *
 * Openverse, medido el mismo día:
 *   · `GET /v1/images/?q=mountain` → 240 resultados. **Sin ninguna key**, que es la
 *     misma propiedad por la que el repositorio base es picsum.
 *   · trae MINIATURA propia (`thumbnail`), así que la grilla no carga los originales.
 *   · **y dice la licencia de cada foto**, que es la parte que casi se cuela: agrega
 *     CC-BY y CC-BY-SA, que OBLIGAN a atribuir. Con `license=cc0,pdm` quedan sólo
 *     dominio público y CC0 — las que no obligan a nada. Es exactamente la misma
 *     trampa que Solar en el catálogo de íconos, y el mismo guard: en positivo.
 *   · NO manda CORS, así que va por acá igual que picsum.
 *
 * ⚠️ Y UNA LANDING ES PUBLICIDAD: docs/hallazgos-video-pipeline.md marca Openverse como «licencia
 * NO VERIFICADA» para anuncios. CC0 y dominio público no obligan a nada, pero la metadata la carga
 * cada proveedor y Openverse no la garantiza. Se dice acá para que nadie lo descubra después.
 */
const LICENCIAS_OK = 'cc0,pdm';
const NOMBRE_LICENCIA: Readonly<Record<string, string>> = { cc0: 'CC0', pdm: 'Dominio público' };

/**
 * TRADUCIR LO QUE SE BUSCA, SIN QUE NADIE SE ENTERE.
 *
 * «Cuando busco en español debería hacer la traducción, sin que el usuario lo sepa, al
 * inglés, para buscar bien» (27/09/2026). Y es cierto: Openverse indexa por los tags
 * de cada proveedor, y esos tags están en inglés — «dinero» devuelve un puñado y
 * «money» devuelve el catálogo.
 *
 * MyMemory, medido el mismo día: sin key, y además **no rompe el inglés**, que era el
 * riesgo de traducir siempre. Probado con `langpair=es|en`: money → Money, office →
 * office, modern office → modern office, beach → Beach. O sea que se puede traducir
 * SIEMPRE sin preguntarse en qué idioma escribió la persona — que es justo la
 * pregunta que no se puede contestar bien con una palabra suelta.
 *
 * ⚠️ Y SI FALLA, SE BUSCA CON LO QUE ESCRIBIÓ. Un traductor caído no puede dejar sin
 * buscar: la traducción es una mejora del término, no un requisito. Es la misma regla
 * que «rechazar deja una deuda» — lo que no se pudo hacer no puede llevarse puesto lo
 * que sí.
 */
const traducciones = new Map<string, string>();

async function aIngles(texto: string): Promise<string> {
  // ⚠️ SE CACHEA EN MEMORIA. Buscar es la ruta más lenta del selector y la traducción
  // está en el camino crítico: sin esto, volver a la misma palabra vuelve a pagar el
  // viaje. El Map vive lo que viva la instancia; no hace falta más, porque lo que se
  // repite es la misma búsqueda en la misma sesión.
  const ya = traducciones.get(texto);
  if (ya !== undefined) return ya;
  try {
    const u = new URL('https://api.mymemory.translated.net/get');
    u.searchParams.set('q', texto);
    u.searchParams.set('langpair', 'es|en');
    // 1,8 s y no 4: esto corre ANTES de las dos páginas de Openverse, así que cada
    // segundo acá es un segundo de grilla vacía. Si no llega, se busca en español —
    // peor que traducido, mejor que esperando.
    const r = await fetch(u, { signal: AbortSignal.timeout(1800) });
    if (!r.ok) return texto;
    const j = (await r.json()) as { responseData?: { translatedText?: unknown } };
    const t = j.responseData?.translatedText;
    // Se descarta lo que no parezca una traducción: MyMemory devuelve avisos en el
    // mismo campo cuando algo sale mal («NO QUERY SPECIFIED…»), y eso como término de
    // búsqueda da cero resultados sin decir por qué.
    if (typeof t !== 'string' || !t.trim() || t.length > texto.length * 3 + 20) return texto;
    traducciones.set(texto, t.trim());
    return t.trim();
  } catch { return texto; }
}

/**
 * ⚠️ VEINTE, NO VEINTICUATRO. Openverse topea `page_size` en 20 **para pedidos
 * anónimos** —los que no llevan key, que es todo el punto de haberlo elegido— y con 24
 * contesta `401 {"detail":"page_size may not exceed 20 for anonymous requests"}`.
 *
 * Es el patrón que AGENTS.md ya tiene escrito: el entorno tiene un tope y tu código
 * declara otro. Acá salió barato porque el proveedor lo dice con todas las letras; la
 * versión cara es la que contesta 200 con menos datos y nadie se entera.
 */
const POR_PAGINA_OV = 20;

/** Una página de Openverse, cruda. */
async function paginaOpenverse(texto: string, pagina: number, orientacion: Orientacion) {
  const url = new URL('https://api.openverse.org/v1/images/');
  url.searchParams.set('q', texto.slice(0, 60));
  url.searchParams.set('page', String(pagina));
  url.searchParams.set('page_size', String(POR_PAGINA_OV));
  url.searchParams.set('license', LICENCIAS_OK);
  // Sólo lo que se puede recortar a la proporción pedida sin que quede una tira: una foto
  // vertical en una banda de 1600×420 es un recorte del 10% de la imagen.
  url.searchParams.set('aspect_ratio', ASPECTO_OV[orientacion]);

  const r = await fetch(url, { signal: AbortSignal.timeout(12_000), cache: 'no-store' });
  if (!r.ok) {
    // ⚠️ SE PASA EL MOTIVO DEL PROVEEDOR, no sólo el número. «contestó 401» manda a
    // buscar una credencial que esta API no usa; su `detail` dice exactamente qué
    // pasó («page_size may not exceed 20…»), y eso es la diferencia entre un curl y
    // media hora. Se recorta porque es texto de un tercero yendo a una pantalla.
    const detalle = await r.json().then((j: { detail?: unknown }) => (typeof j.detail === 'string' ? j.detail : '')).catch(() => '');
    return { ok: false as const, error: `El buscador de fotos contestó ${r.status}${detalle ? `: ${detalle.slice(0, 120)}` : ''}` };
  }
  const j = (await r.json()) as { results?: Array<Record<string, unknown>>; page_count?: number };
  return { ok: true as const, resultados: j.results ?? [], paginas: j.page_count ?? 1 };
}

/**
 * Una TANDA de resultados: dos páginas de Openverse.
 *
 * ⚠️ DOS Y NO UNA, porque Openverse topea en 20 por página para pedidos anónimos y
 * una tanda de 20 se ve corta al lado de las 24 del repositorio base — «busco algo y
 * limita la cantidad de fotos que aparece» (27/09/2026). Con dos, la tanda es de 40 y
 * se recorta a 24: el mismo tamaño que las otras, y «Ver más» trae otra tanda entera
 * en vez de un resto.
 */
async function buscarEnOpenverse(textoOriginal: string, tanda: number, orientacion: Orientacion): Promise<ResultadoBusqueda> {
  const traducido = await aIngles(textoOriginal.slice(0, 60));
  const p1 = (tanda - 1) * 2 + 1;
  let [a, b] = await Promise.all([paginaOpenverse(traducido, p1, orientacion), paginaOpenverse(traducido, p1 + 1, orientacion)]);
  // Si la frase entera no trae nada, la primera consulta más floja que traiga algo. Openverse
  // exige TODAS las palabras (ver `consultasRelajadas`). Es determinista, así que «Ver más»
  // vuelve a caer en la misma consulta que la primera tanda.
  if (a.ok && !a.resultados.length) {
    for (const q of consultasRelajadas(traducido).slice(1)) {
      const otra = await paginaOpenverse(q, p1, orientacion);
      if (!otra.ok) break;
      if (otra.resultados.length) { a = otra; b = await paginaOpenverse(q, p1 + 1, orientacion); break; }
    }
  }
  if (!a.ok) return a;
  const crudos = [...a.resultados, ...(b.ok ? b.resultados : [])];
  const fotos: FotoStock[] = [];
  /**
   * ⚠️ SE DEDUPLICA AL UNIR LAS DOS PÁGINAS. La paginación de Openverse no es estable
   * —el mismo ítem puede volver en la página 1 y en la 2—, y dos fotos con el mismo
   * id son dos `key` iguales en React: avisa en consola y deja una tarjeta que no se
   * actualiza. Medido: apareció apenas la tanda pasó de una página a dos.
   */
  const vistos = new Set<string>();
  for (const o of crudos) {
    const id = typeof o.id === 'string' ? o.id : '';
    const grande = typeof o.url === 'string' ? o.url : '';
    if (!id || !grande.startsWith('https://') || vistos.has(id)) continue;
    vistos.add(id);
    fotos.push({
      id: `ov:${id}`,
      autor: typeof o.creator === 'string' ? o.creator : '',
      /**
       * ⚠️ LA MINIATURA VA DIRECTO A OPENVERSE, NO POR NUESTRO PROXY. Y esto es un
       * arreglo: proxeada, en producción se dibujaban **7 de 24** — «sigue trayendo
       * pocas fotos». En local daban 24 de 24, así que el bug no estaba en la
       * búsqueda: estaba en pasar veinticuatro imágenes por una función serverless,
       * cada una esperando a un tercero. Eso es una pared de concurrencia y arranques
       * en frío que no existe cuando el navegador las pide él.
       *
       * Medido antes de cambiarlo: las 20 miniaturas como `<img>` directo al endpoint
       * de Openverse cargan **20 de 20**, sin una sola falla.
       *
       * ⚠️ Y POR QUÉ ACÁ SÍ Y EN PICSUM NO: son dos problemas distintos. picsum
       * contesta un **302** que el navegador no sigue en volumen —las 24 quedaban en
       * blanco—, así que ahí el proxy no es una preferencia, es lo único que funciona.
       * Openverse sirve la imagen de una. El costo de ir directo es el referer del
       * cliente yendo a un tercero, que es el mismo que ya se paga con la foto de la
       * portada cuando se dibuja.
       */
      mini: `https://api.openverse.org/v1/images/${encodeURIComponent(id)}/thumb/`,
      grande,
      licencia: NOMBRE_LICENCIA[String(o.license ?? '')] ?? 'CC0',
    });
  }
  return { ok: true, fotos: fotos.slice(0, POR_PAGINA), pagina: tanda, hayMas: p1 + 1 < Math.min(20, a.paginas) };
}

/**
 * Buscar fotos: con texto, Openverse (traducido al inglés); sin texto, una tanda al azar de Picsum
 * en la proporción de la orientación. `pagina` es la tanda (1..20 con texto). Nunca tira: la falla
 * vuelve con su motivo, y «el buscador no contestó» no se confunde con «no hay fotos».
 */
export async function buscarStock(q: string, pagina = 1, orientacion: Orientacion = 'horizontal', semilla = 0): Promise<ResultadoBusqueda> {
  const texto = (q ?? '').trim();
  const or: Orientacion = orientacion in ASPECTO_OV ? orientacion : 'horizontal';
  if (!texto) return tandaPicsum(semilla, pagina, PROPORCION[or]);
  const tanda = Math.max(1, Math.min(20, Math.trunc(pagina) || 1));
  try {
    return await buscarEnOpenverse(texto, tanda, or);
  } catch (e) {
    const error = e instanceof Error && e.name === 'TimeoutError'
      ? 'El buscador de fotos tardó demasiado.'
      : e instanceof Error ? e.message : String(e);
    return { ok: false, error };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bajar con la baranda SSRF (la de lib/landing-fetch.ts, para binarios)
// ─────────────────────────────────────────────────────────────────────────────

const UA = 'Mozilla/5.0 (compatible; MaKoImagenes/1.0; +https://hola-mako.com)';
const MAX_SALTOS = 5;

/**
 * La conexión va a la IP QUE YA SE VALIDÓ (`validarDestino`), no a la que el cliente HTTP resolvería
 * por su cuenta: un DNS hostil con TTL 0 contesta una IP pública en el chequeo y 127.0.0.1 en la
 * conexión. Es la misma idea que `lookupClavado` de lib/landing-fetch.ts, que no la exporta (y la
 * suya baja HTML con un tope de 2 MB: acá son binarios de hasta 100 MB).
 */
function lookupClavado(ips: string[]): LookupFunction {
  const familia = (ip: string): 4 | 6 => (isIP(ip) === 6 ? 6 : 4);
  return ((_host, opts, cb) => {
    const elegidas = ips.map((ip) => ({ address: ip, family: familia(ip) }));
    if (opts && typeof opts === 'object' && opts.all) cb(null, elegidas);
    else cb(null, elegidas[0].address, elegidas[0].family);
  }) as LookupFunction;
}

type Bajada =
  | { ok: true; buf: Buffer; contentType: string }
  | { ok: false; codigo: 'destino' | 'http' | 'tope' | 'red'; status: number; error: string };

type Respuesta = { status: number; location: string | null; contentType: string; cuerpo: Buffer } | { tope: true };

/** Un pedido con la IP clavada, el tope aplicado MIENTRAS se lee y un plazo que cubre el cuerpo. */
function pedirBinario(url: URL, ips: string[], tope: number, plazoMs: number): Promise<Respuesta> {
  return new Promise((resolve, reject) => {
    const esHttps = url.protocol === 'https:';
    const pedir = esHttps ? pedidoHttps : pedidoHttp;
    let cerrado = false;
    const fallar = (e: Error) => { if (!cerrado) { cerrado = true; reject(e); } };
    const req = pedir(url, {
      method: 'GET',
      headers: { 'user-agent': UA, accept: 'image/*,video/*;q=0.9,*/*;q=0.5' },
      lookup: lookupClavado(ips),
      ...(esHttps ? { servername: url.hostname } : {}),
    }, (res) => {
      const trozos: Buffer[] = [];
      let bytes = 0;
      res.on('data', (c: Buffer) => {
        bytes += c.length;
        if (bytes > tope) { res.destroy(); if (!cerrado) { cerrado = true; resolve({ tope: true }); } return; }
        trozos.push(c);
      });
      res.on('end', () => {
        if (cerrado) return;
        cerrado = true;
        const loc = res.headers.location;
        resolve({
          status: res.statusCode ?? 0,
          location: Array.isArray(loc) ? loc[0] ?? null : loc ?? null,
          contentType: String(res.headers['content-type'] ?? ''),
          cuerpo: Buffer.concat(trozos),
        });
      });
      res.on('error', fallar);
    });
    const plazo = setTimeout(() => { req.destroy(); fallar(new Error('tardó demasiado')); }, Math.max(1000, plazoMs));
    req.on('close', () => clearTimeout(plazo));
    req.on('error', (e) => fallar(e));
    req.end();
  });
}

/**
 * Baja `raw` siguiendo hasta 5 redirects, revalidando el destino en CADA salto (un 302 hacia
 * 127.0.0.1 es la forma clásica de saltearse un chequeo que sólo mira la primera URL).
 */
async function bajarConGuarda(raw: string, tope: number, plazoMs = 25_000): Promise<Bajada> {
  const fin = Date.now() + plazoMs;
  let actual = raw;
  for (let salto = 0; salto <= MAX_SALTOS; salto++) {
    const check = await validarDestino(actual);
    if (!check.ok) return { ok: false, codigo: 'destino', status: 400, error: 'Ese enlace no es público' };
    let r: Respuesta;
    try {
      r = await pedirBinario(check.url, check.ips, tope, fin - Date.now());
    } catch (e) {
      return { ok: false, codigo: 'red', status: 502, error: `No pude bajar el archivo: ${e instanceof Error ? e.message : String(e)}` };
    }
    if ('tope' in r) return { ok: false, codigo: 'tope', status: 400, error: 'Pasa del tope' };
    if (r.status >= 300 && r.status < 400) {
      if (!r.location) return { ok: false, codigo: 'http', status: 502, error: `Redirige sin destino (${r.status})` };
      actual = new URL(r.location, check.url).toString();
      continue;
    }
    if (r.status < 200 || r.status >= 300) return { ok: false, codigo: 'http', status: 502, error: String(r.status) };
    return { ok: true, buf: r.cuerpo, contentType: r.contentType };
  }
  return { ok: false, codigo: 'http', status: 502, error: 'Redirige demasiadas veces' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Copiar al bucket
// ─────────────────────────────────────────────────────────────────────────────

export type OpcionesCopia = {
  /** Tope de bytes de la imagen (default: el de una imagen del editor, 15 MB). */
  tope?: number;
  /** El tamaño en que se baja una foto de Picsum (default: horizontal). */
  proporcion?: Proporcion;
  /** La ruta dentro del bucket, dada la extensión (default: `<ws>/<uuid>.<ext>`). */
  path?: (ext: string) => string;
  /** Crear el bucket si no existe (las portadas lo hacían así; el de landings lo crea su migración). */
  crearBucket?: boolean;
  /** Para qué se usa, al final del motivo de una foto con atribución («de portada»). */
  uso?: string;
};

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const mb = (n: number) => Math.round(n / (1024 * 1024));

async function subir(bucket: string, path: string, buf: Buffer, tipo: string, crearBucket: boolean): Promise<ResultadoCopia> {
  const supabase = getSupabaseServer();
  if (crearBucket) { try { await supabase.storage.createBucket(bucket, { public: true }); } catch { /* ya existe */ } }
  const { error } = await supabase.storage.from(bucket).upload(path, buf, { contentType: tipo, upsert: false });
  if (error) return { ok: false, error: error.message, status: 500 };
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { ok: true, url: data.publicUrl, tipo };
}

/**
 * Copia una foto del buscador a `bucket` y devuelve NUESTRA URL pública.
 *
 * `id` es el que dio `buscarStock`: `ov:<uuid>` (o el uuid pelado, como lo mandan las portadas) para
 * Openverse, o los dígitos de Picsum. ⚠️ Con el id, la URL la dice OPENVERSE: se le pregunta por
 * ese id y se baja lo que él conteste. El cliente no elige el destino. Y la licencia se vuelve a
 * mirar ACÁ: el filtro del buscador es lo que se OFRECE; esto es lo que se GUARDA, y entre las dos
 * cosas hay un id que viajó por el navegador (la regla de las dos capas, aplicada a un tercero).
 */
export async function copiarStockABucket(id: string, bucket: string, ws: number | null, op: OpcionesCopia = {}): Promise<ResultadoCopia> {
  const tope = op.tope ?? TOPE_IMAGEN_BYTES;
  const path = op.path ?? ((ext: string) => `${ws ?? 0}/${randomUUID()}.${ext}`);
  const crudo = typeof id === 'string' ? id.trim() : '';
  const ov = crudo.startsWith('ov:') ? crudo.slice(3) : crudo;

  let origen: string;
  if (RE_UUID.test(ov)) {
    const meta = await fetch(`https://api.openverse.org/v1/images/${ov}/`, { signal: AbortSignal.timeout(12_000) });
    if (!meta.ok) return { ok: false, error: `El buscador contestó ${meta.status}`, status: 502 };
    const j = (await meta.json()) as { url?: unknown; license?: unknown };
    if (!['cc0', 'pdm'].includes(String(j.license ?? ''))) {
      return { ok: false, error: `Esa foto pide atribución, así que no se puede usar${op.uso ? ` ${op.uso}` : ''}.`, status: 400 };
    }
    origen = typeof j.url === 'string' ? j.url : '';
    if (!origen.startsWith('https://')) return { ok: false, error: 'La foto no tiene una URL usable', status: 502 };
  } else if (/^[0-9]{1,6}$/.test(crudo)) {
    const p = op.proporcion ?? PROPORCION.horizontal;
    origen = `https://picsum.photos/id/${crudo}/${p.w}/${p.h}`;
  } else {
    return { ok: false, error: 'pedido inválido', status: 400 };
  }

  const b = await bajarConGuarda(origen, tope);
  if (!b.ok) {
    if (b.codigo === 'tope') return { ok: false, error: `La foto supera los ${mb(tope)}MB`, status: 400 };
    if (b.codigo === 'http') return { ok: false, error: `No pude bajar la foto (${b.error})`, status: 502 };
    return { ok: false, error: 'No pude bajar la foto', status: 502 };
  }
  // El tipo REAL por magic bytes, igual que en la subida: lo que diga el tercero
  // en su `content-type` es su palabra, no un dato.
  const tipo = sniffImagen(b.buf);
  if (!tipo) return { ok: false, error: 'El archivo no es una imagen que podamos usar', status: 400 };
  return subir(bucket, path(EXT_IMAGEN[tipo]), b.buf, tipo, op.crearBucket === true);
}

/**
 * «Desde un enlace»: baja una imagen (o un video, con `permitirVideo`) de una URL que pegó la persona
 * y la copia a `bucket`. Es el ÚNICO camino donde el destino lo elige el navegador, y por eso baja
 * con la baranda completa (cada salto revalidado, IP clavada, tope mientras se lee).
 */
export async function copiarUrlABucket(url: string, bucket: string, ws: number, op: { permitirVideo?: boolean; path?: (ext: string) => string } = {}): Promise<ResultadoCopia> {
  const raw = typeof url === 'string' ? url.trim() : '';
  if (!raw || raw.length > 2000 || !/^https?:\/\//i.test(raw)) return { ok: false, error: 'Ese enlace no es válido', status: 400 };
  const tope = op.permitirVideo ? TOPE_VIDEO_BYTES : TOPE_IMAGEN_BYTES;
  const b = await bajarConGuarda(raw, tope, op.permitirVideo ? 90_000 : 25_000);
  if (!b.ok) {
    if (b.codigo === 'tope') return { ok: false, error: op.permitirVideo ? 'Pasa de 100 MB' : 'Pasa de 15 MB', status: 400 };
    if (b.codigo === 'destino') return { ok: false, error: b.error, status: 400 };
    if (b.codigo === 'http') return { ok: false, error: `El enlace contestó ${b.error}`, status: 502 };
    return { ok: false, error: 'No pude bajar el archivo', status: 502 };
  }
  const tipo = op.permitirVideo ? sniffMedia(b.buf) : sniffImagen(b.buf);
  if (!tipo) return { ok: false, error: op.permitirVideo ? 'No es una imagen ni un video' : 'No es una imagen', status: 400 };
  if (!esTipoVideo(tipo) && b.buf.length > TOPE_IMAGEN_BYTES) return { ok: false, error: 'Pasa de 15 MB', status: 400 };
  const path = op.path ?? ((ext: string) => `${ws}/${randomUUID()}.${ext}`);
  return subir(bucket, path(EXT_MEDIA[tipo]), b.buf, tipo, false);
}

/**
 * Lo que usa la GENERACIÓN con IA (paquete E): la IA propone qué buscar (en inglés) y esto devuelve
 * la URL de una foto ya copiada al bucket de landings, o null.
 *
 * ⚠️ NULL Y NO UN PLACEHOLDER: si no hay foto, la sección queda sin imagen. Una imagen de relleno
 * que no tiene nada que ver con el texto miente sobre la landing (D5). Prueba hasta tres resultados
 * (uno puede pedir atribución o no bajar) y nunca tira: la generación sigue sin imagen.
 */
export async function buscarYCopiar(q: string, ws: number, orientacion: Orientacion = 'horizontal'): Promise<string | null> {
  const texto = (q ?? '').trim();
  if (!texto) return null;
  try {
    const r = await buscarStock(texto, 1, orientacion);
    if (!r.ok) { console.warn(`[imagenes-stock] buscar «${texto.slice(0, 60)}»: ${r.error}`); return null; }
    for (const f of r.fotos.slice(0, 3)) {
      const c = await copiarStockABucket(f.id, BUCKET_LANDING, ws, { proporcion: PROPORCION[orientacion] ?? PROPORCION.horizontal });
      if (c.ok) return c.url;
      console.warn(`[imagenes-stock] no pude copiar ${f.id}: ${c.error}`);
    }
    return null;
  } catch (e) {
    console.warn(`[imagenes-stock] buscarYCopiar «${texto.slice(0, 60)}»: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}
