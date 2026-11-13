// =============================================================================
// SEGUIR CON LOS QUE CONTESTAN UNA DIFUSIÓN (13/11/2026, Leila, ws11)
// =============================================================================
// Leila mandó «Hola corazón, ¿cómo estás?» a 143 alumnas (la difusión #732) y armó APARTE la automatización para seguir con las
// que contestaran (la #730): CRON «está en la etapa» de esa columna y, como primera tarjeta, «Contestó + producto + etapa» → el
// pedido de testimonio. A las 21:00 del 9/11 el CRON inscribió a las 143 de golpe y la condición se decidió en ese instante,
// cuando nadie había contestado: 143 envíos «omitido — la condición cerró el flujo sin mandar nada». «Contestó» es de ESA
// automatización: no ve lo que le contestaron a la difusión. Leila contestó todo a mano. Lo que se fija:
//   1. la forma de la #730 no se puede publicar (`contestoAntesDeEscribir`); ninguna plantilla cae (medido: en producción, sólo ella);
//   2. la difusión CON el seguimiento: el mensaje → escuchar N días → «Contestó» → los mensajes; quien contesta va a la rama en el
//      momento (`destinoAlContestar`) y sólo esos mensajes le salen (`ramaDeQuienContesto`); sólo por WhatsApp (sin hilos);
//   3. pedirlo de nuevo reemplaza, no apila; los límites; la clave del pedido;
//   4. el cableado: la difusión nueva (`difundir_a_leads` con siContesta) y la que ya está saliendo (`seguir_con_los_que_contestan`).
//
// PROBADO ROMPIÉNDOLO: ver el pie. Correr: node --import tsx --test tests/difusion-si-contesta.test.ts
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contestoAntesDeEscribir, validarGrafo, raicesSalida, indicePorId, type PasoGrafo } from '../lib/flujo-grafo';
import { usaContesto, destinoAlContestar, ramaDeQuienContesto } from '../lib/nutricion-grafo-motor';
import {
  pasosDeDifusion, conSiContesta, siContestaDe, problemaDeSiContesta, siContestaDeLosPasos, claveDeDifusion,
  DIAS_ESCUCHA_DIFUSION, ID_ESCUCHA_DIFUSION, ID_CONTESTO_DIFUSION,
} from '../lib/difusion-reglas';
import { PLANTILLAS } from '../lib/plantillas-automatizaciones';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const tramo = (src: string, desde: string, hasta: string) => { const i = src.indexOf(desde); assert.ok(i >= 0, `no está «${desde}»`); const j = src.indexOf(hasta, i + desde.length); assert.ok(j > i, `no está el cierre «${hasta}»`); return src.slice(i, j); };

// La #730 de Leila, tal cual está publicada (sin los textos largos).
const LA_730 = [
  { id: 'n35x918', nodo: 'condicion', canal: 'whatsapp', orden: 1, cuerpo: '', si_no: null,
    ramas: [{ id: 'nzwp13b', modo: 'todas', filas: [{ campo: 'contesto' }, { campo: 'en_producto', union: 'y', valor: '49' }, { campo: 'etapa', union: 'y', valor: 'agenda', funnel_id: 49 }], siguiente: 'nd060d6' }] },
  { id: 'nd060d6', canal: 'whatsapp', orden: 2, cuerpo: 'Qué gusto leerte corazón! … ¿cuál sería?', proveedor: 'no_oficial', siguiente: null },
  { id: 'entrada', nodo: 'inicio', canal: 'whatsapp', orden: 3, cuerpo: '', siguiente: 'n35x918' },
] as unknown as PasoGrafo[];

const HOLA = { whatsapp: { cuerpo: 'Hola corazón. ¿Cómo estás?', variantes: ['Corazon, tanto tiempo ¿Cómo estás?'] } };
const SEGUIR = { mensajes: ['Qué gusto leerte corazón! ¿Le pones una nota a la certificación?', 'Oye, ya que te tengo aquí: ¿vas a seguir en LíderMente?'], dias: 7 };

