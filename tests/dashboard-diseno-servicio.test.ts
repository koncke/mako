// =============================================================================
// La hoja «Agencia o servicio» con su DISEÑO PROPIO (la copia de Sunrow): de dónde sale cada número (lib/servicio-diseno.ts)
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia… y después la adaptación con Maco» y «Después seguí con la segunda hoja, de a
// una». La hoja la dibuja app/dashboard/disenos/HojaServicio.tsx con lo que arma `vistaServicio` de las piezas de la hoja y del
// Calendario, el Plan y el Semáforo de General. Estos tests EJECUTAN esas funciones con datos armados aquí (ficticios) y miran lo
// que sale; sólo el último lee el fuente (el cableado).
//
// Probado rompiéndolo (5/11/2026), cada rotura sola y la base en verde antes: ver el pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Resultado } from '../lib/graficos-agregar';
import type { ItemCalendario } from '../lib/calendario-modelo';
import type { TareaVista } from '../app/general/datos-tipos';
import {
  avanceDe, calendarioDe, cuandoDeFecha, debenServicio, diaDe, duracion, etapasDe, fraseServicio, pieDelCambio, quienDe, tareasDe, textoDeContacto,
  venceDe, vieneDe, vistaServicio,
} from '../lib/servicio-diseno';
import { datosServicioMuestra, generalServicioMuestra } from '../lib/servicio-diseno-muestra';
import { DISENOS_HOJA } from '../lib/graficos-catalogo';
import { PLANTILLAS_GENERAL_OFRECIDAS, instanciarPlantilla } from '../lib/graficos-plantillas';
import { PLANTILLAS_GENERAL } from '../lib/general-plantillas';
import { cableadoDelDiseno } from './_diseno-cableado';

