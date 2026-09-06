// =============================================================================
// El service worker CARGA — y esto se comprueba en un NODE de verdad
// =============================================================================
// `background.js` es un módulo ES para poder importar el catálogo de operaciones.
// Eso abre una clase de fallo silenciosa: un import que no resuelve deja el service
// worker **sin arrancar**. Chrome no lo dice en ningún lado visible — la extensión
// aparece instalada, el popup abre, y todo contesta que no hay nada.
//
// ⚠️ NI EL TYPECHECK NI `node --check` LO VEN: el typecheck no mira `extension/` y
// `node --check` no resuelve un solo import.
//
// ⚠️⚠️ Y LA PRIMERA VERSIÓN DE ESTE TEST TAMPOCO LO VEÍA — DABA VERDE SOBRE UN
// WORKER QUE NO CARGABA.
//
// Hacía `await import(...)` desde el propio test. Pero `tsx` transpila los tests a
// CJS, y ahí el `import()` dinámico se resuelve con interop de CommonJS: **no exige
// que los exports nombrados existan**. Medido el 05/09/2026: con
// `import { A_PEDIR } from './operaciones.js'` y `A_PEDIR` sin exportar, el test
// decía «carga» y node de verdad contestaba «does not provide an export named
// A_PEDIR».
//
// Un test verde sobre la propiedad equivocada es la forma más cara de estar seguro,
// y acá era peor: el test existía JUSTAMENTE para cubrir ese fallo.
//
// La cura es correr la comprobación en un proceso `node` real, con un `.mjs` que se
// escribe al vuelo. Ahí el linker de módulos ES es el de producción y los exports
// nombrados se exigen de verdad.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const EXT = resolve(import.meta.dirname, '..', 'extension');

/** Lo mínimo de la API de extensiones para que el nivel superior no tire. */
const CHROME = `
const noop = () => {};
const l = () => ({ addListener: noop, removeListener: noop, hasListener: () => false });
globalThis.chrome = {
  runtime: { onMessage: l(), onInstalled: l(), onStartup: l(), onConnect: l(), onSuspend: l(),
    getManifest: () => ({ version: '0.0.0' }), lastError: null, id: 'test' },
  storage: { local: {
      get: (k, cb) => (typeof cb === 'function' ? cb({}) : Promise.resolve({})),
      set: (o, cb) => (typeof cb === 'function' ? cb() : Promise.resolve()),
      remove: (k, cb) => (typeof cb === 'function' ? cb() : Promise.resolve()),
    }, onChanged: l() },
  alarms: { create: noop, onAlarm: l(), clear: () => Promise.resolve(true),
    get: () => Promise.resolve(null), getAll: () => Promise.resolve([]) },
  tabs: { query: () => Promise.resolve([]), sendMessage: () => Promise.resolve(null),
    create: () => Promise.resolve({ id: 1 }), update: () => Promise.resolve({ id: 1 }),
    reload: () => Promise.resolve(), get: () => Promise.resolve({ id: 1, url: '' }),
    onUpdated: l(), onRemoved: l(), onActivated: l() },
  webRequest: { onBeforeRedirect: l(), onCompleted: l(), onBeforeRequest: l(),
    onBeforeSendHeaders: l(), onHeadersReceived: l(), onErrorOccurred: l(),
    onResponseStarted: l(), onSendHeaders: l() },
  scripting: { executeScript: () => Promise.resolve([]) },
  action: { setBadgeText: noop, setBadgeBackgroundColor: noop, setTitle: noop },
  windows: { update: () => Promise.resolve({}), getCurrent: () => Promise.resolve({ id: 1 }) },
};
`;

