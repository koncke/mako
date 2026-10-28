// =============================================================================
// MaKo sin conexión, T1 (28/10/2026): leer el CRM y el Plan sin conexión, cifrado por persona
// =============================================================================
// El diseño: docs/diseno-mako-desktop-sin-conexion.md. Lo que fija este archivo:
//   1. El cifrado: ida y vuelta; la clave equivocada no abre; la copia de una persona no abre con la de otra (ni con la
//      MISMA llave: el AAD lleva el email y el negocio).
//   2. activar / guardar / abrir (lib/sin-conexion/local.ts) con un almacén en memoria: la clave, el vencimiento (que se mira
//      DESPUÉS de la clave), «desconectada» borra todo, y una copia de otro formato no se abre.
//   3. La cinta: «Sin conexión · lo que ves es lo de las 10:42», en la zona del negocio.
//   4. La llave del servidor: la misma persona y computadora, la misma; otra, otra; sin secreto, ninguna.
//   5. public/sw.js corrido de verdad (vm): NUNCA guarda una respuesta del servidor; sin red, un 502/503/504 o pasado el
//      plazo, devuelve el cascarón con su motivo; la API y las páginas públicas no lo reciben; el teléfono no se toca.
//   6. El cascarón armado está al día con su fuente, no habla con el servidor y no usa innerHTML.
//   7. Las puertas: la copia no se arma mirando a otro; la llave sale de la persona; el layout la monta sólo en la
//      computadora; /sin-conexion es público y sólo se lee; el teléfono sigue con sus 40 tarjetas.
//   8. La verificación de 90d6410eb: las notas se leen PAGINADAS (PostgREST corta en 1000 sin avisar) y con `recortado`;
//      una renovación a medias no pisa la copia buena (`conLoDeAntes`: el CRM, el Plan, un funnel o las notas que no se
//      leyeron vuelven de la anterior, con su hora); la lista de funnels que falla se dice (`leerFunnels`, no `listarFunnels`).
//
// Probado rompiéndolo (base: todos pasan, 28/10/2026), restaurando por sha256. Las roturas y lo que cada una tumbó están en
// docs/hallazgos-sin-conexion.md («Probado rompiéndolo»).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { aBase64url, cifrarJson, descifrarJson, importarLlave, llaveDeLaClave, nombreDeBase } from '../lib/sin-conexion/cifra';
import { abrir, activar, guardarCopia, type PedirLlave } from '../lib/sin-conexion/local';
import type { Almacen } from '../lib/sin-conexion/almacen';
import {
  aadDeCopia, conLoDeAntes, deCuando, problemaDeClave, textoDeLaCinta, VERSION_COPIA, VUELTAS, type CopiaGuardada, type CopiaV1, type LlaveGuardada,
} from '../lib/sin-conexion/reglas';
import { filasDeNotas } from '../lib/sin-conexion/notas-copia';
import { esPublica, esPublicaSoloLeer } from '../lib/rutas-publicas';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// ── Las piezas de prueba ─────────────────────────────────────────────────────

function memoria(): Almacen & { llave: () => LlaveGuardada | null; copias: () => CopiaGuardada[]; meter: (c: CopiaGuardada) => void } {
  let llave: LlaveGuardada | null = null;
  const copias = new Map<number, CopiaGuardada>();
  return {
    leerLlave: async () => llave,
    guardarLlave: async (l) => { llave = l; },
    leerCopias: async () => [...copias.values()],
    guardarCopia: async (c) => { copias.set(c.ws, c); },
    // La cola de la T2 (tests/sin-conexion-cola.test.ts la prueba): acá vacía.
    leerCola: async () => [], guardarEnCola: async () => undefined, sacarDeCola: async () => undefined,
    borrar: async () => { llave = null; copias.clear(); },
    llave: () => llave,
    copias: () => [...copias.values()],
    meter: (c) => { copias.set(c.ws, c); },
  };
}

/** El servidor de mentira: una llave por (persona, computadora), como el de verdad. */
const servidor = (persona: string, extra: Partial<{ desconectada: boolean; misma: Uint8Array }> = {}): PedirLlave => async (dispositivo) => {
  if (extra.desconectada) return { ok: false, desconectada: true, error: 'Esta computadora fue desconectada.' };
  return { ok: true, llave: extra.misma ?? new Uint8Array(createHash('sha256').update(`${persona}|${dispositivo}`).digest()) };
};

const copiaDe = (ws: number, nombre = 'Inmobiliaria Prueba'): CopiaV1 => ({
  version: VERSION_COPIA, hecha: '2026-10-28T13:42:00.000Z', tz: 'America/Argentina/Buenos_Aires',
  negocio: { id: ws, nombre }, persona: { nombre: 'Ana' },
  crm: { tableros: [], notas: { 12: [{ texto: 'Llamar el jueves', cuando: '2026-10-27T15:00:00.000Z', autor: 'Ana' }] } },
  plan: null, faltan: [],
});

/** Rápido para los tests: el número de verdad lo fija su propio test. */
const V = 1_000;

// ── 1. El cifrado ────────────────────────────────────────────────────────────

test('1. cifrado: ida y vuelta; otra llave u otro AAD no abren; la DEK mide 32 bytes', async () => {
  const k = await importarLlave(new Uint8Array(32).fill(7));
  const c = await cifrarJson({ hola: 'mundo' }, k, aadDeCopia('ana@x.com', 3));
  assert.deepEqual(await descifrarJson(c, k, aadDeCopia('ANA@x.com ', 3)), { hola: 'mundo' }, 'el email se normaliza');
  await assert.rejects(descifrarJson(c, k, aadDeCopia('beto@x.com', 3)), 'otra persona con la MISMA llave no abre');
  await assert.rejects(descifrarJson(c, k, aadDeCopia('ana@x.com', 4)), 'otro negocio no abre');
  await assert.rejects(descifrarJson(c, await importarLlave(new Uint8Array(32).fill(8)), aadDeCopia('ana@x.com', 3)), 'otra llave no abre');
  await assert.rejects(importarLlave(new Uint8Array(16)));
  const kek1 = await llaveDeLaClave('clave-buena', new Uint8Array(16), V);
  const kek2 = await llaveDeLaClave('clave-mala!', new Uint8Array(16), V);
  const e = await cifrarJson('x', kek1, 'a');
  await assert.rejects(descifrarJson(e, kek2, 'a'), 'la clave equivocada no abre');
  assert.equal(VUELTAS, 600_000, 'PBKDF2-SHA256 con lo que recomienda OWASP');
  const n = await nombreDeBase('ana@x.com');
  assert.match(n, /^mako-sc-[0-9a-f]{32}$/);
  assert.ok(!n.includes('ana'), 'el nombre de la base no dice de quién es');
  assert.notEqual(n, await nombreDeBase('beto@x.com'));
});

