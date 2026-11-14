// =============================================================================
// calendario-publicar-reglas — una «Publicación» del Calendario se programa en la red, por Zernio (28/10/2026)
// =============================================================================
// Martín a Teo (28/10, 00:23:08): «publicás reels e historias desde el Calendar los días y a la hora que elijas». Hasta
// hoy una Publicación era un recordatorio que se tildaba a mano. Acá viven las decisiones, puras: si un evento se puede
// programar, el cuerpo del post para Zernio (`POST /v1/posts`, el de la tab vieja: `8d16c6ff^:lib/zernio.ts`), la ruta del
// archivo y cómo se lee el estado que devuelve Zernio. Lo que habla con Zernio y con la base: lib/calendario-publicar.ts.
//
// Puro (sin `server-only`): lo prueba tests/calendario-publicar-reglas.test.ts.
// =============================================================================

import type { FormatoPublicacion } from './calendario-modelo';

// LinkedIn, X, Threads y Google Business desde el 29/10/2026 (Martín: «publicar en Facebook, TikTok, LinkedIn, etc.»; la mig 0348
// las suma al CHECK de `red`). Pinterest y Reddit no: un pin pide el tablero y un post de Reddit la comunidad, y no hay dónde elegirlos.
export const REDES_PUBLICAR = ['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin', 'twitter', 'threads', 'googlebusiness'] as const;
export type RedPublicar = (typeof REDES_PUBLICAR)[number];
export const ROTULO_RED: Record<RedPublicar, string> = {
  instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', youtube: 'YouTube',
  linkedin: 'LinkedIn', twitter: 'X', threads: 'Threads', googlebusiness: 'Google Business',
};
export const esRedPublicar = (x: unknown): x is RedPublicar => typeof x === 'string' && (REDES_PUBLICAR as readonly string[]).includes(x);

export const ESTADOS_PUBLICACION = ['programando', 'programada', 'dudosa', 'publicada', 'fallo'] as const;
export type EstadoPublicacion = (typeof ESTADOS_PUBLICACION)[number];

/** El tope del texto de una publicación: el de Instagram (también el CHECK de la mig 0342). */
export const TOPE_TEXTO = 2200;
/** Lo mínimo que tiene que faltar para la hora: Zernio no programa en el pasado, y un minuto de margen no alcanza. */
export const MARGEN_PROGRAMAR_MS = 5 * 60_000;
/** Cuánto vive la firma de la media DESPUÉS de la hora de publicar: Zernio la lee al publicar (el `MARGEN_FIRMA_SEG` viejo). */
export const MARGEN_FIRMA_SEG = 7 * 86_400;
/** El bucket (privado, mig 0136) y la carpeta de la media del Calendario. */
export const BUCKET_PUBLICAR = 'ig-media';
export const CARPETA_CALENDARIO = 'calendario';

type TipoArchivo = 'image' | 'video';
const MIME: Record<string, { tipo: TipoArchivo; ext: string }> = {
  'image/jpeg': { tipo: 'image', ext: 'jpg' }, 'image/png': { tipo: 'image', ext: 'png' }, 'image/webp': { tipo: 'image', ext: 'webp' },
  'video/mp4': { tipo: 'video', ext: 'mp4' }, 'video/quicktime': { tipo: 'video', ext: 'mov' },
};
export const tipoDeArchivo = (mime: string | null | undefined): TipoArchivo | null => MIME[(mime ?? '').toLowerCase()]?.tipo ?? null;
export const MIMES_PUBLICAR = Object.keys(MIME);

/** Qué formato se publica en cada red, y con qué archivo. Lo que no está acá (un Anuncio, un Email) no se publica. */
const SE_PUEDE: Record<RedPublicar, Partial<Record<FormatoPublicacion, readonly TipoArchivo[]>>> = {
  instagram: { post: ['image', 'video'], reel: ['video'], story: ['image', 'video'] },
  facebook: { post: ['image', 'video'], reel: ['video'], story: ['image', 'video'] },
  tiktok: { reel: ['video'], video: ['video'] },
  youtube: { reel: ['video'], video: ['video'] },
  // Un post con su imagen o su video (29/10/2026). Google Business publica una novedad con imagen: video no.
  linkedin: { post: ['image', 'video'] },
  twitter: { post: ['image', 'video'] },
  threads: { post: ['image', 'video'] },
  googlebusiness: { post: ['image'] },
};

