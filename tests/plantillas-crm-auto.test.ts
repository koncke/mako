// =============================================================================
// El CRM automático pasa a plantillas de Automations (14/10/2026): T2, T1, T3 y T6, y la ETAPA DESTINO al crearlas
// =============================================================================
// Pedido de Martín (14/10/2026 03:06, app/admin/dev/crm/bitacora.ts): «elimina el botón de "CRM Automático", para eso ya
// llevamos todo a Automations... Si quedó algo pendiente, llevalo como template a automations». El motor
// (lib/crm-auto.ts + lib/crm-auto-plan.ts) SIGUE prendido; estas plantillas lo reemplazan regla por regla, y recién
// entonces se apaga (no acá).
//
// Lo que se fija, ejecutando lo puro:
//   1. las cuatro existen, piden la etapa donde arrancan, nacen PAUSADAS, y las que mueven piden A QUÉ ETAPA (una tabla
//      escrita a mano);
//   2. la etapa destino: `pasosConDestinos` la pone en cada ⚡ «Mover de etapa» y en cada «Está en la etapa» que nombra,
//      sobre una COPIA; `destinosDeEleccion` entiende lo elegido; `seccionesParaDestino` ofrece las del CRM del CRON;
//   3. crear: sin la etapa destino NO SE CREA NADA (ni toca la base), una de otro CRM tampoco, y con ella los pasos van
//      llenos por su puerta;
//   4. LAS MISMAS REGLAS QUE EL MOTOR: cada plantilla, corrida con las funciones del motor de flujos
//      (`resolverControl`, las condiciones del catálogo, las fechas de `fechasDespuesDe`), hace lo mismo que
//      `planLeadAuto` sobre el mismo lead, el mismo día (y donde no, el test dice por qué);
//   5. la ruta y la galería las cablean (la pantalla de la etapa destino, sin «Elegir después»), y la API las pide.
//
// PROBADO ROMPIÉNDOLO (14/10/2026): ver «ROTURAS» al pie.
//
// Correr: npx tsx --test tests/plantillas-crm-auto.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PLANTILLAS, plantillaPorId, pasosDePlantilla, pasosConDestinos, destinosDeEleccion, destinosQueFaltan, destinoDeEleccion,
  seccionesParaDestino, canalesDe, type PlantillaAutomatizacion, type DestinoElegido,
} from '../lib/plantillas-automatizaciones';
import { crearDesdePlantilla, filaDePlantilla, PlantillaInvalidaError, type DbPlantilla } from '../lib/plantilla-crear';
import { resolverControl, siguienteIndice, catalogoDeLead, fechasDespuesDe, type FilaLeadCatalogo } from '../lib/nutricion-grafo-motor';
import { normalizar, raizSalida, indicePorId, esperaDesde, type PasoGrafo, type HechosLead } from '../lib/flujo-grafo';
import { conEtapasDelCron, type Disparador } from '../lib/disparadores';
import { OP_MOVER_ETAPA, OP_AVISAR } from '../lib/flujo-legado';
import { planLeadAuto, type AutoLead } from '../lib/crm-auto-plan';
import { hoyEnTz } from '../lib/date-utils';
import { pantallasDePlantilla, SIN_ETAPAS_DESTINO } from '../app/automations/GaleriaPlantillas';
import { DEFS } from '../lib/api-mako/areas/chatbot.def';
import type { ProductoParaDisparo } from '../lib/flujo-conversacion';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const MX = 'America/Mexico_City';
const DIA = 86_400_000;
const H = 3_600_000;
const PRODUCTOS: ProductoParaDisparo[] = [
  { funnelId: 5, productoId: 9, nombre: 'Mentoría', etapas: [{ value: 'lead', label: 'Lead entrante' }, { value: 'nutri', label: 'No Agenda' }, { value: 'reactivacion', label: 'Reactivación' }], etapasEntrega: [] },
  { funnelId: 7, productoId: 12, nombre: 'Curso', etapas: [{ value: 'lead', label: 'Lead entrante' }, { value: 'frio', label: 'Frío' }], etapasEntrega: [] },
];

// ── 1. Las cuatro ────────────────────────────────────────────────────────────────

