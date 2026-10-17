// =============================================================================
// #875: una key de Resend de SÓLO ENVÍO, dicha en palabras y con su dueño (17/10/2026)
// =============================================================================
// Mauricio conectando elevate.com.mx (Fathom 863534245, 42:02) leyó «This API key is restricted to only send emails»,
// crudo. Martín: «esto es un error de MaKo». Medido el 17/10: la key de la plataforma guardada en la fila del ws1 (la
// que el arranque pone en el entorno) es de sólo envío; el alta de dominio («Opción A», la cuenta de MaKo) no anda con
// ella para nadie. El arreglo de fondo es una key con «Full access» en esa fila (de Martín: es su cuenta). El código
// ahora dice de quién es la key: la de MaKo («no es tuyo») o la del negocio («crea una con Full access»), y la
// verificación de Integraciones deja de llamar «inválida» a una key que manda.
//
// PROBADO ROMPIÉNDOLO (17/10/2026, arnés `romper.py` + `roturas-875.json`; base 3 / 0). Pasan / fallan:
//   K1 `errorDeResend` sin mirar de quién es la key (siempre «tu key»)                        → 2 / 1
//   K2 el alta del dominio vuelve al texto crudo de Resend (`errMsg`)                          → 2 / 1
//   K3 Integraciones vuelve a decir «API key inválida.» a una key de sólo envío                → 2 / 1
//
// Correr: node --import tsx --test tests/resend-key-solo-envio.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { esKeySoloEnvio, KEY_SOLO_ENVIO_DE_MAKO, KEY_SOLO_ENVIO_TUYA } from '../lib/resend-errores';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string): string => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const url = (rel: string): string => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);
const RESTRINGIDA = { statusCode: 401, name: 'restricted_api_key', message: 'This API key is restricted to only send emails' };

// Resend de mentira: toda llamada a /domains contesta como una key de sólo envío. `deMako` dice de quién es la key.
const hijo = (deMako: boolean): { crear: { ok: boolean; error?: string }; verificar: { ok: boolean; error?: string } } => {
  const codigo = `
import { mock } from 'node:test';
const real = (m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'default' && k !== 'module.exports'));
const cred = await import(${url('lib/credenciales.ts')});
mock.module(${url('lib/credenciales.ts')}, { exports: { ...real(cred), credWs: async () => 're_k', envCred: async () => 're_k', esDeLaPlataforma: async () => ${deMako} } });
globalThis.fetch = async () => new Response(JSON.stringify(${JSON.stringify(RESTRINGIDA)}), { status: 401, headers: { 'Content-Type': 'application/json' } });
const { createResendDomain, verifyResendDomain } = await import(${url('lib/resend.ts')});
console.log(JSON.stringify({ crear: await createResendDomain('elevate.com.mx'), verificar: await verifyResendDomain('d1') }));
`;
  const out = execFileSync(process.execPath, [
    '--conditions=react-server', '--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx', '--input-type=module', '-e', codigo,
  ], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  return JSON.parse(out.trim().split('\n').pop()!);
};

test('Resend dice «sólo envío» con `restricted_api_key`; cualquier otro error no', () => {
  assert.equal(esKeySoloEnvio(RESTRINGIDA), true);
  assert.equal(esKeySoloEnvio({ name: 'validation_error', message: 'x' }), false);
  assert.equal(esKeySoloEnvio('This API key is restricted'), false, 'un texto no es el error tipado');
  assert.equal(esKeySoloEnvio(null), false);
});

test('el alta y la verificación del dominio dicen de quién es la key, en palabras', () => {
  const deMako = hijo(true);
  assert.deepEqual(deMako.crear, { ok: false, error: KEY_SOLO_ENVIO_DE_MAKO });
  assert.deepEqual(deMako.verificar, { ok: false, error: KEY_SOLO_ENVIO_DE_MAKO });
  assert.match(KEY_SOLO_ENVIO_DE_MAKO, /no tuyo/);
  const delNegocio = hijo(false);
  assert.deepEqual(delNegocio.crear, { ok: false, error: KEY_SOLO_ENVIO_TUYA });
  assert.match(KEY_SOLO_ENVIO_TUYA, /Full access/);
});

test('Integraciones: una key que manda no es «inválida»', () => {
  const v = leer('lib/metodo-verificar.ts');
  const i = v.indexOf('  async email(v) {');
  assert.ok(i > 0);
  const email = v.slice(i, v.indexOf('\n  },\n', i));
  assert.match(email, /if \(status === 401 && esKeySoloEnvio\(body\)\) return \{ ok: false, error: KEY_SOLO_ENVIO_TUYA \};\n\s*if \(status === 401\) return \{ ok: false, error: 'API key inválida\.' \};/);
});
