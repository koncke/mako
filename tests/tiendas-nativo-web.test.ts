// =============================================================================
// Lo que la app de iPhone hace con el aparato (lib/nativo.ts), del lado de la web (3/11/2026)
// =============================================================================
// Plan: docs/tiendas-play-appstore.md, pasos 8 y 9. La app es la misma web adentro de Capacitor, así que no hay un iPhone acá: se corre el
// módulo REAL contra un `window.Capacitor` de mentira, que anota lo que le piden al aparato. Lo que falta mirar en un iPhone de verdad
// (TestFlight) está en la lista del plan: acá se fija lo que no depende de eso.
//
// Correr: node --import tsx --test tests/tiendas-nativo-web.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (3/11/2026): al pie del archivo.
// =============================================================================

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  activarAvisosNativo, asegurarAvisosNativo, desactivarAvisosNativo, engancharApp, esAppNativa, estadoAvisosNativo, guardarEnElAparato, hapticoNativo, instalarDescargas, nombreSeguro,
} from '../lib/nativo';
import { rutaDeLinkDeLaApp } from '../lib/tienda';

const leer = (f: string) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const g = globalThis as unknown as Record<string, unknown>;

type Anotado = { trozos: string[]; escrito: Map<string, Buffer>; compartido: Array<{ files?: string[] }>; haptica: unknown[]; oyentes: Record<string, (e: never) => void>; pedidos: Array<{ url: string; init: RequestInit }>; fuimosA: string[]; permiso: string; registrar: number };

let a: Anotado;
let clickOriginal: () => void;
let clicksOriginales = 0;

class AnclaFalsa {
  href = ''; download = ''; pathname = '/';
  attrs = new Set<string>();
  hasAttribute(n: string) { return this.attrs.has(n); }
  getAttribute(n: string) { return n === 'href' ? this.href : null; }
  click() { clickOriginal.call(this); }
}

function montar(conCapacitor: boolean) {
  a = { trozos: [], escrito: new Map(), compartido: [], haptica: [], oyentes: {}, pedidos: [], fuimosA: [], permiso: 'prompt', registrar: 0 };
  clicksOriginales = 0;
  clickOriginal = () => { clicksOriginales += 1; };
  const storage = new Map<string, string>();
  g.localStorage = { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => { storage.set(k, v); }, removeItem: (k: string) => { storage.delete(k); } };
  g.location = { href: 'https://hola-mako.com/inicio', origin: 'https://hola-mako.com', assign: (r: string) => a.fuimosA.push(r) };
  g.document = { addEventListener: () => {}, removeEventListener: () => {} };
  g.HTMLAnchorElement = AnclaFalsa;
  g.FileReader = class {
    result: string | null = null; error: unknown = null; onload: (() => void) | null = null; onerror: (() => void) | null = null;
    readAsDataURL(b: Blob) { void b.arrayBuffer().then((x) => { this.result = `data:application/octet-stream;base64,${Buffer.from(x).toString('base64')}`; this.onload?.(); }); }
  };
  g.fetch = (async (url: string, init: RequestInit = {}) => {
    a.pedidos.push({ url, init });
    return new Response(JSON.stringify({ ok: true, guardado: true }), { status: 200 });
  }) as unknown;
  const Plugins = {
    Filesystem: {
      writeFile: async (o: { path: string; data: string }) => { a.trozos.push(o.data); a.escrito.set(o.path, Buffer.from(o.data, 'base64')); return { uri: `file:///cache/${o.path}` }; },
      appendFile: async (o: { path: string; data: string }) => { a.trozos.push(o.data); a.escrito.set(o.path, Buffer.concat([a.escrito.get(o.path) ?? Buffer.alloc(0), Buffer.from(o.data, 'base64')])); },
    },
    Share: { share: async (o: { files?: string[] }) => { a.compartido.push(o); } },
    Haptics: { notification: async (o: unknown) => { a.haptica.push(o); }, impact: async (o: unknown) => { a.haptica.push(o); } },
    App: { addListener: async (ev: string, fn: (e: never) => void) => { a.oyentes[ev] = fn; } },
    PushNotifications: {
      checkPermissions: async () => ({ receive: a.permiso }),
      requestPermissions: async () => ({ receive: a.permiso }),
      register: async () => { a.registrar += 1; (a.oyentes.registration as unknown as (t: { value: string }) => void)?.({ value: 'ab'.repeat(32) }); },
      addListener: async (ev: string, fn: (e: never) => void) => { a.oyentes[ev] = fn; },
    },
  };
  g.window = { location: g.location, Capacitor: conCapacitor ? { isNativePlatform: () => true, Plugins } : undefined };
}

const crearOriginal = URL.createObjectURL;
const revocarOriginal = URL.revokeObjectURL;
beforeEach(() => montar(true));
afterEach(() => { URL.createObjectURL = crearOriginal; URL.revokeObjectURL = revocarOriginal; delete g.window; delete g.document; delete g.location; delete g.HTMLAnchorElement; delete g.FileReader; delete g.localStorage; });

