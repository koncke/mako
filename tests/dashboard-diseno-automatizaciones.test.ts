// =============================================================================
// La hoja Automatizaciones con su DISEÑO PROPIO (la copia de Noria): de dónde sale cada número (lib/automatizaciones-diseno.ts)
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia… y después la adaptación con Maco» y «Después seguí con la segunda hoja, de a
// una». La hoja la dibuja app/dashboard/disenos/HojaAutomatizaciones.tsx con lo que arma `vistaAutomatizaciones` de las piezas de
// la hoja. Estos tests EJECUTAN esas funciones con datos armados acá (ficticios) y miran lo que sale; sólo el último lee el fuente
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
  confiabilidadDe, exitoDe, fallosDe, flujosDe, fraseAutomatizaciones, horasDe, horasTexto, nivelDe, numerosDe, pulsoDe, recorridoDe, topeDos,
  vistaAutomatizaciones,
} from '../lib/automatizaciones-diseno';
import { datosAutomatizacionesMuestra } from '../lib/automatizaciones-diseno-muestra';
import { DISENOS_HOJA } from '../lib/graficos-catalogo';
import { PLANTILLAS_HOJA, PLANTILLAS_OFRECIDAS, instanciarPlantilla } from '../lib/graficos-plantillas';
import { cableadoDelDiseno } from './_diseno-cableado';

