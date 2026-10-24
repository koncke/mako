// =============================================================================
// El plan para pasar el CRM automático a plantillas (b5, 24/10/2026): lib/crm-auto-migracion.ts y su script
// =============================================================================
// La revisión adversarial del b5 (23/10/2026) encontró que el script de migración (scripts/crm-auto-a-automatizaciones.mts):
//   · colgaba T6 de etapas de salida, que el CRON rechaza DESPUÉS del insert, y se cortaba a mitad (S1/S4);
//   · con --activar sin --aplicar, o las dos juntas, apagaba el motor sin nada que lo reemplace (S2);
//   · tomaba por hecha cualquier fila con la clave de la plantilla, aunque estuviera rota (S3);
//   · ponía T2 sólo en Lead entrante, y los que el motor ya había pasado a No Agenda no llegaban a Reactivación (S5);
//   · prendía en un orden sin vuelta atrás (S6), exageraba el «antes» (S7), no decía quién queda sin plazo (S8) y armaba el
//     plan con las etapas de fábrica si no podía leer el funnel (S9);
//   · y una sola «Una Reunión Sin Marcar» para las dos reuniones nunca revisaba la 2ª (M1/E1), y con la 1ª sin marcar y la
//     2ª agendada esperaba a la 2ª (M4).
// La 2ª revisión (wf_933af347-1e1, 24/10/2026) sumó: el deshacer de --activar no volvía el setting si el compare-and-set
// tiraba; la línea del historial quedaba fuera del todo o nada; la evidencia de «motor prendido» contaba a clientes y a
// personas; las T1 que piden decisión se archivaban sin que nadie las volviera a pedir; una fila distinta se adoptaba
// mirando sólo el CRON; M4 seguía roto con la etapa DERIVADA; y el simulacro no decía qué T1 avisa enseguida.
// Lo puro está en lib/crm-auto-migracion.ts y se prueba acá; el cableado del script, leyendo su fuente.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  planDelNegocio, conAnclaDeReunion, alPlan, pasosDelPlan, clasificarVivas, diferenciaConElPlan, tomaAlPrender, claveAntiLoop, claveDelPlan,
  confirmacionesAArchivar, type PlanMigracion, type FilaViva, type LeadMigracion, type ConfirmacionPendiente,
} from '../lib/crm-auto-migracion';
import { plantillaPorId, pasosDePlantilla, disparadorDeEleccion, destinoDeEleccion } from '../lib/plantillas-automatizaciones';
import {
  resolverControl, siguienteIndice, catalogoDeLead, fechasDespuesDe, camposDelFlujo, esNodoDeControl, RELLENO_CONTROL, type FilaLeadCatalogo,
} from '../lib/nutricion-grafo-motor';
import { sanearAccion } from '../lib/nutricion-paso-accion';
import { normalizar, juntarPasosIA, raizSalida, indicePorId, type PasoGrafo, type HechosLead } from '../lib/flujo-grafo';
import { conEtapasDelCron, type Disparador } from '../lib/disparadores';
import { OP_AVISAR } from '../lib/flujo-legado';
import { planLeadAuto, type AutoLead } from '../lib/crm-auto-plan';
import { pipelineStageOf } from '../lib/pipeline';
import { hoyEnTz } from '../lib/date-utils';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (x: string) => x.replace(/^[ \t]*\/\/.*$/gm, '');
const MX = 'America/Mexico_City';
const H = 3_600_000;
const DIA = 24 * H;
const T0 = Date.parse('2026-10-14T15:00:00Z');
const isoDe = (ms: number) => new Date(ms).toISOString();
/** El embudo del negocio de las pruebas. */
const F = 5;

/** El CRM de venta de un negocio como el de Mauricio: entrada, dos reuniones, nutrición, manual, reactivación y las salidas. */
const ETAPAS = [
  { key: 'lead', kind: 'entrada' }, { key: 'agenda', kind: 'reunion' }, { key: 'agendaj2', kind: 'reunion' }, { key: 'facturando', kind: 'pago' },
  { key: 'ganado', kind: 'cierre' }, { key: 'nutri' }, { key: 'manual' }, { key: 'reactivacion' }, { key: 'noresp' }, { key: 'perdido' },
];
/** Las que el CRON acepta (`productosConEtapas` saca las de salida). */
const VENDIBLES = new Set(ETAPAS.map((e) => e.key).filter((k) => k !== 'noresp' && k !== 'perdido'));

// ── 1. El plan ──────────────────────────────────────────────────────────────────────────────────

