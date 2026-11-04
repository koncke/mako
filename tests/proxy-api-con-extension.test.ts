// Auditoría de seguridad del 01/11/2026: una ruta de API que termina en `.png`, `.js`, `.css`… pasa por el proxy
// (sesión y Origin). Antes el matcher sacaba del proxy CUALQUIER path con esa extensión, también bajo /api/.
// Verificado rompiéndolo: sin el `(?!api/)` del matcher, el primer assert da false.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tryToParsePath } from 'next/dist/lib/try-to-parse-path';
import { config as configProxy } from '../proxy';

const pasaPorElProxy = (() => {
  const re = new RegExp(tryToParsePath(String(configProxy.matcher[0])).regexStr ?? '^$');
  return (ruta: string) => re.test(ruta);
})();

test('/api/…/x.png pasa por el proxy; un .png estático, no', () => {
  assert.ok(pasaPorElProxy('/integraciones'), 'el control: esto no compiló el matcher');
  for (const r of ['/api/x/123.png', '/api/branding/asset/logo.png', '/api/algo/script.js', '/api/a/b.css', '/api/v1/openapi.json']) {
    assert.equal(pasaPorElProxy(r), true, `${r} tiene que pasar por el proxy`);
  }
  // ⚠️ Desde el 4/11/2026 sólo es «estático» un archivo de la raíz o de una carpeta de `public/` (tests/proxy-matcher-completo.test.ts):
  // `/fuentes/x.woff2`, que estaba acá inventado, hoy pasa por el proxy porque `fuentes/` no existe en `public/`.
  for (const r of ['/logo.png', '/icon-192.png', '/m.js', '/logos/x.woff2', '/replay/1/r.js', '/manifest.webmanifest']) {
    assert.equal(pasaPorElProxy(r), false, `${r} es estático y sigue afuera`);
  }
});
