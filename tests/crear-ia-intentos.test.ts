// =============================================================================
// «Crear con IA se quedó pensando», lo que faltaba (17/10/2026, tarjeta #847)
// =============================================================================
// La tarjeta: «Que crear con IA tarde segundos o diga en qué está». La primera mitad (a0feecde9) cortó el error repetido
// en cuatro proveedores. Faltaba:
//   1. el tope de UN intento: 100 s dejaban a un proveedor colgado comerse casi medio plazo (`INTENTO_CREAR_MS`, 45 s,
//      con lo medido en `anthropic_usage` en su comentario);
//   2. decir en qué está: la cascada avisa al ARRANCAR cada pedido a un proveedor (`alIntentar`), y desde el segundo la
//      fase lo dice («intento 2», lo pone la ruta, no un reloj). El orden lo fija tests/flujo-ia-crear.test.ts;
//   3. el dictado: la nota de voz tarda hasta 90 s en pasar a texto y no se veía nada.
//
// PROBADO ROMPIÉNDOLO (17/10/2026, arnés `romper.py` + `roturas-847.json`; base 4 / 0). Pasan / fallan:
//   1. el tope vuelve a 100 s                                          -> 3 / 1
//   2. la cascada sin el aviso antes de la red de la plataforma         -> 3 / 1
//   3. «Corregir» sin pasar el aviso                                   -> 3 / 1
//   4. la ruta de editar sin «intento»                                 -> 3 / 1
//   5. la caja no dibuja el intento                                    -> 3 / 1
//   6. el dictado sin su línea                                         -> 3 / 1
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leer = (rel: string): string => readFileSync(join(import.meta.dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

test('1. un intento tiene 45 s, no 100: lo que cuelga cuesta menos de la mitad', () => {
  const src = leer('lib/flujo-ia-crear.ts');
  assert.match(src, /export const INTENTO_CREAR_MS = 45_000;/);
  assert.match(src, /timeoutMs: INTENTO_CREAR_MS, hastaMs: p\.hastaMs, alIntentar: p\.alIntentar,/);
  assert.doesNotMatch(src, /timeoutMs: 100_000/, 'volvió el tope de 100 s');
});

test('2. la cascada avisa al arrancar cada pedido a un proveedor, y Crear lo pasa en los tres escalones', () => {
  const cascada = leer('lib/ai-cheap.ts');
  const ini = cascada.indexOf('export async function chatCheapCascade(');
  const cuerpo = cascada.slice(ini, cascada.indexOf('\nexport ', ini + 10));
  assert.match(cuerpo, /const avisar = \(\): void => \{ try \{ opts\.alIntentar\?\.\(\); \} catch/, 'un aviso que tira no puede frenar la cascada');
  // Las cuentas del negocio y la red de la plataforma: los dos lugares donde sale un pedido de verdad.
  assert.equal(cuerpo.match(/avisar\(\);\n\s*(?:let|const) t = await chatCheap\(/g)?.length, 2);
  const crear = leer('lib/flujo-ia-crear.ts');
  assert.match(crear, /const uno = await pasada\(\{[^\n]*alIntentar \}\);/);
  assert.match(crear, /motivo: `reparar el JSON · \$\{motivo\}`[^\n]*alIntentar,/);
  assert.match(crear, /const dos = await pasada\(\{[^\n]*alIntentar \}\);/);
});

test('3. la ruta de editar y la caja: «intento N» desde el segundo, sólo mientras escribe', () => {
  const ruta = leer('app/api/chat-agent/secuencias/ia/route.ts');
  assert.match(ruta, /alIntento: \(n\) => \{ if \(n > 1\) send\(\{ t: 'fase', fase: 'modelo', intento: n \}\); \}/);
  const stream = leer('app/automations/stream-ia.ts');
  assert.match(stream, /intento: ev\.fase === 'modelo' \? \(ev\.intento \?\? s\.intento \?\? null\) : null,/, 'el intento se queda pegado en la revisión');
  const caja = leer('app/automations/ChatMako.tsx');
  assert.match(caja, /\{estado\.fase === 'modelo' && estado\.intento && estado\.intento > 1 \? <span style=\{S\.dim\}>· intento \{estado\.intento\}<\/span> : null\}/);
});

test('4. el dictado dice que está pasando el audio a texto, y lo saca al terminar', () => {
  const hilo = leer('app/whatsapp/_shared/ChatHilo.tsx');
  const i = hilo.indexOf('const enviarAudioPropio = async');
  assert.ok(i > 0);
  const f = hilo.slice(i, hilo.indexOf('\n  };', i));
  assert.match(f, /setAudioFase\('Pasando el audio a texto…'\);/);
  assert.match(f, /finally \{ setSending\(false\); setAudioFase\(null\); \}/);
});
