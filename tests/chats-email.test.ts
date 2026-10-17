// =============================================================================
// El canal EMAIL de Chats (17/10/2026) — lib/chats-email-reglas.ts, lib/chats-email.ts y su cableado
// =============================================================================
// Martín: «eliminar las tabs de "Email y WhatsApp" y unificarlo todo en "Chats", y que por favor te asegures de que todo
// funcione bien». Lo que llega por email y lo que se contesta, con su hilo y sus adjuntos, en la bandeja.
//
// Lo que se fija acá, y por qué cada cosa:
//   · la dirección normalizada es la que hace segura a la clave `em:` y al filtro de la base (sin comas ni paréntesis);
//   · la respuesta sale en el HILO (`In-Reply-To`) y con «Re:» una sola vez;
//   · la burbuja muestra lo que el contacto ESCRIBIÓ, sin el hilo entero que su cliente de correo pega abajo;
//   · guardar el email en la bandeja NUNCA frena el disparo de las automatizaciones (va después, con `after`);
//   · el email del negocio sale con SU remitente (`sendEmail`), nunca con el de MaKo;
//   · la tabla es de inquilino (sin eso, un negocio vería los emails de todos).
//
// Probado ROMPIÉNDOLO, de a uno, con la base en 8 pases y 0 fallos (17/10/2026):
//   · `normalizarEmail` sin el control de la parte local (pasa «a,b@x.com»)   → 6 / 2
//   · `encabezadosDeRespuesta` acepta un salto de línea                       → 7 / 1
//   · `sinCita` sin «escribió»                                                → 7 / 1
//   · la bandeja ANTES del disparo de las automatizaciones                    → 7 / 1
//   · guardar sin `after()` (con `void`)                                      → 7 / 1
//   · sin `email_mensajes` en TABLAS_DE_INQUILINO                             → 7 / 1
//   · un envío fallido queda como 'ok'                                        → 7 / 1
//   · la ruta anota el lead sin verificar que es del negocio                  → 7 / 1
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  asuntoDeRespuesta, encabezadosDeRespuesta, htmlDeTexto, nombreDeArchivo, normalizarEmail, sinCita, textoDeHtml,
} from '../lib/chats-email-reglas';
import { claveEmail, parsearClave, contarBandejas } from '../lib/chats-reglas';
import { TABLAS_DE_INQUILINO } from '../lib/tablas-de-inquilino';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('una dirección se normaliza, y lo que no es un email no pasa (ni lo que rompería un filtro)', () => {
  assert.equal(normalizarEmail('  Ana Pérez <ANA@Negocio.com> '), 'ana@negocio.com');
  assert.equal(normalizarEmail('ana+ventas@negocio.com.ar'), 'ana+ventas@negocio.com.ar');
  for (const malo of ['', 'ana', 'ana@', '@negocio.com', 'a@b@c.com', 'ana@negocio', 'a,b@x.com', 'a(b)@x.com', 'a"b@x.com', 'a b@x.com', 42, null]) {
    assert.equal(normalizarEmail(malo), null, `«${String(malo)}» pasó`);
  }
});

test('la clave em: ida y vuelta, normalizada otra vez al leerla (viene del navegador)', () => {
  assert.equal(claveEmail('ana@negocio.com'), 'em:ana@negocio.com');
  assert.deepEqual(parsearClave('em:ana@negocio.com'), { tipo: 'email', email: 'ana@negocio.com' });
  assert.deepEqual(parsearClave('em:ANA@Negocio.com'), { tipo: 'email', email: 'ana@negocio.com' });
  assert.equal(parsearClave('em:no-es-un-email'), null);
  assert.equal(parsearClave('em:a,b@x.com'), null);
});

test('la respuesta va en el hilo: «Re:» una sola vez e In-Reply-To con el Message-ID del último', () => {
  assert.equal(asuntoDeRespuesta('Precio del curso'), 'Re: Precio del curso');
  assert.equal(asuntoDeRespuesta('RE: Precio del curso'), 'RE: Precio del curso');
  assert.equal(asuntoDeRespuesta('re:Precio'), 're:Precio');
  assert.equal(asuntoDeRespuesta('  '), 'Re:');
  assert.deepEqual(encabezadosDeRespuesta('abc@mail.gmail.com'), { 'In-Reply-To': '<abc@mail.gmail.com>', References: '<abc@mail.gmail.com>' });
  assert.deepEqual(encabezadosDeRespuesta('<abc@x>'), { 'In-Reply-To': '<abc@x>', References: '<abc@x>' });
  assert.equal(encabezadosDeRespuesta(null), undefined);
  assert.equal(encabezadosDeRespuesta('a\r\nBcc: otro@x.com'), undefined, 'un salto de línea en un encabezado es una inyección');
});

