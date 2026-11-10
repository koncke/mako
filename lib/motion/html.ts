// =============================================================================
// motion/html — una escena como árbol de HTML para la landing (el editor y la publicada)
// =============================================================================
// Recetas de las skills de iart-ai (MIT, Copyright (c) 2026 iart.ai, github.com/iart-ai/motion-skills; ./LICENSE-IART).
//
// El árbol tiene la forma de `NodoArbol` de lib/editor-landing/grafico-svg.ts (`[etiqueta, atributos, ...hijos]`): lo
// serializa `htmlDeArbol` (que escapa todo texto y todo atributo). ⚠️ El bloque motion del Web Generator NO está en este
// repo todavía (es del chat Landings; vive en la etiqueta rescate/motion-imagen-2610): hoy este árbol lo usan los tests,
// que cruzan pedazo por pedazo el HTML con el lienzo del Video Editor, para que el día que llegue diga lo mismo. Sólo strings:
// ningún texto de la persona viaja como HTML ni como CSS (los colores ya pasaron por `normalizarMotion`, los números se
// escriben acá).
//
// Cada pedazo lleva en su `style` las variables de ./css.ts: el mismo efecto, el mismo t0 + i·paso, la misma duración y
// la misma curva que el lienzo (./canvas.ts). Lo estático (dónde va, el tamaño, el color) es el ESTADO FINAL: sin CSS
// de animación —un crawler, «menos movimiento»— se ve el bloque terminado.
// El bloque entero lleva `role="img"` con el texto completo en `aria-label`, y los pedazos van `aria-hidden` (un lector
// de pantalla no deletrea: kinetic-typography).
// =============================================================================

import { cssDeCurva } from './curvas';
import { nombreEntrada, nombreSalida } from './css';
import { inicioPedazo } from './evaluar';
import type { Capa, CapaCaja, CapaCifra, CapaForma, CapaTexto, Efecto, Escena, Tramo } from './tipos';

export type AttrsHtml = { readonly [nombre: string]: string | undefined };
// El hijo con nombre propio, como `HijoArbol` de grafico-svg.ts: con `Array<… | NodoHtml | …>` adentro de la tupla, el
// alias se nombra a sí mismo y tsc no lo acepta (TS2456).
export type HijoHtml = AttrsHtml | NodoHtml | string;
export type NodoHtml = readonly [string, ...HijoHtml[]];

const n2 = (x: number) => String(Math.round(x * 100) / 100);
const n3 = (x: number) => String(Math.round(x * 1000) / 1000);
const pct = (f: number) => `${n3(f * 100)}%`;

/** Las variables de la animación de un pedazo (entrada y, si hay, salida). */
function varsPedazo(entra: Tramo, sale: Tramo | undefined, i: number, efE: Efecto, efS: Efecto | null): string {
  let s = `--mo-e:${nombreEntrada(efE)};--mo-d:${inicioPedazo(entra, i)}ms;--mo-dur:${entra.dur}ms;--mo-ease:${cssDeCurva(entra.curva)};`;
  if (sale && efS) s += `--mo-s:${nombreSalida(efS)};--mo-sd:${inicioPedazo(sale, i)}ms;--mo-sdur:${sale.dur}ms;--mo-sease:${cssDeCurva(sale.curva)};`;
  return s;
}

/**
 * El recorte natural de un pedazo que entra o sale con `barrido`. ⚠️ Tiene que estar ESCRITO aunque sea 0: CSS no interpola
 * `clip-path` de `inset(…)` a «nada», y sin él el barrido salta de golpe a la mitad del tiempo (medido en el banco, 26/10).
 */
function recorteBase(c: Capa): string {
  const barre = c.entra.efecto === 'barrido' || c.sale?.efecto === 'barrido';
  const corte = c.k === 'texto' ? c.corte ?? 0 : 0;
  return barre || corte ? `clip-path:inset(0 ${pct(corte)} 0 0);` : '';
}

function attrsCapa(c: Capa, estilo: string): AttrsHtml {
  const l = c.latido;
  const lat = l ? `--mo-lper:${l.periodo}ms;--mo-ld:${l.t0}ms;--mo-lveces:${l.veces};--mo-lat:${l.escala};` : '';
  return { class: `mo-capa mo-${c.k}`, 'data-capa': c.id, 'aria-hidden': 'true', ...(l ? { 'data-latido': '' } : {}), style: estilo + lat };
}

function estiloTexto(c: Pick<CapaTexto, 'x' | 'y' | 'ancho' | 'tam' | 'peso' | 'familia' | 'color' | 'tracking' | 'interlineado' | 'alinear' | 'mayus' | 'cursiva' | 'tachado' | 'tinta'>): string {
  const alinear = c.alinear === 'izquierda' ? 'left' : c.alinear === 'derecha' ? 'right' : 'center';
  return [
    `left:${pct(c.x)}`, `top:${pct(c.y)}`, `width:${pct(c.ancho)}`,
    `font-size:${n3(c.tam * 100)}cqw`, `font-weight:${c.peso}`,
    // La fuente de la plantilla y, si la página no la cargó, la del tema de la landing.
    `font-family:"${c.familia.replace(/["\\]/g, '')}",var(--gm-fuente-titulo,inherit),sans-serif`,
    `color:${c.color}`, `letter-spacing:${n3(c.tracking)}em`, `line-height:${n2(c.interlineado)}`, `text-align:${alinear}`,
    ...(c.mayus ? ['text-transform:uppercase'] : []), ...(c.cursiva ? ['font-style:italic'] : []),
    ...(c.tachado ? ['text-decoration:line-through'] : []), ...(c.tinta !== undefined ? [`opacity:${n2(c.tinta)}`] : []),
  ].join(';') + ';';
}

