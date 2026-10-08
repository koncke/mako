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
import {
  TIPOS_BUSCABLES, agregarLugar, aplicarLugares, cambiarRadio, claveFila, contiene, explicarErrorGeo, geoSpecDe, lugarDesdeBusqueda, lugarDireccion, lugarPais, lugarPin,
  lugaresCambiaron, lugaresDesdeDraft, lugaresDesdeMeta, ordenarLugares, quitarLugar, rotuloRadio, type LugarMeta,
} from '../lib/meta-geo';

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

// =============================================================================
// Los lugares de un conjunto QUE YA CORRE (tarea #715)
// =============================================================================
// Las tres formas de abajo copian la FORMA de GET /{adset}?fields=targeting (Graph v25.0,
// 07/10/2026) sobre tres conjuntos de tres cuentas conectadas — la misma lectura que hace
// EditarPublicoModal al abrirse. Recortadas (menos filas) y con TODOS los valores
// SINTÉTICOS: coordenadas, primary_city_id, region_id, países y regiones no son los de
// ningún cliente. Lo único medido es la forma: qué campos trae cada fila, location_types
// en los dos lados, radios fuera de nuestra lista. Los radios sí son los leídos: no dicen
// dónde pauta nadie.
//
// ⚠️ Revisión de la #715 (07/10): la primera versión dejaba los primary_city_id y region_id
// REALES con las coordenadas corridas apenas unos km, y rotulaba una de las regiones
// excluidas con su nombre: cruzando las dos se deducía en qué ciudades pauta un cliente
// identificable. Y la lectura salió de cuentas de clientes, fuera del plan (que pedía UN
// GET sobre la cuenta propia de Martín): ver docs/hallazgos-ads.md.

// Cuenta A: los pines que se arman en el Ads Manager de Meta. SIN address_string ni name,
// con radios que nuestra lista no ofrece, y con `frequently_in` en location_types.
const GEO_PINES = {
  custom_locations: [
    { distance_unit: 'kilometer', latitude: -1.1, longitude: -1.1, radius: 12, primary_city_id: 1001, region_id: 2001, country: 'AR' },
    { distance_unit: 'kilometer', latitude: -1.2, longitude: -1.2, radius: 8, primary_city_id: 1002, region_id: 2002, country: 'AR' },
    { distance_unit: 'kilometer', latitude: -1.3, longitude: -1.3, radius: 16, primary_city_id: 1003, region_id: 2003, country: 'AR' },
  ],
  location_types: ['frequently_in', 'home', 'recent'],
};
// Cuenta B: dos países pelados.
const GEO_PAISES = { countries: ['CL', 'UY'], location_types: ['home', 'recent'] };
// Cuenta C: pines incluidos y provincias EXCLUIDAS, con location_types en los DOS lados.
const GEO_C = {
  custom_locations: [
    { distance_unit: 'kilometer', latitude: -1.4, longitude: -1.4, radius: 5, primary_city_id: 1004, region_id: 2004, country: 'AR' },
    { distance_unit: 'kilometer', latitude: -1.5, longitude: -1.5, radius: 1, primary_city_id: 1005, region_id: 2004, country: 'AR' },
  ],
  location_types: ['home', 'recent'],
};
const EXC_C = {
  regions: [
    { key: '3001', name: 'Región Uno', country: 'AR' },
    { key: '3002', name: 'Región Dos', country: 'AR' },
    { key: '3003', name: 'Región Tres', country: 'AR' },
  ],
  location_types: ['home', 'recent'],
};
// Lo que se manda de vuelta es lo que se sabe escribir: sin los campos informativos ni
// location_types (que se conserva aparte).
const sinInfo = (g: Record<string, unknown>) => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(g)) {
    if (k === 'location_types') continue;
    out[k] = Array.isArray(v) ? v.map((f) => {
      if (typeof f !== 'object' || !f) return f;
      const { primary_city_id: _a, region_id: _b, country: _c, name: _d, ...resto } = f as Record<string, unknown>;
      return resto;
    }) : v;
  }
  return out;
};
const conjunto = (geo: unknown, exc?: unknown) => ({ age_min: 25, geo_locations: geo, ...(exc ? { excluded_geo_locations: exc } : {}), targeting_automation: { advantage_audience: 1 } });

