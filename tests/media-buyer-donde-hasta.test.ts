// El Media Buyer con DÓNDE y HASTA (lo prometido a la agencia de Thiago, 29/10/2026): la zona del negocio (lib/media-buyer/
// zona.ts), la fecha de fin en el motor, y el público de un conjunto en la forma que recibe Zernio (lib/zernio-publico.ts).
// Lo que fija: «no sé» es FUERA (no se prende ni se sube), una ciudad o un código postal adentro de la provincia o el país de la
// zona es DENTRO, la fecha pasada pausa la campaña una vez y le gana a todo, Surf no sube con menos de 3 días, Revive no prende
// lo que pausó la fecha, y por Zernio los lugares van TODOS juntos (o ninguno) y las posiciones de cada plataforma que queda se
// reenvían. Correr: node --import tsx --test tests/media-buyer-donde-hasta.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proponer, type EntradaMotor, type NodoMB, type SenalMB, type DecisionPrevia } from '../lib/media-buyer/motor';
import { CONFIG_POR_DEFECTO, type ConfigMediaBuyer } from '../lib/media-buyer/tipos';
import {
  validarZona, veredictoDeLugares, juntarVeredictos, frenoPorFecha, pausasPorFecha, finDeCampana, fechaValida, validarHastaCampanas,
  diasHasta, HASTA_SIN_SUBIR_DIAS, pausasPendientes, leerZonaGuardada, leerHastaGuardadas, ZONA_ILEGIBLE, type LugarZona,
} from '../lib/media-buyer/zona';
import { lugaresDesdeMeta, type LugarMeta } from '../lib/meta-geo';
import { publicoParaZernio, lugaresParaZernio } from '../lib/zernio-publico';

// ── La zona ──────────────────────────────────────────────────────────────────

const ESPANA: LugarZona = { tipo: 'country', key: 'ES', nombre: 'España', pais: 'ES' };
const MADRID_REGION: LugarZona = { tipo: 'region', key: '1234', nombre: 'Comunidad de Madrid', pais: 'ES' };
const MADRID_CIUDAD: LugarZona = { tipo: 'city', key: '777', nombre: 'Madrid', pais: 'ES', regionId: '1234' };

const ciudad = (key: string, regionId: string, pais: string): LugarMeta => ({ tipo: 'city', key, nombre: key, pais, regionId });

test('validarZona: países, provincias y ciudades con su país; nada más', () => {
  const ok = validarZona([{ tipo: 'country', key: 'es', nombre: 'España' }, { tipo: 'city', key: '777', nombre: 'Madrid', pais: 'es', regionId: '1234', region: 'Madrid' }]);
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.equal(ok.valor[0].key, 'ES', 'el país va en mayúscula');
    assert.equal(ok.valor[1].pais, 'ES');
  }
  assert.equal(validarZona([{ tipo: 'pin', key: '1,2' }]).ok, false, 'un punto del mapa no es una zona');
  assert.equal(validarZona([{ tipo: 'city', key: '777', nombre: 'Madrid' }]).ok, false, 'una ciudad sin país no se sabe contener');
  assert.equal(validarZona('ES').ok, false);
  const dup = validarZona([ESPANA, ESPANA]);
  assert.ok(dup.ok && dup.valor.length === 1, 'sin repetidos');
});

test('veredicto: sin zona todo es dentro; una ciudad de España está dentro de España', () => {
  assert.equal(veredictoDeLugares([], [ciudad('1', '9', 'MX')]).veredicto, 'dentro');
  assert.equal(veredictoDeLugares([ESPANA], [ciudad('777', '1234', 'ES')]).veredicto, 'dentro');
  assert.equal(veredictoDeLugares([ESPANA], [{ tipo: 'country', key: 'ES', nombre: 'España', pais: 'ES' }]).veredicto, 'dentro');
});

