// =============================================================================
// Lo que una agencia PIDE sumar: quién puede pedirlo y qué se guarda
// =============================================================================
// «En super admin, me tienen que aparecer las notificaciones de cuando una agencia
// intenta agregar a un nuevo usuario, para poder aceptarlo o rechazarlo»
// (27/09/2026). Esto es el lado del que pide, y es un guard cross-tenant: quien
// pueda encolar un alta sobre un workspace está pidiendo una cuenta ADENTRO de ese
// workspace. Vive en `lib/agencia-altas.ts`, sin `server-only`, para que este
// archivo lo pueda importar — mismo criterio que `lib/agencia-cartera.ts`.
//
// ⚠️ SE PRUEBA CON DOS AGENCIAS, por el corolario 3 de OWNER_WS en AGENTS.md: con
// una sola, un permiso que ignore `agencia_ws` pasa todas las pruebas que se le
// hagan. La B es de mentira y es la que hace la pregunta.
//
// ⚠️ Probado ROMPIÉNDOLO, dos veces, en lib/agencia-altas.ts. De 15/15:
//   (a) haciendo que `puedePedirAlta` mire sólo al cliente y no de quién es la fila
//       —`cartera.some(f => f.cliente_ws === clienteWs && f.estado === 'aprobado')`,
//       que es la versión que se escribe sola— quedan **13 pases y 2 FALLOS**: «la
//       agencia B no pide sobre el cliente de A» y «sin fila, nadie pide» (por el
//       caso de la sesión sin workspace). Los otros tres casos de estado siguen
//       pasando, y eso es un dato: con UNA sola agencia esta rotura es invisible.
//   (b) dejando que un rol desconocido caiga al default en vez de rechazarlo quedan
//       **14 pases y 1 FALLO**: «un rol inventado NO cae al default». Ése es el que
//       impide que un body diga `rolWs: 'dueno'` y el alta salga como admin sin que
//       nadie lo haya decidido.

import test from 'node:test';
import assert from 'node:assert/strict';
import type { FilaCartera } from '../lib/agencia-cartera';
import {
  puedePedirAlta, sanearPedido, emailUtilizable, emailNormalizado,
  ESTADOS_ALTA, ROTULO_ALTA, ROLES_ALTA, ROTULO_ROL, resumenAlta,
} from '../lib/agencia-altas';

const A = 13, B = 77;
const CARTERA: FilaCartera[] = [
  { agencia_ws: A, cliente_ws: 101, estado: 'aprobado' },
  { agencia_ws: A, cliente_ws: 102, estado: 'pendiente' },
  { agencia_ws: A, cliente_ws: 103, estado: 'revocado' },
  { agencia_ws: B, cliente_ws: 201, estado: 'aprobado' },
];

// ── Quién puede pedir ────────────────────────────────────────────────────────

test('pide sobre el cliente que tiene APROBADO', () => {
  assert.equal(puedePedirAlta(A, 101, CARTERA), true);
  assert.equal(puedePedirAlta(B, 201, CARTERA), true);
});

test('«pendiente» NO alcanza: la misma firma que habilita a mirar habilita a pedir', () => {
  assert.equal(puedePedirAlta(A, 102, CARTERA), false);
});

test('«revocado» cierra también para pedir', () => {
  assert.equal(puedePedirAlta(A, 103, CARTERA), false);
});

test('LA AGENCIA B NO PIDE SOBRE EL CLIENTE DE A, aunque el cliente esté aprobado', () => {
  // El caso que una sola agencia no puede hacer: 101 está aprobado en la tabla, y lo
  // que lo cierra para B es que la fila aprobada es de A.
  assert.equal(puedePedirAlta(B, 101, CARTERA), false);
});

test('sin fila, nadie pide (el default es NO)', () => {
  assert.equal(puedePedirAlta(A, 999, CARTERA), false);
  assert.equal(puedePedirAlta(A, 101, []), false);
  assert.equal(puedePedirAlta(null, 101, CARTERA), false);
});

// ── Qué se guarda ────────────────────────────────────────────────────────────