/** A MANO: la regla del motor de la que sale cada una, qué pide al crearla y por dónde avisa. */
const LAS_CUATRO: ReadonlyArray<readonly [id: string, regla: string, destinos: readonly string[], canales: readonly string[]]> = [
  ['lead-no-agendo', 'T2', ['no_agenda', 'reactivacion'], []],
  ['reunion-sin-marcar', 'T1', [], ['mako']],
  ['nutricion-vencida', 'T3', [], ['mako']],
  ['lead-se-enfrio', 'T6', ['reactivacion'], []],
];

test('1. las cuatro existen, arrancan en una etapa de venta, nacen PAUSADAS y las que mueven piden a qué etapa', () => {
  for (const [id, regla, destinos, canales] of LAS_CUATRO) {
    const p = plantillaPorId(id);
    assert.ok(p, `${id} no está en la galería`);
    assert.match(p!.origen, new RegExp(`regla ${regla}\\b`), `${id}: no dice de qué regla del motor sale`);
    assert.equal(p!.cron.pide, 'etapa_venta', `${id}: no arranca en una etapa de venta`);
    assert.deepEqual((p!.destinos ?? []).map((d) => d.id), [...destinos], `${id}: lo que pide al crearla`);
    assert.deepEqual(canalesDe(p!), [...canales], `${id}: por dónde avisa`);
    assert.equal(filaDePlantilla(p!, 'k', p!.nombre).activa, false, `${id}: nace prendida`);
    // Cada ⚡ «Mover de etapa» lo llena un destino, y cada destino llena al menos uno (nada queda sin etapa).
    const movers = p!.pasos.filter((x) => x.accion?.operacion === OP_MOVER_ETAPA).map((x) => x.id);
    assert.deepEqual([...new Set((p!.destinos ?? []).flatMap((d) => d.mover))].sort(), [...movers].sort(), `${id}: un «Mover de etapa» sin destino`);
    for (const d of p!.destinos ?? []) {
      assert.ok(d.pregunta.endsWith('?') && d.pregunta.length <= 60, `${id}/${d.id}: la pregunta`);
      assert.ok(d.ayuda.trim() && d.ayuda.length <= 80, `${id}/${d.id}: la ayuda`);
    }
  }
  // Las de antes no piden destinos: nada cambia al crearlas.
  for (const p of PLANTILLAS) if (!LAS_CUATRO.some(([id]) => id === p.id)) assert.equal(p.destinos, undefined, `${p.id} pide destinos`);
});

// ── 2. La etapa destino ──────────────────────────────────────────────────────────

const T2 = plantillaPorId('lead-no-agendo')!;
const ELEGIDOS_T2: Record<string, DestinoElegido> = { no_agenda: { etapa: 'nutri', funnelId: 5 }, reactivacion: { etapa: 'reactivacion', funnelId: 5 } };

test('2. `pasosConDestinos` pone la etapa en cada «Mover de etapa» y en su «Está en la etapa», sobre una COPIA', () => {
  const pasos = pasosConDestinos(T2, ELEGIDOS_T2);
  const params = (id: string) => pasos.find((x) => x.id === id)!.accion!.params;
  assert.deepEqual(params('na_mv1'), { leadId: 'evento', etapa: 'nutri', embudoId: 5 });
  assert.deepEqual(params('na_mv2'), { leadId: 'evento', etapa: 'reactivacion', embudoId: 5 });
  assert.deepEqual(params('na_mv3'), { leadId: 'evento', etapa: 'reactivacion', embudoId: 5 });
  // «sigue en la de no agenda»: la MISMA etapa que el primer movimiento, con su embudo.
  const fila = pasos.find((x) => x.id === 'na_c2')!.ramas![0].filas[1];
  assert.deepEqual(fila, { campo: 'etapa', valor: 'nutri', funnel_id: 5, union: 'y' });
  // El catálogo no se tocó, y lo que no se eligió queda sin etapa.
  assert.deepEqual(T2.pasos.find((x) => x.id === 'na_mv1')!.accion!.params, { leadId: 'evento' });
  assert.equal(T2.pasos.find((x) => x.id === 'na_c2')!.ramas![0].filas[1].valor, '');
  const medio = pasosConDestinos(T2, { no_agenda: ELEGIDOS_T2.no_agenda });
  assert.deepEqual(medio.find((x) => x.id === 'na_mv2')!.accion!.params, { leadId: 'evento' });
  assert.deepEqual(destinosQueFaltan(T2, { no_agenda: ELEGIDOS_T2.no_agenda }).map((d) => d.id), ['reactivacion']);
  // Una de la casa sin embudo: la etapa sola (sin la pista del editor) y la fila sobre la casa.
  const casa = pasosConDestinos(T2, { no_agenda: { etapa: 'nutri', funnelId: null }, reactivacion: { etapa: 'reactivacion', funnelId: null } });
  assert.deepEqual(casa.find((x) => x.id === 'na_mv1')!.accion!.params, { leadId: 'evento', etapa: 'nutri' });
  assert.equal(casa.find((x) => x.id === 'na_c2')!.ramas![0].filas[1].funnel_id, null);
});

