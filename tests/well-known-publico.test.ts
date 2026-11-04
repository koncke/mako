// =============================================================================
// /.well-known responde sin sesión: lo leen Android (la TWA de Play) y iOS (los links universales) (22/10/2026)
// =============================================================================
// Plan de las tiendas (Play y App Store), paso 1. Medido ese día: `/.well-known/assetlinks.json` y
// `/.well-known/apple-app-site-association` devolvían 307 a /login, porque el matcher de proxy.ts no los eximía. Sin eso no
// anda ni la TWA ni un link universal: el teléfono pide el archivo sin sesión y recibe el login. Ahora:
//   · el matcher los saltea (`\.well-known/`, con el punto ESCAPADO: suelto, sacaba del proxy un slug de hola-mako.site);
//   · están en PUBLICOS por si el matcher cambia, y sólo se leen;
//   · los dos archivos son JSON válido (vacíos hasta que existan las cuentas) y se sirven como `application/json`.
//
// ⚠️ PROBADO ROMPIÉNDOLO (22/10/2026, éste + tests/editor-landing-origen.test.ts, base 21/0): sin la exención en el
// matcher → 20/1; con el punto sin escapar → 19/2 (éste y el de los slugs de hola-mako.site); sin la entrada en
// PUBLICOS → 20/1; sin el Content-Type del de Apple en next.config → 20/1.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tryToParsePath } from 'next/dist/lib/try-to-parse-path';
import { config as configProxy } from '../proxy';
import { esPublica, esPublicaSoloLeer } from '../lib/rutas-publicas';

const RAIZ = join(__dirname, '..');
const leer = (...p: string[]) => readFileSync(join(RAIZ, ...p), 'utf8');
const ASSETLINKS = '/.well-known/assetlinks.json';
const APPLE = '/.well-known/apple-app-site-association';

/** El matcher compilado como lo compila Next (`tryToParsePath`, lo que usa `getMiddlewareMatchers`). */
const pasaPorElProxy = (() => {
  const re = new RegExp(tryToParsePath(String(configProxy.matcher[0])).regexStr ?? '^$');
  return (ruta: string) => re.test(ruta);
})();

test('el proxy no corre sobre /.well-known (el teléfono lo pide sin sesión), y sí sobre lo que se le parece', () => {
  assert.ok(pasaPorElProxy('/integraciones') && pasaPorElProxy('/m/second-brain'), 'el control: esto no compiló el matcher');
  assert.equal(pasaPorElProxy(ASSETLINKS), false, 'assetlinks.json pasa por el proxy: sin sesión es un 307 a /login');
  assert.equal(pasaPorElProxy(APPLE), false, 'apple-app-site-association pasa por el proxy: sin sesión es un 307 a /login');
  // El punto escapado: una landing de hola-mako.site con un slug parecido tiene que seguir pasando por el proxy.
  for (const slug of ['/xwell-known/gracias', '/awell-known/a', '/well-known/gracias']) {
    assert.equal(pasaPorElProxy(slug), true, `«${slug}» es una landing que el proxy no ve`);
  }
});

test('y si el matcher cambia, /.well-known está en PUBLICOS y sólo se lee', () => {
  for (const r of [ASSETLINKS, APPLE]) {
    assert.equal(esPublica(r), true, `${r} fuera de PUBLICOS`);
    assert.equal(esPublicaSoloLeer(r), true, `${r} tiene que ser sólo GET/HEAD/OPTIONS`);
  }
  assert.equal(esPublica('/.well-knownx/a'), false, 'el prefijo se compara por segmento entero');
});

test('los dos archivos son JSON válido, y el de Apple (sin extensión) se sirve como application/json', () => {
  assert.ok(Array.isArray(JSON.parse(leer('public', '.well-known', 'assetlinks.json'))));
  const apple = JSON.parse(leer('public', '.well-known', 'apple-app-site-association')) as { applinks?: { details?: unknown } };
  assert.ok(Array.isArray(apple.applinks?.details), 'iOS espera applinks.details');
  const conf = leer('next.config.ts');
  assert.match(conf, /\{ source: '\/\.well-known\/apple-app-site-association', headers: \[\{ key: 'Content-Type', value: 'application\/json' \}\] \}/);
});
