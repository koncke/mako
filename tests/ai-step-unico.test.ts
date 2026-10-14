// =============================================================================
// UN AI STEP POR OBJETIVO (undécima tanda, Martín 11/10/2026, puntos 11-13; docs/diseno-undecima-tanda.md §2 y §6)
// =============================================================================
// «Toda la cantidad de tarjetas de "AI Step" deberían ser una sola... Si justamente es el mismo objetivo, solo son
// diferentes objeciones o escenarios». «El "Hasta" siempre es atado al objetivo. Y el "Te avisa cada vez" ya es uno
// de los 3 botones». Lo que se EJECUTA acá (todo puro):
//   · `juntarPasosIA`, la puerta para lo viejo: la forma de #213 (4 tarjetas de un caso en los índices 6, 9, 10 y 11
//     de 12) queda en UNA tarjeta sin cambiar lo que contesta; las sueltas no se tocan; lo distinto va a
//     `conflictos`; las flechas que iban a una tarjeta quitada van a la que queda; es idempotente; el alias
//     `separarPasosIA` de la décima ya no existe (lo borró la ola 4: todos llaman a `juntarPasosIA`);
//   · el modelo: el objetivo del NODO llega a cada escenario, el aviso se DERIVA de la libertad, las libertades
//     permitidas (plata y «Lo demás» nunca «Sola»), lo que frena Publicar, «enseñar un caso» suma ADENTRO, el saneo
//     conserva lo del objetivo, y el tope de UNO por medio en el ＋, el click derecho, duplicar y conectar.
// La fixture de #213 es SINTÉTICA: los ids de producción con textos de prueba (ningún dato de un cliente).
//
// PROBADO ROMPIÉNDOLO: ver `ROTURAS` al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  type PasoGrafo, type CasoRespuesta,
  juntarPasosIA, expandirPasoIA, escenariosDeRespuesta, validarGrafo, validarParaGuardar, normalizar,
  nodoPorId, esPasoIA, idDe, raicesRespuesta, puertosDe, puedeSumarAIStep,
  idRespuestaDeCaso, idAvisoDeCaso, idOtraCosa, AVISO_OTRA_COSA, TOPE_ESCENARIOS_AI_STEP, TOPE_AI_STEP_POR_MEDIO,
} from '../lib/flujo-grafo';
import { libertadDeCaso, libertadesPermitidas, libertadesDeFabrica, avisoDeLibertad, camposDeLibertad, avisaElCaso, conLibertad } from '../lib/ai-step-libertad';
import { camposDelFlujo, agregarCasoAlGrafo } from '../lib/nutricion-grafo-motor';
import { loQueContesta } from '../lib/ai-step-migrar';
import { opcionesDelMas, opcionesSueltas, nodoNuevo, resumenPasoIA, ID_ENTRADA } from '../lib/flujo-conversacion';
import { duplicar, crearSuelta, conectar, MOTIVO } from '../lib/flujo-edicion';
import { ESCENARIOS_TIPICOS, escenarioTipico } from '../lib/ai-step-escenarios';

const rndDe = () => { let k = 0; return () => ((k++ * 7919) % 100_000) / 100_000 + 0.00001; };
const msg = (o: Partial<PasoGrafo> = {}): PasoGrafo => ({ canal: 'whatsapp', proveedor: 'no_oficial', delay_horas: 0, asunto: null, cuerpo: 'hola', template_wa: null, ...o });
const espera = (id: string, minutos: number, siguiente: string | null): PasoGrafo => ({ ...msg({ cuerpo: '' }), id, nodo: 'esperar', espera: { modo: 'tiempo', minutos }, siguiente });
const caso = (id: string, o: Partial<CasoRespuesta> = {}): CasoRespuesta => ({ id, titulo: `Caso ${id}`, cuando: `cuando ${id}`, siguiente: null, ...o });
const tarjeta = (id: string, casos: CasoRespuesta[], o: Partial<PasoGrafo> = {}): PasoGrafo => ({ ...msg({ cuerpo: '' }), id, nodo: 'respuesta', paso_ia: true, casos, si_no: null, ...o });

