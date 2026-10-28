// =============================================================================
// «¿cuánto llevo gastado de octubre en meta ads?» lo contesta el código, con los datos y el estado de la cuenta (27/10/2026)
// =============================================================================
// MAU-04: Mauricio lo preguntó en su grupo y MaKo contestó que la IA lo rebotaba por límite. El dato estaba en
// `marketing_metrics_daily`, y su cuenta no gasta desde el 15/10 porque Meta la frenó por saldo impago: eso se dice así,
// nunca «sin sincronizar». lib/gasto-meta.ts, lib/gasto-meta-server.ts.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { esPreguntaDeGastoMeta, mesDelPedido, montoDelGasto, porQueNoGasta, textoGastoMeta } from '../lib/gasto-meta';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const OCT = mesDelPedido('cuanto llevo gastado de octubre en meta ads ?', '2026-10-27');
/** Un gasto de una cuenta que cobra en dólares. */
const usdDe = (n: number) => ({ cuenta: n, moneda: 'USD', usd: n });
const IMPAGO = { status: 3, statusLabel: 'Saldo impago', disableReasonLabel: null, nombre: 'Cuenta de Mauricio' };

test('1. la pregunta de Mauricio, y las parecidas, son de gasto de Meta; otras preguntas no', () => {
  for (const f of ['cuanto llevo gastado de octubre en meta ads ?', '¿Cuánto invertí en Facebook este mes?', 'qué gasto llevamos en anuncios', 'cuánto va gastado en las campañas'])
    assert.ok(esPreguntaDeGastoMeta(f), `«${f}»`);
  for (const f of ['¿cuántos leads entraron?', 'pausá la campaña del webinar', '¿cuánto vendí en octubre?'])
    assert.ok(!esPreguntaDeGastoMeta(f), `«${f}»`);
  // «va» y «van» enteros (la revisión adversarial de 92d23e11d): una palabra que empieza con «va» no es la pregunta.
  for (const f of ['¿Qué vamos a hacer con la campaña?', '¿qué valor tiene la campaña de Juan?', 'qué variantes de anuncios armo?'])
    assert.ok(!esPreguntaDeGastoMeta(f), `«${f}»`);
  assert.ok(esPreguntaDeGastoMeta('¿cuánto van en anuncios este mes?'));
});

