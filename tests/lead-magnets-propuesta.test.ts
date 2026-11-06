// =============================================================================
// MaKo propone el lead magnet (lib/lead-magnets/propuesta.ts): lo que lee la IA y lo que el código le acepta
// =============================================================================
// La IA del negocio elige y redacta; el código decide qué se muestra. Cada regla con su caso, y el dossier que lee la IA sin
// los nombres de los competidores. Los negocios del ejemplo son del elenco ficticio (docs/plantillas-reales/README.md).
//
// PROBADO ROMPIÉNDOLO (6/11/2026), una rotura por vez en lib/lead-magnets/propuesta.ts, cada una en rojo:
//   · sin el chequeo de la plantilla, de la fuente sin competidores, del nombre, del rótulo «Competidor N» o del voseo → 1;
//   · sin el de las repetidas → 2 · sin el tope de 3 → 1 · el dossier con el nombre del competidor → 1;
//   · `nombraA` sin límites de palabra («Max» adentro de «maximizar») → 1.
// Y los de la revisión de la tanda 3: sin el de la oferta que falta → 1 · sin el de los números → 1 · sin el apellido → 2 · sin
// la forma sin espacios → 1 · lo de Spy sin tapar → 1 · sin el catálogo de referentes → 1 · cortar el nombre ANTES de mirar → 1
// · las guardadas sin filtrar las que ya armó → 1 · un número chico con plazo o % como «forma» → 1 · «competidor uno» → 1.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dossierParaProponer, leerGuardadas, leerPropuestas, nombresProhibidos, numerosInventados, plantillasParaLaIA, PROPONER_LM_SYSTEM_TEMPLATE,
  PROPONER_LM_USER_TEMPLATE, sinLasQueYaTiene, taparNombres, TOPE_PROPUESTAS,
} from '../lib/lead-magnets/propuesta';
import { ASESORES } from '../lib/asesores/catalogo';
import { PLANTILLAS_LEAD_MAGNET } from '../lib/lead-magnets/plantillas';
import { marcasDeVoseo } from '../lib/voseo';

const OFERTA = {
  nombre: 'Agenda Llena', promesa: 'Llenar la agenda de un consultorio dental en 60 días sin publicar todos los días',
  para_quien: 'Dentistas con consultorio propio que dependen de recomendaciones', objeciones: 'No tengo tiempo para redes', incluye: 'Anuncios, guiones y seguimiento',
};
const COMPETIDORES = [
  { nombre: 'Clínicas al Máximo', instagram: '@clinicasalmaximo', oferta: { promete: 'Duplicar pacientes en 90 días con el método Clínicas al Máximo', aQuien: 'Clínicas dentales', objecion: 'Es caro', huecos: ['Habla del costo por paciente', 'Muestra casos con números'] } },
  { nombre: 'Sonrisa Pro', instagram: null, oferta: null },
  // Una persona: su apellido también se prohíbe.
  { nombre: 'Renata Villaseñor', instagram: '@renatavilla', oferta: null },
];

test('el dossier: la oferta primero y los competidores ANÓNIMOS; sin de dónde proponer, null', () => {
  const d = dossierParaProponer({ ofertas: [OFERTA], competidores: COMPETIDORES, yaTiene: ['Guía: tu agenda llena'] })!;
  assert.ok(d, 'con oferta hay dossier');
  assert.equal(d.hayOferta, true);
  assert.match(d.oferta, /Promete: Llenar la agenda/);
  assert.match(d.competencia, /Competidor 1:\n {2}promete: Duplicar pacientes en 90 días con el método \[nombre\]/, 'lo que leyó Spy, con el nombre tapado');
  assert.equal(d.nCompetidores, 1, 'el competidor sin su oferta leída no entra');
  // La IA nunca ve un nombre: ni el del competidor ni su @.
  assert.doesNotMatch(`${d.oferta}\n${d.competencia}\n${d.yaTiene}`, /Clínicas al Máximo|clinicasalmaximo|Sonrisa Pro|Villaseñor/);
  for (const n of ['Clínicas al Máximo', 'clinicasalmaximo', 'Sonrisa Pro', 'Renata Villaseñor', 'Villaseñor', 'renatavilla']) assert.ok(d.prohibidos.includes(n), `falta prohibir ${n}`);
  assert.ok(!d.prohibidos.includes('Máximo') && !d.prohibidos.includes('Pro'), 'un nombre de negocio no prohíbe sus palabras sueltas');
  // Los referentes del catálogo, siempre (sin escribir sus nombres acá: salen del catálogo).
  for (const a of ASESORES) assert.ok(d.prohibidos.includes(a.completo), `falta el referente ${a.id}`);
  assert.match(d.yaTiene, /- Guía: tu agenda llena/);
  // Sin oferta con contenido y sin competidores leídos: no hay de dónde proponer.
  assert.equal(dossierParaProponer({ ofertas: [{ nombre: 'Vacía' }], competidores: [COMPETIDORES[1]], yaTiene: [] }), null);
  // Sólo con la competencia, sí (y lo dice).
  const sinOferta = dossierParaProponer({ ofertas: [], competidores: COMPETIDORES, yaTiene: [] })!;
  assert.match(sinOferta.oferta, /No cargó su oferta/);
  assert.equal(sinOferta.hayOferta, false);
});

