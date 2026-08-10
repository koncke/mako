// El eje ENTRADAS de funnel_config.data: su saneo y el merge del jsonb.
//
// Por qué hay tests de esto y no de otras cosas parecidas: lo que sale de acá
// decide si un prompt puede afirmar «vi que dejaste tus datos en el anuncio».
// El caso que lo trajo es una clienta que prospecta en frío por WhatsApp y grabó
// ese audio porque el sistema se lo pidió: sus 27 leads tienen meta_lead_id = 0.
// Una regla que solo vive en la prosa de un prompt no es una regla (AGENTS.md),
// así que el saneo vive en lib/pipeline.ts —SIN `server-only`, a propósito— para
// que se pueda probar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseEntradas, parseEvento, sanearPipeline, mergeFunnelData,
  ENTRADAS, esEntrada, ENCUENTRO_POR_CANAL, seGraba, agendaElLead, fechaFijaDelEvento,
  DEFAULT_PIPELINE, FUNNEL_TEMPLATES, TEMPLATE_POR_CANAL, type EntradaId,
} from '../lib/pipeline';
import { CANALES } from '../lib/fase-diagnostico';

// ── parseEntradas: la basura NUNCA se convierte en una afirmación ───────────
test('parseEntradas: lo que no es una entrada conocida se descarta', () => {
  assert.deepEqual(parseEntradas(['formulario_anuncio', 'inventada', 42, null]), ['formulario_anuncio']);
  assert.deepEqual(parseEntradas('formulario_anuncio'), []);   // string suelto, no array
  assert.deepEqual(parseEntradas(null), []);
  assert.deepEqual(parseEntradas(undefined), []);
  assert.deepEqual(parseEntradas({}), []);
  assert.deepEqual(parseEntradas([]), []);
});

test('parseEntradas: dedupe y tope de 3', () => {
  assert.deepEqual(parseEntradas(['landing', 'landing', 'landing']), ['landing']);
  const cinco = Object.keys(ENTRADAS) as EntradaId[];
  assert.equal(parseEntradas(cinco).length, 3);
});

test('parseEntradas conserva el ORDEN declarado (el primero es el de más volumen)', () => {
  assert.deepEqual(parseEntradas(['chat_saliente', 'chat_entrante']), ['chat_saliente', 'chat_entrante']);
  assert.deepEqual(parseEntradas(['chat_entrante', 'chat_saliente']), ['chat_entrante', 'chat_saliente']);
});

test('esEntrada no se deja engañar por propiedades de Object.prototype', () => {
  assert.equal(esEntrada('toString'), false);
  assert.equal(esEntrada('constructor'), false);
  assert.equal(esEntrada('formulario_anuncio'), true);
});

// ── parseEvento: un dato inventado en un audio va a un desconocido ──────────
test('parseEvento: sin ningún dato NO es un evento', () => {
  assert.equal(parseEvento(null), null);
  assert.equal(parseEvento({}), null);
  assert.equal(parseEvento({ lugar: '   ', dias: [], hora: '', cupo: null }), null);
  assert.equal(parseEvento('Huayacán'), null);
});

test('parseEvento: días fuera de rango, horas y cupos inválidos se caen', () => {
  const ev = parseEvento({ lugar: '  Huayacán, Cancún  ', dias: [3, 3, 9, -1, 1.5], hora: '19:00', cupo: 20.7 });
  assert.deepEqual(ev, { lugar: 'Huayacán, Cancún', dias: [3], hora: '19:00', tz: null, cupo: 20 });
  assert.equal(parseEvento({ hora: 'a las siete' }), null);
  assert.equal(parseEvento({ cupo: -5 }), null);
  assert.equal(parseEvento({ cupo: 0 }), null);
});

test('parseEvento: un lugar absurdamente largo se recorta, no rompe', () => {
  const ev = parseEvento({ lugar: 'x'.repeat(500) });
  assert.equal(ev!.lugar!.length, 200);
});

// ── El merge del jsonb: el bug que se arregló antes de que doliera ──────────
test('mergeFunnelData conserva las claves ajenas del jsonb', () => {
  const previo = { pipeline: [{ key: 'viejo' }], suppressed: ['x'], umbrales: { diasReactivacion: 45 } };
  const out = mergeFunnelData(previo, [{ key: 'lead', label: 'L', dot: '#000', tone: 'info' }], []);
  // `umbrales` lo lee lib/crm-auto.ts para los tiempos del CRM automático. La
  // versión vieja de saveFunnel lo borraba con cada tecla del editor de /funnel.
  assert.deepEqual(out.umbrales, { diasReactivacion: 45 });
  assert.deepEqual(out.suppressed, []);
  assert.equal((out.pipeline as unknown[]).length, 1);
});

