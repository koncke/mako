// =============================================================================
// La prueba de carga (scripts/prueba-de-carga.mjs, O27 del 18/11/2026): lo puro (las estadísticas, el plan, el rechazo a
// producción) y la carga DE VERDAD contra un servidor local de mentira, que cuenta cuántos pedidos tiene abiertos a la vez.
// Nunca se le pide a nada que no sea 127.0.0.1.
//
// PROBADO ROMPIÉNDOLO (18/11/2026, base 9/0; cada rotura a mano y vuelta atrás):
//   · `esLocal` que acepta cualquier host (el rechazo a producción, sacado)               → 7/2 (2, 9)
//   · `percentil` con `Math.floor` en lugar de `Math.ceil` (corre un lugar el rango)        → 7/2 (1, 5)
//   · `correrCarga` lanzando TODOS los pedidos a la vez (sin respetar la concurrencia)      → 8/1 (7)
//   · `resumir` metiendo los 307 a /login en los tiempos (p50 de mentira)                   → 8/1 (5)
//   · `textoDelPlan` imprimiendo la cookie                                                  → 8/1 (4)
// =============================================================================

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';
import {
  armarPlan, clasificar, correrCarga, esLocal, ordenDePedidos, percentil, resumir, tablaDeResumen, textoDelPlan,
  BANDERA_PRODUCCION, TOPE_CONCURRENCIA, TOPE_PEDIDOS,
} from '../scripts/prueba-de-carga.mjs';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const COOKIE = 'mako_sesion=secreto-de-prueba-1234567890';
const sinLeer = { env: {}, leer: () => { throw new Error('no debería leer ningún archivo'); } };

test('1. percentil por rango más cercano: sin muestras null, uno solo es todos, 1..100 da 50/95/99, y no toca la lista', () => {
  assert.equal(percentil([], 50), null);
  assert.equal(percentil([Number.NaN], 50), null, 'un tiempo que no es número no es una muestra');
  assert.deepEqual([50, 95, 99].map((p) => percentil([7], p)), [7, 7, 7]);
  const cien = Array.from({ length: 100 }, (_, i) => 100 - i);   // 100..1, desordenado a propósito
  const copia = [...cien];
  assert.deepEqual([percentil(cien, 50), percentil(cien, 95), percentil(cien, 99), percentil(cien, 100)], [50, 95, 99, 100]);
  assert.deepEqual(cien, copia, 'no ordena la lista de quien llama');
  assert.equal(percentil([10, 20, 30, 40], 50), 20);
  assert.equal(percentil([10, 20, 30, 40], 95), 40);
});

test('2. el destino se decide EN POSITIVO: sólo esta máquina sin la bandera; producción, Vercel y lo demás, rechazados', () => {
  for (const h of ['localhost', 'app.localhost', '127.0.0.1', '127.5.6.7', '[::1]', '::1', '0.0.0.0']) assert.ok(esLocal(h), `${h} es esta máquina`);
  for (const h of ['hola-mako.com', 'www.hola-mako.com', 'hola-mako.site', 'mako-git-x-equipo.vercel.app', 'localhost.evil.com', '128.0.0.1', '10.0.0.5', ''])
    assert.ok(!esLocal(h), `${h} NO es esta máquina`);
  for (const base of ['https://hola-mako.com', 'https://mako-abc123-equipo.vercel.app', 'https://localhost.evil.com']) {
    const r = armarPlan(['--base', base, '--rutas', '/dashboard'], sinLeer);
    assert.equal(r.ok, false, `${base} sin la bandera tiene que negarse`);
    assert.ok(!r.ok && r.error.includes(BANDERA_PRODUCCION), 'el rechazo nombra la bandera que lo habilita');
  }
  const con = armarPlan(['--base', 'https://hola-mako.com', '--rutas', '/dashboard', BANDERA_PRODUCCION], sinLeer);
  assert.ok(con.ok && con.plan.produccion, 'con la bandera explícita corre, marcado como producción');
  const local = armarPlan(['--base', 'http://localhost:3000', '--rutas', '/dashboard'], sinLeer);
  assert.ok(local.ok && !local.plan.produccion);
});

