// =============================================================================
// Mover un lead SIN formulario: los requisitos también valen para MaKo
// =============================================================================
// El wizard del CRM no deja pasar a "Ganado" sin monto ni a "Perdido" sin motivo.
// Tres callers movían leads salteándose esa validación —el doer de WhatsApp
// (lib/mako-doer-acciones), las opciones del modal de confirmaciones
// (lib/mako-confirmaciones) y el motor del CRM automático (lib/crm-auto)—, así que
// MaKo podía dejar un lead en una etapa con datos incompletos que la UI jamás
// habría permitido, y ese lead reaparecía en el worklist sin que nadie supiera
// quién lo movió.
//
// Acá se prueban las dos mitades:
//   · la decisión, con la función PURA `faltantesParaMover` (nada toca Supabase);
//   · el CABLEADO, leyendo los archivos: el fix es inerte si un caller vuelve a
//     llamar a setPipelineStage sin declarar qué hace con los requisitos.
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Module from 'node:module';
import { DEFAULT_PIPELINE, generateFunnel } from '../lib/pipeline';
import type { Lead } from '../lib/leads';

// El funnel TAL CUAL lo recibe la validación en producción: `getPipelineStages()`
// devuelve las etapas GENERADAS, y son las únicas que traen `kind` (entrada /
// reunion / pago / cierre). Sin `kind` no hay nivel de requisitos: una lista de
// etapas "pelada" haría pasar cualquier movimiento, así que el test usa la real.
const DEFAULT_STAGES = generateFunnel(DEFAULT_PIPELINE, []).stages;

// lib/leads.ts es `server-only` y ese paquete TIRA al importarse fuera de un
// Server Component. Acá solo se llama una función pura: se neutraliza el marcador.
type Cargador = (pedido: string, padre: unknown, esMain: boolean) => unknown;
const M = Module as unknown as { _load: Cargador };
const cargarOriginal = M._load;
M._load = ((pedido: string, padre: unknown, esMain: boolean) =>
  pedido === 'server-only' ? {} : Reflect.apply(cargarOriginal, Module, [pedido, padre, esMain])) as Cargador;

const leads = () => import('../lib/leads');

/** Normalizado a \n: en Windows el CRLF rompe los cortes por bloque. */
const leer = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

/** Lead mínimo: todo en null/false salvo lo que el caso necesita. */
const L = (p: Partial<Lead>): Lead => ({
  id: 1, nombre: 'Lead', email: null, telefono: null, empresa: null,
  fecha_agenda: null, fecha_junta_1: null, fecha_junta_2: null, junta_1_at: null, junta_2_at: null,
  asistio_j1: null, asistio_j2: null, calificado: null, cerro: null,
  estado_lead: 'abierto', motivo_perdida: null,
  monto_cierre_usd: null, fecha_cierre: null,
  pipeline_stage: null, nutricion_realizada: false, fathom_links: [],
  setter: null, closer: null,
  ...p,
} as Lead);

const etiquetas = (steps: Array<{ label: string }>) => steps.map((s) => s.label);

// ── La decisión ──────────────────────────────────────────────────────────────

test('Perdido sin motivo NO se puede mover; con el motivo de ESTE movimiento sí', async () => {
  const { faltantesParaMover } = await leads();
  const lead = L({ fecha_agenda: '2026-07-01' });
  assert.deepEqual(
    etiquetas(faltantesParaMover(lead, 'perdido', DEFAULT_STAGES)),
    ['Motivo de la pérdida'],
    'esto es lo que MaKo podía saltearse: un Perdido sin motivo',
  );
  assert.deepEqual(
    faltantesParaMover(lead, 'perdido', DEFAULT_STAGES, { motivo: 'Se fue con la competencia' }),
    [],
  );
  // Un motivo vacío no cuenta como motivo.
  assert.equal(faltantesParaMover(lead, 'perdido', DEFAULT_STAGES, { motivo: '   ' }).length, 1);
});

test('el motivo de una pérdida ANTERIOR no da por contestada la de ahora', async () => {
  const { faltantesParaMover } = await leads();
  // Ya está en perdido con su motivo viejo; lo mueven a descalificado.
  const lead = L({ estado_lead: 'perdido', pipeline_stage: 'perdido', motivo_perdida: 'No tenía presupuesto' });
  assert.deepEqual(etiquetas(faltantesParaMover(lead, 'descal', DEFAULT_STAGES)), ['Motivo de la descalificación']);
});

