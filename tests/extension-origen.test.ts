// Auditoría de seguridad del 01/11/2026: la extensión sólo atiende pedidos de la app de MaKo.
// Antes, una página en localhost (cualquier servidor en la PC del cliente) y la ventana de lectura del Landing
// Generator (HTML AJENO servido en hola-mako.com/api/…) podían pedir las fichas de WhatsApp o contestar el emparejado.
// Verificado rompiéndolo: con `return true` como primera línea de esUrlDeMaKo, los casos de localhost y de /api/ dan true.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const bg = readFileSync(raiz + 'extension/background.js', 'utf8').replace(/\r\n/g, '\n');

function cargar(desarrollo: boolean) {
  const ini = bg.indexOf('let instalacionDeDesarrollo = false;');
  const fin = bg.indexOf('/** Las pestañas de la app de MaKo:', ini);
  assert.ok(ini > 0 && fin > ini, 'no encontré el bloque del origen');
  const ctx: Record<string, unknown> = { chrome: { runtime: { id: 'ext' } } };
  runInNewContext(`${bg.slice(ini, fin)}\ninstalacionDeDesarrollo = ${desarrollo};\nglobalThis.esUrl = esUrlDeMaKo; globalThis.permitido = pedidoPermitido;`, ctx);
  return ctx as { esUrl: (u: string) => boolean; permitido: (s: unknown) => boolean };
}

test('sólo la app de MaKo (y localhost en una instalación de desarrollo)', () => {
  const prod = cargar(false);
  assert.equal(prod.esUrl('https://hola-mako.com/crm'), true);
  assert.equal(prod.esUrl('https://hola-mako.com/'), true);
  assert.equal(prod.esUrl('https://hola-mako.com/api/landing-generator/diagnostico/pagina?x=1'), false, 'la ventana de lectura sirve HTML ajeno');
  assert.equal(prod.esUrl('https://hola-mako.com/l/html/12/abc'), false);
  assert.equal(prod.esUrl('http://localhost:3000/crm'), false, 'localhost en una instalación normal, no');
  assert.equal(prod.esUrl('https://hola-mako.com.evil.tld/'), false);
  assert.equal(prod.esUrl('https://hola-mako.com@evil.tld/'), false);
  assert.equal(prod.esUrl('http://hola-mako.com/crm'), false, 'sin https, no');
  assert.equal(prod.permitido({ id: 'ext' }), true, 'el popup (sin pestaña) sí');
  assert.equal(prod.permitido({ id: 'ext', tab: { id: 3, url: 'http://localhost:3000/' } }), false);
  const dev = cargar(true);
  assert.equal(dev.esUrl('http://localhost:3000/crm'), true);
  assert.equal(dev.esUrl('http://localhost/crm'), true);
});

test('el puente no se inyecta en las rutas que sirven contenido ajeno', () => {
  const man = JSON.parse(readFileSync(raiz + 'extension/manifest.json', 'utf8')) as { content_scripts: Array<{ js: string[]; exclude_matches?: string[] }> };
  const puente = man.content_scripts.find((c) => c.js.includes('mako-puente.js'));
  assert.deepEqual(puente?.exclude_matches, ['https://hola-mako.com/api/*', 'https://hola-mako.com/l/*']);
  for (const tipo of ['WA_FICHAS_PEDIDO', 'WA_PERFILES_PEDIDO', 'WA_EXTRACCION', 'WA_ENFOCAR']) {
    const i = bg.indexOf(`if (msg?.tipo === '${tipo}') {`);
    assert.ok(i > 0, tipo);
    assert.match(bg.slice(i, i + 200), /if \(!pedidoPermitido\(_s\)\)/, `${tipo} sin el corte por origen`);
  }
});
