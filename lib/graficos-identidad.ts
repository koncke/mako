// =============================================================================
// graficos-identidad — el COLOR de cada plantilla y su portada, en UNA tabla para las dos galerías
// =============================================================================
// Martín, 14/10/2026, mirando las galerías del Dashboard y de General: «todos parecen muy iguales porque tienen el mismo
// diseño de color», «A simple vista se tienen que diferenciar MUY bien de qué es cada template… en cada template al
// principio… sea muy épico y que se note el objetivo del template con un vistazo… También puedes jugar con los COLORES…
// el de WhatsApp, puede tener un color más característico de WhatsApp». Y el 15/10, al ver la galería sin cambios: «No
// está en producción lo último si pedí que se rediseñaran...».
//
// COPIADO DE LA GALERÍA DE PLANTILLAS DE CANVA (búsquedas «dashboard» y «report cover», abiertas el 15/10/2026; las
// capturas en el arnés, `C:/Users/marti/arnes-dashboard/referencias/`). Lo que separa una plantilla de otra en su
// miniatura NO es el título: es la PORTADA, como la de un informe —el color a sangre que ocupa casi todo el cuadro, UN
// titular gigante y UNA imagen—. Las de Canva que se confunden entre sí son justo las que muestran muchos gráficos chicos
// sobre blanco (la queja de Martín: «muchos gráficos juntos parece dashboard»). Se copia la ESTRUCTURA: el color, el
// titular y la forma de fondo; los colores son de esta tabla y la letra es la de la hoja.
//
// UNA portada es UNA pieza de la hoja (un gráfico o un bloque de General) con `portada: <id de identidad>`: la tarjeta se
// pinta con el color y lo que va adentro se dibuja sobre él (app/dashboard/editor-css.ts redefine la tinta y los grises
// adentro, como el fondo «Oscuro» de un bloque de General). No inventa un cálculo: es un gráfico que ya existe, con los
// datos que ya se leen, que se puede mover, editar o borrar como cualquier otro.
//
// LAS REGLAS DE LA TABLA (acordadas entre los chats Dashboard y General el 15/10):
//   · el MISMO TEMA lleva el MISMO COLOR en las dos galerías (WhatsApp verde en «Chat Analyst» y en «Ventas por
//     WhatsApp», azul Meta en «Marketing» y «Anuncios», ámbar en las dos de cobranza…);
//   · adentro de una galería NINGUNO se repite (lo mide tests/graficos-portadas.test.ts);
//   · el color NUNCA es lo único que distingue: cada portada tiene su forma (un número, un embudo, personas, una curva).
// ⚠️ EN HEX, COMO LAS PALETAS DE LIB/GRAFICOS-TEMAS.TS: el color de una portada es el mismo en claro y en oscuro (es una
//    pieza pintada, como la portada de un informe), y la tinta se eligió para leerse sobre él: el test mide el contraste
//    (4,5 para la letra chica). Ninguno es el hex de la marca de otra app.
// ⚠️ Puro y sin server-only: lo leen el catálogo (el saneo), la pantalla, las plantillas y los tests.
// =============================================================================

/** La forma grande de fondo de la portada (la ola, el círculo de las portadas de Canva). */
export type FormaPortada = 'circulo' | 'diagonal' | 'arco' | 'play' | 'burbuja';

export type Identidad = {
  id: string;
  nombre: string;
  /** El color de la portada. */
  fondo: string;
  /** La letra y lo que se dibuja sobre él. */
  tinta: string;
  forma: FormaPortada;
};

export const IDENTIDADES: readonly Identidad[] = [
  { id: 'azul-meta', nombre: 'Azul Meta', fondo: '#1F5FE0', tinta: '#FFFFFF', forma: 'circulo' },
  { id: 'dorado', nombre: 'Dorado MaKo', fondo: '#F2B01E', tinta: '#2A1E04', forma: 'diagonal' },
  { id: 'coral', nombre: 'Coral', fondo: '#F46F5E', tinta: '#2B0B06', forma: 'arco' },
  { id: 'celeste', nombre: 'Celeste', fondo: '#62C3EE', tinta: '#062437', forma: 'circulo' },
  { id: 'rojo-play', nombre: 'Rojo play', fondo: '#D42A22', tinta: '#FFFFFF', forma: 'play' },
  { id: 'verde-wa', nombre: 'Verde WhatsApp', fondo: '#107E41', tinta: '#FFFFFF', forma: 'burbuja' },
  { id: 'violeta', nombre: 'Violeta', fondo: '#6C47D6', tinta: '#FFFFFF', forma: 'arco' },
  { id: 'teal', nombre: 'Teal', fondo: '#0B7C7E', tinta: '#FFFFFF', forma: 'diagonal' },
  { id: 'lima', nombre: 'Lima', fondo: '#B5DD4C', tinta: '#1B2905', forma: 'circulo' },
  { id: 'azul-oscuro', nombre: 'Azul oscuro', fondo: '#152542', tinta: '#FFFFFF', forma: 'diagonal' },
  { id: 'ambar', nombre: 'Ámbar', fondo: '#EE7F22', tinta: '#2A1303', forma: 'circulo' },
  { id: 'indigo', nombre: 'Índigo', fondo: '#3438B0', tinta: '#FFFFFF', forma: 'circulo' },
  { id: 'durazno', nombre: 'Durazno', fondo: '#FFBE9C', tinta: '#3A1708', forma: 'arco' },
  { id: 'magenta', nombre: 'Magenta', fondo: '#C42B7F', tinta: '#FFFFFF', forma: 'circulo' },
  { id: 'noche', nombre: 'Noche', fondo: '#12161F', tinta: '#FFFFFF', forma: 'arco' },
];

