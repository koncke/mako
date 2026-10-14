// =============================================================================
// editor-landing/temas — los TEMAS del editor de landings copiado de Gamma
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma». Un tema de Gamma
// decide fuentes, fondo de página, tarjeta (color, esmerilado, borde, sombra),
// colores de texto/títulos/acento/enlace/botón, redondez y escalas tipográficas;
// la hoja única del contenido (css.ts) sólo lee VARIABLES --gm-* y este módulo es
// el que las escribe. Diseño y contratos: docs/diseno-editor-landing.md (D3).
//
// PURO (sin server-only, sin React, sin DOM): lo importan el render público
// (render.ts), el editor, las miniaturas del Panel, el panel de temas y los tests.
//
// De dónde salen los valores (relevo del 11/10/2026, gamma-tokens.md):
//   · §4, los 18 temas MEDIDOS: la config cruda de cada tema leída de la caché
//     Apollo del visor público de Gamma (el JSON con el que Gamma dibuja). Van con
//     los colores del CONFIG, no los de la primera tarjeta (Gamma invierte la 1ª
//     tarjeta de varias plantillas: es un override por tarjeta, no del tema).
//   · §8, los temas «Standard» de la galería: Gamma no los muestra sin sesión, así
//     que salen de las capturas del centro de ayuda. Cada uno lleva el comentario
//     «aproximado de captura» y `aproximado: true`.
//   · Lo que en Gamma es una IMAGEN de fondo (Circuit, Periwinkle, Primer, Mint,
//     Canyon, Anvil, Malachite, Terrain) va como degradado CSS que la aproxima:
//     nada de imágenes externas en un tema (la imagen de fondo propia de una
//     landing vive en config.pagina.fondoImagen, no acá).
//   · Las fuentes son TODAS de Google Fonts. Las comerciales de Gamma (ES Build,
//     PP Mori) no entran: los temas 19 y 20 del relevo, que las usan, no se copian.
//
// Lo que NO se copia de Gamma, a propósito:
//   · el «corte» de la imagen de acento (accentCut diagonal/wiggle/round) y las
//     imágenes de acento propias de cada tema (accentBackgrounds): son imágenes de
//     su CDN;
//   · `contentStyles` (CSS libre por tema): una hoja libre por tema es una puerta
//     de inyección en una página pública;
//   · el texto tenue va al 72% y no al 50% de Gamma: al 50% un pie de foto no pasa
//     el contraste mínimo en la mitad de los temas.
// =============================================================================

import type { TemaPropio } from './api-tipos';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export const REDONDECES = ['sm', 'md', 'lg', 'xl'] as const;
export type Redondez = (typeof REDONDECES)[number];

/** Un color #rrggbb o un degradado CSS (linear/radial). Nunca una imagen. */
export type Relleno = string;

export type GrupoTema = 'claro' | 'oscuro';
export type EtiquetaTema = 'profesional' | 'colorido';
export type FuenteTema = { familia: string; peso: number };

