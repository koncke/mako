// =============================================================================
// El segundo factor del login: las reglas, el token y las puertas
// =============================================================================
// Pedido de Martín (13/10/2026): 2FA en el login de MaKo, obligatorio para el super admin,
// y «que el proxy y las rutas públicas no dejen una puerta sin el segundo factor».
//
// Lo que se fija acá, sin base:
//   · el TOTP contra los vectores de la RFC 6238 (si el algoritmo está mal, ninguna app
//     de autenticación coincide y el super admin queda afuera);
//   · un token de admin SIN segundo factor no es una sesión — ni para el proxy ni para
//     `verificarToken`;
//   · el paso intermedio (`mako_preauth`) no sirve como sesión, y una sesión no sirve como
//     paso intermedio;
//   · el proxy niega una ruta protegida sin sesión, con un admin sin segundo factor y con
//     sólo el paso intermedio;
//   · la decisión después de Google, el correo de respaldo distinto del de entrar y el
//     dominio de las passkeys;
//   · la ruta del segundo paso lee SÓLO el paso intermedio y chequea el Origin ella misma.
//
// Probado ROMPIÉNDOLO (13/10/2026), una rotura por vez y restaurando:
//   · `codigoTotp` con 'sha256' en vez de 'sha1' → 1 fallo, 10 pases (los vectores de la RFC).
//   · sacando `if (s.rol === 'admin' && !s.mfa) return null;` de verificarToken → 2 fallos
//     (el token y el proxy con el admin sin segundo factor), 9 pases.
//   · firmando el paso intermedio sin el prefijo 'preauth:' (al firmar y al leer) → 1 fallo, 10 pases.
//   · `decidirTrasGoogle` devolviendo 'sesion' sin fila → 1 fallo.
//   · `validarEmailRespaldo` sin la comparación con el de entrar → 1 fallo.
//   · `relyingParty` aceptando cualquier host → 1 fallo.
//   · la ruta /api/auth/2fa cayendo a SESSION_COOKIE si no hay paso intermedio → 1 fallo (el guard del fuente).
// Con todo restaurado: 11 pases, 0 fallos.
//
// Tanda 1 (14/10/2026, chat «Ciberseguridad»): WhatsApp y correo APAGADOS hasta que salgan
// por una automatización del SuperAdmin, y /perfil/seguridad para todos los roles. Rotos:
//   · CANALES_CODIGO con 'whatsapp' adentro → 1 fallo (los canales).
//   · un `sendEmail(` de vuelta en lib/mfa.ts → 1 fallo (sin emisor propio).
//   · `enviarCodigo` sin el corte de `canalDisponible` al principio → 1 fallo (sin emisor propio).
//   · la ruta del segundo paso sin `canalDisponible` antes de `enviarCodigo` → 1 fallo (las puertas).
//   · /perfil/seguridad con `requireRolWs([])` de vuelta → 1 fallo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';

process.env.AUTH_SECRET = 'secreto-de-prueba-del-segundo-factor-0123456789';

import {
  crearToken, verificarToken, crearPreauth, verificarPreauth, SESSION_COOKIE, PREAUTH_COOKIE,
} from '../lib/auth-session';
import {
  codigoTotp, verificarTotp, base32Encode, pasoTotp, decidirTrasGoogle, requiereSegundoFactor,
  validarEmailRespaldo, relyingParty, puedeEnrolarSinSesion, normalizarCodigoRecuperacion,
  generarCodigosRecuperacion, hmacCodigo, igualSeguro, CANALES_CODIGO, canalDisponible,
} from '../lib/mfa-reglas';
import { esPublica, esPublicaSoloLeer } from '../lib/rutas-publicas';
import { proxy } from '../proxy';

const raiz = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// ── TOTP ─────────────────────────────────────────────────────────────────────

// RFC 6238, apéndice B: secreto ASCII «12345678901234567890», SHA1, 8 dígitos.
const SECRETO_RFC = base32Encode(Buffer.from('12345678901234567890', 'ascii'));

