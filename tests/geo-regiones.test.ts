// Tests de lib/geo-regiones.ts: de un nombre de región (de Meta, de una visita) a su código, en cualquier país.
// Correr: npx tsx --test tests/geo-regiones.test.ts
//
// Probados rompiéndolos (12/10/2026), con la base en 6 pases y 0 fallos:
//   · `codigoEn` con un `startsWith` de respaldo (lo que tenía MapaMexico antes)   -> 4 / 2 («un pedazo…», «un código…»)
//   · sin la regla «un nombre de dos regiones no ubica ninguna» (gana la última)    -> 4 / 2 («Buenos Aires…», «lo que no se ubica…»)
//   · los alias medidos SIN ganarle a la geometría (sólo si el nombre está libre)   -> 5 / 1 («los 33 nombres…»). La primera
//     versión del test daba 6 / 0: con «México» en las DOS regiones el nombre ya era ambiguo y el alias entraba igual;
//     el caso que lo caza es el `name_es` crudo de Natural Earth, con «México» sólo en la ciudad.
//   · `ubicarEn` tirando lo que no se ubica en vez de contarlo                       -> 5 / 1 («lo que no se ubica…»)
//   · `adivinarPais` sin pedir la mitad de las etiquetas                            -> 5 / 1 (al principio 6 / 0: los casos
//     de una coincidencia ya los frenaba el mínimo de dos; hizo falta «dos de cinco»)
//   · `adivinarPais` contando el «Unknown», el «(sin dato)» y «Otros» como regiones -> 5 / 1 (también 6 / 0 la primera vez)
//   · el sufijo de un código aceptado también en minúsculas («jal»)                 -> 5 / 1 («un código…»)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  adivinarPais, codigoDeRegion, codigoEn, diccionario, ESTADOS_MX, indiceConocido, normalizarRegion, ubicarEn, ubicarRegiones,
  type RegionGeo,
} from '../lib/geo-regiones';

// Los 33 nombres que mandó Meta para la cuenta del ws1 el 11/10/2026 (los 32 estados y «Unknown»), tal cual.
const META_MX = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas', 'Chihuahua', 'Coahuila de Zaragoza', 'Colima',
  'Distrito Federal', 'Durango', 'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco', 'Michoacán de Ocampo', 'Morelos', 'Nayarit',
  'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro Arteaga', 'Quintana Roo', 'San Luis Potosi', 'Sinaloa', 'Sonora', 'State of Mexico',
  'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Unknown', 'Veracruz', 'Yucatán', 'Zacatecas',
];

// Un país de mentira con la trampa de Natural Earth: dos regiones que comparten un nombre.
const AR: RegionGeo[] = [
  { codigo: 'AR-B', nombre: 'Provincia de Buenos Aires', alias: ['Buenos Aires'] },
  { codigo: 'AR-C', nombre: 'Ciudad de Buenos Aires', alias: ['Buenos Aires', 'Capital Federal'] },
  { codigo: 'AR-X', nombre: 'Córdoba', alias: ['Cordova'] },
  { codigo: 'AR-S', nombre: 'Santa Fe' },
  { codigo: 'AR-M', nombre: 'Mendoza' },
];

test('los 33 nombres de Meta (medidos) caen cada uno en SU estado, sin la geometría y con ella', () => {
  const codigos = META_MX.filter((n) => n !== 'Unknown').map((n) => codigoDeRegion('MX', n));
  assert.ok(codigos.every(Boolean), `no se ubica: ${META_MX.filter((n, i) => n !== 'Unknown' && !codigos[i]).join(', ')}`);
  assert.deepEqual(new Set(codigos), new Set(Object.keys(ESTADOS_MX)), 'dos nombres de Meta caen en el mismo estado');
  assert.equal(codigoDeRegion('MX', 'Distrito Federal'), 'MX-CMX');
  assert.equal(codigoDeRegion('MX', 'State of Mexico'), 'MX-MEX');
  assert.equal(codigoDeRegion('MX', 'Unknown'), null);
  // Con la geometría de Natural Earth (cuyo «México» es también un nombre de la Ciudad de México), el alias medido manda.
  const geo: RegionGeo[] = [
    { codigo: 'MX-CMX', nombre: 'Ciudad de México', alias: ['México', 'Distrito Federal'] },
    { codigo: 'MX-MEX', nombre: 'Estado de México', alias: ['México', 'State of Mexico'] },
  ];
  assert.equal(codigoDeRegion('MX', 'México', geo), 'MX-MEX', '«México» a secas es el estado');
  assert.equal(diccionario('MX', geo).nombres.get('MX-CMX'), 'Ciudad de México');
  // Y aunque la geometría le dé «México» SÓLO a la ciudad (el `name_es` crudo de Natural Earth), gana lo medido.
  const crudo: RegionGeo[] = [{ codigo: 'MX-CMX', nombre: 'Ciudad de México', alias: ['México'] }, { codigo: 'MX-MEX', nombre: 'Estado de México' }];
  assert.equal(codigoDeRegion('MX', 'México', crudo), 'MX-MEX');
});

