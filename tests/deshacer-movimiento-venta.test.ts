// =============================================================================
// Deshacer un movimiento devuelve el lead TAL CUAL; Restaurar devuelve la venta (17/10/2026)
// =============================================================================
// El defecto (docs/hallazgos-crm.md, «Deshacer un movimiento le borraba la venta…»): el Deshacer del toast volvía a
// MOVER el lead y la regla del desenlace le borraba los 3000 a uno de «Facturando» arrastrado a Ganado por error, y le
// ponía la fecha de cierre de hoy a un Ganado del 15/09; el borrado de «los últimos 90 s» se llevaba la línea que lo
// decía. El primer arreglo reconstruía «cómo estaba» desde el historial y la revisión adversarial le encontró cinco
// agujeros (los cinco escenarios de abajo). La cura: el movimiento saca la FOTO de antes y la de después, firmada
// (lib/deshacer-movimiento.ts), y el Deshacer la repone si lo que el movimiento cambió sigue como lo dejó.
//
// Verificado rompiéndolo (el archivo da 16 / 0; las doce primeras se midieron cuando tenía 13 tests):
//   · planDeshacer sin comparar con HOY (`campos` siempre vacío)                     → 12 / 1 (otra persona)
//   · planDeshacer sin las cuotas creadas en `borrar`                                → 11 / 2 (wizard con cuotas, la foto)
//   · planDeshacer escribiendo TODA la foto de antes (no sólo lo que cambió)         →  9 / 4 (wizard, minuto, otra, etapa)
//   · leerDeshacer sin comprobar la firma                                            → 12 / 1 (firma)
//   · leerDeshacer sin la vida del token                                             → 12 / 1 (firma)
//   · `pipeline_stage` fuera de COLUMNAS_DEL_DESHACER                               →  9 / 4 (wizard, minuto, etapa, foto)
//   · desenlaceAntesDelMovimiento sin el caso de la fecha del mismo día              → 12 / 1 (Restaurar sin línea)
//   · ídem sin la línea del monto                                                    → 10 / 3 (los tres de Restaurar)
//   · completeStageMoveAction con la foto DESPUÉS del plan de pagos                  → 12 / 1 (CABLEADO mover)
//   · undoStageMoveAction de vuelta por el historial (`revertMoveAction(`)           → 12 / 1 (CABLEADO deshacer)
//   · el botón del tablero sin `disabled={!undoInfo.deshacer}`                       → 12 / 1 (CABLEADO pantallas)
//   · AUDIT_FIELDS sin `fecha_cierre`                                               → 12 / 1 (CABLEADO historial)
//   Segunda revisión (16 tests):
//   · `marcaAlDeshacer` devolviendo siempre null                                     → 15 / 1 (dedup de cobranza)
//   · undoStageMoveAction sin `reponerMarcasDeCobranza` después del `volver`         → 15 / 1 (CABLEADO cobranza)
//   · reponerMarcasDeCobranza con la clave armada a mano                             → 15 / 1 (CABLEADO cobranza)
//   · cerrarDeshacer firmando sin las marcas                                         → 15 / 1 (CABLEADO cobranza)
//   · la frase de «¿Qué hacer ahora?» escrita DESPUÉS de firmar, como antes          → 15 / 1 (CABLEADO frase)
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  desenlaceAlGuardar, desenlaceAntesDelMovimiento, estadoDelMovimiento, LINEA_DEL_DESENLACE,
  type Desenlace, type CambioDeDesenlace,
} from '../lib/lead-desenlace';
import {
  fotoDe, firmarDeshacer, leerDeshacer, planDeshacer, VIDA_DESHACER_MS,
  type DatosDeshacer, type FotoCuota, type FotoLead,
} from '../lib/deshacer-movimiento';
import { DEDUP_OLVIDADO, marcaAlDeshacer } from '../lib/cobranza';
import type { EstadoLead } from '../lib/leads';

const HOY = '2026-10-17';
const T = Date.parse('2026-10-17T15:00:00.000Z');

const leer = (p: string) => readFileSync(join(import.meta.dirname, '..', p), 'utf8').replace(/\r\n/g, '\n')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const cuerpo = (src: string, firma: string) => {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const fin = src.indexOf('\nexport ', i + firma.length);
  return src.slice(i, fin < 0 ? undefined : fin);
};

