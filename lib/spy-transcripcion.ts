// =============================================================================
// spy-transcripcion — el guion de un reel de un competidor, transcripto solo y en segundo plano (4/11/2026)
// =============================================================================
// Martín (por el Cerebro, 4/11): «En cada uno de los videos cuando entro no estás trayendo la transcripción». Medido en el
// código, por qué no llegaba: NO HABÍA TRANSCRIPCIÓN. El detalle decía «el guion de un video ajeno no se lee (no hay forma
// legal de transcribirlo)», y la lectura no guardaba el video: Apify trae `videoUrl` en cada reel y `piezaDeApify`
// (lib/instagram-perfil.ts) lo tiraba. Como ese enlace del CDN de Instagram VENCE en días, no sirve guardarlo: se pide
// fresco al abrir el detalle (`videoDeUnaPublicacion`, lib/spy-todo.ts: UNA publicación por Apify, con la clave de Spy del
// negocio y su tope del día), se baja y lo escucha la IA DEL NEGOCIO (`transcribirAudio`, sin red de la plataforma).
//
// Y LOS VIDEOS DE YOUTUBE, desde el 4/11/2026 (Martín, por el Cerebro: «Con Gemini le pides y te lo da entero»): no se bajan.
// La API de Gemini acepta el enlace de un video PÚBLICO de YouTube y lo transcribe ella (`guionDeYoutubeConGemini`,
// lib/ai-cheap.ts), con el Gemini DEL NEGOCIO. Un video largo va por tramos (`tramosDeYoutube`). Un «high demand» o el tope del
// día lo dejan PENDIENTE: sin cartel y sin contarlo como fallo, se vuelve a intentar más tarde.
//
// Sin `server-only`: lo que habla con la base, Apify, la red y la IA entra por `deps` (lib/spy-transcripcion-servidor.ts).
//
// ⚠️ UNA VEZ: lo transcripto queda (y no se vuelve a pagar) hasta `RETENCION_MS`, el mismo reloj que el TEXTO de una pieza
// (30 días, la cabecera de la migración 0359). Pasado ese plazo se borra al leerlo y se vuelve a pedir si alguien lo abre.
// ⚠️ UN TRABAJO POR PIEZA: «transcribiendo» se toma con compare-and-set y el resultado se escribe contra lo que escribió ESE
// trabajo. Un fallo deja su motivo y no se reintenta en cadena (un día; una semana a los 3 seguidos).
// =============================================================================

/** Una clave por pieza, con el competidor adelante: «Dejar de mirarlo» las borra todas con un prefijo. */
export const prefijoTranscripciones = (competidorId: number): string => `spy.transcripcion.${competidorId}.`;
export const claveTranscripcion = (competidorId: number, piezaId: number): string => `${prefijoTranscripciones(competidorId)}${piezaId}`;

/** El reloj del texto de una pieza: lo transcripto se borra a los 30 días, como su caption. */
export const RETENCION_MS = 30 * 24 * 60 * 60_000;
/** Un «transcribiendo» más viejo que esto se cortó. */
export const TRANSCRIBIENDO_VENCE_MS = 6 * 60_000;
export const ESPERA_TRAS_FALLO_MS = 24 * 60 * 60_000;
export const FALLOS_HASTA_ESPERAR = 3;
export const ESPERA_LARGA_MS = 7 * 24 * 60 * 60_000;
/** Lo que escucha Whisper; Gemini topea antes (14 MB inline). Un reel pesa de 2 a 15 MB. */
export const MAX_BYTES_VIDEO = 25 * 1024 * 1024;
/** Lo que se guarda del guion: el mismo techo que el texto de una pieza en la tabla, con margen. */
export const TOPE_GUION = 8_000;

export type EstadoGuion = 'transcribiendo' | 'listo' | 'no-pudo';

export type Guion = {
  estado: EstadoGuion;
  intento: string;
  desde: string;
  /** Cuándo quedó transcripto (el reloj de la retención). */
  hecho: string | null;
  texto: string | null;
  motivo: string | null;
  fallos: number;
  /** PENDIENTE (YouTube): un «high demand» o el tope del día. Se vuelve a intentar desde acá, sin cartel y sin ser un fallo. */
  reintentarEn?: string | null;
};

