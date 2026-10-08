// =============================================================================
// El poll de leads de Meta corre cada 10 minutos y no le roba un lead al webhook
// =============================================================================
// Pedido de Joan (08/10/2026, vía Martín): «Y lo más importante: Llegó un nuevo lead form de
// Brigitte pero no se cargó en el CRM». La página de ws15 no está suscripta a nuestra app, así
// que el webhook no se entera, y el poll corría UNA vez por día: leads con 10 a 19 h de demora.
// El porqué y lo medido, en lib/meta-leads-poll-reglas.ts.
//
// Correr: npx tsx --test tests/meta-leads-poll-frecuente.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (08/10/2026):
//   - volver el schedule a "30 13 * * *" → 4 pases / 1 fallo;
//   - sacar el `continue` del guardia en pollMetaLeads → 4 / 1;
//   - EDAD_MINIMA_POLL_MS = 0 → 4 / 1;
//   - que la de las 13:30 repase 1 día en vez de 7 → 4 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  esDelWebhookTodavia,
  ventanaDelPoll,
  DIAS_PASADA_DIARIA,
  DIAS_PASADA_FRECUENTE,
} from '../lib/meta-leads-poll-reglas';

const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('vercel.json agenda el poll cada 10 minutos, no una vez por día', () => {
  const crons = (JSON.parse(leer('vercel.json')) as { crons: Array<{ path: string; schedule: string }> }).crons;
  const c = crons.find((x) => x.path === '/api/cron/meta-leads-poll');
  assert.ok(c, 'el poll no está agendado');
  assert.equal(c!.schedule, '*/10 * * * *', 'una página sin suscribir vuelve a esperar hasta un día');
});

test('un lead de menos de 5 minutos es del webhook; uno de 6, del poll', () => {
  const ahora = Date.parse('2026-10-08T15:30:00Z');
  assert.equal(esDelWebhookTodavia('2026-10-08T15:28:00+0000', ahora), true);   // 2 min
  assert.equal(esDelWebhookTodavia('2026-10-08T15:24:00+0000', ahora), false);  // 6 min
  // Nicolas: entró a las 13:46 y a las 15:30 sigue afuera. El guardia no lo frena.
  assert.equal(esDelWebhookTodavia('2026-10-08T13:46:18+0000', ahora), false);
  // Sin fecha (o ilegible) no hay carrera que evitar: se toma.
  assert.equal(esDelWebhookTodavia(undefined, ahora), false);
  assert.equal(esDelWebhookTodavia('no es fecha', ahora), false);
});

test('la ventana: la de las 13:30 UTC repasa la semana, el resto el último día, y ?dias= manda', () => {
  assert.equal(ventanaDelPoll(new Date('2026-10-08T13:30:04Z'), null), DIAS_PASADA_DIARIA);
  assert.equal(ventanaDelPoll(new Date('2026-10-08T13:39:59Z'), null), DIAS_PASADA_DIARIA);
  assert.equal(ventanaDelPoll(new Date('2026-10-08T13:40:00Z'), null), DIAS_PASADA_FRECUENTE);
  assert.equal(ventanaDelPoll(new Date('2026-10-08T15:50:00Z'), null), DIAS_PASADA_FRECUENTE);
  assert.equal(DIAS_PASADA_DIARIA, 7, 'la red diaria de siempre (antes: ?dias por defecto 7)');
  assert.equal(ventanaDelPoll(new Date('2026-10-08T15:50:00Z'), '90'), 90);
  assert.equal(ventanaDelPoll(new Date('2026-10-08T15:50:00Z'), '500'), 90, 'Meta retiene 90 días');
  assert.equal(ventanaDelPoll(new Date('2026-10-08T15:50:00Z'), 'x'), DIAS_PASADA_FRECUENTE);
  assert.equal(ventanaDelPoll(new Date('2026-10-08T15:50:00Z'), ''), DIAS_PASADA_FRECUENTE);
});

test('pollMetaLeads saltea al del webhook ANTES de upsertear (y la ruta usa la ventana)', () => {
  const src = sinComentarios(leer('lib/meta-leads.ts'));
  const guardia = src.search(/if \(esDelWebhookTodavia\(lr\.created_time, ahoraMs\)\) \{ delWebhook\+\+; continue; \}/);
  const upsert = src.indexOf('await upsertLeadFromMeta(');
  assert.ok(guardia > 0, 'pollMetaLeads ya no deja los recién llegados al webhook');
  assert.ok(upsert > guardia, 'el guardia tiene que ir antes del upsert');
  const ruta = sinComentarios(leer('app/api/cron/meta-leads-poll/route.ts'));
  assert.match(ruta, /ventanaDelPoll\(new Date\(\), request\.nextUrl\.searchParams\.get\('dias'\)\)/);
});

test('el poll sigue sin mandar la conversión Lead (decisión de meta-capi-lead-id)', () => {
  // Cada 10 minutos no cambia la regla: el poll no es el lugar del evento `Lead`.
  assert.doesNotMatch(leer('lib/meta-leads.ts'), /sendMetaCAPIEvent/);
});
