// =============================================================================
// Deshacer un movimiento devuelve la venta TAL CUAL (17/10/2026, revisión adversarial)
// =============================================================================
// El defecto (docs/hallazgos-crm.md, «Deshacer un movimiento le borraba la venta…»):
//   · Un lead en «Facturando» (abierto, 3000 cargados por el plan de pagos) se arrastraba por error a
//     Ganado y se apretaba Deshacer. `undoStageMoveAction` volvía a MOVER (`setPipelineStage`): el
//     estado pasaba de ganado a abierto, `desenlaceAlGuardar` limpiaba monto y fecha de cierre, y el
//     `.delete().gte('created_at', ahora-90s)` se llevaba la línea «Monto de cierre 3000 → —». Los
//     3000 desaparecían sin rastro. El Deshacer del teléfono llamaba al mismo.
//   · Un Ganado del 15/09 movido a una abierta y deshecho volvía con la fecha de cierre de HOY, y
//     «Restaurar» (`revertMoveAction`) igual: `fecha_cierre` no estaba en el historial.
// La cura: el deshacer revierte el GRUPO del movimiento por el camino de «Restaurar», y el desenlace
// vuelve con `desenlaceAntesDelMovimiento` (lib/lead-desenlace.ts) por `updateLead(…, { desenlaceExacto })`.
//
// Verificado rompiéndolo (el archivo da 7 / 0):
//   · `desenlaceAntesDelMovimiento` sin la línea del monto (vuelve el de hoy)        → 5 / 2 (ida y vuelta, historial viejo)
//   · ídem sin la de la fecha de cierre                                              → 5 / 2 (ida y vuelta, historial viejo)
//   · sin el `hoy` del historial viejo                                               → 6 / 1 (historial viejo)
//   · sin derivar `cerro` del estado de antes                                        → 4 / 3 (Facturando, ida y vuelta, viejo)
//   · `movimientoADeshacer` sin filtrar por autor                                    → 6 / 1 (qué borra)
//   · revertMoveAction con `updateLead(leadId, upd)` sin `desenlaceExacto`           → 6 / 1 (CABLEADO restaurar)
//   · updateLead sin `opts?.desenlaceExacto ??`                                      → 6 / 1 (CABLEADO restaurar)
//   · undoStageMoveAction de vuelta con `setPipelineStage(id, from, …)` + `.gte(…)` → 6 / 1 (CABLEADO deshacer)
//   · AUDIT_FIELDS sin `fecha_cierre`                                               → 6 / 1 (CABLEADO historial)
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  desenlaceAlGuardar, desenlaceAntesDelMovimiento, estadoDelMovimiento, LINEA_DEL_DESENLACE,
  type Desenlace, type CambioDeDesenlace,
} from '../lib/lead-desenlace';
import { movimientoADeshacer } from '../lib/historial-pisado';
import type { EstadoLead } from '../lib/leads';

const HOY = '2026-10-17';

const leer = (p: string) => readFileSync(join(import.meta.dirname, '..', p), 'utf8').replace(/\r\n/g, '\n')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const cuerpo = (src: string, firma: string) => {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const fin = src.indexOf('\nexport ', i + firma.length);
  return src.slice(i, fin < 0 ? undefined : fin);
};

/** Lo que `auditVal` (lib/leads.ts) escribe en el historial. */
const auditVal = (v: unknown): string | null => (v == null || v === '' ? null : typeof v === 'boolean' ? (v ? 'Sí' : 'No') : String(v));

/** Las líneas que deja un movimiento: las de `logLeadChanges` para los campos del desenlace que cambiaron. */
const lineasDe = (antes: Desenlace, despues: Desenlace) =>
  (Object.entries(LINEA_DEL_DESENLACE) as Array<[keyof Desenlace, string]>).flatMap(([k, campo]) => {
    const a = auditVal(antes[k]);
    const b = auditVal(despues[k]);
    return a === b ? [] : [{ campo, valor_anterior: a, valor_nuevo: b }];
  });

/** Un movimiento de etapa tal como lo guarda `setPipelineStage`: el estado sólo si cambia, y el motivo si viene. */
const mover = (antes: Desenlace, destino: EstadoLead, motivo?: string): Desenlace => {
  const sync: CambioDeDesenlace = { ...estadoDelMovimiento(antes.estado_lead, destino) };
  if ((destino === 'perdido' || destino === 'descalificado') && motivo != null) sync.motivo_perdida = motivo;
  return desenlaceAlGuardar(antes, sync, HOY);
};