const POR_ID: ReadonlyMap<string, Identidad> = new Map(IDENTIDADES.map((x) => [x.id, x]));

/** La identidad de un id, o null (un id que no existe no pinta nada: el saneo lo tira). */
export const identidadDe = (id: unknown): Identidad | null => (typeof id === 'string' ? POR_ID.get(id) ?? null : null);

/** El color de cada plantilla del Dashboard (lib/graficos-plantillas.ts), por su id. */
export const COLOR_DASHBOARD: Readonly<Record<string, string>> = {
  marketing: 'azul-meta',
  comercial: 'dorado',
  'ads-analyst': 'coral',
  landing: 'celeste',
  'vsl-analyst': 'rojo-play',
  'chat-analyst': 'verde-wa',
  closing: 'violeta',
  'cs-analyst': 'teal',
  productividad: 'lima',
  crm: 'azul-oscuro',
  cobranza: 'ambar',
  automatizaciones: 'indigo',
  'ia-contenido': 'durazno',
};

/**
 * El color de cada plantilla de General (lib/general-plantillas.ts). «General» va en Noche: es el único color libre que
 * no nombra otro tema del Dashboard (el dorado es de las ventas), y la meta de siempre era el hero oscuro.
 */
export const COLOR_GENERAL: Readonly<Record<string, string>> = {
  general: 'noche',
  bienvenida: 'durazno',
  foco: 'lima',
  operacion: 'indigo',
  ventas: 'dorado',
  cobros: 'ambar',
  anuncios: 'azul-meta',
  'funnel-llamadas': 'violeta',
  'funnel-whatsapp': 'verde-wa',
  lanzamiento: 'rojo-play',
  servicio: 'teal',
  curso: 'celeste',
  instagram: 'magenta',
};

/**
 * Las variables CSS de una portada (en el `style` de su tarjeta): el color, la tinta y sus grises. Adentro, la hoja de
 * estilos del editor redefine con ellas los tokens de la casa (`--ink`, `--dim`, `--border`…), así un gráfico o un bloque
 * que usa los tokens se dibuja sobre el color sin saberlo.
 */
export function varsDePortada(id: unknown): Record<string, string> | null {
  const x = identidadDe(id);
  if (!x) return null;
  return { '--portada-fondo': x.fondo, '--portada-tinta': x.tinta };
}

/**
 * Los colores de las series sobre una portada: la tinta y sus mezclas con el fondo. Sobre un color fuerte una serie de
 * otro color pelea con él; en tonos de la tinta se lee como la imagen de una portada.
 */
export function paletaDePortada(id: unknown): string[] | null {
  const x = identidadDe(id);
  if (!x) return null;
  return [1, 0.72, 0.5, 0.34, 0.86, 0.6, 0.42, 0.26].map((k) => mezclar(x.tinta, x.fondo, k));
}

/** `a` mezclado con `b` (k = cuánto de `a`), en hex: recharts no lee `color-mix`. */
export function mezclar(a: string, b: string, k: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `#${x.map((v, i) => Math.round(v * k + y[i] * (1 - k)).toString(16).padStart(2, '0')).join('')}`;
}

/** El contraste WCAG entre dos hex (lo usa el test). */
export function contraste(a: string, b: string): number {
  const lum = (h: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [l1, l2] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** El papel de lo que se recorta sobre una portada (los trapecios de un embudo): blanco en claro y en oscuro. */
export const PAPEL = '#FFFFFF';

/** El tope del número de una portada (px): el doble del épico de una tarjeta (ESCALA_EPICA, lib/graficos-gordo.ts). */
export const MAXIMO_PORTADA = 220;

/** Las dimensiones que son PERSONAS: sobre una portada, su lista lleva el avatar con las iniciales (no hay fotos: se midió). */
export const DIMENSIONES_PERSONA: ReadonlySet<string> = new Set(['cliente', 'lead', 'alumno', 'persona', 'closer', 'quien']);

/** Las iniciales de un nombre («Ana Gómez» → «AG»; «ana@x.com» → «A»). */
export function iniciales(nombre: string): string {
  const partes = nombre.replace(/[@(].*$/, '').trim().split(/\s+/).filter((p) => /\p{L}/u.test(p));
  const letras = partes.slice(0, 2).map((p) => [...p.replace(/^[^\p{L}]+/u, '')][0] ?? '');
  return letras.join('').toLocaleUpperCase('es') || '·';
}

/**
 * Lo que una tarjeta necesita para ser portada: su clase, sus variables y su forma. Lo usan los tres que dibujan una
 * tarjeta de la hoja (el editor, la miniatura de la galería y el arnés de capturas), así no se separan.
 */
export function marcoDePortada(c: object): { clase: string; estilo: Record<string, string>; forma: FormaPortada } | null {
  const x = identidadDe((c as { portada?: unknown }).portada);
  if (!x) return null;
  return { clase: 'lk-comp--portada', estilo: { '--portada-fondo': x.fondo, '--portada-tinta': x.tinta }, forma: x.forma };
}

/** El alto de una portada en la pila del celular (filas): la del escritorio es para una página ancha. */
export const FILAS_PORTADA_EN_PILA = 9;
