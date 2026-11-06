// =============================================================================
// La hoja Landing con su DISEÑO PROPIO (la copia de Corbel): de dónde sale cada número (lib/landing-diseno.ts)
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia… y después la adaptación con Maco» y «Después seguí con la segunda hoja, de a
// una». La hoja la dibuja app/dashboard/disenos/HojaLanding.tsx con lo que arma `vistaLanding` de las piezas de la hoja. Estos
// tests EJECUTAN esas funciones con datos armados acá (ficticios) y miran lo que sale, más el día y la franja de una visita en la
// zona del negocio (lib/visitas-momento.ts); sólo el último lee el fuente (el cableado).
//
// Probado rompiéndolo (4/11/2026), cada rotura sola y la base en verde antes: ver el pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Resultado } from '../lib/graficos-agregar';
import {
  columnasDe, cuandoDe, escalaColumnas, fraseLanding, origenDe, pct, puntajeDe, tilesDe, tonoDe, vistaLanding,
} from '../lib/landing-diseno';
import { datosLandingMuestra } from '../lib/landing-diseno-muestra';
import { DIAS_SEMANA, FRANJAS_HORA, momentoDeVisita } from '../lib/visitas-momento';
import { DISENOS_HOJA, fuenteDe } from '../lib/graficos-catalogo';
import { PLANTILLAS_HOJA, PLANTILLAS_OFRECIDAS, instanciarPlantilla } from '../lib/graficos-plantillas';
import { cableadoDelDiseno } from './_diseno-cableado';

const leer = (r: string) => readFileSync(fileURLToPath(new URL(`../${r}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');

const HOY = '2026-11-04';
const col = (ids: string[]) => ids.map((id) => ({ id, nombre: id, formato: 'numero' as const }));
const res = (ids: string[], totales: Array<number | null>, extra: Partial<Resultado> = {}): Resultado =>
  ({ columnas: col(ids), filas: [], totales, fuera: 0, clase: null, ...extra }) as Resultado;
const texto = (t: Array<{ s: string }>) => t.map((x) => x.s).join('');
const dias = (n: number, hasta: string, f: (i: number) => [number, number]): Resultado => res(['visitas', 'visitantes'], [], {
  clase: 'tiempo',
  filas: Array.from({ length: n }, (_, i) => {
    const d = new Date(`${hasta}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - (n - 1 - i));
    return { clave: d.toISOString().slice(0, 10), etiqueta: '', valores: f(i) };
  }),
});

test('el día y la franja de una visita salen con la zona del NEGOCIO', () => {
  // Martes 3/11/2026 a las 15:30 UTC: en Ciudad de México son las 9:30 (martes, de 8 a 12); en Buenos Aires, las 12:30.
  assert.deepEqual(momentoDeVisita('2026-11-03T15:30:00Z', 'America/Mexico_City'), { dia: 'Martes', franja: '8 a 12 h' });
  assert.deepEqual(momentoDeVisita('2026-11-03T15:30:00Z', 'America/Argentina/Buenos_Aires'), { dia: 'Martes', franja: '12 a 16 h' });
  // Pasada la medianoche en la zona del negocio ya es otro día, aunque en UTC no.
  assert.deepEqual(momentoDeVisita('2026-11-03T03:30:00Z', 'America/Mexico_City'), { dia: 'Lunes', franja: '16 a 24 h' });
  assert.deepEqual(momentoDeVisita('2026-11-03T07:59:00Z', 'Europe/Madrid'), { dia: 'Martes', franja: '8 a 12 h' });
  assert.equal(momentoDeVisita('no es una fecha', 'America/Mexico_City'), null);
  assert.equal(momentoDeVisita('2026-11-03T15:30:00Z', 'Zona/Inexistente'), null, 'una zona que no existe no inventa una franja');
  // La fuente las ofrece con su orden fijo (lunes primero; la madrugada arriba).
  const f = fuenteDe('visitas')!;
  assert.deepEqual(f.dimensiones.find((d) => d.id === 'dia_semana')?.valores, DIAS_SEMANA);
  assert.deepEqual(f.dimensiones.find((d) => d.id === 'franja')?.valores, FRANJAS_HORA);
});

