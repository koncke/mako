// =============================================================================
// La cuenta de revisión de las tiendas: la ÚNICA sin segundo factor (docs/tiendas-play-appstore.md, paso 5, 3/11/2026)
// =============================================================================
// Google Play exige credenciales reutilizables que se salten el OTP. Lo que se fija acá es lo contrario: que NADIE MÁS se lo salte.
//
// Correr: node --import tsx --test tests/cuenta-revision-tienda.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (3/11/2026): al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AMRS, CUENTA_DE_REVISION, esCuentaDeRevision, requiereSegundoFactor, decidirTrasGoogle } from '../lib/mfa-reglas';
import { WS_PRUEBAS, WS_PRUEBA } from '../lib/auth-session';

const leer = (f: string) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const LA = { email: CUENTA_DE_REVISION.email, workspace_id: CUENTA_DE_REVISION.ws, rol: 'usuario' };

test('1. es ESA cuenta, en el negocio de prueba, y sin ser admin', () => {
  assert.equal(CUENTA_DE_REVISION.ws, WS_PRUEBA);
  assert.ok(WS_PRUEBAS.includes(CUENTA_DE_REVISION.ws), 'en un cliente real, la excepción abriría sus datos sin segundo factor');
  assert.equal(esCuentaDeRevision(LA), true);
  assert.equal(esCuentaDeRevision({ ...LA, email: ' REVISION-tiendas@HOLA-mako.com ' }), true, 'el correo se compara normalizado, como el login');
});

test('2. cualquier otro usuario o negocio sigue pidiendo el segundo factor', () => {
  for (const otro of [
    { ...LA, email: 'otra@hola-mako.com' },
    { ...LA, email: `x${CUENTA_DE_REVISION.email}` },
    { ...LA, email: `${CUENTA_DE_REVISION.email}.evil.com` },
    { ...LA, workspace_id: 1 },
    { ...LA, workspace_id: 9 },
    { ...LA, workspace_id: null },
    { ...LA, workspace_id: '3' as unknown as number },
    { ...LA, rol: 'admin' },
    { ...LA, rol: null },
    { email: null, workspace_id: 3, rol: 'usuario' },
    {},
    null,
    undefined,
  ]) {
    assert.equal(esCuentaDeRevision(otro), false, JSON.stringify(otro));
  }
  // Y la regla general no se enteró: un negocio que lo exige, lo exige.
  assert.equal(requiereSegundoFactor('usuario', false, '2026-10-21T00:00:00Z', Date.UTC(2026, 10, 3)), true);
  assert.equal(decidirTrasGoogle({ rol: 'usuario', mfaActivo: true, tieneFila: true, dispositivoValido: false }), 'segundo-factor');
});

test('3. la ruta: después de comprobar la contraseña, con su rastro antes de la sesión, y sin rastro no entra', () => {
  const r = sinComentarios(leer('app/api/auth/contrasena/route.ts'));
  const comprobar = r.indexOf('await comprobarContrasena(body.email, body.contrasena)');
  const excepcion = r.indexOf('if (esCuentaDeRevision(usuario)) {');
  const anotar = r.indexOf('await anotarEntradaDeRevision(usuario.id');
  const sesion = r.indexOf("mfa: 'revision'");
  assert.ok(comprobar > 0 && excepcion > comprobar, 'antes de comprobar la contraseña sería entrar sin nada');
  assert.ok(anotar > excepcion && sesion > anotar, 'el rastro va antes de la sesión');
  assert.match(r, /if \(!\(await anotarEntradaDeRevision\([^\n]*\)\) return no\('No se pudo entrar\.', 503\);/, 'una entrada sin rastro no se da');
  assert.match(sinComentarios(leer('lib/mfa.ts')), /tipo: 'login-revision-tienda'[\s\S]{0,120}return !error;/);
});

test('4. la sesión vale mientras la fila siga siendo esa: una cookie vieja no sobrevive a mudarla', () => {
  const a = sinComentarios(leer('lib/auth.ts'));
  assert.match(a, /if \(firmada\.mfa === 'revision' && !esCuentaDeRevision\(u\)\) return null;/);
  assert.ok(AMRS.includes('revision'), 'sin esto `verificarToken` tira la sesión');
});

test('5. una sola puerta: ni Google ni el segundo paso la miran, y no hay variable que la prenda', () => {
  for (const f of ['app/api/auth/callback/google/route.ts', 'app/api/auth/2fa/route.ts', 'lib/mfa-obligatorio.ts']) {
    assert.doesNotMatch(leer(f), /esCuentaDeRevision|CUENTA_DE_REVISION/, f);
  }
  const reglas = leer('lib/mfa-reglas.ts');
  assert.doesNotMatch(reglas.slice(reglas.indexOf('export const CUENTA_DE_REVISION'), reglas.indexOf('// ── La política')), /process\.env/);
});

test('6. el script: sólo en un negocio de prueba, y la contraseña no sale por pantalla ni va al repo', () => {
  const s = sinComentarios(leer('scripts/tiendas-cuenta-revision.mts'));
  assert.match(s, /if \(!WS_PRUEBAS\.includes\(CUENTA_DE_REVISION\.ws\)\)/);
  assert.match(s, /carpeta\.toLowerCase\(\)\.startsWith\(REPO\.toLowerCase\(\)\)/);
  assert.doesNotMatch(s.split('\n').filter((l) => l.includes('console.')).join('\n'), /contrasena\b(?!:)/, 'la contraseña en la consola');
  assert.match(s, /if \(!esCuentaDeRevision\(u\)\)/, 'un usuario con ese correo que no es la cuenta no se toca');
});

// ⚠️ PROBADO ROMPIÉNDOLO (3/11/2026, base 6 / 0; una rotura por vez, restaurada de memoria y comprobada con sha256):
//   · cualquier negocio                       → 5 / 1 (2)
//   · cualquier correo                        → 5 / 1 (2)
//   · un correo que la contiene               → 5 / 1 (2)
//   · también un admin                        → 5 / 1 (2)
//   · en un cliente real (ws 1)               → 4 / 2 (1 y 2)
//   · la sesión sin volver a mirar la fila    → 5 / 1 (4)
//   · sin rastro también entra                → 5 / 1 (3)
//   · sin comprobar la contraseña             → 5 / 1 (3)
