// =============================================================================
// Una agencia ve a SUS clientes y a nadie más — con DOS agencias, no con una
// =============================================================================
// Es el guard que abre los datos de un inquilino a otro, así que es el que no
// puede estar sin red. Vive en `lib/agencia-cartera.ts`, que NO lleva
// `server-only` justamente para que este archivo lo pueda importar — mismo
// criterio que `exigirClienteDePrueba`.
//
// ⚠️ TODO SE PRUEBA CON DOS AGENCIAS, y no es prolijidad. Es el corolario 3 de
// OWNER_WS en AGENTS.md: «con UN solo valor configurado no se puede saber si lo
// leés del lugar correcto». Hoy la única agencia real es Código Inmobiliario
// (ws 13), así que un permiso cableado al número 13 —o uno que ignore
// `agencia_ws` y mire sólo `cliente_ws`— pasaría TODAS las pruebas que se hagan
// con ella sola. La segunda agencia es de mentira y es la que hace la pregunta.
//
// ⚠️ Probado ROMPIÉNDOLO, dos veces, en lib/agencia-cartera.ts. De 16/16:
//   (a) sacando `f.agencia_ws === agenciaWs` de `puedeEntrar` —el olvido más
//       probable, porque con UNA sola agencia no cambia absolutamente nada—
//       quedan 14 pases y **2 FALLOS**: «la agencia B no entra al cliente de A»
//       y «dos agencias con el mismo cliente…». Son los dos únicos casos del
//       archivo que necesitan la segunda agencia para existir.
//   (b) dando vuelta la condición a `f.estado !== 'revocado'` —la versión
//       negativa, que es la que se escribe sola— quedan 12 pases y **4 FALLOS**:
//       los dos de arriba más «pendiente NO alcanza» y «un estado que la base no
//       conoce no habilita».

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  puedeEntrar, clientesAprobados, esWsValido, rutaDeSalida,
  ROTULO_CARTERA, ESTADOS_CARTERA, type FilaCartera,
} from '../lib/agencia-cartera';

// Dos agencias. La A es la real (Código Inmobiliario, ws 13) y la B es de
// mentira: existe para que «¿mira el agencia_ws?» sea una pregunta contestable.
const A = 13, B = 77;
const CARTERA: FilaCartera[] = [
  { agencia_ws: A, cliente_ws: 101, estado: 'aprobado' },
  { agencia_ws: A, cliente_ws: 102, estado: 'pendiente' },
  { agencia_ws: A, cliente_ws: 103, estado: 'revocado' },
  { agencia_ws: B, cliente_ws: 201, estado: 'aprobado' },
  { agencia_ws: B, cliente_ws: 101, estado: 'pendiente' }, // el cliente de A, pedido por B
];

test('la agencia entra al cliente que tiene APROBADO', () => {
  assert.equal(puedeEntrar(A, 101, CARTERA), true);
  assert.equal(puedeEntrar(B, 201, CARTERA), true);
});

test('«pendiente» NO alcanza: la aprobación del super-admin es la que habilita', () => {
  assert.equal(puedeEntrar(A, 102, CARTERA), false);
});

test('«revocado» cierra, y la fila se queda para poder auditarla', () => {
  assert.equal(puedeEntrar(A, 103, CARTERA), false);
  assert.ok(CARTERA.some((f) => f.cliente_ws === 103), 'la fila revocada sigue existiendo');
});

test('LA AGENCIA B NO ENTRA AL CLIENTE DE A, aunque el cliente esté aprobado para A', () => {
  // Éste es el caso que una sola agencia no puede hacer. 101 está 'aprobado' en
  // la tabla; lo que lo cierra para B es que la fila aprobada es de A.
  assert.equal(puedeEntrar(B, 101, CARTERA), false);
});

test('dos agencias con el mismo cliente: la aprobada entra, la pendiente no', () => {
  assert.equal(puedeEntrar(A, 101, CARTERA), true);
  assert.equal(puedeEntrar(B, 101, CARTERA), false);
});

test('sin ninguna fila, nadie entra (el default es NO)', () => {
  assert.equal(puedeEntrar(A, 999, CARTERA), false);
  assert.equal(puedeEntrar(A, 101, []), false);
});

