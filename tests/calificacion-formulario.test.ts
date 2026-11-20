// =============================================================================
// Calificación automática por lo que contesta el lead en un formulario (20/11/2026)
// =============================================================================
// El caso de Juanfran (Código Inmobiliario, ws 13): «si cumple 3 de 4 preguntas → calificado; 2 de 4 → revisión» y «hay
// respuestas que descalifican de una (la zona)». El motor es puro (lib/calificacion-formulario.ts): se EJECUTA con
// respuestas como las manda Meta (`field_data`, en minúscula y con guiones bajos) y como las manda una página.
//
// Correr: node --import tsx --test tests/calificacion-formulario.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calificar, cumpleCondicion, numeroDe, normalizar, sanearReglas, preguntasDeEnvios, previaDeReglas, minimoDe, puedeMoverDesde,
  type ReglasFormulario, type CondicionRegla,
} from '../lib/calificacion-formulario';
import {
  parsearMapaReglas, serializarMapaReglas, conReglas, reglasDe, hayReglasPara, claveMeta, claveWeb, tipoDeClave,
  parsearAsignacionesMeta, serializarAsignacionesMeta, alternarFormularioMeta, type MapaReglas, type AsignacionesMeta,
} from '../lib/fuentes-formularios';

// Los cuatro criterios de un comprador, con los nombres que pone Meta.
const CRITERIOS: CondicionRegla[] = [
  { pregunta: '¿cuál_es_tu_presupuesto?', op: 'es', valores: ['Más de 3 millones', '2 a 3 millones'] },
  { pregunta: '¿cuándo_quieres_comprar?', op: 'es', valores: ['Este mes', 'En 3 meses'] },
  { pregunta: '¿tienes_crédito_aprobado?', op: 'es', valores: ['Sí'] },
  { pregunta: '¿es_para_vivir_o_invertir?', op: 'es', valores: ['Vivir'] },
];
const JUANFRAN: ReglasFormulario = {
  activa: true,
  rutas: [
    { id: 'zona', modo: 'alguna', minimo: 1, condiciones: [{ pregunta: '¿en_qué_zona_buscas?', op: 'es', valores: ['Fuera de la ciudad'] }], etapa: 'descalificado' },
    { id: 'tres', modo: 'al_menos', minimo: 3, condiciones: CRITERIOS, etapa: 'lead' },
    { id: 'dos', modo: 'al_menos', minimo: 2, condiciones: CRITERIOS, etapa: 'revision' },
  ],
  siNinguna: 'descalificado',
};

const lead = (o: Record<string, string>) => ({
  full_name: 'Ana', email: 'ana@x.com', phone_number: '+5215555555555',
  '¿en_qué_zona_buscas?': 'norte',
  ...o,
});

test('el caso de Juanfran: 3 de 4 → Lead entrante, 2 de 4 → Revisión, menos → Descalificado', () => {
  const tres = calificar(JUANFRAN, lead({ '¿cuál_es_tu_presupuesto?': 'más_de_3_millones', '¿cuándo_quieres_comprar?': 'este_mes', '¿tienes_crédito_aprobado?': 'sí', '¿es_para_vivir_o_invertir?': 'invertir' }));
  assert.equal(tres.etapa, 'lead');
  assert.equal(tres.indice, 1);
  assert.match(tres.porque, /^Cumple 3 de 4: /);

  const cuatro = calificar(JUANFRAN, lead({ '¿cuál_es_tu_presupuesto?': '2_a_3_millones', '¿cuándo_quieres_comprar?': 'en_3_meses', '¿tienes_crédito_aprobado?': 'sí', '¿es_para_vivir_o_invertir?': 'vivir' }));
  assert.equal(cuatro.etapa, 'lead', '4 de 4 también es «al menos 3»');
  assert.match(cuatro.porque, /Cumple 4 de 4/);

  const dos = calificar(JUANFRAN, lead({ '¿cuál_es_tu_presupuesto?': 'menos_de_1_millón', '¿cuándo_quieres_comprar?': 'este_mes', '¿tienes_crédito_aprobado?': 'sí' }));
  assert.equal(dos.etapa, 'revision');
  assert.equal(dos.indice, 2);

  const uno = calificar(JUANFRAN, lead({ '¿tienes_crédito_aprobado?': 'sí' }));
  assert.equal(uno.etapa, 'descalificado', 'el respaldo');
  assert.equal(uno.indice, null);
  assert.equal(uno.porque, 'No cumplió ninguna regla');
});

