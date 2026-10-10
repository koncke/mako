// =============================================================================
// El filtro del CRM por CAMPAÑA y por CREATIVO (06/10/2026)
// =============================================================================
// Pedido de Martín: «en el CRM pon un filtro por creativo o por campaña, para ver de qué
// ads vinieron los leads». La atribución es pura (lib/campana-atribucion.ts) y se EJECUTA;
// el cableado del tablero se fija leyendo el fuente sin comentarios.
//
// PROBADO ROMPIÉNDOLO — el resultado de cada rotura está al lado de su test.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mapaDeAnuncios, origenAds, opcionesDeFiltro, SIN_ORIGEN_ADS } from '../lib/campana-atribucion';
import { canalDeLead } from '../app/crm/origen-lead';

const CAMP = '120000000000000001';
const AD = '340000000000000001';
const AD2 = '340000000000000002';
const anuncios = mapaDeAnuncios([{ ad_id: AD, campaign_id: CAMP, adset_id: '230000000000000001' }]);
const campMap = { [CAMP]: 'Verano · nombre de hoy' };
const adMap = { [AD]: 'Video 1', [AD2]: 'Carrusel' };

// PROBADO ROMPIÉNDOLO: con la campaña sacada de `l.meta_campaign_id` solo (sin
// `campanaDeLead`), el lead del formulario queda en «Sin campaña» y cae este test.
test('un lead del formulario trae el ANUNCIO, y de ahí sale su campaña con el nombre de hoy', () => {
  const r = origenAds({ id: 1, meta_ad_id: AD, meta_campaign_name: 'Verano · nombre viejo' }, anuncios, campMap, adMap);
  assert.equal(r.campanaKey, CAMP, 'la clave es el id, no el nombre');
  assert.equal(r.campanaNombre, 'Verano · nombre de hoy', 'una campaña renombrada se ve con su nombre de hoy');
  assert.equal(r.anuncioKey, AD);
  assert.equal(r.anuncioNombre, 'Video 1');
});

test('la landing: el id de la campaña viene en utm_campaign y el anuncio en utm_content', () => {
  const r = origenAds({ id: 2, utm_campaign: CAMP, utm_content: AD2 + '000' }, anuncios, campMap, adMap);
  assert.equal(r.campanaKey, CAMP);
  // utm_content con un número de 21 dígitos no es un id de anuncio (los de Meta tienen
  // 15-18): no se inventa un creativo.
  assert.equal(r.anuncioKey, null);
});

test('sin id pero con NOMBRE guardado, la clave es el nombre — no se tira a «Sin campaña»', () => {
  const r = origenAds({ id: 3, meta_campaign_name: 'Campaña vieja', meta_ad_name: 'Anuncio viejo' }, anuncios, campMap, adMap);
  assert.equal(r.campanaKey, 'n:Campaña vieja');
  assert.equal(r.anuncioKey, 'n:Anuncio viejo');
  // Y un utm_campaign con NOMBRE también sirve para mostrar, pero nunca decide un id.
  assert.equal(origenAds({ id: 4, utm_campaign: 'promo-octubre' }, anuncios, campMap, adMap).campanaKey, 'n:promo-octubre');
});

test('sin nada, null en los dos: el lead va a «Sin campaña» / «Sin creativo»', () => {
  const r = origenAds({ id: 5 }, anuncios, campMap, adMap);
  assert.deepEqual(r, { campanaKey: null, campanaNombre: null, anuncioKey: null, anuncioNombre: null });
});

