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
import { execFileSync } from 'node:child_process';
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

// ⚠️ HASTA EL 4/11 ESTO ERA UN REGEX sobre la línea del `catch` (`return firmada;`), y se puso rojo con la decisión intacta: la cuenta de
// revisión de las tiendas (la única sesión sin segundo factor) cae con la base caída, y los demás siguen entrando. Ahora CORRE
// `getUsuarioActual` con la base caída y con la base andando (tests/_sesion-base-caida-hijo.ts) y mira lo que importa: quién sigue
// entrando y cuántas consultas cuesta cada sesión. Probado rompiéndolo: con el `catch` que devuelve null, rojo («el closer»); con una
// lectura de `sesiones_desde` para todos, rojo («una consulta de más»); renombrar una variable local de leerSesion, verde.
test('3. leerSesion falla abierta y no suma una consulta por pedido', () => {
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', raiz + 'tests/_sesion-base-caida-hijo.ts'], { cwd: raiz, encoding: 'utf8', timeout: 120_000 });
  const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length).trim().split('\n')[0]) as Record<string, { sesion: { email: string; mfa: string | null } | null; aLaBase: number }>;
  // Con la base caída, la sesión firmada sigue valiendo: un bache de Supabase no deja a los clientes sin sesión (3/11/2026).
  assert.equal(R.caidaCloser.sesion?.email, 'closer@otro.test', 'el closer: con la base caída la sesión firmada sigue valiendo');
  assert.equal(R.caidaAdmin.sesion?.mfa, 'totp', 'el admin con su segundo factor, igual');
  // La única excepción, escrita a propósito: la cuenta de revisión de las tiendas (lib/cuenta-revision-reglas.ts). Sin mirar su fila, no vale.
  assert.equal(R.caidaRevision.sesion, null);
  // Con la base andando, cada sesión cuesta lo de siempre: su fila, y la fecha del 2FA obligatorio sólo si la sesión no trae `mfa`.
  assert.equal(R.andaCloser.aLaBase, 2, 'una consulta de más por pedido en una sesión común (¿se volvió a leer el corte aparte?)');
  assert.equal(R.andaAdmin.aLaBase, 1, 'una consulta de más por pedido en una sesión con segundo factor');
  assert.equal(R.andaRevision.sesion?.mfa, 'revision');
  assert.equal(R.andaRevision.aLaBase, 2, 'la de revisión mira además cuándo cambió su contraseña, y nada más');
  assert.doesNotMatch(leer('lib/auth.ts'), /sesionesDesde|sesiones-revocadas/, 'leerSesion no lee el corte aparte (docs/hallazgos-seguridad.md)');
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
