// =============================================================================
// La voz de MaKo muerta seis días diciendo «open»
// =============================================================================
// 08/09/2026. Martín: «MaKo en WhatsApp NO está funcionando». Medido:
//
//   · mako_doer_conv, últimas 48 h ............ 0 mensajes
//   · último entrante de cualquier cliente .... 2026-09-02
//   · connectionState mako_superadmin ........ "state": "open"
//   · operación REAL sobre ese socket ........ HTTP 428, Connection Closed
//
// Seis días sin entrar NI SALIR un mensaje. Los avisos que los crons generaron
// esos días se escribieron, se pagó la IA que los redactó, y ninguno llegó.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');

test('La vigilancia pregunta HABLANDO, no leyendo connectionState', () => {
  // El campo mintió en LAS DOS DIRECCIONES, medido sobre las 4 instancias:
  //   mako_superadmin  open  → 428 Connection Closed
  //   mako_ws1         close → funciona
  // «open» no prueba que ande y «close» no prueba que no.
  const src = leer('../lib/canal-vigilante.ts');
  assert.match(src, /socketVivo\(instancia\)/,
    'la vigilancia dejó de hacer una operación real: vuelve a creerle al campo que mintió');
  // Sobre el CÓDIGO: la prosa de arriba nombra `connectionState` justamente para
  // explicar por qué NO se usa. (Cuarta vez en este repo que un test se dispara
  // contra su propio comentario — vale como recordatorio de sacar los DOS tipos.)
  const codigo = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/connectionState/.test(codigo),
    'volvió a leer connectionState como prueba de vida');
});

test('⚠️ El aviso NO viaja por el canal que se rompió', () => {
  // Es lo que hace que este aviso exista. Mandar «tu WhatsApp está caído» por
  // WhatsApp es no mandar nada.
  const src = leer('../lib/canal-vigilante.ts');
  const codigo = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.match(codigo, /sendEmail\(/, 'el aviso dejó de salir por email');
  assert.ok(!/enviarAlGrupo|emitirAviso|enviarAGrupoJid/.test(codigo),
    'el aviso de "WhatsApp caído" volvió a mandarse por WhatsApp');
});

test('Sabe decir «ya está», no solo «se rompió»', () => {
  // Una alarma que no sabe cerrar obliga a adivinar si se arregló o si se rompió
  // el aviso. Mismo criterio que la alerta crítica de Meta.
  const src = leer('../lib/canal-vigilante.ts');
  assert.match(src, /aviso: 'recuperada'/, 'no avisa cuando la voz vuelve');
  assert.match(src, /setSetting\(KEY_ULTIMO_AVISO, ''\)/, 'no limpia la marca al recuperarse');
});

test('Alguien la MIRA: va en un cron, no solo en un panel', () => {
  // La detección ya existía (socketVivo + estadoCanalMaKo, con el comentario del
  // 16/08 explicando exactamente esto) y tenía UN consumidor: la ruta del panel
  // /agencia. Un estado correcto que solo se calcula cuando alguien abre una
  // pantalla no es un control, es un dato disponible.
  const cron = leer('../app/api/cron/alerta-critica/route.ts');
  assert.match(cron, /vigilarVozMaKo\(\)/, 'la vigilancia volvió a no tener quién la corra');
  // Y nunca puede tumbar el cron: si falla la vigilancia, el resto corre igual.
  assert.match(cron, /vigilarVozMaKo\(\)\.catch\(/, 'la vigilancia dejó de ser best-effort');
  // Va ANTES del try del resto: es lo primero que hay que saber.
  const iVoz = cron.indexOf('vigilarVozMaKo');
  const iTry = cron.indexOf('const cuentasYaAvisadas');
  assert.ok(iVoz > 0 && iVoz < iTry, 'la vigilancia de la voz quedó después del resto del cron');
});
