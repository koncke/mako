// =============================================================================
// Las keys de Resend: cada negocio con la SUYA, y la de administración de MaKo sólo para el dominio de MaKo (4/11/2026)
// =============================================================================
// Primero (mañana del 4/11) el Cerebro midió que la key con que MaKo manda en producción es de sólo envío, y el encargo fue
// separar la que administra dominios (`RESEND_ADMIN_API_KEY`) de la que manda. A la tarde Martín cambió el modelo: «Resend
// free permite hasta 3 dominios, pero eso lo trae cada user de mako». Desde entonces cada negocio administra y manda con SU
// cuenta (lib/email-cuenta.ts), y la de administración de MaKo queda SÓLO para el dominio de MaKo (la plataforma). El camino
// entero por la API, el webhook y el ws1 los fija tests/email-cuenta-propia.test.ts; esto fija qué clave firma cada pedido.
//
// Corre el código REAL: el escenario «claves» de tests/_email-campana-hijo.ts (runners de la API, lib/email-dominio.ts,
// lib/resend*.ts y un broadcast, contra una base en memoria y un Resend que anota el `Authorization` de cada pedido), y un
// hijo con la cuenta de mentira para cada caso (propia, plataforma, ninguna, ilegible) y el tope del plan.
//
// PROBADO ROMPIÉNDOLO (4/11/2026, `romper.py`; base 6 / 0). Pasan / fallan: el negocio administra con la de administración →
// 4 / 2; la plataforma con la que manda → 4 / 2; el aviso de MaKo con la del negocio → 5 / 1; «no pude leer» la cuenta cae a la de
// administración → 5 / 1.
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
import { sinCuentaParaOperar } from '../lib/email-cuenta-reglas';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string): string => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const url = (rel: string): string => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);

// Lo que Resend contesta cuando la cuenta llegó al tope de dominios: NO MEDIDO (ver `esTopeDeDominios`). Cuando se vea el
// cuerpo real, se suma acá tal cual.
const TOPE = { statusCode: 403, name: 'validation_error', message: 'You have reached the maximum number of domains allowed on your plan. Upgrade to add more.' };

// ── 1) El código real, por la API: qué clave firma cada pedido ──────────────────────────────────────────────────────────
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_email-campana-hijo.ts'), 'claves'], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], timeout: 120_000,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;

test('la plataforma: sin RESEND_ADMIN_API_KEY su dominio no se toca (error de MaKo); con ella, va con esa', () => {
  assert.deepEqual(R.platSinClave, { error: SIN_CLAVE_DE_DOMINIOS, falla: true }, 'conectar_dominio_email: no se propone nada');
  assert.match(SIN_CLAVE_DE_DOMINIOS, /problema de MaKo/);
  assert.equal(R.platSinClavePedidos, 0, 'no se le pidió nada a Resend');
  assert.equal(R.platConectar.ok, true, R.platConectar.resumen);
  assert.deepEqual(R.clavesPlataforma, ['re_admin_de_la_plataforma'], 'el dominio de MaKo, con la de administración: nunca con la que manda');
});

test('un negocio administra y manda con SU cuenta; el aviso de MaKo sale con la de MaKo, también desde el negocio', () => {
  assert.equal(R.conectar.ok, true, R.conectar.resumen);
  assert.equal(R.verificar.ok, true, R.verificar.resumen);
  assert.equal(R.prueba.ok, true, 'el broadcast de prueba del negocio salió');
  assert.equal(R.aviso.ok, true, 'el aviso de MaKo salió');
  assert.deepEqual(R.clavesNegocio.administrar, ['re_del_negocio'], 'dominio, verificación y webhook en SU cuenta: ni la de MaKo ni la de administración');
  assert.deepEqual(R.clavesNegocio.envios, ['re_del_negocio'], 'su email, con la suya');
  assert.deepEqual(R.clavesAviso, ['re_de_la_plataforma'], 'lo que firma MaKo, con la de MaKo');
  assert.deepEqual(R.otros, [], 'nada salió a la red real');
});

