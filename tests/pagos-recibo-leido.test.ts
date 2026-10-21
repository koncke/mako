// =============================================================================
// Lo que se lee de un comprobante llega al formulario de «Marcar pagada», en SU moneda (21/10/2026, Pagos, revisiones
// adversariales)
// =============================================================================
// Primera revisión: /api/extract-receipt devolvía `monto_usd` y la pantalla leía `j.monto`; el monto no llegaba nunca.
// Segunda: arreglado eso, el monto que llegaba lo había CONVERTIDO la IA con una tasa inventada («un tipo de cambio
// aproximado actual»), y un pago entero de MX$5.000 llenaba «Faltan US$11,24» (al guardar nacía esa cuota) o un cobro de
// más. Ahora la ruta devuelve el monto y la moneda del comprobante, sin convertir, y la pantalla llena dólares o la moneda
// del negocio (con el valor en dólares de la cuota); nunca una tasa de la IA. Lo que se fija, pasando por la ruta REAL
// (tests/_recibo-ruta-hijo.ts), no por un mock con el nombre que espera la pantalla:
//   1. un comprobante en pesos llena el monto en PESOS y deja el valor en dólares en el de la cuota; uno en dólares, en
//      dólares; un prompt viejo que convirtió no llena nada; y el prompt de siempre ya no pide convertir;
//   2. una cuota ya cobrada no cambia de comprobante (ni se sube el archivo);
//   3. `reciboLeido` y `plataDeRecibo` solas: lo que no es un dato no llena nada, y el error de la ruta se dice.
//
// Probado rompiéndolo (21/10/2026, una rotura por vez, restaurando byte a byte): los números, en ROTURAS al final.
//
// Correr: node --import tsx --test tests/pagos-recibo-leido.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { plataDeRecibo, reciboLeido, type ReciboLeido } from '../app/crm/lead-view/ficha/pagos/recibo-leido';
import { RECEIPT_EXTRACT_DEFAULT } from '../lib/prompt-defaults';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');

type Pedido = { status: number; respuesta: Record<string, unknown> };
type Salida = Record<string, Pedido> & { cuota7: Record<string, unknown>; cuota8: Record<string, unknown>; subidasCobrada: number; red: string[]; sinMock: string[] };
let salida: Salida | null = null;
const correr = (): Salida => {
  salida ??= JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx', join(RAIZ, 'tests/_recibo-ruta-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 120_000,
  })) as Salida;
  return salida;
};
const leido = (p: Pedido) => reciboLeido(p.respuesta) as ReciboLeido;

