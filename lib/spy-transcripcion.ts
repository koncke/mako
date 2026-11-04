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
// SÓLO LOS REELS DE INSTAGRAM. Apify con la clave de Spy es lo que Martín decidió «sólo para Spy» y sobre Instagram; un
// video de YouTube no tiene una forma permitida de bajarse ni de leer sus subtítulos sin ser su dueño (`captions.download`
// pide OAuth del canal). Eso queda como decisión suya (docs/relevo/nube-spy.md).
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
};

/** Lo que la pantalla dibuja del guion de una pieza. */
export type VistaGuion =
  | { estado: 'no-aplica' }
  | { estado: 'sin-ia' }
  | { estado: 'sin-clave' }
  | { estado: EstadoGuion; texto: string | null; motivo: string | null };

/** ¿Tiene guion para transcribir? Un reel de Instagram, y nada más (ver la cabecera). */
export const tieneGuion = (p: { canal: string; tipo: string }): boolean => p.canal === 'instagram' && p.tipo === 'reel';

/** Su enlace de Instagram: el que se guardó, o el armado con su código. */
export function enlaceDeLaPublicacion(p: { url: string | null; ref: string }): string | null {
  if (p.url && /^https:\/\/(www\.)?instagram\.com\//i.test(p.url)) return p.url;
  return /^[\w-]{5,40}$/.test(p.ref) ? `https://www.instagram.com/p/${p.ref}/` : null;
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
  };
}

const ms = (iso: string | null): number => (iso ? Date.parse(iso) || 0 : 0);

/** ¿Venció? Un guion listo de hace más de 30 días ya no se muestra ni se guarda. */
export const vencido = (g: Guion | null, ahora: number): boolean => !!g && g.estado === 'listo' && ahora - ms(g.hecho ?? g.desde) > RETENCION_MS;

/** ¿Hay que transcribirla ahora? */
export function hayQueTranscribir(g: Guion | null, ahora: number): boolean {
  if (!g || vencido(g, ahora)) return true;
  if (g.estado === 'listo') return false;
  if (g.estado === 'transcribiendo') return ahora - ms(g.desde) > TRANSCRIBIENDO_VENCE_MS;
  return ahora - ms(g.desde) >= (g.fallos >= FALLOS_HASTA_ESPERAR ? ESPERA_LARGA_MS : ESPERA_TRAS_FALLO_MS);
}

/** El texto como se muestra: sin espacios de más, en párrafos de no más de ~3 frases, y con su techo. */
export function guionLegible(t: string): string {
  const limpio = t.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
  if (limpio.includes('\n')) return limpio.slice(0, TOPE_GUION);
  const frases = limpio.match(/[^.!?¿¡]+[.!?]+["»”]?\s*|[^.!?]+$/g) ?? [limpio];
  const parrafos: string[] = [];
  for (let i = 0; i < frases.length; i += 3) parrafos.push(frases.slice(i, i + 3).join('').trim());
  return parrafos.filter(Boolean).join('\n\n').slice(0, TOPE_GUION);
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

export type ReclamoGuion =
  | { corre: false; actual: Guion | null }
  | { corre: true; actual: Guion; version: string };

/** Toma el trabajo si hace falta, ganando el compare-and-set. Un guion vencido se pisa acá (su texto se va). */
export async function reclamarGuion(deps: DepsGuion, ahora = Date.now()): Promise<ReclamoGuion> {
  const l = await deps.leer();
  const previo = leerGuion(l.crudo);
  if (!hayQueTranscribir(previo, ahora)) return { corre: false, actual: previo };
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

export function vistaDeGuion(g: Guion | null, opts: { aplica: boolean; sinIA?: boolean; sinClave?: boolean; ahora?: number }): VistaGuion {
  if (!opts.aplica) return { estado: 'no-aplica' };
  const vivo = g && !vencido(g, opts.ahora ?? Date.now()) ? g : null;
  if (vivo?.estado === 'listo') return { estado: 'listo', texto: vivo.texto, motivo: vivo.motivo };
  if (!vivo && opts.sinClave) return { estado: 'sin-clave' };
  if (!vivo && opts.sinIA) return { estado: 'sin-ia' };
  if (!vivo) return { estado: 'transcribiendo', texto: null, motivo: null };
  return { estado: vivo.estado, texto: vivo.texto, motivo: vivo.motivo };
}
