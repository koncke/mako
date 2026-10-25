// =============================================================================
// Editar el público de un conjunto también por la API de MaKo, y crear un pin pegando el punto (17/10/2026)
// =============================================================================
// El POST /{adset} con `targeting` REEMPLAZA el objeto entero y la superposición vivía SÓLO en el navegador
// (EditarPublicoModal): por eso la API no podía editar un público — un parámetro parcial borraba la segmentación
// (docs/hallazgos-ads.md, #715). Ahora la superposición es una función pura (lib/publico-cambios.ts) que usan el editor
// y el server (`editarPublicoConjunto`, lib/meta-ads-create.ts), y la API la expone con confirmación en pantalla.
// Y el pin (decisión 2 del relevo, opción (a)): pegar coordenadas o el link LARGO de Maps (`pinDesdeTexto`).
//
// Probado rompiéndolo (17/10/2026; base 9 / 0). Una rotura por vez, restaurando (pasan / fallan):
//   · aplicarCambiosDePublico toca el género aunque no venga                       -> 8 / 1
//   · Advantage+ en 0 sin señal fina queda en 0 (Meta lo rechaza)                   -> 8 / 1
//   · cambiosDesdeEntrada reemplaza los lugares por el pin (en vez de sumarlo)     -> 8 / 1
//   · pinDesdeTexto acepta una latitud de 95                                       -> 8 / 1
//   · el editor vuelve a superponer a mano (sin aplicarCambiosDePublico)           -> 8 / 1
//   · la def sin confirmación en pantalla                                          -> 8 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { aplicarCambiosDePublico, cambiosDesdeEntrada, entradaDesdeApi } from '../lib/publico-cambios';
import { esLinkSinCoordenadas, pinDesdeTexto } from '../lib/meta-geo';
import { REGISTRO } from '../lib/api-mako/registro';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

/** Un crudo de Meta con cosas que el editor NO maneja: tienen que volver intactas. */
const CRUDO: Record<string, unknown> = {
  geo_locations: { countries: ['MX'], location_types: ['home', 'recent'] },
  age_min: 25, age_max: 55, genders: [2],
  flexible_spec: [{ interests: [{ id: '6003', name: 'Marketing' }] }],
  locales: [23],
  publisher_platforms: ['facebook', 'instagram'], facebook_positions: ['feed'], instagram_positions: ['stream'],
  targeting_automation: { advantage_audience: 0, individual_setting: { age: 1 } },
};

test('sólo se toca lo que viene: intereses, idiomas y lugares se conservan', () => {
  const t = aplicarCambiosDePublico(CRUDO, { edadMin: 30 });
  assert.equal(t.age_min, 30);
  assert.equal(t.age_max, 55);
  assert.deepEqual(t.genders, [2]);
  assert.deepEqual(t.flexible_spec, CRUDO.flexible_spec);
  assert.deepEqual(t.locales, [23]);
  assert.deepEqual(t.geo_locations, CRUDO.geo_locations);
  assert.deepEqual(t.facebook_positions, ['feed']);
});

test('null saca; las ubicaciones arrastran sus posiciones', () => {
  const t = aplicarCambiosDePublico(CRUDO, { edadMax: null, ubicaciones: ['instagram'] });
  assert.equal('age_max' in t, false);
  assert.deepEqual(t.publisher_platforms, ['instagram']);
  assert.equal('facebook_positions' in t, false, 'Meta rechaza positions sin su plataforma');
  assert.deepEqual(t.instagram_positions, ['stream']);
});

test('Advantage+ en 0 sin ninguna señal fina va en 1, y conserva lo demás de targeting_automation', () => {
  const sinFino: Record<string, unknown> = { geo_locations: { countries: ['MX'] }, targeting_automation: { advantage_audience: 1, x: 1 } };
  const t = aplicarCambiosDePublico(sinFino, { advantage: 0 });
  assert.deepEqual(t.targeting_automation, { advantage_audience: 1, x: 1 });
  const conFino = aplicarCambiosDePublico(CRUDO, { advantage: 0 });
  assert.deepEqual(conFino.targeting_automation, { advantage_audience: 0, individual_setting: { age: 1 } });
});

test('la entrada de la API se valida y no deja proponer «nada»', () => {
  assert.deepEqual(entradaDesdeApi({}), { error: 'No hay nada que cambiar: manda al menos un dato del público.' });
  assert.match((entradaDesdeApi({ edadMin: 40, edadMax: 30 }) as { error: string }).error, /mínima no puede ser mayor/);
  assert.match((entradaDesdeApi({ pinLat: 19.4 }) as { error: string }).error, /pinLat y pinLng juntos/);
  assert.deepEqual(entradaDesdeApi({ genero: 'm', ubicacionesAutomaticas: true, advantage: false }), { genero: 'm', ubicaciones: null, advantage: 0 });
  assert.deepEqual(entradaDesdeApi({ pinLat: 19.4326, pinLng: -99.1332 }), { pin: { lat: 19.4326, lng: -99.1332, radioKm: 5 } });
});

test('un pin se SUMA a los lugares que el conjunto ya tenía', () => {
  const c = cambiosDesdeEntrada(CRUDO, { pin: { lat: 19.4326, lng: -99.1332, radioKm: 3 } });
  const t = aplicarCambiosDePublico(CRUDO, c);
  const geo = t.geo_locations as { countries?: string[]; custom_locations?: Array<{ latitude: number; longitude: number; radius: number }> };
  assert.deepEqual(geo.countries, ['MX'], 'el país que ya tenía sigue');
  assert.equal(geo.custom_locations?.length, 1);
  assert.equal(geo.custom_locations?.[0].radius, 3);
});

test('el pin sale de coordenadas o del link LARGO de Maps; el corto no trae el punto', () => {
  assert.equal(pinDesdeTexto('19.4326, -99.1332')?.key, '19.432600,-99.133200');
  assert.equal(pinDesdeTexto('-34.6037 -58.3816')?.lat, -34.6037);
  assert.equal(pinDesdeTexto('https://www.google.com/maps/place/Z%C3%B3calo/@19.4326077,-99.1332080,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d19.4326!4d-99.1331')?.lng, -99.1331, 'el lugar exacto le gana al centro del mapa');
  assert.equal(pinDesdeTexto('https://maps.google.com/?q=19.43,-99.13')?.lat, 19.43);
  assert.equal(pinDesdeTexto('95.1, 20'), null, 'una latitud que no existe');
  assert.equal(pinDesdeTexto('Av. Reforma 222'), null);
  assert.equal(esLinkSinCoordenadas('https://maps.app.goo.gl/AbCdEf123'), true);
  assert.equal(esLinkSinCoordenadas('19.43, -99.13'), false);
});

test('la API lo expone con confirmación en PANTALLA, rol admin y el conjunto fijo al revisar', () => {
  const d = REGISTRO.find((x) => x.id === 'proponer_editar_publico_conjunto');
  assert.ok(d, 'falta la operación');
  assert.equal(d.tipo, 'accion');
  assert.equal(d.tipo === 'accion' ? d.confirmacion : null, 'pantalla');
  assert.equal(d.gating?.rolMinimo, 'admin');
  assert.equal(d.parametros.find((p) => p.nombre === 'adsetId')?.fijoAlRevisar, true);
});
