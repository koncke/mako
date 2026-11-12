// =============================================================================
// carruseles/documento — el documento del Image Editor de un carrusel de MaKo (una página por lámina)
// =============================================================================
// Arma, sin el motor (que es sólo de cliente), el documento que abre el editor: 1080 × 1350 (4:5, el tamaño de un carrusel
// de Instagram), una página por lámina de ./tipos.ts, con el estilo del tipo. Cada página trae lo que la skill de carruseles
// pide en todas (docs/plantillas-reales/README.md, `instagram-carousel-skill`, MIT, su licencia en lib/avisos/LICENSE-INSTAGRAM-CAROUSEL-SKILL): la cabecera con las iniciales y el @ del
// negocio, la barra de progreso, la flecha (menos en la última) y la última lámina con otro fondo, la de la acción.
//
// Los objetos tienen la forma que guarda el motor (la de `DoryDocument`: `textbox`, `rect`,
// `ellipse`), con NOMBRES por función («Titular», «Texto», «Cabecera»…): así el chat del editor los encuentra por su nombre.
// La miniatura y «Ver ejemplo» (app/image-editor/carruseles/MiniaturaCarrusel.tsx) dibujan ESTE documento, no una copia.
//
// Puro: el id de cada objeto lo da quien llama (`nuevoId`), para que el server use `randomUUID` y los tests uno fijo.
// =============================================================================

import type { EstiloCarrusel, Lamina } from './tipos';

export const ANCHO_CARRUSEL = 1080;
export const ALTO_CARRUSEL = 1350;
const MARGEN = 96;

/**
 * Quién firma el carrusel. `logo` (5/11/2026): el logo del kit de marca del negocio (lib/marca/kits.ts), un archivo de
 * «Subidos». Con logo, la cabecera lo lleva en lugar del círculo con las iniciales.
 */
export type Marca = { nombre: string; usuario: string | null; logo?: { id: string; url: string; nombre: string; ancho: number; alto: number } | null };

type Obj = Record<string, unknown>;

export const familia = (f: { familia: string; respaldo: string }) => `"${f.familia}", ${f.respaldo}`;

/** Lo común de todo objeto, como lo guarda el motor. */
const BASE: Obj = {
  stroke: null, strokeWidth: 0, strokeDashArray: null, strokeLineCap: 'butt', strokeDashOffset: 0, strokeLineJoin: 'miter',
  strokeUniform: true, strokeMiterLimit: 4, scaleX: 1, scaleY: 1, angle: 0, flipX: false, flipY: false, opacity: 1, shadow: null,
  visible: true, backgroundColor: '', fillRule: 'nonzero', paintFirst: 'fill', globalCompositeOperation: 'source-over', skewX: 0, skewY: 0,
};

/** El alto aproximado de un texto (el motor lo vuelve a medir al abrir): líneas × tamaño × interlineado. */
export function altoDeTexto(texto: string, tam: number, ancho: number, interlineado: number): number {
  const porLinea = Math.max(1, Math.floor(ancho / (tam * 0.52)));
  const lineas = texto.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(Array.from(l).length / porLinea)), 0);
  return Math.round(lineas * tam * interlineado * 100) / 100;
}

/**
 * El alto de un texto con letra de `tam` px, contando 0,58 del tamaño por carácter (una letra gruesa es ancha). Sobra un poco
 * a propósito: mejor que quede aire que un texto que se sale de la lámina (el motor lo vuelve a medir al abrir).
 */
export function altoEstimado(t: string, tam: number, ancho: number, interlineado: number): number {
  const porLinea = Math.max(1, Math.floor(ancho / (tam * 0.58)));
  const lineas = t.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(Array.from(l).length / porLinea)), 0);
  return Math.round(lineas * tam * interlineado);
}

/** La letra más grande (entre `min` y `max`) con la que el texto entra en `alto` px: así el texto LLENA la lámina en vez de quedar chiquito. */
export function tamanoQueLlena(t: string, o: { ancho: number; alto: number; min: number; max: number; interlineado: number }): number {
  let lo = o.min;
  let hi = Math.max(o.min, o.max);
  while (lo < hi) {
    const m = Math.ceil((lo + hi) / 2);
    if (altoEstimado(t, m, o.ancho, o.interlineado) <= o.alto) lo = m; else hi = m - 1;
  }
  return lo;
}

/**
 * Un texto del documento.
 *
 * ⚠️ `italica` (7/11/2026): hasta hoy `fontStyle` estaba CLAVADO en `'normal'`, así que ningún
 * carrusel podía llevar una itálica aunque el motor sí la sabe pintar (`pickVariant` de
 * `engine/fonts.ts` resuelve `'normal' | 'italic'`) y el catálogo sí las tiene (Playfair Display
 * trae itálica en los seis pesos). Al copiar una referencia real eso no es un detalle: el titular
 * del ejemplo —la palabra «font»— es una itálica serif de alto contraste, y sin esto salía redonda.
 */