test('veredicto: España entera NO está dentro de una zona «Madrid»', () => {
  const v = veredictoDeLugares([MADRID_CIUDAD], [{ tipo: 'country', key: 'ES', nombre: 'España', pais: 'ES' }]);
  assert.equal(v.veredicto, 'fuera');
  assert.equal(veredictoDeLugares([MADRID_REGION], [ciudad('777', '1234', 'ES')]).veredicto, 'dentro', 'la ciudad por su región');
  assert.equal(veredictoDeLugares([MADRID_REGION], [ciudad('888', '5555', 'ES')]).veredicto, 'fuera', 'Barcelona no es de Madrid');
  const zip: LugarMeta = { tipo: 'zip', key: 'ES:28001', nombre: '28001', pais: 'ES', regionId: '1234', ciudadId: '777' };
  assert.equal(veredictoDeLugares([MADRID_CIUDAD], [zip]).veredicto, 'dentro', 'el código postal por su ciudad');
});

test('veredicto: UN lugar fuera alcanza; lo excluido no cuenta', () => {
  assert.equal(veredictoDeLugares([ESPANA], [ciudad('777', '1234', 'ES'), ciudad('1', '9', 'MX')]).veredicto, 'fuera');
  assert.equal(veredictoDeLugares([ESPANA], [ciudad('777', '1234', 'ES'), { ...ciudad('1', '9', 'MX'), excluir: true }]).veredicto, 'dentro');
});

test('veredicto: «no sé» es no sé (un pin sin país, un geo que no se entendió, nada incluido)', () => {
  const pin: LugarMeta = { tipo: 'pin', key: '40,-3', nombre: 'Un punto', lat: 40, lng: -3, radioKm: 5 };
  assert.equal(veredictoDeLugares([ESPANA], [pin]).veredicto, 'no_se');
  assert.equal(veredictoDeLugares([ESPANA], [ciudad('777', '1234', 'ES')], ['geo_locations.country_groups']).veredicto, 'no_se');
  assert.equal(veredictoDeLugares([ESPANA], []).veredicto, 'no_se');
  // Un pin que Meta devuelve con su país (los del Administrador traen `country`) SÍ se ubica.
  assert.equal(veredictoDeLugares([ESPANA], [{ ...pin, pais: 'ES' }]).veredicto, 'dentro');
});

test('veredicto con el crudo de Meta: la lectura de siempre (lugaresDesdeMeta) alimenta la zona', () => {
  const lec = lugaresDesdeMeta({ cities: [{ key: '777', name: 'Madrid', region: 'Comunidad de Madrid', region_id: '1234', country: 'ES' }], location_types: ['home'] }, null);
  assert.equal(veredictoDeLugares([MADRID_REGION], lec.lugares, lec.noEntiendo).veredicto, 'dentro');
  const raro = lugaresDesdeMeta({ countries: ['ES'], country_groups: ['europe'] }, null);
  assert.equal(veredictoDeLugares([ESPANA], raro.lugares, raro.noEntiendo).veredicto, 'no_se', 'un grupo de países no se puede ubicar');
});

test('veredicto: una ciudad CON RADIO se sale de su ciudad y de su provincia (no sé); sólo su país la contiene (hallazgo 6)', () => {
  const conRadio = lugaresDesdeMeta({ cities: [{ key: '777', name: 'Madrid', region_id: '1234', country: 'ES', radius: 80, distance_unit: 'kilometer' }] }, null);
  assert.equal(veredictoDeLugares([MADRID_CIUDAD], conRadio.lugares).veredicto, 'no_se');
  assert.equal(veredictoDeLugares([MADRID_REGION], conRadio.lugares).veredicto, 'no_se');
  assert.equal(veredictoDeLugares([ESPANA], conRadio.lugares).veredicto, 'dentro');
  assert.equal(veredictoDeLugares([{ tipo: 'country', key: 'FR', nombre: 'Francia', pais: 'FR' }], conRadio.lugares).veredicto, 'fuera', 'de otro país sigue siendo fuera');
});

test('juntarVeredictos: fuera gana a no sé, no sé gana a dentro, vacío es no sé', () => {
  assert.equal(juntarVeredictos(['dentro', 'dentro']), 'dentro');
  assert.equal(juntarVeredictos(['dentro', 'no_se']), 'no_se');
  assert.equal(juntarVeredictos(['no_se', 'fuera']), 'fuera');
  assert.equal(juntarVeredictos([]), 'no_se');
});