test('1. ⚠️ el comprobante llega en SU moneda: pesos en pesos (el valor en dólares, el de la cuota), dólares en dólares, nunca una tasa de la IA', () => {
  const s = correr();
  assert.deepEqual([s.red, s.sinMock], [[], []], 'nada salió de la base y el Storage de mentira');
  // Un SPEI de MX$5.000 justos, en un negocio en pesos: el monto en PESOS y el campo en dólares vacío (vale el de la cuota:
  // pago entero, sin «Faltan» y sin una cuota de diferencia inventada).
  assert.equal(s.pesos.status, 200);
  assert.deepEqual(leido(s.pesos), { monto: 5000, moneda: 'MXN', fecha: '2026-10-20', hora: '09:05', nota: null, nombre: 'recibo.jpg' });
  assert.deepEqual(plataDeRecibo(leido(s.pesos), 'MXN'), { plata: { moneda: 'MXN', monto: '5000', usd: '' }, aviso: null });
  assert.equal(s.cuota7.comprobante_nombre, 'recibo.jpg', 'el comprobante se guarda en la cuota, como siempre (no la marca)');
  assert.equal(s.cuota7.pagado, false);
  // En un negocio en dólares, un comprobante en pesos no se convierte: no llena el monto, y lo dice.
  assert.deepEqual(plataDeRecibo(leido(s.pesos), 'USD'), { plata: null, aviso: 'el comprobante está en MXN: carga el monto a mano' });
  // Un pago de menos en dólares: el monto en dólares (y «Faltan» sale de verdad).
  // (En un negocio en pesos, lo leído en dólares se llena, pero pide confirmar: un «$» solo suele ser la moneda local.)
  assert.deepEqual(plataDeRecibo(leido(s.dolares), 'MXN'), { plata: { moneda: 'USD', monto: '300', usd: '' }, aviso: 'leído en dólares: confírmalo (un «$» solo suele ser la moneda local)' });
  // Un prompt viejo (guardado en Configuraciones): su `monto_usd` NUNCA se usa (tercera revisión: la única señal de que
  // convirtió era que la IA escribiera la nota), y la pantalla dice que el monto no salió del comprobante.
  for (const k of ['viejoConvertido', 'viejoEnDolares', 'montoTexto']) {
    assert.equal(leido(s[k]).monto, null, `${k}: no llena nada`);
    assert.deepEqual(plataDeRecibo(leido(s[k]), 'MXN', 289.02), { plata: null, aviso: 'el monto no salió del comprobante: cárgalo a mano' }, k);
  }
  // «$5,000.00» que la IA etiquetó USD en un negocio en pesos: se llena, pero se pide confirmar (y es más del doble).
  assert.deepEqual(plataDeRecibo({ ...leido(s.pesos), moneda: 'USD' }, 'MXN', 289.02), {
    plata: { moneda: 'USD', monto: '5000', usd: '' },
    aviso: 'leído en dólares: confírmalo (un «$» solo suele ser la moneda local) · es más del doble de la cuota: confírmalo',
  });
  // En un negocio en dólares, sólo el aviso de más del doble.
  assert.deepEqual(plataDeRecibo({ ...leido(s.dolares), monto: 600 }, 'USD', 289.02).aviso, 'es más del doble de la cuota: confírmalo');
  assert.equal(plataDeRecibo(leido(s.dolares), 'USD', 289.02).aviso, null, 'un pago de menos en dólares, sin aviso');
  // Sin moneda legible: no se adivina.
  assert.deepEqual(plataDeRecibo(leido(s.sinMoneda), 'MXN'), { plata: null, aviso: 'el comprobante no dice la moneda: carga el monto a mano' });
  // El prompt de siempre ya no pide convertir.
  assert.doesNotMatch(RECEIPT_EXTRACT_DEFAULT, /conviért|tipo de cambio|monto_usd/i);
  assert.match(RECEIPT_EXTRACT_DEFAULT, /"monto": number\|null, "moneda": string\|null/);
  assert.match(RECEIPT_EXTRACT_DEFAULT, /NO lo conviertas/);
  assert.match(RECEIPT_EXTRACT_DEFAULT, /«\$», «MX\$» o «pesos» sin código NO son dólares/, 'un «$» solo no es USD');
  const ruta = leer('app/api/extract-receipt/route.ts');
  assert.doesNotMatch(ruta.replace(/^\s*\/\/.*$/gm, ''), /parsed\.monto_usd\)\s*;|= num\(parsed\.monto_usd\)/, 'el monto_usd de un prompt viejo nunca se usa');

  // La pantalla lee con ESAS funciones; el valor en dólares de la moneda del negocio, el de la cuota (`usdPorDefecto`).
  const piezas = leer('app/crm/lead-view/ficha/pagos/piezas.tsx');
  const marcar = piezas.slice(piezas.indexOf('export function MarcarPagada('), piezas.indexOf('export function RegistrarPago('));
  assert.match(marcar, /const j = reciboLeido\(await r\.json\(\)\.catch\(/);
  assert.match(marcar, /const p = plataDeRecibo\(j, monedaNegocio, valorUsd\);\s*if \(p\.plata\) setPlata\(p\.plata\);/);
  assert.match(marcar, /setLeido\(\{ nombre: j\.nombre \?\? file\.name, nota: \[j\.nota, p\.aviso\]\.filter\(Boolean\)\.join\(' · '\) \|\| null \}\);/, 'lo que no se llenó se dice');
  assert.doesNotMatch(marcar, /j\.monto\b|montoUsd/, 'nadie lee un monto en dólares de la IA');
  assert.match(piezas, /const dolares = numero\(p\.usd\) \?\? usdPorDefecto;/, 'vacío, el valor en dólares es el de la cuota');
});

test('2. ⚠️ una cuota ya cobrada no cambia de comprobante (ni se sube el archivo)', () => {
  const s = correr();
  assert.equal(s.cobrada.status, 409);
  assert.match(String(s.cobrada.respuesta.error), /ya está cobrada/);
  assert.deepEqual([s.cuota8.comprobante_path, s.cuota8.comprobante_nombre], ['3/101/comprobantes/banco.pdf', 'banco.pdf'], 'el del banco queda');
  assert.equal(s.subidasCobrada, 0, 'no se subió nada');
  const ruta = leer('app/api/extract-receipt/route.ts');
  assert.match(ruta, /\.eq\('lead_id', leadId\)\s*\.eq\('pagado', false\)\s*\.select\('id'\);/, 'y la escritura es condicional (otra pestaña en el medio)');
});

test('3. `reciboLeido` y `plataDeRecibo`: lo que no es un dato no llena nada, y el error de la ruta se dice', () => {
  assert.deepEqual(reciboLeido({ error: 'no se pudo parsear la respuesta', comprobante_nombre: 'x.jpg' }), { error: 'no se pudo parsear la respuesta' });
  assert.deepEqual(reciboLeido({ monto: null, moneda: null, fecha: null, hora: null, nota: null, comprobante_nombre: 'x.jpg' }),
    { monto: null, moneda: null, fecha: null, hora: null, nota: null, nombre: 'x.jpg' });
  for (const monto of ['300', 0, -5, Number.NaN]) assert.equal((reciboLeido({ monto, moneda: 'USD' }) as ReciboLeido).monto, null, `monto ${String(monto)}`);
  assert.equal((reciboLeido({ monto: 300, moneda: 'pesos' }) as ReciboLeido).moneda, null, 'una moneda que no es un código');
  assert.equal((reciboLeido({ monto: 300, moneda: 'usd' }) as ReciboLeido).moneda, 'USD');
  assert.equal((reciboLeido({ fecha: '20/10/2026' }) as ReciboLeido).fecha, null);
  assert.equal((reciboLeido({ fecha: '2026-10-20T10:00:00Z' }) as ReciboLeido).fecha, '2026-10-20');
  assert.equal((reciboLeido({ hora: '14:30:12' }) as ReciboLeido).hora, '14:30');
  assert.equal((reciboLeido({ hora: 'tarde' }) as ReciboLeido).hora, null);
  assert.equal((reciboLeido(null) as ReciboLeido).monto, null);
  assert.deepEqual(plataDeRecibo({ monto: 50, moneda: 'EUR', fecha: null, hora: null, nota: null, nombre: null }, 'MXN'), { plata: null, aviso: 'el comprobante está en EUR: carga el monto a mano' });
  assert.deepEqual(plataDeRecibo({ monto: null, moneda: null, fecha: null, hora: null, nota: null, nombre: null }, 'MXN'), { plata: null, aviso: null });
});

// ROTURAS (21/10/2026, segunda revisión). Base: 3 pases, 0 fallos. Rota (pases / fallos):
//   · la ruta acepta el monto que convirtió la IA (prompt viejo)          → 2 / 1 (1)
//   · un comprobante en pesos llena dólares                               → 2 / 1 (1)
//   · llena una moneda que no es la del negocio                           → 1 / 2 (1 y 3)
//   · el prompt vuelve a pedir convertir                                  → 2 / 1 (1)
//   · la ruta le pisa el comprobante a una cuota cobrada                  → 2 / 1 (2)
//   · la escritura del comprobante sin condición                          → 2 / 1 (2)
//   · el modal no dice lo que no llenó                                    → 2 / 1 (1)
//
// ROTURAS de la tercera revisión (21/10/2026). Base: 3 pases, 0 fallos. Rota (pases / fallos):
//   · el prompt no dice que «$» no es USD                                  → 2 / 1 (1)
//   · lo leído en USD en un negocio en pesos, sin aviso                   → 2 / 1 (1)
//   · más del doble de la cuota, sin aviso                                → 2 / 1 (1)
//   · el monto_usd de un prompt viejo vuelve a usarse                     → 2 / 1 (1)
//   · el monto no usado no se dice                                        → 2 / 1 (1)
//   · la pantalla no le pasa la cuota                                     → 2 / 1 (1)