test('un estado que la base no conoce no habilita', () => {
  // Si mañana alguien escribe un estado nuevo sin tocar el guard, el guard tiene
  // que decir NO. La versión negativa (`!== 'revocado'`) diría que sí.
  const raro: FilaCartera[] = [{ agencia_ws: A, cliente_ws: 500, estado: 'en_revision' }];
  assert.equal(puedeEntrar(A, 500, raro), false);
});

test('una agencia no se mira a sí misma', () => {
  const propia: FilaCartera[] = [{ agencia_ws: A, cliente_ws: A, estado: 'aprobado' }];
  assert.equal(puedeEntrar(A, A, propia), false);
});

test('un workspace inválido no entra por ningún lado', () => {
  // El agenciaWs sale de `sesion.ws`, que es nullable: un super-admin sin
  // workspace propio llega con null.
  assert.equal(puedeEntrar(null, 101, CARTERA), false);
  assert.equal(puedeEntrar(undefined, 101, CARTERA), false);
  assert.equal(puedeEntrar(A, null, CARTERA), false);
  assert.equal(puedeEntrar(0, 101, CARTERA), false);
  assert.equal(puedeEntrar(-1, 101, CARTERA), false);
  assert.equal(puedeEntrar(1.5, 101, CARTERA), false);
});

test('null de los dos lados no empata en null', () => {
  // Sin el corte de validez, una fila con agencia_ws null y una sesión sin
  // workspace darían `null === null` y abrirían la puerta.
  const rota = [{ agencia_ws: null as unknown as number, cliente_ws: null as unknown as number, estado: 'aprobado' }];
  assert.equal(puedeEntrar(null, null, rota), false);
});

test('la cartera de A no lista los clientes de B', () => {
  assert.deepEqual(clientesAprobados(A, CARTERA), [101]);
  assert.deepEqual(clientesAprobados(B, CARTERA), [201]);
});

test('la cartera sale ordenada y sin repetidos', () => {
  const conRepes: FilaCartera[] = [
    { agencia_ws: A, cliente_ws: 30, estado: 'aprobado' },
    { agencia_ws: A, cliente_ws: 10, estado: 'aprobado' },
    { agencia_ws: A, cliente_ws: 30, estado: 'aprobado' },
    { agencia_ws: A, cliente_ws: 20, estado: 'pendiente' },
  ];
  assert.deepEqual(clientesAprobados(A, conRepes), [10, 30]);
});

test('una agencia sin workspace tiene cartera vacía, no la de todos', () => {
  assert.deepEqual(clientesAprobados(null, CARTERA), []);
});

test('esWsValido acepta sólo enteros positivos', () => {
  assert.equal(esWsValido(1), true);
  for (const v of [0, -1, 1.5, NaN, Infinity, '13', null, undefined, {}]) {
    assert.equal(esWsValido(v), false, `${String(v)} no debería valer`);
  }
});

test('la salida NUNCA manda a una ruta que el gate le niega', () => {
  // Lo que este test cuida no es el string: es que nadie vuelva a mandar a alguien
  // a '/admin', que está en SOLO_ADMIN del gate — una agencia que aterrizara ahí se
  // come el `denegarRol` y termina en /inicio, que se lee como un botón roto.
  //
  // ⚠️ Desde el 28/09/2026 las dos respuestas son la MISMA ruta, y eso no vació el
  // test: el panel de la plataforma se mudó adentro de /customer-success, así que
  // «volver a donde puedo entrar» es el mismo lugar para los dos y lo que cambia es
  // QUÉ lista se dibuja, que lo decide el server por rol. La función se queda porque
  // el día que se separen otra vez, el que busque «a dónde vuelvo» tiene un solo
  // lugar donde mirar — y porque esta aserción sigue siendo la que lo impide.
  for (const esSuper of [true, false]) {
    assert.equal(rutaDeSalida(esSuper), '/customer-success');
    assert.notEqual(rutaDeSalida(esSuper), '/admin');
  }
});

test('cada estado de la base tiene su rótulo, y ninguno sobra', () => {
  // Un estado nuevo en el CHECK sin rótulo acá deja un chip vacío en la pantalla.
  assert.deepEqual(Object.keys(ROTULO_CARTERA).sort(), [...ESTADOS_CARTERA].sort());
  for (const e of ESTADOS_CARTERA) assert.ok(ROTULO_CARTERA[e].length > 0);
});