test('la zona descalifica de una aunque cumpla los 4 (la primera ruta gana)', () => {
  const r = calificar(JUANFRAN, lead({
    '¿en_qué_zona_buscas?': 'fuera_de_la_ciudad',
    '¿cuál_es_tu_presupuesto?': 'más_de_3_millones', '¿cuándo_quieres_comprar?': 'este_mes', '¿tienes_crédito_aprobado?': 'sí', '¿es_para_vivir_o_invertir?': 'vivir',
  }));
  assert.equal(r.etapa, 'descalificado');
  assert.equal(r.indice, 0);
  assert.equal(r.porque, '¿En qué zona buscas? es Fuera de la ciudad', 'legible: sin guiones bajos y con mayúscula');
});

test('la misma pregunta escrita como la pone la página o como la pone Meta', () => {
  assert.equal(normalizar('¿En qué zona buscas?'), normalizar('¿en_qué_zona_buscas?'));
  assert.equal(normalizar('Más de 3 millones'), normalizar('más_de_3_millones'));
  const c: CondicionRegla = { pregunta: '¿En qué zona buscas?', op: 'es', valores: ['Norte'] };
  assert.equal(cumpleCondicion(c, { '¿en_qué_zona_buscas?': ['norte'] }), true, 'Meta manda listas');
  assert.equal(cumpleCondicion(c, { 'en que zona buscas': 'NORTE ' }), true);
});

test('«no es» sin respuesta no se cumple; para eso está «no tiene respuesta»', () => {
  const noEs: CondicionRegla = { pregunta: 'zona', op: 'no_es', valores: ['Norte'] };
  assert.equal(cumpleCondicion(noEs, {}), false, 'no descalifica al que no contestó');
  assert.equal(cumpleCondicion(noEs, { zona: 'Sur' }), true);
  assert.equal(cumpleCondicion(noEs, { zona: 'norte' }), false);
  assert.equal(cumpleCondicion({ pregunta: 'zona', op: 'no_responde', valores: [] }, {}), true);
  assert.equal(cumpleCondicion({ pregunta: 'zona', op: 'responde', valores: [] }, { zona: '  ' }), false, 'un blanco no es respuesta');
});

test('contiene, mayor y menor', () => {
  assert.equal(cumpleCondicion({ pregunta: 'mensaje', op: 'contiene', valores: ['casa'] }, { mensaje: 'Busco una CASA en el norte' }), true);
  assert.equal(cumpleCondicion({ pregunta: 'mensaje', op: 'no_contiene', valores: ['casa'] }, { mensaje: 'Un depto' }), true);
  assert.equal(cumpleCondicion({ pregunta: 'presupuesto', op: 'mayor', valores: ['2 millones'] }, { presupuesto: '$2,500,000' }), true);
  assert.equal(cumpleCondicion({ pregunta: 'presupuesto', op: 'mayor', valores: ['2000000'] }, { presupuesto: '1.5M' }), false);
  assert.equal(cumpleCondicion({ pregunta: 'presupuesto', op: 'menor', valores: ['500 mil'] }, { presupuesto: '300.000' }), true);
  assert.equal(cumpleCondicion({ pregunta: 'presupuesto', op: 'mayor', valores: ['100'] }, { presupuesto: 'no sé' }), false, 'sin número, no se cumple');
});

