// =============================================================================
// El servidor de desarrollo no le da un admin a la red (15/10/2026)
// =============================================================================
// `next dev` escucha en toda la red (0.0.0.0) y detrás está la base de PRODUCCIÓN. Dos puertas
// daban un admin global sin login a cualquiera que llegara al puerto —la misma WiFi, o una página
// web por DNS rebinding—: `/api/auth/dev-login` (activa en todo checkout con AUTH_SECRET) y la
// sesión «dev» de `getUsuarioActual` sin AUTH_SECRET. Lo encontró el chat del Centro de Operaciones
// (la mitad latente) y se amplió en «Ciberseguridad» (la mitad activa). El detalle, en
// docs/hallazgos-seguridad.md → «Un next dev sin AUTH_SECRET es un admin abierto a la red».
//
// Probado ROMPIÉNDOLO (15/10/2026), una rotura por vez y restaurando de memoria. Los números, en
// ROTURAS al final.
//
// Correr: node --import tsx --test tests/dev-local.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { esHostLocal, devLoginPermitido, sinLoginPermitido } from '../lib/auth-session';
import { proxy } from '../proxy';

const raiz = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** Corre `fn` con el entorno cambiado y lo deja como estaba. */
function conEntorno(cambios: Record<string, string | undefined>, fn: () => void | Promise<void>) {
  const antes: Record<string, string | undefined> = {};
  for (const k of Object.keys(cambios)) { antes[k] = process.env[k]; if (cambios[k] === undefined) delete process.env[k]; else process.env[k] = cambios[k]; }
  const volver = () => { for (const k of Object.keys(antes)) { if (antes[k] === undefined) delete process.env[k]; else process.env[k] = antes[k]; } };
  try {
    const r = fn();
    if (r instanceof Promise) return r.finally(volver);
    volver();
  } catch (e) { volver(); throw e; }
}

const LOCAL = ['localhost', 'localhost:3000', 'LOCALHOST:3000', '127.0.0.1', '127.0.0.1:3000', '[::1]:3000'];
const AJENOS = ['192.168.0.26:3000', '10.0.0.5', 'evil.com', 'localhost.evil.com', '127.0.0.1.nip.io', 'mako.localhost.attacker.net:3000', '', null, undefined];

test('esHostLocal: sólo la máquina, en positivo', () => {
  for (const h of LOCAL) assert.equal(esHostLocal(h), true, String(h));
  for (const h of AJENOS) assert.equal(esHostLocal(h), false, `${h} pasa por local`);
});

test('dev-login: fuera de un deploy y sólo desde la máquina', () => {
  conEntorno({ VERCEL: undefined, VERCEL_ENV: undefined, NODE_ENV: 'development' }, () => {
    assert.equal(devLoginPermitido('localhost:3000'), true);
    assert.equal(devLoginPermitido('192.168.0.26:3000'), false, 'la red saca un admin');
    assert.equal(devLoginPermitido('rebind.attacker.com:3000'), false, 'DNS rebinding');
  });
  conEntorno({ VERCEL: '1', NODE_ENV: 'development' }, () => assert.equal(devLoginPermitido('localhost:3000'), false, 'vive en Vercel'));
  conEntorno({ VERCEL: undefined, NODE_ENV: 'production' }, () => assert.equal(devLoginPermitido('localhost:3000'), false, 'vive en un build de producción'));
});

test('sin AUTH_SECRET: la sesión dev exige el permiso explícito Y la máquina', () => {
  const base = { AUTH_SECRET: undefined, VERCEL: undefined, VERCEL_ENV: undefined, NODE_ENV: 'development' };
  conEntorno({ ...base, MAKO_DEV_SIN_LOGIN: undefined }, () => assert.equal(sinLoginPermitido('localhost:3000'), false, 'sin el permiso abre igual'));
  conEntorno({ ...base, MAKO_DEV_SIN_LOGIN: '1' }, () => {
    assert.equal(sinLoginPermitido('localhost:3000'), true);
    assert.equal(sinLoginPermitido('192.168.0.26:3000'), false, 'con el permiso, la red entra');
  });
  conEntorno({ ...base, MAKO_DEV_SIN_LOGIN: 'true' }, () => assert.equal(sinLoginPermitido('localhost:3000'), false, 'sólo «1» es el permiso'));
  conEntorno({ ...base, AUTH_SECRET: 'x'.repeat(40), MAKO_DEV_SIN_LOGIN: '1' }, () => assert.equal(sinLoginPermitido('localhost:3000'), false, 'con secreto no hay sesión sin login'));
});

