// =============================================================================
// La hoja «Hooks y retención» con su DISEÑO PROPIO (la copia de Ondra): de dónde sale cada número (lib/hooks-diseno.ts)
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia… y después la adaptación con Maco» y «Después seguí con la segunda hoja, de a
// una». La hoja la dibuja app/dashboard/disenos/HojaHooks.tsx con lo que arma `vistaHooks` de las piezas de la hoja (los guiones
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
import { HOLD_MID, HOOK_MID } from '../lib/ads-analyst-patrones';
import {
  AVATARES, GANCHOS, GUIONES, TOPE_MEDIDOR, avataresDe, caidaDe, corto, curvaDe, ganchosDe, guionesDe, iniciales, medidorDe, numerosDe, tasa, vistaHooks,
} from '../lib/hooks-diseno';
import { datosHooksMuestra } from '../lib/hooks-diseno-muestra';

const leer = (r: string) => readFileSync(fileURLToPath(new URL(`../${r}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
const col = (ids: string[]) => ids.map((id) => ({ id, nombre: id, formato: 'numero' as const }));
const res = (ids: string[], totales: Array<number | null>, extra: Partial<Resultado> = {}): Resultado =>
  ({ columnas: col(ids), filas: [], totales, fuera: 0, clase: null, ...extra }) as Resultado;
const filas = (ids: string[], fs: Array<[string, ...Array<number | null>]>, extra: Partial<Resultado> = {}): Resultado =>
  res(ids, ids.map(() => null), { clase: 'categoria', filas: fs.map(([k, ...v]) => ({ clave: k, etiqueta: k, valores: v })), ...extra });
const dia = (n: number) => { const d = new Date('2026-11-05T12:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const HOY = '2026-11-05';
const hoja = () => instanciarPlantilla(PLANTILLAS_HOJA.find((p) => p.id === 'hooks-retencion')!);
const serie = (vs: Array<number | null>) => vs.map((valor, i) => ({ clave: dia(vs.length - 1 - i), etiqueta: '', valor }));

test('cómo se escriben: el hook rate con un decimal, el embudo corto como Ondra, y las iniciales de un avatar', () => {
  assert.deepEqual([tasa(31.42), tasa(8), tasa(10.05)], ['31.4%', '8.0%', '10.1%']);
  assert.deepEqual([corto(122200), corto(72600), corto(9201), corto(48)], ['122k', '72.6k', '9,201', '48']);
  assert.deepEqual([iniciales('Dueña de agencia'), iniciales('Coach'), iniciales('  Ánimo  emprendedor '), iniciales('—')], ['DD', 'CO', 'ÁE', '·']);
});

test('los cuatro números: su valor, el de antes, su cambio y la curva; lo que no llegó es null, nunca 0', () => {
  const [hook, cta, thru, gu] = numerosDe({
    hook: res(['hook_rate'], [31.4], { anterior: [29.6], serie: serie([30, null, 33]) }),
    cta: res(['ret_cta'], [10.2], { anterior: [10.9] }),
    thruplay: null,
    guiones: res(['guiones'], [24], { anterior: [20] }),
  });
  assert.deepEqual([hook.texto, hook.antes, hook.cambio?.texto, hook.cambio?.bueno], ['31.4%', 'vs 29.6%', '+6.1%', true]);
  assert.deepEqual([cta.cambio?.texto, cta.cambio?.bueno], ['−6.4%', false], 'menos gente al llamado es malo');
  assert.deepEqual([thru.valor, thru.texto, thru.antes, thru.dias], [null, null, null, []], 'lo que no llegó no es 0%');
  assert.deepEqual([gu.texto, gu.esTasa], ['24', false], 'los guiones no son un porcentaje');
  assert.equal(hook.dias[1].valor, null, 'un día sin dato queda vacío');
  const c = curvaDe(hook)!;
  assert.ok(c.tope >= 33 * 1.15 && c.tope >= (hook.anterior ?? 0), 'el tope deja la curva y el promedio de antes adentro');
  assert.deepEqual(c.puntos, [30, null, 33]);
  assert.equal(curvaDe(thru), null, 'sin días no hay curva');
});

test('qué gancho retiene: cada tipo con sus guiones y su parte, sin «(sin dato)», y cuántos pasan el buen gancho', () => {
  const r = filas(['hook_rate', 'ret_cta', 'thruplay_rate', 'guiones'], [
    ['Pregunta', 36, 12, 19, 6], ['(sin dato)', 40, 5, 9, 3], ['Historia', 27, 13, 21, 4], ['Vacío', 50, 1, 1, 0], ['Dato duro', 30, 11, 18, 2],
  ], { totales: [31, 10, 17, 15] });
  const g = ganchosDe(r)!;
  assert.deepEqual(g.filas.map((x) => x.nombre), ['Pregunta', 'Historia', 'Dato duro'], 'sin «(sin dato)» ni los que no tienen guiones');
  assert.deepEqual(g.filas.map((x) => x.parte), [50, 33, 17], 'la parte de los guiones que se dibujan');
  assert.equal(g.pasan, 2, `pasan el ${HOOK_MID}%: la pregunta y el dato duro`);
  assert.deepEqual([g.hook, g.cta, g.thru, g.guiones], [31, 10, 17, 15], 'los totales de la pieza');
  assert.equal(new Set(g.filas.map((x) => x.tono)).size, g.filas.length, 'cada gancho con su color');
  const muchos = ganchosDe(filas(['hook_rate', 'guiones'], Array.from({ length: 9 }, (_, i) => [`G${i}`, 30, 1] as [string, number, number])))!;
  assert.equal(muchos.filas.length, GANCHOS);
  assert.equal(ganchosDe(null), null);
});

test('cada guion: los primeros seis como vienen (del que más retiene), con su gancho y su formato, y cuántos hay en total', () => {
  const r = filas(['hook_rate', 'ret_cta', 'thruplay_rate', 'retencion_final'], [
    ['Reel A', 41, 13, 22, 7], ['(sin dato)', 39, 9, 9, 1], ['Video B', 38, 12, 20, 6], ...Array.from({ length: 6 }, (_, i) => [`C${i}`, 20 - i, 5, 9, 2] as [string, ...number[]]),
  ], { fuera: 4 });
  r.filas[0].extra = { gancho: 'Pregunta', formato: 'Reel' };
  r.filas[2].extra = { gancho: '(sin dato)', formato: 'Video' };
  const g = guionesDe(r)!;
  assert.equal(g.filas.length, GUIONES);
  assert.deepEqual(g.filas.slice(0, 2).map((x) => [x.nombre, x.detalle, x.hook]), [['Reel A', 'Pregunta · Reel', 41], ['Video B', 'Video', 38]], 'sin «(sin dato)», ni como guion ni como detalle');
  assert.equal(g.total, 8 + 4, 'los que se ven, más los que el límite dejó afuera');
});

test('en qué parte se van: el ancho de Ondra, lo que retiene cada paso y la caída más grande', () => {
  const c = caidaDe(res(['plays_3s', 'p25', 'p50', 'p75', 'p100'], [48200, 24100, 9640, 6170, 3860]))!;
  assert.deepEqual(c.pasos.map((p) => p.nombre), ['3 segundos', 'Un cuarto', 'La mitad', 'Tres cuartos', 'El video entero']);
  assert.deepEqual(c.pasos.map((p) => (p.tasa == null ? null : Math.round(p.tasa))), [null, 50, 40, 64, 63]);
  assert.equal(c.fuga, 2, 'de un cuarto a la mitad se va la mayor parte');
  assert.equal(c.pasos[0].ancho, 1);
  assert.ok(Math.abs(c.pasos[4].ancho - (3860 / 48200) ** 0.42) < 1e-9, 'max(.035, (el paso / el primero) ^ .42)');
  assert.equal(caidaDe(res(['plays_3s', 'p25', 'p50', 'p75', 'p100'], [1000, 0, 0, 0, 0]))!.pasos[1].ancho, 0.035, 'una barra en cero se sigue viendo');
  assert.equal(caidaDe(res(['plays_3s', 'p25', 'p50', 'p75', 'p100'], [0, 0, 0, 0, 0])), null, 'sin nadie que vio los 3 segundos no hay embudo');
});

test('el hook rate por avatar: los cinco de mejor gancho, con el bueno marcado y sus iniciales', () => {
  const a = avataresDe(filas(['hook_rate', 'ret_cta', 'guiones'], [
    ['Coach', 27, 10, 3], ['Dueña de agencia', 34, 12, 7], ['(sin dato)', 50, 1, 2], ['Sin guiones', 60, 1, 0], ...Array.from({ length: 5 }, (_, i) => [`A${i}`, 10 + i, 5, 1] as [string, ...number[]]),
  ]))!;
  assert.equal(a.length, AVATARES);
  assert.deepEqual(a.slice(0, 2).map((x) => [x.nombre, x.iniciales, x.bueno]), [['Dueña de agencia', 'DD', true], ['Coach', 'CO', false]], 'ordenados por gancho, sin «(sin dato)» ni los sin guiones');
});

test('tu gancho contra el bueno: la marca arriba, la aguja en su parte, y cada número contra su referencia', () => {
  const m = medidorDe(31.4, 9.2, 17.1);
  assert.equal(m.marca, HOOK_MID / TOPE_MEDIDOR);
  assert.equal(m.marca, 0.5, 'el buen gancho cae arriba, en el medio del arco');
  assert.ok(Math.abs(m.parte - 31.4 / TOPE_MEDIDOR) < 1e-9);
  assert.deepEqual(m.filas.map((f) => [f.texto, f.estado, f.nota]), [['31.4%', 'arriba', '3.4 arriba'], ['9.2%', 'abajo', '0.8 abajo'], ['17.1%', null, '17.1%']]);
  assert.ok(m.filas[1].nombre.includes(`${HOLD_MID}%`), 'el llamado se mide contra el mismo número del veredicto');
  assert.equal(medidorDe(80, null, null).parte, 1, 'la aguja no se pasa del arco');
  assert.deepEqual([medidorDe(null, null, null).valor, medidorDe(null, null, null).filas[0].nota], [null, null]);
});

test('la hoja entera con la muestra: las cifras cierran entre tarjetas', () => {
  const h = hoja();
  const v = vistaHooks(h, datosHooksMuestra(h, HOY));
  assert.equal(v.vacia, false);
  const guiones = v.numeros.find((n) => n.id === 'guiones')!.valor;
  assert.equal(v.ganchos!.filas.reduce((a, g) => a + g.guiones, 0), guiones, 'los guiones de cada gancho suman los analizados');
  assert.equal(v.avatares!.reduce((a, x) => a + x.guiones, 0), guiones, 'y los de cada avatar también');
  assert.deepEqual([v.apertura.tres, v.apertura.mitad, v.apertura.entero], [v.caida!.pasos[0].valor, v.caida!.pasos[2].valor, v.caida!.pasos[4].valor], 'la cabecera dice lo mismo que el embudo');
  assert.equal(v.medidor.valor, v.numeros[0].valor, 'el medidor es el hook rate del número');
  assert.equal(v.guiones!.filas.length, GUIONES);
  assert.ok(v.numeros.every((n) => n.texto && n.dias.length === 30 && n.cambio));
});

test('sin guiones, la hoja lo dice; leyendo o caída, cada tarjeta espera sin inventar', () => {
  const h = hoja(), p = h.diseno!.piezas;
  assert.equal(vistaHooks(h, { [p.guiones]: { resultado: res(['guiones'], [0]) } }).vacia, true, 'cero guiones analizados');
  const vacios = Object.fromEntries(Object.values(p).map((id) => [id, { resultado: res([], [], { clase: 'categoria' }) }]));
  assert.equal(vistaHooks(h, vacios).vacia, true, 'los ganchos y el video llegaron sin nada');
  const cargando = Object.fromEntries(Object.values(p).map((id) => [id, { cargando: true }]));
  const v = vistaHooks(h, cargando);
  assert.deepEqual([v.vacia, v.cargando, v.ganchos, v.caida, v.medidor.valor], [false, true, null, null, null]);
  const caida = vistaHooks(h, Object.fromEntries(Object.values(p).map((id) => [id, { error: 'caída' }])));
  assert.deepEqual([caida.vacia, caida.numeros.map((x) => x.texto)], [false, [null, null, null, null]]);
  assert.equal(vistaHooks(h, { [p.ia]: { cargando: true } }).cargando, false, 'la caja de IA se lee aparte: no deja la hoja leyendo');
});

test('el cableado: la plantilla trae su diseño con sus diez piezas, se ofrece y el editor la dibuja mirando', () => {
  assert.ok((DISENOS_HOJA as readonly string[]).includes('hooks'));
  assert.ok(PLANTILLAS_OFRECIDAS.some((p) => p.id === 'hooks-retencion'));
  const h = hoja();
  const porId = new Map(h.componentes.map((c) => [c.id, c as { fuente?: string; metricas?: string[]; dimension?: string | null; comparar?: boolean; tipo?: string }]));
  const pieza = (k: string) => porId.get(h.diseno!.piezas[k]);
  assert.equal(Object.keys(h.diseno!.piezas).length, 10);
  assert.ok(h.componentes.length <= 14, `${h.componentes.length} paneles (una hoja lleva hasta 14)`);
  for (const k of Object.keys(h.diseno!.piezas)) assert.ok(porId.has(h.diseno!.piezas[k]), `la pieza ${k} existe`);
  for (const k of ['hook', 'cta', 'thruplay', 'guiones']) assert.equal(pieza(k)?.comparar, true, `${k} se compara con el período anterior`);
  assert.deepEqual(pieza('gancho')?.metricas, ['hook_rate', 'ret_cta', 'thruplay_rate', 'guiones'], 'el selector cambia entre las tres y cuenta los guiones (la hoja SANEADA)');
  assert.deepEqual(pieza('avatar')?.metricas, ['hook_rate', 'ret_cta', 'guiones']);
  assert.deepEqual(pieza('video')?.metricas, ['plays_3s', 'p25', 'p50', 'p75', 'p100']);
  assert.equal(pieza('ia')?.tipo, 'ia', 'lo que escribió MaKo es la caja de IA de la hoja');
  const editor = leer('app/dashboard/EditorInforme.tsx');
  assert.ok(editor.includes("hoja.diseno?.id === 'hooks' && !enGrilla && !editando && !dueno"));
  assert.ok(editor.includes('<HooksVivo'));
  assert.ok(leer('app/dashboard/disenos/DisenoEnMiniatura.tsx').includes('vistaHooks(hoja, datosHooksMuestra(hoja, hoy))'));
  assert.match(leer('app/dashboard/disenos/HojaHooks.tsx'), /useCaja\(hoja\.id, compartido \|\| quieta \? undefined : p\.ia\)/, 'compartida o en miniatura no lee la caja de IA (pide sesión)');
});

// Probado rompiéndolo (5/11/2026), cada rotura sola y la base en verde antes y después (13 de 13):
//   · el ancho del embudo con otra potencia: 1 fallo, 9 pases;
//   · la caída más chica en vez de la más grande: 1 fallo, 9 pases;
//   · «(sin dato)» entre los ganchos: 1 fallo, 9 pases;
//   · el total de guiones sin los que el límite dejó afuera: 1 fallo, 9 pases;
//   · los avatares sin ordenar por gancho: 1 fallo, 9 pases;
//   · el tope del medidor en el triple del buen gancho: 1 fallo, 9 pases;
//   · lo que no llegó como 0: 2 fallos, 8 pases;
//   · la caja de IA dejando la hoja «leyendo»: 1 fallo, 9 pases;
//   · el hook rate sin su decimal: 3 fallos, 7 pases;
//   · la hoja vacía sólo por el número (no por los ganchos y el video vacíos): 1 fallo, 9 pases;
//   · el gancho sin el ThruPlay en la plantilla: 1 fallo, 9 pases;
//   · compartida, leyendo la caja de IA: 1 fallo, 9 pases;
//   · un número sin compararse con el período anterior: 1 fallo, 9 pases.
