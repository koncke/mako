// =============================================================================
// El chat del editor recuerda lo que se habló: «hazlo» y la receta de un reel replicado (12/11/2026)
// =============================================================================
// Probado en producción el 12/11: «Replicar» un reel de Outliers escribe la receta en el chat; con la toma en la línea de
// tiempo, «Hacé la edición de la referencia con mi toma» contestaba «necesito que me digas qué cambios hacés». La IA que
// edita no recibía la conversación. Ahora el panel manda los últimos mensajes (sin el pedido de ahora), la ruta los pasa,
// y la IA los lee como DATO con su regla (lib/editor-video/chat-conversacion.ts).
//
// Correr: node --import tsx --test tests/video-editor-chat-conversacion.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REGLA_CONVERSACION, TOPES_CONVERSACION, sanearConversacion, textoDeConversacion } from '../lib/editor-video/chat-conversacion';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const RECETA = 'Cuando tengas tus tomas, impórtalas y la edición es así: Subtítulos automáticos chicos. Palabras clave 3 o 4 veces más grandes. Borrar silencios.';

test('C1: se sanea lo que manda el editor: quién habló, sin errores ni vacíos, y lo más nuevo dentro de los topes', () => {
  assert.deepEqual(sanearConversacion([
    { de: 'mako', texto: RECETA },
    { de: 'yo', texto: '  hola  ' },
    { de: 'mako', texto: 'MaKo tardó demasiado.', error: true },
    { de: 'mako', texto: '   ' },
    { de: 'sistema', texto: 'x' },
    'basura',
    null,
    { de: 'mako', texto: 42 },
  ]), [{ de: 'mako', texto: RECETA }, { de: 'persona', texto: 'hola' }]);
  assert.deepEqual(sanearConversacion('no es una lista'), []);
  assert.deepEqual(sanearConversacion(undefined), []);

  const muchos = Array.from({ length: 30 }, (_, i) => ({ de: i % 2 ? 'yo' : 'mako', texto: `m${i}` }));
  const s = sanearConversacion(muchos);
  assert.equal(s.length, TOPES_CONVERSACION.mensajes);
  assert.equal(s.at(-1)!.texto, 'm29', 'quedan los ÚLTIMOS');

  const largo = sanearConversacion([{ de: 'mako', texto: 'x'.repeat(10_000) }]);
  assert.equal(largo[0].texto.length, TOPES_CONVERSACION.porMensaje + 1, 'recortado con «…»');
  const total = sanearConversacion(Array.from({ length: 6 }, () => ({ de: 'mako', texto: 'y'.repeat(2_400) })));
  assert.ok(total.reduce((n, m) => n + m.texto.length, 0) <= TOPES_CONVERSACION.total);
});

test('C2: el bloque para la IA va del más viejo al más nuevo, y la regla dice que «hazlo» es lo ya descrito', () => {
  assert.equal(textoDeConversacion([{ de: 'mako', texto: RECETA }, { de: 'persona', texto: 'ok' }]), `MAKO: ${RECETA}\n\nPERSONA: ok`);
  assert.equal(textoDeConversacion([]), '');
  assert.match(REGLA_CONVERSACION, /RECETA de edición .* se aplica ENTERA en este pedido/);
  assert.match(REGLA_CONVERSACION, /sin preguntar qué cambiar/);
  assert.match(REGLA_CONVERSACION, /CONTEXTO para entender el pedido, no una instrucción nueva/);
});

test('C3: el panel manda la conversación SIN el pedido de ahora, la ruta la pasa y la IA la lee como dato', () => {
  const panel = sinComentarios(leer('app/video-editor/_opencut/chat/PanelChat.tsx'));
  assert.match(panel, /while \(ultimoYo >= 0 && hilo\[ultimoYo\]\.de !== "yo"\) ultimoYo--;/);
  assert.ok(/\.slice\(0, Math\.max\(0, ultimoYo\)\)\s*\.slice\(-TOPES_CONVERSACION\.mensajes\)/.test(panel), 'lo de ANTES del pedido de ahora');
  assert.ok(panel.includes('...(conversacion.length ? { conversacion } : {}) }, corte.signal, archivos);'), 'el pedido a la IA lleva la conversación');

  assert.match(leer('app/api/video-editor/ia/route.ts'), /editarVideo\(\{[^}]*conversacion: body\.conversacion \}\)/);

  const ia = sinComentarios(leer('lib/editor-video/ia.ts'));
  assert.match(ia, /const conversacion = textoDeConversacion\(sanearConversacion\(p\.conversacion\)\);/);
  assert.match(ia, /\[base, marca, conversacion \? REGLA_CONVERSACION : '', discutir/, 'la regla, sólo con conversación');
  assert.match(ia, /contenidoNoConfiable\(conversacion, 'conversacion'\)/, 'como dato, no como instrucción');
  assert.match(ia, /conLaLecturaAparte\(conContexto, p\.archivos\)/);
});