const esperar = async (cond: () => boolean) => { for (let i = 0; i < 200 && !cond(); i++) await new Promise((r) => setTimeout(r, 5)); };

test('1. afuera de la app no toca nada: ni el prototipo, ni los hápticos, ni el guardado', async () => {
  montar(false);
  assert.equal(esAppNativa(), false);
  const antes = AnclaFalsa.prototype.click;
  const soltar = engancharApp();
  assert.equal(AnclaFalsa.prototype.click, antes, 'parchó `click` en un navegador');
  assert.equal(URL.createObjectURL, crearOriginal, 'parchó createObjectURL en un navegador');
  instalarDescargas();
  assert.equal(AnclaFalsa.prototype.click, antes, 'instalarDescargas tiene su propia pregunta: la llaman sola');
  assert.equal(URL.createObjectURL, crearOriginal);
  assert.equal(hapticoNativo('success'), false);
  assert.equal(await guardarEnElAparato(new Blob(['x']), 'x.txt'), false);
  assert.equal(await estadoAvisosNativo(), 'no-soportado');
  assert.deepEqual(await activarAvisosNativo(), { ok: false, estado: 'no-soportado' });
  soltar();
});

test('2. `a.click()` con `download`: el archivo va a la hoja de compartir, aunque el blob se revoque en la misma línea', async () => {
  const soltar = instalarDescargas();
  const b = new Blob(['codigos de recuperacion']);
  const url = URL.createObjectURL(b);
  const ancla = new AnclaFalsa();
  ancla.href = url; ancla.download = 'mako-codigos.txt'; ancla.attrs.add('download');
  ancla.click();
  URL.revokeObjectURL(url); // lo que hace casi todo el repo: app/login/2fa/descargar-codigos.ts, el editor de video…
  await esperar(() => a.compartido.length > 0);
  assert.equal(clicksOriginales, 0, 'el `click` de verdad en un WKWebView no hace nada');
  assert.equal(a.escrito.get('mako-codigos.txt')?.toString(), 'codigos de recuperacion');
  assert.deepEqual(a.compartido[0].files, ['file:///cache/mako-codigos.txt']);
  soltar();
});

test('3. un link sin `download` sigue siendo un link, y un `download` a la nada no baja la página', () => {
  const soltar = instalarDescargas();
  const ancla = new AnclaFalsa();
  ancla.href = 'https://hola-mako.com/crm';
  ancla.click();
  assert.equal(clicksOriginales, 1);
  const vacio = new AnclaFalsa();
  vacio.href = '#'; vacio.download = 'x'; vacio.attrs.add('download');
  vacio.click();
  assert.equal(clicksOriginales, 2);
  assert.equal(a.pedidos.length, 0);
  soltar();
});

test('3b. un 401 o un 500 no se comparte como si fuera el archivo', async () => {
  const soltar = instalarDescargas();
  g.fetch = (async () => new Response('{"ok":false}', { status: 401 })) as unknown;
  const ancla = new AnclaFalsa();
  ancla.href = 'https://hola-mako.com/api/doc?id=1'; ancla.download = 'x.pdf'; ancla.attrs.add('download');
  ancla.pathname = '/api/doc';
  ancla.click();
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(a.compartido.length, 0);
  soltar();
});

test('4. un video grande se escribe de a trozos, y queda igual', async () => {
  const contenido = Buffer.alloc(7 * 1024 * 1024 + 123);
  for (let i = 0; i < contenido.length; i += 4096) contenido[i] = i % 251;
  assert.equal(await guardarEnElAparato(new Blob([contenido]), 'video.mp4'), true);
  const escrito = a.escrito.get('video.mp4');
  assert.equal(escrito?.length, contenido.length);
  assert.ok(escrito?.equals(contenido), 'cada trozo tiene que ser base64 válido por sí solo');
  assert.ok(a.trozos.length >= 3, 'de a trozos: en base64 de una, el WebView se queda sin memoria');
  assert.ok(a.trozos.slice(0, -1).every((t) => !t.endsWith('=')), 'relleno en el medio: un lector que concatena el base64 se rompe');
});