/** Un lead como lo devuelve `getLead`: las columnas del deshacer y otras que no son de él. */
const lead = (p: Record<string, unknown>): Record<string, unknown> => ({
  id: 7, nombre: 'Ana', updated_at: '2026-10-17T15:00:00Z', etapa_vista: 'propuesta',
  pipeline_stage: 'propuesta', nutricion_manual_deadline: null, estado_lead: 'abierto', cerro: null,
  monto_cierre_usd: null, fecha_cierre: null, motivo_perdida: null, asistio_j1: true, calificado: true, ...p,
});
const datos = (antes: FotoLead, despues: FotoLead, extra: Partial<DatosDeshacer> = {}): DatosDeshacer =>
  ({ leadId: 7, ws: 1, t: T, antes, despues, audit: [101, 102], ...extra });
const cuota = (id: number, numero: number, monto: number, fecha: string, pagado = false): FotoCuota =>
  ({ id, numero, monto_usd: monto, fecha_esperada: fecha, pagado });

// ── Los cinco escenarios de la revisión del 17/10 ────────────────────────────

test('wizard a Ganado CON cuotas → Deshacer: vuelve abierto, sin venta, y las cuotas que creó se van', () => {
  // `saveLeadPlanManual` escribe estado, cerro y monto ANTES de `setPipelineStage` y sin auditar: por eso la foto
  // se saca antes de la primera escritura del wizard (CABLEADO mover, abajo).
  const antes = fotoDe(lead({}));
  const despues = fotoDe(lead({ pipeline_stage: 'ganado', estado_lead: 'ganado', cerro: true, monto_cierre_usd: 3000, fecha_cierre: HOY }));
  const cuotas = { antes: [] as FotoCuota[], despues: [cuota(51, 1, 1000, '2026-11-01'), cuota(52, 2, 1000, '2026-12-01'), cuota(53, 3, 1000, '2027-01-01')] };
  const plan = planDeshacer(datos(antes, despues, { cuotas }), despues, cuotas.despues);
  assert.ok(!('error' in plan));
  assert.deepEqual(plan.lead, { pipeline_stage: 'propuesta', estado_lead: 'abierto', cerro: null, monto_cierre_usd: null, fecha_cierre: null });
  assert.deepEqual(plan.cuotas, { borrar: [51, 52, 53], reponer: [], volver: [] });
});

test('el anti-duplicado del historial no importa: A→Ganado→A→Ganado en un minuto se deshace igual (y al revés)', () => {
  // La foto no sale de `lead_audit`: lo que `sinRepetidas` le saca al grupo no cambia nada.
  const enA = fotoDe(lead({ pipeline_stage: 'a' }));
  const ganado = fotoDe(lead({ pipeline_stage: 'ganado', estado_lead: 'ganado', cerro: true, monto_cierre_usd: 3000, fecha_cierre: HOY }));
  const ida = planDeshacer(datos(enA, ganado), ganado, null);
  assert.ok(!('error' in ida));
  assert.deepEqual(ida.lead, { pipeline_stage: 'a', estado_lead: 'abierto', cerro: null, monto_cierre_usd: null, fecha_cierre: null });
  const vuelta = planDeshacer(datos(ganado, enA), enA, null);
  assert.ok(!('error' in vuelta));
  assert.deepEqual(vuelta.lead, { pipeline_stage: 'ganado', estado_lead: 'ganado', cerro: true, monto_cierre_usd: 3000, fecha_cierre: HOY });
});

test('Restaurar sin línea «Fecha de cierre» (historial viejo, o el grupo del wizard): el ganar del MISMO día se lleva su fecha', () => {
  const ganado: Desenlace = { estado_lead: 'ganado', cerro: true, motivo_perdida: null, monto_cierre_usd: 3000, fecha_cierre: '2026-10-10' };
  const lineas = [{ campo: 'Estado', valor_anterior: 'abierto' }, { campo: 'Monto de cierre', valor_anterior: null }];
  assert.deepEqual(desenlaceAntesDelMovimiento(ganado, lineas, '2026-10-20', '2026-10-10T15:00:00.123+00:00'),
    { estado_lead: 'abierto', cerro: null, motivo_perdida: null, monto_cierre_usd: null, fecha_cierre: null });
  // «Facturando» con la fecha del plan de pagos de OTRO día: es de antes, queda (con su monto).
  const facturando: Desenlace = { ...ganado, fecha_cierre: '2026-10-01' };
  assert.deepEqual(desenlaceAntesDelMovimiento(facturando, [{ campo: 'Estado', valor_anterior: 'abierto' }], '2026-10-20', '2026-10-10T15:00:00+00:00'),
    { estado_lead: 'abierto', cerro: null, motivo_perdida: null, monto_cierre_usd: 3000, fecha_cierre: '2026-10-01' });
});

