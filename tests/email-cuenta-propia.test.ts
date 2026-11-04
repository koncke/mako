// =============================================================================
// Cada negocio manda con SU cuenta de Resend, y todo el camino se hace por la API, guiado (4/11/2026)
// =============================================================================
// Martín, ese día: «Resend free permite hasta 3 dominios, pero eso lo trae cada user de mako», y «todo esto es súper
// importante que lo pueda hacer por API… si detecta que no tiene [Resend] conectado, que le vaya guiando… para que cualquier
// usuario lo pueda manejar desde su [Claude]». Lo que se fija acá, corriendo el código REAL (tests/_email-campana-hijo.ts:
// los runners de la API, las libs, la ruta del webhook y la hidratación del arranque, contra una base en memoria y un Resend
// de mentira con las cuentas separadas):
//   1. la guía (`guiaDelEmail`): el paso, qué hacer y la operación que sigue, en orden;
//   2. el camino ENTERO sólo con llamadas a la API, de «no tengo cuenta» a «listo» (lo único fuera de la API es pegar la
//      clave en el modal de MaKo: la API no recibe claves), sin cuenta no se le pide nada a Resend, y el secreto del
//      webhook no sale nunca;
//   3. el webhook firmado con el secreto DEL NEGOCIO (`?cuenta=`): entra, toca sólo sus filas, y otra firma no entra;
//   4. el ws1 deja de ser la fuente de la clave de correo de MaKo: antes de la mudanza nada cambia, después Mauricio manda
//      con la suya y los avisos de MaKo con la de MaKo, y con la lectura de la plataforma caída no se toma la del ws1.
//
// PROBADO ROMPIÉNDOLO (4/11/2026, `romper.py`, restaurando de memoria; base 7 / 0). Pasan / fallan en ESTE archivo:
//   E1 `cuentaDeCorreo` cae a la de MaKo cuando el negocio no tiene la suya                                → 3 / 4
//   E2 `cuentaDeCorreo` sin mirar si la de su fila es la de MaKo (`esDeLaPlataforma`)                       → 5 / 2
//   E4 el webhook con `?cuenta=` verifica con el secreto de MaKo                                            → 6 / 1
//   E5 el webhook con `?cuenta=` sin acotar las filas a ese negocio (`soloWs` sin pasar)                     → 6 / 1
//   E6 `wsDelEntorno` del correo vuelve al ws1 (`saleDeLaPlataforma` sin el correo)                         → 6 / 1
//   E7 la hidratación toma la del ws1 aunque la lectura de la plataforma haya fallado                       → 6 / 1
//   E8 la guía sin el paso de la clave de sólo envío                                                        → 5 / 2
//   E9 una operación sin cuenta, sin `falta: { servicio: 'email' }`                                         → 6 / 1
//   Y un cambio sin efecto (renombrar la variable local `propia` de `cuentaDeCorreo`) → 7 / 0.
//   E3 (la vía del DOMINIO sin pedir la cuenta propia) la caza tests/email-remitente.test.ts → 18 / 1: acá no se ve, porque
//   sin cuenta `sendEmail` ya no tiene clave con qué mandar (es la segunda capa).
// Y en tests/resend-clave-admin.test.ts (base 6 / 0): el negocio administra con la de administración → 4 / 2; la plataforma
// con la que manda → 4 / 2; el aviso de MaKo con la del negocio → 5 / 1; «no pude leer» cae a la de administración → 5 / 1.
//
// Correr: node --import tsx --test tests/email-cuenta-propia.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { cuentaDelPedido, guiaDelEmail, sinCuentaParaOperar, urlWebhookDeCuenta, type HechosEmail } from '../lib/email-cuenta-reglas';
import { KEY_SOLO_ENVIO_TUYA } from '../lib/resend-errores';

const RAIZ = join(import.meta.dirname, '..');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const correr = (esc: string): Record<string, any> => {
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_email-campana-hijo.ts'), esc], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], timeout: 120_000,
  });
  return JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length));
};

// ── 1) La guía ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const LISTO: HechosEmail = {
  cuenta: 'propia', clave: 'ok', dominio: 'elevate.com.mx', estadoDominio: 'verified', dominioNoEstaEnSuCuenta: false,
  registrosPendientes: 0, seguimiento: true, remitentePropio: true, envioReal: true,
};

