// =============================================================================
// spy-todo-reglas — traer TODO lo que publica y todos sus anuncios (puntos 8 y 10 del 4/11/2026)
// =============================================================================
// Martín, 4/11: «que no traiga solo 50 reels o videos, que traiga muchos más, si puede, todos directamente» y «falta todo
// lo de ADS en Competitors Spy, todos los anuncios de la biblioteca de anuncios... Que los traiga para analizarlos».
//
// Lo puro, con test: qué se le pide a cada actor, cuánto puede costar como mucho, cada cuánto, cómo se lee lo que vuelve y
// qué cuenta como «lo borró». La red (empezar una corrida, mirarla, leer su dataset) está en `lib/spy-todo.ts`.
//
// ⚠️ CORRIDAS LARGAS QUE NO SE ESPERAN. Cien publicaciones tardan un minuto o dos en Apify; esperar adentro de una lectura
// la cortaría a los 60 s de la ruta. Se EMPIEZA la corrida (`/runs`, contesta en el acto), se anota su id, y la pantalla
// pregunta cada tanto. Si se cierra la pestaña, la corrida termina igual en Apify y la próxima apertura la recoge.
//
// ⚠️ LO PAGA CADA NEGOCIO, con SU clave de Spy (la de Apify que se conecta en Integraciones). Los números y el porqué están en
// docs/diseno-competitors-spy.md §14. Cada corrida lleva su techo en dólares (`maxTotalChargeUsd`) y su tope de ítems.
// =============================================================================

import type { AnuncioLeido } from './spy-captura';
import { medioDeAnuncio } from './spy-medio';
import { cortarTexto, TOPES } from './spy-reglas';

/** El actor de publicaciones de Instagram: el mismo `apify~instagram-scraper` que ya busca por nombre, con `resultsType: posts`. */
export const APIFY_ACTOR_PUBLICACIONES = 'apify~instagram-scraper';
/** El actor de la Biblioteca de Anuncios, el oficial de Apify. Lee la Biblioteca pública, sin la sesión de nadie. */
export const APIFY_ACTOR_ANUNCIOS = 'apify~facebook-ads-scraper';

/** Cuántas publicaciones trae la PRIMERA corrida. Con eso se ven sus reels de un año o más. */
export const PUBLICACIONES_PRIMERA = 300;
/** Cuántas trae cada corrida siguiente: sólo lo nuevo desde la anterior. */
export const PUBLICACIONES_REFRESCO = 40;
/** Precio de la tienda de Apify (US$2,30 por mil en el plan gratis; menos en los pagos). Se usa el más alto para el techo. */
export const USD_POR_PUBLICACION = 0.0023;

/** Cuántos anuncios trae una corrida (activos y viejos). */
export const ANUNCIOS_POR_CORRIDA = 200;
/** Techo por anuncio: la tienda no se pudo leer desde la nube. Se usa uno alto para que el techo no corte una corrida sana. */
export const USD_POR_ANUNCIO = 0.006;

/** Cada cuánto se vuelve a pedir todo de un competidor. Entre medio, la lectura de siempre trae lo último. */
export const DIAS_ENTRE_CORRIDAS = 7;
/** Cuántas corridas largas empieza un negocio por día, sumando publicaciones y anuncios. */
export const CORRIDAS_LARGAS_POR_DIA = 6;
/** Dónde se cuentan las corridas largas del día del negocio: en la base, para que el tope valga entre procesos. */
export const CLAVE_DIA = 'spy.todo.dia';

/**
 * El guion de un reel (4/11/2026, lib/spy-transcripcion.ts): UNA publicación por Apify para tener su video fresco (el enlace
 * del CDN de Instagram vence en días). Cuántas por día como mucho, con la clave de Spy del negocio, y dónde se cuentan.
 */
export const TRANSCRIPCIONES_POR_DIA = 40;
export const CLAVE_DIA_TRANSCRIPCIONES = 'spy.transcripciones.dia';