test('un pedazo de nombre no es una región (igualdad exacta normalizada, sin prefijos)', () => {
  assert.equal(codigoDeRegion('MX', 'Baja'), null);
  assert.equal(codigoDeRegion('MX', 'San Luis'), null);
  assert.equal(codigoDeRegion('MX', '  san luis   POTOSÍ '), 'MX-SLP');
  assert.equal(normalizarRegion('México D.F.'), 'mexico df');
});

test('Buenos Aires: un nombre de dos regiones no ubica ninguna; el nombre propio de cada una sí', () => {
  assert.equal(codigoDeRegion('AR', 'Buenos Aires', AR), null);
  assert.equal(codigoDeRegion('AR', 'Capital Federal', AR), 'AR-C');
  assert.equal(codigoDeRegion('AR', 'Provincia de Buenos Aires', AR), 'AR-B');
  assert.equal(codigoDeRegion('AR', 'cordoba', AR), 'AR-X');
});

test('un código también ubica: entero, o el sufijo en mayúsculas como lo manda la visita', () => {
  assert.equal(codigoDeRegion('MX', 'MX-JAL'), 'MX-JAL');
  assert.equal(codigoDeRegion('MX', 'mx-jal'), 'MX-JAL');
  assert.equal(codigoDeRegion('MX', 'JAL'), 'MX-JAL');
  assert.equal(codigoDeRegion('AR', 'X', AR), 'AR-X');
  assert.equal(codigoDeRegion('MX', 'jal'), null, 'en minúsculas no es un código: sería un nombre');
  assert.equal(codigoDeRegion('MX', 'DF'), 'MX-CMX', 'no hay un código DF: es el alias');
});

test('lo que no se ubica se cuenta aparte, no se pinta en cero; dos nombres de la misma región se suman', () => {
  const dic = diccionario('AR', AR);
  const u = ubicarEn(dic, [
    { etiqueta: 'Buenos Aires', valor: 10 }, { etiqueta: 'Córdoba', valor: 5 }, { etiqueta: 'Cordova', valor: 1 },
    { etiqueta: 'Capital Federal', valor: 3 }, { etiqueta: '(sin dato)', valor: 4 }, { etiqueta: 'Jalisco', valor: 0 },
  ]);
  assert.deepEqual([...u.porCodigo.entries()].sort(), [['AR-C', 3], ['AR-X', 6]]);
  assert.deepEqual(u.sinUbicar.map((r) => r.etiqueta), ['Buenos Aires', '(sin dato)'], 'una región en cero no suma al aviso');
  // El atajo con el país hace lo mismo.
  assert.deepEqual([...ubicarRegiones('MX', [{ etiqueta: 'Distrito Federal', valor: 2 }, { etiqueta: 'Ciudad de México', valor: 3 }]).porCodigo], [['MX-CMX', 5]]);
  assert.equal(codigoEn(dic, ''), null);
});

test('adivinar el país: el que más regiones nombra, con la mitad al menos; si no, null (el mapa pide elegir)', () => {
  const indice = { ...indiceConocido(), AR: AR.flatMap((r) => [r.nombre, ...(r.alias ?? [])]) };
  assert.equal(adivinarPais(META_MX, indice), 'MX');
  assert.equal(adivinarPais(['Córdoba', 'Santa Fe', 'Unknown', '(sin dato)', 'Otros'], indice), 'AR', 'el «Unknown», el «(sin dato)» y «Otros» no votan');
  assert.equal(adivinarPais(['Córdoba', 'Jalisco', 'Texas', 'Ontario', 'Bavaria'], indice), null, 'una sola de cinco no alcanza');
  assert.equal(adivinarPais(['Mendoza', 'Texas', 'Ontario'], indice), null, 'una de tres no alcanza');
  assert.equal(adivinarPais(['Córdoba', 'Santa Fe', 'Texas', 'Ontario', 'Bavaria'], indice), null, 'dos de cinco no son la mitad');
  assert.equal(adivinarPais(['Unknown', '(sin dato)'], indice), null);
  assert.equal(adivinarPais(['Jalisco'], indice), 'MX', 'la única etiqueta, si es de un país, alcanza');
  // Empate: dos países con el mismo nombre de región y nada más.
  assert.equal(adivinarPais(['Córdoba'], { AR: ['Córdoba'], ES: ['Córdoba'] }), null);
});
