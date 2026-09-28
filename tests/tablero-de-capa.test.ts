// =============================================================================
// Cuál de los dos tableros le toca a un workspace
// =============================================================================
// Este producto tiene DOS tableros con la misma pantalla y tablas distintas. Elegir
// mal NO da error: da CERO FILAS, y eso se lee como «este cliente no tiene trabajo».
// Ya pasó una vez en la dirección contraria (Customer Success leía
// `experimento_tareas` siempre, y en el workspace del super-admin esa tabla está
// vacía), y se reportó como «no tengo forma de asignar proyectos o tareas a clientes».
//
// ⚠️ EL PREDICADO ESTABA ESCRITO CINCO VECES —`app/api/agente/plan/route.ts`,
// `lib/plan-propuesta.ts`, `lib/reunion-auto.ts`, `lib/api-mako/areas/plan.helpers.ts`
// y `lib/mako-tools.ts`—, siempre igual y ninguna con test, porque la versión que
// decide por SESIÓN vive en un módulo con `server-only`. Ahora es uno
// (`lib/tablero-de-capa.ts`, sin `server-only` justamente para que este archivo lo
// pueda importar).
//
// MEDIDO CONTRA PRODUCCIÓN el 28/09/2026, que es de donde salen los casos:
//
//     ws  capa         experimento_tareas  plan_tareas
//      1  completo            212               0
//      3  completo              0               0
//      4  completo              0               0
//      5  pm                    0               0
//      9  superadmin            0             408   ← el único
//     10  completo             26               0
//     11  completo             68               0
//     13  agencia              19               0
//     14  completo             13               0
//
// ⚠️ Probado ROMPIÉNDOLO, dos veces, de 8/8:
//   (a) dándolo vuelta a la forma negativa (`capa !== 'cliente' ? 'dueno' : 'cliente'`),
//       que es como se escribe cuando uno piensa «el dueño es el que no es cliente»,
//       quedan **5 pases y 3 FALLOS**: las capas de cliente, las desconocidas y los
//       parecidos pasan todos a leer las tablas del dueño, que para ellos están vacías.
//   (b) cruzando la columna de un tablero con la del otro (`col: 'categorias'` en el
//       del dueño) quedan **6 pases y 2 FALLOS**. Es la rotura más silenciosa de las
//       dos: un `.contains()` con la columna del otro tablero devuelve cero filas sin
//       un solo error.

import test from 'node:test';
import assert from 'node:assert/strict';
import { tableroDeCapa, tablasDe } from '../lib/tablero-de-capa';

test('la capa de la PLATAFORMA es la única que usa el tablero del dueño', () => {
  assert.equal(tableroDeCapa('superadmin'), 'dueno');
});

test('TODAS las capas de cliente usan el tablero del cliente', () => {
  // Las cuatro que existen hoy en producción. Si mañana hay una quinta, cae en la
  // misma rama sin que nadie tenga que acordarse — que es el punto del positivo.
  for (const capa of ['completo', 'pm', 'agencia']) {
    assert.equal(tableroDeCapa(capa), 'cliente', `la capa «${capa}» quedó en el tablero del dueño`);
  }
});

test('una capa que NO se reconoce cae al tablero del CLIENTE, que es el caso normal', () => {
  // De los 9 workspaces de producción, 8 son clientes. Y el error de caer mal hacia
  // el dueño es peor: lee dos tablas que para ese workspace están vacías.
  for (const v of ['inventada', '', 'SUPERADMIN', 'super-admin', null, undefined]) {
    assert.equal(tableroDeCapa(v), 'cliente', `«${String(v)}» no debería dar 'dueno'`);
  }
});

test('la comparación es EXACTA: ni mayúsculas ni parecidos', () => {
  // `capa` viene de una columna con CHECK, así que un parecido es un bug en otro lado
  // — y tratarlo como bueno lo escondería.
  assert.notEqual(tableroDeCapa('SuperAdmin'), 'dueno');
  assert.notEqual(tableroDeCapa(' superadmin'), 'dueno');
});

test('cada tablero nombra SUS dos tablas, y no se cruzan', () => {
  const d = tablasDe('dueno');
  const c = tablasDe('cliente');
  assert.deepEqual(d, { tareas: 'plan_tareas', proyectos: 'plan_proyectos', col: 'labels' });
  assert.deepEqual(c, { tareas: 'experimento_tareas', proyectos: 'tarea_categorias', col: 'categorias' });
  // Ninguna tabla aparece en los dos: son dos universos, no dos vistas de uno.
  for (const t of [d.tareas, d.proyectos]) {
    assert.ok(t !== c.tareas && t !== c.proyectos, `${t} está en los dos tableros`);
  }
});

test('la columna por la que una tarea nombra su proyecto NO es la misma en los dos', () => {
  // `labels` contra `categorias`. Usar la del otro en un `.contains()` devuelve cero
  // filas sin error, que es el modo de falla de toda esta familia.
  assert.notEqual(tablasDe('dueno').col, tablasDe('cliente').col);
});

test('las cuatro tablas son las CUATRO del tablero, sin una quinta', () => {
  const todas = [...Object.values(tablasDe('dueno')), ...Object.values(tablasDe('cliente'))]
    .filter((t) => t.endsWith('s') && !['labels', 'categorias'].includes(t));
  assert.deepEqual(new Set(todas).size, 4);
});

test('el tipo de vuelta es uno de los dos y nada más', () => {
  for (const v of ['superadmin', 'completo', 'pm', 'agencia', 'x', null]) {
    assert.ok(['dueno', 'cliente'].includes(tableroDeCapa(v)));
  }
});
