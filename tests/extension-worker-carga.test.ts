// =============================================================================
// El service worker CARGA — y eso no lo dice ningún otro chequeo
// =============================================================================
// `background.js` pasó a ser un módulo ES para poder importar el catálogo de
// operaciones. Eso abre una clase de fallo nueva y silenciosa: un import que no
// resuelve, o un error en el nivel superior, hace que el service worker **no
// arranque**. Chrome no lo dice en ningún lado visible — la extensión aparece
// instalada, el popup abre, y todo contesta que no hay nada.
//
// ⚠️ NI EL TYPECHECK NI `node --check` LO VEN. El typecheck no mira `extension/`
// (es JS suelto) y `node --check` valida la sintaxis de UN archivo sin resolver un
// solo import. La única forma de saberlo es cargarlo.
//
// Este test lo carga con lo mínimo de `chrome` simulado. No prueba comportamiento:
// prueba que el worker existe como worker. Es barato y cubre el modo de falla más
// caro que tiene un MV3 con módulos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const noop = () => {};
const listener = () => ({ addListener: noop, removeListener: noop, hasListener: () => false });

/** Lo mínimo de la API de extensiones para que el nivel superior no tire. */
function chromeSimulado() {
  return {
    runtime: {
      onMessage: listener(), onInstalled: listener(), onStartup: listener(),
      onConnect: listener(), onSuspend: listener(),
      getManifest: () => ({ version: '0.0.0' }),
      lastError: null, id: 'test',
    },
    storage: {
      local: {
        get: (_k: unknown, cb?: (v: unknown) => void) => {
          if (typeof cb === 'function') { cb({}); return undefined; }
          return Promise.resolve({});
        },
        set: (_o: unknown, cb?: () => void) => {
          if (typeof cb === 'function') { cb(); return undefined; }
          return Promise.resolve();
        },
        remove: (_k: unknown, cb?: () => void) => {
          if (typeof cb === 'function') { cb(); return undefined; }
          return Promise.resolve();
        },
      },
      onChanged: listener(),
    },
    alarms: {
      create: noop, onAlarm: listener(),
      clear: () => Promise.resolve(true), get: () => Promise.resolve(null),
      getAll: () => Promise.resolve([]),
    },
    tabs: {
      query: () => Promise.resolve([]), sendMessage: () => Promise.resolve(null),
      create: () => Promise.resolve({ id: 1 }), update: () => Promise.resolve({ id: 1 }),
      reload: () => Promise.resolve(), get: () => Promise.resolve({ id: 1, url: '' }),
      onUpdated: listener(), onRemoved: listener(), onActivated: listener(),
    },
    webRequest: {
      onBeforeRedirect: listener(), onCompleted: listener(), onBeforeRequest: listener(),
      onBeforeSendHeaders: listener(), onHeadersReceived: listener(),
      onErrorOccurred: listener(), onResponseStarted: listener(), onSendHeaders: listener(),
    },
    scripting: { executeScript: () => Promise.resolve([]) },
    action: { setBadgeText: noop, setBadgeBackgroundColor: noop, setTitle: noop },
    windows: { update: () => Promise.resolve({}), getCurrent: () => Promise.resolve({ id: 1 }) },
  };
}

const EXT = resolve(import.meta.dirname, '..', 'extension');

test('`background.js` carga como módulo ES, con sus imports resueltos', async () => {
  (globalThis as Record<string, unknown>).chrome = chromeSimulado();
  try {
    await import(pathToFileURL(resolve(EXT, 'background.js')).href);
  } catch (e) {
    assert.fail(
      'El service worker NO carga. En Chrome eso es una extensión que aparece\n'
      + 'instalada y no hace nada, sin ningún error visible.\n\n'
      + String((e as Error)?.stack || e).split('\n').slice(0, 5).join('\n'),
    );
  }
});

test('el catálogo de operaciones llega hasta la extensión', async () => {
  // El import del worker es lo que se está probando arriba; acá se comprueba que lo
  // que importa tiene contenido. Un catálogo vacío no rompe nada y deja al puente
  // sin nada que enseñar, para siempre.
  const cat = await import(pathToFileURL(resolve(EXT, 'operaciones.js')).href) as {
    OPERACIONES: unknown[]; A_ENSENAR: unknown[];
  };
  assert.ok(cat.OPERACIONES.length >= 6, 'el catálogo llegó vacío o corto');
  assert.ok(cat.A_ENSENAR.length >= 1, 'no hay ninguna operación para enseñar');
});

test('el manifest declara el background como módulo', async () => {
  // Sin `"type": "module"` el worker con `import` no arranca, y el síntoma es el
  // mismo silencio de arriba.
  const { readFileSync } = await import('node:fs');
  const man = JSON.parse(readFileSync(resolve(EXT, 'manifest.json'), 'utf8'));
  assert.equal(
    man.background?.type, 'module',
    'background.js usa `import` y el manifest no lo declara módulo: no va a arrancar.',
  );
});