/**
 * LA FORMA DE #213 DESPUÉS DE LA DÉCIMA (medida el 11/10/2026, sólo lectura): 12 tarjetas, cuatro AI Step de UN caso
 * en los índices 6, 9, 10 y 11 (las tres a quitar, al FINAL). Ids de producción, textos de prueba.
 */
const v213 = (): PasoGrafo[] => [
  espera('nvlvg08', 60, 'n2jl2v4'),
  msg({ id: 'o0', cuerpo: 'Audio de prueba', siguiente: 'nh92v3h' }),
  espera('nh92v3h', 1440, 'o1'),
  msg({ id: 'o1', tipo: 'ia', cuerpo: 'Texto de prueba', siguiente: 'n4z5uil' }),
  espera('n4z5uil', 720, 'ne9jyr0'),
  msg({ id: 'ne9jyr0', cuerpo: '', accion: { operacion: 'avisar_al_equipo', params: { leadId: 'evento', mensaje: 'Aviso de prueba' } }, siguiente: null }),
  tarjeta('nb7dt1y', [caso('na8ll2m', { titulo: 'Confirma', cuando: 'dice que sí', responder: 'Agradece', sola: true })]),
  { ...msg({ cuerpo: '' }), id: 'n2jl2v4', nodo: 'condicion', ramas: [{ id: 'nxrt32o', modo: 'todas', filas: [{ campo: 'ya_contactado' }], siguiente: 'n136j5s' }], si_no: 'o0' },
  msg({ id: 'n136j5s', cuerpo: 'Otro audio de prueba', siguiente: 'nh92v3h' }),
  tarjeta('nyiufgy', [caso('np9324s', { titulo: 'Pregunta el precio', cuando: 'pregunta cuánto cuesta', responder: 'Se ve en la reunión' })]),
  tarjeta('nofi37o', [caso('nqoa5cb', { titulo: 'Pregunta por la reunión', cuando: 'pregunta la hora', responder: 'Contesta lo que sabes' })]),
  tarjeta('njodb7o', [caso('n700b07', { titulo: 'Quiere cambiar el día', cuando: 'no puede ese día', responder: 'Dile que puede reagendar', sola: true })]),
];

/** Un AI Step de la forma de hoy: objetivo en la tarjeta, escenarios adentro. */
const unico = (o: Partial<PasoGrafo> = {}): PasoGrafo[] => [
  msg({ id: 'm1', cuerpo: 'Hola', siguiente: null }),
  tarjeta('A', [
    caso('ca', { titulo: 'Confirma', cuando: 'dice que sí', responder: 'Agradece', sola: true }),
    caso('cb', { titulo: 'Pregunta el precio', cuando: 'pregunta cuánto cuesta', responder: 'En la reunión' }),
    caso('cc', { titulo: 'Puede no calificar', cuando: 'no decide', no_contesta: true }),
  ], { objetivo: 'Que llegue a la reunión', ...o }),
];

// ── (a) La forma de #213 junta en UNA tarjeta y contesta IGUAL ────────────────────────────────