test('2b. lo elegido se entiende (una etapa de venta, una sola) y se ofrecen las del CRM del CRON', () => {
  assert.deepEqual(destinoDeEleccion('venta:5:nutri'), { etapa: 'nutri', funnelId: 5 });
  assert.equal(destinoDeEleccion('venta:5:nutri,reactivacion'), null, 'dos etapas no son un destino');
  assert.equal(destinoDeEleccion('entrega:9:clase1'), null);
  assert.equal(destinoDeEleccion(''), null);
  const r = destinosDeEleccion(T2, { no_agenda: 'venta:5:nutri', reactivacion: 'etiqueta:3', otra: 'venta:5:lead' });
  assert.deepEqual(r.elegidos, { no_agenda: { etapa: 'nutri', funnelId: 5 } });
  assert.deepEqual(r.malos, ['¿A qué etapa pasa si se enfría?']);
  assert.deepEqual(destinosDeEleccion(T2, 'basura'), { elegidos: {}, malos: [] });
  // Con el CRON en el CRM «Mentoría» (embudo 5): sólo sus etapas. Sin CRON, las de los dos.
  const valores = (s: ReturnType<typeof seccionesParaDestino>) => s.flatMap((x) => x.options.map((o) => o.value));
  assert.deepEqual(valores(seccionesParaDestino(PRODUCTOS, 'venta:5:lead')), ['venta:5:lead', 'venta:5:nutri', 'venta:5:reactivacion']);
  assert.deepEqual(valores(seccionesParaDestino(PRODUCTOS, 'venta:7:lead')), ['venta:7:lead', 'venta:7:frio']);
  assert.equal(valores(seccionesParaDestino(PRODUCTOS, null)).length, 5);
  assert.equal(valores(seccionesParaDestino(PRODUCTOS, 'venta:99:lead')).length, 5, 'un CRM sin etapas: todas');
  assert.deepEqual(seccionesParaDestino([], null), []);
});

// ── 3. Crear ─────────────────────────────────────────────────────────────────────

function baseDeMentira() {
  const llamadas: string[] = [];
  const db: DbPlantilla = {
    from: () => ({
      select: () => ({ is: async () => { llamadas.push('select'); return { data: [], error: null }; } }),
      insert: () => ({ select: () => ({ single: async () => { llamadas.push('insert'); return { data: { id: 800 }, error: null }; } }) }),
      delete: () => ({ eq: async () => { llamadas.push('delete'); return { data: null, error: null }; } }),
    }),
  };
  return { db, llamadas };
}

test('3. crear: sin la etapa destino NO se crea nada; una de otro CRM o una que no se entiende, tampoco', async () => {
  for (const [destinos, motivo] of [
    [undefined, /Falta elegir «¿A qué etapa pasa si no agenda\?»/],
    [{ no_agenda: 'venta:5:nutri' }, /Falta elegir «¿A qué etapa pasa si se enfría\?»/],
    [{ no_agenda: 'venta:5:nutri', reactivacion: 'venta:7:frio' }, /es de otro CRM que el del CRON/],
    [{ no_agenda: 'entrega:9:x', reactivacion: 'venta:5:reactivacion' }, /Esa etapa no sirve para «¿A qué etapa pasa si no agenda\?»/],
  ] as const) {
    const { db, llamadas } = baseDeMentira();
    await assert.rejects(
      crearDesdePlantilla('lead-no-agendo', { db, setPasos: async () => {}, setDisparadores: async () => {} }, { disparador: 'venta:5:lead', destinos }),
      (e: unknown) => e instanceof PlantillaInvalidaError && motivo.test(e.message),
      `destinos ${JSON.stringify(destinos)}`,
    );
    assert.deepEqual(llamadas, [], `destinos ${JSON.stringify(destinos)}: tocó la base`);
  }
});

