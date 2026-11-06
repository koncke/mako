// =============================================================================
// La hoja «Inmobiliaria» con su DISEÑO PROPIO (la copia de Torque): de dónde sale cada número (lib/inmobiliaria-diseno.ts)
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia… y después la adaptación con Maco». La hoja la dibuja
// app/dashboard/disenos/HojaInmobiliaria.tsx con lo que arma `vistaInmobiliaria` de las piezas de la hoja (los interesados del CRM).
// Estos tests EJECUTAN esas funciones con datos armados aquí (ficticios) y miran lo que sale; sólo el último lee el fuente (el
// cableado).
//
// Rompiéndolo (6/11/2026), cada rotura sola y con la base en verde antes y después: el resultado, en el pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Resultado } from '../lib/graficos-agregar';
import { DISENOS_HOJA } from '../lib/graficos-catalogo';
import { PLANTILLAS_HOJA, PLANTILLAS_OFRECIDAS, instanciarPlantilla } from '../lib/graficos-plantillas';
import {
  ASESORES, AVANCES, CARRILES, PROYECTOS, TARJETAS, acumulado, asesoresDe, avancesDe, cambioPts, medidorDe, numerosDe, partesDe, pct, proyectosDe, semanasDe, tableroDe,
  vistaInmobiliaria,
} from '../lib/inmobiliaria-diseno';
import { datosInmobiliariaMuestra } from '../lib/inmobiliaria-diseno-muestra';
import { cableadoDelDiseno } from './_diseno-cableado';

