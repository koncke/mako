// =============================================================================
// La hoja Productividad con su DISEÑO PROPIO (la copia de Fernly): de dónde sale cada número (lib/productividad-diseno.ts)
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia… y después la adaptación con Maco» y «Después seguí con la segunda hoja, de a
// una». La hoja la dibuja app/dashboard/disenos/HojaProductividad.tsx con lo que arma `vistaProductividad` de las piezas de la
// hoja. Estos tests EJECUTAN esas funciones con datos armados acá (ficticios) y miran lo que sale; sólo el último lee el fuente
// (el cableado).
//
// Probado rompiéndolo (4/11/2026), cada rotura sola y la base en verde antes: ver el pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Resultado } from '../lib/graficos-agregar';
import { ALTO_MAX, arcoDe, columnasDe, estadoQuieta, fraseProductividad, prioridadesDe, proyectosDe, quietasDe, tarjetasDe, textoQuieta, vistaProductividad } from '../lib/productividad-diseno';
import { datosProductividadMuestra } from '../lib/productividad-diseno-muestra';
import { DISENOS_HOJA } from '../lib/graficos-catalogo';
import { PLANTILLAS_HOJA, PLANTILLAS_OFRECIDAS, instanciarPlantilla } from '../lib/graficos-plantillas';