test('3. el plan: rutas del MISMO origen, topes duros, la concurrencia no pasa el total, y la cookie de archivo, flag o variable', () => {
  const base = ['--base', 'http://localhost:3000'];
  for (const ruta of ['https://otro.com/x', '//otro.com/x', 'dashboard', '/.//otro.com/x']) {
    const r = armarPlan([...base, '--rutas', ruta], sinLeer);
    assert.equal(r.ok, false, `«${ruta}» no puede salir de localhost`);
  }
  assert.equal(armarPlan([...base, '--rutas', '/a', '--concurrencia', String(TOPE_CONCURRENCIA + 1)], sinLeer).ok, false);
  assert.equal(armarPlan([...base, '--rutas', '/a,/b', '--pedidos', String(TOPE_PEDIDOS / 2 + 1)], sinLeer).ok, false, 'el tope es del TOTAL');
  assert.equal(armarPlan([...base, '--rutas', '/a', '--pedidos', '0'], sinLeer).ok, false);
  assert.equal(armarPlan(['--rutas', '/a'], sinLeer).ok, false, 'sin --base no corre');
  assert.equal(armarPlan(base, sinLeer).ok, false, 'sin --rutas no corre');
  const r = armarPlan([...base, '--rutas', '/dashboard?ws=3, /plan', '--pedidos=3', '--concurrencia', '10'], sinLeer);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(r.plan.rutas.map((x) => x.url), ['http://localhost:3000/dashboard?ws=3', 'http://localhost:3000/plan']);
  assert.equal(r.plan.total, 6);
  assert.equal(r.plan.concurrencia, 6, 'nunca más trabajadores que pedidos');
  assert.equal(r.plan.cookie, null);
  const deArchivo = armarPlan([...base, '--rutas', '/a', '--cookie-archivo', '/x/cookie.txt'], { env: {}, leer: (p) => { assert.equal(p, '/x/cookie.txt'); return `Cookie: ${COOKIE}\n`; } });
  assert.ok(deArchivo.ok && deArchivo.plan.cookie === COOKIE, 'se le saca el «Cookie:» pegado desde el navegador');
  const deVariable = armarPlan([...base, '--rutas', '/a'], { env: { MAKO_CARGA_COOKIE: COOKIE }, leer: sinLeer.leer });
  assert.ok(deVariable.ok && deVariable.plan.cookie === COOKIE);
  assert.deepEqual(ordenDePedidos(r.plan).map((p) => `${p.ruta}#${p.i}`), ['/dashboard?ws=3#0', '/plan#0', '/dashboard?ws=3#1', '/plan#1', '/dashboard?ws=3#2', '/plan#2'],
    'las rutas se ALTERNAN: cada una recibe carga mezclada con las otras');
});

test('4. lo que dice ANTES de pedir: cuántos en total, por ruta y de a cuántos, a dónde, y NUNCA la cookie', () => {
  const r = armarPlan(['--base', 'http://localhost:3000', '--rutas', '/dashboard,/plan', '--pedidos', '40', '--concurrencia', '4', '--cookie', COOKIE], sinLeer);
  assert.ok(r.ok);
  if (!r.ok) return;
  const t = textoDelPlan(r.plan);
  assert.match(t, /Voy a pedir 80 veces a http:\/\/localhost:3000: 40 por ruta × 2 ruta\(s\), de a 4 a la vez, con un tope de 30 s/);
  assert.match(t, /Rutas: \/dashboard, \/plan/);
  assert.ok(!t.includes('secreto-de-prueba'), 'la cookie no se imprime');
  assert.match(t, new RegExp(`\\(${COOKIE.length} caracteres; no se imprime\\)`));
  assert.match(t, /localhost también lee la base de producción/, 'en local también avisa a qué base pega');
  const sin = armarPlan(['--base', 'http://localhost:3000', '--rutas', '/a'], sinLeer);
  assert.ok(sin.ok && /SIN cookie: .*307 a \/login/.test(textoDelPlan(sin.plan)));
});

