// =============================================================================
// La hoja «Operación diaria» con su DISEÑO PROPIO (la copia de Moorly): de dónde sale cada número (lib/operacion-diseno.ts)
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia… y después la adaptación con Maco» y «Después seguí con la segunda hoja, de a
// una». La hoja la dibuja app/dashboard/disenos/HojaOperacion.tsx con lo que arma `vistaOperacion` de los datos de General y de
// seis piezas de la hoja. Estos tests EJECUTAN esas funciones con datos armados acá (ficticios) y miran lo que sale; sólo el
// último lee el fuente (el cableado).
//
// Probado rompiéndolo (4/11/2026), cada rotura sola y la base en verde antes: ver el pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { DatosGeneral, TareaVista } from '../app/general/datos-tipos';
import type { ItemCalendario } from '../lib/calendario-modelo';
import type { CobroM } from '../app/m/dashboard/modelo';
import type { Resultado } from '../lib/graficos-agregar';
import { mesesOperacion, resumenDeMeses, vistaOperacion } from '../lib/operacion-diseno';
import { escalaOperacion } from '../app/dashboard/disenos/HojaOperacion';
import { DISENOS_HOJA } from '../lib/graficos-catalogo';
import { PLANTILLAS_GENERAL } from '../lib/general-plantillas';
import { instanciarPlantilla } from '../lib/graficos-plantillas';