test('los números escritos a mano', () => {
  assert.equal(numeroDe('$2,500,000'), 2_500_000);
  assert.equal(numeroDe('1.200.000'), 1_200_000);
  assert.equal(numeroDe('2.5M'), 2_500_000);
  assert.equal(numeroDe('2,5 millones'), 2_500_000);
  assert.equal(numeroDe('300 mil'), 300_000);
  assert.equal(numeroDe('300.000'), 300_000);
  assert.equal(numeroDe('12k'), 12_000);
  assert.equal(numeroDe('1,234.56'), 1234.56);
  assert.equal(numeroDe('sin número'), null);
});

test('apagadas o sin respaldo, no se mueve a nadie', () => {
  assert.equal(calificar({ ...JUANFRAN, activa: false }, lead({})).etapa, null);
  assert.equal(calificar(null, lead({})).etapa, null);
  assert.equal(calificar({ ...JUANFRAN, siNinguna: null }, lead({})).etapa, null, 'sin respaldo se queda donde entró');
});

test('los modos: todas, alguna y al menos N (con el mínimo entre 1 y N)', () => {
  const conds = CRITERIOS.slice(0, 3);
  assert.equal(minimoDe({ modo: 'todas', minimo: 1, condiciones: conds }), 3);
  assert.equal(minimoDe({ modo: 'alguna', minimo: 9, condiciones: conds }), 1);
  assert.equal(minimoDe({ modo: 'al_menos', minimo: 9, condiciones: conds }), 3);
  assert.equal(minimoDe({ modo: 'al_menos', minimo: 0, condiciones: conds }), 1);
  const todas: ReglasFormulario = { activa: true, siNinguna: null, rutas: [{ id: 'a', modo: 'todas', minimo: 1, condiciones: conds, etapa: 'lead' }] };
  assert.equal(calificar(todas, lead({ '¿cuál_es_tu_presupuesto?': 'más_de_3_millones', '¿cuándo_quieres_comprar?': 'este_mes' })).etapa, null);
  assert.equal(calificar(todas, lead({ '¿cuál_es_tu_presupuesto?': 'más_de_3_millones', '¿cuándo_quieres_comprar?': 'este_mes', '¿tienes_crédito_aprobado?': 'si' })).etapa, 'lead');
});

test('sanear: se cae lo que va a una etapa que no existe y lo que no es una condición', () => {
  const s = sanearReglas({
    activa: true,
    rutas: [
      { id: 'x', modo: 'al_menos', minimo: 7, condiciones: CRITERIOS, etapa: 'lead' },
      { id: 'fantasma', modo: 'todas', condiciones: CRITERIOS, etapa: 'no-existe' },
      { id: 'vacia', modo: 'todas', condiciones: [{ pregunta: '', op: 'es', valores: ['a'] }, { pregunta: 'zona', op: 'raro', valores: ['a'] }, { pregunta: 'zona', op: 'es', valores: [] }], etapa: 'lead' },
    ],
    siNinguna: 'otra-fantasma',
  }, ['lead', 'descalificado']);
  assert.ok(s);
  assert.equal(s.rutas.length, 1);
  assert.equal(s.rutas[0].minimo, 4, 'el mínimo no pasa de N');
  assert.equal(s.siNinguna, null);
  assert.equal(sanearReglas('nada', ['lead']), null);
  const vacia = sanearReglas({ activa: true, rutas: [], siNinguna: null }, ['lead']);
  assert.equal(vacia?.activa, false, 'sin rutas ni respaldo no hay nada que encender');
});

test('sólo se mueve al que está en la entrada o en una etapa que las reglas reparten', () => {
  assert.equal(puedeMoverDesde('lead', JUANFRAN, 'lead'), true, 'recién entrado');
  assert.equal(puedeMoverDesde('descalificado', JUANFRAN, 'lead'), true, 'el que el inmobiliario descalificó a mano y cumplía');
  assert.equal(puedeMoverDesde('revision', JUANFRAN, 'lead'), true);
  assert.equal(puedeMoverDesde('agenda', JUANFRAN, 'lead'), false, 'ya avanzó: no vuelve atrás');
  assert.equal(puedeMoverDesde('ganado', JUANFRAN, 'lead'), false);
  assert.equal(puedeMoverDesde(null, JUANFRAN, 'lead'), true, 'sin etapa todavía es la entrada');
});

