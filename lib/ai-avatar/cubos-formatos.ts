// =============================================================================
// cubos-formatos — los formatos del video del personaje en cubos y sus datos (módulo PURO, sin React ni servidor)
// =============================================================================
// Cada formato ES una página de la galería de animaciones (C:/dev/artefactos-animaciones/reels/<id>.html) pasada a la app en
// public/avatar-cubos/<id>.html, con lo que estaba escrito a mano convertido en DATOS (`window.CUBOS.datos`). Sin datos, la
// página da el video de la galería: ése es el `ejemplo` de acá, y es la prueba de que el puerto salió igual.
//
// La IA sólo escribe el guion y estos datos (pocas palabras, pocos MaKo Tokens); la animación es la plantilla.
// `normalizarGuion` y `normalizarDatos` son la única puerta: lo que no calza se descarta, no se inventa.
// Cómo se suma un formato: docs/editor-video/ai-avatar-por-codigo.md, «El puerto de un formato».
// =============================================================================

import type { Escena } from './cubos-tiempos';

export const IDS_FORMATO = ['punch-captions', 'karaoke-subs'] as const;
export type IdFormato = (typeof IDS_FORMATO)[number];

/** Un golpe de cámara: se acerca en esa palabra de esa escena y suelta al empezar la escena siguiente. */
export type Golpe = { escena: string; palabra: string };

export type DatosCubos = {
  /** Lo que dice el cierre o la etiqueta: el nombre del negocio (en el ejemplo, MaKo). */
  marca: string;
  /** Palabras gigantes: las palabras que van en amarillo (sin tildes ni signos, en minúscula). */
  claves?: string[];
  /** Subtítulos karaoke: dónde se acerca la cámara (y levanta las cejas el personaje). */
  golpes?: Golpe[];
  /** Subtítulos karaoke: los trozos cortados a mano (índices de palabra por línea). Sin esto se cortan solos. */
  trozos?: number[][][];
};

export type FormatoCubos = {
  id: IdFormato;
  nombre: string;
  linea: string;
  /** La página de la plantilla, servida por la app. */
  pagina: string;
  /** Un cuadro del video de la galería (para la tarjeta del formato). */
  poster: string;
  /** El video de la galería: guion y datos con los que la plantilla da el mismo video. */
  ejemplo: { escenas: Escena[]; datos: DatosCubos };
  /** Lo que la IA tiene que escribir en `datos`, además del guion. */
  paraLaIa: string;
};

const esc = (pares: [string, string][]): Escena[] => pares.map(([id, texto]) => ({ id, texto }));

export const FORMATOS_CUBOS: readonly FormatoCubos[] = [
  {
    id: 'punch-captions',
    nombre: 'Palabras gigantes',
    linea: 'Tu personaje habla y las palabras saltan en grande.',
    pagina: '/avatar-cubos/punch-captions.html',
    poster: '/avatar-cubos/ejemplos/punch-captions.jpg',
    ejemplo: {
      escenas: esc([
        ['s1', 'Hay una sola cosa que separa a quien vende high ticket de quien no.'],
        ['s2', 'Y no es el precio.'],
        ['s3', 'Es la oferta.'],
        ['s4', 'Máko te hace las preguntas de un mentor,'],
        ['s5', 'y te deja la oferta lista para vender.'],
        ['s6', 'Pruébalo gratis siete días.'],
      ]),
      datos: { marca: 'MaKo', claves: ['cosa', 'ticket', 'precio', 'oferta', 'mentor', 'vender', 'gratis', 'mako'] },
    },
    paraLaIa: '"claves": de 4 a 8 palabras del guion que van en amarillo, las más fuertes (una palabra cada una, tal como está en el guion).',
  },
  {
    id: 'karaoke-subs',
    nombre: 'Subtítulos karaoke',
    linea: 'Tu personaje habla y se marca la palabra que suena.',
    pagina: '/avatar-cubos/karaoke-subs.html',
    poster: '/avatar-cubos/ejemplos/karaoke-subs.jpg',
    ejemplo: {
      escenas: esc([
        ['s1', 'La primera semana vendiendo high ticket es terrible.'],
        ['s2', 'Mandas mensajes que nadie contesta,'],
        ['s3', 'y a quien sí contesta, nunca le vuelves a escribir.'],
        ['s4', 'La IA de Máko te escribe cada mensaje,'],
        ['s5', 'y el CRM te avisa a quién seguir por WhatsApp.'],
        ['s6', 'Pruébalo gratis siete días.'],
      ]),
      datos: {
        marca: 'MaKo',
        golpes: [{ escena: 's1', palabra: 'terrible' }, { escena: 's4', palabra: 'mako' }],
        trozos: [
          [[0, 1, 2], [3, 4, 5]], [[6, 7]], [[8, 9], [10, 11, 12]], [[13, 14, 15, 16], [17]], [[18, 19, 20], [21, 22]],
          [[23, 24, 25, 26], [27, 28, 29, 30]], [[31, 32, 33, 34, 35], [36, 37, 38]], [[39, 40]], [[41, 42], [43, 44]],
        ],
      },
    },
    paraLaIa: '"golpes": 1 o 2 momentos fuertes, cada uno {"escena": "s1", "palabra": "<una palabra de esa escena>"}; ahí se acerca la cámara.',
  },
];

