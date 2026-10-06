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
