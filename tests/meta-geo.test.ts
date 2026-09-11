// =============================================================================
// Lugares de Meta: lo que Meta acepta, lo que rechaza, y el choque de todos los días
// =============================================================================
// Las filas de búsqueda son copias literales de `search?type=adgeolocation`, y las
// reglas de choque son las que Meta aplicó con `validate_only` el 2026-09-11 (ver
// la cabecera de lib/meta-geo.ts). Si Meta cambia una, este test sigue pasando:
// lo que protege es que NOSOTROS no inventemos reglas ni perdamos claves.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agregarLugar, contiene, explicarErrorGeo, geoSpecDe, lugarDesdeBusqueda, lugarDireccion, lugarPais, lugaresDesdeDraft, ordenarLugares, type LugarMeta } from '../lib/meta-geo';

// Filas reales (Graph v25.0, locale es_LA).
const CORDOBA_CIUDAD = lugarDesdeBusqueda({ key: '84740', name: 'Ciudad de Córdoba', type: 'city', country_code: 'AR', region: 'Córdoba', region_id: 101 })!;
const PROV_CORDOBA = lugarDesdeBusqueda({ key: '101', name: 'Provincia de Córdoba', type: 'region', country_code: 'AR' })!;
const PROV_BSAS = lugarDesdeBusqueda({ key: '97', name: 'Provincia de Buenos Aires', type: 'region', country_code: 'AR' })!;
const EZEIZA = lugarDesdeBusqueda({ key: '85769', name: 'Ezeiza', type: 'city', country_code: 'AR', region: 'Buenos Aires', region_id: 97 })!;
const CABA = lugarDesdeBusqueda({ key: '83693', name: 'Buenos Aires', type: 'city', country_code: 'AR', region: 'Ciudad Autónoma de Buenos Aires', region_id: 103 })!;
const CP_C1425 = lugarDesdeBusqueda({ key: 'AR:C1425', name: 'C1425', type: 'zip', country_code: 'AR', region: 'Ciudad Autónoma de Buenos Aires', region_id: 103, primary_city: 'Buenos Aires', primary_city_id: 83693 })!;
const ALTA_CORDOBA = lugarDesdeBusqueda({ key: '2871807', name: 'Alta Córdoba', type: 'neighborhood', country_code: 'AR', region: 'Córdoba', region_id: 101 })!;
const MORON = lugarDesdeBusqueda({ key: '82782', name: 'Partido de Morón', type: 'medium_geo_area', country_code: 'AR', region: 'Buenos Aires', region_id: 97 })!;
const AR = lugarPais('AR');

test('las filas de búsqueda se leen con las claves y la jerarquía que trae Meta', () => {
  assert.equal(AR.nombre, 'Argentina');
  assert.equal(CP_C1425.ciudadId, '83693');
  assert.equal(CP_C1425.regionId, '103');
  assert.equal(PROV_CORDOBA.region, null); // una región no se contextualiza con sí misma
  assert.equal(lugarDesdeBusqueda({ key: 'x', type: 'country_group' }), null); // tipos que no manejamos
  assert.equal(lugarDesdeBusqueda({ type: 'city' }), null);
});