function texto(c: CapaTexto): NodoHtml {
  const mascara = c.entra.efecto === 'subir' || c.sale?.efecto === 'subir';
  const corte = recorteBase(c);
  let idx = 0;
  const lineas: NodoHtml[] = c.lineas.map((linea) => {
    const hijos: Array<NodoHtml | string> = [];
    const pedazo = (txt: string): NodoHtml => {
      const i = idx++;
      return ['span', { class: 'mo-f mo-a', style: varsPedazo(c.entra, c.sale, i, c.entra.efecto, c.sale?.efecto ?? null) + corte }, txt];
    };
    if (c.partir === 'linea') hijos.push(pedazo(linea));
    else {
      const piezas = c.partir === 'palabra' ? linea.split(' ') : Array.from(linea);
      piezas.forEach((p, j) => {
        if (j && c.partir === 'palabra') hijos.push(' ');
        if (!p.trim()) { hijos.push(p); return; }
        hijos.push(pedazo(p));
      });
    }
    return ['div', { class: 'mo-l', ...(mascara ? { 'data-mascara': '' } : {}) }, ...hijos];
  });
  return ['div', attrsCapa(c, estiloTexto(c)), ...lineas];
}

function cifra(c: CapaCifra): NodoHtml {
  const hijos: NodoHtml[] = c.partes.map((p, i) => {
    if ('d' in p) {
      const digitos: NodoHtml[] = Array.from({ length: 10 }, (_, k) => ['span', {}, String(k)] as NodoHtml);
      // La ventanita del odómetro: UN renglón de alto (el interlineado de la capa); sin esto se ven los diez dígitos.
      return ['span', { class: 'mo-col', style: `height:${n2(c.interlineado)}em;` }, ['span', { class: 'mo-rueda mo-f mo-a', style: `--mo-n:${p.d};` + varsPedazo(c.entra, c.sale, i, 'rodar', c.sale ? 'rodar' : null) }, ...digitos]];
    }
    return ['span', { class: 'mo-f mo-a', style: varsPedazo(c.entra, c.sale, i, 'aparecer', c.sale ? 'aparecer' : null) }, p.s];
  });
  return ['div', attrsCapa(c, estiloTexto(c)), ['div', { class: 'mo-l' }, ...hijos]];
}

function caja(c: CapaCaja): NodoHtml {
  const origen = c.entra.efecto === 'crecer-x' ? 'left center' : c.entra.efecto === 'crecer-y' ? 'center bottom' : 'center';
  const estilo = `left:${pct(c.x)};top:${pct(c.y)};width:${pct(c.w)};height:${pct(c.h)};`;
  const interior = `background:${c.color};border-radius:${n3(c.radio * 100)}cqw;transform-origin:${origen};` +
    (c.tinta !== undefined ? `opacity:${n2(c.tinta)};` : '') + recorteBase(c) + varsPedazo(c.entra, c.sale, 0, c.entra.efecto, c.sale?.efecto ?? null);
  return ['div', attrsCapa(c, estilo), ['div', { class: 'mo-f mo-a', style: interior }]];
}

function forma(c: CapaForma, aspecto: number): NodoHtml {
  // La caja de la forma: 2r de ancho; de alto, 2r convertido a fracción del alto.
  const estilo = `left:${pct(c.cx - c.r)};top:${pct(c.cy - c.r * aspecto)};width:${pct(c.r * 2)};height:${pct(c.r * 2 * aspecto)};`;
  let figura: NodoHtml;
  if (c.puntas < 3) figura = ['circle', { cx: '0', cy: '0', r: '1', style: `fill:${c.color}` }];
  else {
    const pts: string[] = [];
    for (let i = 0; i < c.puntas * 2; i++) {
      const ang = (Math.PI / c.puntas) * i - Math.PI / 2;
      const rr = i % 2 === 0 ? 1 : c.interior;
      pts.push(`${n3(Math.cos(ang) * rr)},${n3(Math.sin(ang) * rr)}`);
    }
    figura = ['polygon', { points: pts.join(' '), style: `fill:${c.color}` }];
  }
  return ['div', attrsCapa(c, estilo), ['div', { class: 'mo-f mo-a', style: (c.tinta !== undefined ? `opacity:${n2(c.tinta)};` : '') + recorteBase(c) + varsPedazo(c.entra, c.sale, 0, c.entra.efecto, c.sale?.efecto ?? null) },
    ['http://www.w3.org/2000/svg svg', { viewBox: '-1 -1 2 2', 'aria-hidden': 'true', focusable: 'false' }, figura]]];
}

/** La escena → el árbol del bloque. `extra` son atributos del contenedor (los `data-*` del nodo de la landing). */
export function arbolDeEscena(e: Escena, extra: AttrsHtml = {}): NodoHtml {
  const capas = e.capas.map((c): NodoHtml => (c.k === 'texto' ? texto(c) : c.k === 'cifra' ? cifra(c) : c.k === 'caja' ? caja(c) : forma(c, e.aspecto)));
  return ['div', {
    ...extra,
    class: `gm-motion${extra.class ? ` ${extra.class}` : ''}`,
    role: 'img',
    'aria-label': e.texto || 'Animación',
    style: `aspect-ratio:${n3(e.aspecto)};background:${e.fondo ?? 'transparent'};`,
  }, ...capas];
}
