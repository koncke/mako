// =============================================================================
// El ENSAYO de un AI Step, del AI Step ENTERO (undécima tanda, w2-aistep-editor)
// =============================================================================
// Martín (11/10/2026, punto 11): «Toda la cantidad de tarjetas de "AI Step" deberían ser una sola... Si justamente es
// el mismo objetivo, solo son diferentes objeciones o escenarios». El ensayo deja de ser de UN caso: las objeciones
// salen del OBJETIVO y de TODOS los escenarios, «Responde MaKo» contesta como el motor y como «Probar» (clasifica
// contra los escenarios del lienzo; si no encaja, «Lo demás»), y «Guardar respuestas» escribe los `ejemplos` del NODO.
// El diseño, en docs/diseno-undecima-tanda.md §6 y lib/ai-step-ensayo.ts.
//
// Lo que se EJECUTA acá (todo puro): el pedido de objeciones, el escenario del lead, los ejemplos de la charla (sin las
// líneas del sistema), lo que escribe «Guardar respuestas» (`cambioDelEnsayo`: el nodo, nunca un escenario), los
// escenarios del clasificador (los mismos que arma «Probar») y con qué contesta MaKo lo que se eligió
// (`respuestaDelEnsayo`, comparado con el recorrido de «Probar»: lib/simulador-grafo.ts). La ruta y el modal son
// `server-only` / React: su cableado se fija leyendo el fuente sin comentarios.
//
// PROBADO ROMPIÉNDOLO: ver `ROTURAS` al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  pedidoDeObjeciones, escenarioDeAIStep, ejemplosDeCharla, cambioDelEnsayo, casosDelClasificador,
  respuestaDelEnsayo, OBJECIONES_SYSTEM_TEMPLATE,
} from '../lib/ai-step-ensayo';
import { GUIA_LO_DEMAS } from '../lib/ai-step-armar';
import { type PasoGrafo, type CasoRespuesta, normalizar, escenariosDeRespuesta, TOPE_EJEMPLOS, ROTULO_LO_DEMAS } from '../lib/flujo-grafo';
import { iniciar, pausarPorRespuesta, entrarEnRespuesta, siguiente, escenarioParaRedactar } from '../lib/simulador-grafo';
import { bloqueEscenario as bloqueLead } from '../lib/chat-agent-escenarios';
import { marcasDeVoseo } from '../lib/puestas-data';

const RAIZ = join(import.meta.dirname, '..');
const leer = (p: string): string => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const msg = (o: Partial<PasoGrafo> = {}): PasoGrafo => ({ canal: 'whatsapp', proveedor: 'no_oficial', delay_horas: 0, asunto: null, cuerpo: 'hola', template_wa: null, ...o });
const caso = (id: string, o: Partial<CasoRespuesta> = {}): CasoRespuesta => ({ id, titulo: `Caso ${id}`, cuando: `cuando ${id}`, siguiente: null, ...o });
/** Un AI Step de hoy: objetivo, ejemplos y voz en la tarjeta; A «Para aprobar», B «Sola», C «Sólo te avisa». */
const conIA = (o: Partial<PasoGrafo> = {}): PasoGrafo[] => normalizar([
  msg({ id: 'm1', cuerpo: 'Hola', siguiente: null }),
  {
    ...msg({ cuerpo: '' }), id: 'R', nodo: 'respuesta', paso_ia: true, si_no: null,
    objetivo: 'Que llegue a su reunión', ejemplos: [{ lead: 'cuánto?', tu: 'en la reunión' }],
    casos: [
      caso('A', { titulo: 'Pregunta el precio', cuando: 'pregunta cuánto cuesta', responder: 'Dile que se ve en la reunión' }),
      caso('B', { titulo: 'Confirma', cuando: 'dice que sí', responder: 'Agradece', sola: true }),
      caso('C', { titulo: 'Se queja', cuando: 'está molesto', no_contesta: true }),
    ],
    ...o,
  },
]);
const AI = { objetivo: 'Que llegue a su reunión', escenarios: [{ titulo: 'Pregunta el precio', cuando: 'pregunta cuánto cuesta' }, { titulo: 'Confirma', cuando: 'dice que sí' }] };

test('las objeciones salen del OBJETIVO y de TODOS los escenarios del AI Step (no de un caso)', () => {
  const p = pedidoDeObjeciones({ ...AI, perfil: 'Una academia' });
  assert.match(p, /LO QUE EL NEGOCIO QUIERE LOGRAR: Que llegue a su reunión/);
  assert.match(p, /LOS ESCENARIOS:\n- «Pregunta el precio»: pregunta cuánto cuesta\n- «Confirma»: dice que sí/);
  assert.match(p, /<negocio>Una academia<\/negocio>/);
  assert.doesNotMatch(p, /EL CASO/);
  assert.match(OBJECIONES_SYSTEM_TEMPLATE, /\{"primer":"…","objeciones":\["…","…","…","…"\]\}/);
  assert.match(OBJECIONES_SYSTEM_TEMPLATE, /repartidos entre los escenarios/);
  assert.deepEqual(marcasDeVoseo(OBJECIONES_SYSTEM_TEMPLATE), []);
});