/** Un video de YouTube va por tramos de 10 minutos, hasta los primeros 30: cada tramo es un pedido y el guion cabe guardado. */
export const TRAMO_YT_S = 600;
export const MAX_YT_S = 1800;
/** El guion de un video de YouTube puede ser más largo que el de un reel. */
export const TOPE_GUION_YT = 40_000;
/** Cuántos videos de YouTube transcribe un negocio por día con su Gemini (contado en la base). */
export const GUIONES_YT_POR_DIA = 20;
/** Un «high demand» de Gemini se vuelve a intentar a la media hora; el tope del día, a las 6 horas. */
export const ESPERA_SATURADO_MS = 30 * 60_000;
export const ESPERA_TOPE_MS = 6 * 60 * 60_000;
/** Un trabajo de YouTube son varios pedidos de un par de minutos: vence más tarde que el de un reel. */
export const TRANSCRIBIENDO_YT_VENCE_MS = 15 * 60_000;
/** La cuenta del día de los guiones de YouTube de un negocio (`{ fecha, usadas }`, como `spy.transcripciones.dia`). */
export const CLAVE_DIA_GUIONES_YT = 'spy.guiones-yt.dia';

/** Lo que la pantalla dibuja del guion de una pieza. */
export type VistaGuion =
  | { estado: 'no-aplica' }
  | { estado: 'sin-ia' }
  | { estado: 'sin-clave' }
  /** Un video de YouTube lo transcribe Gemini: sin el Gemini del negocio, se pide conectarlo. */
  | { estado: 'sin-gemini' }
  | { estado: EstadoGuion; texto: string | null; motivo: string | null };

/** ¿Tiene guion para transcribir? Un reel de Instagram o un video de YouTube (ver la cabecera). */
export const tieneGuion = (p: { canal: string; tipo: string; ref?: string }): boolean =>
  (p.canal === 'instagram' && p.tipo === 'reel') || (p.canal === 'youtube' && /^[\w-]{11}$/.test(p.ref ?? ''));