test('la frase: cuántas visitas, de cuántas personas y contra el período anterior; sin «0» inventados', () => {
  assert.equal(texto(fraseLanding(1341, 1059, 1197)), 'Entraron 1,341 visitas de 1,059 personas, 12% más que el período anterior.');
  assert.equal(texto(fraseLanding(900, null, 1000)), 'Entraron 900 visitas, 10% menos que el período anterior.');
  assert.equal(texto(fraseLanding(1, 1, null)), 'Entraron 1 visita de 1 persona.');
  assert.equal(texto(fraseLanding(0, 0, 10)), 'No entró nadie a tus páginas en este período.');
  assert.deepEqual(fraseLanding(null, null, null), []);
});

test('los cuatro números: su cambio en su unidad, su dibujo chico y nada inventado', () => {
  const cols = columnasDe(dias(5, HOY, (i) => [[10, 20, 30, 40, 50][i], 8]), HOY);
  const mitad = res(['pct_50'], [51.2], { anterior: [48.9], serie: [44, 46, 48, 50, 52, 51, 53, 54, 55].map((valor, i) => ({ clave: String(i), etiqueta: '', valor })) });
  const final = res(['pct_100'], [18.4], { anterior: [19.1] });
  const scroll = res(['medidos', 'llegaron_50', 'llegaron_100'], [968, 496, 178]);
  const tocan = res(['personas'], [264], { anterior: [231], serie: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0, 12].map((valor, i) => ({ clave: String(i), etiqueta: '', valor })) });
  const [v, m, f, t] = tilesDe(res(['visitas', 'visitantes'], [1341, 1059], { anterior: [1197, 960] }), cols, mitad, final, scroll, tocan);
  assert.deepEqual([v.texto, v.cambio, v.sube], ['1,341', '+12%', true]);
  assert.deepEqual(v.barras, [0.6, 0.8, 1], 'las últimas tres columnas, contra la más alta');
  assert.deepEqual([m.texto, m.cambio, m.sube], ['51%', '+2.3 pt', true], 'el porcentaje cambia en PUNTOS');
  assert.equal(m.linea?.length, 9);
  assert.deepEqual([m.linea?.[0], m.linea?.[8]], [0, 1], 'la línea va del mínimo al máximo');
  assert.deepEqual([f.texto, f.cambio, f.sube], ['18%', '−0.7 pt', false]);
  assert.equal(f.anillo, 36, 'el anillo: de los 496 que llegan a la mitad, 178 llegan al final');
  assert.deepEqual([t.texto, t.cambio], ['264', '+14%']);
  assert.equal(t.finas?.length, 10, 'las barras finas: los últimos diez días');
  // Lo que no llegó es null: ni un «0» ni un cambio ni un dibujo.
  const [nv, nm, nf, nt] = tilesDe(null, null, null, null, null, null);
  for (const x of [nv, nm, nf, nt]) assert.deepEqual([x.valor, x.texto, x.cambio], [null, null, null], x.id);
  assert.equal(nv.barras, null);
  assert.equal(nf.anillo, null, 'sin los que llegan a la mitad no hay anillo');
  assert.equal(pct(4.83), '4.8%', 'debajo de 10, con un decimal');
  assert.equal(pct(51.2), '51%');
});

test('el medidor: el puntaje con su veredicto en palabras y el porqué (la página más floja y la mejor)', () => {
  const diag = res(['puntaje'], [72], { clase: 'categoria', filas: [{ clave: 'a', etiqueta: '/clase-gratis', valores: [81] }, { clave: 'b', etiqueta: '/vsl', valores: [64] }, { clave: 'c', etiqueta: '(sin dato)', valores: [10] }] });
  const p = puntajeDe(res(['puntaje'], [72.4]), diag);
  assert.deepEqual([p.valor, p.veredicto, p.analizada], [72, 'Se puede mejorar', true]);
  assert.equal(p.porque, 'La más floja es /vsl (64 de 100); la mejor, /clase-gratis (81).', 'sin la fila «(sin dato)»');
  assert.equal(puntajeDe(res(['puntaje'], [85]), null).veredicto, 'Bien armada');
  assert.equal(puntajeDe(res(['puntaje'], [41]), null).veredicto, 'Hay que arreglarla');
  const una = res(['puntaje'], [60], { clase: 'categoria', filas: [{ clave: 'a', etiqueta: '/vsl', valores: [60] }] });
  assert.equal(puntajeDe(res(['puntaje'], [60]), una).porque, 'Es el diagnóstico de /vsl.');
  // Sin diagnóstico no se inventa un puntaje: se dice que falta.
  const nada = puntajeDe(res(['puntaje'], [null]), null);
  assert.deepEqual([nada.valor, nada.analizada, nada.porque], [null, false, 'MaKo todavía no analizó tu página.']);
});

