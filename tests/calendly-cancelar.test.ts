// =============================================================================
// 4c: «Cancelar su reunión» de Calendly como ⚡ Acción de un flujo (17/10/2026)
// =============================================================================
// Martín (16/10, por Cerebro, punto 4): «ACCIONES de Calendly (crear y editar eventos) para el paso ⚡ Acción». Lo que
// un flujo hace solo sin inventar un dato es CANCELAR la próxima reunión del lead: crear pide la hora que elige él, y la
// API de Calendly no deja editar (lib/calendly-cancelar.ts). La acción `cancelar_reunion_calendly` (lib/api-mako/areas):
//   · elige la reunión en `preparar` (la que la persona VIO) y al confirmar la vuelve a buscar: si la próxima ya no es
//     ésa, no cancela otra;
//   · sin ninguna por delante es «ya está así» (en un flujo, éxito sin alarma al dueño);
//   · no viaja cuando el pedido es mover algo de día, ni a un negocio sin Calendly (lib/doer-herramientas.ts).
//
// PROBADO ROMPIÉNDOLO (17/10/2026, arnés `romper.py` + `roturas-4c.json`; base 3 / 0). Pasan / fallan:
//   C1 la próxima sin filtrar las que ya empezaron                                            → 2 / 1
//   C2 al confirmar, sin volver a mirar que siga siendo la próxima                           → 2 / 1
//   C3 sin reunión por delante como un error (sin `yaEstaba`)                                  → 2 / 1
//
// Correr: node --import tsx --test tests/calendly-cancelar.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { accionDelFlujo, GRUPOS_ACCION, AREA_DE_GRUPO } from '../lib/editor-acciones';
import { DE_CALENDLY, NO_MUEVEN_DE_DIA } from '../lib/doer-herramientas';
import { porId } from '../lib/api-mako/registro';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string): string => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const url = (rel: string): string => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);

// Calendly de mentira: dos reuniones del invitado, una que YA empezó y la de mañana. Se anota cada pedido.
const HIJO = `
import { mock } from 'node:test';
const real = (m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'default' && k !== 'module.exports'));
const cred = await import(${url('lib/credenciales.ts')});
mock.module(${url('lib/credenciales.ts')}, { exports: { ...real(cred), credWs: async () => 'tok' } });
const ahora = Date.parse('2026-10-17T12:00:00Z');
const pedidos = [];
globalThis.fetch = async (u, init) => {
  pedidos.push({ u: String(u), metodo: init?.method ?? 'GET', cuerpo: init?.body ?? null });
  const json = (b) => new Response(JSON.stringify(b), { status: 200, headers: { 'Content-Type': 'application/json' } });
  if (String(u).endsWith('/users/me')) return json({ resource: { current_organization: 'https://api.calendly.com/organizations/ORG' } });
  if (String(u).includes('/scheduled_events?')) return json({ collection: [
    { uri: 'https://api.calendly.com/scheduled_events/YA', name: 'R1', start_time: '2026-10-17T11:30:00Z', status: 'active' },
    { uri: 'https://api.calendly.com/scheduled_events/MANANA', name: 'R1 con Mauricio', start_time: '2026-10-18T15:00:00Z', status: 'active' },
  ] });
  return json({});
};
const { proximaReunionCalendly, cancelarReunionCalendly } = await import(${url('lib/calendly-cancelar.ts')});
const prox = await proximaReunionCalendly('lead@x.com', ahora);
await cancelarReunionCalendly(prox.uri, 'Ya compró');
console.log(JSON.stringify({ prox, pedidos }));
`;

test('la próxima reunión es la primera que todavía no empezó, y se cancela ésa con el motivo', () => {
  const out = execFileSync(process.execPath, [
    '--conditions=react-server', '--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx', '--input-type=module', '-e', HIJO,
  ], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  const { prox, pedidos } = JSON.parse(out.trim().split('\n').pop()!) as { prox: { uri: string; nombre: string }; pedidos: Array<{ u: string; metodo: string; cuerpo: string | null }> };
  assert.equal(prox.uri, 'https://api.calendly.com/scheduled_events/MANANA', 'eligió una que ya empezó');
  assert.equal(prox.nombre, 'R1 con Mauricio');
  assert.match(pedidos[1]!.u, /invitee_email=lead%40x\.com&status=active&min_start_time=/);
  const cancela = pedidos[pedidos.length - 1]!;
  assert.equal(cancela.metodo, 'POST');
  assert.equal(cancela.u, 'https://api.calendly.com/scheduled_events/MANANA/cancellation');
  assert.deepEqual(JSON.parse(cancela.cuerpo!), { reason: 'Ya compró' });
});

test('la acción: se confirma la que se vio, sin reunión es «ya está así», y en el lienzo va en «Agenda»', () => {
  const def = porId('cancelar_reunion_calendly');
  assert.ok(def && def.tipo === 'accion');
  assert.equal(def.reversible, false);
  const run = leer('lib/api-mako/areas/crm.run.ts');
  const i = run.indexOf('  cancelar_reunion_calendly: {');
  assert.ok(i > 0);
  const bloque = run.slice(i, run.indexOf('\n  },\n', i));
  assert.match(bloque, /no tiene una reunión de Calendly por delante: no hay nada que cancelar\.`, yaEstaba: true \}/);
  assert.match(bloque, /if \(!ahora \|\| ahora\.uri !== payload\.uri\) return \{ ok: false,/, 'al confirmar se cancelaría otra');
  assert.match(bloque, /await anotar\(leadId, 'Reunión cancelada en Calendly'/);
  const a = accionDelFlujo('cancelar_reunion_calendly');
  assert.ok(a, 'el lienzo no la ofrece');
  assert.equal(a!.grupo, 'Agenda');
  assert.ok(GRUPOS_ACCION.includes('Agenda'));
  assert.equal(AREA_DE_GRUPO.Agenda, 'CRM');
});

test('por WhatsApp no viaja a un negocio sin Calendly, ni cuando el pedido es mover algo de día', () => {
  assert.ok(DE_CALENDLY.includes('cancelar_reunion_calendly'));
  assert.ok(NO_MUEVEN_DE_DIA.includes('cancelar_reunion_calendly'));
});
