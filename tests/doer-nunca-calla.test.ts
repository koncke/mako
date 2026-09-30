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
//   1. Sacando la guarda entera: fallan 3 de 7.
//   2. Sacando el corte de duplicado del helper: falla 1 de 7. Sin él, un turno que SÍ
//      creó borrador y después se quedó sin respuesta crearía un segundo con el texto.
//   3. Metiéndole un `chatClaude` a la guarda: fallan 2 de 7 — «no paga» y la guarda,
//      que deja de encontrar el aviso. El dueño lo dijo textual («NO, JAMÁS algo pago
//      para el plan») y es la clase de línea que se cuela porque «arregla» el síntoma.
//   4. Sacando el `guardarCrudo()` del CATCH: falla 1 de 7 — el caso de las keys sin
//      cuota. Es el que el refutador encontró en la primera versión de este arreglo.

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
  const src = doer();
  assert.ok(/const guardarCrudo = async/.test(src), 'no existe el guardado crudo');
  assert.ok(/crearPropuesta\(/.test(src), 'no se guarda nada: el mensaje se pierde');
  assert.ok(/detalle: crudo/.test(src), 'no guarda el texto entero, que es lo único que no se puede perder');
  assert.ok(/await guardarCrudo\(\)/.test(guarda(src)), 'la guarda del silencio no lo usa');
});

test('EL QUE FALTABA: también se guarda cuando la IA TIRA (sin cuota), no sólo cuando calla', () => {
  // ⚠️ Lo encontró un refutador el mismo día que escribí la primera versión. La IA falla
  // de DOS formas: el loop puede descartar a todos los proveedores con `continue` —y sale
  // sin respuesta— o puede TIRAR (`throw err`), que es lo que pasa con las keys sin cuota.
  // El catch de esa segunda siempre asigna `respuesta`, así que la guarda del final no
  // entra y el mensaje se perdía igual. Y ése es justo el caso del pedido: «si se queda
  // sin créditos no puede cargar una tarea que está copiando de una libreta».
  const src = doer();
  const iCatch = src.indexOf('fallo de IA (${causa}');
  assert.ok(iCatch > 0, 'no encontré el camino del fallo con excepción');
  const bloque = src.slice(iCatch, iCatch + 800);
  assert.ok(/guardarCrudo\(\)/.test(bloque), 'con las keys sin cuota el mensaje se sigue perdiendo');
});

test('y NUNCA duplica: el guardado crudo se corta solo si ya hay borrador', () => {
  // Con un borrador creado, esto sería un segundo con el mismo contenido. Es la regla
  // de la casa y acá falla en silencio: los dos se ven bien por separado.
  // El corte vive DENTRO del helper, que es lo que deja llamarlo desde los dos caminos
  // sin repetir la condición en cada uno (y sin que uno de los dos se la olvide).
  const src = doer();
  const i = src.indexOf('const guardarCrudo = async');
  const cuerpo = src.slice(i, src.indexOf('};', i));
  assert.ok(/if \(linkBorrador\) return linkBorrador;/.test(cuerpo), 'puede crear un borrador duplicado');
});
