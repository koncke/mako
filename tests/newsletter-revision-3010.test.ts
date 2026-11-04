// =============================================================================
// Newsletter: lo que devolvió la revisión de envíos y privacidad (30/10/2026)
// =============================================================================
// C:/dev/revisiones/2910-revision-privacidad-newsletter-85d2206c9.md. Hoy no hay riesgo real porque nadie tiene el email prendido;
// todo esto es lo que tiene que estar cerrado antes de que alguien lo prenda.
//   M1. La tab y sus tres operaciones las usaba CUALQUIER admin de un negocio con capa completo o agencia: `adminOnly` sólo
//       esconde la fila de la barra. Puerta de verdad: app/newsletters/puerta.ts y `soloPlataforma` en la API.
//   M2. «Enviar ahora» mandaba una edición programada: si el cron la tomaba a la vez, cada suscripto la recibía dos veces.
//   M3. Lo programado con el envío apagado salía solo el día que se prendía, vencido; y de varias, la primera quemaba al resto.
//   M4. Archivar el CRM no frenaba sus ediciones programadas, y la tab dejaba de mostrarlas.
//
// PROBADO ROMPIÉNDOLO: scratchpad de la sesión, una rotura por regla, cada una con su rojo (ver el commit).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gatingOk, porId } from '../lib/api-mako/registro';
import { repartirVencidas, segmentoDeNewsletter, VENCIDA_MS } from '../lib/newsletter-reglas';