test('3b. crear con la etapa destino: los pasos van LLENOS por su puerta, el CRON por la suya, y nace pausada', async () => {
  const { db, llamadas } = baseDeMentira();
  const pasos: unknown[] = [];
  const crones: unknown[] = [];
  const r = await crearDesdePlantilla('lead-no-agendo', {
    db, setPasos: async (_id, ps) => { pasos.push(ps); }, setDisparadores: async (_id, l) => { crones.push(l); },
  }, { disparador: 'venta:5:lead', destinos: { no_agenda: 'venta:5:nutri', reactivacion: 'venta:5:reactivacion' } });
  assert.equal(r.pide, null);
  assert.deepEqual(llamadas, ['select', 'insert']);
  assert.deepEqual(pasos, [pasosConDestinos(T2, ELEGIDOS_T2)]);
  assert.deepEqual(crones, [[{ id: 'd1', trigger_tipo: 'etapa_actual', etapa: 'lead', etapas: null, funnel_id: 5 }]]);
  // Con el CRON «elegir después», el destino es de cualquier CRM (el CRON se elige en el lienzo).
  const b = baseDeMentira();
  const r2 = await crearDesdePlantilla('lead-se-enfrio', { db: b.db, setPasos: async () => {}, setDisparadores: async () => {} }, { destinos: { reactivacion: 'venta:7:frio' } });
  assert.equal(r2.pide, 'etapa_venta');
  // Una que no mueve no pide nada (y lo que mande de más se ignora).
  const c = baseDeMentira();
  await crearDesdePlantilla('reunion-sin-marcar', { db: c.db, setPasos: async () => {}, setDisparadores: async () => {} }, { destinos: { x: 'venta:5:nutri' } });
  assert.deepEqual(c.llamadas, ['select', 'insert']);
});

// ── 4. Las mismas reglas que el motor ────────────────────────────────────────────

/** El lead de la simulación: lo que leen las condiciones y las esperas. */
type LeadSim = { etapa: string; agendo: boolean; creadoMs: number; fila: FilaLeadCatalogo & { nutricion_manual_deadline?: string | null } };
type Hecho = { dia: number; id: string; op: string; etapa?: unknown };

/**
 * CORRE UNA PLANTILLA como el motor de flujos: desde su entrada, `resolverControl` con los hechos del lead (las condiciones
 * del catálogo, el CRON de la automatización) y las fechas de las esperas «después de», hasta `hastaMs`. Lo que se
 * ejecuta (un aviso o un movimiento) queda en la lista, con el día; un movimiento le cambia la etapa al lead.
 */
function correr(pasos: readonly PasoGrafo[], cron: Disparador[], lead: LeadSim, desdeMs: number, hastaMs: number): Hecho[] {
  const out: Hecho[] = [];
  let idx = indicePorId(pasos, raizSalida(pasos));
  let ahora = desdeMs;
  for (let vuelta = 0; vuelta < 40 && idx >= 0; vuelta++) {
    const base: HechosLead = {
      etiquetas: new Set(), etapa: lead.etapa, etapasPorProducto: new Map([[5, lead.etapa]]), agendo: lead.agendo, pago: false,
      yaContactado: false, respondio: false, creadoMs: lead.creadoMs, tieneTelefono: true, tieneEmail: false, ahoraMs: ahora,
      catalogo: { lead: catalogoDeLead(lead.fila, ahora, hoyEnTz(MX, new Date(ahora))) },
    };
    const r = resolverControl(pasos, idx, { hechos: conEtapasDelCron(base, cron), ahoraMs: ahora, reunionMs: null, fechasDespues: fechasDespuesDe(lead.fila, MX) });
    if (r.tipo === 'esperar') { if (r.proximoMs > hastaMs) break; ahora = r.proximoMs; idx = r.idx; continue; }
    if (r.tipo !== 'nodo') break;
    const x = pasos[r.idx] as PasoGrafo & { accion?: { operacion: string; params: Record<string, unknown> } };
    out.push({ dia: Math.floor((ahora - desdeMs) / DIA), id: x.id!, op: x.accion?.operacion ?? 'mensaje', etapa: x.accion?.params?.etapa });
    if (x.accion?.operacion === OP_MOVER_ETAPA) lead.etapa = String(x.accion.params.etapa);
    idx = siguienteIndice(pasos, r.idx);
  }
  return out;
}

