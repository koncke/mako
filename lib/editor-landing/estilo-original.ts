// =============================================================================
// editor-landing/estilo-original — el ESTILO de una página de afuera, para replicarla con el suyo (tanda 6, d)
// =============================================================================
// Decisión de Martín (14/10/2026, docs/relevo/landing-generator.md, «Tanda 6» punto d): «Replicar en el
// editor» pregunta 3 formatos, y «al replicar como landing se COPIA el estilo (colores y fuentes leídos en
// el navegador → tema propio; imágenes al bucket), nada de fotos de stock». Hasta acá la réplica nacía
// con el tema de fábrica y huecos donde el original tenía sus fotos: se veía como OTRA página.
//
// Lo que vive acá, PURO (sin server-only, sin DOM: lo importan el lector del navegador, replicar.ts y el
// test):
//   · `EstiloOriginal`: lo que se sabe del estilo de la página, venga de donde venga. Dos fuentes:
//       1. la LECTURA EN EL NAVEGADOR (lector-script.ts): los estilos COMPUTADOS de la página armada
//          (body, el título, el botón principal, el fondo detrás de cada título) y sus imágenes grandes
//          visibles. Llega de una página ajena: `sanearEstilo` la deja con forma y topes;
//       2. el HTML que baja el SERVER (`estiloDeHtml`), cuando no hubo lectura: las variables CSS (las de
//          shadcn/Tailwind, Elementor, Bootstrap, WordPress), el <link> de Google Fonts, el theme-color,
//          las reglas de body/h1/botones, los estilos en línea, las <img> y el og:image;
//   · `temaDeEstilo`: ese estilo → un TEMA PROPIO del workspace (`TemaPropio`, el que el editor ya sabe
//     dibujar: base + cambios), con el contraste corregido hacia el color legible más cercano;
//   · `fuenteDelCatalogo`: la fuente de la página → la misma del catálogo de temas si está (son todas de
//     Google Fonts), o la más parecida.
// Lo que baja la página y sube las imágenes vive en estilo-server.ts; dónde va cada imagen y cada fondo
// en las secciones replicadas, en replicar-reglas.ts (`aplicarEstilo`).
//
// ⚠️ LA FUENTE ES DEL CATÁLOGO, NUNCA LA QUE DICE LA PÁGINA TAL CUAL: la familia termina en el link de
//    Google Fonts de una página PÚBLICA (`urlFuentes`), y la API css2 contesta 400 a la hoja ENTERA si
//    se le pide una familia o un peso que no existe — todas las fuentes de la página caerían a la de
//    respaldo sin un error. Por eso el catálogo creció (temas.ts, `FUENTES`, con los pesos medidos
//    contra la API) y lo que no está se mapea a la más parecida.
// ⚠️ NO ES UN PARSER DE CSS COMPLETO: un recorrido de bloques que respeta el anidado (@media) para saber
//    qué es del modo oscuro, y reglas de UNA clase, un id o una etiqueta. Lo que no entiende lo saltea:
//    sin estilo leído, la réplica nace como hasta hoy (el tema de fábrica), nunca con algo inventado.
// =============================================================================

import { FUENTES, contraste, mezclar, pesoDisponible, sanearTemaPropio } from './temas';
import type { TemaPropio } from './api-tipos';
// Las animaciones de la página (tanda 8): viajan con el estilo, con los MISMOS índices de parte (replicar-animaciones.ts).
import {
  agruparSenales, appearDeFramer, sanearAnimaciones, scrollEnHtml, senalDeEtiqueta,
  type AnimacionesOriginal, type SenalCruda,
} from './replicar-animaciones';

// ─────────────────────────────────────────────────────────────────────────────
// El contrato
// ─────────────────────────────────────────────────────────────────────────────

/** Un título de la página y el color de fondo que tiene detrás (el de su sección). */
/**
 * Una parte de la página. `tarjetas` (12/11/2026): la grilla de elementos repetidos que tiene (≥3 hermanos con la misma clase y
 * con texto: los testimonios de una masterclass, los pasos numerados), y si cada uno lleva foto. `fotos`: cuántas <img> de verdad
 * tiene, contando las que vienen en base64 (no se copian, pero dicen cómo está acomodada). Las dos, para el acomodo de la réplica.
 */
export type SeccionOriginal = {
  titulo: string; fondo: string | null; tarjetas?: { cantidad: number; conFoto: boolean }; fotos?: number; video?: boolean;
  /** De qué lado del texto va su primera foto o video (13/11/2026): antes del título en el HTML → izquierda; después → derecha. */
  lado?: 'izquierda' | 'derecha';
};

/**
 * Una imagen de la página. `seccion`: el índice (en `secciones`) del título de la parte donde está.
 * `fondo`: era la imagen de FONDO de esa parte (un `background-image`), no una <img>.
 */
export type ImagenOriginal = { url: string; seccion: number; fondo: boolean; ancho: number; alto: number };

/** Lo que se sabe del estilo de la página. Los colores son #rrggbb; lo que no se pudo leer, null. */
export type EstiloOriginal = {
  v: 1;
  /** El fondo de la página. */
  fondo: string | null;
  /** El texto del cuerpo. */
  texto: string | null;
  titulo: string | null;
  /** Un título pintado con degradado (background-clip: text), ya como `linear-gradient(<n>deg, #hex p%, …)`. */
  tituloDegradado: string | null;
  /** El color de marca que resalta (una palabra del título en otro color, el primary de la página). */
  acento: string | null;
  enlace: string | null;
  boton: string | null;
  botonDegradado: string | null;
  botonTexto: string | null;
  /** El radio y el alto del botón principal, en px (para la redondez: un botón píldora es «xl»). */
  radioBoton: number | null;
  altoBoton: number | null;
  /** Las familias como las nombra la página (la del catálogo la elige `fuenteDelCatalogo`). */
  fuenteTitulo: string | null;
  fuenteCuerpo: string | null;
  pesoTitulo: number | null;
  pesoCuerpo: number | null;
  secciones: SeccionOriginal[];
  imagenes: ImagenOriginal[];
  /**
   * Tanda 8 (Martín, 14/10/2026: «poder replicarlas al copiar una web»): las animaciones de entrada de la página ya
   * en el catálogo, por parte (el índice de `secciones`), y si tenía efectos atados al scroll. Sin el campo: no se
   * vio ninguna. Lo arman el lector (lector-script.ts) y `estiloDeHtml`; lo sanea `sanearAnimaciones`.
   */
  animaciones?: AnimacionesOriginal;
  /**
   * El ancho de la columna de contenido en px (13/11/2026): el `max-width` del contenedor más cercano de cada título, la
   * mediana. La de Clara es 760: una columna angosta y centrada; la réplica ocupaba todo el ancho. Sin el campo: no se vio.
   */
  anchoContenido?: number;
  /** En cuántas partes distintas aparece el botón principal (2 o más; sin el campo: una o ninguna). */
  botonEnPartes?: number;
  /**
   * La parte del titular que resalta en otro color o con degradado (13/11/2026: el «10K AL MES» de Clara). Sin el campo: el
   * titular va de un color. La réplica marca su frase clave con el acento (`conTituloResaltado`, replicar-estructura.ts).
   */
  tituloResalta?: { color: string; degradado?: string; peso?: number };
  /** El tamaño en px del titular (el h1 que se lee) y el de los títulos (el h2 general), en escritorio (13/11/2026). */
  tamTitular?: number;
  tamTitulos?: number;
  /** El de los subtítulos (la mediana de los h3: los títulos de tarjeta). */
  tamSubtitulos?: number;
};

