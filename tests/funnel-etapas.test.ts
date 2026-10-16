// Tests del criterio PURO de "qué etapa es una reunión" (lib/funnel-etapas.ts).
// Blindan el bug que tuvo el worklist durante meses: las etapas de reunión
// estaban hardcodeadas como 'agenda'/'agendaj2', así que en un funnel custom
// (webinar, discovery) el pendiente "la reunión ya pasó" no existía — sin error
// ni aviso. Correr: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { etapasDeReunion, slotDeReunion, etapaVigenteDe } from '../lib/funnel-etapas';
import { DEFAULT_PIPELINE, FUNNEL_TEMPLATES, generateFunnel, type Stage, type StageDerivable } from '../lib/pipeline';

const pk = (key: string, kind: Stage['kind']): Stage => ({ key, label: key, dot: '#000', tone: 'neutral', kind });

// El funnel COMPLETO tal como lo devuelve getPipelineStages(): pipeline +
// nutriciones + salidas. Las derivadas no traen `kind`, y eso es justo lo que
// hace que filtrar por kind:'reunion' alcance.
const completo = (pipeline: Stage[]): Stage[] => generateFunnel(pipeline).stages;

const L = (p: Partial<StageDerivable>): StageDerivable => ({
  estado_lead: 'abierto', pipeline_stage: null, fecha_agenda: null, fecha_junta_1: null,
  fecha_junta_2: null, asistio_j1: null, asistio_j2: null, nutricion_realizada: false, ...p,
});

test('etapasDeReunion — funnel default: las dos canónicas, en orden', () => {
  assert.deepEqual(etapasDeReunion(completo(DEFAULT_PIPELINE)), ['agenda', 'agendaj2']);
});

test('etapasDeReunion — sin funnel cae al pipeline por defecto (nada cambia de comportamiento)', () => {
  assert.deepEqual(etapasDeReunion(undefined), ['agenda', 'agendaj2']);
  assert.deepEqual(etapasDeReunion(null), ['agenda', 'agendaj2']);
  assert.deepEqual(etapasDeReunion([]), ['agenda', 'agendaj2']);
});

test('etapasDeReunion — las etapas de nutrición y salidas NO son reuniones', () => {
  const stages = completo(DEFAULT_PIPELINE);
  // El funnel generado trae nutri/manual/noshow_r1/perdido/descal/noresp…
  assert.ok(stages.length > 6, 'el funnel completo trae más que el pipeline');
  assert.deepEqual(etapasDeReunion(stages), ['agenda', 'agendaj2']);
});

test('slotDeReunion — funnel default: agenda→R1, agendaj2→R2', () => {
  const s = completo(DEFAULT_PIPELINE);
  assert.deepEqual(slotDeReunion(s, 'agenda'), { indice: 0, numero: 1, cual: 'r1', colFecha: 'fecha_junta_1', colAt: 'junta_1_at' });
  assert.deepEqual(slotDeReunion(s, 'agendaj2'), { indice: 1, numero: 2, cual: 'r2', colFecha: 'fecha_junta_2', colAt: 'junta_2_at' });
});

test('slotDeReunion — lo que no es reunión devuelve null', () => {
  const s = completo(DEFAULT_PIPELINE);
  for (const k of ['lead', 'facturando', 'ganado', 'nutri', 'manual', 'noshow_r1', 'perdido', 'descal', 'noresp']) {
    assert.equal(slotDeReunion(s, k), null, `${k} no debería contar como reunión`);
  }
  assert.equal(slotDeReunion(s, null), null);
  assert.equal(slotDeReunion(s, ''), null);
  assert.equal(slotDeReunion(s, 'etapa-que-no-existe'), null);
});

test('slotDeReunion — funnel armado a mano: la reunión se llama distinto y IGUAL se detecta', () => {
  // ⚠️ CAMBIADO A PROPÓSITO el 14/10/2026: este caso usaba la plantilla `vsl`, que tenía la
  // reunión en la clave `webinar`. La plantilla pasó a las claves canónicas (lib/pipeline.ts), así
  // que el funnel de claves propias se arma acá: es el que un negocio construye a mano en el editor,
  // y sigue existiendo en producción con las claves viejas de la plantilla.
  const propio: Stage[] = [pk('registro', 'entrada'), pk('grupo', 'grupo'), pk('webinar', 'reunion'), pk('checkout', 'pago'), pk('ganado', 'cierre')];
  const s = completo(propio);
  assert.deepEqual(etapasDeReunion(s), ['webinar']);
  assert.deepEqual(slotDeReunion(s, 'webinar'), { indice: 0, numero: 1, cual: 'r1', colFecha: 'fecha_junta_1', colAt: 'junta_1_at' });
  // Y las keys canónicas, que este funnel NO tiene, no se cuelan por el nombre.
  assert.equal(slotDeReunion(s, 'agenda'), null);
  assert.equal(slotDeReunion(s, 'agendaj2'), null);
  assert.equal(slotDeReunion(s, 'grupo'), null, 'un grupo/evento no es una reunión');
});

test('slotDeReunion — plantilla VSL/webinar: el webinar es la R1 con la clave canónica', () => {
  // La plantilla de hoy: el webinar vive en `agenda`, así que hereda `fecha_junta_1` y `asistio_j1`.
  const vsl = FUNNEL_TEMPLATES.find((t) => t.id === 'vsl');
  assert.ok(vsl, 'existe el template vsl');
  const s = completo(vsl.pipeline);
  assert.deepEqual(etapasDeReunion(s), ['agenda']);
  assert.equal(s.find((x) => x.key === 'agenda')?.label, 'Webinar');
  assert.deepEqual(slotDeReunion(s, 'agenda'), { indice: 0, numero: 1, cual: 'r1', colFecha: 'fecha_junta_1', colAt: 'junta_1_at' });
  assert.equal(slotDeReunion(s, 'conversando'), null, 'el grupo no es una reunión');
});

