// EL CÓDIGO DEL ONBOARDING VENCIDO: MaKo ARMA UNO NUEVO, NUNCA SE CALLA NI MANDA EL VENCIDO (19/11/2026).
//
// Martín probó el onboarding nuevo a las 22:05 UTC y el código no salió (otro bug, tests/escribio-bajo-lid.test.ts). Cuando volvió a
// probar, la verificación de ws 3 había vencido a las 22:35: escribir «Hola, quiero confirmar mi WhatsApp.» daba `'vencido'` y MaKo se
// callaba, y «Reenviar el código» le mandaba el vencido. Con el tope de 5 intentos pasaba lo mismo: el cartel dice «vuelve a mandarme
// el mensaje: te mando uno nuevo» y MaKo le mandaba el MISMO. Ahora, vencido o con el tope lleno, el código es NUEVO.
// Desde el 20/11 a la tarde (wa-f3, el Cerebro) «Reenviar» ya no manda nada: abre WhatsApp, y el código nuevo sale cuando ella escribe.
// docs/hallazgos-comunicacion.md.
//
// PROBADO ROMPIÉNDOLO (19/11/2026), cada rotura por separado y vuelta atrás:
//   V1 `hayQueRenovarV2` sin el tope de intentos                  → falla «vencido o con el tope lleno»
//   V2 `renovarCodigoV2` sin poner los intentos en cero          → falla «el código nuevo»
//   V3 `responderPedidoV2` vuelve a callarse con el vencido      → falla «escribir con el código vencido»
//   V4 «Reenviar» vuelve a mandar el código (renovado o no)       → falla «Reenviar con el código vencido»
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decidirCodigoV2, decidirPedidoV2, hayQueRenovarV2, renovarCodigoV2, MINUTOS_ENTRANTE, TOPE_INTENTOS_V2, E_CODIGO_V2, E_REESCRIBIR_V2,
  type EstadoVerificacion,
} from '../lib/verificacion-entrante';
import { fuenteSinComentarios } from './_fuente-sin-comentarios';

// La verificación del ws 3 como quedó el 19/11 (números cambiados): respondida a las 22:05, vencida a las 22:35.
const VENCE = Date.parse('2026-11-19T22:35:02.815Z');
const WS3: EstadoVerificacion = {
  telefono: '5493700000479', destino: '5493700000479', nombre: 'Antonio', codigo: '637322', expira: VENCE, verificado: false,
  entrante: true, v2: true, respondido: true, intentos: 0, linea: 'mako_superadmin_mwo1bdvw', numeroLinea: '5491100002605',
};
const VUELVE = Date.parse('2026-11-19T23:42:58Z');

function bloque(src: string, desde: string, hasta: string): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré: ${desde}`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré el cierre: ${hasta}`);
  return src.slice(i, j);
}

test('vencido o con el tope lleno hay que renovar; vigente y con intentos, no', () => {
  assert.equal(hayQueRenovarV2(WS3, VUELVE), true, 'el caso de Martín: volvió una hora después');
  assert.equal(hayQueRenovarV2(WS3, VENCE - 60_000), false);
  assert.equal(hayQueRenovarV2({ ...WS3, intentos: TOPE_INTENTOS_V2 }, VENCE - 60_000), true, 'el tope lleno también');
  assert.equal(hayQueRenovarV2({ ...WS3, intentos: TOPE_INTENTOS_V2 - 1 }, VENCE - 60_000), false);
});

test('el código nuevo: otro número, otra media hora, intentos en cero; el resto igual', () => {
  const nuevo = renovarCodigoV2({ ...WS3, intentos: TOPE_INTENTOS_V2 }, VUELVE, '204817');
  assert.equal(nuevo.codigo, '204817');
  assert.equal(nuevo.expira, VUELVE + MINUTOS_ENTRANTE * 60_000);
  assert.equal(nuevo.intentos, 0);
  for (const k of ['telefono', 'destino', 'linea', 'numeroLinea', 'v2', 'entrante', 'verificado', 'respondido'] as const) assert.equal(nuevo[k], WS3[k], k);
  assert.deepEqual(decidirCodigoV2(nuevo, '204817', VUELVE + 60_000), { ok: true }, 'el nuevo sirve');
  assert.deepEqual(decidirCodigoV2(nuevo, '637322', VUELVE + 60_000), { ok: false, error: E_CODIGO_V2, suma: true }, 'el vencido ya no');
});

test('escribir con el código vencido: MaKo contesta con uno nuevo, nunca se calla', () => {
  assert.equal(decidirPedidoV2(WS3, { instancia: 'mako_superadmin_mwo1bdvw', telefono: '5493700000479', ahora: VUELVE }), 'renovar');
  const src = fuenteSinComentarios('lib/mako-grupo.ts');
  const r = bloque(src, 'export async function responderPedidoV2(', 'export async function reenviarCodigoV2(');
  assert.match(r, /if \(d === 'ya-verificado'\) return \{ resultado:/, 'el único que no contesta es el ya verificado');
  assert.doesNotMatch(r, /if \(d !== 'responder'\) return/, 'volvió el silencio con el vencido');
  assert.match(r, /const base = d === 'renovar' \? renovarCodigoV2\(v!, Date\.now\(\), codigoNumerico\(\)\) : v!;/);
  assert.match(r, /const anotado: EstadoVerificacion = \{ \.\.\.base,/);
});

test('«Reenviar» con el código vencido: no manda nada, abre WhatsApp; el nuevo sale cuando ella escribe (wa-f3, 20/11 a la tarde)', () => {
  const src = fuenteSinComentarios('lib/mako-grupo.ts');
  const r = bloque(src, 'export async function reenviarCodigoV2(', 'export async function verificarCodigoV2(');
  assert.doesNotMatch(r, /mandarCodigoV2|guardarVerificacion/, 'volvió a mandar (o a renovar) desde «Reenviar»');
  assert.ok(r.includes('return { ok: false, error: E_REESCRIBIR_V2 };'), 'la tarjeta abre WhatsApp con el pedido escrito');
  assert.match(E_REESCRIBIR_V2, /Abrir WhatsApp/);
  // El código nuevo lo arma la respuesta a su mensaje (el test de arriba, «escribir con el código vencido»).
  const responder = bloque(src, 'export async function responderPedidoV2(', 'export async function reenviarCodigoV2(');
  assert.ok(responder.includes('renovarCodigoV2(v!, Date.now(), codigoNumerico())'));
});
