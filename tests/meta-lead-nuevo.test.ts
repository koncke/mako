// =============================================================================
// #868 (Brigitte, ws15): un lead de formulario de Meta dispara sus automatizaciones entre por donde entre
// =============================================================================
// La revisión del 16/10/2026 con Joan (Código Inmobiliario), 2:01:20: «la Brigitte sería la parte de las
// automatizaciones, esa es como la más prioritaria». Medido el 17/10: 16 leads en 14 días en el ws15 y CERO inscripciones
// en toda su historia. Las causas, y lo que fija este test:
//   1. el POLL creaba el lead y no hacía lo inmediato (el aviso, los flujos, las automatizaciones): lo hacía sólo el
//      webhook, y la página de Brigitte no está suscripta, así que el webhook no llega nunca. Ahora las dos puertas llaman
//      a `alNacerLeadDeMeta` (lib/meta-lead-nuevo.ts) — el poll sólo con un lead reciente (`esNuevoParaElNegocio`);
//   2. `lead_nuevo` no miraba las automatizaciones de la ETAPA en la que nace el lead («Un Lead Entró» cuelga de «Lead
//      entrante»): entraba por el barrido de la hora. Ahora, al instante, como la reserva (M1);
//   3. lo inmediato va por partes: una que falla no se lleva a las otras.
// El poll corre DE VERDAD en un node aparte (react-server + mocks de módulos): Graph, la base y lo inmediato son de
// mentira; el código que decide es el del repo.
//
// Probado rompiéndolo (17/10/2026, arnés `romper.py` + `roturas-868.json` del scratchpad, md5 igual al restaurar; base
// 5 / 5): el poll sin anunciar, anunciando sin mirar la edad, o anunciando también al que ya estaba → 3 / 2 cada uno
// (caen el 2 y el 5); lo inmediato sin partes → 4 / 1 (el 3); `lead_nuevo` sin su etapa → 4 / 1 (el 4); el tope de edad
// en una semana → 3 / 2 (el 1 y el 2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { esNuevoParaElNegocio, EDAD_MAXIMA_LO_INMEDIATO_MS, esDelWebhookTodavia } from '../lib/meta-leads-poll-reglas';
import { deLaEtapaYLasDemas, TRIGGER_ETAPA } from '../lib/nutricion-etapa';
import { pipelineStageOf } from '../lib/pipeline';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string): string => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
const url = (rel: string): string => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);

