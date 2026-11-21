// =============================================================================
// image-editor/contraste — que cada texto SE LEA sobre lo que tiene detrás, MEDIDO (PURO; 20/11/2026)
// =============================================================================
// La llamada con Leila (20/11/2026, Fathom 205366178, 00:51:37): «No se lee, digo, y le puse a aumentar contraste». «Mejora el
// contraste» era un pedido a la IA del chat (app/image-editor/mako/chat/PanelMakoIA.tsx): la IA mira un JSON con colores, no ve la
// foto de fondo, propone otro color y NADIE MIDE después si se lee. En su carrusel (ws 11, 14331b1a), letra crema #F3EEE2 sobre
// fotos claras del banco, y en las láminas agregadas sobre blanco puro (contraste 1,1).
//
// LO QUE HACE ESTO, sin IA:
//   · el fondo de cada texto se MIDE en píxeles (lo dibuja el navegador sin los textos: app/image-editor/mako/chat/contraste.ts) y
//     se resume en `FondoMedido` (la luminancia de lo más claro y lo más oscuro que tiene detrás, sin las motas: p15 y p85);
//   · `contrasteDelTexto` es el PEOR contraste del color del texto contra ese fondo (WCAG 2): un texto claro se mide contra lo más
//     claro de su foto, uno oscuro contra lo más oscuro;
//   · `queHacer`: si no llega al objetivo, primero blanco o casi negro (el que se lea mejor); si ninguno alcanza (una foto con zonas
//     claras y oscuras, un blur con luces), letra blanca y un VELO oscuro detrás del texto, con la opacidad justa para llegar;
//   · `arreglarContraste` lo aplica al documento y devuelve qué cambió, con el contraste de antes y el de después: «medir después».
// =============================================================================

type Obj = Record<string, unknown>;

/** Lo que hay detrás de un texto, medido: luminancias relativas (0 a 1) de lo oscuro (p15), lo claro (p85) y el promedio. */
export type FondoMedido = { oscuro: number; claro: number; media: number };

/** El contraste que pide un texto común (WCAG AA). Un titular grande se lee con 3, pero un carrusel se mira en un teléfono. */
export const CONTRASTE_OBJETIVO = 4.5;
/** Debajo de esto un texto NO se lee: se arregla aunque nadie lo pida (al aceptar una propuesta del chat). */
export const CONTRASTE_MINIMO = 3;

const canal = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
/** La luminancia relativa (WCAG 2) de un RGB 0-255. */
export const luminanciaRgb = (r: number, g: number, b: number): number => 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);

