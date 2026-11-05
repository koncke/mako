// =============================================================================
// La hoja «Instagram y redes» con su DISEÑO PROPIO (la copia de Murmura): de dónde sale cada número (lib/instagram-diseno.ts)
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia… y después la adaptación con Maco» y «Después seguí con la segunda hoja, de a
// una». La hoja la dibuja app/dashboard/disenos/HojaInstagram.tsx con lo que arma `vistaInstagram` de las piezas de la hoja y de las
// publicaciones del Calendario de General. Estos tests EJECUTAN esas funciones con datos armados aquí (ficticios) y miran lo que sale;
// sólo el último lee el fuente (el cableado).
//
// Probado rompiéndolo (5/11/2026), cada rotura sola y la base en verde antes: ver el pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { agregar, type Resultado } from '../lib/graficos-agregar';
import type { Grafico } from '../lib/graficos-catalogo';
import type { ItemCalendario } from '../lib/calendario-modelo';
import {
  anunciosDe, deMeta, faltaDias, faltaPara, fraseInstagram, leadsDe, marcasDesdeElPrimero, numerosDe, origenDe, proximasDe, quienDe, redesDe, semanaDe,
  vistaInstagram,
} from '../lib/instagram-diseno';
import { datosInstagramMuestra, generalInstagramMuestra } from '../lib/instagram-diseno-muestra';
import { DISENOS_HOJA } from '../lib/graficos-catalogo';
import { PLANTILLAS_GENERAL_OFRECIDAS, instanciarPlantilla } from '../lib/graficos-plantillas';
import { PLANTILLAS_GENERAL } from '../lib/general-plantillas';