test('la burbuja muestra lo que el contacto escribió, sin el hilo que pega su cliente de correo', () => {
  assert.equal(sinCita('Sí, me interesa.\n\nEl jue, 16 oct 2026 a las 10:00, Ana <ana@x.com> escribió:\n> Hola'), 'Sí, me interesa.');
  assert.equal(sinCita('Perfect\n\nOn Thu, Oct 16, 2026 at 10:00 AM Ana wrote:\n> Hi'), 'Perfect');
  assert.equal(sinCita('Va.\n> lo de antes'), 'Va.');
  assert.equal(sinCita('Gracias\n\nDe: Ana\nEnviado: jueves'), 'Gracias');
  assert.equal(sinCita('> sólo una cita'), '> sólo una cita', 'si no queda nada, mejor el texto entero que una burbuja vacía');
  assert.equal(textoDeHtml('<p>Hola&nbsp;<b>Ana</b></p><p>Te paso el link</p><style>.x{}</style>'), 'Hola Ana\nTe paso el link');
  assert.equal(htmlDeTexto('a < b\nc'), '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">a &lt; b<br>c</div>');
  assert.equal(nombreDeArchivo('../../etc/passwd'), 'etcpasswd');
  assert.equal(nombreDeArchivo('Propuesta final (v2).pdf'), 'Propuesta-final-v2.pdf');
  assert.equal(nombreDeArchivo(''), 'archivo');
});

test('los contadores cuentan el email como un canal más', () => {
  const r = contarBandejas([], { nombre: 'Ana' });
  assert.deepEqual(r.porCanal.email, { abiertas: 0, nuevos: 0 });
});

test('guardar el email en la bandeja va DESPUÉS del disparo y no lo puede frenar', () => {
  const lib = sinComentarios(leer('lib/email-entrante.ts'));
  const recibir = lib.slice(lib.indexOf('export async function recibirEmailEntrante('));
  assert.ok(recibir.indexOf('enrolarPorEmailRecibido(lead.leadId)') < recibir.indexOf('aLaBandeja(ws, email.emailId, lead.leadId)'), 'la bandeja va antes del disparo');
  assert.match(recibir, /aLaBandeja\(ws, email\.emailId, null\);/, 'el email de alguien que no está en el CRM no llega a la bandeja');
  assert.match(lib, /after\(\(\) => runWithWorkspace\(ws, \(\) => guardarEmailEntrante\(\{ ws, resendId, leadId \}\)\)\)/, 'sin after(), un webhook lento se reintenta');
  // Y guardarlo no tira: un fallo se anota y devuelve false.
  const chats = sinComentarios(leer('lib/chats-email.ts'));
  const guardar = chats.slice(chats.indexOf('export async function guardarEmailEntrante('), chats.indexOf('async function escrituraEmail('));
  assert.match(guardar, /catch \(err\) \{\s+console\.error\(`\[chats-email\] \$\{input\.resendId\}: \$\{msg\(err\)\}`\);\s+return false;/);
});

test('lo que se contesta sale con el remitente DEL NEGOCIO, en el hilo, y queda en el hilo aunque falle', () => {
  const chats = sinComentarios(leer('lib/chats-email.ts'));
  const enviar = chats.slice(chats.indexOf('export async function enviarEmailDeChat('));
  assert.match(enviar, /if \(!w\.puede\) return \{ ok: false/, 'sin remitente propio no intenta mandar');
  assert.doesNotMatch(enviar, /REMITENTE_MAKO|from:/, 'un email del negocio no elige remitente: lo decide sendEmail (nunca MaKo)');
  assert.match(enviar, /headers: encabezadosDeRespuesta\(anterior\?\.message_id\)/);
  assert.ok(enviar.indexOf('await sendEmail(') < enviar.indexOf(".insert({"), 'la fila se escribe con el resultado del envío');
  assert.match(enviar, /estado: r\.ok \? 'ok' : 'fallido'/, 'un envío fallido no queda en el hilo');
  // La ruta verifica el lead DENTRO del negocio antes de anotarlo.
  const ruta = sinComentarios(leer('app/api/chats/email/route.ts'));
  assert.ok(ruta.indexOf('puertaChats()') < ruta.indexOf('enviarEmailDeChat('), 'la puerta va primero');
  assert.match(ruta, /from\('leads'\)\.select\('id'\)\.eq\('id', leadCrudo\)/, 'el lead del navegador se anota sin verificar');
});

test('la tabla es de inquilino, server-only, y sus adjuntos van a un bucket privado', () => {
  assert.ok((TABLAS_DE_INQUILINO as readonly string[]).includes('email_mensajes'), 'falta en TABLAS_DE_INQUILINO: el reset no la vaciaría');
  assert.match(leer('lib/workspace.ts'), /'email_mensajes',/, 'falta en TENANT_TABLES: getTenantDb no filtraría por negocio');
  const mig = leer('supabase/migrations/0312_email_mensajes.sql');
  assert.match(mig, /enable row level security/);
  assert.match(mig, /revoke all on email_mensajes from anon, authenticated/);
  assert.match(mig, /values \('chats-email', 'chats-email', false\)/, 'el bucket de los adjuntos tiene que ser privado');
  assert.match(mig, /create unique index if not exists email_mensajes_resend_id_uq on email_mensajes \(resend_id\)/, 'sin único, un reintento del webhook duplica el email');
});
