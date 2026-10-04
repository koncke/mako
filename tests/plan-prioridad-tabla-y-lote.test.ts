// =============================================================================
// La PRIORIDAD se cambia donde se la está mirando: en la fila, y de a varias
// =============================================================================
// Dos pedidos de la llamada del 01/10/2026, los dos sobre la misma pantalla:
//
//   · 01:01:00 — «si estoy en la vista de tabla y quiero cambiar la prioridad, así como le
//     doy clic a la fecha, si puedo cambiar ahí, **si le doy clic al botoncito de prioridad
//     debería poder cambiar ahí mismo**… esto lo voy a poner como 75, tengo que recargarlo
//     para que esto me haga caso. Otra cosa: si le bajo la prioridad, que se baje
//     automáticamente, no que le tenga que refrescar la página.»
//   · 01:04:44 — «también debería poder subir prioridades desde ahí arriba. Pero como
//     solamente puedo subir deadlines por ahora… debería poder cambiar prioridades en
//     bucle, o sea, de varios juntos.»
//   · 00:57:43 — «que la barra de opciones en donde le puedo cambiar el deadline, cuando
//     estoy seleccionando varias cosas, baje con mi scroll, porque si no como que tengo que
//     subir hasta arriba.»
//
// Acá se prueban las dos mitades de siempre: la DECISIÓN con la función pura, y el
// CABLEADO leyendo los archivos — porque todo esto son props y condiciones de JSX, y de
// eso el typecheck no ve nada (una prop opcional que nadie pasa compila perfecto).
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { enOrdenParaLaBanda, prioFromScore, scoreFromPrio } from '../app/plan/board/types';

const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const TABLAS = leer('app/plan/board/Tablas.tsx');
const LOTE = leer('app/plan/board/AccionesLote.tsx');
const BOARD = leer('app/plan/board/useBoard.ts');

const score = (t: { score: number }) => t.score;

// ── LA DECISIÓN: a quiénes mueve un cambio de banda en lote ──────────────────

test('SUBIR NO BAJA A NADIE: la que ya está en la banda no se toca', () => {
  // El caso que lo motiva: dos proyectos tildados, uno arriba de todo y otro en el fondo.
  const filas = [{ id: 'a', score: 96 }, { id: 'b', score: 30 }];
  const mueven = enOrdenParaLaBanda(filas, 'alta', score).map((f) => f.id);
  assert.deepEqual(mueven, ['b'], 'se está moviendo al que ya estaba en Alta: pedir ALTA le baja la prioridad de 96 a 85');
});

test('…y bajar sí mueve a los que están arriba', () => {
  const filas = [{ id: 'a', score: 96 }, { id: 'b', score: 80 }, { id: 'c', score: 30 }];
  const mueven = enOrdenParaLaBanda(filas, 'baja', score).map((f) => f.id);
  assert.deepEqual(mueven.sort(), ['a', 'b'], 'el de 30 ya estaba en Baja y no tenía que moverse');
});

test('EL ORDEN ES DE MENOR A MAYOR, para que la cascada no los dé vuelta', () => {
  // En proyectos la escalera no admite empates: el ÚLTIMO aplicado queda arriba, así que
  // el que venía más alto tiene que aplicarse último.
  const filas = [{ id: 'medio', score: 40 }, { id: 'top', score: 70 }, { id: 'fondo', score: 10 }];
  assert.deepEqual(enOrdenParaLaBanda(filas, 'alta', score).map((f) => f.id), ['fondo', 'medio', 'top']);
});

test('una selección entera que ya está en la banda no mueve nada', () => {
  const filas = [{ id: 'a', score: 96 }, { id: 'b', score: 80 }];
  assert.equal(enOrdenParaLaBanda(filas, 'alta', score).length, 0);
});

test('el número de cada banda es el MISMO que usa el pop-up al soltar en una columna', () => {
  // Dos escalas para la misma pregunta es cómo se separan: el lote y el arrastre salen de
  // `scoreFromPrio`, y el representativo tiene que caer DENTRO de su propia banda.
  for (const p of ['alta', 'media', 'baja', 'futuro'] as const) {
    assert.equal(prioFromScore(scoreFromPrio[p]), p, `el representativo de ${p} cae en otra banda`);
  }
});

