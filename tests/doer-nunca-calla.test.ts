// =============================================================================
// El doer NUNCA se calla — y cuando era una carga al plan, no pierde el mensaje
// =============================================================================
// EL CASO, medido en prod el 30/09/2026. El dueño mandó una nota de voz al grupo del
// super admin para probar. Llegó el «Te escucho 🎧», Whisper la transcribió entera y
// bien (el texto está guardado en `mako_doer_conv`), corrieron dos llamadas al modelo
// —`groq openai/gpt-oss-20b`, motivo `router:sonnet (plan) → capturar`— y después
// **nada**: ni borrador, ni respuesta, ni turno de MaKo. El último turno de MaKo en ese
// workspace era de tres días antes.
//
// La causa: el loop de proveedores descarta con `continue` (texto vacío, centinela,
// molde volcado) y si los descarta a TODOS sale con `respuesta` en ''. Eso no es una
// excepción, así que el `catch` que arma el aviso de «no pude» nunca corre, y el
// `if (respuesta)` que manda simplemente no entra. Silencio, sin una línea de log.
//
// Estos tests son de CÓDIGO y no de comportamiento a propósito: el camino sólo se
// alcanza con las cinco cascadas gratis fallando a la vez, que no se puede montar en un
// test sin volverlo una maqueta de sí mismo. Lo que se cuida es que la guarda exista,
// que esté ANTES del envío, y que no se caiga a pagar.
//
// ⚠️ PROBADO ROMPIÉNDOLO, tres veces (30/09/2026):
//   1. Sacando la guarda entera: fallan 3 de 6 — «hay una guarda», «va antes del envío»
//      y «guarda el mensaje crudo».
//   2. Sacando el `&& !linkBorrador` del guardado crudo: falla 1 de 6 — el de «nunca
//      duplicar». Es el que importa de los tres: sin él, un turno que SÍ creó borrador y
//      después se quedó sin respuesta crearía un segundo con el texto entero.
//   3. Metiéndole un `chatClaude` a la guarda: falla 1 de 6 — «no paga». El dueño lo
//      dijo textual («NO, JAMÁS algo pago para el plan») y es la clase de línea que se
//      cuela sin que nadie la note, porque «arregla» el síntoma.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const doer = () => readFileSync(resolve(import.meta.dirname, '../lib/mako-doer-in.ts'), 'utf8');

/** El bloque de la guarda: de `if (!respuesta) {` hasta el `if (respuesta) {` que manda. */
function guarda(src: string): string {
  const i = src.lastIndexOf('if (!respuesta) {');
  const j = src.indexOf('if (respuesta) {', i);
  assert.ok(i > 0 && j > i, 'no encontré la guarda del silencio');
  return src.slice(i, j);
}

test('EL QUE IMPORTA: hay una guarda para cuando NINGÚN proveedor contestó', () => {
  const g = guarda(doer());
  assert.ok(/avisoNoPude\(/.test(g), 'la guarda no arma ningún aviso: el dueño se queda esperando');
});

test('la guarda va ANTES del envío, o no sirve de nada', () => {
  // El `if (respuesta)` que manda tiene que venir DESPUÉS: una guarda posterior no
  // llena la variable a tiempo y el mensaje igual no sale.
  const src = doer();
  const iGuarda = src.lastIndexOf('if (!respuesta) {');
  const iEnvio = src.indexOf('const partes = respuesta.split(');
  assert.ok(iGuarda > 0 && iEnvio > 0, 'falta la guarda o el envío');
  assert.ok(iGuarda < iEnvio, 'la guarda quedó después de mandar: no la ve nadie');
});

test('deja rastro: el modo de falla mudo era el único sin una línea de log', () => {
  const g = guarda(doer());
  assert.ok(/console\.error\(/.test(g), 'se rinde sin loguear, que es como sobrevivió tres días');
});

test('NO PAGA. «Jamás algo pago para el plan» (30/09/2026)', () => {
  // La salida fácil de este bug es caer a Claude cuando lo gratis no da. Está prohibido
  // por decisión del dueño, y es la clase de línea que se cuela porque «arregla» el
  // síntoma.
  const g = guarda(doer());
  assert.ok(!/chatClaude/.test(g), 'la guarda cae a un modelo pago');
  assert.ok(!/opus|sonnet-4|claude-/i.test(g), 'la guarda nombra un modelo pago');
});

test('si era carga al plan, el mensaje se guarda CRUDO en vez de perderse', () => {
  // «Reintenta en un momento» le pide al dueño que vuelva a grabar el audio — y lo que
  // dijo ya está transcripto y guardado. Una tarea sin redactar es peor que una buena e
  // infinitamente mejor que ninguna: el borrador existe para revisarse.
  const g = guarda(doer());
  assert.ok(/crearPropuesta\(/.test(g), 'no se guarda nada: el mensaje se pierde');
  assert.ok(/detalle: crudo/.test(g), 'no guarda el texto entero, que es lo único que no se puede perder');
});

test('y NUNCA duplica: sólo guarda crudo si no hay borrador ya', () => {
  // Con un borrador creado, esto sería un segundo con el mismo contenido. Es la regla
  // de la casa y acá falla en silencio: los dos se ven bien por separado.
  const g = guarda(doer());
  assert.ok(/eraDePlan && !linkBorrador/.test(g), 'puede crear un borrador duplicado');
});
