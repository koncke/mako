// Tests de la audiencia de Meta del Dashboard (lib/graficos-audiencia.ts) y del mapa de México
// (lib/geo-regiones.ts, antes app/dashboard/MapaMexico.tsx). Correr: npx tsx --test tests/graficos-audiencia.test.ts
//
// Las filas de ejemplo son las que mandó Meta el 11/10/2026 para la cuenta del ws1 (Graph v25.0,
// del 14/07 al 11/10), recortadas: los números vienen como TEXTO y los nombres de región, como
// los nombra Meta.
//
// Probados rompiéndolos (11/10/2026), con la base en 10 pases y 0 fallos:
//   · `plataforma` leyendo la lectura de región              -> 2 fallos («una dimensión…», «37 meses»)
//   · la agenda en cero aunque la lectura no traiga ninguna    -> 1 fallo («con región Meta no da la agenda»)
//   · el diccionario sin «distrito federal»                    -> 2 fallos («las regiones de Meta…», «lo que no se ubica…»)
//   · volver al `startsWith` de antes como respaldo            -> 1 fallo («un pedazo de nombre no es un estado»)
//   · lo que no se ubica, tirado en vez de contado             -> 1 fallo («lo que no se ubica…»)
//   · `sin_conexion` sin su mensaje                            -> 1 fallo («sin Meta conectada…»)
//   · sin el tope de 37 meses                                  -> 1 fallo («Meta guarda 37 meses…»)
//   · la ruta del Ads Manager con su propia acción de agenda   -> 1 fallo («la agenda se cuenta en UN lugar»)
//   · la clave `alcance` renombrada SÓLO en la Fila            -> 1 fallo acá («el armado…»), y el guard de
//     tests/graficos.test.ts sigue en 20 / 0: lee el cuerpo como texto y encuentra `alcance:` en `FilaMeta`.
//   · la edad sin `ordenEtiqueta` (ordenada por la métrica)   -> 12 / 1 («la edad se lee en orden de tramo…»)
//   · el lector con `?? 'region'` para un cuadro sin dimensión -> 12 / 1 («un cuadro de resultados…»)
// Y el guard de tests/graficos.test.ts («el lector llena cada métrica…») con el lector vacío de antes da
// 19 / 1 («audiencia no llena la métrica impresiones»); con éste, 20 / 0.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  filasAudiencia, filasDeDesglose, lecturaDe, desdeQueGuardaMeta, etiquetaPlataforma, ACCION_AGENDA,
} from '../lib/graficos-audiencia';
import { agregar, SinConexionError, type Fila } from '../lib/graficos-agregar';
import { sanearGrafico, esGrafico } from '../lib/graficos-catalogo';
import { tableroInicial } from '../lib/graficos-plantillas';
// El mapa de México se generalizó a cualquier país (v5): las reglas de México viven en lib/geo-regiones.ts.
import { ESTADOS_MX as ESTADOS, normalizarRegion, codigoDeRegion as codigoEnPais, ubicarRegiones as ubicarEnPais } from '../lib/geo-regiones';
const codigoDeRegion = (n: string) => codigoEnPais('MX', n);
const ubicarRegiones = (rs: Array<{ etiqueta: string; valor: number }>) => ubicarEnPais('MX', rs);

type Cruda = Record<string, unknown>;
const acc = (tipo: string, valor: number) => ({ action_type: tipo, value: String(valor) });

