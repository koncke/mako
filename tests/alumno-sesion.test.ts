// =============================================================================
// alumno-sesion — el cliente que entra a SU curso sin ser usuario de MaKo
// =============================================================================
// «Al igual que en la vista de Agencia, se debería poder INVITAR al cliente a MaKo para que tenga
// acceso al curso» (Martín, 06/10/2026). La decisión, medida antes de escribir una línea: el alumno
// NUNCA recibe `mako_session` ni una fila en `usuarios` — con eso leía el CRM de Mauricio (el
// detalle, en lib/alumno-sesion.ts). Tiene su cookie `mako_alumno` y UNA ruta: /mi-curso.
//
// Lo que se EJECUTA: la firma (lib/alumno-sesion.ts), la decisión del proxy
// (lib/rutas-publicas.ts) y el PROXY DE VERDAD (`proxy(new NextRequest(...))`), más el logout y el
// gate del chrome. Lo que se LEE como fuente (sin comentarios): el callback de Google y
// lib/alumno-acceso.ts, porque los dos hablan con Google y con la base.
//
// Probado ROMPIÉNDOLO (06/10/2026) con scratchpad/u2/roturas.cjs, que rompe UNA regla por vez en
// una COPIA del árbol (proxy.ts y lib/rutas-publicas.ts los sirve el dev server compartido: romperlos
// en el clon tumba la app de las otras sesiones). Todo en su lugar: 16 pass / 0 fail. Cada rotura:
//   · la firma sin mirar el vencimiento                          → 15 / 1 «vence a los 30 días»
//   · el ws fuera del cuerpo firmado (al firmar y al leer)       → 15 / 1 «otro workspace no abre»
//   · la firma comparada por prefijo (acepta una recortada)      → 15 / 1 «la firma torcida…»
//     (la primera versión de este test daba 16 / 0 acá: sólo cambiaba un carácter. Se sumó la
//     firma recortada y la vacía.)
//   · la ruta del alumno por PREFIJO en vez de exacta            → 14 / 2
//   · cortar sólo `next-action` y no el POST de formulario       → 14 / 2
//   · el proxy sin la rama del alumno                            → 15 / 1 «deja pasar /mi-curso»
//   · el proxy sin el 403 de la acción                           → 15 / 1 «corta las acciones»
//   · /mi-curso metido en PUBLICOS                               → 13 / 3
//   · el logout sin borrar mako_alumno                           → 15 / 1 «salir borra…»
//   · el gate del chrome sin /mi-curso                           → 15 / 1 «sin el chrome»
//   · el callback buscando el alumno ANTES que usuarios          → 15 / 1 «el callback…»
//   · el callback dándole además una mako_session al alumno      → 15 / 1 «el callback…»
//   · el callback mandando al alumno a `oauth_next`              → 15 / 1 «el callback…»
//   · el acceso por email sin exigir invitacion_enviada_at       → 15 / 1 «el acceso por email…»
//   · curso_accesos consultado ANTES que usuarios                → 15 / 1 «el acceso por email…»
//   · el email por `.ilike` en vez de `.eq`                      → 15 / 1 «el acceso por email…»
// Restaurado: 16 / 0.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { firmarSesionAlumno, leerSesionAlumno, urlDeEntrada, ALUMNO_COOKIE, ALUMNO_DIAS } from '../lib/alumno-sesion';
import { firmarAccesoCurso, leerAccesoCurso } from '../lib/curso-acceso';
import { decidirRutaAlumno, RUTA_ALUMNO, esPublica, esPublicaSoloLectura, esPublicaDeEscritura } from '../lib/rutas-publicas';
import { proxy } from '../proxy';
import { POST as logout } from '../app/api/auth/logout/route';
import { isPublicLandingPath, esVistaSinChrome } from '../app/_components/PublicRouteGate';

// El proxy lee el secreto en cada pedido (`gateConfigurado`): con esto el gate está ACTIVO, como
// en producción. Sin él, en local el proxy deja pasar todo y el test no probaría nada.
process.env.AUTH_SECRET = 'secreto-de-prueba-del-alumno-0123456789abcdef';

const S = 'otro-secreto-para-la-firma-pura';
const T0 = Date.UTC(2026, 9, 6, 12, 0, 0);
const DIA = 24 * 60 * 60 * 1000;
const A = { ws: 1, leadId: 21, version: 3 };

// ── La firma ─────────────────────────────────────────────────────────────────────