export function texto(id: string, nombre: string, t: string, o: {
  left: number; top: number; width: number; tam: number; peso: number; fam: string; color: string; alin?: 'left' | 'center' | 'right'; interlineado?: number; espaciado?: number; mayus?: boolean; italica?: boolean;
  /** El alto MEDIDO (./medir-letra.ts: el que le da el editor). Sin esto, el estimado de siempre. */
  alto?: number;
}): Obj {
  const inter = o.interlineado ?? 1.2;
  return {
    fontSize: o.tam, fontWeight: o.peso, fontFamily: o.fam, fontStyle: o.italica ? 'italic' : 'normal', lineHeight: inter, text: o.mayus ? t.toUpperCase() : t,
    charSpacing: o.espaciado ?? 0, textAlign: o.alin ?? 'left', styles: [], pathStartOffset: 0, pathSide: 'left', pathAlign: 'baseline',
    underline: false, overline: false, linethrough: false, textBackgroundColor: '', direction: 'ltr', textDecorationThickness: 66.667,
    minWidth: 20, splitByGrapheme: false, id, name: nombre, type: 'textbox', originX: 'left', originY: 'top',
    left: o.left, top: o.top, width: o.width, height: o.alto ?? altoDeTexto(t, o.tam, o.width, inter), fill: o.color,
    ...BASE, strokeWidth: 1,
    ...(o.mayus ? { textCase: 'upper', caseSource: t } : {}),
  };
}

export function rect(id: string, nombre: string, o: { left: number; top: number; width: number; height: number; fill: string; radio?: number }): Obj {
  return {
    rx: o.radio ?? 0, ry: o.radio ?? 0, id, name: nombre, type: 'rect', originX: 'left', originY: 'top',
    left: o.left, top: o.top, width: o.width, height: o.height, fill: o.fill, ...BASE,
  };
}

function circulo(id: string, nombre: string, o: { cx: number; cy: number; r: number; fill: string }): Obj {
  return {
    rx: o.r, ry: o.r, id, name: nombre, shapeKind: 'ellipse', type: 'ellipse', originX: 'center', originY: 'center',
    left: o.cx, top: o.cy, width: o.r * 2, height: o.r * 2, fill: o.fill, ...BASE,
  };
}

/** El logo, entero adentro de un cuadrado de `lado` (sin recortarlo), con la forma de imagen que guarda el motor. */
function logo(id: string, l: NonNullable<Marca['logo']>, o: { left: number; top: number; lado: number }): Obj {
  const ancho = l.ancho > 0 ? l.ancho : o.lado;
  const alto = l.alto > 0 ? l.alto : o.lado;
  const escala = Math.min(o.lado / ancho, o.lado / alto);
  return {
    type: 'image', id, name: 'Cabecera: logo', src: l.url, assetId: l.id, crossOrigin: 'anonymous',
    originX: 'left', originY: 'top', left: Math.round((o.left + (o.lado - ancho * escala) / 2) * 10) / 10,
    top: Math.round((o.top + (o.lado - alto * escala) / 2) * 10) / 10, width: ancho, height: alto, cropX: 0, cropY: 0,
    scaleX: escala, scaleY: escala, angle: 0, opacity: 1, visible: true, strokeUniform: true,
  };
}

/** Las iniciales del negocio para el círculo de la cabecera («Cierre Consultivo» → «CC»), sin partir un emoji. */
export function inicialesDe(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  const letras = palabras.slice(0, 2).map((p) => Array.from(p)[0] ?? '').join('');
  return (letras || '·').toUpperCase();
}

/** ¿Un color es oscuro? (para elegir la tinta de las iniciales sobre el acento). */
export function esOscuro(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 140;
}

