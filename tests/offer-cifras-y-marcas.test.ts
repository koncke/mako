// =============================================================================
// Offer: el tiempo que es un resultado, la marca «[Completar: …]» y las opciones que se suman (16/10/2026)
// =============================================================================
// Tres cosas que salieron de la oferta de verificación tipo Leila (ws 3, conversación 7) y del pedido de Cerebro:
//   · «liberar 10 horas semanales»: un número que la dueña nunca dio pasaba el filtro de cifras porque «horas» es una
//     unidad de PLAZO. Un tiempo que se repite o que se gana es lo que el cliente LOGRA, y se marca como cualquier cifra.
//   · El modelo escribe «[Completar: suma de valores]» con mayúscula y dos puntos, y todo lo que busca la marca es
//     EXACTO: el dato quedaba sin resaltar, fuera de la lista de «datos para completar» y, con «Guardar como oferta»,
//     escrito en `ofertas` como si fuera del negocio.
//   · «¿Vendes otras ofertas además de ésta?» se contesta con varias a la vez, y el chat sólo dejaba tocar una.
// Lo puro se prueba EJECUTÁNDOLO; el prompt y el cableado de la pantalla, leyéndolos.
//
// PROBADO ROMPIÉNDOLO (16/10/2026, arnés romper-tanda3.mjs en el scratchpad de la sesión: rompe UNA cosa, corre este
// archivo y restaura de memoria): base 6/0; las 14 roturas caen, cada una con 1 fallo y 5 pases (la lista, al lado de
// cada test). Las de «semanales» y «liber» NO caían al principio: «liberar 10 horas semanales» pasa por los dos
// caminos a la vez, y cayeron recién con un caso de cada camino solo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  OPCION_ARMAR, filtrarCifras, listaCompletar, mensajeDeMako, normalizarCompletar, ofertaDesdePropuesta, parsePropuesta, parseTurno,
  preguntaPorOtrasOfertas, sanearMensajes,
} from '../lib/offer-reglas';
import { MARCA_COMPLETAR, type PiezasSabidas } from '../lib/offer-marco';
import { esOpcionNinguna, unirOpciones } from '../app/offer/ayudas';

const AT = '2026-10-16T12:00:00.000Z';
const M = MARCA_COMPLETAR;
const leer = (ruta: string): string => readFileSync(join(import.meta.dirname, '..', ruta), 'utf8').replace(/\r\n/g, '\n');
const pieza = (valor: string) => ({ valor, fuente: 'chat' as const, at: AT });
const PIEZAS: PiezasSabidas = {
  cliente: pieza('Comerciantes de 40 a 55 años con negocios chicos en Mérida'),
  problema: pieza('Hacen todo ellos y el negocio se detiene si paran'),
  resultado: pieza('Que dejen de ser indispensables y deleguen tareas'),
  entregables: pieza('Sesiones semanales en grupo y plantillas'),
  precio: pieza('800 MXN al mes'),
  ventas: pieza('Pagaron unas 12 personas'),
  prueba: pieza('sin dato: casos sin métricas'),
};
const propuestaCruda = (over: Record<string, unknown> = {}) => ({
  nombre: 'Dueño Libre', frase: 'Ayudo a dueños de negocios chicos a delegar con el Método Dueño Libre.',
  mensajes: { corto: 'Deja de ser indispensable', largo: 'x', entrada: 'y' },
  paraQuien: { perfil: 'Comerciantes', minimo: 'Tener un negocio andando', noEs: 'Quien recién empieza' },
  problema: { hoy: 'Hacen todo', despues: 'Delegan', obstaculos: ['Poco tiempo'], yaProbo: 'Cursos en línea' },
  mecanismo: { nombres: ['Método Dueño Libre (propuesta)'], pasos: ['Uno', 'Dos', 'Tres'], distinto: 'Se aplica en grupo' },
  ruta: [{ fase: 'Arranque', objetivo: 'La lista de tareas', hito: 'Semana 1' }],
  incluye: [{ nombre: 'Sesiones', beneficio: 'Guía semanal' }],
  formato: 'Grupal, presencial', prueba: 'Alumnos que ya delegan.',
  garantia: { nombre: 'Primera sesión sin cargo', condiciones: 'Asistir', plazo: 'La primera sesión', siNoCumple: 'No paga' },
  bonos: [{ nombre: 'Plantillas', objecion: 'No sé por dónde empezar', valor: 'Ahorra tiempo' }],
  inversion: { valorTotal: 'El valor de todo junto', precio: '800 MXN al mes', contado: '800 MXN', plan: 'Mensual', comoDecirlo: 'Primero el valor.' },
  urgencia: 'Sólo 20 lugares por el tamaño del salón',
  escenarios: { mejor: 'Delega', peor: 'Aprende el método' },
  ecuacion: [], numeros: [], validar: [], siguiente: 'Mentoría 1 a 1',
  ...over,
});

