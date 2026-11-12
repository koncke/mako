// =============================================================================
// La hoja Contenido e IA con su DISEÑO PROPIO (la copia de Orrery): de dónde sale cada número (lib/contenido-diseno.ts)
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia… y después la adaptación con Maco» y «Después seguí con la segunda hoja, de a
// una». La hoja la dibuja app/dashboard/disenos/HojaContenido.tsx con lo que arma `vistaContenido` de las piezas de la hoja.
// Estos tests EJECUTAN esas funciones con datos armados aquí (ficticios) y miran lo que sale; sólo el último lee el fuente
// (el cableado).
//
// Probado rompiéndolo (4/11/2026), cada rotura sola y la base en verde antes: ver el pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Resultado } from '../lib/graficos-agregar';
import {
  CELDAS, celdasMalas, deltaCosto, dolares, flowDe, fraseContenido, gastoDe, listaDe, parteEnTexto, rotuloEjeDolares, rotulosDe, tarjetasDe, topeDe, vistaContenido,
} from '../lib/contenido-diseno';

test('la parte de una fila: «<1%» si es algo pero redondea a cero (11/11/2026: 1 llamada de 629 decía «0%»)', () => {
  assert.equal(parteEnTexto((1 / 629) * 100), '<1%');
  assert.equal(parteEnTexto(0), '0%', 'un cero de verdad es «0%»');
  assert.equal(parteEnTexto(24.3), '24%');
  assert.equal(parteEnTexto(0.5), '1%');
  assert.equal(parteEnTexto(null), null);
});
import { datosContenidoMuestra } from '../lib/contenido-diseno-muestra';
import { DISENOS_HOJA } from '../lib/graficos-catalogo';
import { PLANTILLAS_HOJA, PLANTILLAS_OFRECIDAS, instanciarPlantilla } from '../lib/graficos-plantillas';
import { cableadoDelDiseno } from './_diseno-cableado';