// ── La fecha de fin ──────────────────────────────────────────────────────────

test('fechaValida y validarHastaCampanas: AAAA-MM-DD que exista, ids numéricos', () => {
  assert.equal(fechaValida('2026-11-05'), '2026-11-05');
  assert.equal(fechaValida('2026-02-31'), null);
  assert.equal(fechaValida('05/11/2026'), null);
  assert.equal(fechaValida('0002-11-05'), null, 'un año a medio escribir no es una fecha (hallazgo 4)');
  assert.deepEqual(validarHastaCampanas({ '123': '2026-11-05' }), { ok: true, valor: { '123': '2026-11-05' } });
  assert.equal(validarHastaCampanas({ abc: '2026-11-05' }).ok, false);
  assert.equal(validarHastaCampanas({ '123': 'mañana' }).ok, false);
});

test('finDeCampana: la de la campaña gana a la de la cuenta', () => {
  const c = { hasta: '2026-12-31', hastaCampanas: { c1: '2026-11-05' } };
  assert.equal(finDeCampana(c, 'c1'), '2026-11-05');
  assert.equal(finDeCampana(c, 'c2'), '2026-12-31');
  assert.equal(finDeCampana({ hasta: null, hastaCampanas: {} }, 'c1'), null);
  assert.equal(finDeCampana({ hasta: null } as unknown as { hasta: null; hastaCampanas: Record<string, string> }, 'c1'), null, 'una config vieja sin el mapa no rompe');
});

test('frenoPorFecha: pasada frena prender y subir; cerca frena sólo subir; bajar y pausar nunca', () => {
  assert.equal(diasHasta('2026-11-01', '2026-11-05'), 4);
  assert.ok(frenoPorFecha('activar', '2026-11-04', '2026-11-05'), 'pasada: no se prende');
  assert.ok(frenoPorFecha('subir_presupuesto', '2026-11-04', '2026-11-05'), 'pasada: no se sube');
  assert.equal(frenoPorFecha('activar', '2026-11-05', '2026-11-05'), null, 'el último día todavía se puede prender');
  assert.ok(frenoPorFecha('subir_presupuesto', '2026-11-05', '2026-11-05'), 'el último día no se sube');
  assert.ok(frenoPorFecha('subir_presupuesto', '2026-11-07', '2026-11-05'), `con menos de ${HASTA_SIN_SUBIR_DIAS} días no se sube`);
  assert.equal(frenoPorFecha('subir_presupuesto', '2026-11-08', '2026-11-05'), null, `con ${HASTA_SIN_SUBIR_DIAS} días sí`);
  assert.equal(frenoPorFecha('pausar', '2026-11-01', '2026-11-05'), null);
  assert.equal(frenoPorFecha('bajar_presupuesto', '2026-11-01', '2026-11-05'), null);
  assert.ok(frenoPorFecha('subir_presupuesto', '2026-12-31', null), 'sin el día del negocio, con fecha puesta: no se sube');
  assert.equal(frenoPorFecha('subir_presupuesto', null, null), null, 'sin fecha no hay freno');
});

test('pausasPorFecha: sólo campañas PRENDIDAS con la fecha pasada, y sin el día del negocio nada', () => {
  const arbol = [
    { id: 'c1', nombre: 'Vieja', nivel: 'campaign' as const, configurado: 'ACTIVE' },
    { id: 'c2', nombre: 'Pausada', nivel: 'campaign' as const, configurado: 'PAUSED' },
    { id: 'c3', nombre: 'Sigue', nivel: 'campaign' as const, configurado: 'ACTIVE' },
    { id: 's1', nombre: 'Conjunto', nivel: 'adset' as const, configurado: 'ACTIVE' },
  ];
  const c = { hasta: null, hastaCampanas: { c1: '2026-11-04', c2: '2026-11-04', c3: '2026-11-05', s1: '2026-11-01' } };
  assert.deepEqual(pausasPorFecha(arbol, c, '2026-11-05').map((p) => p.campana.id), ['c1']);
  assert.deepEqual(pausasPorFecha(arbol, c, null), []);
});

