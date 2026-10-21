// =============================================================================
// La vuelta de un OAuth (Meta, Google Calendar) lleva `?ws=` SÓLO si hace falta
// =============================================================================
// 21/10/2026: Martín volvió de «Reconectar con Meta» en su propio negocio (ws9) con
// `?ws=9`, y el proxy, a un admin de plataforma con `?ws=`, lo pone en vista de
// cliente: «Estás viendo el dashboard de Martin Koncke como administrador». La
// pestaña sólo hace falta cuando el negocio destino NO es al que cae la sesión sola
// (el super admin conectando parado adentro de un cliente).
//
// Probado rompiéndolo (21/10): con `return destino;` en `wsDeVuelta` cae «el propio
// negocio vuelve sin pestaña»; con `ws ? conWs(destino, ws)` de nuevo en cualquiera
// de los dos callbacks cae «los dos callbacks pasan por wsDeVuelta».

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { wsDeVuelta } from '../lib/ws-tab';

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n');

test('vuelta OAuth: el propio negocio vuelve sin pestaña', () => {
  assert.equal(wsDeVuelta(9, 9), null);
  assert.equal(wsDeVuelta(3, 3), null);
});

test('vuelta OAuth: otro negocio vuelve a su pestaña', () => {
  assert.equal(wsDeVuelta(3, 9), 3);
  assert.equal(wsDeVuelta(3, null), 3);
  assert.equal(wsDeVuelta(3, undefined), 3);
});

test('vuelta OAuth: sin negocio destino no hay pestaña', () => {
  assert.equal(wsDeVuelta(null, 9), null);
  assert.equal(wsDeVuelta(undefined, 9), null);
});

test('vuelta OAuth: los dos callbacks pasan por wsDeVuelta', () => {
  for (const ruta of ['app/api/integraciones/meta/callback/route.ts', 'app/api/integraciones/google-calendar/callback/route.ts']) {
    const src = leer(ruta);
    assert.match(src, /const wsSinPestana = await adminDeWorkspaceActual\(\)/, `${ruta}: falta leer adónde cae la sesión sin ?ws=`);
    assert.match(src, /const w = wsDeVuelta\(ws, wsSinPestana\);/, `${ruta}: la vuelta no pasa por wsDeVuelta`);
    assert.doesNotMatch(src, /ws \? conWs\(destino, ws\)/, `${ruta}: volvió a pegar el ?ws= siempre`);
    // El negocio donde se ESCRIBE sale de la cookie: el callback no lee el de la sesión (tests/meta-login.test.ts).
    assert.ok(!src.includes('getWorkspaceActual'), `${ruta}: no lee el negocio de la sesión`);
  }
});