// Con región Meta no manda NINGUNA conversión de afuera de Meta (ni la agenda ni landing_page_view).
const REGION: Cruda[] = [
  { region: 'Distrito Federal', impressions: '36817', reach: '15987', inline_link_clicks: '1289', spend: '1730', actions: [acc('link_click', 1289), acc('video_view', 20334)] },
  { region: 'State of Mexico', impressions: '45415', reach: '17520', inline_link_clicks: '1604', spend: '3460', actions: [acc('link_click', 1604)] },
  { region: 'San Luis Potosi', impressions: '9162', reach: '3472', inline_link_clicks: '270', spend: '173', actions: [acc('link_click', 270)] },
  { region: 'Unknown', impressions: '55', reach: '44', inline_link_clicks: '8', spend: '17.3', actions: [acc('link_click', 8)] },
];
const PLATAFORMA: Cruda[] = [
  { publisher_platform: 'facebook', impressions: '443413', reach: '153178', inline_link_clicks: '9301', spend: '17300', actions: [acc('link_click', 9301), acc(ACCION_AGENDA, 60), acc('offsite_conversion.fb_pixel_lead', 40)] },
  { publisher_platform: 'instagram', impressions: '31524', reach: '15082', inline_link_clicks: '851', spend: '1730', actions: [acc(ACCION_AGENDA, 26)] },
  { publisher_platform: 'audience_network', impressions: '33698', reach: '22287', inline_link_clicks: '5243', spend: '865', actions: [acc(ACCION_AGENDA, 14)] },
  { publisher_platform: 'messenger', impressions: '8', reach: '8', inline_link_clicks: '0', spend: '0.5', actions: [] },
  { publisher_platform: 'unknown', impressions: '0', reach: '0', inline_link_clicks: '0', spend: '0' },
];
const EDAD_GENERO: Cruda[] = [
  { age: '25-34', gender: 'female', impressions: '16714', reach: '7757', inline_link_clicks: '1001', spend: '346', actions: [acc(ACCION_AGENDA, 1)] },
  { age: '25-34', gender: 'male', impressions: '46420', reach: '16450', inline_link_clicks: '1146', spend: '692', actions: [acc(ACCION_AGENDA, 23)] },
  { age: '25-34', gender: 'unknown', impressions: '697', reach: '267', inline_link_clicks: '19', spend: '17.3' },
  { age: 'Unknown', gender: 'unknown', impressions: '0', reach: '0', inline_link_clicks: '0', spend: '0' },
];
const POR_LECTURA: Record<string, Cruda[]> = { region: REGION, publisher_platform: PLATAFORMA, 'age,gender': EDAD_GENERO };
const aUsd = (n: number) => n / 17.3;
const RG = { desde: '2026-07-14', hasta: '2026-10-11', sinRango: false };
const HOY = '2026-10-11';

/** Un lector falso que anota qué lectura se pidió. */
function lectorFalso() {
  const pedidas: string[] = [];
  const leer = async (p: { desde: string; hasta: string; breakdown: string }) => { pedidas.push(`${p.breakdown}|${p.desde}|${p.hasta}`); return POR_LECTURA[p.breakdown]; };
  return { pedidas, leer };
}

test('el armado: los números de Meta (texto) a números, el gasto a dólares y la agenda del Pixel', () => {
  const filas = filasDeDesglose(PLATAFORMA, 'publisher_platform', RG.desde, aUsd);
  const fb = filas.find((f) => f.d.plataforma === 'Facebook')!;
  assert.deepEqual(fb, { f: RG.desde, d: { plataforma: 'Facebook' }, v: { impresiones: 443413, alcance: 153178, clics: 9301, gasto: 1000, agendas: 60 } });
  assert.deepEqual(filas.map((f) => f.d.plataforma), ['Facebook', 'Instagram', 'Audience Network', 'Messenger'], 'la fila de «unknown» con todo en cero no entra');
  // Messenger no trae la acción, en una lectura que SÍ trae conversiones: ahí la agenda es un cero de verdad.
  assert.equal(filas.find((f) => f.d.plataforma === 'Messenger')!.v.agendas, 0);
  assert.equal(etiquetaPlataforma('threads_feed'), 'Threads feed', 'una plataforma nueva sale legible, no cruda');
  assert.equal(etiquetaPlataforma('unknown'), null);
});

test('con región Meta no da la agenda: la fila no la trae (no es un cero), y la región va como la manda Meta', () => {
  const filas = filasDeDesglose(REGION, 'region', RG.desde, aUsd);
  assert.deepEqual(filas.map((f) => f.d.region), ['Distrito Federal', 'State of Mexico', 'San Luis Potosi', null], '«Unknown» es «(sin dato)»');
  for (const f of filas) assert.ok(!('agendas' in f.v), `${f.d.region} trae agendas: ${f.v.agendas}`);
  assert.equal(filas[1].v.gasto, 200);
});

test('edad y género: una sola lectura, y cada fila trae las dos', () => {
  const filas = filasDeDesglose(EDAD_GENERO, 'age,gender', RG.desde, aUsd);
  assert.deepEqual(filas.map((f) => f.d), [
    { edad: '25-34', genero: 'Mujeres' }, { edad: '25-34', genero: 'Hombres' }, { edad: '25-34', genero: null },
  ], 'la edad «Unknown» con todo en cero no entra, y «unknown» de género es «(sin dato)»');
  assert.deepEqual(filas.map((f) => f.v.agendas), [1, 23, 0]);
});