test('un pedido bueno sale limpio: email en minúsculas y sin espacios', () => {
  const r = sanearPedido({ agenciaWs: A, clienteWs: 101, email: '  Ana@Empresa.COM ', nombre: '  Ana  ', rolWs: 'closer' });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.pedido, { agenciaWs: A, clienteWs: 101, email: 'ana@empresa.com', nombre: 'Ana', rolWs: 'closer' });
});

test('sin rol, el default es admin — que es el mismo que el de la base', () => {
  for (const v of [undefined, null]) {
    const r = sanearPedido({ agenciaWs: A, clienteWs: 101, email: 'ana@empresa.com', rolWs: v });
    assert.equal(r.ok && r.pedido.rolWs, 'admin');
  }
});

test('un rol inventado NO cae al default: se rechaza', () => {
  // Un valor nuevo que el código colapsa con un default es una decisión tomada por el
  // default (AGENTS.md). Acá eso sería crear un admin porque alguien mandó cualquier cosa.
  for (const v of ['dueno', 'superadmin', 'ADMIN', '', 1, {}]) {
    const r = sanearPedido({ agenciaWs: A, clienteWs: 101, email: 'ana@empresa.com', rolWs: v });
    assert.equal(r.ok, false, `«${String(v)}» no debería valer como rol`);
  }
});

test('un email que no sirve no se encola: el pedido sería un mail que rebota', () => {
  for (const v of ['', '   ', 'ana', 'ana@', '@empresa.com', 'ana@empresa', null, 42]) {
    const r = sanearPedido({ agenciaWs: A, clienteWs: 101, email: v });
    assert.equal(r.ok, false, `«${String(v)}» no debería valer como email`);
  }
  assert.equal(emailUtilizable('ana@empresa.com'), true);
});

test('una agencia no se suma gente a sí misma por este camino', () => {
  const r = sanearPedido({ agenciaWs: A, clienteWs: A, email: 'ana@empresa.com' });
  assert.equal(r.ok, false);
});

test('un workspace inválido no pasa el saneo', () => {
  for (const v of [0, -1, 1.5, null, undefined, 'trece', {}]) {
    assert.equal(sanearPedido({ agenciaWs: A, clienteWs: v, email: 'a@b.co' }).ok, false);
    assert.equal(sanearPedido({ agenciaWs: v, clienteWs: 101, email: 'a@b.co' }).ok, false);
  }
});

test('el nombre es opcional de verdad, y se topea', () => {
  assert.equal(sanearPedido({ agenciaWs: A, clienteWs: 101, email: 'a@b.co' }).ok && true, true);
  const largo = sanearPedido({ agenciaWs: A, clienteWs: 101, email: 'a@b.co', nombre: 'x'.repeat(400) });
  assert.equal(largo.ok && largo.pedido.nombre.length, 120);
});

// ── Los rótulos ──────────────────────────────────────────────────────────────

test('cada estado y cada rol tiene su rótulo, y ninguno sobra', () => {
  // Un estado nuevo en el CHECK sin rótulo acá deja un chip vacío en la pantalla.
  assert.deepEqual(Object.keys(ROTULO_ALTA).sort(), [...ESTADOS_ALTA].sort());
  assert.deepEqual(Object.keys(ROTULO_ROL).sort(), [...ROLES_ALTA].sort());
  for (const e of ESTADOS_ALTA) assert.ok(ROTULO_ALTA[e].length > 0);
  for (const r of ROLES_ALTA) assert.ok(ROTULO_ROL[r].length > 0);
});

test('el renglón que firma el super admin nombra a los tres: quién, a quién y con qué rol', () => {
  // Lo que se firma acá crea una cuenta: si el renglón no dice a QUÉ cliente entra esa
  // persona, la firma es a ciegas.
  const t = resumenAlta({ agencia: 'Código Inmobiliario', cliente: 'Elevate', email: 'ana@empresa.com', rolWs: 'closer' });
  assert.match(t, /Código Inmobiliario/);
  assert.match(t, /Elevate/);
  assert.match(t, /ana@empresa\.com/);
  assert.match(t, /Closer/);
});

test('el email se compara normalizado: una mayúscula no es otra persona', () => {
  assert.equal(emailNormalizado('  Ana@Empresa.COM '), 'ana@empresa.com');
});
