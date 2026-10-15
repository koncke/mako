// =============================================================================
// Las rutas públicas del comprador de un link de pago (11/10/2026)
// =============================================================================
// `/pagar/<token>` (lleva al checkout), `/pagar/<token>/listo` (adonde vuelve) y `POST
// /api/pagar/email` (cambia el email con el que entra a MaKo quien compró un plan). Las tres son
// PÚBLICAS: la credencial es el token del cobro, y estar en PUBLICOS significa también que no leen
// la cookie de sesión — el early-return del proxy se saltea el chequeo de Origin, así que una que la
// leyera sería un CSRF (AGENTS.md «Una ruta con auth propia va en lib/rutas-publicas.ts»).
//
// Lo que se fija:
//   1. Las CUATRO condiciones del cambio de email (pagado, alta hecha, nunca entró, menos de 3
//      cambios), EJECUTANDO `motivoParaNoCambiar` — y que la ruta la llame antes de escribir nada.
//   2. Que ninguna de las rutas (ni lo que importan de app/pagar) lea cookies.
//   3. Que /pagar y /listo validen el token ANTES de ir a la base.
//
// Probado rompiéndolo (11/10/2026), cada rotura sola sobre una base de 7 pases (el detalle, al final).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MAX_CAMBIOS_EMAIL, RESPUESTA_GENERICA, cambiosRestantes, emailNuevoValido, motivoParaNoCambiar,
  type CobroParaCambio, type UsuarioDelAlta,
} from '../app/pagar/cambio-email';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '');

const PAGAR = 'app/pagar/[token]/route.ts';
const LISTO = 'app/pagar/[token]/listo/page.tsx';
const EMAIL = 'app/api/pagar/email/route.ts';
const TODAS = [PAGAR, LISTO, EMAIL, 'app/pagar/[token]/listo/AccesoMako.tsx', 'app/pagar/acceso.ts', 'app/pagar/cambio-email.ts'];

const COBRO_OK: CobroParaCambio = { estado: 'pagado', alta_estado: 'hecha', alta_ws: 42, alta_email_cambios: 0, pagado_at: new Date(Date.now() - 3_600_000).toISOString() };
const USUARIO_OK: UsuarioDelAlta = { id: 7, email: 'juan@empresa.com', ultimo_login: null };

test('las cuatro condiciones del cambio de email, una por una', () => {
  assert.equal(motivoParaNoCambiar(COBRO_OK, USUARIO_OK), null, 'con las cuatro cumplidas, se puede');

  // 1. Pagado. Y 2. el alta hecha: si no, la respuesta GENÉRICA, la misma que un token que no existe.
  for (const estado of ['pendiente', 'fallido', 'reembolsado', 'anulado'] as const) {
    assert.deepEqual(motivoParaNoCambiar({ ...COBRO_OK, estado }, USUARIO_OK), RESPUESTA_GENERICA, `cobro ${estado}`);
  }
  for (const alta_estado of [null, 'pendiente', 'ya_tenia_cuenta', 'error'] as const) {
    assert.deepEqual(motivoParaNoCambiar({ ...COBRO_OK, alta_estado }, USUARIO_OK), RESPUESTA_GENERICA, `alta ${alta_estado}`);
  }
  assert.deepEqual(motivoParaNoCambiar({ ...COBRO_OK, alta_ws: null }, USUARIO_OK), RESPUESTA_GENERICA, 'alta sin workspace');
  assert.deepEqual(motivoParaNoCambiar(null, null), RESPUESTA_GENERICA, 'el token que no existe contesta lo mismo');

  // 3. Nunca entró: una cuenta que ya se usó no se la lleva un link reenviado.
  const yaEntro = motivoParaNoCambiar(COBRO_OK, { ...USUARIO_OK, ultimo_login: '2026-10-11T12:00:00Z' });
  assert.ok(yaEntro && yaEntro.status === 409, 'el usuario ya entró: no se cambia');

  // 4. Menos de 3 cambios.
  assert.equal(MAX_CAMBIOS_EMAIL, 3);
  assert.equal(motivoParaNoCambiar({ ...COBRO_OK, alta_email_cambios: 2 }, USUARIO_OK), null, 'el tercero todavía se puede');
  const tope = motivoParaNoCambiar({ ...COBRO_OK, alta_email_cambios: 3 }, USUARIO_OK);
  assert.ok(tope && tope.status === 429, 'el cuarto no');

  // 5. Dentro de las 48 h desde el pago (revisión adversarial del 11/10/2026: el link se reenvía y no
  //    vence). Roto a propósito (la ventana de 48 h sin chequear): 1 fail en este test; restaurado: pasa.
  const viejo = motivoParaNoCambiar({ ...COBRO_OK, pagado_at: new Date(Date.now() - 49 * 3_600_000).toISOString() }, USUARIO_OK);
  assert.ok(viejo && viejo.status === 409, 'pasadas las 48 h, el link ya no cambia el acceso');
  const sinFecha = motivoParaNoCambiar({ ...COBRO_OK, pagado_at: null }, USUARIO_OK);
  assert.ok(sinFecha && sinFecha.status === 409, 'sin fecha de pago, no (fail-closed)');
  assert.equal(cambiosRestantes({ alta_email_cambios: 3 }), 0);

  // Sin la cuenta del alta (dos candidatas o ninguna), no se elige a quién cambiarle el email.
  assert.ok(motivoParaNoCambiar(COBRO_OK, null)?.status === 409);

  // Todo «no» dice qué hacer: el email de MaKo para escribir.
  for (const r of [RESPUESTA_GENERICA, yaEntro!, tope!]) assert.match(r.error, /@/, `«${r.error}» no dice a quién escribir`);
});