test('(a) #213: cuatro tarjetas de un caso → UNA (nb7dt1y) con los 4 escenarios en orden, nada se corre, y contesta IGUAL', () => {
  const antes = v213();
  const j = juntarPasosIA(antes);
  assert.equal(j.cambio, true);
  assert.deepEqual([j.conflictos, j.perdidos], [[], []]);
  // Las tres quitadas eran las ÚLTIMAS: los 9 de adelante quedan en su índice (ningún `paso_actual` se corre).
  assert.deepEqual(j.pasos.map((p, i) => idDe(p, i)), antes.slice(0, 9).map((p, i) => idDe(p, i)));
  const ia = j.pasos.filter((p) => esPasoIA(p));
  assert.equal(ia.length, 1);
  assert.equal(ia[0].id, 'nb7dt1y');
  assert.deepEqual(ia[0].casos!.map((c) => c.id), ['na8ll2m', 'np9324s', 'nqoa5cb', 'n700b07']);
  // LO QUE CONTESTA: lo mismo (nombre, cuándo, guía, «sale sola», objetivo, ejemplos, voz, «Otra cosa»)…
  assert.equal(loQueContesta(j.pasos), loQueContesta(antes));
  const ea = escenariosDeRespuesta(antes);
  const eb = escenariosDeRespuesta(j.pasos);
  assert.deepEqual(eb.map((e) => [e.casoId, e.titulo, e.cuando, e.comoResponder, e.contestaSolo === true]),
    ea.map((e) => [e.casoId, e.titulo, e.cuando, e.comoResponder, e.contestaSolo === true]));
  // …y cambian SÓLO los ids de la expansión de las tres que se pliegan (ahora cuelgan de nb7dt1y).
  assert.deepEqual(ea.map((e) => e.siguiente), [idRespuestaDeCaso('nb7dt1y', 'na8ll2m'), idRespuestaDeCaso('nyiufgy', 'np9324s'), idRespuestaDeCaso('nofi37o', 'nqoa5cb'), idRespuestaDeCaso('njodb7o', 'n700b07')]);
  assert.deepEqual(eb.map((e) => e.siguiente), ['na8ll2m', 'np9324s', 'nqoa5cb', 'n700b07'].map((c) => idRespuestaDeCaso('nb7dt1y', c)));
  // Con el objetivo puesto se publica (sin él, sólo eso falta).
  assert.deepEqual(validarGrafo(j.pasos), ['falta el objetivo de la tarjeta nb7dt1y']);
  assert.deepEqual(validarGrafo(j.pasos.map((p) => (esPasoIA(p) ? { ...p, objetivo: 'Que llegue confirmada' } : p))), []);
});

// ── (b) Las sueltas no se juntan · (c) un conflicto ─────────────────────────────────────────────

test('(b) una tarjeta SUELTA no se junta ni se toca; (c) dos objetivos distintos: queda el primero y va a `conflictos`', () => {
  const conSuelta = [...v213(), tarjeta('nsuelta', [caso('cs', { titulo: 'Suelta', cuando: 'x', responder: 'y', hasta: 'una' })], { suelta: true })];
  const j = juntarPasosIA(conSuelta);
  const s = nodoPorId(j.pasos, 'nsuelta')!;
  assert.deepEqual(s, conSuelta.at(-1), 'la suelta cambió');
  assert.deepEqual(raicesRespuesta(j.pasos), ['nb7dt1y']);
  // (c) El objetivo de la primera tarjeta gana; el de otro caso, distinto, se dice.
  const dos = v213().map((p) => (p.id === 'nb7dt1y' ? { ...p, objetivo: 'Que confirme' }
    : p.id === 'nofi37o' ? { ...p, casos: [{ ...p.casos![0], objetivo: 'Que sepa la hora' }] } : p));
  const k = juntarPasosIA(dos);
  assert.equal(nodoPorId(k.pasos, 'nb7dt1y')!.objetivo, 'Que confirme');
  assert.deepEqual(k.conflictos, ['el objetivo: «Que confirme» / «Que sepa la hora»']);
  // El escenario ya no guarda su objetivo (es del AI Step).
  assert.ok(nodoPorId(k.pasos, 'nb7dt1y')!.casos!.every((c) => c.objetivo === undefined));
});

// ── (d) El aviso se deriva de la libertad · (e) el objetivo del nodo llega a cada escenario ───────

test('(d) el AVISO al grupo se DERIVA de la libertad: «Para aprobar» y «Sólo te avisa» avisan, «Sola» no (lo guardado en `avisar` no manda)', () => {
  const pasos = unico();
  const g = expandirPasoIA(pasos);
  // Sola: contesta sola, sin aviso.
  assert.equal(nodoPorId(g, idRespuestaDeCaso('A', 'ca'))!.revisar, false);
  assert.equal(nodoPorId(g, idAvisoDeCaso('A', 'ca')), null);
  // Para aprobar: borrador y aviso después.
  assert.equal(nodoPorId(g, idRespuestaDeCaso('A', 'cb'))!.revisar, true);
  assert.equal(nodoPorId(g, idRespuestaDeCaso('A', 'cb'))!.siguiente, idAvisoDeCaso('A', 'cb'));
  // Sólo te avisa: el aviso, sin respuesta.
  assert.equal(nodoPorId(g, idRespuestaDeCaso('A', 'cc')), null);
  assert.ok(nodoPorId(g, idAvisoDeCaso('A', 'cc')));
  // Un `avisar` de antes no cambia nada: «Sola» con avisar=true sigue sin avisar; «Para aprobar» con avisar=false avisa.
  const viejo = unico().map((p) => (p.id === 'A' ? { ...p, casos: [{ ...p.casos![0], avisar: true }, { ...p.casos![1], avisar: false }, p.casos![2]] } : p));
  const gv = expandirPasoIA(viejo);
  assert.equal(nodoPorId(gv, idAvisoDeCaso('A', 'ca')), null);
  assert.ok(nodoPorId(gv, idAvisoDeCaso('A', 'cb')));
  assert.deepEqual([avisaElCaso(viejo[1].casos![0]), avisaElCaso(viejo[1].casos![1]), avisaElCaso(viejo[1].casos![2])], [false, true, true]);
  // Y juntar dice que ese aviso de una «Sola» se va.
  assert.deepEqual(juntarPasosIA(viejo).perdidos, ['«Confirma»: sale sola y ya no te avisa']);
});