// ── (1) El tiempo que es un resultado ───────────────────────────────────────
// rotura (`esTiempoDeResultado` siempre false: la regla de antes): 1 fallo, 5 pases. rotura (sin «semanales» en
// TIEMPO_QUE_SE_REPITE): 1 fallo, 5 pases. rotura (sin «liber» en SE_GANA_TIEMPO): 1 fallo, 5 pases.
test('«10 horas semanales» es un resultado: se marca; «en 12 semanas» y «sesiones de 2 horas» son plazos y quedan', () => {
  const nada = new Set<string>();
  const f = (t: string, permitidas = nada) => filtrarCifras(t, permitidas, { plazos: true });
  assert.equal(f('Ayudo a dueños a liberar 10 horas semanales en 90 días con 3 pasos.'), `Ayudo a dueños a liberar ${M} horas semanales en 90 días con 3 pasos.`);
  assert.equal(f('Ahorra 2 horas al día.'), `Ahorra ${M} horas al día.`);
  assert.equal(f('Recuperan hasta 8 horas por semana para vender.'), `Recuperan hasta ${M} horas por semana para vender.`);
  assert.equal(f('Ganas 3 días al mes.'), `Ganas ${M} días al mes.`);
  // Cada camino solo: un tiempo que se repite sin verbo de ganar, y uno que se gana sin repetirse.
  assert.equal(f('Con 6 horas semanales para vender.'), `Con ${M} horas semanales para vender.`);
  assert.equal(f('Liberan 10 horas en el primer mes.'), `Liberan ${M} horas en el primer mes.`);
  // Los plazos y el formato no son un resultado.
  assert.equal(f('En 12 semanas, con 4 sesiones de 2 horas.'), 'En 12 semanas, con 4 sesiones de 2 horas.');
  // Si lo dijo el dueño, queda: el filtro marca lo que NO dio, no los tiempos.
  assert.equal(f('Liberan 5 horas por semana.', new Set(['5'])), 'Liberan 5 horas por semana.');
  // Y llega a la propuesta: la frase pasa por el filtro con los plazos.
  const p = parsePropuesta(propuestaCruda({ frase: 'Ayudo a dueños de negocios chicos a liberar 10 horas semanales con el Método Dueño Libre.' }), PIEZAS);
  assert.ok(p);
  assert.equal(p.frase, `Ayudo a dueños de negocios chicos a liberar ${M} horas semanales con el Método Dueño Libre.`);
});