test('pausasPendientes: la pausa por fecha que no salió se relanza; la aplicada (o la que prendió una persona) no (hallazgo 1)', () => {
  const pausas = pausasPorFecha([{ id: 'c1', nombre: 'Vieja', nivel: 'campaign', configurado: 'ACTIVE' }], { hasta: '2026-11-04', hastaCampanas: {} }, '2026-11-05');
  const clave = 'hasta:campaign:c1:2026-11-04';
  const d = (estado: string, tactica = 'hasta') => ({ clave, tactica, estado });
  assert.equal(pausasPendientes(pausas, [d('abierta')]).length, 1, 'quedó abierta (un «mirá la cuenta» por chat, una corrida cortada)');
  assert.equal(pausasPendientes(pausas, [d('fallida')]).length, 1, 'Zernio falló');
  assert.equal(pausasPendientes(pausas, [d('aplicada')]).length, 0, 'ya salió: si está prendida, la prendió una persona');
  assert.equal(pausasPendientes(pausas, [d('abierta', 'stop_loss')]).length, 0);
  assert.equal(pausasPendientes([], [d('abierta')]).length, 0, 'si ya no está prendida o pasada de fecha, nada');
});

test('lo guardado se lee entrada por entrada: una fecha rota no se lleva las demás; una zona ilegible no es «sin zona» (hallazgo 8)', () => {
  assert.deepEqual(leerHastaGuardadas({ '1': '2026-11-05', '2': 'roto', abc: '2026-11-05' }), { '1': '2026-11-05' });
  assert.deepEqual(leerZonaGuardada([ESPANA, { tipo: 'pin', key: 'x' }]).map((l) => l.key), ['ES']);
  assert.deepEqual(leerZonaGuardada([{ tipo: 'pin', key: 'x' }]), [ZONA_ILEGIBLE]);
  assert.equal(veredictoDeLugares([ZONA_ILEGIBLE], [ciudad('777', '1234', 'ES')]).veredicto, 'fuera', 'una zona ilegible no deja subir nada');
  assert.deepEqual(leerZonaGuardada([]), []);
  assert.deepEqual(leerZonaGuardada(null), []);
});

// ── La fecha en el motor ─────────────────────────────────────────────────────

const AHORA = Date.parse('2026-11-05T15:00:00Z');
const HOY = '2026-11-05';
const VIEJA = '2026-09-01T00:00:00Z';
const nodo = (id: string, nivel: NodoMB['nivel'], parentId: string | null, x: Partial<NodoMB> = {}): NodoMB => ({
  id, nombre: id, nivel, parentId, configurado: 'ACTIVE', entrega: 'ACTIVE', presupuestoDia: null, nivelPresupuesto: null, creada: VIEJA, ...x,
});
const senal = (adId: string, x: Partial<SenalMB> = {}): SenalMB => ({
  adId, gasto: 0, leadsMeta: 0, leadsCrm: 0, agendasMeta: 0, agendasCrm: 0, cierres: 0, caja: 0, impresiones: 1000, frecuencia: 1.2, diasCorriendo: 7, esVideo: false, miniatura: null, ...x,
});
const arbol = (): NodoMB[] => [
  nodo('c1', 'campaign', null, { nivelPresupuesto: 'adset' }),
  nodo('s1', 'adset', 'c1', { presupuestoDia: 50, nivelPresupuesto: 'adset' }),
  nodo('a1', 'ad', 's1'),
];
function entrada(x: Omit<Partial<EntradaMotor>, 'config'> & { config?: Partial<ConfigMediaBuyer> } = {}): EntradaMotor {
  const { config, ...resto } = x;
  return {
    ahora: AHORA, config: { ...CONFIG_POR_DEFECTO, encendido: true, ...(config ?? {}) }, objetivo: 10, arbol: arbol(),
    corta: [], larga: [], crm: [], historial: [], aUnidad: (m) => m, fmt: (u) => `US$ ${u.toFixed(2)}`, presupuestoMinimo: 5, hoyNegocio: HOY,
    ...resto,
  };
}
// Un conjunto que Surf subiría: leads baratos y todo el presupuesto gastado.
const RINDE = { corta: [senal('a1', { gasto: 150, leadsMeta: 20 })], larga: [senal('a1', { gasto: 350, leadsMeta: 45 })] };