test('(e) el OBJETIVO, la voz y los ejemplos del AI Step llegan a CADA escenario; «Hasta» ya no viaja', () => {
  const pasos = unico({ audio: { voz: 'propia' }, ejemplos: [{ lead: '¿cuánto?', tu: 'lo vemos en la reunión' }] })
    .map((p) => (p.id === 'A' ? { ...p, casos: p.casos!.map((c) => ({ ...c, hasta: 'una' as const })) } : p));
  const esc = escenariosDeRespuesta(pasos);
  assert.deepEqual(esc.map((e) => [e.titulo, e.objetivo ?? null, e.audio?.voz ?? null, e.ejemplos?.length ?? 0, e.hasta ?? null]), [
    ['Confirma', 'Que llegue a la reunión', 'propia', 1, null],
    ['Pregunta el precio', 'Que llegue a la reunión', 'propia', 1, null],
    // «Sólo te avisa» no contesta: no hay redactor al que pasarle nada.
    ['Puede no calificar', null, null, 0, null],
  ]);
  // Lo de antes sin juntar (el objetivo en el caso) se sigue leyendo hasta que se guarde.
  const viejo = unico({ objetivo: undefined }).map((p) => (p.id === 'A' ? { ...p, casos: [{ ...p.casos![0], objetivo: 'Del caso' }] } : p));
  assert.equal(escenariosDeRespuesta(viejo)[0].objetivo, 'Del caso');
});

// ── (f) Las libertades permitidas ──────────────────────────────────────────────────────────────

test('(f) libertad: con respuesta, las TRES (también plata y «Lo demás», con su aviso); sin respuesta sólo «Sólo te avisa»; `camposDeLibertad` es la única que escribe', () => {
  // Desde el 14/10/2026 (punto 1 del feedback del 13/10 y «Todas configurables... con un aviso o advertencia»): la
  // persona puede elegir «Sola» con plata y en «Lo demás»; la IA, por su cuenta, no (`libertadesDeFabrica`).
  assert.deepEqual(libertadesPermitidas({ titulo: 'Confirma', cuando: 'dice que sí', responder: 'Agradece' }), ['avisa', 'aprueba', 'sola']);
  assert.deepEqual(libertadesPermitidas({ titulo: 'Pregunta el precio', cuando: 'x', responder: 'y' }), ['avisa', 'aprueba', 'sola']);
  assert.deepEqual(libertadesPermitidas({ titulo: 'Lo demás', cuando: '', responder: 'Contesta', cualquiera: true }), ['avisa', 'aprueba', 'sola']);
  assert.deepEqual(libertadesDeFabrica({ titulo: 'Duda', cuando: 'quiere saber cuánto cuesta', responder: 'y' }), ['avisa', 'aprueba']);
  assert.deepEqual(libertadesDeFabrica({ titulo: 'Lo demás', cuando: '', responder: 'Contesta', cualquiera: true }), ['avisa', 'aprueba']);
  assert.equal(avisoDeLibertad({ titulo: 'Pregunta el precio', cuando: 'x', responder: 'y' }, 'sola'), 'Contesta sola aunque hable de precios.');
  assert.equal(avisoDeLibertad({ titulo: 'Pregunta el precio', cuando: 'x', responder: 'y' }, 'aprueba'), null);
  assert.equal(avisoDeLibertad({ titulo: 'Confirma', cuando: 'x', responder: 'y' }, 'sola'), null);
  assert.deepEqual(libertadesPermitidas({ titulo: 'Sin respuesta', cuando: 'x' }), ['avisa']);
  assert.deepEqual([camposDeLibertad('avisa'), camposDeLibertad('aprueba'), camposDeLibertad('sola')], [{ no_contesta: true }, {}, { sola: true }]);
  const c = conLibertad(caso('x', { responder: 'r', sola: true, avisar: true }), 'avisa');
  assert.deepEqual([c.no_contesta, c.sola, c.avisar, libertadDeCaso(c)], [true, undefined, undefined, 'avisa']);
  // «Sola» con plata, elegida: Publicar la deja y juntar NO la baja (hasta el 14/10 la bajaba a «Para aprobar»).
  const plata = unico().map((p) => (p.id === 'A' ? { ...p, casos: [{ ...p.casos![1], sola: true }] } : p));
  assert.ok(!validarGrafo(plata).some((e) => e.includes('no puede salir sola')), validarGrafo(plata).join(' | '));
  const j = juntarPasosIA(plata);
  assert.equal(libertadDeCaso(nodoPorId(j.pasos, 'A')!.casos![0]), 'sola');
  assert.ok(!j.perdidos.some((x) => x.includes('no puede salir sola')));
});

