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

// ── Lo que viaja en el TURNO (3/11/2026) ─────────────────────────────────────────────────────────
// ⚠️ EL CUERPO DE UNA CLASE NO VIAJABA NUNCA: `recuperar` sólo lo pone pedido por id. Estos tests
// miran el bloque que lo reemplaza, `cursoParaElTurno`: trae el TRAMO donde el gurú habla de lo que
// se preguntó, siempre la lista de clases con su id, y nunca pasa del presupuesto.
//
// PROBADO ROMPIÉNDOLO (3/11/2026), con el archivo en 13 / 0, una rotura por vez y restaurada:
//   · `cursoParaElTurno` sin tramos (ningún puntaje alcanza)                  → 12 / 1
//   · el presupuesto ignorado (sin el `continue`)                             → 12 / 1
//   · `tramosDe` que salta 5 letras en cada corte                             → 12 / 1
//   · `referentesDeIds` sin exigir el `ref:` al principio                     → 12 / 1
// ⚠️ La primera versión de la rotura de `tramosDe` saltaba UNA letra y quedó en verde: ese carácter
// era el espacio después del punto, que el `join(' ')` repone. No era una rotura: era un falso rojo
// que no llegó a serlo. Una rotura tiene que perder algo que el test pueda ver.
import { armarReferente as armar, cursoParaElTurno, referentesDeIds, tramosDe, LARGO_TRAMO } from '../lib/cerebro-referente';

const conTexto = (orden: number, titulo: string, texto: string): ClaseDeCurso => ({ videoId: `v${orden}`, titulo, orden, texto });
const relleno = (n: number) => 'Esto es relleno de la clase sin nada que ver. '.repeat(Math.ceil(n / 47)).slice(0, n);

test('el turno trae el TRAMO donde el gurú habla de lo que se preguntó, con sus palabras', () => {
  const capa = armar(ALBORNA, [
    conTexto(1, 'Ideas', relleno(9_000)),
    conTexto(2, 'Retención', `${relleno(20_000)} El gancho tiene que romper el patrón en el primer segundo, sin saludar. ${relleno(20_000)}`),
    conTexto(3, 'Algoritmo', relleno(9_000)),
  ]);
  const b = cursoParaElTurno(capa, ALBORNA, '¿Cómo armo el gancho de un reel?');
  assert.match(b, /El gancho tiene que romper el patrón en el primer segundo/, 'no trajo el tramo que habla del gancho');
  assert.match(b, /### Clase 2 · «Retención» \[ref:julian-alborna:v2\] \(tramo \d+ de \d+\)/, 'el tramo no dice de qué clase sale');
  // Una clase de 40 mil NO entra entera: entra su pedazo.
  assert.ok(b.length < 12_000, `el bloque pesa ${b.length}: entró la clase entera, no el tramo`);
});

test('la lista de clases va SIEMPRE, con su id para pedir una entera; sin coincidencias, sólo la lista', () => {
  const capa = armar(ALBORNA, CURSO);
  const b = cursoParaElTurno(capa, ALBORNA, 'hola, ¿qué tal?');
  for (const c of CURSO) assert.ok(b.includes(`[${idDeClase(ALBORNA.id, c.videoId)}]`), `falta ${c.videoId} en la lista`);
  assert.doesNotMatch(b, /x{200}/, 'sin una palabra de la pregunta en el curso, no se rellena con texto de una clase');
  assert.match(b, /recuperar_del_segundo_cerebro/, 'no dice cómo pedir una clase entera');
});

test('nunca pasa del presupuesto, aunque todo el curso hable de la pregunta', () => {
  const todo = 'Los anuncios se escalan de a poco y se miden por costo por lead. '.repeat(1_000);
  const capa = armar(ALBORNA, [conTexto(1, 'Anuncios', todo), conTexto(2, 'Más anuncios', todo)]);
  const b = cursoParaElTurno(capa, ALBORNA, '¿cómo escalo mis anuncios?', 10_000);
  const tramos = b.slice(b.indexOf('LO QUE DICE SOBRE ESTA PREGUNTA'));
  assert.ok(tramos.length < 10_000 + 600, `los tramos pesan ${tramos.length} con un presupuesto de 10.000`);
});

test('los tramos no pierden texto al cortar, y ninguno pasa del largo', () => {
  const texto = Array.from({ length: 400 }, (_, i) => `Frase número ${i} del curso.`).join(' ');
  const ts = tramosDe(texto);
  assert.equal(ts.join(' '), texto, 'al cortar en tramos se perdió o se cambió texto');
  for (const t of ts) assert.ok(t.length <= LARGO_TRAMO, `un tramo de ${t.length}`);
});

test('un id `ref:` dice de qué gurú es; cualquier otro no', () => {
  assert.deepEqual(referentesDeIds(['ref:julian-alborna:abc123', 'ref:julian-alborna', 'kn:offer', 'n1:ref:hormozi', 'ref:emilio-puigrredon:x9']),
    ['julian-alborna', 'emilio-puigrredon']);
});

test('una capa sin clases no arma bloque: sin curso, el chat sigue con su ficha', () => {
  assert.equal(cursoParaElTurno(armar(ALBORNA, []), ALBORNA, '¿cómo armo el gancho?'), '');
});