test('el Deshacer de una persona no toca el movimiento de OTRA, y no pisa lo que cambió otro después', () => {
  // Y ya lo pasó a Ganado; X, con el tablero viejo, lo «mueve» a Ganado: su foto de antes ya es Ganado.
  const ganadoPorY = fotoDe(lead({ pipeline_stage: 'ganado', estado_lead: 'ganado', cerro: true, monto_cierre_usd: 3000, fecha_cierre: HOY }));
  const deX = planDeshacer(datos(ganadoPorY, ganadoPorY), ganadoPorY, null);
  assert.ok(!('error' in deX));
  assert.deepEqual(deX.lead, {}, 'el Deshacer de X no tiene nada suyo que devolver');
  // Otra persona corrigió el monto después del movimiento: no se escribe NADA.
  const antes = fotoDe(lead({}));
  const despues = ganadoPorY;
  const hoy = { ...despues, monto_cierre_usd: 3500 };
  assert.deepEqual(planDeshacer(datos(antes, despues), hoy, null), { error: 'pisado', campos: ['monto_cierre_usd'] });
  // Un cambio en algo que el movimiento NO tocó no frena el Deshacer, y no se pisa.
  const otro = planDeshacer(datos(antes, despues), { ...despues, asistio_j1: false }, null);
  assert.ok(!('error' in otro) && !('asistio_j1' in otro.lead));
  // Una cuota que se cobró después: no.
  const cuotas = { antes: [] as FotoCuota[], despues: [cuota(51, 1, 3000, '2026-11-01')] };
  assert.deepEqual(planDeshacer(datos(antes, despues, { cuotas }), despues, [cuota(51, 1, 3000, '2026-11-01', true)]), { error: 'pisado', campos: ['cuotas'] });
});

test('la etapa vuelve como ESTABA guardada (derivada u override huérfano), no como la dibujaba el tablero', () => {
  for (const etapa of [null, 'x_que_el_funnel_ya_no_tiene']) {
    const antes = fotoDe(lead({ pipeline_stage: etapa }));
    const despues = fotoDe(lead({ pipeline_stage: 'facturando' }));
    const plan = planDeshacer(datos(antes, despues), despues, null);
    assert.ok(!('error' in plan));
    assert.deepEqual(plan.lead, { pipeline_stage: etapa });
  }
});

// ── Las piezas ───────────────────────────────────────────────────────────────

test('la foto: sólo las columnas del deshacer que el lead tiene; las cuotas que cambió vuelven', () => {
  const f = fotoDe(lead({}));
  assert.ok(!('nombre' in f) && !('etapa_vista' in f) && !('updated_at' in f));
  assert.equal(f.pipeline_stage, 'propuesta');
  assert.ok(!('sin_r1' in f), 'una columna que la base no trajo no entra');
  const cuotas = { antes: [cuota(1, 1, 500, '2026-11-01'), cuota(2, 2, 500, '2026-12-01')], despues: [cuota(1, 1, 700, '2026-11-15'), cuota(3, 2, 300, '2026-12-01')] };
  const f2 = fotoDe(lead({}));
  const plan = planDeshacer(datos(f2, f2, { cuotas }), f2, cuotas.despues);
  assert.ok(!('error' in plan));
  assert.deepEqual(plan.cuotas, { borrar: [3], reponer: [cuota(2, 2, 500, '2026-12-01')], volver: [cuota(1, 1, 500, '2026-11-01')] });
});

test('la firma: sólo vuelve lo que firmó el server, entero y a tiempo', () => {
  const d = datos(fotoDe(lead({})), fotoDe(lead({ estado_lead: 'ganado' })));
  const tk = firmarDeshacer(d, 'secreto');
  assert.deepEqual(leerDeshacer(tk, 'secreto', T + 5000), d);
  assert.equal(leerDeshacer({ ...tk, cuerpo: tk.cuerpo.replace('"abierto"', '"ganado"') }, 'secreto', T + 5000), null, 'cuerpo tocado');
  assert.equal(leerDeshacer(tk, 'otro', T + 5000), null, 'otro secreto');
  assert.equal(leerDeshacer(tk, 'secreto', T + VIDA_DESHACER_MS + 1), null, 'vencido');
  assert.equal(leerDeshacer(null, 'secreto', T), null);
  assert.equal(leerDeshacer({ cuerpo: 1, firma: 2 }, 'secreto', T), null);
});

