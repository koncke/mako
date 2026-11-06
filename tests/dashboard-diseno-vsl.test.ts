// =============================================================================
// La hoja «VSL y YouTube» con su DISEÑO PROPIO (la copia de Pelago): de dónde sale cada número (lib/vsl-diseno.ts)
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia… y después la adaptación con Maco». La hoja la dibuja app/dashboard/disenos/HojaVsl.tsx
// con lo que arma `vistaVsl` de las piezas de la hoja (el video de ventas que mide el Pixel y los leads que pasaron por tu página).
// Estos tests EJECUTAN esas funciones con datos armados aquí (ficticios) y miran lo que sale; sólo el último lee el fuente (el
// cableado).
//
// Probado rompiéndolo (6/11/2026), cada rotura sola y la base en verde antes y después: ver el pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Resultado } from '../lib/graficos-agregar';
import { DISENOS_HOJA } from '../lib/graficos-catalogo';
import { PLANTILLAS_HOJA, PLANTILLAS_OFRECIDAS, instanciarPlantilla } from '../lib/graficos-plantillas';
import { TRAMOS_VISTO } from '../lib/graficos-datos-puro';
import {
  DIAS_PLAY, DIAS_TABLA, FUGAS, VIDEOS, cienDe, contraTodos, curvaDe, enteros, fugasDe, haceCuanto, largoRayo, numerosDe, pct, pilaDe, playDe,
  respuestaDe, tramosDe, ultimosDiasDe, diasDe, videosDe, vistaVsl,
} from '../lib/vsl-diseno';
import { datosVslMuestra } from '../lib/vsl-diseno-muestra';

