// =============================================================================
// El ▶ del video en las miniaturas de los diseños: centrado ÓPTICAMENTE en su círculo
// =============================================================================
// Martín (15/10/2026, punto 8 del feedback de la tanda 6), textual: «En los templates fíjate que algunos
// vídeos tienen el icono de play no centrado en su círculo, como el segundo... Es importante que esté
// bien, no sé si es de la miniatura o del bloque ese que está mal diseñado».
//
// MEDIDO con Chromium headless (scratchpad de la tanda 7, la miniatura de la primera sección de los 8
// diseños con video, como la dibuja la galería, a 1600 y a 390 de ancho): el centroide del triángulo
// estaba +4,35 % del diámetro a la derecha del centro del círculo, y la caja del triángulo +8,5 %, en los
// 8 diseños por igual (el ojo lo nota más en el gris claro de «Clásico claro», el segundo). La causa no
// era la miniatura ni el bloque: era el `margin-left: 9%` de css.ts. El obvio («a un triángulo le falta su
// corrimiento óptico a la derecha») era al revés: el `play-relleno` de Phosphor YA trae el centroide en
// el centro del viewBox, y el margen lo corría dos veces. Sin el margen: centroide −0,06 %, caja +4,1 %.
//
// Lo que se EJECUTA acá: el centroide del área del path de `play-relleno` (iconos.ts), aplanando sus
// arcos, y la posición del <svg> dentro del círculo según las reglas de CSS_CONTENIDO (css.ts) que tocan
// `.gm-marcador-play`. Con eso se calcula dónde cae el centroide respecto del centro del círculo.
//
// PROBADO ROMPIÉNDOLO (15/10/2026, arnés que restaura de memoria y compara el sha256). Base: 3 / 0.
//   · el margin-left: 9% de vuelta en css.ts                      → 2 / 1 «el centroide del ▶ cae en el centro…»
//   · el ▶ corrido con un transform en css.ts                     → 2 / 1 «el centroide del ▶ cae en el centro…»
//   · el círculo sin place-items: center                          → 2 / 1 «el centroide del ▶ cae en el centro…»
//   · el marcador con el ▶ de contorno («play») en vez del relleno → 2 / 1 «el marcador del video usa…»
// Restaurado: 3 / 0.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ICONOS } from '../lib/editor-landing/iconos';
import { CSS_CONTENIDO } from '../lib/editor-landing/css';
import { specInsertado, htmlDeArbol } from '../lib/editor-landing/especificacion';

type P = [number, number];

/** Un arco de SVG (parametrización por extremos, SVG 1.1 F.6.5) como puntos intermedios. */
function puntosDeArco(p0: P, rx: number, ry: number, rotGrados: number, grande: boolean, barrido: boolean, p1: P, n = 48): P[] {
  if (rx === 0 || ry === 0) return [p1];
  const fi = (rotGrados * Math.PI) / 180;
  const cos = Math.cos(fi), sen = Math.sin(fi);
  const dx = (p0[0] - p1[0]) / 2, dy = (p0[1] - p1[1]) / 2;
  const x1 = cos * dx + sen * dy, y1 = -sen * dx + cos * dy;
  rx = Math.abs(rx); ry = Math.abs(ry);
  const lam = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const co = (grande === barrido ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (co * rx * y1) / ry, cyp = (-co * ry * x1) / rx;
  const cx = cos * cxp - sen * cyp + (p0[0] + p1[0]) / 2;
  const cy = sen * cxp + cos * cyp + (p0[1] + p1[1]) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const t1 = ang(1, 0, (x1 - cxp) / rx, (y1 - cyp) / ry);
  let dt = ang((x1 - cxp) / rx, (y1 - cyp) / ry, (-x1 - cxp) / rx, (-y1 - cyp) / ry);
  if (!barrido && dt > 0) dt -= 2 * Math.PI;
  if (barrido && dt < 0) dt += 2 * Math.PI;
  const out: P[] = [];
  for (let i = 1; i <= n; i++) {
    const t = t1 + (dt * i) / n;
    out.push([cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sen, cy + rx * Math.cos(t) * sen + ry * Math.sin(t) * cos]);
  }
  return out;
}

/** El path como polígonos (uno por subpath). Soporta lo que usan los íconos de Phosphor: M L H V A C Z. */
function poligonos(d: string): P[][] {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) ?? [];
  const out: P[][] = [];
  let actual: P[] = [];
  let p: P = [0, 0];
  let inicio: P = [0, 0];
  let cmd = '';
  let i = 0;
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    if (C === 'Z') { if (actual.length) out.push(actual); actual = []; p = inicio; continue; }
    if (C === 'M') {
      const x = num(), y = num();
      p = rel ? [p[0] + x, p[1] + y] : [x, y];
      if (actual.length) out.push(actual);
      actual = [p]; inicio = p;
      cmd = rel ? 'l' : 'L';
    } else if (C === 'L') {
      const x = num(), y = num();
      p = rel ? [p[0] + x, p[1] + y] : [x, y]; actual.push(p);
    } else if (C === 'H') {
      const x = num(); p = [rel ? p[0] + x : x, p[1]]; actual.push(p);
    } else if (C === 'V') {
      const y = num(); p = [p[0], rel ? p[1] + y : y]; actual.push(p);
    } else if (C === 'A') {
      const rx = num(), ry = num(), rot = num(), grande = num() === 1, barrido = num() === 1, x = num(), y = num();
      const fin: P = rel ? [p[0] + x, p[1] + y] : [x, y];
      actual.push(...puntosDeArco(p, rx, ry, rot, grande, barrido, fin)); p = fin;
    } else if (C === 'C') {
      const c = [num(), num(), num(), num(), num(), num()];
      const [a, b, e] = rel ? [[p[0] + c[0], p[1] + c[1]], [p[0] + c[2], p[1] + c[3]], [p[0] + c[4], p[1] + c[5]]] : [[c[0], c[1]], [c[2], c[3]], [c[4], c[5]]];
      for (let k = 1; k <= 24; k++) {
        const t = k / 24, u = 1 - t;
        actual.push([u * u * u * p[0] + 3 * u * u * t * a[0] + 3 * u * t * t * b[0] + t * t * t * e[0], u * u * u * p[1] + 3 * u * u * t * a[1] + 3 * u * t * t * b[1] + t * t * t * e[1]]);
      }
      p = e as P;
    } else {
      throw new Error(`comando de path no soportado: ${cmd}`);
    }
  }
  if (actual.length) out.push(actual);
  return out;
}

