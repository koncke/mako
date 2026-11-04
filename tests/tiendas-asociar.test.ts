// =============================================================================
// Lo que llena public/.well-known el día que aparezcan las cuentas (scripts/tiendas-asociar.mjs, 3/11/2026)
// =============================================================================
// Un error acá no da error: la app abre con la barra de la URL, o un link de pago se abre adentro de la app de iPhone, que es lo que Apple rechaza.
//
// Correr: node --import tsx --test tests/tiendas-asociar.test.ts
//
// PROBADO ROMPIÉNDOLO (3/11/2026, base 3 / 0): sacar '/pagar/*' de SIN_APP -> 2 / 1 (2) · un Team ID con minúsculas válido -> 2 / 1 (3) ·
// el componente final `/*` antes de las exclusiones -> 2 / 1 (2) · otro paquete en las dos -> 2 / 1 (1).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIN_APP, aasaCon, assetlinksCon, huellaValida, teamValido } from '../scripts/tiendas-asociar.mjs';
import { RUTAS_DE_VENTA, esRutaDeVenta } from '../lib/tienda';

test('1. Android: el paquete de las tiendas, con las huellas que se le pasan', () => {
  const [a] = assetlinksCon(['AA']);
  assert.deepEqual(a.relation, ['delegate_permission/common.handle_all_urls']);
  assert.equal(a.target.package_name, 'com.holamako.app');
  assert.deepEqual(a.target.sha256_cert_fingerprints, ['AA']);
});

test('2. iPhone: lo que vende no abre la app, y lo demás sí', () => {
  const j = aasaCon('ABCDE12345');
  assert.deepEqual(j.applinks.details[0].appIDs, ['ABCDE12345.com.holamako.app']);
  assert.deepEqual(j.webcredentials.apps, ['ABCDE12345.com.holamako.app']);
  const c = j.applinks.details[0].components as Array<{ '/': string; exclude?: boolean }>;
  assert.deepEqual(c.at(-1), { '/': '/*' }, 'el resto abre la app, y va ÚLTIMO: gana la primera que coincide');
  assert.ok(c.slice(0, -1).every((x) => x.exclude === true));
  for (const r of RUTAS_DE_VENTA) assert.ok((SIN_APP as string[]).some((s) => s === r || s === `${r}/*`), `${r} vende y abriría la app de iPhone`);
  assert.equal(esRutaDeVenta('/'), true);
  assert.ok((SIN_APP as string[]).includes('/'), 'la landing de venta');
  for (const r of ['/l/*', '/compartido/*', '/mi-curso']) assert.ok((SIN_APP as string[]).includes(r), `${r}: lo abre gente que no es de MaKo`);
});

test('3. lo que se pega a mano se valida', () => {
  assert.equal(huellaValida(Array(32).fill('AB').join(':')), true);
  for (const m of ['', 'AB:CD', Array(32).fill('ab').join(':'), Array(32).fill('ZZ').join(':')]) assert.equal(huellaValida(m), false, m);
  assert.equal(teamValido('ABCDE12345'), true);
  for (const m of ['', 'abcde12345', 'ABCDE1234', 'ABCDE123456']) assert.equal(teamValido(m), false, m);
});
