// =============================================================================
// Dos negocios de verdad: una agencia nunca ve lo de otro cliente (30/10/2026)
// =============================================================================
// Agency salió del tren porque /api/auth/me sumó una segunda lectura de «a quién se mira», y una guarda lo prohíbe
// (tests/inspeccionar-primer-cuadro.test.ts). Antes de arreglarlo se midió si era una fuga: NO lo era, era un sí o un no sobre
// el mismo negocio. Lo que sí pasaba: al cliente de DOS agencias le seguían ofreciendo MaKo Partners (`agenciaDeCliente`
// contesta null con dos dueños, y es correcto para la cadena, no para esto), y `cuentasDePartner` mostraba el plan de cuentas
// no aprobadas, también de las dadas de baja, que ya no son de esa agencia.
//
// Corre con dos agencias, sus clientes y un negocio directo, sobre el código real (tests/_agencia-dos-negocios-hijo.ts).
//
// Probado rompiéndolo (30/10/2026): al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { planQueVeLaAgencia } from '../lib/agencia-cobro-reglas';

const RAIZ = join(import.meta.dirname, '..');
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--experimental-test-module-mocks', '--import', 'tsx', join(RAIZ, 'tests', '_agencia-dos-negocios-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'],
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;

test('cada uno en su cuenta: la respuesta habla de ÉL, y de la agencia sólo dice sí o no', () => {
  const { c20, c21, d30, dos40, ex50, ag10 } = R.enSuCuenta;
  assert.equal(c20.ws, 20);
  assert.equal(c20.clienteDeAgencia, true);
  assert.equal(c21.clienteDeAgencia, true);
  assert.equal(d30.clienteDeAgencia, false, 'un negocio directo no es cliente de nadie');
  assert.equal(dos40.clienteDeAgencia, true, 'el cliente de dos agencias también: acá no hay padre que inventar');
  assert.equal(ex50.clienteDeAgencia, false, 'dado de baja, ya no es de su agencia');
  assert.equal(ag10.clienteDeAgencia, false, 'la agencia no es cliente de sí misma');
  for (const r of [c20, c21, d30, dos40, ex50]) {
    assert.equal(r.clienteNombre, null);
    assert.equal(r.clienteWs, null);
    assert.equal(r.agencia, null, 'el cliente no recibe de quién es');
    assert.doesNotMatch(JSON.stringify(r), /Agencia (Uno|Dos)|Cliente de (Uno|Dos)/);
  }
});

test('entrando como un cliente: el nombre, el número y la agencia son los de ESE cliente', () => {
  const { a20, a21 } = R.agenciaMirando;
  assert.deepEqual([a20.ws, a20.clienteWs, a20.clienteNombre, a20.clienteDeAgencia], [20, 20, 'Cliente de Uno', true]);
  assert.deepEqual([a21.ws, a21.clienteWs, a21.clienteNombre, a21.clienteDeAgencia], [21, 21, 'Cliente de Dos', true]);
  const { s21, s30, s40 } = R.superMirando;
  assert.deepEqual(s21.agencia, { ws: 11, nombre: 'Agencia Dos' });
  assert.equal(s21.salida, '/agency?ws=11');
  assert.equal(s30.agencia, null);
  assert.equal(s30.clienteDeAgencia, false);
  assert.equal(s40.agencia, null, 'con dos dueños, la cadena no afirma nada');
  assert.equal(s40.clienteDeAgencia, true);
});

test('cuarenta pedidos a la vez, intercalados: ninguno contesta con el negocio de otro', () => {
  assert.equal(R.aLaVez.length, 40);
  for (const r of R.aLaVez) {
    assert.equal(r.ws, r.pedido);
    if (r.pedido === 30) assert.deepEqual([r.clienteWs, r.clienteNombre, r.clienteDeAgencia], [null, null, false]);
    else assert.deepEqual([r.clienteWs, r.clienteNombre, r.clienteDeAgencia], [r.pedido, r.pedido === 20 ? 'Cliente de Uno' : 'Cliente de Dos', true]);
  }
});

test('la cartera: sólo sus cuentas, y el plan sale de la capa SÓLO en las aprobadas', () => {
  assert.ok(Array.isArray(R.cartera), JSON.stringify(R.cartera));
  const por = new Map(R.cartera.map((c: { ws: number }) => [c.ws, c]));
  assert.deepEqual([...por.keys()].sort(), [20, 22, 40, 50, 60, 61]);
  assert.ok(!por.has(21), 'el cliente de la otra agencia no aparece');
  assert.deepEqual(R.carteraDos.sort(), [21, 40]);
  const plan = (ws: number) => (por.get(ws) as { plan: string | null }).plan;
  assert.equal(plan(20), 'MaKo Esencial');
  assert.equal(plan(22), 'Sin elegir (tiene todo lo de Pro)');
  assert.equal(plan(50), null, 'dada de baja: ni su capa ni la marca');
  assert.equal(plan(60), 'MaKo Esencial', 'pendiente: lo que eligió la agencia (su capa dice Pro: no se lee)');
  assert.equal(plan(61), null, 'pendiente sin plan elegido: nada, aunque tenga capa');
});

test('una agencia no da de baja ni le cambia el plan a la cuenta de otra, y no escribe nada', () => {
  assert.deepEqual(R.bajaAjena, { ok: false, error: 'Esa cuenta no es de tu agencia.' });
  assert.deepEqual(R.planAjeno, { ok: false, error: 'Esa cuenta no es de tu agencia.' });
  assert.equal(R.noEscribio, true);
});

test('la regla del plan, sin base', () => {
  const v = (o: Partial<Parameters<typeof planQueVeLaAgencia>[0]>) => planQueVeLaAgencia({ estado: 'aprobado', capa: 'agencia', hayCuenta: true, elegido: null, sinElegir: false, ...o });
  assert.deepEqual(v({}), { plan: 'MaKo Pro', planId: 'pro', planElegido: true });
  assert.deepEqual(v({ capa: 'completo' }), { plan: 'MaKo Esencial', planId: 'esencial', planElegido: true });
  assert.equal(v({ sinElegir: true }).planElegido, false);
  assert.equal(v({ hayCuenta: false }).plan, null);
  assert.equal(v({ estado: 'revocado', elegido: 'pro' }).plan, null);
  assert.equal(v({ estado: 'pendiente', elegido: null }).plan, null);
  assert.deepEqual(v({ estado: 'pendiente', elegido: 'pro', capa: 'completo' }), { plan: 'MaKo Pro', planId: 'pro', planElegido: true });
});

// Roturas (30/10/2026; base 6 / 0), cada una restaurada (pasan / fallan):
//   · `esClienteDeAgencia` con la lectura de la cadena (dos dueños = no)                    -> 4 / 2
//   · una cartera revocada sigue contando como dueña                                        -> 5 / 1
//   · `cuentaActualEsDeAgencia` mira otro negocio                                           -> 3 / 3
//   · la dada de baja muestra el plan                                                       -> 4 / 2
//   · la pendiente muestra su capa                                                          -> 4 / 2
//   · lib/partners.ts vuelve a mostrar la capa de todas (lo que devolvió Integración)       -> 5 / 1
//   · la baja sin mirar de quién es la fila                                                 -> 5 / 1
//   · el cambio de plan sin mirar de quién es la fila                                       -> 5 / 1
//   · la ruta vuelve a leer sola al cliente (en tests/inspeccionar-primer-cuadro.test.ts)   -> 4 / 1
