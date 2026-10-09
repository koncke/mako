// =============================================================================
// reagenda-no-show — una reunión NUEVA limpia la marca de «no asistió»
// =============================================================================
// Decisión de Martín (06/10/2026): «Sí, la reunión nueva limpia la marca». Cuando un lead que
// faltó vuelve a agendar por Calendly o Cal.com, el no-show queda en el historial y `asistio_jN`
// vuelve a null — lo mismo que el «reagendar» del CRM. Ver lib/reagenda-no-show.ts.
//
// Probado ROMPIÉNDOLO (09/10/2026), una rotura por vez, restaurando de memoria. Sin romper: 7 / 0.
//   · `limpiaNoShow` limpiando también un `null` (no sólo `false`)        → 6 / 1
//   · sin comparar el instante (mismo día, otra hora no limpia)            → 6 / 1
//   · limpiando sin fecha previa                                           → 6 / 1
//   · la R1 limpiando también en el backfill (fuera de la rama en vivo)   → 6 / 1
//   · `setFechaJunta2` anotando DESPUÉS del update                         → 6 / 1
//   · Cal.com sin pasar su canal a `setFechaJunta2`                        → 6 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { limpiaNoShow, textoNoShow } from '../lib/reagenda-no-show';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
function entre(src: string, desde: string, hasta: string): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré «${hasta}» después de «${desde}»`);
  return src.slice(i, j);
}

const FALTO = { asistio: false, fecha: '2026-10-08', at: '2026-10-08T17:00:00+00:00' };

test('una reserva de OTRO día limpia la marca; la misma reunión reentregada, no', () => {
  assert.equal(limpiaNoShow(FALTO, { fecha: '2026-10-15', at: '2026-10-15T17:00:00Z' }), true);
  // Calendly manda microsegundos y la base devuelve `+00:00`: es el MISMO instante.
  assert.equal(limpiaNoShow(FALTO, { fecha: '2026-10-08', at: '2026-10-08T17:00:00.000000Z' }), false);
});

test('el mismo día a OTRA hora es otra reunión; sin hora en un lado, el día manda', () => {
  assert.equal(limpiaNoShow(FALTO, { fecha: '2026-10-08', at: '2026-10-08T20:00:00Z' }), true);
  assert.equal(limpiaNoShow(FALTO, { fecha: '2026-10-08', at: null }), false);
  assert.equal(limpiaNoShow({ ...FALTO, at: null }, { fecha: '2026-10-08', at: '2026-10-08T20:00:00Z' }), false);
});

test('sólo un «no asistió» explícito se limpia: ni el null ni el «asistió»', () => {
  assert.equal(limpiaNoShow({ ...FALTO, asistio: null }, { fecha: '2026-10-15' }), false);
  assert.equal(limpiaNoShow({ ...FALTO, asistio: true }, { fecha: '2026-10-15' }), false);
  assert.equal(limpiaNoShow({ ...FALTO, asistio: undefined }, { fecha: '2026-10-15' }), false);
});

test('sin fecha previa no hay reunión de la que haber faltado: no se toca', () => {
  assert.equal(limpiaNoShow({ ...FALTO, fecha: null, at: null }, { fecha: '2026-10-15' }), false);
});

test('la línea del historial dice qué reunión faltó y por dónde reagendó', () => {
  assert.equal(textoNoShow('2026-10-08', 'Calendly'), 'No se presentó a la reunión del 08/10/2026 — reagendó por Calendly');
  assert.equal(textoNoShow(null, 'Cal.com'), 'No se presentó — reagendó por Cal.com');
});

const LEADS = sinComentarios(leer('lib/leads.ts'));
const CALCOM = sinComentarios(leer('app/api/webhooks/calcom/route.ts'));

test('CABLEADO R1: limpia en la rama EN VIVO de upsertLeadFromCalendly, anotando antes del update', () => {
  const vivo = entre(LEADS, 'updatePayload = { ...basePayload, ...extraUpdates };', ".from('leads')\n      .update(updatePayload)");
  assert.match(vivo, /if \(limpiaNoShow\(\s*\{ asistio: existing\.asistio_j1, fecha: existing\.fecha_junta_1, at: existing\.junta_1_at \},\s*\{ fecha: input\.fecha_junta_1, at: input\.junta_1_at \},\s*\)\) \{/);
  assert.match(vivo, /await logLeadEvent\(existing\.id, 'Reunión 1 — no asistió', textoNoShow\(existing\.fecha_junta_1, canal\), canal\)[^;]*;\s*updatePayload\.asistio_j1 = null;/);
  // Y el backfill (la rama `soloVacios`) no lo hace: no reagenda a nadie.
  const backfill = entre(LEADS, 'if (soloVacios) {', 'updatePayload = { ...basePayload, ...extraUpdates };');
  assert.doesNotMatch(backfill, /limpiaNoShow|asistio_j1/);
});

test('CABLEADO R2: setFechaJunta2 lee, anota ANTES del update y limpia sólo si corresponde; Cal.com pasa su canal', () => {
  const fn = entre(LEADS, 'export async function setFechaJunta2(', '\n}\n');
  const iLog = fn.indexOf("'Reunión 2 — no asistió'");
  const iUpd = fn.indexOf('.update(');
  assert.ok(iLog > 0 && iUpd > iLog, 'el no-show se anota antes del update');
  assert.match(fn, /\.\.\.\(limpia \? \{ asistio_j2: null \} : \{\}\)/);
  assert.match(CALCOM, /await setFechaJunta2\(lead\.id, fechaReunion, reserva\.inicio, 'Cal\.com'\);/);
});