test('tapar y prohibir: sin tildes, sin mayúsculas, y una palabra que CONTIENE el nombre no cuenta', () => {
  assert.equal(taparNombres('Lo hace CLINICAS al maximo, como siempre.', ['Clínicas al Máximo']), 'Lo hace [nombre], como siempre.');
  assert.equal(taparNombres('Checklist para maximizar', ['Max']), 'Checklist para maximizar');
  // Un apellido de persona sólo si el nombre es de persona y largo; de un nombre de tres palabras del catálogo, no.
  assert.ok(nombresProhibidos([{ nombre: 'Renata Villaseñor' }]).includes('Villaseñor'));
  assert.ok(!nombresProhibidos([{ nombre: 'Ana Ruiz' }]).includes('Ruiz'), 'corto: prohibiría palabras comunes');
});

test('el prompt: las plantillas que existen, los slots que llena el código, y en español neutro', () => {
  const lista = plantillasParaLaIA();
  for (const p of PLANTILLAS_LEAD_MAGNET) assert.match(lista, new RegExp(`- ${p.id}: `), `falta la plantilla ${p.id}`);
  for (const s of ['{{plantillas}}', '{{forma}}']) assert.ok(PROPONER_LM_SYSTEM_TEMPLATE.includes(s), `el system sin ${s}`);
  for (const s of ['{{oferta}}', '{{competencia}}', '{{yaTiene}}']) assert.ok(PROPONER_LM_USER_TEMPLATE.includes(s), `el user sin ${s}`);
  assert.deepEqual(marcasDeVoseo(PROPONER_LM_SYSTEM_TEMPLATE + PROPONER_LM_USER_TEMPLATE), []);
});

const contexto = {
  nCompetidores: 1, hayOferta: true, prohibidos: ['Clínicas al Máximo', 'clinicasalmaximo', 'Renata Villaseñor', 'Villaseñor', 'MasteryHaus'],
  fuentes: ['Promete: Llenar la agenda de un consultorio dental en 60 días', 'promete: Duplicar pacientes en 90 días'], yaTiene: ['Guía: tu agenda llena'],
};
const una = (x: Record<string, unknown>) => JSON.stringify({ propuestas: [{ plantilla: 'checklist', nombre: 'Checklist: 10 puntos antes de pagar anuncios', porQue: 'Toca el miedo de tu cliente a gastar sin pacientes.', fuente: 'oferta', ...x }] });

test('lo que el código le acepta a la IA: una buena pasa entera', () => {
  const r = leerPropuestas(una({}), contexto);
  assert.ok(r.ok);
  assert.deepEqual(r.propuestas, [{ plantilla: 'checklist', nombre: 'Checklist: 10 puntos antes de pagar anuncios', porQue: 'Toca el miedo de tu cliente a gastar sin pacientes.', fuente: 'oferta' }]);
  assert.deepEqual(r.descartadas, []);
});

