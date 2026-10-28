// =============================================================================
// Lo que lee el modelo: las horas en la zona del negocio, el día de cada fecha y los totales ya sumados (28/10/2026)
// =============================================================================
// El diagnóstico de MaKo en WhatsApp (C:/dev/revisiones/2810-diagnostico-mako-whatsapp.md, F3), en Código Inmobiliario:
//   · el 26/10 a las 08:22, «Francisco Piñeiro Negri - Horario: 20:00 hs» cuando era a las 17:00, y «lunes 27/10» cuando era
//     martes: `reuniones_proximas` daba la hora en UTC y las fechas sin su día;
//   · a las 04:15 y 04:29, para el mismo período, 25 no-shows y 14 sin marcar, y después 28 y 10: el modelo sumaba los meses.
// Lo aprendido: docs/hallazgos-api-mako.md, «Las horas y los totales que lee el modelo».
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { conHorasDelNegocio, diaDeLaSemana, enLaZona } from '../lib/api-mako/horas-del-negocio';
import { metricasAMarkdown, type ReporteMetricas } from '../lib/metricas-modelo';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const AR = 'America/Argentina/Buenos_Aires';

test('1. la reunión de Francisco: sale a las 17:00 del martes, no a las 20:00 del «lunes»', () => {
  // Lo que devolvía reuniones_proximas: la fecha de la reunión y el instante de Calendly en UTC.
  const salida = JSON.stringify({
    ventana: { desde: '2026-10-26', hasta: '2026-10-27', dias: 2 }, zona: AR,
    reuniones: [{ lead_id: 2761, reunion: 'R1', fecha: '2026-10-27', nombre: 'Francisco Piñeiro Negri', hora: '2026-10-27T20:00:00.000Z', link: null }],
  });
  const j = JSON.parse(conHorasDelNegocio(salida, AR));
  const r = j.reuniones[0];
  assert.equal(r.hora, '2026-10-27 17:00', 'la hora sigue en UTC');
  assert.equal(r.hora_dia_semana, 'martes');
  assert.equal(r.fecha, '2026-10-27', 'la fecha sola no cambia: el modelo la puede pasar a otra herramienta');
  assert.equal(r.fecha_dia_semana, 'martes', 'el 27/10/2026 es martes');
  assert.equal(j.ventana.desde_dia_semana, 'lunes');
  assert.equal(j.zona_horaria, AR);
  assert.match(j.nota_horas, /No conviertas la hora ni calcules el día/);
  assert.equal(r.nombre, 'Francisco Piñeiro Negri', 'lo demás, tal cual');
  assert.equal(r.link, null);
});

test('2. el instante cambia de día en la zona del negocio, y vale con otras zonas y con offset', () => {
  assert.deepEqual(enLaZona('2026-10-28T02:30:00Z', AR), { fecha: '2026-10-27', hora: '23:30', dia: 'martes' }, 'pasada la medianoche UTC sigue siendo el martes');
  assert.deepEqual(enLaZona('2026-10-27T23:00:00.000Z', 'America/Mexico_City'), { fecha: '2026-10-27', hora: '17:00', dia: 'martes' });
  assert.deepEqual(enLaZona('2026-10-27T17:00:00-03:00', AR), { fecha: '2026-10-27', hora: '17:00', dia: 'martes' });
  assert.equal(enLaZona('2026-10-27T20:00:00', AR), null, 'sin zona no es un instante: no se adivina');
  assert.equal(enLaZona('2026-10-27T20:00:00Z', 'Zona/Inventada'), null, 'con una zona que no existe, tal cual');
  assert.equal(diaDeLaSemana('2026-10-27'), 'martes');
  assert.equal(diaDeLaSemana('2026-02-30'), null);
});

test('3. lo que no trae fechas, o no es JSON, vuelve igual', () => {
  const sin = JSON.stringify({ ok: true, total: 3, nombres: ['Ana', 'Beto'] });
  assert.equal(conHorasDelNegocio(sin, AR), sin);
  const texto = '# Números del negocio\n| a | b |';
  assert.equal(conHorasDelNegocio(texto, AR), texto);
  // Lo anidado y en listas también.
  const j = JSON.parse(conHorasDelNegocio(JSON.stringify({ cambios: [{ campo: 'Nota', fecha: '2026-10-26T11:22:00Z' }] }), AR));
  assert.deepEqual(j.cambios[0], { campo: 'Nota', fecha: '2026-10-26 08:22', fecha_dia_semana: 'lunes' });
});

test('4. pasa por la puerta del MODELO (WhatsApp y la app), y la API HTTP recibe los datos crudos', () => {
  const ej = leer('lib/api-mako/ejecutar.ts');
  const runner = ej.slice(ej.indexOf('export function runnerDelRegistro'));
  assert.match(runner, /if \(r\.ok && r\.tipo === 'lectura'\) \{\n\s*tz \?\?= await tzDeWorkspace\(ctx\.ws\)\.catch\(\(\) => TZ_DEFAULT\);\n\s*return conHorasDelNegocio\(r\.resultado, tz\);/);
  const operacion = ej.slice(ej.indexOf('export async function ejecutarOperacion'), ej.indexOf('export function runnerDelRegistro'));
  assert.doesNotMatch(operacion, /conHorasDelNegocio/, 'en ejecutarOperacion le cambiaría los datos a la API HTTP y a centro-plan');
});

test('5. los totales del período van ARRIBA, ya sumados, con las reuniones 1 y 2 juntas', () => {
  const fila = (periodo: string, n: Partial<Record<string, number>>) => ({ periodo, j1_programadas: 0, j1_realizadas: 0, j1_noshow: 0, j1_sin_marcar: 0, j2_programadas: 0, j2_realizadas: 0, j2_noshow: 0, j2_sin_marcar: 0, ...n });
  const filas = [fila('2026-08', { j1_noshow: 9, j1_sin_marcar: 4, j2_noshow: 1 }), fila('2026-09', { j1_noshow: 8, j1_sin_marcar: 5, j2_noshow: 2, j2_sin_marcar: 1 }), fila('2026-10', { j1_noshow: 5, j1_sin_marcar: 3 })];
  const totales = { j1_programadas: 0, j1_realizadas: 0, j1_noshow: 22, j1_sin_marcar: 12, j2_programadas: 0, j2_realizadas: 0, j2_noshow: 3, j2_sin_marcar: 1 };
  const r = { periodo: { desde: '2026-08-01', hasta: '2026-10-28', grano: 'mes' }, filas, totales, advertencias: [], cobertura: {} } as unknown as ReporteMetricas;
  const md = metricasAMarkdown(r);
  const arriba = md.indexOf('## Totales del período 2026-08-01 → 2026-10-28');
  assert.ok(arriba > 0, 'sin los totales del período');
  assert.ok(arriba < md.indexOf('| periodo |'), 'los totales van antes de la tabla por mes');
  assert.match(md, /ya sumados: úsalos tal cual, no sumes las filas/);
  assert.match(md, /- no-shows \(reuniones 1 y 2\): 25\n/, 'el no-show del período, 1 y 2 juntas');
  assert.match(md, /- reuniones sin marcar \(1 y 2\): 13\n/);
  assert.match(md, /- j1_noshow: 22\n/);
});