export const TOPES_ESTILO = {
  secciones: 60,
  imagenes: 24,
  titulo: 160,
  url: 2_000,
  familia: 80,
  /** El CSS que se mira entre las hojas y los <style> de la página. */
  css: 3_000_000,
  /** Hojas de estilo que baja el server (las de la página, no las de terceros). */
  hojas: 3,
  /** Etiquetas que recorre `estiloDeHtml` (una página enorme no cuelga la réplica). */
  etiquetas: 60_000,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Colores
// ─────────────────────────────────────────────────────────────────────────────

/** Por debajo de esta opacidad un color no es un fondo ni un texto (es un velo, o nada). */
const ALFA_MINIMA = 0.5;

const NOMBRADOS: Readonly<Record<string, string>> = {
  white: '#ffffff', black: '#000000', red: '#ff0000', blue: '#0000ff', green: '#008000', gray: '#808080',
  grey: '#808080', silver: '#c0c0c0', navy: '#000080', orange: '#ffa500', yellow: '#ffff00', purple: '#800080',
  teal: '#008080', maroon: '#800000', olive: '#808000', lime: '#00ff00', aqua: '#00ffff', fuchsia: '#ff00ff',
  whitesmoke: '#f5f5f5', gold: '#ffd700', crimson: '#dc143c', tomato: '#ff6347', indigo: '#4b0082',
};

const byte = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
const hex2 = (n: number) => byte(n).toString(16).padStart(2, '0');
const aHex = (r: number, g: number, b: number) => '#' + hex2(r) + hex2(g) + hex2(b);

/** Un número de CSS: «12», «-3.5», «50%» (de `escala`) o «none» (0). null si no es un número. */
function numero(s: string | undefined, escala = 1): number | null {
  if (s === undefined) return null;
  const t = s.trim().toLowerCase();
  if (t === 'none') return 0;
  const m = /^(-?\d*\.?\d+(?:e-?\d+)?)(%|deg|turn|rad)?$/.exec(t);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  if (m[2] === '%') return (n / 100) * escala;
  if (m[2] === 'turn') return n * 360;
  if (m[2] === 'rad') return (n * 180) / Math.PI;
  return n;
}

/** Los argumentos de rgb()/hsl()/oklch(): con comas o con espacios, y la opacidad tras «/» o 4.ª. */
function argumentos(s: string): { v: string[]; a: string | null } {
  const [antes, alfa] = s.split('/');
  const v = antes.split(/[\s,]+/).filter(Boolean);
  let a: string | null = alfa !== undefined ? alfa.trim() : null;
  if (a === null && v.length === 4) a = v.pop() ?? null;
  return { v, a };
}

function hslAHex(h: number, s: number, l: number): string {
  const hh = (((h % 360) + 360) % 360) / 360;
  const f = (n: number) => {
    const k = (n + hh * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return aHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

/** OKLab → sRGB (la conversión de la especificación CSS Color 4). Tailwind 4 escribe sus colores así. */
function oklabAHex(L: number, a: number, b: number): string {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const g = lin.map((x) => {
    const c = Math.max(0, Math.min(1, x));
    return (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055) * 255;
  });
  return aHex(g[0], g[1], g[2]);
}

/**
 * Un color de CSS → #rrggbb, o null (transparente, más transparente que `ALFA_MINIMA`, o algo que no es
 * un color). Entiende #rgb(a)/#rrggbb(aa), rgb()/rgba(), hsl()/hsla(), oklch()/oklab() (lo que devuelve
 * Chrome en el estilo computado de una página con Tailwind 4) y los nombres comunes. Con `tupla`, también
 * los valores pelados de una VARIABLE: «222.2 47.4% 11.2%» (el HSL de shadcn: `hsl(var(--primary))`) y
 * «59 130 246» (el RGB de los temas de Tailwind 3).
 */
export function colorCss(v: unknown, op: { tupla?: boolean } = {}): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase().replace(/\s*!important$/, '');
  if (!s || s.length > 160) return null;
  if (NOMBRADOS[s]) return NOMBRADOS[s];
  let m = /^#([0-9a-f]{3,8})$/.exec(s);
  if (m) {
    const h = m[1];
    if (h.length === 3 || h.length === 4) {
      if (h.length === 4 && parseInt(h[3] + h[3], 16) / 255 < ALFA_MINIMA) return null;
      return '#' + h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    if (h.length === 6) return '#' + h;
    if (h.length === 8) return parseInt(h.slice(6), 16) / 255 < ALFA_MINIMA ? null : '#' + h.slice(0, 6);
    return null;
  }
  m = /^(rgba?|hsla?|oklch|oklab)\(\s*([^()]*)\)$/.exec(s);
  if (m) {
    const { v: a, a: alfa } = argumentos(m[2]);
    if (a.length !== 3) return null;
    if (alfa !== null) {
      const op1 = numero(alfa, 1);
      if (op1 === null || op1 < ALFA_MINIMA) return null;
    }
    if (m[1].startsWith('rgb')) {
      const c = a.map((x) => numero(x, 255));
      return c.every((x) => x !== null) ? aHex(c[0]!, c[1]!, c[2]!) : null;
    }
    if (m[1].startsWith('hsl')) {
      const h = numero(a[0]);
      const sat = numero(a[1].endsWith('%') ? a[1] : a[1] + '%', 1);
      const lum = numero(a[2].endsWith('%') ? a[2] : a[2] + '%', 1);
      return h === null || sat === null || lum === null ? null : hslAHex(h, sat, lum);
    }
    const L = numero(a[0], 1);
    if (L === null) return null;
    if (m[1] === 'oklch') {
      const C = numero(a[1], 0.4);
      const H = numero(a[2]);
      if (C === null || H === null) return null;
      const r = (H * Math.PI) / 180;
      return oklabAHex(L, C * Math.cos(r), C * Math.sin(r));
    }
    const A = numero(a[1], 0.4);
    const B = numero(a[2], 0.4);
    return A === null || B === null ? null : oklabAHex(L, A, B);
  }
  if (op.tupla) {
    m = /^(-?[\d.]+)(?:deg)?\s+([\d.]+)%\s+([\d.]+)%(?:\s*\/\s*([\d.]+%?))?$/.exec(s);
    if (m) {
      if (m[4] !== undefined && (numero(m[4], 1) ?? 1) < ALFA_MINIMA) return null;
      return hslAHex(Number(m[1]), Number(m[2]) / 100, Number(m[3]) / 100);
    }
    m = /^(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})$/.exec(s);
    if (m) return aHex(Number(m[1]), Number(m[2]), Number(m[3]));
  }
  return null;
}

/** El contenido del primer `nombre(…)` de un valor, con los paréntesis balanceados. */
function funcion(v: string, nombre: string): string | null {
  const i = v.toLowerCase().indexOf(nombre + '(');
  if (i < 0) return null;
  let prof = 0;
  for (let j = i + nombre.length; j < v.length; j++) {
    if (v[j] === '(') prof++;
    else if (v[j] === ')') { prof--; if (prof === 0) return v.slice(i + nombre.length + 1, j); }
  }
  return null;
}

/** Separa por las comas de PRIMER nivel (las de adentro de un rgb() no cortan). */
function porComas(s: string): string[] {
  const out: string[] = [];
  let prof = 0, ini = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') prof++;
    else if (s[i] === ')') prof--;
    else if (s[i] === ',' && prof === 0) { out.push(s.slice(ini, i).trim()); ini = i + 1; }
  }
  out.push(s.slice(ini).trim());
  return out.filter(Boolean);
}

const DIRECCIONES: Readonly<Record<string, number>> = {
  'to top': 0, 'to right': 90, 'to bottom': 180, 'to left': 270,
  'to top right': 45, 'to right top': 45, 'to bottom right': 135, 'to right bottom': 135,
  'to bottom left': 225, 'to left bottom': 225, 'to top left': 315, 'to left top': 315,
};

/**
 * El primer `linear-gradient(…)` de un valor → `linear-gradient(<n>deg, #hex p%, …)`, la ÚNICA forma de
 * degradado que acepta un tema propio (`sanearCambiosTema`, temas.ts), con 2 a 6 colores. null si no hay
 * uno que se pueda escribir así (un radial, uno con colores transparentes).
 */
export function degradadoCss(v: unknown): string | null {
  if (typeof v !== 'string' || v.length > 2_000) return null;
  const dentro = funcion(v, 'linear-gradient');
  if (dentro === null) return null;
  const partes = porComas(dentro);
  let angulo = 180;
  const primera = (partes[0] ?? '').toLowerCase().replace(/\s+in\s+[a-z-]+(\s+(?:shorter|longer|increasing|decreasing)\s+hue)?/, '').trim();
  const ang = /^(-?[\d.]+(?:deg|turn|rad))$/.exec(primera);
  if (ang) { angulo = numero(ang[1]) ?? 180; partes.shift(); }
  else if (DIRECCIONES[primera] !== undefined) { angulo = DIRECCIONES[primera]; partes.shift(); }
  else if (/^in\s/.test((partes[0] ?? '').toLowerCase()) || primera === '') partes.shift();
  const paradas: string[] = [];
  for (const p of partes) {
    // «color [pos [pos]]»: las posiciones en % quedan; en px no se pueden escribir en un tema y se sueltan.
    const m = /^(.*?)((?:\s+-?[\d.]+(?:%|px|r?em)?){0,2})$/.exec(p.trim());
    if (!m) continue;
    const c = colorCss(m[1]);
    if (!c) {
      // Una «pista» de color pelada (sólo una posición) se saltea; un color transparente invalida el degradado.
      if (/^-?[\d.]+(?:%|px|r?em)?$/.test(p.trim())) continue;
      return null;
    }
    const enPct = /(-?[\d.]+)%/.exec(m[2] ?? '');
    const pct = enPct ? Math.max(0, Math.min(100, Math.round(Number(enPct[1])))) : null;
    paradas.push(c + (pct !== null ? ' ' + pct + '%' : ''));
  }
  if (paradas.length < 2) return null;
  const elegidas = paradas.length > 6 ? [...paradas.slice(0, 5), paradas[paradas.length - 1]] : paradas;
  return 'linear-gradient(' + ((((Math.round(angulo) % 360) + 360) % 360)) + 'deg, ' + elegidas.join(', ') + ')';
}

/** El color de un FONDO de CSS: un color, o el primero de un degradado (un fondo con degradado se lee sobre sus colores). */
export function colorDeFondoCss(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const directo = colorCss(v);
  if (directo) return directo;
  const d = degradadoCss(v);
  if (d) return /#[0-9a-f]{6}/.exec(d)?.[0] ?? null;
  // El atajo `background: #fff url(x) no-repeat`: el primer token que sea un color.
  for (const t of v.replace(/url\([^)]*\)/gi, ' ').split(/\s+(?![^(]*\))/)) {
    const c = colorCss(t);
    if (c) return c;
  }
  return null;
}

function rgb(h: string): [number, number, number] {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
/** Luminancia relativa (WCAG), para decidir claro u oscuro. */
function luz(h: string): number {
  const [r, g, b] = rgb(h).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** ¿Un color con color (no un gris, ni casi blanco, ni casi negro)? Es lo que se puede usar de acento. */
export function esColorido(h: string | null): h is string {
  if (!h) return false;
  const c = rgb(h);
  const croma = (Math.max(...c) - Math.min(...c)) / 255;
  const l = luz(h);
  return croma >= 0.22 && l > 0.02 && l < 0.9;
}
/** ¿Dos colores se ven distintos? (para no pintar una sección del mismo color que el tema). */
export function distintos(a: string, b: string): boolean {
  const x = rgb(a), y = rgb(b);
  return Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]) > 30;
}

/**
 * El color, corrido lo justo hacia negro o hacia blanco para llegar a `min` de contraste sobre `fondo`:
 * hacia el lado que necesite MENOS corrimiento (el legible más cercano al original). Si ya llega, igual.
 */
export function colorLegible(c: string, fondo: string, min: number): string {
  if (contraste(c, fondo) >= min) return c;
  let mejor: string | null = null;
  let menor = Infinity;
  for (const hacia of ['#000000', '#ffffff']) {
    for (let k = 1; k <= 50; k++) {
      const p = k / 50;
      const m = mezclar(c, hacia, p);
      if (contraste(m, fondo) >= min) { if (p < menor) { menor = p; mejor = m; } break; }
    }
  }
  return mejor ?? (contraste('#000000', fondo) >= contraste('#ffffff', fondo) ? '#000000' : '#ffffff');
}

// ─────────────────────────────────────────────────────────────────────────────
// Fuentes
// ─────────────────────────────────────────────────────────────────────────────

const GENERICAS = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace',
  'ui-rounded', '-apple-system', 'blinkmacsystemfont', 'emoji', 'math', 'fangsong', 'inherit', 'initial', 'unset',
]);
const EMOJIS = /emoji|symbol/i;