test('y descarta, con su motivo, lo que no se puede mostrar', () => {
  const motivo = (x: Record<string, unknown>, c = contexto) => {
    const r = leerPropuestas(una(x), c);
    assert.ok(r.ok);
    assert.equal(r.propuestas.length, 0, `pasó: ${JSON.stringify(x)}`);
    return r.descartadas[0]?.motivo ?? '';
  };
  assert.match(motivo({ plantilla: 'ebook' }), /no existe/, 'una plantilla inventada no se puede armar');
  assert.match(motivo({ fuente: 'competencia' }, { ...contexto, nCompetidores: 0 }), /competencia/, 'sin competidores leídos, «la competencia» es inventada');
  assert.match(motivo({ fuente: 'intuicion' }), /de dónde/);
  assert.match(motivo({ nombre: 'Lo que Clínicas al Máximo no te dice' }), /competidor/, 'el nombre de un competidor');
  assert.match(motivo({ porQue: 'Como hace CLINICAS AL MAXIMO, pero gratis.' }), /competidor/, 'sin tildes ni mayúsculas, igual');
  assert.match(motivo({ porQue: 'Lo que @clinicasalmaximo regala.' }), /competidor/, 'su @');
  assert.match(motivo({ porQue: 'Lo que enseña Villaseñor, en tu idioma.' }), /competidor/, 'el apellido de una persona');
  assert.match(motivo({ nombre: 'Checklist estilo RenataVillaseñor para tu agenda' }), /competidor/, 'junto, sin espacios');
  assert.match(motivo({ nombre: 'Checklist de MasteryHaus para dentistas' }), /referente/, 'un curso del catálogo');
  assert.match(motivo({ porQue: 'El Competidor 1 no lo dice.' }), /número/, 'el rótulo anónimo tampoco');
  assert.match(motivo({ porQue: 'El Competidor #2 no lo dice.' }), /número/);
  assert.match(motivo({ porQue: 'El competidor uno no lo dice.' }), /número/);
  // Cortar antes de mirar dejaba pasar un nombre partido al final: un nombre largo se descarta entero.
  assert.match(motivo({ nombre: `${'Checklist para tu consultorio dental '.repeat(2)}como lo hace Renata Villaseñor` }), /90 caracteres|competidor/);
  // «De tu oferta» sin oferta es falso.
  assert.match(motivo({ fuente: 'oferta' }, { ...contexto, hayOferta: false }), /no tiene una/);
  assert.match(motivo({ fuente: 'las-dos' }, { ...contexto, hayOferta: false }), /no tiene una/);
  // Un resultado inventado: plata, porcentaje o plazo que no está en lo que leyó.
  assert.match(motivo({ nombre: 'Guía: duplica tus ventas en 30 días' }), /número/);
  assert.match(motivo({ porQue: 'Les promete ganar $10,000 al mes.' }), /número/);
  assert.match(motivo({ nombre: 'Checklist para crecer un 40% este mes' }), /número/);
  assert.match(motivo({ nombre: 'Checklist: revisá tus anuncios hoy' }), /neutro/, 'en neutro: lo lee el lead');
  assert.match(motivo({ nombre: 'Guía: tu agenda llena' }), /ya lo tiene/, 'uno que ya tiene');
  assert.match(motivo({ nombre: 'Hola' }), /sin nombre/);
  assert.match(motivo({ porQue: '' }), /porqué/);
  // Los números que están en lo que leyó, o la forma de la pieza, sí.
  const conFuente = leerPropuestas(una({ nombre: 'Guía: tu agenda llena en 60 días' }), contexto);
  assert.ok(conFuente.ok);
  assert.equal(conFuente.propuestas.length, 1, 'el 60 está en la oferta');
  assert.deepEqual(numerosInventados('Checklist: 10 puntos, 7 pasos, en 5 minutos', []), [], 'la forma de la pieza no pide fuente');
  assert.deepEqual(numerosInventados('Gana 25 pacientes', []), ['25'], 'un número grande suelto, sí');
  assert.deepEqual(numerosInventados('Agenda llena en 7 días, o 3% más', []), ['7 días', '3%'], 'chico, pero con un plazo o un porcentaje: es un resultado');
  // Que un nombre CONTENGA las letras de un competidor no es nombrarlo: «Max» adentro de «maximizar» no cuenta.
  const adentro = leerPropuestas(una({ nombre: 'Checklist para maximizar tu agenda' }), { ...contexto, prohibidos: ['Max'] });
  assert.ok(adentro.ok);
  assert.equal(adentro.propuestas.length, 1, `se descartó: ${JSON.stringify(adentro.descartadas)}`);
});

test('hasta 3, sin repetidas, y una respuesta que no se entiende es un error, no un vacío', () => {
  const p = (n: number) => ({ plantilla: 'guia', nombre: `Guía número ${n} para tu consultorio`, porQue: 'Sale de tu oferta.', fuente: 'oferta' });
  const r = leerPropuestas(JSON.stringify({ propuestas: [p(1), p(1), p(2), p(3), p(4)] }), contexto);
  assert.ok(r.ok);
  assert.equal(r.propuestas.length, TOPE_PROPUESTAS);
  assert.deepEqual(r.propuestas.map((x) => x.nombre), ['Guía número 1 para tu consultorio', 'Guía número 2 para tu consultorio', 'Guía número 3 para tu consultorio']);
  assert.match(r.descartadas[0].motivo, /repetida/);
  assert.equal(leerPropuestas('no sé', contexto).ok, false);
  assert.equal(leerPropuestas('{"otra":1}', contexto).ok, false);
});

test('una propuesta ya armada no se vuelve a ofrecer', () => {
  const g = { en: '2026-11-06T06:00:00.000Z', propuestas: [
    { plantilla: 'quiz', nombre: 'Quiz: ¿tu agenda está lista?', porQue: 'x', fuente: 'oferta' as const },
    { plantilla: 'guia', nombre: 'Guía: tu agenda llena', porQue: 'y', fuente: 'oferta' as const },
  ] };
  assert.deepEqual(sinLasQueYaTiene(g, ['GUIA: TU AGENDA LLENA'])?.propuestas.map((p) => p.plantilla), ['quiz']);
  assert.equal(sinLasQueYaTiene(null, []), null);
});

test('lo guardado vuelve con la misma forma, y lo roto no se dibuja', () => {
  const g = leerGuardadas(JSON.stringify({ en: '2026-11-06T06:00:00.000Z', propuestas: [{ plantilla: 'quiz', nombre: 'Quiz: ¿tu agenda está lista?', porQue: 'x', fuente: 'las-dos' }, { plantilla: 'nada', nombre: 'n', porQue: 'p', fuente: 'oferta' }] }));
  assert.deepEqual(g?.propuestas.map((x) => x.plantilla), ['quiz']);
  assert.equal(leerGuardadas('{'), null);
  assert.equal(leerGuardadas(null), null);
});