test('1. la forma de la #730 no se puede publicar: «Contestó» antes de escribirle nada no se cumple nunca', () => {
  assert.deepEqual(contestoAntesDeEscribir(LA_730), ['n35x918']);
  const err = validarGrafo(LA_730);
  assert.ok(err.some((e) => e.startsWith('la condición n35x918 pregunta «Contestó» antes de escribirle nada')), JSON.stringify(err));
  // Detrás de un mensaje y una espera, sí (la forma de las plantillas): ahí ya pudo contestar.
  const bien = [
    { id: 'entrada', nodo: 'inicio', canal: 'whatsapp', cuerpo: '', siguiente: 'm1' },
    { id: 'm1', canal: 'whatsapp', cuerpo: 'Hola', siguiente: 'e1' },
    { id: 'e1', nodo: 'esperar', canal: 'whatsapp', cuerpo: '', espera: { modo: 'tiempo', minutos: 1440 }, siguiente: 'c1' },
    { id: 'c1', nodo: 'condicion', canal: 'whatsapp', cuerpo: '', si_no: null, ramas: [{ id: 'r', modo: 'todas', filas: [{ campo: 'contesto' }], siguiente: 'm2' }] },
    { id: 'm2', canal: 'whatsapp', cuerpo: 'Qué bueno', siguiente: null },
  ] as unknown as PasoGrafo[];
  assert.deepEqual(contestoAntesDeEscribir(bien), []);
  // «No contestó» al entrar siempre se cumple: no se marca. Y detrás de otra condición o de una acción, sigue siendo «al entrar».
  const noContesto = LA_730.map((p) => (p.id === 'n35x918' ? { ...p, ramas: [{ id: 'r', modo: 'todas', filas: [{ campo: 'contesto', no: true }], siguiente: 'nd060d6' }] } : p)) as PasoGrafo[];
  assert.deepEqual(contestoAntesDeEscribir(noContesto), []);
  const detrasDeOtra = [
    { id: 'entrada', nodo: 'inicio', canal: 'whatsapp', cuerpo: '', siguiente: 'c0' },
    { id: 'c0', nodo: 'condicion', canal: 'whatsapp', cuerpo: '', si_no: null, ramas: [{ id: 'r0', modo: 'todas', filas: [{ campo: 'tiene_telefono' }], siguiente: 'a1' }] },
    { id: 'a1', canal: 'whatsapp', cuerpo: '', accion: { operacion: 'poner_etiqueta_lead', params: {} }, siguiente: 'c1' },
    { id: 'c1', nodo: 'condicion', canal: 'whatsapp', cuerpo: '', si_no: null, ramas: [{ id: 'r1', modo: 'todas', filas: [{ campo: 'contesto' }], siguiente: 'm' }] },
    { id: 'm', canal: 'whatsapp', cuerpo: 'x', siguiente: null },
  ] as unknown as PasoGrafo[];
  assert.deepEqual(contestoAntesDeEscribir(detrasDeOtra), ['c1']);
  // Ninguna plantilla de la galería cae (en producción, medido el 13/11: sólo la #730 de las 87 sin archivar).
  for (const p of PLANTILLAS) assert.deepEqual(contestoAntesDeEscribir(p.pasos as unknown as PasoGrafo[]), [], p.id);
});