const leer = (r: string) => readFileSync(fileURLToPath(new URL(`../${r}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');

const col = (ids: string[]) => ids.map((id) => ({ id, nombre: id, formato: 'numero' as const }));
const res = (ids: string[], totales: Array<number | null>, extra: Partial<Resultado> = {}): Resultado =>
  ({ columnas: col(ids), filas: [], totales, fuera: 0, clase: null, ...extra }) as Resultado;
const filas = (ids: string[], totales: Array<number | null>, fs: Array<[string, ...Array<number | null>]>, extra: Partial<Resultado> = {}): Resultado =>
  res(ids, totales, { clase: 'categoria', filas: fs.map(([k, ...v]) => ({ clave: k, etiqueta: k, valores: v })), ...extra });
const HOY = '2026-11-05';
const hoja = () => instanciarPlantilla(PLANTILLAS_GENERAL.find((p) => p.id === 'servicio')!);
const item = (id: string, capa: ItemCalendario['capa'], inicio: string, extra: Partial<ItemCalendario> = {}): ItemCalendario =>
  ({ id, fuente: 'propio', capa, titulo: id, inicio, fin: null, diaCompleto: false, href: null, ...extra });
function tarea(o: Partial<TareaVista> & { id: string }): TareaVista {
  return { num: 1, emoji: '', title: `Tarea ${o.id}`, detalle: '', priority: 'media', score: 50, progress: 0, deadline: '', labels: [], checklist: [], historial: [], origen: 'user', enPrioridad: false, ...o };
}

test('la frase de arriba: cuántos clientes, en cuántas etapas, quién te necesita y lo vencido', () => {
  assert.equal(fraseServicio(24, 5, 3, 7), 'Tienes 24 clientes en 5 etapas. 3 te necesitan hoy y 7 cuotas están vencidas.');
  assert.equal(fraseServicio(1, 1, 1, 1), 'Tienes 1 cliente en 1 etapa. 1 te necesita hoy y 1 cuota está vencida.');
  assert.equal(fraseServicio(8, null, 0, 0), 'Tienes 8 clientes. Ninguno pide atención hoy.', 'sin etapas leídas no se inventan; cero vencidas no se nombra');
  assert.equal(fraseServicio(8, 2, null, null), 'Tienes 8 clientes en 2 etapas.');
  assert.equal(fraseServicio(null, 5, 3, 7), null, 'sin los clientes no hay frase');
});

test('lo que queda de tu agenda: de lo primero a lo último que tienes hoy con hora, en la zona del negocio', () => {
  const items = [
    item('a', 'entregas', `${HOY}T09:00:00Z`, { fin: `${HOY}T10:00:00Z` }),
    item('b', 'llamadas', `${HOY}T17:15:00Z`, { fin: `${HOY}T18:00:00Z`, titulo: 'Revisión' }),
    item('todo', 'plan', `${HOY}T06:00:00Z`, { diaCompleto: true }),
    item('manana', 'llamadas', '2026-11-06T20:00:00Z', { fin: '2026-11-06T21:00:00Z' }),
  ];
  const d = diaDe(items, 'UTC', HOY, Date.parse(`${HOY}T11:10:00Z`));
  assert.ok(d.estado === 'agenda');
  assert.deepEqual([d.desde, d.hasta, d.queda, d.pie, d.n], ['09:00', '18:00', '6 h 50 min', 'Revisión termina a las 18:00', 2], 'lo de todo el día y lo de mañana no cuentan');
  assert.ok(Math.abs(d.fraccion - 130 / 540) < 1e-9, 'el punto va donde está el reloj, entre lo primero y lo último');
  const antes = diaDe(items, 'UTC', HOY, Date.parse(`${HOY}T07:00:00Z`));
  assert.ok(antes.estado === 'agenda' && antes.fraccion === 0 && antes.queda === '9 h 0 min', 'antes de empezar queda todo, no más');
  const despues = diaDe(items, 'UTC', HOY, Date.parse(`${HOY}T19:00:00Z`));
  assert.ok(despues.estado === 'agenda' && despues.queda === null && despues.pie === 'Tu agenda de hoy ya terminó' && despues.fraccion === 1);
  assert.deepEqual(diaDe([items[2], items[3]], 'UTC', HOY, 0), { estado: 'vacio' }, 'sin nada con hora hoy, el arco no inventa un día');
  // 2026-11-06T03:00Z es el 5 a las 21:00 en Ciudad de México (UTC-6): es de HOY para el negocio.
  const mx = diaDe([item('noche', 'llamadas', '2026-11-06T03:00:00Z')], 'America/Mexico_City', HOY, 0);
  assert.ok(mx.estado === 'agenda' && mx.desde === '21:00');
  assert.equal(duracion(45 * 60000), '45 min');
});

test('el pie de un número: sube, baja, igual o nada, contra el período anterior', () => {
  assert.deepEqual(pieDelCambio(11, 8), { texto: '+38% contra el anterior', tono: 'sube' });
  assert.equal(pieDelCambio(6, 8)?.tono, 'baja');
  assert.deepEqual(pieDelCambio(8, 8), { texto: 'Igual que el anterior', tono: 'igual' });
  assert.equal(pieDelCambio(8, null), null, 'sin el período anterior no se compara');
  assert.equal(pieDelCambio(null, 8), null);
});

test('avanzaron de etapa: las semanas sumadas, la última, el total y el promedio', () => {
  const r = res(['clientes'], [9], { clase: 'tiempo', filas: [['2026-10-22', 2], ['2026-10-29', 3], ['2026-11-05', 4]].map(([k, v]) => ({ clave: String(k), etiqueta: String(k), valores: [Number(v)] })) });
  const a = avanceDe(r)!;
  assert.deepEqual(a.puntos.map((p) => [p.semana, p.suma]), [[2, 2], [3, 5], [4, 9]]);
  assert.deepEqual([a.total, a.ultima, a.promedio, a.tope, a.paso], [9, 4, 3, 10, 'semana']);
  assert.deepEqual(a.marcas, [10, 7.5, 5, 2.5, 0]);
  assert.equal(avanceDe(res(['clientes'], [0], { clase: 'tiempo' })), null, 'sin semanas no hay curva');
  assert.equal(avanceDe(null), null);
});

test('lo que te deben: los cuatro renglones, el anillo y los que más deben', () => {
  const tramos = filas(['pendiente', 'pagos'], [15200, 16], [['Al día', 9400, 9], ['1-30 días', 3600, 4], ['31-60 días', 1500, 2], ['60+ días', 700, 1]]);
  const porCliente = filas(['pendiente'], [7200], [['Ana', 2400], ['Beto', 0], ['Carla', 3000], ['Dani', 900], ['Eva', 600], ['Fede', 300]], { fuera: 2 });
  const d = debenServicio(tramos, porCliente)!;
  assert.deepEqual(d.renglones.map((r) => [r.id, r.monto]), [['total', 15200], ['1-30', 3600], ['30+', 2200], ['al-dia', 9400]], 'más de 30 junta los dos tramos de atraso');
  assert.equal(d.pct, 38, 'lo vencido sobre todo lo que falta cobrar');
  assert.deepEqual([d.cuotas, d.vencidas], [16, 7]);
  assert.ok(Math.abs(d.anillo!.a - (3600 / 15200) * 100) < 1e-9 && Math.abs(d.anillo!.b - (2200 / 15200) * 100) < 1e-9);
  assert.deepEqual(d.quienes!.lista.map((q) => q.nombre), ['Carla', 'Ana', 'Dani', 'Eva'], 'el que más debe primero; el que no debe nada no entra');
  assert.ok(Math.abs(d.quienes!.lista[0].parte - (3000 / 15200) * 100) < 1e-9, 'la barra es la parte del total');
  assert.equal(d.quienes!.mas, 3, 'uno más de la lista y dos que la pieza no trajo');
  const nada = debenServicio(filas(['pendiente', 'pagos'], [0, 0], []), null)!;
  assert.deepEqual([nada.total, nada.pct, nada.anillo, nada.quienes], [0, null, null, null], 'sin nada por cobrar no hay porcentaje que inventar');
  assert.equal(debenServicio(null, porCliente), null);
});

test('quién te necesita: la señal, hace cuánto no hablan y la barra contra el que más debe', () => {
  const r = filas(['atencion', 'deuda_vencida_usd', 'sesiones'], [2, 1800, 12], [['Ana', 1, 1200, 3], ['Beto', 1, 600, 5], ['Carla', 0, 0, 4]]);
  r.filas[0].extra = { senal: 'Atención', tramo_contacto: 'Más de 30 días' };
  r.filas[1].extra = { senal: 'Atención', tramo_contacto: '(sin dato)' };
  r.filas[2].extra = { senal: '(sin dato)', tramo_contacto: '0-7 días' };
  const q = quienDe(r)!;
  assert.deepEqual(q.lista.map((c) => [c.nombre, c.senal, c.contacto, c.tono, c.barra]), [
    ['Ana', 'Atención', 'Más de 30 días', 'bad', 100], ['Beto', 'Atención', null, 'bad', 50], ['Carla', null, '0-7 días', 'neutral', 0],
  ], '«(sin dato)» no es una señal ni un tramo');
  assert.equal(textoDeContacto('Más de 30 días'), 'No hablan hace más de 30 días');
  assert.equal(textoDeContacto('15-30 días'), 'No hablan hace 15-30 días');
  assert.equal(textoDeContacto('0-7 días'), 'Hablaron esta semana');
  assert.equal(textoDeContacto('Nunca'), 'Nunca hablaron');
  assert.equal(textoDeContacto(null), null);
});

test('clientes por etapa: la parte de cada una sobre el total, sin las etapas vacías', () => {
  const e = etapasDe(filas(['clientes'], [20], [['Onboarding', 5], ['Estrategia', 0], ['Producción', 15]]))!;
  assert.deepEqual(e.lista.map((x) => [x.nombre, x.n, x.parte]), [['Onboarding', 5, 25], ['Producción', 15, 75]]);
  assert.equal(e.cuantas, 2, 'una etapa sin clientes no cuenta en «en N etapas»');
});

test('el Calendario: el mes de lunes a domingo, con un punto del color de cada cosa y lo de hoy', () => {
  const c = calendarioDe([
    item('a', 'llamadas', `${HOY}T09:00:00Z`), item('b', 'publicaciones', `${HOY}T12:00:00Z`),
    item('c', 'entregas', '2026-11-10T10:00:00Z'), item('d', 'cobros', '2026-11-10T09:00:00Z'),
  ], 'UTC', HOY);
  assert.equal(c.titulo, 'Noviembre 2026');
  const dias = c.semanas.flat();
  assert.equal(dias.slice(0, 6).every((d) => d === null) && dias[6]?.dia === '2026-11-01', true, 'el 1 de noviembre de 2026 es domingo: la séptima columna');
  assert.equal(c.semanas.every((s) => s.length === 7), true);
  const cinco = dias.find((d) => d?.dia === HOY)!;
  assert.deepEqual([cinco.n, cinco.hoy, cinco.paso, cinco.colores], [2, true, false, ['var(--primary)', 'var(--accent)']]);
  assert.deepEqual(dias.find((d) => d?.dia === '2026-11-10')!.colores, ['var(--good)', 'var(--good)'], 'en orden de hora');
  assert.equal(dias.find((d) => d?.dia === '2026-11-04')!.paso, true);
  assert.deepEqual(c.hoy.map((x) => [x.hora, x.titulo]), [['09:00', 'a'], ['12:00', 'b']]);
});

test('lo que vence, las prioridades y lo que viene', () => {
  assert.equal(cuandoDeFecha('2026-11-04', HOY), 'Vencida');
  assert.equal(cuandoDeFecha(HOY, HOY), 'Hoy');
  assert.equal(cuandoDeFecha('2026-11-06', HOY), 'Mañana');
  assert.equal(cuandoDeFecha('2026-11-17', HOY), '17 nov');
  const v = venceDe([tarea({ id: 'b', deadline: '2026-11-17' }), tarea({ id: 'sin' }), tarea({ id: 'a', deadline: '2026-11-03' })], [], HOY);
  assert.deepEqual(v.lista.map((t) => [t.id, t.dia, t.mes, t.cuando, t.vencida]), [['a', 3, 'nov', 'Vencida', true], ['b', 17, 'nov', '17 nov', false]], 'por fecha, sin las que no tienen');
  const t = tareasDe([tarea({ id: '1', priority: 'alta', deadline: HOY }), tarea({ id: '2', priority: 'futuro' })], [], HOY);
  assert.deepEqual(t.map((x) => [x.prioridad, x.tono, x.detalle]), [['Alta', 'bad', 'Sin proyecto · Hoy'], ['A futuro', 'neutral', 'Sin proyecto']]);
  const w = vieneDe([item('hoy', 'llamadas', `${HOY}T20:00:00Z`), item('pasado', 'entregas', '2026-11-07T10:00:00Z'), item('manana', 'llamadas', '2026-11-06T10:00:00Z')], 'UTC', HOY);
  assert.deepEqual(w.lista.map((x) => [x.id, x.cuando]), [['manana', 'Mañana, 10:00'], ['pasado', 'sáb 7 nov, 10:00']], 'lo de hoy va en el Calendario, no aquí');
});

test('la hoja entera con la muestra: las cifras cierran entre bloques', () => {
  const h = hoja();
  assert.equal(h.diseno?.id, 'servicio');
  const v = vistaServicio(h, datosServicioMuestra(h, HOY), generalServicioMuestra(HOY), Date.parse(`${HOY}T11:10:00Z`));
  assert.deepEqual(Object.keys(v.problemas), []);
  const n = Object.fromEntries(v.numeros.map((x) => [x.id, x]));
  assert.equal(n.clientes.valor, '24');
  assert.equal(v.etapas!.total, 24, 'las etapas suman la cartera');
  assert.equal(n.atencion.valor, String(v.quien!.lista.filter((c) => c.senal === 'Atención').length), 'los que piden atención son los de la lista');
  assert.equal(v.cartera.pct, Math.round((21 / 24) * 100));
  assert.equal(v.cartera.primero?.senal, 'Atención');
  assert.equal(v.deben!.renglones[0].monto, v.deben!.renglones.slice(1).reduce((a, r) => a + r.monto, 0), 'los tres renglones suman el total');
  assert.ok(v.deben!.quienes!.lista.every((q) => q.monto <= v.deben!.total));
  assert.equal(v.frase, 'Tienes 24 clientes en 5 etapas. 3 te necesitan hoy y 7 cuotas están vencidas.');
  assert.deepEqual(v.chips, { reuniones: 3, sesiones: 85, funnels: 3 });
  assert.ok(v.dia?.estado === 'agenda' && v.dia.desde === '09:00');
  assert.equal(v.tareas!.length, 5);
  assert.equal(v.vence!.lista[0].vencida, true);
});

test('lo que no se pudo leer se dice en su bloque, sin inventar', () => {
  const h = hoja();
  const datos = datosServicioMuestra(h, HOY);
  datos[h.diseno!.piezas.deben] = { error: 'caída' };
  datos[h.diseno!.piezas.clientes] = { error: 'caída' };
  const v = vistaServicio(h, datos, null, Date.parse(`${HOY}T11:10:00Z`));
  assert.deepEqual(Object.keys(v.problemas).sort(), ['calendario', 'deben', 'numeros', 'plan', 'salud'], 'sin los datos de General, el Calendario, el Plan y el Semáforo no se leyeron');
  assert.equal(v.deben, null);
  assert.equal(v.numeros[0].valor, null, 'un número que no llegó es null, nunca un cero');
  assert.equal(v.frase, null);
  assert.equal(v.cartera.pct, null);
  assert.equal(v.numeros[1].valor, '11', 'lo que sí se leyó sigue');
  for (const k of ['dia', 'calendario', 'tareas', 'vence', 'viene', 'salud'] as const) assert.equal(v[k], null, k);
  assert.deepEqual(v.chips, { reuniones: null, sesiones: 85, funnels: 3 });
});

test('el cableado: la plantilla trae su diseño con sus once piezas, se ofrece y el editor la dibuja mirando', () => {
  assert.ok((DISENOS_HOJA as readonly string[]).includes('servicio'));
  assert.ok(PLANTILLAS_GENERAL_OFRECIDAS.some((p) => p.id === 'servicio'));
  const h = hoja();
  const porId = new Map(h.componentes.map((c) => [c.id, c as { fuente?: string; metricas?: string[]; dimension?: string | null }]));
  const pieza = (k: string) => porId.get(h.diseno!.piezas[k]);
  assert.equal(Object.keys(h.diseno!.piezas).length, 11);
  for (const k of Object.keys(h.diseno!.piezas)) assert.ok(pieza(k), `la pieza ${k} existe en la hoja`);
  assert.deepEqual([pieza('deben')?.fuente, pieza('deben')?.dimension], ['pagos', 'atraso']);
  assert.deepEqual([pieza('deudores')?.fuente, pieza('deudores')?.dimension], ['pagos', 'cliente']);
  assert.deepEqual([pieza('quien')?.fuente, pieza('quien')?.dimension], ['cartera', 'cliente']);
  assert.deepEqual([pieza('ritmo')?.fuente, pieza('ritmo')?.dimension], ['entrega', 'semana']);
  cableadoDelDiseno(h, 'servicio', 'ServicioVivo');
  assert.ok(leer('app/dashboard/disenos/DisenoEnMiniatura.tsx').includes('vistaServicio(hoja, datosServicioMuestra(hoja, hoy), generalServicioMuestra(hoy)'));
});

// Probado rompiéndolo (5/11/2026), cada rotura sola y la base en verde antes y después (21 de 21):
//   · la frase sin «ninguno pide atención»: 1 fallo, 11 pases;
//   · el arco contando lo de todo el día: 1 fallo, 11 pases;
//   · el arco sin la zona del negocio: 1 fallo, 11 pases;
//   · lo que queda contado desde lo primero aunque ya empezó: 1 fallo, 11 pases;
//   · el cambio contra el anterior al revés: 1 fallo, 11 pases;
//   · «igual» como si hubiera subido: 1 fallo, 11 pases;
//   · la curva sin sumar las semanas: 1 fallo, 11 pases;
//   · «más de 30» sin el tramo de 60+: 2 fallos, 10 pases;
//   · los deudores sin ordenar: 1 fallo, 11 pases;
//   · los deudores con los que no deben nada: 1 fallo, 11 pases;
//   · «más» sin lo que la pieza no trajo: 1 fallo, 11 pases;
//   · un porcentaje con nada por cobrar: 1 fallo, 11 pases;
//   · «(sin dato)» como una señal: 1 fallo, 11 pases;
//   · la barra en plata y no contra el que más debe: 1 fallo, 11 pases;
//   · las etapas vacías contadas: 1 fallo, 11 pases;
//   · el mes empezando el domingo: 1 fallo, 11 pases;
//   · lo vencido sin marcar: 1 fallo, 11 pases;
//   · «lo que viene» con lo de hoy: 1 fallo, 11 pases;
//   · sin los datos de General, el Plan sin avisar: 1 fallo, 11 pases;
//   · un número que no llegó como cero: 1 fallo, 11 pases;
//   · la cartera contando de más a los que piden atención: 1 fallo, 11 pases.