/** El tope del texto de las redes que cortan antes de los 2.200 (X 280, Threads 500, Google Business 1.500). */
export const TOPE_TEXTO_RED: Readonly<Partial<Record<RedPublicar, number>>> = { twitter: 280, threads: 500, googlebusiness: 1500 };
/** El tope del texto en ESA red (sin red, el general). */
export const topeDeTexto = (red: RedPublicar | null | undefined): number => (red ? TOPE_TEXTO_RED[red] : undefined) ?? TOPE_TEXTO;
export const formatosDeRed = (red: RedPublicar): FormatoPublicacion[] => Object.keys(SE_PUEDE[red]) as FormatoPublicacion[];

/** Los datos de la publicación de un evento (las columnas de la mig 0342). */
export type DatosPublicacion = {
  red: RedPublicar | null; cuenta_red: string | null; archivo: string | null; archivo_tipo: TipoArchivo | null; texto: string;
  post_id: string | null; publicacion: EstadoPublicacion | null; publicacion_motivo: string | null; publicacion_url: string | null;
  /** El x-request-id del intento con su primer envío (`anotarIntento`; se repite si Zernio no contestó) y la huella de la clave con que se programó. */
  publicacion_intento?: string | null; publicacion_clave?: string | null;
};
export type EventoParaPublicar = {
  id: string; tipo: string; formato: FormatoPublicacion | null; titulo: string; inicio: string; dia_completo: boolean; estado: 'planeado' | 'hecho';
} & DatosPublicacion;

/** ¿Está esperando a Zernio? Mientras tanto no se mueve ni se borra: primero se cancela. */
export const estaProgramada = (p: { publicacion: EstadoPublicacion | null } | null | undefined): boolean =>
  p?.publicacion === 'programando' || p?.publicacion === 'programada' || p?.publicacion === 'dudosa';

/** El título de un video de YouTube es PÚBLICO (sale del título del evento) y YouTube corta en 100. */
export const TOPE_TITULO_YOUTUBE = 100;

/**
 * ¿Zernio pudo haber creado el post aunque falló? (la verificación del 28/10). Sin respuesta (la red, el tope de tiempo: status 0)
 * o un error suyo (5xx): no se sabe, y reprogramar duplicaba un post PÚBLICO. Un 4xx es un «no» de Zernio: no creó nada.
 * ⚠️ Sólo en el PRIMER pedido: en el reintento de una `dudosa`, un 4xx dice que Zernio no creó ESE pedido, no que el primero no
 *    exista (la verificación del 29/10: un 429 o un 422 la pasaba a `fallo` y «Programar» duplicaba el post).
 */
export const esFallaDudosa = (status: number): boolean => status === 0 || status >= 500;

/** Zernio devuelve el post original si el mismo x-request-id se repite en ~5 minutos: se reintenta con el MISMO hasta los 4. */
export const VENTANA_MISMO_PEDIDO_MS = 4 * 60_000;

/**
 * El intento que se anota en `publicacion_intento`: el x-request-id y CUÁNDO salió por PRIMERA vez (`<id>@<ms>`). La ventana de
 * Zernio se cuenta desde el primer envío, no desde la última anotación (la verificación del 29/10: un `programando` trabado que
 * pasaba a `dudosa`, o dos respuestas perdidas seguidas, renovaban la hora y el reintento salía con un id que Zernio ya no recordaba:
 * dos posts públicos).
 */
export const anotarIntento = (requestId: string, primerEnvio: number): string => `${requestId}@${Math.floor(primerEnvio)}`;

/** El x-request-id y su primer envío. null si no hay, o si no trae la hora (sin hora no se sabe si sigue en la ventana). */
export function leerIntento(intento: string | null | undefined): { requestId: string; primerEnvio: number } | null {
  const m = /^([^@\s]{1,60})@(\d{1,15})$/.exec(intento ?? '');
  return m ? { requestId: m[1], primerEnvio: Number(m[2]) } : null;
}

/** ¿Reintentar esta `dudosa` repite el MISMO pedido a Zernio? Sólo dentro de la ventana, contada desde el primer envío. */
export function repiteElMismoPedido(ev: { publicacion: EstadoPublicacion | null; publicacion_intento?: string | null }, ahora: number): boolean {
  const i = ev.publicacion === 'dudosa' ? leerIntento(ev.publicacion_intento) : null;
  return !!i && ahora >= i.primerEnvio && ahora - i.primerEnvio < VENTANA_MISMO_PEDIDO_MS;
}

export type AccionBloqueada = 'cambiar' | 'borrar' | 'tildar';

