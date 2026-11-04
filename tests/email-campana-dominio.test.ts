// =============================================================================
// El dominio y el remitente de email, por la API de MaKo (4/11/2026, puntos 1 y 2 de la campaña de Mauricio)
// =============================================================================
// Martín: «Revisa mi ultima llamada con Mauricio, porque el va a comenzar a hacer campaña de email a sus leads, le di
// instrucciones de como configurarlo con la API de MaKo desde su claude, pero estoy seguro que hay cosas que aun no
// funcionan». Lo primero que pide la receta es su dominio, y hasta ese día sólo se conectaba en /email.
//
// Corre el código REAL (tests/_email-campana-hijo.ts, escenario «dominio»): los runners de la API, lib/email-dominio.ts,
// lib/resend.ts y los broadcasts, contra una base en memoria y un Resend de mentira. Lo que se mira es lo que queda
// escrito y lo que se le pidió a Resend.
//
// Probado ROMPIÉNDOLO (4/11/2026), de a una, sobre una base de 9 / 0: sin el seguimiento en `createResendDomain` → 8 / 1;
// sin prenderlo al verificar → 8 / 1; sin el chequeo del dominio de MaKo en `prepararConexion` → 8 / 1; sin `replyTo` en el
// broadcast → 8 / 1. Restaurado, 9 / 0.
//
// Correr: node --import tsx --test tests/email-campana-dominio.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { normalizarDominio, armarRemitente, sanearResponderA, DOMINIO_INVALIDO, RESPONDER_A_INVALIDO } from '../lib/email-dominio-reglas';
import { NO_ES_TUYO } from '../lib/email-remitente';

const RAIZ = join(import.meta.dirname, '..');
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_email-campana-hijo.ts'), 'dominio'], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], timeout: 120_000,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;

test('las reglas: el dominio sale de una URL o de un email, y la dirección de respuestas es un email', () => {
  assert.equal(normalizarDominio('https://www.Elevate.com.mx/inicio'), 'elevate.com.mx');
  assert.equal(normalizarDominio('hola@elevate.com.mx'), 'elevate.com.mx');
  assert.equal(normalizarDominio('no es un dominio'), null);
  assert.equal(sanearResponderA(' Mauricio.Personal@Gmail.com '), 'mauricio.personal@gmail.com');
  for (const malo of ['mauricio arroba gmail', 'a@b', 'x@y.com\r\nBcc: z@w.com', 'Nombre <a@b.com>', '']) assert.equal(sanearResponderA(malo), null, malo);
  assert.deepEqual(armarRemitente('Hola', 'Mauricio <x>', 'elevate.com.mx'), { ok: true, from: 'Mauricio x <hola@elevate.com.mx>' });
  assert.equal(armarRemitente('ho la', 'Mauricio', 'elevate.com.mx').ok, false);
});

test('no se conecta un dominio de MaKo, ni uno de otro negocio, ni algo que no es un dominio: antes de tocar Resend', () => {
  assert.equal(R.deMako.error, NO_ES_TUYO);
  assert.match(R.deOtro.error, /ya está conectado en otro negocio/);
  assert.equal(R.invalido.error, DOMINIO_INVALIDO);
  assert.equal(R.resendAntes, 0, 'ninguno de los tres le pidió nada a Resend');
});

test('tampoco se arma un remitente con un dominio de MaKo cargado, y el estado dice si el negocio es la plataforma', () => {
  assert.equal(R.remitenteDeMako.error, NO_ES_TUYO);
  assert.equal(R.plataformaNegocio, false);
  assert.equal(R.plataformaMaKo, true);
});

test('conectar da de alta el dominio, lo guarda y devuelve los registros DNS para cargar', () => {
  assert.equal(R.prepConectar.payload.dominio, 'elevate.com.mx');
  assert.equal(R.conectar.ok, true);
  assert.equal(R.dominioGuardado, 'elevate.com.mx');
  assert.equal(R.idGuardado, 'dom-elevate.com.mx');
  assert.equal(R.conectar.datos.registros.length, 2);
  assert.deepEqual(R.conectar.datos.registros.map((r: { tipo: string }) => r.tipo), ['TXT', 'MX']);
  assert.match(R.conectar.resumen, /TXT resend\._domainkey → p=MIGf/);
});

test('punto 2: al crear el dominio se prenden las aperturas y los clics (PATCH /domains/{id})', () => {
  assert.deepEqual(R.patches, [{ path: '/domains/dom-elevate.com.mx', body: { open_tracking: true, click_tracking: true } }]);
  assert.equal(R.dominioEnResend.open_tracking, true);
  assert.equal(R.dominioEnResend.click_tracking, true);
  assert.equal(R.conectar.datos.seguimiento, true);
});

test('punto 2: verificar un dominio con el seguimiento apagado (uno de antes) lo prende', () => {
  assert.equal(R.verificar.ok, true);
  assert.deepEqual(R.trasVerificar, { open: true, click: true });
  assert.match(R.verificar.resumen, /Prendí las aperturas y los clics/);
});

test('el remitente exige el dominio verificado, y la dirección de respuestas tiene que ser un email', () => {
  assert.match(R.remitenteSinVerificar.error, /todavía no está verificado/);
  assert.equal(R.responderAMalo.error, RESPONDER_A_INVALIDO);
  assert.equal(R.remitente.ok, true);
  assert.equal(R.from, 'Mauricio x <hola@elevate.com.mx>');
  assert.equal(R.replyTo, 'mauricio.personal@gmail.com');
});

test('el reply_to viaja en el broadcast y en su prueba', () => {
  assert.equal(R.envio.enviados, 1);
  assert.equal(R.emails.length, 2);
  for (const e of R.emails) {
    assert.equal(e.from, 'Mauricio x <hola@elevate.com.mx>');
    assert.equal(e.reply_to, 'mauricio.personal@gmail.com', `a ${e.to}`);
  }
});

test('sacar la dirección de respuestas la deja vacía (vuelven al remitente)', () => {
  assert.equal(R.sinResponderA.ok, true);
  assert.equal(R.sinResponderA.datos.responderA, null);
  assert.equal(R.replyToTrasSacar, '');
});

test('nada salió a la red real, y la base de mentira entendió todo', () => {
  assert.deepEqual(R.otros, []);
  assert.deepEqual(R.sinMock, []);
});
