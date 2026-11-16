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
//   4. (16/11/2026) La prueba gratis autorizada también: «Revisa tu correo» con «Reenviar el correo» y «Cambiar el email», y la
//      ruta que reenvía el acceso al MISMO email (`motivoParaNoReenviar`) sin gastar los 3 cambios.
//
// Probado rompiéndolo (11/10/2026), cada rotura sola sobre una base de 7 pases (el detalle, al final).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  MAIL_INCIERTO, MAX_CAMBIOS_EMAIL, RESPUESTA_GENERICA, RESPUESTA_GENERICA_REENVIO, bandejaDeEntrada, cambiosRestantes, correoDeAcceso, dentroDeLaVentana,
  emailNuevoValido, esAltaHecha, motivoParaNoCambiar, motivoParaNoReenviar, type CobroParaCambio, type UsuarioDelAlta,
} from '../app/pagar/cambio-email';
import { PREFIJO_MAIL_NO_SALIO } from '../lib/cobros-reglas';
import { AccesoMako } from '../app/pagar/[token]/listo/AccesoMako';

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
  const escribe = cuerpo.indexOf('.update(', decide);
  assert.ok(decide > 0, 'la ruta no decide con motivoParaNoCambiar');
  assert.ok(escribe > decide, 'la ruta escribe antes de decidir');
  // El reenvío (16/11/2026) decide con SUS condiciones antes de su única escritura (anotar si el correo salió).
  const decideReenvio = cuerpo.indexOf('motivoParaNoReenviar(c, u)');
  const escribeReenvio = cuerpo.indexOf('.update(');
  assert.ok(decideReenvio > 0 && escribeReenvio > decideReenvio && decideReenvio < decide, 'el reenvío escribe antes de decidir');
  // El usuario se lee de verdad (no un usuario de mentira que pase la condición 3).
  assert.match(cuerpo, /u = await usuarioDelAlta\(c\)/);
  // El reclamo del contador es compare-and-set sobre el valor leído y sobre el estado que lo habilita.
  assert.match(cuerpo, /\.eq\('id', cobro\.id\)\.eq\('alta_email_cambios', antes\)\.eq\('alta_estado', 'hecha'\);/);
  // Y sobre el estado que lo habilita: pagado, o la prueba autorizada (pendiente con la suscripción activa).
  assert.match(cuerpo, /cobro\.estado === 'pagado'\n\s*\? reclamar\.eq\('estado', 'pagado'\)\n\s*: reclamar\.eq\('estado', 'pendiente'\)\.eq\('suscripcion_estado', 'activa'\)\)/);
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
  const reclamo = cuerpo.indexOf(".eq('alta_email_cambios', antes).eq('alta_estado', 'hecha')");
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

