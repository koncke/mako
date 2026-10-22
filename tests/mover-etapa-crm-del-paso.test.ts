// «Mover de etapa» corre en el CRM que eligió el paso (21/10/2026, la prospección del Sprint de Mauricio)
// =============================================================================
// El control de etapa del lienzo guarda el producto (`embudoId`) y el flujo lo tiraba: `proponer_cambio_etapa`
// movía SIEMPRE la casa. Con los leads AGREGADOS a un CRM de prospección (su casa es el CRM principal), «Mover a
// Contactado» escribía la key `contactado` en su etapa PRINCIPAL —una etapa que ese CRM no tiene, y que el tablero
// dibuja en la primera columna— y la tarjeta del CRM nuevo no se movía. Para 1.094 leads de Mauricio.
//
// Se fija la decisión (`crmDelPaso` / `dondeMoverEtapa`, ejecutadas) y el cableado en lib/api-mako/flujo.ts (que es
// server-only: del fuente sólo se lee eso). ⚠️ PROBADO ROMPIÉNDOLO: los números van al pie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { crmDelPaso, dondeMoverEtapa } from '../lib/editor-acciones';

const PRINCIPAL = 1;
const SPRINT = 40;
/** Un lead de Mauricio: casa en el principal, agregado al Sprint (lo que arma `productosDe`). */
const SUYOS = [{ funnelId: PRINCIPAL, esCasa: true }, { funnelId: SPRINT, esCasa: false }];

test('el CRM del paso: un número de embudo, o nada', () => {
  assert.equal(crmDelPaso(SPRINT), SPRINT);
  assert.equal(crmDelPaso(String(SPRINT)), SPRINT);
  for (const nada of [undefined, null, '', ' ', 'x', 0, -3, 1.5, NaN]) assert.equal(crmDelPaso(nada), null, `«${String(nada)}» no es un CRM`);
});

test('en el CRM agregado mueve SU tarjeta; en la casa, la casa', () => {
  assert.equal(dondeMoverEtapa(SPRINT, SUYOS, null), 'agregado');
  assert.equal(dondeMoverEtapa(PRINCIPAL, SUYOS, null), 'casa');
});

test('en un CRM donde el lead no está, no se mueve nada', () => {
  assert.equal(dondeMoverEtapa(99, SUYOS, false), 'fuera');
  assert.equal(dondeMoverEtapa(SPRINT, [{ funnelId: PRINCIPAL, esCasa: true }], false), 'fuera');
});

test('LO DE ANTES no se rompe: la etapa existe en su casa, o su casa no se pudo resolver → la casa', () => {
  // Una automatización sin CRM con «Mover a Ganado» guardado con el principal, sobre un lead cuya casa es otro CRM.
  const casaEnOtro = [{ funnelId: 77, esCasa: true }];
  assert.equal(dondeMoverEtapa(PRINCIPAL, casaEnOtro, true), 'casa');
  assert.equal(dondeMoverEtapa(PRINCIPAL, casaEnOtro, false), 'fuera');
  // El CRM del negocio ilegible: la casa NULL no aparece en la lista. Un error de lectura no apaga el paso.
  assert.equal(dondeMoverEtapa(PRINCIPAL, [{ funnelId: SPRINT, esCasa: false }], null), 'casa');
});

// ── El cableado en el flujo ─────────────────────────────────────────────────────────────────────────────────────
const flujo = readFileSync(join(__dirname, '..', 'lib/api-mako/flujo.ts'), 'utf8').replace(/\r\n/g, '\n');
const ini = flujo.indexOf('async function moverEnElCrmDelPaso(');
const rama = ini < 0 ? '' : flujo.slice(ini, flujo.indexOf('\n}\n', ini));

test('el flujo lee el CRM de lo GUARDADO (la def no lo declara) y le pregunta al lead dónde está', () => {
  assert.ok(ini > 0, 'no encontré moverEnElCrmDelPaso');
  assert.match(flujo, /if \(def\.id === OP_MOVER_ETAPA\) \{\n\s+const r = await moverEnElCrmDelPaso\(tandas\[0\], input, ctx, opts\);\n\s+if \(r\) return r;/,
    'ejecutarDesdeFlujo la llama con lo guardado (tandas[0]), antes de proponer');
  assert.match(rama, /crmDelPaso\(\(guardado \?\? \{\}\)\?\.embudoId\)/, 'el embudoId sale de los params guardados, no de `input` (paramsDelPaso lo saca)');
  assert.match(rama, /productosDelLead\(leadId\)/);
});

test('agregado → mover_lead_en_producto con ESE crm; fuera → no mueve y lo dice', () => {
  assert.match(rama, /if \(donde === 'fuera'\) return \{ ok: false/);
  assert.match(rama, /if \(donde !== 'agregado'\) return null;[\s\S]*porId\(OP_MOVER_EN_PRODUCTO\)[\s\S]*embudoId: crm[\s\S]*aplicarEnElActo\(enProducto, mover/);
  assert.match(flujo, /const OP_MOVER_EN_PRODUCTO = 'mover_lead_en_producto';/);
  // Sin poder leer los CRM del lead NO se cae a la casa (eso es justo el bug): falla.
  assert.match(rama, /catch \(e\) \{\s*return \{ ok: false, resumen: `No moví de etapa: no pude leer/);
});

// ── Las roturas (6 tests; sin romper nada: 6 pases, 0 fallos) ──────────────────────────────────────────────────────
// 1. `dondeMoverEtapa` sin mirar `esCasa` (todo «agregado»): 1 fallo / 5 pases.
// 2. `dondeMoverEtapa` devolviendo «casa» cuando no está y la etapa NO existe en la casa: 2 fallos / 4 pases.
// 3. El flujo leyendo `input.embudoId` (que `paramsDelPaso` ya sacó: la rama no corre nunca): 1 fallo / 5 pases.
// 4. El flujo sin la salida de «fuera»: 1 fallo / 5 pases.
// 5. El catch cayendo a la casa (sin `return`): 1 fallo / 5 pases.
// 6. Sin «lo de antes» (fuera aunque la etapa exista en la casa): 1 fallo / 5 pases.
// 7. `ejecutarDesdeFlujo` sin llamar a `moverEnElCrmDelPaso`: 1 fallo / 5 pases.