test('el email nuevo: válido, normalizado y distinto del que ya tiene', () => {
  assert.deepEqual(emailNuevoValido('  Juan@Gmail.com ', USUARIO_OK.email), { ok: true, email: 'juan@gmail.com' });
  assert.equal(emailNuevoValido('no-es-un-email', USUARIO_OK.email).ok, false);
  assert.equal(emailNuevoValido(42, USUARIO_OK.email).ok, false);
  assert.equal(emailNuevoValido('JUAN@empresa.com', USUARIO_OK.email).ok, false, 'el mismo, con otra mayúscula, no es un cambio');
});

test('la ruta del email aplica las cuatro condiciones ANTES de escribir, y con compare-and-set', () => {
  const src = sinComentarios(leer(EMAIL));
  const ini = src.indexOf('export async function POST');
  assert.ok(ini > 0, 'no encontré el POST');
  const cuerpo = src.slice(ini);
  const decide = cuerpo.indexOf('motivoParaNoCambiar(c, u)');
  const escribe = cuerpo.indexOf('.update(');
  assert.ok(decide > 0, 'la ruta no decide con motivoParaNoCambiar');
  assert.ok(escribe > decide, 'la ruta escribe antes de decidir');
  // El usuario se lee de verdad (no un usuario de mentira que pase la condición 3).
  assert.match(cuerpo, /u = await usuarioDelAlta\(c\)/);
  // El reclamo del contador es compare-and-set sobre el valor leído y sobre el estado que lo habilita.
  assert.match(cuerpo, /\.eq\('alta_email_cambios', antes\)\.eq\('estado', 'pagado'\)\.eq\('alta_estado', 'hecha'\)/);
  // Y el email del usuario cambia sólo si sigue sin haber entrado.
  assert.match(cuerpo, /\.is\('ultimo_login', null\)/);
  // El token se valida antes de ir a la base.
  assert.ok(cuerpo.indexOf('esTokenCobro(token)') >= 0 && cuerpo.indexOf('esTokenCobro(token)') < cuerpo.indexOf('getCobroPorToken('),
    'el token se valida después de leer la base');
});

test('«ese email ya es de otro» se pregunta DESPUÉS del reclamo y gasta el intento (no es un oráculo de usuarios)', () => {
  // Revisión del 11/10/2026: antes salía sin gastar ninguno de los 3 cambios, y un link servía para preguntar sin
  // límite qué emails tienen cuenta en MaKo (los topes por IP y por token viven en memoria, por instancia).
  const cuerpo = sinComentarios(leer(EMAIL));
  const reclamo = cuerpo.indexOf(".eq('alta_email_cambios', antes).eq('estado', 'pagado')");
  const pregunta = cuerpo.indexOf('buscarUsuarioPorEmail(nuevo.email)');
  assert.ok(reclamo > 0 && pregunta > reclamo, 'se pregunta si el email es de otro ANTES de gastar el intento');
  assert.match(cuerpo, /if \(otro && otro\.id !== usuario\.id\) return no\(409, EMAIL_NO_DISPONIBLE\);/, 'el «ya es de otro» devuelve el intento');
  // Si la búsqueda FALLA (la base, no el email), el intento se devuelve: no es culpa de quien compró.
  const bloque = cuerpo.indexOf('if (e2 || !cambiado) {');
  const devuelve = cuerpo.indexOf('.update({ alta_email_cambios: antes })', pregunta);
  assert.ok(devuelve > pregunta && devuelve < bloque, 'si la búsqueda falla, el intento no se devuelve');
  // El que choca con el único de `usuarios.email` en el medio, igual que el «ya es de otro»: sale ANTES de devolverlo.
  const choque = cuerpo.indexOf("if (e2?.code === '23505') return no(409, EMAIL_NO_DISPONIBLE);", bloque);
  assert.ok(bloque > 0 && choque > bloque && choque < cuerpo.indexOf('.update({ alta_email_cambios: antes })', bloque),
    'el email que se volvió de otro en el medio devuelve el intento');
  // Y el texto no dice «ya tiene una cuenta»: eso es lo que se pregunta.
  assert.doesNotMatch(cuerpo, /ya tiene una cuenta/);
});

