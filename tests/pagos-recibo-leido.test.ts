// =============================================================================
// El monto del comprobante llega al formulario de «Marcar pagada» (21/10/2026, Pagos, revisión adversarial, medio)
// =============================================================================
// /api/extract-receipt devuelve `monto_usd` (el prompt pide el monto EN DÓLARES) y la pantalla leía `j.monto`: el monto no
// llegaba nunca, el campo quedaba con el valor de la cuota y un pago de menos saldaba la cuota entera («Faltan US$200» no
// aparecía). Venía del 16/10 (8390f47ad), y la 2.28 lo prometía en el chat («lo lee: monto, fecha y hora»).
// Lo que se fija, pasando por la ruta REAL (tests/_recibo-ruta-hijo.ts), no por un mock con el nombre que espera la
// pantalla:
//   1. lo que arma la ruta, leído por la función de la pantalla (`reciboLeido`), da el monto, la fecha, la hora y la nota
//      del tipo de cambio; y la pantalla usa ESA función;
//   2. `reciboLeido` sola: lo que no es un dato no llena nada, y el error de la ruta se dice.
//
// Probado rompiéndolo (21/10/2026, una rotura por vez, restaurando byte a byte): los números, en ROTURAS al final.
//
// Correr: node --import tsx --test tests/pagos-recibo-leido.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { reciboLeido } from '../app/crm/lead-view/ficha/pagos/recibo-leido';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');

type Salida = { status: number; respuesta: Record<string, unknown>; cuota: Record<string, unknown> | null; subidas: string[]; red: string[]; sinMock: string[] };
const correr = (): Salida => JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx', join(RAIZ, 'tests/_recibo-ruta-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', timeout: 120_000,
})) as Salida;

test('1. ⚠️ lo que arma la ruta REAL llega al formulario: el monto en dólares, la fecha, la hora y el tipo de cambio', () => {
  const s = correr();
  assert.equal(s.status, 200);
  assert.deepEqual([s.red, s.sinMock], [[], []], 'nada salió de la base y el Storage de mentira');
  // La ruta guarda el comprobante en la cuota, como siempre (no la marca).
  assert.equal(s.cuota?.comprobante_nombre, 'recibo.jpg');
  assert.equal(s.cuota?.pagado, false);
  assert.equal(s.subidas.length, 1);
  // Lo que lee la pantalla, de la respuesta TAL CUAL: un pago de menos (300 de una cuota de 500).
  assert.deepEqual(reciboLeido(s.respuesta), {
    montoUsd: 300, fecha: '2026-10-20', hora: '09:05', nota: 'Convertido de MXN a USD a ~17 MXN/USD', nombre: 'recibo.jpg',
  });
  // Por qué no llegaba: la ruta no dice `monto`.
  assert.equal(s.respuesta.monto, undefined);

  // La pantalla lee con ESA función, y el monto va en dólares (la IA ya convirtió).
  const piezas = leer('app/crm/lead-view/ficha/pagos/piezas.tsx');
  const marcar = piezas.slice(piezas.indexOf('export function MarcarPagada('), piezas.indexOf('export function RegistrarPago('));
  assert.match(marcar, /const j = reciboLeido\(await r\.json\(\)\.catch\(/);
  assert.match(marcar, /if \(j\.montoUsd != null\) setPlata\(\{ moneda: 'USD', monto: String\(j\.montoUsd\), usd: '' \}\);/);
  assert.match(marcar, /setLeido\(\{ nombre: j\.nombre \?\? file\.name, nota: j\.nota \}\);/, 'el tipo de cambio se dice');
  assert.doesNotMatch(marcar, /j\.monto\b/, 'nadie lee `monto` de la respuesta');
});

test('2. `reciboLeido`: lo que no es un dato no llena nada, y el error de la ruta se dice', () => {
  assert.deepEqual(reciboLeido({ error: 'no se pudo parsear la respuesta', comprobante_nombre: 'x.jpg' }), { error: 'no se pudo parsear la respuesta' });
  assert.deepEqual(reciboLeido({ monto_usd: null, fecha: null, hora: null, nota: null, comprobante_nombre: 'x.jpg' }),
    { montoUsd: null, fecha: null, hora: null, nota: null, nombre: 'x.jpg' });
  for (const monto_usd of ['300', 0, -5, Number.NaN]) assert.equal((reciboLeido({ monto_usd }) as { montoUsd: unknown }).montoUsd, null, `monto ${String(monto_usd)}`);
  assert.equal((reciboLeido({ fecha: '20/10/2026' }) as { fecha: unknown }).fecha, null);
  assert.equal((reciboLeido({ fecha: '2026-10-20T10:00:00Z' }) as { fecha: unknown }).fecha, '2026-10-20');
  assert.equal((reciboLeido({ hora: '14:30:12' }) as { hora: unknown }).hora, '14:30');
  assert.equal((reciboLeido({ hora: 'tarde' }) as { hora: unknown }).hora, null);
  assert.equal((reciboLeido(null) as { montoUsd: unknown }).montoUsd, null);
});

// ROTURAS (21/10/2026). Base: 2 pases, 0 fallos. Rota (pases / fallos):
//   · la pantalla vuelve a leer `monto`                                                → 1 / 1 (1)
//   · la ruta devuelve `monto` (el otro lado del nombre)                               → 1 / 1 (1)
//   · «Marcar pagada» no pone el monto leído                                          → 1 / 1 (1)
//   · el tipo de cambio no se dice                                                    → 1 / 1 (1)
//   · la hora sin el cero («9:05» no es una hora del campo)                           → 1 / 1 (1)