const leer = (r: string) => readFileSync(fileURLToPath(new URL(`../${r}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');

const col = (ids: string[]) => ids.map((id) => ({ id, nombre: id, formato: 'numero' as const }));
const res = (ids: string[], totales: Array<number | null>, extra: Partial<Resultado> = {}): Resultado =>
  ({ columnas: col(ids), filas: [], totales, fuera: 0, clase: null, ...extra }) as Resultado;
const filas = (ids: string[], fs: Array<[string, ...Array<number | null>]>, extra: Partial<Resultado> = {}): Resultado =>
  res(ids, [], { clase: 'categoria', filas: fs.map(([k, ...v]) => ({ clave: k, etiqueta: k, valores: v })), ...extra });
const texto = (t: Array<{ s: string }>) => t.map((x) => x.s).join('');
const HOY = '2026-11-04'; // miércoles: su semana arranca el lunes 2

test('la frase: cuántas activas, cuántas en curso y cuántas hechas', () => {
  assert.equal(texto(fraseProductividad(34, 8, 23)), 'Tienes 34 tareas activas: 8 en curso. Ya hiciste 23.');
  assert.equal(texto(fraseProductividad(1, 0, 0)), 'Tienes 1 tarea activa.');
  assert.equal(texto(fraseProductividad(0, 0, 5)), 'No tienes tareas activas. Ya hiciste 5.');
  assert.equal(texto(fraseProductividad(0, 0, 0)), 'Todavía no hay tareas en tu Plan.');
  assert.deepEqual(fraseProductividad(null, 3, 4), [], 'sin las activas no hay frase');
});

test('las cuatro tarjetas: un % que no se pudo medir es «—», nunca un cero', () => {
  const t = tarjetasDe(41.6, 4, 3, 78.2);
  assert.deepEqual(t.map((x) => [x.id, x.valor]), [['avance', '42%'], ['estancadas', '4'], ['alta', '3'], ['tiempo', '78%']]);
  const sin = tarjetasDe(null, 0, null, null);
  assert.equal(sin[0].valor, null);
  assert.equal(sin[1].valor, '0', 'un cero medido es un dato');
  assert.equal(sin[3].valor, null, 'sin tareas cerradas con deadline el % no existe');
  assert.match(sin[3].sub, /Todavía/);
  assert.equal(sin[3].ok, false);
  assert.equal(tarjetasDe(130, 0, 0, 100)[0].valor, '100%', 'un % no pasa de 100');
});

test('lo que vence: esta semana oscura, las que tienen algo verdes, las vacías rayadas y la marca sobre la más alta', () => {
  const r = res(['abiertas'], [18], { clase: 'tiempo', filas: [['2026-11-02', 6], ['2026-11-09', 9], ['2026-11-16', 0], ['2026-11-23', 3]].map(([k, n]) => ({ clave: String(k), etiqueta: String(k), valores: [Number(n)] })) });
  const c = columnasDe(r, HOY)!;
  assert.deepEqual(c.map((x) => x.tono), ['semana', 'lleno', 'vacio', 'lleno']);
  assert.deepEqual(c.map((x) => x.rotulo), ['2 nov', '9 nov', '16 nov', '23 nov']);
  assert.deepEqual(c.map((x) => x.tope), [false, true, false, false]);
  assert.equal(c[1].alto, ALTO_MAX, 'la más alta llega al tope que deja lugar para su marca');
  assert.ok(c[3].alto > c[2].alto, 'una con algo es más alta que una vacía');
  assert.ok(c[0].alto > c[3].alto && c[0].alto < ALTO_MAX, 'la altura sigue al número');
  assert.equal(columnasDe(null, HOY), null);
  const vacias = columnasDe(res(['abiertas'], [0], { clase: 'tiempo', filas: [{ clave: '2026-11-02', etiqueta: 'x', valores: [0] }] }), HOY)!;
  assert.equal(vacias[0].tope, false, 'sin nada que venza no hay marca');
});

test('lo que huele mal: de la más quieta a la menos, con su estado por los umbrales del Plan', () => {
  assert.equal(estadoQuieta(19, 1), 'quieta');
  assert.equal(estadoQuieta(3, 2), 'se-corre', 'dos o más movidas del deadline');
  assert.equal(estadoQuieta(7, 0), 'al-dia', 'siete días todavía no es estancada (es «más de 7»)');
  assert.equal(estadoQuieta(null, null), 'al-dia');
  assert.equal(textoQuieta(12), 'Sin tocar hace 12 días');
  assert.equal(textoQuieta(1), 'Sin tocar hace 1 día');
  assert.equal(textoQuieta(0), 'Se tocó hoy');
  const q = quietasDe(filas(['dias_quieta', 'movidas_deadline', 'activas'], [['Grabar los testimonios', 14, 3, 1], ['(sin dato)', 4, 0, 1], ['Cotizar el hosting', 6, 0, 1]], { fuera: 5 }))!;
  assert.deepEqual(q.lista.map((x) => [x.tarea, x.estado, x.iniciales]), [['Grabar los testimonios', 'se-corre', 'GT'], ['Cotizar el hosting', 'al-dia', 'CH']]);
  assert.equal(q.fuera, 5);
});

test('los proyectos: los primeros cinco con su avance y cuántos más hay', () => {
  const p = proyectosDe(filas(['avance_proyectos'], [['A', 90], ['B', 70], ['C', 50], ['D', 30], ['E', 20], ['F', 10], ['G', null]], { fuera: 2 }))!;
  assert.deepEqual(p.lista.map((x) => x.nombre), ['A', 'B', 'C', 'D', 'E']);
  assert.equal(p.mas, 4, 'los dos que no entran en la lista y los dos que la pieza no trajo');
  assert.equal(proyectosDe(null), null);
});

test('el medio arco: hechas, en curso y por empezar, sobre todas las tareas', () => {
  const a = arcoDe(34, 8, 23)!;
  assert.deepEqual([a.total, a.hechas, a.enCurso, a.porEmpezar], [57, 23, 8, 26]);
  assert.equal(Math.round(a.pctHechas), 40);
  assert.equal(arcoDe(5, 9, 0)!.porEmpezar, 0, 'en curso no pasa de las activas');
  assert.equal(arcoDe(0, 0, 0), null);
  assert.equal(arcoDe(null, 1, 2), null);
});

test('la prioridad: Alta, Media y Baja siempre, y «A futuro» aparte', () => {
  const p = prioridadesDe(filas(['activas'], [['Media', 14], ['Alta', 9], ['A futuro', 3]]))!;
  assert.deepEqual(p.tres.map((x) => [x.nombre, x.n]), [['Alta', 9], ['Media', 14], ['Baja', 0]]);
  assert.equal(p.futuro, 3);
});

test('la hoja entera con la muestra: las cifras cierran entre tarjetas', () => {
  const h = instanciarPlantilla(PLANTILLAS_HOJA.find((p) => p.id === 'productividad')!);
  assert.equal(h.diseno?.id, 'productividad');
  const v = vistaProductividad(h, datosProductividadMuestra(h, HOY), HOY);
  assert.equal(texto(v.frase), 'Tienes 34 tareas activas: 8 en curso. Ya hiciste 23.');
  assert.equal(v.arco?.total, 34 + 23);
  assert.equal(v.prioridades!.tres.reduce((a, x) => a + x.n, 0) + v.prioridades!.futuro, 34, 'la prioridad cuenta las mismas activas que la frase');
  const estancadas = v.quietas!.lista.filter((q) => (q.dias ?? 0) > 7).length;
  assert.equal(v.tarjetas.find((t) => t.id === 'estancadas')?.valor, String(estancadas), 'las estancadas son las quietas de más de 7 días');
  assert.equal(v.columnas?.[0].tono, 'semana');
  assert.deepEqual(Object.keys(v.problemas), []);
});

test('lo que no se pudo leer se dice en su bloque, sin inventar', () => {
  const h = instanciarPlantilla(PLANTILLAS_HOJA.find((p) => p.id === 'productividad')!);
  const datos = datosProductividadMuestra(h, HOY);
  datos[h.diseno!.piezas.huele] = { error: 'caída' };
  datos[h.diseno!.piezas.cumplimiento] = { error: 'caída' };
  const v = vistaProductividad(h, datos, HOY);
  assert.deepEqual(Object.keys(v.problemas).sort(), ['quietas', 'tarjetas']);
  assert.equal(v.quietas, null, 'sin la pieza no hay lista');
  assert.equal(v.tarjetas.find((t) => t.id === 'tiempo')?.valor, null);
});

test('el cableado: el diseño se ofrece, se dibuja mirando y la página saluda', () => {
  assert.ok((DISENOS_HOJA as readonly string[]).includes('productividad'));
  assert.ok(PLANTILLAS_OFRECIDAS.some((p) => p.id === 'productividad'));
  const editor = leer('app/dashboard/EditorInforme.tsx');
  assert.ok(editor.includes("hoja.diseno?.id === 'productividad' && !enGrilla && !editando && !dueno"));
  assert.ok(editor.includes('extras={disenos?.productividad ?? null}'));
  assert.ok(leer('app/dashboard/page.tsx').includes('productividad: hayDisenoProductividad ? { quien } : null'));
  assert.ok(leer('app/dashboard/disenos/DisenoEnMiniatura.tsx').includes('vistaProductividad(hoja, datosProductividadMuestra(hoja, hoy), hoy)'));
});

// Probado rompiéndolo (4/11/2026), cada rotura sola y la base en verde antes y después (10 de 10):
//   · «en curso» sin tope de las activas: 1 fallo, 9 pases;
//   · un % que pasa de 100: 1 fallo, 9 pases;
//   · «A tiempo» sin medir como 0%: 2 fallos, 8 pases;
//   · la marca sobre la última columna y no sobre la más alta: 1 fallo, 9 pases;
//   · una semana vacía como llena: 1 fallo, 9 pases;
//   · siete días quieta como estancada (es «más de 7»): 1 fallo, 9 pases;
//   · «(sin dato)» como una tarea: 1 fallo, 9 pases;
//   · «N más» sin lo que la pieza no trajo: 1 fallo, 9 pases;
//   · una prioridad en cero que se esconde: 1 fallo, 9 pases;
//   · la lista caída sin decirlo: 1 fallo, 9 pases.