test('ninguna ruta del comprador lee cookies', () => {
  for (const r of TODAS) {
    const src = sinComentarios(leer(r));
    assert.doesNotMatch(src, /next\/headers/, `${r} importa next/headers`);
    assert.doesNotMatch(src, /\bcookies\b/, `${r} lee cookies`);
    // Los que resuelven el workspace o la sesión desde la cookie, tampoco.
    assert.doesNotMatch(src, /getWorkspaceActual\(|getSesion\w*\(|getTenantDb\(|haySesion\(/, `${r} resuelve algo desde la cookie`);
  }
});

test('/pagar/<token> y su retorno validan el token antes de ir a la base', () => {
  for (const r of [PAGAR, LISTO]) {
    const src = sinComentarios(leer(r));
    const valida = src.indexOf('esTokenCobro(token)');
    const lee = src.indexOf('getCobroPorToken(token)');
    assert.ok(valida > 0 && lee > valida, `${r}: el token se valida después de leer la base (o no se valida)`);
  }
  // Y el 302 no se cachea: el destino cambia con el estado del cobro.
  assert.match(sinComentarios(leer(PAGAR)), /'Cache-Control': 'no-store'/);
});

test('el retorno es una página pública: sin <Suspense> y sin escribir', () => {
  const src = sinComentarios(leer(LISTO));
  assert.doesNotMatch(src, /Suspense/, 'un <Suspense> esconde el estado del pago a quien no ejecuta JavaScript');
  assert.doesNotMatch(src, /'use server'/);
  // Lo único que escribe del comprador es el route handler bajo /api/.
  assert.doesNotMatch(sinComentarios(leer('app/pagar/[token]/listo/AccesoMako.tsx')), /'use server'|from '@\/lib\/(?!app-url)/,
    'el formulario no importa módulos del server: escribe por POST /api/pagar/email');
});

test('la página del comprador no recibe POST (lo único que escribe es /api/pagar/email)', () => {
  const src = sinComentarios(leer(PAGAR));
  assert.doesNotMatch(src, /export (async )?function (POST|PUT|PATCH|DELETE)/);
});

// Probado rompiéndolo (11/10/2026), sobre una base de 7 pases, cada rotura sola y restaurada a mano:
//   · sacar la condición de `ultimo_login` de `motivoParaNoCambiar`            → 1 fallo / 6 pases (el 1º);
//   · que la ruta decida con un usuario de mentira (`{ ultimo_login: null }`)  → 1 / 6 (el 3º);
//   · sacar `.eq('alta_email_cambios', antes)` del reclamo                     → 1 / 6 (el 3º);
//   · `import { cookies } from 'next/headers'` en la página de retorno         → 1 / 6 (el 4º);
//   · sacar el `if (!esTokenCobro(token)) return noExiste();` de /pagar        → 1 / 6 (el 5º).
// Restaurado: 7 pases.
// Y el 15/10/2026, con «ese email ya es de otro» gastando el intento (8 pases en verde; pases / fallos):
//   · la pregunta ANTES del reclamo, como estaba                                → 7 / 1
//   · el «ya es de otro» devolviendo el intento                                 → 7 / 1
//   · el 23505 saliendo DESPUÉS de devolver el intento                          → 7 / 1
//   · si la búsqueda falla (la base), sin devolver el intento                   → 7 / 1
//   · el texto otra vez «Ese email ya tiene una cuenta de MaKo»                 → 7 / 1
