// =============================================================================
// Un email que LLEGA dispara las automatizaciones de su lead (sexta tanda, CRON 8)
// =============================================================================
// «Si recibo un email, que se pueda configurar automatizaciones». Las reglas son puras
// (lib/email-entrante-reglas.ts) y se EJECUTAN acá con el cuerpo del ejemplo de la doc oficial de
// Resend («Received email» webhook, `email.received`). El cableado (la firma, la lectura estricta, la
// fila antes del disparo, el workspace de la base) se fija en el fuente, recortado a su función.
//
// PROBADO ROMPIÉNDOLO: ver `ROTURAS` al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  leerEmailRecibido, workspaceDelEmail, leadDelEmail, esRemitenteAutomatico, escaparIlike, direccionDeCorreo, yaProcesado,
  ESTADOS_ENTRANTE, EVENTO_EMAIL_RECIBIDO,
} from '../lib/email-entrante-reglas';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** El ejemplo de la doc de Resend, tal cual (con la forma «Nombre <mail>» en el `from`). */
const EJEMPLO = {
  type: 'email.received',
  created_at: '2026-02-22T23:41:12.126Z',
  data: {
    email_id: '56761188-7520-42d8-8898-ff6fc54ce618',
    created_at: '2026-02-22T23:41:11.894Z',
    from: 'Ana Pérez <Ana.Perez@Gmail.com>',
    to: ['ventas@negocio.com'],
    bcc: [],
    cc: [],
    received_for: ['hola@inbox.negocio.com'],
    message_id: '<111-222-333@email.example.com>',
    subject: 'Sending this example',
    attachments: [{ id: '2a0c', filename: 'avatar.png', content_type: 'image/png', content_disposition: 'inline', content_id: 'img001' }],
  },
};

test('leer un email.received: el id, quién lo manda y a quiénes llegó (received_for primero), en minúsculas', () => {
  const e = leerEmailRecibido(EJEMPLO);
  assert.ok(e);
  assert.equal(e.emailId, '56761188-7520-42d8-8898-ff6fc54ce618');
  assert.equal(e.de, 'ana.perez@gmail.com');
  assert.deepEqual(e.para, ['hola@inbox.negocio.com', 'ventas@negocio.com']);
  assert.equal(e.asunto, 'Sending this example');
  assert.equal(e.recibidoAt, '2026-02-22T23:41:11.894Z');
  // Lo que no es un email recibido, o le falta lo que decide, no se usa.
  assert.equal(leerEmailRecibido({ ...EJEMPLO, type: 'email.opened' }), null);
  assert.equal(leerEmailRecibido({ ...EJEMPLO, data: { ...EJEMPLO.data, email_id: '' } }), null);
  assert.equal(leerEmailRecibido({ ...EJEMPLO, data: { ...EJEMPLO.data, from: 'nadie' } }), null);
  assert.equal(leerEmailRecibido({ ...EJEMPLO, data: { ...EJEMPLO.data, to: [], received_for: [] } }), null);
  assert.equal(leerEmailRecibido('basura'), null);
  assert.equal(direccionDeCorreo('"Ana, P" <a@b.co>'), 'a@b.co');
  assert.equal(direccionDeCorreo('a@b'), null, 'sin TLD no es una dirección');
});

test('de quién es: del workspace que RECLAMÓ el dominio; un subdominio cuenta, y el exacto le gana', () => {
  const reclamados = [{ ws: 11, dominio: 'negocio.com' }, { ws: 4, dominio: 'otro.com' }];
  assert.deepEqual(workspaceDelEmail(['hola@inbox.negocio.com'], reclamados), { ws: 11 }, 'el MX va en un subdominio');
  assert.deepEqual(workspaceDelEmail(['x@negocio.com'], reclamados), { ws: 11 });
  assert.deepEqual(workspaceDelEmail(['x@minegocio.com'], reclamados), { ws: null, motivo: 'sin_dominio' }, '«minegocio.com» no es un subdominio de «negocio.com»');
  // El exacto (o el más largo) gana: un subdominio reclamado aparte es de quien lo reclamó.
  assert.deepEqual(workspaceDelEmail(['x@inbox.negocio.com'], [...reclamados, { ws: 9, dominio: 'inbox.negocio.com' }]), { ws: 9 });
  assert.deepEqual(workspaceDelEmail(['x@NEGOCIO.com'.toLowerCase()], [{ ws: 11, dominio: ' Negocio.COM ' }]), { ws: 11 });
});

test('estricto: dos workspaces, o un dominio reclamado dos veces, y no es de nadie', () => {
  const reclamados = [{ ws: 11, dominio: 'negocio.com' }, { ws: 4, dominio: 'otro.com' }];
  assert.deepEqual(workspaceDelEmail(['a@negocio.com', 'b@otro.com'], reclamados), { ws: null, motivo: 'ambiguo' });
  assert.deepEqual(workspaceDelEmail(['a@negocio.com'], [{ ws: 11, dominio: 'negocio.com' }, { ws: 12, dominio: 'negocio.com' }]), { ws: null, motivo: 'ambiguo' });
  // Dos direcciones del MISMO negocio no son ambiguas.
  assert.deepEqual(workspaceDelEmail(['a@negocio.com', 'b@inbox.negocio.com'], reclamados), { ws: 11 });
  assert.deepEqual(workspaceDelEmail(['a@negocio.com'], []), { ws: null, motivo: 'sin_dominio' });
});