/** Una página del carrusel: la lámina `i` de `total`, con su estilo y la cabecera del negocio. */
function pagina(l: Lamina, i: number, total: number, e: EstiloCarrusel, marca: Marca, nuevoId: () => string, notas?: string): Obj {
  const cierre = l.rol === 'cierre';
  const portada = l.rol === 'portada';
  const fondo = cierre ? e.fondoCierre : e.fondo;
  const tinta = cierre ? e.tintaCierre : e.tinta;
  const suave = cierre ? e.tintaCierre : e.suave;
  const famT = familia(e.titular);
  const famX = familia(e.texto);
  const ancho = ANCHO_CARRUSEL - MARGEN * 2;
  const objetos: Obj[] = [];

  // La cabecera: las iniciales en un círculo con el acento (o el logo de la marca), el nombre y el @ (Martín: «con los datos
  // del negocio»).
  if (marca.logo) objetos.push(logo(nuevoId(), marca.logo, { left: MARGEN, top: MARGEN, lado: 72 }));
  else {
    objetos.push(circulo(nuevoId(), 'Cabecera: círculo', { cx: MARGEN + 36, cy: MARGEN + 36, r: 36, fill: e.acento }));
    objetos.push(texto(nuevoId(), 'Cabecera: iniciales', inicialesDe(marca.nombre), { left: MARGEN, top: MARGEN + 20, width: 72, tam: 28, peso: 700, fam: famX, color: esOscuro(e.acento) ? '#FFFFFF' : '#111111', alin: 'center', interlineado: 1.1 }));
  }
  objetos.push(texto(nuevoId(), 'Cabecera: nombre', marca.nombre, { left: MARGEN + 92, top: MARGEN + 4, width: ancho - 92, tam: 30, peso: 600, fam: famX, color: tinta, interlineado: 1.15 }));
  if (marca.usuario) objetos.push(texto(nuevoId(), 'Cabecera: usuario', `@${marca.usuario}`, { left: MARGEN + 92, top: MARGEN + 42, width: ancho - 92, tam: 26, peso: 400, fam: famX, color: suave, interlineado: 1.15 }));

  // Los textos LLENAN la lámina (6/11/2026: «texto chiquito, mucho vacío»): el titular toma la letra más grande que entra, la
  // bajada va justo debajo y todo el bloque queda centrado entre la cabecera y la flecha.
  const ZONA_ARRIBA = 300;
  const ZONA_ABAJO = 1120;
  const titularInter = portada ? 1.05 : 1.08;
  const tamTitular = tamanoQueLlena(l.titulo, portada
    ? { ancho, alto: 640, min: 84, max: 150, interlineado: titularInter }
    : { ancho, alto: cierre ? 420 : 400, min: 64, max: cierre ? 120 : 108, interlineado: titularInter });
  const altoTitular = altoEstimado(l.titulo, tamTitular, ancho, titularInter);
  const HUECO = 44;
  const topCuerpoMax = ZONA_ABAJO;
  const tamCuerpo = l.cuerpo ? tamanoQueLlena(l.cuerpo, { ancho, alto: Math.max(120, topCuerpoMax - ZONA_ARRIBA - altoTitular - HUECO), min: 40, max: portada ? 54 : 62, interlineado: 1.3 }) : 0;
  const altoCuerpo = l.cuerpo ? altoEstimado(l.cuerpo, tamCuerpo, ancho, 1.3) : 0;
  const bloque = altoTitular + (l.cuerpo ? HUECO + altoCuerpo : 0);
  const arriba = Math.max(ZONA_ARRIBA, Math.round(ZONA_ARRIBA + (ZONA_ABAJO - ZONA_ARRIBA - bloque) / 2));
  if (!portada && !cierre) objetos.push(texto(nuevoId(), 'Rótulo', l.rotulo, { left: MARGEN, top: arriba - 70, width: ancho, tam: 28, peso: 700, fam: famX, color: e.acento, espaciado: 120, mayus: true, interlineado: 1.1 }));
  objetos.push(texto(nuevoId(), 'Titular', l.titulo, { left: MARGEN, top: arriba, width: ancho, tam: tamTitular, peso: e.titular.peso, fam: famT, color: tinta, interlineado: titularInter }));
  if (l.cuerpo) objetos.push(texto(nuevoId(), portada ? 'Bajada' : 'Texto', l.cuerpo, { left: MARGEN, top: arriba + altoTitular + HUECO, width: ancho, tam: tamCuerpo, peso: e.texto.peso, fam: famX, color: suave, interlineado: 1.3 }));
  if (portada) objetos.push(texto(nuevoId(), 'Desliza', 'Desliza →', { left: MARGEN, top: 1176, width: 420, tam: 32, peso: 600, fam: famX, color: e.acento, interlineado: 1.1 }));

  // La barra de progreso (abajo, del ancho de lo que lleva leído) y la flecha (menos en la última).
  objetos.push(rect(nuevoId(), 'Barra de progreso', { left: 0, top: ALTO_CARRUSEL - 10, width: Math.round((ANCHO_CARRUSEL * (i + 1)) / total), height: 10, fill: e.acento }));
  if (i < total - 1) objetos.push(texto(nuevoId(), 'Flecha', '→', { left: ANCHO_CARRUSEL - MARGEN - 120, top: 1160, width: 120, tam: 64, peso: 700, fam: famX, color: e.acento, alin: 'right', interlineado: 1 }));

  return { id: nuevoId(), name: l.rotulo, background: { type: 'solid', color: fondo }, objects: objetos, ...(notas ? { notes: notas } : {}) };
}

/**
 * El documento entero de un carrusel. `notas` va en la PRIMERA página (de dónde salió la estructura, cuando es «Hacer el
 * mío»): las notas no salen en la imagen.
 */
export function documentoDeCarrusel(o: { laminas: readonly Lamina[]; estilo: EstiloCarrusel; marca: Marca; nuevoId: () => string; notas?: string }): Record<string, unknown> {
  const total = o.laminas.length;
  return {
    schemaVersion: 1,
    width: ANCHO_CARRUSEL,
    height: ALTO_CARRUSEL,
    unit: 'px',
    pages: o.laminas.map((l, i) => pagina(l, i, total, o.estilo, o.marca, o.nuevoId, i === 0 ? o.notas : undefined)),
  };
}