// ── (g) Lo que frena Publicar ──────────────────────────────────────────────────────────────────

test('(g) Publicar frena sin objetivo, con 11 escenarios, con dos «Lo demás», con dos AI Step del medio y con nombres repetidos', () => {
  assert.deepEqual(validarGrafo(unico()), []);
  assert.deepEqual(validarGrafo(unico({ objetivo: '  ' })), ['falta el objetivo de la tarjeta A']);
  const once = unico({ casos: Array.from({ length: TOPE_ESCENARIOS_AI_STEP + 1 }, (_, k) => caso(`c${k}`, { responder: 'x' })) });
  assert.deepEqual(validarGrafo(once), [`la tarjeta A tiene más de ${TOPE_ESCENARIOS_AI_STEP} escenarios`]);
  // Diez más «Lo demás» sí.
  assert.deepEqual(validarGrafo(unico({ casos: [...once[1].casos!.slice(0, TOPE_ESCENARIOS_AI_STEP), caso('q', { titulo: '', cuando: '', cualquiera: true, responder: 'x' })] })), []);
  const dosLoDemas = unico({ casos: [caso('q1', { cualquiera: true, responder: 'x' }), caso('q2', { cualquiera: true, no_contesta: true })] });
  assert.deepEqual(validarGrafo(dosLoDemas), ['la tarjeta A tiene dos «Lo demás»']);
  const repetidos = unico({ casos: [caso('a', { titulo: 'Precio', responder: 'x' }), caso('b', { titulo: ' precio ', responder: 'y' })] });
  assert.deepEqual(validarGrafo(repetidos), ['en la tarjeta A, «precio» está dos veces']);
  // Dos AI Step del medio: no se publica (tampoco con uno suelto) y no se guarda si los dos escuchan.
  const dos = [...unico(), tarjeta('B', [caso('cx', { responder: 'x' })], { objetivo: 'Otro' })];
  assert.ok(validarGrafo(dos).includes('hay más de un AI Step de WhatsApp'), validarGrafo(dos).join(' | '));
  assert.ok(validarParaGuardar(dos).includes('hay más de un AI Step de WhatsApp'));
  const dosSuelta = dos.map((p) => (p.id === 'B' ? { ...p, suelta: true } : p));
  assert.ok(!validarParaGuardar(dosSuelta).includes('hay más de un AI Step de WhatsApp'), 'uno suelto al lado es un borrador');
  assert.ok(validarGrafo(dosSuelta).includes('hay más de un AI Step de WhatsApp'));
  // Uno por medio sí: el de Instagram no choca con el de WhatsApp.
  assert.equal(TOPE_AI_STEP_POR_MEDIO, 1);
  assert.ok(!validarGrafo([...unico(), tarjeta('I', [caso('ci', { responder: 'x' })], { objetivo: 'IG', medio: 'instagram' })]).includes('hay más de un AI Step de WhatsApp'));
  // Un escenario sin nombre o sin «cuándo»; «Lo demás» no los pide.
  assert.deepEqual(validarGrafo(unico({ casos: [caso('a', { titulo: '', responder: 'x' })] })), ['la tarjeta A tiene un escenario sin nombre']);
  assert.deepEqual(validarGrafo(unico({ casos: [caso('a', { cuando: '', responder: 'x' })] })), ['en la tarjeta A, «Caso a» no dice cuándo']);
});

