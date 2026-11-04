// =============================================================================
// La prueba de humo de producción (scripts/humo-produccion.mjs), contra un servidor HTTP de verdad en esta máquina.
// =============================================================================
// Lo que cuida, y cada assert se probó rompiéndolo (4/11/2026, node 24.22):
//   · un sitio sano da verde, y con TODOS los chequeos (sin un `.ok` forzado: con `juzgar` devolviendo siempre null el test de
//     la base caída da verde, y su assert da rojo).
//   · la base caída (/m.js contesta 503) es rojo y lo nombra: es lo único que mira la base.
//   · una página que contesta 200 con OTRA cosa (la portada sin «MaKo») es rojo: un 200 no es «vivo».
//   · un bache que se arregla al segundo intento NO es rojo (justo después de un deploy el alias tarda), y dos fallos seguidos sí.
//   · ningún chequeo usa un método que no sea GET (la prueba no escribe): el servidor de mentira cuenta los métodos.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { chequeos, correrHumo, correrUno, juzgar, pixelDeHumo } from '../scripts/humo-produccion.mjs';

type Respuesta = { status: number; tipo: string; cuerpo: string };
const SANO: Record<string, Respuesta> = {
  '/': { status: 200, tipo: 'text/html; charset=utf-8', cuerpo: '<html><title>MaKo</title></html>' },
  '/login': { status: 200, tipo: 'text/html', cuerpo: '<html><body>entrar</body></html>' },
  '/privacidad': { status: 200, tipo: 'text/html', cuerpo: '<html>Política de privacidad</html>' },
  '/planes': { status: 200, tipo: 'text/html', cuerpo: '<html>planes</html>' },
  '/robots.txt': { status: 200, tipo: 'text/plain', cuerpo: 'User-Agent: *\nAllow: /\n' },
  '/api/auth/me': { status: 200, tipo: 'application/json', cuerpo: '{"ok":true,"autenticado":false}' },
  '/api/v1': { status: 401, tipo: 'application/json', cuerpo: '{"message":"Falta el token"}' },
  '/api/cron/tickets': { status: 401, tipo: 'text/plain', cuerpo: 'no' },
  '/m.js': { status: 404, tipo: 'application/javascript; charset=utf-8', cuerpo: '/* MaKo: este Pixel no existe */\n' },
};

async function conServidor(responder: (ruta: string, intento: number) => Respuesta | undefined, fn: (base: string, metodos: string[]) => Promise<void>) {
  const metodos: string[] = [];
  const vistos = new Map<string, number>();
  const srv = createServer((req: IncomingMessage, res: ServerResponse) => {
    metodos.push(req.method ?? '?');
    const ruta = new URL(req.url ?? '/', 'http://x').pathname;
    const n = (vistos.get(ruta) ?? 0) + 1;
    vistos.set(ruta, n);
    const r = responder(ruta, n) ?? { status: 404, tipo: 'text/plain', cuerpo: 'no existe' };
    res.writeHead(r.status, { 'content-type': r.tipo });
    res.end(r.cuerpo);
  });
  await new Promise<void>((ok) => srv.listen(0, '127.0.0.1', ok));
  try {
    await fn(`http://127.0.0.1:${(srv.address() as AddressInfo).port}`, metodos);
  } finally {
    await new Promise((ok) => srv.close(ok));
  }
}

const RAPIDO = { esperaMs: 10, timeoutMs: 3000 };

test('un sitio sano: todos los chequeos vivos, y ninguno escribe (sólo GET)', async () => {
  await conServidor((ruta) => SANO[ruta], async (base, metodos) => {
    const r = await correrHumo(base, RAPIDO);
    assert.equal(r.length, chequeos('x').length);
    assert.deepEqual(r.filter((x) => !x.ok).map((x) => `${x.id}: ${x.porque}`), []);
    assert.ok(metodos.length >= r.length);
    assert.deepEqual([...new Set(metodos)], ['GET'], 'la prueba de humo no escribe nada');
  });
});

test('la base caída (el Pixel contesta 503) es rojo, y dice cuál', async () => {
  await conServidor((ruta) => (ruta === '/m.js' ? { status: 503, tipo: 'application/javascript', cuerpo: '/* MaKo: no se pudo cargar el Pixel */' } : SANO[ruta]), async (base) => {
    const r = await correrHumo(base, RAPIDO);
    const mal = r.filter((x) => !x.ok);
    assert.deepEqual(mal.map((x) => x.id), ['Pixel + base']);
    assert.match(mal[0].porque ?? '', /contestó 503, esperaba 404/);
  });
});

test('un 200 que no es la página (la portada sin «MaKo») es rojo', async () => {
  await conServidor((ruta) => (ruta === '/' ? { status: 200, tipo: 'text/html', cuerpo: '<html>Application error</html>' } : SANO[ruta]), async (base) => {
    const r = await correrHumo(base, RAPIDO);
    assert.deepEqual(r.filter((x) => !x.ok).map((x) => x.id), ['portada']);
  });
});

test('un bache que se arregla al segundo intento no es rojo; dos fallos seguidos, sí', async () => {
  const portada = chequeos('x')[0];
  await conServidor((ruta, n) => (n === 1 ? { status: 502, tipo: 'text/html', cuerpo: 'bad gateway' } : SANO[ruta]), async (base) => {
    const r = await correrUno(base, portada, RAPIDO);
    assert.equal(r.ok, true);
    assert.equal(r.intento, 2);
  });
  await conServidor(() => ({ status: 502, tipo: 'text/html', cuerpo: 'bad gateway' }), async (base) => {
    const r = await correrUno(base, portada, RAPIDO);
    assert.equal(r.ok, false);
    assert.match(r.porque ?? '', /502/);
  });
});

test('el id del Pixel de humo tiene la forma de un token (si no, contesta 404 sin preguntarle a la base) y no se repite', () => {
  const a = pixelDeHumo();
  assert.match(a, /^[\w-]{8,64}$/, 'FORMA_TOKEN de lib/pixel-cargador.ts');
  assert.notEqual(a, pixelDeHumo(), 'un id repetido lo contestaría la CDN (s-maxage=60), no la base');
  assert.equal(juzgar({ status: 404, tipo: /javascript/, cuerpo: /no existe/ }, { status: 404, tipo: 'application/javascript', cuerpo: '/* no existe */' }), null);
});