const CRON = (etapa: string): Disparador[] => [{ id: 'd1', trigger_tipo: 'etapa_actual', etapa, etapas: null, funnel_id: 5 }];
const T0 = Date.parse('2026-10-14T15:00:00Z'); // 9:00 en México
const isoDe = (ms: number) => new Date(ms).toISOString();
const autoLead = (o: Partial<AutoLead>): AutoLead => ({
  id: 1, nombre: 'Lead', estado_lead: 'abierto', pipeline_stage: 'lead', fecha_agenda: null, fecha_junta_1: null, fecha_junta_2: null,
  junta_1_at: null, junta_2_at: null, asistio_j1: null, asistio_j2: null, nutricion_manual_deadline: null,
  created_at: isoDe(T0), updated_at: null, ...o,
});
/** Lo que el motor MUEVE con esa regla día por día (desde T0), aplicándolo al lead: [día, etapa]. */
function historiaDelMotor(regla: string, l: AutoLead, hasta = 40): Array<[number, string]> {
  const out: Array<[number, string]> = [];
  let lead = l;
  for (let d = 0; d <= hasta; d++) {
    const ms = T0 + d * DIA + 4 * H;
    const a = planLeadAuto(lead, hoyEnTz(MX, new Date(ms)), ms).find((x) => x.regla === regla && x.move);
    if (a?.move) { out.push([d, a.move.to]); lead = { ...lead, pipeline_stage: a.move.to }; }
  }
  return out;
}

/** El primer día (desde T0) en que el motor aplica esa regla, mirando día por día. */
function diaDelMotor(regla: string, l: (dia: number) => AutoLead, hasta = 40): { dia: number; to?: string } | null {
  for (let d = 0; d <= hasta; d++) {
    const ms = T0 + d * DIA + 4 * H;
    const a = planLeadAuto(l(d), hoyEnTz(MX, new Date(ms)), ms).find((x) => x.regla === regla);
    if (a) return { dia: d, to: a.move?.to };
  }
  return null;
}

test('4a. «Un Lead No Agendó» = T2: a los 2 días a No Agenda, a los 7 a Reactivación; si agenda o lo mueven, nada', () => {
  const pasos = normalizar(pasosConDestinos(T2, ELEGIDOS_T2));
  // Un lead nuevo que no agenda.
  const flujo = correr(pasos, CRON('lead'), { etapa: 'lead', agendo: false, creadoMs: T0, fila: { estado_lead: 'abierto' } }, T0, T0 + 40 * DIA);
  assert.deepEqual(flujo.map((h) => [h.dia, h.etapa]), [[2, 'nutri'], [7, 'reactivacion']]);
  // El motor, el mismo lead, día por día y aplicando lo que mueve: No Agenda el 2, Reactivación el 7.
  assert.deepEqual(historiaDelMotor('T2', autoLead({})), [[2, 'nutri'], [7, 'reactivacion']]);
  // Agendó: ni el flujo ni el motor lo mueven.
  assert.deepEqual(correr(pasos, CRON('lead'), { etapa: 'lead', agendo: true, creadoMs: T0, fila: {} }, T0, T0 + 40 * DIA), []);
  assert.equal(diaDelMotor('T2', () => autoLead({ fecha_agenda: '2026-10-15' })), null);
  // Una persona lo pasó a otra etapa después de No Agenda: el flujo NO lo manda a Reactivación (el motor tampoco: sólo
  // desde Lead entrante o No Agenda).
  const lead = { etapa: 'lead', agendo: false, creadoMs: T0, fila: {} };
  const parcial = correr(pasos, CRON('lead'), lead, T0, T0 + 3 * DIA);
  assert.deepEqual(parcial.map((h) => h.etapa), ['nutri']);
  lead.etapa = 'conversando';
  assert.deepEqual(correr(pasos, CRON('lead'), lead, T0 + 3 * DIA, T0 + 40 * DIA), [], 'empieza de nuevo: sale de la etapa del CRON');
  assert.equal(diaDelMotor('T2', () => autoLead({ pipeline_stage: 'conversando' })), null);
  // ⚠️ La diferencia que queda, dicha: un lead que YA estaba frío cuando la automatización lo toma (llegó hace 10 días) va
  // directo a Reactivación, como en el motor, pero a los 2 días de activarla y no el mismo día (la primera tarjeta espera).
  const frio = correr(pasos, CRON('lead'), { etapa: 'lead', agendo: false, creadoMs: T0 - 10 * DIA, fila: {} }, T0, T0 + 40 * DIA);
  assert.deepEqual(frio.map((h) => [h.dia, h.etapa]), [[2, 'reactivacion']]);
  assert.deepEqual(diaDelMotor('T2', () => autoLead({ created_at: isoDe(T0 - 10 * DIA) })), { dia: 0, to: 'reactivacion' });
});