const leer = (r: string) => readFileSync(fileURLToPath(new URL(`../${r}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
const col = (ids: string[]) => ids.map((id) => ({ id, nombre: id, formato: 'numero' as const }));
const res = (ids: string[], totales: Array<number | null>, extra: Partial<Resultado> = {}): Resultado =>
  ({ columnas: col(ids), filas: [], totales, fuera: 0, clase: null, ...extra }) as Resultado;
const filas = (ids: string[], fs: Array<[string, ...Array<number | null>]>, extra: Partial<Resultado> = {}): Resultado =>
  res(ids, ids.map(() => null), { clase: 'categoria', filas: fs.map(([k, ...v]) => ({ clave: k, etiqueta: k, valores: v })), ...extra });
const HOY = '2026-11-06';
const dia = (n: number) => { const d = new Date(`${HOY}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const DIA = ['arrancaron', 'medidos', 'pasaron_25', 'pasaron_50', 'pasaron_75', 'llegaron_final'];
const hoja = () => instanciarPlantilla(PLANTILLAS_HOJA.find((p) => p.id === 'vsl-analyst')!);

test('cómo se escriben: un porcentaje chico con su decimal, uno grande redondo, y lo grande en corto', () => {
  assert.deepEqual([pct(6.42), pct(8), pct(22.6), pct(100)], ['6.4%', '8%', '23%', '100%']);
  assert.deepEqual([haceCuanto(HOY, HOY), haceCuanto(dia(1), HOY), haceCuanto(dia(4), HOY)], ['hoy', 'ayer', 'hace 4 días']);
});

test('le dieron play: los días en orden (el último es hoy), el total, y qué parte llega al final, a la mitad o se va antes', () => {
  const r = res(DIA, [300, 280, 170, 140, 90, 70], {
    clase: 'tiempo',
    filas: Array.from({ length: 40 }, (_, i) => ({ clave: dia(i), etiqueta: '', valores: [i === 2 ? 20 : 5, 5, 3, 2, 1, 1] })),
  });
  const p = playDe(r, null);
  assert.equal(p.dias.length, DIAS_PLAY, 'los últimos treinta días');
  assert.equal(p.dias[p.dias.length - 1].clave, HOY, 'del más viejo al de hoy');
  assert.equal(p.tope, 20, 'el día más alto es el tope de las barras');
  assert.equal(p.total, 300);
  assert.deepEqual(p.mezcla && [Math.round(p.mezcla.final), Math.round(p.mezcla.mitad), Math.round(p.mezcla.antes)], [25, 25, 50], 'sobre los medidos');
  assert.equal(Math.round(p.tasaFinal!), 25);
  assert.deepEqual([playDe(null, null).total, playDe(null, null).mezcla, playDe(null, null).dias], [null, null, []], 'lo que no llegó no es 0');
  assert.equal(playDe(null, res(['arrancaron'], [44])).total, 44, 'sin los días, el número de la apertura');
});

test('dónde se van: veinte cortes, el rayo de color donde más gente se va, y los seis tramos que más pierden', () => {
  const siguen = [90, 82, 75, 70, 66, 62, 58, 55, 52, 50, 48, 46, 38, 33, 31, 29, 27, 26, 25, 23];
  const r = filas(['siguen'], [...siguen.map((s, i) => [String((i + 1) * 5), s] as [string, number]).reverse(), ['7', 99]]);
  const c = curvaDe(r)!;
  assert.equal(c.cortes.length, 20);
  assert.deepEqual(c.cortes.map((x) => x.corte), Array.from({ length: 20 }, (_, i) => (i + 1) * 5), 'en orden, sin cortes que no son de a 5');
  assert.equal(c.cortes[0].caida, 10, 'el primer corte cae desde 100');
  assert.equal(c.cortes[c.fuga].corte, 5, 'el primer tramo es donde más se van (10 puntos)');
  const f = fugasDe(c)!;
  assert.equal(f.length, FUGAS);
  assert.deepEqual(f.slice(0, 2).map((x) => [x.desde, x.hasta, x.caida]), [[0, 5, 10], [5, 10, 8]], 'de la que más pierde a la que menos');
  assert.equal(f[0].ancho, 1);
  assert.ok(f.every((x, i) => i === 0 || x.caida <= f[i - 1].caida));
  assert.equal(largoRayo(0), 11);
  assert.ok(Math.abs(largoRayo(100) - 38) < 1e-9, 'el rayo más largo mide 38, como el de Pelago');
  const huecos = curvaDe(filas(['siguen'], [['5', 80], ['15', 60]]))!;
  assert.deepEqual([huecos.cortes[1].siguen, huecos.cortes[1].caida, huecos.cortes[2].caida], [null, null, null], 'un corte sin dato no inventa la caída');
  assert.deepEqual(fugasDe(huecos)!.map((x) => [x.desde, x.hasta]), [[0, 5]], 'ni una fuga donde no se sabe la caída');
  assert.equal(curvaDe(filas(['siguen'], [])), null);
});

test('¿los que más ven, más agendan?: los seis tramos en orden, los tres pisos de cada columna y el que más agenda', () => {
  const r = filas(['leads', 'agendas', 'cierres'], [['75-100%', 20, 10, 5], ['No lo vio', 50, 5, 1], ['0-25%', 30, 3, 0], ['(sin dato)', 9, 9, 9]]);
  const t = tramosDe(r)!;
  assert.deepEqual(t.tramos.map((x) => x.clave), [...TRAMOS_VISTO], 'de «No lo vio» a «75-100%», aunque falten tramos');
  assert.deepEqual(t.tramos.find((x) => x.clave === '25-50%'), { clave: '25-50%', nombre: 'Vio hasta la mitad', corto: '25-50%', leads: 0, agendas: 0, cierres: 0, tasa: null });
  assert.deepEqual([t.todos.leads, t.todos.agendas, t.todos.cierres], [100, 18, 6], 'sin lo que no es un tramo');
  assert.equal(t.mejor?.clave, '75-100%');
  assert.deepEqual(pilaDe({ leads: 20, agendas: 10, cierres: 5 }), { nada: 10, agendo: 5, compro: 5 });
  assert.deepEqual(pilaDe({ leads: 10, agendas: 1, cierres: 3 }), { nada: 7, agendo: 0, compro: 3 }, 'un cierre sin agenda es compra');
  assert.deepEqual(pilaDe({ leads: 2, agendas: 1, cierres: 5 }), { nada: 0, agendo: 0, compro: 2 }, 'la pila no pasa los leads del tramo');
  const resp = respuestaDe(t)!;
  assert.deepEqual([resp.mitad, resp.nada, resp.leadsMitad], [50, 10, 20], 'los que vieron más de la mitad contra los que no lo vieron');
  assert.deepEqual(contraTodos(t.tramos[5], t.todos), { texto: '+32 pts vs todos', bueno: true });
  assert.deepEqual(contraTodos(t.tramos[2], t.todos), { texto: '−8 pts vs todos', bueno: false });
  assert.equal(tramosDe(null), null);
});

test('tus videos y los últimos días: del más visto, sin «(sin dato)», y los días con play, del de hoy para atrás', () => {
  const v = videosDe(filas(['arrancaron', 'tasa_25', 'tasa_50', 'tasa_final'], [
    ['B', 50, 60, 40, 20], ['(sin dato)', 900, 1, 1, 1], ['A', 120, 70, 50, 30], ['Sin play', 0, null, null, null], ...Array.from({ length: 6 }, (_, i) => [`C${i}`, 10 - i, 50, 30, 10] as [string, ...number[]]),
  ], { fuera: 3 }))!;
  assert.equal(v.filas.length, VIDEOS);
  assert.deepEqual(v.filas.slice(0, 2).map((x) => [x.nombre, x.play, x.tFinal]), [['A', 120, 30], ['B', 50, 20]]);
  assert.equal(v.total, 8 + 3, 'los que tienen play, más los que el límite dejó afuera');
  const r = res(DIA, [], { clase: 'tiempo', filas: [0, 1, 2, 3, 4, 5, 6, 7].map((n) => ({ clave: dia(n), etiqueta: '', valores: [n === 3 ? 0 : 10, 8, 4, 2, 1, 1] })) });
  const u = ultimosDiasDe(diasDe(r));
  assert.equal(u.length, DIAS_TABLA);
  assert.equal(u[0].clave, HOY, 'el de hoy primero');
  assert.ok(!u.some((x) => x.clave === dia(3)), 'un día sin play no ocupa una fila');
  assert.deepEqual([u[0].t25, u[0].t50, u[0].tFinal], [50, 25, 12.5], 'sobre los medidos de ese día');
});

test('de cada 100: cinco partes que suman 100 sin redondear de más, y los tres números de abajo de «Le dieron play»', () => {
  const c = cienDe(res(DIA, [300, 200, 120, 90, 60, 50]))!;
  assert.deepEqual(c.trozos.map((t) => t.id), ['q1', 'q2', 'q3', 'q4', 'final']);
  assert.deepEqual(c.trozos.map((t) => t.valor), [40, 15, 15, 5, 25]);
  assert.equal(c.final, 25);
  assert.deepEqual(enteros([33.4, 33.3, 33.3]), [34, 33, 33], 'el resto mayor completa 100');
  assert.equal(enteros([12.5, 37.5, 25, 25]).reduce((a, b) => a + b, 0), 100);
  assert.equal(cienDe(res(DIA, [300, 0, 0, 0, 0, 0])), null, 'sin medidos no hay partes');
  const n = numerosDe(res(['vistas_vsl'], [14380]), res(['costo_vsl'], [0.21]), null);
  assert.deepEqual(n.map((x) => [x.id, x.texto]), [['vistas', '14.4k'], ['costo', n[1].texto], ['agendaron', null]]);
  assert.ok(n[1].texto?.includes('0.21'), 'el costo con sus centavos');
});

test('la hoja entera con la muestra: las cifras cierran entre tarjetas', () => {
  const h = hoja();
  const v = vistaVsl(h, datosVslMuestra(h, HOY));
  assert.equal(v.vacia, false);
  assert.equal(v.cargando, false);
  assert.equal(v.play.dias.reduce((a, d) => a + (d.play ?? 0), 0), v.play.total, 'los play de los días suman el número grande');
  assert.equal(v.videos!.filas.reduce((a, x) => a + x.play, 0), v.play.total, 'y los de los videos también');
  assert.equal(v.apertura.play, v.play.total, 'la cabecera dice lo mismo');
  assert.equal(v.play.dias[v.play.dias.length - 1].clave, HOY);
  assert.equal(v.curva!.cortes.length, 20);
  assert.equal(v.fugas!.length, FUGAS);
  assert.equal(v.cien!.trozos.length, 5);
  assert.ok(v.respuesta!.mitad! > v.respuesta!.nada!, 'en la muestra, los que más ven agendan más');
  assert.equal(v.ultimos.length, DIAS_TABLA);
  assert.ok(v.numeros.every((x) => x.texto));
});

test('sin play y sin leads, la hoja lo dice; leyendo o caída, cada tarjeta espera sin inventar', () => {
  const h = hoja(), p = h.diseno!.piezas;
  const nadie = { [p.apertura]: { resultado: res(['arrancaron', 'llegaron_final'], [0, 0]) }, [p.tramos]: { resultado: filas(['leads', 'agendas', 'cierres'], []) } };
  assert.equal(vistaVsl(h, nadie).vacia, true);
  assert.equal(vistaVsl(h, { [p.apertura]: { resultado: res(['arrancaron', 'llegaron_final'], [0, 0]) } }).vacia, false, 'sin saber de los leads no se declara vacía');
  const cargando = Object.fromEntries(Object.values(p).map((id) => [id, { cargando: true }]));
  const v = vistaVsl(h, cargando);
  assert.deepEqual([v.vacia, v.cargando, v.curva, v.tramos, v.play.total, v.cien], [false, true, null, null, null, null]);
  const caida = vistaVsl(h, Object.fromEntries(Object.values(p).map((id) => [id, { error: 'caída' }])));
  assert.deepEqual([caida.vacia, caida.numeros.map((x) => x.texto), caida.tasaFinal], [false, [null, null, null], null]);
  assert.equal(vistaVsl(h, { [p.ia]: { cargando: true } }).cargando, false, 'la caja de IA se lee aparte: no deja la hoja leyendo');
});

test('el cableado: la plantilla trae su diseño con sus diez piezas, se ofrece y el editor la dibuja mirando', () => {
  assert.ok((DISENOS_HOJA as readonly string[]).includes('vsl'));
  assert.ok(PLANTILLAS_OFRECIDAS.some((p) => p.id === 'vsl-analyst'));
  const h = hoja();
  const porId = new Map(h.componentes.map((c) => [c.id, c as { fuente?: string; metricas?: string[]; dimension?: string | null; tipo?: string }]));
  const pieza = (k: string) => porId.get(h.diseno!.piezas[k]);
  assert.equal(Object.keys(h.diseno!.piezas).length, 10);
  assert.ok(h.componentes.length <= 14, `${h.componentes.length} paneles (una hoja lleva hasta 14)`);
  for (const k of Object.keys(h.diseno!.piezas)) assert.ok(porId.has(h.diseno!.piezas[k]), `la pieza ${k} existe`);
  assert.deepEqual([pieza('dia')?.dimension, pieza('dia')?.metricas], ['dia', ['arrancaron', 'medidos', 'pasaron_25', 'pasaron_50', 'pasaron_75', 'llegaron_final']], 'los días traen todo lo de la curva (la hoja SANEADA)');
  assert.deepEqual([pieza('curva')?.dimension, pieza('curva')?.metricas], ['corte', ['siguen']]);
  assert.deepEqual([pieza('tramos')?.dimension, pieza('tramos')?.metricas], ['tramo_visto', ['leads', 'agendas', 'cierres']]);
  assert.equal(pieza('ia')?.tipo, 'ia', 'lo que escribió MaKo es la caja de IA de la hoja');
  const editor = leer('app/dashboard/EditorInforme.tsx');
  assert.ok(editor.includes("hoja.diseno?.id === 'vsl' && !enGrilla && !editando && !dueno"));
  assert.ok(editor.includes('<VslVivo'));
  assert.ok(leer('app/dashboard/disenos/DisenoEnMiniatura.tsx').includes('vistaVsl(hoja, datosVslMuestra(hoja, hoy))'));
  assert.match(leer('app/dashboard/disenos/HojaVsl.tsx'), /useCaja\(hoja\.id, compartido \|\| quieta \? undefined : p\.ia\)/, 'compartida o en miniatura no lee la caja de IA (pide sesión)');
});

// Probado rompiéndolo (6/11/2026), cada rotura sola y la base en verde antes y después (14 de 14):
//   · el rayo de color en la caída más chica: 1 fallo, 8 pases;
//   · los tramos al revés: 1 fallo, 8 pases;
//   · la pila sin tope en los leads: 1 fallo, 8 pases (con la primera versión del test daba 0: se sumó el caso);
//   · los días del de hoy al más viejo: 3 fallos, 6 pases;
//   · las partes sin completar 100: 1 fallo, 8 pases;
//   · la caja de IA dejando la hoja «leyendo»: 1 fallo, 8 pases;
//   · la hoja vacía sin saber de los leads: 1 fallo, 8 pases;
//   · una fuga donde no se sabe la caída: 1 fallo, 8 pases (también se sumó el caso);
//   · un corte sin dato que inventa su caída: 1 fallo, 8 pases;
//   · «(sin dato)» entre los videos: 1 fallo, 8 pases;
//   · el total de videos sin los que el límite dejó afuera: 1 fallo, 8 pases;
//   · un día sin play ocupando una fila: 1 fallo, 8 pases;
//   · compartida, leyendo la caja de IA: 1 fallo, 8 pases;
//   · los días de la plantilla sin el cuarto: 1 fallo, 8 pases.