// ── 2. activar, guardar, abrir ───────────────────────────────────────────────

test('2a. activar + guardar + abrir con la clave: vuelve la copia; con otra clave, nada', async () => {
  const m = memoria();
  assert.deepEqual(await activar({ email: 'ana@x.com', clave: 'mi-clave-9', repetida: 'mi-clave-9', almacen: m, pedirLlave: servidor('ana'), vueltas: V }), { ok: true });
  const l = m.llave()!;
  assert.match(l.dispositivo, /^[A-Za-z0-9_-]{22}$/);
  assert.ok(!JSON.stringify(l).includes('mi-clave-9'), 'la clave no se guarda');
  assert.equal(await guardarCopia({ email: 'ana@x.com', almacen: m, pedirLlave: servidor('ana'), pedirCopia: async () => copiaDe(9) }), 'guardada');
  assert.ok(!m.copias()[0].datos.includes('Inmobiliaria'), 'lo guardado va cifrado');
  const r = await abrir({ email: 'ana@x.com', clave: 'mi-clave-9', almacen: m });
  assert.ok(r.ok);
  assert.equal(r.copias.length, 1);
  assert.equal(r.copias[0].negocio.nombre, 'Inmobiliaria Prueba');
  assert.equal(r.copias[0].crm?.notas[12][0].texto, 'Llamar el jueves');
  assert.deepEqual(await abrir({ email: 'ana@x.com', clave: 'otra-clave', almacen: m }), { ok: false, motivo: 'clave' });
});

test('2b. una cuenta nunca ve lo de otra: ni con la clave de la otra, ni con la copia pasada, ni con la MISMA llave', async () => {
  const a = memoria();
  await activar({ email: 'ana@x.com', clave: 'clave-de-ana', repetida: 'clave-de-ana', almacen: a, pedirLlave: servidor('ana'), vueltas: V });
  await guardarCopia({ email: 'ana@x.com', almacen: a, pedirLlave: servidor('ana'), pedirCopia: async () => copiaDe(9) });
  // Beto en el MISMO almacén, con la clave de Ana: la llave envuelta lleva el email en el AAD.
  assert.deepEqual(await abrir({ email: 'beto@x.com', clave: 'clave-de-ana', almacen: a }), { ok: false, motivo: 'clave' });
  // La copia de Ana pasada al almacén de Beto, aunque el servidor les diera LA MISMA llave.
  const misma = new Uint8Array(32).fill(5);
  const a2 = memoria();
  await activar({ email: 'ana@x.com', clave: 'clave-de-ana', almacen: a2, pedirLlave: servidor('ana', { misma }), vueltas: V });
  await guardarCopia({ email: 'ana@x.com', almacen: a2, pedirLlave: servidor('ana', { misma }), pedirCopia: async () => copiaDe(9) });
  const b = memoria();
  await activar({ email: 'beto@x.com', clave: 'clave-de-beto', almacen: b, pedirLlave: servidor('beto', { misma }), vueltas: V });
  b.meter(a2.copias()[0]);
  const r = await abrir({ email: 'beto@x.com', clave: 'clave-de-beto', almacen: b });
  assert.ok(r.ok);
  assert.equal(r.copias.length, 0, 'la copia de Ana no abre como de Beto');
  assert.equal(r.viejas, 1);
});

test('2c. el vencimiento se mira DESPUÉS de la clave; «desconectada» borra; otro formato no se abre; la clave tiene reglas', async () => {
  const m = memoria();
  await activar({ email: 'ana@x.com', clave: 'clave-larga', almacen: m, pedirLlave: servidor('ana'), vueltas: V });
  await guardarCopia({ email: 'ana@x.com', almacen: m, pedirLlave: servidor('ana'), pedirCopia: async () => copiaDe(9) });
  const en40dias = Date.now() + 40 * 86_400_000;
  // Quien prueba un email ajeno con una clave cualquiera no se entera de que venció ni lo borra.
  assert.deepEqual(await abrir({ email: 'ana@x.com', clave: 'no-es-esta', almacen: m, ahora: en40dias }), { ok: false, motivo: 'clave' });
  assert.ok(m.llave(), 'con la clave equivocada no se borra nada');
  assert.deepEqual(await abrir({ email: 'ana@x.com', clave: 'clave-larga', almacen: m, ahora: en40dias }), { ok: false, motivo: 'vencida' });
  assert.equal(m.llave(), null, 'vencida se borra');

  const d = memoria();
  await activar({ email: 'ana@x.com', clave: 'clave-larga', almacen: d, pedirLlave: servidor('ana'), vueltas: V });
  assert.equal(await guardarCopia({ email: 'ana@x.com', almacen: d, pedirLlave: servidor('ana', { desconectada: true }), pedirCopia: async () => copiaDe(9) }), 'desconectada');
  assert.equal(d.llave(), null, 'una computadora desconectada borra lo guardado');
  assert.equal(await guardarCopia({ email: 'ana@x.com', almacen: memoria(), pedirLlave: servidor('ana'), pedirCopia: async () => copiaDe(9) }), 'sin-activar');

  const v = memoria();
  await activar({ email: 'ana@x.com', clave: 'clave-larga', almacen: v, pedirLlave: servidor('ana'), vueltas: V });
  await guardarCopia({ email: 'ana@x.com', almacen: v, pedirLlave: servidor('ana'), pedirCopia: async () => copiaDe(9) });
  v.meter({ ...v.copias()[0], ws: 10, version: 99 });
  const r = await abrir({ email: 'ana@x.com', clave: 'clave-larga', almacen: v });
  assert.ok(r.ok && r.copias.length === 1 && r.viejas === 1, 'la de otro formato se cuenta y no se abre');

  // Volver a elegir la clave conserva la computadora (la misma llave del servidor).
  const id = v.llave()!.dispositivo;
  await activar({ email: 'ana@x.com', clave: 'otra-clave-1', almacen: v, pedirLlave: servidor('ana'), vueltas: V });
  assert.equal(v.llave()!.dispositivo, id);
  assert.ok((await abrir({ email: 'ana@x.com', clave: 'otra-clave-1', almacen: v })).ok);

  assert.match(problemaDeClave('1234567') ?? '', /8 caracteres/);
  assert.match(problemaDeClave('aaaaaaaa') ?? '', /repetido/);
  assert.match(problemaDeClave('12345678') ?? '', /escalera/);
  // Las que se prueban primero (verificación de 90d6410eb: pasaban 123123, qwerty, password, mako123, iloveyou…).
  for (const comun of ['password', 'Password1', 'qwertyuiop', '12121212', 'abcabcabc', 'iloveyou', 'makomako', 'contraseña']) {
    assert.match(problemaDeClave(comun) ?? '', /más usadas|repetido|escalera/, comun);
  }
  assert.match(problemaDeClave('clave-01', 'clave-02') ?? '', /no coinciden/);
  assert.equal(problemaDeClave('mi-casa-7', 'mi-casa-7'), null);
  assert.deepEqual(await activar({ email: 'a@x.com', clave: '123', almacen: memoria(), pedirLlave: servidor('a') }), { ok: false, error: problemaDeClave('123') });
});