function hijo(codigo: string): Record<string, unknown> {
  const out = execFileSync(process.execPath, [
    '--conditions=react-server', '--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx', '--input-type=module', '-e', codigo,
  ], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  const lineas = out.trim().split('\n');
  return JSON.parse(lineas[lineas.length - 1]!) as Record<string, unknown>;
}

const H = 3600_000;

test('1. la edad: lo inmediato sólo para un lead de las últimas 24 h; un rescate de días entra callado', () => {
  const ahora = Date.parse('2026-10-17T12:00:00Z');
  const hace = (ms: number) => new Date(ahora - ms).toISOString();
  assert.equal(EDAD_MAXIMA_LO_INMEDIATO_MS, 24 * H);
  assert.equal(esNuevoParaElNegocio(hace(10 * 60_000), ahora), true);
  assert.equal(esNuevoParaElNegocio(hace(23 * H), ahora), true, 'una noche entera sin poll sigue siendo nuevo');
  assert.equal(esNuevoParaElNegocio(hace(25 * H), ahora), false, 'el rescate de la pasada de la semana no se anuncia');
  assert.equal(esNuevoParaElNegocio(null, ahora), false, 'sin fecha de Meta no se sabe: callado');
  assert.equal(esNuevoParaElNegocio('no-es-fecha', ahora), false);
  // Y lo de menos de 5 minutos sigue siendo del webhook (el poll ni lo toca).
  assert.equal(esDelWebhookTodavia(hace(60_000), ahora), true);
});

const HIJO_POLL = `
import { mock } from 'node:test';
const real = (m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'default' && k !== 'module.exports'));
const ahora = Date.now();
const hace = (ms) => new Date(ahora - ms).toISOString();
const log = { anunciados: [], upserts: [] };
// Graph: un formulario con cuatro leads (uno de 2 min, uno de 1 h, uno de 2 días, uno que ya estaba).
const LEADS = [
  { id: 'L-2min', created_time: hace(2 * 60_000), field_data: [{ name: 'full_name', values: ['Recién'] }] },
  { id: 'L-1h', created_time: hace(3600_000), campaign_name: 'Captación', field_data: [{ name: 'full_name', values: ['Silvana'] }, { name: 'phone_number', values: ['+542235980199'] }] },
  { id: 'L-2d', created_time: hace(48 * 3600_000), field_data: [{ name: 'full_name', values: ['Rescatada'] }] },
  { id: 'L-viejo', created_time: hace(30 * 60_000), field_data: [{ name: 'full_name', values: ['Ya estaba'] }] },
];
globalThis.fetch = async (u) => {
  const s = String(u);
  const body = s.includes('/leadgen_forms') ? { data: [{ id: 'F1', name: 'Captacion' }] } : s.includes('/F1/leads') ? { data: LEADS } : { data: [] };
  return new Response(JSON.stringify(body), { status: 200 });
};
mock.module(${url('lib/credenciales.ts')}, { exports: { ...real(await import(${url('lib/credenciales.ts')})), credWs: async (k) => (k === 'META_PAGE_ACCESS_TOKEN' ? 'tok' : k === 'META_PAGE_ID' ? '123' : null) } });
const ws = await import(${url('lib/workspace.ts')});
mock.module(${url('lib/workspace.ts')}, { exports: { ...real(ws), getWorkspaceActual: async () => 15 } });
let n = 100;
mock.module(${url('lib/leads.ts')}, { exports: { ...real(await import(${url('lib/leads.ts')})), upsertLeadFromMeta: async (x) => {
  log.upserts.push(x.meta_lead_id);
  const created = x.meta_lead_id !== 'L-viejo';
  return { created, lead: { id: ++n, nombre: x.nombre, telefono: x.telefono ?? null } };
} } });
mock.module(${url('lib/meta-lead-nuevo.ts')}, { exports: { alNacerLeadDeMeta: async (w, lead, form) => { log.anunciados.push({ w, nombre: lead.nombre, telefono: lead.telefono, campana: form.campana ?? null }); } } });
const { pollMetaLeads } = await import(${url('lib/meta-leads.ts')});
const r = await pollMetaLeads(7);
console.log(JSON.stringify({ r, ...log }));
`;

test('2. el poll DE VERDAD: anuncia al creado reciente, no al rescatado, ni al que ya estaba, ni al del webhook', () => {
  const o = hijo(HIJO_POLL) as Record<string, any>;
  assert.deepEqual(o.upserts, ['L-1h', 'L-2d', 'L-viejo'], 'el de 2 minutos es del webhook: el poll no lo toca');
  assert.deepEqual(o.anunciados.map((a: { nombre: string }) => a.nombre), ['Silvana'],
    'el lead del formulario de Brigitte entraba al CRM sin disparar nada (el poll no anunciaba)');
  assert.equal(o.anunciados[0].w, 15, 'con el workspace de la corrida');
  assert.equal(o.anunciados[0].telefono, '+542235980199');
  assert.equal(o.anunciados[0].campana, 'Captación');
  assert.equal(o.r.anunciados, 1);
  assert.equal(o.r.creados, 2);
  assert.equal(o.r.existentes, 1);
});

const HIJO_PARTES = `
import { mock } from 'node:test';
const real = (m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'default' && k !== 'module.exports'));
const log = [];
mock.module(${url('lib/avisos.ts')}, { exports: { ...real(await import(${url('lib/avisos.ts')})), emitirDelCatalogo: async (id, o) => { log.push(['aviso', id, o.ws, o.lead.id, o.datos]); throw new Error('Supabase caído'); } } });
mock.module(${url('lib/flujos.ts')}, { exports: { ...real(await import(${url('lib/flujos.ts')})), dispararEvento: async (ev, c) => { log.push(['flujos', ev, c.ws, c.leadId]); } } });
mock.module(${url('lib/nutricion.ts')}, { exports: { ...real(await import(${url('lib/nutricion.ts')})), enrolarPorEvento: async (id, ev) => { log.push(['automatizaciones', id, ev]); return 1; } } });
const { alNacerLeadDeMeta } = await import(${url('lib/meta-lead-nuevo.ts')});
await alNacerLeadDeMeta(15, { id: 2731, nombre: 'Silvana', telefono: null }, { fieldData: [{ name: 'tipo_de_propiedad', values: ['Casa'] }], campana: null });
console.log(JSON.stringify(log));
`;

test('3. lo inmediato por partes: el aviso con los DATOS, los flujos y las automatizaciones; una que falla no se lleva a las otras', () => {
  const log = hijo(HIJO_PARTES) as unknown as unknown[][];
  assert.deepEqual(log.map((x) => x[0]), ['aviso', 'flujos', 'automatizaciones'], 'el aviso que tira se llevaba las automatizaciones');
  const [, id, w, leadId, datos] = log[0] as [string, string, number, number, Record<string, string>];
  assert.equal(id, 'lead-formulario-meta');
  assert.equal(w, 15);
  assert.equal(leadId, 2731);
  assert.equal(datos.lead_telefono, 'sin teléfono', 'un {{lead_telefono}} crudo se lee como mensaje roto');
  assert.match(datos.lead_formulario, /Casa/);
  assert.deepEqual(log[1], ['flujos', 'lead.form_meta', 15, 2731]);
  assert.deepEqual(log[2], ['automatizaciones', 2731, 'lead_nuevo']);
});

test('4. el lead nuevo entra AL INSTANTE a la automatización de la etapa en la que nace, y de su embudo', () => {
  // Un lead del formulario nace sin etapa escrita: su etapa efectiva es «Lead entrante».
  const etapa = pipelineStageOf({ pipeline_stage: null, estado_lead: 'abierto', fecha_agenda: null, fecha_junta_1: null, fecha_junta_2: null, asistio_j1: null, asistio_j2: null } as never);
  assert.equal(etapa, 'lead');
  const vistas = [
    { id: 1, trigger_tipo: 'instant_form_sin_agenda', etapa: null, ambito: { modo: 'todos' as const } },
    { id: 247, trigger_tipo: TRIGGER_ETAPA, etapa: 'lead', ambito: { modo: 'propio' as const, id: 17 } },
    { id: 300, trigger_tipo: TRIGGER_ETAPA, etapa: 'lead', ambito: { modo: 'negocio' as const, id: 10 } },
    { id: 301, trigger_tipo: TRIGGER_ETAPA, etapa: 'agenda', ambito: { modo: 'propio' as const, id: 17 } },
  ];
  assert.deepEqual(deLaEtapaYLasDemas(vistas as never, etapa, 17).map((s) => s.id).sort((a, b) => a - b), [1, 247],
    'la de «Lead entrante» de SU embudo y la de antes; ni la del otro embudo ni la de otra etapa');
  // El cableado: `lead_nuevo` suma `etapa_actual` y pregunta lo MISMO que la reserva.
  const nutri = sinComentarios(leer('lib/nutricion.ts'));
  const ev = nutri.slice(nutri.indexOf('export async function enrolarPorEvento('), nutri.indexOf('delEvento = unaPorSecuencia('));
  assert.match(ev, /const conSuEtapa = evento === 'agenda_nueva' \|\| evento === 'lead_nuevo';/, '«Un Lead Entró» entraba por el barrido de la hora');
  assert.match(ev, /const claves = conSuEtapa \? \[\.\.\.\(TRIGGERS_POR_EVENTO\[evento\] \?\? \[\]\), TRIGGER_ETAPA\] :/);
  assert.match(ev, /if \(evento === 'etapa' \|\| conSuEtapa\) \{/);
});

test('5. las dos puertas llaman a lo MISMO, y sólo con un INSERT', () => {
  const webhook = sinComentarios(leer('app/api/webhooks/meta-leads/route.ts'));
  assert.match(webhook, /if \(created\) \{\s*await alNacerLeadDeMeta\(ws, \{ id: lead\.id, nombre: lead\.nombre, telefono: lead\.telefono \}/);
  for (const suelta of ['emitirDelCatalogo(', 'dispararEvento(', 'enrolarPorEvento(']) {
    assert.ok(!webhook.includes(suelta), `el webhook volvió a hacer lo inmediato por su cuenta (${suelta}): dos copias se separan`);
  }
  const poll = sinComentarios(leer('lib/meta-leads.ts'));
  assert.match(poll, /if \(created && esNuevoParaElNegocio\(lr\.created_time, ahoraMs\)\) \{/);
  assert.ok(poll.indexOf('alNacerLeadDeMeta(') > poll.indexOf('await upsertLeadFromMeta('), 'se anuncia DESPUÉS de crearlo');
  // Y el poll sigue sin la conversión Lead (decisión de meta-capi-lead-id): eso no cambia.
  assert.doesNotMatch(leer('lib/meta-leads.ts'), /sendMetaCAPIEvent/);
});
