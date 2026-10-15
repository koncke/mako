// =============================================================================
// editor-landing/grafico-svg — los «Gráficos inteligentes» de Gamma como SVG PURO
// =============================================================================
// Pedido de Martín (11/10/2026): «Quiero que implementes en la tab de "Landing
// Generator" un editor de landing tipo GAMMA. Replica por completo a Gamma, que se
// pueda hacer todo lo que ahí se hace.» Gamma ofrece, en «Gráficos y diagramas», los
// gráficos de columnas, barras, líneas, área, circular y dona. Diseño y contratos:
// docs/diseno-editor-landing.md (D3: un renderizador, una hoja).
//
// Este módulo es la HOJA del grafo de imports del núcleo (no importa nada del editor
// salvo `doc.ts`), y por eso viven acá dos cosas:
//
//   1. El ÁRBOL (`NodoArbol`): la misma forma que el `DOMOutputSpec` de ProseMirror
//      (`['tag', {attrs}, ...hijos]`, con `0` como hueco del contenido). Lo producen
//      el gráfico (acá) y la especificación de cada nodo (especificacion.ts), y lo
//      serializa `htmlDeArbol`. Así la forma HTML de un nodo se escribe UNA vez y la
//      leen igual el editor (ProseMirror arma el DOM con el árbol) y la página
//      publicada (render.ts arma el string con el mismo árbol).
//   2. El serializador y los escapes (`htmlDeArbol`, `escaparTexto`, `escaparAtributo`).
//      Si vivieran en especificacion.ts, el gráfico tendría que importarla y ella al
//      gráfico: un ciclo. Acá no hay ciclo: especificacion.ts y render.ts importan de
//      este archivo y lo re-exportan.
//
// ⚠️ PURO: sin DOM, sin React, sin server-only. Lo usan el NodeView del gráfico en el
//    editor (`svgDeGrafico`), la especificación del nodo (`arbolDeGrafico`) y el render
//    público. Mismo input → mismo SVG, byte por byte (coordenadas redondeadas a 2
//    decimales y números formateados a mano, sin `Intl`, que cambia entre entornos).
// ⚠️ Colores: `var(--gm-paleta-N, <respaldo>)` en un `style`, nunca en el atributo
//    `fill`: un atributo de presentación de SVG no garantiza resolver `var()` en todos
//    los navegadores; la propiedad CSS sí. El respaldo es para cuando el SVG se usa
//    fuera de una raíz `.gm-doc` (un PNG exportado, una vista suelta).
// ⚠️ Todo texto (título, categorías, series, prefijo, sufijo) sale escapado por
//    `htmlDeArbol`: el árbol sólo lleva strings, nunca HTML.
// =============================================================================

import { TIPOS_GRAFICO, TOPES, enLista, type AttrsGrafico, type SerieGrafico, type TipoGrafico } from './doc';

// ─────────────────────────────────────────────────────────────────────────────
// El árbol y su serializador (compartido por todo el núcleo)
// ─────────────────────────────────────────────────────────────────────────────

/** Atributos de un elemento. `undefined` = no se escribe (ProseMirror también saltea los null). */
export type AttrsArbol = { readonly [nombre: string]: string | undefined };

/**
 * HTML YA ARMADO por nuestro propio código (un ícono del catálogo). Sólo lo usa render.ts al
 * serializar; NUNCA viaja en un árbol que se le pasa a ProseMirror (no lo entendería) ni sale
 * de un dato que escribió una persona. Es una clase a propósito: un objeto literal se podría
 * confundir con los atributos.
 */
export class HtmlCrudo {
  constructor(readonly html: string) {}
}

export type HijoArbol = AttrsArbol | NodoArbol | string | 0 | HtmlCrudo;

/**
 * Un elemento: `[etiqueta, atributos?, ...hijos]`. La etiqueta puede llevar el espacio de
 * nombres adelante («http://www.w3.org/2000/svg svg»), como en ProseMirror. `0` es el hueco
 * donde va el contenido del nodo (uno solo, y único hijo de su padre).
 */
export type NodoArbol = readonly [string, ...HijoArbol[]];

