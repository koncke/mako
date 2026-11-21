// =============================================================================
// LAS MARCAS: EL HUECO SOBRE LO QUE SE VE, Y SIN «SIGUIENTE» CUANDO HAY QUE TOCAR (21/11/2026, Martín probando en producción, ws 3)
// =============================================================================
// 2. «Un paso que pide clic NO tiene "Siguiente"»: cuando la marca dice «Haz clic en Second Brain», «Haz clic en la flecha» o cualquier
//    «toca aquí», la ÚNICA forma de seguir es tocar ahí («la idea es que el usuario aprenda a cliquear donde debe cliquear»). «Omitir
//    recorrido» se queda. «Siguiente» sale sólo en las marcas que no piden clic. Antes, con el video mandando, «Siguiente» salía igual
//    (`conVideo || !esperaClic`).
// 1. «La marca sobre los puntitos está corrida»: en la entrada de cada día del reto (y de los coaches), el hueco del velo se armaba con
//    la FOTO y los PUNTITOS, no con el GLOBO que los tiene: el padding blanco del globo quedaba afuera, el hueco se veía corrido y la foto
//    encima. Ahora el hueco es la foto y el globo, con su aire. Y el hueco (del motor y de la entrada) se vuelve a medir cuando termina una
//    animación o una transición: un globo que entra deslizándose se medía a mitad de camino y el hueco quedaba corrido para siempre.
//
// ⚠️ PROBADO ROMPIÉNDOLO: ver al pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { recorteDe, RELLENO_HUECO } from '../lib/recorridos';
import { cajaDeLaFila, AIRE_ENTRADA } from '../app/_ui/tutorial/hueco-de-la-fila';

const fuente = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
type R = { left: number; top: number; right: number; bottom: number };
const contiene = (h: { x: number; y: number; ancho: number; alto: number }, r: R, aire: number, nombre: string) => {
  assert.ok(h.x <= r.left - aire + 0.001 && h.y <= r.top - aire + 0.001, `${nombre}: el hueco no llega arriba a la izquierda`);
  assert.ok(h.x + h.ancho >= r.right + aire - 0.001 && h.y + h.alto >= r.bottom + aire - 0.001, `${nombre}: el hueco no llega abajo a la derecha`);
};

test('2. un paso que pide clic NO tiene «Siguiente» (tampoco con el video mandando); «Omitir recorrido» queda siempre', () => {
  const m = sinComentarios(fuente('app/_ui/tutorial/MotorTutorial.tsx'));
  const pie = m.slice(m.indexOf('function Pie('));
  assert.match(pie, /\{!esperaClic && <Button variant="primary" size="sm" onClick=\{siguiente\}>\{ultimo && !conVideo \? 'Listo' : 'Siguiente'\}<\/Button>\}/);
  assert.doesNotMatch(pie, /conVideo \|\| !esperaClic/, 'con el video mandando salía igual');
  assert.match(pie, /<Button variant="tertiary" size="sm" onClick=\{\(\) => fin\('omitido'\)\}>Omitir recorrido<\/Button>/);
});

test('1a. el hueco del motor contiene el elemento entero, con su aire, y centrado (a 1440 y a 375)', () => {
  for (const [ventana, r] of [[{ ancho: 1440, alto: 900 }, { left: 300, top: 400, right: 520, bottom: 452 }], [{ ancho: 375, alto: 812 }, { left: 16, top: 600, right: 300, bottom: 640 }]] as const) {
    const h = recorteDe({ x: r.left, y: r.top, ancho: r.right - r.left, alto: r.bottom - r.top }, ventana);
    contiene(h, r, RELLENO_HUECO, `${ventana.ancho}`);
    assert.equal(h.x + h.ancho / 2, (r.left + r.right) / 2, 'centrado en x');
    assert.equal(h.y + h.alto / 2, (r.top + r.bottom) / 2, 'centrado en y');
  }
});

test('1b. la entrada de un día (y de un coach): el hueco es la FOTO y el GLOBO, no sólo los puntitos', () => {
  // La foto (26 px, con 4 de margen arriba) y el globo (padding 7 10 5) de la fila de MaKo escribiendo, medidos.
  const foto = { left: 40, top: 504, right: 66, bottom: 530 };
  const globo = { left: 74, top: 500, right: 140, bottom: 532 };
  const h = cajaDeLaFila([foto, globo]);
  contiene(h, foto, AIRE_ENTRADA, 'la foto');
  contiene(h, globo, AIRE_ENTRADA, 'el globo entero, con su padding');
  const e = sinComentarios(fuente('app/_ui/tutorial/EntradaEscribiendo.tsx'));
  assert.match(e, /const partes = \[el\.querySelector\('\.co-el'\)\?\.firstElementChild, el\.querySelector\('\.co-el__cuerpo'\)\]/, 'medía los puntitos, no el globo');
});

test('1c. el motor y la entrada vuelven a medir al terminar una animación o una transición (el globo que entra deslizándose)', () => {
  for (const f of ['app/_ui/tutorial/MotorTutorial.tsx', 'app/_ui/tutorial/EntradaEscribiendo.tsx']) {
    const s = sinComentarios(fuente(f));
    assert.match(s, /document\.addEventListener\('animationend', (pedir|medir), true\);/, `${f}: sin animationend`);
    assert.match(s, /document\.addEventListener\('transitionend', (pedir|medir), true\);/, `${f}: sin transitionend`);
  }
});

// ⚠️ PROBADO ROMPIÉNDOLO (21/11/2026, base 4/0; al restaurar, 4/0). Cada rotura, de a una, cae:
//   - «Siguiente» de vuelta con el video mandando → 2
//   - recorteDe sin el relleno de un lado → 1a
//   - la entrada midiendo los puntitos (lo de antes) → 1b;  cajaDeLaFila sin su aire → 1b
//   - el motor o la entrada sin volver a medir al terminar una animación → 1c