// ── Restaurar (revertMoveAction) sigue reponiendo el desenlace de las líneas ──

/** Lo que `auditVal` (lib/leads.ts) escribe en el historial. */
const auditVal = (v: unknown): string | null => (v == null || v === '' ? null : typeof v === 'boolean' ? (v ? 'Sí' : 'No') : String(v));
const lineasDe = (antes: Desenlace, despues: Desenlace) =>
  (Object.entries(LINEA_DEL_DESENLACE) as Array<[keyof Desenlace, string]>).flatMap(([k, campo]) => {
    const a = auditVal(antes[k]);
    const b = auditVal(despues[k]);
    return a === b ? [] : [{ campo, valor_anterior: a, valor_nuevo: b }];
  });
const mover = (antes: Desenlace, destino: EstadoLead, motivo?: string): Desenlace => {
  const sync: CambioDeDesenlace = { ...estadoDelMovimiento(antes.estado_lead, destino) };
  if ((destino === 'perdido' || destino === 'descalificado') && motivo != null) sync.motivo_perdida = motivo;
  return desenlaceAlGuardar(antes, sync, HOY);
};
const FACTURANDO: Desenlace = { estado_lead: 'abierto', cerro: null, motivo_perdida: null, monto_cierre_usd: 3000, fecha_cierre: '2026-10-01' };
const GANADO_15_09: Desenlace = { estado_lead: 'ganado', cerro: true, motivo_perdida: null, monto_cierre_usd: 3000, fecha_cierre: '2026-09-15' };

test('Restaurar, ida y vuelta: el desenlace vuelve EXACTO (Facturando conserva sus 3000; el Ganado del 15/09, su fecha)', () => {
  const PERDIDO: Desenlace = { estado_lead: 'perdido', cerro: false, motivo_perdida: 'Caro', monto_cierre_usd: null, fecha_cierre: null };
  const casos: Array<[string, Desenlace, EstadoLead, string?]> = [
    ['Facturando → Ganado', FACTURANDO, 'ganado'],
    ['Facturando sin fecha → Ganado (ganar le pone HOY)', { ...FACTURANDO, fecha_cierre: null }, 'ganado'],
    ['Ganado del 15/09 → una abierta', GANADO_15_09, 'abierto'],
    ['Ganado → Perdido con motivo', GANADO_15_09, 'perdido', 'Se arrepintió'],
    ['Perdido → una abierta', PERDIDO, 'abierto'],
    ['Facturando → Falta pago (abierta → abierta)', FACTURANDO, 'abierto'],
  ];
  for (const [nombre, antes, destino, motivo] of casos) {
    const despues = mover(antes, destino, motivo);
    assert.deepEqual(desenlaceAntesDelMovimiento(despues, lineasDe(antes, despues), HOY, `${HOY}T15:00:00+00:00`), antes, nombre);
  }
});

test('Restaurar con historial viejo: un Ganado que vuelve sin fecha recibe la de hoy, como siempre', () => {
  const reabierto: Desenlace = { estado_lead: 'abierto', cerro: null, motivo_perdida: null, monto_cierre_usd: null, fecha_cierre: null };
  const lineas = [{ campo: 'Estado', valor_anterior: 'ganado' }, { campo: 'Monto de cierre', valor_anterior: '3000' }];
  assert.deepEqual(desenlaceAntesDelMovimiento(reabierto, lineas, HOY),
    { estado_lead: 'ganado', cerro: true, motivo_perdida: null, monto_cierre_usd: 3000, fecha_cierre: HOY });
});

// ── El cableado ──────────────────────────────────────────────────────────────

test('CABLEADO mover: la foto se saca ANTES de la primera escritura y vuelve firmada (tablero, wizard, reunión manual, teléfono)', () => {
  const acc = leer('app/crm/actions.ts');
  const wiz = cuerpo(acc, 'export async function completeStageMoveAction(');
  const iFoto = wiz.indexOf('const foto = await empezarDeshacer(id, before, true);');
  assert.ok(iFoto > 0 && iFoto < wiz.indexOf('saveLeadPlanManual(') && iFoto < wiz.indexOf('saveLeadMeta('), 'la foto del wizard va antes del plan de pagos');
  assert.match(wiz, /\.\.\.\(deshacer \? \{ deshacer \} : \{\}\)/);
  const tab = cuerpo(acc, 'export async function setLeadStageAction(');
  assert.ok(tab.indexOf('empezarDeshacer(id, before, false)') < tab.indexOf('await setPipelineStage('));
  // 23/10/2026: más el informe de las automatizaciones de la etapa (tests/no-volvio-a-entrar.test.ts).
  assert.match(tab, /return \{ ok: true, pendientes, \.\.\.\(deshacer \? \{ deshacer \} : \{\}\), \.\.\.conInforme\(automatizaciones\) \};/);
  const reu = cuerpo(acc, 'export async function markMeetingManualAction(');
  assert.ok(reu.indexOf('empezarDeshacer(id, before, false)') < reu.indexOf('await setMeetingManual('));
  assert.match(leer('app/m/crm/acciones.ts'), /cambio: true, \.\.\.\(r\.deshacer \? \{ deshacer: r\.deshacer \} : \{\}\)/);
});