test('4b. «Una Reunión Sin Marcar» = T1: a las 3 h de la reunión avisa si nadie la marcó; marcada o cancelada, nada', () => {
  const p = plantillaPorId('reunion-sin-marcar')!;
  const pasos = normalizar(pasosDePlantilla(p));
  const REUNION = T0 + 2 * DIA;
  const fila = (o: FilaLeadCatalogo = {}): FilaLeadCatalogo => ({ estado_lead: 'abierto', junta_1_at: isoDe(REUNION), fecha_junta_1: '2026-10-16', ...o });
  const avisa = (f: FilaLeadCatalogo) => correr(pasos, CRON('agenda'), { etapa: 'agenda', agendo: true, creadoMs: T0, fila: f }, T0, T0 + 10 * DIA);
  const sin = avisa(fila());
  // Dos avisos si nadie marca (23/10/2026: la pregunta no muere en silencio): a las 3 h y a los 2 días; nunca un tercero.
  // Roturas (base 10/0): sin el segundo aviso → 9/1; sin «Sigue en la etapa» en las dos condiciones → 9/1.
  assert.deepEqual(sin.map((h) => h.op), [OP_AVISAR, OP_AVISAR]);
  assert.equal(correr(pasos, CRON('agenda'), { etapa: 'agenda', agendo: true, creadoMs: T0, fila: fila() }, T0, REUNION + 3 * H + 2 * DIA - 60_000).length, 1, 'el segundo aviso sale antes de los 2 días');
  assert.equal(correr(pasos, CRON('agenda'), { etapa: 'agenda', agendo: true, creadoMs: T0, fila: fila() }, T0, REUNION + 3 * H + 2 * DIA).length, 2);
  // Si ya no está en la etapa de reunión (lo movieron), no se le pregunta.
  assert.deepEqual(correr(pasos, CRON('agenda'), { etapa: 'facturando', agendo: true, creadoMs: T0, fila: fila() }, T0, T0 + 10 * DIA), []);
  // A las 3 h EXACTAS después de la reunión (`horasPostReunion`): el motor, un minuto antes no; un minuto después, sí.
  const motor = (ms: number, o: Partial<AutoLead> = {}) => planLeadAuto(autoLead({ pipeline_stage: 'agenda', junta_1_at: isoDe(REUNION), fecha_junta_1: '2026-10-16', ...o }), '2026-10-16', ms).some((a) => a.regla === 'T1');
  assert.equal(motor(REUNION + 3 * H - 60_000), false);
  assert.equal(motor(REUNION + 3 * H + 60_000), true);
  assert.equal(correr(pasos, CRON('agenda'), { etapa: 'agenda', agendo: true, creadoMs: T0, fila: fila() }, T0, REUNION + 3 * H - 60_000).length, 0, 'el flujo avisa antes de las 3 h');
  assert.equal(correr(pasos, CRON('agenda'), { etapa: 'agenda', agendo: true, creadoMs: T0, fila: fila() }, T0, REUNION + 3 * H).length, 1);
  // Marcada (vino o no vino), cancelada, o el lead ya no está abierto: ni el flujo ni el motor.
  for (const [nombre, f, o] of [
    ['vino', fila({ asistio_j1: true }), { asistio_j1: true }],
    ['no vino', fila({ asistio_j1: false }), { asistio_j1: false }],
    ['cancelada', fila({ fecha_junta_1: null }), { fecha_junta_1: null }],
    ['perdido', fila({ estado_lead: 'perdido' }), { estado_lead: 'perdido' as const }],
  ] as const) {
    assert.deepEqual(avisa(f), [], `${nombre}: el flujo avisa`);
    assert.equal(motor(REUNION + 4 * H, o as Partial<AutoLead>), false, `${nombre}: el motor propone`);
  }
});

