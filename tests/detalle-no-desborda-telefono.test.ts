// Las páginas de detalle (FeatureDetail: /vsl/semaforo, /vsl/api, /vsl/pipeline… las 12) no se cortan a la derecha en el teléfono
// (18/11/2026).
//
// Medido en hola-mako.com/vsl/semaforo a 375: <main> medía 494 y el texto quedaba cortado a la derecha, en las 12 páginas, también a
// 390 y a 900. La causa NO era la fila de «Cómo funciona» (que fue lo primero que pareció: su `.mk-row` choca con la pieza global
// `.mk-row` de app/_ui/ui.css, que trae `flex-wrap: wrap`, y forzarle `nowrap` no cambió nada). Era la caja «Aquí falta la
// animación» (FaltaAnimacion): min-height 260 + aspect-ratio 16/10, y el navegador pasa esa altura mínima por la proporción a un
// ANCHO mínimo de 260 × 1,6 = 416 px. `min-width: 0` y `contain: inline-size` en la caja tampoco lo frenan; sí que el PANEL sea
// contenedor de ancho, y que la caja deje la proporción cuando el panel es más angosto que eso (queda en 260 de alto, lo que ya medía).
// Medido después: las 12 a 375 y 390 con <main> del ancho de la pantalla y nada más allá del margen; a 1440 y 1024, idénticas.
//
// Verificado rompiéndolo: sacar el contenedor, sacar la regla @container, bajar su ancho por debajo de 416, o subir la altura
// mínima de la caja sin subir el ancho → cada uno, rojo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');

const DETALLE = sinComentarios(leer('app/vsl/_detalle/FeatureDetail.tsx'));
const FALTA = sinComentarios(leer('app/vsl/_competencia/FaltaAnimacion.tsx'));

test('el panel de las filas y del héroe es contenedor de ancho: no toma su ancho de lo de adentro', () => {
  assert.ok(DETALLE.includes('.mk-row-media > .mk-panel, .mk-hero-media > .mk-panel { container: mk-panel / inline-size; }'),
    'sin el contenedor, la caja «falta» le impone 416 px a la página y en el teléfono se corta a la derecha');
});

test('más angosto que lo que pide la caja «falta», la caja deja la proporción', () => {
  const m = DETALLE.match(/@container mk-panel \(max-width: (\d+)px\) \{ \.mk-falta \{ aspect-ratio: auto; \} \}/);
  assert.ok(m, 'falta la regla que le saca la proporción a la caja en un panel angosto');
  // El número sale de la caja: su altura mínima por su proporción. Si alguien cambia la caja, este umbral tiene que acompañarla.
  const alto = Number(FALTA.match(/\.mk-falta \{[^}]*min-height: (\d+)px/)?.[1]);
  const [a, b] = (FALTA.match(/\.mk-falta \{[^}]*aspect-ratio: (\d+) \/ (\d+)/) ?? []).slice(1).map(Number);
  assert.ok(alto > 0 && a > 0 && b > 0, 'no encontré la altura mínima o la proporción de .mk-falta');
  const anchoMinimo = Math.ceil((alto * a) / b);
  assert.ok(Number(m[1]) >= anchoMinimo - 1,
    `la caja pide ${anchoMinimo} px de ancho (${alto} × ${a}/${b}); con el umbral en ${m[1]} un panel de ${Number(m[1]) + 1} a ${anchoMinimo - 1} px se sigue saliendo`);
});
