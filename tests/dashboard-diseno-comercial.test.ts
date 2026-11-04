// =============================================================================
// La hoja Comercial con su DISEÑO PROPIO (la copia de Selvar): de dónde sale cada número (lib/comercial-diseno.ts)
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia… y después la adaptación con Maco» y «Después seguí con la segunda hoja, de a
// una». La hoja la dibuja app/dashboard/disenos/HojaComercial.tsx con lo que arma `vistaComercial` de las piezas de la hoja y de
// las llamadas de venta de hoy. Estos tests EJECUTAN esas funciones con datos armados acá (ficticios) y miran lo que sale; sólo el
// último lee el fuente (el cableado).
//
// Probado rompiéndolo (4/11/2026), cada rotura sola y la base en verde antes: ver el pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Resultado } from '../lib/graficos-agregar';
import type { LlamadaDeVenta } from '../lib/calendario-llamadas';
import {
  closersDe, desenlaceDe, embudoDe, escalaVentas, fraseComercial, hoyDe, motivosDe, origenesDe, ventasDe, vistaComercial, type DatosPieza,
} from '../lib/comercial-diseno';
import { DISENOS_HOJA } from '../lib/graficos-catalogo';
import { PLANTILLAS_HOJA, PLANTILLAS_OFRECIDAS, instanciarPlantilla } from '../lib/graficos-plantillas';