/** Su enlace: el de Instagram que se guardó (o armado con su código), o el `watch?v=` de su video de YouTube. */
export function enlaceDeLaPublicacion(p: { canal?: string; url: string | null; ref: string }): string | null {
  if (p.canal === 'youtube') return /^[\w-]{11}$/.test(p.ref) ? `https://www.youtube.com/watch?v=${p.ref}` : null;
  if (p.url && /^https:\/\/(www\.)?instagram\.com\//i.test(p.url)) return p.url;
  return /^[\w-]{5,40}$/.test(p.ref) ? `https://www.instagram.com/p/${p.ref}/` : null;
}

export const esDeYoutube = (enlace: string): boolean => /^https:\/\/www\.youtube\.com\/watch\?v=/.test(enlace);

/** «PT1H2M3S» → 3723. null si no se sabe. */
export function segundosDeDuracion(d: string | null | undefined): number | null {
  const m = /^P(?:\d+D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec((d ?? '').trim());
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Math.round(Number(m[3] ?? 0));
}

/**
 * Los tramos que se le piden a Gemini. Uno corto, entero: `[null]`. Uno largo, de a `TRAMO_YT_S` hasta `MAX_YT_S`, y `cortado` dice
 * que hay más. Sin la duración, el primer tramo: no se paga un video de horas a ciegas.
 */
export function tramosDeYoutube(duracion: string | null | undefined): { tramos: Array<{ desdeS: number; hastaS: number } | null>; cortado: boolean | null } {
  const s = segundosDeDuracion(duracion);
  // Sin la duración no se sabe si sigue: `cortado` null (y se dice hasta dónde se transcribió, que es verdad igual).
  if (s == null) return { tramos: [{ desdeS: 0, hastaS: TRAMO_YT_S }], cortado: null };
  if (s <= TRAMO_YT_S) return { tramos: [null], cortado: false };
  const fin = Math.min(s, MAX_YT_S);
  const tramos: Array<{ desdeS: number; hastaS: number }> = [];
  for (let d = 0; d < fin; d += TRAMO_YT_S) tramos.push({ desdeS: d, hastaS: Math.min(d + TRAMO_YT_S, fin) });
  return { tramos, cortado: s > MAX_YT_S };
}

const esTexto = (x: unknown): x is string => typeof x === 'string';

export function leerGuion(crudo: string | null | undefined): Guion | null {
  if (!crudo) return null;
  let o: Record<string, unknown>;
  try { o = JSON.parse(crudo) as Record<string, unknown>; } catch { return null; }
  if (!o || typeof o !== 'object') return null;
  const estado = o.estado === 'transcribiendo' || o.estado === 'listo' || o.estado === 'no-pudo' ? o.estado : null;
  if (!estado || !esTexto(o.intento) || !esTexto(o.desde)) return null;
  return {
    estado, intento: o.intento, desde: o.desde,
    hecho: esTexto(o.hecho) ? o.hecho : null,
    texto: esTexto(o.texto) ? o.texto : null,
    motivo: esTexto(o.motivo) ? o.motivo : null,
    fallos: typeof o.fallos === 'number' && o.fallos > 0 ? Math.floor(o.fallos) : 0,
    ...(esTexto(o.reintentarEn) ? { reintentarEn: o.reintentarEn } : {}),
  };
}

const ms = (iso: string | null): number => (iso ? Date.parse(iso) || 0 : 0);

/** ¿Venció? Un guion listo de hace más de 30 días ya no se muestra ni se guarda. */
export const vencido = (g: Guion | null, ahora: number): boolean => !!g && g.estado === 'listo' && ahora - ms(g.hecho ?? g.desde) > RETENCION_MS;

/** ¿Hay que transcribirla ahora? `venceMs`: cuándo un «transcribiendo» se da por cortado (el de YouTube tarda más). */
export function hayQueTranscribir(g: Guion | null, ahora: number, venceMs = TRANSCRIBIENDO_VENCE_MS): boolean {
  if (!g || vencido(g, ahora)) return true;
  if (g.estado === 'listo') return false;
  if (g.estado === 'transcribiendo') return ahora - ms(g.desde) > venceMs;
  // Pendiente (un «high demand», el tope del día): desde su hora, no por el reloj de los fallos.
  if (g.reintentarEn) return ahora >= ms(g.reintentarEn);
  return ahora - ms(g.desde) >= (g.fallos >= FALLOS_HASTA_ESPERAR ? ESPERA_LARGA_MS : ESPERA_TRAS_FALLO_MS);
}

/** El texto como se muestra: sin espacios de más, en párrafos de no más de ~3 frases, y con su techo. */
export function guionLegible(t: string, tope = TOPE_GUION): string {
  const limpio = t.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
  if (limpio.includes('\n')) return limpio.slice(0, tope);
  const frases = limpio.match(/[^.!?¿¡]+[.!?]+["»”]?\s*|[^.!?]+$/g) ?? [limpio];
  const parrafos: string[] = [];
  for (let i = 0; i < frases.length; i += 3) parrafos.push(frases.slice(i, i + 3).join('').trim());
  return parrafos.filter(Boolean).join('\n\n').slice(0, tope);
}

export type ResultadoVideo = { ok: true; url: string } | { ok: false; motivo: 'sin-clave' | 'limite' | 'no-esta' | 'fallo' };
export type ResultadoEscucha = { ok: true; texto: string } | { ok: false; error: string };

export type DepsGuion = {
  leer: () => Promise<{ crudo: string | null; version: string | null }>;
  cambiarSi: (version: string | null, nuevo: string) => Promise<boolean>;
  /** El enlace fresco del video de UNA publicación (Apify, con la clave de Spy del negocio y su tope del día). */
  video: (enlace: string) => Promise<ResultadoVideo>;
  /** Baja el video. Tira si no pudo; `null` si pesa más que `MAX_BYTES_VIDEO`. */
  bajar: (url: string) => Promise<{ bytes: Uint8Array; mime: string } | null>;
  /** La IA del negocio escucha (`transcribirAudio`). */
  escuchar: (bytes: Uint8Array, mime: string) => Promise<ResultadoEscucha>;
  nuevoIntento: () => string;
};

/** Lo que contesta Gemini por UN tramo de un video de YouTube (`guionDeYoutubeConGemini`, lib/ai-cheap.ts). */
export type ResultadoTramoYt =
  | { ok: true; texto: string; tokens: number; corto?: true }
  | { ok: false; motivo: 'sin-gemini' | 'saturado' | 'fallo'; error: string };

/** El trabajo de un video de YouTube: no hay video que bajar, lo transcribe Gemini desde su enlace. */
export type DepsGuionYoutube = Pick<DepsGuion, 'leer' | 'cambiarSi' | 'nuevoIntento'> & {
  /** UN tramo (null = el video entero, que dura `duracionS` si se sabe), con el Gemini del negocio. */
  youtube: (url: string, tramo: { desdeS: number; hastaS: number } | null, duracionS?: number | null) => Promise<ResultadoTramoYt>;
  /** Una del tope del día del negocio (`GUIONES_YT_POR_DIA`, contado en la base). false = se acabó por hoy. */
  reservarDia: () => Promise<boolean>;
};

export type ReclamoGuion =
  | { corre: false; actual: Guion | null }
  | { corre: true; actual: Guion; version: string };

/** Toma el trabajo si hace falta, ganando el compare-and-set. Un guion vencido se pisa acá (su texto se va). */
export async function reclamarGuion(
  deps: Pick<DepsGuion, 'leer' | 'cambiarSi' | 'nuevoIntento'>,
  ahora = Date.now(),
  venceMs = TRANSCRIBIENDO_VENCE_MS,
): Promise<ReclamoGuion> {
  const l = await deps.leer();
  const previo = leerGuion(l.crudo);
  if (!hayQueTranscribir(previo, ahora, venceMs)) return { corre: false, actual: previo };
  const actual: Guion = {
    estado: 'transcribiendo', intento: deps.nuevoIntento(), desde: new Date(ahora).toISOString(),
    hecho: null, texto: null, motivo: null, fallos: previo && !vencido(previo, ahora) ? previo.fallos : 0,
  };
  const version = JSON.stringify(actual);
  if (!(await deps.cambiarSi(l.version, version))) return { corre: false, actual: leerGuion((await deps.leer()).crudo) };
  return { corre: true, actual, version };
}

const MOTIVO_VIDEO: Record<Exclude<ResultadoVideo, { ok: true }>['motivo'], string> = {
  'sin-clave': 'Para transcribirlo hace falta tu clave de Apify.',
  limite: 'Llegaste al tope de transcripciones de hoy. Mañana sigue.',
  'no-esta': 'Instagram no devolvió el video de este reel.',
  fallo: 'No pude traer el video de Instagram.',
};

/** El trabajo: el video fresco, bajarlo, escucharlo y guardar el guion. Escribe sólo si la clave sigue siendo suya. */
export async function transcribirGuion(
  deps: DepsGuion,
  enlace: string,
  r: { actual: Guion; version: string },
  ahora: () => number = Date.now,
): Promise<Guion> {
  const escribir = async (g: Guion): Promise<Guion> => {
    if (!(await deps.cambiarSi(r.version, JSON.stringify(g)))) return leerGuion((await deps.leer()).crudo) ?? g;
    return g;
  };
  const fallo = (motivo: string) => escribir({ ...r.actual, estado: 'no-pudo', motivo, fallos: r.actual.fallos + 1 });

  const v = await deps.video(enlace);
  if (!v.ok) return fallo(MOTIVO_VIDEO[v.motivo]);
  let bajado: Awaited<ReturnType<DepsGuion['bajar']>>;
  try {
    bajado = await deps.bajar(v.url);
  } catch {
    return fallo('No pude bajar el video de Instagram.');
  }
  if (!bajado) return fallo('El video pesa demasiado para transcribirlo.');
  const e = await deps.escuchar(bajado.bytes, bajado.mime);
  if (!e.ok) return fallo(e.error);
  const texto = guionLegible(e.texto);
  // Un reel sin voz (sólo música) no tiene guion: se dice, y no se vuelve a pagar.
  if (!texto) return escribir({ ...r.actual, estado: 'listo', hecho: new Date(ahora()).toISOString(), texto: '', motivo: 'No tiene voz: es sólo música o imagen.', fallos: 0 });
  return escribir({ ...r.actual, estado: 'listo', hecho: new Date(ahora()).toISOString(), texto, motivo: null, fallos: 0 });
}

/**
 * El trabajo de un video de YouTube: una del tope del día, sus tramos de a uno (una sola clave de Gemini: en paralelo es un
 * «high demand» seguro) y el guion. ⚠️ UN «HIGH DEMAND» O EL TOPE DEL DÍA LO DEJAN PENDIENTE (`reintentarEn`), sin motivo y sin
 * sumar un fallo: no es culpa del video ni del negocio, y no se reintenta en cadena (se vuelve a pedir al abrirlo, desde esa hora).
 */
export async function transcribirGuionYoutube(
  deps: DepsGuionYoutube,
  url: string,
  duracion: string | null | undefined,
  r: { actual: Guion; version: string },
  ahora: () => number = Date.now,
): Promise<Guion> {
  const escribir = async (g: Guion): Promise<Guion> => {
    if (!(await deps.cambiarSi(r.version, JSON.stringify(g)))) return leerGuion((await deps.leer()).crudo) ?? g;
    return g;
  };
  const pendiente = (esperaMs: number) =>
    escribir({ ...r.actual, estado: 'no-pudo', motivo: null, reintentarEn: new Date(ahora() + esperaMs).toISOString() });
  const fallo = (motivo: string) => escribir({ ...r.actual, estado: 'no-pudo', motivo, fallos: r.actual.fallos + 1 });

  if (!(await deps.reservarDia())) return pendiente(ESPERA_TOPE_MS);
  const { tramos, cortado } = tramosDeYoutube(duracion);
  const duracionS = segundosDeDuracion(duracion);
  const textos: string[] = [];
  // Un tramo que Gemini devolvió debajo del piso con todos sus modelos (`corto`): se guarda igual, y se dice.
  let algunoCorto = false;
  for (const tramo of tramos) {
    const t = await deps.youtube(url, tramo, tramo ? null : duracionS).catch((): ResultadoTramoYt => ({ ok: false, motivo: 'fallo', error: 'No pude transcribirlo.' }));
    if (!t.ok) return t.motivo === 'saturado' ? pendiente(ESPERA_SATURADO_MS) : fallo(t.error);
    if (t.corto) algunoCorto = true;
    textos.push(t.texto);
  }
  const texto = guionLegible(textos.filter(Boolean).join('\n'), TOPE_GUION_YT);
  const hecho = new Date(ahora()).toISOString();
  // Vacío con un tramo debajo del piso: «no tiene voz» no está medido (Gemini también devuelve vacío cuando corta).
  if (!texto) return escribir({ ...r.actual, estado: 'listo', hecho, texto: '', motivo: algunoCorto ? 'Gemini no devolvió texto: puede ser sólo música o imagen, o que no lo transcribió.' : 'No tiene voz: es sólo música o imagen.', fallos: 0 });
  // Un video largo se transcribe hasta `MAX_YT_S` (o, sin su duración, el primer tramo): se dice hasta dónde.
  const ultimo = tramos[tramos.length - 1];
  const hasta = cortado !== false && ultimo ? `Hasta el minuto ${Math.round(ultimo.hastaS / 60)}.` : null;
  const nota = [hasta, algunoCorto ? NOTA_GUION_CORTO : null].filter(Boolean).join(' ') || null;
  return escribir({ ...r.actual, estado: 'listo', hecho, texto, motivo: nota, fallos: 0 });
}

/** Lo que dice un guion de YouTube con un tramo debajo del piso de caracteres por minuto en todos los modelos. */
export const NOTA_GUION_CORTO = 'Puede faltar parte: Gemini devolvió menos texto del que suele decirse en ese tiempo.';

/** Lo que dice un guion PENDIENTE (YouTube: un «high demand» o el tope del día). Sin cartel: no es un error de nadie. */
export const NOTA_PENDIENTE = 'Lo transcribo más tarde.';

export function vistaDeGuion(g: Guion | null, opts: { aplica: boolean; sinIA?: boolean; sinClave?: boolean; sinGemini?: boolean; ahora?: number }): VistaGuion {
  if (!opts.aplica) return { estado: 'no-aplica' };
  const vivo = g && !vencido(g, opts.ahora ?? Date.now()) ? g : null;
  if (vivo?.estado === 'listo') return { estado: 'listo', texto: vivo.texto, motivo: vivo.motivo };
  if (vivo?.estado === 'no-pudo' && vivo.reintentarEn) return { estado: 'no-pudo', texto: null, motivo: NOTA_PENDIENTE };
  if (!vivo && opts.sinGemini) return { estado: 'sin-gemini' };
  if (!vivo && opts.sinClave) return { estado: 'sin-clave' };
  if (!vivo && opts.sinIA) return { estado: 'sin-ia' };
  if (!vivo) return { estado: 'transcribiendo', texto: null, motivo: null };
  return { estado: vivo.estado, texto: vivo.texto, motivo: vivo.motivo };
}
