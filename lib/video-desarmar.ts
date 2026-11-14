// =============================================================================
// Desarmar un video de la competencia, plano a plano, para replicarlo (ticket 97; PURO; 14/11/2026)
// =============================================================================
// Martín, 13/11/2026 (ticket 97, desde su WhatsApp), con https://github.com/JuneYaooo/rea-video: «implementa esto para video
// editor para análisis de la competencia y para otros formatos, para extraer al 100 % con ingeniería inversa cómo está
// construido ese video, cómo está la edición, para después replicarlo».
//
// Es lo que las recetas (lib/video-recetas.ts) hicieron A MANO con tres reels (bajarlo, contar los cortes con ffmpeg, leer un
// cuadro por segundo), para cualquier outlier: el Gemini DEL NEGOCIO mira el video entero y devuelve un `Desarme`. De ahí sale
//   · la `Receta` de siempre (la caja del reel, el chat del proyecto y la Edición automática la leen igual);
//   · una `Plantilla` «toca para reemplazar» (lib/editor-video/plantillas.ts, como «Utilizar plantilla» y CapCut Remake): un
//     hueco por plano con su tiempo, los textos en pantalla editables y el estilo de subtítulos detectado;
//   · el paquete VIDEO.md (formato abierto, ./video-desarmar-videomd.ts) y la línea de tiempo en JSON.
//
// ⚠️ LO QUE MIDE EL CÓDIGO NO LO DICE LA IA. Los cortes por minuto, el plano medio y el más corto salen de los planos
// (`ritmoDe`); la IA no los informa. Y la respuesta se lee como dato de un tercero (`leerDesarme`): tiempos fuera del video,
// planos encimados, colores que no son colores y listas infinitas se corrigen o se tiran, y lo corregido se anota en `dudas`.
// ⚠️ GEMINI MIRA 1 CUADRO POR SEGUNDO POR DEFECTO y pierde los cortes de menos de 1 s de un reel (docs/hallazgos-video-outliers.md,
// «Desarmar el video de la competencia»). `comoMirar` sube los cuadros por segundo según lo que dura, con un tope de cuadros.
//
// Puro (sin `server-only`): lo usan la ruta, la caja del reel, la página del editor y los tests.
// =============================================================================

import { FAMILIAS_EDICION, codigoDeReel, esFamiliaEdicion, idDeYoutube, type FamiliaEdicion, type OutlierVideo } from './video-outliers';
import { textoDeEdicionEnEditor, type EdicionDeReceta, type Receta } from './video-recetas';
import { LIENZO_REF, ZONA_SEGURA, type PiezaClip, type PiezaTexto, type Plantilla } from './editor-video/plantillas';

export const VERSION_DESARME = 1;

export type RedDesarme = 'instagram' | 'youtube' | 'tiktok' | 'meta-ads' | 'subido';
export type OrigenPlano = 'grabado' | 'ia' | 'codigo';
export type Proporcion = '9:16' | '16:9' | '1:1' | '4:5' | 'otra';
export type Posicion = 'arriba' | 'centro' | 'abajo';
export type Letra = 'sin-serifa' | 'con-serifa' | 'condensada' | 'manuscrita';
export type TamanoTexto = 'chico' | 'mediano' | 'grande' | 'gigante';
export type FondoTexto = 'ninguno' | 'caja' | 'contorno' | 'sombra';
export type Zoom = 'ninguno' | 'entra' | 'sale' | 'golpe';

export type PlanoDesarme = {
  /** 1..N, en orden. */
  n: number;
  desde: number;
  hasta: number;
  /** El bloque de la estructura al que pertenece (su nombre). */
  bloque: string;
  seVe: string;
  /** Primer plano, plano medio, plano general, detalle, pantalla… */
  encuadre: string;
  /** Fija, en mano, paneo, travelling… */
  camara: string;
  zoom: Zoom;
  broll: boolean;
  /** Cómo ENTRA este plano: corte seco, fundido, barrido, zoom… */
  transicion: string;
  /** Cómo se hizo: grabado con cámara, generado con IA o armado con código (motion graphics, pantalla, plantilla). */
  origen: OrigenPlano;
  /** 0–1: qué tan segura está la IA del origen. */
  seguridad: number;
  porQueOrigen: string;
  /** Lo que pone el negocio en su lugar. */
  paraReplicar: string;
};

/** Un texto en pantalla que NO es un subtítulo de la voz: un título, un rótulo, una cifra. EXACTO, como se lee. */
export type TextoEnPantalla = {
  texto: string;
  desde: number;
  hasta: number;
  posicion: Posicion;
  tamano: TamanoTexto;
  letra: Letra;
  mayusculas: boolean;
  color: string | null;
  fondo: FondoTexto;
  colorFondo: string | null;
};

export type Frase = { desde: number; hasta: number; texto: string };

export type EstiloSubtitulos = {
  hay: boolean;
  /** Cuántas palabras se ven a la vez (1–8). */
  palabrasPorVez: number;
  mayusculas: boolean;
  letra: Letra;
  gruesa: boolean;
  color: string | null;
  fondo: FondoTexto;
  colorFondo: string | null;
  /** Se pinta la palabra que se dice (karaoke) o se agranda una palabra clave por frase. */
  resaltado: 'ninguno' | 'palabra-dicha' | 'palabra-clave';
  colorResaltado: string | null;
  /** El tamaño de la palabra clave contra el resto, en % (100 = igual; 300 = tres veces). */
  tamanoClave: number;
  posicion: Posicion;
  animacion: string;
  descripcion: string;
};

export type Desarme = {
  version: typeof VERSION_DESARME;
  idioma: string;
  duracionS: number;
  proporcion: Proporcion;
  resumen: string;
  familia: FamiliaEdicion | null;
  gancho: { texto: string; hastaS: number; tipo: string; porQueFunciona: string };
  estructura: { nombre: string; desde: number; hasta: number; que: string }[];
  planos: PlanoDesarme[];
  textos: TextoEnPantalla[];
  frases: Frase[];
  subtitulos: EstiloSubtitulos;
  musica: { hay: boolean; volumen: 'ninguna' | 'de-fondo' | 'protagonista' | 'solo-en-golpes'; descripcion: string; efectos: string[] };
  /** Lo que dice la IA del ritmo; los números los mide `ritmoDe`. */
  ritmo: { pausasRecortadas: boolean; descripcion: string };
  llamadaALaAccion: { texto: string; desde: number } | null;
  /** La edición, paso a paso, con lo que tiene el editor de MaKo. */
  edicion: string[];
  grabarConAvatar: string[];
  grabarConPersona: string[];
  /** Lo que no se pudo ver o se corrigió al leer: se muestra, nunca se esconde. */
  dudas: string[];
};