// ── (h) Enseñar un caso suma ADENTRO ───────────────────────────────────────────────────────────

test('(h) «enseñar un caso» (la API, el hand-off) suma el escenario ADENTRO del AI Step, antes de «Lo demás», con su libertad', () => {
  const base = unico({ casos: [...unico()[1].casos!, caso('q', { titulo: '', cuando: '', cualquiera: true, responder: 'Contesta' })] });
  const r = agregarCasoAlGrafo(base, { titulo: 'Horario', cuando: 'pregunta el horario', comoResponder: 'De 9 a 18', contestaSolo: true }, rndDe());
  assert.ok('pasos' in r, JSON.stringify(r));
  assert.equal(r.pasos.filter((p) => esPasoIA(p)).length, 1, 'creó otra tarjeta');
  const a = nodoPorId(r.pasos, 'A')!;
  assert.deepEqual(a.casos!.map((c) => c.titulo), ['Confirma', 'Pregunta el precio', 'Puede no calificar', 'Horario', '']);
  assert.equal(libertadDeCaso(a.casos![3]), 'sola');
  // Con plata y pidiendo salir sola (lo pidió una persona: la API confirma en pantalla): «Sola», desde el 14/10/2026.
  const p = agregarCasoAlGrafo(base, { titulo: 'Descuento', cuando: 'pide un descuento', comoResponder: 'Lo vemos', contestaSolo: true }, rndDe());
  assert.ok('pasos' in p);
  assert.equal(libertadDeCaso(nodoPorId(p.pasos, 'A')!.casos!.find((c) => c.titulo === 'Descuento')), 'sola');
  // El mismo nombre reescribe el escenario (sin respuesta nueva, sólo el «cuándo»).
  const m = agregarCasoAlGrafo(base, { titulo: 'confirma', cuando: 'otro cuándo', comoResponder: '' }, rndDe());
  assert.ok('pasos' in m);
  assert.deepEqual(nodoPorId(m.pasos, 'A')!.casos![0], { ...base[1].casos![0], cuando: 'otro cuándo' });
  // Al tope, no.
  const lleno = unico({ casos: Array.from({ length: TOPE_ESCENARIOS_AI_STEP }, (_, k) => caso(`c${k}`, { titulo: `E${k}`, responder: 'x' })) });
  assert.deepEqual(agregarCasoAlGrafo(lleno, { titulo: 'Once', cuando: 'x', comoResponder: 'y' }, rndDe()), { error: `el AI Step ya tiene ${TOPE_ESCENARIOS_AI_STEP} escenarios, el máximo` });
});

// ── (i) El alias · (j) idempotencia ─────────────────────────────────────────────────────────────

test('(i) el alias `separarPasosIA` se borró (ola 4): grafoAGuardar y SecuenciaPerfil llaman a `juntarPasosIA`; (j) juntar es idempotente', async () => {
  assert.equal('separarPasosIA' in (await import('../lib/flujo-grafo')), false, 'volvió el alias de la décima');
  for (const pasos of [v213(), unico(), [msg({ id: 'm1', siguiente: null })]]) {
    const j = juntarPasosIA(pasos);
    // (j) Juntar lo juntado no cambia nada.
    const otra = juntarPasosIA(normalizar(j.pasos));
    assert.equal(otra.cambio, false);
    assert.deepEqual(otra.pasos, normalizar(j.pasos));
  }
  // Lo de hoy no cambia (ni un byte).
  assert.equal(juntarPasosIA(unico()).cambio, false);
  // Un «Lo demás» que sólo avisa es el default: se representa SIN el caso (la #198).
  const v198 = [msg({ id: 'o0', siguiente: null }), tarjeta('n1b5m7i', [caso('n0p9e23', { titulo: 'Cualquier respuesta', cuando: '', cualquiera: true, no_contesta: true, avisar: true })])];
  const j198 = juntarPasosIA(v198);
  assert.deepEqual(nodoPorId(j198.pasos, 'n1b5m7i')!.casos, []);
  assert.equal(loQueContesta(j198.pasos), loQueContesta(v198));
  assert.equal(nodoPorId(expandirPasoIA(j198.pasos), 'n1b5m7i')!.si_no, idOtraCosa('n1b5m7i'));
  assert.equal((nodoPorId(expandirPasoIA(j198.pasos), idOtraCosa('n1b5m7i'))!.accion as { params: { mensaje: string } }).params.mensaje, AVISO_OTRA_COSA);
});

