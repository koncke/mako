// =============================================================================
// «Conectar con Meta» avisa si el token vino SIN los permisos de anuncios (17/10/2026)
// =============================================================================
// docs/relevo/ads-manager.md, «Lo que bloquea de verdad»: la tarjeta de Meta dice «Faltan permisos de anuncios» cuando
// una LECTURA falla (13/10), pero al CONECTAR nada lo decía: el 08/10 la app MaKo devolvió el token sin `ads_read` ni
// `ads_management` y la pantalla dijo «Conectado». Ahora el callback lee `/me/permissions` y vuelve con
// `sin-permisos`, que el formulario dice en una línea.
//
// Probado rompiéndolo (17/10/2026; base 3 / 0). Una rotura por vez, restaurando (pasan / fallan):
//   · permisosDeAnunciosFaltantes cuenta un permiso `declined` como concedido   -> 2 / 1
//   · el callback no mira los permisos                                         -> 2 / 1
//   · leerResultadoMeta no conoce 'sin-permisos' (la cookie se descarta)      -> 2 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { permisosDeAnunciosFaltantes } from '../lib/meta-permisos';
import { leerResultadoMeta } from '../lib/meta-login';

test('qué permisos de anuncios faltan, leyendo /me/permissions', () => {
  assert.deepEqual(permisosDeAnunciosFaltantes({ data: [{ permission: 'ads_read', status: 'granted' }, { permission: 'ads_management', status: 'granted' }] }), []);
  assert.deepEqual(permisosDeAnunciosFaltantes({ data: [{ permission: 'pages_show_list', status: 'granted' }, { permission: 'ads_management', status: 'declined' }] }), ['ads_read', 'ads_management']);
  assert.deepEqual(permisosDeAnunciosFaltantes({ error: { message: 'x' } }), [], 'sin saber, no se afirma');
});

test('el callback lo mira después de guardar la conexión y vuelve con «sin-permisos»', () => {
  const src = readFileSync(join(import.meta.dirname, '..', 'app/api/integraciones/meta/callback/route.ts'), 'utf8').replace(/\r\n/g, '\n');
  const iGuardar = src.indexOf('const g = await guardarConexionMeta(');
  const iPermisos = src.indexOf('permisosDeAnunciosFaltantes(');
  assert.ok(iGuardar > 0 && iPermisos > iGuardar);
  assert.match(src, /if \(faltan\.length\) \{[\s\S]*?return salir\('sin-permisos', ws\);/);
});

test('el resultado viaja en la cookie; el formulario ya no ofrece «Conectar con Meta» (ticket #28, 29/10/2026)', () => {
  assert.equal(leerResultadoMeta('sin-permisos'), 'sin-permisos');
  // Meta se conecta en la tarjeta de Zernio (tests/zernio-una-pestana.test.ts): el modal de Meta no tiene el botón de la app propia,
  // así que tampoco dice cómo terminó. La ruta y la cookie siguen (un link viejo vuelve sin romper nada).
  const form = readFileSync(join(import.meta.dirname, '..', 'app/integraciones/ServicioConfigForm.tsx'), 'utf8');
  assert.doesNotMatch(form, /\/api\/integraciones\/meta[?'`]/);
});