test('4c. «Venció la Nutrición Manual» = T3: avisa el día siguiente al plazo (en el negocio); con el plazo alargado, no', () => {
  const p = plantillaPorId('nutricion-vencida')!;
  const pasos = normalizar(pasosDePlantilla(p));
  const lead = (deadline: string | null) => ({ etapa: 'manual', agendo: false, creadoMs: T0, fila: { estado_lead: 'abierto', nutricion_manual_deadline: deadline } });
  const hechos = correr(pasos, CRON('manual'), lead('2026-10-20'), T0, T0 + 20 * DIA);
  assert.deepEqual(hechos.map((h) => [h.dia, h.op]), [[6, OP_AVISAR]], 'el 21/10 (día 7 contando el 14) a las 9 de México');
  // El motor: el 20 no, el 21 sí (`deadline < hoy`).
  assert.equal(diaDelMotor('T3', () => autoLead({ pipeline_stage: 'manual', nutricion_manual_deadline: '2026-10-20' }))?.dia, 7);
  // Sin plazo: ninguno de los dos.
  assert.deepEqual(correr(pasos, CRON('manual'), lead(null), T0, T0 + 20 * DIA), []);
  assert.equal(diaDelMotor('T3', () => autoLead({ pipeline_stage: 'manual' })), null);
  // Fuera de la nutrición manual: la plantilla mira «Sigue en la etapa del CRON»; el motor, la etapa `manual`.
  const fuera = { ...lead('2026-10-20'), etapa: 'perdido' };
  assert.deepEqual(correr(pasos, CRON('manual'), fuera, T0, T0 + 20 * DIA), []);
});

test('4d. «Un Lead Se Enfrió» = T6: a los 30 días quieto en la etapa lo pasa a la de reactivar; si salió, nada', () => {
  const p = plantillaPorId('lead-se-enfrio')!;
  const pasos = normalizar(pasosConDestinos(p, { reactivacion: { etapa: 'reactivacion', funnelId: 5 } }));
  const flujo = correr(pasos, CRON('perdido'), { etapa: 'perdido', agendo: false, creadoMs: T0 - 90 * DIA, fila: { estado_lead: 'perdido' } }, T0, T0 + 60 * DIA);
  assert.deepEqual(flujo.map((h) => [h.dia, h.op, h.etapa]), [[30, OP_MOVER_ETAPA, 'reactivacion']]);
  // El motor, con el lead que entró a Perdido el día 0: a los 30 días.
  assert.deepEqual(diaDelMotor('T6', () => autoLead({ estado_lead: 'perdido', pipeline_stage: 'perdido', updated_at: isoDe(T0) }), 40), { dia: 30, to: 'reactivacion' });
  // Si en el medio volvió a otra etapa, no.
  const lead = { etapa: 'perdido', agendo: false, creadoMs: T0, fila: {} };
  correr(pasos, CRON('perdido'), lead, T0, T0 + 10 * DIA);
  lead.etapa = 'agenda';
  assert.deepEqual(correr(pasos, CRON('perdido'), lead, T0 + 10 * DIA, T0 + 60 * DIA), []);
});

// ── 5. El cableado ───────────────────────────────────────────────────────────────