test('CABLEADO deshacer: firma, mismo lead y negocio, nada si lo pisaron, la foto TAL CUAL, y sólo sus líneas', () => {
  const undo = cuerpo(leer('app/crm/actions.ts'), 'export async function undoStageMoveAction(');
  assert.ok(undo.indexOf('await exigirSesion();') > 0 && undo.indexOf('await exigirSesion();') < undo.indexOf('leerDeshacer('));
  assert.match(undo, /if \(!d \|\| d\.leadId !== id \|\| d\.ws !== \(\(await getWorkspaceActual\(\)\) \?\? null\)\) return/);
  assert.ok(undo.indexOf("if ('error' in plan) return { error: YA_LO_CAMBIARON };") < undo.indexOf('.update('), 'decide antes de escribir');
  assert.match(undo, /\.from\('leads'\)\.update\(plan\.lead\)\.eq\('id', id\)/);
  assert.match(undo, /\.from\('pagos'\)\.delete\(\)\.eq\('lead_id', id\)\.eq\('pagado', false\)\.in\('id', borrar\)/);
  assert.match(undo, /const ids = \[\.\.\.d\.audit, /);
  assert.match(undo, /\.from\('lead_audit'\)\.delete\(\)\.eq\('lead_id', id\)\.in\('id', ids\)/);
  for (const prohibido of ['setPipelineStage(', 'updateLead(', 'revertMoveAction(', 'getLeadAudit(', ".gte('created_at'"]) {
    assert.ok(!undo.includes(prohibido), `el Deshacer volvió a usar ${prohibido}`);
  }
});

test('CABLEADO pantallas: el escritorio manda la foto, apaga el botón sin ella y DICE cuando no pudo; el teléfono igual', () => {
  const tab = leer('app/crm/CrmBoard.tsx');
  assert.match(tab, /const r = await undoStageMoveAction\(id, deshacer\);\s*if \(r && 'error' in r\) throw/);
  assert.match(tab, /disabled=\{!undoInfo\.deshacer\}/);
  assert.match(tab, /setAvisoDeshacer\(/);
  assert.match(leer('app/crm/StageMoveDialog.tsx'), /onDone\(r\);/);
  const movil = leer('app/m/crm/acciones.ts');
  assert.match(movil, /const r = await undoStageMoveAction\(leadId, deshacer\);\s*if \(r && 'error' in r\) return \{ ok: false, error: r\.error \};/);
  assert.match(leer('app/m/crm/TableroCrm.tsx'), /deshacerMoverAction\(leadId, datos\.funnelId, r\.antes, r\.esCasa, r\.deshacer\)/);
  assert.match(leer('app/m/crm/[id]/FichaLead.tsx'), /deshacerMoverAction\(p\.id, funnelId, antes, esCasa, deshacer\)/);
});

test('CABLEADO historial: la fecha de cierre tiene línea y Restaurar la devuelve sin pasar por la regla', () => {
  const audit = leer('lib/leads.ts');
  const campos = audit.slice(audit.indexOf('const AUDIT_FIELDS'), audit.indexOf('];', audit.indexOf('const AUDIT_FIELDS')));
  for (const [k, label] of Object.entries(LINEA_DEL_DESENLACE)) {
    assert.ok(campos.includes(`{ k: '${k}', label: '${label}' }`), `AUDIT_FIELDS no registra ${k} como «${label}»`);
  }
  const acc = leer('app/crm/actions.ts');
  const rev = acc.slice(acc.indexOf('const REVERTIBLES = new Set(['), acc.indexOf(']);', acc.indexOf('const REVERTIBLES = new Set([')));
  assert.match(rev, /LINEA_DEL_DESENLACE\.fecha_cierre/);
  const grupo = cuerpo(acc, 'export async function revertMoveAction(');
  assert.match(grupo, /desenlaceAntesDelMovimiento\(desenlaceDe\(actual\), grupo, new Date\(\)\.toISOString\(\)\.slice\(0, 10\), createdAt\)/);
  assert.match(grupo, /await updateLead\(leadId, upd, \{ desenlaceExacto, etapaAparte: etapa\.set \}\)/);
  assert.match(cuerpo(audit, 'export async function updateLead('), /Object\.assign\(merged, opts\?\.desenlaceExacto \?\? desenlaceAlGuardar\(actual, input, /);
});

// ── La segunda revisión (17/10): el dedup de cobranza y la frase de «¿Qué hacer ahora?» ──

test('deshacer una reprogramación devuelve el dedup de cobranza EXACTO (sin él, el cron duplicaba «cuota vencida»)', () => {
  const salio = '2026-10-10T12:00:00.000Z';
  assert.deepEqual(marcaAlDeshacer(salio, DEDUP_OLVIDADO), { poner: salio }, 'la marca que el movimiento olvidó vuelve');
  assert.deepEqual(marcaAlDeshacer(null, DEDUP_OLVIDADO), { quitar: true }, 'sin marca antes, no queda la de epoch');
  assert.equal(marcaAlDeshacer(salio, '2026-10-17T16:00:00.000Z'), null, 'un aviso que salió DESPUÉS no se toca');
  assert.equal(marcaAlDeshacer(salio, salio), null, 'una cuota que no se reprogramó no se toca');
  assert.equal(marcaAlDeshacer(DEDUP_OLVIDADO, DEDUP_OLVIDADO), null, 'ya estaba olvidada: queda olvidada');
  assert.equal(marcaAlDeshacer(null, null), null);
});

test('CABLEADO cobranza: la foto guarda las marcas, sin ellas no hay Deshacer, y el `volver` las repone con los helpers', () => {
  const acc = leer('app/crm/actions.ts');
  assert.match(acc, /const marcas = cuotas \? await leerMarcasDeCobranza\(cuotas\.filter\(\(c\) => !c\.pagado\)\.map\(\(c\) => c\.id\)\) : null;/);
  assert.match(acc, /if \(!c\.cuotas \|\| !despues \|\| !c\.marcas\) return undefined;/);
  const undo = cuerpo(acc, 'export async function undoStageMoveAction(');
  const iVolver = undo.indexOf('for (const c of volver)');
  const iMarcas = undo.indexOf('await reponerMarcasDeCobranza(d.cuotas?.marcas ?? {}, volver.map((c) => c.id));');
  assert.ok(iVolver > 0 && iMarcas > iVolver, 'el Deshacer repone la fecha y no el dedup');
  const pagos = leer('lib/pagos.ts');
  const reponer = cuerpo(pagos, 'export async function reponerMarcasDeCobranza(');
  assert.match(reponer, /for \(const aviso of AVISOS_DE_CUOTA\)/);
  assert.match(reponer, /const key = keyEspaciado\(aviso, claveDedupCuota\(id\)\);/, 'la clave, con los helpers de la cobranza');
  assert.match(reponer, /marcaAlDeshacer\(foto\[aviso\] \?\? null, await getSettingEstricto\(key\)\)/);
  assert.match(reponer, /cambiarSettingSi\(key, DEDUP_OLVIDADO, accion\.poner\)/, 'contra la del olvido: un aviso que salió gana');
  assert.match(reponer, /borrarSettingSi\(key, DEDUP_OLVIDADO\)/);
  assert.match(cuerpo(pagos, 'export async function leerMarcasDeCobranza('), /getSettingEstricto\(keyEspaciado\(aviso, claveDedupCuota\(id\)\)\)/);
});

test('CABLEADO frase: «Datos sin marcar» se escribe ANTES de firmar el Deshacer, así el Deshacer la borra', () => {
  const acc = leer('app/crm/actions.ts');
  const wiz = cuerpo(acc, 'export async function completeStageMoveAction(');
  const iFrase = wiz.indexOf("await logLeadEvent(id, 'Datos sin marcar', frase.trim(), autor)");
  assert.ok(iFrase > 0 && iFrase < wiz.indexOf('await cerrarDeshacer('), 'la frase quedó fuera de las líneas del token');
  const qh = cuerpo(acc, 'export async function resolverQueHacerAction(');
  assert.match(qh, /return completeStageMoveAction\(leadId, to, datos, frase\);/);
  assert.ok(!qh.includes('logLeadEvent('), 'la frase volvió a escribirse después de firmar');
});