// PROBADO ROMPIÉNDOLO: con el `sort` quitado, el orden sale por aparición y cae.
test('las opciones van de la que más leads tiene a la que menos, y «Sin …» al final', () => {
  const op = opcionesDeFiltro([
    { key: 'a', nombre: 'A' }, { key: null, nombre: null }, { key: 'b', nombre: 'B' }, { key: 'b', nombre: 'B' },
  ], 'Sin campaña');
  assert.deepEqual(op, [
    { value: 'b', label: 'B', n: 2 },
    { value: 'a', label: 'A', n: 1 },
    { value: SIN_ORIGEN_ADS, label: 'Sin campaña', n: 1 },
  ]);
  assert.deepEqual(opcionesDeFiltro([{ key: 'a', nombre: 'A' }], 'Sin campaña').map((o) => o.value), ['a'], '«Sin …» sólo si hay');
});

const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// PROBADO ROMPIÉNDOLO: con la línea del filtro de creativo borrada de `matches`, cae.
test('el tablero filtra por las DOS claves, con «Sin …» para el null, y las ofrece en el menú', () => {
  const b = sinComentarios(readFileSync('app/crm/CrmBoard.tsx', 'utf8'));
  assert.match(b, /campanaFilter\.size > 0 && !campanaFilter\.has\(l\.campanaKey \?\? SIN_ORIGEN_ADS\)/);
  assert.match(b, /creativoFilter\.size > 0 && !creativoFilter\.has\(l\.anuncioKey \?\? SIN_ORIGEN_ADS\)/);
  assert.match(b, /listas=\{listasFiltro\}[\s\S]*listas=\{listasFiltro\}/, 'el menú y los chips reciben las listas');
  // Y limpiar todo también las limpia: un filtro que «Limpiar» no saca es invisible.
  assert.match(b, /const limpiarTodo = \(\) => \{[^}]*setCampanaFilter\(new Set\(\)\);[^}]*setCreativoFilter\(new Set\(\)\);/);
  // La página le pasa la atribución al mapper: sin esto los cuatro campos van en null y el
  // filtro existe sin opciones.
  const page = sinComentarios(readFileSync('app/crm/page.tsx', 'utf8'));
  assert.match(page, /mapToCrmLead\(l, campMap, validStageKeys, atrib\)/);
});

// =============================================================================
// 10/10/2026 — «Acá al filtrar, en campaña, y en Origen, aparece lo mismo. Y falta el
// filtro de ANUNCIO, para filtrar por un ad específico.» (Martín)
// =============================================================================
// Los dos síntomas tenían causas distintas, y ninguna estaba en la atribución, que ya
// tenía su test (el de la landing, arriba, pasaba):
//   · el ANUNCIO no aparecía porque el tablero no PEDÍA `utm_content`: la función
//     entendía el id y nunca le llegaba. Función verde, cableado sin datos.
//   · el ORIGEN repetía las campañas porque el filtro listaba `origenLegible`, que dice
//     lo más específico que se sabe (anuncio › campaña › canal) — bien para la tarjeta,
//     mal para un filtro que tiene a «Campaña» y «Anuncio» al lado.

/** Las columnas que baja el tablero. Los comentarios se sacan ANTES de buscar el `;`: el
 *  de las cuatro columnas nuevas tiene uno, y cortar ahí dejaría la lista a la mitad. */