test('el lead del ensayo: su objetivo es el del AI Step, le pasa algo de sus escenarios, y una objeción por turno', () => {
  const ob = { primer: 'cuánto sale?', objeciones: ['Es caro', 'No tiene tiempo', 'Duda del resultado'] };
  const e = escenarioDeAIStep(AI, ob, 'whatsapp');
  assert.equal(e.objetivo, 'Que llegue a su reunión');
  assert.equal(e.quePasa, 'Le escribe por algo de esto: Pregunta el precio, Confirma.');
  assert.equal(e.evolucion.length, ob.objeciones.length + 2);
  assert.match(bloqueLead(e, 0, ''), /cuánto sale\?/);
  assert.doesNotMatch(bloqueLead(e, 0, ''), /nota de voz/);
  // El alias de un caso (`escenarioDeCaso`) se borró en el cierre de la undécima: el ensayo es del AI Step entero.
});

test('«Guardar respuestas» escribe los `ejemplos` del NODO (el AI Step), nunca de un escenario; los últimos 6', () => {
  const paso = conIA()[1];
  const cambio = cambioDelEnsayo(paso, [{ lead: 'ok', tu: 'genial' }]);
  assert.deepEqual(Object.keys(cambio), ['ejemplos'], 'el cambio toca algo más que los ejemplos del AI Step');
  assert.deepEqual(cambio.ejemplos, [{ lead: 'cuánto?', tu: 'en la reunión' }, { lead: 'ok', tu: 'genial' }]);
  const muchos = Array.from({ length: 9 }, (_, i) => ({ lead: `l${i}`, tu: `t${i}` }));
  assert.deepEqual(cambioDelEnsayo({}, muchos).ejemplos, muchos.slice(-TOPE_EJEMPLOS));
  // El editor lo sube por `cambiar` (la edición del flujo: borrador → Publicar).
  const editor = sinComentarios(leer('app/automations/EditorPasoIA.tsx'));
  assert.match(editor, /const guardarEnsayo = \(nuevos: EjemploCaso\[\]\) => \{\n\s+cambiar\(cambioDelEnsayo\(paso, nuevos\), true\);/);
  assert.doesNotMatch(editor, /ejemplos: \[\.\.\.\(c\.ejemplos/, 'escribe los ejemplos en un escenario');
});

test('los ejemplos de la charla: lead → tu respuesta (ni las de MaKo ni las líneas del sistema cuentan)', () => {
  assert.deepEqual(ejemplosDeCharla([
    { de: 'lead', texto: 'cuánto?' }, { de: 'sistema', texto: '«Pregunta el precio»' }, { de: 'tu', texto: 'en la reunión' },
    { de: 'lead', texto: 'ok' }, { de: 'mako', texto: 'genial' },
  ]), [{ lead: 'cuánto?', tu: 'en la reunión' }]);
});

test('«Responde MaKo» clasifica contra los MISMOS escenarios que «Probar» (el flujo expandido del medio)', () => {
  const { casos, escenarios } = casosDelClasificador(conIA(), 'whatsapp');
  assert.deepEqual(casos.map((c) => c.casoId), escenariosDeRespuesta(conIA()).map((c) => c.casoId));
  assert.deepEqual(escenarios.map((e) => [e.titulo, e.contestaSolo === true]), [['Pregunta el precio', false], ['Confirma', true], ['Se queja', false]]);
  assert.deepEqual(escenarios.map((e) => e.comoResponder), escenariosDeRespuesta(conIA()).map((c) => c.comoResponder));
});

test('con qué contesta MaKo: el escenario elegido como en «Probar» (con el objetivo y los ejemplos del AI Step); el que sólo avisa no contesta', () => {
  const pasos = conIA();
  const a = respuestaDelEnsayo(pasos, 'whatsapp', 'A');
  assert.equal(a.titulo, 'Pregunta el precio');
  assert.equal(a.escenario?.comoResponder, 'Dile que se ve en la reunión');
  assert.equal(a.escenario?.contestaSolo, undefined);
  assert.equal(a.escenario?.objetivo, 'Que llegue a su reunión');
  assert.deepEqual(a.escenario?.ejemplos, [{ lead: 'cuánto?', tu: 'en la reunión' }]);
  // Lo MISMO que redacta «Probar» al entrar por ese caso (lib/simulador-grafo.ts).
  const r1 = siguiente(pasos, entrarEnRespuesta(pasos, pausarPorRespuesta(iniciar(pasos)).estado, 'A').estado);
  const ev = r1.evento as Extract<NonNullable<typeof r1.evento>, { t: 'mensaje' }>;
  assert.deepEqual(a.escenario, { ...escenarioParaRedactar(r1.estado, ev.paso), titulo: 'Pregunta el precio' });
  assert.equal(respuestaDelEnsayo(pasos, 'whatsapp', 'B').escenario?.contestaSolo, true);
  assert.deepEqual(respuestaDelEnsayo(pasos, 'whatsapp', 'C'), { titulo: 'Se queja', escenario: null });
  // No encajó y «Lo demás» sólo avisa: no contesta.
  assert.deepEqual(respuestaDelEnsayo(pasos, 'whatsapp', null), { titulo: ROTULO_LO_DEMAS, escenario: null });
});

test('si no encaja, «Lo demás»: con «Para aprobar» contesta con su guía; por un medio sin AI Step, nadie contesta', () => {
  const conLoDemas = conIA({ casos: [...conIA()[1].casos!, caso('L', { titulo: ROTULO_LO_DEMAS, cuando: '', cualquiera: true, responder: GUIA_LO_DEMAS })] });
  const r = respuestaDelEnsayo(conLoDemas, 'whatsapp', null);
  assert.equal(r.titulo, ROTULO_LO_DEMAS);
  assert.equal(r.escenario?.comoResponder, GUIA_LO_DEMAS);
  assert.equal(r.escenario?.contestaSolo, undefined, '«Lo demás» salió sola');
  assert.equal(r.escenario?.objetivo, 'Que llegue a su reunión');
  assert.deepEqual(respuestaDelEnsayo(conIA(), 'instagram', 'A'), { titulo: ROTULO_LO_DEMAS, escenario: null });
});

test('la ruta: objeciones del AI Step entero y «Responde MaKo» con el clasificador del motor, sin Claude; el modal manda los pasos', () => {
  const ruta = sinComentarios(leer('app/api/automations/ai-step/ensayo/route.ts'));
  assert.match(ruta, /user: pedidoDeObjeciones\(\{ \.\.\.ai, perfil,/);
  assert.match(ruta, /const esc = escenarioDeAIStep\(ai, ob, medio\);/);
  const mako = ruta.slice(ruta.indexOf("if (body.action === 'mako') {"), ruta.indexOf("if (body.action !== 'lead')"));
  // (16/10/2026: con la red de plataforma, como en vivo: tests/ai-step-red-y-voz.test.ts.)
  assert.match(mako, /const \{ casos, escenarios \} = casosDelClasificador\(pasos, medio\);\n(\s*\/\/[^\n]*\n)*\s+const clas = await clasificarEscenario\(historial\[historial\.length - 1\]\.texto, escenarios, \{ redDePlataforma: true \}\);/);
  assert.match(mako, /const elegido = respuestaDelEnsayo\(pasos, medio, i >= 0 \? casos\[i\]\.casoId : null\);/);
  assert.match(mako, /if \(!elegido\.escenario\) return Response\.json\(\{ ok: true, respuesta: null, escenario: elegido\.titulo \}\);/);
  assert.match(mako, /responderSimulador\(secuenciaId, historial, \{ tema: 'contestar en el ensayo', escenario: elegido\.escenario, redDePlataforma: true \}\)/);
  assert.doesNotMatch(ruta, /claude|anthropic|CASCADA_DOCS/i, 'el ensayo gasta una IA paga');
  const modal = sinComentarios(leer('app/automations/ModalEnsayoAIStep.tsx'));
  assert.match(modal, /pedir\(\{ action: 'mako', secuenciaId, pasos: pasosRef\.current, historial: historialDe\(hiloRef\.current\) \}\)/);
  assert.match(modal, /body: JSON\.stringify\(\{ \.\.\.body, medio, ai \}\)/);
  // Las líneas del sistema no viajan al modelo como si alguien las hubiera escrito.
  assert.match(modal, /const historialDe = \(h: readonly Linea\[\]\) => h\.filter\(\(l\) => l\.de !== 'sistema'\)/);
});

// ── ROTURAS (11/10/2026, w2-aistep-editor) ───────────────────────────────────────
// Arnés wf-undecima/w2-aistep-editor/roturas.cjs (una por vez, los SEIS archivos del paquete: 100 tests; restaura de
// memoria y verifica byte a byte; base 100 / 0, al final igual). «N / 100» = tests en rojo entre los seis; todas cazadas:
//   S1 «Guardar respuestas» escribe en el primer ESCENARIO (el editor)        → 2 / 100 (éste y automations-paso-ia)
//   S2 `cambioDelEnsayo` escribe en un escenario y no en el nodo             → 1 / 100
//   S3 las objeciones salen de UN escenario                                  → 1 / 100
//   S4 `ejemplosDeCharla` cuenta las líneas del sistema                      → 1 / 100
//   S5 «Responde MaKo» no mira si el escenario sale solo                     → 1 / 100
//   S6 «Responde MaKo» contesta también lo que sólo avisa                     → 1 / 100
//   S7 la ruta no clasifica: contesta con el primer escenario               → 1 / 100