test('mergeFunnelData: `extra` pisa, y un `previo` corrupto no explota', () => {
  const out = mergeFunnelData({ entradas: ['landing'] }, [], [], { entradas: ['chat_saliente'] });
  assert.deepEqual(out.entradas, ['chat_saliente']);
  assert.deepEqual(mergeFunnelData(null, [], []).pipeline, []);
  assert.deepEqual(mergeFunnelData('basura', [], []).pipeline, []);
  assert.deepEqual(mergeFunnelData([1, 2, 3], [], []).pipeline, []);
});

test('sanearPipeline: una etapa sin clave no es una etapa', () => {
  assert.equal(sanearPipeline([]), null);
  assert.equal(sanearPipeline('no'), null);
  assert.equal(sanearPipeline([{ label: 'sin key' }]), null);
  assert.equal(sanearPipeline([{ key: '' }]), null);
  assert.equal(sanearPipeline([{ key: 'lead' }, null, { label: 'x' }])!.length, 1);
});

// ── El encuentro se DERIVA del canal, y todo canal tiene que estar cubierto ──
test('todo canal declara su encuentro (o declara que no tiene)', () => {
  for (const c of CANALES) {
    assert.ok(c.id in ENCUENTRO_POR_CANAL, `el canal ${c.id} no dice qué encuentro tiene`);
  }
});

test('todo canal tiene una plantilla de funnel que existe de verdad', () => {
  for (const c of CANALES) {
    const id = TEMPLATE_POR_CANAL[c.id];
    assert.ok(id, `el canal ${c.id} no tiene plantilla`);
    assert.ok(FUNNEL_TEMPLATES.some((t) => t.id === id), `la plantilla ${id} del canal ${c.id} no existe`);
  }
});

test('seGraba: solo un 1:1 remoto CON Fathom conectado', () => {
  assert.equal(seGraba('llamadas', true), true);
  assert.equal(seGraba('llamadas', false), false, 'sin Fathom no hay grabación que esperar');
  assert.equal(seGraba('presencial', true), false, 'un taller presencial no se graba nunca');
  assert.equal(seGraba('webinar', true), false, 'un webinar grupal tampoco');
  assert.equal(seGraba('conversaciones', true), false);
});

test('seGraba sin canal declarado NO apaga lo que ya funciona', () => {
  // Un campo sin declarar no puede AFIRMAR un hecho nuevo, pero tampoco puede
  // apagar en silencio el No Show automático de quien sí graba sus llamadas.
  assert.equal(seGraba(null, true), true);
  assert.equal(seGraba(null, false), false);
});

test('quién pone la fecha del encuentro', () => {
  assert.equal(agendaElLead('llamadas'), true);
  assert.equal(agendaElLead('presencial'), false);
  assert.equal(agendaElLead(null), false);
  assert.equal(fechaFijaDelEvento('presencial'), true);
  assert.equal(fechaFijaDelEvento('webinar'), true);
  assert.equal(fechaFijaDelEvento('llamadas'), false);
  assert.equal(fechaFijaDelEvento(null), false);
});

// ── La plantilla presencial hereda el modelo de reunión, no inventa uno ─────
test('la sesión presencial usa la clave canónica `agenda`, no una inventada', () => {
  const tpl = FUNNEL_TEMPLATES.find((t) => t.id === 'presencial')!;
  const sesion = tpl.pipeline.find((s) => s.kind === 'reunion');
  assert.ok(sesion, 'la plantilla presencial tiene que tener una etapa de reunión');
  // Con `agenda` hereda fecha_junta_1/asistio_j1, deriveStageKey, funnelReqInfo y
  // las cohortes. Con una clave nueva, `effStage` cae a la PRIMERA etapa — la
  // falla ya documentada de la plantilla `vsl` en docs/hallazgos-crm.md.
  assert.equal(sesion!.key, 'agenda');
  assert.equal(sesion!.label, '1ª sesión sin costo');
});

test('la plantilla presencial no siembra la nutrición que no le corresponde', () => {
  const tpl = FUNNEL_TEMPLATES.find((t) => t.id === 'presencial')!;
  assert.ok(tpl.suppressed?.includes('nopaga>reunion_excepcional'));
});

test('el funnel por defecto sigue siendo el de siempre', () => {
  assert.deepEqual(DEFAULT_PIPELINE.map((s) => s.key), ['lead', 'agenda', 'agendaj2', 'facturando', 'ganado']);
});