const leer = (r: string) => readFileSync(fileURLToPath(new URL(`../${r}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');

const col = (ids: string[]) => ids.map((id) => ({ id, nombre: id, formato: 'numero' as const }));
const res = (ids: string[], totales: Array<number | null>, extra: Partial<Resultado> = {}): Resultado =>
  ({ columnas: col(ids), filas: [], totales, fuera: 0, clase: null, ...extra }) as Resultado;
const filas = (ids: string[], fs: Array<[string, ...Array<number | null>]>, extra: Partial<Resultado> = {}): Resultado =>
  res(ids, ids.map(() => null), { clase: 'categoria', filas: fs.map(([k, ...v]) => ({ clave: k, etiqueta: k, valores: v })), ...extra });
const HOY = '2026-11-05';
const hoja = () => instanciarPlantilla(PLANTILLAS_GENERAL.find((p) => p.id === 'instagram')!);
const pub = (id: string, inicio: string, extra: Partial<ItemCalendario> = {}): ItemCalendario =>
  ({ id, fuente: 'propio', capa: 'publicaciones', titulo: id, inicio, fin: null, diaCompleto: false, href: '/calendario', formato: 'reel', ...extra });

test('la frase de arriba: lo que Instagram te mostró, cuántos tocaron y cuántos agendaron', () => {
  const texto = (t: ReturnType<typeof fraseInstagram>) => t.map((x) => x.s).join('');
  assert.equal(texto(fraseInstagram(48200, 1230, 31)), 'Instagram te mostró 48.2k veces, 1,230 tocaron tu anuncio y 31 agendaron.');
  assert.equal(texto(fraseInstagram(9000, 1, 0)), 'Instagram te mostró 9,000 veces, 1 tocó tu anuncio y nadie agendó.');
  assert.equal(texto(fraseInstagram(9000, 12, null)), 'Instagram te mostró 9,000 veces y 12 tocaron tu anuncio.', 'sin agendas leídas no se dicen');
  assert.deepEqual(fraseInstagram(null, 12, 3), [], 'sin lo que te mostró no hay frase');
  assert.equal(texto(fraseInstagram(0, 0, 0)), 'Instagram todavía no mostró tus anuncios en este período.');
});

test('el alcance sale de la fila de Instagram de cada red: su propio número nunca lo trae', () => {
  // Medido con `agregar`: el alcance no se suma entre filas (`sinTotal`), así que un número sin desglose da null siempre.
  const g = { id: 'x', clase: 'grafico', tipo: 'numero', fuente: 'audiencia', dimension: null, metricas: ['alcance'] } as unknown as Grafico;
  const fs = [{ f: '2026-10-06', d: { edad: '25-34', genero: 'Mujeres' }, v: { impresiones: 100, alcance: 60 } }];
  assert.equal(agregar(g, fs, '2026-10-06', HOY).totales[0], null, 'por eso la plantilla ya no tiene el número de alcance');
  const redes = filas(['impresiones', 'clics', 'agendas', 'alcance'], [['Facebook', 900, 9, 2, 700], ['Instagram', 500, 10, 3, 410]]);
  const n = Object.fromEntries(numerosDe(redes, res(['ctr'], [2.04]), res(['gasto'], [412]), res(['cpm'], [8.547])).map((x) => [x.id, x]));
  assert.equal(n.alcance.valor, '410', 'el de Instagram, no el de Facebook');
  assert.equal(n.ctr.valor, '2.0%');
  assert.deepEqual([n.gasto.valor, n.gasto.pie], ['US$412', 'US$8.55 por cada mil vistas'], 'el costo por mil con centavos');
  assert.equal(numerosDe(filas(['impresiones', 'alcance'], [['Facebook', 900, 700]]), null, null, null)[0].valor, null, 'sin la fila de Instagram, no se inventa');
});

test('la próxima publicación: lo que falta, sin las hechas ni las que ya salieron, y las que siguen en orden', () => {
  const ahora = Date.parse(`${HOY}T15:00:00Z`);
  const cal = {
    tz: 'UTC', hoy: HOY, items: [
      pub('manana', '2026-11-06T09:00:00Z'), pub('hecha', `${HOY}T16:00:00Z`, { hecho: true }), pub('salio', `${HOY}T10:00:00Z`),
      pub('hoy', `${HOY}T16:30:00Z`, { formato: 'story' }), { ...pub('llamada', `${HOY}T15:30:00Z`), capa: 'llamadas' as const },
    ],
  };
  const p = proximasDe(cal, ahora);
  assert.equal(p.proxima?.id, 'hoy', 'una hecha no sale; una llamada no es una publicación');
  assert.deepEqual([p.proxima?.falta, p.proxima?.cuando, p.proxima?.rotuloFormato], ['1 h 30 min', 'Hoy, 16:30', 'Story']);
  assert.deepEqual(p.siguen.map((x) => x.id), ['manana']);
  assert.equal(p.total, 2);
  assert.deepEqual([faltaPara(ahora + 26 * 3600e3, ahora), faltaPara(ahora + 45 * 60e3, ahora), faltaPara(ahora - 1, ahora)], ['1 día 2 h', '45 min', 'Ahora']);
  assert.deepEqual([faltaDias(HOY, HOY), faltaDias('2026-11-06', HOY), faltaDias('2026-11-09', HOY)], ['Hoy', 'Mañana', '4 días']);
  assert.equal(proximasDe({ ...cal, items: [pub('todo', '2026-11-06T00:00:00Z', { diaCompleto: true })] }, ahora).proxima?.falta, 'Mañana', 'una de todo el día no cuenta horas');
});

test('la semana: siete días desde hoy, en la zona del negocio, con tres turnos y los que sobran', () => {
  const items = [
    pub('a', `${HOY}T09:00:00Z`), pub('b', `${HOY}T10:00:00Z`), pub('c', `${HOY}T11:00:00Z`), pub('d', `${HOY}T12:00:00Z`, { formato: 'post' }),
    pub('noche', '2026-11-07T03:00:00Z'), pub('lejos', '2026-11-12T10:00:00Z'), { ...pub('cobro', `${HOY}T13:00:00Z`), capa: 'cobros' as const },
  ];
  const s = semanaDe({ items, tz: 'America/Mexico_City', hoy: HOY });
  assert.equal(s.dias.length, 7);
  assert.deepEqual([s.dias[0].nombre, s.dias[0].numero, s.dias[0].hoy, s.dias[0].total, s.dias[0].mas], ['Jue', 5, true, 4, 1]);
  assert.deepEqual(s.dias[0].turnos.map((t) => [t.hora, t.insignia]), [['03:00', 'RE'], ['04:00', 'RE'], ['05:00', 'RE']], 'la hora del negocio, no la UTC');
  assert.equal(s.dias[1].total, 1, 'las 3:00 UTC del sábado son el viernes 21:00 en México');
  assert.equal(s.total, 5, 'lo de la semana que viene y lo que no es una publicación no cuentan');
});

test('los anuncios: el primero va arriba, los demás en la lista, y se cuenta lo que la pieza no trajo', () => {
  const a = anunciosDe(filas(['cierres', 'agendas', 'leads'], [['Reel', 6, 14, 52], ['(sin dato)', 0, 1, 3], ['Carrusel', 4, 9, 38]], { fuera: 2 }))!;
  assert.equal(a.top?.nombre, 'Reel');
  assert.deepEqual(a.resto.map((x) => [x.nombre, x.cierres, x.agendas, x.leads]), [['Carrusel', 4, 9, 38]], 'ningún anuncio dos veces; «(sin dato)» no es un anuncio');
  assert.equal(a.total, 4);
  assert.equal(anunciosDe(null), null);
});

test('los leads de cada día y los rótulos del eje desde el primer día', () => {
  assert.deepEqual(marcasDesdeElPrimero(30, 11), [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 29], 'los de Murmura: Oct 6, Oct 9 … Nov 2, Nov 4');
  assert.deepEqual(marcasDesdeElPrimero(30, 5), [0, 8, 16, 24, 29], 'los del teléfono: Oct 6, Oct 14, Oct 22, Oct 30, Nov 4');
  assert.deepEqual(marcasDesdeElPrimero(31, 11), [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30]);
  assert.deepEqual(marcasDesdeElPrimero(29, 11), [0, 3, 6, 9, 12, 15, 18, 21, 24, 28], 'el 27 se iba a pisar con el último (28): se va');
  const dias = Array.from({ length: 30 }, (_, i) => { const d = new Date(Date.UTC(2026, 9, 7 + i)).toISOString().slice(0, 10); return { clave: d, etiqueta: d, valores: [i % 5, i % 2] }; });
  const l = leadsDe(res(['leads', 'agendas'], [60, 15], { clase: 'tiempo', filas: dias }))!;
  assert.deepEqual([l.total, l.agendas, l.tope, l.x.length, l.xTel.length], [60, 15, 5, 11, 5]);
  assert.deepEqual([l.x[0].pct, l.x.at(-1)!.pct, l.x[0].rotulo], [0, 100, '7 oct']);
});

test('cada red y quién te ve: ordenadas por lo que te vieron, con la parte de cada una', () => {
  const r = redesDe(filas(['impresiones', 'clics', 'agendas'], [['Facebook', 400, 4, 0], ['Instagram', 800, 16, 5], ['(sin dato)', 50, 0, 0]]))!;
  assert.deepEqual(r.map((x) => [x.nombre, x.barra, x.ctr, x.agendas, x.icono]), [['Instagram', 100, 2, 5, 'instagram'], ['Facebook', 50, 1, 0, 'facebook']]);
  const q = quienDe(
    filas(['impresiones'], [['18-24', 100], ['25-34', 500], ['35-44', 300], ['45-54', 100], ['(sin dato)', 1000]]),
    filas(['impresiones'], [['Hombres', 300], ['Mujeres', 700]]),
    filas(['impresiones'], [['Jalisco', 50], ['Puebla', 0]]),
  );
  assert.deepEqual(q.edades!.map((e) => [e.nombre, Math.round(e.pct)]), [['25-34', 50], ['35-44', 30], ['18-24', 10]], 'las tres que más, sin «(sin dato)»');
  assert.deepEqual(q.genero!.map((g) => [g.nombre, g.pct]), [['Mujeres', 70], ['Hombres', 30]]);
  assert.deepEqual(q.regiones!.map((x) => x.nombre), ['Jalisco'], 'una región sin vistas no se lista');
  const o = origenDe(filas(['leads'], Array.from({ length: 9 }, (_, i) => [`o${i}`, 9 - i] as [string, number]), { fuera: 1 }))!;
  assert.deepEqual([o.lista.length, o.lista[0].nombre, o.mas], [7, 'o0', 3], 'siete y los que no entraron');
});

test('la hoja entera con la muestra: las cifras cierran entre bloques', () => {
  const h = hoja();
  assert.equal(h.diseno?.id, 'instagram');
  const v = vistaInstagram(h, datosInstagramMuestra(h, HOY), generalInstagramMuestra(HOY), Date.parse(`${HOY}T15:00:00Z`));
  assert.deepEqual(Object.keys(v.problemas), []);
  const ig = v.redes!.find((x) => x.nombre === 'Instagram')!;
  assert.equal(v.frase.map((x) => x.s).join(''), 'Instagram te mostró 48.2k veces, 1,230 tocaron tu anuncio y 31 agendaron.');
  assert.equal(ig.agendas, 31, 'la frase de arriba es la fila de Instagram de cada red');
  assert.equal(v.numeros[1].valor, `${(Math.round(ig.ctr! * 10) / 10).toFixed(1)}%`, 'el CTR de arriba es el de la fila');
  assert.equal(v.numeros[0].valor, '21.4k');
  assert.equal(v.proximas!.proxima?.falta, '1 h 30 min');
  assert.equal(v.semana!.total, 14);
  assert.equal(v.anuncios!.resto.length, 4);
  assert.equal(v.leads!.total, 233);
});

test('lo que no se pudo leer se dice en su bloque, sin inventar, y el error crudo no se pinta', () => {
  const h = hoja();
  const datos = datosInstagramMuestra(h, HOY);
  datos[h.diseno!.piezas.plataformas] = { error: 'Conecta Meta para ver tu audiencia' };
  datos[h.diseno!.piezas.anuncios] = { error: 'fetch failed' };
  datos[h.diseno!.piezas.apertura] = { error: 'Request failed with status code 500' };
  const v = vistaInstagram(h, datos, null, Date.parse(`${HOY}T15:00:00Z`));
  assert.deepEqual(Object.keys(v.problemas).sort(), ['anuncios', 'calendario', 'numeros', 'redes'], 'sin los datos de General, el Calendario no se leyó');
  assert.equal(v.problemas.redes, 'Conecta Meta para ver tu audiencia', 'el nuestro, que dice qué hacer');
  assert.equal(v.problemas.numeros, 'No pude leer algunos números de Meta.', 'el de afuera no se pinta tal cual');
  assert.equal(deMeta('Vuelve a conectar Meta para ver tu audiencia', 'x'), 'Vuelve a conectar Meta para ver tu audiencia');
  assert.deepEqual(v.frase, []);
  assert.equal(v.numeros[0].valor, null, 'sin cada red, el alcance no llega: null, nunca un cero');
  assert.equal(v.numeros[2].valor, 'US$412', 'lo que sí se leyó sigue');
  for (const k of ['proximas', 'semana', 'anuncios', 'redes'] as const) assert.equal(v[k], null, k);
});

test('el cableado: la plantilla trae su diseño con sus once piezas, se ofrece y el editor la dibuja mirando', () => {
  assert.ok((DISENOS_HOJA as readonly string[]).includes('instagram'));
  assert.ok(PLANTILLAS_GENERAL_OFRECIDAS.some((p) => p.id === 'instagram'));
  const h = hoja();
  const porId = new Map(h.componentes.map((c) => [c.id, c as { fuente?: string; metricas?: string[]; dimension?: string | null; titulo?: string }]));
  const pieza = (k: string) => porId.get(h.diseno!.piezas[k]);
  assert.equal(Object.keys(h.diseno!.piezas).length, 11);
  for (const k of Object.keys(h.diseno!.piezas)) assert.ok(pieza(k), `la pieza ${k} existe en la hoja`);
  assert.ok(pieza('plataformas')?.metricas?.includes('alcance'), 'el alcance viaja en cada red');
  assert.deepEqual([pieza('region')?.metricas, pieza('region')?.titulo], [['impresiones'], 'Dónde te ven'], 'Meta no da agendas por región');
  assert.deepEqual([pieza('leads')?.fuente, pieza('leads')?.dimension], ['meta', 'dia']);
  assert.ok(!h.componentes.some((c) => (c as { titulo?: string }).titulo === 'Alcance en Instagram'), 'el número que nunca tuvo valor ya no está');
  const editor = leer('app/dashboard/EditorInforme.tsx');
  assert.ok(editor.includes("hoja.diseno?.id === 'instagram' && !enGrilla && !editando && !dueno"));
  assert.ok(editor.includes('<InstagramVivo'));
  assert.ok(leer('app/dashboard/disenos/DisenoEnMiniatura.tsx').includes('vistaInstagram(hoja, datosInstagramMuestra(hoja, hoy), generalInstagramMuestra(hoy)'));
});

// Probado rompiéndolo (5/11/2026), cada rotura sola y la base en verde antes y después (22 de 22):
//   · la frase sin «nadie agendó»: 1 fallo, 9 pases;
//   · el alcance de la primera fila (no la de Instagram): 1 fallo, 9 pases;
//   · el costo por mil sin centavos: 1 fallo, 9 pases;
//   · las publicaciones con las hechas: 1 fallo, 9 pases;
//   · las que ya salieron contadas: 1 fallo, 9 pases;
//   · lo que falta sin los minutos: 1 fallo, 9 pases;
//   · una de todo el día contando horas: 1 fallo, 9 pases;
//   · la semana sin la zona del negocio: 1 fallo, 9 pases;
//   · la semana con lo que no es una publicación: 1 fallo, 9 pases;
//   · sin los turnos que sobran: 1 fallo, 9 pases;
//   · el primer anuncio también en la lista: 2 fallos, 8 pases;
//   · los anuncios sin lo que la pieza no trajo: 1 fallo, 9 pases;
//   · el eje contado desde el último día: 1 fallo, 9 pases;
//   · el último rótulo pisando al anterior: 1 fallo, 9 pases;
//   · las redes sin ordenar: 1 fallo, 9 pases;
//   · la barra contra el total y no contra la que más: 1 fallo, 9 pases;
//   · «(sin dato)» como una edad: 2 fallos, 8 pases;
//   · las partes con las de cero: 1 fallo, 9 pases;
//   · los orígenes sin lo que la pieza no trajo: 1 fallo, 9 pases;
//   · el error crudo de afuera pintado tal cual: 1 fallo, 9 pases;
//   · sin los datos de General, el Calendario sin avisar: 1 fallo, 9 pases;
//   · un número que no llegó como cero: 2 fallos, 8 pases.