test('las columnas: las últimas doce, la de hoy marcada y el eje en números redondos', () => {
  const c = columnasDe(dias(30, HOY, (i) => [i + 1, i]), HOY)!;
  assert.equal(c.columnas.length, 12, 'se ven las últimas doce');
  assert.equal(c.fuera, 18);
  assert.deepEqual(c.columnas.map((x) => x.ahora), [...Array(11).fill(false), true], 'sólo la de hoy');
  assert.deepEqual([c.columnas[11].dia, c.columnas[11].mes, c.columnas[11].visitas, c.columnas[11].personas], ['4', 'nov', 30, 29]);
  // Un período que no llega a hoy no marca ninguna.
  assert.ok(!columnasDe(dias(10, '2026-10-20', () => [1, 1]), HOY)!.columnas.some((x) => x.ahora));
  assert.deepEqual(escalaColumnas(47), { tope: 60, paso: 15 }, 'como los 15k de Corbel');
  assert.deepEqual(escalaColumnas(64), { tope: 80, paso: 20 });
  assert.deepEqual(escalaColumnas(342300), { tope: 400000, paso: 100000 });
  assert.equal(columnasDe(null, HOY), null);
  assert.equal(columnasDe(res(['visitas'], [3], { clase: 'categoria', filas: [{ clave: 'x', etiqueta: 'x', valores: [3] }] }), HOY), null, 'sin días no hay columnas');
});

