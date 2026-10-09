// =============================================================================
// Corregir un campo no borra la venta — `updateLead` y el desenlace
// =============================================================================
// `updateLead` aplicaba, en CADA guardado y mandara el caller lo que mandara:
// «si cerro != true → monto_cierre_usd y fecha_cierre en null» (y el motivo de
// salida en null fuera de perdido/descalificado). Y hay leads con la venta cargada y
// `cerro` en null: lib/pagos.ts y el editor del deal escriben el monto DIRECTO, y un
// lead en «Facturando» tiene estado `abierto`. Corregirle «asistió a R1», la fecha de
// una reunión, o deshacer una línea del historial le vaciaba la venta — en el lead y
// en Revenue, sin error, sin toast y sin una línea en el historial.
//
// La cura (docs/hallazgos-crm.md, «`updateLead` LE BORRA EL MONTO DE CIERRE A TODO
// LEAD EN "FACTURANDO"»): cada coerción se aplica SÓLO si el caller tocó un campo que
// la decide. La decisión vive en lib/lead-desenlace.ts, pura, y acá se EJECUTA.
//
// Y lo que NO tiene que cambiar: un movimiento de etapa (`setPipelineStage`) manda
// siempre `estado_lead`, así que pasar un Ganado a una etapa abierta sigue limpiando
// la venta. Eso se prueba en las dos mitades: la función (caso del Ganado reabierto)
// y el cableado (que el movimiento siga mandando `estado_lead`).
//
// Probado rompiéndolo (06/10/2026), una rotura por vez y restaurando de memoria.
// Con el código como está: 11 pases, 0 fallos.
//   · `tocaLaVenta` devuelve true siempre (la coerción de antes)            → 8 / 3
//   · `tocaLaVenta` devuelve false siempre (nada limpia la venta)           → 5 / 6
//   · `DECIDEN_LA_VENTA` sin `monto_cierre_usd`                             → 9 / 2
//   · `tocaElMotivo` devuelve true siempre (el motivo de antes)             → 9 / 2
//   · `updateLead` vuelve a escribir su propio `if (merged.cerro !== true)` → 10 / 1
//   · `setPipelineStage` manda el sync sin `estado_lead`                    → 10 / 1
// Correr: npx tsx --test tests/updatelead-no-borra-venta.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  desenlaceAlGuardar, tocaElMotivo, tocaLaVenta, DECIDEN_LA_VENTA, type Desenlace,
} from '../lib/lead-desenlace';
// Sólo el tipo (se borra al compilar): prueba que lo que `updateLead` recibe entra
// tal cual en la función, sin un cast en el medio.
import type { LeadUpdateInput } from '../lib/leads';

const HOY = '2026-10-06';

/** Un lead en «Facturando»: abierto, `cerro` null, con la venta cargada por el deal. */
const FACTURANDO: Desenlace = {
  estado_lead: 'abierto', cerro: null, motivo_perdida: null,
  monto_cierre_usd: 4800, fecha_cierre: '2026-09-30',
};

const GANADO: Desenlace = {
  estado_lead: 'ganado', cerro: true, motivo_perdida: null,
  monto_cierre_usd: 5000, fecha_cierre: '2026-09-28',
};

const guardar = (actual: Desenlace, cambio: LeadUpdateInput) => desenlaceAlGuardar(actual, cambio, HOY);

// ── 1 · Corregir otro campo no toca la venta ─────────────────────────────────

test('a un lead en Facturando, corregirle una asistencia o una fecha de reunión NO le borra la venta', () => {
  // Los tres caminos que la borraban: la ficha (guardarCampoLeadAction), el
  // «Deshacer» del historial (revertAuditChangeAction) y Fathom/MaKo marcando asistencia.
  const cambios: LeadUpdateInput[] = [
    { asistio_j1: true },
    { asistio_j2: false },
    { calificado: true },
    { fecha_junta_1: '2026-09-01' },
    { fecha_agenda: null },
    { fecha_confirmacion: '2026-10-01' },
  ];
  for (const c of cambios) {
    assert.deepEqual(guardar(FACTURANDO, c), FACTURANDO, `con ${JSON.stringify(c)} la venta tiene que quedar igual`);
  }
});

