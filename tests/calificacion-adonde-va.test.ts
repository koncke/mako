import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { adondeDe, destinoCAPI } from '../lib/meta-capi-payload';

/**
 * «¿Era calificado?» dice a dónde va de verdad (14/10/2026, al revisar Meta CAPI por el pedido de
 * Martín del 13/10). Medido: ws9 y ws11 tienen el token de Meta y NINGÚN píxel, así que lo que se
 * marcaba ahí no salía, y la tarjeta afirmaba «Meta aprende de esto».
 *
 * Verificado rompiéndolo (base 4/0): `adondeDe` sin mirar el token, 1 fallo; el envío con su propia
 * lectura del destino, 1 fallo; la sonda que no distingue «no pude leer», 1 fallo; la tarjeta
 * afirmando siempre «Meta aprende», 1 fallo.
 */

const leer = (r: string) => readFileSync(new URL(r, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const CAPI = sinComentarios(leer('../lib/meta-capi.ts'));
const cuerpo = (firma: string) => { const i = CAPI.indexOf(firma); assert.ok(i >= 0, `no encontré ${firma}`); const f = CAPI.indexOf('\nexport ', i + 10); return CAPI.slice(i, f < 0 ? undefined : f); };

test('el veredicto: el conjunto de datos de CRM manda, después el píxel; sin token no sale', () => {
  assert.equal(adondeDe(destinoCAPI('111', '222'), 'tok'), 'crm');
  assert.equal(adondeDe(destinoCAPI(null, '222'), 'tok'), 'pixel');
  assert.equal(adondeDe(destinoCAPI('PENDING', null), 'tok'), 'sin_pixel', 'un PENDING no es un destino');
  assert.equal(adondeDe(destinoCAPI(null, '222'), null), 'sin_token');
  assert.equal(adondeDe(destinoCAPI(null, '222'), 'PENDING_x'), 'sin_token');
});

test('la ficha y el envío leen el destino por la MISMA función', () => {
  assert.match(cuerpo('export async function sendMetaCAPIEvent'), /const \{ destino, accessToken \} = await destinoYToken\(\);/);
  assert.doesNotMatch(cuerpo('export async function sendMetaCAPIEvent'), /credWs\('META_PIXEL_ID'\)/, 'una segunda lectura contestaría distinto');
  const adonde = cuerpo('export async function adondeVaLaCalificacion');
  assert.match(adonde, /await destinoYToken\(\);\s*return adondeDe\(destino, accessToken\);/);
});

test('«no pude leer» no es «no tiene píxel»: con la base caída no se acusa a nadie', () => {
  assert.match(cuerpo('export async function adondeVaLaCalificacion'), /try \{ await credWsEstricta\('META_PIXEL_ID', ws\); \} catch \{ return null; \}/);
  const ACC = sinComentarios(leer('../app/crm/calificacion-actions.ts'));
  assert.match(ACC, /if \(!\(await getUsuarioActual\(\)\)\) return null;/, 'sin sesión se caería al ws1');
});

test('la tarjeta dice «no le llega» sólo si no le llega, y lleva a conectarlo', () => {
  const UI = sinComentarios(leer('../app/crm/lead-view/CalificacionCard.tsx'));
  assert.match(UI, /const noLlega = adonde === 'sin_pixel' \|\| adonde === 'sin_token';/);
  assert.match(UI, /: noLlega\s*\? \(<>No le llega a Meta:/);
  assert.match(UI, /href="\/integraciones\?abrir=meta"/);
  assert.match(leer('../lib/integraciones-catalogo.ts'), /\{ key: 'meta',/, '«abrir=meta» sólo abre una tarjeta que exista');
});
