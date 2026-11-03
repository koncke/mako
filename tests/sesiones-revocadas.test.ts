// Auditoría de seguridad del 01/11/2026: lo que cierra una sesión.
//  1. En Vercel, un token con `sub` que no es un id (o con el segundo factor `dev`) no vale: lo único
//     que los firma es el dev-login local, y en producción eran super admin por 30 días.
//  2. `sesiones_desde` cierra las sesiones firmadas antes del corte, y la que se vuelve a firmar en el
//     mismo segundo sigue valiendo.
//  3. `leerSesion` falla ABIERTA a propósito y no suma consultas (decidido el 03/11/2026: con un bache de
//     Supabase, «falla cerrada» deja a todos los clientes sin sesión). Eso deja el corte anotado y sin leer.
// Verificado rompiéndolo: sin la línea `enVercel() && …` de verificarToken el 1 da sesión; con el `catch`
// que devuelve null, o con el `sesionesDesde` de la nube en leerSesion, el 3 da rojo.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sesionRevocada, subDeFila } from '../lib/sesiones-revocadas-reglas';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const leer = (r: string) => readFileSync(raiz + r, 'utf8').replace(/\r\n/g, '\n');

test('1. verificarToken: en Vercel no acepta tokens sin fila ni con mfa dev', async () => {
  const { crearToken, verificarToken } = await import('../lib/auth-session');
  const antes = { AUTH_SECRET: process.env.AUTH_SECRET, VERCEL: process.env.VERCEL };
  process.env.AUTH_SECRET = 'x'.repeat(48);
  try {
    delete process.env.VERCEL;
    const dev = crearToken({ sub: 'dev', email: 'dev@local', nombre: 'Dev', rol: 'admin', ws: 1, mfa: 'dev' });
    const real = crearToken({ sub: '42', email: 'a@ejemplo.test', nombre: 'A', rol: 'admin', ws: 1, mfa: 'totp' });
    const conDev = crearToken({ sub: '42', email: 'a@ejemplo.test', nombre: 'A', rol: 'admin', ws: 1, mfa: 'dev' });
    assert.ok(verificarToken(dev), 'en local el dev-login sigue sirviendo');
    process.env.VERCEL = '1';
    assert.equal(verificarToken(dev), null, 'en Vercel un sub que no es un id no vale');
    assert.equal(verificarToken(conDev), null, 'ni el segundo factor dev');
    assert.ok(verificarToken(real), 'una sesión de una fila real sí');
  } finally {
    if (antes.AUTH_SECRET === undefined) delete process.env.AUTH_SECRET; else process.env.AUTH_SECRET = antes.AUTH_SECRET;
    if (antes.VERCEL === undefined) delete process.env.VERCEL; else process.env.VERCEL = antes.VERCEL;
  }
});

test('2. sesionRevocada', () => {
  const corte = '2026-11-01T12:00:00.500Z';
  const seg = Math.floor(Date.parse(corte) / 1000);
  assert.equal(sesionRevocada(seg - 1, corte), true, 'firmada antes del corte: cerrada');
  assert.equal(sesionRevocada(seg, corte), false, 'firmada en el mismo segundo (la que se vuelve a dar): vale');
  assert.equal(sesionRevocada(seg + 10, corte), false);
  assert.equal(sesionRevocada(undefined, corte), true, 'sin iat no se puede probar que es posterior');
  assert.equal(sesionRevocada(seg - 1000, null), false, 'sin corte no se cierra nada');
  assert.equal(sesionRevocada(seg, 'no es una fecha'), false);
  assert.equal(subDeFila('42'), true);
  assert.equal(subDeFila('dev'), false);
  assert.equal(subDeFila('password'), false);
  assert.equal(subDeFila(''), false);
});

test('3. leerSesion falla abierta y no suma una consulta por pedido', () => {
  const src = leer('lib/auth.ts');
  assert.match(src, /catch \{\s*return firmada;\s*\}/, 'con la base caída la sesión firmada sigue valiendo');
  assert.doesNotMatch(src, /sesionesDesde|sesiones-revocadas/, 'leerSesion no lee el corte aparte (docs/hallazgos-seguridad.md)');
});

test('4. cambiar o restablecer la contraseña anota el corte', () => {
  assert.match(leer('app/api/auth/restablecer/route.ts'), /await revocarSesiones\(l\.usuarioId\);/);
  const seg = leer('app/api/perfil/seguridad/route.ts');
  assert.match(seg, /after\(\(\) => avisarContrasenaCambiada\(uid\)\.then\(\(\) => undefined\)\);\n\s*\/\/[^\n]*\n\s*\/\/[^\n]*\n\s*return conSesionesCerradas\(uid, s\);/);
  assert.match(seg, /case 'sesiones-cerrar':/);
});

test('5. la cookie con el correo es HttpOnly y Google exige el correo verificado', () => {
  assert.match(leer('lib/sesion-cookies.ts'), /name: EMAIL_COOKIE, value: s\.email, httpOnly: true/);
  assert.match(leer('app/api/auth/callback/google/route.ts'), /ui\.email_verified !== true/);
});