test('el lead: el que tiene ESE email, exacto; con dos, ninguno; el patrón se escapa', () => {
  assert.deepEqual(leadDelEmail([{ id: 7, email: 'Ana.Perez@gmail.com ' }], 'ana.perez@gmail.com'), { leadId: 7 });
  // El patrón `ilike` trae de más (`_` es un comodín): la igualdad exacta lo descarta.
  assert.deepEqual(leadDelEmail([{ id: 8, email: 'juanXperez@x.com' }], 'juan_perez@x.com'), { leadId: null, motivo: 'sin_lead' });
  assert.deepEqual(leadDelEmail([{ id: 7, email: 'a@x.com' }, { id: 9, email: 'A@x.com' }], 'a@x.com'), { leadId: null, motivo: 'ambiguo' }, 'no se elige el primero');
  assert.deepEqual(leadDelEmail([{ id: 7, email: 'a@x.com' }, { id: 7, email: 'a@x.com' }], 'a@x.com'), { leadId: 7 }, 'el mismo lead dos veces es uno');
  assert.deepEqual(leadDelEmail([], 'a@x.com'), { leadId: null, motivo: 'sin_lead' });
  assert.equal(escaparIlike('juan_perez%1\\@x.com'), 'juan\\_perez\\%1\\\\@x.com');
});

test('lo automático no dispara: un rebote o un «no responder»', () => {
  for (const d of ['mailer-daemon@googlemail.com', 'no-reply@negocio.com', 'noreply+x@a.com', 'postmaster@a.com', 'bounces@a.com']) {
    assert.equal(esRemitenteAutomatico(d), true, d);
  }
  for (const d of ['ana@gmail.com', 'replyto@a.com', 'noreplying.fan@a.com']) assert.equal(esRemitenteAutomatico(d), false, d);
});

test('la deduplicación: sólo un «error» se vuelve a procesar', () => {
  for (const e of ESTADOS_ENTRANTE) assert.equal(yaProcesado(e), e !== 'error', e);
  assert.equal(yaProcesado(null), false);
});