test('override huérfano: la etapa de origen es la VIGENTE, no la cruda', async () => {
  const { faltantesParaMover } = await leads();
  // pipeline_stage apunta a una etapa que el funnel del workspace ya no tiene
  // (en ws1 hay cientos así). Con el override CRUDO el origen sería 'reactivacion',
  // "está entrando a perdido" y se le exigiría un motivo nuevo que nadie tiene.
  const funnelSinReactivacion = DEFAULT_STAGES.filter((s) => s.key !== 'reactivacion');
  const lead = L({ estado_lead: 'perdido', pipeline_stage: 'reactivacion', motivo_perdida: 'Se enfrió' });
  assert.deepEqual(faltantesParaMover(lead, 'perdido', funnelSinReactivacion), [], 'ya estaba perdido: su motivo alcanza');
});

test('Ganado exige monto — y la higiene NUNCA gatea un movimiento', async () => {
  const { faltantesParaMover } = await leads();
  const cerrado = L({
    fecha_junta_1: '2026-06-01', asistio_j1: true, calificado: true,
    fecha_junta_2: '2026-06-08', asistio_j2: true,
    fathom_links: [{ url: 'https://fathom.video/x', label: 'R1' }],
  });
  assert.deepEqual(etiquetas(faltantesParaMover(cerrado, 'ganado', DEFAULT_STAGES)), ['Monto de cierre']);
  assert.deepEqual(faltantesParaMover(cerrado, 'ganado', DEFAULT_STAGES, { monto: 4500 }), []);
  // setter/closer/empresa/teléfono están vacíos y aun así NO aparecen: son higiene
  // de la ficha, y el wizard tampoco los exige para mover.
  const conMonto = etiquetas(faltantesParaMover(cerrado, 'ganado', DEFAULT_STAGES, { monto: 4500 }));
  for (const higiene of ['Setter asignado', 'Closer asignado', 'Empresa', 'Teléfono de contacto']) {
    assert.ok(!conMonto.includes(higiene), `${higiene} no puede bloquear un movimiento`);
  }
});

test('una venta RECURRENTE cierra con su monto mensual (no se pide "Monto de cierre")', async () => {
  const { faltantesParaMover } = await leads();
  // El importe de una suscripción vive en `suscripcion_monto_usd`: `monto_cierre_usd`
  // queda null a propósito (una recurrencia indefinida no tiene total). Mirando solo
  // el monto de cierre, el wizard mostraba "Suscripción · $40/mes" en el resumen y
  // al confirmar reclamaba el monto — sin ningún paso donde cargarlo.
  const base: Partial<Lead> = {
    fecha_junta_1: '2026-06-01', asistio_j1: true, calificado: true,
    fecha_junta_2: '2026-06-08', asistio_j2: true,
    fathom_links: [{ url: 'https://fathom.video/x', label: 'R1' }],
  };
  const suscripcion = L({ ...base, venta_tipo: 'suscripcion', suscripcion_monto_usd: 40, suscripcion_meses: null });
  assert.deepEqual(faltantesParaMover(suscripcion, 'ganado', DEFAULT_STAGES), []);
  // Y el importe de una suscripción NO vale para un cierre de pago único.
  const unico = L({ ...base, venta_tipo: 'unico', suscripcion_monto_usd: 40 });
  assert.deepEqual(etiquetas(faltantesParaMover(unico, 'ganado', DEFAULT_STAGES)), ['Monto de cierre']);
});

test('las etapas que mueve el motor automático no exigen nada (no se traba)', async () => {
  const { faltantesParaMover } = await leads();
  // T2/T6 → nutrición y reactivación · T1 → No Show · T3 → No responde.
  const lead = L({ fecha_agenda: '2026-05-01' });
  for (const etapa of ['nutri', 'reactivacion', 'noresp', 'noshow_r1', 'noshow_r2']) {
    assert.deepEqual(faltantesParaMover(lead, etapa, DEFAULT_STAGES), [], `el motor no puede quedar trabado en ${etapa}`);
  }
});

test('la asistencia aportada EN el movimiento cuenta (el No Show del motor)', async () => {
  const { faltantesParaMover } = await leads();
  // Reunión pasada sin marcar: para una etapa que la exige, el dato que trae el
  // movimiento vale igual que el persistido.
  const lead = L({ fecha_junta_1: '2026-01-10', fecha_junta_2: '2026-01-20' });
  const sinAporte = etiquetas(faltantesParaMover(lead, 'facturando', DEFAULT_STAGES, { hoyISO: '2026-02-01' }));
  assert.ok(sinAporte.includes('Asistencia a la Reunión 1'));
  const conAporte = etiquetas(faltantesParaMover(lead, 'facturando', DEFAULT_STAGES, { hoyISO: '2026-02-01', asistioJ1: false }));
  assert.ok(!conAporte.includes('Asistencia a la Reunión 1'), 'la asistencia declarada al mover ya está contestada');
});

