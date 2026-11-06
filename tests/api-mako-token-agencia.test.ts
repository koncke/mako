// =============================================================================
// El token de AGENCIA: uno para toda la cartera, y nunca llega a un cliente que no sea de ella (6/11/2026)
// =============================================================================
// La promesa a la agencia de Thiago (docs/promesas/2910-llamada-thiago.md): migrar 27 clientes sin acuñar 27 tokens. El
// token `mako_agt_…` se acuña una vez en la cuenta de la agencia y cada pedido dice a qué cliente va (`X-MaKo-Cliente`).
// Lo delicado es el aislamiento: con DOS agencias, un cliente compartido, uno revocado, uno pendiente y un negocio
// suelto, corre el código REAL (`crearToken` y `autenticar`) contra una base de mentira (tests/_api-token-agencia-hijo.ts).
//
// Probado rompiéndolo (6/11/2026), con la base en 11/0:
//   · sin la rama del token de agencia en `autenticar` (lib/api-mako/http.ts) → 4/7: el pedido corría en la AGENCIA.
//   · sin el `.eq('agencia_ws')` de `carteraParaCliente` Y sin la agencia en `puedeEntrar` → 9/2: el cliente de la OTRA
//     agencia entraba («dos agencias»).
//   · con `esAgenciaEstricta` siempre en true → 10/1: «deja de ser agencia».
//   · sin el chequeo de que el prefijo y la marca digan lo mismo (lib/api-mako/tokens.ts) → 10/1: un token de cuenta
//     marcado a mano entraba a un cliente.
//   · con `creadorDeAgenciaVigente` siempre en true → 10/1: el token de un closer valía.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { clienteDelPedido, decidirCliente, creadorDeAgenciaConAcceso, CABECERA_CLIENTE } from '../lib/api-mako/tokens-cartera';
import { pistaDe, parsearLista } from '../lib/api-mako/tokens-lista';

const RAIZ = join(import.meta.dirname, '..');
let R: Record<string, any> | null = null; // eslint-disable-line @typescript-eslint/no-explicit-any
function resultado() {
  if (R) return R;
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_api-token-agencia-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000,
  });
  R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length));
  return R!;
}

test('el token de agencia corre en el CLIENTE que nombra el pedido, con los permisos del token', () => {
  const { uno } = resultado();
  assert.equal(uno.c20.status, 200);
  assert.equal(uno.c20.ws, 20, 'el negocio del pedido es el cliente, no la agencia');
  assert.deepEqual(uno.c20.permisos, { crm: 'escritura' });
  assert.match(uno.c20.actor, /token de agencia/);
  assert.equal(uno.c40.ws, 40, 'un cliente compartido con otra agencia también');
  assert.equal(uno.porQuery.ws, 20, '?cliente= vale igual que el header');
  assert.equal(resultado().prefijos.uno, 'mako_agt_');
});

test('dos agencias: ninguna llega al cliente de la otra (404, sin confirmar que existe)', () => {
  const { uno, dos } = resultado();
  assert.equal(uno.c21.status, 404, 'la Uno no llega al cliente de la Dos');
  assert.equal(dos.c20.status, 404, 'la Dos no llega al cliente de la Uno');
  assert.equal(dos.c21.ws, 21);
  assert.equal(dos.c40.ws, 40);
  assert.doesNotMatch(JSON.stringify([uno.c21, dos.c20]), /Agencia (Uno|Dos)|Cliente de/, 'el 404 no dice de quién es');
});

test('sólo un cliente APROBADO: ni el revocado, ni el pendiente, ni un negocio suelto, ni la agencia misma', () => {
  const { uno } = resultado();
  for (const k of ['c50', 'c60', 'c70', 'c10']) assert.equal(uno[k].status, 404, `${k} no entra`);
  assert.deepEqual(uno.c50.disponibles, [20, 40], 'lo que se ofrece son sus aprobados, nada más');
});

test('sin cliente, o con algo que no es un número, NO cae a ninguna cuenta: 400 con la lista', () => {
  const { uno } = resultado();
  assert.equal(uno.sin.status, 400);
  assert.match(uno.sin.error, new RegExp(CABECERA_CLIENTE));
  assert.deepEqual(uno.sin.disponibles, [20, 40]);
  assert.equal(uno.raro.status, 400);
});

test('el permiso se repregunta en CADA pedido: revocar al cliente corta el siguiente', () => {
  assert.equal(resultado().trasRevocar.status, 404);
});

test('si la cuenta deja de ser agencia, el token no llega a ningún cliente', () => {
  assert.equal(resultado().yaNoEsAgencia.status, 403);
});

test('«no pude leer la cartera» es un 503, nunca un sí ni un «no es tuyo»', () => {
  assert.equal(resultado().baseCaida.status, 503);
});

test('un token de CUENTA con el header de un cliente NO salta: corre en su cuenta', () => {
  const r = resultado().cuentaConHeader;
  assert.equal(r.status, 200);
  assert.equal(r.ws, 10);
});

test('un token de cuenta marcado «cartera» a mano en la lista no vale (el prefijo y la marca tienen que coincidir)', () => {
  assert.equal(resultado().cuentaMarcadaAMano.status, 401);
});

test('el token de agencia de quien no administra la agencia (un closer) no vale', () => {
  assert.equal(resultado().delCloser.status, 401);
});

test('las reglas puras: el cliente del pedido, la decisión y quién puede acuñar', () => {
  const h = (v?: string) => new Headers(v === undefined ? {} : { [CABECERA_CLIENTE]: v });
  assert.equal(clienteDelPedido(h()), undefined);
  assert.equal(clienteDelPedido(h('20')), 20);
  assert.equal(clienteDelPedido(h('-3')), null);
  assert.equal(clienteDelPedido(h('20.5')), null);
  assert.equal(clienteDelPedido(h(), 'https://x.test/api/v1?cliente=7'), 7);
  const cartera = [{ agencia_ws: 10, cliente_ws: 20, estado: 'aprobado' }];
  assert.deepEqual(decidirCliente({ agenciaWs: 10, pedido: 20, esAgencia: true, cartera }), { ok: true, ws: 20 });
  assert.equal(decidirCliente({ agenciaWs: 11, pedido: 20, esAgencia: true, cartera }).ok, false, 'otra agencia, la misma fila: no');
  assert.equal(decidirCliente({ agenciaWs: 10, pedido: 20, esAgencia: false, cartera }).ok, false);
  assert.equal(creadorDeAgenciaConAcceso(10, { rol: 'cliente', rol_ws: 'admin', workspace_id: 10, estado: 'activo' }), true);
  assert.equal(creadorDeAgenciaConAcceso(10, { rol: 'cliente', rol_ws: 'admin', workspace_id: 20, estado: 'activo' }), false, 'el admin de un cliente no acuña para la agencia');
  assert.equal(creadorDeAgenciaConAcceso(10, { rol: 'cliente', rol_ws: 'admin', workspace_id: 10, estado: 'suspendido' }), false);
  assert.equal(pistaDe('mako_agt_abcdef1234'), 'mako_agt_…1234');
  const h64 = 'a'.repeat(64);
  const [t] = parsearLista(JSON.stringify([{ id: 't1', nombre: 'x', hash: h64, permisos: { crm: 'lectura' }, cartera: 'si' }]), ['crm']);
  assert.equal(t.cartera, undefined, 'sólo `true` prende la cartera');
  assert.deepEqual(resultado().red, []);
});