// ── (k) El saneo · (l) las flechas ──────────────────────────────────────────────────────────────

test('(k) el saneo (`camposDelFlujo`, la quinta puerta) CONSERVA objetivo, voz y ejemplos del NODO, y los sube del caso si el nodo no los trae', () => {
  const f = camposDelFlujo({
    id: 'A', nodo: 'respuesta', paso_ia: true, si_no: null, objetivo: '  Que agende  ', audio: { voz: 'propia' },
    ejemplos: [{ lead: 'a', tu: 'b' }, { lead: '', tu: 'c' }, 'basura'],
    casos: [{ id: 'c', titulo: 't', cuando: 'w', siguiente: null, responder: 'r', sola: true, avisar: true, hasta: 'una', objetivo: 'otro' }],
  });
  assert.deepEqual([f.objetivo, f.audio, f.ejemplos], ['Que agende', { voz: 'propia' }, [{ lead: 'a', tu: 'b' }]]);
  // El caso ya no guarda lo de antes.
  assert.deepEqual(f.casos![0], { id: 'c', titulo: 't', cuando: 'w', siguiente: null, responder: 'r', sola: true });
  // Sin nada en el nodo, sube lo del caso (no se pierde antes de juntar).
  const g = camposDelFlujo({ id: 'A', nodo: 'respuesta', paso_ia: true, casos: [{ id: 'c', titulo: 't', cuando: 'w', objetivo: 'Del caso', audio: { voz: 'abcdefgh12' }, ejemplos: [{ lead: 'x', tu: 'y' }] }] });
  assert.deepEqual([g.objetivo, g.audio, g.ejemplos], ['Del caso', { voz: 'abcdefgh12' }, [{ lead: 'x', tu: 'y' }]]);
  // Fuera de un AI Step no significan nada.
  assert.equal(camposDelFlujo({ id: 'R', nodo: 'respuesta', objetivo: 'x', casos: [] }).objetivo, undefined);
});

test('(l) toda flecha que iba a una tarjeta QUITADA va a la que queda: ninguna queda colgando', () => {
  // A un AI Step no le llega ninguna flecha (Publicar lo frena), pero un dato roto de la API no puede quedar
  // apuntando a una tarjeta que ya no está: una rama, una flecha en paralelo, un «Ir a».
  const roto = v213().map((p) => (p.id === 'n2jl2v4' ? { ...p, ramas: [{ ...p.ramas![0], paralelos: ['nofi37o'] }] } : p))
    .concat([{ ...msg({ cuerpo: '' }), id: 'nirA', nodo: 'ir_a', destino: { nodo: 'njodb7o' } }]);
  const j = juntarPasosIA(roto);
  const quitadas = new Set(['nyiufgy', 'nofi37o', 'njodb7o']);
  for (let i = 0; i < j.pasos.length; i++) for (const pt of puertosDe(j.pasos, i)) assert.ok(!pt.destino || !quitadas.has(pt.destino), `${idDe(j.pasos[i], i)} sigue en ${pt.destino}`);
  assert.deepEqual(nodoPorId(j.pasos, 'n2jl2v4')!.ramas![0].paralelos, ['nb7dt1y']);
  assert.deepEqual(nodoPorId(j.pasos, 'nirA')!.destino, { nodo: 'nb7dt1y' });
  assert.ok(!validarParaGuardar(j.pasos).some((e) => e.includes('que no existe')), validarParaGuardar(j.pasos).join(' | '));
  assert.deepEqual(j.perdidos, []);
});