// ── (3) «[Completar: …]» es la marca ────────────────────────────────────────
// rotura (`aObjeto` sin `conMarcaCompletar`): 1 fallo, 5 pases. rotura (la regex sin la `i`): 1 fallo, 5 pases.
test('«[Completar: …]» y «[COMPLETAR]» se leen como la marca: se resaltan, se listan y no se guardan como dato', () => {
  assert.equal(normalizarCompletar('[Completar: suma de valores de cada entregable]'), `${M} suma de valores de cada entregable`);
  assert.equal(normalizarCompletar('El precio es [COMPLETAR].'), `El precio es ${M}.`);
  assert.equal(normalizarCompletar(`${M} cuántos clientes`), `${M} cuántos clientes`);
  const p = parsePropuesta(propuestaCruda({
    prueba: '[Completar: casos con números]',
    inversion: { valorTotal: '[Completar: suma de valores de cada entregable]', precio: '800 MXN al mes', contado: '800 MXN', plan: 'Mensual', comoDecirlo: 'x' },
  }), PIEZAS);
  assert.ok(p);
  assert.equal(p.inversion.valorTotal, `${M} suma de valores de cada entregable`);
  const lista = listaCompletar(p);
  assert.ok(lista.includes('Valor total: suma de valores de cada entregable'), lista.join(' | '));
  assert.ok(lista.includes('Prueba: casos con números'), lista.join(' | '));
  // «Guardar como oferta»: un hueco no se escribe en `ofertas` como si lo hubiera dicho el negocio.
  assert.equal(ofertaDesdePropuesta(p, 'Mi conversación').prueba, null);
});

// ── (2) Las opciones que se suman ───────────────────────────────────────────
const turno = (respuesta: string, opciones: string[], varias = false) =>
  ({ respuesta, opciones, piezas: {}, listo: false, varias, diagnostico: null, diagnosticoRespuesta: null });
const base = { plan: { modo: 'no' as const }, piezas: {}, id: 'm1', at: AT, puedeConcluir: false };
const OTRAS = ['Un taller de marca personal', 'Una mentoría 1 a 1', 'Un curso grabado', 'No, sólo ésta'];

// rotura (parseTurno sin `varias`): 1 fallo, 5 pases. rotura (`mensajeDeMako` sin `preguntaPorOtrasOfertas`): 1 fallo,
// 5 pases. rotura (`preguntaPorOtrasOfertas` mirando toda la respuesta, no sólo la pregunta): 1 fallo, 5 pases.
test('el turno dice cuándo las opciones se suman, y la pregunta de las otras ofertas lo es aunque el modelo se olvide', () => {
  assert.equal(parseTurno(JSON.stringify({ respuesta: '¿Qué más vendes?', opciones: OTRAS, varias: true }))?.varias, true);
  assert.equal(parseTurno(JSON.stringify({ respuesta: '¿Cuánto cobras?', opciones: ['Menos de 500', 'Más de 500'] }))?.varias, false);

  const delModelo = mensajeDeMako({ ...base, turno: turno('¿Por qué canales te llegan los clientes?', ['WhatsApp', 'Instagram', 'Referidos'], true) });
  assert.equal(delModelo.varias, true);
  const olvido = mensajeDeMako({ ...base, turno: turno('Perfecto. ¿Vendes otras ofertas además de ésta, aunque no estén en MaKo?', OTRAS) });
  assert.equal(olvido.varias, true);
  assert.equal(preguntaPorOtrasOfertas('¿Además de la membresía, vendes algo más?'), true);
  // Nombrar otras ofertas fuera de la pregunta no la vuelve de varias.
  assert.equal(preguntaPorOtrasOfertas('Tus otras ofertas las vemos después. ¿Cuánto cobras?'), false);
  const unaSola = mensajeDeMako({ ...base, turno: turno('Tus otras ofertas las vemos después. ¿Cuánto cobras?', ['Menos de 500 MXN', 'Más de 500 MXN']) });
  assert.equal(unaSola.varias, undefined);
  // Con una sola opción no hay nada que sumar; «Armar mi oferta» no cuenta como opción.
  const conArmar = mensajeDeMako({ ...base, puedeConcluir: true, turno: turno('¿Vendes otras ofertas además de ésta?', ['No, sólo ésta'], true) });
  assert.deepEqual(conArmar.opciones, ['No, sólo ésta', OPCION_ARMAR]);
  assert.equal(conArmar.varias, undefined);
});