test('el geo de un conjunto que ya corre se lee con la forma que Meta devuelve', () => {
  const a = lugaresDesdeMeta(GEO_PINES, undefined);
  assert.deepEqual(a.noEntiendo, []);
  assert.deepEqual(a.lugares.map((l) => [l.tipo, l.radioKm, l.pais]), [['pin', 12, 'AR'], ['pin', 8, 'AR'], ['pin', 16, 'AR']]);
  assert.deepEqual(a.conservar.geo, { location_types: ['frequently_in', 'home', 'recent'] });
  // El país del crudo va a `pais`, así contiene() ve el choque país+pin (medido ✖ 1487756).
  assert.equal(contiene(lugarPais('AR'), a.lugares[0]), true);

  const b = lugaresDesdeMeta(GEO_PAISES, null);
  assert.deepEqual(b.lugares.map((l) => [l.tipo, l.key]), [['country', 'CL'], ['country', 'UY']]);

  const c = lugaresDesdeMeta(GEO_C, EXC_C);
  assert.deepEqual(c.noEntiendo, []);
  assert.deepEqual(c.lugares.filter((l) => l.excluir).map((l) => [l.tipo, l.key, l.nombre]), [['region', '3001', 'Región Uno'], ['region', '3002', 'Región Dos'], ['region', '3003', 'Región Tres']]);
  assert.deepEqual(c.conservar.excluidos, { location_types: ['home', 'recent'] });
  //   ROTO A PROPÓSITO: sin pasar `country` a `pais` → 12 / 1 (éste): los pines salen con
  //   pais null y contiene() deja de ver el choque país+pin.
});

test('ida y vuelta: sin tocar los lugares, el geo sale IDÉNTICO; y la firma reproduce el crudo', () => {
  for (const [geo, exc] of [[GEO_PINES, undefined], [GEO_PAISES, undefined], [GEO_C, EXC_C]] as const) {
    const t = conjunto(geo, exc);
    const lec = lugaresDesdeMeta(t.geo_locations, (t as { excluded_geo_locations?: unknown }).excluded_geo_locations);
    // Cambiar la edad no puede re-escribir el geo: vuelve el MISMO objeto.
    assert.equal(aplicarLugares(t, lec, lec.lugares), t);
    assert.equal(lugaresCambiaron(lec, [...lec.lugares]), false);
    // Y lo que esos lugares mandarían es exactamente lo que había (12 km no sale 10 ni 25).
    const spec = geoSpecDe(lec.lugares);
    assert.deepEqual(spec.geo_locations, sinInfo(geo as Record<string, unknown>));
    assert.deepEqual(spec.excluded_geo_locations, exc ? sinInfo(exc as Record<string, unknown>) : undefined);
  }
  //   ROTO A PROPÓSITO (07/10/2026, scratchpad romper-715.mjs, pass/fail sobre los 13 del
  //   archivo): aplicarLugares re-escribiendo SIEMPRE, sin mirar la firma → 11 / 2 (éste,
  //   porque el geo deja de ser el mismo objeto, y el de sólo lectura, porque tira). Y
  //   geoSpecDe sin el caso 'pin' → 10 / 3 (éste, el de cambiar y el del pin): los pines
  //   de los conjuntos medidos no viajaban.
});

test('cambiar un lugar re-escribe el geo desde los lugares y le devuelve location_types', () => {
  const t = conjunto(GEO_PINES);
  const lec = lugaresDesdeMeta(t.geo_locations, undefined);
  const sinUno = lec.lugares.slice(1);
  const g = aplicarLugares(t, lec, sinUno).geo_locations as Record<string, unknown>;
  assert.deepEqual((g.custom_locations as unknown[]).length, 2);
  assert.deepEqual(g.location_types, ['frequently_in', 'home', 'recent']);

  // Con excluidos: sacar uno conserva el location_types de ESE lado; sacarlos todos borra la clave.
  const tc = conjunto(GEO_C, EXC_C);
  const lc = lugaresDesdeMeta(tc.geo_locations, tc.excluded_geo_locations);
  const sinLaDos = lc.lugares.filter((l) => l.key !== '3002');
  const ex = aplicarLugares(tc, lc, sinLaDos).excluded_geo_locations as Record<string, unknown>;
  assert.deepEqual(ex, { regions: [{ key: '3001' }, { key: '3003' }], location_types: ['home', 'recent'] });
  assert.equal('excluded_geo_locations' in aplicarLugares(tc, lc, lc.lugares.filter((l) => !l.excluir)), false);
  // Lo de afuera del geo no se toca.
  assert.equal(aplicarLugares(tc, lc, sinLaDos).age_min, 25);
  // Sin un solo lugar incluido no se guarda: Meta no tiene dónde mostrarlo.
  assert.throws(() => aplicarLugares(tc, lc, lc.lugares.filter((l) => l.excluir)), /al menos un lugar/);
  //   ROTO A PROPÓSITO: 'location_types' fuera de CLAVES_CONSERVADAS → 11 / 2 (éste y el
  //   de la forma real): pasa a `noEntiendo`, los tres conjuntos medidos quedan en sólo
  //   lectura, y re-escribir tira.
});

