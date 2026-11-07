// =============================================================================
// Los CRON de una automatización del dueño, copiados a OTRO workspace (lib/clonar-disparadores.ts)
// =============================================================================
// Pendiente id=524 (6/11/2026). El clon no copiaba `disparadores` (mig 0241): una automatización con
// varios CRON llegaba con UNO —el de las columnas— y un primer CRON de Instagram, sin su evento.
//
// ⚠️ Y SUMAR LA COLUMNA A `cols` Y NADA MÁS ERA UN BUG NUEVO, del mismo tipo que el que
// `traducirEtiquetasEnSecuencia` vino a arreglar: cada `Disparador` lleva ids del workspace del DUEÑO
// (la etiqueta del CRON, las de «Ignorar», el embudo, el producto) y la próxima ocurrencia de SU
// grilla. Eso es lo que fija este archivo, y sobre todo las dos trampas:
//   · nulear el ámbito y dejar la etapa habría sido PEOR que copiar el id: `producto_id` NULL es «la
//     entrega de CUALQUIER producto» en `leadsDeCohorte`, o sea MÁS gente que la del dueño;
//   · la verdad del PRIMER CRON son las COLUMNAS, así que la lista copiada sin la columna `cron`
//     dejaba un «todos los lunes a las 9» disparando CADA HORA (`decidirAgenda` sin cron: `toca: true`).
//
// PROBADO ROMPIÉNDOLO: ver `ROTURAS` al pie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { columnasParaElDestino, disparadoresParaElDestino } from '../lib/clonar-disparadores';
import { etapasDe } from '../lib/nutricion-etapa';
import { decidirAgenda } from '../lib/nutricion-agenda';
import type { CronAviso } from '../lib/cron-aviso';

/** El mapa por nombre del clon: la 7 del dueño es la 70 acá; la 9 no existe en este cliente. */
const MAPA = (id: number): number | null => (id === 7 ? 70 : id === 8 ? 80 : null);
const LUNES_9: CronAviso = { unidad: 'semana', cada: 1, hora: 9, minuto: 0, diaSemana: 1 };

test('los CRON extra viajan, con su evento: una automatización con dos llega con los dos', () => {
  const r = disparadoresParaElDestino({
    trigger_tipo: 'etapa_actual', etapa: 'nuevo', cron: null,
    disparadores: [
      { id: 'd1', trigger_tipo: 'etapa_actual', etapa: 'nuevo', subtipo: null },
      { id: 'd2', trigger_tipo: 'instagram', subtipo: 'dm' },
      { id: 'd3', trigger_tipo: 'manual', cron: LUNES_9, grupo: true },
    ],
  }, MAPA);
  assert.equal(r.disparadores.length, 3, 'los CRON extra de la lista no viajaron');
  assert.equal(r.disparadores[1].subtipo, 'dm', 'el evento de Instagram vive sólo en la lista: sin él el CRON no arranca nunca');
  assert.equal(r.disparadores[2].grupo, true, '«El grupo de MaKo» es el del NEGOCIO (lo resuelve el workspace del contexto): viaja');
  assert.deepEqual(r.disparadores[2].cron, LUNES_9, 'el horario no lleva ningún id del dueño: viaja');
});

test('la etiqueta del CRON se traduce con el mapa por nombre; la que no está queda sin elegir', () => {
  const r = disparadoresParaElDestino({
    trigger_tipo: 'etiqueta_puesta', etapa: 'nutri', etiqueta_id: 7,
    disparadores: [
      { id: 'd1', trigger_tipo: 'etiqueta_puesta', etiqueta_id: 7 },
      { id: 'd2', trigger_tipo: 'etiqueta_puesta', etiqueta_id: 9 },
    ],
  }, MAPA);
  assert.equal(r.disparadores[0].etiqueta_id, 70);
  assert.equal(r.disparadores[1].etiqueta_id, null, 'una etiqueta sin igual en el destino quedó con el id del DUEÑO');
  assert.equal(r.etiquetas, 1, 'hay que avisar por cada etiqueta que no se pudo traducir');
});

test('«Ignorar» son etiquetas: la que no se traduce se SACA, nunca se deja con el id del dueño', () => {
  const r = disparadoresParaElDestino({
    trigger_tipo: 'etiqueta_agregada', etapa: 'nutri',
    disparadores: [{ id: 'd1', trigger_tipo: 'etiqueta_agregada', ignorar: [7, 9, 8] }],
  }, MAPA);
  assert.deepEqual(r.disparadores[0].ignorar, [70, 80], 'dejar el id del dueño hace que el CRON del destino ignore a OTRA etiqueta');
  assert.equal(r.etiquetas, 1);
});

test('el embudo del dueño no viaja, y con él se va la etapa de ESE embudo', () => {
  const r = disparadoresParaElDestino({
    trigger_tipo: 'etapa_actual', etapa: 'nuevo', funnel_id: 31,
    disparadores: [
      { id: 'd1', trigger_tipo: 'etapa_actual', etapa: 'nuevo', funnel_id: 31 },
      { id: 'd2', trigger_tipo: 'etapa_actual', etapa: 'agendo', etapas: ['agendo', 'vino'] },
    ],
  }, MAPA);
  assert.equal(r.disparadores[0].funnel_id, null, 'el embudo del dueño en el destino es otro o ninguno');
  assert.deepEqual(etapasDe(r.disparadores[0]), [], 'la etapa era de ESE embudo: sin el embudo no significa nada');
  assert.equal(r.ambitos, 1);
  // El que venía SIN embudo es del embudo de la automatización, y ese sí se clona (su FORMA).
  assert.deepEqual(etapasDe(r.disparadores[1]), ['agendo', 'vino'], 'un CRON sin embudo propio conserva sus etapas');
});