export type Tema = {
  /** El nombre en minúsculas sin espacios ('nightsky'), o 'ws:<id>' si es un tema propio. */
  id: string;
  nombre: string;
  /** Los filtros «Oscuro / Claro» del panel de Gamma: lo decide el color de la TARJETA. */
  grupo: GrupoTema;
  /** Los filtros «Profesional / Colorido». */
  etiquetas: readonly EtiquetaTema[];
  /** true = los valores salen de mirar una captura, no de la config medida de Gamma. */
  aproximado: boolean;
  /** true = un tema PROPIO de MaKo (el de su landing, app/vsl): ni medido de Gamma ni de captura. */
  deMako?: true;
  fuentes: { titulo: FuenteTema; cuerpo: FuenteTema };
  /** El fondo de la PÁGINA, detrás de las secciones. */
  fondo: Relleno;
  tarjeta: {
    fondo: Relleno;
    /** 'esmerilado' = el fondo de la tarjeta al 75% + backdrop-filter (no es opacity: el texto queda opaco). */
    transparencia: 'normal' | 'esmerilado';
    /** Color del anillo de 0.0625em, o null sin borde. */
    borde: string | null;
    sombra: boolean;
  };
  colores: {
    texto: string;
    /** Sólido o degradado (Gamma pinta el degradado con background-clip:text). */
    titulo: Relleno;
    acento: string;
    enlace: string;
    boton: Relleno;
    botonTexto: string;
  };
  redondez: { tarjeta: Redondez; boton: Redondez };
  /** fontSize y headingFontSize de Gamma: multiplican el cuerpo y los títulos. */
  escala: { cuerpo: number; titulos: number };
  interlineado: { cuerpo: number; titulos: number };
  /** letter-spacing en em. */
  tracking: { cuerpo: number; titulos: number };
  /** 6 a 12 colores para diseños optimizados, formas y gráficos. */
  paleta: readonly string[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Fuentes: el catálogo de Google Fonts que un tema puede usar
// ─────────────────────────────────────────────────────────────────────────────
// Con los pesos que Google publica de cada familia. No es decorativo: la API css2
// contesta 400 a la hoja ENTERA si se le pide un peso que la familia no tiene, y
// con eso no carga ninguna fuente de la página — sin un error visible, todo en la
// de respaldo. Por eso urlFuentes sólo pide pesos de esta lista, y un tema propio
// sólo puede elegir familias que estén acá.

export type TipoFuente = 'sans' | 'serif' | 'mono' | 'display';
export type DefFuente = { pesos: readonly number[]; tipo: TipoFuente };

const P100_900 = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

export const FUENTES: Readonly<Record<string, DefFuente>> = {
  // ── Sans ──
  'Inter': { pesos: P100_900, tipo: 'sans' },
  'Inter Tight': { pesos: P100_900, tipo: 'sans' },
  'Roboto': { pesos: [100, 300, 400, 500, 700, 900], tipo: 'sans' },
  'Open Sans': { pesos: [300, 400, 500, 600, 700, 800], tipo: 'sans' },
  'Montserrat': { pesos: P100_900, tipo: 'sans' },
  'Poppins': { pesos: P100_900, tipo: 'sans' },
  'Lato': { pesos: [100, 300, 400, 700, 900], tipo: 'sans' },
  'Raleway': { pesos: P100_900, tipo: 'sans' },
  'Nunito': { pesos: [200, 300, 400, 500, 600, 700, 800, 900], tipo: 'sans' },
  'Work Sans': { pesos: P100_900, tipo: 'sans' },
  'Rubik': { pesos: [300, 400, 500, 600, 700, 800, 900], tipo: 'sans' },
  'DM Sans': { pesos: P100_900, tipo: 'sans' },
  'Manrope': { pesos: [200, 300, 400, 500, 600, 700, 800], tipo: 'sans' },
  'Plus Jakarta Sans': { pesos: [200, 300, 400, 500, 600, 700, 800], tipo: 'sans' },
  'Outfit': { pesos: P100_900, tipo: 'sans' },
  'Sora': { pesos: [100, 200, 300, 400, 500, 600, 700, 800], tipo: 'sans' },
  'Space Grotesk': { pesos: [300, 400, 500, 600, 700], tipo: 'sans' },
  'Archivo': { pesos: P100_900, tipo: 'sans' },
  'Public Sans': { pesos: P100_900, tipo: 'sans' },
  'IBM Plex Sans': { pesos: [100, 200, 300, 400, 500, 600, 700], tipo: 'sans' },
  'Instrument Sans': { pesos: [400, 500, 600, 700], tipo: 'sans' },
  'Schibsted Grotesk': { pesos: [400, 500, 600, 700, 800, 900], tipo: 'sans' },
  'Mona Sans': { pesos: [200, 300, 400, 500, 600, 700, 800, 900], tipo: 'sans' },
  'Funnel Display': { pesos: [300, 400, 500, 600, 700, 800], tipo: 'sans' },
  'Bricolage Grotesque': { pesos: [200, 300, 400, 500, 600, 700, 800], tipo: 'sans' },
  'Fira Sans': { pesos: P100_900, tipo: 'sans' },
  'Arimo': { pesos: [400, 500, 600, 700], tipo: 'sans' },
  'Nobile': { pesos: [400, 500, 700], tipo: 'sans' },
  'Martel Sans': { pesos: [200, 300, 400, 600, 700, 800, 900], tipo: 'sans' },
  'Noto Sans TC': { pesos: P100_900, tipo: 'sans' },
  'Source Sans 3': { pesos: [200, 300, 400, 500, 600, 700, 800, 900], tipo: 'sans' },
  // La de la landing de MaKo (app/vsl/Landing.tsx): para el tema «MaKo» (14/10/2026).
  'Geist': { pesos: P100_900, tipo: 'sans' },
  // ── Serif ──
  'Playfair Display': { pesos: [400, 500, 600, 700, 800, 900], tipo: 'serif' },
  'Lora': { pesos: [400, 500, 600, 700], tipo: 'serif' },
  'Libre Baskerville': { pesos: [400, 700], tipo: 'serif' },
  'Fraunces': { pesos: P100_900, tipo: 'serif' },
  'Bodoni Moda': { pesos: [400, 500, 600, 700, 800, 900], tipo: 'serif' },
  'Spectral': { pesos: [200, 300, 400, 500, 600, 700, 800], tipo: 'serif' },
  'Merriweather': { pesos: [300, 400, 700, 900], tipo: 'serif' },
  'Cormorant Garamond': { pesos: [300, 400, 500, 600, 700], tipo: 'serif' },
  'DM Serif Display': { pesos: [400], tipo: 'serif' },
  'Source Serif 4': { pesos: [200, 300, 400, 500, 600, 700, 800, 900], tipo: 'serif' },
  // ── Display ──
  'Anton': { pesos: [400], tipo: 'display' },
  'Bebas Neue': { pesos: [400], tipo: 'display' },
  'Oswald': { pesos: [200, 300, 400, 500, 600, 700], tipo: 'display' },
  // ── Mono ──
  'Fira Mono': { pesos: [400, 500, 700], tipo: 'mono' },
  'IBM Plex Mono': { pesos: [100, 200, 300, 400, 500, 600, 700], tipo: 'mono' },
  'JetBrains Mono': { pesos: [100, 200, 300, 400, 500, 600, 700, 800], tipo: 'mono' },
  'Space Mono': { pesos: [400, 700], tipo: 'mono' },
};

const RESPALDO_FUENTE: Record<TipoFuente, string> = {
  sans: "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  display: "Impact, 'Arial Narrow', system-ui, sans-serif",
};

/**
 * La pila de font-family. Comillas SIMPLES a propósito: el resultado va adentro de
 * un `style="…"` (estiloDeTema) y una comilla doble ahí cerraría el atributo.
 */
function pilaFuente(familia: string): string {
  const def = FUENTES[familia];
  return "'" + familia + "', " + RESPALDO_FUENTE[def ? def.tipo : 'sans'];
}

/** El peso disponible más cercano (a igual distancia, el más pesado). */
export function pesoDisponible(familia: string, peso: number): number {
  const pesos = FUENTES[familia]?.pesos ?? [400];
  let mejor = pesos[0];
  for (const p of pesos) if (Math.abs(p - peso) < Math.abs(mejor - peso) || (Math.abs(p - peso) === Math.abs(mejor - peso) && p > mejor)) mejor = p;
  return mejor;
}

// ─────────────────────────────────────────────────────────────────────────────
// Medidas por redondez y la tarjeta (gamma-tokens §1, medidas en --card/--box/
// --button-border-radius sobre los gammas públicos)
// ─────────────────────────────────────────────────────────────────────────────

export const RADIO_TARJETA: Readonly<Record<Redondez, string>> = { sm: '1px', md: '0.6em', lg: '1.2em', xl: '2em' };
/** Bloques, cajas de diseños optimizados, celdas, imágenes «redondeadas». */
export const RADIO_CAJA: Readonly<Record<Redondez, string>> = { sm: '1px', md: '0.35em', lg: '0.75em', xl: '1.25em' };
export const RADIO_BOTON: Readonly<Record<Redondez, string>> = { sm: '0.125em', md: '0.375em', lg: '0.75em', xl: '8em' };

/** cardShadow 'default' de Gamma, en em de la sección. */
const SOMBRA_TARJETA = '0 0.25em 0.375em -0.0625em rgba(0,0,0,0.1), 0 0.125em 0.25em -0.0625em rgba(0,0,0,0.06)';
/** cardTransparency 'frosted'. */
const FILTRO_ESMERILADO = 'blur(20px) saturate(170%)';
const ALFA_ESMERILADO = 0.75;
/** Una sombra «vacía» válida: las variables de sombra nunca valen `none`, porque se concatenan con coma. */
const SIN_SOMBRA = '0 0 #0000';

// ─────────────────────────────────────────────────────────────────────────────
// Color: lo mínimo para contraste, mezclas y legibilidad
// ─────────────────────────────────────────────────────────────────────────────

const HEX6 = /#[0-9a-fA-F]{6}(?![0-9a-fA-F])/g;

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function hex([r, g, b]: [number, number, number]): string {
  const p = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return '#' + p(r) + p(g) + p(b);
}
function luminancia(c: string): number {
  const [r, g, b] = rgb(c).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contraste WCAG entre dos #rrggbb (1 a 21). */
export function contraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Mezcla `a` hacia `b` en proporción `p` (0 = a, 1 = b). */
export function mezclar(a: string, b: string, p: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return hex([x[0] + (y[0] - x[0]) * p, x[1] + (y[1] - x[1]) * p, x[2] + (y[2] - x[2]) * p]);
}

function rgba(c: string, a: number): string {
  const [r, g, b] = rgb(c);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}

export function esDegradado(r: Relleno): boolean {
  return /gradient\(/.test(r);
}

/** Los #rrggbb que trae un relleno (los de 8 dígitos, con transparencia, no cuentan). */
export function coloresDeRelleno(r: Relleno): string[] {
  return (r.match(HEX6) ?? []).map((c) => c.toLowerCase());
}

/** Las capas de un `background` separadas por las comas de primer nivel. */
function capas(r: Relleno): string[] {
  const out: string[] = [];
  let prof = 0;
  let ini = 0;
  for (let i = 0; i < r.length; i++) {
    if (r[i] === '(') prof++;
    else if (r[i] === ')') prof--;
    else if (r[i] === ',' && prof === 0) {
      out.push(r.slice(ini, i).trim());
      ini = i + 1;
    }
  }
  out.push(r.slice(ini).trim());
  return out;
}

function promedio(colores: string[]): string {
  if (!colores.length) return '#808080';
  const s = colores.map(rgb).reduce((a, c) => [a[0] + c[0], a[1] + c[1], a[2] + c[2]], [0, 0, 0]);
  return hex([s[0] / colores.length, s[1] / colores.length, s[2] / colores.length]);
}

/**
 * El color que «representa» un relleno: él mismo si es sólido; si es un fondo de
 * varias capas que termina en un color sólido (los radiales de Circuit y Cirrus
 * sobre su color base), ese color; si no, el promedio de sus paradas.
 */
export function colorDeRelleno(r: Relleno): string {
  const t = r.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t.toLowerCase();
  const ultima = capas(t).pop() ?? '';
  if (/^#[0-9a-fA-F]{6}$/.test(ultima)) return ultima.toLowerCase();
  return promedio(coloresDeRelleno(t));
}

/** El relleno con cada #rrggbb llevado a `a` de opacidad (la tarjeta esmerilada). */
function rellenoConAlfa(r: Relleno, a: number): string {
  return r.replace(HEX6, (c) => rgba(c, a));
}

function contrasteMinimo(c: string, fondos: string[]): number {
  return Math.min(...fondos.map((f) => contraste(c, f)));
}

/**
 * El color, corrido hacia negro o blanco lo justo para llegar a `min` contra TODOS
 * los fondos. Es el «ajuste de legibilidad» de Gamma (sin `disableReadabilityAdjustment`,
 * Gamma redibuja el link de Cirrus #5678f0 como #1136bb y el de Espresso como #e7844b):
 * el acento de Pewter (#B0C0D0) sobre su tarjeta casi blanca no se lee como texto.
 */
function legible(c: string, fondos: string[], min = 4.5): string {
  if (contrasteMinimo(c, fondos) >= min) return c;
  const claro = luminancia(promedio(fondos)) > 0.3;
  const hacia = claro ? '#000000' : '#ffffff';
  for (let p = 0.05; p < 1; p += 0.05) {
    const m = mezclar(c, hacia, p);
    if (contrasteMinimo(m, fondos) >= min) return m;
  }
  return hacia;
}

/**
 * Blanco o casi negro para escribir ENCIMA de un color (una forma rellena, una
 * etiqueta, una sección de fondo acento). Blanco si llega a 4:1, aunque el negro dé
 * un poco más: sobre un azul medio los dos empatan (#4674e1: 4.34 contra 4.35) y
 * Gamma pinta blanco (--accent-contrast-color: #fff, medido en Eclipse).
 */
function tintaSobre(c: string): string {
  const blanco = contraste(c, '#ffffff');
  return blanco >= 4 || blanco >= contraste(c, '#111111') ? '#ffffff' : '#111111';
}

/**
 * Los fondos contra los que se lee el texto de una tarjeta: sus paradas, y si es
 * esmerilada, cada parada al 75% sobre cada color del fondo de la PÁGINA del tema
 * (lo que de verdad queda detrás). Si una landing le pone una imagen de fondo
 * propia (config.pagina.fondoImagen), la esmerilada puede caer sobre cualquier
 * cosa: eso lo decide quien elige la imagen, y el editor lo muestra en vivo.
 */
export function fondosDeLectura(t: Tema): string[] {
  const paradas = coloresDeRelleno(t.tarjeta.fondo);
  const base = paradas.length ? paradas : [colorDeRelleno(t.tarjeta.fondo)];
  if (t.tarjeta.transparencia !== 'esmerilado') return base;
  const detras = [...new Set([...coloresDeRelleno(t.fondo), colorDeRelleno(t.fondo)])];
  return base.flatMap((c) => detras.map((p) => mezclar(c, p, 1 - ALFA_ESMERILADO)));
}

// ─────────────────────────────────────────────────────────────────────────────
// El catálogo
// ─────────────────────────────────────────────────────────────────────────────

type Crudo = {
  nombre: string;
  grupo: GrupoTema;
  etiquetas: EtiquetaTema[];
  aproximado?: boolean;
  deMako?: true;
  fuenteTitulo: [string, number];
  fuenteCuerpo: [string, number];
  fondo: Relleno;
  tarjeta: Relleno;
  esmerilado?: boolean;
  borde?: string | null;
  sombra?: boolean;
  texto: string;
  titulo: Relleno;
  acento: string;
  enlace: string;
  boton: Relleno;
  botonTexto: string;
  redondez?: Redondez;
  redondezBoton?: Redondez;
  /** [fontSize, headingFontSize] */
  escala?: [number, number];
  /** [lineHeightBody, lineHeightHeading]; los defaults de Gamma son 1.6 y 1.25. */
  interlineado?: [number, number];
  /** [letterSpacingBody, letterSpacingHeading] en em. */
  tracking?: [number, number];
  paleta: string[];
};

export const idDeNombre = (nombre: string) => nombre.toLowerCase().replace(/\s+/g, '');

function definir(c: Crudo): Tema {
  return {
    id: idDeNombre(c.nombre),
    nombre: c.nombre,
    grupo: c.grupo,
    etiquetas: c.etiquetas,
    aproximado: c.aproximado ?? false,
    ...(c.deMako ? { deMako: true as const } : {}),
    fuentes: {
      titulo: { familia: c.fuenteTitulo[0], peso: c.fuenteTitulo[1] },
      cuerpo: { familia: c.fuenteCuerpo[0], peso: c.fuenteCuerpo[1] },
    },
    fondo: c.fondo,
    tarjeta: {
      fondo: c.tarjeta,
      transparencia: c.esmerilado ? 'esmerilado' : 'normal',
      borde: c.borde ?? null,
      sombra: c.sombra ?? true,
    },
    colores: { texto: c.texto, titulo: c.titulo, acento: c.acento, enlace: c.enlace, boton: c.boton, botonTexto: c.botonTexto },
    redondez: { tarjeta: c.redondez ?? 'md', boton: c.redondezBoton ?? 'md' },
    escala: { cuerpo: c.escala?.[0] ?? 1, titulos: c.escala?.[1] ?? 1 },
    interlineado: { cuerpo: c.interlineado?.[0] ?? 1.6, titulos: c.interlineado?.[1] ?? 1.25 },
    tracking: { cuerpo: c.tracking?.[0] ?? 0, titulos: c.tracking?.[1] ?? 0 },
    paleta: c.paleta,
  };
}

const CRUDOS: Crudo[] = [
  // ── Los 18 MEDIDOS (gamma-tokens §4; config cruda de la caché Apollo) ──────
  {
    nombre: 'Eclipse', grupo: 'oscuro', etiquetas: ['profesional'],
    fuenteTitulo: ['Schibsted Grotesk', 400], fuenteCuerpo: ['Schibsted Grotesk', 400],
    fondo: '#dce6f8',
    tarjeta: 'linear-gradient(315deg, #203876 0%, #0b1c48 24%, #070a14 71%)', borde: '#1f1f1f', sombra: true,
    texto: '#dce6f8', titulo: 'linear-gradient(135deg, #ffffff 0%, #dce6f8 50%, #8fadeb 100%)',
    acento: '#4674e1', enlace: '#8fadeb',
    boton: 'linear-gradient(45deg, #dce6f8 0%, #8fadeb 50%, #4674e1 100%)', botonTexto: '#000000',
    redondez: 'lg', redondezBoton: 'lg', escala: [1, 1.1], interlineado: [1.3, 1.2], tracking: [0, -0.02],
    paleta: ['#4674e1', '#8fadeb', '#203876', '#dce6f8', '#5a6171', '#2c5ac7'],
  },
  {
    nombre: 'Ultraviolet', grupo: 'oscuro', etiquetas: ['colorido'],
    fuenteTitulo: ['Instrument Sans', 500], fuenteCuerpo: ['Instrument Sans', 400],
    fondo: '#0f0f1a',
    tarjeta: 'linear-gradient(180deg, #2a1665 0%, #0f0f41 31%, #110824 100%)', esmerilado: true, borde: '#3c3056', sombra: false,
    texto: '#ccb9d7', titulo: 'linear-gradient(134deg, #503b7d 0%, #e5d3ff 21%, #8b7ab0 68%, #533989 98%)',
    // El acento del config es un degradado (#b380ff → #8c5af5); Gamma lo dibuja #a06dfa.
    acento: '#a06dfa', enlace: '#a06dfa',
    boton: 'linear-gradient(143deg, #b380ff 10%, #8c5af5 91%)', botonTexto: '#ffffff',
    interlineado: [1.4, 1], tracking: [-0.02, -0.03],
    paleta: ['#7550ce', '#522069', '#3b50b4', '#a06dfa', '#b380ff', '#8c5af5'],
  },
  {
    nombre: 'Lawn', grupo: 'claro', etiquetas: ['colorido'],
    fuenteTitulo: ['Manrope', 400], fuenteCuerpo: ['Manrope', 400],
    fondo: '#f0f0f0',
    // Sin cardColor en el config: la tarjeta es la blanca por defecto (la 1ª, verde, es un override).
    tarjeta: '#ffffff', sombra: false,
    texto: '#272525', titulo: '#000000', acento: '#6ccc6a', enlace: '#2e7d32',
    boton: '#6ccc6a', botonTexto: '#0b2e0c',
    redondez: 'xl', redondezBoton: 'xl', interlineado: [1.6, 1.2], tracking: [0, -0.02],
    paleta: ['#6ccc6a', '#2e7d32', '#a5d6a7', '#1b5e20', '#c8e6c9', '#43a047'],
  },
  {
    nombre: 'Syntax', grupo: 'oscuro', etiquetas: ['profesional'],
    fuenteTitulo: ['Fira Mono', 500], fuenteCuerpo: ['Fira Sans', 400],
    fondo: '#222f3f',
    tarjeta: '#0d0d0d', borde: '#31415a', sombra: false,
    // El acento del config es un degradado (#b4c6ca → #2b3b55 → #0f131e): se toma su color claro.
    texto: '#f3f3f3', titulo: '#ffffff', acento: '#b4c6ca', enlace: '#b4c6ca',
    boton: '#b4c6ca', botonTexto: '#0d0d0d',
    redondez: 'sm', redondezBoton: 'sm', interlineado: [1.4, 1], tracking: [-0.02, -0.05],
    paleta: ['#b4c6ca', '#425459', '#313b46', '#1e3849', '#1b272d', '#2b3b55'],
  },
  {
    nombre: 'Torch', grupo: 'oscuro', etiquetas: ['colorido'],
    fuenteTitulo: ['Spectral', 400], fuenteCuerpo: ['Lato', 400],
    fondo: '#777b87',
    tarjeta: '#111111', sombra: true,
    texto: '#fbfbfb', titulo: '#ffffff', acento: '#ff4400', enlace: '#ff4400',
    boton: '#ff4400', botonTexto: '#ffffff',
    escala: [1.05, 1.25], interlineado: [1.2, 1], tracking: [0, -0.03],
    paleta: ['#ff4400', '#ff7a45', '#ffb08f', '#c23400', '#7a2100', '#ffd9c9'],
  },
  {
    nombre: 'Circuit', grupo: 'oscuro', etiquetas: ['profesional'],
    fuenteTitulo: ['Inter', 300], fuenteCuerpo: ['Inter', 400],
    // El degradado «mono» medido sobre su color base (Gamma le suma una imagen propia: no se copia).
    fondo: 'radial-gradient(circle at 0% 0%, #006bff80 0, #006bff00 50%), radial-gradient(circle at 9.65% 39.48%, #66a6ff80 0, #66a6ff00 79.83%), radial-gradient(circle at 19.3% 28.95%, #cce1ff80 0, #cce1ff00 59.65%), #000000',
    tarjeta: '#030303', esmerilado: true, borde: '#333333', sombra: true,
    texto: '#c8c8c8', titulo: 'linear-gradient(270deg, #1860ed 0%, #ffffff 100%)',
    acento: '#1860ed', enlace: '#1860ed',
    boton: 'linear-gradient(0deg, #1860ed 0%, #030303 100%)', botonTexto: '#ffffff',
    redondezBoton: 'xl', escala: [0.8, 0.8], interlineado: [1.2, 1.25],
    paleta: ['#1860ed', '#66a6ff', '#cce1ff', '#006bff', '#0b3d91', '#9ec5ff'],
  },
  {
    nombre: 'Pewter', grupo: 'claro', etiquetas: ['profesional'],
    fuenteTitulo: ['DM Sans', 600], fuenteCuerpo: ['DM Sans', 400],
    fondo: '#e4e0e1',
    tarjeta: '#f7f7f7', borde: '#e5e0df', sombra: true,
    texto: '#161616', titulo: '#161616', acento: '#b0c0d0', enlace: '#b0c0d0',
    boton: '#b0c0d0', botonTexto: '#161616',
    tracking: [-0.02, -0.05], interlineado: [1.6, 1],
    paleta: ['#dcdfe4', '#cad4e3', '#b0c0d0', '#292a2e', '#8a9bb0', '#5c6b7d'],
  },
  {
    nombre: 'Sapphire', grupo: 'claro', etiquetas: ['profesional'],
    fuenteTitulo: ['Public Sans', 500], fuenteCuerpo: ['Public Sans', 300],
    fondo: '#fffffd',
    tarjeta: '#f5f7ff', borde: '#ebebeb', sombra: false,
    texto: '#181818', titulo: 'linear-gradient(45deg, #6a6fd8 0%, #3b3dbf 100%)',
    acento: '#3b3dbf', enlace: '#3b3dbf',
    boton: 'linear-gradient(45deg, #6a6fd8 0%, #3b3dbf 100%)', botonTexto: '#ffffff',
    escala: [1, 1.05], interlineado: [1.4, 1], tracking: [-0.02, -0.05],
    paleta: ['#3b3dbf', '#2f2fa7', '#6a6fd8', '#c9cad3', '#d7d4cf', '#f3f1ee'],
  },
  {
    nombre: 'Cirrus', grupo: 'claro', etiquetas: ['colorido'],
    fuenteTitulo: ['Mona Sans', 600], fuenteCuerpo: ['Mona Sans', 400],
    // El degradado «crescent» medido, sobre blanco.
    fondo: 'radial-gradient(circle at 0% 0%, #377cff80 0, #377cff00 50%), radial-gradient(circle at 48.43% 22.64%, #37ffec80 0, #37ffec00 74.2%), radial-gradient(circle at 46.86% 20.28%, #8837ff80 0, #8837ff00 73.4%), radial-gradient(circle at 7.78% 11.67%, #37ff5680 0, #37ff5600 53.9%), radial-gradient(circle at 43.71% 15.57%, #ff37e080 0, #ff37e000 71.86%), #ffffff',
    tarjeta: 'linear-gradient(180deg, #ffffff 59%, #f5f5f5 100%)', sombra: true,
    texto: '#303030', titulo: 'linear-gradient(45deg, #74b4db 0%, #5678f0 50%, #948be2 100%)',
    // El link del config es #5678f0; Gamma lo dibuja #1136bb por legibilidad.
    acento: '#89c6eb', enlace: '#1136bb',
    // Texto del botón oscuro: blanco sobre ese degradado celeste da 2.7 de contraste.
    boton: 'linear-gradient(45deg, #93cef1 0%, #5678f0 50%, #948be2 100%)', botonTexto: '#0f1f45',
    redondez: 'lg', interlineado: [1.4, 1.2], tracking: [-0.01, -0.02],
    paleta: ['#5678f0', '#93cef1', '#948be2', '#f1f1f1', '#89c6eb', '#1136bb'],
  },
  {
    nombre: 'Espresso', grupo: 'claro', etiquetas: ['colorido'],
    fuenteTitulo: ['Libre Baskerville', 400], fuenteCuerpo: ['Poppins', 400],
    fondo: '#27150a',
    tarjeta: '#fefefe', sombra: false,
    // Link y botón: el config dice #3c1b08 y Gamma los dibuja #e7844b.
    texto: '#3c1b08', titulo: '#27150a', acento: '#3c1b08', enlace: '#e7844b',
    boton: '#e7844b', botonTexto: '#27150a',
    redondezBoton: 'xl', escala: [0.9, 0.95], interlineado: [1.4, 1.1], tracking: [0.02, -0.02],
    paleta: ['#3c1b08', '#fe8043', '#92b7c9', '#f9f8b7', '#efedee', '#e7844b'],
  },
  {
    nombre: 'Periwinkle', grupo: 'oscuro', etiquetas: ['colorido'],
    fuenteTitulo: ['Anton', 400], fuenteCuerpo: ['Arimo', 400],
    // Gamma pone #121212 + una imagen de líneas finas: el degradado la aproxima.
    fondo: 'radial-gradient(circle at 20% 0%, #1f2a44 0%, #121212 60%)',
    tarjeta: '#1f1f1f', sombra: true,
    texto: '#d6dae0', titulo: '#95befa', acento: '#95befa', enlace: '#95befa',
    boton: '#95befa', botonTexto: '#121212',
    escala: [0.95, 1], interlineado: [1.2, 1.25], tracking: [-0.01, -0.01],
    paleta: ['#95befa', '#fa95ae', '#c5c5c9', '#6b9ef0', '#c9dcfc', '#3d5a8a'],
  },
  {
    nombre: 'Botanical', grupo: 'claro', etiquetas: ['colorido'],
    fuenteTitulo: ['Bodoni Moda', 400], fuenteCuerpo: ['Public Sans', 400],
    fondo: '#2c1f16',
    // Borde sm sin color en el config: va el del borde por defecto, tibio para la tarjeta crema.
    tarjeta: '#fffeed', borde: '#e8e4c9', sombra: true,
    texto: '#3b2a1e', titulo: '#553726', acento: '#553726', enlace: '#553726',
    boton: '#553726', botonTexto: '#fffeed',
    interlineado: [1.4, 1], tracking: [-0.02, -0.1],
    paleta: ['#e3e6a5', '#c4d0d2', '#ffdfd7', '#553726', '#8a9a5b', '#b7795e'],
  },
  {
    nombre: 'Primer', grupo: 'claro', etiquetas: ['colorido'],
    fuenteTitulo: ['Funnel Display', 500], fuenteCuerpo: ['Nobile', 400],
    // #0d392c + una imagen: el degradado la aproxima.
    fondo: 'linear-gradient(160deg, #0d392c 0%, #145a45 55%, #0a2a20 100%)',
    tarjeta: '#fafafa', sombra: false,
    // El acento del config es un degradado (…#fdd35d → #ff8225 → #2794f5): se toma el naranja del botón.
    texto: '#1e1b1b', titulo: '#2c0306', acento: '#ff8225', enlace: '#1e1b1b',
    boton: '#ff8225', botonTexto: '#1e1b1b',
    redondezBoton: 'xl', interlineado: [1.5, 1], tracking: [-0.01, -0.02],
    paleta: ['#2794f5', '#fdd35d', '#ff8225', '#007853', '#2c0306', '#9fd3ff'],
  },
  {
    nombre: 'Mint', grupo: 'claro', etiquetas: ['profesional'],
    fuenteTitulo: ['Sora', 600], fuenteCuerpo: ['Noto Sans TC', 400],
    // #29414f + una imagen: el degradado la aproxima.
    fondo: 'linear-gradient(160deg, #29414f 0%, #3d6173 60%, #1d2f39 100%)',
    tarjeta: '#f2f9ff', borde: '#96bcd3', sombra: false,
    texto: '#29414f', titulo: '#29414f', acento: '#98dcda', enlace: '#98dcda',
    boton: '#98dcda', botonTexto: '#29414f',
    redondez: 'sm', redondezBoton: 'xl', interlineado: [1.3, 1], tracking: [-0.01, -0.03],
    paleta: ['#98dcda', '#29414f', '#96bcd3', '#c6ebec', '#5d8aa8', '#f5faff'],
  },
  {
    nombre: 'Canyon', grupo: 'claro', etiquetas: ['colorido'],
    fuenteTitulo: ['Manrope', 500], fuenteCuerpo: ['Inter', 400],
    // Gamma pone una foto de montañas: el degradado de cañón la aproxima.
    fondo: 'linear-gradient(180deg, #e9d8c4 0%, #c99a74 55%, #7d5a44 100%)',
    tarjeta: '#fcfaf9', sombra: true,
    texto: '#271b0f', titulo: '#271b0f', acento: '#02796f', enlace: '#02796f',
    boton: '#b7410f', botonTexto: '#ffffff',
    interlineado: [1.25, 1.25], tracking: [-0.02, -0.02],
    paleta: ['#02796f', '#b7410f', '#e0a96d', '#5b8c85', '#8c4a2f', '#d9c5b2'],
  },
  {
    nombre: 'Anvil', grupo: 'claro', etiquetas: ['profesional'],
    fuenteTitulo: ['Martel Sans', 400], fuenteCuerpo: ['Martel Sans', 300],
    // #EBF4F3 + una imagen: el degradado la aproxima.
    fondo: 'linear-gradient(180deg, #ebf4f3 0%, #d5e6e4 100%)',
    tarjeta: '#fafafa', sombra: true,
    texto: '#383f5b', titulo: '#272d45', acento: '#4682b4', enlace: '#4682b4',
    boton: '#4682b4', botonTexto: '#ffffff',
    paleta: ['#4682b4', '#272d45', '#8fb3d3', '#c9dbe9', '#6b7a99', '#2e5a7f'],
  },
  {
    nombre: 'Malachite', grupo: 'oscuro', etiquetas: ['colorido'],
    fuenteTitulo: ['Instrument Sans', 600], fuenteCuerpo: ['Instrument Sans', 400],
    // #FAFAFA + una imagen verde: el degradado de malaquita la aproxima.
    fondo: 'linear-gradient(160deg, #0f3d2e 0%, #1d6b4f 50%, #0c2a20 100%)',
    tarjeta: '#1a1a1a', esmerilado: true, borde: '#2f2f2f', sombra: true,
    // El primary del config es #1a1a1a, invisible sobre su propia tarjeta: Gamma
    // dibuja link y botón #32cd32, y ése va de acento.
    texto: '#ececec', titulo: '#ffffff', acento: '#32cd32', enlace: '#32cd32',
    boton: '#32cd32', botonTexto: '#0b1f0b',
    redondezBoton: 'lg', tracking: [0, -0.04],
    paleta: ['#32cd32', '#7be07b', '#0f8a3c', '#b8f2b8', '#2e8b57', '#1a1a1a'],
  },
  {
    nombre: 'Terrain', grupo: 'claro', etiquetas: ['profesional'],
    fuenteTitulo: ['Fraunces', 600], fuenteCuerpo: ['DM Sans', 400],
    // #FAFAFA + una imagen: el degradado la aproxima.
    fondo: 'linear-gradient(180deg, #e6e9d3 0%, #c7cba6 100%)',
    tarjeta: '#ecf0db', sombra: true,
    texto: '#2e2f23', titulo: '#2e2f23', acento: '#2e2f23', enlace: '#5a4b3f',
    boton: '#5b4a35', botonTexto: '#ecf0db',
    paleta: ['#2e2f23', '#5a4b3f', '#5b4a35', '#a3a77a', '#d8dcbf', '#7c6a55'],
  },

  // ── Los «Standard» de la galería (gamma-tokens §8) ─────────────────────────
  // Todos aproximados de captura: Gamma no los muestra sin sesión.
  {
    // aproximado de captura: fondo degradado rosa-lavanda pastel, tarjeta blanca, link violeta
    nombre: 'Prism', grupo: 'claro', etiquetas: ['colorido'], aproximado: true,
    fuenteTitulo: ['Plus Jakarta Sans', 700], fuenteCuerpo: ['Plus Jakarta Sans', 400],
    fondo: 'linear-gradient(135deg, #fbd3e9 0%, #e0d4fb 50%, #c9d6ff 100%)',
    tarjeta: '#ffffff', sombra: true,
    texto: '#292929', titulo: '#1f1f1f', acento: '#7c3aed', enlace: '#7c3aed',
    boton: '#7c3aed', botonTexto: '#ffffff', redondez: 'lg', redondezBoton: 'xl',
    paleta: ['#7c3aed', '#ec4899', '#a78bfa', '#f9a8d4', '#6366f1', '#c4b5fd'],
  },
  {
    // aproximado de captura: azul noche con estrellas, título blanco
    nombre: 'Night Sky', grupo: 'oscuro', etiquetas: ['profesional'], aproximado: true,
    fuenteTitulo: ['Sora', 600], fuenteCuerpo: ['Inter', 400],
    fondo: 'radial-gradient(circle at 18% 22%, #ffffff40 0, #ffffff00 0.35%), radial-gradient(circle at 72% 14%, #ffffff33 0, #ffffff00 0.3%), radial-gradient(circle at 86% 64%, #ffffff33 0, #ffffff00 0.3%), linear-gradient(180deg, #070b1f 0%, #132050 100%)',
    tarjeta: '#0f1733', sombra: true,
    texto: '#d7def5', titulo: '#ffffff', acento: '#7aa2ff', enlace: '#8fb0ff',
    boton: '#7aa2ff', botonTexto: '#0b1026',
    paleta: ['#7aa2ff', '#c3d4ff', '#3d5bd9', '#ffd27a', '#8f7aff', '#4fd1c5'],
  },
  {
    // aproximado de captura: claro, título negro
    nombre: 'Commons', grupo: 'claro', etiquetas: ['profesional'], aproximado: true,
    fuenteTitulo: ['Inter', 700], fuenteCuerpo: ['Inter', 400],
    fondo: '#f4f4f2',
    tarjeta: '#ffffff', sombra: true,
    texto: '#2b2b2b', titulo: '#111111', acento: '#2563eb', enlace: '#2563eb',
    boton: '#111111', botonTexto: '#ffffff', tracking: [0, -0.02],
    paleta: ['#2563eb', '#111111', '#60a5fa', '#f59e0b', '#10b981', '#9ca3af'],
  },
  {
    // aproximado de captura: tarjeta gris oscuro
    nombre: 'Founder', grupo: 'oscuro', etiquetas: ['profesional'], aproximado: true,
    fuenteTitulo: ['Archivo', 700], fuenteCuerpo: ['Inter', 400],
    fondo: '#2a2b2e',
    tarjeta: '#3a3b3f', sombra: true,
    texto: '#e6e6e6', titulo: '#ffffff', acento: '#f5b942', enlace: '#f5c66b',
    boton: '#f5b942', botonTexto: '#1d1d1f',
    paleta: ['#f5b942', '#e6e6e6', '#8a8f98', '#f07c3b', '#5bc0be', '#c9a227'],
  },
  {
    // aproximado de captura: lavanda claro, título serif violeta
    nombre: 'Lavender', grupo: 'claro', etiquetas: ['colorido'], aproximado: true,
    fuenteTitulo: ['Playfair Display', 600], fuenteCuerpo: ['Inter', 400],
    fondo: '#ece6fb',
    tarjeta: '#faf8ff', sombra: true,
    texto: '#3a3450', titulo: '#5b3fa8', acento: '#7c5cd6', enlace: '#6a4bc4',
    boton: '#7c5cd6', botonTexto: '#ffffff', redondez: 'lg', redondezBoton: 'xl',
    paleta: ['#7c5cd6', '#b9a5f0', '#5b3fa8', '#e3d9fb', '#9f7aea', '#4c3a8c'],
  },
  {
    // aproximado de captura: índigo oscuro, título blanco
    nombre: 'Indigo', grupo: 'oscuro', etiquetas: ['colorido'], aproximado: true,
    fuenteTitulo: ['Manrope', 700], fuenteCuerpo: ['Manrope', 400],
    fondo: '#1e1b4b',
    tarjeta: '#2a2670', sombra: true,
    texto: '#e0e0ff', titulo: '#ffffff', acento: '#a5b4fc', enlace: '#a5b4fc',
    boton: '#a5b4fc', botonTexto: '#1e1b4b',
    paleta: ['#a5b4fc', '#6366f1', '#818cf8', '#e0e7ff', '#4f46e5', '#c7d2fe'],
  },
  {
    // aproximado de captura: blanco, título negro bold
    nombre: 'Howlite', grupo: 'claro', etiquetas: ['profesional'], aproximado: true,
    fuenteTitulo: ['Inter Tight', 800], fuenteCuerpo: ['Inter', 400],
    fondo: '#ffffff',
    tarjeta: '#ffffff', borde: '#e5e5e5', sombra: false,
    texto: '#333333', titulo: '#000000', acento: '#111111', enlace: '#1a1a1a',
    boton: '#111111', botonTexto: '#ffffff', redondez: 'sm', redondezBoton: 'sm', tracking: [0, -0.03],
    paleta: ['#111111', '#555555', '#999999', '#d4d4d4', '#2563eb', '#e5e5e5'],
  },
  {
    // aproximado de captura: negro
    nombre: 'Onyx', grupo: 'oscuro', etiquetas: ['profesional'], aproximado: true,
    fuenteTitulo: ['Space Grotesk', 600], fuenteCuerpo: ['Inter', 400],
    fondo: '#000000',
    tarjeta: '#111111', borde: '#262626', sombra: false,
    texto: '#d4d4d4', titulo: '#ffffff', acento: '#e5e5e5', enlace: '#ffffff',
    boton: '#ffffff', botonTexto: '#000000',
    paleta: ['#e5e5e5', '#a3a3a3', '#737373', '#fafafa', '#525252', '#d4d4d4'],
  },
  {
    // aproximado de captura: fondo degradado pastel, tarjeta blanca esmerilada, título rosa-violeta
    nombre: 'Atmosphere', grupo: 'claro', etiquetas: ['colorido'], aproximado: true,
    fuenteTitulo: ['DM Sans', 700], fuenteCuerpo: ['DM Sans', 400],
    fondo: 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 35%, #fbc2eb 100%)',
    tarjeta: '#ffffff', esmerilado: true, sombra: true,
    texto: '#2f2f3a', titulo: 'linear-gradient(90deg, #e0559b 0%, #8a4fff 100%)',
    acento: '#8a4fff', enlace: '#7b3fe4',
    boton: 'linear-gradient(90deg, #e0559b 0%, #8a4fff 100%)', botonTexto: '#ffffff',
    redondez: 'lg', redondezBoton: 'xl',
    paleta: ['#8a4fff', '#e0559b', '#5aa9ff', '#ffb4d6', '#b69cff', '#7fd6ff'],
  },
  {
    // aproximado de captura: violeta oscuro, título blanco, link rosa
    nombre: 'Blueberry', grupo: 'oscuro', etiquetas: ['colorido'], aproximado: true,
    fuenteTitulo: ['Poppins', 600], fuenteCuerpo: ['Poppins', 400],
    fondo: '#241a3f',
    tarjeta: '#2f2352', sombra: true,
    texto: '#ddd6f3', titulo: '#ffffff', acento: '#ff7ab6', enlace: '#ff8cc0',
    boton: '#ff7ab6', botonTexto: '#241a3f',
    paleta: ['#ff7ab6', '#8f7aff', '#5b4bd6', '#ffc2dd', '#3d2f7a', '#b8a8ff'],
  },
  {
    // aproximado de captura: papel kraft beige
    nombre: 'Kraft', grupo: 'claro', etiquetas: ['colorido'], aproximado: true,
    fuenteTitulo: ['Libre Baskerville', 700], fuenteCuerpo: ['Work Sans', 400],
    fondo: '#c8a97e',
    tarjeta: '#e9d8bd', sombra: true,
    texto: '#3b2e1f', titulo: '#2a1f13', acento: '#8b5e34', enlace: '#7a4f28',
    boton: '#5a3d22', botonTexto: '#f3e7d3', redondez: 'sm',
    paleta: ['#8b5e34', '#5a3d22', '#c49a6c', '#3b2e1f', '#a67c52', '#e0c9a6'],
  },
  {
    // aproximado de captura: degradado durazno, tarjeta blanca, serif
    nombre: 'Peach', grupo: 'claro', etiquetas: ['colorido'], aproximado: true,
    fuenteTitulo: ['Fraunces', 600], fuenteCuerpo: ['Inter', 400],
    fondo: 'linear-gradient(135deg, #ffd3a5 0%, #fd9f85 100%)',
    tarjeta: '#ffffff', sombra: true,
    texto: '#3d2b26', titulo: '#2b1a15', acento: '#e0603f', enlace: '#c84c2c',
    boton: '#e0603f', botonTexto: '#ffffff', redondez: 'lg',
    paleta: ['#e0603f', '#f4a261', '#2a9d8f', '#e9c46a', '#c84c2c', '#264653'],
  },
  {
    // aproximado de captura: fondo coral, tarjeta blanca
    nombre: 'Flamingo', grupo: 'claro', etiquetas: ['colorido'], aproximado: true,
    fuenteTitulo: ['Rubik', 600], fuenteCuerpo: ['Rubik', 400],
    fondo: '#f7786b',
    tarjeta: '#ffffff', sombra: true,
    texto: '#3a2a2a', titulo: '#1f1414', acento: '#e5484d', enlace: '#d13a3f',
    boton: '#e5484d', botonTexto: '#ffffff', redondez: 'lg', redondezBoton: 'xl',
    paleta: ['#e5484d', '#f7786b', '#ffb4a8', '#3a2a2a', '#ff8f6b', '#c4373c'],
  },
  {
    // aproximado de captura: marrón oscuro
    nombre: 'Mocha', grupo: 'oscuro', etiquetas: ['profesional'], aproximado: true,
    fuenteTitulo: ['Lora', 600], fuenteCuerpo: ['Source Sans 3', 400],
    fondo: '#2b1d16',
    tarjeta: '#3b2a21', sombra: true,
    texto: '#ead9cc', titulo: '#fff4ec', acento: '#d4a373', enlace: '#e0b48a',
    boton: '#d4a373', botonTexto: '#2b1d16',
    paleta: ['#d4a373', '#e0b48a', '#a0704b', '#faedcd', '#7f5539', '#ccd5ae'],
  },
  {
    // aproximado de captura: celeste muy claro
    nombre: 'Serene', grupo: 'claro', etiquetas: ['profesional'], aproximado: true,
    fuenteTitulo: ['Nunito', 700], fuenteCuerpo: ['Nunito', 400],
    fondo: '#e8f4fb',
    tarjeta: '#f7fbfe', sombra: true,
    texto: '#2c3e50', titulo: '#1b2a38', acento: '#3b9ccf', enlace: '#2a7fb0',
    boton: '#3b9ccf', botonTexto: '#ffffff', redondez: 'lg', redondezBoton: 'xl',
    paleta: ['#3b9ccf', '#7cc3e8', '#2a7fb0', '#bfe3f5', '#5e8fa8', '#1b4f72'],
  },
  {
    // aproximado de captura: azul aciano, tarjeta blanca
    nombre: 'Cornflower', grupo: 'claro', etiquetas: ['colorido'], aproximado: true,
    fuenteTitulo: ['Montserrat', 700], fuenteCuerpo: ['Open Sans', 400],
    fondo: '#6495ed',
    tarjeta: '#ffffff', sombra: true,
    texto: '#26324a', titulo: '#1a2540', acento: '#4169c8', enlace: '#3159b8',
    boton: '#4169c8', botonTexto: '#ffffff',
    paleta: ['#4169c8', '#6495ed', '#a3bff5', '#1a2540', '#f4b860', '#3159b8'],
  },

  // ── Los de MaKo (14/10/2026) ───────────────────────────────────────────────
  // Pedido de Martín, mirando la grilla de Diseños: «Puedes inspirarte en otras plantillas de VSL Funnel
  // e incluso en la misma plantilla de MaKo.» Los valores son los de la landing de MaKo (app/vsl):
  // Geist 600/400, fondo gris azulado, tarjeta blanca, botón y enlaces en el azul de la marca.
  {
    nombre: 'MaKo', grupo: 'claro', etiquetas: ['profesional'], deMako: true,
    fuenteTitulo: ['Geist', 600], fuenteCuerpo: ['Geist', 400],
    fondo: '#f5f7fa',
    tarjeta: '#ffffff', borde: '#eaecf1', sombra: true,
    texto: '#4a515e', titulo: '#12151b', acento: '#2f6fed', enlace: '#2f6fed',
    boton: '#2f6fed', botonTexto: '#ffffff', redondez: 'lg', redondezBoton: 'lg',
    interlineado: [1.65, 1.15], tracking: [0, -0.03],
    paleta: ['#2f6fed', '#1b2240', '#f2b01e', '#1e9e57', '#dc2626', '#8b7cf6'],
  },
];

function congelar<T>(o: T): T {
  if (o && typeof o === 'object') {
    for (const v of Object.values(o as Record<string, unknown>)) congelar(v);
    Object.freeze(o);
  }
  return o;
}

/** El catálogo, en el orden de la galería: primero los medidos, después los Standard y al final los de MaKo. */
export const TEMAS: readonly Tema[] = congelar(CRUDOS.map(definir));

/** El default de CONFIG_DEFAULT.tema (lib/editor-landing/api-tipos.ts). */
export const TEMA_DEFAULT_ID = 'pewter';

const POR_ID = new Map(TEMAS.map((t) => [t.id, t]));

export function esOscuro(t: Tema): boolean {
  return t.grupo === 'oscuro';
}

// ─────────────────────────────────────────────────────────────────────────────
// Temas propios del workspace: base + cambios, VALIDADOS hoja por hoja
// ─────────────────────────────────────────────────────────────────────────────
// Un tema propio se guarda en app_settings (`landing.temas`) como
// { id, nombre, base, cambios } (TemaPropio, api-tipos.ts) y termina en el
// `style` de cada sección de una página PÚBLICA. Por eso nada de `cambios` se usa
// tal cual: cada hoja se valida contra su lista o su forma y se RE-ESCRIBE (un
// degradado se parsea y se vuelve a armar), y lo que no pasa se descarta en
// silencio para quedarse con el valor de la base. Un `cambios.colores.texto =
// "red;}</style><script>…"` no llega a ningún lado.


const ES_HEX = /^#[0-9a-fA-F]{6}$/;

function hexValido(v: unknown): string | null {
  return typeof v === 'string' && ES_HEX.test(v.trim()) ? v.trim().toLowerCase() : null;
}

/** Sólo `linear-gradient(<n>deg, #hex [n%], …)` con 2 a 6 paradas, re-escrito. */
function degradadoValido(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const m = /^\s*linear-gradient\(\s*(-?\d{1,3}(?:\.\d+)?)deg\s*,(.+)\)\s*$/i.exec(v);
  if (!m) return null;
  const angulo = Number(m[1]);
  if (!Number.isFinite(angulo)) return null;
  const paradas: string[] = [];
  for (const parte of m[2].split(',')) {
    const p = /^\s*(#[0-9a-fA-F]{6})(?:\s+(\d{1,3}(?:\.\d+)?)%)?\s*$/.exec(parte);
    if (!p) return null;
    const pct = p[2] !== undefined ? Math.min(100, Number(p[2])) : null;
    paradas.push(p[1].toLowerCase() + (pct !== null ? ' ' + pct + '%' : ''));
  }
  if (paradas.length < 2 || paradas.length > 6) return null;
  return 'linear-gradient(' + (((angulo % 360) + 360) % 360) + 'deg, ' + paradas.join(', ') + ')';
}

function rellenoValido(v: unknown): string | null {
  return hexValido(v) ?? degradadoValido(v);
}

function numeroEn(v: unknown, min: number, max: number): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v * 1000) / 1000)) : null;
}

function enumValido<T extends string>(lista: readonly T[], v: unknown): T | null {
  return (lista as readonly unknown[]).includes(v) ? (v as T) : null;
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function fuenteValida(v: unknown): { familia?: string; peso?: number } | null {
  const o = obj(v);
  const familia = typeof o.familia === 'string' && Object.prototype.hasOwnProperty.call(FUENTES, o.familia) ? o.familia : undefined;
  const peso = typeof o.peso === 'number' && Number.isFinite(o.peso) ? Math.round(o.peso) : undefined;
  return familia || peso ? { familia, peso } : null;
}

/**
 * Los cambios de un tema propio, sólo con las hojas válidas (re-escritas). Lo usa
 * el server antes de guardar y `mezclarTema` antes de aplicar: una sola regla.
 */
export function sanearCambiosTema(cambios: unknown): Record<string, unknown> {
  const c = obj(cambios);
  const out: Record<string, unknown> = {};

  const fu = obj(c.fuentes);
  const fTitulo = fuenteValida(fu.titulo);
  const fCuerpo = fuenteValida(fu.cuerpo);
  if (fTitulo || fCuerpo) out.fuentes = { ...(fTitulo ? { titulo: fTitulo } : {}), ...(fCuerpo ? { cuerpo: fCuerpo } : {}) };

  const fondo = rellenoValido(c.fondo);
  if (fondo) out.fondo = fondo;

  const ta = obj(c.tarjeta);
  const tarjeta: Record<string, unknown> = {};
  const tFondo = rellenoValido(ta.fondo);
  if (tFondo) tarjeta.fondo = tFondo;
  const tTransp = enumValido(['normal', 'esmerilado'] as const, ta.transparencia);
  if (tTransp) tarjeta.transparencia = tTransp;
  if (ta.borde === null) tarjeta.borde = null;
  else if (hexValido(ta.borde)) tarjeta.borde = hexValido(ta.borde);
  if (typeof ta.sombra === 'boolean') tarjeta.sombra = ta.sombra;
  if (Object.keys(tarjeta).length) out.tarjeta = tarjeta;

  const co = obj(c.colores);
  const colores: Record<string, unknown> = {};
  for (const k of ['texto', 'acento', 'enlace', 'botonTexto'] as const) {
    const h = hexValido(co[k]);
    if (h) colores[k] = h;
  }
  for (const k of ['titulo', 'boton'] as const) {
    const r = rellenoValido(co[k]);
    if (r) colores[k] = r;
  }
  if (Object.keys(colores).length) out.colores = colores;

  const re = obj(c.redondez);
  const redondez: Record<string, unknown> = {};
  const rT = enumValido(REDONDECES, re.tarjeta);
  const rB = enumValido(REDONDECES, re.boton);
  if (rT) redondez.tarjeta = rT;
  if (rB) redondez.boton = rB;
  if (Object.keys(redondez).length) out.redondez = redondez;

  const par = (v: unknown, lim: Record<'cuerpo' | 'titulos', [number, number]>) => {
    const o = obj(v);
    const r: Record<string, number> = {};
    for (const k of ['cuerpo', 'titulos'] as const) {
      const n = numeroEn(o[k], lim[k][0], lim[k][1]);
      if (n !== null) r[k] = n;
    }
    return Object.keys(r).length ? r : null;
  };
  const escala = par(c.escala, { cuerpo: [0.8, 1.25], titulos: [0.8, 1.4] });
  if (escala) out.escala = escala;
  const interlineado = par(c.interlineado, { cuerpo: [1.1, 2], titulos: [0.9, 1.6] });
  if (interlineado) out.interlineado = interlineado;
  const tracking = par(c.tracking, { cuerpo: [-0.05, 0.1], titulos: [-0.12, 0.1] });
  if (tracking) out.tracking = tracking;

  if (Array.isArray(c.paleta)) {
    const paleta = c.paleta.map(hexValido).filter((h): h is string => !!h).slice(0, 12);
    if (paleta.length) out.paleta = paleta;
  }
  return out;
}

/**
 * La base con los cambios encima (validados). El grupo claro/oscuro se recalcula
 * con el color de la tarjeta: si la persona oscurece la tarjeta, el tema pasa al
 * filtro «Oscuro» y el chrome del editor se da vuelta con él.
 */
export function mezclarTema(base: Tema, cambios: unknown): Tema {
  const c = sanearCambiosTema(cambios) as {
    fuentes?: { titulo?: { familia?: string; peso?: number }; cuerpo?: { familia?: string; peso?: number } };
    fondo?: string; tarjeta?: Partial<Tema['tarjeta']>; colores?: Partial<Tema['colores']>;
    redondez?: Partial<Tema['redondez']>; escala?: Partial<Tema['escala']>;
    interlineado?: Partial<Tema['interlineado']>; tracking?: Partial<Tema['tracking']>; paleta?: string[];
  };
  const fuente = (b: FuenteTema, d?: { familia?: string; peso?: number }): FuenteTema => {
    const familia = d?.familia ?? b.familia;
    return { familia, peso: pesoDisponible(familia, d?.peso ?? b.peso) };
  };
  const tarjeta = { ...base.tarjeta, ...c.tarjeta };
  const t: Tema = {
    ...base,
    fuentes: { titulo: fuente(base.fuentes.titulo, c.fuentes?.titulo), cuerpo: fuente(base.fuentes.cuerpo, c.fuentes?.cuerpo) },
    fondo: c.fondo ?? base.fondo,
    tarjeta,
    colores: { ...base.colores, ...c.colores },
    redondez: { ...base.redondez, ...c.redondez },
    escala: { ...base.escala, ...c.escala },
    interlineado: { ...base.interlineado, ...c.interlineado },
    tracking: { ...base.tracking, ...c.tracking },
    paleta: c.paleta ?? base.paleta,
    aproximado: false,
  };
  t.grupo = luminancia(colorDeRelleno(tarjeta.fondo)) < 0.2 ? 'oscuro' : 'claro';
  return t;
}

const ID_PROPIO = /^[A-Za-z0-9_-]{1,40}$/;

/** Un TemaPropio que vino de afuera (body, app_settings), validado; null si no sirve. */
export function sanearTemaPropio(x: unknown): TemaPropio | null {
  const o = obj(x);
  const id = typeof o.id === 'string' ? o.id.replace(/^ws:/, '') : '';
  if (!ID_PROPIO.test(id)) return null;
  const nombre = typeof o.nombre === 'string' ? o.nombre.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 60) : '';
  const base = typeof o.base === 'string' && POR_ID.has(o.base) ? o.base : TEMA_DEFAULT_ID;
  return { id, nombre: nombre || 'Tema sin título', base, cambios: sanearCambiosTema(o.cambios) };
}

/**
 * El tema por id. 'ws:<id>' busca entre los propios del workspace (base + cambios
 * validados); un id que no existe —un tema propio borrado, un id viejo— cae al
 * default, nunca a un tema vacío.
 */
export function temaPorId(id: string | null | undefined, propios?: readonly TemaPropio[] | null): Tema {
  if (typeof id === 'string' && id.startsWith('ws:') && propios?.length) {
    const clave = id.slice(3);
    const crudo = propios.find((p) => p && (p.id === clave || p.id === id));
    const p = crudo ? sanearTemaPropio(crudo) : null;
    if (p) {
      const t = mezclarTema(POR_ID.get(p.base) ?? POR_ID.get(TEMA_DEFAULT_ID)!, p.cambios);
      return { ...t, id: 'ws:' + p.id, nombre: p.nombre };
    }
  }
  return (typeof id === 'string' && POR_ID.get(id)) || POR_ID.get(TEMA_DEFAULT_ID)!;
}

// ─────────────────────────────────────────────────────────────────────────────
// Las variables --gm-* (las que lee css.ts)
// ─────────────────────────────────────────────────────────────────────────────
// Mapeo de gamma-tokens §1: --card-* → --gm-tarjeta-*, --body-color → --gm-texto,
// --heading-gradient → --gm-titulo-degradado, --accent-color → --gm-acento,
// --link-color → --gm-enlace, --button-* → --gm-boton-*, --palette-N → --gm-paleta-N,
// --callout-* → --gm-rec-*. Van INLINE en cada raíz .gm-doc (estiloDeTema): así
// conviven en una misma pantalla miniaturas con temas distintos.

/** Recuadros (callouts) medidos en Gamma: [fondo, ícono] en tema claro y en tema oscuro. */
const RECUADROS: Record<'info' | 'advertencia' | 'precaucion' | 'exito' | 'pregunta', { claro: [string, string]; oscuro: [string, string] }> = {
  info: { claro: ['#b6d6fc', '#006ed6'], oscuro: ['#022349', '#8dd4fb'] },
  advertencia: { claro: ['#fcf2b5', '#b29500'], oscuro: ['#4b3f02', '#f5f380'] },
  precaucion: { claro: ['#ffb3b4', '#eb0000'], oscuro: ['#450707', '#ef8784'] },
  exito: { claro: ['#b6fcb8', '#008545'], oscuro: ['#183a13', '#8ce29f'] },
  pregunta: { claro: ['#d9d9d9', '#7a7a7a'], oscuro: ['#262626', '#afafaf'] },
};

const CACHE = new WeakMap<Tema, Record<string, string>>();

export function varsDeTema(t: Tema): Record<string, string> {
  const enCache = CACHE.get(t);
  if (enCache) return enCache;

  const oscuro = esOscuro(t);
  const tarjetaColor = colorDeRelleno(t.tarjeta.fondo);
  const lectura = fondosDeLectura(t);
  const fondoColor = colorDeRelleno(t.fondo);
  const esmerilado = t.tarjeta.transparencia === 'esmerilado';
  const tituloDeg = esDegradado(t.colores.titulo);
  const tituloSolido = tituloDeg ? legible(colorDeRelleno(t.colores.titulo), lectura, 3) : t.colores.titulo;
  const botonSolido = colorDeRelleno(t.colores.boton);
  const pesoNegrita = pesoDisponible(t.fuentes.cuerpo.familia, 700);

  const v: Record<string, string> = {
    '--gm-esquema': oscuro ? 'dark' : 'light',
    // Fuentes
    '--gm-fuente-titulo': pilaFuente(t.fuentes.titulo.familia),
    '--gm-fuente-cuerpo': pilaFuente(t.fuentes.cuerpo.familia),
    '--gm-peso-titulo': String(t.fuentes.titulo.peso),
    '--gm-peso-cuerpo': String(t.fuentes.cuerpo.peso),
    '--gm-peso-negrita': String(Math.max(pesoNegrita, t.fuentes.cuerpo.peso)),
    // Página
    '--gm-fondo': t.fondo,
    '--gm-fondo-color': fondoColor,
    // Texto que va directo sobre el fondo de la página (el pie, avisos fuera de la tarjeta).
    '--gm-tinta-fondo': legible(t.colores.texto, [fondoColor], 4.5),
    // Tarjeta
    '--gm-tarjeta-fondo': esmerilado ? rellenoConAlfa(t.tarjeta.fondo, ALFA_ESMERILADO) : t.tarjeta.fondo,
    '--gm-tarjeta-color': tarjetaColor,
    '--gm-tarjeta-velo': rgba(tarjetaColor, 0.6),
    '--gm-tarjeta-filtro': esmerilado ? FILTRO_ESMERILADO : 'none',
    '--gm-tarjeta-borde': t.tarjeta.borde ? '0 0 0 0.0625em ' + t.tarjeta.borde : SIN_SOMBRA,
    '--gm-tarjeta-sombra': t.tarjeta.sombra ? SOMBRA_TARJETA : SIN_SOMBRA,
    '--gm-radio-tarjeta': RADIO_TARJETA[t.redondez.tarjeta],
    '--gm-radio-caja': RADIO_CAJA[t.redondez.tarjeta],
    '--gm-radio-boton': RADIO_BOTON[t.redondez.boton],
    // Texto y títulos
    '--gm-texto': t.colores.texto,
    '--gm-texto-tenue': rgba(t.colores.texto, 0.72),
    '--gm-titulo': tituloSolido,
    '--gm-titulo-degradado': tituloDeg ? t.colores.titulo : 'none',
    '--gm-titulo-relleno': tituloDeg ? 'transparent' : t.colores.titulo,
    // Con degradado, Gamma estira la caja del título .25em para que background-clip no corte los descendentes.
    '--gm-titulo-sangrado': tituloDeg ? '0.25em' : '0em',
    // Acento
    '--gm-acento': t.colores.acento,
    '--gm-acento-texto': legible(t.colores.acento, lectura, 4.5),
    '--gm-acento-contraste': tintaSobre(t.colores.acento),
    '--gm-acento-suave': mezclar(tarjetaColor, t.colores.acento, oscuro ? 0.22 : 0.14),
    '--gm-acento-borde': mezclar(tarjetaColor, t.colores.acento, 0.55),
    // Superficies neutras (Gamma: --surface-color = la tarjeta corrida 6% hacia el texto)
    '--gm-superficie': mezclar(tarjetaColor, t.colores.texto, 0.06),
    '--gm-cebra': mezclar(tarjetaColor, t.colores.texto, 0.035),
    '--gm-borde-neutro': oscuro ? 'rgba(255,255,255,0.24)' : 'rgba(0,0,0,0.15)',
    '--gm-resaltado': oscuro ? '#5c4d12' : '#fdf2a6',
    // Enlaces y botones
    '--gm-enlace': legible(t.colores.enlace, lectura, 4.5),
    '--gm-enlace-hover': mezclar(legible(t.colores.enlace, lectura, 4.5), t.colores.texto, 0.3),
    '--gm-boton': t.colores.boton,
    '--gm-boton-texto': t.colores.botonTexto,
    // El botón «contorno» no puede pintar un borde degradado: usa el color sólido, legible.
    '--gm-boton-borde': legible(botonSolido, lectura, 3),
    // Escalas
    '--gm-escala-cuerpo': String(t.escala.cuerpo),
    '--gm-escala-titulos': String(t.escala.titulos),
    '--gm-interlineado-cuerpo': String(t.interlineado.cuerpo),
    '--gm-interlineado-titulos': String(t.interlineado.titulos),
    '--gm-tracking-cuerpo': t.tracking.cuerpo + 'em',
    '--gm-tracking-titulos': t.tracking.titulos + 'em',
  };

  for (const [tono, par] of Object.entries(RECUADROS)) {
    const [f, i] = oscuro ? par.oscuro : par.claro;
    v['--gm-rec-' + tono + '-fondo'] = f;
    v['--gm-rec-' + tono + '-icono'] = i;
  }
  // La nota usa el color del tema (Gamma: color-mix del acento al 20% con la tarjeta).
  v['--gm-rec-nota-fondo'] = mezclar(tarjetaColor, t.colores.acento, 0.2);
  v['--gm-rec-nota-icono'] = legible(t.colores.acento, [mezclar(tarjetaColor, t.colores.acento, 0.2)], 3);

  // Paleta: siempre 12 (se repite en ciclo), con la tinta para escribir ENCIMA de
  // cada color y su versión legible como texto sobre la tarjeta.
  const paleta = t.paleta.length ? t.paleta : [t.colores.acento];
  v['--gm-paleta-n'] = String(paleta.length);
  for (let i = 1; i <= 12; i++) {
    const c = paleta[(i - 1) % paleta.length];
    v['--gm-paleta-' + i] = c;
    v['--gm-paleta-' + i + '-texto'] = tintaSobre(c);
    v['--gm-paleta-' + i + '-legible'] = legible(c, lectura, 4.5);
  }

  CACHE.set(t, v);
  return v;
}

/**
 * Las variables como `style` inline para la raíz .gm-doc. Sin comillas dobles ni
 * ángulos (no hay valores con eso; igual se filtran): el string va dentro de un
 * atributo. En React se usa `varsDeTema` como objeto de estilo.
 */
export function estiloDeTema(t: Tema): string {
  return Object.entries(varsDeTema(t))
    .map(([k, val]) => k + ':' + val.replace(/[<>"]/g, ''))
    .join(';');
}

/**
 * Las variables que una sección necesita cuando su fondo NO es el del tema
 * (data-fondo="color" o "degradado"): el fondo, y la tinta recalculada para que el
 * texto se lea sobre ESE color. Las escribe quien arma la sección (render.ts y el
 * NodeView de la tarjeta) en el `style` del <section>; con data-fondo="acento" no
 * hace falta, porque la hoja lo resuelve sola con --gm-acento-contraste.
 */
export function varsDeFondoPropio(t: Tema, relleno: Relleno): Record<string, string> {
  const r = rellenoValido(relleno);
  if (!r) return {};
  const paradas = coloresDeRelleno(r);
  const rep = colorDeRelleno(r);
  const claro = luminancia(rep) > 0.35;
  const texto = contrasteMinimo(t.colores.texto, paradas) >= 4.5 ? t.colores.texto : claro ? '#161616' : '#f5f5f5';
  const titulo = esDegradado(t.colores.titulo) || contrasteMinimo(t.colores.titulo, paradas) < 3 ? (claro ? '#111111' : '#ffffff') : t.colores.titulo;
  return {
    '--gm-tarjeta-fondo': r,
    '--gm-tarjeta-color': rep,
    '--gm-tarjeta-filtro': 'none',
    '--gm-texto': texto,
    '--gm-texto-tenue': rgba(texto, 0.72),
    '--gm-titulo': titulo,
    '--gm-titulo-degradado': 'none',
    '--gm-titulo-relleno': titulo,
    '--gm-titulo-sangrado': '0em',
    '--gm-acento-texto': legible(t.colores.acento, paradas, 4.5),
    '--gm-enlace': legible(t.colores.enlace, paradas, 4.5),
    '--gm-borde-neutro': claro ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.24)',
    '--gm-superficie': mezclar(rep, texto, 0.08),
    // La cebra de las tablas y el recuadro «tenue» salen de acá: sin redefinirla, una sección con
    // fondo OSCURO heredaba la cebra clara del tema y sus filas pares quedaban casi blancas con el
    // texto claro encima (medido el 11/10/2026 con la Tabla 3×3 sobre #292a2e). Misma cuenta que el tema.
    '--gm-cebra': mezclar(rep, texto, 0.035),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Google Fonts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * UN link css2 con todas las familias de los temas dados y sólo los pesos que
 * usan (título, cuerpo y la negrita del cuerpo), ordenados como exige la API.
 * '' si no hay ninguna familia del catálogo.
 */
export function urlFuentes(temas: readonly Tema[]): string {
  const pesos = new Map<string, Set<number>>();
  const sumar = (familia: string, peso: number) => {
    if (!FUENTES[familia]) return;
    if (!pesos.has(familia)) pesos.set(familia, new Set());
    pesos.get(familia)!.add(pesoDisponible(familia, peso));
  };
  for (const t of temas) {
    sumar(t.fuentes.titulo.familia, t.fuentes.titulo.peso);
    sumar(t.fuentes.cuerpo.familia, t.fuentes.cuerpo.peso);
    sumar(t.fuentes.cuerpo.familia, 700);
  }
  if (!pesos.size) return '';
  const familias = [...pesos.keys()].sort().map((f) =>
    'family=' + f.replace(/ /g, '+') + ':wght@' + [...pesos.get(f)!].sort((a, b) => a - b).join(';'),
  );
  return 'https://fonts.googleapis.com/css2?' + familias.join('&') + '&display=swap';
}
