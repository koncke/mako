// =============================================================================
// El tope de líneas de WhatsApp del plan (23/10/2026)
// =============================================================================
// El Cerebro: «Hacé cumplir `topeDe(capa, 'chats.lineas_whatsapp')` con `cabeOtra` al conectar una línea nueva, con un
// cartel corto `textoTope(n)` y «Pasar a Pro». REGLA: sólo a negocios que MaKo cobra por la pasarela
// (`suscripcionDeMakoDe(ws) != null`), nunca al ws1 ni a los acuerdos a mano. Una línea ya conectada nunca se desconecta
// por el tope». La regla es lib/tope-lineas.ts; la usa `conectar({ nueva: true })` (lib/evolution.ts).
//
// PROBADO ROMPIÉNDOLO (23/10/2026, arnés `romper-topes.mjs` del scratchpad de la sesión de Offer; base 3/0, 11 de 11 cazadas): ver la lista
// al pie de este archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { topeParaLineaNueva } from '../lib/tope-lineas';
import { RUTA_CAMBIAR_PLAN, textoTope } from '../lib/topes-plan';

const leer = (r: string) => readFileSync(join(__dirname, '..', r), 'utf8').replace(/\r\n/g, '\n');

test('1. la regla: Esencial 1, Pro 3, y sólo a quien MaKo le cobra el plan por la pasarela', () => {
  const cobrado = { ws: 40, cobradoPorPasarela: true };
  assert.deepEqual(topeParaLineaNueva({ ...cobrado, capa: 'completo', usadas: 0 }), { ok: true }, 'la primera línea siempre');
  assert.deepEqual(topeParaLineaNueva({ ...cobrado, capa: 'completo', usadas: 1 }), { ok: false, tope: 1, texto: textoTope(1) });
  assert.deepEqual(topeParaLineaNueva({ ...cobrado, capa: 'agencia', usadas: 2 }), { ok: true });
  assert.deepEqual(topeParaLineaNueva({ ...cobrado, capa: 'agencia', usadas: 3 }), { ok: false, tope: 3, texto: textoTope(3) });
  // Una capa que no es un plan (la de la plataforma, un PM) no tiene tope.
  assert.deepEqual(topeParaLineaNueva({ ...cobrado, capa: 'superadmin', usadas: 9 }), { ok: true });
  // Un acuerdo a mano (sin cobro por la pasarela) también tiene capa `completo`: nunca entra al tope.
  assert.deepEqual(topeParaLineaNueva({ ws: 40, cobradoPorPasarela: false, capa: 'completo', usadas: 5 }), { ok: true });
  // El ws1 (Mauricio), nunca, aunque algún día tuviera un cobro.
  assert.deepEqual(topeParaLineaNueva({ ws: 1, cobradoPorPasarela: true, capa: 'completo', usadas: 5 }), { ok: true });
  assert.equal(RUTA_CAMBIAR_PLAN, '/configuraciones/plan', 'quien ve el tope ya es cliente: el panel de su plan, no la compra');
});

test('2. conectar: el tope frena SÓLO la línea que se va a crear, antes de su fila, y si no se lee el plan deja conectar', () => {
  const ev = leer('lib/evolution.ts');
  const nueva = ev.slice(ev.indexOf('  if (opts.nueva) {'), ev.indexOf('    instance = await lineaEstricta(opts.linea);'));
  assert.match(nueva, /const tope = await topeDeLineaNueva\(ws, lineas\.length\);\n {4}if \(!tope\.ok\) return \{ ok: false, error: tope\.texto, tope: tope\.tope \};\n {4}instance = nombreLineaNueva/, 'el tope, antes de nombrar y escribir la línea nueva');
  // Reconectar una que ya existe (el «↻ Nuevo QR») no pasa por el tope: una línea conectada nunca se corta por él.
  assert.equal([...ev.matchAll(/topeDeLineaNueva\(/g)].length, 2, 'sólo la definición y la llamada de la línea nueva');
  assert.doesNotMatch(ev, /tope[^\n]*desconectar\(|desconectar\([^\n]*tope/i, 'el tope nunca desconecta');
  const helper = ev.slice(ev.indexOf('async function topeDeLineaNueva'), ev.indexOf('async function topeDeLineaNueva') + 900);
  assert.match(helper, /cobradoPorPasarela: await aplicanTopes\(ws\)/, 'el plan cobrado por la pasarela, o una cuenta de agencia');
  assert.match(helper, /\} catch \(e\) \{\n[^\n]*\n {4}return \{ ok: true \};/, 'sin poder leer el plan, deja conectar');
});

test('3. la ruta y la pantalla: un 403 con el tope, y el cartel corto con «Pasar a Pro» (no en rojo)', () => {
  const ruta = leer('app/api/whatsapp/evolution/route.ts');
  assert.match(ruta, /import \{ RUTA_CAMBIAR_PLAN \} from '@\/lib\/topes-plan';/, 'la ruta de «Pasar a Pro» es la de Planes, no una propia');
  assert.match(ruta, /if \(!r\.ok && r\.tope != null\) return Response\.json\(\{ ok: false, error: r\.error, tope: r\.tope, pasarAPro: RUTA_CAMBIAR_PLAN \}, \{ status: 403 \}\);/);
  const pantalla = leer('app/whatsapp/EvolutionConnect.tsx');
  assert.match(pantalla, /if \(!body\.ok && body\.tope != null && body\.pasarAPro\) \{ setTope\(\{ texto: body\.error \?\? '', pasarAPro: body\.pasarAPro \}\); return; \}/);
  assert.equal([...pantalla.matchAll(/\{tope && <CartelTope \{\.\.\.tope\} \/>\}/g)].length, 2, 'en el panel y en el modal');
  // La ventana termina donde termina la función (era un +700, y el envoltorio del 6/11 corrió el `<a>` más abajo).
  const desde = pantalla.indexOf('function CartelTope');
  const cartel = pantalla.slice(desde, pantalla.indexOf('\n}', desde));
  assert.match(cartel, /<a href=\{pasarAPro\}[^>]*>Pasar a Pro<\/a>/);
  // El cliente de una agencia no compra la línea: el link va envuelto (6/11/2026, #494; tests/cliente-de-agencia-y-partners-2910.test.ts).
  assert.match(cartel, /<CtaPasarAPro>/);
  assert.doesNotMatch(cartel, /var\(--bad/, 'el tope no es un error');
});

// Las roturas del arnés (cada una, en rojo): el tope a un acuerdo a mano · el tope al ws1 · Pro con el tope de Esencial ·
// el tope también al reconectar · sin poder leer el plan, no deja conectar · todos como cobrados · la ruta sin el 403 ·
// la pantalla sin el cartel · el cartel sin «Pasar a Pro» · el cartel en rojo, como un error · una ruta propia para «Pasar a Pro».