test('2. la difusión con el seguimiento: quien contesta va a la rama en el momento, y sólo eso le sale', () => {
  const pasos = pasosDeDifusion(['whatsapp'], HOLA, SEGUIR);
  assert.deepEqual(validarGrafo(pasos), [], 'el lienzo no la deja publicar');
  const n = (id: string) => pasos[indicePorId(pasos, id)] as unknown as Record<string, unknown>;
  assert.equal(n('d_whatsapp').siguiente, ID_ESCUCHA_DIFUSION);
  assert.deepEqual([n(ID_ESCUCHA_DIFUSION).nodo, (n(ID_ESCUCHA_DIFUSION).espera as { minutos: number }).minutos, n(ID_ESCUCHA_DIFUSION).siguiente], ['esperar', 7 * 1440, ID_CONTESTO_DIFUSION]);
  assert.deepEqual(n(ID_CONTESTO_DIFUSION).ramas, [{ id: `${ID_CONTESTO_DIFUSION}_si`, modo: 'todas', filas: [{ campo: 'contesto' }], siguiente: 'd_sc_1' }]);
  assert.equal(n(ID_CONTESTO_DIFUSION).si_no, null, 'a quien no contesta le salía algo');
  assert.deepEqual([n('d_sc_1').cuerpo, n('d_sc_1').siguiente, n('d_sc_2').cuerpo, n('d_sc_2').siguiente], [SEGUIR.mensajes[0], 'd_sc_2', SEGUIR.mensajes[1], null]);
  assert.deepEqual([n('d_sc_1').revisar, n('d_sc_1').proveedor], [false, 'no_oficial'], 'el seguimiento queda para aprobar o sale por el oficial');
  assert.deepEqual((n('d_whatsapp').variantes as string[]), HOLA.whatsapp.variantes, 'se perdieron las variantes del mensaje');
  // El motor: usa «Contestó» (una respuesta lo saca y corre la rama), y desde el mensaje o la espera, la rama es el seguimiento.
  assert.equal(usaContesto(pasos), true);
  assert.equal(destinoAlContestar(pasos, indicePorId(pasos, ID_ESCUCHA_DIFUSION)), 'd_sc_1', 'contestó mientras se lo escucha');
  assert.equal(destinoAlContestar(pasos, indicePorId(pasos, ID_CONTESTO_DIFUSION)), 'd_sc_1');
  const rama = ramaDeQuienContesto(pasos);
  assert.ok(rama.has('d_sc_1') && rama.has('d_sc_2'), 'el seguimiento no le sale a quien contestó');
  assert.ok(!rama.has('d_whatsapp'), 'el mensaje de la difusión le volvería a salir a quien contestó');
  assert.deepEqual(contestoAntesDeEscribir(pasos), []);
  // UN hilo: `alContestar` no mueve una fila con hilos en paralelo (con varios canales, el seguimiento no saldría nunca).
  assert.equal(raicesSalida(pasos).length, 1);
  assert.ok(raicesSalida(pasosDeDifusion(['whatsapp', 'email'], { ...HOLA, email: { asunto: 'a', cuerpo: 'b' } })).length > 1);
  // Sin seguimiento, la difusión de siempre.
  assert.equal(indicePorId(pasosDeDifusion(['whatsapp'], HOLA), ID_ESCUCHA_DIFUSION), -1);
  assert.equal((pasosDeDifusion(['whatsapp'], HOLA)[indicePorId(pasosDeDifusion(['whatsapp'], HOLA), 'd_whatsapp')] as { siguiente?: unknown }).siguiente, null);
});

test('3. pedirlo de nuevo reemplaza; los límites; lo que pidió, saneado; la clave del pedido', () => {
  const una = pasosDeDifusion(['whatsapp'], HOLA, SEGUIR);
  const otra = conSiContesta(una, { mensajes: ['Sólo esto'], dias: 3 });
  assert.equal(otra.filter((p) => p.id === ID_ESCUCHA_DIFUSION).length, 1, 'apiló otra espera');
  assert.equal(indicePorId(otra, 'd_sc_2'), -1, 'quedó el segundo mensaje del seguimiento viejo');
  assert.deepEqual(siContestaDeLosPasos(otra), { mensajes: ['Sólo esto'], dias: 3 });
  assert.deepEqual(siContestaDeLosPasos(una), SEGUIR);
  assert.equal(siContestaDeLosPasos(pasosDeDifusion(['whatsapp'], HOLA)), null);
  assert.deepEqual(validarGrafo(otra), []);

  assert.equal(problemaDeSiContesta(['whatsapp'], SEGUIR), null);
  assert.equal(problemaDeSiContesta(['whatsapp'], null), null);
  assert.match(problemaDeSiContesta(['whatsapp', 'email'], SEGUIR)!, /sólo por WhatsApp/);
  assert.match(problemaDeSiContesta(['email'], SEGUIR)!, /sólo por WhatsApp/);
  assert.match(problemaDeSiContesta(['whatsapp'], { mensajes: ['1', '2', '3', '4', '5', '6'], dias: 7 })!, /hasta 5 mensajes/);
  for (const dias of [0, 31, 2.5, Number.NaN]) assert.match(problemaDeSiContesta(['whatsapp'], { mensajes: ['x'], dias })!, /de 1 a 30 días/, String(dias));

  assert.equal(siContestaDe([]), null);
  assert.equal(siContestaDe(['  ', '']), null);
  assert.equal(siContestaDe(undefined), null);
  assert.deepEqual(siContestaDe([' Hola ', '', 'Chau']), { mensajes: ['Hola', 'Chau'], dias: DIAS_ESCUCHA_DIFUSION });
  assert.deepEqual(siContestaDe(['Hola'], 3), { mensajes: ['Hola'], dias: 3 });

  const pedido = { seleccion: { leadIds: [3, 1] }, canales: ['whatsapp'] as const, mensajes: HOLA, goteo: { minutos: 3, dia: 40 } };
  assert.equal(claveDeDifusion({ ...pedido, canales: [...pedido.canales] }), claveDeDifusion({ ...pedido, canales: [...pedido.canales], siContesta: null }), 'sin seguimiento, la clave de siempre (las marcas de antes valen)');
  assert.notEqual(claveDeDifusion({ ...pedido, canales: [...pedido.canales] }), claveDeDifusion({ ...pedido, canales: [...pedido.canales], siContesta: SEGUIR }), 'con seguimiento retomaría la difusión que no lo tiene');
});