test('una dimensión trae SÓLO su desglose: una lectura por gráfico, la de su dimensión', async () => {
  const casos: Array<[string, string | null, string]> = [
    ['region', null, 'region'], ['plataforma', null, 'publisher_platform'], ['edad', null, 'age,gender'],
    ['genero', null, 'age,gender'], ['edad', 'genero', 'age,gender'], ['genero', 'edad', 'age,gender'],
  ];
  for (const [dim, desg, lectura] of casos) {
    assert.equal(lecturaDe(dim, desg), lectura, `${dim}/${desg}`);
    const { pedidas, leer } = lectorFalso();
    const filas = await filasAudiencia(dim, desg, RG, { leer, aUsd, hoy: HOY });
    assert.deepEqual(pedidas, [`${lectura}|${RG.desde}|${RG.hasta}`], `${dim}: se pidió una sola lectura, la suya`);
    const claves = new Set(filas.flatMap((f) => Object.keys(f.d)));
    assert.deepEqual([...claves].sort(), lectura === 'age,gender' ? ['edad', 'genero'] : [dim], `${dim}: sólo sus dimensiones`);
  }
  // Y el total de un mapa por región es el de la región, no el de las tres lecturas sumadas.
  const { leer } = lectorFalso();
  const g = sanearGrafico({ id: 'm', tipo: 'mapa', fuente: 'audiencia', dimension: 'region', metricas: ['impresiones'], limite: 50 })!;
  const r = agregar(g, await filasAudiencia('region', null, RG, { leer, aUsd, hoy: HOY }), RG.desde, RG.hasta);
  assert.equal(r.totales[0], 36817 + 45415 + 9162 + 55);
  // Sin dimensión del conjunto (un cuadro de resultados) va por edad y género: la que trae las agendas.
  assert.equal(lecturaDe(null), 'age,gender');
});

// Visto en el PDF del 11/10/2026: «Edad y género» salía 45-54, 55-64, 18-24 (ordenada por impresiones).
test('la edad se lee en orden de tramo (18-24 … 65+), no de la que más a la que menos; «(sin dato)» al final', () => {
  const fila = (edad: string | null, imp: number): Fila => ({ f: RG.desde, d: { edad, genero: 'Hombres' }, v: { impresiones: imp } });
  const filas = [fila('45-54', 900), fila('65+', 50), fila('18-24', 300), fila(null, 999), fila('25-34', 100), fila('55-64', 700)];
  const g = sanearGrafico({ id: 'e', tipo: 'columnas', fuente: 'audiencia', dimension: 'edad', metricas: ['impresiones'] })!;
  assert.deepEqual(agregar(g, filas, RG.desde, RG.hasta).filas.map((f) => f.clave), ['18-24', '25-34', '45-54', '55-64', '65+', '(sin dato)']);
  // Las demás dimensiones siguen de la que más a la que menos.
  const p = sanearGrafico({ id: 'p', tipo: 'barras', fuente: 'audiencia', dimension: 'plataforma', metricas: ['impresiones'] })!;
  const porPlat = [{ f: RG.desde, d: { plataforma: 'Instagram' }, v: { impresiones: 5 } }, { f: RG.desde, d: { plataforma: 'Facebook' }, v: { impresiones: 50 } }];
  assert.deepEqual(agregar(p, porPlat, RG.desde, RG.hasta).filas.map((f) => f.clave), ['Facebook', 'Instagram']);
});

