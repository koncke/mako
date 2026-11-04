// =============================================================================
// La key de Resend que ADMINISTRA dominios, aparte de la que MANDA (4/11/2026)
// =============================================================================
// El Cerebro midió desde la PC que la key con que MaKo manda en producción es de sólo envío, y con ella Mauricio (ws 1, un
// cliente) no podía conectar su dominio por la API. El encargo: «no le subas el permiso a la clave que envía. Separalo.
// Lo que administra dominios usa una variable de entorno aparte, `RESEND_ADMIN_API_KEY`. Lo que envía sigue con su clave
// de sólo envío. Sin esa variable, `conectar_dominio_email` contesta un error claro y no prende nada. […] Si Resend
// contesta por el tope del plan, que el error lo diga, sin culpar al dominio».
//
// Corre el código REAL: el escenario «claves» de tests/_email-campana-hijo.ts (runners de la API, lib/email-dominio.ts,
// lib/resend*.ts y un broadcast, contra una base en memoria y un Resend que anota el `Authorization` de cada pedido), y un
// hijo con las credenciales de mentira para la key propia de un negocio y el tope del plan.
//
// PROBADO ROMPIÉNDOLO (4/11/2026, `romper.py`; base 6 / 0). Pasan / fallan:
//   R1 el aviso de MaKo sale con la de administración (`keyDeLaPlataforma` lee RESEND_ADMIN_API_KEY)  → 4 / 2
//   R2 sin la de administración, los dominios caen a la que manda (`process.env.RESEND_API_KEY`)      → 4 / 2
//   R3 `prepararConexion` sin preguntar si hay con qué (se propone, y falla recién al confirmar)        → 5 / 1
//   R4 «no pude leer» la key del negocio cae a la de MaKo (el `catch` sigue de largo)                  → 5 / 1
//   R5 el tope del plan vuelve al texto crudo de Resend                                                → 5 / 1
//   R6 `claveDeDominios` exportada                                                                     → 5 / 1
//   Y un cambio sin efecto (renombrar la variable local de la clave) → 6 / 0.
//
// Correr: node --import tsx --test tests/resend-clave-admin.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  esTopeDeDominios, SIN_CLAVE_DE_DOMINIOS, TOPE_DOMINIOS_DE_MAKO, TOPE_DOMINIOS_TUYO, KEY_SOLO_ENVIO_DE_MAKO,
} from '../lib/resend-errores';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string): string => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const url = (rel: string): string => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);

// Lo que Resend contesta cuando la cuenta llegó al tope de dominios: NO MEDIDO (ver `esTopeDeDominios`). Cuando se vea el
// cuerpo real, se suma acá tal cual.
const TOPE = { statusCode: 403, name: 'validation_error', message: 'You have reached the maximum number of domains allowed on your plan. Upgrade to add more.' };

// ── 1) El código real, por la API: sin la clave no se prende nada; con ella, cada pedido va con la suya ────────────
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_email-campana-hijo.ts'), 'claves'], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], timeout: 120_000,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;

test('sin RESEND_ADMIN_API_KEY, conectar y verificar el dominio contestan un error de MaKo y no prenden nada', () => {
  assert.deepEqual(R.sinClave, { error: SIN_CLAVE_DE_DOMINIOS, falla: true }, 'conectar_dominio_email: no se propone nada');
  assert.deepEqual(R.sinClaveVerificar, { error: SIN_CLAVE_DE_DOMINIOS, falla: true }, 'verificar_dominio_envio: tampoco');
  assert.match(SIN_CLAVE_DE_DOMINIOS, /problema de MaKo, no tuyo/);
  assert.equal(R.sinClavePedidos, 0, 'no se le pidió nada de dominios a Resend');
  assert.deepEqual(R.sinClaveSettings, [], 'ni una línea en los settings del negocio');
  assert.equal(R.sinClaveEstado.alta_de_dominios_lista, false, 'estado_email lo dice');
  assert.equal(R.sinClaveEstado.error_dominio, SIN_CLAVE_DE_DOMINIOS, 'y el error del dominio dice por qué, no «no hay dominio»');
});

