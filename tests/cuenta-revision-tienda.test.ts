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
import { AMRS, CUENTA_DE_REVISION, DIAS_SESION_REVISION, decidirTrasGoogle, esCuentaDeRevision, requiereSegundoFactor, revisionNoPuede, sesionDeRevisionVigente } from '../lib/mfa-reglas';
import { WS_PRUEBAS, WS_PRUEBA } from '../lib/auth-session';

const leer = (f: string) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const LA = { email: CUENTA_DE_REVISION.email, workspace_id: CUENTA_DE_REVISION.ws, rol: 'usuario', rol_ws: 'closer' };

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
    { ...LA, rol_ws: 'admin' },
    { ...LA, rol_ws: null },
    { ...LA, rol_ws: 'setter' },
    { email: null, workspace_id: 3, rol: 'usuario', rol_ws: 'closer' },
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
  assert.match(a, /if \(firmada\.mfa === 'revision'\) \{\s+if \(!esCuentaDeRevision\(u\)\) return null;/);
  assert.ok(AMRS.includes('revision'), 'sin esto `verificarToken` tira la sesión');
  // Rotar la contraseña cierra lo que estaba abierto, y sin poder mirar la fila no vale.
  assert.match(a, /if \(!sesionDeRevisionVigente\(firmada\.iat, /);
  assert.match(a, /return firmada\.mfa === 'revision' \? null : firmada;/);
  const cambio = '2026-11-03T12:00:00.000Z';
  const t = Date.parse(cambio) / 1000;
  assert.equal(sesionDeRevisionVigente(t + 60, cambio), true);
  assert.equal(sesionDeRevisionVigente(t - 60, cambio), false, 'una cookie de antes de rotar');
  assert.equal(sesionDeRevisionVigente(t + 60, null), false, 'sin contraseña que comparar');
  assert.equal(sesionDeRevisionVigente(undefined, cambio), false, 'sin fecha en el token');
  // Vida corta, y la marca no le sirve a un admin ni al paso intermedio.
  assert.match(sinComentarios(leer('app/api/auth/contrasena/route.ts')), /mfa: 'revision' \}, DIAS_SESION_REVISION\)/);
  assert.ok(DIAS_SESION_REVISION <= 7);
  const ses = sinComentarios(leer('lib/auth-session.ts'));
  assert.match(ses, /if \(s\.rol === 'admin' && s\.mfa === 'revision'\) return null;/);
  assert.match(ses, /if \(p\.mfa !== undefined && \(!AMRS\.includes\(p\.mfa\) \|\| p\.mfa === 'revision'\)\) return null;/);
});

test('4b. la cuenta no se puede tomar, ni escribirle a un tercero, ni abrirle una puerta a otro', () => {
  for (const r of ['/api/perfil/seguridad', '/api/onboarding', '/api/equipo', '/api/perfil/destinatarios', '/api/agente/token', '/api/chat-agent/onboarding/prueba']) {
    assert.equal(revisionNoPuede(r, 'POST'), true, r);
    assert.equal(revisionNoPuede(r, 'PATCH'), true, r);
    assert.equal(revisionNoPuede(r, 'DELETE'), true, r);
    assert.equal(revisionNoPuede(r, 'GET'), false, `${r}: leer sí, el revisor mira esas pantallas`);
  }
  for (const r of ['/api/mako/chat', '/api/cuenta/eliminar', '/api/ia-permiso', '/api/soporte/reportar', '/api/perfil/notif-push']) {
    assert.equal(revisionNoPuede(r, 'POST'), false, `${r}: es lo que el revisor tiene que poder probar`);
  }
  assert.match(sinComentarios(leer('proxy.ts')), /if \(sesion\.mfa === 'revision' && revisionNoPuede\(pathname, req\.method\)\) return NextResponse\.json/);
  // Y en la ruta también: el proxy puede cambiar.
  assert.match(sinComentarios(leer('app/api/perfil/seguridad/route.ts')), /if \(s\.mfa === 'revision'\) return no\('Esta cuenta no se puede cambiar\.', 403\);/);
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
  assert.match(s, /carpeta\.toLowerCase\(\)\.startsWith\(REPO\.toLowerCase\(\)\) \|\| \/onedrive\/i\.test\(carpeta\) \|\| dentroDeUnRepo\(carpeta\)/);
  assert.match(s, /if \(!process\.argv\.includes\('--medido'\)\)/, 'primero se mira qué hay en el negocio');
  assert.match(s, /!process\.argv\.includes\('--rotar'\)/, 'correrlo de nuevo mata la contraseña que tienen Play y Apple');
  assert.ok(s.indexOf('writeFileSync(archivo') < s.indexOf('await guardarContrasena('), 'si falla después, la contraseña nueva no se pierde');
  assert.match(s, /rol_ws: CUENTA_DE_REVISION\.rolWs/);
  assert.doesNotMatch(s.split('\n').filter((l) => l.includes('console.')).join('\n'), /contrasena\b(?!:)/, 'la contraseña en la consola');
  assert.match(s, /if \(!esCuentaDeRevision\(u\) \|\| u\.estado === 'suspendido'\)/, 'un usuario con ese correo que no es la cuenta no se toca');
});

// ⚠️ PROBADO ROMPIÉNDOLO (3/11/2026, base 7 / 0; una rotura por vez, restaurada de memoria y comprobada con sha256):
//   · cualquier negocio, un correo que la contiene, un admin global o un admin del negocio   → (2), cada una
//   · en un cliente real (ws 1)                                                              → (1 y 2)
//   · la sesión sin volver a mirar la fila, rotar no la cierra, sin fecha vale, con la base caída vale, la marca le sirve a un admin → (4), cada una
//   · sin rastro también entra                                                               → (3)
//   · se puede tomar la cuenta, se puede invitar gente, el proxy no corta                    → (4b), cada una