test('el cableado: la firma, la lectura estricta, la fila ANTES del disparo, y el disparo por UNA puerta', () => {
  const ruta = sinComentarios(leer('app/api/webhooks/email-entrante/route.ts'));
  assert.match(ruta, /if \(!secretos\.some\(\(s\) => verifyResendSignature\(rawBody, headers, s\)\)\) \{[\s\S]{0,200}status: 401/, 'sin firma válida no se procesa nada');
  assert.ok(ruta.indexOf('verifyResendSignature(') < ruta.indexOf('recibirEmailEntrante('), 'se procesa antes de verificar la firma');
  const lib = sinComentarios(leer('lib/email-entrante.ts'));
  // Estricta: el error de la base TIRA (y lo clasifica `fallo`: 503 sólo si es transitorio).
  const dominios = lib.slice(lib.indexOf('export async function dominiosReclamados('), lib.indexOf('export type RespuestaEntrante'));
  assert.match(dominios, /if \(error\) \{\n\s+throw /, 'con la base caída, «no pude leer» se contestaría «no es de nadie»');
  assert.match(lib, /return transitorio\n\s+\? responder\(503,/);
  // El orden: ruteo → fila (dedup) → lead adentro de su workspace → disparo.
  const recibir = lib.slice(lib.indexOf('export async function recibirEmailEntrante('));
  const iRuteo = recibir.indexOf('await dominiosReclamados()');
  const iFila = recibir.indexOf('await abrirFila(');
  const iDup = recibir.indexOf("if (fila === 'duplicado')");
  const iWs = recibir.indexOf('runWithWorkspace(ws,');
  const iDisparo = recibir.indexOf('await enrolarPorEmailRecibido(');
  assert.ok(iRuteo > 0 && iFila > iRuteo && iDup > iFila && iWs > iDup && iDisparo > iWs, 'ruteo → fila → duplicado → workspace → disparo');
  // El bloque EXACTO: un `[\s\S]{0,200}` llegaba al `return` del duplicado de abajo y daba verde sin él.
  assert.match(recibir, /if \(esTablaQueFalta\(code\)\) \{\n\s+console\.error\([^\n]*\n\s+return responder\(200, \{ ok: false, error: 'sin_tabla' \}\);\n\s+\}/, 'sin la tabla no se dispara (no hay cómo deduplicar)');
  // El lead: el patrón escapado, y en el workspace del email (nunca el de la sesión: no hay).
  assert.match(recibir, /\.from\('leads'\)\.select\('id, email'\)\.ilike\('email', escaparIlike\(email\.de\)\)/);
  // UNA puerta al motor, SIN casts (segunda pasada de la sexta tanda: el evento ya existe en
  // `EventoNutricion`), y con el `ctx` que lee `disparaPorEvento` (el subtipo del CRON de email).
  assert.equal((lib.match(/enrolarPorEvento\(/g) ?? []).length, 1, 'el evento se dispara por un solo lugar');
  const disparo = lib.slice(lib.indexOf('export async function enrolarPorEmailRecibido('), lib.indexOf('export async function dominiosReclamados('));
  assert.ok(disparo.length > 0 && disparo.length < 400, `el recorte de la puerta mide ${disparo.length}`);
  assert.match(disparo, /const ctx: CtxEvento = \{ subtipo: EVENTOS_EMAIL\[0\]\.subtipo \};\n\s+return enrolarPorEvento\(leadId, EVENTO_EMAIL_RECIBIDO, ctx\);/);
  assert.doesNotMatch(disparo, /\bas (unknown|EventoNutricion|CtxEvento)\b/, 'volvió un cast: un evento que el motor no conoce compila y no inscribe a nadie');
  assert.equal(EVENTO_EMAIL_RECIBIDO, 'email_recibido');
  // «No pude leer de quién es» se ANOTA en el super admin, como en los demás webhooks.
  assert.match(recibir, /try \{ reclamados = await dominiosReclamados\(\); \} catch \(e\) \{ return falloDeRuteo\(e, email\.para\[0\] \?\? null\); \}/);
  assert.match(lib, /const r = await responderFalloDeRuteo\('email', e, identificador\);/);
  // Y el webhook de siempre de Resend (ya suscripto a `email.received`) lo manda a la MISMA función.
  const resend = sinComentarios(leer('app/api/webhooks/resend/route.ts'));
  assert.match(resend, /case 'email\.received': \{\n\s+const r = await recibirEmailEntrante\(evt\);\n\s+return Response\.json\(r\.body, \{ status: r\.status \}\);/,
    'sin el case, un mail que llega al webhook de siempre cae al `default` y se pierde con un 200');
  assert.ok(resend.indexOf("case 'email.received'") < resend.indexOf('default:'), 'el case va antes del default');
  // Ruteo por el dominio RECLAMADO, nunca por el remitente (el del ws1 es el de la plataforma).
  assert.match(dominios, /\.eq\('key', 'resend_domain'\)/);
  assert.doesNotMatch(lib, /resend_from/, 'rutear por el remitente le daría a un cliente los mails de MaKo');
});

test('la migración: email_id único, los mismos estados que el código, y cerrada a anon', () => {
  const mig = leer('supabase/migrations/0245_email_entrantes.sql');
  assert.match(mig, /ORDEN DE DESPLIEGUE/);
  assert.match(mig, /create unique index if not exists email_entrantes_email_id_uk on email_entrantes \(email_id\);/);
  const estados = /estado\s+text not null check \(estado in \(([^)]*)\)\)/.exec(mig)?.[1];
  assert.ok(estados, 'sin el CHECK de los estados');
  assert.deepEqual(estados.split(',').map((s) => s.trim().replace(/'/g, '')), [...ESTADOS_ENTRANTE]);
  assert.match(mig, /workspace_id\s+bigint references workspaces\(id\)/, 'un email de ningún negocio también queda escrito (sin `not null`)');
  assert.match(mig, /alter table email_entrantes enable row level security;\nrevoke all on email_entrantes from anon, authenticated;/);
});

// ── ROTURAS (09/10/2026) ───────────────────────────────────────────────────────────────────────
// Con el arnés del scratchpad (rompe UNA, corre este archivo, restaura DE MEMORIA con md5; nunca git).
// Base: 8 / 0. Las 18 cayeron, cada una 7 / 1:
//   · reglas: el subdominio no cuenta · el sufijo sin el punto («minegocio.com» de «negocio.com») ·
//     dos workspaces y gana el primero · el reclamo que contiene empata con el exacto · el lead sin la
//     igualdad exacta · con dos leads, el primero · sin `received_for` · el escape sin el `_` · un
//     rebote dispara · un «error» cuenta como procesado.
//   · lib: la lectura de dominios tolerante · sin la tabla dispara igual (⚠ la PRIMERA versión del
//     guard dio 8 / 0: su `[\s\S]{0,200}` llegaba al `return` del duplicado; con el bloque exacto,
//     7 / 1) · el lead sin escapar el patrón · rutear por `resend_from` · 503 para todo.
//   · la ruta sin verificar la firma · la migración sin el índice único · el CHECK sin un estado.
// Segunda pasada de la sexta tanda (09/10/2026, base 8 / 0), las tres 7 / 1: vuelve un cast en la
// puerta del disparo · el ruteo que falla vuelve al log (`fallo('ruteo', e)`) en vez de anotarse · el
// webhook de siempre de Resend sin el `case 'email.received'`.