test('sin funnel a mano se valida contra el funnel por defecto (no se apaga la validación)', async () => {
  const { faltantesParaMover } = await leads();
  const lead = L({ fecha_agenda: '2026-07-01' });
  assert.deepEqual(etiquetas(faltantesParaMover(lead, 'perdido', null)), ['Motivo de la pérdida']);
  assert.deepEqual(etiquetas(faltantesParaMover(lead, 'perdido')), ['Motivo de la pérdida']);
});

// ── El cableado ──────────────────────────────────────────────────────────────

test('CABLEADO: setPipelineStage valida ANTES de escribir nada', () => {
  const src = leer('../lib/leads.ts');
  const cuerpo = src.slice(src.indexOf('export async function setPipelineStage'));
  const fin = cuerpo.indexOf('\nexport ', 1);
  const fn = fin === -1 ? cuerpo : cuerpo.slice(0, fin);
  const iValida = fn.indexOf('RequisitosFaltantesError(');
  assert.notEqual(iValida, -1, 'setPipelineStage dejó de validar los requisitos');
  assert.ok(
    iValida < fn.indexOf('await updateLead('),
    'un movimiento rechazado no puede dejar el estado_lead ya sincronizado con la etapa a la que no llegó',
  );
  assert.ok(
    fn.includes("logLeadEvent(id, 'Etapa sin validar'"),
    'saltear los requisitos tiene que dejar el motivo en el historial, no en silencio',
  );
  // Fail closed: un `omitir` vacío es el mismo agujero de antes, pero con tipos.
  assert.ok(fn.includes('if (opts?.requisitos && !omitido)'), 'un salteo sin motivo tiene que volver a validar');
  assert.ok(fn.includes('if (!antes) throw'), 'sin poder leer el lead no hay nada contra qué validar: no se mueve a ciegas');
});

test('CABLEADO: el doer de WhatsApp mueve con validación (y avisa qué falta)', () => {
  const src = leer('../lib/mako-doer-acciones.ts');
  const i = src.indexOf("case 'lead_etapa'");
  assert.notEqual(i, -1, "no encontré la acción 'lead_etapa'");
  const caso = src.slice(i, src.indexOf("case 'nutricion_toggle'"));
  assert.ok(caso.includes('veredictoRequisitos('), 'el "sí" por WhatsApp volvió a mover sin mirar los requisitos');
  assert.ok(caso.includes("requisitos: 'validar'"), 'sin poder leer el lead hay que fallar cerrado, no mover a ciegas');
  assert.ok(caso.includes('esRequisitosFaltantes'), 'la falta de datos tiene que volver como respuesta, no como error genérico');
  // Y se chequea también AL PROPONER, para pedir el dato antes del "sí".
  const prop = src.slice(src.indexOf("case 'proponer_cambio_etapa'"));
  assert.ok(prop.slice(0, 2500).includes('veredictoRequisitos('), 'la propuesta ya no chequea los requisitos');
});

// El reparto es lo que saca al doer del callejón sin salida: se PIDE lo que sus
// tools saben cargar (monto/motivo) y lo que no —fecha de reunión, asistencia,
// Fathom, Deal Details— no bloquea pero queda declarado en el historial. Sin
// esto, «mové a Juan a Agendado» rebotaba pidiendo una fecha que MaKo no tiene
// dónde escribir, y volvía a rebotar cuando el dueño se la decía.
test('CABLEADO: el doer solo exige lo que su tool sabe cargar', () => {
  const src = leer('../lib/mako-doer-acciones.ts');
  const i = src.indexOf('const REQUISITOS_PEDIBLES');
  assert.notEqual(i, -1, 'desapareció el reparto entre lo pedible y lo que no');
  const decl = src.slice(i, src.indexOf('\n', src.indexOf(';', i)));
  // Los pedibles tienen que ser EXACTAMENTE los campos del input_schema de la tool.
  for (const id of ['monto', 'motivo']) assert.ok(decl.includes(`'${id}'`), `${id} sí lo puede pedir MaKo`);
  for (const id of ['fechaJ1', 'asistenciaR1', 'fathomR1', 'fechaJ2', 'dealServicio']) {
    assert.ok(!decl.includes(`'${id}'`), `${id} no lo puede cargar ninguna tool del doer: exigirlo deja al dueño sin salida`);
  }
  const v = src.slice(src.indexOf('function veredictoRequisitos'));
  const fn = v.slice(0, v.indexOf('\n}\n') + 1);
  assert.ok(fn.includes('omitir'), 'lo que no se puede pedir tiene que moverse DICIÉNDOLO, no en silencio');
});