test('cada tipo sale con la clave de Meta que validate_only aceptó', () => {
  const spec = geoSpecDe([
    AR, PROV_CORDOBA, { ...CORDOBA_CIUDAD, radioKm: 25 }, CABA, CP_C1425, ALTA_CORDOBA, MORON,
    { tipo: 'subcity', key: '475377', nombre: 'Palermo' },
    { tipo: 'geo_market', key: 'COMSCORE_MARKET:2017', nombre: 'Miami, FL' },
    lugarDireccion('Av. Corrientes 1234, Buenos Aires, Argentina', 3),
  ]);
  const g = spec.geo_locations;
  assert.deepEqual(g.countries, ['AR']);
  assert.deepEqual(g.regions, [{ key: '101' }]);
  // Con radio lo lleva; SIN radio no se inventa uno (antes toda ciudad salía +17 km).
  assert.deepEqual(g.cities, [{ key: '84740', radius: 25, distance_unit: 'kilometer' }, { key: '83693' }]);
  assert.deepEqual(g.zips, [{ key: 'AR:C1425' }]);
  assert.deepEqual(g.neighborhoods, [{ key: '2871807' }]);
  assert.deepEqual(g.subcities, [{ key: '475377' }]);
  assert.deepEqual(g.medium_geo_areas, [{ key: '82782' }]);
  assert.deepEqual(g.geo_markets, [{ key: 'COMSCORE_MARKET:2017' }]);
  assert.deepEqual(g.custom_locations, [{ address_string: 'Av. Corrientes 1234, Buenos Aires, Argentina', radius: 3, distance_unit: 'kilometer' }]);
  assert.equal(spec.excluded_geo_locations, undefined);

  // Radios fuera de lo que Meta acepta se llevan al borde (5 km → 17; 0,5 km → 1).
  const r = geoSpecDe([{ ...CABA, radioKm: 5 }, lugarDireccion('Calle 1 123', 0.5)]).geo_locations;
  assert.equal(r.cities?.[0].radius, 17);
  assert.equal(r.custom_locations?.[0].radius, 1);

  // Excluir va a excluded_geo_locations, no a geo_locations.
  const e = geoSpecDe([AR, { ...CABA, excluir: true }]);
  assert.deepEqual(e.geo_locations, { countries: ['AR'] });
  assert.deepEqual(e.excluded_geo_locations, { cities: [{ key: '83693' }] });
});

test('el choque de todos los días: país precargado + la ciudad que buscó', () => {
  // Meta rechaza país+ciudad con 1487756. Se queda lo último elegido y se avisa.
  const a = agregarLugar([AR], CORDOBA_CIUDAD);
  assert.deepEqual(a.lista.map((l) => l.key), ['84740']);
  assert.deepEqual(a.quitados.map((l) => l.key), ['AR']);
  assert.equal(a.ensancha, false);

  // Al revés, ensancha: se queda el país y sale la ciudad.
  const b = agregarLugar([CORDOBA_CIUDAD], AR);
  assert.deepEqual(b.lista.map((l) => l.key), ['AR']);
  assert.equal(b.ensancha, true);

  // Los otros choques medidos: provincia+ciudad y ciudad+código postal.
  assert.deepEqual(agregarLugar([PROV_BSAS], EZEIZA).lista.map((l) => l.key), ['85769']);
  assert.deepEqual(agregarLugar([CABA], CP_C1425).lista.map((l) => l.key), ['AR:C1425']);
});

test('lo que Meta ACEPTA junto no se toca, y excluir nunca quita nada', () => {
  // validate_only ✔ en los dos: sacarle uno al usuario sería inventar una regla.
  assert.equal(contiene(CORDOBA_CIUDAD, ALTA_CORDOBA), false);
  assert.equal(contiene(PROV_BSAS, MORON), false);
  assert.equal(agregarLugar([CORDOBA_CIUDAD], ALTA_CORDOBA).lista.length, 2);
  assert.equal(agregarLugar([PROV_BSAS], MORON).lista.length, 2);

  // Todo Argentina menos CABA es válido (✔ medido): el excluido convive.
  const x = agregarLugar([AR], { ...CABA, excluir: true });
  assert.equal(x.lista.length, 2);
  assert.equal(x.quitados.length, 0);
  // Y elegir dos veces lo mismo no lo duplica.
  assert.equal(agregarLugar([AR], lugarPais('ar')).lista.length, 1);
});

test('los borradores viejos (`paises`) se convierten, no se tiran', () => {
  assert.deepEqual(lugaresDesdeDraft(['AR', 'mx', 'basura', 3]).map((l) => [l.tipo, l.key]), [['country', 'AR'], ['country', 'MX']]);
  const nuevo: LugarMeta[] = [CP_C1425, { ...CABA, excluir: true }];
  assert.deepEqual(lugaresDesdeDraft(nuevo), nuevo);
  assert.deepEqual(lugaresDesdeDraft({ nope: 1 }), []);
  assert.deepEqual(lugaresDesdeDraft([{ tipo: 'planeta', key: 'X' }]), []);
});

