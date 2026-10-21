// =============================================================================
// Reuniones y Tracking de la ficha, partidos en bloques (20/10/2026; docs/pedidos-crm.md, D2)
// =============================================================================
// Martín, 14/10: Reuniones y Tracking «personalizables», bloque por bloque, «como el Dashboard». Hasta hoy cada tab era
// UN bloque que envolvía la tarjeta vieja entera (`reunion-1` = ReunionesCard, `visitas` = ComportamientoCard). Ahora:
//   · Reuniones: `reunion-2`, `agendar-reunion` y `lo-que-salio-de-la-llamada` son bloques propios;
//   · Tracking: `video-visto`, `actividad-en-pagina` y `grabacion-de-visita` son bloques propios;
//   · el bloque que envolvía (`reunion-1`, `visitas`) dibuja su parte y, ADEMÁS, lo que su hoja no puso aparte
//     (`partesDeReunion1`, `partesDeVisitas`, con `PropsBloque.hermanos`). Así una ficha guardada sólo con el bloque
//     viejo se ve como siempre, y una partida no repite nada. Sin migrar nada guardado.
//
// PROBADO ROMPIÉNDOLO (20/10/2026), con el archivo en 4 / 0, de a una rotura y restaurada:
//   · `partesDeReunion1` sin mirar los hermanos (la R2 salía dos veces)   → 3 / 1
//   · Armador sin pasar `hermanos`                                         → 3 / 1
//   · el registro sin el componente de `reunion-2`                         → 3 / 1
// Correr: node --import tsx --test tests/crm-ficha-bloques-partidos.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REGLAS_REUNIONES, partesDeReunion1 } from '../app/crm/lead-view/ficha/reglas-reuniones';
import { REGLAS_TRACKING, partesDeVisitas } from '../app/crm/lead-view/ficha/reglas-tracking';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

test('el bloque que envolvía dibuja todo en una ficha vieja, y no repite lo que la hoja puso aparte', () => {
  assert.deepEqual(partesDeReunion1(undefined), { r1: true, cajas: true, r2: true, agendar: true, llamada: true }, 'una ficha vieja (sólo reunion-1): como siempre');
  assert.deepEqual(partesDeReunion1(['reunion-1', 'reunion-2', 'cohorte']), { r1: true, cajas: true, r2: false, agendar: true, llamada: true });
  assert.deepEqual(partesDeReunion1(['reunion-1', 'reunion-2', 'agendar-reunion', 'lo-que-salio-de-la-llamada']), { r1: true, cajas: true, r2: false, agendar: false, llamada: false });
  assert.deepEqual(partesDeVisitas(['visitas']), { visitas: true, video: true, actividad: true, grabacion: true });
  assert.deepEqual(partesDeVisitas(['visitas', 'video-visto', 'grabacion-de-visita']), { visitas: true, video: false, actividad: true, grabacion: false });
});

test('cada bloque nuevo se calla cuando no aplica', () => {
  const ctx = (lead: Record<string, unknown>, data: Record<string, unknown> = {}) => ({ lead, data } as never);
  const vacioR2 = REGLAS_REUNIONES['reunion-2'].estaVacio;
  assert.equal(vacioR2(ctx({ fecha_junta_2: null, asistio_j2: null, fathom_links: [] }), {} as never), true, 'sin R2 no hay bloque');
  assert.equal(vacioR2(ctx({ fecha_junta_2: '2026-10-20T15:00:00Z' }), {} as never), false);
  const vacioAgendar = REGLAS_REUNIONES['agendar-reunion'].estaVacio;
  assert.equal(vacioAgendar(ctx({ fecha_junta_1: '2026-10-19T15:00:00Z', sin_r2: false }), {} as never), false, 'después de la R1, sin R2: se ofrece');
  assert.equal(vacioAgendar(ctx({ fecha_junta_1: '2026-10-19T15:00:00Z', sin_r2: true }), {} as never), true, 'cerrado sin R2: no se ofrece');
  assert.equal(vacioAgendar(ctx({}), {} as never), true, 'sin ninguna reunión: no se ofrece');
  assert.equal(REGLAS_REUNIONES['lo-que-salio-de-la-llamada'].estaVacio(ctx({ fathom_links: [{ url: 'https://fathom.video/x', label: 'R1' }] }), {} as never), false);
  assert.equal(REGLAS_TRACKING['video-visto'].estaVacio(ctx({}, { vslEng: { plays: 0, sin_datos: true, max_pct: null } }), {} as never), true);
  assert.equal(REGLAS_TRACKING['video-visto'].estaVacio(ctx({}, { vslEng: { plays: 2, max_pct: 40 } }), {} as never), false);
  assert.equal(REGLAS_TRACKING['grabacion-de-visita'].estaVacio(ctx({}, { replay: null }), {} as never), true);
});

test('cada bloque nuevo tiene su componente, y la tarjeta dibuja sólo sus partes', () => {
  const rr = leer('app/crm/lead-view/ficha/registro-reuniones.tsx');
  for (const id of ['reunion-1', 'reunion-2', 'agendar-reunion', 'lo-que-salio-de-la-llamada']) assert.match(rr, new RegExp(`'?${id}'?: \\{ Componente: parte\\(`), `${id} sin componente`);
  assert.match(rr, /'reunion-1': \{ Componente: parte\(\(p\) => partesDeReunion1\(p\.hermanos\)\)/);
  const rt = leer('app/crm/lead-view/ficha/registro-tracking.tsx');
  for (const id of ['visitas', 'video-visto', 'actividad-en-pagina', 'grabacion-de-visita']) assert.match(rt, new RegExp(`'?${id}'?: \\{ Componente: parte\\(`), `${id} sin componente`);
  const rc = leer('app/crm/lead-view/ReunionesCard.tsx');
  assert.match(rc, /\{ver\.r2 && tuvoR2 && \(/);
  assert.match(rc, /\{ver\.agendar && !tuvoR2 && !lead\.sin_r2 && <AgendarR2/);
  assert.match(rc, /\{ver\.llamada && <InsightsLlamadaCard/);
  const cc = leer('app/crm/lead-view/ComportamientoCard.tsx');
  assert.match(cc, /\{ver\.actividad && <TrackingTimelineCard/);
  assert.match(cc, /\{ver\.grabacion && replay && <GrabacionCard/);
});

test('la ficha le pasa a cada bloque sus hermanos de hoja', () => {
  const a = leer('app/crm/lead-view/ficha/Armador.tsx');
  assert.match(a, /const hermanos = useMemo\(\(\) => lista\.map\(\(p\) => p\.id\), \[lista\]\);/);
  assert.match(a, /hermanos=\{hermanos\}/);
});
