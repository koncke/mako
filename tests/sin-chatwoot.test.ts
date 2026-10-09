// =============================================================================
// Chatwoot está APAGADO en MaKo.
// =============================================================================
// Martín, 09/10/2026: «Elimina de todos lados la integración con Chatwoot, que no exista
// más. Guardalo en privado, por si en un futuro queremos volver a utilizarla, pero por
// ahora quitalo». Eligió APAGARLA (no borrar los 122 archivos de una): toda llamada pasa por
// `cfg()` de lib/chatwoot.ts y todo el que decide pregunta `chatwootConfigurado()`, así que
// el corte va ahí, más lo que se VE y el webhook.
//
// El código entero, tal como estaba, quedó en la etiqueta de git `archivo/chatwoot-2026-10-09`
// (`git checkout archivo/chatwoot-2026-10-09 -- <rutas>`). Volver a prenderlo es una decisión
// de Martín: este test falla hasta que alguien la tome y lo cambie.
//
// Probado rompiéndolo (09/10/2026), una rotura por vez: poner `CHATWOOT_APAGADO = false`,
// sacar el corte de `cfg()`, mostrarle la tarjeta a quien tiene el token, prender la pestaña
// oficial de /whatsapp, procesar el webhook o montar el sondeo sin el canal oficial: 6
// roturas, todas con su fallo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

test('el interruptor está apagado y corta TODA llamada a Chatwoot', () => {
  const src = sinComentarios(leer('lib/chatwoot.ts'));
  assert.match(src, /export const CHATWOOT_APAGADO = true;/, 'Chatwoot se volvió a prender: es una decisión de Martín');
  // El corte es lo PRIMERO de cfg(): ninguna credencial se lee y `chatwootConfigurado()` da false.
  assert.match(src, /async function cfg\(\): Promise<Cfg> \{\s*if \(CHATWOOT_APAGADO\) throw /, 'cfg() dejó de cortar antes de leer las credenciales');
  assert.match(src, /export async function chatwootConfigurado\(\): Promise<boolean> \{\s*try \{ await cfg\(\); return true; \} catch \{ return false; \}/, 'chatwootConfigurado ya no pasa por cfg()');
});

test('nadie ve la tarjeta ni la pestaña oficial, tampoco quien tenía las credenciales', () => {
  assert.match(sinComentarios(leer('lib/integraciones.ts')), /const yaUsaOficial = !CHATWOOT_APAGADO && /, 'la tarjeta de Chatwoot se le muestra a quien tiene el token');
  assert.match(sinComentarios(leer('app/whatsapp/page.tsx')), /CHATWOOT_APAGADO \? false : integracionConectada\('whatsapp'\)/, 'la pestaña oficial de /whatsapp volvió');
  assert.match(sinComentarios(leer('app/whatsapp/WhatsAppApp.tsx')), /\{mostrarOficial && <ChatwootWebhookChip /, 'el sondeo de Chatwoot corre sin el canal oficial');
});

test('el webhook de Chatwoot contesta 200 sin procesar nada', () => {
  const src = sinComentarios(leer('app/api/webhooks/chatwoot/route.ts'));
  assert.match(src, /export async function POST\(req: NextRequest\) \{\s*if \(CHATWOOT_APAGADO\) return Response\.json\(\{ ok: true, ignorado: 'chatwoot apagado' \}\);/,
    'el webhook procesa eventos de Chatwoot: tiene que cortar ANTES de tocar nada');
});

test('los textos que se ven ya no mandan a conectar Chatwoot', () => {
  assert.doesNotMatch(leer('app/configuraciones/TelefonosPanel.tsx'), /si tienes Chatwoot conectado/);
  assert.doesNotMatch(leer('app/experimentos/RetroReport.tsx'), /Chatwoot todavía sin conectar/);
  assert.doesNotMatch(sinComentarios(leer('app/privacidad/page.tsx')), /Chatwoot/, 'la política de privacidad sigue nombrando a Chatwoot como proveedor');
});