test('motor: sin fecha, Surf sube como siempre (la línea de base de los tests de abajo)', () => {
  assert.equal(proponer(entrada(RINDE), HOY).find((p) => p.entidadId === 's1')?.tactica, 'surf');
});

test('motor: con la fecha de fin cerca, Surf NO sube (la de la campaña o la de la cuenta)', () => {
  assert.equal(proponer(entrada({ ...RINDE, config: { hastaCampanas: { c1: '2026-11-06' } } }), HOY).find((p) => p.entidadId === 's1'), undefined);
  assert.equal(proponer(entrada({ ...RINDE, config: { hasta: '2026-11-07' } }), HOY).find((p) => p.entidadId === 's1'), undefined);
  assert.equal(proponer(entrada({ ...RINDE, config: { hasta: '2026-11-20' } }), HOY).find((p) => p.entidadId === 's1')?.tactica, 'surf', 'lejos sí sube');
  assert.equal(proponer(entrada({ ...RINDE, config: { hasta: '2026-11-20' }, hoyNegocio: null }), HOY).find((p) => p.entidadId === 's1'), undefined, 'sin el día del negocio, no sube lo que tiene fecha');
});

test('motor: pasada la fecha, la campaña se pausa (táctica hasta) y le gana a cualquier otra cosa sobre ella', () => {
  const ps = proponer(entrada({ ...RINDE, config: { hasta: '2026-11-04' } }), HOY);
  const h = ps.find((p) => p.tactica === 'hasta');
  assert.ok(h, 'propone la pausa por fecha');
  assert.equal(h.entidadId, 'c1');
  assert.equal(h.nivel, 'campaign');
  assert.equal(h.tipo, 'pausar');
  assert.equal(h.clave, 'hasta:campaign:c1:2026-11-04', 'una vez por fecha, no por día');
  assert.equal(ps.find((p) => p.entidadId === 's1' && p.tipo === 'subir_presupuesto'), undefined, 'no sube lo que terminó');
});

test('motor: la pausa por fecha no necesita objetivo, y con el Media Buyer apagado no hay nada', () => {
  assert.ok(proponer(entrada({ objetivo: null, config: { hasta: '2026-11-04' } }), HOY).some((p) => p.tactica === 'hasta'));
  assert.deepEqual(proponer(entrada({ config: { hasta: '2026-11-04', encendido: false } }), HOY), []);
});

test('motor: Revive no prende lo que pausó la fecha de fin, ni lo que ya pasó su fecha', () => {
  const pausada = arbol().map((n) => (n.id === 'a1' ? { ...n, configurado: 'PAUSED' } : n));
  const crm = [senal('a1', { gasto: 50, leadsCrm: 10 })]; // US$5 por lead: Revive lo prendería
  const porMaKo = (tactica: DecisionPrevia['tactica']): DecisionPrevia => ({ tipo: 'pausar', tactica, nivel: 'ad', entidadId: 'a1', estado: 'aplicada', creada: '2026-11-01T10:00:00Z', aplicadaAt: '2026-11-01T10:00:00Z', origen: 'piloto' });
  const revive = (x: Omit<Partial<EntradaMotor>, 'config'> & { config?: Partial<ConfigMediaBuyer> }) => proponer(entrada({ arbol: pausada, crm, ...x }), HOY).find((p) => p.tactica === 'revive');
  assert.ok(revive({ historial: [porMaKo('stop_loss')] }), 'la línea de base: Revive prende lo que pausó el Stop Loss');
  assert.equal(revive({ historial: [porMaKo('hasta')] }), undefined, 'lo que pausó la fecha no');
  assert.equal(revive({ historial: [porMaKo('stop_loss')], config: { hasta: '2026-11-01' } }), undefined, 'con la fecha pasada no');
});

// ── El público por Zernio ────────────────────────────────────────────────────