test('5. el nombre no sale de la carpeta', () => {
  assert.equal(nombreSeguro('../../etc/passwd'), '-..-etc-passwd'.replace(/^-\.\./, '-..').replace(/^\.+/, ''));
  assert.doesNotMatch(nombreSeguro('../../etc/passwd'), /\//);
  assert.doesNotMatch(nombreSeguro('..\\..\\x'), /\\/);
  assert.equal(nombreSeguro(''), 'archivo-de-mako');
  assert.ok(!nombreSeguro('...oculto').startsWith('.'));
});

test('6. un link que abre la app sólo va adentro de hola-mako.com', () => {
  assert.equal(rutaDeLinkDeLaApp('https://hola-mako.com/crm/12?ws=3#a'), '/crm/12?ws=3#a');
  for (const malo of ['https://hola-mako.com.evil.com/x', 'https://hola-mako.com@evil.com/x', 'http://hola-mako.com/x', 'https://evil.com/?https://hola-mako.com/', 'javascript:alert(1)', '', null, undefined, 'mako://x']) {
    assert.equal(rutaDeLinkDeLaApp(malo), null, String(malo));
  }
  engancharApp();
  (a.oyentes.appUrlOpen as unknown as (e: { url: string }) => void)({ url: 'https://hola-mako.com/crm/12' });
  (a.oyentes.appUrlOpen as unknown as (e: { url: string }) => void)({ url: 'https://evil.com/robar' });
  (a.oyentes.pushNotificationActionPerformed as unknown as (e: unknown) => void)({ notification: { data: { url: 'https://hola-mako.com/mako/pendientes' } } });
  assert.deepEqual(a.fuimosA, ['/crm/12', '/mako/pendientes']);
});

test('7. los hápticos los hace el aparato', () => {
  assert.equal(hapticoNativo('success'), true);
  assert.equal(hapticoNativo('light'), true);
  assert.deepEqual(a.haptica, [{ type: 'SUCCESS' }, { style: 'LIGHT' }]);
  assert.match(leer('lib/haptico.ts').replace(/^\s*\/\/.*$/gm, ''), /if \(hapticoNativo\(tipo\)\) return;\s+if \(typeof navigator\.vibrate/);
});

test('8. activar los avisos: pide permiso, espera el token y lo ata a la persona', async () => {
  engancharApp();
  assert.equal(await estadoAvisosNativo(), 'apagado');
  a.permiso = 'denied';
  assert.equal(await estadoAvisosNativo(), 'bloqueado');
  assert.deepEqual(await activarAvisosNativo(), { ok: false, estado: 'bloqueado' });
  assert.equal(a.registrar, 0, 'sin permiso no se registra');
  a.permiso = 'granted';
  assert.deepEqual(await activarAvisosNativo(), { ok: true });
  assert.equal(await estadoAvisosNativo(), 'activo');
  const post = a.pedidos.find((p) => p.init.method === 'POST');
  assert.deepEqual(JSON.parse(String(post?.init.body)), { apns: { token: 'ab'.repeat(32) } });
  assert.equal(post?.url, '/api/push/suscripcion');
  // Otra cuenta en el mismo iPhone: vuelve a atarlo sin pedir nada.
  a.pedidos.length = 0;
  assert.equal(await asegurarAvisosNativo(), true);
  assert.equal(a.pedidos.length, 1);
  // Apagar: suelta la fila, y queda apagado.
  assert.equal(await desactivarAvisosNativo(), true);
  assert.equal(a.pedidos.at(-1)?.init.method, 'DELETE');
  assert.equal(await estadoAvisosNativo(), 'apagado');
});

test('9. las pantallas de siempre pasan por acá sin enterarse', () => {
  const c = leer('lib/push-cliente.ts').replace(/^\s*\/\/.*$/gm, '');
  for (const [f, llamada] of [['estadoSuscripcion', 'estadoAvisosNativo'], ['asegurarRegistro', 'asegurarAvisosNativo'], ['activarAvisos', 'activarAvisosNativo'], ['desactivarAvisos', 'desactivarAvisosNativo']]) {
    assert.match(c, new RegExp(`export async function ${f}\\(\\)[^\\n]*\\n\\s*if \\(esAppNativa\\(\\)\\)[\\s\\S]{0,60}${llamada}\\(\\)`), f);
  }
  assert.match(c, /if \(esAppNativa\(\)\) \{ await soltarAvisosNativo\(\); return; \}/);
  assert.match(leer('app/layout.tsx').replace(/\{\/\*[\s\S]*?\*\/\}/g, ''), /\n\s*<PuenteNativo \/>/, 'en el layout raíz: los códigos se bajan en /login/2fa');
});

// ⚠️ PROBADO ROMPIÉNDOLO (3/11/2026, base 9 / 0; una rotura por vez, restaurada de memoria y comprobada con sha256):
//   · `click` cae al original                     → 8 / 1 (2)
//   · el blob no se guarda al crearlo             → 8 / 1 (2): es el bug de `a.click(); URL.revokeObjectURL(url);`
//   · un trozo que no es múltiplo de 3            → 8 / 1 (4). La primera versión NO la veía: decodificaba trozo por trozo, y ahí el relleno no molesta.
//   · instalarDescargas sin preguntar             → 8 / 1 (1). Tampoco la veía: la tapaba la pregunta de `engancharApp`.
//   · un link de afuera abre la app               → 8 / 1 (6)
//   · el host se compara por prefijo              → 8 / 1 (6)
//   · se registra sin permiso                     → 8 / 1 (8)
//   · push-cliente no pregunta por la app         → 8 / 1 (9)