test('2d. si el servidor da OTRA llave (se rotó su secreto), la copia no se guarda con ella: se pide la clave de nuevo', async () => {
  const m = memoria();
  await activar({ email: 'ana@x.com', clave: 'clave-larga', almacen: m, pedirLlave: servidor('ana'), vueltas: V });
  assert.match(m.llave()!.huella, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(await guardarCopia({ email: 'ana@x.com', almacen: m, pedirLlave: servidor('ana', { misma: new Uint8Array(32).fill(9) }), pedirCopia: async () => copiaDe(9) }), 'otra-llave');
  assert.equal(m.copias().length, 0, 'una copia que la clave no abriría no se guarda');
  // Elegir la clave de nuevo envuelve la llave de HOY: vuelve a guardar y a abrir.
  const hoy = servidor('ana', { misma: new Uint8Array(32).fill(9) });
  await activar({ email: 'ana@x.com', clave: 'clave-nueva', almacen: m, pedirLlave: hoy, vueltas: V });
  assert.equal(await guardarCopia({ email: 'ana@x.com', almacen: m, pedirLlave: hoy, pedirCopia: async () => copiaDe(9) }), 'guardada');
  const r = await abrir({ email: 'ana@x.com', clave: 'clave-nueva', almacen: m });
  assert.ok(r.ok && r.copias.length === 1);
});

test('2e. el mismo email en OTRO negocio no abre la copia de éste (el AAD lleva el negocio)', async () => {
  const m = memoria();
  await activar({ email: 'ana@x.com', clave: 'clave-larga', almacen: m, pedirLlave: servidor('ana'), vueltas: V });
  await guardarCopia({ email: 'ana@x.com', almacen: m, pedirLlave: servidor('ana'), pedirCopia: async () => copiaDe(9) });
  const de9 = m.copias()[0];
  m.meter({ ...de9, ws: 10 });
  const r = await abrir({ email: 'ana@x.com', clave: 'clave-larga', almacen: m });
  assert.ok(r.ok);
  assert.deepEqual(r.copias.map((c) => c.negocio.id), [9], 'la del negocio 9 pasada al 10 no abre como del 10');
  assert.equal(r.viejas, 1);
});

test('2f. nada de lo guardado tiene la llave ni la clave en claro: sin la clave, lo local es ilegible', async () => {
  const llave = new Uint8Array(32).map((_, i) => (i * 37 + 11) % 256);
  const m = memoria();
  await activar({ email: 'ana@x.com', clave: 'mi-clave-secreta', almacen: m, pedirLlave: servidor('ana', { misma: llave }), vueltas: V });
  await guardarCopia({ email: 'ana@x.com', almacen: m, pedirLlave: servidor('ana', { misma: llave }), pedirCopia: async () => copiaDe(9) });
  const todo = JSON.stringify({ llave: m.llave(), copias: m.copias() });
  const b64 = aBase64url(llave);
  assert.ok(!todo.includes(b64), 'la llave no se guarda en claro');
  assert.ok(!todo.includes(Buffer.from(llave).toString('hex')));
  assert.ok(!todo.includes('mi-clave-secreta'), 'la clave no se guarda');
  assert.ok(!/Inmobiliaria|Llamar el jueves|Ana/.test(todo), 'ningún dato del negocio en claro');
});

// ── 3. La cinta ──────────────────────────────────────────────────────────────

test('3. la cinta dice la hora de la copia en la zona del negocio', () => {
  const tz = 'America/Argentina/Buenos_Aires';
  const hecha = '2026-10-28T13:42:00.000Z'; // 10:42 en Buenos Aires
  assert.equal(textoDeLaCinta({ motivo: 'sin-red', hecha, tz, ahora: Date.parse('2026-10-28T18:00:00Z') }), 'Sin conexión · lo que ves es lo de las 10:42');
  assert.equal(textoDeLaCinta({ motivo: 'no-responde', hecha, tz, ahora: Date.parse('2026-10-29T12:00:00Z') }), 'MaKo no responde · lo que ves es lo de ayer a las 10:42');
  assert.equal(deCuando(hecha, tz, Date.parse('2026-10-31T12:00:00Z')), 'lo del 28/10 a las 10:42');
  // 02:30 UTC del 29 todavía es el 28 en Buenos Aires: «hoy» es el día de ALLÁ.
  assert.equal(deCuando(hecha, tz, Date.parse('2026-10-29T02:30:00Z')), 'lo de las 10:42');
  assert.equal(deCuando('no-es-fecha', tz), 'lo de la última vez que hubo conexión');
});

// ── 4. La llave del servidor ─────────────────────────────────────────────────

test('4. la llave del servidor: misma persona y computadora = misma; otra = otra; sin secreto o con id malo, ninguna', () => {
  const d1 = aBase64url(new Uint8Array(16).fill(1));
  const d2 = aBase64url(new Uint8Array(16).fill(2));
  const r = JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_sin-conexion-hijo.ts'), JSON.stringify([
    { usuario: 5, dispositivo: d1 }, { usuario: 5, dispositivo: d1 }, { usuario: 6, dispositivo: d1 }, { usuario: 5, dispositivo: d2 },
    { usuario: 5, dispositivo: d1, secreto: null }, { usuario: 5, dispositivo: 'corto' }, { usuario: 0, dispositivo: d1 },
    { usuario: 5, dispositivo: d1, secreto: 'otro-secreto' },
  ])], { cwd: RAIZ, encoding: 'utf8', timeout: 90_000, env: { ...process.env, CREDENCIALES_SECRET: '' } })) as Array<string | null>;
  assert.match(r[0] ?? '', /^[A-Za-z0-9_-]{43}$/, '32 bytes');
  assert.equal(r[0], r[1]);
  assert.notEqual(r[0], r[2], 'otra persona, otra llave');
  assert.notEqual(r[0], r[3], 'otra computadora, otra llave');
  assert.equal(r[4], null, 'sin el secreto no se inventa una llave');
  assert.equal(r[5], null);
  assert.equal(r[6], null);
  assert.notEqual(r[0], r[7], 'otro secreto, otra llave');
});

// ── 5. El service worker, corrido ────────────────────────────────────────────

const ESCRITORIO = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const ORIGEN = 'https://hola-mako.com';
const HTML_CASCARON = leer('public/sin-conexion/index.html');

