// =============================================================================
// La cuenta de revisión de las tiendas: las REGLAS, corridas (docs/tiendas-play-appstore.md, paso 5; 3/11 y 4/11/2026)
// =============================================================================
// Google Play exige credenciales reutilizables que se salten el OTP. Lo que se fija acá es lo contrario: que NADIE MÁS se lo salte, y
// qué puede hacer quien sí. Son las funciones puras de lib/cuenta-revision-reglas.ts y la firma del token. Lo que corre la base, los
// envíos, la entrada, los tickets y el script está en tests/cuenta-revision.test.ts; el proxy ruta por ruta, en
// tests/cuenta-revision-escrituras.test.ts.
//
// ⚠️ HASTA EL 4/11 ESTE ARCHIVO ERAN 19 REGEX SOBRE EL FUENTE (la revisión de ese día): daban verde con el código bien escrito y no
// probaban que algo se cortara. Cada uno tiene su reemplazo que corre: la entrada y el rastro (el test «B y G»), la sesión al rotar o
// mudarla (B), el proxy (escrituras), Google (E y F), el script (el último). Queda uno sobre el fuente, que es una regla del módulo:
// ninguna variable de entorno prende la excepción.
//
// Correr: node --import tsx --test tests/cuenta-revision-tienda.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (4/11/2026, base 7 / 0; una rotura por vez, restaurada de memoria):
//   · el correo comparado con toLowerCase()            → 6 / 1 (1)
//   · WS_REVISION = 3                                   → 5 / 2 (1 y 2)
//   · sin `rol_ws`                                      → 6 / 1 (2)
//   · la sesión vale sin fecha de cambio                → 6 / 1 (3)
//   · verificarToken sin el corte del admin             → 6 / 1 (4)
//   · lo permitido por prefijo (`startsWith`)           → 6 / 1 (5)
//   · el envío al equipo con otro destinatario en la lista → 6 / 1 (5)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CUENTA_DE_REVISION, DIAS_SESION_REVISION, WS_REVISION, envioPermitidoEnRevision, esCorreoDeEjemplo, esCorreoDeRevision, esCuentaDeRevision,
  negocioDeRevisionLimpio, revisionPuedeEscribir, sesionDeRevisionVigente,
} from '../lib/cuenta-revision-reglas';
import { AMRS, decidirTrasGoogle, requiereSegundoFactor } from '../lib/mfa-reglas';
import { OWNER_WS, WS_DISENO, WS_PRUEBAS, crearPreauth, crearToken, verificarPreauth, verificarToken } from '../lib/auth-session';

process.env.AUTH_SECRET = 'secreto-de-prueba-de-la-revision-tienda-0123456789';
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const LA = { email: CUENTA_DE_REVISION.email, workspace_id: WS_REVISION, rol: 'usuario', rol_ws: 'closer' };

test('1. es ESE correo, exacto, en SU negocio: no el de prueba, no el de diseño, no el ws 1', () => {
  assert.equal(CUENTA_DE_REVISION.ws, WS_REVISION);
  assert.ok(!WS_PRUEBAS.includes(WS_REVISION), 'el negocio de prueba no es un lugar fijo: «Datos de Mau» y «simular» escriben ahí');
  assert.notEqual(WS_REVISION, OWNER_WS);
  assert.notEqual(WS_REVISION, WS_DISENO);
  assert.equal(esCuentaDeRevision(LA), true);
  for (const email of [' REVISION-tiendas@HOLA-mako.com ', 'revision-tiendas@hola-maKo.com', 'revision-tiendas@hola-mako.com ', 'Revision-tiendas@hola-mako.com']) {
    assert.equal(esCorreoDeRevision(email), false, `«${email}»: el correo se compara exacto`);
    assert.equal(esCuentaDeRevision({ ...LA, email }), false, email);
  }
});

test('2. cualquier otro usuario o negocio sigue pidiendo el segundo factor', () => {
  for (const otro of [
    { ...LA, email: 'otra@hola-mako.com' }, { ...LA, email: `x${CUENTA_DE_REVISION.email}` }, { ...LA, email: `${CUENTA_DE_REVISION.email}.evil.com` },
    { ...LA, workspace_id: 1 }, { ...LA, workspace_id: 3 }, { ...LA, workspace_id: 9 }, { ...LA, workspace_id: null },
    { ...LA, workspace_id: String(WS_REVISION) as unknown as number },
    { ...LA, rol: 'admin' }, { ...LA, rol: null }, { ...LA, rol_ws: 'admin' }, { ...LA, rol_ws: null }, { ...LA, rol_ws: 'setter' },
    { email: null, workspace_id: WS_REVISION, rol: 'usuario', rol_ws: 'closer' }, {}, null, undefined,
  ]) {
    assert.equal(esCuentaDeRevision(otro), false, JSON.stringify(otro));
  }
  // Y la regla general no se enteró: un negocio que lo exige, lo exige.
  assert.equal(requiereSegundoFactor('usuario', false, '2026-10-21T00:00:00Z', Date.UTC(2026, 10, 3)), true);
  assert.equal(decidirTrasGoogle({ rol: 'usuario', mfaActivo: true, tieneFila: true, dispositivoValido: false }), 'segundo-factor');
});

