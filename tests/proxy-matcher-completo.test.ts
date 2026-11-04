// =============================================================================
// El matcher del proxy, compilado COMO LO COMPILA NEXT, contra cada ruta dinámica y cada archivo de public/ (4/11/2026)
// =============================================================================
// La revisión de la cuenta de las tiendas encontró que una PÁGINA dinámica con un valor terminado en `.png`, `.js`, `.css`…
// (`POST /crm/x.png`, `/m/crm/x.png`) no pasaba por el proxy: el matcher sacaba todo camino con esa extensión, y Next caía
// igual en `/crm/[id]` (`X-Matched-Path: /crm/[id]`). Ahí no corrían el corte de sesión, el chequeo de Origin ni
// `revisionPuedeEscribir`, y con `Next-Action` se podía pedir cualquier server action. tests/cuenta-revision-escrituras.test.ts
// llama a `proxy()` directo y no ve el matcher: por eso no lo cazó. Esto lo mira:
//
//   1. arma los matchers con `getMiddlewareMatchers` y decide con `getMiddlewareRouteMatcher` (con `has`), las dos de Next;
//   2. CADA ruta dinámica de app/ (página o route handler, API incluida) con cada extensión pasa por el proxy;
//   3. CADA archivo de public/ con esas extensiones NO pasa (sin sesión sería un 307 a /login), y ninguna carpeta de la lista
//      del matcher está de más;
//   4. todo lo que Next trataría como server action (su propia `getServerActionRequestMetadata`) pasa, en cualquier camino.
//
// Correr: node --import tsx --test tests/proxy-matcher-completo.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (4/11/2026, base 5 / 0; una rotura por vez, restaurada de memoria):
//   · el matcher de antes (cualquier camino con extensión afuera, salvo api/)  → 2 / 3 (las rutas dinámicas, las acciones y la lista
//     de carpetas, que no existía)
//   · sin la entrada de `next-action`                                         → 4 / 1
//   · sin la de multipart                                                     → 4 / 1
//   · `replay` fuera de la lista de carpetas de public/                       → 4 / 1 (el script de las landings, al login)
//   · `geo` sumada a la lista (no tiene ningún archivo con esas extensiones)   → 4 / 1
//   · un cambio sin efecto (el orden de las entradas con `has`)               → 5 / 0
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as infoDePagina from 'next/dist/build/analysis/get-page-static-info';
import { getMiddlewareRouteMatcher } from 'next/dist/shared/lib/router/utils/middleware-route-matcher';
import { getServerActionRequestMetadata } from 'next/dist/server/lib/server-action-request-meta';
import { config } from '../proxy';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXTENSIONES = ['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif', 'ico', 'css', 'js', 'woff', 'woff2', 'webmanifest'];
const deGit = (carpeta: string) => execFileSync('git', ['ls-files', carpeta], { cwd: RAIZ, encoding: 'utf8' }).split('\n').filter(Boolean);

// Lo que hace Next al construir y al atender un pedido. `{}` es el next.config sin i18n ni basePath, como el de este repo.
// `getMiddlewareMatchers` está en el .js y no en su .d.ts: se toma con su forma, la que usa `getMiddlewareRouteMatcher`.
const { getMiddlewareMatchers } = infoDePagina as unknown as { getMiddlewareMatchers: (m: unknown, c: unknown) => Parameters<typeof getMiddlewareRouteMatcher>[0] };
const pasa = (() => {
  const matchers = getMiddlewareMatchers(config.matcher, {});
  const decide = getMiddlewareRouteMatcher(matchers);
  return (ruta: string, headers: Record<string, string> = {}) => decide(ruta, { headers } as never, {});
})();