test('TOTP: los vectores de la RFC 6238 (SHA1)', () => {
  assert.equal(SECRETO_RFC, 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  const casos: [number, string][] = [
    [59, '94287082'], [1111111109, '07081804'], [1111111111, '14050471'],
    [1234567890, '89005924'], [2000000000, '69279037'],
  ];
  for (const [t, esperado] of casos) assert.equal(codigoTotp(SECRETO_RFC, pasoTotp(t * 1000), 8), esperado, `T=${t}`);
});

test('TOTP: ventana de ±1 paso, formato y anti-reuso', () => {
  const ahora = 1234567890 * 1000;
  const paso = pasoTotp(ahora);
  const actual = codigoTotp(SECRETO_RFC, paso);
  assert.equal(verificarTotp(SECRETO_RFC, actual, { ahoraMs: ahora }).ok, true);
  assert.equal(verificarTotp(SECRETO_RFC, codigoTotp(SECRETO_RFC, paso - 1), { ahoraMs: ahora }).ok, true, 'el anterior vale');
  assert.equal(verificarTotp(SECRETO_RFC, codigoTotp(SECRETO_RFC, paso - 3), { ahoraMs: ahora }).ok, false, 'uno viejo no');
  assert.equal(verificarTotp(SECRETO_RFC, '12345', { ahoraMs: ahora }).ok, false);
  assert.equal(verificarTotp(SECRETO_RFC, 'abcdef', { ahoraMs: ahora }).ok, false);
  // Un código ya aceptado (su paso ya se usó) no vale una segunda vez.
  assert.equal(verificarTotp(SECRETO_RFC, actual, { ahoraMs: ahora, ultimoPaso: paso }).ok, false);
});

// ── El token ─────────────────────────────────────────────────────────────────

const ADMIN = { sub: '7', email: 'admin@x.com', nombre: 'Admin', rol: 'admin' as const };
const USUARIO = { sub: '8', email: 'u@x.com', nombre: 'U', rol: 'usuario' as const };

test('un token de admin SIN segundo factor no es una sesión', () => {
  assert.equal(verificarToken(crearToken(ADMIN)), null);
  assert.ok(verificarToken(crearToken({ ...ADMIN, mfa: 'totp' })));
  assert.ok(verificarToken(crearToken({ ...ADMIN, mfa: 'passkey' })));
  // Un usuario común sin 2FA sí entra: para él es opcional.
  assert.ok(verificarToken(crearToken(USUARIO)));
  // Un `mfa` inventado no vale.
  assert.equal(verificarToken(crearToken({ ...ADMIN, mfa: 'inventado' as never })), null);
});

test('el paso intermedio no es una sesión, y una sesión no es un paso intermedio', () => {
  const pre = crearPreauth({ ...ADMIN, next: '/crm' })!;
  assert.ok(pre.startsWith('p1.'));
  assert.ok(verificarPreauth(pre));
  assert.equal(verificarToken(pre), null);
  // Con el prefijo cambiado a mano tampoco: la firma lleva el 'preauth:' adentro.
  assert.equal(verificarToken(pre.replace(/^p1\./, 'v1.')), null);
  const ses = crearToken({ ...ADMIN, mfa: 'totp' })!;
  assert.equal(verificarPreauth(ses), null);
  assert.equal(verificarPreauth(ses.replace(/^v1\./, 'p1.')), null);
  // El destino del paso intermedio pasa por el mismo saneo que el login.
  assert.equal(verificarPreauth(crearPreauth({ ...ADMIN, next: '//evil.com' }))!.next, '/inicio');
});

// ── El proxy ─────────────────────────────────────────────────────────────────

const pedido = (ruta: string, cookies: Record<string, string> = {}) => new NextRequest(`http://localhost${ruta}`, {
  headers: { host: 'localhost', cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ') },
});
const negado = (r: Response) => r.status === 401 || (r.status === 307 && (r.headers.get('location') ?? '').includes('/login'));

test('el proxy no deja pasar sin el segundo factor', () => {
  for (const ruta of ['/crm', '/admin', '/api/crm/leads']) {
    assert.ok(negado(proxy(pedido(ruta))), `${ruta} sin sesión`);
    assert.ok(negado(proxy(pedido(ruta, { [SESSION_COOKIE]: crearToken(ADMIN)! }))), `${ruta} con admin sin 2FA`);
    assert.ok(negado(proxy(pedido(ruta, { [PREAUTH_COOKIE]: crearPreauth({ ...ADMIN, next: '/' })! }))), `${ruta} sólo con el paso intermedio`);
    assert.ok(negado(proxy(pedido(ruta, { [SESSION_COOKIE]: crearPreauth({ ...ADMIN, next: '/' })! }))), `${ruta} con el paso intermedio puesto como sesión`);
  }
  // Y con el segundo factor, pasa.
  assert.ok(!negado(proxy(pedido('/admin', { [SESSION_COOKIE]: crearToken({ ...ADMIN, mfa: 'totp' })! }))));
});

// ── Las reglas ───────────────────────────────────────────────────────────────

test('quién necesita segundo factor y qué pasa después de Google', () => {
  assert.equal(requiereSegundoFactor('admin', false), true);
  assert.equal(requiereSegundoFactor('usuario', false), false);
  assert.equal(requiereSegundoFactor('usuario', true), true);
  const base = { rol: 'admin', mfaActivo: false, tieneFila: true, dispositivoValido: false };
  assert.equal(decidirTrasGoogle(base), 'segundo-factor');
  assert.equal(decidirTrasGoogle({ ...base, dispositivoValido: true }), 'sesion');
  // Sin fila (la base caída y el admin del respaldo): no entra, ni con dispositivo.
  assert.equal(decidirTrasGoogle({ ...base, tieneFila: false }), 'bloquear');
  assert.equal(decidirTrasGoogle({ ...base, tieneFila: false, dispositivoValido: true }), 'bloquear');
  assert.equal(decidirTrasGoogle({ ...base, rol: 'usuario' }), 'sesion');
  assert.equal(decidirTrasGoogle({ ...base, rol: 'usuario', mfaActivo: true }), 'segundo-factor');
  // Enrolar sin sesión completa, sólo si no tiene NINGÚN método.
  assert.equal(puedeEnrolarSinSesion(0), true);
  assert.equal(puedeEnrolarSinSesion(1), false);
});

test('el correo de respaldo no puede ser el mismo con el que se entra', () => {
  assert.equal(validarEmailRespaldo('Admin@X.com ', 'admin@x.com').ok, false);
  assert.equal(validarEmailRespaldo('otro@x.com', 'admin@x.com').ok, true);
  assert.equal(validarEmailRespaldo('no-es-correo', 'admin@x.com').ok, false);
});

test('las passkeys sólo en el dominio de MaKo o en localhost', () => {
  assert.deepEqual(relyingParty('hola-mako.com', 'hola-mako.com')?.rpID, 'hola-mako.com');
  assert.deepEqual(relyingParty('www.hola-mako.com', 'hola-mako.com')?.rpID, 'hola-mako.com');
  assert.equal(relyingParty('localhost:3000', 'hola-mako.com')?.rpID, 'localhost');
  for (const h of ['evil.com', 'hola-mako.com.evil.com', 'dashboard-marketing.vercel.app', '']) {
    assert.equal(relyingParty(h, 'hola-mako.com'), null, h);
  }
});

test('códigos de recuperación: diez, distintos, y se comparan normalizados', () => {
  const c = generarCodigosRecuperacion(10);
  assert.equal(c.length, 10);
  assert.equal(new Set(c).size, 10);
  for (const x of c) assert.match(x, /^[a-z0-9]{5}-[a-z0-9]{5}$/);
  const k = 'llave';
  assert.ok(igualSeguro(hmacCodigo(normalizarCodigoRecuperacion(c[0].toUpperCase().replace('-', ' ')), k), hmacCodigo(normalizarCodigoRecuperacion(c[0]), k)));
});

// ── Las puertas, en el fuente ────────────────────────────────────────────────

test('/api/auth/2fa lee sólo el paso intermedio y chequea el Origin antes de todo', () => {
  const src = sinComentarios(leer('app/api/auth/2fa/route.ts'));
  assert.doesNotMatch(src, /SESSION_COOKIE|getUsuarioActual|mako_session/, 'no puede leer la sesión');
  assert.match(src, /PREAUTH_COOKIE/);
  const post = src.slice(src.indexOf('export async function POST'));
  assert.ok(post.indexOf('origenValido(req)') > -1 && post.indexOf('origenValido(req)') < post.indexOf('quien(req)'), 'el Origin va primero');
  // Enrolar sin sesión, sólo sin métodos: la guarda tiene que estar antes del primer enrolar.
  assert.ok(post.indexOf("accion.startsWith('enrolar-') && !sinFactores") < post.indexOf("'enrolar-totp-iniciar'"));
  // Un POST sin Origin no pasa (el proxy lo dejaría pasar: lo trata como server-to-server).
  assert.match(src, /if \(!origin\) return false;/);
});

test('activar el 2FA desde el perfil reemite la sesión con el método', () => {
  const src = sinComentarios(leer('app/api/perfil/seguridad/route.ts'));
  assert.match(src, /if \(!s\.mfa\) ponerSesion\(res, \{[^}]*mfa \}\)/);
});

// ── Tanda 1: los códigos por WhatsApp y correo, APAGADOS ─────────────────────

test('ningún canal manda códigos todavía', () => {
  assert.deepEqual([...CANALES_CODIGO], []);
  assert.equal(canalDisponible('whatsapp'), false);
  assert.equal(canalDisponible('email'), false);
  // La regla en sí: con el canal en la lista, sí.
  assert.equal(canalDisponible('email', ['email']), true);
});

test('lib/mfa.ts no tiene un emisor propio, y corta antes de crear un desafío', () => {
  const src = sinComentarios(leer('lib/mfa.ts'));
  // El código sale en la tanda 2 por una automatización del SuperAdmin; nunca por acá, y
  // nunca por `emitirAviso` (lo copiaría al feed, a un push y a la conversación del doer).
  assert.doesNotMatch(src, /sendEmail\(|enviarAPersonaMaKo\(|enviarTexto\w*\(|emitirAviso\(/);
  const ini = src.indexOf('export async function enviarCodigo');
  const cuerpo = src.slice(ini, src.indexOf('export async function verificarCodigo', ini));
  assert.ok(cuerpo.length > 0 && cuerpo.length < 3000, `recorte de enviarCodigo: ${cuerpo.length}`);
  const corte = cuerpo.indexOf('if (!canalDisponible(canal))');
  assert.ok(corte > 0 && corte < cuerpo.indexOf('crearDesafio('), 'el corte va antes del desafío');
});

test('las dos puertas preguntan por el canal antes de mandar', () => {
  const dosfa = sinComentarios(leer('app/api/auth/2fa/route.ts'));
  for (const accion of ["accion === 'enviar'", "accion === 'enrolar-codigo-enviar' || accion === 'enrolar-codigo-confirmar'"]) {
    const ini = dosfa.indexOf(accion);
    assert.ok(ini > 0, accion);
    const rama = dosfa.slice(ini, dosfa.indexOf('enviarCodigo(', ini));
    assert.match(rama, /canalDisponible\(canal\)/, `${accion}: sin el corte del canal`);
  }
  const perfil = sinComentarios(leer('app/api/perfil/seguridad/route.ts'));
  assert.ok(perfil.indexOf('canalDisponible(canalPedido)') > 0
    && perfil.indexOf('canalDisponible(canalPedido)') < perfil.indexOf("case 'codigo-enviar'"));
  // Y las dos le dicen a la pantalla qué canales hay.
  assert.match(dosfa, /canales: CANALES_CODIGO/);
  assert.match(perfil, /canales: CANALES_CODIGO/);
});

test('el segundo paso es una página pública que sólo se lee; su API sí escribe', () => {
  assert.ok(esPublica('/login/2fa'));
  assert.equal(esPublicaSoloLeer('/login/2fa'), true);
  assert.ok(esPublica('/api/auth/2fa'));
  assert.equal(esPublicaSoloLeer('/api/auth/2fa'), false);
});

test('/perfil/seguridad es de la persona, sea cual sea su rol', () => {
  const src = sinComentarios(leer('app/perfil/seguridad/page.tsx'));
  assert.doesNotMatch(src, /requireRolWs|requireCapa/);
  assert.match(src, /getUsuarioActual\(\)/);
});