const leer = (r: string) => readFileSync(fileURLToPath(new URL(`../${r}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');

const col = (ids: string[]) => ids.map((id) => ({ id, nombre: id, formato: 'numero' as const }));
const res = (ids: string[], totales: Array<number | null>, extra: Partial<Resultado> = {}): Resultado =>
  ({ columnas: col(ids), filas: [], totales, fuera: 0, clase: null, ...extra }) as Resultado;
const filas = (ids: string[], totales: Array<number | null>, fs: Array<[string, ...Array<number | null>]>, extra: Partial<Resultado> = {}): Resultado =>
  res(ids, totales, { clase: 'categoria', filas: fs.map(([k, ...v]) => ({ clave: k, etiqueta: k, valores: v })), ...extra });
const texto = (t: Array<{ s: string }>) => t.map((x) => x.s).join('');
const HOY = '2026-11-04';

test('los dólares: centavos debajo de US$100, cuatro decimales debajo de 10 centavos', () => {
  assert.equal(dolares(52), 'US$52.00');
  assert.equal(dolares(1463.4), 'US$1,463');
  assert.equal(dolares(0.0061), 'US$0.0061', 'el costo por llamada no se redondea a cero');
  assert.equal(dolares(0), 'US$0.00');
  // 11/11/2026 (ws 3): 705 llamadas por US$0.0271 daban «US$0.0000» por llamada.
  assert.equal(dolares(0.0271 / 705), 'US$0.000038', 'una fracción de centavo no se redondea a cero');
  // Y el eje: con un tope de US$0.1 en tercios decía «US$0.1 · US$0 · US$0».
  assert.deepEqual([0.1, 0.1 * 2 / 3, 0.1 / 3, 0].map(rotuloEjeDolares), ['US$0.1', 'US$0.067', 'US$0.033', '0']);
  assert.deepEqual([3, 1.6667, 25].map(rotuloEjeDolares), ['US$3', 'US$1.7', 'US$25'], 'arriba de un dólar, como antes');
});

test('la frase: cuántas veces se usó la IA y cuánto cambió', () => {
  assert.equal(texto(fraseContenido(8570, 7652)), 'Usaste la IA 8,570 veces · 12% más que el período anterior.');
  assert.equal(texto(fraseContenido(1, null)), 'Usaste la IA 1 vez.');
  assert.equal(texto(fraseContenido(5, 5)), 'Usaste la IA 5 veces · igual que el período anterior.');
  assert.equal(texto(fraseContenido(0, 3)), 'No usaste la IA en este período.');
  assert.deepEqual(fraseContenido(null, 3), [], 'sin las llamadas no hay frase');
});

test('las tarjetas: gastar más es malo, y lo que no se midió es «—», nunca un cero', () => {
  assert.deepEqual(deltaCosto(52, 48.15), { texto: '+8%', bueno: false });
  assert.equal(deltaCosto(40, 50)?.bueno, true);
  assert.equal(deltaCosto(40, null), null);
  const t = tarjetasDe(res(['costo'], [52]), res(['costo_prom'], [0.0061]), res(['trabajos'], [134]), res(['tasa_exito'], [97.01]), { pedidos: 134, listos: 130, fallidos: 4, tasa: 97.01 });
  assert.deepEqual([t.costo.valor, t.prom.valor, t.exito.valor, t.pedidos.valor], ['US$52.00', 'US$0.0061', '97%', '134']);
  assert.equal(t.pedidos.fallidos, 4);
  const sin = tarjetasDe(null, res(['costo_prom'], [null]), res(['trabajos'], [0]), null, null);
  assert.equal(sin.costo.valor, null);
  assert.equal(sin.prom.valor, null);
  assert.equal(sin.pedidos.valor, '0', 'un cero medido es un dato');
  assert.equal(sin.exito.valor, null);
  assert.equal(sin.exito.barra, 0);
  assert.equal(tarjetasDe(null, null, null, res(['tasa_exito'], [130]), null).exito.barra, 1, 'la barra no pasa del 100%');
});

test('lo gastado por día: el tope redondo del eje, sus cuatro marcas y seis rótulos repartidos', () => {
  assert.equal(topeDe(2.8), 5);
  assert.equal(topeDe(100), 100);
  assert.equal(topeDe(101), 200);
  assert.equal(topeDe(0), 1, 'sin gasto, el eje no se divide por cero');
  assert.deepEqual(rotulosDe(30), [0, 6, 12, 17, 23, 29], 'el primero y el último siempre');
  assert.deepEqual(rotulosDe(4), [0, 1, 2, 3]);
  const r = res(['costo'], [3.5], { clase: 'tiempo', filas: [['2026-11-02', 1], ['2026-11-03', 2.8], ['2026-11-04', 0.7]].map(([k, v]) => ({ clave: String(k), etiqueta: String(k), valores: [Number(v)] })) });
  const g = gastoDe(r)!;
  assert.equal(g.total, 3.5);
  assert.equal(g.tope, 5);
  assert.deepEqual(g.marcas.map((m) => Math.round(m * 100) / 100), [5, 3.33, 1.67, 0]);
  assert.deepEqual(g.puntos.map((p) => p.valor), [1, 2.8, 0.7]);
  assert.equal(gastoDe(null), null);
});

test('videos e imágenes: las celdas en ámbar son la parte que falló, y «Bien» desde el 90%', () => {
  assert.deepEqual(celdasMalas(3, 46), [7, 22], 'dos celdas de treinta, repartidas');
  assert.deepEqual(celdasMalas(1, 88), [15], 'si falló algo, al menos una celda');
  assert.deepEqual(celdasMalas(0, 88), []);
  assert.equal(celdasMalas(46, 46).length, CELDAS);
  const f = flowDe(filas(['trabajos', 'listos', 'fallidos'], [70, 61, 9], [['Video', 50, 44, 6], ['Imagen', 20, 17, 3], ['(sin dato)', 0, 0, 0]]))!;
  assert.deepEqual(f.tipos.map((t) => [t.nombre, Math.round(t.tasa!), t.bien]), [['Video', 88, false], ['Imagen', 85, false]], 'la tasa sale de lo que salió bien sobre lo pedido');
  assert.equal(flowDe(filas(['trabajos', 'listos', 'fallidos', 'tasa_exito'], [10, 9, 1, 90], [['Video', 10, 9, 1, 90]]))!.tipos[0].bien, true);
  assert.equal(f.totales.pedidos, 70);
});

test('las listas: la parte es del TOTAL de la pieza, sin «(sin dato)» ni «Otros», y «más» cuenta lo que no vino', () => {
  const l = listaDe(filas(['costo'], [100], [['A', 40], ['(sin dato)', 10], ['B', 30], ['C', 10], ['D', 5], ['Otros', 5]], { fuera: 3 }), 'costo', 3)!;
  assert.deepEqual(l.filas.map((f) => [f.nombre, f.parte, f.tono]), [['A', 40, 1], ['B', 30, 2], ['C', 10, 3]]);
  assert.equal(l.mas, 1 + 3, 'la que no entra en la lista y las tres que la pieza no trajo');
  assert.equal(listaDe(null, 'costo', 3), null);
});

test('la hoja entera con la muestra: las cifras cierran entre bloques', () => {
  const h = instanciarPlantilla(PLANTILLAS_HOJA.find((p) => p.id === 'ia-contenido')!);
  assert.equal(h.diseno?.id, 'contenido');
  const v = vistaContenido(h, datosContenidoMuestra(h, HOY));
  assert.equal(texto(v.frase), 'Usaste la IA 8,570 veces · 12% más que el período anterior.');
  assert.equal(v.tarjetas.costo.valor, dolares(v.gasto!.total), 'el costo de la tarjeta es lo gastado por día');
  assert.equal(Math.round(v.tarjetas.costo.linea.reduce((a, x) => a + x, 0) * 100) / 100, v.gasto!.total);
  assert.equal(v.modelos!.filas.reduce((a, f) => a + f.valor, 0), v.gasto!.total, 'los modelos suman lo gastado');
  assert.equal(v.tarjetas.pedidos.valor, String(v.flow!.totales.pedidos), 'los pedidos de la tarjeta son los de la tabla de Flow');
  assert.equal(v.tarjetas.pedidos.linea.reduce((a, x) => a + x, 0), v.flow!.totales.pedidos, 'los de cada día suman los del período');
  assert.equal(v.tarjetas.exito.valor, `${Math.round((v.flow!.totales.listos / v.flow!.totales.pedidos) * 100)}%`);
  assert.equal(v.gasto?.paso, 'dia');
  assert.deepEqual(Object.keys(v.problemas), []);
});

test('lo que no se pudo leer se dice en su bloque, sin inventar', () => {
  const h = instanciarPlantilla(PLANTILLAS_HOJA.find((p) => p.id === 'ia-contenido')!);
  const datos = datosContenidoMuestra(h, HOY);
  datos[h.diseno!.piezas.modelos] = { error: 'caída' };
  datos[h.diseno!.piezas.costo] = { error: 'caída' };
  const v = vistaContenido(h, datos);
  assert.deepEqual(Object.keys(v.problemas).sort(), ['modelos', 'tarjetas']);
  assert.equal(v.modelos, null, 'sin la pieza no hay lista');
  assert.equal(v.tarjetas.costo.valor, null);
  assert.equal(v.tarjetas.prom.valor, 'US$0.0061', 'lo que sí se leyó sigue');
});

test('el cableado: el diseño se ofrece, se dibuja mirando y la página saluda', () => {
  assert.ok((DISENOS_HOJA as readonly string[]).includes('contenido'));
  assert.ok(PLANTILLAS_OFRECIDAS.some((p) => p.id === 'ia-contenido'));
  cableadoDelDiseno(instanciarPlantilla(PLANTILLAS_HOJA.find((p) => p.id === 'ia-contenido')!), 'contenido', 'ContenidoVivo', ['extras={extras?.contenido ?? null}', 'periodo={periodo}']);
  assert.match(leer('app/dashboard/EditorInforme.tsx'), /<BloqueDeDiseno[\s\S]{0,400}periodo=\{periodoDiseno\}/, 'el bloque lee con el período de la hoja');
  assert.ok(leer('app/dashboard/page.tsx').includes('contenido: hayDisenoContenido ? { quien } : null'));
  assert.ok(leer('app/dashboard/disenos/DisenoEnMiniatura.tsx').includes('vistaContenido(hoja, datosContenidoMuestra(hoja, hoy))'));
});

// Probado rompiéndolo (4/11/2026), cada rotura sola y la base en verde antes y después (13 de 13):
//   · sin los cuatro decimales debajo de 10 centavos: 3 fallos, 6 pases;
//   · gastar más contado como bueno: 1 fallo, 8 pases;
//   · un costo sin medir como US$0.00: 2 fallos, 7 pases;
//   · la barra de «Salieron bien» que pasa de 100%: 1 fallo, 8 pases;
//   · el tope del eje en cero sin gasto: 1 fallo, 8 pases;
//   · los rótulos del eje sin el último: 1 fallo, 8 pases;
//   · lo que falló poco sin celda ámbar: 1 fallo, 8 pases;
//   · «Bien» desde el 85%: 1 fallo, 8 pases;
//   · la parte sobre lo que se ve y no sobre el total: 1 fallo, 8 pases;
//   · «más» sin lo que la pieza no trajo: 1 fallo, 8 pases;
//   · «(sin dato)» como una fila: 2 fallos, 7 pases;
//   · la lista de modelos caída sin decirlo: 1 fallo, 8 pases;
//   · «1 veces»: 1 fallo, 8 pases.