test('el producto del dueño no viaja, y nulearlo SOLO habría sido peor: NULL es «cualquier producto»', () => {
  const r = disparadoresParaElDestino({
    trigger_tipo: 'entrega_actual', etapa: 'kickoff', producto_id: 12,
    disparadores: [{ id: 'd1', trigger_tipo: 'entrega_actual', etapa: 'kickoff', producto_id: 12 }],
  }, MAPA);
  assert.equal(r.disparadores[0].producto_id, null, 'los productos se clonan por NOMBRE: el id del dueño apunta a otra cosa');
  assert.deepEqual(etapasDe(r.disparadores[0]), [], 'con producto NULL y etapa puesta, la cohorte es la entrega de TODOS los productos');
  assert.equal(r.ambitos, 1);
});

test('la próxima ocurrencia del dueño no viaja, y en null el motor SIEMBRA en vez de disparar', () => {
  const ayer = new Date('2026-11-05T12:00:00.000Z').toISOString();
  const r = disparadoresParaElDestino({
    trigger_tipo: 'manual', etapa: 'nutri', cron: LUNES_9, cron_proxima_at: ayer,
    disparadores: [
      { id: 'd1', trigger_tipo: 'manual', cron: LUNES_9, cron_proxima_at: ayer, grupo: true },
      { id: 'd2', trigger_tipo: 'manual', cron: LUNES_9, cron_proxima_at: ayer, grupo: true },
    ],
  }, MAPA);
  for (const d of r.disparadores) assert.equal(d.cron_proxima_at, null, 'copiada, el destino dispara en la grilla y el huso del DUEÑO');
  assert.equal(r.horarios, 2, 'hay que avisar que los horarios arrancan su grilla acá');
  // Y en null el motor no manda: siembra (lib/nutricion-agenda.ts, «sembrar no es disparar»).
  const d = decidirAgenda({ cron: LUNES_9, cronProximaAt: null }, 'America/Montevideo', new Date('2026-11-06T12:00:00.000Z'));
  assert.equal(d.toca, false, 'el clon no puede hacer que el destino mande en la primera corrida');
  assert.ok(d.proxima, 'y tiene que quedar sembrada');
});

test('las COLUMNAS del primer CRON: su horario viaja y su ocurrencia no (la verdad del d1 son ellas)', () => {
  const r = disparadoresParaElDestino({
    trigger_tipo: 'manual', etapa: 'nutri', cron: LUNES_9, cron_proxima_at: new Date().toISOString(),
    disparadores: [{ id: 'd1', trigger_tipo: 'manual', cron: LUNES_9, grupo: true }],
  }, MAPA);
  const cols = columnasParaElDestino(r.disparadores[0]);
  assert.deepEqual(cols.cron, LUNES_9, 'sin la columna `cron` el primer CRON pasa a disparar CADA HORA, aunque la lista diga el horario');
  assert.equal(cols.cron_proxima_at, null);
  assert.equal(cols.funnel_id, null);
  assert.equal(cols.producto_id, null);
  assert.equal('disparadores_rev' in cols, false, '`disparadores_rev` es el compare-and-set de la lista, no configuración');
});

test('la etapa de un CRON que quedó sin ámbito va VACÍA, no omitida (la columna es NOT NULL)', () => {
  const r = disparadoresParaElDestino({
    trigger_tipo: 'entrega_actual', etapa: 'kickoff', producto_id: 12,
    disparadores: [{ id: 'd1', trigger_tipo: 'entrega_actual', etapa: 'kickoff', producto_id: 12 }],
  }, MAPA);
  const cols = columnasParaElDestino(r.disparadores[0]);
  assert.equal(cols.etapa, '', 'omitirla le inventaría la etapa «nutri» (el default de la mig 0034)');
  assert.deepEqual(etapasDe({ etapa: cols.etapa as string, etapas: cols.etapas as string[] | null }), []);
});

test('sin la 0241 la lista es la de UNO (las columnas), y la fila de entrada no se toca', () => {
  const fila = { trigger_tipo: 'etapa_actual', etapa: 'nuevo', funnel_id: 31, etiqueta_id: 7 };
  const copia = JSON.parse(JSON.stringify(fila));
  const r = disparadoresParaElDestino(fila, MAPA);
  assert.equal(r.disparadores.length, 1, 'sin la columna, la lista es la del disparador de siempre');
  assert.equal(r.disparadores[0].funnel_id, null);
  assert.deepEqual(fila, copia, 'la fila del origen se modificó');
});

// ── ROTURAS (6/11/2026) ──────────────────────────────────────────────────────────
// Con el arnés del scratchpad (rompe UNA, corre este archivo Y tests/etiquetas-contrato.test.ts,
// restaura y verifica por md5). Base: 26 / 0. Diecisiete roturas, las diecisiete cazadas:
//   sólo el primer CRON viaja → 22 / 4; la lista se copia CRUDA → 25 / 1; la lista no se pide → 25 / 1;
//   la etiqueta del CRON sin traducir → 25 / 1; las de «Ignorar» sin traducir → 25 / 1;
//   «Ignorar» dejando el id del dueño en vez de sacarlo → 25 / 1;
//   el embudo del dueño viajando → 24 / 2; el producto → 25 / 1; nuleándolos y DEJANDO la etapa → 23 / 3;
//   la próxima ocurrencia viajando → 25 / 1; sin la columna `cron` (ni en el select ni en las columnas
//   del primer CRON) → 25 / 1 cada una; la etapa omitida en vez de vacía → 25 / 1;
//   las columnas del primer CRON sin reescribir → 25 / 1; `disparadores_rev` colándose → 25 / 1;
//   escribiendo una columna que su migración no creó → 25 / 1; el select sin tolerar la que falta → 25 / 1.
// Restaurado: 26 / 0.