test('5. la ruta pasa las etapas destino, la galería las pregunta (sin «Elegir después») y la API las pide', () => {
  const ruta = sinComentarios(leer('app/api/chat-agent/secuencias/route.ts'));
  assert.match(ruta, /\}, \{ disparador: body\.disparador, destinos: body\.destinos \}\);/);
  // La galería: CRON primero (si hay qué ofrecer) y una pantalla por destino.
  assert.deepEqual(pantallasDePlantilla(T2, PRODUCTOS).map((x) => (x === 'cron' ? x : x.id)), ['cron', 'no_agenda', 'reactivacion']);
  assert.deepEqual(pantallasDePlantilla(T2, []).map((x) => (x === 'cron' ? x : x.id)), ['no_agenda', 'reactivacion']);
  assert.deepEqual(pantallasDePlantilla(plantillaPorId('mako-pago')!, PRODUCTOS), []);
  const gal = sinComentarios(leer('app/automations/GaleriaPlantillas.tsx'));
  const destino = gal.slice(gal.indexOf('data-galeria-paso="destino"') - 900, gal.indexOf('data-galeria-paso="destino"') + 1200);
  assert.match(destino, /seccionesParaDestino\(p\.productos, valor \|\| null\)/, 'las etapas no son las del CRM del CRON');
  assert.doesNotMatch(destino, /Elegir después/, 'una etapa destino no se elige después');
  assert.match(destino, /disabled=\{!puesto\}/, 'se crea sin elegir la etapa');
  assert.ok(gal.includes('{SIN_ETAPAS_DESTINO}') && SIN_ETAPAS_DESTINO.length <= 40);
  assert.match(gal, /\.\.\.\(Object\.keys\(dest\)\.length \? \{ destinos: dest \} : \{\}\)/, 'el pedido no lleva los destinos');
  // Al instante (#882, `onCrearPlantilla` de /automations) salvo la que mueve: ésa pregunta sus etapas acá (23/10/2026).
  assert.match(gal, /if \(p\.onCrearPlantilla && !pl\.destinos\?\.length\) \{ p\.onCrearPlantilla\(pl\); return; \}/, 'la que mueve se crea al instante sin su etapa');
  // Cambiar el CRON borra lo elegido (podía ser de otro CRM).
  assert.match(gal, /onChange=\{\(v\) => \{ setValor\(v\); setDestinos\(\{\}\); \}\}/);
  // La API: `crear_automatizacion_desde_plantilla` las pide; las dos nuevas existen, sin http.
  const def = (id: string) => DEFS.find((d) => d.id === id)!;
  const destinos = def('crear_automatizacion_desde_plantilla').parametros.find((x) => x.nombre === 'destinos');
  assert.ok(destinos && destinos.tipo === 'object[]', 'sin el parámetro destinos');
  assert.deepEqual(destinos!.campos!.map((c) => c.nombre), ['pregunta', 'etapa', 'producto']);
  for (const id of ['condiciones_automatizacion', 'cambiar_desde_espera_paso']) {
    assert.ok(def(id), `${id} no está en la API`);
    assert.ok(!def(id).canales.includes('http' as never), `${id} sale por http`);
  }
  assert.equal(def('cambiar_desde_espera_paso').tipo === 'accion' && (def('cambiar_desde_espera_paso') as { confirmacion?: string }).confirmacion, 'chat');
  const run = sinComentarios(leer('lib/api-mako/areas/chatbot.run.ts'));
  assert.match(run, /pide_destinos: \(p\.destinos \?\? \[\]\)\.map/);
  assert.match(run, /destinos: payload\.destinos \?\? undefined/);
  assert.match(run, /if \(faltan\.length\) return \{ error: `«\$\{p\.nombre\}» mueve al lead de etapa: falta/);
  assert.match(run, /if \(p\.espera\?\.modo === 'antes_reunion'\) return \{ error: /, 'cambia un recordatorio del carril');
  // `esperaDesde`: lo que espera no cambia; «ahora» es por tiempo; una que no dice cuánto, no.
  assert.deepEqual(esperaDesde({ modo: 'tiempo', minutos: 180 }, 'reunion_2'), { modo: 'despues_de', minutos: 180, de: 'reunion_2' });
  assert.deepEqual(esperaDesde({ modo: 'despues_de', minutos: 60, de: 'reunion' }, 'ahora'), { modo: 'tiempo', minutos: 60 });
  assert.equal(esperaDesde({ modo: 'tiempo', minutos: 60 }, 'la_boda'), null);
  assert.equal(esperaDesde(undefined, 'reunion'), null);
});

// ROTURAS (14/10/2026), una por vez y restaurada desde memoria (scratchpad romper.py). Como está: 10 pasan / 0 fallan.
// Cada rotura (pasan / fallan):
//   R1  `pasosConDestinos` sin llenar el «Está en la etapa»                       → 8 / 2 (la 2 y la 4a)
//   R2  crear sin exigir las etapas destino                                      → 9 / 1 (la 3)
//   R3  crear sin mirar que el destino sea del CRM del CRON                      → 9 / 1 (la 3)
//   R4  `seccionesParaDestino` ofreciendo las de todos los CRM                   → 9 / 1 (la 2b)
//   R5  T2 con la rama del frío DESPUÉS de la otra (nunca gana)                  → 9 / 1 (la 4a)
//   R6  T1 sin «Estado del lead: Abierto»                                        → 9 / 1 (la 4b)
//   R7  T3 esperando por tiempo y no desde el plazo                              → 9 / 1 (la 4c)
//   R8  T6 sin «Sigue en la etapa del CRON»                                      → 9 / 1 (la 4d)
//   R9  la ruta sin pasar `destinos`                                             → 9 / 1 (la 5)
//   R10 cambiar el CRON en la galería sin borrar los destinos elegidos           → 9 / 1 (la 5)
//   R11 T2 esperando 3 días en vez de 2                                          → 9 / 1 (la 4a)