function limpiarFamilia(f: string): string {
  let s = f.trim().replace(/^['"]+|['"]+$/g, '').trim();
  // next/font: «__Inter_d65c78», «__Inter_Fallback_d65c78».
  const nf = /^__(.+?)(?:_Fallback)?_[0-9a-f]{5,8}$/i.exec(s);
  if (nf) s = nf[1].replace(/_/g, ' ');
  s = s.replace(/\s+Fallback$/i, '');
  return s.replace(/[^\p{L}\p{N} \-_.]/gu, '').replace(/\s+/g, ' ').trim().slice(0, TOPES_ESTILO.familia);
}

/**
 * La familia de un `font-family` (la PRIMERA que no es genérica ni de emojis: es la que eligió la página;
 * las otras son respaldo). Si sólo hay genéricas, la primera («serif»), que también dice algo.
 */
export function familiaCss(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  const lista = v.slice(0, 600).split(',').map(limpiarFamilia).filter((f) => f && !EMOJIS.test(f));
  return lista.find((f) => !GENERICAS.has(f.toLowerCase())) ?? lista[0] ?? null;
}

function pesoCss(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.max(100, Math.min(900, Math.round(v / 100) * 100));
  if (typeof v !== 'string') return null;
  const t = v.trim().toLowerCase();
  if (t === 'bold' || t === 'bolder') return 700;
  if (t === 'normal') return 400;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? Math.max(100, Math.min(900, Math.round(n / 100) * 100)) : null;
}

const clave = (s: string) => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
const POR_CLAVE = new Map(Object.keys(FUENTES).map((f) => [clave(f), f]));

/**
 * Las que no están en Google Fonts (del sistema o comerciales, las de siempre en las landings) → la del
 * catálogo que más se le parece. Arial y Helvetica → Arimo (tiene las mismas medidas que Arial).
 */
export const PARECIDAS: Readonly<Record<string, string>> = {
  helvetica: 'Arimo', helveticaneue: 'Arimo', arial: 'Arimo', liberationsans: 'Arimo', nimbussans: 'Arimo',
  segoeui: 'Inter', systemui: 'Inter', applesystem: 'Inter', blinkmacsystemfont: 'Inter', sanfrancisco: 'Inter',
  sfpro: 'Inter', sfprodisplay: 'Inter', sfprotext: 'Inter', uisansserif: 'Inter', sansserif: 'Inter', graphik: 'Inter',
  sfprorounded: 'Nunito', uirounded: 'Nunito',
  verdana: 'Open Sans', tahoma: 'Open Sans', calibri: 'Open Sans', trebuchetms: 'Fira Sans', gillsans: 'Lato',
  georgia: 'Source Serif 4', timesnewroman: 'Source Serif 4', times: 'Source Serif 4', serif: 'Source Serif 4',
  uiserif: 'Source Serif 4', cambria: 'Source Serif 4', tiempos: 'Source Serif 4', tiempostext: 'Source Serif 4',
  lyon: 'Source Serif 4', lyontext: 'Source Serif 4', sourceserifpro: 'Source Serif 4',
  garamond: 'EB Garamond', adobegaramond: 'EB Garamond', baskerville: 'Libre Baskerville', didot: 'Bodoni Moda',
  bodoni: 'Bodoni Moda', palatino: 'Lora', palatinolinotype: 'Lora', bookantiqua: 'Lora',
  canela: 'Playfair Display', tiemposheadline: 'Playfair Display', recoleta: 'Fraunces',
  couriernew: 'IBM Plex Mono', courier: 'IBM Plex Mono', monospace: 'JetBrains Mono', uimonospace: 'JetBrains Mono',
  menlo: 'JetBrains Mono', consolas: 'JetBrains Mono', monaco: 'JetBrains Mono', sfmono: 'JetBrains Mono',
  impact: 'Anton', druk: 'Anton', arialblack: 'Archivo Black', cursive: 'Caveat', fantasy: 'Bebas Neue',
  gilroy: 'Plus Jakarta Sans', euclidcircular: 'Plus Jakarta Sans', euclidcirculara: 'Plus Jakarta Sans',
  euclidcircularb: 'Plus Jakarta Sans', circular: 'DM Sans', circularstd: 'DM Sans', circularxx: 'DM Sans',
  proximanova: 'Montserrat', gotham: 'Montserrat', gothampro: 'Montserrat', avenir: 'Nunito Sans',
  avenirnext: 'Nunito Sans', avenirnextltpro: 'Nunito Sans', futura: 'Jost', futurapt: 'Jost',
  brandongrotesque: 'Josefin Sans', sofiapro: 'Outfit', satoshi: 'Outfit', generalsans: 'Outfit', calsans: 'Outfit',
  aeonik: 'Inter Tight', neuehaasgrotesk: 'Inter Tight', neuehaasdisplay: 'Inter Tight', neuemontreal: 'Inter Tight',
  haasgrotesk: 'Inter Tight', clashdisplay: 'Syne', clashgrotesk: 'Space Grotesk', cabinetgrotesk: 'Bricolage Grotesque',
  sourcesanspro: 'Source Sans 3', productsans: 'Poppins', googlesans: 'Poppins',
};

/**
 * La fuente del catálogo de temas para una familia de la página: la MISMA si está (todo el catálogo es
 * de Google Fonts), y si no, la más parecida (`PARECIDAS`, una del catálogo cuyo nombre empiece igual
 * —«Roboto Flex» → Roboto—, o por lo que dice el nombre: serif, mono, condensada…). `exacta`: era la misma.
 */
export function fuenteDelCatalogo(familia: string | null | undefined): { familia: string; exacta: boolean } | null {
  if (!familia) return null;
  const k = clave(familia);
  if (!k) return null;
  const misma = POR_CLAVE.get(k);
  if (misma) return { familia: misma, exacta: true };
  const par = PARECIDAS[k] ?? PARECIDAS[k.replace(/(std|pro|display|text|variable|vf|web)$/, '')];
  if (par && FUENTES[par]) return { familia: par, exacta: false };
  let prefijo: string | null = null;
  for (const [c, f] of POR_CLAVE) if (c.length >= 4 && k.startsWith(c) && (!prefijo || c.length > clave(prefijo).length)) prefijo = f;
  if (prefijo) return { familia: prefijo, exacta: false };
  const n = familia.toLowerCase();
  const por = (f: string) => ({ familia: f, exacta: false });
  if (/mono|code|courier/.test(n)) return por('JetBrains Mono');
  if (/script|hand|brush|marker|signature/.test(n)) return por('Caveat');
  if (/slab/.test(n)) return por('Roboto Slab');
  if (/serif|garamond|times|baskerville|bodoni|didot|caslon|playfair|antiqua/.test(n) && !/sans/.test(n)) return por('Source Serif 4');
  if (/condensed|narrow|compressed|bebas|anton|oswald|impact/.test(n)) return por('Oswald');
  if (/grotesk|grotesque/.test(n)) return por('Space Grotesk');
  if (/round/.test(n)) return por('Nunito');
  return por('Inter');
}

// ─────────────────────────────────────────────────────────────────────────────
// El saneo (lo que manda el lector del navegador, o lo que vuelve a pasar por el server)
// ─────────────────────────────────────────────────────────────────────────────

const linea = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** Una imagen que se puede bajar: http(s), sin espacios, y que no sea un SVG (nunca se copia uno). */
export function urlImagenValida(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s || s.length > TOPES_ESTILO.url || /\s/.test(s)) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (/\.svgz?$/i.test(u.pathname)) return null;
    // Los píxeles de seguimiento de la página no son imágenes suyas.
    if (/facebook\.com\/tr|google-analytics\.com|doubleclick\.net|bat\.bing\.com|px\.ads\.linkedin\.com/i.test(u.href)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

const medida = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(10_000, Math.round(v)) : null;

/** ¿Trae algo que se pueda usar? (un estilo vacío es lo mismo que no tener estilo). */
export function estiloUtil(e: EstiloOriginal | null | undefined): e is EstiloOriginal {
  if (!e) return false;
  return !!(e.fondo || e.texto || e.titulo || e.acento || e.boton || e.botonDegradado || e.fuenteCuerpo || e.fuenteTitulo || e.imagenes.length);
}

/**
 * Un estilo que llegó de afuera (la página leída en el navegador, o el pedido de Replicar), con forma y
 * topes. Acepta los valores CRUDOS del estilo computado («rgb(37, 99, 235)», «"Inter", sans-serif») y los
 * ya normalizados (#hex, «Inter»): pasar dos veces da lo mismo. null si no trae nada usable.
 */
export function sanearEstilo(raw: unknown): EstiloOriginal | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const secciones: SeccionOriginal[] = (Array.isArray(r.secciones) ? r.secciones : []).slice(0, TOPES_ESTILO.secciones).map((x) => {
    const o = x && typeof x === 'object' ? (x as Record<string, unknown>) : {};
    const t = o.tarjetas && typeof o.tarjetas === 'object' ? (o.tarjetas as Record<string, unknown>) : null;
    const cantidad = t && typeof t.cantidad === 'number' && Number.isInteger(t.cantidad) && t.cantidad >= 3 && t.cantidad <= 24 ? t.cantidad : 0;
    const fotos = typeof o.fotos === 'number' && Number.isInteger(o.fotos) && o.fotos > 0 ? Math.min(o.fotos, 99) : 0;
    return {
      titulo: linea(o.titulo, TOPES_ESTILO.titulo), fondo: colorDeFondoCss(o.fondo),
      ...(cantidad ? { tarjetas: { cantidad, conFoto: t?.conFoto === true } } : {}),
      ...(fotos ? { fotos } : {}),
      ...(o.video === true ? { video: true } : {}),
      ...(o.lado === 'izquierda' || o.lado === 'derecha' ? { lado: o.lado } : {}),
    };
  });
  const imagenes: ImagenOriginal[] = [];
  const vistas = new Set<string>();
  for (const x of (Array.isArray(r.imagenes) ? r.imagenes : []).slice(0, TOPES_ESTILO.imagenes * 3)) {
    if (imagenes.length >= TOPES_ESTILO.imagenes) break;
    const o = x && typeof x === 'object' ? (x as Record<string, unknown>) : {};
    const url = urlImagenValida(o.url);
    if (!url || vistas.has(url)) continue;
    const s = typeof o.seccion === 'number' && Number.isInteger(o.seccion) && secciones.length ? o.seccion : -1;
    // Una imagen de una parte que quedó fuera del tope de secciones no tiene a dónde ir.
    if (s >= secciones.length) continue;
    vistas.add(url);
    imagenes.push({ url, seccion: Math.max(-1, s), fondo: o.fondo === true, ancho: medida(o.ancho) ?? 0, alto: medida(o.alto) ?? 0 });
  }
  const animaciones = sanearAnimaciones(r.animaciones, secciones.length);
  const e: EstiloOriginal = {
    v: 1,
    fondo: colorDeFondoCss(r.fondo),
    texto: colorCss(r.texto),
    titulo: colorCss(r.titulo),
    tituloDegradado: degradadoCss(r.tituloDegradado),
    acento: colorDeFondoCss(r.acento),
    enlace: colorCss(r.enlace),
    boton: colorCss(r.boton),
    botonDegradado: degradadoCss(r.botonDegradado),
    botonTexto: colorCss(r.botonTexto),
    radioBoton: medida(r.radioBoton),
    altoBoton: medida(r.altoBoton),
    fuenteTitulo: familiaCss(r.fuenteTitulo),
    fuenteCuerpo: familiaCss(r.fuenteCuerpo),
    pesoTitulo: pesoCss(r.pesoTitulo),
    pesoCuerpo: pesoCss(r.pesoCuerpo),
    secciones,
    imagenes,
    ...(animaciones ? { animaciones } : {}),
    ...(() => {
      const t = r.tituloResalta && typeof r.tituloResalta === 'object' ? (r.tituloResalta as Record<string, unknown>) : null;
      const color = t ? colorCss(t.color) : null;
      if (!t || !color) return {};
      const deg = degradadoCss(t.degradado);
      const peso = pesoCss(t.peso);
      return { tituloResalta: { color, ...(deg ? { degradado: deg } : {}), ...(peso ? { peso } : {}) } };
    })(),
    ...(typeof r.tamTitular === 'number' && r.tamTitular >= 12 && r.tamTitular <= 200 ? { tamTitular: Math.round(r.tamTitular) } : {}),
    ...(typeof r.tamSubtitulos === 'number' && r.tamSubtitulos >= 10 && r.tamSubtitulos <= 200 ? { tamSubtitulos: Math.round(r.tamSubtitulos) } : {}),
    ...(typeof r.tamTitulos === 'number' && r.tamTitulos >= 12 && r.tamTitulos <= 200 ? { tamTitulos: Math.round(r.tamTitulos) } : {}),
    ...(typeof r.botonEnPartes === 'number' && Number.isInteger(r.botonEnPartes) && r.botonEnPartes >= 2 ? { botonEnPartes: Math.min(r.botonEnPartes, 99) } : {}),
    ...(typeof r.anchoContenido === 'number' && Number.isFinite(r.anchoContenido) && r.anchoContenido >= 320 && r.anchoContenido <= 2000 ? { anchoContenido: Math.round(r.anchoContenido) } : {}),
  };
  return estiloUtil(e) ? e : null;
}

/**
 * El estilo que trae la `lectura` del navegador en el pedido de Replicar (`lectura.estilo`, opcional: lo
 * suma `aLecturaDelServer`, lector.ts). La lectura llega sin forma confiable: se vuelve a sanear acá.
 */
export function estiloDeLectura(lectura: unknown): EstiloOriginal | null {
  if (!lectura || typeof lectura !== 'object' || Array.isArray(lectura)) return null;
  return sanearEstilo((lectura as Record<string, unknown>).estilo);
}

// ─────────────────────────────────────────────────────────────────────────────
// El HTML que baja el server: el CSS
// ─────────────────────────────────────────────────────────────────────────────

type Decl = Record<string, string>;
type Regla = { selector: string; decl: Decl; oscuro: boolean };

const RE_OSCURO = /prefers-color-scheme\s*:\s*dark|(?:^|[\s,>+~(])\.dark(?:-mode|-theme)?\b|\.theme-dark\b|\[data-(?:theme|mode|bs-theme)\s*=\s*["']?dark/i;

function declaraciones(cuerpo: string): Decl {
  const d: Decl = {};
  for (const parte of porPuntoYComa(cuerpo)) {
    const i = parte.indexOf(':');
    if (i <= 0) continue;
    const prop = parte.slice(0, i).trim().toLowerCase();
    const valor = parte.slice(i + 1).replace(/!important\s*$/i, '').trim();
    if (prop && valor) d[prop] = valor;
  }
  return d;
}

function porPuntoYComa(s: string): string[] {
  const out: string[] = [];
  let prof = 0, ini = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') prof++;
    else if (s[i] === ')') prof = Math.max(0, prof - 1);
    else if (s[i] === ';' && prof === 0) { out.push(s.slice(ini, i)); ini = i + 1; }
  }
  out.push(s.slice(ini));
  return out;
}

/** Las reglas de una hoja, con su selector y si son del modo OSCURO (por el selector o por un @media). */
export function reglasCss(css: string): Regla[] {
  const s = String(css ?? '').slice(0, TOPES_ESTILO.css).replace(/\/\*[\s\S]*?\*\//g, '');
  const out: Regla[] = [];
  const pila: { prelude: string; hijos: boolean }[] = [];
  let buf = '';
  for (let i = 0; i < s.length && out.length < 40_000; i++) {
    const c = s[i];
    if (c === '{') {
      if (pila.length) pila[pila.length - 1].hijos = true;
      pila.push({ prelude: buf.trim(), hijos: false });
      buf = '';
    } else if (c === '}') {
      const b = pila.pop();
      if (b && !b.hijos && !b.prelude.startsWith('@')) {
        const oscuro = RE_OSCURO.test(b.prelude) || pila.some((p) => RE_OSCURO.test(p.prelude));
        out.push({ selector: b.prelude, decl: declaraciones(buf), oscuro });
      }
      buf = '';
    } else if (c === ';' && !pila.length) {
      buf = ''; // un @import o @charset suelto
    } else {
      buf += c;
    }
  }
  return out;
}

/** Reemplaza los var(--x, respaldo) con las variables (primero las de la misma regla), hasta 6 niveles. */
function resolverVar(valor: string, vars: ReadonlyMap<string, string>, locales: Decl = {}, prof = 0): string {
  if (prof > 6 || !valor.includes('var(')) return valor;
  let out = '';
  let i = 0;
  while (i < valor.length) {
    const j = valor.indexOf('var(', i);
    if (j < 0) { out += valor.slice(i); break; }
    out += valor.slice(i, j);
    let p = 0, k = j + 3;
    for (; k < valor.length; k++) {
      if (valor[k] === '(') p++;
      else if (valor[k] === ')') { p--; if (p === 0) break; }
    }
    const dentro = valor.slice(j + 4, k);
    const coma = porComas(dentro);
    const nombre = (coma[0] ?? '').trim().replace(/^--/, '');
    const local = locales['--' + nombre];
    const v = local !== undefined ? local : vars.get(nombre);
    const reemplazo = v !== undefined ? v : coma.slice(1).join(', ');
    out += resolverVar(reemplazo, vars, local !== undefined ? {} : locales, prof + 1);
    i = k + 1;
  }
  return out;
}

const RE_RAIZ = /(^|,)\s*(?::root|html|body|:host|\*)\s*(?=,|$)/i;

/** Las variables CSS que valen en la página clara: primero las de :root/html/body, después las demás. */
function variablesDe(reglas: Regla[]): Map<string, string> {
  const vars = new Map<string, string>();
  const poner = (r: Regla) => {
    for (const [k, v] of Object.entries(r.decl)) if (k.startsWith('--') && !vars.has(k.slice(2))) vars.set(k.slice(2), v);
  };
  for (const r of reglas) if (!r.oscuro && RE_RAIZ.test(r.selector)) poner(r);
  for (const r of reglas) if (!r.oscuro && !RE_RAIZ.test(r.selector)) poner(r);
  return vars;
}

/**
 * Un selector COMPUESTO de un solo elemento: etiqueta y/o clases y/o id pegados («section.tint», «.sec.tint», «div#hero.x»).
 * 12/11/2026, la masterclass de clase.highticketclarity.com: sus secciones crema eran `section.tint{background:var(--panel-soft)}`
 * y el índice sólo juntaba `.clase`, `#id` y `etiqueta` sueltos: el fondo se perdía y todas salían del blanco del body.
 */
export type Compuesto = { tag: string | null; clases: string[]; id: string | null; decl: Decl };

/** Las reglas de UNA clase, UN id o UNA etiqueta (sin estados: un :hover no es el estilo de la página), y las compuestas. */
/** `enTitulo`: las reglas de lo de ADENTRO de un título («h1 em», «h1 .x», «h1 em.x»; 13/11/2026, el span que resalta). */
type Indices = { clases: Map<string, Decl>; ids: Map<string, Decl>; etiquetas: Map<string, Decl>; compuestos: Compuesto[]; enTitulo: Map<string, Decl>; h2En: Map<string, Decl>; h3En: Map<string, Decl> };

/** «section.tint» → { tag: 'section', clases: ['tint'] }; null si no es un compuesto de un elemento (hay espacio, `>`, `:`, `[`…). */
export function compuestoDe(sel: string): Omit<Compuesto, 'decl'> | null {
  const m = /^([a-zA-Z][\w-]*)?((?:[.#](?:\\.|[\w-])+){1,6})$/.exec(sel.trim());
  if (!m) return null;
  const partes = [...m[2].matchAll(/([.#])((?:\\.|[\w-])+)/g)].map((x) => [x[1], x[2].replace(/\\(.)/g, '$1')] as const);
  const ids = partes.filter(([t]) => t === '#').map(([, v]) => v);
  if (ids.length > 1) return null;
  const clases = partes.filter(([t]) => t === '.').map(([, v]) => v);
  // Los simples van a su mapa de siempre (`.x`, `#x`): esto es sólo lo que tiene más de una pieza.
  if ((m[1] ? 1 : 0) + clases.length + ids.length < 2) return null;
  return { tag: m[1]?.toLowerCase() ?? null, clases, id: ids[0] ?? null };
}

/** ¿El compuesto le corresponde a un elemento con esa etiqueta, esas clases y ese id? */
export function aplicaCompuesto(c: Omit<Compuesto, 'decl'>, tag: string, clases: ReadonlySet<string>, id: string | null): boolean {
  if (c.tag && c.tag !== tag) return false;
  if (c.id && c.id !== id) return false;
  return c.clases.every((k) => clases.has(k));
}

function indicesDe(reglas: Regla[]): Indices {
  const ix: Indices = { clases: new Map(), ids: new Map(), etiquetas: new Map(), compuestos: [], enTitulo: new Map(), h2En: new Map(), h3En: new Map() };
  const sumar = (m: Map<string, Decl>, k: string, d: Decl) => m.set(k, { ...(m.get(k) ?? {}), ...d });
  for (const r of reglas) {
    if (r.oscuro) continue;
    for (const sel of porComas(r.selector)) {
      const s = sel.trim();
      let m = /^\.((?:\\.|[\w-])+)$/.exec(s);
      if (m) { sumar(ix.clases, m[1].replace(/\\(.)/g, '$1'), r.decl); continue; }
      m = /^#([\w-]+)$/.exec(s);
      if (m) { sumar(ix.ids, m[1], r.decl); continue; }
      m = /^(h1|h2)\s+(?:>\s*)?([a-z]+)?(?:\.([\w-]+))?$/i.exec(s);
      if (m && (m[2] || m[3])) { sumar(ix.enTitulo, `${m[1].toLowerCase()} ${(m[2] ?? '').toLowerCase()}${m[3] ? '.' + m[3] : ''}`, r.decl); continue; }
      // El h2 de un contenedor («.sec-h h2», «.quien > h2»): Clara no tiene un h2 suelto, todos van así (13/11/2026).
      m = /^\.([\w-]+)\s+(?:>\s*)?(h2|h3)$/i.exec(s);
      if (m) { sumar(m[2].toLowerCase() === 'h2' ? ix.h2En : ix.h3En, m[1], r.decl); continue; }
      m = /^(html|body|h1|h2|h3|a|button|p)$/i.exec(s);
      if (m) { sumar(ix.etiquetas, m[1].toLowerCase(), r.decl); continue; }
      const c = ix.compuestos.length < 2_000 ? compuestoDe(s) : null;
      if (c) ix.compuestos.push({ ...c, decl: r.decl });
    }
  }
  return ix;
}

// ─────────────────────────────────────────────────────────────────────────────
// El HTML que baja el server: las variables con nombre de rol
// ─────────────────────────────────────────────────────────────────────────────

/** Los nombres de variable que dicen qué es cada color, en orden de preferencia (shadcn, Elementor, Bootstrap, WordPress…). */
const ROLES_VARIABLE = {
  fondo: ['background', 'bg', 'color-background', 'background-color', 'body-bg', 'bs-body-bg', 'wp--preset--color--background', 'wp--preset--color--base', 'color-bg', 'page-bg'],
  texto: ['foreground', 'color-text', 'text', 'text-color', 'body-color', 'bs-body-color', 'e-global-color-text', 'wp--preset--color--foreground', 'wp--preset--color--contrast', 'color-foreground'],
  boton: ['primary', 'color-primary', 'brand', 'color-brand', 'brand-color', 'primary-color', 'bs-primary', 'e-global-color-primary', 'wp--preset--color--primary', 'main-color'],
  botonTexto: ['primary-foreground', 'color-primary-foreground', 'on-primary'],
  acento: ['e-global-color-accent', 'wp--preset--color--accent', 'color-accent', 'accent-color', 'brand', 'primary'],
  enlace: ['link', 'link-color', 'color-link', 'bs-link-color'],
} as const;

/** ¿La página usa el esquema de shadcn? (ahí `--accent` es un gris de fondo, no el color de marca). */
const esShadcn = (vars: ReadonlyMap<string, string>) => vars.has('primary-foreground') && vars.has('background');

function colorDeVariables(vars: ReadonlyMap<string, string>, nombres: readonly string[]): string | null {
  for (const n of nombres) {
    const v = vars.get(n);
    if (v === undefined) continue;
    const c = colorCss(resolverVar(v, vars), { tupla: true }) ?? colorCss(resolverVar(`hsl(${v})`, vars));
    if (c) return c;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// El HTML que baja el server: las etiquetas
// ─────────────────────────────────────────────────────────────────────────────

const ENT: Readonly<Record<string, string>> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decodificar = (s: string): string => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => { const n = parseInt(h, 16); return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''; })
  .replace(/&#(\d+);/g, (_, d) => { const n = Number(d); return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''; })
  .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);

const RE_ATRIBUTO = new Map<string, RegExp>();
function atributo(attrs: string, nombre: string): string | null {
  let re = RE_ATRIBUTO.get(nombre);
  if (!re) {
    re = new RegExp('(?:^|\\s)' + nombre + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i');
    RE_ATRIBUTO.set(nombre, re);
  }
  const m = re.exec(attrs);
  return m ? decodificar(m[1] ?? m[2] ?? m[3] ?? '') : null;
}

function absoluta(u: string | null, base: string): string | null {
  if (!u) return null;
  try { return new URL(u.trim(), base).toString(); } catch { return null; }
}

/** La mejor candidata de un srcset: la de mayor ancho («800w») o densidad («2x»). */
function mejorDeSrcset(srcset: string): string | null {
  let mejor: string | null = null;
  let max = -1;
  for (const c of srcset.split(/,\s+(?=\S)/)) {
    const [u, d] = c.trim().split(/\s+/);
    if (!u) continue;
    const n = d ? Number(d.replace(/[wx]$/i, '')) * (/x$/i.test(d) ? 1000 : 1) : 1;
    if (Number.isFinite(n) && n > max) { max = n; mejor = u; }
  }
  return mejor;
}

const VACIOS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const CONTENEDORES = new Set(['body', 'section', 'header', 'footer', 'main', 'div', 'article', 'aside', 'figure']);
/** Lo que no es una imagen DE la página: logos, íconos, avatares por defecto, banderas, espaciadores. */
const RE_NO_IMAGEN = /logo|icon|favicon|sprite|spacer|blank\.gif|pixel\.gif|flag|badge|emoji|placeholder|loader|spinner/i;

/**
 * Un tamaño de letra en px, el de escritorio: de un `clamp(min, vw, max)` el máximo; px, rem y em (a 16). null con % o vw
 * sueltos (dependen de algo que acá no se sabe) o fuera de 12–200 px.
 */
export function tamanoPx(v: string | undefined): number | null {
  if (!v) return null;
  const t = v.trim().toLowerCase();
  const c = /^clamp\(([^,]+),([^,]+),([^)]+)\)$/.exec(t);
  const m = /^(-?[\d.]+)(px|rem|em)$/.exec((c ? c[3] : t).trim());
  if (!m) return null;
  const n = Number(m[1]) * (m[2] === 'px' ? 1 : 16);
  return Number.isFinite(n) && n >= 12 && n <= 200 ? Math.round(n) : null;
}

function medidaPx(v: string | undefined): number | null {
  if (!v) return null;
  const t = v.trim().toLowerCase();
  if (/%$/.test(t)) return Number(t.slice(0, -1)) >= 25 ? 9_999 : null;
  const m = /^(-?[\d.]+)(px|rem|em)?$/.exec(t.split(/\s+/)[0]);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? Math.round(m[2] === 'rem' || m[2] === 'em' ? n * 16 : n) : null;
}

/** Las familias de los links de Google Fonts de la página (`css2?family=A:wght@…&family=B`, o el `css?family=A|B` viejo). */
export function familiasGoogle(html: string, css = ''): string[] {
  const out: string[] = [];
  const re = /fonts\.googleapis\.com\/css2?\?([^"'()\s>]+)/gi;
  for (const fuente of [html, css]) {
    for (const m of String(fuente ?? '').slice(0, TOPES_ESTILO.css).matchAll(re)) {
      const q = decodificar(m[1]);
      for (const par of q.split('&')) {
        const [k, v] = par.split('=');
        if (k !== 'family' || !v) continue;
        let familias = '';
        try { familias = decodeURIComponent(v.replace(/\+/g, ' ')); } catch { continue; }
        for (const f of familias.split('|')) {
          const nombre = limpiarFamilia(f.split(':')[0]);
          if (nombre && !out.includes(nombre)) out.push(nombre);
        }
      }
    }
  }
  return out.slice(0, 8);
}

/**
 * Las hojas de estilo de la página que vale la pena bajar (las suyas: no las de íconos, carruseles ni
 * Google Fonts), absolutas, primero las de su mismo sitio, hasta `TOPES_ESTILO.hojas`.
 */
export function hojasDeHtml(html: string, base: string): string[] {
  const propias: string[] = [];
  const otras: string[] = [];
  let host = '';
  try { host = new URL(base).hostname.replace(/^www\./, ''); } catch { /* sin host */ }
  for (const m of String(html ?? '').slice(0, 2_000_000).matchAll(/<link\b([^>]*)>/gi)) {
    const attrs = m[1];
    const rel = (atributo(attrs, 'rel') ?? '').toLowerCase();
    const como = (atributo(attrs, 'as') ?? '').toLowerCase();
    if (!/\bstylesheet\b/.test(rel) && !(rel.includes('preload') && como === 'style')) continue;
    const u = absoluta(atributo(attrs, 'href'), base);
    if (!u || !/^https?:/i.test(u)) continue;
    if (/fonts\.googleapis|font-?awesome|fontawesome|bootstrap-icons|material-icons|swiper|slick|animate(\.min)?\.css|aos(\.min)?\.css|\/wp-includes\/|dashicons/i.test(u)) continue;
    let mismo = false;
    try { mismo = new URL(u).hostname.replace(/^www\./, '') === host; } catch { /* otra */ }
    const lista = mismo ? propias : otras;
    if (!lista.includes(u)) lista.push(u);
  }
  return [...propias, ...otras].slice(0, TOPES_ESTILO.hojas);
}

/** `pendientes`: lo que espera saber de qué parte es (las imágenes de fondo y, desde la tanda 8, las señales de animación). */
type Marco = {
  tag: string; fondo: string | null; pendientes: { seccion: number }[];
  /** Para las tarjetas (12/11/2026): «article.caso» (sin clase, '' y no cuenta), la parte donde abrió, si tiene texto o foto adentro, y sus hijos por firma. */
  firma?: string; seccion?: number; texto?: boolean; foto?: boolean; hijos?: Map<string, { n: number; conFoto: number }>;
  /** El primer título que cerró adentro, y las fotos que todavía no saben de qué parte son (ver `cerrarMarco`). */
  primerTitulo?: number; fotosPend?: { seccion: number; antes: number; video?: boolean }[];
  /** Sus atributos y su `max-width` en px, leído la primera vez que un título lo pide (`anchoContenido`). */
  attrs?: string; maxAncho?: number | null;
};
type CandidatoBoton = { fondo: string; degradado: string | null; texto: string | null; radio: number | null; veces: number; partes: Set<number> };

/**
 * El estilo de una página a partir de su HTML (y el CSS de las hojas que ya bajó el server, en `hojas`).
 * PURA: no baja nada. Lo que no encuentra queda en null.
 */
export function estiloDeHtml(html: string, base: string, hojas: readonly string[] = []): EstiloOriginal {
  const doc = String(html ?? '').slice(0, 5_000_000);
  const estilos = [...doc.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)].map((m) => m[1]);
  let css = '';
  for (const t of [...estilos, ...hojas]) {
    if (css.length >= TOPES_ESTILO.css) break;
    css += '\n' + String(t ?? '').slice(0, TOPES_ESTILO.css - css.length);
  }
  const reglas = reglasCss(css);
  const vars = variablesDe(reglas);
  const ix = indicesDe(reglas);

  /** El estilo de un elemento: su etiqueta < sus clases < su id < su `style`, con las variables resueltas. */
  const estiloEl = (tag: string, attrs: string): Decl => {
    const d: Decl = { ...(ix.etiquetas.get(tag) ?? {}) };
    const clases = (atributo(attrs, 'class') ?? '').split(/\s+/).filter(Boolean).slice(0, 40);
    for (const c of clases) {
      const x = ix.clases.get(c);
      if (x) Object.assign(d, x);
    }
    const id = atributo(attrs, 'id');
    // Los compuestos («section.tint», «.sec.tint») ganan a la clase suelta y pierden con el id, como en el navegador.
    const set = ix.compuestos.length ? new Set(clases) : null;
    if (set) for (const c of ix.compuestos) if (!c.id && aplicaCompuesto(c, tag, set, id)) Object.assign(d, c.decl);
    if (id && ix.ids.get(id)) Object.assign(d, ix.ids.get(id));
    if (set && id) for (const c of ix.compuestos) if (c.id && aplicaCompuesto(c, tag, set, id)) Object.assign(d, c.decl);
    const enLinea = atributo(attrs, 'style');
    if (enLinea) Object.assign(d, declaraciones(enLinea));
    const out: Decl = {};
    for (const [k, v] of Object.entries(d)) if (!k.startsWith('--')) out[k] = resolverVar(v, vars, d);
    return out;
  };
  /** El estilo de algo de ADENTRO de un título: el suyo más las reglas «h1 em», «h1 .x» y «h1 em.x» (con las variables resueltas). */
  const estiloEnTitulo = (tituloTag: string, tag: string, attrs: string): Decl => {
    const d: Decl = { ...estiloEl(tag, attrs) };
    const clases = (atributo(attrs, 'class') ?? '').split(/\s+/).filter(Boolean).slice(0, 10);
    const claves = [`${tituloTag} ${tag}`, ...clases.map((c) => `${tituloTag} .${c}`), ...clases.map((c) => `${tituloTag} ${tag}.${c}`)];
    const crudo: Decl = {};
    for (const k of claves) Object.assign(crudo, ix.enTitulo.get(k) ?? {});
    for (const [k, v] of Object.entries(crudo)) if (!k.startsWith('--')) d[k] = resolverVar(v, vars, crudo);
    return d;
  };
  const fondoDe = (d: Decl): string | null =>
    colorDeFondoCss(d['background-color']) ?? colorDeFondoCss(d.background) ?? colorDeFondoCss(d['background-image']);
  const urlDeFondo = (d: Decl, attrs: string): string | null => {
    const m = /url\(\s*["']?([^"')]+)["']?\s*\)/i.exec(d['background-image'] ?? d.background ?? '');
    const lazy = atributo(attrs, 'data-bg') ?? atributo(attrs, 'data-background') ?? atributo(attrs, 'data-bg-src');
    return urlImagenValida(absoluta(m?.[1] ?? lazy, base));
  };

  // ── El cuerpo de la página ──
  const bodyAttrs = /<body\b([^>]*)>/i.exec(doc)?.[1] ?? '';
  const dHtml = estiloEl('html', /<html\b([^>]*)>/i.exec(doc)?.[1] ?? '');
  const dBody = estiloEl('body', bodyAttrs);
  const shadcn = esShadcn(vars);
  const e: EstiloOriginal = {
    v: 1,
    fondo: fondoDe(dBody) ?? fondoDe(dHtml) ?? colorDeVariables(vars, ROLES_VARIABLE.fondo),
    texto: colorCss(dBody.color) ?? colorCss(dHtml.color) ?? colorDeVariables(vars, ROLES_VARIABLE.texto),
    titulo: null, tituloDegradado: null,
    acento: colorDeVariables(vars, shadcn ? ['primary'] : ROLES_VARIABLE.acento),
    enlace: colorCss(estiloEl('a', '').color) ?? colorDeVariables(vars, ROLES_VARIABLE.enlace),
    boton: null, botonDegradado: null, botonTexto: null, radioBoton: null, altoBoton: null,
    fuenteTitulo: null,
    fuenteCuerpo: familiaCss(dBody['font-family']) ?? familiaCss(dHtml['font-family']),
    pesoTitulo: null,
    pesoCuerpo: pesoCss(dBody['font-weight']),
    secciones: [],
    imagenes: [],
  };
  const dP = estiloEl('p', '');
  const tamH2 = tamanoPx(estiloEl('h2', '')['font-size']);
  if (tamH2) e.tamTitulos = tamH2;
  if (!e.fuenteCuerpo) e.fuenteCuerpo = familiaCss(dP['font-family']);

  // ── El recorrido: títulos con su fondo, imágenes con su parte, los botones ──
  const cuerpo = doc
    .slice(Math.max(0, doc.search(/<body\b/i)))
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|template|svg|textarea|select)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ');
  const pila: Marco[] = [];
  const botones = new Map<string, CandidatoBoton>();
  const sinTitulo: ImagenOriginal[] = [];
  // Las animaciones (tanda 8): la señal de cada etiqueta, en la parte del primer título que cierra ADENTRO de ella (un
  // envoltorio con data-aos que trae su título es de esa parte), o en la última si no trae ninguno, como las imágenes de fondo.
  const framer = appearDeFramer(doc);
  const senales: { seccion: number; senal: SenalCruda }[] = [];
  let ultimo = -1;
  /** El título abierto; `partes`: el estilo de sus span/strong/em/mark/b (la palabra que resalta, ver `tituloResalta`). */
  let titulo: { tag: string; texto: string; attrs: string; partes?: Decl[] } | null = null;
  let vistoH1 = false;
  let tituloLeido = false;
  let n = 0;
  const RE = /<(\/?)([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  // Las TARJETAS y las FOTOS de cada parte (12/11/2026): ver `SeccionOriginal`. Se anotan en la parte donde ABRIÓ el contenedor
  // (los pasos de «Qué vas a ver» traen un h3 cada uno: al cerrar, la última parte leída ya es el último paso).
  const tarjetasPor = new Map<number, { cantidad: number; conFoto: boolean }>();
  /** Cada foto, con la parte que le toca: como una imagen de fondo, la del primer título que cierra adentro de su contenedor
   *  (la foto de «Quién es» va ANTES de su h2), o la última si no cierra ninguno. */
  const fotos: { seccion: number; antes: number; video?: boolean }[] = [];
  /** El `max-width` de la columna de cada título (ver `anchoContenido`). */
  const anchos: number[] = [];
  /** El tamaño de cada h2 (ver `tamTitulos`). */
  const tamsH2: number[] = [];
  const tamsH3: number[] = [];
  /** Al cerrar un contenedor: le pasa lo suyo al de arriba, y si tenía ≥3 hijos con la misma clase y con texto, son tarjetas. */
  const cerrarMarco = (marco: Marco, padre: Marco | undefined) => {
    // Las fotos: un contenedor con títulos adentro decide (antes de su primer título → ese título; si no, el último anterior a
    // la foto); uno sin títulos se las pasa al de arriba.
    for (const f of marco.fotosPend ?? []) {
      if (marco.primerTitulo !== undefined) f.seccion = f.antes < marco.primerTitulo ? marco.primerTitulo : f.antes;
      else if (padre) (padre.fotosPend ??= []).push(f);
      else f.seccion = f.antes;
    }
    marco.fotosPend = undefined;
    if (padre) {
      if (marco.texto) padre.texto = true;
      if (marco.foto) padre.foto = true;
      if (marco.firma && marco.texto) {
        const h = (padre.hijos ??= new Map());
        const x = h.get(marco.firma) ?? { n: 0, conFoto: 0 };
        x.n++;
        if (marco.foto) x.conFoto++;
        h.set(marco.firma, x);
      }
    }
    if (!marco.hijos || marco.seccion === undefined || marco.seccion < 0) return;
    let mejor: { cantidad: number; conFoto: boolean } | null = null;
    for (const x of marco.hijos.values()) {
      if (x.n >= 3 && x.n <= 24 && (!mejor || x.n > mejor.cantidad)) mejor = { cantidad: x.n, conFoto: x.conFoto * 2 >= x.n };
    }
    const ya = tarjetasPor.get(marco.seccion);
    if (mejor && (!ya || mejor.cantidad > ya.cantidad)) tarjetasPor.set(marco.seccion, mejor);
  };
  const sumarImagen = (img: ImagenOriginal) => {
    if (e.imagenes.length >= TOPES_ESTILO.imagenes * 2 || e.imagenes.some((x) => x.url === img.url)) return;
    e.imagenes.push(img);
    if (img.seccion === -1) sinTitulo.push(img);
  };
  while ((m = RE.exec(cuerpo)) && n++ < TOPES_ESTILO.etiquetas) {
    if (m[4] !== undefined) {
      if (titulo) titulo.texto += m[4];
      if (pila.length && /\S/.test(m[4])) pila[pila.length - 1].texto = true;
      continue;
    }
    const cierra = m[1] === '/';
    const tag = m[2].toLowerCase();
    const attrs = m[3] ?? '';
    if (cierra) {
      if (titulo && tag === titulo.tag) {
        const texto = decodificar(titulo.texto).replace(/\s+/g, ' ').trim().slice(0, TOPES_ESTILO.titulo);
        if (texto && e.secciones.length < TOPES_ESTILO.secciones) {
          const idx = e.secciones.length;
          let fondo: string | null = null;
          for (let k = pila.length - 1; k >= 0 && !fondo; k--) fondo = pila[k].fondo;
          e.secciones.push({ titulo: texto, fondo });
          for (const marco of pila) for (const img of marco.pendientes) if (img.seccion === -2) img.seccion = idx;
          for (const img of sinTitulo.splice(0)) img.seccion = idx;
          for (const marco of pila) if (marco.primerTitulo === undefined) marco.primerTitulo = idx;
          ultimo = idx;
          if (!tituloLeido && (tag === 'h1' || (tag === 'h2' && !vistoH1))) {
            tituloLeido = true;
            const d = estiloEl(tag, titulo.attrs);
            const relleno = d['-webkit-text-fill-color'] ?? '';
            const recorta = /text/.test(d['-webkit-background-clip'] ?? d['background-clip'] ?? '') || /transparent/.test(relleno) || /transparent/.test(d.color ?? '');
            e.tituloDegradado = recorta ? degradadoCss(d['background-image'] ?? d.background) : null;
            e.titulo = colorCss(d.color);
            e.fuenteTitulo = familiaCss(d['font-family']);
            e.pesoTitulo = pesoCss(d['font-weight']);
            const tamH1 = tamanoPx(d['font-size']);
            if (tamH1) e.tamTitular = tamH1;
            // La parte que resalta (13/11/2026: «10K AL MES» de Clara es un <span> con degradado dorado DENTRO del h1, y el
            // h1 es negro): con degradado recortado al texto, o en otro color que el título, es el acento y la réplica la marca.
            for (const s of titulo.partes ?? []) {
              const recortaS = /text/.test(s['-webkit-background-clip'] ?? s['background-clip'] ?? '') || /transparent/.test(s['-webkit-text-fill-color'] ?? '');
              const deg = recortaS ? degradadoCss(s['background-image'] ?? s.background) : null;
              const color = deg ? (/#[0-9a-f]{6}/i.exec(deg)?.[0] ?? null) : colorCss(s.color);
              if (!color || (!deg && e.titulo && !distintos(color, e.titulo))) continue;
              e.acento = color;
              e.tituloResalta = { color, ...(deg ? { degradado: deg } : {}), ...(pesoCss(s['font-weight']) ? { peso: pesoCss(s['font-weight'])! } : {}) };
              break;
            }
          }
        }
        titulo = null;
      }
      const k = pila.map((x) => x.tag).lastIndexOf(tag);
      if (k >= 0) {
        const cerrados = pila.splice(k);
        for (const marco of cerrados) for (const img of marco.pendientes) if (img.seccion === -2) img.seccion = ultimo;
        for (let i = cerrados.length - 1; i >= 0; i--) cerrarMarco(cerrados[i], i > 0 ? cerrados[i - 1] : pila[pila.length - 1]);
      }
      continue;
    }
    // Lo de adentro de un <nav> no es la página (un megamenú trae decenas de títulos): como el extractor.
    const enNav = pila.some((x) => x.tag === 'nav');
    const vacio = VACIOS.has(tag) || /\/\s*$/.test(attrs);
    // Adentro del título que se lee (el h1, o el primer h2 sin h1): el estilo de cada parte marcada, para la que resalta.
    if (titulo && !tituloLeido && /^(span|strong|em|mark|b|i)$/.test(tag) && (titulo.partes ??= []).length < 12) titulo.partes.push(estiloEnTitulo(titulo.tag, tag, attrs));
    const senal = enNav || senales.length >= 4_000 ? null : senalDeEtiqueta((k) => atributo(attrs, k), framer);
    const animPendiente = senal ? { seccion: vacio ? ultimo : -2, senal } : null;
    if (animPendiente) senales.push(animPendiente);
    if ((tag === 'h1' || tag === 'h2' || tag === 'h3') && !enNav) {
      if (tag === 'h1') vistoH1 = true;
      if ((tag === 'h2' && tamsH2.length < 60) || (tag === 'h3' && tamsH3.length < 60)) {
        // Su tamaño: el de su regla suelta, o el de la regla de su contenedor más cercano («.sec-h h2»).
        let decl: Decl = estiloEl(tag, attrs);
        for (let k = pila.length - 1; k >= 0; k--) {
          const de = (atributo(pila[k].attrs ?? '', 'class') ?? '').split(' ').filter(Boolean).map((c) => (tag === 'h2' ? ix.h2En : ix.h3En).get(c)).find(Boolean);
          if (de) { decl = { ...decl, ...Object.fromEntries(Object.entries(de).map(([kk, v]) => [kk, resolverVar(v, vars, de)])) }; break; }
        }
        const px = tamanoPx(decl['font-size']);
        if (px) (tag === 'h2' ? tamsH2 : tamsH3).push(px);
      }
      titulo = { tag, texto: '', attrs };
      // El ancho de su columna: el `max-width` del contenedor más cercano que lo tiene (entre 320 y 2000 px).
      if (anchos.length < 200) {
        for (let k = pila.length - 1; k >= 0; k--) {
          const c = pila[k];
          if (c.maxAncho === undefined) {
            const px = medidaPx(estiloEl(c.tag, c.attrs ?? '')['max-width']);
            c.maxAncho = px !== null && px >= 320 && px <= 2000 ? px : null;
          }
          if (c.maxAncho) { anchos.push(c.maxAncho); break; }
        }
      }
    }
    if ((tag === 'img' || tag === 'source') && enNav) continue;
    // Un VIDEO (el del hero de una masterclass): <video>, o el iframe de un reproductor. Sólo para el acomodo, como las fotos.
    if (!enNav && (tag === 'video' || (tag === 'iframe' && /youtube|youtu\.be|vimeo|panda|wistia|vturb|loom|vidalytics/i.test(atributo(attrs, 'src') ?? atributo(attrs, 'data-src') ?? '')))) {
      const v = { seccion: -2, antes: ultimo, video: true };
      fotos.push(v);
      if (pila.length) (pila[pila.length - 1].fotosPend ??= []).push(v);
      else v.seccion = ultimo;
    }
    if (tag === 'img' || tag === 'source') {
      const lazy = atributo(attrs, 'data-src') ?? atributo(attrs, 'data-lazy-src') ?? atributo(attrs, 'data-original');
      const set = atributo(attrs, 'data-srcset') ?? atributo(attrs, 'srcset');
      const crudo = (set ? mejorDeSrcset(set) : null) ?? lazy ?? atributo(attrs, 'src');
      const url = urlImagenValida(absoluta(crudo, base));
      const ancho = Number(atributo(attrs, 'width')) || 0;
      const alto = Number(atributo(attrs, 'height')) || 0;
      const chica = (ancho > 0 && ancho < 120) || (alto > 0 && alto < 80);
      const enBase64 = /^data:/i.test(crudo ?? '');
      const pista = `${enBase64 ? '' : crudo ?? ''} ${atributo(attrs, 'alt') ?? ''} ${atributo(attrs, 'class') ?? ''}`;
      if (url && !chica && !RE_NO_IMAGEN.test(pista) && !enBase64) {
        sumarImagen({ url, seccion: ultimo >= 0 ? ultimo : -1, fondo: false, ancho, alto });
      }
      // Para el ACOMODO cuenta también la que viene en base64 (no se copia, pero es una foto ahí). Un <source> no: es la misma.
      if (tag === 'img' && crudo && !chica && !RE_NO_IMAGEN.test(pista)) {
        const foto = { seccion: -2, antes: ultimo };
        fotos.push(foto);
        if (pila.length) { pila[pila.length - 1].foto = true; (pila[pila.length - 1].fotosPend ??= []).push(foto); }
        else foto.seccion = ultimo;
      }
      continue;
    }
    if (tag === 'a' || tag === 'button') {
      const d = estiloEl(tag, attrs);
      const fondo = colorCss(d['background-color']) ?? colorDeFondoCss(d.background);
      const degradado = degradadoCss(d['background-image'] ?? d.background);
      const clave1 = degradado ?? fondo;
      if (clave1 && (!e.fondo || !fondo || distintos(fondo, e.fondo))) {
        const c = botones.get(clave1) ?? { fondo: fondo ?? (/#[0-9a-f]{6}/.exec(degradado ?? '')?.[0] ?? '#000000'), degradado, texto: colorCss(d.color), radio: medidaPx(d['border-radius']), veces: 0, partes: new Set<number>() };
        c.veces++;
        c.partes.add(ultimo);
        botones.set(clave1, c);
      }
    }
    if (vacio) continue;
    const marco: Marco = { tag, fondo: null, pendientes: animPendiente ? [animPendiente] : [], attrs };
    // La firma para las tarjetas: la etiqueta y sus clases (un hermano sin clase, como un <li> de viñetas, no es una tarjeta).
    const clasesEl = enNav ? '' : (atributo(attrs, 'class') ?? '').split(/\s+/).filter(Boolean).sort().slice(0, 6).join('.');
    if (clasesEl) marco.firma = `${tag}.${clasesEl}`;
    marco.seccion = ultimo;
    if (CONTENEDORES.has(tag)) {
      const d = estiloEl(tag, attrs);
      marco.fondo = fondoDe(d);
      const bg = urlDeFondo(d, attrs);
      if (bg && !RE_NO_IMAGEN.test(bg)) {
        const img: ImagenOriginal = { url: bg, seccion: -2, fondo: true, ancho: 0, alto: 0 };
        sumarImagen(img);
        marco.pendientes.push(img);
      }
    }
    pila.push(marco);
  }
  // Lo que no cerró (HTML cortado o sin cierres) también suma sus tarjetas, de adentro hacia afuera.
  for (let i = pila.length - 1; i >= 0; i--) cerrarMarco(pila[i], pila[i - 1]);
  for (const [i, t] of tarjetasPor) if (e.secciones[i]) e.secciones[i].tarjetas = t;
  for (const f of fotos) {
    const i = f.seccion === -2 ? (f.antes >= 0 ? f.antes : 0) : Math.max(0, f.seccion);
    if (!e.secciones[i]) continue;
    // El lado de la primera: la que el contenedor le dio a un título POSTERIOR estaba antes del texto (la foto de «Quién es»).
    if (!e.secciones[i].lado) e.secciones[i].lado = f.seccion >= 0 && f.seccion > f.antes ? 'izquierda' : 'derecha';
    if (f.video) e.secciones[i].video = true;
    else e.secciones[i].fotos = Math.min((e.secciones[i].fotos ?? 0) + 1, 99);
  }
  if (tamsH3.length) {
    const orden = [...tamsH3].sort((a, b) => a - b);
    e.tamSubtitulos = orden[Math.floor(orden.length / 2)];
  }
  if (tamsH2.length) {
    const orden = [...tamsH2].sort((a, b) => a - b);
    e.tamTitulos = orden[Math.floor(orden.length / 2)];
  }
  if (anchos.length) {
    const orden = [...anchos].sort((a, b) => a - b);
    e.anchoContenido = orden[Math.floor(orden.length / 2)];
  }
  // Una imagen de fondo cuyo contenedor no cerró va con la última parte; una de antes de todo título, con la primera.
  for (const img of e.imagenes) {
    if (img.seccion === -2) img.seccion = ultimo;
    if (img.seccion < 0 && ultimo >= 0) img.seccion = 0;
  }
  // Las animaciones: lo mismo (una de antes de todo título va con la primera parte: lo hace el saneo), agrupadas por
  // parte, y el scroll mirado en el HTML entero (sus scripts y atributos) y en el CSS de las hojas que bajó el server.
  for (const x of senales) if (x.seccion === -2) x.seccion = ultimo;
  const animaciones = sanearAnimaciones({ senales: agruparSenales(senales), scroll: scrollEnHtml(doc, css) }, e.secciones.length);
  if (animaciones) e.animaciones = animaciones;

  // ── El botón principal: el color que más se repite entre los botones (el de una landing se repite), con color ──
  const lista = [...botones.values()].sort((a, b) => (b.veces + (esColorido(b.fondo) ? 2 : 0)) - (a.veces + (esColorido(a.fondo) ? 2 : 0)));
  const cta = lista[0];
  if (cta) {
    e.boton = cta.fondo;
    e.botonDegradado = cta.degradado;
    e.botonTexto = cta.texto;
    e.radioBoton = cta.radio;
    // En cuántas partes distintas está (13/11/2026): la de Clara pone su botón dorado después de CADA sección.
    if (cta.partes.size >= 2) e.botonEnPartes = Math.min(cta.partes.size, 99);
  }
  if (!e.boton) {
    e.boton = colorDeVariables(vars, ROLES_VARIABLE.boton);
    e.botonTexto = e.botonTexto ?? colorDeVariables(vars, ROLES_VARIABLE.botonTexto);
    const radio = vars.get('radius') ?? vars.get('border-radius') ?? vars.get('bs-border-radius');
    if (radio) e.radioBoton = medidaPx(resolverVar(radio, vars));
  }

  // ── Las fuentes de Google Fonts, si las reglas no dijeron cuál es cuál ──
  const google = familiasGoogle(doc, css);
  const seria = (f: string) => FUENTES[fuenteDelCatalogo(f)?.familia ?? '']?.tipo;
  if (!e.fuenteCuerpo || GENERICAS.has(e.fuenteCuerpo.toLowerCase())) e.fuenteCuerpo = google.find((f) => seria(f) === 'sans') ?? google[0] ?? e.fuenteCuerpo;
  if (!e.fuenteTitulo) e.fuenteTitulo = google.find((f) => f !== e.fuenteCuerpo && seria(f) !== 'sans') ?? e.fuenteCuerpo;

  // ── El theme-color y el og:image, como último recurso ──
  if (!e.acento) {
    const tc = /<meta\b[^>]*name\s*=\s*["']theme-color["'][^>]*>/i.exec(doc)?.[0];
    const c = tc ? colorCss(atributo(tc, 'content')) : null;
    if (esColorido(c)) e.acento = c;
  }
  if (!e.imagenes.length) {
    const og = /<meta\b[^>]*property\s*=\s*["']og:image["'][^>]*>/i.exec(doc)?.[0];
    const url = og ? urlImagenValida(absoluta(atributo(og, 'content'), base)) : null;
    if (url) e.imagenes.push({ url, seccion: e.secciones.length ? 0 : -1, fondo: false, ancho: 0, alto: 0 });
  }
  e.imagenes = e.imagenes.slice(0, TOPES_ESTILO.imagenes);
  return e;
}

// ─────────────────────────────────────────────────────────────────────────────
// El tema propio
// ─────────────────────────────────────────────────────────────────────────────

/** Los temas del catálogo sobre los que se arma el propio (lo que el estilo no dice queda como en ellos). */
export const BASE_TEMA_COPIA = { claro: 'commons', oscuro: 'onyx' } as const;

function hash6(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0').slice(0, 6);
}

/** El sitio de una URL para nombrar el tema («ejemplo.com»). */
export function sitioDe(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase().slice(0, 40); } catch { return 'la página'; }
}

/** El radio del botón → la redondez del tema. Un botón píldora (radio ≥ la mitad del alto) es «xl». */
function redondezBoton(radio: number | null, alto: number | null): 'sm' | 'md' | 'lg' | 'xl' | null {
  if (radio === null) return null;
  if (radio >= 24 || (alto && radio >= alto / 2 - 1)) return 'xl';
  if (radio >= 10) return 'lg';
  if (radio >= 4) return 'md';
  return 'sm';
}

/**
 * El estilo de la página → un TEMA PROPIO del workspace (base del catálogo + cambios), listo para
 * `guardarTema`. El contraste se corrige hacia el color legible más cercano: el texto ≥ 4.5 sobre el
 * fondo, el título y el texto del botón ≥ 3 (son grandes). La tarjeta va del color del fondo de la
 * página, sin borde ni sombra: las secciones se leen como en el original, una pegada a la otra. El id
 * sale del sitio y de los cambios: el mismo estilo da el mismo tema (no se duplica al replicar dos veces).
 * null si el estilo no trae ni un color ni una fuente.
 */
export function temaDeEstilo(e: EstiloOriginal | null | undefined, url: string): TemaPropio | null {
  if (!e) return null;
  const algo = e.fondo || e.texto || e.titulo || e.acento || e.boton || e.botonDegradado || e.fuenteCuerpo || e.fuenteTitulo;
  if (!algo) return null;
  const fondo = e.fondo ?? '#ffffff';
  const oscuro = luz(fondo) < 0.2;
  const texto = colorLegible(e.texto ?? (oscuro ? '#f2f2f2' : '#1f1f1f'), fondo, 4.5);
  const promedioDeg = (d: string) => {
    const cs = d.match(/#[0-9a-f]{6}/g) ?? [];
    return cs.length ? cs.reduce((acc, c) => mezclar(acc, c, 0.5)) : null;
  };
  // El degradado del título sólo si en promedio se lee (≥ 3); si no, el sólido.
  const deg = e.tituloDegradado && promedioDeg(e.tituloDegradado) && contraste(promedioDeg(e.tituloDegradado)!, fondo) >= 3 ? e.tituloDegradado : null;
  const tituloSolido = colorLegible(e.titulo ?? texto, fondo, 3);
  // El botón: el de la página, salvo que no se distinga del fondo (un botón «contorno» blanco sobre blanco).
  const botonCrudo = e.boton && contraste(e.boton, fondo) >= 1.25 ? e.boton : null;
  const acento = [e.acento, botonCrudo, e.enlace, e.titulo].find(esColorido) ?? botonCrudo ?? e.acento ?? (oscuro ? '#ffffff' : '#111111');
  const botonDeg = e.botonDegradado && botonCrudo !== null ? e.botonDegradado : null;
  const boton = botonCrudo ?? acento;
  const botonTexto = colorLegible(e.botonTexto ?? (contraste('#ffffff', boton) >= contraste('#111111', boton) ? '#ffffff' : '#111111'), boton, 3);
  const enlace = colorLegible(esColorido(e.enlace) ? e.enlace : acento, fondo, 4.5);
  const titulo = fuenteDelCatalogo(e.fuenteTitulo ?? e.fuenteCuerpo);
  const cuerpo = fuenteDelCatalogo(e.fuenteCuerpo ?? e.fuenteTitulo);
  const fuentes: Record<string, unknown> = {};
  if (titulo) fuentes.titulo = { familia: titulo.familia, peso: pesoDisponible(titulo.familia, e.pesoTitulo ?? 700) };
  if (cuerpo) fuentes.cuerpo = { familia: cuerpo.familia, peso: pesoDisponible(cuerpo.familia, e.pesoCuerpo ?? 400) };
  const paleta = [...new Set([acento, boton, mezclar(acento, '#ffffff', 0.45), mezclar(acento, '#000000', 0.35), tituloSolido, texto])];
  const redondez = redondezBoton(e.radioBoton, e.altoBoton);
  const cambios: Record<string, unknown> = {
    ...(Object.keys(fuentes).length ? { fuentes } : {}),
    fondo,
    tarjeta: { fondo, transparencia: 'normal', borde: null, sombra: false },
    colores: { texto, titulo: deg ?? tituloSolido, acento, enlace, boton: botonDeg ?? boton, botonTexto },
    ...(redondez ? { redondez: { boton: redondez } } : {}),
    // El tamaño de los títulos y el del titular, por separado (13/11/2026): el h2 del editor mide 1,9em (30,4 px) y el titular
    // 5em (80 px). Clara: 37 y 56 px → 1,21 y 0,7.
    ...(e.tamTitulos || e.tamTitular || e.tamSubtitulos ? { escala: {
      ...(e.tamTitulos ? { titulos: Math.round(Math.min(1.4, Math.max(0.8, e.tamTitulos / 30.4)) * 100) / 100 } : {}),
      ...(e.tamTitular ? { titular: Math.round(Math.min(1.4, Math.max(0.5, e.tamTitular / 80)) * 100) / 100 } : {}),
      // El h3 del editor mide 1,45em (23,2 px); Clara, 17 → 0,72.
      ...(e.tamSubtitulos ? { subtitulos: Math.round(Math.min(1.4, Math.max(0.5, e.tamSubtitulos / 23.2)) * 100) / 100 } : {}),
    } } : {}),
    paleta,
  };
  const sitio = sitioDe(url);
  const slug = sitio.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'pagina';
  const id = `copia-${slug}-${hash6(JSON.stringify(cambios))}`;
  return sanearTemaPropio({ id, nombre: `Estilo de ${sitio}`, base: oscuro ? BASE_TEMA_COPIA.oscuro : BASE_TEMA_COPIA.claro, cambios });
}
