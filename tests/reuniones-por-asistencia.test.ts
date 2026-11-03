// =============================================================================
// Las cifras de llamadas de Joan (Código Inmobiliario, ws13, 26/10/2026), medidas contra la base el 29/10:
//   · 19:15 UTC, «¿cuántos no show?» → MaKo: 25 no-shows y 14 sin marcar.  La base a esa hora: 25 y 14.
//   · 19:26 UTC, «pasame los no show» → MaKo: 28 y 10.                       La base a esa hora: 28 y 10.
//   Las DOS eran ciertas: entre 19:19 y 19:20 el equipo marcó cuatro R1 (Pablo Rodriguez vino; Matías Molina, Eugenia y
//   Malena Piaggio no). MaKo dio el número nuevo sin decir por qué. Lo que sí estaba mal: el reparto «10 en septiembre y 18
//   en octubre» (era 8 y 20), y que a «pasame el nombre y apellido de cada uno de los que quedaron sin marcar» contestó que
//   «no se lista nominalmente»: había el número y ninguna lectura con los nombres.
//
// Ahora: `reuniones_por_asistencia` da los nombres con LA MISMA cuenta que `metricas_negocio` (`estadoDeAsistencia`, la
// misma ventana), con la hora de la cuenta, y los totales del período dicen que son los de AHORA.
//
// ── Probado rompiéndolo (29/10/2026), de a una y restaurando. Ver el pie. ──
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  estadoDeAsistencia, reunionesPorAsistencia, salidaPorAsistencia, TOPE_LISTA_REUNIONES, type FilaReunionLead,
} from '../lib/reuniones-por-asistencia';
import { totalesDelPeriodo, type ReporteMetricas } from '../lib/metricas-modelo';
import { clasificarIntencion } from '../lib/mako-intencion';
import { herramientasDelChat } from '../lib/mako-turno-app-reglas';
import { herramientasDelTurno } from '../lib/doer-herramientas';
import { porId, type Vista } from '../lib/api-mako/registro';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const fila = (id: number, nombre: string | null, j1: string | null, a1: boolean | null, j2: string | null = null, a2: boolean | null = null): FilaReunionLead =>
  ({ id, nombre, fecha_junta_1: j1, asistio_j1: a1, fecha_junta_2: j2, asistio_j2: a2, closer: null });
const PERIODO = { desde: '2026-09-19', hasta: '2026-10-26', hoy: '2026-10-26' };

test('los tres estados: NULL es «nadie lo marcó», no «no vino»', () => {
  assert.equal(estadoDeAsistencia(true), 'realizada');
  assert.equal(estadoDeAsistencia(false), 'noshow');
  assert.equal(estadoDeAsistencia(null), 'sin_marcar');
  assert.equal(estadoDeAsistencia(undefined), 'sin_marcar');
});

test('el caso de Joan: los cuatro que se marcaron entre las dos preguntas mueven el número, y la lista lo muestra', () => {
  // Una foto chica con la forma del ws13: los cuatro del 26/10 sin marcar a las 19:15, y marcados a las 19:26.
  const antes = [
    fila(2771, 'Pablo Rodriguez', '2026-10-26', null), fila(2756, 'Matías Molina', '2026-10-26', null),
    fila(2761, 'Eugenia', '2026-10-22', null), fila(3091, 'Malena Piaggio', '2026-10-26', null),
    fila(2421, 'Ramiro Fleytas', '2026-09-22', null), fila(2400, 'Ana', '2026-09-25', false),
  ];
  const despues = antes.map((f) => (f.id === 2771 ? { ...f, asistio_j1: true } : [2756, 2761, 3091].includes(f.id) ? { ...f, asistio_j1: false } : f));
  const cuenta = (filas: FilaReunionLead[]) => ({
    sin: reunionesPorAsistencia(filas, { ...PERIODO, asistencia: 'sin_marcar' }).length,
    no: reunionesPorAsistencia(filas, { ...PERIODO, asistencia: 'no_show' }).length,
  });
  assert.deepEqual(cuenta(antes), { sin: 5, no: 1 });
  assert.deepEqual(cuenta(despues), { sin: 1, no: 4 }, 'sin marcar −4, no-show +3: las dos respuestas eran ciertas');
  const nombres = reunionesPorAsistencia(despues, { ...PERIODO, asistencia: 'no_show' }).map((r) => r.nombre);
  assert.deepEqual(nombres, ['Ana', 'Eugenia', 'Malena Piaggio', 'Matías Molina'], 'por fecha y nombre');
});