test('cambiar el email de acceso AVISA al email anterior, después del cambio y sin frenar la respuesta', () => {
  // 15/10/2026: quien tiene el link de la compra puede cambiar el acceso. Un código al email ACTUAL bloqueaba el caso
  // legítimo más común (se tipeó mal al pagar); se copia a Google y GitHub: el nuevo se prueba al entrar con Google, y
  // al anterior le llega un aviso con cómo revertirlo.
  const cuerpo = sinComentarios(leer(EMAIL));
  const cambio = cuerpo.indexOf(".is('ultimo_login', null)");
  const aviso = cuerpo.indexOf('avisarCambioDeEmailDeAcceso({ anterior: usuario.email, nuevoEnmascarado: emailEnmascarado(nuevo.email)');
  assert.ok(cambio > 0 && aviso > cambio, 'el aviso va DESPUÉS de que el cambio quedó hecho (y a la dirección de ANTES)');
  assert.match(cuerpo, /try \{ after\(avisarAnterior\); \} catch \{ void avisarAnterior\(\); \}/, 'el aviso no frena la respuesta');
  const inv = sinComentarios(leer('lib/invitaciones.ts'));
  const f = inv.slice(inv.indexOf('export async function avisarCambioDeEmailDeAcceso('), inv.indexOf('export async function invitarAlCursoPorEmail('));
  assert.match(f, /await enviarDePlataforma\(/, 'habla MaKo: la key y el remitente de la plataforma, no los del negocio');
  assert.match(f, /\$\{p\.nuevoEnmascarado\}/, 'el nuevo va enmascarado: si el anterior estaba mal tipeado, es de un desconocido');
  assert.match(f, /\$\{EMAIL_MAKO\}/, 'el aviso dice a dónde escribir para revertirlo');
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

// ── La prueba gratis y «Revisa tu correo» (16/11/2026) ────────────────────────────────────────────────────────────────
/** La prueba autorizada: pendiente, con la suscripción activa, de un plan con prueba, la cuenta creada y sin pago todavía. */
const PRUEBA_OK: CobroParaCambio = { estado: 'pendiente', suscripcion_estado: 'activa', tipo: 'suscripcion', alta_capa: 'completo', creado_por: 'planes:esencial:prueba',
  alta_estado: 'hecha', alta_ws: 43, alta_email_cambios: 0, pagado_at: null, created_at: new Date(Date.now() - 3_600_000).toISOString() };

test('la PRUEBA autorizada también deja cambiar el email (era sólo con el cobro pagado), y su ventana cuenta desde el checkout', () => {
  assert.equal(esAltaHecha(PRUEBA_OK), true);
  assert.equal(motivoParaNoCambiar(PRUEBA_OK, USUARIO_OK), null, 'quien empezó la prueba no podía cambiar el email');
  assert.equal(dentroDeLaVentana(PRUEBA_OK), true);
  assert.equal(dentroDeLaVentana({ ...PRUEBA_OK, created_at: new Date(Date.now() - 49 * 3_600_000).toISOString() }), false, 'sin ventana');
  // Lo que NO es una prueba autorizada sigue sin poder: la cancelada, la que no se autorizó, un cobro común pendiente.
  for (const [que, c] of [
    ['cancelada', { ...PRUEBA_OK, suscripcion_estado: 'cancelada' as const }],
    ['sin autorizar', { ...PRUEBA_OK, suscripcion_estado: null }],
    ['un cobro común pendiente', { ...PRUEBA_OK, creado_por: 'planes:esencial' }],
  ] as const) assert.deepEqual(motivoParaNoCambiar(c, USUARIO_OK), RESPUESTA_GENERICA, que);
  // La página le pasa al formulario la ventana de la prueba (antes `dentroDeLaVentana` sólo miraba la fecha del pago).
  assert.match(leer(LISTO), /puedeCambiar=\{cambiosRestantes\(c\) > 0 && dentroDeLaVentana\(c\)\}/);
});

test('REENVIAR el correo: al mismo email, con las condiciones del cambio salvo el tope de 3, y su propio tope en la ruta', () => {
  assert.equal(motivoParaNoReenviar(PRUEBA_OK, USUARIO_OK), null);
  assert.equal(motivoParaNoReenviar({ ...COBRO_OK, alta_email_cambios: MAX_CAMBIOS_EMAIL }, USUARIO_OK), null, 'reenviar no gasta los cambios');
  assert.deepEqual(motivoParaNoReenviar(null, null), RESPUESTA_GENERICA_REENVIO, 'el token que no existe contesta lo mismo');
  assert.deepEqual(motivoParaNoReenviar({ ...COBRO_OK, estado: 'pendiente' }, USUARIO_OK), RESPUESTA_GENERICA_REENVIO);
  assert.equal(motivoParaNoReenviar(COBRO_OK, { ...USUARIO_OK, ultimo_login: '2026-11-16T12:00:00Z' })?.status, 409, 'ya entró: no hace falta');
  assert.equal(motivoParaNoReenviar({ ...COBRO_OK, pagado_at: new Date(Date.now() - 49 * 3_600_000).toISOString() }, USUARIO_OK)?.status, 409);
  const cuerpo = sinComentarios(leer(EMAIL));
  assert.match(cuerpo, /const reenviar = cuerpo\.reenviar === true;/);
  assert.match(cuerpo, /rateLimit\(`pagar-email:reenvio:\$\{token\}`, 3, 60 \* 60_000\)/, 'el reenvío sin su tope');
  // Va al email que YA tiene la cuenta (el del usuario leído), nunca a uno que mande el pedido.
  assert.match(cuerpo, /invitarPorEmail\(\{ email: u!\.email, workspace: ws\?\.nombre, rolWs: 'admin' \}\)/);
  assert.ok(cuerpo.indexOf('if (reenviar) {') < cuerpo.indexOf('emailNuevoValido('), 'el reenvío lee un email del pedido');
});

test('«Revisa tu correo»: lo grande es abrir el correo, con el email, «Reenviar el correo» y «Cambiar el email»; poco texto', () => {
  const props = { token: 't', emailInicial: 'va***@gmail.com', bandeja: bandejaDeEntrada('valentina@gmail.com'), puedeCambiar: true, contacto: 'equipo@hola-mako.com',
    chip: 'Tu prueba gratis de 7 días empezó · hoy no se cobra nada', nota: 'El primer cobro es el domingo, 23 de noviembre.' };
  const h = renderToStaticMarkup(createElement(AccesoMako, props)).replace(/<style[\s\S]*?<\/style>/g, '');
  assert.match(h, /<h1>Revisa tu correo<\/h1>/);
  assert.match(h, /Te mandamos el acceso a <b>va\*\*\*@gmail\.com<\/b>/);
  assert.match(h, /<a class="gr-btn" href="https:\/\/mail\.google\.com\/mail\/u\/0\/#inbox" target="_blank" rel="noopener noreferrer">Abrir mi correo<\/a>/);
  assert.match(h, />Reenviar el correo<\/button>/);
  assert.match(h, />Cambiar el email<\/button>/);
  const chip = /<p class="gr-chip">([\s\S]*?)<\/p>/.exec(h)?.[1] ?? '';
  assert.equal(chip.replace(/<[^>]+>/g, ''), '✓ Tu prueba gratis de 7 días empezó · hoy no se cobra nada');
  assert.match(chip, /<span class="gr-chip-p"><span aria-hidden="true">✓ <\/span>Tu prueba gratis de 7 días empezó<\/span>/, 'en el teléfono corta en el medio de la frase');
  assert.ok(h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').length < 70, 'volvió el montón de texto');
  // Un email de empresa no tiene una bandeja para abrir: el botón es entrar a MaKo. Sin ventana, no se ofrece cambiarlo.
  const empresa = renderToStaticMarkup(createElement(AccesoMako, { ...props, bandeja: bandejaDeEntrada('vale@nutrivale.com.ar'), puedeCambiar: false }));
  assert.match(empresa, /<a class="gr-btn" href="\/login">Entrar a MaKo<\/a>/);
  assert.doesNotMatch(empresa, /Cambiar el email/);
  // Con el correo caído no se dice «revisa tu correo»: se dice que no salió y el botón lo reenvía.
  const caido = renderToStaticMarkup(createElement(AccesoMako, { ...props, correo: 'no-salio' as const }));
  assert.match(caido, /<h1>Tu cuenta está lista<\/h1>/);
  assert.doesNotMatch(caido, /Revisa tu correo|Te mandamos el acceso/);
  assert.match(caido, /<button type="button" class="gr-btn">Reenviar el correo<\/button>/);
  // Las bandejas que se conocen, y ninguna inventada.
  assert.equal(bandejaDeEntrada('a@hotmail.com')?.nombre, 'Outlook');
  assert.equal(bandejaDeEntrada('a@yahoo.com.ar')?.nombre, 'Yahoo');
  assert.equal(bandejaDeEntrada('a@icloud.com')?.nombre, 'iCloud');
  assert.equal(bandejaDeEntrada('a@empresa.com'), null);
  // La página: con la cuenta hecha y sin haber entrado, ES «Revisa tu correo» (pagado y prueba); lo demás, la tarjeta.
  const pagina = leer(LISTO);
  assert.equal((pagina.match(/const revisa = await revisaTuCorreo\(c, /g) ?? []).length, 2, 'el pagado y la prueba pasan por «Revisa tu correo»');
  assert.match(pagina, /if \(!u \|\| u\.ultimo_login\) return null;/);
});

test('«Revisa tu correo» fuera de la ventana, el reenvío que no salió y el «no sé si llegó» (revisión del 16/11/2026, hallazgo 4)', () => {
  const props = { token: 't', emailInicial: 'va***@gmail.com', bandeja: bandejaDeEntrada('valentina@gmail.com'), puedeCambiar: false, contacto: 'equipo@hola-mako.com',
    chip: 'Tu prueba gratis de 7 días empezó · hoy no se cobra nada' };
  const dibujar = (extra: object) => renderToStaticMarkup(createElement(AccesoMako, { ...props, ...extra })).replace(/<style[\s\S]*?<\/style>/g, '');
  // Fuera de las 48 horas la ruta contesta 409 siempre, y quien no recibió el correo es justo quien vuelve días después: no se ofrece
  // reenviar, se ofrece escribirnos.
  const fuera = dibujar({ puedeReenviar: false });
  assert.doesNotMatch(fuera, /Reenviar el correo/, 'fuera de la ventana se ofrece reenviar (y la ruta contesta 409)');
  assert.match(fuera, /¿No te llegó\? <a href="mailto:equipo@hola-mako\.com">Escríbenos a equipo@hola-mako\.com<\/a>/);
  const caidoFuera = dibujar({ puedeReenviar: false, correo: 'no-salio' });
  assert.match(caidoFuera, /<h1>Tu cuenta está lista<\/h1>/);
  assert.doesNotMatch(caidoFuera, /Reenviar el correo|Reenvíalo/);
  assert.match(caidoFuera, /<a class="gr-btn" href="\/login">Entrar a MaKo<\/a>/);
  assert.match(caidoFuera, /escríbenos a <a href="mailto:equipo@hola-mako\.com">equipo@hola-mako\.com<\/a>/);
  // Dentro de la ventana, con el correo caído, reenviar sigue siendo el botón principal.
  assert.match(dibujar({ correo: 'no-salio' }), /<button type="button" class="gr-btn">Reenviar el correo<\/button>/);
  // «No sé si el mail llegó» no es «no pudimos mandarte el correo»: puede estar en su bandeja.
  const noSe = dibujar({ correo: 'no-se' });
  assert.match(noSe, /<h1>Revisa tu correo<\/h1>/);
  assert.match(noSe, /Te mandamos el acceso a <b>va\*\*\*@gmail\.com<\/b>, pero no sabemos si llegó\./);
  assert.doesNotMatch(noSe, /No pudimos mandarte/);
  assert.match(noSe, />Abrir mi correo<\/a>/);
  assert.equal(correoDeAcceso(null), 'salio');
  assert.equal(correoDeAcceso(`${PREFIJO_MAIL_NO_SALIO}: el dominio no está verificado`), 'no-salio');
  assert.equal(correoDeAcceso(`${PREFIJO_MAIL_NO_SALIO}: el alta se cortó y se terminó en un reintento, ${MAIL_INCIERTO}`), 'no-se');
  // La frase la escribe lib/cobros.ts (`altaSiCorresponde`): si cambia allá, esto deja de reconocerla.
  assert.ok(leer('lib/cobros.ts').includes(MAIL_INCIERTO), 'lib/cobros.ts ya no anota «no sé si el mail llegó»: `correoDeAcceso` no lo reconoce');
  // La página le pasa la ventana y el correo en tres.
  const pagina = leer(LISTO);
  assert.match(pagina, /puedeReenviar=\{dentroDeLaVentana\(c\)\}/);
  assert.match(pagina, /correo=\{correoDeAcceso\(c\.alta_motivo\)\}/);
  // Un reenvío que contestó pero no salió es un error (en rojo), no un aviso en verde; y en la base no pisa lo que se sabía del primero.
  const acceso = sinComentarios(leer('app/pagar/[token]/listo/AccesoMako.tsx'));
  const reenviar = acceso.slice(acceso.indexOf('async function reenviar('), acceso.indexOf('async function cambiar('));
  assert.match(reenviar, /if \(!r\.enviado\) \{ setError\(/);
  assert.ok(reenviar.indexOf('if (!r.enviado)') < reenviar.indexOf('setAviso(r.mensaje'), 'el reenvío que no salió se pinta en verde');
  const ruta = sinComentarios(leer(EMAIL));
  const reenvio = ruta.slice(ruta.indexOf('if (reenviar) {'), ruta.indexOf('const motivo = motivoParaNoCambiar('));
  assert.match(reenvio, /if \(inv\.enviado\) \{\n\s*const \{ error: eR \} = await getSupabaseServer\(\)\.from\('cobros'\)\.update\(\{ alta_motivo: null \}\)/);
  assert.doesNotMatch(reenvio, /PREFIJO_MAIL_NO_SALIO/, 'un reenvío que no salió pisa lo que se sabía del primero');
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
// Y con el aviso al email anterior (9 pases en verde), cada una → 8 / 1: sin mandarlo, mandándolo al email NUEVO,
// y con el nuevo sin enmascarar en el texto.
// Y el 16/11/2026, con la prueba y «Revisa tu correo» (12 pases en verde; pases / fallos):
//   · `esAltaHecha` vuelve a pedir el cobro pagado                              -> 10 / 2
//   · la ventana de la prueba sin `created_at` (sólo la fecha del pago)          -> 10 / 2
//   · el reenvío gasta uno de los 3 cambios                                     -> 11 / 1
//   · «Revisa tu correo» con el correo caído                                    -> 11 / 1
// Revisión del 16/11/2026, hallazgo 4 (base 13 / 0; sobre copias, y las dos que se dibujan en el repo, restauradas):
//   · fuera de la ventana se ofrece reenviar                                    -> 12 / 1
//   · el reenvío que no salió se pinta en verde                                 -> 12 / 1
//   · «no sé si llegó» se lee como «no salió» (correoDeAcceso)                  -> 12 / 1
//   · la página dibuja «no sé» como «no salió»                                  -> 12 / 1
//   · un reenvío que no salió pisa lo que se sabía del primero                  -> 12 / 1
//   · la página no le pasa la ventana                                           -> 12 / 1