test('slotDeReunion — funnel de 1 sola reunión: no hay R2', () => {
  const simple = FUNNEL_TEMPLATES.find((t) => t.id === 'simple');
  assert.ok(simple);
  const s = completo(simple.pipeline);
  assert.deepEqual(etapasDeReunion(s), ['agenda']);
  assert.equal(slotDeReunion(s, 'agenda')?.cual, 'r1');
  assert.equal(slotDeReunion(s, 'agendaj2'), null);
});

test('slotDeReunion — funnel sin reuniones (venta directa): nunca hay pendiente de reunión', () => {
  const directa = FUNNEL_TEMPLATES.find((t) => t.id === 'directa');
  assert.ok(directa);
  const s = completo(directa.pipeline);
  assert.deepEqual(etapasDeReunion(s), []);
  assert.equal(slotDeReunion(s, 'facturando'), null);
});

test('slotDeReunion — la TERCERA reunión no tiene slot: la tabla solo tiene 2', () => {
  // `leads` tiene fecha_junta_1/2 y junta_1_at/2 y nada más. Un funnel con 3
  // reuniones no tiene dónde guardar la fecha de la R3, así que se deja afuera
  // explícitamente (mismo criterio que generateFunnel, que devuelve {}).
  const s = completo([pk('lead', 'entrada'), pk('r1', 'reunion'), pk('r2', 'reunion'), pk('r3', 'reunion'), pk('ganado', 'cierre')]);
  assert.deepEqual(etapasDeReunion(s), ['r1', 'r2', 'r3']);
  assert.equal(slotDeReunion(s, 'r1')?.cual, 'r1');
  assert.equal(slotDeReunion(s, 'r2')?.cual, 'r2');
  assert.equal(slotDeReunion(s, 'r3'), null);
});

test('slotDeReunion — el ORDEN del pipeline manda, no el nombre de la etapa', () => {
  // Si el usuario pone 'agendaj2' primero, esa es la R1. El mapeo es por índice.
  const s = completo([pk('lead', 'entrada'), pk('agendaj2', 'reunion'), pk('agenda', 'reunion'), pk('ganado', 'cierre')]);
  assert.equal(slotDeReunion(s, 'agendaj2')?.cual, 'r1');
  assert.equal(slotDeReunion(s, 'agenda')?.cual, 'r2');
});

test('etapaVigenteDe — sin override, la etapa se deriva del lead', () => {
  const s = completo(DEFAULT_PIPELINE);
  assert.equal(etapaVigenteDe(L({ fecha_junta_1: '2026-01-05' }), s), 'agenda');
  assert.equal(etapaVigenteDe(L({ pipeline_stage: '   ' }), s), 'lead');
});

test('etapaVigenteDe — el override vale solo si la etapa sigue en el funnel', () => {
  const s = completo(DEFAULT_PIPELINE);
  assert.equal(etapaVigenteDe(L({ pipeline_stage: 'manual', fecha_junta_1: '2026-01-05' }), s), 'manual');
  // El workspace pasó a un funnel de UNA reunión: los leads que quedaron
  // apuntando a 'agendaj2' apuntan a una etapa fantasma y se caen a la derivada.
  // Es el caso real de ws1 (cientos de leads en etapas que su funnel no tiene).
  const simple = FUNNEL_TEMPLATES.find((t) => t.id === 'simple');
  assert.ok(simple);
  const s1 = completo(simple.pipeline);
  assert.equal(etapaVigenteDe(L({ pipeline_stage: 'agendaj2', fecha_junta_1: '2026-01-05' }), s1), 'agenda');
  assert.equal(etapaVigenteDe(L({ pipeline_stage: 'agenda', fecha_junta_1: '2026-01-05' }), s1), 'agenda');
});

test('etapaVigenteDe + slotDeReunion — un override fantasma no mata el pendiente de reunión', () => {
  // Antes: el override 'agendaj2' (etapa que ya no existe) hacía que el lead no
  // fuera "una reunión" para nadie y desaparecía del worklist.
  const simple = FUNNEL_TEMPLATES.find((t) => t.id === 'simple');
  assert.ok(simple);
  const s1 = completo(simple.pipeline);
  const lead = L({ pipeline_stage: 'agendaj2', fecha_junta_1: '2026-01-05' });
  assert.equal(slotDeReunion(s1, lead.pipeline_stage), null, 'con el override crudo no hay slot');
  assert.equal(slotDeReunion(s1, etapaVigenteDe(lead, s1))?.cual, 'r1');
});

test('etapaVigenteDe — sin funnel a mano se respeta el override (no hay contra qué validar)', () => {
  assert.equal(etapaVigenteDe(L({ pipeline_stage: 'reactivacion', fecha_junta_1: '2026-01-05' })), 'reactivacion');
  assert.equal(etapaVigenteDe(L({ pipeline_stage: 'reactivacion', fecha_junta_1: '2026-01-05' }), []), 'reactivacion');
});

test('el pendiente R llega al lead derivado: Calendly nunca escribe pipeline_stage', () => {
  // El webhook setea fecha_junta_1 y basta. Mirando el override crudo el lead
  // no era una reunión para nadie; con la etapa efectiva sí.
  const s = completo(DEFAULT_PIPELINE);
  const lead = L({ fecha_junta_1: '2026-01-05', fecha_agenda: '2026-01-01' });
  assert.equal(lead.pipeline_stage, null);
  assert.equal(slotDeReunion(s, etapaVigenteDe(lead, s))?.cual, 'r1');
});
