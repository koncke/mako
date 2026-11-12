// =============================================================================
// «Guardar en Spy»: lo que manda la extensión se interpreta ACÁ
// =============================================================================
// Martín decidió el 3/11/2026 leer la Biblioteca de Anuncios «con un clic», sabiendo lo que dicen los
// términos de Meta (docs/diseno-competitors-spy.md §9.1). extension/spy-leer.js sólo lee lo ya dibujado y
// no decide nada: qué es un anuncio, un píxel o un checkout se decide en este archivo.
//
// ⚠️ POR QUÉ ACÁ Y NO EN LA EXTENSIÓN: una página ajena cambia su diseño sin avisar. Un arreglo acá es un
// deploy; en la extensión, otra revisión de Chrome que puede tardar semanas.
//
// ⚠️ LO QUE LLEGA NO ES DE FIAR: lo manda un navegador, y cualquiera con un token puede mandar lo que
// quiera. Por eso `leerCaptura` lo vuelve a armar, la miniatura sólo puede ser del CDN de Meta (el
// servidor la va a bajar) y el enlace de cada anuncio se construye con su id, no se copia.
//
// Puro y sin `server-only`. Las formas de abajo se midieron el 3/11/2026 en la Biblioteca real, en inglés,
// español y portugués: docs/hallazgos-competitors-spy.md.
// =============================================================================

import type { PiezaVista } from './spy';
import { leerFunnel, piezasDeVideoEn, type LecturaFunnel } from './spy-funnel';
import { cortarTexto, dominioComparable, nombreComparable, nombreParaBuscar, TOPES } from './spy-reglas';
import { esAgregador } from './spy-otras-redes-reglas';
import type { Medio } from './spy-medio';

const TOPE_DIRECCIONES = 500;
const TOPE_LARGO_DIRECCION = 2_000;
const TOPE_TOKENS = 20_000;
const TOPE_TEXTO_TOKEN = 4_000;

/** Un tramo de lo dibujado, en el orden de la página. */
export type Token = ['t', string] | ['a', string | null, string] | ['i', string, number, number, string] | ['v', string];

export type CapturaSitio = {
  modo: 'sitio'; url: string; titulo: string;
  recursos: string[]; scripts: string[]; enlaces: string[]; iframes: string[]; formularios: string[];
};
export type CapturaBiblioteca = { modo: 'biblioteca'; busqueda: string; pagina: string; id: string; tokens: Token[] };
export type Captura = CapturaSitio | CapturaBiblioteca;

/**
 * Donde no se lee nunca, aunque llegue. WhatsApp Web es lo que importa: ahí hay chats de personas. Los
 * otros son la propia app y Flow. Las mismas tres viven en extension/spy-leer.js y extension/spy-reglas.js,
 * que no pueden importar nada: lo fija tests/spy-captura.test.ts.
 */
export const SITIOS_PROHIBIDOS = ['web.whatsapp.com', 'hola-mako.com', 'labs.google', 'flow.google.com'] as const;

const hostDe = (url: string): string | null => {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return null; }
};
const esDelDominio = (host: string, dominio: string): boolean => host === dominio || host.endsWith(`.${dominio}`);

export const esSitioProhibido = (url: string): boolean => {
  const h = hostDe(url);
  return !h || SITIOS_PROHIBIDOS.some((d) => esDelDominio(h, d)) || h === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(h);
};

/** Una red no es «su sitio»: el píxel de instagram.com es de Instagram, no del competidor. */
const REDES = ['instagram.com', 'facebook.com', 'youtube.com', 'youtu.be', 'tiktok.com', 'x.com', 'twitter.com', 'threads.net', 'linkedin.com'];
export const esRedSocial = (url: string): boolean => {
  const h = hostDe(url);
  return !!h && REDES.some((d) => esDelDominio(h, d));
};