type Red = (url: string, init?: { credentials?: string }) => Promise<Response> | Response;

/** `almacenes`: el Cache Storage, que SOBREVIVE a que el navegador apague el service worker (se pasa el de antes). */
function cargarSw(p: { ua?: string; enLinea?: boolean; red: Red; almacenes?: Map<string, Map<string, Response>> }) {
  const handlers: Record<string, (ev: Record<string, unknown>) => void> = {};
  const guardadas: string[] = [];
  const pedidos: Array<{ url: string; credentials?: string }> = [];
  const almacenes = p.almacenes ?? new Map<string, Map<string, Response>>();
  const abrirCache = (n: string) => {
    if (!almacenes.has(n)) almacenes.set(n, new Map());
    const m = almacenes.get(n)!;
    return {
      put: async (u: string, r: Response) => { guardadas.push(String(u)); m.set(String(u), r); },
      match: async (u: string) => m.get(String(u))?.clone(),
    };
  };
  const caches = {
    open: async (n: string) => abrirCache(n),
    has: async (n: string) => almacenes.has(n),
    keys: async () => [...almacenes.keys()],
    delete: async (n: string) => almacenes.delete(n),
    match: async (u: string, op?: { cacheName?: string }) => almacenes.get(op?.cacheName ?? '')?.get(String(u))?.clone(),
  };
  const fetch = async (input: string | { url: string }, init?: { credentials?: string }) => {
    const url = new URL(typeof input === 'string' ? input : input.url, ORIGEN).href;
    pedidos.push({ url, credentials: init?.credentials });
    return p.red(url, init);
  };
  const self = {
    addEventListener: (t: string, f: (ev: Record<string, unknown>) => void) => { handlers[t] = f; },
    skipWaiting: () => undefined,
    registration: { navigationPreload: { enable: async () => undefined }, showNotification: async () => undefined },
    clients: { claim: async () => undefined, matchAll: async () => [] },
    navigator: { userAgent: p.ua ?? ESCRITORIO, onLine: p.enLinea ?? true },
    location: { origin: ORIGEN },
  };
  // El plazo de 15 s se acorta: el test no espera de verdad.
  const ctx = vm.createContext({ self, caches, fetch, Response, URL, Promise, Error, Date, console,
    setTimeout: (f: () => void, ms: number) => setTimeout(f, ms >= 15_000 ? 30 : ms), clearTimeout });
  vm.runInContext(leer('public/sw.js'), ctx);
  async function evento(tipo: string, ev: Record<string, unknown> = {}): Promise<Response | undefined | 'sin-respuesta'> {
    const esperas: Promise<unknown>[] = [];
    let resp: Promise<Response> | undefined;
    handlers[tipo]({ ...ev, waitUntil: (x: Promise<unknown>) => { esperas.push(x); }, respondWith: (x: Promise<Response>) => { resp = x; } });
    const r = resp ? await resp : 'sin-respuesta' as const;
    await Promise.all(esperas);
    return r;
  }
  const navegar = (ruta: string, extra: Record<string, unknown> = {}) => evento('fetch', {
    request: { method: 'GET', url: ORIGEN + ruta, mode: 'navigate', ...extra }, preloadResponse: Promise.resolve(undefined),
  });
  return { handlers, guardadas, pedidos, almacenes, evento, navegar };
}

/** La red de verdad del cascarón (para el install) y lo que se le pida a cada página. */
const conCascaron = (pagina: (url: string) => Promise<Response> | Response): Red => (url, init) => {
  const ruta = new URL(url).pathname;
  if (ruta === '/sin-conexion/index.html') return new Response(HTML_CASCARON, { status: 200 });
  if (ruta.startsWith('/sin-conexion/') || ruta === '/icon-192.png') return new Response('x', { status: 200 });
  return pagina(url);
};
const ARCHIVOS = ['/sin-conexion/index.html', '/sin-conexion/app.js', '/sin-conexion/estilos.css', '/icon-192.png'];
/** La hora de la última renovación, al lado de la lista (un número: no es un dato de nadie). */
const MARCA = '/sin-conexion/.renovado';

test('5a. sw.js: el install guarda SÓLO la lista fija, sin cookies; con red, la página pasa tal cual y no se guarda', async () => {
  const sw = cargarSw({ red: conCascaron(() => new Response('<html>CRM de Ana</html>', { status: 200 })) });
  await sw.evento('install');
  assert.deepEqual([...sw.guardadas].sort(), [...ARCHIVOS, MARCA].sort());
  assert.ok(sw.pedidos.every((x) => x.credentials === 'omit'), 'el cascarón se pide SIN cookies');
  const r = await sw.navegar('/crm');
  assert.ok(r instanceof Response);
  assert.equal(await r.text(), '<html>CRM de Ana</html>');
  await sw.navegar('/plan');
  await sw.navegar('/crm/12');
  assert.ok(sw.guardadas.every((u) => ARCHIVOS.includes(u) || u === MARCA), `se guardó algo que no es del cascarón: ${sw.guardadas.join(', ')}`);
});

test('5a2. sw.js: el navegador apaga el service worker y lo vuelve a arrancar: el cascarón NO se baja de nuevo (30 min)', async () => {
  const red = conCascaron(() => new Response('<html>CRM</html>', { status: 200 }));
  const primero = cargarSw({ red });
  await primero.evento('install');
  // Arranca de nuevo, con el MISMO Cache Storage (sobrevive) y la variable en 0: cinco cargas, cero pedidos del cascarón.
  for (let i = 0; i < 5; i++) {
    const otra = cargarSw({ red, almacenes: primero.almacenes });
    await otra.navegar('/crm');
    assert.deepEqual(otra.pedidos.map((x) => new URL(x.url).pathname), ['/crm'], `arranque ${i + 1}: sólo la página`);
  }
  // Pasados los 30 min, sí se renueva.
  const marca = primero.almacenes.get([...primero.almacenes.keys()][0])!;
  marca.set(MARCA, new Response(String(Date.now() - 31 * 60_000)));
  const tarde = cargarSw({ red, almacenes: primero.almacenes });
  await tarde.navegar('/crm');
  assert.equal(tarde.pedidos.length, 1 + ARCHIVOS.length);
  // «Borrar lo guardado» saca el caché: ya no se renueva nada.
  const borrado = cargarSw({ red, almacenes: new Map() });
  await borrado.navegar('/crm');
  assert.deepEqual(borrado.pedidos.map((x) => new URL(x.url).pathname), ['/crm']);
  assert.match(sinComentarios(leer('lib/sin-conexion/en-la-app.ts')), /if \(n\.startsWith\(CACHES_CASCARON\)\) await caches\.delete\(n\);/);
  // «Probar» (la página abierta a mano) usa la precarga: no sale dos veces.
  const probar = cargarSw({ red, almacenes: primero.almacenes });
  const r = await probar.evento('fetch', {
    request: { method: 'GET', url: ORIGEN + '/sin-conexion/index.html', mode: 'navigate' },
    preloadResponse: Promise.resolve(new Response(HTML_CASCARON, { status: 200 })),
  });
  assert.ok(r instanceof Response);
  assert.deepEqual(probar.pedidos, [], 'con la precarga, ningún pedido más');
});