// ── 2) La cuenta de cada caso (propia, plataforma, ninguna, ilegible) y el tope del plan ──────────────────────────────────
type Caso = { cuenta: 'suya' | 'plataforma' | 'ninguna' | 'tira'; alta: 'ok' | 'tope' | 'tope-ya-estaba' | 'nombre-malo' };
const hijo = (c: Caso): { r: { ok: boolean; error?: string }; claves: string[] } => {
  const codigo = `
import { mock } from 'node:test';
const real = (m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'default' && k !== 'module.exports'));
process.env.RESEND_ADMIN_API_KEY = 're_admin';
const caso = ${JSON.stringify(c)};
const cuenta = await import(${url('lib/email-cuenta.ts')});
const CUENTAS = { suya: { tipo: 'propia', ws: 3, key: 're_suya' }, plataforma: { tipo: 'plataforma', ws: 9, key: 're_envio' }, ninguna: { tipo: 'sin_cuenta', ws: 3 }, tira: { tipo: 'no_pude_leer', ws: 3, error: 'base caída' } };
mock.module(${url('lib/email-cuenta.ts')}, { exports: { ...real(cuenta), cuentaDeCorreo: async () => CUENTAS[caso.cuenta] } });
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

test('con SU cuenta, su clave; la plataforma, la de administración; sin cuenta o sin poder leerla, nada sale a Resend', () => {
  const suya = hijo({ cuenta: 'suya', alta: 'ok' });
  assert.equal(suya.r.ok, true);
  assert.deepEqual(suya.claves, ['re_suya'], 'su dominio vive en su cuenta: ni la de MaKo ni la de administración');
  assert.deepEqual(hijo({ cuenta: 'plataforma', alta: 'ok' }).claves, ['re_admin'], 'el de MaKo, con la de administración (nunca la que manda)');
  const ninguna = hijo({ cuenta: 'ninguna', alta: 'ok' });
  assert.deepEqual(ninguna.r, { ok: false, error: sinCuentaParaOperar('sin_cuenta') }, 'sin su cuenta, la guía; nunca la de MaKo');
  assert.deepEqual(ninguna.claves, [], 'ni un pedido: su dominio caería en la cuenta de MaKo');
  const tira = hijo({ cuenta: 'tira', alta: 'ok' });
  assert.equal(tira.r.ok, false);
  assert.match(tira.r.error!, /No pude leer la clave de correo del negocio/);
  assert.deepEqual(tira.claves, [], '«no pude leer» no cae a ninguna otra clave');
});

test('el tope de dominios del plan se dice como tal y es de la cuenta que lo tiene; si ya estaba en la cuenta, se adopta', () => {
  assert.deepEqual(hijo({ cuenta: 'plataforma', alta: 'tope' }).r, { ok: false, error: TOPE_DOMINIOS_DE_MAKO });
  assert.deepEqual(hijo({ cuenta: 'suya', alta: 'tope' }).r, { ok: false, error: TOPE_DOMINIOS_TUYO }, 'el de su cuenta (gratis o no) es suyo, y se dice en palabras');
  for (const t of [TOPE_DOMINIOS_DE_MAKO, TOPE_DOMINIOS_TUYO]) assert.match(t, /No es por tu dominio/);
  assert.match(TOPE_DOMINIOS_TUYO, /Tu cuenta de Resend/);
  assert.equal(hijo({ cuenta: 'suya', alta: 'tope-ya-estaba' }).r.ok, true, 'volver a conectar uno que ya está no choca con el tope');
  assert.deepEqual(hijo({ cuenta: 'suya', alta: 'nombre-malo' }).r, { ok: false, error: 'Invalid domain name' }, 'un nombre inválido no es el tope');
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
  const total = execFileSync('git', ['ls-files'], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 50_000_000 }).split('\n').filter(Boolean).length;
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
    'Administracion', 'CreacionDominio', 'DomainResult', 'ResendDnsRecord', 'ResendDomain', 'WebhookDeCuenta',
    'administracionDeLaCuenta', 'asegurarWebhookDeCuenta', 'createResendDomain', 'getResendDomain', 'listResendDomains', 'prenderSeguimiento',
    'probarClaveDeCuenta', 'puedeAdministrarDominios', 'verifyResendDomain',
  ], 'un export nuevo se decide acá: ninguno puede devolver la clave (el SECRETO del webhook sí vuelve, y sólo lo guarda lib/email-dominio.ts)');
  assert.doesNotMatch(src, /^export\s*\{/m, 'sin listas de exports que esquiven el conteo');
  assert.match(src, /^async function claveDeCuenta\(/m, 'la que lee la clave es privada');
  assert.match(src, /^import 'server-only';/m);
});