test('a un Ganado, corregirle otro campo tampoco le inventa ni le exige nada', () => {
  // Sin fecha de cierre guardada: la de HOY sería la fecha de una venta que no fue hoy.
  const sinFecha: Desenlace = { ...GANADO, fecha_cierre: null };
  assert.equal(guardar(sinFecha, { asistio_j1: true }).fecha_cierre, null);
  // Con un monto ≤ 0 guardado por otro camino: antes CUALQUIER corrección tiraba
  // «monto_cierre_usd debe ser positivo», o sea que el lead quedaba sin poder editarse.
  const montoCero: Desenlace = { ...GANADO, monto_cierre_usd: 0 };
  assert.doesNotThrow(() => guardar(montoCero, { fecha_junta_2: '2026-09-20' }));
});

test('un motivo viejo no se borra por corregir otra cosa; mandar el motivo sí aplica la invariante', () => {
  const conMotivoViejo: Desenlace = { ...FACTURANDO, motivo_perdida: 'Se enfrió' };
  assert.equal(guardar(conMotivoViejo, { asistio_j1: true }).motivo_perdida, 'Se enfrió');
  // La ficha guarda el motivo POR updateLead justamente para esto: en un lead que no
  // salió del embudo, el motivo rebota.
  assert.equal(guardar(FACTURANDO, { motivo_perdida: 'No tenía presupuesto' }).motivo_perdida, null);
  const perdido: Desenlace = { ...FACTURANDO, estado_lead: 'perdido', cerro: false, monto_cierre_usd: null, fecha_cierre: null };
  assert.equal(guardar(perdido, { motivo_perdida: 'No tenía presupuesto' }).motivo_perdida, 'No tenía presupuesto');
});

// ── 2 · Tocar el desenlace sigue aplicando las invariantes ───────────────────

test('MOVIMIENTO: un Ganado que pasa a una etapa abierta pierde la venta (lo pedido)', () => {
  // Es lo que manda setPipelineStage al mover a una etapa no terminal.
  assert.deepEqual(guardar(GANADO, { estado_lead: 'abierto' }), {
    estado_lead: 'abierto', cerro: null, motivo_perdida: null, monto_cierre_usd: null, fecha_cierre: null,
  });
});

test('pasar a Ganado deriva cerro, conserva el monto y completa la fecha de cierre', () => {
  assert.deepEqual(guardar(FACTURANDO, { estado_lead: 'ganado' }), {
    estado_lead: 'ganado', cerro: true, motivo_perdida: null, monto_cierre_usd: 4800, fecha_cierre: '2026-09-30',
  });
  const sinVenta: Desenlace = { ...FACTURANDO, monto_cierre_usd: null, fecha_cierre: null };
  const r = guardar(sinVenta, { estado_lead: 'ganado', monto_cierre_usd: 3000 });
  assert.equal(r.monto_cierre_usd, 3000);
  assert.equal(r.fecha_cierre, HOY);
  assert.throws(() => guardar(sinVenta, { estado_lead: 'ganado', monto_cierre_usd: 0 }), /monto_cierre_usd debe ser positivo/);
});

test('perder, descalificar y el desbloqueo de WhatsApp limpian lo que corresponde', () => {
  const perdido = guardar(FACTURANDO, { estado_lead: 'perdido', motivo_perdida: 'Precio' });
  assert.deepEqual(perdido, { estado_lead: 'perdido', cerro: false, motivo_perdida: 'Precio', monto_cierre_usd: null, fecha_cierre: null });
  // El desbloqueo de WhatsApp reabre al bloqueado (lo hacía app/api/whatsapp/contacts/[id]/block,
  // que se fue con Chatwoot el 09/10/2026; el caso sigue valiendo para cualquier desbloqueo).
  const bloqueado: Desenlace = { estado_lead: 'descalificado', cerro: false, motivo_perdida: 'Bloqueado en WhatsApp', monto_cierre_usd: null, fecha_cierre: null };
  assert.deepEqual(guardar(bloqueado, { estado_lead: 'abierto', motivo_perdida: null }), {
    estado_lead: 'abierto', cerro: null, motivo_perdida: null, monto_cierre_usd: null, fecha_cierre: null,
  });
});