// Roturas: T2 sin «nutri» en el CRON → cae éste; una sola «Reunión Sin Marcar» → cae éste; la de la R1 colgada sólo de su
// etapa (sin la de la R2) → cae éste y el 3b.
test('1. el plan: T2 en Lead entrante y No Agenda, una «Reunión Sin Marcar» por reunión (acotada a ella), T3, y T6 no', () => {
  const { planes, faltan, bloqueos } = planDelNegocio(ETAPAS, VENDIBLES, F);
  assert.deepEqual(bloqueos, []);
  assert.deepEqual(planes.map((p) => [p.regla, p.cron, p.ancla ?? null, p.reunion ?? null]), [
    ['T2', 'venta::lead,nutri', null, null],
    ['T1', 'venta::agenda,agendaj2', 'reunion_1', '5:agenda'],
    ['T1', 'venta::agendaj2', 'reunion_2', '5:agendaj2'],
    ['T3', 'venta::manual', null, null],
  ]);
  assert.deepEqual(planes[0].destinos, { no_agenda: 'venta::nutri', reactivacion: 'venta::reactivacion' });
  assert.equal(planes.some((p) => p.plantilla === ('lead-se-enfrio' as never)), false, 'T6 no se crea (S1/S4)');
  assert.ok(faltan.some((f) => /^T6 .*etapas de salida.*deja de correr/.test(f)), 'el simulacro dice que T6 deja de correr');
  // Cada CRON y cada destino, uno que el desplegable entiende (el mismo camino que la galería).
  for (const p of planes) {
    assert.ok(disparadorDeEleccion('etapa_venta', p.cron), `${p.regla}: el CRON ${p.cron} no se entiende`);
    for (const v of Object.values(p.destinos ?? {})) assert.ok(destinoDeEleccion(v), `${p.regla}: el destino ${v} no se entiende`);
  }
  assert.deepEqual(planes.map((p) => claveDelPlan(p)), [null, 'T1:j1', 'T1:j2', 'T3']);
});

test('1b. una etapa que el CRON no acepta, o sin embudo, BLOQUEA al negocio antes de crear nada (S1); lo que falta, se dice', () => {
  const sinNutri = planDelNegocio(ETAPAS, new Set([...VENDIBLES].filter((k) => k !== 'nutri')), F);
  assert.ok(sinNutri.bloqueos.some((b) => /^T2: la etapa «nutri»/.test(b)), JSON.stringify(sinNutri.bloqueos));
  assert.ok(planDelNegocio(ETAPAS, VENDIBLES, null).bloqueos.some((b) => /^T1: sin el embudo/.test(b)), 'sin embudo no se puede acotar a una reunión');
  const chico = planDelNegocio([{ key: 'lead', kind: 'entrada' }, { key: 'facturando', kind: 'pago' }], VENDIBLES, F);
  assert.deepEqual(chico.planes, []);
  assert.ok(chico.faltan.some((f) => /^T2 .*faltan las etapas nutri, reactivacion/.test(f)));
  assert.ok(chico.faltan.some((f) => /^T1 .*no tiene etapas de reunión/.test(f)));
  assert.ok(chico.faltan.some((f) => /^T3 .*no hay etapa manual/.test(f)));
  // Una sola reunión: una «Reunión Sin Marcar», colgada de ésa. Tres: el motor sólo conoce dos; la tercera se dice.
  const una = planDelNegocio(ETAPAS.filter((e) => e.key !== 'agendaj2'), VENDIBLES, F);
  assert.deepEqual(una.planes.filter((p) => p.regla === 'T1').map((p) => [p.cron, p.reunion]), [['venta::agenda', '5:agenda']]);
  const tres = planDelNegocio([...ETAPAS, { key: 'agendaj3', kind: 'reunion' }], new Set([...VENDIBLES, 'agendaj3']), F);
  assert.equal(tres.planes.filter((p) => p.regla === 'T1').length, 2);
  assert.ok(tres.faltan.some((f) => /^T1 para agendaj3/.test(f)));
});

// ── 2. Las vivas contra el plan (S3 y la firma del grafo) ─────────────────────────────────────────

const { planes: PLANES } = planDelNegocio(ETAPAS, VENDIBLES, F);
const [T2, R1, R2, T3] = PLANES;
/** La fila como la deja el script: los pasos del plan (normalizados) y el CRON del desplegable. */
function filaDe(plan: PlanMigracion, id: number, o: Partial<FilaViva> = {}): FilaViva {
  return {
    id, clave: `plantilla-${plan.plantilla}-x${id}`, nombre: plantillaPorId(plan.plantilla)!.nombre, activa: false, trigger_tipo: 'etapa_actual',
    disparadores: [disparadorDeEleccion('etapa_venta', plan.cron)], pasos: pasosDelPlan(plan), ...o,
  };
}
const conPasos = (fila: FilaViva, cambiar: (p: PasoGrafo & Record<string, unknown>) => PasoGrafo) => ({ ...fila, pasos: (fila.pasos as PasoGrafo[]).map((p) => cambiar(p as PasoGrafo & Record<string, unknown>)) });