const direcciones = (v: unknown): string[] => (Array.isArray(v) ? v : [])
  .filter((d): d is string => typeof d === 'string' && d.length <= TOPE_LARGO_DIRECCION && /^https?:\/\//i.test(d))
  .slice(0, TOPE_DIRECCIONES);

const texto = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');
const numero = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function tokenDe(v: unknown): Token | null {
  if (!Array.isArray(v)) return null;
  if (v[0] === 't' && typeof v[1] === 'string') return ['t', texto(v[1], TOPE_TEXTO_TOKEN)];
  if (v[0] === 'a') return ['a', typeof v[1] === 'string' ? texto(v[1], TOPE_LARGO_DIRECCION) : null, texto(v[2], TOPE_TEXTO_TOKEN)];
  if (v[0] === 'i' && typeof v[1] === 'string') return ['i', texto(v[1], TOPE_LARGO_DIRECCION), numero(v[2]), numero(v[3]), texto(v[4], 200)];
  if (v[0] === 'v' && typeof v[1] === 'string') return ['v', texto(v[1], TOPE_LARGO_DIRECCION)];
  return null;
}

/** Lo que llegó, armado de nuevo campo por campo. `null` = no se puede usar, y no se guarda nada. */
export function leerCaptura(v: unknown): Captura | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const c = v as Record<string, unknown>;
  if (c.modo === 'sitio') {
    const url = texto(c.url, TOPE_LARGO_DIRECCION);
    if (!/^https?:\/\//i.test(url) || esSitioProhibido(url)) return null;
    return {
      modo: 'sitio', url, titulo: texto(c.titulo, TOPES.titulo),
      recursos: direcciones(c.recursos), scripts: direcciones(c.scripts), enlaces: direcciones(c.enlaces),
      iframes: direcciones(c.iframes), formularios: direcciones(c.formularios),
    };
  }
  if (c.modo === 'biblioteca') {
    const tokens = (Array.isArray(c.tokens) ? c.tokens : []).slice(0, TOPE_TOKENS).map(tokenDe).filter((t): t is Token => !!t);
    return { modo: 'biblioteca', busqueda: texto(c.busqueda, 200), pagina: /^\d{5,25}$/.test(texto(c.pagina, 30)) ? texto(c.pagina, 30) : '', id: /^\d{5,25}$/.test(texto(c.id, 30)) ? texto(c.id, 30) : '', tokens };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Un sitio: sus direcciones
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lo que se guarda de un sitio. Los píxeles y el video salen de lo que la página CARGÓ, y el checkout, de
 * lo que carga y de lo que enlaza: un enlace a un artículo sobre Google Tag Manager no es Tag Manager.
 *
 * El `ref` va sin consulta: es la llave de la fila, y la consulta cambia en cada visita.
 */
export function sitioDe(c: CapturaSitio, ahora?: Date): { ref: string; lectura: LecturaFunnel; piezas: string[] } {
  const u = new URL(c.url);
  const cargado = [...c.recursos, ...c.scripts, ...c.iframes].join('\n');
  const destinos = [...c.enlaces, ...c.formularios].join('\n');
  const carga = leerFunnel({ html: cargado, piezas: piezasDeVideoEn(cargado), ahora });
  const va = leerFunnel({ html: destinos, ahora });
  const checkouts = [...va.checkouts, ...carga.checkouts.filter((x) => !va.checkouts.some((y) => y.url === x.url))];
  // Las mismas piezas que da el analizador, para que la pantalla no pierda sus nombres al leer desde acá.
  const piezas = [...piezasDeVideoEn(cargado)];
  if (c.formularios.length) piezas.push('formulario');
  if (/calendly\.com|cal\.com\/|typeform\.com|savvycal\.com|hubspot\.com\/meetings|tally\.so/i.test(`${cargado}\n${destinos}`)) piezas.push('embed-agenda');
  if (/wa\.me\/|api\.whatsapp\.com/i.test(destinos)) piezas.push('link-whatsapp');
  if (c.enlaces.length) piezas.push('botones');
  return { ref: `${u.origin}${u.pathname}`, lectura: { ...carga, checkouts }, piezas };
}

// ─────────────────────────────────────────────────────────────────────────────
// La Biblioteca: de lo dibujado a anuncios
// ─────────────────────────────────────────────────────────────────────────────

export type AnuncioLeido = {
  id: string;
  /** El día que dice que empezó. `null` = no se pudo leer: no hay días al aire que afirmar. */
  desde: string | null;
  /** El día que dice que terminó. `null` = sigue, o no lo dice. */
  hasta: string | null;
  pagina: { nombre: string; handle: string | null } | null;
  /** El id de su Página en Meta, si lo trae (el actor de Apify sí). Es lo que la identifica: el nombre lo puede repetir otro. */
  paginaId?: string | null;
  texto: string | null;
  titulo: string | null;
  destino: string | null;
  miniatura: string | null;
  /** Imagen, video o carrusel (lib/spy-medio.ts, `medioDeAnuncio`), si la fuente lo dijo: el explorador de Image muestra sólo los de imagen. */
  medio?: Medio | null;
};

const MESES: Record<string, number> = {
  jan: 0, ene: 0, feb: 1, fev: 1, mar: 2, apr: 3, abr: 3, may: 4, mai: 4, jun: 5, jul: 6, aug: 7, ago: 7,
  sep: 8, set: 8, oct: 9, out: 9, nov: 10, dec: 11, dic: 11, dez: 11,
};

const isoDe = (dia: number, mes: string, anio: number): string | null => {
  const m = MESES[mes.toLowerCase().slice(0, 3)];
  if (m == null || dia < 1 || dia > 31) return null;
  const d = new Date(Date.UTC(anio, m, dia));
  return d.getUTCMonth() === m ? d.toISOString() : null;
};

/**
 * Las fechas de la línea de un anuncio, en el orden en que aparecen. Las formas medidas:
 *   · «Started running on Jul 29, 2026», «Jul 1, 2026 - Aug 11, 2026»
 *   · «En circulación desde el 29 jul 2026», «30 jun 2026 - 11 ago 2026»
 *   · «Veiculação iniciada em 29 de jul de 2026», «30 de jun de 2026 a 11 de ago de 2026»
 */
export function fechasDe(linea: string): string[] {
  const out: Array<{ i: number; iso: string }> = [];
  for (const m of linea.matchAll(/(\d{1,2})\s+(?:de\s+)?([a-zA-Z]{3})[a-zA-Z]*\.?\s+(?:de\s+)?(\d{4})/g)) {
    const iso = isoDe(Number(m[1]), m[2], Number(m[3]));
    if (iso) out.push({ i: m.index ?? 0, iso });
  }
  for (const m of linea.matchAll(/\b([a-zA-Z]{3})[a-zA-Z]*\.?\s+(\d{1,2}),?\s+(\d{4})/g)) {
    const iso = isoDe(Number(m[2]), m[1], Number(m[3]));
    if (iso) out.push({ i: m.index ?? 0, iso });
  }
  return out.sort((a, b) => a.i - b.i).map((x) => x.iso);
}

const RE_ID = /^[^:\d]*(?:library|bibliot|biblioth|identif)[^:\d]*:\s*(\d{10,25})$/i;
const RE_PATROCINADO = /^(?:sponsored|publicidad|patrocinad[oa]|publicidade|sponsoris[ée]|gesponsert)$/i;
const RE_TIEMPO_DE_VIDEO = /^\d+:\d{2}(?:\s*\/\s*\d+:\d{2})?$/;
const RE_DOMINIO = /^[A-Z0-9][A-Z0-9.-]*\.[A-Z]{2,}$/;
const parecDireccion = (t: string): boolean => /^(?:https?:\/\/|www\.)\S+$/i.test(t.trim());

const esDeMeta = (url: string | null): boolean => {
  const h = url ? hostDe(url) : null;
  return !!h && esDelDominio(h, 'facebook.com');
};
const esSalto = (url: string | null): boolean => !!url && /^https?:\/\/l\.facebook\.com\/l\.php\?/i.test(url);
/** El pie y el menú de la Biblioteca: de acá para abajo ya no es la tarjeta. */
const esDelArmazon = (url: string | null): boolean => !!url && /facebook\.com\/(?:ads\/|privacy|policies|policy|language|help)/i.test(url);

const handleDe = (url: string): string | null => {
  try {
    const u = new URL(url);
    if (u.pathname === '/profile.php') return u.searchParams.get('id');
    return u.pathname.split('/').filter(Boolean)[0]?.slice(0, 100) ?? null;
  } catch { return null; }
};

/** El destino de un enlace de salida: `l.php?u=<destino>`. Sin consulta ni camino: sólo a qué dominio manda. */
const destinoDe = (url: string): string | null => {
  try {
    const u = new URL(new URL(url).searchParams.get('u') ?? '');
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    const h = u.hostname.toLowerCase().replace(/^www\./, '');
    return h === 'fb.me' ? null : h.slice(0, 200);
  } catch { return null; }
};

/** ⚠️ Sólo del CDN de Meta: el servidor va a bajar esta imagen, y si no, es un SSRF con un token cualquiera. */
const esDelCdn = (url: string): boolean => {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && /(^|\.)fbcdn\.net$/.test(u.hostname);
  } catch { return false; }
};

/** ¿Este token abre un anuncio? El id solo no alcanza: el copy de un anuncio puede decir «ID: 1234567890». */
function idDeAnuncio(tokens: readonly Token[], i: number): string | null {
  const t = tokens[i];
  if (t[0] !== 't') return null;
  const m = t[1].match(RE_ID);
  if (!m) return null;
  const hayFecha = tokens.slice(i + 1, i + 4).some((x) => x[0] === 't' && fechasDe(x[1]).length > 0);
  return hayFecha ? m[1] : null;
}

function anuncioDe(id: string, tramo: readonly Token[]): AnuncioLeido {
  const fechas = tramo.slice(0, 3).flatMap((x) => (x[0] === 't' ? fechasDe(x[1]) : []));

  const iPagina = tramo.findIndex((x) => x[0] === 'a' && esDeMeta(x[1]) && !esSalto(x[1]) && !esDelArmazon(x[1]));
  const linkPagina = iPagina >= 0 ? (tramo[iPagina] as ['a', string, string]) : null;
  const pagina = linkPagina?.[2]
    ? { nombre: cortarTexto(linkPagina[2].split('\n')[0], TOPES.nombre), handle: handleDe(linkPagina[1]) }
    : null;

  // El copy va del «Publicidad» al primer enlace que NO es una dirección escrita en el texto: ése es el
  // creativo. Los enlaces escritos adentro del copy también salen por l.php, y son parte de lo que dice.
  const desde = iPagina >= 0 ? iPagina + 1 : 0;
  const iCreativo = tramo.findIndex((x, i) => i >= desde && x[0] === 'a' && esSalto(x[1]) && !!x[2] && !parecDireccion(x[2]));
  const copy: string[] = [];
  for (let i = desde; i < (iCreativo >= 0 ? iCreativo : tramo.length); i++) {
    const x = tramo[i];
    if (x[0] === 'a' && esDelArmazon(x[1])) break;
    if (x[0] === 't' && !RE_PATROCINADO.test(x[1]) && !RE_TIEMPO_DE_VIDEO.test(x[1])) copy.push(x[1]);
    if (x[0] === 'a' && x[2] && esSalto(x[1])) copy.push(x[2]);
  }

  // Las líneas del creativo: dominio en mayúsculas (si está), titular, descripción, botón.
  const creativo = iCreativo >= 0 ? (tramo[iCreativo] as ['a', string, string]) : null;
  const lineas = creativo ? creativo[2].split('\n').map((l) => l.trim()).filter(Boolean) : [];
  const titular = RE_DOMINIO.test(lineas[0] ?? '') ? lineas[1] : lineas[0];
  const conDestino = creativo ?? tramo.find((x) => x[0] === 'a' && esSalto(x[1]) && !!destinoDe(x[1] as string)) as ['a', string, string] | undefined;

  // La imagen del anuncio: la más grande, que no es la foto de perfil (60×60, justo antes del nombre).
  let miniatura: string | null = null;
  let area = 0;
  for (const x of tramo) {
    if (x[0] === 'a' && esDelArmazon(x[1])) break;
    if (x[0] === 'i' && esDelCdn(x[1]) && Math.min(x[2], x[3]) >= 100 && x[2] * x[3] > area) { area = x[2] * x[3]; miniatura = x[1]; }
    if (x[0] === 'v' && esDelCdn(x[1]) && !miniatura) miniatura = x[1];
  }

  return {
    id,
    desde: fechas[0] ?? null,
    hasta: fechas[1] ?? null,
    pagina,
    texto: copy.join('\n').trim() || null,
    titulo: titular ? cortarTexto(titular, TOPES.titulo) : null,
    destino: conDestino ? destinoDe(conDestino[1]) : null,
    miniatura,
    medio: medioDeLaTarjeta(tramo),
  };
}

/**
 * ¿La tarjeta dice que el anuncio es un VIDEO? (6/11/2026) Lo decía de dos formas y las dos se tiraban:
 *   · el content script manda un token `'v'` por cada `<video>` dibujado, con su poster (extension/spy-leer.js), y acá se
 *     usaba sólo como miniatura de respaldo;
 *   · la Biblioteca escribe el tiempo del video sobre el creativo («0:15», «0:04 / 1:20») y `RE_TIEMPO_DE_VIDEO` lo saca
 *     del copy para que no ensucie el texto, sin anotar lo que ese token significaba.
 *
 * ⚠️ Sin ninguna de las dos señales devuelve `null`, NO «imagen»: una tarjeta que todavía no cargó su video muestra sólo su
 * portada como imagen, y afirmar «imagen» ahí es exactamente el error que esto viene a arreglar (un video en una pantalla de
 * imágenes). Un «no se sabe» se muestra igual, pero contado aparte (lib/carruseles/anuncios.ts).
 *
 * El token `'v'` se exige del CDN de Meta, como la miniatura: lo que llega lo manda un navegador y no es de fiar.
 */
function medioDeLaTarjeta(tramo: readonly Token[]): Medio | null {
  for (const x of tramo) {
    if (x[0] === 'a' && esDelArmazon(x[1])) break;
    if (x[0] === 'v' && esDelCdn(x[1])) return 'video';
    if (x[0] === 't' && RE_TIEMPO_DE_VIDEO.test(x[1])) return 'video';
  }
  return null;
}

/** Los anuncios de lo dibujado, sin repetidos. Una tarjeta llega hasta la que sigue. */
export function anunciosDe(tokens: readonly Token[]): AnuncioLeido[] {
  const inicios: Array<{ i: number; id: string }> = [];
  tokens.forEach((_, i) => {
    const id = idDeAnuncio(tokens, i);
    if (id) inicios.push({ i, id });
  });
  const vistos = new Map<string, AnuncioLeido>();
  inicios.forEach(({ i, id }, k) => {
    // `k + 1`: el estado de la tarjeta siguiente («Activo») queda al final de este tramo y se descarta
    // solo, porque va después del creativo.
    const hasta = k + 1 < inicios.length ? inicios[k + 1].i : tokens.length;
    if (!vistos.has(id)) vistos.set(id, anuncioDe(id, tokens.slice(i + 1, hasta)));
  });
  return [...vistos.values()];
}

/**
 * De todas las tarjetas, las de este competidor. Una búsqueda por palabra trae las de cualquiera, así que cada anuncio se VERIFICA
 * antes de mostrarse (4/11/2026, Martín con Den Borg: «Y darse cuenta si es o no es... Porque evidentemente no es»):
 *   · la Página que pauta se llama como él (su nombre entero o el corto, sin lo de después de « - ») o como su @ de Instagram;
 *   · o es su Página guardada;
 *   · o el anuncio lleva a SU web. ⚠️ Una página de enlaces (beacons, linktree…) no es su web: es de todos, y del anuncio sólo se
 *     guarda el DOMINIO al que manda (`destinoDe`), así que «manda a beacons.page» no dice de quién es. Ahí decide la Página.
 */
export function anunciosDeQuien(
  anuncios: readonly AnuncioLeido[],
  quien: { nombre: string; instagram?: string | null; landing_url?: string | null; pagina_anuncios?: string | null },
  /** La pestaña estaba en la Página de un anunciante: todo lo que se ve es suyo. */
  deUnaPagina: boolean,
): { suyos: AnuncioLeido[]; otros: number } {
  if (deUnaPagina) return { suyos: [...anuncios], otros: 0 };
  const nombres = new Set([nombreComparable(quien.nombre), nombreComparable(nombreParaBuscar(quien.nombre)), nombreComparable(quien.instagram ?? '')].filter((n) => n.length >= 3));
  const agregador = !!quien.landing_url && esAgregador(quien.landing_url);
  const dominio = quien.landing_url && !agregador ? dominioComparable(quien.landing_url) : '';
  const pagina = (quien.pagina_anuncios ?? '').toLowerCase();
  const suyos = anuncios.filter((a) => (
    (!!a.pagina && (nombres.has(nombreComparable(a.pagina.nombre)) || (!!a.pagina.handle && nombres.has(nombreComparable(a.pagina.handle)))))
    || (!!pagina && a.pagina?.handle?.toLowerCase() === pagina)
    // Su Página por su id (el que se aprendió de una corrida verificada): lo único que no repite nadie.
    || (/^\d{5,25}$/.test(pagina) && !!a.paginaId && a.paginaId === pagina)
    || (!!dominio && !!a.destino && esDelDominio(a.destino, dominio))
  ));
  return { suyos, otros: anuncios.length - suyos.length };
}

/** La Página que más aparece: para «Agregar como competidor», donde todavía no hay de quién. */
export function paginaMasVista(anuncios: readonly AnuncioLeido[]): { nombre: string; handle: string | null } | null {
  const cuenta = new Map<string, { n: number; pagina: NonNullable<AnuncioLeido['pagina']> }>();
  for (const a of anuncios) {
    if (!a.pagina) continue;
    const k = nombreComparable(a.pagina.nombre);
    const hay = cuenta.get(k);
    cuenta.set(k, { n: (hay?.n ?? 0) + 1, pagina: hay?.pagina ?? a.pagina });
  }
  return [...cuenta.values()].sort((a, b) => b.n - a.n)[0]?.pagina ?? null;
}

/**
 * El anuncio como pieza. `recorrido` porque lo dice la pantalla: no es lo mismo que uno que pegó la persona.
 * ⚠️ El enlace se construye con el id: copiar el que llegó sería guardar lo que quiera el que manda.
 */
export const piezaDeAnuncio = (a: AnuncioLeido): PiezaVista => ({
  canal: 'anuncios', tipo: 'anuncio', ref: a.id, fuente: 'recorrido',
  url: `https://www.facebook.com/ads/library/?id=${a.id}`,
  titulo: a.titulo, texto: a.texto, dominioDestino: a.destino, publicadaEn: a.desde, dejoDeVerseEn: a.hasta,
  miniatura: a.miniatura, medio: a.medio ?? null,
});