test('compat: sólo `cerro` deriva el estado (descalificado se conserva)', () => {
  const descal: Desenlace = { ...FACTURANDO, estado_lead: 'descalificado', cerro: false, motivo_perdida: 'No era fit', monto_cierre_usd: null, fecha_cierre: null };
  assert.equal(guardar(descal, { cerro: false }).estado_lead, 'descalificado');
  assert.equal(guardar(FACTURANDO, { cerro: false }).estado_lead, 'perdido');
  assert.equal(guardar(FACTURANDO, { cerro: false }).monto_cierre_usd, null);
  assert.equal(guardar(FACTURANDO, { cerro: true }).estado_lead, 'ganado');
});

test('mandar el monto sin cerrar la venta rebota, igual que antes (el monto decide la venta)', () => {
  // El «Deshacer» de «Monto de cierre» sobre un lead abierto: el monto es uno de los
  // campos que deciden la venta, así que la invariante se aplica.
  assert.equal(guardar(FACTURANDO, { monto_cierre_usd: 4800 }).monto_cierre_usd, null);
  assert.equal(guardar(GANADO, { monto_cierre_usd: 6000 }).monto_cierre_usd, 6000);
});

test('qué campos deciden la venta y el motivo', () => {
  assert.deepEqual([...DECIDEN_LA_VENTA].sort(), ['cerro', 'estado_lead', 'fecha_cierre', 'monto_cierre_usd']);
  assert.equal(tocaLaVenta({ asistio_j1: true } as LeadUpdateInput), false);
  assert.equal(tocaLaVenta({ monto_cierre_usd: null }), true, 'un null explícito ES tocarlo');
  assert.equal(tocaLaVenta({ estado_lead: undefined }), false, 'un undefined no escribe nada: no es tocarlo');
  assert.equal(tocaElMotivo({ motivo_perdida: null }), true);
  assert.equal(tocaElMotivo({ monto_cierre_usd: 10 }), false);
});

// ── 3 · El cableado ──────────────────────────────────────────────────────────

/** Normalizado a \n: lib/leads.ts es CRLF y los cortes buscan '\n'. */
const crudo = (p: string) => readFileSync(join(import.meta.dirname, p), 'utf8').replace(/\r\n/g, '\n');
// Sin comentarios —primero las líneas `//`, después los bloques—: la convención de la
// casa cita en prosa el código que se sacó, y un guard de AUSENCIA se acusaría solo.
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** El cuerpo de una función exportada, hasta el próximo `export` (su cierre real). */
const cuerpoDe = (src: string, firma: string) => {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const fin = src.indexOf('\nexport ', i + firma.length);
  return src.slice(i, fin === -1 ? undefined : fin);
};

test('CABLEADO: updateLead aplica el desenlace por la función pura, y no tiene una segunda copia', () => {
  const fn = cuerpoDe(sinComentarios(crudo('../lib/leads.ts')), 'export async function updateLead(');
  assert.ok(fn.length < 9000, `el recorte mide ${fn.length}: está mirando otra cosa`);
  assert.match(fn, /desenlaceAlGuardar\(actual, input, /, 'updateLead tiene que pasar por lib/lead-desenlace.ts');
  // La copia vieja, escrita a mano acá, es exactamente la que borraba ventas.
  assert.doesNotMatch(fn, /merged\.cerro !== true/, 'volvió la coerción sin mirar qué mandó el caller');
  assert.doesNotMatch(fn, /merged\.monto_cierre_usd = null/);
  assert.doesNotMatch(fn, /merged\.motivo_perdida = null/);
  // Y se aplica ANTES de guardar: después no protegería nada.
  assert.ok(fn.indexOf('desenlaceAlGuardar(') < fn.indexOf(".update(payload)"), 'el desenlace va antes del UPDATE');
});

test('CABLEADO: un movimiento de etapa sigue mandando estado_lead (así reabrir un Ganado limpia la venta)', () => {
  const fn = cuerpoDe(sinComentarios(crudo('../lib/leads.ts')), 'export async function setPipelineStage(');
  assert.match(fn, /const sync: LeadUpdateInput = \{ estado_lead: estado \};/,
    'sin estado_lead en el sync, mover un Ganado a una etapa abierta dejaría la venta puesta');
  assert.match(fn, /await updateLead\(id, sync\)/);
});
