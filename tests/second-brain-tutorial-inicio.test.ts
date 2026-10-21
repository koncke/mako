// =============================================================================
// Al terminar el onboarding arranca el tutorial del Ops Center (20/10/2026)
// =============================================================================
// Martín (pedido del 18/10, punto 13): «Y luego debería iniciar el tutorial de la app, como lo tenemos en varios
// lugares». Es un recorrido de la casa (app/_ui/Recorrido.tsx) con id `sb-inicio`, que se abre solo cuando la URL trae
// `?recorrido=sb-inicio` (lo pone rutaDelHilo al terminar) y la persona no lo vio. Cada paso apunta a una marca
// `data-recorrido` que TIENE que estar en la pantalla: un paso sin su marca se salta en silencio.
//
// ROTURAS (20/10/2026, arnés romper-tutorial.js del scratchpad; base 3/0): sin la marca de la caja de escribir → 2/1 · el
// tutorial abre siempre (sin mirar la URL) → 2/1 · la página no le pasa el pedido → 2/1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PASOS_INICIO } from '../app/second-brain/recorrido-inicio';
import { RECORRIDO_INICIO } from '../lib/onboarding-arranque';
import { idRecorridoValido } from '../lib/recorridos';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

test('cada paso del tutorial apunta a una marca que está en la pantalla', () => {
  assert.ok(idRecorridoValido(RECORRIDO_INICIO), `«${RECORRIDO_INICIO}» no es un id de recorrido válido`);
  assert.ok(PASOS_INICIO.length >= 2);
  const chat = leer('app/second-brain/ChatSecondBrain.tsx');
  for (const p of PASOS_INICIO) {
    assert.ok(chat.includes(`data-recorrido="${p.objetivo}"`), `el paso «${p.titulo}» apunta a «${p.objetivo}», que no está en la pantalla`);
    assert.ok(p.texto.length <= 140, `«${p.titulo}»: el texto de un paso es corto`);
  }
});

test('se abre sólo cuando lo pide el final del onboarding', () => {
  const chat = leer('app/second-brain/ChatSecondBrain.tsx');
  assert.match(chat, /const tutorial = useRecorrido\(RECORRIDO_INICIO, \{ autoabrir: tutorialInicio \}\);/, 'el tutorial se abre siempre, o nunca');
  assert.match(chat, /<Recorrido id=\{RECORRIDO_INICIO\} pasos=\{PASOS_INICIO\} abierto=\{tutorial\.abierto\} onCerrar=\{tutorial\.onCerrar\} \/>/);
});

test('la página le pasa el pedido de la URL', () => {
  assert.match(leer('app/second-brain/pagina.tsx'), /tutorialInicio=\{q\.recorrido === RECORRIDO_INICIO\}/);
});
