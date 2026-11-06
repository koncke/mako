// =============================================================================
// carruseles/documento — el documento del Image Editor de un carrusel de MaKo (una página por lámina)
// =============================================================================
// Arma, sin el motor (que es sólo de cliente), el documento que abre el editor: 1080 × 1350 (4:5, el tamaño de un carrusel
// de Instagram), una página por lámina de ./tipos.ts, con el estilo del tipo. Cada página trae lo que la skill de carruseles
// pide en todas (docs/plantillas-reales/README.md, `instagram-carousel-skill`, MIT, su licencia en lib/avisos/LICENSE-INSTAGRAM-CAROUSEL-SKILL): la cabecera con las iniciales y el @ del
// negocio, la barra de progreso, la flecha (menos en la última) y la última lámina con otro fondo, la de la acción.
//
// Los objetos tienen la forma que guarda el motor (las de app/image-editor/mako/plantillas/*.json: `textbox`, `rect`,
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

export function texto(id: string, nombre: string, t: string, o: {
  left: number; top: number; width: number; tam: number; peso: number; fam: string; color: string; alin?: 'left' | 'center' | 'right'; interlineado?: number; espaciado?: number; mayus?: boolean;
}): Obj {
  const inter = o.interlineado ?? 1.2;
  return {
    fontSize: o.tam, fontWeight: o.peso, fontFamily: o.fam, fontStyle: 'normal', lineHeight: inter, text: o.mayus ? t.toUpperCase() : t,
    charSpacing: o.espaciado ?? 0, textAlign: o.alin ?? 'left', styles: [], pathStartOffset: 0, pathSide: 'left', pathAlign: 'baseline',
    underline: false, overline: false, linethrough: false, textBackgroundColor: '', direction: 'ltr', textDecorationThickness: 66.667,
    minWidth: 20, splitByGrapheme: false, id, name: nombre, type: 'textbox', originX: 'left', originY: 'top',
    left: o.left, top: o.top, width: o.width, height: altoDeTexto(t, o.tam, o.width, inter), fill: o.color,
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

  if (portada) {
    objetos.push(texto(nuevoId(), 'Titular', l.titulo, { left: MARGEN, top: 400, width: ancho, tam: 96, peso: e.titular.peso, fam: famT, color: tinta, interlineado: 1.05 }));
    if (l.cuerpo) objetos.push(texto(nuevoId(), 'Bajada', l.cuerpo, { left: MARGEN, top: 820, width: ancho, tam: 40, peso: e.texto.peso, fam: famX, color: suave, interlineado: 1.3 }));
    objetos.push(texto(nuevoId(), 'Desliza', 'Desliza →', { left: MARGEN, top: 1176, width: 420, tam: 32, peso: 600, fam: famX, color: e.acento, interlineado: 1.1 }));
  } else {
    if (!cierre) objetos.push(texto(nuevoId(), 'Rótulo', l.rotulo, { left: MARGEN, top: 300, width: ancho, tam: 26, peso: 700, fam: famX, color: e.acento, espaciado: 120, mayus: true, interlineado: 1.1 }));
    objetos.push(texto(nuevoId(), 'Titular', l.titulo, { left: MARGEN, top: cierre ? 470 : 360, width: ancho, tam: cierre ? 84 : 72, peso: e.titular.peso, fam: famT, color: tinta, interlineado: 1.08 }));
    if (l.cuerpo) objetos.push(texto(nuevoId(), 'Texto', l.cuerpo, { left: MARGEN, top: cierre ? 800 : 690, width: ancho, tam: 42, peso: e.texto.peso, fam: famX, color: suave, interlineado: 1.35 }));
  }

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