const leer = (r: string) => readFileSync(fileURLToPath(new URL(`../${r}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
const col = (ids: string[]) => ids.map((id) => ({ id, nombre: id, formato: 'numero' as const }));
const res = (ids: string[], totales: Array<number | null>, extra: Partial<Resultado> = {}): Resultado =>
  ({ columnas: col(ids), filas: [], totales, fuera: 0, clase: null, ...extra }) as Resultado;
const filas = (ids: string[], fs: Array<[string, ...Array<number | null>]>, extra: Partial<Resultado> = {}): Resultado =>
  res(ids, ids.map(() => null), { clase: 'categoria', filas: fs.map(([k, ...v]) => ({ clave: k, etiqueta: k, valores: v })), ...extra });
const HOY = '2026-11-06';
const hoja = () => instanciarPlantilla(PLANTILLAS_HOJA.find((p) => p.id === 'inmobiliaria')!);

test('las cuatro tarjetas: las tasas contra antes en puntos, el ticket y los días; lo que no llegó es null, nunca 0', () => {
  assert.deepEqual([pct(74.6), pct(6.42), pct(8)], ['75%', '6.4%', '8%']);
  assert.deepEqual(cambioPts(74.6, 69.2), { texto: '+5 pts vs antes', tono: 'bueno' });
  assert.deepEqual(cambioPts(31.8, 34.1), { texto: '−2 pts vs antes', tono: 'malo' });
  assert.deepEqual([cambioPts(40, 40.2)?.tono, cambioPts(40, null), cambioPts(null, 40)], ['neutro', null, null]);
  const [asis, cie, tic, cic] = numerosDe({
    asistencia: res(['tasa_asistencia'], [74.6], { anterior: [69.2] }), cierre: res(['tasa_cierre'], [31.8], { anterior: [34.1] }),
    ticket: res(['ticket'], [192000]), ciclo: null,
  });
  assert.deepEqual([asis.texto, asis.chip?.texto, cie.chip?.tono], ['75%', '+5 pts vs antes', 'malo']);
  assert.ok(tic.texto?.includes('192,000'), 'el ticket en plata');
  assert.deepEqual([cic.valor, cic.texto, cic.chip], [null, null, null], 'los días que no llegaron no son 0');
});

test('tus proyectos: hasta seis, del que más interesados tiene, con su estado y cuántos de los que visitan compran', () => {
  const r = filas(['leads', 'agendas', 'cierres'], [
    ['B', 20, 8, 2], ['(sin dato)', 99, 9, 9], ['A', 40, 10, 0], ['Vacío', 0, 0, 0], ['C', 5, 0, 0], ['D', 3, 2, 5], ...Array.from({ length: 4 }, (_, i) => [`E${i}`, 1, 0, 0] as [string, ...number[]]),
  ], { fuera: 2 });
  const p = proyectosDe(r)!;
  assert.equal(p.filas.length, PROYECTOS);
  assert.deepEqual(p.filas.slice(0, 4).map((x) => [x.n, x.nombre, x.estado]), [[1, 'A', 'visitas'], [2, 'B', 'vende'], [3, 'C', 'quieto'], [4, 'D', 'vende']], 'sin «(sin dato)» ni los vacíos');
  assert.deepEqual([p.filas[1].compra, p.filas[2].compra, p.filas[3].compra], [25, null, 100], 'sin visitas no hay tasa, y no pasa de 100');
  assert.equal(p.total, 8 + 2, 'los que tienen algo, más los que el límite dejó afuera');
  assert.equal(p.conVisitas, 3);
  assert.equal(proyectosDe(null), null);
});

test('el tablero: las etapas con más interesados, sus tarjetas (las que compraron y agendaron primero) y el número de la etapa', () => {
  const etapa = filas(['leads'], [['Nuevo', 30], ['Visitó', 12], ['(sin dato)', 50], ['Vacía', 0], ...Array.from({ length: 5 }, (_, i) => [`X${i}`, 4 - i * 0.5] as [string, number])]);
  const t = filas(['leads', 'agendas', 'cierres'], [
    ['l1', 1, 0, 0], ['l2', 1, 1, 1], ['l3', 1, 1, 0], ['l4', 1, 0, 0], ['l5', 1, 0, 0], ['l6', 1, 1, 0],
  ]);
  const extra = [['Nuevo', 'Torre', 'Ana Pérez'], ['Nuevo', 'Torre', '(sin dato)'], ['Nuevo', 'Lofts', 'Ana Pérez'], ['Nuevo', '(sin dato)', 'Ana Pérez'], ['Nuevo', 'Torre', 'Ana Pérez'], ['Visitó', 'Torre', 'Juan Gil']];
  t.filas.forEach((f, i) => { f.extra = { etapa: extra[i][0], producto: extra[i][1], closer: extra[i][2] }; });
  const tb = tableroDe(etapa, t, [{ clave: 'Torre', nombre: 'Torre', n: 1, leads: 1, agendas: 0, cierres: 0, compra: null, estado: 'quieto' }])!;
  assert.equal(tb.carriles.length, CARRILES);
  assert.deepEqual(tb.carriles.slice(0, 2).map((c) => [c.etapa, c.total, c.tarjetas.length]), [['Nuevo', 30, TARJETAS], ['Visitó', 12, 1]], 'sin «(sin dato)»');
  assert.equal(tb.carriles[2].etapa, 'X0', 'una etapa vacía no ocupa una columna');
  const nuevo = tb.carriles[0].tarjetas;
  assert.deepEqual(nuevo.slice(0, 2).map((x) => x.clave), ['l2', 'l3'], 'la que compró primero, después la que agendó');
  assert.deepEqual([nuevo[0].asesor, nuevo[0].iniciales, nuevo[0].nProyecto], [null, null, 1], 'sin asesor no se inventa uno; el proyecto lleva su número');
  assert.equal(nuevo.find((x) => x.clave === 'l4')?.proyecto ?? null, null, 'ni un proyecto');
  assert.equal(tb.enTablero, 6);
  assert.equal(tableroDe(null, t, []), null);
  assert.deepEqual(tableroDe(etapa, null, [])!.carriles[0].tarjetas, [], 'sin el tablero, las columnas igual');
});

test('los que avanzan: los del tablero que compraron (primero) o agendaron, con su proyecto; hasta seis', () => {
  const t = filas(['leads', 'agendas', 'cierres'], [['l1', 1, 0, 0], ['l2', 1, 1, 0], ['l3', 1, 1, 1], ['(sin dato)', 1, 1, 1], ...Array.from({ length: 6 }, (_, i) => [`a${i}`, 1, 1, 0] as [string, ...number[]])]);
  t.filas.forEach((f) => { f.extra = { etapa: 'Visitó', producto: f.clave === 'l3' ? 'Torre' : '(sin dato)', closer: f.clave === 'l3' ? 'Ana Pérez' : '(sin dato)' }; });
  const a = avancesDe(t, [{ clave: 'Torre', nombre: 'Torre', n: 2, leads: 1, agendas: 1, cierres: 1, compra: 100, estado: 'vende' }])!;
  assert.equal(a.length, AVANCES);
  assert.deepEqual([a[0].clave, a[0].compro, a[0].proyecto, a[0].nProyecto, a[0].asesor], ['l3', true, 'Torre', 2, 'Ana Pérez'], 'el que compró primero');
  assert.ok(a.every((x) => x.compro || x.agendo), 'el que no hizo nada no avanza');
  assert.ok(!a.some((x) => x.clave === '(sin dato)'));
  assert.deepEqual([a[1].proyecto, a[1].asesor], [null, null], 'sin proyecto ni asesor no se inventa uno');
  assert.equal(avancesDe(null, []), null);
});

test('de dónde llegan y por qué no compran: sin «(sin dato)», con su parte del total de la pieza', () => {
  const o = partesDe(filas(['leads'], [['Meta', 60], ['(sin dato)', 30], ['Google', 20], ['Cero', 0]], { totales: [110] }), 'leads', 5)!;
  assert.deepEqual(o.filas.map((x) => [x.nombre, Math.round(x.parte)]), [['Meta', 55], ['Google', 18]], 'la parte es del total de la pieza (con lo que no tiene dato)');
  assert.equal(partesDe(filas(['leads'], [['A', 3], ['B', 1]]), 'leads', 6)!.total, 4, 'sin total, la suma');
  assert.equal(partesDe(filas(['leads'], Array.from({ length: 9 }, (_, i) => [`M${i}`, 9 - i] as [string, number])), 'leads', 5)!.filas.length, 5);
  assert.equal(partesDe(null, 'leads', 5), null);
});

test('interesados y visitas por semana, en orden, y el acumulado', () => {
  const s = semanasDe(res(['leads', 'agendas'], [30, 9], { clase: 'tiempo', filas: [['2026-11-02', 10, 3], ['2026-10-19', 8, 2], ['2026-10-26', 12, 4]].map(([k, a, b]) => ({ clave: String(k), etiqueta: '', valores: [Number(a), Number(b)] })) }))!;
  assert.deepEqual(s.filas.map((f) => f.clave), ['2026-10-19', '2026-10-26', '2026-11-02']);
  assert.deepEqual([s.leads, s.agendas], [30, 9]);
  assert.deepEqual(acumulado(s.filas).map((f) => [f.leads, f.agendas]), [[8, 2], [20, 6], [30, 9]]);
  assert.equal(semanasDe(null), null);
});

test('quién vende: del que más vendió, con su barra relativa al primero, y el de mejor cierre marcado', () => {
  const a = asesoresDe(filas(['asistencias', 'cierres', 'tasa_cierre', 'vendido'], [
    ['Paula Ibarra', 14, 2, 14.3, 400], ['Valeria Núñez', 21, 6, 28.6, 1000], ['(sin dato)', 9, 9, 99, 9999], ['Nadie', 0, 0, null, 0], ...Array.from({ length: 5 }, (_, i) => [`A${i}`, 5, 1, 20, 100 - i] as [string, ...number[]]),
  ]))!;
  assert.equal(a.length, ASESORES);
  assert.deepEqual(a.slice(0, 2).map((x) => [x.nombre, x.iniciales, x.ancho, x.mejor]), [['Valeria Núñez', 'VN', 1, true], ['Paula Ibarra', 'PI', 0.4, false]]);
  assert.equal(asesoresDe(null), null);
});

test('cuántos agendan: de los interesados de la cabecera; sin interesados no hay medidor', () => {
  assert.deepEqual(medidorDe(res(['leads', 'agendas', 'cierres'], [180, 63, 13])), { leads: 180, agendas: 63, cierres: 13, pct: 35 });
  assert.equal(medidorDe(res(['leads', 'agendas', 'cierres'], [0, 0, 0])).pct, null);
  assert.deepEqual(medidorDe(null), { leads: null, agendas: null, cierres: null, pct: null });
});

test('la hoja entera con la muestra: las cifras cierran entre tarjetas', () => {
  const h = hoja();
  const v = vistaInmobiliaria(h, datosInmobiliariaMuestra(h, HOY));
  assert.equal(v.vacia, false);
  assert.equal(v.cargando, false);
  const leads = v.medidor.leads!;
  assert.equal(v.proyectos!.filas.reduce((a, p) => a + p.leads, 0), leads, 'los interesados de los proyectos suman los de la cabecera');
  assert.equal(v.origen!.total, leads, 'y los de los orígenes');
  assert.equal(v.semanas!.leads, leads, 'y los de las semanas');
  assert.equal(v.semanas!.filas.reduce((a, f) => a + f.agendas, 0), v.medidor.agendas, 'las visitas de las semanas suman las de la cabecera');
  assert.equal(v.tablero!.carriles.length, CARRILES);
  assert.ok(v.tablero!.carriles.every((c) => c.tarjetas.length === TARJETAS));
  assert.ok(v.avances!.length > 0 && v.avances!.every((x) => x.compro || x.agendo));
  assert.ok(v.avances!.filter((x) => x.compro).length <= v.medidor.cierres!, 'no compran más en la muestra que en la cabecera');
  assert.ok(v.numeros.every((n) => n.texto && n.chip));
});

test('sin interesados, la hoja lo dice; leyendo o caída, cada tarjeta espera sin inventar', () => {
  const h = hoja(), p = h.diseno!.piezas;
  assert.equal(vistaInmobiliaria(h, { [p.apertura]: { resultado: res(['leads', 'agendas', 'cierres'], [0, 0, 0]) } }).vacia, true);
  assert.equal(vistaInmobiliaria(h, {}).vacia, false, 'sin saber cuántos entraron no se declara vacía');
  const cargando = Object.fromEntries(Object.values(p).map((id) => [id, { cargando: true }]));
  const v = vistaInmobiliaria(h, cargando);
  assert.deepEqual([v.vacia, v.cargando, v.proyectos, v.tablero, v.avances, v.medidor.pct], [false, true, null, null, null, null]);
  const caida = vistaInmobiliaria(h, Object.fromEntries(Object.values(p).map((id) => [id, { error: 'caída' }])));
  assert.deepEqual([caida.vacia, caida.numeros.map((x) => x.texto)], [false, [null, null, null, null]]);
});

test('el cableado: la plantilla trae su diseño con sus doce piezas, se ofrece y el editor la dibuja mirando', () => {
  assert.ok((DISENOS_HOJA as readonly string[]).includes('inmobiliaria'));
  assert.ok(PLANTILLAS_OFRECIDAS.some((p) => p.id === 'inmobiliaria'));
  const h = hoja();
  const porId = new Map(h.componentes.map((c) => [c.id, c as { fuente?: string; metricas?: string[]; dimension?: string | null; tabla?: { columnas?: string[] } }]));
  const pieza = (k: string) => porId.get(h.diseno!.piezas[k]);
  assert.equal(Object.keys(h.diseno!.piezas).length, 12, 'una plantilla general lleva hasta 12 piezas (TOPE_COMPONENTES_IA)');
  for (const k of Object.keys(h.diseno!.piezas)) assert.ok(porId.has(h.diseno!.piezas[k]), `la pieza ${k} existe`);
  assert.deepEqual([pieza('tablero')?.dimension, pieza('tablero')?.tabla?.columnas], ['lead', ['etapa', 'producto', 'closer']], 'el tablero trae la etapa, el proyecto y el asesor de cada interesado (la hoja SANEADA)');
  assert.deepEqual(pieza('proyectos')?.metricas, ['leads', 'agendas', 'cierres']);
  assert.deepEqual(pieza('asesores')?.metricas, ['asistencias', 'cierres', 'tasa_cierre', 'vendido']);
  cableadoDelDiseno(h, 'inmobiliaria', 'InmobiliariaVivo');
  assert.ok(leer('app/dashboard/disenos/DisenoEnMiniatura.tsx').includes('vistaInmobiliaria(hoja, datosInmobiliariaMuestra(hoja, hoy))'));
});

// Probado rompiéndolo (6/11/2026), cada rotura sola y la base en verde antes y después (17 de 17):
//   · un cambio de cero puntos pintado bueno o malo: 1 fallo, 10 pases;
//   · el chip al revés (sube = malo): 1 fallo, 10 pases;
//   · los días que no llegaron como 0: 2 fallos, 9 pases;
//   · un proyecto vacío ocupando una bahía: 1 fallo, 10 pases;
//   · la compra sin tope y sin visitas como 0: 1 fallo, 10 pases;
//   · el total de proyectos sin los que el límite dejó afuera: 1 fallo, 10 pases;
//   · «(sin dato)» como asesor de una tarjeta: 2 fallos, 9 pases;
//   · las tarjetas sin las que compraron primero: 1 fallo, 10 pases;
//   · una etapa vacía ocupando una columna: 1 fallo, 10 pases (con la primera versión del test daba 0: se sumó el caso);
//   · la parte de lo que tiene dato, no del total de la pieza: 1 fallo, 10 pases;
//   · las semanas al revés: 1 fallo, 10 pases;
//   · las barras de los asesores sin relativizar: 1 fallo, 10 pases;
//   · el medidor sin interesados: 1 fallo, 10 pases;
//   · la hoja vacía sin saber cuántos entraron: 1 fallo, 10 pases;
//   · «Los que avanzan» con el que no hizo nada: 2 fallos, 9 pases;
//   · «Los que avanzan» sin los que compraron primero: 1 fallo, 10 pases;
//   · el tablero sin el asesor en la plantilla: 1 fallo, 10 pases.