function columnasDelTablero(): Set<string> {
  const src = sinComentarios(readFileSync('lib/leads.ts', 'utf8'));
  const i = src.indexOf('const LISTA_COLS =');
  const bloque = src.slice(i, src.indexOf(';', i));
  assert.ok(i > 0 && bloque.length > 200, `LISTA_COLS mide ${bloque.length}`);
  return new Set([...bloque.matchAll(/'([^']*)'/g)].flatMap((m) => m[1].split(',')).map((c) => c.trim()).filter(Boolean));
}

/** Los campos `lead.X` que lee una función, leídos de su cuerpo real. */
function camposQueLee(archivo: string, firma: string): string[] {
  const src = sinComentarios(readFileSync(archivo, 'utf8')).replace(/\r/g, '');
  const i = src.indexOf(firma);
  assert.ok(i > 0, `no encontré ${firma} en ${archivo}`);
  const cuerpo = src.slice(i, src.indexOf('\n}\n', i));
  return [...new Set([...cuerpo.matchAll(/\blead\.(\w+)/g)].map((m) => m[1]))];
}

test('el tablero baja TODAS las columnas que leen sus mappers (si no, el filtro existe sin datos)', () => {
  const cols = columnasDelTablero();
  // Lo que lee la atribución (el filtro por campaña y por anuncio), sacado del TIPO que
  // recibe — no de una lista copiada acá, que se quedaría vieja con el próximo campo.
  // `funnel_id` queda afuera a propósito: el tablero filtra por ella en el server y su
  // comentario en `Lead` lo dice.
  const atrib = sinComentarios(readFileSync('lib/campana-atribucion.ts', 'utf8'));
  const t0 = atrib.indexOf('export type LeadAtribuible = {');
  const camposAtrib = [...atrib.slice(t0, atrib.indexOf('};', t0)).matchAll(/^\s*(\w+)\??:/gm)]
    .map((m) => m[1]).filter((c) => c !== 'funnel_id');
  const requeridas = [
    ...camposAtrib,
    ...camposQueLee('app/crm/crm-map.ts', 'export function origenLegible('),
    ...camposQueLee('app/crm/origen-lead.ts', 'export function canalDeLead('),
  ];
  assert.ok(requeridas.includes('utm_content') && requeridas.includes('origen_lead'), 'la derivación tiene que ver las dos que faltaban');
  const faltan = [...new Set(requeridas)].filter((c) => !cols.has(c));
  assert.deepEqual(faltan, [], `el tablero no pide estas columnas y los mappers las leen: ${faltan.join(', ')}`);
  //   ROTO A PROPÓSITO (2026-10-10): devolviendo el bug —`utm_content` afuera del select—,
  //   pass 9 / fail 1; y sacando `origen_lead`, pass 9 / fail 1.
});

test('el filtro «Origen» lista el CANAL, no la campaña ni el anuncio', () => {
  const b = sinComentarios(readFileSync('app/crm/CrmBoard.tsx', 'utf8'));
  assert.match(b, /originFilter\.size > 0 && !originFilter\.has\(l\.canal\)/);
  assert.match(b, /const originOptions = useMemo\(\(\) => \[\.\.\.new Set\(leads\.map\(\(l\) => l\.canal\)\)\]/);
  assert.doesNotMatch(b, /originFilter\.has\(l\.origin\)/, 'volvió el origen de la tarjeta al filtro');
  assert.match(sinComentarios(readFileSync('app/crm/crm-map.ts', 'utf8')), /canal: canalDeLead\(l\)/);
  //   ROTO A PROPÓSITO (2026-10-10): con el filtro otra vez sobre `l.origin`, pass 9 / fail 1.
});

test('canalDeLead: por dónde entró, con el formulario de Meta aunque falte la columna', () => {
  assert.equal(canalDeLead({ origen_lead: 'landing' }), 'Landing');
  assert.equal(canalDeLead({ origen_lead: 'calcom' }), 'Cal.com');
  assert.equal(canalDeLead({ origen_lead: null, meta_lead_id: '1234567890' }), 'Meta · Instant Form');
  assert.equal(canalDeLead({}), 'Sin origen');
  //   ROTO A PROPÓSITO (2026-10-10): con el lead de Meta sin columna cayendo a «Sin
  //   origen», pass 9 / fail 1.
});

test('el filtro por anuncio se llama «Anuncio», la palabra de Martín y del Ads Manager', () => {
  const b = sinComentarios(readFileSync('app/crm/CrmBoard.tsx', 'utf8'));
  assert.match(b, /\{ cat: 'creativo', label: 'Anuncio'/);
  assert.match(b, /facetas\('creativo', creativoFilter, 'Sin anuncio'\)/);
  assert.doesNotMatch(b, /label: 'Creativo'/);
  //   ROTO A PROPÓSITO (2026-10-10): con el rótulo otra vez «Creativo», pass 9 / fail 1.
});