// ── EL CABLEADO: la fila (pedidos #3 y #4) ───────────────────────────────────

test('CABLEADO: el chip de prioridad de CADA tabla abre el pop-up, y las dos lo hacen', () => {
  // ⚠️ SE CUENTAN LOS DOS LADOS, no se busca la palabra en el archivo. `TablaProyectos` y
  // `TablaTareas` dibujan su propio `<Score>`: con uno solo enchufado, la mitad de la
  // pantalla sigue sin poder cambiar la prioridad y el test daría verde igual.
  const chips = (TABLAS.match(/<Score score=/g) ?? []).length;
  const clicables = (TABLAS.match(/onCambiar=\{onSoltar/g) ?? []).length;
  assert.ok(chips >= 2, `esperaba los dos chips de fila y encontré ${chips}`);
  assert.equal(clicables, chips, `${chips} chips dibujados y sólo ${clicables} clicables`);
});

test('CABLEADO: el chip NO inventa un camino de escritura propio', () => {
  // El pedido #4 («que se baje automáticamente, no que le tenga que refrescar la página»)
  // se cumple SOLO porque esto entra por `onSoltar` → `MoverPrioridadModal` →
  // `aplicarCascadaManual`, que parchea el estado. Cualquier `fetch` o `repo.` adentro de
  // la tabla sería el otro camino, el que recarga.
  const cuerpo = TABLAS.slice(TABLAS.indexOf('function Score({'), TABLAS.indexOf('export function TablaProyectos'));
  assert.doesNotMatch(cuerpo, /fetch\(|repo\./, 'el chip está escribiendo por su cuenta en vez de abrir el pop-up de siempre');
});

// ── EL CABLEADO: la barra de lote (pedidos #5 y #6) ──────────────────────────

test('CABLEADO: la barra de lote va PEGADA y AFUERA de la caja que recorta', () => {
  // La mitad que no se ve: `cajaStyle` declara `overflow-x: auto`, así que el valor usado
  // del eje Y pasa a `auto` y la caja ES un contenedor de scroll. Un `sticky` adentro se
  // posiciona contra ella —que nunca scrollea en vertical— y queda clavado igual que
  // antes, con el `position: sticky` puesto y sin un solo error.
  assert.match(TABLAS, /const cajaStyle[^;]*overflowX: 'auto'/, 'si `cajaStyle` dejó de recortar, este guard hay que reescribirlo');
  assert.match(TABLAS, /function BarraPegada[\s\S]{0,300}?position: 'sticky'/, 'la barra dejó de ser sticky');
  for (const tabla of ['export function TablaProyectos', 'export function TablaTareas']) {
    const desde = TABLAS.indexOf(tabla);
    assert.ok(desde > 0, `no encontré ${tabla}`);
    const chunk = TABLAS.slice(desde, TABLAS.indexOf('export function Tabla', desde + 10) + 1 || undefined);
    const barra = chunk.indexOf('<BarraPegada>');
    const caja = chunk.indexOf('style={cajaStyle}');
    assert.ok(barra >= 0, `${tabla} dejó de usar BarraPegada`);
    assert.ok(caja >= 0, `${tabla} dejó de usar cajaStyle`);
    assert.ok(barra < caja, `en ${tabla} la barra quedó ADENTRO de cajaStyle: el sticky no se va a disparar`);
  }
});

test('CABLEADO: el lote de prioridad deja UN solo deshacer', () => {
  // Cada `aplicarCascadaManual` ofrece el suyo y el toast vive en un casillero único, así
  // que N llamadas dejan un cartel que deshace UNA. Acá van todas con `false` y el lote
  // pisa con el suyo.
  const ini = LOTE.indexOf('const ponerPrioridad');
  assert.ok(ini > 0, 'desapareció `ponerPrioridad`');
  const cuerpo = LOTE.slice(ini, LOTE.indexOf('const rotPrioridad'));
  const cascadas = (cuerpo.match(/aplicarCascadaManual\(/g) ?? []).length;
  const sinDeshacer = (cuerpo.match(/, false\);/g) ?? []).length;
  assert.ok(cascadas >= 2, `esperaba la ida y la vuelta y encontré ${cascadas}`);
  assert.equal(sinDeshacer, cascadas, `${cascadas} cascadas y sólo ${sinDeshacer} sin su propio deshacer`);
  assert.equal((cuerpo.match(/showUndo\(/g) ?? []).length, 1, 'el lote tiene que ofrecer UN deshacer, ni cero ni dos');
  assert.match(cuerpo, /prioridadAlPerro/, 'al deshacer hay que devolverle la decisión al Perro: el candado lo puso este cambio');
});

test('CABLEADO: el deshacer del lote escribe en el SERVER, no sólo en la pantalla', () => {
  const ini = LOTE.indexOf('board.showUndo(`${mueven.length}');
  assert.ok(ini > 0, 'cambió el toast del lote de prioridad');
  const cuerpo = LOTE.slice(ini, ini + 900);
  assert.match(cuerpo, /await fijar\(/, 'el deshacer revierte sólo la pantalla: eso miente hasta el próximo F5');
});

test('CABLEADO: la prioridad en lote es una CAPACIDAD, no un botón suelto', () => {
  // Dos condiciones y las dos hacen falta: que la entidad compita (`cfg.prioridad`) y que
  // ESTE tablero pueda escribirla (`repo.prioridadManual`). Y nunca sobre una selección de
  // puras recurrentes: el server rebota cada llamada con PORQUE_NO_COMPITE.
  assert.match(LOTE, /\{cfg\.prioridad && board\.repo\.prioridadManual && compiten\.length > 0 && \(/,
    'el desplegable de prioridad se dibuja sin mirar la capacidad o sin excluir a las recurrentes');
  assert.match(LOTE, /const compiten = conFecha;/, 'lo que se repite no compite ni termina: es el mismo conjunto que el deadline');
});

test('CABLEADO: `aplicarCascadaManual` sabe NO ofrecer su deshacer', () => {
  const ini = BOARD.indexOf('const aplicarCascadaManual');
  assert.ok(ini > 0, 'desapareció `aplicarCascadaManual`');
  const cuerpo = BOARD.slice(ini, BOARD.indexOf('const soltarCandadoManual'));
  assert.match(cuerpo, /conDeshacer = true/, 'el parámetro se fue: el lote vuelve a disparar N toasts');
  assert.match(cuerpo, /if \(conDeshacer && scorePrevio/, 'el parámetro existe pero no gobierna el toast');
  assert.match(cuerpo, /fijado\.texto \? \{ id: uid\(\)/, 'un texto vacío tiene que NO escribir entrada de historial: un cambio deshecho no es historia');
});

// ── Verificado rompiéndolo (04/10/2026), con los números ───────────────────────
// · sin romper nada                                                 → 12 pases, 0 fallos
// · `enOrdenParaLaBanda` sin el `.filter` (mueve a todas)           →  9 pases, 3 fallos
// · `enOrdenParaLaBanda` sin el `.sort`                             → 11 pases, 1 fallo
// · sacándole `onCambiar` al `<Score>` de `TablaTareas`             → 11 pases, 1 fallo
// · devolviendo la barra de tareas a adentro de `cajaStyle`         → 11 pases, 1 fallo
// · un `aplicarCascadaManual` del lote sin su `false`               → 11 pases, 1 fallo
// · el deshacer del lote parcheando sólo la pantalla (sin `fijar`)  → 11 pases, 1 fallo
// · `conDeshacer` dejando de gobernar el toast en `useBoard`        → 11 pases, 1 fallo
//
// ⚠️ LO QUE NINGUNO DE ESTOS PUEDE VER ES SI EL `sticky` SE DISPARA. Eso se mira
// SCROLLEANDO en un navegador —con `scrollY = 0` un sticky roto se ve igual que uno sano—,
// y el guard de acá cubre la única causa que ya mordió y es invisible leyendo: que la
// barra vuelva a quedar adentro de la caja que recorta.