/**
 * Por qué no se mueve, se borra o se tilda uno que espera a Zernio, en palabras de la pantalla; null si no espera. La verificación
 * del 29/10: «se tilda sola cuando sale» no pasa con una `dudosa` (la relectura sólo mira las programadas) ni con una programada con
 * OTRA clave (Zernio no la encuentra), y «cancela la programación» no se puede en una `dudosa`. `otraClave`: la clave de hoy no es
 * la que la programó (o ya no hay clave).
 */
export function textoDeBloqueo(estado: EstadoPublicacion | null, otraClave: boolean, accion: AccionBloqueada): string | null {
  if (estado === 'programando') return 'Se está programando ahora: prueba en un minuto.';
  if (estado === 'dudosa') return 'No se sabe si quedó programada en Zernio: resuélvela primero en «Publicar en la red».';
  if (estado !== 'programada') return null;
  if (otraClave) return 'Se programó con otra clave de Zernio: cancélala en esa cuenta y márcala con «Ya lo resolví en Zernio».';
  if (accion === 'tildar') return 'Está programada en la red: se tilda sola cuando sale.';
  return `Está programada en la red: cancela la programación para ${accion === 'borrar' ? 'borrarla' : 'cambiarla'}.`;
}

/** La huella de lo que se confirma (la hora, la cuenta, el archivo, el formato, el texto): si cambió, el «sí» no vale. */
export function huellaParaConfirmar(ev: { inicio: string; red: string | null; cuenta_red: string | null; archivo: string | null; formato: string | null; texto: string; titulo: string }): string {
  let h = 0;
  for (const c of [ev.inicio, ev.red, ev.cuenta_red, ev.archivo, ev.formato, ev.texto, ev.titulo].map((x) => String(x ?? '')).join('|')) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0;
  return `${new Date(ev.inicio).toISOString()}|${ev.cuenta_red ?? ''}|${(h >>> 0).toString(36)}`;
}

/** Por qué este evento NO se puede programar todavía, en palabras de la pantalla; null si se puede. */
export function motivoParaNoProgramar(ev: EventoParaPublicar, ahora: number): string | null {
  if (ev.tipo !== 'publicacion') return 'Sólo una Publicación se programa en una red.';
  if (ev.publicacion === 'dudosa') return 'Zernio no contestó cuando se programó: revisa en Zernio si quedó programada. Si no quedó, márcala con «No quedó programada».';
  if (estaProgramada(ev)) return 'Ya está programada.';
  if (ev.publicacion === 'publicada') return 'Ya se publicó.';
  if (ev.estado === 'hecho') return 'Está marcada como publicada: quita la marca para programarla.';
  if (ev.dia_completo) return 'Ponle una hora: una publicación de todo el día saldría a la medianoche.';
  const inicio = Date.parse(ev.inicio);
  if (!Number.isFinite(inicio) || inicio <= ahora) return 'La hora ya pasó: elige otra.';
  if (inicio - ahora < MARGEN_PROGRAMAR_MS) return 'Faltan menos de 5 minutos: elige una hora más adelante.';
  if (!ev.red || !esRedPublicar(ev.red) || !ev.cuenta_red) return 'Elige la cuenta donde se publica.';
  if (!ev.archivo || !ev.archivo_tipo) return 'Sube el archivo (la imagen o el video).';
  const formato = ev.formato ?? 'post';
  const archivos = SE_PUEDE[ev.red][formato];
  if (!archivos) return `En ${ROTULO_RED[ev.red]} no se publica un formato «${formato}».`;
  if (!archivos.includes(ev.archivo_tipo)) return `Un ${formato} en ${ROTULO_RED[ev.red]} lleva ${archivos.includes('video') ? 'un video' : 'una imagen'}.`;
  if ((ev.texto ?? '').length > TOPE_TEXTO) return `El texto tiene más de ${TOPE_TEXTO} caracteres.`;
  const tope = TOPE_TEXTO_RED[ev.red];
  if (tope && (ev.texto ?? '').length > tope) return `En ${ROTULO_RED[ev.red]} el texto llega hasta ${tope} caracteres.`;
  if (ev.red === 'youtube' && ev.titulo.length > TOPE_TITULO_YOUTUBE) return `En YouTube el título del evento es el título público del video: hasta ${TOPE_TITULO_YOUTUBE} caracteres.`;
  return null;
}