/** Un color CSS simple (#RGB, #RRGGBB, rgb(), rgba()) a RGB, o null si no se entiende (un degradé, un nombre). */
export function rgbDe(color: unknown): [number, number, number] | null {
  const s = String(color ?? '').trim();
  let m = /^#([0-9a-f]{3})$/i.exec(s);
  if (m) return [0, 1, 2].map((i) => parseInt(m![1][i] + m![1][i], 16)) as [number, number, number];
  m = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(s);
  if (m) { const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(s);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

export const luminanciaDe = (color: unknown): number | null => { const c = rgbDe(color); return c ? luminanciaRgb(...c) : null; };
const contraste = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** Las luminancias de los píxeles de detrás de un texto, resumidas. Sin píxeles: null. */
export function fondoDe(luminancias: readonly number[]): FondoMedido | null {
  if (!luminancias.length) return null;
  const orden = [...luminancias].sort((a, b) => a - b);
  const en = (p: number) => orden[Math.min(orden.length - 1, Math.max(0, Math.round(p * (orden.length - 1))))];
  return { oscuro: en(0.15), claro: en(0.85), media: orden.reduce((s, x) => s + x, 0) / orden.length };
}

/** Un fondo liso de un color (una pastilla, el resaltado del texto). */
export const fondoLiso = (color: unknown): FondoMedido | null => { const l = luminanciaDe(color); return l == null ? null : { oscuro: l, claro: l, media: l }; };

/** El PEOR contraste de un color de texto contra su fondo medido: contra lo más claro y lo más oscuro que tiene detrás. */
export function contrasteDelTexto(color: unknown, f: FondoMedido): number | null {
  const l = luminanciaDe(color);
  return l == null ? null : Math.min(contraste(l, f.oscuro), contraste(l, f.claro));
}

const BLANCO = '#FFFFFF';
const NEGRO = '#111111';

/** Lo que hace falta para que se lea: otro color, y si ni así, un velo oscuro (su opacidad) detrás del texto en blanco. */
export type Arreglo = { color: string; velo: number | null; antes: number; despues: number };

/** El fondo con un velo negro de opacidad `a` encima (la mezcla es en sRGB: cada canal × (1 − a); en luminancia, ~(1 − a)^2,2). */
const conVelo = (f: FondoMedido, a: number): FondoMedido => {
  const k = (1 - a) ** 2.2;
  return { oscuro: f.oscuro * k, claro: f.claro * k, media: f.media * k };
};

/**
 * Qué hacer con un texto de color `color` sobre el fondo `f` para llegar a `objetivo`. null = ya se lee (o el color no se entiende).
 * Primero el mismo diseño con otra tinta (blanco o casi negro, el que mejor se lea); si ninguna llega, blanco con un velo oscuro
 * con la opacidad justa (entre 0,25 y 0,8).
 */
export function queHacer(color: unknown, f: FondoMedido, objetivo = CONTRASTE_OBJETIVO): Arreglo | null {
  const antes = contrasteDelTexto(color, f);
  if (antes == null || antes >= objetivo) return null;
  const blanco = contrasteDelTexto(BLANCO, f)!;
  const negro = contrasteDelTexto(NEGRO, f)!;
  const mejor = blanco >= negro ? { color: BLANCO, c: blanco } : { color: NEGRO, c: negro };
  if (mejor.c >= objetivo) return { color: mejor.color, velo: null, antes, despues: mejor.c };
  // El blanco necesita que lo más claro de detrás baje a (1,05 / objetivo) − 0,05.
  const tope = 1.05 / objetivo - 0.05;
  const a = Math.min(0.8, Math.max(0.25, 1 - Math.pow(tope / Math.max(1e-6, f.claro), 1 / 2.2)));
  return { color: BLANCO, velo: Math.round(a * 100) / 100, antes, despues: contrasteDelTexto(BLANCO, conVelo(f, a))! };
}

/** Un cambio hecho, para decirlo: qué texto, el color de antes y el de ahora, si lleva velo, y los contrastes medidos. */
export type CambioDeContraste = { id: string; texto: string; antes: string; despues: string; velo: number | null; contrasteAntes: number; contrasteDespues: number };

/** El nombre del velo: así el chat lo encuentra («el velo») y un segundo arreglo no le pone otro encima. */
export const NOMBRE_VELO = 'Velo para que se lea';

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const esTexto = (o: Obj) => /text/i.test(String(o.type ?? ''));

/**
 * Aplica los arreglos a una copia del documento: el color del texto (y sus letras de acento, si no se leían) y, si hace falta, un
 * velo redondeado DEBAJO del texto, de su tamaño con un margen. `fondos` es lo medido de cada texto (por id); uno sin medida no se
 * toca. Devuelve el documento nuevo y lo que cambió.
 */
export function arreglarContraste<D extends { pages: Array<{ objects: Obj[] }> }>(doc: D, fondos: ReadonlyMap<string, FondoMedido>, o: { objetivo?: number; nuevoId: () => string }): { doc: D; cambios: CambioDeContraste[] } {
  const copia = JSON.parse(JSON.stringify(doc)) as D;
  const cambios: CambioDeContraste[] = [];
  for (const pagina of copia.pages) {
    const salida: Obj[] = [];
    for (const t of pagina.objects) {
      const f = esTexto(t) ? fondos.get(String(t.id)) : undefined;
      // Un texto con resaltado (una pastilla) se lee sobre su resaltado, no sobre lo de atrás.
      const resaltado = (t.effects as { background?: { color?: string } } | undefined)?.background?.color ?? (typeof t.textBackgroundColor === 'string' && t.textBackgroundColor ? t.textBackgroundColor : null);
      const fondo = resaltado ? fondoLiso(resaltado) : f ?? null;
      const arreglo = fondo ? queHacer(t.fill, fondo, o.objetivo) : null;
      if (!arreglo || t.locked === true) { salida.push(t); continue; }
      if (arreglo.velo != null && !resaltado) {
        const ancho = num(t.width) * Math.abs(num(t.scaleX, 1));
        const alto = num(t.height) * Math.abs(num(t.scaleY, 1));
        const x = num(t.left) - (t.originX === 'center' ? ancho / 2 : t.originX === 'right' ? ancho : 0);
        const y = num(t.top) - (t.originY === 'center' ? alto / 2 : t.originY === 'bottom' ? alto : 0);
        const aire = Math.round(0.35 * num(t.fontSize, 40) * Math.abs(num(t.scaleY, 1)));
        salida.push({
          type: 'rect', shapeKind: 'rect', id: o.nuevoId(), name: NOMBRE_VELO, originX: 'left', originY: 'top',
          left: Math.round(x - aire), top: Math.round(y - aire), width: Math.round(ancho + 2 * aire), height: Math.round(alto + 2 * aire),
          rx: aire, ry: aire, fill: `rgba(0,0,0,${arreglo.velo})`, stroke: null, strokeWidth: 0, scaleX: 1, scaleY: 1, angle: num(t.angle), opacity: 1, visible: true,
        });
      }
      const antes = String(t.fill ?? '');
      const nuevo = { ...t, fill: arreglo.color } as Obj;
      // Los colores por letra (un acento) que tampoco se leen pasan a la tinta nueva.
      if (t.styles && typeof t.styles === 'object' && fondo) nuevo.styles = conAcentosQueSeLeen(t.styles as Record<string, Record<string, Obj>>, fondo, arreglo, o.objetivo ?? CONTRASTE_OBJETIVO);
      salida.push(nuevo);
      cambios.push({ id: String(t.id), texto: String(t.text ?? '').slice(0, 60), antes, despues: arreglo.color, velo: arreglo.velo, contrasteAntes: arreglo.antes, contrasteDespues: arreglo.despues });
    }
    pagina.objects = salida;
  }
  return { doc: copia, cambios };
}

function conAcentosQueSeLeen(styles: Record<string, Record<string, Obj>>, f: FondoMedido, a: Arreglo, objetivo: number): Record<string, Record<string, Obj>> {
  const fondo = a.velo != null ? conVelo(f, a.velo) : f;
  const out: Record<string, Record<string, Obj>> = {};
  for (const [r, letras] of Object.entries(styles)) {
    out[r] = {};
    for (const [c, s] of Object.entries(letras ?? {})) {
      const c2 = s && typeof s.fill === 'string' ? contrasteDelTexto(s.fill, fondo) : null;
      out[r][c] = c2 != null && c2 < Math.min(objetivo, CONTRASTE_MINIMO) ? { ...s, fill: a.color } : s;
    }
  }
  return out;
}

/** Lo que se le dice a la persona: cuántos textos se arreglaron y el contraste medido después (el peor). */
export function resumenDeContraste(cambios: readonly CambioDeContraste[], total: number): string {
  if (!total) return 'No encontré textos para medir en este diseño.';
  if (!cambios.length) return `Medí los ${total} textos contra lo que tienen detrás: todos se leen bien (contraste de 4,5 o más).`;
  const peor = Math.min(...cambios.map((c) => c.contrasteDespues));
  const velos = cambios.filter((c) => c.velo != null).length;
  const n = cambios.length;
  return `Medí los ${total} textos contra lo que tienen detrás: ${n === 1 ? 'uno no se leía' : `${n} no se leían`}. ${n === 1 ? 'Le cambié' : 'Les cambié'} el color${velos ? ` y ${velos === 1 ? 'a uno le puse' : `a ${velos} les puse`} un velo oscuro detrás` : ''}. Ahora el peor contraste es ${peor.toFixed(1).replace('.', ',')} (se lee desde 4,5).`;
}
