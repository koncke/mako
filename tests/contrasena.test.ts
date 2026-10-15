// =============================================================================
// La contraseña de MaKo: obligatoria, alternativa a Google, nunca un paso más (15/10/2026)
// =============================================================================
// Decisión de Martín, textual: «Si, para mí también debería ser obligatorio tenerlo, como todos.
// Pero si inicio con Google no debería pedirme la contraseña también.» Y la fecha: la misma que el
// 2FA (21/10), con el factor PRIMERO y la contraseña después, una pantalla cada una.
//
// Lo que se fija:
//   · la política, el hash (scrypt con sus parámetros) y cuándo se exige crearla;
//   · el paso intermedio firmado con «el factor ya pasó» (y que no se pueda inventar);
//   · las puertas, leídas del fuente: el segundo paso no abre la sesión sin la contraseña, el
//     dispositivo recordado salta el código pero no la contraseña, entrar con contraseña toma la
//     MISMA decisión que Google, el freno no comparte cupo con el del 2FA, Seguridad pide un código
//     fresco, y el correo de cada propósito.
//
// Probado ROMPIÉNDOLO (15/10/2026); los números, en ROTURAS al final.
//
// Correr: node --import tsx --test tests/contrasena.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

process.env.AUTH_SECRET = 'secreto-de-prueba-de-la-contrasena-0123456789';

import { problemaDeContrasena, hashContrasena, verificarContrasena, requiereCrearContrasena, MAX_CONTRASENA } from '../lib/contrasena-reglas';
import { crearPreauth, verificarPreauth } from '../lib/auth-session';
import { esPublica } from '../lib/rutas-publicas';

