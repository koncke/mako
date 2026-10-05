// =============================================================================
// El DESHACER de un movimiento de entrega devuelve también el RELOJ de la etapa
// =============================================================================
// El deshacer llega al choke point (`moverClienteDeEtapa`) como un movimiento más, y un
// movimiento escribe `etapa_desde = ahora`. Sin el reloj previo, un cliente trabado hace
// tres semanas —el rojo de «En la etapa»— que alguien arrastró por error y devolvió con el
// toast quedaba como recién llegado en la base, mientras la pantalla seguía mostrando la
// fecha vieja hasta el próximo F5. Encontrado el 05/10/2026 leyendo el código al verificar
// la integración del lote (workflow cs-tabla-lote-editor).
//
// Dos capas: `relojDeVuelta` se EJECUTA (es lo que valida lo que manda el navegador), y el
// cableado se lee de las tres piezas por donde viaja el dato — la pantalla que lo manda, las
// dos actions que lo pasan y el upsert que lo escribe. Sin cualquiera de las tres, el reloj
// se pierde en silencio: el tipo es opcional a propósito, así que el typecheck no ve nada.
//
// PROBADO ROMPIÉNDOLO (05/10/2026), una rotura por vez y restaurando desde memoria; cada
// una dio 6 pass / 1 fail, y el que cayó fue siempre el suyo:
//   · el upsert con `etapa_desde: ahora` → «el upsert escribe el reloj validado».
//   · `relojDeVuelta` sin el `t > ahora` → «una fecha del futuro no se escribe».
//   · el deshacer de UNO sin `previa.etapa_desde` → «el deshacer de una tarjeta».
//   · el deshacer del LOTE con `relojPrevio: null` → «el deshacer del lote».
//   · la action de lote sin `relojPrevio: m.relojPrevio` → «las dos actions».
//   Restaurado: 7 pass / 0 fail.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { relojDeVuelta } from '../lib/servicio-etapas';

const raiz = join(__dirname, '..');
// Sin comentarios: los de estos archivos CITAN el campo al explicarlo, y un guard de cableado
// que lee prosa da verde sobre el código roto. Las líneas primero y los bloques después.
const sinComentarios = (src: string) => src
  .replace(/\r/g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (ruta: string) => sinComentarios(readFileSync(join(raiz, ruta), 'utf8'));

const AHORA = Date.parse('2026-10-05T12:00:00Z');

test('el reloj de antes vuelve tal cual', () => {
  assert.equal(relojDeVuelta('2026-09-14T08:30:00.000Z', AHORA), '2026-09-14T08:30:00.000Z');
  // Normaliza el formato: lo que se escribe es un ISO, venga como venga.
  assert.equal(relojDeVuelta('2026-09-14T05:30:00-03:00', AHORA), '2026-09-14T08:30:00.000Z');
});

test('sin reloj, o ilegible: null (el que llama usa «ahora», que es lo de siempre)', () => {
  assert.equal(relojDeVuelta(null, AHORA), null);
  assert.equal(relojDeVuelta(undefined, AHORA), null);
  assert.equal(relojDeVuelta('', AHORA), null);
  assert.equal(relojDeVuelta('no es una fecha', AHORA), null);
});

test('una fecha del futuro no se escribe', () => {
  assert.equal(relojDeVuelta(new Date(AHORA + 60_000).toISOString(), AHORA), null);
  assert.equal(relojDeVuelta(new Date(AHORA).toISOString(), AHORA), new Date(AHORA).toISOString());
});

test('el upsert escribe el reloj validado, y «ahora» sólo si no hay uno', () => {
  const src = leer('lib/cs-mover-etapa.ts');
  const ini = src.indexOf(".from('cliente_entrega').upsert(");
  assert.ok(ini > 0, 'no encontré el upsert de cliente_entrega');
  const bloque = src.slice(ini, src.indexOf('onConflict', ini));
  assert.ok(bloque.length < 400, `el recorte mide ${bloque.length}: está mirando otra cosa`);
  assert.match(bloque, /etapa_desde:\s*relojDeVuelta\(pedido\.relojPrevio\)\s*\?\?\s*ahora/);
});

test('las dos actions le pasan el reloj al choke point', () => {
  const src = leer('app/customer-success/actions.ts');
  assert.match(src, /moverClienteDeEtapa\(\{\s*leadId,\s*productoId,\s*etapa,\s*relojPrevio\s*\}\)/);
  assert.match(src, /moverClienteDeEtapa\(\{\s*leadId,\s*productoId,\s*etapa:\s*m\.etapa,\s*relojPrevio:\s*m\.relojPrevio\s*\}\)/);
});

test('el deshacer de una tarjeta manda el reloj que tenía', () => {
  const src = leer('app/customer-success/ClientesApp.tsx');
  assert.match(src, /if \(previa\) moverEntrega\(leadId, previa\.etapa, prodId, false, previa\.etapa_desde\)/);
  assert.match(src, /moverEntregaAction\(leadId, prodId, etapa, relojPrevio\)/);
});

test('el deshacer del lote manda el reloj de cada cliente', () => {
  const src = leer('app/customer-success/ClientesApp.tsx');
  const ini = src.indexOf('const volver = movidos.map(');
  assert.ok(ini > 0, 'no encontré el deshacer del lote');
  const bloque = src.slice(ini, src.indexOf('});', ini) + 3);
  assert.ok(bloque.length < 400, `el recorte mide ${bloque.length}: está mirando otra cosa`);
  assert.match(bloque, /relojPrevio:\s*p\?\.etapa_desde/);
});