/** De dónde salió el video, y cómo se miró. */
export type FuenteDesarme = {
  red: RedDesarme;
  /** El id en su red (código del reel, id de YouTube, id del anuncio) o el resumen del archivo subido. */
  id: string;
  url: string | null;
  cuenta: string | null;
  titulo: string | null;
};
export type ComoSeMiro = { modelo: string; fps: number; cuadros: number; tokens: number; resolucion: 'baja' | 'media'; hastaS: number | null; cuando: string };

/** Lo que se guarda (una vez por video y por negocio: el mismo video no se paga dos veces). */
export type DesarmeGuardado = { version: typeof VERSION_DESARME; fuente: FuenteDesarme; miro: ComoSeMiro; desarme: Desarme };

// ── La clave ────────────────────────────────────────────────────────────────────────────────────────────────────────

const RED_VALIDA = new Set<RedDesarme>(['instagram', 'youtube', 'tiktok', 'meta-ads', 'subido']);
const ID_VALIDO = /^[A-Za-z0-9_-]{3,64}$/;

/** `<red>.<id>`: lo que viaja en la URL del editor (`?desarme=`) y en la ruta. null si no es una. */
export function claveDeDesarme(red: string, id: string): string | null {
  return RED_VALIDA.has(red as RedDesarme) && ID_VALIDO.test(id) ? `${red}.${id}` : null;
}
export function leerClaveDesarme(clave: unknown): { red: RedDesarme; id: string } | null {
  if (typeof clave !== 'string' || clave.length > 80) return null;
  const i = clave.indexOf('.');
  if (i < 1) return null;
  const red = clave.slice(0, i);
  const id = clave.slice(i + 1);
  return claveDeDesarme(red, id) ? { red: red as RedDesarme, id } : null;
}
/** De qué video es un outlier de la portada (lib/video-outliers.ts), o null si no se sabe qué video traer. */
export function fuenteDeOutlier(x: Pick<OutlierVideo, 'red' | 'url' | 'creador' | 'titulo'>): FuenteDesarme | null {
  const id = x.red === 'youtube' ? idDeYoutube(x.url) : x.red === 'instagram' ? codigoDeReel(x.url) : null;
  if (!id || !claveDeDesarme(x.red, id)) return null;
  return { red: x.red, id, url: x.url, cuenta: x.creador.usuario, titulo: x.titulo };
}