test('3. la sesión vale después del último cambio de contraseña, y sin fecha no vale', () => {
  const cambio = '2026-11-03T12:00:00.000Z';
  const t = Date.parse(cambio) / 1000;
  assert.equal(sesionDeRevisionVigente(t + 60, cambio), true);
  assert.equal(sesionDeRevisionVigente(t - 60, cambio), false, 'una cookie de antes de rotar');
  assert.equal(sesionDeRevisionVigente(t + 60, null), false, 'sin contraseña que comparar');
  assert.equal(sesionDeRevisionVigente(t + 60, 'cualquier cosa'), false);
  assert.equal(sesionDeRevisionVigente(undefined, cambio), false, 'sin fecha en el token');
  assert.ok(DIAS_SESION_REVISION <= 7);
});

test('4. la marca `revision` vale firmada en un usuario común; a un admin y al paso intermedio no les sirve', () => {
  assert.ok(AMRS.includes('revision'));
  const comun = verificarToken(crearToken({ sub: '77', email: LA.email, nombre: 'R', rol: 'usuario', mfa: 'revision' }, DIAS_SESION_REVISION));
  assert.equal(comun?.mfa, 'revision');
  assert.ok((comun!.exp - comun!.iat!) <= DIAS_SESION_REVISION * 86_400, 'la cookie vive lo que pide la cuenta');
  assert.equal(verificarToken(crearToken({ sub: '1', email: 'a@b.test', nombre: 'A', rol: 'admin', mfa: 'revision' })), null, 'un admin con la marca');
  assert.equal(verificarPreauth(crearPreauth({ sub: '77', email: LA.email, nombre: 'R', rol: 'usuario', next: '/inicio', mfa: 'revision' })), null, 'el paso intermedio con la marca');
});

test('5. lo que escribe y lo que manda: una lista de lo permitido, exacta; y al equipo, sólo al equipo', () => {
  for (const m of ['GET', 'HEAD', 'OPTIONS', 'get']) assert.equal(revisionPuedeEscribir('/api/whatsapp/evolution/mensajes', m), true, `leer (${m})`);
  for (const r of ['/api/m/mako', '/api/mako/chat', '/api/ia-permiso', '/api/soporte/reportar', '/api/cuenta/eliminar', '/api/m/mako/']) {
    assert.equal(revisionPuedeEscribir(r, 'POST'), true, r);
  }
  for (const r of ['/api/m/mako/otra', '/api/mako/chat/x', '/api/mako', '/api/whatsapp/evolution/mensajes', '/api/chats/email', '/api/compartir',
    '/api/competitor-spy/competidores', '/api/ia-pc/codigo', '/customer-success', '/newsletters', '/', '/api/errores']) {
    assert.equal(revisionPuedeEscribir(r, 'POST'), false, r);
  }
  assert.equal(revisionPuedeEscribir('/api/m/mako', 'POST', true), false, 'una server action, con la ruta que sea');
  assert.equal(revisionPuedeEscribir('/crm', 'GET', true), false, 'con `next-action`, aunque sea GET');

  const EQUIPO = 'equipo@hola-mako.com';
  assert.equal(envioPermitidoEnRevision('email', EQUIPO, EQUIPO), true);
  assert.equal(envioPermitidoEnRevision('email', [EQUIPO], 'Equipo@Hola-MaKo.com'), true);
  assert.equal(envioPermitidoEnRevision('email', [EQUIPO, 'otra@persona.test'], EQUIPO), false, 'un tercero colado en la lista');
  assert.equal(envioPermitidoEnRevision('email', 'otra@persona.test', EQUIPO), false);
  assert.equal(envioPermitidoEnRevision('email', [], EQUIPO), false);
  assert.equal(envioPermitidoEnRevision('email', EQUIPO, ''), false, 'sin casilla del equipo, nada');
  assert.equal(envioPermitidoEnRevision('whatsapp', EQUIPO, EQUIPO), false, 'WhatsApp, nunca');
});

test('6. su negocio, limpio: lo que no se pudo contar no es cero', () => {
  assert.deepEqual(negocioDeRevisionLimpio({ lineas: 0, credenciales: 0, cartera: 0 }), { limpio: true });
  assert.equal(negocioDeRevisionLimpio({ lineas: 1, credenciales: 0, cartera: 0 }).limpio, false);
  assert.equal(negocioDeRevisionLimpio({ lineas: 0, credenciales: 2, cartera: 0 }).limpio, false);
  assert.equal(negocioDeRevisionLimpio({ lineas: 0, credenciales: 0, cartera: 1 }).limpio, false);
  const noSe = negocioDeRevisionLimpio({ lineas: null, credenciales: 0, cartera: 0 });
  assert.equal(noSe.limpio, false);
  assert.match(noSe.limpio ? '' : noSe.falta.join(' '), /no pude contar/);
  assert.equal(esCorreoDeEjemplo('ana@example.com'), true);
  for (const e of ['ana@example.com.mx', 'ana@cliente.com', null, '', 'ana@sub.example.com']) assert.equal(esCorreoDeEjemplo(e), false, String(e));
});

test('7. ninguna variable de entorno prende la excepción (es una regla del módulo: sumar otra cuenta pasa por una revisión)', () => {
  const src = readFileSync(join(RAIZ, 'lib', 'cuenta-revision-reglas.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(src, /process\.env/);
});
