// =============================================================================
// La hoja «Curso o comunidad» con su DISEÑO PROPIO (la copia de Vitrea): de dónde sale cada número (lib/curso-diseno.ts)
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia… y después la adaptación con Maco» y «Después seguí con la segunda hoja, de a
// una». La hoja la dibuja app/dashboard/disenos/HojaCurso.tsx con lo que arma `vistaCurso` de las piezas de la hoja y del
// Calendario de General. Estos tests EJECUTAN esas funciones con datos armados aquí (ficticios) y miran lo que sale; sólo el
// último lee el fuente (el cableado).
//
// Probado rompiéndolo (5/11/2026), cada rotura sola y la base en verde antes: ver el pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Resultado } from '../lib/graficos-agregar';
import type { ItemCalendario } from '../lib/calendario-modelo';
import {
  areasDe, clientesDe, cuandoSale, deltaDe, estadosDe, hoyDe, marcasDelEje, numerosDe, publicacionesDe, serieDe, topeDe, tramosDe, vistaCurso,
  type CalendarioDeGeneral,
} from '../lib/curso-diseno';
import { calendarioCursoMuestra, datosCursoMuestra } from '../lib/curso-diseno-muestra';
import { enElPeriodo } from '../lib/marketing-diseno';
import { DISENOS_HOJA } from '../lib/graficos-catalogo';
import { PLANTILLAS_GENERAL_OFRECIDAS, instanciarPlantilla } from '../lib/graficos-plantillas';
import { PLANTILLAS_GENERAL } from '../lib/general-plantillas';