// ── El tope de UNO por medio, en todas las puertas ────────────────────────────────────────────

test('UNO por medio: el ＋ y el click derecho no lo ofrecen, crear/duplicar no, conectar uno suelto al lado de otro tampoco; nace sin escenarios', () => {
  assert.equal(puedeSumarAIStep(unico()), false);
  assert.equal(puedeSumarAIStep(unico(), 'instagram'), true);
  assert.ok(!opcionesDelMas(unico(), 'm1', false).some((o) => o.value === 'ai_step'));
  assert.ok(!opcionesSueltas(unico()).some((o) => o.value === 'ai_step'));
  assert.ok(opcionesSueltas([msg({ id: 'm1', siguiente: null })]).some((o) => o.value === 'ai_step'));
  assert.equal(crearSuelta(unico(), 'ai_step').id, '');
  const d = duplicar(unico(), 'A', rndDe());
  assert.deepEqual([d.ok, !d.ok && d.motivo], [false, MOTIVO.topeAIStep]);
  const conSuelta = [...unico(), tarjeta('B', [caso('cx', { responder: 'x' })], { suelta: true, objetivo: 'Otro' })];
  const c = conectar(conSuelta, ID_ENTRADA, 'sig', 'B');
  assert.deepEqual([c.ok, !c.ok && c.motivo], [false, MOTIVO.topeAIStep]);
  // Sola, sí se vuelve a conectar.
  assert.equal(conectar(conSuelta.filter((p) => p.id !== 'A'), ID_ENTRADA, 'sig', 'B').ok, true);
  // Nace sin escenarios y sin objetivo (lo primero es el objetivo: la tarjeta lo pide en rojo).
  const n = nodoNuevo('ai_step', [], rndDe());
  assert.deepEqual([n.paso_ia, n.casos, n.objetivo], [true, [], undefined]);
  const r = resumenPasoIA(n);
  assert.deepEqual([r.objetivo, r.escenarios, r.loDemas, r.falta], [null, [], 'avisa', true]);
  assert.deepEqual(resumenPasoIA(unico()[1]).conteo, { avisa: 1, aprueba: 1, sola: 1 });
});

test('el catálogo de escenarios: claves únicas, la libertad que el escenario PUEDE tener, y como caso pasa Publicar', () => {
  const ids = ESCENARIOS_TIPICOS.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const e of ESCENARIOS_TIPICOS) {
    const c = escenarioTipico(e.id, `c_${e.id}`);
    assert.equal(libertadDeCaso(c), e.libertad, e.id);
    assert.ok(libertadesPermitidas(c).includes(e.libertad), `${e.id}: «${e.libertad}» no permitida`);
  }
  assert.throws(() => escenarioTipico('no-existe', 'x'));
  const casos = ESCENARIOS_TIPICOS.filter((e) => e.id !== 'precio-reunion').slice(0, TOPE_ESCENARIOS_AI_STEP).map((e) => escenarioTipico(e.id, `c_${e.id.replace(/-/g, '_')}`));
  assert.deepEqual(validarGrafo(unico({ casos })), []);
});

// ── ROTURAS (11/10/2026) ─────────────────────────────────────────────────────────────────────────
// Cada una sola, con un arnés que guarda el fuente en memoria, lo rompe, corre ESTE archivo y lo reescribe byte a byte
// (scratchpad wf-undecima/w1-aistep-modelo/roturas.cjs; nunca `git checkout`). Base: 12 pass / 0 fail; al final, igual.
// «pass / fail» de este archivo con cada rotura:
//   R1 `datosDeCaso` sin el objetivo del NODO (sólo el del caso)                     → 11 / 1  [(e)]
//   R2 juntar DEJA las tarjetas juntadas en el array (no las saca)                     →  9 / 3  [(a), (b)/(c), (i)/(j)]
//   R3 `libertadesPermitidas` deja «Sola» con plata                                    → 10 / 2  [(f), (h)]
//   R4 la expansión LEE `avisar` en vez de derivarlo de la libertad                    → 11 / 1  [(d)]
//   R5 juntar SIN re-apuntar las flechas a la tarjeta que queda                        → 11 / 1  [(l)]