test('la firma: ida y vuelta, con el prefijo propio', () => {
  const c = firmarSesionAlumno(A, S, T0)!;
  assert.ok(c.startsWith('al1.1.21.3.'), c);
  assert.deepEqual(leerSesionAlumno(c, S, T0 + 1000), A);
  assert.equal(ALUMNO_COOKIE, 'mako_alumno');
});

test('la firma torcida no abre: cualquier byte del cuerpo o de la firma', () => {
  const c = firmarSesionAlumno(A, S, T0)!;
  const p = c.split('.');
  const conOtro = (i: number, v: string) => p.map((x, j) => (j === i ? v : x)).join('.');
  const ultimo = p[5].slice(-1) === 'A' ? 'B' : 'A';
  assert.equal(leerSesionAlumno(conOtro(5, p[5].slice(0, -1) + ultimo), S, T0), null, 'firma con un carácter cambiado');
  // Recortada: una comparación por prefijo (o sin mirar el largo) la daría por buena.
  assert.equal(leerSesionAlumno(conOtro(5, p[5].slice(0, -1)), S, T0), null, 'firma recortada');
  assert.equal(leerSesionAlumno(conOtro(5, ''), S, T0), null, 'firma vacía');
  assert.equal(leerSesionAlumno(conOtro(2, '22'), S, T0), null, 'otro lead');
  assert.equal(leerSesionAlumno(conOtro(3, '4'), S, T0), null, 'otra versión');
  assert.equal(leerSesionAlumno(conOtro(4, String(Number(p[4]) + 3600)), S, T0), null, 'vencimiento estirado a mano');
  assert.equal(leerSesionAlumno(c + '.x', S, T0), null);
  for (const basura of ['', 'al1', 'al1.....', 'v1.abc.def', '%%%']) assert.equal(leerSesionAlumno(basura, S, T0), null, basura);
});

test('con OTRO secreto no abre, y sin secreto no se firma ni se lee', () => {
  const c = firmarSesionAlumno(A, S, T0)!;
  assert.equal(leerSesionAlumno(c, 'otro', T0), null);
  assert.equal(firmarSesionAlumno(A, '', T0), null);
  assert.equal(firmarSesionAlumno(A, '   ', T0), null);
  assert.equal(leerSesionAlumno(c, null, T0), null);
});

test('vence a los 30 días, y el vencimiento va FIRMADO', () => {
  assert.equal(ALUMNO_DIAS, 30);
  const c = firmarSesionAlumno(A, S, T0)!;
  assert.deepEqual(leerSesionAlumno(c, S, T0 + 29 * DIA), A);
  assert.equal(leerSesionAlumno(c, S, T0 + 30 * DIA), null, 'en el segundo exacto ya no abre');
  assert.equal(leerSesionAlumno(c, S, T0 + 31 * DIA), null);
});

test('otro workspace no abre: el ws va adentro de la firma', () => {
  const c = firmarSesionAlumno(A, S, T0)!;
  assert.equal(leerSesionAlumno(c.replace(/^al1\.1\./, 'al1.3.'), S, T0), null);
  const deOtro = firmarSesionAlumno({ ...A, ws: 3 }, S, T0)!;
  assert.deepEqual(leerSesionAlumno(deOtro, S, T0), { ...A, ws: 3 });
});

test('la cookie del alumno y el token del curso no se sirven uno por el otro', () => {
  // Mismo secreto, mismos números: lo que los separa es el prefijo de la firma.
  assert.equal(leerSesionAlumno(firmarAccesoCurso(A, S), S, T0), null);
  assert.equal(leerAccesoCurso(firmarSesionAlumno(A, S, T0), S), null);
});

test('el link del mail es un GET del prefijo público de lectura, no una escritura', () => {
  const token = firmarAccesoCurso(A, S)!;
  const u = new URL(urlDeEntrada(token));
  assert.equal(u.pathname, '/api/compartido/curso/entrar');
  assert.equal(u.searchParams.get('t'), token);
  assert.equal(u.searchParams.get('ws'), null, 'el workspace viaja en la firma, no en la URL');
  assert.equal(esPublica(u.pathname), true);
  assert.equal(esPublicaSoloLectura(u.pathname), true, 'un POST ahí tiene que dar 405');
  assert.equal(esPublicaDeEscritura(u.pathname), false);
});

// ── La ruta y el proxy ────────────────────────────────────────────────────────────