test('una ciudad en MILLAS vuelve en millas, y un radio que no está en la lista no se mueve', () => {
  // ⚠️ Forma SINTÉTICA, no medida: ninguno de los tres conjuntos leídos el 07/10 tenía una
  // ciudad con radio. Sale de lo que el repo ya manda (cleanGeo acepta 'mile') y de lo que
  // Meta documenta. 10 mi = 16,09 km: con el clamp en km salía 17 km apenas se tocaba
  // cualquier OTRO lugar, y el público de una ciudad que nadie tocó cambiaba.
  const geo = { cities: [{ key: '2418956', name: 'Ciudad', region: 'Estado', region_id: '3847', country: 'US', radius: 10, distance_unit: 'mile' }, { key: '84740', name: 'Otra', country: 'AR', radius: 30, distance_unit: 'kilometer' }] };
  const lec = lugaresDesdeMeta(geo, undefined);
  assert.deepEqual(lec.noEntiendo, []);
  const masUno = [...lec.lugares, { ...lugarPais('UY'), excluir: false }];
  const cities = (aplicarLugares(conjunto(geo), lec, masUno).geo_locations as { cities: unknown[] }).cities;
  assert.deepEqual(cities, [{ key: '2418956', radius: 10, distance_unit: 'mile' }, { key: '84740', radius: 30, distance_unit: 'kilometer' }]);
  assert.equal(rotuloRadio(lec.lugares[0]), '+10 mi');
  // Si alguien ELIGE otro radio en el selector (que escribe km), gana lo elegido, en km.
  const elegido = { ...lec.lugares[0], radioKm: 25 };
  assert.deepEqual(geoSpecDe([elegido]).geo_locations.cities, [{ key: '2418956', radius: 25, distance_unit: 'kilometer' }]);
  assert.equal(rotuloRadio(elegido), '+25 km');
  //   ROTO A PROPÓSITO: radioParaMeta sin el atajo de radioMeta (siempre km con clamp) →
  //   12 / 1 (éste): las 10 mi salen { radius: 17, distance_unit: 'kilometer' }.
});

test('lo que no se entiende deja los lugares en SÓLO LECTURA, y re-escribir tira', () => {
  const casos: Array<[unknown, string]> = [
    [{ countries: ['AR'], places: [{ place_page_id: '1', radius: 5 }] }, 'geo_locations.places'],
    [{ country_groups: ['latam'] }, 'geo_locations.country_groups'],
    [{ cities: [{ key: '1', name: 'X', radius: 5, distance_unit: 'kilometer', custom_type: 'algo' }] }, 'geo_locations.cities[0].custom_type'],
    [{ custom_locations: [{ latitude: -34, longitude: -58, distance_unit: 'kilometer' }] }, 'geo_locations.custom_locations[0].radius'],
    // Sin radius NI distance_unit: la fila de arriba trae unidad, así que cae en leerRadio
    // ('no') y nunca llegaba al `if (!radio)` de los custom_locations. Ésta sí.
    [{ custom_locations: [{ latitude: -34, longitude: -58 }] }, 'geo_locations.custom_locations[0].radius'],
    [{ custom_locations: [{ latitude: -34, longitude: -58, radius: 5, distance_unit: 'feet' }] }, 'geo_locations.custom_locations[0].radius'],
    [{ regions: [{ name: 'Sin key' }] }, 'geo_locations.regions[0].key'],
    [{ countries: 'AR' }, 'geo_locations.countries'],
  ];
  for (const [geo, esperado] of casos) {
    const lec = lugaresDesdeMeta(geo, undefined);
    assert.ok(lec.noEntiendo.includes(esperado), `${JSON.stringify(geo)} → ${JSON.stringify(lec.noEntiendo)}`);
  }
  // Con algo sin entender: sin cambios vuelve igual; con cambios, tira en vez de borrar.
  const geo = { countries: ['AR'], places: [{ place_page_id: '1' }] };
  const t = conjunto(geo);
  const lec = lugaresDesdeMeta(geo, undefined);
  assert.equal(aplicarLugares(t, lec, lec.lugares), t);
  assert.throws(() => aplicarLugares(t, lec, [lugarPais('UY')]), /no sabe editar/);
  //   ROTO A PROPÓSITO: sin la lista blanca POR FILA (el `raro`) → 12 / 1 (éste): el campo
  //   desconocido de la ciudad no aparece en noEntiendo. Y aplicarLugares sin el `throw`
  //   de noEntiendo → 12 / 1 (éste): re-escribe y `places` desaparece.
  //   Y (revisión, 07/10, scratchpad romper-715r.mjs) sin el `if (!radio)` de los
  //   custom_locations → 13 / 1 de 14 (éste): el pin sin radio nacía con los 5 km por
  //   defecto de lugarPin y viajaba a Meta con un radio que nadie eligió apenas se editaba
  //   otro lugar. Con la tabla sin la fila sin unidad, la misma rotura da 14 / 0: el guard
  //   no tenía test.
});

