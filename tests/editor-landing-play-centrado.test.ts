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
// La verificación de la tanda 7 rompió la primera versión: sólo miraba los selectores EXACTOS y daba por bueno lo
// que no encontraba (un `margin-left: 9%` escrito `.gm-marcador-play>svg` y un `padding-left` en el círculo daban
// 3 / 0). Ahora barre TODA regla que nombre al marcador, exige que la del tamaño exista, y mide también el ▶ del
// EDITOR (BarraFormato.tsx + InsertadoVista.tsx), que estaba corrido +2,54 % y nadie lo miraba.
//
// PROBADO ROMPIÉNDOLO (15/10/2026, arnés que restaura de memoria y compara el sha256). Base: 4 / 0.
//   · css.ts: el margin-left: 9% de vuelta escrito `.gm-marcador-play>svg`  → 3 / 1 «el centroide del ▶ cae…»
//   · css.ts: padding-left: 0.6em en el círculo                            → 3 / 1 «el centroide del ▶ cae…»
//   · css.ts: el margin-left: 9% en la regla exacta                        → 3 / 1 «el centroide del ▶ cae…»
//   · css.ts: el ▶ corrido con un transform                                → 3 / 1 «el centroide del ▶ cae…»
//   · css.ts: el círculo sin place-items: center                           → 3 / 1 «el centroide del ▶ cae…»
//   · css.ts: otra regla del círculo con justify-items: start              → 3 / 1 «el centroide del ▶ cae…»
//   · especificacion.ts: el marcador con el ▶ de contorno («play»)         → 3 / 1 «el marcador del video usa…»
//   · BarraFormato.tsx: el margin-left: 3px de vuelta                      → 3 / 1 «el ▶ del EDITOR…»
//   · InsertadoVista.tsx: el ▶ de contorno («play»)                        → 3 / 1 «el ▶ del EDITOR…»
//   · BarraFormato.tsx: padding-left: 4px en el círculo                    → 3 / 1 «el ▶ del EDITOR…»
//   · BarraFormato.tsx: margin-left: 1px en `.gmx-ico svg`                 → 3 / 1 «el ▶ del EDITOR…»
//   · BarraFormato.tsx: el círculo sin place-items: center                 → 3 / 1 «el ▶ del EDITOR…»
//   · BarraFormato.tsx: un transform escrito `.gmx-nv-play>.gmx-ico`       → 3 / 1 «el ▶ del EDITOR…»
// Restaurado: 4 / 0.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

type Regla = { sel: string; decl: Map<string, string>; delCirculo: boolean };

/**
 * TODAS las reglas de `css` con un selector que NOMBRA `marca`, se escriba como se escriba (`> svg`, `>svg`, ` svg`,
 * otro ancestro delante). La verificación de la tanda 7 rompió la versión de antes, que sólo juntaba los selectores
 * EXACTOS: el `margin-left: 9%` de vuelta escrito `.gm-marcador-play>svg` daba 3 / 0, porque la regla no se veía.
 * `delCirculo`: el selector termina en el círculo (con pseudo-clases o atributos); si no, apunta a lo de ADENTRO.
 */
function reglasQueNombran(css: string, marca: string): Regla[] {
  const out: Regla[] = [];
  for (const [, sel, cuerpo] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    for (const s of sel.split(',').map((x) => x.trim()).filter((x) => x.includes(marca))) {
      const decl = new Map<string, string>();
      for (const d of cuerpo.split(';')) {
        const i = d.indexOf(':');
        if (i > 0) decl.set(d.slice(0, i).trim().toLowerCase(), d.slice(i + 1).trim());
      }
      const resto = s.slice(s.lastIndexOf(marca) + marca.length).trim();
      out.push({ sel: s, decl, delCirculo: /^(?:\[[^\]]*\]|:(?!:)[\w-]+(?:\([^)]*\))?)*$/.test(resto) });
    }
  }
  return out;
}