test('la R2 cuenta, la ventana es inclusive, lo de afuera no, y se puede pedir una sola reunión', () => {
  const filas = [
    fila(1, 'Dentro R1', '2026-09-19', null), fila(2, 'Fuera antes', '2026-09-18', null), fila(3, 'Fuera después', '2026-10-27', null),
    fila(4, 'R1 vino, R2 sin marcar', '2026-10-01', true, '2026-10-10', null), fila(5, null, '2026-10-26', null),
  ];
  const todas = reunionesPorAsistencia(filas, { ...PERIODO, asistencia: 'sin_marcar' });
  assert.deepEqual(todas.map((r) => `${r.lead_id}${r.reunion}`), ['1R1', '4R2', '5R1']);
  assert.equal(todas.find((r) => r.lead_id === 5)?.nombre, 'Lead #5', 'sin nombre, el id');
  assert.equal(todas.find((r) => r.lead_id === 5)?.es_hoy, true, 'la de hoy puede no haber pasado');
  assert.equal(todas.find((r) => r.lead_id === 1)?.es_hoy, undefined);
  assert.deepEqual(reunionesPorAsistencia(filas, { ...PERIODO, asistencia: 'sin_marcar', reunion: 'R2' }).map((r) => r.lead_id), [4]);
  assert.deepEqual(reunionesPorAsistencia(filas, { ...PERIODO, asistencia: 'asistio' }).map((r) => r.lead_id), [4]);
  // Un timestamp en vez de una DATE (por las dudas): se mira el día.
  assert.equal(reunionesPorAsistencia([fila(9, 'X', '2026-10-01T15:00:00+00:00', false)], { ...PERIODO, asistencia: 'no_show' }).length, 1);
});

test('la salida: el total entero aunque la lista se corte, la hora de la cuenta y de dónde sale el número', () => {
  const muchas = Array.from({ length: TOPE_LISTA_REUNIONES + 7 }, (_, i) => fila(i + 1, `L${i}`, '2026-10-01', null));
  const s = salidaPorAsistencia(reunionesPorAsistencia(muchas, { ...PERIODO, asistencia: 'sin_marcar' }), { ...PERIODO, zona: 'America/Argentina/Buenos_Aires', contadoA: '2026-10-26 16:26', asistencia: 'sin_marcar' });
  assert.equal(s.total, TOPE_LISTA_REUNIONES + 7);
  assert.equal(s.reuniones.length, TOPE_LISTA_REUNIONES);
  assert.equal(s.faltan_en_la_lista, 7);
  assert.equal(s.contado_a, '2026-10-26 16:26');
  assert.match(s.nota, /misma cuenta que «reuniones sin marcar» \(reuniones 1 y 2\) de metricas_negocio/);
  const ns = salidaPorAsistencia([], { ...PERIODO, zona: 'UTC', contadoA: 'x', asistencia: 'no_show' });
  assert.match(ns.nota, /«no-shows»/);
  assert.equal('faltan_en_la_lista' in ns, false);
});

