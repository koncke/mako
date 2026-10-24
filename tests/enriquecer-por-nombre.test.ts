// =============================================================================
// Completar un lead por su nombre: la web y el Instagram, y NUNCA uno que no se pueda afirmar
// =============================================================================
// 24/10/2026, el escalón 2 de la base de venta (lib/enriquecer-reglas.ts, lib/enriquecer-por-nombre.ts). Los resultados
// tienen la forma del ejemplo publicado del actor `compass/crawler-google-places` (searchString, title, phoneUnformatted,
// website, instagrams, placeId): NO de una corrida real, que no se pudo hacer (ningún negocio tiene clave de Apify).
//
// Probado rompiéndolo (24/10/2026), una rotura por vez, restaurando desde memoria:
//   · el emparejado por teléfono quitado (sólo por nombre)                        → 7 pasan / 1 falla;
//   · `unica` que devuelve el primero aunque los lugares digan cosas distintas    → 7 / 1;
//   · la exclusión del lugar con OTRO teléfono quitada                            → 7 / 1;
//   · `l.busqueda === q` quitado (un lugar de la búsqueda de otro, por nombre)   → 7 / 1;
//   · el `credWs('APIFY_TOKEN'` cambiado por una clave del entorno                → 7 / 1.
// Base: 8 / 0.
//
// Correr: node --import tsx --test tests/enriquecer-por-nombre.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  emparejar, consultaDe, inputEnriquecer, pedidosValidos, techoEnriquecer, nombreComparable, POR_CONSULTA, TOPE_PEDIDOS,
} from '../lib/enriquecer-reglas';

const leer = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

let n = 0;
const lugar = (p: { busqueda: string; titulo: string; tel?: string; web?: string; ig?: string }) => ({
  searchString: p.busqueda, title: p.titulo, placeId: `pl${++n}`,
  ...(p.tel ? { phoneUnformatted: p.tel } : {}), ...(p.web ? { website: p.web } : {}),
  ...(p.ig ? { instagrams: [`https://www.instagram.com/${p.ig}/`] } : {}),
});

test('el TELÉFONO manda: el lugar con el número del lead, aunque no sea el primero', () => {
  const p = { id: 'L1', nombre: 'Booom', telefono: '+52 1 55 1234 5678' };
  const q = consultaDe(p);
  const [h] = emparejar([p], [
    lugar({ busqueda: q, titulo: 'Booom Café', tel: '+525599990000', web: 'https://cafe.example' }),
    lugar({ busqueda: q, titulo: 'Booom PR', tel: '+525512345678', web: 'https://www.booompr.com', ig: 'booompr' }),
  ]);
  assert.deepEqual(h, { id: 'L1', web: 'https://www.booompr.com', instagram: 'booompr', confianza: 'telefono', lugar: 'Booom PR' });
});

test('sin teléfono, el nombre igual (sin acentos ni puntuación) y el único así', () => {
  const p = { id: 'L2', nombre: 'Inmobiliaria Pérez' };
  const q = consultaDe(p);
  const [h] = emparejar([p], [lugar({ busqueda: q, titulo: 'INMOBILIARIA PEREZ.', web: 'https://perez.example' })]);
  assert.equal(h.confianza, 'nombre');
  assert.equal(h.web, 'https://perez.example');
  assert.equal(nombreComparable('Inmobiliaria  Pérez S.A.'), 'inmobiliaria perez s a');
});

test('dos lugares que califican y dicen cosas distintas: vacío, nunca el primero', () => {
  const p = { id: 'L3', nombre: 'Casa Azul' };
  const q = consultaDe(p);
  const [h] = emparejar([p], [
    lugar({ busqueda: q, titulo: 'Casa Azul', web: 'https://a.example' }),
    lugar({ busqueda: q, titulo: 'Casa Azul', web: 'https://b.example' }),
  ]);
  assert.deepEqual(h, { id: 'L3', web: null, instagram: null, confianza: null, lugar: null });
});

test('el mismo nombre con OTRO teléfono no es el lead (otra sucursal, otro negocio)', () => {
  const p = { id: 'L4', nombre: 'Casa Azul', telefono: '5511112222' };
  const [h] = emparejar([p], [lugar({ busqueda: consultaDe(p), titulo: 'Casa Azul', tel: '5533334444', web: 'https://a.example' })]);
  assert.equal(h.confianza, null);
});

test('por nombre sólo entre los lugares de SU búsqueda, y sin web ni Instagram no hay nada que dar', () => {
  const a = { id: 'A', nombre: 'Luna' };
  const b = { id: 'B', nombre: 'Luna', ciudad: 'Tijuana' };
  const [ha, hb] = emparejar([a, b], [lugar({ busqueda: consultaDe(b), titulo: 'Luna', web: 'https://luna.example' })]);
  assert.equal(ha.confianza, null, 'el lugar vino por la búsqueda del otro lead');
  assert.equal(hb.web, 'https://luna.example');
  const c = { id: 'C', nombre: 'Sol', telefono: '5500001111' };
  assert.equal(emparejar([c], [lugar({ busqueda: consultaDe(c), titulo: 'Sol', tel: '5500001111' })])[0].confianza, null);
});

test('la tanda: sin repetidos, sin leads sin nombre, con tope y techo de plata', () => {
  const v = pedidosValidos([{ id: '1', nombre: 'A' }, { id: '1', nombre: 'A' }, { id: '2', nombre: '  ' }, { id: '3', nombre: 'B', ciudad: 'CDMX' }]);
  assert.deepEqual(v.map((p) => p.id), ['1', '3']);
  assert.equal(pedidosValidos(Array.from({ length: TOPE_PEDIDOS + 5 }, (_, i) => ({ id: String(i), nombre: `N${i}` }))).length, TOPE_PEDIDOS);
  const inp = inputEnriquecer([{ id: '1', nombre: 'A' }, { id: '9', nombre: 'A' }]);
  assert.deepEqual(inp.searchStringsArray, ['A'], 'dos leads con la misma búsqueda son una búsqueda');
  assert.equal(inp.maxCrawledPlacesPerSearch, POR_CONSULTA);
  assert.equal(inp.scrapeContacts, true, 'sin los contactos de la web no sale el Instagram');
  assert.ok(techoEnriquecer(221) > 0 && techoEnriquecer(221) < 10, `221 leads no pueden pasar de US$10 (dio ${techoEnriquecer(221)})`);
});

const SRV = sinComentarios(leer('../lib/enriquecer-por-nombre.ts'));

test('la clave es la del NEGOCIO, la corrida va con techo, y no escribe nada', () => {
  assert.match(SRV, /credWs\('APIFY_TOKEN', ws\)/);
  assert.ok(!/process\.env/.test(SRV), 'una clave del entorno sería la plata de MaKo');
  assert.match(SRV, /maxUsd: techoUsd/);
  assert.ok(!/\.from\(|updateLead\(|createLead\(|enriquecerLead\(/.test(SRV), 'escribir en la ficha es del CRM');
});

test('«no pude leer» la corrida no es «falló»', () => {
  assert.match(SRV, /if \('error' in c\) return \{ estado: 'corriendo' \};/);
});
