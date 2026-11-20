// «HOLA, QUIERO CONFIRMAR MI WHATSAPP» Y MaKo NO CONTESTÓ: LA REGLA 1 NO VEÍA A QUIEN ESCRIBIÓ BAJO UN `@lid` (19/11/2026).
//
// El onboarding nuevo (desplegado a las 21:28 UTC) le pide a la persona que le escriba a MaKo, y MaKo le contesta con el código. Martín
// probó con el cliente de prueba: el mensaje llegó a la línea nueva a las 22:05:31 y la verificación quedó «respondido», pero el código
// nunca salió. En la línea recién vinculada el chat quedó guardado como `remoteJid: …4969@lid`, con el teléfono en `remoteJidAlt`, y la
// regla 1 («MaKo no le escribe primero a quien nunca le escribió», `leEscribioALaLinea`) buscaba sólo `remoteJid === 549…@s.whatsapp.net`:
// dijo «nunca le escribió» a quien le acababa de escribir. docs/hallazgos-comunicacion.md.
//
// PROBADO ROMPIÉNDOLO (19/11/2026), cada rotura por separado y vuelta atrás:
//   W1 la regla sin `remoteJidAlt`/`senderPn`                     → falla «la fila real de Martín»
//   W2 la regla cuenta también lo que mandó MaKo (`fromMe`)        → falla «sólo lo que entró»
//   W3 `leEscribioALaLinea` sin la segunda lectura                 → falla «la línea mira lo último que entró»
//   W4 el código que no salió deja la verificación «respondido»    → falla «sin código no queda respondido»
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leEscribioEnLasFilas, type FilaQuienEscribio } from '../lib/mako-salida-reglas';
import { fuenteSinComentarios } from './_fuente-sin-comentarios';

// La fila como la guardó Evolution en `mako_superadmin_mwo1bdvw` el 19/11 a las 22:05:31 UTC, con los números cambiados.
const TEL = '5493700000479';
const FILA_REAL: FilaQuienEscribio = { key: { fromMe: false, remoteJid: '100000000004969@lid', remoteJidAlt: `${TEL}@s.whatsapp.net` } };

function bloque(src: string, desde: string, hasta: string): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré: ${desde}`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré el cierre: ${hasta}`);
  return src.slice(i, j);
}

test('la fila real de Martín: escribió, aunque el chat esté bajo un @lid', () => {
  assert.equal(leEscribioEnLasFilas([FILA_REAL], TEL), true);
  assert.equal(leEscribioEnLasFilas([FILA_REAL], `${TEL}@s.whatsapp.net`), true);
  assert.equal(leEscribioEnLasFilas([{ key: { fromMe: false, remoteJid: '100000000004969@lid', senderPn: `${TEL}@s.whatsapp.net` } }], TEL), true, 'el teléfono en senderPn');
  assert.equal(leEscribioEnLasFilas([{ key: { fromMe: false, remoteJid: `${TEL}@s.whatsapp.net` } }], TEL), true, 'el caso de siempre sigue andando');
  assert.equal(leEscribioEnLasFilas([FILA_REAL], '5493700000999'), false, 'otro número no');
  assert.equal(leEscribioEnLasFilas([FILA_REAL], '100000000004969@lid'), true, 'un @lid pedido tal cual se compara exacto');
  assert.equal(leEscribioEnLasFilas([FILA_REAL], '100000000009999@lid'), false);
  assert.equal(leEscribioEnLasFilas([], TEL), false);
  assert.equal(leEscribioEnLasFilas([FILA_REAL], ''), false);
});

test('sólo lo que entró: lo que mandó MaKo a ese chat no prueba que la persona escribió', () => {
  assert.equal(leEscribioEnLasFilas([{ key: { fromMe: true, remoteJid: '100000000004969@lid', remoteJidAlt: `${TEL}@s.whatsapp.net` } }], TEL), false);
  assert.equal(leEscribioEnLasFilas([{ key: { remoteJid: `${TEL}@s.whatsapp.net` } }], TEL), false, 'sin fromMe:false no se da por entrante');
});

test('la línea mira lo último que entró si el filtro por remoteJid no lo encuentra', () => {
  const src = fuenteSinComentarios('lib/mako-grupo.ts');
  const f = bloque(src, 'async function leEscribioALaLinea(', 'const ULTIMAS_PARA_LID');
  assert.match(f, /const exactas = await leer\(\{ key: \{ remoteJid, fromMe: false \} \}, 20\);/);
  assert.match(f, /if \(exactas && leEscribioEnLasFilas\(exactas, remoteJid\)\) return true;/);
  assert.match(f, /const recientes = await leer\(\{\}, ULTIMAS_PARA_LID\);/);
  assert.match(f, /return !!recientes && leEscribioEnLasFilas\(recientes, remoteJid\);/);
});

test('sin código no queda «respondido»: si no salió, se vuelve atrás', () => {
  const src = fuenteSinComentarios('lib/mako-grupo.ts');
  const r = bloque(src, 'export async function responderPedidoV2(', 'export async function reenviarCodigoV2(');
  assert.match(r, /if \(r\.ok\) return;/);
  // Con `sinLineaAt` (20/11, wa-04): la tarjeta dice que no le pudo contestar (tests/whatsapp-v2-auditoria.test.ts).
  assert.match(r, /cambiarSettingSi\(KEY_VERIFICACION, JSON\.stringify\(anotado\), JSON\.stringify\(\{ \.\.\.anotado, respondido: false, sinLineaAt: Date\.now\(\) \}\)\)/);
});
