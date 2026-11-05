// =============================================================================
// La hoja «Anuncio ganador» con su DISEÑO PROPIO (la copia de Prism): de dónde sale cada número (lib/anuncio-diseno.ts)
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia… y después la adaptación con Maco» y «Después seguí con la segunda hoja, de a
// una». La hoja la dibuja app/dashboard/disenos/HojaAnuncio.tsx con lo que arma `vistaAnuncio` de las piezas de la hoja (los guiones
// analizados de tus anuncios). Estos tests EJECUTAN esas funciones con datos armados aquí (ficticios) y miran lo que sale; sólo el
// último lee el fuente (el cableado).
//
// Probado rompiéndolo (5/11/2026), cada rotura sola y la base en verde antes: ver el pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Resultado } from '../lib/graficos-agregar';
import { DISENOS_HOJA } from '../lib/graficos-catalogo';
import { PLANTILLAS_HOJA, PLANTILLAS_OFRECIDAS, instanciarPlantilla } from '../lib/graficos-plantillas';
import { HOOK_MID, IMPR_ALTA, IMPR_MEDIA, VEREDICTO_ROTULO, confFromImpr } from '../lib/ads-analyst-patrones';
import {
  DIAS_AGENDAS, agendasDe, cambio, escalarDe, ganadorDe, ganadoresDe, ganchoDe, lunesDe, mesesDe, muestraDe, numerosDe, promedioPorMil, semanasDe, topePar,
  veredictosDe, vistaAnuncio,
} from '../lib/anuncio-diseno';
import { datosAnuncioMuestra } from '../lib/anuncio-diseno-muestra';