test('la ruta del alumno es UNA, exacta, y sólo de lectura', () => {
  assert.equal(RUTA_ALUMNO, '/mi-curso');
  assert.equal(decidirRutaAlumno('/mi-curso', 'GET', false), 'pasa');
  assert.equal(decidirRutaAlumno('/mi-curso', 'head', false), 'pasa');
  assert.equal(decidirRutaAlumno('/mi-curso', 'GET', true), 'prohibido', 'una acción del servidor');
  for (const m of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) assert.equal(decidirRutaAlumno('/mi-curso', m, false), 'prohibido', m);
  for (const p of ['/mi-curso/', '/mi-curso/x', '/mi-cursos', '/api/mi-curso', '/crm', '/']) assert.equal(decidirRutaAlumno(p, 'GET', false), null, p);
  // ⚠️ No está en PUBLICOS: ahí el early-return del proxy se saltea el chequeo de Origin, y esta
  // página LEE una cookie.
  assert.equal(esPublica('/mi-curso'), false);
});

const pedir = (metodo: string, ruta: string, extra: { cookie?: string; headers?: Record<string, string>; body?: string } = {}) =>
  proxy(new NextRequest(`http://localhost:3010${ruta}`, {
    method: metodo,
    headers: { ...(extra.cookie ? { cookie: extra.cookie } : {}), ...(extra.headers ?? {}) },
    body: extra.body,
  }));
const pasa = (r: Response) => r.headers.get('x-middleware-next') === '1';
const aLogin = (r: Response) => r.status === 307 && new URL(r.headers.get('location') ?? 'http://x/').pathname === '/login';

test('el proxy deja pasar /mi-curso SIN sesión (la página mira su cookie)', () => {
  const cookie = `${ALUMNO_COOKIE}=${firmarSesionAlumno(A)}`;
  assert.ok(pasa(pedir('GET', '/mi-curso')), 'sin ninguna cookie también pasa: la página es la que redirige');
  assert.ok(pasa(pedir('GET', '/mi-curso', { cookie })));
  assert.ok(pasa(pedir('GET', '/mi-curso?_rsc=abc', { cookie, headers: { rsc: '1' } })), 'el router.refresh del portal');
});

test('con la cookie del alumno, TODO lo demás sigue cerrado', () => {
  const cookie = `${ALUMNO_COOKIE}=${firmarSesionAlumno(A)}`;
  for (const p of ['/crm', '/crm/21', '/customer-success', '/customer-success/curso', '/plan', '/inicio', '/general', '/mako', '/mi-curso/x', '/admin']) {
    assert.ok(aLogin(pedir('GET', p, { cookie })), `${p} se abrió con la cookie del alumno`);
  }
  for (const p of ['/api/crm/leads', '/api/whatsapp/conversations', '/api/plan-board', '/api/todo', '/api/datos-sin-marcar-count']) {
    assert.equal(pedir('GET', p, { cookie }).status, 401, p);
  }
  // Y puesta en el lugar de la sesión de MaKo, tampoco: el prefijo `al1.` no es un `v1.`.
  assert.ok(aLogin(pedir('GET', '/crm', { cookie: `mako_session=${firmarSesionAlumno(A)}` })));
});

test('el proxy corta las acciones del servidor en /mi-curso: con header y SIN header', () => {
  // ⚠️ Next también corre una acción que llega como POST de formulario sin `next-action`
  // (server-action-request-meta.js: isMultipartAction / isURLEncodedAction).
  assert.equal(pedir('POST', '/mi-curso', { headers: { 'next-action': 'abc123', 'content-type': 'text/plain' }, body: '[]' }).status, 403);
  assert.equal(pedir('POST', '/mi-curso', { headers: { 'content-type': 'multipart/form-data; boundary=x' }, body: '--x--' }).status, 403);
  assert.equal(pedir('POST', '/mi-curso', { headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'a=1' }).status, 403);
  assert.equal(pedir('GET', '/mi-curso', { headers: { 'next-action': 'abc123' } }).status, 403);
});

test('la entrada del mail pasa por GET y no acepta POST', () => {
  assert.ok(pasa(pedir('GET', '/api/compartido/curso/entrar?t=x')));
  assert.equal(pedir('POST', '/api/compartido/curso/entrar?t=x', { body: '' }).status, 405);
});