test('LA MISMA CUENTA que metricas_negocio: reporteMetricas usa `estadoDeAsistencia` para las dos reuniones', () => {
  const m = sinComentarios(leer('lib/metricas-negocio.ts'));
  assert.match(m, /import \{ estadoDeAsistencia \} from '\.\/reuniones-por-asistencia';/);
  assert.equal((m.match(/const e = estadoDeAsistencia\(r\.asistio_j[12]\);/g) ?? []).length, 2);
  assert.doesNotMatch(m, /r\.asistio_j[12] === (true|false)/, 'ninguna otra cuenta a mano');
  const run = sinComentarios(leer('lib/api-mako/areas/metricas.run.ts'));
  const b = run.slice(run.indexOf('reuniones_por_asistencia: {'), run.indexOf('metricas_negocio: {'));
  assert.match(b, /rango\(input\)/, 'la misma ventana (validarRango, 90 días por defecto)');
  assert.match(b, /reunionesPorAsistencia\(filas, \{ desde, hasta, hoy, asistencia, reunion \}\)/);
  assert.match(b, /fecha_junta_1\.gte\.\$\{desde\},fecha_junta_1\.lte\.\$\{hasta\}\),and\(fecha_junta_2\.gte/);
});

test('los totales del período dicen que son los de AHORA y dónde están los nombres (sólo si hubo reuniones)', () => {
  const rep = (j1: number) => ({
    periodo: { desde: '2026-09-19', hasta: '2026-10-26', grano: 'mes' },
    totales: { j1_programadas: j1, j1_realizadas: 0, j1_noshow: j1, j1_sin_marcar: 0, j2_programadas: 0, j2_realizadas: 0, j2_noshow: 0, j2_sin_marcar: 0 },
    filas: [],
  }) as unknown as ReporteMetricas;
  const con = totalesDelPeriodo(rep(3)).join('\n');
  assert.match(con, /Son los de AHORA: si el equipo marca una reunión, el no-show y el sin marcar cambian/);
  assert.match(con, /reuniones_por_asistencia/);
  assert.match(con, /- no-shows \(reuniones 1 y 2\): 3\n/);
  assert.doesNotMatch(totalesDelPeriodo(rep(0)).join('\n'), /Son los de AHORA/);
});

const vista = (canal: 'app' | 'whatsapp'): Vista => ({ canal, alcance: canal === 'app' ? 'proponer' : 'ejecutar', ws: 13, rol: 'admin', tabs: null });

test('con las preguntas de Joan la lectura llega a MaKo, por WhatsApp y en la app; por HTTP no sale (son nombres)', () => {
  for (const texto of ['Pasame el nombre y apellido de cada uno de los que quedaron sin marcar.', 'Cuales son las sin marcar?', 'quiénes son los no-show de octubre?']) {
    const wa = herramientasDelTurno({ veredicto: clasificarIntencion(texto), texto, agendaAbierta: false, deSiempre: [], vista: vista('whatsapp'), hayPendientes: false });
    assert.ok(wa.tools.some((t) => t.name === 'reuniones_por_asistencia'), `WhatsApp: ${texto}`);
    const app = herramientasDelChat({ veredicto: clasificarIntencion(texto, { canal: 'app' }), texto, agendaAbierta: false, deSiempre: [], vista: vista('app'), hayPendientes: false });
    assert.ok(app.tools.some((t) => t.name === 'reuniones_por_asistencia'), `app: ${texto}`);
  }
  const def = porId('reuniones_por_asistencia');
  assert.equal(def?.tipo, 'lectura');
  assert.equal(def?.area, 'metricas', 'por WhatsApp «sin marcar» y «no-show» abren métricas, no el CRM');
  assert.deepEqual(def?.canales, ['whatsapp', 'app']);
  assert.deepEqual(def?.gating, { tab: 'crm' });
});

// ── Probado rompiéndolo (29/10/2026), de a una y restaurando. Base 7/0, final 7/0 ──
// Cada uno de los 4 archivos como estaba en main (7f36fa9c6)                       → 6/1
// R1  NULL cuenta como no-show                                                    → 3/4
// R2  el último día del período queda afuera                                      → 5/2
// R3  sin la R2 · R4 el total es el de la lista cortada · R5 sin `es_hoy`           → 6/1 cada una
// R6  reporteMetricas cuenta la R2 a mano otra vez · R7 otra ventana en el runner   → 6/1 cada una
// R8  los totales sin la línea de AHORA                                           → 6/1
// R9  la lectura en el área del CRM (por WhatsApp no llega) · R10 sale por HTTP     → 6/1 cada una