export const formatoCubos = (id: unknown): FormatoCubos | null => FORMATOS_CUBOS.find((f) => f.id === id) ?? null;

// ─────────────────────────────────────────────────────────────────────────────
// El guion
// ─────────────────────────────────────────────────────────────────────────────

/** El tope del guion: la galería va a ≤ 42 palabras (unos 15 s); se deja un poco de aire. */
export const MAX_PALABRAS = 50;
export const MAX_ESCENAS = 8;
const MAX_LARGO_ESCENA = 160;

/** Minúsculas, sin tildes ni signos: como compara el kit (`K.limpia`). */
export const limpiar = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9ñ$%]/g, '');

/**
 * Las frases del guion (lo que escribe la persona o la IA) pasadas a escenas `s1…sN`. Acepta una lista de textos o de
 * {texto}. Devuelve el error en palabras si no se puede usar.
 */
export function normalizarGuion(x: unknown): { ok: true; escenas: Escena[] } | { ok: false; error: string } {
  const lista = Array.isArray(x) ? x : [];
  const textos = lista
    .map((e) => (typeof e === 'string' ? e : e && typeof e === 'object' && typeof (e as { texto?: unknown }).texto === 'string' ? (e as { texto: string }).texto : ''))
    .map((t) => t.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (!textos.length) return { ok: false, error: 'Escribe al menos una frase.' };
  // una frase larga se AVISA: cortarla en silencio le cambiaría el guion a la persona
  const larga = textos.findIndex((t) => t.length > MAX_LARGO_ESCENA);
  if (larga >= 0) return { ok: false, error: `La frase ${larga + 1} es muy larga: pártela en dos renglones.` };
  if (textos.length > MAX_ESCENAS) return { ok: false, error: `Son ${textos.length} frases: el máximo es ${MAX_ESCENAS}.` };
  const escenas = textos.map((texto, i) => ({ id: `s${i + 1}`, texto }));
  const n = escenas.reduce((s, e) => s + e.texto.split(' ').length, 0);
  if (n > MAX_PALABRAS) return { ok: false, error: `Son ${n} palabras: el máximo es ${MAX_PALABRAS} (unos 18 segundos).` };
  return { ok: true, escenas };
}

/** El guion escrito de corrido (una frase por renglón en la pantalla) pasado a frases. */
export const frasesDeTexto = (txt: string): string[] => txt.split(/\n+/).map((l) => l.trim()).filter(Boolean);

// ─────────────────────────────────────────────────────────────────────────────
// Los datos del formato
// ─────────────────────────────────────────────────────────────────────────────

const MAX_MARCA = 24;

/**
 * Los datos de un formato, validados contra SU guion: una palabra clave que el guion no dice, un golpe en una escena que no
 * existe o unos trozos que no cubren todas las palabras se descartan (sin ellos la plantilla hace lo suyo sola).
 */
export function normalizarDatos(formato: IdFormato, x: unknown, escenas: readonly Escena[], marcaPorDefecto: string): DatosCubos {
  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  const marca = (typeof o.marca === 'string' && o.marca.trim() ? o.marca : marcaPorDefecto).replace(/\s+/g, ' ').trim().slice(0, MAX_MARCA) || 'MaKo';
  const palabras = escenas.flatMap((e) => e.texto.split(/\s+/).filter(Boolean).map((p) => ({ escena: e.id, limpia: limpiar(p) })));
  const dice = new Set(palabras.map((p) => p.limpia));
  if (formato === 'punch-captions') {
    const claves = (Array.isArray(o.claves) ? o.claves : [])
      .filter((c): c is string => typeof c === 'string').map(limpiar).filter((c) => c && dice.has(c));
    return { marca, claves: [...new Set(claves)].slice(0, 10) };
  }
  // karaoke-subs
  const golpes = (Array.isArray(o.golpes) ? o.golpes : [])
    .map((g): Record<string, unknown> => (g && typeof g === 'object' ? (g as Record<string, unknown>) : {}))
    .map((g) => ({ escena: String(g.escena ?? ''), palabra: limpiar(String(g.palabra ?? '')) }))
    .filter((g) => palabras.some((p) => p.escena === g.escena && p.limpia === g.palabra))
    .slice(0, 2);
  const total = palabras.length;
  let trozos: number[][][] | undefined;
  if (Array.isArray(o.trozos)) {
    const plano = (o.trozos as unknown[]).flatMap((b) => (Array.isArray(b) ? b : [])).flatMap((l) => (Array.isArray(l) ? l : []));
    const enOrden = plano.length === total && plano.every((v, i) => v === i);
    if (enOrden) trozos = o.trozos as number[][][];
  }
  return { marca, golpes, ...(trozos ? { trozos } : {}) };
}

/** Palabras que nunca son «la fuerte» de una frase (las mismas que el kit no deja colgando). */
const DEBILES = new Set(['a', 'al', 'de', 'del', 'el', 'la', 'las', 'los', 'lo', 'un', 'una', 'unos', 'unas', 'y', 'o', 'que', 'te', 'tu', 'tus', 'es', 'en', 'con', 'para', 'por', 'se', 'su', 'sus', 'mi', 'me', 'no', 'sin', 'mas', 'muy', 'como', 'cada', 'le', 'les', 'ni', 'ya', 'este', 'esta', 'eso', 'esto', 'pero', 'cuando', 'donde', 'quien', 'hay', 'son', 'tiene', 'hace']);

/**
 * Los datos SIN IA, para un guion que escribió la persona (cero MaKo Tokens): en cada frase, su última palabra fuerte
 * (≥ 4 letras y no débil). Palabras gigantes: esas van en amarillo. Karaoke: la cámara se acerca en la primera frase y en
 * la que nombra la marca (o en la penúltima).
 */
export function datosAutomaticos(formato: IdFormato, escenas: readonly Escena[], marca: string): DatosCubos {
  const fuerte = (e: Escena): string | null => {
    const ps = e.texto.split(/\s+/).map(limpiar).filter((p) => p.length >= 4 && !DEBILES.has(p));
    return ps.length ? ps[ps.length - 1] : null;
  };
  if (formato === 'punch-captions') {
    const claves = escenas.map(fuerte).filter((p): p is string => !!p);
    return normalizarDatos(formato, { marca, claves: [...new Set(claves)].slice(0, 8) }, escenas, marca);
  }
  const m = limpiar(marca);
  const golpes: Golpe[] = [];
  const g1 = escenas[0] && fuerte(escenas[0]);
  if (g1) golpes.push({ escena: escenas[0].id, palabra: g1 });
  const conMarca = escenas.slice(1).find((e) => m && e.texto.split(/\s+/).some((p) => limpiar(p) === m));
  const otra = conMarca ?? (escenas.length >= 3 ? escenas[escenas.length - 2] : null);
  if (otra) {
    const palabra = conMarca ? m : fuerte(otra);
    if (palabra) golpes.push({ escena: otra.id, palabra });
  }
  return normalizarDatos(formato, { marca, golpes }, escenas, marca);
}

/** Lo que se le pide a la IA para escribir un guion de este formato. */
export function pedidoDelGuion(f: FormatoCubos, idea: string, negocio: string): { system: string; user: string } {
  return {
    system: [
      'Escribes guiones cortísimos para un video vertical donde un personaje en cubos le habla a cámara.',
      'Español neutro, con «tú», sin modismos de un país. Textos neutros en género (nada de «listo/a» ni «bienvenido»).',
      `De 4 a 7 frases cortas; entre 30 y 42 palabras en total (unos 15 segundos). Números escritos en letras.`,
      'Sin emojis, sin hashtags, sin comillas. Cierra con una invitación concreta.',
      'No prometas nada que el negocio no haya dicho.',
      'Contesta SOLO un JSON: {"escenas": ["frase 1", "frase 2", ...], "datos": {...}}.',
      `En "datos": ${f.paraLaIa}`,
    ].join('\n'),
    user: `Negocio: ${negocio || 'mi negocio'}\nIdea del video: ${idea}`,
  };
}