test('la guía: un paso por vez, en orden, con lo que hay que hacer y la operación que sigue', () => {
  const paso = (h: Partial<HechosEmail>) => guiaDelEmail({ ...LISTO, ...h });
  assert.deepEqual([paso({ cuenta: 'sin_cuenta', clave: null }).paso, paso({ cuenta: 'sin_cuenta', clave: null }).siguiente, paso({ cuenta: 'sin_cuenta', clave: null }).conectar], ['sin_cuenta', 'estado_email', true]);
  assert.equal(paso({ cuenta: 'la_de_mako', clave: null }).paso, 'la_de_mako');
  assert.equal(paso({ cuenta: 'no_pude_leer' }).paso, 'no_pude_leer');
  assert.deepEqual([paso({ clave: 'solo_envio' }).paso, paso({ clave: 'solo_envio' }).conectar], ['clave_solo_envio', true]);
  assert.equal(paso({ clave: 'invalida' }).paso, 'clave_invalida');
  assert.deepEqual([paso({ dominio: null }).paso, paso({ dominio: null }).siguiente], ['sin_dominio', 'conectar_dominio_email']);
  assert.deepEqual([paso({ dominioNoEstaEnSuCuenta: true }).paso, paso({ dominioNoEstaEnSuCuenta: true }).siguiente], ['dominio_en_otra_cuenta', 'conectar_dominio_email']);
  assert.deepEqual([paso({ estadoDominio: 'pending', registrosPendientes: 2 }).paso, paso({ estadoDominio: 'pending' }).siguiente], ['dns_pendiente', 'verificar_dominio_envio']);
  assert.match(paso({ estadoDominio: 'pending', registrosPendientes: 2 }).que_hacer, /los 2 registros DNS de elevate\.com\.mx/);
  assert.deepEqual([paso({ seguimiento: false }).paso, paso({ seguimiento: false }).siguiente], ['sin_seguimiento', 'conectar_seguimiento_email']);
  assert.deepEqual([paso({ remitentePropio: false }).paso, paso({ remitentePropio: false }).siguiente], ['sin_remitente', 'fijar_remitente_email']);
  assert.deepEqual([paso({ envioReal: false }).paso, paso({ envioReal: false }).siguiente], ['envio_apagado', 'activar_envio_real_email']);
  assert.deepEqual([paso({}).paso, paso({}).listo, paso({}).siguiente], ['listo', true, null]);
  // Lo que traba todo va primero: sin cuenta no importa que falte el dominio.
  assert.equal(paso({ cuenta: 'sin_cuenta', clave: null, dominio: null, envioReal: false }).paso, 'sin_cuenta');
  // Lo que lee la persona: los pasos para crear la clave, sin links (el link lo pone el código), y en tú.
  const sin = paso({ cuenta: 'sin_cuenta', clave: null }).que_hacer;
  assert.match(sin, /resend\.com/);
  assert.match(sin, /Full access/);
  assert.match(sin, /gratis/);
  assert.doesNotMatch(sin, /https?:\/\//, 'el link no lo escribe el texto');
  assert.match(sinCuentaParaOperar('sin_cuenta'), /estado_email/, 'una operación que no puede, manda a la guía');
});

test('el webhook de un negocio: su URL lleva `?cuenta=`, y un número que no se lee no es ninguna cuenta', () => {
  assert.equal(urlWebhookDeCuenta('https://hola-mako.com/', 13), 'https://hola-mako.com/api/webhooks/resend?cuenta=13');
  assert.equal(cuentaDelPedido('13'), 13);
  for (const malo of [null, '', 'abc', '-1', '0', '1.5', '13 OR 1=1', '99999999999']) assert.equal(cuentaDelPedido(malo), null, String(malo));
});

// ── 2 y 3) El camino entero por la API, y el webhook del negocio ─────────────────────────────────────────────────────────
const C = correr('cuenta');

test('el camino ENTERO por la API: de «no tengo cuenta» a «listo», siguiendo lo que dice `siguiente`', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assert.deepEqual(C.camino.map((p: any) => [p.paso, p.siguiente]), [
    ['sin_cuenta', 'estado_email'], ['la_de_mako', 'estado_email'], ['clave_solo_envio', 'estado_email'],
    ['sin_dominio', 'conectar_dominio_email'], ['dns_pendiente', 'verificar_dominio_envio'], ['sin_seguimiento', 'conectar_seguimiento_email'],
    ['sin_remitente', 'fijar_remitente_email'], ['envio_apagado', 'activar_envio_real_email'], ['listo', null],
  ]);
  // Lo que se pega en MaKo trae el link EXACTO al modal (lo pone el código); lo demás, no.
  for (const p of C.camino.slice(0, 3)) {
    assert.match(String(p.link), /^https:\/\/hola-mako\.com\/integraciones\?abrir=email/, p.paso);
    assert.match(p.instruccion, /NUNCA le pidas la clave por el chat/, p.paso);
  }
  for (const p of C.camino.slice(3)) assert.equal(p.link, null, p.paso);
  assert.equal(C.conectar.ejecutar.ok, true, C.conectar.ejecutar.resumen);
  assert.equal(C.verificar.ejecutar.ok, true, C.verificar.ejecutar.resumen);
  assert.equal(C.seguimiento.ejecutar.ok, true, C.seguimiento.ejecutar.resumen);
  assert.equal(C.remitente.ejecutar.ok, true, C.remitente.ejecutar.resumen);
  assert.equal(C.activar.ok, true, 'prender el envío real lo confirma la persona (la pantalla corre el ejecutar)');
  assert.ok(C.activarPrep.payload, 'activar propone; no prende solo');
});