test('salir borra también la cookie del alumno, con el mismo path con que se puso', async () => {
  const res = await logout();
  const del = res.headers.getSetCookie().find((c) => c.startsWith(`${ALUMNO_COOKIE}=`));
  assert.ok(del, 'el logout no toca mako_alumno');
  assert.match(del!, /Max-Age=0/i);
  assert.match(del!, /Path=\//i);
  assert.match(del!, /HttpOnly/i);
});

test('/mi-curso va sin el chrome de la app (sin sidebar ni pollers)', () => {
  assert.equal(isPublicLandingPath('/mi-curso'), true, 'los pollers del WhatsApp del negocio correrían con 401 en bucle');
  assert.equal(esVistaSinChrome('/mi-curso'), true);
  assert.equal(isPublicLandingPath('/mi-curso/x'), false);
});

// ── El login con Google (se lee el fuente: habla con Google y con la base) ────────

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8')
  .replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/** El cuerpo de un bloque, desde la primera `{` después de `desde` hasta su cierre. */
function bloque(src: string, desde: string): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encuentro «${desde}»`);
  const abre = src.indexOf('{', i);
  let n = 0;
  for (let j = abre; j < src.length; j++) {
    if (src[j] === '{') n++;
    else if (src[j] === '}' && --n === 0) return src.slice(abre, j + 1);
  }
  throw new Error(`bloque sin cerrar: ${desde}`);
}

test('el callback: usuarios GANA, y el alumno entra SÓLO con su cookie', () => {
  const src = leer('app/api/auth/callback/google/route.ts');
  // El state se sigue validando ANTES de mirar quién es.
  const iState = src.search(/state\s*!==\s*stateCookie/);
  const iUsuario = src.indexOf('resolverConFallback(email)');
  assert.ok(iState > 0 && iUsuario > iState, 'el state se valida antes de resolver a la persona');
  // La rama del alumno vive ADENTRO de «no es usuario», y es la única llamada.
  const rama = bloque(src, 'if (!usuario)');
  assert.ok(rama.includes('accesoInvitadoPorEmail(email)'), 'la rama del alumno no está adentro de «no es usuario»');
  assert.equal(src.split('accesoInvitadoPorEmail(').length - 1, 1, 'el acceso por email se busca en otro lado también');
  // Lo que entra es la cookie del alumno y nada más.
  assert.ok(rama.includes('ponerCookieAlumno('));
  assert.ok(/new URL\(\s*RUTA_ALUMNO\s*,/.test(rama), 'el alumno va a /mi-curso');
  for (const prohibido of ['crearToken', 'SESSION_COOKIE', 'EMAIL_COOKIE', 'destinoSeguro', 'registrarLogin', 'crearUsuario']) {
    assert.ok(!rama.includes(prohibido), `la rama del alumno usa ${prohibido}`);
  }
  assert.ok(/fail\(\s*'no-autorizado'\s*\)/.test(rama), 'sin invitación sigue siendo «no autorizado»');
});

test('el acceso por email: usuarios primero, sólo invitados de verdad, y nunca un patrón', () => {
  const src = leer('lib/alumno-acceso.ts');
  const fn = bloque(src, 'export async function accesoInvitadoPorEmail');
  const iUsuarios = fn.indexOf('buscarUsuarioPorEmail(');
  const iAccesos = fn.indexOf(".from('curso_accesos')");
  assert.ok(iUsuarios > 0 && iAccesos > iUsuarios, 'usuarios tiene que mirarse ANTES que curso_accesos');
  assert.ok(/\.not\(\s*'invitacion_enviada_at'\s*,\s*'is'\s*,\s*null\s*\)/.test(fn), 'tener fila no es estar invitado');
  assert.ok(/\.is\(\s*'revocado_at'\s*,\s*null\s*\)/.test(fn), 'un revocado no entra');
  assert.ok(/\.eq\(\s*'email'\s*,/.test(fn), 'el email se compara EXACTO');
  assert.ok(!/ilike/i.test(fn), 'un `_` del email es comodín en un patrón');
  assert.ok(/order\(\s*'invitacion_enviada_at'\s*,\s*\{\s*ascending:\s*false/.test(fn), 'gana la invitación más reciente');
  assert.ok(fn.includes('accesoVigente('), 'cada candidato se revalida con resolverAcceso');
  // Y el módulo no acuña NUNCA una sesión de MaKo ni una fila en usuarios.
  for (const prohibido of ['crearToken', 'SESSION_COOKIE', 'crearUsuario', 'registrarLogin']) {
    assert.ok(!src.includes(prohibido), `lib/alumno-acceso.ts usa ${prohibido}`);
  }
});