// rotura (sanearMensajes sin `varias`): 1 fallo, 5 pases — se veía al llegar el turno y se perdía al reabrir la conversación.
test('la marca de varias vuelve de la base, y sólo donde tiene sentido', () => {
  const [m, yo, diag, una] = sanearMensajes([
    { id: 'a', de: 'mako', texto: '¿Qué más vendes?', at: AT, opciones: OTRAS, varias: true },
    { id: 'b', de: 'yo', texto: 'Un curso', at: AT, opciones: ['x', 'y'], varias: true },
    { id: 'c', de: 'mako', texto: '¿Cuánto vendes?', at: AT, opciones: ['1', '2', '3', '4', '5'], varias: true, pregunta: { tipo: 'diagnostico', id: 'ventas' } },
    { id: 'd', de: 'mako', texto: '¿Algo más?', at: AT, opciones: ['No'], varias: true },
  ]);
  assert.equal(m.varias, true);
  assert.equal(yo.varias, undefined);
  assert.equal(diag.varias, undefined, 'una pregunta del diagnóstico tiene UNA respuesta');
  assert.equal(una.varias, undefined);
});

// rotura (unirOpciones con «, » sin la «y»): 1 fallo, 5 pases. rotura (esOpcionNinguna sin «solo esta»): 1 fallo, 5 pases.
test('lo marcado sale como una frase, y «No, sólo ésta» se manda sola', () => {
  assert.equal(unirOpciones(['Un taller de marca personal', 'Una mentoría 1 a 1', 'Un curso grabado']), 'Un taller de marca personal, una mentoría 1 a 1 y un curso grabado');
  assert.equal(unirOpciones(['WhatsApp', 'Instagram']), 'WhatsApp y Instagram');
  assert.equal(unirOpciones(['Talleres', 'Curso de IA']), 'Talleres y Curso de IA');
  assert.equal(unirOpciones(['Sólo una']), 'Sólo una');
  for (const t of ['No, sólo ésta', 'Ninguna', 'Solo esta', 'Nada más', 'Todavía no']) assert.ok(esOpcionNinguna(t), t);
  for (const t of ['Un curso grabado', 'Novedades mensuales', 'Una mentoría']) assert.ok(!esOpcionNinguna(t), t);
});

// rotura (FORMA_TURNO sin "varias"): 1 fallo, 5 pases. rotura (OfferApp sin `onVarias`): 1 fallo, 5 pases. rotura
// (ChatOffer sin `aria-pressed`): 1 fallo, 5 pases.
test('el prompt pide "varias" y la pantalla lo usa: se marcan, se desmarcan y salen juntas', () => {
  const ia = leer('lib/offer-ia.ts');
  assert.match(ia, /const FORMA_TURNO = '\{"respuesta":"","opciones":\[\],"varias":false,/);
  assert.match(ia, /"varias": true sólo cuando el dueño puede elegir MÁS DE UNA a la vez \(qué otras ofertas vende/);
  assert.match(ia, /14\. SIEMPRE, temprano[^\n]*"varias": true y la última «No, sólo ésta»/);
  const chat = leer('app/offer/ChatOffer.tsx');
  assert.match(chat, /const varias = !!onVarias && ultimo\?\.de === 'mako' && ultimo\.varias === true && !ultimo\.pregunta;/);
  assert.match(chat, /if \(!varias \|\| armar \|\| esOpcionNinguna\(t\)\) \{ onOpcion\(idx\); return; \}/);
  assert.match(chat, /'aria-pressed': marcada/);
  assert.match(chat, /onVarias\?\.\(marcadasAhora\)/);
  const app = leer('app/offer/OfferApp.tsx');
  assert.match(app, /onVarias=\{elegirVarias\}/);
  assert.match(app, /const texto = unirOpciones\(idxs\.map/);
});