// La regla "validá; si falta algo no muevas pero escribí por qué" la necesitan
// DOS crons (el motor y el desenlace de nutrición). Vive en un solo lugar.
test('CABLEADO: moverLeadAuto es la fuente única del movimiento automático', () => {
  const src = leer('../lib/leads.ts');
  const h = src.slice(src.indexOf('export async function moverLeadAuto'));
  const fn = h.slice(0, h.indexOf('\n}\n') + 1);
  assert.notEqual(fn.length, 1, 'no encontré moverLeadAuto');
  assert.ok(fn.includes("requisitos: 'validar'"), 'moverLeadAuto dejó de validar');
  assert.ok(fn.includes('logLeadEvent('), 'un lead que un cron no pudo mover no puede quedar en silencio');
  assert.ok(fn.includes('esRequisitosFaltantes'), 'un error real no puede confundirse con "faltan datos"');
});

test('CABLEADO: el desenlace de nutrición no mueve por su cuenta', () => {
  const src = leer('../lib/nutricion-desenlace.ts');
  // `logradoEtapa`/`falloEtapa` las configura CADA workspace: un cliente que
  // apunte el logro a su etapa de cierre escribía la venta sin monto.
  assert.ok(!/[^a-zA-Z]setPipelineStage\(/.test(src), 'el desenlace volvió a mover sin validar');
  assert.equal((src.match(/await moverLeadAuto\(/g) ?? []).length, 2, 'los dos desenlaces (logrado y fallo) mueven por el helper');
  assert.ok(!/await moverLeadAuto\([^)]*\);\s*\n\s*res\.movidos/.test(src), 'no se puede contar como movido algo que el helper rechazó');
});

test('CABLEADO: la opción del modal de confirmaciones valida y siempre lleva motivo', () => {
  const src = leer('../lib/mako-confirmaciones.ts');
  // ⚠️ LA RAMA DE LA OPCIÓN, NO UNA VENTANA DE CARACTERES. Hasta el 13/10 esto leía 1.400
  // caracteres desde la primera `decision.startsWith('op:')`, que es la BÚSQUEDA de la opción:
  // el commit de MaKo Mobile (ef8626ce) metió en el medio el reclamo de la confirmación y la
  // llamada quedó afuera de la ventana. El test dio rojo con el código validando bien.
  // Probado rompiéndolo (13/10): sacar `requisitos: 'validar'` de la rama → 15 pases / 1 fallo.
  assert.notEqual(src.indexOf("decision.startsWith('op:')"), -1);
  const i = src.indexOf('} else if (op) {');
  assert.notEqual(i, -1, 'no encontré la rama de la opción elegida');
  const fin = src.indexOf('} else {', i);
  const rama = src.slice(i, fin > i ? fin : undefined);
  assert.ok(rama.includes("requisitos: 'validar'"), 'la opción volvió a mover sin validar');
  assert.ok(
    !/setPipelineStage\(c\.lead_id, op\.stage, \{ motivo: op\.motivo \?\? null \}\)/.test(src),
    'volvió el motivo en null: el lead terminaba en una salida con el motivo de una pérdida anterior',
  );
});

test('CABLEADO: el motor automático mueve SOLO por moverAuto', () => {
  const src = leer('../lib/crm-auto.ts');
  assert.ok(!/[^a-zA-Z]setPipelineStage\(/.test(src), 'todo movimiento del motor pasa por moverAuto, que delega en moverLeadAuto');
  const helper = src.slice(src.indexOf('async function moverAuto'));
  const fn = helper.slice(0, helper.indexOf('\n}\n') + 1);
  assert.ok(fn.includes('moverLeadAuto('), 'moverAuto dejó de usar la fuente única');
  assert.ok(fn.includes("canal: 'CRM automático'"), 'el historial tiene que decir QUIÉN no pudo mover el lead');
  // Y si no se movió, no se crea la confirmación que anunciaría un cambio inexistente.
  // (T3 también movía solo a «No responde» con mensajes del lead en Chatwoot; desde el
  // 09/10/2026 no mueve nada y pide decidir, así que su línea salió de acá.)
  assert.ok(/if \(!movido\) return 'skip';/.test(src));
});

test('CABLEADO: el doer ya no muestra las horas en la zona del dueño', () => {
  const src = leer('../lib/mako-doer-acciones.ts');
  assert.ok(!src.includes('America/Tijuana'), 'la zona fija es owner-only: va tzDeWorkspace(ws)');
  assert.ok(src.includes('tzDeWorkspace(ws)'), 'la hora que se le muestra a un cliente va en la zona de SU workspace');
  // Las tools de LECTURA son el otro medio doer, y la hora de la reunión que
  // devuelven es la que MaKo le repite al cliente por WhatsApp.
  const tools = leer('../lib/mako-tools.ts');
  assert.ok(!tools.includes('America/Tijuana'), 'la hora de la R1/R2 volvió a la zona del dueño');
  assert.ok(tools.includes('await tzActual()'), 'la zona sale del workspace, y se resuelve una vez por listado');
});