test('1b. la plata en su moneda: dólares sólo con tasa; ARS o EUR sin tasa van en su moneda; sin moneda, no se inventa', () => {
  const con = (gasto: Parameters<typeof montoDelGasto>[0]) => textoGastoMeta({ mes: OCT, gasto, filasMeta: 20, ultimoDiaConGasto: '2026-10-27', cuenta: null });
  assert.equal(con({ cuenta: 1500000, moneda: 'ARS', usd: null }), 'En octubre llevas 1.500.000,00 ARS en Meta Ads (del 1/10 al 27/10).');
  assert.match(con({ cuenta: 2000, moneda: 'EUR', usd: null }), /llevas 2000,00 EUR en Meta Ads/);
  assert.match(con({ cuenta: 1500, moneda: null, usd: null }), /llevas 1500,00 en la moneda de tu cuenta de Meta \(no la pude leer\) en Meta Ads/);
  assert.match(con({ cuenta: 1730, moneda: 'MXN', usd: 100 }), /llevas US\$ 100,00 \(1730,00 MXN\) en Meta Ads/);
  for (const g of [{ cuenta: 1500000, moneda: 'ARS', usd: null }, { cuenta: 1500, moneda: null, usd: null }]) assert.doesNotMatch(montoDelGasto(g), /US\$/);
  // El servidor convierte con `aUsd` (null sin tasa), nunca con el `spend_usd` de la ventana.
  const srv = leer('lib/gasto-meta-server.ts').replace(/^\s*\/\/.*$/gm, '');
  assert.match(srv, /usd: conv \? conv\.aUsd\(enLaCuenta\) : null/);
  assert.doesNotMatch(srv, /spend_usd|getMarketingWindow\(/);
});

test('1c. período de gracia (y revisión, liquidación): se dice el estado, nunca «frenó»', () => {
  const gracia = { status: 9, statusLabel: 'En período de gracia', nombre: 'Cuenta de Leila' };
  assert.equal(porQueNoGasta(gracia), null);
  const t = textoGastoMeta({ mes: OCT, gasto: usdDe(50), filasMeta: 10, ultimoDiaConGasto: '2026-10-27', cuenta: gracia });
  assert.equal(t, 'En octubre llevas US$ 50,00 en Meta Ads (del 1/10 al 27/10). Ojo: Meta tiene la cuenta «Cuenta de Leila» en espera (en período de gracia), aunque sigue entregando.');
  assert.doesNotMatch(t, /frenó|no gasta/);
});

test('2. el mes: el que nombra, del 1 a hoy; un mes que no llegó es del año pasado; sin mes, el actual', () => {
  assert.deepEqual(OCT, { desde: '2026-10-01', hasta: '2026-10-27', nombre: 'octubre' });
  assert.deepEqual(mesDelPedido('cuánto gasté en septiembre en meta', '2026-10-27'), { desde: '2026-09-01', hasta: '2026-09-30', nombre: 'septiembre' });
  assert.equal(mesDelPedido('cuánto gasté en diciembre en ads', '2026-10-27').desde, '2025-12-01');
  assert.equal(mesDelPedido('cuánto llevo gastado en meta', '2026-10-27').nombre, 'octubre');
});

test('3. MAU-04: frenada por saldo impago desde el 15/10 → el gasto del mes y desde cuándo no gasta, sin «sin sincronizar»', () => {
  const t = textoGastoMeta({ mes: OCT, gasto: usdDe(312.4), filasMeta: 15, ultimoDiaConGasto: '2026-10-15', cuenta: IMPAGO });
  assert.equal(t, 'En octubre llevas US$ 312,40 en Meta Ads (del 1/10 al 27/10). Desde el 15/10 no gasta: Meta frenó la cuenta «Cuenta de Mauricio» por saldo impago.');
  assert.doesNotMatch(t, /sincroniz/);
});

test('4. sin datos: si la cuenta está frenada lo dice; si no, un «no lo tengo» honesto; nunca un cero inventado', () => {
  assert.match(textoGastoMeta({ mes: OCT, gasto: usdDe(0), filasMeta: 0, ultimoDiaConGasto: '2026-09-28', cuenta: IMPAGO }), /^En octubre no hay gasto de Meta Ads: Meta frenó la cuenta «Cuenta de Mauricio» por saldo impago/);
  assert.match(textoGastoMeta({ mes: OCT, gasto: usdDe(0), filasMeta: 0, ultimoDiaConGasto: null, cuenta: null }), /^No tengo gasto de Meta Ads de octubre: no hay ni un dato de Meta/);
  assert.match(textoGastoMeta({ mes: OCT, gasto: null, filasMeta: null, ultimoDiaConGasto: null, cuenta: null }), /^No tengo el gasto de Meta Ads de octubre: no pude leer tus números ahora\.$/);
  // Una cuenta que entrega no dice nada de más.
  assert.equal(porQueNoGasta({ status: 1, statusLabel: 'Activa' }), null);
  assert.equal(textoGastoMeta({ mes: OCT, gasto: usdDe(10), filasMeta: 3, ultimoDiaConGasto: '2026-10-27', cuenta: { status: 1, statusLabel: 'Activa' } }), 'En octubre llevas US$ 10,00 en Meta Ads (del 1/10 al 27/10).');
});

test('5. el doer pone el gasto ANTES del aviso de la IA, y la herramienta no adivina «sin sincronizar»', () => {
  const doer = leer('lib/mako-doer-in.ts');
  assert.match(doer, /if \(esPreguntaDeGastoMeta\(sinPrefijoDeLote\(texto\)\)\) \{\n\s*const gasto = await \(await import\('@\/lib\/gasto-meta-server'\)\)\.respuestaDeGastoMeta\(sinPrefijoDeLote\(texto\)\)\.catch\(\(\) => null\);\n\s*if \(gasto\) respuesta = `\$\{gasto\}\\n\\n\$\{respuesta\}`;/);
  assert.doesNotMatch(leer('lib/api-mako/areas/metricas.run.ts'), /sin conectar o sin sincronizar/);
});
