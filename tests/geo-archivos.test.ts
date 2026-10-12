// Tests de la geometría que sirve MaKo para los mapas (public/geo/v1, la genera scripts/geo-paises.mjs desde
// Natural Earth v5.1.2). Correr: npx tsx --test tests/geo-archivos.test.ts
//
// LOS TOPES SON MEDIDOS (12/10/2026, la corrida completa): el admin-1 más pesado es el Reino Unido con
// 142.620 B, los 240 países suman 6.043.647 B, el mundo 260.757 B y el índice 227.291 B. Cada tope deja
// ~15 % de aire: una regeneración que se lleva el doble (otra escala de Natural Earth, una tolerancia que no
// se aplica) no entra sin que alguien lo decida. El navegador baja UN archivo por mapa.
//
// Probados rompiéndolos (12/10/2026) sobre el GENERADOR (`--solo MX`), con la base en 5 pases y 0 fallos:
//   · la tolerancia ÷ 10 (MX pasa de 56.916 B a 237.677 B)                         -> 4 / 1 («cada archivo…»)
//   · sin forzar el sentido de los anillos                                          -> 5 / 0: Natural Earth YA viene en
//     el sentido de d3, así que la guarda es para otra fuente; con el sentido INVERTIDO a propósito -> 4 / 1 («d3…»)
//   · sin CODIGO_ACTUAL (la Ciudad de México vuelve a ser MX-DIF)                   -> 4 / 1 («México…»)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { codigoDeRegion, ESTADOS_MX, normalizarRegion, type RegionGeo } from '../lib/geo-regiones';

const DIR = join(__dirname, '..', 'public', 'geo', 'v1');
type Feature = { properties: { c: string; n: string; a: string[] }; geometry: { type: string; coordinates: unknown } };
const leer = (rel: string): { features: Feature[] } => JSON.parse(readFileSync(join(DIR, rel), 'utf8'));
const regiones = (pais: string): RegionGeo[] => leer(`admin1/${pais}.json`).features.map((f) => ({ codigo: f.properties.c, nombre: f.properties.n, alias: f.properties.a }));

const TOPE_ADMIN1 = 165 * 1024;
const TOPE_TOTAL_ADMIN1 = 7 * 1024 * 1024;
const TOPE_MUNDO = 300 * 1024;
const TOPE_INDICE = 265 * 1024;

test('cada archivo tiene su tope de tamaño (el navegador baja uno por mapa)', () => {
  const archivos = readdirSync(join(DIR, 'admin1')).filter((f) => f.endsWith('.json'));
  assert.ok(archivos.length >= 200, `sólo hay ${archivos.length} países`);
  let total = 0;
  for (const f of archivos) {
    const b = statSync(join(DIR, 'admin1', f)).size;
    total += b;
    assert.ok(b <= TOPE_ADMIN1, `admin1/${f} pesa ${b} B (tope ${TOPE_ADMIN1})`);
  }
  assert.ok(total <= TOPE_TOTAL_ADMIN1, `los admin1 suman ${total} B`);
  assert.ok(statSync(join(DIR, 'paises.json')).size <= TOPE_MUNDO, 'paises.json');
  assert.ok(statSync(join(DIR, 'indice.json')).size <= TOPE_INDICE, 'indice.json');
});

test('están los países que pide la tanda, y el mundo por código', () => {
  for (const c of ['MX', 'AR', 'CO', 'CL', 'PE', 'US', 'ES']) assert.ok(existsSync(join(DIR, 'admin1', `${c}.json`)), c);
  const mundo = leer('paises.json').features.map((f) => f.properties.c);
  for (const c of ['MX', 'AR', 'CO', 'CL', 'PE', 'US', 'ES', 'FR', 'NO']) assert.ok(mundo.includes(c), `el mundo no trae ${c}`);
  assert.ok(!mundo.includes('AQ'), 'la Antártida no va: aplasta el mapa del mundo');
  const indice = JSON.parse(readFileSync(join(DIR, 'indice.json'), 'utf8')) as Record<string, string[]>;
  assert.ok(indice.MX.map(normalizarRegion).includes('jalisco'));
});

test('México: los 32 estados con su código de hoy, y los nombres de Meta (medidos) se ubican con la geometría', () => {
  const mx = regiones('MX');
  assert.deepEqual(new Set(mx.map((r) => r.codigo)), new Set(Object.keys(ESTADOS_MX)));
  for (const n of ['Distrito Federal', 'State of Mexico', 'Coahuila de Zaragoza', 'Michoacán de Ocampo', 'Querétaro Arteaga', 'San Luis Potosi', 'México']) {
    assert.ok(codigoDeRegion('MX', n, mx), `${n} no se ubica con la geometría`);
  }
  assert.equal(codigoDeRegion('MX', 'México', mx), 'MX-MEX');
  assert.equal(codigoDeRegion('MX', 'Distrito Federal', mx), 'MX-CMX');
});

test('Argentina y Colombia: las trampas de Natural Earth corregidas (Buenos Aires, Bogotá)', () => {
  const ar = regiones('AR');
  assert.equal(ar.length, 24);
  assert.equal(codigoDeRegion('AR', 'Buenos Aires', ar), 'AR-B', '«Buenos Aires» a secas es la provincia');
  assert.equal(codigoDeRegion('AR', 'Capital Federal', ar), 'AR-C');
  assert.equal(codigoDeRegion('AR', 'Córdoba', ar), 'AR-X');
  const co = regiones('CO');
  assert.equal(co.find((r) => r.codigo === 'CO-DC')?.nombre, 'Bogotá');
  assert.ok(co.some((r) => r.codigo === 'CO-CUN'));
});

// d3-geo dibuja en la esfera: con el anillo exterior al revés pinta el planeta entero menos la región.
test('d3 dibuja la región y no su negativo: anillo exterior en sentido horario, agujeros al revés', () => {
  const area = (r: number[][]) => { let s = 0; for (let i = 0; i < r.length; i++) { const [x1, y1] = r[i]; const [x2, y2] = r[(i + 1) % r.length]; s += x1 * y2 - x2 * y1; } return s / 2; };
  for (const archivo of ['admin1/MX.json', 'admin1/AR.json', 'admin1/US.json', 'admin1/RU.json', 'paises.json']) {
    for (const f of leer(archivo).features) {
      const pols = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][];
      for (const pol of pols) {
        assert.ok(area(pol[0]) < 0, `${archivo} ${f.properties.c}: exterior antihorario`);
        for (const h of pol.slice(1)) assert.ok(area(h) > 0, `${archivo} ${f.properties.c}: agujero horario`);
      }
    }
  }
});