/** El cuerpo de `POST /v1/posts` (Zernio). ⚠️ `scheduledFor` con Z: es un instante y Zernio IGNORA `timezone` (no se manda). */
export type CuerpoPost = {
  content?: string; title?: string;
  mediaItems: Array<{ type: TipoArchivo; url: string }>;
  platforms: Array<{ platform: RedPublicar; accountId: string; platformSpecificData?: Record<string, unknown> }>;
  scheduledFor: string;
  metadata: { calendarioEventoId: string };
};

/**
 * `prueba`: el reel de prueba del piloto de Instagram (lib/copiloto/piloto-redes.ts, 14/11): sale primero sólo a quien no te sigue.
 * Zernio lo recibe en `trialParams` (docs.zernio.com/platforms/instagram/fields) y Meta sólo lo acepta en un REEL: en otro formato
 * u otra red no se manda.
 */
export function cuerpoDelPost(ev: EventoParaPublicar, urlArchivo: string, opc: { prueba?: 'SS_PERFORMANCE' | 'MANUAL' | null } = {}): CuerpoPost {
  const red = ev.red as RedPublicar;
  const formato = ev.formato ?? 'post';
  // Instagram y Facebook distinguen el reel y la historia del post del feed; TikTok y YouTube publican un video.
  const base = (red === 'instagram' || red === 'facebook') && (formato === 'reel' || formato === 'story') ? { contentType: formato } : undefined;
  const especifico = red === 'instagram' && formato === 'reel' && opc.prueba ? { ...base, trialParams: { graduationStrategy: opc.prueba } } : base;
  const texto = (ev.texto ?? '').trim();
  return {
    ...(texto ? { content: texto } : {}),
    ...(red === 'youtube' ? { title: ev.titulo } : {}),
    mediaItems: [{ type: ev.archivo_tipo as TipoArchivo, url: urlArchivo }],
    platforms: [{ platform: red, accountId: ev.cuenta_red as string, ...(especifico ? { platformSpecificData: especifico } : {}) }],
    scheduledFor: new Date(ev.inicio).toISOString(),
    metadata: { calendarioEventoId: ev.id },
  };
}

/**
 * La ruta del archivo en el bucket: `<ws>/calendario/<evento>/<al azar>.<ext>`. La arma el server (nunca el navegador), con el
 * nombre al azar que le pasan (no adivinable). null si el tipo no se publica.
 */
export function rutaDelArchivo(ws: number, eventoId: string, mime: string, azar: string): string | null {
  const m = MIME[(mime ?? '').toLowerCase()];
  if (!m || !/^[a-z0-9]{8,40}$/.test(azar)) return null;
  return `${ws}/${CARPETA_CALENDARIO}/${eventoId}/${azar}.${m.ext}`;
}

/** ⚠️ Por SEGMENTOS, nunca por prefijo (AGENTS.md): `3/…` es del negocio 3 y `30/…` no. */
export function rutaValida(ruta: string, ws: number, eventoId: string): boolean {
  const s = (ruta ?? '').split('/');
  return s.length === 4 && s[0] === String(ws) && s[1] === CARPETA_CALENDARIO && s[2] === eventoId
    && /^[a-z0-9]{8,40}\.(jpg|png|webp|mp4|mov)$/.test(s[3]);
}

/** Cuánto vive la firma de la media: hasta la hora de publicar, más 7 días. Nunca menos de una hora. */
export function segundosDeFirma(inicio: string, ahora: number): number {
  const hasta = (Date.parse(inicio) - ahora) / 1000;
  return Math.max(3600, Math.ceil((Number.isFinite(hasta) ? hasta : 0) + MARGEN_FIRMA_SEG));
}

/** Lo que importa de `GET /v1/posts/{id}`. */
export type PostZernio = { status?: string | null; platforms?: Array<{ status?: string | null; platformPostUrl?: string | null; errorMessage?: string | null }> };

/**
 * El estado que dice Zernio, traducido. null = sigue esperando (programada o publicándose), y también un estado que no
 * conocemos: no se da por publicado lo que no dijo que se publicó.
 */
export function estadoDeZernio(p: PostZernio): { publicacion: EstadoPublicacion; motivo: string | null; url: string | null } | null {
  const pl = p.platforms?.[0];
  if (p.status === 'published') return { publicacion: 'publicada', motivo: null, url: pl?.platformPostUrl ?? null };
  if (p.status === 'failed' || p.status === 'partial') {
    return { publicacion: 'fallo', motivo: (pl?.errorMessage ?? 'Zernio no pudo publicarla.').slice(0, 300), url: null };
  }
  return null;
}