/** Lo que corre al ▶ por fuera de la cuenta: en el ícono, todo margen, relleno o desplazamiento. */
const CORRE_AL_ICONO = /^(?:margin|padding)(?:-|$)|^(?:transform|translate|position|left|right|top|bottom|inset|justify-self|align-self|place-self)$|^inset-/;
/** En el círculo: un relleno corre el centro del contenido (con border-box, la mitad de lo que difiere). */
const CORRE_EN_EL_CIRCULO = /^padding(?:-|$)/;

/** El círculo centra con grid, y ninguna otra regla del círculo deshace el centrado. */
function circuloCentra(reglas: Regla[], principal: string): Map<string, string> {
  const base = reglas.find((r) => r.sel === principal && r.delCirculo);
  assert.ok(base, `falta la regla del círculo «${principal}»`);
  assert.equal(base.decl.get('display'), 'grid', 'el círculo centra al ▶ con grid');
  assert.equal(base.decl.get('place-items'), 'center');
  assert.equal(base.decl.get('border-radius'), '50%');
  assert.ok(base.decl.get('width'), 'el círculo declara su ancho');
  assert.equal(base.decl.get('width'), base.decl.get('height'), 'un círculo, no un óvalo');
  for (const r of reglas.filter((x) => x.delCirculo)) {
    for (const p of r.decl.keys()) assert.ok(!CORRE_EN_EL_CIRCULO.test(p), `«${r.sel}» corre el centro del círculo con «${p}»`);
    const d = r.decl.get('display');
    if (d != null) assert.equal(d, 'grid', `«${r.sel}» cambia el display del círculo`);
    for (const p of ['place-items', 'justify-items', 'align-items', 'place-content', 'justify-content', 'align-content']) {
      const v = r.decl.get(p);
      if (v != null) assert.equal(v, 'center', `«${r.sel}» descentra con «${p}: ${v}»`);
    }
  }
  return base.decl;
}

/** Ninguna regla de adentro del círculo corre al ▶. */
function nadaCorreAlIcono(reglas: Regla[]): void {
  for (const r of reglas.filter((x) => !x.delCirculo)) {
    for (const p of r.decl.keys()) assert.ok(!CORRE_AL_ICONO.test(p), `«${r.sel}» corre al ▶ con «${p}»`);
  }
}

const pct = (v: string | undefined): number => {
  const m = /^(-?[\d.]+)%$/.exec(v ?? '');
  assert.ok(m, `se esperaba un porcentaje y vino «${v}»`);
  return Number(m[1]);
};

test('el path de play-relleno (Phosphor) trae el centroide en el centro del viewBox', () => {
  const c = centroide(ICONOS['play-relleno'].d);
  // Medido: x = 127,1 de 256 (su caja va de 64 a 240: el centro de la caja NO es lo que se centra).
  assert.ok(Math.abs(c.x - 128) < 2, `centroide x = ${c.x.toFixed(2)}`);
  assert.ok(Math.abs(c.y - 128) < 0.5, `centroide y = ${c.y.toFixed(2)}`);
  assert.ok(c.area > 10_000, 'es un triángulo relleno, no un contorno');
});

test('el centroide del ▶ cae en el centro de su círculo (la miniatura de los diseños con video)', () => {
  const reglas = reglasQueNombran(CSS_CONTENIDO, 'gm-marcador-play');
  circuloCentra(reglas, '.gm-doc .gm-marcador-play');
  // Nada que lo corra por fuera de la cuenta de abajo, en NINGUNA regla que nombre al marcador.
  nadaCorreAlIcono(reglas);
  const svg = reglas.find((r) => r.sel === '.gm-doc .gm-marcador-play > svg');
  assert.ok(svg, 'falta la regla del tamaño del ▶');
  assert.equal(svg.decl.get('width'), '44%', 'el ▶ mide lo que se midió');
  assert.equal(svg.decl.get('width'), svg.decl.get('height'), 'el viewBox es cuadrado');
  const ancho = pct(svg.decl.get('width'));
  // Con place-items: center y sin márgenes, la caja del <svg> queda centrada en el círculo.
  const c = centroide(ICONOS['play-relleno'].d);
  const corrimiento = (100 - ancho) / 2 + (c.x / 256) * ancho - 50;   // en % del diámetro
  // Antes: +4,35 % (medido en Chromium: +4,35 en los 8 diseños). Un cuarto de punto es invisible.
  assert.ok(Math.abs(corrimiento) <= 0.25, `el centroide cae a ${corrimiento.toFixed(2)} % del diámetro del centro`);
});