const leer = (r: string) => readFileSync(fileURLToPath(new URL(`../${r}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');

const HOY = '2026-11-04';
const col = (ids: string[]) => ids.map((id) => ({ id, nombre: id, formato: 'numero' as const }));
const res = (ids: string[], totales: Array<number | null>, extra: Partial<Resultado> = {}): Resultado =>
  ({ columnas: col(ids), filas: [], totales, fuera: 0, clase: null, ...extra }) as Resultado;
const filas = (ids: string[], f: Array<[string, number[]]>): Resultado =>
  ({ columnas: col(ids), filas: f.map(([clave, valores]) => ({ clave, etiqueta: clave, valores })), totales: [], fuera: 0, clase: 'categoria' }) as Resultado;
const texto = (t: Array<{ s: string }>) => t.map((x) => x.s).join('');

test('lo que pasó con las agendas: cerraron, vinieron y no cerraron, no vinieron y sin marcar', () => {
  const d = desenlaceDe(res(['agendas', 'asistencias', 'no_show', 'cierres'], [27, 21, 4, 6]))!;
  assert.deepEqual(d.segmentos.map((s) => [s.id, s.n]), [['cerraron', 6], ['vinieron', 15], ['no-vino', 4], ['sin-marcar', 2]]);
  assert.equal(Math.round(d.segmentos.reduce((a, s) => a + s.pct, 0)), 100);
  // Un cierre sin la asistencia marcada también vino: nunca «vinieron y no cerraron» negativo.
  const raro = desenlaceDe(res(['agendas', 'asistencias', 'no_show', 'cierres'], [10, 2, 1, 5]))!;
  assert.equal(raro.vinieron, 5);
  assert.deepEqual(raro.segmentos.map((s) => s.n), [5, 0, 1, 4]);
  // Sin agendas, o sin la pieza, no hay barra (null, no ceros).
  assert.equal(desenlaceDe(res(['agendas'], [0])), null);
  assert.equal(desenlaceDe(null), null);
});

test('la frase: sólo lo que se leyó, sin «0» inventados', () => {
  assert.equal(texto(fraseComercial(27, 6, 96000, 410)), 'De 27 agendas salieron 6 cierres, vendiste US$96,000 y cada cierre te costó US$410 en anuncios.');
  assert.equal(texto(fraseComercial(1, 1, null, null)), 'De 1 agenda salió 1 cierre.');
  // Sin anuncios (el costo por cierre no se pudo calcular o es cero), la frase no habla de anuncios.
  assert.equal(texto(fraseComercial(27, 6, 96000, null)), 'De 27 agendas salieron 6 cierres y vendiste US$96,000.');
  assert.equal(texto(fraseComercial(null, null, 96000, 410)), 'Vendiste US$96,000 y cada cierre te costó US$410 en anuncios.');
  assert.deepEqual(fraseComercial(null, null, null, null), []);
});

test('lo vendido por semana: apilado por funnel, sin las series vacías, con el promedio', () => {
  const r = {
    ...res(['vendido'], []), clase: 'tiempo',
    filas: [{ clave: '2026-10-19', etiqueta: '19/10', valores: [10] }, { clave: '2026-10-26', etiqueta: '26/10', valores: [30] }, { clave: '2026-11-02', etiqueta: '02/11', valores: [0] }],
    cruce: { claves: ['Programa', 'Mentoría', 'Taller'], celdas: [[10, 0, 0], [20, 10, 0], [0, 0, 0]] },
  } as Resultado;
  const v = ventasDe(r, 'semana')!;
  assert.deepEqual(v.x.map((x) => x.rotulo), ['19 oct', '26 oct', '2 nov']);
  assert.deepEqual(v.series.map((s) => s.nombre), ['Programa', 'Mentoría'], 'el funnel sin ventas no entra a la leyenda');
  assert.equal(v.total, 40);
  assert.equal(Math.round(v.promedio * 100) / 100, 13.33, 'el promedio es sobre TODAS las semanas, también las que no vendieron');
  assert.deepEqual(ventasDe({ ...r, filas: [{ clave: '2026-10-01', etiqueta: 'oct 26', valores: [5] }], cruce: undefined } as Resultado, 'mes')!.series, [{ nombre: 'Vendido', valores: [5] }]);
  assert.equal(ventasDe(null, 'semana'), null);
});

test('de agenda a cierre: cuántos pasan al paso siguiente', () => {
  const e = embudoDe(res(['agendas', 'asistencias', 'limpias', 'cierres'], [120, 94, 71, 25]))!;
  assert.deepEqual(e.map((p) => [p.nombre, p.n, p.pasa]), [
    ['Agendaron', 120, '78% vino a la reunión'], ['Vinieron', 94, '76% quedó calificado'], ['Calificados', 71, '35% cerró'], ['Cerraron', 25, null],
  ]);
  assert.equal(embudoDe(res(['agendas', 'asistencias', 'limpias', 'cierres'], [0, 0, 0, 0])), null);
});

test('los motivos de pérdida: los tres más repetidos, con su parte de TODOS los perdidos', () => {
  const m = motivosDe(filas(['leads'], [['Lo va a pensar', [6]], ['No le alcanzó el presupuesto', [7]], ['Eligió otra opción', [3]], ['Otro', [2]], ['(sin dato)', [9]]]))!;
  assert.equal(m.total, 18, '«sin dato» no es un motivo');
  assert.deepEqual(m.filas.map((f) => [f.nombre, f.n, f.pct]), [['No le alcanzó el presupuesto', 7, 39], ['Lo va a pensar', 6, 33], ['Eligió otra opción', 3, 17]]);
  assert.deepEqual(motivosDe(filas(['leads'], [])), { total: 0, filas: [] });
  assert.equal(motivosDe(null), null, 'no pude leer no es «no hay motivos»');
});

test('cada origen y cada closer, contra la tasa de cierre del período', () => {
  const o = origenesDe(filas(['agendas', 'cierres', 'tasa_cierre', 'vendido'], [['Instagram', [6, 1, 16.7, 16000]], ['Meta', [14, 3, 33.3, 48000]], ['Vacío', [0, 0, 0, 0]]]), 28.6)!;
  assert.deepEqual(o.map((x) => [x.nombre, x.bueno]), [['Meta', true], ['Instagram', false]], 'primero el que más cierra; sin agendas ni cierres no entra');
  const c = closersDe(filas(['asistencias', 'cierres', 'tasa_cierre'], [['Diego', [10, 3, 30]], ['Sofía', [7, 3, 42.9]], ['(sin dato)', [3, 0, 0]]]), 28.6)!;
  assert.deepEqual(c.map((x) => [x.nombre, x.bueno]), [['Sofía', true], ['Diego', true]], 'de la tasa más alta a la más baja, sin «sin dato»');
  assert.equal(origenesDe(null, 28.6), null);
});

test('hoy: las llamadas de venta en orden, sin las canceladas, y dónde va «Ahora»', () => {
  const l = (n: number, hh: string, o: Partial<LlamadaDeVenta> = {}): LlamadaDeVenta => ({
    id: `crm:${n}:R1`, leadId: n, nombre: `Lead ${n}`, cual: 'R1', inicio: `${HOY}T${hh}:00.000Z`, diaCompleto: false, closer: 'Ana', asistio: null, cancelada: false, ...o,
  });
  const h = hoyDe({ tz: 'UTC', llamadas: [l(3, '15:00'), l(1, '09:00', { asistio: true }), l(2, '10:00'), l(4, '12:00', { cancelada: true }), l(5, '09:00', { inicio: '2026-11-05T09:00:00.000Z' })] }, HOY, `${HOY}T11:10:00.000Z`)!;
  assert.deepEqual(h.llamadas.map((x) => x.leadId), [1, 2, 3], 'la cancelada y la de mañana no van');
  assert.equal(h.ahora, 2, '«Ahora» va después de las dos que ya pasaron');
  assert.equal(h.hora, '11:10');
  assert.deepEqual(h.llamadas.map((x) => x.detalle), ['Con Ana · vino', 'Con Ana · sin marcar', 'Con Ana']);
  assert.equal(hoyDe(null, HOY, `${HOY}T11:10:00.000Z`), null);
});

test('la escala del eje: tres pasos redondos, como Selvar ($600k en pasos de $200k)', () => {
  assert.deepEqual(escalaVentas(470), { tope: 600, paso: 200 });
  assert.deepEqual(escalaVentas(32000), { tope: 60000, paso: 20000 });
  for (const m of [1, 7, 99, 1234, 98765]) { const { tope } = escalaVentas(m); assert.ok(tope >= m, `${m} entra en ${tope}`); }
});

test('la vista entera: los números con su cambio, y bueno si sube la tasa o si BAJA el costo', () => {
  const p = instanciarPlantilla(PLANTILLAS_HOJA.find((x) => x.id === 'comercial')!);
  const k = p.diseno!.piezas;
  const datos: Record<string, DatosPieza> = {
    [k.apertura]: { resultado: res(['agendas', 'cierres', 'tasa_cierre', 'vendido', 'asistencias', 'no_show'], [27, 6, 28.6, 96000, 21, 4]) },
    [k.plata]: { resultado: res(['vendido', 'gasto'], [96000, 2460], { anterior: [85700, 2300] }) },
    [k.tasa]: { resultado: res(['tasa_cierre'], [28.6], { anterior: [25.3] }) },
    [k.costo]: { resultado: res(['cac'], [410], { anterior: [461] }) },
    [k.ticket]: { resultado: res(['ticket'], [null]) },
  };
  const v = vistaComercial(p, datos, null, HOY, `${HOY}T11:10:00.000Z`);
  assert.equal(texto(v.frase), 'De 27 agendas salieron 6 cierres, vendiste US$96,000 y cada cierre te costó US$410 en anuncios.');
  assert.deepEqual([v.vendido.cambio, v.vendido.sube], ['+12%', true]);
  assert.deepEqual([Math.round(v.inversion.cpa!), Math.round(v.inversion.roas!)], [91, 39], 'lo invertido ÷ las agendas, y lo vendido ÷ lo invertido');
  const n = Object.fromEntries(v.numeros.map((x) => [x.id, x]));
  assert.deepEqual([n.tasa.valor, n.tasa.cambio, n.tasa.bueno, n.tasa.pie], ['28.6%', '+13%', true, '6 cerraron de 21']);
  assert.deepEqual([n.costo.valor, n.costo.cambio, n.costo.bueno, n.costo.baja], ['US$410', '−11%', true, true], 'el costo que baja es bueno');
  assert.deepEqual([n.ticket.valor, n.ticket.cambio], [null, null], 'lo que no llegó es null, nunca un cero');
  assert.equal(v.hoy, null, 'sin la agenda (el closer, un link compartido) no hay «Hoy»');
});

test('el cableado: la plantilla trae el diseño, se ofrece, y el editor lo dibuja mirando', () => {
  assert.ok((DISENOS_HOJA as readonly string[]).includes('comercial'));
  const p = PLANTILLAS_HOJA.find((x) => x.id === 'comercial')!;
  assert.ok(PLANTILLAS_OFRECIDAS.includes(p), '«Nueva hoja» ofrece Comercial');
  const h = instanciarPlantilla(p);
  const pieza = (k: string) => h.componentes.find((c) => c.id === h.diseno!.piezas[k]) as { metricas?: string[]; desglose?: string; dimension?: string } | undefined;
  for (const k of ['apertura', 'plata', 'tasa', 'ticket', 'ciclo', 'costo', 'semanas', 'meses', 'embudo', 'motivos', 'origen', 'closers']) assert.ok(pieza(k), `la pieza ${k}`);
  assert.deepEqual(pieza('plata')?.metricas, ['vendido', 'gasto']);
  assert.ok(h.componentes.length <= 14, 'una hoja no pasa de 14 paneles');
  assert.deepEqual([pieza('semanas')?.dimension, pieza('semanas')?.desglose], ['semana', 'producto']);
  assert.deepEqual(pieza('apertura')?.metricas, ['agendas', 'asistencias', 'no_show', 'cierres']);
  const editor = leer('app/dashboard/EditorInforme.tsx');
  assert.ok(editor.includes("hoja.diseno?.id === 'comercial' && !enGrilla && !editando && !dueno"));
  assert.ok(editor.includes('extras={disenos?.comercial ?? null}'));
  // La agenda de hoy nombra leads: la página no la pide para el closer ni el setter (`unica`).
  assert.ok(leer('app/dashboard/page.tsx').includes("const agendaComercial = hayDisenoComercial && !unica ? agendaParaComercial(hoy) : Promise.resolve(null);"));
});

// Probado rompiéndolo (4/11/2026), cada rotura sola y la base en verde antes (6 de 6, cada una 1 fallo y 9 pases):
//   · «vinieron» sin contar las que cerraron (un cierre sin la asistencia marcada);
//   · «(sin dato)» contado como un motivo de pérdida;
//   · las llamadas canceladas en «Hoy»;
//   · los closers de la tasa más baja a la más alta;
//   · el costo por cierre que BAJA pintado como malo;
//   · un número que no llegó como 0 en vez de null (`?? 0`).