const leer = (r: string) => readFileSync(fileURLToPath(new URL(`../${r}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
const col = (ids: string[]) => ids.map((id) => ({ id, nombre: id, formato: 'numero' as const }));
const res = (ids: string[], totales: Array<number | null>, extra: Partial<Resultado> = {}): Resultado =>
  ({ columnas: col(ids), filas: [], totales, fuera: 0, clase: null, ...extra }) as Resultado;
const filas = (ids: string[], fs: Array<[string, ...Array<number | null>]>, extra: Partial<Resultado> = {}): Resultado =>
  res(ids, ids.map(() => null), { clase: 'categoria', filas: fs.map(([k, ...v]) => ({ clave: k, etiqueta: k, valores: v })), ...extra });
const dia = (n: number) => { const d = new Date('2026-11-05T12:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const HOY = '2026-11-05';
const hoja = () => instanciarPlantilla(PLANTILLAS_HOJA.find((p) => p.id === 'ads-analyst')!);

test('el cambio contra el período anterior: en un costo, bajar es bueno', () => {
  assert.deepEqual(cambio(108, 100), { texto: '+8.0%', sube: true, bueno: true });
  assert.deepEqual(cambio(54.92, 72.4, true), { texto: '−24.1%', sube: false, bueno: true }, 'un costo que baja es bueno');
  assert.deepEqual(cambio(360, 341, true), { texto: '+5.6%', sube: true, bueno: false }, 'un costo que sube es malo');
  assert.equal(cambio(5, 0), null, 'contra cero no hay porcentaje');
  assert.equal(cambio(5, null), null, 'sin el anterior no se inventa');
  assert.equal(cambio(5, 5), null, 'sin cambio no hay flecha');
});

test('las agendas por día: los últimos días del período, su promedio de 7 días con los de antes y el total de la pieza', () => {
  const n = DIAS_AGENDAS + 10;
  const fs = Array.from({ length: n }, (_, i) => [dia(n - 1 - i), i < 10 ? 7 : 1] as [string, number]);
  const a = agendasDe(res(['agendas'], [999], { clase: 'tiempo', anterior: [500], filas: fs.map(([k, v]) => ({ clave: k, etiqueta: k, valores: [v] })) }))!;
  assert.equal(a.dias.length, DIAS_AGENDAS, 'se dibujan los últimos');
  assert.equal(a.dias[a.dias.length - 1].clave, HOY);
  assert.equal(a.recortado, true);
  assert.equal(a.total, 999, 'el número grande es el total de la pieza (todo el período), no la suma de lo dibujado');
  assert.equal(a.cambio?.texto, '+99.8%');
  // El primer día dibujado promedia sus 7 días: 6 de los de antes (7 cada uno) y él (1).
  assert.equal(a.ritmo[0], (6 * 7 + 1) / 7, 'el promedio usa los días de antes del recorte');
  assert.equal(a.ritmo[a.ritmo.length - 1], 1);
  assert.deepEqual(a.marcas, [6, 13, 20, 27, 34, 41], 'los rótulos a la misma distancia contando desde el último');
  const corto = agendasDe(res(['agendas'], [3], { clase: 'tiempo', filas: [[dia(1), 1], [dia(0), 2]].map(([k, v]) => ({ clave: k as string, etiqueta: k as string, valores: [v as number] })) }))!;
  assert.deepEqual(corto.ritmo, [null, null], 'con menos de tres días, no hay promedio');
  assert.equal(corto.recortado, false);
});

test('qué hacer con cada uno: los veredictos de más a menos, con su color, sin los de cero y «Validar» corto', () => {
  const v = veredictosDe(filas(['guiones', 'gasto'], [
    [VEREDICTO_ROTULO.escalar, 4, 2100], [VEREDICTO_ROTULO.validar, 6, 330], [VEREDICTO_ROTULO.repensar, 0, 0], ['(sin dato)', 2, 90],
  ]))!;
  assert.equal(v.total, 12);
  assert.deepEqual(v.gajos.map((g) => [g.nombre, g.n, g.tono]), [['Validar', 6, 'sm'], ['Escalar', 4, 's1'], ['Sin veredicto', 2, 'sm']]);
  assert.equal(v.gajos[0].parte, 50);
  assert.deepEqual(veredictosDe(filas(['guiones'], [])), { total: 0, gajos: [] });
});

test('con cuánta muestra: alta, media y baja en su orden, con la regla de las impresiones', () => {
  assert.deepEqual([confFromImpr(IMPR_ALTA), confFromImpr(IMPR_MEDIA), confFromImpr(IMPR_MEDIA - 1)], ['alta', 'media', 'baja'], 'los umbrales son los del veredicto');
  const m = muestraDe(filas(['guiones'], [['Baja', 9], ['Alta', 8], ['Media', 7]]))!;
  assert.deepEqual(m.gajos.map((g) => [g.clave, g.n, g.regla]), [['Alta', 8, `≥${IMPR_ALTA / 1000} mil`], ['Media', 7, `≥${IMPR_MEDIA / 1000} mil`], ['Baja', 9, `<${IMPR_MEDIA / 1000} mil`]]);
  assert.equal(m.conMuestra, 63, 'se pueden juzgar los de alta y media');
  assert.equal(muestraDe(filas(['guiones'], []))?.conMuestra, null, 'sin guiones no hay porcentaje');
});

test('qué guion rinde más: los de más agendas por US$1.000, contra el promedio de los que tienen muestra', () => {
  const r = filas(['agendas_1k', 'agendas', 'gasto'], [['B', 4, 2, 500], ['A', 10, 5, 500], ['(sin dato)', 50, 1, 20], ['C', null, 0, 0]], { totales: [7, 7, 1000] });
  const g = ganadoresDe(r, promedioPorMil(r))!;
  assert.deepEqual(g.filas.map((f) => [f.nombre, f.valor, f.sobre]), [['A', 10, true], ['B', 4, false]], 'ordenados, sin «(sin dato)» y sin los que no tienen valor');
  assert.equal(g.promedio, 7, 'el promedio sale de lo sumado, no del promedio de las filas');
  assert.equal(g.tope, 13, 'la escala, un 25% arriba del mejor');
  assert.equal(Math.round(g.meta! * 10) / 10, 53.8);
  assert.equal(Math.round(g.filas[0].ancho * 10) / 10, 76.9);
});

test('los tres costos: su texto, su cambio (bajar es bueno) y su curva de los últimos 12 puntos', () => {
  const serie = Array.from({ length: 20 }, (_, i) => ({ clave: dia(19 - i), etiqueta: '', valor: i < 8 ? 999 : i === 12 ? null : 10 + i }));
  const [cpa, cierre, sin] = numerosDe(res(['cpa'], [54.92], { anterior: [72.4], serie }), res(['costo_cierre'], [360], { anterior: [341] }), res(['gasto'], [null]));
  assert.deepEqual([cpa.texto, cpa.cambio?.texto, cpa.cambio?.bueno], ['US$54.92', '−24.1%', true]);
  assert.equal(cpa.chispa?.length, 12, 'los últimos 12 puntos');
  assert.equal(cpa.chispa?.[4], null, 'un día sin valor queda vacío, no en cero');
  assert.deepEqual([cpa.chispa?.[0], cpa.chispa?.[11]], [0, 1]);
  assert.deepEqual([cierre.cambio?.texto, cierre.cambio?.bueno, cierre.chispa], ['+5.6%', false, null]);
  assert.deepEqual([sin.titulo, sin.texto, sin.cambio], ['Sin retorno', null, null], 'lo que no llegó es null, nunca US$0');
});

test('listos para escalar: cuántos dice la fila «Escalar» del veredicto, la parte de lo invertido que va a ellos, y la cuenta', () => {
  // Los guiones por veredicto (el anillo) y lo invertido en cada uno (su pieza): los listos para escalar NO son otra pieza.
  const ver = filas(['guiones'], [[VEREDICTO_ROTULO.repensar, 7], [VEREDICTO_ROTULO.escalar, 4]], { totales: [11] });
  const inv = filas(['gasto'], [[VEREDICTO_ROTULO.escalar, 2100], [VEREDICTO_ROTULO.repensar, 900]], { totales: [6000] });
  const e = escalarDe(ver, inv, res(['agendas', 'cierres', 'cpa', 'gasto'], [96, 18, 62.5, 6000]));
  assert.deepEqual(e, { n: 4, parte: 35, invertido: 6000, porMil: 16, cierres: 18 }, 'los 4 de la fila «Escalar», no los 11 del total');
  const sinEscalar = escalarDe(filas(['guiones'], [[VEREDICTO_ROTULO.repensar, 3]], { totales: [3] }), filas(['gasto'], [[VEREDICTO_ROTULO.repensar, 900]], { totales: [900] }), null);
  assert.deepEqual([sinEscalar.n, sinEscalar.parte, sinEscalar.invertido], [0, 0, null], 'sin guiones para escalar es 0%, y lo que no llegó es null');
  assert.deepEqual([escalarDe(null, null, null).n, escalarDe(null, null, null).parte], [null, null], 'sin el veredicto no se sabe cuántos: null, nunca 0');
});

test('los seis meses cerrados: sin el de hoy, con el cambio de lo invertido y el de las agendas', () => {
  const meses = ['2026-04-01', '2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01'];
  const r = res(['agendas', 'gasto'], [0, 0], { clase: 'tiempo', filas: meses.map((k, i) => ({ clave: k, etiqueta: k, valores: [i === 1 ? 20 : 10 + i, 1000 + i * 100] })) });
  const m = mesesDe(r, HOY)!;
  assert.deepEqual(m.meses.map((x) => x.rotulo), ["May '26", "Jun '26", "Jul '26", "Ago '26", "Sep '26", "Oct '26"], 'el mes en curso no entra');
  assert.equal(m.meses[0].cambioGasto, null, 'el primero no tiene contra qué');
  assert.equal(m.meses[1].cambioGasto, '+9%');
  assert.equal(m.cambioAgendas, '−20% en 6 meses', 'de 20 (mayo) a 16 (octubre)');
  assert.equal(mesesDe(res(['agendas', 'gasto'], [0, 0], { clase: 'tiempo', filas: [{ clave: '2026-10-01', etiqueta: '', valores: [0, 0] }, { clave: '2026-11-01', etiqueta: '', valores: [5, 5] }] }), HOY)?.cambioAgendas, null, 'con un solo mes cerrado no hay cambio');
});

test('agendas y cierres por semana: la suma de los días de cada semana (de lunes a domingo), las últimas siete, y un eje con la mitad entera', () => {
  // 63 días (nueve semanas), dos agendas por día y un cierre los lunes: las semanas salen de la pieza de los DÍAS.
  const fs = Array.from({ length: 63 }, (_, i) => { const k = dia(62 - i); return { clave: k, etiqueta: '', valores: [2, new Date(`${k}T12:00:00Z`).getUTCDay() === 1 ? 1 : 0] }; });
  const s = semanasDe(res(['agendas', 'cierres'], [120, 18], { clase: 'tiempo', filas: fs }))!;
  assert.equal(s.semanas.length, 7, 'las últimas siete');
  assert.ok(s.semanas.every((x) => new Date(`${x.clave}T12:00:00Z`).getUTCDay() === 1 && lunesDe(x.clave) === x.clave), 'cada una se nombra por su lunes');
  assert.equal(s.semanas[6].clave, lunesDe(HOY), 'la última es la de hoy');
  assert.deepEqual([s.semanas[3].agendas, s.semanas[3].cierres], [14, 1], 'una semana entera: siete días de dos agendas y el cierre del lunes');
  assert.ok(s.semanas.every((x, i) => i === 0 || x.clave > s.semanas[i - 1].clave), 'de la más vieja a la más nueva');
  assert.equal(s.tasa, 15, 'sobre los totales del período');
  assert.equal(s.tope, 20);
  const pocos = semanasDe(res(['agendas', 'cierres'], [0, 0], { clase: 'tiempo', filas: fs.slice(-20) }))!;
  assert.equal(pocos.semanas.reduce((a, x) => a + x.agendas, 0), 40, 'las semanas suman los días: ninguno se pierde ni se cuenta dos veces');
  assert.deepEqual([topePar(1), topePar(16), topePar(25), topePar(45), topePar(130)], [2, 20, 30, 60, 200]);
});

test('el gancho en el tiempo: tres líneas día por día, contra el buen gancho, y el guion que más agendó', () => {
  const fs = Array.from({ length: 3 }, (_, i) => ({ clave: dia(2 - i), etiqueta: '', valores: [30 + i, i === 1 ? null : 9, 17] }));
  const g = ganchoDe(res(['hook_rate', 'ret_cta', 'thruplay_rate'], [31, 9, 17], { clase: 'tiempo', filas: fs }))!;
  assert.deepEqual(g.lineas.map((l) => [l.nombre, l.total]), [['Gancho', 31], ['Llegan al llamado', 9], ['ThruPlay', 17]]);
  assert.equal(g.lineas[1].valores[1], null, 'un día sin valor no es 0%');
  assert.equal(g.meta, HOOK_MID, 'la línea es la del veredicto, no un número escrito aparte');
  assert.ok(g.tope >= HOOK_MID && g.tope % 5 === 0);
  const t = filas(['agendas', 'hook_rate', 'retencion_final', 'cpa'], [['(sin dato)', 9, 1, 1, 1], ['Sin agendas', 0, 1, 1, null], ['Reel', 4, 1, 1, 25]]);
  assert.deepEqual(ganadorDe(t), { clave: 'Reel', nombre: 'Reel', agendas: 4, cpa: 25 }, 'sin «(sin dato)» ni los que no agendaron');
  assert.equal(ganadorDe(filas(['agendas', 'cpa'], [['Nada', 0, null]])), null);
});

test('la hoja entera con la muestra: las cifras cierran entre tarjetas', () => {
  const h = hoja();
  const v = vistaAnuncio(h, datosAnuncioMuestra(h, HOY), HOY);
  assert.equal(v.vacia, false);
  assert.equal(v.veredictos?.total, v.muestra?.total, 'los guiones de los dos anillos son los mismos');
  assert.equal(v.agendas?.total, v.semanas?.agendas, 'las semanas suman los días');
  assert.equal(v.escalar.n, v.veredictos?.gajos.find((g) => g.nombre === 'Escalar')?.n, 'los listos para escalar son los del anillo');
  assert.equal(v.ganadores?.filas.length, 6);
  assert.ok(v.ganadores!.filas.some((f) => f.sobre) && v.ganadores!.filas.some((f) => !f.sobre), 'hay de los dos lados del promedio');
  assert.equal(v.meses?.meses.length, 6);
  assert.equal(v.numeros.every((x) => x.texto && x.chispa), true);
  assert.equal(v.ganador?.nombre, v.ganadores?.filas[0].nombre, 'el que más agendó, el primero de la muestra');
});

test('sin guiones, la hoja lo dice; leyendo o caída, cada tarjeta espera sin inventar', () => {
  const h = hoja(), p = h.diseno!.piezas;
  const vacios = Object.fromEntries(Object.values(p).map((id) => [id, { resultado: res([], [], { clase: 'categoria' }) }]));
  assert.equal(vistaAnuncio(h, vacios, HOY).vacia, true);
  const cargando = Object.fromEntries(Object.values(p).map((id) => [id, { cargando: true }]));
  const v = vistaAnuncio(h, cargando, HOY);
  assert.deepEqual([v.vacia, v.cargando, v.agendas, v.veredictos, v.escalar.parte], [false, true, null, null, null]);
  const caida = vistaAnuncio(h, Object.fromEntries(Object.values(p).map((id) => [id, { error: 'caída' }])), HOY);
  assert.deepEqual([caida.vacia, caida.numeros.map((x) => x.texto)], [false, [null, null, null]]);
});

test('el cableado: la plantilla trae su diseño con sus catorce piezas, se ofrece y el editor la dibuja mirando', () => {
  assert.ok((DISENOS_HOJA as readonly string[]).includes('anuncio'));
  assert.ok(PLANTILLAS_OFRECIDAS.some((p) => p.id === 'ads-analyst'));
  const h = hoja();
  const porId = new Map(h.componentes.map((c) => [c.id, c as { fuente?: string; metricas?: string[]; dimension?: string | null; comparar?: boolean; controles?: Array<{ campo?: string; valores?: string[]; preset?: string }> }]));
  const pieza = (k: string) => porId.get(h.diseno!.piezas[k]);
  assert.equal(Object.keys(h.diseno!.piezas).length, 12);
  // Una hoja lleva hasta 14 paneles (tests/graficos-corbel.test.ts): los listos para escalar y las semanas se calculan, no se piden.
  assert.ok(h.componentes.length <= 14, `${h.componentes.length} paneles`);
  assert.deepEqual(['escalar', 'semanas'].filter((k) => k in h.diseno!.piezas), [], 'no hay piezas aparte para lo que se calcula');
  assert.deepEqual(pieza('dia')?.metricas, ['agendas', 'cierres'], 'las semanas suman los días: la pieza trae los cierres');
  for (const k of Object.keys(h.diseno!.piezas)) assert.equal(pieza(k)?.fuente, 'guiones', `la pieza ${k} existe y es de los guiones`);
  assert.deepEqual(pieza('ganadores')?.controles?.find((c) => c.campo)?.valores, ['Alta', 'Media'], 'qué guion rinde más, sólo entre los que tienen muestra');
  assert.equal(pieza('meses')?.controles?.find((c) => c.preset)?.preset, 'ult12m', 'la vista larga no obedece al período');
  assert.deepEqual([pieza('invertido')?.dimension, pieza('invertido')?.metricas], ['veredicto', ['gasto']], 'lo invertido en cada veredicto, en su pieza (un anillo lleva una sola métrica)');
  for (const k of ['cpa', 'cierre', 'sinretorno', 'dia']) assert.equal(pieza(k)?.comparar, true, `${k} se compara con el período anterior`);
  const editor = leer('app/dashboard/EditorInforme.tsx');
  assert.ok(editor.includes("hoja.diseno?.id === 'anuncio' && !enGrilla && !editando && !dueno"));
  assert.ok(editor.includes('<AnuncioVivo'));
  assert.ok(leer('app/dashboard/disenos/DisenoEnMiniatura.tsx').includes('vistaAnuncio(hoja, datosAnuncioMuestra(hoja, hoy), hoy)'));
});

// Probado rompiéndolo (5/11/2026), cada rotura sola y la base en verde antes y después (22 de 22):
//   · un costo que sube pintado de bueno: 2 fallos, 11 pases;
//   · el promedio de 7 días sin los días de antes del recorte: 1 fallo, 12 pases;
//   · el número grande como la suma de lo dibujado: 2 fallos, 11 pases;
//   · los veredictos de cero en el anillo: 1 fallo, 12 pases;
//   · «Validar (poco spend)» entero: 1 fallo, 12 pases;
//   · «con muestra» sólo con las altas: 1 fallo, 12 pases;
//   · «(sin dato)» entre los que rinden más: 1 fallo, 12 pases;
//   · sin el promedio de lo sumado: 1 fallo, 12 pases;
//   · la curva con los días vacíos en cero: 1 fallo, 12 pases;
//   · sin el veredicto «Escalar», sin parte (en vez de 0%): 1 fallo, 12 pases;
//   · el mes en curso entre los cerrados: 1 fallo, 12 pases;
//   · la tasa de cierre de las últimas siete semanas: 1 fallo, 12 pases;
//   · el buen gancho escrito a mano: 1 fallo, 12 pases;
//   · «(sin dato)» como el que más agendó: 1 fallo, 12 pases;
//   · leyendo, la hoja «vacía»: 1 fallo, 12 pases;
//   · los que rinden más sin el filtro de muestra: 1 fallo, 12 pases;
//   · la vista larga obedeciendo al período: 1 fallo, 12 pases;
// y después del tope de 14 paneles (los listos para escalar y las semanas se calculan):
//   · los listos para escalar como el total del veredicto: 2 fallos, 11 pases;
//   · sin el veredicto, 0 listos para escalar (en vez de null): 1 fallo, 12 pases;
//   · cada día como su propia semana: 1 fallo, 12 pases;
//   · las semanas leídas de una pieza que ya no existe: 1 fallo, 12 pases;
//   · la pieza de los días sin los cierres: 1 fallo, 12 pases.