/** `app/crm/[id]/page.tsx` → `/crm/x.png`. Los grupos `(x)` y los slots `@x` no son parte de la URL. */
function caminoCon(archivo: string, ext: string): string {
  const segs = archivo.replace(/^app\//, '').split('/').slice(0, -1).filter((s) => !/^\(.*\)$/.test(s) && !s.startsWith('@'));
  return '/' + segs.map((s) => (/^\[\[?\.\.\./.test(s) ? `a/x.${ext}` : /^\[.+\]$/.test(s) ? `x.${ext}` : s)).join('/');
}
const rutasDinamicas = () => deGit('app').filter((f) => /\/(page|route)\.(tsx?|jsx?)$/.test(f) && /\/\[/.test(f));

test('el control: el matcher compila y decide como en producción', () => {
  assert.equal(pasa('/integraciones'), true, 'una página común no pasa: esto no compiló el matcher');
  assert.equal(pasa('/'), true);
  for (const r of ['/_next/static/chunks/a.js', '/logo.png', '/sw.js', '/m.js', '/cono-tx/a.json', '/ve/a.json', '/.well-known/assetlinks.json', '/favicon.ico']) {
    assert.equal(pasa(r), false, `${r} es un archivo: no tiene que pasar por el proxy`);
  }
});

test('CADA ruta dinámica de app/ con un valor terminado en extensión pasa por el proxy (también un GET)', () => {
  const rutas = rutasDinamicas();
  assert.ok(rutas.length >= 40, `encontré ${rutas.length} rutas dinámicas: esto no leyó app/`);
  assert.ok(rutas.includes('app/crm/[id]/page.tsx'), 'falta /crm/[id], la del hallazgo');
  const afuera: string[] = [];
  for (const f of rutas) for (const ext of EXTENSIONES) {
    const camino = caminoCon(f, ext);
    if (!pasa(camino)) afuera.push(`${camino} (${f})`);
  }
  assert.deepEqual(afuera, [], 'estas rutas no pasan por el proxy: sin sesión, sin Origin y sin el corte de la cuenta de revisión');
});

test('cada archivo de public/ con esas extensiones sigue afuera, y la lista de carpetas no tiene ninguna de más', () => {
  const conExt = deGit('public').filter((f) => new RegExp(`\\.(${EXTENSIONES.join('|')})$`).test(f));
  assert.ok(conExt.length >= 500, `encontré ${conExt.length} archivos: esto no leyó public/`);
  const adentro = conExt.map((f) => f.replace(/^public/, '')).filter((r) => pasa(r));
  assert.deepEqual(adentro, [], 'estos archivos pasan por el proxy: sin sesión, un visitante recibe el login en vez del archivo');

  const lista = /\(\?:\[\^\/\]\+\|\(\?:([^)]+)\)\//.exec(String(config.matcher[0]))?.[1]?.split('|') ?? [];
  assert.ok(lista.includes('replay') && lista.includes('vsl-assets'), `leí ${JSON.stringify(lista)}: esto no leyó la lista de carpetas`);
  for (const carpeta of lista) {
    assert.ok(conExt.some((f) => f.startsWith(`public/${carpeta}/`)), `«${carpeta}» está en la lista y no tiene ningún archivo así: sólo abre un hueco`);
  }
});

test('todo lo que Next trataría como server action pasa por el proxy, en CUALQUIER camino', () => {
  const caminos = ['/logo.png', '/sw.js', '/m.js', '/crm/x.png', '/m/crm/x.css', '/_next/static/chunks/a.js', '/_next/image', '/ve/a.json',
    '/cono-tx/a.json', '/.well-known/assetlinks.json', '/favicon.ico', '/replay/1/r.js', '/integraciones'];
  const tipos = [undefined, 'application/json', 'text/plain;charset=UTF-8', 'multipart/form-data', 'multipart/form-data; boundary=----x',
    'application/x-www-form-urlencoded', 'application/x-www-form-urlencoded;charset=UTF-8', 'MULTIPART/FORM-DATA'];
  const acciones = [undefined, 'abc', '7f9a3c0e5b1d2a4f6e8c0b9d7a5f3e1c2b4d6a8f0c'];
  let acciones_vistas = 0;
  for (const camino of caminos) for (const tipo of tipos) for (const accion of acciones) {
    const headers: Record<string, string> = {};
    if (tipo) headers['content-type'] = tipo;
    if (accion) headers['next-action'] = accion;
    if (!getServerActionRequestMetadata({ method: 'POST', headers } as never).isPossibleServerAction) continue;
    acciones_vistas += 1;
    assert.equal(pasa(camino, headers), true, `POST ${camino} con ${JSON.stringify(headers)} es una server action y no pasa por el proxy`);
  }
  assert.ok(acciones_vistas >= caminos.length * 8, `sólo ${acciones_vistas} combinaciones eran acciones: esto no usó el criterio de Next`);
  // Y no manda TODO POST al proxy: un JSON a un archivo de la raíz sigue afuera.
  assert.equal(pasa('/logo.png', { 'content-type': 'application/json' }), false);
});

test('un `next-action` VACÍO no lo ve el matcher (Next lo trata como «sin valor»), y Next no corre nada con él', () => {
  // `matchHas` toma un header vacío como ausente, así que esta combinación es la única que queda afuera. Lo que la hace inofensiva
  // es que el handler de acciones corta antes de buscar la acción: `if (!actionId) throw … Missing 'next-action' header`. Si Next
  // cambia eso, este test falla y hay que buscar otra forma de mandarla al proxy.
  assert.equal(pasa('/logo.png', { 'next-action': '' }), false);
  const handler = readFileSync(join(RAIZ, 'node_modules', 'next', 'dist', 'server', 'app-render', 'action-handler.js'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(handler, /function getActionModIdOrError\(actionId, serverModuleMap\) \{[^}]*if \(!actionId\) \{\s*throw[^}]*Missing 'next-action' header/);
});