test('un cuadro de resultados de la audiencia (sin dimensión) NO lee la región: ahí Meta no da agendas', () => {
  const datos = readFileSync(join(__dirname, '..', 'lib', 'graficos-datos.ts'), 'utf8').replace(/\r\n/g, '\n');
  const linea = datos.split('\n').find((l) => /^\s*audiencia: \(/.test(l));
  assert.ok(linea, 'no encontré el lector de la audiencia en LECTORES');
  assert.match(linea!, /filasAudiencia\(g\?\.dimension \?\? ''/);
});

test('sin Meta conectada: el mensaje que llega a la tarjeta, y lo que no es de conexión sube igual', async () => {
  const falla = (motivo: string) => ({ leer: async () => { throw Object.assign(new Error('x'), { motivo }); }, aUsd, hoy: HOY });
  await assert.rejects(filasAudiencia('region', null, RG, falla('sin_conexion')), (e: unknown) => e instanceof SinConexionError && e.message === 'Conecta Meta para ver tu audiencia');
  await assert.rejects(filasAudiencia('region', null, RG, falla('token_vencido')), (e: unknown) => e instanceof SinConexionError && e.message === 'Vuelve a conectar Meta para ver tu audiencia');
  await assert.rejects(filasAudiencia('region', null, RG, falla('meta')), (e: unknown) => !(e instanceof SinConexionError) && (e as Error).message === 'x');
  assert.deepEqual(await filasAudiencia('region', null, RG, falla('sin_workspace')), [], 'quien no está en un negocio no tiene audiencia, como no tiene leads');
});

test('Meta guarda 37 meses: el período se pide desde ahí (pedirlo entero es el error #3018)', async () => {
  assert.equal(desdeQueGuardaMeta('2020-01-01', HOY), '2023-09-13');
  assert.equal(desdeQueGuardaMeta('2026-01-01', HOY), '2026-01-01');
  const { pedidas, leer } = lectorFalso();
  await filasAudiencia('plataforma', null, { desde: '2020-01-01', hasta: HOY, sinRango: false }, { leer, aUsd, hoy: HOY });
  assert.deepEqual(pedidas, [`publisher_platform|2023-09-13|${HOY}`]);
  const vacio = lectorFalso();
  assert.deepEqual(await filasAudiencia('region', null, { desde: '2019-01-01', hasta: '2019-12-31', sinRango: false }, { leer: vacio.leer, aUsd, hoy: HOY }), []);
  assert.deepEqual(vacio.pedidas, [], 'un período que Meta ya no guarda no se le pide');
});

test('la agenda se cuenta en UN lugar: la ruta del Ads Manager y Meta no tienen su propia acción', () => {
  const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const leer = (...p: string[]) => sinComentarios(readFileSync(join(__dirname, '..', ...p), 'utf8'));
  assert.doesNotMatch(leer('app', 'api', 'account-insights', 'route.ts'), /offsite_conversion|actionVal|agendasDe/);
  assert.doesNotMatch(leer('lib', 'meta-desgloses.ts'), /offsite_conversion/);
  assert.match(leer('app', 'api', 'account-insights', 'route.ts'), /leerFilaMeta\(/);
});

// ── El mapa ──────────────────────────────────────────────────────────────────────────────

// Los 33 nombres que mandó Meta (los 32 estados y «Unknown») y los 32 del GeoJSON, tal cual.
const META = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas', 'Chihuahua', 'Coahuila de Zaragoza', 'Colima',
  'Distrito Federal', 'Durango', 'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco', 'Michoacán de Ocampo', 'Morelos', 'Nayarit',
  'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro Arteaga', 'Quintana Roo', 'San Luis Potosi', 'Sinaloa', 'Sonora', 'State of Mexico',
  'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Unknown', 'Veracruz', 'Yucatán', 'Zacatecas',
];
const GEO: Array<[string, string]> = [
  ['Zacatecas', 'MX-ZAC'], ['Yucatán', 'MX-YUC'], ['Veracruz', 'MX-VER'], ['Tlaxcala', 'MX-TLA'], ['Tamaulipas', 'MX-TAM'],
  ['Tabasco', 'MX-TAB'], ['Sonora', 'MX-SON'], ['Sinaloa', 'MX-SIN'], ['San Luis Potosí', 'MX-SLP'], ['Quintana Roo', 'MX-ROO'],
  ['Querétaro', 'MX-QUE'], ['Puebla', 'MX-PUE'], ['Oaxaca', 'MX-OAX'], ['Nuevo León', 'MX-NLE'], ['Nayarit', 'MX-NAY'],
  ['Morelos', 'MX-MOR'], ['Michoacán', 'MX-MIC'], ['México', 'MX-MEX'], ['Jalisco', 'MX-JAL'], ['Hidalgo', 'MX-HID'],
  ['Guerrero', 'MX-GRO'], ['Guanajuato', 'MX-GUA'], ['Durango', 'MX-DUR'], ['Ciudad de México', 'MX-CMX'], ['Colima', 'MX-COL'],
  ['Coahuila', 'MX-COA'], ['Chihuahua', 'MX-CHH'], ['Chiapas', 'MX-CHP'], ['Campeche', 'MX-CAM'], ['Baja California Sur', 'MX-BCS'],
  ['Baja California', 'MX-BCN'], ['Aguascalientes', 'MX-AGU'],
];

test('las regiones de Meta (medidas) caen cada una en SU estado del GeoJSON, sin prefijos', () => {
  for (const [nombre, id] of GEO) assert.equal(codigoDeRegion(nombre), id, nombre);
  const codigos = META.filter((n) => n !== 'Unknown').map((n) => [n, codigoDeRegion(n)] as const);
  for (const [n, c] of codigos) assert.ok(c, `${n} no se ubica`);
  assert.equal(new Set(codigos.map(([, c]) => c)).size, 32, 'dos nombres de Meta no caen en el mismo estado');
  assert.deepEqual(new Set(codigos.map(([, c]) => c)), new Set(Object.keys(ESTADOS)));
  // Las que rompía el `startsWith` de antes: CDMX y el Estado de México, cada una en la suya.
  assert.equal(codigoDeRegion('Distrito Federal'), 'MX-CMX');
  assert.equal(codigoDeRegion('Mexico City'), 'MX-CMX');
  assert.equal(codigoDeRegion('State of Mexico'), 'MX-MEX');
  assert.equal(codigoDeRegion('Estado de México'), 'MX-MEX');
  assert.equal(codigoDeRegion('México D.F.'), 'MX-CMX');
  assert.equal(codigoDeRegion('Unknown'), null);
  assert.equal(codigoDeRegion('Baja'), null, 'un pedazo de nombre no es un estado');
  assert.equal(normalizarRegion('  San Luis   Potosí '), 'san luis potosi');
});

// ⚠️ `todo` A PROPÓSITO hasta que se aplique el arreglo de lib/graficos-agregar.ts (no es de este
// paquete): `agregar` recorta todo gráfico que no sea un histograma a su `limite`, que por defecto
// es 10, y el mapa de la plantilla Marketing no lo declara. Medido con la respuesta real de Meta
// (33 regiones): le llegan 10 y quedan 23 afuera, que el mapa dibuja «Sin datos» teniendo datos.
// Hoy falla (10 ≠ 32): ésa es su rotura. Con el mapa sin recorte (probado forzando `limite: 50`)
// llegan las 33 y se ubican los 32 estados: pasa. Cuando el mapa quede exento del límite, se saca
// el `todo`.
test('el mapa de la hoja Marketing recibe TODOS los estados, no los del límite por defecto', async () => {
  const mapa = tableroInicial().hojas.flatMap((h) => h.componentes).filter(esGrafico).find((c) => c.tipo === 'mapa');
  if (!mapa) throw new Error('la plantilla Marketing no tiene un mapa');
  const crudas = META.map((region, i) => ({ region, impressions: String(1000 + i), reach: '10', inline_link_clicks: '1', spend: '1' }));
  const r = agregar(mapa, filasDeDesglose(crudas, 'region', RG.desde, aUsd), RG.desde, RG.hasta);
  const ubicados = ubicarRegiones(r.filas.map((f) => ({ etiqueta: f.etiqueta, valor: f.valores[0] ?? 0 })));
  assert.equal(ubicados.porCodigo.size, 32, `al mapa le llegan ${r.filas.length} regiones y ${r.fuera} quedan afuera`);
});

test('lo que no se ubica se cuenta aparte, no se pinta en cero; dos nombres del mismo estado se suman', () => {
  const u = ubicarRegiones([
    { etiqueta: 'Buenos Aires', valor: 10 }, { etiqueta: 'Jalisco', valor: 5 }, { etiqueta: 'Distrito Federal', valor: 3 },
    { etiqueta: 'Ciudad de México', valor: 2 }, { etiqueta: '(sin dato)', valor: 4 }, { etiqueta: 'Córdoba', valor: 0 },
  ]);
  assert.deepEqual([...u.porCodigo.entries()].sort(), [['MX-CMX', 5], ['MX-JAL', 5]]);
  assert.deepEqual(u.sinUbicar.map((r) => r.etiqueta), ['Buenos Aires', '(sin dato)'], 'una región en cero no suma al aviso');
});

// El chequeo del guard de tests/graficos.test.ts («el lector llena cada métrica…») cubre que
// `filasAudiencia` llene cada métrica y dimensión del conjunto; acá, que el lector no invente.
test('lo que el lector devuelve es una Fila del Dashboard: sólo números finitos', async () => {
  const { leer } = lectorFalso();
  for (const dim of ['region', 'plataforma', 'edad']) {
    const filas: Fila[] = await filasAudiencia(dim, null, RG, { leer, aUsd, hoy: HOY });
    for (const f of filas) for (const [k, v] of Object.entries(f.v)) assert.ok(Number.isFinite(v), `${dim}.${k} = ${v}`);
  }
});
