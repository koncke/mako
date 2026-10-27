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
import { esPreguntaDeGastoMeta, mesDelPedido, porQueNoGasta, textoGastoMeta } from '../lib/gasto-meta';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const OCT = mesDelPedido('cuanto llevo gastado de octubre en meta ads ?', '2026-10-27');
const IMPAGO = { status: 3, statusLabel: 'Saldo impago', disableReasonLabel: null, nombre: 'Cuenta de Mauricio' };

test('1. la pregunta de Mauricio, y las parecidas, son de gasto de Meta; otras preguntas no', () => {
  for (const f of ['cuanto llevo gastado de octubre en meta ads ?', '¿Cuánto invertí en Facebook este mes?', 'qué gasto llevamos en anuncios', 'cuánto va gastado en las campañas'])
    assert.ok(esPreguntaDeGastoMeta(f), `«${f}»`);
  for (const f of ['¿cuántos leads entraron?', 'pausá la campaña del webinar', '¿cuánto vendí en octubre?'])
    assert.ok(!esPreguntaDeGastoMeta(f), `«${f}»`);
});

test('2. el mes: el que nombra, del 1 a hoy; un mes que no llegó es del año pasado; sin mes, el actual', () => {
  assert.deepEqual(OCT, { desde: '2026-10-01', hasta: '2026-10-27', nombre: 'octubre' });
  assert.deepEqual(mesDelPedido('cuánto gasté en septiembre en meta', '2026-10-27'), { desde: '2026-09-01', hasta: '2026-09-30', nombre: 'septiembre' });
  assert.equal(mesDelPedido('cuánto gasté en diciembre en ads', '2026-10-27').desde, '2025-12-01');
  assert.equal(mesDelPedido('cuánto llevo gastado en meta', '2026-10-27').nombre, 'octubre');
});

test('3. MAU-04: frenada por saldo impago desde el 15/10 → el gasto del mes y desde cuándo no gasta, sin «sin sincronizar»', () => {
  const t = textoGastoMeta({ mes: OCT, gastoUsd: 312.4, filasMeta: 15, ultimoDiaConGasto: '2026-10-15', cuenta: IMPAGO });
  assert.equal(t, 'En octubre llevas US$ 312,40 en Meta Ads (del 1/10 al 27/10). Desde el 15/10 no gasta: Meta frenó la cuenta «Cuenta de Mauricio» por saldo impago.');
  assert.doesNotMatch(t, /sincroniz/);
});

test('4. sin datos: si la cuenta está frenada lo dice; si no, un «no lo tengo» honesto; nunca un cero inventado', () => {
  assert.match(textoGastoMeta({ mes: OCT, gastoUsd: 0, filasMeta: 0, ultimoDiaConGasto: '2026-09-28', cuenta: IMPAGO }), /^En octubre no hay gasto de Meta Ads: Meta frenó la cuenta «Cuenta de Mauricio» por saldo impago/);
  assert.match(textoGastoMeta({ mes: OCT, gastoUsd: 0, filasMeta: 0, ultimoDiaConGasto: null, cuenta: null }), /^No tengo gasto de Meta Ads de octubre: no hay ni un dato de Meta/);
  assert.match(textoGastoMeta({ mes: OCT, gastoUsd: null, filasMeta: null, ultimoDiaConGasto: null, cuenta: null }), /^No tengo el gasto de Meta Ads de octubre: no pude leer tus números ahora\.$/);
  // Una cuenta que entrega no dice nada de más.
  assert.equal(porQueNoGasta({ status: 1, statusLabel: 'Activa' }), null);
  assert.equal(textoGastoMeta({ mes: OCT, gastoUsd: 10, filasMeta: 3, ultimoDiaConGasto: '2026-10-27', cuenta: { status: 1, statusLabel: 'Activa' } }), 'En octubre llevas US$ 10,00 en Meta Ads (del 1/10 al 27/10).');
});

test('5. el doer pone el gasto ANTES del aviso de la IA, y la herramienta no adivina «sin sincronizar»', () => {
  const doer = leer('lib/mako-doer-in.ts');
  assert.match(doer, /if \(esPreguntaDeGastoMeta\(sinPrefijoDeLote\(texto\)\)\) \{\n\s*const gasto = await \(await import\('@\/lib\/gasto-meta-server'\)\)\.respuestaDeGastoMeta\(sinPrefijoDeLote\(texto\)\)\.catch\(\(\) => null\);\n\s*if \(gasto\) respuesta = `\$\{gasto\}\\n\\n\$\{respuesta\}`;/);
  assert.doesNotMatch(leer('lib/api-mako/areas/metricas.run.ts'), /sin conectar o sin sincronizar/);
});