const RAIZ = resolve(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(resolve(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

const AHORA = Date.parse('2026-11-20T15:00:00.000Z');
const hace = (horas: number) => new Date(AHORA - horas * 3_600_000).toISOString();
const ed = (id: number, funnelId: number, horas: number) => ({ id, segmento: segmentoDeNewsletter(funnelId), programado_at: hace(horas) });
const ACTIVOS: ReadonlySet<number> = new Set([7]);

test('M1: las tres operaciones son sólo de la plataforma, también con la tab en su capa', () => {
  for (const id of ['ver_newsletter', 'configurar_newsletter', 'crear_edicion_newsletter']) {
    const def = porId(id);
    assert.ok(def, `no existe ${id}`);
    assert.equal(gatingOk(def, { ws: 21, rol: 'admin', tabs: ['newsletters'], plataforma: false }), false, `${id}: el admin de un negocio entra`);
    assert.equal(gatingOk(def, { ws: 9, rol: 'admin', tabs: ['newsletters'], plataforma: true }), true, `${id}: la plataforma no entra`);
  }
});

test('M1: la página y todas las acciones pasan por la puerta, y la puerta exige super admin sin impersonar', () => {
  const puerta = leer('app/newsletters/puerta.ts');
  assert.match(puerta, /await requireRolWs\(\[\], \{ nav: 'newsletters' \}\);\s*if \(!\(await getSesionAdmin\(\)\) \|\| \(await estaImpersonando\(\)\)\) redirect\('\/'\);/);
  assert.match(leer('app/newsletters/page.tsx'), /export default async function Page[^\n]*\n\s*await puertaNewsletter\(\);/);
  assert.doesNotMatch(leer('app/newsletters/page.tsx'), /requireRolWs/, 'la página volvió a la puerta de cualquier admin');
  const acciones = leer('app/newsletters/actions.ts');
  assert.match(acciones, /const puerta = puertaNewsletter;/);
  assert.doesNotMatch(acciones, /requireRolWs/, 'las acciones volvieron a la puerta de cualquier admin');
});

test('M2: una edición programada no sale con «Enviar ahora», ni en el server ni en el botón', () => {
  const a = leer('app/newsletters/actions.ts');
  const enviar = a.slice(a.indexOf('export async function enviarAction'));
  const guarda = enviar.indexOf("if (e.estado === 'programado') return { ok: false");
  assert.ok(guarda > 0 && guarda < enviar.indexOf('enviarBroadcast(id)'), 'manda una programada');
  assert.match(leer('app/newsletters/NewslettersApp.tsx'), /disabled=\{ocupado \|\| !estado\.envioReal \|\| edicion\.estado === 'programado'\}/);
});

test('M3: vencida hace más de un día no sale sola: vuelve a borrador', () => {
  assert.equal(VENCIDA_MS, 24 * 3_600_000);
  assert.deepEqual(repartirVencidas([ed(1, 7, 25)], ACTIVOS, AHORA), { salen: [], aBorrador: [1], cancelar: [] });
  assert.deepEqual(repartirVencidas([ed(1, 7, 23)], ACTIVOS, AHORA), { salen: [1], aBorrador: [], cancelar: [] }, 'la noche del cron no la quema');
  assert.deepEqual(repartirVencidas([{ id: 1, segmento: segmentoDeNewsletter(7), programado_at: null }], ACTIVOS, AHORA).aBorrador, [1]);
});

test('M3: de varias vencidas del mismo CRM sale sólo la última, sin importar el orden; las otras no se queman', () => {
  for (const filas of [[ed(1, 7, 20), ed(2, 7, 2), ed(3, 7, 10)], [ed(2, 7, 2), ed(3, 7, 10), ed(1, 7, 20)]]) {
    const r = repartirVencidas(filas, ACTIVOS, AHORA);
    assert.deepEqual(r.salen, [2]);
    assert.deepEqual([...r.aBorrador].sort(), [1, 3]);
  }
  // Las de dos CRM distintos no se pisan.
  assert.deepEqual([...repartirVencidas([ed(1, 7, 2), ed(2, 8, 2)], new Set([7, 8]), AHORA).salen].sort(), [1, 2]);
});

test('M4: con el CRM archivado se cancela, y sus destinatarios son nadie', () => {
  assert.deepEqual(repartirVencidas([ed(1, 99, 1)], ACTIVOS, AHORA), { salen: [], aBorrador: [], cancelar: [1] });
  const nl = leer('lib/newsletter.ts');
  const dest = nl.slice(nl.indexOf('export async function destinatariosDeNewsletter'));
  const corte = dest.indexOf('if (!(await existeCrm(seg.funnelId))) return [];');
  assert.ok(corte > 0 && corte < dest.indexOf('suscriptosDe(seg.funnelId)'), 'un CRM archivado sigue teniendo a quién escribirle');
});

test('lo que no es una edición sale como siempre; sin poder leer los CRM, las ediciones esperan y las demás siguen', () => {
  const comun = { id: 5, segmento: 'todos', programado_at: hace(24 * 40) };
  assert.deepEqual(repartirVencidas([comun, ed(1, 7, 1)], ACTIVOS, AHORA).salen, [5, 1], 'un broadcast común vencido sale igual');
  assert.deepEqual(repartirVencidas([comun, ed(1, 7, 1)], null, AHORA), { salen: [5], aBorrador: [], cancelar: [] }, 'sin leer los CRM se tocó una edición');
});

test('el cron usa la regla: sólo manda lo que `salen`, y lo que no sale lo escribe condicionado al estado', () => {
  const em = leer('lib/email-marketing.ts');
  const fn = em.slice(em.indexOf('export async function procesarBroadcastsProgramados'), em.indexOf('// ── Webhook de Resend'));
  assert.match(fn, /const \{ salen, aBorrador, cancelar \} = repartirVencidas\(vencidas, crms, Date\.now\(\)\);/);
  assert.match(fn, /const ids = \[\.\.\.new Set\(\[\s*\.\.\.salen,/, 'el cron manda las programadas sin mirar la regla');
  assert.match(fn, /update\(\{ estado: 'borrador', programado_at: null,[^\n]*\.in\('id', aBorrador\)\.eq\('estado', 'programado'\)/);
  assert.match(fn, /update\(\{ estado: 'cancelado',[^\n]*\.in\('id', cancelar\)\.eq\('estado', 'programado'\)/);
});