test('con ella, lo que administra dominios va con la de administración y lo que MANDA sigue con la suya', () => {
  assert.equal(R.conectar.ok, true, R.conectar.resumen);
  assert.equal(R.verificar.ok, true, R.verificar.resumen);
  assert.equal(R.conClaveEstado.alta_de_dominios_lista, true);
  assert.equal(R.prueba.ok, true, 'el broadcast de prueba del negocio salió');
  assert.equal(R.aviso.ok, true, 'el aviso de MaKo salió');
  assert.deepEqual(R.claves.dominios, ['re_admin_de_la_plataforma'], 'todo /domains con la de administración');
  assert.deepEqual(R.claves.envios, ['re_de_la_plataforma'], 'todo /emails con la que manda: nunca la de administración');
  assert.deepEqual(R.otros, [], 'nada salió a la red real');
});

// ── 2) La key propia de un negocio (Opción B), «no pude leer» y el tope del plan ─────────────────────────────────────
type Caso = { propia: 'suya' | 'ninguna' | 'tira'; alta: 'ok' | 'tope' | 'tope-ya-estaba' | 'nombre-malo' };
const hijo = (c: Caso): { r: { ok: boolean; error?: string }; claves: string[] } => {
  const codigo = `
import { mock } from 'node:test';
const real = (m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'default' && k !== 'module.exports'));
process.env.RESEND_ADMIN_API_KEY = 're_admin';
const caso = ${JSON.stringify(c)};
const cred = await import(${url('lib/credenciales.ts')});
mock.module(${url('lib/credenciales.ts')}, { exports: { ...real(cred),
  credWs: async () => 're_envio', envCred: async () => 're_envio',
  credDelClienteEstricta: async () => { if (caso.propia === 'tira') throw new Error('base caída'); return caso.propia === 'suya' ? 're_suya' : null; },
  esDeLaPlataforma: async (_k, v) => v === 're_envio',
} });
const claves = [];
const json = (status, b) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
const DOM = { id: 'd1', name: 'negocio-uno.com', status: 'not_started', records: [] };
globalThis.fetch = async (u, init = {}) => {
  claves.push(new Headers(init.headers).get('authorization')?.replace(/^Bearer /, '') ?? null);
  const path = new URL(String(u)).pathname, metodo = (init.method ?? 'GET').toUpperCase();
  if (path === '/domains' && metodo === 'POST') {
    if (caso.alta === 'ok') return json(201, DOM);
    if (caso.alta === 'nombre-malo') return json(422, { statusCode: 422, name: 'validation_error', message: 'Invalid domain name' });
    return json(403, ${JSON.stringify(TOPE)});
  }
  if (path === '/domains') return json(200, { data: caso.alta === 'tope-ya-estaba' ? [DOM] : [] });
  return json(200, DOM);
};
const { runWithWorkspace } = await import(${url('lib/workspace.ts')});
const { createResendDomain } = await import(${url('lib/resend.ts')});
const r = await runWithWorkspace(3, () => createResendDomain('negocio-uno.com'));
console.log(JSON.stringify({ r, claves: [...new Set(claves)] }));
`;
  const out = execFileSync(process.execPath, [
    '--conditions=react-server', '--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx', '--input-type=module', '-e', codigo,
  ], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  return JSON.parse(out.trim().split('\n').pop()!);
};

test('un negocio con SU key de Resend administra su dominio con la suya; «no pude leerla» no cae a la de MaKo', () => {
  const suya = hijo({ propia: 'suya', alta: 'ok' });
  assert.equal(suya.r.ok, true);
  assert.deepEqual(suya.claves, ['re_suya'], 'su dominio vive en su cuenta: ni la de MaKo ni la que manda');
  const ninguna = hijo({ propia: 'ninguna', alta: 'ok' });
  assert.deepEqual(ninguna.claves, ['re_admin'], 'sin key propia, la de administración (nunca la que manda)');
  const tira = hijo({ propia: 'tira', alta: 'ok' });
  assert.equal(tira.r.ok, false);
  assert.match(tira.r.error!, /No pude leer la clave de correo del negocio/);
  assert.deepEqual(tira.claves, [], 'no se le pidió nada a Resend: con la de MaKo, su dominio caería en otra cuenta');
});

test('el tope de dominios del plan se dice como tal, sin culpar al dominio; y si ya estaba en la cuenta, se adopta', () => {
  assert.deepEqual(hijo({ propia: 'ninguna', alta: 'tope' }).r, { ok: false, error: TOPE_DOMINIOS_DE_MAKO });
  assert.deepEqual(hijo({ propia: 'suya', alta: 'tope' }).r, { ok: false, error: TOPE_DOMINIOS_TUYO });
  for (const t of [TOPE_DOMINIOS_DE_MAKO, TOPE_DOMINIOS_TUYO]) assert.match(t, /No es por tu dominio/);
  assert.equal(hijo({ propia: 'ninguna', alta: 'tope-ya-estaba' }).r.ok, true, 'volver a conectar uno que ya está no choca con el tope');
  assert.deepEqual(hijo({ propia: 'ninguna', alta: 'nombre-malo' }).r, { ok: false, error: 'Invalid domain name' }, 'un nombre inválido no es el tope');
});

test('qué cuenta como el tope del plan: nombra el dominio Y un tope; una key o un nombre malo no', () => {
  assert.equal(esTopeDeDominios(403, TOPE), true);
  assert.equal(esTopeDeDominios(422, { name: 'validation_error', message: 'Domain limit reached for your plan' }), true);
  assert.equal(esTopeDeDominios(422, { name: 'validation_error', message: 'Invalid domain name' }), false);
  assert.equal(esTopeDeDominios(429, { name: 'rate_limit_exceeded', message: 'Too many requests, upgrade your plan' }), false, 'sin «domain» no es el tope');
  assert.equal(esTopeDeDominios(401, { name: 'restricted_api_key', message: 'This API key is restricted to only send emails, not manage domains on any plan' }), false);
  assert.equal(esTopeDeDominios(500, { message: 'domain limit' }), false, 'un 5xx no es una regla del plan');
  assert.equal(esTopeDeDominios(403, 'Maximum domains allowed on your plan'), true, 'también si viene como texto');
  assert.match(KEY_SOLO_ENVIO_DE_MAKO, /no tuyo/);
});

// ── 3) La clave de administración no sale de su módulo ────────────────────────────────────────────────────────────────
test('RESEND_ADMIN_API_KEY la nombra sólo lib/resend-dominios.ts, y ese módulo no exporta la clave', () => {
  // Los candidatos con `git grep` (en C; `--untracked` para que un archivo nuevo sin `git add` también cuente), y el piso de
  // archivos para que «no encontré nada» no sea «no miré». Lo que cuenta es el CÓDIGO: un comentario que la nombra no la lee.
  const total = execFileSync('git', ['ls-files'], { cwd: RAIZ, encoding: 'utf8' }).split('\n').filter(Boolean).length;
  assert.ok(total > 1000, `git ls-files trajo ${total}: no miró el repo`);
  let candidatos: string[] = [];
  try {
    candidatos = execFileSync('git', ['grep', '-l', '--untracked', 'RESEND_ADMIN_API_KEY'], { cwd: RAIZ, encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch (e) { if ((e as { status?: number }).status !== 1) throw e; }
  const sinComentarios = (t: string) => t.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const nombran = candidatos
    .filter((f) => !f.startsWith('tests/') && !f.startsWith('docs/') && !/\.md$/.test(f))
    .filter((f) => sinComentarios(leer(f)).includes('RESEND_ADMIN_API_KEY'));
  assert.ok(candidatos.includes('lib/resend-dominios.ts'), 'git grep no vio el módulo: no miró');
  assert.deepEqual(nombran, ['lib/resend-dominios.ts'], 'ni el envío, ni el catálogo de credenciales (que el arranque hidrata desde la fila del ws 1), ni otra pantalla');

  const src = leer('lib/resend-dominios.ts');
  const exportados = [...src.matchAll(/^export (?:async function|function|const|let|type)\s+(\w+)/gm)].map((m) => m[1]).sort();
  assert.deepEqual(exportados, [
    'CreacionDominio', 'DomainResult', 'ResendDnsRecord', 'ResendDomain',
    'createResendDomain', 'getResendDomain', 'listResendDomains', 'prenderSeguimiento', 'puedeAdministrarDominios', 'verifyResendDomain',
  ], 'un export nuevo se decide acá: ninguno puede devolver la clave');
  assert.doesNotMatch(src, /^export\s*\{/m, 'sin listas de exports que esquiven el conteo');
  assert.match(src, /^async function claveDeDominios\(/m, 'la que lee la clave es privada');
  assert.match(src, /^import 'server-only';/m);
});