test('sin su cuenta, cada operación GUÍA (con `falta: email`) y no se le pide NADA a Resend ni se escribe nada', () => {
  const guia = { error: sinCuentaParaOperar('sin_cuenta'), falta: { servicio: 'email' } };
  assert.deepEqual(C.conectarSinCuenta, guia, 'conectar_dominio_email');
  assert.deepEqual(C.remitenteSinCuenta, guia, 'fijar_remitente_email');
  assert.deepEqual(C.seguimientoSinCuenta, guia, 'conectar_seguimiento_email');
  assert.equal(C.pedidosSinCuenta, 0, 'ni un pedido: su dominio caería en la cuenta de MaKo');
  assert.deepEqual(C.settingsSinCuenta, [], 'ni una línea en sus settings');
  // Con una clave de sólo envío, conectar el dominio frena ANTES de proponer, diciendo cuál crear.
  assert.deepEqual(C.conectarSoloEnvio, { error: KEY_SOLO_ENVIO_TUYA, falta: { servicio: 'email' } });
});

test('con su cuenta: el dominio, el webhook y su email van con SU clave, y el secreto queda guardado y no sale nunca', () => {
  assert.deepEqual(C.clavesConectar, ['re_del_negocio']);
  assert.deepEqual(C.webhooksCreados, [{
    endpoint: 'https://hola-mako.com/api/webhooks/resend?cuenta=3', cuenta: 're_del_negocio',
    events: ['email.opened', 'email.clicked', 'email.bounced', 'email.complained', 'email.received'],
  }], 'un webhook en SU cuenta, hacia MaKo, con los eventos que maneja la ruta');
  assert.equal(C.secretoGuardado, 1, 'el secreto, en su fila');
  assert.equal(C.webhooksTrasSeguimiento, 1, 'conectar el seguimiento otra vez reusa el que había: idempotente');
  assert.deepEqual(C.envio, [{ clave: 're_del_negocio', from: 'Mauricio <hola@elevate.com.mx>' }], 'su email, con su clave y desde su dominio');
  assert.equal(C.secretoEnLaSalida, false, 'el secreto no aparece en nada de lo que contesta la API');
  assert.deepEqual(C.enOtraCuenta.paso, 'dominio_en_otra_cuenta', 'un dominio que vivía en la cuenta de MaKo: se conecta de nuevo en la suya');
  assert.deepEqual(C.otros, [], 'nada salió a la red real');
});

test('el webhook de SU cuenta: entra con SU secreto, toca sólo SUS filas, y ninguna otra firma entra', () => {
  assert.deepEqual(C.eventoSuyo, { status: 200, body: { ok: true } });
  assert.equal(C.abiertoSuyo, true, 'su envío quedó abierto');
  assert.equal(C.eventoAjeno.status, 200, 'un email_id de otro negocio no es un error: se ignora');
  assert.deepEqual(C.ajenoIntacto, { rebote: null, baja: false }, 'con su secreto no se marca ni se da de baja nada de OTRO negocio');
  assert.equal(C.firmaDeOtro.status, 401, 'la firma de la cuenta de MaKo no vale para la de un negocio');
  assert.equal(C.suyoSinCuenta.status, 401, 'y la del negocio no vale sin `?cuenta=`');
  assert.equal(C.cuentaSinSecreto.status, 401, 'una cuenta sin secreto guardado no verifica nada');
  assert.equal(C.cuentaMala.status, 400, 'un `?cuenta=` ilegible');
});

// ── 4) El ws1 deja de ser la fuente de la clave de correo de MaKo ────────────────────────────────────────────────────────
test('el ws1: antes de la mudanza nada cambia; después, cada uno con la suya; con la plataforma caída, no se adivina', () => {
  const antes = correr('ws1-antes');
  assert.equal(antes.fuenteCorreo, 9, 'la fuente es la plataforma');
  assert.deepEqual([antes.fuenteIA, antes.fuenteMeta], [9, 1], 'la IA sigue en la plataforma y lo demás en el ws1');
  assert.equal(antes.entorno, 're_de_mako_en_el_ws1', 'sin su fila en la plataforma, la del ws1 sigue siendo la de MaKo: los avisos no se cortan');
  assert.equal(antes.cuentaWs1, 'la_de_mako', 'y no cuenta como la cuenta de Mauricio');

  const despues = correr('ws1-despues');
  assert.equal(despues.entorno, 're_de_la_plataforma', 'la de MaKo sale de la plataforma');
  assert.equal(despues.cuentaWs1, 'propia', 'Mauricio pegó la suya y es suya');
  assert.deepEqual(despues.claveAviso, ['re_de_la_plataforma'], 'lo que firma MaKo, desde el ws1, con la de MaKo');
  assert.deepEqual(despues.claveSuyo, ['re_de_mauricio'], 'su email, con la suya');

  const caida = correr('ws1-caida');
  assert.equal(caida.entorno, null, 'con la lectura de la plataforma caída, la del ws1 NO pasa a ser la de MaKo (puede ser la de Mauricio)');
  assert.equal(caida.cuentaWs1, 'no_pude_leer', '«no pude leer» no es «es suya»');
});