test('la búsqueda pone primero lo local, lo que más se parece y lo más grande', () => {
  // Recorte del orden REAL de Meta para «Córdoba» con country_code=AR y límite 25:
  // la ciudad 1ª, ciudades del interior, barrios… y la PROVINCIA recién 21ª.
  const fila = (key: string, name: string, type: string, cc = 'AR') => lugarDesdeBusqueda({ key, name, type, country_code: cc })!;
  const locales = [
    fila('84740', 'Ciudad de Córdoba', 'city'),
    fila('89939', 'San Francisco (Córdoba)', 'city'),
    fila('2917555', 'Cerveceros', 'neighborhood'),
    ALTA_CORDOBA,
    PROV_CORDOBA,
  ];
  // Y la mundial con límite 15: Colombia primero, España, y otra vez la ciudad de AR.
  const mundo = [fila('461197', 'Córdoba', 'city', 'CO'), fila('680468', 'Córdoba (España)', 'city', 'ES'), CORDOBA_CIUDAD];
  const r = ordenarLugares('Córdoba', locales, mundo).map((l) => l.nombre);
  assert.deepEqual(r.slice(0, 2), ['Provincia de Córdoba', 'Ciudad de Córdoba']);
  // «Cerveceros» no dice Córdoba en el nombre: queda último de los locales.
  assert.equal(r.indexOf('Cerveceros'), 4);
  // Lo mundial va después, y la ciudad de AR que vino en las dos no se duplica.
  assert.deepEqual(r.slice(5), ['Córdoba', 'Córdoba (España)']);
  assert.equal(r.filter((n) => n === 'Ciudad de Córdoba').length, 1);
  //   ROTO A PROPÓSITO (2026-09-11), cada palanca por separado:
  //   · sin el criterio LOCAL falla el primer assert — actual ['Córdoba',
  //     'Córdoba (España)'], expected ['Provincia de Córdoba', 'Ciudad de
  //     Córdoba']: Colombia y España ganan por nombre exacto, que es lo que ve
  //     hoy un cliente argentino en la búsqueda mundial.
  //   · sin el criterio de PARECIDO falla el de Cerveceros — actual 3, expected 4.

  // «Morón»: el nombre que EMPIEZA con lo escrito le gana al que solo lo contiene.
  const moron = ordenarLugares('Morón', [MORON, fila('87000', 'Morón (Buenos Aires)', 'city')], []);
  assert.deepEqual(moron.map((l) => l.nombre), ['Morón (Buenos Aires)', 'Partido de Morón']);
  // La coincidencia es por PALABRA entera: «Mar» empieza «Mar del Plata», no «Marcos Paz».
  assert.equal(ordenarLugares('Mar', [fila('1', 'Marcos Paz', 'city'), fila('2', 'Mar del Plata', 'city')], [])[0].nombre, 'Mar del Plata');
  //   ROTO A PROPÓSITO: comparando por substring (sin los espacios que pone
  //   `normalizar`) los dos «empiezan con mar», empatan, y gana el orden de Meta —
  //   actual 'Marcos Paz', expected 'Mar del Plata'.
});

test('los rechazos de Meta por subcode tienen texto; lo demás no se disfraza de geo', () => {
  assert.match(explicarErrorGeo(1487756)!, /se pisan/);
  assert.match(explicarErrorGeo(1487110)!, /17 a 80 km/);
  assert.match(explicarErrorGeo(1487940)!, /1 km/);
  assert.match(explicarErrorGeo(1487855)!, /no encontró esa dirección/);
  // Un 403 de permisos NO es un rechazo de segmentación: no puede bloquear el paso.
  assert.equal(explicarErrorGeo(4841013), null);
  assert.equal(explicarErrorGeo(undefined), null);
});
