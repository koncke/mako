// =============================================================================
// El Second Brain de un gurú: el curso entero, sin tope, pero sólo cuando se pide (2/11/2026)
// =============================================================================
// Martín: «me gustaría que se lea entero los cursos, que no haya limitación de caracteres ni nada
// de eso, justamente la idea es que el segundo cerebro de estos gurús tenga todo el contexto».
//
// ⚠️ LO QUE ESTE TEST CUIDA ES LA DIFERENCIA ENTRE LAS DOS PIEZAS, que fue mi error original: la
// FICHA viaja en cada mensaje y por eso tiene tope de 5.200 caracteres; esta CAPA viaja sólo cuando
// la pregunta la pide y por eso NO tiene tope. Si alguien le pone un recorte al `cuerpo` de una
// clase, el pedido de Martín deja de cumplirse sin que nada se rompa a la vista — por eso hay un
// test que lo mira.
//
// Y la otra mitad: el ÍNDICE no puede llevar el texto. El índice sí viaja siempre, así que una
// clase de 40 mil caracteres en el `detalle` metería el curso entero en cada turno, que es
// exactamente lo que estamos evitando.
//
// PROBADO ROMPIÉNDOLO (2/11/2026), con el archivo en 7 / 0, una rotura por vez y restaurada:
//   · `nodoDeClase` con `cuerpo: c.texto.slice(0, 5200)`                      → 6 / 1
//   · `detalle` con el texto de la clase en vez de la línea del índice         → 6 / 1
//   · `armarReferente` sin encadenar las clases consecutivas                   → 5 / 2
//   · `armarReferente` sin ordenar por `orden` (confía en cómo vinieron)       → 6 / 1
// Correr: node --import tsx --test tests/cerebro-referente.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { armarReferente, idDeClase, lineaDeClase, pesoDelCurso, type ClaseDeCurso } from '../lib/cerebro-referente';

const ALBORNA = { id: 'julian-alborna', nombre: 'Julián Alborna', completo: 'Julián Alborna', especialidad: 'Contenido que se comparte', curso: 'Inteligencia Viral 2026' };

const clase = (orden: number, titulo: string, largo: number): ClaseDeCurso =>
  ({ videoId: `v${orden}`, titulo, orden, texto: 'x'.repeat(largo) });

const CURSO: ClaseDeCurso[] = [
  clase(1, 'Cómo sacar ideas geniales', 40_000),
  clase(2, 'Volverte memorable', 32_000),
  clase(3, 'Que el algoritmo te ame', 51_000),
];

test('el curso entra ENTERO: ninguna clase se recorta', () => {
  const g = armarReferente(ALBORNA, CURSO);
  for (const c of CURSO) {
    const n = g.nodos.find((x) => x.id === idDeClase(ALBORNA.id, c.videoId));
    assert.ok(n, `falta la clase ${c.titulo}`);
    assert.equal(n.cuerpo?.length, c.texto.length, `«${c.titulo}» se recortó: el tope es de la FICHA, no de la capa`);
  }
  assert.equal(pesoDelCurso(CURSO), 123_000);
});

test('pero el ÍNDICE no lleva el texto: eso viaja en cada turno', () => {
  const g = armarReferente(ALBORNA, CURSO);
  for (const n of g.nodos) {
    assert.ok(n.detalle.length < 200, `el detalle de «${n.etiqueta}» tiene ${n.detalle.length} caracteres: el índice viaja siempre`);
  }
  // La línea del índice dice cuánto hay, para que el chat sepa si vale la pena pedirla.
  assert.match(lineaDeClase(CURSO[0]), /Cómo sacar ideas geniales — 40 mil caracteres/);
});

test('las clases quedan encadenadas en orden: el método se construye encima de lo anterior', () => {
  const g = armarReferente(ALBORNA, CURSO);
  const entre = (a: number, b: number) => g.aristas.some((x) => x.de === idDeClase(ALBORNA.id, `v${a}`) && x.a === idDeClase(ALBORNA.id, `v${b}`));
  assert.ok(entre(1, 2), 'sin la arista, una pregunta que cae en la clase 2 no trae la 1');
  assert.ok(entre(2, 3));
});

test('y se ordenan por su número aunque lleguen desordenadas', () => {
  // Leer una carpeta devuelve los archivos en el orden del sistema, no en el del curso.
  const g = armarReferente(ALBORNA, [CURSO[2], CURSO[0], CURSO[1]]);
  assert.ok(g.aristas.some((x) => x.de === idDeClase(ALBORNA.id, 'v1') && x.a === idDeClase(ALBORNA.id, 'v2')));
  assert.ok(g.aristas.some((x) => x.de === idDeClase(ALBORNA.id, 'v2') && x.a === idDeClase(ALBORNA.id, 'v3')));
});

test('la raíz dice cuánto hay detrás, que es lo que decide si abrirla', () => {
  const g = armarReferente(ALBORNA, CURSO);
  const raiz = g.nodos.find((n) => n.tipo === 'Carpeta');
  assert.ok(raiz);
  assert.match(raiz.detalle, /3 clases/);
  assert.match(raiz.detalle, /123 mil caracteres/);
});

test('un referente sin transcripciones lo dice, no finge un curso vacío', () => {
  const g = armarReferente(ALBORNA, []);
  const raiz = g.nodos.find((n) => n.tipo === 'Carpeta');
  assert.match(raiz?.detalle ?? '', /todavía sin transcripciones/);
  assert.equal(g.aristas.length, 0);
});

test('cada clase dice de qué archivo salió', () => {
  // Sin la fuente, nadie puede ir a verificar una cita contra la transcripción.
  const g = armarReferente(ALBORNA, CURSO);
  const n = g.nodos.find((x) => x.id === idDeClase(ALBORNA.id, 'v1'));
  assert.equal(n?.fuente, 'public/cono-tx/v1.json');
});