const pedido = (url: string, host: string) => new NextRequest(url, { headers: { host } });

test('el proxy sin AUTH_SECRET: cerrado sin el permiso, y cerrado para la red aun con él', async () => {
  const base = { AUTH_SECRET: undefined, VERCEL: undefined, VERCEL_ENV: undefined, NODE_ENV: 'development' };
  await conEntorno({ ...base, MAKO_DEV_SIN_LOGIN: undefined }, async () => {
    const r = proxy(pedido('http://localhost:3000/api/crm/leads', 'localhost:3000'));
    assert.equal(r.status, 503, 'una API protegida pasa sin secreto ni permiso');
    const p = proxy(pedido('http://localhost:3000/crm', 'localhost:3000'));
    assert.equal(p.status, 503);
  });
  await conEntorno({ ...base, MAKO_DEV_SIN_LOGIN: '1' }, async () => {
    const r = proxy(pedido('http://localhost:3000/api/crm/leads', 'localhost:3000'));
    assert.notEqual(r.status, 503, 'con el permiso, desde la máquina, tiene que pasar');
    assert.notEqual(r.status, 401);
    const red = proxy(pedido('http://192.168.0.26:3000/api/crm/leads', '192.168.0.26:3000'));
    assert.equal(red.status, 503, 'desde la red pasa sin login');
  });
});

test('dev-login responde 404 a un pedido que no nombra a la máquina', async () => {
  await conEntorno({ AUTH_SECRET: 'secreto-de-prueba-del-dev-local-0123456789', VERCEL: undefined, VERCEL_ENV: undefined, NODE_ENV: 'development' }, async () => {
    const { GET } = await import('../app/api/auth/dev-login/route');
    const red = await GET(pedido('http://192.168.0.26:3000/api/auth/dev-login?ws=9', '192.168.0.26:3000'));
    assert.equal(red.status, 404, 'la red saca un admin');
    assert.equal(red.headers.get('set-cookie'), null, 'la red se lleva una cookie');
    const local = await GET(pedido('http://localhost:3000/api/auth/dev-login?ws=9', 'localhost:3000'));
    assert.equal(local.status, 307, 'desde la máquina dejó de andar');
    assert.match(local.headers.get('set-cookie') ?? '', /mako_session=/);
  });
});

test('el fuente: el script levanta en 127.0.0.1, y la sesión dev pasa por la regla', () => {
  const pkg = JSON.parse(leer('package.json')) as { scripts: Record<string, string> };
  assert.match(pkg.scripts.dev, /^next dev -H 127\.0\.0\.1\b/, 'el dev server escucha en toda la red');
  const auth = sinComentarios(leer('lib/auth.ts'));
  assert.match(auth, /if \(sinLoginPermitido\(host\)\) \{\s*return \{ sub: 'dev'/, 'la sesión dev no pasa por la regla');
  assert.equal(auth.split("sub: 'dev'").length - 1, 1, 'hay otra sesión dev');
  const dl = sinComentarios(leer('app/api/auth/dev-login/route.ts'));
  assert.match(dl, /export async function GET\(req: NextRequest\) \{\s*if \(!devLoginPermitido\(req\.headers\.get\('host'\)\)\) \{/);
});

// ROTURAS (15/10/2026), una por vez y restaurando de memoria. Base: 6 pases, 0 fallos.
//   · esHostLocal aceptando lo que CONTIENE «localhost» (rebinding con localhost.evil.com) → 5 / 1
//   · dev-login sin mirar el host                                                         → 4 / 2
//   · la sesión dev sin el permiso explícito                                              → 4 / 2
//   · la sesión dev sin mirar el host                                                     → 4 / 2
//   · el proxy dejando pasar todo en local, como antes                                    → 5 / 1
//   · getUsuarioActual dando la sesión dev sin la regla                                   → 5 / 1
//   · dev-login sin la guarda                                                             → 4 / 2
//   · el script `dev` escuchando en toda la red                                           → 5 / 1
//   Restaurado: 6 / 0.