/** «PT1M3S» (la duración de YouTube que guarda Spy) → 63. null si no es una. */
export function segundosIso(x: string | null | undefined): number | null {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec((x ?? '').trim());
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

/**
 * De qué video es una pieza de Competitors Spy: un reel de Instagram, un video de YouTube o un anuncio en video de la biblioteca
 * de Meta. null si no es un video (un carrusel, una imagen, una landing). `nombre`: el del competidor.
 */
export function fuenteDePiezaSpy(
  p: { canal: string; tipo: string; ref: string; url: string | null; medio?: string | null; titulo?: string | null },
  nombre: string | null,
): FuenteDesarme | null {
  const titulo = p.titulo?.trim() || null;
  if (p.canal === 'youtube') return /^[\w-]{11}$/.test(p.ref) ? { red: 'youtube', id: p.ref, url: `https://www.youtube.com/watch?v=${p.ref}`, cuenta: nombre, titulo } : null;
  if (p.canal === 'instagram' && (p.tipo === 'reel' || p.medio === 'video')) {
    const id = codigoDeReel(p.url) ?? (/^[A-Za-z0-9_-]{5,40}$/.test(p.ref) ? p.ref : null);
    return id && claveDeDesarme('instagram', id) ? { red: 'instagram', id, url: p.url, cuenta: nombre, titulo } : null;
  }
  if (p.canal === 'anuncios' && p.tipo === 'anuncio' && p.medio === 'video' && /^\d{6,25}$/.test(p.ref)) {
    return { red: 'meta-ads', id: p.ref, url: `https://www.facebook.com/ads/library/?id=${p.ref}`, cuenta: nombre, titulo };
  }
  return null;
}

/** La fila de `app_settings` del negocio. */
export const settingDeDesarme = (clave: string): string => `video.desarme.${clave}`;

// ── Cómo se mira (los cuadros por segundo) ──────────────────────────────────────────────────────────────────────────

/** Lo más que se le hace mirar a Gemini de un video: lo demás no entra en la plantilla ni en un pedido razonable. */
export const MAX_MIRAR_S = 20 * 60;
/** Tope de cuadros con resolución media (~258 tokens cada uno) y con baja (~66). */
const TOPE_CUADROS_MEDIA = 360;
const TOPE_CUADROS_BAJA = 1200;

/**
 * Los cuadros por segundo según lo que dura (null = no se sabe). Un reel: hasta 5 por segundo, para no perder un corte de medio
 * segundo (los insertos del reel de los pistachos duran 0,6 s); un video largo: 1 por segundo y resolución baja. Sin duración, se
 * supone un reel si la red es de reels, y un video largo si es YouTube.
 */
export function comoMirar(duracionS: number | null, red: RedDesarme): { fps: number; resolucion: 'baja' | 'media'; hastaS: number | null } {
  const d = duracionS != null && Number.isFinite(duracionS) && duracionS > 0 ? duracionS : null;
  if (d == null) return red === 'youtube' ? { fps: 1, resolucion: 'baja', hastaS: null } : { fps: 4, resolucion: 'media', hastaS: null };
  const hastaS = d > MAX_MIRAR_S ? MAX_MIRAR_S : null;
  const mirado = Math.min(d, MAX_MIRAR_S);
  const media = Math.floor(TOPE_CUADROS_MEDIA / mirado);
  if (media >= 2) return { fps: Math.min(5, media), resolucion: 'media', hastaS };
  return { fps: Math.max(1, Math.min(2, Math.floor(TOPE_CUADROS_BAJA / mirado))), resolucion: 'baja', hastaS };
}

// ── El pedido y el esquema ──────────────────────────────────────────────────────────────────────────────────────────

const FAMILIAS = Object.keys(FAMILIAS_EDICION);

/**
 * Lo que se le pide a Gemini, con lo que el editor de MaKo sabe hacer (para que los pasos de edición sean hacibles) y el método
 * del avatar (docs/manual-video-mako.md: imagen → video → voz). `fps`: los cuadros por segundo que va a mirar, para que sepa que
 * un corte más corto que eso puede no verse y lo diga en `dudas`.
 */
export function instruccionDesarme(o: { fps: number; duracionS: number | null; hastaS: number | null; cuenta: string | null; titulo: string | null }): string {
  return [
    'Eres editor de video y desarmas videos que funcionan para que otro negocio los replique. Mira el video ENTERO, plano a plano, y devuelve el JSON del esquema.',
    o.cuenta ? `Es un video de ${o.cuenta}${o.titulo ? ` («${o.titulo.slice(0, 160)}»)` : ''}.` : '',
    o.duracionS ? `Dura ${o.duracionS.toFixed(1)} s.` : '',
    o.hastaS ? `Mira sólo hasta el segundo ${o.hastaS}.` : '',
    `Estás viendo ${o.fps} cuadros por segundo: un plano más corto que ${(1 / o.fps).toFixed(2)} s puede no verse. Si sospechas un corte que no alcanzas a ver, dilo en "dudas"; no lo inventes.`,
    'Reglas:',
    '- Tiempos en segundos, con un decimal, desde el inicio del video.',
    '- "planos": un plano por cada CORTE de imagen (cada vez que cambia la toma, el encuadre o la escala de golpe). En orden, sin huecos ni encimados: cada uno empieza donde termina el anterior, el primero en 0 y el último en el final.',
    '- "origen" de cada plano: "grabado" (filmado con una cámara o un teléfono), "ia" (generado con IA: piel, manos, letras o física raras, movimiento que se deforma) o "codigo" (motion graphics, plantilla, pantalla grabada, texto animado sobre fondo liso). "seguridad" de 0 a 1 y "porQueOrigen" con lo que lo delata.',
    '- "textos": los textos EN PANTALLA que no son los subtítulos de la voz (títulos, rótulos, cifras, preguntas fijas, el llamado a la acción), copiados EXACTOS, con sus mayúsculas, sus emojis y su idioma. Uno por cada vez que aparece.',
    '- "frases": lo que se dice, palabra por palabra en su idioma, partido en frases con sus tiempos. Si no se dice nada, la lista vacía.',
    '- "subtitulos": el estilo de los subtítulos de la voz, si los hay (cuántas palabras a la vez, mayúsculas, letra, color, fondo, si se pinta la palabra que se dice o se agranda una palabra clave, y cuánto más grande en %).',
    '- "estructura": los bloques del video (gancho, desarrollo, prueba, cierre, llamado…) con sus tiempos; "gancho": lo que pasa en los primeros segundos y por qué frena el scroll.',
    '- "familia": la familia de edición que mejor lo describe, de la lista, o "ninguna".',
    '- "edicion": los pasos para editarlo en el editor de MaKo, que tiene: subtítulos automáticos con plantillas (Hormozi, Palabra gigante, Karaoke, Recuadro, Contorno…), palabras clave más grandes (hasta 300 %) y de otro color, textos con efectos (recuadro, trazo, sombra), recortar y borrar silencios, velocidad, escala y posición con fotogramas clave (zooms), máscara, efecto Desenfoque, transiciones, B-roll de Pexels o de sus archivos, y música. Pasos concretos, con números (tiempos, tamaños, colores).',
    '- "grabarConAvatar": cómo grabar las tomas con el avatar de IA del negocio: partir de su personaje aprobado; primero el fondo solo y después la persona; un video por frase, con la duración por la cantidad de palabras; la voz es su clon. "grabarConPersona": las instrucciones para que grabe otra persona (encuadre, luz, cámara, qué decir).',
    '- "paraReplicar" de cada plano: qué pone el negocio en ese hueco (su toma a cámara, su producto, una pantalla, un B-roll…), en una frase.',
    '- Escribe en español neutro, con «tú». Lo que no se ve o no se oye, vacío o en "dudas": NUNCA lo inventes.',
  ].filter(Boolean).join('\n');
}

const STR = { type: 'STRING' } as const;
const NUM = { type: 'NUMBER' } as const;
const BOOL = { type: 'BOOLEAN' } as const;
const LISTA_STR = { type: 'ARRAY', items: STR } as const;
const en = (valores: readonly string[]) => ({ type: 'STRING', enum: [...valores] });
const obj = (properties: Record<string, unknown>, opcionales: readonly string[] = []) => ({
  type: 'OBJECT',
  properties,
  required: Object.keys(properties).filter((k) => !opcionales.includes(k)),
  propertyOrdering: Object.keys(properties),
});

const LETRAS: readonly Letra[] = ['sin-serifa', 'con-serifa', 'condensada', 'manuscrita'];
const FONDOS: readonly FondoTexto[] = ['ninguno', 'caja', 'contorno', 'sombra'];
const POSICIONES: readonly Posicion[] = ['arriba', 'centro', 'abajo'];
const TAMANOS: readonly TamanoTexto[] = ['chico', 'mediano', 'grande', 'gigante'];
const ZOOMS: readonly Zoom[] = ['ninguno', 'entra', 'sale', 'golpe'];
const ORIGENES: readonly OrigenPlano[] = ['grabado', 'ia', 'codigo'];
const PROPORCIONES: readonly Proporcion[] = ['9:16', '16:9', '1:1', '4:5', 'otra'];
const VOLUMENES = ['ninguna', 'de-fondo', 'protagonista', 'solo-en-golpes'] as const;
const RESALTADOS = ['ninguno', 'palabra-dicha', 'palabra-clave'] as const;

/** El `responseSchema` de Gemini (el subconjunto OpenAPI que acepta: tipos en mayúsculas, `enum`, `required`, `nullable`). */
export const ESQUEMA_DESARME = obj({
  idioma: STR,
  duracionS: NUM,
  proporcion: en(PROPORCIONES),
  resumen: STR,
  familia: en([...FAMILIAS, 'ninguna']),
  gancho: obj({ texto: STR, hastaS: NUM, tipo: STR, porQueFunciona: STR }),
  estructura: { type: 'ARRAY', items: obj({ nombre: STR, desde: NUM, hasta: NUM, que: STR }) },
  planos: {
    type: 'ARRAY',
    items: obj({
      desde: NUM, hasta: NUM, bloque: STR, seVe: STR, encuadre: STR, camara: STR, zoom: en(ZOOMS), broll: BOOL, transicion: STR,
      origen: en(ORIGENES), seguridad: NUM, porQueOrigen: STR, paraReplicar: STR,
    }),
  },
  textos: {
    type: 'ARRAY',
    items: obj({
      texto: STR, desde: NUM, hasta: NUM, posicion: en(POSICIONES), tamano: en(TAMANOS), letra: en(LETRAS), mayusculas: BOOL,
      color: STR, fondo: en(FONDOS), colorFondo: STR,
    }),
  },
  frases: { type: 'ARRAY', items: obj({ desde: NUM, hasta: NUM, texto: STR }) },
  subtitulos: obj({
    hay: BOOL, palabrasPorVez: NUM, mayusculas: BOOL, letra: en(LETRAS), gruesa: BOOL, color: STR, fondo: en(FONDOS), colorFondo: STR,
    resaltado: en(RESALTADOS), colorResaltado: STR, tamanoClave: NUM, posicion: en(POSICIONES), animacion: STR, descripcion: STR,
  }),
  musica: obj({ hay: BOOL, volumen: en(VOLUMENES), descripcion: STR, efectos: LISTA_STR }),
  ritmo: obj({ pausasRecortadas: BOOL, descripcion: STR }),
  llamadaALaAccion: { ...obj({ texto: STR, desde: NUM }), nullable: true },
  edicion: LISTA_STR,
  grabarConAvatar: LISTA_STR,
  grabarConPersona: LISTA_STR,
  dudas: LISTA_STR,
}, ['llamadaALaAccion']);

// ── La lectura de la respuesta (un dato de un tercero) ──────────────────────────────────────────────────────────────

const TOPE_PLANOS = 300;
const TOPE_TEXTOS = 150;
const TOPE_FRASES = 800;
const TOPE_LISTA = 20;

type Crudo = Record<string, unknown>;
const esObj = (x: unknown): x is Crudo => !!x && typeof x === 'object' && !Array.isArray(x);
const lista = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
const txt = (x: unknown, max = 600): string => (typeof x === 'string' ? x.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const num = (x: unknown): number | null => {
  const n = typeof x === 'number' ? x : typeof x === 'string' ? Number(x.replace(',', '.')) : NaN;
  return Number.isFinite(n) ? n : null;
};
const s1 = (n: number) => Math.round(n * 10) / 10;
const uno = <T extends string>(x: unknown, validos: readonly T[], porDefecto: T): T => (validos.includes(x as T) ? (x as T) : porDefecto);
const color = (x: unknown): string | null => {
  const s = txt(x, 20).toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  if (/^#[0-9a-f]{3}$/.test(s)) return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  return null;
};
const textos = (x: unknown, max = 400): string[] => lista(x).map((v) => txt(v, max)).filter(Boolean).slice(0, TOPE_LISTA);

/**
 * La respuesta de Gemini, leída como dato de un tercero. `duracionS`: la que se conoce del video (manda sobre la que diga la IA).
 * Los planos quedan en orden, pegados de 0 al final (lo que pide la plantilla); lo corregido de más de 1 s queda en `dudas`.
 */
export function leerDesarme(crudo: unknown, o: { duracionS?: number | null } = {}): { ok: true; desarme: Desarme } | { ok: false; error: string } {
  if (!esObj(crudo)) return { ok: false, error: 'La respuesta no es un desarme.' };
  const dudas = textos(crudo.dudas);
  const dichos = lista(crudo.planos).filter(esObj);
  const finDicho = Math.max(0, ...dichos.map((p) => num(p.hasta) ?? 0));
  const conocida = o.duracionS != null && Number.isFinite(o.duracionS) && o.duracionS > 0 ? o.duracionS : null;
  const dicha = num(crudo.duracionS);
  const duracion = s1(conocida ?? (dicha && dicha > 0 ? dicha : finDicho));
  if (!(duracion > 0)) return { ok: false, error: 'La respuesta no dice cuánto dura el video.' };
  const enVideo = (n: number | null, porDefecto: number) => s1(Math.min(duracion, Math.max(0, n ?? porDefecto)));

  // Los planos: en orden, sin encimarse, pegados (el primero en 0 y el último en el final).
  const brutos = dichos
    .map((p) => ({ p, desde: enVideo(num(p.desde), 0), hasta: enVideo(num(p.hasta), 0), dicho: num(p.hasta) ?? 0 }))
    .filter((x) => x.hasta > x.desde)
    .sort((a, b) => a.desde - b.desde)
    .slice(0, TOPE_PLANOS);
  if (!brutos.length) return { ok: false, error: 'La respuesta no trae ningún plano.' };
  let corregido = 0;
  const planos: PlanoDesarme[] = [];
  for (const [i, { p, desde, dicho }] of brutos.entries()) {
    const previo = planos[planos.length - 1];
    const inicio = previo ? previo.hasta : 0;
    const siguiente = brutos[i + 1]?.desde ?? duracion;
    // Termina donde empieza el siguiente: sin huecos ni encimados (lo que pide la pista principal de una plantilla).
    const fin = i === brutos.length - 1 ? duracion : Math.max(inicio, siguiente);
    // Contra lo que DIJO la IA (no contra lo ya recortado al video): un plano que termina en el segundo 300 de un reel de 55 se dice.
    corregido = Math.max(corregido, Math.abs(inicio - desde), Math.abs(fin - dicho));
    if (fin - inicio < 0.1) continue;
    planos.push({
      n: planos.length + 1,
      desde: s1(inicio),
      hasta: s1(fin),
      bloque: txt(p.bloque, 80),
      seVe: txt(p.seVe),
      encuadre: txt(p.encuadre, 60),
      camara: txt(p.camara, 80),
      zoom: uno(p.zoom, ZOOMS, 'ninguno'),
      broll: p.broll === true,
      transicion: txt(p.transicion, 60) || 'corte seco',
      origen: uno(p.origen, ORIGENES, 'grabado'),
      seguridad: Math.min(1, Math.max(0, num(p.seguridad) ?? 0.5)),
      porQueOrigen: txt(p.porQueOrigen, 300),
      paraReplicar: txt(p.paraReplicar, 300),
    });
  }
  if (!planos.length) return { ok: false, error: 'La respuesta no trae ningún plano.' };
  // Si la IA dejó el último plano corto, el último se estira hasta el final: el video no se acorta.
  planos[planos.length - 1].hasta = duracion;
  if (corregido > 1) dudas.push(`Ajusté los tiempos de algún plano en ${corregido.toFixed(1)} s para que queden pegados de 0 al final.`);

  const enRango = (x: Crudo) => {
    const desde = enVideo(num(x.desde), 0);
    const hasta = enVideo(num(x.hasta), desde);
    return { desde, hasta: hasta > desde ? hasta : Math.min(duracion, s1(desde + 1)) };
  };
  const textosEnPantalla: TextoEnPantalla[] = lista(crudo.textos).filter(esObj).map((t) => ({
    texto: typeof t.texto === 'string' ? t.texto.trim().slice(0, 300) : '',
    ...enRango(t),
    posicion: uno(t.posicion, POSICIONES, 'centro'),
    tamano: uno(t.tamano, TAMANOS, 'mediano'),
    letra: uno(t.letra, LETRAS, 'sin-serifa'),
    mayusculas: t.mayusculas === true,
    color: color(t.color),
    fondo: uno(t.fondo, FONDOS, 'ninguno'),
    colorFondo: color(t.colorFondo),
  })).filter((t) => t.texto).sort((a, b) => a.desde - b.desde).slice(0, TOPE_TEXTOS);

  const frases: Frase[] = lista(crudo.frases).filter(esObj)
    .map((f) => ({ ...enRango(f), texto: txt(f.texto, 1000) }))
    .filter((f) => f.texto)
    .sort((a, b) => a.desde - b.desde)
    .slice(0, TOPE_FRASES);

  const sub = esObj(crudo.subtitulos) ? crudo.subtitulos : {};
  const subtitulos: EstiloSubtitulos = {
    hay: sub.hay === true,
    palabrasPorVez: Math.min(8, Math.max(1, Math.round(num(sub.palabrasPorVez) ?? 3))),
    mayusculas: sub.mayusculas === true,
    letra: uno(sub.letra, LETRAS, 'sin-serifa'),
    gruesa: sub.gruesa === true,
    color: color(sub.color),
    fondo: uno(sub.fondo, FONDOS, 'ninguno'),
    colorFondo: color(sub.colorFondo),
    resaltado: uno(sub.resaltado, RESALTADOS, 'ninguno'),
    colorResaltado: color(sub.colorResaltado),
    tamanoClave: Math.min(300, Math.max(100, Math.round(num(sub.tamanoClave) ?? 100))),
    posicion: uno(sub.posicion, POSICIONES, 'abajo'),
    animacion: txt(sub.animacion, 120),
    descripcion: txt(sub.descripcion, 400),
  };

  const est = lista(crudo.estructura).filter(esObj)
    .map((b) => ({ nombre: txt(b.nombre, 80), ...enRango(b), que: txt(b.que, 400) }))
    .filter((b) => b.nombre)
    .sort((a, b) => a.desde - b.desde)
    .slice(0, TOPE_LISTA);
  const g = esObj(crudo.gancho) ? crudo.gancho : {};
  const m = esObj(crudo.musica) ? crudo.musica : {};
  const r = esObj(crudo.ritmo) ? crudo.ritmo : {};
  const cta = esObj(crudo.llamadaALaAccion) && txt(crudo.llamadaALaAccion.texto) ? crudo.llamadaALaAccion : null;
  const familia = esFamiliaEdicion(crudo.familia) ? crudo.familia : null;
  const proporcion = uno(crudo.proporcion, PROPORCIONES, 'otra');

  return {
    ok: true,
    desarme: {
      version: VERSION_DESARME,
      idioma: txt(crudo.idioma, 20) || 'es',
      duracionS: duracion,
      proporcion,
      resumen: txt(crudo.resumen, 1200),
      familia,
      gancho: { texto: txt(g.texto, 400), hastaS: enVideo(num(g.hastaS), Math.min(3, duracion)), tipo: txt(g.tipo, 80), porQueFunciona: txt(g.porQueFunciona, 600) },
      estructura: est.length ? est : [{ nombre: 'Todo el video', desde: 0, hasta: duracion, que: '' }],
      planos,
      textos: textosEnPantalla,
      frases,
      subtitulos,
      musica: { hay: m.hay === true, volumen: uno(m.volumen, VOLUMENES, 'ninguna'), descripcion: txt(m.descripcion, 400), efectos: textos(m.efectos, 120) },
      ritmo: { pausasRecortadas: r.pausasRecortadas === true, descripcion: txt(r.descripcion, 400) },
      llamadaALaAccion: cta ? { texto: txt(cta.texto, 300), desde: enVideo(num(cta.desde), 0) } : null,
      edicion: textos(crudo.edicion),
      grabarConAvatar: textos(crudo.grabarConAvatar),
      grabarConPersona: textos(crudo.grabarConPersona),
      dudas,
    },
  };
}

// ── Lo que mide el código ───────────────────────────────────────────────────────────────────────────────────────────

export type Ritmo = { planos: number; cortes: number; cortesPorMinuto: number; planoMedioS: number; masCortoS: number; masLargoS: number; menosDeUnSegundo: number };

export function ritmoDe(d: Pick<Desarme, 'planos' | 'duracionS'>): Ritmo {
  const largos = d.planos.map((p) => p.hasta - p.desde);
  const cortes = Math.max(0, d.planos.length - 1);
  return {
    planos: d.planos.length,
    cortes,
    cortesPorMinuto: d.duracionS > 0 ? s1((cortes * 60) / d.duracionS) : 0,
    planoMedioS: largos.length ? s1(largos.reduce((a, b) => a + b, 0) / largos.length) : 0,
    masCortoS: largos.length ? s1(Math.min(...largos)) : 0,
    masLargoS: largos.length ? s1(Math.max(...largos)) : 0,
    menosDeUnSegundo: largos.filter((l) => l < 1).length,
  };
}

/** Lo que se dice durante un plano (las frases que se le encima). */
export function seDiceEn(p: Pick<PlanoDesarme, 'desde' | 'hasta'>, frases: readonly Frase[]): string {
  return frases.filter((f) => f.desde < p.hasta && f.hasta > p.desde).map((f) => f.texto).join(' ').trim();
}

/** Cuántos planos hay de cada origen, y cuántos segundos. */
export function mezclaDeOrigen(d: Pick<Desarme, 'planos'>): Record<OrigenPlano, { planos: number; segundos: number }> {
  const out: Record<OrigenPlano, { planos: number; segundos: number }> = { grabado: { planos: 0, segundos: 0 }, ia: { planos: 0, segundos: 0 }, codigo: { planos: 0, segundos: 0 } };
  for (const p of d.planos) { out[p.origen].planos += 1; out[p.origen].segundos = s1(out[p.origen].segundos + (p.hasta - p.desde)); }
  return out;
}

export const NOMBRE_ORIGEN: Record<OrigenPlano, string> = { grabado: 'Grabado', ia: 'Hecho con IA', codigo: 'Armado con código' };

// ── El estilo de subtítulos más parecido de la galería ─────────────────────────────────────────────────────────────

/** Lo que se compara de cada estilo de la galería (app/video-editor/_opencut/subtitles/estilos.ts → PLANTILLAS_SUBTITULO). */
export type EstiloDeGaleria = {
  id: string;
  fuente: string;
  negrita: boolean;
  color: string;
  mayusculas?: boolean;
  fondo?: { color: string };
  trazo?: { color: string };
  sombra?: boolean;
  resaltado?: { modo: 'palabra' | 'frase'; color: string };
  clavesTamano?: number;
};

const FUENTES_CON_SERIFA = /playfair|serif|georgia|lora|merriweather|times/i;
const FUENTES_CONDENSADAS = /anton|bebas|oswald|league gothic/i;
const FUENTES_MANUSCRITAS = /marker|caveat|pacifico|script|hand/i;
const letraDeFuente = (f: string): Letra =>
  FUENTES_CON_SERIFA.test(f) && !/sans/i.test(f) ? 'con-serifa' : FUENTES_CONDENSADAS.test(f) ? 'condensada' : FUENTES_MANUSCRITAS.test(f) ? 'manuscrita' : 'sin-serifa';

const rgb = (hex: string | null): [number, number, number] | null => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex ?? '');
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
};
/** 0 = el mismo color, 1 = lo más lejos (blanco contra negro). */
const distancia = (a: string | null, b: string | null): number => {
  const x = rgb(a);
  const y = rgb(b);
  if (!x || !y) return 0.5;
  return Math.sqrt((x[0] - y[0]) ** 2 + (x[1] - y[1]) ** 2 + (x[2] - y[2]) ** 2) / 441.7;
};

/**
 * El id del estilo de la galería que más se parece a lo detectado. Puntos por letra, mayúsculas, fondo, resaltado, palabra
 * clave grande y color. La galería entra por parámetro: este módulo no importa nada del motor del editor.
 */
export function estiloMasParecido(s: EstiloSubtitulos, galeria: readonly EstiloDeGaleria[]): string | null {
  if (!s.hay || !galeria.length) return null;
  let mejor: { id: string; puntos: number } | null = null;
  for (const e of galeria) {
    let puntos = 0;
    if (letraDeFuente(e.fuente) === s.letra) puntos += 3;
    if (!!e.mayusculas === s.mayusculas) puntos += 2;
    const fondo: FondoTexto = e.fondo ? 'caja' : e.trazo ? 'contorno' : e.sombra ? 'sombra' : 'ninguno';
    if (fondo === s.fondo) puntos += 3;
    else if (fondo !== 'caja' && s.fondo !== 'caja') puntos += 1;
    const resaltado = e.clavesTamano && e.clavesTamano > 160 ? 'palabra-clave' : e.resaltado?.modo === 'palabra' ? 'palabra-dicha' : 'ninguno';
    if (resaltado === s.resaltado) puntos += 3;
    if (s.resaltado === 'palabra-dicha' && e.resaltado) puntos += 2 * (1 - distancia(e.resaltado.color, s.colorResaltado));
    if (s.resaltado === 'palabra-clave' && e.clavesTamano) puntos += 2 * (1 - Math.abs(e.clavesTamano - s.tamanoClave) / 200);
    if (e.negrita === s.gruesa) puntos += 1;
    puntos += 2 * (1 - distancia(e.color, s.color));
    if (fondo === 'caja' && s.fondo === 'caja') puntos += 1.5 * (1 - distancia(e.fondo?.color ?? null, s.colorFondo));
    if (!mejor || puntos > mejor.puntos) mejor = { id: e.id, puntos };
  }
  return mejor?.id ?? null;
}

// ── La receta (lo que ya leen la caja del reel, el chat y la Edición automática) ───────────────────────────────────

const cuentaDe = (f: FuenteDesarme) => f.cuenta?.replace(/^@/, '') || (f.red === 'subido' ? 'tu archivo' : 'la competencia');
/** Cómo se nombra de quién es: «@usuario» si es un usuario; el nombre tal cual si es un nombre (Spy da «Alex Hormozi»). */
export const quienDe = (f: FuenteDesarme): string => {
  const c = cuentaDe(f);
  return f.cuenta && /^[A-Za-z0-9_.]+$/.test(c) ? `@${c}` : c;
};
const coma = (n: number) => String(s1(n)).replace('.', ',');

/** Lo que el editor aplica solo (`EdicionDeReceta`): el estilo de subtítulos, la palabra clave y la pausa. */
export function edicionDeDesarme(d: Desarme, estilo: string | null): EdicionDeReceta {
  const e: EdicionDeReceta = {};
  if (!d.subtitulos.hay) e.sinSubtitulos = true;
  else if (estilo) e.subtitulos = estilo;
  if (d.subtitulos.hay && d.subtitulos.resaltado === 'palabra-clave') {
    e.claves = { tamano: Math.min(300, Math.max(120, d.subtitulos.tamanoClave)), color: d.subtitulos.colorResaltado ?? d.subtitulos.color ?? '#ffffff' };
  }
  if (d.ritmo.pausasRecortadas && d.frases.length) e.pausaMinima = 0.5;
  return e;
}

/** El nombre del proyecto y de la receta: de quién es y su gancho. */
export function nombreDeDesarme(g: Pick<DesarmeGuardado, 'fuente' | 'desarme'>): string {
  const gancho = g.desarme.gancho.texto || g.fuente.titulo || '';
  const corto = gancho.length > 48 ? `${gancho.slice(0, 47).trimEnd()}…` : gancho;
  return corto ? `${corto} · ${quienDe(g.fuente)}` : `El video de ${quienDe(g.fuente)}`;
}

/**
 * La `Receta` del video desarmado: la misma forma que las tres medidas a mano, así la caja del reel, el chat del proyecto
 * (`textoDeReceta`) y la Edición automática (`recetaDelHilo` → `editor`) la leen igual. Los pasos de edición empiezan con lo
 * MEDIDO (los cortes) y siguen con los de la IA.
 */
export function recetaDeDesarme(g: DesarmeGuardado, estilo: string | null): Receta {
  const { desarme: d, fuente: f } = g;
  const r = ritmoDe(d);
  const medidos = [
    `${r.planos} ${r.planos === 1 ? 'plano' : 'planos'} en ${coma(d.duracionS)} s: un corte cada ${coma(r.planoMedioS)} s de media; el más corto dura ${coma(r.masCortoS)} s${r.menosDeUnSegundo ? ` (${r.menosDeUnSegundo} de menos de 1 s)` : ''}.`,
    ...(d.textos.length ? [`${d.textos.length} ${d.textos.length === 1 ? 'texto' : 'textos'} en pantalla, ya puestos en la plantilla con su tiempo: cámbialos por los tuyos.`] : []),
  ];
  return {
    id: `desarme:${f.red}.${f.id}`,
    familia: d.familia ?? 'subtitulos-con-estilo',
    nombre: nombreDeDesarme(g),
    porque: d.gancho.porQueFunciona || d.resumen,
    referencia: { codigo: f.id, cuenta: cuentaDe(f) },
    duracionS: s1(d.duracionS),
    estructura: d.estructura.map((b) => ({ nombre: b.nombre, desde: b.desde, hasta: b.hasta, que: b.que })),
    edicion: [...medidos, ...d.edicion],
    editor: edicionDeDesarme(d, estilo),
    grabacion: { avatar: d.grabarConAvatar, persona: d.grabarConPersona },
  };
}

// ── La plantilla «toca para reemplazar» ─────────────────────────────────────────────────────────────────────────────

/** Lo más que se arma en la plantilla: un video largo de YouTube no entra en un reel. */
export const MAX_PLANTILLA_S = 180;
/** Las pistas de texto que tiene una plantilla (lib/editor-video/plantillas.ts → PistaPlantilla). */
const PISTAS_TEXTO = ['texto-1', 'texto-2', 'texto-3', 'texto-4'] as const;

/** Segundos en cuadros de 30 fps, como las plantillas del catálogo. */
const cuadro = (s: number) => Math.round(s * 30) / 30;

/** El rótulo de la muestra de un hueco: el número del plano y lo que va (se dibuja en la imagen de muestra). */
export function rotuloDePlano(p: Pick<PlanoDesarme, 'n' | 'paraReplicar' | 'seVe' | 'broll' | 'origen'>): string {
  const que = p.paraReplicar || (p.broll ? 'B-roll' : p.origen === 'codigo' ? 'Texto o gráfico' : p.seVe) || 'Tu clip';
  const corto = que.length > 44 ? `${que.slice(0, 43).trimEnd()}…` : que;
  return `${p.n}. ${corto}`;
}

/** Fuentes que el armado de plantillas CARGA (text/estilos-predefinidos.ts → FUENTES_PLANTILLAS; lo fija el test). */
const FUENTE_DE_LETRA: Record<Letra, string> = { 'sin-serifa': 'Montserrat', 'con-serifa': 'Playfair Display', condensada: 'Anton', manuscrita: 'Pacifico' };
const PX_DE_TAMANO: Record<TamanoTexto, number> = { chico: 44, mediano: 60, grande: 84, gigante: 118 };

/** El efecto de texto del editor (text/estilos-predefinidos.ts → EFECTOS_TEXTO) que más se parece. */
export function efectoDeTexto(t: Pick<TextoEnPantalla, 'fondo' | 'color' | 'colorFondo'>): string {
  if (t.fondo === 'caja') {
    const opciones: Array<[string, string]> = [['recuadro-negro', '#000000'], ['recuadro-blanco', '#ffffff'], ['recuadro-amarillo', '#ffe14d'], ['etiqueta-roja', '#e5283a'], ['etiqueta-cian', '#00c1cd']];
    return opciones.reduce((a, b) => (distancia(b[1], t.colorFondo) < distancia(a[1], t.colorFondo) ? b : a))[0];
  }
  if (t.fondo === 'contorno') return distancia(t.color, '#ffe14d') < distancia(t.color, '#ffffff') ? 'amarillo-trazo-negro' : 'blanco-trazo-negro';
  if (t.fondo === 'sombra') return 'sombra-dura';
  return 'sombra-suave';
}

/** Dónde va la caja del texto (px de 1080×1920 desde arriba), siempre dentro de la zona segura de Meta. */
function anclaDe(p: Posicion): PiezaTexto['ancla'] {
  if (p === 'arriba') return { borde: 'arriba', y: ZONA_SEGURA.arriba + 30 };
  if (p === 'abajo') return { borde: 'abajo', y: ZONA_SEGURA.abajo - 10 };
  return { borde: 'centro', y: Math.round(LIENZO_REF.alto / 2) };
}

/**
 * La `Plantilla` del video desarmado (lib/editor-video/plantillas.ts), para `usarPlantilla` del editor: un hueco por plano en la
 * pista principal, pegados de 0 al final (cada uno con su rótulo: el número y lo que va), y los textos en pantalla como textos
 * editables con su tiempo, su posición y un efecto parecido. Hasta `MAX_PLANTILLA_S`; lo que sobra se dice en `recorte`.
 * Un texto que no entra en las cuatro pistas de texto (más de cuatro a la vez) se cuenta en `textosFuera`.
 */
export function plantillaDeDesarme(g: DesarmeGuardado, estilo: string | null): { plantilla: Plantilla; recorte: number | null; textosFuera: number } {
  const d = g.desarme;
  const tope = Math.min(d.duracionS, MAX_PLANTILLA_S);
  const piezas: Array<PiezaClip | PiezaTexto> = [];
  const planos = d.planos.filter((p) => p.desde < tope - 0.05);
  for (const [i, p] of planos.entries()) {
    const inicio = cuadro(i === 0 ? 0 : p.desde);
    const fin = cuadro(i === planos.length - 1 ? tope : Math.min(p.hasta, tope));
    if (fin - inicio < 1 / 30) continue;
    piezas.push({ tipo: 'clip', hueco: { nombre: `plano-${p.n}`, rotulo: rotuloDePlano(p), acepta: 'ambos' }, pista: 'principal', inicio, fin });
  }
  const libres: number[] = PISTAS_TEXTO.map(() => 0);
  let textosFuera = 0;
  for (const [i, t] of d.textos.entries()) {
    if (t.desde >= tope - 0.05) continue;
    const inicio = cuadro(t.desde);
    const fin = cuadro(Math.min(t.hasta, tope));
    if (fin - inicio < 1 / 30) continue;
    const pista = libres.findIndex((libre) => libre <= inicio + 1e-6);
    if (pista < 0) { textosFuera += 1; continue; }
    libres[pista] = fin;
    piezas.push({
      tipo: 'texto',
      hueco: { nombre: `texto-${i + 1}`, maxCaracteres: Math.max(40, Array.from(t.texto).length + 20) },
      muestra: t.texto,
      pista: PISTAS_TEXTO[pista],
      inicio,
      fin,
      estilo: { efecto: efectoDeTexto(t), fuente: FUENTE_DE_LETRA[t.letra], px: PX_DE_TAMANO[t.tamano], negrita: t.letra !== 'con-serifa', mayusculas: t.mayusculas, ...(t.fondo === 'caja' ? { relleno: [0.4, 0.2] as [number, number] } : {}) },
      ancla: anclaDe(t.posicion),
    });
  }
  const portada = cuadro(Math.min(tope / 2, Math.max(0.5, d.gancho.hastaS / 2)));
  return {
    plantilla: {
      id: `desarme-${g.fuente.red}-${g.fuente.id}`.slice(0, 80),
      nombre: nombreDeDesarme(g),
      descripcion: d.resumen || `El video de ${quienDe(g.fuente)}, plano a plano.`,
      duracion: cuadro(tope),
      portada,
      ...(estilo ? { subtitulos: estilo } : {}),
      ideaDe: [g.fuente.url ?? `${g.fuente.red}:${g.fuente.id}`],
      piezas,
    },
    recorte: d.duracionS > MAX_PLANTILLA_S ? s1(d.duracionS) : null,
    textosFuera,
  };
}

// ── Lo que dice MaKo en el chat del proyecto ────────────────────────────────────────────────────────────────────────

/** El primer mensaje de MaKo en el proyecto armado desde un desarme: la receta entera, y qué es cada hueco. */
export function textoDeDesarme(g: DesarmeGuardado, estilo: string | null, o: { recorte: number | null; textosFuera: number }): string {
  const r = recetaDeDesarme(g, estilo);
  const d = g.desarme;
  const lista = (xs: readonly string[]) => xs.map((x, i) => `${i + 1}. ${x}`).join('\n');
  const huecos = d.planos.filter((p) => p.desde < MAX_PLANTILLA_S).map((p) => `· ${rotuloDePlano(p)} (${coma(p.desde)}–${coma(p.hasta)} s)`);
  const editor = r.editor ? textoDeEdicionEnEditor(r.editor) : null;
  return [
    `Armé este proyecto para replicar «${r.nombre}» (el video de ${quienDe(g.fuente)}). ${r.porque}`.trim(),
    `Es una plantilla: cada plano del original es un hueco con su tiempo. Toca un hueco y «Sustituir» para poner tu clip; los textos del original ya están en su lugar, cámbialos por los tuyos.${o.recorte ? ` El original dura ${coma(o.recorte)} s: armé los primeros ${MAX_PLANTILLA_S}.` : ''}${o.textosFuera ? ` ${o.textosFuera} ${o.textosFuera === 1 ? 'texto no entró' : 'textos no entraron'} (más de cuatro a la vez).` : ''}`,
    `Los huecos:\n${huecos.join('\n')}`,
    `La estructura (${coma(r.duracionS)} s):\n${r.estructura.map((b) => `· ${b.nombre} (${coma(b.desde)}–${coma(b.hasta)} s): ${b.que}`).join('\n')}`,
    ...(r.grabacion.avatar.length ? [`Para grabarlo con tu avatar de IA:\n${lista(r.grabacion.avatar)}`] : []),
    ...(r.grabacion.persona.length ? [`Si lo graba otra persona:\n${lista(r.grabacion.persona)}`] : []),
    `Cuando tengas tus tomas, la edición es así:\n${lista(r.edicion)}`,
    ...(editor ? [editor] : []),
  ].join('\n\n');
}

/** Cuánto dura algo, para la pantalla («1:05», «48 s»). */
export function duracionCorta(s: number): string {
  if (s < 60) return `${coma(s)} s`;
  const m = Math.floor(s / 60);
  const r = Math.round(s - m * 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}