test('cuándo entran: la grilla de franjas × días en su orden, con cinco tonos', () => {
  // El cruce llega con las columnas en el orden del agregador y los nombres en su forma de clave: se ubican por el nombre.
  const r = res(['visitas'], [100], {
    clase: 'categoria',
    filas: [{ clave: '8 a 12 h', etiqueta: '8 a 12 h', valores: [60] }, { clave: '0 a 8 h', etiqueta: '0 a 8 h', valores: [40] }],
    cruce: { claves: ['Domingo', 'Lunes', 'Miércoles'], celdas: [[30, 20, 10], [0, 40, null]] },
  });
  const c = cuandoDe(r)!;
  assert.deepEqual(c.dias, ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']);
  assert.deepEqual(c.franjas, ['0 a 8 h', '8 a 12 h', '12 a 16 h', '16 a 24 h']);
  assert.deepEqual(c.valores[0], [40, 0, 0, 0, 0, 0, 0], 'la madrugada: 40 el lunes');
  assert.deepEqual(c.valores[1], [20, 0, 10, 0, 0, 0, 30], 'la mañana: lunes, miércoles y domingo, cada uno en su lugar');
  assert.deepEqual(c.valores[2], [0, 0, 0, 0, 0, 0, 0], 'una franja sin visitas sale en cero');
  assert.equal(c.max, 40);
  assert.deepEqual(c.tonos[1], [2, 0, 1, 0, 0, 0, 3]);
  assert.deepEqual([tonoDe(0, 40), tonoDe(1, 40), tonoDe(40, 40), tonoDe(null, 40)], [0, 1, 4, 0]);
  assert.equal(cuandoDe(null), null);
});

test('de dónde llegan: tres partes que suman el total, con «Otros» cuando hay más', () => {
  const tres = origenDe(res(['visitas'], [100], { clase: 'categoria', filas: [{ clave: 'ig', etiqueta: 'instagram.com', valores: [60] }, { clave: 's', etiqueta: '(sin dato)', valores: [30] }, { clave: 'g', etiqueta: 'google.com', valores: [10] }] }))!;
  assert.deepEqual(tres.partes.map((x) => [x.nombre, x.valor, Math.round(x.pct)]), [['instagram.com', 60, 60], ['Sin origen', 30, 30], ['google.com', 10, 10]]);
  const cinco = origenDe(res(['visitas'], [200], { clase: 'categoria', filas: [['a', 90], ['b', 50], ['c', 30], ['d', 20], ['Otros', 10]].map(([n, v]) => ({ clave: String(n), etiqueta: String(n), valores: [Number(v)] })) }))!;
  assert.deepEqual(cinco.partes.map((x) => [x.nombre, x.valor, x.otros]), [['a', 90, false], ['b', 50, false], ['Otros', 60, true]], 'los dos primeros y el resto, que suma el total');
  assert.equal(cinco.partes.reduce((a, x) => a + x.pct, 0), 100);
  assert.equal(origenDe(null), null);
});

test('la plantilla trae el diseño, la muestra pasa por el mismo modelo, y el editor lo dibuja', () => {
  assert.ok((DISENOS_HOJA as readonly string[]).includes('landing'));
  const pl = PLANTILLAS_HOJA.find((x) => x.id === 'landing')!;
  assert.ok(PLANTILLAS_OFRECIDAS.some((x) => x.id === 'landing'), '«Nueva hoja» la ofrece: ya trae su diseño copiado');
  const h = instanciarPlantilla(pl);
  assert.equal(h.diseno?.id, 'landing');
  const pieza = (k: string) => h.componentes.find((c) => c.id === h.diseno!.piezas[k]) as { metricas?: string[]; comparar?: boolean; fuente?: string; dimension?: string; desglose?: string; tipo?: string } | undefined;
  for (const k of ['apertura', 'mitad', 'final', 'tocan', 'puntaje', 'diagnostico', 'visitas', 'cuando', 'origen', 'scroll']) assert.ok(pieza(k), `la pieza ${k}`);
  for (const k of ['apertura', 'mitad', 'final', 'tocan']) assert.equal(pieza(k)?.comparar, true, `${k} se compara con el período anterior`);
  assert.deepEqual([pieza('cuando')?.tipo, pieza('cuando')?.fuente, pieza('cuando')?.dimension, pieza('cuando')?.desglose], ['dinamica_calor', 'visitas', 'franja', 'dia_semana']);
  assert.deepEqual(pieza('visitas')?.metricas, ['visitas', 'visitantes']);
  // La muestra (la miniatura de «Nueva hoja») arma la vista entera con el modelo de verdad.
  const v = vistaLanding(h, datosLandingMuestra(h, HOY), HOY);
  assert.match(texto(v.frase), /^Entraron [\d,]+ visitas de [\d,]+ personas, 12% más que el período anterior\.$/);
  assert.deepEqual(v.tiles.map((t) => t.texto), [v.tiles[0].texto, '51%', '18%', '264']);
  assert.deepEqual([v.puntaje.valor, v.puntaje.veredicto], [72, 'Se puede mejorar']);
  assert.equal(v.columnas?.columnas.length, 12);
  assert.equal(v.hoy, 23, 'las visitas de hoy, en lugar del «live now»');
  assert.equal(v.cuando?.max, 64);
  assert.equal(v.origen?.total, v.tiles[0].valor, 'el total de «De dónde llegan» es el de las visitas');
  cableadoDelDiseno(h, 'landing', 'LandingVivo', ['extras={extras?.landing ?? null}']);
  assert.ok(leer('app/dashboard/page.tsx').includes('landing: hayDisenoLanding ? { quien } : null'));
});

// Probado rompiéndolo (4/11/2026), cada rotura sola y la base en verde antes y después (8 de 8):
//   · la zona del negocio ignorada (el día y la franja en UTC): 1 fallo, 7 pases;
//   · un número que no llegó como 0 (`?? 0`): 1 fallo, 7 pases;
//   · el anillo repitiendo el número en vez de la proporción: 1 fallo, 7 pases;
//   · la fila «(sin dato)» como la página más floja: 1 fallo, 7 pases;
//   · la última columna siempre «hoy», aunque el período no llegue a hoy: 1 fallo, 7 pases;
//   · el cruce de «Cuándo entran» leído por posición y no por nombre: 1 fallo, 7 pases;
//   · los orígenes recortados sin «Otros» (no suman el total): 1 fallo, 7 pases.