// Con plazo: un service worker sin su propio plazo deja la navegación colgada para siempre, y eso tiene que FALLAR, no colgar.
test('5b. sw.js: sin red → el cascarón «sin-red»; 502/503/504 o pasado el plazo → «no-responde»; un 500 pasa', { timeout: 15_000 }, async () => {
  let modo: 'caida' | '503' | '500' | 'lenta' = 'caida';
  const red = conCascaron(() => {
    if (modo === 'caida') throw new TypeError('Failed to fetch');
    if (modo === 'lenta') return new Promise<Response>(() => undefined);
    return new Response('error del servidor', { status: modo === '503' ? 503 : 500 });
  });
  const sinRed = cargarSw({ red, enLinea: false });
  await sinRed.evento('install');
  const r1 = await sinRed.navegar('/crm') as Response;
  const html1 = await r1.text();
  assert.match(html1, /<meta name="mako-motivo" content="sin-red">/);
  assert.match(r1.headers.get('content-security-policy') ?? '', /script-src 'self'/);
  assert.equal(r1.headers.get('cache-control'), 'no-store');
  assert.ok(!/CRM de|Ana/.test(html1), 'el cascarón no trae datos de nadie');

  const caido = cargarSw({ red });
  await caido.evento('install');
  modo = '503';
  assert.match(await ((await caido.navegar('/plan')) as Response).text(), /content="no-responde"/);
  modo = '500';
  const r500 = await caido.navegar('/plan') as Response;
  assert.equal(r500.status, 500, 'un 500 es un error de la página, no un MaKo caído');
  modo = 'lenta';
  assert.match(await ((await caido.navegar('/crm')) as Response).text(), /content="no-responde"/, 'pasado el plazo');
  modo = 'caida';
  assert.match(await ((await caido.navegar('/crm')) as Response).text(), /content="no-responde"/, 'con red pero sin MaKo');

  // Sin cascarón guardado (el install falló): el error del navegador, no una página inventada.
  const vacio = cargarSw({ red: () => { throw new TypeError('Failed to fetch'); } });
  const rv = await vacio.navegar('/crm') as Response;
  assert.equal(rv.type, 'error');
});