/** Corre un `.mjs` en un node real y devuelve su salida. */
function enNodeDeVerdad(cuerpo: string): string {
  const archivo = resolve(EXT, '_carga.test.mjs');
  writeFileSync(archivo, CHROME + cuerpo);
  try {
    return String(execFileSync(process.execPath, [archivo], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  } finally {
    try { rmSync(archivo); } catch { /* si no se pudo borrar, no importa */ }
  }
}

test('`background.js` carga en un node real, con sus exports nombrados resueltos', () => {
  const salida = enNodeDeVerdad(`
try {
  await import('./background.js');
  console.log('OK');
} catch (e) {
  console.log('FALLA:' + String(e && e.message).split('\\n')[0]);
}
`);
  assert.match(
    salida, /OK/,
    'El service worker NO carga. En Chrome eso es una extensión que aparece instalada\n'
    + 'y no hace nada, sin ningún error visible.\n\n'
    + salida.trim(),
  );
});

test('el catálogo exporta TODO lo que el worker le importa', () => {
  // El caso concreto que se escapó: `A_PEDIR` importado y no exportado. Se comprueba
  // nombre por nombre, leyendo el import del propio worker en vez de una lista a mano
  // — una lista a mano se queda vieja al próximo import.
  const bg = readFileSync(resolve(EXT, 'background.js'), 'utf8');
  const m = /import\s*\{([^}]+)\}\s*from\s*'\.\/operaciones\.js'/.exec(bg);
  assert.ok(m, 'el worker ya no importa del catálogo: ¿se movió?');
  const nombres = m[1].split(',').map((x) => x.trim()).filter(Boolean);
  assert.ok(nombres.length, 'no pude leer los nombres importados');

  const salida = enNodeDeVerdad(`
const cat = await import('./operaciones.js');
const faltan = ${JSON.stringify(nombres)}.filter((n) => !(n in cat));
console.log(faltan.length ? 'FALTAN:' + faltan.join(',') : 'OK');
`);
  assert.match(
    salida, /OK/,
    'El worker importa nombres que el catálogo no exporta. El import falla al LINKEAR,\n'
    + 'así que el service worker no arranca y Chrome no lo dice.\n\n'
    + 'Agregalos a la plantilla de scripts/sync-operaciones.mjs y volvé a generar.\n\n'
    + salida.trim(),
  );
});

test('el catálogo llega con contenido', async () => {
  // `pathToFileURL` y no la ruta pelada: en Windows un `C:\…` no es un esquema de URL
  // válido para un `import()` y node contesta ERR_UNSUPPORTED_ESM_URL_SCHEME.
  const { pathToFileURL } = await import('node:url');
  const cat = await import(pathToFileURL(resolve(EXT, 'operaciones.js')).href) as {
    OPERACIONES: unknown[]; A_PEDIR: unknown[];
  };
  assert.ok(cat.OPERACIONES.length >= 6, 'el catálogo llegó vacío o corto');
  assert.ok(cat.A_PEDIR.length >= 1, 'no hay ninguna operación que pedirle a la persona');
});

test('`VERSION_ESPEJO` es la versión del manifest', () => {
  // ⚠️ SI SE SEPARAN, EL DIAGNÓSTICO MIENTE AL REVÉS: reportaría «la pestaña corre un
  // espejo viejo, hace falta F5» sobre pestañas perfectamente al día, en todos los
  // clientes a la vez. Y un aviso que sale siempre enseña a ignorar todos los demás.
  const man = JSON.parse(readFileSync(resolve(EXT, 'manifest.json'), 'utf8'));
  const inj = readFileSync(resolve(EXT, 'injected.js'), 'utf8');
  const m = /const VERSION_ESPEJO = '([^']+)'/.exec(inj);
  assert.ok(m, 'no encontré VERSION_ESPEJO en injected.js');
  assert.equal(
    m[1], man.version,
    `El espejo dice ${m[1]} y el manifest ${man.version}. Con eso, toda pestaña al día\n`
    + 'se reporta como desfasada y el aviso de «hace falta F5» sale siempre.',
  );
});

test('el manifest declara el background como módulo', () => {
  const man = JSON.parse(readFileSync(resolve(EXT, 'manifest.json'), 'utf8'));
  assert.equal(
    man.background?.type, 'module',
    'background.js usa `import` y el manifest no lo declara módulo: no va a arrancar.',
  );
});