/** El centroide del ÁREA (fórmula del polígono con signo; varios subpaths se suman con su signo). */
function centroide(d: string): { x: number; y: number; area: number } {
  let A = 0, X = 0, Y = 0;
  for (const pol of poligonos(d)) {
    for (let i = 0; i < pol.length; i++) {
      const [x0, y0] = pol[i], [x1, y1] = pol[(i + 1) % pol.length];
      const k = x0 * y1 - x1 * y0;
      A += k; X += (x0 + x1) * k; Y += (y0 + y1) * k;
    }
  }
  A /= 2;
  return { x: X / (6 * A), y: Y / (6 * A), area: Math.abs(A) };
}

/** Las declaraciones de las reglas de CSS_CONTENIDO cuyo selector es EXACTAMENTE uno de `selectores`. */
function declaraciones(selectores: string[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const [, sel, cuerpo] of CSS_CONTENIDO.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sels = sel.split(',').map((s) => s.trim());
    if (!sels.some((s) => selectores.includes(s))) continue;
    for (const d of cuerpo.split(';')) {
      const i = d.indexOf(':');
      if (i > 0) m.set(d.slice(0, i).trim(), d.slice(i + 1).trim());
    }
  }
  return m;
}

const pct = (v: string | undefined): number => {
  if (v == null) return 0;
  const m = /^(-?[\d.]+)%$/.exec(v);
  assert.ok(m || v === '0', `se esperaba un porcentaje y vino «${v}»`);
  return m ? Number(m[1]) : 0;
};

test('el path de play-relleno (Phosphor) trae el centroide en el centro del viewBox', () => {
  const c = centroide(ICONOS['play-relleno'].d);
  // Medido: x = 127,1 de 256 (su caja va de 64 a 240: el centro de la caja NO es lo que se centra).
  assert.ok(Math.abs(c.x - 128) < 2, `centroide x = ${c.x.toFixed(2)}`);
  assert.ok(Math.abs(c.y - 128) < 0.5, `centroide y = ${c.y.toFixed(2)}`);
  assert.ok(c.area > 10_000, 'es un triángulo relleno, no un contorno');
});

test('el centroide del ▶ cae en el centro de su círculo (la miniatura de los diseños con video)', () => {
  const circulo = declaraciones(['.gm-doc .gm-marcador-play']);
  assert.equal(circulo.get('display'), 'grid', 'el círculo centra al ▶ con grid');
  assert.equal(circulo.get('place-items'), 'center');
  assert.equal(circulo.get('border-radius'), '50%');
  assert.equal(circulo.get('width'), circulo.get('height'), 'un círculo, no un óvalo');

  const svg = declaraciones(['.gm-doc .gm-marcador-play > svg', '.gm-doc .gm-marcador-play svg']);
  // Nada que lo corra por fuera de la cuenta de abajo.
  for (const p of ['transform', 'translate', 'position', 'left', 'right', 'inset', 'justify-self', 'place-self', 'margin', 'margin-inline']) {
    assert.ok(!svg.has(p), `el ▶ no se corre con «${p}»`);
  }
  const ancho = pct(svg.get('width'));
  assert.equal(svg.get('width'), svg.get('height'), 'el viewBox es cuadrado');
  const izq = pct(svg.get('margin-left'));
  const der = pct(svg.get('margin-right'));
  // Con place-items: center, la caja de MARGEN queda centrada (los % del margen, sobre el ancho del círculo).
  const bordeIzq = (100 - (ancho + izq + der)) / 2 + izq;
  const c = centroide(ICONOS['play-relleno'].d);
  const corrimiento = bordeIzq + (c.x / 256) * ancho - 50;   // en % del diámetro
  // Antes: +4,35 % (medido en Chromium: +4,35 en los 8 diseños). Un cuarto de punto es invisible.
  assert.ok(Math.abs(corrimiento) <= 0.25, `el centroide cae a ${corrimiento.toFixed(2)} % del diámetro del centro`);
});

test('el marcador del video usa el ▶ RELLENO dentro de su círculo (el que se midió)', () => {
  const h = htmlDeArbol(specInsertado({ src: '', proveedor: 'youtube' }, { modo: 'miniatura', marcadores: true }));
  assert.match(h, /<span class="gm-marcador-play" data-icono="play-relleno" aria-hidden="true"><\/span>/, h);
});