test('5. clasificar y resumir: un 307 a /login es «sin-sesion» y NO entra a los tiempos; los demás errores se cuentan aparte', () => {
  assert.equal(clasificar({ status: 200 }), 'ok');
  assert.equal(clasificar({ status: 307, location: '/login?next=%2Fplan' }), 'sin-sesion');
  assert.equal(clasificar({ status: 307, location: 'http://localhost:3000/login' }), 'sin-sesion');
  assert.equal(clasificar({ status: 307, location: '/plan/agencia' }), 'redireccion');
  assert.equal(clasificar({ status: 404 }), 'http-4xx');
  assert.equal(clasificar({ status: 503 }), 'http-5xx');
  assert.equal(clasificar({ error: 'tope' }), 'tope');
  assert.equal(clasificar({ error: 'red' }), 'red');
  const filas = resumir([
    { ruta: '/a', tipo: 'ok', ms: 100, ttfbMs: 40, bytes: 2048 },
    { ruta: '/a', tipo: 'ok', ms: 300, ttfbMs: 60, bytes: 2048 },
    { ruta: '/a', tipo: 'sin-sesion', ms: 2, ttfbMs: 2, bytes: 0 },
    { ruta: '/a', tipo: 'tope', ms: null, ttfbMs: null, bytes: 0 },
  ]);
  assert.equal(filas.length, 1);
  const [f] = filas;
  assert.deepEqual([f.pedidos, f.ok, f.p50, f.max, f.min, f.ttfbP50, f.kbMedio], [4, 2, 100, 300, 100, 40, 2]);
  assert.deepEqual(f.errores, { 'sin-sesion': 1, tope: 1 });
  assert.match(tablaDeResumen(filas, 1500), /\/a \| 4 \| 2 \| 100 \| 300 \| 300 \| 300 \| 40 \| 2 \| sin-sesion: 1, tope: 1/);
});