/** Lo que se le pide al actor para UNA publicación: su enlace, y nada más. */
export function entradaDeUnaPublicacion(enlace: string): Record<string, unknown> {
  return { directUrls: [enlace], resultsType: 'posts', resultsLimit: 1, addParentData: false };
}

/** El video de lo que devolvió el actor: el primer `videoUrl` https. null si no vino (no es un video, o Instagram no lo dio). */
export function videoDelItem(items: unknown): string | null {
  for (const it of Array.isArray(items) ? items : []) {
    const v = it && typeof it === 'object' ? (it as { videoUrl?: unknown }).videoUrl : null;
    if (typeof v === 'string' && /^https:\/\//.test(v)) return v;
  }
  return null;
}

/**
 * Lo que se le pide al actor de anuncios para UN anuncio: su página de la biblioteca (13/11/2026, Copywriting transcribe los
 * anuncios en video de la competencia; el enlace del video vence, así que se pide fresco al transcribir, como el de un reel).
 */
export function entradaDeUnAnuncio(enlace: string): Record<string, unknown> {
  return { startUrls: [{ url: enlace }], resultsLimit: 1, isDetailsPerAd: false, onlyTotal: false };
}

/** El video de un anuncio: `snapshot.videos[].videoHdUrl` (o el SD), o el de una de sus tarjetas. null = no vino ninguno. */
export function videoDelAnuncio(items: unknown): string | null {
  const https = (v: unknown) => (typeof v === 'string' && /^https:\/\//.test(v) ? v : null);
  const deUno = (o: unknown) => {
    const x = (o && typeof o === 'object' ? o : {}) as Record<string, unknown>;
    return https(x.videoHdUrl) ?? https(x.video_hd_url) ?? https(x.videoSdUrl) ?? https(x.video_sd_url);
  };
  for (const it of Array.isArray(items) ? items : []) {
    const snap = (it && typeof it === 'object' ? (it as { snapshot?: unknown }).snapshot : null) as Record<string, unknown> | null;
    if (!snap || typeof snap !== 'object') continue;
    for (const lista of [snap.videos, snap.cards]) {
      for (const v of Array.isArray(lista) ? lista : []) { const u = deUno(v); if (u) return u; }
    }
  }
  return null;
}

/** Cuántas corridas largas ya empezó el negocio en `dia` (YYYY-MM-DD). Otro día, o algo ilegible, es 0. */
export function usadasHoy(crudo: string | null, dia: string): number {
  try {
    const v = JSON.parse(crudo ?? 'null') as { fecha?: unknown; usadas?: unknown } | null;
    return v && v.fecha === dia && Number.isInteger(v.usadas) && (v.usadas as number) >= 0 ? (v.usadas as number) : 0;
  } catch {
    return 0;
  }
}

/**
 * PRENDIDO el 4/11/2026, con la medición del Cerebro desde la PC (`scripts/probar-anuncios-apify.mjs`, ws 9): por «Alex Hormozi»,
 * 10 ítems leídos por `anuncioDeApify` a US$0,0058 cada uno (dentro del techo de `USD_POR_ANUNCIO`), y el primero era de OTRA
 * Página («Skool»): por eso nada se guarda sin verificar de quién es (`anunciosDeQuien`, y su Página por id cuando se aprende).
 * Por «Víctor Heras», 0 ítems y US$0: se prueban sus otras búsquedas (`siguienteDeAnuncios`).
 */
export const ANUNCIOS_POR_APIFY = true;

/** Una corrida en marcha de un canal, o la fecha de la última que terminó. */
export type TareaLarga = {
  run?: string; dataset?: string; pedidaEn?: string; ultima?: string;
  /** Anuncios: cuál de sus búsquedas (`busquedasDeSusAnuncios`) se está probando. Sin esto, la primera. */
  busqueda?: number;
  /** Anuncios: la corrida en marcha va por ESTA Página (su id): todo lo que traiga es suyo. Sin esto, va por una palabra. */
  pagina?: string;
  /** Anuncios: el día que se probaron todas sus búsquedas y no pautaba. Es un dato, no un error. */
  sinAnuncios?: string;
  /**
   * La HUELLA de la clave de Spy con que se pidió la corrida en marcha (5/11/2026, varias claves de Apify). Lo que empezó una cuenta
   * de Apify sólo lo puede leer esa cuenta: con otra clave, su corrida y su dataset no existen. Nunca la clave, sólo su huella.
   * Sin esto (las corridas de antes), la clave 1.
   */
  clave?: string;
};
export type TareasDeCompetidor = { instagram?: TareaLarga; anuncios?: TareaLarga };
export type RegistroTareas = Record<string, TareasDeCompetidor>;

/** Clave del setting del negocio. */
export const CLAVE_TAREAS = 'spy.todo';

const esObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const fecha = (v: unknown): string | undefined => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? v : undefined);

function tarea(v: unknown): TareaLarga | undefined {
  if (!esObj(v)) return undefined;
  const t: TareaLarga = {};
  if (/^[A-Za-z0-9]{6,40}$/.test(str(v.run))) t.run = str(v.run);
  if (/^[A-Za-z0-9]{6,40}$/.test(str(v.dataset))) t.dataset = str(v.dataset);
  if (fecha(v.pedidaEn)) t.pedidaEn = v.pedidaEn as string;
  if (fecha(v.ultima)) t.ultima = v.ultima as string;
  if (Number.isInteger(v.busqueda) && (v.busqueda as number) >= 0 && (v.busqueda as number) < 10) t.busqueda = v.busqueda as number;
  if (/^\d{5,25}$/.test(str(v.pagina))) t.pagina = str(v.pagina);
  if (fecha(v.sinAnuncios)) t.sinAnuncios = v.sinAnuncios as string;
  if (/^[a-f0-9]{16}$/.test(str(v.clave))) t.clave = str(v.clave);
  // Una corrida sin su dataset no se puede leer: es como si no estuviera.
  if (t.run && !t.dataset) delete t.run;
  return t;
}

/** Lee el registro guardado. Lo que no tiene la forma se descarta. */
export function leerTareas(crudo: string | null | undefined): RegistroTareas {
  let v: unknown;
  try { v = JSON.parse(crudo ?? '{}'); } catch { return {}; }
  if (!esObj(v)) return {};
  const out: RegistroTareas = {};
  for (const [k, e] of Object.entries(v)) {
    if (!/^\d+$/.test(k) || !esObj(e)) continue;
    const t: TareasDeCompetidor = {};
    const ig = tarea(e.instagram);
    const ad = tarea(e.anuncios);
    if (ig) t.instagram = ig;
    if (ad) t.anuncios = ad;
    out[k] = t;
  }
  return out;
}

/**
 * ¿Toca empezar otra corrida? Si nunca hubo, o la última terminó hace más de `dias` (`DIAS_ENTRE_CORRIDAS`; un competidor
 * SEGUIDO, cada día: `DIAS_ENTRE_CORRIDAS_SEGUIDO`, lib/spy-seguidos-reglas.ts). Nunca con una en marcha.
 */
export function tocaPedir(t: TareaLarga | undefined, ahora: number, dias: number = DIAS_ENTRE_CORRIDAS): boolean {
  if (t?.run) return false;
  if (!t?.ultima) return true;
  return ahora - Date.parse(t.ultima) >= dias * 86_400_000;
}

/**
 * La `ultima` que deja una corrida que no sirvió (sin su clave, vacía) para volver a intentar MAÑANA, con cualquier cadencia:
 * con 7 días es «hace 6», como antes; con la de un seguido (1 día), «ahora».
 */
export const ultimaParaManana = (ahora: number, dias: number = DIAS_ENTRE_CORRIDAS): string =>
  new Date(ahora - Math.max(0, dias - 1) * 86_400_000).toISOString();

/** Cuántas publicaciones pedir y desde cuándo: la primera vez, muchas; después, sólo lo nuevo. */
export function pedidoDePublicaciones(t: TareaLarga | undefined): { cuantas: number; desde: string | null; techoUsd: number } {
  const cuantas = t?.ultima ? PUBLICACIONES_REFRESCO : PUBLICACIONES_PRIMERA;
  // Un día de solape: lo publicado justo antes de la corrida anterior entra igual (el upsert no lo duplica).
  const desde = t?.ultima ? new Date(Date.parse(t.ultima) - 86_400_000).toISOString().slice(0, 10) : null;
  return { cuantas, desde, techoUsd: Math.max(0.05, Math.round(cuantas * USD_POR_PUBLICACION * 100) / 100) };
}

/**
 * Lo que no se toca del crédito del mes de Apify del negocio (4/11/2026). El Cerebro lo midió: la cuenta de un negocio en plan
 * FREE tiene US$5 por mes, y una traída larga de 300 publicaciones costó US$0,69. Lo de todos los días (leer, dar de alta,
 * transcribir) sale de la misma cuenta: la traída larga nunca baja de esta reserva.
 */
export const RESERVA_CREDITO_USD = 2;
/** Una traída larga usa a lo sumo esta parte de lo que queda por encima de la reserva: el crédito del mes no se va en una ficha. */
export const PARTE_DEL_CREDITO = 0.25;
/** Menos publicaciones que esto no vale una corrida: se espera al mes que viene. */
export const MINIMO_DE_UNA_TRAIDA = 20;

/** El crédito del mes de Apify, como lo dice `GET /v2/users/me/limits`. null = no se pudo saber. */
export type CreditoApify = { usado: number; tope: number };

/** Lee el crédito de la respuesta de Apify. Sin los dos números, null: no se inventa un cero. */
export function creditoDeApify(cuerpo: unknown): CreditoApify | null {
  const d = (cuerpo as { data?: { limits?: { maxMonthlyUsageUsd?: unknown }; current?: { monthlyUsageUsd?: unknown } } } | null)?.data;
  const tope = Number(d?.limits?.maxMonthlyUsageUsd);
  const usado = Number(d?.current?.monthlyUsageUsd);
  return Number.isFinite(tope) && Number.isFinite(usado) && tope > 0 && usado >= 0 ? { usado, tope } : null;
}

/**
 * El crédito de VARIAS claves de Spy sumado (5/11/2026, varias claves de Apify): lo que se sabe de cada una, junto. null si
 * de ninguna se pudo saber. Una clave cuyo crédito no se pudo leer NO suma (no se inventa su saldo): cuenta aparte.
 */
export function creditoTotal(creditos: ReadonlyArray<CreditoApify | null>): CreditoApify | null {
  const sabidos = creditos.filter((c): c is CreditoApify => !!c);
  if (!sabidos.length) return null;
  return { usado: sabidos.reduce((n, c) => n + c.usado, 0), tope: sabidos.reduce((n, c) => n + c.tope, 0) };
}

/**
 * El pedido de publicaciones achicado a lo que el crédito deja, o null si no alcanza (la traída espera; se dice sólo al admin).
 * Sin saber el crédito, el pedido de siempre: el tope de corridas del día ya lo cuida.
 *
 * Con VARIAS claves (5/11/2026) se le pasa también `total` (`creditoTotal` de todas): la reserva de Spy se cuenta sobre el TOTAL
 * libre, no sobre cada clave. Una corrida corre en UNA clave, así que además no puede pedir más de lo que le queda a ésa. Con
 * una sola clave, `total` es la misma y el resultado es el de siempre.
 */
export function ajustarAlCredito(
  p: { cuantas: number; desde: string | null; techoUsd: number }, credito: CreditoApify | null, total: CreditoApify | null = credito,
): { cuantas: number; desde: string | null; techoUsd: number } | null {
  if (!credito) return p;
  const deTodas = total ?? credito;
  const libre = deTodas.tope - deTodas.usado - RESERVA_CREDITO_USD;
  if (libre <= 0) return null;
  const techo = Math.min(libre * PARTE_DEL_CREDITO, credito.tope - credito.usado);
  if (techo <= 0) return null;
  if (p.techoUsd <= techo) return p;
  const cuantas = Math.floor(techo / USD_POR_PUBLICACION);
  if (cuantas < MINIMO_DE_UNA_TRAIDA) return null;
  return { cuantas, desde: p.desde, techoUsd: Math.max(0.05, Math.floor(cuantas * USD_POR_PUBLICACION * 100) / 100) };
}

/**
 * ¿El «no pude» de Apify es por crédito? (HTTP 402, o el tipo de error que lo dice.) Es lo ÚNICO que hace pasar a la siguiente
 * clave de Spy (lib/spy-claves.ts): una clave rota o un Apify caído no se arreglan con otra cuenta.
 *
 * ⚠️ 5/11/2026: el `rate-limit-exceeded` de un 429 (demasiados pedidos por segundo) contestaba que sí, porque el patrón
 * buscaba `limit-exceeded` suelto. No es plata: es una pausa. Con varias claves, saltar de clave por eso gastaba la de otra
 * cuenta por un apuro de un segundo.
 */
export function esFaltaDeCredito(status: number, cuerpo: unknown): boolean {
  if (status === 402) return true;
  const e = (cuerpo as { error?: { type?: unknown; message?: unknown } } | null)?.error;
  const texto = `${String(e?.type ?? '')} ${String(e?.message ?? '')}`;
  if (status === 429 || /rate-limit/i.test(texto)) return false;
  return /usage|credit|limit-exceeded|not-enough|insufficient/i.test(texto);
}

/** Lo que se le manda al actor de publicaciones. */
export function entradaDePublicaciones(usuario: string, p: { cuantas: number; desde: string | null }): Record<string, unknown> {
  return {
    directUrls: [`https://www.instagram.com/${usuario.replace(/^@/, '')}/`],
    resultsType: 'posts',
    resultsLimit: p.cuantas,
    addParentData: false,
    ...(p.desde ? { onlyPostsNewerThan: p.desde } : {}),
  };
}

/** Lo que se le manda al actor de anuncios: la misma búsqueda que «Ver sus anuncios», con los activos Y los viejos. */
export function entradaDeAnuncios(urlBiblioteca: string, cuantos = ANUNCIOS_POR_CORRIDA): Record<string, unknown> {
  let url = urlBiblioteca;
  try {
    const u = new URL(urlBiblioteca);
    u.searchParams.set('active_status', 'all');
    url = u.toString();
  } catch { /* se manda tal cual */ }
  return { startUrls: [{ url }], resultsLimit: cuantos, isDetailsPerAd: false, onlyTotal: false };
}

/** El estado de una corrida de Apify, en las tres cosas que importan acá. */
export function estadoDeCorrida(status: string): 'corre' | 'termino' | 'fallo' {
  const s = status.toUpperCase();
  if (s === 'READY' || s === 'RUNNING') return 'corre';
  if (s === 'SUCCEEDED') return 'termino';
  // TIMED-OUT y ABORTED pueden traer media lista: se lee igual lo que quedó (lo decide quien llama).
  return 'fallo';
}

// ── Los anuncios ─────────────────────────────────────────────────────────────

const primero = (o: Record<string, unknown>, ...claves: string[]): unknown => {
  for (const k of claves) if (o[k] != null && o[k] !== '') return o[k];
  return undefined;
};

/** Una fecha del actor: segundos de Unix, milisegundos o ISO. null si no se entiende. */
export function fechaDeAnuncio(v: unknown): string | null {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return new Date(v < 1e12 ? v * 1000 : v).toISOString();
  if (typeof v === 'string' && /^\d{9,13}$/.test(v)) return fechaDeAnuncio(Number(v));
  if (typeof v === 'string' && Number.isFinite(Date.parse(v))) return new Date(v).toISOString();
  return null;
}

const httpsONull = (v: unknown): string | null => (typeof v === 'string' && /^https:\/\//.test(v) ? v : null);

/**
 * Un anuncio del actor, con la misma forma que los que lee la extensión (`AnuncioLeido`, lib/spy-captura.ts): así se
 * guardan por el mismo camino y la pantalla no distingue de dónde vino.
 *
 * Acepta los dos dialectos que se vieron (`adArchiveID` / `ad_archive_id`, `startDate` / `start_date`, el texto en
 * `snapshot.body.text` o en `snapshot.body.markup.__html`). Sin un id que sea un número, no es un anuncio.
 * ⚠️ El `hasta` sólo se lee de un anuncio que NO sigue activo: uno activo «hasta hoy» no terminó.
 */
export function anuncioDeApify(crudo: unknown): AnuncioLeido | null {
  if (!esObj(crudo)) return null;
  const id = str(String(primero(crudo, 'adArchiveID', 'adArchiveId', 'ad_archive_id', 'adid', 'id') ?? ''));
  if (!/^\d{6,25}$/.test(id)) return null;
  const snap = esObj(crudo.snapshot) ? crudo.snapshot : {};
  const cuerpo = esObj(snap.body) ? snap.body : {};
  const markup = esObj(cuerpo.markup) ? str(cuerpo.markup.__html).replace(/<[^>]+>/g, ' ') : '';
  const tarjetas = Array.isArray(snap.cards) ? snap.cards.filter(esObj) : [];
  const texto = str(cuerpo.text) || markup || str(primero(crudo, 'body', 'adText')) || str(tarjetas[0]?.body) || null;
  const titulo = str(primero(snap, 'title', 'linkTitle', 'link_title')) || str(tarjetas[0]?.title) || null;
  const destino = httpsONull(primero(snap, 'linkUrl', 'link_url')) ?? httpsONull(tarjetas[0]?.linkUrl ?? tarjetas[0]?.link_url);
  const imagenes = Array.isArray(snap.images) ? snap.images.filter(esObj) : [];
  const videos = Array.isArray(snap.videos) ? snap.videos.filter(esObj) : [];
  const miniatura = httpsONull(primero(imagenes[0] ?? {}, 'originalImageUrl', 'original_image_url', 'resizedImageUrl', 'resized_image_url'))
    ?? httpsONull(primero(videos[0] ?? {}, 'videoPreviewImageUrl', 'video_preview_image_url'))
    ?? httpsONull(primero(tarjetas[0] ?? {}, 'originalImageUrl', 'original_image_url', 'videoPreviewImageUrl', 'video_preview_image_url'));
  const activo = primero(crudo, 'isActive', 'is_active');
  const nombre = str(primero(crudo, 'pageName', 'page_name')) || str(primero(snap, 'pageName', 'page_name'));
  const handle = str(primero(snap, 'pageProfileUri', 'page_profile_uri')).match(/facebook\.com\/([^/?#]+)/i)?.[1] ?? null;
  const paginaId = str(String(primero(crudo, 'pageID', 'pageId', 'page_id') ?? primero(snap, 'pageId', 'page_id') ?? ''));
  return {
    id,
    paginaId: /^\d{5,25}$/.test(paginaId) ? paginaId : null,
    desde: fechaDeAnuncio(primero(crudo, 'startDate', 'start_date', 'startDateFormatted')),
    hasta: activo === false ? fechaDeAnuncio(primero(crudo, 'endDate', 'end_date', 'endDateFormatted')) : null,
    pagina: nombre ? { nombre, handle } : null,
    texto: texto ? cortarTexto(texto.replace(/\s+/g, ' ').trim(), TOPES.texto) : null,
    titulo: titulo ? cortarTexto(titulo, TOPES.titulo) : null,
    destino,
    miniatura,
    // Imagen, video o carrusel (6/11/2026): el explorador de Image muestra sólo los de imagen (lib/carruseles/anuncios.ts).
    medio: medioDeAnuncio(primero(snap, 'displayFormat', 'display_format') ?? primero(crudo, 'displayFormat', 'display_format'), { videos: videos.length, imagenes: imagenes.length }),
  };
}

/**
 * Qué sigue después de una corrida de anuncios (4/11/2026; el Cerebro midió en ws 9: por «Alex Hormozi» el primero era de la Página
 * «Skool», y por «Víctor Heras» 0 ítems y US$0). Con anuncios SUYOS, se guardan. Con ninguno suyo y otra forma de buscarlo, se prueba
 * esa (una corrida vacía cuesta US$0). Probadas todas, no pauta: es un dato, se dice en su lugar y se vuelve a mirar a la semana.
 * Una corrida por su Página no tiene «otra forma»: si vino vacía, no pauta.
 */
export function siguienteDeAnuncios(o: { suyos: number; busqueda: number; busquedas: number; porPagina: boolean }):
  { que: 'guardar' } | { que: 'probar'; busqueda: number } | { que: 'no-pauta' } {
  if (o.suyos > 0) return { que: 'guardar' };
  if (!o.porPagina && o.busqueda + 1 < o.busquedas) return { que: 'probar', busqueda: o.busqueda + 1 };
  return { que: 'no-pauta' };
}

/** Su Página, aprendida de anuncios YA verificados: si todos vienen de la misma (con su id), ésa. Si no, ninguna. */
export function paginaDeSusAnuncios(suyos: ReadonlyArray<{ paginaId?: string | null }>): string | null {
  const ids = new Set(suyos.map((a) => a.paginaId).filter((x): x is string => !!x && /^\d{5,25}$/.test(x)));
  return ids.size === 1 ? [...ids][0] : null;
}

// ── Lo que cuenta como «lo borró» ────────────────────────────────────────────

/**
 * Qué piezas guardadas dejaron de verse según UNA lectura. Sólo las que esa lectura podía ver: las publicadas desde la
 * más vieja que trajo. Una pieza más vieja que eso no vino porque la lectura no llega tan atrás, no porque la borró.
 *
 * ⚠️ ANTES SE MARCABA TODO LO QUE NO VINO (4/11/2026). Con la lectura de siempre trayendo lo último y la corrida larga
 * trayendo años, cada «Revisar ahora» habría marcado como borrado todo el historial. Una pieza sin fecha no se marca:
 * no se sabe si la lectura llegaba hasta ella.
 */
export function seFueron(
  guardadas: ReadonlyArray<{ id: number; ref: string; publicada_en: string | null }>,
  leidas: ReadonlyArray<{ ref: string; publicadaEn?: string | null }>,
): number[] {
  if (!leidas.length) return [];
  const siguen = new Set(leidas.map((l) => l.ref));
  const fechas = leidas.map((l) => Date.parse(l.publicadaEn ?? '')).filter(Number.isFinite);
  // Sin ninguna fecha en lo leído no hay ventana que afirmar: no se marca nada.
  if (!fechas.length) return [];
  const desde = Math.min(...fechas);
  return guardadas.filter((g) => {
    if (siguen.has(g.ref)) return false;
    const t = Date.parse(g.publicada_en ?? '');
    return Number.isFinite(t) && t >= desde;
  }).map((g) => g.id);
}

/**
 * El motivo de la traída larga, para la persona (lo devuelve `avanzarTodo`). Sin motivo, nada que decir. Martín, 4/11: «Si
 * una corrida larga no terminó, la pantalla lo dice» — antes se tiraba y la ficha quedaba en 12 sin decir por qué.
 */
export function avisoDeTraida(porque: string | undefined, o: { admin?: boolean } = {}): string | null {
  if (!porque) return null;
  // ⚠️ EL CRÉDITO SE LE DICE SÓLO AL ADMIN Y SIN CARTEL DE ERROR (el Cerebro, 4/11/2026): es la plata del negocio, y para el resto
  // del equipo no hay nada que hacer. La ficha sigue con lo que ya se leyó.
  if (porque === 'sin-credito') return o.admin ? 'Tu crédito de Apify del mes no alcanza para traer todo lo que publicó.' : null;
  if (porque === 'sin-clave') return 'Conecta Apify para traer todo lo que publica.';
  if (porque === 'limite') return 'Hoy ya no quedan traídas: mañana sigue sola.';
  return `No traje todo lo que publicó. ${porque}.`;
}