const raiz = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** El cuerpo de una función de nivel 0, hasta la `}` que cierra en la columna 0. */
function cuerpo(src: string, firma: string): string {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré ${firma}`);
  const fin = src.indexOf('\n}\n', i);
  assert.ok(fin > i, `no pude recortar ${firma}`);
  return src.slice(i, fin);
}

test('la política: largo, el correo, lo repetido', () => {
  assert.match(problemaDeContrasena('corta', 'a@b.com') ?? '', /12 caracteres/);
  assert.match(problemaDeContrasena('x'.repeat(MAX_CONTRASENA + 1) + 'ab', 'a@b.com') ?? '', /128/);
  assert.match(problemaDeContrasena('martinkoncke2026!!', 'martinkoncke@gmail.com') ?? '', /correo/);
  assert.match(problemaDeContrasena('MartinKoncke@gmail.com', 'martinkoncke@gmail.com') ?? '', /correo/);
  assert.match(problemaDeContrasena('aaaaaaaaaaaaaaab', 'x@y.com') ?? '', /predecible/);
  assert.equal(problemaDeContrasena('caballo-bateria-grapa', 'x@y.com'), null);
  assert.match(problemaDeContrasena(undefined, 'x@y.com') ?? '', /Escribe/);
});

test('el hash: scrypt con sus parámetros, verifica lo suyo y nada más', async () => {
  const h = await hashContrasena('caballo-bateria-grapa');
  assert.match(h, /^scrypt\$15\$8\$1\$[\w-]+\$[\w-]+$/);
  assert.notEqual(h, await hashContrasena('caballo-bateria-grapa'), 'sin sal: dos hashes iguales');
  assert.equal(await verificarContrasena('caballo-bateria-grapa', h), true);
  assert.equal(await verificarContrasena('caballo-bateria-grapA', h), false);
  assert.equal(await verificarContrasena('caballo-bateria-grapa', 'plano'), false, 'un hash con otra forma coincide');
  assert.equal(await verificarContrasena('caballo-bateria-grapa', 'scrypt$40$8$1$a$b'), false, 'parámetros absurdos');
  assert.equal(await verificarContrasena('x'.repeat(MAX_CONTRASENA + 5), h), false);
  // Un hash guardado con un `p` enorme (dato roto o plantado) no puede poner a calcular al server: el
  // tope de parámetros contesta «no» sin correr scrypt. Sin el tope, esto son ~8 segundos.
  const partes = h.split('$');
  const caro = ['scrypt', 15, 8, 64, partes[4], partes[5]].join('$');
  const t0 = Date.now();
  assert.equal(await verificarContrasena('caballo-bateria-grapa', caro), false);
  assert.ok(Date.now() - t0 < 1000, `un p=64 tardó ${Date.now() - t0} ms: el tope de parámetros no frena`);
});

test('cuándo se exige crearla: desde la fecha del 2FA, sólo a quien no la tiene, y nunca por un error nuestro', () => {
  const corte = '2026-10-22T07:00:00.000Z';
  const antes = Date.parse('2026-10-22T06:00:00.000Z');
  const despues = Date.parse('2026-10-22T08:00:00.000Z');
  assert.equal(requiereCrearContrasena(false, corte, despues), true);
  assert.equal(requiereCrearContrasena(false, corte, antes), false, 'antes de la fecha');
  assert.equal(requiereCrearContrasena(true, corte, despues), false, 'ya la tiene');
  assert.equal(requiereCrearContrasena(null, corte, despues), false, 'un error NUESTRO deja afuera');
  assert.equal(requiereCrearContrasena(false, null, despues), false, 'sin fecha en el negocio');
});

test('el paso intermedio lleva «el factor ya pasó» FIRMADO, y no se puede inventar uno', () => {
  const base = { sub: '1', email: 'a@b.com', nombre: 'A', rol: 'admin' as const, next: '/inicio' };
  const p = verificarPreauth(crearPreauth({ ...base, mfa: 'totp', recordar: true }));
  assert.equal(p?.mfa, 'totp');
  assert.equal(p?.recordar, true);
  assert.equal(verificarPreauth(crearPreauth(base))?.mfa, undefined);
  // Un valor fuera de la lista no es un paso intermedio.
  assert.equal(verificarPreauth(crearPreauth({ ...base, mfa: 'magia' as never })), null);
  // Y no se le agrega a mano a uno firmado sin él.
  const t = crearPreauth(base)!;
  const [v, payload, firma] = t.split('.');
  const otro = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url').toString()), mfa: 'totp' })).toString('base64url');
  assert.equal(verificarPreauth(`${v}.${otro}.${firma}`), null, 'el factor se agrega sin firma');
});

test('el segundo paso NO abre la sesión sin la contraseña, y crearla exige el factor ya pasado', () => {
  const r = sinComentarios(leer('app/api/auth/2fa/route.ts'));
  const e = cuerpo(r, 'async function entrar(');
  const corte = e.indexOf('if (!extra.saltarContrasena && requiereCrearContrasena(await tieneContrasena(q.id), await obligatorioDesdeDe(q.ws))) {');
  assert.ok(corte >= 0, 'entrar() no mira la contraseña');
  assert.ok(corte < e.indexOf('ponerSesion('), 'la sesión se abre antes de mirar la contraseña');
  assert.match(e.slice(corte, e.indexOf('ponerSesion(')), /falta: 'contrasena'[\s\S]*ponerPreauth\(res, pre\);[\s\S]*return res;/);
  const ini = r.indexOf("if (accion === 'crear-contrasena') {");
  const crear = r.slice(ini, r.indexOf('const e = await estadoMfa(q.id);', ini));
  assert.ok(ini >= 0 && crear.length > 100 && crear.length < 1500, `el recorte de crear-contrasena mide ${crear.length}`);
  assert.match(crear, /if \(!q\.pre\.mfa\) return no\('Primero el segundo paso\.'\);/, 'se crea la contraseña sin haber pasado el factor');
  assert.match(crear, /if \(!r\.ok && !r\.nuestro\) return no\(r\.error\);/);
  assert.match(crear, /return entrar\(req, q, q\.pre\.mfa, \{ recordar: q\.pre\.recordar, saltarContrasena: true \}\);/);
  assert.equal(r.split('saltarContrasena: true').length - 1, 1, 'otro camino se saltea la contraseña');
});

test('el dispositivo recordado salta el CÓDIGO, no la contraseña (callback de Google)', () => {
  const cb = sinComentarios(leer('app/api/auth/callback/google/route.ts'));
  const chequeo = cb.indexOf('if (usuario.id > 0 && requiere && requiereCrearContrasena(await tieneContrasena(usuario.id), obligatorioDesde)) {');
  assert.ok(chequeo >= 0, 'el callback no mira la contraseña');
  const sesion = cb.indexOf("if (usuario.id > 0) await registrarLogin(email, { nombre: ui.name, foto_url: ui.picture });");
  assert.ok(chequeo < sesion, 'la sesión directa se abre antes de mirar la contraseña');
  assert.match(cb.slice(chequeo, sesion), /mfa: 'dispositivo'[\s\S]*\/login\/2fa/);
});

test('entrar con contraseña es el MISMO primer factor que Google: misma decisión, mismo segundo paso', () => {
  assert.equal(esPublica('/api/auth/contrasena'), true, 'el proxy la corta antes de que se autentique sola');
  const r = sinComentarios(leer('app/api/auth/contrasena/route.ts'));
  const post = cuerpo(r, 'export async function POST(');
  assert.match(post, /^export async function POST\(req: NextRequest\) \{\s*if \(!origenValido\(req\)\) return no\('origen no permitido', 403\);/, 'sin chequear el Origin');
  const comprobar = post.indexOf('await comprobarContrasena(body.email, body.contrasena)');
  const decision = post.indexOf('decidirTrasGoogle({');
  assert.ok(comprobar >= 0 && decision > comprobar, 'decide sin comprobar la contraseña');
  assert.match(post, /requiereSegundoFactor\(usuario\.rol, mfaActivo, obligatorioDesde\)/);
  assert.match(post.slice(decision, decision + 200), /obligatorioDesde \}\)/, 'la decisión no ve la fecha del negocio');
  assert.ok(post.indexOf('ponerSesion(') > post.indexOf("if (decision === 'segundo-factor') {"), 'abre la sesión antes del segundo paso');
});

test('el freno de la contraseña no comparte cupo con el del 2FA, y la respuesta no cuenta qué correos existen', () => {
  const c = sinComentarios(leer('lib/contrasena.ts'));
  assert.match(c, /const TIPO_INTENTO_CONTRASENA = 'intento-contrasena';/);
  const f = cuerpo(c, 'async function intentarContrasena(');
  assert.doesNotMatch(f, /'intento'\)/, 'cuenta en el cupo del 2FA');
  assert.ok(f.indexOf('.insert(') < f.indexOf("{ count: 'exact'"), 'cuenta antes de anotar');
  const comprobar = cuerpo(c, 'export async function comprobarContrasena(');
  assert.match(comprobar, /await verificarContrasena\(clave, await hashDeRelleno\(\)\);\s*return \{ ok: false, error: MENSAJE_NO_COINCIDE, status: 401 \};/, 'un correo que no existe contesta distinto o más rápido');
  assert.equal(comprobar.split('MENSAJE_NO_COINCIDE').length - 1, 2, 'hay otra respuesta para «no coincide»');
});

test('Seguridad: crear o cambiar la contraseña pide un código fresco, con su freno', () => {
  const s = sinComentarios(leer('app/api/perfil/seguridad/route.ts'));
  const c = s.slice(s.indexOf("case 'contrasena-guardar': {"), s.indexOf("case 'codigos-generar': {"));
  const intento = c.indexOf("await intentar(uid, 'contrasena-totp')");
  const totp = c.indexOf("await verificarTotpLogin(uid, String(body.codigo ?? ''))");
  const guarda = c.indexOf('await guardarContrasena(uid, body.nueva, s.email)');
  assert.ok(intento >= 0 && totp > intento && guarda > totp, 'guarda sin código fresco, o prueba el código sin freno');
});

test('a qué correo va cada propósito, y la tabla nace cerrada', () => {
  const d = sinComentarios(leer('lib/destino-usuario.ts'));
  assert.match(d, /if \(proposito === 'codigo'\) \{[\s\S]*from\('usuario_mfa'\)\.select\('email_respaldo, email_activo'\)[\s\S]*f\?\.email_activo && f\.email_respaldo \? f\.email_respaldo : null/,
    'el código por correo no va al respaldo verificado');
  assert.match(d, /proposito === 'restablecer' && u\.estado === 'suspendido'/, 'a una cuenta suspendida le llega un link para entrar');
  const m = leer('supabase/migrations/0286_contrasena.sql');
  assert.match(m, /alter table usuario_contrasena enable row level security;/);
  assert.match(m, /revoke all on usuario_contrasena from anon, authenticated;/);
});

// ROTURAS (15/10/2026), una por vez y restaurando de memoria. Base: 10 pases, 0 fallos. Cada una → 9 / 1:
//   · la política sin el chequeo del correo        · el hash con sal fija
//   · verificar sin el tope de parámetros (p=64)    · exigir crearla con «no pude leer»
//   · el paso intermedio aceptando cualquier `mfa`  · entrar() sin mirar la contraseña
//   · crearla sin el factor pasado                  · un error de la persona dejándola entrar
//   · el dispositivo recordado salteando la contraseña · entrar con contraseña sin el Origin
//   · la contraseña sin la fecha del negocio        · el freno en el cupo del 2FA
//   · un correo inexistente contestando rápido      · Seguridad sin el código fresco
//   · el código por correo yendo al correo de la cuenta
//   (La del tope de parámetros pasaba en VERDE con el primer caso, `scrypt$40$8$1$a$b`, que ya era
//   inválido por el largo del hash: se agregó el de p=64 con un hash bien formado, que mide el tiempo.)
//   Restaurado: 10 / 0.