const leer = (r: string) => readFileSync(fileURLToPath(new URL(`../${r}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');

const col = (ids: string[]) => ids.map((id) => ({ id, nombre: id, formato: 'numero' as const }));
const res = (ids: string[], totales: Array<number | null>, extra: Partial<Resultado> = {}): Resultado =>
  ({ columnas: col(ids), filas: [], totales, fuera: 0, clase: null, ...extra }) as Resultado;
const filas = (ids: string[], totales: Array<number | null>, fs: Array<[string, ...Array<number | null>]>, extra: Partial<Resultado> = {}): Resultado =>
  res(ids, totales, { clase: 'categoria', filas: fs.map(([k, ...v]) => ({ clave: k, etiqueta: k, valores: v })), ...extra });
const HOY = '2026-11-04';
const hoja = () => instanciarPlantilla(PLANTILLAS_GENERAL.find((p) => p.id === 'curso')!);
const item = (id: string, capa: ItemCalendario['capa'], inicio: string, extra: Partial<ItemCalendario> = {}): ItemCalendario =>
  ({ id, fuente: 'propio', capa, titulo: id, inicio, fin: null, diaCompleto: false, href: null, ...extra });
const cal = (items: ItemCalendario[], extra: { falla?: boolean; tz?: string } = {}): CalendarioDeGeneral =>
  ({ calendario: { ok: true, d: { items, tz: extra.tz ?? 'UTC', hoy: HOY, falla: extra.falla ?? false } } });

test('los tres números de arriba: más alumnos, ventas o cobrado es bueno, y lo que no llegó es null, nunca un cero', () => {
  assert.deepEqual(deltaDe(148, 136), { texto: '+9%', bueno: true });
  assert.equal(deltaDe(120, 150)?.bueno, false);
  assert.equal(deltaDe(10, 10), null, 'sin cambio no hay chip');
  assert.equal(deltaDe(10, null), null);
  const n = numerosDe(res(['alumnos'], [148], { anterior: [136] }), res(['cierres'], [1]), res(['cobrado'], [14250], { anterior: [12900] }));
  assert.deepEqual(n.map((x) => x.valor), ['148', '1', 'US$14,250']);
  assert.equal(n[1].texto, 'Venta', 'una venta, en singular');
  assert.equal(n[1].delta, null, 'sin el período anterior no se compara');
  const sin = numerosDe(null, res(['cierres'], [null]), res(['cobrado'], [0]));
  assert.deepEqual(sin.map((x) => x.valor), [null, null, 'US$0'], 'un cero medido es un dato; lo que no llegó, no');
});

test('lo que vieron: el tope redondo del eje, sus tres marcas y el mejor día', () => {
  assert.equal(topeDe(36), 50);
  assert.equal(topeDe(20), 20);
  assert.equal(topeDe(142), 200);
  assert.equal(topeDe(0), 1, 'sin datos, el eje no se divide por cero');
  const r = res(['alumnos'], [40], { clase: 'tiempo', filas: [['2026-11-02', 12], ['2026-11-03', 36], ['2026-11-04', 9]].map(([k, v]) => ({ clave: String(k), etiqueta: String(k), valores: [Number(v)] })) });
  const s = serieDe(r, 'alumnos', 40)!;
  assert.equal(s.tope, 50);
  assert.deepEqual(s.marcas, [50, 25, 0]);
  assert.equal(s.paso, 'dia');
  assert.equal(s.mejor, '3 nov');
  assert.equal(s.total, 40, 'el total es el de los alumnos activos (distintos), no la suma de los días');
  const sem = serieDe(res(['clases'], [30], { clase: 'tiempo', filas: [['2026-10-19', 10], ['2026-10-26', 20]].map(([k, v]) => ({ clave: String(k), etiqueta: String(k), valores: [Number(v)] })) }), 'clases', 30)!;
  assert.equal(sem.paso, 'semana');
  assert.equal(serieDe(res(['alumnos'], [0], { clase: 'tiempo', filas: [{ clave: '2026-11-04', etiqueta: '', valores: [0] }] }), 'alumnos', 0)!.mejor, null, 'con todo en cero no hay mejor día');
  assert.equal(serieDe(null, 'alumnos', null), null);
  assert.deepEqual(marcasDelEje(30, 12), [2, 5, 8, 11, 14, 17, 20, 23, 26, 29], 'a la misma distancia, desde hoy');
  assert.deepEqual(marcasDelEje(30, 5), [5, 13, 21, 29]);
  assert.deepEqual(marcasDelEje(5, 12), [0, 1, 2, 3, 4]);
  assert.deepEqual(marcasDelEje(0, 12), []);
  assert.equal(enElPeriodo('Últimos 30 días'), 'en los últimos 30 días');
  assert.equal(enElPeriodo('Este mes'), 'en este mes');
});

test('cuánto avanzan: los estados del que más tiene al que menos, la parte sobre el TOTAL y los tonos de Vitrea', () => {
  const e = estadosDe(filas(['alumnos'], [100], [['Atrasado', 20], ['(sin dato)', 5], ['Al día', 50], ['Empezando', 15], ['Sin empezar', 6], ['Terminó', 3], ['Otros', 1]], { fuera: 2 }))!;
  assert.deepEqual(e.estados.map((x) => [x.nombre, x.parte, x.tono]), [['Al día', 50, 'acc'], ['Atrasado', 20, 'acc'], ['Empezando', 15, 'warn'], ['Sin empezar', 6, 'bad'], ['Terminó', 3, 'bad']]);
  assert.equal(e.mas, 2, 'lo que la pieza no trajo');
  assert.equal(estadosDe(null), null);
});

test('por área: una tarjeta por área en los seis tonos, con su parte, y «más» cuenta lo que no entra', () => {
  const a = areasDe(filas(['alumnos'], [100], [['A', 30], ['B', 20], ['C', 15], ['D', 12], ['E', 10], ['F', 8], ['G', 5]], { fuera: 1 }))!;
  assert.deepEqual(a.areas.map((x) => x.tono), ['blue', 'teal', 'orange', 'coral', 'green', 'ink']);
  assert.deepEqual(a.areas.map((x) => x.parte), [30, 20, 15, 12, 10, 8]);
  assert.equal(a.mas, 1 + 1, 'la séptima área y la que la pieza no trajo');
});

test('quién te necesita: los tramos en su orden (de lo reciente a «Nunca»), sin los vacíos, y el que más tiene marcado', () => {
  const t = tramosDe(filas(['clientes'], [30], [['Nunca', 4], ['0-7 días', 12], ['Más de 30 días', 14], ['8-14 días', 0]]))!;
  assert.deepEqual(t.map((x) => [x.nombre, x.corto, x.n, x.destacado]), [['0-7 días', '0-7 días', 12, false], ['Más de 30 días', '+30 días', 14, true], ['Nunca', 'Nunca', 4, false]]);
  assert.deepEqual(tramosDe(filas(['clientes'], [0], [])), []);
  const c = clientesDe(res(['atencion'], [2], { clase: 'categoria', fuera: 0, filas: [
    { clave: 'Ana', etiqueta: 'Ana', valores: [1], extra: { senal: 'Atención', tramo_contacto: '15-30 días' } },
    { clave: 'Beto', etiqueta: 'Beto', valores: [0], extra: { senal: '(sin dato)', tramo_contacto: '(sin dato)' } },
  ] }))!;
  assert.deepEqual(c.lista.map((x) => [x.nombre, x.senal, x.contacto, x.atencion]), [['Ana', 'Atención', '15-30 días', true], ['Beto', null, null, false]], '«(sin dato)» no es una señal');
});

test('el Calendario: lo que vas a publicar es lo que viene, en orden, y «hoy» tacha lo que ya pasó', () => {
  const ahora = Date.parse(`${HOY}T11:10:00Z`);
  const g = cal([
    item('ya', 'publicaciones', `${HOY}T09:00:00Z`),
    item('reel', 'publicaciones', `${HOY}T12:00:00Z`, { detalle: 'Reel' }),
    item('llamada', 'llamadas', `${HOY}T15:00:00Z`, { fin: `${HOY}T15:45:00Z` }),
    item('entrega', 'entregas', `${HOY}T18:00:00Z`, { hecho: true }),
    item('carrusel', 'publicaciones', '2026-11-05T10:00:00Z'),
    item('correo', 'publicaciones', '2026-11-06T09:00:00Z'),
    item('lejos', 'publicaciones', '2026-11-20T09:00:00Z'),
  ]);
  const p = publicacionesDe(g, ahora)!;
  assert.deepEqual(p.lista.map((x) => [x.titulo, x.cuando]), [['reel', 'Hoy, 12:00'], ['carrusel', 'Mañana, 10:00'], ['correo', 'vie 6 nov, 09:00']]);
  assert.equal(p.total, 4, 'cuenta las que vienen, también las que no entran');
  const h = hoyDe(g, ahora)!;
  assert.deepEqual(h.lista.map((x) => [x.titulo, x.paso]), [['ya', true], ['reel', false], ['llamada', false], ['entrega', true]], 'lo marcado hecho cuenta aunque sea más tarde');
  assert.equal(h.pasaron, 2);
  assert.equal(cuandoSale(`${HOY}T03:00:00Z`, false, 'America/Mexico_City', HOY), 'mar 3 nov, 21:00', 'en la zona del negocio, que todavía es ayer');
  assert.equal(cuandoSale(`${HOY}T06:00:00Z`, true, 'UTC', HOY), 'Hoy', 'un día completo no tiene hora');
  assert.equal(publicacionesDe(cal([], { falla: true }), ahora), null, 'si el Calendario falló no es «nada agendado»');
  assert.equal(hoyDe(null, ahora), null);
});

test('la hoja entera con la muestra: las cifras cierran entre bloques', () => {
  const h = hoja();
  assert.equal(h.diseno?.id, 'curso');
  const v = vistaCurso(h, datosCursoMuestra(h, HOY), calendarioCursoMuestra(HOY), Date.parse(`${HOY}T11:10:00Z`));
  assert.deepEqual(Object.keys(v.problemas), []);
  const alumnos = Number(v.numeros[0].valor);
  assert.equal(v.estados!.total, alumnos, 'los estados suman los alumnos activos');
  assert.equal(v.estados!.estados.reduce((a, e) => a + e.n, 0), alumnos);
  assert.equal(v.areas!.areas.reduce((a, x) => a + x.n, 0), alumnos, 'las áreas suman los alumnos activos');
  assert.equal(v.clasesSemana!.puntos.reduce((a, q) => a + q.valor, 0), v.clases.total, 'las clases de cada semana suman las del período');
  assert.equal(v.alumnosDia!.total, alumnos);
  assert.equal(v.atencion, v.clientes!.lista.filter((c) => c.atencion).length, 'los que piden atención son los marcados en la lista');
  assert.equal(v.hoy!.total, 4);
  assert.equal(v.hoy!.pasaron, 1);
  assert.equal(v.publicaciones!.lista[0].cuando, 'Hoy, 12:00');
});

test('lo que no se pudo leer se dice en su bloque, sin inventar', () => {
  const h = hoja();
  const datos = datosCursoMuestra(h, HOY);
  datos[h.diseno!.piezas.area] = { error: 'caída' };
  datos[h.diseno!.piezas.alumnos] = { error: 'caída' };
  const v = vistaCurso(h, datos, null, Date.parse(`${HOY}T11:10:00Z`));
  assert.deepEqual(Object.keys(v.problemas).sort(), ['areas', 'calendario', 'numeros'], 'sin los datos de General, el Calendario no se leyó');
  assert.equal(v.areas, null, 'sin la pieza no hay tarjetas');
  assert.equal(v.numeros[0].valor, null);
  assert.equal(v.numeros[1].valor, '9', 'lo que sí se leyó sigue');
  assert.equal(v.publicaciones, null);
});

test('el cableado: la plantilla trae su diseño con sus doce piezas, se ofrece y el editor la dibuja mirando', () => {
  assert.ok((DISENOS_HOJA as readonly string[]).includes('curso'));
  assert.ok(PLANTILLAS_GENERAL_OFRECIDAS.some((p) => p.id === 'curso'));
  const h = hoja();
  const porId = new Map(h.componentes.map((c) => [c.id, c as { fuente?: string; metricas?: string[]; dimension?: string | null }]));
  const pieza = (k: string) => porId.get(h.diseno!.piezas[k]);
  assert.equal(Object.keys(h.diseno!.piezas).length, 12);
  for (const k of Object.keys(h.diseno!.piezas)) assert.ok(pieza(k), `la pieza ${k} existe en la hoja`);
  assert.deepEqual([pieza('quien')?.fuente, pieza('quien')?.dimension], ['cartera', 'cliente']);
  assert.deepEqual([pieza('contacto')?.fuente, pieza('contacto')?.dimension], ['cartera', 'tramo_contacto']);
  assert.deepEqual([pieza('estado')?.dimension, pieza('area')?.dimension, pieza('semana')?.dimension], ['estado', 'area', 'semana']);
  const editor = leer('app/dashboard/EditorInforme.tsx');
  assert.ok(editor.includes("hoja.diseno?.id === 'curso' && !enGrilla && !editando && !dueno"));
  assert.ok(editor.includes('<CursoVivo'));
  assert.ok(leer('app/dashboard/disenos/DisenoEnMiniatura.tsx').includes('vistaCurso(hoja, datosCursoMuestra(hoja, hoy), calendarioCursoMuestra(hoy)'));
});

// Probado rompiéndolo (5/11/2026), cada rotura sola y la base en verde antes y después (15 de 15):
//   · más alumnos, ventas o cobrado contado como malo: 1 fallo, 8 pases;
//   · un número que no llegó como 0 en vez de null: 2 fallos, 7 pases;
//   · el tope del eje en cero sin datos: 1 fallo, 8 pases;
//   · los estados sin ordenar del que más tiene al que menos: 1 fallo, 8 pases;
//   · la parte sobre lo que se ve y no sobre el total: 1 fallo, 8 pases;
//   · «más» sin lo que la pieza no trajo: 1 fallo, 8 pases;
//   · los tramos sin clientes como celdas: 1 fallo, 8 pases;
//   · el tramo marcado siempre el primero: 1 fallo, 8 pases;
//   · «(sin dato)» como una señal: 1 fallo, 8 pases;
//   · lo que ya salió entre lo que vas a publicar: 1 fallo, 8 pases;
//   · «hoy» sin lo marcado hecho: 1 fallo, 8 pases;
//   · cuándo sale sin la zona del negocio: 1 fallo, 8 pases;
//   · sin los datos de General, el Calendario sin avisar: 1 fallo, 8 pases;
//   · los rótulos del eje contados desde el primer día y no desde hoy: 1 fallo, 8 pases;
//   · un «mejor día» con todo en cero: 1 fallo, 8 pases.