const FACTURANDO: Desenlace = { estado_lead: 'abierto', cerro: null, motivo_perdida: null, monto_cierre_usd: 3000, fecha_cierre: '2026-10-01' };
const GANADO_15_09: Desenlace = { estado_lead: 'ganado', cerro: true, motivo_perdida: null, monto_cierre_usd: 3000, fecha_cierre: '2026-09-15' };

test('Facturando con 3000 → Ganado por error → Deshacer: vuelve abierto CON los 3000 (el camino viejo los perdía)', () => {
  const despues = mover(FACTURANDO, 'ganado');
  assert.deepEqual(despues, { ...FACTURANDO, estado_lead: 'ganado', cerro: true }, 'ganar no toca monto ni fecha');
  const lineas = lineasDe(FACTURANDO, despues);
  assert.deepEqual(lineas.map((l) => l.campo), ['Estado'], 'el monto NO cambió: no tiene línea que lo devuelva');
  // Así se perdían: volver a mover a una abierta limpia la venta.
  assert.equal(mover(despues, 'abierto').monto_cierre_usd, null);
  assert.deepEqual(desenlaceAntesDelMovimiento(despues, lineas, HOY), FACTURANDO);
});

test('ida y vuelta: todo movimiento deshecho deja el desenlace EXACTAMENTE como estaba (estado, cerro, monto, fecha, motivo)', () => {
  const PERDIDO: Desenlace = { estado_lead: 'perdido', cerro: false, motivo_perdida: 'Caro', monto_cierre_usd: null, fecha_cierre: null };
  const casos: Array<[string, Desenlace, EstadoLead, string?]> = [
    ['Facturando → Ganado', FACTURANDO, 'ganado'],
    ['Facturando sin fecha → Ganado (ganar le pone HOY)', { ...FACTURANDO, fecha_cierre: null }, 'ganado'],
    ['Ganado del 15/09 → una abierta', GANADO_15_09, 'abierto'],
    ['Ganado → Perdido con motivo', GANADO_15_09, 'perdido', 'Se arrepintió'],
    ['Perdido → una abierta', PERDIDO, 'abierto'],
    ['Abierto vacío → Ganado', { ...FACTURANDO, monto_cierre_usd: null, fecha_cierre: null }, 'ganado'],
    ['Facturando → Falta pago (abierta → abierta)', FACTURANDO, 'abierto'],
  ];
  for (const [nombre, antes, destino, motivo] of casos) {
    const despues = mover(antes, destino, motivo);
    assert.deepEqual(desenlaceAntesDelMovimiento(despues, lineasDe(antes, despues), HOY), antes, nombre);
  }
  // El de la fecha, explícito: vuelve el 15/09, no hoy.
  const reabierto = mover(GANADO_15_09, 'abierto');
  assert.equal(desenlaceAntesDelMovimiento(reabierto, lineasDe(GANADO_15_09, reabierto), HOY).fecha_cierre, '2026-09-15');
});

test('historial viejo (sin línea «Fecha de cierre»): un Ganado que vuelve sin fecha recibe la de hoy, como siempre', () => {
  const reabierto: Desenlace = { estado_lead: 'abierto', cerro: null, motivo_perdida: null, monto_cierre_usd: null, fecha_cierre: null };
  const lineas = [
    { campo: 'Estado', valor_anterior: 'ganado' },
    { campo: 'Monto de cierre', valor_anterior: '3000' },
  ];
  assert.deepEqual(desenlaceAntesDelMovimiento(reabierto, lineas, HOY),
    { estado_lead: 'ganado', cerro: true, motivo_perdida: null, monto_cierre_usd: 3000, fecha_cierre: HOY });
  // Con la línea, manda la línea aunque diga vacío.
  assert.equal(desenlaceAntesDelMovimiento(reabierto, [...lineas, { campo: 'Fecha de cierre', valor_anterior: '2026-09-15' }], HOY).fecha_cierre, '2026-09-15');
});