test('el marcador del video usa el ▶ RELLENO dentro de su círculo (el que se midió)', () => {
  const h = htmlDeArbol(specInsertado({ src: '', proveedor: 'youtube' }, { modo: 'miniatura', marcadores: true }));
  assert.match(h, /<span class="gm-marcador-play" data-icono="play-relleno" aria-hidden="true"><\/span>/, h);
});

// El ▶ del EDITOR: el video vacío en el lienzo, lo primero que Martín ve apenas crea desde un diseño. La verificación de
// la tanda 7 lo midió corrido +2,54 % del diámetro (el ▶ de CONTORNO y un `margin-left: 3px` en BarraFormato.tsx);
// el arreglo de css.ts no lo tocaba porque es OTRA hoja (CSS_G2, la del editor). Se lee el fuente SIN comentarios y
// se extrae el bloque de CSS_G2 antes de buscar.
const RAIZ = join(__dirname, '..');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const fuente = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n'));

/** Las cadenas de CSS_G2 (BarraFormato.tsx), unidas como las une el `.join`. */
function cssDelEditor(): string {
  const src = fuente('app/web-generator/editor/BarraFormato.tsx');
  const desde = src.indexOf('export const CSS_G2');
  assert.ok(desde >= 0, 'no encontré CSS_G2');
  const hasta = src.indexOf("].join('\\n');", desde);
  assert.ok(hasta > desde, 'no encontré el cierre de CSS_G2');
  return [...src.slice(desde, hasta).matchAll(/'((?:[^'\\\n]|\\.)*)'/g)].map((m) => m[1]).join('\n');
}

test('el ▶ del EDITOR (el video vacío en el lienzo) también cae en el centro de su círculo', () => {
  const css = cssDelEditor();
  const reglas = reglasQueNombran(css, 'gmx-nv-play');
  const circulo = circuloCentra(reglas, '.gmx-nv-play');
  // Lo de adentro: las reglas que nombran el círculo y las del ícono suelto (`.gmx-ico`, `.gmx-ico svg`).
  const delIcono = reglasQueNombran(css, 'gmx-ico').filter((r) => /^\.gmx-ico(?:\s*>?\s*svg)?$/.test(r.sel));
  assert.ok(delIcono.length >= 1, 'no encontré las reglas de .gmx-ico');
  nadaCorreAlIcono([...reglas, ...delIcono.map((r) => ({ ...r, delCirculo: false }))]);

  const vista = fuente('app/web-generator/editor/nodos/InsertadoVista.tsx');
  const m = /<span className="gmx-nv-play"><Icono nombre="([\w-]+)" tam=\{(\d+)\} \/><\/span>/.exec(vista);
  assert.ok(m, 'no encontré el ▶ del video vacío en InsertadoVista.tsx');
  assert.equal(m[1], 'play-relleno', 'el ▶ de contorno («play») no tiene el centroide en el centro del viewBox');
  const lado = Number(m[2]);
  const diametro = Number(/^(\d+(?:\.\d+)?)px$/.exec(circulo.get('width') ?? '')?.[1]);
  assert.ok(diametro > lado, `el círculo (${circulo.get('width')}) es más grande que el ▶ (${lado}px)`);
  const c = centroide(ICONOS[m[1]].d);
  const corrimiento = ((c.x / 256 - 0.5) * lado / diametro) * 100;   // en % del diámetro
  assert.ok(Math.abs(corrimiento) <= 0.25, `el centroide cae a ${corrimiento.toFixed(2)} % del diámetro del centro`);
});