test('5c. sw.js: la API y las páginas públicas no reciben el cascarón; el teléfono no se toca; un POST tampoco', async () => {
  const red = conCascaron(() => { throw new TypeError('Failed to fetch'); });
  const sw = cargarSw({ red, enLinea: false });
  await sw.evento('install');
  for (const ruta of ['/api/ia-pc/descargar?os=windows', '/l/mi-landing', '/compartido/abc', '/r/CODIGO']) {
    await assert.rejects(sw.navegar(ruta) as Promise<unknown>, `${ruta} recibió el cascarón`);
  }
  assert.equal(await sw.evento('fetch', { request: { method: 'GET', url: ORIGEN + '/api/leads', mode: 'cors' } }), 'sin-respuesta', 'un fetch de datos no se toca');
  assert.equal(await sw.evento('fetch', { request: { method: 'POST', url: ORIGEN + '/crm', mode: 'navigate' } }), 'sin-respuesta');
  assert.equal(await sw.evento('fetch', { request: { method: 'GET', url: 'https://otra.com/x', mode: 'navigate' } }), 'sin-respuesta');

  const tel = cargarSw({ ua: ANDROID, red, enLinea: false });
  await tel.evento('install');
  assert.deepEqual(tel.guardadas, [], 'el teléfono no guarda el cascarón (T3)');
  // Ni siquiera ESCUCHA los pedidos: con la escucha puesta, el navegador lo despierta en cada uno aunque no conteste
  // (verificación de 90d6410eb). Antes este test sólo miraba que no contestara.
  assert.equal(tel.handlers.fetch, undefined, 'el teléfono sigue sin tocar ningún pedido');
  assert.equal(cargarSw({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148', red }).handlers.fetch, undefined);
  assert.ok(tel.handlers.push, 'los avisos siguen');
});

test('5d. sw.js: lo único que se escribe en un caché es la lista fija (y la hora de bajarla), desde guardarCascaron', () => {
  const src = sinComentarios(leer('public/sw.js'));
  const puts = [...src.matchAll(/\.put\(/g)];
  assert.equal(puts.length, 2, 'la lista y la hora de la renovación');
  const i = src.indexOf('async function guardarCascaron');
  const fin = src.indexOf('\n}\n', i);
  assert.ok(puts.every((x) => x.index! > i && x.index! < fin), 'los dos put están dentro de guardarCascaron');
  assert.match(src.slice(i, fin), /cache\.put\(MARCA_RENOVADO, new Response\(String\(ultimaRenovacion\)\)\)/, 'la marca es un número');
  assert.match(src.slice(i, fin), /ARCHIVOS_CASCARON\.map/);
  assert.match(src.slice(i, fin), /credentials: 'omit'/);
  assert.match(src.slice(i, fin), /!r\.redirected/, 'un login redirigido no se guarda');
  assert.doesNotMatch(src, /caches\.open\([^)]*\)\.then\([^)]*put/);
});

// ── 6. El cascarón ───────────────────────────────────────────────────────────

test('6. el cascarón armado está al día, no habla con el servidor y nunca usa innerHTML', async () => {
  const { armar } = await import('../scripts/sin-conexion/armar.mjs');
  assert.equal(leer('public/sin-conexion/app.js'), await armar(), 'public/sin-conexion/app.js quedó viejo: node scripts/sin-conexion/armar.mjs');
  const js = leer('public/sin-conexion/app.js');
  assert.doesNotMatch(js, /\bfetch\(/, 'el cascarón no le pide nada al servidor: anda sin red');
  assert.doesNotMatch(js, /innerHTML|insertAdjacentHTML|outerHTML/, 'los datos van como texto, nunca como HTML');
  assert.doesNotMatch(js, /server-only|getTenantDb|supabase/i);
  const fuente = sinComentarios(leer('lib/sin-conexion/cascaron.ts'));
  assert.doesNotMatch(fuente, /innerHTML/);
  const html = leer('public/sin-conexion/index.html');
  assert.match(html, /<meta name="mako-motivo" content="">/, 'el service worker reemplaza esta línea EXACTA');
  assert.doesNotMatch(html.replace(/<script src="[^"]+" defer><\/script>/, ''), /<script/, 'sin scripts en línea');
});

test('6b. lo descifrado vive sólo en la pantalla: arranca pidiendo la clave y vuelve a pedirla al salir, al volver o sin uso', () => {
  const src = sinComentarios(leer('lib/sin-conexion/cascaron.ts'));
  // El único estado del módulo es el reloj; ni el cascarón ni la lógica guardan la llave o las copias entre llamadas.
  assert.deepEqual([...src.matchAll(/^let (\w+)/gm)].map((m) => m[1]), ['relojInactividad']);
  for (const f of ['lib/sin-conexion/local.ts', 'lib/sin-conexion/en-la-app.ts', 'lib/sin-conexion/cifra.ts', 'lib/sin-conexion/almacen.ts']) {
    assert.doesNotMatch(sinComentarios(leer(f)), /^(let|var) /m, `${f} guarda estado en el módulo`);
  }
  assert.doesNotMatch(src, /localStorage|sessionStorage/, 'el cascarón no escribe nada en claro');
  const arranque = src.slice(src.indexOf('export function arrancar'));
  assert.match(arranque, /addEventListener\('pagehide', \(\) => bloquear\(\)\)/);
  assert.match(arranque, /addEventListener\('pageshow', \(ev\) => \{ if \(\(ev as PageTransitionEvent\)\.persisted\) bloquear\(\); \}\)/);
  assert.match(arranque, /pantallaEntrar\(\);\s*\}\s*$/, 'arranca SIEMPRE en la pantalla de la clave');
  assert.match(src, /'Salir'/);
  assert.match(src, /onclick: \(\) => bloquear\(\) \}, 'Salir'/);
  assert.match(src, /setTimeout\(\(\) => bloquear\('Se cerró por inactividad/);
  const negocio = src.slice(src.indexOf('function pantallaNegocio'), src.indexOf('// ── CRM'));
  assert.match(negocio, /armarReloj\(\);/, 'abrir lo guardado arma el reloj de la inactividad');
  assert.equal((leer('lib/sin-conexion/reglas.ts').match(/BLOQUEO_INACTIVO_MS = (\d+) \* 60_000/) ?? [])[1], '15');
  // La T1 no escribe nada: lo que tiene consecuencias no puede salir solo (escribir y «Espera tu OK» son la T2).
  assert.doesNotMatch(leer('public/sin-conexion/app.js'), /\bfetch\(|XMLHttpRequest|sendBeacon|navigator\.serviceWorker/);
});

// ── 7. Las puertas ───────────────────────────────────────────────────────────

test('7. la copia no se arma mirando a otro; la llave es de la persona; el layout, sólo en la computadora; /sin-conexion es público', () => {
  const copia = sinComentarios(leer('app/api/sin-conexion/copia/route.ts'));
  const get = copia.slice(copia.indexOf('export async function GET'));
  assert.ok(get.indexOf('getUsuarioActual()') < get.indexOf('estaImpersonando()'), 'primero la sesión');
  assert.ok(get.indexOf('estaImpersonando()') < get.indexOf('armarCopia('), 'mirando a otro, no hay copia');
  assert.match(copia, /no-store/);

  const llave = sinComentarios(leer('app/api/sin-conexion/llave/route.ts'));
  assert.match(llave, /usuarioPropio\(\)/, 'la llave es de la persona frente al teclado, no del negocio que mira');
  assert.match(llave, /llaveDeLaComputadora\(u\.id, dispositivo\)/);
  assert.doesNotMatch(llave, /getWorkspaceActual|getTenantDb/);
  assert.match(llave, /no-store/);

  const layout = leer('app/layout.tsx');
  assert.match(layout, /\{sesion\?\.email && !telefono && !vista && <CopiaSinConexion email=\{sesion\.email\} \/>\}/);

  assert.equal(esPublica('/sin-conexion/index.html'), true);
  assert.equal(esPublicaSoloLeer('/sin-conexion/index.html'), true);
  assert.equal(esPublica('/sin-conexionx'), false);
  const cfg = leer('next.config.ts');
  const b = cfg.slice(cfg.indexOf("source: '/sin-conexion/:path*'"));
  assert.match(b.slice(0, 600), /script-src 'self'/);

  // La copia: TODO el tablero con su contacto, y las notas SÓLO de los leads que están en él (lo que la persona ya ve).
  const armar = sinComentarios(leer('app/api/sin-conexion/copia/armar.ts'));
  assert.match(armar, /tableroCrm\(id, \{ tope: TOPE_COLUMNA_COPIA, conContacto: true \}\)/);
  assert.match(armar, /if \(!leads\.has\(id\) \|\| !texto\) continue;/, 'una nota de un lead que no está en sus tableros no viaja');
  assert.match(armar, /faltan\.push\('el CRM'\)/);
  assert.match(armar, /faltan\.push\('el Plan'\)/);
  // El historial, con el cliente del negocio de la sesión (lib/sin-conexion/notas-copia.ts lo pagina: 8a).
  assert.match(armar, /filasDeNotas\(await getTenantDb\(\), /, 'el historial, del negocio de la sesión');

  // La app: sin activar no registra nada ni pide nada; la fila de Perfil no se ofrece mirando a otro.
  const copiaApp = sinComentarios(leer('app/_components/CopiaSinConexion.tsx'));
  assert.ok(copiaApp.indexOf('await estaActivado(email)') < copiaApp.indexOf('await registrarServiceWorker()'), 'sin activar, ni el service worker');
  assert.match(copiaApp, /navigator\.locks\.request\('mako-sin-conexion', \{ ifAvailable: true \}/, 'varias pestañas guardan una vez');
  // No pinta nada propio: sólo el panel de lo escrito sin conexión (T2), y sólo activado en este navegador.
  assert.match(copiaApp, /return activado \? <SubirCambios email=\{email\} \/> : null;\s*\}\s*$/);
  const fila = sinComentarios(leer('app/perfil/instalar/SinConexion.tsx'));
  assert.match(fila, /\{abierto && !noDisponible && \(/, 'mirando a otro no hay formulario');
  assert.match(fila, /autoComplete="new-password"/);
  assert.match(fila, /window\.dispatchEvent\(new Event\(EVENTO_ACTIVADO\)\)/);
  assert.match(sinComentarios(leer('app/perfil/instalar/page.tsx')), /deOtro \? 'No se puede mientras miras la cuenta de otro\.' : null/);

  // El teléfono no cambia: sin `op`, las 40 tarjetas por columna y sin contacto.
  const datos = sinComentarios(leer('app/m/crm/datos.ts'));
  assert.match(datos, /cs\.slice\(0, op\.tope \?\? TOPE_COLUMNA\)/);
  assert.match(datos, /\.\.\.\(op\.conContacto \? \{/);
  assert.match(sinComentarios(leer('app/m/crm/page.tsx')), /tableroCrm\(Number\.isInteger\(pedido\) && pedido > 0 \? pedido : null\)/);
});

// ── 8. La verificación de 90d6410eb ──────────────────────────────────────────

/** Un PostgREST de mentira sobre `lead_audit`: filtra, ordena y CORTA en 1000 filas por pedido, como el de verdad. */
function postgrest(filas: Array<{ id: number; lead_id: number; campo: string; valor_nuevo: string; autor: string; created_at: string }>, techo = 1000) {
  let pedidos = 0;
  const db = {
    from: () => ({
      select: () => {
        const filtros: Array<(f: (typeof filas)[number]) => boolean> = [];
        const orden: Array<{ col: string; asc: boolean }> = [];
        const q = {
          eq: (c: string, v: unknown) => { filtros.push((f) => (f as Record<string, unknown>)[c] === v); return q; },
          in: (c: string, vs: unknown[]) => { filtros.push((f) => vs.includes((f as Record<string, unknown>)[c])); return q; },
          order: (col: string, o: { ascending: boolean }) => { orden.push({ col, asc: o.ascending }); return q; },
          range: async (desde: number, hasta: number) => {
            pedidos++;
            const todas = filas.filter((f) => filtros.every((fn) => fn(f))).sort((a, b) => {
              for (const o of orden) {
                const x = (a as Record<string, unknown>)[o.col] as string | number;
                const y = (b as Record<string, unknown>)[o.col] as string | number;
                if (x !== y) return (x < y ? -1 : 1) * (o.asc ? 1 : -1);
              }
              return 0;
            });
            return { data: todas.slice(desde, Math.min(hasta + 1, desde + techo)), error: null };
          },
        };
        return q;
      },
    }),
  };
  return { db: db as never, pedidos: () => pedidos };
}

test('8a. las notas de la copia se leen ENTERAS: el lead con notas viejas las trae aunque el negocio tenga miles más nuevas', async () => {
  const filas = [
    { id: 1, lead_id: 1, campo: 'Nota', valor_nuevo: 'La vieja de Lead 1', autor: 'ana@x.com', created_at: '2026-01-01T10:00:00.000Z' },
    ...Array.from({ length: 2500 }, (_, i) => ({ id: 10 + i, lead_id: 2 + (i % 3), campo: 'Nota', valor_nuevo: `n${i}`, autor: 'ana@x.com', created_at: `2026-10-${String(1 + (i % 27)).padStart(2, '0')}T10:00:00.000Z` })),
    { id: 9999, lead_id: 1, campo: 'Etapa', valor_nuevo: 'no es nota', autor: 'CRM', created_at: '2026-10-28T10:00:00.000Z' },
  ];
  const pg = postgrest(filas);
  const r = await filasDeNotas(pg.db, [1, 2, 3, 4]);
  assert.equal(r.recortado, false);
  assert.equal(r.filas.length, 2501, 'todas las notas, en más de un pedido de 1000');
  assert.ok(r.filas.some((f) => f.valor_nuevo === 'La vieja de Lead 1'), 'la nota vieja del lead 1 viaja');
  assert.ok(pg.pedidos() >= 3, `paginó (${pg.pedidos()} pedidos)`);
  assert.ok(!r.filas.some((f) => f.valor_nuevo === 'no es nota'), 'sólo el campo Nota');
  // De cada lead, las más nuevas primero (así se toman las últimas 5).
  const deDos = r.filas.filter((f) => Number(f.lead_id) === 2).map((f) => f.created_at);
  assert.deepEqual(deDos, [...deDos].sort().reverse());
  // Con el tope, se corta y se DICE.
  const corto = await filasDeNotas(postgrest(filas).db, [1, 2, 3, 4], 1200);
  assert.equal(corto.recortado, true);
  // Y el cascarón lo dice en la ficha.
  assert.match(leer('lib/sin-conexion/cascaron.ts'), /copia\.crm\?\.notasRecortadas \? 'Sin notas en la copia \(guarda las más nuevas del negocio\)\.'/);
});

test('8b. una renovación a medias no pisa lo bueno: lo que no se leyó vuelve de la anterior, con SU hora, y deja de «faltar»', () => {
  const tab = (funnelId: number | null, ids: number[]) => ({
    funnelId, funnels: [{ id: null, nombre: 'Principal' }, { id: 7, nombre: 'Reactivación' }],
    columnas: [], tarjetas: ids.map((id) => ({ id })), proximo: null, campos: [],
  }) as never;
  const vieja: CopiaV1 = {
    ...copiaDe(9), hecha: '2026-10-28T13:00:00.000Z',
    crm: { tableros: [tab(null, [1]), tab(7, [3])], notas: { 1: [{ texto: 'Nota buena', cuando: '2026-10-28T12:00:00.000Z', autor: 'Ana' }] } },
    plan: { fecha: '2026-10-28', prioridades: [], columnas: [], tareas: [], proyectos: [], recurrentes: [], recortado: false },
    deAntes: [{ que: 'el Plan', hecha: '2026-10-28T11:00:00.000Z' }],
  };
  const nueva: CopiaV1 = {
    ...copiaDe(9), hecha: '2026-10-28T13:10:00.000Z',
    crm: { tableros: [tab(null, [1, 2])], notas: {} }, plan: null,
    faltan: ['el CRM de «Reactivación»', 'las notas del CRM', 'el Plan'],
    huecos: { funnels: [7], notas: true },
  };
  const r = conLoDeAntes(nueva, vieja);
  assert.deepEqual(r.crm!.tableros.map((t) => [t.funnelId, t.tarjetas.length]), [[null, 2], [7, 1]], 'el principal es el NUEVO; el que falló, el de antes');
  assert.equal(r.crm!.notas[1][0].texto, 'Nota buena');
  assert.ok(r.plan, 'el Plan de antes');
  assert.deepEqual(r.faltan, [], 'lo cubierto ya no «falta»: se dice como «de antes»');
  assert.deepEqual(r.deAntes, [
    { que: 'el Plan', hecha: '2026-10-28T11:00:00.000Z' },
    { que: 'el CRM de «Reactivación»', hecha: '2026-10-28T13:00:00.000Z' },
    { que: 'las notas del CRM', hecha: '2026-10-28T13:00:00.000Z' },
  ], 'el Plan conserva la hora de cuando se leyó de verdad');
  // Sin anterior, o de otro negocio: la nueva tal cual (lo que falta, falta).
  assert.equal(conLoDeAntes(nueva, null), nueva);
  assert.equal(conLoDeAntes(nueva, { ...vieja, negocio: { id: 12, nombre: 'Otro' } }), nueva);
  // La lista de funnels que falla se DICE: `listarFunnels` nunca falla (devuelve [] y la copia guardaba sólo el principal).
  const armar = sinComentarios(leer('app/api/sin-conexion/copia/armar.ts'));
  assert.match(armar, /const funnels = await leerFunnels\(\)\.catch\(\(\) => null\);/);
  assert.doesNotMatch(armar, /listarFunnels/);
  assert.match(armar, /filasDeNotas\(await getTenantDb\(\), \[\.\.\.leads\]\)/);
  assert.match(armar, /if \(!n\) \{ faltan\.push\('las notas del CRM'\); huecos\.notas = true; \}/);
});

test('8c. de punta a punta: una copia buena y después una sin CRM; al abrir, el CRM bueno sigue y se dice de cuándo', async () => {
  const m = memoria();
  await activar({ email: 'ana@x.com', clave: 'clave-segura-1', almacen: m, pedirLlave: servidor('ana'), vueltas: V });
  const buena = { ...copiaDe(9), hecha: '2026-10-28T13:00:00.000Z' };
  assert.equal(await guardarCopia({ email: 'ana@x.com', almacen: m, pedirLlave: servidor('ana'), pedirCopia: async () => buena }), 'guardada');
  const rota: CopiaV1 = { ...copiaDe(9), hecha: '2026-10-28T13:10:00.000Z', crm: null, faltan: ['el CRM'] };
  assert.equal(await guardarCopia({ email: 'ana@x.com', almacen: m, pedirLlave: servidor('ana'), pedirCopia: async () => rota }), 'guardada');
  const r = await abrir({ email: 'ana@x.com', clave: 'clave-segura-1', almacen: m });
  assert.ok(r.ok);
  const c = r.ok ? r.copias[0] : null;
  assert.equal(c?.crm?.notas[12]?.[0]?.texto, 'Llamar el jueves', 'el CRM bueno no se pisó');
  assert.equal(c?.hecha, '2026-10-28T13:10:00.000Z');
  assert.deepEqual(c?.deAntes, [{ que: 'el CRM', hecha: '2026-10-28T13:00:00.000Z' }]);
  assert.deepEqual(c?.faltan, []);
  assert.match(sinComentarios(leer('lib/sin-conexion/cascaron.ts')), /`No se pudo actualizar \$\{d\.que\}: lo que ves es \$\{deCuando\(d\.hecha, copia\.tz\)\}\.`/);
});

test('8d. la copia de OTRA sesión no se cifra en esta base; cada copia vence por SU fecha; sin base, la misma espera', async () => {
  const m = memoria();
  await activar({ email: 'ana@x.com', clave: 'clave-segura-1', almacen: m, pedirLlave: servidor('ana'), vueltas: V });
  // La cookie pasó a Beto entre la llave y la copia: la copia dice de quién es, y no se guarda.
  const deBeto: CopiaV1 = { ...copiaDe(9, 'Negocio de Beto'), persona: { nombre: 'Beto', email: 'BETO@x.com ' } };
  assert.equal(await guardarCopia({ email: 'ana@x.com', almacen: m, pedirLlave: servidor('ana'), pedirCopia: async () => deBeto }), 'sin-copia');
  assert.deepEqual(m.copias(), []);
  const deAna: CopiaV1 = { ...copiaDe(9), persona: { nombre: 'Ana', email: ' Ana@X.com' } };
  assert.equal(await guardarCopia({ email: 'ana@x.com', almacen: m, pedirLlave: servidor('ana'), pedirCopia: async () => deAna }), 'guardada');
  // El negocio 12 se guardó hace 40 días y nunca más (la persona lo perdió); el 9 se renueva: el 12 ya no se abre.
  const viejo: CopiaV1 = { ...copiaDe(12, 'Negocio perdido'), hecha: new Date(Date.now() - 40 * 86_400_000).toISOString() };
  await guardarCopia({ email: 'ana@x.com', almacen: m, pedirLlave: servidor('ana'), pedirCopia: async () => viejo });
  const r = await abrir({ email: 'ana@x.com', clave: 'clave-segura-1', almacen: m });
  assert.ok(r.ok);
  assert.deepEqual(r.ok ? r.copias.map((c) => c.negocio.id) : null, [9], 'la del negocio perdido venció por su fecha');
  // El servidor pone el email de la SESIÓN; el cascarón espera igual sin base (un PBKDF2 de relleno).
  assert.match(sinComentarios(leer('app/api/sin-conexion/copia/route.ts')), /armarCopia\(\{ ws, persona: sesion\.nombre\?\.trim\(\) \|\| sesion\.email, email: sesion\.email \}\)/);
  assert.match(sinComentarios(leer('lib/sin-conexion/cascaron.ts')), /if \(!\(await existeBase\(nombre\)\)\) \{ await llaveDeLaClave\(clave, alAzar\(16\), VUELTAS\)/);
});

test('8e. después de un fallo se espera CADA_MS: cada vuelta a la pestaña ya no vuelve a pedir la copia entera', async () => {
  const guardado = new Map<string, string>();
  const previo = (globalThis as { localStorage?: unknown }).localStorage;
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => guardado.get(k) ?? null, setItem: (k: string, v: string) => { guardado.set(k, v); }, removeItem: (k: string) => { guardado.delete(k); },
  };
  try {
    const { tocaGuardar } = await import('../lib/sin-conexion/en-la-app');
    const base = await nombreDeBase('ana@x.com');
    const ahora = Date.parse('2026-10-28T14:00:00.000Z');
    assert.equal(await tocaGuardar('ana@x.com', ahora), true, 'nunca se guardó: toca');
    guardado.set('mako-sc-intento:' + base, '2026-10-28T13:58:00.000Z');
    assert.equal(await tocaGuardar('ana@x.com', ahora), false, 'falló hace 2 min: espera');
    assert.equal(await tocaGuardar('ana@x.com', ahora + 9 * 60_000), true, 'pasados los 10 min desde el fallo: toca');
    guardado.set('mako-sc-ultima:' + base, '2026-10-28T13:55:00.000Z');
    guardado.delete('mako-sc-intento:' + base);
    assert.equal(await tocaGuardar('ana@x.com', ahora), false, 'guardó hace 5 min');
  } finally {
    (globalThis as { localStorage?: unknown }).localStorage = previo;
  }
  const app = sinComentarios(leer('lib/sin-conexion/en-la-app.ts'));
  assert.match(app, /else if \(r !== 'sin-activar'\) localStorage\.setItem\(INTENTO \+ nombre, new Date\(\)\.toISOString\(\)\);/, 'un fallo anota el intento');
  assert.match(sinComentarios(leer('app/_components/CopiaSinConexion.tsx')), /const tocaGuardar = \(\) => toca\(email\);/);
});