test('el guardado: reglas por funnel y por formulario, sin romper con basura', () => {
  let m: MapaReglas = parsearMapaReglas(null);
  m = conReglas(m, 7, claveMeta('120000000001'), { ...JUANFRAN, nombre: 'Compradores' });
  m = conReglas(m, 9, 'form:abc', { activa: false, rutas: [], siNinguna: 'descal' });
  const leido = parsearMapaReglas(serializarMapaReglas(m));
  assert.equal(reglasDe(leido, 7, 'meta:120000000001')?.rutas.length, 3);
  assert.equal(reglasDe(leido, 7, 'meta:120000000001')?.nombre, 'Compradores');
  assert.equal(reglasDe(leido, 9, 'form:abc')?.siNinguna, 'descal');
  assert.equal(reglasDe(leido, 7, 'form:abc'), null, 'las reglas son de UN funnel');
  assert.equal(hayReglasPara(leido, ['meta:120000000001']), true);
  assert.equal(hayReglasPara(leido, ['form:abc']), false, 'apagadas no cuentan');
  assert.equal(reglasDe(conReglas(leido, 7, 'meta:120000000001', null), 7, 'meta:120000000001'), null, 'null las borra');
  assert.deepEqual(parsearMapaReglas('{"porFunnel":{"x":{},"8":{"nada:1":{}}}}'), {}, 'un funnel o una clave inválidos se descartan');
  assert.deepEqual(parsearMapaReglas('no es json'), {});
  assert.equal(claveWeb('https://a.com/contacto'), 'web:https://a.com/contacto');
  assert.equal(tipoDeClave('web:https://a.com'), 'web');
  assert.equal(tipoDeClave('form:x'), 'wg');
});

test('los formularios de Meta asignados: prender suma el funnel al final, apagar el último lo desasigna', () => {
  let a: AsignacionesMeta = parsearAsignacionesMeta(null);
  a = alternarFormularioMeta(a, '120000000001', 'Compradores', 5, true);
  a = alternarFormularioMeta(a, '120000000001', 'Compradores', 8, true);
  a = alternarFormularioMeta(a, '120000000001', 'Compradores', 8, true);
  assert.deepEqual(a['120000000001'].funnels, [5, 8], 'la casa primero y sin repetir');
  const leido = parsearAsignacionesMeta(serializarAsignacionesMeta(a));
  assert.deepEqual(leido['120000000001'], { funnels: [5, 8], nombre: 'Compradores' });
  a = alternarFormularioMeta(leido, '120000000001', '', 5, false);
  assert.deepEqual(a['120000000001'].funnels, [8]);
  a = alternarFormularioMeta(a, '120000000001', '', 8, false);
  assert.equal(a['120000000001'], undefined);
  assert.deepEqual(alternarFormularioMeta({}, 'no-es-un-id', 'x', 5, true), {}, 'un id que no es de Meta no se guarda');
});

test('las preguntas salen de los envíos, sin los datos de contacto y con las respuestas más comunes primero', () => {
  const envios = [
    lead({ '¿tienes_crédito_aprobado?': 'sí' }),
    lead({ '¿tienes_crédito_aprobado?': 'no', '¿en_qué_zona_buscas?': 'sur' }),
    lead({ '¿tienes_crédito_aprobado?': 'sí', '0': 'basura' }),
  ];
  const ps = preguntasDeEnvios(envios);
  assert.deepEqual(ps.map((p) => p.rotulo), ['¿En qué zona buscas?', '¿Tienes crédito aprobado?']);
  assert.deepEqual(ps.map((p) => p.pregunta), ['¿en_qué_zona_buscas?', '¿tienes_crédito_aprobado?'], 'se guarda como llegó');
  assert.deepEqual(ps[1].respuestas, [{ valor: 'Sí', veces: 2 }, { valor: 'No', veces: 1 }]);
  const previa = previaDeReglas(JUANFRAN, envios);
  assert.equal([...previa.values()].reduce((a, b) => a + b, 0), 3, 'cada envío cae en algún lado');
});
