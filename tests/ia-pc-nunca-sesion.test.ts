// =============================================================================
// Emparejar la computadora NUNCA abre una cuenta de MaKo (25/10/2026)
// =============================================================================
// Martín, 25/10 ~12:00: «la app de desktop jamás me pidió login, eso esta muy mal, entró directo a la cuenta de Mauricio
// cuando yo estaba en mi cuenta de super admin». Medido (docs/hallazgos-seguridad.md): la ventana era una app web de Chrome
// instalada el 26/08 en el perfil de Chrome de Mauricio en esa PC, con la sesión de ese perfil. El emparejamiento de la IA no
// tuvo nada que ver, y este test lo deja fijo para que siga así:
//   1. el token de la PC (`mkopc_…`) y el del turno (`mkotn_…`) no son una sesión: `verificarToken` los rechaza;
//   2. ninguna ruta de /api/ia-pc toca una cookie ni arma una sesión, y lib/ia-pc.ts tampoco;
//   3. una sesión sólo la arman los logins (Google, contraseña, el segundo paso y la seguridad del perfil);
//   4. la sesión sale SÓLO de la cookie firmada: ni de un header, ni de la cookie compartida vieja (mako_auth).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

process.env.AUTH_SECRET = 'secreto-de-prueba-del-emparejamiento-0123456789';

import { crearToken, verificarToken } from '../lib/auth-session';
import { PREFIJO_TOKEN_PC, PREFIJO_TOKEN_TURNO } from '../lib/ia-pc-reglas';

const RAIZ = path.join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(path.join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const archivos = (dir: string): string[] => readdirSync(path.join(RAIZ, dir)).flatMap((f) => {
  const r = `${dir}/${f}`;
  return statSync(path.join(RAIZ, r)).isDirectory() ? archivos(r) : /\.(ts|tsx)$/.test(f) ? [r] : [];
});

test('1. el token de la PC y el del turno no son una sesión', () => {
  // La sesión de verdad sí pasa (el control: si esto fallara, el resto no probaría nada).
  const buena = crearToken({ sub: '7', email: 'ana@x.com', nombre: 'Ana', rol: 'usuario' });
  assert.ok(buena && verificarToken(buena), 'la sesión firmada no pasa: el test no mide nada');
  for (const prefijo of [PREFIJO_TOKEN_PC, PREFIJO_TOKEN_TURNO]) {
    const t = `${prefijo}${'A'.repeat(43)}`;
    assert.equal(verificarToken(t), null, `${prefijo} pasó como sesión`);
    assert.equal(verificarToken(`v1.${Buffer.from(JSON.stringify({ sub: '1', rol: 'admin', exp: 9e9 })).toString('base64url')}.${t}`), null, 'una firma inventada pasó');
  }
});

test('2. ninguna ruta de /api/ia-pc toca una cookie ni arma una sesión', () => {
  const rutas = archivos('app/api/ia-pc');
  assert.ok(rutas.length >= 10, `faltan rutas de /api/ia-pc: ${rutas.length}`);
  for (const r of [...rutas, 'lib/ia-pc.ts']) {
    const s = sinComentarios(leer(r));
    assert.doesNotMatch(s, /\bcookies\s*\(|\.cookies\.set\(|Set-Cookie|ponerSesion|crearToken|SESSION_COOKIE|sesion-cookies/, `${r} toca la sesión`);
  }
});

test('3. una sesión sólo la arman los logins', () => {
  const PUEDEN = new Set(['app/api/auth/2fa/route.ts', 'app/api/auth/callback/google/route.ts', 'app/api/auth/contrasena/route.ts', 'app/api/perfil/seguridad/route.ts']);
  const importan = [...archivos('app'), ...archivos('lib')].filter((r) => /from '@\/lib\/sesion-cookies'|from '\.\/sesion-cookies'/.test(sinComentarios(leer(r))));
  for (const r of importan) assert.ok(PUEDEN.has(r), `${r} arma sesiones y no es un login: si de verdad lo es, sumalo acá con su porqué`);
  // Y crearToken (la firma de una sesión) sólo lo usa quien arma la cookie, el dev-login local y las claves de la API (otro prefijo).
  const firman = [...archivos('app'), ...archivos('lib')].filter((r) => /\bcrearToken\(/.test(sinComentarios(leer(r))));
  for (const r of firman) assert.ok(['lib/auth-session.ts', 'lib/sesion-cookies.ts', 'app/api/auth/dev-login/route.ts', 'lib/api-mako/tokens.ts', 'app/api-mako/actions.ts'].includes(r), `${r} firma una sesión`);
});

test('4. la sesión sale sólo de la cookie firmada: ni de un header, ni de la cookie compartida vieja', () => {
  const auth = sinComentarios(leer('lib/auth.ts'));
  assert.match(auth, /const token = store\.get\(SESSION_COOKIE\)\?\.value;/);
  assert.doesNotMatch(auth, /LEGACY_COOKIE|mako_auth|authorization|bearer/i, 'la sesión sale de otro lado que la cookie firmada');
});