// ── 6 y 7: LA CARGA DE VERDAD contra un servidor de mentira en 127.0.0.1 ─────────────────────────────────────────────────
let abiertos = 0;
let maxAbiertos = 0;
const vistos: { metodo: string; cookie: string | undefined; agente: string | undefined }[] = [];
const servidor = createServer((req: IncomingMessage, res: ServerResponse) => {
  vistos.push({ metodo: req.method ?? '', cookie: req.headers.cookie, agente: req.headers['user-agent'] });
  const fin = (codigo: number, cuerpo: string, extra: Record<string, string> = {}) => { res.writeHead(codigo, { 'content-type': 'text/html', ...extra }); res.end(cuerpo); };
  const ruta = (req.url ?? '').split('?')[0];
  if (ruta === '/rapida') setTimeout(() => fin(200, 'x'.repeat(4096)), 5);
  else if (ruta === '/lenta') {
    // Los abiertos a la vez se cuentan SÓLO acá: una de /cuelga que se cierra tarde no puede mover la cuenta del test 7.
    abiertos++;
    maxAbiertos = Math.max(maxAbiertos, abiertos);
    // El HTML llega en DOS partes, como un streaming: el tiempo total incluye la segunda.
    res.writeHead(200, { 'content-type': 'text/html' });
    res.write('<html>');
    setTimeout(() => { abiertos--; res.end('</html>'); }, 80);
  }
  else if (ruta === '/rota') fin(500, 'error');
  else if (ruta === '/sin-sesion') fin(307, '', { location: '/login?next=%2Fsin-sesion' });
  else if (ruta === '/cuelga') { /* no contesta nunca: lo corta el tope */ }
  else fin(404, 'no');
});
after(() => { servidor.closeAllConnections(); servidor.close(); });
async function base(): Promise<string> {
  if (!servidor.listening) await new Promise<void>((r) => servidor.listen(0, '127.0.0.1', () => r()));
  return `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
}

test('6. la carga de verdad: cuenta bien cada ruta, mide el HTML hasta el último byte, manda la cookie y sólo hace GET', { timeout: 20_000 }, async () => {
  vistos.length = 0;
  const r = armarPlan(['--base', await base(), '--rutas', '/rapida,/lenta,/rota,/sin-sesion,/cuelga', '--pedidos', '4', '--concurrencia', '5', '--tope-ms', '300', '--cookie', COOKIE], sinLeer);
  assert.ok(r.ok);
  if (!r.ok) return;
  const resultados = await correrCarga(r.plan);
  assert.equal(resultados.length, 20);
  const filas = Object.fromEntries(resumir(resultados).map((f) => [f.ruta, f]));
  assert.deepEqual([filas['/rapida'].ok, filas['/lenta'].ok, filas['/rota'].ok], [4, 4, 0]);
  assert.deepEqual(filas['/rota'].errores, { 'http-5xx': 4 });
  assert.deepEqual(filas['/sin-sesion'].errores, { 'sin-sesion': 4 }, 'no sigue la redirección: ve el 307');
  assert.deepEqual(filas['/cuelga'].errores, { tope: 4 });
  assert.ok(filas['/lenta'].p50! >= 70, `la lenta tarda ~80 ms en terminar el HTML (dio ${filas['/lenta'].p50}): se lee hasta el final`);
  assert.ok(filas['/lenta'].ttfbP50! < filas['/lenta'].p50!, 'el primer byte llega antes que el final');
  assert.ok(filas['/rapida'].p50! < filas['/lenta'].p50!);
  assert.equal(filas['/rapida'].kbMedio, 4);
  assert.ok(vistos.every((v) => v.metodo === 'GET'), 'sólo GET');
  assert.ok(vistos.every((v) => v.cookie === COOKIE), 'cada pedido lleva la cookie');
  assert.ok(vistos.every((v) => v.agente === 'MaKoPruebaDeCarga/1.0'), 'se identifica en los logs del server');
});

test('7. respeta la concurrencia: nunca más de N abiertos a la vez, y sí llega a N', { timeout: 20_000 }, async () => {
  abiertos = 0;
  maxAbiertos = 0;
  const r = armarPlan(['--base', await base(), '--rutas', '/lenta', '--pedidos', '12', '--concurrencia', '3'], sinLeer);
  assert.ok(r.ok);
  if (!r.ok) return;
  const t0 = Date.now();
  const resultados = await correrCarga(r.plan);
  assert.equal(resultados.filter((x) => x.tipo === 'ok').length, 12);
  assert.equal(maxAbiertos, 3, `abiertos a la vez: ${maxAbiertos}`);
  assert.ok(Date.now() - t0 >= 4 * 70, 'de a 3, 12 pedidos de ~80 ms son cuatro vueltas');
});

test('8. --seco desde la terminal: dice cuánto va a pedir y no pide nada', { timeout: 20_000 }, () => {
  // Un puerto donde no escucha nadie: si pidiera algo, lo diría con errores de red; con --seco sale 0 antes.
  const r = spawnSync(process.execPath, [join(REPO, 'scripts', 'prueba-de-carga.mjs'), '--base', 'http://127.0.0.1:9', '--rutas', '/dashboard', '--pedidos', '5', '--seco'],
    { encoding: 'utf8', timeout: 15_000, maxBuffer: 64 * 1024 * 1024 });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Voy a pedir 5 veces a http:\/\/127\.0\.0\.1:9/);
  assert.match(r.stdout, /--seco: no se pidió nada/);
});

test('9. desde la terminal, contra producción sin la bandera: se niega con 2 y no pide nada', { timeout: 20_000 }, () => {
  // ⚠️ CON `--seco`, siempre: si el rechazo se rompe, el script sale 0 imprimiendo el plan (y este test cae) SIN pedirle nada a
  //    producción. La primera versión usaba `--ya` y, rompiéndolo a propósito, le mandó 20 GET sin sesión a hola-mako.com.
  const r = spawnSync(process.execPath, [join(REPO, 'scripts', 'prueba-de-carga.mjs'), '--base', 'https://hola-mako.com', '--rutas', '/dashboard', '--seco'],
    { encoding: 'utf8', timeout: 15_000, maxBuffer: 64 * 1024 * 1024 });
  assert.equal(r.status, 2);
  assert.match(r.stderr, new RegExp(`hola-mako\\.com no es esta máquina: sin ${BANDERA_PRODUCCION}`));
  assert.ok(!r.stdout.includes('Voy a pedir'), 'ni siquiera arma el plan');
});