test('Zernio: género, edades y públicos van en su forma; null vuelve a lo de Meta por defecto', () => {
  const c = publicoParaZernio({}, { genero: 'm', edadMin: 25, edadMax: null, publicos: [] });
  assert.deepEqual(c.targeting, { gender: 'female', ageMin: 25, ageMax: 65, audienceInclude: [] });
  assert.equal(c.placements, undefined, 'las ubicaciones no se tocan si no vinieron');
});

test('Zernio: las ubicaciones REEMPLAZAN el set: se reenvían las posiciones de las plataformas que quedan', () => {
  const crudo = { publisher_platforms: ['facebook', 'instagram'], facebook_positions: ['feed'], instagram_positions: ['stream', 'story'] };
  const c = publicoParaZernio(crudo, { ubicaciones: ['instagram'] });
  assert.deepEqual(c.placements, { publisherPlatforms: ['instagram'], instagramPositions: ['stream', 'story'] });
  assert.equal(publicoParaZernio(crudo, { ubicaciones: null }).placements, null, 'automáticas');
});

test('Zernio: Advantage+ no se cambia por acá (si no cambia, no molesta)', () => {
  assert.throws(() => publicoParaZernio({ targeting_automation: { advantage_audience: 0 } }, { advantage: 1 }), /Advantage\+/);
  assert.doesNotThrow(() => publicoParaZernio({ targeting_automation: { advantage_audience: 1 } }, { advantage: 1, genero: 'all' }));
});

test('Zernio: los lugares van TODOS (incluidos y excluidos) con su radio de Meta intacto; un barrio frena todo', () => {
  const lec = lugaresDesdeMeta(
    { countries: ['ES'], cities: [{ key: '777', name: 'Madrid', region_id: '1234', country: 'ES', radius: 10, distance_unit: 'mile' }] },
    { regions: [{ key: '5555', name: 'Cataluña', country: 'ES' }] },
  );
  const g = lugaresParaZernio(lec.lugares);
  assert.deepEqual(g, {
    countries: ['ES'], cities: [{ key: '777', radius: 10, distanceUnit: 'mile' }], excludedLocations: { regions: [{ key: '5555' }] },
  });
  const pin: LugarMeta = { tipo: 'pin', key: '40.4,-3.7', nombre: 'Sol', lat: 40.4, lng: -3.7, radioKm: 3 };
  assert.deepEqual(lugaresParaZernio([pin]), { customLocations: [{ latitude: 40.4, longitude: -3.7, radius: 3, distanceUnit: 'kilometer' }] });
  assert.throws(() => lugaresParaZernio([{ tipo: 'neighborhood', key: '1', nombre: 'Malasaña', pais: 'ES' }]), /Malasaña/);
  assert.throws(() => lugaresParaZernio([{ tipo: 'country', key: 'ES', nombre: 'España', excluir: true }]), /al menos un lugar/);
});

test('Zernio: con lugares que MaKo no entiende, o un location_types que no es el de siempre, no se mandan lugares (hallazgo 7)', () => {
  const pin = { lat: 40.4, lng: -3.7, radioKm: 3 };
  const raro = lugaresDesdeMeta({ countries: ['ES'], country_groups: ['europe'] }, null);
  assert.throws(() => publicoParaZernio({}, { lugares: { lectura: raro, lista: raro.lugares } }), /no sabe editar/);
  const viaja = lugaresDesdeMeta({ countries: ['ES'], location_types: ['travel_in'] }, null);
  assert.throws(() => publicoParaZernio({}, { lugares: { lectura: viaja, lista: viaja.lugares } }), /vive o viaja/);
  const normal = lugaresDesdeMeta({ countries: ['ES'], location_types: ['recent', 'home'] }, null);
  assert.doesNotThrow(() => publicoParaZernio({}, { lugares: { lectura: normal, lista: [...normal.lugares, { tipo: 'pin', key: '40.4,-3.7', nombre: 'Sol', ...pin }] } }));
});

test('Zernio: sin nada para cambiar, no se escribe', () => {
  assert.throws(() => publicoParaZernio({}, {}), /nada que cambiar/);
});