const leer = (r: string) => readFileSync(fileURLToPath(new URL(`../${r}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');

const HOY = '2026-11-04';
const col = (ids: string[]) => ids.map((id) => ({ id, nombre: id, formato: 'numero' as const }));
const res = (ids: string[], totales: Array<number | null>, extra: Partial<Resultado> = {}): Resultado =>
  ({ columnas: col(ids), filas: [], totales, fuera: 0, clase: null, ...extra }) as Resultado;
const cat = (ids: string[], filas: Array<[string, ...number[]]>, totales: Array<number | null> = [], extra: Partial<Resultado> = {}): Resultado =>
  res(ids, totales, { clase: 'categoria', filas: filas.map(([k, ...v]) => ({ clave: k, etiqueta: k, valores: v })), ...extra });
const texto = (t: Array<{ s: string }>) => t.map((x) => x.s).join('');
const dia = (hasta: string, atras: number) => { const d = new Date(`${hasta}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - atras); return d.toISOString().slice(0, 10); };
const dias = (ids: string[], n: number, hasta: string, f: (i: number) => number[], extra: Partial<Resultado> = {}): Resultado => res(ids, [], {
  clase: 'tiempo', filas: Array.from({ length: n }, (_, i) => ({ clave: dia(hasta, n - 1 - i), etiqueta: '', valores: f(i) })), ...extra,
});

test('la frase: lo que salió, lo que no y cuántas veces te respondieron', () => {
  assert.equal(texto(fraseAutomatizaciones(1240, 12, 84)), 'Salieron 1,240 mensajes. 12 no salieron y esperan que los mires. Te respondieron 84 veces.');
  assert.equal(texto(fraseAutomatizaciones(1, 1, 1)), 'Salieron 1 mensaje. 1 no salió y esperan que los mires. Te respondieron 1 vez.');
  assert.equal(texto(fraseAutomatizaciones(300, 0, 0)), 'Salieron 300 mensajes. Ninguno falló.');
  assert.equal(texto(fraseAutomatizaciones(0, 0, null)), 'Tus automatizaciones no mandaron nada en este período.');
  assert.deepEqual(fraseAutomatizaciones(null, 3, 2), [], 'sin lo que salió no hay frase');
});

test('los cuatro números: qué parte salió bien sale de lo que se INTENTÓ, y sus cambios en puntos', () => {
  const un = (v: number | null) => (v == null ? null : Math.round(v * 10) / 10);
  assert.equal(un(exitoDe(964, 36)), 96.4, 'salió sobre salió + falló: un borrador o una acción no cuentan');
  assert.equal(exitoDe(0, 0), null, 'sin intentos no hay porcentaje');
  assert.equal(exitoDe(null, 3), null);
  const n = numerosDe(
    res(['enviados', 'fallaron', 'respuestas'], [964, 36, 80], { anterior: [800, 20, 70] }),
    res(['tasa_respuesta'], [8.3], { anterior: [9.8] }),
    res(['personas'], [436], { anterior: [391] }),
    res(['personas', 'respondieron', 'en_curso'], [436, 97, 151]),
  );
  assert.deepEqual([n.mensajes.valor, n.mensajes.cambio.cambio, n.mensajes.cambio.sube], [964, '+21%', true]);
  // 964 / 1000 = 96.4 contra 800 / 820 = 97.56: bajó 1.2 puntos (no un porcentaje).
  assert.deepEqual([un(n.exito.valor), n.exito.cambio.cambio, n.exito.cambio.sube, n.exito.fallaron], [96.4, '−1.2 pt', false, 36]);
  assert.deepEqual([n.respuesta.valor, n.respuesta.cambio.cambio], [8.3, '−1.5 pt']);
  assert.deepEqual([n.entraron.valor, n.entraron.cambio.cambio, n.entraron.siguen], [436, '+12%', 151]);
  const nada = numerosDe(null, null, null, null);
  assert.deepEqual([nada.mensajes.valor, nada.exito.valor, nada.respuesta.valor, nada.entraron.valor, nada.entraron.siguen, nada.mensajes.cambio.cambio], [null, null, null, null, null, null]);
});

test('el pulso: lo que salió y lo que falló por día, hoy marcado, y la línea del mismo día una semana antes', () => {
  const r = dias(['enviados', 'fallaron'], 14, HOY, (i) => [10 + i, i % 5 === 0 ? 2 : 0]);
  const p = pulsoDe(r, HOY)!;
  assert.equal(p.paso, 'dia');
  assert.equal(p.columnas.length, 14);
  assert.deepEqual(p.columnas.map((c) => c.ahora), [...Array(13).fill(false), true]);
  // La línea: lo que se intentó (salió + falló) siete días antes; las primeras siete no tienen con qué.
  assert.deepEqual(p.columnas.slice(0, 7).map((c) => c.antes), Array(7).fill(null));
  assert.equal(p.columnas[7].antes, 10 + 2, 'el día 8 se compara con el 1 (10 salieron y 2 fallaron)');
  assert.equal(p.columnas[13].antes, 16, 'hoy, con el mismo día de la semana pasada');
  assert.equal(p.tope, 30, 'el eje redondo con dos pasos (0 · 15 · 30), como el 0 · 25 · 50 de Noria');
  assert.equal(p.linea, 'Hace una semana');
  // Por semanas, la línea es la columna anterior.
  const sem = pulsoDe(res(['enviados', 'fallaron'], [], { clase: 'tiempo', filas: [['2026-10-12', 5, 1], ['2026-10-19', 8, 0], ['2026-10-26', 4, 2]].map(([c, a, b]) => ({ clave: String(c), etiqueta: '', valores: [Number(a), Number(b)] })) }), HOY)!;
  assert.deepEqual([sem.paso, sem.linea, sem.columnas.map((c) => c.antes)], ['semana', 'La semana anterior', [null, 6, 8]]);
  assert.equal(pulsoDe(null, HOY), null);
  assert.equal(pulsoDe(res(['enviados'], [3]), HOY), null, 'un total sin días no es un pulso');
  assert.deepEqual([topeDos(0), topeDos(48), topeDos(50), topeDos(51), topeDos(130), topeDos(1300)], [2, 50, 50, 60, 150, 1500]);
});

test('el recorrido: cuatro pasos sobre los que entraron, en cuánto responden y cómo terminaron', () => {
  const rec = cat(['personas', 'respondieron', 'en_curso'], [['Terminó la secuencia', 168, 0, 0], ['Respondió', 71, 71, 0], ['(sin dato)', 4, 0, 0], ['Se dio de baja', 0, 0, 0]], [400, 100, 150]);
  const tabla = cat(['envios', 'fallaron', 'respuestas', 'tasa_respuesta', 'leads'], [['A', 10, 0, 1, 10, 9], ['B', 5, 1, 0, 0, 4]], [15, 1, 1, 6.7, 380], { fuera: 2 });
  const r = recorridoDe(rec, tabla, res(['horas_respuesta', 'respondieron'], [5.8, 100]));
  assert.deepEqual(r.pasos.map((x) => [x.id, x.n, x.pct]), [['entraron', 400, null], ['escritos', 380, 95], ['respondieron', 100, 25], ['siguen', 150, 37.5]]);
  assert.deepEqual([r.respondio, r.horas, r.automatizaciones], [25, 5.8, 4], 'las automatizaciones: las filas y las que no entraron (`fuera`)');
  assert.deepEqual(r.desenlaces.map((d) => [d.nombre, d.personas, d.pct, d.respondio]), [['Terminó la secuencia', 168, 42, false], ['Respondió', 71, 17.75, true]], 'sin el «sin dato» ni los vacíos');
  const nada = recorridoDe(null, null, null);
  assert.deepEqual([nada.pasos.map((x) => x.n), nada.horas, nada.automatizaciones, nada.desenlaces.length], [[null, null, null, null], null, null, 0]);
});

test('dónde falló: las que tienen fallos, sobre sus envíos, tres a la vista y cuántas más', () => {
  const tabla = cat(['envios', 'fallaron'], [['A', 300, 15], ['B', 400, 10], ['C', 80, 0]]);
  const f = fallosDe(cat(['fallaron'], [['A', 15], ['B', 10], ['C', 0], ['D', 4], ['E', 2], ['(sin dato)', 1]], [32], { fuera: 1 }), tabla);
  assert.equal(f.total, 32);
  assert.deepEqual(f.filas.map((x) => [x.nombre, x.fallaron, x.envios, x.pct]), [['A', 15, 300, 5], ['B', 10, 400, 2.5], ['D', 4, null, null]], 'C no falló: no está');
  assert.equal(f.mas, 2 + 1, 'las dos que no se ven y la que el gráfico dejó afuera');
  assert.deepEqual([fallosDe(null, null).total, fallosDe(null, null).filas.length], [null, 0]);
});

test('qué tan bien salen: 14 días por automatización, de los envíos y los fallos, sin inventar un «sin fallas»', () => {
  const claves = ['Bienvenida', 'Cobranza'];
  const vol = dias(['envios'], 20, HOY, () => [0], { cruce: { claves, celdas: Array.from({ length: 20 }, (_, i) => [100, i % 2 ? 50 : 0]) } });
  // Los fallos: Bienvenida falló 1 de 100 el último día; Cobranza no está entre sus columnas y el cruce no tiene «Otros».
  const fal = dias(['fallaron'], 20, HOY, () => [0], { cruce: { claves: ['Bienvenida'], celdas: Array.from({ length: 20 }, (_, i) => [i === 19 ? 1 : 0]) } });
  const c = confiabilidadDe(vol, fal, HOY);
  assert.deepEqual(c.map((x) => x.nombre), claves, 'las que más mandan primero (el orden del cruce de los envíos)');
  assert.equal(c[0].dias.length, 14);
  assert.equal(c[0].dias[13].dia, HOY);
  assert.deepEqual([c[0].dias[13].nivel, c[0].dias[12].nivel], [2, 1], '99 % es «98 %+», 100 % es «99.5 %+»');
  assert.equal(c[0].pct, 100 - (1 / 1400) * 100);
  assert.deepEqual(c[1].dias.slice(-2).map((d) => [d.envios, d.fallaron, d.nivel]), [[0, 0, 0], [50, 0, 1]], 'un día sin envíos es gris; sin estar en los fallos y sin «Otros», no falló');
  // Con «Otros» en los fallos no se sabe: la casilla queda gris y no hay porcentaje.
  const conOtros = confiabilidadDe(vol, { ...fal, cruce: { claves: ['Bienvenida', 'Otros'], celdas: fal.cruce!.celdas.map((f) => [...f, 3]) } }, HOY);
  assert.deepEqual([conOtros[1].pct, conOtros[1].dias[13].nivel, conOtros[1].dias[13].fallaron], [null, 0, null]);
  assert.deepEqual([nivelDe(99.5), nivelDe(98), nivelDe(95), nivelDe(94.9), nivelDe(null)], [1, 2, 3, 4, 0]);
  assert.deepEqual(confiabilidadDe(null, fal, HOY), []);
});

test('las que más mandan y en cuántas horas responden: de la tabla, con sus 14 días y sin «Otros»', () => {
  const tabla = cat(['envios', 'fallaron', 'respuestas', 'tasa_respuesta', 'leads'], [['Bienvenida Nueva', 200, 4, 30, 15, 180], ['(sin dato)', 10, 0, 0, 0, 9], ['Otros', 50, 1, 2, 4, 40]]);
  const f = flujosDe(tabla, [{ clave: 'Bienvenida Nueva', nombre: 'Bienvenida Nueva', dias: [], pct: 98, envios: [1, 2, 3] }]);
  assert.deepEqual(f.map((x) => [x.nombre, x.iniciales, x.envios, x.exito, x.dias]), [['Bienvenida Nueva', 'BN', 200, 98, [1, 2, 3]], ['Sin automatización', '—', 10, 100, null]]);
  const h = horasDe(cat(['horas_respuesta', 'respondieron'], [['Lenta', 20, 3], ['Sin dato', null as unknown as number, 2], ['Rápida', 0.5, 9], ['Otros', 4, 1]]));
  assert.deepEqual(h.map((x) => [x.nombre, x.horas, x.respondieron]), [['Lenta', 20, 3], ['Rápida', 0.5, 9]], 'sin la que no tiene horas ni «Otros»');
  assert.deepEqual([horasTexto(0.5), horasTexto(5.83), horasTexto(20), horasTexto(72), horasTexto(null)], ['menos de 1 h', '5.8 h', '20 h', '3.0 días', null]);
});

test('la plantilla trae el diseño, la muestra pasa por el mismo modelo, y el editor lo dibuja', () => {
  assert.ok((DISENOS_HOJA as readonly string[]).includes('automatizaciones'));
  const pl = PLANTILLAS_HOJA.find((x) => x.id === 'automatizaciones')!;
  assert.ok(PLANTILLAS_OFRECIDAS.some((x) => x.id === 'automatizaciones'), '«Nueva hoja» la ofrece: ya trae su diseño copiado');
  const h = instanciarPlantilla(pl);
  assert.equal(h.diseno?.id, 'automatizaciones');
  const pieza = (k: string) => h.componentes.find((c) => c.id === h.diseno!.piezas[k]) as { metricas?: string[]; comparar?: boolean; fuente?: string; dimension?: string; desglose?: string } | undefined;
  for (const k of ['apertura', 'entraron', 'respuesta', 'dias', 'tabla', 'recorrido', 'fallos', 'horas', 'vol', 'fal']) assert.ok(pieza(k), `la pieza ${k}`);
  for (const k of ['apertura', 'entraron', 'respuesta']) assert.equal(pieza(k)?.comparar, true, `${k} se compara con el período anterior`);
  assert.deepEqual(pieza('dias')?.metricas, ['enviados', 'fallaron']);
  assert.deepEqual(pieza('recorrido')?.metricas, ['personas', 'respondieron', 'en_curso']);
  assert.ok(pieza('tabla')?.metricas?.includes('leads'), 'les escribió MaKo: los leads distintos');
  for (const k of ['vol', 'fal']) assert.deepEqual([pieza(k)?.fuente, pieza(k)?.dimension, pieza(k)?.desglose], ['envios', 'dia', 'automatizacion']);
  assert.deepEqual([pieza('vol')?.metricas, pieza('fal')?.metricas], [['envios'], ['fallaron']]);
  // La muestra (la miniatura de «Nueva hoja») arma la vista entera con el modelo de verdad, y lo que dice cada tarjeta cuadra.
  const v = vistaAutomatizaciones(h, datosAutomatizacionesMuestra(h, HOY), HOY);
  assert.match(texto(v.frase), /^Salieron [\d,]+ mensajes\. [\d,]+ no salieron y esperan que los mires\. Te respondieron [\d,]+ veces\.$/);
  assert.equal(v.pulso?.columnas.length, 30);
  assert.equal(v.pulso?.columnas.reduce((a, c) => a + c.fallaron, 0), v.fallos.total, 'lo que falló por día suma lo que falló');
  const tabla = datosAutomatizacionesMuestra(h, HOY)[h.diseno!.piezas.tabla]!.resultado!;
  assert.equal(tabla.filas.reduce((a, f) => a + (f.valores[1] ?? 0), 0), v.fallos.total, 'y lo que falló por automatización también');
  assert.equal(v.flujos.length, 6, 'la tabla muestra seis');
  assert.equal(v.confiabilidad.length, 7);
  assert.ok(v.flujos.every((f) => f.dias?.length === 14), 'cada fila de la tabla tiene sus 14 días');
  assert.deepEqual(Object.keys(v.problemas), []);
  cableadoDelDiseno(h, 'automatizaciones', 'AutomatizacionesVivo', ['extras={extras?.automatizaciones ?? null}']);
  assert.ok(leer('app/dashboard/page.tsx').includes('automatizaciones: hayDisenoAutomatizaciones ? { quien } : null'));
});

// Probado rompiéndolo (4/11/2026), cada rotura sola y la base en verde antes y después (8 de 8):
//   · qué parte salió bien sobre lo que salió y no sobre lo intentado: 1 fallo, 7 pases;
//   · la línea dorada seis días antes y no siete: 1 fallo, 7 pases;
//   · un «sin fallas» inventado aunque el cruce de los fallos tenga «Otros»: 1 fallo, 7 pases;
//   · «cuántas más» sin las que el gráfico dejó afuera: 1 fallo, 7 pases;
//   · el «sin dato» entre los desenlaces: 1 fallo, 7 pases;
//   · un número que no llegó como 0: 2 fallos, 6 pases;
//   · el cambio de «salieron bien» en % y no en puntos: 1 fallo, 7 pases;
//   · «Otros» como una automatización en la tabla: 1 fallo, 7 pases.