test('qué deshace el toast y qué borra: el grupo del ÚLTIMO movimiento desde esa etapa, y sólo sus eventos', () => {
  const t = Date.parse('2026-10-17T15:00:00.000Z');
  const iso = (ms: number) => new Date(t + ms).toISOString();
  const filas = [
    { id: 15, campo: 'Datos pendientes', valor_anterior: null, autor: 'beto@x.com', created_at: iso(3000) },   // otra persona
    { id: 10, campo: 'Datos pendientes', valor_anterior: null, autor: 'ana@x.com', created_at: iso(2000) },    // del movimiento
    { id: 11, campo: 'Monto de cierre', valor_anterior: '3000', autor: 'beto@x.com', created_at: iso(1000) },  // otra persona
    { id: 12, campo: 'Etapa', valor_anterior: 'facturando', autor: 'ana@x.com', created_at: iso(0) },
    { id: 13, campo: 'Estado', valor_anterior: 'abierto', autor: 'ana@x.com', created_at: iso(0) },
    { id: 9, campo: 'Nota', valor_anterior: null, autor: 'ana@x.com', created_at: iso(-10_000) },             // de antes
    { id: 16, campo: 'Etapa', valor_anterior: 'agenda', autor: 'ana@x.com', created_at: iso(-30_000) },       // otro movimiento
    { id: 14, campo: 'Etapa', valor_anterior: 'facturando', autor: 'ana@x.com', created_at: iso(-200_000) },  // fuera de la ventana
  ];
  const ahora = t + 5000;
  assert.deepEqual(movimientoADeshacer(filas, 'facturando', ahora - 90_000), { createdAt: iso(0), eventos: [10] });
  assert.equal(movimientoADeshacer(filas, 'propuesta', ahora - 90_000), null, 'sin movimiento desde esa etapa no hay nada que deshacer');
  assert.equal(movimientoADeshacer(filas.filter((f) => f.id !== 12), 'facturando', ahora - 90_000), null, 'el de hace 200 s no es de este toast');
});

test('CABLEADO restaurar: revertMoveAction escribe el desenlace de antes TAL CUAL, en la misma escritura', () => {
  const acc = leer('app/crm/actions.ts');
  const grupo = cuerpo(acc, 'export async function revertMoveAction(');
  assert.match(grupo, /desenlaceAntesDelMovimiento\(desenlaceDe\(actual\), grupo, /);
  assert.match(grupo, /await updateLead\(leadId, upd, \{ desenlaceExacto \}\)/, 'el desenlace volvió a pasar por desenlaceAlGuardar');
  assert.doesNotMatch(grupo, /upd\.(estado_lead|monto_cierre_usd|motivo_perdida|fecha_cierre) =/, 'una mitad del desenlace por la regla');
  const uno = cuerpo(acc, 'export async function revertAuditChangeAction(');
  assert.match(uno, /case LINEA_DEL_DESENLACE\.fecha_cierre:\s*await updateLead\(leadId, \{\}, \{ desenlaceExacto: desenlaceAntesDelMovimiento\(desenlaceDe\(before\), \[row\], /);
  const ul = cuerpo(leer('lib/leads.ts'), 'export async function updateLead(');
  assert.match(ul, /Object\.assign\(merged, opts\?\.desenlaceExacto \?\? desenlaceAlGuardar\(actual, input, /);
});

test('CABLEADO deshacer: no vuelve a mover, revierte el grupo con sesión y borra sólo lo suyo (escritorio y teléfono)', () => {
  const acc = leer('app/crm/actions.ts');
  const undo = cuerpo(acc, 'export async function undoStageMoveAction(');
  assert.ok(undo.indexOf('await exigirSesion();') > 0 && undo.indexOf('await exigirSesion();') < undo.indexOf('movimientoADeshacer('));
  assert.doesNotMatch(undo, /setPipelineStage\(/, 'volver a mover pasa el estado por la regla y borra la venta');
  assert.doesNotMatch(undo, /\.gte\('created_at'/, 'borrar por ventana se lleva lo que escribió otra persona');
  assert.match(undo, /const r = await revertMoveAction\(id, mov\.createdAt\);\s*if \(r && 'error' in r\) return r;/);
  assert.match(undo, /\.delete\(\)\.eq\('lead_id', id\)\.in\('id', mov\.eventos\)/);
  assert.match(leer('app/crm/CrmBoard.tsx'), /const r = await undoStageMoveAction\(id, from\);\s*if \(r && 'error' in r\) throw/);
  assert.match(leer('app/m/crm/acciones.ts'), /const r = await undoStageMoveAction\(leadId, antes\);\s*if \(r && 'error' in r\) return \{ ok: false/);
});

test('CABLEADO historial: la fecha de cierre tiene línea, y cada línea del desenlace es la columna que dice', () => {
  const audit = leer('lib/leads.ts');
  const campos = audit.slice(audit.indexOf('const AUDIT_FIELDS'), audit.indexOf('];', audit.indexOf('const AUDIT_FIELDS')));
  for (const [k, label] of Object.entries(LINEA_DEL_DESENLACE)) {
    assert.ok(campos.includes(`{ k: '${k}', label: '${label}' }`), `AUDIT_FIELDS no registra ${k} como «${label}»`);
  }
  const acc = leer('app/crm/actions.ts');
  const rev = acc.slice(acc.indexOf('const REVERTIBLES = new Set(['), acc.indexOf(']);', acc.indexOf('const REVERTIBLES = new Set([')));
  assert.match(rev, /LINEA_DEL_DESENLACE\.fecha_cierre/, '«Restaurar» no devuelve la fecha de la venta');
});
