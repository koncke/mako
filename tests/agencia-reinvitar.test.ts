// =============================================================================
// aQuienReinvitar — a quién le llega el mail de acceso, y a quién NO
// =============================================================================
// Decide el DESTINATARIO de un mail que sale de verdad, así que el caso que importa no
// es el feliz: es que un id de otro inquilino no pueda colarse. El guard de la cartera
// (`puedeEntrarAhora`) autoriza sobre un CLIENTE y no sobre una persona, así que si este
// filtro no estuviera, el permiso correcto le mandaría el acceso a la persona equivocada
// — y saldría bien, sin un solo error.
//
// ⚠️ PROBADO ROMPIÉNDOLO, dos veces (29/09/2026):
//
//   1. Sacando el `.filter((u) => u.workspace_id === clienteWs)` (o sea buscando el
//      `usuarioId` en la lista GLOBAL, que es como estaba escrito antes de extraerlo):
//      fallan 4 de 11. El que lo caza es «un id de OTRO inquilino no es destinatario»,
//      que pasa de `null` a devolver a la persona del ws ajeno; los otros tres son el del
//      usuario sin workspace, el del cliente sin nadie y el del setter que cae al primero
//      de la lista global en vez del suyo.
//
//   2. Cambiando `(u.rol_ws ?? 'admin') === 'admin'` por `u.rol_ws === 'admin'`:
//      falla 1 de 11 — «`rol_ws` nulo cuenta como admin, AUNQUE HAYA OTRO ANTES». Y ese
//      es el caso NORMAL de una cuenta abierta por una agencia.
//      ⚠️ LA PRIMERA VERSIÓN DE ESE CASO DABA 0 FALLOS y no lo dijo nadie: tenía un solo
//      elemento en la lista, así que el `?? suyos[0]` del final lo devolvía igual con la
//      condición rota. Un test que pasa con las dos versiones no mide la condición, mide
//      el fallback. Hizo falta poner a alguien ANTES para que la rotura se viera.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aQuienReinvitar } from '../lib/agencia-cartera';

type U = { id: number; workspace_id: number | null; rol_ws?: string | null; email: string };

const gente: U[] = [
  { id: 1, workspace_id: 15, rol_ws: 'closer', email: 'closer@cliente.com' },
  { id: 2, workspace_id: 15, rol_ws: 'admin', email: 'admin@cliente.com' },
  { id: 3, workspace_id: 11, rol_ws: 'admin', email: 'admin@otro.com' },
  { id: 4, workspace_id: null, rol_ws: null, email: 'huerfano@nadie.com' },
];

test('sin id, le escribe al ADMIN del cliente y no al primero de la lista', () => {
  assert.equal(aQuienReinvitar(gente, 15)?.email, 'admin@cliente.com');
});

test('con id, le escribe a esa persona', () => {
  assert.equal(aQuienReinvitar(gente, 15, 1)?.email, 'closer@cliente.com');
});

test('EL QUE IMPORTA: un id de OTRO inquilino no es destinatario', () => {
  // El 3 existe y es admin, pero del ws11. Con la cartera autorizando el ws15, mandarle
  // el acceso sería usar un permiso correcto sobre la persona equivocada.
  assert.equal(aQuienReinvitar(gente, 15, 3), null);
});

test('un id que no existe tampoco cae al admin por descarte', () => {
  // Devolver el admin «porque el id no se encontró» convertiría un pedido mal formado en
  // un mail a alguien que nadie nombró.
  assert.equal(aQuienReinvitar(gente, 15, 999), null);
});

test('un usuario sin workspace nunca entra', () => {
  assert.equal(aQuienReinvitar(gente, 15, 4), null);
});

test('`rol_ws` nulo cuenta como admin, AUNQUE HAYA OTRO ANTES', () => {
  // ⚠️ EL ORDEN ES EL TEST. Con el nulo solo en la lista, el `?? suyos[0]` del final lo
  // devuelve igual aunque la condición de admin esté rota — la primera versión de este
  // caso tenía un único elemento y por eso la rotura 2 daba 0 fallos: no medía nada.
  // Con un setter PRIMERO, sólo la versión correcta salta al segundo.
  const conSetterPrimero: U[] = [
    { id: 6, workspace_id: 20, rol_ws: 'setter', email: 'setter@nuevo.com' },
    { id: 7, workspace_id: 20, rol_ws: null, email: 'unico@nuevo.com' },
  ];
  assert.equal(aQuienReinvitar(conSetterPrimero, 20)?.email, 'unico@nuevo.com');
});

test('`rol_ws` ausente también: la fila puede venir sin la columna', () => {
  const solos = [{ id: 8, workspace_id: 21, email: 'sincolumna@nuevo.com' }];
  assert.equal(aQuienReinvitar(solos, 21)?.email, 'sincolumna@nuevo.com');
});

test('sin admin, cae al primero de ESE cliente y no de la lista', () => {
  const sinAdmin: U[] = [
    { id: 9, workspace_id: 11, rol_ws: 'admin', email: 'admin@otro.com' },
    { id: 10, workspace_id: 22, rol_ws: 'setter', email: 'setter@cliente.com' },
  ];
  assert.equal(aQuienReinvitar(sinAdmin, 22)?.email, 'setter@cliente.com');
});

test('un cliente sin NADIE adentro devuelve null: es el estado, no un error', () => {
  // Pasó de verdad el 28/09: una cuenta aprobada con cero usuarios.
  assert.equal(aQuienReinvitar(gente, 99), null);
});

test('la lista vacía devuelve null y no rompe', () => {
  assert.equal(aQuienReinvitar([], 15), null);
});

test('un `usuarioId` que no es número se ignora y manda al admin', () => {
  // Llega de un `body` de JSON: puede venir string, null o lo que sea. Tratar '2' como 2
  // sería aceptar un id sin validarlo.
  assert.equal(aQuienReinvitar(gente, 15, '1')?.email, 'admin@cliente.com');
  assert.equal(aQuienReinvitar(gente, 15, null)?.email, 'admin@cliente.com');
});
