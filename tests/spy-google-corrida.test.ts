// La búsqueda en Google de sus otras redes, sin cortarse (lib/spy-google-corrida.ts). El Cerebro lo midió el 4/11/2026: el actor
// de Google tardaba hasta 57 s, Apify terminaba y cobraba, y nosotros ya habíamos abortado a los 45 s.
// Correr: node --import tsx --test tests/spy-google-corrida.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CORRIDA_GOOGLE_VENCE_MS, GOOGLE_PENDIENTE, GOOGLE_SIN_CUPO, claveCorridaGoogle, esPendiente, esSinCupo, huellaConsulta, leerCorrida,
  queHacerConLaCorrida,
} from '../lib/spy-google-corrida';
import { cadenaDeRedes, type DepsCadena } from '../lib/spy-cadena';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('la clave de la corrida no lleva el texto buscado, y es la misma para la misma consulta', () => {
  const k = claveCorridaGoogle('"Den Borg" instagram youtube');
  assert.match(k, /^spy\.google\.[0-9a-z]+$/);
  assert.doesNotMatch(k, /den|borg/i, 'un nombre de persona no va en la clave');
  assert.equal(huellaConsulta('Den  Borg'), huellaConsulta('den borg'));
  assert.notEqual(huellaConsulta('den borg'), huellaConsulta('victor heras'));
});

test('lo anotado se retoma mientras está fresco; lo vencido o ilegible se olvida', () => {
  const ahora = Date.UTC(2026, 10, 4, 13);
  const fresca = { run: 'r1', dataset: 'd1', desde: new Date(ahora - 60_000).toISOString() };
  assert.equal(queHacerConLaCorrida(fresca, ahora), 'retomar');
  assert.equal(queHacerConLaCorrida({ ...fresca, desde: new Date(ahora - CORRIDA_GOOGLE_VENCE_MS - 1).toISOString() }, ahora), 'empezar');
  assert.equal(queHacerConLaCorrida(null, ahora), 'empezar');
  assert.equal(queHacerConLaCorrida({ ...fresca, desde: 'no es una fecha' }, ahora), 'empezar');
  assert.deepEqual(leerCorrida(JSON.stringify(fresca)), fresca);
  assert.equal(leerCorrida('{"run":1}'), null);
  assert.equal(leerCorrida('no es json'), null);
  assert.equal(esPendiente(GOOGLE_PENDIENTE), true);
  assert.equal(esSinCupo(GOOGLE_SIN_CUPO), true);
  assert.equal(esPendiente([]), false);
});

// ── La cadena con Google que sigue corriendo ──────────────────────────────────────────────────────────────────────────

const DEN = { id: 17, nombre: 'Den Borg', instagram: 'den.borgg', youtube_id: null, tiktok: null, landing_url: null };
function deps(o: Partial<DepsCadena>): DepsCadena {
  return {
    textoPropio: async () => '', abrirPagina: async () => null, leerCanales: async () => new Map(), leerPerfiles: async () => new Map(),
    googlear: async () => [], gastarBusqueda: () => true, canalesDeVideos: async () => [], hashDeFoto: async () => null, ...o,
  };
}

test('Google que sigue corriendo no es «no pude»: vuelve con pendiente y lo hallado, para retomarla sin pagar', async () => {
  const r = await cadenaDeRedes(DEN, deps({ googlear: async () => GOOGLE_PENDIENTE }));
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.pendiente, true);
});

test('sin texto cuando no se pudo; el cupo del día se gasta sólo si la búsqueda lo pide', async () => {
  const nada = await cadenaDeRedes(DEN, deps({ googlear: async () => null }));
  assert.deepEqual(nada, { ok: false, error: '' }, 'Martín: «Elimina textos innecesarios como "No pude buscar sus otras redes ahora"»');
  let gastadas = 0;
  // Retomar una corrida no llama a `gastar`: la cadena ya no lo gasta antes de preguntar.
  await cadenaDeRedes(DEN, deps({ gastarBusqueda: () => { gastadas += 1; return true; }, googlear: async () => GOOGLE_PENDIENTE }));
  assert.equal(gastadas, 0);
  const sinCupo = await cadenaDeRedes(DEN, deps({ googlear: async (_q, gastar) => (gastar() ? [] : GOOGLE_SIN_CUPO), gastarBusqueda: () => false }));
  assert.equal(sinCupo.ok, false);
});

test('la búsqueda real empieza la corrida asíncrona, la anota, y sólo gasta el cupo al EMPEZAR', () => {
  const src = sinComentarios(leer('lib/spy-otras-redes.ts'));
  const g = src.slice(src.indexOf('async function googlear('), src.indexOf('async function abrirPagina('));
  assert.ok(g.length > 200, 'encontré la función');
  assert.doesNotMatch(g, /run-sync/, 'una corrida sincrónica se corta con el pedido y tira lo pagado');
  assert.match(g, /\/runs\?/, 'se empieza asíncrona');
  const iDecide = g.indexOf("queHacerConLaCorrida(corrida, Date.now()) === 'empezar'");
  const iGasta = g.indexOf('gastar()');
  const iAnota = g.indexOf('cambiarSettingSi(clave, crudo,');
  assert.ok(iDecide > 0 && iGasta > iDecide && iAnota > iGasta, 'decide si retoma, recién ahí gasta, y anota la corrida');
  assert.match(g, /return GOOGLE_PENDIENTE/);
});
