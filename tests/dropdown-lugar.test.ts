// =============================================================================
// dropdown-lugar — hacia dónde abre el menú de un desplegable (item 7 del 08/10/2026)
// =============================================================================
// «Revisa que el desplegable de las opciones del tipo de pregunta se corta a la mitad... Si no hay
// espacio debería abrirse para arriba» (Martín, con la captura del selector de 17 tipos de campo
// cortado abajo). El arreglo va en el PRIMITIVE (app/components/Dropdown.tsx, que usa todo `Select` de
// la app): decide con lo que MIDE el menú y lo topa al lugar que tiene.
//
// Lo que se EJECUTA: app/components/dropdown-lugar.ts. Lo que se LEE del fuente (sin comentarios y con
// los CRLF normalizados): que el Dropdown lo use, que mida el menú ya montado UNA vez, y que el alto
// máximo salga de ahí.
//
// ── Roturas (08/10/2026) ── ver el bloque al final.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { altoMaximoDelMenu, lugarDelMenu, MARGEN_MENU, SEPARACION_MENU } from '../app/components/dropdown-lugar';

const RAIZ = join(import.meta.dirname, '..');
const sinComentarios = (src: string) => src.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), 'utf8'));
const libre = SEPARACION_MENU + MARGEN_MENU;

test('abajo si ENTRA abajo; si no, arriba si entra arriba', () => {
  // Ventana de 900, botón en 500-540: abajo quedan 360 - 18 = 342.
  assert.deepEqual(lugarDelMenu({ top: 500, bottom: 540, ventana: 900, alto: 340 }), { arriba: false, espacio: 360 - libre });
  // El caso de la captura: 320 libres abajo (la regla vieja de «300» lo abría para abajo) y un menú de
  // 340 → arriba, que hay 560.
  const r = lugarDelMenu({ top: 540, bottom: 580, ventana: 900, alto: 340 });
  assert.equal(r.arriba, true, 'con 320 px abajo, un menú de 340 se cortaba');
  assert.equal(r.espacio, 540 - libre);
  // Un menú corto entra abajo aunque quede poco: no se da vuelta de gusto.
  assert.equal(lugarDelMenu({ top: 700, bottom: 740, ventana: 900, alto: 120 }).arriba, false);
});

test('si no entra de ningún lado, va del lado con MÁS lugar, y su alto se topa a ese lugar', () => {
  // Ventana baja (zoom): 400 de alto, botón en el medio.
  const r = lugarDelMenu({ top: 180, bottom: 220, ventana: 400, alto: 340 });
  assert.equal(r.arriba, false, 'abajo hay 180 - 18 = 162, arriba 180 - 18 = 162: empata y abre abajo');
  const s = lugarDelMenu({ top: 230, bottom: 270, ventana: 400, alto: 340 });
  assert.equal(s.arriba, true);
  assert.equal(s.espacio, 230 - libre);
  assert.equal(altoMaximoDelMenu(340, s.espacio), 230 - libre, 'nunca más alto que su lugar: no se corta');
  assert.equal(altoMaximoDelMenu(340, 2000), 340, 'ni más que su tope de diseño');
  assert.equal(altoMaximoDelMenu(340, 40), 120, 'con casi nada, un piso que deje ver unas opciones (scrollea adentro)');
  assert.equal(altoMaximoDelMenu(340, undefined), 340);
});

test('sin medir todavía (el primer cuadro), la regla de siempre; el efecto lo vuelve a ubicar antes de pintar', () => {
  assert.equal(lugarDelMenu({ top: 700, bottom: 740, ventana: 900, alto: null }).arriba, true, '160 libres abajo, 700 arriba');
  assert.equal(lugarDelMenu({ top: 100, bottom: 140, ventana: 900, alto: null }).arriba, false);
});

test('el Dropdown decide con lugarDelMenu, mide el menú montado UNA vez y lo topa a su lugar', () => {
  const src = leer('app/components/Dropdown.tsx');
  assert.match(src, /import \{ altoMaximoDelMenu, lugarDelMenu, CAJA_MENU, SEPARACION_MENU \} from '\.\/dropdown-lugar';/);
  const place = src.slice(src.indexOf('const place = (alto: number | null = null) => {'), src.indexOf('const toggle = () => {'));
  assert.ok(place.length > 100 && place.length < 2000, `el recorte de place mide ${place.length}`);
  assert.match(place, /const lugar = lugarDelMenu\(\{ top: r\.top, bottom: r\.bottom, ventana: window\.innerHeight, alto \}\);/);
  assert.match(place, /const espacio = Math\.max\(0, lugar\.espacio - CAJA_MENU\);/, 'el alto del CONTENIDO: sin el relleno, la caja tocaba el borde');
  assert.doesNotMatch(place, /below < 300/, 'volvió la regla de un número');
  // Medido con el menú en el DOM, antes de pintar, y una sola vez por apertura (no se mueve al tipear).
  assert.match(src, /useLayoutEffect\(\(\) => \{\s*if \(!open \|\| medido\.current != null \|\| !menuRef\.current\) return;\s*medido\.current = menuRef\.current\.scrollHeight \+ 2;\s*place\(medido\.current\);/);
  assert.match(src, /if \(!open\) \{ place\(\); setQ\(''\); medido\.current = null; \}/, 'se vuelve a medir en cada apertura');
  // El alto máximo sale del lugar que tiene, en la lista y en las columnas.
  assert.match(src, /: altoMaximoDelMenu\(340, pos\.espacio\), overflowY: 'auto'/);
  assert.match(src, /altoMaximoDelMenu\(480, pos\.espacio, 200\)/);
});

// ── Roturas (08/10/2026) ─────────────────────────────────────────────────────
// Arnés scratchpad/leccion20/romper.mjs (UNA rotura por vez, restaurada de memoria). Base: 4 / 0.
//   · «entra abajo» con 1000 px de regalo (la regla vieja, que no mira el alto)  → 2 / 2 (los dos primeros)
//   · el alto máximo sin topar al lugar                                         → 3 / 1 «si no entra…»
//   · el Dropdown decidiendo con `alto: null` · sin volver a ubicar con lo medido · el alto máximo fijo en
//     340 · sin restar el relleno de la caja (cuatro roturas)                  → 3 / 1 «el Dropdown decide…»
// Y en el navegador (scratchpad/leccion20/banco, Chrome headless): el selector de los 17 tipos de campo con
// 320 px libres abajo en una ventana de 720 abría para abajo y se cortaba 34 px (la regla de «300»); ahora
// abre para arriba, de 12 a 354, con su caja adentro de la ventana.