const leer = (r: string) => readFileSync(fileURLToPath(new URL(`../${r}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');

const HOY = '2026-11-04';
const TZ = 'America/Mexico_City'; // UTC-6
const AHORA = Date.parse('2026-11-04T17:10:00Z'); // 11:10 en Ciudad de México
const mx = (hhmm: string, dia = HOY) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(Date.parse(`${dia}T00:00:00Z`) + ((h + 6) * 60 + m) * 60_000).toISOString();
};
const falla = { ok: false as const, error: 'No se pudo leer.' };
function tarea(o: Partial<TareaVista> & { id: string }): TareaVista {
  return {
    num: 1, emoji: '', title: `Tarea ${o.id}`, detalle: '', priority: 'media', score: 50, progress: 0, deadline: '', labels: [],
    checklist: [], historial: [], origen: 'user', enPrioridad: false, ...o,
  };
}
function llamada(id: string, inicio: string, o: Partial<ItemCalendario> = {}): ItemCalendario {
  return { id, fuente: 'crm', capa: 'llamadas', titulo: `Llamada ${id}`, inicio, fin: null, diaCompleto: false, href: `/crm/${id}`, ...o };
}
const cobro = (leadId: number, urgencia: CobroM['urgencia']): CobroM => ({ leadId, pagoId: leadId * 10, nombre: `Cliente ${leadId}`, linea: 'US$100 · vence el 9/11', urgencia });
type Plan = Extract<DatosGeneral['plan'], { ok: true }>['d'];
function plan(o: Partial<Plan> = {}): Plan {
  return {
    prioridades: [], top: [], deadlines: { tareas: [], proyectos: [] }, hoy: HOY, deHoy: { cerradas: 0, total: 0 }, vencidas: 0,
    objetivo: null, proyectos: [], etiquetas: [], tareasDeProyectos: [], tablero: 'cliente', ...o,
  };
}
function datos(o: Partial<DatosGeneral> = {}): DatosGeneral {
  return {
    cabecera: falla, okrs: falla, kpis: falla, semaforo: falla, pendientes: falla, mes: falla, plan: falla, calendario: falla,
    funnels: falla, cobranza: falla, ...o,
  };
}
const res = (columnas: string[], filas: Array<{ clave: string; valores: Array<number | null> }>, extra: Partial<Resultado> = {}): Resultado =>
  ({ columnas: columnas.map((id) => ({ id, nombre: id, formato: 'numero' })), filas: filas.map((f) => ({ etiqueta: f.clave, ...f })), totales: [], fuera: 0, clase: null, ...extra }) as unknown as Resultado;
const HOJA = { diseno: { id: 'operacion' as const, piezas: { agendas: 'p-ag', pendiente: 'p-pe', cierres: 'p-ci', cobrado: 'p-co', meses: 'p-me', deben: 'p-de' } } };
const serie = (v: number[]) => v.map((valor, i) => ({ clave: `d${i}`, etiqueta: `d${i}`, valor }));
const cal = (items: ItemCalendario[]) => ({ ok: true as const, d: { items, tz: TZ, hoy: HOY, falla: false } });

test('lo que no se leyó es null, nunca un cero', () => {
  const v = vistaOperacion(datos(), HOJA, {}, AHORA);
  for (const k of ['meses', 'espera', 'funnel', 'llamadas', 'deben', 'tildar', 'salud', 'meta'] as const) assert.equal(v[k], null, k);
  assert.ok(v.numeros.every((n) => n.valor === null && n.pie === null), 'un número que no llegó dice «—», no un cero');
  assert.deepEqual(v.frase, [], 'sin nada leído no hay frase');
});

test('los cuatro números: el total de su pieza, su serie y lo que dicen al pie', () => {
  const v = vistaOperacion(datos({
    calendario: cal([llamada('a', mx('09:00')), llamada('b', mx('12:30')), llamada('c', mx('10:00', '2026-11-05'))]),
    cobranza: { ok: true, d: { cobros: [cobro(1, 'vencida'), cobro(2, 'pronto')], tz: TZ, deQuien: null } },
  }), HOJA, {
    'p-ag': { resultado: res(['agendas'], [], { totales: [27], serie: serie([1, 2, 0, 3]) }) },
    'p-pe': { resultado: res(['pendiente'], [], { totales: [41179] }) },
    'p-ci': { resultado: res(['cierres'], [], { totales: [6], serie: serie([1]) }) },
    'p-co': { resultado: res(['cobrado'], [], { totales: [12480], anterior: [9460], serie: serie([1, 3, 2]) }) },
  }, AHORA);
  const n = Object.fromEntries(v.numeros.map((x) => [x.id, x]));
  assert.equal(n.agendas.valor, '27');
  assert.deepEqual(n.agendas.serie, [1, 2, 0, 3]);
  assert.equal(n.agendas.pie, '2 llamadas hoy', 'las del CRM de hoy, no las de mañana');
  assert.equal(n.pendiente.valor, 'US$41,179');
  assert.equal(n.pendiente.pie, '1 cuota vencida');
  assert.equal(n.cierres.serie, null, 'una serie de un punto no es una línea');
  assert.equal(n.cierres.pie, 'De 27 agendas');
  assert.equal(n.cobrado.cambio, '+32%');
});

test('la frase: las llamadas de hoy, lo vencido, lo de la semana y la próxima llamada (la que todavía no empezó)', () => {
  const v = vistaOperacion(datos({
    calendario: cal([llamada('a', mx('09:00'), { titulo: 'Marta Ríos' }), llamada('b', mx('12:30'), { titulo: 'Laura Méndez' })]),
    cobranza: { ok: true, d: { cobros: [cobro(1, 'vencida'), cobro(2, 'vencida')], tz: TZ, deQuien: null } },
    plan: { ok: true, d: plan({ deadlines: { tareas: [tarea({ id: '1', deadline: HOY }), tarea({ id: '2', deadline: '2026-11-08' }), tarea({ id: '3', deadline: '2026-11-20' })], proyectos: [] } }) },
  }), HOJA, {}, AHORA);
  assert.equal(v.frase.map((t) => t.s).join(''), '2 llamadas hoy, 2 cuotas vencidas y 2 tareas que vencen esta semana. Laura Méndez es tu próxima llamada, a las 12:30.');
  assert.deepEqual(v.frase.filter((t) => t.tipo === 'fuerte').map((t) => t.s), ['Laura Méndez']);
});

test('los meses: lo cobrado, las agendas y los cierres; el resumen de cada serie', () => {
  const m = mesesOperacion(res(['cobrado', 'agendas', 'cierres'], [{ clave: '2026-10', valores: [9000, 20, 4] }, { clave: '2026-11', valores: [12000, 8, null] }]))!;
  assert.deepEqual(m.map((x) => [x.corto, x.largo, x.cobrado, x.agendas, x.cierres]), [['Oct', 'Octubre de 2026', 9000, 20, 4], ['Nov', 'Noviembre de 2026', 12000, 8, 0]]);
  assert.deepEqual(resumenDeMeses(m, 'cobrado'), { total: 21000, promedio: 10500, mejor: 'Noviembre de 2026', actual: 12000 });
  assert.equal(resumenDeMeses(m, 'agendas').mejor, 'Octubre de 2026');
  assert.equal(mesesOperacion(res(['agendas'], [{ clave: '2026-11', valores: [1] }])), null, 'sin lo cobrado no hay gráfico');
});

test('«Te está esperando»: lo vencido primero (cobros, tareas, leads), después lo que vence pronto; hasta seis', () => {
  const v = vistaOperacion(datos({
    cobranza: { ok: true, d: { cobros: [cobro(1, 'pronto'), cobro(2, 'vencida')], tz: TZ, deQuien: null } },
    plan: { ok: true, d: plan({ deadlines: { tareas: [tarea({ id: 'v', deadline: '2026-10-28' }), tarea({ id: 'h', deadline: HOY }), tarea({ id: 'p', deadline: '2026-11-06' }), tarea({ id: 'lejos', deadline: '2026-11-30' })], proyectos: [] } }) },
    pendientes: { ok: true, d: { total: 5, porTipo: { A: 3, B: 2, C: 0, M: 0, R: 0 }, aviso: null } as never },
  }), HOJA, {}, AHORA);
  assert.deepEqual(v.espera?.lista.map((e) => [e.id, e.cuando]), [
    ['c-2-20', 'vencida'], ['t-v', '7 días tarde'], ['leads', 'marcar'], ['c-1-10', 'vence pronto'], ['t-h', 'hoy'], ['t-p', 'en 2 días'],
  ]);
  assert.equal(v.espera?.total, 6, 'lo de más de una semana no espera');
});

test('«Las llamadas que vienen»: catorce días desde hoy y las tres próximas que no empezaron', () => {
  const v = vistaOperacion(datos({
    calendario: cal([llamada('pasada', mx('09:00')), llamada('a', mx('12:30')), llamada('b', mx('18:00')), llamada('c', mx('10:00', '2026-11-05')), llamada('d', mx('10:00', '2026-11-06')), llamada('fuera', mx('10:00', '2026-11-20'))]),
  }), HOJA, {}, AHORA);
  assert.equal(v.llamadas?.porDia.length, 14);
  assert.deepEqual(v.llamadas?.porDia.slice(0, 3).map((p) => [p.rotulo, p.n]), [['Hoy', 3], ['5/11', 1], ['6/11', 1]]);
  assert.deepEqual(v.llamadas?.proximas.map((l) => [l.id, l.cuando, l.hoy]), [['a', 'Hoy 12:30', true], ['b', 'Hoy 18:00', true], ['c', 'Mañana 10:00', false]]);
});

test('«Te deben»: los tramos de la pieza con su porcentaje, sólo los que tienen plata', () => {
  const v = vistaOperacion(datos(), HOJA, {
    'p-de': { resultado: res(['pendiente', 'pagos'], [{ clave: 'Al día', valores: [3000, 4] }, { clave: '60+ días', valores: [1000, 1] }]) },
  }, AHORA);
  assert.deepEqual(v.deben, { total: 4000, cuotas: 5, tramos: [{ nombre: 'Al día', monto: 3000, pct: 75 }, { nombre: 'Más de 60 días', monto: 1000, pct: 25 }] });
});

test('«Para tildar hoy»: lo que vence hoy y lo vencido, lo más viejo primero', () => {
  const v = vistaOperacion(datos({
    plan: { ok: true, d: plan({ deadlines: { tareas: [tarea({ id: 'h', deadline: HOY }), tarea({ id: 'v', deadline: '2026-11-01' }), tarea({ id: 'm', deadline: '2026-11-05' })], proyectos: [] } }) },
  }), HOJA, {}, AHORA);
  assert.deepEqual(v.tildar?.map((t) => [t.id, t.cuando]), [['v', 'vencida'], ['h', 'hoy']]);
});

test('el eje del gráfico: cuatro pasos redondos con lo más alto adentro', () => {
  for (const max of [3, 27, 450, 9999, 19800, 800000]) {
    const { tope, paso } = escalaOperacion(max);
    assert.equal(tope, 4 * paso);
    assert.ok(max <= tope && max > tope / 4, `${max}: entre ${paso} y ${tope}`);
  }
});

test('cableado: la plantilla «Operación diaria» trae su diseño con sus seis piezas, y el editor lo dibuja mirando', () => {
  assert.ok(DISENOS_HOJA.includes('operacion'));
  const h = instanciarPlantilla(PLANTILLAS_GENERAL.find((x) => x.id === 'operacion')!);
  assert.equal(h.diseno?.id, 'operacion');
  const porId = new Map(h.componentes.map((c) => [c.id, c as { metricas?: string[]; dimension?: string | null }]));
  const pieza = (k: string) => porId.get(h.diseno!.piezas[k]);
  assert.deepEqual(pieza('meses')?.metricas, ['cobrado', 'agendas', 'cierres']);
  assert.equal(pieza('deben')?.dimension, 'atraso');
  for (const k of ['agendas', 'pendiente', 'cierres', 'cobrado']) assert.deepEqual(pieza(k)?.metricas, [k], `el número ${k}`);
  const editor = leer('app/dashboard/EditorInforme.tsx');
  assert.ok(editor.includes("hoja.diseno?.id === 'operacion' && general?.datos && !enGrilla && !editando && !dueno"));
  assert.ok(editor.includes('<OperacionVivo hoja={hoja} hoy={hoy} datos={datos}'));
});

// Probado rompiéndolo (4/11/2026), cada rotura sola y la base en verde antes (6 de 6, cada una 1 fallo y 9 pases):
//   · los leads por marcar antes que las tareas vencidas («Te está esperando»);
//   · la próxima llamada contando las que ya empezaron («Las llamadas que vienen»);
//   · «Para tildar hoy» con lo de mañana;
//   · un número que no llegó como 0 en vez de null (`?? 0`);
//   · los tramos de «Te deben» sin sacar los que no tienen plata;
//   · el pie de las agendas contando todas las llamadas y no sólo las de hoy.