test('el pin: no se busca en Meta, sobrevive al borrador y su radio dice la unidad', () => {
  assert.equal((TIPOS_BUSCABLES as readonly string[]).includes('pin'), false);
  assert.equal(lugarDesdeBusqueda({ key: '1', type: 'pin' }), null);
  const p = { ...lugarPin(-1.6, -1.65, 3), excluir: false };
  assert.equal(p.key, '-1.600000,-1.650000');
  assert.deepEqual(lugaresDesdeDraft([p]), [p]);
  assert.deepEqual(geoSpecDe([p]).geo_locations.custom_locations, [{ latitude: -1.6, longitude: -1.65, radius: 3, distance_unit: 'kilometer' }]);
  assert.equal(rotuloRadio(p), '+3 km');
  // Una dirección que viene CON coordenadas se re-emite como punto: no se re-geocodifica.
  const lec = lugaresDesdeMeta({ custom_locations: [{ address_string: 'Calle 1 123', latitude: -1.6, longitude: -1.65, radius: 2, distance_unit: 'kilometer' }] }, undefined);
  assert.deepEqual(lec.lugares.map((l) => [l.tipo, l.nombre]), [['pin', 'Calle 1 123']]);
  //   ROTO A PROPÓSITO: lugaresDesdeDraft con la lista vieja `[...TIPOS_BUSCABLES, 'address']`
  //   → 12 / 1 (éste): el pin del borrador vuelve como [].
});

test('la dona: el mismo pin incluido y excluido son DOS filas, y tocar una no toca la otra', () => {
  // Meta acepta el mismo punto incluido con un radio grande y excluido con uno chico: un
  // anillo. Forma SINTÉTICA (ninguno de los conjuntos leídos el 07/10 la tenía), sacada de
  // la revisión de la #715. Las pantallas de creación no la pueden armar —el buscador no
  // deja sumar lo que ya está—, pero un conjunto leído de Meta sí la trae al editor.
  const punto = { latitude: -1.7, longitude: -1.7, distance_unit: 'kilometer' };
  const geo = { custom_locations: [{ ...punto, radius: 25 }] };
  const exc = { custom_locations: [{ ...punto, radius: 8 }] };
  const t = conjunto(geo, exc);
  const lec = lugaresDesdeMeta(geo, exc);
  assert.deepEqual(lec.noEntiendo, []);
  const [anillo, agujero] = lec.lugares;
  assert.deepEqual([anillo.excluir, agujero.excluir], [false, true]);
  assert.notEqual(claveFila(anillo), claveFila(agujero)); // el `key` de React de cada fila
  const custom = (g: unknown) => (g as { custom_locations: unknown[] }).custom_locations;

  // Agrandar el anillo a 40 km deja el agujero en 8: con el mismo radio en los dos, el
  // agujero tapaba todo el círculo y el público quedaba en cero.
  const mas = aplicarLugares(t, lec, cambiarRadio(lec.lugares, anillo, 40));
  assert.deepEqual(custom(mas.geo_locations), [{ ...punto, radius: 40 }]);
  assert.deepEqual(custom(mas.excluded_geo_locations), [{ ...punto, radius: 8 }]);

  // Sacar el agujero, con otro lugar incluido al lado, deja el anillo: antes se llevaba el
  // pin incluido, viajaba { countries: ['UY'] } y el conjunto dejaba de mostrarse en esa zona.
  const geoUy = { countries: ['UY'], ...geo };
  const lecUy = lugaresDesdeMeta(geoUy, exc);
  const agujeroUy = lecUy.lugares.find((l) => l.excluir)!;
  const sinAgujero = aplicarLugares(conjunto(geoUy, exc), lecUy, quitarLugar(lecUy.lugares, agujeroUy));
  assert.deepEqual(sinAgujero.geo_locations, { countries: ['UY'], custom_locations: [{ ...punto, radius: 25 }] });
  assert.equal('excluded_geo_locations' in sinAgujero, false);

  // Dos filas iguales del MISMO lado no se pueden tocar por separado: sólo lectura.
  const doble = lugaresDesdeMeta({ custom_locations: [{ ...punto, radius: 25 }, { ...punto, radius: 8 }] }, undefined);
  assert.deepEqual(doble.noEntiendo, ['geo_locations.custom_locations[1]']);
  //   ROTO A PROPÓSITO (07/10/2026, scratchpad romper-715r.mjs): `mismaFila` igual a
  //   `mismoLugar` (sin mirar el lado) → 13 / 1 de 14 (éste): el agujero salía con 40 km. Y
  //   sin el corte de las filas repetidas en leerBolsa → 13 / 1 (éste).
});