// Rotura (2ª revisión): sin la firma del grafo, la T3 con su condición cambiada y la T2 sin su «Está en la etapa» se adoptan.
test('2. «ya existe» es la fila que ES el plan (el grafo entero); con la clave pero distinta, o repetida, frena al negocio', () => {
  const buenas = PLANES.map((p, i) => filaDe(p, 100 + i));
  const r = clasificarVivas(buenas, PLANES);
  assert.deepEqual(r.deCada.map((f) => f?.id ?? null), [100, 101, 102, 103]);
  assert.deepEqual(r.ajenas, []);
  // Las dos «Reunión Sin Marcar» se distinguen por su CRON: el orden en la base no importa.
  assert.deepEqual(clasificarVivas([...buenas].reverse(), PLANES).deCada.map((f) => f?.id ?? null), [100, 101, 102, 103]);

  const casos: Array<[string, FilaViva, RegExp]> = [
    ['sin CRON (se cortó a mitad)', filaDe(T2, 200, { disparadores: [] }), /no tiene CRON/],
    ['otro CRON', filaDe(T2, 201, { disparadores: [disparadorDeEleccion('etapa_venta', 'venta::lead')] }), /su CRON es lead, no lead \+ nutri/],
    ['otro embudo', filaDe(T2, 202, { disparadores: [{ ...disparadorDeEleccion('etapa_venta', 'venta::lead,nutri')!, funnel_id: 9 }] }), /del embudo 9/],
    ['otro destino', filaDe({ ...T2, destinos: { no_agenda: 'venta::manual', reactivacion: 'venta::reactivacion' } }, 203), /na_mv1 mueve a «manual», no a «nutri»/],
    ['R2 con el ancla de la R1', { ...filaDe(R1, 204), disparadores: [disparadorDeEleccion('etapa_venta', R2.cron)] }, /cuenta desde «reunion_1», no desde «reunion_2»/],
    ['sin el ancla (la de la plantilla)', filaDe({ ...R1, ancla: undefined }, 205), /cuenta desde «reunion», no desde «reunion_1»/],
    ['la pregunta sin acotar a su reunión', filaDe({ ...R1, reunion: undefined }, 206), /la tarjeta rm_c2? no es la de la plantilla/],
    ['T3 con otra condición', conPasos(filaDe(T3, 207), (p) => (p.id === 'nv_c' ? { ...p, ramas: p.ramas!.map((x) => ({ ...x, filas: x.filas.slice(0, 1) })) } : p)), /la tarjeta nv_c no es la de la plantilla/],
    ['T2 sin su «Está en la etapa»', conPasos(filaDe(T2, 208), (p) => (p.id === 'na_c2' ? { ...p, ramas: p.ramas!.map((x) => ({ ...x, filas: x.filas.map((f) => (f.campo === 'etapa' ? { ...f, valor: 'manual' } : f)) })) } : p)), /la tarjeta na_c2 no es la de la plantilla/],
    ['una tarjeta de más', { ...filaDe(T3, 209), pasos: [...(filaDe(T3, 209).pasos as PasoGrafo[]), { id: 'extra', siguiente: null }] }, /tiene una tarjeta de más \(extra\)/],
  ];
  for (const [nombre, fila, motivo] of casos) {
    const x = clasificarVivas([fila], PLANES);
    assert.equal(x.deCada.some(Boolean), false, `${nombre}: la adoptó`);
    assert.equal(x.ajenas.length, 1, nombre);
    assert.match(x.ajenas[0].motivo, motivo, nombre);
  }
  // El texto del aviso se puede reescribir: eso no la hace otra.
  assert.equal(diferenciaConElPlan(conPasos(filaDe(T3, 210), (p) => (p.id === 'nv_mk' ? { ...p, cuerpo: 'otro texto' } : p)), T3), null);
  // Dos que son el mismo plan: no se adivina cuál vale.
  const dos = clasificarVivas([filaDe(T2, 300), filaDe(T2, 301)], PLANES);
  assert.equal(dos.deCada[0]?.id, 300);
  assert.match(dos.ajenas[0].motivo, /es la misma que #300/);
  // Una de una plantilla que no está en el plan («Un Lead Se Enfrió», que alguien creó a mano) no se toca ni frena.
  const otra = clasificarVivas([{ ...filaDe(T2, 400), clave: 'plantilla-lead-se-enfrio-x400' }], PLANES);
  assert.deepEqual([otra.deCada.some(Boolean), otra.ajenas.length], [false, 0]);
});

test('2b. el plan sobre los pasos: la espera anclada a su reunión y la pregunta acotada a ella; copia', () => {
  const pasos = pasosDePlantilla(plantillaPorId('reunion-sin-marcar')!);
  const antes = JSON.stringify(pasos);
  const r2 = alPlan(pasos, R2);
  assert.equal(JSON.stringify(pasos), antes, 'tocó los pasos que recibió');
  const esperas = (ps: readonly PasoGrafo[]) => ps.filter((p) => p.nodo === 'esperar').map((p) => [p.id, p.espera?.modo, (p.espera as { de?: string }).de ?? null, p.espera?.minutos]);
  assert.deepEqual(esperas(r2), [['rm_e', 'despues_de', 'reunion_2', 180], ['rm_e2', 'tiempo', null, 2 * 24 * 60]]);
  const preguntas = r2.flatMap((p) => (p.ramas ?? []).flatMap((x) => x.filas.filter((f) => f.campo === 'asistencia_sin_marcar').map((f) => (f as { reuniones?: string[] }).reuniones)));
  assert.deepEqual(preguntas, [['5:agendaj2'], ['5:agendaj2']], 'las dos preguntas, acotadas a la 2ª');
  assert.deepEqual(esperas(conAnclaDeReunion(pasos, 'reunion_1'))[0], ['rm_e', 'despues_de', 'reunion_1', 180]);
});

/**
 * LO QUE GUARDA `setSecuenciaPasos` (lib/nutricion.ts): cada paso se reconstruye con `camposDelFlujo` y la acción con
 * `sanearAccion`, y después `normalizar` y `juntarPasosIA`. Repetido acá para probar que la firma del grafo sobrevive al
 * guardado (si no, `--aplicar` diría «quedó mal» sobre una fila buena). Si `setSecuenciaPasos` cambia, cae el 2c.
 */
function comoLoGuarda(pasos: readonly PasoGrafo[]): PasoGrafo[] {
  const limpio = pasos.map((p, i) => {
    const flujo = camposDelFlujo(p);
    if (esNodoDeControl(flujo)) return { orden: i + 1, ...RELLENO_CONTROL, ...flujo };
    const a = sanearAccion((p as { accion?: unknown }).accion);
    const comun = { orden: i + 1, canal: 'whatsapp', delay_horas: 0, ...flujo };
    return a?.ok ? { ...comun, asunto: null, preheader: null, cuerpo: '', template_wa: null, accion: a.accion } : { ...comun, cuerpo: (p as { cuerpo?: string }).cuerpo };
  });
  const junto = juntarPasosIA(normalizar(limpio as PasoGrafo[]));
  return JSON.parse(JSON.stringify(normalizar(junto.pasos as PasoGrafo[])));
}

test('2c. la firma sobrevive al guardado: una fila guardada como la deja setSecuenciaPasos ES su plan', () => {
  for (const p of PLANES) {
    assert.equal(diferenciaConElPlan(filaDe(p, 1, { pasos: comoLoGuarda(pasosDelPlan(p)) }), p), null, `${p.regla} ${p.cron}`);
  }
  // Y el camino de guardado es el que se repite arriba.
  const n = leer('lib/nutricion.ts');
  assert.match(n, /if \(esNodoDeControl\(flujo\)\) return \{ orden: i \+ 1, \.\.\.RELLENO_CONTROL, \.\.\.flujo \} as PasoSecuencia;/);
  assert.match(n, /if \(a\?\.ok\) return \{ \.\.\.comun, asunto: null, preheader: null, cuerpo: '', template_wa: null, accion: a\.accion \};/);
});

// ── 3. La 2ª reunión y la 1ª sin marcar, en el motor (M1/E1/M4) ─────────────────────────────────

type Hecho = { dia: number; id: string; op: string };
/**
 * El hilo de una automatización como el motor: `resolverControl` desde `desdeId` (o la entrada), hasta `hastaMs`. La etapa
 * del lead es la DERIVADA de su fila (`pipelineStageOf`), como la ve el barrido, salvo que la fila la traiga guardada.
 */
function correr(pasos: readonly PasoGrafo[], cronEtapas: string[], fila: FilaLeadCatalogo & Partial<AutoLead>, desdeMs: number, hastaMs: number, desdeId?: string): { hechos: Hecho[]; fin: string } {
  const cron: Disparador[] = [{ id: 'd1', trigger_tipo: 'etapa_actual', etapa: cronEtapas[0], etapas: cronEtapas.length > 1 ? cronEtapas : null, funnel_id: F }];
  const etapa = pipelineStageOf({ estado_lead: 'abierto', fecha_agenda: null, fecha_junta_1: null, fecha_junta_2: null, asistio_j1: null, asistio_j2: null, ...fila } as never);
  const hechos: Hecho[] = [];
  let idx = indicePorId(pasos, desdeId ?? raizSalida(pasos));
  let ahora = desdeMs;
  for (let vuelta = 0; vuelta < 40 && idx >= 0; vuelta++) {
    const base: HechosLead = {
      etiquetas: new Set(), etapa, etapasPorProducto: new Map([[F, etapa]]), agendo: true, pago: false, yaContactado: false, respondio: false,
      creadoMs: T0, tieneTelefono: true, tieneEmail: false, ahoraMs: ahora,
      catalogo: { lead: catalogoDeLead(fila, ahora, hoyEnTz(MX, new Date(ahora))), reuniones: new Map([[F, ['agenda', 'agendaj2']]]) },
    };
    const r = resolverControl(pasos, idx, { hechos: conEtapasDelCron(base, cron), ahoraMs: ahora, reunionMs: null, fechasDespues: fechasDespuesDe(fila, MX) });
    if (r.tipo === 'esperar') { if (r.proximoMs > hastaMs) return { hechos, fin: 'esperando' }; ahora = r.proximoMs; idx = r.idx; continue; }
    if (r.tipo !== 'nodo') return { hechos, fin: r.tipo };
    const x = pasos[r.idx] as PasoGrafo & { accion?: { operacion: string } };
    hechos.push({ dia: Math.floor((ahora - desdeMs) / DIA), id: x.id!, op: x.accion?.operacion ?? 'mensaje' });
    idx = siguienteIndice(pasos, r.idx);
  }
  return { hechos, fin: 'fin' };
}
const autoLead = (o: Partial<AutoLead>): AutoLead => ({
  id: 1, nombre: 'Lead', estado_lead: 'abierto', pipeline_stage: null, fecha_agenda: null, fecha_junta_1: null, fecha_junta_2: null,
  junta_1_at: null, junta_2_at: null, asistio_j1: null, asistio_j2: null, nutricion_manual_deadline: null, created_at: isoDe(T0), updated_at: null, ...o,
} as AutoLead);
const DE_LA_PLANTILLA = normalizar(pasosDePlantilla(plantillaPorId('reunion-sin-marcar')!)) as PasoGrafo[];

test('3. la 2ª reunión tiene SU automatización: entra sin la fecha, la espera, y avisa a la R2 + 3 h, como el motor (T1:j2)', () => {
  const R1MS = T0 - 2 * DIA;
  const R2MS = T0 + 3 * DIA;
  // Pasó a «Agenda R2» con la R1 marcada, y la fecha de la R2 todavía no está cargada (etapa guardada: sin fecha de la R2,
  // la derivada sería otra).
  const sinR2 = { estado_lead: 'abierto', pipeline_stage: 'agendaj2', junta_1_at: isoDe(R1MS), fecha_junta_1: '2026-10-12', asistio_j1: true } as FilaLeadCatalogo;
  assert.equal(correr(pasosDelPlan(R2), R2.etapas, sinR2, T0, T0 + 10 * DIA).fin, 'sin_ancla', 'con su ancla, la espera dice «no sé» y se vuelve a mirar');
  // Rotura M1(a): con «la reunión» (la de la plantilla), el ancla es la R1 que ya pasó: el hilo TERMINA sin preguntar.
  const viejo = correr(DE_LA_PLANTILLA, R2.etapas, sinR2, T0, T0 + 10 * DIA);
  assert.deepEqual([viejo.fin, viejo.hechos.length], ['fin', 0]);
  // Se carga la R2 y el hilo, que esperaba en la espera, avisa a las 3 h de la R2 y no antes.
  const conR2 = { ...sinR2, junta_2_at: isoDe(R2MS), fecha_junta_2: '2026-10-17' } as FilaLeadCatalogo;
  assert.deepEqual(correr(pasosDelPlan(R2), R2.etapas, conR2, T0 + 2 * H, R2MS + 3 * H, 'rm_e').hechos.map((h) => h.op), [OP_AVISAR]);
  assert.equal(correr(pasosDelPlan(R2), R2.etapas, conR2, T0 + 2 * H, R2MS + 3 * H - 60_000, 'rm_e').hechos.length, 0, 'avisa antes de la R2 + 3 h');
  // El motor, el mismo lead: T1 sobre la R2.
  const motor = planLeadAuto(autoLead({ pipeline_stage: 'agendaj2', junta_1_at: isoDe(R1MS), fecha_junta_1: '2026-10-12', asistio_j1: true, junta_2_at: isoDe(R2MS), fecha_junta_2: '2026-10-17' }), '2026-10-17', R2MS + 3 * H + 60_000);
  assert.deepEqual(motor.filter((a) => a.regla === 'T1').map((a) => (a as { which?: string }).which), ['j2']);
});

// Rotura (2ª revisión): la de la R1 colgada sólo de «agenda» → la etapa derivada ya es «agendaj2» y no pregunta: cae éste.
test('3b. la 1ª sin marcar con la 2ª ya cargada (la etapa DERIVADA ya es la de la R2): se pregunta a la R1 + 3 h (M4)', () => {
  const R1MS = T0 + 1 * DIA;
  const R2MS = T0 + 8 * DIA;
  const fila = { estado_lead: 'abierto', fecha_agenda: '2026-10-14', junta_1_at: isoDe(R1MS), fecha_junta_1: '2026-10-15', junta_2_at: isoDe(R2MS), fecha_junta_2: '2026-10-22' } as FilaLeadCatalogo;
  assert.equal(pipelineStageOf({ asistio_j1: null, asistio_j2: null, ...fila } as never), 'agendaj2', 'la premisa: con la R2 cargada, la derivada es la de la R2');
  const r1 = correr(pasosDelPlan(R1), R1.etapas, fila, T0, R1MS + 3 * H);
  assert.deepEqual(r1.hechos.map((h) => h.op), [OP_AVISAR], 'la de la R1 pregunta por la R1 a la R1 + 3 h');
  // La de la R2 no pregunta por la R1 (la pregunta está acotada a la 2ª): no hay dos avisos por lo mismo.
  assert.equal(correr(pasosDelPlan(R2), R2.etapas, fila, T0, R1MS + 3 * H).hechos.length, 0);
  // Con «la reunión» (la última) y sin acotar, a la R1 + 3 h todavía espera (a la R2 + 3 h).
  assert.equal(correr(DE_LA_PLANTILLA, ['agenda', 'agendaj2'], fila, T0, R1MS + 3 * H).hechos.length, 0);
  // Marcada la R1, la de la R1 ya no pregunta.
  assert.equal(correr(pasosDelPlan(R1), R1.etapas, { ...fila, asistio_j1: true } as FilaLeadCatalogo, T0, R1MS + 3 * H).hechos.length, 0);
});

// ── 4. A quién toma al prenderla (S7/S8) ──────────────────────────────────────────────────────────

const lead = (id: number, o: Partial<LeadMigracion>): LeadMigracion => ({
  id, estado_lead: 'abierto', pipeline_stage: null, fecha_agenda: null, fecha_junta_1: null, fecha_junta_2: null, asistio_j1: null, asistio_j2: null,
  created_at: isoDe(T0 - 5 * DIA), ...o,
});

// Rotura: sin la ventana de 90 días, el 5 entra en `ids` → cae éste.
test('4. toma a los abiertos en la etapa con un hito en 90 días; dice los sin fecha, los del grupo, los que nunca entran y quién avisa ya', () => {
  const leads = [
    lead(1, { pipeline_stage: 'lead' }),
    lead(2, { pipeline_stage: 'nutri' }),
    lead(3, { pipeline_stage: 'lead', estado_lead: 'ganado' }),
    lead(4, { pipeline_stage: 'lead', origen_lead: 'grupo_whatsapp' }),
    lead(5, { pipeline_stage: 'lead', created_at: isoDe(T0 - 120 * DIA) }),
    lead(6, { pipeline_stage: 'manual', nutricion_manual_deadline: '2026-10-20' }),
    lead(7, { pipeline_stage: 'manual' }),
    lead(8, { pipeline_stage: 'agendaj2', fecha_junta_1: '2026-10-10', asistio_j1: true }),
    // Sin la etapa guardada: la derivada (`pipelineStageOf`), como el barrido.
    lead(9, { fecha_agenda: '2026-10-13', fecha_junta_1: '2026-10-20' }),
    // La R1 fue hace dos días, sin marcar: la de la R1 avisa apenas se prende.
    lead(10, { pipeline_stage: 'agenda', junta_1_at: isoDe(T0 - 2 * DIA), fecha_junta_1: '2026-10-12' }),
  ];
  assert.deepEqual(tomaAlPrender(leads, T2, T0), { ids: [1, 2, 4], sinFecha: [], delGrupo: [4], fueraDeVentana: [5], avisaEnseguida: [] });
  assert.deepEqual(tomaAlPrender(leads, T3, T0), { ids: [6, 7], sinFecha: [7], delGrupo: [], fueraDeVentana: [], avisaEnseguida: [] });
  assert.deepEqual(tomaAlPrender(leads, R2, T0), { ids: [8], sinFecha: [8], delGrupo: [], fueraDeVentana: [], avisaEnseguida: [] });
  // La de la R1 cuelga de las dos etapas de reunión: el 8 (en la de la R2, con su R1 marcada) entra, pero no avisa.
  assert.deepEqual(tomaAlPrender(leads, R1, T0, { zona: MX }), { ids: [8, 9, 10], sinFecha: [], delGrupo: [], fueraDeVentana: [], avisaEnseguida: [10] });
  // Con el día del NEGOCIO: el del plazo todavía no avisa; el siguiente, sí, y apenas se prende (no se deshace).
  assert.deepEqual(tomaAlPrender(leads, T3, T0, { hoy: '2026-10-20' }).avisaEnseguida, []);
  assert.deepEqual(tomaAlPrender(leads, T3, T0, { hoy: '2026-10-21' }).avisaEnseguida, [6]);
  // Una adoptada que ya corrió: quien ya pasó por ella no vuelve a entrar (una inscripción por lead y automatización).
  assert.deepEqual(tomaAlPrender(leads, T3, T0, { hoy: '2026-10-21', yaPasaron: new Set([6]) }).ids, [7]);
});

test('4b. «haría hoy» descuenta lo que el motor saltea por su clave anti-loop (S7)', () => {
  assert.equal(claveAntiLoop({ regla: 'T1', which: 'j2' }), 'T1:j2');
  assert.equal(claveAntiLoop({ regla: 'T1' }), 'T1:j1');
  assert.equal(claveAntiLoop({ regla: 'T3' }), 'T3');
  assert.equal(claveAntiLoop({ regla: 'T6' }), 'T6');
  assert.equal(claveAntiLoop({ regla: 'T2' }), null, 'T2 no deja confirmación: no hay qué descontar');
  const motor = leer('lib/crm-auto.ts');
  assert.match(motor, /const clave = `T1:\$\{which\}`;/);
  assert.match(motor, /yaConf\.has\(a\.leadId \+ '\|T3'\)/);
  assert.match(motor, /yaConf\.has\(a\.leadId \+ '\|T6'\)/);
});

// ── 5. Las confirmaciones viejas ──────────────────────────────────────────────────────────────

/** Las 7 pendientes medidas el 24/10/2026 (6 T1 del negocio de Mauricio, ya aplicadas; 1 T3 del de Leila), y dos más. */
const PENDIENTES: ConfirmacionPendiente[] = [
  ...[70, 71, 72, 73, 74, 75].map((id, i) => ({ id, lead_id: 2400 + i, lead_nombre: 'X', regla: 'T1', clave: i === 0 ? 'T1:j2' : 'T1:j1', aplicado: true })),
  { id: 76, lead_id: 1779, lead_nombre: 'Emmanuel', regla: 'T3', clave: 'T3', aplicado: false },
  { id: 77, lead_id: 9, lead_nombre: 'Y', regla: 'T6', clave: 'T6', aplicado: true },
  { id: 78, lead_id: 3000, lead_nombre: 'Z', regla: 'T1', clave: 'T1:j1', aplicado: false },
];
const TODAS = new Set(['T1:j1', 'T1:j2', 'T3']);

// Roturas: sin mirar `vuelveAPreguntar` → caen la #76 y la #78; decidir por REGLA y no por clave → cae la #70 sin plan de la R2.
test('5. se archivan las de una clave que queda PRENDIDA, sin tocar al lead; la que pide decisión, sólo si se la vuelven a pedir', () => {
  const pregunta = new Map([['T3', new Set([1779])], ['T1:j1', new Set([3000])]]);
  const r = confirmacionesAArchivar(PENDIENTES, TODAS, pregunta);
  assert.deepEqual(r.archivar.map((c) => c.id), [70, 71, 72, 73, 74, 75, 76, 78]);
  assert.deepEqual(r.quedan.map((c) => c.id), [77], 'T6 no pasa a ninguna automatización: queda viva');
  // La #75 (y cada una): el motivo dice que se cerró SIN TOCAR al lead, y qué pasa con lo que el motor ya aplicó.
  const c75 = r.archivar.find((c) => c.id === 75)!;
  assert.match(c75.motivo, /Se cerró sin tocar al lead\./);
  assert.match(c75.motivo, /«Una Reunión Sin Marcar»/);
  assert.match(c75.motivo, /ya aplicó queda como está y se deshace desde el historial/);
  assert.doesNotMatch(r.archivar.find((c) => c.id === 76)!.motivo, /ya aplicó/, 'la T3 no aplicó nada');
  // Sin que se la vuelvan a pedir (sin plazo, fuera de la etapa, ya pasó por ella…), la que pide decisión queda viva. Y sin el
  // conjunto de su clave, también: se cierra en falla.
  const sin = confirmacionesAArchivar(PENDIENTES, TODAS, new Map([['T3', new Set<number>()]]));
  assert.ok(sin.quedan.some((c) => c.id === 76 && /no lo vuelve a preguntar/.test(c.porque)));
  assert.ok(sin.quedan.some((c) => c.id === 78 && /no lo vuelve a preguntar/.test(c.porque)), 'una T1 que pide decisión, sin conjunto: viva');
  // Por CLAVE: un embudo con una sola reunión no cubre T1:j2 (la #70 queda), y sin «Venció la Nutrición Manual», la #76 tampoco.
  const unaReunion = confirmacionesAArchivar(PENDIENTES, new Set(['T1:j1']), pregunta);
  assert.ok(unaReunion.quedan.some((c) => c.id === 70 && /T1:j2 no pasa/.test(c.porque)));
  assert.ok(unaReunion.quedan.some((c) => c.id === 76 && /T3 no pasa/.test(c.porque)));
});

// ── 6. El cableado del script ─────────────────────────────────────────────────────────────────

test('6. el script: dos pasos separados, sin filas rotas, todo o nada al activar, y el motor con compare-and-set', () => {
  const s = sinComentarios(leer('scripts/crm-auto-a-automatizaciones.mts'));
  assert.match(s, /planDelNegocio, alPlan, clasificarVivas, diferenciaConElPlan, tomaAlPrender, claveAntiLoop, claveDelPlan, confirmacionesAArchivar/);
  // S2: --aplicar y --activar nunca juntas.
  assert.match(s, /if \(aplicar && activar\) throw new Error\(/);
  // La evidencia de «motor prendido» sin setting: sólo el dueño, y sólo las líneas del MOTOR (2ª revisión).
  assert.match(s, /if \(flag == null && w\.id !== OWNER_WS\) \{/);
  assert.equal((s.match(/\.like\('valor_nuevo', DEL_MOTOR\)/g) ?? []).length, 2, 'la evidencia y el «antes» de 30 días, sólo con las líneas del motor');
  assert.match(s, /const DEL_MOTOR = 'T_:%';/);
  // S9: sin funnel o sin productos, no se toca el negocio; el plan, con el embudo.
  assert.match(s, /if \(funnel\.origen === 'error'\) \{[^}]*return; \}/);
  assert.match(s, /if \(\(await leerFunnels\(\)\) == null\) \{[^}]*return; \}/);
  assert.match(s, /planDelNegocio\(stages, vendibles, funnel\.id \?\? null\)/);
  // S1: un bloqueo o una ajena cortan ANTES de escribir; y sin `motivoDeCron`, un CRON que falla borra su fila.
  assert.ok(s.indexOf('if (bloqueos.length)') < s.indexOf('if (aplicar) {') && s.indexOf('if (ajenas.length)') < s.indexOf('if (aplicar) {'));
  assert.doesNotMatch(s, /motivoDeCron/);
  // M1/M4: los pasos del plan (el ancla y la pregunta acotada) se ponen al guardar; lo creado se relee contra el plan entero.
  assert.match(s, /setPasos: \(id: number, pasos: never\[\]\) => setSecuenciaPasos\(id, alPlan\(pasos, plan\)\)/);
  assert.match(s, /const dif = diferenciaConElPlan\(f, plan\);/);
  // Una adoptada que ya corrió: sus inscripciones salen de la toma.
  assert.match(s, /tomaAlPrender\(leads as never, plan, Date\.now\(\), \{ hoy: hoyDelNegocio, zona, yaPasaron: yaPasaron\[i\] \}\)/);
  // --activar: prender → releer → apagar (CAS) → pendientes DE NUEVO → archivar → la línea del historial, en ese orden.
  const act = s.slice(s.indexOf('const faltanFilas = planes.filter'));
  assert.ok(act.length < s.length, 'no encontré el bloque de --activar');
  const orden = [
    'await setSecuenciaActiva(f.id, true, { aunqueDuplique, ws: w.id });', 'diferenciaConElPlan(r, planes[i])', 'intentoSetting = true;',
    "cambiarSettingSi(KEY_CRM_AUTO, crudo, 'false')", 'if (await crmAutoHabilitado())', 'confirmacionesAArchivar(await pendientesDe(w.id), cubiertas, vuelveAPreguntar)',
    ".update({ estado: 'archivado'", ".from('lead_audit')\n          .insert(",
  ];
  const pos = orden.map((x) => act.indexOf(x));
  assert.ok(pos.every((p) => p > 0), JSON.stringify(orden.filter((_, i) => pos[i] < 0)));
  assert.deepEqual([...pos].sort((a, b) => a - b), pos, 'el orden de --activar cambió');
  assert.ok(act.indexOf('if (faltanFilas.length)') < pos[0], 'prende sin exigir la fila de cada plan');
  // Cada id se anota ANTES de escribir (si la respuesta se pierde, igual se deshace).
  assert.ok(act.indexOf('activadas.push(f.id);') < act.indexOf('await setSecuenciaActiva(f.id, true'));
  assert.ok(act.indexOf('archivadas.push({ id: c.id, motivo: c.motivo! });') < act.indexOf(".update({ estado: 'archivado'"));
  assert.match(act, /\.eq\('id', c\.id\)\.eq\('workspace_id', w\.id\)\.eq\('estado', 'pendiente'\)/, 'archiva sin comparar');
  assert.match(act, /if \(error \|\| !data\) throw new Error\(`la línea del historial/, 'la línea del historial se traga el error');
  assert.doesNotMatch(act, /logLeadEvent\(/, '`logLeadEvent` se traga el error: la línea no quedaría en el todo o nada');
  // El deshacer, al revés: las líneas, las archivadas (con SU motivo), el setting (siempre que se intentó, y releído), y el
  // reemplazo se pausa sólo si el motor volvió.
  const deshacer = act.slice(act.indexOf('} catch (e) {'));
  for (const x of [
    ".from('lead_audit').delete().in('id', lineas)", ".eq('estado', 'archivado').eq('resolved_by', a.motivo)", 'if (intentoSetting) {',
    "borrarSettingSi(KEY_CRM_AUTO, 'false')", "cambiarSettingSi(KEY_CRM_AUTO, 'false', crudo)", 'await getSettingEstricto(KEY_CRM_AUTO)',
    'if (motorComoAntes) {', 'await setSecuenciaActiva(id, false)',
  ]) assert.ok(deshacer.includes(x), `no deshace: ${x}`);
  // Primero se dice, después se intenta guardar el respaldo.
  assert.ok(deshacer.indexOf('for (const d of deshecho) console.log(') < deshacer.indexOf('guardarSiSePuede()'));
  assert.doesNotMatch(s, /setCrmAuto\(/, 'setCrmAuto es un upsert ciego: el motor se apaga con compare-and-set');
});

test('7. un toque viejo sobre una confirmación archivada lo dice (no contesta OK sin hacer nada)', () => {
  const c = leer('lib/mako-confirmaciones.ts');
  const i = c.indexOf("if (c.estado === 'archivado') throw new Error(");
  assert.ok(i > 0, 'una archivada contesta OK sin hacer nada');
  assert.ok(i < c.indexOf("if (c.estado !== 'pendiente') return;"), 'lo dice ANTES del «ya resuelta, no hago nada»');
});