const MAPA_ESCAPE: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Caracteres de control que no tienen nada que hacer en un HTML (se quitan, no se escapan). */
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Texto entre etiquetas: `&`, `<` y `>`, y fuera los caracteres de control. */
export function escaparTexto(s: string): string {
  return String(s).replace(CONTROL, '').replace(/[&<>]/g, (c) => MAPA_ESCAPE[c]);
}

/** Valor de atributo (siempre entre comillas dobles): además `"` y `'`. Vale para `srcdoc`. */
export function escaparAtributo(s: string): string {
  return String(s).replace(CONTROL, '').replace(/[&<>"']/g, (c) => MAPA_ESCAPE[c]);
}

/** Elementos sin cierre. */
const VACIOS = new Set(['br', 'hr', 'img', 'input', 'source', 'wbr', 'col']);

/**
 * Las ÚNICAS etiquetas que salen. Una que no esté acá no se escribe (sus hijos sí): un error de
 * una especificación nunca puede producir un `<script>`, un `<style>` ni un `<object>`.
 */
const ETIQUETAS = new Set([
  // HTML del contenido y del sitio
  'section', 'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'hr', 'br',
  'table', 'tbody', 'tr', 'th', 'td', 'a', 'img', 'figure', 'figcaption', 'video', 'iframe', 'form',
  'label', 'input', 'textarea', 'button', 'fieldset', 'legend', 'strong', 'em', 'u', 's', 'mark',
  'details', 'summary', 'aside', 'nav', 'footer', 'main', 'header',
  // SVG de los gráficos (el `tspan` marca los «[ ]» de un texto en la miniatura de trabajo: especificacion.ts)
  'svg', 'g', 'path', 'rect', 'circle', 'line', 'polyline', 'polygon', 'text', 'tspan', 'title',
]);

/** Un nombre de atributo sano (y nunca un manejador `on…`). */
const NOMBRE_ATTR = /^[A-Za-z][A-Za-z0-9_.:-]*$/;

/**
 * Árbol → HTML. `contenido` es el HTML (ya armado y escapado) que va en el hueco `0`.
 * Escapa todo string y todo valor de atributo; descarta etiquetas fuera de la lista,
 * atributos con nombre raro y cualquier `on…`.
 */
export function htmlDeArbol(n: NodoArbol | string, contenido = ''): string {
  if (typeof n === 'string') return escaparTexto(n);
  let etiqueta = n[0];
  const esp = etiqueta.indexOf(' ');
  if (esp > 0) etiqueta = etiqueta.slice(esp + 1);
  let i = 1;
  let attrs = '';
  const a1 = n[1];
  if (a1 && typeof a1 === 'object' && !Array.isArray(a1) && !(a1 instanceof HtmlCrudo)) {
    i = 2;
    const obj = a1 as AttrsArbol;
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (v == null) continue;
      if (!NOMBRE_ATTR.test(k) || /^on/i.test(k)) continue;
      attrs += ` ${k}="${escaparAtributo(v)}"`;
    }
  }
  let interior = '';
  for (; i < n.length; i++) {
    const h = n[i];
    if (h === 0) interior += contenido;
    else if (typeof h === 'string') interior += escaparTexto(h);
    else if (h instanceof HtmlCrudo) interior += h.html;
    else if (Array.isArray(h)) interior += htmlDeArbol(h as NodoArbol, contenido);
  }
  if (!ETIQUETAS.has(etiqueta)) return interior;
  if (VACIOS.has(etiqueta)) return `<${etiqueta}${attrs}>`;
  return `<${etiqueta}${attrs}>${interior}</${etiqueta}>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalizar los atributos de un gráfico (la usan el saneo del server y el render)
// ─────────────────────────────────────────────────────────────────────────────

const MAX_VALOR = 1e12;
const LARGO_ETIQUETA = 40;

const texto = (v: unknown, max: number, recortarEspacios = true): string => {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v).slice(0, max);
  if (typeof v !== 'string') return '';
  const s = v.replace(CONTROL, '');
  return (recortarEspacios ? s.trim() : s).slice(0, max);
};

const numero = (v: unknown): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.max(-MAX_VALOR, Math.min(MAX_VALOR, n)) : 0;
};

/**
 * Los atributos de un gráfico llevados a su forma válida: tipo de la lista cerrada, hasta 24
 * categorías y 8 series (`TOPES`), cada serie con EXACTAMENTE un valor por categoría (rellena
 * con 0 o recorta), números finitos y textos cortos. Idempotente.
 */
export function normalizarGrafico(raw: unknown): AttrsGrafico {
  const r = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const categorias = (Array.isArray(r.categorias) ? r.categorias : [])
    .slice(0, TOPES.categoriasGrafico)
    .map((c) => texto(c, LARGO_ETIQUETA));
  const series: SerieGrafico[] = (Array.isArray(r.series) ? r.series : [])
    .slice(0, TOPES.seriesGrafico)
    .map((s, i) => {
      const o = (s && typeof s === 'object' && !Array.isArray(s) ? s : {}) as Record<string, unknown>;
      const vals = Array.isArray(o.valores) ? o.valores : [];
      return {
        nombre: texto(o.nombre, LARGO_ETIQUETA) || `Serie ${i + 1}`,
        valores: categorias.map((_, j) => numero(vals[j])),
      };
    });
  return {
    tipo: enLista<TipoGrafico>(TIPOS_GRAFICO, r.tipo, 'barras'),
    titulo: texto(r.titulo, 120),
    categorias,
    series,
    mostrarValores: typeof r.mostrarValores === 'boolean' ? r.mostrarValores : true,
    leyenda: typeof r.leyenda === 'boolean' ? r.leyenda : true,
    // El prefijo y el sufijo conservan sus espacios: « MXN» y «US$ » los llevan a propósito.
    sufijo: texto(r.sufijo, 8, false),
    prefijo: texto(r.prefijo, 8, false),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// El dibujo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Los colores de respaldo de `--gm-paleta-N` (los define el tema en la raíz `.gm-doc`).
 * Elegidos para distinguirse entre sí sobre blanco y sobre oscuro.
 */
export const PALETA_RESPALDO = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#a855f7'] as const;

/** El tema define `--gm-paleta-1..12` (temas.ts repite su paleta hasta 12). */
const colorDe = (i: number) => `var(--gm-paleta-${(i % 12) + 1}, ${PALETA_RESPALDO[i % PALETA_RESPALDO.length]})`;

const ANCHO = 640;
const ALTO = 360;
const NS_SVG = 'http://www.w3.org/2000/svg';

/** Redondeo a 2 decimales, sin `-0`, como texto. */
const r2 = (n: number): string => {
  const v = Math.round(n * 100) / 100;
  return String(Object.is(v, -0) ? 0 : v);
};

/** Miles con coma y decimales con punto (es-MX), escrito a mano para que no dependa de `Intl`. */
function conSeparadores(v: number, decimales: number): string {
  const neg = v < 0;
  const fijo = Math.abs(v).toFixed(decimales);
  const [ent, dec] = fijo.split('.');
  const miles = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const decLimpio = dec ? dec.replace(/0+$/, '') : '';
  return `${neg ? '-' : ''}${miles}${decLimpio ? `.${decLimpio}` : ''}`;
}

/** Un número para mostrar: compacto en millones, con separadores debajo. */
export function formatearNumero(v: number): string {
  if (!Number.isFinite(v)) return '0';
  const a = Math.abs(v);
  if (a >= 1e6) return `${conSeparadores(v / 1e6, 2)} M`;
  return conSeparadores(v, a >= 100 ? 0 : 2);
}

/** El valor con su unidad; el signo va antes del prefijo («-$50», no «$-50»). */
const conUnidad = (v: number, g: AttrsGrafico) => `${v < 0 ? '-' : ''}${g.prefijo}${formatearNumero(Math.abs(v))}${g.sufijo}`;

/** Una etiqueta que no entra en `max` caracteres se corta con «…». */
const recortar = (s: string, max: number) => (s.length > max ? `${s.slice(0, Math.max(1, max - 1))}…` : s);

/** Escala «linda»: de un mínimo y un máximo, los ticks redondos que los cubren. */
function escala(min: number, max: number): { min: number; max: number; ticks: number[] } {
  let lo = Math.min(0, min);
  let hi = Math.max(0, max);
  if (lo === hi) hi = lo + 1;
  const bruto = (hi - lo) / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
  const norm = bruto / mag;
  const paso = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  lo = Math.floor(lo / paso) * paso;
  hi = Math.ceil(hi / paso) * paso;
  const ticks: number[] = [];
  for (let t = lo, k = 0; t <= hi + paso / 2 && k < 12; t += paso, k++) ticks.push(Math.round(t / paso) * paso);
  return { min: lo, max: hi, ticks };
}

const estiloTexto = 'fill:currentColor';
const estiloTenue = 'fill:currentColor;fill-opacity:0.7';

function textoSvg(x: number, y: number, s: string, op: { ancla?: 'start' | 'middle' | 'end'; tam?: number; peso?: string; estilo?: string } = {}): NodoArbol {
  return ['text', {
    x: r2(x), y: r2(y), 'text-anchor': op.ancla ?? 'middle', 'font-size': String(op.tam ?? 12),
    'font-weight': op.peso, style: op.estilo ?? estiloTexto,
  }, s];
}

type Leyenda = { nodos: NodoArbol[]; alto: number };

/** La leyenda abajo, centrada, en hasta 2 renglones (lo que no entra se corta). */
function leyendaDe(etiquetas: string[], yBase: number): Leyenda {
  if (!etiquetas.length) return { nodos: [], alto: 0 };
  const items = etiquetas.map((t, i) => ({ t: recortar(t, 24), i, w: 18 + recortar(t, 24).length * 6.6 + 14 }));
  const renglones: (typeof items)[] = [[]];
  let ancho = 0;
  for (const it of items) {
    if (ancho + it.w > ANCHO - 32 && renglones[renglones.length - 1].length) {
      if (renglones.length === 2) break;
      renglones.push([]);
      ancho = 0;
    }
    renglones[renglones.length - 1].push(it);
    ancho += it.w;
  }
  const nodos: NodoArbol[] = [];
  renglones.forEach((fila, ri) => {
    const total = fila.reduce((s, it) => s + it.w, 0) - 14;
    let x = (ANCHO - total) / 2;
    const y = yBase + ri * 18;
    for (const it of fila) {
      nodos.push(['rect', { x: r2(x), y: r2(y - 9), width: '10', height: '10', rx: '2', style: `fill:${colorDe(it.i)}` }]);
      nodos.push(textoSvg(x + 16, y, it.t, { ancla: 'start', tam: 12, estilo: estiloTenue }));
      x += it.w;
    }
  });
  return { nodos, alto: renglones.length * 18 + 6 };
}

/** El gráfico sin datos: un marco y «Sin datos». */
function vacio(g: AttrsGrafico, raiz: (hijos: NodoArbol[]) => NodoArbol): NodoArbol {
  const hijos: NodoArbol[] = [];
  if (g.titulo) hijos.push(textoSvg(ANCHO / 2, 26, g.titulo, { tam: 16, peso: '600' }));
  hijos.push(['rect', {
    x: '16', y: r2(g.titulo ? 44 : 16), width: r2(ANCHO - 32), height: r2(ALTO - (g.titulo ? 60 : 32)), rx: '8',
    style: 'fill:none;stroke:currentColor;stroke-opacity:0.25;stroke-dasharray:6 6',
  }]);
  hijos.push(textoSvg(ANCHO / 2, ALTO / 2 + 6, 'Sin datos', { tam: 14, estilo: estiloTenue }));
  return raiz(hijos);
}

/**
 * El gráfico como ÁRBOL (la forma de un `DOMOutputSpec`): lo usa especificacion.ts para que
 * el DOM del editor y el HTML publicado sean el mismo. `xmlns` sólo hace falta para un SVG
 * suelto (un archivo); adentro de un HTML sobra.
 */
export function arbolDeGrafico(raw: unknown, op: { xmlns?: boolean } = {}): NodoArbol {
  const g = normalizarGrafico(raw);
  const etiqueta = g.titulo || 'Gráfico';
  const raiz = (hijos: NodoArbol[]): NodoArbol => [
    `${NS_SVG} svg`,
    {
      xmlns: op.xmlns ? NS_SVG : undefined, viewBox: `0 0 ${ANCHO} ${ALTO}`, class: 'gm-grafico-svg',
      role: 'img', 'aria-label': etiqueta,
    },
    ['title', etiqueta],
    ...hijos,
  ];

  const nCat = g.categorias.length;
  const nSer = g.series.length;
  if (!nCat || !nSer) return vacio(g, raiz);

  const esTorta = g.tipo === 'circular' || g.tipo === 'dona';
  const titulo: NodoArbol[] = g.titulo ? [textoSvg(ANCHO / 2, 26, g.titulo, { tam: 16, peso: '600' })] : [];
  const arriba = g.titulo ? 46 : 18;

  // La leyenda se calcula primero: su alto decide dónde termina el área del dibujo.
  const etiquetasLeyenda = esTorta ? g.categorias : nSer > 1 ? g.series.map((s) => s.nombre) : [];
  const leyendaPrueba = g.leyenda ? leyendaDe(etiquetasLeyenda, 0) : { nodos: [], alto: 0 };
  const abajoLeyenda = leyendaPrueba.alto;
  const leyenda = g.leyenda ? leyendaDe(etiquetasLeyenda, ALTO - abajoLeyenda + 10) : { nodos: [], alto: 0 };

  if (esTorta) return raiz([...titulo, ...torta(g, arriba, ALTO - abajoLeyenda - 8), ...leyenda.nodos]);

  if (g.tipo === 'barras') return raiz([...titulo, ...barrasHorizontales(g, arriba, ALTO - abajoLeyenda - 8), ...leyenda.nodos]);

  return raiz([...titulo, ...ejeVertical(g, arriba, ALTO - abajoLeyenda - 28), ...leyenda.nodos]);
}

/** Columnas, columnas apiladas, líneas y área: categorías abajo, valores a la izquierda. */
function ejeVertical(g: AttrsGrafico, y0: number, y1: number): NodoArbol[] {
  const nCat = g.categorias.length;
  const apiladas = g.tipo === 'columnasApiladas';
  let min = 0;
  let max = 0;
  if (apiladas) {
    for (let j = 0; j < nCat; j++) {
      let pos = 0;
      let neg = 0;
      for (const s of g.series) { if (s.valores[j] >= 0) pos += s.valores[j]; else neg += s.valores[j]; }
      max = Math.max(max, pos);
      min = Math.min(min, neg);
    }
  } else {
    for (const s of g.series) for (const v of s.valores) { max = Math.max(max, v); min = Math.min(min, v); }
  }
  const esc = escala(min, max);
  const etiquetasEje = esc.ticks.map((t) => conUnidad(t, g));
  const anchoEje = Math.min(96, Math.max(28, Math.max(...etiquetasEje.map((t) => t.length)) * 6.6 + 10));
  const x0 = 16 + anchoEje;
  const x1 = ANCHO - 16;
  const y = (v: number) => y1 - ((v - esc.min) / (esc.max - esc.min)) * (y1 - y0);
  const out: NodoArbol[] = [];

  // Grilla y valores del eje.
  esc.ticks.forEach((t, k) => {
    out.push(['line', {
      x1: r2(x0), x2: r2(x1), y1: r2(y(t)), y2: r2(y(t)),
      style: `stroke:currentColor;stroke-opacity:${t === 0 ? '0.35' : '0.12'};stroke-width:1`,
    }]);
    out.push(textoSvg(x0 - 8, y(t) + 4, etiquetasEje[k], { ancla: 'end', tam: 11, estilo: estiloTenue }));
  });

  const ranura = (x1 - x0) / nCat;
  const maxLetras = Math.max(3, Math.floor(ranura / 6.6));
  g.categorias.forEach((c, j) => {
    out.push(textoSvg(x0 + ranura * (j + 0.5), y1 + 18, recortar(c, maxLetras), { tam: 11, estilo: estiloTenue }));
  });

  const cero = y(Math.max(esc.min, Math.min(esc.max, 0)));

  if (g.tipo === 'columnas' || apiladas) {
    const anchoGrupo = ranura * (apiladas ? 0.56 : 0.72);
    const anchoBarra = apiladas ? anchoGrupo : anchoGrupo / g.series.length;
    for (let j = 0; j < nCat; j++) {
      let pos = 0;
      let neg = 0;
      g.series.forEach((s, i) => {
        const v = s.valores[j];
        let ya: number;
        let yb: number;
        let x: number;
        if (apiladas) {
          x = x0 + ranura * j + (ranura - anchoGrupo) / 2;
          if (v >= 0) { ya = y(pos + v); yb = y(pos); pos += v; } else { ya = y(neg); yb = y(neg + v); neg += v; }
        } else {
          x = x0 + ranura * j + (ranura - anchoGrupo) / 2 + i * anchoBarra;
          ya = Math.min(y(v), cero);
          yb = Math.max(y(v), cero);
        }
        const w = apiladas ? anchoBarra : anchoBarra * 0.88;
        out.push(['rect', {
          x: r2(x), y: r2(ya), width: r2(Math.max(0, w)), height: r2(Math.max(0, yb - ya)), rx: r2(Math.min(4, w / 4)),
          style: `fill:${colorDe(i)}`,
        }]);
        if (g.mostrarValores && !apiladas && v !== 0) {
          out.push(textoSvg(x + w / 2, v >= 0 ? ya - 6 : yb + 14, conUnidad(v, g), { tam: 11 }));
        }
      });
      if (g.mostrarValores && apiladas && (pos || neg)) {
        const total = pos + neg;
        out.push(textoSvg(x0 + ranura * (j + 0.5), y(pos) - 6, conUnidad(total, g), { tam: 11 }));
      }
    }
    return out;
  }

  // Líneas y área: un punto por categoría, en el centro de su ranura.
  const xDe = (j: number) => x0 + ranura * (j + 0.5);
  g.series.forEach((s, i) => {
    const puntos = s.valores.map((v, j) => `${r2(xDe(j))},${r2(y(v))}`);
    if (g.tipo === 'area') {
      const poli = [`${r2(xDe(0))},${r2(cero)}`, ...puntos, `${r2(xDe(nCat - 1))},${r2(cero)}`].join(' ');
      out.push(['polygon', { points: poli, style: `fill:${colorDe(i)};fill-opacity:0.18;stroke:none` }]);
    }
    out.push(['polyline', {
      points: puntos.join(' '),
      style: `fill:none;stroke:${colorDe(i)};stroke-width:2.5;stroke-linejoin:round;stroke-linecap:round`,
    }]);
    s.valores.forEach((v, j) => {
      out.push(['circle', { cx: r2(xDe(j)), cy: r2(y(v)), r: '3.5', style: `fill:${colorDe(i)}` }]);
      if (g.mostrarValores) out.push(textoSvg(xDe(j), y(v) - 9, conUnidad(v, g), { tam: 11 }));
    });
  });
  return out;
}

/** Barras horizontales: categorías a la izquierda, valores hacia la derecha. */
function barrasHorizontales(g: AttrsGrafico, y0: number, y1: number): NodoArbol[] {
  let min = 0;
  let max = 0;
  for (const s of g.series) for (const v of s.valores) { max = Math.max(max, v); min = Math.min(min, v); }
  const esc = escala(min, max);
  const largo = Math.max(...g.categorias.map((c) => c.length));
  const anchoEtiq = Math.min(160, Math.max(40, largo * 6.6 + 12));
  const x0 = 16 + anchoEtiq;
  const x1 = ANCHO - 48;
  const yEje = y1 - 16;
  const x = (v: number) => x0 + ((v - esc.min) / (esc.max - esc.min)) * (x1 - x0);
  const out: NodoArbol[] = [];
  esc.ticks.forEach((t) => {
    out.push(['line', {
      x1: r2(x(t)), x2: r2(x(t)), y1: r2(y0), y2: r2(yEje),
      style: `stroke:currentColor;stroke-opacity:${t === 0 ? '0.35' : '0.12'};stroke-width:1`,
    }]);
    out.push(textoSvg(x(t), y1, conUnidad(t, g), { tam: 11, estilo: estiloTenue }));
  });
  const nCat = g.categorias.length;
  const ranura = (yEje - y0) / nCat;
  const altoGrupo = ranura * 0.72;
  const altoBarra = altoGrupo / g.series.length;
  const cero = x(Math.max(esc.min, Math.min(esc.max, 0)));
  const maxLetras = Math.max(4, Math.floor(anchoEtiq / 6.6));
  g.categorias.forEach((c, j) => {
    out.push(textoSvg(x0 - 8, y0 + ranura * (j + 0.5) + 4, recortar(c, maxLetras), { ancla: 'end', tam: 11, estilo: estiloTenue }));
    g.series.forEach((s, i) => {
      const v = s.valores[j];
      const yb = y0 + ranura * j + (ranura - altoGrupo) / 2 + i * altoBarra;
      const xa = Math.min(x(v), cero);
      const xb = Math.max(x(v), cero);
      const h = altoBarra * 0.88;
      out.push(['rect', {
        x: r2(xa), y: r2(yb), width: r2(Math.max(0, xb - xa)), height: r2(Math.max(0, h)), rx: r2(Math.min(4, h / 4)),
        style: `fill:${colorDe(i)}`,
      }]);
      if (g.mostrarValores && v !== 0) {
        out.push(textoSvg(v >= 0 ? xb + 6 : xa - 6, yb + h / 2 + 4, conUnidad(v, g), { ancla: v >= 0 ? 'start' : 'end', tam: 11 }));
      }
    });
  });
  return out;
}

/** Circular y dona: la PRIMERA serie, una porción por categoría (sólo valores positivos). */
function torta(g: AttrsGrafico, y0: number, y1: number): NodoArbol[] {
  const valores = g.series[0].valores.map((v) => (v > 0 ? v : 0));
  const total = valores.reduce((s, v) => s + v, 0);
  const cx = ANCHO / 2;
  const cy = (y0 + y1) / 2;
  const r = Math.max(20, Math.min((y1 - y0) / 2 - 18, ANCHO / 2 - 40));
  const ri = g.tipo === 'dona' ? r * 0.6 : 0;
  const out: NodoArbol[] = [];
  if (total <= 0) {
    out.push(['circle', { cx: r2(cx), cy: r2(cy), r: r2(r), style: 'fill:none;stroke:currentColor;stroke-opacity:0.25' }]);
    out.push(textoSvg(cx, cy + 5, 'Sin datos', { tam: 14, estilo: estiloTenue }));
    return out;
  }
  const punto = (ang: number, rad: number) => [cx + rad * Math.sin(ang), cy - rad * Math.cos(ang)];
  let ang = 0;
  valores.forEach((v, i) => {
    if (v <= 0) return;
    const frac = v / total;
    const a0 = ang;
    const a1 = ang + frac * Math.PI * 2;
    ang = a1;
    const estilo = `fill:${colorDe(i)}`;
    if (frac >= 0.9999) {
      // Una sola porción: un arco de 360° no se puede dibujar, va el círculo (o el anillo).
      if (ri > 0) {
        out.push(['circle', { cx: r2(cx), cy: r2(cy), r: r2((r + ri) / 2), style: `fill:none;stroke:${colorDe(i)};stroke-width:${r2(r - ri)}` }]);
      } else {
        out.push(['circle', { cx: r2(cx), cy: r2(cy), r: r2(r), style: estilo }]);
      }
    } else {
      const grande = a1 - a0 > Math.PI ? 1 : 0;
      const [ox0, oy0] = punto(a0, r);
      const [ox1, oy1] = punto(a1, r);
      let d: string;
      if (ri > 0) {
        const [ix1, iy1] = punto(a1, ri);
        const [ix0, iy0] = punto(a0, ri);
        d = `M${r2(ox0)} ${r2(oy0)}A${r2(r)} ${r2(r)} 0 ${grande} 1 ${r2(ox1)} ${r2(oy1)}L${r2(ix1)} ${r2(iy1)}A${r2(ri)} ${r2(ri)} 0 ${grande} 0 ${r2(ix0)} ${r2(iy0)}Z`;
      } else {
        d = `M${r2(cx)} ${r2(cy)}L${r2(ox0)} ${r2(oy0)}A${r2(r)} ${r2(r)} 0 ${grande} 1 ${r2(ox1)} ${r2(oy1)}Z`;
      }
      out.push(['path', { d, style: `${estilo};stroke:var(--gm-tarjeta-color, #ffffff);stroke-width:1.5` }]);
    }
    if (g.mostrarValores) {
      const medio = (a0 + a1) / 2;
      const [tx, ty] = punto(medio, r + 14);
      const ancla = Math.sin(medio) > 0.2 ? 'start' : Math.sin(medio) < -0.2 ? 'end' : 'middle';
      out.push(textoSvg(tx, ty + 4, conUnidad(g.series[0].valores[i], g), { ancla, tam: 11 }));
    }
  });
  return out;
}

/** El gráfico como SVG string (con `xmlns`: sirve suelto, en un `<img>` o en un archivo). */
export function svgDeGrafico(raw: unknown): string {
  return htmlDeArbol(arbolDeGrafico(raw, { xmlns: true }));
}