test('4. el cableado: la difusión nueva lo lleva, la que ya sale se lo agrega, y MaKo lo ofrece', () => {
  const dif = leer('lib/difusion.ts');
  const crear = tramo(dif, 'export async function crearDifusion(', 'export type ResultadoSiContesta');
  assert.match(crear, /problemaDeSiContesta\(canales, p\.siContesta \?\? null\)/);
  assert.match(crear, /claveDeDifusion\(\{ seleccion: p\.seleccion, canales, mensajes: p\.mensajes, goteo, siContesta: p\.siContesta \?\? null \}\)/);
  assert.match(crear, /pasosDeDifusion\(canales, p\.mensajes, p\.siContesta \?\? null\)/);
  const seguir = tramo(dif, 'export async function seguirConLosQueContestan(', 'export async function pausarDifusionesTerminadas(');
  assert.match(seguir, /startsWith\(PREFIJO_CLAVE_DIFUSION\)/, 'se lo agrega a una automatización que no es una difusión');
  assert.match(seguir, /problemaDeSiContesta\(canales, sc\)/);
  assert.match(seguir, /if \(!o\.soloVer\) \{[\s\S]*setSecuenciaPasos\(sec\.id, conSiContesta\(pasos, sc\)/, 'escribe sin pasar por la puerta de siempre, o escribe al proponer');
  assert.match(dif, /const NODOS_QUE_LO_VAN = new Set\(\[null, 'entrada', 'd_c_whatsapp', 'd_whatsapp', 'd_escucha'\]\);/);

  const def = leer('lib/api-mako/areas/chatbot.def.ts');
  const difundir = tramo(def, "id: 'difundir_a_leads'", "canales: ['app']");
  assert.match(difundir, /nombre: 'siContesta', tipo: 'string\[\]'/);
  assert.match(difundir, /NO armes otra automatización para eso/);
  assert.match(difundir, /nombre: 'escucharDias'/);
  const nueva = tramo(def, "id: 'seguir_con_los_que_contestan'", '},\n  // «Volver a probar»');
  assert.match(nueva, /aTerceros: true/);
  assert.match(nueva, /confirmacion: 'chat'/);
  assert.match(nueva, /canales: \['app'\]/, 'le escribe a muchos: sólo en la app, como la difusión');
  assert.match(nueva, /rolMinimo: 'admin'/);

  const run = leer('lib/api-mako/areas/chatbot.run.ts');
  assert.match(run, /siContesta: siContestaDe\(input\.siContesta, input\.escucharDias\)/);
  assert.match(tramo(run, '  difundir_a_leads: {', '  seguir_con_los_que_contestan: {'), /crearDifusion\(ctx\.ws, \{[^}]*siContesta: pedido\.siContesta/);
  const r = tramo(run, '  seguir_con_los_que_contestan: {', '  volver_a_probar_lead_secuencia: {');
  assert.match(r, /seguirConLosQueContestan\(secuenciaId, sc, \{ soloVer: true \}\)/, 'la propuesta escribe');
  assert.match(r, /seguirConLosQueContestan\(num\(payload, 'secuenciaId'\), sc\)/);
});

// ── Probado rompiéndolo (13/11/2026; cada rotura sola, restaurada después) ──────────────────────────────────────────────
//   L1 `contestoAntesDeEscribir` mira sólo la primera tarjeta (no sigue condiciones ni acciones)     → falla el 1
//   L2 la guarda cuenta también «No contestó»                                                       → falla el 1
//   L3 Publicar no la frena (sin el error en `erroresDeForma`)                                      → falla el 1
//   L4 el seguimiento sin la espera (el «Contestó» pegado al mensaje)                               → fallan el 2 y el 3
//   L5 el seguimiento con «si no» (a quien no contesta le sale algo)                                → falla el 2
//   L6 `conSiContesta` sin sacar el seguimiento viejo                                               → falla el 3
//   L7 se permite con varios canales                                                                → falla el 3
//   L8 la clave del pedido sin el seguimiento                                                       → falla el 3
//   L9 `difundir_a_leads` no le pasa el seguimiento a `crearDifusion`                               → falla el 4
//   L10 la propuesta de la difusión que ya sale escribe (sin `soloVer`)                             → falla el 4
